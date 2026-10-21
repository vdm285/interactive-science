// Shared helpers for the build scripts in tools/: polite fetch with retries,
// a disk cache in data/cache/ (gitignored, on D:), a small worker pool,
// Wikidata SPARQL, Commons metadata, and tiny utilities. Every pipeline imports from here.

import { mkdir, readFile, writeFile, access } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

export const root = join(dirname(fileURLToPath(import.meta.url)), '..');
export const UA = 'Materia/2.0 (https://github.com/vdm285/interactive-science; educational static site)';
export const cacheDir = join(root, 'data/cache');

export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export async function exists(path) {
  try { await access(path); return true; } catch { return false; }
}

export async function pool(items, size, fn) {
  let cursor = 0;
  async function worker() {
    while (cursor < items.length) {
      const i = cursor;
      cursor += 1;
      await fn(items[i], i);
    }
  }
  await Promise.all(Array.from({ length: Math.min(size, items.length) }, worker));
}

// fetch with retries on 429/5xx and network errors. Honors Retry-After.
export async function fetchRetry(url, init = {}, tries = 5) {
  let wait = 2000;
  for (let attempt = 1; ; attempt += 1) {
    let res;
    try {
      res = await fetch(url, { ...init, headers: { 'User-Agent': UA, 'Api-User-Agent': UA, ...(init.headers || {}) } });
    } catch (err) {
      if (attempt >= tries) throw err;
      await sleep(wait);
      wait *= 2;
      continue;
    }
    if (res.ok) return res;
    const retryable = res.status === 429 || res.status >= 500;
    if (!retryable || attempt >= tries) {
      throw new Error(`${res.status} ${res.statusText} ${url.slice(0, 160)}`);
    }
    const after = Number(res.headers.get('retry-after'));
    await sleep(Number.isFinite(after) && after > 0 ? after * 1000 : wait);
    wait *= 2;
  }
}

function cachePath(sub, key, ext) {
  return join(cacheDir, sub, `${createHash('sha1').update(key).digest('hex').slice(0, 16)}.${ext}`);
}

// GET text, cached on disk under data/cache/<sub>/.
export async function getTextCached(url, sub, headers = {}) {
  const path = cachePath(sub, url, 'txt');
  await mkdir(dirname(path), { recursive: true });
  if (await exists(path)) return readFile(path, 'utf8');
  const res = await fetchRetry(url, { headers });
  const text = await res.text();
  await writeFile(path, text);
  return text;
}

// GET JSON, cached on disk under data/cache/<sub>/. A 404 returns null (and is cached as null).
export async function getJsonCached(url, sub, headers = { Accept: 'application/json' }) {
  const path = cachePath(sub, url, 'json');
  await mkdir(dirname(path), { recursive: true });
  if (await exists(path)) return JSON.parse(await readFile(path, 'utf8'));
  let res;
  try {
    res = await fetchRetry(url, { headers });
  } catch (err) {
    if (String(err.message).startsWith('404')) { await writeFile(path, 'null'); return null; }
    throw err;
  }
  const text = await res.text();
  const data = JSON.parse(text);
  await writeFile(path, text);
  return data;
}

// GET binary, cached on disk. Returns a Buffer.
export async function getBytesCached(url, sub) {
  const path = cachePath(sub, url, 'bin');
  await mkdir(dirname(path), { recursive: true });
  if (await exists(path)) return readFile(path);
  const res = await fetchRetry(url);
  const buf = Buffer.from(await res.arrayBuffer());
  await writeFile(path, buf);
  return buf;
}

// Wikidata SPARQL (POST so long VALUES lists fit), cached by query text.
export async function sparql(query, sub = 'wikidata') {
  const path = cachePath(sub, query, 'json');
  await mkdir(dirname(path), { recursive: true });
  if (await exists(path)) return JSON.parse(await readFile(path, 'utf8')).results.bindings;
  const res = await fetchRetry('https://query.wikidata.org/sparql', {
    method: 'POST',
    headers: {
      Accept: 'application/sparql-results+json',
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({ query }).toString(),
  });
  const text = await res.text();
  const data = JSON.parse(text);
  await writeFile(path, text);
  return data.results.bindings;
}

// Commons file metadata (license, author, credit) for a list of "File:..." titles. Cached per title.
export async function commonsInfo(titles) {
  const out = {};
  await pool(titles, 4, async (title) => {
    const url = `https://commons.wikimedia.org/w/api.php?action=query&prop=imageinfo&iiprop=url|size|mime|extmetadata&iiextmetadatafilter=LicenseShortName|License|LicenseUrl|Artist|Credit|AttributionRequired|ImageDescription|DateTimeOriginal|UsageTerms&format=json&titles=${encodeURIComponent(title)}`;
    const data = await getJsonCached(url, 'commons-info');
    const page = Object.values(data?.query?.pages || {})[0];
    const info = page?.imageinfo?.[0];
    if (!info) { out[title] = null; return; }
    const meta = info.extmetadata || {};
    const get = (k) => meta[k]?.value ?? null;
    out[title] = {
      title: page.title,
      url: info.url,
      descriptionUrl: info.descriptionurl,
      width: info.width,
      height: info.height,
      mime: info.mime,
      license: get('LicenseShortName'),
      licenseUrl: get('LicenseUrl'),
      artist: stripHtml(get('Artist')),
      credit: stripHtml(get('Credit')),
      description: stripHtml(get('ImageDescription')),
      usageTerms: get('UsageTerms'),
    };
  });
  return out;
}

// Licenses we may show. Anything else is dropped at build time.
// Accepts CC0, CC BY, CC BY-SA (any version, any port), public domain marks, FAL, GFDL. Rejects NC and ND.
export function licenseOk(shortName) {
  if (!shortName) return false;
  const s = String(shortName).trim();
  if (/\bnc\b|\bnd\b/i.test(s)) return false;
  return /^(cc0|cc[- ]by(-sa)?\b|public domain|pd\b|pd-|fal\b|gfdl|attribution|no restrictions)/i.test(s);
}

// Wikimedia only serves hotlinked thumbnails at these widths (https://www.mediawiki.org/wiki/Common_thumbnail_sizes,
// enforced since 2026, task T414805); any other width answers 400. Requests are snapped up to the next standard size.
export const THUMB_STEPS = [20, 40, 60, 120, 250, 330, 500, 960, 1280, 1920, 3840];
export function thumbStep(width) {
  return THUMB_STEPS.find((w) => w >= width) || THUMB_STEPS.at(-1);
}

// Thumbnail URL on upload.wikimedia.org for a Commons file at a standard width.
export function commonsThumb(fileTitle, requestedWidth) {
  const width = thumbStep(requestedWidth);
  const name = fileTitle.replace(/^File:/, '').replace(/ /g, '_');
  const md5 = createHash('md5').update(name).digest('hex');
  const needsPng = /\.(svg|tif|tiff|pdf|gif)$/i.test(name);
  const suffix = needsPng ? '.png' : '';
  return `https://upload.wikimedia.org/wikipedia/commons/thumb/${md5[0]}/${md5.slice(0, 2)}/${encodeURIComponent(name)}/${width}px-${encodeURIComponent(name)}${suffix}`;
}

export function stripHtml(html) {
  if (html == null) return null;
  return String(html).replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim() || null;
}

export const today = () => new Date().toISOString().slice(0, 10);

export function round(n, d) {
  if (n == null || Number.isNaN(Number(n))) return null;
  const f = 10 ** d;
  return Math.round(Number(n) * f) / f;
}

// Write JSON and refuse to exceed a byte cap: the repo stays small on purpose.
export async function writeJsonCapped(path, data, maxBytes, pretty = false) {
  const text = pretty ? JSON.stringify(data, null, 1) : JSON.stringify(data);
  const bytes = Buffer.byteLength(text);
  if (bytes > maxBytes) throw new Error(`${path} is ${bytes} bytes, over the cap of ${maxBytes}`);
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, text);
  return bytes;
}
