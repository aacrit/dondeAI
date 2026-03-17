/* ============================================
   DondeAI — Motion Utilities
   Animation sequencing, RAF cleanup, and
   micro-interaction helpers.

   Replaces nested setTimeout chains with a
   readable, cancellable timeline API.
   ============================================ */

import { REDUCED_MOTION } from './globals.js';
const REDUCED = REDUCED_MOTION;

/* ---- Timeline: Sequential animation orchestrator ---- */

/**
 * Creates a cancellable animation timeline.
 * Each step runs after the previous delay completes.
 * Under reduced-motion, all delays collapse to 0 and
 * callbacks fire synchronously.
 *
 * @returns {{ add(delayMs, fn), run(), cancel() }}
 *
 * Usage:
 *   const tl = timeline();
 *   tl.add(0,   () => card.classList.add('revealing'));
 *   tl.add(300, () => animateScore());
 *   tl.add(600, () => showFooter());
 *   tl.run();
 *   // Later: tl.cancel() to abort all pending steps.
 */
export function timeline() {
  const steps = [];
  const timers = [];
  let cancelled = false;

  return {
    /** Queue a step: fn runs after delayMs from timeline start. */
    add(delayMs, fn) {
      steps.push({ delay: delayMs, fn });
      return this;
    },

    /** Execute all queued steps. Reduced-motion: instant. */
    run() {
      cancelled = false;
      if (REDUCED.matches) {
        steps.forEach(s => s.fn());
        return;
      }
      for (const { delay, fn } of steps) {
        const id = setTimeout(() => {
          if (!cancelled) fn();
        }, delay);
        timers.push(id);
      }
    },

    /** Cancel all pending steps. */
    cancel() {
      cancelled = true;
      timers.forEach(clearTimeout);
      timers.length = 0;
    },

    /** Get raw timer IDs (for legacy _scaffoldTimers compat). */
    get timerIds() { return timers; }
  };
}

/* ---- Tracked RAF: Cancellable requestAnimationFrame loops ---- */

const _activeRafs = new Map();

/**
 * Start a named RAF loop. Automatically cancels any prior loop
 * with the same name, preventing orphan animations.
 *
 * @param {string} name - Unique identifier (e.g., 'scoreCountUp', 'parallax')
 * @param {function(number): boolean} tickFn - Called each frame with timestamp.
 *        Return false to stop the loop.
 * @returns {{ cancel() }}
 */
export function trackedRaf(name, tickFn) {
  // Cancel existing loop with same name
  cancelRaf(name);

  let id;
  function tick(now) {
    const cont = tickFn(now);
    if (cont !== false) {
      id = requestAnimationFrame(tick);
      _activeRafs.set(name, id);
    } else {
      _activeRafs.delete(name);
    }
  }
  id = requestAnimationFrame(tick);
  _activeRafs.set(name, id);

  return {
    cancel() { cancelRaf(name); }
  };
}

/** Cancel a named RAF loop. */
export function cancelRaf(name) {
  const id = _activeRafs.get(name);
  if (id != null) {
    cancelAnimationFrame(id);
    _activeRafs.delete(name);
  }
}

/** Cancel all tracked RAF loops. */
export function cancelAllRafs() {
  for (const [, id] of _activeRafs) {
    cancelAnimationFrame(id);
  }
  _activeRafs.clear();
}

/* ---- Spring micro-interaction helpers ---- */

/**
 * Apply a spring press/release effect on an element.
 * Scale down on pointerdown, spring back on pointerup.
 * Only animates transform + opacity (GPU-composited).
 *
 * @param {HTMLElement} el
 * @param {object} [opts]
 * @param {number} [opts.scale=0.97] - Scale factor on press
 * @param {string} [opts.duration='300ms'] - Spring return duration
 */
export function springPress(el, opts = {}) {
  if (!el || REDUCED.matches) return;
  const root = document.documentElement;
  const scale = opts.scale ?? parseFloat(getComputedStyle(root).getPropertyValue('--motion-press-scale')) || 0.97;
  const dur = opts.duration ?? (getComputedStyle(root).getPropertyValue('--motion-press-return').trim() || '300ms');

  el.addEventListener('pointerdown', () => {
    el.style.transform = `scale(${scale})`;
    el.style.transition = `transform 80ms var(--ease-out)`;
  }, { passive: true });

  const release = () => {
    el.style.transform = '';
    el.style.transition = `transform ${dur} var(--spring)`;
  };

  el.addEventListener('pointerup', release, { passive: true });
  el.addEventListener('pointerleave', release, { passive: true });
  el.addEventListener('pointercancel', release, { passive: true });
}

/**
 * Stagger-animate a list of elements with spring entrance.
 * Elements fade up with spring curve, delayed by stagger interval.
 *
 * @param {NodeList|HTMLElement[]} elements
 * @param {object} [opts]
 * @param {number} [opts.stagger=60] - ms between each element
 * @param {number} [opts.distance=8] - px translateY start offset
 * @param {number} [opts.initialDelay=0] - ms before first element
 */
export function springStagger(elements, opts = {}) {
  if (!elements || !elements.length) return;
  const stagger = opts.stagger ?? parseInt(getComputedStyle(document.documentElement).getPropertyValue('--motion-stagger')) || 50;
  const dist = opts.distance ?? 8;
  const initialDelay = opts.initialDelay ?? 0;

  if (REDUCED.matches) {
    for (const el of elements) {
      el.style.opacity = '1';
      el.style.transform = 'none';
    }
    return;
  }

  for (let i = 0; i < elements.length; i++) {
    const el = elements[i];
    el.style.opacity = '0';
    el.style.transform = `translateY(${dist}px)`;
    el.style.transition = `opacity 300ms var(--ease-out) ${initialDelay + i * stagger}ms, transform 400ms var(--spring) ${initialDelay + i * stagger}ms`;

    // Force reflow then trigger
    requestAnimationFrame(() => {
      el.style.opacity = '1';
      el.style.transform = 'translateY(0)';
    });
  }
}

/**
 * Count-up a numeric element with eased interpolation.
 * Uses trackedRaf for automatic cleanup.
 *
 * @param {HTMLElement} el - Element to update textContent
 * @param {number} target - Final number
 * @param {object} [opts]
 * @param {number} [opts.duration=1200] - Animation duration ms
 * @param {string} [opts.suffix='%'] - Appended to number
 * @param {function(number): string} [opts.colorFn] - Returns color for current value
 * @param {string} [opts.name='countUp'] - RAF tracker name
 */
export function countUp(el, target, opts = {}) {
  if (!el) return;
  const duration = opts.duration ?? 1200;
  const suffix = opts.suffix ?? '%';
  const colorFn = opts.colorFn;
  const name = opts.name ?? 'countUp';

  if (REDUCED.matches) {
    el.textContent = target + suffix;
    if (colorFn) el.style.color = colorFn(target);
    return;
  }

  const startTime = performance.now();

  trackedRaf(name, (now) => {
    const elapsed = now - startTime;
    const progress = Math.min(elapsed / duration, 1);
    // Cubic ease-out
    const eased = 1 - Math.pow(1 - progress, 3);
    const current = Math.round(target * eased);

    el.textContent = current + suffix;
    if (colorFn) el.style.color = colorFn(current);

    return progress < 1;
  });
}

/* ---- Magnetic Hover: 3D tilt toward cursor ---- */

/**
 * Apply magnetic hover to an element — subtle 3D tilt toward cursor.
 * Also tracks cursor position for radial glow (--mx, --my CSS vars).
 * Desktop only, respects reduced-motion.
 *
 * @param {HTMLElement} el
 * @param {object} [opts]
 * @param {number} [opts.strength=6] - Maximum rotation degrees
 */
export function magneticHover(el, opts = {}) {
  if (!el || REDUCED.matches || matchMedia('(hover: none)').matches) return;
  const strength = opts.strength ?? 6;

  el.addEventListener('mousemove', (e) => {
    const rect = el.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width - 0.5;
    const y = (e.clientY - rect.top) / rect.height - 0.5;
    el.style.transform = `perspective(800px) rotateY(${x * strength}deg) rotateX(${-y * strength}deg)`;
    el.style.setProperty('--mx', `${(x + 0.5) * 100}%`);
    el.style.setProperty('--my', `${(y + 0.5) * 100}%`);
  }, { passive: true });

  el.addEventListener('mouseleave', () => {
    el.style.transform = '';
    el.style.transition = `transform 250ms var(--spring)`;
    setTimeout(() => { el.style.transition = ''; }, 250);
  }, { passive: true });
}

/* ---- Utility: Check reduced motion ---- */
export function isReducedMotion() {
  return REDUCED.matches;
}
