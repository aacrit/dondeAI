/* ============================================
   DondeAI — Animations Engine
   Score ring, radar chart, particle system.
   ============================================ */

const REDUCED = matchMedia('(prefers-reduced-motion: reduce)');

/* ---- Score Ring Animation ---- */
export function animateScoreRing(score) {
  const n = parseFloat(score) || 0;
  const fill = document.getElementById('score-ring-fill');
  const numEl = document.getElementById('score-number');
  const verdictEl = document.getElementById('score-verdict');
  if (!fill || !numEl) return;

  const circumference = 2 * Math.PI * 45; // r=45
  const target = circumference - (n / 10) * circumference;

  // Color
  let color = 'var(--ac)';
  if (n >= 8) color = 'var(--green)';
  else if (n < 4) color = 'var(--rose)';
  fill.style.stroke = color;

  if (REDUCED.matches) {
    fill.style.strokeDashoffset = target;
    numEl.textContent = n.toFixed(1);
    return;
  }

  // Animate
  fill.style.strokeDasharray = circumference;
  fill.style.strokeDashoffset = circumference;

  requestAnimationFrame(() => {
    // Critically-damped spring (no overshoot) — system-initiated motion
    fill.style.transition = `stroke-dashoffset 1200ms cubic-bezier(0.2, 1, 0.4, 1)`;
    fill.style.strokeDashoffset = target;
  });

  // Count-up
  const duration = 1200;
  const start = performance.now();
  function tick(now) {
    const elapsed = now - start;
    const progress = Math.min(elapsed / duration, 1);
    // Spring-like ease
    const eased = 1 - Math.pow(1 - progress, 3);
    const current = n * eased;
    numEl.textContent = current.toFixed(1);
    if (progress < 1) requestAnimationFrame(tick);
  }
  requestAnimationFrame(tick);

  // Verdict appears with ring animation (no separate timeout)
  if (verdictEl) {
    verdictEl.style.opacity = '0';
    verdictEl.style.transform = 'translateY(6px)';
    requestAnimationFrame(() => {
      verdictEl.style.transition = 'opacity 400ms ease-out 200ms, transform 400ms ease-out 200ms';
      verdictEl.style.opacity = '1';
      verdictEl.style.transform = 'translateY(0)';
    });
  }
}

/* ---- Radar Chart ---- */
export function renderRadar(scores) {
  const dimensions = [
    { key: 'date_friendly_score', short: 'DT', full: 'Date' },
    { key: 'group_friendly_score', short: 'GR', full: 'Group' },
    { key: 'family_friendly_score', short: 'FM', full: 'Family' },
    { key: 'business_lunch_score', short: 'BZ', full: 'Business' },
    { key: 'solo_dining_score', short: 'SL', full: 'Solo' },
    { key: 'hole_in_wall_factor', short: 'GM', full: 'Gem' },
  ];

  const available = dimensions.filter(d => {
    const v = scores[d.key];
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

  // Data polygon with edge-by-edge draw-in
  const dataCoords = [];
  for (let i = 0; i < n; i++) {
    const angle = (Math.PI * 2 * i) / n - Math.PI / 2;
    const val = Math.min(parseFloat(scores[available[i].key]) || 0, 10) / 10;
    const r = val * maxR;
    dataCoords.push({ x: cx + r * Math.cos(angle), y: cy + r * Math.sin(angle) });
  }

  // Build path string for polygon
  let pathD = `M ${dataCoords[0].x} ${dataCoords[0].y}`;
  for (let i = 1; i < n; i++) {
    pathD += ` L ${dataCoords[i].x} ${dataCoords[i].y}`;
  }
  pathD += ' Z';

  // Fill polygon (no animation)
  const fillPoly = document.createElementNS('http://www.w3.org/2000/svg', 'path');
  fillPoly.setAttribute('d', pathD);
  fillPoly.setAttribute('fill', 'var(--ac-soft)');
  fillPoly.setAttribute('stroke', 'none');
  svg.appendChild(fillPoly);

  // Stroke polygon with draw-in animation
  const strokePoly = document.createElementNS('http://www.w3.org/2000/svg', 'path');
  strokePoly.setAttribute('d', pathD);
  strokePoly.setAttribute('fill', 'none');
  strokePoly.setAttribute('stroke', 'var(--ac)');
  strokePoly.setAttribute('stroke-width', '2');
  strokePoly.setAttribute('stroke-linejoin', 'round');
  svg.appendChild(strokePoly);

  // Calculate total path length for animation
  if (!REDUCED.matches) {
    requestAnimationFrame(() => {
      const totalLen = strokePoly.getTotalLength();
      strokePoly.style.strokeDasharray = totalLen;
      strokePoly.style.strokeDashoffset = totalLen;
      requestAnimationFrame(() => {
        strokePoly.style.transition = `stroke-dashoffset 800ms cubic-bezier(0.2, 1, 0.4, 1)`;
        strokePoly.style.strokeDashoffset = '0';
      });
    });
  }

  // Interactive vertex dots with tooltips
  for (let i = 0; i < n; i++) {
    const val = Math.min(parseFloat(scores[available[i].key]) || 0, 10) / 10;
    const scoreVal = (val * 10).toFixed(1);

    // Dot
    const dot = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
    dot.setAttribute('cx', dataCoords[i].x);
    dot.setAttribute('cy', dataCoords[i].y);
    dot.setAttribute('r', '4');
    dot.setAttribute('fill', 'var(--ac)');
    dot.style.cursor = 'pointer';
    svg.appendChild(dot);

    // Tooltip group (hidden initially)
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

    // Hover/touch handlers
    dot.addEventListener('mouseenter', () => { tooltip.style.opacity = '1'; });
    dot.addEventListener('mouseleave', () => { tooltip.style.opacity = '0'; });
    dot.addEventListener('touchstart', (e) => { e.preventDefault(); tooltip.style.opacity = '1'; }, { passive: false });
    dot.addEventListener('touchend', () => { setTimeout(() => { tooltip.style.opacity = '0'; }, 1500); });
  }

  // Full labels (not abbreviated)
  for (let i = 0; i < n; i++) {
    const angle = (Math.PI * 2 * i) / n - Math.PI / 2;
    const labelR = maxR + 18;
    const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
    text.setAttribute('x', cx + labelR * Math.cos(angle));
    text.setAttribute('y', cy + labelR * Math.sin(angle));
    text.setAttribute('text-anchor', 'middle');
    text.setAttribute('dominant-baseline', 'middle');
    text.setAttribute('fill', 'var(--fg2)');
    text.setAttribute('font-size', '10');
    text.setAttribute('font-family', 'var(--font-data)');
    text.textContent = available[i].full;
    svg.appendChild(text);
  }
}

/* ---- Particle System ---- */
let particleAnimId = null;

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

  // Resize canvas with parent
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
      phase: 0, // 0=drift, 1=converge, 2=hold, 3=disperse
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
        // Brownian drift
        p.x += (Math.random() - 0.5) * 2;
        p.y += (Math.random() - 0.5) * 2;
      } else if (elapsed < DRIFT + CONVERGE) {
        // Converge to center
        const t = (elapsed - DRIFT) / CONVERGE;
        const eased = t * t * (3 - 2 * t);
        p.x += (p.targetX - p.x) * eased * 0.08;
        p.y += (p.targetY - p.y) * eased * 0.08;
        alpha = 0.3 + t * 0.2;
      } else if (elapsed < DRIFT + CONVERGE + HOLD) {
        // Hold
        p.x += (p.targetX - p.x) * 0.05;
        p.y += (p.targetY - p.y) * 0.05;
        alpha = 0.5;
      } else {
        // Disperse
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

let particleResizeObs = null;

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
