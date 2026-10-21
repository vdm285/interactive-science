// Wikipedia titles for the elements, shared by build-wiki.mjs and build-gallery.mjs.
// Importing this costs nothing; importing a build script would run it.

import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { ES } from './names.mjs';
import { root } from './net.mjs';

// Spanish Wikipedia titles that differ from the display name (the plain name is a
// disambiguation page or a different article).
export const ES_TITLES = {
  30: 'Zinc', 36: 'Criptón', 40: 'Circonio', 49: 'Indio (elemento)', 53: 'Yodo',
  73: 'Tántalo (elemento)', 74: 'Wolframio', 80: 'Mercurio (elemento)', 88: 'Radio (elemento)',
};

// English Wikipedia titles where the plain element name is a disambiguation page.
export const EN_TITLES = { 80: 'Mercury (element)' };

/** English titles per Z from the built core file. */
export async function loadEnglishNames() {
  const data = JSON.parse(await readFile(join(root, 'public/data/elements.json'), 'utf8'));
  const list = Array.isArray(data) ? data : data.elements;
  const out = {};
  for (const e of list) out[e.z] = EN_TITLES[e.z] || e.name?.en || e.name;
  if (Object.keys(out).length !== 118) throw new Error('public/data/elements.json does not hold 118 elements; run npm run data first');
  return out;
}

/** Spanish title candidates for Z: the disambiguated title first, then the classroom name and its aliases. */
export function esTitleCandidates(z) {
  const names = ES[z];
  const list = [];
  if (ES_TITLES[z]) list.push(ES_TITLES[z]);
  for (const n of names) {
    const cap = n[0].toUpperCase() + n.slice(1);
    if (!list.includes(cap)) list.push(cap);
  }
  return list;
}
