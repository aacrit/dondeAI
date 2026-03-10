/* ============================================
   DondeAI — Motion Debug Overlay
   Activate: ?debug=motion or Ctrl+Shift+M
   Shows active animations, FPS, spring configs.
   ============================================ */

let _overlay = null;
let _rafId = null;
let _frames = [];
let _visible = false;

export function initMotionDebug() {
  // Only activate if URL param or keyboard shortcut
  if (!new URLSearchParams(location.search).has('debug')) return;
  if (new URLSearchParams(location.search).get('debug') !== 'motion') return;

  _createOverlay();
  _startFpsCounter();

  // Keyboard toggle
  document.addEventListener('keydown', (e) => {
    if (e.ctrlKey && e.shiftKey && e.key === 'M') {
      _visible = !_visible;
      if (_overlay) _overlay.style.display = _visible ? '' : 'none';
    }
  });
}

function _createOverlay() {
  _overlay = document.createElement('div');
  _overlay.id = 'motion-debug';
  _overlay.setAttribute('aria-hidden', 'true');
  Object.assign(_overlay.style, {
    position: 'fixed',
    top: '8px',
    right: '8px',
    width: '200px',
    padding: '12px',
    background: 'hsla(0 0% 0% / 0.85)',
    color: '#fff',
    fontFamily: 'JetBrains Mono, monospace',
    fontSize: '11px',
    lineHeight: '1.5',
    borderRadius: '8px',
    zIndex: '99999',
    pointerEvents: 'none',
    backdropFilter: 'blur(8px)',
  });
  _overlay.innerHTML = `
    <div style="font-weight:600;margin-bottom:6px;color:#4ECDC4">Motion Debug</div>
    <div id="md-fps">FPS: --</div>
    <div id="md-anims">Animations: 0</div>
    <div id="md-springs">Springs: idle</div>
    <hr style="border:none;border-top:1px solid #333;margin:6px 0">
    <div id="md-timeline" style="font-size:10px;opacity:0.7">Timeline: empty</div>
  `;
  document.body.appendChild(_overlay);
  _visible = true;
}

function _startFpsCounter() {
  function tick(now) {
    _frames.push(now);
    // Keep only last 60 frames
    while (_frames.length > 60 && _frames[0] < now - 1000) _frames.shift();

    if (_visible && _overlay) {
      const fps = _frames.length;
      const fpsEl = document.getElementById('md-fps');
      if (fpsEl) {
        const color = fps > 55 ? '#4ECDC4' : fps > 30 ? '#FFD700' : '#FF6B6B';
        fpsEl.innerHTML = `FPS: <span style="color:${color}">${fps}</span>`;
      }

      // Count active CSS animations
      const animEls = document.querySelectorAll('[style*="animation"]');
      const animCount = document.getAnimations ? document.getAnimations().length : animEls.length;
      const animEl = document.getElementById('md-anims');
      if (animEl) animEl.textContent = `Animations: ${animCount}`;

      // Check for running springs (via spring.js proxy elements)
      const springProxies = document.querySelectorAll('[style*="--v"]');
      const springsEl = document.getElementById('md-springs');
      if (springsEl) {
        springsEl.textContent = springProxies.length > 0
          ? `Springs: ${springProxies.length} active`
          : 'Springs: idle';
      }
    }

    _rafId = requestAnimationFrame(tick);
  }
  _rafId = requestAnimationFrame(tick);
}
