# AGENTS.md — Materia

Read this before changing the app. `docs/VISION.md` says where the product is going and why. `HANDOFF.md` is the state of the code, dated. `docs/PIPELINES.md` is how data gets in and how to curate it. `docs/EDITORIAL.md` is the rule for words and media on a screen. `D:\_GitHub\revamp-playbook.md` (outside the repo) is how the owner works.

Owner: Victor (github.com/vdm285). The app opens in Mexican Spanish; English is a setting (or `/en` at the end of the hash), never a second site. Audience: curious adults and his friends; kid mode is parked.

## What this is

A static periodic table on GitHub Pages, media first. The table fills the viewport and is read through lenses (photographs, families, state at a temperature, history by year, emission spectra, atomic size, property heatmaps). An element opens as a deck of full-screen panels passed sideways: Materia (a photograph of the element), Luz (its visible emission spectrum from NIST lines), Átomo (Bohr drawing, configuration, orbital boxes, radius, energies), Núcleo (every known isotope from the IAEA), Historia (discovery and naming from Wikidata, a timeline of all elements), Mundo (abundance in crust, sea, body, Solar System, universe), Imágenes (the Wikipedia articles' own images with captions and licenses), Datos (every number with its source, both Wikipedia extracts, links out, an "ask an AI" link). Panels with no genuine data for an element are hidden. There is no server, no account, no key in the browser.

## Do not

- Add a temperature, a mass, a year, a percentage or a line that is not in a file under `public/data/`. If a source lacks it, the screen says so.
- Draw element 119. It is not an official element.
- Show an image without its author, license and a link to the Commons file page. Reject NC and ND licenses at build time (`licenseOk` in `tools/net.mjs`).
- Hotlink a Commons thumbnail at a width outside Wikimedia's standard list (`commonsThumb` snaps it; direct 640px links answer 400 since 2026).
- Copy text from Ptable, the RSC table or Theodore Gray. Our words are our own; long paragraphs are Wikipedia's, linked and credited CC BY-SA.
- Remove the Bohr-model caption. The drawing is a simplification.
- Edit a file under `public/data/` by hand. Fix the pipeline or add to `data/overrides/`.
- Add a wordmark, a header bar or a fixed control that is not used constantly. Everything else goes into Settings.
- Put caches or downloads on C:. `data/cache/` is on D: and gitignored.

## Where things live

- `src/main.js`: boot, keyboard, the spectrum canvas hookup. `src/app/store.js`: one state object and `set()`. `src/app/router.js`: hash routes (`#fe`, `#fe/nucleo`, `#tabla/luz`, `/en` suffix). `src/app/i18n.js`: every interface string, ES then EN. `src/app/shell.js`: the two corner controls, search and the Settings sheet.
- `src/table/table.js`: the stage, tiles, rail and controls. `src/table/lenses.js`: what each lens paints (family colors, the sequential ramp, property definitions, discovery year).
- `src/element/deck.js`: panels container, shelf, medallion, wheel and keys. `src/element/panels.js`: the eight panels.
- `src/draw/atom.js` (Bohr SVG), `src/draw/spectrum.js` (canvas spectra and the tile strips).
- `src/logic.js`: pure rules with `tests/logic.test.mjs` as the spec. `src/data/load.js`: two-phase loading and per-element lazy files.
- `tools/net.mjs`: shared fetch, disk cache, SPARQL, Commons metadata, license filter, thumbnail widths, byte-capped writes. `tools/build-*.mjs`: one pipeline per source (see `docs/PIPELINES.md`). `tools/names.mjs`: Spanish classroom names and RAE aliases.
- `public/data/`: committed outputs (`elements.json`, `spectra.json`, `isotopes.json`, `history.json`, `abundance.json`, `photos.json`, `wiki/{z}.json`, `gallery/{z}.json`). `public/img/tiles/{z}.webp`: 160px tile photographs. Heroes and gallery images are hotlinked from Commons at standard widths.
- `data/overrides/*.json`: per-subject curation, read by the pipelines, documented inside each file.
- lit-html renders everything and escapes by default; never use `unsafeHTML` on fetched text.

## Checks

`npm test`, then `npm run dev` (port 5174), then look at iron (`#fe`) through all panels, carbon, mercury (liquid at 25 °C in the state lens), tungsten via the search "wolframio", and oganesson (no photo, no spectrum, no abundance: those panels must be absent, the Bohr model stands in). Drag the temperature past iron's melting point and the tile must turn liquid; drag the year to 1869 and the table should show 65 known elements. `npm run build` must stay under 300 kB of JS. Nothing on a screen may be invented.
