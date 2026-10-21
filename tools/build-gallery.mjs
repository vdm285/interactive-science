// Curated image gallery per element from the media the Spanish and English Wikipedia
// articles actually use (REST media-list endpoint), with Commons license checks.
// Writes public/data/gallery/{z}.json and public/data/gallery/index.json.
// Curation lives in data/overrides/gallery.json (exclude / include / first).
// Caches under data/cache/ only. Run: npm run gallery

import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { ES } from './names.mjs';
import { getJsonCached, commonsInfo, licenseOk, commonsThumb, writeJsonCapped, root, today, stripHtml } from './net.mjs';
import { ES_TITLES, esTitleCandidates } from './build-wiki.mjs';

const OUT = join(root, 'public/data/gallery');
const PER_FILE_CAP = 40 * 1024;
const INDEX_CAP = 10 * 1024;
const MAX_ITEMS = Number(process.env.GALLERY_MAX || 24);
const MIN_WIDTH = 400;

// Title-based rejects: icons and chrome, overview tables, shell diagrams, the NFPA diamond.
const REJECT_TITLE = [
  /nuvola|icon|logo|wiki|commons|flag|symbol|edit-|question|ambox|crystal clear|OOjs|padlock/i,
  /periodic table|tabla periódica|tabla periodica|periodensystem|periodisches system|periodiska system/i,
  /electron shell|capa electrónica|capa electronica/i,
  /nfpa/i,
  // Plots and schematic figures read badly as photographs in a gallery.
  /attenuation|graph|chart|plot|diagram|schematic|table|histogram|cross[- ]section/i,
];
const REJECT_EXT = /\.(svg|gif)$/i;

function normalizeTitle(t) {
  // eswiki returns "Archivo:Foo_bar.jpg"; Commons wants "File:Foo bar.jpg".
  return t.replace(/^(File|Archivo|Imagen|Image):/i, 'File:').replace(/_/g, ' ').trim();
}

function captionText(c) {
  if (!c) return null;
  const text = c.text ?? stripHtml(c.html);
  if (!text) return null;
  return text.replace(/\s*\[\s*\d+\s*\]/g, '').replace(/\s+/g, ' ').trim() || null;
}

async function mediaList(lang, title) {
  const url = `https://${lang}.wikipedia.org/api/rest_v1/page/media-list/${encodeURIComponent(title.replace(/ /g, '_'))}`;
  const data = await getJsonCached(url, 'wiki-media');
  const items = [];
  for (const it of data?.items || []) {
    if (it.type !== 'image' || !it.title) continue;
    const file = normalizeTitle(it.title);
    items.push({ file, caption: captionText(it.caption), lead: !!it.leadImage });
  }
  return items;
}

// The article title that actually resolves: reuse the wiki pipeline's output when present.
async function resolvedTitles(z, enName) {
  try {
    const w = JSON.parse(await readFile(join(root, `public/data/wiki/${z}.json`), 'utf8'));
    return { es: w.es?.title || null, en: w.en?.title || null };
  } catch {
    return { es: ES_TITLES[z] || esTitleCandidates(z)[0], en: enName };
  }
}

async function loadEnglishNames() {
  for (const rel of ['public/data/elements.json']) {
    try {
      const data = JSON.parse(await readFile(join(root, rel), 'utf8'));
      const list = Array.isArray(data) ? data : data.elements;
      const out = {};
      for (const e of list) out[e.z] = e.name?.en || e.name;
      if (Object.keys(out).length === 118) return out;
    } catch { /* next */ }
  }
  throw new Error('No elements file with English names found');
}

async function loadOverrides() {
  try {
    return JSON.parse(await readFile(join(root, 'data/overrides/gallery.json'), 'utf8'));
  } catch (err) {
    console.log('  note: no data/overrides/gallery.json read (' + err.message + ')');
    return {};
  }
}

function titleRejected(file) {
  if (REJECT_EXT.test(file)) return 'svg/gif';
  for (const re of REJECT_TITLE) if (re.test(file)) return 're:' + re.source.slice(0, 20);
  return null;
}

async function buildOne(z, titles, ov, stats) {
  const es = titles.es ? await mediaList('es', titles.es) : [];
  const en = titles.en ? await mediaList('en', titles.en) : [];
  const exclude = new Set((ov.exclude || []).map(normalizeTitle));
  const include = (ov.include || []).map(normalizeTitle);
  const first = ov.first ? normalizeTitle(ov.first) : null;

  // Merge by file title: ES order first, then EN additions in EN order.
  const order = [];
  const byFile = new Map();
  const add = (item, lang, curated = false) => {
    let m = byFile.get(item.file);
    if (!m) { m = { file: item.file, caption: { es: null, en: null }, curated }; byFile.set(item.file, m); order.push(item.file); }
    if (item.caption && !m.caption[lang]) m.caption[lang] = item.caption;
    if (curated) m.curated = true;
  };
  for (const it of es) add(it, 'es');
  for (const it of en) add(it, 'en');
  for (const f of include) add({ file: f, caption: null }, 'es', true);

  const candidates = [];
  for (const file of order) {
    const m = byFile.get(file);
    if (exclude.has(file)) { stats.excluded += 1; continue; }
    const why = m.curated ? null : titleRejected(file);
    if (why) { stats.titleRejected += 1; continue; }
    candidates.push(m);
  }

  const info = await commonsInfo(candidates.map((m) => m.file));
  const items = [];
  for (const m of candidates) {
    const meta = info[m.file];
    if (!meta) { stats.notOnCommons += 1; continue; }
    if (!/^image\//.test(meta.mime || '') || /svg|gif/.test(meta.mime)) { stats.badMime += 1; continue; }
    if (!licenseOk(meta.license)) { stats.badLicense += 1; continue; }
    if ((meta.width || 0) < MIN_WIDTH && !m.curated) { stats.tooSmall += 1; continue; }
    items.push({
      file: meta.title,
      thumb: commonsThumb(meta.title, 500),
      src: commonsThumb(meta.title, 1280),
      w: meta.width,
      h: meta.height,
      caption: m.caption,
      artist: meta.artist,
      license: meta.license,
      licenseUrl: meta.licenseUrl,
      page: meta.descriptionUrl,
    });
  }
  if (first) {
    const i = items.findIndex((it) => normalizeTitle(it.file) === first);
    if (i > 0) items.unshift(items.splice(i, 1)[0]);
    else if (i < 0) console.log(`  note: ${z} first "${first}" not in gallery`);
  }
  const kept = items.slice(0, MAX_ITEMS);
  const doc = {
    z,
    generated: today(),
    source: { es: titles.es, en: titles.en },
    count: kept.length,
    items: kept,
  };
  const bytes = await writeJsonCapped(join(OUT, `${z}.json`), doc, PER_FILE_CAP);
  return { count: kept.length, bytes, items: kept };
}

const enNames = await loadEnglishNames();
const overrides = await loadOverrides();
const zs = Array.from({ length: 118 }, (_, i) => i + 1);
const stats = { excluded: 0, titleRejected: 0, notOnCommons: 0, badMime: 0, badLicense: 0, tooSmall: 0 };
const results = {};
// Elements run one at a time; commonsInfo itself keeps at most 4 requests in flight.
for (const z of zs) {
  const titles = await resolvedTitles(z, enNames[z]);
  results[z] = await buildOne(z, titles, overrides[String(z)] || {}, stats);
  process.stdout.write(`${z}:${results[z].count} `);
}
process.stdout.write('\n');

const index = { generated: today(), max: MAX_ITEMS, counts: {} };
let total = 0;
for (const z of zs) { index.counts[z] = results[z].count; total += results[z].bytes; }
total += await writeJsonCapped(join(OUT, 'index.json'), index, INDEX_CAP);

const counts = zs.map((z) => results[z].count).sort((a, b) => a - b);
const zero = zs.filter((z) => results[z].count === 0);
console.log(`gallery: min ${counts[0]}, median ${counts[59]}, max ${counts[117]}, zero: ${zero.map((z) => `${z} ${ES[z][0]}`).join(', ') || 'none'}`);
console.log(`gallery: dropped ${JSON.stringify(stats)}`);
console.log(`gallery: ${total} bytes in ${OUT} (cap ${MAX_ITEMS} per element)`);
