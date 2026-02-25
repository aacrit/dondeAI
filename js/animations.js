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
  // V4: Geometric mean — celebration at 85+ (was 90+ in power-law V3)
  if (!REDUCED.matches && pct >= 85) {
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
import { svgIcon, buildVibeSummary, getScoreThresholdColor, getScoreTier, getFactorColor } from './utils.js';

const RADAR_DIMS = [
  { key: 'date_friendly_score',    label: 'Date',     icon: 'heart' },
  { key: 'group_friendly_score',   label: 'Group',    icon: 'usersThree' },
  { key: 'family_friendly_score',  label: 'Family',   icon: 'home' },
  { key: 'business_lunch_score',   label: 'Business', icon: 'briefcase' },
  { key: 'solo_dining_score',      label: 'Solo',     icon: 'user' },
  { key: 'hole_in_wall_factor',    label: 'Gem',      icon: 'diamond' },
];

/** V4 Factor dimensions (geometric mean scoring) */
const FACTOR_DIMS = [
  { key: 'food_quality',  label: 'Food Quality', icon: 'plate' },
  { key: 'vibe',          label: 'Vibe',         icon: 'music' },
  { key: 'service',       label: 'Service',      icon: 'diamond' },
  { key: 'reputation',    label: 'Reputation',   icon: 'starFull' },
  { key: 'convenience',   label: 'Convenience',  icon: 'clock' },
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
    .map(s => `${s.label} ${humanizeVibeScore(s.val)}`).join(', ');
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

/* ---- Score Hero (Semicircular arc gauge) ---- */

let heroData = null;

export function renderScoreHero(dondeMatch, scores, scoringV2, sentiment, timers = []) {
  const $hero = document.getElementById('score-hero');
  if (!$hero) return;

  heroData = { dondeMatch, scores, scoringV2, sentiment };

  // ---- Semicircular Arc Gauge ----
  const pct = Math.round(parseFloat(dondeMatch) || 80);
  const $arcFill = document.getElementById('score-hero-arc-fill');
  const $number = document.getElementById('score-hero-number');
  const $verdict = document.getElementById('score-hero-verdict');

  // Calculate arc length for 180° semicircle (r=80, from M 20 110 A 80 80 0 0 1 180 110)
  const arcLength = Math.PI * 80; // ~251.3
  const target = arcLength - (pct / 100) * arcLength;

  if ($arcFill) {
    $arcFill.style.transition = 'none';
    $arcFill.style.strokeDasharray = String(arcLength);

    if (REDUCED.matches) {
      // Instant — no animation
      $arcFill.style.strokeDashoffset = String(target);
      $arcFill.style.stroke = getScoreThresholdColor(pct);
      if ($number) {
        $number.textContent = pct + '%';
        $number.style.color = getScoreThresholdColor(pct);
      }
    } else {
      // JS-driven frame-by-frame animation: arc fill + color + number synced
      $arcFill.style.strokeDashoffset = String(arcLength);
      $arcFill.style.stroke = getScoreThresholdColor(0);

      const duration = 1800;
      timers.push(setTimeout(() => {
        const startTime = performance.now();
        function tick(now) {
          const elapsed = now - startTime;
          const progress = Math.min(elapsed / duration, 1);
          const eased = 1 - Math.pow(1 - progress, 3);

          const currentPct = Math.round(pct * eased);
          const currentOffset = arcLength - (currentPct / 100) * arcLength;

          $arcFill.style.strokeDashoffset = String(currentOffset);
          $arcFill.style.stroke = getScoreThresholdColor(currentPct);

          if ($number) {
            $number.textContent = currentPct + '%';
            $number.style.color = getScoreThresholdColor(currentPct);
          }

          if (progress < 1) requestAnimationFrame(tick);
          else if ($number) {
            $number.textContent = pct + '%';
            $number.style.color = getScoreThresholdColor(pct);
          }
        }
        requestAnimationFrame(tick);
      }, 300));
    }
  }

  // Verdict label — V3.3 (DV5): unified with getScoreTier() instead of inline duplicate
  if ($verdict) {
    const tier = getScoreTier(pct);
    $verdict.textContent = tier.verdict;
    $verdict.setAttribute('data-tier', tier.tier);
    if (!REDUCED.matches) {
      $verdict.style.opacity = '0';
      timers.push(setTimeout(() => {
        $verdict.style.transition = 'opacity 400ms ease-out';
        $verdict.style.opacity = '1';
      }, 1200));
    }
  }

  // (Sentiment arc removed — sentiment now lives in reviews-row inline bar)

  // ---- V3: "Strongest" Callout (replaces "Best for") ----
  const $callout = document.getElementById('score-hero-callout');
  const $calloutValue = document.getElementById('score-hero-callout-value');

  if ($callout && $calloutValue && scoringV2) {
    // V3: Find the strongest factor from scoring_v3 data
    const sv3 = scoringV2; // Passed as scoringV2 param but may contain V3 data
    const factorEntries = FACTOR_DIMS.filter(d => sv3[d.key] != null);
    if (factorEntries.length > 0) {
      const best = factorEntries.reduce((a, b) =>
        (sv3[a.key] || 0) > (sv3[b.key] || 0) ? a : b
      );
      const bestScore = (sv3[best.key] || 0).toFixed(1);
      $calloutValue.textContent = `${best.label} (${bestScore})`;
      $callout.style.display = '';
      if (!REDUCED.matches) {
        timers.push(setTimeout(() => {
          $callout.classList.add('score-hero__callout--visible');
        }, 900));
      } else {
        $callout.classList.add('score-hero__callout--visible');
      }
    }
  } else if ($callout && $calloutValue) {
    // Fallback: use old vibe scores if V3 not available
    const available = RADAR_DIMS.filter(d => {
      const v = scores[d.key];
      return v != null && v !== '' && !isNaN(parseFloat(v));
    });
    const slots = RADAR_DIMS.map(dim => {
      const found = available.find(a => a.key === dim.key);
      const val = found ? Math.min(parseFloat(scores[dim.key]) || 0, 10) : 0;
      return { ...dim, val, hasData: !!found };
    });
    const best = slots.filter(s => s.hasData).sort((a, b) => b.val - a.val)[0];
    if (best) {
      $calloutValue.textContent = best.label;
      $callout.style.display = '';
      if (!REDUCED.matches) {
        timers.push(setTimeout(() => {
          $callout.classList.add('score-hero__callout--visible');
        }, 900));
      } else {
        $callout.classList.add('score-hero__callout--visible');
      }
    }
  }

  // V3: Auto-expand factor bars when score < 80
  if (scoringV2 && pct < 80) {
    timers.push(setTimeout(() => {
      autoExpandFactors(scoringV2, timers);
    }, 1400));
  }

  // Build aria-label
  if (scoringV2) {
    const ariaDesc = FACTOR_DIMS
      .filter(d => scoringV2[d.key] != null)
      .map(d => `${d.label} ${(scoringV2[d.key] || 0).toFixed(1)} out of 10`)
      .join(', ');
    $hero.setAttribute('aria-label', `DondeAI Match ${pct}%. Factors: ${ariaDesc}`);
  } else {
    $hero.setAttribute('aria-label', `DondeAI Match ${pct}%`);
  }
}

/* ---- V3 Factor Bars (horizontal dimension bars — replaces vibe bars) ---- */

export function renderFactorBars(scoringData, timers = []) {
  const $container = document.getElementById('factor-bars');
  const $list = document.getElementById('factor-bars-list');
  if (!$container || !$list) return;

  // V4: Accept either scoring_v4 or scoring_v3 format
  const scoringV4 = scoringData;
  if (!scoringV4) return;

  $list.innerHTML = '';

  // V4: Extract dynamic weights for display
  const weightsUsed = scoringV4.weights_used || {};

  const slots = FACTOR_DIMS
    .map(dim => ({
      ...dim,
      val: scoringV4[dim.key] != null ? Math.min(parseFloat(scoringV4[dim.key]) || 0, 10) : null,
      weight: weightsUsed[dim.key] != null ? Math.round(parseFloat(weightsUsed[dim.key]) * 100) : null,
      confidence: scoringV4.confidence?.[dim.key] || null,
    }))
    .filter(s => s.val !== null);

  if (slots.length < 2) return;

  // Find strongest factor
  const strongest = slots.reduce((best, s) => (s.val || 0) > (best?.val || 0) ? s : best, null);
  // Find weakest factor (for low-score glow)
  const weakest = slots.reduce((w, s) => (s.val || 10) < (w?.val || 10) ? s : w, null);

  slots.forEach((slot, i) => {
    const row = document.createElement('button');
    row.className = 'factor-row' + (strongest && slot.key === strongest.key ? ' factor-row--dominant' : '');
    if (weakest && slot.key === weakest.key && slot.val < 5) {
      row.className += ' factor-row--weak';
    }
    row.setAttribute('role', 'meter');
    row.setAttribute('aria-valuenow', slot.val.toFixed(1));
    row.setAttribute('aria-valuemin', '0');
    row.setAttribute('aria-valuemax', '10');
    row.setAttribute('aria-label', `${slot.label}, ${slot.val.toFixed(1)} out of 10${slot.weight ? `, weight ${slot.weight}%` : ''}. Tap to see details.`);
    row.setAttribute('aria-expanded', 'false');
    row.setAttribute('data-factor', slot.key);

    const pct = Math.min(slot.val / 10, 1) * 100;
    const color = getFactorColor(slot.val);
    // V4: Dynamic weight chip
    const weightChip = slot.weight != null
      ? `<span class="factor-row__weight type-data--xs">${slot.weight}%</span>`
      : '';
    // V4: Confidence badge
    const confBadge = slot.confidence
      ? `<span class="factor-row__confidence factor-row__confidence--${slot.confidence}" title="${slot.confidence} confidence"></span>`
      : '';

    row.innerHTML = `
      <span class="factor-row__icon">${svgIcon(slot.icon, 14)}</span>
      <span class="factor-row__label type-structural">${slot.label}</span>
      ${weightChip}
      <span class="factor-row__bar">
        <span class="factor-row__bar-fill" data-width="${pct}" style="background:${color}"></span>
      </span>
      <span class="factor-row__score type-data--sm">${slot.val.toFixed(1)}</span>
      ${confBadge}`;

    // Drill-down panel (hidden by default)
    const detail = document.createElement('div');
    detail.className = 'factor-detail';
    detail.id = `factor-detail-${slot.key}`;
    detail.setAttribute('aria-hidden', 'true');
    detail.innerHTML = ''; // Populated on tap

    const wrapper = document.createElement('div');
    wrapper.className = 'factor-row-wrapper';
    wrapper.setAttribute('role', 'listitem');
    wrapper.appendChild(row);
    wrapper.appendChild(detail);

    $list.appendChild(wrapper);

    // Tap handler: accordion drill-down
    row.addEventListener('click', () => {
      const isOpen = row.getAttribute('aria-expanded') === 'true';
      // Close all panels first (accordion)
      $list.querySelectorAll('.factor-row').forEach(r => r.setAttribute('aria-expanded', 'false'));
      $list.querySelectorAll('.factor-detail').forEach(d => {
        d.setAttribute('aria-hidden', 'true');
        d.style.maxHeight = '0';
      });
      if (!isOpen) {
        row.setAttribute('aria-expanded', 'true');
        detail.setAttribute('aria-hidden', 'false');
        // Populate detail if empty
        if (!detail.innerHTML.trim()) {
          detail.innerHTML = buildFactorDetail(slot.key, scoringV3);
        }
        detail.style.maxHeight = detail.scrollHeight + 'px';
      }
    });

    // Staggered fade-in + bar fill animation
    const fill = row.querySelector('.factor-row__bar-fill');
    if (!REDUCED.matches) {
      wrapper.style.opacity = '0';
      wrapper.style.transform = 'translateY(4px)';
      wrapper.style.transition = 'opacity 300ms ease-out, transform 300ms ease-out';
      timers.push(setTimeout(() => {
        wrapper.style.opacity = '1';
        wrapper.style.transform = 'translateY(0)';
        if (fill) {
          requestAnimationFrame(() => {
            fill.style.width = fill.dataset.width + '%';
          });
        }
      }, 400 + i * 60));
    } else if (fill) {
      fill.style.width = fill.dataset.width + '%';
    }
  });
}

/** Build drill-down HTML for a factor */
/** V3.6: Rich inline explanation card with sub-component mini-bars */
function buildFactorDetail(factorKey, scoringV3) {
  const score = scoringV3[factorKey] || 0;
  const weights = scoringV3.weights_used || {};
  const details = scoringV3.factor_details?.[factorKey] || null;

  const weightPct = weights[factorKey.replace('_match', '').replace('_fit', '')] || 0;
  const weightLabel = Math.round(weightPct * 100);

  let items = '';

  // Sub-component mini-bars (if factor_details available)
  if (details && typeof details === 'object') {
    // Human-readable labels for sub-component keys
    const SUB_LABELS = {
      cuisine: 'Cuisine', flavor: 'Flavor', dietary: 'Dietary', menu: 'Menu Match',
      occasion: 'Occasion Fit', service: 'Service', social: 'Social Fit',
      noise: 'Noise', lighting: 'Lighting', dress: 'Dress Code', energy: 'Energy', music: 'Music',
      google: 'Google Rating', sentiment: 'Reviews', awards: 'Awards', community: 'Community',
      timing: 'Timing', reservation: 'Reservations', practical: 'Practical',
    };

    for (const [subKey, sub] of Object.entries(details)) {
      if (!sub || typeof sub !== 'object') continue;
      const label = SUB_LABELS[subKey] || subKey;
      const pct = sub.max > 0 ? Math.min((sub.score / sub.max) * 100, 100) : 0;
      const barColor = pct >= 75 ? 'var(--ac)' : pct >= 40 ? 'var(--fg3)' : 'var(--rag-amber)';
      const signalClass = pct >= 75 ? 'factor-detail__verdict--match' : pct < 40 ? 'factor-detail__verdict--miss' : '';

      items += `<div class="factor-detail__sub">
        <span class="factor-detail__sub-label type-structural">${label}</span>
        <span class="factor-detail__sub-bar">
          <span class="factor-detail__sub-fill" style="width: ${pct}%; background: ${barColor}"></span>
        </span>
        <span class="factor-detail__sub-score type-data--sm">${sub.score}/${sub.max}</span>
        <span class="factor-detail__sub-signal type-structural ${signalClass}">${sub.signal}</span>
      </div>`;
    }
  }

  // Weight footer
  items += `<div class="factor-detail__weight">
    <span class="factor-detail__signal type-structural">Weight in your search</span>
    <span class="factor-detail__verdict type-data--sm">${weightLabel}%</span>
  </div>`;

  return `<div class="factor-detail__items">${items}</div>`;
}

// Keep legacy export for backward compat
export function renderVibeBars(scores, timers = []) {
  // V3: no-op, replaced by renderFactorBars
}

export function toggleScoreBreakdown() {
  // V2 breakdown removed
}

/* ---- V3 Factor Profile: Compact bars inside Score Hero ---- */

let _vibeState = 'compact'; // 'compact' | 'expanded'
let _factorBarsRendered = false;

export function getBloomState() { return _vibeState; }

export function resetBloomState() {
  _vibeState = 'compact';
  _factorBarsRendered = false;
  const $hero = document.getElementById('score-hero');
  if ($hero) {
    $hero.classList.remove('score-hero--factors-expanded');
  }
  const $list = document.getElementById('factor-bars-list');
  if ($list) $list.innerHTML = '';
  const $factorBars = document.getElementById('factor-bars');
  if ($factorBars) $factorBars.setAttribute('aria-hidden', 'true');
}

/** Auto-expand factor bars when score < 80 */
function autoExpandFactors(scoringV3, timers = []) {
  const $hero = document.getElementById('score-hero');
  if (!$hero || _vibeState === 'expanded') return;

  $hero.classList.add('score-hero--factors-expanded');
  if (!_factorBarsRendered) {
    renderFactorBars(scoringV3, timers);
    _factorBarsRendered = true;
  }
  const $factorBars = document.getElementById('factor-bars');
  if ($factorBars) $factorBars.setAttribute('aria-hidden', 'false');
  _vibeState = 'expanded';
}

/**
 * 2-state toggle: compact ↔ factors-expanded
 */
export function toggleBloom(scores, scoringV2, timers = []) {
  const $hero = document.getElementById('score-hero');
  if (!$hero) return _vibeState;

  // V3: Use scoring_v3 data (passed as scoringV2 param for backward compat)
  const scoringV3 = scoringV2;

  if (_vibeState === 'compact') {
    // → expanded: show factor bars
    $hero.classList.add('score-hero--factors-expanded');
    if (!_factorBarsRendered) {
      renderFactorBars(scoringV3 || {}, timers);
      _factorBarsRendered = true;
    }
    const $factorBars = document.getElementById('factor-bars');
    if ($factorBars) $factorBars.setAttribute('aria-hidden', 'false');
    _vibeState = 'expanded';
    return 'expanded';
  } else {
    // → compact: collapse factor bars
    $hero.classList.remove('score-hero--factors-expanded');
    const $factorBars = document.getElementById('factor-bars');
    if ($factorBars) $factorBars.setAttribute('aria-hidden', 'true');
    _vibeState = 'compact';
    return 'compact';
  }
}

export function handlePetalTap() {}
export function handleBloomRingTap() {}

/* ---- Sentiment Inline (compact horizontal bar) ---- */
export function renderSentimentInline(pos, neu, neg, timers = []) {
  const total = pos + neu + neg;
  if (total === 0) return;

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

// Keep renderSentimentBar as alias for backward compatibility
export function renderSentimentBar(pos, neu, neg, timers = []) {
  return renderSentimentInline(pos, neu, neg, timers);
}

// Humanize vibe score (0-10 scale) — used for vibe dimensions
function humanizeVibeScore(val) {
  if (val >= 9) return 'Outstanding';
  if (val >= 7.5) return 'Strong';
  if (val >= 5.5) return 'Good';
  if (val >= 3.5) return 'Moderate';
  return 'Low';
}

// Humanize V2 score (0-100 scale) — used for scoring breakdown
function humanizeV2Score(val) {
  if (val >= 90) return 'Perfect';
  if (val >= 75) return 'Strong';
  if (val >= 60) return 'Good';
  if (val >= 40) return 'Fair';
  return 'Low';
}

// Backward-compatible alias
export { renderScoreHero as renderScoreBloom };

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

/* ---- Celebration Burst (confetti particles for 90%+ scores) ---- */
let celebAnimId = null;

export function fireCelebration() {
  if (REDUCED.matches) return;

  const canvas = document.getElementById('particle-canvas');
  if (!canvas) return;

  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  // Ensure canvas matches viewport
  canvas.width = canvas.offsetWidth * (window.devicePixelRatio || 1);
  canvas.height = canvas.offsetHeight * (window.devicePixelRatio || 1);
  canvas.style.display = '';
  ctx.setTransform(window.devicePixelRatio || 1, 0, 0, window.devicePixelRatio || 1, 0, 0);

  const w = canvas.offsetWidth;
  const h = canvas.offsetHeight;

  // Get accent color for theming particles
  const ac = getComputedStyle(document.documentElement).getPropertyValue('--ac').trim() || '#6c5ce7';

  // Generate confetti particles bursting from center-top area (where score ring is)
  const originX = w / 2;
  const originY = h * 0.3;
  const particles = [];

  const COLORS = [ac, '#FFD700', '#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4'];

  for (let i = 0; i < 36; i++) {
    const angle = (Math.random() * Math.PI * 2);
    const speed = 2 + Math.random() * 4;
    particles.push({
      x: originX,
      y: originY,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed - 2, // bias upward initially
      size: 3 + Math.random() * 4,
      color: COLORS[Math.floor(Math.random() * COLORS.length)],
      alpha: 1,
      rotation: Math.random() * 360,
      rotSpeed: (Math.random() - 0.5) * 8,
      shape: Math.random() > 0.5 ? 'rect' : 'circle',
    });
  }

  const startTime = performance.now();
  const DURATION = 1500;

  function draw(now) {
    const elapsed = now - startTime;
    if (elapsed > DURATION) {
      celebAnimId = null;
      return;
    }

    ctx.clearRect(0, 0, w, h);

    const progress = elapsed / DURATION;

    for (const p of particles) {
      p.x += p.vx;
      p.y += p.vy;
      p.vy += 0.12; // gravity
      p.vx *= 0.99;  // friction
      p.rotation += p.rotSpeed;
      p.alpha = Math.max(0, 1 - progress * 1.2);

      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate((p.rotation * Math.PI) / 180);
      ctx.globalAlpha = p.alpha;
      ctx.fillStyle = p.color;

      if (p.shape === 'rect') {
        ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size * 0.6);
      } else {
        ctx.beginPath();
        ctx.arc(0, 0, p.size / 2, 0, Math.PI * 2);
        ctx.fill();
      }

      ctx.restore();
    }

    celebAnimId = requestAnimationFrame(draw);
  }

  if (celebAnimId) cancelAnimationFrame(celebAnimId);
  celebAnimId = requestAnimationFrame(draw);
}
