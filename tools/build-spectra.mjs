// Visible emission line spectra for Z 1..118 from the NIST Atomic Spectra Database (ASD).
// Source: https://physics.nist.gov/asd (Lines form, queried by URL the way astroquery.nist does).
// Output: public/data/spectra.json, one entry per element with the neutral atom ("X I"),
// falling back to the singly ionized "X II" when the neutral has no observed visible lines,
// and null when ASD has neither. Nothing is invented: every wavelength and intensity is NIST's.
//
// Run: node tools/build-spectra.mjs      (re-runs are free: every response is cached in data/cache/nist-asd/)
// Optional per-element override: data/overrides/spectra.json  { "26": { "species": "Fe II" } }

import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { performance } from 'node:perf_hooks';
import { getTextCached, writeJsonCapped, sleep, root, today, exists } from './net.mjs';

const SYMBOLS = [
  'H', 'He', 'Li', 'Be', 'B', 'C', 'N', 'O', 'F', 'Ne', 'Na', 'Mg', 'Al', 'Si', 'P', 'S', 'Cl', 'Ar',
  'K', 'Ca', 'Sc', 'Ti', 'V', 'Cr', 'Mn', 'Fe', 'Co', 'Ni', 'Cu', 'Zn', 'Ga', 'Ge', 'As', 'Se', 'Br', 'Kr',
  'Rb', 'Sr', 'Y', 'Zr', 'Nb', 'Mo', 'Tc', 'Ru', 'Rh', 'Pd', 'Ag', 'Cd', 'In', 'Sn', 'Sb', 'Te', 'I', 'Xe',
  'Cs', 'Ba', 'La', 'Ce', 'Pr', 'Nd', 'Pm', 'Sm', 'Eu', 'Gd', 'Tb', 'Dy', 'Ho', 'Er', 'Tm', 'Yb', 'Lu',
  'Hf', 'Ta', 'W', 'Re', 'Os', 'Ir', 'Pt', 'Au', 'Hg', 'Tl', 'Pb', 'Bi', 'Po', 'At', 'Rn',
  'Fr', 'Ra', 'Ac', 'Th', 'Pa', 'U', 'Np', 'Pu', 'Am', 'Cm', 'Bk', 'Cf', 'Es', 'Fm', 'Md', 'No', 'Lr',
  'Rf', 'Db', 'Sg', 'Bh', 'Hs', 'Mt', 'Ds', 'Rg', 'Cn', 'Nh', 'Fl', 'Mc', 'Lv', 'Ts', 'Og',
];
if (SYMBOLS.length !== 118) throw new Error(`Expected 118 symbols, got ${SYMBOLS.length}`);

const RANGE = [380, 780];
const BINS = 200;
const MAX_LINES = 160;
const CAP_BYTES = 450 * 1024;
const CACHE_SUB = 'nist-asd';
const MIN_GAP_MS = 1000; // one request at a time, about one per second

const ASD = 'https://physics.nist.gov/cgi-bin/ASD/lines1.pl';

// The parameter set is the one astroquery.nist uses (ASD rejects smaller column sets with
// "Invalid Column Setting"), with format=3 (tab-delimited) and show_av=2 (air wavelengths,
// the convention for the visible). Verified against H I: Balmer lines 656.28/486.13/434.05/410.17 nm.
function linesUrl(species, format = 3) {
  const params = new URLSearchParams({
    spectra: species,
    low_w: String(RANGE[0]),
    upp_w: String(RANGE[1]),
    unit: '1', // nm
    submit: 'Retrieve Data',
    format: String(format), // 1 = HTML/ascii, 2 = CSV, 3 = tab-delimited
    line_out: '0', // all lines
    en_unit: '0',
    output_type: '0', // whole table, not paged
    bibrefs: '1',
    show_obs_wl: '1',
    show_calc_wl: '1',
    order_out: '0', // by wavelength
    max_low_enrg: '',
    show_av: '2', // air wavelengths
    max_upp_enrg: '',
    tsb_value: '0',
    min_str: '',
    A_out: '0',
    f_out: 'on',
    intens_out: 'on',
    max_str: '',
    allowed_out: '1',
    forbid_out: '1',
    min_accur: '',
    min_intens: '',
    conf_out: 'on',
    term_out: 'on',
    enrg_out: 'on',
    J_out: 'on',
    g_out: 'on',
    page_size: '15',
    remove_js: 'on',
    show_wn: '1',
  });
  return `${ASD}?${params.toString()}`;
}

// Polite GET: cached on disk; when the cache missed (the call took real time), wait before the next one.
async function fetchPolite(url) {
  const t0 = performance.now();
  const text = await getTextCached(url, CACHE_SUB);
  if (performance.now() - t0 > 50) await sleep(MIN_GAP_MS);
  return text;
}

const unquote = (s) => s.replace(/^"|"$/g, '').trim();

// Relative intensity strings carry qualifiers: "500bl" (blended), "10700*", "(20)", "3980r", "bl" alone,
// "h", "w", "s" (letters only, no number). Take the first number; letters-only means no intensity.
function parseIntensity(raw) {
  const m = unquote(raw).match(/\d+(?:\.\d+)?(?:e[+-]?\d+)?/i);
  if (!m) return null;
  const v = Number(m[0]);
  return Number.isFinite(v) && v > 0 ? v : null;
}

// Returns { lines: [[nm, intensity], ...], oddities } or null when ASD has no such spectrum / no lines.
function parseTable(text) {
  if (text.trimStart().startsWith('<')) {
    if (/No lines are available in ASD/i.test(text)) return null;
    if (/Unrecognized token|not a valid|Invalid/i.test(text)) return null;
    const msg = text.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').match(/Error Message:\s*(.{0,160})/);
    throw new Error(`NIST ASD returned an unexpected page: ${msg ? msg[1] : text.slice(0, 160)}`);
  }
  const rows = text.split(/\r?\n/).filter((r) => r.trim() !== '');
  const header = rows.shift().split('\t').map((h) => h.trim());
  const iWl = header.findIndex((h) => /^obs_wl/.test(h));
  const iInt = header.indexOf('intens');
  if (iWl < 0 || iInt < 0) throw new Error(`Unexpected header: ${header.join(',')}`);
  const lines = [];
  const oddities = { noWavelength: 0, noIntensity: 0, letterOnly: 0, qualified: 0 };
  for (const row of rows) {
    const cells = row.split('\t');
    const wl = Number(unquote(cells[iWl] ?? ''));
    if (!Number.isFinite(wl) || wl <= 0) { oddities.noWavelength += 1; continue; }
    const rawInt = unquote(cells[iInt] ?? '');
    if (rawInt === '') { oddities.noIntensity += 1; continue; }
    const intensity = parseIntensity(rawInt);
    if (intensity == null) { oddities.letterOnly += 1; continue; }
    if (/[^\d.eE+-]/.test(rawInt)) oddities.qualified += 1;
    if (wl < RANGE[0] || wl > RANGE[1]) continue;
    lines.push([wl, intensity]);
  }
  return { lines, oddities };
}

function compact(lines) {
  const max = Math.max(...lines.map((l) => l[1]));
  // Perceptual strip: max intensity per bin, square-root scaled so weak lines stay visible, 0..255.
  const bins = new Array(BINS).fill(0);
  const width = (RANGE[1] - RANGE[0]) / BINS;
  for (const [wl, i] of lines) {
    const b = Math.min(BINS - 1, Math.floor((wl - RANGE[0]) / width));
    if (i > bins[b]) bins[b] = i;
  }
  const strip = bins.map((v) => (v > 0 ? Math.max(1, Math.round(Math.sqrt(v / max) * 255)) : 0));
  // Strongest MAX_LINES lines, merged where they round to the same 0.1 nm, sorted by wavelength.
  const merged = new Map();
  for (const [wl, i] of lines) {
    const key = Math.round(wl * 10) / 10;
    if (!merged.has(key) || merged.get(key) < i) merged.set(key, i);
  }
  const top = [...merged.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, MAX_LINES)
    .sort((a, b) => a[0] - b[0])
    .map(([wl, i]) => [wl, Math.max(0.01, Math.round((i / max) * 100) / 100)]);
  return { lines: top, bins: strip };
}

// Version and citation as printed by ASD itself on the HTML output of the same query.
async function sourceInfo() {
  const html = await fetchPolite(linesUrl('H I', 1));
  const flat = html.replace(/&nbsp;/g, ' ').replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ');
  const ver = flat.match(/NIST Atomic Spectra Database \(ver\. ([\d.]+)\)/);
  const cite = flat.match(/(Kramida, A\., Ralchenko, Yu\., Reader, J\., and NIST ASD Team \((\d{4})\))/);
  const doi = flat.match(/DOI: (https:\/\/doi\.org\/\S+)/);
  if (!ver || !cite) throw new Error('Could not read the ASD version/citation from the response');
  return {
    name: 'NIST Atomic Spectra Database',
    url: 'https://physics.nist.gov/asd',
    version: ver[1],
    citation: `${cite[1]}. NIST Atomic Spectra Database (ver. ${ver[1]}), [Online]. Available: https://physics.nist.gov/asd [${today()}]. National Institute of Standards and Technology, Gaithersburg, MD.${doi ? ` DOI: ${doi[1]}` : ''}`,
    license: 'Public domain (US federal government work); citation requested',
    wavelengths: 'observed, in air (nm)',
    intensities: 'NIST relative intensities, normalized per element to its strongest visible line',
  };
}

async function main() {
  const overridesPath = join(root, 'data/overrides/spectra.json');
  const overrides = (await exists(overridesPath)) ? JSON.parse(await readFile(overridesPath, 'utf8')) : {};

  const source = await sourceInfo();
  console.log(`NIST ASD ver. ${source.version}`);

  const elements = {};
  const stats = { withData: 0, nulls: [], ionized: [], oddities: { noWavelength: 0, noIntensity: 0, letterOnly: 0, qualified: 0 } };
  const raw = {};
  for (let z = 1; z <= 118; z += 1) {
    const sym = SYMBOLS[z - 1];
    const candidates = overrides[z]?.species ? [overrides[z].species] : [`${sym} I`, `${sym} II`];
    let found = null;
    for (const species of candidates) {
      const parsed = parseTable(await fetchPolite(linesUrl(species)));
      if (parsed) for (const k of Object.keys(parsed.oddities)) stats.oddities[k] += parsed.oddities[k];
      if (parsed && parsed.lines.length > 0) { found = { species, ...parsed }; break; }
    }
    if (!found) {
      elements[z] = null;
      stats.nulls.push(z);
      continue;
    }
    const { lines, bins } = compact(found.lines);
    elements[z] = { species: found.species, count: found.lines.length, lines, bins };
    raw[z] = found;
    stats.withData += 1;
    if (found.species.endsWith(' II')) stats.ionized.push(z);
  }

  const out = { built: today(), range: RANGE, bins: BINS, source, elements };
  const path = join(root, 'public/data/spectra.json');
  const bytes = await writeJsonCapped(path, out, CAP_BYTES);

  console.log(`wrote ${path} (${bytes} bytes, cap ${CAP_BYTES})`);
  console.log(`elements with data: ${stats.withData}; null: [${stats.nulls.join(', ')}]; used "II": [${stats.ionized.map((z) => `${z} ${SYMBOLS[z - 1]}`).join(', ')}]`);
  console.log(`rows skipped: ${stats.oddities.noWavelength} without observed wavelength, ${stats.oddities.noIntensity} without intensity, ${stats.oddities.letterOnly} letter-only intensity; ${stats.oddities.qualified} kept after stripping a qualifier`);
  for (const z of [1, 2, 11, 10, 26, 80]) {
    const e = elements[z];
    if (!e) { console.log(`${SYMBOLS[z - 1]}: null`); continue; }
    const top = [...e.lines].sort((a, b) => b[1] - a[1]).slice(0, 5).map(([wl, i]) => `${wl.toFixed(1)} nm (${i})`);
    console.log(`${SYMBOLS[z - 1]} (${e.species}): ${e.count} lines; top 5: ${top.join(', ')}`);
  }
}

await main();
