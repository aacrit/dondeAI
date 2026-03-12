/* ============================================
   DondeLite — Slim App Orchestrator
   "Just Ask" — craving in, perfect spot out.
   ============================================ */

import { getState, setState, subscribe, resetState } from '../../js/state.js';
import { fetchRecommendation, fetchBlurb, sendVisit } from '../../js/api.js';
import { getOrCreateUserId, addToHistory, loadHistory, addBookmark, addVisit, isBookmarked, isVisited, loadTheme, saveTheme, loadColorMode, saveColorMode } from '../../js/persistence.js';
import { initAuth, isAuthenticated, addVisitToServer } from '../../js/auth.js';
import { isOnline, initOffline } from '../../js/offline.js';

/* ---- Cached DOM ---- */
const $ = (sel) => document.querySelector(sel);
const $id = (id) => document.getElementById(id);

const $input = $id('craving-input');
const $submitBtn = $('.input-wrap__submit');
const $suggestions = $id('suggestions');
const $recents = $id('recents');
const $recentsList = $id('recents-list');
const $filterSheet = $id('filter-sheet');
const $backdrop = $id('sheet-backdrop');
const $resultSheet = $id('result-sheet');
const $resultLoading = $id('result-loading');
const $resultContent = $id('result-content');
const $toast = $id('toast');
const $toastMsg = $id('toast-msg');
const $announce = $id('sr-announce');

/* ---- Surprise Me Prompts ---- */
const SURPRISE_PROMPTS = [
  'something spicy and adventurous',
  'cozy comfort food for a rainy day',
  'the best-kept secret in Chicago',
  'a lively spot with great cocktails',
  'incredible pasta you can\'t stop thinking about',
  'a hidden gem with amazing vibes',
  'street food but elevated',
  'something I\'ve never tried before',
];

/* ---- Culture Detection (simplified) ---- */
const CULTURE_MAP = [
  { pattern: /\b(sushi|ramen|udon|soba|izakaya|yakitori|japanese|teriyaki|tempura|sake|matcha|omakase|kaiseki|wagyu|katsu)\b/i, culture: 'japanese' },
  { pattern: /\b(curry|tikka|masala|naan|biryani|dosa|tandoori|chaat|paneer|samosa|dal|indian|desi|punjabi|chai)\b/i, culture: 'indian' },
  { pattern: /\b(shawarma|falafel|hummus|kebab|tahini|baklava|pita|gyro|lebanese|turkish|persian|moroccan|mediterranean|middle eastern)\b/i, culture: 'middleeastern' },
  { pattern: /\b(taco|burrito|empanada|ceviche|arepa|pupusa|mole|churro|tamale|mexican|brazilian|peruvian|colombian|argentinian|latin|caribbean)\b/i, culture: 'southamerican' },
];

function detectCulture(text) {
  if (!text) return 'neutral';
  for (const { pattern, culture } of CULTURE_MAP) {
    if (pattern.test(text)) return culture;
  }
  return 'neutral';
}

/* ---- Time-based context ---- */
function getTimeContext() {
  const h = new Date().getHours();
  const day = new Date().getDay();
  const isWeekend = day === 0 || day === 6;

  let occasion = 'Any';
  if (h >= 6 && h < 11) occasion = 'Breakfast/Brunch';
  else if (h >= 11 && h < 15) occasion = isWeekend ? 'Casual' : 'Business Lunch';
  else if (h >= 17 && h < 21) occasion = isWeekend ? 'Date Night' : 'Dinner';
  else if (h >= 21) occasion = 'Late Night';

  return occasion;
}

/* ---- Smart Suggestions (context-aware) ---- */
const SUGGESTIONS_BY_TIME = {
  morning: ['best brunch spot', 'coffee and pastries', 'breakfast burritos'],
  lunch: ['quick lunch nearby', 'healthy bowl', 'best sandwich in town'],
  afternoon: ['afternoon coffee', 'happy hour cocktails', 'late lunch spot'],
  evening: ['date night Italian', 'group dinner spot', 'upscale tasting menu'],
  latenight: ['late night tacos', 'best pizza open now', 'ramen at midnight'],
};

function getTimePeriod() {
  const h = new Date().getHours();
  if (h >= 6 && h < 11) return 'morning';
  if (h >= 11 && h < 14) return 'lunch';
  if (h >= 14 && h < 17) return 'afternoon';
  if (h >= 17 && h < 22) return 'evening';
  return 'latenight';
}

function renderSuggestions() {
  const period = getTimePeriod();
  const items = SUGGESTIONS_BY_TIME[period] || SUGGESTIONS_BY_TIME.evening;
  const chips = $suggestions.querySelectorAll('.chip');
  chips.forEach((chip, i) => {
    if (items[i]) chip.textContent = items[i];
  });
}

/* ---- Recents ---- */
function renderRecents() {
  const history = loadHistory();
  if (!history.length) {
    $recents.hidden = true;
    return;
  }
  $recents.hidden = false;
  $recentsList.innerHTML = history.slice(0, 3).map(h =>
    `<button class="recent-chip" data-action="recent" data-craving="${h.label}">${h.label}</button>`
  ).join('');
}

/* ---- Theme ---- */
function initTheme() {
  const theme = loadTheme();
  const colorMode = loadColorMode();

  // Apply mode
  const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
  const mode = theme.mode || (prefersDark ? 'dark' : 'light');
  document.documentElement.setAttribute('data-mode', mode);
  document.documentElement.setAttribute('data-culture', 'neutral');

  setState({ theme: { culture: 'neutral', mode }, colorMode });

  // Listen for OS preference changes
  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', (e) => {
    if (loadColorMode() === 'auto') {
      const newMode = e.matches ? 'dark' : 'light';
      document.documentElement.setAttribute('data-mode', newMode);
      setState({ theme: { ...getState().theme, mode: newMode } });
    }
  });
}

function toggleMode() {
  const { theme } = getState();
  const newMode = theme.mode === 'dark' ? 'light' : 'dark';
  document.documentElement.setAttribute('data-mode', newMode);
  const newTheme = { ...theme, mode: newMode };
  setState({ theme: newTheme });
  saveTheme(newTheme);
  saveColorMode('manual');
}

function applyCulture(culture) {
  const current = document.documentElement.getAttribute('data-culture');
  if (current !== culture) {
    document.documentElement.setAttribute('data-culture', culture);
    setState({ theme: { ...getState().theme, culture } });
  }
}

/* ---- Toast ---- */
let _toastTimer = null;
function showToast(msg, duration = 3000) {
  $toastMsg.textContent = msg;
  $toast.hidden = false;
  requestAnimationFrame(() => $toast.classList.add('visible'));
  clearTimeout(_toastTimer);
  _toastTimer = setTimeout(() => {
    $toast.classList.remove('visible');
    setTimeout(() => { $toast.hidden = true; }, 200);
  }, duration);
}

/* ---- Announce (screen reader) ---- */
function announce(msg) {
  $announce.textContent = msg;
}

/* ---- Submit ---- */
async function handleSubmit() {
  const craving = $input.value.trim();
  if (!craving) {
    $input.focus();
    return;
  }

  if (!isOnline()) {
    showToast("You're offline. Check your connection.");
    return;
  }

  // Auto-detect culture from craving
  const culture = detectCulture(craving);
  applyCulture(culture);

  // Auto-detect occasion
  const occasion = getTimeContext();

  const { neighborhood, priceLevel, dietaryRestrictions, excludeIds } = getState();
  const userId = getOrCreateUserId();

  // Show result sheet with loading
  showResultSheet(true);
  setState({ loading: true, error: null });
  announce('Finding your spot...');

  try {
    // Map budget for API
    let apiPrice = priceLevel;
    if (apiPrice === '$$$+') apiPrice = '$$$';

    const data = await fetchRecommendation({
      special_request: craving,
      occasion,
      neighborhood: neighborhood === 'Anywhere' ? undefined : neighborhood,
      price_level: apiPrice === 'Any' ? undefined : apiPrice,
      exclude: excludeIds.length ? excludeIds : undefined,
      dietary_restrictions: dietaryRestrictions.length ? dietaryRestrictions : undefined,
      user_id: userId,
    });

    // Store ranked queue
    if (data.ranked_queue?.length) {
      setState({
        rankedQueue: data.ranked_queue,
        rankedQueueIndex: 0,
      });
    }

    // Add to history
    addToHistory(craving, { special_request: craving, occasion, neighborhood, price_level: priceLevel });
    renderRecents();

    // Show result
    setState({ result: data, loading: false });
    renderResult(data);
    announce(`Found: ${data.restaurant?.name || 'a restaurant'}`);

  } catch (err) {
    setState({ loading: false, error: err.message });
    hideResultSheet();
    showToast(err.message || 'Something went wrong. Try again.');
  }
}

/* ---- Try Again / Skip ---- */
async function handleSkip() {
  const { result, rankedQueue, rankedQueueIndex, excludeIds } = getState();

  // Add current restaurant to excludes
  const newExcludes = [...excludeIds];
  if (result?.restaurant?.id) {
    newExcludes.push(result.restaurant.id);
  }
  setState({ excludeIds: newExcludes });

  // Check ranked queue
  const nextIndex = rankedQueueIndex + 1;
  if (rankedQueue.length && nextIndex <= rankedQueue.length) {
    const nextItem = rankedQueue[nextIndex - 1];
    if (nextItem) {
      setState({ rankedQueueIndex: nextIndex });

      // Build result-like object from queue item
      const queueResult = {
        restaurant: nextItem.restaurant,
        recommendation: nextItem.recommendation || result?.recommendation,
        insider_tip: nextItem.insider_tip || null,
        donde_match: nextItem.donde_match,
        scoring: nextItem.scoring || nextItem.scoring_v9,
        match_narrative: nextItem.match_narrative,
        tags: nextItem.tags || [],
        ranked_queue: rankedQueue,
      };

      setState({ result: queueResult });
      renderResult(queueResult);
      announce(`Next: ${nextItem.restaurant?.name || 'another spot'}`);

      // Fetch fresh blurb in background
      fetchBlurb({
        restaurant_data: nextItem.restaurant,
        context: { craving: $input.value.trim() },
      }).then(blurbData => {
        if (blurbData?.recommendation) {
          const $blurb = $id('result-blurb');
          if ($blurb) $blurb.textContent = blurbData.recommendation;
        }
      }).catch(() => {});

      return;
    }
  }

  // Queue exhausted — new API call
  if (newExcludes.length >= 15) {
    showToast("You've seen all our top picks. Try different cravings!");
    return;
  }

  await handleSubmit();
}

/* ---- Go Here ---- */
function handleGoing() {
  const { result } = getState();
  if (!result?.restaurant) return;

  addVisit(result.restaurant);
  const userId = getOrCreateUserId();
  sendVisit(result.restaurant, userId);

  if (isAuthenticated()) {
    addVisitToServer(result.restaurant);
  }

  showToast("Noted! Enjoy your meal.");
  announce("Marked as going");

  // Update button state
  const $btn = $id('btn-going');
  if ($btn) {
    $btn.textContent = 'Going!';
    $btn.disabled = true;
  }
}

/* ---- Result Sheet ---- */
function showResultSheet(loading = false) {
  $resultSheet.hidden = false;
  $backdrop.hidden = false;
  $resultLoading.hidden = !loading;
  $resultContent.hidden = loading;

  requestAnimationFrame(() => {
    $backdrop.classList.add('visible');
    $resultSheet.classList.add('visible');
  });
}

function hideResultSheet() {
  $resultSheet.classList.remove('visible');
  $backdrop.classList.remove('visible');

  setTimeout(() => {
    $resultSheet.hidden = true;
    $backdrop.hidden = true;
    $resultLoading.hidden = true;
    $resultContent.hidden = true;
  }, 200);
}

/* ---- Render Result ---- */
function renderResult(data) {
  $resultLoading.hidden = true;
  $resultContent.hidden = false;

  const r = data.restaurant || {};
  const score = data.donde_match ?? 0;

  // Photo
  const $img = $id('result-img');
  const $photo = $id('result-photo');
  if (r.photo_urls?.length) {
    $img.src = r.photo_urls[0];
    $img.alt = r.name || 'Restaurant photo';
    $photo.hidden = false;
  } else if (r.photo_url) {
    $img.src = r.photo_url;
    $img.alt = r.name || 'Restaurant photo';
    $photo.hidden = false;
  } else {
    $photo.hidden = true;
  }

  // Name + cuisine
  $id('result-name').textContent = r.name || 'Unknown';
  $id('result-cuisine').textContent = r.cuisine_type || '';

  // Score with RAG
  const $score = $id('result-score');
  const $scoreNum = $id('result-score-number');
  $scoreNum.textContent = score;
  const rag = score >= 80 ? 'green' : score >= 60 ? 'amber' : 'red';
  $score.setAttribute('data-rag', rag);

  // Blurb
  const $blurb = $id('result-blurb');
  $blurb.textContent = data.recommendation || '';
  $blurb.classList.remove('expanded');
  $blurb.onclick = () => $blurb.classList.toggle('expanded');

  // Meta
  $id('result-price').textContent = r.price_level || '';
  $id('result-neighborhood').textContent = r.neighborhood_name || '';

  const $status = $id('result-status');
  if (r.is_open !== undefined) {
    $status.textContent = r.is_open ? 'Open now' : 'Closed';
    $status.setAttribute('data-open', String(r.is_open));
    $status.hidden = false;
  } else {
    $status.hidden = true;
  }

  // Action links
  const $directions = $id('action-directions');
  if (r.google_place_id) {
    $directions.href = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(r.name)}&query_place_id=${r.google_place_id}`;
    $directions.hidden = false;
  } else if (r.address || r.formatted_address) {
    $directions.href = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(r.address || r.formatted_address)}`;
    $directions.hidden = false;
  } else {
    $directions.hidden = true;
  }

  const $call = $id('action-call');
  if (r.phone || r.formatted_phone_number) {
    $call.href = `tel:${r.phone || r.formatted_phone_number}`;
    $call.hidden = false;
  } else {
    $call.hidden = true;
  }

  // Strengths (from match_narrative)
  const $strengths = $id('result-strengths');
  const signals = data.match_narrative?.key_signals || data.tags || [];
  if (signals.length) {
    $strengths.innerHTML = signals.slice(0, 4).map(s =>
      `<span class="strength-tag">${s}</span>`
    ).join('');
    $strengths.hidden = false;
  } else {
    $strengths.hidden = true;
  }

  // Insider tip
  const $tip = $id('result-tip');
  const $tipText = $id('result-tip-text');
  if (data.insider_tip) {
    $tipText.textContent = data.insider_tip;
    $tip.hidden = false;
  } else {
    $tip.hidden = true;
  }

  // Google rating
  const $google = $id('result-google');
  if (r.google_rating) {
    $id('result-google-stars').textContent = '★'.repeat(Math.round(r.google_rating)) + ` ${r.google_rating}`;
    $id('result-google-count').textContent = r.google_review_count ? ` (${r.google_review_count} reviews)` : '';
    $google.hidden = false;
  } else {
    $google.hidden = true;
  }

  // Reset going button
  const $btn = $id('btn-going');
  $btn.textContent = isVisited(r.id) ? 'Going!' : 'Go Here';
  $btn.disabled = isVisited(r.id);
}

/* ---- Filters ---- */
let _filtersState = { neighborhood: 'Anywhere', budget: 'Any', dietary: [] };

function openFilters() {
  $filterSheet.showModal();
}

function closeFilters() {
  $filterSheet.close();
  // Sync filter state
  setState({
    neighborhood: _filtersState.neighborhood,
    priceLevel: _filtersState.budget,
    dietaryRestrictions: [..._filtersState.dietary],
  });
  // Update filter button badge
  const hasFilters = _filtersState.neighborhood !== 'Anywhere' ||
    _filtersState.budget !== 'Any' ||
    _filtersState.dietary.length > 0;
  $('.filter-btn').classList.toggle('has-filters', hasFilters);
}

function selectNeighborhood(value) {
  _filtersState.neighborhood = value;
  $filterSheet.querySelectorAll('[data-action="select-neighborhood"]').forEach(btn => {
    btn.classList.toggle('pill--active', btn.dataset.value === value);
  });
}

function selectBudget(value) {
  _filtersState.budget = value;
  $filterSheet.querySelectorAll('[data-action="select-budget"]').forEach(btn => {
    btn.classList.toggle('pill--active', btn.dataset.value === value);
  });
}

function toggleDietary(value) {
  const idx = _filtersState.dietary.indexOf(value);
  if (idx >= 0) {
    _filtersState.dietary.splice(idx, 1);
  } else {
    _filtersState.dietary.push(value);
  }
  $filterSheet.querySelectorAll('[data-action="toggle-dietary"]').forEach(btn => {
    btn.classList.toggle('pill--active', _filtersState.dietary.includes(btn.dataset.value));
  });
}

function clearFilters() {
  _filtersState = { neighborhood: 'Anywhere', budget: 'Any', dietary: [] };
  selectNeighborhood('Anywhere');
  selectBudget('Any');
  $filterSheet.querySelectorAll('[data-action="toggle-dietary"]').forEach(btn => {
    btn.classList.remove('pill--active');
  });
}

/* ---- Share (native Web Share API) ---- */
async function handleShare() {
  const { result } = getState();
  if (!result?.restaurant) return;

  const r = result.restaurant;
  const shareData = {
    title: `${r.name} — DondeLite`,
    text: `Check out ${r.name}! ${result.recommendation || ''}`.slice(0, 200),
    url: r.google_place_id
      ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(r.name)}&query_place_id=${r.google_place_id}`
      : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(r.name + ' Chicago')}`,
  };

  if (navigator.share) {
    try {
      await navigator.share(shareData);
    } catch { /* user cancelled */ }
  } else {
    // Fallback: copy to clipboard
    try {
      await navigator.clipboard.writeText(`${r.name} — ${shareData.url}`);
      showToast('Link copied!');
    } catch {
      showToast('Could not share');
    }
  }
}

/* ---- Event Delegation ---- */
document.addEventListener('click', (e) => {
  const btn = e.target.closest('[data-action]');
  if (!btn) return;

  const action = btn.dataset.action;

  switch (action) {
    case 'submit':
      handleSubmit();
      break;

    case 'surprise-me': {
      const prompt = SURPRISE_PROMPTS[Math.floor(Math.random() * SURPRISE_PROMPTS.length)];
      $input.value = prompt;
      updateSubmitBtn();
      handleSubmit();
      break;
    }

    case 'suggestion':
      $input.value = btn.textContent;
      updateSubmitBtn();
      handleSubmit();
      break;

    case 'recent':
      $input.value = btn.dataset.craving;
      updateSubmitBtn();
      handleSubmit();
      break;

    case 'toggle-filters':
      openFilters();
      break;

    case 'close-filters':
      closeFilters();
      break;

    case 'select-neighborhood':
      selectNeighborhood(btn.dataset.value);
      break;

    case 'select-budget':
      selectBudget(btn.dataset.value);
      break;

    case 'toggle-dietary':
      toggleDietary(btn.dataset.value);
      break;

    case 'clear-filters':
      clearFilters();
      break;

    case 'toggle-mode':
      toggleMode();
      break;

    case 'going':
      handleGoing();
      break;

    case 'skip':
      handleSkip();
      break;

    case 'share':
      handleShare();
      break;
  }
});

/* ---- Backdrop click to dismiss ---- */
$backdrop.addEventListener('click', () => {
  hideResultSheet();
});

/* ---- Input handling ---- */
function updateSubmitBtn() {
  const hasInput = $input.value.trim().length > 0;
  $submitBtn.classList.toggle('active', hasInput);
}

$input.addEventListener('input', () => {
  updateSubmitBtn();

  // Auto-detect culture as user types (debounced)
  clearTimeout($input._cultureTimer);
  $input._cultureTimer = setTimeout(() => {
    const culture = detectCulture($input.value);
    applyCulture(culture);
  }, 500);
});

$input.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault();
    if ($input.value.trim()) handleSubmit();
  }
});

/* ---- Header scroll border ---- */
let _scrollObs = null;
function initHeaderScroll() {
  const $title = $('.canvas__title');
  const $header = $('.header');
  if (!$title || !$header || !('IntersectionObserver' in window)) return;

  _scrollObs = new IntersectionObserver(([e]) => {
    $header.classList.toggle('header--scrolled', !e.isIntersecting);
  }, { threshold: 0 });
  _scrollObs.observe($title);
}

/* ---- Swipe-to-dismiss result sheet ---- */
function initSwipeDismiss() {
  let startY = 0;
  let currentY = 0;
  let isDragging = false;

  $resultSheet.addEventListener('touchstart', (e) => {
    // Only start drag from the handle or top area
    const rect = $resultSheet.getBoundingClientRect();
    if (e.touches[0].clientY - rect.top > 40) return;
    startY = e.touches[0].clientY;
    isDragging = true;
    $resultSheet.style.transition = 'none';
  }, { passive: true });

  $resultSheet.addEventListener('touchmove', (e) => {
    if (!isDragging) return;
    currentY = e.touches[0].clientY;
    const diff = currentY - startY;
    if (diff > 0) {
      $resultSheet.style.transform = `translateY(${diff}px)`;
    }
  }, { passive: true });

  $resultSheet.addEventListener('touchend', () => {
    if (!isDragging) return;
    isDragging = false;
    $resultSheet.style.transition = '';

    const diff = currentY - startY;
    if (diff > 100) {
      hideResultSheet();
    } else {
      $resultSheet.style.transform = '';
      $resultSheet.classList.add('visible');
    }
  });
}

/* ---- Keyboard shortcuts ---- */
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    if (!$resultSheet.hidden) {
      hideResultSheet();
    } else if ($filterSheet.open) {
      closeFilters();
    }
  }
});

/* ---- Init ---- */
function init() {
  initTheme();
  initOffline();
  initAuth();
  renderSuggestions();
  renderRecents();
  initHeaderScroll();
  initSwipeDismiss();
  getOrCreateUserId();
  updateSubmitBtn();

  // Focus input on load
  requestAnimationFrame(() => $input.focus({ preventScroll: true }));
}

init();
