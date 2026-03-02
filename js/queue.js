/* ============================================
   DondeAI v11 — Ranked Queue & Feedback
   Try Another from pre-cached results.
   ============================================ */

import { getState, setState } from './state.js';
import { sendFeedback } from './api.js';
import { saveFeedback, getOrCreateUserId, loadFeedback } from './persistence.js';

const $ = (id) => document.getElementById(id);

/* ---- Initialize Queue from API Response ---- */
export function initQueue(apiData) {
  const queue = apiData.ranked_queue || [];
  setState({
    rankedQueue: queue,
    rankedQueueIndex: 0,
  });
  updateQueueDisplay();
}

/* ---- Get Next Item from Queue ---- */
export function getNextQueueItem() {
  const { rankedQueue, rankedQueueIndex } = getState();
  const nextIdx = rankedQueueIndex + 1;

  if (nextIdx < rankedQueue.length) {
    setState({ rankedQueueIndex: nextIdx });
    const item = rankedQueue[nextIdx];
    updateQueueDisplay();
    return item;
  }

  return null; // Queue exhausted
}

/* ---- Check if Queue Has More ---- */
export function hasMoreInQueue() {
  const { rankedQueue, rankedQueueIndex } = getState();
  return rankedQueueIndex + 1 < rankedQueue.length;
}

/* ---- Get Queue Position Text ---- */
export function getQueuePosition() {
  const { rankedQueue, rankedQueueIndex } = getState();
  const total = rankedQueue.length + 1; // +1 for primary result
  const current = rankedQueueIndex + 1; // 1-indexed
  return `${current} of ${total}`;
}

/* ---- Update Queue Display ---- */
function updateQueueDisplay() {
  const posEl = $('queue-pos');
  if (posEl) posEl.textContent = getQueuePosition();
}

/* ---- Add Current Result to Exclude List ---- */
export function excludeCurrentResult() {
  const { result, excludeIds } = getState();
  if (result?.restaurant?.id) {
    const newExcludes = [...excludeIds, result.restaurant.id];
    setState({ excludeIds: newExcludes });
  }
}

/* ---- Feedback ---- */
export function initFeedback() {
  const upBtn = $('feedback-up');
  const downBtn = $('feedback-down');

  if (upBtn) upBtn.addEventListener('click', () => handleFeedback('like'));
  if (downBtn) downBtn.addEventListener('click', () => handleFeedback('dislike'));
}

function handleFeedback(type) {
  const { result } = getState();
  if (!result?.restaurant?.id) return;

  const restaurantId = result.restaurant.id;
  const userId = getOrCreateUserId();
  const existing = loadFeedback(restaurantId);

  const upBtn = $('feedback-up');
  const downBtn = $('feedback-down');

  // Toggle off if same feedback
  if (existing === type) {
    saveFeedback(restaurantId, null);
    setState({ pendingFeedback: null });
    if (upBtn) upBtn.setAttribute('aria-pressed', 'false');
    if (downBtn) downBtn.setAttribute('aria-pressed', 'false');
    return;
  }

  // Save feedback
  saveFeedback(restaurantId, type);
  setState({ pendingFeedback: { restaurantId, feedback: type } });

  // Update UI
  if (upBtn) upBtn.setAttribute('aria-pressed', String(type === 'like'));
  if (downBtn) downBtn.setAttribute('aria-pressed', String(type === 'dislike'));

  // Send to backend (fire-and-forget)
  sendFeedback(restaurantId, type, userId);
}

/* ---- Restore Feedback State for Current Result ---- */
export function restoreFeedbackState() {
  const { result } = getState();
  if (!result?.restaurant?.id) return;

  const existing = loadFeedback(result.restaurant.id);
  const upBtn = $('feedback-up');
  const downBtn = $('feedback-down');

  if (upBtn) upBtn.setAttribute('aria-pressed', String(existing === 'like'));
  if (downBtn) downBtn.setAttribute('aria-pressed', String(existing === 'dislike'));
}

/* ---- Build Queue Item into Full Result Shape ---- */
export function normalizeQueueItem(item) {
  // Queue items have a slightly different shape — normalize to primary result format
  return {
    success: true,
    restaurant: item.restaurant || {},
    recommendation: item.recommendation || item.restaurant?.best_for_oneliner || '',
    insider_tip: item.insider_tip || null,
    donde_match: item.donde_match || 0,
    scoring: item.scoring || item.scoring_v7 || {},
    scoring_v7: item.scoring_v7 || item.scoring || {},
    match_narrative: item.match_narrative || null,
    deep_context: item.deep_context || item.restaurant || {},
    tags: item.tags || [],
    ranked_queue: [], // Sub-items don't have their own queue
  };
}
