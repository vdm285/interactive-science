// The dive and the surface. With the 3D table mounted and animations on, the scene runs them: the
// camera dollies to the box, the door opens, the push-in passes the shells and the bloom resolves into
// the deck's hero (src/scene/scene.js). Otherwise, in the simple mode or with animations off, a 300 ms
// crossfade through the background swaps the views.

import { state } from './store.js';
import { openElement, openPeek } from './router.js';
import { sceneActive, sceneDive, sceneSurface } from '../table/stage3d.js';

const frame = () => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));

let busy = false;
export const isBusy = () => busy;

const wait = (ms) => new Promise((r) => setTimeout(r, ms));

// Web Animations rather than a CSS transition so the no-motion rule does not cancel it; raced against a
// timer because a hidden document does not advance animations and the swap must still happen.
async function fade(el, from, to, easing) {
  try {
    const anim = el.animate([{ opacity: from }, { opacity: to }], { duration: 150, fill: 'forwards', easing });
    await Promise.race([anim.finished, wait(220)]);
  } catch { /* cancelled */ }
}

async function crossfade(swap) {
  const veil = document.createElement('div');
  veil.className = 'xfade';
  document.body.append(veil);
  await fade(veil, 0, 1, 'ease-in');
  swap();
  await frame();
  await fade(veil, 1, 0, 'ease-out');
  veil.remove();
}

export async function dive(z, panel = 'materia') {
  if (busy) return;
  const e = state.byZ.get(z);
  if (!e) return;
  busy = true;
  try {
    if (state.motion && sceneActive()) await sceneDive(z, panel);
    else await crossfade(() => openElement(z, panel));
  } finally {
    busy = false;
  }
}

export async function surface() {
  if (busy) return;
  const z = state.z;
  if (!z || !state.byZ.get(z)) return;
  busy = true;
  try {
    if (state.motion && sceneActive()) await sceneSurface(z);
    else await crossfade(() => openPeek(z));
  } finally {
    busy = false;
  }
}
