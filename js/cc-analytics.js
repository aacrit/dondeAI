/**
 * DondeAI Command Center v2 — Analytics & Data Loading
 * Auth, Supabase client, gauntlet data, live production feed
 */

// ═══════════════════════════════════════════════════════════════════
// Auth
// ═══════════════════════════════════════════════════════════════════

async function checkAuth() {
  try {
    const { createClient } = await import('https://esm.sh/@supabase/supabase-js@2');
    const sb = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    const { data: { session } } = await sb.auth.getSession();
    if (session?.user?.email === ADMIN_EMAIL) {
      sbClient = sb;
      document.getElementById('main-content').style.display = '';
      document.getElementById('auth-gate').style.display = 'none';
      initDashboard();
    } else {
      showAccessDenied(sb, session);
    }
  } catch (e) {
    console.warn('Auth check failed:', e);
    // Still allow dashboard in dev mode
    try {
      const { createClient } = await import('https://esm.sh/@supabase/supabase-js@2');
      sbClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    } catch (_) {}
    initDashboard();
  }
}

function showAccessDenied(sb, session) {
  const gate = document.getElementById('auth-gate');
  const main = document.getElementById('main-content');
  const msg = document.getElementById('auth-message');
  const btn = document.getElementById('auth-sign-in');
  gate.style.display = 'block';
  main.style.display = 'none';
  msg.textContent = session
    ? `Signed in as ${session.user.email} — admin access required.`
    : 'Sign in with your Google account to continue.';
  btn.textContent = session ? 'Sign in with a different account' : 'Sign in with Google';
  btn.addEventListener('click', async () => {
    if (session) await sb.auth.signOut();
    await sb.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: window.location.href } });
  });
}

// ═══════════════════════════════════════════════════════════════════
// Dashboard Init (called after auth)
// ═══════════════════════════════════════════════════════════════════

async function initDashboard() {
  // Restore saved session state
  restoreSession();

  // Apply restored tab if different from default
  if (state.activeTab !== 'test' && typeof switchTab === 'function') {
    switchTab(state.activeTab);
  }

  // Load everything in parallel — allSettled prevents one failure from blocking dashboard
  const settled = await Promise.allSettled([
    loadInitData(),
    loadRunHistory(),
    loadLiveFeed(),
    pollPipelines(),
    loadIssues(),
    loadTrendData(),
  ]);
  const loadNames = ['initData', 'runHistory', 'liveFeed', 'pipelines', 'issues', 'trendData'];
  settled.forEach((result, i) => {
    if (result.status === 'rejected') {
      console.warn(`Dashboard load failed [${loadNames[i]}]:`, result.reason);
    }
  });

  // Post-load analytics
  checkApiHealth();
  startLivePolling();
  updateSmartSuggestion();
  if (typeof startFreshnessTicker === 'function') startFreshnessTicker();
  if (typeof loadHeatmapData === 'function') loadHeatmapData();
  if (typeof computePerfBaseline === 'function') computePerfBaseline();

  // Dashboard overhaul: render new components
  if (typeof renderActionCenter === 'function') renderActionCenter();
  if (typeof renderTestVsProdStrip === 'function') renderTestVsProdStrip();
  if (typeof updateKpiSparklines === 'function') updateKpiSparklines();
  if (typeof initKpiClickHandlers === 'function') initKpiClickHandlers();

  // Wave 2: render personalized components
  if (typeof renderWave2Components === 'function') renderWave2Components();
  if (typeof initQuickActionsScroll === 'function') initQuickActionsScroll();
  if (typeof initWave2Keyboard === 'function') initWave2Keyboard();

  // Anomaly detection after trend data is loaded
  if (state.latestRun && typeof checkForAnomalies === 'function') {
    checkForAnomalies(state.latestRun);
  }

  // Executive briefing auto-generation
  const briefing = generateExecutiveBriefing();
  const briefEl = document.getElementById('executive-briefing');
  if (briefEl && briefing) {
    briefEl.style.display = '';
    briefEl.innerHTML = `<div class="cc-briefing-text">${briefing}</div>`;
  }

  // Premium Overhaul: Morning Brief, Header Action, Tab Badges, Impact Sim, SLA
  if (typeof renderMorningBrief === 'function') renderMorningBrief();
  if (typeof updateHeaderAction === 'function') updateHeaderAction();
  if (typeof updateTabBadges === 'function') updateTabBadges();
  if (typeof renderImpactSimulator === 'function') renderImpactSimulator();
  if (typeof evaluateSLAs === 'function') evaluateSLAs();

  // Restore auto-refresh if it was enabled
  if (state.autoRefresh && typeof startAutoRefresh === 'function') {
    startAutoRefresh();
    const btn = document.getElementById('auto-refresh-toggle');
    if (btn) btn.classList.add('cc-auto-refresh__toggle--active');
  }
}

// ═══════════════════════════════════════════════════════════════════
// Executive Briefing
// ═══════════════════════════════════════════════════════════════════

function generateExecutiveBriefing() {
  const run = state.latestRun;
  if (!run) return null;

  const avgDm = Number(run.avg_dm) || 0;
  const avgFit = Number(run.avg_score_fit) || avgDm;
  const avgBlurb = Number(run.avg_blurb_quality) || avgDm;
  const engineScore = (avgDm * 0.4) + (avgFit * 0.3) + (avgBlurb * 0.3);

  let grade;
  if (engineScore >= 93) grade = 'A+';
  else if (engineScore >= 90) grade = 'A';
  else if (engineScore >= 87) grade = 'B+';
  else if (engineScore >= 83) grade = 'B';
  else if (engineScore >= 80) grade = 'B-';
  else if (engineScore >= 73) grade = 'C';
  else if (engineScore >= 60) grade = 'D';
  else grade = 'F';

  // Trend from last 3 runs
  const trend = state.trendData || [];
  let trendWord = 'stable';
  if (trend.length >= 3) {
    const recent3 = trend.slice(0, 3).map(r => Number(r.avg_dm));
    const avg3 = recent3.reduce((a, b) => a + b, 0) / recent3.length;
    if (avg3 > avgDm + 2) trendWord = 'declining';
    else if (avg3 < avgDm - 2) trendWord = 'improving';
  }

  // Issue counts
  const issues = state.issues || [];
  const p0Count = issues.filter(i => i.severity === 'P0' && (!i.status || i.status === 'open')).length;
  const p1Count = issues.filter(i => i.severity === 'P1' && (!i.status || i.status === 'open')).length;

  // Status sentence
  const passRate = run.grade_pass_count != null && run.total > 0
    ? Math.round(run.grade_pass_count / run.total * 100)
    : (run.total > 0 ? Math.round(run.passed_60 / run.total * 100) : 0);
  const status = `Engine grade <strong>${grade}</strong> (${Math.round(engineScore)}) with ${passRate}% pass rate across ${run.total} queries. Trend is ${trendWord}.`;

  // Risk sentence
  let risk;
  if (p0Count > 0) risk = `<span class="rag-red">${p0Count} critical issue${p0Count > 1 ? 's' : ''}</span> require immediate attention.`;
  else if (p1Count > 0) risk = `${p1Count} important issue${p1Count > 1 ? 's' : ''} to review, no critical blockers.`;
  else risk = 'No open issues detected. System is healthy.';

  // Action sentence
  let action;
  if (p0Count > 0) action = 'Recommended action: fix P0 issues, then run a regression guard.';
  else if (trendWord === 'declining') action = 'Recommended action: run a broad scan to identify emerging gaps.';
  else if (grade.startsWith('A')) action = 'System performing well. Consider running edge cases for coverage.';
  else action = 'Recommended action: run a category focus on the weakest signal type.';

  return `${status} ${risk} ${action}`;
}

// ═══════════════════════════════════════════════════════════════════
// Trend Data (for sparklines & anomaly detection)
// ═══════════════════════════════════════════════════════════════════

async function loadTrendData() {
  if (!sbClient) return;
  try {
    const { data: runs } = await sbClient
      .from('gauntlet_runs')
      .select('run_id, avg_dm, passed_60, gap_count, total, created_at, avg_response_ms, mode, avg_score_fit, avg_blurb_quality, grade_pass_count')
      .order('created_at', { ascending: false })
      .limit(20);

    state.trendData = runs || [];
  } catch (e) {
    console.warn('Failed to load trend data:', e);
  }
}

// ═══════════════════════════════════════════════════════════════════
// Init Data (Pulse Cards + DB Stats)
// ═══════════════════════════════════════════════════════════════════

async function loadInitData() {
  if (!sbClient) return;

  try {
    const [runsRes, totalRes, enrichedRes, tagsRes, queriesRes, occasionRes] = await Promise.all([
      // Latest gauntlet run
      sbClient.from('gauntlet_runs')
        .select('run_id, avg_dm, passed_60, gap_count, total, created_at, mode, delta_avg_dm, avg_score_fit, avg_blurb_quality, grade_pass_count, grade_distribution')
        .order('created_at', { ascending: false })
        .limit(1),
      // Total active restaurants
      sbClient.from('restaurants').select('id', { count: 'exact', head: true }).eq('is_active', true),
      // Enriched restaurants (have noise_level as proxy)
      sbClient.from('restaurants').select('id', { count: 'exact', head: true }).eq('is_active', true).not('noise_level', 'is', null),
      // Tag count
      sbClient.from('tags').select('id', { count: 'exact', head: true }),
      // Today's user queries (Chicago timezone)
      sbClient.from('user_queries')
        .select('id, donde_match, created_at')
        .gte('created_at', chicagoTodayStart())
        .order('created_at', { ascending: false }),
      // Occasion scores count
      sbClient.from('occasion_scores').select('id', { count: 'exact', head: true }),
    ]);

    const latestRun = runsRes.data?.[0] || null;
    state.latestRun = latestRun;

    const totalCount = totalRes.count || 0;
    const enrichedCount = enrichedRes.count || 0;
    const tagCount = tagsRes.count || 0;
    const occasionCount = occasionRes.count || 0;
    if (queriesRes.error) console.error('User queries error:', queriesRes.error.message, queriesRes.error.hint);
    const todayQueries = queriesRes.data || [];
    const todayCount = todayQueries.length;
    const todayAvgDm = todayCount > 0
      ? todayQueries.reduce((s, q) => s + (q.donde_match || 0), 0) / todayCount
      : 0;
    const lowScoreCount = todayQueries.filter(q => (q.donde_match || 0) < 60).length;

    // Update pulse cards from latest run
    if (latestRun && typeof updatePulseFromRun === 'function') {
      updatePulseFromRun(latestRun);
    }

    // Update live KPIs (basic stats from init — full stats come from loadLiveFeed)
    updateLiveKPIs({ searches: todayCount, avgDm: todayAvgDm, lowScores: lowScoreCount,
      passRate: todayCount > 0 ? ((todayCount - lowScoreCount) / todayCount * 100) : 0,
      fallbackRate: 0, p50Response: 0, p95Response: 0, satisfactionPct: null,
      unmatchedRate: 0, scoreDist: [0, 0, 0, 0] });

    // Update DB stats
    updateDbOverview(totalCount, enrichedCount, tagCount, occasionCount);

  } catch (e) {
    console.warn('Failed to load init data:', e);
  }
}

// ═══════════════════════════════════════════════════════════════════
// Run History (Test tab)
// ═══════════════════════════════════════════════════════════════════

async function loadRunHistory() {
  if (!sbClient) return;

  try {
    const { data: runs } = await sbClient
      .from('gauntlet_runs')
      .select('run_id, total, gap_count, avg_dm, passed_60, created_at, mode, dataset_size, delta_avg_dm, avg_score_fit, avg_blurb_quality, grade_pass_count, grade_distribution')
      .order('created_at', { ascending: false })
      .limit(10);

    state.runHistory = runs || [];
    renderRunHistory(state.runHistory);
  } catch (e) {
    console.warn('Failed to load run history:', e);
  }
}

// ═══════════════════════════════════════════════════════════════════
// Live Production Feed
// ═══════════════════════════════════════════════════════════════════

async function loadLiveFeed() {
  if (!sbClient) return;

  try {
    // Load ALL user queries with restaurant name via FK join, excluding test data
    let { data: queries, error } = await sbClient
      .from('user_queries')
      .select('id, special_request, donde_match, created_at, recommended_restaurant_id, source, was_fallback, response_time_ms, exclude_count, unmatched_keywords, claude_relevance_score, occasion, price_level, recommendation_text, score_fit_score, score_fit_grade, blurb_quality_score, blurb_quality_grade, restaurants!recommended_restaurant_id(name)')
      .neq('source', 'command-center')
      .order('created_at', { ascending: false });

    // Fallback: if FK join fails (or columns don't exist yet), load minimal
    if (error) {
      console.warn('Live feed FK join failed, falling back:', error.message);
      const fallback = await sbClient
        .from('user_queries')
        .select('id, special_request, donde_match, created_at, was_fallback, response_time_ms')
        .order('created_at', { ascending: false });
      queries = fallback.data;
      if (fallback.error) console.error('Live feed fallback also failed:', fallback.error.message, fallback.error.hint);
    }

    if (queries && queries.length > 0) {
      state.liveFeed = queries;
      state.liveLastId = queries[0].id;
      state.lastDataRefresh = Date.now();
      applyLiveFilter();
    } else {
      state.liveFeed = [];
      state.lastDataRefresh = Date.now();
      applyLiveFilter();
    }
  } catch (e) {
    console.warn('Failed to load live feed:', e);
  }
}

/** Filter live feed by state.liveFilter + advanced filters and re-render */
function applyLiveFilter() {
  let filtered = filterQueriesByPeriod(state.liveFeed, state.liveFilter);

  // Advanced filters
  const f = state.liveFilters || {};
  if (f.scoreRange === 'high') filtered = filtered.filter(q => (q.donde_match || 0) >= 80);
  else if (f.scoreRange === 'mid') filtered = filtered.filter(q => (q.donde_match || 0) >= 60 && (q.donde_match || 0) < 80);
  else if (f.scoreRange === 'low') filtered = filtered.filter(q => (q.donde_match || 0) < 60);

  if (f.fallback === 'yes') filtered = filtered.filter(q => q.was_fallback);
  else if (f.fallback === 'no') filtered = filtered.filter(q => !q.was_fallback);

  if (f.feedback === 'liked') filtered = filtered.filter(q => q.claude_relevance_score >= 1);
  else if (f.feedback === 'disliked') filtered = filtered.filter(q => q.claude_relevance_score === 0);
  else if (f.feedback === 'none') filtered = filtered.filter(q => q.claude_relevance_score == null);

  renderLiveFeed(filtered);
  updateLiveKPIsFromQueries(filtered);
  if (typeof renderLiveIssues === 'function') renderLiveIssues(filtered);
  if (typeof updateKpiSparklines === 'function') updateKpiSparklines();
}

/** Set filter and re-render (called from UI) */
function setLiveFilter(period) {
  state.liveFilter = period;
  applyLiveFilter();

  // Update active button
  document.querySelectorAll('.cc-live-filter__btn').forEach(b => {
    b.classList.toggle('cc-live-filter__btn--active', b.dataset.period === period);
  });
}

/** Get start of "today" in Chicago Central Time as ISO string (UTC) */
function chicagoTodayStart() {
  // Get today's date in Chicago timezone (handles DST automatically)
  const chicagoDate = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Chicago', year: 'numeric', month: '2-digit', day: '2-digit'
  }).format(new Date()); // "YYYY-MM-DD"
  // Create midnight in Chicago, convert to UTC
  // Parse as local then adjust — or use a reliable method:
  // Midnight Chicago = chicagoDate + T00:00:00 in CT
  // CT offset: CST=-6, CDT=-5. Detect by comparing two known dates.
  const midnightLocal = new Date(`${chicagoDate}T00:00:00`);
  // Get the actual Chicago offset by checking what hour UTC noon is in Chicago
  const noon = new Date(`${chicagoDate}T12:00:00Z`);
  const chicagoHour = new Date(noon.toLocaleString('en-US', { timeZone: 'America/Chicago' })).getHours();
  const offsetHours = 12 - chicagoHour; // 6 for CST, 5 for CDT
  // Midnight Chicago in UTC = chicagoDate T00:00:00 + offsetHours
  return `${chicagoDate}T${String(offsetHours).padStart(2, '0')}:00:00.000Z`;
}

function filterQueriesByPeriod(queries, period) {
  if (!queries || period === 'all') return queries || [];
  let cutoff;
  if (period === 'today') {
    cutoff = chicagoTodayStart();
  } else if (period === '7d') {
    cutoff = new Date(Date.now() - 7 * 86400000).toISOString();
  }
  return queries.filter(q => q.created_at >= cutoff);
}

function updateLiveKPIsFromQueries(queries) {
  const count = queries.length;
  if (count === 0) {
    updateLiveKPIs({ searches: 0, avgDm: 0, passRate: 0, fallbackRate: 0,
      p50Response: 0, p95Response: 0, satisfactionPct: null, unmatchedRate: 0,
      scoreDist: [0, 0, 0, 0], lowScores: 0 });
    return;
  }

  const avgDm = queries.reduce((s, q) => s + (q.donde_match || 0), 0) / count;
  const lowScores = queries.filter(q => (q.donde_match || 0) < 60).length;
  const passRate = ((count - lowScores) / count * 100);

  // Response time percentiles
  const times = queries.map(q => q.response_time_ms).filter(Boolean).sort((a, b) => a - b);
  const p50Response = times.length > 0 ? times[Math.floor(times.length * 0.50)] : 0;
  const p95Response = times.length > 0 ? times[Math.floor(times.length * 0.95)] : 0;

  // Fallback rate
  const fallbackRate = (queries.filter(q => q.was_fallback).length / count * 100);

  // User satisfaction
  const withFeedback = queries.filter(q => q.claude_relevance_score != null);
  const satisfied = withFeedback.filter(q => q.claude_relevance_score >= 1).length;
  const satisfactionPct = withFeedback.length > 0 ? (satisfied / withFeedback.length * 100) : null;

  // Unmatched keywords rate
  const unmatchedRate = (queries.filter(q => q.unmatched_keywords && q.unmatched_keywords.length > 0).length / count * 100);

  // Score distribution: [80+, 60-79, 40-59, <40]
  const scoreDist = [
    queries.filter(q => (q.donde_match || 0) >= 80).length,
    queries.filter(q => (q.donde_match || 0) >= 60 && (q.donde_match || 0) < 80).length,
    queries.filter(q => (q.donde_match || 0) >= 40 && (q.donde_match || 0) < 60).length,
    queries.filter(q => (q.donde_match || 0) < 40).length,
  ];

  // Grade stats
  const withFit = queries.filter(q => q.score_fit_score != null);
  const withBlurb = queries.filter(q => q.blurb_quality_score != null);
  const avgFit = withFit.length > 0 ? withFit.reduce((s, q) => s + q.score_fit_score, 0) / withFit.length : null;
  const avgBlurb = withBlurb.length > 0 ? withBlurb.reduce((s, q) => s + q.blurb_quality_score, 0) / withBlurb.length : null;
  const gradePassCount = queries.filter(q =>
    (q.donde_match || 0) >= 70 && (q.score_fit_score || 0) >= 80 && (q.blurb_quality_score || 0) >= 80
  ).length;
  const gradePassRate = withFit.length > 0 ? (gradePassCount / withFit.length * 100) : null;
  // Grade issues: below B (87) on either score fit or blurb quality
  const gradeIssueCount = queries.filter(q =>
    (q.score_fit_score != null && q.score_fit_score < 83) ||
    (q.blurb_quality_score != null && q.blurb_quality_score < 83)
  ).length;

  updateLiveKPIs({ searches: count, avgDm, passRate, fallbackRate,
    p50Response, p95Response, satisfactionPct, unmatchedRate,
    scoreDist, lowScores, avgFit, avgBlurb, gradePassRate, gradeIssueCount });
}

async function pollLiveFeed() {
  if (!sbClient) return;

  try {
    let query = sbClient
      .from('user_queries')
      .select('id, special_request, donde_match, created_at, recommended_restaurant_id, source, was_fallback, response_time_ms, exclude_count, unmatched_keywords, claude_relevance_score, occasion, price_level, recommendation_text, score_fit_score, score_fit_grade, blurb_quality_score, blurb_quality_grade, restaurants!recommended_restaurant_id(name)')
      .neq('source', 'command-center')
      .order('created_at', { ascending: false })
      .limit(20);

    // Only fetch new entries since last known ID
    if (state.liveLastId) {
      query = query.gt('id', state.liveLastId);
    }

    const { data: newQueries, error } = await query;
    if (error) console.error('Live poll error:', error.message);

    if (newQueries && newQueries.length > 0) {
      state.liveLastId = newQueries[0].id;
      // Deduplicate by ID and re-sort latest first
      const existingIds = new Set(state.liveFeed.map(q => q.id));
      const uniqueNew = newQueries.filter(q => !existingIds.has(q.id));
      state.liveFeed = [...uniqueNew, ...state.liveFeed]
        .sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
      applyLiveFilter();
    }
  } catch (e) {
    console.warn('Live feed poll failed:', e);
  }
}

function startLivePolling() {
  if (state.livePollTimer) return;
  state.livePolling = true;
  state.livePollTimer = setInterval(pollLiveFeed, LIVE_POLL_INTERVAL);
}

// ═══════════════════════════════════════════════════════════════════
// API Health Check
// ═══════════════════════════════════════════════════════════════════

async function checkApiHealth() {
  try {
    const start = Date.now();
    const resp = await fetch(API_BASE, { method: 'GET' });
    const latency = Date.now() - start;
    const data = await resp.json();

    const versionEl = document.getElementById('api-version');
    const latencyEl = document.getElementById('api-latency');
    const statusEl = document.getElementById('api-status');

    if (versionEl) versionEl.textContent = `Engine: V${data.version || '??'}`;
    if (latencyEl) latencyEl.textContent = `Latency: ${latency}ms`;
    // Update the live KPI response time
    const rtEl = document.getElementById('live-response-time');
    if (rtEl) rtEl.textContent = `${latency}ms`;
    if (statusEl) {
      statusEl.textContent = `Status: ${data.status || 'unknown'}`;
      statusEl.className = data.status === 'ok' ? 'cc-api-ok' : 'cc-api-warn';
    }

    updateSystemStatus(data.status === 'ok' ? 'Online' : 'Degraded', data.status === 'ok' ? 'green' : 'amber');
  } catch (e) {
    updateSystemStatus('Offline', 'red');
    const statusEl = document.getElementById('api-status');
    if (statusEl) statusEl.textContent = 'Status: unreachable';
  }
}

// ═══════════════════════════════════════════════════════════════════
// Smart Suggestion
// ═══════════════════════════════════════════════════════════════════

function updateSmartSuggestion() {
  const strip = document.getElementById('suggest-strip');
  const text = document.getElementById('suggest-text');
  const btn = document.getElementById('suggest-btn');
  if (!strip || !text || !btn) return;

  const run = state.latestRun;

  if (!run) {
    text.textContent = 'No tests run yet.';
    btn.textContent = 'Run Broad Scan';
    btn.onclick = () => startTest('broad');
    strip.style.display = 'flex';
    return;
  }

  const hoursSinceRun = (Date.now() - new Date(run.created_at).getTime()) / 3600000;

  if (run.gap_count > 5) {
    text.textContent = `${run.gap_count} low-score queries detected in last run.`;
    btn.textContent = 'Run Regression Guard';
    btn.onclick = () => startTest('regression');
    btn.style.display = '';
    strip.style.display = 'flex';
  } else if (hoursSinceRun > 24) {
    text.textContent = `No tests run in ${Math.floor(hoursSinceRun)}h.`;
    btn.textContent = 'Run Broad Scan';
    btn.onclick = () => startTest('broad');
    btn.style.display = '';
    strip.style.display = 'flex';
  } else if (run.gap_count > 0) {
    text.textContent = `${run.gap_count} issue${run.gap_count > 1 ? 's' : ''} found. ${pct(run.passed_60, run.total)}% pass rate.`;
    btn.textContent = 'View Issues';
    btn.onclick = () => switchTab('issues');
    btn.style.display = '';
    strip.style.display = 'flex';
  } else {
    text.textContent = `All clear. ${pct(run.passed_60, run.total)}% pass rate, avg DM ${r1(run.avg_dm)}.`;
    btn.textContent = 'Run Broad Scan';
    btn.onclick = () => startTest('broad');
    btn.style.display = '';
    strip.style.display = 'flex';
  }
}

function dismissSuggestion() {
  const strip = document.getElementById('suggest-strip');
  if (strip) strip.style.display = 'none';
}

// ═══════════════════════════════════════════════════════════════════
// Issues Triage (Issues tab)
// ═══════════════════════════════════════════════════════════════════

const ISSUE_SEVERITY = {
  P0: { label: 'P0', class: 'cc-issues-badge--p0' },
  P1: { label: 'P1', class: 'cc-issues-badge--p1' },
  P2: { label: 'P2', class: 'cc-issues-badge--p2' },
};

function classifySeverity(dm, gapType) {
  if (dm < 40 || gapType === 'intent') return 'P0';
  if (dm < 60 || gapType === 'scoring' || gapType === 'relevance_ceiling') return 'P1';
  return 'P2';
}

function gapTypeFixAction(gapType) {
  switch (gapType) {
    case 'intent': return 'Add keyword to intent-classifier-v5.ts dictionaries';
    case 'scoring': return 'Adjust scoring-v9.ts weight profiles for the weak factor';
    case 'relevance_ceiling': return 'Review RELEVANCE_FLOORS in scoring-v9.ts';
    case 'contract': return 'Fix response structure in response-builder-v9.ts';
    case 'regression': return 'Investigate scoring regression vs baseline';
    case 'cliché': return 'Fix blurb template in prompts-v5.ts';
    case 'missing': return 'Run enrichment pipeline for missing data';
    case 'grade_fit': return 'Review relevance/factor alignment in scoring-v9.ts';
    case 'grade_blurb': return 'Fix blurb generation in prompts-v5.ts (slop, voice, specificity)';
    case 'grade_both': return 'Fix scoring-v9.ts weights AND prompts-v5.ts blurb template';
    default: return 'Investigate query scoring';
  }
}

async function loadIssues() {
  if (!sbClient) return;

  try {
    // Get latest 2 run_ids for trend comparison
    const { data: recentRuns } = await sbClient.from('gauntlet_runs')
      .select('run_id')
      .order('created_at', { ascending: false })
      .limit(2);
    const latestRunId = recentRuns?.[0]?.run_id;
    const prevRunId = recentRuns?.[1]?.run_id;

    // Parallel fetch: test gaps (latest run only) + prod low scores + historical data + previous run results
    const gapsQuery = sbClient.from('gauntlet_results')
      .select('query, donde_match, gap_type, gap_severity, category, restaurant_name, food, vibe, service, reputation, convenience, relevance_type, run_id, score_fit_score, score_fit_grade, blurb_quality_score, blurb_quality_grade')
      .not('gap_type', 'is', null)
      .order('donde_match', { ascending: true })
      .limit(100);
    if (latestRunId) gapsQuery.eq('run_id', latestRunId);

    // Test results with grade issues (below B) — separate from gap_type issues
    const testGradeQuery = latestRunId
      ? sbClient.from('gauntlet_results')
          .select('query, donde_match, category, restaurant_name, food, vibe, service, reputation, convenience, relevance_type, run_id, score_fit_score, score_fit_grade, blurb_quality_score, blurb_quality_grade')
          .eq('run_id', latestRunId)
          .not('score_fit_grade', 'is', null)
          .limit(200)
      : Promise.resolve({ data: null });

    // Previous run query for trend deltas
    const prevQuery = prevRunId
      ? sbClient.from('gauntlet_results')
          .select('query, donde_match')
          .eq('run_id', prevRunId)
          .limit(200)
      : Promise.resolve({ data: null });

    const [gapsRes, prodRes, histRes, prevRes, gradeIssuesRes, testGradeRes] = await Promise.all([
      gapsQuery,

      // Production low-score queries
      sbClient.from('user_queries')
        .select('id, special_request, donde_match, created_at, response_time_ms, was_fallback, restaurants!recommended_restaurant_id(name)')
        .lt('donde_match', 60)
        .not('donde_match', 'is', null)
        .order('created_at', { ascending: false })
        .limit(50),

      // Historical gap analysis
      fetch('data/gap-details.json').then(r => r.ok ? r.json() : null).catch(() => null),

      prevQuery,

      // Production grade issues: queries where score fit or blurb quality < B (83)
      sbClient.from('user_queries')
        .select('id, special_request, donde_match, created_at, response_time_ms, was_fallback, score_fit_score, score_fit_grade, blurb_quality_score, blurb_quality_grade, recommendation_text, restaurants!recommended_restaurant_id(name)')
        .neq('source', 'command-center')
        .not('score_fit_grade', 'is', null)
        .order('created_at', { ascending: false })
        .limit(200),

      testGradeQuery,
    ]);

    // Build previous run lookup for trend computation
    const prevDmMap = new Map();
    if (prevRes.data) {
      for (const r of prevRes.data) {
        prevDmMap.set(r.query.toLowerCase().trim(), r.donde_match);
      }
    }

    const issues = [];
    const seen = new Set();

    // Process test gaps
    if (gapsRes.data) {
      for (const g of gapsRes.data) {
        const key = g.query.toLowerCase().trim();
        if (seen.has(key)) continue;
        seen.add(key);
        const severity = g.gap_severity || classifySeverity(g.donde_match, g.gap_type);
        const prevDm = prevDmMap.get(key);
        issues.push({
          query: g.query,
          dm: g.donde_match,
          gapType: g.gap_type,
          severity,
          category: g.category || 'unknown',
          restaurant: g.restaurant_name || '--',
          source: 'test',
          sourceDetail: g.run_id,
          factors: { food: g.food, vibe: g.vibe, service: g.service, reputation: g.reputation, convenience: g.convenience },
          relevanceType: g.relevance_type,
          fixAction: gapTypeFixAction(g.gap_type),
          prevDm: prevDm != null ? prevDm : null,
          deltaDm: prevDm != null ? g.donde_match - prevDm : null,
          isNew: prevDm == null && prevRunId != null,
        });
      }
    }

    // Process test grade issues (below B on score fit or blurb quality)
    if (testGradeRes?.data) {
      for (const g of testGradeRes.data) {
        const key = g.query.toLowerCase().trim();
        const fitBelow = g.score_fit_score != null && g.score_fit_score < 83;
        const blurbBelow = g.blurb_quality_score != null && g.blurb_quality_score < 83;
        if (!fitBelow && !blurbBelow) continue;

        // Enrich existing test issues with grade data
        const existing = issues.find(i => i.query.toLowerCase().trim() === key);
        if (existing) {
          existing.scoreFitGrade = g.score_fit_grade;
          existing.scoreFitScore = g.score_fit_score;
          existing.blurbQualityGrade = g.blurb_quality_grade;
          existing.blurbQualityScore = g.blurb_quality_score;
          continue;
        }
        if (seen.has(key)) continue;
        seen.add(key);

        let gapType, fixAction;
        if (fitBelow && blurbBelow) {
          gapType = 'grade_both';
          fixAction = `Score Fit ${g.score_fit_grade} (${g.score_fit_score}) + Blurb ${g.blurb_quality_grade} (${g.blurb_quality_score}): Fix scoring + blurb prompt`;
        } else if (fitBelow) {
          gapType = 'grade_fit';
          fixAction = `Score Fit ${g.score_fit_grade} (${g.score_fit_score}): Review relevance/factor alignment`;
        } else {
          gapType = 'grade_blurb';
          fixAction = `Blurb Quality ${g.blurb_quality_grade} (${g.blurb_quality_score}): Fix blurb generation`;
        }

        const severity = (g.score_fit_score || 100) < 73 || (g.blurb_quality_score || 100) < 73 ? 'P0' : 'P1';
        issues.push({
          query: g.query,
          dm: g.donde_match || 0,
          gapType,
          severity,
          category: g.category || '--',
          restaurant: g.restaurant_name || '--',
          source: 'test',
          sourceDetail: g.run_id,
          factors: { food: g.food, vibe: g.vibe, service: g.service, reputation: g.reputation, convenience: g.convenience },
          relevanceType: g.relevance_type,
          fixAction,
          prevDm: null,
          deltaDm: null,
          isNew: false,
          scoreFitGrade: g.score_fit_grade,
          scoreFitScore: g.score_fit_score,
          blurbQualityGrade: g.blurb_quality_grade,
          blurbQualityScore: g.blurb_quality_score,
        });
      }
    }

    // Process production low scores
    if (prodRes.data) {
      for (const q of prodRes.data) {
        const key = (q.special_request || '').toLowerCase().trim();
        if (!key || seen.has(key)) continue;
        seen.add(key);
        const severity = classifySeverity(q.donde_match, null);
        issues.push({
          query: q.special_request,
          dm: q.donde_match,
          gapType: 'low_score',
          severity,
          category: '--',
          restaurant: q.restaurants?.name || '--',
          source: 'prod',
          sourceDetail: fmtTime(q.created_at),
          factors: null,
          relevanceType: null,
          fixAction: 'Investigate low production score',
          responseTime: q.response_time_ms,
          wasFallback: q.was_fallback,
          prevDm: null,
          deltaDm: null,
          isNew: false,
        });
      }
    }

    // Process production grade issues (score fit or blurb quality below B)
    if (gradeIssuesRes.data) {
      for (const q of gradeIssuesRes.data) {
        const key = (q.special_request || '').toLowerCase().trim();
        if (!key || seen.has(key)) continue;
        const fitBelow = q.score_fit_score != null && q.score_fit_score < 83;
        const blurbBelow = q.blurb_quality_score != null && q.blurb_quality_score < 83;
        if (!fitBelow && !blurbBelow) continue;
        seen.add(key);

        // Determine gap type and fix action based on which grade failed
        let gapType, fixAction;
        if (fitBelow && blurbBelow) {
          gapType = 'grade_both';
          fixAction = `Score Fit ${q.score_fit_grade} (${q.score_fit_score}) + Blurb ${q.blurb_quality_grade} (${q.blurb_quality_score}): Fix scoring weights in scoring-v9.ts AND blurb prompt in prompts-v5.ts`;
        } else if (fitBelow) {
          gapType = 'grade_fit';
          fixAction = `Score Fit ${q.score_fit_grade} (${q.score_fit_score}): Review relevance/factor alignment in scoring-v9.ts for this query type`;
        } else {
          gapType = 'grade_blurb';
          fixAction = `Blurb Quality ${q.blurb_quality_grade} (${q.blurb_quality_score}): Fix blurb generation in prompts-v5.ts (check slop, voice, specificity)`;
        }

        const severity = (q.score_fit_score || 100) < 73 || (q.blurb_quality_score || 100) < 73 ? 'P0' : 'P1';
        issues.push({
          query: q.special_request,
          dm: q.donde_match || 0,
          gapType,
          severity,
          category: '--',
          restaurant: q.restaurants?.name || '--',
          source: 'prod',
          sourceDetail: `${fmtTime(q.created_at)} F:${q.score_fit_grade || '--'} B:${q.blurb_quality_grade || '--'}`,
          factors: null,
          relevanceType: null,
          fixAction,
          responseTime: q.response_time_ms,
          wasFallback: q.was_fallback,
          prevDm: null,
          deltaDm: null,
          isNew: false,
          scoreFitGrade: q.score_fit_grade,
          scoreFitScore: q.score_fit_score,
          blurbQualityGrade: q.blurb_quality_grade,
          blurbQualityScore: q.blurb_quality_score,
        });
      }
    }

    // Enrich from historical gap-details.json
    if (histRes?.gaps) {
      const histMap = new Map(histRes.gaps.map(g => [g.query.toLowerCase().trim(), g]));
      for (const issue of issues) {
        const hist = histMap.get(issue.query.toLowerCase().trim());
        if (hist) {
          if (hist.fix_action) issue.fixAction = hist.fix_action;
          if (hist.impact_score) issue.impactScore = hist.impact_score;
          if (hist.gap_severity && !issue.severity) issue.severity = hist.gap_severity;
        }
      }
    }

    // Sort: P0 first, then P1, then P2; within each, by DM ascending
    const sevOrder = { P0: 0, P1: 1, P2: 2 };
    issues.sort((a, b) => (sevOrder[a.severity] || 9) - (sevOrder[b.severity] || 9) || a.dm - b.dm);

    // Restore saved statuses from localStorage
    const savedStatuses = typeof loadIssueStatuses === 'function' ? loadIssueStatuses() : {};
    for (const issue of issues) {
      const key = issue.query.toLowerCase().trim();
      const saved = savedStatuses[key];
      if (saved) {
        issue.status = saved.status;
        issue.retestDm = saved.retestDm;
        // Update grade data if retest captured it
        if (saved.scoreFitScore != null) issue.scoreFitScore = saved.scoreFitScore;
        if (saved.scoreFitGrade) issue.scoreFitGrade = saved.scoreFitGrade;
        if (saved.blurbQualityScore != null) issue.blurbQualityScore = saved.blurbQualityScore;
        if (saved.blurbQualityGrade) issue.blurbQualityGrade = saved.blurbQualityGrade;
      } else {
        issue.status = 'open';
      }
    }

    // Restore resolved/improved issues that are no longer in DB
    // (e.g., issue was retested and passed — no longer a gap in latest run)
    const issueKeys = new Set(issues.map(i => i.query.toLowerCase().trim()));
    const maxAge = 30 * 24 * 60 * 60 * 1000; // 30 days
    for (const [key, saved] of Object.entries(savedStatuses)) {
      if (issueKeys.has(key)) continue; // Already in current issues
      if (!saved.query) continue; // Old format without full data
      if (Date.now() - (saved.ts || 0) > maxAge) continue; // Expired
      // Re-create the issue from saved data
      issues.push({
        query: saved.query,
        dm: saved.dm || 0,
        gapType: saved.gapType || 'unknown',
        severity: saved.severity || 'P2',
        category: saved.category || '--',
        restaurant: saved.restaurant || '--',
        source: saved.source || 'test',
        sourceDetail: saved.sourceDetail || '',
        factors: saved.factors || null,
        relevanceType: saved.relevanceType || null,
        fixAction: saved.fixAction || '',
        status: saved.status,
        retestDm: saved.retestDm,
        prevDm: null,
        deltaDm: null,
        isNew: false,
        scoreFitGrade: saved.scoreFitGrade,
        scoreFitScore: saved.scoreFitScore,
        blurbQualityGrade: saved.blurbQualityGrade,
        blurbQualityScore: saved.blurbQualityScore,
      });
    }

    // Snapshot previous counts before overwriting (for executive summary trends)
    if (state.issues && typeof snapshotIssueCounts === 'function') {
      snapshotIssueCounts();
    }

    state.issues = issues;
    state.issueFilters = { severity: 'all', type: 'all', source: 'all', status: 'open' };
    state.selectedIssues = new Set();

    // Apply default filter (open only) and render
    applyIssueFilters();
    updateIssuesBadge(issues);

    // Re-render action center and comparison strip with updated issue data
    if (typeof renderActionCenter === 'function') renderActionCenter();
    if (typeof renderTestVsProdStrip === 'function') renderTestVsProdStrip();
  } catch (e) {
    console.error('Failed to load issues:', e);
    const list = document.getElementById('issues-list');
    if (list) list.innerHTML = '<div class="cc-empty-state"><div class="cc-empty-state__icon">&#9888;</div><div class="cc-empty-state__text">Failed to load issues</div></div>';
  }
}

// ═══════════════════════════════════════════════════════════════════
// Wave 2: Executive Briefing Computation (#2)
// ═══════════════════════════════════════════════════════════════════

function computeExecutiveBriefing() {
  const feed = state.liveFeed || [];
  const now = new Date();
  const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  const recent = feed.filter(q => new Date(q.created_at) >= oneDayAgo);

  // User Satisfaction: % of positive feedback
  const withFeedback = recent.filter(q => q.claude_relevance_score !== null && q.claude_relevance_score !== undefined);
  const liked = withFeedback.filter(q => q.claude_relevance_score >= 4);
  const satisfactionPct = withFeedback.length > 0 ? Math.round(liked.length / withFeedback.length * 100) : null;

  // Yesterday comparison for satisfaction
  const twoDaysAgo = new Date(now.getTime() - 48 * 60 * 60 * 1000);
  const yesterday = feed.filter(q => new Date(q.created_at) >= twoDaysAgo && new Date(q.created_at) < oneDayAgo);
  const yWithFb = yesterday.filter(q => q.claude_relevance_score !== null && q.claude_relevance_score !== undefined);
  const yLiked = yWithFb.filter(q => q.claude_relevance_score >= 4);
  const ySatisfaction = yWithFb.length > 0 ? Math.round(yLiked.length / yWithFb.length * 100) : null;

  // Engine Quality: composite grade from latest test run
  const run = state.latestRun;
  let engineScore = null;
  let engineGrade = null;
  if (run) {
    const avgDm = Number(run.avg_dm) || 0;
    const avgFit = Number(run.avg_score_fit) || 0;
    const avgBlurb = Number(run.avg_blurb_quality) || 0;
    engineScore = Math.round(avgDm * 0.4 + avgFit * 0.3 + avgBlurb * 0.3);
    if (engineScore >= 93) engineGrade = 'A';
    else if (engineScore >= 85) engineGrade = 'B+';
    else if (engineScore >= 78) engineGrade = 'B';
    else if (engineScore >= 70) engineGrade = 'C+';
    else if (engineScore >= 60) engineGrade = 'C';
    else engineGrade = 'D';
  }

  // Previous run for engine trend
  const prevRun = state.trendData && state.trendData.length > 1 ? state.trendData[1] : null;
  let prevEngineScore = null;
  if (prevRun) {
    prevEngineScore = Math.round((Number(prevRun.avg_dm) || 0) * 0.4 + (Number(prevRun.avg_score_fit) || 0) * 0.3 + (Number(prevRun.avg_blurb_quality) || 0) * 0.3);
  }

  return {
    satisfaction: { value: satisfactionPct, feedbackCount: withFeedback.length, prev: ySatisfaction },
    engine: { score: engineScore, grade: engineGrade, prev: prevEngineScore }
  };
}

// ═══════════════════════════════════════════════════════════════════
// Wave 2: Daily Digest Computation (#4)
// ═══════════════════════════════════════════════════════════════════

function computeDailyDigest() {
  const snapshot = getLastSessionSnapshot();
  if (!snapshot) return { message: 'Welcome back! This is your first session — baseline metrics will be saved.', icon: '\uD83D\uDC4B' };

  const elapsed = Date.now() - snapshot.timestamp;
  const hoursAgo = Math.round(elapsed / 3600000);
  const timeLabel = hoursAgo < 1 ? 'less than an hour ago' : hoursAgo < 24 ? `${hoursAgo}h ago` : `${Math.round(hoursAgo / 24)}d ago`;

  const run = state.latestRun;
  const feed = state.liveFeed || [];
  const changes = [];

  // Score Fit change
  if (run && snapshot.avg_fit) {
    const currentFit = Number(run.avg_score_fit) || 0;
    const delta = currentFit - snapshot.avg_fit;
    if (Math.abs(delta) >= 2) {
      const dir = delta > 0 ? 'improved' : 'dropped';
      changes.push({ impact: Math.abs(delta), message: `Score Fit <strong>${dir} ${Math.abs(delta).toFixed(1)} pts</strong> since your last visit (${timeLabel})`, icon: delta > 0 ? '\u2705' : '\u26A0\uFE0F' });
    }
  }

  // New queries
  const newQueries = feed.filter(q => new Date(q.created_at).getTime() > snapshot.timestamp);
  if (newQueries.length > 0) {
    const gradeIssues = newQueries.filter(q => {
      const fitScore = q.score_fit_score || 0;
      const blurbScore = q.blurb_quality_score || 0;
      return fitScore < 83 || blurbScore < 83;
    });
    const msg = gradeIssues.length > 0
      ? `<strong>${newQueries.length} new queries</strong>, ${gradeIssues.length} with grade issues`
      : `<strong>${newQueries.length} new production queries</strong> — all looking good`;
    changes.push({ impact: newQueries.length, message: msg, icon: '\uD83D\uDCCA' });
  }

  // Avg DM change
  if (run && snapshot.avg_dm) {
    const currentDm = Number(run.avg_dm) || 0;
    const delta = currentDm - snapshot.avg_dm;
    if (Math.abs(delta) >= 1) {
      const dir = delta > 0 ? 'up' : 'down';
      changes.push({ impact: Math.abs(delta) * 0.5, message: `Avg DondeMatch ${dir} to <strong>${currentDm.toFixed(1)}</strong> from ${snapshot.avg_dm.toFixed(1)}`, icon: delta > 0 ? '\uD83D\uDCC8' : '\uD83D\uDCC9' });
    }
  }

  if (changes.length === 0) {
    return { message: `No significant changes since your last session (${timeLabel})`, icon: '\u2714\uFE0F' };
  }

  // Return highest impact change
  changes.sort((a, b) => b.impact - a.impact);
  return { message: changes[0].message, icon: changes[0].icon };
}

// ═══════════════════════════════════════════════════════════════════
// Wave 2: Decision Prompts Computation (#5)
// ═══════════════════════════════════════════════════════════════════

function computeDecisionPrompts() {
  const prompts = [];
  const run = state.latestRun;
  const issues = state.issues || [];
  const feed = state.liveFeed || [];

  // 1. Grade issues detected
  const openIssues = issues.filter(i => !i.status || i.status === 'open');
  const p0Issues = openIssues.filter(i => i.severity === 'P0');
  if (p0Issues.length > 0) {
    prompts.push({
      action: `Review ${p0Issues.length} critical issue${p0Issues.length > 1 ? 's' : ''}`,
      reason: 'Critical issues impact user experience and scoring accuracy.',
      btn: 'View Issues',
      handler: () => switchTab('issues')
    });
  }

  // 2. No recent tests
  if (run) {
    const lastRunAge = Date.now() - new Date(run.created_at).getTime();
    if (lastRunAge > 24 * 60 * 60 * 1000) {
      prompts.push({
        action: 'Run a Broad Scan to check engine health',
        reason: `Last test was ${timeAgo(run.created_at)}. Regular testing catches regressions early.`,
        btn: 'Run Scan',
        handler: () => startTest('broad')
      });
    }
  }

  // 3. Test vs Prod divergence
  if (run && feed.length > 0) {
    const now = new Date();
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const prodRecent = feed.filter(q => new Date(q.created_at) >= sevenDaysAgo && q.donde_match);
    if (prodRecent.length > 10) {
      const prodAvg = prodRecent.reduce((s, q) => s + q.donde_match, 0) / prodRecent.length;
      const testAvg = Number(run.avg_dm) || 0;
      const divergence = testAvg > 0 ? ((testAvg - prodAvg) / testAvg * 100) : 0;
      if (divergence > 10) {
        prompts.push({
          action: 'Production diverging from test results',
          reason: `Prod is ${divergence.toFixed(0)}% lower than test (${prodAvg.toFixed(1)} vs ${testAvg.toFixed(1)}). Investigate.`,
          btn: 'View Live',
          handler: () => switchTab('live')
        });
      }
    }
  }

  // 4. Score Fit improved — suggest regression guard
  if (state.trendData && state.trendData.length >= 2) {
    const curr = state.trendData[0];
    const prev = state.trendData[1];
    const fitDelta = (Number(curr.avg_score_fit) || 0) - (Number(prev.avg_score_fit) || 0);
    if (fitDelta > 5) {
      prompts.push({
        action: 'Run Regression Guard to validate recent improvement',
        reason: `Score Fit improved ${fitDelta.toFixed(1)} pts — verify it holds across golden queries.`,
        btn: 'Run Guard',
        handler: () => startTest('regression')
      });
    }
  }

  return prompts.slice(0, 3);
}

// ═══════════════════════════════════════════════════════════════════
// Wave 2: User Engagement Stats (#8)
// ═══════════════════════════════════════════════════════════════════

function computeUserEngagement() {
  const feed = state.liveFeed || [];
  const now = new Date();
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const recent = feed.filter(q => new Date(q.created_at) >= sevenDaysAgo);

  // Distinct users (by source field or just count unique patterns)
  const userMap = {};
  for (const q of recent) {
    const key = q.auth_user_id || q.source || 'anonymous';
    if (!userMap[key]) userMap[key] = 0;
    userMap[key]++;
  }
  const distinctUsers = Object.keys(userMap).length;
  const repeatUsers = Object.values(userMap).filter(c => c >= 2).length;
  const avgPerUser = distinctUsers > 0 ? (recent.length / distinctUsers).toFixed(1) : '0';

  // Most popular occasion
  const occasionMap = {};
  for (const q of recent) {
    if (q.occasion) {
      occasionMap[q.occasion] = (occasionMap[q.occasion] || 0) + 1;
    }
  }
  const topOccasion = Object.entries(occasionMap).sort((a, b) => b[1] - a[1])[0];

  return {
    distinctUsers,
    repeatUsers,
    avgPerUser,
    topOccasion: topOccasion ? topOccasion[0] : 'N/A'
  };
}

// Note: refreshAllData() is defined in cc-compare.js; exportCurrentView() is defined in cc-ui.js
