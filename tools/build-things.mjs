// Things per element: the minerals and ores it comes from, and the objects and materials
// it is made into, each with a Commons photograph. Wikidata (CC0) joined with Wikimedia
// Commons (per-file licenses) and the Wikipedia "minerals by element" categories.
// Writes public/data/things/{z}.json (cap 30 KB) and public/data/things/index.json.
//
// Minerals: every Wikidata item typed mineral species / variety / series / group / mineral with
// a chemical formula (P274) is fetched once; an element's candidates are the formulas that
// contain its symbol (not followed by a lowercase letter), plus the members of the enwiki
// "Category:<Element> minerals" and eswiki "Categoría:Minerales de <elemento>" categories.
// Objects: the element's P366 "use" values, items with P186 "made from material" = the element,
// alloys (P279+ alloy) that contain it, and items made from its well-known alloys. Generic
// classes (items with P279) pass; specific instances pass only when typed as a sculpture,
// monument, building, bridge, coin or archaeological artefact. Both lists are ranked by Wikipedia
// sitelink count, need a P18 photo whose Commons license passes licenseOk, and are capped at 12.
//
// Curation: data/overrides/things.json, { "<Z>": { minerals: { include, exclude }, objects: {...} } }.
// Caches under data/cache/. Run: node tools/build-things.mjs   (THINGS_ONLY=26,29 limits the Zs)

import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { ES } from './names.mjs';
import { sparql, getJsonCached, commonsInfo, licenseOk, commonsThumb, writeJsonCapped, exists, root, today } from './net.mjs';

const OUT = join(root, 'public/data/things');
const PER_FILE_CAP = 30 * 1024;
const INDEX_CAP = 12 * 1024;
const MAX_ITEMS = 12;
const DETAIL_POOL = 24; // candidates fetched in detail per list, so license failures still leave 12
const MIN_SITELINKS = 3; // museum specimen records and metaclass duplicates sit below this
const API = 'https://www.wikidata.org/w/api.php';

const MINERAL_TYPES = ['Q12089225', 'Q429795', 'Q3965281', 'Q1936581', 'Q7946']; // species, variety, series, group, mineral
const ALLOY = 'Q37756';
// Instances (items without P279) are kept only when one of their P31 types is under one of these.
// Buildings are deliberately not a root: skyscrapers tagged "made from aluminium" (the facade)
// crowded out foil and cans. Statues, monuments and bridges are what people picture as "made of".
const INSTANCE_ROOTS = ['Q860861', 'Q4989906', 'Q12280', 'Q41207', 'Q220659']; // sculpture, monument, bridge, coin, archaeological artefact
const MAX_INSTANCES = 4; // generic things first; a few famous landmarks after them
// Any item with one of these P31 types is dropped from the objects list.
const BLOCK_TYPES = new Set([
  'Q5', 'Q16521', // human, taxon
  'Q11344', 'Q25276', 'Q11173', 'Q113145171', 'Q47154513', 'Q17339814', // element, isotope, compound, chemistry metaclasses (not Q119892838 "mixture": that is cast iron and gunpowder)
  'Q83306', 'Q428830', 'Q241284', // periodic-table group, main group, geosphere
  'Q12140', 'Q1595418', // medication, remedy
  ...MINERAL_TYPES, // minerals belong in the other list
  'Q15706911', 'Q20203727', 'Q30149195', 'Q26883973', 'Q21745157', 'Q4140840', 'Q19860854', // fictional, mythical, biblical, lost, destroyed
  'Q167270', 'Q431289', // trademark, brand
  'Q46831', 'Q348', 'Q85869058', 'Q485146', // mountain range, time capsule, specimen, sample
  'Q21286738', 'Q4167836', 'Q13406463', // Wikimedia duplicate, category, list
]);
const EN_CATEGORY_VARIANTS = { Aluminum: ['Aluminium'], Cesium: ['Caesium'], Sulfur: ['Sulphur'] };

const only = process.env.THINGS_ONLY ? process.env.THINGS_ONLY.split(',').map(Number) : null;
const zs = Array.from({ length: 118 }, (_, i) => i + 1).filter((z) => !only || only.includes(z));

function chunk(arr, n) {
  const out = [];
  for (let i = 0; i < arr.length; i += n) out.push(arr.slice(i, i + n));
  return out;
}
const qidOf = (uri) => uri.split('/').pop();
const fileOf = (uri) => 'File:' + decodeURIComponent(uri.split('/Special:FilePath/').pop()).replace(/_/g, ' ');

// --- inputs ---------------------------------------------------------------------------------
const elementsFile = JSON.parse(await readFile(join(root, 'public/data/elements.json'), 'utf8'));
const elements = {};
for (const e of (Array.isArray(elementsFile) ? elementsFile : elementsFile.elements)) elements[e.z] = { symbol: e.symbol, en: e.name?.en ?? e.name };

const qidByZ = {};
for (const r of await sparql(`SELECT ?el ?z WHERE { ?el wdt:P31 wd:Q11344 ; wdt:P1086 ?z . FILTER(?z >= 1 && ?z <= 118) } ORDER BY ?z`)) {
  qidByZ[Number(r.z.value)] = qidOf(r.el.value);
}

let overrides = {};
const overridePath = join(root, 'data/overrides/things.json');
if (await exists(overridePath)) overrides = JSON.parse(await readFile(overridePath, 'utf8'));

// --- mineral universe: every mineral-type item with a formula ---------------------------------
const universe = new Map(); // qid -> { n, formulas: [], img: bool }
for (const type of MINERAL_TYPES) {
  const rows = await sparql(`SELECT ?m ?f ?n (SAMPLE(?img) AS ?i) WHERE {
    ?m wdt:P31 wd:${type} ; wdt:P274 ?f ; wikibase:sitelinks ?n .
    OPTIONAL { ?m wdt:P18 ?img }
  } GROUP BY ?m ?f ?n`, 'things');
  for (const r of rows) {
    const q = qidOf(r.m.value);
    const u = universe.get(q) || { n: Number(r.n.value), formulas: [], img: false };
    u.formulas.push(r.f.value);
    if (r.i) u.img = true;
    universe.set(q, u);
  }
}
console.log(`mineral universe: ${universe.size} items with a formula`);

// "Fe" must not match "Fe" inside "Fes"? There is no such symbol; the lowercase lookahead keeps
// S out of Si/Sb/Sr and C out of Ca/Cu/Cl. Roman-numeral valences like Fe(III) are removed first
// so iodine does not match them.
function formulaHas(formula, symbol) {
  const clean = formula.replace(/\((I{1,3}|IV|VI{0,3})\)/g, '').replace(/[⁰¹²³⁴⁵⁶⁷⁸⁹⁺⁻]/g, '');
  return new RegExp(`${symbol}(?![a-z])`).test(clean);
}

// --- Wikipedia categories joined back to Wikidata ---------------------------------------------
async function categoryQids(lang, category) {
  const qids = [];
  let cont = '';
  for (let page = 0; page < 10; page += 1) {
    const url = `https://${lang}.wikipedia.org/w/api.php?action=query&generator=categorymembers&gcmtitle=${encodeURIComponent(category)}&gcmnamespace=0&gcmlimit=500&prop=pageprops&ppprop=wikibase_item&format=json${cont}`;
    const data = await getJsonCached(url, 'wiki-category');
    for (const p of Object.values(data?.query?.pages || {})) if (p.pageprops?.wikibase_item) qids.push(p.pageprops.wikibase_item);
    if (!data?.continue?.gcmcontinue) break;
    cont = `&gcmcontinue=${encodeURIComponent(data.continue.gcmcontinue)}`;
  }
  return qids;
}

async function mineralCategoryQids(z) {
  const out = new Set();
  const enNames = [elements[z].en, ...(EN_CATEGORY_VARIANTS[elements[z].en] || [])];
  for (const n of enNames) for (const q of await categoryQids('en', `Category:${n} minerals`)) out.add(q);
  for (const n of ES[z]) for (const q of await categoryQids('es', `Categoría:Minerales de ${n.toLowerCase()}`)) out.add(q);
  return out;
}

// Sitelink count, image presence and types for items we only know by QID (category members, overrides).
async function lite(qids) {
  const out = {};
  for (const batch of chunk([...qids].sort(), 200)) {
    const rows = await sparql(`SELECT ?m ?n (SAMPLE(?img) AS ?i) (GROUP_CONCAT(DISTINCT ?t; separator=" ") AS ?types) WHERE {
      VALUES ?m { ${batch.map((q) => `wd:${q}`).join(' ')} }
      ?m wikibase:sitelinks ?n . OPTIONAL { ?m wdt:P18 ?img } OPTIONAL { ?m wdt:P31 ?t }
    } GROUP BY ?m ?n`, 'things');
    for (const r of rows) out[qidOf(r.m.value)] = { n: Number(r.n.value), img: !!r.i, types: (r.types?.value || '').split(' ').filter(Boolean).map(qidOf) };
  }
  return out;
}

// --- details: labels, Wikipedia titles, every P18, formula, types ----------------------------
async function details(qids) {
  const out = {};
  for (const batch of chunk([...new Set(qids)].sort(), 50)) {
    const url = `${API}?action=wbgetentities&ids=${batch.join('|')}&props=labels|sitelinks|claims&languages=es|en|mul&sitefilter=eswiki|enwiki&format=json`;
    const data = await getJsonCached(url, 'wikidata-entities');
    for (const [q, e] of Object.entries(data?.entities || {})) {
      const claims = e.claims || {};
      const values = (prop) => (claims[prop] || []).filter((s) => s.rank !== 'deprecated' && s.mainsnak.snaktype === 'value').map((s) => s.mainsnak.datavalue.value);
      const mul = e.labels?.mul?.value ?? null;
      const es = e.labels?.es?.value ?? mul ?? e.labels?.en?.value ?? null;
      const en = e.labels?.en?.value ?? mul ?? e.labels?.es?.value ?? null;
      out[q] = {
        es, en,
        esNative: !!e.labels?.es,
        formula: values('P274')[0] ?? null,
        images: values('P18').map((f) => `File:${f}`),
        types: values('P31').map((v) => v.id),
        wiki: { es: e.sitelinks?.eswiki?.title ?? null, en: e.sitelinks?.enwiki?.title ?? null },
      };
    }
  }
  return out;
}

// First P18 photo that is a real raster image under an acceptable license.
async function pickPhotos(items) {
  const files = [...new Set(items.flatMap((it) => it.images.slice(0, 3)))];
  const info = await commonsInfo(files);
  const photos = {};
  for (const it of items) {
    for (const file of it.images.slice(0, 3)) {
      const meta = info[file];
      if (!meta) { stats.notOnCommons += 1; continue; }
      if (!/^image\//.test(meta.mime || '') || /svg|gif/.test(meta.mime)) { stats.badMime += 1; continue; }
      if (!licenseOk(meta.license)) { stats.badLicense += 1; junk('license', `${it.en} (${meta.license})`); continue; }
      photos[it.qid] = {
        file: meta.title,
        thumb: commonsThumb(meta.title, 500),
        src: commonsThumb(meta.title, 1280),
        artist: meta.artist,
        license: meta.license,
        licenseUrl: meta.licenseUrl,
        page: meta.descriptionUrl,
      };
      break;
    }
  }
  return photos;
}

const stats = { notOnCommons: 0, badMime: 0, badLicense: 0, noLabel: 0, fewSitelinks: 0, noImage: 0, blockedType: 0, instanceNotAllowed: 0, partNotThing: 0, classNotThing: 0, isElement: 0, excluded: 0, esFallback: 0 };
const junkLog = {};
function junk(kind, text) { (junkLog[kind] ||= []).push(text); }

// Rank candidates, fetch details for the top of the list, attach photos, keep MAX_ITEMS.
async function finish(z, ranked, kind) {
  const top = ranked.slice(0, DETAIL_POOL);
  const det = await details(top.map((c) => c.qid));
  const items = [];
  for (const c of top) {
    const d = det[c.qid];
    if (!d) continue;
    if (!d.es && !d.en) { stats.noLabel += 1; continue; }
    if (!d.images.length) { stats.noImage += 1; continue; }
    items.push({ qid: c.qid, n: c.n, via: c.via, ...d });
  }
  const photos = await pickPhotos(items);
  const kept = [];
  for (const it of items) {
    if (!photos[it.qid]) continue;
    if (!it.esNative) stats.esFallback += 1;
    const entry = { qid: it.qid, es: it.es, en: it.en };
    if (kind === 'minerals' && it.formula) entry.formula = it.formula;
    if (kind === 'objects' && it.via) entry.via = it.via;
    entry.photo = photos[it.qid];
    entry.wiki = it.wiki;
    kept.push(entry);
    if (kept.length >= MAX_ITEMS) break;
  }
  return kept;
}

function applyOverrides(cands, ov) {
  const exclude = new Set(ov?.exclude || []);
  // An included item skips the automatic filters even when a route already found it.
  for (const q of ov?.include || []) { const c = cands.get(q); if (c) c.via = 'override'; else cands.set(q, { via: 'override' }); }
  for (const q of exclude) if (cands.delete(q)) stats.excluded += 1;
  return cands;
}

// --- minerals -------------------------------------------------------------------------------
async function buildMinerals(z) {
  const symbol = elements[z].symbol;
  const cands = new Map(); // qid -> { via }
  for (const [q, u] of universe) if (u.formulas.some((f) => formulaHas(f, symbol))) cands.set(q, { via: 'formula', n: u.n, img: u.img });
  for (const q of await mineralCategoryQids(z)) if (!cands.has(q)) cands.set(q, { via: 'category' }); else cands.get(q).via = 'formula+category';
  applyOverrides(cands, overrides[String(z)]?.minerals);
  const unknown = [...cands].filter(([, c]) => c.n == null).map(([q]) => q);
  const extra = await lite(unknown);
  const ranked = [];
  for (const [qid, c] of cands) {
    const n = c.n ?? extra[qid]?.n ?? 0;
    const img = c.img ?? extra[qid]?.img ?? false;
    const types = extra[qid]?.types || [];
    if (types.includes('Q11344')) { stats.isElement += 1; continue; }
    if (types.includes('Q113145171') || types.includes('Q21286738')) { stats.blockedType += 1; continue; }
    if (!img) { stats.noImage += 1; continue; }
    if (n < MIN_SITELINKS && c.via !== 'override') { stats.fewSitelinks += 1; continue; }
    ranked.push({ qid, n, via: c.via });
  }
  ranked.sort((a, b) => b.n - a.n);
  return finish(z, ranked, 'minerals');
}

// --- objects --------------------------------------------------------------------------------
async function objectCandidates(z) {
  const el = qidByZ[z];
  // Three small queries: one combined UNION query answers 504 at WDQS.
  const tail = `?o wdt:P18 ?img ; wikibase:sitelinks ?n . FILTER(?n >= ${MIN_SITELINKS})
    OPTIONAL { ?o wdt:P31 ?t } OPTIONAL { ?o wdt:P279 ?sub }`;
  const head = 'SELECT ?o ?n (SAMPLE(?img) AS ?i) (GROUP_CONCAT(DISTINCT ?t; separator=" ") AS ?types) (SAMPLE(?sub) AS ?s) WHERE {';
  const routes = [
    ['use', `${head} wd:${el} wdt:P366 ?o . ${tail} } GROUP BY ?o ?n`],
    ['made', `${head} ?o wdt:P186 wd:${el} . ${tail} } GROUP BY ?o ?n ORDER BY DESC(?n) LIMIT 300`],
    ['alloy', `${head} { ?o wdt:P527 wd:${el} } UNION { ?o wdt:P186 wd:${el} } ?o wdt:P279+ wd:${ALLOY} . ${tail} } GROUP BY ?o ?n`],
    // "has part" inverse is mostly compounds (blocked by type below) but also gunpowder, mercury switch, iron ore, magnets.
    ['part', `${head} ?o wdt:P527 wd:${el} . ${tail} } GROUP BY ?o ?n ORDER BY DESC(?n) LIMIT 300`],
    ['uses', `${head} ?o wdt:P2283 wd:${el} . ${tail} } GROUP BY ?o ?n`],
  ];
  const cands = new Map();
  const alloys = [];
  for (const [via, query] of routes) {
    for (const r of await sparql(query, 'things')) {
      const q = qidOf(r.o.value);
      const c = cands.get(q) || { n: Number(r.n.value), via, types: (r.types?.value || '').split(' ').filter(Boolean).map(qidOf), isClass: !!r.s, img: true };
      if (via === 'alloy') { c.via = 'alloy'; alloys.push({ qid: q, n: c.n }); }
      cands.set(q, c);
    }
  }
  // Objects made from the element's well-known alloys (bronze, brass, cast iron...).
  const famous = alloys.filter((a) => a.n >= 20).map((a) => a.qid);
  if (famous.length) {
    const hop = await sparql(`SELECT ?o ?n ?mat (SAMPLE(?img) AS ?i) (GROUP_CONCAT(DISTINCT ?t; separator=" ") AS ?types) (SAMPLE(?sub) AS ?s) WHERE {
      VALUES ?mat { ${famous.map((q) => `wd:${q}`).join(' ')} }
      ?o wdt:P186 ?mat ; wdt:P18 ?img ; wikibase:sitelinks ?n . FILTER(?n >= ${MIN_SITELINKS})
      OPTIONAL { ?o wdt:P31 ?t } OPTIONAL { ?o wdt:P279 ?sub }
    } GROUP BY ?o ?n ?mat`, 'things');
    for (const r of hop) {
      const q = qidOf(r.o.value);
      if (cands.has(q)) continue;
      cands.set(q, { n: Number(r.n.value), via: `made:${qidOf(r.mat.value)}`, types: (r.types?.value || '').split(' ').filter(Boolean).map(qidOf), isClass: !!r.s, img: true });
    }
  }
  return cands;
}

// Which of these items (or types) sit under one of the roots, by P279* (one query per element).
async function under(qids, roots) {
  const out = new Set();
  for (const batch of chunk([...new Set(qids)], 200)) {
    const rows = await sparql(`SELECT DISTINCT ?x WHERE {
      VALUES ?x { ${batch.map((q) => `wd:${q}`).join(' ')} }
      VALUES ?root { ${roots.map((q) => `wd:${q}`).join(' ')} }
      ?x wdt:P279* ?root .
    }`, 'things');
    for (const r of rows) out.add(qidOf(r.x.value));
  }
  return out;
}
// "has part: carbon" is true of every organic substance (glucose, opium, casein, shellac...). The part
// route keeps only things: items under artificial physical object or ore (iron ore, mercury switch).
const PART_ROOTS = ['Q8205328', 'Q102798'];
// Every generic class must be a thing somebody can hold, buy or build: under artificial physical
// object, product, alloy, ore or award (or the landmark roots). This drops "organism" (uses oxygen),
// "Googie" (uses neon), "H II region" (made of hydrogen) and "tap dance" (made of brass).
const CLASS_ROOTS = ['Q8205328', 'Q2424752', 'Q214609', 'Q37756', 'Q102798', 'Q618779', ...INSTANCE_ROOTS]; // + material, so carbon fibers and gold leaf stay

async function buildObjects(z, mineralQids) {
  const cands = await objectCandidates(z);
  const ov = overrides[String(z)]?.objects;
  applyOverrides(cands, ov);
  const unknown = [...cands].filter(([, c]) => c.n == null).map(([q]) => q);
  const extra = await lite(unknown);
  for (const q of unknown) if (extra[q]) Object.assign(cands.get(q), extra[q], { isClass: true });
  const instanceTypes = [...new Set([...cands.values()].filter((c) => !c.isClass && c.via !== 'override').flatMap((c) => c.types || []))];
  const allowed = await under(instanceTypes, INSTANCE_ROOTS);
  const partThings = await under([...cands].filter(([, c]) => c.via === 'part').map(([q]) => q), PART_ROOTS);
  const classThings = await under([...cands].filter(([, c]) => c.isClass && c.via !== 'override').map(([q]) => q), CLASS_ROOTS);
  const ranked = [];
  for (const [qid, c] of cands) {
    const label = `${qid} (Z=${z}, ${c.n} sitelinks)`;
    if (mineralQids.has(qid)) continue;
    if (c.via !== 'override') {
      if (!c.img) { stats.noImage += 1; continue; }
      if ((c.types || []).some((t) => BLOCK_TYPES.has(t))) { stats.blockedType += 1; junk('blockedType', label); continue; }
      if (!c.isClass && !(c.types || []).some((t) => allowed.has(t))) { stats.instanceNotAllowed += 1; junk('instance', label); continue; }
      if (c.via === 'part' && !partThings.has(qid)) { stats.partNotThing += 1; junk('part', label); continue; }
      if (c.isClass && !classThings.has(qid)) { stats.classNotThing += 1; junk('class', label); continue; }
    }
    ranked.push({ qid, n: c.n ?? 0, via: c.via, isClass: c.isClass || c.via === 'override' });
  }
  // Generic things (classes) first, by sitelinks; then at most MAX_INSTANCES famous instances.
  ranked.sort((a, b) => (b.isClass - a.isClass) || (b.n - a.n));
  const instances = ranked.filter((r) => !r.isClass).slice(0, MAX_INSTANCES);
  return finish(z, [...ranked.filter((r) => r.isClass).slice(0, DETAIL_POOL - MAX_INSTANCES), ...instances], 'objects');
}

// --- run -------------------------------------------------------------------------------------
const results = {};
let total = 0;
for (const z of zs) {
  const minerals = await buildMinerals(z);
  const objects = await buildObjects(z, new Set(minerals.map((m) => m.qid)));
  const doc = {
    z,
    built: today(),
    source: {
      name: 'Wikidata (CC0) joined with Wikimedia Commons (per-file licenses)',
      method: 'minerals: Wikidata mineral items whose chemical formula (P274) contains the symbol, plus the Wikipedia "minerals by element" categories (en, es) joined to Wikidata; objects: P366 "use", items made from the element (P186), alloys containing it (P527/P186 under P279+ alloy), items made from its well-known alloys, things that have it as a part (P527, artificial objects and ores only) and P2283 "uses"; generic classes first, then at most four statues, monuments, bridges, coins or artefacts; ranked by Wikipedia sitelink count, photo = P18 with an accepted Commons license, 12 at most. Curation: data/overrides/things.json.',
      url: `https://www.wikidata.org/wiki/${qidByZ[z]}`,
    },
    minerals,
    objects,
  };
  const bytes = await writeJsonCapped(join(OUT, `${z}.json`), doc, PER_FILE_CAP);
  total += bytes;
  results[z] = { minerals: minerals.length, objects: objects.length, bytes, first: { minerals: minerals.slice(0, 3).map((m) => m.en), objects: objects.slice(0, 3).map((o) => o.en) } };
  process.stdout.write(`${z}:${minerals.length}/${objects.length} `);
}
process.stdout.write('\n');

// The index covers every element that has a file, so a partial run never erases earlier counts.
let index = { built: today(), max: MAX_ITEMS, counts: {} };
const indexPath = join(OUT, 'index.json');
if (await exists(indexPath)) index = { ...JSON.parse(await readFile(indexPath, 'utf8')), built: today(), max: MAX_ITEMS };
for (const z of zs) index.counts[z] = { minerals: results[z].minerals, objects: results[z].objects };
total += await writeJsonCapped(indexPath, index, INDEX_CAP);

const withMin = zs.filter((z) => results[z].minerals > 0).length;
const withObj = zs.filter((z) => results[z].objects > 0).length;
console.log(`things: ${zs.length} elements, minerals for ${withMin}, objects for ${withObj}, ${total} bytes in ${OUT}`);
console.log(`things: dropped ${JSON.stringify(stats)}`);
for (const [kind, list] of Object.entries(junkLog)) console.log(`  junk ${kind} (${list.length}): ${list.slice(0, 12).join(' | ')}`);
for (const z of [26, 29, 79, 6, 14, 13, 16, 80, 74].filter((z) => results[z])) {
  const r = results[z];
  console.log(`Z=${z} ${elements[z].en}: ${r.minerals} minerals [${r.first.minerals.join(', ')}] ; ${r.objects} objects [${r.first.objects.join(', ')}] ; ${r.bytes} bytes`);
}
