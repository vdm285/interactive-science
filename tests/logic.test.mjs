import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { phaseAt, shellNote, searchElements, parseConfig, orbitalBoxes, wavelengthToRgb, halfLifeText, fmt, extent, scale01, rankOf, knownBy, cToKelvin } from '../src/logic.js';

const data = JSON.parse(readFileSync(new URL('../public/data/elements.json', import.meta.url)));
const elements = data.elements;
const byZ = (z) => elements.find((e) => e.z === z);

test('the table is the real 118, every shell adds up, every element has a Spanish name and a position', () => {
  assert.equal(elements.length, 118);
  assert.equal(new Set(elements.map((e) => e.z)).size, 118);
  for (const e of elements) {
    assert.equal(e.shells.reduce((s, n) => s + n, 0), e.z, e.symbol);
    assert.ok(e.name.es.length > 1, e.symbol);
    assert.ok(e.x >= 1 && e.x <= 18 && e.y >= 1 && e.y <= 10, e.symbol);
  }
  assert.equal(elements.filter((e) => e.z === 119).length, 0);
});

test('families match the classroom table', () => {
  assert.equal(byZ(1).family, 'nonmetal');
  assert.equal(byZ(11).family, 'alkali');
  assert.equal(byZ(20).family, 'alkaline');
  assert.equal(byZ(26).family, 'transition');
  assert.equal(byZ(17).family, 'halogen');
  assert.equal(byZ(2).family, 'noble');
  assert.equal(byZ(57).family, 'lanthanide');
  assert.equal(byZ(92).family, 'actinide');
  assert.equal(byZ(14).family, 'metalloid');
  assert.equal(byZ(13).family, 'post');
});

test('phase follows melt and boil, including the two famous liquids', () => {
  const room = cToKelvin(25);
  assert.equal(phaseAt(byZ(1), room).phase, 'gas');
  assert.equal(phaseAt(byZ(26), room).phase, 'solid');
  assert.equal(phaseAt(byZ(80), room).phase, 'liquid');
  assert.equal(phaseAt(byZ(35), room).phase, 'liquid');
  assert.equal(phaseAt(byZ(26), cToKelvin(2000)).phase, 'liquid');
  assert.equal(phaseAt(byZ(26), cToKelvin(4000)).phase, 'gas');
  assert.equal(phaseAt(byZ(118), room).phase, 'unknown');
});

test('potassium starts a new shell before the previous one is full; neon does not', () => {
  assert.ok(shellNote(byZ(19)) > 0);
  assert.equal(shellNote(byZ(10)), 0);
});

test('search understands Mexican names, RAE aliases, symbols and numbers', () => {
  assert.equal(searchElements(elements, 'oro')[0].symbol, 'Au');
  assert.equal(searchElements(elements, 'wolframio')[0].symbol, 'W');
  assert.equal(searchElements(elements, 'tungsteno')[0].symbol, 'W');
  assert.equal(searchElements(elements, 'cinc')[0].symbol, 'Zn');
  assert.equal(searchElements(elements, 'Fe')[0].z, 26);
  assert.equal(searchElements(elements, '79')[0].symbol, 'Au');
  assert.equal(searchElements(elements, 'ARGÓN')[0].symbol, 'Ar');
  assert.equal(searchElements(elements, 'zzzz').length, 0);
});

test('electron configurations parse and fill boxes by Hund', () => {
  const fe = parseConfig(byZ(26).config);
  assert.equal(fe.reduce((s, o) => s + o.count, 0), 26);
  assert.deepEqual(fe.at(-1), { n: 3, l: 'd', count: 6 });
  assert.deepEqual(orbitalBoxes('d', 6), [2, 1, 1, 1, 1]);
  assert.deepEqual(orbitalBoxes('p', 3), [1, 1, 1]);
  assert.deepEqual(orbitalBoxes('s', 2), [2]);
});

test('wavelengths map to sensible colors', () => {
  const [r1, g1, b1] = wavelengthToRgb(656.3);
  assert.ok(r1 > 200 && g1 < 60 && b1 === 0, 'H-alpha is red');
  const [r2, g2, b2] = wavelengthToRgb(486.1);
  assert.ok(b2 > 200 && r2 === 0 && g2 > 100, 'H-beta is blue-cyan');
  const [r3, g3] = wavelengthToRgb(589.0);
  assert.ok(r3 > 200 && g3 > 150, 'sodium D is yellow');
  assert.deepEqual(wavelengthToRgb(900), [0, 0, 0]);
});

test('half-lives read naturally in both languages', () => {
  assert.equal(halfLifeText(4.468e9 * 365.25 * 86400, 'es'), '4.47 mil millones de años');
  assert.equal(halfLifeText(5700 * 365.25 * 86400, 'en'), '5.70 thousand years');
  assert.equal(halfLifeText(0.00089, 'en'), '890 µs');
  assert.equal(halfLifeText(0.0012, 'en'), '1.20 ms');
  assert.equal(halfLifeText(null), null);
});

test('formatting keeps source digits and ranks skip missing values', () => {
  assert.equal(fmt(7.874, 'en'), '7.874');
  assert.equal(fmt(1811, 'en', 0), '1,811');
  assert.equal(fmt(null), null);
  const [lo, hi] = extent(elements, (e) => e.electronegativity);
  assert.ok(lo > 0.6 && lo < 0.8 && hi > 3.9 && hi < 4.0, 'Cs/Fr to F');
  assert.equal(scale01(hi, lo, hi), 1);
  assert.equal(rankOf(elements, (e) => e.electronegativity, 9).rank, 1);
  assert.equal(rankOf(elements, (e) => e.electronegativity, 118), null);
});

test('history lens: ancient elements are always known, others only after their year', () => {
  assert.equal(knownBy(byZ(26), 1500), true);
  assert.equal(knownBy(byZ(118), 2000, 2002), false);
  assert.equal(knownBy(byZ(118), 2010, 2002), true);
  assert.equal(knownBy({ ancient: false, yearDiscovered: null }, 2020, null), false);
});
