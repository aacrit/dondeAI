/* ============================================
   DondeAI — Swipe Card Navigation
   Horizontal swipe on result card to navigate
   between ranked queue results.
   ============================================ */

import { $dom, haptic, HAPTICS, REDUCED_MOTION } from './globals.js';
import { springAnimate, SPRINGS } from './spring.js';

const SWIPE_THRESHOLD = 0.3; // 30% of card width
const VELOCITY_THRESHOLD = 0.4; // px/ms

let _startX = 0;
let _startY = 0;
let _currentX = 0;
let _isDragging = false;
let _startTime = 0;
let _onSwipeLeft = null;
let _onSwipeRight = null;

/**
 * Initialize swipe gestures on the result card.
 * @param {object} opts
 * @param {function} opts.onSwipeLeft  — next result
 * @param {function} opts.onSwipeRight — previous result
 */
export function initSwipeCards(opts = {}) {
  if (REDUCED_MOTION.matches) return;

  _onSwipeLeft = opts.onSwipeLeft || null;
  _onSwipeRight = opts.onSwipeRight || null;

  const $card = $dom.resultCard;
  if (!$card) return;

  $card.addEventListener('touchstart', handleTouchStart, { passive: true });
  $card.addEventListener('touchmove', handleTouchMove, { passive: false });
  $card.addEventListener('touchend', handleTouchEnd, { passive: true });
  $card.addEventListener('touchcancel', handleTouchCancel, { passive: true });
}

function handleTouchStart(e) {
  const touch = e.touches[0];
  _startX = touch.clientX;
  _startY = touch.clientY;
  _currentX = _startX;
  _isDragging = false;
  _startTime = Date.now();

  const $card = $dom.resultCard;
  if ($card) $card.style.transition = 'none';
}

function handleTouchMove(e) {
  if (!e.touches.length) return;
  const touch = e.touches[0];
  const dx = touch.clientX - _startX;
  const dy = touch.clientY - _startY;

  // Only start horizontal drag if movement is more horizontal than vertical
  if (!_isDragging) {
    if (Math.abs(dx) > 10 && Math.abs(dx) > Math.abs(dy) * 1.5) {
      _isDragging = true;
    } else if (Math.abs(dy) > 10) {
      return; // vertical scroll — bail
    } else {
      return; // too small to determine
    }
  }

  e.preventDefault();
  _currentX = touch.clientX;

  const $card = $dom.resultCard;
  if (!$card) return;

  // Rubber-band: dampen displacement beyond card width
  const dampened = dx > 0
    ? Math.sqrt(Math.abs(dx)) * 8
    : -Math.sqrt(Math.abs(dx)) * 8;

  $card.style.transform = `translateX(${dampened}px) rotate(${dampened * 0.015}deg)`;
  $card.style.opacity = String(1 - Math.abs(dampened) / 400);
}

function handleTouchEnd() {
  if (!_isDragging) return;
  _isDragging = false;

  const $card = $dom.resultCard;
  if (!$card) return;

  const dx = _currentX - _startX;
  const elapsed = Date.now() - _startTime;
  const velocity = Math.abs(dx) / elapsed;
  const cardWidth = $card.offsetWidth;

  const shouldComplete =
    Math.abs(dx) > cardWidth * SWIPE_THRESHOLD ||
    velocity > VELOCITY_THRESHOLD;

  if (shouldComplete && dx < 0 && _onSwipeLeft) {
    // Swipe left — next result
    haptic(HAPTICS.cardSwipe);
    animateOut($card, -1, () => _onSwipeLeft());
  } else if (shouldComplete && dx > 0 && _onSwipeRight) {
    // Swipe right — previous result
    haptic(HAPTICS.cardSwipe);
    animateOut($card, 1, () => _onSwipeRight());
  } else {
    // Spring back
    $card.style.transition = 'transform 400ms var(--spring), opacity 300ms var(--ease-out)';
    $card.style.transform = '';
    $card.style.opacity = '';
    setTimeout(() => { $card.style.transition = ''; }, 400);
  }
}

function handleTouchCancel() {
  _isDragging = false;
  const $card = $dom.resultCard;
  if ($card) {
    $card.style.transition = 'transform 300ms var(--spring), opacity 200ms var(--ease-out)';
    $card.style.transform = '';
    $card.style.opacity = '';
    setTimeout(() => { $card.style.transition = ''; }, 300);
  }
}

function animateOut($card, direction, callback) {
  const target = direction * window.innerWidth;

  // Outgoing card: smooth ease-out slide (unchanged feel)
  $card.style.transition = 'transform 300ms var(--ease-out), opacity 200ms var(--ease-out)';
  $card.style.transform = `translateX(${target}px) rotate(${direction * 5}deg)`;
  $card.style.opacity = '0';

  setTimeout(() => {
    // Reset for incoming card
    $card.style.transition = 'none';
    $card.style.transform = `translateX(${-direction * 60}px) scale(0.97)`;
    $card.style.opacity = '0';
    callback();

    requestAnimationFrame(() => {
      if (REDUCED_MOTION.matches) {
        // Reduced motion: snap to final position instantly
        $card.style.transform = '';
        $card.style.opacity = '';
        return;
      }

      // MOTION-2: Spring physics for incoming card
      // Animate translateX + scale with bouncy spring preset
      $card.style.opacity = '';
      $card.style.transition = 'opacity 200ms var(--ease-out)';
      springAnimate($card, {
        transform: 'translateX(0px) scale(1)',
      }, {
        spring: SPRINGS.bouncy,
        duration: 400,
        easing: 'var(--spring)',
      });

      // Clean up transition/transform styles after spring settles
      setTimeout(() => {
        $card.style.transition = '';
        $card.style.transform = '';
      }, 600);
    });
  }, 300);
}
