import '@fontsource/fraunces/latin-700.css';
import '@fontsource/fraunces/latin-ext-700.css';
import '@fontsource/outfit/latin-400.css';
import '@fontsource/outfit/latin-ext-400.css';
import '@fontsource/outfit/latin-700.css';
import '@fontsource/outfit/latin-ext-700.css';
import './style.css';
import elements from './data/elements.json';
import { atomSvg } from './atom.js';
import { celsius, familyOf, massLabel, phaseAt, radioactive, searchElements, shellNote } from './logic.js';

const FAMILIES = [
  ['alkali', 'Alcalinos', 'Alkali metals'],
  ['alkaline', 'Alcalinotérreos', 'Alkaline earth'],
  ['transition', 'Transición', 'Transition'],
  ['post', 'Otros metales', 'Post-transition'],
  ['metalloid', 'Metaloides', 'Metalloids'],
  ['nonmetal', 'No metales', 'Nonmetals'],
  ['halogen', 'Halógenos', 'Halogens'],
  ['noble', 'Gases nobles', 'Noble gases'],
  ['lanthanide', 'Lantánidos', 'Lanthanides'],
  ['actinide', 'Actínidos', 'Actinides'],
];

const COPY = {
  es: {
    search: 'Busca: oro, Fe, 79',
    temp: 'Temperatura',
    reto: 'Reto',
    more: 'Más',
    lang: 'EN',
    levels: [['kid', '8 años'], ['mid', '12 años'], ['deep', '15 o más']],
    phase: { solid: 'sólido', liquid: 'líquido', gas: 'gas', unknown: 'fase no definida en los datos' },
    family: Object.fromEntries(FAMILIES.map(([id, es]) => [id, es])),
    protons: 'Protones',
    mass: 'Masa atómica',
    melt: 'Fusión',
    boil: 'Ebullición',
    density: 'Densidad',
    eneg: 'Electronegatividad',
    config: 'Configuración',
    found: 'Lo identificó',
    wiki: 'Según Wikipedia',
    wikiEn: 'Este párrafo es el de Wikipedia en inglés. No hay extracto en español en esta ficha.',
    model: 'Modelo de Bohr, simplificado: los electrones no son planetitas.',
    early: 'La capa de afuera empieza antes de que la anterior esté llena. Así pasa con varios metales.',
    predicted: 'A partir del 104, varios datos son predicciones, no medidas.',
    radio: 'Es radiactivo: no tiene isótopos estables (Z = 43, 61 o 84 en adelante).',
    compare: 'Comparar',
    clear: 'Quitar comparación',
    speak: 'Léemelo',
    next: 'Siguiente',
    prev: 'Anterior',
    close: 'Cerrar',
    phone: 'En el celular la tabla se desliza de lado. Si giras el teléfono, se parece más a la del libro.',
    retoAsk: '¿Dónde está',
    retoHit: '¡Correcto!',
    retoMiss: 'Tocaste',
    retoDone: 'Ronda lista',
    again: 'Otra ronda',
    score: 'aciertos',
    exhibit: 'Modo exhibición',
    big: 'Letra grande',
    sound: 'Sonido',
    about: 'Los números salen de un conjunto público de la tabla periódica (masas, temperaturas, capas). Los párrafos largos son de Wikipedia (CC BY-SA). El dibujo del átomo es un modelo, no una foto.',
  },
  en: {
    search: 'Search: gold, Fe, 79',
    temp: 'Temperature',
    reto: 'Quiz',
    more: 'More',
    lang: 'ES',
    levels: [['kid', 'Age 8'], ['mid', 'Age 12'], ['deep', '15+']],
    phase: { solid: 'solid', liquid: 'liquid', gas: 'gas', unknown: 'phase not in the data' },
    family: Object.fromEntries(FAMILIES.map(([id, , en]) => [id, en])),
    protons: 'Protons',
    mass: 'Atomic mass',
    melt: 'Melting point',
    boil: 'Boiling point',
    density: 'Density',
    eneg: 'Electronegativity',
    config: 'Configuration',
    found: 'Identified by',
    wiki: 'From Wikipedia',
    wikiEn: 'This paragraph is from English Wikipedia.',
    model: 'A Bohr model, simplified: electrons are not little planets.',
    early: 'The outer shell starts before the inner one is full. That happens for several metals.',
    predicted: 'From 104 on, several figures are predictions, not measurements.',
    radio: 'It is radioactive: no stable isotopes (Z = 43, 61, or 84 and up).',
    compare: 'Compare',
    clear: 'Clear comparison',
    speak: 'Read it',
    next: 'Next',
    prev: 'Previous',
    close: 'Close',
    phone: 'On a phone, slide the table sideways. Turn the phone and it looks more like the one in a book.',
    retoAsk: 'Where is',
    retoHit: 'Yes!',
    retoMiss: 'You tapped',
    retoDone: 'Round done',
    again: 'Another round',
    score: 'correct',
    exhibit: 'Exhibit mode',
    big: 'Large type',
    sound: 'Sound',
    about: 'Numbers come from a public periodic-table dataset (masses, temperatures, shells). Long paragraphs are from Wikipedia (CC BY-SA). The atom drawing is a model, not a photograph.',
  },
};

const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
const state = {
  z: 6,
  lang: localStorage.getItem('tabla-lang') || 'es',
  level: localStorage.getItem('tabla-level') || 'mid',
  celsius: 25,
  family: null,
  compare: null,
  big: localStorage.getItem('tabla-big') === '1',
  sound: localStorage.getItem('tabla-sound') !== '0',
  exhibit: false,
  reto: null,
  cardOpen: true,
};

const t = (key) => COPY[state.lang][key];
const el = (z) => elements.find((element) => element.z === z);
const nameOf = (element) => element.name[state.lang] || element.name.en;

function esc(value) {
  return String(value ?? '').replace(/[&<>"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
}

function kelvin() { return state.celsius + 273.15; }

function tempText(k) {
  if (k == null) return '—';
  return `${Math.round(k - 273.15)} °C`;
}

function firstSentence(text) {
  const match = String(text || '').match(/^[\s\S]*?[.!?](\s|$)/);
  return (match ? match[0] : String(text || '').slice(0, 180)).trim();
}

function renderLegend() {
  document.getElementById('legend').innerHTML = FAMILIES.map(([id, es, en]) => {
    const label = state.lang === 'es' ? es : en;
    const on = state.family === id;
    return `<button type="button" data-action="family" data-family="${id}" aria-pressed="${on}" style="--swatch: var(--${id})">${esc(label)}</button>`;
  }).join('');
}

function renderTable() {
  const root = document.getElementById('table');
  const tiles = elements.map((element) => {
    const family = familyOf(element);
    const phase = phaseAt(element, kelvin()).phase;
    const dim = state.family && state.family !== family;
    const selected = element.z === state.z;
    return `<button type="button" class="tile ${phase} ${selected ? 'selected' : ''} ${dim ? 'dim' : ''}" style="--swatch: var(--${family}); grid-column:${element.x}; grid-row:${element.y}" data-z="${element.z}" aria-pressed="${selected}">
      <span class="z">${element.z}</span>
      <span class="sym">${esc(element.symbol)}</span>
      <span class="nm">${esc(nameOf(element))}</span>
    </button>`;
  }).join('');
  const markers = `
    <button type="button" class="marker" style="grid-column:3; grid-row:6" data-action="jump" data-row="9">57–71</button>
    <button type="button" class="marker" style="grid-column:3; grid-row:7" data-action="jump" data-row="10">89–103</button>
    <div class="f-label" style="grid-row:9">${esc(state.lang === 'es' ? 'Lantánidos' : 'Lanthanides')}</div>
    <div class="f-label" style="grid-row:10">${esc(state.lang === 'es' ? 'Actínidos' : 'Actinides')}</div>`;
  root.innerHTML = tiles + markers;
}

function prettyConfig(config) {
  return esc(config || '').replace(/([spdf])(\d+)/g, '$1<sup>$2</sup>');
}

function fact(label, value) {
  if (!value || value === '—') return '';
  return `<div><span>${esc(label)}</span><strong>${esc(value)}</strong></div>`;
}

function renderCard() {
  const element = el(state.z);
  const family = familyOf(element);
  const phase = phaseAt(element, kelvin());
  const summary = element.summaryEs?.extract || element.summaryEn || '';
  const shown = state.level === 'kid' ? firstSentence(summary) : summary;
  const early = shellNote(element);
  const other = state.compare ? el(state.compare) : null;
  const hook = element.hook?.[state.lang];
  document.getElementById('card').innerHTML = `
    <p class="eyebrow">${esc(t('family')[family] || family)} · ${element.z}</p>
    <h2>${esc(nameOf(element))}</h2>
    <p class="kicker">${esc(element.symbol)} · ${esc(t('phase')[phase.phase])} ${state.lang === 'es' ? 'a' : 'at'} ${state.celsius} °C</p>
    ${hook ? `<p class="hook">${esc(hook)}</p>` : ''}
    <div class="levels">
      ${t('levels').map(([id, label]) => `<button type="button" data-action="level" data-level="${id}" aria-pressed="${state.level === id}">${esc(label)}</button>`).join('')}
    </div>
    ${atomSvg(element, { animate: !reduced })}
    <p class="note">${esc(t('model'))}</p>
    ${(element.z === 6 || element.z === 33) && state.level !== 'kid' ? `<p class="src">${esc(state.lang === 'es' ? 'Para el carbono y el arsénico, la temperatura de fusión del conjunto de datos es el punto triple.' : 'For carbon and arsenic, the melting figure in the dataset is the triple point.')}</p>` : ''}
    ${early ? `<p class="warn">${esc(t('early'))}</p>` : ''}
    ${element.predicted ? `<p class="warn">${esc(t('predicted'))}</p>` : ''}
    ${radioactive(element) ? `<p class="warn">${esc(t('radio'))}</p>` : ''}
    <div class="facts">
      ${fact(t('protons'), String(element.z))}
      ${fact(t('mass'), `${massLabel(element.mass)} u`)}
      ${state.level !== 'kid' ? fact(t('melt'), tempText(element.melt)) : ''}
      ${state.level !== 'kid' ? fact(t('boil'), tempText(element.boil)) : ''}
      ${state.level === 'deep' ? fact(t('density'), element.density != null ? `${element.density} ${element.densityUnit || ''}` : '') : ''}
      ${state.level === 'deep' ? fact(t('eneg'), element.electronegativity ?? '') : ''}
      ${state.level !== 'kid' ? `<div><span>${esc(t('config'))}</span><strong>${prettyConfig(element.configShort || element.config)}</strong></div>` : ''}
      ${state.level !== 'kid' && element.discoveredBy ? fact(t('found'), element.discoveredBy) : ''}
    </div>
    ${shown ? `<p class="eyebrow">${esc(t('wiki'))}</p><p class="prose">${esc(shown)}</p>${!element.summaryEs ? `<p class="src">${esc(t('wikiEn'))}</p>` : ''}` : ''}
    ${other ? `<div class="facts">
      ${fact(state.lang === 'es' ? 'Contra' : 'Versus', nameOf(other))}
      ${fact(t('protons'), `${element.z} / ${other.z}`)}
      ${fact(t('mass'), `${massLabel(element.mass)} / ${massLabel(other.mass)}`)}
      ${fact(t('melt'), `${tempText(element.melt)} / ${tempText(other.melt)}`)}
    </div>` : ''}
    <div class="acts">
      <button type="button" data-action="speak">${esc(t('speak'))}</button>
      <button type="button" data-action="compare">${esc(other ? t('clear') : t('compare'))}</button>
      <button type="button" data-action="step" data-dir="-1">${esc(t('prev'))}</button>
      <button type="button" data-action="step" data-dir="1">${esc(t('next'))}</button>
    </div>
    <p class="src">${element.summaryEs?.url ? `<a href="${esc(element.summaryEs.url)}" target="_blank" rel="noreferrer">${esc(element.summaryEs.title)}</a> · ` : ''}${esc(t('about'))}</p>`;
  document.getElementById('live').textContent = nameOf(element);
  document.title = `${nameOf(element)} · Tabla Viva`;
}

function renderChrome() {
  document.documentElement.lang = state.lang === 'en' ? 'en' : 'es';
  document.body.classList.toggle('big', state.big);
  document.body.classList.toggle('exhibit', state.exhibit);
  document.getElementById('q').placeholder = t('search');
  document.getElementById('lang').textContent = t('lang');
  document.getElementById('reto').textContent = state.reto ? t('close') : t('reto');
  document.getElementById('more').textContent = t('more');
  document.getElementById('tempLabel').textContent = t('temp');
  document.getElementById('tempValue').textContent = `${state.celsius} °C`;
  document.getElementById('phoneNote').textContent = t('phone');
  renderLegend();
}

function select(z, { scroll = false } = {}) {
  if (state.reto && !state.reto.locked) {
    grade(z);
    return;
  }
  if (state.pickingCompare) {
    state.compare = z === state.z ? null : z;
    state.pickingCompare = false;
    renderCard();
    return;
  }
  state.z = z;
  state.cardOpen = true;
  document.getElementById('card').classList.remove('shut');
  renderTable();
  renderCard();
  if (scroll) document.querySelector(`[data-z="${z}"]`)?.scrollIntoView({ inline: 'center', block: 'nearest' });
  if (state.exhibit) speech(`${nameOf(el(z))}. ${el(z).hook?.[state.lang] || ''}`);
}

function toast(message) {
  const node = document.getElementById('toast');
  node.hidden = !message;
  node.textContent = message || '';
  clearTimeout(toast.timer);
  if (message) toast.timer = setTimeout(() => { node.hidden = true; }, 2400);
}

function chime(ok) {
  if (!state.sound || reduced) return;
  const ctx = new AudioContext();
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.frequency.value = ok ? 680 : 196;
  gain.gain.value = 0.04;
  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.start();
  osc.stop(ctx.currentTime + 0.12);
}

function startReto() {
  const rounds = [];
  const used = new Set();
  const pool = elements.filter((element) => element.z <= 54 || element.hook);
  while (rounds.length < 8 && used.size < pool.length) {
    const pick = pool[Math.floor(Math.random() * pool.length)];
    if (used.has(pick.z)) continue;
    used.add(pick.z);
    rounds.push(pick.z);
  }
  state.reto = { rounds, index: 0, hits: 0, misses: 0, locked: false };
  document.getElementById('retobar').hidden = false;
  askReto();
}

function askReto() {
  const round = state.reto;
  const element = el(round.rounds[round.index]);
  document.getElementById('retobar').innerHTML = `<strong>${esc(t('retoAsk'))} ${esc(nameOf(element))}?</strong><span>${round.index + 1}/8 · ${round.hits}</span><button type="button" data-action="reto-stop">${esc(t('close'))}</button>`;
}

function grade(z) {
  const round = state.reto;
  const target = round.rounds[round.index];
  const element = el(z);
  if (z === target) {
    round.hits += 1;
    chime(true);
    toast(`${t('retoHit')} ${nameOf(el(target))} (${el(target).symbol})`);
    document.querySelector(`[data-z="${target}"]`)?.classList.add('pulse');
    round.index += 1;
    if (round.index >= round.rounds.length) {
      state.reto = null;
      document.getElementById('retobar').hidden = true;
      toast(`${t('retoDone')}: ${round.hits}/8 ${t('score')}`);
      renderChrome();
      return;
    }
    askReto();
    return;
  }
  round.misses += 1;
  chime(false);
  toast(`${t('retoMiss')} ${nameOf(element)} (${element.symbol}).`);
  const tile = document.querySelector(`[data-z="${target}"]`);
  if (round.misses === 1) tile?.style.setProperty('outline', '2px solid var(--gold)');
  if (round.misses >= 3) tile?.classList.add('pulse');
}

function speech(text) {
  if (!text || !window.speechSynthesis) return;
  window.speechSynthesis.cancel();
  const utter = new SpeechSynthesisUtterance(text);
  utter.lang = state.lang === 'es' ? 'es-MX' : 'en-US';
  const voice = window.speechSynthesis.getVoices().find((item) => item.lang?.toLowerCase().startsWith(state.lang));
  if (voice) utter.voice = voice;
  window.speechSynthesis.speak(utter);
}

function fillMore() {
  document.getElementById('moreDialog').innerHTML = `
    <form method="dialog"><button value="cancel">${esc(t('close'))}</button></form>
    <h2>${esc(t('more'))}</h2>
    <label><input id="bigToggle" type="checkbox" ${state.big ? 'checked' : ''}> ${esc(t('big'))}</label><br>
    <label><input id="soundToggle" type="checkbox" ${state.sound ? 'checked' : ''}> ${esc(t('sound'))}</label><br>
    <p><button type="button" id="exhibitBtn">${esc(t('exhibit'))}</button></p>
    <p>${esc(t('about'))}</p>`;
  document.getElementById('bigToggle').onchange = (event) => {
    state.big = event.target.checked;
    localStorage.setItem('tabla-big', state.big ? '1' : '0');
    document.body.classList.toggle('big', state.big);
  };
  document.getElementById('soundToggle').onchange = (event) => {
    state.sound = event.target.checked;
    localStorage.setItem('tabla-sound', state.sound ? '1' : '0');
  };
  document.getElementById('exhibitBtn').onclick = () => {
    state.exhibit = !state.exhibit;
    document.getElementById('moreDialog').close();
    renderChrome();
    if (state.exhibit) exhibitTick();
    else clearInterval(state.exhibitTimer);
  };
}

function exhibitTick() {
  clearInterval(state.exhibitTimer);
  state.exhibitTimer = setInterval(() => {
    const pick = elements[Math.floor(Math.random() * elements.length)];
    select(pick.z, { scroll: true });
  }, 7000);
}

function boot() {
  renderChrome();
  renderTable();
  renderCard();
  document.body.addEventListener('click', (event) => {
    const tile = event.target.closest('.tile');
    if (tile?.dataset.z) {
      select(Number(tile.dataset.z));
      return;
    }
    const button = event.target.closest('[data-action]');
    if (!button) return;
    const action = button.dataset.action;
    if (action === 'lang') {
      state.lang = state.lang === 'es' ? 'en' : 'es';
      localStorage.setItem('tabla-lang', state.lang);
      renderChrome();
      renderTable();
      renderCard();
    } else if (action === 'family') {
      state.family = state.family === button.dataset.family ? null : button.dataset.family;
      renderLegend();
      renderTable();
    } else if (action === 'level') {
      state.level = button.dataset.level;
      localStorage.setItem('tabla-level', state.level);
      renderCard();
    } else if (action === 'speak') {
      const element = el(state.z);
      const bit = state.level === 'kid' ? firstSentence(element.summaryEs?.extract || element.summaryEn || '') : (element.hook?.[state.lang] || '');
      speech(`${nameOf(element)}. ${bit}`);
    } else if (action === 'compare') {
      if (state.compare) { state.compare = null; renderCard(); return; }
      state.pickingCompare = true;
      toast(state.lang === 'es' ? 'Ahora toca el otro elemento' : 'Now tap the other element');
    } else if (action === 'step') {
      const next = state.z + Number(button.dataset.dir);
      if (next >= 1 && next <= 118) select(next, { scroll: true });
    } else if (action === 'reto') {
      if (state.reto) { state.reto = null; document.getElementById('retobar').hidden = true; renderChrome(); }
      else startReto();
    } else if (action === 'reto-stop') {
      state.reto = null;
      document.getElementById('retobar').hidden = true;
      renderChrome();
    } else if (action === 'more') {
      fillMore();
      document.getElementById('moreDialog').showModal();
    } else if (action === 'jump') {
      document.querySelector(`.f-label[style*="grid-row:${button.dataset.row}"]`)?.scrollIntoView({ block: 'center' });
    }
  });
  document.getElementById('temp').addEventListener('input', (event) => {
    state.celsius = Number(event.target.value);
    document.getElementById('tempValue').textContent = `${state.celsius} °C`;
    renderTable();
    renderCard();
  });
  const input = document.getElementById('q');
  const suggest = document.getElementById('suggest');
  input.addEventListener('input', () => {
    const hits = searchElements(elements, input.value);
    suggest.hidden = hits.length === 0;
    suggest.innerHTML = hits.map((element) => `<button type="button" data-z="${element.z}">${esc(element.symbol)} · ${esc(nameOf(element))}</button>`).join('');
  });
  suggest.addEventListener('click', (event) => {
    const button = event.target.closest('[data-z]');
    if (!button) return;
    select(Number(button.dataset.z), { scroll: true });
    suggest.hidden = true;
    input.value = '';
  });
  document.getElementById('searchForm').addEventListener('submit', (event) => {
    event.preventDefault();
    const hit = searchElements(elements, input.value, 1)[0];
    if (hit) select(hit.z, { scroll: true });
    suggest.hidden = true;
  });
  document.getElementById('logo').addEventListener('pointerdown', () => {
    state.logoHold = setTimeout(() => {
      state.exhibit = false;
      clearInterval(state.exhibitTimer);
      renderChrome();
      toast(state.lang === 'es' ? 'Saliste del modo exhibición' : 'Exhibit mode off');
    }, 700);
  });
  document.getElementById('logo').addEventListener('pointerup', () => clearTimeout(state.logoHold));
  window.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
      state.exhibit = false;
      clearInterval(state.exhibitTimer);
      document.getElementById('moreDialog').close();
      renderChrome();
    }
  });
  if (import.meta.env.PROD && 'serviceWorker' in navigator) {
    navigator.serviceWorker.register(`${import.meta.env.BASE_URL}sw.js`).catch(() => {});
  }
}

boot();
