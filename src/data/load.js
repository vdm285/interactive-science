// Two-phase loading. loadCore fetches what the table needs to mount; loadExtras adds the rest in
// place and the views re-render as each file arrives. Per-element files (wiki, gallery) load on demand.

import { state, set } from '../app/store.js';

const base = import.meta.env.BASE_URL;

async function json(path) {
  try {
    const res = await fetch(`${base}data/${path}`);
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

export async function loadCore() {
  const core = await json('elements.json');
  if (!core) throw new Error('elements.json missing');
  const byZ = new Map(core.elements.map((e) => [e.z, e]));
  set({ elements: core.elements, sources: core.sources, byZ, built: core.built });
}

export function loadExtras() {
  json('photos.json').then((photos) => set({ photos }));
  json('spectra.json').then((spectra) => set({ spectra }));
  json('isotopes.json').then((isotopes) => set({ isotopes }));
  json('history.json').then((history) => set({ history }));
  json('abundance.json').then((abundance) => set({ abundance }));
  json('videos.json').then((videos) => set({ videos }));
  json('wiki/index.json').then((wikiIndex) => set({ wikiIndex }));
  json('gallery/index.json').then((galleryIndex) => set({ galleryIndex }));
}

const pending = new Set();

export function loadElementFiles(z) {
  if (!state.wiki.has(z) && !pending.has(`w${z}`)) {
    pending.add(`w${z}`);
    json(`wiki/${z}.json`).then((data) => {
      state.wiki.set(z, data);
      pending.delete(`w${z}`);
      set({ wikiTick: (state.wikiTick || 0) + 1 });
    });
  }
  if (!state.gallery.has(z) && !pending.has(`g${z}`)) {
    pending.add(`g${z}`);
    json(`gallery/${z}.json`).then((data) => {
      state.gallery.set(z, data);
      pending.delete(`g${z}`);
      set({ galleryTick: (state.galleryTick || 0) + 1 });
    });
  }
}

export const photoOf = (z) => state.photos?.elements?.[String(z)] || null;
export const spectrumOf = (z) => state.spectra?.elements?.[String(z)] || null;
export const isotopesOf = (z) => state.isotopes?.elements?.[String(z)] || null;
export const historyOf = (z) => state.history?.elements?.[String(z)] || null;
export const abundanceOf = (z) => state.abundance?.elements?.[String(z)] || null;
export const videoOf = (z) => state.videos?.elements?.[String(z)] || null;
export const tileUrl = (z) => `${base}img/tiles/${z}.webp`;
