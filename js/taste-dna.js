/* ============================================
   DondeAI — Taste DNA Module
   Radial cuisine visualization, archetype badge,
   vibe bar charts, group blend UI.
   ============================================ */

import { getState, setState } from './state.js';
import { isAuthenticated, getUser, getSupabaseClient } from './auth.js';
import { showToast } from './render.js';

/* ---- Constants ---- */
const CUISINE_COLORS = {
  // Asian family — warm amber/gold tones
  Japanese:    { h: 25,  s: 80, l: 55 },
  Chinese:     { h: 35,  s: 75, l: 50 },
  Thai:        { h: 40,  s: 85, l: 52 },
  Korean:      { h: 15,  s: 78, l: 48 },
  Vietnamese:  { h: 45,  s: 70, l: 50 },
  Indian:      { h: 30,  s: 90, l: 45 },
  Filipino:    { h: 20,  s: 72, l: 55 },
  // European family — cool blue/teal tones
  Italian:     { h: 210, s: 65, l: 50 },
  French:      { h: 220, s: 60, l: 55 },
  Greek:       { h: 195, s: 70, l: 48 },
  Spanish:     { h: 200, s: 55, l: 52 },
  German:      { h: 230, s: 45, l: 50 },
  // American family — neutral/earthy tones
  American:    { h: 18,  s: 45, l: 55 },
  Southern:    { h: 22,  s: 50, l: 48 },
  BBQ:         { h: 10,  s: 65, l: 42 },
  Cajun:       { h: 8,   s: 70, l: 45 },
  // Latin family — vibrant warm/red tones
  Mexican:     { h: 350, s: 75, l: 50 },
  Peruvian:    { h: 340, s: 65, l: 52 },
  Colombian:   { h: 355, s: 60, l: 48 },
  Brazilian:   { h: 345, s: 70, l: 50 },
  // African/Middle Eastern — rich earthy tones
  Ethiopian:   { h: 28,  s: 60, l: 40 },
  Moroccan:    { h: 32,  s: 55, l: 42 },
  Lebanese:    { h: 38,  s: 50, l: 45 },
  Turkish:     { h: 5,   s: 55, l: 42 },
  // Catch-all
  _default:    { h: 260, s: 45, l: 55 },
};

const ARCHETYPE_ICONS = {
  'The Explorer':    '\u{1F30D}',
  'The Loyalist':    '\u{1F49B}',
  'The Adventurer':  '\u{1F680}',
  'The Connoisseur': '\u{1F37E}',
  'The Local':       '\u{1F3E0}',
  'The Foodie':      '\u{2B50}',
  'The Newcomer':    '\u{1F331}',
};

/* ---- State ---- */
let _tasteDna = null;
let _loading = false;
let _blendResult = null;

/* ---- Public API ---- */

/**
 * Fetch the user's Taste DNA from the backend.
 * Auto-computes if profile is missing or stale.
 */
export async function fetchTasteDna() {
  if (!isAuthenticated()) return null;
  if (_loading) return _tasteDna;

  const user = getUser();
  if (!user?.id) return null;

  _loading = true;

  try {
    const sb = await getSupabaseClient();
    if (!sb) return null;

    const { data, error } = await sb.rpc('get_taste_dna', { p_user_id: user.id });

    if (error) {
      console.error('[taste-dna] RPC error:', error.message);
      return null;
    }

    _tasteDna = data;
    return data;
  } catch (e) {
    console.error('[taste-dna] fetch error:', e);
    return null;
  } finally {
    _loading = false;
  }
}

/**
 * Blend multiple users' taste profiles for group dining.
 */
export async function fetchBlend(userIds) {
  if (!userIds || userIds.length < 2) return null;

  try {
    const sb = await getSupabaseClient();
    if (!sb) return null;

    const { data, error } = await sb.rpc('blend_taste_profiles', { p_user_ids: userIds });

    if (error) {
      console.error('[taste-dna] Blend RPC error:', error.message);
      return null;
    }

    _blendResult = data;
    return data;
  } catch (e) {
    console.error('[taste-dna] blend error:', e);
    return null;
  }
}

/**
 * Get cached Taste DNA (no network call).
 */
export function getCachedDna() {
  return _tasteDna;
}

/* ---- SVG Radial Chart ---- */

/**
 * Build an SVG radial chart of cuisine affinities.
 * Each cuisine becomes a colored arc segment sized by score.
 * @param {Array} cuisines - [{cuisine: string, score: number}, ...]
 * @param {number} size - SVG size in px
 * @returns {string} SVG markup
 */
export function buildRadialChart(cuisines, size = 200) {
  if (!cuisines || cuisines.length === 0) {
    return buildEmptyChart(size);
  }

  const cx = size / 2;
  const cy = size / 2;
  const outerR = size / 2 - 4;
  const innerR = outerR * 0.45;
  const totalScore = cuisines.reduce((sum, c) => sum + (c.score || 0), 0);

  if (totalScore === 0) return buildEmptyChart(size);

  let paths = '';
  let currentAngle = -90; // Start from top

  for (const cuisine of cuisines) {
    const pct = (cuisine.score || 0) / totalScore;
    const sweepDeg = pct * 360;

    if (sweepDeg < 0.5) continue;

    const startRad = (currentAngle * Math.PI) / 180;
    const endRad = ((currentAngle + sweepDeg) * Math.PI) / 180;

    const x1Outer = cx + outerR * Math.cos(startRad);
    const y1Outer = cy + outerR * Math.sin(startRad);
    const x2Outer = cx + outerR * Math.cos(endRad);
    const y2Outer = cy + outerR * Math.sin(endRad);
    const x1Inner = cx + innerR * Math.cos(endRad);
    const y1Inner = cy + innerR * Math.sin(endRad);
    const x2Inner = cx + innerR * Math.cos(startRad);
    const y2Inner = cy + innerR * Math.sin(startRad);

    const largeArc = sweepDeg > 180 ? 1 : 0;

    const color = getCuisineColor(cuisine.cuisine);

    const d = [
      `M ${x1Outer} ${y1Outer}`,
      `A ${outerR} ${outerR} 0 ${largeArc} 1 ${x2Outer} ${y2Outer}`,
      `L ${x1Inner} ${y1Inner}`,
      `A ${innerR} ${innerR} 0 ${largeArc} 0 ${x2Inner} ${y2Inner}`,
      'Z',
    ].join(' ');

    paths += `<path d="${d}" fill="${color}" opacity="0.85" class="dna-arc" data-cuisine="${esc(cuisine.cuisine)}">
      <title>${esc(cuisine.cuisine)}: ${Math.round(cuisine.score * 100)}%</title>
    </path>`;

    // Gap between segments
    currentAngle += sweepDeg + 1.5;
  }

  return `<svg viewBox="0 0 ${size} ${size}" width="${size}" height="${size}" class="dna-radial" role="img" aria-label="Taste DNA radial chart">
    <defs>
      <filter id="dna-glow">
        <feGaussianBlur stdDeviation="2" result="blur"/>
        <feComposite in="SourceGraphic" in2="blur" operator="over"/>
      </filter>
    </defs>
    <g filter="url(#dna-glow)">${paths}</g>
  </svg>`;
}

function buildEmptyChart(size) {
  const cx = size / 2;
  const cy = size / 2;
  const r = size / 2 - 4;
  const ir = r * 0.45;
  return `<svg viewBox="0 0 ${size} ${size}" width="${size}" height="${size}" class="dna-radial dna-radial--empty" role="img" aria-label="No taste data yet">
    <circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="var(--border)" stroke-width="2" stroke-dasharray="6 4" opacity="0.4"/>
    <circle cx="${cx}" cy="${cy}" r="${ir}" fill="none" stroke="var(--border)" stroke-width="1" stroke-dasharray="4 3" opacity="0.25"/>
  </svg>`;
}

function getCuisineColor(cuisine) {
  const c = CUISINE_COLORS[cuisine] || CUISINE_COLORS._default;
  return `hsl(${c.h} ${c.s}% ${c.l}%)`;
}

/* ---- Vibe Bar Chart ---- */

/**
 * Build horizontal bar chart for vibe preferences.
 * Each axis is -1 to +1 with labeled endpoints.
 */
export function buildVibeChart(vibe) {
  if (!vibe) return '';

  const axes = [
    { key: 'noise',     left: 'Quiet',  right: 'Lively',  value: vibe.noise || 0 },
    { key: 'energy',    left: 'Calm',   right: 'Energetic', value: vibe.energy || 0 },
    { key: 'formality', left: 'Casual', right: 'Formal',  value: vibe.formality || 0 },
  ];

  return axes.map(axis => {
    const pct = ((axis.value + 1) / 2) * 100; // -1..+1 to 0..100%
    return `<div class="dna-vibe-axis">
      <span class="dna-vibe-label dna-vibe-label--left type-data--sm">${axis.left}</span>
      <div class="dna-vibe-track">
        <div class="dna-vibe-fill" style="width: ${pct}%"></div>
        <div class="dna-vibe-marker" style="left: ${pct}%"></div>
      </div>
      <span class="dna-vibe-label dna-vibe-label--right type-data--sm">${axis.right}</span>
    </div>`;
  }).join('');
}

/* ---- Taste DNA Card ---- */

/**
 * Render the full Taste DNA card into the given container.
 */
export function renderTasteDnaCard(container, dna) {
  if (!container) return;

  if (!dna || !dna.has_data) {
    container.innerHTML = renderEmptyDnaCard();
    container.classList.add('dna-card--loaded');
    return;
  }

  const topCuisines = dna.top_cuisines || [];
  const topCuisineList = topCuisines.slice(0, 5).map((c, i) => {
    const color = getCuisineColor(c.cuisine);
    const barWidth = Math.round(c.score * 100);
    return `<div class="dna-cuisine-row" style="--dna-delay: ${i * 80}ms">
      <span class="dna-cuisine-dot" style="background: ${color}"></span>
      <span class="dna-cuisine-name type-structural">${esc(c.cuisine)}</span>
      <div class="dna-cuisine-bar-track">
        <div class="dna-cuisine-bar" style="width: ${barWidth}%; background: ${color}"></div>
      </div>
      <span class="dna-cuisine-pct type-data--sm">${barWidth}%</span>
    </div>`;
  }).join('');

  const archetypeIcon = ARCHETYPE_ICONS[dna.archetype] || '';
  const discoveryPct = Math.round((dna.discovery_score || 0) * 100);
  const signalBreakdown = dna.signal_breakdown || {};

  container.innerHTML = `
    <div class="dna-card__inner">
      <!-- Radial Chart + Archetype Center -->
      <div class="dna-chart-wrap">
        ${buildRadialChart(topCuisines, 200)}
        <div class="dna-archetype-center">
          <span class="dna-archetype-icon">${archetypeIcon}</span>
          <span class="dna-archetype-name type-emotional">${esc(dna.archetype)}</span>
        </div>
      </div>

      <!-- Archetype Description -->
      <p class="dna-archetype-desc type-structural">${esc(dna.archetype_description || '')}</p>

      <!-- Top Cuisines -->
      <div class="dna-section">
        <h4 class="dna-section-title type-data--sm">YOUR CUISINES</h4>
        <div class="dna-cuisine-list">${topCuisineList}</div>
      </div>

      <!-- Vibe Profile -->
      <div class="dna-section">
        <h4 class="dna-section-title type-data--sm">YOUR VIBE</h4>
        <div class="dna-vibe-chart">${buildVibeChart(dna.vibe_profile)}</div>
      </div>

      <!-- Stats Row -->
      <div class="dna-stats">
        <div class="dna-stat">
          <span class="dna-stat-value type-emotional">${discoveryPct}%</span>
          <span class="dna-stat-label type-data--sm">Explorer Level</span>
          <div class="dna-discovery-bar">
            <div class="dna-discovery-fill" style="width: ${discoveryPct}%"></div>
          </div>
        </div>
        <div class="dna-stat">
          <span class="dna-stat-value type-emotional">${dna.cuisine_breadth || 0}</span>
          <span class="dna-stat-label type-data--sm">Cuisines</span>
        </div>
        <div class="dna-stat">
          <span class="dna-stat-value type-emotional">${esc(dna.price_sweet_spot || '$$')}</span>
          <span class="dna-stat-label type-data--sm">Sweet Spot</span>
        </div>
        <div class="dna-stat">
          <span class="dna-stat-value type-emotional">${dna.total_signals || 0}</span>
          <span class="dna-stat-label type-data--sm">Signals</span>
        </div>
      </div>

      ${dna.neighborhood_home ? `
      <div class="dna-neighborhood">
        <span class="dna-neighborhood-label type-data--sm">Home Base</span>
        <span class="dna-neighborhood-name type-structural">${esc(dna.neighborhood_home)}</span>
      </div>` : ''}

      <!-- Signal Breakdown -->
      <div class="dna-signals type-data--sm">
        ${signalBreakdown.searches ? `<span>${signalBreakdown.searches} searches</span>` : ''}
        ${signalBreakdown.favorites ? `<span>${signalBreakdown.favorites} favorites</span>` : ''}
        ${signalBreakdown.visits ? `<span>${signalBreakdown.visits} visits</span>` : ''}
        ${signalBreakdown.feedback ? `<span>${signalBreakdown.feedback} ratings</span>` : ''}
      </div>

      <!-- Share Button -->
      <button class="dna-share-btn cta-btn cta-btn--ghost cta-btn--icon" data-action="share-dna">
        <span class="cta-btn__icon">
          <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/>
            <line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/>
          </svg>
        </span>
        <span class="cta-btn__text">Share My Taste DNA</span>
      </button>
    </div>
  `;

  container.classList.add('dna-card--loaded');

  // Animate bars in
  requestAnimationFrame(() => {
    container.querySelectorAll('.dna-cuisine-bar').forEach(bar => {
      bar.classList.add('dna-cuisine-bar--animate');
    });
    container.querySelectorAll('.dna-discovery-fill').forEach(bar => {
      bar.classList.add('dna-discovery-fill--animate');
    });
  });
}

function renderEmptyDnaCard() {
  return `
    <div class="dna-card__inner dna-card__inner--empty">
      <div class="dna-chart-wrap">
        ${buildEmptyChart(200)}
        <div class="dna-archetype-center">
          <span class="dna-archetype-icon">${ARCHETYPE_ICONS['The Newcomer']}</span>
          <span class="dna-archetype-name type-emotional">Your Taste DNA</span>
        </div>
      </div>
      <p class="dna-archetype-desc type-structural">
        Start searching and saving restaurants to build your taste profile.
        Every search, like, and visit helps us learn what you love.
      </p>
      <div class="dna-empty-cta">
        <span class="dna-empty-cta-label type-data--sm">
          Search, save, and visit to unlock your Taste DNA
        </span>
      </div>
    </div>
  `;
}

/* ---- Archetype Badge ---- */

/**
 * Render a compact archetype badge for the Canvas header.
 */
export function renderArchetypeBadge(dna) {
  if (!dna || !dna.has_data) return '';

  const icon = ARCHETYPE_ICONS[dna.archetype] || '';
  return `<span class="dna-badge" title="${esc(dna.archetype)}: ${esc(dna.archetype_description || '')}">
    <span class="dna-badge__icon">${icon}</span>
    <span class="dna-badge__label type-data--sm">${esc(dna.archetype)}</span>
  </span>`;
}

/* ---- Group Blend UI ---- */

/**
 * Render the Taste Blend result card.
 */
export function renderBlendCard(container, blend) {
  if (!container || !blend) return;

  if (blend.error) {
    container.innerHTML = `<p class="dna-blend-error type-structural">${esc(blend.error)}</p>`;
    return;
  }

  const commonCuisines = (blend.common_ground?.cuisines || []).slice(0, 5);
  const tryNew = (blend.try_something_new || []).slice(0, 3);
  const commonNeighborhoods = (blend.common_ground?.neighborhoods || []).slice(0, 3);
  const compat = blend.compatibility_score || 0;

  const cuisineChips = commonCuisines.map(c => {
    const color = getCuisineColor(c.cuisine);
    return `<span class="dna-blend-chip" style="--chip-color: ${color}">
      ${esc(c.cuisine)}
      <span class="dna-blend-chip-shared type-data--sm">${c.shared_by} share</span>
    </span>`;
  }).join('');

  const tryNewChips = tryNew.map(c => {
    const color = getCuisineColor(c.cuisine);
    return `<span class="dna-blend-chip dna-blend-chip--new" style="--chip-color: ${color}">
      ${esc(c.cuisine)}
    </span>`;
  }).join('');

  const neighborhoodList = commonNeighborhoods.map(n =>
    `<span class="dna-blend-neighborhood">${esc(n.neighborhood)}</span>`
  ).join('');

  container.innerHTML = `
    <div class="dna-blend-inner">
      <!-- Compatibility Score Ring -->
      <div class="dna-blend-compat">
        <svg viewBox="0 0 120 120" width="120" height="120" class="dna-blend-ring">
          <circle cx="60" cy="60" r="52" fill="none" stroke="var(--border)" stroke-width="8" opacity="0.3"/>
          <circle cx="60" cy="60" r="52" fill="none"
            stroke="${compat >= 70 ? 'var(--rag-green)' : compat >= 40 ? 'var(--rag-amber)' : 'var(--rag-red)'}"
            stroke-width="8"
            stroke-dasharray="${(compat / 100) * 327} 327"
            stroke-linecap="round"
            transform="rotate(-90 60 60)"
            class="dna-blend-ring-fill"/>
        </svg>
        <div class="dna-blend-compat-text">
          <span class="dna-blend-compat-value type-emotional">${compat}%</span>
          <span class="dna-blend-compat-label type-data--sm">Compatible</span>
        </div>
      </div>

      <!-- Common Ground -->
      <div class="dna-blend-section">
        <h4 class="dna-section-title type-data--sm">COMMON GROUND</h4>
        <div class="dna-blend-chips">${cuisineChips || '<span class="type-data--sm" style="color: var(--fg3)">No shared cuisines yet</span>'}</div>
      </div>

      <!-- Try Something New -->
      ${tryNew.length > 0 ? `
      <div class="dna-blend-section">
        <h4 class="dna-section-title type-data--sm">TRY SOMETHING NEW</h4>
        <div class="dna-blend-chips">${tryNewChips}</div>
      </div>` : ''}

      <!-- Shared Neighborhoods -->
      ${commonNeighborhoods.length > 0 ? `
      <div class="dna-blend-section">
        <h4 class="dna-section-title type-data--sm">MEET HERE</h4>
        <div class="dna-blend-neighborhoods">${neighborhoodList}</div>
      </div>` : ''}

      <!-- Blended Vibe -->
      <div class="dna-blend-section">
        <h4 class="dna-section-title type-data--sm">GROUP VIBE</h4>
        <div class="dna-vibe-chart">${buildVibeChart(blend.blended_vibe)}</div>
      </div>

      <!-- Price Sweet Spot -->
      <div class="dna-blend-price">
        <span class="type-data--sm" style="color: var(--fg3)">Budget</span>
        <span class="type-structural">${esc(blend.price_sweet_spot || '$$')}</span>
      </div>

      <!-- Search with blend -->
      <button class="dna-blend-search-btn cta-btn cta-btn--icon" data-action="search-blend">
        <span class="cta-btn__icon">
          <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
          </svg>
        </span>
        <span class="cta-btn__text">Find a spot for all of us</span>
      </button>
    </div>
  `;
}

/* ---- Taste DNA Modal ---- */

/**
 * Open the Taste DNA modal.
 */
export async function openTasteDnaModal() {
  let $modal = document.getElementById('taste-dna-modal');
  if (!$modal) return;

  $modal.classList.add('taste-dna-modal--open');

  // Show loading state
  const $content = $modal.querySelector('.taste-dna-modal__content');
  if ($content) {
    $content.innerHTML = '<div class="dna-loading"><div class="dna-loading-spinner"></div><p class="type-structural">Analyzing your taste...</p></div>';
  }

  const dna = await fetchTasteDna();

  if ($content) {
    renderTasteDnaCard($content, dna);
  }
}

/**
 * Close the Taste DNA modal.
 */
export function closeTasteDnaModal() {
  const $modal = document.getElementById('taste-dna-modal');
  if ($modal) $modal.classList.remove('taste-dna-modal--open');
}

/* ---- Taste Blend Modal ---- */

/**
 * Open the group blend modal.
 */
export function openBlendModal() {
  let $modal = document.getElementById('taste-blend-modal');
  if (!$modal) return;

  $modal.classList.add('taste-blend-modal--open');

  const $content = $modal.querySelector('.taste-blend-modal__content');
  if ($content) {
    renderBlendInputForm($content);
  }
}

/**
 * Close the blend modal.
 */
export function closeBlendModal() {
  const $modal = document.getElementById('taste-blend-modal');
  if ($modal) $modal.classList.remove('taste-blend-modal--open');
}

/**
 * Render the manual blend input form (for when friends aren't on the platform).
 */
function renderBlendInputForm(container) {
  const CUISINE_OPTIONS = [
    'Italian', 'Mexican', 'Japanese', 'Chinese', 'Thai', 'Indian', 'Korean',
    'American', 'French', 'Greek', 'Ethiopian', 'Vietnamese', 'Lebanese',
    'BBQ', 'Southern', 'Peruvian', 'Turkish', 'Filipino'
  ];

  const VIBE_OPTIONS = [
    { label: 'Quiet & Cozy', noise: -0.7, energy: -0.5, formality: 0.2 },
    { label: 'Chill & Casual', noise: -0.3, energy: -0.2, formality: -0.5 },
    { label: 'Lively & Fun', noise: 0.5, energy: 0.6, formality: -0.3 },
    { label: 'Upscale & Elegant', noise: -0.4, energy: 0.2, formality: 0.7 },
  ];

  container.innerHTML = `
    <div class="dna-blend-form">
      <h3 class="type-emotional dna-blend-form-title">Dining with friends?</h3>
      <p class="type-structural dna-blend-form-subtitle">Tell us about your group's taste and we'll find the perfect spot.</p>

      <div class="dna-blend-people" id="blend-people">
        ${renderPersonForm(1, CUISINE_OPTIONS, VIBE_OPTIONS)}
        ${renderPersonForm(2, CUISINE_OPTIONS, VIBE_OPTIONS)}
      </div>

      <button class="dna-blend-add-person type-structural" data-action="add-blend-person">
        + Add another person
      </button>

      <div class="dna-blend-budget">
        <h4 class="dna-section-title type-data--sm">GROUP BUDGET</h4>
        <div class="dna-blend-budget-pills">
          <button class="filter-pill filter-pill--active" data-blend-price="$">$</button>
          <button class="filter-pill" data-blend-price="$$">$$</button>
          <button class="filter-pill" data-blend-price="$$$">$$$</button>
          <button class="filter-pill" data-blend-price="$$$$">$$$$</button>
        </div>
      </div>

      <button class="dna-blend-compute-btn cta-btn cta-btn--icon" data-action="compute-blend">
        <span class="cta-btn__icon">
          <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M12 2L2 7l10 5 10-5-10-5z"/><path d="M2 17l10 5 10-5"/>
            <path d="M2 12l10 5 10-5"/>
          </svg>
        </span>
        <span class="cta-btn__text">Find our blend</span>
      </button>

      <!-- Blend result gets injected here -->
      <div class="dna-blend-result" id="blend-result"></div>
    </div>
  `;

  // Wire up events
  wireBlendFormEvents(container, CUISINE_OPTIONS, VIBE_OPTIONS);
}

function renderPersonForm(num, cuisineOptions, vibeOptions) {
  const cuisineCheckboxes = cuisineOptions.slice(0, 12).map(c =>
    `<label class="dna-blend-cuisine-opt">
      <input type="checkbox" name="person${num}-cuisine" value="${c}">
      <span class="dna-blend-cuisine-chip">${c}</span>
    </label>`
  ).join('');

  const vibeRadios = vibeOptions.map((v, i) =>
    `<label class="dna-blend-vibe-opt">
      <input type="radio" name="person${num}-vibe" value="${i}" ${i === 1 ? 'checked' : ''}>
      <span class="dna-blend-vibe-chip">${v.label}</span>
    </label>`
  ).join('');

  return `
    <div class="dna-blend-person" data-person="${num}">
      <h4 class="dna-blend-person-title type-structural">Person ${num}</h4>
      <div class="dna-blend-person-cuisines">
        <span class="dna-section-title type-data--sm">Top cuisines (pick up to 3)</span>
        <div class="dna-blend-cuisine-grid">${cuisineCheckboxes}</div>
      </div>
      <div class="dna-blend-person-vibe">
        <span class="dna-section-title type-data--sm">Vibe preference</span>
        <div class="dna-blend-vibe-grid">${vibeRadios}</div>
      </div>
    </div>
  `;
}

function wireBlendFormEvents(container, cuisineOptions, vibeOptions) {
  let personCount = 2;

  // Limit cuisine selections to 3 per person
  container.addEventListener('change', (e) => {
    const cb = e.target;
    if (cb.type === 'checkbox' && cb.name.includes('-cuisine')) {
      const personNum = cb.name.match(/person(\d+)/)?.[1];
      const checked = container.querySelectorAll(`input[name="person${personNum}-cuisine"]:checked`);
      if (checked.length > 3) {
        cb.checked = false;
        showToast('Pick up to 3 cuisines per person');
      }
    }
  });

  // Budget pill selection
  container.addEventListener('click', (e) => {
    const pill = e.target.closest('[data-blend-price]');
    if (pill) {
      container.querySelectorAll('[data-blend-price]').forEach(p => p.classList.remove('filter-pill--active'));
      pill.classList.add('filter-pill--active');
    }
  });

  // Add person
  container.addEventListener('click', (e) => {
    if (e.target.closest('[data-action="add-blend-person"]')) {
      if (personCount >= 5) {
        showToast('Maximum 5 people');
        return;
      }
      personCount++;
      const $people = container.querySelector('#blend-people');
      if ($people) {
        const div = document.createElement('div');
        div.innerHTML = renderPersonForm(personCount, cuisineOptions, vibeOptions);
        $people.appendChild(div.firstElementChild);
      }
    }
  });

  // Compute blend
  container.addEventListener('click', (e) => {
    if (e.target.closest('[data-action="compute-blend"]')) {
      computeManualBlend(container, vibeOptions);
    }
  });
}

/**
 * Compute a blend from the manual form inputs.
 * Constructs synthetic profiles and blends them client-side.
 */
function computeManualBlend(container, vibeOptions) {
  const persons = container.querySelectorAll('.dna-blend-person');
  const profiles = [];

  for (const person of persons) {
    const num = person.dataset.person;
    const cuisines = Array.from(person.querySelectorAll(`input[name="person${num}-cuisine"]:checked`))
      .map(cb => cb.value);
    const vibeIdx = parseInt(person.querySelector(`input[name="person${num}-vibe"]:checked`)?.value || '1');
    const vibe = vibeOptions[vibeIdx] || vibeOptions[1];

    profiles.push({
      cuisines: cuisines.map((c, i) => ({ cuisine: c, score: 1 - (i * 0.2) })),
      noise: vibe.noise,
      energy: vibe.energy,
      formality: vibe.formality,
    });
  }

  if (profiles.length < 2) {
    showToast('Add at least 2 people');
    return;
  }

  // Validate at least 1 cuisine per person
  for (let i = 0; i < profiles.length; i++) {
    if (profiles[i].cuisines.length === 0) {
      showToast(`Person ${i + 1} needs at least 1 cuisine`);
      return;
    }
  }

  // Get selected price
  const priceBtn = container.querySelector('[data-blend-price].filter-pill--active');
  const priceMap = { '$': 1, '$$': 2, '$$$': 3, '$$$$': 4 };
  const prices = [priceMap[priceBtn?.dataset?.blendPrice || '$$'] || 2];

  // Client-side blend
  const blend = blendLocal(profiles, prices);

  const $result = container.querySelector('#blend-result');
  if ($result) {
    renderBlendCard($result, blend);
  }
}

/**
 * Client-side blend computation (mirrors backend logic for manual inputs).
 */
function blendLocal(profiles, prices) {
  const n = profiles.length;
  const cuisineMap = {};
  let noiseSum = 0, energySum = 0, formalitySum = 0;

  for (const p of profiles) {
    noiseSum += p.noise;
    energySum += p.energy;
    formalitySum += p.formality;

    for (const c of p.cuisines) {
      if (!cuisineMap[c.cuisine]) {
        cuisineMap[c.cuisine] = { scoreSum: 0, userCount: 0 };
      }
      cuisineMap[c.cuisine].scoreSum += c.score;
      cuisineMap[c.cuisine].userCount++;
    }
  }

  // Common ground: cuisines shared by 2+ users
  const commonCuisines = Object.entries(cuisineMap)
    .filter(([_, v]) => v.userCount >= Math.min(2, n))
    .map(([cuisine, v]) => ({
      cuisine,
      score: Math.round((v.scoreSum / v.userCount) * 100) / 100,
      shared_by: v.userCount,
    }))
    .sort((a, b) => b.score - a.score);

  // Try something new: cuisines only 1 user has
  const tryNew = Object.entries(cuisineMap)
    .filter(([_, v]) => v.userCount === 1)
    .map(([cuisine, v]) => ({
      cuisine,
      score: Math.round(v.scoreSum * 100) / 100,
    }))
    .sort((a, b) => b.score - a.score)
    .slice(0, 3);

  // Compatibility
  const noiseRange = Math.max(...profiles.map(p => p.noise)) - Math.min(...profiles.map(p => p.noise));
  const energyRange = Math.max(...profiles.map(p => p.energy)) - Math.min(...profiles.map(p => p.energy));
  const formalityRange = Math.max(...profiles.map(p => p.formality)) - Math.min(...profiles.map(p => p.formality));

  const totalUnique = Object.keys(cuisineMap).length;
  const overlapCount = commonCuisines.length;

  let compat = 100
    - Math.min(noiseRange * 7.5, 15)
    - Math.min(energyRange * 7.5, 15)
    - Math.min(formalityRange * 7.5, 15)
    - (totalUnique > 0 ? Math.min((1 - overlapCount / totalUnique) * 30, 30) : 0);

  compat = Math.max(0, Math.min(100, Math.round(compat)));

  const minPrice = Math.min(...prices, ...Array(n).fill(2));
  const priceLabelMap = { 1: '$', 2: '$$', 3: '$$$', 4: '$$$$' };

  return {
    compatibility_score: compat,
    group_size: n,
    common_ground: {
      cuisines: commonCuisines,
      neighborhoods: [],
    },
    try_something_new: tryNew,
    blended_vibe: {
      noise: Math.round((noiseSum / n) * 100) / 100,
      energy: Math.round((energySum / n) * 100) / 100,
      formality: Math.round((formalitySum / n) * 100) / 100,
    },
    price_sweet_spot: priceLabelMap[Math.round(minPrice)] || '$$',
    total_signals: 0,
  };
}

/* ---- Share Taste DNA ---- */

/**
 * Generate a shareable canvas image of the user's Taste DNA.
 */
export async function shareTasteDna() {
  const dna = _tasteDna;
  if (!dna || !dna.has_data) {
    showToast('Build your Taste DNA first by searching and saving restaurants');
    return;
  }

  const user = getUser();
  const text = `My Donde Taste DNA: ${dna.archetype}. Top cuisines: ${
    (dna.top_cuisines || []).slice(0, 3).map(c => c.cuisine).join(', ')
  }. Explorer level: ${Math.round(dna.discovery_score * 100)}%. What's your food personality? dondeai.com`;

  if (navigator.share) {
    try {
      await navigator.share({ title: `${user?.name || 'My'} Taste DNA`, text });
      return;
    } catch { /* fallback */ }
  }

  // Clipboard fallback
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text);
    showToast('Taste DNA copied to clipboard!');
  }
}

/* ---- Init: Auto-compute on login ---- */

/**
 * Initialize Taste DNA module. Call after auth is initialized.
 * If user is authenticated, pre-fetch Taste DNA in the background.
 */
export async function initTasteDna() {
  if (!isAuthenticated()) return;

  // Background fetch — don't block anything
  fetchTasteDna().then(dna => {
    if (dna && dna.has_data) {
      // Inject archetype badge into header
      const $headerName = document.getElementById('header-user-name');
      if ($headerName && !document.querySelector('.dna-badge')) {
        const badgeHtml = renderArchetypeBadge(dna);
        if (badgeHtml) {
          $headerName.insertAdjacentHTML('afterend', badgeHtml);
          // Spring-pop animation
          const badge = document.querySelector('.dna-badge');
          if (badge) {
            badge.classList.add('dna-badge--enter');
            setTimeout(() => badge.classList.remove('dna-badge--enter'), 500);
          }
        }
      }
    }
  }).catch(() => { /* silent */ });
}

/* ---- Utility ---- */
function esc(str) {
  if (!str) return '';
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}
