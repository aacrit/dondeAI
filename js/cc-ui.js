/**
 * DondeAI Mission Control — UI Rendering
 * Simplified 2-panel layout: Mission Board + COO Terminal
 */

// ═══════════════════════════════════════════════════════════════════
// Init
// ═══════════════════════════════════════════════════════════════════

document.addEventListener('DOMContentLoaded', () => {
  checkAuth();
  if (typeof initCOOTerminal === 'function') initCOOTerminal();
  if (typeof updateLiveAPIUI === 'function') updateLiveAPIUI();
});

// ═══════════════════════════════════════════════════════════════════
// Pulse Cards + Grade
// ═══════════════════════════════════════════════════════════════════

function updatePulseFromRun(run) {
  if (!run) return;

  const avgDm = Math.round(Number(run.avg_dm) || 0);
  const avgFit = Math.round(Number(run.avg_score_fit) || 0);
  const avgBlurb = Math.round(Number(run.avg_blurb_quality) || 0);
  const total = run.total || 1;
  const passCount = run.grade_pass_count || run.passed_60 || 0;
  const passRate = Math.round(passCount / total * 100);
  const gapCount = run.gap_count || 0;

  // Pulse card values
  const $health = document.getElementById('pulse-health-val');
  const $dm = document.getElementById('pulse-dm-val');
  const $issues = document.getElementById('pulse-issues-val');

  if ($health) {
    $health.textContent = passRate + '%';
    $health.className = 'mc-pulse-card__value ' + ragClass(passRate);
  }
  if ($dm) {
    $dm.textContent = avgDm;
    $dm.className = 'mc-pulse-card__value ' + ragClass(avgDm);
  }
  if ($issues) {
    $issues.textContent = gapCount;
    $issues.className = 'mc-pulse-card__value ' + (gapCount === 0 ? 'rag-green' : gapCount <= 3 ? 'rag-amber' : 'rag-red');
  }

  // Engine grade
  const grade = computeEngineGrade(run);
  const $letter = document.getElementById('mc-grade-letter');
  const $sub = document.getElementById('mc-grade-sub');
  if ($letter) {
    $letter.textContent = grade;
    $letter.style.color = grade.startsWith('A') ? 'var(--cc-green)' :
      grade.startsWith('B') ? 'var(--cc-accent)' :
      grade.startsWith('C') ? 'var(--cc-amber)' : 'var(--cc-red)';
  }
  if ($sub) {
    $sub.textContent = `DM ${avgDm} · Fit ${avgFit} · Blurb ${avgBlurb}`;
  }

  // Health dot
  const $dot = document.getElementById('mc-health-dot');
  if ($dot) {
    $dot.className = 'mc-health-dot' + (passRate >= 80 ? '' : passRate >= 60 ? ' mc-health-dot--amber' : ' mc-health-dot--red');
  }

  // Ambient glow on Mission Board
  const $board = document.querySelector('.mc-board');
  if ($board) {
    $board.classList.remove('mc-board--green', 'mc-board--amber', 'mc-board--red');
    $board.classList.add(passRate >= 80 ? 'mc-board--green' : passRate >= 60 ? 'mc-board--amber' : 'mc-board--red');
  }

  // Store for COO terminal
  state.latestRun = run;
}

// ═══════════════════════════════════════════════════════════════════
// Run History (simplified — last 5 runs)
// ═══════════════════════════════════════════════════════════════════

function renderRunHistory(runs) {
  const $el = document.getElementById('mc-runs');
  if (!$el) return;

  state.runHistory = runs || [];

  if (!runs || runs.length === 0) {
    $el.innerHTML = '<div class="mc-empty">No runs yet</div>';
    return;
  }

  $el.innerHTML = runs.slice(0, 5).map(run => {
    const avgDm = Math.round(Number(run.avg_dm) || 0);
    const total = run.total || 1;
    const passCount = run.grade_pass_count || run.passed_60 || 0;
    const passRate = Math.round(passCount / total * 100);
    const grade = computeEngineGrade(run);
    const date = new Date(run.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

    return `<div class="mc-run-row">
      <span class="mc-run-row__date">${date}</span>
      <span class="mc-run-row__grade ${ragClass(avgDm)}">${grade}</span>
      <span class="mc-run-row__dm">DM ${avgDm}</span>
      <span class="mc-run-row__pass">${passRate}%</span>
    </div>`;
  }).join('');
}

// ═══════════════════════════════════════════════════════════════════
// Live Feed (simplified — last 10 queries)
// ═══════════════════════════════════════════════════════════════════

function renderLiveFeed(queries) {
  const $el = document.getElementById('mc-feed');
  if (!$el) return;

  state.liveFeed = queries || [];

  if (!queries || queries.length === 0) {
    $el.innerHTML = '<div class="mc-empty">No recent queries</div>';
    return;
  }

  $el.innerHTML = queries.slice(0, 10).map(q => {
    const dm = q.donde_match || 0;
    const query = q.special_request || '(empty)';
    return `<div class="mc-feed-item">
      <span class="mc-feed-item__query" title="${escapeHtml(query)}">"${escapeHtml(query.slice(0, 40))}"</span>
      <span class="mc-feed-item__score ${ragClass(dm)}">${dm}</span>
    </div>`;
  }).join('');
}

// ═══════════════════════════════════════════════════════════════════
// Footer
// ═══════════════════════════════════════════════════════════════════

function renderFooterBar(stats) {
  const $engine = document.getElementById('mc-footer-engine');
  const $cache = document.getElementById('mc-footer-cache');
  const $latency = document.getElementById('mc-footer-latency');

  if ($engine && stats?.version) $engine.textContent = `Engine ${stats.version}`;
  if ($cache && stats?.cacheHitRate != null) $cache.textContent = `Cache ${Math.round(stats.cacheHitRate * 100)}%`;
  if ($latency && stats?.avgLatency != null) $latency.textContent = `${Math.round(stats.avgLatency)}ms avg`;
}

// ═══════════════════════════════════════════════════════════════════
// System Status (simplified)
// ═══════════════════════════════════════════════════════════════════

function updateSystemStatus(text, color) {
  const $dot = document.getElementById('mc-health-dot');
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
  const dm = result.donde_match || 0;
  const name = result.restaurant?.name || '?';
  const query = result._query || '';
  const fitGrade = result._fitGrade || '';
  const blurbGrade = result._blurbGrade || '';
  const type = dm >= 70 ? 'success' : dm >= 50 ? 'warn' : 'error';
  cooLog(type, `"${query.slice(0, 35)}" → ${name} DM ${dm} | Fit: ${fitGrade} | Blurb: ${blurbGrade}`);
}

function appendSummaryRow(name, total, passed, avgDm, elapsed, celebrate, testType) {
  if (typeof cooLog !== 'function') return;
  const pct = total > 0 ? Math.round(passed / total * 100) : 0;
  cooLog('info', '────────────────────────────────');
  cooLog(pct >= 80 ? 'success' : 'warn',
    `${name}: ${passed}/${total} passed (${pct}%), avg DM ${avgDm}, ${elapsed}`);
}

function showTestProgress(name, current, total, avgDm) {
  // Minimal progress update in terminal
  if (typeof cooLog !== 'function') return;
  if (current === 1) cooLog('action', `${name}: running... (${total} queries)`);
}

// ═══════════════════════════════════════════════════════════════════
// Dark Pulse Animation
// ═══════════════════════════════════════════════════════════════════

function triggerDarkPulse() {
  const dp = document.getElementById('dark-pulse');
  if (!dp) return;
  dp.classList.add('mc-dark-pulse--flash');
  setTimeout(() => dp.classList.remove('mc-dark-pulse--flash'), 200);
}

// ═══════════════════════════════════════════════════════════════════
// Stubs for functions called by cc-analytics.js / cc-tests.js
// (removed features — these are safe no-ops)
// ═══════════════════════════════════════════════════════════════════

function switchTab() {}
function positionTabIndicator() {}
function updateGradeKpis() {}
function updateGradeHero(run) { updatePulseFromRun(run); }
function renderMorningBrief() { if (typeof cooBriefing === 'function') cooBriefing(); }
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
// Terminal Log (legacy — redirect to COO terminal)
// ═══════════════════════════════════════════════════════════════════

function termLog(type, msg) {
  if (typeof cooLog === 'function') cooLog(type === 'pass' ? 'success' : type === 'fail' ? 'error' : type, msg);
}

function openTerminal() {}
function closeTerminal() {}
function updateTicker() {}
