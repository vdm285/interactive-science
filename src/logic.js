// Pure rules for the table. Tests in tests/logic.test.mjs are the spec.

const SHELL_CAP = [2, 8, 18, 32, 32, 18, 8, 2];

export function familyOf(element) {
  const category = element.category || '';
  if (element.z === 1) return 'nonmetal';
  if (category.includes('alkaline')) return 'alkaline';
  if (category.includes('alkali')) return 'alkali';
  if (category.includes('lanthanide')) return 'lanthanide';
  if (category.includes('actinide')) return 'actinide';
  if (category.includes('transition')) return 'transition';
  if (category.includes('post-transition')) return 'post';
  if (category.includes('metalloid')) return 'metalloid';
  if (category.includes('noble')) return 'noble';
  if (element.group === 17) return 'halogen';
  if (category.includes('nonmetal')) return 'nonmetal';
  return 'unknown';
}

export function radioactive(element) {
  return element.z === 43 || element.z === 61 || element.z >= 84;
}

/** Phase at a temperature in kelvin, using only melt and boil from the data. */
export function phaseAt(element, kelvin) {
  const melt = element.melt;
  const boil = element.boil;
  if (melt == null && boil == null) return { phase: 'unknown', known: false };
  if (melt != null && kelvin < melt) return { phase: 'solid', known: true };
  if (boil != null && kelvin >= boil) return { phase: 'gas', known: true };
  if (melt != null && (boil == null || kelvin < boil)) return { phase: 'liquid', known: true };
  return { phase: 'unknown', known: false };
}

export function celsius(kelvin) {
  if (kelvin == null) return null;
  return kelvin - 273.15;
}

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
    if (names.some((name) => name === q) || element.symbol.toLowerCase() === q) score = 100;
    else if (names.some((name) => name.startsWith(q))) score = 80;
    else if (names.some((name) => name.includes(q))) score = 40;
    if (score) scored.push({ element, score });
  }
  scored.sort((a, b) => b.score - a.score || a.element.z - b.element.z);
  return scored.slice(0, limit).map((row) => row.element);
}

export function massLabel(mass) {
  if (mass == null || Number.isNaN(mass)) return '—';
  const text = String(mass);
  if (text.length <= 8) return text;
  return String(Number(mass.toPrecision(6)));
}
