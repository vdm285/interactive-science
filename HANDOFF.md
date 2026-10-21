# Handoff

The state of the code, dated. `docs/VISION.md` is the plan; this file is what exists. Newest section first.

## 2026-10-21, late night — the review fixes (stage 4 of the workflow)

The adversarial review of the 3D table (stage 3) found four majors and six minors; all four majors and five minors are fixed here, one minor is Victor's call. Verified in the desktop browser pane at 1600 × 900 with a 50 ms sampler over `window.__materiaScene.debug` (dev only: the dive record, the door poses and the upload memo).

### Fixed

- **Surface from another element than the dive's** (`src/scene/scene.js`): the door memo (`last.door`) stayed at the open angle after a dive, so a surface from a deck that had moved to a neighbor (medallion, shelf, up/down keys) skipped the new element's door pose and the camera pulled out through a closed pane. `startSurface` and `startDive` now reset the memo and close the previous element's door. Measured: dive into Fe, ArrowDown to Co, Escape → first backward frame has Fe at 0 and Co at −1.75 rad, ends at `#co` with the card and the pill back.
- **Unmount during a transition** (`scene.destroy` → `settle()`, `stage3d.unmount`): a dive or surface in flight now settles when the scene is destroyed (Settings → Sencilla mid-dive, Automática's drop, a context loss): the pending `onMount` / `onUnmount` and `onDone` run, so the deck opens or closes, the transitions' promise resolves and `body.diving` is removed. The surface's 500 ms veil timer is tracked and cleared too, and `scene.diving` is true during it. Automática's `onSlow` is deferred while a transition runs. Measured: Sencilla clicked 0.8 s into a dive → deck at `#fe/materia`, `body.diving` off, the grid up; Escape then crossfades back to `#fe`.
- **Door dives land on Materia** (`stage3d.sceneDive`): the scene always mounts the deck on Materia (the bloom resolves into the hero, INTEGRATION.md step 4) and, once the veil has dissolved, glides to the door's panel (`openPanel` + `scrollToPanel`). Measured from the Luz door in copper's card: `#cu` → `#cu/materia` (deck) → `#cu/luz`, slide on luz. The crossfade path still opens the panel directly.
- **The seen dot in 3D** (`lenses3d.js` `L.seen`, `shaders.js` `aSeen` on the door, `boxes.js`): a gold disc (`--gold`, 0.8) at the door's top-right, where the tiles draw theirs, driven from `state.seen` through `applyLens` and uploaded only when it changes. Measured: 16 stored → 16 in the array, the dot visible on hydrogen's door and absent on lithium's.
- **The veil holds until the deck has rendered** (`scene.js`): `setCovered(true)` during a dive marks the deck ready, the dissolve clock starts on the first frame drawn after that, and the dive does not finish until the veil is gone (`veilGone`); if the route never covers the scene, the dissolve starts 1.5 s after `onMount`. `diveState.bloomA` is gone from `camera.js`. Measured: deck in at t = 0.84 with the veil at 0.99, dissolve 0.93 → 0 over the next ~450 ms of frames; a 400 ms stall of the loop during the deck's first render (seen in the pane) no longer jumps the veil.
- **Keys during a transition** (`src/main.js`): `onKey` returns early when `isBusy()` (after the lightbox, settings, lens and search Escapes), as the pointer layer does. Measured: ArrowRight 1 s into a dive leaves the hash at `#fe`.
- **Context loss** (`scene.js`, `stage3d.js`, `i18n.js` `sceneLost`, `shell.js`): `webglcontextlost` stops the loop and starts a 3 s timer; `webglcontextrestored` cancels it and resumes; otherwise `sceneFallback: 'lost'` drops to the simple mode with its own Settings line, and any Calidad choice clears it. Measured with `WEBGL_lose_context`: lose + restore within 0.8 s → loop back at 8 calls, 33,722 triangles; lose alone → the grid after 3 s and the line "Se perdió el contexto gráfico…"; Automática brings the canvas back.
- **Familias as light** (`lenses3d.js`): the floor washes in the family color for every box (Fe → 0.851, 0.706, 0.318, mode wash; 118 washed), so the lens reads before a chip is tapped; isolation still dims the others to 15 %.
- **VISION.md**: the "table never disappears" paragraph now describes the side card and the 3D dive, with the rejected band and CSS door noted as the first draft.

### Skipped

- **The JS budget line in INTEGRATION.md** (450 kB total including three): the build is app 95.57 kB + scene 489.89 kB raw / 127.68 kB gzip (the seen dot, the veil hold and the settle logic added 1.9 kB raw). Amending the non-negotiable to "app chunk under 100 kB; scene chunk lazy, under 500 kB raw / 130 kB gzip" or budgeting a slimmer renderer is Victor's decision; the spec is left as he wrote it.

### Measured

- `npm test` 10/10; `npm run build` as above.
- The pane rendered at ~30 fps (its compositor); the dive's loop stalls for ~400 ms when the deck first renders there, which is exactly the case the veil hold covers. Still no eye on a real GPU.

## 2026-10-21, late night — every lens as light inside the boxes (stage 2 of the workflow)

The "Lenses as light inside the box" section of `docs/portfolio/INTEGRATION.md`, complete. The lens controls, the readout and the popover are untouched; what changed is what the boxes show. Verified in the desktop browser pane at 1600 × 900 from the lens arrays (`window.__materiaScene.lens`, dev only) and from the first screenshots, before the pane's captures went cropped again.

### What exists

- **`src/scene/lenses3d.js`** maps the state to one value per element: `dim` (familias isolation, historia unknown), `atom` (scale, lift, show, dash), `spin` (orbit speed), `frost`, `floor` (r, g, b, mode: plain, wash, hatched), `wall` (atlas slot, kind: none, photo, spectrum) and `glow` (nucleus rim and halo color). `applyLens` compares at float32 precision and returns which arrays changed; `scene.setLens` uploads only those (`needsUpdate` on the shared `InstancedBufferAttribute`s, and `atoms.syncDim / syncAtom / syncSpin` for the rings' and beads' own expansions). It runs after every render, so the estado and historia sliders re-send on every move as one upload; nothing runs per frame beyond the GPU reading the attributes.
- **fotos**: the 160 px tile in the back-wall atlas, dimmed (unchanged; 97 elements with a photograph). **familias**: family glow, isolation dims the others to 15 % (unchanged).
- **estado** (`phaseClass(e, celsius)`): solid → beads at a third of the speed, frost on the body's glass and the door; liquid → a cool blue floor wash; gas → double speed, a warm bright floor wash, the atom lifted 0.06; unknown → hatched dim floor. The speed change keeps every bead where it was: `aSpin` is (multiplier, phase offset) per bead, the offset recomputed from the scene clock only when the multiplier changes.
- **historia** (`knownInYear(e, year)`): unknown in that year → `dim` 0 and the atom hidden (nucleus collapsed, beads, rings and halo at zero alpha); the box stays as dark glass.
- **luz**: the element's strip (`stripCanvas` in `src/draw/spectrum.js`, the same canvas `stripDataUrl` serializes) is drawn into a 16 px strip cell under the photo cells of the same atlas (12 × 10 of each; the atlas is 1920 × 1760) and the body shader projects it as a band across the back wall, a sharp core with a soft falloff; the halo and the nucleus rim take the strip's dominant color (`dominantColor`: the intensity²-weighted mean of the bins, normalized). 97 elements have bins; the rest keep the dark wall and the family glow.
- **tamano** (`radiusOf`, empirical else calculated, max 260 pm): the atom's outer ring scales to radius / max (the largest fills the box; hydrogen is 0.16 of it), beads scale with it (the nucleus by scale^0.6, a drawing size); the 23 elements without a radius show only their outermost ring, dashed, at 0.3, and no beads or nucleus.
- **datos** (`PROPERTIES[property]`, `propertyExtent`, `scale01`, `rampRgb`): the floor takes the ramp color as a wash; no value → hatched. `rampRgb` is the new triple form of `rampColor` in `src/table/lenses.js`.
- Shaders: `BODY_V/F` read `aWall` (vec2), `aFloor`, `aFrost`; `DOOR` reads `aFrost`; `NUCLEUS` and `HALO` read `aAtom` and `aGlow`; `RING` reads `aRing` (dashed rings via `atan` on the quad); `ELECTRON` reads `aBead` and `aSpin`. Selection, hover and the dive are unchanged; the shell flash uses the scaled ring radius.

### Measured

- Arrays at 1600 × 900: estado 25 °C → Fe spin ⅓ frost 1, Hg liquid floor (0.17, 0.56, 0.72), O gas lift 0.06 spin 2, Og hatched; 1600 °C → Fe liquid; 3000 °C → Fe gas. Historia 1869 → 65 boxes lit and 65 atoms shown (the control says "65 elementos conocidos en 1869"); 2026 → 118. Luz → Fe wall (25, spectrum), glow (0.90, 0.52, 1.00); H glow (1.00, 0.28, 0.66); Og dark. Tamaño → Cs 1.0, Fe 0.538, H 0.16, Fr and Og dashed. Datos (electronegativity) → Fe floor (0.22, 0.37, 0.56, wash), 18 hatched. Familias → transition isolated dims 80.
- Dive and surface under the estado lens: deck at `#fe/materia` after the push-in, Escape → veil at 0.3 s, deck gone at 1.2 s, card and pill back by 4.7 s.
- `npm test` 10/10; `npm run build`: app 95.06 kB, `scene-*.js` 488.04 kB raw / 127.10 kB gzip (+5.6 kB raw for the lenses). Draw calls are structurally the same eight (no mesh added); fps was not re-measured because the pane was hidden and the loop pauses on `document.hidden`.

### Known gaps

1. No eye on a real GPU yet: the pane's screenshots were usable for the first four captures (estado, historia, luz, the fotos table) and cropped or black after that, as in stage 1. The look of the washes, the frost and the band needs Victor's Chrome.
2. The band's lines blur at table distance (the wall is ~70 px wide, the strip cell 160 px); a 512 px strip would need a wider atlas.
3. The 450 kB total budget is still not met (see stage 1); the lenses added 5.6 kB.

## 2026-10-21, night — the port: Vitrina is the table (stage 1 of the workflow)

`docs/portfolio/INTEGRATION.md` implemented as far as "Architecture", "The dive, as decided" and the first two lenses of "Lenses as light inside the box". Verified in the desktop browser pane at 1600 × 900.

### What exists

- **`src/scene/`** (the only folder that imports `three`, 0.160.0 as ES modules, in its own chunk): `scene.js` `mountScene(host, api)` with the renderer on a canvas, the fit, the loop (paused when the tab is hidden or the deck covers it), picking, hover, selection, the dive and the surface; `boxes.js`, `atoms.js`, `camera.js`, `lenses3d.js`, `shaders.js`, ported from `docs/portfolio/vitrina.html` nearly verbatim. Two per-instance attributes were added for the lenses: `aDim` (every mesh) and `aWall` (the body's back-wall atlas slot); the rings gained `aFlash` for Holograma's fly-through.
- **`src/table/stage3d.js`**: WebGL detection, the lazy import, a body-level `.gl-stage` host (fixed, z 0, under `#app`) so the canvas survives the deck mounting over it, `syncScene(s)` called from `afterRender` (covered, selection, hover, lens), the Entrar pill placement from the projected box, the stats for Settings and the Automática fallback (`sceneFallback: 'slow'` after six seconds under 20 fps, `'error'` if the chunk fails to load).
- **`src/table/table.js`**: `tableView` renders `stage3d(s)` (a transparent pointer layer with the pill, readout and lens controls) when `use3d(s)`, else the CSS grid unchanged. Hover, click, double-click, keyboard arrows (the hover is the focus when there are no tiles), Enter, the hash routes and the side card work the same in both modes. The 3D readout adds the shells from the data and, above Z 36, "se dibujan hasta 12 por capa".
- **Settings → Calidad**: Automática · 3D · Sencilla, persisted in prefs as `quality`; a performance line under it with `renderer.info` (fps, draw calls, triangles, electron beads, JS ms) or the reason the simple mode is on.
- **The dive** (`src/app/transitions.js` → `sceneDive`): card fades (body `diving`), dolly to the box at ~60 % of the shorter side, door on its left hinge, push through the pane with each ring flashing as the camera passes it, nucleus whitens, halo blooms, the veil reaches full at t = 0.82 of 3.2 s, `openElement(z, panel)` mounts the deck under it (hash `#fe/materia`), the veil dissolves over ~0.5 s onto the hero. **Surface**: the veil rises over the deck in 0.5 s, `openPeek(z)` swaps the views under it, the timeline runs backward (veil held until the camera is back among the shells), door closes, camera returns, card fades in. With animations off, or in the simple mode, both are a 300 ms crossfade through the background (Web Animations, raced against a timer because a hidden document does not advance animations). The CSS zoomer is gone.
- **Lenses in 3D, this stage**: family glow (always) with the familias isolation dimming the others to 15 %; the fotos back wall from a 12 × 10 atlas of the 160 px tiles filled as they load. Estado, historia, luz, tamaño and datos boxes show the family glow until the next stage.

### Measured

- `npm run build`: app chunk 94.8 kB, `scene-*.js` 482.4 kB raw / 124.9 kB gzip. The 450 kB total in INTEGRATION.md is **not met**: three's `WebGLRenderer` alone pulls the shader library and program machinery (~450 kB) and cannot be tree-shaken further; the simple mode never downloads it. Decide whether the budget moves to "app under 100 kB, scene chunk under 500 kB" or whether a slimmer renderer is worth it.
- In the desktop pane at 1600 × 900: 8 draw calls, 33,722 triangles, 4,678 electron beads, JS 0.3–0.4 ms per frame, 28–31 fps (the pane's compositor; the prototype logged 58–60 in the same pane at 1920 × 1080). **Not measured on the GTX 1650**; the 60 fps idle target is unverified.
- `npm test` 10/10.

### Known gaps for the next stages

1. The other five lenses as light (estado speed and frost, historia dark boxes, luz spectrum strip on the wall, tamaño scale, datos floor ramp); `atoms.js` already returns `ringsOf` and the per-element bead ranges for it.
2. The pane's screenshots came back cropped at device pixels again; every check above was measured from the DOM. The dive and the shell flash need an eye on a real GPU (Victor's Chrome).
3. `state.settings` used to stay true inside the deck and eat the first Escape; `applyHash` now clears it when a deck route opens.

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
