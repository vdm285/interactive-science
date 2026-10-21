# Photo cutouts: removing backgrounds from element photographs

Written 2026-10-21 as a plan, not yet built. Victor wants the element photographs shown as cutouts: the ore, the metal, the drops, with the lab bench, hands and room removed, so the eye sees only the matter.

## Legal

- Cropping and background removal are derivative works. Every current photo license allows derivatives: CC BY and CC BY-SA (attribution, and share-alike for the SA ones), FAL (share-alike), public domain and GFDL. The cutout is published under the same license as its source, with the author named, the license linked, and the Commons page linked, exactly as today. The credit line gains the word "recortada" / "cut out".
- No photo is ever altered beyond the cutout: no color changes that misrepresent the sample, no compositing of two photos. The original stays linked.

## Method (build time, free, on D:)

- `rembg` (MIT) with the `isnet-general-use` or `u2net` model, run locally in Python at build time, or the same models through ONNX Runtime in Node. Both are free and offline; the model weights download once into `data/cache/models/` (about 170 MB, gitignored).
- Pipeline `tools/build-cutouts.mjs`: for each element with a photo, fetch the 1280 px original into the cache, run the matting model, trim the alpha bounding box with a margin, write `public/img/cutouts/{z}.webp` (alpha WebP, 1024 px long side, quality 80, about 60–120 KB each; 97 elements, under 10 MB) and a 256 px tile. Byte cap on the directory.
- Not every photo survives a cutout: discharge tubes, liquids in beakers and crystals on matrix keep the vessel or the matrix by nature. The override file `data/overrides/cutouts.json` says per element: `auto`, `keep` (use the original, no cutout) or a manual mask hint (`focus` box). A human pass (Victor or a sub-agent looking at each result) decides, like the photo curation did.
- The app shows the cutout on a quiet gradient floor with a soft shadow in the card and the hero; the full original stays one tap away (lightbox) so nothing is hidden.

## Order of work

1. Prototype on ten elements (iron, copper, gold, sulfur, mercury, bismuth, silicon, carbon, sodium, platinum) and look at every result.
2. If the matting is clean on metals and crystals, run all 97 and curate the rest by eye.
3. Only then switch the tiles and heroes to the cutouts, keeping the originals as the fallback.
