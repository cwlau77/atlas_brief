"""Write the Atlas lockup SVGs with "atlas" outlined from IBM Plex Sans 600.

Usage (from the repo root):
  python3 -m venv /tmp/atlas-brand && /tmp/atlas-brand/bin/pip install fonttools
  /tmp/atlas-brand/bin/python frontend/scripts/brand/outline_wordmark.py
"""
import io
import pathlib
import urllib.request

from fontTools.pens.boundsPen import BoundsPen
from fontTools.pens.svgPathPen import SVGPathPen
from fontTools.pens.transformPen import TransformPen
from fontTools.ttLib import TTFont
from fontTools.varLib.instancer import instantiateVariableFont

# Pinned to the commit that last touched IBMPlexSans[wdth,wght].ttf, so the
# outline never shifts under us if google/fonts updates the family on main.
PLEX_URL = (
    "https://github.com/google/fonts/raw/"
    "8409f033cd7dee08914990602f0df5f5e70e0c14/ofl/ibmplexsans/IBMPlexSans%5Bwdth,wght%5D.ttf"
)
OUT = pathlib.Path(__file__).resolve().parents[2] / "public" / "brand"
MARK = {
    False: ("#AEBBF5", "#5A73EA", "#1F3FE0", "#E2381B", "#0E1116"),
    True: ("#D5DCFA", "#8FA2F3", "#5A73EA", "#FF6A4D", "#F5F5F1"),
}
FONT_SIZE = 100  # lockup units: mark height 0.92em = 92, gap 0.28em = 28


def word_path(
    font: TTFont, text: str, size: float, x0: float, baseline: float
) -> tuple[str, float, float]:
    scale = size / font["head"].unitsPerEm
    glyphs = font.getGlyphSet()
    cmap = font.getBestCmap()
    pen = SVGPathPen(glyphs)
    x = x0
    min_y = 0.0
    for ch in text:
        name = cmap[ord(ch)]
        transform = (scale, 0, 0, -scale, x, baseline)
        glyphs[name].draw(TransformPen(pen, transform))
        bounds_pen = BoundsPen(glyphs)
        glyphs[name].draw(TransformPen(bounds_pen, transform))
        if bounds_pen.bounds is not None:
            min_y = min(min_y, bounds_pen.bounds[1])
        x += font["hmtx"][name][0] * scale
    return pen.getCommands(), x, min_y


def main() -> None:
    raw = urllib.request.urlopen(PLEX_URL).read()
    font = instantiateVariableFont(TTFont(io.BytesIO(raw)), {"wght": 600, "wdth": 100})
    cap = font["OS/2"].sCapHeight / font["head"].unitsPerEm * FONT_SIZE
    xh = font["OS/2"].sxHeight / font["head"].unitsPerEm * FONT_SIZE
    mark_h = 0.92 * FONT_SIZE
    baseline = mark_h / 2 + xh / 2  # x-height centred on the mark
    d, end, min_y = word_path(font, "atlas", FONT_SIZE, mark_h + 0.28 * FONT_SIZE, baseline)
    width = end + 2
    top = min(0.0, min_y)
    height = mark_h - top
    for reversed_, suffix in ((False, ""), (True, "-reversed")):
        l, c, r, f, text = MARK[reversed_]
        k = mark_h / 100
        svg = (
            f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 {top:.1f} {width:.1f} {height:.1f}"><title>Atlas</title>'
            f'<g transform="scale({k:.4f})"><path d="M8 84 L36 20 L36 76Z" fill="{l}"/>'
            f'<path d="M36 20 L64 32 L64 88 L36 76Z" fill="{c}"/><path d="M64 32 L92 84 L64 88Z" fill="{r}"/>'
            f'<circle cx="36" cy="13" r="5" fill="{f}"/></g><path d="{d}" fill="{text}"/></svg>'
        )
        (OUT / f"atlas-lockup{suffix}.svg").write_text(svg)
    print(f"wrote lockups ({width:.0f}x{height:.0f}, top {top:.1f}); cap height {cap:.1f}")


if __name__ == "__main__":
    main()
