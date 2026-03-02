/* ============================================
   DondeAI v11 — Result Card Rendering
   Populates Tier 1 + Tier 2 from API response.
   ============================================ */

import { svgIcon, getScoreColor, buildGoogleStars, buildMapsUrl, matchCuisine } from './utils.js';

const $ = (id) => document.getElementById(id);

/* ---- Tier 1: The Glance ---- */
export function renderTier1(data) {
  const r = data.restaurant || {};
  const score = Math.round(data.donde_match || 0);
  const scoreColor = getScoreColor(score);

  // Photos
  renderPhotos(r);

  // Score ring
  const scoreFill = $('score-num');
  const ringFill = document.querySelector('.result__score-fill');
  if (scoreFill) scoreFill.textContent = '0'; // count-up starts from 0
  if (ringFill) {
    ringFill.style.stroke = scoreColor;
    ringFill.style.strokeDashoffset = '132'; // reset to empty
  }

  // Name
  const nameEl = $('result-name');
  if (nameEl) nameEl.textContent = r.name || 'Unknown';

  // Meta: cuisine + price + neighborhood
  const metaParts = [
    r.cuisine_type,
    r.price_level,
    r.neighborhood_name,
  ].filter(Boolean);
  const metaEl = $('result-meta');
  if (metaEl) metaEl.textContent = metaParts.join(' \u00b7 ');

  // Status
  const statusEl = $('result-status');
  if (statusEl) {
    const status = getOpenStatus(r);
    statusEl.textContent = status;
    statusEl.hidden = !status;
  }

  // Blurb
  const blurbEl = $('result-blurb');
  if (blurbEl) blurbEl.textContent = data.recommendation || '';

  // Insider tip
  const tipWrap = $('result-tip');
  const tipText = $('tip-text');
  if (tipWrap && tipText) {
    if (data.insider_tip) {
      tipText.textContent = data.insider_tip;
      tipWrap.hidden = false;
    } else {
      tipWrap.hidden = true;
    }
  }

  // Navigate CTA
  const navBtn = $('cta-navigate');
  if (navBtn) {
    const addr = r.address || r.name;
    navBtn.href = buildMapsUrl(addr);
  }

  // Score color on number
  if (scoreFill) scoreFill.style.color = scoreColor;
}

/* ---- Photos ---- */
function renderPhotos(restaurant) {
  const photosWrap = $('photos');
  const track = $('photos-track');
  if (!photosWrap || !track) return;

  const photos = restaurant.photos || [];
  if (!photos.length) {
    photosWrap.hidden = true;
    return;
  }

  photosWrap.hidden = false;
  track.innerHTML = photos.slice(0, 6).map(url =>
    `<img class="result__photo" src="${escapeAttr(url)}" alt="" loading="lazy" onerror="this.style.display='none'">`
  ).join('');
}

/* ---- Score Count-Up Animation ---- */
export function animateScore(targetScore, duration = 1200) {
  const scoreFill = $('score-num');
  const ringFill = document.querySelector('.result__score-fill');
  const scoreColor = getScoreColor(targetScore);

  // Check reduced motion
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;

  if (reduced) {
    if (scoreFill) {
      scoreFill.textContent = targetScore;
      scoreFill.style.color = scoreColor;
    }
    if (ringFill) {
      const circumference = 132;
      const offset = circumference - (circumference * targetScore / 100);
      ringFill.style.transition = 'none';
      ringFill.style.strokeDashoffset = String(offset);
      ringFill.style.stroke = scoreColor;
    }
    return;
  }

  let start = null;
  const circumference = 132;

  function tick(timestamp) {
    if (!start) start = timestamp;
    const elapsed = timestamp - start;
    const progress = Math.min(elapsed / duration, 1);
    // Ease-out cubic
    const eased = 1 - Math.pow(1 - progress, 3);
    const current = Math.round(eased * targetScore);

    if (scoreFill) {
      scoreFill.textContent = current;
      scoreFill.style.color = getScoreColor(current);
    }

    if (ringFill) {
      const offset = circumference - (circumference * current / 100);
      ringFill.style.strokeDashoffset = String(offset);
      ringFill.style.stroke = getScoreColor(current);
    }

    if (progress < 1) {
      requestAnimationFrame(tick);
    } else {
      // Celebration glow for 90+ scores
      if (targetScore >= 90) {
        const scoreWrap = $('score-ring');
        if (scoreWrap) {
          scoreWrap.classList.add('score-celebrating');
          setTimeout(() => scoreWrap.classList.remove('score-celebrating'), 800);
        }
      }
    }
  }

  requestAnimationFrame(tick);
}

/* ---- Tier 2: The Deep Dive ---- */
export function renderTier2(data) {
  const r = data.restaurant || {};
  const scoring = data.scoring || data.scoring_v7 || {};
  const deepCtx = data.deep_context || r;

  renderGlyphs(r, deepCtx);
  renderGoogleRating(r);
  renderFactors(scoring, data.match_narrative);
  renderKnownFor(r, data);
  renderDetails(deepCtx);
  renderHours(r);
  renderContact(r);
}

/* ---- Glyph Bar ---- */
function renderGlyphs(restaurant, ctx) {
  const el = $('glyphs');
  if (!el) return;

  const glyphs = [];

  // Cuisine
  const cuisine = matchCuisine(restaurant.cuisine_type || '');
  glyphs.push(glyph(svgIcon(cuisine.icon, 14), restaurant.cuisine_type || 'Dining'));

  // Price
  if (restaurant.price_level) {
    glyphs.push(glyph('', restaurant.price_level, true));
  }

  // Noise
  const noise = ctx.noise_level || restaurant.noise_level;
  if (noise) {
    const lower = (noise + '').toLowerCase();
    const icon = lower.includes('quiet') ? 'speakerNone'
               : lower.includes('loud') ? 'speakerHigh'
               : 'speakerWave';
    glyphs.push(glyph(svgIcon(icon, 14), noise));
  }

  // Ambiance
  const ambiance = ctx.ambiance_style || restaurant.ambiance_style;
  if (ambiance) {
    const lower = (ambiance + '').toLowerCase();
    const icon = (lower.includes('dim') || lower.includes('cozy') || lower.includes('warm') || lower.includes('intimate'))
      ? 'moon' : 'sun';
    glyphs.push(glyph(svgIcon(icon, 14), ambiance));
  }

  // Parking
  const parking = ctx.parking_situation || restaurant.parking_situation;
  if (parking) {
    glyphs.push(glyph(svgIcon('car', 14), parking));
  }

  // Dress code
  const dress = ctx.dress_code || restaurant.dress_code;
  if (dress) {
    glyphs.push(glyph(svgIcon('shirt', 14), dress));
  }

  el.innerHTML = glyphs.join('');
}

function glyph(iconHtml, text, isPrice = false) {
  if (isPrice) {
    return `<span class="glyph"><span style="font-weight:600;font-family:var(--font-data)">${escapeHtml(text)}</span></span>`;
  }
  return `<span class="glyph">${iconHtml}<span>${escapeHtml(text)}</span></span>`;
}

/* ---- Google Rating ---- */
function renderGoogleRating(restaurant) {
  const el = $('google-rating');
  if (!el) return;
  const rating = restaurant.google_rating || restaurant.rating;
  const count = restaurant.google_review_count || restaurant.review_count;
  if (!rating) {
    el.hidden = true;
    return;
  }
  el.hidden = false;
  el.innerHTML = `
    <span class="stars">${buildGoogleStars(rating)}</span>
    <span>${rating}${count ? ` (${count})` : ''}</span>
  `;
}

/* ---- Factor Bars ---- */
function renderFactors(scoring, narrative) {
  const el = $('factors');
  const narEl = $('narrative');
  if (!el) return;

  const factors = [
    { key: 'food', label: 'Food' },
    { key: 'vibe', label: 'Vibe' },
    { key: 'service', label: 'Service' },
    { key: 'reputation', label: 'Reputation' },
    { key: 'convenience', label: 'Access' },
  ];

  el.innerHTML = factors.map(f => {
    const val = parseFloat(scoring[f.key]) || 0;
    const pct = Math.min(val * 10, 100);
    const color = val >= 7.5 ? 'var(--rag-green)' : val >= 5 ? 'var(--rag-amber)' : 'var(--rag-red)';
    return `
      <div class="factor" data-factor="${f.key}">
        <span class="factor__label">${f.label}</span>
        <div class="factor__bar">
          <div class="factor__fill" style="width:${pct}%;background:${color}" data-width="${pct}"></div>
        </div>
        <span class="factor__value">${val.toFixed(1)}</span>
      </div>
    `;
  }).join('');

  // Narrative
  if (narEl && narrative?.summary) {
    narEl.textContent = narrative.summary;
  } else if (narEl) {
    narEl.textContent = '';
  }

  // Animate bars after a tick
  requestAnimationFrame(() => {
    el.querySelectorAll('.factor__fill').forEach(bar => {
      bar.style.width = bar.dataset.width + '%';
    });
  });
}

/* ---- Known For ---- */
function renderKnownFor(restaurant, data) {
  const wrap = $('known-for');
  const pills = $('known-pills');
  if (!wrap || !pills) return;

  const items = [];
  if (restaurant.signature_dishes) {
    const dishes = Array.isArray(restaurant.signature_dishes)
      ? restaurant.signature_dishes
      : (restaurant.signature_dishes + '').split(',').map(s => s.trim());
    items.push(...dishes);
  }
  if (data.tags?.length) items.push(...data.tags);

  if (!items.length) {
    wrap.hidden = true;
    return;
  }

  wrap.hidden = false;
  const unique = [...new Set(items)].slice(0, 8);
  pills.innerHTML = unique.map(t =>
    `<span class="result__pill">${escapeHtml(t)}</span>`
  ).join('');
}

/* ---- Details (Good to Know) ---- */
function renderDetails(ctx) {
  const wrap = $('details');
  const list = $('detail-list');
  if (!wrap || !list) return;

  const details = [];

  const fields = [
    ['reservations', 'Reservations'],
    ['average_check', 'Avg check'],
    ['best_seat', 'Best seat'],
    ['typical_crowd', 'Crowd'],
    ['typical_wait', 'Wait'],
    ['byob', 'BYOB'],
    ['outdoor_seating', 'Outdoor'],
    ['kid_friendly', 'Kids'],
    ['pet_friendly', 'Pets'],
    ['music_vibe', 'Music'],
    ['wifi_available', 'WiFi'],
  ];

  for (const [key, label] of fields) {
    const val = ctx[key];
    if (val && val !== 'Unknown' && val !== 'N/A' && val !== 'Not available') {
      const display = typeof val === 'boolean' ? (val ? 'Yes' : 'No') : String(val);
      details.push({ label, value: display });
    }
  }

  if (!details.length) {
    wrap.hidden = true;
    return;
  }

  wrap.hidden = false;
  list.innerHTML = details.map(d =>
    `<dt>${escapeHtml(d.label)}</dt><dd>${escapeHtml(d.value)}</dd>`
  ).join('');
}

/* ---- Hours ---- */
function renderHours(restaurant) {
  const wrap = $('hours');
  const list = $('hours-list');
  if (!wrap || !list) return;

  const hours = restaurant.opening_hours?.weekday_text || [];
  if (!hours.length) {
    wrap.hidden = true;
    return;
  }

  wrap.hidden = false;
  list.innerHTML = hours.map(h => `<li>${escapeHtml(h)}</li>`).join('');
}

/* ---- Contact Row ---- */
function renderContact(restaurant) {
  const row = $('contact-row');
  if (!row) return;

  const links = [];

  if (restaurant.phone) {
    links.push(`<a class="contact-link" href="tel:${escapeAttr(restaurant.phone)}">${svgIcon('phone', 14)} Call</a>`);
  }
  if (restaurant.website) {
    links.push(`<a class="contact-link" href="${escapeAttr(restaurant.website)}" target="_blank" rel="noopener">${svgIcon('globe', 14)} Website</a>`);
  }
  if (restaurant.address) {
    links.push(`<a class="contact-link" href="${escapeAttr(buildMapsUrl(restaurant.address))}" target="_blank" rel="noopener">${svgIcon('pin', 14)} Directions</a>`);
  }
  links.push(`<button class="contact-link" id="share-btn" type="button">${svgIcon('shareNetwork', 14)} Share</button>`);

  row.innerHTML = links.join('');
}

/* ---- Open Status ---- */
function getOpenStatus(restaurant) {
  const hours = restaurant.opening_hours;
  if (!hours) return '';
  if (hours.open_now === true) return 'Open now';
  if (hours.open_now === false) return 'Closed';
  return '';
}

/* ---- Clear Result DOM ---- */
export function clearResult() {
  const elements = [
    'photos-track', 'result-name', 'result-meta', 'result-status',
    'result-blurb', 'tip-text', 'glyphs', 'factors', 'narrative',
    'known-pills', 'detail-list', 'hours-list', 'contact-row',
  ];
  elements.forEach(id => {
    const el = $(id);
    if (el) el.innerHTML = '';
  });

  // Reset score
  const scoreFill = $('score-num');
  if (scoreFill) scoreFill.textContent = '0';
  const ringFill = document.querySelector('.result__score-fill');
  if (ringFill) ringFill.style.strokeDashoffset = '132';

  // Hide optional sections
  ['photos', 'result-tip', 'known-for', 'details', 'hours', 'google-rating'].forEach(id => {
    const el = $(id);
    if (el) el.hidden = true;
  });
}

/* ---- Helpers ---- */
function escapeHtml(str) {
  if (!str) return '';
  const el = document.createElement('span');
  el.textContent = str;
  return el.innerHTML;
}

function escapeAttr(str) {
  if (!str) return '';
  return str.replace(/"/g, '&quot;').replace(/'/g, '&#39;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
