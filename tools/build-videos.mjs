// The Periodic Table of Videos episode for each element -> public/data/videos.json (cap 60 KB).
//
// Source: the series' own site, one page per element at http://www.periodicvideos.com/videos/{ZZZ}.htm
// (three digits, zero-padded). Each page embeds its YouTube video in a single
// <iframe src="https://www.youtube.com/embed/{id}">. The site is fetched over plain HTTP on purpose:
// its HTTPS certificate is issued to the hosting provider (*.stackcp.com), not to periodicvideos.com,
// so TLS fails for every client. Nothing is taken from the HTML except the video id and the page URL.
//
// Every id is then verified, keylessly, with YouTube's oEmbed endpoint, which answers 200 with the title,
// author_name (channel) and thumbnail for a public video and 404/401 otherwise. Only ids whose channel is
// "Periodic Videos" survive. The app embeds them with the privacy-enhanced player
// (https://www.youtube-nocookie.com/embed/{id}) on click; nothing is downloaded or re-hosted.
//
// If a page carries more than one YouTube id, the first one embedded is the entry and the rest go in `more`.
// Overrides: data/overrides/videos.json ({ "26": { "id": "...", "note": "..." } } forces an id, null removes).
// Run: node tools/build-videos.mjs. Pages and oEmbed answers cache in data/cache/.

import { join } from 'node:path';
import { readFile } from 'node:fs/promises';
import { getTextCached, getJsonCached, writeJsonCapped, exists, sleep, root, today } from './net.mjs';

const OUT = join(root, 'public/data/videos.json');
const OVERRIDES = join(root, 'data/overrides/videos.json');
const CAP = 60 * 1024;
const SITE = 'http://www.periodicvideos.com/';
const CHANNEL = 'Periodic Videos';
const CHANNEL_URL = 'https://www.youtube.com/@periodicvideos';
const CHECK = { 26: 'Fe', 6: 'C', 80: 'Hg', 74: 'W', 118: 'Og' };

const pageUrl = (z) => `${SITE}videos/${String(z).padStart(3, '0')}.htm`;

// Fetch through the cache; when the call took long enough to have touched the network, wait before the next one.
async function polite(fn, ms) {
  const t0 = Date.now();
  const out = await fn();
  if (Date.now() - t0 > 50) await sleep(ms);
  return out;
}

// Every YouTube video id on a page, in document order, first the embed iframes, then plain links.
function idsIn(html) {
  const ids = [];
  const re = /(?:youtube(?:-nocookie)?\.com\/(?:embed\/|watch\?(?:[^"'<>\s]*&)?v=|v\/)|youtu\.be\/)([A-Za-z0-9_-]{11})/g;
  for (const m of html.matchAll(re)) if (!ids.includes(m[1])) ids.push(m[1]);
  return ids;
}

async function oembed(id) {
  const url = `https://www.youtube.com/oembed?url=${encodeURIComponent(`https://www.youtube.com/watch?v=${id}`)}&format=json`;
  try {
    return await polite(() => getJsonCached(url, 'youtube-oembed'), 500);
  } catch (err) {
    if (/^(401|403)/.test(String(err.message))) return null; // private or embedding disabled: not usable
    throw err;
  }
}

const overrides = (await exists(OVERRIDES)) ? JSON.parse(await readFile(OVERRIDES, 'utf8')) : {};
const elements = {};
const channelsSeen = new Set();
const problems = [];
let pagesMissing = 0;

for (let z = 1; z <= 118; z += 1) {
  const key = String(z);
  const page = pageUrl(z);
  let ids = [];
  let pageOk = false;
  try {
    const html = await polite(() => getTextCached(page, 'periodicvideos'), 1000);
    pageOk = true;
    ids = idsIn(html);
    if (ids.length === 0) problems.push(`${key}: page has no YouTube id`);
  } catch (err) {
    pagesMissing += 1;
    problems.push(`${key}: page ${err.message.slice(0, 60)}`);
  }

  const forced = Object.hasOwn(overrides, key) ? overrides[key] : undefined;
  if (forced === null) { elements[key] = null; continue; }
  if (forced?.id) ids = [forced.id, ...ids.filter((i) => i !== forced.id)];

  // Verify each id; keep the series' channel only (an override still has to exist on YouTube).
  const good = [];
  for (const id of ids) {
    const info = await oembed(id);
    if (!info) { problems.push(`${key}: ${id} not public (oEmbed)`); continue; }
    channelsSeen.add(info.author_name);
    const isForced = forced?.id === id;
    if (info.author_name !== CHANNEL && !isForced) { problems.push(`${key}: ${id} belongs to "${info.author_name}", skipped`); continue; }
    if (info.author_name !== CHANNEL && isForced) problems.push(`${key}: override ${id} belongs to "${info.author_name}", kept because forced`);
    good.push({ id, title: info.title, channel: info.author_name, thumb: info.thumbnail_url });
  }

  if (good.length === 0) { elements[key] = null; continue; }
  const [first, ...rest] = good;
  const entry = { ...first, page: pageOk ? page : undefined };
  if (!pageOk) delete entry.page;
  if (rest.length) entry.more = rest.map((r) => r.id);
  if (forced?.note) entry.note = forced.note;
  elements[key] = entry;
}

const data = {
  built: today(),
  source: {
    name: 'The Periodic Table of Videos (University of Nottingham, Brady Haran)',
    site: SITE,
    channel: CHANNEL,
    channelUrl: CHANNEL_URL,
    terms: 'Videos are embedded from YouTube with the privacy-enhanced player and belong to their creators; nothing is downloaded or re-hosted.',
  },
  elements,
};

const bytes = await writeJsonCapped(OUT, data, CAP);
const have = Object.values(elements).filter(Boolean).length;
const missing = Object.entries(elements).filter(([, v]) => !v).map(([k]) => k);
const withMore = Object.entries(elements).filter(([, v]) => v?.more).map(([k, v]) => `${k}(+${v.more.length})`);
console.log(`videos.json: ${bytes} bytes, ${have}/118 elements, missing: ${missing.join(', ') || 'none'}; pages unreachable: ${pagesMissing}`);
console.log(`channels seen in oEmbed: ${[...channelsSeen].join(' | ')}`);
console.log(`entries with more than one id: ${withMore.join(', ') || 'none'}`);
for (const [z, sym] of Object.entries(CHECK)) {
  const e = elements[z];
  console.log(`  ${sym.padEnd(2)} ${z.padStart(3)}: ${e ? `${e.id}  "${e.title}"  ${e.channel}` : 'null'}`);
}
if (problems.length) console.log('notes:\n  ' + problems.join('\n  '));
