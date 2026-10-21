// All the GLSL of the glass-box table, ported from docs/portfolio/vitrina.html. Every material shares
// the uniforms in scene.js (selection, hover, lift, bloom, time) and the per-instance attributes the
// lenses write (src/scene/lenses3d.js), one value per element, uploaded only when a lens changes:
//   aDim    0 dims the box's light to 15 %, 1 is full (familias isolation, historia unknown)
//   aWall   (slot, kind) of the back wall: kind 1 the photograph in the atlas, 2 the emission strip, 0 dark
//   aFloor  (r, g, b, mode) of the floor: mode 1 a wash in that color (estado, datos), 2 hatched (no value)
//   aFrost  frost on the glass (estado solid)
//   aAtom   (scale, lift, show, dash) of the atom (tamano scale, estado gas lift, historia hidden, no-radius ring)
//   aGlow   the color of the nucleus rim and halo (family, or the spectrum's dominant color in luz)
//   aSeen   1 when the element was opened in this browser: the gold dot in the door's top-right corner (the tiles' .seen)
// Rings and beads carry their own expansions of aAtom (aRing, aBead) and the beads aSpin (speed, phase).

export const ATLAS_COLS = 12;
export const ATLAS_ROWS = 10;
export const WALL_PX = 160;   // one photo cell of the back-wall atlas
export const STRIP_PX = 16;   // one emission-strip cell, below the photos in the same atlas

export const COMMON_V = /* glsl */ `
uniform vec3 uSel; uniform float uSelAmt; uniform vec3 uHover; uniform float uHoverAmt;
uniform float uLift; uniform float uTime; uniform float uBloom; uniform float uPx;
attribute vec3 aCenter; attribute vec3 aColor; attribute float aDim;
float isAt(vec3 c, vec3 p) { return 1.0 - step(0.02, distance(c, p)); }
float dimOf() { return mix(0.15, 1.0, aDim); }
`;

export const BILLBOARD_V = COMMON_V + /* glsl */ `
vec3 camRight() { return vec3(viewMatrix[0][0], viewMatrix[1][0], viewMatrix[2][0]); }
vec3 camUp() { return vec3(viewMatrix[0][1], viewMatrix[1][1], viewMatrix[2][1]); }
`;

// ---- glass body: five faces, front open; the back wall carries a photograph or the spectrum, the floor a wash ----
export const BODY_V = COMMON_V + /* glsl */ `
attribute vec2 aWall; attribute vec4 aFloor; attribute float aFrost;
varying vec3 vN, vW, vL, vColor; varying vec4 vF, vFloor; varying vec2 vWall;
void main() {
  vF = vec4(uSelAmt * isAt(aCenter, uSel), uHoverAmt * isAt(aCenter, uHover), dimOf(), aFrost);
  vL = position; vColor = aColor; vN = normal; vWall = aWall; vFloor = aFloor;
  vec4 w = instanceMatrix * vec4(position, 1.0); w.z += uLift * vF.x; vW = w.xyz;
  gl_Position = projectionMatrix * viewMatrix * w;
}`;

export const BODY_F = /* glsl */ `
precision highp float;
uniform sampler2D uWallTex; uniform vec2 uWallGrid; uniform vec4 uWallUV; uniform float uS;
varying vec3 vN, vW, vL, vColor; varying vec4 vF, vFloor; varying vec2 vWall;
void main() {
  float vSel = vF.x, vHov = vF.y, vDim = vF.z, vFrost = vF.w;
  vec3 v = normalize(cameraPosition - vW); vec3 n = normalize(vN);
  float f = pow(1.0 - abs(dot(n, v)), 2.5);
  vec3 glass = mix(vec3(0.70, 0.80, 0.92), vColor, 0.22);
  vec3 col; float a;
  if (n.y < -0.5) {
    // the plinth: dark floor with the atom's warm reflection; the lenses wash it or hatch it
    vec2 q = vec2(vL.x, vL.z + 0.45); float d = length(q) / 0.42; float glow = exp(-d * d * 3.4);
    vec3 warm = mix(vec3(1.0, 0.78, 0.50), vColor, 0.55);
    float lit = (0.34 + 0.30 * vHov + 0.45 * vSel) * vDim;
    if (vFloor.w > 1.5) {
      float hatch = step(0.5, fract((vL.x - vL.z) * 7.0));
      col = mix(vec3(0.05, 0.055, 0.065), vec3(0.095, 0.10, 0.115), hatch) * mix(0.6, 1.0, vDim) + warm * glow * lit * 0.2;
    } else if (vFloor.w > 0.5) {
      col = vFloor.rgb * (0.55 + 0.30 * glow + 0.15 * vHov + 0.20 * vSel) * mix(0.4, 1.0, vDim) + warm * glow * lit * 0.25;
    } else {
      col = vec3(0.075, 0.08, 0.09) + warm * glow * lit;
      col += vec3(0.08, 0.085, 0.1) * smoothstep(0.1, 0.45, vL.z + 0.9) * 0.4;
    }
    a = 0.92;
  } else if (n.z < -0.5) {
    // back wall, lit softly from above; or the photograph, dimmed so the atom stays the subject; or the spectrum band
    float h = (vL.y + 0.46) / 0.92;
    vec2 uv = vec2(vL.x / uS + 0.5, vL.y / uS + 0.5);
    float cx = floor(mod(vWall.x + 0.5, uWallGrid.x)); float cy = floor((vWall.x + 0.5) / uWallGrid.x);
    if (vWall.y > 1.5) {
      vec2 auv = vec2((cx + uv.x) * uWallUV.x, 1.0 - (uWallUV.z + (cy + 0.5) * uWallUV.w));
      vec3 sp = texture2D(uWallTex, auv).rgb;
      float dy = abs(uv.y - 0.5);
      float band = (1.0 - smoothstep(0.09, 0.13, dy)) * 0.9 + exp(-pow(dy / 0.2, 2.0)) * 0.5;
      col = mix(vec3(0.025, 0.028, 0.035), vec3(0.06, 0.065, 0.08), h) * mix(0.6, 1.0, vDim) + sp * band * (0.95 + 0.2 * vHov + 0.3 * vSel) * vDim;
      a = 0.96;
    } else if (vWall.y > 0.5) {
      vec2 auv = vec2((cx + uv.x) * uWallUV.x, 1.0 - (cy + 1.0 - uv.y) * uWallUV.y);
      vec3 tex = texture2D(uWallTex, auv).rgb;
      col = tex * (0.46 + 0.16 * h + 0.18 * vHov + 0.22 * vSel) * vDim + vColor * 0.04 * vSel;
      a = 0.94;
    } else {
      col = (mix(vec3(0.06, 0.065, 0.08), vec3(0.17, 0.18, 0.21), h) + vColor * 0.06 * vSel) * mix(0.6, 1.0, vDim);
      a = 0.30 + 0.12 * h + 0.08 * f;
    }
  } else {
    col = glass; a = 0.035 + 0.38 * f;
    if (n.y > 0.5) { a += 0.05; col = mix(col, vec3(1.0, 0.95, 0.85), 0.35); }
    col = mix(col, vec3(0.86, 0.90, 0.96), 0.55 * vFrost); a += 0.16 * vFrost;
  }
  col += vColor * (0.10 * vHov + 0.16 * vSel) * (0.5 + f) * vDim;
  a = min(1.0, a * (1.0 + 0.3 * vHov + 0.4 * vSel));
  gl_FragColor = vec4(col, a);
}`;

// ---- the door: front pane with its own outline, glint, hinge on the left; frosted in the estado lens;
// a small gold dot top-right when the element has been seen (the tiles' gold dot) ----
export const DOOR_V = COMMON_V + /* glsl */ `
attribute float aFrost; attribute float aSeen;
varying vec2 vUv; varying vec3 vN, vW, vColor; varying vec4 vF; varying float vSeen;
void main() {
  vF = vec4(uSelAmt * isAt(aCenter, uSel), uHoverAmt * isAt(aCenter, uHover), dimOf(), aFrost);
  vSeen = aSeen;
  vUv = uv; vColor = aColor; vN = normalize(mat3(instanceMatrix) * normal);
  vec4 w = instanceMatrix * vec4(position, 1.0); w.z += uLift * vF.x; vW = w.xyz;
  gl_Position = projectionMatrix * viewMatrix * w;
}`;

export const DOOR_F = /* glsl */ `
precision highp float;
uniform vec3 uLight, uLight2; uniform float uTime;
varying vec2 vUv; varying vec3 vN, vW, vColor; varying vec4 vF; varying float vSeen;
void main() {
  float vSel = vF.x, vHov = vF.y, vDim = vF.z, vFrost = vF.w;
  vec3 v = normalize(cameraPosition - vW); vec3 n = normalize(vN); if (dot(n, v) < 0.0) n = -n;
  float ndv = max(dot(n, v), 0.0); float f = pow(1.0 - ndv, 3.0);
  vec3 r = reflect(-v, n);
  float g1 = pow(max(dot(r, uLight), 0.0), 36.0);
  float g2 = pow(max(dot(r, uLight2), 0.0), 90.0);
  float b = min(min(vUv.x, 1.0 - vUv.x), min(vUv.y, 1.0 - vUv.y));
  float pw = fwidth(b); float line = 1.0 - smoothstep(pw * 0.5, pw * 1.7, b);
  vec3 edge = mix(vec3(0.92, 0.94, 0.98), vColor, 0.45 + 0.25 * vSel);
  float edgeA = (0.40 + 0.45 * vHov + 0.55 * vSel) * line * mix(0.55, 1.0, vDim);
  vec3 glass = mix(mix(vec3(0.72, 0.80, 0.92), vColor, 0.2), vec3(0.88, 0.92, 0.97), 0.6 * vFrost);
  float sheen = exp(-pow((vUv.x + vUv.y - 1.0 - 0.15 * sin(uTime * 0.8)) * 2.4, 2.0)) * 0.07 * vHov;
  float frost = 0.17 * vFrost * (0.75 + 0.5 * (1.0 - vUv.y)) * mix(0.5, 1.0, vDim);
  float a = 0.02 + 0.30 * f + sheen + 0.05 * vSel + frost;
  vec3 col = glass * a + vec3(1.0, 0.96, 0.88) * (g1 * 0.45 + g2 * 0.95) + edge * edgeA;
  a = min(1.0, a + g1 * 0.45 + g2 * 0.95 + edgeA);
  // the seen dot: a disc at 7 % from the top-right corner, as the tiles draw it, in --gold at 0.8
  float dd = distance(vUv, vec2(0.91, 0.91)); float dw = fwidth(dd);
  float seenDot = (1.0 - smoothstep(0.026 - dw, 0.026 + dw, dd)) * 0.8 * step(0.5, vSeen) * mix(0.5, 1.0, vDim);
  col = mix(col, vec3(0.910, 0.784, 0.447), seenDot); a = max(a, seenDot);
  gl_FragColor = vec4(col, a);
}`;

// ---- the symbol and the number etched on the glass (one atlas) ----
export const LABEL_V = COMMON_V + /* glsl */ `
attribute vec2 aCell; uniform vec2 uCell;
varying vec2 vUv; varying float vSel, vHov, vDim;
void main() {
  vSel = uSelAmt * isAt(aCenter, uSel); vHov = uHoverAmt * isAt(aCenter, uHover); vDim = dimOf();
  vUv = aCell + uv * uCell;
  vec4 w = instanceMatrix * vec4(position, 1.0); w.z += uLift * vSel;
  gl_Position = projectionMatrix * viewMatrix * w;
}`;

export const LABEL_F = /* glsl */ `
precision highp float;
uniform sampler2D uAtlas; varying vec2 vUv; varying float vSel, vHov, vDim;
void main() {
  float t = texture2D(uAtlas, vUv).a;
  float a = t * (0.66 + 0.26 * vHov + 0.34 * vSel) * mix(0.4, 1.0, vDim);
  gl_FragColor = vec4(vec3(0.96, 0.94, 0.89) * a, a);
}`;

// ---- nucleus: scaled by the size lens (gently, it is a drawing size), lifted by the gas state, hidden when show is 0 ----
export const NUCLEUS_V = COMMON_V + /* glsl */ `
attribute vec4 aAtom; attribute vec3 aGlow;
varying vec3 vN, vW, vColor; varying float vSel, vDim;
void main() {
  vSel = uSelAmt * isAt(aCenter, uSel); float hov = uHoverAmt * isAt(aCenter, uHover); vDim = dimOf();
  vColor = aGlow;
  float pulse = 1.0 + 0.05 * sin(uTime * 2.3 + aCenter.x * 3.1 + aCenter.y * 1.7) + 0.08 * hov;
  float sc = pulse * pow(aAtom.x, 0.6) * step(0.5, aAtom.z) * (1.0 + 0.9 * uBloom * vSel);
  vec4 w = instanceMatrix * vec4(position * sc, 1.0); w.y += aAtom.y; w.z += uLift * vSel; vW = w.xyz;
  vN = normalize(mat3(instanceMatrix) * normal);
  gl_Position = projectionMatrix * viewMatrix * w;
}`;

export const NUCLEUS_F = /* glsl */ `
precision highp float;
uniform float uBloom; varying vec3 vN, vW, vColor; varying float vSel, vDim;
void main() {
  vec3 v = normalize(cameraPosition - vW); float ndv = max(dot(normalize(vN), v), 0.0);
  float rim = pow(1.0 - ndv, 1.6);
  vec3 warm = vec3(1.0, 0.86, 0.62);
  vec3 col = mix(warm * 1.12, vColor, rim * 0.72) + 0.3 * pow(ndv, 10.0);
  col = mix(col, vec3(1.0, 0.98, 0.92), uBloom * vSel);
  gl_FragColor = vec4(col * mix(0.3, 1.0, vDim), 1.0);
}`;

// ---- electrons: billboard beads on vertex-shader orbits; aSpin keeps the phase continuous when the speed changes ----
export const ELECTRON_V = BILLBOARD_V + /* glsl */ `
attribute vec3 aU, aV; attribute vec4 aOrb; attribute vec4 aBead; attribute vec2 aSpin;
varying vec2 vUv; varying vec3 vColor; varying float vBoost;
void main() {
  float sel = uSelAmt * isAt(aCenter, uSel); float hov = uHoverAmt * isAt(aCenter, uHover);
  float ang = aOrb.y + aOrb.z * (uTime * aSpin.x + aSpin.y);
  vec3 c = aCenter + vec3(0.0, aBead.y, -0.45 + uLift * sel);
  vec3 p = c + aOrb.x * aBead.x * (cos(ang) * aU + sin(ang) * aV);
  float dist = length(cameraPosition - p);
  float size = max(aOrb.w * sqrt(aBead.x) * (1.0 + 0.35 * hov + 0.25 * sel), 2.2 * uPx * dist);
  p += (camRight() * position.x + camUp() * position.y) * size;
  vUv = position.xy; vColor = aColor; vBoost = (1.0 + 0.7 * hov + 0.6 * sel + 1.5 * uBloom * sel) * dimOf() * aBead.z;
  gl_Position = projectionMatrix * viewMatrix * vec4(p, 1.0);
}`;

export const ELECTRON_F = /* glsl */ `
precision highp float;
varying vec2 vUv; varying vec3 vColor; varying float vBoost;
void main() {
  float d2 = dot(vUv, vUv); if (d2 > 1.0) discard;
  float core = exp(-d2 * 16.0); float glow = exp(-d2 * 3.2) * 0.18;
  float a = (core * 1.15 + glow) * vBoost;
  vec3 col = mix(vColor, vec3(1.0), core * 0.85);
  gl_FragColor = vec4(col * a, a);
}`;

// ---- the nucleus halo, in the glow color ----
export const HALO_V = BILLBOARD_V + /* glsl */ `
attribute float aSize; attribute vec4 aAtom; attribute vec3 aGlow;
varying vec2 vUv; varying vec3 vColor; varying float vA;
void main() {
  float sel = uSelAmt * isAt(aCenter, uSel); float hov = uHoverAmt * isAt(aCenter, uHover);
  vec3 c = aCenter + vec3(0.0, aAtom.y, -0.45 + uLift * sel);
  float size = aSize * max(aAtom.x, 0.35) * (1.0 + 0.45 * hov + 0.3 * sel) * (1.0 + 7.0 * uBloom * sel);
  vec3 p = c + (camRight() * position.x + camUp() * position.y) * size;
  vUv = position.xy; vColor = aGlow; vA = (0.26 + 0.22 * hov + 0.2 * sel + 1.4 * uBloom * sel) * dimOf() * aAtom.z;
  gl_Position = projectionMatrix * viewMatrix * vec4(p, 1.0);
}`;

export const HALO_F = /* glsl */ `
precision highp float;
varying vec2 vUv; varying vec3 vColor; varying float vA;
void main() {
  float d2 = dot(vUv, vUv); if (d2 > 1.0) discard;
  float a = exp(-d2 * 4.2) * vA;
  vec3 col = mix(vec3(1.0, 0.82, 0.55), vColor, 0.35);
  gl_FragColor = vec4(col * a, a);
}`;

// ---- shell rings: one tilted quad per shell, the ring drawn in the fragment; aFlash is the
// Holograma fly-through: the ring the camera is passing lights up; aRing is (scale, lift, show, dash) ----
export const RING_V = COMMON_V + /* glsl */ `
attribute vec3 aU, aV; attribute float aRad, aStr, aFlash; attribute vec4 aRing;
varying vec2 vUv; varying vec3 vColor; varying float vStr, vBoost, vFlash, vDash;
void main() {
  float sel = uSelAmt * isAt(aCenter, uSel); float hov = uHoverAmt * isAt(aCenter, uHover);
  vec3 c = aCenter + vec3(0.0, aRing.y, -0.45 + uLift * sel);
  vec3 p = c + (position.x * aU + position.y * aV) * aRad * 1.11 * aRing.x;
  vUv = position.xy; vColor = aColor; vStr = aStr; vFlash = aFlash; vDash = aRing.w;
  vBoost = (1.0 + 0.8 * hov + 0.7 * sel + 3.0 * aFlash) * dimOf() * aRing.z;
  gl_Position = projectionMatrix * viewMatrix * vec4(p, 1.0);
}`;

export const RING_F = /* glsl */ `
precision highp float;
varying vec2 vUv; varying vec3 vColor; varying float vStr, vBoost, vFlash, vDash;
void main() {
  float d = length(vUv); float t = abs(d - 0.9); float w = fwidth(d);
  float hw = w * (0.55 + 1.3 * vStr + 1.6 * vFlash + 0.8 * vDash);
  float a = 1.0 - smoothstep(hw, hw + w, t);
  a *= (0.16 + 0.5 * vStr + 0.3 * vDash) * vBoost;
  if (vDash > 0.5) { float ang = atan(vUv.y, vUv.x); a *= step(0.45, fract(ang * 1.9098593)); }
  vec3 col = mix(mix(vec3(0.62, 0.72, 0.88), vColor, 0.35), vec3(0.85, 0.93, 1.0), vFlash);
  gl_FragColor = vec4(col * a, a);
}`;

// ---- edges of the case (the 8 edges that do not belong to the door) ----
export const EDGE_V = COMMON_V + /* glsl */ `
varying vec3 vColor; varying float vA;
void main() {
  float sel = uSelAmt * isAt(aCenter, uSel); float hov = uHoverAmt * isAt(aCenter, uHover);
  vec3 p = position; p.z += uLift * sel;
  vColor = mix(aColor, vec3(1.0), 0.3 * hov + 0.4 * sel); vA = (0.26 + 0.45 * hov + 0.6 * sel) * mix(0.45, 1.0, dimOf());
  gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
}`;

export const EDGE_F = /* glsl */ `
precision highp float;
varying vec3 vColor; varying float vA;
void main() { gl_FragColor = vec4(vColor * vA, vA); }`;
