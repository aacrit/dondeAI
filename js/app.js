/* ============================================
   DondeAI — Main Orchestrator
   Single-canvas layout: Canvas + Result.
   ============================================ */

import { getState, setState, subscribe, resetState } from './state.js';
import { initRouter, goToStep, goToStepInstant } from './router.js';
import { loadTheme, loadSound, loadHistory, addToHistory, saveTheme } from './persistence.js';
import { initTheme, setTheme, getLabels, CULTURES, CULTURE_DISPLAY_NAMES } from './theme.js';
import { initAudio, toggleSound, playChime } from './audio.js';
import { initVoice, startVoice } from './voice.js';
import { initShare, shareResult, closeShareSheet, handleShareChannel } from './share.js';
import { initOffline, isOnline } from './offline.js';
import { initAccessibility, announce } from './accessibility.js';
import { fetchRecommendation } from './api.js';
import { animateScoreRing, renderPetalRadar, renderSentimentBar, animateBadge, startParticles, stopParticles, chaosToOrderReveal, initLogoAnimation, startSearchPulse, stopSearchPulse, resolveLogoToFound, cleanupLoadingLogo } from './animations.js';
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
const $suggestions = document.getElementById('craving-suggestions');

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

  // Render dynamic smart chips (theme + history aware)
  renderSmartChips();

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
    if (state.theme.culture !== prev.theme.culture) {
      renderSmartChips();
      closeSuggestions();
    }
  });

  // Push initial history state
  history.replaceState({ step: 0 }, '', '');

  // Sync CTA disabled state
  updateCtaState();

  // First-visit theme discovery nudge
  try {
    if (!localStorage.getItem('dondeai-theme')) {
      setTimeout(() => {
        document.getElementById('theme-picker')?.classList.add('theme-picker--open');
      }, 2000);
    }
  } catch { /* private browsing — skip nudge */ }
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

/* ---- Dynamic Smart Chips (theme + history aware) ---- */
function renderSmartChips() {
  const $container = document.querySelector('.smart-chips');
  if (!$container) return;

  const culture = getState().theme.culture;
  const labels = getLabels(culture);
  const cultureChips = labels.smartChips || ['outdoor seating', 'live music', 'pet friendly', 'great cocktails', 'hidden gem'];
  const history = loadHistory();

  // Derive up to 2 history-based chips
  const historyChips = history.slice(0, 2).map(h => h.label.slice(0, 25)).filter(Boolean);

  // Combine: history first, then culture, deduplicate, cap at 5
  const seen = new Set();
  const combined = [];
  for (const chip of [...historyChips, ...cultureChips]) {
    const key = chip.toLowerCase();
    if (!seen.has(key) && combined.length < 5) {
      seen.add(key);
      combined.push(chip);
    }
  }

  // Clear and re-render with stagger animation
  $container.innerHTML = '';
  $container.classList.remove('smart-chips--visible');
  void $container.offsetWidth; // force reflow for animation restart

  combined.forEach(text => {
    const btn = document.createElement('button');
    btn.className = 'smart-chip type-structural';
    btn.setAttribute('data-action', 'smart-chip');
    btn.setAttribute('data-value', text);
    btn.textContent = text;
    $container.appendChild(btn);
  });

  $container.classList.add('smart-chips--visible');
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
        renderSmartChips();
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
        // Spring feedback
        btn.classList.add('smart-chip--active');
        btn.addEventListener('animationend',
          () => btn.classList.remove('smart-chip--active'), { once: true });
        // Ink ripple (reuse filter pill ripple)
        const ripple = document.createElement('span');
        ripple.className = 'filter-pill__ripple';
        btn.appendChild(ripple);
        ripple.addEventListener('animationend', () => ripple.remove(), { once: true });
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
        setState({ excludeNames: [] });
        handleSubmit();
        break;

      case 'try-again': {
        // Track current restaurant so backend can exclude it
        const prev = getState().result?.restaurant?.name;
        if (prev) {
          const exclude = [...getState().excludeNames];
          if (!exclude.includes(prev)) exclude.push(prev);
          setState({ excludeNames: exclude });
        }
        handleSubmit();
        break;
      }

      case 'open-themes':
        document.getElementById('theme-picker')?.classList.add('theme-picker--open');
        break;

      case 'close-themes': {
        document.getElementById('theme-picker')?.classList.remove('theme-picker--open');
        saveTheme(getState().theme);
        break;
      }

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
        document.getElementById('theme-picker')?.classList.add('theme-picker--open');
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

      case 'show-match-info': {
        showToast('DondeAI Match\u2122 shows how likely you are to love this spot \u2014 based on cuisine quality, vibe fit, and hundreds of local reviews.');
        break;
      }

      case 'toggle-profile': {
        const $profile = document.getElementById('result-profile');
        const isExpanded = btn.getAttribute('aria-expanded') === 'true';
        btn.setAttribute('aria-expanded', String(!isExpanded));
        if ($profile) $profile.classList.toggle('result-profile--expanded');
        break;
      }
    }
  });

  // Expandable tile click delegation (DondeAI Match + Vibe Radar)
  document.addEventListener('click', (e) => {
    // Skip if click was on the info button (handled by data-action delegation)
    if (e.target.closest('[data-action]')) return;
    const tile = e.target.closest('.score-tile--expandable');
    if (tile) openTileExpand(tile);
  });
}

/* ---- Craving Input + Autocomplete ---- */
let placeholderInterval = null;
let activeIndex = -1;

function getSuggestionPool() {
  const culture = getState().theme.culture;
  const labels = getLabels(culture);
  const pool = new Set();

  // Culture suggestions (primary pool)
  if (labels.suggestions) labels.suggestions.forEach(s => pool.add(s));
  // Culture smart chips as fallback
  if (labels.smartChips) labels.smartChips.forEach(s => pool.add(s));
  // History labels
  loadHistory().forEach(h => { if (h.label) pool.add(h.label); });

  return [...pool];
}

function renderSuggestions(matches, query) {
  if (!$suggestions || matches.length === 0) {
    closeSuggestions();
    return;
  }

  $suggestions.innerHTML = '';
  activeIndex = -1;

  matches.forEach((text, i) => {
    const div = document.createElement('div');
    div.className = 'craving-suggestion';
    div.setAttribute('role', 'option');
    div.setAttribute('id', `suggestion-${i}`);
    div.dataset.value = text;

    // Highlight matching substring
    const lowerText = text.toLowerCase();
    const matchStart = lowerText.indexOf(query);
    if (matchStart >= 0) {
      const before = text.slice(0, matchStart);
      const match = text.slice(matchStart, matchStart + query.length);
      const after = text.slice(matchStart + query.length);
      div.innerHTML = `${before}<mark>${match}</mark>${after}`;
    } else {
      div.textContent = text;
    }

    $suggestions.appendChild(div);
  });

  $suggestions.hidden = false;
}

function closeSuggestions() {
  if (!$suggestions) return;
  $suggestions.hidden = true;
  $suggestions.innerHTML = '';
  activeIndex = -1;
  if ($cravingInput) $cravingInput.removeAttribute('aria-activedescendant');
}

function moveActive(delta) {
  if (!$suggestions || $suggestions.hidden) return;
  const items = $suggestions.querySelectorAll('.craving-suggestion');
  if (items.length === 0) return;

  // Remove current active
  if (activeIndex >= 0 && activeIndex < items.length) {
    items[activeIndex].classList.remove('craving-suggestion--active');
  }

  // Compute new index with wrapping
  activeIndex = (activeIndex + delta + items.length) % items.length;

  items[activeIndex].classList.add('craving-suggestion--active');
  items[activeIndex].scrollIntoView({ block: 'nearest' });
  $cravingInput.setAttribute('aria-activedescendant', `suggestion-${activeIndex}`);
}

function selectSuggestion(index) {
  if (!$suggestions) return;
  const items = $suggestions.querySelectorAll('.craving-suggestion');
  if (index < 0 || index >= items.length) return;

  const value = items[index].dataset.value;
  if ($cravingInput) {
    $cravingInput.value = value;
    setState({ craving: value });
    updateCtaState();
  }
  closeSuggestions();
}

function wireCravingInput() {
  if (!$cravingInput) return;

  $cravingInput.addEventListener('input', () => {
    setState({ craving: $cravingInput.value });
    updateCtaState();

    // Autocomplete filtering
    const query = $cravingInput.value.trim().toLowerCase();
    if (query.length < 2) {
      closeSuggestions();
      return;
    }
    const pool = getSuggestionPool();
    const matches = pool.filter(s => s.toLowerCase().includes(query)).slice(0, 5);
    renderSuggestions(matches, query);
  });

  $cravingInput.addEventListener('keydown', (e) => {
    // Autocomplete keyboard navigation
    if ($suggestions && !$suggestions.hidden) {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        moveActive(1);
        return;
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        moveActive(-1);
        return;
      }
      if (e.key === 'Escape') {
        closeSuggestions();
        return;
      }
      if (e.key === 'Enter' && activeIndex >= 0) {
        e.preventDefault();
        selectSuggestion(activeIndex);
        return;
      }
    }

    if (e.key === 'Enter') {
      e.preventDefault();
      handleSubmit();
    }
  });

  // Stop placeholder rotation on focus, restart on blur
  $cravingInput.addEventListener('focus', () => {
    if (placeholderInterval) { clearInterval(placeholderInterval); placeholderInterval = null; }
  });
  $cravingInput.addEventListener('blur', () => {
    setTimeout(() => closeSuggestions(), 150);
    if (!$cravingInput.value.trim()) startPlaceholderRotation();
  });

  // Click handler on suggestions container (event delegation)
  if ($suggestions) {
    $suggestions.addEventListener('pointerdown', (e) => {
      e.preventDefault(); // Prevent blur on input
      const item = e.target.closest('.craving-suggestion');
      if (item) {
        $cravingInput.value = item.dataset.value;
        setState({ craving: item.dataset.value });
        updateCtaState();
        closeSuggestions();
        $cravingInput.focus();
      }
    });
  }

  startPlaceholderRotation();
}

function startPlaceholderRotation() {
  if (placeholderInterval) clearInterval(placeholderInterval);
  if (!$cravingInput || $cravingInput.value.trim()) return;

  const labels = getLabels(getState().theme.culture);
  const phs = labels.placeholders || [labels.placeholder];
  let idx = 0;

  placeholderInterval = setInterval(() => {
    if ($cravingInput.value.trim() || document.activeElement === $cravingInput) return;
    idx = (idx + 1) % phs.length;
    $cravingInput.style.transition = 'opacity 200ms ease';
    $cravingInput.style.opacity = '0.3';
    setTimeout(() => {
      $cravingInput.placeholder = phs[idx];
      $cravingInput.style.opacity = '';
    }, 200);
  }, 4000);
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
    // Inline hint instead of toast — modern validation pattern
    const $hint = document.getElementById('cta-hint');
    if ($hint) {
      $hint.textContent = "Tell us what you're craving first";
      $hint.classList.add('cta-hint--visible', 'cta-hint--nudge');
      $hint.addEventListener('animationend',
        () => $hint.classList.remove('cta-hint--nudge'), { once: true });
    }
    return;
  }

  if (!isOnline()) {
    showToast("You're offline \u2014 can't reach the engine.", true);
    return;
  }

  // Cancel any in-flight request
  if (currentAbort) currentAbort.abort();
  currentAbort = new AbortController();

  // Set CTA to loading state with brief confirmation glow
  const $cta = document.querySelector('.cta-btn[data-action="submit"]');
  if ($cta) {
    $cta.classList.add('cta-btn--confirming');
    await new Promise(r => setTimeout(r, 200));
    $cta.classList.remove('cta-btn--confirming');
    $cta.classList.add('cta-btn--loading');
    $cta.textContent = 'Searching';
  }

  setState({ loading: true, error: null, result: null });
  // Don't goToStep(1) — the loading overlay covers everything;
  // step-track positioning happens in orchestrateReveal()

  try {
    const payload = {
      special_request: s.craving,
      occasion: s.occasion,
      neighborhood: s.neighborhood,
      price_level: s.priceLevel,
    };
    if (s.excludeNames.length) payload.exclude = s.excludeNames;
    const data = await fetchRecommendation(payload);

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
    renderSmartChips(); // Refresh chips with new history
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

    // Animated searching dots with culture-specific phrases
    if ($loadingStatus) {
      const labels = getLabels(getState().theme.culture);
      const phrases = labels.loadingPhrases || ['Searching'];
      let phraseIndex = 0;
      let dotCount = 0;
      $loadingStatus.textContent = phrases[0];
      $loadingStatus.style.opacity = '';
      searchingDotsInterval = setInterval(() => {
        dotCount = (dotCount + 1) % 4;
        if (dotCount === 0) {
          phraseIndex = (phraseIndex + 1) % phrases.length;
          $loadingStatus.style.transition = 'opacity 150ms ease';
          $loadingStatus.style.opacity = '0';
          setTimeout(() => {
            $loadingStatus.textContent = phrases[phraseIndex];
            $loadingStatus.style.opacity = '1';
          }, 150);
        } else {
          $loadingStatus.textContent = phrases[phraseIndex] + '.'.repeat(dotCount);
        }
      }, 500);
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

  // Reset profile to collapsed
  const $profileToggle = document.querySelector('[data-action="toggle-profile"]');
  if ($profileToggle) $profileToggle.setAttribute('aria-expanded', 'false');
  const $profileEl = document.getElementById('result-profile');
  if ($profileEl) $profileEl.classList.remove('result-profile--expanded');

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

  // ---- Match Tile (DondeAI Match) ----
  const tier = getScoreTier(data.donde_match);
  const $verdict = document.getElementById('score-verdict');
  const $scoreTileDonde = document.getElementById('score-tile-donde');
  if ($verdict) {
    $verdict.textContent = tier.verdict;
    $verdict.className = `score-verdict type-structural--bold ${tier.cssClass}`;
    $verdict.setAttribute('data-tier', tier.tier);
  }
  if ($scoreTileDonde) {
    $scoreTileDonde.setAttribute('data-tier', tier.tier);
    $scoreTileDonde.classList.add('score-tile--expandable');
    $scoreTileDonde.setAttribute('tabindex', '0');
    $scoreTileDonde.setAttribute('role', 'button');
    $scoreTileDonde.setAttribute('aria-label', 'Expand DondeAI Match');
  }
  // Delay score ring to after tile entrance
  animationTimers.push(setTimeout(() => animateScoreRing(data.donde_match), 800));

  // ---- Google Rating (inline display below ring) ----
  const $googleInline = document.getElementById('google-rating-inline');
  const $googleStars = document.getElementById('google-stars');
  const $googleNum = document.getElementById('google-rating-num');
  const $googleCount = document.getElementById('google-count');
  if (r.google_rating && $googleInline) {
    if ($googleStars) $googleStars.innerHTML = buildGoogleStars(r.google_rating);
    if ($googleNum) $googleNum.textContent = parseFloat(r.google_rating).toFixed(1);
    if ($googleCount) $googleCount.textContent = r.google_review_count
      ? `(${Number(r.google_review_count).toLocaleString()} reviews)` : '';
    if (r.google_place_id) {
      $googleInline.style.cursor = 'pointer';
      $googleInline.setAttribute('role', 'link');
      $googleInline.setAttribute('tabindex', '0');
      $googleInline.setAttribute('aria-label',
        `Google Rating ${parseFloat(r.google_rating).toFixed(1)} - View on Google Maps`);
      const url = `https://www.google.com/maps/place/?q=place_id:${r.google_place_id}`;
      $googleInline.onclick = () => window.open(url, '_blank', 'noopener,noreferrer');
      $googleInline.onkeydown = (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault(); window.open(url, '_blank', 'noopener,noreferrer');
        }
      };
    }
    $googleInline.style.display = '';
    animationTimers.push(setTimeout(() => { $googleInline.style.opacity = '1'; }, 900));
  } else if ($googleInline) {
    $googleInline.style.display = 'none';
  }

  // ---- Petal Radar (Vibe Profile) ----
  renderPetalRadar(data.scores || {}, animationTimers);

  // ---- Profile Block: Unified badges (facts + atmosphere merged) ----
  const $profileFacts = document.getElementById('profile-facts');
  const $glyphBar = document.getElementById('glyph-bar');
  const allBadges = [];

  if ($profileFacts) {
    $profileFacts.innerHTML = '';

    // Fact badges
    if (r.cuisine_type) {
      allBadges.push({ icon: cuisine.icon || 'plate', label: 'Cuisine',
        value: shortenBadgeValue(r.cuisine_type), raw: r.cuisine_type, isAtmo: false });
    }
    if (r.price_level) {
      allBadges.push({ icon: 'tag', label: 'Price',
        value: r.price_level, raw: r.price_level, isAtmo: false });
    }
    if (r.parking_availability) {
      const pts = parseParkingTypes(r.parking_availability).slice(0, 2);
      allBadges.push({ icon: 'car', label: 'Parking',
        value: pts.join(' / '), raw: r.parking_availability, isAtmo: false });
    }
    if (r.noise_level) {
      allBadges.push({ icon: getNoiseIcon(r.noise_level), label: 'Noise',
        value: shortenBadgeValue(r.noise_level), raw: r.noise_level, isAtmo: false });
    }
    if (r.lighting_ambiance) {
      allBadges.push({ icon: getAmbianceIcon(r.lighting_ambiance), label: 'Ambiance',
        value: shortenBadgeValue(r.lighting_ambiance), raw: r.lighting_ambiance, isAtmo: false });
    }
    if (r.dress_code) {
      allBadges.push({ icon: 'shirt', label: 'Dress',
        value: shortenBadgeValue(r.dress_code), raw: r.dress_code, isAtmo: false });
    }

    // Atmosphere badges (merged in)
    if (r.outdoor_seating) {
      allBadges.push({ icon: 'patio', label: 'Patio', value: 'Yes', raw: 'Outdoor seating', isAtmo: true });
    }
    if (r.live_music) {
      allBadges.push({ icon: 'music', label: 'Live Music', value: 'Yes', raw: 'Live music venue', isAtmo: true });
    }
    if (r.pet_friendly) {
      allBadges.push({ icon: 'pet', label: 'Pet Friendly', value: 'Yes', raw: 'Pet-friendly', isAtmo: true });
    }

    // Render expanded badge grid (all badges)
    allBadges.forEach(b => {
      const div = document.createElement('div');
      const cls = ['details-badge'];
      if (b.label === 'Cuisine') cls.push('details-badge--cuisine');
      if (b.isAtmo) cls.push('details-badge--atmo');
      div.className = cls.join(' ');
      div.innerHTML = `
        <span class="details-badge__icon">${svgIcon(b.icon, 16)}</span>
        <span class="details-badge__label type-data--sm">${b.label}</span>
        <span class="details-badge__value type-structural">${b.value}</span>`;
      if (b.raw && b.raw !== b.value) div.setAttribute('title', b.raw);
      $profileFacts.appendChild(div);
    });

    $profileFacts.style.display = allBadges.length > 0 ? '' : 'none';
  }

  // ---- Glyph Bar (icon-only compact view for mobile) ----
  if ($glyphBar) {
    $glyphBar.innerHTML = '';
    const REDUCED_MQ = matchMedia('(prefers-reduced-motion: reduce)');

    allBadges.forEach((b, i) => {
      const glyph = document.createElement('button');
      glyph.className = 'glyph-bar__item' + (b.isAtmo ? ' glyph-bar__item--atmo' : '');
      glyph.setAttribute('aria-label', `${b.label}: ${b.value}`);
      glyph.setAttribute('type', 'button');

      // Handwritten jitter rotation
      const rotation = ((Math.random() - 0.5) * 4).toFixed(1);

      const glyphContent = b.label === 'Price'
        ? `<span class="glyph-bar__text">${b.value}</span>`
        : svgIcon(b.icon, 16);

      if (b.label === 'Price') glyph.classList.add('glyph-bar__item--text');

      glyph.innerHTML = `
        ${glyphContent}
        <div class="glyph-bar__tooltip">
          <span class="glyph-bar__tooltip-label">${b.label}</span>
          <span class="glyph-bar__tooltip-value">${b.value}</span>
        </div>`;

      // Tap to toggle tooltip
      glyph.addEventListener('click', (e) => {
        e.stopPropagation();
        $glyphBar.querySelectorAll('.glyph-bar__item--active').forEach(g => {
          if (g !== glyph) g.classList.remove('glyph-bar__item--active');
        });
        glyph.classList.toggle('glyph-bar__item--active');
      });

      // Spring pop stagger entrance
      if (!REDUCED_MQ.matches) {
        glyph.style.opacity = '0';
        const baseTransform = `rotate(${rotation}deg)`;
        glyph.style.transform = `${baseTransform} scale(0.7)`;
        animationTimers.push(setTimeout(() => {
          glyph.style.transition = 'opacity 200ms ease-out, transform 300ms cubic-bezier(0.34, 1.56, 0.64, 1)';
          glyph.style.opacity = '1';
          glyph.style.transform = `${baseTransform} scale(1)`;
        }, 500 + i * 50));
      } else {
        glyph.style.transform = `rotate(${rotation}deg)`;
      }

      $glyphBar.appendChild(glyph);
    });

    // Close tooltips when clicking outside glyph bar
    document.addEventListener('click', () => {
      $glyphBar.querySelectorAll('.glyph-bar__item--active').forEach(g => {
        g.classList.remove('glyph-bar__item--active');
      });
    }, { once: true });
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

  // ---- Sentiment Bar (subtle horizontal indicator) ----
  const $sentBar = document.getElementById('sentiment-bar');
  if ($sentBar) {
    let posVal = 33, neuVal = 34, negVal = 33;
    if (r.sentiment_breakdown) {
      const parts = r.sentiment_breakdown.toLowerCase();
      const posMatch = parts.match(/positive[:\s]+(\d+)/);
      const neuMatch = parts.match(/neutral[:\s]+(\d+)/);
      const negMatch = parts.match(/negative[:\s]+(\d+)/);
      posVal = parseInt(posMatch?.[1] || '33', 10);
      neuVal = parseInt(neuMatch?.[1] || '34', 10);
      negVal = parseInt(negMatch?.[1] || '33', 10);
    }

    renderSentimentBar(posVal, neuVal, negVal, animationTimers);

    // Tooltip labels
    const $tipPos = document.getElementById('sentiment-tip-pos');
    const $tipNeu = document.getElementById('sentiment-tip-neu');
    const $tipNeg = document.getElementById('sentiment-tip-neg');
    if ($tipPos) $tipPos.textContent = `${posVal}% Positive`;
    if ($tipNeu) $tipNeu.textContent = `${neuVal}% Neutral`;
    if ($tipNeg) $tipNeg.textContent = `${negVal}% Negative`;

    // Tap toggle for mobile tooltip
    $sentBar.addEventListener('click', () => {
      $sentBar.classList.toggle('sentiment-bar--active');
    });
  }

  // Hide entire profile block if no badges
  const $profile = document.getElementById('result-profile');
  if ($profile) {
    const hasContent = allBadges.length > 0;
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

    // Clean up reveal class after all sections have animated (600ms last delay + 400ms duration)
    setTimeout(() => {
      $resultCard.classList.remove('result-card--revealing');
      $resultCard.querySelectorAll(':scope > *, .score-tile').forEach(child => {
        child.style.opacity = '';
        child.style.transform = '';
      });
    }, 1200);
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

/* ---- Badge Value Shortener (first segment, no word cap) ---- */
function shortenBadgeValue(value) {
  if (!value) return '';
  return value.split(/[,/;]/).at(0).trim();
}

/* ---- Noise Level → Speaker Icon Mapper ---- */
function getNoiseIcon(noiseStr) {
  if (!noiseStr) return 'speakerWave';
  const lower = noiseStr.toLowerCase();
  if (lower.includes('quiet') || lower.includes('soft') || lower.includes('hushed'))
    return 'speakerNone';
  if (lower.includes('loud') || lower.includes('boisterous') || lower.includes('lively'))
    return 'speakerHigh';
  return 'speakerWave';
}

/* ---- Ambiance → Icon Mapper ---- */
function getAmbianceIcon(ambianceStr) {
  if (!ambianceStr) return 'sun';
  const lower = ambianceStr.toLowerCase();
  if (lower.includes('dim') || lower.includes('cozy') || lower.includes('warm') ||
      lower.includes('intimate') || lower.includes('candlelit'))
    return 'moon';
  return 'sun';
}

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
    const tier = getScoreTier(data.donde_match);
    const pct = Math.round(parseFloat(data.donde_match) || 80);
    const circumference = 2 * Math.PI * 45;
    const offset = circumference - (pct / 100) * circumference;
    const strokeColor = 'var(--ac)';
    $content.innerHTML = `
      <div class="score-tile__brand" aria-label="DondeAI Match">
        <svg class="score-tile__logo-mark" viewBox="0 0 32 44" width="20" height="28" aria-hidden="true">
          <path d="M10.5 1C10.5 1 10 8.5 12.5 11.5Q14 13 14.5 13.5"
                fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"/>
          <path d="M21.5 1C21.5 1 22 8.5 19.5 11.5Q18 13 17.5 13.5"
                fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"/>
          <path d="M16 13.5C22 11 29 14 28 21C27 27 19 29 16 31L16 34"
                fill="none" stroke="currentColor" stroke-width="2.8" stroke-linecap="round"/>
          <circle cx="16" cy="40" r="2.8" fill="var(--ac)"/>
        </svg>
        <span class="score-tile__wordmark" style="font-size: var(--text-sm);">
          <span class="score-tile__wordmark-d">D</span><span
            class="score-tile__wordmark-onde">onde</span><span
            class="score-tile__wordmark-a">A</span><span
            class="score-tile__wordmark-i">I</span>
        </span>
        <span class="score-tile__score-label type-data--sm">Match<sup>™</sup></span>
      </div>
      <div class="score-ring-wrap">
        <svg class="score-ring" viewBox="0 0 100 100">
          <circle class="score-ring__bg" cx="50" cy="50" r="45"></circle>
          <circle class="score-ring__fill" cx="50" cy="50" r="45"
            style="stroke: ${strokeColor}; stroke-dasharray: ${circumference}; stroke-dashoffset: ${offset}"></circle>
        </svg>
        <div class="score-ring__number">
          <span class="type-data--lg" style="font-size: var(--text-xl);">${pct}%</span>
        </div>
      </div>
      <span class="score-verdict type-structural--bold ${tier.cssClass}" style="font-size: var(--text-lg);">${tier.verdict}</span>`;
  } else if (tileEl.id === 'score-tile-radar') {
    // Expanded petal radar with dimension list
    const scores = data.scores || {};
    const dims = [
      { key: 'date_friendly_score',  label: 'Date',     icon: 'heart' },
      { key: 'group_friendly_score', label: 'Group',    icon: 'usersThree' },
      { key: 'family_friendly_score',label: 'Family',   icon: 'house' },
      { key: 'business_lunch_score', label: 'Business', icon: 'briefcase' },
      { key: 'solo_dining_score',    label: 'Solo',     icon: 'user' },
      { key: 'hole_in_wall_factor',  label: 'Gem',      icon: 'diamond' },
    ];
    const available = dims.filter(d => {
      const v = scores[d.key];
      return v != null && v !== '' && !isNaN(parseFloat(v));
    });
    const dimListHtml = available.map(d => {
      const val = Math.min(parseFloat(scores[d.key]) || 0, 10);
      const pct = (val / 10) * 100;
      return `
        <div class="tile-expand__dim">
          <span class="tile-expand__dim-icon">${svgIcon(d.icon, 16)}</span>
          <span class="tile-expand__dim-label type-data--sm">${d.label}</span>
          <div class="tile-expand__dim-bar">
            <div class="tile-expand__dim-fill" style="width: ${pct}%"></div>
          </div>
          <span class="tile-expand__dim-value type-data--sm">${val.toFixed(1)}</span>
        </div>`;
    }).join('');

    $content.innerHTML = `
      <span class="tile-expand__title type-data--sm">Vibe Profile</span>
      <div class="tile-expand__dims">${dimListHtml}</div>`;
  }

  $modal.classList.add('tile-expand--open');
  $modal.querySelector('.tile-expand__close')?.focus();
  announce(tileEl.id === 'score-tile-radar' ? 'Vibe profile expanded' : 'Match details expanded');
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

  // Subtle ambient wash overlay (brand depth)
  const gradient = ctx.createRadialGradient(w * 0.3, h * 0.2, 0, w * 0.3, h * 0.2, w * 0.6);
  gradient.addColorStop(0, ac + '12');
  gradient.addColorStop(1, 'transparent');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, w, h);

  const r = result.restaurant;
  const score = Math.round(parseFloat(result.donde_match) || 80);
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

  // Accent divider line below name
  ctx.fillStyle = ac;
  ctx.fillRect(pad, y, 40, 2);
  y += 12;

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
  ctx.font = `700 22px "JetBrains Mono", monospace`;
  ctx.textAlign = 'center';
  ctx.fillText(score + '%', scoreX, scoreY + 10);

  // Match label
  ctx.textAlign = 'left';
  ctx.font = `600 14px "Inter", sans-serif`;
  ctx.fillStyle = fg2;
  ctx.fillText('DondeAI Match', scoreX + 44, scoreY + 4);

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
