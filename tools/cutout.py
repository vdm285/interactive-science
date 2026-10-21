"""Remove the background from one photograph and trim it to the alpha bounding box.

Part of the Materia build (docs/research/cutouts.md). tools/build-cutouts.mjs runs this from the
virtual environment in data/venv, one image per process:

    python tools/cutout.py --in photo.jpg --out cutout.png [--model isnet-general-use]
                           [--margin 0.08] [--min-blob 0] [--alpha-matting] [--threshold 8] [--opaque 240]

Models download once into $U2NET_HOME. The script refuses to run without that variable so the
weights never land in the user profile on C:. It writes an RGBA PNG cropped to the pixels whose alpha
exceeds --threshold, plus a margin (a fraction of the longer side of that box, clamped to the frame).
The models report "opaque" as about 250 rather than 255, so alpha at or above --opaque is snapped to
255 (the body of the sample stops being 2 % translucent and the alpha channel compresses better).
It prints one JSON line of measurements for the orchestrator: sizes, the box, how much of the frame
the subject fills ("coverage"), how much of the box is subject ("fill"), the share of subject pixels
whose alpha sits in the soft band threshold..224 ("soft", the halo indicator), the number of alpha
islands ("blobs"), which frame edges the box touches, and timings. Exit codes: 0 ok, 2 empty mask,
1 anything else.

The photograph itself is never altered beyond the cutout: no color or tone changes.
"""

import argparse
import json
import os
import sys
import time


def fail(msg, code=1):
    print(json.dumps({"ok": False, "error": msg}))
    return code


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--in", dest="src", required=True, help="source photograph (JPEG/PNG/WebP)")
    ap.add_argument("--out", required=True, help="output RGBA PNG")
    ap.add_argument("--model", default="isnet-general-use", help="rembg session name (isnet-general-use, u2net, ...)")
    ap.add_argument("--margin", type=float, default=0.08, help="margin around the alpha box, fraction of its longer side")
    ap.add_argument("--min-blob", type=float, default=0.0,
                    help="drop alpha islands smaller than this fraction of the largest island (0 keeps every island)")
    ap.add_argument("--alpha-matting", action="store_true", help="rembg alpha matting (slow edge refinement)")
    ap.add_argument("--threshold", type=int, default=8, help="alpha above this value counts as subject")
    ap.add_argument("--opaque", type=int, default=240,
                    help="alpha at or above this value becomes 255 (the models report opaque as about 250); 255 disables")
    args = ap.parse_args()

    home = os.environ.get("U2NET_HOME")
    if not home:
        return fail("U2NET_HOME is not set; refusing to download model weights into the user profile")
    os.makedirs(home, exist_ok=True)

    import numpy as np
    from PIL import Image, ImageOps
    from rembg import new_session, remove

    t0 = time.time()
    try:
        img = Image.open(args.src)
    except Exception as err:  # noqa: BLE001
        return fail(f"cannot open {args.src}: {err}")
    img = ImageOps.exif_transpose(img).convert("RGB")
    width, height = img.size

    session = new_session(args.model)
    t1 = time.time()
    if args.alpha_matting:
        out = remove(img, session=session, alpha_matting=True,
                     alpha_matting_foreground_threshold=240, alpha_matting_background_threshold=10,
                     alpha_matting_erode_size=10)
    else:
        out = remove(img, session=session)
    t2 = time.time()
    out = out.convert("RGBA")

    alpha = np.asarray(out.getchannel("A"))
    subject = alpha > args.threshold

    from scipy import ndimage
    labels, blobs_before = ndimage.label(subject)
    blobs = blobs_before
    if args.min_blob > 0 and blobs_before > 1:
        sizes = np.bincount(labels.ravel())[1:]
        keep = sizes >= sizes.max() * args.min_blob
        mask = np.zeros_like(subject)
        mask[labels > 0] = keep[labels[labels > 0] - 1]
        alpha = np.where(mask, alpha, 0).astype(np.uint8)
        out.putalpha(Image.fromarray(alpha))
        subject = alpha > args.threshold
        blobs = int(keep.sum())

    if args.opaque < 255:
        alpha = np.where(alpha >= args.opaque, 255, alpha).astype(np.uint8)
        out.putalpha(Image.fromarray(alpha))

    ys, xs = np.nonzero(subject)
    if xs.size == 0:
        return fail("empty mask: the model found no subject", 2)
    x0, x1 = int(xs.min()), int(xs.max()) + 1
    y0, y1 = int(ys.min()), int(ys.max()) + 1
    longer = max(x1 - x0, y1 - y0)
    pad = int(round(longer * args.margin))
    box = (max(0, x0 - pad), max(0, y0 - pad), min(width, x1 + pad), min(height, y1 + pad))
    crop = out.crop(box)
    os.makedirs(os.path.dirname(os.path.abspath(args.out)), exist_ok=True)
    crop.save(args.out, "PNG")

    a_box = alpha[y0:y1, x0:x1]
    subj = a_box[a_box > args.threshold]
    touches = [edge for edge, hit in (("left", x0 == 0), ("top", y0 == 0), ("right", x1 == width), ("bottom", y1 == height)) if hit]
    print(json.dumps({
        "ok": True,
        "model": args.model,
        "margin": args.margin,
        "src": [width, height],
        "out": list(crop.size),
        "bbox": [x0, y0, x1, y1],
        "coverage": round((x1 - x0) * (y1 - y0) / (width * height), 4),
        "fill": round(float(subject[y0:y1, x0:x1].mean()), 4),
        "soft": round(float((subj <= 224).mean()) if subj.size else 0.0, 4),
        "blobs": int(blobs),
        "blobsBefore": int(blobs_before),
        "touches": touches,
        "seconds": {"load": round(t1 - t0, 2), "infer": round(t2 - t1, 2), "total": round(time.time() - t0, 2)},
    }))
    return 0


if __name__ == "__main__":
    sys.exit(main())
