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
  loadCustomQueries();
  loadPinnedQueries();
  renderCustomQueryList();
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

  // Smart suggestion when switching to issues
  if (name === 'issues') setTimeout(checkSmartSuggestion, 500);
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
  // Use grade-based pass rate if available, fallback to DM >= 60
  const passRate = run.grade_pass_count != null && run.total > 0
    ? (run.grade_pass_count / run.total * 100)
    : (run.total > 0 ? (run.passed_60 / run.total * 100) : 0);
  const passLabel = run.grade_pass_count != null ? 'grade pass' : 'DM≥60';
  updatePulseHealth(passRate, `${passLabel} · ${run.mode || 'test'} run ${timeAgo(run.created_at)}`);
  updatePulseQuality(run.avg_dm, `${run.total} queries tested`, run.delta_avg_dm);
  updatePulseAttention(run.gap_count, run.gap_count > 5 ? 'action needed' : 'manageable');

  // Update grade KPI strip
  updateGradeKpis(run);

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

  const filterBar = document.getElementById('run-filter-bar');

  // Toggle selection
  if (state.selectedRunId === runId) {
    state.selectedRunId = null;
    document.querySelectorAll('.cc-run-row--selected').forEach(r => r.classList.remove('cc-run-row--selected'));
    if (filterBar) filterBar.style.display = 'none';
    // Restore to latest run
    if (state.latestRun) updatePulseFromRun(state.latestRun);
    return;
  }

  state.selectedRunId = runId;

  // Highlight selected row
  document.querySelectorAll('.cc-run-row--selected').forEach(r => r.classList.remove('cc-run-row--selected'));
  const row = document.querySelector(`.cc-run-row[data-run-id="${runId}"]`);
  if (row) row.classList.add('cc-run-row--selected');

  // Show filter bar
  if (filterBar) {
    const date = new Date(run.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
    filterBar.innerHTML = `<span>Viewing: <strong>${run.mode || 'test'}</strong> run from ${date}</span><button class="cc-btn cc-btn--sm" onclick="selectRun('${escapeHtml(runId)}')">Clear</button>`;
    filterBar.style.display = 'flex';
  }

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
// Grade KPI Strip
// ═══════════════════════════════════════════════════════════════════

function updateGradeKpis(run) {
  const strip = document.getElementById('grade-kpi-strip');
  if (!strip) return;

  const fitEl = document.getElementById('kpi-score-fit');
  const blurbEl = document.getElementById('kpi-blurb-quality');
  const gradePassEl = document.getElementById('kpi-grade-pass');

  if (run.avg_score_fit != null) {
    const fitGrade = typeof letterGrade === 'function' ? letterGrade(run.avg_score_fit) : '--';
    const fitColor = typeof gradeColor === 'function' ? gradeColor(fitGrade) : '';
    if (fitEl) fitEl.innerHTML = `<span class="cc-grade cc-grade--${fitColor}">${fitGrade}</span> <span class="cc-kpi__num">${Math.round(run.avg_score_fit)}</span>`;
  } else if (fitEl) {
    fitEl.textContent = '--';
  }

  if (run.avg_blurb_quality != null) {
    const blurbGrade = typeof letterGrade === 'function' ? letterGrade(run.avg_blurb_quality) : '--';
    const blurbColor = typeof gradeColor === 'function' ? gradeColor(blurbGrade) : '';
    if (blurbEl) blurbEl.innerHTML = `<span class="cc-grade cc-grade--${blurbColor}">${blurbGrade}</span> <span class="cc-kpi__num">${Math.round(run.avg_blurb_quality)}</span>`;
  } else if (blurbEl) {
    blurbEl.textContent = '--';
  }

  if (run.grade_pass_count != null && run.total > 0) {
    const rate = Math.round(run.grade_pass_count / run.total * 100);
    const rateClass = rate >= 80 ? 'rag-green' : rate >= 60 ? 'rag-amber' : 'rag-red';
    if (gradePassEl) gradePassEl.innerHTML = `<span class="${rateClass}">${rate}%</span> <span class="cc-kpi__sub">(${run.grade_pass_count}/${run.total})</span>`;
  } else if (gradePassEl) {
    gradePassEl.textContent = '--';
  }

  strip.style.display = '';
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

  const isPinned = (state.pinnedQueries || []).includes(result.query);
  const fitBadge = result.scoreFitGrade ? `<span class="cc-grade cc-grade--${(typeof gradeColor === 'function' ? gradeColor(result.scoreFitGrade) : 'blue')}" title="Score Fit: ${result.scoreFitScore}">F:${result.scoreFitGrade}</span>` : '';
  const blurbBadge = result.blurbGrade ? `<span class="cc-grade cc-grade--${(typeof gradeColor === 'function' ? gradeColor(result.blurbGrade) : 'blue')}" title="Blurb Quality: ${result.blurbScore}">B:${result.blurbGrade}</span>` : '';
  row.innerHTML = `
    <span class="cc-result-row__icon">${icon}</span>
    <span class="cc-result-row__dm ${dmClass}">${result.dm || 0}</span>
    ${fitBadge}${blurbBadge}
    <span class="cc-result-row__query">${query}</span>
    <span class="cc-result-row__meta">${cat}${diff}</span>
    <button class="cc-result-row__pin ${isPinned ? 'cc-result-row__pin--active' : ''}" onclick="event.stopPropagation();togglePin('${escapeHtml(result.query).replace(/'/g, "\\'")}')" title="Pin to favorites">${isPinned ? '&#9733;' : '&#9734;'}</button>
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

function appendSummaryRow(name, total, passed, avgDm, elapsed, celebrate, testType) {
  const stream = document.getElementById('result-stream');
  if (!stream) return;

  const row = document.createElement('div');
  row.className = 'cc-result-summary' + (celebrate ? ' cc-result-summary--celebrate' : '');
  const passRate = pct(passed, total);
  const gaps = state.activeTest ? state.activeTest.results.filter(r => r.gap) : [];
  const gapSummary = gaps.length > 0
    ? `<div style="font-size:0.68rem;color:var(--cc-text-3);margin-top:4px">Gaps: ${gaps.slice(0, 3).map(g => `"${escapeHtml(g.query)}" (${g.dm})`).join(', ')}${gaps.length > 3 ? ` +${gaps.length - 3} more` : ''}</div>`
    : '';
  row.innerHTML = `
    <div class="cc-result-summary__title">${escapeHtml(name)} Complete${celebrate ? ' &#127881;' : ''}</div>
    <div class="cc-result-summary__stats">
      <span>${total} queries</span>
      <span class="${ragClass(Number(passRate))}">${passRate}% pass</span>
      <span class="${ragClass(avgDm)} cc-result-summary__dm">${Math.round(avgDm)}</span>
      <span>${elapsed}s</span>
    </div>
    ${gapSummary}
    <div class="cc-result-summary__actions">
      <button class="cc-result-summary__btn" onclick="rerunLastTest()">&#8635; Run Again</button>
      <button class="cc-result-summary__btn" onclick="exportTestResults()">&#128203; Copy Report</button>
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
    const hasGradeIssue = (q.score_fit_score != null && q.score_fit_score < 83) || (q.blurb_quality_score != null && q.blurb_quality_score < 83);
    const hasCriticalGrade = (q.score_fit_score != null && q.score_fit_score < 73) || (q.blurb_quality_score != null && q.blurb_quality_score < 73);
    const entryClass = hasCriticalGrade ? 'cc-live-entry--grade-critical' : hasGradeIssue ? 'cc-live-entry--grade-issue' : '';
    const gradeBadges = [];
    if (q.score_fit_grade) gradeBadges.push(`<span class="cc-live-entry__badge cc-live-entry__grade-badge cc-live-entry__grade-badge--${gradeColorClass(q.score_fit_grade)}" title="Score Fit: ${q.score_fit_score}">F:${q.score_fit_grade}</span>`);
    if (q.blurb_quality_grade) gradeBadges.push(`<span class="cc-live-entry__badge cc-live-entry__grade-badge cc-live-entry__grade-badge--${gradeColorClass(q.blurb_quality_grade)}" title="Blurb Quality: ${q.blurb_quality_score}">B:${q.blurb_quality_grade}</span>`);
    const line2Parts = [];
    if (restName) line2Parts.push(`<span class="cc-live-entry__rest-line2">${escapeHtml(restName)}</span>`);
    line2Parts.push(`<span>${fmtTime(q.created_at)}</span>`);
    if (q.response_time_ms) line2Parts.push(`<span>${q.response_time_ms}ms</span>`);
    if (q.was_fallback) line2Parts.push('<span style="color:var(--cc-amber)">fallback</span>');
    if (q.exclude_count > 0) line2Parts.push(`<span>x${q.exclude_count}</span>`);
    if (q.claude_relevance_score != null) line2Parts.push(`<span>${q.claude_relevance_score >= 1 ? '&#128077;' : '&#128078;'}</span>`);
    return `
      <div class="cc-live-entry ${entryClass}" data-query-id="${q.id}" onclick="openQueryDetail('${q.id}')" style="cursor:pointer" title="Click for details">
        <div class="cc-live-entry__line1">
          <span class="cc-live-entry__query">${escapeHtml(q.special_request || '(empty)')}</span>
        </div>
        <div class="cc-live-entry__line1-right">
          <span class="cc-live-entry__dm ${ragClass(dm)}">${dm}</span>
          ${gradeBadges.join('')}
        </div>
        <div class="cc-live-entry__line2">${line2Parts.join(' <span style="color:var(--cc-text-3)">&middot;</span> ')}</div>
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

  // Grade KPIs
  const fitEl = document.getElementById('live-avg-fit');
  const blurbEl = document.getElementById('live-avg-blurb');
  if (fitEl) {
    if (stats.avgFit != null) {
      const fitGrade = stats.avgFit >= 97 ? 'A+' : stats.avgFit >= 93 ? 'A' : stats.avgFit >= 87 ? 'B+' : stats.avgFit >= 83 ? 'B' : stats.avgFit >= 80 ? 'B-' : stats.avgFit >= 73 ? 'C' : 'D';
      fitEl.textContent = `${fitGrade} (${Math.round(stats.avgFit)})`;
      fitEl.classList.remove('rag-green', 'rag-amber', 'rag-red');
      fitEl.classList.add(stats.avgFit >= 87 ? 'rag-green' : stats.avgFit >= 80 ? 'rag-amber' : 'rag-red');
    } else {
      fitEl.textContent = '--';
    }
  }
  if (blurbEl) {
    if (stats.avgBlurb != null) {
      const blurbGrade = stats.avgBlurb >= 97 ? 'A+' : stats.avgBlurb >= 93 ? 'A' : stats.avgBlurb >= 87 ? 'B+' : stats.avgBlurb >= 83 ? 'B' : stats.avgBlurb >= 80 ? 'B-' : stats.avgBlurb >= 73 ? 'C' : 'D';
      blurbEl.textContent = `${blurbGrade} (${Math.round(stats.avgBlurb)})`;
      blurbEl.classList.remove('rag-green', 'rag-amber', 'rag-red');
      blurbEl.classList.add(stats.avgBlurb >= 87 ? 'rag-green' : stats.avgBlurb >= 80 ? 'rag-amber' : 'rag-red');
    } else {
      blurbEl.textContent = '--';
    }
  }
  el('live-grade-pass', stats.gradePassRate != null ? `${stats.gradePassRate.toFixed(0)}%` : '--');
  colorKpi('live-grade-pass', stats.gradePassRate >= 80 ? 'green' : stats.gradePassRate >= 60 ? 'amber' : 'red');
  el('live-grade-issues', stats.gradeIssueCount != null ? stats.gradeIssueCount : '--');
  colorKpi('live-grade-issues', (stats.gradeIssueCount || 0) === 0 ? 'green' : (stats.gradeIssueCount || 0) <= 3 ? 'amber' : 'red');
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
    body.innerHTML = '<tr><td colspan="8" class="cc-empty">No test runs yet</td></tr>';
    return;
  }

  body.innerHTML = runs.map((r, idx) => {
    const date = new Date(r.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
    const passRate = r.total > 0 ? pct(r.passed_60, r.total) : '--';
    const hasGaps = r.gap_count > 0;

    // Visual enhancement: color-coded left border
    const gradePassRate = r.grade_pass_count != null && r.total > 0 ? (r.grade_pass_count / r.total * 100) : Number(passRate);
    const rowHealthClass = (r.avg_dm >= 75 && gradePassRate >= 80) ? 'cc-run-row--healthy' : (r.avg_dm >= 60 && gradePassRate >= 50) ? 'cc-run-row--warning' : 'cc-run-row--critical';

    // Delta arrow
    let deltaHtml;
    if (r.delta_avg_dm != null && r.delta_avg_dm !== 0) {
      const deltaClass = r.delta_avg_dm > 0 ? 'cc-run-delta--up' : 'cc-run-delta--down';
      deltaHtml = `<span class="cc-run-delta ${deltaClass}">${r.delta_avg_dm > 0 ? '+' : ''}${r1(r.delta_avg_dm)}</span>`;
    } else if (r.delta_avg_dm === 0) {
      deltaHtml = `<span class="cc-run-delta cc-run-delta--flat">0</span>`;
    } else {
      deltaHtml = '--';
    }

    return `
      <tr class="cc-run-row ${hasGaps ? 'cc-run-row--has-gaps' : ''} ${rowHealthClass}" data-run-id="${escapeHtml(r.run_id)}" onclick="selectRun('${escapeHtml(r.run_id)}'); toggleRunDetail(this)" style="cursor:pointer" title="${hasGaps ? 'Click to see issues' : 'Click to see details'}">
        <td>${date}</td>
        <td>${escapeHtml(r.mode || 'test')}</td>
        <td>${r.total || r.dataset_size || '--'}</td>
        <td class="${ragClass(r.avg_dm)}">${r1(r.avg_dm)}</td>
        <td>${passRate}%</td>
        <td>${r.avg_score_fit != null ? `<span class="cc-grade cc-grade--${typeof gradeColor === 'function' ? gradeColor(typeof letterGrade === 'function' ? letterGrade(r.avg_score_fit) : '--') : ''}">${typeof letterGrade === 'function' ? letterGrade(r.avg_score_fit) : r1(r.avg_score_fit)}</span>` : '--'}</td>
        <td>${r.avg_blurb_quality != null ? `<span class="cc-grade cc-grade--${typeof gradeColor === 'function' ? gradeColor(typeof letterGrade === 'function' ? letterGrade(r.avg_blurb_quality) : '--') : ''}">${typeof letterGrade === 'function' ? letterGrade(r.avg_blurb_quality) : r1(r.avg_blurb_quality)}</span>` : '--'}</td>
        <td>${deltaHtml} ${hasGaps ? '<span class="cc-run-row__expand">&#9660;</span>' : ''}</td>
      </tr>
      <tr class="cc-run-detail" id="detail-${escapeHtml(r.run_id)}" style="display:none">
        <td colspan="8"><div class="cc-run-detail__content">Loading...</div></td>
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
      .select('query, category, donde_match, score_pass, gap_type, restaurant_name, score_fit_score, score_fit_grade, blurb_quality_score, blurb_quality_grade')
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

    // Grade heatmap at top
    let html = typeof renderGradeHeatmap === 'function' ? renderGradeHeatmap(results) : '';

    if (gaps.length > 0) {
      html += `<div class="cc-run-detail__section"><strong>${gaps.length} issue${gaps.length > 1 ? 's' : ''}:</strong></div>`;
      html += gaps.map(r => {
        const fitB = r.score_fit_grade ? `<span class="cc-grade cc-grade--${typeof gradeColor === 'function' ? gradeColor(r.score_fit_grade) : 'blue'}" title="Fit: ${r.score_fit_score}">F:${r.score_fit_grade}</span>` : '';
        const blrbB = r.blurb_quality_grade ? `<span class="cc-grade cc-grade--${typeof gradeColor === 'function' ? gradeColor(r.blurb_quality_grade) : 'blue'}" title="Blurb: ${r.blurb_quality_score}">B:${r.blurb_quality_grade}</span>` : '';
        return `
        <div class="cc-run-detail__row cc-run-detail__row--gap">
          <span class="cc-run-detail__dm ${ragClass(r.donde_match)}">DM ${r.donde_match}</span>
          ${fitB}${blrbB}
          <span class="cc-run-detail__query">"${escapeHtml(r.query)}"</span>
          <span class="cc-run-detail__gap">${escapeHtml(r.gap_type)}</span>
          ${r.restaurant_name ? `<span class="cc-run-detail__rest">&rarr; ${escapeHtml(r.restaurant_name)}</span>` : ''}
        </div>
      `}).join('');
    }

    if (passes.length > 0) {
      html += `<div class="cc-run-detail__section"><strong>${passes.length} passed:</strong></div>`;
      html += passes.slice(0, 5).map(r => {
        const fitB = r.score_fit_grade ? `<span class="cc-grade cc-grade--${typeof gradeColor === 'function' ? gradeColor(r.score_fit_grade) : 'blue'}" title="Fit: ${r.score_fit_score}">F:${r.score_fit_grade}</span>` : '';
        const blrbB = r.blurb_quality_grade ? `<span class="cc-grade cc-grade--${typeof gradeColor === 'function' ? gradeColor(r.blurb_quality_grade) : 'blue'}" title="Blurb: ${r.blurb_quality_score}">B:${r.blurb_quality_grade}</span>` : '';
        return `
        <div class="cc-run-detail__row">
          <span class="cc-run-detail__dm ${ragClass(r.donde_match)}">DM ${r.donde_match}</span>
          ${fitB}${blrbB}
          <span class="cc-run-detail__query">"${escapeHtml(r.query)}"</span>
          ${r.restaurant_name ? `<span class="cc-run-detail__rest">&rarr; ${escapeHtml(r.restaurant_name)}</span>` : ''}
        </div>
      `}).join('');
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
      case 's':
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
      case 't':
        if (typeof toggleTerminal === 'function') toggleTerminal();
        break;
      case 'Escape':
        closeQueryPanel();
        closeShortcuts();
        if (state.terminalOpen) closeTerminal();
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
        was_fallback, claude_relevance_score, exclude_count, unmatched_keywords,
        recommendation_text, source, score_fit_score, score_fit_grade,
        blurb_quality_score, blurb_quality_grade,
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
        .select('id, special_request, occasion, price_level, neighborhood_id, donde_match, created_at, recommended_restaurant_id, response_time_ms, was_fallback, claude_relevance_score, exclude_count, unmatched_keywords, recommendation_text, source')
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

      ${(query.score_fit_grade || query.blurb_quality_grade) ? `
      <div class="cc-query-panel__grades">
        ${query.score_fit_grade ? `
        <div class="cc-query-panel__grade-card cc-query-panel__grade-card--${gradeColorClass(query.score_fit_grade)}">
          <div class="cc-query-panel__grade-letter">${escapeHtml(query.score_fit_grade)}</div>
          <div class="cc-query-panel__grade-num">${query.score_fit_score ?? '--'}</div>
          <div class="cc-query-panel__grade-label">Score Fit</div>
        </div>` : ''}
        ${query.blurb_quality_grade ? `
        <div class="cc-query-panel__grade-card cc-query-panel__grade-card--${gradeColorClass(query.blurb_quality_grade)}">
          <div class="cc-query-panel__grade-letter">${escapeHtml(query.blurb_quality_grade)}</div>
          <div class="cc-query-panel__grade-num">${query.blurb_quality_score ?? '--'}</div>
          <div class="cc-query-panel__grade-label">Blurb Quality</div>
        </div>` : ''}
      </div>
      ${((query.score_fit_score != null && query.score_fit_score < 83) || (query.blurb_quality_score != null && query.blurb_quality_score < 83)) ? `
      <div class="cc-query-panel__grade-issue">
        <div class="cc-query-panel__grade-issue-icon">&#9888;</div>
        <div class="cc-query-panel__grade-issue-text">
          ${query.score_fit_score != null && query.score_fit_score < 83 ? `<div>Score Fit ${query.score_fit_grade} (${query.score_fit_score}): Review relevance/factor alignment in scoring-v9.ts</div>` : ''}
          ${query.blurb_quality_score != null && query.blurb_quality_score < 83 ? `<div>Blurb Quality ${query.blurb_quality_grade} (${query.blurb_quality_score}): Fix blurb generation in prompts-v5.ts</div>` : ''}
        </div>
        <button class="cc-query-panel__copy-fix" onclick="event.stopPropagation(); navigator.clipboard.writeText(this.closest('.cc-query-panel__grade-issue').querySelector('.cc-query-panel__grade-issue-text').textContent.trim()); showToast('Fix prompt copied')">Copy</button>
      </div>` : ''}
      ` : ''}

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

      ${query.recommendation_text ? `<div class="cc-query-panel__section">
        <div class="cc-query-panel__label">Recommendation Blurb</div>
        <div class="cc-query-panel__val cc-query-panel__blurb">${escapeHtml(query.recommendation_text)}</div>
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

// ─── Root-Cause Grouping ───

const ROOT_CAUSE_GROUPS = [
  { key: 'intent',            label: 'Intent Gaps',     icon: '\uD83C\uDFAF', desc: 'Engine misunderstood user intent' },
  { key: 'scoring',           label: 'Scoring Gaps',    icon: '\uD83D\uDCCA', desc: 'Right restaurant, wrong score' },
  { key: 'relevance_ceiling', label: 'Data Gaps',       icon: '\uD83D\uDCC1', desc: 'Missing data limited the match' },
  { key: 'grade_fit',         label: 'Score Fit Issues', icon: '\uD83D\uDD27', desc: 'Score does not accurately reflect query-restaurant fit' },
  { key: 'grade_blurb',       label: 'Blurb Issues',    icon: '\u270D\uFE0F', desc: 'Recommendation text quality below B+' },
  { key: 'grade_both',        label: 'Fit + Blurb Issues', icon: '\u26A0\uFE0F', desc: 'Both score fit and blurb quality below B+' },
  { key: '_other',            label: 'Low Performers',  icon: '\uD83D\uDCC9', desc: 'Generally weak matches' },
];

function groupIssuesByRootCause(issues) {
  const groups = new Map();
  for (const g of ROOT_CAUSE_GROUPS) {
    groups.set(g.key, { ...g, issues: [], totalDm: 0 });
  }
  for (const issue of issues) {
    const key = groups.has(issue.gapType) ? issue.gapType : '_other';
    const group = groups.get(key);
    group.issues.push(issue);
    group.totalDm += (issue.dm || 0);
  }
  // Sort issues within each group: severity then DM
  const sevOrder = { P0: 0, P1: 1, P2: 2 };
  for (const group of groups.values()) {
    group.issues.sort((a, b) => (sevOrder[a.severity] || 9) - (sevOrder[b.severity] || 9) || a.dm - b.dm);
    group.avgDm = group.issues.length ? Math.round(group.totalDm / group.issues.length) : 0;
  }
  return groups;
}

// ─── Factor Mini-Bar Helper ───

function factorBarColor(val) {
  if (val == null) return 'red';
  if (val >= 7) return 'green';
  if (val >= 5) return 'amber';
  return 'red';
}

function renderFactorBars(factors) {
  if (!factors) return '';
  const bars = [
    { label: 'F', val: factors.food },
    { label: 'V', val: factors.vibe },
    { label: 'S', val: factors.service },
    { label: 'R', val: factors.reputation },
    { label: 'C', val: factors.convenience },
  ];
  return `<div class="cc-issue__factors-bars">${bars.map(b => {
    const v = b.val != null ? b.val : 0;
    const pct = Math.min(100, Math.round(v * 10));
    const color = factorBarColor(b.val);
    return `<div class="cc-factor-bar" title="${b.label}: ${b.val != null ? r1(b.val) : '--'}">
      <span class="cc-factor-bar__label">${b.label}</span>
      <div class="cc-factor-bar__track"><div class="cc-factor-bar__fill cc-factor-bar--${color}" style="width:${pct}%"></div></div>
    </div>`;
  }).join('')}</div>`;
}

// ─── Trend Badge Helper ───

function renderTrendBadge(issue) {
  if (issue.deltaDm != null && issue.deltaDm !== 0) {
    if (issue.deltaDm > 0) return `<span class="cc-issue__trend cc-issue__trend--up">\u25B2 +${issue.deltaDm}</span>`;
    return `<span class="cc-issue__trend cc-issue__trend--down">\u25BC ${issue.deltaDm}</span>`;
  }
  if (issue.isNew) return `<span class="cc-issue__trend cc-issue__trend--new">NEW</span>`;
  return `<span class="cc-issue__trend cc-issue__trend--none">\u2014</span>`;
}

// ─── Issue Notes (localStorage) ───

function loadIssueNotes() {
  try {
    const raw = localStorage.getItem('cc-issue-notes');
    return raw ? JSON.parse(raw) : {};
  } catch (_) { return {}; }
}

function saveIssueNote(idx, text) {
  const issue = state.issues?.[idx];
  if (!issue) return;
  const notes = loadIssueNotes();
  const key = issue.query.toLowerCase().trim();
  if (text.trim()) {
    notes[key] = text.trim();
  } else {
    delete notes[key];
  }
  try { localStorage.setItem('cc-issue-notes', JSON.stringify(notes)); } catch (_) {}
}

// ─── Status Toggle ───

function toggleIssueStatus(idx) {
  const issue = state.issues?.[idx];
  if (!issue) return;
  const cycle = { open: 'in_progress', in_progress: 'fixed', fixed: 'open' };
  issue.status = cycle[issue.status || 'open'] || 'open';
  saveIssueStatuses();
  applyIssueFilters();
}

// ─── Expand/Collapse ───

function toggleIssueExpand(idx, event) {
  // Don't toggle if clicking buttons, checkboxes, inputs, or links
  if (event && event.target.closest('button, input, a, textarea, label')) return;
  const card = document.querySelector(`.cc-issue[data-idx="${idx}"]`);
  if (card) card.classList.toggle('cc-issue--expanded');
}

// ─── Executive Summary ───

function updateExecutiveSummary(allIssues) {
  const p0 = allIssues.filter(i => i.severity === 'P0' && i.status !== 'fixed').length;
  const p1 = allIssues.filter(i => i.severity === 'P1' && i.status !== 'fixed').length;
  const resolved = allIssues.filter(i => i.status === 'fixed' || i.status === 'improved').length;

  // Load previous counts for trend
  let prev = { p0: 0, p1: 0, resolved: 0 };
  try {
    const raw = localStorage.getItem('cc-issue-prev-counts');
    if (raw) prev = JSON.parse(raw);
  } catch (_) {}

  const setCount = (id, val) => {
    const el = document.getElementById(id);
    if (!el) return;
    if (el.textContent !== String(val)) {
      el.textContent = val;
      el.classList.remove('cc-issues-card__count--pop');
      void el.offsetWidth;
      el.classList.add('cc-issues-card__count--pop');
    }
  };

  setCount('exec-critical-count', p0);
  setCount('exec-warning-count', p1);
  setCount('exec-resolved-count', resolved);

  // Trend text
  const setTrend = (id, current, previous, invert) => {
    const el = document.getElementById(id);
    if (!el) return;
    const delta = current - previous;
    if (delta === 0 || !previous) {
      el.textContent = '';
      el.className = 'cc-issues-card__trend';
      return;
    }
    // For critical/warning: decrease is good (invert=true). For resolved: increase is good.
    const isGood = invert ? delta < 0 : delta > 0;
    const arrow = delta > 0 ? '\u25B2' : '\u25BC';
    el.textContent = `${arrow} ${Math.abs(delta)} from last`;
    el.className = `cc-issues-card__trend cc-issues-card__trend--${isGood ? 'up' : 'down'}`;
  };

  setTrend('exec-critical-trend', p0, prev.p0, true);
  setTrend('exec-warning-trend', p1, prev.p1, true);
  setTrend('exec-resolved-trend', resolved, prev.resolved, false);
}

function snapshotIssueCounts() {
  if (!state.issues) return;
  const p0 = state.issues.filter(i => i.severity === 'P0' && i.status !== 'fixed').length;
  const p1 = state.issues.filter(i => i.severity === 'P1' && i.status !== 'fixed').length;
  const resolved = state.issues.filter(i => i.status === 'fixed' || i.status === 'improved').length;
  try {
    localStorage.setItem('cc-issue-prev-counts', JSON.stringify({ p0, p1, resolved, ts: Date.now() }));
  } catch (_) {}
}

// ─── Action Bar Count ───

function updateActionBarCount(issues) {
  const el = document.getElementById('issues-visible-count');
  if (!el) return;
  const critical = issues.filter(i => i.severity === 'P0' && i.status !== 'fixed').length;
  el.textContent = `${issues.length} issue${issues.length !== 1 ? 's' : ''}${critical ? ' \xB7 ' + critical + ' critical' : ''}`;
}

// ─── Smart Insight ───

function generateIssueInsight(issues) {
  const el = document.getElementById('issues-insight');
  const textEl = document.getElementById('issues-insight-text');
  const actionEl = document.getElementById('issues-insight-action');
  if (!el || !textEl) return;

  // Dismissed this session?
  if (state.insightDismissed) { el.style.display = 'none'; return; }

  const open = issues.filter(i => !i.status || i.status === 'open');
  const critical = open.filter(i => i.severity === 'P0');
  if (open.length === 0) {
    textEl.textContent = 'All clear! No open issues detected.';
    el.style.display = '';
    if (actionEl) actionEl.style.display = 'none';
    return;
  }

  // Count by gapType
  const typeCounts = {};
  for (const i of critical.length ? critical : open) {
    typeCounts[i.gapType] = (typeCounts[i.gapType] || 0) + 1;
  }
  const sorted = Object.entries(typeCounts).sort((a, b) => b[1] - a[1]);
  const top = sorted[0];

  // Check for improvements from previous snapshot
  let prev = null;
  try { prev = JSON.parse(localStorage.getItem('cc-issue-prev-counts')); } catch (_) {}

  if (prev && prev.resolved != null) {
    const currentResolved = issues.filter(i => i.status === 'fixed' || i.status === 'improved').length;
    const delta = currentResolved - (prev.resolved || 0);
    if (delta > 0) {
      textEl.textContent = `Great progress! ${delta} issue${delta !== 1 ? 's' : ''} resolved since last run.`;
      el.style.display = '';
      if (actionEl) actionEl.style.display = 'none';
      return;
    }
  }

  // Dominant gap type insight
  if (top && top[1] > 1) {
    const label = ROOT_CAUSE_GROUPS.find(g => g.key === top[0])?.label || top[0];
    const total = critical.length || open.length;
    const pct = Math.round((top[1] / total) * 100);
    if (pct >= 40) {
      textEl.textContent = `${label} are your weakest area \u2014 ${top[1]} of ${total} ${critical.length ? 'critical' : 'open'} issues.`;
      el.style.display = '';
      if (actionEl) actionEl.style.display = 'none';
      return;
    }
  }

  // Fallback
  textEl.textContent = `${open.length} open issue${open.length !== 1 ? 's' : ''}, ${critical.length} critical. Focus on ${ROOT_CAUSE_GROUPS.find(g => g.key === (top?.[0]))?.label || 'top issues'} for most impact.`;
  el.style.display = '';
  if (actionEl) actionEl.style.display = 'none';
}

function dismissInsight() {
  state.insightDismissed = true;
  const el = document.getElementById('issues-insight');
  if (el) el.style.display = 'none';
}

// ─── Retest All Critical ───

async function retestAllCritical() {
  if (!state.issues || state.retesting) return;
  const criticalIndices = [];
  state.issues.forEach((issue, idx) => {
    if (issue.severity === 'P0' && (!issue.status || issue.status === 'open')) {
      criticalIndices.push(idx);
    }
  });
  if (!criticalIndices.length) {
    if (typeof showToast === 'function') showToast('No open critical issues to retest');
    return;
  }
  state.selectedIssues = new Set(criticalIndices);
  await retestSelectedIssues();
}

// ─── Copy All Fix Prompts ───

function copyAllFixPrompts() {
  if (!state.issues) return;
  const open = state.issues.filter(i => !i.status || i.status === 'open');
  if (!open.length) {
    if (typeof showToast === 'function') showToast('No open issues');
    return;
  }
  const groups = groupIssuesByRootCause(open);
  let prompt = `Fix ${open.length} DondeMatch issues:\n`;
  for (const [, group] of groups) {
    if (!group.issues.length) continue;
    prompt += `\n### ${group.icon} ${group.label} (${group.issues.length}, avg DM: ${group.avgDm})\n`;
    for (const i of group.issues) {
      prompt += `- [${i.severity}] "${i.query}" DM:${i.dm} \u2192 ${i.restaurant} (${i.category})\n`;
    }
  }
  prompt += `\nFor each issue run: ./tests/compare-scores.sh "<query>" then apply fix.\n`;
  navigator.clipboard?.writeText(prompt).then(() => {
    if (typeof showToast === 'function') showToast(`All fix prompts copied (${open.length} issues)`);
  }).catch(() => {
    if (typeof showToast === 'function') showToast('Could not copy to clipboard');
  });
}

// ─── Main Render ───

function renderIssues(issues) {
  const list = document.getElementById('issues-list');
  if (!list) return;

  const allIssues = state.issues || issues;

  // Update executive summary + action bar + insight
  updateExecutiveSummary(allIssues);
  updateActionBarCount(issues);
  generateIssueInsight(allIssues);

  if (!issues || issues.length === 0) {
    list.innerHTML = '<div class="cc-empty-state"><div class="cc-empty-state__icon">&#9989;</div><div class="cc-empty-state__text">No issues found. System is healthy!</div></div>';
    return;
  }

  // Load notes
  const notes = loadIssueNotes();

  // Group by root cause
  const groups = groupIssuesByRootCause(issues);
  let html = '';

  for (const [, group] of groups) {
    if (!group.issues.length) continue;

    html += `<div class="cc-issues-group" data-group="${group.key}">`;
    html += `<div class="cc-issues-group__header" onclick="toggleIssueGroup(this)">
      <span class="cc-issues-group__chevron">\u25BC</span>
      <span class="cc-issues-group__icon">${group.icon}</span>
      <span class="cc-issues-group__label">${group.label}</span>
      <span class="cc-issues-group__count">${group.issues.length}</span>
      <span class="cc-issues-group__avg-dm">avg DM: ${group.avgDm}</span>
    </div>`;
    html += `<div class="cc-issues-group__body">`;

    for (const i of group.issues) {
      const idx = allIssues.indexOf(i);
      const sourceLabel = i.source === 'test' ? `Test ${i.sourceDetail || ''}` : `Prod ${i.sourceDetail || ''}`;
      const statusClass = i.status === 'fixed' ? 'cc-issue--fixed' : i.status === 'improved' ? 'cc-issue--improved' : '';
      const statusBadge = i.status === 'fixed'
        ? `<span class="cc-issue__status cc-issue__status--fixed">Fixed (DM ${i.retestDm})</span>`
        : i.status === 'improved'
        ? `<span class="cc-issue__status cc-issue__status--improved">Improved (${i.dm} \u2192 ${i.retestDm})</span>`
        : i.status === 'regressed'
        ? `<span class="cc-issue__status cc-issue__status--regressed">Regressed (${i.dm} \u2192 ${i.retestDm})</span>`
        : '';

      const trendBadge = renderTrendBadge(i);
      const noteKey = i.query.toLowerCase().trim();
      const noteVal = notes[noteKey] || '';

      // Status badge class for cycling
      const statusCycleClass = i.status === 'in_progress' ? 'cc-issue__severity--in-progress' : '';

      html += `
        <div class="cc-issue ${statusClass}" data-idx="${idx}" data-severity="${i.severity}" data-type="${i.gapType}" data-source="${i.source}" data-status="${i.status || 'open'}" onclick="toggleIssueExpand(${idx}, event)">
          <div class="cc-issue__top">
            <label class="cc-issue__check">
              <input type="checkbox" data-issue-idx="${idx}" onchange="toggleIssueSelect(${idx}, this.checked)">
            </label>
            <span class="cc-issue__dm ${ragClass(i.dm)}">${i.dm}</span>
            <span class="cc-issue__query">"${escapeHtml(i.query)}"</span>
            <span class="cc-issue__severity cc-issues-badge--${i.severity.toLowerCase()} cc-issue__severity--clickable ${statusCycleClass}" onclick="event.stopPropagation(); toggleIssueStatus(${idx})" title="Click to cycle status">${i.status === 'in_progress' ? 'WIP' : i.severity}</span>
            ${i.scoreFitGrade ? `<span class="cc-live-entry__grade-badge cc-live-entry__grade-badge--${gradeColorClass(i.scoreFitGrade)}" title="Score Fit: ${i.scoreFitScore}">F:${i.scoreFitGrade}</span>` : ''}
            ${i.blurbQualityGrade ? `<span class="cc-live-entry__grade-badge cc-live-entry__grade-badge--${gradeColorClass(i.blurbQualityGrade)}" title="Blurb Quality: ${i.blurbQualityScore}">B:${i.blurbQualityGrade}</span>` : ''}
            ${trendBadge}
            ${statusBadge}
          </div>
          <div class="cc-issue__details">
            <div class="cc-issue__meta">
              <span>${escapeHtml(i.restaurant)}</span>
              <span class="cc-issue__sep">&middot;</span>
              <span>${escapeHtml(i.category)}</span>
              <span class="cc-issue__sep">&middot;</span>
              <span>${sourceLabel}</span>
            </div>
            <span class="cc-issue__gap-type">${escapeHtml(i.gapType)}</span>
            ${renderFactorBars(i.factors)}
            <div class="cc-issue__fix">
              <span class="cc-issue__fix-text">${escapeHtml(i.fixAction)}</span>
              <button class="cc-btn cc-btn--sm" onclick="copyFixPrompt(${idx})">Copy Fix</button>
              <button class="cc-btn cc-btn--sm cc-btn--retest" onclick="retestIssue(${idx})" ${i.status === 'fixed' ? 'disabled' : ''}>Retest</button>
              <button class="cc-btn cc-btn--xs" onclick="openDeepDive('issue', state.issues[${idx}])">History</button>
            </div>
            <textarea class="cc-issue__note" rows="1" placeholder="Add a note..." onchange="saveIssueNote(${idx}, this.value)" onclick="event.stopPropagation()">${escapeHtml(noteVal)}</textarea>
          </div>
        </div>
      `;
    }

    html += `</div></div>`; // close body + group
  }

  list.innerHTML = html;
}

function toggleIssueGroup(header) {
  const group = header.closest('.cc-issues-group');
  if (group) group.classList.toggle('cc-issues-group--collapsed');
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
    if (type !== 'all') {
      if (type === 'grade_fit' && i.gapType !== 'grade_fit' && i.gapType !== 'grade_both') return false;
      else if (type === 'grade_blurb' && i.gapType !== 'grade_blurb' && i.gapType !== 'grade_both') return false;
      else if (type !== 'grade_fit' && type !== 'grade_blurb' && i.gapType !== type) return false;
    }
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

  // Group by gap type for targeted instructions
  const byType = {};
  const catCounts = {};
  selected.forEach(i => {
    const t = i.gapType || 'unknown';
    (byType[t] = byType[t] || []).push(i);
    catCounts[i.category] = (catCounts[i.category] || 0) + 1;
  });
  const topCat = Object.entries(catCounts).sort((a, b) => b[1] - a[1])[0]?.[0] || 'mixed';

  // Severity summary — only mention severities that exist
  const sevCounts = {};
  selected.forEach(i => { sevCounts[i.severity] = (sevCounts[i.severity] || 0) + 1; });
  const sevSummary = ['P0', 'P1', 'P2'].filter(s => sevCounts[s]).map(s => `${sevCounts[s]} ${s}`).join(', ');

  let prompt = `Fix ${selected.length} DondeMatch issues (${sevSummary}):\n`;

  // List issues grouped by type
  for (const [type, items] of Object.entries(byType)) {
    prompt += `\n### ${type} (${items.length})\n`;
    items.forEach(i => {
      prompt += `- "${i.query}" DM:${i.dm} → ${i.restaurant} (${i.category})\n`;
    });
  }

  prompt += `\nMost affected: ${topCat}.\n`;

  // Targeted file hints based on actual gap types present
  prompt += `\nFor each issue:\n`;
  prompt += `1. Run ./tests/compare-scores.sh "<query>" to see current scoring\n`;
  prompt += `2. Apply fix in the relevant file\n`;
  prompt += `3. Re-run to verify\n`;

  const files = new Set();
  if (byType.intent) files.add('- intent-classifier-v5.ts (intent dictionaries)');
  if (byType.scoring || byType.relevance_ceiling) files.add('- scoring-v9.ts (weights/floors)');
  if (byType['cliché'] || byType.blurb) files.add('- prompts-v5.ts (blurb templates)');
  if (byType.low_score) files.add('- scoring-v9.ts (investigate low score)');
  if (files.size === 0) files.add('- scoring-v9.ts / intent-classifier-v5.ts');
  prompt += `\nFiles: (all in supabase/functions/recommend/_shared/)\n`;
  files.forEach(f => { prompt += f + '\n'; });

  navigator.clipboard?.writeText(prompt).then(() => {
    if (typeof showToast === 'function') showToast(`Bulk fix prompt copied (${selected.length} issues)!`);
  }).catch(() => {
    if (typeof showToast === 'function') showToast('Could not copy to clipboard');
  });
}

// ═══════════════════════════════════════════════════════════════════
// v3: Config Panel
// ═══════════════════════════════════════════════════════════════════

function toggleConfig(type) {
  const panel = document.getElementById('config-panel');
  if (!panel) return;

  // If same type is open, close it
  if (state.configOpen === type) {
    panel.classList.remove('cc-config-panel--open');
    state.configOpen = null;
    document.querySelectorAll('.cc-test-card__gear').forEach(g => g.classList.remove('cc-test-card__gear--active'));
    return;
  }

  state.configOpen = type;
  document.querySelectorAll('.cc-test-card__gear').forEach(g => g.classList.remove('cc-test-card__gear--active'));

  // Position panel after the clicked card's row
  const card = document.querySelector(`[data-test="${type}"]`);
  if (card) {
    card.querySelector('.cc-test-card__gear')?.classList.add('cc-test-card__gear--active');
    // Move config panel after the card in DOM
    card.parentNode.insertBefore(panel, card.nextSibling);
  }

  const cfg = state.testConfig[type] || { count: 20, difficulty: 'all', threshold: 60 };
  const counts = type === 'regression' ? [10, 23] : [5, 10, 20, 50];
  const costPer = 0.01; // ~$0.01 per query

  panel.innerHTML = `
    <div class="cc-config-panel__row">
      <span class="cc-config-panel__label">Queries</span>
      ${counts.map(n => `<button class="cc-config-pill ${cfg.count === n ? 'cc-config-pill--active' : ''}" onclick="setTestConfig('${type}','count',${n})">${n}</button>`).join('')}
    </div>
    ${type !== 'regression' ? `
    <div class="cc-config-panel__row">
      <span class="cc-config-panel__label">Difficulty</span>
      ${['all', 'easy', 'medium', 'hard'].map(d => `<button class="cc-config-pill ${cfg.difficulty === d ? 'cc-config-pill--active' : ''}" onclick="setTestConfig('${type}','difficulty','${d}')">${d === 'all' ? 'All' : d[0].toUpperCase() + d.slice(1)}</button>`).join('')}
    </div>` : ''}
    <div class="cc-config-panel__row">
      <span class="cc-config-panel__label">Threshold</span>
      ${[50, 60, 70, 80].map(t => `<button class="cc-config-pill ${cfg.threshold === t ? 'cc-config-pill--active' : ''}" onclick="setTestConfig('${type}','threshold',${t})">${t}</button>`).join('')}
    </div>
    <div class="cc-config-panel__footer">
      <span class="cc-config-panel__estimate" id="config-estimate">~$${(cfg.count * costPer).toFixed(2)} · ~${Math.ceil(cfg.count * 6 / 60)} min</span>
      <button class="cc-config-panel__run" onclick="runConfiguredTest('${type}')">Run ${TEST_TYPES[type]?.name || type}</button>
    </div>
  `;
  panel.classList.add('cc-config-panel--open');
}

function setTestConfig(type, key, value) {
  if (!state.testConfig[type]) state.testConfig[type] = { count: 20, difficulty: 'all', threshold: 60 };
  state.testConfig[type][key] = value;
  saveSession();
  // Re-render config panel
  toggleConfig('_close'); // close
  toggleConfig(type);     // reopen with new values
  // Update card description
  updateCardMeta(type);
}

function updateCardMeta(type) {
  const cfg = state.testConfig[type];
  if (!cfg) return;
  const costPer = 0.01;
  const metaEl = document.getElementById(`${type}-meta`);
  if (metaEl) metaEl.textContent = `~$${(cfg.count * costPer).toFixed(2)} · ~${Math.ceil(cfg.count * 6 / 60)} min`;
  const descEl = document.getElementById(`${type}-desc`);
  if (descEl && type === 'broad') descEl.textContent = `${cfg.count} random queries across all categories`;
  if (descEl && type === 'category') descEl.textContent = `${cfg.count} queries from selected categories`;
}

function runConfiguredTest(type) {
  const panel = document.getElementById('config-panel');
  if (panel) panel.classList.remove('cc-config-panel--open');
  state.configOpen = null;
  startTest(type);
}

// ═══════════════════════════════════════════════════════════════════
// v3: Multi-Category Picker
// ═══════════════════════════════════════════════════════════════════

function toggleCatPill(btn) {
  const cat = btn.dataset.cat;
  const idx = state.selectedCategories.indexOf(cat);
  if (idx >= 0) {
    state.selectedCategories.splice(idx, 1);
    btn.classList.remove('cc-cat-pill--selected');
  } else {
    state.selectedCategories.push(cat);
    btn.classList.add('cc-cat-pill--selected');
  }
  updateCatCount();
}

function setCatPreset(preset) {
  // Clear all
  state.selectedCategories = [];
  document.querySelectorAll('.cc-cat-pill[data-cat]').forEach(p => p.classList.remove('cc-cat-pill--selected'));

  let cats = [];
  if (preset === 'food-vibe') cats = ['Food', 'Vibe'];
  else if (preset === 'full') cats = ['Food', 'Vibe', 'Service', 'Rep', 'Conv'];
  else if (preset === 'weakest') {
    // Pick bottom 2 categories from latest run
    const latest = state.latestRun;
    if (latest?.category_stats) {
      const sorted = Object.entries(latest.category_stats).sort((a, b) => (a[1].avg || 99) - (b[1].avg || 99));
      cats = sorted.slice(0, 2).map(([c]) => c);
    } else {
      cats = ['Food', 'Vibe']; // fallback
      showToast('No run data — defaulting to Food + Vibe');
    }
  }

  state.selectedCategories = cats;
  cats.forEach(c => {
    const btn = document.querySelector(`.cc-cat-pill[data-cat="${c}"]`);
    if (btn) btn.classList.add('cc-cat-pill--selected');
  });
  updateCatCount();
}

function updateCatCount() {
  let pool = typeof CHICAGO_QUERIES !== 'undefined' ? [...CHICAGO_QUERIES] : [];
  if (typeof generatedQueries !== 'undefined' && generatedQueries.length) {
    pool = pool.concat(generatedQueries.map(gq => ({ cat: gq.category || 'Food', query: gq.query || gq.special_request || '' })).filter(q => q.query));
  }
  const count = pool.filter(q => state.selectedCategories.includes(q.cat)).length;
  const el = document.getElementById('cat-count');
  if (el) el.textContent = state.selectedCategories.length > 0 ? `${count} available` : '';
}

// ═══════════════════════════════════════════════════════════════════
// v3: Custom Queries
// ═══════════════════════════════════════════════════════════════════

function addCustomQuery() {
  const input = document.getElementById('custom-query-input');
  const catSel = document.getElementById('custom-query-cat');
  if (!input || !catSel) return;

  const query = input.value.trim();
  if (!query) return;
  if (state.customQueries.some(q => q.query.toLowerCase() === query.toLowerCase())) {
    showToast('Query already exists');
    return;
  }

  state.customQueries.push({ query, cat: catSel.value, id: Date.now().toString(36) });
  saveCustomQueries();
  input.value = '';
  renderCustomQueryList();
  showToast('Query added');
}

function removeCustomQuery(id) {
  state.customQueries = state.customQueries.filter(q => q.id !== id);
  saveCustomQueries();
  renderCustomQueryList();
}

function renderCustomQueryList() {
  const list = document.getElementById('custom-query-list');
  const countEl = document.getElementById('custom-query-count');
  if (!list) return;
  if (countEl) countEl.textContent = state.customQueries.length > 0 ? `(${state.customQueries.length})` : '';

  list.innerHTML = state.customQueries.map(q => `
    <span class="cc-custom-query-pill">
      ${escapeHtml(q.query)}
      <span class="cc-custom-query-pill__cat">${q.cat}</span>
      <button class="cc-custom-query-pill__del" onclick="removeCustomQuery('${q.id}')">&times;</button>
    </span>
  `).join('');
}

// ═══════════════════════════════════════════════════════════════════
// v3: Pin / Favorite
// ═══════════════════════════════════════════════════════════════════

function togglePin(query) {
  const idx = state.pinnedQueries.indexOf(query);
  if (idx >= 0) {
    state.pinnedQueries.splice(idx, 1);
  } else {
    state.pinnedQueries.push(query);
  }
  savePinnedQueries();
  // Update pin icons in result stream
  document.querySelectorAll('.cc-result-row__pin').forEach(btn => {
    const q = btn.getAttribute('onclick')?.match(/'([^']+)'/)?.[1];
    if (q === query) {
      btn.classList.toggle('cc-result-row__pin--active');
      btn.innerHTML = state.pinnedQueries.includes(query) ? '&#9733;' : '&#9734;';
    }
  });
}

// ═══════════════════════════════════════════════════════════════════
// v3: Result Stream Search
// ═══════════════════════════════════════════════════════════════════

function filterResults(text) {
  const term = text.toLowerCase().trim();
  const rows = document.querySelectorAll('.cc-result-row');
  let visible = 0;
  rows.forEach(row => {
    const query = row.querySelector('.cc-result-row__query')?.textContent?.toLowerCase() || '';
    const show = !term || query.includes(term);
    row.style.display = show ? '' : 'none';
    if (show) visible++;
  });
  const countEl = document.getElementById('result-search-count');
  if (countEl) countEl.textContent = term ? `${visible}/${rows.length}` : '';
}

// ═══════════════════════════════════════════════════════════════════
// v3: Quick Rerun & Export
// ═══════════════════════════════════════════════════════════════════

function rerunLastTest() {
  if (!state.lastTestType) return;
  if (state.lastTestConfig?.categories) {
    state.selectedCategories = state.lastTestConfig.categories;
    runMultiCategoryTest();
  } else {
    startTest(state.lastTestType);
  }
}

function exportTestResults() {
  const stream = document.getElementById('result-stream');
  if (!stream) return;

  const rows = stream.querySelectorAll('.cc-result-row');
  const summary = stream.querySelector('.cc-result-summary');
  let report = '';

  if (summary) {
    const title = summary.querySelector('.cc-result-summary__title')?.textContent || '';
    const stats = summary.querySelector('.cc-result-summary__stats')?.textContent?.trim() || '';
    report += `${title}\n${stats}\n\n`;
  }

  const gaps = [];
  rows.forEach(row => {
    const dm = row.querySelector('.cc-result-row__dm')?.textContent || '0';
    const query = row.querySelector('.cc-result-row__query')?.textContent || '';
    const gap = row.querySelector('.cc-result-row__gap')?.textContent || '';
    if (gap) gaps.push(`"${query}" (DM:${dm})`);
  });

  if (gaps.length > 0) {
    report += `Gaps:\n${gaps.join('\n')}\n`;
  }

  navigator.clipboard?.writeText(report.trim()).then(() => {
    showToast('Report copied to clipboard');
  }).catch(() => {
    showToast('Could not copy');
  });
}

// ═══════════════════════════════════════════════════════════════════
// v3: Smart Test Suggestion
// ═══════════════════════════════════════════════════════════════════

function checkSmartSuggestion() {
  const issues = state.issues || [];
  const openIssues = issues.filter(i => (!i.status || i.status === 'open'));
  if (openIssues.length === 0) return;

  // Count by category
  const catCounts = {};
  openIssues.forEach(i => { catCounts[i.category] = (catCounts[i.category] || 0) + 1; });
  const topCat = Object.entries(catCounts).sort((a, b) => b[1] - a[1])[0];

  if (topCat && topCat[1] >= 2) {
    showToast(`${topCat[1]} ${topCat[0]} gaps — Run Category Focus?`);
  }
}

// ═══════════════════════════════════════════════════════════════════
// Action Center (#1) — Top 3 actionable issues across test + prod
// ═══════════════════════════════════════════════════════════════════

function renderActionCenter() {
  const el = document.getElementById('action-center');
  if (!el) return;

  const items = computeActionItems();

  if (items.length === 0) {
    el.innerHTML = `
      <div class="cc-action-card cc-action-card--clear cc-action-card--all-clear">
        <div class="cc-action-card__icon">&#10003;</div>
        <div class="cc-action-card__body">
          <div class="cc-action-card__title">All Clear</div>
          <div class="cc-action-card__metric">No urgent issues across test or production</div>
        </div>
      </div>`;
    el.style.display = '';
    return;
  }

  el.innerHTML = items.slice(0, 3).map(item => {
    const sevClass = item.severity === 'P0' ? 'cc-action-card--p0' : item.severity === 'P1' ? 'cc-action-card--p1' : 'cc-action-card--p2';
    return `
      <div class="cc-action-card ${sevClass}" onclick="${escapeHtml(item.onclick)}">
        <div class="cc-action-card__icon">${item.icon}</div>
        <div class="cc-action-card__body">
          <div class="cc-action-card__title">${escapeHtml(item.title)}</div>
          <div class="cc-action-card__metric">${escapeHtml(item.metric)}</div>
          <div class="cc-action-card__action">${item.action} &rarr;</div>
        </div>
      </div>`;
  }).join('');
  el.style.display = '';
}

function computeActionItems() {
  const items = [];
  const issues = (state.issues || []).filter(i => !i.status || i.status === 'open');

  // 1. Grade failures from test
  const testGradeIssues = issues.filter(i => i.source === 'test' && (i.gapType === 'grade_fit' || i.gapType === 'grade_blurb' || i.gapType === 'grade_both'));
  if (testGradeIssues.length > 0) {
    items.push({
      severity: testGradeIssues.some(i => i.severity === 'P0') ? 'P0' : 'P1',
      icon: '&#128200;',
      title: `${testGradeIssues.length} Grade Failure${testGradeIssues.length > 1 ? 's' : ''} (Test)`,
      metric: `Fit/Blurb below B in last test run`,
      action: 'View Issues',
      onclick: "switchTab('issues')",
    });
  }

  // 2. Production grade issues (last 24h)
  const dayAgo = new Date(Date.now() - 86400000).toISOString();
  const prodGradeIssues = (state.liveFeed || []).filter(q =>
    q.created_at >= dayAgo &&
    ((q.score_fit_score != null && q.score_fit_score < 83) ||
     (q.blurb_quality_score != null && q.blurb_quality_score < 83))
  );
  if (prodGradeIssues.length > 0) {
    items.push({
      severity: prodGradeIssues.some(q => (q.score_fit_score || 100) < 73 || (q.blurb_quality_score || 100) < 73) ? 'P0' : 'P1',
      icon: '&#9888;',
      title: `${prodGradeIssues.length} Prod Grade Issue${prodGradeIssues.length > 1 ? 's' : ''} (24h)`,
      metric: `Below B in live production`,
      action: 'View Live',
      onclick: "switchTab('live')",
    });
  }

  // 3. Low-score test failures (DM < 60)
  const testLowScore = issues.filter(i => i.source === 'test' && i.dm < 60 && i.gapType !== 'grade_fit' && i.gapType !== 'grade_blurb' && i.gapType !== 'grade_both');
  if (testLowScore.length > 0) {
    items.push({
      severity: testLowScore.some(i => i.dm < 40) ? 'P0' : 'P1',
      icon: '&#128269;',
      title: `${testLowScore.length} Low Score${testLowScore.length > 1 ? 's' : ''} (Test)`,
      metric: `DM < 60 in last test run`,
      action: 'View Issues',
      onclick: "switchTab('issues')",
    });
  }

  // 4. High fallback rate
  const recentQueries = (state.liveFeed || []).filter(q => q.created_at >= dayAgo);
  if (recentQueries.length >= 5) {
    const fbRate = recentQueries.filter(q => q.was_fallback).length / recentQueries.length * 100;
    if (fbRate > 15) {
      items.push({
        severity: fbRate > 30 ? 'P0' : 'P1',
        icon: '&#128260;',
        title: `Fallback Rate ${Math.round(fbRate)}%`,
        metric: `${recentQueries.filter(q => q.was_fallback).length} of ${recentQueries.length} queries (24h)`,
        action: 'View Fallbacks',
        onclick: "switchTab('live'); setLiveAdvFilter('fallback', 'yes')",
      });
    }
  }

  // Sort by severity
  const sevOrder = { P0: 0, P1: 1, P2: 2 };
  items.sort((a, b) => (sevOrder[a.severity] || 9) - (sevOrder[b.severity] || 9));
  return items;
}

// ═══════════════════════════════════════════════════════════════════
// Live Issues Section (#5) — Inline issue cards on Live tab
// ═══════════════════════════════════════════════════════════════════

function renderLiveIssues(queries) {
  const section = document.getElementById('live-issues-section');
  if (!section) return;

  const gradeIssues = (queries || state.liveFeed || []).filter(q =>
    (q.score_fit_score != null && q.score_fit_score < 83) ||
    (q.blurb_quality_score != null && q.blurb_quality_score < 83)
  ).slice(0, 5);

  if (gradeIssues.length === 0) {
    section.innerHTML = '';
    return;
  }

  const isCollapsed = section.dataset.collapsed === '1';

  section.innerHTML = `
    <div class="cc-live-issues ${isCollapsed ? 'cc-live-issues--collapsed' : ''}">
      <div class="cc-live-issues__header" onclick="toggleLiveIssues()">
        <span>${gradeIssues.length} Grade Issue${gradeIssues.length > 1 ? 's' : ''} in Recent Queries</span>
        <span class="cc-live-issues__header-arrow">&#9660;</span>
      </div>
      <div class="cc-live-issues__body">
        ${gradeIssues.map(q => {
          const fitBadge = q.score_fit_grade ? `<span class="cc-live-entry__badge cc-live-entry__grade-badge cc-live-entry__grade-badge--${gradeColorClass(q.score_fit_grade)}">F:${q.score_fit_grade}</span>` : '';
          const blurbBadge = q.blurb_quality_grade ? `<span class="cc-live-entry__badge cc-live-entry__grade-badge cc-live-entry__grade-badge--${gradeColorClass(q.blurb_quality_grade)}">B:${q.blurb_quality_grade}</span>` : '';
          const restName = q.restaurants?.name || '';
          let fixText = '';
          if (q.score_fit_score != null && q.score_fit_score < 83) fixText += `Score Fit ${q.score_fit_grade}: Review scoring-v9.ts. `;
          if (q.blurb_quality_score != null && q.blurb_quality_score < 83) fixText += `Blurb ${q.blurb_quality_grade}: Fix prompts-v5.ts.`;
          return `
            <div class="cc-live-issue-card" onclick="openQueryDetail('${q.id}')">
              ${fitBadge}${blurbBadge}
              <span class="cc-live-issue-card__query">${escapeHtml(q.special_request || '(empty)')}</span>
              ${restName ? `<span class="cc-live-issue-card__rest">${escapeHtml(restName)}</span>` : ''}
              <button class="cc-live-issue-card__copy-fix" onclick="event.stopPropagation(); navigator.clipboard.writeText('${fixText.replace(/'/g, "\\'")}'); showToast('Fix copied')" title="Copy fix prompt">Copy Fix</button>
            </div>`;
        }).join('')}
      </div>
    </div>`;
}

function toggleLiveIssues() {
  const section = document.getElementById('live-issues-section');
  if (!section) return;
  const issuesEl = section.querySelector('.cc-live-issues');
  if (!issuesEl) return;
  const isCollapsed = issuesEl.classList.toggle('cc-live-issues--collapsed');
  section.dataset.collapsed = isCollapsed ? '1' : '0';
}

// ═══════════════════════════════════════════════════════════════════
// KPI Sparklines (#3) — Inline SVG trend charts
// ═══════════════════════════════════════════════════════════════════

function renderKpiSparkline(containerId, dataPoints) {
  const el = document.getElementById(containerId);
  if (!el) return;
  if (!dataPoints || dataPoints.length < 2) { el.innerHTML = ''; return; }

  const vals = dataPoints.slice(0, 7).reverse(); // chronological order
  const min = Math.min(...vals);
  const max = Math.max(...vals);
  const range = max - min || 1;

  // Compute polyline points
  const w = 54, h = 16, pad = 1;
  const points = vals.map((v, i) => {
    const x = pad + (i / (vals.length - 1)) * (w - 2 * pad);
    const y = pad + (1 - (v - min) / range) * (h - 2 * pad);
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  }).join(' ');

  // Determine trend
  const first = vals[0], last = vals[vals.length - 1];
  const trend = last > first + 1 ? 'up' : last < first - 1 ? 'down' : 'flat';

  el.innerHTML = `<span class="cc-kpi-sparkline cc-kpi-sparkline--${trend}"><svg viewBox="0 0 ${w} ${h}"><polyline class="cc-kpi-sparkline__line" points="${points}"/></svg></span>`;
}

function updateKpiSparklines() {
  // Compute daily aggregates from liveFeed
  const queries = state.liveFeed || [];
  if (queries.length === 0) return;

  const dayBuckets = {};
  for (const q of queries) {
    const day = q.created_at.substring(0, 10);
    if (!dayBuckets[day]) dayBuckets[day] = { dm: [], fit: [], blurb: [], count: 0 };
    dayBuckets[day].dm.push(q.donde_match || 0);
    dayBuckets[day].count++;
    if (q.score_fit_score != null) dayBuckets[day].fit.push(q.score_fit_score);
    if (q.blurb_quality_score != null) dayBuckets[day].blurb.push(q.blurb_quality_score);
  }

  const days = Object.keys(dayBuckets).sort().slice(-7);
  const avgDms = days.map(d => dayBuckets[d].dm.reduce((a, b) => a + b, 0) / dayBuckets[d].dm.length);
  const passRates = days.map(d => {
    const passed = dayBuckets[d].dm.filter(v => v >= 60).length;
    return (passed / dayBuckets[d].dm.length) * 100;
  });
  const avgFits = days.map(d => dayBuckets[d].fit.length > 0 ? dayBuckets[d].fit.reduce((a, b) => a + b, 0) / dayBuckets[d].fit.length : null).filter(v => v !== null);
  const avgBlurbs = days.map(d => dayBuckets[d].blurb.length > 0 ? dayBuckets[d].blurb.reduce((a, b) => a + b, 0) / dayBuckets[d].blurb.length : null).filter(v => v !== null);

  renderKpiSparkline('spark-avg-dm', avgDms);
  renderKpiSparkline('spark-pass-rate', passRates);
  renderKpiSparkline('spark-avg-fit', avgFits);
  renderKpiSparkline('spark-avg-blurb', avgBlurbs);
}

// ═══════════════════════════════════════════════════════════════════
// Data Freshness Indicator (#7)
// ═══════════════════════════════════════════════════════════════════

function updateFreshnessIndicator() {
  const el = document.getElementById('data-freshness');
  if (!el) return;
  const lastRefresh = state.lastDataRefresh;
  if (!lastRefresh) { el.innerHTML = ''; return; }

  const elapsed = Math.floor((Date.now() - lastRefresh) / 1000);
  let text, cls;
  if (elapsed < 60) { text = 'Updated just now'; cls = ''; }
  else if (elapsed < 300) { text = `Updated ${Math.floor(elapsed / 60)}m ago`; cls = ''; }
  else if (elapsed < 900) { text = `Updated ${Math.floor(elapsed / 60)}m ago`; cls = 'cc-freshness--stale'; }
  else { text = `Stale (${Math.floor(elapsed / 60)}m)`; cls = 'cc-freshness--very-stale'; }

  el.className = `cc-freshness ${cls}`;
  el.innerHTML = `<span class="cc-freshness__dot"></span>${text}`;
}

function startFreshnessTicker() {
  state.lastDataRefresh = Date.now();
  updateFreshnessIndicator();
  setInterval(updateFreshnessIndicator, 30000);
}

// ═══════════════════════════════════════════════════════════════════
// Grade Heatmap on Test Results (#6)
// ═══════════════════════════════════════════════════════════════════

function renderGradeHeatmap(results) {
  if (!results || results.length === 0) return '';

  function countGrades(grades) {
    const counts = { a: 0, b: 0, c: 0, df: 0 };
    for (const g of grades) {
      if (!g) continue;
      if (g.startsWith('A')) counts.a++;
      else if (g.startsWith('B')) counts.b++;
      else if (g.startsWith('C')) counts.c++;
      else counts.df++;
    }
    return counts;
  }

  const fitGrades = results.map(r => r.score_fit_grade).filter(Boolean);
  const blurbGrades = results.map(r => r.blurb_quality_grade).filter(Boolean);

  if (fitGrades.length === 0 && blurbGrades.length === 0) return '';

  function renderBar(label, counts) {
    const total = counts.a + counts.b + counts.c + counts.df;
    if (total === 0) return '';
    return `
      <div class="cc-grade-heatmap__row">
        <span class="cc-grade-heatmap__label">${label}</span>
        <div class="cc-grade-heatmap__bar">
          ${counts.a > 0 ? `<div class="cc-grade-heatmap__seg cc-grade-heatmap__seg--a" style="flex-grow:${counts.a}" title="A: ${counts.a}"></div>` : ''}
          ${counts.b > 0 ? `<div class="cc-grade-heatmap__seg cc-grade-heatmap__seg--b" style="flex-grow:${counts.b}" title="B: ${counts.b}"></div>` : ''}
          ${counts.c > 0 ? `<div class="cc-grade-heatmap__seg cc-grade-heatmap__seg--c" style="flex-grow:${counts.c}" title="C: ${counts.c}"></div>` : ''}
          ${counts.df > 0 ? `<div class="cc-grade-heatmap__seg cc-grade-heatmap__seg--df" style="flex-grow:${counts.df}" title="D/F: ${counts.df}"></div>` : ''}
        </div>
      </div>`;
  }

  return `
    <div class="cc-grade-heatmap">
      ${renderBar('Fit', countGrades(fitGrades))}
      ${renderBar('Blurb', countGrades(blurbGrades))}
    </div>`;
}

// ═══════════════════════════════════════════════════════════════════
// Cross-Tab Smart Navigation (#9)
// ═══════════════════════════════════════════════════════════════════

function initKpiClickHandlers() {
  const kpiActions = {
    'live-grade-issues': () => { switchTab('issues'); },
    'live-fallback-rate': () => { switchTab('live'); setLiveAdvFilter('fallback', 'yes'); },
    'live-avg-fit': () => { switchTab('issues'); },
    'live-avg-blurb': () => { switchTab('issues'); },
    'live-grade-pass': () => { switchTab('issues'); },
  };

  for (const [id, handler] of Object.entries(kpiActions)) {
    const el = document.getElementById(id);
    if (el) {
      const kpiDiv = el.closest('.cc-live-kpi');
      if (kpiDiv) {
        kpiDiv.classList.add('cc-live-kpi--clickable');
        kpiDiv.addEventListener('click', handler);
      }
    }
  }
}

// ═══════════════════════════════════════════════════════════════════
// Production vs Test Summary Strip (#10)
// ═══════════════════════════════════════════════════════════════════

function renderTestVsProdStrip() {
  const el = document.getElementById('test-vs-prod-strip');
  if (!el) return;

  const run = state.latestRun;
  const sevenDaysAgo = new Date(Date.now() - 7 * 86400000).toISOString();
  const prodQueries = (state.liveFeed || []).filter(q => q.created_at >= sevenDaysAgo && q.source !== 'command-center');

  if (!run && prodQueries.length === 0) { el.style.display = 'none'; return; }

  // Test stats
  const testDm = run ? r1(run.avg_dm) : '--';
  const testFit = run?.avg_score_fit != null ? (typeof letterGrade === 'function' ? letterGrade(run.avg_score_fit) : r1(run.avg_score_fit)) : '--';
  const testBlurb = run?.avg_blurb_quality != null ? (typeof letterGrade === 'function' ? letterGrade(run.avg_blurb_quality) : r1(run.avg_blurb_quality)) : '--';

  // Prod stats
  let prodDm = '--', prodFit = '--', prodBlurb = '--';
  if (prodQueries.length > 0) {
    prodDm = r1(prodQueries.reduce((s, q) => s + (q.donde_match || 0), 0) / prodQueries.length);
    const withFit = prodQueries.filter(q => q.score_fit_score != null);
    const withBlurb = prodQueries.filter(q => q.blurb_quality_score != null);
    if (withFit.length > 0) {
      const avgF = withFit.reduce((s, q) => s + q.score_fit_score, 0) / withFit.length;
      prodFit = typeof letterGrade === 'function' ? letterGrade(avgF) : r1(avgF);
    }
    if (withBlurb.length > 0) {
      const avgB = withBlurb.reduce((s, q) => s + q.blurb_quality_score, 0) / withBlurb.length;
      prodBlurb = typeof letterGrade === 'function' ? letterGrade(avgB) : r1(avgB);
    }
  }

  // Check divergence
  const testDmNum = run ? Number(run.avg_dm) : 0;
  const prodDmNum = prodQueries.length > 0 ? prodQueries.reduce((s, q) => s + (q.donde_match || 0), 0) / prodQueries.length : 0;
  const divergence = testDmNum > 0 && prodDmNum > 0 ? ((testDmNum - prodDmNum) / testDmNum * 100) : 0;
  const prodWarnClass = divergence > 10 ? 'cc-comparison-half--warn' : '';

  el.innerHTML = `
    <div class="cc-comparison-half">
      <span class="cc-comparison-half__label">Test</span>
      <div class="cc-comparison-half__metrics">
        <div class="cc-comparison-half__item"><span class="cc-comparison-half__key">DM</span> <span class="cc-comparison-half__val">${testDm}</span></div>
        <div class="cc-comparison-half__item"><span class="cc-comparison-half__key">Fit</span> <span class="cc-comparison-half__val">${testFit}</span></div>
        <div class="cc-comparison-half__item"><span class="cc-comparison-half__key">Blurb</span> <span class="cc-comparison-half__val">${testBlurb}</span></div>
      </div>
    </div>
    <div class="cc-comparison-half ${prodWarnClass}">
      <span class="cc-comparison-half__label">Prod (7d)</span>
      <div class="cc-comparison-half__metrics">
        <div class="cc-comparison-half__item"><span class="cc-comparison-half__key">DM</span> <span class="cc-comparison-half__val">${prodDm}</span></div>
        <div class="cc-comparison-half__item"><span class="cc-comparison-half__key">Fit</span> <span class="cc-comparison-half__val">${prodFit}</span></div>
        <div class="cc-comparison-half__item"><span class="cc-comparison-half__key">Blurb</span> <span class="cc-comparison-half__val">${prodBlurb}</span></div>
      </div>
    </div>`;
  el.style.display = '';
}
