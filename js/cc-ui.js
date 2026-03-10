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
  positionTabIndicator();
});

// ═══════════════════════════════════════════════════════════════════
// Tab System
// ═══════════════════════════════════════════════════════════════════

function switchTab(name) {
  state.activeTab = name;

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

function updatePulseQuality(dm, sub) {
  const val = document.getElementById('pulse-quality-val');
  const subEl = document.getElementById('pulse-quality-sub');
  if (val) {
    val.textContent = Math.round(dm);
    val.className = `cc-pulse__big ${ragClass(dm)}`;
  }
  if (subEl) subEl.textContent = sub;
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
    const icon = dm >= 60 ? '&#10003;' : dm >= 40 ? '&#9888;' : '&#10007;';
    const iconClass = dm >= 60 ? 'cc-live-icon--pass' : dm >= 40 ? 'cc-live-icon--warn' : 'cc-live-icon--fail';
    return `
      <div class="cc-live-entry">
        <span class="cc-live-entry__time">${fmtTime(q.created_at)}</span>
        <span class="cc-live-entry__query">${escapeHtml(q.special_request || '(empty)')}</span>
        <span class="cc-live-entry__dm ${ragClass(dm)}">DM: ${dm}</span>
        <span class="cc-live-entry__icon ${iconClass}">${icon}</span>
        ${q.restaurant_name ? `<span class="cc-live-entry__rest">${escapeHtml(q.restaurant_name)}</span>` : ''}
      </div>
    `;
  }).join('');
}

function updateLiveKPIs(searches, avgDm, lowScores, errors) {
  const el = (id, val) => {
    const e = document.getElementById(id);
    if (e) e.textContent = typeof val === 'number' ? (Number.isInteger(val) ? val : val.toFixed(1)) : val;
  };
  el('live-searches', searches);
  el('live-avg-dm', Math.round(avgDm));
  el('live-low-scores', lowScores);
  el('live-errors', errors);
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
    return `
      <tr>
        <td>${date}</td>
        <td>${escapeHtml(r.mode || 'test')}</td>
        <td>${r.total || r.dataset_size || '--'}</td>
        <td class="${ragClass(r.avg_dm)}">${r1(r.avg_dm)}</td>
        <td>${passRate}%</td>
        <td class="${deltaClass}">${delta}</td>
      </tr>
    `;
  }).join('');
}

// ═══════════════════════════════════════════════════════════════════
// Keyboard Shortcuts
// ═══════════════════════════════════════════════════════════════════

function initKeyboardShortcuts() {
  document.addEventListener('keydown', (e) => {
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;

    switch (e.key) {
      case '1': switchTab('test'); break;
      case '2': switchTab('live'); break;
      case '3': switchTab('data'); break;
      case 't':
        if (state.activeTest) stopTest();
        else startTest('broad');
        break;
      case '?':
        toggleShortcuts();
        break;
      case 'Escape':
        closeShortcuts();
        break;
    }
  });
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
