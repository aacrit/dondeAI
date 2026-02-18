/* ============================================
   DondeAI — Animations Engine
   Score ring, radar chart, particle system,
   chaos-to-order text, logo animation.
   ============================================ */

const REDUCED = matchMedia('(prefers-reduced-motion: reduce)');

/* ---- Score Ring Animation (Integer-only) ---- */
export function animateScoreRing(rawScore) {
  const n = Math.round(parseFloat(rawScore) || 8); // default 8
  const fill = document.getElementById('score-ring-fill');
  const numEl = document.getElementById('score-number');
  const verdictEl = document.getElementById('score-verdict');
  if (!fill || !numEl) return;

  const circumference = 2 * Math.PI * 45; // r=45
  const target = circumference - (n / 10) * circumference;

  fill.style.stroke = 'var(--ac)';

  if (REDUCED.matches) {
    fill.style.strokeDashoffset = target;
    numEl.textContent = n;
    return;
  }

  // Animate ring fill
  fill.style.strokeDasharray = circumference;
  fill.style.strokeDashoffset = circumference;

  requestAnimationFrame(() => {
    fill.style.transition = `stroke-dashoffset 1200ms cubic-bezier(0.2, 1, 0.4, 1)`;
    fill.style.strokeDashoffset = target;
  });

  // Count-up to integer
  const duration = 1200;
  const start = performance.now();
  function tick(now) {
    const elapsed = now - start;
    const progress = Math.min(elapsed / duration, 1);
    const eased = 1 - Math.pow(1 - progress, 3);
    numEl.textContent = Math.round(n * eased);
    if (progress < 1) requestAnimationFrame(tick);
    else numEl.textContent = n; // ensure final integer
  }
  requestAnimationFrame(tick);

  // Verdict word label: ink-reveal entrance (left-to-right clip) after number settles
  if (verdictEl) {
    verdictEl.style.opacity = '1';
    verdictEl.style.clipPath = 'inset(0 100% 0 0)';
    verdictEl.style.transform = 'none';

    setTimeout(() => {
      verdictEl.style.transition = 'clip-path 500ms cubic-bezier(0.2, 1, 0.4, 1)';
      verdictEl.style.clipPath = 'inset(0 0 0 0)';
    }, 1000);

    // Scale emphasis pulse after ink-reveal completes
    if (!REDUCED.matches) {
      setTimeout(() => {
        verdictEl.style.transition = 'transform 300ms cubic-bezier(0.34, 1.56, 0.64, 1)';
        verdictEl.style.transform = 'scale(1.08)';
        setTimeout(() => {
          verdictEl.style.transform = 'scale(1)';
        }, 150);
      }, 1500);
    }
  }

  // Celebration glow for exceptional scores (9+)
  if (!REDUCED.matches && n >= 9) {
    setTimeout(() => {
      const tile = document.getElementById('score-tile-donde');
      if (tile) {
        tile.classList.add('score-tile--celebrating');
        tile.addEventListener('animationend',
          () => tile.classList.remove('score-tile--celebrating'), { once: true });
      }
    }, 1400);
  }
}

/* ---- Vibe Profile Tiles ---- */
export function renderVibeTiles(scores, timers = []) {
  const dimensions = [
    { key: 'date_friendly_score', label: 'Date' },
    { key: 'group_friendly_score', label: 'Group' },
    { key: 'family_friendly_score', label: 'Family' },
    { key: 'business_lunch_score', label: 'Business' },
    { key: 'solo_dining_score', label: 'Solo' },
    { key: 'hole_in_wall_factor', label: 'Hidden Gem' },
    { key: 'romantic_rating', label: 'Romance' },
  ];

  // Only show dimensions that have data
  let available = dimensions.filter(d => {
    const v = scores[d.key];
    return v != null && v !== '' && !isNaN(parseFloat(v));
  });

  // If both date + romance present, drop romance (redundant)
  if (available.find(d => d.key === 'date_friendly_score') &&
      available.find(d => d.key === 'romantic_rating')) {
    available = available.filter(d => d.key !== 'romantic_rating');
  }

  const $container = document.getElementById('vibe-tiles');
  if (!$container) return;
  $container.innerHTML = '';

  if (available.length < 2) {
    $container.style.display = 'none';
    return;
  }
  $container.style.display = '';

  available.forEach((dim, i) => {
    const val = Math.min(parseFloat(scores[dim.key]) || 0, 10);
    const pct = (val / 10) * 100;

    const tile = document.createElement('div');
    tile.className = 'vibe-tile';
    tile.setAttribute('role', 'group');
    tile.setAttribute('aria-label', `${dim.label}: ${val.toFixed(1)} out of 10`);
    tile.innerHTML = `
      <div class="vibe-tile__header">
        <span class="vibe-tile__label type-data--sm">${dim.label}</span>
        <span class="vibe-tile__value type-data--sm">${val.toFixed(1)}</span>
      </div>
      <div class="vibe-tile__bar" role="progressbar"
           aria-valuenow="${val}" aria-valuemin="0" aria-valuemax="10">
        <div class="vibe-tile__bar-fill" data-target="${pct}"></div>
      </div>`;
    $container.appendChild(tile);

    // Stagger entrance + bar fill animation
    const delay = 980 + (i * 60);
    if (!REDUCED.matches) {
      tile.style.opacity = '0';
      tile.style.transform = 'translateY(8px)';
      timers.push(setTimeout(() => {
        tile.style.transition = 'opacity 300ms ease-out, transform 300ms cubic-bezier(0.34, 1.56, 0.64, 1)';
        tile.style.opacity = '1';
        tile.style.transform = 'translateY(0)';
      }, delay));
      const fill = tile.querySelector('.vibe-tile__bar-fill');
      timers.push(setTimeout(() => {
        fill.style.transition = 'width 500ms cubic-bezier(0.4, 0, 0.2, 1)';
        fill.style.width = pct + '%';
      }, delay + 100));
    } else {
      tile.querySelector('.vibe-tile__bar-fill').style.width = pct + '%';
    }
  });
}

/* ---- Badge Fade-In with Scale Spring ---- */
export function animateBadge(badgeEl, delayMs = 0) {
  if (!badgeEl) return;
  if (REDUCED.matches) {
    badgeEl.style.display = 'flex';
    badgeEl.style.opacity = '1';
    return;
  }

  badgeEl.style.display = 'flex';
  badgeEl.style.opacity = '0';
  badgeEl.style.transform = 'scale(0.8)';

  setTimeout(() => {
    badgeEl.style.transition = 'opacity 300ms ease-out, transform 300ms cubic-bezier(0.34, 1.56, 0.64, 1)';
    badgeEl.style.opacity = '1';
    badgeEl.style.transform = 'scale(1)';
  }, delayMs);
}

/* ---- Chaos-to-Order Text Reveal ---- */
export function chaosToOrderReveal(element, text) {
  if (!text) { element.textContent = ''; return; }

  if (REDUCED.matches) {
    element.textContent = text;
    return;
  }

  element.innerHTML = '';
  element.style.position = 'relative';

  // Batch characters into groups of 3 for performance
  const groupSize = 3;
  const groups = [];
  for (let i = 0; i < text.length; i += groupSize) {
    groups.push(text.slice(i, i + groupSize));
  }

  const spans = groups.map((group, i) => {
    const span = document.createElement('span');
    span.textContent = group;
    span.style.display = 'inline';
    span.style.opacity = '0';
    const dx = (Math.random() - 0.5) * 60;
    const dy = (Math.random() - 0.5) * 40;
    const rotate = (Math.random() - 0.5) * 30;
    span.style.transform = `translate(${dx}px, ${dy}px) rotate(${rotate}deg)`;
    span.style.transition = `transform 800ms cubic-bezier(0.2, 1, 0.4, 1) ${i * 3}ms, opacity 400ms ease ${i * 3}ms`;
    element.appendChild(span);
    return span;
  });

  // Trigger settle animation
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      spans.forEach(span => {
        span.style.opacity = '1';
        span.style.transform = 'translate(0, 0) rotate(0deg)';
      });
    });
  });
}

/* ---- Logo Animation Init (Question Pin — measure path lengths) ---- */
export function initLogoAnimation() {
  const paths = document.querySelectorAll(
    '.logo-mark--loading .logo-mark__tine--draw, .logo-mark--loading .logo-mark__curve--draw'
  );
  paths.forEach(el => {
    if (el.getTotalLength) {
      const len = el.getTotalLength();
      el.style.strokeDasharray = len;
      el.style.strokeDashoffset = len;
    }
  });

  // Reset dot to hidden state for spring-in animation
  const dot = document.querySelector('.logo-mark--loading .logo-mark__dot--draw');
  if (dot) {
    dot.style.opacity = '0';
    dot.style.transform = 'scale(0)';
  }
}

/* ---- Search Pulse (Act 2 — sonar ring + pulse during API call) ---- */
export function startSearchPulse() {
  const logo = document.querySelector('.logo-mark--loading');
  if (!logo || REDUCED.matches) return;

  logo.classList.add('logo-mark--searching');

  // Create sonar ring SVG circle
  const dot = logo.querySelector('.logo-mark__dot');
  if (!dot) return;

  const sonar = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
  sonar.setAttribute('cx', dot.getAttribute('cx'));
  sonar.setAttribute('cy', dot.getAttribute('cy'));
  sonar.setAttribute('r', dot.getAttribute('r'));
  sonar.setAttribute('fill', 'none');
  sonar.setAttribute('stroke', 'var(--ac)');
  sonar.setAttribute('stroke-width', '1');
  sonar.classList.add('logo-mark__sonar');
  logo.insertBefore(sonar, dot);
}

export function stopSearchPulse() {
  const logo = document.querySelector('.logo-mark--loading');
  if (!logo) return;
  logo.classList.remove('logo-mark--searching');
  const sonar = logo.querySelector('.logo-mark__sonar');
  if (sonar) sonar.remove();
}

/* ---- Resolve Logo to "Found" (Act 3 — confirmation pulse) ---- */
export function resolveLogoToFound() {
  const logo = document.getElementById('loading-logo');
  if (!logo) return Promise.resolve();

  stopSearchPulse();

  if (REDUCED.matches) {
    logo.style.transform = '';
    logo.style.opacity = '1';
    return Promise.resolve();
  }

  return new Promise(resolve => {
    // "Found" confirmation pulse — scale up then settle
    logo.style.transition = 'transform 300ms cubic-bezier(0.34, 1.56, 0.64, 1)';
    logo.style.transform = 'scale(1.08)';

    setTimeout(() => {
      logo.style.transition = 'transform 250ms cubic-bezier(0.2, 1, 0.4, 1)';
      logo.style.transform = 'scale(1)';
    }, 200);

    setTimeout(resolve, 450);
  });
}

/* ---- Stop Search Pulse + cleanup (for cancel/back navigation) ---- */
export function cleanupLoadingLogo() {
  stopSearchPulse();
  const logo = document.getElementById('loading-logo');
  if (logo) {
    logo.style.transform = '';
    logo.style.opacity = '';
  }
}

/* ---- Particle System ---- */
let particleAnimId = null;
let particleResizeObs = null;

export function startParticles(canvasEl) {
  if (!canvasEl || REDUCED.matches) return;

  const ctx = canvasEl.getContext('2d');
  if (!ctx) return;

  const parent = canvasEl.parentElement;
  const rect = parent.getBoundingClientRect();
  canvasEl.width = rect.width;
  canvasEl.height = rect.height;
  let w = canvasEl.width;
  let h = canvasEl.height;
  let centerX = w / 2;
  let centerY = h / 2;

  if (particleResizeObs) particleResizeObs.disconnect();
  particleResizeObs = new ResizeObserver(entries => {
    for (const entry of entries) {
      const cr = entry.contentRect;
      canvasEl.width = cr.width;
      canvasEl.height = cr.height;
      w = cr.width;
      h = cr.height;
      centerX = w / 2;
      centerY = h / 2;
    }
  });
  particleResizeObs.observe(parent);

  const PARTICLE_COUNT = 30;
  const particles = [];

  for (let i = 0; i < PARTICLE_COUNT; i++) {
    particles.push({
      x: Math.random() * w,
      y: Math.random() * h,
      targetX: centerX + (Math.random() - 0.5) * 40,
      targetY: centerY + (Math.random() - 0.5) * 40,
      size: Math.random() * 2 + 0.5,
      speed: Math.random() * 0.3 + 0.2,
    });
  }

  const startTime = performance.now();

  function draw(now) {
    const elapsed = now - startTime;
    ctx.clearRect(0, 0, w, h);

    const accentColor = getComputedStyle(canvasEl).getPropertyValue('--ac').trim() || '#6c5ce7';

    for (const p of particles) {
      // Gentle inward drift — particles slowly move toward center
      const dx = p.targetX - p.x;
      const dy = p.targetY - p.y;
      p.x += dx * 0.003 + (Math.random() - 0.5) * 0.8;
      p.y += dy * 0.003 + (Math.random() - 0.5) * 0.8;

      const alpha = 0.15 + Math.sin(elapsed * 0.001 + p.speed * 10) * 0.08;

      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      ctx.fillStyle = accentColor.includes('hsl')
        ? accentColor.replace(')', ` / ${alpha})`)
        : `rgba(108, 92, 231, ${alpha})`;
      ctx.fill();
    }

    particleAnimId = requestAnimationFrame(draw);
  }

  particleAnimId = requestAnimationFrame(draw);
}

export function stopParticles() {
  if (particleAnimId) {
    cancelAnimationFrame(particleAnimId);
    particleAnimId = null;
  }
  if (particleResizeObs) {
    particleResizeObs.disconnect();
    particleResizeObs = null;
  }
}
