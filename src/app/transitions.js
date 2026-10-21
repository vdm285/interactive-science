// The dive: the chosen tile grows to fill the viewport, then swings open like a door onto the deck.
// The surface: the door closes and the face shrinks back to its tile in the band. Pure CSS transforms
// on one element, so a slow machine can keep up; with animations off both are instant.

import { state } from './store.js';
import { openElement, openPeek } from './router.js';
import { photoOf, tileUrl } from '../data/load.js';
import { FAMILY_COLOR } from '../table/lenses.js';

const frame = () => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

let busy = false;

function face(e) {
  const photo = state.photosOn ? photoOf(e.z) : null;
  const el = document.createElement('div');
  el.className = 'zoomer';
  const fam = FAMILY_COLOR[e.family];
  el.style.setProperty('--swatch', fam);
  el.style.backgroundImage = photo ? `url("${photo.hero}"), url("${tileUrl(e.z)}")` : 'none';
  el.style.backgroundColor = photo ? '#101216' : `color-mix(in srgb, ${fam} 26%, #15181d)`;
  el.innerHTML = `<span class="z">${e.z}</span><span class="sym">${e.symbol}</span>`;
  return el;
}

function placeAt(el, rect) {
  el.style.left = `${rect.left}px`;
  el.style.top = `${rect.top}px`;
  el.style.width = `${rect.width}px`;
  el.style.height = `${rect.height}px`;
  el.style.borderRadius = `${Math.max(6, rect.width * 0.11)}px`;
}

export async function dive(z, panel = 'materia') {
  if (busy) return;
  const e = state.byZ.get(z);
  const tile = document.querySelector(`.tile[data-z="${z}"]`);
  if (!e || !tile || !state.motion) { openElement(z, panel); return; }
  busy = true;
  try {
    const el = face(e);
    placeAt(el, tile.getBoundingClientRect());
    document.body.append(el);
    await frame();
    el.classList.add('full');
    await wait(620);
    openElement(z, panel);
    await frame();
    await wait(60);
    el.classList.add('open');
    await wait(720);
    el.remove();
  } finally {
    busy = false;
  }
}

export async function surface() {
  if (busy) return;
  const z = state.z;
  const e = state.byZ.get(z);
  if (!e || !state.motion) { openPeek(z); return; }
  busy = true;
  try {
    const el = face(e);
    el.classList.add('full', 'open', 'instant');
    document.body.append(el);
    await frame();
    el.classList.remove('instant');
    el.classList.remove('open');
    await wait(620);
    openPeek(z);
    await frame();
    const tile = document.querySelector(`.tile[data-z="${z}"]`);
    if (tile) {
      // The band is still settling; wait for its transition, then fly to the tile's final place.
      await wait(520);
      el.classList.remove('full');
      placeAt(el, tile.getBoundingClientRect());
      await wait(560);
    }
    el.classList.add('gone');
    await wait(220);
    el.remove();
  } finally {
    busy = false;
  }
}
