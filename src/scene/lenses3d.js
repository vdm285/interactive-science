// Lenses as light inside the boxes: maps the store's lens state to the per-instance attributes
// (one value per element; shaders.js lists them). Nothing here invents a value: phases come from
// phaseClass over melt and boil, years from the discovery data, strips from the NIST bins, radii and
// properties from elements.json, and an element with no datum gets the hatched floor, the dark wall
// or the dashed ring, never a guess. applyLens runs after every render (the sliders re-send estado and
// historia on every move) and reports which arrays changed so the scene uploads only those.

import { photoOf, spectrumOf } from '../data/load.js';
import { wavelengthToRgb, extent, scale01 } from '../logic.js';
import { PROPERTIES, propertyExtent, phaseClass, knownInYear, radiusOf, rampRgb } from '../table/lenses.js';
import { shellRadius } from './camera.js';

export const WALL_NONE = 0, WALL_PHOTO = 1, WALL_SPECTRUM = 2;
export const FLOOR_PLAIN = 0, FLOOR_WASH = 1, FLOOR_HATCH = 2;

// the state lens, as light: solid = frost and a third of the speed, liquid = a cool floor, gas = double speed, a warm floor and a lift
const LIQUID_WASH = [0.17, 0.56, 0.72];
const GAS_WASH = [0.91, 0.87, 0.77];
const GAS_LIFT = 0.06;
const SPEED = { solid: 1 / 3, liquid: 1, gas: 2, unknown: 1 };
const DASH_SCALE = 0.3;    // the small dashed ring of an element with no radius

/** The per-element arrays the scene turns into instanced attributes. */
export function makeLensState(N) {
  const atom = new Float32Array(N * 4), wall = new Float32Array(N * 2);
  for (let i = 0; i < N; i++) { atom.set([1, 0, 1, 0], i * 4); wall.set([-1, WALL_NONE], i * 2); }
  return {
    dim: new Float32Array(N).fill(1),   // 1 full light, 0 dimmed to 15 %
    atom,                               // scale, lift, show, dash
    spin: new Float32Array(N).fill(1),  // orbit speed multiplier
    frost: new Float32Array(N),         // frost on the glass
    floor: new Float32Array(N * 4),     // r, g, b, mode
    wall,                               // slot, kind
    glow: new Float32Array(N * 3),      // nucleus rim and halo color
    seen: new Float32Array(N),          // 1 when the element was opened in this browser (the gold dot of the tiles)
  };
}

const dominantCache = new Map();
/** The strip's dominant color: the intensity-weighted mean of the visible bins, normalized to full brightness. */
export function dominantColor(z, bins) {
  if (dominantCache.has(z)) return dominantCache.get(z);
  let r = 0, g = 0, b = 0;
  for (let i = 0; i < bins.length; i++) {
    if (!bins[i]) continue;
    const w = (bins[i] / 255) ** 2;
    const c = wavelengthToRgb(380 + (i + 0.5) * (400 / bins.length));
    r += c[0] * w; g += c[1] * w; b += c[2] * w;
  }
  const m = Math.max(r, g, b);
  const out = m > 0 ? [r / m, g / m, b / m] : null;
  dominantCache.set(z, out);
  return out;
}

/** Outermost ring radius of the drawn atom (camera.js shellRadius), to scale the atom by its measured radius. */
const outerRadius = (e) => shellRadius(e.shells.length, e.shells.length - 1);

/**
 * Fill the lens arrays `L` from the state for `els` (the scene's rows, with rgb). Returns null when nothing
 * changed, else an object naming the changed arrays (dim, atom, spin, frost, floor, wall, glow, seen).
 */
export function applyLens(s, els, L) {
  const ch = { dim: false, atom: false, spin: false, frost: false, floor: false, wall: false, glow: false, seen: false };
  // compare at float32 precision: the arrays are Float32Arrays, and a 1/3 read back is not the double 1/3
  const put = (arr, i, v, key) => { const f = Math.fround(v); if (arr[i] !== f) { arr[i] = f; ch[key] = true; } };
  const lens = s.lens;
  const fotos = lens === 'fotos' && s.photosOn;
  let maxR = null, lo = null, hi = null, prop = null;
  if (lens === 'tamano') [, maxR] = extent(els, radiusOf);
  if (lens === 'datos') { prop = PROPERTIES[s.property]; [lo, hi] = propertyExtent(els, s.property); }

  els.forEach((e, i) => {
    let dim = 1, scale = 1, lift = 0, show = 1, dash = 0, spin = 1, frost = 0;
    let floor = null, floorMode = FLOOR_PLAIN, wallSlot = -1, wallKind = WALL_NONE, glow = e.rgb;

    switch (lens) {
      case 'fotos':
        if (fotos && photoOf(e.z)) { wallSlot = i; wallKind = WALL_PHOTO; }
        break;
      case 'familias':
        // the family color becomes the box's inner light: the floor washes in it (the tiles paint 72 % of it)
        floor = e.rgb; floorMode = FLOOR_WASH;
        if (s.family && s.family !== e.family) dim = 0;
        break;
      case 'estado': {
        const phase = phaseClass(e, s.celsius);
        spin = SPEED[phase];
        if (phase === 'solid') frost = 1;
        else if (phase === 'liquid') { floor = LIQUID_WASH; floorMode = FLOOR_WASH; }
        else if (phase === 'gas') { floor = GAS_WASH; floorMode = FLOOR_WASH; lift = GAS_LIFT; }
        else floorMode = FLOOR_HATCH;
        break;
      }
      case 'historia':
        if (!knownInYear(e, s.year)) { dim = 0; show = 0; }
        break;
      case 'luz': {
        const bins = spectrumOf(e.z)?.bins;
        const c = bins ? dominantColor(e.z, bins) : null;
        if (c) { wallSlot = i; wallKind = WALL_SPECTRUM; glow = c; }
        break;
      }
      case 'tamano': {
        const r = radiusOf(e);
        if (r && maxR) scale = (r / maxR) * (0.40 / outerRadius(e));
        else { scale = DASH_SCALE; show = 0; dash = 1; }
        break;
      }
      case 'datos': {
        const v = prop.get(e);
        const t = scale01(prop.log && v != null && v <= 0 ? null : v, lo, hi, prop.log);
        const c = t == null ? null : rampRgb(t);
        if (c) { floor = [c[0] / 255, c[1] / 255, c[2] / 255]; floorMode = FLOOR_WASH; } else floorMode = FLOOR_HATCH;
        break;
      }
      default:
        break;
    }

    put(L.dim, i, dim, 'dim');
    put(L.atom, i * 4, scale, 'atom'); put(L.atom, i * 4 + 1, lift, 'atom'); put(L.atom, i * 4 + 2, show, 'atom'); put(L.atom, i * 4 + 3, dash, 'atom');
    put(L.spin, i, spin, 'spin');
    put(L.frost, i, frost, 'frost');
    const f = floor || [0, 0, 0];
    put(L.floor, i * 4, f[0], 'floor'); put(L.floor, i * 4 + 1, f[1], 'floor'); put(L.floor, i * 4 + 2, f[2], 'floor'); put(L.floor, i * 4 + 3, floorMode, 'floor');
    put(L.wall, i * 2, wallSlot, 'wall'); put(L.wall, i * 2 + 1, wallKind, 'wall');
    put(L.glow, i * 3, glow[0], 'glow'); put(L.glow, i * 3 + 1, glow[1], 'glow'); put(L.glow, i * 3 + 2, glow[2], 'glow');
    put(L.seen, i, s.seen?.[e.z] != null ? 1 : 0, 'seen');
  });

  return Object.values(ch).some(Boolean) ? ch : null;
}
