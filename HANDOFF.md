# Handoff — 2026-10-15

The idea lived in `vdm285/ideas` at `interactive-science/` as a sketch called Tabla Viva. This repository is the product.

## Shipped

- All 118 elements, Spanish classroom names, search aliases for the RAE forms.
- Family colors, and a temperature slider that recomputes solid / liquid / gas from melt and boil.
- Bohr drawing from the shell array, with a dashed ring when an outer shell starts early.
- Wikipedia paragraph (Spanish when `fetch-es` has filled it, otherwise English and the card says so).
- Reto quiz, compare, read-aloud, large type, exhibit mode.
- Tests for shells, phase, search and radioactivity.

## Still thin

- A few elements may lack a Spanish Wikipedia extract if the title did not match. Re-run `node tools/fetch-es.mjs && node tools/build-elements.mjs`.
- No photos. The dataset’s image links were left out on purpose (mixed licences).
- No kitchen experiments. They need a teacher’s review before they go on a child’s screen.
- Phone tiles scroll sideways. A rotated layout was in the sketch and is not rebuilt here.
- Anatomy, ecology and physics forks are not started.

## Verify

`npm test`. Dev server: `npm run dev` on port 5174.
