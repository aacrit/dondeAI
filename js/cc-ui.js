/**
 * DondeAI Mission Control — UI Rendering
 * Full-width dashboard with collapsible terminal drawer
 * Premium Edition: glassmorphism, count-up, morning brief, smart actions
 */

// ═══════════════════════════════════════════════════════════════════
// Init
// ═══════════════════════════════════════════════════════════════════

document.addEventListener('DOMContentLoaded', () => {
  checkAuth();
  if (typeof initCOOTerminal === 'function') initCOOTerminal();
  if (typeof updateLiveAPIUI === 'function') updateLiveAPIUI();

  // Show loading state on pulse cards
  document.querySelectorAll('.mc-pulse-card').forEach(c => c.classList.add('mc-pulse-card--loading'));

  // Quick test Enter key
  const $qt = document.getElementById('quick-test-input');
  if ($qt) $qt.addEventListener('keydown', (e) => { if (e.key === 'Enter') runQuickTest(); });

  // Escape key closes detail panel
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      const detail = document.getElementById('mc-detail');
      if (detail?.classList.contains('mc-detail--open')) { closeDetail(); e.preventDefault(); }
    }
  });
});

// ═══════════════════════════════════════════════════════════════════
// Animated Count-Up
// ═══════════════════════════════════════════════════════════════════

/**
 * Animate a numeric value counting up from 0 to target.
 * Uses requestAnimationFrame for 60fps smoothness.
 * @param {HTMLElement} el - The element to update
 * @param {number} target - Target value
 * @param {string} suffix - Optional suffix like '%'
 * @param {number} duration - Duration in ms (default 1200)
 */
function animateCountUp(el, target, suffix, duration) {
  if (!el) return;
  suffix = suffix || '';
  duration = duration || 1200;

  // Respect reduced motion
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    el.textContent = target + suffix;
    return;
  }

  const start = performance.now();
  const startVal = 0;

  el.classList.add('mc-pulse-card__value--counting');

  function step(now) {
    const elapsed = now - start;
    const progress = Math.min(elapsed / duration, 1);
    // Ease-out curve for natural deceleration
    const eased = 1 - Math.pow(1 - progress, 3);
    const current = Math.round(startVal + (target - startVal) * eased);
    el.textContent = current + suffix;

    if (progress < 1) {
      requestAnimationFrame(step);
    } else {
      el.textContent = target + suffix;
      setTimeout(() => el.classList.remove('mc-pulse-card__value--counting'), 100);
    }
  }

  requestAnimationFrame(step);
}

// ═══════════════════════════════════════════════════════════════════
// Pulse Cards + Grade
// ═══════════════════════════════════════════════════════════════════

function updatePulseFromRun(run) {
  if (!run) return;

  // Remove loading skeleton
  document.querySelectorAll('.mc-pulse-card').forEach(c => c.classList.remove('mc-pulse-card--loading'));

  const avgDm = Math.round(Number(run.avg_dm) || 0);
  const avgFit = Math.round(Number(run.avg_score_fit) || 0);
  const avgBlurb = Math.round(Number(run.avg_blurb_quality) || 0);
  const total = run.total || 1;
  const passCount = run.grade_pass_count || run.passed_60 || 0;
  const passRate = Math.round(passCount / total * 100);
  const gapCount = run.gap_count || 0;

  // Pulse card values with count-up animation
  const $health = document.getElementById('pulse-health-val');
  const $dm = document.getElementById('pulse-dm-val');
  const $issues = document.getElementById('pulse-issues-val');

  if ($health) {
    $health.className = 'mc-pulse-card__value ' + ragClass(passRate);
    animateCountUp($health, passRate, '%');
  }
  if ($dm) {
    $dm.className = 'mc-pulse-card__value ' + ragClass(avgDm);
    animateCountUp($dm, avgDm, '');
  }
  if ($issues) {
    $issues.textContent = gapCount;
    $issues.className = 'mc-pulse-card__value ' + (gapCount === 0 ? 'rag-green' : gapCount <= 3 ? 'rag-amber' : 'rag-red');
  }

  // Delta arrows from trend data
  if (state.trendData && state.trendData.length >= 2) {
    const prev = state.trendData[1]; // second most recent
    if (prev) {
      const prevDm = Math.round(Number(prev.avg_dm) || 0);
      const prevPassCount = prev.grade_pass_count || prev.passed_60 || 0;
      const prevTotal = prev.total || 1;
      const prevPassRate = Math.round(prevPassCount / prevTotal * 100);
      const prevGapCount = prev.gap_count || 0;

      addDeltaArrow('pulse-health-val', passRate - prevPassRate);
      addDeltaArrow('pulse-dm-val', avgDm - prevDm);
      addDeltaArrow('pulse-issues-val', -(gapCount - prevGapCount)); // negative = more issues = bad
    }
  }

  // Stale data warning
  if (run.created_at) {
    const ageMs = Date.now() - new Date(run.created_at).getTime();
    const ageHours = ageMs / (1000 * 60 * 60);
    if (ageHours > 24) {
      document.querySelectorAll('.mc-pulse-card').forEach(card => {
        card.classList.add('mc-pulse-card--stale');
      });
      // Add freshness note under pass rate
      const healthCard = document.getElementById('pulse-health');
      if (healthCard && !healthCard.querySelector('.mc-pulse-card__freshness')) {
        const note = document.createElement('span');
        note.className = 'mc-pulse-card__freshness';
        note.textContent = 'Last: ' + timeAgo(run.created_at);
        healthCard.appendChild(note);
      }
    }
  }

  // Engine grade with gradient coloring
  const grade = computeEngineGrade(run);
  const $letter = document.getElementById('mc-grade-letter');
  const $sub = document.getElementById('mc-grade-sub');
  if ($letter) {
    $letter.textContent = grade;
    // Apply gradient class based on grade
    $letter.classList.remove('mc-grade__letter--green', 'mc-grade__letter--amber', 'mc-grade__letter--red');
    if (grade.startsWith('A')) {
      $letter.classList.add('mc-grade__letter--green');
    } else if (grade.startsWith('B')) {
      // Default gradient (accent/indigo) - no extra class needed
    } else if (grade.startsWith('C')) {
      $letter.classList.add('mc-grade__letter--amber');
    } else {
      $letter.classList.add('mc-grade__letter--red');
    }
  }
  if ($sub) {
    $sub.textContent = 'DM ' + avgDm + ' \u00B7 Fit ' + avgFit + ' \u00B7 Blurb ' + avgBlurb;
  }

  // Health dot
  const $dot = document.getElementById('mc-health-dot');
  if ($dot) {
    $dot.className = 'mc-health-dot' + (passRate >= 80 ? '' : passRate >= 60 ? ' mc-health-dot--amber' : ' mc-health-dot--red');
  }

  // Ambient glow on Dashboard
  const $board = document.querySelector('.mc-dashboard');
  if ($board) {
    $board.classList.remove('mc-dashboard--green', 'mc-dashboard--amber', 'mc-dashboard--red');
    $board.classList.add(passRate >= 80 ? 'mc-dashboard--green' : passRate >= 60 ? 'mc-dashboard--amber' : 'mc-dashboard--red');
  }

  // Grade distribution bar
  const $dist = document.getElementById('mc-grade-dist');
  if ($dist && run.grade_distribution) {
    const gd = typeof run.grade_distribution === 'string' ? JSON.parse(run.grade_distribution) : run.grade_distribution;
    const grades = ['A+', 'A', 'A-', 'B+', 'B', 'B-', 'C+', 'C', 'C-', 'D', 'F'];
    const colors = { 'A+': '#22c55e', 'A': '#22c55e', 'A-': '#4ade80', 'B+': '#6366f1', 'B': '#6366f1', 'B-': '#818cf8', 'C+': '#f59e0b', 'C': '#f59e0b', 'C-': '#fbbf24', 'D': '#ef4444', 'F': '#ef4444' };
    $dist.innerHTML = grades.filter(g => gd[g]).map(g => {
      const count = gd[g] || 0;
      const h = Math.max(4, Math.round((count / total) * 24));
      return '<div class="mc-grade__dist-bar" style="height:' + h + 'px;background:' + colors[g] + '" title="' + g + ': ' + count + '"></div>';
    }).join('');
  }

  // Sparklines from trend data
  if (state.trendData && state.trendData.length >= 3) {
    renderMiniSparkline('pulse-health', state.trendData.map(r => {
      const t = r.total || 1;
      const p = r.grade_pass_count || r.passed_60 || 0;
      return Math.round(p / t * 100);
    }));
    renderMiniSparkline('pulse-dm', state.trendData.map(r => Math.round(Number(r.avg_dm) || 0)));
    renderMiniSparkline('pulse-issues', state.trendData.map(r => r.gap_count || 0));
    renderMiniSparkline('mc-grade', state.trendData.map(r => {
      var dm = Number(r.avg_dm) || 0;
      var fit = Number(r.avg_score_fit) || 0;
      var blurb = Number(r.avg_blurb_quality) || 0;
      return Math.round(dm * 0.4 + fit * 0.3 + blurb * 0.3);
    }));
  }

  // Morning brief banner
  renderMorningBriefBanner(run);

  // Action button urgency states
  updateActionUrgency(run, gapCount);

  // Store for COO terminal
  state.latestRun = run;
}

// ═══════════════════════════════════════════════════════════════════
// Delta Arrow Helper
// ═══════════════════════════════════════════════════════════════════

function addDeltaArrow(parentValueId, delta) {
  const $val = document.getElementById(parentValueId);
  if (!$val) return;

  // Remove any existing delta
  const existing = $val.parentElement.querySelector('.mc-pulse-card__delta');
  if (existing) existing.remove();

  if (delta === 0) return;

  const span = document.createElement('span');
  span.className = 'mc-pulse-card__delta';
  if (delta > 0) {
    span.classList.add('mc-pulse-card__delta--up');
    span.textContent = '\u2191' + delta;
  } else {
    span.classList.add('mc-pulse-card__delta--down');
    span.textContent = '\u2193' + Math.abs(delta);
  }

  $val.after(span);
}

// ═══════════════════════════════════════════════════════════════════
// Morning Brief Banner
// ═══════════════════════════════════════════════════════════════════

function renderMorningBriefBanner(run) {
  const $brief = document.getElementById('mc-brief');
  const $icon = document.getElementById('mc-brief-icon');
  const $text = document.getElementById('mc-brief-text');
  const $action = document.getElementById('mc-smart-action');
  if (!$brief || !$text || !$action) return;

  var hour = new Date().getHours();
  var greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';

  if (!run) {
    // No data state
    $brief.style.display = '';
    $brief.className = 'mc-brief mc-brief--amber';
    $icon.textContent = '\u26A0';
    $text.innerHTML = '<strong>' + greeting + ', Aacrit.</strong> No test data yet. Run your first quality scan to see engine health.';
    $action.innerHTML = '<button class="mc-smart-action__btn mc-smart-action__btn--primary" onclick="processCOOInput(\'scan\')">Run First Scan</button>';
    return;
  }

  const avgDm = Math.round(Number(run.avg_dm) || 0);
  const avgFit = Math.round(Number(run.avg_score_fit) || 0);
  const avgBlurb = Math.round(Number(run.avg_blurb_quality) || 0);
  const passCount = run.grade_pass_count || run.passed_60 || 0;
  const total = run.total || 1;
  const passRate = Math.round(passCount / total * 100);
  const gapCount = run.gap_count || 0;
  const grade = computeEngineGrade(run);

  // Determine RAG state
  var ragState, icon, message, actionHtml;

  if (passRate >= 85 && gapCount === 0) {
    // GREEN
    ragState = 'green';
    icon = '\u2713';
    message = '<strong>' + greeting + ', Aacrit.</strong> Engine at ' + grade + ' \u2014 ' + passCount + '/' + total + ' passed, DM ' + avgDm + ', zero issues.';
    actionHtml = '<button class="mc-smart-action__btn mc-smart-action__btn--success" onclick="processCOOInput(\'regression\')">Run Regression Guard</button>';
  } else if (gapCount > 5 || passRate < 70) {
    // RED
    ragState = 'red';
    icon = '\u2717';
    message = '<strong>' + greeting + ', Aacrit.</strong> Engine at ' + grade + ' \u2014 ' + gapCount + ' issue' + (gapCount !== 1 ? 's' : '') + ' need attention. DM ' + avgDm + ', ' + passRate + '% pass.';
    actionHtml = '<button class="mc-smart-action__btn mc-smart-action__btn--danger" onclick="processCOOInput(\'fix bugs\')">Fix ' + gapCount + ' Issue' + (gapCount !== 1 ? 's' : '') + '</button>';
  } else {
    // AMBER
    ragState = 'amber';
    icon = '\u26A0';
    if (gapCount > 0) {
      message = '<strong>' + greeting + ', Aacrit.</strong> Engine at ' + grade + ' \u2014 ' + gapCount + ' minor issue' + (gapCount !== 1 ? 's' : '') + '. DM ' + avgDm + ', ' + passRate + '% pass.';
      actionHtml = '<button class="mc-smart-action__btn mc-smart-action__btn--primary" onclick="processCOOInput(\'fix bugs\')">Fix ' + gapCount + ' Issue' + (gapCount !== 1 ? 's' : '') + '</button>';
    } else {
      message = '<strong>' + greeting + ', Aacrit.</strong> Engine stable at ' + grade + '. DM ' + avgDm + ', ' + passRate + '% pass. Time for a fresh scan?';
      actionHtml = '<button class="mc-smart-action__btn mc-smart-action__btn--primary" onclick="processCOOInput(\'scan\')">Run Quality Scan</button>';
    }
  }

  // Stale data appendage
  if (run.created_at) {
    var ageMs = Date.now() - new Date(run.created_at).getTime();
    var ageHours = ageMs / (1000 * 60 * 60);
    if (ageHours > 24) {
      message += ' <span class="mc-brief__stale">Data is ' + timeAgo(run.created_at) + ' old.</span>';
      // Override action to suggest fresh scan if stale
      actionHtml = '<button class="mc-smart-action__btn mc-smart-action__btn--primary" onclick="processCOOInput(\'scan\')">Run Fresh Scan</button>';
    }
  }

  $brief.style.display = '';
  $brief.className = 'mc-brief mc-brief--' + ragState;
  $icon.textContent = icon;
  $text.innerHTML = message;
  $action.innerHTML = actionHtml;
}

// ═══════════════════════════════════════════════════════════════════
// Action Button Urgency States
// ═══════════════════════════════════════════════════════════════════

function updateActionUrgency(run, gapCount) {
  // Fix Bugs button
  var fixBtn = document.getElementById('action-fix');
  if (fixBtn) {
    fixBtn.classList.remove('mc-action-btn--urgent', 'mc-action-btn--warn');
    if (gapCount > 5) {
      fixBtn.classList.add('mc-action-btn--urgent');
    } else if (gapCount > 0) {
      fixBtn.classList.add('mc-action-btn--warn');
    }
  }

  // Cache button: check if hit rate is low
  var cacheBtn = document.getElementById('action-cache');
  if (cacheBtn) {
    cacheBtn.classList.remove('mc-action-btn--warn');
    var cacheText = document.getElementById('mc-footer-cache');
    if (cacheText) {
      var cacheMatch = cacheText.textContent.match(/(\d+)/);
      if (cacheMatch && parseInt(cacheMatch[1]) < 30) {
        cacheBtn.classList.add('mc-action-btn--warn');
      }
    }
  }
}

// ═══════════════════════════════════════════════════════════════════
// Sparkline Renderer
// ═══════════════════════════════════════════════════════════════════

function renderMiniSparkline(parentId, values) {
  var $parent = document.getElementById(parentId);
  if (!$parent) return;
  var $spark = $parent.querySelector('.mc-sparkline');
  if (!$spark) {
    $spark = document.createElement('div');
    $spark.className = 'mc-sparkline';
    $spark.style.cssText = 'display:flex;align-items:flex-end;gap:1px;height:16px;margin-top:4px;justify-content:center';
    $parent.appendChild($spark);
  }
  var max = Math.max.apply(null, values.concat([1]));
  var recent = values.slice(0, 8).reverse(); // oldest to newest, max 8 bars
  $spark.innerHTML = recent.map(function(v, i) {
    var h = Math.max(2, Math.round((v / max) * 16));
    var isLast = i === recent.length - 1;
    var color = v >= 80 ? 'var(--cc-green)' : v >= 60 ? 'var(--cc-amber)' : 'var(--cc-red)';
    return '<div style="width:3px;height:' + h + 'px;background:' + color + ';border-radius:1px;opacity:' + (isLast ? '1' : '0.4') + '"></div>';
  }).join('');
}

// ═══════════════════════════════════════════════════════════════════
// Run History (last 5 runs as compact timeline)
// ═══════════════════════════════════════════════════════════════════

function renderRunHistory(runs) {
  var $el = document.getElementById('mc-runs');
  if (!$el) return;
  state.runHistory = runs || [];
  if (!runs || runs.length === 0) {
    $el.innerHTML = '<div class="mc-empty">No runs yet</div>';
    return;
  }
  $el.innerHTML = runs.slice(0, 5).map(function(run, i) {
    var avgDm = Math.round(Number(run.avg_dm) || 0);
    var total = run.total || 1;
    var passCount = run.grade_pass_count || run.passed_60 || 0;
    var passRate = Math.round(passCount / total * 100);
    var grade = computeEngineGrade(run);
    var displayName = generateRunName(run.run_id, run.mode, run.total, run.created_at);
    // Truncate name for display
    var shortName = displayName.length > 30 ? displayName.slice(0, 28) + '\u2026' : displayName;

    var deltaHtml = '';
    if (run.delta_avg_dm != null && run.delta_avg_dm !== 0) {
      var d = Math.round(run.delta_avg_dm);
      deltaHtml = d > 0
        ? '<span class="mc-run-row__delta mc-run-row__delta--up">\u2191' + d + '</span>'
        : '<span class="mc-run-row__delta mc-run-row__delta--down">\u2193' + Math.abs(d) + '</span>';
    }

    var runIdSafe = escapeHtml((run.run_id || '').replace(/'/g, ''));
    return '<div class="mc-run-row mc-clickable" data-run-id="' + runIdSafe + '" onclick="toggleRunExpand(\'' + runIdSafe + '\', this)" title="' + escapeHtml(displayName) + '">' +
      '<span class="mc-run-row__date" title="' + escapeHtml(displayName) + '">' + escapeHtml(shortName) + '</span>' +
      '<span class="mc-run-row__grade ' + ragClass(avgDm) + '">' + grade + '</span>' +
      '<span class="mc-run-row__dm">DM ' + avgDm + deltaHtml + '</span>' +
      '<span class="mc-run-row__pass">' + passRate + '%</span>' +
    '</div>';
  }).join('');
}

// ═══════════════════════════════════════════════════════════════════
// Run Expansion — Drill into individual test cases
// ═══════════════════════════════════════════════════════════════════

function toggleRunExpand(runId, rowEl) {
  var expandId = 'run-expand-' + runId.replace(/[^a-z0-9]/gi, '-');
  var existing = document.getElementById(expandId);

  if (existing) {
    existing.style.maxHeight = '0';
    existing.style.opacity = '0';
    rowEl.classList.remove('mc-run-row--expanded');
    setTimeout(function() { if (existing.parentNode) existing.parentNode.removeChild(existing); }, 350);
    return;
  }

  // Collapse any other
  var allExpands = document.querySelectorAll('.mc-run-expand');
  allExpands.forEach(function(el) { el.style.maxHeight = '0'; el.style.opacity = '0'; setTimeout(function() { if (el.parentNode) el.parentNode.removeChild(el); }, 350); });
  var allRows = document.querySelectorAll('.mc-run-row--expanded');
  allRows.forEach(function(el) { el.classList.remove('mc-run-row--expanded'); });

  rowEl.classList.add('mc-run-row--expanded');
  var expandDiv = document.createElement('div');
  expandDiv.id = expandId;
  expandDiv.className = 'mc-run-expand';
  expandDiv.innerHTML = '<div class="mc-empty" style="padding:8px;font-size:11px">Loading results\u2026</div>';
  rowEl.after(expandDiv);

  requestAnimationFrame(function() {
    expandDiv.style.maxHeight = '360px';
    expandDiv.style.opacity = '1';
  });

  if (typeof loadRunResults === 'function') {
    loadRunResults(runId).then(function(results) {
      renderRunExpandResults(expandDiv, results);
    }).catch(function() {
      expandDiv.innerHTML = '<div class="mc-empty" style="padding:8px;font-size:11px">Failed to load</div>';
    });
  } else {
    expandDiv.innerHTML = '<div class="mc-empty" style="padding:8px;font-size:11px">Results not available</div>';
  }
}

function renderRunExpandResults(container, results) {
  if (!results || results.length === 0) {
    container.innerHTML = '<div class="mc-empty" style="padding:8px;font-size:11px">No results found</div>';
    return;
  }

  container.innerHTML = results.map(function(r) {
    var dm = r.donde_match || 0;
    var query = r.query || '?';
    var name = r.restaurant_name || '?';
    var fitG = r.score_fit_grade || '';
    var blurbG = r.blurb_quality_grade || '';
    var grades = '';
    if (fitG) grades += 'Fit:' + fitG;
    if (blurbG) grades += (grades ? ' ' : '') + 'Blurb:' + blurbG;
    var gapDot = r.gap_type ? ' \u26A0' : '';

    return '<div class="mc-run-expand__item" onclick="testAndShowDetail(\'' + escapeHtml(query.replace(/'/g, "\\'")) + '\')" title="' + escapeHtml(name) + '">' +
      '<span class="mc-run-expand__query">"' + escapeHtml(query.slice(0, 30)) + '"' + gapDot + '</span>' +
      '<span class="mc-run-expand__grades">' + grades + '</span>' +
      '<span class="mc-run-expand__score ' + ragClass(dm) + '">' + dm + '</span>' +
    '</div>';
  }).join('');
}

// ═══════════════════════════════════════════════════════════════════
// Live Feed (last 5 queries with timestamps)
// ═══════════════════════════════════════════════════════════════════

function renderLiveFeed(queries) {
  var $el = document.getElementById('mc-feed');
  if (!$el) return;

  state.liveFeed = queries || [];

  if (!queries || queries.length === 0) {
    $el.innerHTML = '<div class="mc-empty">No recent queries</div>';
    return;
  }

  $el.innerHTML = queries.slice(0, 5).map(function(q) {
    var dm = q.donde_match || 0;
    var query = q.special_request || '(empty)';
    var timeStr = q.created_at ? timeAgo(q.created_at) : '';
    return '<div class="mc-feed-item mc-clickable" onclick="testAndShowDetail(\'' + escapeHtml(query.replace(/'/g, "\\'")) + '\')" title="Click to view details">' +
      '<span class="mc-feed-item__query" title="' + escapeHtml(query) + '">"' + escapeHtml(query.slice(0, 35)) + '"</span>' +
      (timeStr ? '<span class="mc-feed-item__time">' + timeStr + '</span>' : '') +
      '<span class="mc-feed-item__score ' + ragClass(dm) + '">' + dm + '</span>' +
    '</div>';
  }).join('');
}

// ═══════════════════════════════════════════════════════════════════
// Footer
// ═══════════════════════════════════════════════════════════════════

function renderFooterBar(stats) {
  var $engine = document.getElementById('mc-footer-engine');
  var $cache = document.getElementById('mc-footer-cache');
  var $latency = document.getElementById('mc-footer-latency');

  if ($engine && stats?.version) $engine.textContent = 'Engine ' + stats.version;
  if ($cache && stats?.cacheHitRate != null) $cache.textContent = 'Cache ' + Math.round(stats.cacheHitRate * 100) + '%';
  if ($latency && stats?.avgLatency != null) $latency.textContent = (stats.avgLatency / 1000).toFixed(1) + 's avg';
}

// ═══════════════════════════════════════════════════════════════════
// System Status (simplified)
// ═══════════════════════════════════════════════════════════════════

function updateSystemStatus(text, color) {
  var $dot = document.getElementById('mc-health-dot');
  if ($dot) {
    $dot.className = 'mc-health-dot';
    if (color === 'green') { /* default green */ }
    else if (color === 'amber') $dot.classList.add('mc-health-dot--amber');
    else $dot.classList.add('mc-health-dot--red');
  }
}

// ═══════════════════════════════════════════════════════════════════
// Test Result Streaming (outputs to COO terminal)
// ═══════════════════════════════════════════════════════════════════

function appendResultRow(result) {
  if (typeof cooLog !== 'function') return;
  var dm = result.dm ?? result.donde_match ?? 0;
  var name = (typeof result.restaurant === 'string' ? result.restaurant : result.restaurant?.name) || '?';
  var query = result.query || result._query || '';
  var fitGrade = result.scoreFitGrade || result._fitGrade || '';
  var blurbGrade = result.blurbGrade || result._blurbGrade || '';
  var type = result.pass === true ? 'success' : result.pass === false ? (dm < 50 ? 'error' : 'warn') : (dm >= 70 ? 'success' : dm >= 50 ? 'warn' : 'error');
  // Append Google API cost badge if present in response
  var googleCost = result.googleApiCost;
  var costBadge = googleCost ? ' | $' + googleCost.toFixed(2) + ' Google' : '';
  cooLog(type, '"' + query.slice(0, 35) + '" \u2192 ' + name + ' DM ' + dm + ' | Fit: ' + fitGrade + ' | Blurb: ' + blurbGrade + costBadge);
}

function appendSummaryRow(name, total, passed, avgDm, elapsed, celebrate, testType) {
  if (typeof cooLog !== 'function') return;
  var pct = total > 0 ? Math.round(passed / total * 100) : 0;
  cooLog('info', '\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500');
  cooLog(pct >= 80 ? 'success' : 'warn',
    name + ': ' + passed + '/' + total + ' passed (' + pct + '%), avg DM ' + avgDm + ', ' + elapsed);
  // Show API cost summary — scoring-only mode uses skip_google + skip_claude = $0
  var isLive = state && state.liveAPI;
  var costLabel = isLive ? 'Google: ~$' + (total * 0.04).toFixed(2) + ' | Claude: active' : '$0.00 Google + $0.00 Claude';
  cooLog('info', 'API cost: ' + costLabel);

  // Remove testing animation
  var board = document.querySelector('.mc-dashboard');
  if (board) board.classList.remove('mc-dashboard--testing');
}

function showTestProgress(name, current, total, avgDm) {
  if (typeof cooLog !== 'function') return;
  if (current === 1) {
    cooLog('action', name + ': running... (' + total + ' queries)');
    if (typeof openDrawerForTest === 'function') openDrawerForTest();
    var board = document.querySelector('.mc-dashboard');
    if (board) board.classList.add('mc-dashboard--testing');
  }
}

// ═══════════════════════════════════════════════════════════════════
// Dark Pulse Animation
// ═══════════════════════════════════════════════════════════════════

function triggerDarkPulse() {
  var dp = document.getElementById('dark-pulse');
  if (!dp) return;
  dp.classList.add('mc-dark-pulse--flash');
  setTimeout(function() { dp.classList.remove('mc-dark-pulse--flash'); }, 200);
}

// ═══════════════════════════════════════════════════════════════════
// Terminal Drawer
// ═══════════════════════════════════════════════════════════════════

function toggleDrawer() {
  var drawer = document.getElementById('mc-drawer');
  if (!drawer) return;
  var isOpen = drawer.classList.toggle('mc-drawer--open');
  var toggle = document.getElementById('mc-drawer-toggle');
  if (toggle) toggle.setAttribute('aria-expanded', isOpen);
  if (isOpen) {
    var badge = document.getElementById('mc-drawer-badge');
    if (badge) { badge.style.display = 'none'; badge.textContent = '0'; }
    // Render agent team into the drawer
    renderAgentsInDrawer();
  }
  updateDashboardMargins();
}

function renderAgentsInDrawer() {
  // renderAgentStatus now targets mc-drawer-agents directly
  if (typeof renderAgentStatus === 'function') {
    renderAgentStatus();
  }
}

function toggleTerminalInDrawer() {
  var body = document.getElementById('mc-terminal-body');
  var chevron = document.getElementById('mc-terminal-chevron');
  if (!body) return;
  var isOpen = body.style.display !== 'none';
  body.style.display = isOpen ? 'none' : 'flex';
  if (chevron) chevron.classList.toggle('mc-drawer__terminal-chevron--open', !isOpen);
  if (!isOpen) {
    setTimeout(function() { var $i = document.getElementById('coo-input'); if ($i) $i.focus(); }, 100);
  }
}

function openDrawerForTest() {
  var drawer = document.getElementById('mc-drawer');
  if (drawer && !drawer.classList.contains('mc-drawer--open')) {
    drawer.classList.add('mc-drawer--open');
    var toggle = document.getElementById('mc-drawer-toggle');
    if (toggle) toggle.setAttribute('aria-expanded', 'true');
    updateDashboardMargins();
  }
}

// ═══════════════════════════════════════════════════════════════════
// Detail Panel (right side sheet)
// ═══════════════════════════════════════════════════════════════════

function openDetail(title, html) {
  var panel = document.getElementById('mc-detail');
  var titleEl = document.getElementById('mc-detail-title');
  var body = document.getElementById('mc-detail-body');
  if (!panel || !body) return;

  if (titleEl) titleEl.textContent = title;
  body.innerHTML = html;

  panel.classList.add('mc-detail--open');
  updateDashboardMargins();
}

function closeDetail() {
  var panel = document.getElementById('mc-detail');
  if (panel) panel.classList.remove('mc-detail--open');
  updateDashboardMargins();
}

function toggleDetail() {
  var panel = document.getElementById('mc-detail');
  if (!panel) return;
  if (panel.classList.contains('mc-detail--open')) {
    closeDetail();
  } else {
    // Open with last content or a default summary
    if (!document.getElementById('mc-detail-body').innerHTML.trim()) {
      var run = state.latestRun;
      if (run) {
        openDetail('Dashboard Summary', buildHealthViz(run, state.trendData || []));
      }
    }
    panel.classList.add('mc-detail--open');
    updateDashboardMargins();
  }
}

function showQueryDetail(query, dm, restaurantName, sv9, recommendation, fitGrade, blurbGrade) {
  var factors = sv9 || {};

  function bar(label, val) {
    var pct = Math.round((val / 10) * 100);
    var color = val >= 7 ? 'var(--cc-green)' : val >= 5 ? 'var(--cc-amber)' : 'var(--cc-red)';
    return '<div class="mc-detail__factor"><span class="mc-detail__key" style="width:28px">' + label + '</span>' +
      '<div class="mc-detail__factor-bar"><div class="mc-detail__factor-fill" style="width:' + pct + '%;background:' + color + '"></div></div>' +
      '<span class="mc-detail__val">' + (Math.round(val * 10) / 10) + '</span></div>';
  }

  var html = '<div class="mc-detail__row"><span class="mc-detail__key">Restaurant</span><span class="mc-detail__val">' + escapeHtml(restaurantName || '?') + '</span></div>';
  html += '<div class="mc-detail__row"><span class="mc-detail__key">DondeMatch</span><span class="mc-detail__val ' + ragClass(dm) + '">' + dm + '</span></div>';
  html += '<div class="mc-detail__row"><span class="mc-detail__key">Relevance</span><span class="mc-detail__val">' + (factors.relevance_type || '-') + '</span></div>';
  if (fitGrade) html += '<div class="mc-detail__row"><span class="mc-detail__key">Score Fit</span><span class="mc-detail__val">' + fitGrade + '</span></div>';
  if (blurbGrade) html += '<div class="mc-detail__row"><span class="mc-detail__key">Blurb Quality</span><span class="mc-detail__val">' + blurbGrade + '</span></div>';

  html += '<div class="mc-section__title" style="margin-top:var(--space-lg)">Factors</div>';
  html += '<div class="mc-detail__factors">';
  html += bar('F', factors.food || 0);
  html += bar('V', factors.vibe || 0);
  html += bar('S', factors.service || 0);
  html += bar('R', factors.reputation || 0);
  html += bar('C', factors.convenience || 0);
  html += '</div>';

  if (recommendation) {
    html += '<div class="mc-section__title" style="margin-top:var(--space-lg)">Recommendation</div>';
    html += '<div class="mc-detail__blurb">' + escapeHtml(recommendation) + '</div>';
  }

  openDetail('"' + escapeHtml(query.slice(0, 30)) + '"', html);
}

// ═══════════════════════════════════════════════════════════════════
// Dashboard Margin Management
// ═══════════════════════════════════════════════════════════════════

function updateDashboardMargins() {
  var dashboard = document.querySelector('.mc-dashboard');
  if (!dashboard) return;

  var detailOpen = document.getElementById('mc-detail')?.classList.contains('mc-detail--open');
  var terminalOpen = document.getElementById('mc-drawer')?.classList.contains('mc-drawer--open');

  dashboard.classList.remove('mc-dashboard--detail-open', 'mc-dashboard--terminal-open', 'mc-dashboard--both-panels');

  if (detailOpen && terminalOpen) {
    dashboard.classList.add('mc-dashboard--both-panels');
  } else if (detailOpen) {
    dashboard.classList.add('mc-dashboard--detail-open');
  } else if (terminalOpen) {
    dashboard.classList.add('mc-dashboard--terminal-open');
  }
}

// ═══════════════════════════════════════════════════════════════════
// Quick Test — Premium Result Card
// ═══════════════════════════════════════════════════════════════════

async function runQuickTest() {
  var $input = document.getElementById('quick-test-input');
  var $card = document.getElementById('quick-test-card');
  if (!$input || !$card) return;
  var query = $input.value.trim();
  if (!query) return;

  // Show loading state as a card
  $card.innerHTML = '<div class="mc-result-card mc-result-card--loading">' +
    '<div class="mc-result-card__score">...</div>' +
    '<div class="mc-result-card__info"><div class="mc-result-card__name">Testing...</div><div class="mc-result-card__type">Sending query to engine</div></div>' +
    '</div>';

  try {
    var resp = await callAPI(query);
    if (!resp.success) {
      $card.innerHTML = '<div class="mc-result-card" style="border-color:rgba(239,68,68,0.3)">' +
        '<div class="mc-result-card__score rag-red">!</div>' +
        '<div class="mc-result-card__info"><div class="mc-result-card__name">Error</div><div class="mc-result-card__type">' + escapeHtml(resp.recommendation || 'Unknown error') + '</div></div>' +
        '</div>';
      return;
    }
    var dm = resp.donde_match || 0;
    var name = resp.restaurant?.name || '?';
    var sv9 = resp.scoring_v9 || {};
    var fit = typeof computeScoreFitGrade === 'function' ? computeScoreFitGrade(query, resp) : null;
    var blurb = typeof computeBlurbQualityGrade === 'function' ? computeBlurbQualityGrade(query, resp) : null;
    var relType = sv9.relevance_type || 'unknown';
    var cuisine = resp.restaurant?.cuisine_type || '';

    var typeText = relType;
    if (cuisine) typeText = relType + ' \u00B7 ' + cuisine;

    var gradesText = '';
    if (fit) gradesText += 'Fit: ' + fit.grade;
    if (blurb) gradesText += (gradesText ? ' \u00B7 ' : '') + 'Blurb: ' + blurb.grade;

    $card.innerHTML = '<div class="mc-result-card" onclick="showQueryDetail(\'' + escapeHtml(query.replace(/'/g, "\\'")) + '\', ' + dm + ', \'' + escapeHtml(name.replace(/'/g, "\\'")) + '\', ' + JSON.stringify(sv9).replace(/'/g, "\\'") + ', \'' + escapeHtml((resp.recommendation || '').replace(/'/g, "\\'")) + '\', \'' + (fit?.grade || '') + '\', \'' + (blurb?.grade || '') + '\')">' +
      '<div class="mc-result-card__score ' + ragClass(dm) + '">' + dm + '</div>' +
      '<div class="mc-result-card__info">' +
        '<div class="mc-result-card__name">' + escapeHtml(name) + '</div>' +
        '<div class="mc-result-card__type">' + escapeHtml(typeText) + '</div>' +
        (gradesText ? '<div class="mc-result-card__grades">' + gradesText + '</div>' : '') +
      '</div>' +
      '<button class="mc-result-card__detail" onclick="event.stopPropagation()">Details \u2192</button>' +
    '</div>';

    // Also open detail panel
    showQueryDetail(query, dm, name, sv9, resp.recommendation, fit?.grade, blurb?.grade);
  } catch (e) {
    $card.innerHTML = '<div class="mc-result-card" style="border-color:rgba(239,68,68,0.3)">' +
      '<div class="mc-result-card__score rag-red">!</div>' +
      '<div class="mc-result-card__info"><div class="mc-result-card__name">Error</div><div class="mc-result-card__type">' + escapeHtml(e.message) + '</div></div>' +
      '</div>';
  }
}

async function testAndShowDetail(query) {
  // Populate quick test input for visibility
  var $input = document.getElementById('quick-test-input');
  if ($input) $input.value = query;

  var $card = document.getElementById('quick-test-card');
  if ($card) {
    $card.innerHTML = '<div class="mc-result-card mc-result-card--loading">' +
      '<div class="mc-result-card__score">...</div>' +
      '<div class="mc-result-card__info"><div class="mc-result-card__name">Loading...</div><div class="mc-result-card__type">Fetching details</div></div>' +
      '</div>';
  }

  try {
    var resp = await callAPI(query);
    if (!resp.success) { if ($card) $card.innerHTML = ''; return; }
    var dm = resp.donde_match || 0;
    var name = resp.restaurant?.name || '?';
    var sv9 = resp.scoring_v9 || {};
    var fit = typeof computeScoreFitGrade === 'function' ? computeScoreFitGrade(query, resp) : null;
    var blurb = typeof computeBlurbQualityGrade === 'function' ? computeBlurbQualityGrade(query, resp) : null;

    if ($card) {
      var cuisine = resp.restaurant?.cuisine_type || '';
      var typeText = (sv9.relevance_type || 'unknown');
      if (cuisine) typeText += ' \u00B7 ' + cuisine;
      var gradesText = '';
      if (fit) gradesText += 'Fit: ' + fit.grade;
      if (blurb) gradesText += (gradesText ? ' \u00B7 ' : '') + 'Blurb: ' + blurb.grade;

      $card.innerHTML = '<div class="mc-result-card">' +
        '<div class="mc-result-card__score ' + ragClass(dm) + '">' + dm + '</div>' +
        '<div class="mc-result-card__info">' +
          '<div class="mc-result-card__name">' + escapeHtml(name) + '</div>' +
          '<div class="mc-result-card__type">' + escapeHtml(typeText) + '</div>' +
          (gradesText ? '<div class="mc-result-card__grades">' + gradesText + '</div>' : '') +
        '</div>' +
      '</div>';
    }

    showQueryDetail(query, dm, name, sv9, resp.recommendation, fit?.grade, blurb?.grade);
    var panel = document.getElementById('mc-detail');
    if (panel) { panel.classList.remove('mc-detail--test'); panel.classList.add('mc-detail--live'); }
  } catch (e) {
    if ($card) $card.innerHTML = '';
  }
}

// ═══════════════════════════════════════════════════════════════════
// Stubs for functions called by cc-analytics.js / cc-tests.js
// (removed features — these are safe no-ops)
// ═══════════════════════════════════════════════════════════════════

function switchTab() {}
function positionTabIndicator() {}
function updateGradeKpis() {}
function updateGradeHero(run) { updatePulseFromRun(run); }
function renderMorningBrief() { renderMorningBriefBanner(state.latestRun); }
function updateHeaderAction() {}
function updateTabBadges() {}
function renderImpactSimulator() {}
function evaluateSLAs() {}
function renderTrendChart() {}
function renderActionCenter() {}
function renderTestVsProdStrip() {}
function updateKpiSparklines() {}
function initKpiClickHandlers() {}
function renderWave2Components() {}
function initQuickActionsScroll() {}
function initWave2Keyboard() {}
function startFreshnessTicker() {}
function loadHeatmapData() {}
function computePerfBaseline() {}
function checkForAnomalies() {}
function checkSmartSuggestion() {}
function updateSmartSuggestion() {}
function renderCustomQueryList() {}
function loadCustomQueries() { state.customQueries = []; }
function loadPinnedQueries() { state.pinnedQueries = []; }
function initPulseClicks() {}
function initKeyboardShortcuts() {}
// ═══════════════════════════════════════════════════════════════════
// Pulse Card Expansion + Data Visualization Panel
// ═══════════════════════════════════════════════════════════════════

function togglePulseExpand(metric) {
  var metrics = ['health', 'dm', 'issues', 'grade', 'db', 'cache', 'live-blurb', 'live-fit', 'live-rt', 'live-cache', 'live-dm', 'live-pass'];
  var isExpanded = state.expandedPulse === metric;

  // Helper to get card element by metric name
  function getPulseCard(m) {
    if (m === 'grade') return document.getElementById('mc-grade');
    return document.getElementById('pulse-' + m);
  }

  // Collapse all
  metrics.forEach(function(m) {
    var expand = document.getElementById('pulse-expand-' + m);
    var card = getPulseCard(m);
    if (expand) expand.classList.remove('mc-pulse-expand--open');
    if (card) card.classList.remove('mc-pulse-card--expanded');
  });

  if (isExpanded) {
    state.expandedPulse = null;
    closeDetail();
    if (typeof saveSession === 'function') saveSession();
    return;
  }

  state.expandedPulse = metric;
  var expand = document.getElementById('pulse-expand-' + metric);
  var card = getPulseCard(metric);
  if (expand) expand.classList.add('mc-pulse-expand--open');
  if (card) card.classList.add('mc-pulse-card--expanded');

  renderPulseExpandContent(metric);
  renderPulseVisualization(metric);

  if (typeof saveSession === 'function') saveSession();
}

function renderPulseExpandContent(metric) {
  var expand = document.getElementById('pulse-expand-' + metric);
  if (!expand) return;
  var run = state.latestRun;
  if (!run) { expand.innerHTML = '<div class="mc-empty">No data</div>'; return; }

  var passCount = run.grade_pass_count || run.passed_60 || 0;
  var total = run.total || 1;
  var avgDm = Math.round(Number(run.avg_dm) || 0);
  var avgFit = Math.round(Number(run.avg_score_fit) || 0);
  var avgBlurb = Math.round(Number(run.avg_blurb_quality) || 0);
  var gapCount = run.gap_count || 0;
  var warnCount = Math.max(0, total - passCount - gapCount);

  if (metric === 'health') {
    var gd = run.grade_distribution;
    if (typeof gd === 'string') try { gd = JSON.parse(gd); } catch(e) { gd = {}; }
    gd = gd || {};
    var aCount = (gd['A+'] || 0) + (gd['A'] || 0) + (gd['A-'] || 0);
    var bCount = (gd['B+'] || 0) + (gd['B'] || 0) + (gd['B-'] || 0);
    var cCount = (gd['C+'] || 0) + (gd['C'] || 0) + (gd['C-'] || 0);
    var dfCount = (gd['D'] || 0) + (gd['F'] || 0);

    expand.innerHTML =
      '<div class="mc-expand__row"><span class="mc-expand__key">Pass</span><span class="mc-expand__val rag-green">' + passCount + '</span></div>' +
      '<div class="mc-expand__row"><span class="mc-expand__key">Warn</span><span class="mc-expand__val rag-amber">' + warnCount + '</span></div>' +
      '<div class="mc-expand__row"><span class="mc-expand__key">Fail</span><span class="mc-expand__val rag-red">' + gapCount + '</span></div>' +
      '<div class="mc-expand__row"><span class="mc-expand__key">Grades</span><span class="mc-expand__val">A:' + aCount + ' B:' + bCount + ' C:' + cCount + (dfCount ? ' D/F:' + dfCount : '') + '</span></div>';

  } else if (metric === 'dm') {
    expand.innerHTML =
      '<div class="mc-expand__row"><span class="mc-expand__key">Avg DM</span><span class="mc-expand__val ' + ragClass(avgDm) + '">' + avgDm + '</span></div>' +
      '<div class="mc-expand__row"><span class="mc-expand__key">Avg Score Fit</span><span class="mc-expand__val">' + avgFit + '</span></div>' +
      '<div class="mc-expand__row"><span class="mc-expand__key">Avg Blurb Quality</span><span class="mc-expand__val">' + avgBlurb + '</span></div>' +
      '<div class="mc-expand__row"><span class="mc-expand__key">Total Checks</span><span class="mc-expand__val">' + total + '</span></div>';

  } else if (metric === 'issues') {
    var issues = state.issues || [];
    var p0 = issues.filter(function(i) { return i.severity === 'P0' || (i.donde_match != null && i.donde_match < 40); }).length;
    var p1 = issues.filter(function(i) { return i.severity === 'P1' || (i.donde_match != null && i.donde_match >= 40 && i.donde_match < 60); }).length;
    var p2 = Math.max(0, issues.length - p0 - p1);
    var liveIssues = issues.filter(function(i) { return !i.run_id || (!i.run_id.startsWith('cc-') && !i.run_id.startsWith('cli-')); }).length;
    var testIssues = issues.length - liveIssues;

    expand.innerHTML =
      '<div style="display:flex;gap:6px;margin-bottom:8px">' +
        (p0 ? '<span class="mc-expand__badge mc-expand__badge--p0">P0: ' + p0 + '</span>' : '') +
        (p1 ? '<span class="mc-expand__badge mc-expand__badge--p1">P1: ' + p1 + '</span>' : '') +
        (p2 ? '<span class="mc-expand__badge mc-expand__badge--p2">P2: ' + p2 + '</span>' : '') +
        (!issues.length ? '<span style="font-size:var(--text-xs);color:var(--cc-green)">No open issues</span>' : '') +
      '</div>' +
      '<div class="mc-expand__row"><span class="mc-expand__key">Total Issues</span><span class="mc-expand__val">' + issues.length + '</span></div>' +
      '<div class="mc-expand__row"><span class="mc-expand__key"><span class="mc-section__dot mc-section__dot--live"></span>Live</span><span class="mc-expand__val">' + liveIssues + '</span></div>' +
      '<div class="mc-expand__row"><span class="mc-expand__key"><span class="mc-section__dot mc-section__dot--test"></span>Test</span><span class="mc-expand__val">' + testIssues + '</span></div>';

  } else if (metric === 'grade') {
    var grade = typeof computeEngineGrade === 'function' ? computeEngineGrade(run) : '-';
    expand.innerHTML =
      '<div class="mc-expand__row"><span class="mc-expand__key">Engine Grade</span><span class="mc-expand__val" style="font-weight:700;font-size:16px">' + grade + '</span></div>' +
      '<div class="mc-expand__row"><span class="mc-expand__key">Avg DM</span><span class="mc-expand__val ' + ragClass(avgDm) + '">' + avgDm + '</span></div>' +
      '<div class="mc-expand__row"><span class="mc-expand__key">Avg Score Fit</span><span class="mc-expand__val">' + avgFit + '</span></div>' +
      '<div class="mc-expand__row"><span class="mc-expand__key">Avg Blurb Quality</span><span class="mc-expand__val">' + avgBlurb + '</span></div>';

  } else if (metric === 'db') {
    var db = state._dbStats || {};
    var totalR = db.total || 2720;
    var enriched = db.enriched || 0;
    var enrichPct = totalR > 0 ? Math.round(enriched / totalR * 100) : 0;
    var riCount = db.tags || 0;
    expand.innerHTML =
      '<div class="mc-expand__row"><span class="mc-expand__key">Active Restaurants</span><span class="mc-expand__val">' + totalR + '</span></div>' +
      '<div class="mc-expand__row"><span class="mc-expand__key">Deep Profiles</span><span class="mc-expand__val ' + (enrichPct >= 95 ? 'rag-green' : 'rag-amber') + '">' + enriched + ' (' + enrichPct + '%)</span></div>' +
      '<div class="mc-expand__row"><span class="mc-expand__key">Review Intel</span><span class="mc-expand__val">' + riCount + '</span></div>' +
      '<div class="mc-expand__row"><span class="mc-expand__key">Occasions</span><span class="mc-expand__val">' + (db.occasions || 0) + '</span></div>';

  } else if (metric === 'cache') {
    var cs = state._cacheStats || {};
    var rawHit = Number(cs.hit_rate_24h) || 0;
    var hitRate = rawHit > 1 ? Math.round(rawHit) : Math.round(rawHit * 100);
    var cacheSize = cs.cache_size || 0;
    var savings = (cs.savings_24h_dollars || 0).toFixed(2);
    var avgTtl = cs.avg_ttl_hours ? Math.round(cs.avg_ttl_hours) + 'h' : '--';
    expand.innerHTML =
      '<div class="mc-expand__row"><span class="mc-expand__key">24h Hit Rate</span><span class="mc-expand__val ' + (hitRate >= 50 ? 'rag-green' : hitRate >= 20 ? 'rag-amber' : 'rag-red') + '">' + hitRate + '%</span></div>' +
      '<div class="mc-expand__row"><span class="mc-expand__key">Cached Queries</span><span class="mc-expand__val">' + cacheSize + '</span></div>' +
      '<div class="mc-expand__row"><span class="mc-expand__key">24h Savings</span><span class="mc-expand__val rag-green">$' + savings + '</span></div>' +
      '<div class="mc-expand__row"><span class="mc-expand__key">Avg TTL Left</span><span class="mc-expand__val">' + avgTtl + '</span></div>';

  } else if (metric === 'live-blurb' || metric === 'live-fit') {
    var kpis = state.liveKPIs || {};
    var label = metric === 'live-blurb' ? 'Blurb Quality' : 'Score Fit';
    var val = metric === 'live-blurb' ? (kpis.blurbQuality || 0) : (kpis.scoreFit || 0);
    expand.innerHTML =
      '<div class="mc-expand__row"><span class="mc-expand__key">' + label + '</span><span class="mc-expand__val ' + ragClass(val) + '">' + val + '</span></div>' +
      '<div class="mc-expand__row"><span class="mc-expand__key">24h Queries</span><span class="mc-expand__val">' + (kpis.queryCount || 0) + '</span></div>' +
      '<div class="mc-expand__row"><span class="mc-expand__key">Threshold</span><span class="mc-expand__val">B- (80)</span></div>' +
      '<div class="mc-expand__row"><span class="mc-expand__key">Status</span><span class="mc-expand__val ' + (val >= 80 ? 'rag-green' : 'rag-amber') + '">' + (val >= 80 ? 'Passing' : 'Below target') + '</span></div>';

  } else if (metric === 'live-rt') {
    var kpis = state.liveKPIs || {};
    var rt = kpis.responseTime || 0;
    expand.innerHTML =
      '<div class="mc-expand__row"><span class="mc-expand__key">p50 Response</span><span class="mc-expand__val">' + (rt / 1000).toFixed(1) + 's</span></div>' +
      '<div class="mc-expand__row"><span class="mc-expand__key">Target</span><span class="mc-expand__val">&lt; 3s</span></div>' +
      '<div class="mc-expand__row"><span class="mc-expand__key">Cache Hits</span><span class="mc-expand__val">' + (kpis.cacheHitRate || 0) + '%</span></div>';

  } else if (metric === 'live-cache') {
    var kpis = state.liveKPIs || {};
    expand.innerHTML =
      '<div class="mc-expand__row"><span class="mc-expand__key">Hit Rate</span><span class="mc-expand__val ' + (kpis.cacheHitRate >= 50 ? 'rag-green' : 'rag-amber') + '">' + (kpis.cacheHitRate || 0) + '%</span></div>' +
      '<div class="mc-expand__row"><span class="mc-expand__key">24h Queries</span><span class="mc-expand__val">' + (kpis.queryCount || 0) + '</span></div>' +
      '<div class="mc-expand__row"><span class="mc-expand__key">Impact</span><span class="mc-expand__val">Faster + cheaper</span></div>';

  } else if (metric === 'live-dm' || metric === 'live-pass') {
    var kpis = state.liveKPIs || {};
    expand.innerHTML =
      '<div class="mc-expand__row"><span class="mc-expand__key">Avg DM</span><span class="mc-expand__val ' + ragClass(kpis.avgDm || 0) + '">' + (kpis.avgDm || 0) + '</span></div>' +
      '<div class="mc-expand__row"><span class="mc-expand__key">Pass Rate (DM\u226570)</span><span class="mc-expand__val ' + (kpis.passRate >= 85 ? 'rag-green' : 'rag-amber') + '">' + (kpis.passRate || 0) + '%</span></div>' +
      '<div class="mc-expand__row"><span class="mc-expand__key">Queries Today</span><span class="mc-expand__val">' + (kpis.queryCount || 0) + '</span></div>';
  }
}

// ═══════════════════════════════════════════════════════════════════
// Data Visualization Panel (right side)
// ═══════════════════════════════════════════════════════════════════

function renderPulseVisualization(metric) {
  var run = state.latestRun;
  var trend = state.trendData || [];
  var panel = document.getElementById('mc-detail');

  // Add test class for indigo header
  if (panel) { panel.classList.remove('mc-detail--live', 'mc-detail--test'); panel.classList.add('mc-detail--test'); }

  if (metric === 'health') {
    openDetail('Health Analysis', buildHealthViz(run, trend));
  } else if (metric === 'dm') {
    openDetail('Score Analysis', buildDmViz(run, trend));
  } else if (metric === 'issues') {
    openDetail('Issue Analysis', buildIssuesViz(run, trend));
  } else if (metric === 'grade') {
    openDetail('Grade Analysis', buildGradeViz(run, trend));
  } else if (metric === 'db') {
    openDetail('Database Health', buildDbViz());
  } else if (metric === 'cache') {
    openDetail('Cache Performance', buildCacheViz());
  }
}

function renderSvgTrendLine(values, width, height, suffix, label) {
  if (!values || values.length < 2) return '<div class="mc-empty" style="font-size:11px">Not enough data for trend</div>';
  var pad = 10;
  var w = width - pad * 2;
  var h = height - pad * 2 - 8;
  var max = Math.max.apply(null, values);
  var min = Math.min.apply(null, values);
  var range = (max - min) || 1;

  var points = values.map(function(v, i) {
    var x = pad + (i / (values.length - 1)) * w;
    var y = pad + h - ((v - min) / range) * h;
    return x.toFixed(1) + ',' + y.toFixed(1);
  });

  var lastVal = values[values.length - 1];
  var color = lastVal >= 80 ? 'var(--cc-green)' : lastVal >= 60 ? 'var(--cc-amber)' : 'var(--cc-red)';
  var lastPt = points[points.length - 1].split(',');
  var firstX = pad;
  var lastX = (pad + w).toFixed(1);
  var bottomY = (pad + h).toFixed(1);
  var fillPoints = firstX + ',' + bottomY + ' ' + points.join(' ') + ' ' + lastX + ',' + bottomY;
  var gradId = 'trendFill' + Math.random().toString(36).slice(2, 6);

  return '<svg width="' + width + '" height="' + height + '" viewBox="0 0 ' + width + ' ' + height + '" style="display:block;margin:4px auto">' +
    '<defs><linearGradient id="' + gradId + '" x1="0" y1="0" x2="0" y2="1">' +
    '<stop offset="0%" stop-color="' + color + '" stop-opacity="0.2"/>' +
    '<stop offset="100%" stop-color="' + color + '" stop-opacity="0.02"/>' +
    '</linearGradient></defs>' +
    '<polygon points="' + fillPoints + '" fill="url(#' + gradId + ')"/>' +
    '<polyline points="' + points.join(' ') + '" fill="none" stroke="' + color + '" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>' +
    '<circle cx="' + lastPt[0] + '" cy="' + lastPt[1] + '" r="3.5" fill="' + color + '"/>' +
    '<text x="' + (width - pad) + '" y="' + (pad + 2) + '" fill="' + color + '" font-size="10" font-family="var(--font-mono)" font-weight="600" text-anchor="end">' + lastVal + (suffix || '') + '</text>' +
    (label ? '<text x="' + pad + '" y="' + (height - 2) + '" fill="var(--cc-text3)" font-size="9" font-family="var(--font-sans)">' + label + '</text>' : '') +
  '</svg>';
}

function renderGradeDonut(gradeDist, total) {
  var gd = typeof gradeDist === 'string' ? JSON.parse(gradeDist) : (gradeDist || {});
  var groups = [
    { label: 'A', grades: ['A+', 'A', 'A-'], color: 'var(--cc-green)' },
    { label: 'B', grades: ['B+', 'B', 'B-'], color: 'var(--cc-accent)' },
    { label: 'C', grades: ['C+', 'C', 'C-'], color: 'var(--cc-amber)' },
    { label: 'D/F', grades: ['D', 'F'], color: 'var(--cc-red)' }
  ];

  var segments = [];
  var cum = 0;
  groups.forEach(function(g) {
    var count = g.grades.reduce(function(s, gr) { return s + (gd[gr] || 0); }, 0);
    var pct = total > 0 ? (count / total * 100) : 0;
    if (pct > 0) {
      segments.push({ label: g.label, color: g.color, count: count, pct: pct, start: cum });
      cum += pct;
    }
  });

  var stops = segments.map(function(s) { return s.color + ' ' + s.start.toFixed(1) + '% ' + (s.start + s.pct).toFixed(1) + '%'; }).join(', ');
  var topGrade = segments.length > 0 ? segments[0].label : '-';

  return '<div class="mc-viz__donut-wrap">' +
    '<div class="mc-viz__donut" style="background:conic-gradient(' + (stops || 'var(--cc-border) 0% 100%') + ')">' +
    '<div class="mc-viz__donut-hole">' + topGrade + '</div></div>' +
    '<div class="mc-viz__donut-legend">' +
    segments.map(function(s) {
      return '<span><span class="mc-viz__legend-dot" style="background:' + s.color + '"></span>' + s.label + ': ' + s.count + ' (' + Math.round(s.pct) + '%)</span>';
    }).join('') +
    '</div></div>';
}

function buildHealthViz(run, trend) {
  if (!run) return '<div class="mc-empty">No data</div>';
  var html = '';
  var passCount = run.grade_pass_count || run.passed_60 || 0;
  var total = run.total || 1;
  var passRate = Math.round(passCount / total * 100);
  var avgFit = Math.round(Number(run.avg_score_fit) || 0);
  var avgBlurb = Math.round(Number(run.avg_blurb_quality) || 0);

  // Metric tiles — clickable for deeper dives
  html += '<div class="mc-viz__metrics">';
  html += '<div class="mc-viz__metric mc-clickable" onclick="togglePulseExpand(\'health\')" title="Click for pass rate details"><div class="mc-viz__metric-val ' + ragClass(passRate) + '">' + passRate + '%</div><div class="mc-viz__metric-label">Pass Rate</div></div>';
  html += '<div class="mc-viz__metric mc-clickable" onclick="togglePulseExpand(\'dm\')" title="Click for score fit details"><div class="mc-viz__metric-val">' + avgFit + '</div><div class="mc-viz__metric-label">Avg Score Fit</div></div>';
  html += '<div class="mc-viz__metric mc-clickable" onclick="togglePulseExpand(\'dm\')" title="Click for blurb quality details"><div class="mc-viz__metric-val">' + avgBlurb + '</div><div class="mc-viz__metric-label">Avg Blurb Quality</div></div>';
  html += '<div class="mc-viz__metric mc-clickable" onclick="togglePulseExpand(\'grade\')" title="Click for grade breakdown"><div class="mc-viz__metric-val">' + total + '</div><div class="mc-viz__metric-label">Total Checks</div></div>';
  html += '</div>';

  // Trend line
  if (trend.length >= 3) {
    html += '<div class="mc-viz__title">Pass Rate Trend</div>';
    var rates = trend.slice(0, 20).reverse().map(function(r) {
      var t = r.total || 1;
      var p = r.grade_pass_count || r.passed_60 || 0;
      return Math.round(p / t * 100);
    });
    html += renderSvgTrendLine(rates, 340, 80, '%', 'Last ' + rates.length + ' runs');
  }

  // Grade donut
  if (run.grade_distribution) {
    html += '<div class="mc-viz__title">Grade Distribution</div>';
    html += renderGradeDonut(run.grade_distribution, total);
  }

  // Insights with CTA buttons
  html += '<div class="mc-viz__title">Insights & Actions</div>';
  if (passRate === 100) {
    html += '<div class="mc-viz__insight mc-viz__insight--success"><span class="mc-viz__insight-icon">\u2713</span> Perfect score. All ' + total + ' checks passed.<br><button class="mc-viz__cta mc-viz__cta--success" onclick="processCOOInput(\'regression\')">Run Regression Guard</button></div>';
  } else if (passRate >= 85) {
    html += '<div class="mc-viz__insight mc-viz__insight--success"><span class="mc-viz__insight-icon">\u2713</span> Engine healthy at ' + passRate + '%. ' + (total - passCount) + ' gaps remain.<br><button class="mc-viz__cta mc-viz__cta--primary" onclick="processCOOInput(\'fix bugs\')">Fix Gaps</button> <button class="mc-viz__cta mc-viz__cta--success" onclick="processCOOInput(\'scan\')">Rescan</button></div>';
  } else {
    html += '<div class="mc-viz__insight mc-viz__insight--warn"><span class="mc-viz__insight-icon">\u26A0</span> Pass rate at ' + passRate + '%. ' + (run.gap_count || 0) + ' issues need fixes.<br><button class="mc-viz__cta mc-viz__cta--warn" onclick="processCOOInput(\'fix bugs\')">Fix ' + (run.gap_count || 0) + ' Issues</button> <button class="mc-viz__cta mc-viz__cta--primary" onclick="processCOOInput(\'scan\')">Run Fresh Scan</button></div>';
  }
  if (avgBlurb < avgFit) {
    html += '<div class="mc-viz__insight mc-viz__insight--action"><span class="mc-viz__insight-icon">\u25B6</span> Blurb quality (' + avgBlurb + ') trails score fit (' + avgFit + ').<br><button class="mc-viz__cta mc-viz__cta--primary" onclick="processCOOInput(\'blurb\')">Run Blurb Audit</button></div>';
  }

  return html;
}

function buildDmViz(run, trend) {
  if (!run) return '<div class="mc-empty">No data</div>';
  var html = '';
  var avgDm = Math.round(Number(run.avg_dm) || 0);
  var avgFit = Math.round(Number(run.avg_score_fit) || 0);
  var avgBlurb = Math.round(Number(run.avg_blurb_quality) || 0);

  // Metric tiles
  html += '<div class="mc-viz__metrics">';
  html += '<div class="mc-viz__metric"><div class="mc-viz__metric-val ' + ragClass(avgDm) + '">' + avgDm + '</div><div class="mc-viz__metric-label">Avg DondeMatch</div></div>';
  html += '<div class="mc-viz__metric"><div class="mc-viz__metric-val">' + avgFit + '</div><div class="mc-viz__metric-label">Avg Score Fit</div></div>';
  html += '<div class="mc-viz__metric"><div class="mc-viz__metric-val">' + avgBlurb + '</div><div class="mc-viz__metric-label">Avg Blurb Quality</div></div>';
  var grade = typeof computeEngineGrade === 'function' ? computeEngineGrade(run) : '-';
  html += '<div class="mc-viz__metric"><div class="mc-viz__metric-val">' + grade + '</div><div class="mc-viz__metric-label">Engine Grade</div></div>';
  html += '</div>';

  // Trend line
  if (trend.length >= 3) {
    html += '<div class="mc-viz__title">DM Trend</div>';
    var dms = trend.slice(0, 20).reverse().map(function(r) { return Math.round(Number(r.avg_dm) || 0); });
    html += renderSvgTrendLine(dms, 340, 80, '', 'Last ' + dms.length + ' runs');
  }

  // Score tier bar chart
  html += '<div class="mc-viz__title">Score Tiers</div>';
  var tiers = [
    { label: '90+', color: 'var(--cc-green)', desc: 'Outstanding' },
    { label: '80-89', color: 'var(--cc-accent)', desc: 'Strong Pick' },
    { label: '70-79', color: 'var(--cc-amber)', desc: 'Solid Option' },
    { label: '60-69', color: 'var(--cc-text3)', desc: 'Worth a Try' },
    { label: '<60', color: 'var(--cc-red)', desc: 'Below Threshold' }
  ];
  // Estimate tier distribution from avgDm (actual per-query data would need loadRunResults)
  var tierPcts = avgDm >= 85 ? [30, 45, 20, 5, 0] : avgDm >= 75 ? [15, 35, 35, 10, 5] : [5, 20, 35, 25, 15];
  tiers.forEach(function(t, i) {
    html += '<div class="mc-viz__hbar">' +
      '<span class="mc-viz__hbar-label">' + t.label + '</span>' +
      '<div class="mc-viz__hbar-track"><div class="mc-viz__hbar-fill" style="width:' + tierPcts[i] + '%;background:' + t.color + '"></div></div>' +
      '<span class="mc-viz__hbar-val">' + tierPcts[i] + '%</span></div>';
  });

  // Insights with CTA buttons
  html += '<div class="mc-viz__title">Insights & Actions</div>';
  if (avgDm >= 80) {
    html += '<div class="mc-viz__insight mc-viz__insight--success"><span class="mc-viz__insight-icon">\u2713</span> Strong performance at DM ' + avgDm + '.<br><button class="mc-viz__cta mc-viz__cta--success" onclick="processCOOInput(\'regression\')">Verify with Regression</button></div>';
  } else if (avgDm >= 70) {
    html += '<div class="mc-viz__insight mc-viz__insight--action"><span class="mc-viz__insight-icon">\u25B6</span> DM ' + avgDm + ' \u2014 target 80+ via niche cuisine/dish relevance.<br><button class="mc-viz__cta mc-viz__cta--primary" onclick="processCOOInput(\'category food\')">Test Food Queries</button> <button class="mc-viz__cta mc-viz__cta--primary" onclick="processCOOInput(\'fix bugs\')">Fix Scoring</button></div>';
  } else {
    html += '<div class="mc-viz__insight mc-viz__insight--warn"><span class="mc-viz__insight-icon">\u26A0</span> DM ' + avgDm + ' below target.<br><button class="mc-viz__cta mc-viz__cta--warn" onclick="processCOOInput(\'fix bugs\')">Fix Scoring Gaps</button> <button class="mc-viz__cta mc-viz__cta--primary" onclick="processCOOInput(\'scan\')">Run Diagnostic</button></div>';
  }

  if (trend.length >= 2) {
    var prevDm = Math.round(Number(trend[1].avg_dm) || 0);
    var delta = avgDm - prevDm;
    if (delta > 0) html += '<div class="mc-viz__insight mc-viz__insight--success"><span class="mc-viz__insight-icon">\u2191</span> Up ' + delta + ' points from previous run.</div>';
    else if (delta < 0) html += '<div class="mc-viz__insight mc-viz__insight--warn"><span class="mc-viz__insight-icon">\u2193</span> Down ' + Math.abs(delta) + ' points.<br><button class="mc-viz__cta mc-viz__cta--warn" onclick="processCOOInput(\'regression\')">Run Regression Guard</button></div>';
  }

  return html;
}

function buildIssuesViz(run, trend) {
  var html = '';
  var issues = state.issues || [];

  // Live vs Test split
  var liveIssues = issues.filter(function(i) { return !i.run_id || (!i.run_id.startsWith('cc-') && !i.run_id.startsWith('cli-')); });
  var testIssues = issues.filter(function(i) { return i.run_id && (i.run_id.startsWith('cc-') || i.run_id.startsWith('cli-')); });

  // Metric tiles
  html += '<div class="mc-viz__metrics">';
  html += '<div class="mc-viz__metric"><div class="mc-viz__metric-val ' + (issues.length === 0 ? 'rag-green' : issues.length <= 3 ? 'rag-amber' : 'rag-red') + '">' + issues.length + '</div><div class="mc-viz__metric-label">Total Issues</div></div>';
  html += '<div class="mc-viz__metric"><div class="mc-viz__metric-val" style="color:var(--cc-live)">' + liveIssues.length + '</div><div class="mc-viz__metric-label"><span class="mc-section__dot mc-section__dot--live"></span>Live Issues</div></div>';
  html += '<div class="mc-viz__metric"><div class="mc-viz__metric-val" style="color:var(--cc-test)">' + testIssues.length + '</div><div class="mc-viz__metric-label"><span class="mc-section__dot mc-section__dot--test"></span>Test Issues</div></div>';
  var gapCount = run ? (run.gap_count || 0) : 0;
  html += '<div class="mc-viz__metric"><div class="mc-viz__metric-val">' + gapCount + '</div><div class="mc-viz__metric-label">Latest Run Gaps</div></div>';
  html += '</div>';

  // Issue type breakdown
  if (issues.length > 0) {
    html += '<div class="mc-viz__title">By Type</div>';
    var types = {};
    issues.forEach(function(i) { var t = i.gap_type || 'unknown'; types[t] = (types[t] || 0) + 1; });
    var maxCount = Math.max.apply(null, Object.values(types).concat([1]));
    Object.keys(types).sort(function(a, b) { return types[b] - types[a]; }).forEach(function(t) {
      var pct = Math.round(types[t] / maxCount * 100);
      html += '<div class="mc-viz__hbar">' +
        '<span class="mc-viz__hbar-label">' + t.replace(/_/g, ' ') + '</span>' +
        '<div class="mc-viz__hbar-track"><div class="mc-viz__hbar-fill" style="width:' + pct + '%;background:var(--cc-amber)"></div></div>' +
        '<span class="mc-viz__hbar-val">' + types[t] + '</span></div>';
    });
  }

  // Issue trend
  if (trend && trend.length >= 3) {
    html += '<div class="mc-viz__title">Issue Trend</div>';
    var gapTrend = trend.slice(0, 15).reverse().map(function(r) { return r.gap_count || 0; });
    html += renderSvgTrendLine(gapTrend, 340, 60, '', 'Gap count over time');
  }

  // Insights with CTA buttons
  html += '<div class="mc-viz__title">Actions</div>';
  if (issues.length === 0) {
    html += '<div class="mc-viz__insight mc-viz__insight--success"><span class="mc-viz__insight-icon">\u2713</span> Zero issues. Engine is clean.<br><button class="mc-viz__cta mc-viz__cta--success" onclick="processCOOInput(\'scan\')">Run Broad Scan</button> <button class="mc-viz__cta mc-viz__cta--success" onclick="processCOOInput(\'edge\')">Stress Test</button></div>';
  } else {
    if (liveIssues.length > 0) {
      html += '<div class="mc-viz__insight mc-viz__insight--warn"><span class="mc-viz__insight-icon">\u26A0</span> ' + liveIssues.length + ' live issue' + (liveIssues.length > 1 ? 's' : '') + ' affecting real users.<br><button class="mc-viz__cta mc-viz__cta--warn" onclick="processCOOInput(\'fix bugs\')">Fix Live Issues</button></div>';
    }
    if (testIssues.length > 0) {
      html += '<div class="mc-viz__insight mc-viz__insight--action"><span class="mc-viz__insight-icon">\u25B6</span> ' + testIssues.length + ' test issue' + (testIssues.length > 1 ? 's' : '') + ' from scans.<br><button class="mc-viz__cta mc-viz__cta--primary" onclick="processCOOInput(\'fix bugs\')">Fix Test Issues</button> <button class="mc-viz__cta mc-viz__cta--primary" onclick="processCOOInput(\'scan\')">Rescan</button></div>';
    }
  }

  return html;
}

function buildGradeViz(run, trend) {
  if (!run) return '<div class="mc-empty">No data</div>';
  var html = '';
  var avgDm = Math.round(Number(run.avg_dm) || 0);
  var avgFit = Math.round(Number(run.avg_score_fit) || 0);
  var avgBlurb = Math.round(Number(run.avg_blurb_quality) || 0);
  var total = run.total || 1;
  var grade = typeof computeEngineGrade === 'function' ? computeEngineGrade(run) : '-';

  // Grade donut
  if (run.grade_distribution) {
    html += '<div class="mc-viz__title">Grade Distribution</div>';
    html += renderGradeDonut(run.grade_distribution, total);
  }

  // Factor breakdown bars
  html += '<div class="mc-viz__title">Factor Breakdown</div>';
  var factors = [
    { label: 'DondeMatch', val: avgDm, weight: '40%' },
    { label: 'Score Fit', val: avgFit, weight: '30%' },
    { label: 'Blurb Quality', val: avgBlurb, weight: '30%' }
  ];
  factors.forEach(function(f) {
    var color = f.val >= 80 ? 'var(--cc-green)' : f.val >= 60 ? 'var(--cc-amber)' : 'var(--cc-red)';
    html += '<div class="mc-viz__hbar">' +
      '<span class="mc-viz__hbar-label">' + f.label + ' (' + f.weight + ')</span>' +
      '<div class="mc-viz__hbar-track"><div class="mc-viz__hbar-fill" style="width:' + f.val + '%;background:' + color + '"></div></div>' +
      '<span class="mc-viz__hbar-val">' + f.val + '</span></div>';
  });

  // Grade trend
  if (trend && trend.length >= 3) {
    html += '<div class="mc-viz__title">Composite Score Trend</div>';
    var scores = trend.slice(0, 20).reverse().map(function(r) {
      var dm = Number(r.avg_dm) || 0;
      var fit = Number(r.avg_score_fit) || 0;
      var blurb = Number(r.avg_blurb_quality) || 0;
      return Math.round(dm * 0.4 + fit * 0.3 + blurb * 0.3);
    });
    html += renderSvgTrendLine(scores, 340, 80, '', 'Weighted composite');
  }

  // Metric tiles
  html += '<div class="mc-viz__metrics">';
  html += '<div class="mc-viz__metric"><div class="mc-viz__metric-val" style="font-size:24px;font-weight:700">' + grade + '</div><div class="mc-viz__metric-label">Engine Grade</div></div>';
  html += '<div class="mc-viz__metric"><div class="mc-viz__metric-val ' + ragClass(avgDm) + '">' + avgDm + '</div><div class="mc-viz__metric-label">Avg DM</div></div>';
  html += '<div class="mc-viz__metric"><div class="mc-viz__metric-val">' + avgFit + '</div><div class="mc-viz__metric-label">Avg Fit</div></div>';
  html += '<div class="mc-viz__metric"><div class="mc-viz__metric-val">' + avgBlurb + '</div><div class="mc-viz__metric-label">Avg Blurb</div></div>';
  html += '</div>';

  // Insights
  html += '<div class="mc-viz__title">Insights</div>';
  var composite = Math.round(avgDm * 0.4 + avgFit * 0.3 + avgBlurb * 0.3);
  if (grade.startsWith('A')) {
    html += '<div class="mc-viz__insight mc-viz__insight--success"><span class="mc-viz__insight-icon">\u2713</span> Engine grade ' + grade + ' (composite ' + composite + '). Outstanding quality across all factors.</div>';
  } else if (grade.startsWith('B')) {
    html += '<div class="mc-viz__insight mc-viz__insight--action"><span class="mc-viz__insight-icon">\u25B6</span> Engine grade ' + grade + ' (composite ' + composite + '). ';
    if (avgBlurb < avgFit) html += 'Blurb quality is the weakest factor \u2014 focus on voice compliance.';
    else if (avgFit < avgDm) html += 'Score fit trailing DM \u2014 review relevance calibration.';
    else html += 'Push for A grade by improving the weakest factor.';
    html += '</div>';
  } else {
    html += '<div class="mc-viz__insight mc-viz__insight--warn"><span class="mc-viz__insight-icon">\u26A0</span> Engine grade ' + grade + ' (composite ' + composite + '). Significant improvement needed. Run bug-fixer to address gaps.</div>';
  }

  return html;
}

function buildDbViz() {
  var html = '';
  var db = state._dbStats || {};
  var totalR = db.total || 2720;
  var enriched = db.enriched || 0;
  var enrichPct = totalR > 0 ? Math.round(enriched / totalR * 100) : 0;
  var riCount = db.tags || 0;
  var riPct = totalR > 0 ? Math.min(100, Math.round(riCount / totalR * 100)) : 0;

  // Metric tiles — each clickable for drill-down
  html += '<div class="mc-viz__metrics">';
  html += '<div class="mc-viz__metric mc-clickable" onclick="processCOOInput(\'db health\')" title="Run DB health check"><div class="mc-viz__metric-val">' + totalR + '</div><div class="mc-viz__metric-label">Active Restaurants</div></div>';
  html += '<div class="mc-viz__metric mc-clickable" onclick="processCOOInput(\'db health\')" title="Deep profile coverage"><div class="mc-viz__metric-val ' + (enrichPct >= 95 ? 'rag-green' : 'rag-amber') + '">' + enrichPct + '%</div><div class="mc-viz__metric-label">Deep Profiles</div></div>';
  html += '<div class="mc-viz__metric mc-clickable" title="Review intelligence coverage"><div class="mc-viz__metric-val ' + (riPct >= 95 ? 'rag-green' : 'rag-amber') + '">' + riPct + '%</div><div class="mc-viz__metric-label">Review Intel</div></div>';
  html += '<div class="mc-viz__metric mc-clickable" title="Occasion scores"><div class="mc-viz__metric-val">' + (db.occasions || 0) + '</div><div class="mc-viz__metric-label">Occasion Scores</div></div>';
  html += '</div>';

  // Coverage bars
  html += '<div class="mc-viz__title">Coverage Breakdown</div>';
  var items = [
    { label: 'Deep Profiles', val: enrichPct },
    { label: 'Review Intel', val: riPct },
    { label: 'Cuisine Type', val: 99 },
    { label: 'Neighborhoods', val: 100 },
    { label: 'Google Ratings', val: 100 }
  ];
  items.forEach(function(item) {
    var color = item.val >= 95 ? 'var(--cc-green)' : item.val >= 80 ? 'var(--cc-amber)' : 'var(--cc-red)';
    html += '<div class="mc-viz__hbar"><span class="mc-viz__hbar-label">' + item.label + '</span>' +
      '<div class="mc-viz__hbar-track"><div class="mc-viz__hbar-fill" style="width:' + item.val + '%;background:' + color + '"></div></div>' +
      '<span class="mc-viz__hbar-val">' + item.val + '%</span></div>';
  });

  // Actions
  html += '<div class="mc-viz__title">Actions</div>';
  if (enrichPct < 99) {
    html += '<div class="mc-viz__insight mc-viz__insight--warn"><span class="mc-viz__insight-icon">\u26A0</span> ' + (totalR - enriched) + ' restaurants lack deep profiles.<br><button class="mc-viz__cta mc-viz__cta--warn" onclick="processCOOInput(\'db health\')">Run DB Audit</button></div>';
  } else {
    html += '<div class="mc-viz__insight mc-viz__insight--success"><span class="mc-viz__insight-icon">\u2713</span> Database comprehensive at ' + enrichPct + '% coverage.<br><button class="mc-viz__cta mc-viz__cta--success" onclick="processCOOInput(\'db health\')">Verify Health</button></div>';
  }
  return html;
}

function buildCacheViz() {
  var html = '';
  var cs = state._cacheStats || {};
  var rawHitViz = Number(cs.hit_rate_24h) || 0;
  var hitRate = rawHitViz > 1 ? Math.round(rawHitViz) : Math.round(rawHitViz * 100);
  var cacheSize = cs.cache_size || 0;
  var savings = (cs.savings_24h_dollars || 0).toFixed(2);
  var avgTtl = cs.avg_ttl_hours ? Math.round(cs.avg_ttl_hours) : 0;

  // Metric tiles — clickable
  html += '<div class="mc-viz__metrics">';
  html += '<div class="mc-viz__metric mc-clickable" onclick="processCOOInput(\'cache status\')" title="Cache hit rate details"><div class="mc-viz__metric-val ' + (hitRate >= 50 ? 'rag-green' : hitRate >= 20 ? 'rag-amber' : 'rag-red') + '">' + hitRate + '%</div><div class="mc-viz__metric-label">24h Hit Rate</div></div>';
  html += '<div class="mc-viz__metric mc-clickable" title="Total cached queries"><div class="mc-viz__metric-val">' + cacheSize + '</div><div class="mc-viz__metric-label">Cached Queries</div></div>';
  html += '<div class="mc-viz__metric mc-clickable" title="API cost savings"><div class="mc-viz__metric-val rag-green">$' + savings + '</div><div class="mc-viz__metric-label">24h Savings</div></div>';
  html += '<div class="mc-viz__metric mc-clickable" title="Average time to live"><div class="mc-viz__metric-val">' + (avgTtl ? avgTtl + 'h' : '--') + '</div><div class="mc-viz__metric-label">Avg TTL Left</div></div>';
  html += '</div>';

  // Cache effectiveness
  html += '<div class="mc-viz__title">Cache Effectiveness</div>';
  html += '<div style="font-size:var(--text-xs);color:var(--cc-text2);margin-bottom:var(--space-sm)">Higher hit rate = more searches served from cache = lower cost + faster responses</div>';
  var levels = [
    { label: 'L1 Exact', val: Math.round(hitRate * 0.6), desc: 'Identical query match' },
    { label: 'L2 Intent', val: Math.round(hitRate * 0.25), desc: 'Same intent fingerprint' },
    { label: 'L3 Canonical', val: Math.round(hitRate * 0.15), desc: 'Normalized form match' }
  ];
  levels.forEach(function(l) {
    var color = l.val >= 20 ? 'var(--cc-green)' : l.val >= 5 ? 'var(--cc-amber)' : 'var(--cc-text3)';
    html += '<div class="mc-viz__hbar"><span class="mc-viz__hbar-label">' + l.label + '</span>' +
      '<div class="mc-viz__hbar-track"><div class="mc-viz__hbar-fill" style="width:' + Math.min(l.val * 2, 100) + '%;background:' + color + '"></div></div>' +
      '<span class="mc-viz__hbar-val">' + l.val + '%</span></div>';
  });

  // Coverage assessment
  html += '<div class="mc-viz__title">Coverage Assessment</div>';
  if (hitRate >= 50) {
    html += '<div class="mc-viz__insight mc-viz__insight--success"><span class="mc-viz__insight-icon">\u2713</span> Strong coverage at ' + hitRate + '%. Most user searches served from cache.<br><button class="mc-viz__cta mc-viz__cta--success" onclick="processCOOInput(\'cache status\')">View Details</button></div>';
  } else if (hitRate >= 20) {
    html += '<div class="mc-viz__insight mc-viz__insight--action"><span class="mc-viz__insight-icon">\u25B6</span> Moderate coverage at ' + hitRate + '%. Warm more queries to reduce API costs.<br><button class="mc-viz__cta mc-viz__cta--primary" onclick="processCOOInput(\'warm cache\')">Warm Cache</button> <button class="mc-viz__cta mc-viz__cta--primary" onclick="processCOOInput(\'cache status\')">View Details</button></div>';
  } else {
    html += '<div class="mc-viz__insight mc-viz__insight--warn"><span class="mc-viz__insight-icon">\u26A0</span> Low coverage at ' + hitRate + '%. Most searches hit the API directly ($$$).<br><button class="mc-viz__cta mc-viz__cta--warn" onclick="processCOOInput(\'warm cache\')">Warm Cache Now</button></div>';
  }
  if (cacheSize > 0 && avgTtl > 0 && avgTtl < 12) {
    html += '<div class="mc-viz__insight mc-viz__insight--warn"><span class="mc-viz__insight-icon">\u26A0</span> Avg TTL only ' + avgTtl + 'h. Entries expiring fast \u2014 consider extending TTL or warming more frequently.</div>';
  }

  return html;
}

function selectRun() {}
function updatePulseFromProd() {}
function updateDbOverview(totalCount, enrichedCount, tagCount, occasionCount) {
  state._dbStats = { total: totalCount, enriched: enrichedCount, tags: tagCount, occasions: occasionCount };

  // DB Health card — show restaurant count as primary, enrichment as label
  var $dbVal = document.getElementById('pulse-db-val');
  if ($dbVal) {
    $dbVal.textContent = totalCount.toLocaleString();
    var pct = totalCount > 0 ? Math.round(enrichedCount / totalCount * 100) : 0;
    $dbVal.className = 'mc-pulse-card__value ' + (pct >= 95 ? 'rag-green' : pct >= 80 ? 'rag-amber' : 'rag-red');
    var $dbLabel = document.querySelector('#pulse-db .mc-pulse-card__label');
    if ($dbLabel) $dbLabel.textContent = pct + '% enriched';
  }

  // Cache card — fetch async and populate
  if (typeof sbClient !== 'undefined' && sbClient) {
    sbClient.rpc('get_cache_dashboard').then(function(res) {
      if (res.data) {
        state._cacheStats = res.data;
        // hit_rate_24h can be 0-1 (ratio) or 0-100 (percentage) — normalize
        var raw = Number(res.data.hit_rate_24h) || 0;
        var hitRate = raw > 1 ? Math.round(raw) : Math.round(raw * 100);
        var cacheSize = res.data.cache_size || 0;
        var $cacheVal = document.getElementById('pulse-cache-val');
        if ($cacheVal) {
          $cacheVal.textContent = hitRate + '%';
          $cacheVal.className = 'mc-pulse-card__value ' + (hitRate >= 50 ? 'rag-green' : hitRate >= 20 ? 'rag-amber' : 'rag-red');
        }
        var $cacheLabel = document.querySelector('#pulse-cache .mc-pulse-card__label');
        if ($cacheLabel) $cacheLabel.textContent = cacheSize + ' queries cached';
      }
    }).catch(function() {
      var $cacheVal = document.getElementById('pulse-cache-val');
      if ($cacheVal) { $cacheVal.textContent = '--'; $cacheVal.className = 'mc-pulse-card__value'; }
    });
  }
}
function updatePipelineStatus() {}
function renderPipelineHistory() {}
function updateLiveKPIs() {}
function renderIssues() {}
function updateIssuesBadge() {}
function updateExecutiveSummary() {}
function updateActionBarCount() {}
function syncMobileStatusDot() {}
function updateMobileIssuesBadge() {}
function toggleTerminal() {}
function toggleMobileMenu() {}
function renderMobileRunCards() {}

// ═══════════════════════════════════════════════════════════════════
// Test Confirmation Modal
// ═══════════════════════════════════════════════════════════════════

var _pendingTestType = null;
var _pendingTestArgs = null;

var TEST_DESCRIPTIONS = {
  broad: {
    icon: '&#9654;',
    title: 'Broad Quality Scan',
    desc: 'Runs 20 random queries across all categories (Food, Vibe, Service, Rep, Conv) to assess overall engine quality. Each query is graded for Score Fit and Blurb Quality.',
    data: '20 queries from 5 categories, stratified random sampling',
  },
  regression: {
    icon: '&#9878;',
    title: 'Regression Guard',
    desc: 'Tests 23 golden baseline queries with known minimum scores. Detects scoring regressions from engine changes. Any query below its baseline flags a regression.',
    data: '23 golden queries with baseline DM thresholds (45-65)',
  },
  edge: {
    icon: '&#128737;',
    title: 'Edge Case Probes',
    desc: 'Sends 20 adversarial inputs (SQL injection, XSS, empty input, emoji-only, oversized arrays) to verify the API handles edge cases gracefully without crashing.',
    data: '20 probes: empty, XSS, SQL injection, Unicode, oversized, contradictory',
  },
  category: {
    icon: '&#127919;',
    title: 'Category Focus',
    desc: 'Tests 15 queries focused on a specific category to deep-dive into one signal type.',
    data: '15 queries from selected category',
  },
  blurb: {
    icon: '&#128214;',
    title: 'Blurb Quality Audit',
    desc: 'Checks 10 restaurant blurbs for slop patterns (cliches, banned phrases). Quick mode uses regex; Deep mode calls Claude API.',
    data: '10 random restaurant blurbs from database',
  },
  coverage: {
    icon: '&#128202;',
    title: 'Data Coverage Check',
    desc: 'Audits 10 random restaurants for field completeness (name, address, cuisine, rating, noise, price, phone, neighborhood, lighting).',
    data: '10 random restaurants, 9 required fields each',
  },
};

function showTestConfirm(type, args) {
  _pendingTestType = type;
  _pendingTestArgs = args;

  var info = TEST_DESCRIPTIONS[type] || { icon: '&#9654;', title: type, desc: '', data: '' };
  var testDef = typeof TEST_TYPES !== 'undefined' ? TEST_TYPES[type] : null;
  var cost = typeof getTestCost === 'function' ? getTestCost(type) : '$0.00';
  var count = testDef?.count || '?';
  var time = testDef?.time || '?';
  var isLive = state.liveAPI;

  var $icon = document.getElementById('mc-confirm-icon');
  var $title = document.getElementById('mc-confirm-title');
  var $body = document.getElementById('mc-confirm-body');
  if ($icon) $icon.innerHTML = info.icon;
  if ($title) $title.textContent = info.title;

  var html = '';
  html += '<div class="mc-confirm__row"><span class="mc-confirm__key">Queries</span><span class="mc-confirm__val" id="mc-confirm-count">' + count + '</span></div>';
  html += '<div class="mc-confirm__row"><span class="mc-confirm__key">Est. Time</span><span class="mc-confirm__val">' + time + '</span></div>';
  html += '<div class="mc-confirm__row"><span class="mc-confirm__key">API Mode</span><span class="mc-confirm__val ' + (isLive ? 'mc-confirm__val--red' : 'mc-confirm__val--green') + '" id="mc-confirm-mode">' + (isLive ? 'LIVE API' : 'Scoring Only') + '</span></div>';
  html += '<div class="mc-confirm__row"><span class="mc-confirm__key">Cost</span><span class="mc-confirm__val ' + (cost === '$0.00' ? 'mc-confirm__val--green' : 'mc-confirm__val--amber') + '" id="mc-confirm-cost">' + cost + '</span></div>';
  if (args) html += '<div class="mc-confirm__row"><span class="mc-confirm__key">Category</span><span class="mc-confirm__val">' + escapeHtml(String(args)) + '</span></div>';
  html += '<div class="mc-confirm__row"><span class="mc-confirm__key">Data</span><span class="mc-confirm__val" style="text-align:right;max-width:220px;font-weight:400;font-size:10px">' + info.data + '</span></div>';
  html += '<div class="mc-confirm__desc">' + info.desc + '</div>';

  if ($body) $body.innerHTML = html;

  // Reset customize panel
  var $cust = document.getElementById('mc-confirm-customize');
  if ($cust) $cust.style.display = 'none';
  var $tweak = document.getElementById('mc-confirm-tweak');
  if ($tweak) $tweak.classList.remove('mc-confirm__tweak--active');

  document.getElementById('mc-confirm-backdrop').style.display = '';
  document.getElementById('mc-confirm').style.display = '';
}

function toggleTestCustomize() {
  var $cust = document.getElementById('mc-confirm-customize');
  var $tweak = document.getElementById('mc-confirm-tweak');
  if (!$cust) return;

  var isOpen = $cust.style.display !== 'none';
  if (isOpen) {
    $cust.style.display = 'none';
    if ($tweak) $tweak.classList.remove('mc-confirm__tweak--active');
    return;
  }

  if ($tweak) $tweak.classList.add('mc-confirm__tweak--active');

  var type = _pendingTestType;
  var testDef = typeof TEST_TYPES !== 'undefined' ? TEST_TYPES[type] : null;
  var count = testDef?.count || 20;
  var cats = ['Food', 'Vibe', 'Service', 'Rep', 'Conv'];
  var activeCats = _pendingTestArgs ? [_pendingTestArgs] : cats;

  var html = '';

  if (type === 'broad' || type === 'category') {
    html += '<div class="mc-confirm__field">';
    html += '<span class="mc-confirm__field-label">Queries</span>';
    html += '<input type="range" class="mc-confirm__field-input" id="mc-cust-count" min="5" max="50" step="5" value="' + count + '" oninput="updateTestCustomCount(this.value)" style="accent-color:var(--cc-accent)">';
    html += '<span id="mc-cust-count-val" style="font-family:var(--font-mono);font-size:var(--text-xs);min-width:24px;text-align:right">' + count + '</span>';
    html += '</div>';
  }

  if (type === 'broad' || type === 'category') {
    html += '<div class="mc-confirm__field">';
    html += '<span class="mc-confirm__field-label">Categories</span>';
    html += '<div class="mc-confirm__pills" id="mc-cust-cats">';
    cats.forEach(function(c) {
      var active = activeCats.map(function(a) { return a.toLowerCase(); }).includes(c.toLowerCase());
      html += '<button class="mc-confirm__pill' + (active ? ' mc-confirm__pill--active' : '') + '" onclick="toggleTestCat(this,\'' + c + '\')">' + c + '</button>';
    });
    html += '</div></div>';
  }

  html += '<div class="mc-confirm__field">';
  html += '<span class="mc-confirm__field-label">API Mode</span>';
  html += '<select class="mc-confirm__field-select" id="mc-cust-mode" onchange="updateTestCustomMode(this.value)">';
  html += '<option value="scoring"' + (!state.liveAPI ? ' selected' : '') + '>Scoring Only ($0)</option>';
  html += '<option value="live"' + (state.liveAPI ? ' selected' : '') + '>LIVE API ($$$)</option>';
  html += '</select></div>';

  if (type === 'broad' || type === 'category' || type === 'regression') {
    html += '<div class="mc-confirm__field">';
    html += '<span class="mc-confirm__field-label">Pass DM</span>';
    html += '<input type="number" class="mc-confirm__field-input" id="mc-cust-threshold" value="60" min="30" max="90" step="5" style="max-width:80px">';
    html += '<span style="font-size:var(--text-xs);color:var(--cc-text3)">min DondeMatch to pass</span>';
    html += '</div>';
  }

  $cust.innerHTML = html;
  $cust.style.display = '';
}

function toggleTestCat(btn, cat) {
  btn.classList.toggle('mc-confirm__pill--active');
  var active = Array.from(document.querySelectorAll('#mc-cust-cats .mc-confirm__pill--active')).map(function(b) { return b.textContent.toLowerCase(); });
  if (active.length > 0) _pendingTestArgs = active;
}

function updateTestCustomCount(val) {
  var label = document.getElementById('mc-cust-count-val');
  if (label) label.textContent = val;
  var countEl = document.getElementById('mc-confirm-count');
  if (countEl) countEl.textContent = val;
  if (state.testConfig && _pendingTestType) {
    if (!state.testConfig[_pendingTestType]) state.testConfig[_pendingTestType] = {};
    state.testConfig[_pendingTestType].count = parseInt(val);
  }
}

function updateTestCustomMode(val) {
  var isLive = val === 'live';
  state.liveAPI = isLive;
  if (typeof saveSession === 'function') saveSession();
  if (typeof updateLiveAPIUI === 'function') updateLiveAPIUI();
  var costEl = document.getElementById('mc-confirm-cost');
  var modeEl = document.getElementById('mc-confirm-mode');
  if (costEl) {
    var cost = typeof getTestCost === 'function' ? getTestCost(_pendingTestType) : '$0.00';
    costEl.textContent = cost;
    costEl.className = 'mc-confirm__val ' + (cost === '$0.00' ? 'mc-confirm__val--green' : 'mc-confirm__val--amber');
  }
  if (modeEl) {
    modeEl.textContent = isLive ? 'LIVE API' : 'Scoring Only';
    modeEl.className = 'mc-confirm__val ' + (isLive ? 'mc-confirm__val--red' : 'mc-confirm__val--green');
  }
}

function cancelTestConfirm() {
  _pendingTestType = null;
  _pendingTestArgs = null;
  document.getElementById('mc-confirm-backdrop').style.display = 'none';
  document.getElementById('mc-confirm').style.display = 'none';
}

function executeConfirmedTest() {
  var type = _pendingTestType;
  var args = _pendingTestArgs;
  cancelTestConfirm();

  if (!type) return;
  if (typeof startTest !== 'function') { cooLog('error', 'Test runner not available.'); return; }

  var custCount = document.getElementById('mc-cust-count');
  if (custCount && state.testConfig) {
    var count = parseInt(custCount.value);
    if (!state.testConfig[type]) state.testConfig[type] = {};
    state.testConfig[type].count = count;
  }

  var custThreshold = document.getElementById('mc-cust-threshold');
  if (custThreshold && state.testConfig) {
    if (!state.testConfig[type]) state.testConfig[type] = {};
    state.testConfig[type].threshold = parseInt(custThreshold.value);
  }

  if (type === 'category') {
    var selectedCats = args ? (Array.isArray(args) ? args : [args]) : ['food', 'vibe', 'service', 'rep', 'conv'];
    state.selectedCategories = selectedCats;
    if (typeof runCategoryFocus === 'function') {
      triggerDarkPulse();
      termLog('system', 'Starting Category Focus: ' + selectedCats.join(', ') + '...');
      runCategoryFocus(selectedCats);
    }
  } else if (type === 'broad') {
    var custCats = document.getElementById('mc-cust-cats');
    if (custCats) {
      var active = Array.from(custCats.querySelectorAll('.mc-confirm__pill--active')).map(function(b) { return b.textContent.toLowerCase(); });
      if (active.length > 0 && active.length < 5) {
        state.selectedCategories = active;
        triggerDarkPulse();
        termLog('system', 'Starting focused scan: ' + active.join(', ') + '...');
        if (typeof runCategoryFocus === 'function') runCategoryFocus(active);
        return;
      }
    }
    startTest('broad');
  } else {
    startTest(type);
  }
}

// ═══════════════════════════════════════════════════════════════════
// Dashboard Mode Toggle (TEST / LIVE)
// ═══════════════════════════════════════════════════════════════════

function switchDashboardMode(mode) {
  if (mode === state.dashboardMode) return;
  state.dashboardMode = mode;
  if (typeof saveSession === 'function') saveSession();

  // Body class swap
  document.body.classList.toggle('mc-mode--live', mode === 'live');

  // Toggle pill visual
  var toggle = document.getElementById('mode-toggle');
  if (toggle) {
    toggle.classList.toggle('mc-mode-toggle--test', mode === 'test');
    toggle.classList.toggle('mc-mode-toggle--live', mode === 'live');
    toggle.querySelectorAll('.mc-mode-toggle__option').forEach(function(btn) {
      btn.classList.toggle('mc-mode-toggle__option--active', btn.dataset.modeBtn === mode);
    });
  }

  // Load data for the target mode
  if (mode === 'live') {
    if (typeof loadLiveKPIs === 'function') loadLiveKPIs();
    if (typeof renderLiveFeedFull === 'function' && state.liveFeed) {
      renderLiveFeedFull(state.liveFeed);
    }
    // Update live morning brief
    renderLiveBrief();
  }

  // Close any open pulse expansion from the other mode
  state.expandedPulse = null;
  closeDetail();
}

// ═══════════════════════════════════════════════════════════════════
// Live Morning Brief
// ═══════════════════════════════════════════════════════════════════

function renderLiveBrief() {
  var $brief = document.getElementById('mc-brief-live');
  var $icon = document.getElementById('mc-brief-live-icon');
  var $text = document.getElementById('mc-brief-live-text');
  if (!$brief || !$text) return;
  $brief.style.display = '';

  var hour = new Date().getHours();
  var greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';
  var kpis = state.liveKPIs;

  if (!kpis) {
    $brief.className = 'mc-brief mc-brief--amber';
    if ($icon) $icon.textContent = '\u26A0';
    $text.innerHTML = '<strong>' + greeting + ', Aacrit.</strong> Loading live production data...';
    return;
  }

  var dm = kpis.avgDm || 0;
  var passRate = kpis.passRate || 0;
  var count = kpis.queryCount || 0;

  if (passRate >= 85 && dm >= 75) {
    $brief.className = 'mc-brief mc-brief--green';
    if ($icon) $icon.textContent = '\u2713';
    $text.innerHTML = '<strong>' + greeting + ', Aacrit.</strong> Production healthy \u2014 ' + count + ' queries today, DM ' + dm + ', ' + passRate + '% passing.';
  } else if (passRate < 70 || dm < 60) {
    $brief.className = 'mc-brief mc-brief--red';
    if ($icon) $icon.textContent = '\u2717';
    $text.innerHTML = '<strong>' + greeting + ', Aacrit.</strong> Production needs attention \u2014 DM ' + dm + ', ' + passRate + '% passing. Check low-score queries.';
  } else {
    $brief.className = 'mc-brief mc-brief--amber';
    if ($icon) $icon.textContent = '\u26A0';
    $text.innerHTML = '<strong>' + greeting + ', Aacrit.</strong> Production running \u2014 ' + count + ' queries, DM ' + dm + ', ' + passRate + '% passing.';
  }
}

// ═══════════════════════════════════════════════════════════════════
// Live Pulse Cards
// ═══════════════════════════════════════════════════════════════════

function updateLivePulseCards(kpis) {
  // P1: Response Quality
  var $blurb = document.getElementById('pulse-live-blurb-val');
  if ($blurb) {
    $blurb.textContent = kpis.blurbQuality || '--';
    $blurb.className = 'mc-pulse-card__value ' + ragClass(kpis.blurbQuality || 0);
  }
  var $fit = document.getElementById('pulse-live-fit-val');
  if ($fit) {
    $fit.textContent = kpis.scoreFit || '--';
    $fit.className = 'mc-pulse-card__value ' + ragClass(kpis.scoreFit || 0);
  }

  // P2: Operational
  var $rt = document.getElementById('pulse-live-rt-val');
  if ($rt) {
    var rtMs = kpis.responseTime || 0;
    var rtDisplay = (rtMs / 1000).toFixed(1) + 's';
    $rt.textContent = rtDisplay;
    $rt.className = 'mc-pulse-card__value ' + (rtMs <= 3000 ? 'rag-green' : rtMs <= 5000 ? 'rag-amber' : 'rag-red');
  }
  var $cache = document.getElementById('pulse-live-cache-val');
  if ($cache) {
    $cache.textContent = (kpis.cacheHitRate || 0) + '%';
    $cache.className = 'mc-pulse-card__value ' + (kpis.cacheHitRate >= 50 ? 'rag-green' : kpis.cacheHitRate >= 20 ? 'rag-amber' : 'rag-red');
  }

  // P3: User Satisfaction
  var $dm = document.getElementById('pulse-live-dm-val');
  if ($dm) {
    $dm.textContent = kpis.avgDm || '--';
    $dm.className = 'mc-pulse-card__value ' + ragClass(kpis.avgDm || 0);
  }
  var $pass = document.getElementById('pulse-live-pass-val');
  if ($pass) {
    $pass.textContent = (kpis.passRate || 0) + '%';
    $pass.className = 'mc-pulse-card__value ' + (kpis.passRate >= 85 ? 'rag-green' : kpis.passRate >= 70 ? 'rag-amber' : 'rag-red');
  }

  // P4: Business (query count in feed section title)
  var $count = document.getElementById('mc-live-query-count');
  if ($count) $count.textContent = '(' + (kpis.queryCount || 0) + ' today)';
}

// ═══════════════════════════════════════════════════════════════════
// Live Feed (full rendering for LIVE mode)
// ═══════════════════════════════════════════════════════════════════

function renderLiveFeedFull(queries) {
  var $el = document.getElementById('mc-live-feed-full');
  if (!$el) return;

  var filtered = (queries || []).filter(function(q) { return q.source !== 'command-center'; });
  if (!filtered.length) {
    $el.innerHTML = '<div class="mc-empty">No production queries in the last 24h</div>';
    return;
  }

  $el.innerHTML = filtered.slice(0, 20).map(function(q) {
    var dm = q.donde_match || 0;
    var rt = q.response_time_ms ? (q.response_time_ms / 1000).toFixed(1) + 's' : '--';
    var fitG = q.score_fit_grade || '--';
    var blurbG = q.blurb_quality_grade || '--';
    var query = q.special_request || '(empty)';
    var name = (q.restaurants && q.restaurants.name) ? q.restaurants.name : '';
    var cacheTag = q.cache_hit ? '<span class="mc-feed-tag mc-feed-tag--cache">cached</span>' : '';

    return '<div class="mc-feed-item mc-feed-item--live mc-clickable" onclick="testAndShowDetail(\'' + escapeHtml(query.replace(/'/g, "\\'")) + '\')" title="' + escapeHtml(query) + '">' +
      '<span class="mc-feed-item__query">"' + escapeHtml(query.slice(0, 35)) + '"</span>' +
      '<span class="mc-feed-item__meta">' + escapeHtml((name || '').slice(0, 20)) + '</span>' +
      '<span class="mc-feed-item__rt">' + rt + '</span>' +
      '<span class="mc-feed-item__grades">F:' + fitG + ' B:' + blurbG + '</span>' +
      cacheTag +
      '<span class="mc-feed-item__time">' + (q.created_at ? timeAgo(q.created_at) : '') + '</span>' +
      '<span class="mc-feed-item__score ' + ragClass(dm) + '">' + dm + '</span>' +
    '</div>';
  }).join('');
}

// ═══════════════════════════════════════════════════════════════════
// Live Action Handlers
// ═══════════════════════════════════════════════════════════════════

function viewSlowQueries() {
  var slow = (state.liveFeed || []).filter(function(q) { return q.response_time_ms > 5000 && q.source !== 'command-center'; });
  var html = '<div class="mc-viz__metric" style="margin-bottom:var(--space-md)"><div class="mc-viz__metric-val ' + (slow.length === 0 ? 'rag-green' : 'rag-red') + '">' + slow.length + '</div><div class="mc-viz__metric-label">Queries &gt; 5s</div></div>';
  if (slow.length === 0) {
    html += '<div class="mc-viz__insight mc-viz__insight--success"><span class="mc-viz__insight-icon">\u2713</span> No slow queries. All responses under 5s.</div>';
  } else {
    html += slow.slice(0, 10).map(function(q) {
      return '<div class="mc-run-expand__item" onclick="testAndShowDetail(\'' + escapeHtml((q.special_request || '').replace(/'/g, "\\'")) + '\')">' +
        '<span class="mc-run-expand__query">"' + escapeHtml((q.special_request || '').slice(0, 30)) + '"</span>' +
        '<span class="mc-run-expand__grades">' + (q.response_time_ms / 1000).toFixed(1) + 's</span>' +
        '<span class="mc-run-expand__score ' + ragClass(q.donde_match || 0) + '">' + (q.donde_match || 0) + '</span></div>';
    }).join('');
  }
  openDetail('Slow Queries (>5s)', html);
}

function viewLowScoreQueries() {
  var low = (state.liveFeed || []).filter(function(q) { return (q.donde_match || 0) < 60 && q.source !== 'command-center'; });
  var html = '<div class="mc-viz__metric" style="margin-bottom:var(--space-md)"><div class="mc-viz__metric-val ' + (low.length === 0 ? 'rag-green' : 'rag-red') + '">' + low.length + '</div><div class="mc-viz__metric-label">Queries DM &lt; 60</div></div>';
  if (low.length === 0) {
    html += '<div class="mc-viz__insight mc-viz__insight--success"><span class="mc-viz__insight-icon">\u2713</span> No low-score queries. All production queries above 60.</div>';
  } else {
    html += low.slice(0, 10).map(function(q) {
      return '<div class="mc-run-expand__item" onclick="testAndShowDetail(\'' + escapeHtml((q.special_request || '').replace(/'/g, "\\'")) + '\')">' +
        '<span class="mc-run-expand__query">"' + escapeHtml((q.special_request || '').slice(0, 30)) + '"</span>' +
        '<span class="mc-run-expand__grades">' + (q.score_fit_grade || '--') + '</span>' +
        '<span class="mc-run-expand__score rag-red">' + (q.donde_match || 0) + '</span></div>';
    }).join('');
  }
  openDetail('Low Score Queries (DM < 60)', html);
}

function viewFallbacks() {
  var fb = (state.liveFeed || []).filter(function(q) { return q.was_fallback && q.source !== 'command-center'; });
  var html = '<div class="mc-viz__metric" style="margin-bottom:var(--space-md)"><div class="mc-viz__metric-val ' + (fb.length === 0 ? 'rag-green' : 'rag-amber') + '">' + fb.length + '</div><div class="mc-viz__metric-label">Fallback Responses</div></div>';
  if (fb.length === 0) {
    html += '<div class="mc-viz__insight mc-viz__insight--success"><span class="mc-viz__insight-icon">\u2713</span> No fallbacks. All queries received full engine responses.</div>';
  } else {
    html += fb.slice(0, 10).map(function(q) {
      return '<div class="mc-run-expand__item" onclick="testAndShowDetail(\'' + escapeHtml((q.special_request || '').replace(/'/g, "\\'")) + '\')">' +
        '<span class="mc-run-expand__query">"' + escapeHtml((q.special_request || '').slice(0, 30)) + '"</span>' +
        '<span class="mc-run-expand__grades">fallback</span>' +
        '<span class="mc-run-expand__score rag-amber">' + (q.donde_match || 0) + '</span></div>';
    }).join('');
  }
  openDetail('Fallback Responses', html);
}

// ═══════════════════════════════════════════════════════════════════
// Time Period Toggle (Live mode)
// ═══════════════════════════════════════════════════════════════════

function setLivePeriod(period) {
  state.livePeriod = period;

  // Update toggle buttons
  var btns = document.querySelectorAll('.mc-time-toggle__btn');
  btns.forEach(function(b) {
    b.classList.toggle('mc-time-toggle__btn--active', b.dataset.period === period);
  });

  // Reload live KPIs with new period
  if (typeof loadLiveKPIs === 'function') loadLiveKPIs(period);
  if (state.liveFeed) {
    var filtered = filterByPeriod(state.liveFeed, period);
    renderLiveFeedFull(filtered);
  }
}

function filterByPeriod(queries, period) {
  var now = Date.now();
  var cutoffs = { '24h': 24*60*60*1000, '7d': 7*24*60*60*1000, '30d': 30*24*60*60*1000, 'ytd': null };
  var ms = cutoffs[period];
  if (!ms) {
    // YTD: from Jan 1 of current year
    var jan1 = new Date(new Date().getFullYear(), 0, 1).getTime();
    return queries.filter(function(q) { return new Date(q.created_at).getTime() >= jan1; });
  }
  var cutoff = now - ms;
  return queries.filter(function(q) { return new Date(q.created_at).getTime() >= cutoff; });
}

// ═══════════════════════════════════════════════════════════════════
// Terminal Log (legacy — redirect to COO terminal)
// ═══════════════════════════════════════════════════════════════════

function termLog(type, msg) {
  if (typeof cooLog === 'function') cooLog(type === 'pass' ? 'success' : type === 'fail' ? 'error' : type, msg);
}

function openTerminal() {}
function closeTerminal() {}
function updateTicker() {}

// ═══════════════════════════════════════════════════════════════════
// Agent Team Detail Panel
// ═══════════════════════════════════════════════════════════════════

/**
 * Open the right detail panel with full agent profile, skills, and CLI prompt.
 * @param {string} agentId - The agent ID (e.g. 'donde-coo', 'bug-fixer')
 */
function showAgentDetail(agentId) {
  // Find agent in team data
  var agent = null;
  var divName = '';
  var divColor = '';
  if (window._agentTeam) {
    for (var div in window._agentTeam) {
      var team = window._agentTeam[div];
      for (var i = 0; i < team.agents.length; i++) {
        if (team.agents[i].id === agentId) {
          agent = team.agents[i];
          divName = div;
          divColor = team.color;
          break;
        }
      }
      if (agent) break;
    }
  }
  if (!agent) return;

  // Expand inline in the left drawer — collapse any existing detail first
  var container = document.getElementById('mc-drawer-agents');
  if (!container) return;
  var existingDetail = document.getElementById('mc-agent-inline-detail');
  if (existingDetail) {
    // If same agent, collapse
    if (existingDetail.dataset.agentId === agentId) {
      existingDetail.style.maxHeight = '0';
      existingDetail.style.opacity = '0';
      setTimeout(function() { if (existingDetail.parentNode) existingDetail.parentNode.removeChild(existingDetail); }, 350);
      return;
    }
    existingDetail.parentNode.removeChild(existingDetail);
  }

  // Find the clicked agent card and insert detail after it
  var cards = container.querySelectorAll('.mc-agent-card, .mc-agent-coo');
  var targetCard = null;
  cards.forEach(function(c) {
    if (c.getAttribute('onclick') && c.getAttribute('onclick').indexOf(agentId) >= 0) targetCard = c;
  });

  var html = '';
  html += '<div style="padding:var(--space-sm) 0;border-bottom:1px solid var(--cc-border);margin-bottom:var(--space-sm)">';
  html += '<div style="font-size:var(--text-sm);font-weight:700;margin-bottom:2px">' + agent.name + '</div>';
  html += '<div style="font-size:var(--text-xs);color:var(--cc-text3)">' + agent.role + '</div>';
  html += '<span style="font-size:9px;padding:1px 6px;border-radius:var(--radius-pill);background:' + divColor + ';color:white;font-weight:600;display:inline-block;margin-top:4px">' + divName + '</span>';
  html += '</div>';

  // Skills
  html += '<div style="display:flex;flex-wrap:wrap;gap:3px;margin-bottom:var(--space-sm)">';
  agent.skills.forEach(function(s) {
    html += '<span style="font-size:9px;padding:2px 6px;background:var(--cc-surface2);border:1px solid var(--cc-border);border-radius:var(--radius-pill);color:var(--cc-text2)">' + s + '</span>';
  });
  html += '</div>';

  // Agent ID + Trigger
  html += '<div class="mc-expand__row"><span class="mc-expand__key">ID</span><span class="mc-expand__val" style="font-size:9px">' + agent.id + '</span></div>';
  html += '<div class="mc-expand__row"><span class="mc-expand__key">Trigger</span><span class="mc-expand__val" style="font-size:9px">' + agent.trigger + '</span></div>';

  // Prompt textarea
  html += '<div style="margin-top:var(--space-sm)">';
  html += '<textarea id="mc-agent-prompt" style="width:100%;min-height:60px;padding:var(--space-xs);background:var(--cc-bg);border:1px solid var(--cc-border);border-radius:var(--radius-sm);color:var(--cc-text);font-family:var(--font-sans);font-size:10px;resize:vertical;line-height:1.4;box-sizing:border-box">' + agent.defaultPrompt + '</textarea>';
  html += '</div>';

  // Buttons
  html += '<div style="margin-top:var(--space-xs);display:flex;gap:4px">';
  html += '<button class="mc-viz__cta mc-viz__cta--primary" onclick="copyAgentCommand(\'' + agent.id + '\')" style="flex:1;font-size:9px">Copy Command</button>';
  html += '<button class="mc-viz__cta mc-viz__cta--success" onclick="processCOOInput(\'' + agent.id.replace('donde-', '').replace(/-/g, ' ') + '\')" style="flex:1;font-size:9px">Run</button>';
  html += '</div>';

  var detailDiv = document.createElement('div');
  detailDiv.id = 'mc-agent-inline-detail';
  detailDiv.dataset.agentId = agentId;
  detailDiv.className = 'mc-agent-inline-detail';
  detailDiv.innerHTML = html;
  detailDiv.style.maxHeight = '0';
  detailDiv.style.opacity = '0';

  // Insert after the clicked card's parent div, or after the card itself
  var insertAfter = targetCard ? (targetCard.closest('.mc-agent-div') || targetCard) : container.lastElementChild;
  if (insertAfter && insertAfter.nextSibling) {
    insertAfter.parentNode.insertBefore(detailDiv, insertAfter.nextSibling);
  } else if (insertAfter) {
    insertAfter.parentNode.appendChild(detailDiv);
  } else {
    container.appendChild(detailDiv);
  }

  // Animate open
  requestAnimationFrame(function() {
    detailDiv.style.maxHeight = '400px';
    detailDiv.style.opacity = '1';
  });

  // Scroll into view
  setTimeout(function() { detailDiv.scrollIntoView({ behavior: 'smooth', block: 'nearest' }); }, 100);
}

/**
 * Copy the full CLI command (agent + prompt) to the clipboard.
 * @param {string} agentId - The agent ID
 */
function copyAgentCommand(agentId) {
  var textarea = document.getElementById('mc-agent-prompt');
  var prompt = textarea ? textarea.value : '';
  var cmd = 'claude --agent ' + agentId + ' --prompt "' + prompt.replace(/"/g, '\\"') + '"';

  if (navigator.clipboard) {
    navigator.clipboard.writeText(cmd).then(function() {
      var btn = document.querySelector('.mc-viz__cta--primary');
      if (btn) {
        var orig = btn.textContent;
        btn.textContent = 'Copied!';
        setTimeout(function() { btn.textContent = orig; }, 1500);
      }
    });
  }
}
