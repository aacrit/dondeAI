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

  // Celebration glow for exceptional matches
  // V5: Perfect Match tier — celebration at 88+ (was 85+ in V4)
  if (!REDUCED.matches && pct >= 88) {
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

/* ---- Imports ---- */
import { svgIcon, buildVibeSummary, getScoreThresholdColor, getScoreTier, getFactorColor, humanizeSnake, humanizeSignal, getFactorLabel, strengthDots } from './utils.js';

/** V5 Factor dimensions */
const FACTOR_DIMS = [
  { key: 'food',        label: 'Food',        icon: 'plate' },
  { key: 'vibe',        label: 'Vibe',        icon: 'music' },
  { key: 'service',     label: 'Service',      icon: 'diamond' },
  { key: 'reputation',  label: 'Reputation',   icon: 'starFull' },
  { key: 'convenience', label: 'Convenience',  icon: 'clock' },
];

/** Normalize V3/V4 scoring keys to V5 format so FACTOR_DIMS always matches */
function normalizeScoringKeys(scoring) {
  if (!scoring) return scoring;
  // V5 uses: food, vibe, service, reputation, convenience
  // V4 used: food_quality, vibe, service, reputation, convenience
  // V3 used: food_match, atmosphere, setting_fit, reputation, convenience
  const KEY_MAP = { food_quality: 'food', food_match: 'food', atmosphere: 'vibe', setting_fit: 'service' };
  const WEIGHT_KEY_MAP = { food_quality: 'food', food: 'food', atmosphere: 'vibe', setting: 'service', setting_fit: 'service' };

  const normalized = { ...scoring };

  // Normalize top-level factor keys
  for (const [old, v5] of Object.entries(KEY_MAP)) {
    if (normalized[old] != null && normalized[v5] == null) {
      normalized[v5] = normalized[old];
    }
  }

  if (normalized.factor_details) {
    const nd = { ...normalized.factor_details };
    for (const [old, v5] of Object.entries(KEY_MAP)) {
      if (nd[old] && !nd[v5]) nd[v5] = nd[old];
    }
    normalized.factor_details = nd;
  }

  if (normalized.weights_used) {
    const nw = { ...normalized.weights_used };
    for (const [old, v5] of Object.entries(WEIGHT_KEY_MAP)) {
      if (nw[old] != null && nw[v5] == null) {
        nw[v5] = nw[old];
      }
    }
    normalized.weights_used = nw;
  }

  // Normalize confidence keys too
  if (normalized.confidence) {
    const nc = { ...normalized.confidence };
    for (const [old, v5] of Object.entries(KEY_MAP)) {
      if (nc[old] != null && nc[v5] == null) {
        nc[v5] = nc[old];
      }
    }
    normalized.confidence = nc;
  }

  return normalized;
}

/* V8: Petal radar removed — occasion scores still available in API response */
export function renderPetalRadar() {}

/* ---- V9.1: Narrative Keyword Highlighting ---- */
function highlightNarrativeKeywords($el, restaurantData) {
  if (!$el || !restaurantData) return;
  const text = $el.textContent;
  if (!text) return;

  // Collect keywords to highlight
  const keywords = new Set();
  const r = restaurantData.restaurant || restaurantData;
  if (r.cuisine_type) keywords.add(r.cuisine_type.toLowerCase());
  if (r.name) keywords.add(r.name.toLowerCase());

  const dc = restaurantData.deep_context || {};
  if (dc.signature_dishes) {
    dc.signature_dishes.slice(0, 3).forEach(d => {
      if (d.dish) keywords.add(d.dish.toLowerCase());
    });
  }

  // Build regex from keywords (escape special chars, sort longest first)
  const escaped = [...keywords].filter(k => k.length > 2)
    .sort((a, b) => b.length - a.length)
    .map(k => k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
  if (escaped.length === 0) return;

  const regex = new RegExp(`\\b(${escaped.join('|')})\\b`, 'gi');
  $el.innerHTML = text.replace(regex, '<strong class="narrative-highlight">$1</strong>');
}

/* ---- Score Hero (Confidence Ring — full circle gauge) ---- */

let heroData = null;

export function renderScoreHero(dondeMatch, scores, scoringV2, sentiment, timers = [], matchNarrative = null) {
  const $hero = document.getElementById('score-hero');
  if (!$hero) return;

  heroData = { dondeMatch, scores, scoringV2, sentiment, matchNarrative };

  const pct = Math.round(parseFloat(dondeMatch) || 80);
  const $ringFill = document.getElementById('score-hero-ring-fill');
  const $number = document.getElementById('score-hero-number');
  const $verdictText = document.getElementById('score-hero-verdict-text');
  const $signals = document.getElementById('score-hero-signals');

  // Full circle: circumference = 2πr where r=52
  const circumference = 2 * Math.PI * 52; // ~326.7
  const target = circumference - (pct / 100) * circumference;

  if ($ringFill) {
    $ringFill.style.transition = 'none';
    $ringFill.style.strokeDasharray = String(circumference);
    // RAG color based on final score
    const ringColor = getScoreThresholdColor(pct);
    $ringFill.style.stroke = ringColor;

    if (REDUCED.matches) {
      $ringFill.style.strokeDashoffset = String(target);
      if ($number) { $number.textContent = pct; $number.style.color = ringColor; }
    } else {
      // Start empty
      $ringFill.style.strokeDashoffset = String(circumference);

      const duration = 600;
      timers.push(setTimeout(() => {
        const startTime = performance.now();
        function tick(now) {
          const elapsed = now - startTime;
          const progress = Math.min(elapsed / duration, 1);
          const eased = 1 - Math.pow(1 - progress, 3);

          const currentPct = Math.round(pct * eased);
          const currentOffset = circumference - (currentPct / 100) * circumference;

          $ringFill.style.strokeDashoffset = String(currentOffset);
          if ($number) { $number.textContent = currentPct; $number.style.color = getScoreThresholdColor(currentPct); }

          if (progress < 1) requestAnimationFrame(tick);
          else if ($number) { $number.textContent = pct; $number.style.color = ringColor; }
        }
        requestAnimationFrame(tick);
      }, 100));
    }
  }

  // Verdict text — appears FIRST (above ring) at 100ms
  const tier = getScoreTier(pct);
  if ($verdictText) {
    $verdictText.textContent = tier.verdict;
    $verdictText.setAttribute('data-tier', tier.tier);
    if (!REDUCED.matches) {
      timers.push(setTimeout(() => {
        $verdictText.classList.add('score-hero__verdict-text--visible');
      }, 100));
    } else {
      $verdictText.classList.add('score-hero__verdict-text--visible');
    }
  }

  // V9.1: Factor dots removed (CEO feedback: not intuitive) — factor bars serve this purpose

  // Narrative — typewriter-reveals after ring completes (300ms delay after ring)
  const $narrative = document.getElementById('score-hero-narrative');
  const resolvedNarrative = matchNarrative || heroData?.scoringV2?.match_narrative;

  if ($narrative) {
    let narrativeText = '';
    if (resolvedNarrative?.summary) {
      narrativeText = resolvedNarrative.summary;
    } else if (scoringV2) {
      // Fallback: generate from strongest factor
      const sv = normalizeScoringKeys(scoringV2);
      const weights = sv.weights_used || {};
      const factorEntries = FACTOR_DIMS.filter(d => sv[d.key] != null);
      if (factorEntries.length > 0) {
        const best = factorEntries.reduce((a, b) => {
          const aContrib = (sv[a.key] || 0) * (parseFloat(weights[a.key]) || 0.2);
          const bContrib = (sv[b.key] || 0) * (parseFloat(weights[b.key]) || 0.2);
          return aContrib > bContrib ? a : b;
        });
        narrativeText = `Strongest in ${best.label.toLowerCase()} (${(sv[best.key] || 0).toFixed(1)}/10)`;
      }
    }

    if (narrativeText) {
      $narrative.textContent = narrativeText;
      highlightNarrativeKeywords($narrative, _lastRestaurantData);
      $narrative.style.display = '';
      if (!REDUCED.matches) {
        // 100ms start + 600ms ring + 300ms delay = 1000ms
        timers.push(setTimeout(() => {
          $narrative.classList.add('score-hero__narrative--visible');
        }, 1000));
      } else {
        $narrative.classList.add('score-hero__narrative--visible');
      }
    } else {
      $narrative.style.display = 'none';
    }
  }

  // Signal pills removed — factor bars communicate the same info with actual data
  if ($signals) { $signals.innerHTML = ''; $signals.style.display = 'none'; }

  // Auto-render factor bars (always visible, no toggle)
  if (scoringV2) {
    timers.push(setTimeout(() => {
      if (!_factorBarsRendered) {
        renderFactorBars(scoringV2, timers, _lastRestaurantData);
        _factorBarsRendered = true;
      }
    }, 900));
  }

  // Ring glow halo — scales with score (70+)
  if (!REDUCED.matches && pct >= 70) {
    timers.push(setTimeout(() => {
      const ringWrap = $hero.querySelector('.score-hero__ring-wrap');
      if (ringWrap) {
        const glowOpacity = Math.min((pct - 60) / 40, 1) * 0.3;
        ringWrap.style.boxShadow = `0 0 ${12 + pct * 0.2}px color-mix(in srgb, var(--ac) ${Math.round(glowOpacity * 100)}%, transparent)`;
        ringWrap.style.borderRadius = '50%';
      }
    }, 700));
  }

  // Celebration glow for exceptional matches (85+)
  if (!REDUCED.matches && pct >= 85) {
    timers.push(setTimeout(() => {
      const ringWrap = $hero.querySelector('.score-hero__ring-wrap');
      if (ringWrap) {
        ringWrap.classList.add('score-hero__ring-wrap--celebrating');
        ringWrap.addEventListener('animationend',
          () => ringWrap.classList.remove('score-hero__ring-wrap--celebrating'), { once: true });
      }
    }, 1400));
  }

  // Build aria-label
  if (scoringV2) {
    const normalizedForAria = normalizeScoringKeys(scoringV2);
    const ariaDesc = FACTOR_DIMS
      .filter(d => normalizedForAria[d.key] != null)
      .map(d => `${d.label} ${(normalizedForAria[d.key] || 0).toFixed(1)} out of 10`)
      .join(', ');
    $hero.setAttribute('aria-label', `DondeAI Match ${pct}%. Factors: ${ariaDesc}`);
  } else {
    $hero.setAttribute('aria-label', `DondeAI Match ${pct}%`);
  }
}

/* ---- V5 Factor Bars (horizontal dimension bars — 5 weighted factors) ---- */

export function renderFactorBars(scoringData, timers = [], restaurantData = null) {
  const $container = document.getElementById('factor-bars');
  const $list = document.getElementById('factor-bars-list');
  if (!$container || !$list) return;

  const scoring = normalizeScoringKeys(scoringData);
  if (!scoring) return;

  $list.innerHTML = '';

  const weightsUsed = scoring.weights_used || {};

  const slots = FACTOR_DIMS
    .map(dim => ({
      ...dim,
      val: scoring[dim.key] != null ? Math.min(parseFloat(scoring[dim.key]) || 0, 10) : null,
      weight: weightsUsed[dim.key] != null ? Math.round(parseFloat(weightsUsed[dim.key]) * 100) : null,
    }))
    .filter(s => s.val !== null);

  if (slots.length < 2) return;

  slots.forEach((slot, i) => {
    const row = document.createElement('button');
    row.className = 'factor-row';
    row.setAttribute('role', 'meter');
    row.setAttribute('aria-valuenow', slot.val.toFixed(1));
    row.setAttribute('aria-valuemin', '0');
    row.setAttribute('aria-valuemax', '10');
    row.setAttribute('aria-label', `${slot.label}, ${slot.val.toFixed(1)} out of 10. Tap for details.`);
    row.setAttribute('aria-expanded', 'false');
    row.setAttribute('data-factor', slot.key);

    const pct = Math.min(slot.val / 10, 1) * 100;

    // Weight-tier: bar height + icon color (subtle, no labels)
    const weightTier = slot.weight >= 30 ? 'weight-high'
      : slot.weight >= 18 ? 'weight-mid' : 'weight-low';
    row.className += ` factor-row--${weightTier}`;

    // Score-based fill color — aligned with RAG thresholds (8/6 on 0-10 scale)
    const scoreTierClass = slot.val >= 8.0 ? 'bar-fill--strong'
      : slot.val >= 6.0 ? 'bar-fill--mid'
      : 'bar-fill--weak';

    // Clean: icon | label | weight pips | bar | contextual label
    const pipCount = slot.weight >= 30 ? 3 : slot.weight >= 18 ? 2 : 1;
    const pips = '\u25CF'.repeat(pipCount);
    row.innerHTML = `
      <span class="factor-row__icon">${svgIcon(slot.icon, 16)}</span>
      <span class="factor-row__label type-structural">${slot.label}</span>
      <span class="factor-row__weight-pips" aria-label="${slot.weight != null ? slot.weight + '% weight' : ''}">${pips}</span>
      <span class="factor-row__bar">
        <span class="factor-row__bar-fill ${scoreTierClass}" data-width="${pct}"></span>
      </span>
      <span class="factor-row__label-tag">${getFactorLabel(slot.val)}</span>`;

    // Drill-down panel (hidden by default, populated on tap)
    const detail = document.createElement('div');
    detail.className = 'factor-detail';
    detail.id = `factor-detail-${slot.key}`;
    detail.setAttribute('aria-hidden', 'true');

    const wrapper = document.createElement('div');
    wrapper.className = 'factor-row-wrapper';
    wrapper.setAttribute('role', 'listitem');
    wrapper.appendChild(row);
    wrapper.appendChild(detail);

    $list.appendChild(wrapper);

    // Tap handler: accordion drill-down (Monzo-style)
    row.addEventListener('click', () => {
      // V9: haptic feedback on factor expand
      if (navigator.vibrate) navigator.vibrate([15, 10, 15]);

      const isOpen = row.getAttribute('aria-expanded') === 'true';
      // Close all panels first (accordion)
      $list.querySelectorAll('.factor-row').forEach(r => r.setAttribute('aria-expanded', 'false'));
      $list.querySelectorAll('.factor-detail').forEach(d => {
        d.setAttribute('aria-hidden', 'true');
        d.style.height = '0';
        d.style.opacity = '0';
      });
      if (!isOpen) {
        row.setAttribute('aria-expanded', 'true');
        if (!detail.innerHTML.trim()) {
          detail.innerHTML = buildFactorDetail(slot.key, scoring);
        }
        detail.setAttribute('aria-hidden', 'false');
        detail.style.height = 'auto';
        const measuredHeight = detail.scrollHeight;
        detail.style.height = '0';
        detail.style.opacity = '0';
        requestAnimationFrame(() => {
          detail.style.transition = REDUCED.matches
            ? 'none'
            : 'height var(--dur-expand, 350ms) var(--ease-out, ease-out), opacity var(--dur-expand, 350ms) var(--ease-out, ease-out)';
          detail.style.height = measuredHeight + 'px';
          detail.style.opacity = '1';
        });
      }
    });

    // Staggered fade-in + bar fill
    const fill = row.querySelector('.factor-row__bar-fill');
    if (!REDUCED.matches) {
      wrapper.style.opacity = '0';
      wrapper.style.transform = 'translateY(4px)';
      wrapper.style.transition = 'opacity 450ms ease-out, transform 450ms ease-out';
      timers.push(setTimeout(() => {
        wrapper.style.opacity = '1';
        wrapper.style.transform = 'translateY(0)';
        if (fill) {
          requestAnimationFrame(() => {
            fill.style.width = fill.dataset.width + '%';
          });
        }
      }, i * 120));
    } else if (fill) {
      fill.style.width = fill.dataset.width + '%';
    }
  });
}

const FACTOR_LABELS = { food: 'Food', vibe: 'Vibe', service: 'Service', reputation: 'Reputation', convenience: 'Convenience' };

/* ---- V6.1: Factor narrative sentence generator ---- */
function buildFactorNarrative(factorKey, scoring) {
  const details = scoring.factor_details?.[factorKey];
  if (!details || typeof details !== 'object') return '';

  const score = parseFloat(scoring[factorKey]) || 0;
  const conf = scoring.confidence?.[factorKey] || 'high';

  const entries = Object.entries(details)
    .filter(([, sub]) => sub && typeof sub === 'object' && sub.max > 0)
    .map(([key, sub]) => ({ key, signal: sub.signal || '', pct: (sub.score / sub.max) * 100 }))
    .sort((a, b) => b.pct - a.pct);

  if (entries.length === 0) return '';

  const top = entries[0];
  const topClean = humanizeSignal(top.signal);
  const strength = score >= 8 ? 'Strong' : score >= 6 ? 'Good' : score >= 4 ? 'Moderate' : 'Limited';

  let text = '';
  if (factorKey === 'food') {
    if (topClean.toLowerCase().includes('exact dish')) text = `Exact match on your requested dish, plus solid cuisine alignment.`;
    else if (topClean.toLowerCase().includes('exact cuisine')) text = `${strength} cuisine fit${entries.length > 1 ? ' with flavor profile alignment' : ''}.`;
    else text = `${strength} food match based on available menu data.`;
  } else if (factorKey === 'vibe') {
    const confNote = conf !== 'high' ? ' (limited atmosphere data)' : '';
    text = `${strength} atmosphere alignment for your occasion${confNote}.`;
  } else if (factorKey === 'service') {
    text = `${strength} service indicators from reviews and profile data.`;
  } else if (factorKey === 'reputation') {
    const gSignal = details.google_rating?.signal || details.google?.signal || '';
    text = gSignal ? `Reputation backed by ${humanizeSignal(gSignal).toLowerCase()}.` : `${strength} reputation score.`;
  } else if (factorKey === 'convenience') {
    const dSignal = details.distance?.signal || details.timing?.signal || '';
    // Filter out generic convenience signals (walk_in_friendly, reasonably_convenient)
    const filtered = dSignal ? humanizeSignal(dSignal).replace(/walk.in friendly|reasonably convenient/gi, '').trim() : '';
    if (filtered) text = `${filtered}. ${score >= 7 ? 'Easy to get to.' : 'Worth the trip.'}`;
    else text = score >= 7 ? 'Easy to get to.' : 'Worth the trip.';
  }

  if (!text) return '';
  return `<p class="factor-detail__narrative type-structural">${text}</p>`;
}

/** Extract plain text from factor narrative (no HTML wrapper) */
function buildFactorNarrativeText(factorKey, scoring) {
  const html = buildFactorNarrative(factorKey, scoring);
  if (!html) return '';
  // Strip the <p> wrapper to get plain text
  return html.replace(/<p[^>]*>/, '').replace(/<\/p>/, '').trim();
}

/** Build drill-down HTML for a factor — narrative + rank-based sub-factor list */
function buildFactorDetail(factorKey, scoring) {
  const details = scoring.factor_details?.[factorKey] || null;

  const SUB_META = {
    cuisine:     { icon: 'plate',      label: 'Cuisine' },
    flavor:      { icon: 'fire',       label: 'Flavor' },
    dietary:     { icon: 'salad',      label: 'Dietary' },
    menu:        { icon: 'forkKnife',  label: 'Menu' },
    occasion:    { icon: 'heart',      label: 'Occasion' },
    service:     { icon: 'diamond',    label: 'Service' },
    social:      { icon: 'usersThree', label: 'Social Fit' },
    noise:       { icon: 'speakerWave',label: 'Noise' },
    lighting:    { icon: 'moon',       label: 'Lighting' },
    dress:       { icon: 'shirt',      label: 'Dress Code' },
    energy:      { icon: 'bolt',       label: 'Energy' },
    music:       { icon: 'music',      label: 'Music' },
    google:      { icon: 'starFull',   label: 'Google Rating' },
    sentiment:   { icon: 'chat',       label: 'Reviews' },
    awards:      { icon: 'starOutline',label: 'Awards' },
    community:   { icon: 'usersThree', label: 'Community' },
    timing:      { icon: 'clock',      label: 'Timing' },
    reservation: { icon: 'calendar',   label: 'Reservations' },
    practical:   { icon: 'briefcase',  label: 'Practical' },
  };

  if (!details || typeof details !== 'object') return '<div class="factor-detail__items"></div>';

  const entries = Object.entries(details)
    .filter(([, sub]) => sub && typeof sub === 'object')
    .map(([subKey, sub]) => ({
      subKey, sub,
      pct: sub.max > 0 ? Math.min((sub.score / sub.max) * 100, 100) : 0,
    }));

  if (entries.length === 0) return '<div class="factor-detail__items"></div>';

  const parentScore = typeof scoring[factorKey] === 'number'
    ? Math.min(parseFloat(scoring[factorKey]) || 0, 10) : 0;
  const detractorThreshold = parentScore >= 7.5 ? 25 : parentScore >= 5 ? 35 : 40;

  const maxPct = Math.max(...entries.map(e => e.pct));
  const minPct = Math.min(...entries.map(e => e.pct));

  let items = '';
  for (const { subKey, sub, pct } of entries) {
    const meta = SUB_META[subKey] || { icon: 'plate', label: humanizeSnake(subKey) };
    let tierClassName = 'neutral';
    if (pct === maxPct && pct >= 65 && entries.length > 1) {
      tierClassName = 'helper';
    } else if (pct === minPct && pct < detractorThreshold && entries.length > 1) {
      tierClassName = 'detractor';
    }
    const cleanSignal = humanizeSignal(sub.signal);
    items += `<div class="factor-detail__signal-row factor-detail__signal-row--${tierClassName}">
      ${strengthDots(sub.score, sub.max)}
      <span class="factor-detail__signal-label">${cleanSignal}</span>
    </div>`;
  }

  // Confidence note when data is limited
  const conf = scoring.confidence?.[factorKey];
  if (conf === 'low') {
    items += '<div class="factor-detail__confidence">Based on limited data</div>';
  }

  // V9: Deep context integration
  const dc = _lastRestaurantData?.deep_context;
  if (dc) {
    let contextHtml = '';

    if (factorKey === 'food') {
      // Signature dishes
      if (dc.signature_dishes?.length > 0) {
        contextHtml += '<div class="factor-detail__context"><div class="factor-detail__context-header">Known For</div>';
        dc.signature_dishes.slice(0, 3).forEach(dish => {
          contextHtml += `<div class="factor-detail__context-item">${dish.dish}${dish.why ? ' — ' + dish.why : ''}</div>`;
        });
        contextHtml += '</div>';
      }
      // Flavor profiles
      if (dc.flavor_profiles?.length > 0) {
        contextHtml += `<div class="factor-detail__context-item">Flavors: ${dc.flavor_profiles.join(', ')}</div>`;
      }
    }

    if (factorKey === 'vibe') {
      if (dc.decor_style) {
        contextHtml += `<div class="factor-detail__context-item">Décor: ${dc.decor_style}</div>`;
      }
      if (dc.music_vibe) {
        contextHtml += `<div class="factor-detail__context-item">Music: ${dc.music_vibe}</div>`;
      }
      if (dc.energy_level != null) {
        const energyLabel = dc.energy_level >= 7 ? 'Buzzing' : dc.energy_level >= 4 ? 'Lively' : 'Chill';
        contextHtml += `<div class="factor-detail__context-item">Energy: ${energyLabel}</div>`;
      }
      if (dc.conversation_friendliness >= 7) {
        contextHtml += `<div class="factor-detail__context-item">Great for conversation</div>`;
      }
    }

    if (factorKey === 'reputation') {
      if (dc.awards_recognition?.length > 0) {
        contextHtml += '<div class="factor-detail__context">';
        dc.awards_recognition.slice(0, 2).forEach(award => {
          contextHtml += `<div class="factor-detail__context-item">🏆 ${award}</div>`;
        });
        contextHtml += '</div>';
      }
      if (dc.chef_notable) {
        contextHtml += `<div class="factor-detail__context-item">Notable chef</div>`;
      }
    }

    if (factorKey === 'convenience') {
      if (dc.typical_wait_minutes) {
        contextHtml += `<div class="factor-detail__context-item">Typical wait: ~${dc.typical_wait_minutes} min</div>`;
      }
      if (dc.transit_accessibility) {
        contextHtml += `<div class="factor-detail__context-item">Transit: ${dc.transit_accessibility}</div>`;
      }
    }

    if (contextHtml) {
      items += contextHtml;
    }
  }

  const narrative = buildFactorNarrative(factorKey, scoring);

  return `<div class="factor-detail__items">${narrative}${items}</div>`;
}

// Legacy export for backward compat — vibe bars removed in V5
export function renderVibeBars(scores, timers = []) {
  // V5: no-op — 6-dimension vibe bars replaced by 5-factor V5 bars
}

export function toggleScoreBreakdown() {
  // V2 breakdown removed
}

/* ---- Factor state management ---- */

let _factorBarsRendered = false;
let _lastRestaurantData = null;

export function getBloomState() { return 'expanded'; }

export function resetBloomState() {
  _factorBarsRendered = false;
  _lastRestaurantData = null;
  const $list = document.getElementById('factor-bars-list');
  if ($list) $list.innerHTML = '';
  // Reset narrative
  const $narrative = document.getElementById('score-hero-narrative');
  if ($narrative) {
    $narrative.classList.remove('score-hero__narrative--visible');
    $narrative.style.display = 'none';
  }
  // V9.1: Factor dots removed — no reset needed
}

export function toggleBloom(scores, scoringData, timers = [], restaurantData = null) {
  if (restaurantData) _lastRestaurantData = restaurantData;
  // Factors are always visible now — just ensure they're rendered
  if (!_factorBarsRendered && scoringData) {
    renderFactorBars(normalizeScoringKeys(scoringData) || {}, timers, _lastRestaurantData);
    _factorBarsRendered = true;
  }
  return 'expanded';
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
