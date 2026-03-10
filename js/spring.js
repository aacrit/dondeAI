/* ============================================
   DondeAI — Spring Physics Library
   Real spring animation via Motion One.
   Provides named presets and a fallback-safe
   animate wrapper.
   ============================================ */

/* ---- Spring Presets ---- */
export const SPRINGS = {
  snappy:  { stiffness: 500, damping: 30, mass: 1 },   // buttons, toggles
  smooth:  { stiffness: 300, damping: 25, mass: 1 },   // cards, panels
  gentle:  { stiffness: 200, damping: 20, mass: 1 },   // page transitions
  bouncy:  { stiffness: 400, damping: 15, mass: 1 },   // celebrations, pops
  score:   { stiffness: 120, damping: 14, mass: 0.8 },  // score ring fill
};

/* ---- Motion One reference (loaded async from CDN) ---- */
let _motion = null;
let _motionReady = null;

/**
 * Initialize the Motion One library.
 * Called once at boot from app.js.
 * Returns a promise that resolves when ready (or rejects on load failure).
 */
export function initSpring() {
  if (_motionReady) return _motionReady;
  _motionReady = new Promise((resolve) => {
    // Motion One is loaded via importmap in index.html
    import('motion').then((mod) => {
      _motion = mod;
      resolve(true);
    }).catch(() => {
      console.warn('[spring] Motion One not available — falling back to CSS transitions');
      resolve(false);
    });
  });
  return _motionReady;
}

/** Check if Motion One loaded successfully */
export function hasMotion() {
  return _motion !== null;
}

/**
 * Animate an element with real spring physics.
 * Falls back to CSS transition if Motion One isn't loaded.
 *
 * @param {HTMLElement} el - Target element
 * @param {object} keyframes - Motion One keyframes, e.g. { opacity: 1, transform: 'translateY(0)' }
 * @param {object} [opts] - Options
 * @param {object} [opts.spring] - Spring preset from SPRINGS or custom { stiffness, damping, mass }
 * @param {number} [opts.duration] - Fallback CSS duration in ms (used when Motion One unavailable)
 * @param {string} [opts.easing] - Fallback CSS easing (default: 'var(--spring)')
 * @param {number} [opts.delay] - Delay in ms
 * @returns {object|null} Motion One animation controls, or null for CSS fallback
 */
export function springAnimate(el, keyframes, opts = {}) {
  if (!el) return null;

  const spring = opts.spring || SPRINGS.smooth;
  const delay = opts.delay || 0;

  // Motion One path — real spring physics
  if (_motion && _motion.animate) {
    try {
      return _motion.animate(
        el,
        keyframes,
        {
          type: 'spring',
          ...spring,
          delay: delay / 1000, // Motion One uses seconds
        }
      );
    } catch (e) {
      // Fall through to CSS
    }
  }

  // CSS fallback — use duration + easing approximation
  const dur = opts.duration || 300;
  const easing = opts.easing || 'var(--spring)';

  // Apply initial state then animate via transition
  const transitionProps = Object.keys(keyframes).map(prop => {
    const cssProp = prop.replace(/([A-Z])/g, '-$1').toLowerCase();
    return `${cssProp} ${dur}ms ${easing} ${delay}ms`;
  }).join(', ');

  el.style.transition = transitionProps;

  // Apply final keyframe values
  requestAnimationFrame(() => {
    for (const [prop, value] of Object.entries(keyframes)) {
      el.style[prop] = typeof value === 'number' ? `${value}px` : value;
    }
  });

  return null;
}

/**
 * Animate a value over time using spring physics.
 * Used for score count-up, ring fill, etc.
 *
 * @param {object} opts
 * @param {number} opts.from - Start value
 * @param {number} opts.to - End value
 * @param {object} [opts.spring] - Spring config (default: SPRINGS.score)
 * @param {function(number): void} opts.onUpdate - Called each frame with current value
 * @param {function(): void} [opts.onComplete] - Called when animation settles
 * @returns {{ stop(): void }}
 */
export function springValue(opts) {
  const { from, to, onUpdate, onComplete } = opts;
  const spring = opts.spring || SPRINGS.score;

  // Use Motion One's animate if available
  if (_motion && _motion.animate) {
    try {
      // Create a proxy element to drive the value
      const proxy = document.createElement('div');
      proxy.style.setProperty('--v', String(from));
      document.body.appendChild(proxy);

      const anim = _motion.animate(
        proxy,
        { '--v': String(to) },
        { type: 'spring', ...spring }
      );

      let rafId;
      const read = () => {
        const v = parseFloat(getComputedStyle(proxy).getPropertyValue('--v')) || 0;
        onUpdate(v);
        if (anim.playState !== 'finished') {
          rafId = requestAnimationFrame(read);
        } else {
          onUpdate(to);
          if (onComplete) onComplete();
          proxy.remove();
        }
      };
      rafId = requestAnimationFrame(read);

      return {
        stop() {
          cancelAnimationFrame(rafId);
          try { anim.cancel(); } catch (_) {}
          proxy.remove();
        }
      };
    } catch (e) {
      // Fall through to manual spring
    }
  }

  // Manual spring solver fallback
  let position = from;
  let velocity = 0;
  const { stiffness = 120, damping = 14, mass = 0.8 } = spring;
  let rafId;
  let lastTime = performance.now();

  function tick(now) {
    const dt = Math.min((now - lastTime) / 1000, 0.064); // cap at ~16fps
    lastTime = now;

    const displacement = position - to;
    const springForce = -stiffness * displacement;
    const dampingForce = -damping * velocity;
    const acceleration = (springForce + dampingForce) / mass;

    velocity += acceleration * dt;
    position += velocity * dt;

    onUpdate(position);

    // Settle check
    if (Math.abs(velocity) < 0.01 && Math.abs(position - to) < 0.01) {
      onUpdate(to);
      if (onComplete) onComplete();
      return;
    }

    rafId = requestAnimationFrame(tick);
  }

  rafId = requestAnimationFrame(tick);

  return {
    stop() {
      cancelAnimationFrame(rafId);
    }
  };
}
