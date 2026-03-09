/* ============================================
   DondeAI — Client-Side Step Router
   2-step model: Canvas (0) + Result (1).
   Desktop (>=1024px): side-by-side cockpit.
   Mobile: sliding carousel.
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

const DESKTOP_MQ = window.matchMedia('(min-width: 1024px)');

function isDesktopLayout() {
  return DESKTOP_MQ.matches;
}

export function initRouter() {
  $track = document.querySelector('.step-track');
  $steps = document.querySelectorAll('.step');
  $backBtn = document.querySelector('.back-btn');
  $announce = document.getElementById('step-announce');

  window.addEventListener('popstate', (e) => {
    const step = e.state?.step ?? 0;
    setState({ step });
  });

  // Re-render on viewport change (e.g. window resize across breakpoint)
  let _prevDesktop = isDesktopLayout();
  window.addEventListener('resize', () => {
    const nowDesktop = isDesktopLayout();
    if (nowDesktop !== _prevDesktop) {
      _prevDesktop = nowDesktop;
      const state = getState();
      renderStep(state.step, state.step);
    }
  });

  subscribe((state, prev) => {
    if (state.step !== prev.step) {
      renderStep(state.step, prev.step);
    }
  });

  renderStep(0, 0);
  updateDesktopEmpty();
}

export function goToStep(n) {
  const step = Math.max(0, Math.min(n, TOTAL_STEPS - 1));
  history.pushState({ step }, '', '');
  setState({ step });
}

/* Instantly position step-track without animation (used under loading overlay) */
export function goToStepInstant(n) {
  const step = Math.max(0, Math.min(n, TOTAL_STEPS - 1));
  if (!$track) return;

  if (!isDesktopLayout()) {
    $track.style.transition = 'none';
    $track.style.transform = `translateX(-${step * 100}vw)`;
    // Force reflow then restore transition
    void $track.offsetWidth;
    $track.style.transition = '';
  }

  // Update aria and back button without animation
  if ($steps) {
    if (isDesktopLayout()) {
      $steps.forEach(el => el.setAttribute('aria-hidden', 'false'));
    } else {
      $steps.forEach((el, i) => el.setAttribute('aria-hidden', String(i !== step)));
    }
  }
  if ($backBtn) {
    $backBtn.classList.toggle('back-btn--visible', !isDesktopLayout() && step === 1);
  }
  history.pushState({ step }, '', '');
  setState({ step });
}

function renderStep(current, previous) {
  if (!$track) return;

  if (isDesktopLayout()) {
    // Desktop: both steps always visible, no sliding
    $track.style.transform = '';
    $steps.forEach(el => el.setAttribute('aria-hidden', 'false'));
    if ($backBtn) $backBtn.classList.remove('back-btn--visible');
    // Scroll result step to top on new result
    if (current === 1 && previous !== 1) {
      const resultStep = $steps[1];
      if (resultStep) resultStep.scrollTop = 0;
    }
  } else {
    // Mobile: sliding carousel
    $track.style.transform = `translateX(-${current * 100}vw)`;
    $steps.forEach((el, i) => {
      el.setAttribute('aria-hidden', String(i !== current));
    });
    if ($backBtn) {
      $backBtn.classList.toggle('back-btn--visible', current === 1);
    }
  }

  // Screen reader announcement
  if ($announce && STEP_NAMES[current]) {
    $announce.textContent = STEP_NAMES[current];
  }

  // Focus management — move focus to primary element in new step
  requestAnimationFrame(() => {
    const activeStep = isDesktopLayout() && current === 1 ? $steps[1] : $steps[current];
    if (!activeStep) return;
    const focusTarget =
      activeStep.querySelector('input:not([hidden])') ||
      activeStep.querySelector('button:not([hidden]):not(.skip-btn)') ||
      activeStep;
    if (focusTarget && focusTarget.focus) {
      focusTarget.focus({ preventScroll: true });
    }
  });

  updateDesktopEmpty();
}

/* Show/hide desktop empty state based on whether result card is visible */
function updateDesktopEmpty() {
  const $empty = document.getElementById('desktop-empty');
  if (!$empty) return;
  if (isDesktopLayout()) {
    const $resultCard = document.getElementById('result-card');
    const hasResult = $resultCard && $resultCard.style.display !== 'none';
    $empty.style.display = hasResult ? 'none' : '';
  } else {
    $empty.style.display = 'none';
  }
}
