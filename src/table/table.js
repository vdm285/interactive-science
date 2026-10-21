// The stage: the whole periodic table filling the viewport, one lens at a time. In the peek it
// shrinks to a band along the top and keeps working: tap a tile to look at another element, tap
// the highlighted one again to dive.

import { html, nothing } from 'lit';
import { styleMap } from 'lit/directives/style-map.js';
import { classMap } from 'lit/directives/class-map.js';
import { state, set, savePrefs } from '../app/store.js';
import { COPY, LENSES } from '../app/i18n.js';
import { openPeek, backToTable } from '../app/router.js';
import { dive, isBusy } from '../app/transitions.js';
import { use3d, scenePick } from './stage3d.js';
import { fmt, extent } from '../logic.js';
import { photoOf, spectrumOf, tileUrl } from '../data/load.js';
import { stripDataUrl } from '../draw/spectrum.js';
import { FAMILY_COLOR, PROPERTIES, heat, phaseClass, knownInYear, radiusOf, propertyExtent, rampColor, discoveryYear } from './lenses.js';

const t = () => COPY[state.lang];
const nameOf = (e) => e.name[state.lang] || e.name.en;

export function setLens(lens) {
  set({ lens, family: null, lensOpen: false });
  savePrefs();
  if (state.view === 'table') history.replaceState(null, '', lens === 'fotos' ? '#' : `#tabla/${lens}`);
}

function tileStyle(e, s, maxRadius) {
  const fam = FAMILY_COLOR[e.family] || FAMILY_COLOR.unknown;
  switch (s.lens) {
    case 'fotos': {
      const photo = s.photosOn ? photoOf(e.z) : null;
      return photo
        ? { '--swatch': fam, backgroundImage: `url(${tileUrl(e.z)})` }
        : { '--swatch': fam, background: `linear-gradient(160deg, color-mix(in srgb, ${fam} 26%, #15181d), #0f1115)` };
    }
    case 'familias': {
      const dim = s.family && s.family !== e.family;
      return { '--swatch': fam, background: `color-mix(in srgb, ${fam} ${dim ? 10 : 72}%, #101216)`, opacity: dim ? 0.45 : 1 };
    }
    case 'estado': {
      const phase = phaseClass(e, s.celsius);
      const bg = { solid: 'linear-gradient(180deg, #3a3f49, #262a32)', liquid: 'linear-gradient(180deg, #2b8fb8 0%, #1b5f86 100%)', gas: 'radial-gradient(circle at 30% 30%, #f3e9d2 0%, #cdb98a 35%, #7f7358 100%)', unknown: 'repeating-linear-gradient(45deg, #181a1f 0 6px, #22252b 6px 12px)' }[phase];
      return { '--swatch': fam, background: bg };
    }
    case 'historia': {
      const known = knownInYear(e, s.year);
      return known
        ? { '--swatch': fam, background: `color-mix(in srgb, ${fam} 60%, #101216)` }
        : { '--swatch': fam, background: '#0d0f12', opacity: 0.35 };
    }
    case 'luz': {
      const sp = spectrumOf(e.z);
      const url = sp?.bins ? stripDataUrl(e.z, sp.bins) : null;
      return url
        ? { '--swatch': fam, background: `#000 url(${url}) center / 100% 100% no-repeat` }
        : { '--swatch': fam, background: '#07080a' };
    }
    case 'tamano': {
      const r = radiusOf(e);
      const size = r && maxRadius ? `${Math.max(14, (r / maxRadius) * 96)}%` : '0%';
      return { '--swatch': fam, '--ball': size, background: 'transparent' };
    }
    case 'datos': {
      const h = heat(s.elements, s.property, e);
      return { '--swatch': fam, background: h.color || 'repeating-linear-gradient(45deg, #121419 0 6px, #1a1d23 6px 12px)' };
    }
    default:
      return { '--swatch': fam };
  }
}

export function tileValue(e, s) {
  const c = t();
  switch (s.lens) {
    case 'estado': return `${c.phase[phaseClass(e, s.celsius)]}${e.predictedHeavy && (e.melt != null || e.boil != null) ? ` · ${s.lang === 'es' ? 'predicción' : 'predicted'}` : ''}`;
    case 'historia': {
      if (e.ancient) return c.ancient;
      const y = discoveryYear(e);
      if (y == null) return c.noYear;
      return knownInYear(e, s.year) ? String(y) : `${c.notYet} (${y})`;
    }
    case 'luz': { const sp = spectrumOf(e.z); return sp ? `${sp.count} ${c.lines}` : c.noSpectrum; }
    case 'tamano': { const r = radiusOf(e); return r ? `${r} pm` : c.radiusNone; }
    case 'datos': {
      const p = PROPERTIES[s.property];
      const v = p.get(e);
      const [label, unit] = c.properties[s.property];
      return v == null ? `${label}: ${c.noValue}` : `${label}: ${fmt(v, s.lang, p.digits)} ${unit}`.trim();
    }
    case 'familias': return `${c.family[e.family]}${e.familyUncertain ? ` · ${c.familyUncertain}` : ''}`;
    default: return `${c.family[e.family]} · ${c.phase[phaseClass(e, 25)]} ${c.at} 25 °C`;
  }
}

function onTile(e, s) {
  if (s.view === 'peek' && s.z === e.z) dive(e.z, 'materia');
  else openPeek(e.z);
}

function tile(e, s, maxRadius) {
  const seen = s.seen[e.z] != null;
  const selected = s.view === 'peek' && s.z === e.z;
  const showName = s.lens === 'familias' || s.lens === 'historia';
  return html`<button
    type="button"
    class=${classMap({ tile: true, seen, selected, 'has-ball': s.lens === 'tamano', 'no-photo': s.lens === 'fotos' && !(s.photosOn && photoOf(e.z)), gas: s.lens === 'estado' && phaseClass(e, s.celsius) === 'gas', dark: s.lens === 'datos' && (heat(s.elements, s.property, e).t ?? 0) > 0.7 })}
    style=${styleMap({ gridColumn: String(e.x), gridRow: String(e.y), ...tileStyle(e, s, maxRadius) })}
    data-z=${e.z}
    aria-label=${`${nameOf(e)}, ${e.z}`}
    aria-pressed=${selected}
    @click=${() => onTile(e, s)}
    @pointerenter=${() => set({ hover: e.z })}
    @pointerleave=${() => { if (state.hover === e.z) set({ hover: null }); }}
    @focus=${() => set({ hover: e.z })}
  >
    <span class="z">${e.z}</span>
    <span class="sym">${e.symbol}</span>
    <span class=${classMap({ nm: true, always: showName })}>${nameOf(e)}</span>
    ${s.lens === 'tamano' ? html`<span class="ball" style=${styleMap({ background: FAMILY_COLOR[e.family], width: 'var(--ball)', height: 'var(--ball)', borderStyle: radiusOf(e) ? 'solid' : 'dashed' })}></span>` : nothing}
  </button>`;
}

/** The "enter" pill under the highlighted tile: the second tap, made visible. */
function enterPill(s) {
  const e = s.view === 'peek' ? s.byZ.get(s.z) : null;
  if (!e) return nothing;
  const c = t();
  return html`<button type="button" class="enter" style=${styleMap({ gridColumn: String(e.x), gridRow: String(e.y) })} @click=${() => dive(e.z, 'materia')}>${c.enter} ›</button>`;
}

/** Sliders and pickers for the lens that needs them; only on the full table. */
export function lensControls(s) {
  const c = t();
  if (s.lens === 'estado') {
    const k = s.celsius + 273.15;
    return html`<div class="control pill">
      <input type="range" min="-273" max="6000" step="1" .value=${String(s.celsius)} aria-label=${c.lenses.estado}
        @input=${(ev) => { set({ celsius: Number(ev.target.value) }); }} @change=${savePrefs}>
      <output>${fmt(s.celsius, s.lang, 0)} °C · ${fmt(k, s.lang, 0)} K</output>
      <span class="swatches"><i style="background:#30343d"></i>${c.phase.solid} <i style="background:#2b8fb8"></i>${c.phase.liquid} <i style="background:#e9dfc4"></i>${c.phase.gas}</span>
    </div>`;
  }
  if (s.lens === 'historia') {
    const known = s.elements.filter((e) => knownInYear(e, s.year)).length;
    return html`<div class="control pill">
      <input type="range" min="1650" max="2026" step="1" .value=${String(s.year)} aria-label=${c.lenses.historia}
        @input=${(ev) => { set({ year: Number(ev.target.value) }); }} @change=${savePrefs}>
      <output><strong>${known}</strong> ${c.known} <strong>${s.year}</strong></output>
    </div>`;
  }
  if (s.lens === 'datos') {
    const [lo, hi] = propertyExtent(s.elements, s.property);
    const p = PROPERTIES[s.property];
    const [label, unit] = c.properties[s.property];
    return html`<div class="control pill">
      <span class="legend-ends"><span>${label}</span><span>${fmt(lo, s.lang, p.digits)} ${unit}</span><span class="legend-bar" style=${styleMap({ background: `linear-gradient(90deg, ${[0, 0.25, 0.5, 0.75, 1].map(rampColor).join(',')})` })}></span><span>${fmt(hi, s.lang, p.digits)} ${unit}</span></span>
    </div>`;
  }
  if (s.lens === 'familias' && s.family) {
    return html`<div class="control pill"><span class="chip on" style=${styleMap({ '--swatch': FAMILY_COLOR[s.family] })}>${c.family[s.family]}</span><button type="button" class="ghost small" @click=${() => set({ family: null })}>×</button></div>`;
  }
  return nothing;
}

/** The lenses button (bottom-right) and its popover. */
export function lensesView(s) {
  const c = t();
  const families = [...new Set(s.elements.map((e) => e.family))].filter((f) => f !== 'unknown');
  return html`
    <button type="button" class=${classMap({ corner: true, 'lenses-btn': true, on: s.lensOpen })} aria-label=${c.lensesTitle} title=${c.lensesTitle} aria-expanded=${s.lensOpen} @click=${() => set({ lensOpen: !s.lensOpen })}>
      <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true"><path fill="none" stroke="currentColor" stroke-width="1.9" stroke-linejoin="round" d="M12 4 3 9l9 5 9-5-9-5Zm-9 9 9 5 9-5M3 17l9 5 9-5"/></svg>
      <span class="corner-label">${c.lenses[s.lens]}</span>
    </button>
    ${s.lensOpen ? html`<div class="lens-pop" role="menu">
      <p class="eyebrow">${c.lensesTitle}</p>
      ${LENSES.map((lens) => html`<button type="button" role="menuitemradio" aria-checked=${s.lens === lens} class=${classMap({ 'lens-item': true, on: s.lens === lens })} @click=${() => setLens(lens)}><strong>${c.lenses[lens]}</strong><span class="dim small">${c.lensHelp[lens]}</span></button>`)}
      ${s.lens === 'datos' ? html`<div class="picker">${Object.keys(PROPERTIES).map((key) => html`<button type="button" class=${classMap({ chip: true, on: s.property === key })} @click=${() => { set({ property: key }); savePrefs(); }}>${c.properties[key][0]}</button>`)}</div>` : nothing}
      ${s.lens === 'familias' ? html`<div class="picker">${families.map((f) => html`<button type="button" class=${classMap({ chip: true, on: s.family === f })} style=${styleMap({ '--swatch': FAMILY_COLOR[f] })} @click=${() => set({ family: s.family === f ? null : f })}>${c.family[f]}</button>`)}</div>` : nothing}
    </div>` : nothing}`;
}

/** In the 3D table the atom is on screen, so the readout says what it draws: the shells from the data. */
function shellsLine(e, s) {
  const c = t();
  const total = e.shells.reduce((a, b) => a + b, 0);
  return ` · ${e.shells.join(' · ')} ${c.perShell} · ${fmt(total, s.lang, 0)} e⁻${e.z > 36 ? ` · ${c.drawnCap}` : ''}`;
}

export function readout(s) {
  const c = t();
  const e = s.hover ? s.byZ.get(s.hover) : null;
  if (!e) return s.view === 'table' ? html`<p class="readout hint">${c.lensHelp[s.lens]}</p>` : nothing;
  return html`<p class="readout"><strong>${nameOf(e)}</strong> <span class="mono">${e.symbol} · ${e.z}</span> <span class="val">${tileValue(e, s)}${use3d(s) ? shellsLine(e, s) : ''}</span></p>`;
}

/** The enter pill in the 3D table: the scene places it under the projected box every frame. */
function enterPill3d(s) {
  const e = s.view === 'peek' ? s.byZ.get(s.z) : null;
  if (!e) return nothing;
  const c = t();
  return html`<button type="button" class="enter enter-3d" data-z=${e.z} @click=${() => dive(e.z, 'materia')}>${c.enter} ›</button>`;
}

function pickAt(ev) {
  return isBusy() ? null : scenePick(ev.clientX, ev.clientY);
}

/** The glass-box table: the canvas lives in a body-level host (src/table/stage3d.js); this is the pointer layer over it. */
function stage3d(s) {
  const c = t();
  return html`
    <main class="stage stage-3d" aria-label=${c.appName}
      @pointermove=${(ev) => { const z = pickAt(ev); if (z !== state.hover) set({ hover: z }); }}
      @pointerleave=${() => { if (state.hover != null) set({ hover: null }); }}
      @click=${(ev) => {
        if (ev.target.closest('.enter')) return;
        const z = pickAt(ev);
        if (z) onTile(s.byZ.get(z), s);
        else if (s.view === 'peek' && !isBusy()) backToTable();
      }}
      @dblclick=${(ev) => { const z = pickAt(ev); if (z) dive(z, 'materia'); }}
    >${enterPill3d(s)}</main>
    ${readout(s)}
    ${lensControls(s)}`;
}

export function tableView(s) {
  if (use3d(s)) return stage3d(s);
  const c = t();
  const [, maxRadius] = extent(s.elements, radiusOf);
  return html`
    <main class="stage" aria-label=${c.appName} @click=${(ev) => { if (s.view === 'peek' && !ev.target.closest('.tile, .enter')) backToTable(); }}>
      <div class="ptable" role="grid">
        ${s.elements.map((e) => tile(e, s, maxRadius))}
        <span class="marker" style="grid-column:3; grid-row:6">57–71</span>
        <span class="marker" style="grid-column:3; grid-row:7">89–103</span>
        ${enterPill(s)}
      </div>
    </main>
    ${readout(s)}
    ${lensControls(s)}`;
}
