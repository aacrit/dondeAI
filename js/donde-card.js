/* ============================================
   DondeAI — Donde Card Generator V3
   Reel-format (9:16) shareable card — 1080x1920.
   Single card: score ring, name, full blurb, QR.
   Bold cultural theme backgrounds.
   ============================================ */

import { getState } from './state.js';

/* ---- Theme Color Palettes ---- */
const THEME_PALETTES = {
  neutral: {
    light: {
      bg: '#f7f5f4', bg2: '#ffffff', bg3: '#f0eeec',
      fg: '#211e1c', fg2: '#6b6460', fg3: '#777069',
      ac: '#9b6045', ac2: '#8a5038', acSoft: 'rgba(155,96,69,0.12)',
      gradStart: '#9b6045', gradEnd: '#c4896e',
      ringTrack: 'rgba(155,96,69,0.12)',
      border: '#dddad7', glass: 'rgba(255,255,255,0.72)',
      ragGreen: '#38a169', ragAmber: '#d69e2e', ragRed: '#e53e3e',
    },
    dark: {
      bg: '#131211', bg2: '#1e1c1b', bg3: '#2a2826',
      fg: '#ece9e7', fg2: '#a8a29e', fg3: '#8a8580',
      ac: '#c4896e', ac2: '#d6a692', acSoft: 'rgba(196,137,110,0.15)',
      gradStart: '#9b6045', gradEnd: '#c4896e',
      ringTrack: 'rgba(196,137,110,0.18)',
      border: 'rgba(255,255,255,0.10)', glass: 'rgba(30,28,27,0.72)',
      ragGreen: '#68d391', ragAmber: '#f6e05e', ragRed: '#fc8181',
    },
  },
  indian: {
    light: {
      bg: '#f5ede4', bg2: '#fdf9f5', bg3: '#efe5d8',
      fg: '#231710', fg2: '#6e5541', fg3: '#6e6254',
      ac: '#ad5b11', ac2: '#89480d', acSoft: 'rgba(173,91,17,0.12)',
      gradStart: '#ad5b11', gradEnd: '#d48a3c',
      ringTrack: 'rgba(173,91,17,0.14)',
      border: '#ddd2c3', glass: 'rgba(253,249,245,0.78)',
      ragGreen: '#38a169', ragAmber: '#d69e2e', ragRed: '#e53e3e',
    },
    dark: {
      bg: '#1a1410', bg2: '#241c15', bg3: '#302618',
      fg: '#ebe1d4', fg2: '#a48e79', fg3: '#8e8176',
      ac: '#d99538', ac2: '#e5b56a', acSoft: 'rgba(217,149,56,0.15)',
      gradStart: '#ad5b11', gradEnd: '#d99538',
      ringTrack: 'rgba(217,149,56,0.18)',
      border: 'rgba(255,255,255,0.10)', glass: 'rgba(36,28,21,0.72)',
      ragGreen: '#68d391', ragAmber: '#f6e05e', ragRed: '#fc8181',
    },
  },
  japanese: {
    light: {
      bg: '#f7f5f0', bg2: '#fcfbf8', bg3: '#eeecea',
      fg: '#232834', fg2: '#636b78', fg3: '#6c7077',
      ac: '#4a6499', ac2: '#3b507a', acSoft: 'rgba(74,100,153,0.10)',
      gradStart: '#3b507a', gradEnd: '#6882ad',
      ringTrack: 'rgba(74,100,153,0.10)',
      border: '#d8d6d0', glass: 'rgba(252,251,248,0.70)',
      ragGreen: '#38a169', ragAmber: '#d69e2e', ragRed: '#e53e3e',
    },
    dark: {
      bg: '#101318', bg2: '#181c24', bg3: '#22262e',
      fg: '#dedbd4', fg2: '#918e85', fg3: '#847f78',
      ac: '#7b93ba', ac2: '#9bb0d0', acSoft: 'rgba(123,147,186,0.12)',
      gradStart: '#4a6499', gradEnd: '#7b93ba',
      ringTrack: 'rgba(123,147,186,0.14)',
      border: 'rgba(255,255,255,0.10)', glass: 'rgba(24,28,36,0.72)',
      ragGreen: '#68d391', ragAmber: '#f6e05e', ragRed: '#fc8181',
    },
  },
  middleeastern: {
    light: {
      bg: '#f4efe7', bg2: '#faf8f4', bg3: '#ece6da',
      fg: '#231e11', fg2: '#695a42', fg3: '#706655',
      ac: '#6e5c11', ac2: '#584a0d', acSoft: 'rgba(110,92,17,0.12)',
      gradStart: '#6e5c11', gradEnd: '#a89530',
      ringTrack: 'rgba(110,92,17,0.14)',
      border: '#d8d0c0', glass: 'rgba(250,248,244,0.76)',
      ragGreen: '#38a169', ragAmber: '#d69e2e', ragRed: '#e53e3e',
    },
    dark: {
      bg: '#17130d', bg2: '#221d14', bg3: '#2c2518',
      fg: '#eae4d8', fg2: '#a39881', fg3: '#8b8373',
      ac: '#c9af35', ac2: '#dacc68', acSoft: 'rgba(201,175,53,0.15)',
      gradStart: '#8a7918', gradEnd: '#c9af35',
      ringTrack: 'rgba(201,175,53,0.18)',
      border: 'rgba(255,255,255,0.10)', glass: 'rgba(34,29,20,0.72)',
      ragGreen: '#68d391', ragAmber: '#f6e05e', ragRed: '#fc8181',
    },
  },
  southamerican: {
    light: {
      bg: '#f6f1e8', bg2: '#fcfaf5', bg3: '#ede6da',
      fg: '#26121a', fg2: '#6b4d56', fg3: '#766c6f',
      ac: '#de264e', ac2: '#b61d3e', acSoft: 'rgba(222,38,78,0.12)',
      gradStart: '#b61d3e', gradEnd: '#de264e',
      ringTrack: 'rgba(222,38,78,0.14)',
      border: '#d8d0c4', glass: 'rgba(252,250,245,0.74)',
      ragGreen: '#38a169', ragAmber: '#d69e2e', ragRed: '#e53e3e',
    },
    dark: {
      bg: '#171012', bg2: '#211920', bg3: '#2c222a',
      fg: '#ebe5d7', fg2: '#a49680', fg3: '#8b847b',
      ac: '#e04870', ac2: '#ea7a9a', acSoft: 'rgba(224,72,112,0.15)',
      gradStart: '#b61d3e', gradEnd: '#e04870',
      ringTrack: 'rgba(224,72,112,0.18)',
      border: 'rgba(255,255,255,0.10)', glass: 'rgba(33,25,32,0.72)',
      ragGreen: '#68d391', ragAmber: '#f6e05e', ragRed: '#fc8181',
    },
  },
};

/* ---- Cultural Theme Pattern Drawers (bold visibility) ---- */
const THEME_PATTERNS = {
  neutral(ctx, w, h, p) {
    ctx.save(); ctx.globalAlpha = 0.09; ctx.strokeStyle = p.ac; ctx.lineWidth = 1.4;
    for (let x = 0; x < w; x += 70) for (let y = 0; y < h; y += 70) {
      ctx.beginPath();
      ctx.moveTo(x + 10, y + 8); ctx.quadraticCurveTo(x + 15, y + 12, x + 20, y + 16); ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(x + 20, y + 8); ctx.quadraticCurveTo(x + 15, y + 13, x + 10, y + 16); ctx.stroke();
    }
    ctx.restore();
  },
  indian(ctx, w, h, p) {
    ctx.save(); ctx.globalAlpha = 0.10; ctx.strokeStyle = p.ac; ctx.lineWidth = 1.2;
    for (let x = 30; x < w; x += 80) for (let y = 30; y < h; y += 80) {
      ctx.beginPath();
      ctx.moveTo(x, y - 10); ctx.quadraticCurveTo(x + 10, y, x, y + 10);
      ctx.quadraticCurveTo(x - 10, y, x, y - 10); ctx.stroke();
      ctx.beginPath(); ctx.arc(x, y, 2, 0, Math.PI * 2);
      ctx.fillStyle = p.ac; ctx.fill();
    }
    ctx.restore();
  },
  japanese(ctx, w, h, p) {
    ctx.save(); ctx.globalAlpha = 0.08; ctx.strokeStyle = p.ac; ctx.lineWidth = 1;
    const r = 32;
    for (let row = 0; row < Math.ceil(h / (r * 2)) + 1; row++) {
      const yy = row * r * 2; const xShift = (row % 2) * r;
      for (let col = -1; col < Math.ceil(w / (r * 2)) + 1; col++) {
        const cx = col * r * 2 + xShift;
        ctx.beginPath(); ctx.arc(cx, yy, r, Math.PI, 0); ctx.stroke();
        ctx.beginPath(); ctx.arc(cx, yy, r * 0.6, Math.PI, 0); ctx.stroke();
      }
    }
    ctx.restore();
  },
  middleeastern(ctx, w, h, p) {
    ctx.save(); ctx.globalAlpha = 0.10; ctx.strokeStyle = p.ac; ctx.lineWidth = 1;
    for (let x = 0; x < w; x += 50) for (let y = 0; y < h; y += 50) {
      const cx = x + 25, cy = y + 25;
      ctx.beginPath();
      ctx.moveTo(cx, cy - 13); ctx.lineTo(cx + 13, cy);
      ctx.lineTo(cx, cy + 13); ctx.lineTo(cx - 13, cy); ctx.closePath(); ctx.stroke();
    }
    ctx.restore();
  },
  southamerican(ctx, w, h, p) {
    ctx.save(); ctx.globalAlpha = 0.09; ctx.strokeStyle = p.ac; ctx.lineWidth = 1;
    for (let x = 25; x < w; x += 60) for (let y = 25; y < h; y += 60) {
      for (let a = 0; a < Math.PI * 2; a += Math.PI / 4) {
        ctx.beginPath();
        ctx.moveTo(x + Math.cos(a) * 5, y + Math.sin(a) * 5);
        ctx.lineTo(x + Math.cos(a) * 14, y + Math.sin(a) * 14); ctx.stroke();
      }
      ctx.beginPath(); ctx.arc(x, y, 3, 0, Math.PI * 2); ctx.stroke();
    }
    ctx.restore();
  },
};

/* ---- Constants ---- */
const CW = 1080;
const CH = 1920;
const PAD = 72;
const CONTENT_W = CW - PAD * 2;
const TAGLINE = 'One Pick. Zero Stress.';

/* ======== HELPERS ======== */

function getPalette() {
  const { theme } = getState();
  const culture = theme.culture || 'neutral';
  const mode = theme.mode || 'dark';
  return (THEME_PALETTES[culture] || THEME_PALETTES.neutral)[mode] || THEME_PALETTES.neutral.dark;
}
function getCulture() { return getState().theme?.culture || 'neutral'; }
function isDarkMode() { return getState().theme?.mode === 'dark'; }

function wrapText(ctx, text, maxWidth) {
  const words = text.split(' ');
  const lines = []; let current = '';
  for (const word of words) {
    const test = current ? `${current} ${word}` : word;
    if (ctx.measureText(test).width > maxWidth) { if (current) lines.push(current); current = word; }
    else current = test;
  }
  if (current) lines.push(current);
  return lines;
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath(); ctx.moveTo(x + r, y); ctx.lineTo(x + w - r, y);
  ctx.arcTo(x + w, y, x + w, y + r, r); ctx.lineTo(x + w, y + h - r);
  ctx.arcTo(x + w, y + h, x + w - r, y + h, r); ctx.lineTo(x + r, y + h);
  ctx.arcTo(x, y + h, x, y + h - r, r); ctx.lineTo(x, y + r);
  ctx.arcTo(x, y, x + r, y, r); ctx.closePath();
}

function getScoreColor(score, p) {
  if (score >= 80) return p.ragGreen;
  if (score >= 60) return p.ragAmber;
  return p.ragRed;
}
function getScoreTier(score) {
  if (score >= 90) return 'Outstanding';
  if (score >= 80) return 'Strong Pick';
  if (score >= 70) return 'Solid Option';
  if (score >= 60) return 'Worth a Try';
  return 'Best Available';
}

/* ---- Factor Bar ---- */
function drawFactorBar(ctx, x, y, w, label, value, p) {
  const barH = 10;
  ctx.font = '500 20px "Inter", system-ui, sans-serif';
  ctx.fillStyle = p.fg2; ctx.textAlign = 'left'; ctx.textBaseline = 'top';
  ctx.fillText(label, x, y);
  ctx.textAlign = 'right'; ctx.fillStyle = p.fg3;
  ctx.fillText(typeof value === 'number' ? value.toFixed(1) : String(value), x + w, y);
  const barY = y + 28;
  ctx.fillStyle = p.bg3; roundRect(ctx, x, barY, w, barH, barH / 2); ctx.fill();
  const fillW = Math.max(barH, (parseFloat(value) / 10) * w);
  const grad = ctx.createLinearGradient(x, barY, x + fillW, barY);
  grad.addColorStop(0, p.gradStart); grad.addColorStop(1, p.gradEnd);
  ctx.fillStyle = grad; roundRect(ctx, x, barY, fillW, barH, barH / 2); ctx.fill();
  return barY + barH;
}

/* ---- Separator ---- */
function drawSeparator(ctx, y, p) {
  const w = 200;
  const grad = ctx.createLinearGradient((CW - w) / 2, 0, (CW + w) / 2, 0);
  grad.addColorStop(0, 'transparent'); grad.addColorStop(0.15, p.ac + '50');
  grad.addColorStop(0.5, p.ac); grad.addColorStop(0.85, p.ac + '50');
  grad.addColorStop(1, 'transparent');
  ctx.fillStyle = grad; ctx.fillRect((CW - w) / 2, y, w, 2.5);
  ctx.fillStyle = p.ac + '70';
  ctx.save(); ctx.translate(CW / 2, y + 1);
  ctx.rotate(Math.PI / 4);
  ctx.fillRect(-4, -4, 8, 8);
  ctx.restore();
}

/* ---- QR Code Generator ---- */
function generateQRMatrix(text) {
  const size = 25;
  const matrix = Array.from({ length: size }, () => Array(size).fill(false));
  const drawFinder = (ox, oy) => {
    for (let y = 0; y < 7; y++) for (let x = 0; x < 7; x++)
      matrix[oy + y][ox + x] = y === 0 || y === 6 || x === 0 || x === 6 || (x >= 2 && x <= 4 && y >= 2 && y <= 4);
  };
  drawFinder(0, 0); drawFinder(size - 7, 0); drawFinder(0, size - 7);
  for (let i = 8; i < size - 8; i++) { matrix[6][i] = i % 2 === 0; matrix[i][6] = i % 2 === 0; }
  for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++)
    matrix[size - 9 + dy][size - 9 + dx] = Math.abs(dx) === 2 || Math.abs(dy) === 2 || (dx === 0 && dy === 0);
  const bytes = [];
  for (let i = 0; i < text.length; i++) bytes.push(text.charCodeAt(i));
  while (bytes.length < 44) bytes.push(bytes.length % 2 === 0 ? 236 : 17);
  let byteIdx = 0, bitIdx = 0;
  for (let col = size - 1; col >= 1; col -= 2) {
    if (col === 6) col = 5;
    for (let row = 0; row < size; row++) for (let c = 0; c < 2; c++) {
      const x = col - c;
      const yy = (Math.floor((size - 1 - col) / 2) % 2 === 0) ? row : size - 1 - row;
      if (yy < 0 || yy >= size || x < 0 || x >= size) continue;
      if ((x < 9 && yy < 9) || (x >= size - 8 && yy < 9) || (x < 9 && yy >= size - 8) ||
          x === 6 || yy === 6 || (x >= size - 11 && x <= size - 7 && yy >= size - 11 && yy <= size - 7)) continue;
      if (byteIdx < bytes.length) {
        const bit = (bytes[byteIdx] >> (7 - bitIdx)) & 1;
        matrix[yy][x] = (bit === 1) !== ((yy + x) % 2 === 0);
        bitIdx++; if (bitIdx === 8) { bitIdx = 0; byteIdx++; }
      }
    }
  }
  matrix[size - 8][8] = true;
  return matrix;
}

function drawQRCode(ctx, x, y, size, matrix, fg, bg) {
  const modules = matrix.length, moduleSize = size / modules;
  ctx.fillStyle = bg; roundRect(ctx, x - 8, y - 8, size + 16, size + 16, 12); ctx.fill();
  ctx.fillStyle = fg;
  for (let r = 0; r < modules; r++) for (let c = 0; c < modules; c++)
    if (matrix[r][c]) ctx.fillRect(x + c * moduleSize, y + r * moduleSize, moduleSize + 0.5, moduleSize + 0.5);
}

/* ---- Score Ring ---- */
function drawScoreRing(ctx, cx, cy, radius, score, p, opts = {}) {
  const lw = opts.lineWidth || (radius > 40 ? 10 : 7);
  ctx.beginPath(); ctx.arc(cx, cy, radius, 0, Math.PI * 2);
  ctx.strokeStyle = p.ringTrack; ctx.lineWidth = lw; ctx.lineCap = 'round'; ctx.stroke();
  const color = getScoreColor(score, p);
  ctx.beginPath();
  ctx.arc(cx, cy, radius, -Math.PI / 2, -Math.PI / 2 + (score / 100) * Math.PI * 2);
  ctx.strokeStyle = color; ctx.lineWidth = lw; ctx.lineCap = 'round'; ctx.stroke();
  const ns = opts.numSize || (radius > 40 ? 48 : radius > 25 ? 32 : 22);
  ctx.fillStyle = color;
  ctx.font = `700 ${ns}px "Playfair Display", Georgia, serif`;
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText(`${score}`, cx, opts.showLabel ? cy - ns * 0.15 : cy);
  if (opts.showLabel) {
    ctx.font = `500 ${opts.labelSize || 14}px "Inter", system-ui, sans-serif`;
    ctx.fillStyle = p.fg3; ctx.fillText('Match\u2122', cx, cy + ns * 0.55);
  }
}

/* ---- Donde Question-Pin Logo (actual brand mark from app header) ---- */
function drawDondeLogo(ctx, cx, cy, size, color) {
  // SVG viewBox 0 0 32 44 — scale to requested size
  const s = size / 44;
  ctx.save();
  ctx.translate(cx - 16 * s, cy - 22 * s);
  ctx.scale(s, s);
  ctx.strokeStyle = color;
  ctx.fillStyle = color;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  // Left tine
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.moveTo(10.5, 1);
  ctx.bezierCurveTo(10.5, 1, 10, 8.5, 12.5, 11.5);
  ctx.quadraticCurveTo(14, 13, 14.5, 13.5);
  ctx.stroke();
  // Right tine
  ctx.beginPath();
  ctx.moveTo(21.5, 1);
  ctx.bezierCurveTo(21.5, 1, 22, 8.5, 19.5, 11.5);
  ctx.quadraticCurveTo(18, 13, 17.5, 13.5);
  ctx.stroke();
  // Question-mark curve
  ctx.lineWidth = 2.8;
  ctx.beginPath();
  ctx.moveTo(16, 13.5);
  ctx.bezierCurveTo(22, 11, 29, 14, 28, 21);
  ctx.bezierCurveTo(27, 27, 19, 29, 16, 31);
  ctx.lineTo(16, 34);
  ctx.stroke();
  // Pin dot
  ctx.beginPath();
  ctx.arc(16, 40, 2.8, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

/* ---- Centered Pills Row ---- */
function drawCenteredPills(ctx, y, parts, p) {
  const fontSize = 22, pillH = 42, pillPad = 22, pillGap = 14;
  ctx.font = `500 ${fontSize}px "Inter", system-ui, sans-serif`;
  const widths = parts.map(text => ctx.measureText(text).width + pillPad * 2);
  const totalW = widths.reduce((sum, w) => sum + w + pillGap, -pillGap);
  let px = (CW - totalW) / 2;
  for (let i = 0; i < parts.length; i++) {
    const pw = widths[i];
    ctx.fillStyle = p.acSoft; roundRect(ctx, px, y, pw, pillH, pillH / 2); ctx.fill();
    ctx.strokeStyle = p.ac + '35'; ctx.lineWidth = 1.5;
    roundRect(ctx, px, y, pw, pillH, pillH / 2); ctx.stroke();
    ctx.fillStyle = p.ac; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(parts[i], px + pw / 2, y + pillH / 2 + 1);
    px += pw + pillGap;
  }
  return y + pillH;
}

/* ---- Reel Background ---- */
function drawReelBackground(ctx, p, culture) {
  ctx.fillStyle = p.bg;
  ctx.fillRect(0, 0, CW, CH);
  (THEME_PATTERNS[culture] || THEME_PATTERNS.neutral)(ctx, CW, CH, p);
  const topGrad = ctx.createLinearGradient(0, 0, 0, 420);
  topGrad.addColorStop(0, p.gradStart + '48');
  topGrad.addColorStop(0.4, p.gradEnd + '28');
  topGrad.addColorStop(1, 'transparent');
  ctx.fillStyle = topGrad;
  ctx.fillRect(0, 0, CW, 420);
  const botGrad = ctx.createLinearGradient(0, CH - 340, 0, CH);
  botGrad.addColorStop(0, 'transparent');
  botGrad.addColorStop(0.4, p.gradEnd + '18');
  botGrad.addColorStop(1, p.gradStart + '3a');
  ctx.fillStyle = botGrad;
  ctx.fillRect(0, CH - 280, CW, 280);
  const rg1 = ctx.createRadialGradient(CW * 0.82, CH * 0.04, 0, CW * 0.82, CH * 0.04, CW * 0.5);
  rg1.addColorStop(0, p.ac + '1a');
  rg1.addColorStop(1, 'transparent');
  ctx.fillStyle = rg1;
  ctx.fillRect(0, 0, CW, CH);
  const rg2 = ctx.createRadialGradient(CW * 0.18, CH * 0.88, 0, CW * 0.18, CH * 0.88, CW * 0.4);
  rg2.addColorStop(0, p.ac + '10');
  rg2.addColorStop(1, 'transparent');
  ctx.fillStyle = rg2;
  ctx.fillRect(0, 0, CW, CH);
  ctx.strokeStyle = p.ac + '2a';
  ctx.lineWidth = 3;
  roundRect(ctx, 12, 12, CW - 24, CH - 24, 36);
  ctx.stroke();
  ctx.strokeStyle = p.ac + '10';
  ctx.lineWidth = 1;
  roundRect(ctx, 22, 22, CW - 44, CH - 44, 30);
  ctx.stroke();
}

/* ---- Branded Footer (bottom-anchored) ---- */
function drawBrandedFooter(ctx, p) {
  const dark = isDarkMode();
  const sepY = CH - 440;
  drawSeparator(ctx, sepY, p);

  // Logo mark (actual Question Pin) + wordmark side by side
  const brandY = sepY + 36;
  drawDondeLogo(ctx, CW / 2 - 70, brandY + 24, 44, p.ac);

  // "Donde" wordmark next to logo
  ctx.font = '700 44px "Playfair Display", Georgia, serif';
  ctx.fillStyle = p.fg;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.fillText('Donde', CW / 2 - 38, brandY + 24);

  // Tagline
  const tagY = brandY + 54;
  ctx.font = '400 19px "Inter", system-ui, sans-serif';
  ctx.fillStyle = p.fg3;
  ctx.textAlign = 'center';
  ctx.fillText(TAGLINE, CW / 2, tagY);

  // QR Code
  const qrSize = 140;
  const qrX = (CW - qrSize) / 2;
  const qrY = tagY + 36;
  const matrix = generateQRMatrix('https://aacrit.github.io/dondeAI');
  drawQRCode(ctx, qrX, qrY, qrSize, matrix, dark ? p.fg : p.fg, dark ? p.bg2 : '#ffffff');

  // Logo inside QR center
  const qrCX = qrX + qrSize / 2;
  const qrCY = qrY + qrSize / 2;
  ctx.beginPath();
  ctx.arc(qrCX, qrCY, 20, 0, Math.PI * 2);
  ctx.fillStyle = dark ? p.bg2 : '#ffffff';
  ctx.fill();
  drawDondeLogo(ctx, qrCX, qrCY, 28, p.ac);

  // CTA
  const ctaY = qrY + qrSize + 24;
  ctx.font = '600 18px "Inter", system-ui, sans-serif';
  ctx.fillStyle = p.ac;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  ctx.fillText('Scan to discover on Donde \u2192', CW / 2, ctaY);
}

/* ======== REEL CARD — 1080x1920 (9:16) ======== */
async function buildReelCard(resultData, p, culture) {
  const r = resultData.restaurant;
  const score = Math.round(parseFloat(resultData.donde_match) || 0);
  const scoring = resultData.scoring_v9 || resultData.scoring || {};
  const recText = (resultData.recommendation || '').replace(/\u2014/g, ', ').replace(/ , /g, ', ');

  const canvas = document.createElement('canvas');
  canvas.width = CW;
  canvas.height = CH;
  const ctx = canvas.getContext('2d');

  drawReelBackground(ctx, p, culture);

  // ── 1. RESTAURANT NAME ──
  let y = 180;
  ctx.font = '700 56px "Playfair Display", Georgia, serif';
  ctx.fillStyle = p.fg;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  const nameLines = wrapText(ctx, r.name || 'Restaurant', CONTENT_W - 40);
  for (const line of nameLines.slice(0, 2)) {
    ctx.fillText(line, CW / 2, y);
    y += 68;
  }
  y += 8;

  // ── 2. META PILLS (neighborhood, cuisine, price) ──
  const metaParts = [];
  const hood = r.neighborhood_name || '';
  if (hood && !/^chicago$/i.test(hood.trim())) metaParts.push(hood);
  if (r.cuisine_type) metaParts.push(r.cuisine_type);
  if (r.price_level) metaParts.push(r.price_level);
  if (metaParts.length > 0) {
    y = drawCenteredPills(ctx, y, metaParts, p) + 20;
  }

  // Separator
  drawSeparator(ctx, y, p);
  y += 36;

  // ── 3. RECOMMENDATION BLURB — the MOAT ──
  if (recText) {
    ctx.font = '300 64px "Playfair Display", Georgia, serif';
    ctx.fillStyle = p.ac + '40';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.fillText('\u201C', CW / 2, y - 12);
    y += 44;

    ctx.font = 'italic 400 26px "Playfair Display", Georgia, serif';
    ctx.fillStyle = p.fg2;
    const blurbLines = wrapText(ctx, recText, CONTENT_W - 80);
    for (const line of blurbLines) {
      ctx.fillText(line, CW / 2, y);
      y += 36;
    }
    y += 6;

    ctx.font = '300 64px "Playfair Display", Georgia, serif';
    ctx.fillStyle = p.ac + '40';
    ctx.fillText('\u201D', CW / 2, y - 16);
    y += 28;
  }

  // ── 4. FULL DONDE MATCH HERO — the MOAT ──
  drawSeparator(ctx, y, p);
  y += 24;

  // Glass card background
  const heroX = PAD + 10, heroW = CONTENT_W - 20;
  const heroH = 220;
  ctx.save();
  ctx.fillStyle = p.glass;
  roundRect(ctx, heroX, y, heroW, heroH, 24);
  ctx.fill();
  ctx.strokeStyle = p.border;
  ctx.lineWidth = 1;
  roundRect(ctx, heroX, y, heroW, heroH, 24);
  ctx.stroke();
  // Top accent glow
  const hg = ctx.createLinearGradient(heroX, y, heroX + heroW, y);
  hg.addColorStop(0, p.ac + '0a'); hg.addColorStop(0.5, p.ac + '18'); hg.addColorStop(1, p.ac + '0a');
  ctx.fillStyle = hg;
  ctx.fillRect(heroX + 1, y + 1, heroW - 2, 3);
  ctx.restore();

  // Score ring inside hero (left side)
  drawScoreRing(ctx, heroX + 90, y + heroH / 2, 52, score, p, {
    showLabel: true, numSize: 44, labelSize: 13, lineWidth: 9,
  });

  // Tier text + narrative (right side)
  const tX = heroX + 170, tW = heroW - 190;
  ctx.font = '700 26px "Playfair Display", Georgia, serif';
  ctx.fillStyle = getScoreColor(score, p);
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  ctx.fillText(getScoreTier(score), tX, y + 24);

  const narrative = resultData.match_narrative?.summary || '';
  if (narrative) {
    ctx.font = '400 19px "Inter", system-ui, sans-serif';
    ctx.fillStyle = p.fg2;
    let ny = y + 58;
    for (const line of wrapText(ctx, narrative, tW).slice(0, 3)) {
      ctx.fillText(line, tX, ny); ny += 26;
    }
  }

  // Key signals (pill chips inside hero bottom)
  const signals = resultData.match_narrative?.key_signals || [];
  if (signals.length > 0) {
    ctx.font = '500 15px "Inter", system-ui, sans-serif';
    let sx = tX;
    const sigY = y + heroH - 44;
    for (const sig of signals.slice(0, 3)) {
      const tw = ctx.measureText(sig).width, pw = tw + 20;
      if (sx + pw > heroX + heroW - 16) break;
      ctx.fillStyle = p.acSoft; roundRect(ctx, sx, sigY, pw, 26, 13); ctx.fill();
      ctx.fillStyle = p.ac; ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
      ctx.fillText(sig, sx + 10, sigY + 13); sx += pw + 8;
    }
  }
  y += heroH + 20;

  // ── 5. FACTOR BARS ──
  const factors = [
    { label: 'Food', value: scoring.food },
    { label: 'Vibe', value: scoring.vibe },
    { label: 'Service', value: scoring.service },
    { label: 'Reputation', value: scoring.reputation },
    { label: 'Convenience', value: scoring.convenience },
  ].filter(f => f.value != null);
  if (factors.length > 0) {
    for (const f of factors) {
      y = drawFactorBar(ctx, PAD + 10, y, CONTENT_W - 20, f.label, f.value, p) + 14;
    }
    y += 6;
  }

  // ── 6. INSIDER TIP ──
  const tip = (resultData.insider_tip || '').replace(/\u2014/g, ', ');
  if (tip) {
    const tipLines = wrapText(ctx, tip, CONTENT_W - 80);
    const tipBoxH = 32 + Math.min(tipLines.length, 3) * 28 + 16;
    ctx.fillStyle = p.ac + '0c';
    roundRect(ctx, PAD + 20, y, CONTENT_W - 40, tipBoxH, 16);
    ctx.fill();
    ctx.fillStyle = p.ac;
    roundRect(ctx, PAD + 20, y, 4, tipBoxH, 2);
    ctx.fill();
    ctx.font = '600 14px "Inter", system-ui, sans-serif';
    ctx.fillStyle = p.ac;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ctx.fillText('INSIDER TIP', PAD + 40, y + 12);
    ctx.font = '400 19px "Inter", system-ui, sans-serif';
    ctx.fillStyle = p.fg2;
    let tipY = y + 34;
    for (const line of tipLines.slice(0, 3)) { ctx.fillText(line, PAD + 40, tipY); tipY += 28; }
    y += tipBoxH + 16;
  }

  // ── 7. BRANDED FOOTER ──
  drawBrandedFooter(ctx, p);
  return canvas;
}

/* ======== PUBLIC API ======== */

export async function generateDondeCard(resultData) {
  if (!resultData?.restaurant) throw new Error('No restaurant data provided');
  const p = getPalette(), culture = getCulture();
  const canvas = await buildReelCard(resultData, p, culture);
  return new Promise((resolve, reject) => {
    canvas.toBlob(blob => blob ? resolve(blob) : reject(new Error('Canvas toBlob failed')), 'image/png', 1.0);
  });
}

export function downloadDondeCard(blob, restaurantName) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  const safeName = (restaurantName || 'restaurant').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  a.href = url; a.download = `donde-${safeName}.png`;
  document.body.appendChild(a); a.click(); document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export async function shareDondeCard(blob, restaurantName) {
  const safeName = (restaurantName || 'restaurant').toLowerCase().replace(/[^a-z0-9]+/g, '-');
  const file = new File([blob], `donde-${safeName}.png`, { type: 'image/png' });
  if (navigator.share && navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ title: `${restaurantName} \u2014 Donde Pick`, text: `Check out ${restaurantName} on Donde!`, files: [file] });
      return true;
    } catch { return false; }
  }
  return false;
}
