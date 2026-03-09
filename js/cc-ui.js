/**
 * DondeAI Command Center — UI Updates & Init
 * Agent card UI, hero KPIs, focus strip, activity log, section toggles, init
 */

// ═══════════════════════════════════════════════════════════════════
// System Status
// ═══════════════════════════════════════════════════════════════════

function updateSystemStatus(text, color) {
  const dot = document.getElementById('status-dot');
  const txt = document.getElementById('status-text');
  txt.textContent = text;
  dot.className = 'cc-header__dot';
  if (color === 'amber') dot.classList.add('cc-header__dot--paused');
  else if (color !== 'green') dot.classList.add('cc-header__dot--offline');
}

// ═══════════════════════════════════════════════════════════════════
// Clock
// ═══════════════════════════════════════════════════════════════════

function updateClock() {
  const now = new Date();
  const clockEl = document.getElementById('clock');
  if (clockEl) clockEl.textContent = now.toTimeString().split(' ')[0];

  if (state.startTime) {
    const elapsed = Math.floor((now - state.startTime) / 1000);
    const h = String(Math.floor(elapsed / 3600)).padStart(2, '0');
    const m = String(Math.floor((elapsed % 3600) / 60)).padStart(2, '0');
    const s = String(elapsed % 60).padStart(2, '0');
    const upEl = document.getElementById('uptime');
    if (upEl) upEl.textContent = `${h}:${m}:${s}`;
  }
}

// ═══════════════════════════════════════════════════════════════════
// Agent Card UI
// ═══════════════════════════════════════════════════════════════════

function updateAgentStatusUI(agentId) {
  const agent = state.agents[agentId];
  const el = document.getElementById(`${agentId}-status`);
  if (!el) return;

  el.className = 'cc-agent__status';
  switch (agent.status) {
    case 'running':
      el.classList.add('cc-agent__status--running');
      el.textContent = 'Running';
      break;
    case 'paused':
    case 'budget_paused':
      el.classList.add('cc-agent__status--paused');
      el.textContent = agent.status === 'budget_paused' ? 'Budget Limit' : 'Paused';
      break;
    case 'error':
      el.classList.add('cc-agent__status--error');
      el.textContent = 'Error';
      break;
    default:
      el.classList.add('cc-agent__status--idle');
      el.textContent = 'Idle';
  }
}

function updateAgentCardUI(agentId) {
  const a = state.agents[agentId];

  const levelEl = document.getElementById(`${agentId}-level`);
  if (levelEl) levelEl.textContent = `Lvl ${a.level}`;

  const hpFill = document.getElementById(`${agentId}-hp-fill`);
  const hpVal = document.getElementById(`${agentId}-hp-val`);
  if (hpFill) {
    hpFill.style.width = `${a.hp}%`;
    hpFill.className = 'cc-agent__health-fill';
    if (a.hp >= 70) hpFill.classList.add('cc-agent__health-fill--high');
    else if (a.hp >= 40) hpFill.classList.add('cc-agent__health-fill--medium');
    else hpFill.classList.add('cc-agent__health-fill--low');
  }
  if (hpVal) hpVal.textContent = `${a.hp}%`;

  const xpEl = document.getElementById(`${agentId}-xp`);
  if (xpEl) xpEl.textContent = `Score: ${a.xp.toLocaleString()}`;

  switch (agentId) {
    case 'atlas':
      setText('atlas-queries', a.queries);
      setText('atlas-pass', a.total > 0 ? Math.round((a.pass / a.total) * 100) + '%' : '--', a.total > 0 ? (a.pass / a.total >= 0.8 ? 'good' : a.pass / a.total >= 0.6 ? 'warn' : 'bad') : null);
      setText('atlas-avg', a.avgDm || '--', a.avgDm >= 70 ? 'good' : a.avgDm >= 50 ? 'warn' : 'bad');
      setText('atlas-gaps', a.gaps, a.gaps > 10 ? 'bad' : a.gaps > 0 ? 'warn' : 'good');
      break;
    case 'qaudit':
      setText('qaudit-audits', a.audits);
      setText('qaudit-grade', a.grade, a.grade.startsWith('A') ? 'good' : a.grade.startsWith('B') ? 'warn' : 'bad');
      setText('qaudit-slop', a.slop, a.slop > 0 ? 'bad' : 'good');
      setText('qaudit-clean', a.clean, 'good');
      break;
    case 'sentinel':
      setText('sentinel-checks', a.checks);
      setText('sentinel-regs', a.regressions, a.regressions > 0 ? 'bad' : 'good');
      setText('sentinel-baseline', a.baseline);
      setText('sentinel-delta', a.delta, a.delta === 'OK' ? 'good' : 'bad');
      break;
    case 'hunter':
      setText('hunter-probes', a.probes);
      setText('hunter-vulns', a.vulns, a.vulns > 0 ? 'bad' : 'good');
      setText('hunter-contract', a.contract, a.contract === 'OK' ? 'good' : a.contract === 'FAIL' ? 'bad' : null);
      setText('hunter-errors', a.errors, a.errors > 0 ? 'bad' : 'good');
      break;
    case 'guardian':
      setText('guardian-records', a.records);
      setText('guardian-issues', a.issues, a.issues > 0 ? 'warn' : 'good');
      setText('guardian-orphans', a.orphans, a.orphans > 0 ? 'bad' : 'good');
      setText('guardian-coverage', a.coverage);
      break;
  }
}

function setText(id, value, colorClass) {
  const el = document.getElementById(id);
  if (!el) return;
  el.textContent = value;
  if (colorClass) {
    el.className = 'cc-agent__stat-value';
    el.classList.add(`cc-agent__stat-value--${colorClass}`);
  }
}

// ═══════════════════════════════════════════════════════════════════
// Budget UI
// ═══════════════════════════════════════════════════════════════════

function updateBudgetUI() {
  const remaining = DAILY_BUDGET - state.budgetUsed;
  const pctRemaining = Math.round((remaining / DAILY_BUDGET) * 100);
  const textEl = document.getElementById('budget-text');
  if (textEl) textEl.textContent = `${state.budgetUsed} / ${DAILY_BUDGET}`;

  const fill = document.getElementById('budget-fill');
  if (fill) {
    fill.style.width = `${pctRemaining}%`;
    fill.className = 'cc-controls__budget-fill';
    if (pctRemaining <= 20) fill.classList.add('cc-controls__budget-fill--critical');
    else if (pctRemaining <= 50) fill.classList.add('cc-controls__budget-fill--warning');
  }
}

// ═══════════════════════════════════════════════════════════════════
// Boss Bar
// ═══════════════════════════════════════════════════════════════════

function updateBossBar() {
  const atlas = state.agents.atlas;
  const passRate = atlas.total > 0 ? atlas.pass / atlas.total : 0.5;
  const bossHp = Math.max(0, Math.round((1 - passRate) * 100));
  const fillEl = document.getElementById('boss-fill');
  const hpEl = document.getElementById('boss-hp');
  if (fillEl) fillEl.style.width = `${bossHp}%`;
  if (hpEl) hpEl.textContent = `${bossHp}%`;
}

// ═══════════════════════════════════════════════════════════════════
// Leaderboard
// ═══════════════════════════════════════════════════════════════════

function updateLeaderboard() {
  const entries = Object.entries(state.agents)
    .map(([id, a]) => ({ id, name: AGENT_DEFS[id].name, xp: a.xp }))
    .sort((a, b) => b.xp - a.xp);

  const list = document.getElementById('leaderboard');
  if (!list) return;
  const rankClasses = ['cc-rankings__rank--1', 'cc-rankings__rank--2', 'cc-rankings__rank--3', '', ''];

  list.innerHTML = entries.map((e, i) => `
    <div class="cc-rankings__entry">
      <span class="cc-rankings__rank ${rankClasses[i]}">${i + 1}.</span>
      <span class="cc-rankings__name">${e.name}</span>
      <span class="cc-rankings__score">${e.xp.toLocaleString()}</span>
    </div>
  `).join('');
}

// ═══════════════════════════════════════════════════════════════════
// Hero KPIs
// ═══════════════════════════════════════════════════════════════════

function updateHeroKPIs() {
  const atlas = state.agents.atlas;
  const sentinel = state.agents.sentinel;
  const qaudit = state.agents.qaudit;
  const guardian = state.agents.guardian;

  // Pass Rate (from agents)
  if (atlas.total > 0) {
    const passRate = Math.round((atlas.pass / atlas.total) * 100);
    setKPI('kpi-pass-val', passRate + '%', passRate >= 80 ? 'rag-green' : passRate >= 60 ? 'rag-amber' : 'rag-red');
  }

  // Avg Score
  if (atlas.avgDm > 0) {
    setKPI('kpi-avg-val', atlas.avgDm, ragClass(atlas.avgDm));
  }

  // Budget
  const remaining = DAILY_BUDGET - state.budgetUsed;
  const budgetPct = Math.round((remaining / DAILY_BUDGET) * 100);
  setKPI('kpi-budget-val', remaining, budgetPct >= 50 ? 'rag-green' : budgetPct >= 20 ? 'rag-amber' : 'rag-red');

  // Regressions
  setKPI('kpi-reg-val', sentinel.regressions, sentinel.regressions === 0 ? 'rag-green' : sentinel.regressions <= 2 ? 'rag-amber' : 'rag-red');

  // Blurb Grade
  if (qaudit.grade !== '--') {
    setKPI('kpi-blurb-val', qaudit.grade, qaudit.grade.startsWith('A') ? 'rag-green' : qaudit.grade.startsWith('B') ? 'rag-amber' : 'rag-red');
  }

  // Data Health
  if (guardian.coverage !== '--') {
    const cov = parseInt(guardian.coverage);
    setKPI('kpi-data-val', guardian.coverage, cov >= 90 ? 'rag-green' : cov >= 70 ? 'rag-amber' : 'rag-red');
  }

  // Active agents
  const running = Object.values(state.agents).filter(a => a.status === 'running').length;
  setKPI('kpi-agents-val', `${running}/5`, running >= 5 ? 'rag-green' : running >= 3 ? 'rag-amber' : 'rag-red');

  // Update focus strip
  updateFocusStrip();
}

function updateHeroKPIsFromGauntlet(data) {
  if (!data || !data.summary) return;
  const s = data.summary;
  const passRate = s.total > 0 ? Math.round(s.passed60 / s.total * 100) : 0;

  setKPI('kpi-pass-val', passRate + '%', passRate >= 80 ? 'rag-green' : passRate >= 60 ? 'rag-amber' : 'rag-red');
  setKPI('kpi-avg-val', s.avg_dm, ragClass(s.avg_dm));
  setKPI('kpi-gaps-val', s.gap_count, s.gap_count === 0 ? 'rag-green' : s.gap_count <= 10 ? 'rag-amber' : 'rag-red');
}

function setKPI(id, value, colorClass) {
  const el = document.getElementById(id);
  if (!el) return;
  el.textContent = value;
  el.className = 'cc-kpi__value';
  if (colorClass) el.classList.add(colorClass);
}

// ═══════════════════════════════════════════════════════════════════
// Focus Strip
// ═══════════════════════════════════════════════════════════════════

function updateFocusStrip() {
  const alerts = [];

  // Regressions
  if (state.agents.sentinel.regressions > 0) {
    alerts.push({ text: `${state.agents.sentinel.regressions} regression(s) detected by Sentinel`, type: 'red' });
  }

  // Budget critical
  const remaining = DAILY_BUDGET - state.budgetUsed;
  if (remaining <= 10 && remaining > 0) {
    alerts.push({ text: `API budget low: ${remaining} calls remaining`, type: 'amber' });
  } else if (remaining <= 0) {
    alerts.push({ text: 'API budget exhausted', type: 'red' });
  }

  // Critical gaps from atlas
  if (state.agents.atlas.gaps > 10) {
    alerts.push({ text: `Atlas found ${state.agents.atlas.gaps} gaps — search quality needs attention`, type: 'amber' });
  }

  // Blurb quality
  if (state.agents.qaudit.grade === 'C' || state.agents.qaudit.grade === 'F') {
    alerts.push({ text: `Blurb quality grade: ${state.agents.qaudit.grade} — slop patterns detected`, type: 'red' });
  }

  const strip = document.getElementById('focus-strip');
  const alertsEl = document.getElementById('focus-alerts');

  if (alerts.length === 0) {
    strip.style.display = 'none';
    return;
  }

  strip.style.display = '';
  alertsEl.innerHTML = alerts.map(a => `
    <div class="cc-focus__alert ${a.type === 'amber' ? 'cc-focus__alert--amber' : ''}">
      <span class="cc-focus__alert-icon">${a.type === 'red' ? '&#9888;' : '&#9432;'}</span>
      <span class="cc-focus__alert-text">${a.text}</span>
    </div>
  `).join('');
}

// ═══════════════════════════════════════════════════════════════════
// Activity Log
// ═══════════════════════════════════════════════════════════════════

function addLog(agent, message, severity) {
  const now = new Date();
  const time = now.toTimeString().split(' ')[0];
  const entry = { time, agent: agent.toUpperCase(), agentId: agent.toLowerCase(), message, severity };
  state.logs.push(entry);
  if (state.logs.length > MAX_LOG_ENTRIES) state.logs.shift();
  renderLogEntry(entry);
}

function renderLogEntry(entry) {
  if (state.logFilter !== 'all' && entry.agentId !== state.logFilter && entry.agentId !== 'system') return;

  const logEl = document.getElementById('battle-log');
  if (!logEl) return;
  const iconMap = { pass: '&#10003;', warn: '&#9888;', fail: '&#10007;', star: '&#9733;' };
  const agentClass = `cc-log__agent--${entry.agentId}`;

  const div = document.createElement('div');
  div.className = 'cc-log__entry';
  div.setAttribute('data-agent', entry.agentId);
  div.innerHTML = `
    <span class="cc-log__time">${entry.time}</span>
    <span class="cc-log__agent ${agentClass}">${entry.agent}</span>
    <span class="cc-log__message">${escapeHtml(entry.message)}</span>
    <span class="cc-log__icon cc-log__icon--${entry.severity}">${iconMap[entry.severity] || '&#9679;'}</span>
  `;

  logEl.appendChild(div);
  logEl.scrollTop = logEl.scrollHeight;
  while (logEl.children.length > MAX_LOG_ENTRIES) logEl.removeChild(logEl.firstChild);
}

function filterLog(filter) {
  state.logFilter = filter;
  document.querySelectorAll('.cc-log__filter').forEach(btn => {
    btn.classList.toggle('cc-log__filter--active', btn.dataset.filter === filter);
  });
  const logEl = document.getElementById('battle-log');
  if (logEl) {
    logEl.innerHTML = '';
    state.logs.forEach(entry => renderLogEntry(entry));
  }
}

// ═══════════════════════════════════════════════════════════════════
// Notifications
// ═══════════════════════════════════════════════════════════════════

function addNotification(type, message, agentId) {
  state.notifications.push({
    id: Date.now(), type, message, agentId,
    timestamp: new Date().toISOString(), acknowledged: false,
  });
  renderNotifications();
}

function renderNotifications() {
  const pending = state.notifications.filter(n => !n.acknowledged);
  const bar = document.getElementById('notification-bar');
  const badge = document.getElementById('notif-badge');
  const list = document.getElementById('notification-list');

  badge.textContent = pending.length;
  if (pending.length > 0) {
    bar.style.display = '';
  } else {
    bar.style.display = 'none';
    return;
  }

  list.innerHTML = pending.map(n => `
    <div class="notification-item ${n.type === 'api_error' || n.type === 'critical' ? 'notification-item--critical' : ''}">
      <span class="notification-item__text">${escapeHtml(n.message)}</span>
      <div class="notification-item__actions">
        ${n.type === 'budget_request' ? `
          <button class="notification-btn notification-btn--approve" onclick="handleNotifAction(${n.id}, 'approve')">Approve</button>
          <button class="notification-btn notification-btn--deny" onclick="handleNotifAction(${n.id}, 'deny')">Deny</button>
          <button class="notification-btn notification-btn--defer" onclick="handleNotifAction(${n.id}, 'defer')">Later</button>
        ` : `
          <button class="notification-btn notification-btn--approve" onclick="handleNotifAction(${n.id}, 'ack')">Dismiss</button>
        `}
      </div>
    </div>
  `).join('');
}

function handleNotifAction(notifId, action) {
  const notif = state.notifications.find(n => n.id === notifId);
  if (!notif) return;
  switch (action) {
    case 'approve':
      notif.acknowledged = true;
      if (notif.agentId && state.agents[notif.agentId]) {
        state.agents[notif.agentId].apiUsed = 0;
        state.agents[notif.agentId].status = 'idle';
        addLog('SYSTEM', `CEO approved additional API calls for ${AGENT_DEFS[notif.agentId]?.name || notif.agentId}.`, 'star');
      }
      break;
    case 'deny':
      notif.acknowledged = true;
      addLog('SYSTEM', `CEO denied request from ${AGENT_DEFS[notif.agentId]?.name || notif.agentId}.`, 'warn');
      break;
    case 'defer':
      notif.acknowledged = true;
      setTimeout(() => { notif.acknowledged = false; renderNotifications(); }, 60000);
      addLog('SYSTEM', 'Request deferred. Will ask again in 1 minute.', 'warn');
      break;
    case 'ack':
      notif.acknowledged = true;
      break;
  }
  renderNotifications();
  saveState();
}

// ═══════════════════════════════════════════════════════════════════
// Game Over
// ═══════════════════════════════════════════════════════════════════

function showGameOver(sessionStartTime) {
  const overlay = document.getElementById('game-over');
  const statsEl = document.getElementById('game-over-stats');
  const durationEl = document.getElementById('game-over-duration');
  const saveStatusEl = document.getElementById('game-over-save-status');

  // Duration
  if (durationEl && sessionStartTime) {
    const elapsed = Math.floor((new Date() - sessionStartTime) / 1000);
    const m = Math.floor(elapsed / 60);
    const s = elapsed % 60;
    durationEl.textContent = `Duration: ${m}m ${s}s`;
  }

  // Stats grid
  const atlas = state.agents.atlas;
  const passRate = atlas.total > 0 ? Math.round((atlas.pass / atlas.total) * 100) : 0;
  const totalQueries = Object.values(state.agents).reduce((s, a) => s + (a.queries || a.probes || a.checks || a.audits || a.records || 0), 0);

  function statCard(value, label, colorClass) {
    return `<div class="cc-overlay__stat"><div class="cc-overlay__stat-value ${colorClass || ''}">${value}</div><div class="cc-overlay__stat-label">${label}</div></div>`;
  }

  statsEl.innerHTML = [
    statCard(totalQueries, 'Queries'),
    statCard(passRate + '%', 'Pass Rate', passRate >= 80 ? 'rag-green' : passRate >= 60 ? 'rag-amber' : 'rag-red'),
    statCard(atlas.avgDm || '--', 'Avg Score', ragClass(atlas.avgDm || 0)),
    statCard(atlas.gaps, 'Gaps', atlas.gaps === 0 ? 'rag-green' : atlas.gaps <= 5 ? 'rag-amber' : 'rag-red'),
    statCard(state.agents.qaudit.grade, 'Blurb Grade'),
    statCard(state.agents.sentinel.regressions, 'Regressions', state.agents.sentinel.regressions === 0 ? 'rag-green' : 'rag-red'),
  ].join('');

  if (saveStatusEl) saveStatusEl.textContent = '';
  overlay.classList.add('cc-overlay--visible');
}

function dismissGameOver() {
  document.getElementById('game-over').classList.remove('cc-overlay--visible');
}

// ═══════════════════════════════════════════════════════════════════
// Polling
// ═══════════════════════════════════════════════════════════════════

function pollAgentStatus() {
  updateBudgetUI();
  Object.keys(state.agents).forEach(id => {
    updateAgentCardUI(id);
    updateAgentStatusUI(id);
  });
  updateHeroKPIs();
}

// ═══════════════════════════════════════════════════════════════════
// Section Toggles
// ═══════════════════════════════════════════════════════════════════

function initSectionToggles() {
  document.querySelectorAll('.cc-section__header[data-toggle]').forEach(header => {
    header.addEventListener('click', (e) => {
      // Don't toggle if clicking buttons
      if (e.target.closest('.cc-btn') || e.target.closest('.cc-controls') || e.target.closest('.cc-header__run-selector')) return;

      const section = header.closest('.cc-section');
      const body = section.querySelector('.cc-section__body');
      const chevron = section.querySelector('.cc-section__chevron');
      const isOpen = section.classList.contains('cc-section--open');

      if (isOpen) {
        section.classList.remove('cc-section--open');
        body.style.display = 'none';
        if (chevron) chevron.innerHTML = '&#9656;';
      } else {
        section.classList.add('cc-section--open');
        body.style.display = '';
        if (chevron) chevron.innerHTML = '&#9662;';

        // Lazy load trends
        if (header.dataset.toggle === 'trends' && !historyLoaded) {
          loadTrendsSection();
        }

        // Lazy load maintenance
        if (header.dataset.toggle === 'maintenance' && !maintenanceLoaded) {
          loadMaintenanceSection();
        }
      }
    });
  });
}

// ═══════════════════════════════════════════════════════════════════
// Start Dropdown (Test Count + Filters)
// ═══════════════════════════════════════════════════════════════════

// Which agents are enabled for the next run
const agentFilter = { atlas: true, sentinel: true, hunter: true, qaudit: true, guardian: true };

const FILTER_PRESETS = {
  full:       { atlas: true, sentinel: true, hunter: true, qaudit: true, guardian: true },
  quick:      { atlas: true, sentinel: false, hunter: false, qaudit: false, guardian: false },
  regression: { atlas: false, sentinel: true, hunter: false, qaudit: false, guardian: false },
  security:   { atlas: false, sentinel: false, hunter: true, qaudit: false, guardian: false },
};

function applyFilterPreset(preset) {
  const cfg = FILTER_PRESETS[preset];
  if (!cfg) return;
  Object.assign(agentFilter, cfg);
  syncFilterUI();
  updateActivePresetUI(preset);
  updateFilterSummary();
}

function syncFilterUI() {
  document.querySelectorAll('.cc-filter-chip').forEach(chip => {
    const agentId = chip.dataset.agent;
    const cb = chip.querySelector('input[type="checkbox"]');
    if (cb) cb.checked = agentFilter[agentId];
    chip.classList.toggle('cc-filter-chip--checked', agentFilter[agentId]);
  });
}

function updateActivePresetUI(activePreset) {
  document.querySelectorAll('.cc-filter-preset').forEach(btn => {
    btn.classList.toggle('cc-filter-preset--active', btn.dataset.preset === activePreset);
  });
}

function detectActivePreset() {
  for (const [name, cfg] of Object.entries(FILTER_PRESETS)) {
    if (Object.keys(cfg).every(k => agentFilter[k] === cfg[k])) return name;
  }
  return null;
}

function updateFilterSummary() {
  const el = document.getElementById('filter-summary');
  if (!el) return;
  const count = Object.values(agentFilter).filter(Boolean).length;
  const slider = document.getElementById('test-count-slider');
  const queries = slider ? parseInt(slider.value) : 10;
  // Cost estimate: Atlas uses queries, others add ~30% overhead
  const apiCalls = (agentFilter.atlas ? queries : 0) +
    (agentFilter.sentinel ? Math.min(15, Math.ceil(queries * 0.5)) : 0) +
    (agentFilter.hunter ? Math.min(10, Math.ceil(queries * 0.3)) : 0) +
    (agentFilter.guardian ? Math.min(5, Math.ceil(queries * 0.2)) : 0);
  const est = (apiCalls * 0.01).toFixed(2);
  el.textContent = `${count} agent${count !== 1 ? 's' : ''} · ${agentFilter.atlas ? queries + ' queries · ' : ''}~$${est}`;
}

function toggleStartDropdown(e) {
  e.stopPropagation();
  const dd = document.getElementById('start-dropdown');
  dd.classList.toggle('cc-start-dropdown--open');
}

function initStartDropdown() {
  const slider = document.getElementById('test-count-slider');
  const valEl = document.getElementById('test-count-val');
  const costEl = document.getElementById('test-cost-estimate');

  if (slider) {
    slider.addEventListener('input', () => {
      const count = parseInt(slider.value);
      if (valEl) valEl.textContent = count;
      const est = (count * 1.3 * 0.01).toFixed(2);
      if (costEl) costEl.textContent = `Est. ~$${est} API usage`;
      updateFilterSummary();
    });
  }

  // Wire up chip checkboxes
  document.querySelectorAll('.cc-filter-chip').forEach(chip => {
    chip.addEventListener('click', (e) => {
      e.preventDefault();
      const agentId = chip.dataset.agent;
      agentFilter[agentId] = !agentFilter[agentId];
      // Ensure at least one agent is always selected
      if (Object.values(agentFilter).every(v => !v)) {
        agentFilter[agentId] = true;
      }
      syncFilterUI();
      updateActivePresetUI(detectActivePreset());
      updateFilterSummary();
    });
  });

  updateFilterSummary();

  // Close dropdown when clicking outside
  document.addEventListener('click', (e) => {
    const dd = document.getElementById('start-dropdown');
    if (dd && !e.target.closest('.cc-start-group')) {
      dd.classList.remove('cc-start-dropdown--open');
    }
  });
}

// ═══════════════════════════════════════════════════════════════════
// Mode Toggle (Testing / Production)
// ═══════════════════════════════════════════════════════════════════

let currentMode = 'testing';
let productionLoaded = false;

function switchMode(mode) {
  if (mode === currentMode) return;
  currentMode = mode;

  document.getElementById('mode-testing').classList.toggle('cc-mode-toggle__btn--active', mode === 'testing');
  document.getElementById('mode-production').classList.toggle('cc-mode-toggle__btn--active', mode === 'production');

  document.getElementById('testing-dashboard').style.display = mode === 'testing' ? '' : 'none';
  document.getElementById('production-dashboard').style.display = mode === 'production' ? '' : 'none';

  if (mode === 'production' && !productionLoaded) {
    loadProductionDashboard();
  }
}

async function loadProductionDashboard() {
  productionLoaded = true;
  const content = document.getElementById('prod-content');
  const kpis = document.getElementById('prod-kpis');

  try {
    const { createClient } = await import('https://esm.sh/@supabase/supabase-js@2');
    const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

    // Fetch live production stats in parallel
    const [
      totalSearches, todaySearches, uniqueUsers,
      avgScoreRes, recentQueries, errorQueries,
      userHistory,
    ] = await Promise.all([
      sb.from('user_queries').select('*', { count: 'exact', head: true }),
      sb.from('user_queries').select('*', { count: 'exact', head: true }).gte('created_at', new Date(new Date().setHours(0,0,0,0)).toISOString()),
      sb.from('user_queries').select('user_id', { count: 'exact', head: true }).not('user_id', 'is', null),
      sb.from('user_queries').select('donde_match').not('donde_match', 'is', null).order('created_at', { ascending: false }).limit(100),
      // Join with restaurants to get the name (user_queries has recommended_restaurant_id FK)
      sb.from('user_queries').select('special_request, donde_match, created_at, occasion, restaurants(name)').order('created_at', { ascending: false }).limit(30),
      sb.from('user_queries').select('*', { count: 'exact', head: true }).lt('donde_match', 40),
      // User search history (saved by authenticated users)
      sb.from('user_searches').select('craving, restaurant_name, cuisine_type, donde_match, created_at, occasion').order('created_at', { ascending: false }).limit(30),
    ]);

    const totalCount = totalSearches.count || 0;
    const todayCount = todaySearches.count || 0;
    const userCount = uniqueUsers.count || 0;
    const recentScores = avgScoreRes.data || [];
    const avgDm = recentScores.length > 0 ? Math.round(recentScores.reduce((s, r) => s + (r.donde_match || 0), 0) / recentScores.length) : 0;
    const lowScoreCount = errorQueries.count || 0;
    const recent = recentQueries.data || [];
    const history = userHistory.data || [];

    // Render KPIs
    function prodCard(value, label, sub, colorClass) {
      return `<div class="cc-prod-card"><div class="cc-prod-card__value ${colorClass || ''}">${value}</div><div class="cc-prod-card__label">${label}</div>${sub ? `<div class="cc-prod-card__sub">${sub}</div>` : ''}</div>`;
    }

    kpis.innerHTML = [
      prodCard(totalCount.toLocaleString(), 'Total Searches', '', ''),
      prodCard(todayCount, 'Today', new Date().toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }), ''),
      prodCard(userCount, 'Unique Users', '', ''),
      prodCard(avgDm, 'Avg DM (Last 100)', '', ragClass(avgDm)),
      prodCard(lowScoreCount, 'Low Scores (<40)', '', lowScoreCount > 10 ? 'rag-red' : lowScoreCount > 3 ? 'rag-amber' : 'rag-green'),
    ].join('');

    // Production alerts
    const alerts = [];
    if (avgDm < 60) alerts.push({ text: `Average DM is ${avgDm} — below 60 threshold`, type: 'red' });
    if (lowScoreCount > 10) alerts.push({ text: `${lowScoreCount} queries scored below 40 — investigate intent gaps`, type: 'red' });
    if (todayCount === 0) alerts.push({ text: 'No searches today — check API health', type: 'amber' });

    const alertsEl = document.getElementById('prod-alerts');
    const alertListEl = document.getElementById('prod-alert-list');
    if (alerts.length > 0) {
      alertsEl.style.display = '';
      alertListEl.innerHTML = alerts.map(a => `
        <div class="cc-focus__alert ${a.type === 'amber' ? 'cc-focus__alert--amber' : ''}">
          <span class="cc-focus__alert-icon">${a.type === 'red' ? '&#9888;' : '&#9432;'}</span>
          <span class="cc-focus__alert-text">${a.text}</span>
        </div>
      `).join('');
    }

    let h = '';

    // Recent API searches table (from user_queries — every API call)
    h += '<div class="cc-subsection"><div class="cc-subsection__title">Recent API Searches</div>';
    if (recent.length > 0) {
      h += '<div class="cc-table-wrap"><table class="cc-table"><thead><tr>';
      h += '<th>Time</th><th>Query</th><th>Occasion</th><th>Restaurant</th><th>DM</th>';
      h += '</tr></thead><tbody>';
      for (const q of recent) {
        const time = q.created_at ? new Date(q.created_at).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : '--';
        const dm = q.donde_match;
        const restName = q.restaurants?.name || '—';
        h += `<tr>
          <td style="font-family:var(--cc-mono);font-size:0.68rem;color:var(--cc-text-3)">${time}</td>
          <td>${escapeHtml((q.special_request || '').substring(0, 50))}</td>
          <td style="font-size:0.68rem;color:var(--cc-text-3)">${escapeHtml((q.occasion || '—').substring(0, 15))}</td>
          <td>${escapeHtml(restName.substring(0, 25))}</td>
          <td><span class="dm-badge ${dm != null ? ragClass(dm) : ''}">${dm != null ? dm : '—'}</span></td>
        </tr>`;
      }
      h += '</tbody></table></div>';
    } else {
      h += '<p class="cc-muted">No recent searches found.</p>';
    }
    h += '</div>';

    // User search history (from user_searches — authenticated user saves)
    h += '<div class="cc-subsection"><div class="cc-subsection__title">User History (Saved Searches)</div>';
    if (history.length > 0) {
      h += '<div class="cc-table-wrap"><table class="cc-table"><thead><tr>';
      h += '<th>Date</th><th>Craving</th><th>Occasion</th><th>Restaurant</th><th>Cuisine</th><th>DM</th>';
      h += '</tr></thead><tbody>';
      for (const s of history) {
        const date = s.created_at ? new Date(s.created_at).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : '--';
        const dm = s.donde_match;
        h += `<tr>
          <td style="font-family:var(--cc-mono);font-size:0.68rem;color:var(--cc-text-3)">${date}</td>
          <td>${escapeHtml((s.craving || '').substring(0, 40))}</td>
          <td style="font-size:0.68rem;color:var(--cc-text-3)">${escapeHtml((s.occasion || '—').substring(0, 15))}</td>
          <td>${escapeHtml((s.restaurant_name || '—').substring(0, 25))}</td>
          <td style="font-size:0.68rem;color:var(--cc-text-3)">${escapeHtml((s.cuisine_type || '—').substring(0, 15))}</td>
          <td><span class="dm-badge ${dm != null ? ragClass(dm) : ''}">${dm != null ? dm : '—'}</span></td>
        </tr>`;
      }
      h += '</tbody></table></div>';
    } else {
      h += '<p class="cc-muted">No saved user searches yet. Users see history after signing in.</p>';
    }
    h += '</div>';

    content.innerHTML = h;
  } catch (e) {
    content.innerHTML = `<p style="color:var(--cc-red)">Failed to load production data: ${e.message}</p>`;
    productionLoaded = false;
  }
}

// ═══════════════════════════════════════════════════════════════════
// Init
// ═══════════════════════════════════════════════════════════════════

loadState();
updateClock();
updateBudgetUI();
updateBossBar();
updateLeaderboard();
updateHeroKPIs();

// Render persisted logs
state.logs.forEach(entry => renderLogEntry(entry));

// Update all agent cards with persisted data
Object.keys(state.agents).forEach(id => {
  updateAgentCardUI(id);
  updateAgentStatusUI(id);
});

// Start clock
state.clockTimer = setInterval(updateClock, 1000);

// Section toggles
initSectionToggles();

// Start dropdown
initStartDropdown();

// Auth & analytics
checkAuth();
