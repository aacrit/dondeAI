/* ============================================
   DondeAI — Main Orchestrator
   Single-canvas layout: Canvas + Result.
   ============================================ */

import { getState, setState, subscribe, resetState } from './state.js';
import { initRouter, goToStep, goToStepInstant } from './router.js';
import { loadTheme, loadSound, loadHistory, addToHistory, saveTheme, loadColorMode, loadBookmarks, addBookmark, removeBookmark, isBookmarked, getOrCreateUserId, saveFeedback, loadFeedback } from './persistence.js';
import { initTheme, setTheme, setThemeInstant, setThemeVisualOnly, revertAutoTheme, setManualOverride, isManualOverride, setColorMode, getColorMode, getLabels, CULTURES, CULTURE_DISPLAY_NAMES } from './theme.js';
import { initAudio, toggleSound, playChime } from './audio.js';
import { initVoice, startVoice } from './voice.js';
import { initShare, shareResult, closeShareSheet, handleShareChannel } from './share.js';
import { initOffline, isOnline } from './offline.js';
import { initAccessibility, announce } from './accessibility.js';
import { fetchRecommendation } from './api.js';
import { animateScoreRing, renderPetalRadar, renderSentimentBar, renderScoreBloom, renderScoreHero, renderVibeBars, toggleBloom, resetBloomState, handlePetalTap, handleBloomRingTap, toggleScoreBreakdown, getBloomState, animateBadge, startParticles, stopParticles, chaosToOrderReveal, initLogoAnimation, startSearchPulse, stopSearchPulse, resolveLogoToFound, cleanupLoadingLogo } from './animations.js';
import {
  getGreeting, getTimePeriod, getCuisineFromResult, svgIcon,
  getScoreTier, getScoreColor, getScoreThresholdColor, buildGoogleStars, buildMapsUrl, relativeTime, matchCuisine, matchCulture
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

  // Set up greeting
  setupLanding();

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

function typewriterReveal(element, text) {
  if (REDUCED_MOTION.matches) {
    element.textContent = text;
    return;
  }
  element.textContent = '';
  element.classList.add('step__title--typing');
  let i = 0;
  const speed = 35;
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

/* ---- Chip Ambient Rotation (swap one chip every 5s) ---- */
function startChipRotation() {
  stopChipRotation();
  chipRotationTimer = setInterval(() => {
    if ($cravingInput && $cravingInput.value.trim().length > 0) return;
    if (document.activeElement === $cravingInput) return;
    rotateOneChip();
  }, 5000);
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
        break;
      }

      // F14: Surprise Me
      case 'surprise-me': {
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
        const prompt = surprisePrompts[Math.floor(Math.random() * surprisePrompts.length)];
        if ($cravingInput) {
          $cravingInput.value = prompt;
          // Auto-grow for textarea
          $cravingInput.style.height = 'auto';
          $cravingInput.style.height = $cravingInput.scrollHeight + 'px';
        }
        setState({ craving: prompt, excludeIds: [] });
        updateCtaState();
        // Auto-submit after 800ms delay (per BR-H1)
        setTimeout(() => handleSubmit(), 800);
        break;
      }

      // F11: Feedback (like/dislike)
      case 'feedback': {
        const fb = btn.dataset.feedback;
        const resultData = getState().result;
        const restaurantId = resultData?.restaurant?.id;
        if (!restaurantId || !fb) break;
        saveFeedback(restaurantId, fb);
        setState({ pendingFeedback: { restaurant_id: restaurantId, feedback: fb } });
        // Visual toggle
        document.querySelectorAll('.feedback-btn').forEach(b => b.classList.remove('feedback-btn--active'));
        btn.classList.add('feedback-btn--active');
        showToast(fb === 'like' ? 'Noted — glad you like it!' : 'Got it — we\'ll adjust.', false);
        break;
      }

      // F4: Bookmark toggle
      case 'bookmark': {
        const result = getState().result;
        const restaurant = result?.restaurant;
        if (!restaurant?.id) break;
        const wasBookmarked = isBookmarked(restaurant.id);
        if (wasBookmarked) {
          removeBookmark(restaurant.id);
        } else {
          addBookmark(restaurant);
        }
        updateBookmarkBtn(restaurant.id);
        renderSavedSpots();
        showToast(wasBookmarked ? 'Removed from saved' : 'Saved!', false);
        break;
      }

      // F2: Toggle business hours detail
      case 'toggle-hours': {
        const detail = document.getElementById('hours-detail');
        const isExp = btn.getAttribute('aria-expanded') === 'true';
        btn.setAttribute('aria-expanded', String(!isExp));
        if (detail) detail.hidden = isExp;
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



      case 'clear-filters': {
        setState({ occasion: 'Any', neighborhood: 'Anywhere', priceLevel: 'Any' });
        clearAllSelections();
        updateFilterSummary();
        showToast('Filters cleared');
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


      case 'show-match-info': {
        showToast('Donde Match\u2122 shows how likely you are to love this spot \u2014 based on cuisine quality, vibe fit, and hundreds of local reviews.');
        break;
      }

      case 'show-vibe-info': {
        showToast('Donde Vibe\u2122 maps how this spot scores across date nights, groups, family, business, solo dining, and hidden gem factor.');
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
          const $hero = document.getElementById('score-hero');
          if ($hero) $hero.focus({ preventScroll: true });
          announce('Showing more details');
        } else {
          // Collapsing — also collapse tier 3 if open
          const $tier3 = document.getElementById('tier-deep');
          const $detailsBtn = document.getElementById('details-trigger-btn');
          if ($tier3?.classList.contains('tier--expanded')) {
            $tier3.classList.remove('tier--expanded');
            $tier3.setAttribute('aria-hidden', 'true');
          }
          if ($detailsBtn) {
            $detailsBtn.setAttribute('aria-expanded', 'false');
            const t = $detailsBtn.querySelector('.details-trigger-btn__text');
            if (t) t.textContent = 'All Details';
          }
          resetBloomState();
        }
        break;
      }

      case 'show-vibe-profile': {
        // Toggle vibe bars (2-state: compact ↔ expanded)
        const data = _pendingResultData;
        if (!data) break;
        const newState = toggleBloom(
          data.scores || {},
          null,
          animationTimers
        );
        // Update callout arrow direction
        const $calloutArrow = document.getElementById('score-hero-callout')
          ?.querySelector('.score-hero__callout-arrow');
        if ($calloutArrow) {
          $calloutArrow.textContent = newState === 'compact' ? '\u2193' : '\u2191';
        }
        announce(newState === 'expanded' ? 'Showing vibe profile' : 'Collapsed vibe profile');
        break;
      }

      case 'expand-tier-3': {
        const $tier3 = document.getElementById('tier-deep');
        const isExp = btn.getAttribute('aria-expanded') === 'true';
        btn.setAttribute('aria-expanded', String(!isExp));
        if ($tier3) {
          $tier3.classList.toggle('tier--expanded');
          $tier3.setAttribute('aria-hidden', String(isExp));
        }
        const $txt = btn.querySelector('.details-trigger-btn__text');
        if ($txt) $txt.textContent = isExp ? 'All Details' : 'Collapse';
        // Trigger tier 3 animations on first expand
        if (!isExp) {
          renderTier3Animations();
          announce('Showing all restaurant details');
        }
        break;
      }
    }
  });

  // Score Hero tap in Tier 2 — toggle vibe bars (2-state: compact ↔ expanded)
  document.addEventListener('click', (e) => {
    if (e.target.closest('[data-action]')) return;
    const hero = e.target.closest('.score-hero');
    if (!hero) return;
    const data = _pendingResultData;
    if (!data) return;
    const newState = toggleBloom(
      data.scores || {},
      null,
      animationTimers
    );
    // Update callout arrow
    const $calloutArrow = document.getElementById('score-hero-callout')
      ?.querySelector('.score-hero__callout-arrow');
    if ($calloutArrow) {
      $calloutArrow.textContent = newState === 'compact' ? '\u2193' : '\u2191';
    }
    announce(newState === 'expanded' ? 'Showing vibe profile' : 'Collapsed vibe profile');
  });

  // Match-mini click → expand Tier 2 (same as "Show More")
  document.getElementById('match-pill')?.addEventListener('click', () => {
    document.getElementById('tell-more-btn')?.click();
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
      // Disable: kill breathing
      $cta.classList.remove('cta-btn--ready', 'cta-btn--alive');
      if (ctaBreathTimer) { clearTimeout(ctaBreathTimer); ctaBreathTimer = null; }
    } else if (wasDisabled && !isEmpty) {
      // Just enabled: one-shot ready pulse → continuous breathe
      $cta.classList.remove('cta-btn--alive');
      $cta.classList.add('cta-btn--ready');
      if (ctaBreathTimer) clearTimeout(ctaBreathTimer);
      ctaBreathTimer = setTimeout(() => {
        $cta.classList.remove('cta-btn--ready');
        $cta.classList.add('cta-btn--alive');
      }, 400);
    }
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
  boostCta();

  // Auto-collapse only when all filter categories have been selected
  clearTimeout(autoAdvanceTimer);
  const st = getState();
  if (st.occasion !== 'Any' && st.neighborhood !== 'Anywhere' && st.priceLevel !== 'Any') {
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
  const $summary = document.getElementById('filter-summary');
  if ($summary) {
    $summary.textContent = parts.length ? parts.join(' \u00B7 ') : '';
  }
  // Filter count badge on toggle button
  const $toggle = document.querySelector('[data-action="toggle-filters"]');
  if ($toggle) {
    $toggle.setAttribute('data-filter-count', parts.length || '');
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
    showToast("You're offline \u2014 can't reach the engine.", true, {
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
    $cta.classList.remove('cta-btn--ready', 'cta-btn--alive');
    $cta.classList.add('cta-btn--confirming');
    await new Promise(r => setTimeout(r, 200));
    $cta.classList.remove('cta-btn--confirming');
    $cta.classList.add('cta-btn--loading');
    $cta.textContent = 'Searching';
  }

  setState({ loading: true, error: null, result: null });
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
    showToast(err.message || "Something went wrong.", true, {
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
  if (navigator.vibrate) {
    navigator.vibrate([50, 30, 50]);
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
  _tier3Animated = false;

  // Reset bloom state (petal radar overlay)
  resetBloomState();

  // Reset tier expansion state — always start at Tier 1 (Glance)
  const $tier2 = document.getElementById('tier-leanin');
  const $tier3 = document.getElementById('tier-deep');
  const $tellMore = document.getElementById('tell-more-btn');
  const $detailsTrigger = document.getElementById('details-trigger-btn');
  if ($tier2) { $tier2.classList.remove('tier--expanded'); $tier2.setAttribute('aria-hidden', 'true'); }
  if ($tier3) { $tier3.classList.remove('tier--expanded'); $tier3.setAttribute('aria-hidden', 'true'); }
  if ($tellMore) { $tellMore.setAttribute('aria-expanded', 'false'); const t = $tellMore.querySelector('.tell-more-btn__text'); if (t) t.textContent = 'Show More'; }
  if ($detailsTrigger) { $detailsTrigger.setAttribute('aria-expanded', 'false'); const t = $detailsTrigger.querySelector('.details-trigger-btn__text'); if (t) t.textContent = 'All Details'; }

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
  const tier = getScoreTier(dondeScore, { mismatch: !!data.cuisine_mismatch?.requested });
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
  const $oneliner = document.getElementById('result-oneliner');
  if ($oneliner) $oneliner.textContent = r.best_for_oneliner || '';

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

      const sentimentData = computeSentiment(r);
      if (sentimentData) {
        const sentWrap = document.createElement('div');
        sentWrap.className = 'badge-popout__sentiment';
        // "Sentiment" label
        const sentLabel = document.createElement('span');
        sentLabel.className = 'badge-popout__sentiment-label';
        sentLabel.textContent = 'Sentiment';
        sentWrap.appendChild(sentLabel);
        // RGB track bar
        const track = document.createElement('div');
        track.className = 'sentiment-inline__track';
        track.innerHTML =
          `<span class="sentiment-inline__seg sentiment-inline__seg--pos" style="flex:${sentimentData.pos}"></span>` +
          `<span class="sentiment-inline__seg sentiment-inline__seg--neu" style="flex:${sentimentData.neu}"></span>` +
          `<span class="sentiment-inline__seg sentiment-inline__seg--neg" style="flex:${sentimentData.neg}"></span>`;
        sentWrap.appendChild(track);
        // Colored-dot legend
        const legend = document.createElement('div');
        legend.className = 'badge-popout__sentiment-legend';
        legend.innerHTML =
          `<span class="badge-popout__sentiment-item"><span class="badge-popout__sentiment-dot badge-popout__sentiment-dot--pos"></span>${sentimentData.pos}% positive</span>` +
          `<span class="badge-popout__sentiment-item"><span class="badge-popout__sentiment-dot badge-popout__sentiment-dot--neu"></span>${sentimentData.neu}% neutral</span>` +
          `<span class="badge-popout__sentiment-item"><span class="badge-popout__sentiment-dot badge-popout__sentiment-dot--neg"></span>${sentimentData.neg}% negative</span>`;
        sentWrap.appendChild(legend);
        popout.appendChild(sentWrap);
      }

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

  // DondeAI Recommendation blurb — the editorial voice in Tier 1
  const $rec = document.getElementById('result-recommendation');
  const $blurb = document.getElementById('donde-blurb');
  if ($rec) {
    const recText = data.recommendation || '';
    $rec.textContent = recText;
    if ($blurb) $blurb.style.display = recText ? '' : 'none';
  }

  // F3: Enhanced map navigation tile
  renderMapPreview(data);

  // Inject icons into glance action buttons
  const $tryAgainIcon = document.getElementById('try-again-icon');
  if ($tryAgainIcon) $tryAgainIcon.innerHTML = svgIcon('refresh', 18);
  const $glanceStartOverIcon = document.getElementById('glance-start-over-icon');
  if ($glanceStartOverIcon) $glanceStartOverIcon.innerHTML = svgIcon('home', 18);

  // ═══════════════════════════════════════════════════════
  // TIER 2: LEAN-IN — Prepare content (hidden until expanded)
  // ═══════════════════════════════════════════════════════

  // Store data reference for lazy tier 2/3 rendering
  _pendingResultData = data;
  _pendingCuisine = cuisine;

  // Pre-populate Tier 2 content (DOM ready, just hidden)
  prepareTier2(data, cuisine);

  // ═══════════════════════════════════════════════════════
  // TIER 3: DEEP DIVE — Prepare content (hidden until expanded)
  // ═══════════════════════════════════════════════════════
  prepareTier3(data, cuisine);

  // Apply progressive reveal (Tier 1 only — Tier 2/3 animate on expand)
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

  // Score Hero arc — populate but don't animate yet
  renderScoreHero(
    data.donde_match,
    data.scores || {},
    data.scoring_v2 || null,
    null, // No sentiment in arc anymore
    [] // No timers — animations triggered on expand
  );

  // Recommendation is now rendered in Tier 1 (Glance) via donde-blurb

  // Story Extras: Dishes + Insider Tip
  const $storyExtras = document.getElementById('story-extras');
  const $extrasDishes = document.getElementById('story-extras-dishes');
  const $dishesText = document.getElementById('signature-dishes-text');
  if ($storyExtras && $extrasDishes && $dishesText) {
    const dishes = data.deep_context?.signature_dishes;
    if (dishes?.length > 0) {
      $dishesText.textContent = dishes.slice(0, 3).map(d => d.dish).join(', ');
      $extrasDishes.style.display = '';
    } else {
      $extrasDishes.style.display = 'none';
    }
  }

  const $extrasTip = document.getElementById('story-extras-tip');
  const $tipText = document.getElementById('insider-tip-text');
  if ($extrasTip && $tipText) {
    let tipContent = data.insider_tip || '';
    // Strip em-dashes — replace with commas for cleaner reading
    tipContent = tipContent.replace(/\u2014/g, ', ').replace(/ , /g, ', ');
    if (tipContent) { $tipText.textContent = tipContent; $extrasTip.style.display = ''; }
    else { $extrasTip.style.display = 'none'; }
  }

  if ($storyExtras) {
    const hasDishes = $extrasDishes && $extrasDishes.style.display !== 'none';
    const hasTip = $extrasTip && $extrasTip.style.display !== 'none';
    $storyExtras.style.display = (hasDishes || hasTip) ? '' : 'none';
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

  // I6: Sentiment summary (AI-generated review summary)
  const $sentSummary = document.getElementById('sentiment-summary');
  if ($sentSummary) {
    if (r.sentiment_summary) {
      $sentSummary.textContent = r.sentiment_summary;
      $sentSummary.style.display = '';
    } else {
      $sentSummary.style.display = 'none';
    }
  }

  // I5: Review snippets (social proof quotes from Google reviews)
  const $reviewSnippets = document.getElementById('review-snippets');
  if ($reviewSnippets) {
    const snippets = r.review_snippets || [];
    if (snippets.length > 0) {
      $reviewSnippets.innerHTML = snippets.map(s =>
        `<blockquote class="review-snippet">
          <span class="review-snippet__stars">${'★'.repeat(s.rating)}${'☆'.repeat(5 - s.rating)}</span>
          <p class="review-snippet__text type-structural">\u201c${s.text}\u201d</p>
        </blockquote>`
      ).join('');
      $reviewSnippets.style.display = '';
    } else {
      $reviewSnippets.style.display = 'none';
    }
  }

  // Navigation tile — now in Tier 1 only (glance-nav); hide Tier 2 duplicate
  const $navTileContainer = document.getElementById('result-nav-tile');
  if ($navTileContainer) $navTileContainer.style.display = 'none';

  // Quick Links (Website, Call, Share)
  const $resultLinks = document.getElementById('result-links');
  if ($resultLinks) {
    $resultLinks.innerHTML = '';
    const links = [];
    if (r.website) {
      let hostname = 'Visit';
      try { hostname = new URL(r.website).hostname.replace('www.', ''); } catch { /* keep fallback */ }
      links.push(createResultLink('a', 'globe', hostname, r.website));
    }
    if (r.phone) {
      links.push(createResultLink('a', 'phone', 'Call', `tel:${r.phone}`));
    }
    const shareLink = createResultLink('button', 'shareNetwork', 'Share');
    shareLink.setAttribute('data-action', 'share');
    shareLink.classList.add('result-link--accent');
    links.push(shareLink);
    links.forEach((link, i) => {
      if (i > 0) {
        const sep = document.createElement('span');
        sep.className = 'result-links__sep';
        sep.textContent = '\u00b7';
        sep.setAttribute('aria-hidden', 'true');
        $resultLinks.appendChild(sep);
      }
      $resultLinks.appendChild(link);
    });
  }

  // F7: Reservation/booking link
  renderReservationLink(data);

  // F2: Business hours detail
  renderBusinessHours(data);

  // 1D: Deep context extras (USP, wow factors, origin story)
  renderDeepContextExtras(data);

  // Profile chips (compact icon+label strip)
  renderProfileChips(data, cuisine);
}

/* ---- Prepare Tier 3 DOM content ---- */
function prepareTier3(data, cuisine) {
  const r = data.restaurant;

  // Vibe profile now lives in the bloom overlay on score hero — no separate bars needed
  // V2 Breakdown is triggered by tap on score hero in Tier 2 — no pre-render needed

  // Detail badges grid (full facts + atmosphere)
  const $profileFacts = document.getElementById('profile-facts');
  const parkingPts = r.parking_availability
    ? parseParkingTypes(r.parking_availability).slice(0, 2).join(' / ') : null;
  const CANONICAL_BADGES = [
    { icon: cuisine.icon || 'plate', label: 'Cuisine',
      value: (data.deep_context?.cuisine_subcategory || r.cuisine_type)
        ? shortenBadgeValue(data.deep_context?.cuisine_subcategory || r.cuisine_type) : null,
      raw: r.cuisine_type || '', isCuisine: true, isAtmo: false },
    { icon: 'tag', label: 'Price', value: r.price_level || null, raw: r.price_level || '', isAtmo: false },
    { icon: 'car', label: 'Parking', value: parkingPts, raw: r.parking_availability || '', isAtmo: false },
    { icon: getNoiseIcon(r.noise_level), label: 'Noise',
      value: r.noise_level ? shortenBadgeValue(r.noise_level) : null, raw: r.noise_level || '', isAtmo: false },
    { icon: getAmbianceIcon(r.lighting_ambiance), label: 'Ambiance',
      value: r.lighting_ambiance ? normalizeAmbiance(r.lighting_ambiance) : null,
      raw: data.deep_context?.decor_style || r.lighting_ambiance || '', isAtmo: false },
    { icon: 'shirt', label: 'Dress', value: r.dress_code ? shortenBadgeValue(r.dress_code) : null,
      raw: r.dress_code || '', isAtmo: false },
    { icon: 'patio', label: 'Patio',
      value: r.outdoor_seating === true ? 'Yes' : (r.outdoor_seating === false ? 'No' : null),
      raw: r.outdoor_seating != null ? (r.outdoor_seating ? 'Outdoor seating' : 'No patio') : '', isAtmo: true },
    { icon: 'music', label: 'Live Music',
      value: data.deep_context?.music_vibe || (r.live_music === true ? 'Yes' : (r.live_music === false ? 'No' : null)),
      raw: data.deep_context?.music_vibe || (r.live_music != null ? (r.live_music ? 'Live music venue' : 'No live music') : ''), isAtmo: true },
    { icon: 'pet', label: 'Pet Friendly',
      value: r.pet_friendly === true ? 'Yes' : (r.pet_friendly === false ? 'No' : null),
      raw: r.pet_friendly != null ? (r.pet_friendly ? 'Pet-friendly' : 'Not pet-friendly') : '', isAtmo: true },
  ];

  const byobPolicy = data.deep_context?.byob_policy;
  if (byobPolicy && byobPolicy !== 'none') {
    const byobMap = { full_byob: 'BYOB', wine_only: 'Wine Only' };
    CANONICAL_BADGES.push({ icon: 'wine', label: 'BYOB', value: byobMap[byobPolicy] || humanizeSnake(byobPolicy), raw: humanizeSnake(byobPolicy), isAtmo: false });
  }

  if ($profileFacts) {
    $profileFacts.innerHTML = '';
    CANONICAL_BADGES.map(b => ({ ...b, isNA: b.value == null, value: b.value != null ? b.value : '\u2014' }))
      .forEach(b => {
        const div = document.createElement('div');
        const cls = ['details-badge'];
        if (b.isCuisine) cls.push('details-badge--cuisine');
        if (b.isAtmo) cls.push('details-badge--atmo');
        if (b.isNA) cls.push('details-badge--na');
        div.className = cls.join(' ');
        div.innerHTML = `
          <span class="details-badge__icon">${svgIcon(b.icon, 16)}</span>
          <span class="details-badge__label type-data--sm">${b.label}</span>
          <span class="details-badge__value type-structural">${b.value}</span>`;
        if (b.raw && b.raw !== b.value) div.setAttribute('title', b.raw);
        $profileFacts.appendChild(div);
      });
    $profileFacts.style.display = '';
  }

  // 1D: Add deep context badges (reservation difficulty, wait time, etc.)
  addDeepContextBadges(data);
}

/* ---- Render Profile Chips for Tier 2 ---- */
function renderProfileChips(data, cuisine) {
  const r = data.restaurant;
  const $profileChips = document.getElementById('profile-chips');
  if (!$profileChips) return;
  $profileChips.innerHTML = '';

  const parkingPts = r.parking_availability
    ? parseParkingTypes(r.parking_availability).slice(0, 2).join(' / ') : null;
  const chipItems = [
    { icon: cuisine.icon || 'plate', label: 'Cuisine',
      value: (data.deep_context?.cuisine_subcategory || r.cuisine_type)
        ? shortenBadgeValue(data.deep_context?.cuisine_subcategory || r.cuisine_type) : null },
    { icon: 'tag', label: 'Price', value: r.price_level || null },
    { icon: 'car', label: 'Parking', value: parkingPts },
    { icon: getNoiseIcon(r.noise_level), label: 'Noise',
      value: r.noise_level ? shortenBadgeValue(r.noise_level) : null },
  ].filter(b => b.value != null);

  chipItems.forEach(b => {
    const chip = document.createElement('span');
    chip.className = 'profile-chip';
    chip.setAttribute('aria-label', `${b.label}: ${b.value}`);
    chip.innerHTML = `${svgIcon(b.icon, 14)}<span class="profile-chip__value">${b.value}</span>`;
    $profileChips.appendChild(chip);
  });
}

/* ---- Tier 2 animation trigger (called on first expand) ---- */
let _tier2Animated = false;
function renderTier2Animations() {
  if (_tier2Animated) return;
  _tier2Animated = true;

  const data = _pendingResultData;
  if (!data) return;

  // Animate score hero arc
  renderScoreHero(
    data.donde_match,
    data.scores || {},
    data.scoring_v2 || null,
    null,
    animationTimers
  );
  // Recommendation is already rendered in Tier 1 — no re-render needed here
}

/* ---- Tier 3 animation trigger (called on first expand) ---- */
let _tier3Animated = false;
function renderTier3Animations() {
  if (_tier3Animated) return;
  _tier3Animated = true;
  // Vibe bars removed — vibe profile now lives in score hero bloom overlay
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

/* ---- Humanize snake_case strings to Title Case ---- */
function humanizeSnake(str) {
  if (!str || typeof str !== 'string') return '';
  return str
    .replace(/_/g, ' ')
    .replace(/\b\w/g, c => c.toUpperCase());
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

/* ---- Ambiance → Concise Label Normalizer ---- */
function normalizeAmbiance(ambianceStr) {
  if (!ambianceStr) return '';
  const lower = ambianceStr.toLowerCase();
  if (lower.includes('candlelit')) return 'Candlelit';
  if (lower.includes('dim') && lower.includes('warm')) return 'Dim & Warm';
  if (lower.includes('dim') && lower.includes('intimate')) return 'Intimate';
  if (lower.includes('dim')) return 'Dim';
  if (lower.includes('cozy')) return 'Cozy';
  if (lower.includes('warm') && lower.includes('intimate')) return 'Warm';
  if (lower.includes('bright') && lower.includes('modern')) return 'Bright';
  if (lower.includes('bright')) return 'Bright';
  if (lower.includes('modern')) return 'Modern';
  if (lower.includes('rustic')) return 'Rustic';
  if (lower.includes('elegant')) return 'Elegant';
  return shortenBadgeValue(ambianceStr);
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
    const tier = getScoreTier(data.donde_match, { mismatch: !!data.cuisine_mismatch?.requested });
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

    // Scoring V2 breakdown — "Why This Match"
    const sv2 = data.scoring_v2;
    if (sv2) {
      const v2Dims = [
        { key: 'occasion_fit',    label: 'Occasion' },
        { key: 'craving_match',   label: 'Craving' },
        { key: 'vibe_alignment',  label: 'Vibe' },
        { key: 'practical_fit',   label: 'Practical' },
        { key: 'discovery_value', label: 'Discovery' },
      ];
      const v2Available = v2Dims.filter(d => sv2[d.key] != null);
      if (v2Available.length > 0) {
        const v2Html = v2Available.map(d => {
          const val = Math.min(Math.max(sv2[d.key] || 0, 0), 100);
          return `
            <div class="tile-expand__dim">
              <span class="tile-expand__dim-label type-data--sm">${d.label}</span>
              <div class="tile-expand__dim-bar">
                <div class="tile-expand__dim-fill" style="width: ${val}%"></div>
              </div>
              <span class="tile-expand__dim-value type-data--sm">${humanizeV2(val)}</span>
            </div>`;
        }).join('');

        // Find highest weighted dimension for summary line
        let summaryHtml = '';
        if (sv2.weights_used) {
          const dimLabels = { occasion: 'Occasion', occasion_fit: 'Occasion', craving: 'Craving', craving_match: 'Craving', vibe: 'Vibe', vibe_alignment: 'Vibe', practical: 'Practical', practical_fit: 'Practical', discovery: 'Discovery', discovery_value: 'Discovery' };
          const topDim = Object.entries(sv2.weights_used).sort((a, b) => b[1] - a[1])[0];
          if (topDim && dimLabels[topDim[0]]) {
            summaryHtml = `<p class="tile-expand__summary type-data--sm">Weighted for ${dimLabels[topDim[0]]}</p>`;
          }
        }

        $content.innerHTML += `
          <div class="tile-expand__v2">
            <span class="tile-expand__v2-label type-data--sm">Why This Match</span>
            <div class="tile-expand__dims">${v2Html}</div>
            ${summaryHtml}
          </div>`;
      }
    }
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
  photoUrls.slice(0, 5).forEach((url, i) => {
    const img = document.createElement('img');
    img.className = 'result-photos__img';
    img.src = url;
    img.alt = `${data.restaurant.name} photo ${i + 1}`;
    img.loading = i === 0 ? 'eager' : 'lazy';
    img.decoding = 'async';
    $photos.appendChild(img);
  });
  $photos.style.display = '';
}

/* ---- F2: Render Business Hours ---- */
function renderBusinessHours(data) {
  const $hours = document.getElementById('business-hours');
  if (!$hours) return;
  const openingHours = data.restaurant?.opening_hours;
  if (!openingHours) {
    $hours.style.display = 'none';
    return;
  }
  const $status = document.getElementById('hours-status');
  const $detail = document.getElementById('hours-detail');
  if ($status) {
    if (openingHours.open_now === true) {
      $status.innerHTML = '<span class="hours-badge hours-badge--open">Open Now</span>';
    } else if (openingHours.open_now === false) {
      $status.innerHTML = '<span class="hours-badge hours-badge--closed">Closed</span>';
    } else {
      $status.textContent = 'Hours';
    }
  }
  if ($detail && openingHours.weekday_text?.length) {
    $detail.innerHTML = openingHours.weekday_text
      .map(line => `<p class="hours-line type-data--sm">${line}</p>`)
      .join('');
  }
  $hours.style.display = '';
}

/* ---- F2: Open Now badge in quick tags (interactive with hours popout) ---- */
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

/* ---- F7: Reservation/Booking Link ---- */
function renderReservationLink(data) {
  const r = data.restaurant;
  const $resultLinks = document.getElementById('result-links');
  if (!$resultLinks || !r) return;
  // Add reserve link using Google Maps or restaurant website
  const reserveUrl = r.google_place_id
    ? `https://www.google.com/maps/place/?q=place_id:${r.google_place_id}`
    : r.website;
  if (reserveUrl) {
    const reserveLink = createResultLink('a', 'calendar', 'Reserve', reserveUrl);
    // Insert before the Share button
    const shareBtn = $resultLinks.querySelector('[data-action="share"]');
    if (shareBtn) {
      const sep = document.createElement('span');
      sep.className = 'result-links__sep';
      sep.textContent = '\u00b7';
      sep.setAttribute('aria-hidden', 'true');
      $resultLinks.insertBefore(sep, shareBtn.previousSibling || shareBtn);
      $resultLinks.insertBefore(reserveLink, sep.nextSibling);
    } else {
      $resultLinks.appendChild(reserveLink);
    }
  }
}

/* ---- F11: Render Feedback Button State ---- */
function renderFeedbackState(restaurantId) {
  const existing = loadFeedback(restaurantId);
  document.querySelectorAll('.feedback-btn--like, .feedback-btn--dislike').forEach(btn => {
    btn.classList.toggle('feedback-btn--active', btn.dataset.feedback === existing);
  });
}

/* ---- 1D: Render Deep Context Extras (USP, Wow Factors, Origin Story) ---- */
function renderDeepContextExtras(data) {
  const dc = data.deep_context;
  if (!dc) return;

  // Quick Stats ribbon — compact deep-context data strip (includes wow factors)
  renderQuickStats(dc);

  // Origin Story — presented as a micro-fable
  const $origin = document.getElementById('origin-story');
  const $originText = document.getElementById('origin-story-text');
  if ($origin && $originText && dc.origin_story) {
    let fable = dc.origin_story;
    // Add fable opener if the story doesn't already begin with one
    const fableOpeners = /^(once|long ago|there once|in the beginning|it began|years ago|back when|a long)/i;
    if (!fableOpeners.test(fable.trim())) {
      fable = 'Once, ' + fable.charAt(0).toLowerCase() + fable.slice(1);
    }
    $originText.textContent = fable;
    $origin.style.display = '';
  } else if ($origin) {
    $origin.style.display = 'none';
  }
}

/* ---- Quick Stats: Compact deep-context data ribbon (includes wow factors) ---- */
function renderQuickStats(dc) {
  const $stats = document.getElementById('quick-stats');
  if (!$stats) return;
  $stats.innerHTML = '';

  const items = [];

  // Wow factors — prepend as icon+text items
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
  if (dc.wow_factors?.length) {
    dc.wow_factors.filter(w => w !== 'unique_decor').slice(0, 3).forEach(w => {
      items.push({ icon: WOW_ICONS[w] || 'starFull', text: WOW_LABELS[w] || humanizeSnake(w) });
    });
  }

  // Practical stats
  if (dc.typical_wait_minutes) {
    items.push({ icon: 'clock', text: `~${dc.typical_wait_minutes} min wait` });
  }
  if (dc.check_average_per_person) {
    items.push({ icon: 'tag', text: `~$${dc.check_average_per_person}/pp` });
  }
  if (dc.reservation_difficulty && dc.reservation_difficulty !== 'none') {
    const resMap = { easy: 'Walk-ins OK', moderate: 'Reservations rec.', hard: 'Hard to book' };
    items.push({ icon: 'calendar', text: resMap[dc.reservation_difficulty] || humanizeSnake(dc.reservation_difficulty) });
  }
  if (dc.energy_level != null) {
    const e = dc.energy_level;
    items.push({ icon: 'bolt', text: e >= 8 ? 'High energy' : e >= 5 ? 'Moderate energy' : 'Chill vibe' });
  }
  if (dc.conversation_friendliness != null) {
    const c = dc.conversation_friendliness;
    items.push({ icon: 'chat', text: c >= 7 ? 'Great for convo' : c >= 4 ? 'Moderate noise' : 'Loud' });
  }
  if (dc.spice_level && dc.spice_level !== 'none') {
    items.push({ icon: 'fire', text: humanizeSnake(dc.spice_level) });
  }
  if (dc.cultural_authenticity != null) {
    const a = dc.cultural_authenticity;
    items.push({ icon: 'globe', text: a >= 8 ? 'Very authentic' : a >= 5 ? 'Authentic' : 'Fusion' });
  }
  if (dc.transit_accessibility) {
    items.push({ icon: 'train', text: dc.transit_accessibility });
  }
  if (dc.group_size_sweet_spot) {
    // Parse "[2,6)" range format to "2-6"
    const range = dc.group_size_sweet_spot.replace(/[\[\]()]/g, '').replace(',', '-');
    items.push({ icon: 'usersThree', text: `Best for ${range}` });
  }

  // Cap at 6 for compactness
  const shown = items.slice(0, 6);
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
  $stats.style.display = '';
}

/* ---- 1D: Add Deep Context Badges to Tier 3 ---- */
function addDeepContextBadges(data) {
  const $profileFacts = document.getElementById('profile-facts');
  if (!$profileFacts) return;
  const dc = data.deep_context;
  if (!dc) return;

  const extraBadges = [];

  // Reservation difficulty
  if (dc.reservation_difficulty && dc.reservation_difficulty !== 'none') {
    extraBadges.push({ icon: 'calendar', label: 'Reservations', value: humanizeSnake(dc.reservation_difficulty) });
  }

  // Wait time
  if (dc.typical_wait_minutes) {
    extraBadges.push({ icon: 'clock', label: 'Typical Wait', value: `~${dc.typical_wait_minutes} min` });
  }

  // Check average
  if (dc.check_average_per_person) {
    extraBadges.push({ icon: 'tag', label: 'Avg Check', value: `~$${dc.check_average_per_person}/pp` });
  }

  // Energy level (0-10 → label)
  if (dc.energy_level != null) {
    const e = dc.energy_level;
    const label = e >= 8 ? 'High Energy' : e >= 5 ? 'Moderate' : 'Chill';
    extraBadges.push({ icon: 'bolt', label: 'Energy', value: label });
  }

  // Conversation friendliness (0-10)
  if (dc.conversation_friendliness != null) {
    const c = dc.conversation_friendliness;
    const label = c >= 7 ? 'Great for Convo' : c >= 4 ? 'Moderate' : 'Loud';
    extraBadges.push({ icon: 'chat', label: 'Talk-Friendly', value: label });
  }

  // Cultural authenticity (0-10)
  if (dc.cultural_authenticity != null) {
    const a = dc.cultural_authenticity;
    const label = a >= 8 ? 'Very Authentic' : a >= 5 ? 'Authentic' : 'Fusion';
    extraBadges.push({ icon: 'globe', label: 'Authenticity', value: label });
  }

  // Transit accessibility
  if (dc.transit_accessibility) {
    extraBadges.push({ icon: 'train', label: 'Transit', value: dc.transit_accessibility });
  }

  // Instagram worthiness (0-10, only show if >= 7)
  if (dc.instagram_worthiness != null && dc.instagram_worthiness >= 7) {
    extraBadges.push({ icon: 'camera', label: 'Insta-Worthy', value: `${dc.instagram_worthiness}/10` });
  }

  // Crowd profile (as text)
  if (dc.crowd_profile?.length) {
    extraBadges.push({ icon: 'usersThree', label: 'Crowd', value: dc.crowd_profile.slice(0, 2).join(', ') });
  }

  // Seating options
  if (dc.seating_options?.length) {
    extraBadges.push({ icon: 'chair', label: 'Seating', value: dc.seating_options.slice(0, 3).join(', ') });
  }

  // Spice level (text: "Mild", "Medium", "Hot", etc.)
  if (dc.spice_level) {
    extraBadges.push({ icon: 'fire', label: 'Spice', value: humanizeSnake(dc.spice_level) });
  }

  // Kid friendliness (0-10 → label)
  if (dc.kid_friendliness != null) {
    const k = dc.kid_friendliness;
    const label = k >= 7 ? 'Kid Friendly' : k >= 4 ? 'Okay for Kids' : 'Adults Preferred';
    extraBadges.push({ icon: 'baby', label: 'Kids', value: label });
  }

  // Service style (text: "Counter", "Table Service", "Buffet", etc.)
  if (dc.service_style) {
    extraBadges.push({ icon: 'forkKnife', label: 'Service', value: humanizeSnake(dc.service_style) });
  }

  // Meal pacing (text: "Fast-paced", "Relaxed", "Leisurely", etc.)
  if (dc.meal_pacing) {
    extraBadges.push({ icon: 'timer', label: 'Pacing', value: humanizeSnake(dc.meal_pacing) });
  }

  // Render extra badges
  extraBadges.forEach(b => {
    if (!b.value) return;
    const div = document.createElement('div');
    div.className = 'details-badge';
    div.innerHTML = `
      <span class="details-badge__icon">${svgIcon(b.icon, 16)}</span>
      <span class="details-badge__label type-data--sm">${b.label}</span>
      <span class="details-badge__value type-structural">${b.value}</span>`;
    $profileFacts.appendChild(div);
  });
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

/* ---- Boot ---- */
init();
