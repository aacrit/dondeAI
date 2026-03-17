/* ============================================
   DondeAI — Events Module
   Event delegation, input handling, gestures.
   ============================================ */

import { getState, setState, resetState } from './state.js';
import {
  $dom, _escHtml, haptic, HAPTICS, pushTimer, clearAnimationTimers,
  setSwapInFlight, _swapInFlight, setCurrentAbort, currentAbort as getGlobalAbort,
  setPendingResultData, getPendingResultData, setPendingCuisine, getPendingCuisine,
  isTier2Prepared, setTier2Prepared, setTier2Animated,
  getArrowBounceTimer, setArrowBounceTimer,
  REDUCED_MOTION
} from './globals.js';
import { goToStep } from './router.js';
import {
  getGreeting, getTimePeriod, getCuisineFromResult, svgIcon,
  matchCuisine, matchCulture
} from './utils.js';
import { getLabels, revertAutoTheme, setThemeVisualOnly, setTheme } from './theme.js';
import { toggleSound, playChime } from './audio.js';
import { startVoice } from './voice.js';
import { shareResult, closeShareSheet, handleShareChannel } from './share.js';
import { announce } from './accessibility.js';
import { isOnline } from './offline.js';
import { springAnimate, SPRINGS } from './spring.js';
import { initAuth, signIn as signInWith, signOut as authSignOut, isAuthenticated as isAuthAuthenticated, getUser as getAuthUser, addFavoriteToServer, removeFavoriteFromServer, addVisitToServer } from './auth.js';
import {
  loadHistory, addToHistory, isBookmarked, addBookmark, removeBookmark,
  loadFeedback, saveFeedback, clearFeedback, isVisited, addVisit,
  getOrCreateUserId, hasGuestDismissed, setGuestDismissed, hasSeenOnboarding
} from './persistence.js';
import { fetchRecommendation, sendFeedback, sendVisit, sendAppFeedback } from './api.js';
import {
  renderResult, renderYourSpots,
  renderShareCanvas, prepareTier2, renderTier2Animations,
  openBadgePopout, closeBadgePopout, getActivePopout,
  openTileExpand, closeTileExpand, openLightbox, closeLightbox,
  updateBookmarkBtn, renderFeedbackState, updateGoingBtn,
  openFeedbackSheet, closeFeedbackSheet, updateFeedbackSubmitState,
  showToast, dismissToast, toasts, showEmptyState, clearEmptyState, _revealBlurb,
  updateTryAgainState
} from './render.js';
import {
  beginCanvasFold, manifestResult, settleResult, reverseCanvasFold,
  unfoldResultToCanvas, animateScoreCountUp, _fireTieredCelebration
} from './transitions.js';
import { resetBloomState } from './animations.js';

/* ---- Module-local state ---- */
let _canvasPhase = 'minimal';
let _canvasRevealTimer = null;
let chipRotationTimer = null;
let chipDebounce = null;
let autoThemeDebounce = null;
let placeholderInterval = null;
let activeIndex = -1;
let autoAdvanceTimer = null;
let ctaBreathTimer = null;
let _chipsPaused = false;
let _chipListenerAC = null; // AbortController to prevent chip listener leaks (BUG 4.6)

/* ---- Action Button Particle Helpers ---- */
function _spawnBookmarkParticles(anchorEl, count) {
  if (REDUCED_MOTION.matches) return;
  const parent = anchorEl.closest('.card-footer__feedback-row') || anchorEl.parentElement;
  if (!parent) return;
  parent.style.position = parent.style.position || 'relative';
  const rect = anchorEl.getBoundingClientRect();
  const parentRect = parent.getBoundingClientRect();
  const cx = rect.left - parentRect.left + rect.width / 2;
  const cy = rect.top - parentRect.top + rect.height / 2;

  for (let i = 0; i < count; i++) {
    const dot = document.createElement('span');
    dot.className = 'bookmark-particle';
    const xOffset = (Math.random() - 0.5) * 16; // -8px to 8px
    dot.style.setProperty('--particle-x', `${xOffset}px`);
    dot.style.left = `${cx}px`;
    dot.style.top = `${cy}px`;
    parent.appendChild(dot);
    dot.addEventListener('animationend', () => dot.remove(), { once: true });
    // Safety cleanup
    setTimeout(() => { if (dot.parentNode) dot.remove(); }, 700);
  }
}

function _spawnGoingParticles(anchorEl, count) {
  if (REDUCED_MOTION.matches) return;
  const parent = anchorEl.parentElement;
  if (!parent) return;
  parent.style.position = parent.style.position || 'relative';
  const rect = anchorEl.getBoundingClientRect();
  const parentRect = parent.getBoundingClientRect();
  const cx = rect.left - parentRect.left + rect.width / 2;
  const cy = rect.top - parentRect.top + rect.height / 2;

  for (let i = 0; i < count; i++) {
    const dot = document.createElement('span');
    dot.className = 'going-particle';
    const xOffset = (Math.random() - 0.5) * 40; // -20px to 20px
    const yOffset = -15 - Math.random() * 25;    // -15px to -40px
    dot.style.setProperty('--particle-x', `${xOffset}px`);
    dot.style.setProperty('--particle-y', `${yOffset}px`);
    dot.style.left = `${cx}px`;
    dot.style.top = `${cy}px`;
    // Stagger particle launch
    setTimeout(() => {
      parent.appendChild(dot);
      dot.addEventListener('animationend', () => dot.remove(), { once: true });
      setTimeout(() => { if (dot.parentNode) dot.remove(); }, 800);
    }, i * 60);
  }
}

/* ---- Canvas Progressive Disclosure ---- */
export function startCanvasDisclosure() {
  const $step0 = document.querySelector('.step[data-step="0"]');
  if (!$step0) return;

  _canvasPhase = 'minimal';
  const $canvasInner = $step0.querySelector('.canvas-layout');
  if ($canvasInner) {
    $canvasInner.classList.add('canvas-layout--minimal');
    $canvasInner.classList.remove('canvas-layout--engaged', 'canvas-layout--returning');
  }

  const { history } = getState();
  const isReturning = history && history.length > 0;

  _canvasRevealTimer = setTimeout(() => {
    setCanvasPhase(isReturning ? 'returning' : 'engaged');
  }, 2000);
}

export function setCanvasPhase(phase) {
  const $step0 = document.querySelector('.step[data-step="0"]');
  if (!$step0 || _canvasPhase === phase) return;

  const wasMinimal = _canvasPhase === 'minimal';
  _canvasPhase = phase;
  const $canvasInner = $step0.querySelector('.canvas-layout');
  if ($canvasInner) {
    $canvasInner.classList.remove('canvas-layout--minimal', 'canvas-layout--engaged', 'canvas-layout--returning');
    $canvasInner.classList.add(`canvas-layout--${phase}`);
  }

  if (wasMinimal && (phase === 'engaged' || phase === 'returning')) {
    const $chips = $step0.querySelector('.smart-chips');
    if ($chips && !matchMedia('(prefers-reduced-motion: reduce)').matches) {
      $chips.classList.add('smart-chips--cascade');
      const chipEls = $chips.querySelectorAll('.smart-chip');
      chipEls.forEach((_, i) => {
        const delays = [0, 60, 140, 240, 360];
        setTimeout(() => haptic(HAPTICS.signalPop), delays[i] || 360);
      });
      setTimeout(() => $chips.classList.remove('smart-chips--cascade'), 1200);
    }
  }
}

export function onCanvasEngaged() {
  if (_canvasPhase !== 'minimal') return;
  if (_canvasRevealTimer) clearTimeout(_canvasRevealTimer);
  const { history } = getState();
  setCanvasPhase(history && history.length > 0 ? 'returning' : 'engaged');
}

/* ---- Dynamic Smart Chips ---- */
export function renderSmartChips() {
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

  const basePool = culture !== 'neutral' ? getLabels('neutral').chipPool : pool;
  if (basePool) {
    pickFrom(basePool.time?.[timePeriod], 2);
    pickFrom(basePool.vibe, 1);
    pickFrom(basePool.style, 1);
    if (culture !== 'neutral' && pool?.cuisine) {
      pickFrom(pool.cuisine, 1);
    } else {
      pickFrom(basePool.cuisine, 1);
    }
  }

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

/* ---- Chip Rotation ---- */
export function startChipRotation() {
  stopChipRotation();
  // Abort old pointer listeners before adding new ones (BUG 4.6: prevents listener leaks)
  if (_chipListenerAC) _chipListenerAC.abort();
  _chipListenerAC = new AbortController();
  const $container = document.querySelector('.smart-chips');
  if ($container) {
    $container.addEventListener('pointerenter', () => { _chipsPaused = true; }, { signal: _chipListenerAC.signal });
    $container.addEventListener('pointerleave', () => { _chipsPaused = false; }, { signal: _chipListenerAC.signal });
  }
  chipRotationTimer = setInterval(() => {
    if ($dom.cravingInput && $dom.cravingInput.value.trim().length > 0) return;
    if (document.activeElement === $dom.cravingInput) return;
    if (_chipsPaused) return;
    const filterToggle = document.querySelector('.filter-drawer__toggle');
    if (filterToggle?.getAttribute('aria-expanded') === 'true') return;
    rotateOneChip();
  }, 15000);
}

export function stopChipRotation() {
  if (chipRotationTimer) {
    clearInterval(chipRotationTimer);
    chipRotationTimer = null;
  }
}

export function rotateOneChip() {
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

  oldChip.style.transition = 'opacity 200ms var(--ease-out), transform 200ms var(--ease-out)';
  oldChip.style.opacity = '0';
  oldChip.style.transform = 'translateY(-8px) scale(0.9)';

  setTimeout(() => {
    updateChipContent(oldChip, newText);
    oldChip.style.transform = 'translateY(8px) scale(0.9)';
    requestAnimationFrame(() => {
      oldChip.style.transition = 'opacity 250ms var(--ease-out), transform 350ms var(--spring)';
      oldChip.style.opacity = '1';
      oldChip.style.transform = 'translateY(0) scale(1)';
    });
  }, 220);
}

export function getRandomChipFromPool(excludeSet) {
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

export function updateChipsForInput(query) {
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
      chip.style.transition = 'opacity 150ms var(--ease-out), transform 150ms var(--ease-out)';
      chip.style.opacity = '0';
      chip.style.transform = 'scale(0.9)';
      setTimeout(() => {
        chip.textContent = text;
        chip.dataset.value = text;
        chip.style.transition = 'opacity 200ms var(--ease-out), transform 250ms var(--spring)';
        chip.style.opacity = '1';
        chip.style.transform = 'scale(1)';
      }, 160);
    }
  });
}

/* ---- Suggestion Scoring Engine ---- */
export function scoreSuggestion(item, query) {
  const text = item.text.toLowerCase();
  const q = query.toLowerCase();
  let score = 0;

  if (text.startsWith(q)) {
    score += 100;
  } else if (text.split(/\s+/).some(word => word.startsWith(q))) {
    score += 75;
  } else {
    const queryWords = q.split(/\s+/).filter(Boolean);
    const textWords = text.split(/\s+/);
    let matched = 0;
    for (const qw of queryWords) {
      if (textWords.some(tw => tw.startsWith(qw))) matched++;
    }
    if (matched > 0 && queryWords.length > 0) {
      score += 30 + (matched / queryWords.length) * 30;
    } else if (text.includes(q)) {
      score += 20;
    }
  }

  if (score > 0) {
    score += Math.max(0, 10 - text.length * 0.2);
  }

  return score;
}

export function getFilteredSuggestions(query) {
  const culture = getState().theme.culture;
  const labels = getLabels(culture);
  const corpus = labels.suggestionCorpus;

  const items = [];
  if (corpus) {
    for (const [, category] of Object.entries(corpus)) {
      if (Array.isArray(category)) items.push(...category);
    }
  }

  loadHistory().forEach(h => {
    if (h.label) {
      items.push({ text: h.label, icon: h.cuisineIcon || 'plate', category: 'Recent' });
    }
  });

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

  const scored = items
    .map(item => ({ ...item, score: scoreSuggestion(item, query) }))
    .filter(item => item.score > 0);

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

/* ---- Contextual Suggestions ---- */
export function showContextualSuggestions() {
  const culture = getState().theme.culture;
  const labels = getLabels(culture);
  const corpus = labels.suggestionCorpus;
  if (!corpus || !$dom.suggestions) return;

  const items = [];
  const combos = corpus.combos || [];
  const vibes = corpus.vibes || [];
  const cuisines = corpus.cuisines || [];

  const contextual = [...combos, ...vibes].sort(() => Math.random() - 0.5);
  items.push(...contextual.slice(0, 3).map(i => ({ ...i, category: 'Right Now' })));

  const popular = [...cuisines].sort(() => Math.random() - 0.5);
  items.push(...popular.slice(0, 4).map(i => ({ ...i, category: 'Popular' })));

  renderSuggestions(items, '');
}

/* ---- Suggestion Rendering ---- */
export function renderSuggestions(matches, query) {
  if (!$dom.suggestions || matches.length === 0) {
    closeSuggestions();
    return;
  }

  $dom.suggestions.innerHTML = '';
  activeIndex = -1;

  let lastCategory = null;

  matches.forEach((item, i) => {
    const text = typeof item === 'string' ? item : item.text;
    const iconName = typeof item === 'object' ? item.icon : null;
    const category = typeof item === 'object' ? item.category : null;

    if (category && category !== lastCategory) {
      lastCategory = category;
      const sep = document.createElement('div');
      sep.className = 'craving-suggestion__category type-data--sm';
      sep.textContent = category;
      $dom.suggestions.appendChild(sep);
    }

    const div = document.createElement('div');
    div.className = 'craving-suggestion';
    div.setAttribute('role', 'option');
    div.setAttribute('id', `suggestion-${i}`);
    div.dataset.value = text;

    if (iconName) {
      const iconSpan = document.createElement('span');
      iconSpan.className = 'craving-suggestion__icon';
      iconSpan.innerHTML = svgIcon(iconName, 14);
      div.appendChild(iconSpan);
    }

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

    $dom.suggestions.appendChild(div);
  });

  $dom.suggestions.hidden = false;
  if ($dom.cravingInput) $dom.cravingInput.setAttribute('aria-expanded', 'true');
}

export function closeSuggestions() {
  if (!$dom.suggestions) return;
  $dom.suggestions.hidden = true;
  $dom.suggestions.innerHTML = '';
  activeIndex = -1;
  if ($dom.cravingInput) {
    $dom.cravingInput.removeAttribute('aria-activedescendant');
    $dom.cravingInput.setAttribute('aria-expanded', 'false');
  }
}

export function moveActive(delta) {
  if (!$dom.suggestions || $dom.suggestions.hidden) return;
  const items = $dom.suggestions.querySelectorAll('.craving-suggestion');
  if (items.length === 0) return;

  if (activeIndex >= 0 && activeIndex < items.length) {
    items[activeIndex].classList.remove('craving-suggestion--active');
  }

  activeIndex = (activeIndex + delta + items.length) % items.length;

  items[activeIndex].classList.add('craving-suggestion--active');
  items[activeIndex].scrollIntoView({ block: 'nearest' });
  $dom.cravingInput.setAttribute('aria-activedescendant', `suggestion-${activeIndex}`);
}

export function selectSuggestion(index) {
  if (!$dom.suggestions) return;
  const items = $dom.suggestions.querySelectorAll('.craving-suggestion');
  if (index < 0 || index >= items.length) return;

  const value = items[index].dataset.value;
  if ($dom.cravingInput) {
    $dom.cravingInput.value = value;
    setState({ craving: value });
    updateCtaState();
  }
  closeSuggestions();
}

/* ---- Filter Selection ---- */
export function selectFilter(field, btn) {
  haptic(HAPTICS.tick);
  const isOccasionTile = btn.classList.contains('occasion-tile');
  const group = btn.closest('[role="radiogroup"]') || btn.closest('.filter-pills');
  if (!group) return;

  const ripple = document.createElement('span');
  ripple.className = isOccasionTile ? 'occasion-tile__ripple' : 'filter-pill__ripple';
  btn.appendChild(ripple);
  ripple.addEventListener('animationend', () => ripple.remove(), { once: true });

  const siblingSelector = isOccasionTile ? '.occasion-tile' : '.filter-pill';
  group.querySelectorAll(siblingSelector).forEach(c => {
    c.setAttribute('aria-checked', 'false');
  });

  const selectedValue = btn.dataset.value;
  const currentValue = getState()[field];
  if (isOccasionTile && currentValue === selectedValue) {
    setState({ [field]: 'Any' });
    updateFilterSummary();
    announce('Vibe cleared');
    return;
  }

  btn.setAttribute('aria-checked', 'true');
  btn.classList.add('chip-pop');
  btn.addEventListener('animationend', () => btn.classList.remove('chip-pop'), { once: true });

  setState({ [field]: selectedValue });
  updateFilterSummary();
  boostCta();
  announce(`${selectedValue} selected`);

  clearTimeout(autoAdvanceTimer);
  const st = getState();
  if (st.neighborhood !== 'Anywhere' && st.priceLevel !== 'Any' && st.dietaryRestrictions.length > 0) {
    autoAdvanceTimer = setTimeout(() => collapseFilters(), 600);
  }
}

export function clearAllSelections() {
  document.querySelectorAll('.filter-pill[aria-checked="true"], .occasion-tile[aria-checked="true"]').forEach(c => {
    c.setAttribute('aria-checked', 'false');
  });
}

export function syncFilterPillsToState() {
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
  document.querySelectorAll('.occasion-tile[data-action="select-occasion"]').forEach(tile => {
    const isSelected = tile.dataset.value === s.occasion;
    tile.setAttribute('aria-checked', String(isSelected));
  });
}

export function collapseFilters() {
  const toggle = document.querySelector('[data-action="toggle-filters"]');
  const content = document.getElementById('filter-content');
  if (toggle) toggle.setAttribute('aria-expanded', 'false');
  if (content && !content.hidden) _animateDrawerClose(content);
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

export function updateFilterSummary() {
  const s = getState();
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

  const $openNowCanvas = document.getElementById('open-now-canvas');
  if ($openNowCanvas) {
    $openNowCanvas.setAttribute('aria-checked', String(!!s.openNow));
  }
}

export function updateCtaState() {
  const $cta = document.querySelector('.cta-btn[data-action="submit"]');
  const $hint = document.getElementById('cta-hint');
  const isEmpty = !$dom.cravingInput?.value.trim();
  const wasDisabled = $cta?.disabled;

  if ($cta) {
    $cta.disabled = isEmpty;
    $cta.setAttribute('aria-disabled', String(isEmpty));

    if (isEmpty) {
      $cta.classList.remove('cta-btn--ready');
      if (ctaBreathTimer) { clearTimeout(ctaBreathTimer); ctaBreathTimer = null; }
    } else if (wasDisabled && !isEmpty) {
      $cta.classList.add('cta-btn--ink-fill');
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

export function boostCta() {
  const $cta = document.querySelector('.cta-btn');
  if (!$cta || $cta.disabled) return;
  $cta.classList.remove('cta-btn--boosted');
  void $cta.offsetWidth;
  $cta.classList.add('cta-btn--boosted');
  $cta.addEventListener('animationend', () => $cta.classList.remove('cta-btn--boosted'), { once: true });
}

/* ---- Placeholder Rotation ---- */
export function startPlaceholderRotation() {
  if (placeholderInterval) clearInterval(placeholderInterval);
  if (!$dom.cravingInput || $dom.cravingInput.value.trim()) return;

  const labels = getLabels(getState().theme.culture);
  const phs = labels.placeholders || [labels.placeholder];
  let idx = 0;

  placeholderInterval = setInterval(() => {
    if ($dom.cravingInput.value.trim() || document.activeElement === $dom.cravingInput) return;
    idx = (idx + 1) % phs.length;
    $dom.cravingInput.style.transition = 'opacity 150ms cubic-bezier(0.4, 0, 0.2, 1)';
    $dom.cravingInput.style.opacity = '0';
    setTimeout(() => {
      $dom.cravingInput.placeholder = phs[idx];
      $dom.cravingInput.style.opacity = '';
    }, 150);
  }, 4000);
}

/* ---- Submit ---- */
export async function handleSubmit() {
  const s = getState();

  if (s.loading) return;

  if (!s.craving.trim()) {
    $dom.cravingInput?.classList.add('shake');
    $dom.cravingInput?.addEventListener('animationend', () => $dom.cravingInput.classList.remove('shake'), { once: true });
    $dom.cravingInput?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    $dom.cravingInput?.focus();
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

  if (getGlobalAbort) getGlobalAbort.abort();
  const abort = new AbortController();
  setCurrentAbort(abort);

  haptic([20]);

  const $cta = document.querySelector('.cta-btn[data-action="submit"]');
  if ($cta) {
    $cta.classList.remove('cta-btn--ready');
    $cta.classList.add('cta-btn--confirming');
    if (!REDUCED_MOTION.matches) await new Promise(r => setTimeout(r, 200));
    $cta.classList.remove('cta-btn--confirming');
    $cta.classList.add('cta-btn--loading');
    $cta.textContent = 'Searching';
  }

  // aria-busy on result container during loading (WCAG 4.1.3)
  const $resultStep = document.querySelector('[data-step="1"]');
  if ($resultStep) $resultStep.setAttribute('aria-busy', 'true');

  setState({ loading: true, error: null, result: null });
  clearEmptyState();

  // pulseAmbient is imported from app.js orchestrator via the caller
  // We dispatch a custom event instead
  document.dispatchEvent(new CustomEvent('donde:pulse-ambient'));

  try {
    const payload = {
      special_request: s.craving,
      occasion: s.occasion,
      neighborhood: s.neighborhood,
      price_level: s.priceLevel,
    };
    if (s.excludeIds.length) payload.exclude = s.excludeIds;
    if (s.dietaryRestrictions.length) payload.dietary_restrictions = s.dietaryRestrictions;
    if (s.openNow) payload.open_now = true;
    payload.user_id = getOrCreateUserId();
    if (s.pendingFeedback) {
      payload.feedback = s.pendingFeedback;
      setState({ pendingFeedback: null });
    }
    // BUG 2.2: Pass the global AbortController's signal so Back button aborts the real fetch
    const data = await fetchRecommendation(payload, abort.signal);

    const cuisine = getCuisineFromResult(data);
    const label = s.craving.slice(0, 30);
    const hist = addToHistory(label, {
      special_request: s.craving,
      occasion: s.occasion,
      neighborhood: s.neighborhood,
      price_level: s.priceLevel,
    }, cuisine.icon);

    const rankedQueue = Array.isArray(data.ranked_queue) ? data.ranked_queue : [];
    setState({ result: data, loading: false, history: hist, rankedQueue, rankedQueueIndex: 0 });
    renderSmartChips();
    renderYourSpots();
    playChime();
    announce(`Recommendation: ${data.restaurant?.name || 'found'}`);
  } catch (err) {
    if (err.name === 'AbortError') return;
    reverseCanvasFold();
    setState({ loading: false });
    showEmptyState(err.message || toasts().noResults);
    showToast(err.message || toasts().genericError, true, {
      label: 'Retry',
      callback: () => handleSubmit(),
    });
  } finally {
    if ($resultStep) $resultStep.removeAttribute('aria-busy');
    if ($cta) {
      $cta.classList.remove('cta-btn--loading');
      const labels = getLabels(getState().theme.culture);
      $cta.textContent = labels.cta;
    }
    setCurrentAbort(null);
  }
}

/* ---- Wire Craving Input ---- */
export function wireCravingInput() {
  if (!$dom.cravingInput) return;

  $dom.cravingInput.addEventListener('input', () => {
    onCanvasEngaged();
    setState({ craving: $dom.cravingInput.value });
    updateCtaState();
    clearEmptyState();
    const max = 500;
    if ($dom.cravingInput.value.length > max) {
      $dom.cravingInput.value = $dom.cravingInput.value.slice(0, max);
    }
    const $counter = document.getElementById('craving-counter');
    if ($counter) {
      const len = $dom.cravingInput.value.length;
      if (len >= max * 0.8) {
        $counter.textContent = `${len} / ${max}`;
        $counter.hidden = false;
      } else {
        $counter.hidden = true;
      }
    }
    $dom.cravingInput.style.height = 'auto';
    $dom.cravingInput.style.height = $dom.cravingInput.scrollHeight + 'px';

    clearTimeout(chipDebounce);
    chipDebounce = setTimeout(() => {
      updateChipsForInput($dom.cravingInput.value.trim());
    }, 300);

    clearTimeout(autoThemeDebounce);
    autoThemeDebounce = setTimeout(() => {
      const val = $dom.cravingInput.value.trim();
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

    const query = $dom.cravingInput.value.trim();
    if (query.length < 1) {
      closeSuggestions();
      return;
    }
    const matches = getFilteredSuggestions(query);
    renderSuggestions(matches, query);
  });

  $dom.cravingInput.addEventListener('keydown', (e) => {
    if ($dom.suggestions && !$dom.suggestions.hidden) {
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

    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  });

  $dom.cravingInput.addEventListener('focus', () => {
    if (placeholderInterval) { clearInterval(placeholderInterval); placeholderInterval = null; }
    if (!$dom.cravingInput.value.trim()) {
      showContextualSuggestions();
    }
  });
  $dom.cravingInput.addEventListener('blur', () => {
    setTimeout(() => closeSuggestions(), 150);
    if (!$dom.cravingInput.value.trim()) startPlaceholderRotation();
  });

  if ($dom.suggestions) {
    $dom.suggestions.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      const item = e.target.closest('.craving-suggestion');
      if (item) {
        $dom.cravingInput.value = item.dataset.value;
        setState({ craving: item.dataset.value });
        updateCtaState();
        closeSuggestions();
        $dom.cravingInput.focus();
      }
    });
  }

  startPlaceholderRotation();
}

/* ---- Wire Events (main delegation) ---- */
export function wireEvents(appCallbacks) {
  const {
    setupLanding, openAuthSheet, closeAuthSheet, toggleUserMenu, closeUserMenu,
    showCoachMarks, dismissCoachMark, initHoodGroups, autoOpenHoodGroup
  } = appCallbacks;

  document.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-action]');
    if (!btn) return;

    const action = btn.dataset.action;

    switch (action) {
      case 'reset':
        resetState();
        if ($dom.cravingInput) {
          $dom.cravingInput.value = '';
          $dom.cravingInput.style.height = '';
        }
        clearAllSelections();
        document.querySelectorAll('[data-action="toggle-dietary"]').forEach(pill => {
          pill.setAttribute('aria-checked', 'false');
        });
        const $openNowPill = document.getElementById('open-now-pill');
        if ($openNowPill) $openNowPill.setAttribute('aria-checked', 'false');
        setupLanding();
        renderSmartChips();
        renderYourSpots();
        settleResult();
        if ($dom.resultCard) { $dom.resultCard.classList.remove('result-card--unfolding', 'result-card--loading'); $dom.resultCard.style.display = 'none'; }
        const $canvasReset = document.querySelector('.canvas-layout');
        if ($canvasReset) $canvasReset.classList.remove('canvas-layout--restoring', 'canvas-layout--morphing');
        goToStep(0);
        startCanvasDisclosure();
        updateCtaState();
        updateFilterSummary();
        collapseFilters();
        revertAutoTheme();
        break;

      case 'back':
        if (getGlobalAbort) getGlobalAbort.abort();
        if (getState().loading) {
          reverseCanvasFold();
          setState({ loading: false });
        } else {
          unfoldResultToCanvas();
        }
        syncFilterPillsToState();
        revertAutoTheme();
        break;

      case 'voice':
        startVoice();
        break;

      case 'smart-chip': {
        const val = btn.dataset.value;
        if ($dom.cravingInput) {
          const current = $dom.cravingInput.value.trim();
          $dom.cravingInput.value = current ? `${current}, ${val}` : val;
          setState({ craving: $dom.cravingInput.value });
          updateCtaState();
        }
        btn.classList.add('smart-chip--active');
        btn.addEventListener('animationend',
          () => btn.classList.remove('smart-chip--active'), { once: true });
        const ripple = document.createElement('span');
        ripple.className = 'filter-pill__ripple';
        btn.appendChild(ripple);
        ripple.addEventListener('animationend', () => ripple.remove(), { once: true });
        break;
      }

      case 'taste-memory': {
        try {
          const payload = JSON.parse(btn.dataset.payload);
          if ($dom.cravingInput && payload.special_request) {
            $dom.cravingInput.value = payload.special_request;
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
          if (hoodRegions) hoodRegions.setAttribute('aria-hidden', 'true');
          if (hoodBrowse) {
            hoodBrowse.setAttribute('aria-expanded', 'false');
            hoodBrowse.classList.remove('hood-browse--active');
          }
          document.querySelectorAll('.hood-group[open]').forEach(g => g.removeAttribute('open'));
        } else {
          autoOpenHoodGroup(btn.dataset.value);
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
            _animateDrawerClose(content);
          } else {
            content.hidden = false;
          }
        }
        break;
      }

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
        const ripple = document.createElement('span');
        ripple.className = 'filter-pill__ripple';
        btn.appendChild(ripple);
        ripple.addEventListener('animationend', () => ripple.remove(), { once: true });
        updateFilterSummary();
        clearTimeout(autoAdvanceTimer);
        const dst = getState();
        if (dst.occasion !== 'Any' && dst.neighborhood !== 'Anywhere' && dst.priceLevel !== 'Any' && dst.dietaryRestrictions.length > 0) {
          autoAdvanceTimer = setTimeout(() => collapseFilters(), 600);
        }
        break;
      }

      case 'toggle-open-now': {
        const isActive = btn.getAttribute('aria-checked') === 'true';
        btn.setAttribute('aria-checked', String(!isActive));
        setState({ openNow: !isActive });
        haptic(HAPTICS.tick);
        const rippleEl = document.createElement('span');
        rippleEl.className = 'filter-pill__ripple';
        btn.appendChild(rippleEl);
        rippleEl.addEventListener('animationend', () => rippleEl.remove(), { once: true });
        updateFilterSummary();
        announce(!isActive ? 'Open now filter applied' : 'Open now filter removed');
        break;
      }

      case 'surprise-me': {
        haptic([10, 30, 10, 30, 10]);
        const surprisePrompts = [
          "surprise me with the best spot tonight",
          "the most underrated gem nearby",
          "whatever locals are obsessed with",
          "a place that'll blow my mind",
          "the hidden gem nobody talks about",
          "something completely different",
          "the best meal I'll have this month",
          "chef's pick \u2014 go wild",
        ];
        btn.style.animation = 'factorWobble 400ms ease-out';
        btn.addEventListener('animationend', () => { btn.style.animation = ''; }, { once: true });

        const finalPrompt = surprisePrompts[Math.floor(Math.random() * surprisePrompts.length)];

        if ($dom.cravingInput) {
          $dom.cravingInput.classList.add('craving-input--surprising');
          $dom.cravingInput.addEventListener('animationend', () => $dom.cravingInput.classList.remove('craving-input--surprising'), { once: true });

          $dom.cravingInput.value = '';
          let charIdx = 0;
          const typeInterval = setInterval(() => {
            charIdx++;
            $dom.cravingInput.value = finalPrompt.slice(0, charIdx);
            $dom.cravingInput.style.height = 'auto';
            $dom.cravingInput.style.height = $dom.cravingInput.scrollHeight + 'px';
            if (charIdx >= finalPrompt.length) {
              clearInterval(typeInterval);
              setState({ craving: finalPrompt, excludeIds: [] });
              updateCtaState();
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

      case 'feedback': {
        haptic(HAPTICS.tick);
        const fb = btn.dataset.feedback;
        const resultData = getState().result;
        const restaurantId = resultData?.restaurant?.id;
        if (!restaurantId || !fb) break;
        const userId = getOrCreateUserId();
        const isAlreadyActive = btn.classList.contains('feedback-btn--active');
        if (isAlreadyActive) {
          clearFeedback(restaurantId);
          setState({ pendingFeedback: null });
          btn.classList.remove('feedback-btn--active');
          sendFeedback(restaurantId, null, userId);
          showToast(toasts().feedbackCleared, false);
        } else {
          saveFeedback(restaurantId, fb);
          setState({ pendingFeedback: { restaurant_id: restaurantId, feedback: fb } });
          document.querySelectorAll('.feedback-btn').forEach(b => b.classList.remove('feedback-btn--active'));
          btn.classList.add('feedback-btn--active');
          sendFeedback(restaurantId, fb, userId);
          showToast(fb === 'like' ? toasts().feedbackLike : toasts().feedbackDislike, false);
        }
        break;
      }

      case 'bookmark': {
        const result = getState().result;
        const restaurant = result?.restaurant;
        if (!restaurant?.id) break;
        const wasBookmarked = isBookmarked(restaurant.id);
        if (wasBookmarked) {
          /* ---- Unsave: drain + subtle shrink ---- */
          haptic([15]);
          removeBookmark(restaurant.id);
          if (isAuthAuthenticated()) removeFavoriteFromServer(restaurant.id);
          const $filledUnsave = btn.querySelector('.bookmark-icon--filled');
          if ($filledUnsave && !REDUCED_MOTION.matches) {
            $filledUnsave.classList.add('bookmark-icon--draining');
            btn.classList.add('bookmark-icon--unsaving');
            $filledUnsave.addEventListener('animationend', () => {
              $filledUnsave.classList.remove('bookmark-icon--draining');
              btn.classList.remove('bookmark-icon--unsaving');
              updateBookmarkBtn(restaurant.id);
            }, { once: true });
          } else {
            updateBookmarkBtn(restaurant.id);
          }
        } else {
          /* ---- Save: ink-pour + spring pop + particles ---- */
          haptic(HAPTICS.doublePulse);
          addBookmark(restaurant);
          if (isAuthAuthenticated()) addFavoriteToServer(restaurant);
          updateBookmarkBtn(restaurant.id);
          const $filled = btn.querySelector('.bookmark-icon--filled');
          if ($filled && !REDUCED_MOTION.matches) {
            /* Clip-path fill from bottom to top */
            $filled.classList.add('bookmark-icon--filling');
            $filled.addEventListener('animationend', () => {
              $filled.classList.remove('bookmark-icon--filling');
            }, { once: true });
            /* Spring pop on the whole button */
            btn.classList.add('bookmark-icon--animating');
            btn.addEventListener('animationend', () => {
              btn.classList.remove('bookmark-icon--animating');
            }, { once: true });
          }
          /* Spawn 3 rising particles */
          _spawnBookmarkParticles(btn, 3);
        }
        renderYourSpots();
        const t = toasts();
        const savedMsg = isAuthAuthenticated()
          ? (wasBookmarked ? t.bookmarkRemove : t.bookmarkAddAuth)
          : (wasBookmarked ? t.bookmarkRemove : t.bookmarkAdd);
        showToast(savedMsg, false);
        break;
      }

      case 'going': {
        const goingResult = getState().result;
        const goingRestaurant = goingResult?.restaurant;
        if (!goingRestaurant?.id) break;
        if (isVisited(goingRestaurant.id)) break;

        /* Decisive haptic pattern (not same as celebration) */
        haptic([40, 20, 60]);

        addVisit(goingRestaurant);
        const goingUserId = getOrCreateUserId();
        sendVisit(goingRestaurant, goingUserId);
        if (isAuthAuthenticated()) addVisitToServer(goingRestaurant);

        const $goingBtn = document.getElementById('going-btn');
        const $goingText = $goingBtn?.querySelector('.going-btn__text');
        const $goingIcon = $goingBtn?.querySelector('.going-btn__icon');
        const restaurantName = goingRestaurant.name || 'this spot';

        if ($goingBtn && $goingText && !REDUCED_MOTION.matches) {
          /* Phase 1: Fade out current text */
          $goingText.classList.add('going-btn__text--fading');
          $goingBtn.classList.add('going-btn--confirmed');

          setTimeout(() => {
            /* Phase 2: Insert checkmark + scale it in */
            if ($goingIcon) {
              $goingIcon.innerHTML = '<svg class="going-checkmark" viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>';
            }

            /* Phase 3: Update text to "You're Going!" with fade-in */
            $goingText.classList.remove('going-btn__text--fading');
            $goingText.textContent = "You're Going!";
            $goingText.classList.add('going-btn__text--appearing');
            $goingText.addEventListener('animationend', () => {
              $goingText.classList.remove('going-btn__text--appearing');
            }, { once: true });

            $goingBtn.classList.add('going-btn--done');
            $goingBtn.classList.remove('going-btn--confirmed');
          }, 160);

          /* Fire particle burst from button */
          _spawnGoingParticles($goingBtn, 4);

          /* Play celebration chime if sound is on */
          playChime();
        } else {
          updateGoingBtn(goingRestaurant.id);
        }

        renderYourSpots();
        showToast(`See you at ${restaurantName}!`, false);
        break;
      }

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
        if (_swapInFlight) break;
        if (getState().excludeIds.length >= 4) break;
        const $tryBtn = btn.closest('[data-action="try-again"]') || btn;
        $tryBtn.classList.add('try-again-btn--loading');

        const prevId = getState().result?.restaurant?.id;
        if (prevId) {
          const exclude = [...getState().excludeIds];
          if (!exclude.includes(prevId)) exclude.push(prevId);
          setState({ excludeIds: exclude });
        }

        const queue = getState().rankedQueue;
        const qIdx = getState().rankedQueueIndex;
        if (queue.length > 0 && qIdx < queue.length) {
          const nextResult = queue[qIdx];
          setState({ rankedQueueIndex: qIdx + 1, result: nextResult });

          clearAnimationTimers();
          setSwapInFlight(false);

          if ($dom.resultCard && !REDUCED_MOTION.matches) {
            setSwapInFlight(true);
            $dom.resultCard.classList.add('result-card--swapping-out');
            pushTimer(setTimeout(() => {
              renderResult(nextResult);
              $dom.resultCard.classList.remove('result-card--swapping-out', 'result-card--crossfading');
              $dom.resultCard.classList.add('result-card--swapping-in');
              pushTimer(setTimeout(() => {
                const dondeScore = Math.round(parseFloat(nextResult.donde_match) || 80);
                const $matchScore = document.getElementById('match-pill-score');
                if ($matchScore) animateScoreCountUp($matchScore, dondeScore);
                $dom.resultCard.classList.remove('result-card--swapping-in');
                setSwapInFlight(false);
                document.querySelector('.try-again-btn--loading')?.classList.remove('try-again-btn--loading');
                if (dondeScore >= 70) {
                  pushTimer(setTimeout(() => {
                    _fireTieredCelebration(dondeScore);
                  }, 1400));
                }
              }, 400));
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
          setTimeout(() => { setSwapInFlight(false); }, 1000);

          _revealBlurb(nextResult);

          break;
        }

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

      case 'toggle-cuisine-chip': {
        haptic(HAPTICS.tick);
        const idx = btn.dataset.index;
        const wasSelected = btn.getAttribute('aria-selected') === 'true';
        const $container = document.getElementById('cuisine-pills');
        if (!$container) break;

        // Close all chips + panels (accordion)
        $container.querySelectorAll('.cuisine-chips__chip').forEach(chip => {
          chip.setAttribute('aria-selected', 'false');
          chip.classList.remove('cuisine-chips__chip--active');
        });
        $container.querySelectorAll('.cuisine-chips__panel').forEach(panel => {
          panel.classList.remove('cuisine-chips__panel--open');
          panel.setAttribute('aria-hidden', 'true');
        });

        // If wasn't selected, open this one
        if (!wasSelected) {
          btn.setAttribute('aria-selected', 'true');
          btn.classList.add('cuisine-chips__chip--active');
          const $panel = document.getElementById(`cuisine-panel-${idx}`);
          if ($panel) {
            $panel.setAttribute('aria-hidden', 'false');
            void $panel.offsetHeight; // reflow for transition
            $panel.classList.add('cuisine-chips__panel--open');
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

      /* ---- Header Feature Buttons (Taste DNA / Vibe Check) ---- */
      case 'header-taste-dna':
        if (!isAuthAuthenticated()) {
          showToast('Sign in to unlock your Taste DNA');
        } else {
          import('./taste-dna.js').then(function(m) { m.openTasteDnaModal(); });
        }
        break;
      case 'header-taste-blend':
        if (!isAuthAuthenticated()) {
          showToast('Sign in to check your group vibe');
        } else {
          import('./taste-dna.js').then(function(m) { m.openBlendModal(); });
        }
        break;

      /* ---- Taste DNA / Blend actions (from modals) ---- */
      case 'open-taste-dna':
        closeUserMenu();
        import('./taste-dna.js').then(function(m) { m.openTasteDnaModal(); });
        break;
      case 'open-taste-blend':
        closeUserMenu();
        import('./taste-dna.js').then(function(m) { m.openBlendModal(); });
        break;
      case 'close-taste-dna':
        import('./taste-dna.js').then(function(m) { m.closeTasteDnaModal(); });
        break;
      case 'close-taste-blend':
        import('./taste-dna.js').then(function(m) { m.closeBlendModal(); });
        break;
      case 'share-dna':
        import('./taste-dna.js').then(function(m) { m.shareTasteDna(); });
        break;
      case 'search-blend':
        import('./taste-dna.js').then(function(m) { m.closeBlendModal(); });
        break;

      case 'clear-filters': {
        setState({ occasion: 'Any', neighborhood: 'Anywhere', priceLevel: 'Any', openNow: false });
        clearAllSelections();
        document.querySelectorAll('.occasion-tile[aria-checked="true"]').forEach(t => t.setAttribute('aria-checked', 'false'));
        updateFilterSummary();
        clearEmptyState();
        showToast(toasts().filtersCleared);
        break;
      }

      case 'randomize': {
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

        const $btnText = btn.querySelector('.tell-more-btn__text');
        if ($btnText) {
          $btnText.classList.add('tell-more-btn__text--fading');
          setTimeout(() => {
            $btnText.textContent = isExpanded ? 'See Match Details' : 'Hide Details';
            $btnText.classList.remove('tell-more-btn__text--fading');
          }, 100);
        }

        const currentArrowTimer = getArrowBounceTimer();
        if (currentArrowTimer) { clearTimeout(currentArrowTimer); setArrowBounceTimer(null); }

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
          // Lazy-load Tier 2 content on first expand (P1-2: Lazy Tier 2 DOM)
          if (!isTier2Prepared() && getPendingResultData()) {
            setTier2Prepared(true);
            prepareTier2(getPendingResultData(), getPendingCuisine());
          }
          $tier2.style.willChange = 'max-height, opacity';
          requestAnimationFrame(() => {
            $tier2.style.maxHeight = $tier2.scrollHeight + 'px';
          });
          haptic(HAPTICS.tierExpand);
          // Delay score ring + factor bar animations until expand transition completes
          // so the spring fill is visible (not hidden behind max-height: 0)
          setTimeout(() => renderTier2Animations(), REDUCED_MOTION.matches ? 0 : 350);
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
            $scoreHero?.focus({ preventScroll: true });
          }, 300);
          announce('Showing match details');
        } else {
          haptic(HAPTICS.tick);
          // Reset animation state so re-expanding replays score ring + factor bars
          setTier2Animated(false);
          resetBloomState();
          $tier2.style.willChange = 'max-height, opacity';
          $tier2.style.maxHeight = $tier2.scrollHeight + 'px';
          void $tier2.offsetHeight;
          requestAnimationFrame(() => {
            $tier2.style.maxHeight = '0';
          });
        }
        break;
      }

      case 'toggle-factors':
      case 'show-vibe-profile': {
        break;
      }
    }
  });

  // Match Mini tap → toggle Tier 2
  document.getElementById('match-pill')?.addEventListener('click', () => {
    const $tellMore = document.getElementById('tell-more-btn');
    if ($tellMore) {
      $tellMore.click();
    }
    if ($tellMore && $tellMore.getAttribute('aria-expanded') === 'true') {
      setTimeout(() => {
        document.getElementById('score-hero')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }, 300);
    }
    haptic(HAPTICS.tick);
  });

  // Badge popout: click-outside
  document.addEventListener('click', (e) => {
    const popout = getActivePopout();
    if (popout && !popout.badge.contains(e.target)) {
      closeBadgePopout();
    }
  });

  // Badge popout: keyboard
  document.addEventListener('keydown', (e) => {
    if ((e.key === 'Enter' || e.key === ' ') && e.target.dataset?.action === 'toggle-badge-popout') {
      e.preventDefault();
      const isOpen = e.target.getAttribute('aria-expanded') === 'true';
      if (isOpen) closeBadgePopout();
      else openBadgePopout(e.target);
    }
    if (e.key === 'Escape') {
      const popout = getActivePopout();
      if (popout) {
        const badge = popout.badge;
        closeBadgePopout();
        badge.focus();
      }
    }
  });

  // Cuisine chips: arrow key navigation within tablist
  document.addEventListener('keydown', (e) => {
    if (e.target.dataset?.action !== 'toggle-cuisine-chip') return;
    if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
    e.preventDefault();
    const chips = Array.from(e.target.closest('.cuisine-chips__row')?.querySelectorAll('.cuisine-chips__chip') || []);
    const idx = chips.indexOf(e.target);
    if (idx < 0) return;
    const next = e.key === 'ArrowRight' ? (idx + 1) % chips.length : (idx - 1 + chips.length) % chips.length;
    chips[next]?.focus();
  });
}

/* ---- Wire Swipe Gestures ---- */
export function wireSwipe() {
  let startX = 0;
  let startY = 0;
  let startTime = 0;
  let isDragging = false;
  let isHorizontal = null;

  const COMPLETE_THRESHOLD = 80;
  const VELOCITY_THRESHOLD = 0.5;
  const DAMPING = 0.4;

  const $resultStep = document.querySelector('.step[data-step="1"]');

  $dom.main?.addEventListener('touchstart', (e) => {
    startX = e.touches[0].clientX;
    startY = e.touches[0].clientY;
    startTime = Date.now();
    isDragging = true;
    isHorizontal = null;
  }, { passive: true });

  $dom.main?.addEventListener('touchmove', (e) => {
    if (!isDragging || !$resultStep) return;
    if (getState().step !== 1) return;

    const dx = e.touches[0].clientX - startX;
    const dy = e.touches[0].clientY - startY;

    if (isHorizontal === null) {
      if (Math.abs(dx) < 10 && Math.abs(dy) < 10) return;
      isHorizontal = Math.abs(dx) > Math.abs(dy);
      if (!isHorizontal) return;
      if (REDUCED_MOTION.matches) return;
      $resultStep.classList.add('step--swiping');
    }

    if (!isHorizontal || REDUCED_MOTION.matches) return;

    const dampedDx = dx > 0 ? dx * DAMPING : dx * 0.1;
    $resultStep.style.transform = `translateX(${dampedDx}px)`;
  }, { passive: true });

  $dom.main?.addEventListener('touchend', (e) => {
    if (!isDragging) return;
    isDragging = false;

    const dx = e.changedTouches[0].clientX - startX;
    const dy = e.changedTouches[0].clientY - startY;
    const elapsed = Date.now() - startTime;
    const velocity = Math.abs(dx) / Math.max(elapsed, 1);

    if ($resultStep) {
      $resultStep.classList.remove('step--swiping');
      springAnimate($resultStep, { transform: 'translateX(0)' }, {
        spring: SPRINGS.snappy,
        duration: 300,
        easing: 'var(--spring)',
      });
    }

    if (isHorizontal === false) return;
    if (Math.abs(dx) < 30 || Math.abs(dy) > Math.abs(dx)) return;

    const { step } = getState();

    if (dx > 0 && step === 1 && (dx > COMPLETE_THRESHOLD || velocity > VELOCITY_THRESHOLD)) {
      haptic(HAPTICS.swipe);
      unfoldResultToCanvas();
      syncFilterPillsToState();
      revertAutoTheme();
    }

    if (dx < 0 && step === 1 && (Math.abs(dx) > COMPLETE_THRESHOLD || velocity > VELOCITY_THRESHOLD)) {
      haptic(HAPTICS.tick);
      const $tryAnother = document.querySelector('[data-action="try-again"]');
      if ($tryAnother && !$tryAnother.disabled) {
        $tryAnother.click();
      }
    }
  }, { passive: true });
}
