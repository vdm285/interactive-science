// Core element table: public/data/elements.json.
// Sources: Bowserinator's Periodic-Table-JSON (CC BY-SA 3.0) for the classroom numbers, shells and
// configurations; PubChem's periodic table (public domain, NLM acknowledgment requested) for oxidation
// states, first ionization energy in eV, electron affinity, the standard state and the discovery year;
// tools/names.mjs for the Spanish names used in Mexican classrooms and the RAE aliases.
// Overrides: data/overrides/elements.json (per Z, any field; the file explains itself).
// Every number in the app that is not drawn from another pipeline comes from this file.

import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { getJsonCached, root, today, writeJsonCapped, exists } from './net.mjs';
import { ES } from './names.mjs';

const BOWSER_URL = 'https://raw.githubusercontent.com/Bowserinator/Periodic-Table-JSON/master/PeriodicTableJSON.json';
const PUBCHEM_URL = 'https://pubchem.ncbi.nlm.nih.gov/rest/pug/periodictable/JSON';
const OUT = join(root, 'public/data/elements.json');
const OVERRIDES = join(root, 'data/overrides/elements.json');

const bowser = await getJsonCached(BOWSER_URL, 'bowserinator');
const pubchem = await getJsonCached(PUBCHEM_URL, 'pubchem');
const overrides = (await exists(OVERRIDES)) ? JSON.parse(await readFile(OVERRIDES, 'utf8')) : {};

const cols = pubchem.Table.Columns.Column;
const pub = new Map(pubchem.Table.Row.map((row) => {
  const o = Object.fromEntries(cols.map((c, i) => [c, row.Cell[i] === '' ? null : row.Cell[i]]));
  return [Number(o.AtomicNumber), o];
}));

const num = (v) => (v == null || v === '' || Number.isNaN(Number(v)) ? null : Number(v));

// Classroom family from Bowserinator's category plus the group. Hydrogen is a nonmetal.
function familyOf(e) {
  const c = e.category || '';
  if (e.number === 1) return 'nonmetal';
  if (c.includes('alkaline')) return 'alkaline';
  if (c.includes('alkali')) return 'alkali';
  if (c.includes('lanthanide')) return 'lanthanide';
  if (c.includes('actinide')) return 'actinide';
  if (c.includes('post-transition')) return 'post';
  if (c.includes('transition')) return 'transition';
  if (c.includes('metalloid')) return 'metalloid';
  if (c.includes('noble')) return 'noble';
  if (e.group === 17) return 'halogen';
  if (c.includes('nonmetal')) return 'nonmetal';
  return 'unknown';
}

// "+3, +2" → [3, 2]
function oxidation(text) {
  if (!text) return [];
  return text.split(',').map((s) => Number(s.trim().replace('+', ''))).filter((n) => Number.isFinite(n));
}

// PubChem's YearDiscovered is a year or "Ancient".
function yearOf(text) {
  if (!text) return { year: null, ancient: false };
  if (/ancient/i.test(text)) return { year: null, ancient: true };
  const y = Number(text);
  return Number.isFinite(y) ? { year: y, ancient: false } : { year: null, ancient: false };
}

const elements = bowser.elements
  .filter((e) => e.number >= 1 && e.number <= 118)
  .map((e) => {
    const names = ES[e.number];
    if (!names) throw new Error(`Missing Spanish name for ${e.number}`);
    const p = pub.get(e.number) || {};
    const shells = e.shells || [];
    const sum = shells.reduce((t, n) => t + n, 0);
    if (sum !== e.number) throw new Error(`Shells of ${e.symbol} sum to ${sum}`);
    const semantic = String(e.electron_configuration_semantic || '');
    const radii = e.atomic_radii || {};
    const discovered = yearOf(p.YearDiscovered);
    const row = {
      z: e.number,
      symbol: e.symbol,
      name: { es: names[0], en: e.name },
      aliases: names.slice(1),
      family: familyOf(e),
      familyUncertain: /^unknown/i.test(e.category || ''),
      category: e.category,
      block: e.block,
      period: e.period,
      group: e.group,
      x: e.xpos,
      y: e.ypos,
      mass: e.atomic_mass,
      phase: e.phase,                    // at standard conditions, per Bowserinator
      standardState: p.StandardState,    // PubChem wording, e.g. "Expected to be a Gas"
      melt: e.melt,                      // K
      boil: e.boil,                      // K
      density: e.density,                // g/cm3 for solids and liquids, g/L for gases
      densityUnit: e.density_unit,
      densityGcm3: e.density_g_cm3,
      molarHeat: e.molar_heat,           // J/(mol K)
      shells,
      config: e.electron_configuration,
      configShort: semantic.replace('*', '').trim(),
      configPredicted: semantic.includes('*') || /predicted/i.test(p.ElectronConfiguration || ''),
      electronegativity: e.electronegativity_pauling,
      electronAffinity: e.electron_affinity,         // kJ/mol (Bowserinator)
      electronAffinityEv: num(p.ElectronAffinity),   // eV (PubChem)
      ionization: e.ionization_energies || [],       // kJ/mol, successive
      ionizationEv: num(p.IonizationEnergy),         // eV, first (PubChem)
      radius: {
        empirical: radii.empirical?.[0] ?? null,
        calculated: radii.calculated?.[0] ?? null,
        covalent: radii.covalent_single?.[0] ?? null,
        vdw: radii.van_der_waals?.[0] ?? null,
        metallic: radii.metallic?.[0] ?? null,
        pubchem: num(p.AtomicRadius),
      },
      oxidation: oxidation(p.OxidationStates),
      cpk: p.CPKHexColor || e['cpk-hex'] || null,
      yearDiscovered: discovered.year,
      ancient: discovered.ancient,
      appearance: e.appearance || null,
      discoveredBy: e.discovered_by || null,
      namedBy: e.named_by || null,
      wikiEn: e.source,
      predictedHeavy: e.number > 103,
    };
    const over = overrides[String(e.number)];
    if (over && typeof over === 'object') Object.assign(row, over);
    return row;
  });

if (elements.length !== 118) throw new Error(`Expected 118 elements, got ${elements.length}`);

const out = {
  built: today(),
  sources: [
    { id: 'bowserinator', name: 'Periodic-Table-JSON (Bowserinator)', url: 'https://github.com/Bowserinator/Periodic-Table-JSON', license: 'CC BY-SA 3.0', fields: 'mass, phase, melt, boil, density, molar heat, shells, configurations, electronegativity, electron affinity (kJ/mol), ionization energies (kJ/mol), radii, appearance, discovered by, named by, table positions' },
    { id: 'pubchem', name: 'PubChem Periodic Table (NCBI/NLM)', url: 'https://pubchem.ncbi.nlm.nih.gov/periodic-table/', license: 'Public domain (US government work); acknowledgment requested', fields: 'oxidation states, first ionization energy (eV), electron affinity (eV), standard state, year discovered, CPK color' },
    { id: 'names', name: 'Spanish classroom names and RAE aliases', url: 'https://github.com/vdm285/interactive-science/blob/main/tools/names.mjs', license: 'MIT (this repository)' },
  ],
  elements,
};

const bytes = await writeJsonCapped(OUT, out, 160_000);
console.log(`wrote ${elements.length} elements, ${bytes} bytes → public/data/elements.json`);
const fe = elements[25];
console.log('Fe:', JSON.stringify({ z: fe.z, name: fe.name, family: fe.family, melt: fe.melt, boil: fe.boil, density: fe.density, radius: fe.radius, oxidation: fe.oxidation, ionizationEv: fe.ionizationEv, yearDiscovered: fe.yearDiscovered, ancient: fe.ancient }));
console.log('missing melt:', elements.filter((e) => e.melt == null).map((e) => e.symbol).join(' '));
console.log('missing boil:', elements.filter((e) => e.boil == null).map((e) => e.symbol).join(' '));
console.log('missing density:', elements.filter((e) => e.density == null).map((e) => e.symbol).join(' '));
console.log('missing radius (empirical or calculated):', elements.filter((e) => e.radius.empirical == null && e.radius.calculated == null).map((e) => e.symbol).join(' '));
console.log('missing electronegativity:', elements.filter((e) => e.electronegativity == null).map((e) => e.symbol).join(' '));
console.log('no year and not ancient:', elements.filter((e) => e.yearDiscovered == null && !e.ancient).map((e) => e.symbol).join(' '));
