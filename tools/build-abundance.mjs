// Abundance of each element in five media -> public/data/abundance.json (cap 60 KB).
//
// Numbers are quoted, via English Wikipedia, from the handbooks and papers Wikipedia cites.
// One column per medium, each with the reference the page itself names. Research and
// licensing reasoning: docs/research/abundance-sources.md.
//
//   crust     "Abundances of the elements (data page)", column C1  (CRC Handbook)        -> mg/kg
//   ocean     same page, column W1                                 (CRC Handbook)        -> mg/L
//   sun       same page, column Y2 (Solar System, Anders & Grevesse 1989)                -> atoms per 10^6 Si
//   human     "Composition of the human body", column "Fraction of mass"                 -> mg/kg (ppm by mass)
//   universe  "Abundance of the chemical elements", table "Ten most common elements"    -> mg/kg (ppm by mass)
//
// Anything the parser cannot read with certainty (ranges, "<", missing cells) is null.
// Run: npm run abundance   (node tools/build-abundance.mjs). Page HTML caches in data/cache/.

import { join } from 'node:path';
import { getTextCached, writeJsonCapped, root, today } from './net.mjs';

const OUT = join(root, 'public/data/abundance.json');
const CAP = 60 * 1024;
const REST = 'https://en.wikipedia.org/api/rest_v1/page/html/';

const strip = (s) => String(s).replace(/<style[\s\S]*?<\/style>/g, '').replace(/<!--[\s\S]*?-->/g, '').replace(/<[^>]+>/g, '').replace(/&amp;/g, '&').replace(/\s+/g, ' ').trim();
const sig = (n, d = 6) => (n == null ? null : Number(Number(n).toPrecision(d)));

async function page(title) {
  const html = await getTextCached(`${REST}${title}`, 'wikipedia-html');
  const revision = Number(html.match(/Special:Redirect\/revision\/(\d+)/)?.[1]) || null;
  const modified = html.match(/<meta property="dc:modified" content="([^"]+)"/)?.[1] ?? null;
  const tables = [...html.matchAll(/<table[\s\S]*?<\/table>/g)].map((m) => m[0]);
  return { title, revision, modified, tables, url: `https://en.wikipedia.org/wiki/${title}` };
}

// Table -> array of rows, each row an array of raw cell HTML.
const rowsOf = (table) => [...table.matchAll(/<tr[\s\S]*?<\/tr>/g)].map((r) => [...r[0].matchAll(/<t[hd][^>]*>([\s\S]*?)<\/t[hd]>/g)].map((c) => c[1]));
const cellsWithAttrs = (table) => [...table.matchAll(/<tr[\s\S]*?<\/tr>/g)].map((r) => [...r[0].matchAll(/<(t[hd])([^>]*)>([\s\S]*?)<\/t[hd]>/g)].map((c) => ({ attrs: c[2], html: c[3] })));

// "5.63×10−2", "about 3.0×10−7", "2.38×101 (10%)", "7.2×10−12", "0.65", "73.97%"
function parseSci(text) {
  let t = strip(text).replace(/−/g, '-').replace(/\(.*?\)/g, '').replace(/\*|about|≈|~/g, '').trim();
  if (!t) return null;
  if (/[<>–-].*\d.*[–-]/.test(t) || /^[<>]/.test(t)) return null; // ranges and bounds: not a number we can quote
  const pct = t.endsWith('%');
  t = t.replace(/%$/, '').replace(/,/g, '');
  const m = /^([+-]?\d*\.?\d+)(?:\s*[×x]\s*10\^?([+-]?\d+))?$/.exec(t);
  if (!m) return null;
  const v = Number(m[1]) * 10 ** Number(m[2] || 0);
  return pct ? v / 100 : v;
}

// Data-page cells carry data-sort-value with the clean number; use it, fall back to the text.
function cellNumber(cell) {
  if (!strip(cell.html)) return null; // blank cell: the page still gives it data-sort-value="0.0" for sorting
  const sv = /data-sort-value="([^"]+)"/.exec(cell.attrs)?.[1];
  if (sv != null && sv !== '') { const n = Number(sv); if (Number.isFinite(n)) return n; }
  return parseSci(cell.html);
}

// {{val|60|e=-6}} rendered by Parsoid keeps its parameters in data-mw.
function valTemplate(html) {
  const m = /data-mw='([^']*"target":\{"wt":"val"[^']*)'/.exec(html);
  if (!m) return undefined;
  const mw = JSON.parse(m[1].replace(/&quot;/g, '"'));
  const params = mw.parts?.find((p) => p.template?.target?.wt === 'val')?.template?.params || {};
  if (params['2'] || params['-'] || params['+']) return null; // range or uncertainty form: do not guess
  const mant = Number(params['1']?.wt);
  const e = Number(params.e?.wt ?? 0);
  return Number.isFinite(mant) ? mant * 10 ** e : null;
}

// --- 1. Data page: crust (C1), sea water (W1), Solar System (Y2) ---------------------------
const dataPage = await page('Abundances_of_the_elements_(data_page)');
function pickColumn(table, header, scale) {
  const rows = cellsWithAttrs(table);
  const head = rows.find((r) => r.some((c) => strip(c.html) === header));
  if (!head) throw new Error(`No column ${header}`);
  const col = head.findIndex((c) => strip(c.html) === header);
  const out = {};
  for (const r of rows) {
    const z = Number(/^(\d+)\s/.exec(strip(r[0]?.html || ''))?.[1]);
    if (!z || !r[col]) continue;
    const n = cellNumber(r[col]);
    out[z] = n == null ? null : sig(n * scale);
  }
  return out;
}
const crustTable = dataPage.tables.find((t) => strip(t).includes('C1') && strip(t).includes('U2'));
const oceanTable = dataPage.tables.find((t) => /\bW1\b/.test(strip(t)) && /\bW2\b/.test(strip(t)));
const sunTable = dataPage.tables.find((t) => /\bY2\b/.test(strip(t)) && /\bS1\b/.test(strip(t)));
const crust = pickColumn(crustTable, 'C1', 1e6);   // mass fraction -> mg/kg
const ocean = pickColumn(oceanTable, 'W1', 1e6);   // page normalizes CRC's mg/L as a mass fraction (1 L ~ 1 kg); undo that
const sun = pickColumn(sunTable, 'Y2', 1e6);       // Si = 1 on the page -> conventional Si = 10^6 atoms

// --- 2. Human body ---------------------------------------------------------------------------
const humanPage = await page('Composition_of_the_human_body');
const humanTable = humanPage.tables.find((t) => strip(t).includes('Fraction of mass'));
const human = {};
const humanSkipped = [];
{
  const rows = rowsOf(humanTable);
  const head = rows[0].map(strip);
  const col = head.findIndex((h) => h.startsWith('Fraction of mass'));
  for (const r of rows.slice(1)) {
    const z = Number(strip(r[0]));
    if (!z) continue;
    const html = r[col] ?? '';
    let v = valTemplate(html);
    if (v === undefined) v = parseSci(html);
    if (v == null) humanSkipped.push(`${z} ${strip(r[1])}: "${strip(html)}"`);
    human[z] = v == null ? null : sig(v * 1e6); // mass fraction -> mg/kg
  }
}

// --- 3. Universe (Milky Way, spectroscopic; Croswell 1996) -----------------------------------
const universePage = await page('Abundance_of_the_chemical_elements');
const universeTable = universePage.tables.find((t) => { const h = rowsOf(t)[0]?.map(strip); return h && h[0] === 'Z' && h[2] === 'Mass fraction'; });
const universe = {};
for (const r of rowsOf(universeTable).slice(1)) {
  const z = Number(strip(r[0]));
  if (!z) continue;
  const v = parseSci(r[2]);
  universe[z] = v == null ? null : sig(v * 1e6); // fraction -> mg/kg
}

// --- 4. Assemble -----------------------------------------------------------------------------
const elements = {};
const count = { crust: 0, ocean: 0, human: 0, sun: 0, universe: 0 };
for (let z = 1; z <= 118; z += 1) {
  const e = { crust: crust[z] ?? null, ocean: ocean[z] ?? null, human: human[z] ?? null, sun: sun[z] ?? null, universe: universe[z] ?? null };
  for (const k of Object.keys(count)) if (e[k] != null) count[k] += 1;
  elements[z] = e;
}

const out = {
  built: today(),
  source: {
    page: dataPage.url,
    revision: dataPage.revision,
    retrieved: today(),
    license: 'CC BY-SA 4.0 (Wikipedia text and table arrangement); figures quoted from the references named per column',
    pages: {
      data: { title: dataPage.title, revision: dataPage.revision, modified: dataPage.modified, url: dataPage.url },
      human: { title: humanPage.title, revision: humanPage.revision, modified: humanPage.modified, url: humanPage.url },
      universe: { title: universePage.title, revision: universePage.revision, modified: universePage.modified, url: universePage.url },
    },
    columns: {
      crust: { unit: 'mg/kg', page: 'data', column: 'C1', ref: 'CRC Handbook of Chemistry and Physics, 85th ed. (2005), sec. 14, "Abundance of Elements in the Earth\'s Crust and in the Sea" (continental crust; median of reported measurements)' },
      ocean: { unit: 'mg/L', page: 'data', column: 'W1', ref: 'CRC Handbook of Chemistry and Physics, 85th ed. (2005), sec. 14 (sea water near the surface)' },
      human: { unit: 'mg/kg', page: 'human', column: 'Fraction of mass', ref: 'Chang, Chemistry 9th ed. (2007) p. 52; Frausto da Silva & Williams, The Biological Chemistry of the Elements (2001); Zumdahl, Chemistry 5th ed. (2000) p. 894; Cohn et al., Metabolism 25 (1976); Aloia et al., J Lab Clin Med 129 (1997)' },
      sun: { unit: 'atoms per 10^6 Si atoms', page: 'data', column: 'Y2', ref: 'Anders & Grevesse (1989), "Abundances of the elements: Meteoritic and solar", Geochim. Cosmochim. Acta 53, 197-214 (Solar System, mainly from CI chondrites)' },
      universe: { unit: 'mg/kg', page: 'universe', column: 'Mass fraction', ref: 'Croswell, Alchemy of the Heavens (1996): ten most common elements in the Milky Way, estimated spectroscopically' },
    },
  },
  elements,
};
const bytes = await writeJsonCapped(OUT, out, CAP);

console.log(`wrote ${OUT} (${bytes} bytes, cap ${CAP})`);
console.log('revisions:', Object.fromEntries(Object.entries(out.source.pages).map(([k, v]) => [k, v.revision])));
console.log('coverage:', count);
console.log('human cells left null:', humanSkipped.length ? humanSkipped.join(' | ') : 'none');
const check = (label, got, want) => console.log(`  ${label}: ${got} (expected about ${want})`);
check('crust O', elements[8].crust, 461000); check('crust Si', elements[14].crust, 282000); check('crust Al', elements[13].crust, 82300);
check('crust Fe', elements[26].crust, 56300); check('crust Au', elements[79].crust, 0.004);
check('human O', elements[8].human, 650000); check('human C', elements[6].human, 180000);
check('universe H', elements[1].universe, 739000); check('universe He', elements[2].universe, 240000);
check('ocean Fe mg/L', elements[26].ocean, 0.002); check('sun Fe (Si=1e6)', elements[26].sun, 900000);
for (const z of [26, 6, 80, 74, 43, 118]) console.log(`Z=${z}`, JSON.stringify(elements[z]));
