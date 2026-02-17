/* ============================================
   DondeAI — Main Orchestrator
   Single-canvas layout: Canvas + Result.
   ============================================ */

import { getState, setState, subscribe, resetState } from './state.js';
import { initRouter, goToStep } from './router.js';
import { loadTheme, loadSound, loadHistory } from './persistence.js';
import { addToHistory } from './persistence.js';
import { initTheme, setTheme, getLabels, CULTURES, CULTURE_DISPLAY_NAMES } from './theme.js';
import { initAudio, toggleSound, playChime } from './audio.js';
import { initVoice, startVoice } from './voice.js';
import { initShare, shareResult, closeShareSheet, handleShareChannel } from './share.js';
import { initOffline, isOnline } from './offline.js';
import { initAccessibility, announce } from './accessibility.js';
import { fetchRecommendation } from './api.js';
import { animateScoreRing, renderRadar, startParticles, stopParticles } from './animations.js';
import {
  getGreeting, getQuickPicks, getCuisineFromResult,
  getScoreTier, getScoreColor, buildGoogleStars, buildMapsUrl, relativeTime, matchCuisine
} from './utils.js';

/* ---- SVG Icon Templates ---- */
const ICONS = {
  globe: '<path fill="currentColor" d="M128,28h0A100,100,0,1,0,228,128,100.11,100.11,0,0,0,128,28Zm0,190.61c-6.33-6.09-23-24.41-31.27-54.61h62.54C151,194.2,134.33,212.52,128,218.61ZM94.82,156a140.42,140.42,0,0,1,0-56h66.36a140.42,140.42,0,0,1,0,56ZM128,37.39c6.33,6.09,23,24.41,31.27,54.61H96.73C105,61.8,121.67,43.48,128,37.39ZM169.41,100h46.23a92.09,92.09,0,0,1,0,56H169.41a152.65,152.65,0,0,0,0-56Zm43.25-8h-45a129.39,129.39,0,0,0-29.19-55.4A92.25,92.25,0,0,1,212.66,92ZM117.54,36.6A129.39,129.39,0,0,0,88.35,92h-45A92.25,92.25,0,0,1,117.54,36.6ZM40.36,100H86.59a152.65,152.65,0,0,0,0,56H40.36a92.09,92.09,0,0,1,0-56Zm3,64h45a129.39,129.39,0,0,0,29.19,55.4A92.25,92.25,0,0,1,43.34,164Zm95.12,55.4A129.39,129.39,0,0,0,167.65,164h45A92.25,92.25,0,0,1,138.46,219.4Z"/>',
  phone: '<path fill="currentColor" d="M220.78,162.13,173.56,141A12,12,0,0,0,162.18,142a3.37,3.37,0,0,0-.38.28L137,163.42a3.93,3.93,0,0,1-3.7.21c-16.24-7.84-33.05-24.52-40.89-40.57a3.9,3.9,0,0,1,.18-3.69l21.2-25.21c.1-.12.19-.25.28-.38a12,12,0,0,0,1-11.36L93.9,35.28a12,12,0,0,0-12.48-7.19A52.25,52.25,0,0,0,36,80c0,77.2,62.8,140,140,140a52.25,52.25,0,0,0,51.91-45.42A12,12,0,0,0,220.78,162.13ZM220,173.58A44.23,44.23,0,0,1,176,212C103.22,212,44,152.78,44,80A44.23,44.23,0,0,1,82.42,36a3.87,3.87,0,0,1,.48,0,4,4,0,0,1,3.67,2.49l21.11,47.14a4,4,0,0,1-.23,3.6l-21.19,25.2c-.1.13-.2.25-.29.39a12,12,0,0,0-.78,11.75c8.69,17.79,26.61,35.58,44.6,44.27a12,12,0,0,0,11.79-.87l.37-.28,24.83-21.12a3.93,3.93,0,0,1,3.57-.27l47.21,21.16A4,4,0,0,1,220,173.58Z"/>',
  star: '<path fill="currentColor" d="M235.36,98.49A12.21,12.21,0,0,0,224.59,90l-61.47-5L139.44,27.67a12.37,12.37,0,0,0-22.88,0L92.88,85,31.41,90a12.45,12.45,0,0,0-7.07,21.84l46.85,40.41L56.87,212.64a12.35,12.35,0,0,0,18.51,13.49L128,193.77l52.62,32.36a12.12,12.12,0,0,0,13.69-.51,12.28,12.28,0,0,0,4.82-13l-14.32-60.42,46.85-40.41A12.29,12.29,0,0,0,235.36,98.49Zm-8.93,7.26-48.68,42a4,4,0,0,0-1.28,3.95l14.87,62.79a4.37,4.37,0,0,1-1.72,4.65,4.24,4.24,0,0,1-4.81.18L130.1,185.67a4,4,0,0,0-4.2,0L71.19,219.32a4.24,4.24,0,0,1-4.81-.18,4.37,4.37,0,0,1-1.72-4.65L79.53,151.7a4,4,0,0,0-1.28-3.95l-48.68-42A4.37,4.37,0,0,1,28.25,101a4.31,4.31,0,0,1,3.81-3L96,92.79a4,4,0,0,0,3.38-2.46L124,30.73a4.35,4.35,0,0,1,8.08,0l24.62,59.6A4,4,0,0,0,160,92.79l63.9,5.15a4.31,4.31,0,0,1,3.81,3A4.37,4.37,0,0,1,226.43,105.75Z"/>',
  shareNetwork: '<path fill="currentColor" d="M176,164a36,36,0,0,0-27.92,13.3L96.25,144a35.92,35.92,0,0,0,0-32L148.08,78.7A35.93,35.93,0,1,0,143.75,72L91.92,105.3a36,36,0,1,0,0,45.4L143.75,184A36,36,0,1,0,176,164Zm0-136a28,28,0,1,1-28,28A28,28,0,0,1,176,28ZM64,156a28,28,0,1,1,28-28A28,28,0,0,1,64,156Zm112,72a28,28,0,1,1,28-28A28,28,0,0,1,176,228Z"/>',
};

/* ---- Cached DOM Elements ---- */
const $app = document.querySelector('.app');
const $main = document.querySelector('.cockpit');
const $cravingInput = document.getElementById('craving-input');
const $loadingState = document.getElementById('loading-state');
const $resultCard = document.getElementById('result-card');
const $particleCanvas = document.getElementById('particle-canvas');
const $toast = document.getElementById('toast');
const $toastText = document.getElementById('toast-text');

/* ---- AbortController for fetch cancellation ---- */
let currentAbort = null;

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

  // Sync CTA disabled state
  updateCtaState();
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

    const emoji = document.createElement('span');
    emoji.className = 'taste-memory__emoji';
    emoji.textContent = entry.cuisineEmoji || '🍽️';
    item.appendChild(emoji);

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
        if (getState().loading) setState({ loading: false });
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

      case 'quick-pick': {
        const val = btn.dataset.value;
        if ($cravingInput) $cravingInput.value = val;
        setState({ craving: val });
        if (val === 'Surprise me!') {
          handleSubmit();
        }
        // Otherwise just sets the text, user can submit or add filters
        updateCtaState();
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
    }
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
  if ($cta) {
    $cta.disabled = !$cravingInput?.value.trim();
  }
}

/* ---- Filter Selection ---- */
function selectFilter(field, btn) {
  const group = btn.closest('[role="radiogroup"]') || btn.closest('.filter-pills');
  if (!group) return;

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
  goToStep(1);

  try {
    const data = await fetchRecommendation({
      special_request: s.craving,
      occasion: s.occasion,
      neighborhood: s.neighborhood,
      price_level: s.priceLevel,
    });

    // Save to history with cuisine emoji
    const cuisine = getCuisineFromResult(data);
    const label = s.craving.slice(0, 30);
    const hist = addToHistory(label, {
      special_request: s.craving,
      occasion: s.occasion,
      neighborhood: s.neighborhood,
      price_level: s.priceLevel,
    }, cuisine.emoji);

    setState({ result: data, loading: false, history: hist });
    playChime();
    announce(`Recommendation: ${data.restaurant?.name || 'found'}`);
  } catch (err) {
    if (err.name === 'AbortError') return; // user navigated away
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
  const $scoreSection = document.querySelector('.score-section');
  const $percentile = document.getElementById('score-percentile');
  if ($verdict) {
    $verdict.textContent = tier.verdict;
    $verdict.className = `score-verdict type-structural--bold ${tier.cssClass}`;
  }
  if ($scoreSection) $scoreSection.setAttribute('data-tier', tier.tier);
  if ($percentile) $percentile.textContent = `Top ${Math.round((score / 10) * 100)}%`;
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
      items.push({ label: 'Address', value: r.address, href: buildMapsUrl(r.address) });
    }
    if (r.price_level) items.push({ label: 'Price', value: r.price_level });
    if (r.noise_level) items.push({ label: 'Noise', value: r.noise_level });
    if (r.parking_availability) items.push({ label: 'Parking', value: r.parking_availability });
    if (r.lighting_ambiance) items.push({ label: 'Ambiance', value: r.lighting_ambiance });
    if (r.dress_code) items.push({ label: 'Dress Code', value: r.dress_code });

    items.forEach(item => {
      const div = document.createElement('div');
      div.className = 'info-item';

      const label = document.createElement('span');
      label.className = 'info-item__label type-data--sm';
      label.textContent = item.label;
      div.appendChild(label);

      const val = document.createElement('span');
      val.className = 'info-item__value type-structural';
      if (item.href) {
        const a = document.createElement('a');
        a.href = item.href;
        a.target = '_blank';
        a.rel = 'noopener noreferrer';
        a.style.cssText = 'color: var(--ac); text-decoration: underline;';
        a.textContent = item.value;
        val.appendChild(a);
      } else {
        val.textContent = item.value;
      }
      div.appendChild(val);

      $infoGrid.appendChild(div);
    });
  }

  // Atmosphere tags
  const $atmoTags = document.getElementById('atmosphere-tags');
  if ($atmoTags) {
    $atmoTags.innerHTML = '';
    const atmoItems = [];
    if (r.outdoor_seating) atmoItems.push({ icon: '\u{1F33F}', label: 'Patio' });
    if (r.live_music) atmoItems.push({ icon: '\u{1F3B5}', label: 'Live Music' });
    if (r.pet_friendly) atmoItems.push({ icon: '\u{1F43E}', label: 'Pet Friendly' });

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

  // Action buttons (using inline SVG icons)
  const $actionBtns = document.getElementById('action-btns');
  if ($actionBtns) {
    $actionBtns.innerHTML = '';

    if (r.website) {
      $actionBtns.appendChild(createActionBtn(ICONS.globe, 'Website', r.website));
    }
    if (r.phone) {
      $actionBtns.appendChild(createActionBtn(ICONS.phone, 'Call', `tel:${r.phone}`));
    }
    if (r.google_place_id) {
      const reviewsUrl = `https://www.google.com/maps/place/?q=place_id:${r.google_place_id}`;
      $actionBtns.appendChild(createActionBtn(ICONS.star, 'Reviews', reviewsUrl));
    }

    // Share button
    const shareBtn = document.createElement('button');
    shareBtn.className = 'action-btn type-structural';
    shareBtn.setAttribute('data-action', 'share');
    shareBtn.innerHTML = `<svg viewBox="0 0 256 256" width="18" height="18">${ICONS.shareNetwork}</svg> <span data-label="share">Share</span>`;
    $actionBtns.appendChild(shareBtn);
  }

  // Show the card
  if ($resultCard) {
    $resultCard.style.display = 'flex';
    $resultCard.classList.remove('card-enter');
    void $resultCard.offsetWidth;
    $resultCard.classList.add('card-enter');
  }
  if ($loadingState) $loadingState.style.display = 'none';
}

function createActionBtn(iconSvg, label, href) {
  const a = document.createElement('a');
  a.className = 'action-btn type-structural';
  a.href = href;
  a.target = '_blank';
  a.rel = 'noopener noreferrer';
  a.innerHTML = `<svg viewBox="0 0 256 256" width="18" height="18">${iconSvg}</svg> ${label}`;
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

/* ---- Share Canvas Rendering (Enhancement 10) ---- */
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
  const score = parseFloat(result.donde_score) || 0;
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

  // Score circle
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
  ctx.fillText(score.toFixed(1), scoreX, scoreY + 10);

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
