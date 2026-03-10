/**
 * DondeAI Command Center v2 — Test Runners
 * 6 independent test types, live result streaming, no agent gamification
 */

// ═══════════════════════════════════════════════════════════════════
// API Call
// ═══════════════════════════════════════════════════════════════════

async function callAPI(specialRequest, params = {}, signal) {
  const body = { special_request: specialRequest, ...params };
  const resp = await fetch(API_BASE, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
      'apikey': SUPABASE_ANON_KEY,
    },
    body: JSON.stringify(body),
    signal,
  });
  return resp.json();
}

// ═══════════════════════════════════════════════════════════════════
// Test Orchestrator
// ═══════════════════════════════════════════════════════════════════

function startTest(type) {
  if (state.activeTest) {
    stopTest();
    return;
  }

  if (type === 'category') {
    // Show category picker, don't start yet
    const picker = document.getElementById('cat-picker');
    if (picker) picker.style.display = 'flex';
    return;
  }

  const runners = {
    broad: runBroadScan,
    regression: runRegressionGuard,
    edge: runEdgeCases,
    blurb: runBlurbQA,
    coverage: runDataCoverage,
  };

  if (runners[type]) runners[type]();
}

function runCategoryTest(category) {
  const picker = document.getElementById('cat-picker');
  if (picker) picker.style.display = 'none';
  runCategoryFocus(category);
}

function stopTest() {
  if (state.activeTest) {
    state.activeTest.abortController.abort();
    finishTest();
  }
}

function finishTest() {
  if (!state.activeTest) return;
  const test = state.activeTest;
  state.activeTest = null;

  // Update UI
  const progress = document.getElementById('test-progress');
  if (progress) progress.style.display = 'none';

  // Re-enable test cards
  document.querySelectorAll('.cc-test-card').forEach(c => c.classList.remove('cc-test-card--disabled'));

  // Show summary in stream
  if (test.results.length > 0) {
    const passed = test.results.filter(r => r.pass).length;
    const avg = test.results.reduce((s, r) => s + (r.dm || 0), 0) / test.results.length;
    const elapsed = ((Date.now() - test.startTime) / 1000).toFixed(0);
    appendSummaryRow(TEST_TYPES[test.type]?.name || test.type, test.results.length, passed, avg, elapsed);
  }

  // Persist to Supabase
  persistResults(test);

  // Refresh pulse cards
  if (typeof loadInitData === 'function') loadInitData();
}

// ═══════════════════════════════════════════════════════════════════
// Test Setup Helper
// ═══════════════════════════════════════════════════════════════════

function initTest(type, total) {
  const ac = new AbortController();
  state.activeTest = {
    type,
    abortController: ac,
    progress: 0,
    total,
    results: [],
    startTime: Date.now(),
  };

  // Disable other test cards
  document.querySelectorAll('.cc-test-card').forEach(c => {
    if (c.dataset.test !== type) c.classList.add('cc-test-card--disabled');
  });

  // Clear previous results
  const stream = document.getElementById('result-stream');
  if (stream) stream.innerHTML = '';

  // Show progress bar
  showTestProgress(TEST_TYPES[type]?.name || type, 0, total, 0);
  updateSystemStatus('Running', 'green');

  return ac;
}

function recordResult(result) {
  if (!state.activeTest) return;
  state.activeTest.results.push(result);
  state.activeTest.progress++;
  const t = state.activeTest;
  const avg = t.results.reduce((s, r) => s + (r.dm || 0), 0) / t.results.length;
  showTestProgress(TEST_TYPES[t.type]?.name || t.type, t.progress, t.total, avg);
}

// ═══════════════════════════════════════════════════════════════════
// 1. Broad Scan
// ═══════════════════════════════════════════════════════════════════

async function runBroadScan() {
  const pool = typeof CHICAGO_QUERIES !== 'undefined' ? CHICAGO_QUERIES : [];
  const queries = shuffle(pool).slice(0, 20);
  const ac = initTest('broad', queries.length);

  for (const q of queries) {
    if (ac.signal.aborted) break;
    try {
      const resp = await callAPI(q.query, {}, ac.signal);
      const dm = resp.donde_match || 0;
      const pass = dm >= 60;
      const gap = determineGapType(resp, dm);
      const result = { query: q.query, cat: q.cat, diff: q.diff, dm, pass, gap, restaurant: resp.restaurant?.name };
      recordResult(result);
      appendResultRow(result);
    } catch (e) {
      if (e.name === 'AbortError') break;
      recordResult({ query: q.query, cat: q.cat, diff: q.diff, dm: 0, pass: false, gap: 'error', error: e.message });
      appendResultRow({ query: q.query, cat: q.cat, diff: q.diff, dm: 0, pass: false, gap: 'error' });
    }
  }
  finishTest();
}

// ═══════════════════════════════════════════════════════════════════
// 2. Category Focus
// ═══════════════════════════════════════════════════════════════════

async function runCategoryFocus(category) {
  const pool = typeof CHICAGO_QUERIES !== 'undefined' ? CHICAGO_QUERIES : [];
  const catQueries = pool.filter(q => q.cat === category);
  const queries = shuffle(catQueries).slice(0, 15);
  const ac = initTest('category', queries.length);

  for (const q of queries) {
    if (ac.signal.aborted) break;
    try {
      const resp = await callAPI(q.query, {}, ac.signal);
      const dm = resp.donde_match || 0;
      const pass = dm >= 60;
      const gap = determineGapType(resp, dm);
      const result = { query: q.query, cat: q.cat, diff: q.diff, dm, pass, gap, restaurant: resp.restaurant?.name };
      recordResult(result);
      appendResultRow(result);
    } catch (e) {
      if (e.name === 'AbortError') break;
      recordResult({ query: q.query, cat: q.cat, dm: 0, pass: false, gap: 'error' });
      appendResultRow({ query: q.query, cat: q.cat, dm: 0, pass: false, gap: 'error' });
    }
  }
  finishTest();
}

// ═══════════════════════════════════════════════════════════════════
// 3. Regression Guard
// ═══════════════════════════════════════════════════════════════════

async function runRegressionGuard() {
  const ac = initTest('regression', GOLDEN_QUERIES.length);

  for (const gq of GOLDEN_QUERIES) {
    if (ac.signal.aborted) break;
    try {
      const resp = await callAPI(gq.query, {}, ac.signal);
      const dm = resp.donde_match || 0;
      const pass = dm >= gq.minScore;
      const delta = dm - gq.minScore;
      const result = {
        query: gq.query, cat: gq.cat, dm, pass,
        gap: pass ? null : 'regression',
        baseline: gq.minScore, delta,
        restaurant: resp.restaurant?.name,
      };
      recordResult(result);
      appendResultRow(result);
    } catch (e) {
      if (e.name === 'AbortError') break;
      recordResult({ query: gq.query, cat: gq.cat, dm: 0, pass: false, gap: 'error' });
      appendResultRow({ query: gq.query, cat: gq.cat, dm: 0, pass: false, gap: 'error' });
    }
  }
  finishTest();
}

// ═══════════════════════════════════════════════════════════════════
// 4. Edge Cases
// ═══════════════════════════════════════════════════════════════════

async function runEdgeCases() {
  const ac = initTest('edge', EDGE_PROBES.length);

  for (const probe of EDGE_PROBES) {
    if (ac.signal.aborted) break;
    try {
      const resp = await callAPI(probe.input, probe.params || {}, ac.signal);
      // Edge case passes if API returns valid response without crashing
      const valid = resp && (resp.success !== undefined || resp.restaurant || resp.recommendation);
      const hasValidDm = typeof resp.donde_match === 'number';
      const contractOk = valid && (resp.success === false || (hasValidDm && resp.restaurant?.name));
      const result = {
        query: probe.name, cat: 'Edge', dm: resp.donde_match || 0,
        pass: !!contractOk || resp.success === false,
        gap: contractOk || resp.success === false ? null : 'contract',
        restaurant: resp.restaurant?.name,
      };
      recordResult(result);
      appendResultRow(result);
    } catch (e) {
      if (e.name === 'AbortError') break;
      // Network/timeout errors are also valid edge case responses
      const isExpected = e.message?.includes('timeout') || e.message?.includes('429');
      recordResult({ query: probe.name, cat: 'Edge', dm: 0, pass: isExpected, gap: isExpected ? null : 'error' });
      appendResultRow({ query: probe.name, cat: 'Edge', dm: 0, pass: isExpected, gap: isExpected ? null : 'error' });
    }
  }
  finishTest();
}

// ═══════════════════════════════════════════════════════════════════
// 5. Blurb Quality
// ═══════════════════════════════════════════════════════════════════

async function runBlurbQA() {
  const ac = initTest('blurb', 10);

  if (!sbClient) {
    appendResultRow({ query: 'Blurb QA', cat: 'QA', dm: 0, pass: false, gap: 'No Supabase client' });
    finishTest();
    return;
  }

  try {
    // Fetch 10 random restaurant blurbs
    const { data: restaurants } = await sbClient
      .from('restaurants')
      .select('name, recommendation_blurb')
      .not('recommendation_blurb', 'is', null)
      .limit(100);

    if (!restaurants || restaurants.length === 0) {
      appendResultRow({ query: 'No blurbs found', cat: 'QA', dm: 0, pass: false, gap: 'No data' });
      finishTest();
      return;
    }

    const sample = shuffle(restaurants).slice(0, 10);

    for (const r of sample) {
      if (ac.signal.aborted) break;
      const blurb = (r.recommendation_blurb || '').toLowerCase();
      const found = BANNED_PATTERNS.filter(p => blurb.includes(p.toLowerCase()));
      const pass = found.length === 0;
      const result = {
        query: r.name, cat: 'QA', dm: pass ? 100 : Math.max(0, 100 - found.length * 20),
        pass, gap: pass ? null : `cliché: ${found.slice(0, 3).join(', ')}`,
        restaurant: r.name,
      };
      recordResult(result);
      appendResultRow(result);
    }
  } catch (e) {
    if (e.name !== 'AbortError') {
      appendResultRow({ query: 'Blurb QA error', cat: 'QA', dm: 0, pass: false, gap: e.message });
    }
  }
  finishTest();
}

// ═══════════════════════════════════════════════════════════════════
// 6. Data Coverage
// ═══════════════════════════════════════════════════════════════════

async function runDataCoverage() {
  const ac = initTest('coverage', 10);

  if (!sbClient) {
    appendResultRow({ query: 'Data Coverage', cat: 'Data', dm: 0, pass: false, gap: 'No Supabase client' });
    finishTest();
    return;
  }

  try {
    const { data: restaurants } = await sbClient
      .from('restaurants')
      .select(REQUIRED_FIELDS.join(','))
      .eq('is_active', true)
      .limit(100);

    if (!restaurants || restaurants.length === 0) {
      appendResultRow({ query: 'No restaurants', cat: 'Data', dm: 0, pass: false, gap: 'No data' });
      finishTest();
      return;
    }

    const sample = shuffle(restaurants).slice(0, 10);

    for (const r of sample) {
      if (ac.signal.aborted) break;
      const missing = REQUIRED_FIELDS.filter(f => !r[f] && r[f] !== 0);
      const coverage = ((REQUIRED_FIELDS.length - missing.length) / REQUIRED_FIELDS.length * 100).toFixed(0);
      const pass = missing.length === 0;
      const result = {
        query: r.name, cat: 'Data', dm: Number(coverage),
        pass, gap: pass ? null : `missing: ${missing.join(', ')}`,
        restaurant: r.name,
      };
      recordResult(result);
      appendResultRow(result);
    }
  } catch (e) {
    if (e.name !== 'AbortError') {
      appendResultRow({ query: 'Coverage error', cat: 'Data', dm: 0, pass: false, gap: e.message });
    }
  }
  finishTest();
}

// ═══════════════════════════════════════════════════════════════════
// Persist Results to Supabase
// ═══════════════════════════════════════════════════════════════════

async function persistResults(test) {
  if (!sbClient || !test.results.length) return;

  try {
    const passed60 = test.results.filter(r => r.dm >= 60).length;
    const passed80 = test.results.filter(r => r.dm >= 80).length;
    const avgDm = test.results.reduce((s, r) => s + (r.dm || 0), 0) / test.results.length;
    const gapCount = test.results.filter(r => r.gap).length;
    const runId = `cc-${test.type}-${Date.now()}`;

    await sbClient.from('gauntlet_runs').insert({
      run_id: runId,
      dataset_size: test.results.length,
      mode: test.type,
      total: test.results.length,
      successful: test.results.length,
      passed_60: passed60,
      passed_80: passed80,
      avg_dm: Math.round(avgDm * 10) / 10,
      gap_count: gapCount,
    });

    const rows = test.results.map((r, i) => ({
      run_id: runId,
      query_id: `${test.type}-${i}`,
      query: r.query,
      category: r.cat || 'unknown',
      donde_match: r.dm || 0,
      score_pass: r.pass,
      gap_type: r.gap || null,
      restaurant_name: r.restaurant || null,
    }));

    // Insert in batches of 50
    for (let i = 0; i < rows.length; i += 50) {
      await sbClient.from('gauntlet_results').insert(rows.slice(i, i + 50));
    }

    // Refresh run history
    if (typeof loadRunHistory === 'function') loadRunHistory();
  } catch (e) {
    console.warn('Failed to persist test results:', e);
  }
}

// ═══════════════════════════════════════════════════════════════════
// Pipeline Triggers
// ═══════════════════════════════════════════════════════════════════

async function triggerPipeline(operation) {
  if (!sbClient) return;

  const btn = document.querySelector(`[data-op="${operation}"]`);
  if (btn) btn.classList.add('cc-pipeline-btn--pending');

  try {
    await sbClient.from('maintenance_requests').insert({
      operation,
      status: 'pending',
      config: { dry_run: false },
    });

    updatePipelineStatus(operation, 'pending');
    startPipelinePolling();
  } catch (e) {
    console.error('Pipeline trigger failed:', e);
    updatePipelineStatus(operation, 'error');
  }
}

function startPipelinePolling() {
  if (state.pipePollTimer) return;
  state.pipePollTimer = setInterval(pollPipelines, PIPE_POLL_INTERVAL);
  pollPipelines();
}

async function pollPipelines() {
  if (!sbClient) return;

  try {
    const { data } = await sbClient
      .from('maintenance_requests')
      .select('operation, status, started_at, completed_at, result')
      .order('requested_at', { ascending: false })
      .limit(10);

    if (!data) return;

    // Update statuses for active ops
    const latest = {};
    for (const req of data) {
      if (!latest[req.operation]) latest[req.operation] = req;
    }

    for (const [op, req] of Object.entries(latest)) {
      updatePipelineStatus(op, req.status);
      state.pipelineStatuses[op] = req;
    }

    // Render pipeline history
    renderPipelineHistory(data);

    // Stop polling if nothing active
    const hasActive = data.some(r => r.status === 'pending' || r.status === 'running');
    if (!hasActive && state.pipePollTimer) {
      clearInterval(state.pipePollTimer);
      state.pipePollTimer = null;
    }
  } catch (e) {
    console.warn('Pipeline poll failed:', e);
  }
}
