/* ============================================
   DondeAI — Animations Engine
   Score ring, radar chart, particle system,
   chaos-to-order text, logo animation.
   ============================================ */

import { normalizeNoiseLevel } from './utils.js';

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

  // Color based on integer tier
  let color = 'var(--ac)';
  if (n >= 8) color = 'var(--green)';
  else if (n < 5) color = 'var(--rose)';
  fill.style.stroke = color;

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

  // Verdict word label animates in after number settles
  if (verdictEl) {
    verdictEl.style.opacity = '0';
    verdictEl.style.transform = 'translateY(6px)';
    requestAnimationFrame(() => {
      verdictEl.style.transition = 'opacity 400ms ease-out 800ms, transform 400ms ease-out 800ms';
      verdictEl.style.opacity = '1';
      verdictEl.style.transform = 'translateY(0)';
    });

    // Subtle emphasis pulse after verdict appears
    if (!REDUCED.matches) {
      setTimeout(() => {
        verdictEl.style.transition = 'transform 300ms cubic-bezier(0.34, 1.56, 0.64, 1)';
        verdictEl.style.transform = 'scale(1.08)';
        setTimeout(() => {
          verdictEl.style.transform = 'scale(1)';
        }, 150);
      }, 1300);
    }
  }
}

/* ---- Radar Chart (Extended dimensions, morph-from-center animation) ---- */
export function renderRadar(scores, restaurantData = null) {
  const dimensions = [
    { key: 'date_friendly_score', short: 'DT', full: 'Date' },
    { key: 'group_friendly_score', short: 'GR', full: 'Group' },
    { key: 'family_friendly_score', short: 'FM', full: 'Family' },
    { key: 'business_lunch_score', short: 'BZ', full: 'Business' },
    { key: 'solo_dining_score', short: 'SL', full: 'Solo' },
    { key: 'hole_in_wall_factor', short: 'GM', full: 'Gem' },
    { key: 'romantic_rating', short: 'RM', full: 'Romance' },
  ];

  // Extend with normalized extra fields
  const extendedScores = { ...scores };
  if (restaurantData) {
    const noiseNorm = normalizeNoiseLevel(restaurantData.noise_level);
    if (noiseNorm !== null) {
      extendedScores._noise = String(noiseNorm);
      dimensions.push({ key: '_noise', short: 'NS', full: 'Noise' });
    }
    if (restaurantData.sentiment_score) {
      extendedScores._sentiment = String((parseFloat(restaurantData.sentiment_score) * 10).toFixed(1));
      dimensions.push({ key: '_sentiment', short: 'SN', full: 'Sentiment' });
    }
    if (restaurantData.google_rating) {
      extendedScores._google = String(((parseFloat(restaurantData.google_rating) / 5) * 10).toFixed(1));
      dimensions.push({ key: '_google', short: 'GL', full: 'Google' });
    }
  }

  const available = dimensions.filter(d => {
    const v = extendedScores[d.key];
    return v != null && v !== '' && !isNaN(parseFloat(v));
  });

  const wrap = document.getElementById('radar-wrap');
  const svg = document.getElementById('radar-svg');
  if (!wrap || !svg) return;

  if (available.length < 3) {
    wrap.style.display = 'none';
    return;
  }

  wrap.style.display = 'block';
  svg.innerHTML = '';

  const cx = 100, cy = 100, maxR = 70;
  const n = available.length;
  const fontSize = n > 7 ? '8' : '10';

  // Grid rings
  for (let ring = 1; ring <= 3; ring++) {
    const r = (ring / 3) * maxR;
    const points = [];
    for (let i = 0; i < n; i++) {
      const angle = (Math.PI * 2 * i) / n - Math.PI / 2;
      points.push(`${cx + r * Math.cos(angle)},${cy + r * Math.sin(angle)}`);
    }
    const polygon = document.createElementNS('http://www.w3.org/2000/svg', 'polygon');
    polygon.setAttribute('points', points.join(' '));
    polygon.setAttribute('fill', 'none');
    polygon.setAttribute('stroke', 'var(--border)');
    polygon.setAttribute('stroke-width', '0.5');
    svg.appendChild(polygon);
  }

  // Axes
  for (let i = 0; i < n; i++) {
    const angle = (Math.PI * 2 * i) / n - Math.PI / 2;
    const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
    line.setAttribute('x1', cx);
    line.setAttribute('y1', cy);
    line.setAttribute('x2', cx + maxR * Math.cos(angle));
    line.setAttribute('y2', cy + maxR * Math.sin(angle));
    line.setAttribute('stroke', 'var(--border)');
    line.setAttribute('stroke-width', '0.5');
    svg.appendChild(line);
  }

  // Compute final data coordinates
  const dataCoords = [];
  for (let i = 0; i < n; i++) {
    const angle = (Math.PI * 2 * i) / n - Math.PI / 2;
    const val = Math.min(parseFloat(extendedScores[available[i].key]) || 0, 10) / 10;
    const r = val * maxR;
    dataCoords.push({ x: cx + r * Math.cos(angle), y: cy + r * Math.sin(angle) });
  }

  // Build final path
  let finalD = `M ${dataCoords[0].x} ${dataCoords[0].y}`;
  for (let i = 1; i < n; i++) finalD += ` L ${dataCoords[i].x} ${dataCoords[i].y}`;
  finalD += ' Z';

  // Fill polygon
  const fillPoly = document.createElementNS('http://www.w3.org/2000/svg', 'path');
  fillPoly.setAttribute('fill', 'var(--ac-soft)');
  fillPoly.setAttribute('stroke', 'none');
  svg.appendChild(fillPoly);

  // Stroke polygon
  const strokePoly = document.createElementNS('http://www.w3.org/2000/svg', 'path');
  strokePoly.setAttribute('fill', 'none');
  strokePoly.setAttribute('stroke', 'var(--ac)');
  strokePoly.setAttribute('stroke-width', '2');
  strokePoly.setAttribute('stroke-linejoin', 'round');
  svg.appendChild(strokePoly);

  // Morph from center to final positions
  if (!REDUCED.matches) {
    const duration = 800;
    const start = performance.now();
    function morphTick(now) {
      const progress = Math.min((now - start) / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      let d = `M ${cx + (dataCoords[0].x - cx) * eased} ${cy + (dataCoords[0].y - cy) * eased}`;
      for (let i = 1; i < n; i++) {
        d += ` L ${cx + (dataCoords[i].x - cx) * eased} ${cy + (dataCoords[i].y - cy) * eased}`;
      }
      d += ' Z';
      fillPoly.setAttribute('d', d);
      strokePoly.setAttribute('d', d);
      if (progress < 1) requestAnimationFrame(morphTick);
    }
    requestAnimationFrame(morphTick);
  } else {
    fillPoly.setAttribute('d', finalD);
    strokePoly.setAttribute('d', finalD);
  }

  // Interactive vertex dots with tooltips
  for (let i = 0; i < n; i++) {
    const val = Math.min(parseFloat(extendedScores[available[i].key]) || 0, 10) / 10;
    const scoreVal = (val * 10).toFixed(1);

    const dot = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
    dot.setAttribute('cx', dataCoords[i].x);
    dot.setAttribute('cy', dataCoords[i].y);
    dot.setAttribute('r', '4');
    dot.setAttribute('fill', 'var(--ac)');
    dot.style.cursor = 'pointer';
    svg.appendChild(dot);

    const tooltip = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    tooltip.style.opacity = '0';
    tooltip.style.transition = 'opacity 150ms ease';

    const tooltipBg = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
    const tipX = dataCoords[i].x - 28;
    const tipY = dataCoords[i].y - 28;
    tooltipBg.setAttribute('x', tipX);
    tooltipBg.setAttribute('y', tipY);
    tooltipBg.setAttribute('width', '56');
    tooltipBg.setAttribute('height', '20');
    tooltipBg.setAttribute('rx', '4');
    tooltipBg.setAttribute('fill', 'var(--bg2)');
    tooltipBg.setAttribute('stroke', 'var(--border)');
    tooltipBg.setAttribute('stroke-width', '0.5');
    tooltip.appendChild(tooltipBg);

    const tipText = document.createElementNS('http://www.w3.org/2000/svg', 'text');
    tipText.setAttribute('x', dataCoords[i].x);
    tipText.setAttribute('y', tipY + 14);
    tipText.setAttribute('text-anchor', 'middle');
    tipText.setAttribute('fill', 'var(--fg)');
    tipText.setAttribute('font-size', '9');
    tipText.setAttribute('font-family', 'var(--font-data)');
    tipText.textContent = `${available[i].full}: ${scoreVal}`;
    tooltip.appendChild(tipText);

    svg.appendChild(tooltip);

    dot.addEventListener('mouseenter', () => { tooltip.style.opacity = '1'; });
    dot.addEventListener('mouseleave', () => { tooltip.style.opacity = '0'; });
    dot.addEventListener('touchstart', (e) => { e.preventDefault(); tooltip.style.opacity = '1'; }, { passive: false });
    dot.addEventListener('touchend', () => { setTimeout(() => { tooltip.style.opacity = '0'; }, 1500); });
  }

  // Labels
  for (let i = 0; i < n; i++) {
    const angle = (Math.PI * 2 * i) / n - Math.PI / 2;
    const labelR = maxR + 18;
    const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
    text.setAttribute('x', cx + labelR * Math.cos(angle));
    text.setAttribute('y', cy + labelR * Math.sin(angle));
    text.setAttribute('text-anchor', 'middle');
    text.setAttribute('dominant-baseline', 'middle');
    text.setAttribute('fill', 'var(--fg2)');
    text.setAttribute('font-size', fontSize);
    text.setAttribute('font-family', 'var(--font-data)');
    text.textContent = available[i].full;
    svg.appendChild(text);
  }
}

/* ---- Google Rating Count-Up Animation ---- */
export function animateGoogleRating(ratingValue) {
  const numEl = document.getElementById('google-rating-num');
  if (!numEl) return;

  const target = parseFloat(ratingValue) || 0;

  if (REDUCED.matches) {
    numEl.textContent = target.toFixed(1);
    return;
  }

  const duration = 1000;
  const start = performance.now();

  function tick(now) {
    const elapsed = now - start;
    const progress = Math.min(elapsed / duration, 1);
    const eased = 1 - Math.pow(1 - progress, 3);
    numEl.textContent = (target * eased).toFixed(1);
    if (progress < 1) requestAnimationFrame(tick);
    else numEl.textContent = target.toFixed(1);
  }
  requestAnimationFrame(tick);
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

/* ---- Logo Animation Init (Pin-Fork) ---- */
export function initLogoAnimation() {
  const pin = document.querySelector('.logo-mark--loading .logo-mark__pin--draw');
  if (pin && pin.getTotalLength) {
    const len = pin.getTotalLength();
    pin.style.strokeDasharray = len;
    pin.style.strokeDashoffset = len;
  }

  const tines = document.querySelectorAll('.logo-mark--loading .logo-mark__tine--draw');
  tines.forEach(t => {
    if (t.getTotalLength) {
      const len = t.getTotalLength();
      t.style.strokeDasharray = len;
      t.style.strokeDashoffset = len;
    }
  });
}

/* ---- Logo Loading Transition (Header -> Center -> Header) ---- */
export function animateLogoToCenter() {
  if (REDUCED.matches) return { returnToHeader: () => {} };

  const headerLogo = document.querySelector('.header__logo');
  if (!headerLogo) return { returnToHeader: () => {} };

  // Capture header logo's current position
  const startRect = headerLogo.getBoundingClientRect();

  // Set header logo to fixed position at its current location
  headerLogo.style.position = 'fixed';
  headerLogo.style.left = startRect.left + 'px';
  headerLogo.style.top = startRect.top + 'px';
  headerLogo.style.zIndex = '9999';
  headerLogo.style.pointerEvents = 'none';

  // Calculate center of viewport
  const centerX = window.innerWidth / 2 - startRect.width / 2;
  const centerY = window.innerHeight / 2 - startRect.height / 2;

  // Animate to center using transform for GPU compositing
  requestAnimationFrame(() => {
    headerLogo.style.transition = 'transform 500ms cubic-bezier(0.34, 1.56, 0.64, 1)';
    const dx = centerX - startRect.left;
    const dy = centerY - startRect.top;
    headerLogo.style.transform = `translate(${dx}px, ${dy}px) scale(2)`;
  });

  return {
    returnToHeader: () => {
      // Animate back
      headerLogo.style.transition = 'transform 400ms cubic-bezier(0.4, 0, 0.2, 1)';
      headerLogo.style.transform = 'translate(0, 0) scale(1)';

      // After transition, reset inline styles
      const cleanup = () => {
        headerLogo.style.position = '';
        headerLogo.style.left = '';
        headerLogo.style.top = '';
        headerLogo.style.zIndex = '';
        headerLogo.style.pointerEvents = '';
        headerLogo.style.transition = '';
        headerLogo.style.transform = '';
        headerLogo.removeEventListener('transitionend', cleanup);
      };
      headerLogo.addEventListener('transitionend', cleanup, { once: true });

      // Fallback cleanup after 500ms
      setTimeout(cleanup, 500);
    }
  };
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

  const PARTICLE_COUNT = 60;
  const particles = [];

  for (let i = 0; i < PARTICLE_COUNT; i++) {
    particles.push({
      x: Math.random() * w,
      y: Math.random() * h,
      targetX: centerX + (Math.random() - 0.5) * 40,
      targetY: centerY + (Math.random() - 0.5) * 40,
      size: Math.random() * 2.5 + 0.5,
      speed: Math.random() * 0.5 + 0.3,
    });
  }

  const startTime = performance.now();
  const DRIFT = 1000;
  const CONVERGE = 800;
  const HOLD = 400;

  function draw(now) {
    const elapsed = now - startTime;
    ctx.clearRect(0, 0, w, h);

    const accentColor = getComputedStyle(canvasEl).getPropertyValue('--ac').trim() || '#6c5ce7';

    for (const p of particles) {
      let alpha = 0.3;

      if (elapsed < DRIFT) {
        p.x += (Math.random() - 0.5) * 2;
        p.y += (Math.random() - 0.5) * 2;
      } else if (elapsed < DRIFT + CONVERGE) {
        const t = (elapsed - DRIFT) / CONVERGE;
        const eased = t * t * (3 - 2 * t);
        p.x += (p.targetX - p.x) * eased * 0.08;
        p.y += (p.targetY - p.y) * eased * 0.08;
        alpha = 0.3 + t * 0.2;
      } else if (elapsed < DRIFT + CONVERGE + HOLD) {
        p.x += (p.targetX - p.x) * 0.05;
        p.y += (p.targetY - p.y) * 0.05;
        alpha = 0.5;
      } else {
        const t = (elapsed - DRIFT - CONVERGE - HOLD) / 600;
        p.x += (p.x - centerX) * 0.03;
        p.y += (p.y - centerY) * 0.03;
        alpha = Math.max(0, 1 - t);
      }

      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      ctx.fillStyle = accentColor.includes('hsl')
        ? accentColor.replace(')', ` / ${alpha})`)
        : `rgba(108, 92, 231, ${alpha})`;
      ctx.fill();
    }

    if (elapsed < DRIFT + CONVERGE + HOLD + 600) {
      particleAnimId = requestAnimationFrame(draw);
    } else {
      ctx.clearRect(0, 0, w, h);
    }
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
