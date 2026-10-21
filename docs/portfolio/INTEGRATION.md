# Integration spec — Vitrina becomes the real table

Decided by Victor on 2026-10-21 (evening): option A Vitrina is the table; the push-in goes through the nucleus and the bloom resolves directly into the element's photograph, which is the first panel of the deck; the lenses become light inside the boxes; the CSS tile table stays as the simple mode. Borrow from Holograma: the camera passing through the shells one by one during the push-in (each ring flashes as it passes).

## Architecture

- `three` 0.160.0 is an npm dependency, imported as ES modules in a separate chunk (`import('../scene/scene.js')` from the table view) so the app shell and the simple mode stay small. No UMD, no cdnjs at runtime.
- New folder `src/scene/`:
  - `scene.js`: `mountScene(host, api)` creates the renderer on a `<canvas>` inside the stage, owns the camera fit, the render loop (paused when hidden, when the deck covers it, or when the simple mode is on), resize, picking and hover. Returns `{ setLens, setSelection, setHover, dive, surface, destroy, stats }`.
  - `boxes.js`: the InstancedMesh glass vitrines, doors, edges and the symbol/Z label atlas, ported from `docs/portfolio/vitrina.html`; per-instance attributes for glow color, floor color, dim factor, door angle, back-wall texture slot.
  - `atoms.js`: nuclei, halos, rings and electron beads (vertex-shader orbits), from the prototype; per-instance attributes for speed (the state lens), scale (the size lens), tint.
  - `camera.js`: fit math with corner keep-out, the monotone cubic path, the dive timeline on the wall clock, the shell fly-through.
  - `lenses3d.js`: maps the store's lens state to per-instance attributes and textures (below).
  - `shaders.js`: all GLSL.
- The table view (`src/table/table.js`) renders the CSS grid when `state.quality === 'simple'` or WebGL is missing; otherwise it renders the stage with a canvas host and the same hover readout, the side card (`src/table/peek.js`), the enter pill as an HTML overlay anchored to the projected box position, and the corner controls. Hover, selection, keyboard and the hash routes are unchanged: the scene calls `set({ hover })`, `openPeek(z)` and `dive(z, panel)` exactly as the tiles do.
- Settings gains **Calidad**: Automática (3D, drops to simple when the frame rate stays under 20 fps for six seconds, like Giramundo), 3D, Sencilla. `state.quality` persists in prefs. `photosOn` keeps meaning photographs (back walls and heroes).
- `src/app/transitions.js`: `dive(z, panel)` and `surface()` delegate to the scene when it is mounted; the CSS zoomer remains only for the simple mode (and should be replaced there by a 300 ms crossfade, since Victor rejected it).

## The dive, as decided

1. Card fades; camera dollies to the box at 55–65% of the viewport, neighbors visible (prototype keyframes).
2. The glass pane swings open on its left hinge (prototype).
3. Push-in through the open pane: the camera passes the shells one by one, each ring flashing as it passes (from Holograma), electrons sweep past, the nucleus grows and whitens, the halo blooms.
4. The bloom resolves **directly into the hero photograph**: the deck mounts beneath with the Materia panel (full-bleed hero) and the white veil dissolves over ~500 ms so the photograph appears to emerge from the light. The hash becomes `#fe/materia` at the moment the deck mounts.
5. Surface (Escape, chevron, medallion field): the hero dims into the veil, the camera pulls back out through the shells and the door, the door closes, the camera returns to the fitted framing, the card returns. Hash `#fe`.
6. With animations off: 300 ms crossfades both ways.

## Lenses as light inside the box

Every lens keeps its current control (slider, chips, legend) and readout; what changes is what the boxes show. The default view when no lens is "on" is **fotos**.

- **fotos**: the element's photograph (`public/img/tiles/{z}.webp`, already committed; a 512 px atlas built at load from the 160 px tiles is fine for a first pass) becomes the back wall of its box, dimmed so the atom stays the subject; elements without a photo keep the dark wall with the family glow.
- **familias**: the family color becomes the box's inner light (floor glow and nucleus rim); isolating a family dims the others' light to 15%.
- **estado**: solid: electrons slow to a third, a frost tint on the glass; liquid: normal speed, a cool blue floor wash; gas: double speed, a warm bright wash and the atom lifts slightly; unknown: hatched dim floor. Driven by `phaseClass(e, celsius)` per element, re-sent on every slider move (one attribute upload).
- **historia**: boxes whose element was not yet known in the chosen year go dark and unlit (atom hidden); known ones lit; re-sent on every slider move.
- **luz**: the element's spectrum strip (`stripDataUrl` from `src/draw/spectrum.js`) is projected onto the back wall as a glowing band and the nucleus halo takes the strip's dominant color; elements without a spectrum keep a dark wall.
- **tamano**: the whole atom scales with the empirical radius (max radius fills the box); no radius, a small dashed ring.
- **datos**: the floor takes the heatmap ramp color (`heat()` in `src/table/lenses.js`); no value, hatched.

## Non-negotiables

- Nothing invented: electrons per shell from the data; rings beyond 12 beads carry the count in the hover readout.
- 60 fps idle on the GTX 1650 and no more than ~10 draw calls; `renderer.info` numbers in the Settings performance line.
- The simple mode must remain fully functional (it is the fallback and the wireframe branch's base).
- `npm test` stays green; `npm run build` under 450 kB of JS including three (three is ~600 kB raw but tree-shakes; measure and report).
- Docs updated in the same commit: `AGENTS.md` (where things live), `HANDOFF.md`, `docs/VISION.md`.
