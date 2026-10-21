# Handoff

The state of the code, dated. `docs/VISION.md` is the plan; this file is what exists. Newest section first.

## 2026-10-21 — the rebuild, first checkpoint

Rebuilt from scratch as **Materia** (working name) in one unguided session, mining the first version (Tabla Viva, 2026-10-15) for the Spanish names, the phase rule and tests, and the Pages workflow. Victor has not yet reviewed any of it; expect direction changes.

### Shipped

- **Shell**: no wordmark, no header. Lens (search) top-left, cog (Settings) bottom-left, both translucent. Settings holds language (Spanish default, English), photos on/off (simple mode), animations, the seen marks, About and the full source list with licenses.
- **Table** (`src/table/`): fills the viewport; tiles are 160 px WebP photographs with the symbol and number overlaid, the name on hover, a gold dot for elements already opened in this browser. Seven lenses on a bottom rail: Fotos, Familias (chips isolate a family), Estado (temperature slider −273 to 6000 °C; liquid, gas and unknown tiles restyled; predicted phases labeled), Historia (year slider 1650–2026 with a count of known elements), Luz (each tile is its NIST spectrum strip), Tamaño (circles to scale by empirical radius), Datos (heatmap with a property picker and a legend). A readout line names the hovered element and its value under the lens.
- **Deck** (`src/element/`): panels passed sideways with scroll-snap, wheel, arrows and a shelf; neighbors by Z with up/down keys and the shelf's end buttons; a mini-table medallion bottom-right (tap a square to jump, tap the field to go back); Esc or the chevron return. Panels: Materia, Luz, Átomo, Núcleo, Historia, Mundo, Imágenes, Datos; hidden when the element has no data for them.
- **Routes**: `#fe`, `#fe/nucleo`, `#tabla/luz`, optional `/en`. The lens, temperature, year, property and language persist in localStorage.
- **Data**: eight pipelines, see `docs/PIPELINES.md`. Committed outputs: elements (118), spectra (97 elements), isotopes (3,383 nuclides), history (112 dates, 108 discoverers), abundance (5 media), photos (98 elements, 273 KB of tiles), wiki (118 ES + 118 EN extracts), galleries.
- **Tests**: `npm test`, 10 tests on the pure rules. **Build**: 77 KB JS, 20 KB CSS.

### Decisions and liberties taken (all mine, none confirmed by Victor yet)

1. Rebuild rather than patch; lit-html for templates (escapes by default, keyed re-renders).
2. Working name **Materia**; shortlist in the checkpoint message.
3. The deck of panels for an element (the shape Victor chose for countries in Giramundo), with panels hidden when empty rather than shown empty.
4. Lenses as a bottom rail of chips: the one fixed control besides the two corners, because it is used constantly.
5. Reading levels (8/12/15), the quiz, read-aloud, exhibit mode, compare and the hand-written "hooks" from the first version were removed. Hooks because they were unsourced sentences; the rest because they were chrome. Quiz and compare are parked in VISION.
6. Spanish is the default regardless of browser locale; English is a setting or a `/en` suffix.
7. Fonts kept from the first version (Fraunces display, Outfit body).
8. Hero and gallery images are hotlinked from Commons at standard widths; only the 160 px tiles are committed, to keep the repository small.
9. Bismuth is shown as radioactive because the IAEA data says so, with a note; carbon and arsenic's melting figure is labeled as the triple point.
10. Curation calls in overrides: nihonium filed with the post-transition metals (Bowserinator's text says "probably transition metal"); radon, francium and fermium forced to "no photograph" because Commons' images were not the element.
11. Abundance quotes one column per medium from the references Wikipedia's data page cites, with the licensing reasoning in `docs/research/abundance-sources.md`.

### Self-audit log (what the loop found and fixed before the checkpoint)

- Interface opened in English on an English-locale browser → Spanish forced as default.
- Post-transition metals were classed as transition (substring order) → fixed, test added.
- Commons refused 640 px thumbnails (HTTP 400, standard widths only since 2026) → `commonsThumb` snaps widths; photos and gallery rebuilt; lesson added to the playbook.
- Ancient elements read "discovered in 5000 BCE" → "known since antiquity" with Wikidata's circa date beside it; the timeline gained an antiquity bucket and stacked dots.
- Isotope mass-number labels were clipped; a stray vertical scrollbar on every panel; the "no photograph" note hid under the hero gradient; the medallion was too faint to find → all fixed.
- Gas tiles in the state lens had white text on a pale tile → dark text.
- Copernicium shows liquid at 25 °C from predicted figures → labeled "predicción".
- Search opened without focus from the `/` key → focus is now applied after render.

### Known limits

- Phone layout works (horizontal scroll on the table, stacked panels) but is not designed; desktop first by decision.
- The isotope strip has no numeric axis; hover gives the numbers.
- Pronunciation audio depends on Lingua Libre coverage on Commons.
- Universe abundance exists for ten elements only (Croswell's list); the panel shows the bar only where there is a figure.
- No compounds, no reactions, no minerals beyond what the Wikipedia articles' images happen to show.

### If you continue

1. Read Victor's checkpoint answers (name, direction, feature cards) before touching the UI.
2. Keep every change paired with its doc update in the same commit.
3. Re-run a pipeline rather than editing its output; put curation in `data/overrides/`.
4. Check the photo curation list in the photos pipeline report (low-resolution picks for F, As, Ce, Pr, Nd, Tb, Dy, Ho, Ra, Np, Bk, Cf, Es; sulfur and platinum are native specimens; oxygen is a discharge tube though a liquid-oxygen photo exists).
