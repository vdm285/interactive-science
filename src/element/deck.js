// An element as a deck of full-screen panels passed sideways, with a shelf of panel names along the
// bottom, a back chevron top-left and a mini-table medallion bottom-right that jumps between elements.

import { html, nothing } from 'lit';
import { classMap } from 'lit/directives/class-map.js';
import { styleMap } from 'lit/directives/style-map.js';
import { state, set } from '../app/store.js';
import { COPY, PANELS } from '../app/i18n.js';
import { openElement, openPanel, backToTable } from '../app/router.js';
import { spectrumOf, abundanceOf } from '../data/load.js';
import { materia, luz, atomo, nucleo, historia, mundo, imagenes, datos, lightbox, galleryItems } from './panels.js';
import { FAMILY_COLOR } from '../table/lenses.js';

const t = () => COPY[state.lang];
const nameOf = (e) => e.name[state.lang] || e.name.en;
const RENDER = { materia, luz, atomo, nucleo, historia, mundo, imagenes, datos };

/** Panels that have something genuine to show for this element. */
export function availablePanels(e, s) {
  return PANELS.filter((p) => {
    if (p === 'luz') return !!spectrumOf(e.z);
    if (p === 'mundo') { const a = abundanceOf(e.z); return !!a && Object.values(a).some((v) => v != null); }
    if (p === 'imagenes') {
      if (s.galleryIndex) { const n = s.galleryIndex[String(e.z)] ?? s.galleryIndex.counts?.[String(e.z)]; if (n === 0) return false; }
      return s.gallery.has(e.z) ? galleryItems(e.z).length > 0 : true;
    }
    if (p === 'nucleo') return !!s.isotopes;
    return true;
  });
}

function medallion(e, s) {
  const c = t();
  return html`<svg class="medallion" viewBox="0 0 18 10.4" role="navigation" aria-label=${c.back} @click=${(ev) => { if (ev.target === ev.currentTarget) backToTable(); }}>
    ${s.elements.map((x) => {
      const row = x.y >= 9 ? x.y - 0.6 : x.y;
      return html`<rect class=${classMap({ on: x.z === e.z })} x=${x.x - 1 + 0.08} y=${row - 1 + 0.08} width=".84" height=".84" rx=".12" fill=${FAMILY_COLOR[x.family]} @click=${(ev) => { ev.stopPropagation(); openElement(x.z, s.panel); }}><title>${nameOf(x)}</title></rect>`;
    })}
  </svg>`;
}

export function deckView(s) {
  const e = s.byZ.get(s.z);
  if (!e) return nothing;
  const c = t();
  const panels = availablePanels(e, s);
  const current = panels.includes(s.panel) ? s.panel : panels[0];
  const prev = s.byZ.get(e.z - 1);
  const next = s.byZ.get(e.z + 1);
  return html`
    <div class="deck" style=${styleMap({ '--swatch': FAMILY_COLOR[e.family] })}>
      <button type="button" class="corner back" aria-label=${c.back} title=${`${c.back} (Esc)`} @click=${backToTable}>
        <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true"><path d="M15 5 8 12l7 7" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg>
      </button>
      <div class="panels" id="panels" @scroll=${onScroll}>
        ${panels.map((p) => html`<div class="slide" data-panel=${p}>${RENDER[p](e, s)}</div>`)}
      </div>
      <nav class="shelf" aria-label=${c.elementOf}>
        ${prev ? html`<button type="button" class="step" @click=${() => openElement(prev.z, current)} title=${nameOf(prev)}>‹ <span class="mono">${prev.symbol}</span></button>` : html`<span class="step"></span>`}
        <div class="tabs">
          ${panels.map((p) => html`<button type="button" class=${classMap({ tab: true, on: p === current })} @click=${() => { openPanel(p); scrollToPanel(p); }}>${c.panels[p]}</button>`)}
        </div>
        ${next ? html`<button type="button" class="step" @click=${() => openElement(next.z, current)} title=${nameOf(next)}><span class="mono">${next.symbol}</span> ›</button>` : html`<span class="step"></span>`}
      </nav>
      ${medallion(e, s)}
      ${s.lightbox != null ? lightbox(e, s) : nothing}
    </div>`;
}

let scrollTimer = null;
let suppressUntil = 0;   // ignore scroll events right after a programmatic jump (layout changes fire them too)
function onScroll(ev) {
  if (performance.now() < suppressUntil) return;
  clearTimeout(scrollTimer);
  scrollTimer = setTimeout(() => {
    if (performance.now() < suppressUntil) return;
    const host = ev.target;
    const i = Math.round(host.scrollLeft / host.clientWidth);
    const slide = host.children[i];
    const p = slide?.dataset.panel;
    if (p && p !== state.panel) openPanel(p);
  }, 80);
}

let slideCount = 0;
let slideZ = null;

/**
 * Keep the scroll position on the panel named in the state. Called after every render: when the
 * set of slides changed (a data file arrived and added a panel) or the element changed, jump without
 * animation; otherwise glide.
 */
export function syncPanelScroll(s) {
  const host = document.getElementById('panels');
  if (!host) { slideCount = 0; slideZ = null; return; }
  const changed = host.children.length !== slideCount || slideZ !== s.z;
  slideCount = host.children.length;
  slideZ = s.z;
  scrollToPanel(s.panel, changed ? 'auto' : undefined);
}

export function scrollToPanel(p, behavior) {
  const host = document.getElementById('panels');
  if (!host) return;
  const slide = [...host.children].find((n) => n.dataset.panel === p) || host.children[0];
  if (!slide) return;
  const target = slide.offsetLeft;
  if (Math.abs(host.scrollLeft - target) < 2) return;
  const mode = behavior || (state.motion ? 'smooth' : 'auto');
  suppressUntil = performance.now() + (mode === 'auto' ? 250 : 900);
  if (mode === 'auto') host.scrollLeft = target;
  else host.scrollTo({ left: target, behavior: 'smooth' });
}

/** Horizontal wheel inside the deck: vertical wheel moves panels when the slide has no vertical room. */
export function wheelToPanels(ev) {
  const host = document.getElementById('panels');
  if (!host) return;
  const slide = ev.target.closest('.slide');
  const canScrollY = slide && slide.scrollHeight > slide.clientHeight + 4;
  if (canScrollY && Math.abs(ev.deltaY) > Math.abs(ev.deltaX)) return;
  if (Math.abs(ev.deltaY) < 10 && Math.abs(ev.deltaX) < 10) return;
  ev.preventDefault();
  const dir = (ev.deltaX || ev.deltaY) > 0 ? 1 : -1;
  const i = Math.round(host.scrollLeft / host.clientWidth) + dir;
  const slideEl = host.children[Math.max(0, Math.min(host.children.length - 1, i))];
  if (slideEl) scrollToPanel(slideEl.dataset.panel);
}
