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
import { applyHash, openElement, openPeek, backToTable, openPanel } from './app/router.js';
import { loadCore, loadExtras, loadElementFiles, spectrumOf } from './data/load.js';
import { tableView, lensesView } from './table/table.js';
import { peekView } from './table/peek.js';
import { searchView, settingsView, openSearch, focusSearchIfPending } from './app/shell.js';
import { syncScene } from './table/stage3d.js';
import { deckView, availablePanels, scrollToPanel, wheelToPanels, syncPanelScroll } from './element/deck.js';
import { dive, surface, isBusy } from './app/transitions.js';
import { drawSpectrum } from './draw/spectrum.js';

const app = document.getElementById('app');

function view(s) {
  const deep = s.view === 'element';
  return html`
    ${deep ? deckView(s) : tableView(s)}
    ${s.view === 'peek' ? peekView(s) : null}
    ${deep ? null : searchView(s)}
    ${deep ? null : settingsView(s)}
    ${deep ? null : lensesView(s)}
  `;
}

let drawnSpectrumFor = null;

function afterRender(s) {
  focusSearchIfPending();
  document.body.classList.toggle('no-motion', !s.motion);
  document.body.classList.toggle('peeking', s.view === 'peek');
  document.body.classList.toggle('deep', s.view === 'element');
  document.documentElement.lang = s.lang;
  if ((s.view === 'element' || s.view === 'peek') && s.z) {
    const e = s.byZ.get(s.z);
    document.title = `${e.name[s.lang] || e.name.en} · Materia`;
    loadElementFiles(s.z);
  } else {
    document.title = 'Materia';
  }
  if (s.view === 'element' && s.z) {
    syncPanelScroll(s);
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
    drawnSpectrumFor = null;
    syncPanelScroll(s);
  }
  syncScene(s);
}

subscribe((s) => {
  render(view(s), app);
  afterRender(s);
});

function moveOnGrid(from, dx, dy) {
  for (let step = 1; step <= 18; step++) {
    const hit = state.elements.find((x) => x.x === from.x + dx * step && x.y === from.y + dy * step);
    if (hit) return hit;
  }
  return null;
}

function onKey(ev) {
  const typing = ev.target.matches('input, textarea');
  if (ev.key === 'Escape') {
    if (state.lightbox != null) { set({ lightbox: null }); return; }
    if (state.settings) { set({ settings: false }); return; }
    if (state.lensOpen) { set({ lensOpen: false }); return; }
    if (state.search.open) { set({ search: { open: false, q: '', hits: [] } }); return; }
    if (isBusy()) return;   // a dive or surface in flight owns the view, as it does for the pointer layer
    if (state.view === 'element') { surface(); return; }
    if (state.view === 'peek') { backToTable(); return; }
    return;
  }
  if (typing || isBusy()) return;
  if (ev.key === '/' && state.view !== 'element') { ev.preventDefault(); openSearch(); return; }
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
  if (state.view === 'peek') {
    // Arrows walk the table while peeking; Enter dives.
    const from = state.byZ.get(state.z);
    const dx = ev.key === 'ArrowRight' ? 1 : ev.key === 'ArrowLeft' ? -1 : 0;
    const dy = ev.key === 'ArrowDown' ? 1 : ev.key === 'ArrowUp' ? -1 : 0;
    if (dx || dy) {
      const target = moveOnGrid(from, dx, dy);
      if (target) { ev.preventDefault(); openPeek(target.z); }
      return;
    }
    if (ev.key === 'Enter') { ev.preventDefault(); dive(state.z, 'materia'); }
    return;
  }
  // Table: arrows move focus between tiles by grid position; Enter peeks.
  if (ev.key.startsWith('Arrow')) {
    const focused = document.activeElement?.closest?.('.tile');
    const from = focused ? state.byZ.get(Number(focused.dataset.z)) : state.byZ.get(state.hover || 1);
    if (!from) return;
    const dx = ev.key === 'ArrowRight' ? 1 : ev.key === 'ArrowLeft' ? -1 : 0;
    const dy = ev.key === 'ArrowDown' ? 1 : ev.key === 'ArrowUp' ? -1 : 0;
    const target = moveOnGrid(from, dx, dy);
    if (target) {
      ev.preventDefault();
      const tile = document.querySelector(`.tile[data-z="${target.z}"]`);
      if (tile) tile.focus(); else set({ hover: target.z });   // the 3D table has no tiles: the hover is the focus
    }
  }
  if (ev.key === 'Enter' && state.hover && !document.activeElement?.closest('.tile')) openPeek(state.hover);
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
  document.addEventListener('click', (ev) => {
    if (state.lensOpen && !ev.target.closest('.lens-pop, .lenses-btn')) set({ lensOpen: false });
  });
  if (import.meta.env.PROD && 'serviceWorker' in navigator) {
    navigator.serviceWorker.register(`${import.meta.env.BASE_URL}sw.js`).catch(() => {});
  }
  console.info(`${c.appName} ${state.built}`);
}

boot();
