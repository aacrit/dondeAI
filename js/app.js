/* ============================================
   DondeAI — Main Orchestrator
   Single-canvas layout: Canvas + Result.
   ============================================ */

import { getState, setState, subscribe, resetState } from './state.js';
import { initRouter, goToStep, goToStepInstant } from './router.js';
import { loadTheme, loadSound, loadHistory, addToHistory, saveTheme, loadColorMode, loadBookmarks, addBookmark, removeBookmark, isBookmarked, loadVisits, addVisit, isVisited, getOrCreateUserId, saveFeedback, loadFeedback, clearFeedback, hasGuestDismissed, setGuestDismissed, hasSeenOnboarding, setOnboardingSeen } from './persistence.js';
import { initTheme, setTheme, setThemeInstant, setThemeVisualOnly, revertAutoTheme, setManualOverride, isManualOverride, setColorMode, getColorMode, getLabels, CULTURES, CULTURE_DISPLAY_NAMES } from './theme.js';
import { initAudio, toggleSound, playChime, playCelebrationChime } from './audio.js';
import { initVoice, startVoice } from './voice.js';
import { initShare, shareResult, closeShareSheet, handleShareChannel } from './share.js';
import { initOffline, isOnline } from './offline.js';
import { initAccessibility, announce } from './accessibility.js';
import { fetchRecommendation, sendFeedback, sendVisit, sendAppFeedback } from './api.js';
import { initAuth, signIn as signInWith, signOut as authSignOut, isAuthenticated as isAuthAuthenticated, getUser as getAuthUser, addFavoriteToServer, removeFavoriteFromServer, addVisitToServer } from './auth.js';
import { animateScoreRing, renderPetalRadar, renderSentimentBar, renderScoreBloom, renderScoreHero, renderFactorBars, toggleBloom, resetBloomState, handlePetalTap, handleBloomRingTap, toggleScoreBreakdown, getBloomState, animateBadge, startParticles, stopParticles, chaosToOrderReveal, initLogoAnimation, startSearchPulse, stopSearchPulse, resolveLogoToFound, cleanupLoadingLogo, fireCelebration } from './animations.js';
import {
  getGreeting, getTimePeriod, getCuisineFromResult, svgIcon,
  getScoreTier, getScoreColor, getScoreThresholdColor, getFactorColor,
  buildGoogleStars, buildMapsUrl, relativeTime, matchCuisine, matchCulture,
  humanizeSnake
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

/* ---- Haptic Feedback Library ---- */
function haptic(pattern) {
  if (navigator.vibrate) navigator.vibrate(pattern);
}
const HAPTICS = {
  tick:        [10],                   // feedback tap, filter select
  doublePulse: [30, 20, 30],           // bookmark save
  reveal:      [50, 30, 50],           // result reveal
  celebration: [50, 30, 80, 30, 50],   // 90%+ score
  swipe:       [40],                   // swipe completion
};

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
  const savedColorMode = loadColorMode();

  setState({
    theme: savedTheme,
    soundEnabled: savedSound,
    history: savedHistory,
    colorMode: savedColorMode,
  });

  // Initialize all modules
  initRouter();
  initTheme();
  initAudio();
  initVoice();
  initShare();
  initOffline();
  initAccessibility();
  initAuth(); // SSO: non-blocking, restores session if exists

  // SSO: Auth popup deferred to post-first-result engagement.
  // See state subscriber below for trigger logic.

  // Set up greeting
  setupLanding();

  // Sync offline banner text with current culture
  syncOfflineBannerText();

  // Wire event delegation
  wireEvents();

  // Wire craving input
  wireCravingInput();

  // Render dynamic smart chips (theme + history aware)
  renderSmartChips();

  // Render taste memory (recent searches)
  renderTasteMemory();

  // F4: Render saved spots (bookmarks)
  renderSavedSpots();

  // Render visited spots ("Been Here")
  renderVisitedSpots();

  // F9: Initialize anonymous user ID
  getOrCreateUserId();

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

  // Coach marks: show on first visit after 1.5s (decoupled from auth)
  if (!hasSeenOnboarding()) {
    setTimeout(() => showCoachMarks(), 1500);
  }

  // Subscribe to state changes
  let _resultCount = 0;
  subscribe((state, prev) => {
    if (state.result !== prev.result && state.result) {
      // Result arrived — orchestrate the reveal transition (Act 3)
      orchestrateReveal(state.result);
      // SSO: Deferred auth — show popup after second successful result
      _resultCount++;
      if (_resultCount >= 2 && !isAuthAuthenticated() && !hasGuestDismissed()) {
        setTimeout(() => openAuthSheet(), 600);
      }
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
      syncOfflineBannerText();
      // Update greeting for new culture
      const $greeting = document.querySelector('[data-step="0"] .step__title');
      if ($greeting) $greeting.textContent = getGreeting(state.theme.culture);
    }
  });

  // Push initial history state
  history.replaceState({ step: 0 }, '', '');

  // Sync CTA disabled state
  updateCtaState();

  // Auto-color is on by default — no first-visit nudge needed
}

/* ---- Landing Setup ---- */
function setupLanding() {
  const culture = getState().theme.culture;
  const $greeting = document.querySelector('[data-step="0"] .step__title');
  if ($greeting) {
    typewriterReveal($greeting, getGreeting(culture));
  }
  startGreetingRotation();
}

/* ---- Typewriter Reveal (handwritten entrance) ---- */
const REDUCED_MOTION = matchMedia('(prefers-reduced-motion: reduce)');

function typewriterReveal(element, text, customSpeed) {
  if (REDUCED_MOTION.matches) {
    element.textContent = text;
    return;
  }
  element.textContent = '';
  element.classList.add('step__title--typing');
  let i = 0;
  const speed = customSpeed || 35;
  function type() {
    if (i < text.length) {
      element.textContent += text.charAt(i);
      i++;
      const jitter = speed + (Math.random() - 0.5) * 20;
      setTimeout(type, jitter);
    } else {
      element.classList.remove('step__title--typing');
    }
  }
  setTimeout(type, 300);
}

/* ---- Greeting Rotation (crossfade every 45s) ---- */
let greetingRotationTimer = null;

function startGreetingRotation() {
  stopGreetingRotation();
  greetingRotationTimer = setInterval(() => {
    const state = getState();
    if (state.step !== 0 || state.loading || state.craving.trim()) return;
    const $greeting = document.querySelector('[data-step="0"] .step__title');
    if (!$greeting) return;
    const newText = getGreeting(state.theme.culture);
    if (newText === $greeting.textContent) return;
    $greeting.style.transition = 'opacity 400ms ease';
    $greeting.style.opacity = '0';
    setTimeout(() => {
      $greeting.textContent = newText;
      $greeting.style.opacity = '1';
    }, 400);
  }, 45000);
}

function stopGreetingRotation() {
  if (greetingRotationTimer) {
    clearInterval(greetingRotationTimer);
    greetingRotationTimer = null;
  }
}

/* ---- Dynamic Smart Chips (rotating, input-reactive) ---- */
let chipRotationTimer = null;

function renderSmartChips() {
  const $container = document.querySelector('.smart-chips');
  if (!$container) return;

  const culture = getState().theme.culture;
  const labels = getLabels(culture);
  const pool = labels.chipPool;
  const timePeriod = getTimePeriod();

  const chips = [];
  const seen = new Set();

  function pickFrom(arr, count) {
    if (!arr) return;
    const shuffled = [...arr].sort(() => Math.random() - 0.5);
    let added = 0;
    for (const item of shuffled) {
      if (!seen.has(item.toLowerCase()) && added < count) {
        seen.add(item.toLowerCase());
        chips.push(item);
        added++;
      }
    }
  }

  if (pool) {
    pickFrom(pool.time?.[timePeriod], 2);
    pickFrom(pool.vibe, 1);
    pickFrom(pool.cuisine, 1);
    pickFrom(pool.style, 1);
  }

  // Fallback to legacy smartChips
  if (chips.length < 5 && labels.smartChips) {
    for (const c of labels.smartChips) {
      if (!seen.has(c.toLowerCase()) && chips.length < 5) {
        seen.add(c.toLowerCase());
        chips.push(c);
      }
    }
  }

  $container.innerHTML = '';
  $container.classList.remove('smart-chips--visible');
  void $container.offsetWidth;

  chips.slice(0, 5).forEach(text => {
    const btn = document.createElement('button');
    btn.className = 'smart-chip type-structural';
    btn.setAttribute('data-action', 'smart-chip');
    btn.setAttribute('data-value', text);

    // Cuisine icon hint (neutral, subtle)
    const cuisine = matchCuisine(text);
    if (cuisine && cuisine.icon !== 'plate') {
      btn.innerHTML = `<span class="smart-chip__icon">${svgIcon(cuisine.icon, 12)}</span>${text}`;
    } else {
      btn.textContent = text;
    }

    $container.appendChild(btn);
  });

  $container.classList.add('smart-chips--visible');
  startChipRotation();
}

/* ---- Chip Ambient Rotation (swap one chip every 15s, pause on interaction) ---- */
let _chipsPaused = false;
function startChipRotation() {
  stopChipRotation();
  // Pause rotation when user hovers/focuses the chip area
  const $container = document.querySelector('.smart-chips');
  if ($container) {
    $container.addEventListener('pointerenter', () => { _chipsPaused = true; });
    $container.addEventListener('pointerleave', () => { _chipsPaused = false; });
  }
  chipRotationTimer = setInterval(() => {
    if ($cravingInput && $cravingInput.value.trim().length > 0) return;
    if (document.activeElement === $cravingInput) return;
    if (_chipsPaused) return;
    // Also pause if filter drawer is open
    const filterToggle = document.querySelector('.filter-drawer__toggle');
    if (filterToggle?.getAttribute('aria-expanded') === 'true') return;
    rotateOneChip();
  }, 15000);
}

function stopChipRotation() {
  if (chipRotationTimer) {
    clearInterval(chipRotationTimer);
    chipRotationTimer = null;
  }
}

function rotateOneChip() {
  const $container = document.querySelector('.smart-chips');
  if (!$container) return;
  const chips = [...$container.querySelectorAll('.smart-chip')];
  if (chips.length < 2) return;

  const replaceIndex = 1 + Math.floor(Math.random() * (chips.length - 1));
  const oldChip = chips[replaceIndex];

  const currentTexts = new Set(chips.map(c => c.dataset.value.toLowerCase()));
  const newText = getRandomChipFromPool(currentTexts);
  if (!newText) return;

  const updateChipContent = (chip, text) => {
    chip.dataset.value = text;
    const cuisine = matchCuisine(text);
    if (cuisine && cuisine.icon !== 'plate') {
      chip.innerHTML = `<span class="smart-chip__icon">${svgIcon(cuisine.icon, 12)}</span>${text}`;
    } else {
      chip.textContent = text;
    }
  };

  if (REDUCED_MOTION.matches) {
    updateChipContent(oldChip, newText);
    return;
  }

  oldChip.style.transition = 'opacity 200ms ease, transform 200ms ease';
  oldChip.style.opacity = '0';
  oldChip.style.transform = 'translateY(-8px) scale(0.9)';

  setTimeout(() => {
    updateChipContent(oldChip, newText);
    oldChip.style.transform = 'translateY(8px) scale(0.9)';
    requestAnimationFrame(() => {
      oldChip.style.transition = 'opacity 250ms ease, transform 350ms var(--spring)';
      oldChip.style.opacity = '1';
      oldChip.style.transform = 'translateY(0) scale(1)';
    });
  }, 220);
}

function getRandomChipFromPool(excludeSet) {
  const culture = getState().theme.culture;
  const labels = getLabels(culture);
  const pool = labels.chipPool;
  if (!pool) return null;

  const timePeriod = getTimePeriod();
  const timeChips = pool.time?.[timePeriod] || [];
  const allChips = [
    ...timeChips, ...timeChips,
    ...(pool.cuisine || []),
    ...(pool.vibe || []),
    ...(pool.style || []),
  ];

  const available = allChips.filter(c => !excludeSet.has(c.toLowerCase()));
  if (available.length === 0) return null;
  return available[Math.floor(Math.random() * available.length)];
}

/* ---- Chip Input Reactivity ---- */
const CHIP_REACTIONS = {
  'taco': ['salsa verde', 'al pastor', 'late night', 'margaritas', 'street food'],
  'ramen': ['tonkotsu', 'late night', 'sake pairing', 'spicy miso', 'tsukemen'],
  'sushi': ['omakase', 'sake flight', 'counter seat', 'fresh catch', 'chirashi'],
  'pasta': ['handmade', 'wine pairing', 'truffle', 'al dente', 'bolognese'],
  'pizza': ['wood-fired', 'Neapolitan', 'deep dish', 'late night slice', 'craft beer'],
  'burger': ['smash burger', 'craft beer', 'loaded fries', 'late night', 'double stack'],
  'curry': ['naan fresh', 'spice level', 'vindaloo', 'coconut curry', 'rice and curry'],
  'steak': ['dry aged', 'wine list', 'special occasion', 'steakhouse', 'bone-in'],
  'seafood': ['raw bar', 'oyster happy hour', 'catch of the day', 'lobster roll', 'waterfront'],
  'brunch': ['bottomless mimosas', 'eggs benny', 'avocado toast', 'bloody mary bar', 'french toast'],
  'coffee': ['pour over', 'latte art', 'cozy corner', 'pastry pairing', 'espresso bar'],
  'cocktail': ['speakeasy', 'craft mixology', 'rooftop bar', 'happy hour', 'signature drinks'],
  'pho': ['bone broth', 'fresh herbs', 'sriracha', 'banh mi too', 'comfort soup'],
  'dim sum': ['cart service', 'weekend special', 'tea pairing', 'dumpling feast', 'har gow'],
  'romantic': ['candlelit', 'quiet corner', 'wine bar', 'tasting menu', 'intimate'],
  'date': ['cozy booth', 'wine list', 'ambiance', 'shareable plates', 'prix fixe'],
  'group': ['family style', 'shareable', 'long table', 'lively', 'big portions'],
  'solo': ['counter seat', 'bar dining', 'chef\'s table', 'quick and quality', 'book-friendly'],
  'quiet': ['intimate setting', 'soft lighting', 'conversation-friendly', 'tucked away', 'peaceful'],
  'lively': ['buzzing crowd', 'open kitchen', 'music and food', 'energetic', 'happy hour'],
  'outdoor': ['patio seating', 'rooftop', 'garden dining', 'al fresco', 'sidewalk cafe'],
  'cozy': ['warm lighting', 'fireplace', 'comfort food', 'neighborhood spot', 'intimate'],
  'upscale': ['tasting menu', 'sommelier pick', 'fine dining', 'special occasion', 'jacket optional'],
  'cheap': ['hidden gem', 'cash only', 'hole in the wall', 'budget feast', 'byob'],
  'hidden': ['off the beaten path', 'locals only', 'no sign outside', 'word of mouth', 'secret menu'],
  'vegan': ['plant-based', 'creative veggies', 'impossible burger', 'raw bar', 'juice bar'],
  'spicy': ['bring the heat', 'ghost pepper', 'szechuan numbing', 'habanero', 'thai hot'],
  'comfort': ['mac and cheese', 'soul food', 'fried chicken', 'warm and hearty', 'grandma\'s recipe'],
  'healthy': ['grain bowl', 'fresh juice', 'salad bar', 'light and clean', 'organic'],
  'trendy': ['new opening', 'Instagram-worthy', 'chef-driven', 'reservation required', 'buzzworthy'],
};

let chipDebounce = null;
let autoThemeDebounce = null;

function updateChipsForInput(query) {
  if (!query || query.length < 2) {
    renderSmartChips();
    return;
  }

  stopChipRotation();
  const lowerQuery = query.toLowerCase();
  let reactionChips = [];

  for (const [keyword, chips] of Object.entries(CHIP_REACTIONS)) {
    if (lowerQuery.includes(keyword)) {
      reactionChips.push(...chips);
    }
  }

  if (reactionChips.length === 0) return;

  const seen = new Set();
  const filtered = [];
  for (const chip of reactionChips) {
    const key = chip.toLowerCase();
    if (!seen.has(key) && !lowerQuery.includes(key) && filtered.length < 5) {
      seen.add(key);
      filtered.push(chip);
    }
  }

  if (filtered.length === 0) return;

  const $container = document.querySelector('.smart-chips');
  if (!$container) return;

  const existing = [...$container.querySelectorAll('.smart-chip')];
  filtered.forEach((text, i) => {
    if (i < existing.length && existing[i].dataset.value !== text) {
      const chip = existing[i];
      if (REDUCED_MOTION.matches) {
        chip.textContent = text;
        chip.dataset.value = text;
        return;
      }
      chip.style.transition = 'opacity 150ms ease, transform 150ms ease';
      chip.style.opacity = '0';
      chip.style.transform = 'scale(0.9)';
      setTimeout(() => {
        chip.textContent = text;
        chip.dataset.value = text;
        chip.style.transition = 'opacity 200ms ease, transform 250ms var(--spring)';
        chip.style.opacity = '1';
        chip.style.transform = 'scale(1)';
      }, 160);
    }
  });
}

/* ---- Taste Memory (recent searches on canvas) ---- */
function renderTasteMemory() {
  const $container = document.getElementById('taste-memory');
  const $list = document.getElementById('taste-memory-list');
  if (!$container || !$list) return;

  const { history } = getState();
  if (!history || history.length === 0) {
    $container.classList.remove('taste-memory--visible');
    return;
  }

  $list.innerHTML = '';
  history.slice(0, 3).forEach(entry => {
    const btn = document.createElement('button');
    btn.className = 'taste-memory__chip';
    btn.setAttribute('data-action', 'taste-memory');
    btn.setAttribute('data-payload', JSON.stringify(entry.payload));

    const iconHtml = entry.cuisineIcon
      ? `<span class="taste-memory__icon">${svgIcon(entry.cuisineIcon, 14)}</span>`
      : '';

    const label = entry.label.length > 22 ? entry.label.slice(0, 20) + '…' : entry.label;
    const time = entry.timestamp ? relativeTime(entry.timestamp) : '';

    btn.innerHTML = `${iconHtml}<span>${label}</span>${time ? `<span class="taste-memory__time">${time}</span>` : ''}`;
    $list.appendChild(btn);
  });

  $container.classList.remove('taste-memory--visible');
  void $container.offsetWidth;
  $container.classList.add('taste-memory--visible');
}

/* ---- Ambient Blob Interaction Pulse ---- */
function pulseAmbient() {
  const blobs = document.querySelectorAll('.ambient__blob');
  if (!blobs.length || REDUCED_MOTION.matches) return;

  blobs.forEach(blob => {
    blob.style.transition = 'transform 600ms var(--ease-out), opacity 600ms var(--ease-out)';
    blob.style.transform = 'scale(1.15)';
    const current = parseFloat(getComputedStyle(blob).opacity) || 0.6;
    blob.style.opacity = String(Math.min(current + 0.05, 1));
  });

  setTimeout(() => {
    blobs.forEach(blob => {
      blob.style.transform = '';
      blob.style.opacity = '';
      setTimeout(() => { blob.style.transition = ''; }, 600);
    });
  }, 600);
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
        if ($cravingInput) {
          $cravingInput.value = '';
          $cravingInput.style.height = ''; // F19: reset textarea height
        }
        clearAllSelections();
        // F5: Clear dietary pills
        document.querySelectorAll('[data-action="toggle-dietary"]').forEach(pill => {
          pill.setAttribute('aria-pressed', 'false');
        });
        // V5: Clear Open Now pill
        const $openNowPill = document.getElementById('open-now-pill');
        if ($openNowPill) $openNowPill.setAttribute('aria-pressed', 'false');
        setupLanding();
        renderSmartChips();
        renderTasteMemory();
        renderSavedSpots();
        goToStep(0);
        updateCtaState();
        updateFilterSummary();
        // Collapse filter drawer
        collapseFilters();
        // Revert auto-theme and re-enable auto-detection
        revertAutoTheme();
        setManualOverride(false);
        break;

      case 'back':
        if (currentAbort) currentAbort.abort();
        if (getState().loading) {
          toggleLoading(false);
          setState({ loading: false });
        }
        goToStep(getState().step - 1);
        syncFilterPillsToState();
        // Revert any result-page auto-theme back to persisted
        revertAutoTheme();
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

      case 'taste-memory': {
        try {
          const payload = JSON.parse(btn.dataset.payload);
          if ($cravingInput && payload.special_request) {
            $cravingInput.value = payload.special_request;
            setState({
              craving: payload.special_request,
              occasion: payload.occasion || 'Any',
              neighborhood: payload.neighborhood || 'Anywhere',
              priceLevel: payload.price_level || 'Any',
            });
            updateCtaState();
          }
        } catch { /* ignore parse errors */ }
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

      // F5: Dietary restriction toggle (multi-select)
      case 'toggle-dietary': {
        const val = btn.dataset.value;
        const current = [...getState().dietaryRestrictions];
        const isActive = btn.getAttribute('aria-pressed') === 'true';
        btn.setAttribute('aria-pressed', String(!isActive));
        if (isActive) {
          setState({ dietaryRestrictions: current.filter(d => d !== val) });
        } else {
          current.push(val);
          setState({ dietaryRestrictions: current });
        }
        // Ink ripple feedback
        const ripple = document.createElement('span');
        ripple.className = 'filter-pill__ripple';
        btn.appendChild(ripple);
        ripple.addEventListener('animationend', () => ripple.remove(), { once: true });
        updateFilterSummary();
        // Auto-collapse only when all filter categories have been selected
        clearTimeout(autoAdvanceTimer);
        const dst = getState();
        if (dst.occasion !== 'Any' && dst.neighborhood !== 'Anywhere' && dst.priceLevel !== 'Any' && dst.dietaryRestrictions.length > 0) {
          autoAdvanceTimer = setTimeout(() => collapseFilters(), 600);
        }
        break;
      }

      // V5: Open Now toggle
      case 'toggle-open-now': {
        const isActive = btn.getAttribute('aria-pressed') === 'true';
        btn.setAttribute('aria-pressed', String(!isActive));
        setState({ openNow: !isActive });
        haptic(HAPTICS.tick);
        // Ink ripple feedback
        const rippleEl = document.createElement('span');
        rippleEl.className = 'filter-pill__ripple';
        btn.appendChild(rippleEl);
        rippleEl.addEventListener('animationend', () => rippleEl.remove(), { once: true });
        updateFilterSummary();
        break;
      }

      // F14: Surprise Me — slot-machine shuffle animation
      case 'surprise-me': {
        haptic(HAPTICS.tick);
        const surprisePrompts = [
          "surprise me with the best spot tonight",
          "the most underrated gem nearby",
          "whatever locals are obsessed with",
          "a place that'll blow my mind",
          "the hidden gem nobody talks about",
          "something completely different",
          "the best meal I'll have this month",
          "chef's pick — go wild",
        ];
        // Spring feedback on button
        btn.classList.add('chip-pop');
        btn.addEventListener('animationend', () => btn.classList.remove('chip-pop'), { once: true });

        // Pick the final prompt
        const finalPrompt = surprisePrompts[Math.floor(Math.random() * surprisePrompts.length)];

        if ($cravingInput) {
          // Shimmer effect on input
          $cravingInput.classList.add('craving-input--surprising');
          $cravingInput.addEventListener('animationend', () => $cravingInput.classList.remove('craving-input--surprising'), { once: true });

          // Slot-machine shuffle: cycle through 4 random prompts rapidly before settling
          let shuffleCount = 0;
          const shuffleMax = 4;
          const shuffleInterval = setInterval(() => {
            const randPrompt = surprisePrompts[Math.floor(Math.random() * surprisePrompts.length)];
            $cravingInput.value = randPrompt;
            shuffleCount++;
            if (shuffleCount >= shuffleMax) {
              clearInterval(shuffleInterval);
              $cravingInput.value = finalPrompt;
              $cravingInput.style.height = 'auto';
              $cravingInput.style.height = $cravingInput.scrollHeight + 'px';
              setState({ craving: finalPrompt, excludeIds: [] });
              updateCtaState();
              // Auto-submit after a brief pause
              setTimeout(() => handleSubmit(), 600);
            }
          }, 120);
        } else {
          setState({ craving: finalPrompt, excludeIds: [] });
          updateCtaState();
          setTimeout(() => handleSubmit(), 800);
        }
        break;
      }

      // F11: Feedback (like/dislike) — togglable: tap again to undo
      case 'feedback': {
        haptic(HAPTICS.tick);
        const fb = btn.dataset.feedback;
        const resultData = getState().result;
        const restaurantId = resultData?.restaurant?.id;
        if (!restaurantId || !fb) break;
        const userId = getOrCreateUserId();
        const isAlreadyActive = btn.classList.contains('feedback-btn--active');
        if (isAlreadyActive) {
          // Undo: clear feedback
          clearFeedback(restaurantId);
          setState({ pendingFeedback: null });
          btn.classList.remove('feedback-btn--active');
          sendFeedback(restaurantId, null, userId); // clear on server
          showToast(toasts().feedbackCleared, false);
        } else {
          // Set feedback (or switch from opposite)
          saveFeedback(restaurantId, fb);
          setState({ pendingFeedback: { restaurant_id: restaurantId, feedback: fb } });
          document.querySelectorAll('.feedback-btn').forEach(b => b.classList.remove('feedback-btn--active'));
          btn.classList.add('feedback-btn--active');
          sendFeedback(restaurantId, fb, userId); // dispatch immediately
          showToast(fb === 'like' ? toasts().feedbackLike : toasts().feedbackDislike, false);
        }
        break;
      }

      // F4: Bookmark toggle
      case 'bookmark': {
        haptic(HAPTICS.doublePulse);
        const result = getState().result;
        const restaurant = result?.restaurant;
        if (!restaurant?.id) break;
        const wasBookmarked = isBookmarked(restaurant.id);
        if (wasBookmarked) {
          removeBookmark(restaurant.id);
          // SSO: sync removal to server
          if (isAuthAuthenticated()) removeFavoriteFromServer(restaurant.id);
        } else {
          addBookmark(restaurant);
          // SSO: sync addition to server
          if (isAuthAuthenticated()) addFavoriteToServer(restaurant);
        }
        updateBookmarkBtn(restaurant.id);
        renderSavedSpots();
        const t = toasts();
        const savedMsg = isAuthAuthenticated()
          ? (wasBookmarked ? t.bookmarkRemove : t.bookmarkAddAuth)
          : (wasBookmarked ? t.bookmarkRemove : t.bookmarkAdd);
        showToast(savedMsg, false);
        break;
      }

      // "I'm Going Here!" — strongest engagement signal
      case 'going': {
        haptic(HAPTICS.celebration);
        const result = getState().result;
        const restaurant = result?.restaurant;
        if (!restaurant?.id) break;
        if (isVisited(restaurant.id)) break; // Already marked
        addVisit(restaurant);
        const goingUserId = getOrCreateUserId();
        sendVisit(restaurant, goingUserId);
        // SSO: also write with auth_user_id for richer data
        if (isAuthAuthenticated()) addVisitToServer(restaurant);
        updateGoingBtn(restaurant.id);
        renderVisitedSpots();
        showToast(toasts().goingHere, false);
        break;
      }

      // App Feedback Sheet
      case 'open-app-feedback': {
        openFeedbackSheet();
        break;
      }

      case 'close-app-feedback': {
        closeFeedbackSheet();
        break;
      }

      case 'select-feedback-cat': {
        haptic(HAPTICS.tick);
        const wasPressed = btn.getAttribute('aria-pressed') === 'true';
        document.querySelectorAll('.feedback-cat-pill').forEach(b => b.setAttribute('aria-pressed', 'false'));
        btn.setAttribute('aria-pressed', String(!wasPressed));
        updateFeedbackSubmitState();
        break;
      }

      case 'submit-app-feedback': {
        const selectedCat = document.querySelector('.feedback-cat-pill[aria-pressed="true"]');
        const category = selectedCat?.dataset.category;
        const messageEl = document.getElementById('feedback-text');
        const message = messageEl?.value?.trim();
        if (!category || !message) break;
        const fbUserId = getOrCreateUserId();
        sendAppFeedback(category, message, fbUserId);
        closeFeedbackSheet();
        showToast(toasts().feedbackSent, false);
        break;
      }

      case 'submit':
        setState({ excludeIds: [] });
        handleSubmit();
        break;

      case 'try-again': {
        // Track current restaurant ID so backend can exclude it
        const prevId = getState().result?.restaurant?.id;
        if (prevId) {
          const exclude = [...getState().excludeIds];
          if (!exclude.includes(prevId)) exclude.push(prevId);
          setState({ excludeIds: exclude });
        }
        const MAX_EXCLUDES = 15;
        const currentExcludes = getState().excludeIds.length;
        if (currentExcludes >= MAX_EXCLUDES) {
          // Exhausted — don't submit, show guidance
          showToast("You've seen all top picks for this search. Try starting over with different cravings!", false);
          break;
        }
        handleSubmit();
        break;
      }

      case 'open-themes':
        toggleColorPopover();
        break;

      case 'close-color-popover': {
        closeColorPopover();
        break;
      }

      case 'toggle-colormode': {
        const newMode = getColorMode() === 'auto' ? 'off' : 'auto';
        setColorMode(newMode);
        updateColorPopoverState();
        break;
      }

      case 'select-culture': {
        const culture = btn.dataset.theme;
        if (getColorMode() === 'off') break;
        if (getState().theme.culture === culture && isManualOverride()) {
          // Tapping active dot clears manual override → back to auto
          setManualOverride(false);
          revertAutoTheme();
        } else {
          setManualOverride(true);
          setTheme(culture, getState().theme.mode);
        }
        updateColorPopoverDots();
        break;
      }

      case 'toggle-mode': {
        const currentMode = getState().theme.mode;
        const newMode = currentMode === 'light' ? 'dark' : 'light';
        setTheme(getState().theme.culture, newMode);
        break;
      }

      case 'toggle-color': {
        toggleColorPopover();
        break;
      }

      case 'toggle-sound':
        toggleSound();
        break;

      case 'toggle-badge-popout': {
        const isOpen = btn.getAttribute('aria-expanded') === 'true';
        if (isOpen) closeBadgePopout();
        else openBadgePopout(btn);
        break;
      }

      case 'share':
        shareResult();
        break;

      case 'close-share':
        closeShareSheet();
        break;

      case 'share-channel':
        handleShareChannel(btn.dataset.channel);
        break;

      // SSO: Auth events
      case 'toggle-auth': {
        if (isAuthAuthenticated()) {
          toggleUserMenu();
        } else {
          openAuthSheet();
        }
        break;
      }

      case 'sign-in': {
        const provider = btn.dataset.provider;
        if (provider) signInWith(provider);
        break;
      }

      case 'close-auth':
        closeAuthSheet();
        break;

      case 'guest-dismiss':
        closeAuthSheet();
        setGuestDismissed();
        if (!hasSeenOnboarding()) setTimeout(() => showCoachMarks(), 600);
        break;

      case 'sign-out':
        authSignOut().then(() => {
          closeUserMenu();
          showToast(toasts().signedOut);
        });
        break;

      case 'close-user-menu':
        closeUserMenu();
        break;

      case 'clear-filters': {
        setState({ occasion: 'Any', neighborhood: 'Anywhere', priceLevel: 'Any' });
        clearAllSelections();
        updateFilterSummary();
        clearEmptyState();
        showToast(toasts().filtersCleared);
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
        showToast(toasts().filtersRandom);
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

      case 'close-lightbox':
        closeLightbox();
        break;

      case 'dismiss-coach':
        dismissCoachMark();
        break;


      case 'show-match-info': {
        showToast(toasts().matchExplainer);
        break;
      }

      case 'show-vibe-info': {
        showToast(toasts().vibeExplainer);
        break;
      }

      case 'expand-tier-2': {
        const $tier2 = document.getElementById('tier-leanin');
        const isExpanded = btn.getAttribute('aria-expanded') === 'true';
        btn.setAttribute('aria-expanded', String(!isExpanded));
        if ($tier2) {
          $tier2.classList.toggle('tier--expanded');
          $tier2.setAttribute('aria-hidden', String(isExpanded));
        }
        const $btnText = btn.querySelector('.tell-more-btn__text');
        if ($btnText) $btnText.textContent = isExpanded ? 'Show More' : 'Show Less';
        if (!isExpanded) {
          renderTier2Animations();
          // Scroll to Score Hero (same behavior as Match Mini tap)
          setTimeout(() => {
            document.getElementById('score-hero')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
          }, 200);
          announce('Showing more details');
        } else {
          // Collapsing
          resetBloomState();
        }
        break;
      }

      case 'toggle-factors':
      case 'show-vibe-profile': {
        // Toggle factor bars (2-state: compact <-> expanded)
        const data = _pendingResultData;
        if (!data) break;
        const newState = toggleBloom(
          data.scores || {},
          data.scoring || data.scoring_v5 || null,
          animationTimers,
          data
        );
        // Update callout arrow direction
        const $calloutArrow = document.getElementById('score-hero-callout')
          ?.querySelector('.score-hero__callout-arrow');
        if ($calloutArrow) {
          $calloutArrow.textContent = newState === 'compact' ? '\u2193' : '\u2191';
        }
        announce(newState === 'expanded' ? 'Showing score factors' : 'Collapsed score factors');
        break;
      }

      // Tier 3 removed — badges now live in Tier 2
    }
  });

  // Match Mini tap → toggle Tier 2 and scroll to Score Hero
  document.getElementById('match-pill')?.addEventListener('click', () => {
    const $tellMore = document.getElementById('tell-more-btn');
    if ($tellMore) {
      $tellMore.click(); // Always toggle — expand-tier-2 handler manages state
    }
    // Only scroll to Score Hero when expanding (after the click has toggled state)
    if ($tellMore && $tellMore.getAttribute('aria-expanded') === 'true') {
      setTimeout(() => {
        document.getElementById('score-hero')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }, 200);
    }
    haptic(HAPTICS.tick);
  });

  // Badge popout: click-outside to close
  document.addEventListener('click', (e) => {
    if (_activePopout && !_activePopout.badge.contains(e.target)) {
      closeBadgePopout();
    }
  });

  // Badge popout: keyboard support (Enter/Space to toggle, Escape to close)
  document.addEventListener('keydown', (e) => {
    if ((e.key === 'Enter' || e.key === ' ') && e.target.dataset?.action === 'toggle-badge-popout') {
      e.preventDefault();
      const isOpen = e.target.getAttribute('aria-expanded') === 'true';
      if (isOpen) closeBadgePopout();
      else openBadgePopout(e.target);
    }
    if (e.key === 'Escape' && _activePopout) {
      const badge = _activePopout.badge;
      closeBadgePopout();
      badge.focus();
    }
  });
}

/* ---- Craving Input + Autocomplete ---- */
let placeholderInterval = null;
let activeIndex = -1;

/* ---- Suggestion Scoring Engine ---- */
function scoreSuggestion(item, query) {
  const text = item.text.toLowerCase();
  const q = query.toLowerCase();
  let score = 0;

  // Exact prefix match → 100 pts
  if (text.startsWith(q)) {
    score += 100;
  }
  // Word-start match ("rom" → "romantic dinner") → 75 pts
  else if (text.split(/\s+/).some(word => word.startsWith(q))) {
    score += 75;
  }
  // Multi-word partial (each query word matches a suggestion word start) → 30-60 pts
  else {
    const queryWords = q.split(/\s+/).filter(Boolean);
    const textWords = text.split(/\s+/);
    let matched = 0;
    for (const qw of queryWords) {
      if (textWords.some(tw => tw.startsWith(qw))) matched++;
    }
    if (matched > 0 && queryWords.length > 0) {
      score += 30 + (matched / queryWords.length) * 30;
    }
    // Contains match → 20 pts
    else if (text.includes(q)) {
      score += 20;
    }
  }

  // Precision bonus: shorter suggestions rank higher when scores tie
  if (score > 0) {
    score += Math.max(0, 10 - text.length * 0.2);
  }

  return score;
}

function getFilteredSuggestions(query) {
  const culture = getState().theme.culture;
  const labels = getLabels(culture);
  const corpus = labels.suggestionCorpus;

  // Flatten corpus into single array
  const items = [];
  if (corpus) {
    for (const [, category] of Object.entries(corpus)) {
      if (Array.isArray(category)) items.push(...category);
    }
  }

  // Add history items as suggestions
  loadHistory().forEach(h => {
    if (h.label) {
      items.push({ text: h.label, icon: h.cuisineIcon || 'plate', category: 'Recent' });
    }
  });

  // Legacy suggestions as fallback
  if (labels.suggestions) {
    labels.suggestions.forEach(s => {
      if (!items.some(i => i.text.toLowerCase() === s.toLowerCase())) {
        items.push({ text: s, icon: 'plate', category: 'Suggestion' });
      }
    });
  }
  if (labels.smartChips) {
    labels.smartChips.forEach(s => {
      if (!items.some(i => i.text.toLowerCase() === s.toLowerCase())) {
        items.push({ text: s, icon: 'plate', category: 'Suggestion' });
      }
    });
  }

  // Score all items
  const scored = items
    .map(item => ({ ...item, score: scoreSuggestion(item, query) }))
    .filter(item => item.score > 0);

  // Deduplicate by text
  const seen = new Set();
  const deduped = [];
  for (const item of scored.sort((a, b) => b.score - a.score)) {
    const key = item.text.toLowerCase();
    if (!seen.has(key)) {
      seen.add(key);
      deduped.push(item);
    }
  }

  return deduped.slice(0, 7);
}

/* ---- Contextual Suggestions (on focus with empty input) ---- */
function showContextualSuggestions() {
  const culture = getState().theme.culture;
  const labels = getLabels(culture);
  const corpus = labels.suggestionCorpus;
  if (!corpus || !$suggestions) return;

  const items = [];
  const combos = corpus.combos || [];
  const vibes = corpus.vibes || [];
  const cuisines = corpus.cuisines || [];

  // "Right Now" — 3 contextual picks (combos + vibes shuffled)
  const contextual = [...combos, ...vibes].sort(() => Math.random() - 0.5);
  items.push(...contextual.slice(0, 3).map(i => ({ ...i, category: 'Right Now' })));

  // "Popular" — 4 cuisine picks
  const popular = [...cuisines].sort(() => Math.random() - 0.5);
  items.push(...popular.slice(0, 4).map(i => ({ ...i, category: 'Popular' })));

  renderSuggestions(items, '');
}

/* ---- Rich Suggestion Rendering (icons + categories + highlights) ---- */
function renderSuggestions(matches, query) {
  if (!$suggestions || matches.length === 0) {
    closeSuggestions();
    return;
  }

  $suggestions.innerHTML = '';
  activeIndex = -1;

  let lastCategory = null;

  matches.forEach((item, i) => {
    // Handle both string and object items
    const text = typeof item === 'string' ? item : item.text;
    const iconName = typeof item === 'object' ? item.icon : null;
    const category = typeof item === 'object' ? item.category : null;

    // Category separator
    if (category && category !== lastCategory) {
      lastCategory = category;
      const sep = document.createElement('div');
      sep.className = 'craving-suggestion__category type-data--sm';
      sep.textContent = category;
      $suggestions.appendChild(sep);
    }

    const div = document.createElement('div');
    div.className = 'craving-suggestion';
    div.setAttribute('role', 'option');
    div.setAttribute('id', `suggestion-${i}`);
    div.dataset.value = text;

    // SVG icon
    if (iconName) {
      const iconSpan = document.createElement('span');
      iconSpan.className = 'craving-suggestion__icon';
      iconSpan.innerHTML = svgIcon(iconName, 14);
      div.appendChild(iconSpan);
    }

    // Text with match highlighting
    const textSpan = document.createElement('span');
    textSpan.className = 'craving-suggestion__text';
    if (query) {
      const lowerText = text.toLowerCase();
      const q = query.toLowerCase();
      const matchStart = lowerText.indexOf(q);
      if (matchStart >= 0) {
        const before = text.slice(0, matchStart);
        const match = text.slice(matchStart, matchStart + query.length);
        const after = text.slice(matchStart + query.length);
        textSpan.innerHTML = `${before}<mark>${match}</mark>${after}`;
      } else {
        textSpan.textContent = text;
      }
    } else {
      textSpan.textContent = text;
    }
    div.appendChild(textSpan);

    $suggestions.appendChild(div);
  });

  $suggestions.hidden = false;
  if ($cravingInput) $cravingInput.setAttribute('aria-expanded', 'true');
}

function closeSuggestions() {
  if (!$suggestions) return;
  $suggestions.hidden = true;
  $suggestions.innerHTML = '';
  activeIndex = -1;
  if ($cravingInput) {
    $cravingInput.removeAttribute('aria-activedescendant');
    $cravingInput.setAttribute('aria-expanded', 'false');
  }
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
    clearEmptyState();
    // F19: Auto-grow textarea
    $cravingInput.style.height = 'auto';
    $cravingInput.style.height = $cravingInput.scrollHeight + 'px';

    // Debounced chip reactivity
    clearTimeout(chipDebounce);
    chipDebounce = setTimeout(() => {
      updateChipsForInput($cravingInput.value.trim());
    }, 300);

    // Debounced auto-theme detection (visual palette only, gated on colorMode)
    clearTimeout(autoThemeDebounce);
    if (getColorMode() === 'auto') {
      autoThemeDebounce = setTimeout(() => {
        const val = $cravingInput.value.trim();
        if (!val) {
          revertAutoTheme();
          return;
        }
        const detected = matchCulture(val);
        if (detected) {
          setThemeVisualOnly(detected);
        } else {
          revertAutoTheme();
        }
      }, 300);
    }

    // Scored autocomplete (1-char trigger)
    const query = $cravingInput.value.trim();
    if (query.length < 1) {
      closeSuggestions();
      return;
    }
    const matches = getFilteredSuggestions(query);
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

    // F19: Enter submits, Shift+Enter inserts new line (textarea)
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  });

  // Stop placeholder rotation on focus, show contextual suggestions if empty
  $cravingInput.addEventListener('focus', () => {
    if (placeholderInterval) { clearInterval(placeholderInterval); placeholderInterval = null; }
    // Show "Right Now" / "Popular" picks when input is empty
    if (!$cravingInput.value.trim()) {
      showContextualSuggestions();
    }
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

let ctaBreathTimer = null;

function updateCtaState() {
  const $cta = document.querySelector('.cta-btn[data-action="submit"]');
  const $hint = document.getElementById('cta-hint');
  const isEmpty = !$cravingInput?.value.trim();
  const wasDisabled = $cta?.disabled;

  if ($cta) {
    $cta.disabled = isEmpty;
    $cta.setAttribute('aria-disabled', String(isEmpty));

    if (isEmpty) {
      // Disable: kill ready pulse
      $cta.classList.remove('cta-btn--ready');
      if (ctaBreathTimer) { clearTimeout(ctaBreathTimer); ctaBreathTimer = null; }
    } else if (wasDisabled && !isEmpty) {
      // Just enabled: one-shot ready pulse (no infinite breathing)
      $cta.classList.add('cta-btn--ready');
      if (ctaBreathTimer) clearTimeout(ctaBreathTimer);
      ctaBreathTimer = setTimeout(() => {
        $cta.classList.remove('cta-btn--ready');
      }, 400);
    }
  }
  if ($hint) {
    $hint.classList.toggle('cta-hint--visible', isEmpty);
  }
}

/* ---- Filter Selection (with ink ripple) ---- */
function selectFilter(field, btn) {
  haptic(HAPTICS.tick);
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
  boostCta();

  // Auto-collapse only when all filter categories have been selected
  clearTimeout(autoAdvanceTimer);
  const st = getState();
  if (st.occasion !== 'Any' && st.neighborhood !== 'Anywhere' && st.priceLevel !== 'Any' && st.dietaryRestrictions.length > 0) {
    autoAdvanceTimer = setTimeout(() => collapseFilters(), 600);
  }
}

let autoAdvanceTimer = null;

function boostCta() {
  const $cta = document.querySelector('.cta-btn');
  if (!$cta || $cta.disabled) return;
  $cta.classList.remove('cta-btn--boosted');
  // Force reflow to restart animation
  void $cta.offsetWidth;
  $cta.classList.add('cta-btn--boosted');
  $cta.addEventListener('animationend', () => $cta.classList.remove('cta-btn--boosted'), { once: true });
}

function clearAllSelections() {
  document.querySelectorAll('.filter-pill[aria-checked="true"]').forEach(c => {
    c.setAttribute('aria-checked', 'false');
  });
}

function syncFilterPillsToState() {
  const s = getState();
  const mapping = {
    'select-occasion': s.occasion,
    'select-neighborhood': s.neighborhood,
    'select-budget': s.priceLevel,
  };
  for (const [action, value] of Object.entries(mapping)) {
    document.querySelectorAll(`.filter-pill[data-action="${action}"]`).forEach(pill => {
      pill.setAttribute('aria-checked', String(pill.dataset.value === value));
    });
  }
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
  if (s.dietaryRestrictions?.length) parts.push(s.dietaryRestrictions.join(', '));
  if (s.openNow) parts.push('Open Now');
  const $summary = document.getElementById('filter-summary');
  if ($summary) {
    $summary.textContent = parts.length ? parts.join(' \u00B7 ') : '';
  }
  // Filter count badge — inline element after "Filters" label
  const $count = document.getElementById('filter-count');
  if ($count) {
    $count.textContent = parts.length ? String(parts.length) : '';
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
    showToast(toasts().offline, true, {
      label: 'Try Again',
      callback: () => handleSubmit(),
    });
    return;
  }

  // Cancel any in-flight request
  if (currentAbort) currentAbort.abort();
  currentAbort = new AbortController();

  // Set CTA to loading state with brief confirmation glow
  const $cta = document.querySelector('.cta-btn[data-action="submit"]');
  if ($cta) {
    $cta.classList.remove('cta-btn--ready');
    $cta.classList.add('cta-btn--confirming');
    await new Promise(r => setTimeout(r, 200));
    $cta.classList.remove('cta-btn--confirming');
    $cta.classList.add('cta-btn--loading');
    $cta.textContent = 'Searching';
  }

  setState({ loading: true, error: null, result: null });
  clearEmptyState();
  // Don't goToStep(1) — the loading overlay covers everything;
  // step-track positioning happens in orchestrateReveal()

  // Ambient blob pulse on submit (canvas responds to user)
  pulseAmbient();

  try {
    const payload = {
      special_request: s.craving,
      occasion: s.occasion,
      neighborhood: s.neighborhood,
      price_level: s.priceLevel,
    };
    if (s.excludeIds.length) payload.exclude = s.excludeIds;
    // F5: Dietary restrictions
    if (s.dietaryRestrictions.length) payload.dietary_restrictions = s.dietaryRestrictions;
    // V5: Open Now filter
    if (s.openNow) payload.open_now = true;
    // F9: Anonymous user ID for personalization
    payload.user_id = getOrCreateUserId();
    // F11: Send pending feedback with request
    if (s.pendingFeedback) {
      payload.feedback = s.pendingFeedback;
      setState({ pendingFeedback: null });
    }
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
    renderTasteMemory(); // Refresh taste memory with new entry
    playChime();
    announce(`Recommendation: ${data.restaurant?.name || 'found'}`);
  } catch (err) {
    if (err.name === 'AbortError') return; // user navigated away
    // Error: clean up loading state and return to input
    toggleLoading(false);
    setState({ loading: false });
    goToStep(0);
    // Show persistent inline feedback on canvas + toast with retry
    showEmptyState(err.message || toasts().noResults);
    showToast(err.message || toasts().genericError, true, {
      label: 'Retry',
      callback: () => handleSubmit(),
    });
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

/* ---- Skip Loading on Tap ---- */
function _skipLoading() {
  const state = getState();
  if (state.result) {
    // Result already arrived — skip directly to reveal
    resolveLogoToFound();
    setTimeout(() => orchestrateReveal(state.result), 100);
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
      // Tap-to-skip: if result arrives during animation, user can skip
      $loadingState.addEventListener('click', _skipLoading, { once: true });
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

    // Show result skeleton preview after logo draw-in
    const $skeleton = document.getElementById('result-skeleton');
    if ($skeleton) {
      setTimeout(() => {
        $skeleton.classList.add('result-skeleton--visible');
      }, 800);
    }

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
    // Hide skeleton
    const $skeleton = document.getElementById('result-skeleton');
    if ($skeleton) $skeleton.classList.remove('result-skeleton--visible');

    // Stop animations
    clearSearchingDots();
    stopParticles();
    cleanupLoadingLogo();

    // Remove defocus from input page
    if ($step0) $step0.classList.remove('step--defocused');

    // Hide loading overlay and remove skip handler
    if ($loadingState) {
      $loadingState.removeEventListener('click', _skipLoading);
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
    $resultCard.style.display = '';
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

  // F18: Haptic feedback on reveal (mobile only, graceful degrade)
  haptic(HAPTICS.reveal);

  // V5: Score celebration for 88%+ matches (Perfect Match tier)
  const celebScore = Math.round(parseFloat(data.donde_match) || 0);
  if (celebScore >= 88) {
    // Delay slightly so the score ring animation finishes first
    animationTimers.push(setTimeout(() => {
      fireCelebration();
      playCelebrationChime();
      haptic(HAPTICS.celebration);
    }, 1600));
  }

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

  // Schedule edge-hint replays (remind user they can swipe back)
  scheduleEdgeHintReplay();
}

/* ---- Edge Hint Replay ---- */
let edgeHintTimers = [];
function scheduleEdgeHintReplay() {
  clearEdgeHintTimers();
  const $step1 = document.querySelector('.step[data-step="1"]');
  if (!$step1) return;
  let replays = 0;
  const replay = () => {
    if (replays >= 2 || getState().step !== 1) return;
    replays++;
    $step1.classList.add('edge-hint-replay');
    requestAnimationFrame(() => {
      $step1.classList.remove('edge-hint-replay');
      $step1.classList.add('edge-hint-replay-run');
      $step1.addEventListener('animationend', () => {
        $step1.classList.remove('edge-hint-replay-run');
      }, { once: true });
    });
  };
  edgeHintTimers.push(setTimeout(replay, 8000));
  edgeHintTimers.push(setTimeout(replay, 16000));
}
function clearEdgeHintTimers() {
  edgeHintTimers.forEach(clearTimeout);
  edgeHintTimers = [];
}

/* ---- Result Rendering ---- */
function renderResult(data) {
  if (!data?.restaurant) return;
  const r = data.restaurant;

  // Cancel any in-flight animation timeouts from a previous render
  animationTimers.forEach(clearTimeout);
  animationTimers = [];

  // Reset tier animation flags for fresh render
  _tier2Animated = false;
  // Reset typewriter flags on story elements
  const $storyTipEl = document.getElementById('story-tip-text');
  if ($storyTipEl) $storyTipEl._hasRevealed = false;

  // Reset bloom state (petal radar overlay)
  resetBloomState();

  // Reset tier expansion state — always start at Tier 1 (Glance)
  const $tier2 = document.getElementById('tier-leanin');
  const $tellMore = document.getElementById('tell-more-btn');
  if ($tier2) { $tier2.classList.remove('tier--expanded'); $tier2.setAttribute('aria-hidden', 'true'); }
  if ($tellMore) { $tellMore.setAttribute('aria-expanded', 'false'); const t = $tellMore.querySelector('.tell-more-btn__text'); if (t) t.textContent = 'Show More'; }

  // Cuisine detection (for accent color + auto-theme)
  const cuisine = getCuisineFromResult(data);

  // Auto-theme on result
  if (getColorMode() === 'auto') {
    if (cuisine.culture) {
      setTheme(cuisine.culture, getState().theme.mode);
    } else {
      revertAutoTheme();
    }
  }

  // F1: Render restaurant photos
  renderPhotos(data);

  // Cuisine accent color on card border
  if ($resultCard && cuisine.hue !== null) {
    $resultCard.classList.add('result-card--cuisine-accent');
    $resultCard.style.setProperty('--cuisine-hue', cuisine.hue);
  } else if ($resultCard) {
    $resultCard.classList.remove('result-card--cuisine-accent');
  }

  // ═══════════════════════════════════════════════════════
  // TIER 1: GLANCE — "Is this place for me?" (< 2 seconds)
  // ═══════════════════════════════════════════════════════

  // DondeAI Match pill — the brand hero moment
  const dondeScore = Math.round(parseFloat(data.donde_match) || 80);
  const $matchScore = document.getElementById('match-pill-score');
  const $matchVerdict = document.getElementById('match-pill-verdict');
  if ($matchScore) $matchScore.textContent = '0'; // Will animate up
  const tier = getScoreTier(dondeScore);
  const $matchPill = document.getElementById('match-pill');
  if ($matchPill) $matchPill.setAttribute('data-tier', tier.tier);
  if ($matchVerdict) {
    $matchVerdict.textContent = tier.verdict;
    $matchVerdict.setAttribute('data-tier', tier.tier);
  }

  // Micro arc setup
  const $arcFill = document.getElementById('match-pill-arc-fill');
  const arcLength = Math.PI * 20; // ~62.83 (r=20 semicircle)
  if ($arcFill) {
    $arcFill.style.strokeDasharray = String(arcLength);
    $arcFill.style.strokeDashoffset = String(arcLength); // Start empty
  }

  // Animate score count-up + arc fill + progressive color coding
  const REDUCED_MQ = matchMedia('(prefers-reduced-motion: reduce)');
  if ($matchScore && !REDUCED_MQ.matches) {
    animationTimers.push(setTimeout(() => {
      const duration = 1400;
      const start = performance.now();
      const animate = (now) => {
        const elapsed = now - start;
        const progress = Math.min(elapsed / duration, 1);
        const eased = 1 - Math.pow(1 - progress, 3);
        const current = Math.round(eased * dondeScore);
        $matchScore.textContent = current;
        const thresholdColor = getScoreThresholdColor(current);
        $matchScore.style.color = thresholdColor;
        // Update arc fill + color
        if ($arcFill) {
          $arcFill.style.strokeDashoffset = String(arcLength - (current / 100) * arcLength);
          $arcFill.style.stroke = thresholdColor;
        }
        if (progress < 1) {
          requestAnimationFrame(animate);
        } else if ($arcFill) {
          $arcFill.style.animation = 'arcSettle 400ms var(--spring)';
        }
      };
      requestAnimationFrame(animate);
    }, 200));
  } else if ($matchScore) {
    $matchScore.textContent = dondeScore;
    const finalColor = getScoreThresholdColor(dondeScore);
    $matchScore.style.color = finalColor;
    if ($arcFill) {
      $arcFill.style.strokeDashoffset = String(arcLength - (dondeScore / 100) * arcLength);
      $arcFill.style.stroke = finalColor;
    }
  }

  // Restaurant name
  const $name = document.getElementById('result-name');
  if ($name) $name.textContent = r.name || '';

  // One-liner subtitle
  // One-liner removed from result card (AI blurb replaces it).
  // best_for_oneliner is still used in share canvas rendering.

  // Quick tags: interactive badges with popouts
  const $quickTags = document.getElementById('quick-tags');
  if ($quickTags) {
    $quickTags.innerHTML = '';

    // Cuisine tag — interactive with "What to Order" popout
    const cuisineLabel = data.deep_context?.cuisine_subcategory || r.cuisine_type;
    if (cuisineLabel) {
      const tag = document.createElement('span');
      tag.className = 'quick-tag quick-tag--interactive type-data--sm';
      tag.setAttribute('role', 'button');
      tag.setAttribute('tabindex', '0');
      tag.setAttribute('aria-expanded', 'false');
      tag.setAttribute('aria-haspopup', 'true');
      tag.setAttribute('data-action', 'toggle-badge-popout');
      tag.innerHTML = `${svgIcon(cuisine.icon || 'plate', 12)} ${shortenBadgeValue(cuisineLabel)}`;
      const dishes = data.deep_context?.signature_dishes;
      if (dishes?.length) {
        const popout = document.createElement('div');
        popout.className = 'badge-popout';
        popout.setAttribute('role', 'tooltip');
        const title = document.createElement('span');
        title.className = 'badge-popout__title';
        title.textContent = 'What to Order';
        popout.appendChild(title);
        const pillsWrap = document.createElement('div');
        pillsWrap.className = 'badge-popout__pills';
        dishes.slice(0, 4).forEach(d => {
          const pill = document.createElement('span');
          pill.className = 'badge-popout__pill badge-popout__pill--dish';
          pill.textContent = d.dish;
          if (d.description) pill.title = d.description;
          pillsWrap.appendChild(pill);
        });
        popout.appendChild(pillsWrap);
        tag.appendChild(popout);
      }
      $quickTags.appendChild(tag);
    }

    // Google Rating tag — interactive with review details + sentiment popout
    if (r.google_rating) {
      const tag = document.createElement('span');
      tag.className = 'quick-tag quick-tag--interactive type-data--sm';
      tag.setAttribute('role', 'button');
      tag.setAttribute('tabindex', '0');
      tag.setAttribute('aria-expanded', 'false');
      tag.setAttribute('aria-haspopup', 'true');
      tag.setAttribute('data-action', 'toggle-badge-popout');
      tag.innerHTML = `${svgIcon('starFull', 12)} ${parseFloat(r.google_rating).toFixed(1)}`;
      tag.style.color = 'var(--star-gold)';

      const popout = document.createElement('div');
      popout.className = 'badge-popout';
      popout.setAttribute('role', 'tooltip');

      const starsRow = document.createElement('div');
      starsRow.className = 'badge-popout__stars-row';
      starsRow.innerHTML = buildGoogleStars(r.google_rating);
      popout.appendChild(starsRow);

      const ratingLine = document.createElement('div');
      ratingLine.className = 'badge-popout__body';
      const ratingNum = `<strong>${parseFloat(r.google_rating).toFixed(1)}</strong>`;
      const googleUrl = r.google_place_id
        ? `https://www.google.com/maps/place/?q=place_id:${r.google_place_id}`
        : null;
      if (r.google_review_count) {
        const countText = `${Number(r.google_review_count).toLocaleString()} reviews`;
        if (googleUrl) {
          ratingLine.innerHTML = `${ratingNum} · <a class="badge-popout__link" href="${googleUrl}" target="_blank" rel="noopener noreferrer">${countText}</a>`;
        } else {
          ratingLine.innerHTML = `${ratingNum} · ${countText}`;
        }
      } else {
        ratingLine.innerHTML = ratingNum;
      }
      popout.appendChild(ratingLine);

      // "Powered by Google" attribution
      const attr = document.createElement('span');
      attr.className = 'badge-popout__google-attr';
      attr.setAttribute('translate', 'no');
      attr.textContent = 'Powered by Google';
      popout.appendChild(attr);

      // Sentiment details moved to Tier 2 — popout stays clean: stars + count + link
      tag.appendChild(popout);
      $quickTags.appendChild(tag);
    }

  }

  // F2: Open Now / Closed badge in quick tags
  renderOpenNowTag(data);

  // Quick actions row: Reserve, Share, Website, Phone (subtle utility pills)
  renderQuickActions(data);

  // F4: Set bookmark button state
  if (r.id) updateBookmarkBtn(r.id);

  // F11: Set feedback button state
  if (r.id) renderFeedbackState(r.id);

  // Set "I'm Going Here!" button state
  if (r.id) updateGoingBtn(r.id);

  // Cuisine mismatch notice
  const $mismatch = document.getElementById('cuisine-mismatch-notice');
  if ($mismatch) {
    if (data.cuisine_mismatch?.requested) {
      const mismatchText = $mismatch.querySelector('.cuisine-mismatch-notice__text');
      if (mismatchText) {
        mismatchText.textContent = `We don\u2019t have ${data.cuisine_mismatch.requested} spots in our collection yet. Here\u2019s our best pick instead.`;
      }
      $mismatch.style.display = '';
    } else {
      $mismatch.style.display = 'none';
    }
  }

  // V5: Intent Boost badge — shown between score arc and factor bars
  renderIntentBoostBadge(data);

  // V5: Relaxation notice — shown above result card when filters were expanded
  renderRelaxationNotice(data);

  // DondeAI Recommendation blurb — the editorial voice in Tier 1
  const $rec = document.getElementById('result-recommendation');
  const $blurb = document.getElementById('donde-blurb');
  if ($rec) {
    const recText = (data.recommendation || '').replace(/\u2014/g, ', ').replace(/ , /g, ', ').replace(/,\s*,/g, ',');
    $rec.textContent = recText;
    if ($blurb) {
      $blurb.style.display = recText ? '' : 'none';
      // V5: Boost-aware blurb accent border
      $blurb.classList.toggle('donde-blurb--boosted', !!data.intent_boost?.active);
    }
  }

  // "Why This Spot" removed — user feedback: not accurate, no value

  // F3: Enhanced map navigation tile
  renderMapPreview(data);

  // Inject icons into glance action buttons
  const $tryAgainIcon = document.getElementById('try-again-icon');
  if ($tryAgainIcon) $tryAgainIcon.innerHTML = svgIcon('refresh', 18);
  const $glanceStartOverIcon = document.getElementById('glance-start-over-icon');
  if ($glanceStartOverIcon) $glanceStartOverIcon.innerHTML = svgIcon('home', 18);

  // Update Try Another button with exhaustion indicator
  updateTryAgainState();

  // ═══════════════════════════════════════════════════════
  // TIER 2: LEAN-IN — Prepare content (hidden until expanded)
  // ═══════════════════════════════════════════════════════

  // Store data reference for lazy tier 2/3 rendering
  _pendingResultData = data;
  _pendingCuisine = cuisine;

  // Pre-populate Tier 2 content (DOM ready, just hidden)
  prepareTier2(data, cuisine);

  // Apply progressive reveal (Tier 1 only — Tier 2 animates on expand)
  if ($resultCard) {
    $resultCard.classList.remove('card-enter', 'result-card--revealing');
    void $resultCard.offsetWidth;
    $resultCard.classList.add('result-card--revealing');

    // Clean up reveal class after Tier 1 animations complete (last: glance-actions at 600ms + 300ms)
    setTimeout(() => {
      $resultCard.classList.remove('result-card--revealing');
      const glance = document.getElementById('tier-glance');
      if (glance) {
        glance.querySelectorAll(':scope > *').forEach(child => {
          child.style.opacity = '';
          child.style.transform = '';
        });
      }
    }, 1100);
  }
}

/* ---- Pending result data for lazy tier rendering ---- */
let _pendingResultData = null;
let _pendingCuisine = null;

/* ---- Prepare Tier 2 DOM content (populated but hidden) ---- */
function prepareTier2(data, cuisine) {
  const r = data.restaurant;

  // Score Hero arc — populate but don't animate yet (animations triggered on expand)
  renderScoreHero(
    data.donde_match,
    data.scores || {},
    data.scoring || data.scoring_v5 || null,
    null,
    []
  );

  // Recommendation is now rendered in Tier 1 (Glance) via donde-blurb

  // The Story: Origin Story + Insider Tip (dynamic label)
  const $story = document.getElementById('restaurant-story');
  const $storyOrigin = document.getElementById('story-origin-text');
  const $storyTip = document.getElementById('story-tip-text');
  const $storyLabel = document.getElementById('story-label');
  const $tipWrap = document.getElementById('story-tip-wrap');
  if ($story) {
    const dc = data.deep_context || {};
    let tipContent = data.insider_tip || '';
    tipContent = tipContent.replace(/\u2014/g, ', ').replace(/ , /g, ', ');

    let originContent = dc.origin_story || '';

    const hasOrigin = !!originContent;
    const hasTip = !!tipContent;
    const hasContent = hasOrigin || hasTip;
    $story.style.display = hasContent ? '' : 'none';

    // Dynamic section label: "The Story" when origin exists, "Insider Tip" when tip-only
    if ($storyLabel) {
      $storyLabel.textContent = hasOrigin ? 'The Story' : 'Insider Tip';
    }

    // Origin paragraph
    if ($storyOrigin) {
      $storyOrigin.textContent = originContent;
      $storyOrigin.style.display = hasOrigin ? '' : 'none';
    }

    // Insider Tip wrap (with sub-label when both origin + tip exist)
    if ($tipWrap) {
      $tipWrap.style.display = hasTip ? '' : 'none';
      const $tipLabel = $tipWrap.querySelector('.restaurant-story__tip-label');
      // Show "Insider Tip" sub-label only when origin is also present
      if ($tipLabel) $tipLabel.style.display = hasOrigin ? '' : 'none';
    }

    if ($storyTip && hasTip) {
      // Typewriter reveal for insider tips — "friend whispering a secret" feel
      if (!$storyTip._hasRevealed) {
        $storyTip._hasRevealed = true;
        $storyTip.textContent = '';
        animationTimers.push(setTimeout(() => {
          typewriterReveal($storyTip, tipContent, 45);
        }, 500));
      } else {
        $storyTip.textContent = tipContent;
      }
    } else if ($storyTip) {
      $storyTip.textContent = '';
    }
  }

  // Awards badges
  const $awards = document.getElementById('result-awards');
  if ($awards) {
    $awards.innerHTML = '';
    const dc = data.deep_context;
    const badges = [];
    if (dc?.awards_recognition?.length > 0) {
      dc.awards_recognition.slice(0, 3).forEach(a => badges.push({ text: a }));
    }
    if (badges.length > 0) {
      badges.forEach(b => {
        const span = document.createElement('span');
        span.className = 'award-pill type-data--sm';
        span.textContent = b.text;
        $awards.appendChild(span);
      });
      $awards.style.display = '';
    } else {
      $awards.style.display = 'none';
    }
  }



  // 1D: Deep context extras (USP, wow factors)
  renderDeepContextExtras(data);

}



/* ---- Tier 2 animation trigger (called on first expand) ---- */
let _tier2Animated = false;
function renderTier2Animations() {
  if (_tier2Animated) return;
  _tier2Animated = true;

  const data = _pendingResultData;
  if (!data) return;

  // Animate Score Hero arc (re-render with animation timers)
  renderScoreHero(
    data.donde_match,
    data.scores || {},
    data.scoring || data.scoring_v5 || null,
    null,
    animationTimers
  );
}


/* ---- Badge Value Shortener (first segment, no word cap) ---- */
function shortenBadgeValue(value) {
  if (!value) return '';
  return value.split(/[,/;]/).at(0).trim();
}

/* ---- Badge Popout Manager ---- */
let _activePopout = null;
let _popoutTimer = null;

function openBadgePopout(badgeEl) {
  closeBadgePopout();
  const popout = badgeEl.querySelector('.badge-popout');
  if (!popout) return;
  badgeEl.setAttribute('aria-expanded', 'true');
  // Reparent to body so backdrop-filter on ancestors can't trap fixed positioning
  document.body.appendChild(popout);
  popout.classList.add('badge-popout--open');
  _activePopout = { badge: badgeEl, popout };
  _popoutTimer = setTimeout(() => closeBadgePopout(), 5000);
  requestAnimationFrame(() => positionPopout(badgeEl, popout));
}

function closeBadgePopout() {
  if (_popoutTimer) { clearTimeout(_popoutTimer); _popoutTimer = null; }
  if (!_activePopout) return;
  const { badge, popout } = _activePopout;
  badge.setAttribute('aria-expanded', 'false');
  popout.classList.remove('badge-popout--open');
  popout.style.top = '';
  popout.style.left = '';
  popout.style.transformOrigin = '';
  // Return popout to its badge so querySelector still finds it next time
  badge.appendChild(popout);
  _activePopout = null;
}

function positionPopout(badgeEl, popout) {
  const br = badgeEl.getBoundingClientRect();
  const pw = popout.offsetWidth;
  const ph = popout.offsetHeight;
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const gap = 6;

  // Horizontal: left-align with badge, then clamp
  let left = br.left;
  if (left + pw > vw - 8) left = vw - 8 - pw;
  if (left < 8) left = 8;

  // Vertical: prefer below, flip above if no room
  let top = br.bottom + gap;
  let origin = 'top left';
  if (top + ph > vh - 8) {
    top = br.top - gap - ph;
    origin = 'bottom left';
  }

  popout.style.top = `${Math.round(top)}px`;
  popout.style.left = `${Math.round(left)}px`;
  popout.style.transformOrigin = origin;
}

/* ---- Sentiment Computation Helper ---- */
function computeSentiment(r) {
  let pos = null, neu = null, neg = null;
  if (r.sentiment_positive != null && r.sentiment_negative != null && r.sentiment_neutral != null) {
    pos = r.sentiment_positive; neu = r.sentiment_neutral; neg = r.sentiment_negative;
  } else if (r.sentiment_breakdown) {
    const parts = r.sentiment_breakdown.toLowerCase();
    const posMatch = parts.match(/(\d+)%?\s*positive/);
    const neuMatch = parts.match(/(\d+)%?\s*neutral/);
    const negMatch = parts.match(/(\d+)%?\s*negative/);
    if (posMatch || neuMatch || negMatch) {
      pos = parseInt(posMatch?.[1] || '33', 10);
      neu = parseInt(neuMatch?.[1] || '34', 10);
      neg = parseInt(negMatch?.[1] || '33', 10);
    }
  } else if (r.sentiment_score != null) {
    const score = parseFloat(r.sentiment_score);
    if (!isNaN(score)) {
      pos = Math.round((score / 10) * 100);
      neg = Math.round((1 - score / 10) * 30);
      neu = 100 - pos - neg;
    }
  }
  return pos != null ? { pos, neu, neg } : null;
}

/* ---- Render Quick Actions (Reserve, Share, Website, Phone — subtle row in tier 1) ---- */
function renderQuickActions(data) {
  const r = data.restaurant;
  const $actions = document.getElementById('quick-actions');
  if (!$actions) return;
  $actions.innerHTML = '';
  const items = [];

  // Reserve
  const reserveUrl = r.google_place_id
    ? `https://www.google.com/maps/place/?q=place_id:${r.google_place_id}`
    : r.website;
  if (reserveUrl) {
    items.push({ icon: 'calendar', label: 'Reserve', href: reserveUrl });
  }

  // Share
  items.push({ icon: 'shareNetwork', label: 'Share', action: 'share' });

  // Website
  if (r.website) {
    let hostname = 'Website';
    try { hostname = new URL(r.website).hostname.replace('www.', ''); } catch { /* keep fallback */ }
    items.push({ icon: 'globe', label: hostname, href: r.website });
  }

  // Phone
  if (r.phone) {
    items.push({ icon: 'phone', label: 'Call', href: `tel:${r.phone}` });
  }

  items.forEach(item => {
    const pill = item.href ? document.createElement('a') : document.createElement('span');
    pill.className = 'utility-pill type-data--sm';
    if (item.href) {
      pill.href = item.href;
      pill.target = item.href.startsWith('tel:') ? '_self' : '_blank';
      pill.rel = 'noopener noreferrer';
    }
    if (item.action) {
      pill.setAttribute('role', 'button');
      pill.setAttribute('tabindex', '0');
      pill.setAttribute('data-action', item.action);
    }
    pill.innerHTML = `${svgIcon(item.icon, 11)} ${item.label}`;
    $actions.appendChild(pill);
  });
  $actions.style.display = items.length > 0 ? '' : 'none';
}

/* humanizeSnake moved to utils.js — imported at top of file */

/* ---- Spice Level → Intuitive Label ---- */
function formatSpiceLevel(raw) {
  if (!raw) return '';
  const map = {
    none: 'Not Spicy', mild: 'Mild', low: 'Mild',
    medium: 'Medium', moderate: 'Medium',
    hot: 'Spicy', high: 'Spicy', very_hot: 'Very Spicy', extra_hot: 'Very Spicy',
  };
  return map[raw.toLowerCase()] || humanizeSnake(raw);
}

// Humanize a vibe score (0-10) to a user-friendly label
function humanizeVibe(val) {
  if (val >= 9) return 'Outstanding';
  if (val >= 7.5) return 'Strong';
  if (val >= 5.5) return 'Good';
  if (val >= 3.5) return 'Moderate';
  return 'Low';
}

// Humanize a V2 score (0-100) to a user-friendly label
function humanizeV2(val) {
  if (val >= 90) return 'Perfect';
  if (val >= 75) return 'Strong';
  if (val >= 60) return 'Good';
  if (val >= 40) return 'Fair';
  return 'Low';
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
      <div class="score-tile__brand" aria-label="Donde Match">
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
            class="score-tile__wordmark-ond">ond</span><span
            class="score-tile__wordmark-e">e</span>
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

    // V5: Factor breakdown — "Why This Match" (weighted factors)
    const sv4 = data.scoring || data.scoring_v5 || null;
    if (sv4) {
      const v5Dims = [
        { key: 'food',        label: 'Food',        icon: 'plate' },
        { key: 'vibe',        label: 'Vibe',        icon: 'music' },
        { key: 'service',     label: 'Service',     icon: 'diamond' },
        { key: 'reputation',  label: 'Reputation',  icon: 'starFull' },
        { key: 'convenience', label: 'Convenience', icon: 'clock' },
      ];
      const dims = v5Dims;
      const weightsUsed = sv4.weights_used || {};
      const available = dims.filter(d => sv4[d.key] != null);
      if (available.length > 0) {
        const dimsHtml = available.map(d => {
          const val = Math.min(Math.max(sv4[d.key] || 0, 0), 10);
          const pctVal = (val / 10) * 100;
          const color = getFactorColor(val);
          const weight = weightsUsed[d.key] != null ? Math.round(weightsUsed[d.key] * 100) : null;
          // V5: Show Google rating inline for reputation factor
          const googleInline = (d.key === 'reputation' && data.restaurant?.google_rating)
            ? ` <span class="factor-row__google-star" style="color:var(--star-gold)">${svgIcon('starFull', 10)} ${parseFloat(data.restaurant.google_rating).toFixed(1)}</span>`
            : '';
          return `
            <div class="tile-expand__dim">
              <span class="tile-expand__dim-icon">${svgIcon(d.icon, 14)}</span>
              <span class="tile-expand__dim-label type-data--sm">${d.label}${googleInline}</span>
              <div class="tile-expand__dim-bar">
                <div class="tile-expand__dim-fill" style="width: ${pctVal}%; background: ${color}"></div>
              </div>
              <span class="tile-expand__dim-value type-data--sm">${val.toFixed(1)}</span>
            </div>`;
        }).join('');

        // V4: Show weight shift reasons if available
        let summaryHtml = '';
        if (sv4.weight_shift_reasons && sv4.weight_shift_reasons.length > 0) {
          const topReason = sv4.weight_shift_reasons[0].split(':')[0]; // Short label before colon
          summaryHtml = `<p class="tile-expand__summary type-data--sm">${topReason}</p>`;
        } else if (weightsUsed) {
          const factorLabels = { food: 'Food', vibe: 'Vibe', service: 'Service', reputation: 'Reputation', convenience: 'Convenience' };
          const topFactor = Object.entries(weightsUsed).sort((a, b) => b[1] - a[1])[0];
          if (topFactor && factorLabels[topFactor[0]]) {
            summaryHtml = `<p class="tile-expand__summary type-data--sm">Weighted for ${factorLabels[topFactor[0]]}</p>`;
          }
        }

        $content.innerHTML += `
          <div class="tile-expand__v2">
            <span class="tile-expand__v2-label type-data--sm">Why This Match</span>
            <div class="tile-expand__dims">${dimsHtml}</div>
            ${summaryHtml}
          </div>`;
      }
    }
    // V5: Only V5 factor bars supported
  } else if (tileEl.id === 'score-tile-radar') {
    // Expanded petal radar with dimension list
    const scores = data.scores || {};
    const dims = [
      { key: 'date_friendly_score',  label: 'Date',     icon: 'heart' },
      { key: 'group_friendly_score', label: 'Group',    icon: 'usersThree' },
      { key: 'family_friendly_score',label: 'Family',   icon: 'home' },
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
          <span class="tile-expand__dim-value type-data--sm">${humanizeVibe(val)}</span>
        </div>`;
    }).join('');

    $content.innerHTML = `
      <div class="score-tile__brand" aria-label="Donde Vibe" style="justify-content: center;">
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
            class="score-tile__wordmark-ond">ond</span><span
            class="score-tile__wordmark-e">e</span>
        </span>
        <span class="score-tile__score-label type-data--sm">Vibe<sup>\u2122</sup></span>
      </div>
      <div class="tile-expand__dims">${dimListHtml}</div>`;
  }

  $modal.classList.add('tile-expand--open');
  $modal.querySelector('.tile-expand__close')?.focus();
  announce(tileEl.id === 'score-tile-radar' ? 'Donde Vibe expanded' : 'Match details expanded');
}

function closeTileExpand() {
  const $modal = document.getElementById('tile-expand');
  if ($modal) {
    $modal.classList.remove('tile-expand--open');
    // Return focus to the tile that was expanded
    document.querySelector('.score-tile--expandable')?.focus();
  }
}

/* ---- F1: Render Restaurant Photos ---- */
function renderPhotos(data) {
  const $photos = document.getElementById('result-photos');
  if (!$photos) return;
  const photoUrls = data.restaurant?.photo_urls;
  if (!photoUrls || photoUrls.length === 0) {
    $photos.style.display = 'none';
    return;
  }
  $photos.innerHTML = '';
  // Remove previous pagination dots (sibling element) to prevent accumulation on re-render
  document.getElementById('photo-dots')?.remove();
  const urls = photoUrls.slice(0, 5);
  urls.forEach((url, i) => {
    const img = document.createElement('img');
    img.className = 'result-photos__img';
    img.src = url;
    img.alt = `${data.restaurant.name} photo ${i + 1}`;
    img.loading = i === 0 ? 'eager' : 'lazy';
    img.decoding = 'async';
    img.dataset.index = i;
    img.style.cursor = 'zoom-in';
    img.addEventListener('click', () => openLightbox(urls, i));
    $photos.appendChild(img);
  });

  // Pagination dots
  if (urls.length > 1) {
    const dotsWrap = document.createElement('div');
    dotsWrap.className = 'photo-dots';
    dotsWrap.id = 'photo-dots';
    urls.forEach((_, i) => {
      const dot = document.createElement('span');
      dot.className = 'photo-dots__dot' + (i === 0 ? ' photo-dots__dot--active' : '');
      dotsWrap.appendChild(dot);
    });
    $photos.after(dotsWrap);

    // IntersectionObserver to track active photo
    const dots = dotsWrap.querySelectorAll('.photo-dots__dot');
    const imgs = $photos.querySelectorAll('.result-photos__img');
    const observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          const idx = Number(entry.target.dataset.index);
          dots.forEach((d, di) => d.classList.toggle('photo-dots__dot--active', di === idx));
        }
      });
    }, { root: $photos, threshold: 0.6 });
    imgs.forEach(img => observer.observe(img));
  }

  $photos.style.display = '';
}

/* ---- Photo Lightbox ---- */
function openLightbox(urls, startIndex) {
  const $lightbox = document.getElementById('lightbox');
  const $track = document.getElementById('lightbox-track');
  const $counter = document.getElementById('lightbox-counter');
  if (!$lightbox || !$track) return;

  $track.innerHTML = '';
  urls.forEach((url, i) => {
    const img = document.createElement('img');
    img.src = url;
    img.alt = `Photo ${i + 1} of ${urls.length}`;
    img.draggable = false;
    $track.appendChild(img);
  });

  $lightbox.style.display = '';
  if ($counter) $counter.textContent = `${startIndex + 1} / ${urls.length}`;

  // Scroll to the clicked photo
  requestAnimationFrame(() => {
    const target = $track.children[startIndex];
    if (target) target.scrollIntoView({ behavior: 'instant', inline: 'center' });
  });

  // Update counter on scroll
  const updateCounter = () => {
    const scrollLeft = $track.scrollLeft;
    const slideWidth = $track.offsetWidth;
    const idx = Math.round(scrollLeft / slideWidth);
    if ($counter) $counter.textContent = `${Math.min(idx + 1, urls.length)} / ${urls.length}`;
  };
  $track.addEventListener('scroll', updateCounter, { passive: true });
  $lightbox._cleanup = () => $track.removeEventListener('scroll', updateCounter);

  // Close on Escape
  const onKey = (e) => {
    if (e.key === 'Escape') closeLightbox();
  };
  document.addEventListener('keydown', onKey);
  $lightbox._keyCleanup = () => document.removeEventListener('keydown', onKey);

  // Prevent body scroll
  document.body.style.overflow = 'hidden';
}

function closeLightbox() {
  const $lightbox = document.getElementById('lightbox');
  if (!$lightbox) return;
  $lightbox.style.display = 'none';
  if ($lightbox._cleanup) $lightbox._cleanup();
  if ($lightbox._keyCleanup) $lightbox._keyCleanup();
  document.body.style.overflow = '';
}


/* ---- F2: Open Now badge in quick tags (interactive with hours popout) ---- */
/* ---- V5: Intent Boost Badge ---- */
function renderIntentBoostBadge(data) {
  // Remove any previous boost badge
  document.getElementById('intent-boost-badge')?.remove();

  const boost = data.intent_boost;
  if (!boost?.active) return;

  const $glanceHero = document.querySelector('.glance-hero');
  if (!$glanceHero) return;

  const badge = document.createElement('div');
  badge.id = 'intent-boost-badge';
  badge.className = 'boost-badge boost-badge--visible';
  badge.setAttribute('role', 'button');
  badge.setAttribute('tabindex', '0');
  badge.setAttribute('aria-expanded', 'false');
  badge.setAttribute('aria-haspopup', 'true');

  const reason = boost.reason || 'Intent matched';
  badge.innerHTML = `
    <span class="boost-badge__icon">${svgIcon('bolt', 14)}</span>
    <span class="boost-badge__text type-data--sm">Boosted: ${reason}</span>
    <div class="boost-badge__popout" role="tooltip">
      <span class="badge-popout__title">Intent Boost</span>
      <div class="badge-popout__body">
        <div>Base score: <strong>${boost.base_score ?? data.donde_match}</strong></div>
        ${boost.boost_points != null ? `<div>Boost: <strong>+${boost.boost_points}</strong> pts</div>` : ''}
        <div class="boost-badge__reason">${reason}</div>
      </div>
    </div>`;

  // Insert after glance-hero (between score arc and factor bars)
  $glanceHero.insertAdjacentElement('afterend', badge);

  // Tap to show/hide popout
  badge.addEventListener('click', (e) => {
    e.stopPropagation();
    const popout = badge.querySelector('.badge-popout');
    const isOpen = badge.getAttribute('aria-expanded') === 'true';
    badge.setAttribute('aria-expanded', String(!isOpen));
    if (popout) popout.classList.toggle('badge-popout--open', !isOpen);
  });
}

/* ---- V5: Relaxation Notice ---- */
function renderRelaxationNotice(data) {
  // Remove any previous relaxation notice
  document.getElementById('relaxation-notice')?.remove();

  const relaxation = data.relaxation_applied;
  if (!relaxation) return;

  const $resultCard = document.getElementById('result-card');
  if (!$resultCard) return;

  const notice = document.createElement('div');
  notice.id = 'relaxation-notice';
  notice.className = 'relaxation-notice';
  notice.setAttribute('role', 'status');
  notice.setAttribute('aria-live', 'polite');

  const filterText = typeof relaxation === 'string' ? relaxation
    : Array.isArray(relaxation) ? relaxation.join(', ')
    : 'some filters';

  notice.innerHTML = `
    <span class="relaxation-notice__text type-structural">We expanded beyond ${filterText} to find your best match</span>
    <button class="relaxation-notice__dismiss" aria-label="Dismiss notice">&times;</button>`;

  // Insert before result card content
  $resultCard.insertAdjacentElement('afterbegin', notice);

  // Dismiss handler
  notice.querySelector('.relaxation-notice__dismiss')?.addEventListener('click', () => {
    notice.classList.add('relaxation-notice--dismissing');
    notice.addEventListener('animationend', () => notice.remove(), { once: true });
  });

  // Auto-dismiss after 5s
  animationTimers.push(setTimeout(() => {
    if (notice.parentNode) {
      notice.classList.add('relaxation-notice--dismissing');
      notice.addEventListener('animationend', () => notice.remove(), { once: true });
    }
  }, 5000));
}

function renderOpenNowTag(data) {
  const $quickTags = document.getElementById('quick-tags');
  if (!$quickTags) return;
  const oh = data.restaurant?.opening_hours;
  if (oh?.open_now == null) return;

  const tag = document.createElement('span');
  tag.className = `quick-tag ${oh.open_now ? 'quick-tag--open' : 'quick-tag--closed'} quick-tag--interactive type-data--sm`;
  tag.setAttribute('role', 'button');
  tag.setAttribute('tabindex', '0');
  tag.setAttribute('aria-expanded', 'false');
  tag.setAttribute('aria-haspopup', 'true');
  tag.setAttribute('data-action', 'toggle-badge-popout');
  tag.textContent = oh.open_now ? 'Open' : 'Closed';

  if (oh.weekday_text?.length) {
    const popout = document.createElement('div');
    popout.className = 'badge-popout';
    popout.setAttribute('role', 'tooltip');
    const title = document.createElement('span');
    title.className = 'badge-popout__title';
    title.textContent = 'Hours';
    popout.appendChild(title);
    const today = new Date().toLocaleDateString('en-US', { weekday: 'long' }).toLowerCase();
    const pillsWrap = document.createElement('div');
    pillsWrap.className = 'badge-popout__pills';
    oh.weekday_text.forEach(line => {
      const pill = document.createElement('span');
      pill.className = 'badge-popout__pill';
      if (line.toLowerCase().startsWith(today)) {
        pill.classList.add('badge-popout__pill--today');
      }
      pill.textContent = line;
      pillsWrap.appendChild(pill);
    });
    popout.appendChild(pillsWrap);
    tag.appendChild(popout);
  }

  $quickTags.insertBefore(tag, $quickTags.firstChild);
}

/* ---- F3: Enhanced Map Navigation Tile ---- */
function renderMapPreview(data) {
  const r = data.restaurant;
  const $glanceNav = document.getElementById('glance-nav');
  if (!$glanceNav || !r?.address) return;
  const mapsUrl = r.google_place_id
    ? `https://www.google.com/maps/place/?q=place_id:${r.google_place_id}`
    : buildMapsUrl(r.address);
  const neighborhood = r.neighborhood_name || '';
  $glanceNav.innerHTML = `
    <a class="glance-nav__link glance-nav__link--enhanced" href="${mapsUrl}" target="_blank" rel="noopener noreferrer">
      <div class="glance-nav__map-icon">${svgIcon('pin', 24)}</div>
      <div class="glance-nav__info">
        ${neighborhood ? `<span class="glance-nav__hood type-data--sm">${neighborhood}</span>` : ''}
        <span class="glance-nav__address type-structural">${r.address}</span>
      </div>
      <span class="glance-nav__cta type-structural">Directions ${svgIcon('chevronRight', 16)}</span>
    </a>`;
  $glanceNav.style.display = '';
}

/* ---- F4: Update Bookmark Button State ---- */
function updateBookmarkBtn(restaurantId) {
  const $btn = document.getElementById('bookmark-btn');
  if (!$btn) return;
  const saved = isBookmarked(restaurantId);
  $btn.querySelector('.bookmark-icon--outline').style.display = saved ? 'none' : '';
  $btn.querySelector('.bookmark-icon--filled').style.display = saved ? '' : 'none';
  $btn.setAttribute('aria-label', saved ? 'Remove from saved' : 'Save this spot');
  $btn.classList.toggle('feedback-btn--active', saved);
}

/* ---- F4: Render Saved Spots on Canvas ---- */
function renderSavedSpots() {
  const $container = document.getElementById('saved-spots');
  const $list = document.getElementById('saved-spots-list');
  if (!$container || !$list) return;
  const bookmarks = loadBookmarks();
  if (bookmarks.length === 0) {
    $container.style.display = 'none';
    return;
  }
  $list.innerHTML = '';
  bookmarks.slice(0, 5).forEach(b => {
    const item = document.createElement('button');
    item.className = 'saved-spot type-structural';
    item.innerHTML = `
      <span class="saved-spot__name">${b.name}</span>
      ${b.cuisine_type ? `<span class="saved-spot__meta type-data--sm">${b.cuisine_type}</span>` : ''}
    `;
    item.addEventListener('click', () => {
      if ($cravingInput) {
        $cravingInput.value = b.name;
        setState({ craving: b.name });
        updateCtaState();
      }
    });
    $list.appendChild(item);
  });
  $container.style.display = '';
}


/* ---- F11: Render Feedback Button State ---- */
function renderFeedbackState(restaurantId) {
  const existing = loadFeedback(restaurantId);
  document.querySelectorAll('.feedback-btn--like, .feedback-btn--dislike').forEach(btn => {
    btn.classList.toggle('feedback-btn--active', btn.dataset.feedback === existing);
  });
}

/* ---- "I'm Going Here!" Button State ---- */
function updateGoingBtn(restaurantId) {
  const $btn = document.getElementById('going-btn');
  if (!$btn) return;
  const visited = isVisited(restaurantId);
  const labels = getLabels(getState().theme.culture);
  const $text = $btn.querySelector('.going-btn__text');
  if (visited) {
    $btn.classList.add('going-btn--done');
    if ($text) $text.textContent = labels.goingDone || "You're Going!";
    $btn.setAttribute('aria-label', labels.goingDone || "You're Going!");
  } else {
    $btn.classList.remove('going-btn--done');
    if ($text) $text.textContent = labels.goingHere || "I'm Going Here!";
    $btn.setAttribute('aria-label', labels.goingHere || "I'm Going Here!");
  }
}

/* ---- Visited Spots on Landing ---- */
function renderVisitedSpots() {
  const $container = document.getElementById('visited-spots');
  const $list = document.getElementById('visited-spots-list');
  if (!$container || !$list) return;
  const visits = loadVisits();
  if (visits.length === 0) {
    $container.style.display = 'none';
    return;
  }
  $list.innerHTML = '';
  visits.slice(0, 5).forEach(v => {
    const item = document.createElement('button');
    item.className = 'visited-spot type-structural';
    item.innerHTML = `
      <span class="visited-spot__pin type-data--sm">
        <svg viewBox="0 0 256 256" width="10" height="10"><path fill="currentColor" d="M128,16a88.1,88.1,0,0,0-88,88c0,75.3,80,132.17,83.41,134.55a8,8,0,0,0,9.18,0C136,236.17,216,179.3,216,104A88.1,88.1,0,0,0,128,16Zm0,56a32,32,0,1,1-32,32A32,32,0,0,1,128,72Z"/></svg>
        Been
      </span>
      <span class="visited-spot__name">${v.name}</span>
      <span class="visited-spot__meta type-data--sm">${v.cuisine_type || v.neighborhood_name || ''}</span>
    `;
    $list.appendChild(item);
  });
  $container.style.display = '';
}

/* ---- App Feedback Sheet ---- */
function openFeedbackSheet() {
  const $sheet = document.getElementById('feedback-sheet');
  if (!$sheet) return;
  // Set culture-adaptive labels
  const labels = getLabels(getState().theme.culture);
  const $title = document.getElementById('feedback-sheet-title');
  const $subtitle = document.getElementById('feedback-sheet-subtitle');
  if ($title) $title.textContent = labels.feedbackTitle || 'Share Your Thoughts';
  if ($subtitle) $subtitle.textContent = labels.feedbackSubtitle || 'Help us make Donde better for everyone.';
  // Reset form
  document.querySelectorAll('.feedback-cat-pill').forEach(b => b.setAttribute('aria-pressed', 'false'));
  const $text = document.getElementById('feedback-text');
  if ($text) $text.value = '';
  const $count = document.getElementById('feedback-char-count');
  if ($count) $count.textContent = '0 / 500';
  const $submit = document.getElementById('feedback-submit');
  if ($submit) $submit.disabled = true;
  // Wire textarea character count
  if ($text && !$text._wired) {
    $text._wired = true;
    $text.addEventListener('input', () => {
      const len = $text.value.length;
      if ($count) $count.textContent = `${len} / 500`;
      updateFeedbackSubmitState();
    });
  }
  $sheet.classList.add('feedback-sheet--open');
}

function closeFeedbackSheet() {
  const $sheet = document.getElementById('feedback-sheet');
  if ($sheet) $sheet.classList.remove('feedback-sheet--open');
}

function updateFeedbackSubmitState() {
  const hasCat = !!document.querySelector('.feedback-cat-pill[aria-pressed="true"]');
  const hasText = (document.getElementById('feedback-text')?.value?.trim().length || 0) > 0;
  const $submit = document.getElementById('feedback-submit');
  if ($submit) $submit.disabled = !(hasCat && hasText);
}

/* ---- 1D: Render Deep Context Extras (USP, Wow Factors, Origin Story) ---- */
function renderDeepContextExtras(data) {
  const dc = data.deep_context;
  if (!dc) return;

  // Quick Stats ribbon — compact deep-context data strip (includes wow factors)
  renderQuickStats(data);

  // Origin Story
  const $origin = document.getElementById('origin-story');
  const $originText = document.getElementById('origin-story-text');
  if ($origin && $originText && dc.origin_story) {
    $originText.textContent = dc.origin_story;
    $origin.style.display = '';
  } else if ($origin) {
    $origin.style.display = 'none';
  }
}

/* ---- Quick Stats: Impact-ranked deep-context ribbon ---- */
function renderQuickStats(data) {
  const $stats = document.getElementById('quick-stats');
  if (!$stats) return;
  $stats.innerHTML = '';

  const dc = data.deep_context;
  if (!dc) { $stats.style.display = 'none'; return; }

  // Dimension weights from scoring — drives which stats surface first
  const dw = data.scoring?.weights_used || data.scoring_v5?.weights_used ||
    { food: 0.25, vibe: 0.20, service: 0.15, reputation: 0.20, convenience: 0.20 };

  const candidates = [];

  // -- Wow factors (discovery dimension) --
  const WOW_LABELS = {
    open_kitchen: 'Open Kitchen', rooftop_skyline_view: 'Rooftop Views',
    tableside_preparation: 'Tableside Prep', secret_entrance: 'Secret Entrance',
    live_cooking_show: 'Live Cooking Show', river_view: 'River View',
    lake_view: 'Lake View', historic_building: 'Historic Building',
    celebrity_chef: 'Celebrity Chef', speakeasy_vibe: 'Speakeasy Vibe',
    garden_dining: 'Garden Dining', fireplace: 'Fireplace',
    chef_interaction: 'Chef Interaction',
  };
  const WOW_ICONS = {
    open_kitchen: 'forkKnife', rooftop_skyline_view: 'sun',
    tableside_preparation: 'plate', secret_entrance: 'diamond',
    live_cooking_show: 'fire', river_view: 'globe',
    lake_view: 'globe', historic_building: 'home',
    celebrity_chef: 'starFull', speakeasy_vibe: 'cocktail',
    garden_dining: 'patio', fireplace: 'fire',
    chef_interaction: 'user',
  };
  // (wow factors rendered as subtle accent line below — not in candidate pool)

  // -- Practical stats --
  if (dc.check_average_per_person) {
    const notable = dc.check_average_per_person >= 60 ? 1.2 : 1.0;
    candidates.push({ icon: 'tag', text: `~$${dc.check_average_per_person}/pp`,
      priority: dw.practical * 0.90 * notable });
  }
  if (dc.reservation_difficulty && dc.reservation_difficulty !== 'none') {
    const resMap = { easy: 'Walk-ins OK', moderate: 'Reservations rec.', hard: 'Hard to book' };
    const notable = dc.reservation_difficulty === 'hard' ? 1.5 : 1.0;
    candidates.push({ icon: 'calendar', text: resMap[dc.reservation_difficulty] || humanizeSnake(dc.reservation_difficulty),
      priority: dw.practical * 0.85 * notable });
  }
  if (dc.typical_wait_minutes) {
    const notable = dc.typical_wait_minutes >= 20 ? 1.3 : 1.0;
    candidates.push({ icon: 'clock', text: `~${dc.typical_wait_minutes} min wait`,
      priority: dw.practical * 0.70 * notable });
  }
  if (dc.group_size_sweet_spot) {
    const range = dc.group_size_sweet_spot.replace(/[\[\]()]/g, '').replace(',', '-');
    candidates.push({ icon: 'usersThree', text: `Best for ${range}`,
      priority: dw.practical * 0.50 });
  }
  if (dc.transit_accessibility) {
    candidates.push({ icon: 'train', text: dc.transit_accessibility,
      priority: dw.practical * 0.35 });
  }

  // -- Vibe stats --
  if (dc.energy_level != null) {
    const e = dc.energy_level;
    const notable = (e >= 8 || e <= 2) ? 1.3 : 1.0;
    candidates.push({ icon: 'bolt', text: e >= 8 ? 'High energy' : e >= 5 ? 'Moderate energy' : 'Chill vibe',
      priority: dw.vibe * 0.65 * notable });
  }
  if (dc.cultural_authenticity != null) {
    const a = dc.cultural_authenticity;
    const notable = a >= 8 ? 1.2 : 1.0;
    candidates.push({ icon: 'globe', text: a >= 8 ? 'Very authentic' : a >= 5 ? 'Authentic' : 'Fusion',
      priority: dw.vibe * 0.55 * notable });
  }

  // -- Occasion stats --
  if (dc.conversation_friendliness != null) {
    const c = dc.conversation_friendliness;
    const notable = c <= 3 ? 1.4 : 1.0;
    candidates.push({ icon: 'chat', text: c >= 7 ? 'Great for convo' : c >= 4 ? 'Moderate noise' : 'Loud',
      priority: dw.occasion * 0.70 * notable });
  }

  // -- Craving stats --
  if (dc.spice_level && dc.spice_level !== 'none') {
    candidates.push({ icon: 'fire', text: formatSpiceLevel(dc.spice_level),
      priority: dw.craving * 0.55 });
  }

  // Rank by priority, take top 6
  candidates.sort((a, b) => b.priority - a.priority);
  const shown = candidates.slice(0, 6);
  if (shown.length === 0) {
    $stats.style.display = 'none';
    return;
  }

  shown.forEach((item, i) => {
    if (i > 0) {
      const dot = document.createElement('span');
      dot.className = 'quick-stat__dot';
      dot.textContent = '\u00b7';
      dot.setAttribute('aria-hidden', 'true');
      $stats.appendChild(dot);
    }
    const span = document.createElement('span');
    span.className = 'quick-stat';
    span.innerHTML = `${svgIcon(item.icon, 12)}<span>${item.text}</span>`;
    $stats.appendChild(span);
  });

  // Subtle wow-factor accent line (below main stats)
  const wows = (dc.wow_factors || [])
    .filter(w => w !== 'unique_decor')
    .slice(0, 2)
    .map(w => WOW_LABELS[w] || humanizeSnake(w));
  if (wows.length) {
    const accent = document.createElement('div');
    accent.className = 'quick-stats__accent';
    accent.textContent = wows.join(' \u00b7 ');
    $stats.appendChild(accent);
  }

  $stats.style.display = '';
}



/* ---- Culture-Aware Toast Strings ---- */
function toasts() {
  return getLabels(getState().theme.culture).toasts;
}

/* ---- Try Another Exhaustion Indicator ---- */
function updateTryAgainState() {
  const $btn = document.querySelector('[data-action="try-again"]');
  if (!$btn) return;
  const MAX_EXCLUDES = 15;
  const count = getState().excludeIds.length;
  const remaining = MAX_EXCLUDES - count;
  const $text = $btn.querySelector('.cta-btn__text');
  if (!$text) return;
  const labels = getLabels(getState().theme.culture);
  if (remaining <= 0) {
    $text.textContent = 'Start Over';
    $btn.classList.add('cta-btn--exhausted');
  } else if (remaining <= 5) {
    $text.textContent = `${labels.again} (${remaining} left)`;
    $btn.classList.remove('cta-btn--exhausted');
  } else {
    $text.textContent = labels.again;
    $btn.classList.remove('cta-btn--exhausted');
  }
}

/* ---- Offline Banner Text Sync ---- */
function syncOfflineBannerText() {
  const $banner = document.getElementById('offline-banner');
  if ($banner) $banner.textContent = toasts().offline;
}

/* ---- Inline Empty State (persistent no-result feedback) ---- */
function showEmptyState(message) {
  const $el = document.getElementById('empty-state');
  const $text = document.getElementById('empty-state-text');
  if (!$el || !$text) return;
  $text.textContent = message;
  $el.style.display = '';
}

function clearEmptyState() {
  const $el = document.getElementById('empty-state');
  if ($el) $el.style.display = 'none';
}

/* ---- Toast ---- */
let toastTimer = null;

function showToast(message, isError = false, action = null) {
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

  // Optional action button (e.g., "Retry")
  const $action = document.getElementById('toast-action');
  if ($action) {
    if (action) {
      $action.textContent = action.label;
      $action.onclick = () => { dismissToast(); action.callback(); };
      $action.style.display = '';
    } else {
      $action.style.display = 'none';
      $action.onclick = null;
    }
  }

  $toast.classList.add('toast--visible');

  // Auto-dismiss: errors stay longer, actions linger even longer
  const duration = action ? 10000 : isError ? 6000 : 3500;
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
  let startTime = 0;
  let isDragging = false;
  let isHorizontal = null; // null = undecided, true/false = committed

  const COMPLETE_THRESHOLD = 80;
  const VELOCITY_THRESHOLD = 0.5;
  const DAMPING = 0.4;

  const $resultStep = document.querySelector('.step[data-step="1"]');

  $main?.addEventListener('touchstart', (e) => {
    startX = e.touches[0].clientX;
    startY = e.touches[0].clientY;
    startTime = Date.now();
    isDragging = true;
    isHorizontal = null;
  }, { passive: true });

  $main?.addEventListener('touchmove', (e) => {
    if (!isDragging || !$resultStep) return;
    if (getState().step !== 1) return;

    const dx = e.touches[0].clientX - startX;
    const dy = e.touches[0].clientY - startY;

    // Decide direction on first significant movement
    if (isHorizontal === null) {
      if (Math.abs(dx) < 10 && Math.abs(dy) < 10) return;
      isHorizontal = Math.abs(dx) > Math.abs(dy);
      if (!isHorizontal) return;
      // Reduced motion: skip visual tracking
      if (REDUCED_MOTION.matches) return;
      $resultStep.classList.add('step--swiping');
    }

    if (!isHorizontal || REDUCED_MOTION.matches) return;

    // Only track right-swipe (positive dx), damped
    const dampedDx = dx > 0 ? dx * DAMPING : dx * 0.1;
    $resultStep.style.transform = `translateX(${dampedDx}px)`;
  }, { passive: true });

  $main?.addEventListener('touchend', (e) => {
    if (!isDragging) return;
    isDragging = false;

    const dx = e.changedTouches[0].clientX - startX;
    const dy = e.changedTouches[0].clientY - startY;
    const elapsed = Date.now() - startTime;
    const velocity = Math.abs(dx) / Math.max(elapsed, 1);

    // Clean up visual tracking
    if ($resultStep) {
      $resultStep.classList.remove('step--swiping');
      $resultStep.style.transform = '';
    }

    // Must be a horizontal gesture on the result view
    if (isHorizontal === false) return;
    if (Math.abs(dx) < 30 || Math.abs(dy) > Math.abs(dx)) return;

    const { step } = getState();

    // Only allow swipe-right on result to go back to canvas
    if (dx > 0 && step === 1 && (dx > COMPLETE_THRESHOLD || velocity > VELOCITY_THRESHOLD)) {
      haptic(HAPTICS.swipe);
      goToStep(0);
      syncFilterPillsToState();
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
  ctx.fillText('Donde Match', scoreX + 44, scoreY + 4);

  y += 80;

  // Branding
  ctx.fillStyle = fg2;
  ctx.font = `italic 500 14px "Playfair Display", serif`;
  ctx.textAlign = 'right';
  ctx.fillText('via Donde', w - pad, h - pad);
}

// Expose for share module
window.renderShareCanvas = renderShareCanvas;

/* ---- "Why This Spot" Explainer ---- */
const VIBE_LABELS = {
  date_friendly_score: 'date-friendliness',
  group_friendly_score: 'group-friendliness',
  family_friendly_score: 'family-friendliness',
  business_lunch_score: 'business vibes',
  solo_dining_score: 'solo dining',
  hole_in_wall_factor: 'hidden-gem factor',
};

function buildWhyExplainer(data, craving) {
  if (!data || !craving?.trim()) return '';

  const labels = getLabels(getState().theme.culture);
  const prefix = labels.whyPrefix || 'Why this spot \u2014 ';

  // Find the strongest vibe dimension
  let bestKey = '';
  let bestVal = 0;
  for (const [key, label] of Object.entries(VIBE_LABELS)) {
    const val = parseFloat(data.scores?.[key] ?? data.deep_context?.[key] ?? data[key] ?? 0);
    if (val > bestVal) {
      bestVal = val;
      bestKey = key;
    }
  }

  const score = Math.round(parseFloat(data.donde_match) || 0);
  const vibeLabel = VIBE_LABELS[bestKey] || '';

  if (!vibeLabel || bestVal < 5) return '';

  const cravingShort = craving.trim().split(' ').slice(0, 5).join(' ');
  return `${prefix}matched for "${cravingShort}" with top-tier ${vibeLabel} (${bestVal.toFixed(1)}/10) at ${score}% confidence.`;
}

/* ---- Coach Marks (First-Visit Onboarding) ---- */
let coachMarkStep = 0;
const COACH_STEPS = [
  {
    targetSelector: '[data-action="toggle-color"]',
    textKey: 'theme',
    position: 'below',
  },
  {
    targetSelector: '.craving-input',
    textKey: 'input',
    position: 'below',
  },
];

function showCoachMarks() {
  coachMarkStep = 0;
  showCoachStep();
}

function showCoachStep() {
  const $mark = document.getElementById('coach-mark');
  const $text = document.getElementById('coach-mark-text');
  const $backdrop = document.getElementById('coach-mark-backdrop');
  if (!$mark || !$text || !$backdrop) return;

  if (coachMarkStep >= COACH_STEPS.length) {
    // All done
    $mark.style.display = 'none';
    $backdrop.style.display = 'none';
    setOnboardingSeen();
    return;
  }

  const step = COACH_STEPS[coachMarkStep];
  const target = document.querySelector(step.targetSelector);
  if (!target) {
    coachMarkStep++;
    showCoachStep();
    return;
  }

  const labels = getLabels(getState().theme.culture);
  $text.textContent = labels.coachMarks?.[step.textKey] || step.textKey;

  $backdrop.style.display = '';
  $mark.style.display = '';

  // Position below the target
  const rect = target.getBoundingClientRect();
  $mark.style.left = `${Math.max(16, Math.min(rect.left, window.innerWidth - 296))}px`;
  $mark.style.top = `${rect.bottom + 12}px`;

  // Elevate target above backdrop
  target.style.position = target.style.position || 'relative';
  target.style.zIndex = '9992';
  target._coachElevated = true;
}

function dismissCoachMark() {
  // De-elevate previous target
  const step = COACH_STEPS[coachMarkStep];
  if (step) {
    const target = document.querySelector(step.targetSelector);
    if (target?._coachElevated) {
      target.style.zIndex = '';
      delete target._coachElevated;
    }
  }

  coachMarkStep++;
  showCoachStep();
}

/* ---- Color Mode Popover ---- */

const POPOVER_CULTURES = [
  { id: 'neutral',       name: 'Studio',    region: 'Universal',          mood: 'Warm terracotta \u00b7 Earthy warmth \u00b7 The canvas',      tagline: 'The blank page before the masterpiece',     hue: 'hsl(18 45% 42%)',  swatches: ['hsl(18 45% 42%)', 'hsl(18 8% 97%)', 'hsl(18 12% 12%)'] },
  { id: 'indian',        name: 'Desi',      region: 'Warm Earth',         mood: 'Ornate warmth \u00b7 Saffron tones \u00b7 Ink depth',         tagline: 'Warmth woven into every detail',            hue: 'hsl(28 88% 50%)',  swatches: ['hsl(28 88% 50%)', 'hsl(350 70% 50%)', 'hsl(22 90% 48%)'] },
  { id: 'middleeastern', name: 'Bazaar',    region: 'Hammered Gold',      mood: 'Brass patina \u00b7 Arabesque geometry \u00b7 Gold leaf',     tagline: 'Where every gathering is golden',           hue: 'hsl(48 72% 46%)',  swatches: ['hsl(48 72% 46%)', 'hsl(0 60% 50%)', 'hsl(35 85% 50%)'] },
  { id: 'japanese',      name: 'Zen',       region: 'Ink Wash',           mood: 'Wabi-sabi \u00b7 Indigo restraint \u00b7 Quiet depth',        tagline: 'Less is more, silence is loud',             hue: 'hsl(220 35% 45%)', swatches: ['hsl(220 35% 45%)', 'hsl(45 12% 97%)', 'hsl(220 18% 15%)'] },
  { id: 'southamerican', name: 'Sabor',     region: 'Tropical Fire',      mood: 'Vivid warmth \u00b7 Tropical palette \u00b7 Festival energy', tagline: 'Energy runs through everything',            hue: 'hsl(350 80% 52%)', swatches: ['hsl(350 80% 52%)', 'hsl(170 55% 38%)', 'hsl(45 90% 55%)'] },
];

let popoverInitialized = false;

function initColorPopover() {
  if (popoverInitialized) return;
  popoverInitialized = true;

  const container = document.getElementById('color-popover-cultures');
  if (!container) return;

  // Build culture dots
  POPOVER_CULTURES.forEach(culture => {
    const dot = document.createElement('button');
    dot.className = 'color-popover__dot';
    dot.dataset.action = 'select-culture';
    dot.dataset.theme = culture.id;
    dot.style.background = culture.hue;
    dot.setAttribute('role', 'radio');
    dot.setAttribute('aria-checked', 'false');
    dot.setAttribute('aria-label', `${culture.name} theme`);

    const srLabel = document.createElement('span');
    srLabel.className = 'color-popover__dot-label';
    srLabel.textContent = culture.name;
    dot.appendChild(srLabel);

    container.appendChild(dot);
  });

  updateColorPopoverDots();
  updateColorPopoverState();
}

function updateColorPopoverDots() {
  const currentCulture = getState().theme.culture;
  document.querySelectorAll('.color-popover__dot').forEach(dot => {
    const isActive = dot.dataset.theme === currentCulture && isManualOverride();
    dot.classList.toggle('color-popover__dot--active', isActive);
    dot.setAttribute('aria-checked', String(isActive));
  });
}

function updateColorPopoverState() {
  const switchEl = document.getElementById('color-mode-switch');
  if (switchEl) {
    const isAuto = getColorMode() === 'auto';
    switchEl.setAttribute('aria-checked', String(isAuto));
  }
}

function toggleColorPopover() {
  initColorPopover();
  const popover = document.getElementById('color-popover');
  if (!popover) return;

  if (popover.classList.contains('color-popover--open')) {
    closeColorPopover();
  } else {
    updateColorPopoverDots();
    updateColorPopoverState();
    popover.classList.add('color-popover--open');
  }
}

function closeColorPopover() {
  const popover = document.getElementById('color-popover');
  if (!popover) return;
  popover.classList.remove('color-popover--open');
  document.querySelector('[data-action="toggle-color"]')?.focus();
}

/* ---- SSO: Auth UI Helpers ---- */

function openAuthSheet() {
  const sheet = document.getElementById('auth-sheet');
  if (sheet) sheet.classList.add('auth-sheet--open');
}

function closeAuthSheet() {
  const sheet = document.getElementById('auth-sheet');
  if (sheet) sheet.classList.remove('auth-sheet--open');
}

function toggleUserMenu() {
  const menu = document.getElementById('user-menu');
  if (!menu) return;
  if (menu.classList.contains('user-menu--open')) {
    closeUserMenu();
  } else {
    const user = getAuthUser();
    if (user) {
      const $name = document.getElementById('user-menu-name');
      const $email = document.getElementById('user-menu-email');
      const $avatar = document.getElementById('user-menu-avatar');
      if ($name) $name.textContent = user.name || 'User';
      if ($email) $email.textContent = user.email || '';
      if ($avatar) $avatar.src = user.avatar_url || '';
    }
    menu.classList.add('user-menu--open');
  }
}

function closeUserMenu() {
  const menu = document.getElementById('user-menu');
  if (menu) menu.classList.remove('user-menu--open');
}

function updateAuthUI() {
  const $btn = document.getElementById('auth-btn');
  const $avatarImg = document.getElementById('auth-avatar-img');
  if (!$btn) return;

  const user = getAuthUser();
  if (user && isAuthAuthenticated()) {
    $btn.classList.add('is-authenticated');
    $btn.setAttribute('aria-label', 'Account');
    $btn.setAttribute('title', user.name || 'Account');
    if ($avatarImg && user.avatar_url) {
      $avatarImg.src = user.avatar_url;
      $avatarImg.alt = user.name || '';
      $avatarImg.style.display = '';
    }
  } else {
    $btn.classList.remove('is-authenticated');
    $btn.setAttribute('aria-label', 'Sign in');
    $btn.setAttribute('title', 'Sign in');
    if ($avatarImg) {
      $avatarImg.src = '';
      $avatarImg.style.display = 'none';
    }
  }
}

// SSO: Subscribe to auth state changes
subscribe((state, prev) => {
  if (state.isAuthenticated !== prev.isAuthenticated || state.user !== prev.user) {
    updateAuthUI();
    closeAuthSheet();
    if (state.isAuthenticated && !prev.isAuthenticated && state.user) {
      showToast(toasts().welcomeUser(state.user.name));
      renderTasteMemory();
      renderSavedSpots();
      renderVisitedSpots();
      if (!hasSeenOnboarding()) setTimeout(() => showCoachMarks(), 600);
    }
  }
});

/* ---- Boot ---- */
init();
