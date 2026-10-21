// Spanish and English introductions for every element from Wikipedia's REST summary
// endpoint, plus a Spanish pronunciation recording from Lingua Libre on Commons.
// Writes public/data/wiki/{z}.json (one per element) and public/data/wiki/index.json.
// Everything fetched is cached under data/cache/ (on D:, gitignored). Run: npm run wiki
//
// Text is CC BY-SA 4.0 (Wikipedia); each recording's license is checked with licenseOk.

import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { ES } from './names.mjs';
import { getJsonCached, commonsInfo, licenseOk, writeJsonCapped, pool, root, today } from './net.mjs';

const OUT = join(root, 'public/data/wiki');
const PER_FILE_CAP = 14 * 1024;
const INDEX_CAP = 10 * 1024;
const IN_FLIGHT = 4;

// Spanish Wikipedia titles that differ from the display name (the plain name is a
// disambiguation page or a different article).
export const ES_TITLES = {
  30: 'Zinc', 36: 'Criptón', 40: 'Circonio', 49: 'Indio (elemento)', 53: 'Yodo',
  73: 'Tántalo (elemento)', 74: 'Wolframio', 80: 'Mercurio (elemento)', 88: 'Radio (elemento)',
};

// English Wikipedia titles where the plain element name is a disambiguation page.
export const EN_TITLES = { 80: 'Mercury (element)' };

async function loadEnglishNames() {
  for (const rel of ['public/data/elements.json']) {
    try {
      const data = JSON.parse(await readFile(join(root, rel), 'utf8'));
      const list = Array.isArray(data) ? data : data.elements;
      const out = {};
      for (const e of list) out[e.z] = EN_TITLES[e.z] || e.name?.en || e.name;
      if (Object.keys(out).length === 118) return out;
    } catch { /* try the next file */ }
  }
  throw new Error('No elements file with English names found');
}

export function esTitleCandidates(z) {
  const names = ES[z];
  const list = [];
  if (ES_TITLES[z]) list.push(ES_TITLES[z]);
  for (const n of names) {
    const cap = n[0].toUpperCase() + n.slice(1);
    if (!list.includes(cap)) list.push(cap);
  }
  return list;
}

const stripUtm = (url) => (url ? url.replace(/\?utm_.*$/, '') : url);

async function summary(lang, title) {
  const url = `https://${lang}.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(title.replace(/ /g, '_'))}`;
  const data = await getJsonCached(url, 'wiki-summary');
  if (!data) return { status: 'missing' };
  if (data.type === 'disambiguation') return { status: 'disambiguation', title: data.title };
  if (data.type !== 'standard' || !data.extract) return { status: data.type || 'empty', title: data.title };
  return {
    status: 'ok',
    page: {
      title: data.title,
      extract: data.extract.trim(),
      url: data.content_urls?.desktop?.page || `https://${lang}.wikipedia.org/wiki/${encodeURIComponent(data.title.replace(/ /g, '_'))}`,
      description: data.description || null,
    },
  };
}

// Lingua Libre files are named "LL-Q1321 (spa)-<speaker>-<word>.wav". We search Commons
// for the word and keep only files whose final segment is exactly the lowercase name.
const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

async function findPronunciation(z) {
  const words = [...new Set(ES[z].map((n) => n.toLowerCase()))];
  for (const word of words) {
    const q = `"LL-Q1321 (spa)" ${word}`;
    const url = `https://commons.wikimedia.org/w/api.php?action=query&list=search&srnamespace=6&srlimit=50&format=json&srsearch=${encodeURIComponent(q)}`;
    const data = await getJsonCached(url, 'commons-search');
    const hits = (data?.query?.search || []).map((h) => h.title);
    const exact = new RegExp(`^File:LL-Q1321 \\(spa\\)-.+-${esc(word)}\\.(wav|ogg|flac|mp3)$`);
    const loose = new RegExp(`^File:LL-Q1321 \\(spa\\)-.+-${esc(word)}\\.(wav|ogg|flac|mp3)$`, 'i');
    const candidates = [...hits.filter((t) => exact.test(t)), ...hits.filter((t) => loose.test(t) && !exact.test(t))];
    if (!candidates.length) continue;
    const info = await commonsInfo(candidates);
    for (const title of candidates) {
      const meta = info[title];
      if (!meta || !licenseOk(meta.license) || !/^audio\//.test(meta.mime || '')) continue;
      return {
        file: meta.title,
        url: stripUtm(meta.url),
        artist: meta.artist,
        license: meta.license,
        licenseUrl: meta.licenseUrl,
        page: meta.descriptionUrl,
        word,
      };
    }
  }
  return null;
}

async function buildOne(z, enName, log) {
  let es = null;
  const esNotes = [];
  for (const title of esTitleCandidates(z)) {
    const r = await summary('es', title);
    if (r.status === 'ok') { es = r.page; break; }
    esNotes.push(`${title}: ${r.status}`);
  }
  let en = null;
  const enR = await summary('en', enName);
  if (enR.status === 'ok') en = enR.page;
  else log.push(`${z} en ${enName}: ${enR.status}`);
  if (!es) log.push(`${z} es: ${esNotes.join('; ')}`);
  else if (esNotes.length) log.push(`${z} es fell back to "${es.title}" (${esNotes.join('; ')})`);

  const pronunciation = await findPronunciation(z);
  const doc = { z, generated: today(), textLicense: 'CC BY-SA 4.0', es, en, pronunciation };
  const bytes = await writeJsonCapped(join(OUT, `${z}.json`), doc, PER_FILE_CAP);
  return { es: !!es, en: !!en, pron: !!pronunciation, bytes, doc };
}

const enNames = await loadEnglishNames();
const zs = Array.from({ length: 118 }, (_, i) => i + 1);
const results = {};
const log = [];
await pool(zs, IN_FLIGHT, async (z) => {
  results[z] = await buildOne(z, enNames[z], log);
});

const index = { generated: today(), textLicense: 'CC BY-SA 4.0', elements: {} };
let total = 0;
for (const z of zs) {
  const r = results[z];
  index.elements[z] = { es: r.es, en: r.en, pron: r.pron };
  total += r.bytes;
}
total += await writeJsonCapped(join(OUT, 'index.json'), index, INDEX_CAP);

const count = (k) => zs.filter((z) => results[z][k]).length;
const licenses = {};
for (const z of zs) {
  const p = results[z].doc.pronunciation;
  if (p) licenses[p.license] = (licenses[p.license] || 0) + 1;
}
console.log(`wiki: es ${count('es')}/118, en ${count('en')}/118, pronunciation ${count('pron')}/118 ${JSON.stringify(licenses)}`);
console.log(`wiki: ${total} bytes in ${OUT}`);
for (const line of log) console.log('  note:', line);
const noPron = zs.filter((z) => !results[z].pron);
if (noPron.length) console.log('  no pronunciation:', noPron.map((z) => `${z} ${ES[z][0]}`).join(', '));
