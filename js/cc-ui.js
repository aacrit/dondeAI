/**
 * DondeAI Command Center — UI Updates & Init
 * Pulse, status strip, agent table, quick actions, focus strip, activity log, section toggles
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
// Init Data Load (replaces loadStatusStrip — single source of truth)
// Populates: Pulse subtexts, Prod Strip KPIs, Maintenance summary, Suggestion
// ═══════════════════════════════════════════════════════════════════

let _initData = null; // cached for lazy prod detail

async function loadInitData() {
  try {
    const { createClient } = await import('https://esm.sh/@supabase/supabase-js@2');
    const sb = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

    const todayStart = new Date(new Date().setHours(0,0,0,0)).toISOString();

    // 4 parallel queries — the ONLY init-time DB calls
    const [latestRun, totalRes, enrichedRes, todayQueries] = await Promise.all([
      sb.from('gauntlet_runs').select('created_at, avg_dm, total, gap_count').order('created_at', { ascending: false }).limit(1),
      sb.from('restaurants').select('*', { count: 'exact', head: true }),
      sb.from('restaurants').select('*', { count: 'exact', head: true }).not('noise_level', 'is', null),
      // Fetch today's queries WITH donde_match so we can derive avg DM + low scores
      sb.from('user_queries').select('donde_match').gte('created_at', todayStart),
    ]);

    const totalCount = totalRes.count || 0;
    const enrichedCount = enrichedRes.count || 0;
    const enrichedPct = totalCount > 0 ? Math.round(enrichedCount / totalCount * 100) : 0;

    // Derive prod strip KPIs from today's queries (no extra API call)
    const todayRows = todayQueries.data || [];
    const todayCount = todayRows.length;
    const scored = todayRows.filter(q => q.donde_match != null);
    const avgDm = scored.length > 0 ? Math.round(scored.reduce((s, r) => s + r.donde_match, 0) / scored.length) : 0;
    const lowScoreCount = scored.filter(r => r.donde_match < 40).length;

    // Cache for lazy prod detail expansion
    _initData = { totalCount, enrichedCount, enrichedPct, todayCount, avgDm, lowScoreCount, latestRun: latestRun.data?.[0] || null, todayRows };

    // ── Populate Prod Strip ──
    const prodSearches = document.getElementById('prod-searches');
    const prodAvgDm = document.getElementById('prod-avg-dm');
    const prodLow = document.getElementById('prod-low-scores');
    if (prodSearches) prodSearches.textContent = todayCount;
    if (prodAvgDm) {
      prodAvgDm.textContent = scored.length > 0 ? avgDm : '--';
      prodAvgDm.className = 'cc-prod-strip__val';
      if (scored.length > 0) prodAvgDm.classList.add(ragClass(avgDm));
    }
    if (prodLow) {
      prodLow.textContent = lowScoreCount;
      prodLow.className = 'cc-prod-strip__val';
      if (lowScoreCount > 10) prodLow.classList.add('rag-red');
      else if (lowScoreCount > 3) prodLow.classList.add('rag-amber');
      else prodLow.classList.add('rag-green');
    }

    // ── Populate Maintenance summary ──
    const maintSummary = document.getElementById('maintenance-summary');
    if (maintSummary) maintSummary.textContent = `${totalCount} restaurants · ${enrichedPct}% enriched`;

    // ── Enrich Pulse subtexts with DB data (when no session is running) ──
    if (!state.startTime) {
      const healthSub = document.getElementById('pulse-health-sub');
      const qualitySub = document.getElementById('pulse-quality-sub');
      if (_initData.latestRun) {
        const r = _initData.latestRun;
        const passRate = r.total > 0 ? Math.round((r.total - r.gap_count) / r.total * 100) : 0;
        const date = new Date(r.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
        if (healthSub) healthSub.textContent = `${passRate}% pass · ${r.total} queries · ${date}`;
        if (qualitySub) qualitySub.textContent = `DM ${r.avg_dm || '--'} · ${r.gap_count} gaps`;

        // Populate pulse values from last run if no session data
        const healthVal = document.getElementById('pulse-health-val');
        const healthRing = document.getElementById('pulse-health-ring');
        if (healthVal) {
          healthVal.textContent = passRate + '%';
          healthVal.style.color = passRate >= 80 ? 'var(--cc-green)' : passRate >= 60 ? 'var(--cc-amber)' : 'var(--cc-red)';
          const offset = 213.6 * (1 - passRate / 100);
          if (healthRing) { healthRing.style.strokeDashoffset = offset; healthRing.style.stroke = passRate >= 80 ? 'var(--cc-green)' : passRate >= 60 ? 'var(--cc-amber)' : 'var(--cc-red)'; }
        }
        const qualityVal = document.getElementById('pulse-quality-val');
        if (qualityVal && r.avg_dm) {
          qualityVal.textContent = r.avg_dm;
          qualityVal.className = 'cc-pulse__big';
          qualityVal.classList.add(ragClass(r.avg_dm));
        }
        const attentionVal = document.getElementById('pulse-attention-val');
        const attentionSub = document.getElementById('pulse-attention-sub');
        if (attentionVal) {
          attentionVal.textContent = r.gap_count || 0;
          attentionVal.style.color = r.gap_count === 0 ? 'var(--cc-green)' : r.gap_count <= 5 ? 'var(--cc-amber)' : 'var(--cc-red)';
        }
        if (attentionSub) attentionSub.textContent = r.gap_count > 0 ? `${r.gap_count} gaps from last run` : 'All clear';
      }
    }

    // ── Smart Suggestion ──
    computeSuggestion();

  } catch (e) {
    console.warn('Init data load failed:', e);
    const prodSearches = document.getElementById('prod-searches');
    const prodAvgDm = document.getElementById('prod-avg-dm');
    const prodLow = document.getElementById('prod-low-scores');
    if (prodSearches) prodSearches.textContent = '--';
    if (prodAvgDm) prodAvgDm.textContent = '--';
    if (prodLow) prodLow.textContent = '--';
  }
}

// Alias for backward compatibility (called from checkAuth)
function loadStatusStrip() { return loadInitData(); }

// ═══════════════════════════════════════════════════════════════════
// Pulse Cards (3 big hero numbers)
// ═══════════════════════════════════════════════════════════════════

function updatePulseCards() {
  const atlas = state.agents.atlas;
  const sentinel = state.agents.sentinel;
  const qaudit = state.agents.qaudit;
  const guardian = state.agents.guardian;
  const results = state.sessionResults || [];

  // 1. System Health — composite
  let healthScore = 0, healthParts = 0;
  let passRate = 0;
  if (results.length > 0) {
    const passed = results.filter(r => r.donde_match >= 60).length;
    passRate = Math.round((passed / results.length) * 100);
    healthScore += passRate; healthParts++;
  } else if (atlas.total > 0) {
    passRate = Math.round((atlas.pass / atlas.total) * 100);
    healthScore += passRate; healthParts++;
  }
  if (guardian.coverage !== '--') { healthScore += parseInt(guardian.coverage) || 0; healthParts++; }
  if (qaudit.grade !== '--') {
    const gradeMap = { 'A': 100, 'A-': 90, 'B+': 85, 'B': 75, 'C': 50, 'F': 20 };
    healthScore += gradeMap[qaudit.grade] || 50; healthParts++;
  }

  const compositeHealth = healthParts > 0 ? Math.round(healthScore / healthParts) : null;
  const healthVal = document.getElementById('pulse-health-val');
  const healthRing = document.getElementById('pulse-health-ring');
  const healthSub = document.getElementById('pulse-health-sub');
  if (healthVal && compositeHealth !== null) {
    healthVal.textContent = compositeHealth + '%';
    healthVal.style.color = compositeHealth >= 80 ? 'var(--cc-green)' : compositeHealth >= 60 ? 'var(--cc-amber)' : 'var(--cc-red)';
    const offset = 213.6 * (1 - compositeHealth / 100);
    if (healthRing) {
      healthRing.style.strokeDashoffset = offset;
      healthRing.style.stroke = compositeHealth >= 80 ? 'var(--cc-green)' : compositeHealth >= 60 ? 'var(--cc-amber)' : 'var(--cc-red)';
    }
    if (healthSub) healthSub.textContent = `Pass ${passRate}% \u00b7 Coverage ${guardian.coverage !== '--' ? guardian.coverage : '--'} \u00b7 Grade ${qaudit.grade}`;
  }

  // 2. Avg DondeMatch
  const qualityVal = document.getElementById('pulse-quality-val');
  const qualitySub = document.getElementById('pulse-quality-sub');
  let avgDm = null;
  if (results.length > 0) {
    avgDm = Math.round(results.reduce((s, r) => s + r.donde_match, 0) / results.length);
  } else if (atlas.avgDm > 0) {
    avgDm = atlas.avgDm;
  }
  if (qualityVal && avgDm !== null) {
    qualityVal.textContent = avgDm;
    qualityVal.className = 'cc-pulse__big';
    qualityVal.classList.add(ragClass(avgDm));
    if (qualitySub) qualitySub.textContent = results.length > 0 ? `${results.length} queries this session` : `${atlas.total} queries total`;
  }

  // 3. Needs Attention count
  const attentionVal = document.getElementById('pulse-attention-val');
  const attentionSub = document.getElementById('pulse-attention-sub');
  let attentionCount = 0;
  const issues = [];
  const gapCount = results.length > 0 ? results.filter(r => r.gap_type).length : atlas.gaps;
  if (gapCount > 0) { attentionCount += gapCount; issues.push(`${gapCount} gaps`); }
  if (sentinel.regressions > 0) { attentionCount += sentinel.regressions; issues.push(`${sentinel.regressions} regressions`); }
  if (guardian.issues > 0) { attentionCount += guardian.issues; issues.push(`${guardian.issues} data issues`); }
  if (qaudit.slop > 0) { attentionCount += qaudit.slop; issues.push(`${qaudit.slop} slop`); }

  if (attentionVal) {
    attentionVal.textContent = attentionCount;
    attentionVal.className = 'cc-pulse__big cc-pulse__big--attention';
    attentionVal.style.color = attentionCount === 0 ? 'var(--cc-green)' : attentionCount <= 5 ? 'var(--cc-amber)' : 'var(--cc-red)';
  }
  if (attentionSub) attentionSub.textContent = issues.length > 0 ? issues.join(' \u00b7 ') : 'All clear';
}

function updatePulseFromGauntlet(data) {
  if (!data || !data.summary) return;
  const s = data.summary;
  const passRate = s.total > 0 ? Math.round(s.passed60 / s.total * 100) : 0;
  const avgDm = s.avg_dm || 0;
  const gapCount = s.gap_count || 0;

  const healthVal = document.getElementById('pulse-health-val');
  const healthRing = document.getElementById('pulse-health-ring');
  const healthSub = document.getElementById('pulse-health-sub');
  if (healthVal) {
    healthVal.textContent = passRate + '%';
    healthVal.style.color = passRate >= 80 ? 'var(--cc-green)' : passRate >= 60 ? 'var(--cc-amber)' : 'var(--cc-red)';
    const offset = 213.6 * (1 - passRate / 100);
    if (healthRing) { healthRing.style.strokeDashoffset = offset; healthRing.style.stroke = passRate >= 80 ? 'var(--cc-green)' : passRate >= 60 ? 'var(--cc-amber)' : 'var(--cc-red)'; }
    if (healthSub) healthSub.textContent = `${s.total} queries \u00b7 ${s.passed60} passed`;
  }

  const qualityVal = document.getElementById('pulse-quality-val');
  const qualitySub = document.getElementById('pulse-quality-sub');
  if (qualityVal) { qualityVal.textContent = avgDm; qualityVal.className = 'cc-pulse__big'; qualityVal.classList.add(ragClass(avgDm)); }
  if (qualitySub) qualitySub.textContent = `From ${s.total} test queries`;

  const attentionVal = document.getElementById('pulse-attention-val');
  const attentionSub = document.getElementById('pulse-attention-sub');
  if (attentionVal) {
    attentionVal.textContent = gapCount;
    attentionVal.className = 'cc-pulse__big cc-pulse__big--attention';
    attentionVal.style.color = gapCount === 0 ? 'var(--cc-green)' : gapCount <= 5 ? 'var(--cc-amber)' : 'var(--cc-red)';
  }
  if (attentionSub) attentionSub.textContent = gapCount > 0 ? `${gapCount} gaps found` : 'All clear';
}

// ═══════════════════════════════════════════════════════════════════
// Agents Summary (replaces agent dots — removed from HTML)
// ═══════════════════════════════════════════════════════════════════

function updateAgentDots() { updateAgentsSummary(); } // backward compat

function updateAgentsSummary() {
  const running = [];
  Object.entries(state.agents).forEach(([id, agent]) => {
    if (agent.status === 'running') running.push(AGENT_DEFS[id].name);
  });

  const summary = document.getElementById('agents-summary');
  if (summary) {
    if (running.length > 0) {
      // Show running count + top agent stat
      const atlas = state.agents.atlas;
      const topStat = atlas.total > 0 ? ` · Atlas ${Math.round((atlas.pass / atlas.total) * 100)}% pass` : '';
      summary.textContent = `${running.length} running${topStat}`;
      summary.style.color = 'var(--cc-green)';
    } else if (state.systemState === 'paused') {
      summary.textContent = 'Paused';
      summary.style.color = 'var(--cc-amber)';
    } else {
      const totalXp = Object.values(state.agents).reduce((s, a) => s + a.xp, 0);
      summary.textContent = totalXp > 0 ? `5 agents · ${totalXp.toLocaleString()} XP` : 'Idle';
      summary.style.color = '';
    }
  }

  // Show/hide inline Pause/Stop controls based on system state
  const controls = document.getElementById('agent-controls');
  if (controls) {
    controls.style.display = (state.systemState === 'running' || state.systemState === 'paused') ? '' : 'none';
  }
}

// ═══════════════════════════════════════════════════════════════════
// Agent Table (compact — replaces 5 full cards)
// ═══════════════════════════════════════════════════════════════════

function updateAgentStatusUI(agentId) {
  const agent = state.agents[agentId];
  const el = document.getElementById(`${agentId}-status`);
  if (!el) return;

  el.className = 'cc-agent-table__status';
  switch (agent.status) {
    case 'running': el.classList.add('cc-agent-table__status--running'); el.textContent = 'Running'; break;
    case 'paused': case 'budget_paused':
      el.classList.add('cc-agent-table__status--paused');
      el.textContent = agent.status === 'budget_paused' ? 'Budget' : 'Paused'; break;
    case 'error': el.classList.add('cc-agent-table__status--error'); el.textContent = 'Error'; break;
    default: el.classList.add('cc-agent-table__status--idle'); el.textContent = 'Idle';
  }
}

function updateAgentCardUI(agentId) {
  const a = state.agents[agentId];

  // Level
  const levelEl = document.getElementById(`${agentId}-level`);
  if (levelEl) levelEl.textContent = a.level;

  // HP bar
  const hpFill = document.getElementById(`${agentId}-hp-fill`);
  if (hpFill) {
    hpFill.style.width = `${a.hp}%`;
    hpFill.className = 'cc-agent-table__hp-fill';
    if (a.hp >= 70) hpFill.classList.add('cc-agent-table__hp-fill--high');
    else if (a.hp >= 40) hpFill.classList.add('cc-agent-table__hp-fill--medium');
    else hpFill.classList.add('cc-agent-table__hp-fill--low');
  }

  // XP
  const xpEl = document.getElementById(`${agentId}-xp`);
  if (xpEl) xpEl.textContent = a.xp.toLocaleString();

  // Key stat (one number that tells the story for each agent)
  const keyStatEl = document.getElementById(`${agentId}-key-stat`);
  if (keyStatEl) {
    switch (agentId) {
      case 'atlas':
        if (a.total > 0) {
          const pr = Math.round((a.pass / a.total) * 100);
          keyStatEl.innerHTML = `<span class="${pr >= 80 ? 'rag-green' : pr >= 60 ? 'rag-amber' : 'rag-red'}">${pr}% pass</span> (${a.queries}q)`;
        } else { keyStatEl.textContent = '--'; }
        break;
      case 'qaudit':
        if (a.grade !== '--') {
          const gc = a.grade.startsWith('A') ? 'rag-green' : a.grade.startsWith('B') ? 'rag-amber' : 'rag-red';
          keyStatEl.innerHTML = `Grade <span class="${gc}">${a.grade}</span> (${a.audits} audits)`;
        } else { keyStatEl.textContent = '--'; }
        break;
      case 'sentinel':
        if (a.checks > 0) {
          const rc = a.regressions === 0 ? 'rag-green' : 'rag-red';
          keyStatEl.innerHTML = `<span class="${rc}">${a.regressions} regressions</span> / ${a.checks} checks`;
        } else { keyStatEl.textContent = '--'; }
        break;
      case 'hunter':
        if (a.probes > 0) {
          const cc = a.contract === 'OK' ? 'rag-green' : a.contract === 'FAIL' ? 'rag-red' : '';
          keyStatEl.innerHTML = `Contract: <span class="${cc}">${a.contract || '--'}</span> (${a.probes} probes)`;
        } else { keyStatEl.textContent = '--'; }
        break;
      case 'guardian':
        if (a.records > 0) {
          keyStatEl.innerHTML = `Coverage: ${a.coverage} (${a.issues} issues)`;
        } else { keyStatEl.textContent = '--'; }
        break;
    }
  }
}

// ═══════════════════════════════════════════════════════════════════
// Quick Actions
// ═══════════════════════════════════════════════════════════════════

function quickStart() {
  const section = document.getElementById('section-agents');
  if (section && !section.classList.contains('cc-section--open')) {
    section.classList.add('cc-section--open');
    const body = section.querySelector('.cc-section__body');
    const chevron = section.querySelector('.cc-section__chevron');
    if (body) body.style.display = '';
    if (chevron) chevron.innerHTML = '&#9662;';
  }

  const btn = document.getElementById('action-test');
  if (btn && state.systemState === 'running') { handlePause(); return; }

  handleStart();

  if (btn) {
    btn.classList.add('cc-action--active');
    const textEl = btn.querySelector('.cc-action__text');
    const iconEl = btn.querySelector('.cc-action__icon');
    if (textEl) textEl.textContent = 'Running...';
    if (iconEl) iconEl.innerHTML = '&#9646;&#9646;';
  }
}

function quickCheckData() {
  const section = document.getElementById('section-maintenance');
  if (section && !section.classList.contains('cc-section--open')) {
    section.classList.add('cc-section--open');
    const body = section.querySelector('.cc-section__body');
    const chevron = section.querySelector('.cc-section__chevron');
    if (body) body.style.display = '';
    if (chevron) chevron.innerHTML = '&#9662;';
  }
  if (!maintenanceLoaded) loadMaintenanceSection();
}

// ═══════════════════════════════════════════════════════════════════
// Production Dashboard (lazy-loaded on section expand)
// ═══════════════════════════════════════════════════════════════════

let productionLoaded = false;

async function loadProductionDashboard() {
  if (productionLoaded) return;
  productionLoaded = true;
  const content = document.getElementById('prod-content');
  const kpis = document.getElementById('prod-kpis');

  try {
    const { createClient } = await import('https://esm.sh/@supabase/supabase-js@2');
    const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

    // Only fetch the detail tables — KPIs already populated from loadInitData()
    const [recentQueries, userHistory] = await Promise.all([
      sb.from('user_queries').select('special_request, donde_match, created_at, occasion, user_id, restaurants(name)').order('created_at', { ascending: false }).limit(50),
      sb.from('user_searches').select('craving, restaurant_name, cuisine_type, donde_match, created_at, occasion').order('created_at', { ascending: false }).limit(50),
    ]);

    const recent = recentQueries.data || [];
    const history = userHistory.data || [];

    // Use cached init data for KPI cards (already fetched, no redundant query)
    const d = _initData || {};
    const totalCount = d.todayCount || recent.length;
    const uniqueUserIds = new Set(recent.filter(q => q.user_id).map(q => q.user_id));
    const userCount = uniqueUserIds.size;
    const avgDm = d.avgDm || 0;
    const lowScoreCount = d.lowScoreCount || 0;

    function prodCard(value, label, sub, colorClass) {
      return `<div class="cc-prod-card"><div class="cc-prod-card__value ${colorClass || ''}">${value}</div><div class="cc-prod-card__label">${label}</div>${sub ? `<div class="cc-prod-card__sub">${sub}</div>` : ''}</div>`;
    }

    kpis.innerHTML = [
      prodCard(totalCount, 'Today', new Date().toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }), ''),
      prodCard(userCount, 'Unique Users', '', ''),
      prodCard(avgDm, 'Avg DM', '', ragClass(avgDm)),
      prodCard(lowScoreCount, 'Low Scores (<40)', '', lowScoreCount > 10 ? 'rag-red' : lowScoreCount > 3 ? 'rag-amber' : 'rag-green'),
    ].join('');

    const alerts = [];
    if (avgDm > 0 && avgDm < 60) alerts.push({ text: `Average DM is ${avgDm} — below 60 threshold`, type: 'red' });
    if (lowScoreCount > 10) alerts.push({ text: `${lowScoreCount} queries scored below 40`, type: 'red' });
    if (totalCount === 0) alerts.push({ text: 'No searches today — check API health', type: 'amber' });

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
    h += '<div class="cc-subsection"><div class="cc-subsection__title">Recent API Searches</div>';
    if (recent.length > 0) {
      h += '<div class="cc-table-wrap"><table class="cc-table"><thead><tr><th>Time</th><th>Query</th><th>Occasion</th><th>Restaurant</th><th>DM</th></tr></thead><tbody>';
      for (const q of recent) {
        const time = q.created_at ? new Date(q.created_at).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : '--';
        const dm = q.donde_match;
        const restJoin = q.restaurants;
        const restName = Array.isArray(restJoin) ? (restJoin[0]?.name || '\u2014') : (restJoin?.name || '\u2014');
        h += `<tr><td style="font-family:var(--cc-mono);font-size:0.68rem;color:var(--cc-text-3)">${time}</td><td>${escapeHtml((q.special_request || '').substring(0, 50))}</td><td style="font-size:0.68rem;color:var(--cc-text-3)">${escapeHtml((q.occasion || '\u2014').substring(0, 15))}</td><td>${escapeHtml(restName.substring(0, 25))}</td><td><span class="dm-badge ${dm != null ? ragClass(dm) : ''}">${dm != null ? dm : '\u2014'}</span></td></tr>`;
      }
      h += '</tbody></table></div>';
    } else { h += '<p class="cc-muted">No recent searches.</p>'; }
    h += '</div>';

    h += '<div class="cc-subsection"><div class="cc-subsection__title">User History (Saved)</div>';
    if (history.length > 0) {
      h += '<div class="cc-table-wrap"><table class="cc-table"><thead><tr><th>Date</th><th>Craving</th><th>Restaurant</th><th>DM</th></tr></thead><tbody>';
      for (const s of history) {
        const date = s.created_at ? new Date(s.created_at).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : '--';
        const dm = s.donde_match;
        h += `<tr><td style="font-family:var(--cc-mono);font-size:0.68rem;color:var(--cc-text-3)">${date}</td><td>${escapeHtml((s.craving || '').substring(0, 40))}</td><td>${escapeHtml((s.restaurant_name || '\u2014').substring(0, 25))}</td><td><span class="dm-badge ${dm != null ? ragClass(dm) : ''}">${dm != null ? dm : '\u2014'}</span></td></tr>`;
      }
      h += '</tbody></table></div>';
    } else { h += '<p class="cc-muted">No saved user searches yet.</p>'; }
    h += '</div>';

    content.innerHTML = h;
  } catch (e) {
    content.innerHTML = `<p style="color:var(--cc-red)">Failed to load production data: ${e.message}</p>`;
    productionLoaded = false;
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
  const results = state.sessionResults || [];
  let passRate;
  if (results.length > 0) {
    const passed = results.filter(r => r.donde_match >= 60).length;
    passRate = passed / results.length;
  } else {
    const atlas = state.agents.atlas;
    passRate = atlas.total > 0 ? atlas.pass / atlas.total : 0.5;
  }
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
    <div class="cc-rankings__entry" role="button" tabindex="0" onclick="scrollToAgent('${e.id}')">
      <span class="cc-rankings__rank ${rankClasses[i]}">${i + 1}.</span>
      <span class="cc-rankings__name">${e.name}</span>
      <span class="cc-rankings__score">${e.xp.toLocaleString()}</span>
    </div>
  `).join('');
}

// ═══════════════════════════════════════════════════════════════════
// Hero KPIs (unified update — drives Pulse + dots + focus)
// ═══════════════════════════════════════════════════════════════════

function updateHeroKPIs() {
  updatePulseCards();
  updateAgentDots();
  updateFocusStrip();

  // Update test action button hint
  const hint = document.getElementById('action-test-hint');
  if (hint && state.systemState === 'running') {
    hint.textContent = `${(state.sessionResults || []).length} queries so far`;
  }
}

function updateHeroKPIsFromGauntlet(data) {
  if (!data || !data.summary) return;
  updatePulseFromGauntlet(data);

  // Update results section summary
  const s = data.summary;
  const summaryEl = document.getElementById('results-summary');
  if (summaryEl) {
    const passRate = s.total > 0 ? Math.round(s.passed60 / s.total * 100) : 0;
    summaryEl.innerHTML = `<span class="${passRate >= 80 ? 'rag-green' : passRate >= 60 ? 'rag-amber' : 'rag-red'}">${passRate}% pass</span> &middot; DM ${s.avg_dm} &middot; ${s.gap_count} gaps`;
  }

  // Auto-open Test Results section when data loads
  const section = document.getElementById('section-results');
  if (section && !section.classList.contains('cc-section--open')) {
    section.classList.add('cc-section--open');
    const body = section.querySelector('.cc-section__body');
    const chevron = section.querySelector('.cc-section__chevron');
    if (body) body.style.display = '';
    if (chevron) chevron.innerHTML = '&#9662;';
  }
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
  if (state.agents.sentinel.regressions > 0) alerts.push({ text: `${state.agents.sentinel.regressions} regression(s) detected by Sentinel`, type: 'red' });
  const remaining = DAILY_BUDGET - state.budgetUsed;
  if (remaining <= 10 && remaining > 0) alerts.push({ text: `API budget low: ${remaining} calls remaining`, type: 'amber' });
  else if (remaining <= 0) alerts.push({ text: 'API budget exhausted', type: 'red' });
  if (state.agents.atlas.gaps > 10) alerts.push({ text: `Atlas found ${state.agents.atlas.gaps} gaps`, type: 'amber' });
  if (state.agents.qaudit.grade === 'C' || state.agents.qaudit.grade === 'F') alerts.push({ text: `Blurb quality grade: ${state.agents.qaudit.grade}`, type: 'red' });

  const strip = document.getElementById('focus-strip');
  const alertsEl = document.getElementById('focus-alerts');
  if (alerts.length === 0) { strip.style.display = 'none'; return; }
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

  // Also append to per-agent inline log (max 5 per agent)
  const agentLogEl = document.getElementById(`${entry.agentId}-logs`);
  if (agentLogEl && entry.agentId !== 'system') {
    // Clear placeholder text
    const placeholder = agentLogEl.querySelector('.cc-muted');
    if (placeholder) placeholder.remove();

    const iconMap = { pass: '&#10003;', warn: '&#9888;', fail: '&#10007;', star: '&#9733;' };
    const div = document.createElement('div');
    div.className = 'cc-log__entry';
    div.innerHTML = `<span class="cc-log__time">${entry.time}</span><span class="cc-log__message">${escapeHtml(entry.message)}</span><span class="cc-log__icon cc-log__icon--${entry.severity}">${iconMap[entry.severity] || '&#9679;'}</span>`;
    agentLogEl.appendChild(div);
    agentLogEl.scrollTop = agentLogEl.scrollHeight;
    // Keep max 5 entries per agent
    while (agentLogEl.children.length > 5) agentLogEl.removeChild(agentLogEl.firstChild);
  }
}

function renderLogEntry(entry) {
  if (state.logFilter !== 'all' && entry.agentId !== state.logFilter && entry.agentId !== 'system') return;
  const logEl = document.getElementById('battle-log');
  if (!logEl) return;
  const iconMap = { pass: '&#10003;', warn: '&#9888;', fail: '&#10007;', star: '&#9733;' };
  const div = document.createElement('div');
  div.className = 'cc-log__entry';
  div.setAttribute('data-agent', entry.agentId);
  div.innerHTML = `
    <span class="cc-log__time">${entry.time}</span>
    <span class="cc-log__agent cc-log__agent--${entry.agentId}">${entry.agent}</span>
    <span class="cc-log__message">${escapeHtml(entry.message)}</span>
    <span class="cc-log__icon cc-log__icon--${entry.severity}">${iconMap[entry.severity] || '&#9679;'}</span>
  `;
  logEl.appendChild(div);
  logEl.scrollTop = logEl.scrollHeight;
  while (logEl.children.length > MAX_LOG_ENTRIES) logEl.removeChild(logEl.firstChild);
}

function filterLog(filter) {
  state.logFilter = filter;
  document.querySelectorAll('.cc-log__filter').forEach(btn => btn.classList.toggle('cc-log__filter--active', btn.dataset.filter === filter));
  const logEl = document.getElementById('battle-log');
  if (logEl) { logEl.innerHTML = ''; state.logs.forEach(entry => renderLogEntry(entry)); }
}

// ═══════════════════════════════════════════════════════════════════
// Notifications
// ═══════════════════════════════════════════════════════════════════

function addNotification(type, message, agentId) {
  state.notifications.push({ id: Date.now(), type, message, agentId, timestamp: new Date().toISOString(), acknowledged: false });
  renderNotifications();
}

function renderNotifications() {
  const pending = state.notifications.filter(n => !n.acknowledged);
  const bar = document.getElementById('notification-bar');
  const badge = document.getElementById('notif-badge');
  const list = document.getElementById('notification-list');
  badge.textContent = pending.length;
  if (pending.length === 0) { bar.style.display = 'none'; return; }
  bar.style.display = '';
  list.innerHTML = pending.map(n => `
    <div class="notification-item ${n.type === 'api_error' || n.type === 'critical' ? 'notification-item--critical' : ''}">
      <span class="notification-item__text">${escapeHtml(n.message)}</span>
      <div class="notification-item__actions">
        ${n.type === 'budget_request' ? `
          <button class="notification-btn notification-btn--approve" onclick="handleNotifAction(${n.id}, 'approve')">Approve</button>
          <button class="notification-btn notification-btn--deny" onclick="handleNotifAction(${n.id}, 'deny')">Deny</button>
          <button class="notification-btn notification-btn--defer" onclick="handleNotifAction(${n.id}, 'defer')">Later</button>
        ` : `<button class="notification-btn notification-btn--approve" onclick="handleNotifAction(${n.id}, 'ack')">Dismiss</button>`}
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
    case 'deny': notif.acknowledged = true; addLog('SYSTEM', `CEO denied request.`, 'warn'); break;
    case 'defer':
      notif.acknowledged = true;
      setTimeout(() => { notif.acknowledged = false; renderNotifications(); }, 60000);
      addLog('SYSTEM', 'Request deferred.', 'warn'); break;
    case 'ack': notif.acknowledged = true; break;
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

  if (durationEl && sessionStartTime) {
    const elapsed = Math.floor((new Date() - sessionStartTime) / 1000);
    durationEl.textContent = `Duration: ${Math.floor(elapsed / 60)}m ${elapsed % 60}s`;
  }

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

  // Reset Run Tests button
  const testBtn = document.getElementById('action-test');
  if (testBtn) {
    testBtn.classList.remove('cc-action--active');
    const textEl = testBtn.querySelector('.cc-action__text');
    const iconEl = testBtn.querySelector('.cc-action__icon');
    if (textEl) textEl.textContent = 'Run Tests';
    if (iconEl) iconEl.innerHTML = '&#9654;';
  }
}

function dismissGameOver() {
  document.getElementById('game-over').classList.remove('cc-overlay--visible');
}

// ═══════════════════════════════════════════════════════════════════
// Polling
// ═══════════════════════════════════════════════════════════════════

function pollAgentStatus() {
  updateBudgetUI();
  Object.keys(state.agents).forEach(id => { updateAgentCardUI(id); updateAgentStatusUI(id); });
  updateHeroKPIs();
}

// ═══════════════════════════════════════════════════════════════════
// Section Toggles
// ═══════════════════════════════════════════════════════════════════

function initSectionToggles() {
  document.querySelectorAll('.cc-section__header[data-toggle]').forEach(header => {
    header.addEventListener('click', (e) => {
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

        // Lazy loading
        const toggle = header.dataset.toggle;
        if (toggle === 'maintenance' && !maintenanceLoaded) loadMaintenanceSection();
      }
    });
  });
}

// ═══════════════════════════════════════════════════════════════════
// Start Dropdown (Test Count + Filters)
// ═══════════════════════════════════════════════════════════════════

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
  document.querySelectorAll('.cc-filter-preset').forEach(btn => btn.classList.toggle('cc-filter-preset--active', btn.dataset.preset === activePreset));
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
  const apiCalls = (agentFilter.atlas ? queries : 0) + (agentFilter.sentinel ? Math.min(15, Math.ceil(queries * 0.5)) : 0) + (agentFilter.hunter ? Math.min(10, Math.ceil(queries * 0.3)) : 0) + (agentFilter.guardian ? Math.min(5, Math.ceil(queries * 0.2)) : 0);
  const est = (apiCalls * 0.01).toFixed(2);
  el.textContent = `${count} agent${count !== 1 ? 's' : ''} \u00b7 ${agentFilter.atlas ? queries + ' queries \u00b7 ' : ''}~$${est}`;
}

function toggleStartDropdown(e) {
  e.stopPropagation();
  document.getElementById('start-dropdown').classList.toggle('cc-start-dropdown--open');
}

function initStartDropdown() {
  const slider = document.getElementById('test-count-slider');
  const valEl = document.getElementById('test-count-val');
  const costEl = document.getElementById('test-cost-estimate');

  if (slider) {
    slider.addEventListener('input', () => {
      const count = parseInt(slider.value);
      if (valEl) valEl.textContent = count;
      if (costEl) costEl.textContent = `Est. ~$${(count * 1.3 * 0.01).toFixed(2)} API usage`;
      updateFilterSummary();
    });
  }

  document.querySelectorAll('.cc-filter-chip').forEach(chip => {
    chip.addEventListener('click', (e) => {
      e.preventDefault();
      const agentId = chip.dataset.agent;
      agentFilter[agentId] = !agentFilter[agentId];
      if (Object.values(agentFilter).every(v => !v)) agentFilter[agentId] = true;
      syncFilterUI();
      updateActivePresetUI(detectActivePreset());
      updateFilterSummary();
    });
  });

  updateFilterSummary();

  document.addEventListener('click', (e) => {
    const dd = document.getElementById('start-dropdown');
    if (dd && !e.target.closest('.cc-start-group')) dd.classList.remove('cc-start-dropdown--open');
  });
}

// ═══════════════════════════════════════════════════════════════════
// Scroll-to-Section (opens section, scrolls, highlights)
// ═══════════════════════════════════════════════════════════════════

function scrollToSection(sectionKey) {
  const section = document.getElementById(`section-${sectionKey}`);
  if (!section) return;
  // Open the section if closed
  if (!section.classList.contains('cc-section--open')) {
    section.classList.add('cc-section--open');
    const body = section.querySelector('.cc-section__body');
    const chevron = section.querySelector('.cc-section__chevron');
    if (body) body.style.display = '';
    if (chevron) chevron.innerHTML = '&#9662;';
    // Lazy-load if needed
    const toggle = section.querySelector('.cc-section__header')?.dataset?.toggle;
    if (toggle === 'maintenance' && !maintenanceLoaded) loadMaintenanceSection();
  }
  // Scroll and highlight
  section.scrollIntoView({ behavior: 'smooth', block: 'start' });
  section.classList.add('cc-section--highlight');
  setTimeout(() => section.classList.remove('cc-section--highlight'), 1000);
}

// ═══════════════════════════════════════════════════════════════════
// Scroll-to-Agent (from leaderboard click)
// ═══════════════════════════════════════════════════════════════════

function scrollToAgent(agentId) {
  // First open the Agents section
  scrollToSection('agents');
  // Then expand the agent's detail row and highlight
  setTimeout(() => {
    const row = document.querySelector(`tr[data-agent="${agentId}"]`);
    if (row) {
      row.scrollIntoView({ behavior: 'smooth', block: 'center' });
      row.classList.add('cc-agent-row--highlight');
      setTimeout(() => row.classList.remove('cc-agent-row--highlight'), 1500);
    }
    // Open detail row
    const detail = document.getElementById(`${agentId}-detail`);
    if (detail) detail.style.display = '';
  }, 300);
}

// ═══════════════════════════════════════════════════════════════════
// Toggle Agent Detail (inline expandable rows)
// ═══════════════════════════════════════════════════════════════════

function toggleAgentDetail(agentId) {
  const detail = document.getElementById(`${agentId}-detail`);
  if (!detail) return;
  detail.style.display = detail.style.display === 'none' ? '' : 'none';
}

// ═══════════════════════════════════════════════════════════════════
// Toggle Full Activity Log
// ═══════════════════════════════════════════════════════════════════

function toggleFullLog() {
  const el = document.getElementById('full-log');
  if (!el) return;
  el.style.display = el.style.display === 'none' ? '' : 'none';
}

// ═══════════════════════════════════════════════════════════════════
// Production Panel Expand/Collapse
// ═══════════════════════════════════════════════════════════════════

function expandProduction() {
  const panel = document.getElementById('prod-detail');
  if (!panel) return;
  panel.style.display = '';
  // Lazy-load full detail on first open
  if (!productionLoaded) loadProductionDashboard();
}

function collapseProduction() {
  const panel = document.getElementById('prod-detail');
  if (panel) panel.style.display = 'none';
}

// ═══════════════════════════════════════════════════════════════════
// Smart Suggestion
// ═══════════════════════════════════════════════════════════════════

let _suggestionAction = null;

function computeSuggestion() {
  const strip = document.getElementById('suggest-strip');
  const textEl = document.getElementById('suggest-text');
  const btnEl = document.getElementById('suggest-btn');
  if (!strip || !textEl || !btnEl) return;

  const d = _initData;
  if (!d) { strip.style.display = 'none'; return; }

  // Priority 1: Stale test runs
  if (d.latestRun) {
    const daysSince = Math.floor((Date.now() - new Date(d.latestRun.created_at).getTime()) / (1000 * 60 * 60 * 24));
    if (daysSince >= 2) {
      textEl.textContent = `Last test was ${daysSince} day${daysSince > 1 ? 's' : ''} ago`;
      btnEl.textContent = 'Run Quick Scan';
      _suggestionAction = () => { applyFilterPreset('quick'); quickStart(); };
      strip.style.display = '';
      return;
    }
  } else {
    textEl.textContent = 'No test runs yet — start your first scan';
    btnEl.textContent = 'Run Tests';
    _suggestionAction = () => quickStart();
    strip.style.display = '';
    return;
  }

  // Priority 2: Low enrichment
  if (d.enrichedPct < 85) {
    textEl.textContent = `Enrichment at ${d.enrichedPct}% — below 85% target`;
    btnEl.textContent = 'Check Data';
    _suggestionAction = () => quickCheckData();
    strip.style.display = '';
    return;
  }

  // Priority 3: Many gaps
  if (d.latestRun && d.latestRun.gap_count > 5) {
    textEl.textContent = `${d.latestRun.gap_count} gaps remain from last run`;
    btnEl.textContent = 'View Gaps';
    _suggestionAction = () => scrollToSection('results');
    strip.style.display = '';
    return;
  }

  // No issues — hide
  strip.style.display = 'none';
}

function executeSuggestion() {
  if (_suggestionAction) _suggestionAction();
  dismissSuggestion();
}

function dismissSuggestion() {
  const strip = document.getElementById('suggest-strip');
  if (strip) strip.style.display = 'none';
}

// ═══════════════════════════════════════════════════════════════════
// Keyboard Shortcuts
// ═══════════════════════════════════════════════════════════════════

function initKeyboardShortcuts() {
  document.addEventListener('keydown', (e) => {
    // Skip when typing in inputs
    if (e.target.matches('input, select, textarea')) return;
    if (e.ctrlKey || e.metaKey || e.altKey) return;

    switch (e.key) {
      case 't':
        e.preventDefault();
        if (state.systemState === 'running') handleStop();
        else quickStart();
        break;
      case 'r':
        e.preventDefault();
        openRerunPicker();
        break;
      case 'd':
        e.preventDefault();
        quickCheckData();
        break;
      case '1':
        e.preventDefault();
        scrollToSection('results');
        break;
      case '2':
        e.preventDefault();
        scrollToSection('agents');
        break;
      case '3':
        e.preventDefault();
        scrollToSection('maintenance');
        break;
      case 'Escape':
        e.preventDefault();
        // Close any open modal/panel/dropdown
        collapseProduction();
        closeRerunPicker();
        closeShortcuts();
        document.getElementById('start-dropdown')?.classList.remove('cc-start-dropdown--open');
        // Collapse all agent detail rows
        document.querySelectorAll('.cc-agent-detail').forEach(d => d.style.display = 'none');
        break;
      case '?':
        e.preventDefault();
        showShortcuts();
        break;
    }
  });
}

function showShortcuts() {
  const overlay = document.getElementById('shortcuts-overlay');
  if (overlay) overlay.style.display = '';
}

function closeShortcuts(e) {
  if (e && e.target !== e.currentTarget) return;
  const overlay = document.getElementById('shortcuts-overlay');
  if (overlay) overlay.style.display = 'none';
}

// ═══════════════════════════════════════════════════════════════════
// Init
// ═══════════════════════════════════════════════════════════════════

loadState();
updateClock();
updateBudgetUI();
updateBossBar();
updateLeaderboard();
updatePulseCards();
updateAgentDots();
updateHeroKPIs();

// Render persisted logs
state.logs.forEach(entry => renderLogEntry(entry));

// Update all agent rows with persisted data
Object.keys(state.agents).forEach(id => { updateAgentCardUI(id); updateAgentStatusUI(id); });

// Start clock
state.clockTimer = setInterval(updateClock, 1000);

// Section toggles
initSectionToggles();

// Start dropdown
initStartDropdown();

// Keyboard shortcuts
initKeyboardShortcuts();

// Auth & analytics (also loads init data)
checkAuth();

// Auto-open section from URL hash (e.g. #maintenance)
if (window.location.hash) {
  const sectionId = window.location.hash.replace('#', '');
  const section = document.getElementById(`section-${sectionId}`);
  if (section && !section.classList.contains('cc-section--open')) {
    section.classList.add('cc-section--open');
    const body = section.querySelector('.cc-section__body');
    const chevron = section.querySelector('.cc-section__chevron');
    if (body) body.style.display = '';
    if (chevron) chevron.innerHTML = '&#9662;';
    if (sectionId === 'maintenance' && !maintenanceLoaded) setTimeout(() => { if (!maintenanceLoaded) loadMaintenanceSection(); }, 1500);
    setTimeout(() => section.scrollIntoView({ behavior: 'smooth', block: 'start' }), 300);
  }
}
