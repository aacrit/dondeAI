/* ============================================
   DondeAI — Scroll-Responsive Header
   Progressive blur + height shrink on scroll.
   ============================================ */

import { REDUCED_MOTION } from './globals.js';
const REDUCED = REDUCED_MOTION;
let _observer = null;

/**
 * Initialize scroll-responsive header behavior.
 * Uses IntersectionObserver on the result step's first child
 * to toggle compact mode without scroll event listeners.
 */
export function initScrollHeader() {
  if (REDUCED.matches) return;

  const $header = document.querySelector('.header');
  const $resultStep = document.querySelector('.step[data-step="1"]');
  if (!$header || !$resultStep) return;

  // Observe scroll position via a sentinel element
  let $sentinel = $resultStep.querySelector('.scroll-sentinel');
  if (!$sentinel) {
    $sentinel = document.createElement('div');
    $sentinel.className = 'scroll-sentinel';
    $sentinel.setAttribute('aria-hidden', 'true');
    $sentinel.style.cssText = 'height:1px;width:100%;pointer-events:none;position:absolute;top:80px;';
    $resultStep.style.position = 'relative';
    $resultStep.prepend($sentinel);
  }

  if (_observer) _observer.disconnect();

  _observer = new IntersectionObserver(
    ([entry]) => {
      $header.classList.toggle('header--compact', !entry.isIntersecting);
    },
    { root: $resultStep, threshold: 0 }
  );

  _observer.observe($sentinel);
}
