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
    // Load ALL user queries — no limit
    const { data: queries } = await sbClient
      .from('user_queries')
      .select('id, special_request, donde_match, restaurant_name, created_at')
      .order('created_at', { ascending: false });

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
      .select('id, special_request, donde_match, restaurant_name, created_at')
      .order('created_at', { ascending: false })
      .limit(20);

    // Only fetch new entries since last known ID
    if (state.liveLastId) {
      query = query.gt('id', state.liveLastId);
    }

    const { data: newQueries } = await query;

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
