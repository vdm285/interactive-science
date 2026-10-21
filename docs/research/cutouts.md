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

## Results (2026-10-21, prototype on ten elements)

Built and run on 2026-10-21. Everything lives on D:, nothing under `C:\Users`.

- Environment: Python 3.13.14 virtual environment at `data/venv` (472 MB) with rembg 2.0.85, onnxruntime 1.31.0 (CPU), numpy 2.5.4, Pillow 12.3.0, scipy 1.18.1, PyMatting 1.1.16; pip cache in `data/cache/pip` (131 MB). Model weights under `data/cache/models/models/<name>/<name>.onnx` (rembg 2.0.8x nests a `models/` directory under `U2NET_HOME`): isnet-general-use 178.6 MB, u2net 176.0 MB, each downloaded once. Inference takes 1–3 s per image on the CPU after a ~3 s model load per process.
- Scripts: `tools/cutout.py` does one image (`--in --out --model --margin`, plus `--min-blob`, `--alpha-matting`, `--threshold`, `--opaque`) and prints a JSON line of measurements; `tools/build-cutouts.mjs` reads `public/data/photos.json` and `data/overrides/cutouts.json`, calls the venv's Python by absolute path with `U2NET_HOME` set, encodes with sharp, and writes `public/img/cutouts/{z}.webp` (alpha, 1024 px long side, quality 80 stepping down to 60 above 120 KB), `{z}-tile.webp` (256 px square, centered on transparency) and `index.json`, which copies license, author, Commons page and credit from photos.json next to the model used. The matting result is cached in `data/cache/cutouts/` keyed by the options; `--contact` composes `contact.png` for review.
- The models report "opaque" as about 250, not 255: 90 % of the subject's alpha sat in 241–254. `cutout.py` snaps alpha ≥ 240 to 255, which also cut the files by about 10 %. Chroma subsampling and lossy alpha in WebP saved nothing worth having.

Verdicts (model, verdict, bytes of cutout + tile):

| Z | photograph | model | verdict | bytes |
|---|---|---|---|---|
| 6 C | glassy carbon and graphite cube, black background | isnet | clean | 109 816 + 12 556 |
| 11 Na | cut sodium filling the frame | — | poor: sliced flat by the frame at top and bottom, a patch of bench kept; `keep` | — |
| 14 Si | silicon in an acrylic display cube | — | poor: a vessel; the white studio background shows through the clear block; `keep` | — |
| 16 S | refined sulfur chunks on white | isnet | acceptable: every crumb kept, a faint haze of the original shadow under the pile | 99 446 + 16 432 |
| 26 Fe | electrolytic iron and cube, black background | isnet | clean | 111 626 + 12 272 |
| 29 Cu | copper disc with scale bar | isnet | clean: scale bar gone, rim crisp (q60, the texture is heavy) | 170 882 + 20 046 |
| 78 Pt | platinum crystals on millimetre graph paper | — | poor: patches of paper and grid lines survive between the lacy crystals; `keep` | — |
| 79 Au | gold dendrites on white | u2net | clean with u2net; isnet left soft white patches inside the lattice; alpha matting was worse (white kept around the base, 336 fragments) | 110 324 + 15 512 |
| 80 Hg | mercury poured into a glass dish | — | poor: a pour into a vessel; ghost of the dish, the stream and a reflection kept; `keep` | — |
| 83 Bi | bismuth crystals and cube on white | isnet | clean | 110 744 + 14 214 |

Six cutouts, 785 KB in all (cap 1.2 MB). Nothing failed.

What the models struggle with: anything that is not matter on a plain floor. Vessels (dish, acrylic block), pours and reflections come through as ghosts; a patterned matrix (graph paper) survives inside open clusters; a sample cut by the photo frame comes out with straight edges; cast shadows on white leave a faint haze; open lattices on white get soft background patches with isnet, where u2net is cleaner. Studio shots on black or white with the sample and the 1 cm³ cube (Alchemist-hp) are the easy case and come out clean every time.

Recommendation for the remaining 87: run them all with isnet-general-use by default (one pass is about 20 s per element, the review is the real cost), but pre-set `keep` from the photo metadata before looking: `kind: tube` (gases), and file names or descriptions with ampoule, vial, beaker, flask, cube (acrylic), hand, glove, solution. Then curate the rest from the contact sheet, ten per sheet, and switch to u2net per element where an open lattice sits on white. Expect roughly half to survive: the metals and crystals on plain backgrounds. A box touching two opposite frame edges is a cheap automatic flag for the frame-cut case.
