import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { familyOf, phaseAt, radioactive, searchElements, shellNote } from '../src/logic.js';

const elements = JSON.parse(readFileSync(new URL('../src/data/elements.json', import.meta.url)));
const byZ = (z) => elements.find((element) => element.z === z);

test('the table is the real 118, and every shell adds up', () => {
  assert.equal(elements.length, 118);
  assert.equal(new Set(elements.map((element) => element.z)).size, 118);
  for (const element of elements) {
    assert.equal(element.shells.reduce((sum, n) => sum + n, 0), element.z, element.symbol);
    assert.equal(element.name.es.length > 1, true, element.symbol);
  }
});

test('families match the classroom table', () => {
  assert.equal(familyOf(byZ(1)), 'nonmetal');
  assert.equal(familyOf(byZ(11)), 'alkali');
  assert.equal(familyOf(byZ(20)), 'alkaline');
  assert.equal(familyOf(byZ(26)), 'transition');
  assert.equal(familyOf(byZ(17)), 'halogen');
  assert.equal(familyOf(byZ(2)), 'noble');
  assert.equal(familyOf(byZ(57)), 'lanthanide');
  assert.equal(familyOf(byZ(92)), 'actinide');
});

test('phase follows melt and boil, including the two famous liquids', () => {
  const room = 25 + 273.15;
  assert.equal(phaseAt(byZ(1), room).phase, 'gas');
  assert.equal(phaseAt(byZ(26), room).phase, 'solid');
  assert.equal(phaseAt(byZ(80), room).phase, 'liquid');
  assert.equal(phaseAt(byZ(35), room).phase, 'liquid');
  assert.equal(phaseAt(byZ(26), 2000 + 273.15).phase, 'liquid');
  assert.equal(phaseAt(byZ(26), 4000 + 273.15).phase, 'gas');
});

test('potassium starts a new shell before the previous one is full', () => {
  assert.equal(shellNote(byZ(19)) > 0, true);
  assert.equal(shellNote(byZ(10)), 0);
});

test('search understands Mexican names and the other official names', () => {
  assert.equal(searchElements(elements, 'oro')[0].symbol, 'Au');
  assert.equal(searchElements(elements, 'wolframio')[0].symbol, 'W');
  assert.equal(searchElements(elements, 'tungsteno')[0].symbol, 'W');
  assert.equal(searchElements(elements, 'Fe')[0].z, 26);
  assert.equal(searchElements(elements, '79')[0].symbol, 'Au');
  assert.equal(searchElements(elements, 'zzzz').length, 0);
});

test('radioactivity is the standard classroom rule, not a made-up list', () => {
  assert.equal(radioactive(byZ(26)), false);
  assert.equal(radioactive(byZ(43)), true);
  assert.equal(radioactive(byZ(92)), true);
  assert.equal(radioactive(byZ(82)), false);
});
