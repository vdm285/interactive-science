// Builds public/data/photos.json (one Wikimedia Commons photograph per element, with full
// attribution) and public/img/tiles/{z}.webp (160x160 thumbnails for the table tiles).
//
// Sources, in order of preference:
//   1. Wikidata P18 (image) of each element item.
//   2. Commons categories "Element samples" (+ its subcategories), "Featured pictures of chemical
//      elements" and "Quality images of chemical elements", matched to an element by file name.
//   3. The "Hi-Res Images of Chemical Elements" set: File:<name> (<Z> <Sym>).jpg.
//   4. The element's own Commons category (Wikidata P373), only when 1-3 gave something weak.
// Every candidate goes through Commons extmetadata; only free licenses pass (licenseOk).
// Nothing is invented: no artist or license is ever guessed. Elements without a usable photograph
// are written as null. data/overrides/photos.json wins over everything.
//
// Run: node tools/build-photos.mjs   (npm run photos). Downloads are cached under data/cache/.

import { readFile, writeFile, mkdir, unlink } from 'node:fs/promises';
import { join } from 'node:path';
import sharp from 'sharp';
import {
  root, exists, pool, sparql, getJsonCached, getBytesCached, commonsInfo, licenseOk, commonsThumb,
  writeJsonCapped, today,
} from './net.mjs';

const OUT_JSON = join(root, 'public/data/photos.json');
const TILES_DIR = join(root, 'public/img/tiles');
const OVERRIDES = join(root, 'data/overrides/photos.json');
const CONCURRENCY = 4;
const TILE = 160;
const TILE_MAX_BYTES = 10 * 1024;
const JSON_CAP = 120 * 1024;

// Elements that are gases at room temperature: a discharge tube is their iconic photograph.
const GASES = new Set([1, 2, 7, 8, 9, 10, 17, 18, 36, 54, 86]);

// Other spellings that appear in Commons file names (German, Czech, old English).
const ALT_NAMES = {
  1: ['Wasserstoff'], 6: ['Kohlenstoff'], 7: ['Stickstoff'], 8: ['Sauerstoff'], 9: ['Fluor'],
  11: ['Natrium'], 12: ['Hořčík', 'Magnasium'], 13: ['Aluminum'], 15: ['Phosphor'],
  16: ['Sulphur', 'Schwefel', 'Síra'], 17: ['Chlor'], 19: ['Kalium'], 22: ['Titan'],
  24: ['Chrom'], 25: ['Mangan'], 26: ['Eisen'], 27: ['Kobalt'], 29: ['Kupfer', 'Cuivre'],
  33: ['Arsen'], 34: ['Selen'], 35: ['Brom'], 40: ['Zirkonium'], 41: ['Niob'], 42: ['Molybdän'],
  47: ['Silber'], 50: ['Zinn', 'Cín'], 51: ['Antimon'], 52: ['Tellur'], 53: ['Jod', 'Iod'],
  55: ['Cesium', 'Cäsium'], 57: ['Lanthan'], 58: ['Cer'], 59: ['Praseodym'], 60: ['Neodym'],
  73: ['Tantal'], 74: ['Wolfram', 'Вольфрам'], 78: ['Platin'], 80: ['Quecksilber'],
  82: ['Blei'], 83: ['Wismut', 'Bismut'],
};

// A file whose name (or description) says it is a diagram, a compound, a monument, a spectrum...
// is not a photograph of the element. Rejected outright.
const HARD_NAME = /simulation|illustration|diagram|drawing|schem|chart|\bmap\b|\btable\b|tableimage|spectr|decay|nucle|orbital|\belectrons?\b|elektronskal|\bshells?\b|\bmodel\b|stele|monument|statue|plaque|placard|\bcoins?\b|\bflag\b|logo|symbol|label|poster|periodic|anniversary|celebration|portrait|\batoms?\b|\b3d\b|balls|structure|cycle|carbonyl|oxide|chloride|fluoride|hydride|bromide|iodide|sulfide|sulphide|nitrate|sulfate|carbonate|hexa|tetra|lattice|half-?life|msds|hazard|comparis|elution|produ[ck]tion|\bgraph\b|statistic|worldwide|cooking|nutrient|removal|approach|\bstudy\b|highlights|infographic|\bogg\b|\boga\b/i;
const HARD_DESC = /simulation|illustration|artist'?s (impression|concept|rendering)|\brendering\b|diagram|\bdrawing\b|computer[- ]generated|\bgraph\b|\bchart\b|production (in|worldwide|per)/i;
// Photograph related to the element but not of a sample of it: kind "other", heavy penalty.
// The "(Element - N)" series is a museum display case: for synthetic elements usually a placard.
const SOFT_NAME = /apparatus|fluores|smoke detector|spark plug|static eliminator|staticmaster|antistati|museum|alloy|generator|hotel|solution|target|cloud chamber|experiment|\blab\b|laboratory|factory|reactor|cyclotron|flasks?\b|\bfuel\b|enriched|magnet|\(element - \d+\)/i;
const SOFT_DESC = /uranium(-bearing)? mineral|uranium ore|thorium ore|\balloy\b|magnet|apparatus|smoke detector|fluoresc|in solution|contains (a few|on the order)|few atoms|museum|on display/i;
const TUBE = /discharge|entladung|^[A-Z][a-z]?Tube\./i;
const CRYSTAL = /crystal|cristal|kristall|dendrit/i;
const BITMAP_EXT = /\.(jpe?g|png|webp)$/i;
const BITMAP_MIME = new Set(['image/jpeg', 'image/png', 'image/webp']);

const log = (...a) => console.log(...a);

// ---------------------------------------------------------------- Wikidata
async function loadElements() {
  const rows = await sparql(`
    SELECT ?z ?item ?sym ?label ?img ?cat WHERE {
      ?item wdt:P31 wd:Q11344; wdt:P1086 ?z; wdt:P246 ?sym .
      ?item rdfs:label ?label FILTER(lang(?label) = 'en')
      OPTIONAL { ?item wdt:P18 ?img }
      OPTIONAL { ?item wdt:P373 ?cat }
      FILTER(?z >= 1 && ?z <= 118)
    } ORDER BY ?z`);
  const byZ = new Map();
  for (const r of rows) {
    const z = Number(r.z.value);
    if (!byZ.has(z)) {
      byZ.set(z, { z, item: r.item.value.split('/').pop(), sym: r.sym.value, name: cap(r.label.value), p18: new Set(), cats: new Set() });
    }
    const e = byZ.get(z);
    if (r.img) e.p18.add('File:' + decodeURIComponent(r.img.value.split('/Special:FilePath/')[1]).replace(/_/g, ' '));
    if (r.cat) e.cats.add(r.cat.value);
  }
  const out = Array.from({ length: 118 }, (_, i) => byZ.get(i + 1));
  const missing = out.map((e, i) => (e ? null : i + 1)).filter(Boolean);
  if (missing.length) throw new Error(`Wikidata returned no item for Z=${missing.join(',')}`);
  for (const e of out) e.match = nameMatcher(e);
  return out;
}

const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);
const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

function nameMatcher(e) {
  const names = [e.name, ...(ALT_NAMES[e.z] || [])].map(esc);
  const byName = new RegExp(`(^|[^a-zà-ÿ])(${names.join('|')})(?=[^a-zà-ÿ]|$)`, 'i');
  const bySymbol = new RegExp(`^${esc(e.sym)}(?=[-,_ .])`); // "Fe,26.jpg", "Hf-crystal bar.jpg", "Ca Ar.png"
  return (fileTitle) => {
    const n = fileTitle.replace(/^File:/, '');
    return byName.test(n) || bySymbol.test(n);
  };
}

// ---------------------------------------------------------------- Commons categories
async function categoryMembers(cat, types = 'file') {
  const out = [];
  let cont = '';
  for (;;) {
    const url = `https://commons.wikimedia.org/w/api.php?action=query&list=categorymembers&cmtitle=${encodeURIComponent(cat)}&cmtype=${encodeURIComponent(types)}&cmlimit=500&format=json${cont}`;
    const data = await getJsonCached(url, 'commons-cat');
    out.push(...(data?.query?.categorymembers || []).map((m) => m.title));
    if (!data?.continue?.cmcontinue) break;
    cont = '&cmcontinue=' + encodeURIComponent(data.continue.cmcontinue);
  }
  return out;
}

// ---------------------------------------------------------------- Scoring
function classify(title, description) {
  const n = title.replace(/^File:/, '');
  const d = description || '';
  if (HARD_NAME.test(n) || HARD_DESC.test(d)) return 'reject';
  if (SOFT_NAME.test(n) || SOFT_DESC.test(d)) return 'other';
  if (TUBE.test(n)) return 'tube';
  if (CRYSTAL.test(n)) return 'crystal';
  return 'sample';
}

function cleanArtist(s) {
  if (!s) return null;
  // extmetadata sometimes carries inline CSS from a {{plainlist}} template.
  const t = s.replace(/\.mw-parser-output[^}]*\}/g, '').replace(/\s+/g, ' ').trim();
  return t || null;
}

const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

function score(c, e) {
  const minSide = Math.min(c.info.width, c.info.height);
  let s = 0;
  if (c.src.has('wikidata')) s += 25;
  if (c.src.has('featured')) s += 30;
  if (c.src.has('quality')) s += 20;
  if (c.src.has('samples')) s += 15;
  if (c.src.has('hires')) s += 10;
  if (/alchemist-hp/i.test(c.artist || '')) s += 15;
  if (c.src.has('category') && c.src.size === 1 && rankName(c.title) >= 2) s += 10; // "metal", "ampoule", "liquid"...
  if (/1 ?cm3|1cm³/i.test(c.title)) s += 10;
  if (c.kind === 'sample' || c.kind === 'crystal') s += 10;
  else if (c.kind === 'tube') s += GASES.has(e.z) ? 10 : -20;
  else s -= 40; // "other": related to the element, but not a sample of it
  s += clamp(10 * Math.log2(minSide / 400), -25, 20);
  if (!c.artist) s -= /public domain|cc0|pd/i.test(c.info.license) ? 5 : 15;
  return Math.round(s * 10) / 10;
}

function makeCandidate(title, info, srcTags) {
  if (!info || !BITMAP_MIME.has(info.mime)) return null;
  if (!licenseOk(info.license)) return null;
  if (Math.min(info.width, info.height) < 150) return null;
  const kind = classify(info.title, info.description);
  if (kind === 'reject') return null;
  return { title: info.title, info, kind, artist: cleanArtist(info.artist), src: new Set(srcTags) };
}

function addCandidate(map, title, info, tags) {
  const key = (info?.title || title);
  if (map.has(key)) { for (const t of tags) map.get(key).src.add(t); return; }
  const c = makeCandidate(title, info, tags);
  if (c) map.set(key, c);
}

function best(e) {
  const list = [...e.candidates.values()].map((c) => ({ ...c, score: score(c, e) }));
  list.sort((a, b) => b.score - a.score || Math.min(b.info.width, b.info.height) - Math.min(a.info.width, a.info.height));
  e.ranked = list;
  return list[0] || null;
}

const isWeak = (c, e) => !c || c.kind === 'other' || (c.kind === 'tube' && !GASES.has(e.z)) || c.score < 40
  || Math.min(c.info.width, c.info.height) < 600 || !c.artist;

// ---------------------------------------------------------------- Main
async function main() {
  const elements = await loadElements();
  for (const e of elements) e.candidates = new Map();
  log(`Wikidata: ${elements.filter((e) => e.p18.size).length} elements with P18`);

  // 2. curated Commons categories
  const [featured, quality, samplesTop, samplesSub] = await Promise.all([
    categoryMembers('Category:Featured pictures of chemical elements'),
    categoryMembers('Category:Quality images of chemical elements'),
    categoryMembers('Category:Element samples'),
    categoryMembers('Category:Element samples', 'subcat'),
  ]);
  const samples = [...samplesTop];
  await pool(samplesSub, CONCURRENCY, async (sub) => { samples.push(...await categoryMembers(sub)); });
  const tagged = new Map(); // title -> { tags:Set, zs:Set }
  const tagAll = (titles, tag) => {
    for (const t of titles) {
      if (!BITMAP_EXT.test(t) || HARD_NAME.test(t.replace(/^File:/, ''))) continue;
      const zs = elements.filter((e) => e.match(t)).map((e) => e.z);
      if (zs.length !== 1) continue; // no match, or a title naming two elements (ambiguous)
      if (!tagged.has(t)) tagged.set(t, { tags: new Set(), zs: new Set() });
      tagged.get(t).tags.add(tag);
      for (const z of zs) tagged.get(t).zs.add(z);
    }
  };
  tagAll(featured, 'featured');
  tagAll(quality, 'quality');
  tagAll(samples, 'samples');
  log(`Commons categories: ${featured.length} featured, ${quality.length} quality, ${samples.length} samples -> ${tagged.size} files matched to an element`);

  // 3. Hi-Res Images of Chemical Elements set
  const hires = new Map(elements.map((e) => [`File:${e.name} (${e.z} ${e.sym}).jpg`, e.z]));

  // 4. metadata for everything so far, one pool of 4
  const titles = new Set([...tagged.keys(), ...hires.keys()]);
  for (const e of elements) for (const t of e.p18) titles.add(t);
  const info = await commonsInfo([...titles]);
  log(`Commons metadata fetched for ${titles.size} files`);

  for (const e of elements) {
    for (const t of e.p18) addCandidate(e.candidates, t, info[t], ['wikidata']);
  }
  for (const [t, { tags, zs }] of tagged) {
    for (const z of zs) addCandidate(elements[z - 1].candidates, t, info[t], [...tags]);
  }
  for (const [t, z] of hires) {
    if (info[t]) addCandidate(elements[z - 1].candidates, t, info[t], ['hires']);
  }

  // 5. the element's own category, only for weak results
  const weak = elements.filter((e) => isWeak(best(e), e) && e.cats.size);
  log(`Consulting the element category for ${weak.length} weak elements: ${weak.map((e) => e.z).join(',')}`);
  const fallbackTitles = new Map(); // title -> z
  await pool(weak, CONCURRENCY, async (e) => {
    for (const cat of e.cats) {
      const files = (await categoryMembers('Category:' + cat))
        .filter((t) => BITMAP_EXT.test(t) && e.match(t) && !HARD_NAME.test(t.replace(/^File:/, '')) && !SOFT_NAME.test(t))
        .filter((t) => elements.filter((e2) => e2.match(t)).length === 1)
        .sort((a, b) => rankName(b) - rankName(a) || a.length - b.length)
        .slice(0, 25);
      for (const t of files) fallbackTitles.set(t, e.z);
    }
  });
  const fbInfo = await commonsInfo([...fallbackTitles.keys()]);
  for (const [t, z] of fallbackTitles) {
    const c = makeCandidate(t, fbInfo[t], ['category']);
    if (c && c.kind !== 'other' && c.artist) addCandidate(elements[z - 1].candidates, t, fbInfo[t], ['category']);
  }

  // 6. overrides
  let overrides = {};
  if (await exists(OVERRIDES)) {
    overrides = JSON.parse(await readFile(OVERRIDES, 'utf8'));
    const files = Object.values(overrides).filter((v) => v && typeof v === 'object' && v.file).map((v) => v.file);
    const oInfo = await commonsInfo(files);
    for (const [k, v] of Object.entries(overrides)) {
      if (k.startsWith('_')) continue;
      const z = Number(k);
      if (!(z >= 1 && z <= 118)) throw new Error(`override key ${k} is not an atomic number`);
      const e = elements[z - 1];
      if (v === null) { e.forcedNull = true; continue; }
      const i = oInfo[v.file];
      if (!i) throw new Error(`override ${k}: ${v.file} not found on Commons`);
      if (!licenseOk(i.license)) throw new Error(`override ${k}: ${v.file} has license "${i.license}", not allowed`);
      if (!BITMAP_MIME.has(i.mime)) throw new Error(`override ${k}: ${v.file} is ${i.mime}, not a bitmap photograph`);
      e.forced = { title: i.title, info: i, kind: v.kind || classify(i.title, i.description), artist: cleanArtist(i.artist), src: new Set(['override']), focus: v.focus };
    }
  }

  // 7. final picks
  const picks = {};
  for (const e of elements) {
    if (e.forcedNull) { e.pick = null; picks[e.z] = null; continue; }
    const c = e.forced || best(e);
    e.pick = c;
    if (!c) { picks[e.z] = null; continue; }
    const { info: i } = c;
    picks[e.z] = {
      file: c.title,
      kind: c.kind === 'other' || c.kind === 'tube' || c.kind === 'crystal' ? c.kind : 'sample',
      hero: thumbUrl(c.title, i, [1280, 960, 500]),
      medium: thumbUrl(c.title, i, [500]),
      w: i.width,
      h: i.height,
      artist: c.artist,
      license: i.license,
      licenseUrl: i.licenseUrl || null,
      page: i.descriptionUrl,
      credit: (i.credit || '').slice(0, 200) || null,
      src: [...c.src].join('+'),
    };
  }

  // 8. tiles
  await mkdir(TILES_DIR, { recursive: true });
  const tileBytes = {};
  const tileFailures = [];
  await pool(elements, CONCURRENCY, async (e) => {
    const out = join(TILES_DIR, `${e.z}.webp`);
    const p = picks[e.z];
    if (!p) { if (await exists(out)) await unlink(out); return; }
    try {
      const buf = await getBytesCached(p.medium, 'commons-thumb');
      const position = focusToPosition(e.pick.focus);
      let q = 70;
      let webp;
      for (;;) {
        webp = await sharp(buf).rotate().resize(TILE, TILE, { fit: 'cover', position }).webp({ quality: q, effort: 6 }).toBuffer();
        if (webp.length <= TILE_MAX_BYTES || q <= 45) break;
        q -= 10;
      }
      await writeFile(out, webp);
      tileBytes[e.z] = webp.length;
    } catch (err) {
      tileFailures.push(`${e.z}: ${err.message}`);
    }
  });

  // 9. JSON
  const data = {
    built: today(),
    source: { name: 'Wikimedia Commons', url: 'https://commons.wikimedia.org/', note: 'per-file licenses below' },
    elements: picks,
  };
  const jsonBytes = await writeJsonCapped(OUT_JSON, data, JSON_CAP);

  // ---------------------------------------------------------------- Report
  const withPhoto = elements.filter((e) => picks[e.z]);
  const kinds = {};
  const licenses = {};
  for (const e of withPhoto) {
    kinds[picks[e.z].kind] = (kinds[picks[e.z].kind] || 0) + 1;
    licenses[picks[e.z].license] = (licenses[picks[e.z].license] || 0) + 1;
  }
  const nulls = elements.filter((e) => !picks[e.z]).map((e) => e.z);
  const totalTiles = Object.values(tileBytes).reduce((a, b) => a + b, 0);
  log('\n== photos.json');
  log(`elements with a photo: ${withPhoto.length}, null: ${nulls.length} (${nulls.join(',')})`);
  log('kinds:', kinds);
  log('licenses:', licenses);
  log(`json bytes: ${jsonBytes}; tiles: ${Object.keys(tileBytes).length} files, ${totalTiles} bytes, max ${Math.max(0, ...Object.values(tileBytes))}`);
  if (tileFailures.length) log('tile failures:', tileFailures);
  log('\n== Z | kind | license | file | score | src');
  for (const e of elements) {
    const p = picks[e.z];
    log(e.z, '|', p ? `${p.kind} | ${p.license} | ${p.file} | ${e.pick.score ?? 'override'} | ${p.src}` : 'null');
  }
  log('\n== curation (weak or doubtful picks)');
  for (const e of withPhoto) {
    const c = e.pick;
    const reasons = [];
    if (c.kind === 'other') reasons.push('kind other');
    if (Math.min(c.info.width, c.info.height) < 600) reasons.push(`low-res ${c.info.width}x${c.info.height}`);
    if (!c.artist) reasons.push('no artist recorded');
    if ([...c.src].every((s) => s === 'category')) reasons.push('from element category only, unverified');
    if (/\b(mine|ore|nugget|coal|native|rock|mineral|matrix)\b/i.test(c.title + ' ' + (c.info.description || ''))) reasons.push('mineral/native specimen?');
    if (reasons.length) log(e.z, e.name, '|', c.title, '|', reasons.join('; '), '|', (c.info.description || '').slice(0, 140));
  }
}

// Commons serves hotlinked thumbnails only at standard widths (20..3840, see
// https://www.mediawiki.org/wiki/Common_thumbnail_sizes) and never upscales: take the largest
// standard width below the original width, or the original file itself.
function thumbUrl(title, info, widths) {
  const w = widths.find((x) => x < info.width);
  return w ? commonsThumb(title, w) : info.url.replace(/\?.*$/, ''); // the API adds utm_ tracking params
}

function rankName(t) {
  let r = 0;
  if (/sample|metal|pure|crystal|ampoule|ampule|vial|piece|chunk|\bbar\b|\brod\b|ingot|liquid|pour|drop|cube|pellet/i.test(t)) r += 2;
  if (/\(element - \d+\)/i.test(t)) r -= 1; // museum-case series: often a placard or a host mineral
  return r;
}

function focusToPosition(focus) {
  const map = { center: 'centre', centre: 'centre', top: 'top', bottom: 'bottom', left: 'left', right: 'right' };
  return map[focus] || 'attention';
}

await main();
