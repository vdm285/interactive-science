# Portfolio spec — the glass-box table and the dive

Written 2026-10-21 after Victor's second review. Three working prototypes are built against this spec, each a single HTML file in this folder, so he can pick a direction before the real implementation. Prototypes may be rough; the core idea must read clearly.

## What Victor asked for (verbatim intent)

- The periodic table takes the whole viewport, always; padding minimal; the three corner controls stay translucent.
- Selecting an element opens a **card overlaid on the table**, on the left or the right depending on where the element sits, so the table never scrolls, shrinks or moves.
- The table is a set of **stacked transparent boxes** (glass displays with a clear outline), one per element, each holding a **live miniature 3D atom** (glowing, spinning electrons; faithful electron counts for small atoms, an honest approximation for the heavy ones). Hover shows the name. "Best of both worlds": the classic grid of squares and a case of glass boxes.
- The **dive**: zoom toward the chosen box without losing the table (neighbors stay visible at the edges); the box's glass door opens like a door; the camera pushes into the atom toward the nucleus; the picture transitions smoothly into the deck of slides. The earlier CSS zoom "looked like a cheap PowerPoint"; this must be cinematic and physically believable.
- Prefer in-browser 3D over Blender renders if the quality is world-class; lightweight on the GPU where possible.

## Shared requirements for every prototype

1. **One file**, `docs/portfolio/<id>.html`, three.js 0.160.0 loaded from cdnjs as a classic script (`https://cdnjs.cloudflare.com/ajax/libs/three.js/0.160.0/three.min.js` defines `THREE`). No other library, no build step, no network except that script and the hotlinked hero photographs. Also a copy in `docs/portfolio/<id>.artifact.html` with the `<!doctype>`, `<html>`, `<head>`, `<body>` wrapper removed (the artifact host wraps it) and the `<title>` and `<style>` first; the artifact version must not use `window.open`, iframes, alerts or downloads.
2. **Data**: `docs/portfolio/demo-data.js` defines `window.MATERIA` with the 118 elements (`z, symbol, es, en, x, y, shells, family, mass, hero, medium`) and `FAMILY_COLOR`. Inline its contents into the HTML (the file must stand alone). Electron counts come from `shells`; nothing invented.
3. **Table**: 18 columns, 7 periods, the f-block two rows below, classic positions from `x, y`. Fills the viewport edge to edge with a 10 px margin and a 56 px keep-out zone in each corner (draw the three translucent corner buttons as inert placeholders: lens top-left, cog bottom-left, lenses bottom-right). Resizes with the window. Boxes keep square faces.
4. **Boxes**: transparent with a clear outline; the symbol always visible on the face (small, translucent, legible); the name on hover (plus a hover highlight). Family color is present but quiet (edge glow, floor tint or nucleus hue, by option).
5. **Atoms**: nucleus plus electrons on shells from `shells`. For Z ≤ 36 every electron is drawn; above that each shell draws at most 12 electron beads plus a visible ring whose brightness or thickness stands for the full count, and the hover label states the real count. Electrons orbit continuously; shells may be tilted for depth. Use `InstancedMesh` (one for nuclei, one for electrons, one or two for rings) so the whole table is a handful of draw calls; cap `devicePixelRatio` at 1.5; stop rendering when the tab is hidden; `?simple=1` in the URL replaces electron beads with rings only.
6. **Card**: click a box → a card slides in over the table from the **right when the element's column is 1–9 and from the left when it is 10–18** (f-block rows follow their column too), roughly 34% of the width, full height minus the corner zones, translucent dark glass. It shows the hero photograph (hotlinked `hero`, with `medium` as fallback), name, symbol, Z, mass, six inert door chips (Luz, Átomo, Núcleo, Historia, Cosas, Video) and an **Entrar** button. The table stays fully interactive underneath: clicking another box swaps the card (and flips side if needed); clicking empty space or Escape closes it. The chosen box is highlighted (brighter outline, slight lift or glow).
7. **The dive** (Entrar, Enter key, or double-click the box), one continuous camera move with eased timing, about 2.5–3.5 s total, never a hard cut:
   a. The camera dollies toward the chosen box until it fills roughly 55–65% of the viewport **with the neighboring boxes still visible around the edges**; the card fades out.
   b. The box's glass door opens (motion by option) over ~0.7 s.
   c. The camera pushes through the open door into the atom: electrons sweep past the camera, the nucleus grows, light blooms (additive glow, a brief whiteout or a color wash) over ~0.9 s.
   d. Crossfade into a mock deck: a full-screen dark panel with the element name, a row of panel names (Materia, Luz, Átomo, Núcleo, Historia, Mundo, Cosas, Imágenes, Video, Datos) and a **Volver** button. Volver reverses the whole sequence back to the full table (the door closes, the camera pulls out).
   With `prefers-reduced-motion` or `?motion=0`, the dive is a 300 ms crossfade.
8. **Performance**: 60 fps on an integrated-GPU laptop at 1920×1080 in the idle table; the dive must not drop below 30 fps. Report your measured frame time in a comment at the top of the file if you can measure it (`performance.now()` deltas logged to the console are fine).
9. **Honesty**: Spanish UI strings; no invented numbers; a small footer line in the mock deck: "Prototipo: los datos de electrones vienen de la configuración real; las fotos de Wikimedia Commons con su licencia" and the photo credit under the hero (`artist · license`, from the data when present).
10. **Keyboard**: arrows move the hover/selection along the grid, Enter dives, Escape goes back one step.

## The three options

### A — "Vitrina" (museum glass case)
Boxes are glass vitrines: faint refraction or edge highlights, a subtle floor reflection under each atom, a dark museum atmosphere with a soft top light. Atoms are Bohr-style: a warm glowing nucleus, electrons as bright beads on thin tilted rings. Door: the front pane swings open on its left hinge, 100°, with a glint as it turns. Push-in: through the open pane into the nucleus; bloom to warm white; crossfade.

### B — "Holograma" (holographic outlines)
Boxes are thin neon outlines (family-tinted) on a near-black grid, like a holographic display; faces are almost invisible until hovered. Atoms are shell-based: each shell a translucent sphere with its electrons as particles sliding on its surface, the nucleus a tight bright cluster. Door: the front face dissolves into a particle curtain that parts upward. Push-in: the camera dives through the shells one by one (each shell flashes as it passes), into the nucleus; blue-white bloom; crossfade.

### C — "Caja" (physical display boxes)
Boxes are physical: a dark matte shell with depth, a glass front, and a small engraved plate with the symbol, stacked like a wall of specimen boxes under warm gallery light, slight perspective so the stack reads as 3D. Atoms are compact and tactile: the nucleus a cluster of packed protons and neutrons (count by Z and the most common isotope's A if cheap, else by Z), electrons as small satellites on rings. Door: the glass lid tilts open from the top edge like a display case. Push-in: into the nucleus cluster, which parts to let the camera through; amber bloom; crossfade.

## What each prototype must report

A structured return: path, artifact path, what is implemented, what is faked, measured or estimated frame cost, and the three things the builder would do first in the real implementation.
