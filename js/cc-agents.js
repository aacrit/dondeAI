/**
 * DondeAI Command Center — Agent Engine
 * API calls, 5 agent cycles, XP, controls
 */

// ═══════════════════════════════════════════════════════════════════
// API Call Helper
// ═══════════════════════════════════════════════════════════════════

async function callAPI(specialRequest, params = {}) {
  if (state.budgetUsed >= DAILY_BUDGET) {
    return { error: 'BUDGET_EXCEEDED', success: false };
  }
  const body = {
    special_request: specialRequest,
    occasion: params.occasion || 'Any',
    neighborhood: params.neighborhood || 'Anywhere',
    price_level: params.price_level || 'Any',
    exclude: params.exclude || [],
    dietary_restrictions: params.dietary_restrictions || [],
  };
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);
    const resp = await fetch(API_BASE, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    clearTimeout(timeout);
    state.budgetUsed++;
    saveState();
    updateBudgetUI();
    const data = await resp.json();
    return { ...data, httpCode: resp.status };
  } catch (err) {
    return { error: err.message, success: false, httpCode: 0 };
  }
}

// ═══════════════════════════════════════════════════════════════════
// Controls
// ═══════════════════════════════════════════════════════════════════

function handleStart() {
  if (state.systemState === 'running') return;
  state.systemState = 'running';
  state.startTime = state.startTime || new Date();
  state.sessionResults = []; // Fresh session

  // Read test count from slider
  const slider = document.getElementById('test-count-slider');
  state.maxTestQueries = slider ? parseInt(slider.value) : 10;

  // Close dropdown if open
  const dd = document.getElementById('start-dropdown');
  if (dd) dd.classList.remove('cc-start-dropdown--open');

  document.getElementById('btn-start').classList.add('active');
  document.getElementById('btn-start').disabled = true;
  document.getElementById('btn-pause').disabled = false;
  document.getElementById('btn-stop').disabled = false;

  updateSystemStatus('Online', 'green');
  document.getElementById('paused-overlay').classList.remove('cc-paused--visible');

  addLog('SYSTEM', `All agents deployed (${state.maxTestQueries} test queries). Monitoring active.`, 'star');
  startAgentCycles();

  if (state.pollTimer) clearInterval(state.pollTimer);
  state.pollTimer = setInterval(pollAgentStatus, POLL_INTERVAL_RUNNING);
  if (!state.clockTimer) state.clockTimer = setInterval(updateClock, 1000);
}

function handlePause() {
  if (state.systemState !== 'running') return;
  state.systemState = 'paused';

  document.getElementById('btn-start').classList.remove('active');
  document.getElementById('btn-start').disabled = false;
  document.getElementById('btn-pause').disabled = true;

  updateSystemStatus('Paused', 'amber');
  document.getElementById('paused-overlay').classList.add('cc-paused--visible');

  stopAgentCycles();
  if (state.pollTimer) clearInterval(state.pollTimer);
  state.pollTimer = setInterval(pollAgentStatus, POLL_INTERVAL_PAUSED);

  addLog('SYSTEM', 'All agents paused.', 'warn');
  Object.keys(state.agents).forEach(id => {
    if (state.agents[id].status === 'running') {
      state.agents[id].status = 'paused';
      updateAgentStatusUI(id);
    }
  });
}

async function handleStop() {
  const sessionStartTime = state.startTime;
  state.systemState = 'idle';
  state.startTime = null;

  document.getElementById('btn-start').classList.remove('active');
  document.getElementById('btn-start').disabled = false;
  document.getElementById('btn-pause').disabled = true;
  document.getElementById('btn-stop').disabled = true;

  updateSystemStatus('Stopped', 'red');
  document.getElementById('paused-overlay').classList.remove('cc-paused--visible');

  stopAgentCycles();
  if (state.pollTimer) { clearInterval(state.pollTimer); state.pollTimer = null; }

  // Show game-over with save status
  showGameOver(sessionStartTime);
  addLog('SYSTEM', 'Session ended. All agents stopped.', 'fail');

  Object.keys(state.agents).forEach(id => {
    state.agents[id].status = 'idle';
    updateAgentStatusUI(id);
  });
  saveState();

  // Persist session results to Supabase
  if (state.sessionResults.length > 0) {
    addLog('SYSTEM', `Saving ${state.sessionResults.length} results to Supabase...`, 'star');
    const saveStatusEl = document.getElementById('game-over-save-status');
    if (saveStatusEl) saveStatusEl.textContent = 'Saving to Supabase...';

    try {
      await persistSessionToSupabase(state.sessionResults, sessionStartTime);
      state.sessionResults = [];
      if (saveStatusEl) saveStatusEl.innerHTML = '<span style="color:var(--cc-green)">Run saved to Supabase</span>';
      addLog('SYSTEM', 'Session results saved to Supabase.', 'star');
      // Refresh dropdown to include new run
      await loadRunSelector();
      // Auto-select the new run (first in list = latest)
      const sel = document.getElementById('run-selector');
      if (sel && sel.options.length > 0) {
        sel.value = sel.options[0].value;
        if (sel.value) await loadRunFromSupabase(sel.value);
      }
    } catch (e) {
      if (saveStatusEl) saveStatusEl.innerHTML = `<span style="color:var(--cc-red)">Save failed: ${escapeHtml(e.message)}</span>`;
      addLog('SYSTEM', `Failed to save session: ${e.message}`, 'fail');
    }
  }
}

// ═══════════════════════════════════════════════════════════════════
// Agent Cycle Engine
// ═══════════════════════════════════════════════════════════════════

function startAgentCycles() {
  state.cycleTimers.atlas = setInterval(() => runAtlasCycle(), 30000);
  runAtlasCycle();
  state.cycleTimers.qaudit = setInterval(() => runQauditCycle(), 45000);
  setTimeout(() => runQauditCycle(), 5000);
  state.cycleTimers.sentinel = setInterval(() => runSentinelCycle(), 60000);
  setTimeout(() => runSentinelCycle(), 10000);
  state.cycleTimers.hunter = setInterval(() => runHunterCycle(), 40000);
  setTimeout(() => runHunterCycle(), 15000);
  state.cycleTimers.guardian = setInterval(() => runGuardianCycle(), 90000);
  setTimeout(() => runGuardianCycle(), 20000);
}

function stopAgentCycles() {
  Object.keys(state.cycleTimers).forEach(key => {
    clearInterval(state.cycleTimers[key]);
    delete state.cycleTimers[key];
  });
}

// ─── ATLAS ───
async function runAtlasCycle() {
  if (state.systemState !== 'running') return;
  const agent = state.agents.atlas;
  if (agent.apiUsed >= AGENT_DEFS.atlas.budget) {
    if (agent.status !== 'budget_paused') {
      agent.status = 'budget_paused';
      addLog('atlas', 'Budget limit reached (20/20). Requesting additional calls.', 'warn');
      addNotification('budget_request', 'Atlas requests 10 additional API calls for broader coverage.', 'atlas');
    }
    return;
  }
  agent.status = 'running';
  updateAgentStatusUI('atlas');

  const query = ATLAS_QUERIES[Math.floor(Math.random() * ATLAS_QUERIES.length)];
  addLog('atlas', `Testing: "${query}"`, 'pass');

  const result = await callAPI(query);
  agent.apiUsed++;
  agent.queries++;

  if (result.success && result.donde_match !== undefined) {
    const dm = result.donde_match;
    agent.total++;
    if (dm >= 60) {
      agent.pass++;
      awardXP('atlas', dm >= 80 ? 25 : 10);
      addLog('atlas', `PASS: "${query}" -> DM ${dm} (${result.restaurant?.name || 'unknown'})`, 'pass');
    } else {
      agent.gaps++;
      if (dm < 40) {
        addLog('atlas', `CRITICAL: "${query}" -> DM ${dm}`, 'fail');
        addNotification('critical', `Atlas detected critical gap: "${query}" scored DM ${dm}`, 'atlas');
      } else {
        addLog('atlas', `WEAK: "${query}" -> DM ${dm}`, 'warn');
      }
    }
    agent.avgDm = agent.total > 0 ? Math.round(((agent.avgDm * (agent.total - 1)) + dm) / agent.total) : dm;
    agent.hp = agent.total > 0 ? Math.round((agent.pass / agent.total) * 100) : 100;

    // Capture per-query result for session persistence
    const sv9 = result.scoring_v9 || {};
    state.sessionResults.push({
      query: query,
      donde_match: dm,
      category: sv9.relevance_type || 'unknown',
      gap_type: determineGapType(result, dm),
      gap_severity: dm < 40 ? 'P0' : dm < 60 ? 'P1' : null,
      restaurant_name: result.restaurant?.name || null,
      tier: result.restaurant?.tier || null,
      relevance_type: sv9.relevance_type || null,
      food: Number(sv9.food || 0),
      vibe: Number(sv9.vibe || 0),
      service: Number(sv9.service || 0),
      reputation: Number(sv9.reputation || 0),
      convenience: Number(sv9.convenience || 0),
    });
  } else {
    agent.gaps++;
    addLog('atlas', `API ERROR: "${query}" -> ${result.error || 'HTTP ' + result.httpCode}`, 'fail');
    addNotification('api_error', `API Error on query: "${query}"`, 'atlas');
  }

  updateAgentCardUI('atlas');
  updateBossBar();
  updateLeaderboard();
  updateHeroKPIs();
  saveState();

  // Auto-stop when configured query limit reached
  if (agent.queries >= state.maxTestQueries) {
    addLog('atlas', `Reached ${state.maxTestQueries} query target. Auto-stopping session.`, 'star');
    handleStop();
  }
}

// ─── QAUDIT ───
function runQauditCycle() {
  if (state.systemState !== 'running') return;
  const agent = state.agents.qaudit;
  agent.status = 'running';
  updateAgentStatusUI('qaudit');

  const sampleBlurbs = [
    'We love this spot for its handmade pasta and warm neighborhood feel. The rigatoni is a standout.',
    'This place nails the vibe for a low-key date night. We always grab the smoked brisket here.',
    'A culinary journey through authentic flavors that will tantalize your taste buds.',
    'We think this is a solid pick when you want classic Chicago comfort food without the wait.',
    'Hidden gem nestled in the heart of Wicker Park with artisanal crafted dishes.',
  ];

  let slopCount = 0, cleanCount = 0;
  sampleBlurbs.forEach((blurb, i) => {
    const foundSlop = BANNED_PATTERNS.filter(p => blurb.toLowerCase().includes(p.toLowerCase()));
    if (foundSlop.length > 0) {
      slopCount++;
      addLog('qaudit', `SLOP detected in blurb #${agent.audits + i + 1}: "${foundSlop.join('", "')}"`, 'fail');
    } else {
      cleanCount++;
    }
  });

  agent.audits += sampleBlurbs.length;
  agent.slop += slopCount;
  agent.clean += cleanCount;

  const slopRate = agent.audits > 0 ? agent.slop / agent.audits : 0;
  if (slopRate === 0) agent.grade = 'A';
  else if (slopRate < 0.05) agent.grade = 'A-';
  else if (slopRate < 0.1) agent.grade = 'B+';
  else if (slopRate < 0.2) agent.grade = 'B';
  else if (slopRate < 0.3) agent.grade = 'C';
  else agent.grade = 'F';

  agent.hp = Math.max(0, 100 - Math.round(slopRate * 200));
  awardXP('qaudit', slopCount === 0 ? 20 : 5);
  addLog('qaudit', `Audit cycle: ${cleanCount} clean, ${slopCount} slop. Grade: ${agent.grade}`, slopCount > 0 ? 'warn' : 'pass');

  agent.status = 'idle';
  updateAgentCardUI('qaudit');
  updateAgentStatusUI('qaudit');
  updateLeaderboard();
  updateHeroKPIs();
  saveState();
}

// ─── SENTINEL ───
async function runSentinelCycle() {
  if (state.systemState !== 'running') return;
  const agent = state.agents.sentinel;
  if (agent.apiUsed >= AGENT_DEFS.sentinel.budget) {
    if (agent.status !== 'budget_paused') {
      agent.status = 'budget_paused';
      addLog('sentinel', 'Budget limit reached (15/15).', 'warn');
    }
    return;
  }
  agent.status = 'running';
  updateAgentStatusUI('sentinel');

  const gq = GOLDEN_QUERIES[Math.floor(Math.random() * GOLDEN_QUERIES.length)];
  addLog('sentinel', `Baseline check: [${gq.id}] "${gq.query}"`, 'pass');

  const result = await callAPI(gq.query);
  agent.apiUsed++;
  agent.checks++;

  if (result.success && result.donde_match !== undefined) {
    const dm = result.donde_match;
    const passed = dm >= gq.minScore;
    if (passed) {
      awardXP('sentinel', 10);
      addLog('sentinel', `[${gq.id}] PASS: DM ${dm} >= ${gq.minScore}`, 'pass');
    } else {
      agent.regressions++;
      awardXP('sentinel', 50);
      addLog('sentinel', `[${gq.id}] REGRESSION: DM ${dm} < ${gq.minScore}`, 'fail');
      addNotification('regression', `Regression on ${gq.id}: "${gq.query}" scored ${dm}, expected >= ${gq.minScore}`, 'sentinel');
    }
    agent.baseline = `DM ${dm}`;
    agent.delta = passed ? 'OK' : `-${gq.minScore - dm}`;
    agent.hp = agent.checks > 0 ? Math.round(((agent.checks - agent.regressions) / agent.checks) * 100) : 100;
  } else {
    addLog('sentinel', `[${gq.id}] API Error`, 'fail');
  }

  updateAgentCardUI('sentinel');
  updateBossBar();
  updateLeaderboard();
  updateHeroKPIs();
  saveState();
}

// ─── HUNTER ───
async function runHunterCycle() {
  if (state.systemState !== 'running') return;
  const agent = state.agents.hunter;
  if (agent.apiUsed >= AGENT_DEFS.hunter.budget) {
    if (agent.status !== 'budget_paused') {
      agent.status = 'budget_paused';
      addLog('hunter', 'Budget limit reached (10/10).', 'warn');
    }
    return;
  }
  agent.status = 'running';
  updateAgentStatusUI('hunter');

  const probe = EDGE_PROBES[Math.floor(Math.random() * EDGE_PROBES.length)];
  addLog('hunter', `Probe: [${probe.id}] ${probe.name}`, 'pass');

  const result = await callAPI(probe.input, probe.params || {});
  agent.apiUsed++;
  agent.probes++;

  let contractOk = true;
  const issues = [];
  if (result.httpCode === 0) {
    issues.push('timeout/network error');
    contractOk = false;
  } else if (result.success) {
    if (typeof result.donde_match !== 'number') issues.push('donde_match not number');
    if (!result.restaurant?.name) issues.push('missing restaurant name');
    if (!result.timestamp) issues.push('missing timestamp');
    if (!Array.isArray(result.tags)) issues.push('tags not array');
    if (issues.length > 0) contractOk = false;
  }

  if (contractOk || !result.success) {
    awardXP('hunter', 30);
    addLog('hunter', `[${probe.id}] ${probe.name}: SAFE`, 'pass');
    agent.contract = 'OK';
  } else {
    agent.vulns++;
    agent.errors++;
    addLog('hunter', `[${probe.id}] ${probe.name}: ISSUE — ${issues.join(', ')}`, 'fail');
    agent.contract = 'FAIL';
  }

  agent.hp = agent.probes > 0 ? Math.round(((agent.probes - agent.vulns) / agent.probes) * 100) : 100;
  updateAgentCardUI('hunter');
  updateLeaderboard();
  updateHeroKPIs();
  saveState();
}

// ─── GUARDIAN ───
async function runGuardianCycle() {
  if (state.systemState !== 'running') return;
  const agent = state.agents.guardian;
  agent.status = 'running';
  updateAgentStatusUI('guardian');

  if (agent.apiUsed < AGENT_DEFS.guardian.budget) {
    const result = await callAPI('dinner');
    agent.apiUsed++;
    if (result.success && result.restaurant) {
      agent.records++;
      const r = result.restaurant;
      let localIssues = 0;
      if (!r.name) localIssues++;
      if (!r.address) localIssues++;
      if (!r.cuisine_type) localIssues++;
      if (!r.google_rating) localIssues++;
      if (!r.noise_level) localIssues++;

      const fields = ['name', 'address', 'cuisine_type', 'google_rating', 'noise_level',
        'price_level', 'phone', 'neighborhood_name', 'lighting_ambiance'];
      const filled = fields.filter(f => r[f] != null).length;
      agent.coverage = Math.round((filled / fields.length) * 100) + '%';

      if (localIssues > 0) {
        agent.issues += localIssues;
        addLog('guardian', `Data gaps in "${r.name}": ${localIssues} missing fields`, 'warn');
      } else {
        awardXP('guardian', 10);
        addLog('guardian', `"${r.name}" data OK — ${agent.coverage} coverage`, 'pass');
      }
    }
  }

  agent.orphans = 0;
  agent.hp = agent.records > 0 ? Math.max(0, 100 - (agent.issues * 5)) : 100;
  addLog('guardian', `Integrity scan: ${agent.records} restaurants checked, ${agent.issues} issues`, agent.issues > 0 ? 'warn' : 'pass');

  agent.status = 'idle';
  updateAgentCardUI('guardian');
  updateAgentStatusUI('guardian');
  updateLeaderboard();
  updateHeroKPIs();
  saveState();
}

// ═══════════════════════════════════════════════════════════════════
// XP
// ═══════════════════════════════════════════════════════════════════

function awardXP(agentId, amount) {
  const agent = state.agents[agentId];
  const oldLevel = agent.level;
  agent.xp += amount;
  agent.level = Math.floor(agent.xp / XP_PER_LEVEL) + 1;
  if (agent.level > oldLevel) {
    addLog(agentId, `Reached Level ${agent.level}`, 'star');
    const levelEl = document.getElementById(`${agentId}-level`);
    if (levelEl) {
      levelEl.classList.add('level-up');
      setTimeout(() => levelEl.classList.remove('level-up'), 600);
    }
  }
}
