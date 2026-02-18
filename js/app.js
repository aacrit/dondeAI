/* ============================================
   DondeAI — Main Orchestrator
   Single-canvas layout: Canvas + Result.
   ============================================ */

import { getState, setState, subscribe, resetState } from './state.js';
import { initRouter, goToStep, goToStepInstant } from './router.js';
import { loadTheme, loadSound, loadHistory } from './persistence.js';
import { addToHistory } from './persistence.js';
import { initTheme, setTheme, getLabels, CULTURES, CULTURE_DISPLAY_NAMES } from './theme.js';
import { initAudio, toggleSound, playChime } from './audio.js';
import { initVoice, startVoice } from './voice.js';
import { initShare, shareResult, closeShareSheet, handleShareChannel } from './share.js';
import { initOffline, isOnline } from './offline.js';
import { initAccessibility, announce } from './accessibility.js';
import { fetchRecommendation } from './api.js';
import { animateScoreRing, renderRadar, animateGoogleRating, animateBadge, startParticles, stopParticles, chaosToOrderReveal, initLogoAnimation, startSearchPulse, stopSearchPulse, resolveLogoToFound, cleanupLoadingLogo } from './animations.js';
import {
  getGreeting, getCuisineFromResult, svgIcon,
  getScoreTier, getScoreColor, buildGoogleStars, buildMapsUrl, relativeTime, matchCuisine
} from './utils.js';

/* ---- Cached DOM Elements ---- */
const $app = document.querySelector('.app');
const $main = document.querySelector('.cockpit');
const $cravingInput = document.getElementById('craving-input');
const $loadingState = document.getElementById('loading-state');
const $resultCard = document.getElementById('result-card');
const $particleCanvas = document.getElementById('particle-canvas');
const $toast = document.getElementById('toast');
const $toastText = document.getElementById('toast-text');
const $cursorGlow = document.querySelector('.cursor-glow');

/* ---- AbortController for fetch cancellation ---- */
let currentAbort = null;

/* ---- Animation timeout tracker (cancelled on re-render) ---- */
let animationTimers = [];

/* ---- Initialize ---- */
function init() {
  // Load persisted state
  const savedTheme = loadTheme();
  const savedSound = loadSound();
  const savedHistory = loadHistory();

  setState({
    theme: savedTheme,
    soundEnabled: savedSound,
    history: savedHistory,
  });

  // Initialize all modules
  initRouter();
  initTheme();
  initAudio();
  initVoice();
  initShare();
  initOffline();
  initAccessibility();

  // Set up greeting
  setupLanding();

  // Wire event delegation
  wireEvents();

  // Wire craving input
  wireCravingInput();

  // Wire swipe gestures
  wireSwipe();

  // Wire disabled CTA nudge (pointerdown fires even on disabled buttons)
  document.addEventListener('pointerdown', (e) => {
    const btn = e.target.closest('.cta-btn:disabled');
    if (btn && btn.dataset.action === 'submit') {
      btn.classList.add('cta-btn--nudge');
      btn.addEventListener('animationend', () => btn.classList.remove('cta-btn--nudge'), { once: true });
      $cravingInput?.focus();
    }
  });

  // Wire toast dismiss button
  document.getElementById('toast-dismiss')?.addEventListener('click', dismissToast);

  // Init cursor glow (desktop only)
  initCursorGlow();

  // Subscribe to state changes
  subscribe((state, prev) => {
    if (state.result !== prev.result && state.result) {
      // Result arrived — orchestrate the reveal transition (Act 3)
      orchestrateReveal(state.result);
    }
    if (state.loading !== prev.loading && state.loading) {
      // Only handle loading=true here; loading=false is handled by orchestrateReveal
      toggleLoading(true);
    }
    if (state.error !== prev.error && state.error) {
      showToast(state.error, true);
    }
  });

  // Push initial history state
  history.replaceState({ step: 0 }, '', '');

  // Sync CTA disabled state
  updateCtaState();
}

/* ---- Landing Setup ---- */
function setupLanding() {
  const state = getState();
  const greeting = document.querySelector('[data-step="0"] .step__title');
  if (greeting) greeting.textContent = getGreeting();

  // Render taste memory (recent searches)
  renderTasteMemory(state.history);
}

/* ---- Taste Memory Rendering ---- */
function renderTasteMemory(history) {
  const $mem = document.getElementById('taste-memory');
  const $list = document.getElementById('taste-memory-list');
  if (!$mem || !$list) return;

  if (!history || history.length === 0) {
    $mem.style.display = 'none';
    return;
  }

  $mem.style.display = 'block';
  $list.innerHTML = '';

  history.forEach(entry => {
    const item = document.createElement('div');
    item.className = 'taste-memory__item';
    item.setAttribute('data-action', 'taste-memory');
    item.setAttribute('data-value', entry.payload?.special_request || entry.label);

    const iconEl = document.createElement('span');
    iconEl.className = 'taste-memory__emoji';
    // Backward compat: old entries may have cuisineEmoji but no cuisineIcon
    const iconName = entry.cuisineIcon || 'plate';
    iconEl.innerHTML = svgIcon(iconName, 18);
    item.appendChild(iconEl);

    const text = document.createElement('span');
    text.className = 'taste-memory__text type-structural';
    text.textContent = entry.label;
    item.appendChild(text);

    const time = document.createElement('span');
    time.className = 'taste-memory__time type-data--sm';
    time.textContent = relativeTime(entry.timestamp);
    item.appendChild(time);

    $list.appendChild(item);
  });
}

/* ---- Event Delegation ---- */
function wireEvents() {
  document.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-action]');
    if (!btn) return;

    const action = btn.dataset.action;

    switch (action) {
      case 'reset':
        resetState();
        if ($cravingInput) $cravingInput.value = '';
        clearAllSelections();
        setupLanding();
        goToStep(0);
        updateCtaState();
        updateFilterSummary();
        // Collapse filter drawer
        collapseFilters();
        break;

      case 'back':
        if (currentAbort) currentAbort.abort();
        if (getState().loading) {
          toggleLoading(false);
          setState({ loading: false });
        }
        goToStep(getState().step - 1);
        break;

      case 'voice':
        startVoice();
        break;

      case 'smart-chip': {
        const val = btn.dataset.value;
        if ($cravingInput) {
          const current = $cravingInput.value.trim();
          $cravingInput.value = current ? `${current}, ${val}` : val;
          setState({ craving: $cravingInput.value });
          updateCtaState();
        }
        break;
      }

      case 'select-occasion':
        selectFilter('occasion', btn);
        break;

      case 'select-neighborhood':
        selectFilter('neighborhood', btn);
        break;

      case 'select-budget':
        selectFilter('priceLevel', btn);
        break;

      case 'toggle-filters': {
        const content = document.getElementById('filter-content');
        const isExpanded = btn.getAttribute('aria-expanded') === 'true';
        btn.setAttribute('aria-expanded', String(!isExpanded));
        if (content) content.hidden = isExpanded;
        break;
      }

      case 'submit':
        handleSubmit();
        break;

      case 'try-again':
        handleSubmit();
        break;

      case 'open-themes':
        document.getElementById('theme-picker')?.classList.add('theme-picker--open');
        break;

      case 'close-themes':
        document.getElementById('theme-picker')?.classList.remove('theme-picker--open');
        break;

      case 'select-theme': {
        const culture = btn.dataset.theme;
        setTheme(culture, getState().theme.mode);
        break;
      }

      case 'set-mode': {
        const mode = btn.dataset.mode;
        setTheme(getState().theme.culture, mode);
        break;
      }

      case 'toggle-mode': {
        const currentMode = getState().theme.mode;
        const newMode = currentMode === 'light' ? 'dark' : 'light';
        setTheme(getState().theme.culture, newMode);
        break;
      }

      case 'cycle-theme': {
        const currentCulture = getState().theme.culture;
        const currentIndex = CULTURES.indexOf(currentCulture);
        const nextIndex = (currentIndex + 1) % CULTURES.length;
        const nextCulture = CULTURES[nextIndex];
        setTheme(nextCulture, getState().theme.mode);
        showToast(CULTURE_DISPLAY_NAMES[nextCulture] || nextCulture);
        break;
      }

      case 'toggle-sound':
        toggleSound();
        break;

      case 'share':
        shareResult();
        break;

      case 'close-share':
        closeShareSheet();
        break;

      case 'share-channel':
        handleShareChannel(btn.dataset.channel);
        break;

      case 'taste-memory': {
        const val = btn.dataset.value;
        if ($cravingInput) $cravingInput.value = val;
        setState({ craving: val });
        updateCtaState();
        break;
      }

      case 'randomize': {
        // Pick random occasion, neighborhood, budget
        const occasions = ['Date Night', 'Group Hangout', 'Family Dinner', 'Business Lunch', 'Solo Dining', 'Special Occasion', 'Treat Myself', 'Adventure', 'Chill Hangout'];
        const hoods = ['Pilsen', 'Wicker Park', 'Logan Square', 'Lincoln Park', 'West Loop', 'Bucktown', 'Hyde Park', 'Chinatown', 'Little Italy', 'Andersonville', 'River North', 'Old Town', 'Lakeview', 'Fulton Market'];
        const budgets = ['$', '$$', '$$$', '$$$$'];
        setState({
          occasion: occasions[Math.floor(Math.random() * occasions.length)],
          neighborhood: hoods[Math.floor(Math.random() * hoods.length)],
          priceLevel: budgets[Math.floor(Math.random() * budgets.length)],
        });
        updateFilterSummary();
        showToast('Filters randomized!');
        break;
      }

      case 'share-format': {
        const format = btn.dataset.format;
        document.querySelectorAll('.share-format-btn').forEach(b => {
          b.classList.toggle('share-format-btn--active', b.dataset.format === format);
        });
        renderShareCanvas(format);
        break;
      }

      case 'close-tile-expand':
        closeTileExpand();
        break;

      case 'toggle-recommendation': {
        const $rec = document.getElementById('result-recommendation');
        const isExpanded = btn.getAttribute('aria-expanded') === 'true';
        btn.setAttribute('aria-expanded', String(!isExpanded));
        if ($rec) $rec.classList.toggle('result-recommendation--expanded');
        btn.textContent = isExpanded ? 'Read more' : 'Read less';
        break;
      }
    }
  });

  // Expandable tile click delegation (DondeAI Score + Vibe Radar)
  document.addEventListener('click', (e) => {
    const tile = e.target.closest('.score-tile--expandable');
    if (tile) openTileExpand(tile);
  });
}

/* ---- Craving Input ---- */
function wireCravingInput() {
  if (!$cravingInput) return;

  $cravingInput.addEventListener('input', () => {
    setState({ craving: $cravingInput.value });
    updateCtaState();
  });

  $cravingInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleSubmit();
    }
  });
}

function updateCtaState() {
  const $cta = document.querySelector('.cta-btn[data-action="submit"]');
  const $hint = document.getElementById('cta-hint');
  const isEmpty = !$cravingInput?.value.trim();

  if ($cta) {
    $cta.disabled = isEmpty;
    $cta.setAttribute('aria-disabled', String(isEmpty));
  }
  if ($hint) {
    $hint.classList.toggle('cta-hint--visible', isEmpty);
  }
}

/* ---- Filter Selection (with ink ripple) ---- */
function selectFilter(field, btn) {
  const group = btn.closest('[role="radiogroup"]') || btn.closest('.filter-pills');
  if (!group) return;

  // Create ink ripple BEFORE state change for visible contrast
  const ripple = document.createElement('span');
  ripple.className = 'filter-pill__ripple';
  btn.appendChild(ripple);
  ripple.addEventListener('animationend', () => ripple.remove(), { once: true });

  // Deselect siblings
  group.querySelectorAll('.filter-pill').forEach(c => {
    c.setAttribute('aria-checked', 'false');
  });

  // Select this one
  btn.setAttribute('aria-checked', 'true');
  btn.classList.add('chip-pop');
  btn.addEventListener('animationend', () => btn.classList.remove('chip-pop'), { once: true });

  setState({ [field]: btn.dataset.value });
  updateFilterSummary();
}

function clearAllSelections() {
  document.querySelectorAll('.filter-pill[aria-checked="true"]').forEach(c => {
    c.setAttribute('aria-checked', 'false');
  });
}

function collapseFilters() {
  const toggle = document.querySelector('[data-action="toggle-filters"]');
  const content = document.getElementById('filter-content');
  if (toggle) toggle.setAttribute('aria-expanded', 'false');
  if (content) content.hidden = true;
}

/* ---- Filter Summary ---- */
function updateFilterSummary() {
  const s = getState();
  const parts = [];
  if (s.occasion !== 'Any') parts.push(s.occasion);
  if (s.neighborhood !== 'Anywhere') parts.push(s.neighborhood);
  if (s.priceLevel !== 'Any') parts.push(s.priceLevel);
  const $summary = document.getElementById('filter-summary');
  if ($summary) {
    $summary.textContent = parts.length ? parts.join(' \u00B7 ') : '';
  }
}

/* ---- Submit ---- */
async function handleSubmit() {
  const s = getState();

  // Block resubmission while loading
  if (s.loading) return;

  if (!s.craving.trim()) {
    $cravingInput?.classList.add('shake');
    $cravingInput?.addEventListener('animationend', () => $cravingInput.classList.remove('shake'), { once: true });
    $cravingInput?.focus();
    showToast('Tell us what you\'re craving first!', true);
    return;
  }

  if (!isOnline()) {
    showToast("You're offline \u2014 can't reach the engine.", true);
    return;
  }

  // Cancel any in-flight request
  if (currentAbort) currentAbort.abort();
  currentAbort = new AbortController();

  // Set CTA to loading state
  const $cta = document.querySelector('.cta-btn[data-action="submit"]');
  if ($cta) {
    $cta.classList.add('cta-btn--loading');
    $cta.textContent = 'Searching';
  }

  setState({ loading: true, error: null, result: null });
  // Don't goToStep(1) — the loading overlay covers everything;
  // step-track positioning happens in orchestrateReveal()

  try {
    const data = await fetchRecommendation({
      special_request: s.craving,
      occasion: s.occasion,
      neighborhood: s.neighborhood,
      price_level: s.priceLevel,
    });

    // Save to history with cuisine icon
    const cuisine = getCuisineFromResult(data);
    const label = s.craving.slice(0, 30);
    const hist = addToHistory(label, {
      special_request: s.craving,
      occasion: s.occasion,
      neighborhood: s.neighborhood,
      price_level: s.priceLevel,
    }, cuisine.icon);

    // Set result — triggers orchestrateReveal() via subscription
    setState({ result: data, loading: false, history: hist });
    playChime();
    announce(`Recommendation: ${data.restaurant?.name || 'found'}`);
  } catch (err) {
    if (err.name === 'AbortError') return; // user navigated away
    // Error: clean up loading state and return to input
    toggleLoading(false);
    setState({ loading: false, error: err.message });
    goToStep(0);
  } finally {
    // Reset CTA state
    if ($cta) {
      $cta.classList.remove('cta-btn--loading');
      const labels = getLabels(getState().theme.culture);
      $cta.textContent = labels.cta;
    }
    currentAbort = null;
  }
}

/* ---- Loading Toggle (3-Act Focus Pull Transition) ---- */
let searchingDotsInterval = null;

function toggleLoading(loading) {
  const $header = document.querySelector('.header');
  const $step0 = document.querySelector('.step[data-step="0"]');
  const $loadingStatus = document.getElementById('loading-status');

  if (loading) {
    // === ACT 1: DEFOCUS ===
    // Blur the input page behind the overlay
    if ($step0) $step0.classList.add('step--defocused');
    // Hide header
    if ($header) $header.style.opacity = '0';

    // Show loading overlay
    if ($loadingState) {
      $loadingState.style.display = 'flex';
      $loadingState.style.opacity = '1';
      $loadingState.classList.remove('loading-state--fading');
    }
    // Hide result card
    if ($resultCard) $resultCard.style.display = 'none';

    // === ACT 2: SEARCH ===
    // Start particle drift
    if ($particleCanvas) startParticles($particleCanvas);
    // Question Pin SVG stroke draw-in
    initLogoAnimation();
    // Start search pulse (sonar ring + dot pulse) after draw-in completes
    setTimeout(() => startSearchPulse(), 800);

    // Animated searching dots
    if ($loadingStatus) {
      $loadingStatus.textContent = 'Searching';
      $loadingStatus.style.opacity = '';
      let dotCount = 0;
      searchingDotsInterval = setInterval(() => {
        dotCount = (dotCount + 1) % 4;
        $loadingStatus.textContent = 'Searching' + '.'.repeat(dotCount);
      }, 400);
    }
  } else {
    // === CLEANUP (called after reveal orchestration completes) ===
    // Stop animations
    clearSearchingDots();
    stopParticles();
    cleanupLoadingLogo();

    // Remove defocus from input page
    if ($step0) $step0.classList.remove('step--defocused');

    // Hide loading overlay
    if ($loadingState) {
      $loadingState.style.display = 'none';
      $loadingState.classList.remove('loading-state--fading');
    }

    // Restore header
    if ($header) $header.style.opacity = '';
  }
}

function clearSearchingDots() {
  if (searchingDotsInterval) {
    clearInterval(searchingDotsInterval);
    searchingDotsInterval = null;
  }
}

/* ---- Result Reveal Orchestrator (Act 3) ---- */
async function orchestrateReveal(data) {
  const $header = document.querySelector('.header');

  // 1. Resolve logo "found" confirmation pulse
  clearSearchingDots();
  await resolveLogoToFound();

  // 2. Render the result card (still hidden)
  renderResult(data);

  // 3. Position step-track to result view instantly (under the overlay)
  goToStepInstant(1);

  // 4. Show result card with scale-in animation
  if ($resultCard) {
    $resultCard.style.display = 'flex';
    $resultCard.style.opacity = '0';
    $resultCard.style.transform = 'scale(0.95)';
  }

  // 5. Crossfade: fade out overlay while fading in result
  if ($loadingState) {
    $loadingState.classList.add('loading-state--fading');
  }

  // Small delay for crossfade to begin, then animate result in
  await new Promise(r => setTimeout(r, 50));

  if ($resultCard) {
    $resultCard.style.transition = 'opacity 500ms cubic-bezier(0.4, 0, 0.2, 1), transform 500ms cubic-bezier(0.34, 1.56, 0.64, 1)';
    $resultCard.style.opacity = '1';
    $resultCard.style.transform = 'scale(1)';
  }

  // 6. Restore header
  if ($header) $header.style.opacity = '';

  // 7. After transitions complete, clean up
  await new Promise(r => setTimeout(r, 550));

  // Stop particles, remove overlay, clean up
  stopParticles();
  cleanupLoadingLogo();

  const $step0 = document.querySelector('.step[data-step="0"]');
  if ($step0) $step0.classList.remove('step--defocused');

  if ($loadingState) {
    $loadingState.style.display = 'none';
    $loadingState.classList.remove('loading-state--fading');
    $loadingState.style.opacity = '';
  }

  // Clean up result card inline transitions
  if ($resultCard) {
    $resultCard.style.transition = '';
    $resultCard.style.transform = '';
  }
}

/* ---- Result Rendering ---- */
function renderResult(data) {
  if (!data?.restaurant) return;
  const r = data.restaurant;

  // Cancel any in-flight animation timeouts from a previous render
  animationTimers.forEach(clearTimeout);
  animationTimers = [];

  // Cuisine detection (for accent color + Details tile)
  const cuisine = getCuisineFromResult(data);

  // Cuisine accent color on card border
  if ($resultCard && cuisine.hue !== null) {
    $resultCard.classList.add('result-card--cuisine-accent');
    $resultCard.style.setProperty('--cuisine-hue', cuisine.hue);
  } else if ($resultCard) {
    $resultCard.classList.remove('result-card--cuisine-accent');
  }

  // Name and oneliner (one-liner hidden by default, revealed on name click)
  const $name = document.getElementById('result-name');
  const $oneliner = document.getElementById('result-oneliner');
  if ($name) $name.textContent = r.name || '';
  if ($oneliner) {
    $oneliner.textContent = r.best_for_oneliner || '';
    $oneliner.classList.remove('result-oneliner--visible');
  }
  // Toggle one-liner on name click
  if ($name && $oneliner && r.best_for_oneliner) {
    $name.onclick = () => $oneliner.classList.toggle('result-oneliner--visible');
  }

  // Navigation tile (immediately after name — "What? Where? Why?" flow)
  const $navTileContainer = document.getElementById('result-nav-tile');
  if ($navTileContainer) {
    $navTileContainer.innerHTML = '';
    if (r.address) {
      const mapsUrl = buildMapsUrl(r.address);
      $navTileContainer.innerHTML = `
        <a class="nav-tile__link" href="${mapsUrl}" target="_blank" rel="noopener noreferrer">
          <span class="nav-tile__icon">${svgIcon('pin', 24)}</span>
          <span class="nav-tile__content">
            <span class="nav-tile__label type-data--sm">Navigation</span>
            <span class="nav-tile__address type-structural">${r.address}</span>
          </span>
          <span class="nav-tile__arrow">${svgIcon('chevronRight', 20)}</span>
        </a>`;
      $navTileContainer.style.display = '';
    } else {
      $navTileContainer.style.display = 'none';
    }
  }

  // Recommendation (chaos-to-order text reveal + collapsible)
  const $rec = document.getElementById('result-recommendation');
  if ($rec) {
    $rec.classList.remove('result-recommendation--expanded');
    chaosToOrderReveal($rec, data.recommendation || '');

    // Show "Read more" toggle only if text overflows 7-line clamp
    const $recToggle = document.getElementById('result-rec-toggle');
    if ($recToggle) {
      $recToggle.setAttribute('aria-expanded', 'false');
      $recToggle.textContent = 'Read more';
      requestAnimationFrame(() => {
        const isClamped = $rec.scrollHeight > $rec.clientHeight + 2;
        $recToggle.style.display = isClamped ? '' : 'none';
      });
    }
  }

  // ---- Score Tile (DondeAI Score) ----
  const tier = getScoreTier(data.donde_score);
  const $verdict = document.getElementById('score-verdict');
  const $scoreTileDonde = document.getElementById('score-tile-donde');
  const $percentile = document.getElementById('score-percentile');
  if ($verdict) {
    $verdict.textContent = tier.verdict;
    $verdict.className = `score-verdict type-structural--bold ${tier.cssClass}`;
  }
  if ($scoreTileDonde) {
    $scoreTileDonde.setAttribute('data-tier', tier.tier);
    $scoreTileDonde.classList.add('score-tile--expandable');
    $scoreTileDonde.setAttribute('tabindex', '0');
    $scoreTileDonde.setAttribute('role', 'button');
    $scoreTileDonde.setAttribute('aria-label', 'Expand DondeAI Score');
  }
  if ($percentile) $percentile.textContent = `Top ${Math.round((tier.integer / 10) * 100)}%`;
  // Delay score ring to after tile entrance
  animationTimers.push(setTimeout(() => animateScoreRing(data.donde_score), 800));

  // ---- Google Rating Tile ----
  const $googleStars = document.getElementById('google-stars');
  const $googleNum = document.getElementById('google-rating-num');
  const $googleCount = document.getElementById('google-count');
  const $scoreTileGoogle = document.getElementById('score-tile-google');
  if (r.google_rating) {
    if ($googleStars) $googleStars.innerHTML = buildGoogleStars(r.google_rating);
    if ($googleCount) $googleCount.textContent = r.google_review_count ? `(${r.google_review_count})` : '';
    if ($scoreTileGoogle) $scoreTileGoogle.style.display = '';
    // Make tile link to Google Reviews if place_id available
    if ($scoreTileGoogle && r.google_place_id) {
      const reviewsUrl = `https://www.google.com/maps/place/?q=place_id:${r.google_place_id}`;
      $scoreTileGoogle.setAttribute('tabindex', '0');
      $scoreTileGoogle.setAttribute('role', 'link');
      $scoreTileGoogle.setAttribute('aria-label', 'View on Google Maps');
      const oldHint = $scoreTileGoogle.querySelector('.score-tile__link-hint');
      if (oldHint) oldHint.remove();
      const hint = document.createElement('span');
      hint.className = 'score-tile__link-hint type-data--sm';
      hint.textContent = 'View on Google';
      $scoreTileGoogle.appendChild(hint);
      $scoreTileGoogle.onclick = () => window.open(reviewsUrl, '_blank', 'noopener,noreferrer');
      $scoreTileGoogle.onkeydown = (e) => {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); window.open(reviewsUrl, '_blank', 'noopener,noreferrer'); }
      };
    }
    animationTimers.push(setTimeout(() => animateGoogleRating(r.google_rating), 900));
  } else {
    if ($scoreTileGoogle) $scoreTileGoogle.style.display = 'none';
  }

  // ---- Radar Tile ----
  const $scoreTileRadar = document.getElementById('score-tile-radar');
  if ($scoreTileRadar) {
    $scoreTileRadar.style.display = '';
    $scoreTileRadar.classList.add('score-tile--expandable');
    $scoreTileRadar.setAttribute('tabindex', '0');
    $scoreTileRadar.setAttribute('role', 'button');
    $scoreTileRadar.setAttribute('aria-label', 'Expand Vibe Profile');
  }
  renderRadar(data.scores || {}, r);

  // ---- Profile Block: Facts (all neutral badges — Cuisine, Price, Parking, Noise, Ambiance, Dress) ----
  const $profileFacts = document.getElementById('profile-facts');
  if ($profileFacts) {
    $profileFacts.innerHTML = '';
    const badges = [];

    if (r.cuisine_type) {
      badges.push({ icon: cuisine.icon || 'plate', label: 'Cuisine', value: r.cuisine_type });
    }
    if (r.price_level) {
      badges.push({ icon: 'tag', label: 'Price', value: r.price_level });
    }
    if (r.parking_availability) {
      parseParkingTypes(r.parking_availability).forEach(pt => {
        badges.push({ icon: 'car', label: 'Parking', value: pt });
      });
    }
    if (r.noise_level) {
      badges.push({ icon: 'speakerWave', label: 'Noise', value: r.noise_level.split(/[\s,]+/).slice(0, 2).join(' ') });
    }
    if (r.lighting_ambiance) {
      badges.push({ icon: 'sun', label: 'Ambiance', value: r.lighting_ambiance });
    }
    if (r.dress_code) {
      badges.push({ icon: 'shirt', label: 'Dress', value: r.dress_code });
    }

    badges.forEach(b => {
      const div = document.createElement('div');
      div.className = 'details-badge';
      div.innerHTML = `
        <span class="details-badge__icon">${svgIcon(b.icon, 16)}</span>
        <span class="details-badge__label type-data--sm">${b.label}</span>
        <span class="details-badge__value type-structural">${b.value}</span>`;
      if (b.label === 'Parking') div.setAttribute('title', r.parking_availability);
      $profileFacts.appendChild(div);
    });

    $profileFacts.style.display = badges.length > 0 ? '' : 'none';
  }

  // ---- Quick Links (Website, Call, Share) ----
  const $resultLinks = document.getElementById('result-links');
  if ($resultLinks) {
    $resultLinks.innerHTML = '';
    if (r.website) {
      let hostname = 'Visit';
      try { hostname = new URL(r.website).hostname.replace('www.', ''); } catch { /* keep fallback */ }
      $resultLinks.appendChild(createResultLink('a', 'globe', hostname, r.website));
    }
    if (r.phone) {
      $resultLinks.appendChild(createResultLink('a', 'phone', r.phone, `tel:${r.phone}`));
    }
    const shareLink = createResultLink('button', 'shareNetwork', 'Share');
    shareLink.setAttribute('data-action', 'share');
    $resultLinks.appendChild(shareLink);
  }

  // Insider tip
  const $tip = document.getElementById('insider-tip');
  const $tipText = document.getElementById('insider-tip-text');
  if ($tip && data.insider_tip) {
    $tipText.textContent = data.insider_tip;
    $tip.style.display = 'block';
  } else if ($tip) {
    $tip.style.display = 'none';
  }

  // ---- Profile Block: Atmosphere (boolean features only — ambiance/dress moved to badge grid) ----
  const $profileAtmo = document.getElementById('profile-atmosphere');
  if ($profileAtmo) {
    $profileAtmo.innerHTML = '';
    const atmoItems = [];
    if (r.outdoor_seating) atmoItems.push({ icon: 'patio', label: 'Patio' });
    if (r.live_music) atmoItems.push({ icon: 'music', label: 'Live Music' });
    if (r.pet_friendly) atmoItems.push({ icon: 'pet', label: 'Pet Friendly' });

    atmoItems.forEach(a => {
      const span = document.createElement('span');
      span.className = 'atmo-tag';
      span.innerHTML = `<span class="atmo-tag__icon">${svgIcon(a.icon, 14)}</span><span class="type-data--sm">${a.label}</span>`;
      $profileAtmo.appendChild(span);
    });

    $profileAtmo.style.display = atmoItems.length > 0 ? '' : 'none';

    // Spring pop stagger for atmosphere tags
    const REDUCED_MQ = matchMedia('(prefers-reduced-motion: reduce)');
    if (!REDUCED_MQ.matches && atmoItems.length > 0) {
      const allTags = $profileAtmo.querySelectorAll('.atmo-tag');
      allTags.forEach((tag, i) => {
        tag.style.opacity = '0';
        tag.style.transform = 'scale(0.8)';
        animationTimers.push(setTimeout(() => {
          tag.style.transition = 'opacity 200ms ease-out, transform 300ms cubic-bezier(0.34, 1.56, 0.64, 1)';
          tag.style.opacity = '1';
          tag.style.transform = 'scale(1)';
        }, 980 + i * 60));
      });
    }
  }

  // ---- Profile Block: Sentiment (with legend + score label) ----
  const $sentSection = document.getElementById('profile-sentiment');
  if ($sentSection && r.sentiment_breakdown) {
    $sentSection.style.display = 'block';
    const parts = r.sentiment_breakdown.toLowerCase();
    const posMatch = parts.match(/positive[:\s]+(\d+)/);
    const neuMatch = parts.match(/neutral[:\s]+(\d+)/);
    const negMatch = parts.match(/negative[:\s]+(\d+)/);
    const posVal = posMatch?.[1] || '33';
    const neuVal = neuMatch?.[1] || '34';
    const negVal = negMatch?.[1] || '33';

    const $pos = document.getElementById('sentiment-pos');
    const $neu = document.getElementById('sentiment-neu');
    const $neg = document.getElementById('sentiment-neg');
    if ($pos) $pos.style.width = `${posVal}%`;
    if ($neu) $neu.style.width = `${neuVal}%`;
    if ($neg) $neg.style.width = `${negVal}%`;

    // Populate legend labels
    const $scoreLabel = document.getElementById('sentiment-score-label');
    const $posPct = document.getElementById('sentiment-pos-pct');
    const $neuPct = document.getElementById('sentiment-neu-pct');
    const $negPct = document.getElementById('sentiment-neg-pct');
    if ($scoreLabel) $scoreLabel.textContent = `${posVal}% Positive`;
    if ($posPct) $posPct.textContent = `${posVal}%`;
    if ($neuPct) $neuPct.textContent = `${neuVal}%`;
    if ($negPct) $negPct.textContent = `${negVal}%`;
  } else if ($sentSection) {
    $sentSection.style.display = 'none';
  }

  // Hide entire profile block if no sub-sections have content
  const $profile = document.getElementById('result-profile');
  if ($profile) {
    const hasContent = ($profileFacts && $profileFacts.style.display !== 'none' && $profileFacts.children.length > 0)
      || ($profileAtmo && $profileAtmo.style.display !== 'none' && $profileAtmo.children.length > 0)
      || ($sentSection && $sentSection.style.display !== 'none');
    $profile.style.display = hasContent ? '' : 'none';
  }

  // Inject icons into result action buttons (Try Another / Start Over)
  const $tryAgainIcon = document.getElementById('try-again-icon');
  const $startOverIcon = document.getElementById('start-over-icon');
  if ($tryAgainIcon) $tryAgainIcon.innerHTML = svgIcon('refresh', 18);
  if ($startOverIcon) $startOverIcon.innerHTML = svgIcon('home', 18);


  // Apply progressive reveal classes (visual stagger within the card)
  if ($resultCard) {
    $resultCard.classList.remove('card-enter', 'result-card--revealing');
    void $resultCard.offsetWidth;
    $resultCard.classList.add('result-card--revealing');

    // Clean up reveal class after all sections have animated
    setTimeout(() => {
      $resultCard.classList.remove('result-card--revealing');
      $resultCard.querySelectorAll(':scope > *, .score-tile').forEach(child => {
        child.style.opacity = '';
        child.style.transform = '';
      });
    }, 1600);
  }
  // Note: show/hide of loading overlay and result card is handled by orchestrateReveal()
}

/* ---- Parking Type Parser ---- */
function parseParkingTypes(parkingStr) {
  if (!parkingStr) return [];
  const lower = parkingStr.toLowerCase();
  const types = [];
  if (lower.includes('street')) types.push('Street');
  if (lower.includes('lot') || lower.includes('garage')) types.push('Lot');
  if (lower.includes('valet')) types.push('Valet');
  if (lower.includes('metered')) types.push('Metered');
  if (types.length === 0) types.push(parkingStr.split(/\s+/).slice(0, 2).join(' '));
  return types;
}

/* Badge color helpers removed — all badges use neutral styling ("Ink Rule"). */

/* ---- Tile Expand Modal ---- */
function openTileExpand(tileEl) {
  const $modal = document.getElementById('tile-expand');
  const $content = document.getElementById('tile-expand-content');
  if (!$modal || !$content) return;

  $content.innerHTML = '';
  const state = getState();
  const data = state.result;
  if (!data) return;

  if (tileEl.id === 'score-tile-donde') {
    const tier = getScoreTier(data.donde_score);
    const n = Math.round(parseFloat(data.donde_score) || 8);
    const circumference = 2 * Math.PI * 45;
    const offset = circumference - (n / 10) * circumference;
    const strokeColor = 'var(--ac)';
    $content.innerHTML = `
      <span class="score-tile__label type-data--sm">DondeAI Score</span>
      <div class="score-ring-wrap">
        <svg class="score-ring" viewBox="0 0 100 100">
          <circle class="score-ring__bg" cx="50" cy="50" r="45"></circle>
          <circle class="score-ring__fill" cx="50" cy="50" r="45"
            style="stroke: ${strokeColor}; stroke-dasharray: ${circumference}; stroke-dashoffset: ${offset}"></circle>
        </svg>
        <div class="score-ring__number">
          <span class="type-data--lg" style="font-size: var(--text-2xl);">${n}</span>
        </div>
      </div>
      <span class="score-verdict type-structural--bold ${tier.cssClass}" style="font-size: var(--text-lg);">${tier.verdict}</span>
      <span class="score-percentile type-data--sm">Top ${Math.round((tier.integer / 10) * 100)}%</span>`;
  } else if (tileEl.id === 'score-tile-radar') {
    const existingSvg = document.getElementById('radar-svg');
    $content.innerHTML = `
      <span class="score-tile__label type-data--sm">Vibe Profile</span>
      <div class="radar-wrap">
        <svg viewBox="0 0 200 200">${existingSvg ? existingSvg.innerHTML : ''}</svg>
      </div>`;
  }

  $modal.classList.add('tile-expand--open');
  $modal.querySelector('.tile-expand__close')?.focus();
  announce('Score details expanded');
}

function closeTileExpand() {
  const $modal = document.getElementById('tile-expand');
  if ($modal) {
    $modal.classList.remove('tile-expand--open');
    // Return focus to the tile that was expanded
    document.querySelector('.score-tile--expandable')?.focus();
  }
}

/* ---- Quick Link Helper ---- */
function createResultLink(tag, icon, label, href) {
  const el = document.createElement(tag);
  el.className = 'result-link type-structural';
  if (tag === 'a' && href) {
    el.href = href;
    el.target = '_blank';
    el.rel = 'noopener noreferrer';
  }
  if (tag === 'button') el.type = 'button';
  el.innerHTML = `${svgIcon(icon, 14)}<span>${label}</span>`;
  return el;
}

/* ---- Toast ---- */
let toastTimer = null;

function showToast(message, isError = false) {
  if (!$toast || !$toastText) return;

  // Clear any pending dismiss
  if (toastTimer) clearTimeout(toastTimer);

  $toastText.textContent = message;
  $toast.classList.toggle('toast--error', isError);

  // Switch aria-live based on severity
  $toast.setAttribute('aria-live', isError ? 'assertive' : 'polite');
  $toast.setAttribute('role', isError ? 'alert' : 'status');

  // Show/hide dismiss button for errors (they linger longer)
  const $dismiss = document.getElementById('toast-dismiss');
  if ($dismiss) {
    $dismiss.style.display = isError ? 'flex' : 'none';
  }

  $toast.classList.add('toast--visible');

  // Auto-dismiss: errors stay longer
  const duration = isError ? 6000 : 3500;
  toastTimer = setTimeout(() => dismissToast(), duration);
}

function dismissToast() {
  if (!$toast) return;
  $toast.classList.remove('toast--visible');
  if (toastTimer) {
    clearTimeout(toastTimer);
    toastTimer = null;
  }
}

/* ---- Swipe Gestures ---- */
function wireSwipe() {
  let startX = 0;
  let startY = 0;
  let isDragging = false;
  const THRESHOLD = 50;

  $main?.addEventListener('touchstart', (e) => {
    startX = e.touches[0].clientX;
    startY = e.touches[0].clientY;
    isDragging = true;
  }, { passive: true });

  $main?.addEventListener('touchend', (e) => {
    if (!isDragging) return;
    isDragging = false;

    const dx = e.changedTouches[0].clientX - startX;
    const dy = e.changedTouches[0].clientY - startY;

    if (Math.abs(dx) < THRESHOLD || Math.abs(dy) > Math.abs(dx)) return;

    const { step } = getState();

    // Only allow swipe-right on result to go back to canvas
    if (dx > 0 && step === 1) {
      goToStep(0);
    }
  }, { passive: true });
}

/* ---- Cursor Glow (Desktop only) ---- */
function initCursorGlow() {
  if (!$cursorGlow) return;
  // Skip on touch devices and reduced motion
  if (matchMedia('(hover: none)').matches || matchMedia('(prefers-reduced-motion: reduce)').matches) return;

  let targetX = 0, targetY = 0, currentX = 0, currentY = 0;
  let active = false;

  document.addEventListener('mousemove', (e) => {
    targetX = e.clientX;
    targetY = e.clientY;
    if (!active) {
      active = true;
      $cursorGlow.style.opacity = '0.2';
      lerpGlow();
    }
  }, { passive: true });

  document.addEventListener('mouseleave', () => {
    active = false;
    $cursorGlow.style.opacity = '0';
  });

  function lerpGlow() {
    if (!active) return;
    currentX += (targetX - currentX) * 0.15;
    currentY += (targetY - currentY) * 0.15;
    $cursorGlow.style.transform = `translate(${currentX - 100}px, ${currentY - 100}px)`;
    requestAnimationFrame(lerpGlow);
  }
}


/* ---- Share Canvas Rendering ---- */
function renderShareCanvas(format = 'post') {
  const canvas = document.getElementById('share-canvas');
  if (!canvas) return;

  const { result } = getState();
  if (!result?.restaurant) return;

  const isStory = format === 'story';
  const w = isStory ? 540 : 600;
  const h = isStory ? 960 : 600;
  canvas.width = w;
  canvas.height = h;

  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  // Get theme colors from computed styles
  const styles = getComputedStyle(document.documentElement);
  const bg = styles.getPropertyValue('--bg').trim() || '#fafafa';
  const fg = styles.getPropertyValue('--fg').trim() || '#1a1a1a';
  const ac = styles.getPropertyValue('--ac').trim() || '#6c5ce7';
  const fg2 = styles.getPropertyValue('--fg2').trim() || '#666';

  // Background
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, w, h);

  // Accent gradient bar at top
  ctx.fillStyle = ac;
  ctx.fillRect(0, 0, w, 6);

  const r = result.restaurant;
  const score = Math.round(parseFloat(result.donde_score) || 8);
  const pad = 40;
  let y = isStory ? 120 : 80;

  // Restaurant name (large serif)
  ctx.fillStyle = fg;
  ctx.font = `700 ${isStory ? 36 : 32}px "Playfair Display", serif`;
  ctx.textAlign = 'left';

  // Word wrap name
  const nameWords = (r.name || 'Restaurant').split(' ');
  let nameLine = '';
  for (const word of nameWords) {
    const test = nameLine ? `${nameLine} ${word}` : word;
    if (ctx.measureText(test).width > w - pad * 2) {
      ctx.fillText(nameLine, pad, y);
      y += isStory ? 44 : 40;
      nameLine = word;
    } else {
      nameLine = test;
    }
  }
  ctx.fillText(nameLine, pad, y);
  y += isStory ? 32 : 28;

  // One-liner
  if (r.best_for_oneliner) {
    ctx.font = `italic 400 ${isStory ? 18 : 16}px "Playfair Display", serif`;
    ctx.fillStyle = fg2;
    y += 12;
    ctx.fillText(r.best_for_oneliner.slice(0, 60), pad, y);
    y += 28;
  }

  // Score circle (integer)
  y += 20;
  const scoreX = pad + 36;
  const scoreY = y + 20;
  ctx.beginPath();
  ctx.arc(scoreX, scoreY, 32, 0, Math.PI * 2);
  ctx.fillStyle = ac;
  ctx.globalAlpha = 0.12;
  ctx.fill();
  ctx.globalAlpha = 1;

  ctx.fillStyle = fg;
  ctx.font = `700 28px "JetBrains Mono", monospace`;
  ctx.textAlign = 'center';
  ctx.fillText(String(score), scoreX, scoreY + 10);

  // Score label
  ctx.textAlign = 'left';
  ctx.font = `600 14px "Inter", sans-serif`;
  ctx.fillStyle = fg2;
  ctx.fillText('DondeAI Score', scoreX + 44, scoreY + 4);

  y += 80;

  // Branding
  ctx.fillStyle = fg2;
  ctx.font = `italic 500 14px "Playfair Display", serif`;
  ctx.textAlign = 'right';
  ctx.fillText('via DondeAI', w - pad, h - pad);
}

// Expose for share module
window.renderShareCanvas = renderShareCanvas;

/* ---- Boot ---- */
init();
