/* ============================================
   DondeAI — Main Orchestrator
   Initializes all modules, manages event flow.
   ============================================ */

import { getState, setState, subscribe, resetState } from './state.js';
import { initRouter, goToStep } from './router.js';
import { loadTheme, loadSound, loadHistory } from './persistence.js';
import { addToHistory } from './persistence.js';
import { initTheme, setTheme, getLabels } from './theme.js';
import { initAudio, toggleSound, playChime } from './audio.js';
import { initVoice, startVoice } from './voice.js';
import { initShare, shareResult, closeShareSheet, handleShareChannel } from './share.js';
import { initOffline, isOnline } from './offline.js';
import { initAccessibility, announce } from './accessibility.js';
import { fetchRecommendation } from './api.js';
import { animateScoreRing, renderRadar, startParticles, stopParticles } from './animations.js';
import {
  getGreeting, getQuickPicks, getCuisineFromResult,
  getScoreTier, getScoreColor, buildGoogleStars, buildMapsUrl
} from './utils.js';

/* ---- Cached DOM Elements ---- */
const $app = document.querySelector('.app');
const $main = document.querySelector('.cockpit');
const $cravingInput = document.getElementById('craving-input');
const $advanceBtn = document.querySelector('.advance-btn');
const $reviewCraving = document.getElementById('review-craving');
const $reviewOccasion = document.getElementById('review-occasion');
const $reviewNeighborhood = document.getElementById('review-neighborhood');
const $reviewBudget = document.getElementById('review-budget');
const $reviewHint = document.getElementById('review-hint');
const $loadingState = document.getElementById('loading-state');
const $resultCard = document.getElementById('result-card');
const $particleCanvas = document.getElementById('particle-canvas');
const $toast = document.getElementById('toast');
const $toastText = document.getElementById('toast-text');

let autoAdvanceTimer = null;

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

  // Set up greeting and quick picks
  setupLanding();

  // Wire event delegation
  wireEvents();

  // Wire craving input
  wireCravingInput();

  // Wire swipe gestures
  wireSwipe();

  // Subscribe to result changes
  subscribe((state, prev) => {
    if (state.result !== prev.result && state.result) {
      renderResult(state.result);
    }
    if (state.loading !== prev.loading) {
      toggleLoading(state.loading);
    }
    if (state.error !== prev.error && state.error) {
      showToast(state.error, true);
    }
  });

  // Push initial history state
  history.replaceState({ step: 0 }, '', '');
}

/* ---- Landing Setup ---- */
function setupLanding() {
  const state = getState();
  const greeting = document.querySelector('[data-step="0"] .step__title');
  if (greeting) greeting.textContent = getGreeting();

  const picks = getQuickPicks(state.history);
  const $pickContainer = document.querySelector('.quick-picks');
  if ($pickContainer) {
    const buttons = $pickContainer.querySelectorAll('.quick-pick');
    picks.forEach((pick, i) => {
      if (buttons[i]) {
        buttons[i].querySelector('.quick-pick__emoji').textContent = pick.emoji;
        buttons[i].querySelector('.quick-pick__label').textContent = pick.label;
        buttons[i].dataset.value = pick.value;
      }
    });
  }
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
        break;

      case 'back':
        goToStep(getState().step - 1);
        break;

      case 'voice':
        startVoice();
        break;

      case 'advance-craving':
        handleCravingAdvance();
        break;

      case 'smart-chip': {
        const val = btn.dataset.value;
        if ($cravingInput) {
          const current = $cravingInput.value.trim();
          $cravingInput.value = current ? `${current}, ${val}` : val;
          setState({ craving: $cravingInput.value });
          updateAdvanceBtn();
        }
        break;
      }

      case 'quick-pick': {
        const val = btn.dataset.value;
        if ($cravingInput) $cravingInput.value = val;
        setState({ craving: val });
        if (val === 'Surprise me!') {
          goToStep(4);
        } else {
          goToStep(1);
        }
        updateReview();
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

      case 'skip':
        goToStep(getState().step + 1);
        break;

      case 'review-edit': {
        const target = parseInt(btn.dataset.target);
        goToStep(target);
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
    }
  });
}

/* ---- Craving Input ---- */
function wireCravingInput() {
  if (!$cravingInput) return;

  $cravingInput.addEventListener('input', () => {
    setState({ craving: $cravingInput.value });
    updateAdvanceBtn();
  });

  $cravingInput.addEventListener('focus', () => {
    const chips = document.querySelector('.smart-chips');
    if (chips) chips.classList.add('smart-chips--visible');
  });

  $cravingInput.addEventListener('blur', () => {
    // Delay to allow chip clicks to register
    setTimeout(() => {
      const chips = document.querySelector('.smart-chips');
      if (chips) chips.classList.remove('smart-chips--visible');
    }, 200);
  });

  $cravingInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleCravingAdvance();
    }
  });
}

function handleCravingAdvance() {
  const val = $cravingInput?.value.trim();
  if (!val) {
    $cravingInput?.focus();
    return;
  }
  setState({ craving: val });
  updateReview();
  goToStep(1);
}

function updateAdvanceBtn() {
  if (!$advanceBtn) return;
  const hasText = $cravingInput?.value.trim().length > 0;
  $advanceBtn.classList.toggle('advance-btn--visible', hasText);
}

/* ---- Filter Selection ---- */
function selectFilter(field, btn) {
  const group = btn.closest('[role="radiogroup"]') || btn.closest('.chip-grid');
  if (!group) return;

  // Deselect siblings
  group.querySelectorAll('.chip').forEach(c => {
    c.setAttribute('aria-checked', 'false');
  });

  // Select this one
  btn.setAttribute('aria-checked', 'true');
  btn.classList.add('chip-pop');
  btn.addEventListener('animationend', () => btn.classList.remove('chip-pop'), { once: true });

  setState({ [field]: btn.dataset.value });
  updateReview();

  // Auto-advance after delay
  clearTimeout(autoAdvanceTimer);
  autoAdvanceTimer = setTimeout(() => {
    const currentStep = getState().step;
    if (currentStep < 4) goToStep(currentStep + 1);
  }, 600);
}

function clearAllSelections() {
  document.querySelectorAll('.chip[aria-checked="true"]').forEach(c => {
    c.setAttribute('aria-checked', 'false');
  });
}

/* ---- Review Update ---- */
function updateReview() {
  const s = getState();
  if ($reviewCraving) $reviewCraving.textContent = s.craving || '—';
  if ($reviewOccasion) $reviewOccasion.textContent = s.occasion;
  if ($reviewNeighborhood) $reviewNeighborhood.textContent = s.neighborhood;
  if ($reviewBudget) $reviewBudget.textContent = s.priceLevel;
}

/* ---- Submit ---- */
async function handleSubmit() {
  const s = getState();

  if (!s.craving.trim()) {
    if ($reviewHint) $reviewHint.classList.add('hint--visible');
    const cravingReview = document.querySelector('[data-target="0"]');
    if (cravingReview) {
      cravingReview.classList.add('shake');
      cravingReview.addEventListener('animationend', () => cravingReview.classList.remove('shake'), { once: true });
    }
    return;
  }

  if ($reviewHint) $reviewHint.classList.remove('hint--visible');

  if (!isOnline()) {
    showToast("You're offline — can't reach the engine.", true);
    return;
  }

  setState({ loading: true, error: null, result: null });
  goToStep(5);

  try {
    const data = await fetchRecommendation({
      special_request: s.craving,
      occasion: s.occasion,
      neighborhood: s.neighborhood,
      price_level: s.priceLevel,
    });

    // Save to history
    const label = s.craving.slice(0, 30);
    const history = addToHistory(label, {
      special_request: s.craving,
      occasion: s.occasion,
      neighborhood: s.neighborhood,
      price_level: s.priceLevel,
    });

    setState({ result: data, loading: false, history });
    playChime();
    announce(`Recommendation: ${data.restaurant?.name || 'found'}`);
  } catch (err) {
    setState({ loading: false, error: err.message });
    goToStep(4);
  }
}

/* ---- Loading Toggle ---- */
function toggleLoading(loading) {
  if ($loadingState) $loadingState.style.display = loading ? 'flex' : 'none';
  if ($resultCard) $resultCard.style.display = loading ? 'none' : 'flex';

  if (loading && $particleCanvas) {
    startParticles($particleCanvas);
  } else {
    stopParticles();
  }
}

/* ---- Result Rendering ---- */
function renderResult(data) {
  if (!data?.restaurant) return;
  const r = data.restaurant;

  // Cuisine badge
  const cuisine = getCuisineFromResult(data);
  const $emoji = document.getElementById('result-emoji');
  const $cuisineLabel = document.getElementById('result-cuisine-label');
  if ($emoji) $emoji.textContent = cuisine.emoji;
  if ($cuisineLabel) $cuisineLabel.textContent = r.cuisine_type || cuisine.label || '';

  // Name and oneliner
  const $name = document.getElementById('result-name');
  const $oneliner = document.getElementById('result-oneliner');
  if ($name) $name.textContent = r.name || '';
  if ($oneliner) $oneliner.textContent = r.best_for_oneliner || '';

  // Recommendation
  const $rec = document.getElementById('result-recommendation');
  if ($rec) $rec.textContent = data.recommendation || '';

  // Score
  const score = parseFloat(data.donde_score) || 0;
  const tier = getScoreTier(score);
  const $verdict = document.getElementById('score-verdict');
  if ($verdict) {
    $verdict.textContent = tier.verdict;
    $verdict.className = `score-verdict type-structural--bold ${tier.cssClass}`;
  }
  animateScoreRing(score);

  // Google rating
  const $googleStars = document.getElementById('google-stars');
  const $googleNum = document.getElementById('google-rating-num');
  const $googleCount = document.getElementById('google-count');
  if (r.google_rating) {
    if ($googleStars) $googleStars.textContent = buildGoogleStars(r.google_rating);
    if ($googleNum) $googleNum.textContent = parseFloat(r.google_rating).toFixed(1);
    if ($googleCount) $googleCount.textContent = r.google_review_count ? `(${r.google_review_count})` : '';
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

  // Radar chart
  if (data.scores) {
    renderRadar(data.scores);
  }

  // Info grid
  const $infoGrid = document.getElementById('info-grid');
  if ($infoGrid) {
    $infoGrid.innerHTML = '';
    const items = [];

    if (r.address) {
      items.push({
        label: 'Address',
        value: `<a href="${buildMapsUrl(r.address)}" target="_blank" rel="noopener" style="color: var(--ac); text-decoration: underline;">${r.address}</a>`,
      });
    }
    if (r.price_level) items.push({ label: 'Price', value: r.price_level });
    if (r.noise_level) items.push({ label: 'Noise', value: r.noise_level });
    if (r.parking_availability) items.push({ label: 'Parking', value: r.parking_availability });
    if (r.lighting_ambiance) items.push({ label: 'Ambiance', value: r.lighting_ambiance });
    if (r.dress_code) items.push({ label: 'Dress Code', value: r.dress_code });

    items.forEach(item => {
      const div = document.createElement('div');
      div.className = 'info-item';
      div.innerHTML = `
        <span class="info-item__label type-data--sm">${item.label}</span>
        <span class="info-item__value type-structural">${item.value}</span>
      `;
      $infoGrid.appendChild(div);
    });
  }

  // Atmosphere tags
  const $atmoTags = document.getElementById('atmosphere-tags');
  if ($atmoTags) {
    $atmoTags.innerHTML = '';
    const atmoItems = [];
    if (r.outdoor_seating) atmoItems.push({ icon: '🌿', label: 'Patio' });
    if (r.live_music) atmoItems.push({ icon: '🎵', label: 'Live Music' });
    if (r.pet_friendly) atmoItems.push({ icon: '🐾', label: 'Pet Friendly' });

    atmoItems.forEach(a => {
      const span = document.createElement('span');
      span.className = 'atmo-tag';
      span.innerHTML = `<span class="atmo-tag__icon">${a.icon}</span><span class="type-data--sm">${a.label}</span>`;
      $atmoTags.appendChild(span);
    });
  }

  // Tags cloud
  const $tags = document.getElementById('tags-cloud');
  if ($tags && data.tags?.length) {
    $tags.innerHTML = '';
    data.tags.forEach(tag => {
      const span = document.createElement('span');
      span.className = 'tag-pill type-data--sm';
      span.textContent = tag;
      $tags.appendChild(span);
    });
  }

  // Sentiment
  const $sentSection = document.getElementById('sentiment-section');
  if ($sentSection && r.sentiment_breakdown) {
    $sentSection.style.display = 'block';
    // Parse "positive: 70%, neutral: 20%, negative: 10%" format
    const parts = r.sentiment_breakdown.toLowerCase();
    const posMatch = parts.match(/positive[:\s]+(\d+)/);
    const neuMatch = parts.match(/neutral[:\s]+(\d+)/);
    const negMatch = parts.match(/negative[:\s]+(\d+)/);
    const $pos = document.getElementById('sentiment-pos');
    const $neu = document.getElementById('sentiment-neu');
    const $neg = document.getElementById('sentiment-neg');
    if ($pos) $pos.style.width = `${posMatch?.[1] || 33}%`;
    if ($neu) $neu.style.width = `${neuMatch?.[1] || 34}%`;
    if ($neg) $neg.style.width = `${negMatch?.[1] || 33}%`;
  } else if ($sentSection) {
    $sentSection.style.display = 'none';
  }

  // Action buttons
  const $actionBtns = document.getElementById('action-btns');
  if ($actionBtns) {
    $actionBtns.innerHTML = '';

    if (r.website) {
      $actionBtns.appendChild(createActionBtn('🌐', 'Website', r.website));
    }
    if (r.phone) {
      $actionBtns.appendChild(createActionBtn('📞', 'Call', `tel:${r.phone}`));
    }
    if (r.google_place_id) {
      const reviewsUrl = `https://www.google.com/maps/place/?q=place_id:${r.google_place_id}`;
      $actionBtns.appendChild(createActionBtn('⭐', 'Reviews', reviewsUrl));
    }

    // Share button
    const shareBtn = document.createElement('button');
    shareBtn.className = 'action-btn type-structural';
    shareBtn.setAttribute('data-action', 'share');
    shareBtn.innerHTML = '📤 <span data-label="share">Share</span>';
    $actionBtns.appendChild(shareBtn);
  }

  // Show the card
  if ($resultCard) {
    $resultCard.style.display = 'flex';
    $resultCard.classList.remove('card-enter');
    // Trigger reflow for re-animation
    void $resultCard.offsetWidth;
    $resultCard.classList.add('card-enter');
  }
  if ($loadingState) $loadingState.style.display = 'none';
}

function createActionBtn(icon, label, href) {
  const a = document.createElement('a');
  a.className = 'action-btn type-structural';
  a.href = href;
  a.target = '_blank';
  a.rel = 'noopener noreferrer';
  a.innerHTML = `${icon} ${label}`;
  return a;
}

/* ---- Toast ---- */
function showToast(message, isError = false) {
  if (!$toast || !$toastText) return;
  $toastText.textContent = message;
  $toast.classList.toggle('toast--error', isError);
  $toast.classList.add('toast--visible');
  setTimeout(() => $toast.classList.remove('toast--visible'), 3500);
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

    const endX = e.changedTouches[0].clientX;
    const endY = e.changedTouches[0].clientY;
    const dx = endX - startX;
    const dy = endY - startY;

    // Only trigger if horizontal swipe dominates
    if (Math.abs(dx) < THRESHOLD || Math.abs(dy) > Math.abs(dx)) return;

    const { step } = getState();

    if (dx < 0 && step < 5) {
      // Swipe left -> next step (only from step 0 if has craving)
      if (step === 0 && !getState().craving.trim()) return;
      goToStep(step + 1);
      updateReview();
    } else if (dx > 0 && step > 0) {
      // Swipe right -> previous step
      goToStep(step - 1);
    }
  }, { passive: true });
}

/* ---- Boot ---- */
init();
