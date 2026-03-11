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
  if (!resp.ok) {
    const text = await resp.text().catch(() => '');
    try { return JSON.parse(text); } catch (_) {}
    throw new Error(`API ${resp.status}: ${text.slice(0, 200)}`);
  }
  return resp.json();
}

// ═══════════════════════════════════════════════════════════════════
// Terminal Logging
// ═══════════════════════════════════════════════════════════════════

function openTerminal() {
  state.terminalOpen = true;
  const el = document.getElementById('cc-terminal');
  const bd = document.getElementById('terminal-backdrop');
  if (el) el.classList.add('cc-terminal--open');
  if (bd) bd.classList.add('cc-terminal__backdrop--visible');
  // FAB: switch to close icon, reset unread
  const fab = document.getElementById('terminal-fab');
  if (fab) fab.classList.add('cc-terminal-fab--active');
  state.unreadLogs = 0;
  updateTerminalBadge();
}

function closeTerminal() {
  state.terminalOpen = false;
  const el = document.getElementById('cc-terminal');
  const bd = document.getElementById('terminal-backdrop');
  if (el) el.classList.remove('cc-terminal--open');
  if (bd) bd.classList.remove('cc-terminal__backdrop--visible');
  // FAB: switch back to terminal icon
  const fab = document.getElementById('terminal-fab');
  if (fab) fab.classList.remove('cc-terminal-fab--active');
}

function toggleTerminal() {
  state.terminalOpen ? closeTerminal() : openTerminal();
}

function updateTerminalBadge() {
  const badge = document.getElementById('terminal-badge');
  if (!badge) return;
  const count = state.unreadLogs || 0;
  if (count > 0) {
    badge.textContent = count > 99 ? '99+' : count;
    badge.classList.add('cc-terminal-fab__badge--visible');
    badge.classList.remove('cc-terminal-fab__badge--pop');
    void badge.offsetWidth;
    badge.classList.add('cc-terminal-fab__badge--pop');
  } else {
    badge.classList.remove('cc-terminal-fab__badge--visible');
  }
}

function clearTerminal() {
  const body = document.getElementById('terminal-output');
  if (body) body.innerHTML = '';
}

function termLog(type, msg) {
  const body = document.getElementById('terminal-output');
  if (!body) return;

  // Remove cursor from previous line
  const prev = body.querySelector('.cc-term-cursor');
  if (prev) prev.remove();

  const prefix = { action: '→', success: '✓', warn: '⚠', error: '✗', info: '◆', system: '·' };
  const time = new Date().toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' });
  const line = document.createElement('div');
  line.className = `cc-term-line cc-term-line--${type}`;
  line.textContent = `${time}  ${prefix[type] || '·'}  ${msg}`;

  // Add blinking cursor to latest line
  const cursor = document.createElement('span');
  cursor.className = 'cc-term-cursor';
  line.appendChild(cursor);

  body.appendChild(line);
  body.scrollTop = body.scrollHeight;

  // Track unread logs when terminal is closed
  if (!state.terminalOpen) {
    state.unreadLogs = (state.unreadLogs || 0) + 1;
    updateTerminalBadge();
  }
}

// ═══════════════════════════════════════════════════════════════════
// Ticker
// ═══════════════════════════════════════════════════════════════════

function showTicker() {
  const el = document.getElementById('cc-ticker');
  if (el) el.classList.add('cc-ticker--visible');
}
function hideTicker() {
  const el = document.getElementById('cc-ticker');
  if (el) el.classList.remove('cc-ticker--visible');
}
function updateTicker(progress, total, avgDm, gaps) {
  const setVal = (id, val) => {
    const el = document.getElementById(id);
    if (!el) return;
    if (el.textContent !== String(val)) {
      el.textContent = val;
      el.classList.remove('cc-ticker__val--pop');
      void el.offsetWidth; // force reflow
      el.classList.add('cc-ticker__val--pop');
    }
  };
  setVal('ticker-progress', `${progress}/${total}`);
  setVal('ticker-dm', avgDm > 0 ? Math.round(avgDm) : '--');
  setVal('ticker-gaps', gaps);
}

// ═══════════════════════════════════════════════════════════════════
// Dark Pulse
// ═══════════════════════════════════════════════════════════════════

function triggerDarkPulse() {
  const el = document.getElementById('dark-pulse');
  if (!el) return;
  el.style.display = 'block';
  el.style.animation = 'none';
  void el.offsetWidth;
  el.style.animation = '';
  setTimeout(() => { el.style.display = 'none'; }, 700);
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
    const picker = document.getElementById('cat-picker');
    if (picker) picker.style.display = picker.style.display === 'none' ? 'flex' : 'none';
    return;
  }

  // Save for rerun
  state.lastTestType = type;
  state.lastTestConfig = state.testConfig[type] ? { ...state.testConfig[type] } : null;

  // Open terminal + ticker + dark pulse
  openTerminal();
  showTicker();
  triggerDarkPulse();
  termLog('system', `Starting ${TEST_TYPES[type]?.name || type}...`);

  // Show result search
  const searchEl = document.getElementById('result-search');
  if (searchEl) searchEl.style.display = 'flex';

  const runners = {
    broad: runBroadScan,
    regression: runRegressionGuard,
    edge: runEdgeCases,
    blurb: runBlurbQA,
    coverage: runDataCoverage,
  };

  if (runners[type]) runners[type]();
}

function runMultiCategoryTest() {
  const cats = state.selectedCategories;
  if (!cats.length) { showToast('Select at least one category'); return; }
  const picker = document.getElementById('cat-picker');
  if (picker) picker.style.display = 'none';

  state.lastTestType = 'category';
  state.lastTestConfig = { categories: [...cats] };
  openTerminal();
  showTicker();
  triggerDarkPulse();
  termLog('system', `Starting Category Focus: ${cats.join(', ')}...`);
  const searchEl = document.getElementById('result-search');
  if (searchEl) searchEl.style.display = 'flex';
  runCategoryFocus(cats);
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

  // Hide ticker
  hideTicker();

  // Show summary in stream
  if (test.results.length > 0) {
    const passed = test.results.filter(r => r.pass).length;
    const avg = test.results.reduce((s, r) => s + (r.dm || 0), 0) / test.results.length;
    const gaps = test.results.filter(r => r.gap).length;
    const elapsed = ((Date.now() - test.startTime) / 1000).toFixed(0);
    const celebrate = avg >= 85;
    appendSummaryRow(TEST_TYPES[test.type]?.name || test.type, test.results.length, passed, avg, elapsed, celebrate, test.type);

    // Terminal summary
    termLog('info', `Complete. ${passed}/${test.results.length} passed · avg DM: ${Math.round(avg)} · ${gaps} gaps · ${elapsed}s`);
    if (celebrate) termLog('success', 'Excellent run! Average DM above 85.');

    // Remove cursor from terminal
    const cursor = document.getElementById('terminal-output')?.querySelector('.cc-term-cursor');
    if (cursor) cursor.remove();
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
  const cfg = state.testConfig?.broad || { count: 20, difficulty: 'all', threshold: 60 };
  let pool = typeof CHICAGO_QUERIES !== 'undefined' ? [...CHICAGO_QUERIES] : [];
  // Mix in custom queries
  if (state.customQueries?.length) {
    pool = pool.concat(state.customQueries.map(cq => ({ cat: cq.cat, diff: 'custom', query: cq.query })));
  }
  if (cfg.difficulty !== 'all') pool = pool.filter(q => q.diff === cfg.difficulty);
  // Pin pinned queries to front
  const pinSet = new Set(state.pinnedQueries || []);
  const pinned = pool.filter(q => pinSet.has(q.query));
  const rest = shuffle(pool.filter(q => !pinSet.has(q.query)));
  const queries = [...pinned, ...rest].slice(0, cfg.count);
  const ac = initTest('broad', queries.length);

  termLog('action', `Pool: ${pool.length} queries · running ${queries.length} · threshold: ${cfg.threshold}`);

  for (let i = 0; i < queries.length; i++) {
    const q = queries[i];
    if (ac.signal.aborted) break;
    termLog('action', `Testing: "${q.query}"...`);
    try {
      const resp = await callAPI(q.query, {}, ac.signal);
      const dm = resp.donde_match || 0;
      const pass = dm >= cfg.threshold;
      const gap = pass ? null : determineGapType(resp, dm);
      const result = { query: q.query, cat: q.cat, diff: q.diff, dm, pass, gap, restaurant: resp.restaurant?.name };
      recordResult(result);
      appendResultRow(result);
      termLog(pass ? 'success' : 'warn', `${resp.restaurant?.name || '??'} (DM: ${dm})${gap ? ' — gap: ' + gap : ''}`);
      // Update ticker
      const t = state.activeTest;
      if (t) {
        const avg = t.results.reduce((s, r) => s + (r.dm || 0), 0) / t.results.length;
        const gaps = t.results.filter(r => r.gap).length;
        updateTicker(i + 1, queries.length, avg, gaps);
      }
    } catch (e) {
      if (e.name === 'AbortError') break;
      const errMsg = e.message || String(e);
      recordResult({ query: q.query, cat: q.cat, diff: q.diff, dm: 0, pass: false, gap: 'error: ' + errMsg, error: errMsg });
      appendResultRow({ query: q.query, cat: q.cat, diff: q.diff, dm: 0, pass: false, gap: 'error: ' + errMsg });
      termLog('error', `Error: ${errMsg.slice(0, 80)}`);
    }
  }
  finishTest();
}

// ═══════════════════════════════════════════════════════════════════
// 2. Category Focus
// ═══════════════════════════════════════════════════════════════════

async function runCategoryFocus(categories) {
  const cats = Array.isArray(categories) ? categories : [categories];
  const cfg = state.testConfig?.category || { count: 15, difficulty: 'all', threshold: 60 };
  let pool = typeof CHICAGO_QUERIES !== 'undefined' ? [...CHICAGO_QUERIES] : [];
  // Mix in custom queries matching categories
  if (state.customQueries?.length) {
    pool = pool.concat(state.customQueries.filter(cq => cats.includes(cq.cat)).map(cq => ({ cat: cq.cat, diff: 'custom', query: cq.query })));
  }
  const catQueries = pool.filter(q => cats.includes(q.cat));
  if (cfg.difficulty !== 'all') catQueries.filter(q => q.diff === cfg.difficulty || q.diff === 'custom');
  const queries = shuffle(catQueries).slice(0, cfg.count);
  const ac = initTest('category', queries.length);

  termLog('action', `Categories: ${cats.join(', ')} · ${queries.length} queries · threshold: ${cfg.threshold}`);

  for (let i = 0; i < queries.length; i++) {
    const q = queries[i];
    if (ac.signal.aborted) break;
    termLog('action', `Testing: "${q.query}" [${q.cat}]...`);
    try {
      const resp = await callAPI(q.query, {}, ac.signal);
      const dm = resp.donde_match || 0;
      const pass = dm >= cfg.threshold;
      const gap = pass ? null : determineGapType(resp, dm);
      const result = { query: q.query, cat: q.cat, diff: q.diff, dm, pass, gap, restaurant: resp.restaurant?.name };
      recordResult(result);
      appendResultRow(result);
      termLog(pass ? 'success' : 'warn', `${resp.restaurant?.name || '??'} (DM: ${dm})${gap ? ' — gap: ' + gap : ''}`);
      if (state.activeTest) {
        const t = state.activeTest;
        const avg = t.results.reduce((s, r) => s + (r.dm || 0), 0) / t.results.length;
        updateTicker(i + 1, queries.length, avg, t.results.filter(r => r.gap).length);
      }
    } catch (e) {
      if (e.name === 'AbortError') break;
      termLog('error', `Error: ${(e.message || '').slice(0, 80)}`);
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
  termLog('action', `Running ${GOLDEN_QUERIES.length} golden queries against baselines...`);

  for (let i = 0; i < GOLDEN_QUERIES.length; i++) {
    const gq = GOLDEN_QUERIES[i];
    if (ac.signal.aborted) break;
    termLog('action', `Baseline test: "${gq.query}" (min: ${gq.minScore})...`);
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
      const deltaStr = delta >= 0 ? `+${delta}` : `${delta}`;
      termLog(pass ? 'success' : 'warn', `DM: ${dm} (${deltaStr} vs baseline)${pass ? '' : ' — REGRESSION'}`);
      if (state.activeTest) {
        const t = state.activeTest;
        const avg = t.results.reduce((s, r) => s + (r.dm || 0), 0) / t.results.length;
        updateTicker(i + 1, GOLDEN_QUERIES.length, avg, t.results.filter(r => r.gap).length);
      }
    } catch (e) {
      if (e.name === 'AbortError') break;
      termLog('error', `Error: ${(e.message || '').slice(0, 80)}`);
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
  termLog('action', `Probing ${EDGE_PROBES.length} edge cases...`);

  for (let i = 0; i < EDGE_PROBES.length; i++) {
    const probe = EDGE_PROBES[i];
    if (ac.signal.aborted) break;
    termLog('action', `Probe: ${probe.name}...`);
    try {
      const resp = await callAPI(probe.input, probe.params || {}, ac.signal);
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
      termLog(result.pass ? 'success' : 'warn', `${result.pass ? 'Handled gracefully' : 'Contract violation'}${resp.restaurant?.name ? ' → ' + resp.restaurant.name : ''}`);
      if (state.activeTest) updateTicker(i + 1, EDGE_PROBES.length, 0, state.activeTest.results.filter(r => r.gap).length);
    } catch (e) {
      if (e.name === 'AbortError') break;
      const isExpected = e.message?.includes('timeout') || e.message?.includes('429');
      termLog(isExpected ? 'success' : 'error', isExpected ? 'Expected error (handled)' : `Unexpected: ${(e.message || '').slice(0, 60)}`);
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
  const isDeep = state.blurbMode === 'deep';
  const count = isDeep ? 10 : 10;
  const ac = initTest('blurb', count);

  if (!sbClient) {
    appendResultRow({ query: 'Blurb QA', cat: 'QA', dm: 0, pass: false, gap: 'No Supabase client' });
    finishTest();
    return;
  }

  try {
    // Fetch random restaurant blurbs
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

    const sample = shuffle(restaurants).slice(0, count);

    for (const r of sample) {
      if (ac.signal.aborted) break;

      // Quick mode: regex check
      const blurb = (r.recommendation_blurb || '').toLowerCase();
      const found = BANNED_PATTERNS.filter(p => blurb.includes(p.toLowerCase()));
      const regexPass = found.length === 0;
      const regexScore = regexPass ? 100 : Math.max(0, 100 - found.length * 20);

      if (!isDeep) {
        // Quick mode only
        const result = {
          query: r.name, cat: 'QA', dm: regexScore,
          pass: regexPass, gap: regexPass ? null : `cliché: ${found.slice(0, 3).join(', ')}`,
          restaurant: r.name, diff: 'quick',
        };
        recordResult(result);
        appendResultRow(result);
      } else {
        // Deep mode: send blurb to API for Claude evaluation
        try {
          const evalResp = await callAPI(
            `BLURB_EVAL: Rate this restaurant blurb for "${r.name}" on quality (0-100). Is it specific, honest, and free of clichés? Blurb: "${r.recommendation_blurb}"`,
            {}, ac.signal
          );
          // Use the DM score from Claude's evaluation as a quality proxy
          const claudeDm = evalResp.donde_match || 0;
          // Combine: average of regex score and Claude evaluation
          const combinedScore = Math.round((regexScore + claudeDm) / 2);
          const pass = combinedScore >= 60 && regexPass;
          const gaps = [];
          if (!regexPass) gaps.push(`cliché: ${found.slice(0, 3).join(', ')}`);
          if (claudeDm < 60) gaps.push(`Claude: DM ${claudeDm}`);
          const result = {
            query: r.name, cat: 'QA', dm: combinedScore,
            pass, gap: gaps.length > 0 ? gaps.join(' | ') : null,
            restaurant: r.name, diff: 'deep',
          };
          recordResult(result);
          appendResultRow(result);
        } catch (e) {
          if (e.name === 'AbortError') break;
          // Fall back to regex-only result on error
          const result = {
            query: r.name, cat: 'QA', dm: regexScore,
            pass: regexPass, gap: regexPass ? null : `cliché: ${found.slice(0, 3).join(', ')}`,
            restaurant: r.name, diff: 'quick (fallback)',
          };
          recordResult(result);
          appendResultRow(result);
        }
      }
    }
  } catch (e) {
    if (e.name !== 'AbortError') {
      appendResultRow({ query: 'Blurb QA error', cat: 'QA', dm: 0, pass: false, gap: e.message });
    }
  }
  finishTest();
}

// Blurb mode toggle handler
function setBlurbMode(mode) {
  state.blurbMode = mode;
  document.querySelectorAll('.cc-blurb-mode button').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.mode === mode);
  });
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

/**
 * Persist any test results to gauntlet_runs + gauntlet_results.
 * Works for: broad scan, regression, category, edge, blurb, coverage, retest, CLI imports.
 * @param {Object} test - { type: string, results: [{query, cat, dm, pass, gap, restaurant}], startTime? }
 */
async function persistResults(test) {
  if (!sbClient || !test.results.length) return;

  try {
    const passed60 = test.results.filter(r => r.dm >= 60).length;
    const passed80 = test.results.filter(r => r.dm >= 80).length;
    const avgDm = test.results.reduce((s, r) => s + (r.dm || 0), 0) / test.results.length;
    const gapCount = test.results.filter(r => r.gap).length;
    const runId = `cc-${test.type}-${Date.now()}`;
    // Generate a dataset hash from queries for dedup/comparison
    const queryStr = test.results.map(r => r.query).sort().join('|');
    const datasetHash = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(queryStr))
      .then(buf => Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join(''))
      .catch(() => `${test.type}-${test.results.length}`);

    // Compute delta vs previous run of same type
    let deltaAvgDm = null;
    let prevRunId = null;
    try {
      const { data: prevRuns } = await sbClient.from('gauntlet_runs')
        .select('run_id, avg_dm')
        .eq('mode', test.type)
        .order('created_at', { ascending: false })
        .limit(1);
      if (prevRuns?.[0]) {
        prevRunId = prevRuns[0].run_id;
        deltaAvgDm = Math.round((avgDm - prevRuns[0].avg_dm) * 10) / 10;
      }
    } catch (_) {}

    const { error: runError } = await sbClient.from('gauntlet_runs').insert({
      run_id: runId,
      dataset_hash: datasetHash.slice(0, 16),
      dataset_size: test.results.length,
      mode: test.type,
      total: test.results.length,
      successful: test.results.length,
      passed_60: passed60,
      passed_80: passed80,
      avg_dm: Math.round(avgDm * 10) / 10,
      gap_count: gapCount,
      prev_run_id: prevRunId,
      delta_avg_dm: deltaAvgDm,
      delta_passed_60: null,
      delta_gap_count: null,
    });

    if (runError) {
      console.error('Failed to persist run:', runError.message, runError.hint);
      return;
    }

    const rows = test.results.map((r, i) => ({
      run_id: runId,
      query_id: r.queryId || `${test.type}-${i}`,
      query: r.query,
      category: r.cat || 'unknown',
      donde_match: r.dm || 0,
      score_pass: r.pass,
      gap_type: r.gap || null,
      gap_severity: r.severity || null,
      restaurant_name: r.restaurant || null,
      prev_dm: r.prevDm || null,
      delta_dm: r.prevDm != null ? (r.dm || 0) - r.prevDm : null,
    }));

    // Insert in batches of 50
    for (let i = 0; i < rows.length; i += 50) {
      const { error: resError } = await sbClient.from('gauntlet_results').insert(rows.slice(i, i + 50));
      if (resError) console.error('Failed to persist results batch:', resError.message, resError.hint);
    }

    // Refresh run history + pulse cards
    if (typeof loadRunHistory === 'function') loadRunHistory();
    if (typeof loadInitData === 'function') loadInitData();
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
