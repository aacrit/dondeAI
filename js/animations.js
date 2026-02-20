/* ============================================
   DondeAI — Animations Engine
   Score ring, radar chart, particle system,
   chaos-to-order text, logo animation.
   ============================================ */

const REDUCED = matchMedia('(prefers-reduced-motion: reduce)');

/* ---- Match Ring Animation (Percentage-based, 0-100) ---- */
export function animateScoreRing(rawScore) {
  const pct = Math.round(parseFloat(rawScore) || 80);
  const fill = document.getElementById('score-ring-fill');
  const numEl = document.getElementById('score-number');
  const verdictEl = document.getElementById('score-verdict');
  if (!fill || !numEl) return;

  const circumference = 2 * Math.PI * 45; // r=45
  const target = circumference - (pct / 100) * circumference;

  fill.style.stroke = 'var(--ac)';

  if (REDUCED.matches) {
    fill.style.strokeDashoffset = target;
    numEl.textContent = pct + '%';
    return;
  }

  // Animate ring fill
  fill.style.strokeDasharray = circumference;
  fill.style.strokeDashoffset = circumference;

  requestAnimationFrame(() => {
    fill.style.transition = `stroke-dashoffset 1200ms cubic-bezier(0.34, 1.56, 0.64, 1)`;
    fill.style.strokeDashoffset = target;
  });

  // Count-up to percentage
  const duration = 1200;
  const start = performance.now();
  function tick(now) {
    const elapsed = now - start;
    const progress = Math.min(elapsed / duration, 1);
    const eased = 1 - Math.pow(1 - progress, 3);
    numEl.textContent = Math.round(pct * eased) + '%';
    if (progress < 1) requestAnimationFrame(tick);
    else numEl.textContent = pct + '%';
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

  // Celebration glow for exceptional matches (90%+)
  if (!REDUCED.matches && pct >= 90) {
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

/* ---- Petal Radar Chart (Ink Blossom — 6-axis vibe profile) ---- */
import { svgIcon, buildVibeSummary, getVibeDetail } from './utils.js';

const RADAR_DIMS = [
  { key: 'date_friendly_score',    label: 'Date',     icon: 'heart' },
  { key: 'group_friendly_score',   label: 'Group',    icon: 'usersThree' },
  { key: 'family_friendly_score',  label: 'Family',   icon: 'home' },
  { key: 'business_lunch_score',   label: 'Business', icon: 'briefcase' },
  { key: 'solo_dining_score',      label: 'Solo',     icon: 'user' },
  { key: 'hole_in_wall_factor',    label: 'Gem',      icon: 'diamond' },
];

function svgEl(tag) {
  return document.createElementNS('http://www.w3.org/2000/svg', tag);
}

function buildTeardropPath(cx, cy, angle, length) {
  const bulbW = Math.max(length * 0.32, 5);
  const perp = angle + Math.PI / 2;
  const tipX = cx + length * Math.cos(angle);
  const tipY = cy + length * Math.sin(angle);
  const cp1X = cx + length * 0.55 * Math.cos(angle) + bulbW * Math.cos(perp);
  const cp1Y = cy + length * 0.55 * Math.sin(angle) + bulbW * Math.sin(perp);
  const cp2X = cx + length * 0.55 * Math.cos(angle) - bulbW * Math.cos(perp);
  const cp2Y = cy + length * 0.55 * Math.sin(angle) - bulbW * Math.sin(perp);
  return `M ${cx} ${cy} Q ${cp1X} ${cp1Y} ${tipX} ${tipY} Q ${cp2X} ${cp2Y} ${cx} ${cy} Z`;
}

export function renderPetalRadar(scores, timers = []) {
  const $tile = document.getElementById('score-tile-radar');
  if (!$tile) return;

  const available = RADAR_DIMS.filter(d => {
    const v = scores[d.key];
    return v != null && v !== '' && !isNaN(parseFloat(v));
  });

  if (available.length < 3) {
    $tile.style.display = 'none';
    return;
  }
  $tile.style.display = '';

  const $svg = document.getElementById('petal-radar');
  if (!$svg) return;

  const cx = 120, cy = 120;
  const maxR = 62;
  const minR = 8;
  const angleStep = (2 * Math.PI) / 6;
  const startAngle = -Math.PI / 2;

  // Build slots — all 6 positions, fill data where available
  const slots = RADAR_DIMS.map(dim => {
    const found = available.find(a => a.key === dim.key);
    const val = found ? Math.min(parseFloat(scores[dim.key]) || 0, 10) : 0;
    return { ...dim, val, hasData: !!found };
  });

  // Build aria-label with values
  const ariaDesc = slots.filter(s => s.hasData)
    .map(s => `${s.label} ${s.val.toFixed(1)}`).join(', ');
  $tile.setAttribute('aria-label', `Donde Vibe: ${ariaDesc}`);

  // Get SVG groups
  const gridG = $svg.querySelector('.petal-radar__grid');
  const axesG = $svg.querySelector('.petal-radar__axes');
  const petalsG = document.getElementById('petal-radar-petals');
  const iconsG = document.getElementById('petal-radar-icons');
  gridG.innerHTML = '';
  axesG.innerHTML = '';
  petalsG.innerHTML = '';
  iconsG.innerHTML = '';

  // Concentric hexagonal guides at 33% and 66%
  [0.33, 0.66].forEach(pct => {
    const r = maxR * pct;
    const pts = [];
    for (let i = 0; i < 6; i++) {
      const a = startAngle + i * angleStep;
      pts.push(`${cx + r * Math.cos(a)},${cy + r * Math.sin(a)}`);
    }
    const poly = svgEl('polygon');
    poly.setAttribute('points', pts.join(' '));
    poly.classList.add('petal-radar__guide');
    gridG.appendChild(poly);
  });

  // Axis lines from center to each vertex
  for (let i = 0; i < 6; i++) {
    const a = startAngle + i * angleStep;
    const line = svgEl('line');
    line.setAttribute('x1', cx);
    line.setAttribute('y1', cy);
    line.setAttribute('x2', cx + maxR * Math.cos(a));
    line.setAttribute('y2', cy + maxR * Math.sin(a));
    line.classList.add('petal-radar__axis');
    axesG.appendChild(line);
  }

  // Petals
  slots.forEach((slot, i) => {
    if (!slot.hasData) return;
    const angle = startAngle + i * angleStep;
    const r = minR + (slot.val / 10) * (maxR - minR);
    const path = svgEl('path');
    path.setAttribute('d', buildTeardropPath(cx, cy, angle, r));
    path.classList.add('petal-radar__petal');
    path.setAttribute('data-dim', slot.key);
    path.setAttribute('data-value', slot.val.toFixed(1));

    if (!REDUCED.matches) {
      path.style.transformOrigin = `${cx}px ${cy}px`;
      path.style.transform = 'scale(0)';
      path.style.opacity = '0';
      const delay = 400 + i * 80;
      timers.push(setTimeout(() => {
        path.style.transition = 'transform 500ms cubic-bezier(0.34, 1.56, 0.64, 1), opacity 300ms ease-out';
        path.style.transform = 'scale(1)';
        path.style.opacity = '1';
      }, delay));
    }
    petalsG.appendChild(path);
  });

  // Icons + labels at axis tips
  slots.forEach((slot, i) => {
    if (!slot.hasData) return;
    const angle = startAngle + i * angleStep;
    const iconR = maxR + 22;
    const ix = cx + iconR * Math.cos(angle);
    const iy = cy + iconR * Math.sin(angle);

    // Icon via foreignObject
    const fo = svgEl('foreignObject');
    fo.setAttribute('x', ix - 10);
    fo.setAttribute('y', iy - 10);
    fo.setAttribute('width', 20);
    fo.setAttribute('height', 20);
    fo.setAttribute('class', 'petal-radar__icon-fo');
    const div = document.createElement('div');
    div.setAttribute('xmlns', 'http://www.w3.org/1999/xhtml');
    div.className = 'petal-radar__icon';
    div.innerHTML = svgIcon(slot.icon, 16);
    fo.appendChild(div);
    iconsG.appendChild(fo);

    // Label text
    const labelR = maxR + 40;
    const lx = cx + labelR * Math.cos(angle);
    const ly = cy + labelR * Math.sin(angle);
    const text = svgEl('text');
    text.setAttribute('x', lx);
    text.setAttribute('y', ly + 3);
    text.classList.add('petal-radar__label');
    text.textContent = slot.label;
    iconsG.appendChild(text);
  });

  // Creative vibe summary below radar
  const vibeSummary = buildVibeSummary(scores);
  if (vibeSummary) {
    let $topVibe = $tile.querySelector('.score-tile__top-vibe');
    if (!$topVibe) {
      $topVibe = document.createElement('span');
      $topVibe.className = 'score-tile__top-vibe type-structural';
      $tile.appendChild($topVibe);
    }
    $topVibe.textContent = vibeSummary;
  }
}

/* ---- Score Bloom (Unified Match Ring + Vibe Petals) ---- */

const BLOOM_STATES = { COMPACT: 'compact', BLOOMED: 'bloomed', PETAL_FOCUSED: 'petal-focused', DEEP_DIVE: 'deep-dive' };
let bloomState = BLOOM_STATES.COMPACT;
let bloomData = null;
let activePetalDim = null;

export function renderScoreBloom(dondeMatch, scores, scoringV2, sentiment, timers = []) {
  const $bloom = document.getElementById('score-bloom');
  if (!$bloom) return;

  // Store data for interaction handlers
  bloomData = { dondeMatch, scores, scoringV2, sentiment };
  bloomState = BLOOM_STATES.COMPACT;
  activePetalDim = null;
  $bloom.setAttribute('data-bloom-state', 'compact');
  $bloom.setAttribute('aria-expanded', 'false');

  // ---- Match Ring (center of bloom SVG) ----
  const pct = Math.round(parseFloat(dondeMatch) || 80);
  const $ringFill = document.getElementById('score-bloom-ring-fill');
  const $number = document.getElementById('score-bloom-number');
  const $verdict = document.getElementById('score-bloom-verdict');

  if ($ringFill) {
    const circumference = 2 * Math.PI * 60; // r=60 in bloom SVG
    const target = circumference - (pct / 100) * circumference;
    $ringFill.style.stroke = 'var(--ac)';
    $ringFill.style.strokeDasharray = String(circumference);

    if (REDUCED.matches) {
      $ringFill.style.strokeDashoffset = String(target);
      if ($number) $number.textContent = pct + '%';
    } else {
      $ringFill.style.strokeDashoffset = String(circumference);
      timers.push(setTimeout(() => {
        $ringFill.style.strokeDashoffset = String(target);
      }, 300));

      // Count-up number
      if ($number) {
        const duration = 1200;
        const start = performance.now();
        function tick(now) {
          const elapsed = now - start;
          const progress = Math.min(elapsed / duration, 1);
          const eased = 1 - Math.pow(1 - progress, 3);
          $number.textContent = Math.round(pct * eased) + '%';
          if (progress < 1) requestAnimationFrame(tick);
          else $number.textContent = pct + '%';
        }
        timers.push(setTimeout(() => requestAnimationFrame(tick), 300));
      }
    }
  }

  // Verdict label
  if ($verdict) {
    const tier = pct >= 90 ? { verdict: 'Outstanding', tier: 'high' }
      : pct >= 85 ? { verdict: 'Excellent', tier: 'high' }
      : pct >= 75 ? { verdict: 'Solid Pick', tier: 'mid' }
      : pct >= 60 ? { verdict: 'Worth a Try', tier: 'mid' }
      : { verdict: 'Adventurous', tier: 'low' };
    $verdict.textContent = tier.verdict;
    $verdict.setAttribute('data-tier', tier.tier);
    if (!REDUCED.matches) {
      $verdict.style.opacity = '0';
      timers.push(setTimeout(() => {
        $verdict.style.transition = 'opacity 400ms ease-out';
        $verdict.style.opacity = '1';
      }, 800));
    }
  }

  // ---- Vibe Petals (compact mode — small teardrops around ring) ----
  const cx = 200, cy = 200;
  const ringR = 60;
  const compactMaxR = 28; // compact petal max length from ring edge
  const compactMinR = 6;
  const angleStep = (2 * Math.PI) / 6;
  const startAngle = -Math.PI / 2;

  const available = RADAR_DIMS.filter(d => {
    const v = scores[d.key];
    return v != null && v !== '' && !isNaN(parseFloat(v));
  });

  const slots = RADAR_DIMS.map(dim => {
    const found = available.find(a => a.key === dim.key);
    const val = found ? Math.min(parseFloat(scores[dim.key]) || 0, 10) : 0;
    return { ...dim, val, hasData: !!found };
  });

  // Build aria-label
  const ariaDesc = slots.filter(s => s.hasData)
    .map(s => `${s.label} ${s.val.toFixed(1)}`).join(', ');
  $bloom.setAttribute('aria-label', `DondeAI Match ${pct}%. Vibe: ${ariaDesc}`);

  // Render petals
  const $petals = document.getElementById('score-bloom-petals');
  if ($petals) {
    $petals.innerHTML = '';

    if (available.length >= 3) {
      // Find dominant petal
      const dominant = slots.reduce((best, s) => (s.hasData && s.val > (best?.val || 0)) ? s : best, null);

      slots.forEach((slot, i) => {
        if (!slot.hasData) return;
        const angle = startAngle + i * angleStep;
        // Compact: petal starts from ring edge
        const petalStart = ringR + 4;
        const petalLen = compactMinR + (slot.val / 10) * (compactMaxR - compactMinR);
        const startX = cx + petalStart * Math.cos(angle);
        const startY = cy + petalStart * Math.sin(angle);
        const path = buildTeardropPath(startX, startY, angle, petalLen);

        const pathEl = svgEl('path');
        pathEl.setAttribute('d', path);
        pathEl.classList.add('score-bloom__petal');
        pathEl.setAttribute('data-dim', slot.key);
        pathEl.setAttribute('data-value', slot.val.toFixed(1));
        pathEl.setAttribute('data-index', String(i));

        // Dominant petal gets breathing animation
        if (dominant && slot.key === dominant.key) {
          pathEl.style.transformOrigin = `${startX}px ${startY}px`;
          if (!REDUCED.matches) {
            timers.push(setTimeout(() => {
              pathEl.classList.add('score-bloom__petal--dominant');
            }, 1100));
          }
        }

        // Entrance animation
        if (!REDUCED.matches) {
          pathEl.style.transformOrigin = `${cx}px ${cy}px`;
          pathEl.style.transform = 'scale(0)';
          pathEl.style.opacity = '0';
          const delay = 600 + i * 80;
          timers.push(setTimeout(() => {
            pathEl.style.transition = 'transform 500ms cubic-bezier(0.34, 1.56, 0.64, 1), opacity 300ms ease-out';
            pathEl.style.transform = 'scale(1)';
            pathEl.style.opacity = '1';
          }, delay));
        }

        $petals.appendChild(pathEl);
      });
    }
  }

  // ---- Sentiment Arc (thin colored ring outside match ring) ----
  const $sentimentG = document.getElementById('score-bloom-sentiment');
  if ($sentimentG && sentiment) {
    $sentimentG.innerHTML = '';
    const total = (sentiment.pos || 0) + (sentiment.neu || 0) + (sentiment.neg || 0);
    if (total > 0) {
      const sentR = ringR + 8;
      const sentWidth = 2;
      const totalAngle = 2 * Math.PI;
      const gap = 0.04; // small gap between segments

      const posAngle = (sentiment.pos / total) * totalAngle - gap;
      const neuAngle = (sentiment.neu / total) * totalAngle - gap;
      const negAngle = (sentiment.neg / total) * totalAngle - gap;

      let currentAngle = -Math.PI / 2;
      const segments = [
        { angle: posAngle, cls: 'score-bloom__sentiment-pos' },
        { angle: neuAngle, cls: 'score-bloom__sentiment-neu' },
        { angle: negAngle, cls: 'score-bloom__sentiment-neg' },
      ];

      segments.forEach(seg => {
        if (seg.angle <= 0) { currentAngle += gap; return; }
        const endAngle = currentAngle + seg.angle;
        const largeArc = seg.angle > Math.PI ? 1 : 0;
        const x1 = cx + sentR * Math.cos(currentAngle);
        const y1 = cy + sentR * Math.sin(currentAngle);
        const x2 = cx + sentR * Math.cos(endAngle);
        const y2 = cy + sentR * Math.sin(endAngle);

        const arc = svgEl('path');
        arc.setAttribute('d', `M ${x1} ${y1} A ${sentR} ${sentR} 0 ${largeArc} 1 ${x2} ${y2}`);
        arc.classList.add(seg.cls);
        arc.setAttribute('stroke-width', String(sentWidth));
        arc.setAttribute('fill', 'none');

        if (!REDUCED.matches) {
          arc.style.opacity = '0';
          timers.push(setTimeout(() => {
            arc.style.transition = 'opacity 400ms ease-out';
            arc.style.opacity = '1';
          }, 1000));
        }

        $sentimentG.appendChild(arc);
        currentAngle = endAngle + gap;
      });
    }
  }

  // ---- "Best for" Callout ----
  const $callout = document.getElementById('score-bloom-callout');
  const $calloutValue = document.getElementById('score-bloom-callout-value');
  if ($callout && $calloutValue && available.length >= 1) {
    const best = slots.filter(s => s.hasData).sort((a, b) => b.val - a.val)[0];
    if (best) {
      $calloutValue.textContent = `${best.label} · ${best.val.toFixed(1)}`;
      $callout.style.display = '';
      if (!REDUCED.matches) {
        timers.push(setTimeout(() => {
          $callout.classList.add('score-bloom__callout--visible');
        }, 900));
      } else {
        $callout.classList.add('score-bloom__callout--visible');
      }
    }
  }
}

/* ---- Bloom Interaction Handlers ---- */

export function toggleBloom() {
  const $bloom = document.getElementById('score-bloom');
  if (!$bloom || !bloomData) return;

  if (bloomState === BLOOM_STATES.COMPACT) {
    expandBloom($bloom);
  } else {
    collapseBloom($bloom);
  }
}

function expandBloom($bloom) {
  bloomState = BLOOM_STATES.BLOOMED;
  $bloom.setAttribute('data-bloom-state', 'bloomed');
  $bloom.setAttribute('aria-expanded', 'true');

  const scores = bloomData.scores;
  const cx = 200, cy = 200;
  const ringR = 60;
  const fullMaxR = 72; // full bloom petal max length
  const fullMinR = 12;
  const angleStep = (2 * Math.PI) / 6;
  const startAngle = -Math.PI / 2;

  const available = RADAR_DIMS.filter(d => {
    const v = scores[d.key];
    return v != null && v !== '' && !isNaN(parseFloat(v));
  });

  // Show grid guides
  const $grid = document.getElementById('score-bloom-grid');
  const $axes = document.getElementById('score-bloom-axes');
  if ($grid) {
    $grid.innerHTML = '';
    [0.33, 0.66].forEach(pct => {
      const r = ringR + 4 + fullMaxR * pct;
      const pts = [];
      for (let i = 0; i < 6; i++) {
        const a = startAngle + i * angleStep;
        pts.push(`${cx + r * Math.cos(a)},${cy + r * Math.sin(a)}`);
      }
      const poly = svgEl('polygon');
      poly.setAttribute('points', pts.join(' '));
      poly.classList.add('score-bloom__guide');
      $grid.appendChild(poly);
    });
    $grid.style.transition = 'opacity 300ms ease-out';
    $grid.style.opacity = '0.4';
  }

  if ($axes) {
    $axes.innerHTML = '';
    for (let i = 0; i < 6; i++) {
      const a = startAngle + i * angleStep;
      const outerR = ringR + 4 + fullMaxR;
      const line = svgEl('line');
      line.setAttribute('x1', String(cx + (ringR + 4) * Math.cos(a)));
      line.setAttribute('y1', String(cy + (ringR + 4) * Math.sin(a)));
      line.setAttribute('x2', String(cx + outerR * Math.cos(a)));
      line.setAttribute('y2', String(cy + outerR * Math.sin(a)));
      line.classList.add('score-bloom__axis');
      $axes.appendChild(line);
    }
    $axes.style.transition = 'opacity 300ms ease-out';
    $axes.style.opacity = '0.3';
  }

  // Expand petals to full size
  const $petals = document.getElementById('score-bloom-petals');
  if ($petals) {
    $petals.innerHTML = '';
    const slots = RADAR_DIMS.map(dim => {
      const found = available.find(a => a.key === dim.key);
      const val = found ? Math.min(parseFloat(scores[dim.key]) || 0, 10) : 0;
      return { ...dim, val, hasData: !!found };
    });

    slots.forEach((slot, i) => {
      if (!slot.hasData) return;
      const angle = startAngle + i * angleStep;
      const petalStart = ringR + 4;
      const petalLen = fullMinR + (slot.val / 10) * (fullMaxR - fullMinR);
      const startX = cx + petalStart * Math.cos(angle);
      const startY = cy + petalStart * Math.sin(angle);
      const path = buildTeardropPath(startX, startY, angle, petalLen);

      const pathEl = svgEl('path');
      pathEl.setAttribute('d', path);
      pathEl.classList.add('score-bloom__petal');
      pathEl.setAttribute('data-dim', slot.key);
      pathEl.setAttribute('data-value', slot.val.toFixed(1));
      pathEl.setAttribute('data-index', String(i));

      if (!REDUCED.matches) {
        pathEl.style.transformOrigin = `${cx}px ${cy}px`;
        pathEl.style.transform = 'scale(0.6)';
        pathEl.style.opacity = '0.5';
        const delay = i * 60;
        setTimeout(() => {
          pathEl.style.transition = 'transform 400ms cubic-bezier(0.34, 1.56, 0.64, 1), opacity 200ms ease-out';
          pathEl.style.transform = 'scale(1)';
          pathEl.style.opacity = '1';
        }, delay);
      }

      $petals.appendChild(pathEl);
    });
  }

  // Show labels at petal tips
  const $labels = document.getElementById('score-bloom-labels');
  if ($labels) {
    $labels.innerHTML = '';
    const slots = RADAR_DIMS.map(dim => {
      const found = available.find(a => a.key === dim.key);
      const val = found ? Math.min(parseFloat(scores[dim.key]) || 0, 10) : 0;
      return { ...dim, val, hasData: !!found };
    });

    slots.forEach((slot, i) => {
      if (!slot.hasData) return;
      const angle = startAngle + i * angleStep;
      const labelR = ringR + 4 + fullMaxR + 18;
      const lx = cx + labelR * Math.cos(angle);
      const ly = cy + labelR * Math.sin(angle);

      // Score text
      const scoreText = svgEl('text');
      scoreText.setAttribute('x', String(lx));
      scoreText.setAttribute('y', String(ly + 3));
      scoreText.classList.add('score-bloom__tip-label');
      scoreText.textContent = `${slot.label} ${slot.val.toFixed(1)}`;
      $labels.appendChild(scoreText);
    });

    $labels.style.transition = 'opacity 300ms ease-out';
    $labels.style.opacity = '1';
  }
}

function collapseBloom($bloom) {
  bloomState = BLOOM_STATES.COMPACT;
  activePetalDim = null;
  $bloom.setAttribute('data-bloom-state', 'compact');
  $bloom.setAttribute('aria-expanded', 'false');

  // Re-render compact petals
  if (bloomData) {
    const fakeTimers = [];
    renderCompactPetals(bloomData.scores, fakeTimers);
  }

  // Hide grid, axes, labels
  const $grid = document.getElementById('score-bloom-grid');
  const $axes = document.getElementById('score-bloom-axes');
  const $labels = document.getElementById('score-bloom-labels');
  if ($grid) { $grid.style.opacity = '0'; $grid.innerHTML = ''; }
  if ($axes) { $axes.style.opacity = '0'; $axes.innerHTML = ''; }
  if ($labels) { $labels.style.opacity = '0'; $labels.innerHTML = ''; }

  // Hide detail strip
  hideBloomDetail();
}

function renderCompactPetals(scores, timers) {
  const cx = 200, cy = 200;
  const ringR = 60;
  const compactMaxR = 28;
  const compactMinR = 6;
  const angleStep = (2 * Math.PI) / 6;
  const startAngle = -Math.PI / 2;

  const available = RADAR_DIMS.filter(d => {
    const v = scores[d.key];
    return v != null && v !== '' && !isNaN(parseFloat(v));
  });

  const slots = RADAR_DIMS.map(dim => {
    const found = available.find(a => a.key === dim.key);
    const val = found ? Math.min(parseFloat(scores[dim.key]) || 0, 10) : 0;
    return { ...dim, val, hasData: !!found };
  });

  const $petals = document.getElementById('score-bloom-petals');
  if (!$petals || available.length < 3) return;
  $petals.innerHTML = '';

  const dominant = slots.reduce((best, s) => (s.hasData && s.val > (best?.val || 0)) ? s : best, null);

  slots.forEach((slot, i) => {
    if (!slot.hasData) return;
    const angle = startAngle + i * angleStep;
    const petalStart = ringR + 4;
    const petalLen = compactMinR + (slot.val / 10) * (compactMaxR - compactMinR);
    const startX = cx + petalStart * Math.cos(angle);
    const startY = cy + petalStart * Math.sin(angle);
    const path = buildTeardropPath(startX, startY, angle, petalLen);

    const pathEl = svgEl('path');
    pathEl.setAttribute('d', path);
    pathEl.classList.add('score-bloom__petal');
    pathEl.setAttribute('data-dim', slot.key);
    pathEl.setAttribute('data-value', slot.val.toFixed(1));
    pathEl.setAttribute('data-index', String(i));

    if (dominant && slot.key === dominant.key && !REDUCED.matches) {
      pathEl.style.transformOrigin = `${startX}px ${startY}px`;
      pathEl.classList.add('score-bloom__petal--dominant');
    }

    if (!REDUCED.matches) {
      pathEl.style.transformOrigin = `${cx}px ${cy}px`;
      pathEl.style.transform = 'scale(0.6)';
      pathEl.style.opacity = '0.5';
      const delay = i * 50;
      setTimeout(() => {
        pathEl.style.transition = 'transform 300ms cubic-bezier(0.34, 1.56, 0.64, 1), opacity 200ms ease-out';
        pathEl.style.transform = 'scale(1)';
        pathEl.style.opacity = '1';
      }, delay);
    }

    $petals.appendChild(pathEl);
  });
}

export function handlePetalTap(dimKey) {
  if (bloomState !== BLOOM_STATES.BLOOMED && bloomState !== BLOOM_STATES.PETAL_FOCUSED) return;
  if (!bloomData) return;

  // Toggle same petal off
  if (activePetalDim === dimKey) {
    activePetalDim = null;
    bloomState = BLOOM_STATES.BLOOMED;
    resetPetalHighlights();
    hideBloomDetail();
    return;
  }

  activePetalDim = dimKey;
  bloomState = BLOOM_STATES.PETAL_FOCUSED;

  // Highlight active, dim others
  const $petals = document.querySelectorAll('.score-bloom__petal');
  $petals.forEach(p => {
    if (p.getAttribute('data-dim') === dimKey) {
      p.classList.add('score-bloom__petal--active');
      p.classList.remove('score-bloom__petal--dimmed');
    } else {
      p.classList.remove('score-bloom__petal--active');
      p.classList.add('score-bloom__petal--dimmed');
    }
  });

  // Show detail strip
  showBloomDetail(dimKey);
}

function showBloomDetail(dimKey) {
  const $detail = document.getElementById('score-bloom-detail');
  if (!$detail || !bloomData) return;

  const dim = RADAR_DIMS.find(d => d.key === dimKey);
  if (!dim) return;

  const val = parseFloat(bloomData.scores[dimKey]) || 0;
  const pct = (val / 10) * 100;

  const $icon = document.getElementById('score-bloom-detail-icon');
  const $label = document.getElementById('score-bloom-detail-label');
  const $score = document.getElementById('score-bloom-detail-score');
  const $fill = document.getElementById('score-bloom-detail-fill');
  const $desc = document.getElementById('score-bloom-detail-desc');

  if ($icon) $icon.innerHTML = svgIcon(dim.icon, 18);
  if ($label) $label.textContent = dim.label;
  if ($score) $score.textContent = `${val.toFixed(1)} / 10`;
  if ($fill) $fill.style.width = `${pct}%`;
  if ($desc) {
    const detail = getVibeDetail(dimKey, val);
    $desc.textContent = detail;
  }

  $detail.style.display = 'block';
  requestAnimationFrame(() => {
    $detail.classList.add('score-bloom__detail--visible');
  });
}

function hideBloomDetail() {
  const $detail = document.getElementById('score-bloom-detail');
  if ($detail) {
    $detail.classList.remove('score-bloom__detail--visible');
    setTimeout(() => { $detail.style.display = 'none'; }, 300);
  }
}

function resetPetalHighlights() {
  const $petals = document.querySelectorAll('.score-bloom__petal');
  $petals.forEach(p => {
    p.classList.remove('score-bloom__petal--active', 'score-bloom__petal--dimmed');
  });
}

export function handleBloomRingTap() {
  if (bloomState !== BLOOM_STATES.BLOOMED && bloomState !== BLOOM_STATES.PETAL_FOCUSED) return;
  if (!bloomData || !bloomData.scoringV2) return;

  const $bloom = document.getElementById('score-bloom');
  if (bloomState === BLOOM_STATES.DEEP_DIVE) {
    // Exit deep dive
    bloomState = BLOOM_STATES.BLOOMED;
    $bloom?.setAttribute('data-bloom-state', 'bloomed');
    hideV2Arcs();
    return;
  }

  bloomState = BLOOM_STATES.DEEP_DIVE;
  $bloom?.setAttribute('data-bloom-state', 'deep-dive');
  activePetalDim = null;
  resetPetalHighlights();
  hideBloomDetail();
  showV2Arcs();
}

function showV2Arcs() {
  const $v2 = document.getElementById('score-bloom-v2');
  if (!$v2 || !bloomData?.scoringV2) return;

  $v2.innerHTML = '';
  const sv2 = bloomData.scoringV2;
  const cx = 200, cy = 200;
  const ringR = 60;

  const v2Dims = [
    { key: 'occasion_fit',    label: 'Occasion' },
    { key: 'craving_match',   label: 'Craving' },
    { key: 'vibe_alignment',  label: 'Vibe' },
    { key: 'practical_fit',   label: 'Practical' },
    { key: 'discovery_value', label: 'Discovery' },
  ];

  v2Dims.forEach((dim, i) => {
    const val = Math.min(Math.max(sv2[dim.key] || 0, 0), 100);
    const arcR = ringR - 10 - i * 7; // concentric inward
    const circumference = 2 * Math.PI * arcR;
    const offset = circumference - (val / 100) * circumference;

    const circle = svgEl('circle');
    circle.setAttribute('cx', String(cx));
    circle.setAttribute('cy', String(cy));
    circle.setAttribute('r', String(arcR));
    circle.classList.add('score-bloom__v2-arc');
    circle.setAttribute('data-dim', dim.key);
    circle.style.strokeDasharray = String(circumference);
    circle.style.strokeDashoffset = String(circumference);
    circle.style.transform = 'rotate(-90deg)';
    circle.style.transformOrigin = `${cx}px ${cy}px`;
    $v2.appendChild(circle);

    // Label
    const labelAngle = -Math.PI / 2 + (i * 0.25);
    const text = svgEl('text');
    text.setAttribute('x', String(cx + arcR + 5));
    text.setAttribute('y', String(cy - arcR * 0.3 + i * 12));
    text.classList.add('score-bloom__v2-label');
    text.textContent = `${dim.label} ${val}%`;
    $v2.appendChild(text);

    // Animate arc draw-in
    if (!REDUCED.matches) {
      setTimeout(() => {
        circle.style.strokeDashoffset = String(offset);
        text.style.opacity = '1';
      }, 100 + i * 80);
    } else {
      circle.style.strokeDashoffset = String(offset);
      text.style.opacity = '1';
    }
  });

  $v2.style.transition = 'opacity 300ms ease-out';
  $v2.style.opacity = '1';
}

function hideV2Arcs() {
  const $v2 = document.getElementById('score-bloom-v2');
  if ($v2) {
    $v2.style.opacity = '0';
    setTimeout(() => { $v2.innerHTML = ''; }, 300);
  }
}

export function getBloomState() { return bloomState; }

/* ---- Sentiment Bar (horizontal mood indicator) ---- */
export function renderSentimentBar(pos, neu, neg, timers = []) {
  const total = pos + neu + neg;
  if (total === 0) return;

  const $bar = document.getElementById('sentiment-bar');
  if (!$bar) return;
  $bar.style.display = '';

  const posEl = document.getElementById('sentiment-bar-pos');
  const neuEl = document.getElementById('sentiment-bar-neu');
  const negEl = document.getElementById('sentiment-bar-neg');

  const posPct = pos / total;
  const neuPct = neu / total;
  const negPct = neg / total;

  // Animated width grow
  [posEl, neuEl, negEl].forEach(el => { if (el) el.style.flex = '0'; });

  if (!REDUCED.matches) {
    timers.push(setTimeout(() => {
      if (posEl) posEl.style.flex = String(posPct);
      if (neuEl) neuEl.style.flex = String(neuPct);
      if (negEl) negEl.style.flex = String(negPct);
    }, 800));
  } else {
    if (posEl) posEl.style.flex = String(posPct);
    if (neuEl) neuEl.style.flex = String(neuPct);
    if (negEl) negEl.style.flex = String(negPct);
  }
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
