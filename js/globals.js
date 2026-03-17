/* ============================================
   DondeAI — Shared Globals
   DOM refs, haptics, utilities shared across modules.
   ============================================ */

/* ---- Cached DOM Elements ---- */
export const $dom = {
  app: null,
  main: null,
  cravingInput: null,
  resultCard: null,
  toast: null,
  toastText: null,
  cursorGlow: null,
  suggestions: null,
};

/** Initialize cached DOM references. Call once at boot. */
export function initDomRefs() {
  $dom.app = document.querySelector('.app');
  $dom.main = document.querySelector('.cockpit');
  $dom.cravingInput = document.getElementById('craving-input');
  $dom.resultCard = document.getElementById('result-card');
  $dom.toast = document.getElementById('toast');
  $dom.toastText = document.getElementById('toast-text');
  $dom.cursorGlow = document.querySelector('.cursor-glow');
  $dom.suggestions = document.getElementById('craving-suggestions');
}

/* ---- HTML Escape (for safe innerHTML insertion) ---- */
export function escHtml(s) {
  const d = document.createElement('div');
  d.textContent = s;
  return d.innerHTML;
}
export { escHtml as _escHtml }; // backward compat alias

/* ---- Haptic Feedback Library ---- */
let _userGestureSeen = false;
function _trackGesture() { _userGestureSeen = true; }
if (typeof document !== 'undefined') {
  document.addEventListener('pointerdown', _trackGesture, { once: true, passive: true });
  document.addEventListener('keydown', _trackGesture, { once: true, passive: true });
}
export function haptic(pattern) {
  if (_userGestureSeen && navigator.vibrate) navigator.vibrate(pattern);
}

export const HAPTICS = {
  tick:        [10],                   // feedback tap, filter select
  doublePulse: [30, 20, 30],           // bookmark save
  reveal:      [50, 30, 50],           // result reveal
  celebration: [50, 30, 80, 30, 50],   // 90%+ score
  swipe:       [40],                   // swipe completion
  factorTap:   [15, 10, 15],           // V9: double-tap feel on factor expand
  signalPop:   [8],                    // V9: micro-tick on signal pill appear
  photoSwipe:  [20],                   // V9.1: photo scroll start
  scoreReveal: [50, 30, 50],           // V9.1: tier 2 score hero appears
  goingHere:   [50, 30, 80, 30, 50],   // V9.1: "I'm Going Here" celebration
  drawerOpen:  [15],                   // V9.1: drawer/sheet opens
  tierExpand:  [30, 15, 30],           // V9.1: show more tap
  peekPulse:   [15],                   // V9.1: tier 2 peek affordance
  spectacle:   [10, 30, 10, 30, 10, 80, 15, 15, 15], // V11: tier 4 celebration
  nameReveal:  [5, 50, 8],            // V11: restaurant name entrance
  tierPop:     [8, 20, 12],           // V11: tier expand pop
  photoSnap:   [3],                   // V11: photo lightbox snap
  /* Premium UI haptics */
  filterSelect:   [8],                // filter pill selection — light tick
  chipSelect:     [12],               // chip selection — medium tick
  occasionSelect: [18],               // occasion selection — soft bump
  swipeNotch:     [25],               // swipe threshold reached — detent feel
  viewTransition: [15, 8],            // view change — soft thud
  scoreThreshold: [6],                // count-up passing 60/70/80/90 — rapid tick
  validationShake:[12, 8, 12, 8, 12], // error shake — triple buzz
  disabledTap:    [30],               // disabled CTA tap — single heavy
  cardSwipe:      [8, 15],            // card swap during swipe
};

/* ---- AbortController for fetch cancellation ---- */
export let currentAbort = null;
export function getCurrentAbort() { return currentAbort; }
export function setCurrentAbort(ctrl) { currentAbort = ctrl; }

/* ---- Animation timeout tracker (cancelled on re-render) ---- */
let _animationTimers = [];
export function getAnimationTimers() { return _animationTimers; }
export function pushTimer(id) { _animationTimers.push(id); }
export function clearAnimationTimers() {
  _animationTimers.forEach(clearTimeout);
  _animationTimers = [];
}

/* ---- Pending result data for lazy tier rendering ---- */
let _pendingResultData = null;
let _pendingCuisine = null;
let _tier2Prepared = false;
let _tier2Animated = false;

export function getPendingResultData() { return _pendingResultData; }
export function setPendingResultData(data) { _pendingResultData = data; }
export function getPendingCuisine() { return _pendingCuisine; }
export function setPendingCuisine(cuisine) { _pendingCuisine = cuisine; }
export function isTier2Prepared() { return _tier2Prepared; }
export function setTier2Prepared(v) { _tier2Prepared = v; }
export function isTier2Animated() { return _tier2Animated; }
export function setTier2Animated(v) { _tier2Animated = v; }

/* ---- Session counters ---- */
export let _sessionResultCount = 0;
export function incrementSessionResultCount() { _sessionResultCount++; }
export function getSessionResultCount() { return _sessionResultCount; }

export let _swapInFlight = false;
export function getSwapInFlight() { return _swapInFlight; }
export function setSwapInFlight(v) { _swapInFlight = v; }

let _arrowBounceTimer = null;
export function getArrowBounceTimer() { return _arrowBounceTimer; }
export function setArrowBounceTimer(v) { _arrowBounceTimer = v; }

/* ---- Reduced motion media query (shared across modules) ---- */
export const REDUCED_MOTION = matchMedia('(prefers-reduced-motion: reduce)');

/* TODO: P3.3 — Badge popout elements (.badge-popout--open) should be focus-trapped
   when opened. They currently lack fixed IDs, so they can't use the MODAL_CONFIG
   system in accessibility.js. Either assign stable IDs or extend the MutationObserver
   to watch for class changes on dynamic popout elements. */
