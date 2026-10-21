// The bridge between the app and the three.js scene: WebGL detection, the lazy import of src/scene/
// (a separate chunk the simple mode never downloads), mounting the canvas host, pushing the store's
// hover, selection and lens into the scene after every render, and the dive and surface the scene runs.
// No three import here: this file is part of the app shell.

import { state, set } from '../app/store.js';
import { openPeek, openElement, openPanel } from '../app/router.js';
import { scrollToPanel } from '../element/deck.js';

let webgl = null;
export function webglOk() {
  if (webgl == null) {
    try {
      const c = document.createElement('canvas');
      webgl = !!(c.getContext('webgl2') || c.getContext('webgl'));
    } catch { webgl = false; }
  }
  return webgl;
}

/** Whether the table should be the 3D case for this state. */
export function use3d(s) {
  return s.quality !== 'simple' && !s.sceneFallback && webglOk();
}

let scene = null, host = null, loading = false, stats = null, pill = null;

export const sceneActive = () => !!scene && use3d(state);
export const sceneStats = () => stats;

function placePill(z, x, y, tilePx) {
  if (!pill || !pill.isConnected) pill = document.querySelector('.enter-3d');
  if (!pill || Number(pill.dataset.z) !== z) return;
  pill.style.left = `${x.toFixed(1)}px`;
  pill.style.top = `${(y + Math.max(6, tilePx * 0.08)).toFixed(1)}px`;
  pill.classList.add('placed');
}

async function mount() {
  loading = true;
  try {
    const { mountScene } = await import('../scene/scene.js');
    if (!use3d(state) || scene) return;
    host = document.createElement('div');
    host.className = 'gl-stage';
    document.body.append(host);
    scene = mountScene(host, {
      elements: state.elements,
      onProject: placePill,
      onStats: (st) => { stats = st; if (state.settings) set({ statsTick: (state.statsTick || 0) + 1 }); },
      // Automática's fallback waits for a dive or surface in flight to end (the stats loop fires at any moment)
      onSlow: () => { if (state.quality === 'auto' && !scene?.diving) set({ sceneFallback: 'slow' }); },
      onLost: () => set({ sceneFallback: 'lost' }),
    });
    syncScene(state);
    if (import.meta.env.DEV) window.__materiaScene = scene;   // dev only: the lens arrays and stats, for checks from the console
  } catch (err) {
    console.warn('[materia] 3D unavailable, simple mode', err);
    set({ sceneFallback: 'error' });
  } finally {
    loading = false;
  }
}

function unmount() {
  // destroy settles a dive or surface in flight: its onMount / onUnmount and onDone run now, so the deck
  // opens or closes and the transitions' promise resolves instead of leaving the app busy forever
  scene?.destroy();
  scene = null;
  host?.remove();
  host = null;
  stats = null;
  document.body.classList.remove('diving');
}

/** Called after every render: mounts, unmounts or updates the scene so it mirrors the state. */
export function syncScene(s) {
  if (!use3d(s)) { if (scene) unmount(); return; }
  if (!scene) { if (!loading) mount(); return; }
  scene.setCovered(s.view === 'element');
  scene.setSelection(s.view === 'peek' ? s.z : null);
  scene.setHover(s.view === 'element' ? null : s.hover);
  scene.setLens(s);
}

export const scenePick = (x, y) => (scene ? scene.pick(x, y) : null);

/**
 * The dive run by the scene: the deck mounts under the bloom at the end of the push-in, always on Materia
 * (the bloom resolves into the hero photograph, INTEGRATION.md step 4); a door that asked for another panel
 * glides to it once the veil has dissolved.
 */
export function sceneDive(z, panel) {
  return new Promise((resolve) => {
    document.body.classList.add('diving');
    const glide = () => { if (panel && panel !== 'materia' && state.view === 'element' && state.z === z) { openPanel(panel); scrollToPanel(panel); } };
    const done = () => { document.body.classList.remove('diving'); glide(); resolve(); };
    const ok = scene.dive(z, { onMount: () => openElement(z, 'materia'), onDone: done });
    if (!ok) { openElement(z, panel); document.body.classList.remove('diving'); resolve(); }
  });
}

/** The surface run by the scene: the hero dims into the veil, the deck goes, the camera pulls back out. */
export function sceneSurface(z) {
  return new Promise((resolve) => {
    document.body.classList.add('diving');
    const done = () => { document.body.classList.remove('diving'); resolve(); };
    const ok = scene.surface(z, { onUnmount: () => openPeek(z), onDone: done });
    if (!ok) { openPeek(z); done(); }
  });
}
