/* ============================================
   DondeAI — Main Orchestrator
   Single-canvas layout: Canvas + Result.
   Thin orchestrator: init, state subscriber, landing, auth UI.
   Module architecture: globals.js → render.js / transitions.js / events.js → app.js
   ============================================ */

import { getState, setState, subscribe } from './state.js';
import { DEBUG } from './config.js';
import { initRouter } from './router.js';
import { loadTheme, loadSound, loadHistory, hasGuestDismissed, hasSeenOnboarding, setOnboardingSeen, getOrCreateUserId } from './persistence.js';
import { initTheme, getLabels } from './theme.js';
import { initAudio } from './audio.js';
import { initSpring } from './spring.js';
import { magneticHover, trackedRaf, cancelRaf } from './motion.js';
import { initVoice } from './voice.js';
import { initShare } from './share.js';
import { initOffline } from './offline.js';
import { initAccessibility } from './accessibility.js';
import { initScrollHeader } from './scroll-header.js';
import { initSwipeCards } from './swipe-cards.js';
import { initAuth, isAuthenticated as isAuthAuthenticated, getUser as getAuthUser } from './auth.js';
import { fireCelebration } from './animations.js';
import { getGreeting } from './utils.js';
import { $dom, initDomRefs, REDUCED_MOTION } from './globals.js';
import { initTasteDna } from './taste-dna.js'; // Taste DNA visualization
import { initConversationalSearch, patchVoiceForConversational } from './conversational-search.js';

// Module imports
import {
  renderSmartChips, closeSuggestions,
  startCanvasDisclosure, wireEvents, wireCravingInput, wireSwipe,
} from './events.js';
import {
  renderYourSpots,
  showToast, dismissToast, syncOfflineBannerText, getLoadingText
} from './render.js';
import {
  beginCanvasFold, manifestResult
} from './transitions.js';

/* ---- Global Timer Registry (CODE-8) ---- */
const _timerRegistry = new Set();
function registerInterval(fn, delay) { const id = setInterval(fn, delay); _timerRegistry.add(id); return id; }
function unregisterInterval(id) { if (id != null) { clearInterval(id); _timerRegistry.delete(id); } }
function clearAllTimers() { for (const id of _timerRegistry) clearInterval(id); _timerRegistry.clear(); }

/* ---- Initialize ---- */
function init() {
  // Clean up any prior timers (safe for first init too)
  clearAllTimers();
  // Initialize cached DOM references (must be first)
  initDomRefs();

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
  initSpring();
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
  initScrollHeader();
  initAuth();
  initTasteDna(); // Background-fetch taste profile if authenticated

  // Set up greeting
  setupLanding();

  // Sync offline banner text with current culture
  syncOfflineBannerText();

  // Wire event delegation (pass app-level callbacks)
  wireEvents({
    setupLanding,
    openAuthSheet,
    closeAuthSheet,
    toggleUserMenu,
    closeUserMenu,
    showCoachMarks,
    dismissCoachMark,
    initHoodGroups,
    autoOpenHoodGroup,
  });

  // Wire craving input
  wireCravingInput();

  // Conversational search: real-time intent parsing + result enrichment
  initConversationalSearch();
  patchVoiceForConversational();

  // Living placeholder rotation on canvas input
  initLivingPlaceholder();

  // Render dynamic smart chips
  renderSmartChips();

  // V9: Canvas progressive disclosure
  startCanvasDisclosure();

  // Hood group accordion init
  initHoodGroups();

  // Motion debug overlay
  if (new URLSearchParams(location.search).get('debug') === 'motion') {
    import('./debug-motion.js').then(m => m.initMotionDebug());
  }

  // Time-based occasion pre-highlight
  applyTimeBasedOccasionHint();

  // V10: Render combined "Your Spots"
  renderYourSpots();

  // F9: Initialize anonymous user ID
  getOrCreateUserId();

  // Easter Egg 3: Weather Sync Snow (Chicago winter: Dec-Feb, 30% chance)
  maybeShowSnow();

  // Wire swipe gestures
  wireSwipe();

  // Wire swipe card navigation on result card
  initSwipeCards({
    onSwipeLeft: () => {
      const tryAgainBtn = document.querySelector('[data-action="try-again"]');
      if (tryAgainBtn) tryAgainBtn.click();
    },
    onSwipeRight: () => {
      // Swipe right = go back to canvas
      const backBtn = document.querySelector('.back-btn');
      if (backBtn) backBtn.click();
    },
  });

  // Magnetic hover on CTA (desktop only)
  const $cta = document.querySelector('.cta-btn[data-action="submit"]');
  if ($cta) magneticHover($cta, { strength: 5 });

  // Glow pulse when CTA transitions from disabled → enabled
  if ($cta) {
    const ctaObs = new MutationObserver((mutations) => {
      for (const m of mutations) {
        if (m.attributeName === 'disabled' && !$cta.disabled) {
          $cta.classList.add('cta-btn--glow-pulse');
          $cta.addEventListener('animationend', () => $cta.classList.remove('cta-btn--glow-pulse'), { once: true });
        }
      }
    });
    ctaObs.observe($cta, { attributes: true, attributeFilter: ['disabled'] });
  }

  // Wire disabled CTA nudge
  document.addEventListener('pointerdown', (e) => {
    const btn = e.target.closest('.cta-btn:disabled');
    if (btn && btn.dataset.action === 'submit') {
      btn.classList.add('cta-btn--nudge');
      btn.addEventListener('animationend', () => btn.classList.remove('cta-btn--nudge'), { once: true });
      $dom.cravingInput?.focus();
    }
  });

  // Wire toast dismiss button
  document.getElementById('toast-dismiss')?.addEventListener('click', dismissToast);

  // Init cursor glow (desktop only)
  initCursorGlow();

  // Coach marks: show on first visit after 1.5s
  if (!hasSeenOnboarding()) {
    setTimeout(() => showCoachMarks(), 1500);
  }

  // Subscribe to state changes
  // UX-2: Auth prompt moved to events.js (triggers on bookmark/like/going-here)
  subscribe((state, prev) => {
    if (state.result !== prev.result && state.result) {
      if (prev.loading || $dom.resultCard?.classList.contains('result-card--scaffold')) {
        manifestResult(state.result);
      }
      // Easter Egg 1: "The Centurion" — 100th search achievement
      trackCenturionAchievement();
      // Easter Egg 2: "Secret Menu" result card dashed border
      if ($dom.resultCard) {
        const craving = (state.craving || '').trim();
        if (/secret\s+menu/i.test(craving)) {
          $dom.resultCard.classList.add('result-card--secret');
        } else {
          $dom.resultCard.classList.remove('result-card--secret');
        }
      }
      // UX-7: Show swipe hint after first result appears
    }
    if (state.loading !== prev.loading && state.loading) {
      beginCanvasFold();
      // Easter Egg 4: Fix single-word query loading text after fold starts
      const craving = (state.craving || '').trim();
      if (craving) {
        requestAnimationFrame(() => {
          const $loadingText = document.querySelector('.loading-state__text');
          if ($loadingText) {
            $loadingText.innerHTML = getLoadingText(craving);
          }
        });
      }
    }
    if (state.error !== prev.error && state.error) {
      showToast(state.error, true);
    }
    if (state.isAuthenticated !== prev.isAuthenticated) {
      initTasteDna(); // Update header feature buttons + re-fetch taste profile on sign-in
    }
    if (state.theme.culture !== prev.theme.culture) {
      renderSmartChips();
      closeSuggestions();
      syncOfflineBannerText();
      const $greeting = document.querySelector('[data-step="0"] .step__title');
      if ($greeting) $greeting.textContent = getGreeting(state.theme.culture);
    }
  });

  // Push initial history state
  history.replaceState({ step: 0 }, '', '');

  // Sync CTA disabled state
  updateCtaState();

  // Font loading
  if (document.fonts && document.fonts.ready) {
    document.fonts.ready.then(() => {
      document.body.classList.remove('fonts-loading');
    });
  } else {
    setTimeout(() => document.body.classList.remove('fonts-loading'), 1000);
  }

  // Listen for pulse-ambient event from events.js handleSubmit
  document.addEventListener('donde:pulse-ambient', pulseAmbient);
}

/* ---- Landing Setup ---- */
function setupLanding() {
  const culture = getState().theme.culture;
  const $greeting = document.querySelector('[data-step="0"] .step__title');
  if ($greeting) {
    typewriterReveal($greeting, getGreeting(culture));
  }
  startGreetingRotation();

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

/* ---- Typewriter Reveal ---- */
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

/* ---- Greeting Rotation ---- */
let greetingRotationTimer = null;

function startGreetingRotation() {
  stopGreetingRotation();
  greetingRotationTimer = registerInterval(() => {
    const state = getState();
    if (state.step !== 0 || state.loading || state.craving.trim()) return;
    const $greeting = document.querySelector('[data-step="0"] .step__title');
    if (!$greeting) return;
    const newText = getGreeting(state.theme.culture);
    if (newText === $greeting.textContent) return;
    $greeting.style.transition = 'opacity 400ms var(--ease-out)';
    $greeting.style.opacity = '0';
    setTimeout(() => {
      $greeting.textContent = newText;
      $greeting.style.opacity = '1';
    }, 400);
  }, 45000);
}

function stopGreetingRotation() {
  if (greetingRotationTimer) {
    unregisterInterval(greetingRotationTimer);
    greetingRotationTimer = null;
  }
}

/* ---- Ambient Blob Pulse ---- */
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
      blob.style.transition = 'transform 800ms var(--ease-out), opacity 800ms var(--ease-out)';
      blob.style.transform = '';
      blob.style.opacity = '';
      setTimeout(() => { blob.style.transition = ''; }, 800);
    });
  }, 600);
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
  const tile = document.querySelector(`.occasion-tile[data-value="${suggested}"]`);
  if (tile) tile.classList.add('occasion-tile--suggested');
}

/* ---- Hood group accordion ---- */
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
  const regions = document.getElementById('hood-regions');
  if (regions) regions.setAttribute('aria-hidden', 'false');
  const browse = document.querySelector('[data-action="toggle-hood-regions"]');
  if (browse) {
    browse.setAttribute('aria-expanded', 'true');
    browse.classList.add('hood-browse--active');
  }
}

/* ---- Cursor Glow (Desktop) ---- */
function initCursorGlow() {
  if (!$dom.cursorGlow) return;
  if (matchMedia('(hover: none)').matches || matchMedia('(prefers-reduced-motion: reduce)').matches) return;

  let targetX = 0, targetY = 0, currentX = 0, currentY = 0;
  let active = false;

  document.addEventListener('mousemove', (e) => {
    targetX = e.clientX;
    targetY = e.clientY;
    if (!active) {
      active = true;
      $dom.cursorGlow.style.opacity = '0.2';
      trackedRaf('cursorGlow', () => {
        if (!active) return false; // stop loop
        currentX += (targetX - currentX) * 0.15;
        currentY += (targetY - currentY) * 0.15;
        $dom.cursorGlow.style.transform = `translate(${currentX - 100}px, ${currentY - 100}px)`;
        return true; // continue loop
      });
    }
  }, { passive: true });

  document.addEventListener('mouseleave', () => {
    active = false;
    cancelRaf('cursorGlow');
    $dom.cursorGlow.style.opacity = '0';
  });
}

/* ---- Coach Marks ---- */
let coachMarkStep = 0;
const COACH_STEPS = [
  {
    targetSelector: '[data-action="toggle-mode"]',
    textKey: 'theme',
    position: 'below',
  },
  {
    targetSelector: '.craving-input',
    textKey: 'input',
    position: 'below',
  },
];

function dismissAllCoachMarks() {
  for (const step of COACH_STEPS) {
    const target = document.querySelector(step.targetSelector);
    if (target?._coachElevated) {
      target.style.zIndex = '';
      delete target._coachElevated;
    }
  }
  coachMarkStep = COACH_STEPS.length;
  const $mark = document.getElementById('coach-mark');
  const $backdrop = document.getElementById('coach-mark-backdrop');
  if ($mark) $mark.style.display = 'none';
  if ($backdrop) $backdrop.style.display = 'none';
  setOnboardingSeen();
}

function showCoachMarks() {
  coachMarkStep = 0;
  showCoachStep();
  const autoDismiss = () => dismissAllCoachMarks();
  // UX-6: Dismiss on any user interaction (click, tap, or input)
  $dom.cravingInput?.addEventListener('input', autoDismiss, { once: true });
  document.addEventListener('click', autoDismiss, { once: true });
  document.addEventListener('touchstart', autoDismiss, { once: true, passive: true });
  // UX-6: Increased auto-dismiss from 10s to 20s
  setTimeout(() => {
    if (coachMarkStep < COACH_STEPS.length) dismissAllCoachMarks();
  }, 20000);
}

function showCoachStep() {
  const $mark = document.getElementById('coach-mark');
  const $text = document.getElementById('coach-mark-text');
  const $backdrop = document.getElementById('coach-mark-backdrop');
  if (!$mark || !$text || !$backdrop) return;

  if (coachMarkStep >= COACH_STEPS.length) {
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

  const rect = target.getBoundingClientRect();
  $mark.style.left = `${Math.max(16, Math.min(rect.left, window.innerWidth - 296))}px`;
  $mark.style.top = `${rect.bottom + 12}px`;

  target.style.position = target.style.position || 'relative';
  target.style.zIndex = '9992';
  target._coachElevated = true;
}

function dismissCoachMark() {
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
    if ($userName) {
      $userName.textContent = '';
      $userName.classList.remove('header__user-name--visible');
    }
  }

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

/* ---- Living Placeholder ---- */
let _placeholderTimer = null;
let _placeholderIdx = 0;

function initLivingPlaceholder() {
  if (REDUCED_MOTION.matches) return;
  const $input = $dom.cravingInput;
  if (!$input) return;

  const cycle = () => {
    const state = getState();
    if (state.step !== 0 || state.loading || $input.value.trim()) return;
    const labels = getLabels(state.theme.culture);
    const placeholders = labels.placeholders || [labels.placeholder];
    _placeholderIdx = (_placeholderIdx + 1) % placeholders.length;
    // Crossfade: fade out, swap, fade in
    $input.classList.add('craving-input--placeholder-exit');
    setTimeout(() => {
      $input.placeholder = placeholders[_placeholderIdx];
      $input.classList.remove('craving-input--placeholder-exit');
    }, 300);
  };

  _placeholderTimer = registerInterval(cycle, 4000);

  // Stop cycling on focus, resume on blur
  $input.addEventListener('focus', () => {
    if (_placeholderTimer) { _placeholderTimer != null && unregisterInterval(_placeholderTimer); _placeholderTimer = null; }
  });
  $input.addEventListener('blur', () => {
    if (!_placeholderTimer) _placeholderTimer = registerInterval(cycle, 4000);
  });
}

/* ---- Ink Pulse on Keystroke ---- */
if (typeof document !== 'undefined') {
  document.addEventListener('DOMContentLoaded', () => {
    const $wrap = document.querySelector('.craving-wrap');
    const $input = document.getElementById('craving-input');
    if ($wrap && $input && !matchMedia('(prefers-reduced-motion: reduce)').matches) {
      $input.addEventListener('input', () => {
        $wrap.classList.add('craving-wrap--pulse');
        $wrap.addEventListener('animationend', () => $wrap.classList.remove('craving-wrap--pulse'), { once: true });
      });
    }
  });
}

/* ---- Easter Egg 1: "The Centurion" — 100th Search Achievement ---- */
function trackCenturionAchievement() {
  const KEY = 'donde_total_searches';
  const ACHIEVED_KEY = 'donde_centurion_achieved';
  if (localStorage.getItem(ACHIEVED_KEY)) return;
  const count = (parseInt(localStorage.getItem(KEY), 10) || 0) + 1;
  localStorage.setItem(KEY, String(count));
  if (count === 100) {
    localStorage.setItem(ACHIEVED_KEY, '1');
    fireCelebration(95);
    if (navigator.vibrate) navigator.vibrate([10,30,10,30,10,80,15,15,15]);
    const badge = document.createElement('div');
    badge.className = 'centurion-badge';
    badge.textContent = '\u{1F3C6} Centurion \u2014 100 searches!';
    badge.setAttribute('aria-live', 'polite');
    const card = $dom.resultCard;
    if (card && card.parentNode) {
      card.parentNode.insertBefore(badge, card);
    } else {
      document.body.appendChild(badge);
    }
    requestAnimationFrame(() => { badge.style.opacity = '1'; });
    setTimeout(() => {
      badge.style.transition = 'opacity 500ms var(--ease-out)';
      badge.style.opacity = '0';
      setTimeout(() => badge.remove(), 500);
    }, 3000);
  }
}

/* ---- Easter Egg 3: Weather Sync Snow ---- */
function maybeShowSnow() {
  const month = new Date().getMonth(); // 0-indexed
  const isWinter = month === 11 || month === 0 || month === 1;
  if (isWinter && Math.random() < 0.3) {
    showSnowEffect();
  }
}

function showSnowEffect() {
  if (REDUCED_MOTION.matches) return;
  const container = document.createElement('div');
  container.className = 'snow-container';
  container.setAttribute('aria-hidden', 'true');
  for (let i = 0; i < 12; i++) {
    const flake = document.createElement('div');
    flake.className = 'snowflake';
    flake.style.left = `${Math.random() * 100}%`;
    flake.style.animationDelay = `${Math.random() * 8}s`;
    flake.style.animationDuration = `${6 + Math.random() * 6}s`;
    flake.style.opacity = `${0.03 + Math.random() * 0.05}`;
    container.appendChild(flake);
  }
  document.body.appendChild(container);
}

/* ---- Boot ---- */
init();
