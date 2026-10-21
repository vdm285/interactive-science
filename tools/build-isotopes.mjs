// Isotopes: public/data/isotopes.json.
// Source: IAEA Nuclear Data Section, Live Chart of Nuclides, data download API
// (fields=ground_states&nuclides=all), itself built from ENSDF, NUBASE2020 and AME2020.
// One CSV with every ground state (no isomers), one request, cached in data/cache/iaea/.
// For each element Z 1..118: its isotopes sorted by A (stability, natural abundance, half-life
// as the source's own value and unit, up to three decay modes with %), plus a summary the
// card can show without opening the list. Nothing here is computed from physics; the only
// transformations are rounding, unit labels and a readable half-life string.

import { join } from 'node:path';
import { mkdir, rm, writeFile } from 'node:fs/promises';
import { getTextCached, root, round, today, writeJsonCapped } from './net.mjs';

const API_URL = 'https://nds.iaea.org/relnsd/v1/data?fields=ground_states&nuclides=all';
const GUIDE_URL = 'https://www-nds.iaea.org/relnsd/vcharthtml/api_v0_guide.html';
const CHART_URL = 'https://www-nds.iaea.org/relnsd/vcharthtml/VChartHTML.html';
const TERMS_URL = 'https://nucleus.iaea.org/Pages/Others/Terms-Of-Use.aspx';
const OUT = join(root, 'public/data/isotopes.json');
const OUT_DIR = join(root, 'public/data/isotopes');
const CAP = 700_000;
const CAP_SPLIT = 30_000;

// Verbatim wording, read on 2026-10-21. The API guide has a "Data sources" section and links to the
// IAEA terms; it does not carry a one-line citation of its own. The guide also notes the server may
// answer 403 without a User-Agent (tools/net.mjs always sends one).
const GUIDE_QUOTES = [
  'ENSDF: Evaluated Nuclear Strucure Data Files, April 2022 snapshot',
  'N: 2020 Nubase Evaluation NUBASE20',
  'AME: 2020 Atomic Mass Evaluation AME20',
];
const TERMS_QUOTE = 'Content may be adapted, translated, copied, printed and downloaded for private study, research and teaching purposes, and for use in commercial and non-commercial products or services, provided that appropriate acknowledgement of the IAEA as the source is given and that the IAEA\'s endorsement of users\' views, products or services is not stated or implied in any way.';

const csv = await getTextCached(API_URL, 'iaea');
const guide = await getTextCached(GUIDE_URL, 'iaea');
const guideText = guide.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');
for (const q of GUIDE_QUOTES) {
  if (!guideText.includes(q)) console.warn(`warning: the API guide no longer says "${q}"; re-read ${GUIDE_URL}`);
}
if (!guide.includes(TERMS_URL)) console.warn(`warning: the API guide no longer links ${TERMS_URL}`);

// ---- parse the CSV (no quoting in this file; we check) -------------------------------------
const lines = csv.split(/\r?\n/).filter((l) => l.length > 0);
const header = lines[0].split(',');
if (lines.some((l) => l.includes('"'))) throw new Error('CSV has quoted fields; the simple parser is not enough');
const rows = lines.slice(1).map((line) => {
  const cells = line.split(',');
  if (cells.length !== header.length) throw new Error(`row has ${cells.length} cells, header has ${header.length}: ${line.slice(0, 80)}`);
  return Object.fromEntries(header.map((h, i) => [h, cells[i]]));
});
const extracted = rows[0]?.Extraction_date || null;

const num = (v) => (v === '' || v == null || Number.isNaN(Number(v)) ? null : Number(v));
const sig4 = (v) => (v == null ? null : Number(Number(v).toPrecision(4)));

// ---- half-life text, from the source's own value and unit ----------------------------------
const SUP = { '-': '⁻', 0: '⁰', 1: '¹', 2: '²', 3: '³', 4: '⁴', 5: '⁵', 6: '⁶', 7: '⁷', 8: '⁸', 9: '⁹' };
const sup = (n) => String(n).split('').map((c) => SUP[c] ?? c).join('');
const UNIT = { s: 's', ms: 'ms', us: 'µs', ns: 'ns', ps: 'ps', as: 'as', m: 'min', h: 'h', d: 'd', Y: 'y', eV: 'eV', keV: 'keV', MeV: 'MeV' };
const OP = { GT: '>', GE: '≥', LT: '<', AP: '≈' };
const WIDTH_UNITS = new Set(['eV', 'keV', 'MeV']); // a resonance width Γ, not a time; T½ = ħ·ln2/Γ, which the source already did for half_life_sec

function sigDigits(text) {
  const mantissa = String(text).split(/e/i)[0].replace(/[^0-9]/g, '').replace(/^0+/, '');
  return Math.min(Math.max(mantissa.length, 1), 6);
}

// "2.7E-21" → "2.7×10⁻²¹"; plain numbers unchanged.
function prettyNumber(text) {
  const m = /^(-?[0-9.]+)E([+-]?\d+)$/i.exec(text);
  if (!m) return text;
  return `${m[1]}×10${sup(Number(m[2]))}`;
}

// Years: prefix ky/My/Gy up to 1e12, scientific notation beyond, keeping the source's digits.
function prettyYears(text) {
  const value = Number(text);
  if (!Number.isFinite(value)) return `${prettyNumber(text)} y`;
  if (value < 1e4) return `${value} y`; // 6.8E+2 → 680 y
  const digits = sigDigits(text);
  const prefixes = [[1e9, 'Gy'], [1e6, 'My'], [1e3, 'ky']];
  if (value < 1e12) {
    const [div, label] = prefixes.find(([d]) => value >= d);
    return `${Number((value / div).toPrecision(digits))} ${label}`;
  }
  const exp = Math.floor(Math.log10(value));
  const mant = Number((value / 10 ** exp).toPrecision(digits));
  return `${mant}×10${sup(exp)} y`;
}

function halfLifeText(row) {
  const v = row.half_life;
  if (v === '' || v === 'STABLE' || v === '?') return null;
  const unit = UNIT[row.unit_hl];
  if (!unit) throw new Error(`unknown half-life unit "${row.unit_hl}" for Z=${row.z} N=${row.n}`);
  const body = row.unit_hl === 'Y' ? prettyYears(v) : `${prettyNumber(v)} ${unit}`;
  const op = OP[row.operator_hl];
  if (row.operator_hl && !op) throw new Error(`unknown operator "${row.operator_hl}"`);
  return op ? `${op} ${body}` : body;
}

// ENSDF cluster notation "{+22}Ne" → "22Ne"; "24NE" → "24Ne" (two-digit mass, two-letter symbol).
// Everything else as given (B-, EC+B+, A, SF, B-N, 2EC, 14C, ...).
function decayMode(text) {
  return text
    .replace(/^\{\+(\d+)\}([A-Za-z]+)$/, '$1$2')
    .replace(/^(\d{2,})([A-Z])([A-Z])$/, (_, a, b, c) => `${a}${b}${c.toLowerCase()}`);
}

function decays(row) {
  const out = [];
  for (const i of [1, 2, 3]) {
    const mode = row[`decay_${i}`];
    if (!mode) continue;
    out.push({ mode: decayMode(mode), pct: num(row[`decay_${i}_%`]) });
  }
  return out;
}

// ---- build ---------------------------------------------------------------------------------
const byZ = new Map();
for (const row of rows) {
  const z = Number(row.z);
  if (z < 1 || z > 118) continue; // the free neutron (Z=0) is not an element
  const n = Number(row.n);
  const stable = row.half_life === 'STABLE';
  const iso = {
    a: z + n,
    n,
    stable,
    abundance: round(num(row.abundance), 3),
    halfLifeSec: stable ? null : sig4(num(row.half_life_sec)),
    halfLife: halfLifeText(row),
    decays: decays(row),
  };
  if (row.jp) iso.jp = row.jp;
  if (WIDTH_UNITS.has(row.unit_hl)) iso.width = true; // halfLife text is a resonance width, not a time
  if (!byZ.has(z)) byZ.set(z, { symbol: row.symbol, isotopes: [] });
  byZ.get(z).isotopes.push(iso);
}

const elements = {};
for (let z = 1; z <= 118; z += 1) {
  const entry = byZ.get(z);
  if (!entry) { console.warn(`warning: no isotopes for Z=${z}`); continue; }
  const isotopes = entry.isotopes.sort((p, q) => p.a - q.a);
  const stableList = isotopes.filter((i) => i.stable);
  const withAbundance = isotopes.filter((i) => i.abundance != null);
  const mostAbundant = withAbundance.length
    ? withAbundance.reduce((best, i) => (i.abundance > best.abundance ? i : best))
    : null;
  const timed = isotopes.filter((i) => !i.stable && i.halfLifeSec != null);
  const longest = timed.length ? timed.reduce((best, i) => (i.halfLifeSec > best.halfLifeSec ? i : best)) : null;
  elements[z] = {
    symbol: entry.symbol,
    known: isotopes.length,
    stable: stableList.length,
    stableA: stableList.map((i) => i.a),
    mostAbundant: mostAbundant ? { a: mostAbundant.a, pct: mostAbundant.abundance } : null,
    longest: longest ? { a: longest.a, halfLifeSec: longest.halfLifeSec, text: longest.halfLife } : null,
    radioactive: stableList.length === 0,
    isotopes,
  };
}

const source = {
  name: 'IAEA Nuclear Data Section, Live Chart of Nuclides (NUBASE2020 / ENSDF)',
  url: CHART_URL,
  api: API_URL,
  apiGuide: GUIDE_URL,
  extracted,
  dataSources: GUIDE_QUOTES,
  citation: 'IAEA Nuclear Data Section, Live Chart of Nuclides, https://www-nds.iaea.org/relnsd/vcharthtml/VChartHTML.html (data: ENSDF, April 2022 snapshot; NUBASE2020; AME2020)',
  citationNote: 'Credit line composed from the API guide\'s "Data sources" section; the guide publishes no one-line citation of its own.',
  terms: TERMS_QUOTE,
  termsUrl: TERMS_URL,
};

const full = { built: today(), source, elements };
const total = Object.values(elements).reduce((t, e) => t + e.known, 0);

// ---- write: one file if it fits, otherwise summaries + per-element lists --------------------
let bytes;
let split = false;
const fullBytes = Buffer.byteLength(JSON.stringify(full));
if (fullBytes <= CAP) {
  await rm(OUT_DIR, { recursive: true, force: true });
  bytes = await writeJsonCapped(OUT, full, CAP);
} else {
  split = true;
  const summaries = Object.fromEntries(Object.entries(elements).map(([z, e]) => {
    const { isotopes, ...summary } = e;
    return [z, { ...summary, list: `isotopes/${z}.json` }];
  }));
  bytes = await writeJsonCapped(OUT, { built: today(), source, elements: summaries }, CAP);
  await mkdir(OUT_DIR, { recursive: true });
  for (const [z, e] of Object.entries(elements)) {
    await writeJsonCapped(join(OUT_DIR, `${z}.json`), { z: Number(z), symbol: e.symbol, isotopes: e.isotopes }, CAP_SPLIT);
  }
}

// ---- report --------------------------------------------------------------------------------
const el = (z) => elements[z];
const iso = (z, a) => el(z)?.isotopes.find((i) => i.a === a);
const show = (z, a) => { const i = iso(z, a); return i ? `${el(z).symbol}-${a} stable=${i.stable} abundance=${i.abundance} halfLife=${i.halfLife} sec=${i.halfLifeSec}` : `${z}-${a} MISSING`; };

console.log(`wrote ${total} nuclides for ${Object.keys(elements).length} elements, ${bytes} bytes → public/data/isotopes.json${split ? ` plus per-element lists in public/data/isotopes/ (full set was ${fullBytes} bytes)` : ''}`);
console.log(`source extraction date: ${extracted}`);
console.log('elements with zero isotopes:', Array.from({ length: 118 }, (_, i) => i + 1).filter((z) => !elements[z]).join(' ') || 'none');
console.log('H stableA:', JSON.stringify(el(1).stableA), '|', show(1, 3));
console.log('C stableA:', JSON.stringify(el(6).stableA), '|', show(6, 14));
console.log('Fe stableA:', JSON.stringify(el(26).stableA), '| mostAbundant', JSON.stringify(el(26).mostAbundant));
console.log('Tc radioactive:', el(43).radioactive, 'stable', el(43).stable, '| Pm radioactive:', el(61).radioactive, 'stable', el(61).stable);
console.log(show(83, 209), '| Bi radioactive by the data:', el(83).radioactive);
console.log(show(92, 238));
console.log('Og:', JSON.stringify(el(118).isotopes.map((i) => ({ a: i.a, halfLife: i.halfLife, halfLifeSec: i.halfLifeSec }))));
console.log('Fe summary:', JSON.stringify({ ...el(26), isotopes: undefined }));
console.log('no half-life at all (unknown):', Object.values(elements).reduce((t, e) => t + e.isotopes.filter((i) => !i.stable && i.halfLifeSec == null).length, 0));
console.log('abundance given but not STABLE:', Object.values(elements).flatMap((e) => e.isotopes.filter((i) => i.abundance != null && !i.stable).map((i) => `${e.symbol}-${i.a}`)).join(' '));
console.log('radioactive elements (no stable isotope):', Object.entries(elements).filter(([, e]) => e.radioactive).map(([, e]) => e.symbol).join(' '));
console.log('longest-lived is not the most abundant:', Object.entries(elements).filter(([, e]) => e.mostAbundant && e.longest && e.radioactive && e.mostAbundant.a !== e.longest.a).map(([, e]) => `${e.symbol}(${e.mostAbundant.a} vs ${e.longest.a})`).join(' ') || 'none');
console.log('width (Γ) instead of time:', Object.values(elements).reduce((t, e) => t + e.isotopes.filter((i) => i.width).length, 0));
console.log('half-life with operator:', Object.values(elements).reduce((t, e) => t + e.isotopes.filter((i) => /^[><≥≈]/.test(i.halfLife || '')).length, 0));
