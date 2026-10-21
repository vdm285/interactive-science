# Handoff

The state of the code, dated. `docs/VISION.md` is the plan; this file is what exists. Newest section first.

## 2026-10-21, evening — Victor's second review: side cards, glass boxes, a portfolio

His verdict on the round above: the band is rejected (the table must own the viewport always), the CSS zoom-and-door is rejected ("cheap PowerPoint"), the element info should be a card over the table on the side away from the element, and the real vision is a case of glass boxes with live 3D atoms, a zoom that keeps the neighbors, a glass door, and a push into the atom. He asked for a portfolio of rough working demos before any full implementation. Full note in `docs/VISION.md`.

### Done in response

- **Side card replaces the band** (`src/table/peek.js`, `src/style.css`): the table stays full size; the card slides in on the right for columns 1–9 and on the left for 10–18 (f-block rows by column too), translucent dark glass, hero on top, capsule, pronunciation, doors in two columns, Entrar, a close button; Escape or a click on the table's empty space closes it; clicking another tile swaps the card and flips the side when needed. The old dive stays wired behind Entrar until the portfolio pick replaces it; it is known to be rejected.
- **Portfolio** (`docs/portfolio/`): `SPEC.md` (shared requirements, the three options), `demo-data.js` (real element data embedded), three prototypes built by parallel sub-agents, reviewed against the spec by adversarial reviewers, fixed, and verified by eye: A Vitrina https://claude.ai/artifact/JkP9ZaEgtCEk5drtXAmox7 · B Holograma https://claude.ai/artifact/E7iQtK8UpuWjGztpsnUCCj · C Caja https://claude.ai/artifact/H4chyw5bGi398noUgDSDhH (table in `docs/portfolio/README.md`).
- **Cutouts plan**: `docs/research/cutouts.md`.

### Victor picked (same evening)

- **Vitrina** is the table, with Holograma's shell fly-through in the push-in; the bloom resolves directly into the element's photograph (the deck's Materia panel); the lenses become light inside the boxes; the CSS table stays as the simple mode; cutouts prototyped on ten elements. The implementation plan is `docs/portfolio/INTEGRATION.md`; `three` 0.160.0 is a dependency, loaded as a separate chunk. The port runs as a four-stage workflow (port, lenses, adversarial review, fix) with a dated subsection below when it lands.

## 2026-10-21, later — Victor's direction: the table never disappears

Victor's answers to the checkpoint cards: name **Materia**; the table must stay on screen as the universe (as the globe should in Giramundo); wide exploration from element to element without losing it, and a second tap on the highlighted element that zooms into its tile and opens like a door into the deep dive; lenses folded into one button; next round is media depth; desktop first, phones later. His full note is in `docs/VISION.md`.

### Shipped in this round

- **Three layers.** Table (full viewport) → **peek** (`#fe`): the stage animates into a 36vh band along the top (`@property --tile` makes the tile size itself transition), the highlighted tile lifts with an "Entrar ›" pill under it, and the element's world fills the rest: hero photograph (tap to dive), name, capsule, pronunciation, a row of **doors** (one per available panel, each with a live visual: the spectrum strip, a mini Bohr, isotope counts, the discovery year, crustal abundance, the first gallery image, the video poster, the mass) and a hint line. Arrow keys walk the table in the peek; Enter dives; Escape returns to the full table. → **deep** (`#fe/luz`): the deck as before; Escape, the chevron or the medallion field **surface** back to the peek.
- **The dive** (`src/app/transitions.js`): one fixed element wearing the hero photo grows from the tile's rectangle to the viewport (620 ms), the deck mounts beneath it, and the face swings open on its left hinge (`rotateY(-108deg)`, 720 ms) and is removed. The surface runs it backwards: door closes, face shrinks to the tile in the band. With animations off both are instant. No WebGL, no library.
- **Lenses** are one translucent button bottom-right showing the current lens; its popover lists the seven with a line of help each and the family or property chips. The temperature and year sliders, and the heatmap legend, float as a pill at the bottom center only on the full table.
- **Video panel**: the Periodic Videos episode per element (118 of 118, ids verified keylessly through YouTube oEmbed), a poster with the channel's own thumbnail, and the nocookie player only after a tap. Pipeline in `tools/build-videos.mjs`.
- Readout line moved to the top center. Phone breakpoint at 640 px.

### Liberties in this round

1. The band is a 36vh strip along the top (not a side column): the table is wide, so the top keeps it legible at 28 px tiles on a 1440 px screen; names come through the readout and the hover.
2. The peek is the Materia panel's content plus doors; the deck still opens on Materia (full-bleed photo and "Leer"), so the door animation lands on the same picture that was just zoomed.
3. Doors dive straight to their panel; the hint sentence explains the second tap once, under the doors, and the pill makes it visible.
4. The animation is CSS only, by design: lightweight, no GPU work beyond one composited layer, nothing to download. Blender is not needed.

### Media depth, first pass

- Every element photograph was reviewed at 500 px by a sub-agent; 17 weak picks replaced through `data/overrides/photos.json` (liquid oxygen, refined sulfur, grown platinum, a clear mercury pour, the Hi-Res Images set for seven lanthanides and arsenic, a DOE uranium billet, and so on), each with a `_notes` line. Seven transuranic pictures stay low-resolution because Commons has nothing better; the notes say so.
- Periodic Videos: 118 of 118 episodes, keyless, verified through oEmbed; a Video panel and a door.
- Galleries curated through `data/overrides/gallery.json` from the pipeline's own curation list: 68 images excluded (namesake planets and gods, price charts, trains and towers, mushroom clouds, burned hands, a gas attack), first images set for Cf, Md, Lr; Db and Ds end with no gallery and lose the door.
- **Cosas** panel (`cosas` in `src/element/panels.js`, data `public/data/things/{z}.json` from `tools/build-things.mjs`): minerals and ores whose formula carries the element (Wikidata P274 plus the "minerals by element" categories), and objects made from it or its alloys (P186, P527, P366), each with a Commons photo, Spanish and English labels, the formula and a link to Wikipedia. Research and coverage in `docs/research/things-sources.md`; curation in `data/overrides/things.json`.
- Wikipedia extracts are now the whole lead section (MediaWiki extracts API), not the first paragraph.

### If you continue from here

1. Victor has not yet seen the peek, the dive or Cosas; expect direction. The band placement (top strip) is my baseline; a side column or a bottom strip is a layout-only change.
2. Things curation: famous unlinked objects go in by QID in `data/overrides/things.json` (a curation pass ran on 2026-10-21; see its notes there). The objects half is limited by Wikidata's own coverage.
3. Parked: compounds as a second level under an element, quiz and compare as modes, phone polish, a `via` provenance tag on things cards.

### Audit log for this round

- The body carried a `peek` class for the view and the `.peek` layout rule hit the body itself (position fixed, top 36vh); renamed to `peeking`. Rule written into AGENTS.md.
- The browser pane, when hidden, freezes CSS transitions at their start value and its screenshots came back cropped at device pixels; measurements had to be taken from the DOM. Lesson added to the playbook.
- Still to verify by eye: the door swing mid-animation on a real GPU (Victor's Chrome).

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
- On a reload straight onto `#fe/imagenes` the deck stayed on the wrong slide because Luz and Mundo arrived after the first paint and shifted the slides; the gallery's lazy images therefore never started → the scroll now follows the panel id after every layout change, and scroll events are ignored briefly after a programmatic jump.
- Iron's gallery carried a photon-attenuation chart → plots, charts, diagrams and schematics are rejected by title in the gallery pipeline.
- The phone layout kicked in below 900 px, which includes a narrow desktop pane → 640 px.
- A discoverer's description ran into the next discoverer's name → commas, "y", parentheses.
- Verified by hand after the fixes: hover names on tiles, the "Leer" fold, the lightbox with its credit, search by alias ("wolfr" → Tungsteno), the Settings sheet, the live Pages site (`#w/luz` renders tungsten's 2,774 lines).

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
