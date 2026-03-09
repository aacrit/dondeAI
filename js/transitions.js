/* ============================================
   DondeAI — Transitions Module
   Loading flow, canvas fold, result manifest.

   Module boundary established for monolith breakup.
   Functions are being incrementally migrated from app.js.
   Import from globals.js for shared state.
   ============================================ */

// Module imports — ready for function migration
// import { getState, setState } from './state.js';
// import { $dom, haptic, HAPTICS, pushTimer, ... } from './globals.js';
// import { goToStep, goToStepInstant } from './router.js';
// import { startParticles, stopParticles, initLogoAnimation, startWordRotation, stopWordRotation, resolveLogoToFound, cleanupLoadingLogo, fireCelebration } from './animations.js';
// import { playChime, playCelebrationChime } from './audio.js';
// import { renderResult } from './render.js';
// import { announce } from './accessibility.js';

/**
 * Transitions Module — Target function groups for extraction:
 *
 * LOADING FLOW:
 *   beginCanvasFold()                    — Phase 1: Canvas dissolve + scaffold
 *   manifestResult(data)                 — Phase 2: Logo exit + card reveal
 *   settleResult()                       — Phase 3: Cleanup after manifest
 *   reverseCanvasFold()                  — Error/back during loading
 *   unfoldResultToCanvas()               — Animated back navigation
 *   toggleLoading(loading)               — Legacy compatibility wrapper
 *
 * ANIMATIONS:
 *   animateScoreCountUp($el, score, dur) — Score pill count-up
 *   setupPhotoParallax()                 — Photo scroll parallax
 *
 * EDGE HINTS:
 *   scheduleEdgeHintReplay()             — Show More arrow bounce
 *   clearEdgeHintTimers()                — Clear edge hint timers
 */

// Placeholder — functions will be migrated here from app.js incrementally
// Currently all functions remain in app.js
