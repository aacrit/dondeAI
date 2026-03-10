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
        .select('run_id, avg_dm, passed_60, gap_count, total, created_at, mode')
        .order('created_at', { ascending: false })
        .limit(1),
      // Total active restaurants
      sbClient.from('restaurants').select('id', { count: 'exact', head: true }).eq('is_active', true),
      // Enriched restaurants (have noise_level as proxy)
      sbClient.from('restaurants').select('id', { count: 'exact', head: true }).eq('is_active', true).not('noise_level', 'is', null),
      // Tag count
      sbClient.from('tags').select('id', { count: 'exact', head: true }),
      // Today's user queries (all of them)
      sbClient.from('user_queries')
        .select('id, donde_match, created_at')
        .gte('created_at', new Date().toISOString().split('T')[0])
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
      updatePulseQuality(latestRun.avg_dm, `${latestRun.total} queries tested`);
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
    // Load ALL user queries (not just today) — most recent first, limit to 50
    const { data: queries } = await sbClient
      .from('user_queries')
      .select('id, special_request, donde_match, restaurant_name, created_at')
      .order('created_at', { ascending: false })
      .limit(50);

    if (queries && queries.length > 0) {
      state.liveFeed = queries;
      state.liveLastId = queries[0].id;
      renderLiveFeed(queries);

      // Update live KPIs from all data
      const todayStart = new Date().toISOString().split('T')[0];
      const todayQueries = queries.filter(q => q.created_at >= todayStart);
      const allCount = todayQueries.length;
      const avgDm = allCount > 0
        ? todayQueries.reduce((s, q) => s + (q.donde_match || 0), 0) / allCount
        : 0;
      const lowScores = todayQueries.filter(q => (q.donde_match || 0) < 60).length;
      updateLiveKPIs(allCount, avgDm, lowScores, 0);
    }
  } catch (e) {
    console.warn('Failed to load live feed:', e);
  }
}

async function pollLiveFeed() {
  if (!sbClient) return;

  try {
    let query = sbClient
      .from('user_queries')
      .select('id, special_request, donde_match, restaurant_name, created_at')
      .order('created_at', { ascending: false })
      .limit(10);

    // Only fetch new entries since last known ID
    if (state.liveLastId) {
      query = query.gt('id', state.liveLastId);
    }

    const { data: newQueries } = await query;

    if (newQueries && newQueries.length > 0) {
      state.liveLastId = newQueries[0].id;
      state.liveFeed = [...newQueries, ...state.liveFeed].slice(0, 50);
      renderLiveFeed(state.liveFeed);

      // Recalculate live KPIs
      const todayStart = new Date().toISOString().split('T')[0];
      const todayQueries = state.liveFeed.filter(q => q.created_at >= todayStart);
      const allCount = todayQueries.length;
      const avgDm = allCount > 0
        ? todayQueries.reduce((s, q) => s + (q.donde_match || 0), 0) / allCount
        : 0;
      const lowScores = todayQueries.filter(q => (q.donde_match || 0) < 60).length;
      updateLiveKPIs(allCount, avgDm, lowScores, 0);
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
    btn.textContent = 'Run Broad Scan';
    btn.onclick = () => startTest('broad');
    strip.style.display = 'flex';
  } else if (hoursSinceRun > 24) {
    text.textContent = `No tests run in ${Math.floor(hoursSinceRun)}h.`;
    btn.textContent = 'Run Broad Scan';
    btn.onclick = () => startTest('broad');
    strip.style.display = 'flex';
  } else if (run.gap_count === 0) {
    text.textContent = `System healthy. ${pct(run.passed_60, run.total)}% pass rate.`;
    btn.style.display = 'none';
    strip.style.display = 'flex';
  } else {
    strip.style.display = 'none';
  }
}

function dismissSuggestion() {
  const strip = document.getElementById('suggest-strip');
  if (strip) strip.style.display = 'none';
}
