// What each lens paints on a tile. Pure functions from (element, state, extras) to a style/value;
// the table template applies them. Colors for heatmaps are a fixed perceptual ramp.

import { extent, scale01, phaseAt, cToKelvin, knownBy } from '../logic.js';
import { historyOf, abundanceOf } from '../data/load.js';

export const FAMILY_COLOR = {
  alkali: '#e2654f',
  alkaline: '#e8973a',
  transition: '#d9b451',
  post: '#86a35f',
  metalloid: '#3f9a8a',
  nonmetal: '#3f8fc4',
  halogen: '#6a74cf',
  noble: '#9a6cc2',
  lanthanide: '#cf6f94',
  actinide: '#b8595f',
  unknown: '#7d7a73',
};

// Sequential ramp (dark indigo → teal → warm yellow), sampled at t in 0..1.
const RAMP = [
  [28, 16, 68], [54, 36, 118], [63, 72, 142], [52, 108, 142], [44, 141, 130], [71, 171, 108], [138, 196, 75], [207, 210, 60], [250, 226, 90],
];
export function rampColor(t) {
  if (t == null) return null;
  const x = Math.min(1, Math.max(0, t)) * (RAMP.length - 1);
  const i = Math.floor(x);
  const f = x - i;
  const a = RAMP[i];
  const b = RAMP[Math.min(RAMP.length - 1, i + 1)];
  const c = a.map((v, k) => Math.round(v + (b[k] - v) * f));
  return `rgb(${c[0]},${c[1]},${c[2]})`;
}

export const PROPERTIES = {
  electronegativity: { get: (e) => e.electronegativity, log: false, digits: 2 },
  density: { get: (e) => e.densityGcm3, log: true, digits: 3 },
  melt: { get: (e) => e.melt, log: false, digits: 0 },
  boil: { get: (e) => e.boil, log: false, digits: 0 },
  ionizationEv: { get: (e) => e.ionizationEv, log: false, digits: 2 },
  mass: { get: (e) => e.mass, log: false, digits: 2 },
  crust: { get: (e) => abundanceOf(e.z)?.crust ?? null, log: true, digits: 3 },
  year: { get: (e) => { const y = discoveryYear(e); return e.ancient || y == null || y < 1000 ? null : y; }, log: false, digits: 0 },
};

/** Discovery year used across the app: Wikidata first, PubChem second; null for ancient or unknown. */
export function discoveryYear(e) {
  const h = historyOf(e.z);
  if (h?.discovered != null) return h.discovered;
  return e.yearDiscovered ?? null;
}

export function propertyExtent(elements, key) {
  const p = PROPERTIES[key];
  return extent(elements, (e) => {
    const v = p.get(e);
    return p.log && v != null && v <= 0 ? null : v;
  });
}

/** Phase class for the state lens. */
export function phaseClass(e, celsius) {
  return phaseAt(e, cToKelvin(celsius)).phase;
}

export function knownInYear(e, year) {
  return knownBy(e, year, discoveryYear(e));
}

/** Size lens: radius in pm (empirical, else calculated) and the max across the table. */
export function radiusOf(e) {
  return e.radius?.empirical ?? e.radius?.calculated ?? null;
}

export function heat(elements, key, e) {
  const p = PROPERTIES[key];
  const [lo, hi] = propertyExtent(elements, key);
  const v = p.get(e);
  const t = scale01(v, lo, hi, p.log);
  return { value: v, t, color: rampColor(t) };
}
