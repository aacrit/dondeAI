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

  if (!run) {
    // No data state
    $brief.style.display = '';
    $brief.className = 'mc-brief mc-brief--amber';
    $icon.textContent = '\u26A0';
    $text.innerHTML = '<strong>No test data available.</strong> Run your first quality scan to see engine health.';
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
    message = '<strong>All systems healthy.</strong> Engine at ' + grade + ' (' + avgDm + ' DM, ' + passRate + '% pass). No issues.';
    actionHtml = '<button class="mc-smart-action__btn mc-smart-action__btn--success" onclick="processCOOInput(\'regression\')">Run Regression Guard</button>';
  } else if (gapCount > 5 || passRate < 70) {
    // RED
    ragState = 'red';
    icon = '\u2717';
    message = '<strong>' + gapCount + ' issue' + (gapCount !== 1 ? 's' : '') + ' detected.</strong> Engine at ' + grade + ' (' + avgDm + ' DM, ' + passRate + '% pass). Action required.';
    actionHtml = '<button class="mc-smart-action__btn mc-smart-action__btn--danger" onclick="processCOOInput(\'fix bugs\')">Fix ' + gapCount + ' Issue' + (gapCount !== 1 ? 's' : '') + '</button>';
  } else {
    // AMBER
    ragState = 'amber';
    icon = '\u26A0';
    if (gapCount > 0) {
      message = '<strong>' + gapCount + ' issue' + (gapCount !== 1 ? 's' : '') + ' need attention.</strong> Engine at ' + grade + ' (' + avgDm + ' DM, ' + passRate + '% pass).';
      actionHtml = '<button class="mc-smart-action__btn mc-smart-action__btn--primary" onclick="processCOOInput(\'fix bugs\')">Fix ' + gapCount + ' Issue' + (gapCount !== 1 ? 's' : '') + '</button>';
    } else {
      message = '<strong>Engine stable.</strong> ' + grade + ' (' + avgDm + ' DM, ' + passRate + '% pass). Consider running a fresh scan.';
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
    var date = new Date(run.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

    // Delta from previous run
    var deltaHtml = '';
    if (run.delta_avg_dm != null && run.delta_avg_dm !== 0) {
      var d = Math.round(run.delta_avg_dm);
      if (d > 0) {
        deltaHtml = '<span class="mc-run-row__delta mc-run-row__delta--up">\u2191' + d + '</span>';
      } else {
        deltaHtml = '<span class="mc-run-row__delta mc-run-row__delta--down">\u2193' + Math.abs(d) + '</span>';
      }
    }

    return '<div class="mc-run-row mc-clickable" onclick="processCOOInput(\'compare\')" title="Click to compare runs">' +
      '<span class="mc-run-row__date">' + date + '</span>' +
      '<span class="mc-run-row__grade ' + ragClass(avgDm) + '">' + grade + '</span>' +
      '<span class="mc-run-row__dm">DM ' + avgDm + deltaHtml + '</span>' +
      '<span class="mc-run-row__pass">' + passRate + '%</span>' +
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
  if ($latency && stats?.avgLatency != null) $latency.textContent = Math.round(stats.avgLatency) + 'ms avg';
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
  cooLog(type, '"' + query.slice(0, 35) + '" \u2192 ' + name + ' DM ' + dm + ' | Fit: ' + fitGrade + ' | Blurb: ' + blurbGrade);
}

function appendSummaryRow(name, total, passed, avgDm, elapsed, celebrate, testType) {
  if (typeof cooLog !== 'function') return;
  var pct = total > 0 ? Math.round(passed / total * 100) : 0;
  cooLog('info', '\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500');
  cooLog(pct >= 80 ? 'success' : 'warn',
    name + ': ' + passed + '/' + total + ' passed (' + pct + '%), avg DM ' + avgDm + ', ' + elapsed);

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
    setTimeout(function() { var $i = document.getElementById('coo-input'); if ($i) $i.focus(); }, 100);
  }
  updateDashboardMargins();
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
function togglePulseExpand() {}
function selectRun() {}
function updatePulseFromProd() {}
function updateDbOverview() {}
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
// Terminal Log (legacy — redirect to COO terminal)
// ═══════════════════════════════════════════════════════════════════

function termLog(type, msg) {
  if (typeof cooLog === 'function') cooLog(type === 'pass' ? 'success' : type === 'fail' ? 'error' : type, msg);
}

function openTerminal() {}
function closeTerminal() {}
function updateTicker() {}
