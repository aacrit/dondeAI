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
  // Load everything in parallel
  await Promise.all([
    loadInitData(),
    loadRunHistory(),
    loadLiveFeed(),
    pollPipelines(),
    loadIssues(),
  ]);

  // Check API health
  checkApiHealth();

  // Start live polling
  startLivePolling();

  // Smart suggestion
  updateSmartSuggestion();

  // Start freshness ticker on pulse cards
  if (typeof startFreshnessTicker === 'function') startFreshnessTicker();
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
        .select('run_id, avg_dm, passed_60, gap_count, total, created_at, mode, delta_avg_dm')
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

    // Update pulse cards
    if (latestRun) {
      const passRate = latestRun.total > 0 ? (latestRun.passed_60 / latestRun.total * 100) : 0;
      updatePulseHealth(passRate, `from ${latestRun.mode || 'test'} run ${timeAgo(latestRun.created_at)}`);
      updatePulseQuality(latestRun.avg_dm, `${latestRun.total} queries tested`, latestRun.delta_avg_dm);
      updatePulseAttention(latestRun.gap_count, latestRun.gap_count > 5 ? 'action needed' : 'manageable');
    }

    // Update live KPIs
    updateLiveKPIs(todayCount, todayAvgDm, lowScoreCount, 0);

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
      .select('run_id, total, gap_count, avg_dm, passed_60, created_at, mode, dataset_size, delta_avg_dm')
      .order('created_at', { ascending: false })
      .limit(10);

    renderRunHistory(runs || []);
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
    // Load ALL user queries with restaurant name via FK join
    let { data: queries, error } = await sbClient
      .from('user_queries')
      .select('id, special_request, donde_match, created_at, recommended_restaurant_id, restaurants!recommended_restaurant_id(name)')
      .order('created_at', { ascending: false });

    // Fallback: if FK join fails, load without restaurant names
    if (error) {
      console.warn('Live feed FK join failed, falling back:', error.message);
      const fallback = await sbClient
        .from('user_queries')
        .select('id, special_request, donde_match, created_at')
        .order('created_at', { ascending: false });
      queries = fallback.data;
      if (fallback.error) console.error('Live feed fallback also failed:', fallback.error.message, fallback.error.hint);
    }

    if (queries && queries.length > 0) {
      state.liveFeed = queries;
      state.liveLastId = queries[0].id;
      applyLiveFilter();
    } else {
      state.liveFeed = [];
      applyLiveFilter();
    }
  } catch (e) {
    console.warn('Failed to load live feed:', e);
  }
}

/** Filter live feed by state.liveFilter and re-render */
function applyLiveFilter() {
  const filtered = filterQueriesByPeriod(state.liveFeed, state.liveFilter);
  renderLiveFeed(filtered);
  updateLiveKPIsFromQueries(filtered);
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
  const avgDm = count > 0
    ? queries.reduce((s, q) => s + (q.donde_match || 0), 0) / count
    : 0;
  const lowScores = queries.filter(q => (q.donde_match || 0) < 60).length;
  updateLiveKPIs(count, avgDm, lowScores, 0);
}

async function pollLiveFeed() {
  if (!sbClient) return;

  try {
    let query = sbClient
      .from('user_queries')
      .select('id, special_request, donde_match, created_at, recommended_restaurant_id, restaurants!recommended_restaurant_id(name)')
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
      state.liveFeed = [...newQueries, ...state.liveFeed];
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
    btn.onclick = () => {
      switchTab('test');
      const firstRow = document.querySelector('.cc-run-row[data-run-id]');
      if (firstRow) firstRow.click();
    };
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
    default: return 'Investigate query scoring';
  }
}

async function loadIssues() {
  if (!sbClient) return;

  try {
    // Parallel fetch: test gaps + prod low scores + historical data
    const [gapsRes, prodRes, histRes] = await Promise.all([
      // Test gaps from latest runs
      sbClient.from('gauntlet_results')
        .select('query, donde_match, gap_type, gap_severity, category, restaurant_name, food, vibe, service, reputation, convenience, relevance_type, run_id')
        .not('gap_type', 'is', null)
        .order('donde_match', { ascending: true })
        .limit(100),

      // Production low-score queries
      sbClient.from('user_queries')
        .select('id, special_request, donde_match, created_at, response_time_ms, was_fallback, restaurants!recommended_restaurant_id(name)')
        .lt('donde_match', 60)
        .not('donde_match', 'is', null)
        .order('created_at', { ascending: false })
        .limit(50),

      // Historical gap analysis
      fetch('data/gap-details.json').then(r => r.ok ? r.json() : null).catch(() => null),
    ]);

    const issues = [];
    const seen = new Set();

    // Process test gaps
    if (gapsRes.data) {
      for (const g of gapsRes.data) {
        const key = g.query.toLowerCase().trim();
        if (seen.has(key)) continue;
        seen.add(key);
        const severity = g.gap_severity || classifySeverity(g.donde_match, g.gap_type);
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

    state.issues = issues;
    state.issueFilters = { severity: 'all', type: 'all', source: 'all' };
    state.selectedIssues = new Set();

    renderIssues(issues);
    updateIssuesBadge(issues);
  } catch (e) {
    console.error('Failed to load issues:', e);
    const list = document.getElementById('issues-list');
    if (list) list.innerHTML = '<div class="cc-empty-state"><div class="cc-empty-state__icon">&#9888;</div><div class="cc-empty-state__text">Failed to load issues</div></div>';
  }
}
