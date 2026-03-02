/* ============================================
   DondeAI v11 — Phase State Machine
   Orchestrates: idle → loading → result/error
   Single surface, no routing.
   ============================================ */

import { getState, setState, subscribe, resetState } from './state.js';
import { fetchRecommendation } from './api.js';
import { initTheme, getLabels, CULTURES, setTheme, setWashOrigin, revertAutoTheme } from './theme.js';
import { loadTheme, loadSound, loadColorMode, loadHistory, addToHistory, getOrCreateUserId } from './persistence.js';
import { initInput, initSheets, renderHistory, updatePrompt, setInputValue, getActiveFilterBadges } from './input.js';
import { renderTier1, renderTier2, animateScore, clearResult } from './render.js';
import { initQueue, getNextQueueItem, hasMoreInQueue, initFeedback, excludeCurrentResult, normalizeQueueItem, restoreFeedbackState } from './queue.js';
import { getGreeting, getCuisineFromResult } from './utils.js';

const $ = (id) => document.getElementById(id);

/* ---- Boot ---- */
document.addEventListener('DOMContentLoaded', () => {
  // Load persisted state
  const savedTheme = loadTheme();
  const savedSound = loadSound();
  const savedColorMode = loadColorMode();
  const savedHistory = loadHistory();

  setState({
    theme: savedTheme,
    soundEnabled: savedSound,
    colorMode: savedColorMode,
    history: savedHistory,
  });

  // Init modules
  initTheme();
  initInput();
  initSheets();
  initFeedback();
  initKeyboard();
  initOffline();

  // Set greeting
  updatePrompt(savedTheme.culture);

  // Listen for phase changes
  subscribe(onStateChange);

  // Event listeners
  bindActions();
});

/* ---- State Change Handler ---- */
function onStateChange(state, prev) {
  // Phase transition
  if (state.phase !== prev.phase) {
    applyPhase(state.phase, prev.phase);
  }
}

/* ---- Apply Phase to DOM ---- */
function applyPhase(phase) {
  const surface = $('surface');
  if (!surface) return;

  surface.setAttribute('data-phase', phase);

  const announce = $('announce');

  switch (phase) {
    case 'idle':
      showIdleUI();
      if (announce) announce.textContent = 'Ready to search.';
      break;
    case 'loading':
      showLoadingUI();
      if (announce) announce.textContent = 'Searching for your spot...';
      break;
    case 'result':
      showResultUI();
      if (announce) announce.textContent = 'Result found.';
      break;
    case 'error':
      showErrorUI();
      if (announce) announce.textContent = 'An error occurred.';
      break;
  }
}

/* ---- Phase: Idle ---- */
function showIdleUI() {
  // Focus input and clear it
  const input = $('craving-input');
  if (input) {
    input.value = '';
    requestAnimationFrame(() => input.focus());
  }

  // Reset submit/voice button visibility (JS-toggled within idle phase)
  const submitBtn = $('submit-btn');
  const voiceBtn = $('voice-btn');
  if (submitBtn) submitBtn.hidden = true;
  if (voiceBtn) voiceBtn.hidden = false;

  // Refresh history
  renderHistory();

  // Scroll to top
  window.scrollTo(0, 0);
}

/* ---- Phase: Loading ---- */
function showLoadingUI() {
  const { craving } = getState();

  // Update collapsed query
  const queryText = $('query-text');
  const activeFilters = $('active-filters');
  if (queryText) queryText.textContent = craving;
  if (activeFilters) activeFilters.innerHTML = getActiveFilterBadges();

  // Set themed loading text
  const { theme } = getState();
  const labels = getLabels(theme.culture);
  const loadingText = $('loading-text');
  if (loadingText && labels.loadingPhrases) {
    const phrase = labels.loadingPhrases[Math.floor(Math.random() * labels.loadingPhrases.length)];
    loadingText.textContent = `${phrase}...`;
  }

  // Scroll to top
  window.scrollTo(0, 0);
}

/* ---- Phase: Result ---- */
function showResultUI() {
  const { result } = getState();
  if (!result) return;

  // Clear previous
  clearResult();

  // Render card
  renderTier1(result);
  renderTier2(result);

  // Restore feedback state
  restoreFeedbackState();

  // Score count-up (delayed slightly for visual rhythm)
  const score = Math.round(result.donde_match || 0);
  setTimeout(() => animateScore(score), 200);

  // Scroll to top
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

/* ---- Phase: Error ---- */
function showErrorUI() {
  const { error } = getState();
  const errorText = $('error-text');
  if (errorText) errorText.textContent = error || 'Something went wrong. Please try again.';
}

/* ---- Search Flow ---- */
async function performSearch() {
  const { craving, filters, pendingFeedback, excludeIds } = getState();
  if (!craving.trim()) return;

  // Transition to loading
  setState({ phase: 'loading', error: null });

  try {
    const userId = getOrCreateUserId();
    const data = await fetchRecommendation({
      special_request: craving,
      occasion: filters.occasion !== 'Any' ? filters.occasion : undefined,
      neighborhood: filters.neighborhood !== 'Anywhere' ? filters.neighborhood : undefined,
      price_level: filters.priceLevel !== 'Any' ? filters.priceLevel : undefined,
      dietary_restrictions: filters.dietaryRestrictions.length ? filters.dietaryRestrictions : undefined,
      open_now: filters.openNow || undefined,
      exclude: excludeIds.length ? excludeIds : undefined,
      user_id: userId,
      feedback: pendingFeedback ? pendingFeedback : undefined,
    });

    // Save to history
    const score = Math.round(data.donde_match || 0);
    addToHistory(craving, {
      special_request: craving,
      occasion: filters.occasion,
      neighborhood: filters.neighborhood,
      price_level: filters.priceLevel,
    }, 'plate');
    // Patch the last history entry with score
    const hist = loadHistory();
    if (hist[0]) hist[0].score = score;
    try { localStorage.setItem('dondeai-history', JSON.stringify(hist)); } catch { /* ok */ }

    // Auto-theme from result cuisine
    const cuisineInfo = getCuisineFromResult(data);
    if (cuisineInfo.culture) {
      revertAutoTheme();
    }

    // Initialize queue
    initQueue(data);

    // Set result
    setState({
      result: data,
      phase: 'result',
      pendingFeedback: null,
    });

  } catch (err) {
    setState({
      phase: 'error',
      error: err.message || 'Something went wrong.',
    });
  }
}

/* ---- Try Another ---- */
async function tryAnother() {
  const resultEl = $('result');

  if (hasMoreInQueue()) {
    // Animate out
    if (resultEl) {
      resultEl.classList.add('card-swap-out');
      await new Promise(r => setTimeout(r, 300));
      resultEl.classList.remove('card-swap-out');
    }

    // Get next from queue
    const item = getNextQueueItem();
    if (item) {
      const normalized = normalizeQueueItem(item);
      excludeCurrentResult();
      setState({ result: normalized });

      // Re-render
      clearResult();
      renderTier1(normalized);
      renderTier2(normalized);
      restoreFeedbackState();

      // Animate in
      if (resultEl) resultEl.classList.add('card-swap-in');
      setTimeout(() => {
        if (resultEl) resultEl.classList.remove('card-swap-in');
      }, 300);

      // Score count-up
      const score = Math.round(normalized.donde_match || 0);
      setTimeout(() => animateScore(score), 200);
    }
  } else {
    // Queue exhausted — new API call with excludes
    excludeCurrentResult();
    await performSearch();
  }
}

/* ---- Go Back (✕ / Start Over) ---- */
function goBack() {
  revertAutoTheme();
  resetState();
}

/* ---- Retry (Error state) ---- */
function retry() {
  performSearch();
}

/* ---- Re-search from History ---- */
function reSearch(craving, payload) {
  setInputValue(craving);
  setState({ craving });

  // Restore filters from payload if available
  if (payload) {
    const filterPatch = {};
    if (payload.occasion) filterPatch.occasion = payload.occasion;
    if (payload.neighborhood) filterPatch.neighborhood = payload.neighborhood;
    if (payload.price_level) filterPatch.priceLevel = payload.price_level;
    if (Object.keys(filterPatch).length) {
      setState({ filters: filterPatch });
    }
  }

  performSearch();
}

/* ---- Bind Action Events (delegation) ---- */
function bindActions() {
  // Search event from input.js
  document.addEventListener('donde:search', () => performSearch());

  // Submit button
  const submitBtn = $('submit-btn');
  if (submitBtn) submitBtn.addEventListener('click', () => performSearch());

  // Close / Start Over
  const closeBtn = $('close-btn');
  if (closeBtn) closeBtn.addEventListener('click', goBack);

  const startOverBtn = $('start-over-btn');
  if (startOverBtn) startOverBtn.addEventListener('click', goBack);

  // Try Another
  const tryAnotherBtn = $('cta-try-another');
  if (tryAnotherBtn) tryAnotherBtn.addEventListener('click', tryAnother);

  // Retry (error state)
  const retryBtn = $('retry-btn');
  if (retryBtn) retryBtn.addEventListener('click', retry);

  // History click delegation
  document.addEventListener('click', (e) => {
    const histItem = e.target.closest('[data-action="re-search"]');
    if (histItem) {
      const craving = histItem.dataset.craving;
      let payload = null;
      try { payload = JSON.parse(histItem.dataset.payload); } catch { /* ok */ }
      reSearch(craving, payload);
    }
  });

  // Theme toggle
  const themeToggle = $('theme-toggle');
  if (themeToggle) {
    themeToggle.addEventListener('click', (e) => {
      const { theme } = getState();
      const idx = CULTURES.indexOf(theme.culture);
      const next = CULTURES[(idx + 1) % CULTURES.length];

      // Set wash origin from button position
      const rect = themeToggle.getBoundingClientRect();
      setWashOrigin(rect.left + rect.width / 2, rect.top + rect.height / 2);

      setTheme(next, theme.mode);
      updatePrompt(next);
    });

    // Long-press for dark/light toggle
    let pressTimer = null;
    themeToggle.addEventListener('pointerdown', () => {
      pressTimer = setTimeout(() => {
        const { theme } = getState();
        const newMode = theme.mode === 'light' ? 'dark' : 'light';
        setTheme(theme.culture, newMode);
      }, 500);
    });
    themeToggle.addEventListener('pointerup', () => clearTimeout(pressTimer));
    themeToggle.addEventListener('pointerleave', () => clearTimeout(pressTimer));
  }

  // Voice button
  const voiceBtn = $('voice-btn');
  if (voiceBtn) {
    voiceBtn.addEventListener('click', async () => {
      try {
        const voice = await import('./voice.js');
        voice.startVoice();
      } catch { /* voice not supported */ }
    });
  }

  // Share button (delegated since it's rendered dynamically)
  document.addEventListener('click', async (e) => {
    if (e.target.closest('#share-btn')) {
      const { result } = getState();
      if (result) shareNative(result);
    }
  });
}

/* ---- Native Share ---- */
function shareNative(result) {
  if (!result?.restaurant) return;
  const r = result.restaurant;
  const text = [
    r.name,
    result.recommendation || '',
    r.address || '',
    '\u2014 via Donde',
  ].filter(Boolean).join('\n');

  if (navigator.share) {
    navigator.share({ title: r.name, text }).catch(() => {});
  } else {
    navigator.clipboard?.writeText(text).catch(() => {});
  }
}

/* ---- Keyboard Shortcuts ---- */
function initKeyboard() {
  document.addEventListener('keydown', (e) => {
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;

    const { phase } = getState();

    switch (e.key) {
      case '/':
        e.preventDefault();
        $('craving-input')?.focus();
        break;
      case 'Escape':
        if (phase === 'result' || phase === 'error' || phase === 'loading') {
          goBack();
        }
        document.querySelectorAll('.sheet:not([hidden])').forEach(s => s.hidden = true);
        break;
      case 't':
      case 'T':
        if (phase === 'idle') {
          $('theme-toggle')?.click();
        }
        break;
      case 'r':
      case 'R':
        if (phase === 'result') {
          tryAnother();
        } else if (phase === 'error') {
          retry();
        }
        break;
      case 'f':
      case 'F':
        if (phase === 'idle') {
          $('filters-toggle')?.click();
        }
        break;
    }
  });
}

/* ---- Offline Detection ---- */
function initOffline() {
  const banner = $('offline-banner');
  if (!banner) return;

  const update = () => {
    banner.hidden = navigator.onLine;
  };

  window.addEventListener('online', update);
  window.addEventListener('offline', update);
  update();
}
