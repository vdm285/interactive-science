import '@fontsource/fraunces/latin-500.css';
import '@fontsource/fraunces/latin-600.css';
import '@fontsource/fraunces/latin-ext-500.css';
import '@fontsource/outfit/latin-400.css';
import '@fontsource/outfit/latin-600.css';
import '@fontsource/outfit/latin-ext-400.css';
import './style.css';

import { html, render } from 'lit';
import { state, subscribe, set } from './app/store.js';
import { COPY } from './app/i18n.js';
import { applyHash, openElement, backToTable, openPanel } from './app/router.js';
import { loadCore, loadExtras, loadElementFiles, spectrumOf } from './data/load.js';
import { tableView } from './table/table.js';
import { searchView, settingsView, openSearch } from './app/shell.js';
import { deckView, availablePanels, scrollToPanel, wheelToPanels } from './element/deck.js';
import { drawSpectrum } from './draw/spectrum.js';

const app = document.getElementById('app');

function view(s) {
  return html`
    ${s.view === 'element' ? deckView(s) : tableView(s)}
    ${s.view === 'element' ? null : searchView(s)}
    ${s.view === 'element' ? null : settingsView(s)}
  `;
}

let drawnSpectrumFor = null;
let lastView = null;
let lastZ = null;

function afterRender(s) {
  document.body.classList.toggle('no-motion', !s.motion);
  document.documentElement.lang = s.lang;
  if (s.view === 'element' && s.z) {
    const e = s.byZ.get(s.z);
    document.title = `${e.name[s.lang] || e.name.en} · Materia`;
    loadElementFiles(s.z);
    // Keep the scroll position in sync with the panel in the hash.
    if (lastView !== 'element' || lastZ !== s.z) {
      requestAnimationFrame(() => scrollToPanel(s.panel, 'auto'));
    } else {
      scrollToPanel(s.panel);
    }
    // Draw the spectrum canvas once it exists.
    const canvas = document.querySelector('canvas.spectrum');
    const sp = spectrumOf(s.z);
    if (canvas && sp && drawnSpectrumFor !== `${s.z}:${canvas.clientWidth}`) {
      drawnSpectrumFor = `${s.z}:${canvas.clientWidth}`;
      const positions = drawSpectrum(canvas, sp.lines, { bins: sp.bins });
      canvas.onpointermove = (ev) => {
        const rect = canvas.getBoundingClientRect();
        const x = ev.clientX - rect.left;
        const nm = 380 + (x / rect.width) * 400;
        let best = null;
        for (const p of positions) if (!best || Math.abs(p.px - x) < Math.abs(best.px - x)) best = p;
        const out = document.getElementById('nmReadout');
        if (out) out.textContent = best && Math.abs(best.px - x) < 6 ? `${best.nm.toFixed(1)} nm · ${Math.round(best.rel * 100)} %` : `${nm.toFixed(0)} nm`;
      };
    }
  } else {
    document.title = 'Materia';
    drawnSpectrumFor = null;
  }
  lastView = s.view;
  lastZ = s.z;
}

subscribe((s) => {
  render(view(s), app);
  afterRender(s);
});

function onKey(ev) {
  const typing = ev.target.matches('input, textarea');
  if (ev.key === 'Escape') {
    if (state.lightbox != null) { set({ lightbox: null }); return; }
    if (state.settings) { set({ settings: false }); return; }
    if (state.search.open) { set({ search: { open: false, q: '', hits: [] } }); return; }
    if (state.view === 'element') { backToTable(); return; }
    return;
  }
  if (typing) return;
  if (ev.key === '/' && state.view === 'table') { ev.preventDefault(); openSearch(); return; }
  if (state.view === 'element') {
    const e = state.byZ.get(state.z);
    const panels = availablePanels(e, state);
    const i = panels.indexOf(state.panel);
    if (state.lightbox != null) {
      if (ev.key === 'ArrowRight') set({ lightbox: state.lightbox + 1 });
      if (ev.key === 'ArrowLeft') set({ lightbox: Math.max(0, state.lightbox - 1) });
      return;
    }
    if (ev.key === 'ArrowRight' && i < panels.length - 1) { openPanel(panels[i + 1]); scrollToPanel(panels[i + 1]); }
    if (ev.key === 'ArrowLeft' && i > 0) { openPanel(panels[i - 1]); scrollToPanel(panels[i - 1]); }
    if (ev.key === 'ArrowDown' && state.z < 118) openElement(state.z + 1, state.panel);
    if (ev.key === 'ArrowUp' && state.z > 1) openElement(state.z - 1, state.panel);
    return;
  }
  // Table: arrows move between tiles by grid position.
  if (ev.key.startsWith('Arrow')) {
    const focused = document.activeElement?.closest?.('.tile');
    const from = focused ? state.byZ.get(Number(focused.dataset.z)) : state.byZ.get(state.hover || 1);
    if (!from) return;
    const dx = ev.key === 'ArrowRight' ? 1 : ev.key === 'ArrowLeft' ? -1 : 0;
    const dy = ev.key === 'ArrowDown' ? 1 : ev.key === 'ArrowUp' ? -1 : 0;
    let target = null;
    for (let step = 1; step <= 18 && !target; step++) {
      target = state.elements.find((x) => x.x === from.x + dx * step && x.y === from.y + dy * step);
    }
    if (target) { ev.preventDefault(); document.querySelector(`.tile[data-z="${target.z}"]`)?.focus(); }
  }
  if (ev.key === 'Enter' && state.hover && !document.activeElement?.closest('.tile')) openElement(state.hover);
}

async function boot() {
  await loadCore();
  const c = COPY[state.lang];
  document.documentElement.lang = state.lang;
  applyHash();
  loadExtras();
  window.addEventListener('hashchange', applyHash);
  window.addEventListener('keydown', onKey);
  window.addEventListener('wheel', (ev) => { if (state.view === 'element' && !ev.target.closest('.lightbox')) wheelToPanels(ev); }, { passive: false });
  window.addEventListener('resize', () => { drawnSpectrumFor = null; set({ resizeTick: Date.now() }); });
  if (import.meta.env.PROD && 'serviceWorker' in navigator) {
    navigator.serviceWorker.register(`${import.meta.env.BASE_URL}sw.js`).catch(() => {});
  }
  console.info(`${c.appName} ${state.built}`);
}

boot();
