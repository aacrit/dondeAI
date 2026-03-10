/**
 * DondeAI Command Center — Comparative Run View
 * Compare two gauntlet runs side-by-side: improved, regressed, unchanged queries
 */

// ═══════════════════════════════════════════════════════════════════
// Compare Panel
// ═══════════════════════════════════════════════════════════════════

async function openCompareView(runIdA, runIdB) {
  if (!sbClient || !runIdA || !runIdB) return;
  state.compareRunA = runIdA;
  state.compareRunB = runIdB;
  state.compareOpen = true;
  state.compareFilter = 'all';

  const panel = document.getElementById('compare-panel');
  if (panel) {
    panel.style.display = '';
    panel.querySelector('.cc-compare__body').innerHTML = '<div class="cc-skeleton cc-skeleton--table"></div>';
  }

  try {
    const { data, error } = await sbClient.rpc('get_run_comparison', {
      p_run_a: runIdA,
      p_run_b: runIdB,
    });
    if (error) throw error;
    state.compareData = data || [];
    renderCompareView();
  } catch (e) {
    console.error('Compare failed:', e);
    const body = panel?.querySelector('.cc-compare__body');
    if (body) body.innerHTML = '<div class="cc-empty-state"><div class="cc-empty-state__text">Failed to load comparison</div></div>';
  }
}

function closeCompareView() {
  state.compareOpen = false;
  state.compareData = [];
  const panel = document.getElementById('compare-panel');
  if (panel) panel.style.display = 'none';
}

function setCompareFilter(filter) {
  state.compareFilter = filter;
  document.querySelectorAll('.cc-compare__filter-btn').forEach(b => {
    b.classList.toggle('cc-compare__filter-btn--active', b.dataset.filter === filter);
  });
  renderCompareView();
}

function renderCompareView() {
  const panel = document.getElementById('compare-panel');
  if (!panel) return;

  const data = state.compareData || [];
  const runA = state.runHistory.find(r => r.run_id === state.compareRunA);
  const runB = state.runHistory.find(r => r.run_id === state.compareRunB);

  // Categorize
  const improved = data.filter(d => d.delta > 0);
  const regressed = data.filter(d => d.delta < 0);
  const unchanged = data.filter(d => d.delta === 0);

  // Apply filter
  let filtered = data;
  if (state.compareFilter === 'improved') filtered = improved;
  else if (state.compareFilter === 'regressed') filtered = regressed;
  else if (state.compareFilter === 'unchanged') filtered = unchanged;

  // Summary header
  const headerEl = panel.querySelector('.cc-compare__header-info');
  if (headerEl) {
    const dateA = runA ? new Date(runA.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : state.compareRunA;
    const dateB = runB ? new Date(runB.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : state.compareRunB;
    const avgA = runA ? r1(runA.avg_dm) : '--';
    const avgB = runB ? r1(runB.avg_dm) : '--';
    const netDelta = data.length > 0 ? data.reduce((s, d) => s + (d.delta || 0), 0) : 0;
    const netSign = netDelta > 0 ? '+' : '';
    const netClass = netDelta > 0 ? 'rag-green' : netDelta < 0 ? 'rag-red' : '';
    headerEl.innerHTML = `
      <span class="cc-compare__run-label">Run A: ${dateA} (avg ${avgA})</span>
      <span class="cc-compare__vs">vs</span>
      <span class="cc-compare__run-label">Run B: ${dateB} (avg ${avgB})</span>
      <span class="cc-compare__net ${netClass}">Net: ${netSign}${netDelta} pts across ${data.length} queries</span>
    `;
  }

  // Filter counts
  const countsEl = panel.querySelector('.cc-compare__counts');
  if (countsEl) {
    countsEl.innerHTML = `
      <button class="cc-compare__filter-btn ${state.compareFilter === 'all' ? 'cc-compare__filter-btn--active' : ''}" data-filter="all" onclick="setCompareFilter('all')">All (${data.length})</button>
      <button class="cc-compare__filter-btn ${state.compareFilter === 'improved' ? 'cc-compare__filter-btn--active' : ''}" data-filter="improved" onclick="setCompareFilter('improved')">Improved (${improved.length})</button>
      <button class="cc-compare__filter-btn ${state.compareFilter === 'regressed' ? 'cc-compare__filter-btn--active' : ''}" data-filter="regressed" onclick="setCompareFilter('regressed')">Regressed (${regressed.length})</button>
      <button class="cc-compare__filter-btn ${state.compareFilter === 'unchanged' ? 'cc-compare__filter-btn--active' : ''}" data-filter="unchanged" onclick="setCompareFilter('unchanged')">Unchanged (${unchanged.length})</button>
    `;
  }

  // Rows
  const body = panel.querySelector('.cc-compare__body');
  if (!body) return;

  if (filtered.length === 0) {
    body.innerHTML = '<div class="cc-empty-state"><div class="cc-empty-state__text">No matching queries</div></div>';
    return;
  }

  body.innerHTML = filtered.map(d => {
    const delta = d.delta || 0;
    const cls = delta > 0 ? 'cc-compare__row--improved' : delta < 0 ? 'cc-compare__row--regressed' : 'cc-compare__row--unchanged';
    const sign = delta > 0 ? '+' : '';
    const dmAClass = ragClass(d.dm_a || 0);
    const dmBClass = ragClass(d.dm_b || 0);
    const gapChanged = d.gap_a !== d.gap_b;
    const restChanged = d.restaurant_a !== d.restaurant_b;
    return `
      <div class="cc-compare__row ${cls}">
        <span class="cc-compare__query">${escapeHtml(d.query || '')}</span>
        <span class="cc-compare__dm ${dmAClass}">${d.dm_a ?? '--'}</span>
        <span class="cc-compare__arrow">&rarr;</span>
        <span class="cc-compare__dm ${dmBClass}">${d.dm_b ?? '--'}</span>
        <span class="cc-compare__delta ${delta > 0 ? 'rag-green' : delta < 0 ? 'rag-red' : ''}">${sign}${delta}</span>
        ${gapChanged ? `<span class="cc-compare__gap-change">${d.gap_a || 'none'} &rarr; ${d.gap_b || 'none'}</span>` : ''}
        ${restChanged ? `<span class="cc-compare__rest-change" title="${escapeHtml(d.restaurant_a || '')} → ${escapeHtml(d.restaurant_b || '')}">&#8644;</span>` : ''}
      </div>
    `;
  }).join('');
}

function exportCompareCSV() {
  const data = state.compareData || [];
  if (!data.length) return;
  const headers = ['Query', 'Category', 'DM_A', 'DM_B', 'Delta', 'Gap_A', 'Gap_B', 'Restaurant_A', 'Restaurant_B'];
  const rows = data.map(d => [
    `"${(d.query || '').replace(/"/g, '""')}"`,
    d.category || '',
    d.dm_a ?? '',
    d.dm_b ?? '',
    d.delta ?? '',
    d.gap_a || '',
    d.gap_b || '',
    `"${(d.restaurant_a || '').replace(/"/g, '""')}"`,
    `"${(d.restaurant_b || '').replace(/"/g, '""')}"`,
  ]);
  downloadCSV([headers, ...rows], `compare-${state.compareRunA}-vs-${state.compareRunB}.csv`);
}

// ═══════════════════════════════════════════════════════════════════
// Anomaly Detection
// ═══════════════════════════════════════════════════════════════════

function checkForAnomalies(latestRun) {
  if (!latestRun || state.trendData.length < 3) {
    state.anomalyAlert = null;
    renderAnomalyBanner();
    return;
  }

  // Compare latest to average of previous runs (exclude latest)
  const prev = state.trendData.slice(1, 6); // up to 5 previous
  if (prev.length < 2) { state.anomalyAlert = null; renderAnomalyBanner(); return; }

  const avgDm = prev.reduce((s, r) => s + Number(r.avg_dm), 0) / prev.length;
  const avgGaps = prev.reduce((s, r) => s + r.gap_count, 0) / prev.length;
  const avgPassRate = prev.reduce((s, r) => s + (r.total > 0 ? r.passed_60 / r.total * 100 : 0), 0) / prev.length;

  const dmDrop = avgDm - Number(latestRun.avg_dm);
  const gapIncrease = avgGaps > 0 ? (latestRun.gap_count - avgGaps) / avgGaps * 100 : 0;
  const passRate = latestRun.total > 0 ? latestRun.passed_60 / latestRun.total * 100 : 0;
  const passDrop = avgPassRate - passRate;

  const alerts = [];
  if (dmDrop > 5) alerts.push(`Avg DM dropped ${r1(dmDrop)} pts vs 5-run average`);
  if (gapIncrease > 20) alerts.push(`Gap count increased ${Math.round(gapIncrease)}%`);
  if (passDrop > 15) alerts.push(`Pass rate dropped ${r1(passDrop)}%`);

  if (alerts.length > 0) {
    const severity = dmDrop > 10 || passDrop > 25 ? 'critical' : 'warning';
    state.anomalyAlert = {
      message: alerts.join('. ') + '.',
      severity,
      runId: latestRun.run_id,
      prevRunId: prev[0]?.run_id,
    };
  } else {
    state.anomalyAlert = null;
  }

  renderAnomalyBanner();
}

function renderAnomalyBanner() {
  let banner = document.getElementById('anomaly-banner');
  if (!state.anomalyAlert) {
    if (banner) banner.style.display = 'none';
    return;
  }

  if (!banner) {
    banner = document.createElement('div');
    banner.id = 'anomaly-banner';
    banner.className = 'cc-anomaly';
    const pulse = document.getElementById('pulse-section');
    if (pulse) pulse.after(banner);
    else return;
  }

  const a = state.anomalyAlert;
  const cls = a.severity === 'critical' ? 'cc-anomaly--critical' : 'cc-anomaly--warning';
  banner.className = `cc-anomaly ${cls}`;
  banner.style.display = '';
  banner.innerHTML = `
    <span class="cc-anomaly__icon">${a.severity === 'critical' ? '&#9888;' : '&#9432;'}</span>
    <span class="cc-anomaly__text">${escapeHtml(a.message)}</span>
    <button class="cc-btn cc-btn--sm" onclick="openCompareView('${a.prevRunId}', '${a.runId}')">Compare Runs</button>
    <button class="cc-anomaly__dismiss" onclick="dismissAnomaly()" title="Dismiss">&times;</button>
  `;
}

function dismissAnomaly() {
  state.anomalyAlert = null;
  const banner = document.getElementById('anomaly-banner');
  if (banner) banner.style.display = 'none';
}

// ═══════════════════════════════════════════════════════════════════
// Export Utilities
// ═══════════════════════════════════════════════════════════════════

function downloadCSV(rows, filename) {
  const csv = rows.map(r => r.join(',')).join('\n');
  const blob = new Blob([csv], { type: 'text/csv' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  a.click();
  URL.revokeObjectURL(a.href);
}

function downloadJSON(data, filename) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  a.click();
  URL.revokeObjectURL(a.href);
}

function exportRunHistory() {
  const runs = state.runHistory || [];
  if (!runs.length) { showToast('No run data to export'); return; }
  const headers = ['Date', 'Mode', 'Total', 'Passed_60', 'Avg_DM', 'Gap_Count', 'Delta_Avg_DM'];
  const rows = runs.map(r => [
    new Date(r.created_at).toISOString(),
    r.mode || '',
    r.total,
    r.passed_60,
    r.avg_dm,
    r.gap_count,
    r.delta_avg_dm ?? '',
  ]);
  downloadCSV([headers, ...rows], `run-history-${new Date().toISOString().slice(0,10)}.csv`);
  showToast('Run history exported');
}

function exportIssues() {
  const issues = state.issues || [];
  if (!issues.length) { showToast('No issues to export'); return; }
  const headers = ['Query', 'DM', 'Severity', 'Gap_Type', 'Category', 'Restaurant', 'Source', 'Status', 'Fix_Action'];
  const rows = issues.map(i => [
    `"${(i.query || '').replace(/"/g, '""')}"`,
    i.dm,
    i.severity,
    i.gapType,
    i.category,
    `"${(i.restaurant || '').replace(/"/g, '""')}"`,
    i.source,
    i.status || 'open',
    `"${(i.fixAction || '').replace(/"/g, '""')}"`,
  ]);
  downloadCSV([headers, ...rows], `issues-${new Date().toISOString().slice(0,10)}.csv`);
  showToast('Issues exported');
}

function exportLiveFeed() {
  const feed = state.liveFeed || [];
  if (!feed.length) { showToast('No live data to export'); return; }
  const headers = ['Timestamp', 'Query', 'DM', 'Restaurant'];
  const rows = feed.slice(0, 500).map(q => [
    new Date(q.created_at).toISOString(),
    `"${(q.special_request || '').replace(/"/g, '""')}"`,
    q.donde_match || 0,
    `"${(q.restaurants?.name || '').replace(/"/g, '""')}"`,
  ]);
  downloadCSV([headers, ...rows], `live-feed-${new Date().toISOString().slice(0,10)}.csv`);
  showToast('Live feed exported');
}

function exportTestResults() {
  const results = state.activeTest?.results || [];
  if (!results.length) { showToast('No test results to export'); return; }
  const headers = ['Query', 'Category', 'DM', 'Pass', 'Gap', 'Restaurant'];
  const rows = results.map(r => [
    `"${(r.query || '').replace(/"/g, '""')}"`,
    r.cat || '',
    r.dm || 0,
    r.pass ? 'Y' : 'N',
    r.gap || '',
    `"${(r.restaurant || '').replace(/"/g, '""')}"`,
  ]);
  downloadCSV([headers, ...rows], `test-results-${new Date().toISOString().slice(0,10)}.csv`);
  showToast('Test results exported');
}

// ═══════════════════════════════════════════════════════════════════
// Auto-Refresh
// ═══════════════════════════════════════════════════════════════════

function toggleAutoRefresh() {
  state.autoRefresh = !state.autoRefresh;
  const btn = document.getElementById('auto-refresh-toggle');
  if (btn) btn.classList.toggle('cc-auto-refresh__toggle--active', state.autoRefresh);

  if (state.autoRefresh) {
    startAutoRefresh();
  } else {
    stopAutoRefresh();
  }
  saveSession();
}

function setAutoRefreshInterval(secs) {
  state.autoRefreshSecs = Number(secs);
  if (state.autoRefresh) {
    stopAutoRefresh();
    startAutoRefresh();
  }
  saveSession();
}

function startAutoRefresh() {
  stopAutoRefresh();
  state.autoRefreshCountdown = state.autoRefreshSecs;
  updateCountdownDisplay();
  state.autoRefreshTimer = setInterval(() => {
    state.autoRefreshCountdown--;
    if (state.autoRefreshCountdown <= 0) {
      refreshAllData();
      state.autoRefreshCountdown = state.autoRefreshSecs;
    }
    updateCountdownDisplay();
  }, 1000);
}

function stopAutoRefresh() {
  if (state.autoRefreshTimer) {
    clearInterval(state.autoRefreshTimer);
    state.autoRefreshTimer = null;
  }
  state.autoRefreshCountdown = 0;
  updateCountdownDisplay();
}

function updateCountdownDisplay() {
  const el = document.getElementById('auto-refresh-countdown');
  if (!el) return;
  if (!state.autoRefresh || state.autoRefreshCountdown <= 0) {
    el.textContent = '';
    return;
  }
  el.textContent = `${state.autoRefreshCountdown}s`;
  // Update ring progress
  const ring = document.getElementById('auto-refresh-ring');
  if (ring) {
    const pct = state.autoRefreshCountdown / state.autoRefreshSecs;
    ring.style.strokeDashoffset = 62.8 * (1 - pct);
  }
}

async function refreshAllData() {
  showToast('Refreshing...');
  await Promise.all([
    loadInitData(),
    loadRunHistory(),
    loadIssues(),
    typeof loadTrendData === 'function' ? loadTrendData() : Promise.resolve(),
  ]);
  if (typeof loadHeatmapData === 'function') loadHeatmapData();
  showToast('Data refreshed');
}

// ═══════════════════════════════════════════════════════════════════
// Test Coverage Heatmap
// ═══════════════════════════════════════════════════════════════════

async function loadHeatmapData() {
  if (!sbClient) return;
  try {
    const { data } = await sbClient
      .from('gauntlet_results')
      .select('category, tier, donde_match')
      .not('category', 'is', null)
      .order('run_id', { ascending: false })
      .limit(500);

    if (!data) return;

    // Group by category × tier
    const grid = {};
    const cats = ['Food', 'Vibe', 'Service', 'Rep', 'Conv'];
    const tiers = [1, 2, 3]; // easy, medium, hard
    for (const cat of cats) {
      grid[cat] = {};
      for (const t of tiers) grid[cat][t] = { scores: [], count: 0 };
    }

    for (const r of data) {
      const cat = r.category;
      const tier = r.tier || 1;
      if (grid[cat] && grid[cat][tier]) {
        grid[cat][tier].scores.push(r.donde_match);
        grid[cat][tier].count++;
      }
    }

    // Compute averages
    for (const cat of cats) {
      for (const t of tiers) {
        const cell = grid[cat][t];
        cell.avgDm = cell.scores.length > 0
          ? cell.scores.reduce((s, v) => s + v, 0) / cell.scores.length
          : null;
      }
    }

    state.heatmapData = grid;
    renderHeatmap();
  } catch (e) {
    console.warn('Heatmap load failed:', e);
  }
}

function renderHeatmap() {
  const container = document.getElementById('heatmap-grid');
  if (!container) return;

  const grid = state.heatmapData;
  if (!grid || !Object.keys(grid).length) {
    container.innerHTML = '<div class="cc-empty-state"><div class="cc-empty-state__text">No test coverage data</div></div>';
    return;
  }

  const cats = ['Food', 'Vibe', 'Service', 'Rep', 'Conv'];
  const tierLabels = { 1: 'Easy', 2: 'Med', 3: 'Hard' };
  const tiers = [1, 2, 3];

  let html = '<div class="cc-heatmap__header"><span></span>';
  for (const t of tiers) html += `<span class="cc-heatmap__col-label">${tierLabels[t]}</span>`;
  html += '</div>';

  for (const cat of cats) {
    html += `<div class="cc-heatmap__row"><span class="cc-heatmap__row-label">${cat}</span>`;
    for (const t of tiers) {
      const cell = grid[cat]?.[t];
      const avgDm = cell?.avgDm;
      const count = cell?.count || 0;
      const cls = avgDm != null ? ragClass(avgDm) : '';
      const opacity = count === 0 ? 'opacity:0.3' : '';
      html += `<span class="cc-heatmap__cell ${cls}" style="${opacity}" title="${cat} ${tierLabels[t]}: ${count} tests, avg DM ${avgDm != null ? Math.round(avgDm) : '--'}">${count > 0 ? Math.round(avgDm) : '--'}<small>${count}</small></span>`;
    }
    html += '</div>';
  }

  container.innerHTML = html;
}

// ═══════════════════════════════════════════════════════════════════
// Deep Dive Overlay (Tier 3 Progressive Disclosure)
// ═══════════════════════════════════════════════════════════════════

async function openDeepDive(type, data) {
  const overlay = document.getElementById('deep-dive-overlay');
  if (!overlay) return;

  overlay.style.display = '';
  requestAnimationFrame(() => overlay.classList.add('cc-overlay--open'));

  const title = overlay.querySelector('.cc-overlay__title');
  const body = overlay.querySelector('.cc-overlay__body');
  if (!body) return;

  body.innerHTML = '<div class="cc-skeleton cc-skeleton--table"></div>';

  if (type === 'run' && data?.run_id) {
    if (title) title.textContent = `Run Details: ${new Date(data.created_at).toLocaleDateString()}`;
    try {
      const { data: results } = await sbClient
        .from('gauntlet_results')
        .select('query, donde_match, gap_type, category, restaurant_name, food, vibe, service, reputation, convenience, delta_dm')
        .eq('run_id', data.run_id)
        .order('donde_match', { ascending: true });

      if (!results?.length) {
        body.innerHTML = '<div class="cc-empty-state"><div class="cc-empty-state__text">No results for this run</div></div>';
        return;
      }

      body.innerHTML = `
        <div class="cc-deep-dive__summary">
          <span>Total: ${data.total}</span>
          <span>Pass: ${data.passed_60} (${pct(data.passed_60, data.total)}%)</span>
          <span class="${ragClass(Number(data.avg_dm))}">Avg DM: ${r1(data.avg_dm)}</span>
          <span>Gaps: ${data.gap_count}</span>
        </div>
        <div class="cc-deep-dive__table">
          ${results.map(r => `
            <div class="cc-deep-dive__row ${r.gap_type ? 'cc-deep-dive__row--gap' : ''}">
              <span class="cc-deep-dive__dm ${ragClass(r.donde_match)}">${r.donde_match}</span>
              <span class="cc-deep-dive__query">${escapeHtml(r.query)}</span>
              <span class="cc-deep-dive__cat">${r.category || ''}</span>
              <span class="cc-deep-dive__rest">${escapeHtml(r.restaurant_name || '')}</span>
              ${r.gap_type ? `<span class="cc-deep-dive__gap">${r.gap_type}</span>` : ''}
              ${r.delta_dm != null ? `<span class="${r.delta_dm >= 0 ? 'rag-green' : 'rag-red'}">${r.delta_dm >= 0 ? '+' : ''}${r.delta_dm}</span>` : ''}
            </div>
          `).join('')}
        </div>
      `;
    } catch (e) {
      body.innerHTML = '<div class="cc-empty-state"><div class="cc-empty-state__text">Failed to load run details</div></div>';
    }

  } else if (type === 'issue' && data?.query) {
    if (title) title.textContent = `Query History: "${data.query}"`;
    const queryId = data.queryId || data.query.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-');
    try {
      const { data: history } = await sbClient.rpc('get_query_history', { p_query_id: queryId });

      if (!history?.length) {
        body.innerHTML = `
          <div class="cc-deep-dive__issue-info">
            <div>Current DM: <span class="${ragClass(data.dm)}">${data.dm}</span></div>
            <div>Gap Type: ${data.gapType}</div>
            <div>Restaurant: ${escapeHtml(data.restaurant)}</div>
            <div>Fix: ${escapeHtml(data.fixAction)}</div>
          </div>
          <div class="cc-empty-state"><div class="cc-empty-state__text">No historical data for this query</div></div>
        `;
        return;
      }

      body.innerHTML = `
        <div class="cc-deep-dive__issue-info">
          <div>Current DM: <span class="${ragClass(data.dm)}">${data.dm}</span> &middot; Gap: ${data.gapType} &middot; ${data.severity}</div>
          <div>Restaurant: ${escapeHtml(data.restaurant)}</div>
        </div>
        <div class="cc-deep-dive__sparkline-large">
          ${history.map(h => {
            const height = Math.max(h.donde_match * 0.8, 4);
            return `<div class="cc-sparkline__bar-lg ${ragClass(h.donde_match)}" style="height:${height}px" title="DM ${h.donde_match} — ${new Date(h.created_at).toLocaleDateString()}"></div>`;
          }).join('')}
        </div>
        <div class="cc-deep-dive__table">
          ${history.map(h => `
            <div class="cc-deep-dive__row">
              <span class="cc-deep-dive__dm ${ragClass(h.donde_match)}">${h.donde_match}</span>
              <span>${new Date(h.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</span>
              <span>${h.gap_type || 'pass'}</span>
              <span>${escapeHtml(h.restaurant_name || '')}</span>
            </div>
          `).join('')}
        </div>
      `;
    } catch (e) {
      body.innerHTML = '<div class="cc-empty-state"><div class="cc-empty-state__text">Failed to load query history</div></div>';
    }

  } else if (type === 'pulse') {
    if (title) title.textContent = `Trend Analysis: ${data?.label || 'Overview'}`;
    const trend = state.trendData || [];
    if (!trend.length) {
      body.innerHTML = '<div class="cc-empty-state"><div class="cc-empty-state__text">Not enough data for trend analysis</div></div>';
      return;
    }

    body.innerHTML = `
      <div class="cc-deep-dive__charts">
        <div class="cc-deep-dive__chart-section">
          <div class="cc-deep-dive__chart-title">Avg DondeMatch (last ${trend.length} runs)</div>
          <div class="cc-deep-dive__sparkline-large">
            ${trend.slice().reverse().map(r => {
              const height = Math.max(Number(r.avg_dm) * 0.8, 4);
              return `<div class="cc-sparkline__bar-lg ${ragClass(Number(r.avg_dm))}" style="height:${height}px" title="DM ${r1(r.avg_dm)} — ${new Date(r.created_at).toLocaleDateString()}"></div>`;
            }).join('')}
          </div>
        </div>
        <div class="cc-deep-dive__chart-section">
          <div class="cc-deep-dive__chart-title">Pass Rate %</div>
          <div class="cc-deep-dive__sparkline-large">
            ${trend.slice().reverse().map(r => {
              const pctVal = r.total > 0 ? r.passed_60 / r.total * 100 : 0;
              const height = Math.max(pctVal * 0.6, 4);
              return `<div class="cc-sparkline__bar-lg ${ragClass(pctVal)}" style="height:${height}px" title="${Math.round(pctVal)}% — ${new Date(r.created_at).toLocaleDateString()}"></div>`;
            }).join('')}
          </div>
        </div>
        <div class="cc-deep-dive__chart-section">
          <div class="cc-deep-dive__chart-title">Gap Count</div>
          <div class="cc-deep-dive__sparkline-large">
            ${trend.slice().reverse().map(r => {
              const maxGap = Math.max(...trend.map(t => t.gap_count), 1);
              const height = Math.max((r.gap_count / maxGap) * 60, 4);
              return `<div class="cc-sparkline__bar-lg ${r.gap_count > 5 ? 'rag-red' : r.gap_count > 0 ? 'rag-amber' : 'rag-green'}" style="height:${height}px" title="${r.gap_count} gaps — ${new Date(r.created_at).toLocaleDateString()}"></div>`;
            }).join('')}
          </div>
        </div>
      </div>
    `;
  }
}

function closeDeepDive() {
  const overlay = document.getElementById('deep-dive-overlay');
  if (!overlay) return;
  overlay.classList.remove('cc-overlay--open');
  setTimeout(() => { overlay.style.display = 'none'; }, 300);
}

// ═══════════════════════════════════════════════════════════════════
// Performance Baseline
// ═══════════════════════════════════════════════════════════════════

function computePerfBaseline() {
  const runs = state.trendData || [];
  const times = runs.map(r => r.avg_response_ms || 0).filter(t => t > 0).sort((a, b) => a - b);
  if (times.length === 0) return;

  const p = (arr, pct) => arr[Math.min(Math.floor(arr.length * pct / 100), arr.length - 1)] || 0;
  state.perfBaseline = { p50: p(times, 50), p90: p(times, 90), p99: p(times, 99) };

  // Render in API health section
  const el = document.getElementById('api-perf-baseline');
  if (el) {
    const warn = state.perfBaseline.p90 > 5000 ? ' rag-red' : '';
    el.innerHTML = `p50: ${state.perfBaseline.p50}ms · <span class="${warn}">p90: ${state.perfBaseline.p90}ms</span>`;
  }
}
