# VISION.md — where Materia is going

Written 2026-10-21 at the start of the rebuild, by the session, unguided. Victor's direction comes after the first checkpoint and will reshape this file.

## The thesis

A periodic table on a phone or a wall should beat "just Google it" in one way: it should let you *see* the element. Not a colored square with a number, but the thing itself (a photograph of the metal, the crystal, the glowing gas), the light it emits (its spectral fingerprint, drawn from measured lines), its nucleus (every isotope that has ever been observed, stable or fleeting), where it sits in history (who found it, in which decade the table filled up) and where it is in the world (how much of the crust, the sea, your body). Every one of those is real data from a named source, never a drawing we made up.

The second thing it should do is give you something to do after the first tap. The lenses do that on the table (drag a temperature and watch mercury and bromine stay liquid while everything else freezes; drag the year and watch Mendeleev's 1869 table appear); the deck does it inside an element.

## Victor's direction after the first checkpoint (2026-10-21)

- **The table never disappears.** It is the universe the reader works in, like the globe in Giramundo; it must stay reachable without intermediate clicks. So the app has three layers: the full table (wide exploration); the **peek**, where the table shrinks to a band along the top and the chosen element's world opens beneath it, so tapping from element to element is instant; and the **deep dive**, entered by tapping the highlighted element again (or its photo, or one of the doors), with a smooth zoom into the tile that then swings open like a door onto the deck of full-screen panels. Inside the deck the medallion mini-table is the universe kept in the padding.
- **Wide and deep.** A short attention span should be positively overwhelmed by variety (lenses, photos, doors) and still be able to go tall on one element when something catches it. Modularity and optionality throughout.
- **Lenses fold into one button** (bottom-right), not a rail. Name: **Materia**. Next round: media depth (curated photographs, minerals and ores, everyday objects, the Periodic Videos episode per element).
- Desktop and laptop first; phones later.

## Victor's second review (2026-10-21, evening)

- **Rejected: the band.** The table must take the whole viewport at all times, minimal padding, with only the translucent corner controls over it. Shrinking it to a strip is out.
- **Element info as a side card** overlaid on the table, left or right depending on where the element sits (the side is decided by column, so the card never covers the element it describes), like the dossier over the globe in Giramundo. The table never scrolls, moves or shrinks.
- **Rejected: the CSS zoom-and-door** ("a cheap PowerPoint"). Wanted instead: the table as a case of **stacked transparent glass boxes** with clear outlines, each holding a **live miniature 3D atom** (spinning, glowing electrons; faithful counts for small atoms, an honest approximation for the heavy ones; name on hover). The dive zooms toward the chosen box **without losing the neighbors at the edges**, the box's glass door opens, the camera pushes into the atom toward the nucleus, and the picture flows into the deck. In-browser 3D at world-class polish, light on the GPU; Blender only if needed.
- **Process:** show a portfolio of rough working demos of such a visual decision before implementing it in full. `docs/portfolio/SPEC.md` and the three prototypes there are that portfolio.
- **Later, prepare for it:** cut the element photographs out of their backgrounds so only the matter remains (`docs/research/cutouts.md`).

### Victor's picks from the portfolio (2026-10-21, night)

- **Vitrina** becomes the real table (with Holograma's shell fly-through borrowed for the push-in).
- The push-in goes **through the nucleus into the first photograph**: the bloom resolves directly into the element's hero, which is the deck's first panel.
- **Lenses become light inside the boxes** (photo on the back wall, family glow, frozen or boiling atoms for the state, dark boxes for the undiscovered, the spectrum projected on the wall, atoms scaled by radius, heatmap floors).
- **Cutouts**: prototype on ten elements now, then decide.
- The integration plan is `docs/portfolio/INTEGRATION.md`.

## Taste rules applied here

- **Radical minimalism.** No wordmark, no header. Two translucent corner controls (search, settings). The lens rail at the bottom is the only other fixed thing, because it is used constantly.
- **Media first, labels on hover.** Tiles are photographs; names appear on hover (or always, faintly, in the lenses where a list of names is itself the value).
- **One rectangle, one concept.** Each panel is one idea: the substance, the light, the atom, the nucleus, the history, the world, the images, the numbers.
- **Depth for the invested.** The beautiful first screen is a photograph. Behind it: 160 spectral lines per element, 3,383 nuclides, successive ionization energies, both Wikipedia extracts, links to NIST, IAEA, PubChem and Wikidata.
- **Honesty.** Panels without data are absent, not empty. The Bohr drawing says it is a model. Bismuth says NUBASE calls it radioactive. Predicted values above 103 say so.
- **Optionality.** Photos can be turned off (a simple mode for slow machines); animations too; the language is a setting.
- **Spanish first.** Mexican classroom names ("Tungsteno" with the alias "wolframio"), Spanish Wikipedia extracts, Spanish captions where the Spanish article has them.

## Parked, not forgotten

- A quiz or game mode ("¿dónde está el oro?"); the first version had one and it was removed with the rest of the UI. It returns as a thing to do, not as a bar on the screen.
- Compounds and reactions (water, salt, rust) as a second level under an element.
- Minerals and ores per element with Commons photos; today they appear only when the Wikipedia article carries them.
- Pronunciation audio from Lingua Libre (the wiki pipeline looks for it; coverage is whatever Commons has).
- A phone layout that is designed rather than merely working.
- Other sciences as sister apps in this repository (the repo name says "interactive science"); the periodic table is the first.
