// Geometry of the case, the camera fit with the corner keep-out, the monotone cubic path and the dive
// timeline. Pure math: no three.js objects beyond Vector3-shaped {x, y, z} literals, so it can be read
// and reasoned about without a renderer. Ported from docs/portfolio/vitrina.html; the shell flash
// (each ring lighting up as the camera passes it) is Holograma's.

export const S = 0.92;            // face size of one vitrine (pitch = 1)
export const DEPTH = 0.9;         // depth of the case
export const ATOM_Z = -DEPTH / 2; // where the atom floats
export const COLS = 18;
export const ROWS = 9.4;
export const MARGIN = 10;         // px from the viewport edge
export const KEEP = 56;           // px kept free for the corner controls, the readout and the control pill
export const FOV = 36;
export const DIVE_S = 3.2;        // seconds for the whole dive, on the wall clock
export const DECK_AT = 0.82;      // the moment of the timeline when the deck mounts under the bloom
export const ROW_LIST = [1, 2, 3, 4, 5, 6, 7, 9, 10];
export const DEG = Math.PI / 180;

export const rowPos = (y) => (y <= 7 ? y - 1 : y - 1.6);
export const worldX = (x) => x - 9.5;
export const worldY = (y) => ROWS / 2 - 0.5 - rowPos(y);
export const clamp01 = (v) => Math.max(0, Math.min(1, v));
export const smooth = (v) => { v = clamp01(v); return v * v * (3 - 2 * v); };
export const easeInOut = (v) => { v = clamp01(v); return v < 0.5 ? 4 * v * v * v : 1 - Math.pow(-2 * v + 2, 3) / 2; };
export const frac = (v) => v - Math.floor(v);
export const tanH = (fov = FOV) => Math.tan((fov / 2) * DEG);

/** Nucleus radius in world units, a gentle cube-root ramp with Z (a drawing size, not a measured one). */
export const nucleusRadius = (e) => 0.045 + 0.03 * Math.cbrt(e.z / 118);

/** Ring radius of shell k of K shells. */
export const shellRadius = (K, k) => (K === 1 ? 0.24 : 0.11 + 0.29 * (k / (K - 1)));

/**
 * Fit the whole table into vw x vh keeping the corners free. Option A keeps the top and bottom bands
 * free (the readout and the control pill live there), option B the sides; the bigger tile wins.
 * Returns the base camera and the tile size in pixels.
 */
export function fitTable(vw, vh) {
  const tA = Math.min((vw - 2 * MARGIN) / COLS, (vh - 2 * (MARGIN + KEEP)) / ROWS);
  const tB = Math.min((vw - 2 * (MARGIN + KEEP)) / COLS, (vh - 2 * MARGIN) / ROWS);
  let tilePx, left, top;
  if (tA >= tB) {
    tilePx = tA; left = (vw - COLS * tilePx) / 2;
    top = MARGIN + KEEP + (vh - 2 * (MARGIN + KEEP) - ROWS * tilePx) / 2;
  } else {
    tilePx = tB; top = (vh - ROWS * tilePx) / 2;
    left = MARGIN + KEEP + (vw - 2 * (MARGIN + KEEP) - COLS * tilePx) / 2;
  }
  const cxPx = left + (COLS * tilePx) / 2, cyPx = top + (ROWS * tilePx) / 2;
  const ax = (vw / 2 - cxPx) / tilePx, ay = (cyPx - vh / 2) / tilePx; // grid center is the world origin
  const d = (vh / tilePx / 2) / tanH();
  return { pos: { x: ax, y: ay, z: d }, target: { x: ax, y: ay, z: 0 }, fov: FOV, tilePx, left, top };
}

/** Monotone cubic (Fritsch–Carlson) through (ts, vs); flat at both ends so the camera eases out and in. */
export function monotone(ts, vs) {
  const n = ts.length, d = [], m = new Array(n).fill(0);
  for (let i = 0; i < n - 1; i++) d.push((vs[i + 1] - vs[i]) / (ts[i + 1] - ts[i]));
  for (let i = 1; i < n - 1; i++) {
    if (d[i - 1] * d[i] <= 0) { m[i] = 0; continue; }
    const h0 = ts[i] - ts[i - 1], h1 = ts[i + 1] - ts[i];
    m[i] = (3 * (h0 + h1)) / ((2 * h1 + h0) / d[i - 1] + (h1 + 2 * h0) / d[i]);
  }
  m[0] = 0; m[n - 1] = 0;
  return (t) => {
    if (t <= ts[0]) return vs[0]; if (t >= ts[n - 1]) return vs[n - 1];
    let i = 0; while (t > ts[i + 1]) i++;
    const h = ts[i + 1] - ts[i], s = (t - ts[i]) / h, s2 = s * s, s3 = s2 * s;
    return (2 * s3 - 3 * s2 + 1) * vs[i] + (s3 - 2 * s2 + s) * h * m[i] + (-2 * s3 + 3 * s2) * vs[i + 1] + (s3 - s2) * h * m[i + 1];
  };
}

/**
 * The dive path for element e (with bx, by world coordinates) from the fitted base camera:
 * dolly until the case fills ~60 % of the shorter side (neighbors stay in view), a small drift while the
 * door opens, then the push through the pane into the nucleus.
 */
export function diveKeys(e, base, vw, vh) {
  const aspect = vw / vh;
  const d1 = (S / 0.6 / 2) / (tanH() * Math.min(1, aspect));
  const nr = nucleusRadius(e);
  const ts = [0, 0.36, 0.56, DECK_AT];
  const P = [base.pos, { x: e.bx, y: e.by, z: d1 }, { x: e.bx + 0.08, y: e.by + 0.02, z: d1 * 0.86 }, { x: e.bx, y: e.by, z: ATOM_Z + nr + 0.035 }];
  const T = [base.target, { x: e.bx, y: e.by, z: ATOM_Z * 0.3 }, { x: e.bx, y: e.by, z: ATOM_Z }, { x: e.bx, y: e.by, z: ATOM_Z }];
  const F = [FOV, FOV, FOV + 2, 54];
  const ch = (arr, k) => monotone(ts, arr.map((v) => v[k]));
  return { px: ch(P, 'x'), py: ch(P, 'y'), pz: ch(P, 'z'), tx: ch(T, 'x'), ty: ch(T, 'y'), tz: ch(T, 'z'), fov: monotone(ts, F) };
}

/**
 * Everything the timeline parameter t in [0, 1] decides, besides the camera itself. The veil's dissolve on
 * the way in is not on this timeline: scene.js starts it when the deck has rendered under the veil.
 */
export function diveState(t) {
  const door = easeInOut((t - 0.34) / 0.24);
  const bloom = smooth((t - 0.66) / 0.18);
  return {
    lift: 0.05 * (1 - smooth(t / 0.2)),
    doorAngle: -door * 100 * DEG,
    bloom,
    cardA: 1 - smooth(t / 0.18),
    bloomScale: 0.55 + 0.9 * bloom,
    pushGate: smooth((t - 0.56) / 0.08) * (1 - smooth((t - 0.86) / 0.1)),
  };
}

/** Holograma's fly-through: a ring of radius r lights up as the camera's distance to the atom passes it. */
export function shellFlash(camDist, r, gate) {
  return Math.exp(-Math.pow((camDist - r) / 0.045, 2)) * gate;
}
