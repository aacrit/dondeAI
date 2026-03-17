/* ============================================
   DondeAI — Animations Engine
   Score ring, radar chart, particle system,
   chaos-to-order text, logo animation.
   ============================================ */

/* REDUCED aliased from globals.js REDUCED_MOTION — import below (ES modules hoist) */
const REDUCED = REDUCED_MOTION;

/* ---- Rive Runtime (async, non-blocking) ---- */
let _rive = null;
let _riveReady = false;

/**
 * Initialize Rive runtime for logo + celebration animations.
 * Falls back gracefully to existing SVG animations if Rive fails to load.
 * Call loadRive() once at app boot — it's non-blocking.
 */
export function loadRive() {
  // Dynamic import — only loads if .riv assets exist
  import('https://cdn.jsdelivr.net/npm/@rive-app/canvas@2/+esm')
    .then((mod) => {
      _rive = mod;
      _riveReady = true;
    })
    .catch(() => {
      // Rive not available — SVG fallback will be used
      _riveReady = false;
    });
}

/** Check if Rive is ready */
export function hasRive() { return _riveReady; }

/* ---- Match Ring Animation (Percentage-based, 0-100) ---- */
let _scoreRingSpring = null;

export function animateScoreRing(rawScore) {
  const pct = Math.round(parseFloat(rawScore) || 80);
  const fill = document.getElementById('score-ring-fill');
  const numEl = document.getElementById('score-number');
  const verdictEl = document.getElementById('score-verdict');
  if (!fill || !numEl) return;

  // Cancel any prior spring animation
  if (_scoreRingSpring) { _scoreRingSpring.stop(); _scoreRingSpring = null; }

  const circumference = 2 * Math.PI * 45; // r=45
  const targetOffset = circumference - (pct / 100) * circumference;

  fill.style.stroke = 'var(--ac)';

  if (REDUCED.matches) {
    fill.style.strokeDashoffset = targetOffset;
    numEl.textContent = pct + '%';
    return;
  }

  // Set initial state
  fill.style.strokeDasharray = circumference;
  fill.style.strokeDashoffset = circumference;
  fill.style.transition = 'none';

  // Spring-driven ring fill + count-up (real spring physics via Motion One)
  _scoreRingSpring = springValue({
    from: 0,
    to: pct,
    spring: SPRINGS.score,
    onUpdate(v) {
      const current = Math.round(v);
      numEl.textContent = current + '%';
      fill.style.strokeDashoffset = circumference - (v / 100) * circumference;
    },
    onComplete() {
      numEl.textContent = pct + '%';
      fill.style.strokeDashoffset = targetOffset;
      _scoreRingSpring = null;
    }
  });

  // Verdict word label: ink-reveal entrance (left-to-right clip) after number settles
  if (verdictEl) {
    verdictEl.style.opacity = '1';
    verdictEl.style.clipPath = 'inset(0 100% 0 0)';
    verdictEl.style.transform = 'none';

    setTimeout(() => {
      verdictEl.style.transition = 'clip-path 500ms cubic-bezier(0.2, 1, 0.4, 1)';
      verdictEl.style.clipPath = 'inset(0 0 0 0)';
    }, 1000);

    // Scale emphasis pulse via spring after ink-reveal completes
    setTimeout(() => {
      springAnimate(verdictEl, { transform: 'scale(1.08)' }, { spring: SPRINGS.snappy, duration: 300 });
      setTimeout(() => {
        springAnimate(verdictEl, { transform: 'scale(1)' }, { spring: SPRINGS.snappy, duration: 200 });
      }, 150);
    }, 1500);
  }

  // Celebration — now tiered (see fireCelebration)
  if (pct >= 70) {
    const delay = pct >= 88 ? 1400 : 1600;
    setTimeout(() => {
      fireCelebration(pct);
    }, delay);
  }
}

/* ---- Imports ---- */
import { svgIcon, buildVibeSummary, getScoreThresholdColor, getScoreTier, getFactorColor, humanizeSnake, humanizeSignal, getFactorLabel, strengthDots } from './utils.js';
import { springValue, springAnimate, SPRINGS, hasMotion } from './spring.js';
import { _escHtml, REDUCED_MOTION } from './globals.js';

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
  $el.innerHTML = _escHtml(text).replace(regex, '<strong class="narrative-highlight">$1</strong>');
}

/* ---- Score Hero (Confidence Ring — full circle gauge) ---- */

let heroData = null;
let _heroRingSpring = null;

/* ---- V12: Particle Burst at Ring Settle ---- */
/**
 * Emit 5-8 small particles from the ring's settle position.
 * Particles are absolutely positioned divs with spring-like outward motion.
 * Subtle ink-droplet aesthetic — small dots in accent color.
 */
function _emitSettleParticles($hero, score) {
  if (REDUCED.matches) return;
  const ringWrap = $hero.querySelector('.score-hero__ring-wrap');
  if (!ringWrap) return;

  const count = 5 + Math.floor(Math.random() * 4); // 5-8 particles
  const rect = ringWrap.getBoundingClientRect();
  const centerX = rect.width / 2;
  const centerY = rect.height / 2;
  const ringRadius = rect.width / 2;

  // Get the angle where the ring fill ends (score position on the arc)
  const endAngle = -90 + (360 * (score / 100));
  const endRad = endAngle * (Math.PI / 180);
  const originX = centerX + ringRadius * 0.82 * Math.cos(endRad);
  const originY = centerY + ringRadius * 0.82 * Math.sin(endRad);

  const ac = getComputedStyle(document.documentElement).getPropertyValue('--ac').trim() || '#6c5ce7';

  for (let i = 0; i < count; i++) {
    const particle = document.createElement('div');
    particle.className = 'score-ring-particle';
    particle.setAttribute('aria-hidden', 'true');

    // Randomize direction: spread in a ~120deg arc centered on the ring's tangent
    const spreadAngle = endRad + (Math.random() - 0.5) * (Math.PI * 0.67);
    const distance = 15 + Math.random() * 25; // 15-40px outward
    const size = 3 + Math.random() * 3; // 3-6px

    particle.style.width = size + 'px';
    particle.style.height = size + 'px';
    particle.style.background = ac;
    particle.style.left = originX + 'px';
    particle.style.top = originY + 'px';
    particle.style.opacity = '0.8';

    ringWrap.appendChild(particle);

    // Animate outward with fast-out / slow-fade via CSS transitions
    const tx = Math.cos(spreadAngle) * distance;
    const ty = Math.sin(spreadAngle) * distance;
    const delay = i * 30; // slight stagger

    requestAnimationFrame(() => {
      particle.style.transition = `transform 400ms cubic-bezier(0.2, 1, 0.4, 1) ${delay}ms, opacity 600ms ease-out ${delay + 200}ms`;
      particle.style.transform = `translate(${tx}px, ${ty}px) scale(0.3)`;
      particle.style.opacity = '0';
    });

    // Cleanup after animation
    setTimeout(() => particle.remove(), 800 + delay);
  }
}

/* ---- V12: Haptic Score Language ---- */
/**
 * Fire haptic feedback at ring settle based on score tier.
 * 90+: double pulse [50, 30, 50]
 * 80-89: single strong [40]
 * 70-79: single light [20]
 * <70: no haptic
 */
function _fireSettleHaptic(score) {
  if (REDUCED.matches) return;
  if (!navigator.vibrate) return;
  if (score >= 90) {
    navigator.vibrate([50, 30, 50]);
  } else if (score >= 80) {
    navigator.vibrate([40]);
  } else if (score >= 70) {
    navigator.vibrate([20]);
  }
}

export function renderScoreHero(dondeMatch, scores, scoringData, sentiment, timers = [], matchNarrative = null) {
  const $hero = document.getElementById('score-hero');
  if (!$hero) return;

  heroData = { dondeMatch, scores, scoringData, sentiment, matchNarrative };

  const pct = Math.round(parseFloat(dondeMatch) || 80);
  const $ringFill = document.getElementById('score-hero-ring-fill');
  const $number = document.getElementById('score-hero-number');
  const $verdictText = document.getElementById('score-hero-verdict-text');
  const $signals = document.getElementById('score-hero-signals');

  // Full circle: circumference = 2πr where r=52
  const circumference = 2 * Math.PI * 52; // ~326.7
  const target = circumference - (pct / 100) * circumference;

  // Cancel any prior spring animation
  if (_heroRingSpring) { _heroRingSpring.stop(); _heroRingSpring = null; }

  if ($ringFill) {
    $ringFill.style.transition = 'none';
    $ringFill.style.strokeDasharray = String(circumference);

    // Ink trail dot — traces the leading edge of the arc
    const $inkDot = document.getElementById('score-hero-ink-dot');
    const ringRadius = 52; // SVG r attribute
    const ringCenter = 60; // SVG cx/cy

    if (REDUCED.matches) {
      const ringColor = getScoreThresholdColor(pct);
      $ringFill.style.stroke = ringColor;
      $ringFill.style.strokeDashoffset = String(target);
      if ($number) { $number.textContent = pct; $number.style.color = ringColor; }
      if ($inkDot) $inkDot.classList.remove('score-hero__ink-dot--active');
    } else {
      // Start empty
      $ringFill.style.strokeDashoffset = String(circumference);
      $ringFill.style.stroke = getScoreThresholdColor(0);
      if ($inkDot) $inkDot.classList.add('score-hero__ink-dot--active');

      // V12: Use bouncy preset for 90+ (more overshoot), score preset otherwise
      const springPreset = pct >= 90 ? SPRINGS.bouncy : SPRINGS.score;

      timers.push(setTimeout(() => {
        // Spring-driven ring fill: value overshoots target, settles back
        _heroRingSpring = springValue({
          from: 0,
          to: pct,
          spring: springPreset,
          onUpdate(v) {
            // Clamp display to 0-100 range but allow spring physics to overshoot internally
            const displayPct = Math.max(0, Math.min(100, Math.round(v)));
            const clampedV = Math.max(0, Math.min(100, v));
            const currentOffset = circumference - (clampedV / 100) * circumference;

            $ringFill.style.strokeDashoffset = String(currentOffset);

            // Smooth RAG color transition as value crosses thresholds
            $ringFill.style.stroke = getScoreThresholdColor(displayPct);

            if ($number) {
              $number.textContent = displayPct;
              $number.style.color = getScoreThresholdColor(displayPct);
            }

            // Position ink dot at leading edge of arc
            if ($inkDot) {
              const angle = -90 + (360 * (clampedV / 100));
              const rad = angle * (Math.PI / 180);
              const dotX = 50 + (ringRadius / (ringCenter * 2)) * 100 * Math.cos(rad);
              const dotY = 50 + (ringRadius / (ringCenter * 2)) * 100 * Math.sin(rad);
              $inkDot.style.left = dotX + '%';
              $inkDot.style.top = dotY + '%';
            }
          },
          onComplete() {
            const ringColor = getScoreThresholdColor(pct);
            $ringFill.style.strokeDashoffset = String(target);
            $ringFill.style.stroke = ringColor;
            if ($number) { $number.textContent = pct; $number.style.color = ringColor; }
            _heroRingSpring = null;

            // Fade out ink dot on settle
            if ($inkDot) {
              setTimeout(() => $inkDot.classList.remove('score-hero__ink-dot--active'), 200);
            }

            // --- V12: Particle Burst at settle ---
            _emitSettleParticles($hero, pct);

            // --- V12: Haptic Score Language at settle ---
            _fireSettleHaptic(pct);

            // --- V12: 90+ Celebration Effects ---
            if (pct >= 90) {
              // Gold glow on score number
              if ($number) {
                $number.classList.add('score-number--gold-glow');
                $number.addEventListener('animationend', () => {
                  $number.classList.remove('score-number--gold-glow');
                }, { once: true });
              }

              // Golden shimmer on restaurant name (one pass, 600ms)
              const $name = document.getElementById('result-name');
              if ($name) {
                $name.classList.add('golden-shimmer');
                $name.addEventListener('animationend', () => {
                  $name.classList.remove('golden-shimmer');
                }, { once: true });
              }
            }

            // --- V12: 95+ Donde Gold ring flash ---
            if (pct >= 95) {
              const ringWrap = $hero.querySelector('.score-hero__ring-wrap');
              if (ringWrap) {
                const goldOverlay = document.createElement('div');
                goldOverlay.className = 'donde-gold';
                goldOverlay.setAttribute('aria-hidden', 'true');
                ringWrap.appendChild(goldOverlay);
                goldOverlay.addEventListener('animationend', () => {
                  goldOverlay.remove();
                }, { once: true });
              }
            }
          }
        });
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
  const resolvedNarrative = matchNarrative || heroData?.scoringData?.match_narrative;

  if ($narrative) {
    let narrativeText = '';
    if (resolvedNarrative?.summary) {
      narrativeText = resolvedNarrative.summary;
    } else if (scoringData) {
      // Fallback: generate from strongest factor
      const sv = normalizeScoringKeys(scoringData);
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
  if (scoringData) {
    timers.push(setTimeout(() => {
      if (!_factorBarsRendered) {
        renderFactorBars(scoringData, timers, _lastRestaurantData);
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
  if (scoringData) {
    const normalizedForAria = normalizeScoringKeys(scoringData);
    const ariaDesc = FACTOR_DIMS
      .filter(d => normalizedForAria[d.key] != null)
      .map(d => `${d.label} ${(normalizedForAria[d.key] || 0).toFixed(1)} out of 10`)
      .join(', ');
    $hero.setAttribute('aria-label', `DondeAI Match ${pct}%. Factors: ${ariaDesc}`);
  } else {
    $hero.setAttribute('aria-label', `DondeAI Match ${pct}%`);
  }
}

/* ---- V9 Formula Row — Relevance × Quality equation ---- */

export function renderRelevanceGate(scoringV9, container, timers = [], intentBoost = null) {
  if (!scoringV9 || !container) return;

  const { relevance_score, relevance_type, relevance_details,
          occasion_bonus } = scoringV9;

  if (relevance_score == null) return;

  const relPct = Math.round(relevance_score * 100);

  const TYPE_LABELS = {
    dish: 'Dish Match',
    cuisine: 'Cuisine Match',
    vibe: 'Vibe Match',
    open_ended: 'Open Search',
  };
  const typeLabel = TYPE_LABELS[relevance_type] || 'Match';

  // RAG color for relevance gate
  const relColor = relPct >= 80 ? 'var(--green, #4ade80)'
                 : relPct >= 50 ? 'var(--amber, #fbbf24)'
                 : 'var(--red, #f87171)';

  const row = document.createElement('div');
  row.className = 'v9-formula-row';
  row.setAttribute('role', 'group');
  row.setAttribute('aria-label', `${typeLabel}: ${relPct}% relevance`);

  // Occasion bonus pill (human-readable, no raw numbers)
  const bonusPill = occasion_bonus && occasion_bonus !== 0
    ? `<span class="v9-formula__bonus-pill" data-positive="${occasion_bonus > 0}">${occasion_bonus > 0 ? 'Occasion boost' : 'Occasion mismatch'}</span>`
    : '';

  row.innerHTML = `
    <button class="v9-formula__gate"
            aria-expanded="false"
            aria-haspopup="true"
            style="--gate-color: ${relColor}">
      <span class="v9-formula__gate-label">${typeLabel}</span>
      <span class="v9-formula__gate-score" style="color:${relColor}">${relPct}%</span>
    </button>
    ${bonusPill}
  `;

  // Gate popout — tapping shows relevance_details explanation
  const gateBtn = row.querySelector('.v9-formula__gate');
  const popout = document.createElement('div');
  popout.className = 'v9-gate-popout';
  popout.setAttribute('role', 'tooltip');
  popout.innerHTML = `
    <span class="v9-gate-popout__label">Why this relevance score</span>
    <p class="v9-gate-popout__detail">${_escHtml(relevance_details || 'Match type determined by your request')}</p>
  `;
  gateBtn.appendChild(popout);

  gateBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    const isOpen = gateBtn.getAttribute('aria-expanded') === 'true';
    gateBtn.setAttribute('aria-expanded', String(!isOpen));
    popout.classList.toggle('v9-gate-popout--open', !isOpen);
  });

  // Close popout when clicking outside
  document.addEventListener('click', () => {
    gateBtn.setAttribute('aria-expanded', 'false');
    popout.classList.remove('v9-gate-popout--open');
  }, { once: false });

  container.innerHTML = '';
  container.appendChild(row);

  // Animate in
  if (!REDUCED.matches) {
    timers.push(setTimeout(() => {
      row.classList.add('v9-formula-row--visible');
    }, 800));
  } else {
    row.classList.add('v9-formula-row--visible');
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

  // Remove any leftover profile label from previous render
  const existingProfile = $container.querySelector('.factor-bars__profile');
  if (existingProfile) existingProfile.remove();

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

    // Clean: icon | label-stack (label + pips stacked) | bar | contextual label
    const pipCount = slot.weight >= 30 ? 3 : slot.weight >= 18 ? 2 : 1;
    const pips = '\u25CF'.repeat(pipCount);
    row.innerHTML = `
      <span class="factor-row__icon">${svgIcon(slot.icon, 16)}</span>
      <span class="factor-row__label-stack">
        <span class="factor-row__label type-structural">${slot.label}</span>
        <span class="factor-row__weight-pips" aria-label="${slot.weight != null ? slot.weight + '% weight' : ''}">${pips}</span>
      </span>
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
      // Close all panels first (accordion) — smooth collapse
      $list.querySelectorAll('.factor-row').forEach(r => r.setAttribute('aria-expanded', 'false'));
      $list.querySelectorAll('.factor-detail').forEach(d => {
        d.setAttribute('aria-hidden', 'true');
        if (!REDUCED.matches && d.scrollHeight > 0) {
          // Smooth collapse: set explicit height, then transition to 0
          d.style.willChange = 'height';
          d.style.height = d.scrollHeight + 'px';
          d.style.transition = 'height var(--dur-expand, 350ms) var(--ease-out, ease-out), opacity var(--dur-expand, 350ms) var(--ease-out, ease-out)';
          requestAnimationFrame(() => {
            d.style.height = '0';
            d.style.opacity = '0';
          });
          d.addEventListener('transitionend', () => { d.style.willChange = ''; }, { once: true });
        } else {
          d.style.height = '0';
          d.style.opacity = '0';
        }
      });
      if (!isOpen) {
        row.setAttribute('aria-expanded', 'true');
        if (!detail.innerHTML.trim()) {
          detail.innerHTML = buildFactorDetail(slot.key, scoring);
        }
        detail.setAttribute('aria-hidden', 'false');
        detail.style.willChange = 'height';
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
        detail.addEventListener('transitionend', () => { detail.style.willChange = ''; }, { once: true });
      }
    });

    // Staggered fade-in + bar fill
    const fill = row.querySelector('.factor-row__bar-fill');
    // Set CSS custom property for scroll-timeline animation
    if (fill) {
      fill.style.setProperty('--factor-pct', (parseFloat(fill.dataset.width) / 100).toFixed(2));
      // Add scroll-driven class for progressive enhancement
      fill.classList.add('factor-row__bar-fill--scroll-driven');
    }
    if (!REDUCED.matches) {
      wrapper.style.opacity = '0';
      wrapper.style.transform = 'translateY(4px)';
      wrapper.style.transition = 'opacity 450ms ease-out, transform 450ms ease-out';
      timers.push(setTimeout(() => {
        wrapper.style.opacity = '1';
        wrapper.style.transform = 'translateY(0)';
        if (fill) {
          requestAnimationFrame(() => {
            fill.style.transform = `scaleX(${parseFloat(fill.dataset.width) / 100})`;
          });
        }
      }, i * 120));
    } else if (fill) {
      fill.style.transform = `scaleX(${parseFloat(fill.dataset.width) / 100})`;
    }
  });

  // Strongest factor badge — "Top match" pill on highest-contributing factor
  const strongestKey = heroData?.matchNarrative?.strongest_factor;
  if (strongestKey) {
    const strongestRow = $list.querySelector(`.factor-row[data-factor="${strongestKey}"]`);
    if (strongestRow) {
      const badge = document.createElement('span');
      badge.className = 'factor-row__top-badge type-data';
      badge.textContent = 'Top match';
      badge.setAttribute('aria-label', 'Strongest contributing factor');
      // Insert after label-stack, before bar
      const labelStack = strongestRow.querySelector('.factor-row__label-stack');
      if (labelStack) labelStack.appendChild(badge);
    }
  }
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

/** Render deep_context extras for a factor (signature dishes, vibe, awards, etc.) */
function buildDeepContextExtras(factorKey) {
  const dc = _lastRestaurantData?.deep_context;
  if (!dc) return '';
  let html = '';

  if (factorKey === 'food') {
    if (dc.signature_dishes?.length > 0) {
      html += '<div class="factor-detail__context"><div class="factor-detail__context-header">Known For</div>';
      dc.signature_dishes.slice(0, 3).forEach(dish => {
        html += `<div class="factor-detail__context-item">${dish.dish}${dish.why ? ' — ' + dish.why : ''}</div>`;
      });
      html += '</div>';
    }
    if (dc.flavor_profiles?.length > 0) {
      html += `<div class="factor-detail__context-item">Flavors: ${dc.flavor_profiles.join(', ')}</div>`;
    }
  }

  if (factorKey === 'vibe') {
    if (dc.decor_style) html += `<div class="factor-detail__context-item">Décor: ${dc.decor_style}</div>`;
    if (dc.music_vibe) html += `<div class="factor-detail__context-item">Music: ${dc.music_vibe}</div>`;
    if (dc.energy_level != null) {
      const energyLabel = dc.energy_level >= 7 ? 'Buzzing' : dc.energy_level >= 4 ? 'Lively' : 'Chill';
      html += `<div class="factor-detail__context-item">Energy: ${energyLabel}</div>`;
    }
    if (dc.conversation_friendliness >= 7) {
      html += `<div class="factor-detail__context-item">Great for conversation</div>`;
    }
  }

  if (factorKey === 'reputation') {
    if (dc.awards_recognition?.length > 0) {
      html += '<div class="factor-detail__context">';
      dc.awards_recognition.slice(0, 2).forEach(award => {
        html += `<div class="factor-detail__context-item">${award}</div>`;
      });
      html += '</div>';
    }
    if (dc.chef_notable) html += `<div class="factor-detail__context-item">Notable chef</div>`;
  }

  if (factorKey === 'convenience') {
    if (dc.typical_wait_minutes) html += `<div class="factor-detail__context-item">Typical wait: ~${dc.typical_wait_minutes} min</div>`;
    if (dc.transit_accessibility) html += `<div class="factor-detail__context-item">Transit: ${dc.transit_accessibility}</div>`;
  }

  return html;
}

/** Build drill-down HTML for a factor — narrative + rank-based sub-factor list */
function buildFactorDetail(factorKey, scoring) {
  const details = scoring.factor_details?.[factorKey] || null;

  const SUB_META = {
    // V7 legacy keys
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
    // V9 sub-keys
    review_quality:  { icon: 'chat',       label: 'Review Quality' },
    ambiance:        { icon: 'moon',       label: 'Ambiance Reviews' },
    authenticity:    { icon: 'starFull',   label: 'Authenticity' },
    chef:            { icon: 'diamond',    label: 'Notable Chef' },
    trending:        { icon: 'bolt',       label: 'Trending' },
    review_service:  { icon: 'diamond',    label: 'Service Reviews' },
    instagram:       { icon: 'starOutline',label: 'Instagram' },
    spice:           { icon: 'fire',       label: 'Spice Level' },
    value:           { icon: 'heart',      label: 'Value Score' },
    crowd:           { icon: 'usersThree', label: 'Crowd Profile' },
    wait:            { icon: 'clock',      label: 'Wait Time' },
    parking:         { icon: 'briefcase',  label: 'Parking' },
    budget:          { icon: 'heart',      label: 'Budget Fit' },
  };

  // V9: Google rating row for reputation (always show if available, regardless of factor_details)
  const _buildGoogleRow = () => {
    if (factorKey !== 'reputation') return '';
    const gRating = _lastRestaurantData?.restaurant?.google_rating;
    const gCount = _lastRestaurantData?.restaurant?.google_review_count;
    if (!gRating) return '';
    const stars = parseFloat(gRating);
    const starColor = stars >= 4.5 ? 'var(--green, #4ade80)' : stars >= 4.0 ? 'var(--amber, #fbbf24)' : 'var(--red, #f87171)';
    const countLabel = gCount ? ` (${gCount} reviews)` : '';
    return `<div class="factor-detail__google-row">
      <span class="factor-detail__google-icon">${svgIcon('starFull', 14)}</span>
      <span class="factor-detail__google-rating" style="color:${starColor}">${stars.toFixed(1)}/5</span>
      <span class="factor-detail__google-label">Google${countLabel}</span>
    </div>`;
  };

  if (!details || typeof details !== 'object') {
    // Graceful fallback: show score context + weight + deep context even without sub-factor data
    const score = typeof scoring[factorKey] === 'number'
      ? Math.min(parseFloat(scoring[factorKey]) || 0, 10) : null;
    const weightsUsed = scoring.weights_used || {};
    const weight = weightsUsed[factorKey] != null ? Math.round(parseFloat(weightsUsed[factorKey]) * 100) : null;

    let fallback = _buildGoogleRow();
    if (score !== null) {
      const label = score >= 8.5 ? 'Excellent' : score >= 7 ? 'Good' : score >= 5 ? 'Fair' : 'Limited';
      fallback += `<div class="factor-detail__signal-row factor-detail__signal-row--neutral">
        ${strengthDots(score, 10)}
        <span class="factor-detail__signal-label">${score.toFixed(1)}/10 — ${label}</span>
      </div>`;
    }
    fallback += buildDeepContextExtras(factorKey);
    return `<div class="factor-detail__items">${fallback}</div>`;
  }

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

  // Confidence note when data quality is not high
  const conf = scoring.confidence?.[factorKey];
  const confLabels = { medium: 'Based on moderate data', low: 'Based on limited data' };
  if (conf && confLabels[conf]) {
    items += `<div class="factor-detail__confidence">${confLabels[conf]}</div>`;
  }

  // V9: Deep context integration
  const contextHtml = buildDeepContextExtras(factorKey);
  if (contextHtml) {
    items += contextHtml;
  }

  // V11: Semantic descriptors — show matched concepts in vibe/food drill-down
  if (factorKey === 'vibe' || factorKey === 'food') {
    const descriptors = _lastRestaurantData?.deep_context?.semantic_descriptors;
    if (descriptors?.length > 0) {
      const tags = descriptors.slice(0, 4).map(d =>
        `<span class="factor-detail__concept-tag type-data--xs">${d}</span>`
      ).join('');
      items += `<div class="factor-detail__concepts">${tags}</div>`;
    }
  }

  const narrative = buildFactorNarrative(factorKey, scoring);
  const googleRow = _buildGoogleRow();

  // Narrative-first: hero narrative above signal rows (evidence)
  const signalSection = items ? `<div class="factor-detail__signals">${items}</div>` : '';
  return `<div class="factor-detail__items">${narrative}${googleRow}${signalSection}</div>`;
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

/* ---- Ink Bloom: Emergence → Breathe → Resolve ---- */

// Animation state
let _bloomId = null;
let _bloomRunning = false;
let _wordRotationId = null;
let _pathData = []; // { el, len, delay }
let _statusPhase = 0;

// Emergence timing
const EMERGE_DOT_MS   = 200;   // Dot lands (0→200ms)
const EMERGE_STEM_MS  = 280;   // Curve draws (120→400ms)
const EMERGE_TINE_MS  = 250;   // Tines bloom (350→600ms)
const EMERGE_TOTAL_MS = 600;   // Full emergence

// Breathe parameters (ambient sine waves)
const BREATHE_DOT_PERIOD   = 3000;  // Dot luminance + scale
const BREATHE_FLOAT_PERIOD = 4000;  // Vertical float
const BREATHE_STROKE_PERIOD = 2500; // Stroke opacity

// Easing functions
function springEase(t) {
  // Overshoot spring: goes past 1.0 then settles
  const c4 = (2 * Math.PI) / 3;
  return t === 0 ? 0 : t === 1 ? 1
    : Math.pow(2, -10 * t) * Math.sin((t * 10 - 0.75) * c4) + 1;
}

function easeOutCubic(t) {
  return 1 - Math.pow(1 - t, 3);
}

function easeInOutCubic(t) {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

// Calligraphic ease: slow start (ink touching paper), fast middle (confident stroke),
// slow end (settling into curve). Maps to variable stroke-width for ink pressure feel.
function calligraphicEase(t) {
  if (t < 0.15) return (t / 0.15) ** 3 * 0.05;           // Slow start
  if (t < 0.6)  return 0.05 + ((t - 0.15) / 0.45) * 0.7; // Fast middle
  const end = (t - 0.6) / 0.4;
  return 0.75 + (1 - Math.pow(1 - end, 2.5)) * 0.25;     // Slow end
}

// Approximate speed (derivative) of calligraphicEase for stroke-width variation
function calligraphicSpeed(t) {
  if (t < 0.15) return (t / 0.15) ** 2 * 0.33;
  if (t < 0.6)  return 1.55;
  return (1 - ((t - 0.6) / 0.4)) ** 1.5 * 1.55;
}

/**
 * Ink Bloom: Start the logo emergence animation then transition to breathe loop.
 * Act 1 (Emergence): Dot lands → curve draws upward → tines bloom outward
 * Act 2 (Breathe): Gentle ambient sine waves — dot pulse, logo float, stroke breathe
 */
export function initLogoAnimation(craving) {
  const svg = document.querySelector('.logo-mark--loading');
  if (!svg) return;

  const tineL = svg.querySelector('.logo-mark__tine--left.logo-mark__tine--draw');
  const tineR = svg.querySelector('.logo-mark__tine--right.logo-mark__tine--draw');
  const curve = svg.querySelector('.logo-mark__curve--draw');
  const dot   = svg.querySelector('.logo-mark__dot--draw');

  // Measure and hide all paths
  _pathData = [];
  // Order: curve first (draws from dot upward), then tines bloom
  [
    { el: curve, delay: 120 },   // Stem grows after dot (120→400ms)
    { el: tineL, delay: 350 },   // Left tine blooms (350→580ms)
    { el: tineR, delay: 370 },   // Right tine 20ms after left (370→600ms)
  ].forEach(({ el, delay }) => {
    if (!el || !el.getTotalLength) return;
    const len = el.getTotalLength();
    el.style.strokeDasharray = len;
    el.style.strokeDashoffset = len;
    el.style.opacity = '1';
    _pathData.push({ el, len, delay });
  });

  // Hide dot initially
  if (dot) {
    dot.style.opacity = '0';
    dot.style.transform = 'scale(0)';
  }

  if (REDUCED.matches) {
    _pathData.forEach(({ el }) => { el.style.strokeDashoffset = '0'; });
    if (dot) { dot.style.opacity = '1'; dot.style.transform = 'scale(1)'; }
    _startInkTrail();
    _startStatusText(craving);
    return;
  }

  _bloomRunning = true;
  const startTime = performance.now();

  function tick(now) {
    if (!_bloomRunning) return;
    const elapsed = now - startTime;

    // --- Act 1: Emergence (0→600ms) ---
    if (elapsed < EMERGE_TOTAL_MS) {
      // Dot lands first (0→200ms) — spring overshoot scale
      if (dot) {
        const dotT = Math.min(1, elapsed / EMERGE_DOT_MS);
        if (dotT <= 1) {
          const eased = springEase(dotT);
          dot.style.opacity = Math.min(1, dotT * 2);
          dot.style.transform = `scale(${eased})`;
        }
      }

      // Curve draws upward from dot (120→400ms) with calligraphic variable speed
      // Tines bloom outward (350→600ms) with standard ease-out
      _pathData.forEach(({ el, len, delay }) => {
        const duration = delay < 200 ? EMERGE_STEM_MS : EMERGE_TINE_MS;
        const localElapsed = elapsed - delay;
        if (localElapsed <= 0) return;
        const localT = Math.min(1, localElapsed / duration);

        if (delay < 200) {
          // Curve: calligraphic ease with stroke-width variation
          const eased = calligraphicEase(localT);
          el.style.strokeDashoffset = len * (1 - eased);
          // Thinner at high speed (mid-stroke), wider at turns (start/end)
          const speed = calligraphicSpeed(localT);
          const strokeW = 2.8 - speed * 0.6;
          el.style.strokeWidth = Math.max(2.0, Math.min(3.2, strokeW));
        } else {
          // Tines: simple ease-out bloom
          const eased = easeOutCubic(localT);
          el.style.strokeDashoffset = len * (1 - eased);
        }
      });

      _bloomId = requestAnimationFrame(tick);
      return;
    }

    // --- Act 2: Breathe (600ms→∞) ---
    // Ensure everything is fully drawn
    _pathData.forEach(({ el }) => {
      el.style.strokeDashoffset = '0';
      el.style.strokeWidth = '';
    });
    if (dot) {
      dot.style.opacity = '1';
    }

    // Breathe loop — layered sine waves for organic idle
    const breatheTime = elapsed - EMERGE_TOTAL_MS;

    // 1. Dot luminance pulse: opacity 0.85→1.0 + scale 1.0→1.04
    if (dot) {
      const dotPhase = (breatheTime / BREATHE_DOT_PERIOD) * Math.PI * 2;
      const dotPulse = Math.sin(dotPhase);
      dot.style.opacity = 0.85 + dotPulse * 0.15;
      dot.style.transform = `scale(${1 + dotPulse * 0.04})`;
    }

    // 2. Logo float: translateY ±1.5px (phase-offset from dot)
    const logo = document.getElementById('loading-logo');
    if (logo) {
      const floatPhase = (breatheTime / BREATHE_FLOAT_PERIOD) * Math.PI * 2 + Math.PI / 3;
      const floatY = Math.sin(floatPhase) * 1.5;
      logo.style.transform = `translateY(${floatY.toFixed(2)}px)`;
    }

    // 3. Stroke opacity micro-breathe: 0.92→1.0
    const strokePhase = (breatheTime / BREATHE_STROKE_PERIOD) * Math.PI * 2;
    const strokeOp = 0.92 + Math.sin(strokePhase) * 0.08;
    _pathData.forEach(({ el }) => {
      el.style.opacity = strokeOp;
    });

    _bloomId = requestAnimationFrame(tick);
  }

  _bloomId = requestAnimationFrame(tick);

  // Start ink trail + status text
  _startInkTrail();
  _startStatusText(craving);
}

/** Ink Trail: Activate the 3-dot wave animation via CSS */
function _startInkTrail() {
  const trail = document.getElementById('ink-trail');
  if (trail) trail.classList.add('ink-trail--active');
}

/** Status text: blur-transition between phrases */
function _startStatusText(craving) {
  const el = document.getElementById('loading-status');
  if (!el) return;

  _statusPhase = 0;

  let phrases;
  if (craving && craving.trim().length > 3) {
    const short = craving.trim().split(/\s+/).slice(0, 3).join(' ');
    phrases = [`Scanning spots for ${short}\u2026`, 'Almost there\u2026'];
  } else {
    phrases = ['Finding your spot\u2026', 'Almost there\u2026'];
  }

  el.textContent = phrases[0];
  el.style.opacity = '0.7';
  el.style.filter = '';
  el.classList.remove('loading-status--blurring');

  if (REDUCED.matches) return;

  // Helper: blur-transition to new text
  function blurSwap(newText, newOpacity) {
    if (!_bloomRunning) return;
    el.classList.add('loading-status--blurring');
    setTimeout(() => {
      el.textContent = newText;
      el.classList.remove('loading-status--blurring');
      el.style.opacity = newOpacity;
    }, 200);
  }

  setTimeout(() => blurSwap(phrases[1], '0.7'), 4000);
  setTimeout(() => blurSwap('Still searching\u2026', '0.5'), 8000);
  setTimeout(() => blurSwap('Taking longer than usual\u2026', '0.5'), 13000);
}

/**
 * Start rotating food/bar words below the logo.
 * Words cycle with breath-dissolve: blur + letter-spacing expansion.
 * @param {string[]} phrases - Array of words to cycle through
 */
export function startWordRotation(phrases) {
  const el = document.getElementById('loading-word');
  if (!el || !phrases || !phrases.length) return;

  let idx = 0;
  el.textContent = phrases[0];
  el.classList.remove('loading-word--exiting', 'loading-word--entering');
  el.style.opacity = '1';
  el.style.filter = '';
  el.style.letterSpacing = '';

  if (REDUCED.matches) {
    _wordRotationId = setInterval(() => {
      idx = (idx + 1) % phrases.length;
      el.textContent = phrases[idx];
    }, 2000);
    return;
  }

  _wordRotationId = setInterval(() => {
    // Breath dissolve out: blur + letter-spacing expand
    el.classList.add('loading-word--exiting');

    setTimeout(() => {
      idx = (idx + 1) % phrases.length;
      el.textContent = phrases[idx];
      el.classList.remove('loading-word--exiting');
      el.classList.add('loading-word--entering');

      // Force reflow, then animate in
      void el.offsetWidth;
      el.classList.remove('loading-word--entering');
    }, 240);
  }, 2000);
}

/** Stop the word rotation interval. */
export function stopWordRotation() {
  if (_wordRotationId) {
    clearInterval(_wordRotationId);
    _wordRotationId = null;
  }
}

/**
 * Act 3: Resolve — "Ink Settles"
 * Logo stops breathing, dot blooms with glow, strokes thicken,
 * ink trail converges to confident dash.
 */
export function resolveLogoToFound(restaurantName) {
  const logo = document.getElementById('loading-logo');
  if (!logo) return Promise.resolve();

  // Stop breathe loop
  _bloomRunning = false;
  if (_bloomId) {
    cancelAnimationFrame(_bloomId);
    _bloomId = null;
  }
  stopWordRotation();

  if (REDUCED.matches) {
    logo.style.transform = '';
    logo.style.opacity = '1';
    const trail = document.getElementById('ink-trail');
    if (trail) trail.classList.add('ink-trail--resolved');
    const statusEl = document.getElementById('loading-status');
    if (statusEl && restaurantName) statusEl.textContent = restaurantName;
    return Promise.resolve();
  }

  // Snap all strokes to fully drawn + reset breathe state
  _pathData.forEach(({ el }) => {
    el.style.strokeDashoffset = '0';
    el.style.opacity = '1';
  });

  const svg = document.querySelector('.logo-mark--loading');
  const dot = svg?.querySelector('.logo-mark__dot--draw');

  // Snap logo to center (stop floating)
  logo.style.transition = 'transform 150ms cubic-bezier(0.2, 1, 0.4, 1)';
  logo.style.transform = 'translateY(0)';

  // Dot bloom with glow
  if (dot) {
    dot.style.opacity = '1';
    dot.style.transition = 'transform 300ms cubic-bezier(0.34, 1.56, 0.64, 1)';
    dot.style.transform = 'scale(1.3)';
    setTimeout(() => {
      dot.style.transition = 'transform 250ms cubic-bezier(0.2, 1, 0.4, 1)';
      dot.style.transform = 'scale(1)';
    }, 200);
  }

  // Add resolved class for dot glow filter
  if (svg) svg.classList.add('logo-mark--resolved');

  // Strokes thicken confidently
  _pathData.forEach(({ el }) => {
    el.style.transition = 'stroke-width 200ms cubic-bezier(0.34, 1.56, 0.64, 1)';
    el.style.strokeWidth = '2.9';
  });

  // Ink trail: dots converge to dash
  const trail = document.getElementById('ink-trail');
  if (trail) trail.classList.add('ink-trail--resolved');

  // Status text: blur-swap to restaurant name
  const statusEl = document.getElementById('loading-status');
  if (statusEl && restaurantName) {
    statusEl.classList.add('loading-status--blurring');
    setTimeout(() => {
      statusEl.textContent = restaurantName;
      statusEl.classList.remove('loading-status--blurring');
      statusEl.style.opacity = '1';
    }, 200);
  }

  return new Promise(resolve => {
    // Logo scale pulse: 1→1.06→1
    setTimeout(() => {
      logo.style.transition = 'transform 300ms cubic-bezier(0.34, 1.56, 0.64, 1)';
      logo.style.transform = 'scale(1.06)';
    }, 50);

    setTimeout(() => {
      logo.style.transition = 'transform 250ms cubic-bezier(0.2, 1, 0.4, 1)';
      logo.style.transform = 'scale(1)';
    }, 250);

    setTimeout(resolve, 500);
  });
}

/** Stop bloom + cleanup for cancel/back navigation. */
export function cleanupLoadingLogo() {
  _bloomRunning = false;
  if (_bloomId) {
    cancelAnimationFrame(_bloomId);
    _bloomId = null;
  }
  stopWordRotation();
  _pathData = [];

  const logo = document.getElementById('loading-logo');
  if (logo) {
    logo.style.transform = '';
    logo.style.opacity = '';
    logo.style.transition = '';
  }

  // Reset SVG resolved state
  const svg = document.querySelector('.logo-mark--loading');
  if (svg) svg.classList.remove('logo-mark--resolved');

  // Reset ink trail
  const trail = document.getElementById('ink-trail');
  if (trail) trail.classList.remove('ink-trail--active', 'ink-trail--resolved');

  // Reset status text
  const statusEl = document.getElementById('loading-status');
  if (statusEl) {
    statusEl.textContent = '';
    statusEl.style.opacity = '';
    statusEl.style.filter = '';
    statusEl.classList.remove('loading-status--blurring');
  }

  // Reset word element
  const word = document.getElementById('loading-word');
  if (word) {
    word.textContent = '';
    word.style.filter = '';
    word.style.letterSpacing = '';
    word.classList.remove('loading-word--exiting', 'loading-word--entering');
  }

  // Reset path styles
  if (svg) {
    const paths = svg.querySelectorAll('.logo-mark__tine--draw, .logo-mark__curve--draw');
    paths.forEach(p => {
      p.style.strokeDashoffset = '';
      p.style.strokeDasharray = '';
      p.style.strokeWidth = '';
      p.style.opacity = '';
      p.style.transition = '';
    });
    const dot = svg.querySelector('.logo-mark__dot--draw');
    if (dot) {
      dot.style.opacity = '';
      dot.style.transform = '';
      dot.style.transition = '';
      dot.style.filter = '';
    }
  }
}

// Keep exports compatible
export function startSearchPulse() { /* no-op — ink bloom handles everything */ }
export function stopSearchPulse() { /* no-op — ink bloom handles everything */ }

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
      // Gentle inward drift + sine-wave wind for organic floating
      const dx = p.targetX - p.x;
      const dy = p.targetY - p.y;
      const windX = Math.sin(now * 0.0008 + p.speed * 20) * 0.4;
      const windY = Math.cos(now * 0.0006 + p.speed * 15) * 0.2;
      p.x += dx * 0.003 + (Math.random() - 0.5) * 0.6 + windX;
      p.y += dy * 0.003 + (Math.random() - 0.5) * 0.6 + windY;

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

/* ---- Tiered Celebration System ---- */
/**
 * Tier 1 (70-79): Settle — ring pulse glow, soft chime
 * Tier 2 (80-87): Glow — ring glow + subtle particle burst (12)
 * Tier 3 (88-94): Confetti — full confetti (36) + glow + arpeggio
 * Tier 4 (95-100): Spectacle — screen shimmer + confetti + "Perfect Match" ink-reveal
 */
function getCelebrationTier(score) {
  if (score >= 95) return 4;
  if (score >= 88) return 3;
  if (score >= 80) return 2;
  if (score >= 70) return 1;
  return 0;
}

export function fireCelebration(score) {
  if (REDUCED.matches) return;
  const tier = typeof score === 'number' ? getCelebrationTier(score) : 3;
  if (tier === 0) return;

  // Tier 1+: Ring pulse glow
  const ringWrap = document.querySelector('.score-hero__ring-wrap');
  if (ringWrap) {
    ringWrap.classList.add('score-hero__ring-wrap--celebrating');
    ringWrap.addEventListener('animationend',
      () => ringWrap.classList.remove('score-hero__ring-wrap--celebrating'), { once: true });
  }
  const tile = document.getElementById('score-tile-donde');
  if (tile) {
    tile.classList.add('score-tile--celebrating');
    tile.addEventListener('animationend',
      () => tile.classList.remove('score-tile--celebrating'), { once: true });
  }

  // Tier 2+: Particle burst
  if (tier >= 2) {
    const count = tier >= 3 ? 36 : 12;
    _fireParticleBurst(count, tier >= 3);
  }

  // Tier 4: Spectacle
  if (tier >= 4) {
    _fireSpectacle(score);
  }
}

function _fireParticleBurst(count, addTrails) {
  const canvas = document.getElementById('particle-canvas');
  if (!canvas) return;

  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  canvas.width = canvas.offsetWidth * (window.devicePixelRatio || 1);
  canvas.height = canvas.offsetHeight * (window.devicePixelRatio || 1);
  canvas.style.display = '';
  ctx.setTransform(window.devicePixelRatio || 1, 0, 0, window.devicePixelRatio || 1, 0, 0);

  const w = canvas.offsetWidth;
  const h = canvas.offsetHeight;
  const ac = getComputedStyle(document.documentElement).getPropertyValue('--ac').trim() || '#6c5ce7';
  const originX = w / 2;
  const originY = h * 0.3;
  const particles = [];
  const COLORS = [ac, '#FFD700', '#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4'];

  for (let i = 0; i < count; i++) {
    const angle = Math.random() * Math.PI * 2;
    const speed = 2 + Math.random() * 4;
    particles.push({
      x: originX, y: originY,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed - 2,
      size: 3 + Math.random() * 4,
      color: COLORS[Math.floor(Math.random() * COLORS.length)],
      alpha: 1,
      rotation: Math.random() * 360,
      rotSpeed: (Math.random() - 0.5) * 8,
      shape: Math.random() > 0.5 ? 'rect' : 'circle',
      trail: addTrails ? [] : null,
      phase: Math.random() * Math.PI * 2,
    });
  }

  const startTime = performance.now();
  const DURATION = 1500;

  function draw(now) {
    const elapsed = now - startTime;
    if (elapsed > DURATION) { celebAnimId = null; return; }

    ctx.clearRect(0, 0, w, h);
    const progress = elapsed / DURATION;

    // Additive blending for glow
    ctx.globalCompositeOperation = 'lighter';

    for (const p of particles) {
      // Wind simulation — organic sine drift
      p.x += p.vx + Math.sin(now * 0.001 + p.phase) * 0.3;
      p.y += p.vy;
      p.vy += 0.12;
      p.vx *= 0.99;
      p.rotation += p.rotSpeed;
      p.alpha = Math.max(0, 1 - progress * 1.2);

      // Particle trails
      if (p.trail) {
        p.trail.push({ x: p.x, y: p.y, a: p.alpha });
        if (p.trail.length > 5) p.trail.shift();
        for (let t = 0; t < p.trail.length - 1; t++) {
          const tp = p.trail[t];
          ctx.globalAlpha = tp.a * (t / p.trail.length) * 0.3;
          ctx.fillStyle = p.color;
          ctx.beginPath();
          ctx.arc(tp.x, tp.y, p.size / 3, 0, Math.PI * 2);
          ctx.fill();
        }
      }

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

    ctx.globalCompositeOperation = 'source-over';
    celebAnimId = requestAnimationFrame(draw);
  }

  if (celebAnimId) cancelAnimationFrame(celebAnimId);
  celebAnimId = requestAnimationFrame(draw);
}

/** Tier 4: Screen-edge shimmer + "Perfect Match" ink-reveal */
function _fireSpectacle(score) {
  let shimmer = document.querySelector('.celebration-spectacle');
  if (!shimmer) {
    shimmer = document.createElement('div');
    shimmer.className = 'celebration-spectacle';
    shimmer.setAttribute('aria-hidden', 'true');
    document.querySelector('.app')?.appendChild(shimmer);
  }
  shimmer.classList.add('celebration-spectacle--active');
  shimmer.addEventListener('animationend', () => {
    shimmer.classList.remove('celebration-spectacle--active');
  }, { once: true });

  let banner = document.querySelector('.celebration-banner');
  if (!banner) {
    banner = document.createElement('div');
    banner.className = 'celebration-banner type-emotional';
    banner.setAttribute('aria-hidden', 'true');
    document.querySelector('.app')?.appendChild(banner);
  }
  banner.textContent = score >= 98 ? 'Flawless Match' : 'Perfect Match';
  banner.classList.add('celebration-banner--active');
  setTimeout(() => {
    banner.classList.add('celebration-banner--fading');
    setTimeout(() => {
      banner.classList.remove('celebration-banner--active', 'celebration-banner--fading');
    }, 600);
  }, 2000);
}

/* ---- MOTION-4: Theme Wash Consistency (documentation) ---- */
/**
 * Theme wash animation currently fires from two places:
 *   1. Manual theme toggle: events.js `toggle-mode` action calls setTheme() -> applyTheme()
 *      which triggers the radial clip-path wash via theme-wash overlay.
 *   2. Result cuisine theme: render.js calls setWashOrigin() + setTheme() after a result loads.
 *
 * MISSING: Auto-theme from cuisine typing does NOT fire the wash.
 *   In events.js line ~898, `setThemeVisualOnly(detected)` uses a simple CSS crossfade
 *   instead of the radial wash. To add the wash:
 *
 *   In theme.js, update setThemeVisualOnly() to call the wash when the culture
 *   actually changes (prevCulture !== culture). Specifically:
 *
 *   1. Import or inline the wash logic from applyTheme().
 *   2. Before `root.setAttribute('data-theme', culture)`, trigger the wash overlay:
 *        const wash = document.getElementById('theme-wash');
 *        if (wash && !REDUCED.matches) {
 *          wash.setAttribute('data-theme', culture);
 *          // Origin: center of the craving input field
 *          const $input = document.getElementById('craving-input');
 *          const rect = $input?.getBoundingClientRect();
 *          const ox = rect ? rect.left + rect.width / 2 : window.innerWidth / 2;
 *          const oy = rect ? rect.top + rect.height / 2 : window.innerHeight / 2;
 *          wash.style.setProperty('--wash-x', `${ox}px`);
 *          wash.style.setProperty('--wash-y', `${oy}px`);
 *          wash.classList.add('theme-wash--active');
 *          setTimeout(() => {
 *            root.setAttribute('data-theme', culture);
 *            wash.classList.remove('theme-wash--active');
 *          }, 450);
 *          return; // skip the immediate root swap below
 *        }
 *   3. Keep the crossfade as fallback for reduced-motion or missing wash element.
 *
 *   Files to edit: theme.js (setThemeVisualOnly function)
 *   Owner: theme.js agent
 */

/* ---- MOTION-3: Optimized Cursor Glow ---- */
/**
 * Optimized cursor glow that stops the RAF loop when cursor is stationary.
 * Stops lerp calculations after 100ms of no mousemove, resumes on next move.
 *
 * INTEGRATION NOTE: This function replaces initCursorGlow() in app.js.
 * To integrate, replace the initCursorGlow() function in app.js with:
 *   import { initCursorGlowOptimized } from './animations.js';
 * Then call initCursorGlowOptimized() instead of initCursorGlow() in init().
 */
export function initCursorGlowOptimized() {
  const $glow = document.querySelector('.cursor-glow');
  if (!$glow) return;
  if (matchMedia('(hover: none)').matches || REDUCED.matches) return;

  let targetX = 0, targetY = 0, currentX = 0, currentY = 0;
  let active = false;
  let isMoving = false;
  let moveTimeout = null;
  let rafId = null;

  function lerpGlow() {
    if (!active) return;
    if (!isMoving) {
      // Cursor stationary — stop RAF loop, snap to final position
      currentX = targetX;
      currentY = targetY;
      $glow.style.transform = `translate(${currentX - 100}px, ${currentY - 100}px)`;
      rafId = null;
      return;
    }
    currentX += (targetX - currentX) * 0.15;
    currentY += (targetY - currentY) * 0.15;
    $glow.style.transform = `translate(${currentX - 100}px, ${currentY - 100}px)`;
    rafId = requestAnimationFrame(lerpGlow);
  }

  document.addEventListener('mousemove', (e) => {
    targetX = e.clientX;
    targetY = e.clientY;

    // Mark cursor as moving and reset idle timer
    isMoving = true;
    clearTimeout(moveTimeout);
    moveTimeout = setTimeout(() => { isMoving = false; }, 100);

    if (!active) {
      active = true;
      $glow.style.opacity = '0.2';
    }

    // Resume RAF loop if not already running
    if (!rafId) {
      rafId = requestAnimationFrame(lerpGlow);
    }
  }, { passive: true });

  document.addEventListener('mouseleave', () => {
    active = false;
    isMoving = false;
    clearTimeout(moveTimeout);
    if (rafId) { cancelAnimationFrame(rafId); rafId = null; }
    $glow.style.opacity = '0';
  });
}

/* ---- First-Time User "Your first match" Welcome Moment ---- */
/**
 * Show a brief "Your first match" text above the score ring on the user's
 * very first result, then fire a celebration regardless of score tier.
 *
 * INTEGRATION: transitions.js should call fireFirstTimeWelcome() during
 * manifestResult(), just before the score ring count-up begins.
 *
 * Uses localStorage key `donde_first_result_seen` to track first-time state.
 * No-op if reduced motion is preferred or if not the first result.
 */
export function fireFirstTimeWelcome() {
  if (REDUCED.matches) return;

  // Check if this is the user's very first result
  try {
    if (localStorage.getItem('donde_first_result_seen')) return;
  } catch { return; } // localStorage unavailable (private browsing, etc.)

  // Find the score ring area to position the text above it
  const $ringWrap = document.querySelector('.score-hero__ring-wrap');
  if (!$ringWrap) return;

  // Ensure ring-wrap is positioned for absolute child
  if (getComputedStyle($ringWrap).position === 'static') {
    $ringWrap.style.position = 'relative';
  }

  // Create and insert the "Your first match" text element
  const $text = document.createElement('span');
  $text.className = 'first-match-text type-emotional';
  $text.textContent = 'Your first match';
  $text.setAttribute('aria-hidden', 'true');
  $ringWrap.appendChild($text);

  // Trigger the fade-in / hold / fade-out animation
  requestAnimationFrame(() => {
    $text.classList.add('first-match-text--visible');
  });

  // Fire a celebration after the text has been visible briefly (300ms fade-in)
  setTimeout(() => {
    fireCelebration(85); // Tier 2 celebration regardless of actual score
  }, 400);

  // Clean up the element after animation completes
  $text.addEventListener('animationend', () => {
    $text.remove();
  }, { once: true });

  // Mark first result as seen
  try {
    localStorage.setItem('donde_first_result_seen', '1');
  } catch { /* ignore */ }
}
