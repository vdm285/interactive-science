// The glass-box table as a three.js scene: one renderer on a canvas inside the host, the camera fit,
// the render loop (paused when the tab is hidden or the deck covers it), picking, hover and the dive.
// Everything animates in the vertex shaders; the JS per frame is a handful of uniforms. This is the only
// folder that imports three; the app talks to it through mountScene's api and the returned handle.

import { WebGLRenderer, Scene, PerspectiveCamera, Vector3, InstancedBufferAttribute, DynamicDrawUsage } from 'three';
import {
  S, ATOM_Z, DIVE_S, DECK_AT, FOV, ROW_LIST, worldX, worldY, clamp01, smooth, fitTable, diveKeys, diveState, shellFlash, tanH,
} from './camera.js';
import { buildBoxes } from './boxes.js';
import { buildAtoms } from './atoms.js';
import { applyLens, makeLensState, WALL_PHOTO, WALL_SPECTRUM } from './lenses3d.js';
import { FAMILY_COLOR } from '../table/lenses.js';
import { tileUrl, spectrumOf } from '../data/load.js';
import { stripCanvas } from '../draw/spectrum.js';

function hexRgb(hex) {
  const n = parseInt(hex.slice(1), 16);
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
}

/**
 * Mount the scene into `host` (a fixed, full-viewport element). `api`:
 *   elements            the table rows (z, symbol, x, y, shells, family)
 *   onProject(z, x, y, tilePx)   each frame while an element is selected: the screen point under its box
 *   onStats(stats)      once a second: { fps, jsMs, calls, triangles, electrons }
 *   onSlow()            when the frame rate stayed under 20 fps for six seconds
 *   onLost()            when the WebGL context was lost and not restored within three seconds
 */
export function mountScene(host, api) {
  const els = api.elements.map((e) => ({ ...e, bx: worldX(e.x), by: worldY(e.y), rgb: hexRgb(FAMILY_COLOR[e.family] || FAMILY_COLOR.unknown) }));
  const N = els.length;
  const byPos = new Map(); els.forEach((e, i) => byPos.set(e.x * 100 + e.y, i));
  const indexOfZ = new Map(); els.forEach((e, i) => indexOfZ.set(e.z, i));

  const canvas = document.createElement('canvas');
  const vignette = document.createElement('div'); vignette.className = 'vignette';
  const bloomEl = document.createElement('div'); bloomEl.className = 'bloom';
  host.append(canvas, vignette, bloomEl);

  const renderer = new WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(1.5, window.devicePixelRatio || 1));
  renderer.setClearColor(0x000000, 0);
  const scene = new Scene();
  const camera = new PerspectiveCamera(FOV, 1, 0.02, 120);
  let vw = 1, vh = 1, tilePx = 100;

  // shared uniforms: one object per uniform, referenced by every material
  const U = {
    uTime: { value: 0 },
    uSel: { value: new Vector3(999, 999, 999) },
    uSelAmt: { value: 0 },
    uHover: { value: new Vector3(999, 999, 999) },
    uHoverAmt: { value: 0 },
    uLift: { value: 0.05 },
    uBloom: { value: 0 },
    uPx: { value: 0.001 },
    uLight: { value: new Vector3(0.15, 0.85, 0.5).normalize() },
    uLight2: { value: new Vector3(-0.75, 0.35, 0.56).normalize() },
  };
  const uniformsWith = (own) => Object.assign({}, U, own || {});

  // shared per-instance attributes: the fixed ones (center, family color) and the lens arrays (lenses3d.js)
  const centers = new Float32Array(N * 3), colors = new Float32Array(N * 3);
  els.forEach((e, i) => { centers.set([e.bx, e.by, 0], i * 3); colors.set(e.rgb, i * 3); });
  const L = makeLensState(N);
  els.forEach((e, i) => L.glow.set(e.rgb, i * 3));
  const dyn = (arr, size) => { const a = new InstancedBufferAttribute(arr, size); a.setUsage(DynamicDrawUsage); return a; };
  const shared = {
    center: new InstancedBufferAttribute(centers, 3), color: new InstancedBufferAttribute(colors, 3),
    dim: dyn(L.dim, 1), atom: dyn(L.atom, 4), glow: dyn(L.glow, 3), frost: dyn(L.frost, 1), floor: dyn(L.floor, 4), wall: dyn(L.wall, 2),
    seen: dyn(L.seen, 1),
  };

  const boxes = buildBoxes(scene, els, shared, uniformsWith, renderer);
  const atoms = buildAtoms(scene, els, shared, uniformsWith);

  // ---- camera ----
  let base = fitTable(1, 1);
  const camPos = new Vector3(), camTgt = new Vector3();
  function applyCamera(pos, target, fov) {
    camera.position.set(pos.x, pos.y, pos.z); camera.lookAt(target.x, target.y, target.z);
    if (Math.abs(camera.fov - fov) > 1e-4) camera.fov = fov;
    camera.updateProjectionMatrix();
    U.uPx.value = (2 * tanH(camera.fov)) / vh;
  }
  function fit() {
    vw = window.innerWidth; vh = window.innerHeight;
    renderer.setSize(vw, vh, false);
    camera.aspect = vw / vh;
    base = fitTable(vw, vh);
    tilePx = base.tilePx;
    if (dive.ei >= 0) dive.keys = diveKeys(els[dive.ei], base, vw, vh);
    if (!dive.dir) applyCamera(base.pos, base.target, base.fov);
  }

  // ---- picking (straight-on view: a ray to the z = 0 plane, then the grid) ----
  const tmpV = new Vector3();
  function worldAt(px, py) {
    tmpV.set((px / vw) * 2 - 1, -((py / vh) * 2 - 1), 0.5).unproject(camera);
    const o = camera.position, dx = tmpV.x - o.x, dy = tmpV.y - o.y, dz = tmpV.z - o.z;
    if (Math.abs(dz) < 1e-6) return null;
    const t = -o.z / dz; if (t < 0) return null;
    return [o.x + dx * t, o.y + dy * t];
  }
  function pick(px, py) {
    const w = worldAt(px, py); if (!w) return null;
    const x = Math.round(w[0] + 9.5); if (x < 1 || x > 18 || Math.abs(w[0] - worldX(x)) > S / 2) return null;
    for (const y of ROW_LIST) if (Math.abs(w[1] - worldY(y)) <= S / 2) { const i = byPos.get(x * 100 + y); return i == null ? null : els[i].z; }
    return null;
  }
  function project(i, dy, dz) {
    const e = els[i];
    tmpV.set(e.bx, e.by + dy, dz).project(camera);
    return [((tmpV.x + 1) / 2) * vw, ((1 - tmpV.y) / 2) * vh];
  }

  // ---- hover and selection ----
  let hoverI = -1, hoverAmt = 0, selI = -1, selAmt = 0;
  function setHoverIdx(i) {
    if (i === hoverI) return;
    hoverI = i;
    if (i >= 0) { U.uHover.value.set(els[i].bx, els[i].by, 0); hoverAmt = Math.min(hoverAmt, 0.35); }
  }
  function setSelIdx(i) {
    if (i === selI) return;
    selI = i;
    if (i >= 0) { U.uSel.value.set(els[i].bx, els[i].by, 0); selAmt = Math.min(selAmt, 0.4); }
  }

  // ---- the dive: one timeline parameter on the wall clock, forward to enter, backward to return ----
  // mounted: onMount was called; deckReady: the deck has rendered under the veil (setCovered); mountedAt:
  // the first frame drawn after that, when the dissolve clock starts (a frame the loop missed while the deck
  // rendered must not count); now: the frame clock applyDive reads. The memo `last` skips redundant uploads
  // and is reset whenever the element or the direction changes (a surface from another element than the dive's).
  const VEIL_MS = 500, MOUNT_WAIT_MS = 1500;
  const dive = { t: 0, dir: 0, ei: -1, keys: null, t0: 0, tStart: 0, cb: null, mounted: false, deckReady: false, mountCalledAt: 0, mountedAt: 0, now: 0 };
  const last = { bloom: -1, door: 999 };
  let surfaceTimer = 0;
  const veilGone = () => dive.mountedAt > 0 && dive.now - dive.mountedAt >= VEIL_MS;
  function applyDive(t) {
    const k = dive.keys, ei = dive.ei; if (!k || ei < 0) return;
    camPos.set(k.px(t), k.py(t), k.pz(t)); camTgt.set(k.tx(t), k.ty(t), k.tz(t));
    applyCamera(camPos, camTgt, k.fov(t));
    const st = diveState(t);
    U.uLift.value = st.lift;
    U.uBloom.value = st.bloom;
    if (st.doorAngle !== last.door) { boxes.setDoorPose(ei, st.doorAngle); last.door = st.doorAngle; }
    // the shells flash one by one as the camera passes them (Holograma)
    const camDist = Math.abs(camPos.z - ATOM_Z);
    atoms.setFlash(ei, st.pushGate > 0.001 ? (r) => shellFlash(camDist, r, st.pushGate) * 1.2 + 0.15 * st.pushGate : null);
    // the veil: on the way in it holds at full until the deck has rendered under it (setCovered) and then
    // dissolves over VEIL_MS from that moment, so a slow mount never shows the deck popping in under a
    // half-dissolved veil; on the way out it holds until the camera is back among the shells
    const bloomA = dive.dir < 0 || !dive.mountedAt ? st.bloom : st.bloom * (1 - smooth((dive.now - dive.mountedAt) / VEIL_MS));
    if (bloomA !== last.bloom) { bloomEl.style.opacity = bloomA; bloomEl.style.transform = `scale(${st.bloomScale})`; last.bloom = bloomA; }
  }
  function startDive(z, cb) {
    const ei = indexOfZ.get(z);
    if (ei == null || dive.dir || surfaceTimer) return false;
    if (dive.ei >= 0 && dive.ei !== ei) { boxes.setDoorPose(dive.ei, 0); atoms.setFlash(dive.ei, null); }
    setHoverIdx(-1); setSelIdx(ei);
    dive.ei = ei; dive.keys = diveKeys(els[ei], base, vw, vh); dive.cb = cb; dive.mounted = false; dive.deckReady = false; dive.mountCalledAt = 0; dive.mountedAt = 0;
    dive.t = 0; dive.tStart = 0; dive.dir = 1; dive.t0 = dive.now = performance.now();
    last.door = 999; last.bloom = -1;
    startLoop();
    return true;
  }
  function finishDive() {
    dive.dir = 0; dive.t = 1;
    bloomEl.style.opacity = '0'; last.bloom = 0;
    const cb = dive.cb; dive.cb = null;
    cb?.onDone?.();
    if (covered) stopLoop();
  }
  function startSurface(z, cb) {
    const ei = indexOfZ.get(z);
    if (ei == null || dive.dir || surfaceTimer) return false;
    // the deck may have moved to another element since the dive: close that door and leave its shells dark
    if (dive.ei >= 0 && dive.ei !== ei) { boxes.setDoorPose(dive.ei, 0); atoms.setFlash(dive.ei, null); }
    setHoverIdx(-1); setSelIdx(ei);
    dive.ei = ei; dive.keys = diveKeys(els[ei], base, vw, vh); dive.cb = cb;
    last.door = 999;   // the memo was left at the open angle by the dive; this element's door must be posed again
    // the hero dims into the veil over half a second, then the deck goes and the timeline runs backward
    bloomEl.style.transition = 'opacity 0.5s ease-in, transform 0.5s';
    bloomEl.style.transform = 'scale(1.45)';
    bloomEl.style.opacity = '1';
    last.bloom = 1;
    surfaceTimer = setTimeout(() => {
      surfaceTimer = 0;
      bloomEl.style.transition = '';
      dive.t = 1; dive.tStart = 1; dive.dir = -1; dive.t0 = dive.now = performance.now();
      applyDive(1);
      cb?.onUnmount?.();
      startLoop();
    }, VEIL_MS);
    return true;
  }
  /** Settle whatever transition is pending (destroy): the app's promise must resolve and the deck must open or close. */
  function settle() {
    if (surfaceTimer) {
      clearTimeout(surfaceTimer); surfaceTimer = 0;
      bloomEl.style.transition = '';
      const cb = dive.cb; dive.cb = null;
      cb?.onUnmount?.(); cb?.onDone?.();
      return;
    }
    if (!dive.dir) return;
    const cb = dive.cb; dive.cb = null;
    if (dive.dir > 0 && !dive.mounted) { dive.mounted = true; cb?.onMount?.(); }
    dive.dir = 0;
    cb?.onDone?.();
  }
  function finishReturn() {
    dive.dir = 0; dive.t = 0;
    applyCamera(base.pos, base.target, base.fov);
    bloomEl.style.opacity = '0'; last.bloom = 0;
    U.uBloom.value = 0; U.uLift.value = 0.05;
    if (dive.ei >= 0) { boxes.setDoorPose(dive.ei, 0); atoms.setFlash(dive.ei, null); }
    last.door = 999;
    const cb = dive.cb; dive.cb = null;
    cb?.onDone?.();
  }

  // ---- lenses: the state becomes per-instance attributes; only the arrays that changed are uploaded ----
  function setLens(s) {
    const ch = applyLens(s, els, L);
    if (!ch) return;
    if (ch.dim) {
      shared.dim.needsUpdate = true;
      atoms.syncDim(L.dim);
      const ed = shared.edgeDim.array; for (let i = 0; i < N; i++) ed.fill(L.dim[i], i * 16, i * 16 + 16); shared.edgeDim.needsUpdate = true;
    }
    if (ch.atom) { shared.atom.needsUpdate = true; atoms.syncAtom(L.atom); }
    if (ch.spin) atoms.syncSpin(L.spin, time);
    if (ch.glow) shared.glow.needsUpdate = true;
    if (ch.frost) shared.frost.needsUpdate = true;
    if (ch.floor) shared.floor.needsUpdate = true;
    if (ch.seen) shared.seen.needsUpdate = true;
    if (ch.wall) {
      shared.wall.needsUpdate = true;
      for (let i = 0; i < N; i++) {
        const kind = L.wall[i * 2 + 1];
        if (kind === WALL_PHOTO) boxes.loadWall(i, tileUrl(els[i].z));
        else if (kind === WALL_SPECTRUM) boxes.drawStrip(i, stripCanvas(els[i].z, spectrumOf(els[i].z)?.bins));
      }
    }
  }

  // ---- loop ----
  let raf = 0, running = false, covered = false, lastNow = 0, time = 0, intro = 0;
  const stats = { fps: 0, jsMs: 0, calls: 0, triangles: 0, electrons: atoms.electronInstances, acc: 0, n: 0, wall: 0, slowFor: 0, age: 0 };
  const shouldRun = () => !document.hidden && !(covered && dive.dir === 0);
  function startLoop() { if (running || !shouldRun()) return; running = true; lastNow = performance.now(); raf = requestAnimationFrame(frame); }
  function stopLoop() { running = false; if (raf) cancelAnimationFrame(raf); raf = 0; }
  function frame(now) {
    if (!running) return;
    raf = requestAnimationFrame(frame);
    const t0 = performance.now();
    let dt = (now - lastNow) / 1000; lastNow = now;
    if (!(dt > 0) || dt > 0.1) dt = 0.016;
    time += dt; U.uTime.value = time;
    hoverAmt += ((hoverI >= 0 ? 1 : 0) - hoverAmt) * Math.min(1, dt * 14); U.uHoverAmt.value = hoverAmt;
    selAmt += ((selI >= 0 ? 1 : 0) - selAmt) * Math.min(1, dt * 10); U.uSelAmt.value = selAmt;
    if (dive.dir) {
      dive.now = now;
      dive.t = clamp01(dive.tStart + (dive.dir * (now - dive.t0)) / 1000 / DIVE_S);
      // the dissolve clock starts on the first frame after the deck rendered; a deck that never reports
      // itself rendered (no route change) must not hold the veil forever
      if (dive.dir > 0 && dive.mounted && !dive.mountedAt && (dive.deckReady || now - dive.mountCalledAt >= MOUNT_WAIT_MS)) dive.mountedAt = now;
      applyDive(dive.t);
      if (dive.dir > 0 && !dive.mounted && dive.t >= DECK_AT) { dive.mounted = true; dive.mountCalledAt = now; dive.cb?.onMount?.(); }
      if (dive.dir > 0 && dive.t >= 1 && veilGone()) finishDive();
      else if (dive.dir < 0 && dive.t <= 0) finishReturn();
    } else if (intro < 1) {
      intro = Math.min(1, intro + dt / 1.6);
      const k = 1 - Math.pow(1 - intro, 3);
      camPos.set(base.pos.x, base.pos.y, base.pos.z * (1 + 0.1 * (1 - k)));
      applyCamera(camPos, base.target, base.fov);
    }
    if (selI >= 0 && !dive.dir && api.onProject) { const [sx, sy] = project(selI, -S / 2, 0.02); api.onProject(els[selI].z, sx, sy, tilePx); }
    boxes.flushWall();
    renderer.render(scene, camera);
    // frame cost: CPU time of this frame; GPU time is not observable from JS
    const cost = performance.now() - t0;
    stats.acc += cost; stats.n++; stats.wall += dt;
    if (stats.wall >= 1) {
      stats.fps = stats.n / stats.wall; stats.jsMs = stats.acc / stats.n;
      stats.calls = renderer.info.render.calls; stats.triangles = renderer.info.render.triangles;
      stats.age += stats.wall;
      // Automática drops to the simple mode when the rate stays under 20 fps for six seconds (after a 2 s warm-up)
      if (stats.age > 2 && stats.fps < 20) { stats.slowFor += stats.wall; if (stats.slowFor >= 6) { stats.slowFor = 0; api.onSlow?.(); } } else stats.slowFor = 0;
      stats.acc = 0; stats.n = 0; stats.wall = 0;
      api.onStats?.({ fps: stats.fps, jsMs: stats.jsMs, calls: stats.calls, triangles: stats.triangles, electrons: stats.electrons });
    }
  }
  const onVisibility = () => { if (document.hidden) stopLoop(); else startLoop(); };
  const onResize = () => fit();
  document.addEventListener('visibilitychange', onVisibility);
  window.addEventListener('resize', onResize);
  // context loss: stop rendering; a restore within three seconds resumes, otherwise the app falls back to the simple mode
  let lostTimer = 0;
  const onLost = (ev) => {
    ev.preventDefault();
    stopLoop();
    clearTimeout(lostTimer);
    lostTimer = setTimeout(() => { lostTimer = 0; api.onLost?.(); }, 3000);
  };
  const onRestored = () => { clearTimeout(lostTimer); lostTimer = 0; startLoop(); };
  canvas.addEventListener('webglcontextlost', onLost, false);
  canvas.addEventListener('webglcontextrestored', onRestored, false);

  fit();
  applyCamera(base.pos, base.target, base.fov);
  startLoop();
  requestAnimationFrame(() => canvas.classList.add('in'));

  return {
    pick,
    setHover(z) { if (dive.dir) return; setHoverIdx(z == null ? -1 : (indexOfZ.get(z) ?? -1)); },
    setSelection(z) { if (dive.dir) return; setSelIdx(z == null ? -1 : (indexOfZ.get(z) ?? -1)); },
    setLens,
    setCovered(v) {
      covered = !!v;
      // the deck has rendered under the veil: the dissolve starts on the next frame
      if (covered && dive.dir > 0 && dive.mounted) dive.deckReady = true;
      if (shouldRun()) startLoop(); else stopLoop();
    },
    dive: startDive,
    surface: startSurface,
    get diving() { return dive.dir !== 0 || surfaceTimer !== 0; },
    get lens() { return L; },
    stats,
    // dev only (the build strips it): the dive record, the door poses and the memo, for checks from the console
    ...(import.meta.env.DEV ? { debug: { dive, last, doorPose: boxes.doorPose } } : {}),
    destroy() {
      stopLoop();
      settle();
      clearTimeout(lostTimer);
      canvas.removeEventListener('webglcontextlost', onLost);
      canvas.removeEventListener('webglcontextrestored', onRestored);
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('resize', onResize);
      boxes.dispose(); atoms.dispose();
      renderer.dispose();
      canvas.remove(); vignette.remove(); bloomEl.remove();
    },
  };
}
