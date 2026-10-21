// Hash routes. "#" is the table; "#fe" peeks at iron with the table still on screen; "#fe/nucleo"
// is deep inside iron on a panel; "#tabla/luz" is the table under a lens. The language is a
// preference, not a route, but "#fe/luz/en" is accepted for sharing and switches it.

import { state, set, savePrefs, markSeen } from './store.js';
import { LENSES, PANELS } from './i18n.js';

export function parseHash(hash) {
  const parts = decodeURIComponent(hash.replace(/^#\/?/, '')).toLowerCase().split('/').filter(Boolean);
  const langAt = (i) => (['es', 'en'].includes(parts[i]) ? parts[i] : null);
  if (!parts.length) return { view: 'table' };
  if (parts[0] === 'tabla' || parts[0] === 'table') {
    return { view: 'table', lens: LENSES.includes(parts[1]) ? parts[1] : null, lang: langAt(2) || langAt(1) };
  }
  const element = state.elements.find((e) => e.symbol.toLowerCase() === parts[0] || String(e.z) === parts[0]);
  if (!element) return { view: 'table' };
  const panel = PANELS.includes(parts[1]) ? parts[1] : null;
  return { view: panel ? 'element' : 'peek', z: element.z, panel, lang: langAt(2) || langAt(1) };
}

export function applyHash() {
  const route = parseHash(location.hash);
  const patch = { view: route.view, search: { open: false, q: '', hits: [] }, lightbox: null, lensOpen: false, videoPlaying: null };
  if (route.lang && route.lang !== state.lang) patch.lang = route.lang;
  if (route.view === 'element') {
    patch.z = route.z;
    patch.panel = route.panel;
    markSeen(route.z);
  } else if (route.view === 'peek') {
    patch.z = route.z;
    patch.panel = 'materia';
  } else {
    if (route.lens) patch.lens = route.lens;
    patch.z = null;
  }
  set(patch);
  if (patch.lang || route.lens) savePrefs();
}

export function hashFor({ view, z, panel, lens }) {
  if ((view === 'element' || view === 'peek') && z) {
    const e = state.byZ.get(z);
    return `#${e.symbol.toLowerCase()}${view === 'element' ? `/${panel || 'materia'}` : ''}`;
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

/** The table stays on screen; the element's world opens beneath it. */
export function openPeek(z) {
  go({ view: 'peek', z });
}

/** Deep inside an element, on a panel. */
export function openElement(z, panel) {
  go({ view: 'element', z, panel: panel || 'materia' });
}

export function openPanel(panel) {
  if (state.z) go({ view: 'element', z: state.z, panel });
}

export function backToTable() {
  go({ view: 'table', lens: state.lens });
}
