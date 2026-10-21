// Pure rules. No DOM. tests/logic.test.mjs is the spec.

export const FAMILIES = ['alkali', 'alkaline', 'transition', 'post', 'metalloid', 'nonmetal', 'halogen', 'noble', 'lanthanide', 'actinide'];

const SHELL_CAP = [2, 8, 18, 32, 32, 18, 8, 2];

/** Phase at a temperature in kelvin, using only melt and boil from the data. */
export function phaseAt(element, kelvin) {
  const { melt, boil } = element;
  if (melt == null && boil == null) return { phase: 'unknown', known: false };
  if (melt != null && kelvin < melt) return { phase: 'solid', known: true };
  if (boil != null && kelvin >= boil) return { phase: 'gas', known: true };
  if (melt != null && (boil == null || kelvin < boil)) return { phase: 'liquid', known: true };
  // Only boil is known: below it we cannot tell solid from liquid.
  return { phase: 'unknown', known: false };
}

export const kelvinToC = (k) => (k == null ? null : k - 273.15);
export const cToKelvin = (c) => c + 273.15;

/** Index (1-based) of the first shell that is not full while a later shell has electrons; 0 if none. */
export function shellNote(element) {
  const shells = element.shells || [];
  for (let i = 0; i < shells.length - 1; i++) {
    const cap = SHELL_CAP[i];
    if (cap && shells[i] < cap && shells[i + 1] > 0) return i + 1;
  }
  return 0;
}

export function norm(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

export function searchElements(elements, query, limit = 8) {
  const q = norm(query);
  if (!q) return [];
  const scored = [];
  for (const element of elements) {
    const names = [element.name.es, element.name.en, element.symbol, String(element.z), ...(element.aliases || [])].map(norm);
    let score = 0;
    if (names.some((name) => name === q)) score = 100;
    else if (names.some((name) => name.startsWith(q))) score = 80;
    else if (names.some((name) => name.includes(q))) score = 40;
    if (score) scored.push({ element, score });
  }
  scored.sort((a, b) => b.score - a.score || a.element.z - b.element.z);
  return scored.slice(0, limit).map((row) => row.element);
}

/** Parse "1s2 2s2 2p6 3s2 3p6 4s2 3d6" into [{n, l, count}] in the order given. */
export function parseConfig(config) {
  const out = [];
  for (const token of String(config || '').trim().split(/\s+/)) {
    const m = token.match(/^(\d)([spdfg])(\d+)$/);
    if (m) out.push({ n: Number(m[1]), l: m[2], count: Number(m[3]) });
  }
  return out;
}

const ORBITALS = { s: 1, p: 3, d: 5, f: 7, g: 9 };

/** Orbital boxes for a subshell: Hund's rule, one electron per box first, then pairs. */
export function orbitalBoxes(l, count) {
  const boxes = ORBITALS[l] || 1;
  const arr = Array.from({ length: boxes }, () => 0);
  let left = count;
  for (let i = 0; i < boxes && left > 0; i++, left--) arr[i] = 1;
  for (let i = 0; i < boxes && left > 0; i++, left--) arr[i] = 2;
  return arr;
}

/** Visible wavelength (nm) to an sRGB triple, 0..255. Outside 380–780 returns black. Based on the common piecewise approximation of the CIE locus. */
export function wavelengthToRgb(nm) {
  let r = 0, g = 0, b = 0;
  if (nm >= 380 && nm < 440) { r = -(nm - 440) / 60; g = 0; b = 1; }
  else if (nm < 490) { r = 0; g = (nm - 440) / 50; b = 1; }
  else if (nm < 510) { r = 0; g = 1; b = -(nm - 510) / 20; }
  else if (nm < 580) { r = (nm - 510) / 70; g = 1; b = 0; }
  else if (nm < 645) { r = 1; g = -(nm - 645) / 65; b = 0; }
  else if (nm <= 780) { r = 1; g = 0; b = 0; }
  else return [0, 0, 0];
  // Fade at the ends of the visible range.
  let f = 1;
  if (nm < 420) f = 0.3 + 0.7 * (nm - 380) / 40;
  else if (nm > 700) f = 0.3 + 0.7 * (780 - nm) / 80;
  const gamma = 0.8;
  const c = (v) => Math.round(255 * Math.pow(v * f, gamma));
  return [c(r), c(g), c(b)];
}

/** Compact half-life text from seconds, Spanish or English units. */
export function halfLifeText(seconds, lang = 'es') {
  if (seconds == null || !Number.isFinite(seconds)) return null;
  const y = 365.25 * 86400;
  const units = lang === 'es'
    ? [[1e9 * y, 'mil millones de años'], [1e6 * y, 'millones de años'], [1e3 * y, 'mil años'], [y, 'años'], [86400, 'días'], [3600, 'horas'], [60, 'minutos'], [1, 's'], [1e-3, 'ms'], [1e-6, 'µs'], [1e-9, 'ns']]
    : [[1e9 * y, 'billion years'], [1e6 * y, 'million years'], [1e3 * y, 'thousand years'], [y, 'years'], [86400, 'days'], [3600, 'hours'], [60, 'minutes'], [1, 's'], [1e-3, 'ms'], [1e-6, 'µs'], [1e-9, 'ns']];
  for (const [size, label] of units) {
    if (seconds >= size * 0.999) {
      const v = seconds / size;
      const text = v >= 100 ? Math.round(v).toLocaleString(lang === 'es' ? 'es-MX' : 'en-US') : v >= 10 ? v.toFixed(1) : v.toFixed(2);
      return `${text} ${label}`;
    }
  }
  return `${seconds.toExponential(1)} s`;
}

/** Number formatting that never invents precision: keeps the source digits up to a cap. */
export function fmt(value, lang = 'es', maxFraction = 3) {
  if (value == null || Number.isNaN(Number(value))) return null;
  const n = Number(value);
  const abs = Math.abs(n);
  const locale = lang === 'es' ? 'es-MX' : 'en-US';
  if (abs !== 0 && (abs < 1e-3 || abs >= 1e7)) return n.toExponential(2).replace('e+', 'e');
  return n.toLocaleString(locale, { maximumFractionDigits: maxFraction });
}

/** Min and max of a numeric accessor across elements, ignoring nulls. */
export function extent(elements, get) {
  let lo = Infinity, hi = -Infinity;
  for (const e of elements) {
    const v = get(e);
    if (v == null || !Number.isFinite(v)) continue;
    if (v < lo) lo = v;
    if (v > hi) hi = v;
  }
  return lo === Infinity ? [null, null] : [lo, hi];
}

/** 0..1 position of v in [lo, hi], optionally log-scaled (requires positive values). */
export function scale01(v, lo, hi, log = false) {
  if (v == null || lo == null || hi == null || hi === lo) return null;
  if (log) {
    if (v <= 0 || lo <= 0) return null;
    return Math.min(1, Math.max(0, (Math.log10(v) - Math.log10(lo)) / (Math.log10(hi) - Math.log10(lo))));
  }
  return Math.min(1, Math.max(0, (v - lo) / (hi - lo)));
}

/** Rank (1 = largest) of an element's value among elements with a value. */
export function rankOf(elements, get, z) {
  const rows = elements.map((e) => [e.z, get(e)]).filter(([, v]) => v != null && Number.isFinite(v));
  rows.sort((a, b) => b[1] - a[1]);
  const i = rows.findIndex(([id]) => id === z);
  return i < 0 ? null : { rank: i + 1, of: rows.length };
}

/** Which elements were known in a given year, from a discovery year (null = unknown) and an "ancient" flag. */
export function knownBy(element, year, discoveryYear) {
  if (element.ancient) return true;
  const y = discoveryYear ?? element.yearDiscovered;
  if (y == null) return false;
  return y <= year;
}
