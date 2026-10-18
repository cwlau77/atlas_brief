#!/usr/bin/env bash
# Rasterise a local SVG/HTML file with headless Chrome.
# Usage: render.sh <input> <output.png> <width> <height> [transparent]
set -euo pipefail
CHROME="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
in="$(cd "$(dirname "$1")" && pwd)/$(basename "$1")"
bg=""
if [[ "${5:-}" == "transparent" ]]; then bg="--default-background-color=00000000"; fi
"$CHROME" --headless=new --disable-gpu --hide-scrollbars --force-device-scale-factor=1 \
  $bg --window-size="$3,$4" --screenshot="$2" "file://$in" >/dev/null 2>&1
sips -g pixelWidth -g pixelHeight "$2" | tail -2
