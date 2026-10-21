// Builds public/img/cutouts/{z}.webp (the element photograph with the background removed: alpha WebP,
// 1024 px long side, quality 80) and public/img/cutouts/{z}-tile.webp (256x256, the cutout centered on
// transparency) from the hero photographs in public/data/photos.json. The matting runs in Python
// (tools/cutout.py, rembg) inside the virtual environment data/venv; the model weights download once
// into data/cache/models (U2NET_HOME). Nothing is written on C:.
//
// data/overrides/cutouts.json decides per element: "auto", "keep" (the original is used, no cutout is
// written) or { model, margin, minBlob, alphaMatting }. Every cutout keeps the license and credit of its
// source: public/img/cutouts/index.json copies them from photos.json next to the model that was used.
// The photograph is never altered beyond the cutout.
//
// Run: node tools/build-cutouts.mjs [--only 26,29,79] [--model isnet-general-use] [--contact] [--force]
//   --only     atomic numbers to process (default: every element with a photograph)
//   --model    default model when the override does not name one (isnet-general-use; u2net is the fallback)
//   --contact  also compose data/cache/cutouts/contact.png, original and cutout side by side, for review
//   --force    rerun the matting even when the cached PNG already matches the requested options

import { readFile, writeFile, mkdir, unlink, readdir } from 'node:fs/promises';
import { join } from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import sharp from 'sharp';
import { root, exists, getBytesCached, today } from './net.mjs';

const run = promisify(execFile);

const PHOTOS = join(root, 'public/data/photos.json');
const OVERRIDES = join(root, 'data/overrides/cutouts.json');
const OUT_DIR = join(root, 'public/img/cutouts');
const MANIFEST = join(OUT_DIR, 'index.json');
const WORK = join(root, 'data/cache/cutouts');
const MODELS = join(root, 'data/cache/models');
const PYTHON = join(root, 'data/venv/Scripts/python.exe');
const SCRIPT = join(root, 'tools/cutout.py');

const DEFAULT_MODEL = 'isnet-general-use';
const FALLBACK_MODEL = 'u2net';
const DEFAULT_MARGIN = 0.08;
const LONG_SIDE = 1024;
const TILE = 256;
const QUALITY = 80;
const QUALITY_FLOOR = 60;
const FILE_SOFT_CAP = 120 * 1024; // above this a cutout steps its quality down, to the floor
const CAP_PER_ELEMENT = 120 * 1024; // the directory total for the processed set stays under n * 120 KB
const TRANSPARENT = { r: 0, g: 0, b: 0, alpha: 0 };

const log = (...a) => console.log(...a);
const kb = (n) => `${(n / 1024).toFixed(1)} KB`;

function parseArgs(argv) {
  const args = { only: null, model: DEFAULT_MODEL, contact: false, force: false };
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i];
    if (a === '--only') args.only = argv[++i].split(',').map(Number);
    else if (a === '--model') args.model = argv[++i];
    else if (a === '--contact') args.contact = true;
    else if (a === '--force') args.force = true;
    else throw new Error(`unknown argument ${a}`);
  }
  if (args.only && args.only.some((z) => !(z >= 1 && z <= 118))) throw new Error('--only takes atomic numbers 1-118');
  return args;
}

// "auto" | "keep" | { model, margin, minBlob, alphaMatting } -> normalized options.
function resolveOverride(value, defaultModel) {
  if (value == null || value === 'auto') {
    return { mode: 'auto', model: defaultModel, margin: DEFAULT_MARGIN, minBlob: 0, alphaMatting: false, explicitModel: false };
  }
  if (value === 'keep') return { mode: 'keep' };
  if (typeof value === 'object') {
    return {
      mode: 'auto',
      model: value.model || defaultModel,
      margin: value.margin ?? DEFAULT_MARGIN,
      minBlob: value.minBlob ?? 0,
      alphaMatting: Boolean(value.alphaMatting),
      explicitModel: Boolean(value.model),
    };
  }
  throw new Error(`override must be "auto", "keep" or an object, got ${JSON.stringify(value)}`);
}

function lastJsonLine(text) {
  const lines = String(text || '').trim().split(/\r?\n/).filter((l) => l.startsWith('{'));
  try { return lines.length ? JSON.parse(lines.at(-1)) : null; } catch { return null; }
}

// Runs tools/cutout.py once; the result PNG and its measurements are cached in data/cache/cutouts/
// keyed by the options, so a rerun with the same options skips the model.
async function matte(z, srcPath, opts, force) {
  const png = join(WORK, `${z}-cut.png`);
  const side = join(WORK, `${z}-cut.json`);
  const want = { model: opts.model, margin: opts.margin, minBlob: opts.minBlob, alphaMatting: opts.alphaMatting };
  if (!force && await exists(png) && await exists(side)) {
    const prev = JSON.parse(await readFile(side, 'utf8'));
    if (JSON.stringify(prev.want) === JSON.stringify(want)) return { ...prev, png, cached: true };
  }
  const attempt = async (model) => {
    const argv = ['-I', '-X', 'utf8', SCRIPT, '--in', srcPath, '--out', png, '--model', model, '--margin', String(opts.margin)];
    if (opts.minBlob > 0) argv.push('--min-blob', String(opts.minBlob));
    if (opts.alphaMatting) argv.push('--alpha-matting');
    const env = { ...process.env, U2NET_HOME: MODELS };
    let stdout;
    try {
      ({ stdout } = await run(PYTHON, argv, { env, maxBuffer: 16 * 1024 * 1024, windowsHide: true }));
    } catch (err) {
      const line = lastJsonLine(err.stdout);
      const tail = String(err.stderr || '').trim().split(/\r?\n/).slice(-3).join(' | ');
      throw new Error(line?.error || tail || err.message);
    }
    const line = lastJsonLine(stdout);
    if (!line?.ok) throw new Error(line?.error || 'cutout.py printed no result');
    return line;
  };
  let result;
  let fallbackFrom;
  try {
    result = await attempt(opts.model);
  } catch (err) {
    if (opts.explicitModel || opts.model === FALLBACK_MODEL) throw err;
    log(`  ${z}: ${opts.model} failed (${err.message}); falling back to ${FALLBACK_MODEL}`);
    fallbackFrom = opts.model;
    result = await attempt(FALLBACK_MODEL);
  }
  const record = { want, ...result, fallbackFrom };
  await writeFile(side, JSON.stringify(record, null, 1));
  return { ...record, png, cached: false };
}

// PNG cutout -> alpha WebP at 1024 px long side (quality stepping down above the soft cap) + 256 px tile.
async function encode(png) {
  let quality = QUALITY;
  let webp;
  for (;;) {
    webp = await sharp(png)
      .resize({ width: LONG_SIDE, height: LONG_SIDE, fit: 'inside', withoutEnlargement: true })
      .webp({ quality, effort: 6 })
      .toBuffer();
    if (webp.length <= FILE_SOFT_CAP || quality <= QUALITY_FLOOR) break;
    quality -= 10;
  }
  const tile = await sharp(png)
    .resize(TILE, TILE, { fit: 'contain', background: TRANSPARENT })
    .webp({ quality: QUALITY, effort: 6 })
    .toBuffer();
  const meta = await sharp(webp).metadata();
  return { webp, tile, quality, width: meta.width, height: meta.height };
}

// A photograph or cutout fitted inside w x h on a flat background (for the contact sheet and previews;
// mid grey shows both light and dark fringes on a cutout).
async function cell(input, w, h, background) {
  const fitted = await sharp(input).resize(w, h, { fit: 'inside' }).png().toBuffer();
  return sharp({ create: { width: w, height: h, channels: 4, background } })
    .composite([{ input: fitted, gravity: 'centre' }])
    .png()
    .toBuffer();
}

function labelSvg(text, w, h) {
  const safe = text.replace(/&/g, '&amp;').replace(/</g, '&lt;');
  return Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}">
    <text x="6" y="${h - 7}" font-family="Segoe UI, Arial, sans-serif" font-size="14" fill="#ffffff">${safe}</text></svg>`);
}

// Two elements per row: original | cutout | original | cutout, with a label band above each pair.
async function contactSheet(rows, path) {
  const W = 360; const H = 270; const L = 24; const G = 8;
  const perRow = 2;
  const nRows = Math.ceil(rows.length / perRow);
  const width = perRow * (2 * W + G) + (perRow + 1) * G;
  const height = nRows * (L + H + G) + G;
  const layers = [];
  for (let i = 0; i < rows.length; i += 1) {
    const r = rows[i];
    const col = i % perRow; const row = Math.floor(i / perRow);
    const x = G + col * (2 * W + 2 * G);
    const y = G + row * (L + H + G);
    layers.push({ input: labelSvg(r.label, 2 * W + G, L), left: x, top: y });
    layers.push({ input: await cell(r.original, W, H, '#2b2b2b'), left: x, top: y + L });
    const right = r.cutout ? await cell(r.cutout, W, H, '#808080') : await cell(labelSvg('keep: original used', W, H), W, H, '#555555');
    layers.push({ input: right, left: x + W + G, top: y + L });
  }
  await sharp({ create: { width, height, channels: 4, background: '#111111' } }).composite(layers).png().toFile(path);
  return { width, height };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (!(await exists(PYTHON))) throw new Error(`${PYTHON} not found: create the venv under data/venv first`);
  await mkdir(OUT_DIR, { recursive: true });
  await mkdir(WORK, { recursive: true });
  await mkdir(MODELS, { recursive: true });

  const photos = JSON.parse(await readFile(PHOTOS, 'utf8')).elements;
  const overrides = (await exists(OVERRIDES)) ? JSON.parse(await readFile(OVERRIDES, 'utf8')) : {};
  for (const k of Object.keys(overrides)) {
    if (!k.startsWith('_') && !(Number(k) >= 1 && Number(k) <= 118)) throw new Error(`override key ${k} is not an atomic number`);
  }
  const manifest = (await exists(MANIFEST)) ? JSON.parse(await readFile(MANIFEST, 'utf8')) : { elements: {} };
  manifest.elements ||= {};

  const zs = args.only || Object.keys(photos).map(Number).filter((z) => photos[z]).sort((a, b) => a - b);
  const results = [];
  const started = Date.now();
  for (const z of zs) {
    const p = photos[z];
    if (!p?.hero) { results.push({ z, status: 'no photo' }); continue; }
    const opts = resolveOverride(overrides[z], args.model);
    const outWebp = join(OUT_DIR, `${z}.webp`);
    const outTile = join(OUT_DIR, `${z}-tile.webp`);
    if (opts.mode === 'keep') {
      for (const f of [outWebp, outTile]) if (await exists(f)) await unlink(f);
      manifest.elements[z] = { keep: true, file: p.file, note: overrides._notes?.[z] ?? null };
      results.push({ z, status: 'keep', file: p.file, note: overrides._notes?.[z] });
      log(`${z}: keep (${overrides._notes?.[z] || 'no note'})`);
      continue;
    }
    const t0 = Date.now();
    try {
      const buf = await getBytesCached(p.hero, 'cutouts');
      const srcPath = join(WORK, `${z}-src.jpg`);
      await writeFile(srcPath, buf); // a legible copy next to the hashed cache entry, for cutout.py and the sheet
      const m = await matte(z, srcPath, opts, args.force);
      const e = await encode(m.png);
      await writeFile(outWebp, e.webp);
      await writeFile(outTile, e.tile);
      await writeFile(join(WORK, `${z}-preview.png`), await cell(e.webp, 640, 480, '#808080'));
      manifest.elements[z] = {
        file: p.file,
        artist: p.artist,
        license: p.license,
        licenseUrl: p.licenseUrl,
        page: p.page,
        credit: p.credit,
        change: 'background removed and cropped to the subject; no other change',
        model: m.model,
        margin: m.margin,
        ...(opts.minBlob ? { minBlob: opts.minBlob } : {}),
        ...(opts.alphaMatting ? { alphaMatting: true } : {}),
        ...(m.fallbackFrom ? { fallbackFrom: m.fallbackFrom } : {}),
        cutout: `${z}.webp`,
        tile: `${z}-tile.webp`,
        width: e.width,
        height: e.height,
        quality: e.quality,
        bytes: e.webp.length,
        tileBytes: e.tile.length,
        coverage: m.coverage,
        soft: m.soft,
        blobs: m.blobs,
      };
      results.push({ z, status: 'ok', file: p.file, srcPath, png: m.png, ...manifest.elements[z], touches: m.touches, cached: m.cached, seconds: (Date.now() - t0) / 1000 });
      const touches = m.touches?.length ? ` touches ${m.touches.join(',')}` : '';
      log(`${z}: ${m.model} m${m.margin} -> ${e.width}x${e.height} q${e.quality} ${kb(e.webp.length)} + tile ${kb(e.tile.length)} | coverage ${m.coverage} fill ${m.fill} soft ${m.soft} blobs ${m.blobs}${touches}${m.cached ? ' (cached)' : ''} ${((Date.now() - t0) / 1000).toFixed(1)}s`);
    } catch (err) {
      results.push({ z, status: 'failed', file: p.file, error: err.message });
      log(`${z}: FAILED ${err.message}`);
    }
  }

  // Stale files: in a full run, anything in the directory that this run did not produce goes away.
  if (!args.only) {
    const produced = new Set(results.filter((r) => r.status === 'ok').map((r) => String(r.z)));
    for (const f of await readdir(OUT_DIR)) {
      const mt = f.match(/^(\d+)(-tile)?\.webp$/);
      if (mt && !produced.has(mt[1])) { await unlink(join(OUT_DIR, f)); delete manifest.elements[mt[1]]; }
    }
    for (const k of Object.keys(manifest.elements)) if (!zs.includes(Number(k))) delete manifest.elements[k];
  }

  manifest.built = today();
  manifest.note = 'Cutouts of the photographs in public/data/photos.json: the background removed by rembg (tools/build-cutouts.mjs), nothing else changed. Each entry keeps the license, author and Commons page of its source; show them with the word "recortada" / "cut out". Entries with keep:true have no cutout: the original is used.';
  manifest.elements = Object.fromEntries(Object.keys(manifest.elements).map(Number).sort((a, b) => a - b).map((z) => [z, manifest.elements[z]]));
  await writeFile(MANIFEST, JSON.stringify(manifest, null, 1));

  if (args.contact) {
    const rows = [];
    for (const r of results) {
      if (r.status === 'no photo' || r.status === 'failed') continue;
      const original = r.status === 'keep' ? await getBytesCached(photos[r.z].hero, 'cutouts') : r.srcPath;
      const label = r.status === 'keep'
        ? `${r.z}  ${r.file.replace(/^File:/, '').slice(0, 48)}  |  keep`
        : `${r.z}  ${r.file.replace(/^File:/, '').slice(0, 40)}  |  ${r.model} m${r.margin}  |  ${kb(r.bytes)} ${r.width}x${r.height}  |  soft ${r.soft} blobs ${r.blobs}`;
      rows.push({ label, original, cutout: r.status === 'keep' ? null : join(OUT_DIR, `${r.z}.webp`) });
    }
    const sheet = await contactSheet(rows, join(WORK, 'contact.png'));
    log(`contact sheet: ${join(WORK, 'contact.png')} ${sheet.width}x${sheet.height}`);
  }

  // Report and the byte cap.
  const ok = results.filter((r) => r.status === 'ok');
  const total = ok.reduce((s, r) => s + r.bytes + r.tileBytes, 0);
  const files = (await readdir(OUT_DIR)).filter((f) => f.endsWith('.webp'));
  const sizes = await Promise.all(files.map(async (f) => (await readFile(join(OUT_DIR, f))).length));
  const dirTotal = sizes.reduce((a, b) => a + b, 0);
  const cap = CAP_PER_ELEMENT * zs.length;
  const count = (status) => results.filter((r) => r.status === status).length;
  log(`\n== cutouts: ${ok.length} written, ${count('keep')} kept, ${count('failed')} failed, ${count('no photo')} without photo, in ${((Date.now() - started) / 1000).toFixed(0)}s`);
  log(`bytes this run: ${total} (${kb(total)}) for ${zs.length} elements; directory total ${dirTotal} (${kb(dirTotal)}); cap ${cap} (${kb(cap)})`);
  log('\n== Z | model | quality | cutout bytes | tile bytes | size | coverage | soft | blobs | touches');
  for (const r of ok) {
    const model = r.model + (r.fallbackFrom ? ` (fallback from ${r.fallbackFrom})` : '');
    log(r.z, '|', model, '|', r.quality, '|', r.bytes, '|', r.tileBytes, '|', `${r.width}x${r.height}`, '|', r.coverage, '|', r.soft, '|', r.blobs, '|', r.touches?.join(',') || '-');
  }
  for (const r of results.filter((x) => x.status === 'failed')) log(r.z, '| FAILED |', r.error);
  if (total > cap) {
    log(`\nOVER THE BYTE CAP by ${kb(total - cap)}: lower the quality floor, the long side, or set the heaviest elements to keep.`);
    process.exitCode = 1;
  }
}

await main();
