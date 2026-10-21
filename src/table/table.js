// The stage: the whole periodic table filling the viewport, one lens at a time.

import { html, nothing } from 'lit';
import { styleMap } from 'lit/directives/style-map.js';
import { classMap } from 'lit/directives/class-map.js';
import { state, set, savePrefs } from '../app/store.js';
import { COPY, LENSES } from '../app/i18n.js';
import { openElement } from '../app/router.js';
import { fmt, extent } from '../logic.js';
import { photoOf, spectrumOf, tileUrl } from '../data/load.js';
import { stripDataUrl } from '../draw/spectrum.js';
import { FAMILY_COLOR, PROPERTIES, heat, phaseClass, knownInYear, radiusOf, propertyExtent, rampColor, discoveryYear } from './lenses.js';

const t = () => COPY[state.lang];
const nameOf = (e) => e.name[state.lang] || e.name.en;

function setLens(lens) {
  set({ lens, family: null });
  savePrefs();
  const next = lens === 'fotos' ? '#' : `#tabla/${lens}`;
  history.replaceState(null, '', next);
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
        ? { '--swatch': fam, background: `#000 url(${url}) center / 100% 100% no-repeat`, imageRendering: 'auto' }
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

function tileValue(e, s) {
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

function tile(e, s, maxRadius) {
  const row = e.y >= 9 ? e.y : e.y; // rows 8 is the spacer in CSS; data rows 9 and 10 map directly
  const seen = s.seen[e.z] != null;
  const showName = s.lens === 'familias' || s.lens === 'historia';
  return html`<button
    type="button"
    class=${classMap({ tile: true, seen, 'has-ball': s.lens === 'tamano', 'no-photo': s.lens === 'fotos' && !(s.photosOn && photoOf(e.z)), gas: s.lens === 'estado' && phaseClass(e, s.celsius) === 'gas', dark: s.lens === 'datos' && (heat(s.elements, s.property, e).t ?? 0) > 0.7 })}
    style=${styleMap({ gridColumn: String(e.x), gridRow: String(row), ...tileStyle(e, s, maxRadius) })}
    data-z=${e.z}
    aria-label=${`${nameOf(e)}, ${e.z}`}
    @click=${() => openElement(e.z)}
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

function controls(s) {
  const c = t();
  if (s.lens === 'estado') {
    const k = s.celsius + 273.15;
    return html`<div class="control">
      <input type="range" min="-273" max="6000" step="1" .value=${String(s.celsius)} aria-label=${c.lenses.estado}
        @input=${(ev) => { set({ celsius: Number(ev.target.value) }); }} @change=${savePrefs}>
      <output>${fmt(s.celsius, s.lang, 0)} °C · ${fmt(k, s.lang, 0)} K</output>
      <span class="swatches"><i style="background:#30343d"></i>${c.phase.solid} <i style="background:#2b8fb8"></i>${c.phase.liquid} <i style="background:#e9dfc4"></i>${c.phase.gas}</span>
    </div>`;
  }
  if (s.lens === 'historia') {
    const known = s.elements.filter((e) => knownInYear(e, s.year)).length;
    return html`<div class="control">
      <input type="range" min="1650" max="2026" step="1" .value=${String(s.year)} aria-label=${c.lenses.historia}
        @input=${(ev) => { set({ year: Number(ev.target.value) }); }} @change=${savePrefs}>
      <output><strong>${known}</strong> ${c.known} <strong>${s.year}</strong></output>
    </div>`;
  }
  if (s.lens === 'datos') {
    const [lo, hi] = propertyExtent(s.elements, s.property);
    const p = PROPERTIES[s.property];
    const [, unit] = c.properties[s.property];
    return html`<div class="control picker">
      ${Object.keys(PROPERTIES).map((key) => html`<button type="button" class=${classMap({ chip: true, on: s.property === key })} @click=${() => { set({ property: key }); savePrefs(); }}>${c.properties[key][0]}</button>`)}
      <span class="legend-bar" style=${styleMap({ background: `linear-gradient(90deg, ${[0, 0.25, 0.5, 0.75, 1].map(rampColor).join(',')})` })}></span>
      <span class="legend-ends"><span>${fmt(lo, s.lang, p.digits)} ${unit}</span><span>${fmt(hi, s.lang, p.digits)} ${unit}</span></span>
    </div>`;
  }
  if (s.lens === 'familias') {
    const families = [...new Set(s.elements.map((e) => e.family))].filter((f) => f !== 'unknown');
    return html`<div class="control picker">
      ${families.map((f) => html`<button type="button" class=${classMap({ chip: true, on: s.family === f })} style=${styleMap({ '--swatch': FAMILY_COLOR[f] })} @click=${() => set({ family: s.family === f ? null : f })}>${c.family[f]}</button>`)}
    </div>`;
  }
  return nothing;
}

function readout(s) {
  const c = t();
  const e = s.hover ? s.byZ.get(s.hover) : null;
  if (!e) return html`<p class="readout hint">${c.lensHelp[s.lens]}</p>`;
  return html`<p class="readout"><strong>${nameOf(e)}</strong> <span class="mono">${e.symbol} · ${e.z}</span> <span class="val">${tileValue(e, s)}</span></p>`;
}

export function tableView(s) {
  const c = t();
  const [, maxRadius] = extent(s.elements, radiusOf);
  return html`
    <main class="stage" aria-label=${c.appName}>
      <div class="ptable" role="grid">
        ${s.elements.map((e) => tile(e, s, maxRadius))}
        <span class="marker" style="grid-column:3; grid-row:6">57–71</span>
        <span class="marker" style="grid-column:3; grid-row:7">89–103</span>
      </div>
    </main>
    <nav class="rail" aria-label="lentes">
      ${readout(s)}
      ${controls(s)}
      <div class="lenses">
        ${LENSES.map((lens) => html`<button type="button" class=${classMap({ lens: true, on: s.lens === lens })} @click=${() => setLens(lens)}>${c.lenses[lens]}</button>`)}
      </div>
    </nav>`;
}
