// The two fixed controls (lens top-left, cog bottom-left), the search box and the settings sheet.
// Nothing else is fixed on screen; everything less than constant lives inside Settings.

import { html, nothing } from 'lit';
import { classMap } from 'lit/directives/class-map.js';
import { state, set, savePrefs, forgetSeen } from './store.js';
import { COPY } from './i18n.js';
import { searchElements } from '../logic.js';
import { openElement } from './router.js';

const t = () => COPY[state.lang];
const nameOf = (e) => e.name[state.lang] || e.name.en;

export function openSearch() {
  set({ search: { open: true, q: '', hits: [] } });
  requestAnimationFrame(() => document.getElementById('q')?.focus());
}

function onSearchInput(ev) {
  const q = ev.target.value;
  set({ search: { open: true, q, hits: searchElements(state.elements, q, 8) } });
}

function onSearchKey(ev) {
  if (ev.key === 'Escape') { set({ search: { open: false, q: '', hits: [] } }); ev.stopPropagation(); }
  if (ev.key === 'Enter') {
    const hit = state.search.hits[0];
    if (hit) { openElement(hit.z); set({ search: { open: false, q: '', hits: [] } }); }
  }
}

export function searchView(s) {
  const c = t();
  if (!s.search.open) {
    return html`<button type="button" class="corner lens-btn" aria-label=${c.search} title=${`${c.search} ( / )`} @click=${openSearch}>
      <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true"><circle cx="10.5" cy="10.5" r="6.5" fill="none" stroke="currentColor" stroke-width="2"/><path d="M15.5 15.5 21 21" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>
    </button>`;
  }
  return html`<div class="search" role="search">
    <input id="q" type="search" autocomplete="off" spellcheck="false" placeholder=${c.search} aria-label=${c.search} .value=${s.search.q} @input=${onSearchInput} @keydown=${onSearchKey} @blur=${() => setTimeout(() => { if (!document.activeElement?.closest('.search')) set({ search: { open: false, q: '', hits: [] } }); }, 120)}>
    ${s.search.q ? html`<ul class="hits">
      ${s.search.hits.length ? s.search.hits.map((e) => html`<li><button type="button" @click=${() => { openElement(e.z); set({ search: { open: false, q: '', hits: [] } }); }}><span class="mono">${e.symbol}</span> ${nameOf(e)} <span class="dim">${e.z}</span></button></li>`) : html`<li class="none">${c.noHits}</li>`}
    </ul>` : nothing}
  </div>`;
}

function toggle(key, label, s) {
  return html`<label class="row"><span>${label}</span><input type="checkbox" .checked=${!!s[key]} @change=${(ev) => { set({ [key]: ev.target.checked }); savePrefs(); }}></label>`;
}

export function settingsView(s) {
  const c = t();
  const seenCount = Object.keys(s.seen).length;
  return html`
    <button type="button" class=${classMap({ corner: true, 'cog-btn': true, on: s.settings })} aria-label=${c.settings} title=${c.settings} @click=${() => set({ settings: !s.settings })}>
      <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true"><path fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round" d="M12 8.5a3.5 3.5 0 1 0 0 7 3.5 3.5 0 0 0 0-7Zm7.4 3.5c0-.5 0-1-.1-1.4l2-1.5-1.9-3.3-2.3 1a7.6 7.6 0 0 0-2.4-1.4L14.3 3H9.7l-.4 2.4a7.6 7.6 0 0 0-2.4 1.4l-2.3-1-1.9 3.3 2 1.5a8 8 0 0 0 0 2.8l-2 1.5 1.9 3.3 2.3-1a7.6 7.6 0 0 0 2.4 1.4l.4 2.4h4.6l.4-2.4a7.6 7.6 0 0 0 2.4-1.4l2.3 1 1.9-3.3-2-1.5c.1-.4.1-.9.1-1.4Z"/></svg>
    </button>
    ${s.settings ? html`<aside class="sheet" aria-label=${c.settings}>
      <header><h2>${c.settings}</h2><button type="button" class="x" aria-label=${c.close} @click=${() => set({ settings: false })}>×</button></header>
      <div class="row"><span>${c.language}</span>
        <span class="seg">
          <button type="button" class=${classMap({ on: s.lang === 'es' })} @click=${() => { set({ lang: 'es' }); savePrefs(); document.documentElement.lang = 'es'; }}>Español</button>
          <button type="button" class=${classMap({ on: s.lang === 'en' })} @click=${() => { set({ lang: 'en' }); savePrefs(); document.documentElement.lang = 'en'; }}>English</button>
        </span></div>
      ${toggle('photosOn', c.photosOn, s)}
      ${toggle('motion', c.motion, s)}
      <div class="row"><span>${c.seen} <span class="dim">${c.seenCount(seenCount)}</span></span><button type="button" class="ghost" ?disabled=${!seenCount} @click=${forgetSeen}>${c.forget}</button></div>
      <p class="dim small">${c.keys}</p>
      <h3>${c.about}</h3>
      <p>${c.aboutText}</p>
      <h3>${c.sourcesTitle}</h3>
      <ul class="sources">
        ${s.sources.map((src) => html`<li><a href=${src.url} target="_blank" rel="noreferrer">${src.name}</a> <span class="dim">· ${src.license}</span></li>`)}
        ${s.spectra ? html`<li><a href=${s.spectra.source.url} target="_blank" rel="noreferrer">${s.spectra.source.name}</a> <span class="dim">· ${s.spectra.source.license}</span></li>` : nothing}
        ${s.isotopes ? html`<li><a href=${s.isotopes.source.url} target="_blank" rel="noreferrer">${s.isotopes.source.name}</a> <span class="dim">· IAEA terms of use, acknowledgment</span></li>` : nothing}
        ${s.history ? html`<li><a href=${s.history.source.url} target="_blank" rel="noreferrer">${s.history.source.name}</a> <span class="dim">· ${s.history.source.license}</span></li>` : nothing}
        ${s.abundance ? html`<li><a href=${s.abundance.source.page} target="_blank" rel="noreferrer">Wikipedia, Abundances of the elements (data page)</a> <span class="dim">· ${s.abundance.source.license}</span></li>` : nothing}
        <li><a href="https://es.wikipedia.org/" target="_blank" rel="noreferrer">Wikipedia</a> <span class="dim">· CC BY-SA 4.0</span></li>
        <li><a href="https://commons.wikimedia.org/" target="_blank" rel="noreferrer">Wikimedia Commons</a> <span class="dim">· ${s.lang === 'es' ? 'licencia por archivo, indicada junto a cada imagen' : 'per-file license, shown next to each image'}</span></li>
      </ul>
      <p class="dim small"><a href="https://github.com/vdm285/interactive-science" target="_blank" rel="noreferrer">github.com/vdm285/interactive-science</a> · MIT</p>
    </aside>` : nothing}`;
}
