/* ============================================
   DondeAI — Transitions Module
   Loading flow, canvas fold, result manifest.
   ============================================ */

import { getState } from './state.js';
import {
  $dom, haptic, HAPTICS, pushTimer, clearAnimationTimers,
  setPendingResultData, getPendingResultData, setPendingCuisine,
  isTier2Prepared, setTier2Prepared,
  incrementSessionResultCount, getSessionResultCount,
  setSwapInFlight,
  getArrowBounceTimer, setArrowBounceTimer,
  REDUCED_MOTION
} from './globals.js';
import { getScoreThresholdColor } from './utils.js';
import { goToStep, goToStepInstant } from './router.js';
import {
  startParticles, stopParticles, initLogoAnimation, startWordRotation,
  stopWordRotation, resolveLogoToFound, cleanupLoadingLogo, fireCelebration
} from './animations.js';
import { playChime, playCelebrationChime, playSettleChime, playGlowChime, playSpectacleChime } from './audio.js';
import { renderResult, prepareTier2, renderTier2Animations, _revealBlurb } from './render.js';
import { announce } from './accessibility.js';
import { getLabels } from './theme.js';

/* ---- Module-local state ---- */
let _scaffoldTimers = [];
let _scoreCountUpRaf = null;
let edgeHintTimers = [];

/* ---- Tiered Celebration Orchestrator ---- */
export function _fireTieredCelebration(score) {
  const tier = score >= 95 ? 4 : score >= 88 ? 3 : score >= 80 ? 2 : 1;
  fireCelebration(score);

  if (tier === 1) {
    playSettleChime();
    haptic(HAPTICS.tick);
  } else if (tier === 2) {
    playGlowChime();
    haptic(HAPTICS.doublePulse);
  } else if (tier === 3) {
    playCelebrationChime();
    haptic(HAPTICS.celebration);
  } else {
    playSpectacleChime();
    haptic(HAPTICS.spectacle);
  }

  if (tier >= 2) {
    [300, 600, 900].forEach(delay => {
      setTimeout(() => haptic(HAPTICS.tick), delay);
    });
  }
}

/* ---- Phase 1: Canvas Fold ---- */
export function beginCanvasFold() {
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
    try {
      if (!REDUCED_MOTION.matches) {
        const $particleCanvas = document.getElementById('particle-canvas');
        if ($particleCanvas) startParticles($particleCanvas);
        initLogoAnimation(getState().craving);
        const labels = getLabels(getState().theme.culture);
        if (labels.loadingPhrases) startWordRotation(labels.loadingPhrases);
      }
    } catch (e) {
      console.error('Loading animation setup failed:', e);
    }
  }

  if ($canvas) $canvas.classList.add('canvas-layout--morphing');

  if (REDUCED_MOTION.matches) {
    goToStepInstant(1);
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
    console.error('renderResult failed:', e);
  }

  stopParticles();
  const $loadingState = document.getElementById('loading-state');

  if (REDUCED_MOTION.matches) {
    if ($loadingState) { $loadingState.style.display = 'none'; cleanupLoadingLogo(); }
    if ($dom.resultCard) {
      $dom.resultCard.style.display = '';
      $dom.resultCard.style.opacity = '1';
      $dom.resultCard.classList.remove('result-card--scaffold', 'result-card--loading');
    }
  } else {
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
  }

  haptic(HAPTICS.reveal);

  const dondeScore = Math.round(parseFloat(data.donde_match) || 0);
  const scoreDuration = getSessionResultCount() > 2 ? 600 : undefined;
  _scaffoldTimers.push(setTimeout(() => {
    animateScoreCountUp(
      document.getElementById('match-pill-score'),
      dondeScore,
      scoreDuration
    );
  }, REDUCED_MOTION.matches ? 0 : 360));

  if (dondeScore >= 70) {
    _scaffoldTimers.push(setTimeout(() => {
      _fireTieredCelebration(dondeScore);
    }, 1400));
  }

  if (!REDUCED_MOTION.matches) {
    _scaffoldTimers.push(setTimeout(() => {
      const $photos = document.querySelector('.result-photos__scroll');
      if ($photos && $photos.scrollWidth > $photos.clientWidth) {
        $photos.scrollTo({ left: 60, behavior: 'smooth' });
        setTimeout(() => $photos.scrollTo({ left: 0, behavior: 'smooth' }), 600);
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
  }, REDUCED_MOTION.matches ? 0 : 900));

  _revealBlurb(data);

  _scaffoldTimers.push(setTimeout(() => {
    settleResult();
  }, 1200));

  scheduleEdgeHintReplay();

  const arrowTimer = getArrowBounceTimer();
  if (arrowTimer) clearTimeout(arrowTimer);
  setArrowBounceTimer(setTimeout(() => {
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
    const animate = (now) => {
      const elapsed = now - start;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      const current = Math.round(eased * targetScore);
      $el.textContent = current;
      const thresholdColor = getScoreThresholdColor(current);
      $el.style.color = thresholdColor;
      $el.style.fontWeight = String(Math.round(400 + progress * 200));
      if ($arcFill) {
        $arcFill.style.strokeDashoffset = String(arcLength - (current / 100) * arcLength);
        $arcFill.style.stroke = thresholdColor;
      }
      if (progress < 1) {
        _scoreCountUpRaf = requestAnimationFrame(animate);
      } else {
        _scoreCountUpRaf = null;
        const $scoreWrap = document.querySelector('.match-mini__score-wrap');
        if ($scoreWrap) {
          $scoreWrap.classList.add('match-mini__score-wrap--pulsing');
          $scoreWrap.addEventListener('animationend',
            () => $scoreWrap.classList.remove('match-mini__score-wrap--pulsing'), { once: true });
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
