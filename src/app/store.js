// One store, one subscribe. Views re-render from the whole state; lit does the diffing.

const SEEN_KEY = 'materia:seen';
const PREF_KEY = 'materia:prefs';

function loadJson(key, fallback) {
  try { return JSON.parse(localStorage.getItem(key)) ?? fallback; } catch { return fallback; }
}

const prefs = loadJson(PREF_KEY, {});

export const state = {
  // data, filled by src/data/load.js
  elements: [],          // public/data/elements.json rows
  sources: [],
  byZ: new Map(),
  photos: null,          // public/data/photos.json
  spectra: null,
  isotopes: null,
  history: null,
  abundance: null,
  wikiIndex: null,
  galleryIndex: null,
  wiki: new Map(),       // z -> wiki/{z}.json
  gallery: new Map(),    // z -> gallery/{z}.json
  // view
  view: 'table',         // 'table' | 'element'
  z: null,               // open element
  panel: 'materia',
  lens: prefs.lens || 'fotos',
  property: prefs.property || 'electronegativity',
  celsius: prefs.celsius ?? 25,
  year: prefs.year ?? 1869,
  family: null,          // isolated family in the families lens
  hover: null,           // z under the pointer
  search: { open: false, q: '', hits: [] },
  settings: false,
  lightbox: null,        // index into the open gallery
  // prefs
  lang: prefs.lang === 'en' ? 'en' : 'es',   // Spanish first; English is a setting (or a /en in the hash)
  photosOn: prefs.photosOn ?? true,
  motion: prefs.motion ?? !matchMedia('(prefers-reduced-motion: reduce)').matches,
  seen: loadJson(SEEN_KEY, {}),
};

const listeners = new Set();
let scheduled = false;

export function subscribe(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function set(patch) {
  Object.assign(state, patch);
  if (scheduled) return;
  scheduled = true;
  queueMicrotask(() => {
    scheduled = false;
    for (const fn of listeners) fn(state);
  });
}

export function savePrefs() {
  const { lens, property, celsius, year, lang, photosOn, motion } = state;
  try { localStorage.setItem(PREF_KEY, JSON.stringify({ lens, property, celsius, year, lang, photosOn, motion })); } catch { /* private mode */ }
}

export function markSeen(z) {
  const day = Math.floor(Date.now() / 86400000);
  if (state.seen[z] === day) return;
  const seen = { ...state.seen, [z]: day };
  set({ seen });
  try { localStorage.setItem(SEEN_KEY, JSON.stringify(seen)); } catch { /* ignore */ }
}

export function forgetSeen() {
  set({ seen: {} });
  try { localStorage.removeItem(SEEN_KEY); } catch { /* ignore */ }
}

export const el = (z) => state.byZ.get(Number(z));
