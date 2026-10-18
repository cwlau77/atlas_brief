"""Write the Atlas lockup SVGs with "atlas" outlined from Jost 500.

Usage (from the repo root):
  python3 -m venv /tmp/atlas-brand && /tmp/atlas-brand/bin/pip install fonttools
  /tmp/atlas-brand/bin/python frontend/scripts/brand/outline_wordmark.py
"""
import io
import pathlib
import urllib.request

from fontTools.pens.svgPathPen import SVGPathPen
from fontTools.pens.transformPen import TransformPen
from fontTools.ttLib import TTFont
from fontTools.varLib.instancer import instantiateVariableFont

JOST_URL = "https://github.com/google/fonts/raw/main/ofl/jost/Jost%5Bwght%5D.ttf"
OUT = pathlib.Path(__file__).resolve().parents[2] / "public" / "brand"
MARK = {
    False: ("#6F8A6F", "#3D5A45", "#2A3F31", "#B5532E", "#3D5A45"),
    True: ("#F3EEE3", "#C9D2C0", "#9AAA92", "#E07A52", "#F3EEE3"),
}
FONT_SIZE = 100  # lockup units: mark height 0.92em = 92, gap 0.28em = 28


def word_path(font: TTFont, text: str, size: float, x0: float, baseline: float) -> tuple[str, float]:
    scale = size / font["head"].unitsPerEm
    glyphs = font.getGlyphSet()
    cmap = font.getBestCmap()
    pen = SVGPathPen(glyphs)
    x = x0
    for ch in text:
        name = cmap[ord(ch)]
        glyphs[name].draw(TransformPen(pen, (scale, 0, 0, -scale, x, baseline)))
        x += font["hmtx"][name][0] * scale
    return pen.getCommands(), x


def main() -> None:
    raw = urllib.request.urlopen(JOST_URL).read()
    font = instantiateVariableFont(TTFont(io.BytesIO(raw)), {"wght": 500})
    cap = font["OS/2"].sCapHeight / font["head"].unitsPerEm * FONT_SIZE
    xh = font["OS/2"].sxHeight / font["head"].unitsPerEm * FONT_SIZE
    mark_h = 0.92 * FONT_SIZE
    baseline = mark_h / 2 + xh / 2  # x-height centred on the mark
    d, end = word_path(font, "atlas", FONT_SIZE, mark_h + 0.28 * FONT_SIZE, baseline)
    width = end + 2
    for reversed_, suffix in ((False, ""), (True, "-reversed")):
        l, c, r, f, text = MARK[reversed_]
        k = mark_h / 100
        svg = (
            f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {width:.1f} {mark_h:.1f}"><title>Atlas</title>'
            f'<g transform="scale({k:.4f})"><path d="M8 84 L36 20 L36 76Z" fill="{l}"/>'
            f'<path d="M36 20 L64 32 L64 88 L36 76Z" fill="{c}"/><path d="M64 32 L92 84 L64 88Z" fill="{r}"/>'
            f'<circle cx="36" cy="13" r="5" fill="{f}"/></g><path d="{d}" fill="{text}"/></svg>'
        )
        (OUT / f"atlas-lockup{suffix}.svg").write_text(svg)
    print(f"wrote lockups ({width:.0f}x{mark_h:.0f}); cap height {cap:.1f}")


if __name__ == "__main__":
    main()
