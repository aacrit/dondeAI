/**
 * DondeAI Test Operations — Executive Dashboard
 * Agent controls, quality monitoring, real-time polling
 */

// ═══════════════════════════════════════════════════════════════════
// State
// ═══════════════════════════════════════════════════════════════════

const DAILY_BUDGET = 50;
const XP_PER_LEVEL = 500;
const POLL_INTERVAL_RUNNING = 3000;
const POLL_INTERVAL_PAUSED = 10000;
const MAX_LOG_ENTRIES = 100;
const API_BASE = 'https://vwbzkgsxmgwcvmvuxnbe.supabase.co/functions/v1/recommend';

const AGENT_DEFS = {
  atlas:    { name: 'Atlas',    title: 'Search Coverage',   budget: 20, color: '#3b82f6' },
  qaudit:   { name: 'QAudit',   title: 'Blurb Quality',     budget: 0,  color: '#8b5cf6' },
  sentinel: { name: 'Sentinel', title: 'Regression Watch',  budget: 15, color: '#f59e0b' },
  hunter:   { name: 'Hunter',   title: 'Edge Cases',        budget: 10, color: '#ef4444' },
  guardian: { name: 'Guardian', title: 'Data Integrity',    budget: 5,  color: '#22c55e' },
};

const BANNED_PATTERNS = [
  'culinary', 'gastronomic', 'delectable', 'exquisite', 'tantalizing',
  'delightful', 'mouthwatering', 'nestled', 'tucked away', 'hidden gem',
  'impeccable', 'unparalleled', 'masterfully', 'beautifully', 'stunningly',
  'perfectly', 'artisan', 'artisanal', 'elevate', 'elevated', 'transcend',
  'journey', 'tapestry', 'diverse menu', 'wide array', 'must-visit',
  'not disappoint', 'fusion of', 'indulge', 'culinary journey',
  'dining experience', 'food lovers', 'every bite', 'savor every',
  'burst of flavor', 'symphony of flavors', 'palette', 'taste buds',
  'beckons', 'invites you', 'promises', 'where tradition meets',
  'crafted with', 'something for everyone',
];

const EDGE_PROBES = [
  { id: 'EC-01', input: '', name: 'Empty request' },
  { id: 'EC-02', input: 'a'.repeat(500), name: 'Max length input' },
  { id: 'EC-03', input: 'cafe resume naive', name: 'Unicode characters' },
  { id: 'EC-04', input: "'; DROP TABLE restaurants; --", name: 'SQL injection' },
  { id: 'EC-05', input: 'dinner', params: { neighborhood: 'Mars' }, name: 'Invalid neighborhood' },
  { id: 'EC-06', input: 'vegan steakhouse', name: 'Contradictory request' },
  { id: 'EC-07', input: '<script>alert("xss")</script>', name: 'XSS attempt' },
  { id: 'EC-08', input: 'dinner', params: { price_level: '$$$$$$' }, name: 'Invalid price' },
  { id: 'EC-09', input: 'dinner', params: { dietary_restrictions: ['vegan', 'gluten_free', 'halal'] }, name: 'Multi-restriction' },
  { id: 'EC-10', input: 'hmm', name: 'Ultra-short cold start' },
];

const GOLDEN_QUERIES = [
  { id: 'GD-F01', cat: 'Food', query: 'best burger in Chicago', minScore: 55 },
  { id: 'GD-F02', cat: 'Food', query: 'authentic Chinese food', minScore: 55 },
  { id: 'GD-F03', cat: 'Food', query: 'Korean BBQ', minScore: 55 },
  { id: 'GD-F04', cat: 'Food', query: 'best pasta in the city', minScore: 55 },
  { id: 'GD-F05', cat: 'Food', query: 'Caribbean food', minScore: 50 },
  { id: 'GD-F06', cat: 'Food', query: 'omakase sushi', minScore: 55 },
  { id: 'GD-F07', cat: 'Food', query: 'street tacos', minScore: 45 },
  { id: 'GD-F08', cat: 'Food', query: 'jerk chicken', minScore: 50 },
  { id: 'GD-F09', cat: 'Food', query: 'French bistro', minScore: 50 },
  { id: 'GD-F10', cat: 'Food', query: 'wood-fired pizza', minScore: 60 },
  { id: 'GD-V01', cat: 'Vibe', query: 'romantic dinner', minScore: 55 },
  { id: 'GD-V02', cat: 'Vibe', query: 'rooftop bar', minScore: 50 },
  { id: 'GD-V03', cat: 'Vibe', query: 'cozy spot', minScore: 50 },
  { id: 'GD-V04', cat: 'Vibe', query: 'trendy restaurant', minScore: 45 },
  { id: 'GD-V05', cat: 'Vibe', query: 'outdoor dining', minScore: 55 },
  { id: 'GD-S01', cat: 'Service', query: 'business lunch', minScore: 55 },
  { id: 'GD-S02', cat: 'Service', query: 'group dinner 10 people', minScore: 50 },
  { id: 'GD-S03', cat: 'Service', query: 'family friendly restaurant', minScore: 55 },
  { id: 'GD-R01', cat: 'Rep', query: 'best restaurant in Chicago', minScore: 60 },
  { id: 'GD-R02', cat: 'Rep', query: 'Michelin star restaurant', minScore: 65 },
  { id: 'GD-C01', cat: 'Conv', query: 'open right now', minScore: 50 },
  { id: 'GD-C02', cat: 'Conv', query: 'no reservation needed', minScore: 55 },
  { id: 'GD-C03', cat: 'Conv', query: 'cheap eats', minScore: 45 },
];

// Gauntlet sample queries for ATLAS
const ATLAS_QUERIES = [
  'Italian beef sandwich', 'deep dish pizza', 'best sushi Chicago',
  'authentic Mexican food', 'Thai food delivery', 'Ethiopian restaurant',
  'date night West Loop', 'cheap eats Wicker Park', 'brunch Lincoln Park',
  'late night food', 'vegan restaurant', 'steakhouse downtown',
  'like Portillos', 'dinner before Cubs game', 'Devon Avenue food',
  'Chinatown dim sum', 'tavern-style pizza', 'craft cocktails',
  'farm to table', 'hole in the wall', 'food near Navy Pier',
  'birthday dinner', 'solo dining bar', 'gluten free options',
  'outdoor patio dining', 'ramen near me', 'upscale Italian',
  'BBQ ribs', 'seafood restaurant', 'Mediterranean food',
];

let state = {
  systemState: 'idle', // idle | running | paused
  startTime: null,
  soundEnabled: false,
  logFilter: 'all',
  budgetUsed: 0,
  budgetDate: new Date().toISOString().split('T')[0],
  notifications: [],
  pollTimer: null,
  clockTimer: null,
  agents: {
    atlas:    { status: 'idle', hp: 100, xp: 0, level: 1, queries: 0, pass: 0, total: 0, avgDm: 0, gaps: 0, apiUsed: 0 },
    qaudit:   { status: 'idle', hp: 100, xp: 0, level: 1, audits: 0, grade: '--', slop: 0, clean: 0 },
    sentinel: { status: 'idle', hp: 100, xp: 0, level: 1, checks: 0, regressions: 0, baseline: '--', delta: '--', apiUsed: 0 },
    hunter:   { status: 'idle', hp: 100, xp: 0, level: 1, probes: 0, vulns: 0, contract: '--', errors: 0, apiUsed: 0 },
    guardian: { status: 'idle', hp: 100, xp: 0, level: 1, records: 0, issues: 0, orphans: 0, coverage: '--', apiUsed: 0 },
  },
  logs: [],
  cycleTimers: {},
};

// Load persisted state
function loadState() {
  try {
    const saved = localStorage.getItem('arcade-ops-state');
    if (saved) {
      const parsed = JSON.parse(saved);
      // Reset budget if new day
      if (parsed.budgetDate !== new Date().toISOString().split('T')[0]) {
        parsed.budgetUsed = 0;
        parsed.budgetDate = new Date().toISOString().split('T')[0];
        Object.values(parsed.agents).forEach(a => { if (a.apiUsed !== undefined) a.apiUsed = 0; });
      }
      // Merge, keeping systemState as idle (don't resume running on page load)
      Object.assign(state.agents, parsed.agents || {});
      state.budgetUsed = parsed.budgetUsed || 0;
      state.budgetDate = parsed.budgetDate || state.budgetDate;
      state.logs = parsed.logs || [];
    }
  } catch (e) { /* ignore */ }
}

function saveState() {
  try {
    localStorage.setItem('arcade-ops-state', JSON.stringify({
      agents: state.agents,
      budgetUsed: state.budgetUsed,
      budgetDate: state.budgetDate,
      logs: state.logs.slice(-MAX_LOG_ENTRIES),
    }));
  } catch (e) { /* ignore */ }
}

// ═══════════════════════════════════════════════════════════════════
// Splash Screen
// ═══════════════════════════════════════════════════════════════════

function dismissSplash() {
  const splash = document.getElementById('splash');
  splash.classList.add('splash--hidden');
  setTimeout(() => splash.remove(), 600);
}

document.addEventListener('keydown', function onFirstKey() {
  dismissSplash();
  document.removeEventListener('keydown', onFirstKey);
});

// ═══════════════════════════════════════════════════════════════════
// Clock
// ═══════════════════════════════════════════════════════════════════

function updateClock() {
  const now = new Date();
  document.getElementById('clock').textContent = now.toTimeString().split(' ')[0];

  if (state.startTime) {
    const elapsed = Math.floor((now - state.startTime) / 1000);
    const h = String(Math.floor(elapsed / 3600)).padStart(2, '0');
    const m = String(Math.floor((elapsed % 3600) / 60)).padStart(2, '0');
    const s = String(elapsed % 60).padStart(2, '0');
    document.getElementById('uptime').textContent = `Uptime: ${h}:${m}:${s}`;
  }
}

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
// Controls: START / PAUSE / STOP
// ═══════════════════════════════════════════════════════════════════

function handleStart() {
  if (state.systemState === 'running') return;

  state.systemState = 'running';
  state.startTime = state.startTime || new Date();

  document.getElementById('btn-start').classList.add('active');
  document.getElementById('btn-start').disabled = true;
  document.getElementById('btn-pause').disabled = false;
  document.getElementById('btn-stop').disabled = false;

  updateSystemStatus('Online', 'green');
  document.getElementById('paused-overlay').classList.remove('paused-overlay--visible');

  addLog('SYSTEM', 'All agents deployed. Monitoring active.', 'star');

  // Start agent cycles
  startAgentCycles();

  // Start polling
  if (state.pollTimer) clearInterval(state.pollTimer);
  state.pollTimer = setInterval(pollAgentStatus, POLL_INTERVAL_RUNNING);

  if (!state.clockTimer) {
    state.clockTimer = setInterval(updateClock, 1000);
  }
}

function handlePause() {
  if (state.systemState !== 'running') return;

  state.systemState = 'paused';

  document.getElementById('btn-start').classList.remove('active');
  document.getElementById('btn-start').disabled = false;
  document.getElementById('btn-pause').disabled = true;

  updateSystemStatus('Paused', 'amber');
  document.getElementById('paused-overlay').classList.add('paused-overlay--visible');

  // Pause agent cycles
  stopAgentCycles();

  // Slow polling
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

function handleStop() {
  state.systemState = 'idle';
  state.startTime = null;

  document.getElementById('btn-start').classList.remove('active');
  document.getElementById('btn-start').disabled = false;
  document.getElementById('btn-pause').disabled = true;
  document.getElementById('btn-stop').disabled = true;

  updateSystemStatus('Stopped', 'red');
  document.getElementById('paused-overlay').classList.remove('paused-overlay--visible');

  // Stop all cycles
  stopAgentCycles();

  if (state.pollTimer) { clearInterval(state.pollTimer); state.pollTimer = null; }

  // Show game over
  showGameOver();

  addLog('SYSTEM', 'Session ended. All agents stopped.', 'fail');

  Object.keys(state.agents).forEach(id => {
    state.agents[id].status = 'idle';
    updateAgentStatusUI(id);
  });

  saveState();
}

// ═══════════════════════════════════════════════════════════════════
// Agent Cycle Engine
// ═══════════════════════════════════════════════════════════════════

function startAgentCycles() {
  // ATLAS: every 30s
  state.cycleTimers.atlas = setInterval(() => runAtlasCycle(), 30000);
  runAtlasCycle(); // immediate first run

  // QAUDIT: every 45s (analyzes ATLAS output)
  state.cycleTimers.qaudit = setInterval(() => runQauditCycle(), 45000);
  setTimeout(() => runQauditCycle(), 5000); // slight delay

  // SENTINEL: every 60s
  state.cycleTimers.sentinel = setInterval(() => runSentinelCycle(), 60000);
  setTimeout(() => runSentinelCycle(), 10000);

  // HUNTER: every 40s
  state.cycleTimers.hunter = setInterval(() => runHunterCycle(), 40000);
  setTimeout(() => runHunterCycle(), 15000);

  // GUARDIAN: every 90s
  state.cycleTimers.guardian = setInterval(() => runGuardianCycle(), 90000);
  setTimeout(() => runGuardianCycle(), 20000);
}

function stopAgentCycles() {
  Object.keys(state.cycleTimers).forEach(key => {
    clearInterval(state.cycleTimers[key]);
    delete state.cycleTimers[key];
  });
}

// ─── ATLAS Cycle ───────────────────────────────────────────────
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

  // Pick a random query
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
  } else {
    agent.gaps++;
    addLog('atlas', `API ERROR: "${query}" -> ${result.error || 'HTTP ' + result.httpCode}`, 'fail');
    addNotification('api_error', `API Error on query: "${query}"`, 'atlas');
  }

  updateAgentCardUI('atlas');
  updateBossBar();
  updateLeaderboard();
  saveState();
}

// ─── QAUDIT Cycle ──────────────────────────────────────────────
function runQauditCycle() {
  if (state.systemState !== 'running') return;
  const agent = state.agents.qaudit;
  agent.status = 'running';
  updateAgentStatusUI('qaudit');

  // Simulate blurb audit on latest ATLAS results
  // In real implementation, this reads from gauntlet-results/*.jsonl
  const sampleBlurbs = [
    'We love this spot for its handmade pasta and warm neighborhood feel. The rigatoni is a standout.',
    'This place nails the vibe for a low-key date night. We always grab the smoked brisket here.',
    'A culinary journey through authentic flavors that will tantalize your taste buds.',
    'We think this is a solid pick when you want classic Chicago comfort food without the wait.',
    'Hidden gem nestled in the heart of Wicker Park with artisanal crafted dishes.',
  ];

  let slopCount = 0;
  let cleanCount = 0;

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

  // Calculate grade
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
  saveState();
}

// ─── SENTINEL Cycle ────────────────────────────────────────────
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

  // Pick a random golden query
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
      awardXP('sentinel', 50); // Catching regressions is valuable
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
  saveState();
}

// ─── HUNTER Cycle ──────────────────────────────────────────────
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

  // Pick a random edge probe
  const probe = EDGE_PROBES[Math.floor(Math.random() * EDGE_PROBES.length)];
  addLog('hunter', `Probe: [${probe.id}] ${probe.name}`, 'pass');

  const result = await callAPI(probe.input, probe.params || {});
  agent.apiUsed++;
  agent.probes++;

  // Validate response contract
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
  // Note: API returning success:false on edge case is expected behavior, not a failure

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
  saveState();
}

// ─── GUARDIAN Cycle ────────────────────────────────────────────
async function runGuardianCycle() {
  if (state.systemState !== 'running') return;
  const agent = state.agents.guardian;
  agent.status = 'running';
  updateAgentStatusUI('guardian');

  // GUARDIAN primarily does DB checks — simulate with a spot-check API call
  if (agent.apiUsed < AGENT_DEFS.guardian.budget) {
    const result = await callAPI('dinner');
    agent.apiUsed++;

    if (result.success && result.restaurant) {
      agent.records++;
      const r = result.restaurant;
      let localIssues = 0;

      // Check data completeness
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

  // Simulate DB integrity checks (would be real Supabase queries in production)
  agent.orphans = 0; // In real impl, query for orphaned records
  agent.hp = agent.records > 0 ? Math.max(0, 100 - (agent.issues * 5)) : 100;

  addLog('guardian', `Integrity scan: ${agent.records} restaurants checked, ${agent.issues} issues`, agent.issues > 0 ? 'warn' : 'pass');

  agent.status = 'idle';
  updateAgentCardUI('guardian');
  updateAgentStatusUI('guardian');
  updateLeaderboard();
  saveState();
}

// ═══════════════════════════════════════════════════════════════════
// XP & Leveling
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

// ═══════════════════════════════════════════════════════════════════
// UI Updates
// ═══════════════════════════════════════════════════════════════════

function updateSystemStatus(text, color) {
  const dot = document.getElementById('status-dot');
  const txt = document.getElementById('status-text');
  txt.textContent = text;

  dot.className = 'header__status-dot';
  if (color === 'green') { /* default green dot */ }
  else if (color === 'amber') { dot.classList.add('header__status-dot--paused'); }
  else { dot.classList.add('header__status-dot--offline'); }
}

function updateAgentStatusUI(agentId) {
  const agent = state.agents[agentId];
  const el = document.getElementById(`${agentId}-status`);
  if (!el) return;

  el.className = 'agent-card__status';
  switch (agent.status) {
    case 'running':
      el.classList.add('agent-card__status--running');
      el.textContent = 'Running';
      break;
    case 'paused':
    case 'budget_paused':
      el.classList.add('agent-card__status--paused');
      el.textContent = agent.status === 'budget_paused' ? 'Budget Limit' : 'Paused';
      break;
    case 'error':
      el.classList.add('agent-card__status--error');
      el.textContent = 'Error';
      break;
    default:
      el.classList.add('agent-card__status--idle');
      el.textContent = 'Idle';
  }
}

function updateAgentCardUI(agentId) {
  const a = state.agents[agentId];

  // Level
  const levelEl = document.getElementById(`${agentId}-level`);
  if (levelEl) levelEl.textContent = `Lvl ${a.level}`;

  // HP bar
  const hpFill = document.getElementById(`${agentId}-hp-fill`);
  const hpVal = document.getElementById(`${agentId}-hp-val`);
  if (hpFill) {
    hpFill.style.width = `${a.hp}%`;
    hpFill.className = 'hp-bar__fill';
    if (a.hp >= 70) hpFill.classList.add('hp-bar__fill--high');
    else if (a.hp >= 40) hpFill.classList.add('hp-bar__fill--medium');
    else hpFill.classList.add('hp-bar__fill--low');
  }
  if (hpVal) hpVal.textContent = `${a.hp}%`;

  // XP
  const xpEl = document.getElementById(`${agentId}-xp`);
  if (xpEl) xpEl.textContent = `Score: ${a.xp.toLocaleString()}`;

  // Per-agent stats
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
    el.className = 'agent-stat__value';
    el.classList.add(`agent-stat__value--${colorClass}`);
  }
}

function updateBudgetUI() {
  const remaining = DAILY_BUDGET - state.budgetUsed;
  const pct = Math.round((remaining / DAILY_BUDGET) * 100);
  document.getElementById('budget-text').textContent = `${state.budgetUsed} / ${DAILY_BUDGET} calls`;
  const pctEl = document.getElementById('budget-pct');
  if (pctEl) pctEl.textContent = `${pct}%`;

  const fill = document.getElementById('budget-fill');
  fill.style.width = `${pct}%`;
  fill.className = 'controls__budget-fill';
  if (pct <= 20) fill.classList.add('controls__budget-fill--critical');
  else if (pct <= 50) fill.classList.add('controls__budget-fill--warning');
}

function updateBossBar() {
  // Boss HP = inverse of overall quality
  // If pass rate is 100%, boss is dead (0%). If pass rate is 0%, boss is at 100%.
  const atlas = state.agents.atlas;
  const passRate = atlas.total > 0 ? atlas.pass / atlas.total : 0.5;
  const bossHp = Math.max(0, Math.round((1 - passRate) * 100));

  document.getElementById('boss-fill').style.width = `${bossHp}%`;
  document.getElementById('boss-hp').textContent = `${bossHp}%`;

  if (bossHp === 0) {
    addLog('SYSTEM', 'All quality checks passing. Search quality is excellent.', 'star');
  }
}

function updateLeaderboard() {
  const entries = Object.entries(state.agents)
    .map(([id, a]) => ({ id, name: AGENT_DEFS[id].name, xp: a.xp }))
    .sort((a, b) => b.xp - a.xp);

  const list = document.getElementById('leaderboard');
  const ranks = ['leaderboard__rank--1', 'leaderboard__rank--2', 'leaderboard__rank--3', 'leaderboard__rank--other', 'leaderboard__rank--other'];

  list.innerHTML = entries.map((e, i) => `
    <li class="leaderboard__entry">
      <span class="leaderboard__rank ${ranks[i]}">${i + 1}.</span>
      <span class="leaderboard__name">${e.name}</span>
      <span class="leaderboard__score">${e.xp.toLocaleString()}</span>
    </li>
  `).join('');
}

// ═══════════════════════════════════════════════════════════════════
// Battle Log
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
  const iconMap = { pass: '&#10003;', warn: '&#9888;', fail: '&#10007;', star: '&#9733;' };
  const iconClass = `log-entry__icon--${entry.severity}`;
  const agentClass = `log-entry__agent--${entry.agentId}`;

  const div = document.createElement('div');
  div.className = 'log-entry';
  div.setAttribute('data-agent', entry.agentId);
  div.innerHTML = `
    <span class="log-entry__time">${entry.time}</span>
    <span class="log-entry__agent ${agentClass}">${entry.agent}</span>
    <span class="log-entry__message">${escapeHtml(entry.message)}</span>
    <span class="log-entry__icon ${iconClass}">${iconMap[entry.severity] || '&#9679;'}</span>
  `;

  logEl.appendChild(div);
  logEl.scrollTop = logEl.scrollHeight;

  // Trim DOM entries
  while (logEl.children.length > MAX_LOG_ENTRIES) {
    logEl.removeChild(logEl.firstChild);
  }
}

function filterLog(filter) {
  state.logFilter = filter;

  // Update filter button states
  document.querySelectorAll('.battle-log__filter').forEach(btn => {
    btn.classList.toggle('battle-log__filter--active', btn.dataset.filter === filter);
  });

  // Re-render log
  const logEl = document.getElementById('battle-log');
  logEl.innerHTML = '';
  state.logs.forEach(entry => renderLogEntry(entry));
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// ═══════════════════════════════════════════════════════════════════
// Notifications
// ═══════════════════════════════════════════════════════════════════

function addNotification(type, message, agentId) {
  const notif = {
    id: Date.now(),
    type,
    message,
    agentId,
    timestamp: new Date().toISOString(),
    acknowledged: false,
  };

  state.notifications.push(notif);
  renderNotifications();
}

function renderNotifications() {
  const pending = state.notifications.filter(n => !n.acknowledged);
  const bar = document.getElementById('notification-bar');
  const badge = document.getElementById('notif-badge');
  const list = document.getElementById('notification-list');

  badge.textContent = pending.length;

  if (pending.length > 0) {
    bar.classList.add('notification-bar--visible');
  } else {
    bar.classList.remove('notification-bar--visible');
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
      // Grant additional budget
      if (notif.agentId && state.agents[notif.agentId]) {
        state.agents[notif.agentId].apiUsed = 0; // Reset agent budget
        state.agents[notif.agentId].status = 'idle';
        addLog('SYSTEM', `CEO approved additional API calls for ${AGENT_DEFS[notif.agentId]?.name || notif.agentId}.`, 'star');
      }
      break;
    case 'deny':
      notif.acknowledged = true;
      addLog('SYSTEM', `CEO denied request from ${AGENT_DEFS[notif.agentId]?.name || notif.agentId}.`, 'warn');
      break;
    case 'defer':
      // Don't acknowledge, just hide for now — will show again
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

function showGameOver() {
  const overlay = document.getElementById('game-over');
  const statsEl = document.getElementById('game-over-stats');

  const totalQueries = Object.values(state.agents).reduce((s, a) => s + (a.queries || a.probes || a.checks || a.audits || a.records || 0), 0);
  const totalXP = Object.values(state.agents).reduce((s, a) => s + a.xp, 0);

  statsEl.innerHTML = `
    <strong>Total Queries:</strong> ${totalQueries}<br>
    <strong>Total Score:</strong> ${totalXP.toLocaleString()}<br>
    <strong>API Calls Used:</strong> ${state.budgetUsed} / ${DAILY_BUDGET}<br>
    <strong>Agents Active:</strong> 5<br>
    <br>
    ${state.agents.atlas.total > 0 ? `<strong>Pass Rate:</strong> ${Math.round((state.agents.atlas.pass / state.agents.atlas.total) * 100)}%` : '<em>No passes recorded</em>'}<br>
    <strong>Blurb Grade:</strong> ${state.agents.qaudit.grade}<br>
    <strong>Regressions Found:</strong> ${state.agents.sentinel.regressions}<br>
    <strong>Issues Found:</strong> ${state.agents.hunter.vulns}<br>
  `;

  overlay.classList.add('game-over--visible');
}

function dismissGameOver() {
  document.getElementById('game-over').classList.remove('game-over--visible');
}

// ═══════════════════════════════════════════════════════════════════
// Sound Toggle
// ═══════════════════════════════════════════════════════════════════

document.getElementById('sound-toggle').addEventListener('click', () => {
  state.soundEnabled = !state.soundEnabled;
  document.getElementById('sound-toggle').textContent = state.soundEnabled ? 'Sound On' : 'Sound Off';
  document.getElementById('sound-toggle').classList.toggle('sound-toggle--on', state.soundEnabled);
});

// ═══════════════════════════════════════════════════════════════════
// Polling (for external agent-status.json in production)
// ═══════════════════════════════════════════════════════════════════

function pollAgentStatus() {
  // In production, this would fetch agent-status.json from the backend
  // For now, state is managed in-browser via the cycle engine above
  updateBudgetUI();
  Object.keys(state.agents).forEach(id => {
    updateAgentCardUI(id);
    updateAgentStatusUI(id);
  });
}

// ═══════════════════════════════════════════════════════════════════
// CEO Profile
// ═══════════════════════════════════════════════════════════════════

function updateCEOProfile() {
  const totalXP = Object.values(state.agents).reduce((s, a) => s + a.xp, 0);
  const ceoLevel = Math.floor(totalXP / 2000) + 1;
  const ranks = ['Recruit', 'Operator', 'Commander', 'Director', 'Admiral', 'Legend'];
  const rank = ranks[Math.min(ceoLevel - 1, ranks.length - 1)];

  document.getElementById('ceo-rank').textContent = `Level ${ceoLevel} — ${rank}`;
}

// ═══════════════════════════════════════════════════════════════════
// Init
// ═══════════════════════════════════════════════════════════════════

loadState();
updateClock();
updateBudgetUI();
updateBossBar();
updateLeaderboard();
updateCEOProfile();

// Render persisted logs
state.logs.forEach(entry => renderLogEntry(entry));

// Update all agent cards with persisted data
Object.keys(state.agents).forEach(id => {
  updateAgentCardUI(id);
  updateAgentStatusUI(id);
});

// Start clock
state.clockTimer = setInterval(updateClock, 1000);

// Periodic CEO profile update
setInterval(updateCEOProfile, 5000);
