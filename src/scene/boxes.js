// The glass vitrines: instanced bodies (five faces, front open), doors on a left hinge, the etched
// symbol/number labels from one canvas atlas, the eight edges per case, and the back-wall atlas that
// holds the photographs (fotos) and, below them, the emission strips (luz). Two atlases in all.
// Ported from docs/portfolio/vitrina.html.

import {
  BoxGeometry, PlaneGeometry, BufferGeometry, BufferAttribute, InstancedBufferAttribute, InstancedMesh,
  LineSegments, Matrix4, ShaderMaterial, CanvasTexture, Vector2, Vector4, DoubleSide, DynamicDrawUsage,
  LinearMipmapLinearFilter, LinearFilter, SRGBColorSpace,
} from 'three';
import { S, DEPTH } from './camera.js';
import { ATLAS_COLS, ATLAS_ROWS, WALL_PX, STRIP_PX, BODY_V, BODY_F, DOOR_V, DOOR_F, LABEL_V, LABEL_F, EDGE_V, EDGE_F } from './shaders.js';

const LABEL = 0.40;

function bodyGeometry() {
  const box = new BoxGeometry(S, S, DEPTH);
  box.translate(0, 0, -DEPTH / 2);
  const idx = box.getIndex().array, nrm = box.getAttribute('normal');
  const keep = [];
  for (let i = 0; i < idx.length; i += 3) {
    const a = idx[i], b = idx[i + 1], c = idx[i + 2];
    if (nrm.getZ(a) > 0.5 && nrm.getZ(b) > 0.5 && nrm.getZ(c) > 0.5) continue; // drop the front face
    keep.push(a, b, c);
  }
  box.setIndex(keep);
  box.clearGroups();
  return box;
}

/**
 * Build the cases for `els` (each with bx, by, rgb, z, symbol). `shared` holds the per-instance
 * attributes (aCenter, aColor, aDim, aFrost, aFloor, aWall; see shaders.js) and `uniformsWith` builds
 * a material's uniforms from the shared set. Returns the meshes and the per-element setters.
 */
export function buildBoxes(scene, els, shared, uniformsWith, renderer) {
  const N = els.length;
  const m4 = new Matrix4();
  const addShared = (geo) => {
    geo.setAttribute('aCenter', shared.center);
    geo.setAttribute('aColor', shared.color);
    geo.setAttribute('aDim', shared.dim);
  };

  // the back-wall atlas: 12 x 10 photo cells of 160 px, then 12 x 10 strip cells of 16 px for the spectra
  const PHOTO_H = ATLAS_ROWS * WALL_PX, STRIP_Y0 = PHOTO_H, WALL_H = PHOTO_H + ATLAS_ROWS * STRIP_PX;
  const wallCanvas = document.createElement('canvas');
  wallCanvas.width = ATLAS_COLS * WALL_PX; wallCanvas.height = WALL_H;
  const wallCtx = wallCanvas.getContext('2d');
  wallCtx.fillStyle = '#101216'; wallCtx.fillRect(0, 0, wallCanvas.width, PHOTO_H);
  wallCtx.fillStyle = '#000000'; wallCtx.fillRect(0, STRIP_Y0, wallCanvas.width, WALL_H - STRIP_Y0);
  const wallTex = new CanvasTexture(wallCanvas);
  wallTex.colorSpace = SRGBColorSpace;
  wallTex.minFilter = LinearMipmapLinearFilter; wallTex.magFilter = LinearFilter;
  wallTex.anisotropy = Math.min(4, renderer.capabilities.getMaxAnisotropy());
  const wallLoaded = new Set(), stripDrawn = new Set();
  let wallDirty = false;
  const cellX = (i) => (i % ATLAS_COLS) * WALL_PX, cellY = (i) => Math.floor(i / ATLAS_COLS);
  function loadWall(i, url) {
    if (wallLoaded.has(i)) return;
    wallLoaded.add(i);
    const img = new Image();
    img.decoding = 'async';
    img.onload = () => {
      wallCtx.drawImage(img, cellX(i), cellY(i) * WALL_PX, WALL_PX, WALL_PX);
      wallDirty = true;
    };
    img.onerror = () => wallLoaded.delete(i);
    img.src = url;
  }
  /** Draw an element's emission strip (a bins x 1 canvas from src/draw/spectrum.js) into its strip cell. */
  function drawStrip(i, strip) {
    if (stripDrawn.has(i) || !strip) return;
    stripDrawn.add(i);
    wallCtx.drawImage(strip, cellX(i), STRIP_Y0 + cellY(i) * STRIP_PX + 2, WALL_PX, STRIP_PX - 4);
    wallDirty = true;
  }
  function flushWall() {
    if (!wallDirty) return false;
    wallDirty = false; wallTex.needsUpdate = true; return true;
  }

  const bodyMat = new ShaderMaterial({
    uniforms: uniformsWith({
      uWallTex: { value: wallTex },
      uWallGrid: { value: new Vector2(ATLAS_COLS, ATLAS_ROWS) },
      uWallUV: { value: new Vector4(1 / ATLAS_COLS, WALL_PX / WALL_H, STRIP_Y0 / WALL_H, STRIP_PX / WALL_H) },
      uS: { value: S },
    }),
    transparent: true, depthWrite: false, side: DoubleSide,
    vertexShader: BODY_V, fragmentShader: BODY_F,
  });
  const bodyGeo = bodyGeometry(); addShared(bodyGeo);
  bodyGeo.setAttribute('aWall', shared.wall);
  bodyGeo.setAttribute('aFloor', shared.floor);
  bodyGeo.setAttribute('aFrost', shared.frost);
  const bodies = new InstancedMesh(bodyGeo, bodyMat, N);
  els.forEach((e, i) => bodies.setMatrixAt(i, m4.makeTranslation(e.bx, e.by, 0)));
  bodies.renderOrder = 1; bodies.frustumCulled = false; scene.add(bodies);

  const doorMat = new ShaderMaterial({
    uniforms: uniformsWith(),
    transparent: true, depthWrite: false, side: DoubleSide, premultipliedAlpha: true,
    extensions: { derivatives: true },
    vertexShader: DOOR_V, fragmentShader: DOOR_F,
  });
  const doorGeo = new PlaneGeometry(S, S); addShared(doorGeo);
  doorGeo.setAttribute('aFrost', shared.frost);
  doorGeo.setAttribute('aSeen', shared.seen);
  const doors = new InstancedMesh(doorGeo, doorMat, N);
  doors.instanceMatrix.setUsage(DynamicDrawUsage);
  doors.renderOrder = 6; doors.frustumCulled = false; scene.add(doors);

  // the symbol and the number etched on the glass: one atlas, redrawn once the web fonts are in
  const CELL = 128;
  const atlasCanvas = document.createElement('canvas');
  atlasCanvas.width = ATLAS_COLS * CELL; atlasCanvas.height = ATLAS_ROWS * CELL;
  const atlasTex = new CanvasTexture(atlasCanvas);
  atlasTex.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
  atlasTex.minFilter = LinearMipmapLinearFilter;
  function drawAtlas() {
    const ctx = atlasCanvas.getContext('2d');
    ctx.clearRect(0, 0, atlasCanvas.width, atlasCanvas.height);
    ctx.fillStyle = '#ffffff';
    els.forEach((e, i) => {
      const cx = (i % ATLAS_COLS) * CELL, cy = Math.floor(i / ATLAS_COLS) * CELL;
      ctx.globalAlpha = 0.7; ctx.font = '400 22px Outfit, "Segoe UI", system-ui, sans-serif'; ctx.textBaseline = 'top';
      ctx.fillText(String(e.z), cx + 12, cy + 12);
      ctx.globalAlpha = 1; ctx.font = '600 62px Fraunces, "Iowan Old Style", Georgia, serif'; ctx.textBaseline = 'alphabetic';
      ctx.fillText(e.symbol, cx + 10, cy + CELL - 22);
    });
    atlasTex.needsUpdate = true;
  }
  drawAtlas();
  if (document.fonts?.ready) document.fonts.ready.then(drawAtlas);

  const labelMat = new ShaderMaterial({
    uniforms: uniformsWith({ uAtlas: { value: atlasTex }, uCell: { value: new Vector2(1 / ATLAS_COLS, 1 / ATLAS_ROWS) } }),
    transparent: true, depthWrite: false, premultipliedAlpha: true,
    vertexShader: LABEL_V, fragmentShader: LABEL_F,
  });
  const labelGeo = new PlaneGeometry(1, 1); addShared(labelGeo);
  const cells = new Float32Array(N * 2);
  els.forEach((e, i) => { cells[i * 2] = (i % ATLAS_COLS) / ATLAS_COLS; cells[i * 2 + 1] = 1 - (Math.floor(i / ATLAS_COLS) + 1) / ATLAS_ROWS; });
  labelGeo.setAttribute('aCell', new InstancedBufferAttribute(cells, 2));
  const labels = new InstancedMesh(labelGeo, labelMat, N);
  labels.instanceMatrix.setUsage(DynamicDrawUsage);
  labels.renderOrder = 5; labels.frustumCulled = false; scene.add(labels);
  const labelLocal = new Matrix4().makeTranslation(-S / 2 + 0.03 + LABEL / 2, -S / 2 + 0.03 + LABEL / 2, 0.006).multiply(new Matrix4().makeScale(LABEL, LABEL, 1));

  const doorPose = new Float32Array(N);
  function setDoorPose(i, angle) {
    // hinge on the left edge of the pane; angle 0 closed, negative opens outward (toward the viewer)
    const e = els[i];
    const door = new Matrix4().makeTranslation(e.bx - S / 2, e.by, 0)
      .multiply(new Matrix4().makeRotationY(angle))
      .multiply(new Matrix4().makeTranslation(S / 2, 0, 0));
    doors.setMatrixAt(i, door);
    labels.setMatrixAt(i, door.clone().multiply(labelLocal));
    doors.instanceMatrix.needsUpdate = true; labels.instanceMatrix.needsUpdate = true;
    doorPose[i] = angle;
  }
  els.forEach((e, i) => setDoorPose(i, 0));

  // edges: 8 per case, as line segments
  {
    const pos = new Float32Array(N * 16 * 3), ec = new Float32Array(N * 16 * 3), ecol = new Float32Array(N * 16 * 3), edim = new Float32Array(N * 16).fill(1);
    let k = 0;
    const put = (e, x, y, z) => { pos.set([x, y, z], k * 3); ec.set([e.bx, e.by, 0], k * 3); ecol.set([e.rgb[0] * 0.5 + 0.45, e.rgb[1] * 0.5 + 0.48, e.rgb[2] * 0.5 + 0.52], k * 3); k++; };
    for (const e of els) {
      const h = S / 2, x0 = e.bx - h, x1 = e.bx + h, y0 = e.by - h, y1 = e.by + h, z = -DEPTH;
      put(e, x0, y0, z); put(e, x1, y0, z); put(e, x1, y0, z); put(e, x1, y1, z);
      put(e, x1, y1, z); put(e, x0, y1, z); put(e, x0, y1, z); put(e, x0, y0, z);
      put(e, x0, y0, 0); put(e, x0, y0, z); put(e, x1, y0, 0); put(e, x1, y0, z);
      put(e, x1, y1, 0); put(e, x1, y1, z); put(e, x0, y1, 0); put(e, x0, y1, z);
    }
    const g = new BufferGeometry();
    g.setAttribute('position', new BufferAttribute(pos, 3));
    g.setAttribute('aCenter', new BufferAttribute(ec, 3));
    g.setAttribute('aColor', new BufferAttribute(ecol, 3));
    const edgeDim = new BufferAttribute(edim, 1); edgeDim.setUsage(DynamicDrawUsage);
    g.setAttribute('aDim', edgeDim);
    const edgeMat = new ShaderMaterial({ uniforms: uniformsWith(), transparent: true, depthWrite: false, premultipliedAlpha: true, vertexShader: EDGE_V, fragmentShader: EDGE_F });
    const lines = new LineSegments(g, edgeMat);
    lines.renderOrder = 1; lines.frustumCulled = false; scene.add(lines);
    shared.edgeDim = edgeDim;
  }

  return {
    bodies, doors, labels, setDoorPose, doorPose, loadWall, drawStrip, flushWall,
    dispose() {
      for (const m of [bodyMat, doorMat, labelMat]) m.dispose();
      bodyGeo.dispose(); doorGeo.dispose(); labelGeo.dispose(); atlasTex.dispose(); wallTex.dispose();
    },
  };
}
