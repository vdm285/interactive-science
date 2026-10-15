# AGENTS.md — Tabla Viva

Owner: Victor (github.com/vdm285). The app opens in Spanish. English is the EN button.

## What this is

A static periodic table for a phone or a big screen. Every number on a tile or in the fact grid comes from `src/data/elements.json`. Long paragraphs are Wikipedia extracts, linked and licensed CC BY-SA.

## Do not

- Add a temperature, a mass, a year or a percentage that is not in the data file.
- Draw element 119. It is not an official element.
- Copy text from Ptable, the RSC table, or Theodore Gray.
- Remove the Bohr-model label. The picture is a simplification.

## Where things live

- `src/logic.js` — family, phase at a temperature, search, shell check. `tests/logic.test.mjs` is the spec.
- `src/main.js` — table, card, quiz, temperature slider.
- `src/atom.js` — the Bohr drawing.
- `tools/build-elements.mjs` — turns `data-cache.json` plus Spanish names into `src/data/elements.json`.
- `tools/fetch-es.mjs` — Spanish Wikipedia intros into `src/data/summaries-es.json`. Run it, then run `build-elements` again.

## Checks

`npm test`, then `npm run dev`, then look at carbon, mercury (liquid at 25 °C), and tungsten via the search “wolframio”. Drag the temperature past iron’s melting point and the tile should change.
