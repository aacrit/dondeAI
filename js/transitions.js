/* ============================================
   DondeAI — Transitions Module
   Loading flow, canvas fold, result manifest.
   ============================================ */

import { getState } from './state.js';
import {
  $dom, _escHtml, haptic, HAPTICS, pushTimer, clearAnimationTimers,
  setPendingResultData, getPendingResultData, setPendingCuisine,
  isTier2Prepared, setTier2Prepared,
  incrementSessionResultCount, getSessionResultCount,
  setSwapInFlight,
  getArrowBounceTimer, setArrowBounceTimer,
  REDUCED_MOTION
} from './globals.js';
import { DEBUG } from './config.js';
import { getScoreThresholdColor } from './utils.js';
import { goToStep, goToStepInstant } from './router.js';
import {
  startParticles, stopParticles, initLogoAnimation, startWordRotation,
  stopWordRotation, resolveLogoToFound, cleanupLoadingLogo, fireCelebration
} from './animations.js';
import { playChime, playCelebrationChime, playSettleChime, playGlowChime, playSpectacleChime } from './audio.js';
import { renderResult, prepareTier2, renderTier2Animations, _revealBlurb, getLoadingText } from './render.js';
import { announce } from './accessibility.js';
import { getLabels } from './theme.js';

/* ---- Module-local state ---- */
let _scaffoldTimers = [];
let _scoreCountUpRaf = null;
let edgeHintTimers = [];

/* ---- Tiered Celebration Orchestrator ---- */
/**
 * V12: Settle haptic now fires from spring onComplete in renderScoreHero.
 * This function handles chimes + confetti particle burst (tier 2+).
 * Tier 3+4 celebration haptics kept here for the celebration moment.
 */
export function _fireTieredCelebration(score) {
  const tier = score >= 95 ? 4 : score >= 88 ? 3 : score >= 80 ? 2 : 1;
  fireCelebration(score);

  // Tiered chime — settle haptic now fires from spring onComplete
  if (tier === 1) {
    playSettleChime();
  } else if (tier === 2) {
    playGlowChime();
  } else if (tier === 3) {
    playCelebrationChime();
    haptic(HAPTICS.celebration);
  } else {
    playSpectacleChime();
    haptic(HAPTICS.spectacle);
  }
}

/* ---- Phase 1: Canvas Fold ---- */
export function beginCanvasFold() {
  haptic(HAPTICS.swipe);

  const $canvas = document.querySelector('.canvas-layout');

  _scaffoldTimers.forEach(clearTimeout);
  _scaffoldTimers = [];

  if ($dom.resultCard) {
    $dom.resultCard.style.display = 'none';
    $dom.resultCard.style.opacity = '0';
    $dom.resultCard.style.transform = '';
    $dom.resultCard.style.transition = '';
    $dom.resultCard.classList.add('result-card--loading');
    $dom.resultCard.classList.remove('result-card--revealing');
  }

  const $loadingState = document.getElementById('loading-state');
  if ($loadingState) {
    $loadingState.style.display = '';
    $loadingState.classList.remove('loading-state--fading');
    $loadingState.style.opacity = '';
    /* Branded loading: show the user's craving with late-night sympathy (1-5 AM) */
    const craving = getState().craving?.trim();
    const $loadingText = $loadingState.querySelector('.loading-state__text');
    if ($loadingText && craving) {
      $loadingText.innerHTML = getLoadingText(craving);
    }
    /* Progress confidence bar — uses scaleX for GPU-composited animation */
    const $progressBar = $loadingState.querySelector('.loading-state__progress');
    if ($progressBar) {
      $progressBar.style.transformOrigin = 'left';
      $progressBar.style.transform = 'scaleX(0)';
      $progressBar.style.width = '100%';
      requestAnimationFrame(() => {
        /* Progress bar uses 2.5s with a custom deceleration curve — intentionally outside
           the token duration system. The slow fill builds user confidence during API wait. */
        $progressBar.style.transition = 'transform 2.5s cubic-bezier(0.1, 0.7, 0.3, 0.9)';
        $progressBar.style.transform = 'scaleX(0.72)';
      });
    }
    try {
      if (!REDUCED_MOTION.matches) {
        const $particleCanvas = document.getElementById('particle-canvas');
        if ($particleCanvas) startParticles($particleCanvas);
        initLogoAnimation(getState().craving);
        const labels = getLabels(getState().theme.culture);
        if (labels.loadingPhrases) startWordRotation(labels.loadingPhrases);
      }
    } catch (e) {
      DEBUG && console.error('Loading animation setup failed:', e);
    }
  }

  if ($canvas) $canvas.classList.add('canvas-layout--morphing');

  if (REDUCED_MOTION.matches) {
    goToStepInstant(1);
  } else if (document.startViewTransition) {
    /* Shared-element hero transition: morph canvas → result */
    _scaffoldTimers.push(setTimeout(() => {
      document.startViewTransition(() => {
        goToStep(1);
      });
    }, 400));
  } else {
    _scaffoldTimers.push(setTimeout(() => {
      goToStep(1);
    }, 400));
  }
}

/* ---- Manifest Result ---- */
export async function manifestResult(data) {
  incrementSessionResultCount();

  stopWordRotation();
  _scaffoldTimers.forEach(clearTimeout);
  _scaffoldTimers = [];

  try {
    renderResult(data);
  } catch (e) {
    DEBUG && console.error('renderResult failed:', e);
  }

  stopParticles();
  const $loadingState = document.getElementById('loading-state');

  /* ---- Progress bar → 100% completion beat ---- */
  const COMPLETION_DELAY = REDUCED_MOTION.matches ? 0 : 350; // 200ms animate + 150ms hold
  const $progressBar = $loadingState?.querySelector('.loading-state__progress');
  if ($progressBar && !REDUCED_MOTION.matches) {
    $progressBar.style.transition = 'transform 200ms cubic-bezier(0.0, 0.0, 0.2, 1)';
    $progressBar.style.transform = 'scaleX(1)';
  }

  if (REDUCED_MOTION.matches) {
    if ($loadingState) { $loadingState.style.display = 'none'; cleanupLoadingLogo(); }
    if ($dom.resultCard) {
      $dom.resultCard.style.display = '';
      $dom.resultCard.style.opacity = '1';
      $dom.resultCard.classList.remove('result-card--scaffold', 'result-card--loading');
    }
  } else {
    /* Wait for completion beat, then fade out loading and reveal result */
    _scaffoldTimers.push(setTimeout(() => {
      if ($loadingState) {
        resolveLogoToFound(data?.restaurant?.name);
        _scaffoldTimers.push(setTimeout(() => {
          $loadingState.classList.add('loading-state--fading');
          _scaffoldTimers.push(setTimeout(() => {
            $loadingState.style.display = 'none';
            $loadingState.classList.remove('loading-state--fading');
            cleanupLoadingLogo();
          }, 300));
        }, 450));
      }

      _scaffoldTimers.push(setTimeout(() => {
        if ($dom.resultCard) {
          $dom.resultCard.style.display = '';
          $dom.resultCard.classList.remove('result-card--scaffold', 'result-card--loading');
          $dom.resultCard.classList.add('result-card--revealing');
          $dom.resultCard.style.opacity = '1';

          const $rName = $dom.resultCard.querySelector('.result-name');
          if ($rName) $rName.classList.add('result-name--animated');

          _scaffoldTimers.push(setTimeout(() => {
            $dom.resultCard.classList.remove('result-card--revealing');
            if ($rName) $rName.classList.remove('result-name--animated');
          }, 830));
        }
      }, 750));
    }, COMPLETION_DELAY));
  }

  haptic(HAPTICS.reveal);

  const dondeScore = Math.round(parseFloat(data.donde_match) || 0);

  /* Ambient gradient border for high scores */
  if ($dom.resultCard && !REDUCED_MOTION.matches) {
    $dom.resultCard.classList.remove('result-card--premium-border', 'result-card--premium-border-strong');
    if (dondeScore >= 90) {
      $dom.resultCard.classList.add('result-card--premium-border', 'result-card--premium-border-strong');
    } else if (dondeScore >= 80) {
      $dom.resultCard.classList.add('result-card--premium-border');
    }
  }
  // MOTION-1: Count-up animation on Tier 1 match pill (mirrors Tier 2 score hero)
  const $matchPillScore = document.getElementById('match-pill-score');
  const $matchPillArcFill = document.getElementById('match-pill-arc-fill');
  if ($matchPillScore) {
    if (REDUCED_MOTION.matches) {
      // Reduced motion: set value instantly
      $matchPillScore.textContent = dondeScore;
      $matchPillScore.style.color = getScoreThresholdColor(dondeScore);
      if ($matchPillArcFill) {
        const arcLen = 2 * Math.PI * 25;
        $matchPillArcFill.style.strokeDasharray = String(arcLen);
        $matchPillArcFill.style.strokeDashoffset = String(arcLen - (dondeScore / 100) * arcLen);
        $matchPillArcFill.style.stroke = getScoreThresholdColor(dondeScore);
      }
    } else {
      // Animated: count up from 0 after card reveal completes (~750ms card reveal + 100ms buffer)
      _scaffoldTimers.push(setTimeout(() => {
        animateScoreCountUp($matchPillScore, dondeScore, 1200);
      }, 850));
    }
  }
  if (dondeScore >= 80 && $matchPillArcFill) {
    const $ring = $matchPillArcFill.closest('.match-mini__score-wrap');
    if ($ring) $ring.classList.add('match-mini__score-wrap--warm-glow');
  }

  if (dondeScore >= 70) {
    _scaffoldTimers.push(setTimeout(() => {
      _fireTieredCelebration(dondeScore);
    }, 1400));
  }

  if (!REDUCED_MOTION.matches) {
    _scaffoldTimers.push(setTimeout(() => {
      const $photos = document.querySelector('.result-photos__scroll') || document.querySelector('.result-photos');
      if ($photos && $photos.scrollWidth > $photos.clientWidth) {
        $photos.scrollTo({ left: 60, behavior: 'smooth' });
        setTimeout(() => $photos.scrollTo({ left: 0, behavior: 'smooth' }), 600);
      }
      /* Ken Burns drift — apply --active class to visible photo via IntersectionObserver */
      const $photoImgs = document.querySelectorAll('.result-photos__img');
      if ($photoImgs.length > 0 && $photos) {
        const photoObs = new IntersectionObserver((entries) => {
          entries.forEach(e => e.target.classList.toggle('result-photos__img--active', e.isIntersecting));
        }, { root: $photos, threshold: 0.6 });
        $photoImgs.forEach(img => photoObs.observe(img));
      }
    }, 1400));
  }

  // Auto-expand Tier 2 while waiting for Claude blurb
  _scaffoldTimers.push(setTimeout(() => {
    const $tier2 = document.getElementById('tier-leanin');
    if ($tier2 && !$tier2.classList.contains('tier--expanded')) {
      const pendingData = getPendingResultData();
      if (!isTier2Prepared() && pendingData) {
        setTier2Prepared(true);
        prepareTier2(pendingData, null); // cuisine already set via setPendingCuisine in renderResult
      }
      $tier2.setAttribute('aria-hidden', 'false');
      $tier2.classList.add('tier--expanded');
      $tier2.style.willChange = 'max-height, opacity';
      requestAnimationFrame(() => {
        $tier2.style.maxHeight = $tier2.scrollHeight + 'px';
      });
      renderTier2Animations();
    }
  }, REDUCED_MOTION.matches ? 0 : 2200));

  _revealBlurb(data);

  _scaffoldTimers.push(setTimeout(() => {
    settleResult();
  }, 1200));

  scheduleEdgeHintReplay();

  const arrowTimer = getArrowBounceTimer();
  if (arrowTimer) clearTimeout(arrowTimer);
  setArrowBounceTimer(setTimeout(() => {
    /* Only bounce if Tier 2 is still collapsed */
    const $tier2 = document.getElementById('tier-leanin');
    if ($tier2 && $tier2.classList.contains('tier--expanded')) return;
    const $tellMore = document.getElementById('tell-more-btn');
    if ($tellMore && $tellMore.style.display !== 'none' && $tellMore.getAttribute('aria-expanded') !== 'true') {
      const $arrow = $tellMore.querySelector('.tell-more-btn__arrow');
      if ($arrow) {
        $arrow.classList.add('tell-more-btn__arrow--bouncing');
        $arrow.addEventListener('animationend',
          () => $arrow.classList.remove('tell-more-btn__arrow--bouncing'), { once: true });
      }
    }
  }, 8000));
}

/* ---- Settle ---- */
export function settleResult() {
  const $canvas = document.querySelector('.canvas-layout');
  if ($canvas) $canvas.classList.remove('canvas-layout--morphing');
  const $headerHood = document.getElementById('header-hood');
  if ($headerHood) $headerHood.style.display = 'none';
  stopParticles();
  const $loadingState = document.getElementById('loading-state');
  if ($loadingState) {
    $loadingState.style.display = 'none';
    $loadingState.classList.remove('loading-state--fading');
    cleanupLoadingLogo();
  }
  const $restName = document.getElementById('result-name');
  if ($restName) $restName.focus({ preventScroll: true });
}

/* ---- Reverse Canvas Fold ---- */
export function reverseCanvasFold() {
  stopWordRotation();
  _scaffoldTimers.forEach(clearTimeout);
  _scaffoldTimers = [];
  if (_scoreCountUpRaf) { cancelAnimationFrame(_scoreCountUpRaf); _scoreCountUpRaf = null; }

  const $canvas = document.querySelector('.canvas-layout');
  if ($canvas) $canvas.classList.remove('canvas-layout--morphing');
  if ($dom.resultCard) {
    $dom.resultCard.classList.remove('result-card--loading', 'result-card--revealing');
    $dom.resultCard.style.display = 'none';
  }

  stopParticles();
  const $loadingState = document.getElementById('loading-state');
  if ($loadingState) {
    $loadingState.style.display = 'none';
    $loadingState.classList.remove('loading-state--fading');
    cleanupLoadingLogo();
  }

  goToStep(0);
}

/* ---- Unfold Result to Canvas ---- */
export function unfoldResultToCanvas() {
  const $canvas = document.querySelector('.canvas-layout');

  if (REDUCED_MOTION.matches) {
    settleResult();
    if ($dom.resultCard) $dom.resultCard.style.display = 'none';
    goToStep(0);
    return;
  }

  if ($dom.resultCard) {
    $dom.resultCard.classList.add('result-card--unfolding');
  }

  setTimeout(() => {
    if ($canvas) {
      $canvas.classList.remove('canvas-layout--morphing');
      $canvas.classList.add('canvas-layout--restoring');
    }

    goToStep(0);

    setTimeout(() => {
      if ($dom.resultCard) {
        $dom.resultCard.classList.remove('result-card--unfolding');
        $dom.resultCard.style.display = 'none';
      }
      setTimeout(() => {
        if ($canvas) $canvas.classList.remove('canvas-layout--restoring');
      }, 400);
    }, 350);
  }, 250);
}

/* ---- Legacy toggleLoading ---- */
export function toggleLoading(loading) {
  if (loading) {
    beginCanvasFold();
  } else {
    reverseCanvasFold();
  }
}

/* ---- Score Count-Up Animation ---- */
export function animateScoreCountUp($el, targetScore, customDuration) {
  if (_scoreCountUpRaf) {
    cancelAnimationFrame(_scoreCountUpRaf);
    _scoreCountUpRaf = null;
  }
  const $arcFill = document.getElementById('match-pill-arc-fill');
  const arcLength = 2 * Math.PI * 25;
  if ($arcFill) {
    $arcFill.style.transition = 'none';
    $arcFill.style.strokeDasharray = String(arcLength);
    $arcFill.style.strokeDashoffset = String(arcLength);
  }
  $el.textContent = '0';
  const REDUCED_MQ = matchMedia('(prefers-reduced-motion: reduce)');
  if (!REDUCED_MQ.matches) {
    const duration = customDuration || 1200;
    const start = performance.now();
    const _thresholdsFired = new Set();
    const animate = (now) => {
      const elapsed = now - start;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      const current = Math.round(eased * targetScore);
      $el.textContent = current;
      const thresholdColor = getScoreThresholdColor(current);
      $el.style.color = thresholdColor;
      /* Score threshold haptic detents at 60, 70, 80, 90 */
      for (const t of [60, 70, 80, 90]) {
        if (current >= t && targetScore >= t && !_thresholdsFired.has(t)) {
          _thresholdsFired.add(t);
          haptic(HAPTICS.scoreThreshold);
        }
      }
      $el.style.fontVariationSettings = `'wght' ${Math.round(300 + progress * 400)}`;
      if ($arcFill) {
        $arcFill.style.strokeDashoffset = String(arcLength - (current / 100) * arcLength);
        $arcFill.style.stroke = thresholdColor;
      }
      if (progress < 1) {
        _scoreCountUpRaf = requestAnimationFrame(animate);
      } else {
        _scoreCountUpRaf = null;
        /* Score settle: number does a spring scale pulse */
        $el.classList.add('match-mini__score--settling');
        $el.addEventListener('animationend',
          () => $el.classList.remove('match-mini__score--settling'), { once: true });
        /* Ring glow pulse */
        const $scoreWrap = document.querySelector('.match-mini__score-wrap');
        if ($scoreWrap) {
          $scoreWrap.classList.add('match-mini__score-wrap--pulsing');
          $scoreWrap.addEventListener('animationend',
            () => $scoreWrap.classList.remove('match-mini__score-wrap--pulsing'), { once: true });
        }
        /* Persistent warm glow for high scores */
        const $arcFillEl = document.getElementById('match-pill-arc-fill');
        if (targetScore >= 80 && $arcFillEl) {
          const $ring = $arcFillEl.closest('.match-mini__score-wrap');
          if ($ring) $ring.classList.add('match-mini__score-wrap--warm-glow');
        }
      }
    };
    _scoreCountUpRaf = requestAnimationFrame(animate);
  } else {
    $el.textContent = targetScore;
    const finalColor = getScoreThresholdColor(targetScore);
    $el.style.color = finalColor;
    if ($arcFill) {
      $arcFill.style.strokeDashoffset = String(arcLength - (targetScore / 100) * arcLength);
      $arcFill.style.stroke = finalColor;
    }
  }
}

/* ---- Edge Hint Replay ---- */
export function scheduleEdgeHintReplay() {
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

export function clearEdgeHintTimers() {
  edgeHintTimers.forEach(clearTimeout);
  edgeHintTimers = [];
}
