#!/usr/bin/env python3
"""Strip the Gemini-exported checkered "transparency placeholder" pattern
from a Whalabroad PNG by chroma-keying the two checker grays to actual
alpha=0 transparency.

The checker pattern from Gemini outputs has two alternating gray squares
roughly RGB(60,58,59) and RGB(108,106,107). We sample the actual checker
colors from the source image's corner pixels (which are guaranteed to be
checker, not subject), then set alpha=0 for every pixel within tolerance
of either color. Subject pixels keep their original alpha.

Usage:
    python strip-checker.py <input.png> <output.png> [tolerance=15] [--colors R,G,B,R,G,B]
"""
import sys
from PIL import Image
from collections import Counter

def strip_checker(in_path: str, out_path: str, tolerance: int = 15, explicit_colors=None) -> None:
    img = Image.open(in_path).convert("RGBA")
    w, h = img.size
    px = img.load()

    if explicit_colors:
        chosen = explicit_colors
        print(f"  using explicit checker colors: {chosen[0]} and {chosen[1]}")
    else:
        # Sample the checker from a band 100..200 px down — past any title
        # bar — and from a grid wide enough to hit both checker squares.
        sample_y0 = min(100, h // 4)
        sample_y1 = min(sample_y0 + 100, h)
        samples = []
        for y in range(sample_y0, sample_y1, 2):
            for x in range(0, min(80, w), 2):
                r, g, b, a = px[x, y]
                samples.append((r, g, b))
        counter = Counter(samples)
        top2 = [c for c, _ in counter.most_common(8)]
        # Reduce to two distinct grays — pick the two most-common that
        # differ by >20 in luminance (so we don't pick two near-identical
        # samples of the same square).
        chosen = []
        for c in top2:
            if not chosen:
                chosen.append(c); continue
            diff = sum(abs(a - b) for a, b in zip(c, chosen[0]))
            if diff > 20 and len(chosen) < 2:
                chosen.append(c); break
        if len(chosen) < 2:
            chosen.append(top2[1])  # fallback
        print(f"  detected checker colors: {chosen[0]} and {chosen[1]}")

    def near(c, target):
        return all(abs(c[i] - target[i]) <= tolerance for i in range(3))

    keyed = 0
    for y in range(h):
        for x in range(w):
            r, g, b, a = px[x, y]
            if a == 0:
                continue
            if near((r, g, b), chosen[0]) or near((r, g, b), chosen[1]):
                px[x, y] = (r, g, b, 0)
                keyed += 1
    img.save(out_path, optimize=True)
    print(f"  keyed {keyed:,} pixels -> {out_path}")

if __name__ == "__main__":
    if len(sys.argv) < 3:
        print(__doc__); sys.exit(1)
    inp = sys.argv[1]
    outp = sys.argv[2]
    tol = 15
    explicit = None
    args = sys.argv[3:]
    i = 0
    while i < len(args):
        if args[i] == "--colors" and i + 1 < len(args):
            vals = [int(v) for v in args[i + 1].split(",")]
            explicit = [tuple(vals[0:3]), tuple(vals[3:6])]
            i += 2
        else:
            tol = int(args[i]); i += 1
    print(f"Stripping checker from {inp} (tolerance={tol})")
    strip_checker(inp, outp, tol, explicit)
