// Spanish Wikipedia intros for every element. CC BY-SA. Resumable.
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { ES } from './names.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const outPath = join(root, 'src/data/summaries-es.json');
const UA = 'TablaViva/1.0 (https://github.com/vdm285/interactive-science; educational)';
let saved = {};
try { saved = JSON.parse(await readFile(outPath, 'utf8')); } catch { saved = {}; }

const WIKI = {
  30: ['Zinc', 'Cinc'],
  36: ['Criptón', 'Kriptón'],
  40: ['Circonio', 'Zirconio'],
  49: ['Indio (elemento)', 'Indio'],
  53: ['Yodo', 'Iodo'],
  73: ['Tántalo (elemento)', 'Tántalo'],
  74: ['Wolframio', 'Tungsteno'],
  80: ['Mercurio (elemento)', 'Mercurio'],
  88: ['Radio (elemento)', 'Radio'],
};

async function summary(title) {
  const url = `https://es.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(title.replace(/ /g, '_'))}`;
  const res = await fetch(url, { headers: { 'User-Agent': UA, 'Api-User-Agent': UA } });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`${res.status} ${title}`);
  const data = await res.json();
  if (!data.extract || data.type === 'disambiguation') return null;
  return {
    title: data.title,
    extract: data.extract,
    url: data.content_urls?.desktop?.page || '',
  };
}

let filled = 0;
for (let z = 1; z <= 118; z++) {
  if (saved[String(z)]?.extract) { filled += 1; continue; }
  const titles = WIKI[z] || ES[z];
  let page = null;
  for (const title of titles) {
    page = await summary(title);
    if (page) break;
  }
  if (page) {
    saved[String(z)] = page;
    filled += 1;
  } else {
    console.log('missing', z, titles[0]);
  }
  if (z % 20 === 0) await writeFile(outPath, JSON.stringify(saved));
  await new Promise((r) => setTimeout(r, 70));
}
await mkdir(dirname(outPath), { recursive: true });
await writeFile(outPath, JSON.stringify(saved));
console.log(`spanish summaries ${filled}/118`);
