/* ============================================
   DondeAI — Spring Physics Library
   Real spring animation via Motion One.
   Provides named presets and a fallback-safe
   animate wrapper.
   ============================================ */

import { DEBUG } from './config.js';

/* ---- Spring Presets ---- */
export const SPRINGS = {
  snappy:  { stiffness: 600, damping: 35, mass: 1 },
  smooth:  { stiffness: 280, damping: 22, mass: 1 },
  gentle:  { stiffness: 150, damping: 12, mass: 1.2 },
  bouncy:  { stiffness: 450, damping: 12, mass: 1.1 },
  score:   { stiffness: 180, damping: 16, mass: 1.4 },
};

let _motion = null;
let _motionReady = null;

/* ---- Persistent proxy element for springValue (PERF 7.1/7.2) ---- */
let _springProxy = null;
function getSpringProxy() {
  if (!_springProxy) {
    _springProxy = document.createElement('div');
    _springProxy.style.cssText = 'position:fixed;top:-9999px;pointer-events:none;';
    document.body.appendChild(_springProxy);
  }
  return _springProxy;
}

export function initSpring() {
  if (_motionReady) return _motionReady;
  _motionReady = new Promise((resolve) => {
    import('motion').then((mod) => { _motion = mod; resolve(true); })
      .catch(() => { DEBUG && console.warn('[spring] Motion One not available — falling back to CSS transitions'); resolve(false); });
  });
  return _motionReady;
}

export function hasMotion() { return _motion !== null; }

export function springAnimate(el, keyframes, opts = {}) {
  if (!el) return null;
  const spring = opts.spring || SPRINGS.smooth;
  const delay = opts.delay || 0;

  if (_motion && _motion.animate) {
    try {
      return _motion.animate(el, keyframes, { type: 'spring', ...spring, delay: delay / 1000 });
    } catch (e) { /* Fall through to CSS */ }
  }

  const dur = opts.duration || 300;
  const easing = opts.easing || 'var(--spring)';
  const transitionProps = Object.keys(keyframes).map(prop => {
    const cssProp = prop.replace(/([A-Z])/g, '-$1').toLowerCase();
    return `${cssProp} ${dur}ms ${easing} ${delay}ms`;
  }).join(', ');
  el.style.transition = transitionProps;
  requestAnimationFrame(() => {
    for (const [prop, value] of Object.entries(keyframes)) {
      el.style[prop] = typeof value === 'number' ? `${value}px` : value;
    }
  });
  return null;
}

export function springValue(opts) {
  const { from, to, onUpdate, onComplete } = opts;
  const spring = opts.spring || SPRINGS.score;

  if (_motion && _motion.animate) {
    try {
      const proxy = getSpringProxy();
      proxy.style.setProperty('--v', String(from));
      const anim = _motion.animate(proxy, { '--v': String(to) }, { type: 'spring', ...spring });
      let rafId;
      const read = () => {
        const v = parseFloat(getComputedStyle(proxy).getPropertyValue('--v')) || 0;
        onUpdate(v);
        if (anim.playState !== 'finished') { rafId = requestAnimationFrame(read); }
        else { onUpdate(to); if (onComplete) onComplete(); }
      };
      rafId = requestAnimationFrame(read);
      return { stop() { cancelAnimationFrame(rafId); try { anim.cancel(); } catch (_) {} } };
    } catch (e) { /* Fall through */ }
  }

  let position = from, velocity = 0;
  const { stiffness = 120, damping = 14, mass = 0.8 } = spring;
  let rafId, lastTime = performance.now();

  function tick(now) {
    const dt = Math.min((now - lastTime) / 1000, 0.064);
    lastTime = now;
    const displacement = position - to;
    velocity += ((-stiffness * displacement) + (-damping * velocity)) / mass * dt;
    position += velocity * dt;
    onUpdate(position);
    if (Math.abs(velocity) < 0.01 && Math.abs(position - to) < 0.01) {
      onUpdate(to); if (onComplete) onComplete(); return;
    }
    rafId = requestAnimationFrame(tick);
  }
  rafId = requestAnimationFrame(tick);
  return { stop() { cancelAnimationFrame(rafId); } };
}
