/**
 * DondeAI Mission Control — UI Rendering
 * Full-width dashboard with collapsible terminal drawer
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
      return `<div class="mc-grade__dist-bar" style="height:${h}px;background:${colors[g]}" title="${g}: ${count}"></div>`;
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

  // Store for COO terminal
  state.latestRun = run;
}

// ═══════════════════════════════════════════════════════════════════
// Sparkline Renderer
// ═══════════════════════════════════════════════════════════════════

function renderMiniSparkline(parentId, values) {
  const $parent = document.getElementById(parentId);
  if (!$parent) return;
  let $spark = $parent.querySelector('.mc-sparkline');
  if (!$spark) {
    $spark = document.createElement('div');
    $spark.className = 'mc-sparkline';
    $spark.style.cssText = 'display:flex;align-items:flex-end;gap:1px;height:16px;margin-top:4px;justify-content:center';
    $parent.appendChild($spark);
  }
  const max = Math.max(...values, 1);
  const recent = values.slice(0, 8).reverse(); // oldest to newest, max 8 bars
  $spark.innerHTML = recent.map((v, i) => {
    const h = Math.max(2, Math.round((v / max) * 16));
    const isLast = i === recent.length - 1;
    const color = v >= 80 ? 'var(--cc-green)' : v >= 60 ? 'var(--cc-amber)' : 'var(--cc-red)';
    return `<div style="width:3px;height:${h}px;background:${color};border-radius:1px;opacity:${isLast ? '1' : '0.4'}"></div>`;
  }).join('');
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

    return `<div class="mc-run-row mc-clickable" onclick="processCOOInput('compare')" title="Click to compare runs">
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
    return `<div class="mc-feed-item mc-clickable" onclick="testAndShowDetail('${escapeHtml(query.replace(/'/g, "\\'"))}')" title="Click to view details">
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
  // Handle both cc-tests.js format (dm, query, restaurant as string, scoreFitGrade, blurbGrade)
  // and raw API format (donde_match, restaurant as object, _query, _fitGrade, _blurbGrade)
  const dm = result.dm ?? result.donde_match ?? 0;
  const name = (typeof result.restaurant === 'string' ? result.restaurant : result.restaurant?.name) || '?';
  const query = result.query || result._query || '';
  const fitGrade = result.scoreFitGrade || result._fitGrade || '';
  const blurbGrade = result.blurbGrade || result._blurbGrade || '';
  const type = result.pass === true ? 'success' : result.pass === false ? (dm < 50 ? 'error' : 'warn') : (dm >= 70 ? 'success' : dm >= 50 ? 'warn' : 'error');
  cooLog(type, `"${query.slice(0, 35)}" → ${name} DM ${dm} | Fit: ${fitGrade} | Blurb: ${blurbGrade}`);
}

function appendSummaryRow(name, total, passed, avgDm, elapsed, celebrate, testType) {
  if (typeof cooLog !== 'function') return;
  const pct = total > 0 ? Math.round(passed / total * 100) : 0;
  cooLog('info', '────────────────────────────────');
  cooLog(pct >= 80 ? 'success' : 'warn',
    `${name}: ${passed}/${total} passed (${pct}%), avg DM ${avgDm}, ${elapsed}`);

  // Remove testing animation
  const board = document.querySelector('.mc-dashboard');
  if (board) board.classList.remove('mc-dashboard--testing');
}

function showTestProgress(name, current, total, avgDm) {
  if (typeof cooLog !== 'function') return;
  if (current === 1) {
    cooLog('action', name + ': running... (' + total + ' queries)');
    if (typeof openDrawerForTest === 'function') openDrawerForTest();
    const board = document.querySelector('.mc-dashboard');
    if (board) board.classList.add('mc-dashboard--testing');
  }
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
// Terminal Drawer
// ═══════════════════════════════════════════════════════════════════

function toggleDrawer() {
  const drawer = document.getElementById('mc-drawer');
  if (!drawer) return;
  const isOpen = drawer.classList.toggle('mc-drawer--open');
  const toggle = document.getElementById('mc-drawer-toggle');
  if (toggle) toggle.setAttribute('aria-expanded', isOpen);
  if (isOpen) {
    const badge = document.getElementById('mc-drawer-badge');
    if (badge) { badge.style.display = 'none'; badge.textContent = '0'; }
  }
}

function openDrawerForTest() {
  const drawer = document.getElementById('mc-drawer');
  if (drawer && !drawer.classList.contains('mc-drawer--open')) {
    drawer.classList.add('mc-drawer--open');
    const toggle = document.getElementById('mc-drawer-toggle');
    if (toggle) toggle.setAttribute('aria-expanded', 'true');
  }
}

// ═══════════════════════════════════════════════════════════════════
// Detail Panel (right side sheet)
// ═══════════════════════════════════════════════════════════════════

function openDetail(title, html) {
  const panel = document.getElementById('mc-detail');
  const titleEl = document.getElementById('mc-detail-title');
  const body = document.getElementById('mc-detail-body');
  if (!panel || !body) return;

  if (titleEl) titleEl.textContent = title;
  body.innerHTML = html;

  panel.classList.add('mc-detail--open');
  updateDashboardMargins();
}

function closeDetail() {
  const panel = document.getElementById('mc-detail');
  if (panel) panel.classList.remove('mc-detail--open');
  updateDashboardMargins();
}

function showQueryDetail(query, dm, restaurantName, sv9, recommendation, fitGrade, blurbGrade) {
  const factors = sv9 || {};

  function bar(label, val) {
    const pct = Math.round((val / 10) * 100);
    const color = val >= 7 ? 'var(--cc-green)' : val >= 5 ? 'var(--cc-amber)' : 'var(--cc-red)';
    return '<div class="mc-detail__factor"><span class="mc-detail__key" style="width:28px">' + label + '</span>' +
      '<div class="mc-detail__factor-bar"><div class="mc-detail__factor-fill" style="width:' + pct + '%;background:' + color + '"></div></div>' +
      '<span class="mc-detail__val">' + (Math.round(val * 10) / 10) + '</span></div>';
  }

  let html = '<div class="mc-detail__row"><span class="mc-detail__key">Restaurant</span><span class="mc-detail__val">' + escapeHtml(restaurantName || '?') + '</span></div>';
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
// Terminal Maximize (left panel mode)
// ═══════════════════════════════════════════════════════════════════

function toggleTerminalMax() {
  const drawer = document.getElementById('mc-drawer');
  if (!drawer) return;

  const isMax = drawer.classList.toggle('mc-drawer--maximized');

  // Ensure drawer body is visible when maximized
  if (isMax) {
    drawer.classList.add('mc-drawer--open');
    const toggle = document.getElementById('mc-drawer-toggle');
    if (toggle) toggle.setAttribute('aria-expanded', 'true');
    const badge = document.getElementById('mc-drawer-badge');
    if (badge) { badge.style.display = 'none'; badge.textContent = '0'; }
  }

  updateDashboardMargins();
}

// ═══════════════════════════════════════════════════════════════════
// Dashboard Margin Management
// ═══════════════════════════════════════════════════════════════════

function updateDashboardMargins() {
  const dashboard = document.querySelector('.mc-dashboard');
  if (!dashboard) return;

  const detailOpen = document.getElementById('mc-detail')?.classList.contains('mc-detail--open');
  const terminalMax = document.getElementById('mc-drawer')?.classList.contains('mc-drawer--maximized');

  dashboard.classList.remove('mc-dashboard--detail-open', 'mc-dashboard--terminal-max', 'mc-dashboard--both-panels');

  if (detailOpen && terminalMax) {
    dashboard.classList.add('mc-dashboard--both-panels');
  } else if (detailOpen) {
    dashboard.classList.add('mc-dashboard--detail-open');
  } else if (terminalMax) {
    dashboard.classList.add('mc-dashboard--terminal-max');
  }
}

// ═══════════════════════════════════════════════════════════════════
// Quick Test
// ═══════════════════════════════════════════════════════════════════

async function runQuickTest() {
  const $input = document.getElementById('quick-test-input');
  const $result = document.getElementById('quick-test-result');
  if (!$input || !$result) return;
  const query = $input.value.trim();
  if (!query) return;
  $result.innerHTML = '<span style="color:var(--cc-blue)">Testing...</span>';
  try {
    const resp = await callAPI(query);
    if (!resp.success) { $result.innerHTML = '<span class="rag-red">Error: ' + escapeHtml(resp.recommendation || 'unknown') + '</span>'; return; }
    const dm = resp.donde_match || 0;
    const name = resp.restaurant?.name || '?';
    const sv9 = resp.scoring_v9 || {};
    const fit = typeof computeScoreFitGrade === 'function' ? computeScoreFitGrade(query, resp) : null;
    const blurb = typeof computeBlurbQualityGrade === 'function' ? computeBlurbQualityGrade(query, resp) : null;
    $result.innerHTML = '<span class="' + ragClass(dm) + '">' + escapeHtml(name) + '</span> — DM <strong class="' + ragClass(dm) + '">' + dm + '</strong>' +
      (fit ? ' · Fit: <strong>' + fit.grade + '</strong>' : '') +
      (blurb ? ' · Blurb: <strong>' + blurb.grade + '</strong>' : '') +
      ' · Type: ' + (sv9.relevance_type || '-') +
      ' · F:' + r1(sv9.food||0) + ' V:' + r1(sv9.vibe||0) + ' S:' + r1(sv9.service||0) + ' R:' + r1(sv9.reputation||0) + ' C:' + r1(sv9.convenience||0);
    // Show detail panel
    showQueryDetail(query, dm, name, sv9, resp.recommendation, fit?.grade, blurb?.grade);
  } catch (e) { $result.innerHTML = '<span class="rag-red">' + escapeHtml(e.message) + '</span>'; }
}

async function testAndShowDetail(query) {
  // Populate quick test input for visibility
  const $input = document.getElementById('quick-test-input');
  if ($input) $input.value = query;

  const $result = document.getElementById('quick-test-result');
  if ($result) $result.innerHTML = '<span style="color:var(--cc-blue)">Loading details...</span>';

  try {
    const resp = await callAPI(query);
    if (!resp.success) { if ($result) $result.innerHTML = '<span class="rag-red">Error</span>'; return; }
    const dm = resp.donde_match || 0;
    const name = resp.restaurant?.name || '?';
    const sv9 = resp.scoring_v9 || {};
    const fit = typeof computeScoreFitGrade === 'function' ? computeScoreFitGrade(query, resp) : null;
    const blurb = typeof computeBlurbQualityGrade === 'function' ? computeBlurbQualityGrade(query, resp) : null;

    if ($result) {
      $result.innerHTML = '<span class="' + ragClass(dm) + '">' + escapeHtml(name) + '</span> — DM <strong class="' + ragClass(dm) + '">' + dm + '</strong>' +
        (fit ? ' · Fit: <strong>' + fit.grade + '</strong>' : '') +
        (blurb ? ' · Blurb: <strong>' + blurb.grade + '</strong>' : '');
    }

    showQueryDetail(query, dm, name, sv9, resp.recommendation, fit?.grade, blurb?.grade);
  } catch (e) {
    if ($result) $result.innerHTML = '<span class="rag-red">' + escapeHtml(e.message) + '</span>';
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
// Test Confirmation Modal
// ═══════════════════════════════════════════════════════════════════

let _pendingTestType = null;
let _pendingTestArgs = null;

const TEST_DESCRIPTIONS = {
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
    desc: 'Checks 10 restaurant blurbs for slop patterns (clichés, banned phrases). Quick mode uses regex; Deep mode calls Claude API.',
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

  const info = TEST_DESCRIPTIONS[type] || { icon: '&#9654;', title: type, desc: '', data: '' };
  const testDef = typeof TEST_TYPES !== 'undefined' ? TEST_TYPES[type] : null;
  const cost = typeof getTestCost === 'function' ? getTestCost(type) : '$0.00';
  const count = testDef?.count || '?';
  const time = testDef?.time || '?';
  const isLive = state.liveAPI;

  const $icon = document.getElementById('mc-confirm-icon');
  const $title = document.getElementById('mc-confirm-title');
  const $body = document.getElementById('mc-confirm-body');
  if ($icon) $icon.innerHTML = info.icon;
  if ($title) $title.textContent = info.title;

  let html = '';
  html += '<div class="mc-confirm__row"><span class="mc-confirm__key">Queries</span><span class="mc-confirm__val">' + count + '</span></div>';
  html += '<div class="mc-confirm__row"><span class="mc-confirm__key">Est. Time</span><span class="mc-confirm__val">' + time + '</span></div>';
  html += '<div class="mc-confirm__row"><span class="mc-confirm__key">API Mode</span><span class="mc-confirm__val ' + (isLive ? 'mc-confirm__val--red' : 'mc-confirm__val--green') + '">' + (isLive ? 'LIVE API' : 'Scoring Only') + '</span></div>';
  html += '<div class="mc-confirm__row"><span class="mc-confirm__key">Cost</span><span class="mc-confirm__val ' + (cost === '$0.00' ? 'mc-confirm__val--green' : 'mc-confirm__val--amber') + '">' + cost + '</span></div>';
  if (args) html += '<div class="mc-confirm__row"><span class="mc-confirm__key">Filter</span><span class="mc-confirm__val">' + escapeHtml(String(args)) + '</span></div>';
  html += '<div class="mc-confirm__row"><span class="mc-confirm__key">Data</span><span class="mc-confirm__val" style="text-align:right;max-width:220px;font-weight:400;font-size:10px">' + info.data + '</span></div>';
  html += '<div class="mc-confirm__desc">' + info.desc + '</div>';

  if ($body) $body.innerHTML = html;

  document.getElementById('mc-confirm-backdrop').style.display = '';
  document.getElementById('mc-confirm').style.display = '';
}

function cancelTestConfirm() {
  _pendingTestType = null;
  _pendingTestArgs = null;
  document.getElementById('mc-confirm-backdrop').style.display = 'none';
  document.getElementById('mc-confirm').style.display = 'none';
}

function executeConfirmedTest() {
  const type = _pendingTestType;
  const args = _pendingTestArgs;
  cancelTestConfirm();

  if (!type) return;
  if (typeof startTest !== 'function') { cooLog('error', 'Test runner not available.'); return; }

  if (type === 'category' && args) {
    state.selectedCategories = Array.isArray(args) ? args : [args];
    if (typeof runCategoryFocus === 'function') {
      openTerminal(); showTicker(); triggerDarkPulse();
      termLog('system', 'Starting Category Focus: ' + state.selectedCategories.join(', ') + '...');
      runCategoryFocus(state.selectedCategories);
    }
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
