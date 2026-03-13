/* ============================================
   DondeAI — Main Orchestrator
   Single-canvas layout: Canvas + Result.
   Module architecture: globals.js (shared state) → app.js (orchestrator)
   ============================================ */

import { getState, setState, subscribe, resetState } from './state.js';
import { initRouter, goToStep, goToStepInstant } from './router.js';
import { loadTheme, loadSound, loadHistory, addToHistory, saveTheme, loadBookmarks, addBookmark, removeBookmark, isBookmarked, loadVisits, addVisit, isVisited, getOrCreateUserId, saveFeedback, loadFeedback, clearFeedback, hasGuestDismissed, setGuestDismissed, hasSeenOnboarding, setOnboardingSeen } from './persistence.js';
import { initTheme, setTheme, setThemeInstant, setThemeVisualOnly, revertAutoTheme, getColorMode, getLabels, CULTURES, CULTURE_DISPLAY_NAMES, setWashOrigin } from './theme.js';
import { initAudio, toggleSound, playChime, playCelebrationChime, playSettleChime, playGlowChime, playSpectacleChime } from './audio.js';
import { initSpring, springAnimate, SPRINGS } from './spring.js';
import { initVoice, startVoice } from './voice.js';
import { initShare, shareResult, closeShareSheet, handleShareChannel } from './share.js';
import { initOffline, isOnline } from './offline.js';
import { initAccessibility, announce } from './accessibility.js';
import { fetchRecommendation, fetchBlurb, sendFeedback, sendVisit, sendAppFeedback } from './api.js';
import { initAuth, signIn as signInWith, signOut as authSignOut, isAuthenticated as isAuthAuthenticated, getUser as getAuthUser, addFavoriteToServer, removeFavoriteFromServer, addVisitToServer } from './auth.js';
import { animateScoreRing, renderPetalRadar, renderSentimentBar, renderScoreBloom, renderScoreHero, renderRelevanceGate, renderFactorBars, toggleBloom, resetBloomState, handlePetalTap, handleBloomRingTap, toggleScoreBreakdown, getBloomState, animateBadge, startParticles, stopParticles, chaosToOrderReveal, initLogoAnimation, startWordRotation, stopWordRotation, resolveLogoToFound, cleanupLoadingLogo, fireCelebration, loadRive } from './animations.js';
import {
  getGreeting, getTimePeriod, getCuisineFromResult, svgIcon,
  getScoreTier, getScoreColor, getScoreThresholdColor,
  buildGoogleStars, buildMapsUrl, relativeTime, matchCuisine, matchCulture,
  humanizeSnake
} from './utils.js';
import { $dom, initDomRefs, _escHtml, haptic, HAPTICS, pushTimer, clearAnimationTimers, setPendingResultData, setPendingCuisine, setTier2Prepared, setTier2Animated, isTier2Prepared, isTier2Animated, getPendingResultData, getPendingCuisine, setSwapInFlight, setCurrentAbort, currentAbort as getGlobalAbort } from './globals.js';

/* ---- Cached DOM Elements (legacy aliases — will migrate to $dom) ---- */
const $app = document.querySelector('.app');
const $main = document.querySelector('.cockpit');
const $cravingInput = document.getElementById('craving-input');
const $resultCard = document.getElementById('result-card');
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
    colorMode: 'auto',
  });

  // Initialize all modules
  initSpring(); // Load Motion One for real spring physics (async, non-blocking)
  loadRive();    // Load Rive runtime for logo/celebration (async, non-blocking)
  initRouter();
  initTheme();
  initAudio();
  initVoice();
  document.addEventListener('voice-error', () => {
    showToast("Couldn't hear you — tap the mic to try again", true);
  });
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

  // V9: Canvas progressive disclosure — start minimal, reveal on engagement
  startCanvasDisclosure();

  // Hood group accordion init
  initHoodGroups();

  // Motion debug overlay (?debug=motion)
  if (new URLSearchParams(location.search).get('debug') === 'motion') {
    import('./debug-motion.js').then(m => m.initMotionDebug());
  }

  // Time-based occasion pre-highlight
  applyTimeBasedOccasionHint();

  // V10: Render combined "Your Spots" (recent + saved + visited)
  renderYourSpots();

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
      // Result arrived — only ink-manifest if we were in loading/scaffold state
      // (Try Again queue swap handles its own card-swap animation)
      if (prev.loading || $resultCard?.classList.contains('result-card--scaffold')) {
        manifestResult(state.result);
      }
      // SSO: Deferred auth — show popup after second successful result
      _resultCount++;
      if (_resultCount >= 2 && !isAuthAuthenticated() && !hasGuestDismissed()) {
        setTimeout(() => openAuthSheet(), 600);
      }
    }
    if (state.loading !== prev.loading && state.loading) {
      // Canvas fold + scaffold (Phases 1-3) — replaces old overlay
      beginCanvasFold();
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

  // Font loading: remove .fonts-loading once Playfair Display is ready
  if (document.fonts && document.fonts.ready) {
    document.fonts.ready.then(() => {
      document.body.classList.remove('fonts-loading');
    });
  } else {
    // Fallback: just remove after 1s
    setTimeout(() => document.body.classList.remove('fonts-loading'), 1000);
  }
}

/* ---- Landing Setup ---- */
function setupLanding() {
  const culture = getState().theme.culture;
  const $greeting = document.querySelector('[data-step="0"] .step__title');
  if ($greeting) {
    typewriterReveal($greeting, getGreeting(culture));
  }
  startGreetingRotation();

  // Header border fades in when greeting scrolls out of view
  if (_headerScrollObserver) _headerScrollObserver.disconnect();
  if ($greeting && 'IntersectionObserver' in window) {
    const $header = document.querySelector('.header');
    if ($header) {
      _headerScrollObserver = new IntersectionObserver(([e]) => {
        $header.classList.toggle('header--scrolled', !e.isIntersecting);
      }, { threshold: 0 });
      _headerScrollObserver.observe($greeting);
    }
  }
}

let _headerScrollObserver = null;

/* ---- V9: Canvas Progressive Disclosure ---- */
let _canvasPhase = 'minimal';
let _canvasRevealTimer = null;

function startCanvasDisclosure() {
  const $step0 = document.querySelector('.step[data-step="0"]');
  if (!$step0) return;

  _canvasPhase = 'minimal';
  const $canvasInner = $step0.querySelector('.canvas-layout');
  if ($canvasInner) {
    $canvasInner.classList.add('canvas-layout--minimal');
    $canvasInner.classList.remove('canvas-layout--engaged', 'canvas-layout--returning');
  }

  // Check if returning user (has history)
  const { history } = getState();
  const isReturning = history && history.length > 0;

  // Auto-reveal engaged phase after 2s idle
  _canvasRevealTimer = setTimeout(() => {
    setCanvasPhase(isReturning ? 'returning' : 'engaged');
  }, 2000);
}

function setCanvasPhase(phase) {
  const $step0 = document.querySelector('.step[data-step="0"]');
  if (!$step0 || _canvasPhase === phase) return;

  const wasMinimal = _canvasPhase === 'minimal';
  _canvasPhase = phase;
  const $canvasInner = $step0.querySelector('.canvas-layout');
  if ($canvasInner) {
    $canvasInner.classList.remove('canvas-layout--minimal', 'canvas-layout--engaged', 'canvas-layout--returning');
    $canvasInner.classList.add(`canvas-layout--${phase}`);
  }

  // V9.1 Enhancement 5: Smart chip cascade entrance on first reveal
  if (wasMinimal && (phase === 'engaged' || phase === 'returning')) {
    const $chips = $step0.querySelector('.smart-chips');
    if ($chips && !matchMedia('(prefers-reduced-motion: reduce)').matches) {
      $chips.classList.add('smart-chips--cascade');
      // Haptic micro-tick per chip
      const chipEls = $chips.querySelectorAll('.smart-chip');
      chipEls.forEach((_, i) => {
        const delays = [0, 60, 140, 240, 360];
        setTimeout(() => haptic(HAPTICS.signalPop), delays[i] || 360);
      });
      // Clean up cascade class after animation
      setTimeout(() => $chips.classList.remove('smart-chips--cascade'), 1200);
    }
  }
}

function onCanvasEngaged() {
  if (_canvasPhase !== 'minimal') return;
  if (_canvasRevealTimer) clearTimeout(_canvasRevealTimer);
  const { history } = getState();
  setCanvasPhase(history && history.length > 0 ? 'returning' : 'engaged');
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
    $greeting.style.transition = 'opacity 400ms cubic-bezier(0.4, 0, 0.2, 1)';
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

  // Chicago 1000 base pool (neutral) for most chips; 1 culture-specific cuisine chip
  const basePool = culture !== 'neutral' ? getLabels('neutral').chipPool : pool;
  if (basePool) {
    pickFrom(basePool.time?.[timePeriod], 2);
    pickFrom(basePool.vibe, 1);
    pickFrom(basePool.style, 1);
    // 1 cuisine chip: culture-specific if non-neutral, otherwise from Chicago 1000 base
    if (culture !== 'neutral' && pool?.cuisine) {
      pickFrom(pool.cuisine, 1);
    } else {
      pickFrom(basePool.cuisine, 1);
    }
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
          pill.setAttribute('aria-checked', 'false');
        });
        // V5: Clear Open Now pill
        const $openNowPill = document.getElementById('open-now-pill');
        if ($openNowPill) $openNowPill.setAttribute('aria-checked', 'false');
        setupLanding();
        renderSmartChips();
        renderYourSpots();
        // Clean up ink-manifests state and hide result
        settleResult();
        if ($resultCard) { $resultCard.classList.remove('result-card--unfolding', 'result-card--loading'); $resultCard.style.display = 'none'; }
        const $canvasReset = document.querySelector('.canvas-layout');
        if ($canvasReset) $canvasReset.classList.remove('canvas-layout--restoring', 'canvas-layout--morphing');
        goToStep(0);
        startCanvasDisclosure(); // V9: Reset canvas phases
        updateCtaState();
        updateFilterSummary();
        // Collapse filter drawer
        collapseFilters();
        // Revert auto-theme
        revertAutoTheme();
        break;

      case 'back':
        if (currentAbort) currentAbort.abort();
        if (getState().loading) {
          reverseCanvasFold();
          setState({ loading: false });
        } else {
          // Animated reverse fold from result to canvas
          unfoldResultToCanvas();
        }
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

      case 'select-neighborhood': {
        selectFilter('neighborhood', btn);
        const hoodRegions = document.getElementById('hood-regions');
        const hoodBrowse = document.querySelector('[data-action="toggle-hood-regions"]');
        if (btn.dataset.value === 'Anywhere') {
          // Collapse regions and deactivate browse
          if (hoodRegions) hoodRegions.setAttribute('aria-hidden', 'true');
          if (hoodBrowse) {
            hoodBrowse.setAttribute('aria-expanded', 'false');
            hoodBrowse.classList.remove('hood-browse--active');
          }
          // Close all detail groups
          document.querySelectorAll('.hood-group[open]').forEach(g => g.removeAttribute('open'));
        } else {
          autoOpenHoodGroup(btn.dataset.value);
          // Auto-expand regions
          if (hoodRegions) hoodRegions.setAttribute('aria-hidden', 'false');
          if (hoodBrowse) {
            hoodBrowse.setAttribute('aria-expanded', 'true');
            hoodBrowse.classList.add('hood-browse--active');
          }
        }
        break;
      }

      case 'toggle-hood-regions': {
        const regions = document.getElementById('hood-regions');
        if (!regions) break;
        const isExpanded = btn.getAttribute('aria-expanded') === 'true';
        btn.setAttribute('aria-expanded', String(!isExpanded));
        regions.setAttribute('aria-hidden', String(isExpanded));
        break;
      }

      case 'select-budget':
        selectFilter('priceLevel', btn);
        break;

      case 'toggle-filters': {
        const content = document.getElementById('filter-content');
        const isExpanded = btn.getAttribute('aria-expanded') === 'true';
        btn.setAttribute('aria-expanded', String(!isExpanded));
        if (content) {
          if (isExpanded) {
            // Smooth close: animate out, then hide
            _animateDrawerClose(content);
          } else {
            content.hidden = false;
          }
        }
        break;
      }

      // F5: Dietary restriction toggle (multi-select)
      case 'toggle-dietary': {
        const val = btn.dataset.value;
        const current = [...getState().dietaryRestrictions];
        const isActive = btn.getAttribute('aria-checked') === 'true';
        btn.setAttribute('aria-checked', String(!isActive));
        if (isActive) {
          setState({ dietaryRestrictions: current.filter(d => d !== val) });
          announce(`${val} removed`);
        } else {
          current.push(val);
          setState({ dietaryRestrictions: current });
          announce(`${val} selected`);
        }
        haptic(HAPTICS.tick);
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
        const isActive = btn.getAttribute('aria-checked') === 'true';
        btn.setAttribute('aria-checked', String(!isActive));
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
        haptic([10, 30, 10, 30, 10]); // playful surprise pattern
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
        // Wobble feedback on button (playful, not just spring)
        btn.style.animation = 'factorWobble 400ms ease-out';
        btn.addEventListener('animationend', () => { btn.style.animation = ''; }, { once: true });

        // Pick the final prompt
        const finalPrompt = surprisePrompts[Math.floor(Math.random() * surprisePrompts.length)];

        if ($cravingInput) {
          // Shimmer effect on input
          $cravingInput.classList.add('craving-input--surprising');
          $cravingInput.addEventListener('animationend', () => $cravingInput.classList.remove('craving-input--surprising'), { once: true });

          // Typewriter effect: write the surprise prompt character by character
          $cravingInput.value = '';
          let charIdx = 0;
          const typeInterval = setInterval(() => {
            charIdx++;
            $cravingInput.value = finalPrompt.slice(0, charIdx);
            $cravingInput.style.height = 'auto';
            $cravingInput.style.height = $cravingInput.scrollHeight + 'px';
            if (charIdx >= finalPrompt.length) {
              clearInterval(typeInterval);
              setState({ craving: finalPrompt, excludeIds: [] });
              updateCtaState();
              // Auto-submit after a brief pause
              setTimeout(() => handleSubmit(), 400);
            }
          }, 35);
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
        renderYourSpots();
        const t = toasts();
        const savedMsg = isAuthAuthenticated()
          ? (wasBookmarked ? t.bookmarkRemove : t.bookmarkAddAuth)
          : (wasBookmarked ? t.bookmarkRemove : t.bookmarkAdd);
        showToast(savedMsg, false);
        break;
      }

      // "I'm Going Here!" — strongest engagement signal
      case 'going': {
        haptic(HAPTICS.goingHere);
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
        renderYourSpots();
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
        const wasPressed = btn.getAttribute('aria-checked') === 'true';
        document.querySelectorAll('.feedback-cat-pill').forEach(b => b.setAttribute('aria-checked', 'false'));
        btn.setAttribute('aria-checked', String(!wasPressed));
        updateFeedbackSubmitState();
        break;
      }

      case 'submit-app-feedback': {
        const selectedCat = document.querySelector('.feedback-cat-pill[aria-checked="true"]');
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
        // Debounce: block rapid taps while swap is in-flight
        if (_swapInFlight) break;
        // Hard cap: 4 try-agains max (5 total picks including initial)
        if (getState().excludeIds.length >= 4) break;
        // Visual loading state on button during swap
        const $tryBtn = btn.closest('[data-action="try-again"]') || btn;
        $tryBtn.classList.add('try-again-btn--loading');

        // Track current restaurant ID so backend can exclude it
        const prevId = getState().result?.restaurant?.id;
        if (prevId) {
          const exclude = [...getState().excludeIds];
          if (!exclude.includes(prevId)) exclude.push(prevId);
          setState({ excludeIds: exclude });
        }

        // V7: Instant "Try Again" from ranked queue
        const queue = getState().rankedQueue;
        const qIdx = getState().rankedQueueIndex;
        if (queue.length > 0 && qIdx < queue.length) {
          // Serve next result from pre-computed queue — render instantly with template blurb
          const nextResult = queue[qIdx];
          setState({ rankedQueueIndex: qIdx + 1, result: nextResult });

          // V7: Card swap animation — fade out old, fade in new
          const $resultCard = document.querySelector('.result-card');
          animationTimers.forEach(clearTimeout);
          animationTimers = [];
          _swapInFlight = false; // Clear stale flag before starting new swap

          if ($resultCard && !REDUCED_MOTION.matches) {
            _swapInFlight = true;
            // Card swap: flick old card off-desk, land new one with spring
            $resultCard.classList.add('result-card--swapping-out');
            animationTimers.push(setTimeout(() => {
              renderResult(nextResult);
              $resultCard.classList.remove('result-card--swapping-out', 'result-card--crossfading');
              $resultCard.classList.add('result-card--swapping-in');
              // Score animates after card lands
              animationTimers.push(setTimeout(() => {
                const dondeScore = Math.round(parseFloat(nextResult.donde_match) || 80);
                const $matchScore = document.getElementById('match-pill-score');
                if ($matchScore) animateScoreCountUp($matchScore, dondeScore);
                $resultCard.classList.remove('result-card--swapping-in');
                _swapInFlight = false;
                document.querySelector('.try-again-btn--loading')?.classList.remove('try-again-btn--loading');
                // Tiered celebration (70+)
                if (dondeScore >= 70) {
                  animationTimers.push(setTimeout(() => {
                    _fireTieredCelebration(dondeScore);
                  }, 1400));
                }
              }, 400));
              // Announce swap to screen readers
              announce(`Now showing: ${nextResult.restaurant?.name || 'new recommendation'}`);
            }, 280));
          } else {
            renderResult(nextResult);
            const dondeScore = Math.round(parseFloat(nextResult.donde_match) || 80);
            const $matchScore = document.getElementById('match-pill-score');
            if ($matchScore) animateScoreCountUp($matchScore, dondeScore);
            if (dondeScore >= 70) {
              setTimeout(() => { _fireTieredCelebration(dondeScore); }, 1400);
            }
            document.querySelector('.try-again-btn--loading')?.classList.remove('try-again-btn--loading');
            announce(`Now showing: ${nextResult.restaurant?.name || 'new recommendation'}`);
          }
          haptic(HAPTICS.reveal);
          // Safety: ensure _swapInFlight resets even if animation callbacks fail
          setTimeout(() => { _swapInFlight = false; }, 1000);

          // Score-first blurb: fetch Claude blurb in background, reveal when ready
          _revealBlurb(nextResult);

          break;
        }

        // Queue exhausted — fall back to API call
        const MAX_EXCLUDES = 15;
        const currentExcludes = getState().excludeIds.length;
        if (currentExcludes >= MAX_EXCLUDES) {
          showToast("You've seen all top picks for this search. Try starting over with different cravings!", false);
          break;
        }
        handleSubmit();
        break;
      }


      case 'toggle-mode': {
        const currentMode = getState().theme.mode;
        const newMode = currentMode === 'light' ? 'dark' : 'light';
        setTheme(getState().theme.culture, newMode);
        break;
      }


      case 'toggle-sound':
        toggleSound();
        break;

      case 'toggle-badge-popout': {
        const isOpen = btn.getAttribute('aria-expanded') === 'true';
        if (isOpen) {
          closeBadgePopout();
        } else {
          haptic(HAPTICS.drawerOpen);
          openBadgePopout(btn);
        }
        break;
      }


      case 'toggle-cuisine-pill': {
        const idx = btn.dataset.index;
        const expanded = btn.getAttribute('aria-expanded') === 'true';
        const $body = document.querySelector(`[data-pill-body="${idx}"]`);
        if ($body) {
          if (expanded) {
            btn.setAttribute('aria-expanded', 'false');
            $body.style.maxHeight = '0';
            $body.classList.remove('cuisine-pill-group__body--open');
          } else {
            btn.setAttribute('aria-expanded', 'true');
            $body.classList.add('cuisine-pill-group__body--open');
            $body.style.maxHeight = $body.scrollHeight + 'px';
          }
        }
        break;
      }

      case 'share':
        haptic(HAPTICS.tick);
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
        setState({ occasion: 'Any', neighborhood: 'Anywhere', priceLevel: 'Any', openNow: false });
        clearAllSelections();
        // Also clear occasion strip tiles
        document.querySelectorAll('.occasion-tile[aria-checked="true"]').forEach(t => t.setAttribute('aria-checked', 'false'));
        updateFilterSummary();
        clearEmptyState();
        showToast(toasts().filtersCleared);
        break;
      }

      case 'randomize': {
        // Pick random occasion, neighborhood, budget
        const occasions = ['Date Night', 'Group Hangout', 'Family Dinner', 'Business Lunch', 'Solo Dining', 'Special Occasion', 'Treat Myself', 'Adventure', 'Chill Hangout'];
        const hoods = ['Pilsen', 'Wicker Park', 'Logan Square', 'Lincoln Park', 'West Loop', 'Bucktown', 'Hyde Park', 'Chinatown', 'Little Italy', 'Andersonville', 'River North', 'Old Town', 'Lakeview', 'Fulton Market', 'Avondale', 'Back of the Yards', 'Bridgeport', 'Bronzeville', 'Edgewater', 'Gold Coast', 'Greektown', 'Humboldt Park', 'Irving Park', 'Lincoln Square', 'Loop', 'North Center', 'Ravenswood', 'Rogers Park', 'South Loop', 'Streeterville', 'Ukrainian Village', 'Uptown', 'Woodlawn'];
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
        if (!$tier2 || $tier2._transitioning) break;

        const isExpanded = btn.getAttribute('aria-expanded') === 'true';
        btn.setAttribute('aria-expanded', String(!isExpanded));
        $tier2.classList.toggle('tier--expanded');
        $tier2.setAttribute('aria-hidden', String(isExpanded));

        // Text crossfade — smooth "Show More" ↔ "Show Less" transition
        const $btnText = btn.querySelector('.tell-more-btn__text');
        if ($btnText) {
          $btnText.classList.add('tell-more-btn__text--fading');
          setTimeout(() => {
            $btnText.textContent = isExpanded ? 'See Match Details' : 'Hide Details';
            $btnText.classList.remove('tell-more-btn__text--fading');
          }, 100);
        }

        // Cancel idle arrow bounce if it's active
        if (_arrowBounceTimer) { clearTimeout(_arrowBounceTimer); _arrowBounceTimer = null; }

        $tier2._transitioning = true;
        const onDone = (e) => {
          if (e.propertyName !== 'max-height') return;
          $tier2.removeEventListener('transitionend', onDone);
          $tier2._transitioning = false;
          if ($tier2.classList.contains('tier--expanded')) {
            $tier2.style.maxHeight = 'none';
          }
          $tier2.style.willChange = '';
        };
        $tier2.addEventListener('transitionend', onDone);

        if (!isExpanded) {
          // Lazy-load Tier 2 content on first expand
          if (!_tier2Prepared && _pendingResultData) {
            _tier2Prepared = true;
            prepareTier2(_pendingResultData, _pendingCuisine);
          }
          // EXPANDING — set concrete height target then let CSS transition
          $tier2.style.willChange = 'max-height, opacity';
          requestAnimationFrame(() => {
            $tier2.style.maxHeight = $tier2.scrollHeight + 'px';
          });
          haptic(HAPTICS.tierExpand);
          renderTier2Animations();
          // Staggered story entrance — story arrives, then tip follows
          if (!REDUCED_MOTION.matches) {
            const $storyBlock = document.getElementById('restaurant-story');
            if ($storyBlock && $storyBlock.style.display !== 'none') {
              $storyBlock.classList.add('restaurant-story--entering');
              requestAnimationFrame(() => {
                requestAnimationFrame(() => {
                  $storyBlock.classList.remove('restaurant-story--entering');
                });
              });
            }
          }
          setTimeout(() => {
            const $scoreHero = document.getElementById('score-hero');
            $scoreHero?.scrollIntoView({ behavior: 'smooth', block: 'center' });
            // Move focus to Score Hero so keyboard/screen reader users land on new content
            $scoreHero?.focus({ preventScroll: true });
          }, 300);
          announce('Showing match details');
        } else {
          // COLLAPSING — snap to concrete px, force reflow, then transition to 0
          haptic(HAPTICS.tick);
          $tier2.style.willChange = 'max-height, opacity';
          $tier2.style.maxHeight = $tier2.scrollHeight + 'px';
          void $tier2.offsetHeight; // force reflow
          requestAnimationFrame(() => {
            $tier2.style.maxHeight = '0';
          });
        }
        break;
      }

      case 'toggle-factors':
      case 'show-vibe-profile': {
        // Factors are always visible — no-op
        break;
      }

      // Tier 3 removed — badges now live in Tier 2
    }
  });

  // Match Mini tap → toggle Tier 2 (same as Show More button)
  document.getElementById('match-pill')?.addEventListener('click', () => {
    const $tellMore = document.getElementById('tell-more-btn');
    if ($tellMore) {
      $tellMore.click(); // expand-tier-2 handler manages state
    }
    // Scroll to Score Hero when expanding (300ms lets expansion settle)
    if ($tellMore && $tellMore.getAttribute('aria-expanded') === 'true') {
      setTimeout(() => {
        document.getElementById('score-hero')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }, 300);
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
        textSpan.innerHTML = `${_escHtml(before)}<mark>${_escHtml(match)}</mark>${_escHtml(after)}`;
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
    // V9: Engagement trigger for canvas disclosure
    onCanvasEngaged();
    setState({ craving: $cravingInput.value });
    updateCtaState();
    clearEmptyState();
    // Character counter — visible at 80%+ of maxlength
    const $counter = document.getElementById('craving-counter');
    if ($counter) {
      const max = 500;
      const len = $cravingInput.value.length;
      if (len >= max * 0.8) {
        $counter.textContent = `${len} / ${max}`;
        $counter.hidden = false;
      } else {
        $counter.hidden = true;
      }
    }
    // F19: Auto-grow textarea
    $cravingInput.style.height = 'auto';
    $cravingInput.style.height = $cravingInput.scrollHeight + 'px';

    // Debounced chip reactivity
    clearTimeout(chipDebounce);
    chipDebounce = setTimeout(() => {
      updateChipsForInput($cravingInput.value.trim());
    }, 300);

    // Debounced auto-theme detection (visual palette with 300ms crossfade)
    clearTimeout(autoThemeDebounce);
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
    $cravingInput.style.transition = 'opacity 150ms cubic-bezier(0.4, 0, 0.2, 1)';
    $cravingInput.style.opacity = '0';
    setTimeout(() => {
      $cravingInput.placeholder = phs[idx];
      $cravingInput.style.opacity = '';
    }, 150);
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
      // Ink fill: accent color writes in left-to-right when CTA becomes enabled
      $cta.classList.add('cta-btn--ink-fill');
      // After ink fill completes (400ms), do one-shot ready pulse
      if (ctaBreathTimer) clearTimeout(ctaBreathTimer);
      ctaBreathTimer = setTimeout(() => {
        $cta.classList.remove('cta-btn--ink-fill');
        $cta.classList.add('cta-btn--ready');
        setTimeout(() => $cta.classList.remove('cta-btn--ready'), 400);
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
  const isOccasionTile = btn.classList.contains('occasion-tile');
  const group = btn.closest('[role="radiogroup"]') || btn.closest('.filter-pills');
  if (!group) return;

  // Create ink ripple BEFORE state change for visible contrast
  const ripple = document.createElement('span');
  ripple.className = isOccasionTile ? 'occasion-tile__ripple' : 'filter-pill__ripple';
  btn.appendChild(ripple);
  ripple.addEventListener('animationend', () => ripple.remove(), { once: true });

  // Deselect siblings (support both occasion tiles and filter pills)
  const siblingSelector = isOccasionTile ? '.occasion-tile' : '.filter-pill';
  group.querySelectorAll(siblingSelector).forEach(c => {
    c.setAttribute('aria-checked', 'false');
  });

  // Toggle: tapping the already-selected occasion tile deselects it (back to "Any")
  const selectedValue = btn.dataset.value;
  const currentValue = getState()[field];
  if (isOccasionTile && currentValue === selectedValue) {
    setState({ [field]: 'Any' });
    updateFilterSummary();
    announce('Vibe cleared');
    return;
  }

  // Select this one
  btn.setAttribute('aria-checked', 'true');
  btn.classList.add('chip-pop');
  btn.addEventListener('animationend', () => btn.classList.remove('chip-pop'), { once: true });

  setState({ [field]: selectedValue });
  updateFilterSummary();
  boostCta();
  announce(`${selectedValue} selected`);

  // Auto-collapse drawer when hood + budget + dietary are all set
  clearTimeout(autoAdvanceTimer);
  const st = getState();
  if (st.neighborhood !== 'Anywhere' && st.priceLevel !== 'Any' && st.dietaryRestrictions.length > 0) {
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
  document.querySelectorAll('.filter-pill[aria-checked="true"], .occasion-tile[aria-checked="true"]').forEach(c => {
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
  // Sync occasion strip tiles
  document.querySelectorAll('.occasion-tile[data-action="select-occasion"]').forEach(tile => {
    const isSelected = tile.dataset.value === s.occasion;
    tile.setAttribute('aria-checked', String(isSelected));
  });
}

function collapseFilters() {
  const toggle = document.querySelector('[data-action="toggle-filters"]');
  const content = document.getElementById('filter-content');
  if (toggle) toggle.setAttribute('aria-expanded', 'false');
  if (content && !content.hidden) _animateDrawerClose(content);
}

/* ---- Time-based occasion pre-highlight ---- */
function applyTimeBasedOccasionHint() {
  const now = new Date();
  const hour = now.getHours();
  const isWeekend = now.getDay() === 0 || now.getDay() === 6;
  let suggested = null;
  if (isWeekend) {
    if (hour >= 9 && hour < 13) suggested = 'Chill Hangout';
    else if (hour >= 17) suggested = 'Group Hangout';
  } else {
    if (hour >= 6 && hour < 10) suggested = 'Solo Dining';
    else if (hour >= 11 && hour < 14) suggested = 'Business Lunch';
    else if (hour >= 17 && hour < 21) suggested = 'Date Night';
    else if (hour >= 21) suggested = 'Adventure';
  }
  if (!suggested) return;
  // Apply subtle pre-highlight (not full selection) to the suggested tile
  const tile = document.querySelector(`.occasion-tile[data-value="${suggested}"]`);
  if (tile) tile.classList.add('occasion-tile--suggested');
}

/* ---- Hood group accordion (close others on open) ---- */
function initHoodGroups() {
  document.querySelectorAll('.hood-group').forEach(group => {
    group.addEventListener('toggle', () => {
      if (group.open) {
        document.querySelectorAll('.hood-group').forEach(other => {
          if (other !== group) other.removeAttribute('open');
        });
      }
    });
  });
}

function autoOpenHoodGroup(value) {
  if (!value || value === 'Anywhere') return;
  const pill = document.querySelector(`.hood-group .filter-pill[data-value="${value}"]`);
  if (!pill) return;
  const group = pill.closest('.hood-group');
  if (group) group.setAttribute('open', '');
  // Also expand the regions container
  const regions = document.getElementById('hood-regions');
  if (regions) regions.setAttribute('aria-hidden', 'false');
  const browse = document.querySelector('[data-action="toggle-hood-regions"]');
  if (browse) {
    browse.setAttribute('aria-expanded', 'true');
    browse.classList.add('hood-browse--active');
  }
}

/* ---- Tiered Celebration Orchestrator (audio + haptic sync) ---- */
function _fireTieredCelebration(score) {
  const tier = score >= 95 ? 4 : score >= 88 ? 3 : score >= 80 ? 2 : 1;
  fireCelebration(score);

  // Tier-specific audio
  if (tier === 1) {
    playSettleChime();
    haptic(HAPTICS.tick);
  } else if (tier === 2) {
    playGlowChime();
    haptic(HAPTICS.doublePulse);
  } else if (tier === 3) {
    playCelebrationChime();
    haptic(HAPTICS.celebration);
  } else {
    playSpectacleChime();
    haptic(HAPTICS.spectacle);
  }

  // Score count-up haptic sync — light taps at milestones
  if (tier >= 2) {
    [300, 600, 900].forEach(delay => {
      setTimeout(() => haptic(HAPTICS.tick), delay);
    });
  }
}

/* ---- Smooth filter drawer close ---- */
function _animateDrawerClose(content) {
  if (REDUCED_MOTION.matches) {
    content.hidden = true;
    return;
  }
  content.classList.add('filter-content--closing');
  content.addEventListener('animationend', () => {
    content.classList.remove('filter-content--closing');
    content.hidden = true;
  }, { once: true });
}

/* ---- Filter Summary (narrative sentence + drawer badge) ---- */
function updateFilterSummary() {
  const s = getState();
  // Drawer count badge (non-occasion filters only since occasion is on canvas)
  const drawerParts = [];
  if (s.neighborhood !== 'Anywhere') drawerParts.push(s.neighborhood);
  if (s.priceLevel !== 'Any') drawerParts.push(s.priceLevel);
  if (s.dietaryRestrictions?.length) drawerParts.push(s.dietaryRestrictions.join(', '));
  const $summary = document.getElementById('filter-summary');
  if ($summary) {
    $summary.textContent = drawerParts.length ? drawerParts.join(' \u00B7 ') : '';
  }
  const $count = document.getElementById('filter-count');
  if ($count) {
    $count.textContent = drawerParts.length ? String(drawerParts.length) : '';
  }

  // Narrative sentence
  const $narrative = document.getElementById('filter-narrative');
  if ($narrative) {
    const pieces = [];
    if (s.occasion !== 'Any') pieces.push(`<strong>${s.occasion.toLowerCase()}</strong>`);
    if (s.neighborhood !== 'Anywhere') pieces.push(`in <strong>${s.neighborhood}</strong>`);
    if (s.priceLevel !== 'Any') pieces.push(`around <strong>${s.priceLevel}</strong>`);
    if (s.dietaryRestrictions?.length) pieces.push(`(${s.dietaryRestrictions.join(', ')})`);
    if (s.openNow) pieces.push('open now');
    if (pieces.length > 0) {
      const sentence = pieces.length === 1
        ? `Looking for a ${pieces[0]} spot`
        : `A ${pieces[0]} spot ${pieces.slice(1).join(', ')}`;
      $narrative.innerHTML = sentence;
      $narrative.style.display = '';
    } else {
      $narrative.style.display = 'none';
    }
  }

  // Sync Open Now canvas toggle state
  const $openNowCanvas = document.getElementById('open-now-canvas');
  if ($openNowCanvas) {
    $openNowCanvas.setAttribute('aria-checked', String(!!s.openNow));
  }
}

/* ---- Score-First Blurb: fetch Claude blurb in background, reveal when ready ---- */
let _blurbRevealAbort = null;
const BLURB_REVEAL_GATE_MS = 1200; // Min delay before blurb can appear (let score animation establish)

function _writeBlurbText($rec, text) {
  let recText = text.replace(/\u2014/g, ', ').replace(/ , /g, ', ').replace(/,\s*,/g, ',');
  const fse = recText.search(/[.!?]\s/);
  if (fse > 10 && fse < recText.length - 5) {
    $rec.innerHTML = `<strong>${_escHtml(recText.slice(0, fse + 1))}</strong>${_escHtml(recText.slice(fse + 1))}`;
  } else {
    $rec.textContent = recText;
  }
}

function _animateBlurbIn($blurb, $rec) {
  if (!$blurb || !$blurb.classList.contains('donde-blurb--pending')) return;

  if (REDUCED_MOTION.matches) {
    $blurb.classList.remove('donde-blurb--pending');
    return;
  }

  // Measure target height for smooth expand
  $blurb.classList.add('donde-blurb--measuring');
  const targetHeight = $blurb.scrollHeight;
  $blurb.classList.remove('donde-blurb--measuring');

  // Animate: expand container height
  $blurb.style.height = '0px';
  $blurb.classList.remove('donde-blurb--pending');
  $blurb.classList.add('donde-blurb--arriving');

  requestAnimationFrame(() => {
    $blurb.style.height = targetHeight + 'px';

    // After expand completes, ink-reveal the text
    $blurb.addEventListener('transitionend', function onExpand(e) {
      if (e.propertyName !== 'height') return;
      $blurb.removeEventListener('transitionend', onExpand);
      $blurb.style.height = ''; // Let it be auto for reflows
      $blurb.classList.remove('donde-blurb--arriving');

      // Ink-reveal text
      $rec.classList.add('donde-blurb__text--revealing');
      $rec.addEventListener('animationend', () => {
        $rec.classList.remove('donde-blurb__text--revealing');
      }, { once: true });
    }, { once: false });
  });
}

function _revealBlurb(data) {
  if (_blurbRevealAbort) _blurbRevealAbort.abort();
  _blurbRevealAbort = new AbortController();

  const restaurant = data.restaurant || {};
  const $rec = document.getElementById('result-recommendation');
  const $blurb = document.getElementById('donde-blurb');
  if (!$rec || !$blurb) return;

  const blurbPayload = {
    restaurant_data: {
      name: restaurant.name,
      cuisine_type: restaurant.cuisine_type,
      price_level: restaurant.price_level,
      neighborhood_name: restaurant.neighborhood_name,
      noise_level: restaurant.noise_level,
      lighting_ambiance: restaurant.lighting_ambiance,
      outdoor_seating: restaurant.outdoor_seating,
      tags: data.tags || [],
      deep_context: data.deep_context || {},
    },
    context: {
      special_request: getState().craving,
      occasion: getState().occasion,
      neighborhood: getState().neighborhood,
      score_tier: (() => {
        const s = data.donde_match || 0;
        if (s >= 90) return 'exceptional';
        if (s >= 80) return 'great';
        if (s >= 65) return 'good';
        if (s >= 50) return 'decent';
        return 'weak';
      })(),
      match_narrative: data.match_narrative || null,
    },
  };

  const fetchStart = performance.now();

  fetchBlurb(blurbPayload).then((blurbData) => {
    // Guard: still showing the same restaurant?
    if (getState().result?.restaurant?.id !== restaurant.id) return;

    // Write Claude blurb text (overwriting the deterministic fallback)
    if (blurbData.recommendation) {
      _writeBlurbText($rec, blurbData.recommendation);
    }
    // Update insider tip
    const $tip = document.getElementById('story-tip-text');
    if ($tip && blurbData.insider_tip) {
      $tip.textContent = blurbData.insider_tip.replace(/\u2014/g, ', ').replace(/ , /g, ', ');
    }
    // Intent boost
    if (blurbData.intent_boost?.active) {
      $blurb.classList.add('donde-blurb--boosted');
    }

    // Gate: wait for score animation to establish before revealing
    const elapsed = performance.now() - fetchStart;
    const delay = Math.max(0, BLURB_REVEAL_GATE_MS - elapsed);
    setTimeout(() => _animateBlurbIn($blurb, $rec), delay);

  }).catch((err) => {
    if (err.name === 'AbortError') return;
    console.warn('[Blurb Reveal] Claude fetch failed, revealing fallback:', err.message);
    // Reveal the deterministic fallback that renderResult already placed in DOM
    const elapsed = performance.now() - fetchStart;
    const delay = Math.max(0, BLURB_REVEAL_GATE_MS - elapsed);
    setTimeout(() => _animateBlurbIn($blurb, $rec), delay);
  });
}

/* ---- Submit ---- */
async function handleSubmit() {
  const s = getState();

  // Block resubmission while loading
  if (s.loading) return;

  if (!s.craving.trim()) {
    $cravingInput?.classList.add('shake');
    $cravingInput?.addEventListener('animationend', () => $cravingInput.classList.remove('shake'), { once: true });
    $cravingInput?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    $cravingInput?.focus();
    // Inline hint instead of toast — modern validation pattern
    const $hint = document.getElementById('cta-hint');
    if ($hint) {
      $hint.textContent = "Tell us what you're craving first";
      $hint.setAttribute('aria-live', 'assertive');
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

  // Haptic: confident submit tap
  haptic([20]);

  // Set CTA to loading state with brief confirmation glow
  const $cta = document.querySelector('.cta-btn[data-action="submit"]');
  if ($cta) {
    $cta.classList.remove('cta-btn--ready');
    $cta.classList.add('cta-btn--confirming');
    if (!REDUCED_MOTION.matches) await new Promise(r => setTimeout(r, 200));
    $cta.classList.remove('cta-btn--confirming');
    $cta.classList.add('cta-btn--loading');
    $cta.textContent = 'Searching';
  }

  setState({ loading: true, error: null, result: null });
  clearEmptyState();
  // Ink Manifests: canvas fold + scaffold starts via subscriber (beginCanvasFold)
  // Step-track slide happens during Phase 1

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

    // V7: Store ranked queue for instant "Try Again"
    const rankedQueue = Array.isArray(data.ranked_queue) ? data.ranked_queue : [];
    // Set result — triggers orchestrateReveal() via subscription
    setState({ result: data, loading: false, history: hist, rankedQueue, rankedQueueIndex: 0 });
    renderSmartChips(); // Refresh chips with new history
    renderYourSpots(); // Refresh combined spots with new entry
    playChime();
    announce(`Recommendation: ${data.restaurant?.name || 'found'}`);
  } catch (err) {
    if (err.name === 'AbortError') return; // user navigated away
    // Error: reverse the canvas fold and return to input
    reverseCanvasFold();
    setState({ loading: false });
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

/* ============================================
   "Ink Manifests" — Canvas → Result Transition
   No overlay. Canvas folds into scaffold,
   data ink-writes into existence.
   ============================================ */

let _scaffoldTimers = [];
let _arrowBounceTimer = null;
let _sessionResultCount = 0;
let _swapInFlight = false;

/* ---- Phase 1: Canvas Fold ---- */
function beginCanvasFold() {
  const $canvas = document.querySelector('.canvas-layout');

  // Cancel any previous timers
  _scaffoldTimers.forEach(clearTimeout);
  _scaffoldTimers = [];

  // Hide result card
  if ($resultCard) {
    $resultCard.style.display = 'none';
    $resultCard.style.opacity = '0';
    $resultCard.style.transform = '';
    $resultCard.style.transition = '';
    $resultCard.classList.add('result-card--loading');
    $resultCard.classList.remove('result-card--revealing');
  }

  // Show unified loading-state overlay with particles + draw-loop + word rotation
  const $loadingState = document.getElementById('loading-state');
  if ($loadingState) {
    $loadingState.style.display = '';
    $loadingState.classList.remove('loading-state--fading');
    $loadingState.style.opacity = '';
    try {
      if (!REDUCED_MOTION.matches) {
        const $particleCanvas = document.getElementById('particle-canvas');
        if ($particleCanvas) startParticles($particleCanvas);
        initLogoAnimation(getState().craving);
        const labels = getLabels(getState().theme.culture);
        if (labels.loadingPhrases) startWordRotation(labels.loadingPhrases);
      }
    } catch (e) {
      console.error('Loading animation setup failed:', e);
    }
  }

  if ($canvas) $canvas.classList.add('canvas-layout--morphing');

  if (REDUCED_MOTION.matches) {
    goToStepInstant(1);
  } else {
    // Slide to result view after canvas morph completes (--dur-morph = 400ms)
    _scaffoldTimers.push(setTimeout(() => {
      goToStep(1);
    }, 400));
  }
}

/* ---- V10: Manifest Result — logo exit + progressive reveal ---- */
async function manifestResult(data) {
  _sessionResultCount++;

  // Stop any running timers
  stopWordRotation();
  _scaffoldTimers.forEach(clearTimeout);
  _scaffoldTimers = [];

  // Render all DOM content — wrapped to ensure loading overlay always cleans up
  try {
    renderResult(data);
  } catch (e) {
    console.error('renderResult failed:', e);
  }

  // Stop particles and resolve loading overlay
  stopParticles();
  const $loadingState = document.getElementById('loading-state');

  if (REDUCED_MOTION.matches) {
    // Instant swap
    if ($loadingState) { $loadingState.style.display = 'none'; cleanupLoadingLogo(); }
    if ($resultCard) {
      $resultCard.style.display = '';
      $resultCard.style.opacity = '1';
      $resultCard.classList.remove('result-card--scaffold', 'result-card--loading');
    }
  } else {
    // Phase 1: Resolve logo (confirmation pulse, 450ms)
    if ($loadingState) {
      resolveLogoToFound(data?.restaurant?.name);
      // Phase 2: Fade out overlay
      _scaffoldTimers.push(setTimeout(() => {
        $loadingState.classList.add('loading-state--fading');
        _scaffoldTimers.push(setTimeout(() => {
          $loadingState.style.display = 'none';
          $loadingState.classList.remove('loading-state--fading');
          cleanupLoadingLogo();
        }, 300));
      }, 450));
    }

    // Phase 3: Show card with progressive reveal (starts after overlay fade completes at 750ms)
    _scaffoldTimers.push(setTimeout(() => {
      if ($resultCard) {
        $resultCard.style.display = '';
        $resultCard.classList.remove('result-card--scaffold', 'result-card--loading');
        $resultCard.classList.add('result-card--revealing');
        $resultCard.style.opacity = '1';

        // Add typography animation class to restaurant name
        const $rName = $resultCard.querySelector('.result-name');
        if ($rName) $rName.classList.add('result-name--animated');

        // Clean up revealing class after all animations complete (520ms + 350ms + buffer)
        _scaffoldTimers.push(setTimeout(() => {
          $resultCard.classList.remove('result-card--revealing');
          if ($rName) $rName.classList.remove('result-name--animated');
        }, 950));
      }
    }, 750));
  }

  // Haptic on reveal
  haptic(HAPTICS.reveal);

  // Score count-up — the sole brand animation moment (delayed for progressive reveal)
  // After 2nd result in session, shorten to 600ms (reduce animation fatigue)
  const dondeScore = Math.round(parseFloat(data.donde_match) || 0);
  const scoreDuration = _sessionResultCount > 2 ? 600 : undefined;
  _scaffoldTimers.push(setTimeout(() => {
    animateScoreCountUp(
      document.getElementById('match-pill-score'),
      dondeScore,
      scoreDuration
    );
  }, REDUCED_MOTION.matches ? 0 : 360));

  // Tiered celebration (70+)
  if (dondeScore >= 70) {
    _scaffoldTimers.push(setTimeout(() => {
      _fireTieredCelebration(dondeScore);
    }, 1400));
  }

  // Photo strip auto-peek — subtle scroll hint (only if multiple photos)
  if (!REDUCED_MOTION.matches) {
    _scaffoldTimers.push(setTimeout(() => {
      const $photos = document.querySelector('.result-photos__scroll');
      if ($photos && $photos.scrollWidth > $photos.clientWidth) {
        $photos.scrollTo({ left: 60, behavior: 'smooth' });
        setTimeout(() => $photos.scrollTo({ left: 0, behavior: 'smooth' }), 600);
      }
    }, 1400));
  }

  // Score-first blurb: fire background Claude blurb fetch immediately (gate is internal)
  _revealBlurb(data);

  // Settle — clean up after animations complete
  _scaffoldTimers.push(setTimeout(() => {
    settleResult();
  }, 1200));

  // Schedule edge-hint replays
  scheduleEdgeHintReplay();

  // Show More arrow bounce hint after 5s idle (if Tier 2 not already opened)
  if (_arrowBounceTimer) clearTimeout(_arrowBounceTimer);
  _arrowBounceTimer = setTimeout(() => {
    const $tellMore = document.getElementById('tell-more-btn');
    if ($tellMore && $tellMore.getAttribute('aria-expanded') !== 'true') {
      const $arrow = $tellMore.querySelector('.tell-more-btn__arrow');
      if ($arrow) {
        $arrow.classList.add('tell-more-btn__arrow--bouncing');
        $arrow.addEventListener('animationend',
          () => $arrow.classList.remove('tell-more-btn__arrow--bouncing'), { once: true });
      }
    }
  }, 5000);
}

/* ---- Settle (cleanup after manifest completes) ---- */
function settleResult() {
  // Clean canvas morph class (so returning to canvas is clean)
  const $canvas = document.querySelector('.canvas-layout');
  if ($canvas) $canvas.classList.remove('canvas-layout--morphing');
  // Clear neighborhood from header
  const $headerHood = document.getElementById('header-hood');
  if ($headerHood) $headerHood.style.display = 'none';
  // Clean up loading-state overlay
  stopParticles();
  const $loadingState = document.getElementById('loading-state');
  if ($loadingState) {
    $loadingState.style.display = 'none';
    $loadingState.classList.remove('loading-state--fading');
    cleanupLoadingLogo();
  }
  // A11y: Move focus to restaurant name for screen readers
  const $restName = document.getElementById('result-name');
  if ($restName) $restName.focus({ preventScroll: true });
}

/* ---- Reverse Canvas Fold (error/back during loading) ---- */
function reverseCanvasFold() {
  stopWordRotation();
  _scaffoldTimers.forEach(clearTimeout);
  _scaffoldTimers = [];
  // Cancel any running score count-up RAF
  if (_scoreCountUpRaf) { cancelAnimationFrame(_scoreCountUpRaf); _scoreCountUpRaf = null; }

  const $canvas = document.querySelector('.canvas-layout');

  if ($canvas) $canvas.classList.remove('canvas-layout--morphing');
  if ($resultCard) {
    $resultCard.classList.remove('result-card--loading', 'result-card--revealing');
    $resultCard.style.display = 'none';
  }

  // Clean up loading-state overlay
  stopParticles();
  const $loadingState = document.getElementById('loading-state');
  if ($loadingState) {
    $loadingState.style.display = 'none';
    $loadingState.classList.remove('loading-state--fading');
    cleanupLoadingLogo();
  }

  goToStep(0);
}

/* ---- Unfold Result to Canvas (animated back navigation) ---- */
function unfoldResultToCanvas() {
  const $canvas = document.querySelector('.canvas-layout');

  if (REDUCED_MOTION.matches) {
    // Instant: just clean up and go back
    settleResult();
    if ($resultCard) $resultCard.style.display = 'none';
    goToStep(0);
    return;
  }

  // Phase A: Result card content fades down (staggered reverse)
  if ($resultCard) {
    $resultCard.classList.add('result-card--unfolding');
  }

  // Phase B: After content fades, slide step-track back and restore canvas
  setTimeout(() => {
    // Remove morphing so canvas elements are ready to restore
    if ($canvas) {
      $canvas.classList.remove('canvas-layout--morphing');
      $canvas.classList.add('canvas-layout--restoring');
    }

    goToStep(0);

    // Phase C: After slide completes, clean up result card
    setTimeout(() => {
      if ($resultCard) {
        $resultCard.classList.remove('result-card--unfolding');
        $resultCard.style.display = 'none';
      }
      // Clean restore class after animations complete
      setTimeout(() => {
        if ($canvas) $canvas.classList.remove('canvas-layout--restoring');
      }, 400);
    }, 350);
  }, 250);
}

/* (V10: wordGroupReveal removed — blurb fades in with card) */

/* ---- Legacy compatibility: toggleLoading fallback ---- */
function toggleLoading(loading) {
  if (loading) {
    beginCanvasFold();
  } else {
    reverseCanvasFold();
  }
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

/* ---- V7: Score Count-Up Animation (reusable) ---- */
let _scoreCountUpRaf = null;
function animateScoreCountUp($el, targetScore, customDuration) {
  // Cancel any prior count-up RAF to prevent orphaned animations
  if (_scoreCountUpRaf) {
    cancelAnimationFrame(_scoreCountUpRaf);
    _scoreCountUpRaf = null;
  }
  const $arcFill = document.getElementById('match-pill-arc-fill');
  const arcLength = 2 * Math.PI * 25; // ~157.08 (full circle, r=25)
  if ($arcFill) {
    $arcFill.style.transition = 'none';
    $arcFill.style.strokeDasharray = String(arcLength);
    $arcFill.style.strokeDashoffset = String(arcLength);
  }
  $el.textContent = '0';
  const REDUCED_MQ = matchMedia('(prefers-reduced-motion: reduce)');
  if (!REDUCED_MQ.matches) {
    const duration = customDuration || 1200; // matches --dur-score token
    const start = performance.now();
    const animate = (now) => {
      const elapsed = now - start;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      const current = Math.round(eased * targetScore);
      $el.textContent = current;
      const thresholdColor = getScoreThresholdColor(current);
      $el.style.color = thresholdColor;
      // Font weight morph: 400 → 600 as score fills
      $el.style.fontWeight = String(Math.round(400 + progress * 200));
      if ($arcFill) {
        $arcFill.style.strokeDashoffset = String(arcLength - (current / 100) * arcLength);
        $arcFill.style.stroke = thresholdColor;
      }
      if (progress < 1) {
        _scoreCountUpRaf = requestAnimationFrame(animate);
      } else {
        _scoreCountUpRaf = null;
        // Completion pulse on the score ring wrap
        const $scoreWrap = document.querySelector('.match-mini__score-wrap');
        if ($scoreWrap) {
          $scoreWrap.classList.add('match-mini__score-wrap--pulsing');
          $scoreWrap.addEventListener('animationend',
            () => $scoreWrap.classList.remove('match-mini__score-wrap--pulsing'), { once: true });
        }
      }
    };
    _scoreCountUpRaf = requestAnimationFrame(animate);
  } else {
    $el.textContent = targetScore;
    const finalColor = getScoreThresholdColor(targetScore);
    $el.style.color = finalColor;
    if ($arcFill) {
      $arcFill.style.strokeDashoffset = String(arcLength - (targetScore / 100) * arcLength);
      $arcFill.style.stroke = finalColor;
    }
  }
}

/* ---- Result Rendering ---- */
function renderResult(data) {
  if (!data?.restaurant) return;
  const r = data.restaurant;

  // Cancel any in-flight animation timeouts from a previous render
  animationTimers.forEach(clearTimeout);
  animationTimers = [];

  // Destroy previous Info Stream
  if (_activeInfoStream) { _activeInfoStream.destroy(); _activeInfoStream = null; }

  // Reset tier animation flags for fresh render
  _tier2Animated = false;
  // Reset typewriter flags on story elements
  const $storyTipEl = document.getElementById('story-tip-text');
  if ($storyTipEl) $storyTipEl._hasRevealed = false;

  // Reset bloom state (factor bars)
  resetBloomState();

  // Reset tier expansion state — always start at Tier 1 (Glance)
  const $tier2 = document.getElementById('tier-leanin');
  const $tellMore = document.getElementById('tell-more-btn');
  if ($tier2) { $tier2.classList.remove('tier--expanded'); $tier2.setAttribute('aria-hidden', 'true'); $tier2.style.maxHeight = ''; $tier2._transitioning = false; }
  if ($tellMore) { $tellMore.setAttribute('aria-expanded', 'false'); const t = $tellMore.querySelector('.tell-more-btn__text'); if (t) t.textContent = 'See Match Details'; }

  // Cuisine detection (for accent color + auto-theme)
  const cuisine = getCuisineFromResult(data);

  // Auto-theme on result — wash spreads from score ring
  if (cuisine.culture) {
    const $scoreRing = document.getElementById('score-hero-ring-fill') || document.getElementById('match-pill');
    if ($scoreRing) {
      const ringRect = $scoreRing.getBoundingClientRect();
      setWashOrigin(ringRect.left + ringRect.width / 2, ringRect.top + ringRect.height / 2);
    }
    setTheme(cuisine.culture, getState().theme.mode);
  } else {
    revertAutoTheme();
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

  // Mini semicircle arc setup
  const $arcFill = document.getElementById('match-pill-arc-fill');
  const arcLength = Math.PI * 20; // ~62.83 (semicircle, r=20)
  if ($arcFill) {
    $arcFill.style.transition = 'none';
    $arcFill.style.strokeDasharray = String(arcLength);
    $arcFill.style.strokeDashoffset = String(arcLength); // Start empty
    $arcFill.style.stroke = getScoreThresholdColor(0);
  }

  const REDUCED_MQ = matchMedia('(prefers-reduced-motion: reduce)');
  if ($matchScore && !REDUCED_MQ.matches) {
    animationTimers.push(setTimeout(() => {
      const duration = 1200; // matches --dur-score token
      const start = performance.now();
      const animate = (now) => {
        const elapsed = now - start;
        const progress = Math.min(elapsed / duration, 1);
        const eased = 1 - Math.pow(1 - progress, 3);
        const current = Math.round(eased * dondeScore);
        $matchScore.textContent = current;
        const thresholdColor = getScoreThresholdColor(current);
        $matchScore.style.color = thresholdColor;
        if ($arcFill) {
          $arcFill.style.strokeDashoffset = String(arcLength - (current / 100) * arcLength);
          $arcFill.style.stroke = thresholdColor;
        }
        if (progress < 1) {
          requestAnimationFrame(animate);
        } else {
          // Arc settle pulse on completion
          if ($arcFill) {
            $arcFill.style.animation = 'arcSettle 400ms var(--spring)';
          }
          // Pill settle pulse
          const $pill = document.getElementById('match-pill');
          if ($pill) {
            $pill.style.transition = 'transform 200ms cubic-bezier(0.34, 1.56, 0.64, 1)';
            $pill.style.transform = 'scale(1.03)';
            setTimeout(() => {
              $pill.style.transform = 'scale(1)';
            }, 120);
          }
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

  // Cuisine + Open/Closed context row — directly below name in Tier 1
  renderGlanceContext(data);

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

  // V5: Intent Boost badge — removed (redundant with formula row boost pill)
  // renderIntentBoostBadge(data);

  // V5: Relaxation notice — shown above result card when filters were expanded
  renderRelaxationNotice(data);

  // Match signal — removed (redundant with blurb + formula row)
  const $matchSignal = document.getElementById('match-signal');
  if ($matchSignal) $matchSignal.style.display = 'none';

  // Craving echo — show what the user asked for
  const $cravingEcho = document.getElementById('craving-echo');
  if ($cravingEcho) {
    const craving = getState().craving;
    $cravingEcho.textContent = craving ? `You asked for "${craving}"` : '';
  }

  // DondeAI Recommendation blurb — the editorial voice in Tier 1
  const $rec = document.getElementById('result-recommendation');
  const $blurb = document.getElementById('donde-blurb');
  if ($rec) {
    let recText = (data.recommendation || '').replace(/\u2014/g, ', ').replace(/ , /g, ', ').replace(/,\s*,/g, ',');
    // V8: Fallback to match_narrative summary if recommendation is too short (queue item without blurb)
    if (recText.length < 40 && data.match_narrative?.summary) {
      recText = data.match_narrative.summary;
      if (data.match_narrative.key_signals?.length > 0) {
        recText += ' ' + data.match_narrative.key_signals.join('. ') + '.';
      }
    }
    // First-sentence emphasis — lede structure (bold the hook)
    const firstSentenceEnd = recText.search(/[.!?]\s/);
    if (firstSentenceEnd > 10 && firstSentenceEnd < recText.length - 5) {
      const first = recText.slice(0, firstSentenceEnd + 1);
      const rest = recText.slice(firstSentenceEnd + 1);
      $rec.innerHTML = `<strong>${_escHtml(first)}</strong>${_escHtml(rest)}`;
    } else {
      $rec.textContent = recText;
    }
    if ($blurb) {
      // Blurb starts collapsed — will be revealed by _revealBlurb() after Claude responds
      $blurb.classList.add('donde-blurb--pending');
      $blurb.style.display = recText ? '' : 'none';
      $blurb.classList.toggle('donde-blurb--boosted', !!data.intent_boost?.active);
    }
  }

  // V10: Known For moved to Tier 2 (rendered in prepareTier2)

  // F3: Enhanced map navigation tile
  renderMapPreview(data);


  // Inject icons into footer action buttons
  const $tryAgainIcon = document.getElementById('try-again-icon');
  if ($tryAgainIcon) $tryAgainIcon.innerHTML = svgIcon('refresh', 16);
  const $glanceStartOverIcon = document.getElementById('glance-start-over-icon');
  if ($glanceStartOverIcon) $glanceStartOverIcon.innerHTML = svgIcon('home', 16);
  const $startOverIcon = document.getElementById('start-over-icon');
  if ($startOverIcon) $startOverIcon.innerHTML = svgIcon('home', 14);

  // Update Try Another button with exhaustion indicator
  updateTryAgainState();

  // ═══════════════════════════════════════════════════════
  // TIER 2: LEAN-IN — Prepare content (hidden until expanded)
  // ═══════════════════════════════════════════════════════

  // Store data reference for lazy tier 2 rendering (rendered on demand when expanded)
  _pendingResultData = data;
  _pendingCuisine = cuisine;
  _tier2Prepared = false;

  // V9: Photo parallax depth effect
  setupPhotoParallax();

  // V10: No progressive reveal — card fades in as one unit via manifestResult

  // V10: Peek affordance removed — seamless loading, no theatrical animations
}

let _peekShown = false; // Only peek once per session

/* ---- V9: Photo Parallax on Scroll ---- */
let _parallaxRaf = null;
function setupPhotoParallax() {
  if (_parallaxRaf) cancelAnimationFrame(_parallaxRaf);
  const $photos = document.getElementById('result-photos');
  if (!$photos) return;
  // Respect reduced-motion preference
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  $photos.classList.add('result-photos--parallax');
  const handler = () => {
    _parallaxRaf = requestAnimationFrame(() => {
      const rect = $photos.getBoundingClientRect();
      if (rect.bottom < 0 || rect.top > window.innerHeight) return;
      const shift = Math.round(rect.top * -0.15);
      $photos.style.setProperty('--parallax-y', `${shift}px`);
    });
  };
  window.addEventListener('scroll', handler, { passive: true });
  // Store cleanup reference
  $photos._parallaxCleanup = () => {
    window.removeEventListener('scroll', handler);
    if (_parallaxRaf) cancelAnimationFrame(_parallaxRaf);
  };
}

/* ---- Pending result data for lazy tier rendering ---- */
let _pendingResultData = null;
let _pendingCuisine = null;

/* ---- Prepare Tier 2 DOM content (populated but hidden) ---- */
function prepareTier2(data, cuisine) {
  const r = data.restaurant;

  // Score Hero arc — populate but don't animate yet (animations triggered on scroll reveal)
  renderScoreHero(
    data.donde_match,
    data.scores || {},
    data.scoring || data.scoring_v9 || null,
    null,
    [],
    data.match_narrative || null
  );

  // V9: Formula row — Relevance gate + optional boost pill
  try {
    const $formulaContainer = document.getElementById('score-hero-formula');
    if ($formulaContainer && data.scoring_v9) {
      renderRelevanceGate(data.scoring_v9, $formulaContainer, [], data.intent_boost || null);
    }
  } catch (e) { console.warn('V9 formula row render failed:', e); }

  // V9: Occasion bonus now shown inside formula row pill (renderRelevanceGate)

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
      // Fade-in reveal for insider tips — ink settling on paper
      if (!$storyTip._hasRevealed) {
        $storyTip._hasRevealed = true;
        $storyTip.textContent = tipContent;
        if (!REDUCED_MOTION.matches) {
          $storyTip.classList.add('story-tip--revealing');
          animationTimers.push(setTimeout(() => {
            requestAnimationFrame(() => {
              $storyTip.classList.remove('story-tip--revealing');
            });
          }, 300));
        }
      } else {
        $storyTip.textContent = tipContent;
      }
    } else if ($storyTip) {
      $storyTip.textContent = '';
    }
  }

  // Awards — rendered into unified detail-strip (populated later by renderPerfectFor)
  // Store awards on data for renderPerfectFor to merge them
  data._awardBadges = [];
  const dc2 = data.deep_context;
  if (dc2?.awards_recognition?.length > 0) {
    data._awardBadges = dc2.awards_recognition.slice(0, 3);
  }



  // 1D: Deep context extras (USP, wow factors)
  renderDeepContextExtras(data);

  // Known For data now merged into cuisine drawer (Phase 3 reorganization)

}



/* ---- Tier 2 lazy-load flag (prepared on first expand) ---- */
let _tier2Prepared = false;

/* ---- Tier 2 animation trigger (called on first expand) ---- */
let _tier2Animated = false;
function renderTier2Animations() {
  if (_tier2Animated) return;
  _tier2Animated = true;
  haptic(HAPTICS.scoreReveal);

  const data = _pendingResultData;
  if (!data) return;

  // Reset bloom state so factor bars render fresh with animations
  // (prepareTier2's 900ms-delayed renderFactorBars may have already set _factorBarsRendered)
  resetBloomState();

  // Animate Confidence Ring + factor bars (renderScoreHero auto-triggers factor bars)
  renderScoreHero(
    data.donde_match,
    data.scores || {},
    data.scoring || data.scoring_v9 || null,
    null,
    animationTimers,
    data.match_narrative || null
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
  // Longer auto-close for content-heavy popouts (known-for)
  const timeout = popout.classList.contains('badge-popout--known-for') ? 8000 : 5000;
  _popoutTimer = setTimeout(() => closeBadgePopout(), timeout);
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

  // V8: Account for scroll position of result container
  const scrollContainer = document.querySelector('.step[data-step="1"]');
  const scrollOffset = scrollContainer?.scrollTop || 0;

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

/* ---- Render Glance Context (Cuisine + Open/Closed — below name in Tier 1) ---- */
function renderGlanceContext(data) {
  const $ctx = document.getElementById('glance-context');
  if (!$ctx) return;
  $ctx.innerHTML = '';

  const r = data.restaurant || {};

  // Cuisine pill — static label (details shown inline in Tier 2)
  if (r.cuisine_type) {
    const pill = document.createElement('span');
    pill.className = 'glance-context__pill glance-context__pill--static type-data--sm';
    pill.innerHTML = `${svgIcon('plate', 11)} ${r.cuisine_type}`;
    $ctx.appendChild(pill);
  }

  // Open/Closed status → hours popout
  const oh = r.opening_hours;
  if (oh?.open_now != null) {
    const pill = document.createElement('span');
    pill.className = `glance-context__pill ${oh.open_now ? 'glance-context__pill--open' : 'glance-context__pill--closed'} type-data--sm`;

    // Extract today's hours for inline display
    let todayHours = '';
    const hasHours = oh.weekday_text?.length > 0;
    if (hasHours) {
      const todayName = new Date().toLocaleDateString('en-US', { weekday: 'long' }).toLowerCase();
      const todayLine = oh.weekday_text.find(l => l.toLowerCase().startsWith(todayName));
      if (todayLine) {
        const ci = todayLine.indexOf(':');
        if (ci >= 0) {
          todayHours = todayLine.slice(ci + 1).trim()
            .replace(/(\d{1,2}):00\s*(AM|PM)/gi, (_, h, ap) => `${h}${ap[0].toLowerCase()}`)
            .replace(/(\d{1,2}:\d{2})\s*(AM|PM)/gi, (_, t, ap) => `${t}${ap[0].toLowerCase()}`)
            .replace(/\s*[–—-]\s*/g, '–');
        }
      }
    }

    const statusText = oh.open_now ? 'Open' : 'Closed';
    const hoursInline = todayHours ? ` · ${todayHours}` : '';
    pill.innerHTML = `${svgIcon('clock', 11)} ${statusText}${hoursInline}`;

    if (hasHours) {
      pill.setAttribute('role', 'button');
      pill.setAttribute('tabindex', '0');
      pill.setAttribute('aria-expanded', 'false');
      pill.setAttribute('aria-haspopup', 'true');
      pill.setAttribute('data-action', 'toggle-badge-popout');
    } else {
      // No detailed hours — just show status, not interactive
      pill.style.cursor = 'default';
    }

    // Hours popout child
    if (hasHours) {
      const popout = document.createElement('div');
      popout.className = 'badge-popout badge-popout--hours';
      popout.setAttribute('role', 'tooltip');
      const title = document.createElement('span');
      title.className = 'badge-popout__title';
      title.textContent = 'Hours';
      popout.appendChild(title);
      const today = new Date().toLocaleDateString('en-US', { weekday: 'long' }).toLowerCase();
      const table = document.createElement('div');
      table.className = 'hours-table';
      oh.weekday_text.forEach(line => {
        const colonIdx = line.indexOf(':');
        if (colonIdx < 0) return;
        const dayPart = line.slice(0, colonIdx).trim();
        const timePart = line.slice(colonIdx + 1).trim();
        const isToday = dayPart.toLowerCase() === today;
        const row = document.createElement('div');
        row.className = `hours-table__row${isToday ? ' hours-table__row--today' : ''}`;
        const dayEl = document.createElement('span');
        dayEl.className = 'hours-table__day';
        dayEl.textContent = dayPart.slice(0, 3);
        const timeEl = document.createElement('span');
        timeEl.className = 'hours-table__time';
        timeEl.textContent = timePart
          .replace(/(\d{1,2}):00\s*(AM|PM)/gi, (_, h, ap) => `${h}${ap[0].toLowerCase()}`)
          .replace(/(\d{1,2}:\d{2})\s*(AM|PM)/gi, (_, t, ap) => `${t}${ap[0].toLowerCase()}`)
          .replace(/\s*[–—-]\s*/g, ' – ');
        row.appendChild(dayEl);
        row.appendChild(timeEl);
        table.appendChild(row);
      });
      popout.appendChild(table);
      pill.appendChild(popout);
    }

    $ctx.appendChild(pill);
  } else if (r.best_times?.length) {
    // Fallback: show meal periods when Google hours unavailable
    const pill = document.createElement('span');
    pill.className = 'glance-context__pill glance-context__pill--static type-data--sm';
    const times = r.best_times.slice(0, 2).map(t =>
      t.charAt(0).toUpperCase() + t.slice(1).toLowerCase()
    ).join(' · ');
    pill.innerHTML = `${svgIcon('clock', 11)} ${times}`;
    $ctx.appendChild(pill);
  }
}

/* ---- Normalize tag text: underscores→spaces, 3 words max, sentence case ---- */
function normalizeTagText(text) {
  if (!text) return text;
  const normalized = text.replace(/_/g, ' ').replace(/-/g, ' ').trim();
  const words = normalized.split(/\s+/);
  const capped = words.length <= 3 ? words.join(' ') : words.slice(0, 3).join(' ');
  return capped.charAt(0).toUpperCase() + capped.slice(1).toLowerCase();
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
    ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(r.name)}&query_place_id=${r.google_place_id}`
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

  // Navigation (directions) — first in row, styled same as Reserve/Share
  const shortAddr = r.address?.split(',')[0] || '';
  const rawHood = r.neighborhood_name || '';
  const hood = /^chicago$/i.test(rawHood.trim()) ? '' : rawHood;
  const navLabel = hood ? `${hood} \u00b7 ${shortAddr}` : shortAddr;
  const navUrl = r.google_place_id
    ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(r.name)}&query_place_id=${r.google_place_id}`
    : r.address ? buildMapsUrl(r.address) : null;
  if (navUrl && navLabel) {
    items.unshift({ icon: 'pin', label: navLabel, href: navUrl });
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

/* ---- Result Meta: website, cuisine, what to order, open/closed pills ---- */
function renderResultMeta(data) {
  const $meta = document.getElementById('result-context');
  if (!$meta) return;
  $meta.innerHTML = '';

  const r = data.restaurant || {};
  const dp = data.deep_context || {};

  // 0. Neighborhood pill
  const rawHood = r.neighborhood_name || '';
  const neighborhood = /^chicago$/i.test(rawHood.trim()) ? '' : rawHood;
  if (neighborhood) {
    const hoodPill = document.createElement('span');
    hoodPill.className = 'result-meta__pill type-data--sm';
    hoodPill.innerHTML = `${svgIcon('pin', 11)} ${neighborhood}`;
    $meta.appendChild(hoodPill);
  }

  // 1. Cuisine pill — static label (details shown inline in Tier 2)
  if (r.cuisine_type) {
    const pill = document.createElement('span');
    pill.className = 'result-meta__pill type-data--sm';
    pill.innerHTML = `${svgIcon('plate', 11)} ${r.cuisine_type}`;
    $meta.appendChild(pill);
  }

  // 2. Open/Closed status pill with hours popout
  const oh = r.opening_hours;
  if (oh?.open_now != null) {
    const pill = document.createElement('span');
    pill.className = `result-meta__pill result-meta__pill--interactive ${oh.open_now ? 'result-meta__pill--open' : 'result-meta__pill--closed'} type-data--sm`;
    pill.setAttribute('role', 'button');
    pill.setAttribute('tabindex', '0');
    pill.setAttribute('aria-expanded', 'false');
    pill.setAttribute('aria-haspopup', 'true');
    pill.setAttribute('data-action', 'toggle-badge-popout');
    pill.textContent = oh.open_now ? 'Open Now' : 'Closed';

    // Build hours popout — clean table layout (Google Maps style)
    if (oh.weekday_text?.length) {
      const popout = document.createElement('div');
      popout.className = 'badge-popout badge-popout--hours';
      popout.setAttribute('role', 'tooltip');
      const title = document.createElement('span');
      title.className = 'badge-popout__title';
      title.textContent = 'Hours';
      popout.appendChild(title);
      const today = new Date().toLocaleDateString('en-US', { weekday: 'long' }).toLowerCase();
      const table = document.createElement('div');
      table.className = 'hours-table';
      oh.weekday_text.forEach(line => {
        const colonIdx = line.indexOf(':');
        if (colonIdx < 0) return;
        const dayPart = line.slice(0, colonIdx).trim();
        const timePart = line.slice(colonIdx + 1).trim();
        const isToday = dayPart.toLowerCase() === today;
        const row = document.createElement('div');
        row.className = `hours-table__row${isToday ? ' hours-table__row--today' : ''}`;
        const dayEl = document.createElement('span');
        dayEl.className = 'hours-table__day';
        dayEl.textContent = dayPart.slice(0, 3);
        const timeEl = document.createElement('span');
        timeEl.className = 'hours-table__time';
        // Shorten time format: "11:00 AM – 10:00 PM" → "11a – 10p"
        timeEl.textContent = timePart
          .replace(/(\d{1,2}):00\s*(AM|PM)/gi, (_, h, ap) => `${h}${ap[0].toLowerCase()}`)
          .replace(/(\d{1,2}:\d{2})\s*(AM|PM)/gi, (_, t, ap) => `${t}${ap[0].toLowerCase()}`)
          .replace(/\s*[–—-]\s*/g, ' – ');
        row.appendChild(dayEl);
        row.appendChild(timeEl);
        table.appendChild(row);
      });
      popout.appendChild(table);
      pill.appendChild(popout);
    }

    $meta.appendChild(pill);
  }

  $meta.style.display = $meta.children.length > 0 ? '' : 'none';
}

/* humanizeSnake moved to utils.js — imported at top of file */

/* ---- Spice Level → Intuitive Label ---- */
function formatSpiceLevel(raw) {
  if (!raw) return '';
  const map = {
    none: 'Not spicy', mild: 'Mild', low: 'Mild',
    medium: 'Medium', moderate: 'Medium',
    hot: 'Spicy', high: 'Spicy', very_hot: 'Very spicy', extra_hot: 'Very spicy',
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

    // V9: Factor bars rendered by animations.js renderFactorBars()
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
  document.getElementById('photo-dots')?.remove();
  const urls = photoUrls.slice(0, 5);

  // V10: Horizontal scroll strip — all photos equal, swipeable
  $photos.classList.remove('result-photos--hero');

  urls.forEach((url, i) => {
    const img = document.createElement('img');
    img.className = 'result-photos__img';
    img.src = url;
    img.alt = `${data.restaurant.name} photo ${i + 1}`;
    img.loading = i === 0 ? 'eager' : 'lazy';
    img.decoding = 'async';
    img.style.cursor = 'zoom-in';
    img.addEventListener('click', () => openLightbox(urls, i));
    $photos.appendChild(img);
  });

  // Photo count indicator (e.g. "1 / 4")
  if (urls.length > 1) {
    const $count = document.createElement('span');
    $count.className = 'result-photos__count';
    $count.textContent = `1 / ${urls.length}`;
    $photos.appendChild($count);

    // Update count on scroll via IntersectionObserver
    const observer = new IntersectionObserver((entries) => {
      for (const entry of entries) {
        if (entry.isIntersecting) {
          const idx = Array.from($photos.querySelectorAll('.result-photos__img')).indexOf(entry.target);
          if (idx >= 0) $count.textContent = `${idx + 1} / ${urls.length}`;
        }
      }
    }, { root: $photos, threshold: 0.6 });
    $photos.querySelectorAll('.result-photos__img').forEach(img => observer.observe(img));

    // Ken Burns: activate subtle drift on visible photo after 3s idle
    let _kenBurnsTimer = null;
    const activateKenBurns = () => {
      if (_kenBurnsTimer) clearTimeout(_kenBurnsTimer);
      // Remove from all first
      $photos.querySelectorAll('.result-photos__img--active').forEach(el =>
        el.classList.remove('result-photos__img--active'));
      _kenBurnsTimer = setTimeout(() => {
        if (REDUCED_MOTION.matches) return;
        // Find the currently visible photo
        const imgs = $photos.querySelectorAll('.result-photos__img');
        const visible = Array.from(imgs).find(img => {
          const r = img.getBoundingClientRect();
          const pr = $photos.getBoundingClientRect();
          return r.left >= pr.left - 10 && r.right <= pr.right + 10;
        });
        if (visible) visible.classList.add('result-photos__img--active');
      }, 3000);
    };
    $photos.addEventListener('scroll', () => activateKenBurns(), { passive: true });
    activateKenBurns(); // Start idle timer on initial load
  }

  // Haptic on photo scroll
  let _photoSwipeTriggered = false;
  $photos.addEventListener('scroll', () => {
    if (!_photoSwipeTriggered) {
      _photoSwipeTriggered = true;
      haptic(HAPTICS.photoSwipe);
      setTimeout(() => { _photoSwipeTriggered = false; }, 500);
    }
  }, { passive: true });

  $photos.style.display = '';
}

/* ---- Photo Lightbox (with View Transitions API morph) ---- */
function openLightbox(urls, startIndex) {
  const $lightbox = document.getElementById('lightbox');
  const $track = document.getElementById('lightbox-track');
  const $counter = document.getElementById('lightbox-counter');
  if (!$lightbox || !$track) return;

  // Set view-transition-name on the source thumbnail for morph
  const sourceImg = document.querySelectorAll('.result-photos__img')[startIndex];
  if (sourceImg) sourceImg.style.viewTransitionName = 'donde-photo';

  const doOpen = () => {
    $track.innerHTML = '';
    urls.forEach((url, i) => {
      const img = document.createElement('img');
      img.src = url;
      img.alt = `Photo ${i + 1} of ${urls.length}`;
      img.draggable = false;
      // Match view-transition-name on target image
      if (i === startIndex) img.style.viewTransitionName = 'donde-photo';
      $track.appendChild(img);
    });

    $lightbox.style.display = '';
    if ($counter) $counter.textContent = `${startIndex + 1} / ${urls.length}`;
  };

  // Use View Transitions API if available (progressive enhancement)
  if (document.startViewTransition && !REDUCED_MOTION.matches) {
    const transition = document.startViewTransition(doOpen);
    transition.finished.then(() => {
      if (sourceImg) sourceImg.style.viewTransitionName = '';
    });
    haptic(HAPTICS.photoSnap);
  } else {
    doOpen();
  }

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

  // Focus trap: cache previous focus, move to close button
  $lightbox._prevFocus = document.activeElement;
  $lightbox.classList.add('lightbox--open');
  const $closeBtn = $lightbox.querySelector('[data-action="close-lightbox"]');
  if ($closeBtn) $closeBtn.focus();

  // Trap Tab within lightbox
  const onTab = (e) => {
    if (e.key !== 'Tab') return;
    const focusable = $lightbox.querySelectorAll('button, [tabindex]:not([tabindex="-1"])');
    if (focusable.length === 0) return;
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault();
      first.focus();
    }
  };
  document.addEventListener('keydown', onTab);
  $lightbox._tabCleanup = () => document.removeEventListener('keydown', onTab);
}

function closeLightbox() {
  const $lightbox = document.getElementById('lightbox');
  if (!$lightbox) return;

  const doClose = () => {
    $lightbox.style.display = 'none';
    $lightbox.classList.remove('lightbox--open');
    if ($lightbox._cleanup) $lightbox._cleanup();
    if ($lightbox._keyCleanup) $lightbox._keyCleanup();
    if ($lightbox._tabCleanup) $lightbox._tabCleanup();
    document.body.style.overflow = '';
    // Clear view-transition-names
    $lightbox.querySelectorAll('[style*="view-transition-name"]').forEach(el => {
      el.style.viewTransitionName = '';
    });
    if ($lightbox._prevFocus) {
      $lightbox._prevFocus.focus();
      $lightbox._prevFocus = null;
    }
  };

  if (document.startViewTransition && !REDUCED_MOTION.matches) {
    document.startViewTransition(doClose);
  } else {
    doClose();
  }
}


/* ---- F2: Open Now badge in quick tags (interactive with hours popout) ---- */
/* ---- V6: Dish Match Chip ---- */
function renderDishMatchChip(data) {
  // Remove any previous chip
  document.getElementById('dish-match-chip')?.remove();

  const sv9 = data.scoring_v9;

  // V9: use relevance for dish match detection
  if (sv9?.relevance_type === 'dish' && sv9.relevance_score >= 0.7) {
    const request = data.user_request || data.special_request || '';
    const chipText = request.length > 2 ? `Serves ${request}` : 'Dish Match';

    const chip = document.createElement('span');
    chip.id = 'dish-match-chip';
    chip.className = 'dish-match-chip type-data--sm';
    chip.textContent = chipText;
    chip.setAttribute('aria-label', `This restaurant matches your request: ${chipText}`);

    const $blurb = document.getElementById('donde-blurb');
    if ($blurb) $blurb.insertAdjacentElement('afterend', chip);
    return;
  }

  // Fallback: check factor_details (now populated by V9 backend)
  const menuSignal = sv9?.factor_details?.food?.review_quality?.signal ||
                     sv9?.factor_details?.food?.menu?.signal ||
                     data.scoring?.factor_details?.food?.menu?.signal;
  if (!menuSignal || menuSignal === 'No dish match' || menuSignal === 'No menu data' || menuSignal === 'No tag match') return;
  if (!menuSignal.includes('match') && !menuSignal.includes('Match')) return;

  const request = data.user_request || data.special_request || '';
  const chipText = request.length > 2 ? `Serves ${request}` : menuSignal;

  const chip = document.createElement('span');
  chip.id = 'dish-match-chip';
  chip.className = 'dish-match-chip type-data--sm';
  chip.textContent = chipText;
  chip.setAttribute('aria-label', `This restaurant matches your request: ${chipText}`);

  const $blurb = document.getElementById('donde-blurb');
  if ($blurb) $blurb.insertAdjacentElement('afterend', chip);
}

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

  // Insert before "Show More" button (below content, not above)
  const $showMore = $resultCard.querySelector('.tell-more-btn');
  if ($showMore) {
    $showMore.parentNode.insertBefore(notice, $showMore);
  } else {
    $resultCard.appendChild(notice);
  }

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

/* ---- F3: Enhanced Map Navigation Tile ---- */
function renderMapPreview(data) {
  // Navigation pill now rendered inline in quick-actions row
  const $glanceNav = document.getElementById('glance-nav');
  if ($glanceNav) $glanceNav.style.display = 'none';
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

/* ---- V10: Combined "Your Spots" — merges recent + saved + visited ---- */
function renderYourSpots() {
  const $container = document.getElementById('your-spots');
  const $list = document.getElementById('your-spots-list');
  if (!$container || !$list) return;

  $list.innerHTML = '';
  const items = [];

  // Recent searches (clock icon)
  const { history } = getState();
  if (history?.length > 0) {
    history.slice(0, 3).forEach(entry => {
      const label = entry.label.length > 20 ? entry.label.slice(0, 18) + '…' : entry.label;
      const time = entry.timestamp ? relativeTime(entry.timestamp) : '';
      items.push({
        type: 'recent',
        icon: `<svg viewBox="0 0 256 256" width="12" height="12"><path fill="currentColor" d="M128,24A104,104,0,1,0,232,128,104.11,104.11,0,0,0,128,24Zm0,192a88,88,0,1,1,88-88A88.1,88.1,0,0,1,128,216Zm64-88a8,8,0,0,1-8,8H128a8,8,0,0,1-8-8V72a8,8,0,0,1,16,0v48h48A8,8,0,0,1,192,128Z"/></svg>`,
        label,
        meta: time,
        action: () => {
          if ($cravingInput) {
            $cravingInput.value = entry.payload?.special_request || entry.label;
            setState({ craving: $cravingInput.value });
            updateCtaState();
          }
        }
      });
    });
  }

  // Saved spots (heart icon)
  const bookmarks = loadBookmarks();
  bookmarks.slice(0, 3).forEach(b => {
    items.push({
      type: 'saved',
      icon: `<svg viewBox="0 0 256 256" width="12" height="12"><path fill="currentColor" d="M178,44c-21.44,0-39.92,10.19-50,27.07C117.92,54.19,99.44,44,78,44a58.07,58.07,0,0,0-58,58c0,28.59,18,58.47,53.4,88.79a333.81,333.81,0,0,0,52.7,36.73,4,4,0,0,0,3.8,0,333.81,333.81,0,0,0,52.7-36.73C218,160.47,236,130.59,236,102A58.07,58.07,0,0,0,178,44Z"/></svg>`,
      label: b.name.length > 18 ? b.name.slice(0, 16) + '…' : b.name,
      meta: b.cuisine_type || '',
      action: () => {
        if ($cravingInput) {
          $cravingInput.value = b.name;
          setState({ craving: b.name });
          updateCtaState();
        }
      }
    });
  });

  // Visited spots (check icon)
  const visits = loadVisits();
  visits.slice(0, 3).forEach(v => {
    items.push({
      type: 'visited',
      icon: `<svg viewBox="0 0 256 256" width="12" height="12"><path fill="currentColor" d="M229.66,77.66l-128,128a8,8,0,0,1-11.32,0l-56-56a8,8,0,0,1,11.32-11.32L96,188.69,218.34,66.34a8,8,0,0,1,11.32,11.32Z"/></svg>`,
      label: v.name.length > 18 ? v.name.slice(0, 16) + '…' : v.name,
      meta: v.cuisine_type || v.neighborhood_name || '',
      action: () => {
        if ($cravingInput) {
          $cravingInput.value = v.name;
          setState({ craving: v.name });
          updateCtaState();
        }
      }
    });
  });

  if (items.length === 0) {
    $container.style.display = 'none';
    return;
  }

  // Render combined chips (max 6 total)
  items.slice(0, 6).forEach(item => {
    const btn = document.createElement('button');
    btn.className = `your-spots__chip your-spots__chip--${item.type}`;
    btn.innerHTML = `<span class="your-spots__icon">${item.icon}</span><span>${item.label}</span>${item.meta ? `<span class="your-spots__meta type-data--sm">${item.meta}</span>` : ''}`;
    btn.addEventListener('click', item.action);
    $list.appendChild(btn);
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
  document.querySelectorAll('.feedback-cat-pill').forEach(b => b.setAttribute('aria-checked', 'false'));
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
  const hasCat = !!document.querySelector('.feedback-cat-pill[aria-checked="true"]');
  const hasText = (document.getElementById('feedback-text')?.value?.trim().length || 0) > 0;
  const $submit = document.getElementById('feedback-submit');
  if ($submit) $submit.disabled = !(hasCat && hasText);
}

/* ═══════════════════════════════════════════════════════════════════════
   INFO STREAM — Unified living metadata surface
   Replaces: renderPerfectFor, renderQuickStats, renderDeepContextExtras,
             renderResultMeta (context pills portion)
   ═══════════════════════════════════════════════════════════════════════ */

let _activeInfoStream = null;

/* ---- Collect all info items from API response into a single pool ---- */
function collectInfoStreamItems(data) {
  const items = [];
  const r = data.restaurant || {};
  const dc = data.deep_context || {};
  const dw = data.scoring?.weights_used || data.scoring_v9?.weights_used ||
    { food: 0.25, vibe: 0.20, service: 0.15, reputation: 0.20, convenience: 0.20 };

  // Ensure dimension weights have fallbacks for derived dimensions
  const pw = dw.practical ?? dw.convenience ?? 0.20;
  const ow = dw.occasion ?? dw.service ?? 0.15;
  const cw = dw.craving ?? dw.food ?? 0.25;

  // ── Context items removed from info-stream ──
  // Neighborhood: shown in address nav pill (quick-actions)
  // Cuisine + Open/Closed: promoted to Tier 1 glance-context row

  // ── Practical items ──
  if (dc.review_value_score != null && dc.review_value_score >= 7) {
    items.push({ id: 'value', icon: 'heart', text: 'Great value', priority: dw.food * 0.5, category: 'practical' });
  }

  if (dc.check_average_per_person) {
    const notable = dc.check_average_per_person >= 60 ? 1.2 : 1.0;
    items.push({ id: 'price', icon: 'tag', text: `~$${dc.check_average_per_person}/pp`, priority: pw * 0.90 * notable, category: 'practical' });
  }

  if (dc.reservation_difficulty && dc.reservation_difficulty !== 'none') {
    const resMap = { easy: 'Walk-ins OK', moderate: 'Reserve ahead', hard: 'Hard to book' };
    const notable = dc.reservation_difficulty === 'hard' ? 1.5 : 1.0;
    items.push({ id: 'reserv', icon: 'calendar', text: resMap[dc.reservation_difficulty] || humanizeSnake(dc.reservation_difficulty), priority: pw * 0.85 * notable, category: 'practical' });
  }

  if (dc.typical_wait_minutes) {
    const notable = dc.typical_wait_minutes >= 20 ? 1.3 : 1.0;
    items.push({ id: 'wait', icon: 'clock', text: `~${dc.typical_wait_minutes} min wait`, priority: pw * 0.70 * notable, category: 'practical' });
  }

  if (dc.group_size_sweet_spot) {
    const range = dc.group_size_sweet_spot.replace(/[\[\]()]/g, '').replace(',', '-');
    items.push({ id: 'group', icon: 'usersThree', text: `Best for ${range}`, priority: pw * 0.50, category: 'practical' });
  }

  if (dc.transit_accessibility) {
    items.push({ id: 'transit', icon: 'train', text: dc.transit_accessibility, priority: pw * 0.35, category: 'practical' });
  }

  // ── Vibe items ──
  if (dc.energy_level != null) {
    const e = dc.energy_level;
    const notable = (e >= 8 || e <= 2) ? 1.3 : 1.0;
    items.push({ id: 'energy', icon: 'bolt', text: e >= 8 ? 'High energy' : e >= 5 ? 'Moderate' : 'Chill', priority: dw.vibe * 0.65 * notable, category: 'vibe' });
  }

  if (dc.cultural_authenticity != null) {
    const a = dc.cultural_authenticity;
    const notable = a >= 8 ? 1.2 : 1.0;
    items.push({ id: 'auth', icon: 'globe', text: a >= 8 ? 'Very Authentic' : a >= 5 ? 'Authentic' : 'Fusion', priority: dw.vibe * 0.55 * notable, category: 'vibe' });
  }

  if (dc.conversation_friendliness != null) {
    const c = dc.conversation_friendliness;
    const notable = c <= 3 ? 1.4 : 1.0;
    items.push({ id: 'noise', icon: 'chat', text: c >= 7 ? 'Great for convo' : c >= 4 ? 'Moderate' : 'Loud', priority: ow * 0.70 * notable, category: 'vibe' });
  }

  if (dc.spice_level && dc.spice_level !== 'none') {
    items.push({ id: 'spice', icon: 'fire', text: formatSpiceLevel(dc.spice_level), priority: cw * 0.55, category: 'vibe' });
  }

  // ── Discovery items ──
  const WOW_LABELS = {
    open_kitchen: 'Open kitchen', rooftop_skyline_view: 'Rooftop views',
    tableside_preparation: 'Tableside prep', secret_entrance: 'Secret entrance',
    live_cooking_show: 'Live cooking', river_view: 'River view',
    lake_view: 'Lake view', historic_building: 'Historic building',
    celebrity_chef: 'Celebrity chef', speakeasy_vibe: 'Speakeasy',
    garden_dining: 'Garden dining', fireplace: 'Fireplace',
    chef_interaction: 'Chef interaction',
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

  const wows = (dc.wow_factors || []).filter(w => w !== 'unique_decor').slice(0, 3);
  wows.forEach((w, i) => {
    const label = WOW_LABELS[w] || humanizeSnake(w);
    const icon = WOW_ICONS[w] || 'diamond';
    items.push({ id: `wow-${i}`, icon, text: label, priority: 0.3, category: 'discovery' });
  });

  const awards = data._awardBadges || [];
  awards.forEach((a, i) => {
    items.push({ id: `award-${i}`, icon: 'starFull', text: a, priority: 0.5, category: 'discovery' });
  });

  const scenarios = dc.best_for_scenarios || [];
  scenarios.slice(0, 3).forEach((s, i) => {
    items.push({ id: `scenario-${i}`, icon: 'heart', text: s, priority: 0.4, category: 'discovery' });
  });

  // Normalize all item text to 2-3 words max
  items.forEach(item => { item.text = normalizeTagText(item.text); });

  // Sort by priority descending (no more context category in info-stream)
  items.sort((a, b) => b.priority - a.priority);

  return items;
}


/* ---- InfoStream: two-tier metadata surface ---- */
/* Row 1 (primary): interactive context pills */
/* Row 2 (secondary): dot-separated small text with rotation on mobile */
class InfoStream {
  constructor($container, primaryItems, secondaryItems) {
    this.$container = $container;
    this.primaryItems = primaryItems;
    this.secondaryItems = secondaryItems;
    this.$secondary = null;
    this.visibleMeta = [];    // Currently visible secondary items
    this.metaQueue = [];      // Secondary items waiting to rotate in
    this.rotateIdx = 0;
    this.timer = null;
    this.paused = false;
    this._onPointerEnter = () => this.pause();
    this._onPointerLeave = () => this.resume();
  }

  start() {
    this.$container.innerHTML = '';

    // ── Single row: dot-separated metadata with 2-line cap + auto-rotation ──
    if (this.secondaryItems.length > 0) {
      this.$secondary = document.createElement('div');
      this.$secondary.className = 'info-stream__secondary info-stream__secondary--capped';

      if (REDUCED_MOTION.matches) {
        // Show all items statically
        this._renderSecondaryItems(this.secondaryItems);
      } else {
        // Show ~6 items visible, rest rotate in (both mobile + desktop)
        const maxVisible = Math.min(6, this.secondaryItems.length);

        this.visibleMeta = this.secondaryItems.slice(0, maxVisible);
        this.metaQueue = this.secondaryItems.slice(maxVisible);
        this._renderSecondaryItems(this.visibleMeta);

        // Auto-rotation timer (always, if overflow items exist)
        if (this.metaQueue.length > 0) {
          this.$secondary.addEventListener('pointerenter', this._onPointerEnter);
          this.$secondary.addEventListener('pointerleave', this._onPointerLeave);
          this.timer = setInterval(() => {
            if (!this.paused) this._rotateOneMeta();
          }, 4000);
        }
      }

      this.$container.appendChild(this.$secondary);
    }

    this.$container.style.display = this.secondaryItems.length > 0 ? '' : 'none';
  }

  _renderSecondaryItems(items) {
    this.$secondary.innerHTML = '';
    items.forEach((item, i) => {
      if (i > 0) {
        const dot = document.createElement('span');
        dot.className = 'info-stream__dot';
        dot.textContent = '\u00B7';
        this.$secondary.appendChild(dot);
      }
      const span = document.createElement('span');
      span.className = 'info-stream__meta';
      span.dataset.metaId = item.id;
      span.textContent = item.text;
      this.$secondary.appendChild(span);
    });
  }

  _rotateOneMeta() {
    if (this.metaQueue.length === 0) {
      // Rebuild queue from all secondaryItems not currently visible
      const visIds = new Set(this.visibleMeta.map(it => it.id));
      this.metaQueue = this.secondaryItems.filter(it => !visIds.has(it.id));
      if (this.metaQueue.length === 0) return;
    }

    const slotIdx = this.rotateIdx % this.visibleMeta.length;
    this.rotateIdx++;

    const nextItem = this.metaQueue.shift();
    const oldItem = this.visibleMeta[slotIdx];

    // Find the span in the DOM (spans interleaved with dot separators)
    const $metaSpans = this.$secondary.querySelectorAll('.info-stream__meta');
    const $el = $metaSpans[slotIdx];
    if (!$el) return;

    // Fade out
    $el.classList.add('info-stream__meta--exiting');

    setTimeout(() => {
      this.metaQueue.push(oldItem);
      this.visibleMeta[slotIdx] = nextItem;
      $el.textContent = nextItem.text;
      $el.dataset.metaId = nextItem.id;
      $el.classList.remove('info-stream__meta--exiting');
    }, 300);
  }

  pause() { this.paused = true; }
  resume() { this.paused = false; }

  stop() {
    if (this.timer) { clearInterval(this.timer); this.timer = null; }
  }

  destroy() {
    this.stop();
    if (this.$secondary) {
      this.$secondary.removeEventListener('pointerenter', this._onPointerEnter);
      this.$secondary.removeEventListener('pointerleave', this._onPointerLeave);
    }
    this.$container.innerHTML = '';
  }
}


/* ---- Render Info Stream: single-tier metadata surface (dot-separated, auto-rotating) ---- */
function renderInfoStream(data) {
  const $container = document.getElementById('info-stream');
  if (!$container) return;

  if (_activeInfoStream) { _activeInfoStream.destroy(); _activeInfoStream = null; }

  const items = collectInfoStreamItems(data);

  if (items.length === 0) {
    $container.style.display = 'none';
    return;
  }

  // No primary row — all items are secondary (dot-separated, auto-rotating)
  const stream = new InfoStream($container, [], items);
  stream.start();
  _activeInfoStream = stream;
}


/* ---- Render Deep Context Extras (Info Stream + Cuisine Drawer) ---- */
function renderDeepContextExtras(data) {
  const dc = data.deep_context;
  if (!dc) return;

  // Info Stream — unified living metadata surface
  renderInfoStream(data);

  // Cuisine details — inline in Tier 2 (was overlay drawer)
  renderCuisineDetails(data);

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

/* ---- Cuisine Pills: expandable pill groups in Tier 2 ---- */
function renderCuisineDetails(data) {
  const dp = data.deep_context || {};
  const $container = document.getElementById('cuisine-pills');
  if (!$container) return;

  const groups = [];

  // What to Order
  if (dp.signature_dishes?.length) {
    const bodyHTML = dp.signature_dishes.slice(0, 4).map(d =>
      `<div class="cuisine-pill-group__dish">
        <span class="cuisine-pill-group__dish-name">${d.dish}</span>
        <span class="cuisine-pill-group__dish-why">${d.why || ''}</span>
      </div>`
    ).join('');
    groups.push({ label: 'What to Order', body: bodyHTML });
  }

  // Popular Items
  if (dp.menu_highlights?.length) {
    const bodyHTML = `<div class="cuisine-pill-group__items">${
      dp.menu_highlights.map(item =>
        `<span class="cuisine-pill-group__item">${item}</span>`
      ).join('')
    }</div>`;
    groups.push({ label: 'Popular Items', body: bodyHTML });
  }

  // Flavor Profile
  if (dp.flavor_profiles?.length) {
    const bodyHTML = `<div class="cuisine-pill-group__items">${
      dp.flavor_profiles.map(f =>
        `<span class="cuisine-pill-group__item">${f}</span>`
      ).join('')
    }</div>`;
    groups.push({ label: 'Flavor Profile', body: bodyHTML });
  }

  if (groups.length === 0) {
    $container.style.display = 'none';
    return;
  }

  $container.innerHTML = groups.map((g, i) =>
    `<div class="cuisine-pill-group">
      <button class="cuisine-pill-group__toggle type-data--sm" aria-expanded="false" data-action="toggle-cuisine-pill" data-index="${i}">
        ${g.label} <span class="cuisine-pill-group__chevron"></span>
      </button>
      <div class="cuisine-pill-group__body" data-pill-body="${i}">${g.body}</div>
    </div>`
  ).join('');
  $container.style.display = '';
}

/* ---- Culture-Aware Toast Strings ---- */
function toasts() {
  return getLabels(getState().theme.culture).toasts;
}

/* ---- Try Another Countdown (5 total picks: initial + 4 tries) ---- */
function updateTryAgainState() {
  const $btn = document.querySelector('[data-action="try-again"]');
  if (!$btn) return;
  const TOTAL_PICKS = 5; // initial result + 4 try-agains
  const triesUsed = getState().excludeIds.length; // each try-again adds one exclude
  const triesLeft = Math.max(0, TOTAL_PICKS - 1 - triesUsed); // -1 for the initial result
  const $text = $btn.querySelector('.try-again-btn__text');
  if (!$text) return;
  const labels = getLabels(getState().theme.culture);

  if (triesLeft <= 0) {
    // Exhausted — gray out, animate down, then reveal prominent Start Over
    $btn.classList.add('try-again-btn--exhausted');
    $btn.setAttribute('aria-disabled', 'true');
    $text.textContent = labels.again;
    // Animate try-again button out and show prominent Start Over
    setTimeout(() => {
      $btn.style.transition = 'opacity 400ms var(--ease-out), transform 400ms var(--ease-out)';
      $btn.style.opacity = '0';
      $btn.style.transform = 'translateY(8px) scale(0.95)';
      setTimeout(() => {
        $btn.style.display = 'none';
        // Make Start Over prominent
        const $startOver = document.getElementById('start-over-btn');
        if ($startOver) {
          $startOver.classList.add('start-over-link--prominent');
          $startOver.style.transition = 'none';
          $startOver.style.opacity = '0';
          $startOver.style.transform = 'translateY(-8px)';
          requestAnimationFrame(() => {
            $startOver.style.transition = 'opacity 400ms var(--ease-out), transform 400ms var(--ease-out)';
            $startOver.style.opacity = '1';
            $startOver.style.transform = 'translateY(0)';
          });
        }
      }, 400);
    }, 100);
  } else {
    // Active state — show count after first use, or clean initial state
    if (triesUsed > 0) {
      $text.textContent = `${labels.again} (${triesLeft})`;
    } else {
      $text.textContent = labels.again;
    }
    $btn.classList.remove('try-again-btn--exhausted');
    $btn.removeAttribute('aria-disabled');
    $btn.style.display = '';
    $btn.style.opacity = '';
    $btn.style.transform = '';
    $btn.style.transition = '';
    // Reset Start Over to default tertiary style
    const $startOver = document.getElementById('start-over-btn');
    if ($startOver) {
      $startOver.classList.remove('start-over-link--prominent');
      $startOver.style.opacity = '';
      $startOver.style.transform = '';
      $startOver.style.transition = '';
    }
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

  // Set progress bar duration via CSS custom property
  const duration = action ? 10000 : isError ? 6000 : 3500;
  $toast.style.setProperty('--toast-dur', `${duration}ms`);
  $toast.classList.add('toast--visible');

  // Auto-dismiss: errors stay longer, actions linger even longer
  toastTimer = setTimeout(() => dismissToast(), duration);
}

function dismissToast() {
  if (!$toast) return;
  // Smooth exit: add exiting class, then remove visible after animation
  $toast.classList.add('toast--exiting');
  setTimeout(() => {
    $toast.classList.remove('toast--visible', 'toast--exiting');
  }, 250);
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

    // Spring snap-back with real physics
    if ($resultStep) {
      $resultStep.classList.remove('step--swiping');
      springAnimate($resultStep, { transform: 'translateX(0)' }, {
        spring: SPRINGS.snappy,
        duration: 300,
        easing: 'var(--spring)',
      });
    }

    // Must be a horizontal gesture on the result view
    if (isHorizontal === false) return;
    if (Math.abs(dx) < 30 || Math.abs(dy) > Math.abs(dx)) return;

    const { step } = getState();

    // Swipe-right on result → back to canvas
    if (dx > 0 && step === 1 && (dx > COMPLETE_THRESHOLD || velocity > VELOCITY_THRESHOLD)) {
      haptic(HAPTICS.swipe);
      unfoldResultToCanvas();
      syncFilterPillsToState();
      revertAutoTheme();
    }

    // Swipe-left on result → try another (next in ranked queue)
    if (dx < 0 && step === 1 && (Math.abs(dx) > COMPLETE_THRESHOLD || velocity > VELOCITY_THRESHOLD)) {
      haptic(HAPTICS.tick);
      // Trigger the same action as "Try Another" button
      const $tryAnother = document.querySelector('[data-action="try-again"]');
      if ($tryAnother && !$tryAnother.disabled) {
        $tryAnother.click();
      }
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
  const $userName = document.getElementById('header-user-name');
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
    // Show first name in header
    if ($userName) {
      const firstName = (user.name || '').split(' ')[0];
      $userName.textContent = firstName;
      $userName.classList.add('header__user-name--visible');
    }
  } else {
    $btn.classList.remove('is-authenticated');
    $btn.setAttribute('aria-label', 'Sign in');
    $btn.setAttribute('title', 'Sign in');
    if ($avatarImg) {
      $avatarImg.src = '';
      $avatarImg.style.display = 'none';
    }
    // Hide header name
    if ($userName) {
      $userName.textContent = '';
      $userName.classList.remove('header__user-name--visible');
    }
  }

  // Admin: show Gauntlet Dashboard link only for admin user
  const $gauntletLink = document.getElementById('admin-gauntlet-link');
  if ($gauntletLink) {
    $gauntletLink.style.display = (user && user.email === 'aacrit@gmail.com') ? '' : 'none';
  }
}

// SSO: Subscribe to auth state changes
subscribe((state, prev) => {
  if (state.isAuthenticated !== prev.isAuthenticated || state.user !== prev.user) {
    updateAuthUI();
    closeAuthSheet();
    if (state.isAuthenticated && !prev.isAuthenticated && state.user) {
      renderYourSpots();
      if (!hasSeenOnboarding()) setTimeout(() => showCoachMarks(), 600);
    }
  }
});

/* ---- Boot ---- */
init();
