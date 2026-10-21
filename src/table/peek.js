// The peek: the table stays as a band on top, and the chosen element's world opens beneath it. Wide
// exploration happens here (tap another tile, arrow keys); the doors and the second tap go deep.

import { html, nothing } from 'lit';
import { styleMap } from 'lit/directives/style-map.js';
import { state } from '../app/store.js';
import { COPY } from '../app/i18n.js';
import { fmt, phaseAt, cToKelvin } from '../logic.js';
import { photoOf, spectrumOf, isotopesOf, abundanceOf, videoOf, tileUrl } from '../data/load.js';
import { atomSvg } from '../draw/atom.js';
import { stripDataUrl } from '../draw/spectrum.js';
import { FAMILY_COLOR, discoveryYear } from './lenses.js';
import { availablePanels } from '../element/deck.js';
import { galleryItems, thingsOf } from '../element/panels.js';
import { dive } from '../app/transitions.js';

const t = () => COPY[state.lang];
const nameOf = (e) => e.name[state.lang] || e.name.en;

function doorBody(p, e, s) {
  const c = t();
  switch (p) {
    case 'materia': {
      const photo = photoOf(e.z);
      return photo ? html`<img src=${tileUrl(e.z)} alt="">` : html`<span class="door-big">${e.symbol}</span>`;
    }
    case 'luz': {
      const sp = spectrumOf(e.z);
      const url = sp?.bins ? stripDataUrl(e.z, sp.bins) : null;
      return html`<span class="door-strip" style=${styleMap({ backgroundImage: url ? `url(${url})` : 'none' })}></span><small>${fmt(sp?.count, s.lang, 0)} ${c.lines.split(' ')[0]}</small>`;
    }
    case 'atomo':
      return html`<span class="door-atom">${atomSvg(e, { animate: false, size: 120, color: FAMILY_COLOR[e.family] })}</span>`;
    case 'nucleo': {
      const iso = isotopesOf(e.z);
      return iso ? html`<span class="door-big">${iso.known}</span><small>${c.isotopesKnown} · ${iso.stable ? `${iso.stable} ${c.stableN}` : c.noneStable}</small>` : nothing;
    }
    case 'historia': {
      const y = discoveryYear(e);
      return html`<span class="door-big">${e.ancient || (y != null && y < 1660) ? (s.lang === 'es' ? 'Antig.' : 'Anc.') : (y ?? '—')}</span>`;
    }
    case 'mundo': {
      const a = abundanceOf(e.z);
      return a?.crust != null ? html`<span class="door-big">${fmt(a.crust, s.lang, 3)}</span><small>mg/kg · ${c.crust.toLowerCase()}</small>` : nothing;
    }
    case 'imagenes': {
      const items = galleryItems(e.z);
      const n = s.galleryIndex?.elements?.[String(e.z)] ?? s.galleryIndex?.[String(e.z)] ?? items.length;
      return html`${items[0] ? html`<img src=${items[0].thumb} alt="" loading="lazy">` : nothing}<small>${n || ''}</small>`;
    }
    case 'cosas': {
      const th = thingsOf(e.z);
      const n = s.thingsIndex?.counts?.[String(e.z)];
      const first = th?.minerals.find((m) => m.photo) || th?.objects.find((o) => o.photo);
      const label = n ? `${n.minerals} ${c.minerals.split(' ')[0].toLowerCase()} · ${n.objects} ${c.objects.split(' ')[0].toLowerCase()}` : '';
      return html`${first ? html`<img src=${first.photo.thumb} alt="" loading="lazy">` : nothing}<small>${label}</small>`;
    }
    case 'video': {
      const v = videoOf(e.z);
      return v ? html`<img src=${v.thumb} alt="" loading="lazy"><small>Periodic Videos</small>` : nothing;
    }
    case 'datos':
      return html`<span class="door-big mono">${fmt(e.mass, s.lang, 3)}</span><small>u</small>`;
    default:
      return nothing;
  }
}

export function peekView(s) {
  const e = s.byZ.get(s.z);
  if (!e) return nothing;
  const c = t();
  const photo = s.photosOn ? photoOf(e.z) : null;
  const wiki = s.wiki.get(e.z);
  const w = wiki?.[s.lang] || wiki?.es || wiki?.en;
  const phase = phaseAt(e, cToKelvin(25)).phase;
  const fam = FAMILY_COLOR[e.family];
  const panels = availablePanels(e, s);
  return html`<section class="peek" style=${styleMap({ '--swatch': fam })} @click=${(ev) => { if (ev.target.closest('.peek-hero')) dive(e.z, 'materia'); }}>
    <div class="peek-hero" title=${c.enter}>
      ${photo
        ? html`<img src=${photo.medium} alt=${nameOf(e)} decoding="async">`
        : html`<div class="peek-model">${atomSvg(e, { animate: s.motion, size: 360, color: fam })}</div>`}
      ${photo ? html`<a class="credit" href=${photo.page} target="_blank" rel="noreferrer" @click=${(ev) => ev.stopPropagation()}>${c.photoBy}: ${photo.artist || 'Wikimedia Commons'} · ${photo.license}</a>` : nothing}
    </div>
    <div class="peek-text">
      <p class="eyebrow">${c.family[e.family]}${e.familyUncertain ? html` <span class="dim">· ${c.familyUncertain}</span>` : nothing} · ${c.phase[phase]} ${c.at} 25 °C</p>
      <h1>${nameOf(e)}</h1>
      <p class="capsule"><span class="sym">${e.symbol}</span><span>${e.z} ${c.protons}</span><span>${fmt(e.mass, s.lang, 4)} u</span>${w?.description ? html`<span class="desc">${w.description}</span>` : nothing}</p>
      ${!photo ? html`<p class="dim small">${c.bohr} ${e.z > 100 ? c.noPhotoHeavy : c.noPhoto}</p>` : nothing}
      ${wiki?.pronunciation ? html`<button type="button" class="ghost small" @click=${() => new Audio(wiki.pronunciation.url).play()} title=${`${wiki.pronunciation.artist || 'Lingua Libre'} · ${wiki.pronunciation.license}`}>▶ ${c.pronounce}</button>` : nothing}
      <div class="doors">
        ${panels.map((p) => html`<button type="button" class="door" @click=${() => dive(e.z, p)} title=${c.panels[p]}>
          <span class="door-label">${c.panels[p]}</span>
          <span class="door-body">${doorBody(p, e, s)}</span>
        </button>`)}
      </div>
      <p class="hint dim small">${c.diveHint}</p>
    </div>
  </section>`;
}
