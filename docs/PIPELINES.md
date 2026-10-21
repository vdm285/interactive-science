# PIPELINES.md — how data gets in

Materia is static. Every number and every image reference is produced at build time by a script in `tools/`, written under `public/data/` (and `public/img/tiles/`), committed, and shipped by `vite build`. Nothing is fetched from a data source at runtime except the images themselves, hotlinked from Wikimedia Commons at standard widths.

All scripts share `tools/net.mjs`: a polite `fetchRetry` with the project User-Agent and retries on 429/5xx, a disk cache under `data/cache/<sub>/` (on D:, gitignored; a second run is free), a bounded `pool`, `sparql` for Wikidata, `commonsInfo` for file licenses, `licenseOk` (CC0, CC BY, CC BY-SA, public domain, FAL, GFDL; never NC or ND), `commonsThumb` (snaps widths to Wikimedia's standard list: 20, 40, 60, 120, 250, 330, 500, 960, 1280, 1920, 3840; other widths answer 400 since 2026), and `writeJsonCapped` so a file cannot silently grow past its byte cap.

Curation never edits an output: it goes into `data/overrides/<pipeline>.json`, documented inside each file, and the pipeline is run again.

Run everything with `npm run data:all`, or one at a time:

| script | npm | output | cap | source and license |
|---|---|---|---|---|
| `build-elements.mjs` | `data` | `elements.json` | 160 KB | Bowserinator Periodic-Table-JSON (CC BY-SA 3.0) + PubChem periodic table (public domain, NLM acknowledgment) + `tools/names.mjs` |
| `build-wiki.mjs` | `wiki` | `wiki/{z}.json`, `wiki/index.json` | 14 KB each | Wikipedia REST summaries ES and EN (CC BY-SA 4.0); Lingua Libre pronunciations on Commons when they exist |
| `build-photos.mjs` | `photos` | `photos.json`, `img/tiles/{z}.webp` | 120 KB, 1 MB of tiles | Wikimedia Commons (Wikidata P18 first, then element categories); per-file license checked |
| `build-spectra.mjs` | `spectra` | `spectra.json` | 450 KB | NIST Atomic Spectra Database 5.12 (public domain, citation requested) |
| `build-isotopes.mjs` | `isotopes` | `isotopes.json` | 700 KB | IAEA Live Chart of Nuclides API, ground states (NUBASE2020, ENSDF; IAEA terms: acknowledge the source) |
| `build-history.mjs` | `history` | `history.json` | 150 KB | Wikidata (CC0): P575, P61, P138, P189, sitelinks |
| `build-abundance.mjs` | `abundance` | `abundance.json` | 60 KB | Wikipedia "Abundances of the elements (data page)" and two sibling pages, quoting CRC, Anders & Grevesse, Croswell and the human-body table; see `docs/research/abundance-sources.md` |
| `build-gallery.mjs` | `gallery` | `gallery/{z}.json`, `gallery/index.json` | 40 KB each | The ES and EN Wikipedia articles' own media lists; Commons license per file |
| `build-videos.mjs` | `videos` | `videos.json` | 60 KB | periodicvideos.com element pages (keyless), each id verified through YouTube oEmbed; embedded with the nocookie player |

## Elements

`https://raw.githubusercontent.com/Bowserinator/Periodic-Table-JSON/master/PeriodicTableJSON.json` and `https://pubchem.ncbi.nlm.nih.gov/rest/pug/periodictable/JSON`. Bowserinator gives masses, phases, melt and boil in K, densities (g/L for gases, g/cm³ otherwise, plus `densityGcm3`), molar heat, shells, configurations (a `*` marks unconfirmed ones; we keep a `configPredicted` flag), Pauling electronegativity, electron affinity and successive ionization energies in kJ/mol, radii in pm, appearance, discoverer strings and the table positions (`x`, `y`; rows 9 and 10 are the f-block). PubChem adds oxidation states, first ionization energy and electron affinity in eV, the standard state wording, the CPK color and a discovery year or "Ancient" (`ancient: true`). Families come from Bowserinator's category text with the group as tie-breaker; "unknown, probably…" categories set `familyUncertain`. Overrides: `data/overrides/elements.json` (nihonium's family is the one example, with its reason).

Known gaps the screen must tolerate: no melting point for Db–Rg and Og; no boiling point for C, P, As (sublimation) and Fm–Rg; no density for Fm–Lr; no radius above Cf; no electronegativity for He, Ne, Ar and Rf–Og. Carbon and arsenic's "melt" is the triple point and the Datos panel says so.

## Wikipedia extracts

`https://{es,en}.wikipedia.org/api/rest_v1/page/summary/{title}`. Spanish titles come from `tools/names.mjs` plus a small map for titles that need disambiguation (Zinc, Criptón, Circonio, Indio (elemento), Yodo, Tántalo (elemento), Wolframio, Mercurio (elemento), Radio (elemento)). Disambiguation pages are rejected. The REST summary is only the first paragraph, so the script also asks the MediaWiki extracts API (`prop=extracts&exintro&explaintext`) for the whole lead section, keeps the longer text, cuts it at a sentence under 2,200 characters and strips the zero-width residue of citation markers. Each file carries `title`, `extract`, `url` and the short `description` per language. The index says which languages and whether a pronunciation exists so the app can decide before fetching.

## Photographs

Order of preference per element: the Wikidata `P18` image of the element item, then files in the element's Commons category, then nothing (synthetic elements). Each candidate's `extmetadata` is fetched; only `licenseOk` files survive. The entry records the file, the kind (sample, tube, crystal, other), hero and medium thumbnail URLs at standard widths, dimensions, artist, license, license URL and the Commons page. The tile is a 160×160 cover crop written as WebP (quality 70) by sharp, under 10 KB each; the `focus` field in `data/overrides/photos.json` moves the crop. The override can also force a file or force `null`.

## Spectra

NIST ASD lines form, queried per element with the exact astroquery parameter set (any smaller set is answered with "Invalid Column Setting"): `spectra=Fe+I`, 380–780 nm, `unit=1`, `format=3` (tab-delimited), `show_av=2` (air wavelengths), intensities on. Rows without an observed wavelength or a numeric intensity are dropped; qualifiers like `bl`, `*`, `(20)` are stripped. Per element: `species`, `count` (all usable lines in range), `lines` (the 160 strongest as `[nm, 0..1]`, normalized to the element's strongest line, merged at 0.1 nm), and `bins` (200 integers 0..255 over 380–780 nm on a square-root scale, from every line). 97 elements have data; At, Fr and 100–118 are `null` (Fr has lines but no intensities, so nothing drawable). One request per second, cached; a full cold run takes about four minutes. The `source` block stores NIST's version and citation as read from its own page.

## Isotopes

`https://nds.iaea.org/relnsd/v1/data?fields=ground_states&nuclides=all`, one CSV of 3,386 rows (3,383 nuclides after dropping the free neutron). Per element: `known`, `stable`, `stableA`, `mostAbundant`, `longest` (longest-lived unstable isotope), `radioactive` (no stable isotope) and the `isotopes` list with `a`, `n`, `stable`, `abundance` (%), `halfLifeSec`, `halfLife` (source value and unit, with `>`/`<`/`≈` for operators and `width: true` when the source gave a resonance width), `decays` and `jp`. 44 nuclides have a natural abundance without being stable (K-40, Rb-87, Bi-209, Th-232, U-235/238…), so bismuth, thorium and uranium are radioactive by the data and still have a most abundant isotope. The IAEA terms ask for acknowledgment; the `source` block holds their wording.

## History

Wikidata: one SPARQL for the item per atomic number, then `wbgetentities` in batches for claims and sitelinks, then one label pass in `es|en|mul` (the `mul` label matters: names like Marie Curie moved there in 2024). Deprecated statements are skipped. `discovered` is the earliest P575 (later dates stay in `discoveredAll`), with `precision` and the qualifier text in `discoveryNote`; `discoverers` (P61), `namedAfter` (P138) and `discoveryPlace` (P189) carry `qid`, `es`, `en` and descriptions. Coverage: date 112/118, discoverer 108/118, named after 111/118. Known oddities (Wikidata is a filing cabinet): hydrogen lists Lomonosov and "Russian Empire"; seaborgium and bohrium list only Oganessian; copper's date is "circa −7000". Overrides: `data/overrides/history.json` (per Z, fields to force).

## Abundance

One figure per element per medium: crust (CRC Handbook, mg/kg), sea water (CRC, mg/L), Solar System (Anders & Grevesse 1989, atoms per million Si), human body (the "Composition of the human body" table, mg/kg; ranges are null), universe (Croswell 1996, ten elements only). Parsed from the pinned revisions of the Wikipedia pages named in the `source` block; blank cells are null, not zero. The licensing reasoning and the upgrade path (Asplund 2021, Lodders 2009) are in `docs/research/abundance-sources.md`.

## Gallery

`https://{es,en}.wikipedia.org/api/rest_v1/page/media-list/{title}`, merged by file title with the Spanish caption first. Filtered out: non-images, SVG and GIF, icons and logos, periodic-table overviews, electron-shell diagrams, the NFPA diamond, anything under 400 px wide, and any file whose Commons license fails `licenseOk`. At most 24 per element, the Spanish article's first image first. Each item: file, `thumb` (500 px) and `src` (1280 px) URLs, dimensions, captions, artist, license, license URL, Commons page. `data/overrides/gallery.json` can exclude, include or pin the first image.

## Videos

`http://www.periodicvideos.com/videos/{ZZZ}.htm` (three digits; the site's HTTPS certificate belongs to its host, so plain HTTP is used and recorded) carries one YouTube iframe per element. Every id is verified keylessly with `https://www.youtube.com/oembed?url=...` and kept only when the channel is exactly "Periodic Videos" (University of Nottingham, Brady Haran). 118 of 118. The app embeds `https://www.youtube-nocookie.com/embed/{id}` only after the reader taps the poster; nothing is downloaded or re-hosted. `data/overrides/videos.json` forces or removes an id.

## Adding a source

Write `tools/build-<name>.mjs` importing from `net.mjs`; cache every request; read `data/overrides/<name>.json` if it exists; write with `writeJsonCapped` and a `source` block (name, url, license, citation or terms, retrieval date); add the npm script; print a verification line for iron, carbon, mercury, tungsten and oganesson; document it here and credit it in Settings (`src/app/shell.js`) and in the panel that shows it.
