/* ============================================
   DondeAI — Donde Card Generator
   Premium shareable card (1080x1920 Instagram Story format).
   Theme-aware, score ring, restaurant photo, watermark.
   ============================================ */

import { getState } from './state.js';

/* ---- Theme Color Palettes (hardcoded for canvas — CSS vars can't be read on offscreen canvas) ---- */
const THEME_PALETTES = {
  neutral: {
    light: {
      bg: '#f7f5f4',        // hsl(18 8% 97%)
      bg2: '#ffffff',        // hsl(18 6% 100%)
      fg: '#211e1c',        // hsl(18 12% 12%)
      fg2: '#6b6460',        // hsl(18 6% 40%)
      fg3: '#777069',        // hsl(18 4% 45%)
      ac: '#9b6045',        // hsl(18 45% 42%)
      ac2: '#8a5038',        // hsl(18 45% 34%)
      gradStart: '#9b6045',
      gradEnd: '#c4896e',
      ringTrack: 'rgba(155, 96, 69, 0.12)',
    },
    dark: {
      bg: '#131211',        // hsl(18 6% 7%)
      bg2: '#1e1c1b',        // hsl(18 5% 11%)
      fg: '#ece9e7',        // hsl(18 6% 92%)
      fg2: '#a8a29e',        // hsl(18 4% 65%)
      fg3: '#8a8580',        // hsl(18 3% 53%)
      ac: '#c4896e',        // hsl(18 38% 68%)
      ac2: '#d6a692',        // hsl(18 38% 78%)
      gradStart: '#9b6045',
      gradEnd: '#c4896e',
      ringTrack: 'rgba(196, 137, 110, 0.18)',
    },
  },
  indian: {
    light: {
      bg: '#f5ede4',        // hsl(30 35% 95%)
      bg2: '#fdf9f5',        // hsl(30 28% 99%)
      fg: '#231710',        // hsl(20 35% 12%)
      fg2: '#6e5541',        // hsl(20 18% 38%)
      fg3: '#6e6254',        // hsl(20 12% 43%)
      ac: '#ad5b11',        // hsl(28 88% 36%)
      ac2: '#89480d',        // hsl(28 88% 28%)
      gradStart: '#ad5b11',
      gradEnd: '#d48a3c',
      ringTrack: 'rgba(173, 91, 17, 0.14)',
    },
    dark: {
      bg: '#1a1410',        // hsl(22 22% 8%)
      bg2: '#241c15',        // hsl(22 18% 12%)
      fg: '#ebe1d4',        // hsl(30 22% 90%)
      fg2: '#a48e79',        // hsl(30 14% 62%)
      fg3: '#8e8176',        // hsl(30 8% 53%)
      ac: '#d99538',        // hsl(32 82% 58%)
      ac2: '#e5b56a',        // hsl(32 82% 68%)
      gradStart: '#ad5b11',
      gradEnd: '#d99538',
      ringTrack: 'rgba(217, 149, 56, 0.18)',
    },
  },
  japanese: {
    light: {
      bg: '#f7f5f0',        // hsl(45 12% 97%)
      bg2: '#fcfbf8',        // hsl(45 8% 99%)
      fg: '#232834',        // hsl(220 18% 15%)
      fg2: '#636b78',        // hsl(220 10% 42%)
      fg3: '#6c7077',        // hsl(220 6% 45%)
      ac: '#4a6499',        // hsl(220 35% 45%)
      ac2: '#3b507a',        // hsl(220 35% 36%)
      gradStart: '#3b507a',
      gradEnd: '#6882ad',
      ringTrack: 'rgba(74, 100, 153, 0.10)',
    },
    dark: {
      bg: '#101318',        // hsl(220 12% 7%)
      bg2: '#181c24',        // hsl(220 10% 11%)
      fg: '#dedbd4',        // hsl(45 8% 88%)
      fg2: '#918e85',        // hsl(45 5% 58%)
      fg3: '#847f78',        // hsl(45 3% 52%)
      ac: '#7b93ba',        // hsl(220 30% 62%)
      ac2: '#9bb0d0',        // hsl(220 30% 72%)
      gradStart: '#4a6499',
      gradEnd: '#7b93ba',
      ringTrack: 'rgba(123, 147, 186, 0.14)',
    },
  },
  middleeastern: {
    light: {
      bg: '#f4efe7',        // hsl(38 18% 95%)
      bg2: '#faf8f4',        // hsl(38 14% 98%)
      fg: '#231e11',        // hsl(35 25% 12%)
      fg2: '#695a42',        // hsl(35 12% 38%)
      fg3: '#706655',        // hsl(35 8% 42%)
      ac: '#6e5c11',        // hsl(48 72% 25%)
      ac2: '#584a0d',        // hsl(48 72% 20%)
      gradStart: '#6e5c11',
      gradEnd: '#a89530',
      ringTrack: 'rgba(110, 92, 17, 0.14)',
    },
    dark: {
      bg: '#17130d',        // hsl(35 15% 8%)
      bg2: '#221d14',        // hsl(35 12% 12%)
      fg: '#eae4d8',        // hsl(38 15% 90%)
      fg2: '#a39881',        // hsl(38 8% 62%)
      fg3: '#8b8373',        // hsl(38 5% 53%)
      ac: '#c9af35',        // hsl(48 65% 56%)
      ac2: '#dacc68',        // hsl(48 65% 66%)
      gradStart: '#8a7918',
      gradEnd: '#c9af35',
      ringTrack: 'rgba(201, 175, 53, 0.18)',
    },
  },
  southamerican: {
    light: {
      bg: '#f6f1e8',        // hsl(45 25% 96%)
      bg2: '#fcfaf5',        // hsl(45 20% 99%)
      fg: '#26121a',        // hsl(340 25% 12%)
      fg2: '#6b4d56',        // hsl(340 10% 38%)
      fg3: '#766c6f',        // hsl(340 6% 45%)
      ac: '#de264e',        // hsl(350 80% 48%)
      ac2: '#b61d3e',        // hsl(350 80% 40%)
      gradStart: '#b61d3e',
      gradEnd: '#de264e',
      ringTrack: 'rgba(222, 38, 78, 0.14)',
    },
    dark: {
      bg: '#171012',        // hsl(340 12% 7%)
      bg2: '#211920',        // hsl(340 10% 11%)
      fg: '#ebe5d7',        // hsl(45 18% 90%)
      fg2: '#a49680',        // hsl(45 10% 62%)
      fg3: '#8b847b',        // hsl(45 6% 53%)
      ac: '#e04870',        // hsl(350 75% 60%)
      ac2: '#ea7a9a',        // hsl(350 75% 70%)
      gradStart: '#b61d3e',
      gradEnd: '#e04870',
      ringTrack: 'rgba(224, 72, 112, 0.18)',
    },
  },
};

/* ---- Card Dimensions ---- */
const CARD_W = 1080;
const CARD_H = 1920;
const PAD = 72;     // horizontal padding
const PAD_TOP = 80;

/* ---- Helpers ---- */

/** Draw text with manual letter spacing (for cross-browser canvas support) */
function drawSpacedText(ctx, text, x, y, spacing) {
  const chars = text.split('');
  let offsetX = 0;
  // Measure total width to center if textAlign is center
  const totalWidth = chars.reduce((w, ch) => w + ctx.measureText(ch).width + spacing, -spacing);
  const align = ctx.textAlign;
  let startX = x;
  if (align === 'center') startX = x - totalWidth / 2;
  else if (align === 'right') startX = x - totalWidth;

  ctx.textAlign = 'left';
  for (const ch of chars) {
    ctx.fillText(ch, startX + offsetX, y);
    offsetX += ctx.measureText(ch).width + spacing;
  }
  ctx.textAlign = align;
}

/** Resolve theme palette for the active theme */
function getPalette() {
  const { theme } = getState();
  const culture = theme.culture || 'neutral';
  const mode = theme.mode || 'dark';
  const themePalette = THEME_PALETTES[culture] || THEME_PALETTES.neutral;
  return themePalette[mode] || themePalette.dark;
}

/** Wrap text to fit within maxWidth, return array of lines */
function wrapText(ctx, text, maxWidth) {
  const words = text.split(' ');
  const lines = [];
  let current = '';
  for (const word of words) {
    const test = current ? `${current} ${word}` : word;
    if (ctx.measureText(test).width > maxWidth) {
      if (current) lines.push(current);
      current = word;
    } else {
      current = test;
    }
  }
  if (current) lines.push(current);
  return lines;
}

/** Draw a rounded rectangle (clipping or stroke) */
function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.arcTo(x + w, y, x + w, y + r, r);
  ctx.lineTo(x + w, y + h - r);
  ctx.arcTo(x + w, y + h, x + w - r, y + h, r);
  ctx.lineTo(x + r, y + h);
  ctx.arcTo(x, y + h, x, y + h - r, r);
  ctx.lineTo(x, y + r);
  ctx.arcTo(x, y, x + r, y, r);
  ctx.closePath();
}

/** Load an image from URL, returns a promise. Resolves null on error. */
function loadImage(url) {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    // Timeout after 5s
    const timer = setTimeout(() => resolve(null), 5000);
    img.onload = () => { clearTimeout(timer); resolve(img); };
    img.src = url;
  });
}

/* ---- Score Ring Drawing ---- */
function drawScoreRing(ctx, cx, cy, radius, score, palette) {
  const lineWidth = 10;
  const startAngle = -Math.PI / 2;
  const endAngle = startAngle + (score / 100) * Math.PI * 2;

  // Track (background circle)
  ctx.beginPath();
  ctx.arc(cx, cy, radius, 0, Math.PI * 2);
  ctx.strokeStyle = palette.ringTrack;
  ctx.lineWidth = lineWidth;
  ctx.lineCap = 'round';
  ctx.stroke();

  // Score arc (gradient)
  const grad = ctx.createLinearGradient(cx - radius, cy - radius, cx + radius, cy + radius);
  grad.addColorStop(0, palette.gradStart);
  grad.addColorStop(1, palette.gradEnd);
  ctx.beginPath();
  ctx.arc(cx, cy, radius, startAngle, endAngle);
  ctx.strokeStyle = grad;
  ctx.lineWidth = lineWidth;
  ctx.lineCap = 'round';
  ctx.stroke();

  // Score number
  ctx.fillStyle = palette.fg;
  ctx.font = '700 42px "Playfair Display", Georgia, serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(`${score}`, cx, cy - 4);

  // "DondeMatch" label below number
  ctx.font = '500 16px "Inter", system-ui, sans-serif';
  ctx.fillStyle = palette.fg2;
  ctx.fillText('DondeMatch', cx, cy + 22);
}

/* ---- Cuisine Fallback Icon (when no photo) ---- */
function drawFallbackVisual(ctx, x, y, w, h, palette) {
  // Beautiful gradient background
  const grad = ctx.createLinearGradient(x, y, x + w, y + h);
  grad.addColorStop(0, palette.gradStart);
  grad.addColorStop(0.5, palette.gradEnd);
  grad.addColorStop(1, palette.ac);
  ctx.fillStyle = grad;

  roundRect(ctx, x, y, w, h, 24);
  ctx.fill();

  // Overlay pattern: subtle dot grid
  ctx.globalAlpha = 0.08;
  ctx.fillStyle = '#ffffff';
  const spacing = 48;
  for (let px = x + spacing; px < x + w; px += spacing) {
    for (let py = y + spacing; py < y + h; py += spacing) {
      ctx.beginPath();
      ctx.arc(px, py, 3, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  ctx.globalAlpha = 1;

  // Large decorative text (utensil icon)
  const iconCx = x + w / 2;
  const iconCy = y + h / 2;
  ctx.fillStyle = 'rgba(255,255,255,0.15)';
  ctx.font = '180px serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('\u{1F37D}', iconCx, iconCy);
}

/* ---- Decorative Accent Line ---- */
function drawThemeAccent(ctx, y, palette) {
  const accentW = 120;
  const startX = (CARD_W - accentW) / 2;

  // Gradient accent bar
  const grad = ctx.createLinearGradient(startX, y, startX + accentW, y);
  grad.addColorStop(0, 'transparent');
  grad.addColorStop(0.2, palette.ac);
  grad.addColorStop(0.8, palette.ac);
  grad.addColorStop(1, 'transparent');
  ctx.fillStyle = grad;
  ctx.fillRect(startX, y, accentW, 3);
}

/* ---- Main Generator ---- */

/**
 * Generate a Donde Card as a Blob.
 * @param {Object} resultData - the full result object from state (result)
 * @returns {Promise<Blob>} PNG blob of the card
 */
export async function generateDondeCard(resultData) {
  if (!resultData?.restaurant) {
    throw new Error('No restaurant data provided');
  }

  const palette = getPalette();
  const r = resultData.restaurant;
  const score = Math.round(parseFloat(resultData.donde_match) || 0);

  // Create offscreen canvas
  const canvas = document.createElement('canvas');
  canvas.width = CARD_W;
  canvas.height = CARD_H;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas 2D context unavailable');

  // ========== BACKGROUND ==========
  ctx.fillStyle = palette.bg;
  ctx.fillRect(0, 0, CARD_W, CARD_H);

  // Gradient wash from top
  const bgGrad = ctx.createLinearGradient(0, 0, 0, CARD_H);
  bgGrad.addColorStop(0, palette.gradStart + '18');
  bgGrad.addColorStop(0.35, 'transparent');
  bgGrad.addColorStop(0.7, 'transparent');
  bgGrad.addColorStop(1, palette.gradEnd + '10');
  ctx.fillStyle = bgGrad;
  ctx.fillRect(0, 0, CARD_W, CARD_H);

  // Radial glow top-right
  const radGrad = ctx.createRadialGradient(
    CARD_W * 0.8, CARD_H * 0.1, 0,
    CARD_W * 0.8, CARD_H * 0.1, CARD_W * 0.6
  );
  radGrad.addColorStop(0, palette.ac + '14');
  radGrad.addColorStop(1, 'transparent');
  ctx.fillStyle = radGrad;
  ctx.fillRect(0, 0, CARD_W, CARD_H);

  // ========== DONDE WORDMARK (top) ==========
  let y = PAD_TOP;
  ctx.fillStyle = palette.fg3;
  ctx.font = '600 28px "Inter", system-ui, sans-serif';
  ctx.textAlign = 'center';
  drawSpacedText(ctx, 'DONDE', CARD_W / 2, y, 12);

  y += 16;
  drawThemeAccent(ctx, y, palette);

  // ========== RESTAURANT PHOTO ==========
  y += 48;
  const photoW = CARD_W - PAD * 2;
  const photoH = Math.round(CARD_H * 0.38);
  const photoX = PAD;
  const photoY = y;

  const photoUrl = r.photo_urls?.[0] || null;
  const img = photoUrl ? await loadImage(photoUrl) : null;

  if (img) {
    ctx.save();
    roundRect(ctx, photoX, photoY, photoW, photoH, 24);
    ctx.clip();

    // Cover-fit the image
    const imgAspect = img.width / img.height;
    const boxAspect = photoW / photoH;
    let sx = 0, sy = 0, sw = img.width, sh = img.height;
    if (imgAspect > boxAspect) {
      sw = img.height * boxAspect;
      sx = (img.width - sw) / 2;
    } else {
      sh = img.width / boxAspect;
      sy = (img.height - sh) / 2;
    }
    ctx.drawImage(img, sx, sy, sw, sh, photoX, photoY, photoW, photoH);

    // Subtle dark vignette at bottom of photo
    const photoOverlay = ctx.createLinearGradient(
      photoX, photoY + photoH * 0.6,
      photoX, photoY + photoH
    );
    photoOverlay.addColorStop(0, 'rgba(0,0,0,0)');
    photoOverlay.addColorStop(1, 'rgba(0,0,0,0.25)');
    ctx.fillStyle = photoOverlay;
    ctx.fillRect(photoX, photoY, photoW, photoH);

    ctx.restore();

    // Photo shadow (drawn outside clip)
    ctx.save();
    ctx.shadowColor = 'rgba(0,0,0,0.18)';
    ctx.shadowBlur = 32;
    ctx.shadowOffsetY = 8;
    ctx.strokeStyle = 'rgba(0,0,0,0)';
    ctx.lineWidth = 0;
    roundRect(ctx, photoX, photoY, photoW, photoH, 24);
    ctx.stroke();
    ctx.restore();
  } else {
    drawFallbackVisual(ctx, photoX, photoY, photoW, photoH, palette);
  }

  y = photoY + photoH + 56;

  // ========== RESTAURANT NAME ==========
  ctx.fillStyle = palette.fg;
  ctx.font = '700 56px "Playfair Display", Georgia, serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';

  const nameText = r.name || 'Restaurant';
  const nameLines = wrapText(ctx, nameText, CARD_W - PAD * 2);
  const nameLineHeight = 68;

  for (const line of nameLines) {
    ctx.fillText(line, CARD_W / 2, y);
    y += nameLineHeight;
  }

  y += 12;

  // ========== NEIGHBORHOOD BADGE ==========
  const neighborhood = r.neighborhood_name || '';
  if (neighborhood) {
    ctx.font = '600 24px "Inter", system-ui, sans-serif';
    const badgeText = neighborhood.toUpperCase();
    const badgeCharWidths = badgeText.split('').reduce(
      (w, ch) => w + ctx.measureText(ch).width + 3, -3
    );
    const badgeW = badgeCharWidths + 48;
    const badgeH = 42;
    const badgeX = (CARD_W - badgeW) / 2;
    const badgeY = y;

    // Badge background
    ctx.fillStyle = palette.ac + '18';
    roundRect(ctx, badgeX, badgeY, badgeW, badgeH, badgeH / 2);
    ctx.fill();

    // Badge border
    ctx.strokeStyle = palette.ac + '40';
    ctx.lineWidth = 1.5;
    roundRect(ctx, badgeX, badgeY, badgeW, badgeH, badgeH / 2);
    ctx.stroke();

    // Badge text
    ctx.fillStyle = palette.ac;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    drawSpacedText(ctx, badgeText, CARD_W / 2, badgeY + badgeH / 2, 3);

    y += badgeH + 40;
  } else {
    y += 20;
  }

  // ========== SCORE RING ==========
  const ringRadius = 56;
  const ringCx = CARD_W / 2;
  const ringCy = y + ringRadius + 8;
  drawScoreRing(ctx, ringCx, ringCy, ringRadius, score, palette);

  y = ringCy + ringRadius + 48;

  // ========== ACCENT LINE ==========
  drawThemeAccent(ctx, y, palette);
  y += 32;

  // ========== "WHY THIS PICK" ==========
  const whyText = _getWhyText(resultData);
  if (whyText) {
    ctx.font = 'italic 400 30px "Playfair Display", Georgia, serif';
    ctx.fillStyle = palette.fg2;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';

    const whyLines = wrapText(ctx, whyText, CARD_W - PAD * 2 - 40);
    const displayLines = whyLines.slice(0, 2);
    const whyLineHeight = 42;

    // Opening quote mark
    ctx.font = '300 60px "Playfair Display", Georgia, serif';
    ctx.fillStyle = palette.ac + '50';
    ctx.fillText('\u201C', CARD_W / 2, y - 20);
    y += 36;

    ctx.font = 'italic 400 30px "Playfair Display", Georgia, serif';
    ctx.fillStyle = palette.fg2;
    for (const line of displayLines) {
      ctx.fillText(line, CARD_W / 2, y);
      y += whyLineHeight;
    }

    y += 16;
  }

  // ========== CUISINE TYPE & PRICE ==========
  const meta = [];
  if (r.cuisine_type) meta.push(r.cuisine_type);
  if (r.price_level) meta.push(r.price_level);

  if (meta.length > 0) {
    ctx.font = '500 22px "Inter", system-ui, sans-serif';
    ctx.fillStyle = palette.fg3;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.fillText(meta.join('  \u00B7  '), CARD_W / 2, y);
    y += 36;
  }

  // ========== BOTTOM WATERMARK ==========
  const watermarkY = CARD_H - PAD - 10;

  // Subtle gradient fade at bottom
  const bottomFade = ctx.createLinearGradient(0, CARD_H - 140, 0, CARD_H);
  bottomFade.addColorStop(0, 'transparent');
  bottomFade.addColorStop(1, palette.bg + '80');
  ctx.fillStyle = bottomFade;
  ctx.fillRect(0, CARD_H - 140, CARD_W, 140);

  // Watermark accent line
  drawThemeAccent(ctx, watermarkY - 40, palette);

  // Watermark text
  ctx.font = '500 22px "Inter", system-ui, sans-serif';
  ctx.fillStyle = palette.fg3 + 'aa';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'bottom';
  drawSpacedText(ctx, 'FOUND ON DONDE', CARD_W / 2, watermarkY, 3);

  // ========== EXPORT ==========
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => blob ? resolve(blob) : reject(new Error('Canvas toBlob failed')),
      'image/png',
      1.0
    );
  });
}

/* ---- Extract "why" text from match narrative or recommendation ---- */
function _getWhyText(resultData) {
  const narrative = resultData.match_narrative;

  // Prefer the summary from match_narrative
  if (narrative?.summary) {
    return narrative.summary;
  }

  // Fallback: strongest factor + key signals
  if (narrative?.strongest_factor && narrative?.key_signals?.length > 0) {
    return `Top-tier ${narrative.strongest_factor}: ${narrative.key_signals.slice(0, 2).join(', ')}`;
  }

  // Fallback: recommendation text (trim to ~100 chars)
  if (resultData.recommendation) {
    const rec = resultData.recommendation;
    if (rec.length <= 100) return rec;
    const truncated = rec.slice(0, 100);
    const lastSpace = truncated.lastIndexOf(' ');
    return truncated.slice(0, lastSpace > 50 ? lastSpace : 100) + '\u2026';
  }

  // Fallback: one-liner
  if (resultData.restaurant?.best_for_oneliner) {
    return resultData.restaurant.best_for_oneliner;
  }

  return '';
}

/* ---- Download Card (Save to Photos) ---- */
export function downloadDondeCard(blob, restaurantName) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  const safeName = (restaurantName || 'restaurant')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
  a.href = url;
  a.download = `donde-${safeName}.png`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/* ---- Share Card via Navigator.share ---- */
export async function shareDondeCard(blob, restaurantName) {
  const safeName = (restaurantName || 'restaurant')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-');
  const file = new File([blob], `donde-${safeName}.png`, { type: 'image/png' });

  if (navigator.share && navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({
        title: `${restaurantName} \u2014 Donde Pick`,
        text: `Check out ${restaurantName} on Donde!`,
        files: [file],
      });
      return true;
    } catch {
      return false;
    }
  }
  return false;
}
