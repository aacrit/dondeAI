/* ============================================
   DondeAI — Client-Side Step Router
   2-step model: Canvas (0) + Result (1).
   ============================================ */

import { getState, setState, subscribe } from './state.js';

const TOTAL_STEPS = 2;
let $track = null;
let $steps = null;
let $backBtn = null;
let $announce = null;

const STEP_NAMES = [
  'What are you craving?',
  'Your recommendation',
];

export function initRouter() {
  $track = document.querySelector('.step-track');
  $steps = document.querySelectorAll('.step');
  $backBtn = document.querySelector('.back-btn');
  $announce = document.getElementById('step-announce');

  window.addEventListener('popstate', (e) => {
    const step = e.state?.step ?? 0;
    setState({ step });
  });

  subscribe((state, prev) => {
    if (state.step !== prev.step) {
      renderStep(state.step, prev.step);
    }
  });

  renderStep(0, 0);
}

export function goToStep(n) {
  const step = Math.max(0, Math.min(n, TOTAL_STEPS - 1));
  history.pushState({ step }, '', '');
  setState({ step });
}

function renderStep(current, previous) {
  if (!$track) return;

  // Slide track
  $track.style.transform = `translateX(-${current * 100}vw)`;

  // Manage aria-hidden and visibility
  $steps.forEach((el, i) => {
    const isActive = i === current;
    el.setAttribute('aria-hidden', String(!isActive));
  });

  // Back button visibility — only visible on result step (step 1)
  if ($backBtn) {
    $backBtn.classList.toggle('back-btn--visible', current === 1);
  }

  // Screen reader announcement
  if ($announce && STEP_NAMES[current]) {
    $announce.textContent = STEP_NAMES[current];
  }

  // Focus management — move focus to primary element in new step
  requestAnimationFrame(() => {
    const activeStep = $steps[current];
    if (!activeStep) return;
    const focusTarget =
      activeStep.querySelector('input:not([hidden])') ||
      activeStep.querySelector('button:not([hidden]):not(.skip-btn)') ||
      activeStep;
    if (focusTarget && focusTarget.focus) {
      focusTarget.focus({ preventScroll: true });
    }
  });
}
