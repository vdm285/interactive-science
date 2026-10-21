// The atoms inside the boxes: instanced nuclei, halos, shell rings and electron beads orbiting in the
// vertex shader. Electrons per shell come from the data (e.shells); for Z <= 36 every electron is drawn,
// above that at most 12 beads per shell and the ring carries the count (said in the hover readout).
// Ported from docs/portfolio/vitrina.html; the rings gain aFlash for the shell fly-through, and the
// lenses reach the atom through aAtom (scale, lift, show, dash) on the nucleus and halo, its expansions
// aRing and aBead on the rings and beads, aGlow for the rim and halo color, and aSpin on the beads
// (speed multiplier and a phase offset that keeps the orbit continuous when the speed changes).

import {
  IcosahedronGeometry, PlaneGeometry, InstancedBufferGeometry, InstancedBufferAttribute, InstancedMesh, Mesh,
  Matrix4, ShaderMaterial, AdditiveBlending, DoubleSide, DynamicDrawUsage,
} from 'three';
import { ATOM_Z, DEG, frac, nucleusRadius, shellRadius } from './camera.js';
import { NUCLEUS_V, NUCLEUS_F, ELECTRON_V, ELECTRON_F, HALO_V, HALO_F, RING_V, RING_F } from './shaders.js';

const quad = new PlaneGeometry(2, 2);
function instancedQuad(count) {
  const g = new InstancedBufferGeometry();
  g.setIndex(quad.getIndex()); g.setAttribute('position', quad.getAttribute('position')); g.setAttribute('uv', quad.getAttribute('uv'));
  g.instanceCount = count; return g;
}

export function buildAtoms(scene, els, shared, uniformsWith) {
  const N = els.length;
  const m4 = new Matrix4();
  const addShared = (geo) => {
    geo.setAttribute('aCenter', shared.center); geo.setAttribute('aColor', shared.color); geo.setAttribute('aDim', shared.dim);
    geo.setAttribute('aAtom', shared.atom); geo.setAttribute('aGlow', shared.glow);
  };

  const nucleusMat = new ShaderMaterial({ uniforms: uniformsWith(), vertexShader: NUCLEUS_V, fragmentShader: NUCLEUS_F });
  const nucleusGeo = new IcosahedronGeometry(1, 2); addShared(nucleusGeo);
  const nuclei = new InstancedMesh(nucleusGeo, nucleusMat, N);
  els.forEach((e, i) => { const r = nucleusRadius(e); nuclei.setMatrixAt(i, m4.makeTranslation(e.bx, e.by, ATOM_Z).multiply(new Matrix4().makeScale(r, r, r))); });
  nuclei.frustumCulled = false; scene.add(nuclei);

  // shells from the data; the per-shell arrays are built element by element
  const eC = [], eU = [], eV = [], eOrb = [], eCol = [], eDim = [];
  const rC = [], rU = [], rV = [], rRad = [], rStr = [], rCol = [], rDim = [];
  const ringsOf = els.map(() => []);     // ring indices per element, for the flash and the lenses
  const beadsOf = els.map(() => []);     // [start, count] of electron instances per element
  let electronInstances = 0;
  els.forEach((e, ei) => {
    const K = e.shells.length, h1 = frac(e.z * 0.6180339887), h2 = frac(e.z * 0.7548776662);
    const beadStart = electronInstances;
    for (let k = 0; k < K; k++) {
      const n = e.shells[k];
      const draw = e.z <= 36 ? n : Math.min(12, n);
      const r = shellRadius(K, k);
      const tilt = (k % 2 ? -1 : 1) * Math.min(62, 12 + 11 * k) * DEG;
      const roll = k * 31 * DEG + h1 * Math.PI * 2;
      const Ux = Math.cos(roll), Uy = Math.sin(roll), Uz = 0;
      const Vx = -Math.sin(roll) * Math.cos(tilt), Vy = Math.cos(roll) * Math.cos(tilt), Vz = Math.sin(tilt);
      ringsOf[ei].push({ index: rRad.length, r });
      rC.push(e.bx, e.by, 0); rU.push(Ux, Uy, Uz); rV.push(Vx, Vy, Vz); rRad.push(r); rStr.push(n / 32); rCol.push(...e.rgb); rDim.push(1);
      const speed = (2.1 / Math.pow(k + 1, 0.6)) * (0.85 + 0.3 * h2) * (k % 3 === 2 ? -1 : 1);
      const size = e.z <= 36 ? 0.05 : 0.04;
      for (let i = 0; i < draw; i++) {
        eC.push(e.bx, e.by, 0); eU.push(Ux, Uy, Uz); eV.push(Vx, Vy, Vz);
        eOrb.push(r, (i / draw) * Math.PI * 2 + h2 * 6.283, speed, size); eCol.push(...e.rgb); eDim.push(1);
        electronInstances++;
      }
    }
    beadsOf[ei] = [beadStart, electronInstances - beadStart];
  });

  const R = rRad.length;
  const ringFlash = new InstancedBufferAttribute(new Float32Array(R), 1); ringFlash.setUsage(DynamicDrawUsage);
  const ringDim = new InstancedBufferAttribute(new Float32Array(rDim), 1); ringDim.setUsage(DynamicDrawUsage);
  const ringLens = new Float32Array(R * 4); for (let i = 0; i < R; i++) ringLens.set([1, 0, 1, 0], i * 4);
  const ringAttr = new InstancedBufferAttribute(ringLens, 4); ringAttr.setUsage(DynamicDrawUsage);
  const ringMat = new ShaderMaterial({
    uniforms: uniformsWith(),
    transparent: true, depthWrite: false, blending: AdditiveBlending, premultipliedAlpha: true, side: DoubleSide,
    extensions: { derivatives: true },
    vertexShader: RING_V, fragmentShader: RING_F,
  });
  const ringGeo = instancedQuad(R);
  ringGeo.setAttribute('aCenter', new InstancedBufferAttribute(new Float32Array(rC), 3));
  ringGeo.setAttribute('aColor', new InstancedBufferAttribute(new Float32Array(rCol), 3));
  ringGeo.setAttribute('aDim', ringDim);
  ringGeo.setAttribute('aU', new InstancedBufferAttribute(new Float32Array(rU), 3));
  ringGeo.setAttribute('aV', new InstancedBufferAttribute(new Float32Array(rV), 3));
  ringGeo.setAttribute('aRad', new InstancedBufferAttribute(new Float32Array(rRad), 1));
  ringGeo.setAttribute('aStr', new InstancedBufferAttribute(new Float32Array(rStr), 1));
  ringGeo.setAttribute('aFlash', ringFlash);
  ringGeo.setAttribute('aRing', ringAttr);
  const rings = new Mesh(ringGeo, ringMat); rings.renderOrder = 2; rings.frustumCulled = false; scene.add(rings);

  const E = electronInstances;
  const beadDim = new InstancedBufferAttribute(new Float32Array(eDim), 1); beadDim.setUsage(DynamicDrawUsage);
  const beadLens = new Float32Array(E * 4); for (let i = 0; i < E; i++) beadLens.set([1, 0, 1, 0], i * 4);
  const beadAttr = new InstancedBufferAttribute(beadLens, 4); beadAttr.setUsage(DynamicDrawUsage);
  const spinArr = new Float32Array(E * 2); for (let i = 0; i < E; i++) spinArr[i * 2] = 1;
  const spinAttr = new InstancedBufferAttribute(spinArr, 2); spinAttr.setUsage(DynamicDrawUsage);
  const electronMat = new ShaderMaterial({
    uniforms: uniformsWith(),
    transparent: true, depthWrite: false, blending: AdditiveBlending, premultipliedAlpha: true,
    vertexShader: ELECTRON_V, fragmentShader: ELECTRON_F,
  });
  const electronGeo = instancedQuad(E);
  electronGeo.setAttribute('aCenter', new InstancedBufferAttribute(new Float32Array(eC), 3));
  electronGeo.setAttribute('aColor', new InstancedBufferAttribute(new Float32Array(eCol), 3));
  electronGeo.setAttribute('aDim', beadDim);
  electronGeo.setAttribute('aU', new InstancedBufferAttribute(new Float32Array(eU), 3));
  electronGeo.setAttribute('aV', new InstancedBufferAttribute(new Float32Array(eV), 3));
  electronGeo.setAttribute('aOrb', new InstancedBufferAttribute(new Float32Array(eOrb), 4));
  electronGeo.setAttribute('aBead', beadAttr);
  electronGeo.setAttribute('aSpin', spinAttr);
  const electrons = new Mesh(electronGeo, electronMat); electrons.renderOrder = 3; electrons.frustumCulled = false; scene.add(electrons);

  const haloMat = new ShaderMaterial({
    uniforms: uniformsWith(),
    transparent: true, depthWrite: false, depthTest: false, blending: AdditiveBlending, premultipliedAlpha: true,
    vertexShader: HALO_V, fragmentShader: HALO_F,
  });
  const haloGeo = instancedQuad(N); addShared(haloGeo);
  const sizes = new Float32Array(N); els.forEach((e, i) => { sizes[i] = nucleusRadius(e) * 4.2; });
  haloGeo.setAttribute('aSize', new InstancedBufferAttribute(sizes, 1));
  const halos = new Mesh(haloGeo, haloMat); halos.renderOrder = 4; halos.frustumCulled = false; scene.add(halos);

  /** Copy the per-element dim factors onto the rings and beads (they have their own instance arrays). */
  function syncDim(dim) {
    els.forEach((e, ei) => {
      for (const r of ringsOf[ei]) ringDim.array[r.index] = dim[ei];
      const [start, count] = beadsOf[ei];
      beadDim.array.fill(dim[ei], start, start + count);
    });
    ringDim.needsUpdate = true; beadDim.needsUpdate = true;
  }

  /**
   * Copy the per-element (scale, lift, show, dash) onto the rings and beads. A dashed atom (no radius in
   * the size lens) shows only its outermost ring, dashed, and no beads.
   */
  const scaleOf = new Float32Array(N).fill(1);
  function syncAtom(atom) {
    const ra = ringAttr.array, ba = beadAttr.array;
    els.forEach((e, ei) => {
      const scale = atom[ei * 4], lift = atom[ei * 4 + 1], show = atom[ei * 4 + 2], dash = atom[ei * 4 + 3];
      scaleOf[ei] = scale;
      const rs = ringsOf[ei];
      rs.forEach((r, k) => {
        const outer = k === rs.length - 1;
        ra.set([scale, lift, dash > 0.5 ? (outer ? 1 : 0) : show, dash > 0.5 && outer ? 1 : 0], r.index * 4);
      });
      const [start, count] = beadsOf[ei];
      for (let i = start; i < start + count; i++) ba.set([scale, lift, show, 0], i * 4);
    });
    ringAttr.needsUpdate = true; beadAttr.needsUpdate = true;
  }

  /** Set each element's orbit speed multiplier; the phase offset keeps every bead where it was at `time`. */
  const mult = new Float32Array(N).fill(1), offset = new Float32Array(N);
  function syncSpin(spin, time) {
    const sa = spinAttr.array;
    let changed = false;
    els.forEach((e, ei) => {
      if (spin[ei] === mult[ei]) return;
      offset[ei] += (mult[ei] - spin[ei]) * time;
      mult[ei] = spin[ei];
      const [start, count] = beadsOf[ei];
      for (let i = start; i < start + count; i++) { sa[i * 2] = mult[ei]; sa[i * 2 + 1] = offset[ei]; }
      changed = true;
    });
    if (changed) spinAttr.needsUpdate = true;
  }

  /** Light the rings of element ei by the camera's distance to its atom (0 clears them). */
  function setFlash(ei, fn) {
    const arr = ringFlash.array;
    for (const r of ringsOf[ei]) arr[r.index] = fn ? fn(r.r * scaleOf[ei]) : 0;
    ringFlash.needsUpdate = true;
  }

  return {
    nuclei, rings, electrons, halos, ringsOf, electronInstances, syncDim, syncAtom, syncSpin, setFlash,
    dispose() {
      for (const m of [nucleusMat, ringMat, electronMat, haloMat]) m.dispose();
      nucleusGeo.dispose(); ringGeo.dispose(); electronGeo.dispose(); haloGeo.dispose();
    },
  };
}
