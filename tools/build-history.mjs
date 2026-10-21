// Discovery history per element from Wikidata (CC0) -> public/data/history.json (cap 150 KB).
//
// Per Z: the element item (P31 chemical element, P1086 atomic number), its enwiki/eswiki
// titles, P575 time of discovery, P61 discoverer, P138 named after, P189 location of discovery.
// Labels and descriptions for every linked item come in es and en.
//
// Optional corrections: data/overrides/history.json, shape { "<Z>": { field: value, ... } }.
// Fields listed there replace the Wikidata value for that element (shallow, per field).
// Only use it for a documented Wikidata error; say why in a "_note" field next to the fix.
//
// Run: npm run history   (node tools/build-history.mjs). Network results cache in data/cache/.

import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { sparql, getJsonCached, writeJsonCapped, exists, root, today } from './net.mjs';

const OUT = join(root, 'public/data/history.json');
const CAP = 150 * 1024;
const API = 'https://www.wikidata.org/w/api.php';

const PRECISION = { 6: 'millennium', 7: 'century', 8: 'decade', 9: 'year', 10: 'month', 11: 'day' };
// Qualifier properties we know how to describe on a discovery date.
const QUALIFIER_LABEL = {
  P1480: 'sourcing circumstances', P1319: 'earliest date', P1326: 'latest date',
  P459: 'determination method', P805: 'statement is subject of', P2241: 'reason for deprecated rank',
  P3831: 'object has role', P642: 'of', P1013: 'criterion used', P585: 'point in time', P1545: 'series ordinal',
  P2868: 'subject has role', P793: 'significant event', P276: 'location', P1810: 'subject named as',
};

function chunk(arr, n) {
  const out = [];
  for (let i = 0; i < arr.length; i += n) out.push(arr.slice(i, i + n));
  return out;
}

// "+1774-00-00T00:00:00Z" -> 1774 ; "-5000-00-00T00:00:00Z" -> -5000
function yearOf(time) {
  const m = /^([+-])(\d+)-/.exec(time);
  if (!m) return null;
  const y = Number(m[2]);
  return m[1] === '-' ? -y : y;
}

async function entities(ids, props, extra = '') {
  const out = {};
  for (const batch of chunk(ids, 50)) {
    const url = `${API}?action=wbgetentities&ids=${batch.join('|')}&props=${props}${extra}&format=json`;
    const data = await getJsonCached(url, 'wikidata-entities');
    Object.assign(out, data?.entities || {});
  }
  return out;
}

// --- 1. QID per atomic number -------------------------------------------------------------
const rows = await sparql(`SELECT ?el ?z WHERE {
  ?el wdt:P31 wd:Q11344 ; wdt:P1086 ?z .
  FILTER(?z >= 1 && ?z <= 118)
} ORDER BY ?z`);
const qidByZ = {};
for (const r of rows) {
  const z = Number(r.z.value);
  const qid = r.el.value.split('/').pop();
  if (qidByZ[z] && qidByZ[z] !== qid) throw new Error(`Two items claim Z=${z}: ${qidByZ[z]} and ${qid}`);
  qidByZ[z] = qid;
}
for (let z = 1; z <= 118; z += 1) if (!qidByZ[z]) throw new Error(`No Wikidata item for Z=${z}`);

// --- 2. Claims and sitelinks of the 118 element items ------------------------------------
const elementItems = await entities(Object.values(qidByZ), 'claims|sitelinks', '&sitefilter=enwiki|eswiki');

const itemIds = new Set();
const noteId = (snak) => {
  const v = snak?.datavalue?.value;
  if (snak?.datavalue?.type === 'wikibase-entityid') { itemIds.add(v.id); return v.id; }
  return null;
};

const live = (statements) => (statements || []).filter((s) => s.rank !== 'deprecated');

const raw = {};
for (const [z, qid] of Object.entries(qidByZ)) {
  const item = elementItems[qid];
  if (!item) throw new Error(`Entity ${qid} missing from API response`);
  const c = item.claims || {};
  const times = [];
  for (const s of live(c.P575)) {
    if (s.mainsnak.snaktype !== 'value') continue;
    const v = s.mainsnak.datavalue.value;
    const quals = [];
    for (const [prop, snaks] of Object.entries(s.qualifiers || {})) {
      for (const q of snaks) {
        if (q.snaktype !== 'value') { quals.push({ prop, value: q.snaktype }); continue; }
        const dv = q.datavalue;
        if (dv.type === 'wikibase-entityid') quals.push({ prop, item: noteId(q) });
        else if (dv.type === 'time') quals.push({ prop, year: yearOf(dv.value.time), precision: PRECISION[dv.value.precision] || String(dv.value.precision) });
        else quals.push({ prop, value: typeof dv.value === 'object' ? (dv.value.text ?? dv.value.amount ?? JSON.stringify(dv.value)) : String(dv.value) });
      }
    }
    times.push({ year: yearOf(v.time), precision: PRECISION[v.precision] || String(v.precision), rank: s.rank, quals });
  }
  const items = (prop) => live(c[prop]).map((s) => (s.mainsnak.snaktype === 'value' ? noteId(s.mainsnak) : s.mainsnak.snaktype));
  raw[z] = {
    qid,
    enTitle: item.sitelinks?.enwiki?.title ?? null,
    esTitle: item.sitelinks?.eswiki?.title ?? null,
    times,
    discoverers: items('P61'),
    namedAfter: items('P138'),
    places: items('P189'),
  };
}

// --- 3. Labels and descriptions (es, en) for every linked item ----------------------------
// "mul" holds names that are the same in every language (Wikidata moved e.g. "Marie Curie" there in 2024).
const labelItems = await entities([...itemIds].sort(), 'labels|descriptions', '&languages=es|en|mul');
const named = (qid) => {
  const e = labelItems[qid] || {};
  const mul = e.labels?.mul?.value ?? null;
  const es = e.labels?.es?.value ?? mul;
  const en = e.labels?.en?.value ?? mul;
  const out = { qid, es, en };
  const des = e.descriptions?.es?.value ?? null;
  const den = e.descriptions?.en?.value ?? null;
  if (des || den) out.description = { es: des, en: den };
  return out;
};
const labelOf = (qid) => labelItems[qid]?.labels?.en?.value ?? labelItems[qid]?.labels?.mul?.value ?? labelItems[qid]?.labels?.es?.value ?? qid;

function qualifiersNote(quals) {
  if (!quals.length) return null;
  return quals.map((q) => {
    const name = QUALIFIER_LABEL[q.prop] || q.prop;
    if (q.item) return `${name}: ${labelOf(q.item)}`;
    if (q.year != null) return `${name}: ${q.year} (${q.precision})`;
    return `${name}: ${q.value}`;
  }).join('; ');
}

// --- 4. Assemble ---------------------------------------------------------------------------
let overrides = {};
const overridePath = join(root, 'data/overrides/history.json');
if (await exists(overridePath)) overrides = JSON.parse(await readFile(overridePath, 'utf8'));

const elements = {};
const oddities = { noDate: [], noDiscoverer: [], unknownDiscoverer: [], coarseDate: [], manyDates: [], noNamedAfter: [], noPlace: [], noEsTitle: [] };
let nDate = 0; let nDisc = 0; let nNamed = 0; let nPlace = 0;

for (let z = 1; z <= 118; z += 1) {
  const r = raw[z];
  // Earliest non-deprecated date wins when there are several (Wikidata often keeps one
  // for the first identification and a later one qualified "pure substance" for isolation).
  const sorted = [...r.times].sort((a, b) => a.year - b.year);
  const first = sorted[0] || null;
  const discoverers = r.discoverers.filter((d) => d && d.startsWith('Q')).map(named);
  const unknown = r.discoverers.includes('somevalue');
  const entry = {
    wikidata: r.qid,
    enTitle: r.enTitle,
    esTitle: r.esTitle,
    discovered: first ? first.year : null,
    precision: first ? first.precision : null,
    discoveredAll: r.times.length > 1 ? r.times.map((t) => ({ year: t.year, precision: t.precision, qualifiersNote: qualifiersNote(t.quals) })) : [],
    discoveryNote: first ? qualifiersNote(first.quals) : null,
    discoverers,
    namedAfter: r.namedAfter.filter((d) => d && d.startsWith('Q')).map(named),
    discoveryPlace: r.places.length ? named(r.places.find((p) => p.startsWith('Q')) ?? r.places[0]) : null,
  };
  if (unknown) entry.discovererUnknown = true;
  if (overrides[z]) Object.assign(entry, overrides[z]);
  elements[z] = entry;

  const tag = `${z} ${r.enTitle}`;
  if (entry.discovered == null) oddities.noDate.push(tag); else nDate += 1;
  if (entry.discovered != null && (entry.precision !== 'year' && entry.precision !== 'month' && entry.precision !== 'day')) oddities.coarseDate.push(`${tag} (${entry.discovered}, ${entry.precision})`);
  if (r.times.length > 1) oddities.manyDates.push(`${tag} [${r.times.map((t) => t.year).join(', ')}]`);
  if (!entry.discoverers.length) oddities.noDiscoverer.push(tag); else nDisc += 1;
  if (unknown) oddities.unknownDiscoverer.push(tag);
  if (!entry.namedAfter.length) oddities.noNamedAfter.push(tag); else nNamed += 1;
  if (!entry.discoveryPlace) oddities.noPlace.push(tag); else nPlace += 1;
  if (!entry.esTitle) oddities.noEsTitle.push(tag);
}

const out = {
  built: today(),
  source: {
    name: 'Wikidata',
    url: 'https://www.wikidata.org/',
    license: 'CC0 1.0',
    properties: { discovered: 'P575', discoverers: 'P61', namedAfter: 'P138', discoveryPlace: 'P189' },
    note: 'discovered is the earliest non-deprecated P575 value; precision tells how coarse it is (a millennium-precision -5000 means "about the 5th millennium BCE", not a year). discovererUnknown marks an explicit "unknown value" in Wikidata.',
  },
  elements,
};
const bytes = await writeJsonCapped(OUT, out, CAP);

console.log(`wrote ${OUT} (${bytes} bytes, cap ${CAP})`);
console.log(`coverage: discovery date ${nDate}/118, discoverer ${nDisc}/118, namedAfter ${nNamed}/118, discoveryPlace ${nPlace}/118, labels fetched ${Object.keys(labelItems).length}`);
for (const [k, v] of Object.entries(oddities)) console.log(`\n${k} (${v.length}): ${v.join(' | ')}`);
console.log('');
for (const z of [26, 6, 80, 74, 43, 118]) console.log(`Z=${z}`, JSON.stringify(elements[z]));
