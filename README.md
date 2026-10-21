# Materia

The periodic table as photographs, light, nuclei and history. Tap an element and see the thing itself.

Spanish first; English is in Settings (or add `/en` to any link, like `#fe/luz/en`).

Live: https://vdm285.github.io/interactive-science/

## What you can do

- **Lenses on the table**: photographs of every element Commons has; families; state at any temperature (drag it: mercury and bromine stay liquid at 25 °C, iron melts at 1,538 °C); which elements were known in any year since 1650; every atom's visible emission spectrum; atomic size to scale; heatmaps of electronegativity, density, melting and boiling points, ionization energy, mass, crustal abundance and discovery year.
- **An element as a deck**: a photograph with its credit, the spectrum drawn from NIST lines (hover for the wavelength), a Bohr drawing with the configuration and orbital boxes, every known isotope with half-lives and abundances, the discovery with its people and a timeline of all 118, abundance in five media, the Wikipedia articles' images, and every number with its source.
- Keys: `/` search, arrows, Esc.

## Run it

```bash
npm install
npm test
npm run dev
```

Open http://localhost:5174. Data is committed; `npm run data:all` rebuilds everything from the sources (see `docs/PIPELINES.md`).

## What is real

Every number comes from a named file in `public/data/`, each with its source and license: Bowserinator's Periodic-Table-JSON (CC BY-SA 3.0), PubChem (public domain), NIST Atomic Spectra Database 5.12 (public domain, cited), the IAEA Live Chart of Nuclides (NUBASE2020/ENSDF, acknowledged), Wikidata (CC0), Wikipedia (CC BY-SA 4.0) and Wikimedia Commons (per-file license shown next to every image). Nothing is invented; where a source lacks a value, the screen says so.

## Docs

`AGENTS.md` (rules and map), `HANDOFF.md` (state of the code), `docs/VISION.md`, `docs/PIPELINES.md`, `docs/EDITORIAL.md`, `docs/research/`.

MIT for the code. Data and media keep their own licenses.
