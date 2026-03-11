/**
 * DondeAI Command Center v2 — UI Rendering
 * Tab system, pulse cards, test result stream, live feed, data health
 */

// ═══════════════════════════════════════════════════════════════════
// Init
// ═══════════════════════════════════════════════════════════════════

document.addEventListener('DOMContentLoaded', () => {
  checkAuth();
  initKeyboardShortcuts();
  initPulseClicks();
  positionTabIndicator();
});

// ═══════════════════════════════════════════════════════════════════
// Tab System
// ═══════════════════════════════════════════════════════════════════

function switchTab(name) {
  state.activeTab = name;
  saveSession();

  // Update tab buttons
  document.querySelectorAll('.cc-tab').forEach(t => {
    const active = t.dataset.tab === name;
    t.classList.toggle('cc-tab--active', active);
    t.setAttribute('aria-selected', active);
  });

  // Update tab panels
  document.querySelectorAll('.cc-tab-panel').forEach(p => {
    p.classList.toggle('cc-tab-panel--active', p.id === `panel-${name}`);
  });

  // Position indicator
  positionTabIndicator();

  // Start live polling when switching to live tab
  if (name === 'live' && !state.livePollTimer) {
    if (typeof startLivePolling === 'function') startLivePolling();
  }

  // Switch pulse mode based on tab
  if (name === 'live') {
    state.pulseMode = 'prod';
    updatePulseFromProd();
    document.getElementById('pulse-section')?.classList.add('cc-pulse--prod');
  } else {
    state.pulseMode = 'test';
    document.getElementById('pulse-section')?.classList.remove('cc-pulse--prod');
    // Restore pulse from selected run or latest run
    const run = (state.selectedRunId && state.runHistory.find(r => r.run_id === state.selectedRunId)) || state.latestRun;
    if (run) updatePulseFromRun(run);
  }
}

function positionTabIndicator() {
  const indicator = document.getElementById('tab-indicator');
  const activeTab = document.querySelector('.cc-tab--active');
  if (!indicator || !activeTab) return;
  indicator.style.left = activeTab.offsetLeft + 'px';
  indicator.style.width = activeTab.offsetWidth + 'px';
}

// ═══════════════════════════════════════════════════════════════════
// System Status
// ═══════════════════════════════════════════════════════════════════

function updateSystemStatus(text, color) {
  const dot = document.getElementById('status-dot');
  const label = document.getElementById('status-text');
  if (dot) {
    dot.className = 'cc-header__dot';
    if (color === 'green') dot.classList.add('cc-header__dot--online');
    else if (color === 'amber') dot.classList.add('cc-header__dot--amber');
    else dot.classList.add('cc-header__dot--offline');
  }
  if (label) label.textContent = text;
}

// ═══════════════════════════════════════════════════════════════════
// Pulse Cards
// ═══════════════════════════════════════════════════════════════════

// ── Pulse Card Click Handlers ──

function initPulseClicks() {
  const health = document.getElementById('pulse-health');
  const quality = document.getElementById('pulse-quality');
  const attention = document.getElementById('pulse-attention');

  if (health) health.addEventListener('click', () => togglePulseExpand('health'));
  if (quality) quality.addEventListener('click', () => togglePulseExpand('quality'));
  if (attention) attention.addEventListener('click', () => togglePulseExpand('attention'));
}

// ── Pulse Expand/Collapse ──

function togglePulseExpand(cardId) {
  const card = document.getElementById(`pulse-${cardId}`);
  if (!card) return;

  if (state.expandedPulse === cardId) {
    card.classList.remove('cc-pulse__card--expanded');
    state.expandedPulse = null;
    return;
  }

  if (state.expandedPulse) {
    const prev = document.getElementById(`pulse-${state.expandedPulse}`);
    if (prev) prev.classList.remove('cc-pulse__card--expanded');
  }

  state.expandedPulse = cardId;
  card.classList.add('cc-pulse__card--expanded');

  const expandEl = card.querySelector('.cc-pulse__expand');
  if (!expandEl) return;

  const run = (state.selectedRunId && state.runHistory.find(r => r.run_id === state.selectedRunId)) || state.latestRun;
  const trend = state.trendData || [];

  if (cardId === 'health' && run) {
    const passRate = run.total > 0 ? (run.passed_60 / run.total * 100) : 0;
    const prevRun = trend.length > 1 ? trend[1] : null;
    const prevPassRate = prevRun && prevRun.total > 0 ? (prevRun.passed_60 / prevRun.total * 100) : null;
    const delta = prevPassRate !== null ? passRate - prevPassRate : null;

    // Verdict
    let verdict, verdictClass;
    if (passRate >= 80) { verdict = 'System is healthy'; verdictClass = 'rag-green'; }
    else if (passRate >= 60) { verdict = 'Needs attention'; verdictClass = 'rag-amber'; }
    else { verdict = 'Degraded — action required'; verdictClass = 'rag-red'; }

    // Change narrative
    let changeNarrative = '';
    if (delta !== null) {
      const dir = delta > 0 ? 'up' : delta < 0 ? 'down' : 'flat';
      const cls = delta >= 0 ? 'rag-green' : 'rag-red';
      changeNarrative = `<span class="cc-pulse__detail">vs. last run: <span class="${cls}">${delta > 0 ? '+' : ''}${delta.toFixed(1)}%</span> ${dir === 'up' ? '&#8593;' : dir === 'down' ? '&#8595;' : '&#8594;'}</span>`;
    }

    // Failing queries to surface
    const openIssues = (state.issues || []).filter(i => (!i.status || i.status === 'open'));
    const failNote = openIssues.length > 0
      ? `<span class="cc-pulse__detail cc-pulse__detail--action" onclick="switchTab('issues')" style="cursor:pointer">${openIssues.length} open issue${openIssues.length > 1 ? 's' : ''} — view &rarr;</span>`
      : '<span class="cc-pulse__detail rag-green">No open issues</span>';

    expandEl.innerHTML = `
      <div class="cc-pulse__verdict ${verdictClass}">${verdict}</div>
      <span class="cc-pulse__detail">${run.passed_60}/${run.total} queries pass (DM &ge; 60)</span>
      ${changeNarrative}
      ${failNote}
    `;

  } else if (cardId === 'quality' && run) {
    const avgDm = Number(run.avg_dm);
    const recentTrend = trend.slice(0, 5).map(r => Number(r.avg_dm));
    const olderTrend = trend.slice(5, 10).map(r => Number(r.avg_dm));
    const recentAvg = recentTrend.length ? recentTrend.reduce((a, b) => a + b, 0) / recentTrend.length : 0;
    const olderAvg = olderTrend.length ? olderTrend.reduce((a, b) => a + b, 0) / olderTrend.length : 0;

    // Trend direction narrative
    let trendNarrative;
    if (olderTrend.length === 0) {
      trendNarrative = 'Not enough history for trend';
    } else {
      const trendDelta = recentAvg - olderAvg;
      const trendDir = trendDelta > 1 ? 'trending up' : trendDelta < -1 ? 'trending down' : 'holding steady';
      const trendCls = trendDelta > 1 ? 'rag-green' : trendDelta < -1 ? 'rag-red' : 'rag-amber';
      trendNarrative = `Quality <span class="${trendCls}">${trendDir}</span> — ${Math.abs(trendDelta).toFixed(1)} pts over last ${trend.length} runs`;
    }

    // Category insight from issues data
    const issues = state.issues || [];
    const catScores = {};
    for (const i of issues) {
      if (i.category && i.category !== '--' && i.category !== 'unknown') {
        if (!catScores[i.category]) catScores[i.category] = { sum: 0, count: 0 };
        catScores[i.category].sum += i.dm;
        catScores[i.category].count++;
      }
    }
    const cats = Object.entries(catScores).map(([c, d]) => ({ cat: c, avg: d.sum / d.count })).sort((a, b) => a.avg - b.avg);
    const weakest = cats.length > 0 ? cats[0] : null;
    const catInsight = weakest
      ? `<span class="cc-pulse__detail">Weakest category: <strong>${weakest.cat}</strong> (avg DM ${weakest.avg.toFixed(0)}) — ${cats.length > 1 ? `strongest: ${cats[cats.length - 1].cat} (${cats[cats.length - 1].avg.toFixed(0)})` : ''}</span>`
      : '';

    const deltaNote = run.delta_avg_dm != null
      ? `<span class="cc-pulse__detail">vs. last run: <span class="${run.delta_avg_dm >= 0 ? 'rag-green' : 'rag-red'}">${run.delta_avg_dm >= 0 ? '+' : ''}${r1(run.delta_avg_dm)}</span></span>`
      : '';

    expandEl.innerHTML = `
      <div class="cc-pulse__verdict ${ragClass(avgDm)}">Avg DondeMatch: ${r1(avgDm)}</div>
      <span class="cc-pulse__detail">${trendNarrative}</span>
      ${deltaNote}
      ${catInsight}
    `;

  } else if (cardId === 'attention' && run) {
    const openIssues = (state.issues || []).filter(i => (!i.status || i.status === 'open'));
    const p0 = openIssues.filter(i => i.severity === 'P0');
    const p1 = openIssues.filter(i => i.severity === 'P1');

    // Priority summary
    let urgency, urgencyCls;
    if (p0.length > 0) { urgency = `${p0.length} critical issue${p0.length > 1 ? 's' : ''} need immediate attention`; urgencyCls = 'rag-red'; }
    else if (p1.length > 0) { urgency = `${p1.length} important issue${p1.length > 1 ? 's' : ''} to review`; urgencyCls = 'rag-amber'; }
    else if (openIssues.length > 0) { urgency = `${openIssues.length} minor issue${openIssues.length > 1 ? 's' : ''} tracked`; urgencyCls = 'rag-green'; }
    else { urgency = 'All clear — no open issues'; urgencyCls = 'rag-green'; }

    // Show top 2 issues with context
    const topIssues = openIssues.slice(0, 2);
    const issueLines = topIssues.map(g =>
      `<div class="cc-pulse__issue-row">
        <span class="cc-pulse__issue-sev cc-pulse__issue-sev--${g.severity?.toLowerCase() || 'p2'}">${g.severity || 'P2'}</span>
        <span class="cc-pulse__detail">"${escapeHtml(g.query)}" &mdash; <span class="${ragClass(g.dm)}">DM ${g.dm}</span> &middot; ${escapeHtml(g.gapType || '')}</span>
      </div>`
    ).join('');

    // Gap type breakdown
    const gapTypes = {};
    for (const i of openIssues) { gapTypes[i.gapType] = (gapTypes[i.gapType] || 0) + 1; }
    const topGapType = Object.entries(gapTypes).sort((a, b) => b[1] - a[1])[0];
    const patternNote = topGapType
      ? `<span class="cc-pulse__detail">Most common pattern: <strong>${topGapType[0]}</strong> (${topGapType[1]}x)</span>`
      : '';

    expandEl.innerHTML = `
      <div class="cc-pulse__verdict ${urgencyCls}">${urgency}</div>
      ${issueLines}
      ${patternNote}
      ${openIssues.length > 2 ? `<span class="cc-pulse__detail cc-pulse__detail--action" onclick="switchTab('issues')" style="cursor:pointer">View all ${openIssues.length} issues &rarr;</span>` : ''}
    `;

  } else {
    expandEl.innerHTML = '<span class="cc-pulse__detail">No data yet</span>';
  }
}

function renderSparkline(values, maxVal) {
  if (!values.length) return '';
  const max = maxVal || Math.max(...values, 1);
  return values.map((v, i) => {
    const height = Math.max((v / max) * 28, 3);
    const cls = ragClass(v);
    return `<span class="cc-sparkline__bar ${cls}" style="height:${height}px" title="${Math.round(v)}"></span>`;
  }).join('');
}

function renderSparklineInverted(values) {
  if (!values.length) return '';
  const max = Math.max(...values, 1);
  return values.map(v => {
    const height = Math.max((v / max) * 28, 3);
    const cls = v > 5 ? 'rag-red' : v > 0 ? 'rag-amber' : 'rag-green';
    return `<span class="cc-sparkline__bar ${cls}" style="height:${height}px" title="${v} gaps"></span>`;
  }).join('');
}

// ── Pulse Reactivity ──

function updatePulseFromRun(run) {
  if (!run) return;
  const passRate = run.total > 0 ? (run.passed_60 / run.total * 100) : 0;
  updatePulseHealth(passRate, `from ${run.mode || 'test'} run ${timeAgo(run.created_at)}`);
  updatePulseQuality(run.avg_dm, `${run.total} queries tested`, run.delta_avg_dm);
  updatePulseAttention(run.gap_count, run.gap_count > 5 ? 'action needed' : 'manageable');

  // Update freshness to this run's time
  const ago = timeAgo(run.created_at);
  ['pulse-health-fresh', 'pulse-quality-fresh', 'pulse-attention-fresh'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.textContent = `Updated ${ago}`;
  });
}

function updatePulseFromProd() {
  const sevenDaysAgo = new Date(Date.now() - 7 * 86400000).toISOString();
  const prodQueries = (state.liveFeed || []).filter(q => q.created_at >= sevenDaysAgo && q.source !== 'command-center');
  const count = prodQueries.length;
  if (count === 0) {
    updatePulseHealth(0, 'no prod queries (7d)');
    updatePulseQuality(0, 'no prod data', null);
    updatePulseAttention(0, 'no data');
    return;
  }
  const avgDm = prodQueries.reduce((s, q) => s + (q.donde_match || 0), 0) / count;
  const passRate = (prodQueries.filter(q => (q.donde_match || 0) >= 60).length / count * 100);
  const lowCount = prodQueries.filter(q => (q.donde_match || 0) < 60).length;
  updatePulseHealth(passRate, `${count} prod queries (7d)`);
  updatePulseQuality(avgDm, `${count} prod queries (7d)`, null);
  updatePulseAttention(lowCount, lowCount > 5 ? 'action needed' : 'looks good');

  ['pulse-health-fresh', 'pulse-quality-fresh', 'pulse-attention-fresh'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.textContent = 'Live (7d)';
  });
}

function selectRun(runId) {
  const run = (state.runHistory || []).find(r => r.run_id === runId);
  if (!run) return;

  // Toggle selection
  if (state.selectedRunId === runId) {
    state.selectedRunId = null;
    document.querySelectorAll('.cc-run-row--selected').forEach(r => r.classList.remove('cc-run-row--selected'));
    // Restore to latest run
    if (state.latestRun) updatePulseFromRun(state.latestRun);
    return;
  }

  state.selectedRunId = runId;

  // Highlight selected row
  document.querySelectorAll('.cc-run-row--selected').forEach(r => r.classList.remove('cc-run-row--selected'));
  const row = document.querySelector(`.cc-run-row[data-run-id="${runId}"]`);
  if (row) row.classList.add('cc-run-row--selected');

  // Update pulse cards from this run
  updatePulseFromRun(run);
}

function updatePulseHealth(pctVal, sub) {
  const ring = document.getElementById('pulse-health-ring');
  const val = document.getElementById('pulse-health-val');
  const subEl = document.getElementById('pulse-health-sub');

  if (val) val.textContent = Math.round(pctVal) + '%';
  if (subEl) subEl.textContent = sub;

  if (ring) {
    const offset = 213.6 * (1 - pctVal / 100);
    ring.style.strokeDashoffset = offset;
    ring.style.stroke = ragColor(pctVal);
    ring.style.transition = 'stroke-dashoffset 0.9s cubic-bezier(0.22, 1, 0.36, 1), stroke 0.3s ease';
  }

  const card = document.getElementById('pulse-health');
  if (card) card.className = `cc-pulse__card cc-pulse__card--health ${ragClass(pctVal)}`;
}

function updatePulseQuality(dm, sub, delta) {
  const val = document.getElementById('pulse-quality-val');
  const subEl = document.getElementById('pulse-quality-sub');
  if (val) {
    val.textContent = Math.round(dm);
    val.className = `cc-pulse__big ${ragClass(dm)}`;
  }
  if (subEl) {
    let text = sub;
    if (delta != null && delta !== 0) {
      const sign = delta > 0 ? '+' : '';
      const cls = delta > 0 ? 'rag-green' : 'rag-red';
      text += ` <span class="${cls}">${sign}${Math.round(delta * 10) / 10}</span>`;
    }
    subEl.innerHTML = text;
  }
}

function updatePulseAttention(count, sub) {
  const val = document.getElementById('pulse-attention-val');
  const subEl = document.getElementById('pulse-attention-sub');
  if (val) {
    val.textContent = count;
    if (count > 5) val.className = 'cc-pulse__big cc-pulse__big--attention rag-red';
    else if (count > 0) val.className = 'cc-pulse__big cc-pulse__big--attention rag-amber';
    else val.className = 'cc-pulse__big cc-pulse__big--attention rag-green';
  }
  if (subEl) subEl.textContent = sub;
}

// ═══════════════════════════════════════════════════════════════════
// Test Progress Bar
// ═══════════════════════════════════════════════════════════════════

function showTestProgress(name, current, total, avgDm) {
  const el = document.getElementById('test-progress');
  const nameEl = document.getElementById('test-progress-name');
  const statsEl = document.getElementById('test-progress-stats');
  const fillEl = document.getElementById('test-progress-fill');

  if (el) el.style.display = '';
  if (nameEl) nameEl.textContent = name;
  if (statsEl) statsEl.textContent = `${current}/${total}  ·  avg DM: ${Math.round(avgDm)}`;
  if (fillEl) fillEl.style.width = (current / total * 100) + '%';
}

// ═══════════════════════════════════════════════════════════════════
// Result Stream (Test tab)
// ═══════════════════════════════════════════════════════════════════

function appendResultRow(result) {
  const stream = document.getElementById('result-stream');
  if (!stream) return;

  const row = document.createElement('div');
  row.className = `cc-result-row ${result.pass ? 'cc-result-row--pass' : 'cc-result-row--fail'} cc-result-row--enter`;

  const icon = result.pass ? '&#10003;' : '&#10007;';
  const dmClass = ragClass(result.dm);
  const query = escapeHtml(result.query || '');
  const cat = result.cat ? `<span class="cc-result-row__cat">${escapeHtml(result.cat)}</span>` : '';
  const diff = result.diff ? `<span class="cc-result-row__diff">${escapeHtml(result.diff)}</span>` : '';

  row.innerHTML = `
    <span class="cc-result-row__icon">${icon}</span>
    <span class="cc-result-row__dm ${dmClass}">${result.dm || 0}</span>
    <span class="cc-result-row__query">${query}</span>
    <span class="cc-result-row__meta">${cat}${diff}</span>
  `;

  // Gap detail for failures
  if (result.gap) {
    const gapEl = document.createElement('div');
    gapEl.className = 'cc-result-row__gap';
    gapEl.innerHTML = `&rarr; ${escapeHtml(result.gap)}${result.restaurant ? ` (${escapeHtml(result.restaurant)})` : ''}`;
    row.appendChild(gapEl);
  }

  // Baseline info for regression tests
  if (result.baseline !== undefined) {
    const baseEl = document.createElement('div');
    baseEl.className = 'cc-result-row__baseline';
    const delta = result.delta >= 0 ? `+${result.delta}` : result.delta;
    baseEl.innerHTML = `baseline: ${result.baseline} · delta: <span class="${result.delta >= 0 ? 'rag-green' : 'rag-red'}">${delta}</span>`;
    row.appendChild(baseEl);
  }

  stream.appendChild(row);
  stream.scrollTop = stream.scrollHeight;

  // Trigger enter animation
  requestAnimationFrame(() => row.classList.remove('cc-result-row--enter'));
}

function appendSummaryRow(name, total, passed, avgDm, elapsed) {
  const stream = document.getElementById('result-stream');
  if (!stream) return;

  const row = document.createElement('div');
  row.className = 'cc-result-summary';
  const passRate = pct(passed, total);
  row.innerHTML = `
    <div class="cc-result-summary__title">${escapeHtml(name)} Complete</div>
    <div class="cc-result-summary__stats">
      <span>${total} queries</span>
      <span class="${ragClass(Number(passRate))}">${passRate}% pass</span>
      <span class="${ragClass(avgDm)}">avg DM ${Math.round(avgDm)}</span>
      <span>${elapsed}s</span>
    </div>
  `;
  stream.appendChild(row);
}

// ═══════════════════════════════════════════════════════════════════
// Live Feed (Live tab)
// ═══════════════════════════════════════════════════════════════════

function renderLiveFeed(queries) {
  const list = document.getElementById('live-feed-list');
  if (!list) return;

  if (!queries || queries.length === 0) {
    list.innerHTML = '<div class="cc-empty-state"><div class="cc-empty-state__icon">&#128225;</div><div class="cc-empty-state__text">No queries recorded yet</div></div>';
    return;
  }

  // Rate calculation (queries per minute in last 5 min)
  const fiveMinAgo = Date.now() - 300000;
  const recentCount = queries.filter(q => new Date(q.created_at).getTime() > fiveMinAgo).length;
  const rate = (recentCount / 5).toFixed(1);
  const rateEl = document.getElementById('live-rate');
  if (rateEl) rateEl.textContent = `${rate} queries/min`;

  list.innerHTML = queries.map(q => {
    const dm = q.donde_match || 0;
    const restName = q.restaurants?.name || null;
    const icon = dm >= 60 ? '&#10003;' : dm >= 40 ? '&#9888;' : '&#10007;';
    const iconClass = dm >= 60 ? 'cc-live-icon--pass' : dm >= 40 ? 'cc-live-icon--warn' : 'cc-live-icon--fail';
    const badges = [];
    if (q.was_fallback) badges.push('<span class="cc-live-entry__badge cc-live-entry__badge--fallback">FB</span>');
    if (q.response_time_ms) badges.push(`<span class="cc-live-entry__response">${q.response_time_ms}ms</span>`);
    if (q.exclude_count > 0) badges.push(`<span class="cc-live-entry__badge cc-live-entry__badge--retry">x${q.exclude_count}</span>`);
    if (q.claude_relevance_score != null) badges.push(`<span class="cc-live-entry__badge ${q.claude_relevance_score >= 1 ? 'cc-live-entry__badge--liked' : 'cc-live-entry__badge--disliked'}">${q.claude_relevance_score >= 1 ? '&#128077;' : '&#128078;'}</span>`);
    return `
      <div class="cc-live-entry" data-query-id="${q.id}" onclick="openQueryDetail('${q.id}')" style="cursor:pointer" title="Click for details">
        <span class="cc-live-entry__time">${fmtTime(q.created_at)}</span>
        <span class="cc-live-entry__query">${escapeHtml(q.special_request || '(empty)')}</span>
        <span class="cc-live-entry__dm ${ragClass(dm)}">DM: ${dm}</span>
        <span class="cc-live-entry__icon ${iconClass}">${icon}</span>
        ${restName ? `<span class="cc-live-entry__rest">${escapeHtml(restName)}</span>` : ''}
        ${badges.length > 0 ? `<span class="cc-live-entry__badges">${badges.join('')}</span>` : ''}
      </div>
    `;
  }).join('');
}

function updateLiveKPIs(stats) {
  const el = (id, val) => {
    const e = document.getElementById(id);
    if (e) e.textContent = typeof val === 'number' ? (Number.isInteger(val) ? val : val.toFixed(1)) : val;
  };
  const colorKpi = (id, rag) => {
    const e = document.getElementById(id);
    if (e) { e.classList.remove('rag-green', 'rag-amber', 'rag-red'); e.classList.add(`rag-${rag}`); }
  };

  el('live-searches', stats.searches);
  el('live-avg-dm', Math.round(stats.avgDm));
  el('live-pass-rate', `${stats.passRate.toFixed(0)}%`);
  el('live-fallback-rate', `${stats.fallbackRate.toFixed(1)}%`);
  el('live-p50', stats.p50Response ? `${stats.p50Response}ms` : '--');
  el('live-p95', stats.p95Response ? `${stats.p95Response}ms` : '--');
  el('live-satisfaction', stats.satisfactionPct !== null ? `${stats.satisfactionPct.toFixed(0)}%` : '--');
  el('live-unmatched', `${stats.unmatchedRate.toFixed(1)}%`);

  // RAG-color critical KPIs
  colorKpi('live-fallback-rate', stats.fallbackRate > 15 ? 'red' : stats.fallbackRate > 8 ? 'amber' : 'green');
  colorKpi('live-p95', stats.p95Response > 5000 ? 'red' : stats.p95Response > 3000 ? 'amber' : 'green');
  colorKpi('live-pass-rate', stats.passRate >= 80 ? 'green' : stats.passRate >= 60 ? 'amber' : 'red');

  // Score distribution bar
  const dist = stats.scoreDist;
  const total = stats.searches;
  if (total > 0 && dist) {
    const pcts = dist.map(d => (d / total * 100));
    ['green', 'amber', 'orange', 'red'].forEach((c, i) => {
      const seg = document.getElementById(`dist-${c}`);
      if (seg) seg.style.width = `${pcts[i]}%`;
    });
    const labels = document.getElementById('dist-labels');
    if (labels) labels.innerHTML = `
      <span class="rag-green">${dist[0]} (80+)</span>
      <span class="rag-amber">${dist[1]} (60-79)</span>
      <span style="color:var(--cc-amber)">${dist[2]} (40-59)</span>
      <span class="rag-red">${dist[3]} (<40)</span>
    `;
  }
}

// ═══════════════════════════════════════════════════════════════════
// DB Overview (Data tab)
// ═══════════════════════════════════════════════════════════════════

function updateDbOverview(total, enriched, tags, occasions) {
  const el = (id, val) => { const e = document.getElementById(id); if (e) e.textContent = val; };
  el('db-total', total.toLocaleString());
  el('db-enriched', `${enriched.toLocaleString()} (${pct(enriched, total)}%)`);
  el('db-tags', `~${(tags / 1000).toFixed(1)}k`);
  el('db-occasions', occasions.toLocaleString());
}

// ═══════════════════════════════════════════════════════════════════
// Pipeline Status (Data tab)
// ═══════════════════════════════════════════════════════════════════

function updatePipelineStatus(operation, status) {
  const el = document.getElementById(`pipe-${operation}`);
  if (!el) return;

  el.textContent = status.charAt(0).toUpperCase() + status.slice(1);
  el.className = 'cc-pipeline-btn__status';
  if (status === 'pending') el.classList.add('cc-pipeline-btn__status--pending');
  else if (status === 'running') el.classList.add('cc-pipeline-btn__status--running');
  else if (status === 'complete') el.classList.add('cc-pipeline-btn__status--complete');
  else if (status === 'failed') el.classList.add('cc-pipeline-btn__status--failed');
}

function renderPipelineHistory(requests) {
  const list = document.getElementById('pipe-history-list');
  if (!list || !requests || requests.length === 0) return;

  list.innerHTML = requests.slice(0, 5).map(r => {
    const statusClass = r.status === 'complete' ? 'rag-green' : r.status === 'failed' ? 'rag-red' : 'rag-amber';
    const duration = r.completed_at && r.started_at
      ? `${((new Date(r.completed_at) - new Date(r.started_at)) / 1000).toFixed(0)}s`
      : '--';
    return `
      <div class="cc-pipe-entry">
        <span class="cc-pipe-entry__op">${escapeHtml(r.operation)}</span>
        <span class="cc-pipe-entry__status ${statusClass}">${escapeHtml(r.status)}</span>
        <span class="cc-pipe-entry__duration">${duration}</span>
        <span class="cc-pipe-entry__time">${timeAgo(r.requested_at || r.started_at || r.completed_at)}</span>
      </div>
    `;
  }).join('');
}

// ═══════════════════════════════════════════════════════════════════
// Run History (Test tab)
// ═══════════════════════════════════════════════════════════════════

function renderRunHistory(runs) {
  const body = document.getElementById('run-history-body');
  if (!body) return;

  if (!runs || runs.length === 0) {
    body.innerHTML = '<tr><td colspan="6" class="cc-empty">No test runs yet</td></tr>';
    return;
  }

  body.innerHTML = runs.map(r => {
    const date = new Date(r.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
    const passRate = r.total > 0 ? pct(r.passed_60, r.total) : '--';
    const delta = r.delta_avg_dm != null ? (r.delta_avg_dm >= 0 ? `+${r1(r.delta_avg_dm)}` : r1(r.delta_avg_dm)) : '--';
    const deltaClass = r.delta_avg_dm > 0 ? 'rag-green' : r.delta_avg_dm < 0 ? 'rag-red' : '';
    const hasGaps = r.gap_count > 0;
    return `
      <tr class="cc-run-row ${hasGaps ? 'cc-run-row--has-gaps' : ''}" data-run-id="${escapeHtml(r.run_id)}" onclick="selectRun('${escapeHtml(r.run_id)}'); toggleRunDetail(this)" style="cursor:pointer" title="${hasGaps ? 'Click to see issues' : 'Click to see details'}">
        <td>${date}</td>
        <td>${escapeHtml(r.mode || 'test')}</td>
        <td>${r.total || r.dataset_size || '--'}</td>
        <td class="${ragClass(r.avg_dm)}">${r1(r.avg_dm)}</td>
        <td>${passRate}%</td>
        <td class="${deltaClass}">${delta} ${hasGaps ? '<span class="cc-run-row__expand">&#9660;</span>' : ''}</td>
      </tr>
      <tr class="cc-run-detail" id="detail-${escapeHtml(r.run_id)}" style="display:none">
        <td colspan="6"><div class="cc-run-detail__content">Loading...</div></td>
      </tr>
    `;
  }).join('');
}

async function toggleRunDetail(row) {
  const runId = row.dataset.runId;
  const detailRow = document.getElementById(`detail-${runId}`);
  if (!detailRow) return;

  const isExpanded = row.classList.contains('cc-run-row--expanded');

  // Collapse all other expanded rows
  document.querySelectorAll('.cc-run-row--expanded').forEach(r => {
    r.classList.remove('cc-run-row--expanded');
    const detId = r.dataset.runId;
    const det = document.getElementById(`detail-${detId}`);
    if (det) det.style.display = 'none';
  });

  if (isExpanded) return; // was open, now closed

  row.classList.add('cc-run-row--expanded');
  detailRow.style.display = 'table-row';

  const content = detailRow.querySelector('.cc-run-detail__content');
  if (!content || content.dataset.loaded) return;

  // Load results from Supabase
  if (!sbClient) { content.textContent = 'Not authenticated'; return; }

  try {
    const { data: results } = await sbClient
      .from('gauntlet_results')
      .select('query, category, donde_match, score_pass, gap_type, restaurant_name')
      .eq('run_id', runId)
      .order('donde_match', { ascending: true });

    if (!results || results.length === 0) {
      content.textContent = 'No detailed results stored for this run.';
      content.dataset.loaded = '1';
      return;
    }

    // Show gaps first, then passes
    const gaps = results.filter(r => r.gap_type);
    const passes = results.filter(r => !r.gap_type);

    let html = '';
    if (gaps.length > 0) {
      html += `<div class="cc-run-detail__section"><strong>${gaps.length} issue${gaps.length > 1 ? 's' : ''}:</strong></div>`;
      html += gaps.map(r => `
        <div class="cc-run-detail__row cc-run-detail__row--gap">
          <span class="cc-run-detail__dm ${ragClass(r.donde_match)}">DM ${r.donde_match}</span>
          <span class="cc-run-detail__query">"${escapeHtml(r.query)}"</span>
          <span class="cc-run-detail__gap">${escapeHtml(r.gap_type)}</span>
          ${r.restaurant_name ? `<span class="cc-run-detail__rest">&rarr; ${escapeHtml(r.restaurant_name)}</span>` : ''}
        </div>
      `).join('');
    }

    if (passes.length > 0) {
      html += `<div class="cc-run-detail__section"><strong>${passes.length} passed:</strong></div>`;
      html += passes.slice(0, 5).map(r => `
        <div class="cc-run-detail__row">
          <span class="cc-run-detail__dm ${ragClass(r.donde_match)}">DM ${r.donde_match}</span>
          <span class="cc-run-detail__query">"${escapeHtml(r.query)}"</span>
          ${r.restaurant_name ? `<span class="cc-run-detail__rest">&rarr; ${escapeHtml(r.restaurant_name)}</span>` : ''}
        </div>
      `).join('');
      if (passes.length > 5) html += `<div class="cc-run-detail__more">+ ${passes.length - 5} more passing</div>`;
    }

    // Action buttons for this run
    const run = state.runHistory.find(r => r.run_id === runId);
    const prevRun = state.runHistory.find((r, i) => i > 0 && state.runHistory[i - 1]?.run_id === runId);
    html += `<div class="cc-run-detail__actions">`;
    if (prevRun) {
      html += `<button class="cc-btn cc-btn--sm" onclick="event.stopPropagation(); openCompareView('${escapeHtml(prevRun.run_id)}', '${escapeHtml(runId)}')">Compare vs Previous</button>`;
    }
    html += `<button class="cc-btn cc-btn--sm" onclick="event.stopPropagation(); openDeepDive('run', ${JSON.stringify({run_id: runId, total: run?.total, passed_60: run?.passed_60, avg_dm: run?.avg_dm, gap_count: run?.gap_count, created_at: run?.created_at}).replace(/"/g, '&quot;')})">Deep Dive</button>`;
    html += `</div>`;

    content.innerHTML = html;
    content.dataset.loaded = '1';
  } catch (e) {
    content.textContent = 'Failed to load details.';
    console.warn('Run detail load failed:', e);
  }
}

// ═══════════════════════════════════════════════════════════════════
// Keyboard Shortcuts
// ═══════════════════════════════════════════════════════════════════

function initKeyboardShortcuts() {
  document.addEventListener('keydown', (e) => {
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.tagName === 'SELECT') return;

    switch (e.key) {
      case '1': switchTab('test'); break;
      case '2': switchTab('live'); break;
      case '3': switchTab('data'); break;
      case '4': switchTab('issues'); break;
      case 't':
        if (state.activeTest) stopTest();
        else startTest('broad');
        break;
      case 'r':
        e.preventDefault();
        if (typeof refreshAllData === 'function') refreshAllData();
        break;
      case 'e':
        e.preventDefault();
        exportCurrentView();
        break;
      case 'c':
        e.preventDefault();
        if (state.runHistory.length >= 2) {
          const a = state.runHistory[1]?.run_id;
          const b = state.runHistory[0]?.run_id;
          if (a && b && typeof openCompareView === 'function') openCompareView(a, b);
        }
        break;
      case 'j':
        e.preventDefault();
        navigateRunHistory(1);
        break;
      case 'k':
        e.preventDefault();
        navigateRunHistory(-1);
        break;
      case 'Enter':
        if (state.focusedRunIdx >= 0 && state.activeTab === 'test') {
          const run = state.runHistory[state.focusedRunIdx];
          if (run) selectRun(run.run_id);
        }
        break;
      case '?':
      case 'h':
        if (e.key === 'h' && !e.shiftKey) break; // only ? and H
        toggleShortcuts();
        break;
      case 'Escape':
        closeQueryPanel();
        closeShortcuts();
        if (typeof closeCompareView === 'function') closeCompareView();
        if (typeof closeDeepDive === 'function') closeDeepDive();
        break;
    }
  });
}

function navigateRunHistory(dir) {
  const rows = document.querySelectorAll('.cc-run-row');
  if (!rows.length) return;
  state.focusedRunIdx = Math.max(0, Math.min(rows.length - 1, state.focusedRunIdx + dir));
  rows.forEach((r, i) => r.classList.toggle('cc-run-row--focused', i === state.focusedRunIdx));
  rows[state.focusedRunIdx]?.scrollIntoView({ block: 'nearest' });
}

function exportCurrentView() {
  switch (state.activeTab) {
    case 'test':
      if (state.activeTest?.results?.length) exportTestResults();
      else exportRunHistory();
      break;
    case 'live': exportLiveFeed(); break;
    case 'issues': exportIssues(); break;
    default: showToast('Nothing to export'); break;
  }
}

function toggleShortcuts() {
  const overlay = document.getElementById('shortcuts-overlay');
  if (overlay) overlay.style.display = overlay.style.display === 'none' ? '' : 'none';
}

function closeShortcuts(e) {
  if (e && e.target !== e.currentTarget) return;
  const overlay = document.getElementById('shortcuts-overlay');
  if (overlay) overlay.style.display = 'none';
}

// ═══════════════════════════════════════════════════════════════════
// Window resize handler
// ═══════════════════════════════════════════════════════════════════

window.addEventListener('resize', () => positionTabIndicator());

// ═══════════════════════════════════════════════════════════════════
// Pulse Freshness Ticker
// ═══════════════════════════════════════════════════════════════════

let _freshnessTimer = null;

function startFreshnessTicker() {
  updateFreshness();
  _freshnessTimer = setInterval(updateFreshness, 30000); // every 30s
}

function updateFreshness() {
  const run = state.latestRun;
  if (!run) return;

  const ago = timeAgo(run.created_at);
  const els = ['pulse-health-fresh', 'pulse-quality-fresh', 'pulse-attention-fresh'];
  els.forEach(id => {
    const el = document.getElementById(id);
    if (el) el.textContent = `Updated ${ago}`;
  });
}

// ═══════════════════════════════════════════════════════════════════
// Query Detail Slide-Out Panel
// ═══════════════════════════════════════════════════════════════════

async function openQueryDetail(queryId) {
  const panel = document.getElementById('query-panel');
  const backdrop = document.getElementById('query-panel-backdrop');
  const body = document.getElementById('query-panel-body');
  if (!panel || !body) return;

  body.innerHTML = '<div class="cc-query-panel__loading">Loading query details...</div>';
  panel.classList.add('cc-query-panel--open');
  if (backdrop) backdrop.classList.add('cc-query-panel__backdrop--visible');

  if (!sbClient) { body.innerHTML = '<p>Not authenticated</p>'; return; }

  try {
    // Load full query data with restaurant join via recommended_restaurant_id FK
    let { data: query, error } = await sbClient
      .from('user_queries')
      .select(`
        id, special_request, occasion, price_level, neighborhood_id,
        donde_match, created_at, recommended_restaurant_id, response_time_ms,
        was_fallback, claude_relevance_score, exclude_count, unmatched_keywords, source,
        restaurants!recommended_restaurant_id (
          name, address, cuisine_type, google_rating, google_review_count,
          price_level, noise_level, best_for_oneliner,
          photo_urls, neighborhoods!neighborhood_id(name)
        )
      `)
      .eq('id', queryId)
      .single();

    // Fallback: if FK join fails, load without restaurant join
    if (error || !query) {
      const fallback = await sbClient
        .from('user_queries')
        .select('id, special_request, occasion, price_level, neighborhood_id, donde_match, created_at, recommended_restaurant_id, response_time_ms, was_fallback, claude_relevance_score, exclude_count, unmatched_keywords, source')
        .eq('id', queryId)
        .single();
      query = fallback.data;
    }

    if (!query) { body.innerHTML = '<p>Query not found</p>'; return; }

    const dm = query.donde_match || 0;
    const r = query.restaurants;
    const photo = r?.photo_urls?.[0] || null;

    body.innerHTML = `
      <div class="cc-query-panel__score">
        <span class="cc-query-panel__dm ${ragClass(dm)}">${dm}</span>
        <span class="cc-query-panel__dm-label">DondeMatch</span>
      </div>

      <div class="cc-query-panel__section">
        <div class="cc-query-panel__label">Query</div>
        <div class="cc-query-panel__val">"${escapeHtml(query.special_request || '(empty)')}"</div>
      </div>

      ${query.occasion ? `<div class="cc-query-panel__section">
        <div class="cc-query-panel__label">Occasion</div>
        <div class="cc-query-panel__val">${escapeHtml(query.occasion)}</div>
      </div>` : ''}

      ${query.neighborhood_id ? `<div class="cc-query-panel__section">
        <div class="cc-query-panel__label">Neighborhood</div>
        <div class="cc-query-panel__val">${escapeHtml(r?.neighborhoods?.name || query.neighborhood_id)}</div>
      </div>` : ''}

      ${query.price_level ? `<div class="cc-query-panel__section">
        <div class="cc-query-panel__label">Price</div>
        <div class="cc-query-panel__val">${escapeHtml(query.price_level)}</div>
      </div>` : ''}

      ${r ? `
        <hr class="cc-query-panel__divider">
        ${photo ? `<img class="cc-query-panel__photo" src="${photo}" alt="${escapeHtml(r.name)}" loading="lazy">` : ''}
        <div class="cc-query-panel__section">
          <div class="cc-query-panel__label">Recommended</div>
          <div class="cc-query-panel__restaurant">${escapeHtml(r.name)}</div>
          <div class="cc-query-panel__meta">${escapeHtml(r.cuisine_type || '')} ${r.price_level ? '&middot; ' + escapeHtml(r.price_level) : ''}</div>
          <div class="cc-query-panel__meta">${escapeHtml(r.address || '')}</div>
          <div class="cc-query-panel__meta">${escapeHtml(r.neighborhoods?.name || '')}</div>
        </div>
        ${r.google_rating ? `<div class="cc-query-panel__section">
          <div class="cc-query-panel__label">Google</div>
          <div class="cc-query-panel__val">${r.google_rating} &#9733; (${r.google_review_count || '?'} reviews)</div>
        </div>` : ''}
        ${r.noise_level ? `<div class="cc-query-panel__section">
          <div class="cc-query-panel__label">Noise</div>
          <div class="cc-query-panel__val">${escapeHtml(r.noise_level)}</div>
        </div>` : ''}
        ${r.best_for_oneliner ? `<div class="cc-query-panel__section">
          <div class="cc-query-panel__label">Best For</div>
          <div class="cc-query-panel__val">${escapeHtml(r.best_for_oneliner)}</div>
        </div>` : ''}
      ` : '<div class="cc-query-panel__section"><div class="cc-query-panel__val">No restaurant data</div></div>'}

      <div class="cc-query-panel__section">
        <div class="cc-query-panel__label">Time</div>
        <div class="cc-query-panel__val">${new Date(query.created_at).toLocaleString('en-US', { timeZone: 'America/Chicago', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</div>
      </div>

      <div class="cc-query-panel__section">
        <div class="cc-query-panel__label">Response</div>
        <div class="cc-query-panel__val">${query.response_time_ms ? query.response_time_ms + 'ms' : '--'}${query.was_fallback ? ' &middot; <span style="color:var(--cc-amber)">fallback</span>' : ''}${query.exclude_count > 0 ? ' &middot; Try Again x' + query.exclude_count : ''}</div>
      </div>

      ${query.claude_relevance_score != null ? `<div class="cc-query-panel__section">
        <div class="cc-query-panel__label">User Feedback</div>
        <div class="cc-query-panel__val">${query.claude_relevance_score >= 1 ? '&#128077; Liked' : '&#128078; Disliked'}</div>
      </div>` : ''}

      ${query.unmatched_keywords && query.unmatched_keywords.length > 0 ? `<div class="cc-query-panel__section">
        <div class="cc-query-panel__label">Unmatched Keywords</div>
        <div class="cc-query-panel__val">${query.unmatched_keywords.map(k => '<span class="cc-keyword-pill cc-keyword-pill--unmatched">' + escapeHtml(k) + '</span>').join(' ')}</div>
      </div>` : ''}
    `;
  } catch (e) {
    body.innerHTML = '<p>Failed to load query details.</p>';
    console.warn('Query detail load failed:', e);
  }
}

function closeQueryPanel() {
  const panel = document.getElementById('query-panel');
  const backdrop = document.getElementById('query-panel-backdrop');
  if (panel) panel.classList.remove('cc-query-panel--open');
  if (backdrop) backdrop.classList.remove('cc-query-panel__backdrop--visible');
}

// ═══════════════════════════════════════════════════════════════════
// Issues Triage Tab
// ═══════════════════════════════════════════════════════════════════

function renderIssues(issues) {
  const list = document.getElementById('issues-list');
  if (!list) return;

  if (!issues || issues.length === 0) {
    list.innerHTML = '<div class="cc-empty-state"><div class="cc-empty-state__icon">&#9989;</div><div class="cc-empty-state__text">No issues found. System is healthy!</div></div>';
    const allIssues = state.issues || [];
    const fixedAll = allIssues.filter(i => i.status === 'fixed').length;
    updateIssueSummary(0, 0, 0, fixedAll);
    return;
  }

  // Count by severity (from all issues, not just filtered)
  const allIssues = state.issues || issues;
  const p0 = allIssues.filter(i => i.severity === 'P0' && i.status !== 'fixed').length;
  const p1 = allIssues.filter(i => i.severity === 'P1' && i.status !== 'fixed').length;
  const p2 = allIssues.filter(i => i.severity === 'P2' && i.status !== 'fixed').length;
  const fixed = allIssues.filter(i => i.status === 'fixed').length;
  updateIssueSummary(p0, p1, p2, fixed);

  let currentSev = null;
  let html = '';

  for (let idx = 0; idx < issues.length; idx++) {
    const i = issues[idx];
    // Severity group header
    if (i.severity !== currentSev) {
      currentSev = i.severity;
      html += `<div class="cc-issues-group-header cc-issues-group-header--${i.severity.toLowerCase()}">${i.severity} Issues</div>`;
    }

    const factors = i.factors
      ? `<div class="cc-issue__factors">F:${r1(i.factors.food)} V:${r1(i.factors.vibe)} S:${r1(i.factors.service)} R:${r1(i.factors.reputation)} C:${r1(i.factors.convenience)}</div>`
      : '';

    const sourceLabel = i.source === 'test'
      ? `Test ${i.sourceDetail || ''}`
      : `Prod ${i.sourceDetail || ''}`;

    const statusClass = i.status === 'fixed' ? 'cc-issue--fixed' : i.status === 'improved' ? 'cc-issue--improved' : '';
    const statusBadge = i.status === 'fixed'
      ? `<span class="cc-issue__status cc-issue__status--fixed">Fixed (DM ${i.retestDm})</span>`
      : i.status === 'improved'
      ? `<span class="cc-issue__status cc-issue__status--improved">Improved (${i.dm} → ${i.retestDm})</span>`
      : i.status === 'regressed'
      ? `<span class="cc-issue__status cc-issue__status--regressed">Regressed (${i.dm} → ${i.retestDm})</span>`
      : '';

    html += `
      <div class="cc-issue ${statusClass}" data-idx="${idx}" data-severity="${i.severity}" data-type="${i.gapType}" data-source="${i.source}" data-status="${i.status || 'open'}">
        <div class="cc-issue__top">
          <label class="cc-issue__check">
            <input type="checkbox" data-issue-idx="${idx}" onchange="toggleIssueSelect(${idx}, this.checked)">
          </label>
          <span class="cc-issue__dm ${ragClass(i.dm)}">${i.dm}</span>
          <span class="cc-issue__query">"${escapeHtml(i.query)}"</span>
          <span class="cc-issue__gap-type">${escapeHtml(i.gapType)}</span>
          <span class="cc-issue__severity cc-issues-badge--${i.severity.toLowerCase()}">${i.severity}</span>
          ${statusBadge}
        </div>
        <div class="cc-issue__meta">
          <span>${escapeHtml(i.restaurant)}</span>
          <span class="cc-issue__sep">&middot;</span>
          <span>${escapeHtml(i.category)}</span>
          <span class="cc-issue__sep">&middot;</span>
          <span>${sourceLabel}</span>
        </div>
        ${factors}
        <div class="cc-issue__fix">
          <span class="cc-issue__fix-text">${escapeHtml(i.fixAction)}</span>
          <button class="cc-btn cc-btn--sm" onclick="copyFixPrompt(${idx})">Copy Fix</button>
          <button class="cc-btn cc-btn--sm cc-btn--retest" onclick="retestIssue(${idx})" ${i.status === 'fixed' ? 'disabled' : ''}>Retest</button>
          <button class="cc-btn cc-btn--xs" onclick="openDeepDive('issue', state.issues[${idx}])">History</button>
        </div>
      </div>
    `;
  }

  list.innerHTML = html;
}

function updateIssueSummary(p0, p1, p2, fixed) {
  const el = (id, text) => { const e = document.getElementById(id); if (e) e.textContent = text; };
  el('issues-p0-count', `P0: ${p0}`);
  el('issues-p1-count', `P1: ${p1}`);
  el('issues-p2-count', `P2: ${p2}`);
  const fixedEl = document.getElementById('issues-fixed-count');
  if (fixedEl) {
    if (fixed > 0) {
      fixedEl.textContent = `Fixed: ${fixed}`;
      fixedEl.style.display = '';
    } else {
      fixedEl.style.display = 'none';
    }
  }
}

function updateIssuesBadge(issues) {
  const btn = document.getElementById('tab-issues-btn');
  if (!btn) return;
  const count = issues.filter(i => i.severity !== 'P2' && (!i.status || i.status === 'open')).length;
  btn.innerHTML = count > 0
    ? `Issues <span class="cc-tab__badge">${count}</span>`
    : 'Issues';
}

// ─── Filters ───

function setIssueFilter(filterType, value) {
  if (!state.issueFilters) return;
  state.issueFilters[filterType] = value;
  saveSession();

  // Update active button states
  document.querySelectorAll(`.cc-issues-filter[data-filter="${filterType}"]`).forEach(btn => {
    btn.classList.toggle('cc-issues-filter--active', btn.dataset.val === value);
  });

  applyIssueFilters();
}

function applyIssueFilters() {
  const { severity, type, source, status } = state.issueFilters || {};
  let filtered = (state.issues || []).filter(i => {
    if (severity !== 'all' && i.severity !== severity) return false;
    if (type !== 'all' && i.gapType !== type) return false;
    if (source !== 'all' && i.source !== source) return false;
    if (status && status !== 'all') {
      const issueStatus = i.status || 'open';
      if (status !== issueStatus) return false;
    }
    return true;
  });
  renderIssues(filtered);
}

// ─── Selection ───

function toggleIssueSelect(idx, checked) {
  if (!state.selectedIssues) state.selectedIssues = new Set();
  if (checked) state.selectedIssues.add(idx);
  else state.selectedIssues.delete(idx);
  updateBulkUI();
}

function toggleSelectAllIssues(checked) {
  const checkboxes = document.querySelectorAll('.cc-issue__check input[type="checkbox"]');
  state.selectedIssues = new Set();
  checkboxes.forEach(cb => {
    cb.checked = checked;
    if (checked) state.selectedIssues.add(Number(cb.dataset.issueIdx));
  });
  updateBulkUI();
}

function updateBulkUI() {
  const count = state.selectedIssues?.size || 0;
  const countEl = document.getElementById('issues-selected-count');
  const bulkBtn = document.getElementById('issues-bulk-copy');
  const retestBtn = document.getElementById('issues-bulk-retest');
  if (countEl) countEl.textContent = `${count} selected`;
  if (bulkBtn) bulkBtn.style.display = count > 0 ? '' : 'none';
  if (retestBtn) retestBtn.style.display = count > 0 ? '' : 'none';
}

// ─── Prompt Generation ───

function generateFixPrompt(issue) {
  const factorStr = issue.factors
    ? `Factor scores: food=${r1(issue.factors.food)}, vibe=${r1(issue.factors.vibe)}, service=${r1(issue.factors.service)}, reputation=${r1(issue.factors.reputation)}, convenience=${r1(issue.factors.convenience)}.`
    : '';

  const weakest = issue.factors
    ? Object.entries(issue.factors)
        .filter(([, v]) => v != null)
        .sort((a, b) => a[1] - b[1])[0]
    : null;

  let prompt = '';

  if (issue.gapType === 'intent') {
    prompt = `Fix DondeMatch intent gap for query "${issue.query}" (DM: ${issue.dm}).
Matched: ${issue.restaurant} — relevance_type: ${issue.relevanceType || 'unknown'}.
The intent classifier didn't recognize this query pattern.
Category: ${issue.category}.

Check: supabase/functions/recommend/_shared/intent-classifier-v5.ts
Action: Add "${issue.query}" keywords to the appropriate dictionary (CUISINE_KEYWORDS, VIBE_KEYWORDS, REPUTATION_KEYWORDS, etc.)
Then verify with: ./tests/compare-scores.sh "${issue.query}"`;

  } else if (issue.gapType === 'scoring') {
    prompt = `Fix DondeMatch scoring gap for query "${issue.query}" (DM: ${issue.dm}).
Matched: ${issue.restaurant}. ${factorStr}
Category: ${issue.category}. ${weakest ? `Weakest factor: ${weakest[0]} at ${r1(weakest[1])}.` : ''}

Check: supabase/functions/recommend/_shared/scoring-v9.ts
Look at the weight profile for ${issue.relevanceType || 'this'} queries — the ${weakest ? weakest[0] : 'lowest'} weight may need adjustment.
Then verify with: ./tests/compare-scores.sh "${issue.query}"`;

  } else if (issue.gapType === 'relevance_ceiling') {
    prompt = `Fix DondeMatch relevance ceiling for query "${issue.query}" (DM: ${issue.dm}).
Matched: ${issue.restaurant}. Relevance hits floor but quality can't push past 60.
${factorStr}

Check: supabase/functions/recommend/_shared/scoring-v9.ts — RELEVANCE_FLOORS
Consider: Is the relevance_type (${issue.relevanceType || 'unknown'}) correct? Should this query match a higher-relevance type?
Then verify with: ./tests/compare-scores.sh "${issue.query}"`;

  } else {
    prompt = `Fix DondeMatch issue for query "${issue.query}" (DM: ${issue.dm}).
Gap type: ${issue.gapType}. Matched: ${issue.restaurant}.
Category: ${issue.category}. Source: ${issue.source}.
${factorStr}

Action: ${issue.fixAction}
Then verify with: ./tests/compare-scores.sh "${issue.query}"`;
  }

  return prompt;
}

function copyFixPrompt(idx) {
  const issue = state.issues?.[idx];
  if (!issue) return;
  const prompt = generateFixPrompt(issue);
  navigator.clipboard?.writeText(prompt).then(() => {
    if (typeof showToast === 'function') showToast('Fix prompt copied!');
  }).catch(() => {
    if (typeof showToast === 'function') showToast('Could not copy to clipboard');
  });
}

// ═══════════════════════════════════════════════════════════════════
// Retest Issues
// ═══════════════════════════════════════════════════════════════════

async function retestIssue(idx) {
  const issue = state.issues?.[idx];
  if (!issue || state.retesting) return;

  state.retesting = true;
  const card = document.querySelector(`.cc-issue[data-idx="${idx}"]`);
  const btn = card?.querySelector('.cc-btn--retest');
  if (btn) { btn.textContent = 'Testing...'; btn.disabled = true; }

  try {
    const prevDm = issue.dm;
    const resp = await callAPI(issue.query);
    const newDm = resp.donde_match || 0;
    issue.retestDm = newDm;

    if (newDm >= 60) {
      issue.status = 'fixed';
      showToast(`Fixed! "${issue.query}" now scores DM ${newDm}`);
    } else if (newDm > issue.dm) {
      issue.status = 'improved';
      showToast(`Improved: "${issue.query}" DM ${issue.dm} → ${newDm}`);
    } else if (newDm < issue.dm) {
      issue.status = 'regressed';
      showToast(`Regressed: "${issue.query}" DM ${issue.dm} → ${newDm}`);
    } else {
      issue.status = 'open';
      showToast(`No change: "${issue.query}" still DM ${newDm}`);
    }

    // Update restaurant name if it changed
    if (resp.restaurant?.name) issue.restaurant = resp.restaurant.name;

    // Log retest as a gauntlet run
    const pass = newDm >= 60;
    const gap = pass ? null : (issue.gapType || determineGapType(resp, newDm));
    if (typeof persistResults === 'function') {
      await persistResults({ type: 'retest', results: [{
        query: issue.query, cat: issue.category || 'unknown', dm: newDm, pass,
        gap, restaurant: issue.restaurant, severity: issue.severity,
        prevDm, queryId: issue.queryId || `retest-${idx}`,
      }] });
    }

    // Re-render with filters
    applyIssueFilters();
    updateIssuesBadge(state.issues);
    saveIssueStatuses();
  } catch (e) {
    showToast(`Retest failed: ${e.message}`);
    if (btn) { btn.textContent = 'Retest'; btn.disabled = false; }
  } finally {
    state.retesting = false;
  }
}

async function retestSelectedIssues() {
  if (!state.selectedIssues?.size || !state.issues || state.retesting) return;

  const indices = [...state.selectedIssues].sort((a, b) => a - b);
  const total = indices.length;
  state.retesting = true;

  // Show progress
  const progressEl = document.getElementById('retest-progress');
  const fillEl = document.getElementById('retest-progress-fill');
  const textEl = document.getElementById('retest-progress-text');
  if (progressEl) progressEl.style.display = '';

  let fixed = 0, improved = 0, unchanged = 0;
  const retestResults = [];

  for (let i = 0; i < indices.length; i++) {
    const idx = indices[i];
    const issue = state.issues[idx];
    if (!issue) continue;

    if (textEl) textEl.textContent = `Retesting ${i + 1}/${total}: "${issue.query}"`;
    if (fillEl) fillEl.style.width = `${((i + 1) / total) * 100}%`;

    try {
      const prevDm = issue.dm;
      const resp = await callAPI(issue.query);
      const newDm = resp.donde_match || 0;
      issue.retestDm = newDm;

      if (newDm >= 60) {
        issue.status = 'fixed';
        fixed++;
      } else if (newDm > issue.dm) {
        issue.status = 'improved';
        improved++;
      } else if (newDm < issue.dm) {
        issue.status = 'regressed';
        unchanged++;
      } else {
        issue.status = 'open';
        unchanged++;
      }

      if (resp.restaurant?.name) issue.restaurant = resp.restaurant.name;

      const pass = newDm >= 60;
      const gap = pass ? null : (issue.gapType || determineGapType(resp, newDm));
      retestResults.push({
        query: issue.query, cat: issue.category || 'unknown', dm: newDm, pass,
        gap, restaurant: issue.restaurant, severity: issue.severity,
        prevDm, queryId: issue.queryId || `retest-${idx}`,
      });
    } catch (e) {
      unchanged++;
    }
  }

  // Log all retest results as a single gauntlet run
  if (retestResults.length && typeof persistResults === 'function') {
    await persistResults({ type: 'retest', results: retestResults });
  }

  state.retesting = false;
  if (progressEl) progressEl.style.display = 'none';

  showToast(`Retest complete: ${fixed} fixed, ${improved} improved, ${unchanged} unchanged`);

  // Clear selection
  state.selectedIssues = new Set();
  updateBulkUI();
  applyIssueFilters();
  updateIssuesBadge(state.issues);
  saveIssueStatuses();
}

// Persist issue statuses to localStorage so they survive page reload
function saveIssueStatuses() {
  if (!state.issues) return;
  const statuses = {};
  for (const issue of state.issues) {
    if (issue.status && issue.status !== 'open') {
      const key = issue.query.toLowerCase().trim();
      statuses[key] = { status: issue.status, retestDm: issue.retestDm, ts: Date.now() };
    }
  }
  try { localStorage.setItem('cc-issue-statuses', JSON.stringify(statuses)); } catch (_) {}
}

function loadIssueStatuses() {
  try {
    const raw = localStorage.getItem('cc-issue-statuses');
    return raw ? JSON.parse(raw) : {};
  } catch (_) { return {}; }
}

// ═══════════════════════════════════════════════════════════════════

function copyBulkFixPrompt() {
  if (!state.selectedIssues?.size || !state.issues) return;

  const selected = [...state.selectedIssues].map(idx => state.issues[idx]).filter(Boolean);
  const p0 = selected.filter(i => i.severity === 'P0');
  const p1 = selected.filter(i => i.severity === 'P1');

  // Find common patterns
  const typeCounts = {};
  const catCounts = {};
  selected.forEach(i => {
    typeCounts[i.gapType] = (typeCounts[i.gapType] || 0) + 1;
    catCounts[i.category] = (catCounts[i.category] || 0) + 1;
  });
  const topType = Object.entries(typeCounts).sort((a, b) => b[1] - a[1])[0]?.[0] || 'mixed';
  const topCat = Object.entries(catCounts).sort((a, b) => b[1] - a[1])[0]?.[0] || 'mixed';

  let prompt = `Fix ${selected.length} DondeMatch issues (${p0.length} P0, ${p1.length} P1):\n\n`;

  selected.forEach(i => {
    prompt += `- "${i.query}" DM:${i.dm} [${i.gapType}] → ${i.restaurant} (${i.category})\n`;
  });

  prompt += `\nCommon pattern: ${topType} gaps. Most affected category: ${topCat}.\n`;
  prompt += `\nStart with the P0 issues. For each:\n`;
  prompt += `1. Run ./tests/compare-scores.sh "<query>" to see current scoring\n`;
  prompt += `2. Apply the fix in the relevant file\n`;
  prompt += `3. Re-run to verify improvement\n`;
  prompt += `\nFiles to check:\n`;
  prompt += `- supabase/functions/recommend/_shared/intent-classifier-v5.ts (for intent gaps)\n`;
  prompt += `- supabase/functions/recommend/_shared/scoring-v9.ts (for scoring/ceiling gaps)\n`;
  prompt += `- supabase/functions/recommend/_shared/prompts-v5.ts (for blurb issues)\n`;

  navigator.clipboard?.writeText(prompt).then(() => {
    if (typeof showToast === 'function') showToast(`Bulk fix prompt copied (${selected.length} issues)!`);
  }).catch(() => {
    if (typeof showToast === 'function') showToast('Could not copy to clipboard');
  });
}
