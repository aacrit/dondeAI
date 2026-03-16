/* ============================================
   DondeAI — Donde Card Generator V2
   Screen-replica shareable infographic cards.
   Dynamic height driven by content.
   Cultural theme backgrounds + QR code + branding.
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

/* ---- Cultural Theme Pattern Drawers ---- */
const THEME_PATTERNS = {
  neutral(ctx, w, h, p) {
    ctx.save(); ctx.globalAlpha = 0.035; ctx.strokeStyle = p.ac; ctx.lineWidth = 1.2;
    for (let x = 0; x < w; x += 80) for (let y = 0; y < h; y += 80) {
      ctx.beginPath();
      ctx.moveTo(x + 10, y + 8); ctx.quadraticCurveTo(x + 15, y + 12, x + 20, y + 16); ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(x + 20, y + 8); ctx.quadraticCurveTo(x + 15, y + 13, x + 10, y + 16); ctx.stroke();
    }
    ctx.restore();
  },
  indian(ctx, w, h, p) {
    ctx.save(); ctx.globalAlpha = 0.035; ctx.strokeStyle = p.ac; ctx.lineWidth = 1;
    for (let x = 30; x < w; x += 90) for (let y = 30; y < h; y += 90) {
      ctx.beginPath();
      ctx.moveTo(x, y - 8); ctx.quadraticCurveTo(x + 8, y, x, y + 8);
      ctx.quadraticCurveTo(x - 8, y, x, y - 8); ctx.stroke();
      ctx.beginPath(); ctx.arc(x, y, 1.5, 0, Math.PI * 2);
      ctx.fillStyle = p.ac; ctx.fill();
    }
    ctx.restore();
  },
  japanese(ctx, w, h, p) {
    ctx.save(); ctx.globalAlpha = 0.03; ctx.strokeStyle = p.ac; ctx.lineWidth = 0.8;
    const r = 28;
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
    ctx.save(); ctx.globalAlpha = 0.035; ctx.strokeStyle = p.ac; ctx.lineWidth = 0.8;
    for (let x = 0; x < w; x += 56) for (let y = 0; y < h; y += 56) {
      const cx = x + 28, cy = y + 28;
      ctx.beginPath();
      ctx.moveTo(cx, cy - 11); ctx.lineTo(cx + 11, cy);
      ctx.lineTo(cx, cy + 11); ctx.lineTo(cx - 11, cy); ctx.closePath(); ctx.stroke();
    }
    ctx.restore();
  },
  southamerican(ctx, w, h, p) {
    ctx.save(); ctx.globalAlpha = 0.03; ctx.strokeStyle = p.ac; ctx.lineWidth = 0.8;
    for (let x = 25; x < w; x += 70) for (let y = 25; y < h; y += 70) {
      for (let a = 0; a < Math.PI * 2; a += Math.PI / 4) {
        ctx.beginPath();
        ctx.moveTo(x + Math.cos(a) * 4, y + Math.sin(a) * 4);
        ctx.lineTo(x + Math.cos(a) * 11, y + Math.sin(a) * 11); ctx.stroke();
      }
      ctx.beginPath(); ctx.arc(x, y, 2.5, 0, Math.PI * 2); ctx.stroke();
    }
    ctx.restore();
  },
};

/* ---- Constants ---- */
const CW = 1080;
const PAD = 64;
const CONTENT_W = CW - PAD * 2;
const TAGLINES = [
  'Your next favorite spot in Chicago',
  'AI-powered restaurant discovery',
  'Found something worth sharing',
  'Chicago dining, curated by AI',
  'One pick. Zero stress.',
];

/* ======== HELPERS ======== */

function drawSpacedText(ctx, text, x, y, spacing) {
  const chars = text.split('');
  const totalWidth = chars.reduce((w, ch) => w + ctx.measureText(ch).width + spacing, -spacing);
  const align = ctx.textAlign;
  let startX = x;
  if (align === 'center') startX = x - totalWidth / 2;
  else if (align === 'right') startX = x - totalWidth;
  ctx.textAlign = 'left';
  let offsetX = 0;
  for (const ch of chars) {
    ctx.fillText(ch, startX + offsetX, y);
    offsetX += ctx.measureText(ch).width + spacing;
  }
  ctx.textAlign = align;
}

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

function loadImage(url) {
  return new Promise(resolve => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onerror = () => resolve(null);
    const t = setTimeout(() => resolve(null), 5000);
    img.onload = () => { clearTimeout(t); resolve(img); };
    img.src = url;
  });
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

/* ---- Decorative Separators ---- */
function drawSeparator(ctx, y, p, style = 'accent') {
  if (style === 'accent') {
    const w = 140;
    const grad = ctx.createLinearGradient((CW - w) / 2, 0, (CW + w) / 2, 0);
    grad.addColorStop(0, 'transparent'); grad.addColorStop(0.15, p.ac + '50');
    grad.addColorStop(0.5, p.ac); grad.addColorStop(0.85, p.ac + '50');
    grad.addColorStop(1, 'transparent');
    ctx.fillStyle = grad; ctx.fillRect((CW - w) / 2, y, w, 2.5);
  } else if (style === 'dots') {
    ctx.fillStyle = p.fg3 + '40';
    const spacing = 18, count = 5, totalW = (count - 1) * spacing;
    const startX = (CW - totalW) / 2;
    for (let i = 0; i < count; i++) { ctx.beginPath(); ctx.arc(startX + i * spacing, y, 2, 0, Math.PI * 2); ctx.fill(); }
  } else if (style === 'fade') {
    const grad = ctx.createLinearGradient(PAD, 0, PAD + CONTENT_W, 0);
    grad.addColorStop(0, 'transparent'); grad.addColorStop(0.1, p.border);
    grad.addColorStop(0.9, p.border); grad.addColorStop(1, 'transparent');
    ctx.fillStyle = grad; ctx.fillRect(PAD, y, CONTENT_W, 1);
  }
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
  ctx.fillStyle = bg; roundRect(ctx, x - 6, y - 6, size + 12, size + 12, 8); ctx.fill();
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

/* ---- Photo ---- */
function drawCoverPhoto(ctx, img, x, y, w, h, radius) {
  ctx.save(); roundRect(ctx, x, y, w, h, radius); ctx.clip();
  const iA = img.width / img.height, bA = w / h;
  let sx = 0, sy = 0, sw = img.width, sh = img.height;
  if (iA > bA) { sw = img.height * bA; sx = (img.width - sw) / 2; }
  else { sh = img.width / bA; sy = (img.height - sh) / 2; }
  ctx.drawImage(img, sx, sy, sw, sh, x, y, w, h);
  const vig = ctx.createLinearGradient(x, y + h * 0.6, x, y + h);
  vig.addColorStop(0, 'rgba(0,0,0,0)'); vig.addColorStop(1, 'rgba(0,0,0,0.22)');
  ctx.fillStyle = vig; ctx.fillRect(x, y, w, h); ctx.restore();
}

function drawFallbackVisual(ctx, x, y, w, h, radius, p) {
  const grad = ctx.createLinearGradient(x, y, x + w, y + h);
  grad.addColorStop(0, p.gradStart); grad.addColorStop(0.5, p.gradEnd); grad.addColorStop(1, p.ac);
  ctx.fillStyle = grad; roundRect(ctx, x, y, w, h, radius); ctx.fill();
  ctx.globalAlpha = 0.06; ctx.fillStyle = '#fff';
  for (let px = x + 36; px < x + w; px += 36) for (let py = y + 36; py < y + h; py += 36)
    { ctx.beginPath(); ctx.arc(px, py, 2, 0, Math.PI * 2); ctx.fill(); }
  ctx.globalAlpha = 1;
}

/* ---- Background ---- */
function drawBackground(ctx, H, p, culture) {
  ctx.fillStyle = p.bg; ctx.fillRect(0, 0, CW, H);
  const bg = ctx.createLinearGradient(0, 0, 0, H);
  bg.addColorStop(0, p.gradStart + '10'); bg.addColorStop(0.25, 'transparent');
  bg.addColorStop(0.8, 'transparent'); bg.addColorStop(1, p.gradEnd + '08');
  ctx.fillStyle = bg; ctx.fillRect(0, 0, CW, H);
  const rg = ctx.createRadialGradient(CW * 0.85, H * 0.06, 0, CW * 0.85, H * 0.06, CW * 0.45);
  rg.addColorStop(0, p.ac + '0d'); rg.addColorStop(1, 'transparent');
  ctx.fillStyle = rg; ctx.fillRect(0, 0, CW, H);
  (THEME_PATTERNS[culture] || THEME_PATTERNS.neutral)(ctx, CW, H, p);
}

/* ---- Footer ---- */
function drawFooter(ctx, y, p) {
  drawSeparator(ctx, y, p, 'accent'); y += 24;
  const qrSize = 72, qrX = CW - PAD - qrSize, qrY = y;
  const dark = isDarkMode();
  drawQRCode(ctx, qrX, qrY, qrSize, generateQRMatrix('https://donde.ai'), dark ? p.fg : p.fg, dark ? p.bg2 : '#ffffff');
  const textCy = qrY + qrSize / 2;
  ctx.font = '700 34px "Playfair Display", Georgia, serif';
  ctx.fillStyle = p.fg; ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
  ctx.fillText('Donde', PAD, textCy - 16);
  ctx.font = '400 17px "Inter", system-ui, sans-serif'; ctx.fillStyle = p.fg3;
  ctx.fillText(TAGLINES[Math.floor(Date.now() / 86400000) % TAGLINES.length], PAD, textCy + 14);
  return qrY + qrSize + 16;
}

/* ---- Pills Row Helper ---- */
function drawPills(ctx, y, parts, p, fontSize = 20, pillH = 36) {
  ctx.font = `500 ${fontSize}px "Inter", system-ui, sans-serif`;
  let px = PAD; const pillPad = 18, pillGap = 10;
  for (const text of parts) {
    const tw = ctx.measureText(text).width, pw = tw + pillPad * 2;
    if (px + pw > CW - PAD) break;
    ctx.fillStyle = p.acSoft; roundRect(ctx, px, y, pw, pillH, pillH / 2); ctx.fill();
    ctx.strokeStyle = p.ac + '30'; ctx.lineWidth = 1;
    roundRect(ctx, px, y, pw, pillH, pillH / 2); ctx.stroke();
    ctx.fillStyle = p.ac; ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
    ctx.fillText(text, px + pillPad, y + pillH / 2);
    px += pw + pillGap;
  }
  return y + pillH;
}

/* ======================================================================
   SMALL CARD — Tier 1 replica (compact infographic)
   ====================================================================== */
async function buildSmallCard(resultData, p, culture) {
  const r = resultData.restaurant;
  const score = Math.round(parseFloat(resultData.donde_match) || 0);
  const img = r.photo_urls?.[0] ? await loadImage(r.photo_urls[0]) : null;

  // Measure pass for dynamic height
  const mc = document.createElement('canvas'); mc.width = CW; mc.height = 100;
  const m = mc.getContext('2d');
  let totalH = PAD;
  const photoH = 520; totalH += photoH + 36;
  m.font = '700 52px "Playfair Display", Georgia, serif';
  const nameLines = wrapText(m, r.name || 'Restaurant', CONTENT_W);
  totalH += nameLines.length * 62 + 12;
  const metaParts = [];
  const hood = r.neighborhood_name || '';
  if (hood && !/^chicago$/i.test(hood.trim())) metaParts.push(hood);
  if (r.cuisine_type) metaParts.push(r.cuisine_type);
  if (r.price_level) metaParts.push(r.price_level);
  if (metaParts.length > 0) totalH += 40 + 20;
  const oneliner = r.best_for_oneliner || '';
  if (oneliner) { m.font = 'italic 400 26px "Playfair Display", Georgia, serif'; totalH += Math.min(wrapText(m, oneliner, CONTENT_W - 20).length, 3) * 36 + 16; }
  const matchSig = resultData.match_narrative?.summary || '';
  if (matchSig) { m.font = '400 20px "Inter", system-ui, sans-serif'; totalH += Math.min(wrapText(m, matchSig, CONTENT_W - 40).length, 2) * 28 + 28; }
  totalH += 24 + 24 + 72 + 16 + PAD; // separator + footer

  const canvas = document.createElement('canvas'); canvas.width = CW; canvas.height = totalH;
  const ctx = canvas.getContext('2d');
  drawBackground(ctx, totalH, p, culture);
  let y = PAD;

  // Photo
  if (img) drawCoverPhoto(ctx, img, PAD, y, CONTENT_W, photoH, 28);
  else drawFallbackVisual(ctx, PAD, y, CONTENT_W, photoH, 28, p);
  // Score badge overlay
  const bS = 88, bX = PAD + 20, bY = y + photoH - bS - 20;
  ctx.fillStyle = p.bg2 + 'e6'; roundRect(ctx, bX, bY, bS, bS, 18); ctx.fill();
  ctx.strokeStyle = p.border; ctx.lineWidth = 1.5; roundRect(ctx, bX, bY, bS, bS, 18); ctx.stroke();
  drawScoreRing(ctx, bX + bS / 2, bY + bS / 2, 30, score, p, { showLabel: true, labelSize: 11, numSize: 30 });
  y += photoH + 36;

  // Name
  ctx.fillStyle = p.fg; ctx.font = '700 52px "Playfair Display", Georgia, serif';
  ctx.textAlign = 'left'; ctx.textBaseline = 'top';
  for (const line of nameLines.slice(0, 2)) { ctx.fillText(line, PAD, y); y += 62; }
  y += 12;

  // Pills
  if (metaParts.length > 0) { y = drawPills(ctx, y, metaParts, p) + 20; }

  // One-liner
  if (oneliner) {
    ctx.font = '300 44px "Playfair Display", Georgia, serif'; ctx.fillStyle = p.ac + '35';
    ctx.textAlign = 'left'; ctx.textBaseline = 'top'; ctx.fillText('\u201C', PAD, y - 6);
    ctx.font = 'italic 400 26px "Playfair Display", Georgia, serif'; ctx.fillStyle = p.fg2;
    for (const line of wrapText(ctx, oneliner, CONTENT_W - 20).slice(0, 3)) { ctx.fillText(line, PAD + 14, y + 16); y += 36; }
    y += 16;
  }

  // Match signal
  if (matchSig) {
    drawSeparator(ctx, y, p, 'dots'); y += 20;
    ctx.font = '400 20px "Inter", system-ui, sans-serif'; ctx.fillStyle = p.fg3;
    ctx.textAlign = 'center'; ctx.textBaseline = 'top';
    for (const line of wrapText(ctx, matchSig, CONTENT_W - 40).slice(0, 2)) { ctx.fillText(line, CW / 2, y); y += 28; }
    y += 8;
  }

  y += 16; drawFooter(ctx, y, p);
  return canvas;
}

/* ======================================================================
   LARGE CARD — Tier 1 + Tier 2 rich infographic
   ====================================================================== */
async function buildLargeCard(resultData, p, culture) {
  const r = resultData.restaurant;
  const score = Math.round(parseFloat(resultData.donde_match) || 0);
  const scoring = resultData.scoring_v9 || resultData.scoring || {};
  const img = r.photo_urls?.[0] ? await loadImage(r.photo_urls[0]) : null;

  const mc = document.createElement('canvas'); mc.width = CW; mc.height = 100;
  const m = mc.getContext('2d');
  let totalH = PAD;
  const photoH = 460; totalH += photoH + 36;
  m.font = '700 48px "Playfair Display", Georgia, serif';
  const nameLines = wrapText(m, r.name || 'Restaurant', CONTENT_W);
  totalH += nameLines.length * 58 + 8;
  const metaParts = [];
  const hood = r.neighborhood_name || '';
  if (hood && !/^chicago$/i.test(hood.trim())) metaParts.push(hood);
  if (r.cuisine_type) metaParts.push(r.cuisine_type);
  if (r.price_level) metaParts.push(r.price_level);
  if (metaParts.length > 0) totalH += 36 + 24;
  const oneliner = r.best_for_oneliner || '';
  if (oneliner) { m.font = 'italic 400 24px "Playfair Display", Georgia, serif'; totalH += Math.min(wrapText(m, oneliner, CONTENT_W - 20).length, 2) * 34 + 16; }
  totalH += 16 + 220 + 24; // separator + hero + gap
  const factors = [
    { label: 'Food', value: scoring.food }, { label: 'Vibe', value: scoring.vibe },
    { label: 'Service', value: scoring.service }, { label: 'Reputation', value: scoring.reputation },
    { label: 'Convenience', value: scoring.convenience },
  ].filter(f => f.value != null);
  if (factors.length > 0) totalH += factors.length * 48 + 24;
  const recText = (resultData.recommendation || '').replace(/\u2014/g, ', ').replace(/ , /g, ', ');
  if (recText) { m.font = 'italic 400 24px "Playfair Display", Georgia, serif'; totalH += 16 + Math.min(wrapText(m, recText, CONTENT_W - 40).length, 6) * 34 + 24; }
  const tip = (resultData.insider_tip || '').replace(/\u2014/g, ', ');
  if (tip) { m.font = '400 19px "Inter", system-ui, sans-serif'; totalH += Math.min(wrapText(m, tip, CONTENT_W - 48).length, 3) * 26 + 56; }
  const dc = resultData.deep_context || {};
  const highlights = [];
  if (dc.signature_dishes?.length) highlights.push({ label: 'Signature Dishes', text: dc.signature_dishes.slice(0, 3).join(', ') });
  if (dc.service_style) highlights.push({ label: 'Service', text: dc.service_style });
  if (dc.reservation_difficulty) highlights.push({ label: 'Reservations', text: dc.reservation_difficulty });
  if (highlights.length > 0) totalH += highlights.length * 50 + 32;
  totalH += 40 + 72 + 16 + PAD; // footer

  const canvas = document.createElement('canvas'); canvas.width = CW; canvas.height = totalH;
  const ctx = canvas.getContext('2d');
  drawBackground(ctx, totalH, p, culture);
  let y = PAD;

  // Photo
  if (img) drawCoverPhoto(ctx, img, PAD, y, CONTENT_W, photoH, 28);
  else drawFallbackVisual(ctx, PAD, y, CONTENT_W, photoH, 28, p);
  const bS = 80, bX = PAD + 20, bY = y + photoH - bS - 16;
  ctx.fillStyle = p.bg2 + 'e6'; roundRect(ctx, bX, bY, bS, bS, 16); ctx.fill();
  ctx.strokeStyle = p.border; ctx.lineWidth = 1.5; roundRect(ctx, bX, bY, bS, bS, 16); ctx.stroke();
  drawScoreRing(ctx, bX + bS / 2, bY + bS / 2, 26, score, p, { numSize: 28 });
  y += photoH + 36;

  // Name
  ctx.fillStyle = p.fg; ctx.font = '700 48px "Playfair Display", Georgia, serif';
  ctx.textAlign = 'left'; ctx.textBaseline = 'top';
  for (const line of nameLines.slice(0, 2)) { ctx.fillText(line, PAD, y); y += 58; }
  y += 8;

  // Pills
  if (metaParts.length > 0) { y = drawPills(ctx, y, metaParts, p, 19, 34) + 24; }

  // One-liner
  if (oneliner) {
    ctx.font = 'italic 400 24px "Playfair Display", Georgia, serif'; ctx.fillStyle = p.fg2;
    ctx.textAlign = 'left'; ctx.textBaseline = 'top';
    for (const line of wrapText(ctx, oneliner, CONTENT_W - 20).slice(0, 2)) { ctx.fillText(line, PAD + 8, y); y += 34; }
    y += 16;
  }

  // Separator
  drawSeparator(ctx, y, p, 'accent'); y += 16;

  // Score Hero (glass card)
  const heroH = 220, heroX = PAD, heroW = CONTENT_W;
  ctx.save();
  ctx.fillStyle = p.glass; roundRect(ctx, heroX, y, heroW, heroH, 24); ctx.fill();
  ctx.strokeStyle = p.border; ctx.lineWidth = 1;
  roundRect(ctx, heroX, y, heroW, heroH, 24); ctx.stroke();
  // Top accent glow
  const hg = ctx.createLinearGradient(heroX, y, heroX + heroW, y);
  hg.addColorStop(0, p.ac + '0a'); hg.addColorStop(0.5, p.ac + '18'); hg.addColorStop(1, p.ac + '0a');
  ctx.fillStyle = hg; ctx.fillRect(heroX + 1, y + 1, heroW - 2, 3);
  ctx.restore();

  drawScoreRing(ctx, heroX + 90, y + heroH / 2, 52, score, p, { showLabel: true, numSize: 44, labelSize: 13, lineWidth: 9 });

  const tX = heroX + 170, tW = heroW - 190;
  ctx.font = '700 26px "Playfair Display", Georgia, serif';
  ctx.fillStyle = getScoreColor(score, p); ctx.textAlign = 'left'; ctx.textBaseline = 'top';
  ctx.fillText(getScoreTier(score), tX, y + 28);

  const narrative = resultData.match_narrative?.summary || '';
  if (narrative) {
    ctx.font = '400 19px "Inter", system-ui, sans-serif'; ctx.fillStyle = p.fg2;
    let ny = y + 62;
    for (const line of wrapText(ctx, narrative, tW).slice(0, 3)) { ctx.fillText(line, tX, ny); ny += 26; }
  }

  const signals = resultData.match_narrative?.key_signals || [];
  if (signals.length > 0) {
    ctx.font = '500 15px "Inter", system-ui, sans-serif';
    let sx = tX; const sigY = y + heroH - 44;
    for (const sig of signals.slice(0, 3)) {
      const tw = ctx.measureText(sig).width, pw = tw + 20;
      if (sx + pw > heroX + heroW - 16) break;
      ctx.fillStyle = p.acSoft; roundRect(ctx, sx, sigY, pw, 26, 13); ctx.fill();
      ctx.fillStyle = p.ac; ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
      ctx.fillText(sig, sx + 10, sigY + 13); sx += pw + 8;
    }
  }
  y += heroH + 24;

  // Factor Bars
  if (factors.length > 0) {
    for (const f of factors) y = drawFactorBar(ctx, PAD, y, CONTENT_W, f.label, f.value, p) + 16;
    y += 8;
  }

  // Blurb
  if (recText) {
    drawSeparator(ctx, y, p, 'fade'); y += 16;
    ctx.font = '300 46px "Playfair Display", Georgia, serif'; ctx.fillStyle = p.ac + '30';
    ctx.textAlign = 'left'; ctx.textBaseline = 'top'; ctx.fillText('\u201C', PAD, y - 8);
    ctx.font = 'italic 400 24px "Playfair Display", Georgia, serif'; ctx.fillStyle = p.fg2;
    y += 20;
    for (const line of wrapText(ctx, recText, CONTENT_W - 40).slice(0, 6)) { ctx.fillText(line, PAD + 16, y); y += 34; }
    y += 24;
  }

  // Insider Tip
  if (tip) {
    const tipLines = wrapText(ctx, tip, CONTENT_W - 48);
    const tipBoxH = 36 + Math.min(tipLines.length, 3) * 26 + 16;
    ctx.fillStyle = p.ac + '0a'; roundRect(ctx, PAD, y, CONTENT_W, tipBoxH, 16); ctx.fill();
    ctx.fillStyle = p.ac; roundRect(ctx, PAD, y, 4, tipBoxH, 2); ctx.fill();
    ctx.font = '600 14px "Inter", system-ui, sans-serif'; ctx.fillStyle = p.ac;
    ctx.textAlign = 'left'; ctx.textBaseline = 'top';
    drawSpacedText(ctx, 'INSIDER TIP', PAD + 20, y + 14, 1.5);
    ctx.font = '400 19px "Inter", system-ui, sans-serif'; ctx.fillStyle = p.fg2;
    let tipY = y + 38;
    for (const line of tipLines.slice(0, 3)) { ctx.fillText(line, PAD + 20, tipY); tipY += 26; }
    y += tipBoxH + 20;
  }

  // Deep Context
  if (highlights.length > 0) {
    drawSeparator(ctx, y, p, 'dots'); y += 20;
    for (const h of highlights) {
      ctx.font = '600 15px "Inter", system-ui, sans-serif'; ctx.fillStyle = p.fg3;
      ctx.textAlign = 'left'; ctx.textBaseline = 'top';
      drawSpacedText(ctx, h.label.toUpperCase(), PAD, y, 1); y += 22;
      ctx.font = '400 20px "Inter", system-ui, sans-serif'; ctx.fillStyle = p.fg2;
      ctx.fillText(h.text, PAD, y); y += 28;
    }
    y += 12;
  }

  y += 16; drawFooter(ctx, y, p);
  return canvas;
}

/* ======== PUBLIC API ======== */

/**
 * Generate a Donde Card as a Blob.
 * @param {Object} resultData - the full result object from state
 * @param {'small'|'large'} size - card variant
 * @returns {Promise<Blob>} PNG blob
 */
export async function generateDondeCard(resultData, size = 'small') {
  if (!resultData?.restaurant) throw new Error('No restaurant data provided');
  const p = getPalette(), culture = getCulture();
  const canvas = size === 'large'
    ? await buildLargeCard(resultData, p, culture)
    : await buildSmallCard(resultData, p, culture);
  return new Promise((resolve, reject) => {
    canvas.toBlob(blob => blob ? resolve(blob) : reject(new Error('Canvas toBlob failed')), 'image/png', 1.0);
  });
}

/* ---- Download ---- */
export function downloadDondeCard(blob, restaurantName) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  const safeName = (restaurantName || 'restaurant').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  a.href = url; a.download = `donde-${safeName}.png`;
  document.body.appendChild(a); a.click(); document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/* ---- Share via Navigator.share ---- */
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
