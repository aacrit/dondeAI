#!/usr/bin/env bash
# ============================================
# DondeAI — Download Self-Hosted Web Fonts
# Google Fonts now serves variable fonts (one file per family+style).
# Run once: bash scripts/download-fonts.sh
# ============================================

set -euo pipefail

FONT_DIR="$(cd "$(dirname "$0")/.." && pwd)/fonts"
mkdir -p "$FONT_DIR"

echo "Downloading variable fonts to $FONT_DIR ..."

echo "  Inter (variable, 400-700)..."
curl -sL "https://fonts.gstatic.com/s/inter/v20/UcC73FwrK3iLTeHuS_nVMrMxCp50SjIa1ZL7.woff2" \
  -o "$FONT_DIR/inter-variable-latin.woff2"

echo "  JetBrains Mono (variable, 400-500)..."
curl -sL "https://fonts.gstatic.com/s/jetbrainsmono/v24/tDbv2o-flEEny0FZhsfKu5WU4zr3E_BX0PnT8RD8yKwBNntkaToggR7BYRbKPxDcwg.woff2" \
  -o "$FONT_DIR/jetbrains-mono-variable-latin.woff2"

echo "  Playfair Display (variable, 400-700)..."
curl -sL "https://fonts.gstatic.com/s/playfairdisplay/v40/nuFiD-vYSZviVYUb_rj3ij__anPXDTzYgA.woff2" \
  -o "$FONT_DIR/playfair-display-variable-latin.woff2"

echo "  Playfair Display italic (variable, 400-700)..."
curl -sL "https://fonts.gstatic.com/s/playfairdisplay/v40/nuFkD-vYSZviVYUb_rj3ij__anPXDTnogkk7.woff2" \
  -o "$FONT_DIR/playfair-display-variable-italic-latin.woff2"

echo ""
echo "Done! Downloaded $(ls -1 "$FONT_DIR"/*.woff2 2>/dev/null | wc -l) font files."
echo ""
echo "Font files:"
ls -lh "$FONT_DIR"/*.woff2 2>/dev/null || echo "  (no woff2 files found)"
