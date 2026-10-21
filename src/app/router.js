// Hash routes. "#fe" opens iron on its first panel, "#fe/nucleo" a panel, "#tabla/luz" a table lens.
// The language is a preference, not a route; "#fe/luz/en" is accepted for sharing and switches it.

import { state, set, savePrefs, markSeen } from './store.js';
import { LENSES, PANELS } from './i18n.js';

export function parseHash(hash) {
  const parts = decodeURIComponent(hash.replace(/^#\/?/, '')).toLowerCase().split('/').filter(Boolean);
  if (!parts.length) return { view: 'table' };
  if (parts[0] === 'tabla' || parts[0] === 'table') {
    return { view: 'table', lens: LENSES.includes(parts[1]) ? parts[1] : null, lang: parts[2] };
  }
  const element = state.elements.find((e) => e.symbol.toLowerCase() === parts[0] || String(e.z) === parts[0]);
  if (!element) return { view: 'table' };
  return { view: 'element', z: element.z, panel: PANELS.includes(parts[1]) ? parts[1] : null, lang: ['es', 'en'].includes(parts[2]) ? parts[2] : (['es', 'en'].includes(parts[1]) ? parts[1] : null) };
}

export function applyHash() {
  const route = parseHash(location.hash);
  const patch = { view: route.view, search: { open: false, q: '', hits: [] }, lightbox: null };
  if (route.lang && route.lang !== state.lang) patch.lang = route.lang;
  if (route.view === 'element') {
    patch.z = route.z;
    patch.panel = route.panel || (state.z === route.z ? state.panel : 'materia');
    markSeen(route.z);
  } else {
    if (route.lens) patch.lens = route.lens;
    patch.z = null;
  }
  set(patch);
  if (patch.lang || route.lens) savePrefs();
}

export function hashFor({ view, z, panel, lens }) {
  if (view === 'element' && z) {
    const e = state.byZ.get(z);
    return `#${e.symbol.toLowerCase()}${panel && panel !== 'materia' ? `/${panel}` : ''}`;
  }
  return lens && lens !== 'fotos' ? `#tabla/${lens}` : '#';
}

export function go(route) {
  const next = hashFor(route);
  if (next === location.hash || (next === '#' && !location.hash)) {
    applyHash();
    return;
  }
  location.hash = next;
}

export function openElement(z, panel) {
  go({ view: 'element', z, panel: panel || 'materia' });
}

export function openPanel(panel) {
  if (state.z) go({ view: 'element', z: state.z, panel });
}

export function backToTable() {
  go({ view: 'table', lens: state.lens });
}
