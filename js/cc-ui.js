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

// ── Pulse Card Click Handlers ──

function initPulseClicks() {
  const health = document.getElementById('pulse-health');
  const quality = document.getElementById('pulse-quality');
  const attention = document.getElementById('pulse-attention');

  if (health) health.addEventListener('click', () => {
    switchTab('test');
    // Scroll to run history
    const hist = document.getElementById('run-history');
    if (hist) hist.scrollIntoView({ behavior: 'smooth', block: 'start' });
  });

  if (quality) quality.addEventListener('click', () => {
    switchTab('live');
    setLiveFilter('today');
  });

  if (attention) attention.addEventListener('click', () => {
    switchTab('test');
    // If there's a latest run with gaps, expand it
    const firstRow = document.querySelector('.cc-run-history__table tbody tr[data-run-id]');
    if (firstRow && !firstRow.classList.contains('cc-run-row--expanded')) {
      firstRow.click();
    }
  });
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
    return `
      <div class="cc-live-entry" data-query-id="${q.id}" onclick="openQueryDetail('${q.id}')" style="cursor:pointer" title="Click for details">
        <span class="cc-live-entry__time">${fmtTime(q.created_at)}</span>
        <span class="cc-live-entry__query">${escapeHtml(q.special_request || '(empty)')}</span>
        <span class="cc-live-entry__dm ${ragClass(dm)}">DM: ${dm}</span>
        <span class="cc-live-entry__icon ${iconClass}">${icon}</span>
        ${restName ? `<span class="cc-live-entry__rest">${escapeHtml(restName)}</span>` : ''}
      </div>
    `;
  }).join('');
}

function updateLiveKPIs(searches, avgDm, lowScores, responseTime) {
  const el = (id, val) => {
    const e = document.getElementById(id);
    if (e) e.textContent = typeof val === 'number' ? (Number.isInteger(val) ? val : val.toFixed(1)) : val;
  };
  el('live-searches', searches);
  el('live-avg-dm', Math.round(avgDm));
  el('live-low-scores', lowScores);
  el('live-response-time', responseTime ? `${responseTime}ms` : '--');
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
      <tr class="cc-run-row ${hasGaps ? 'cc-run-row--has-gaps' : ''}" data-run-id="${escapeHtml(r.run_id)}" onclick="toggleRunDetail(this)" style="cursor:pointer" title="${hasGaps ? 'Click to see issues' : 'Click to see details'}">
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
        closeQueryPanel();
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
    const { data: query } = await sbClient
      .from('user_queries')
      .select(`
        id, special_request, occasion, price_level, neighborhood_id,
        donde_match, created_at, recommended_restaurant_id, response_time_ms,
        was_fallback, feedback,
        restaurants (
          name, address, cuisine_type, google_rating, google_review_count,
          price_level, noise_level, best_for_oneliner,
          photo_urls, neighborhoods(name)
        )
      `)
      .eq('id', queryId)
      .single();

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
        <div class="cc-query-panel__val">${query.response_time_ms ? query.response_time_ms + 'ms' : '--'}${query.was_fallback ? ' &middot; <span style="color:var(--cc-amber)">fallback</span>' : ''}</div>
      </div>

      ${query.feedback ? `<div class="cc-query-panel__section">
        <div class="cc-query-panel__label">Feedback</div>
        <div class="cc-query-panel__val">${query.feedback === 'like' ? '&#128077; Liked' : '&#128078; Disliked'}</div>
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
