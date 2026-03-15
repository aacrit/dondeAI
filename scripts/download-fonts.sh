#!/usr/bin/env bash
# ============================================
# DondeAI — Download Self-Hosted Web Fonts
# Downloads woff2 files from google-webfonts-helper API
# Run once: bash scripts/download-fonts.sh
# ============================================

set -euo pipefail

FONT_DIR="$(cd "$(dirname "$0")/.." && pwd)/fonts"
mkdir -p "$FONT_DIR"

echo "Downloading fonts to $FONT_DIR ..."

# ---- Playfair Display ----
# Source: https://gwfh.mranftl.com/fonts/playfair-display (google-webfonts-helper)
echo "  Playfair Display 400..."
curl -sL "https://fonts.gstatic.com/s/playfairdisplay/v37/nuFvD-vYSZviVYUb_rj3ij__anPXJzDwcbmjWBN2PKdFvXDXbtM.woff2" \
  -o "$FONT_DIR/playfair-display-v37-latin-regular.woff2"

echo "  Playfair Display 700..."
curl -sL "https://fonts.gstatic.com/s/playfairdisplay/v37/nuFvD-vYSZviVYUb_rj3ij__anPXJzDwcbmjWBN2PKd3unDXbtM.woff2" \
  -o "$FONT_DIR/playfair-display-v37-latin-700.woff2"

echo "  Playfair Display italic 400..."
curl -sL "https://fonts.gstatic.com/s/playfairdisplay/v37/nuFRD-vYSZviVYUb_rj3ij__anPXDTnCjmHKM4nYO7KN_qiTbtbK-F2rA0s.woff2" \
  -o "$FONT_DIR/playfair-display-v37-latin-italic.woff2"

echo "  Playfair Display italic 700..."
curl -sL "https://fonts.gstatic.com/s/playfairdisplay/v37/nuFRD-vYSZviVYUb_rj3ij__anPXDTnCjmHKM4nYO7KN_qiTXtnK-F2rA0s.woff2" \
  -o "$FONT_DIR/playfair-display-v37-latin-700italic.woff2"

# ---- Inter ----
echo "  Inter 400..."
curl -sL "https://fonts.gstatic.com/s/inter/v18/UcCO3FwrK3iLTeHuS_nVMrMxCp50SjIw2boKoduKmMEVuLyfAZ9hiA.woff2" \
  -o "$FONT_DIR/inter-v18-latin-regular.woff2"

echo "  Inter 500..."
curl -sL "https://fonts.gstatic.com/s/inter/v18/UcCO3FwrK3iLTeHuS_nVMrMxCp50SjIw2boKoduKmMEVuI6fAZ9hiA.woff2" \
  -o "$FONT_DIR/inter-v18-latin-500.woff2"

echo "  Inter 600..."
curl -sL "https://fonts.gstatic.com/s/inter/v18/UcCO3FwrK3iLTeHuS_nVMrMxCp50SjIw2boKoduKmMEVuGKYAZ9hiA.woff2" \
  -o "$FONT_DIR/inter-v18-latin-600.woff2"

echo "  Inter 700..."
curl -sL "https://fonts.gstatic.com/s/inter/v18/UcCO3FwrK3iLTeHuS_nVMrMxCp50SjIw2boKoduKmMEVuFuYAZ9hiA.woff2" \
  -o "$FONT_DIR/inter-v18-latin-700.woff2"

# ---- JetBrains Mono ----
echo "  JetBrains Mono 400..."
curl -sL "https://fonts.gstatic.com/s/jetbrainsmono/v18/tDbY2o-flEEny0FZhsfKu5WU4zr3E_BX0PnT8RD8yKxTOlOTk6OThhvA.woff2" \
  -o "$FONT_DIR/jetbrains-mono-v18-latin-regular.woff2"

echo "  JetBrains Mono 500..."
curl -sL "https://fonts.gstatic.com/s/jetbrainsmono/v18/tDbY2o-flEEny0FZhsfKu5WU4zr3E_BX0PnT8RD8yKxTOlOTk6OThhvAWQ.woff2" \
  -o "$FONT_DIR/jetbrains-mono-v18-latin-500.woff2"

echo ""
echo "Done! Downloaded $(ls -1 "$FONT_DIR"/*.woff2 2>/dev/null | wc -l) font files."
echo ""
echo "Font files:"
ls -lh "$FONT_DIR"/*.woff2 2>/dev/null || echo "  (no woff2 files found — download may have failed)"
