// The eight panels of an element. Each is a function of (element, state) returning a lit template.
// Rule: every number on screen comes from a named file in public/data/; every image carries its credit.

import { html, nothing } from 'lit';
import { styleMap } from 'lit/directives/style-map.js';
import { classMap } from 'lit/directives/class-map.js';
import { state, set } from '../app/store.js';
import { openElement } from '../app/router.js';
import { COPY } from '../app/i18n.js';
import { fmt, halfLifeText, parseConfig, orbitalBoxes, rankOf, shellNote, phaseAt, cToKelvin } from '../logic.js';
import { photoOf, spectrumOf, isotopesOf, historyOf, abundanceOf, videoOf } from '../data/load.js';
import { atomSvg } from '../draw/atom.js';
import { FAMILY_COLOR, discoveryYear } from '../table/lenses.js';

const t = () => COPY[state.lang];
const nameOf = (e) => e.name[state.lang] || e.name.en;
const sup = (config) => String(config || '').split(/\s+/).map((tok) => {
  const m = tok.match(/^(\[\w+\]|\d[spdfg])(\d+)$/);
  return m ? html`<span class="orb">${m[1]}<sup>${m[2]}</sup></span> ` : html`${tok} `;
});

function credit(photo) {
  if (!photo) return nothing;
  return html`<a class="credit" href=${photo.page} target="_blank" rel="noreferrer" title=${photo.file}>${t().photoBy}: ${photo.artist || 'Wikimedia Commons'} · ${photo.license}</a>`;
}

// ───────────────────────────── Materia
export function materia(e, s) {
  const c = t();
  const photo = s.photosOn !== false ? photoOf(e.z) : null;
  const wiki = s.wiki.get(e.z);
  const w = wiki?.[s.lang] || wiki?.es || wiki?.en;
  const phase = phaseAt(e, cToKelvin(25)).phase;
  const fam = FAMILY_COLOR[e.family];
  return html`<section class="panel materia" style=${styleMap({ '--swatch': fam })}>
    ${photo
      ? html`<img class="hero" src=${photo.hero} alt=${nameOf(e)} loading="eager" decoding="async" @error=${(ev) => { if (ev.target.src !== photo.medium) ev.target.src = photo.medium; }}>`
      : html`<div class="hero model">${atomSvg(e, { animate: s.motion, size: 420, color: fam })}</div>`}
    <div class="hero-text">
      <p class="eyebrow">${c.family[e.family]}${e.familyUncertain ? html` <span class="dim">· ${c.familyUncertain}</span>` : nothing} · ${c.phase[phase]} ${c.at} 25 °C</p>
      <h1>${nameOf(e)}</h1>
      <p class="capsule"><span class="sym">${e.symbol}</span><span>${e.z} ${c.protons}</span><span>${fmt(e.mass, s.lang, 4)} u</span>${w?.description ? html`<span class="desc">${w.description}</span>` : nothing}</p>
      ${!photo ? html`<p class="dim small nophoto">${c.bohr} ${e.z > 100 ? c.noPhotoHeavy : c.noPhoto}</p>` : nothing}
      ${wiki?.pronunciation ? html`<button type="button" class="ghost small" @click=${() => new Audio(wiki.pronunciation.url).play()} title=${`${wiki.pronunciation.artist || 'Lingua Libre'} · ${wiki.pronunciation.license}`}>▶ ${c.pronounce}</button>` : nothing}
      ${w?.extract ? html`<details class="read" @toggle=${(ev) => set({ reading: ev.target.open })}>
        <summary>${c.read}</summary>
        <p class="prose">${w.extract}</p>
        <p class="src"><a href=${w.url} target="_blank" rel="noreferrer">${w.title}</a> · ${s.lang === 'es' ? (wiki[s.lang] ? c.wiki : c.wikiEn) : (wiki[s.lang] ? c.wiki : c.wikiEn)} · ${c.ccBySa}</p>
      </details>` : nothing}
    </div>
    ${credit(photo)}
  </section>`;
}

// ───────────────────────────── Luz
export function luz(e, s) {
  const c = t();
  const sp = spectrumOf(e.z);
  if (!sp) return html`<section class="panel luz"><p class="empty">${c.noSpectrum}</p></section>`;
  const top = [...sp.lines].sort((a, b) => b[1] - a[1]).slice(0, 10).sort((a, b) => a[0] - b[0]);
  return html`<section class="panel luz">
    <h2>${c.spectrumTitle} <span class="dim">${sp.species?.endsWith(' II') ? c.spectrumIon : c.spectrumOf} · ${sp.species}</span></h2>
    <div class="spectrum-wrap">
      <canvas class="spectrum" data-z=${e.z} aria-label=${`${c.spectrumTitle} ${nameOf(e)}`}></canvas>
      <div class="nm-readout" id="nmReadout">${c.hoverLine}</div>
      <div class="scale">${[400, 450, 500, 550, 600, 650, 700, 750].map((nm) => html`<span style=${styleMap({ left: `${((nm - 380) / 400) * 100}%` })}>${nm}</span>`)}<span class="unit">nm</span></div>
    </div>
    <p class="meta"><strong>${fmt(sp.count, s.lang, 0)}</strong> ${c.lines}</p>
    <p class="meta"><span class="dim">${c.strongest}:</span> ${top.map(([nm]) => html`<span class="chip mono">${nm.toFixed(1)}</span>`)}</p>
    <p class="src"><a href=${s.spectra.source.url} target="_blank" rel="noreferrer">${c.nistCredit}</a> ${s.spectra.source.version ? `v${s.spectra.source.version}` : ''} · ${s.lang === 'es' ? 'intensidades relativas del propio NIST, normalizadas a la línea más intensa de este elemento' : 'NIST relative intensities, normalized to this element\'s strongest line'}</p>
  </section>`;
}

// ───────────────────────────── Átomo
function radiusCircle(e, s) {
  const c = t();
  const r = e.radius?.empirical ?? e.radius?.calculated;
  const h = s.byZ.get(1)?.radius?.empirical ?? 25;
  const cs = s.byZ.get(55)?.radius?.empirical ?? 260;
  if (!r) return html`<p class="dim">${c.radiusNone}</p>`;
  const px = (v) => (v / cs) * 120;
  return html`<svg class="radii" viewBox="0 0 270 130" role="img" aria-label=${`${c.radius} ${r} pm`}>
    <circle cx="65" cy="65" r=${px(cs) / 2} fill="none" stroke="currentColor" stroke-opacity=".25" stroke-dasharray="3 3"/>
    <circle cx="65" cy="65" r=${px(r) / 2} fill=${FAMILY_COLOR[e.family]} fill-opacity=".75"/>
    <circle cx="65" cy="65" r=${px(h) / 2} fill="none" stroke="currentColor" stroke-opacity=".6"/>
    <text x="150" y="40" class="small">Cs ${cs} pm</text>
    <text x="150" y="70" class="big">${e.symbol} ${r} pm</text>
    <text x="150" y="100" class="small">H ${h} pm</text>
  </svg>`;
}

export function atomo(e, s) {
  const c = t();
  const config = parseConfig(e.config);
  const valence = config.filter((o) => o.n === Math.max(...config.map((x) => x.n)) || (o.l === 'd' && o.n === Math.max(...config.map((x) => x.n)) - 1 && o.count < 10) || (o.l === 'f' && o.count < 14 && o.n === Math.max(...config.map((x) => x.n)) - 2));
  const early = shellNote(e);
  const fam = FAMILY_COLOR[e.family];
  return html`<section class="panel atomo" style=${styleMap({ '--swatch': fam })}>
    <div class="atom-col">
      ${atomSvg(e, { animate: s.motion, size: 360, color: fam })}
      <p class="note">${c.bohr}</p>
      <p class="shells mono">${c.shells}: ${e.shells.join(' · ')}</p>
      ${early ? html`<p class="note dim">${c.earlyShell}</p>` : nothing}
    </div>
    <div class="facts-col">
      <h2>${c.config}${e.configPredicted ? html` <span class="dim small">· ${c.configPredicted}</span>` : nothing}</h2>
      <p class="config mono">${sup(e.configShort)}</p>
      <div class="orbitals">
        ${valence.map((o) => html`<div class="sub"><span class="mono">${o.n}${o.l}</span>${orbitalBoxes(o.l, o.count).map((n) => html`<i class=${classMap({ box: true, one: n === 1, two: n === 2 })}></i>`)}</div>`)}
      </div>
      <dl class="grid">
        <div><dt>${c.radius}</dt><dd>${radiusCircle(e, s)}<small class="dim">${c.radiusNote}</small></dd></div>
        <div><dt>${c.electronegativity}</dt><dd>${e.electronegativity != null ? html`<strong>${fmt(e.electronegativity, s.lang, 2)}</strong> Pauling` : c.noValue}</dd></div>
        <div><dt>${c.ionization}</dt><dd>${e.ionizationEv != null ? html`<strong>${fmt(e.ionizationEv, s.lang, 3)}</strong> eV${e.ionization?.[0] ? html` <span class="dim">· ${fmt(e.ionization[0], s.lang, 1)} kJ/mol</span>` : nothing}` : c.noValue}</dd></div>
        <div><dt>${c.affinity}</dt><dd>${e.electronAffinityEv != null ? html`<strong>${fmt(e.electronAffinityEv, s.lang, 3)}</strong> eV` : e.electronAffinity != null ? html`<strong>${fmt(e.electronAffinity, s.lang, 1)}</strong> kJ/mol` : c.noValue}</dd></div>
        <div><dt>${c.oxidation}</dt><dd>${e.oxidation?.length ? e.oxidation.map((n) => html`<span class="chip mono">${n > 0 ? `+${n}` : n}</span>`) : c.noValue}</dd></div>
        <div><dt>${c.block}</dt><dd><strong class="mono">${e.block}</strong> · ${s.lang === 'es' ? 'periodo' : 'period'} ${e.period}${e.group ? html` · ${s.lang === 'es' ? 'grupo' : 'group'} ${e.group}` : nothing}</dd></div>
      </dl>
    </div>
  </section>`;
}

// ───────────────────────────── Núcleo
function hlColor(sec) {
  // short = hot, long = cool. log10 seconds from -9 to 17.
  if (sec == null) return '#3a3d44';
  const t = Math.min(1, Math.max(0, (Math.log10(sec) + 9) / 26));
  const hue = 10 + t * 210;
  return `hsl(${hue} 70% ${45 + t * 10}%)`;
}

export function nucleo(e, s) {
  const c = t();
  const iso = isotopesOf(e.z);
  if (!iso) return html`<section class="panel nucleo"><p class="empty">…</p></section>`;
  const list = iso.isotopes;
  const maxAb = Math.max(1, ...list.map((i) => i.abundance || 0));
  const hovered = s.isoHover && list.find((i) => i.a === s.isoHover) || list.find((i) => i.a === iso.mostAbundant?.a) || list.find((i) => i.stable) || list[0];
  const primordial = list.filter((i) => !i.stable && i.abundance != null).length;
  return html`<section class="panel nucleo">
    <h2>${nameOf(e)} · <span class="dim">${iso.known} ${c.isotopesKnown}, ${iso.stable ? `${iso.stable} ${c.stableN}` : c.noneStable}</span></h2>
    <div class="nuclides" @pointerleave=${() => set({ isoHover: null })}>
      ${list.map((i) => html`<button type="button" class=${classMap({ nuc: true, stable: i.stable, on: hovered?.a === i.a })}
          style=${styleMap({ '--h': `${i.abundance ? 18 + (i.abundance / maxAb) * 82 : 14}%`, background: i.stable ? '#f1e7c8' : hlColor(i.halfLifeSec) })}
          aria-label=${`${e.symbol}-${i.a}`} @pointerenter=${() => set({ isoHover: i.a })} @focus=${() => set({ isoHover: i.a })}>
          <span class="a">${i.a}</span></button>`)}
    </div>
    ${hovered ? html`<div class="iso-card">
      <h3 class="mono">${e.symbol}-${hovered.a} <span class="dim">· ${hovered.n} ${c.neutrons} · ${e.z} ${c.protons}</span></h3>
      <p>${hovered.stable ? html`<strong>${c.stableLabel}</strong>` : html`${c.halfLife}: <strong>${hovered.halfLife || '—'}</strong>${hovered.halfLifeSec ? html` <span class="dim">(${halfLifeText(hovered.halfLifeSec, s.lang)})</span>` : nothing}`}
        ${hovered.abundance != null ? html` · ${c.abundanceNat}: <strong>${fmt(hovered.abundance, s.lang, 3)} %</strong>` : nothing}
        ${hovered.decays?.length ? html` · ${c.decay} ${hovered.decays.map((d) => html`<span class="chip mono">${d.mode}${d.pct != null ? ` ${fmt(d.pct, s.lang, 2)} %` : ''}</span>`)}` : nothing}
        ${hovered.jp ? html` · <span class="mono dim">${hovered.jp}</span>` : nothing}</p>
    </div>` : nothing}
    <p class="meta">
      ${iso.mostAbundant ? html`${c.mostCommon}: <strong class="mono">${e.symbol}-${iso.mostAbundant.a}</strong> (${fmt(iso.mostAbundant.pct, s.lang, 3)} %) · ` : nothing}
      ${iso.longest ? html`${c.longest} ${s.lang === 'es' ? 'entre los inestables' : 'among the unstable'}: <strong class="mono">${e.symbol}-${iso.longest.a}</strong> (${iso.longest.text})` : nothing}
    </p>
    ${iso.radioactive ? html`<p class="note">${c.radioactiveAll}${e.z === 83 ? html` ${s.lang === 'es' ? 'El bismuto-209 decae tan despacio (2×10¹⁹ años) que para todo fin práctico es estable; NUBASE lo lista como radiactivo y aquí seguimos los datos.' : 'Bismuth-209 decays so slowly (2×10¹⁹ years) that it is stable for every practical purpose; NUBASE lists it as radioactive and we follow the data.'}` : nothing}</p>` : nothing}
    ${primordial && !iso.radioactive ? html`<p class="note dim">${s.lang === 'es' ? `${primordial} isótopo${primordial > 1 ? 's' : ''} natural${primordial > 1 ? 'es' : ''} de este elemento ${primordial > 1 ? 'son radiactivos' : 'es radiactivo'} de vida muy larga.` : `${primordial} naturally occurring isotope${primordial > 1 ? 's' : ''} of this element ${primordial > 1 ? 'are' : 'is'} very long-lived and radioactive.`}</p>` : nothing}
    <p class="legend-iso"><i style="background:#f1e7c8"></i>${c.stableLabel} <i style="background:${hlColor(1e-6)}"></i>µs <i style="background:${hlColor(1)}"></i>s <i style="background:${hlColor(3.15e7)}"></i>${s.lang === 'es' ? 'años' : 'years'} <i style="background:${hlColor(3e16)}"></i>10⁹ ${s.lang === 'es' ? 'años' : 'years'}</p>
    <p class="src"><a href=${s.isotopes.source.url} target="_blank" rel="noreferrer">${c.iaeaCredit}</a> · NUBASE2020, ENSDF</p>
  </section>`;
}

// ───────────────────────────── Historia
export function historia(e, s) {
  const c = t();
  const h = historyOf(e.z);
  const year = discoveryYear(e);
  const lo = 1660, hi = 2030;
  const ancient = e.ancient || (year != null && year < lo);
  const person = (p, i, arr) => html`<span class="person"><strong>${p[s.lang] || p.en || p.es || p.qid}</strong>${p.description?.[s.lang] ? html` <span class="dim small">(${p.description[s.lang]})</span>` : nothing}${i < arr.length - 2 ? ', ' : i === arr.length - 2 ? (s.lang === 'es' ? ' y ' : ' and ') : ''}</span>`;
  // Timeline: one dot per element with a year, stacked when they share a 4-year bin.
  const bins = new Map();
  const dots = [];
  for (const x of s.elements) {
    const y = discoveryYear(x);
    if (x.ancient || y == null || y < lo) continue;
    const bin = Math.floor(y / 4);
    const level = bins.get(bin) || 0;
    bins.set(bin, level + 1);
    dots.push({ z: x.z, y, level, fam: x.family, name: nameOf(x) });
  }
  const ancients = s.elements.filter((x) => x.ancient || (discoveryYear(x) != null && discoveryYear(x) < lo));
  const bce = (y) => (y < 0 ? `${-y} a. C.` : String(y));
  return html`<section class="panel historia">
    ${ancient
      ? html`<h2>${c.ancientTitle}${year != null && year < lo ? html` <span class="dim">· Wikidata: ${s.lang === 'es' ? 'hacia' : 'circa'} ${bce(year)}</span>` : nothing}</h2>`
      : year != null
        ? html`<h2>${c.discovered} <strong class="year">${bce(year)}</strong>${h?.discoverers?.length ? html` <span class="dim">${c.discoveredBy}</span> ${h.discoverers.map(person)}` : nothing}${h?.discoveryPlace ? html` <span class="dim">${c.place}</span> ${h.discoveryPlace[s.lang] || h.discoveryPlace.en}` : nothing}</h2>`
        : html`<h2 class="dim">${c.noDiscovery}</h2>`}
    ${h?.discoveredAll?.length > 1 ? html`<p class="dim small">${s.lang === 'es' ? 'Wikidata registra varias fechas' : 'Wikidata records several dates'}: ${h.discoveredAll.map((d) => d.year ?? d).join(', ')}.</p>` : nothing}
    ${h?.discoveryNote ? html`<p class="dim small">${h.discoveryNote}</p>` : nothing}
    ${h?.discovered == null && e.yearDiscovered != null && !e.ancient ? html`<p class="dim small">${c.pubchemYear} ${e.yearDiscovered}.</p>` : nothing}
    ${h?.namedAfter?.length ? html`<p class="named">${c.namedAfter}: ${h.namedAfter.map(person)}</p>` : nothing}
    ${e.namedBy && !h?.namedAfter?.length ? html`<p class="dim small">${s.lang === 'es' ? 'Nombre dado por' : 'Named by'} ${e.namedBy}</p>` : nothing}
    <div class="timeline">
      <div class="antiquity">
        <span class="dim small">${s.lang === 'es' ? 'Antigüedad' : 'Antiquity'}</span>
        <div class="anc">${ancients.map((x) => html`<i class=${classMap({ dot: true, me: x.z === e.z })} style=${styleMap({ background: FAMILY_COLOR[x.family] })} title=${nameOf(x)} @click=${() => openElement(x.z, 'historia')}><b>${x.symbol}</b></i>`)}</div>
      </div>
      <div class="years">
        <div class="dots">
          ${dots.map((d) => html`<i class=${classMap({ dot: true, me: d.z === e.z })} style=${styleMap({ left: `${((d.y - lo) / (hi - lo)) * 100}%`, bottom: `${d.level * 14}px`, background: FAMILY_COLOR[d.fam] })} title=${`${d.name} · ${d.y}`} @click=${() => openElement(d.z, 'historia')}><b>${s.byZ.get(d.z).symbol}</b></i>`)}
        </div>
        <div class="axis">${[1700, 1750, 1800, 1850, 1900, 1950, 2000].map((y) => html`<span style=${styleMap({ left: `${((y - lo) / (hi - lo)) * 100}%` })}>${y}</span>`)}</div>
      </div>
    </div>
    <p class="dim small">${c.timeline}</p>
    <p class="src"><a href=${h?.wikidata ? `https://www.wikidata.org/wiki/${h.wikidata}` : 'https://www.wikidata.org/'} target="_blank" rel="noreferrer">${c.wikidataCredit}</a>${e.yearDiscovered != null ? html` · <a href=${`https://pubchem.ncbi.nlm.nih.gov/element/${e.z}`} target="_blank" rel="noreferrer">PubChem</a>` : nothing}</p>
  </section>`;
}

// ───────────────────────────── Mundo (abundance)
const MEDIA = ['crust', 'ocean', 'human', 'sun', 'universe'];
export function mundo(e, s) {
  const c = t();
  const ab = abundanceOf(e.z);
  const cols = s.abundance?.source?.columns || {};
  if (!ab || MEDIA.every((m) => ab[m] == null)) return html`<section class="panel mundo"><p class="empty">${c.noValue}</p></section>`;
  const rows = MEDIA.filter((m) => ab[m] != null).map((m) => {
    const get = (x) => abundanceOf(x.z)?.[m] ?? null;
    const values = s.elements.map(get).filter((v) => v != null && v > 0);
    const lo = Math.log10(Math.min(...values));
    const hi = Math.log10(Math.max(...values));
    const v = ab[m];
    const tpos = v > 0 ? (Math.log10(v) - lo) / (hi - lo) : 0;
    const unit = (cols[m]?.unit || '').replace(/atoms per 10\^?6 Si( atoms)?/i, s.lang === 'es' ? 'átomos por millón de Si' : 'atoms per million Si');
    return { m, v, t: tpos, rank: rankOf(s.elements, get, e.z), unit, ref: cols[m]?.ref || '' };
  });
  return html`<section class="panel mundo">
    <h2>${c.abundanceTitle}</h2>
    <div class="bars">
      ${rows.map((r) => html`<div class="bar-row">
        <span class="label">${c[r.m]}</span>
        <span class="track"><i style=${styleMap({ width: `${Math.max(1.5, r.t * 100)}%`, background: FAMILY_COLOR[e.family] })}></i></span>
        <span class="val"><strong>${fmt(r.v, s.lang, 4)}</strong> ${r.unit}${r.rank ? html` <span class="dim">· ${c.rank} ${r.rank.rank} ${c.of} ${r.rank.of}</span>` : nothing}</span>
      </div>`)}
    </div>
    <p class="dim small">${c.abundanceNote}</p>
    <p class="src">${rows.map((r) => html`<span class="dim">${c[r.m]}: ${r.ref}</span> `)}<br><a href=${s.abundance.source.page} target="_blank" rel="noreferrer">Wikipedia, Abundances of the elements (data page)</a> · ${c.ccBySa}</p>
  </section>`;
}

// ───────────────────────────── Imágenes
export function galleryItems(z) {
  const g = state.gallery.get(z);
  if (!g) return [];
  return Array.isArray(g) ? g : (g.items || g.images || []);
}

export function imagenes(e, s) {
  const c = t();
  const items = galleryItems(e.z);
  if (!items.length) return html`<section class="panel imagenes"><p class="empty">${s.gallery.has(e.z) ? c.noValue : '…'}</p></section>`;
  return html`<section class="panel imagenes">
    <div class="mosaic">
      ${items.map((it, i) => html`<figure class="shot" @click=${() => set({ lightbox: i })}>
        <img src=${it.thumb} alt=${it.caption?.[s.lang] || it.caption?.es || it.caption?.en || it.file} loading="lazy" decoding="async" style=${styleMap({ aspectRatio: it.w && it.h ? `${it.w} / ${it.h}` : '4 / 3' })}>
        <figcaption>${it.caption?.[s.lang] || it.caption?.es || it.caption?.en || ''}<span class="dim"> · ${it.artist || ''} · ${it.license}</span></figcaption>
      </figure>`)}
    </div>
    <p class="src">${c.galleryNote}</p>
  </section>`;
}

export function lightbox(e, s) {
  const c = t();
  const items = galleryItems(e.z);
  const it = items[s.lightbox];
  if (!it) return nothing;
  const step = (d) => set({ lightbox: (s.lightbox + d + items.length) % items.length });
  return html`<div class="lightbox" @click=${(ev) => { if (ev.target === ev.currentTarget) set({ lightbox: null }); }}>
    <img src=${it.src} alt=${it.caption?.[s.lang] || it.file}>
    <p class="cap">${it.caption?.[s.lang] || it.caption?.es || it.caption?.en || ''}<br><span class="dim">${it.artist || ''} · ${it.license} · <a href=${it.page} target="_blank" rel="noreferrer">${c.openCommons}</a></span></p>
    <button type="button" class="nav prev" aria-label=${c.prev} @click=${() => step(-1)}>‹</button>
    <button type="button" class="nav next" aria-label=${c.next} @click=${() => step(1)}>›</button>
    <button type="button" class="x" aria-label=${c.close} @click=${() => set({ lightbox: null })}>×</button>
  </div>`;
}

// ───────────────────────────── Cosas (minerals and objects from Wikidata, photos from Commons)
export function thingsOf(z) {
  const t = state.things.get(z);
  return t && (t.minerals || t.objects) ? { minerals: t.minerals || [], objects: t.objects || [] } : null;
}

function thingCard(it, s, kind) {
  const name = it[s.lang] || it.en || it.es;
  const wiki = it.wiki?.[s.lang] || it.wiki?.es || it.wiki?.en;
  const href = wiki ? `https://${it.wiki?.[s.lang] ? s.lang : (it.wiki?.es ? 'es' : 'en')}.wikipedia.org/wiki/${encodeURIComponent(wiki.replace(/ /g, '_'))}` : `https://www.wikidata.org/wiki/${it.qid}`;
  return html`<a class="thing" href=${href} target="_blank" rel="noreferrer" title=${it.photo ? `${it.photo.artist || 'Wikimedia Commons'} · ${it.photo.license}` : name}>
    ${it.photo ? html`<img src=${it.photo.thumb} alt=${name} loading="lazy" decoding="async">` : html`<span class="thing-blank">${kind === 'mineral' ? '◇' : '•'}</span>`}
    <span class="thing-name">${name}${it.formula ? html` <span class="mono dim">${it.formula}</span>` : nothing}</span>
  </a>`;
}

export function cosas(e, s) {
  const c = t();
  const th = thingsOf(e.z);
  if (!th) return html`<section class="panel cosas"><p class="empty">${s.things.has(e.z) ? c.noValue : '…'}</p></section>`;
  return html`<section class="panel cosas">
    ${th.minerals.length ? html`<h2>${c.minerals}</h2><div class="things">${th.minerals.map((it) => thingCard(it, s, 'mineral'))}</div>` : nothing}
    ${th.objects.length ? html`<h2>${c.objects}</h2><div class="things">${th.objects.map((it) => thingCard(it, s, 'object'))}</div>` : nothing}
    <p class="src">${c.thingsNote} <a href=${`https://www.wikidata.org/wiki/${historyOf(e.z)?.wikidata || ''}`} target="_blank" rel="noreferrer">Wikidata</a></p>
  </section>`;
}

// ───────────────────────────── Video (Periodic Videos, embedded on tap)
export function video(e, s) {
  const c = t();
  const v = videoOf(e.z);
  if (!v) return html`<section class="panel video"><p class="empty">${c.noValue}</p></section>`;
  const playing = s.videoPlaying === v.id;
  return html`<section class="panel video">
    <h2>${c.videoTitle}</h2>
    <div class="player">
      ${playing
        ? html`<iframe src=${`https://www.youtube-nocookie.com/embed/${v.id}?autoplay=1&rel=0`} title=${v.title} allow="autoplay; encrypted-media; picture-in-picture" allowfullscreen referrerpolicy="strict-origin-when-cross-origin"></iframe>`
        : html`<button type="button" class="poster" @click=${() => set({ videoPlaying: v.id })} aria-label=${c.videoPlay}>
            <img src=${v.thumb} alt="" loading="lazy">
            <span class="play">▶</span>
          </button>`}
    </div>
    <p class="meta"><strong>${v.title}</strong> · <a href=${`https://www.youtube.com/watch?v=${v.id}`} target="_blank" rel="noreferrer">${v.channel}</a> <span class="dim">· ${c.videoBy}</span></p>
    <p class="src">${c.videoNote} <a href=${s.videos?.source?.site} target="_blank" rel="noreferrer">periodicvideos.com</a></p>
  </section>`;
}

// ───────────────────────────── Datos
function row(label, value, unit, src) {
  if (value == null || value === '' || (Array.isArray(value) && !value.length)) return nothing;
  return html`<tr><th>${label}</th><td>${Array.isArray(value) ? value.join(', ') : value}${unit ? html` <span class="dim">${unit}</span>` : nothing}</td><td class="dim mono">${src}</td></tr>`;
}

export function askPrompt(e, s) {
  const n = nameOf(e);
  return s.lang === 'es'
    ? `Explícame el elemento ${n} (${e.symbol}, número atómico ${e.z}) como a una persona curiosa sin formación química: qué es, dónde se encuentra en la vida diaria, por qué importa y una curiosidad histórica. Cita fuentes.`
    : `Explain the element ${n} (${e.symbol}, atomic number ${e.z}) to a curious person with no chemistry background: what it is, where it shows up in daily life, why it matters, and one historical curiosity. Cite sources.`;
}

export function datos(e, s) {
  const c = t();
  const wiki = s.wiki.get(e.z);
  const h = historyOf(e.z);
  const es = s.lang === 'es';
  const L = (k) => c.properties[k]?.[0] || k;
  return html`<section class="panel datos">
    <h2>${c.dataTitle}</h2>
    <table class="data">
      <tbody>
        ${row(es ? 'Número atómico' : 'Atomic number', e.z, '', '')}
        ${row(es ? 'Símbolo' : 'Symbol', e.symbol, '', '')}
        ${row(es ? 'Nombre en inglés' : 'Spanish name', es ? e.name.en : e.name.es, '', 'names')}
        ${e.aliases?.length ? row(es ? 'También' : 'Also', e.aliases, '', 'names') : nothing}
        ${row(L('mass'), fmt(e.mass, s.lang, 6), 'u', 'bowserinator')}
        ${row(es ? 'Fase (condiciones estándar)' : 'Phase (standard conditions)', e.standardState || e.phase, '', 'pubchem')}
        ${row(L('melt'), e.melt != null ? `${fmt(e.melt, s.lang, 2)} K · ${fmt(e.melt - 273.15, s.lang, 1)} °C` : null, '', 'bowserinator')}
        ${row(L('boil'), e.boil != null ? `${fmt(e.boil, s.lang, 2)} K · ${fmt(e.boil - 273.15, s.lang, 1)} °C` : null, '', 'bowserinator')}
        ${row(L('density'), e.density != null ? fmt(e.density, s.lang, 5) : null, e.densityUnit, 'bowserinator')}
        ${row(es ? 'Calor molar' : 'Molar heat', e.molarHeat != null ? fmt(e.molarHeat, s.lang, 3) : null, 'J/(mol·K)', 'bowserinator')}
        ${row(c.shells, e.shells, '', 'bowserinator')}
        ${row(c.config, e.config, '', 'bowserinator')}
        ${row(L('electronegativity'), e.electronegativity != null ? fmt(e.electronegativity, s.lang, 2) : null, 'Pauling', 'bowserinator')}
        ${row(c.ionization, e.ionizationEv != null ? fmt(e.ionizationEv, s.lang, 3) : null, 'eV', 'pubchem')}
        ${row(es ? 'Energías de ionización sucesivas' : 'Successive ionization energies', e.ionization?.slice(0, 6).map((v) => fmt(v, s.lang, 1)), 'kJ/mol', 'bowserinator')}
        ${row(c.affinity, e.electronAffinityEv != null ? fmt(e.electronAffinityEv, s.lang, 3) : null, 'eV', 'pubchem')}
        ${row(c.oxidation, e.oxidation?.map((n) => (n > 0 ? `+${n}` : String(n))), '', 'pubchem')}
        ${row(`${c.radius} (${es ? 'empírico' : 'empirical'})`, e.radius?.empirical, 'pm', 'bowserinator')}
        ${row(`${c.radius} (${es ? 'covalente' : 'covalent'})`, e.radius?.covalent, 'pm', 'bowserinator')}
        ${row(`${c.radius} (van der Waals)`, e.radius?.vdw, 'pm', 'bowserinator')}
        ${row(es ? 'Apariencia' : 'Appearance', e.appearance, '', 'bowserinator')}
        ${e.discoveredBy && !/\d{3,4}\s*BC|^\d+$/.test(e.discoveredBy) ? row(es ? 'Descubridor (dataset)' : 'Discovered by (dataset)', e.discoveredBy, '', 'bowserinator') : nothing}
        ${row(L('year'), e.ancient ? (es ? 'Antigüedad' : 'Ancient') : e.yearDiscovered, '', 'pubchem')}
        ${h?.discovered != null ? row(`${L('year')} (Wikidata)`, h.discovered < 0 ? `${s.lang === 'es' ? 'hacia' : 'circa'} ${-h.discovered} a. C.` : h.discovered, '', 'wikidata') : nothing}
      </tbody>
    </table>
    ${e.predictedHeavy ? html`<p class="note dim">${c.predictedHeavy}</p>` : nothing}
    ${e.z === 6 || e.z === 33 ? html`<p class="note dim">${c.triplePoint}</p>` : nothing}
    ${wiki ? html`<div class="texts">
      ${['es', 'en'].filter((l) => wiki[l]).map((l) => html`<details ?open=${l === s.lang}><summary>${wiki[l].title} <span class="dim">· Wikipedia ${l === 'es' ? (es ? 'en español' : 'in Spanish') : (es ? 'en inglés' : 'in English')}</span></summary>
        <p class="prose">${wiki[l].extract}</p>
        <p class="src"><a href=${wiki[l].url} target="_blank" rel="noreferrer">${wiki[l].url}</a> · ${c.ccBySa}</p></details>`)}
    </div>` : nothing}
    <h3>${c.links}</h3>
    <p class="links">
      ${wiki?.es ? html`<a href=${wiki.es.url} target="_blank" rel="noreferrer">Wikipedia ES</a>` : nothing}
      ${wiki?.en ? html`<a href=${wiki.en.url} target="_blank" rel="noreferrer">Wikipedia EN</a>` : html`<a href=${e.wikiEn} target="_blank" rel="noreferrer">Wikipedia EN</a>`}
      ${h?.wikidata ? html`<a href=${`https://www.wikidata.org/wiki/${h.wikidata}`} target="_blank" rel="noreferrer">${c.wikidata}</a>` : nothing}
      <a href=${`https://pubchem.ncbi.nlm.nih.gov/element/${e.z}`} target="_blank" rel="noreferrer">${c.pubchem}</a>
      <a href=${`https://physics.nist.gov/PhysRefData/ASD/lines_form.html`} target="_blank" rel="noreferrer">${c.nist}</a>
      <a href="https://www-nds.iaea.org/relnsd/vcharthtml/VChartHTML.html" target="_blank" rel="noreferrer">${c.iaea}</a>
      <a href=${`https://www.youtube.com/results?search_query=${encodeURIComponent(`periodic videos ${e.name.en}`)}`} target="_blank" rel="noreferrer">${c.videos}</a>
      <a class="ask" href=${`https://www.google.com/search?udm=50&q=${encodeURIComponent(askPrompt(e, s))}`} target="_blank" rel="noreferrer" title=${c.askNote}>${c.ask} ↗</a>
    </p>
    <p class="dim small">${c.askNote}</p>
    <p class="src">${s.sources.map((src) => html`<span class="mono">${src.id}</span> = <a href=${src.url} target="_blank" rel="noreferrer">${src.name}</a> (${src.license}) `)}<span class="mono">wikidata</span> = Wikidata (CC0)</p>
  </section>`;
}
