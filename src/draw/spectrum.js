// Emission spectra drawn from NIST line lists. Nothing here invents a line: every bar is a
// wavelength from spectra.json and its brightness is the relative intensity NIST gives.

import { wavelengthToRgb } from '../logic.js';

const cache = new Map();
const canvases = new Map();

/** Tiny strip for a table tile from the 200 bins, as a data URL (cached per element). */
export function stripDataUrl(z, bins) {
  if (cache.has(z)) return cache.get(z);
  const canvas = stripCanvas(z, bins);
  if (!canvas) return null;
  const url = canvas.toDataURL('image/png');
  cache.set(z, url);
  return url;
}

/** The same strip as a bins x 1 canvas (cached per element); the 3D back walls draw it into their atlas. */
export function stripCanvas(z, bins) {
  if (canvases.has(z)) return canvases.get(z);
  if (!bins) return null;
  const canvas = document.createElement('canvas');
  canvas.width = bins.length;
  canvas.height = 1;
  const ctx = canvas.getContext('2d');
  const img = ctx.createImageData(bins.length, 1);
  for (let i = 0; i < bins.length; i++) {
    const nm = 380 + (i + 0.5) * (400 / bins.length);
    const [r, g, b] = wavelengthToRgb(nm);
    const a = bins[i] / 255;
    img.data[i * 4] = r;
    img.data[i * 4 + 1] = g;
    img.data[i * 4 + 2] = b;
    img.data[i * 4 + 3] = Math.round(255 * Math.min(1, a * 1.15));
  }
  ctx.putImageData(img, 0, 0);
  canvases.set(z, canvas);
  return canvas;
}

/**
 * Full spectrum on a canvas: black field, one bright bar per line, with a faint rainbow as the ruler.
 * lines: [[nm, rel], ...]. Returns the drawn line positions for hover lookup.
 */
export function drawSpectrum(canvas, lines, { lo = 380, hi = 780, glow = true, bins = null } = {}) {
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  const w = canvas.clientWidth || 800;
  const h = canvas.clientHeight || 240;
  canvas.width = Math.round(w * dpr);
  canvas.height = Math.round(h * dpr);
  const ctx = canvas.getContext('2d');
  ctx.scale(dpr, dpr);
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, w, h);
  const x = (nm) => ((nm - lo) / (hi - lo)) * w;
  // Faint continuum ruler along the bottom so the eye knows where red and violet are.
  const ruler = ctx.createLinearGradient(0, 0, w, 0);
  for (let nm = lo; nm <= hi; nm += 10) {
    const [r, g, b] = wavelengthToRgb(nm);
    ruler.addColorStop((nm - lo) / (hi - lo), `rgba(${r},${g},${b},0.22)`);
  }
  ctx.fillStyle = ruler;
  ctx.fillRect(0, h - 6, w, 6);
  if (!lines?.length) return [];
  const positions = [];
  ctx.globalCompositeOperation = 'lighter';
  // Every line in range, from the 200 bins, as a faint underlay; the strongest 160 are drawn sharp on top.
  if (bins?.length) {
    const bw = w / bins.length;
    for (let i = 0; i < bins.length; i++) {
      if (!bins[i]) continue;
      const nm = lo + (i + 0.5) * ((hi - lo) / bins.length);
      const [r, g, b] = wavelengthToRgb(nm);
      ctx.fillStyle = `rgba(${r},${g},${b},${0.08 + 0.3 * (bins[i] / 255)})`;
      ctx.fillRect(i * bw, 0, bw + 0.5, h - 8);
    }
  }
  for (const [nm, rel] of lines) {
    const px = x(nm);
    const [r, g, b] = wavelengthToRgb(nm);
    const a = 0.25 + 0.75 * Math.sqrt(rel);
    if (glow && rel > 0.15) {
      const grad = ctx.createLinearGradient(px - 6, 0, px + 6, 0);
      grad.addColorStop(0, `rgba(${r},${g},${b},0)`);
      grad.addColorStop(0.5, `rgba(${r},${g},${b},${0.35 * rel})`);
      grad.addColorStop(1, `rgba(${r},${g},${b},0)`);
      ctx.fillStyle = grad;
      ctx.fillRect(px - 6, 0, 12, h - 8);
    }
    ctx.fillStyle = `rgba(${r},${g},${b},${a})`;
    const width = rel > 0.6 ? 2 : 1;
    ctx.fillRect(px - width / 2, 0, width, h - 8);
    positions.push({ nm, rel, px });
  }
  ctx.globalCompositeOperation = 'source-over';
  return positions;
}
