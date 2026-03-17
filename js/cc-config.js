/**
 * DondeAI Command Center v2 — Configuration & Constants
 * Simplified: no agent gamification, focused on test types + live monitoring
 */

// ═══════════════════════════════════════════════════════════════════
// Constants
// ═══════════════════════════════════════════════════════════════════

const SUPABASE_URL = 'https://vwbzkgsxmgwcvmvuxnbe.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZ3YnprZ3N4bWd3Y3ZtdnV4bmJlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njk5NjUzNTYsImV4cCI6MjA4NTU0MTM1Nn0.YBhmusYxc28TD5FOZv4TBpFpDVHHk1V894wUkNtJtcc';
// Service key removed — never expose service_role keys in client-side code
const ADMIN_EMAIL = 'aacrit@gmail.com';
const API_BASE = 'https://vwbzkgsxmgwcvmvuxnbe.supabase.co/functions/v1/recommend';
const LIVE_POLL_INTERVAL = 10000;
const PIPE_POLL_INTERVAL = 15000;

// Wave 2: CEO personalization
const CEO_NAME = 'Aacrit';
const CALENDAR_ID = 'aacrit@gmail.com'; // CEO's Google Calendar ID
const CHICAGO_TZ = 'America/Chicago';

// ═══════════════════════════════════════════════════════════════════
// SLA Defaults
// ═══════════════════════════════════════════════════════════════════

const SLA_DEFAULTS = [
  { id: 'grade_pass_rate', name: 'Grade Pass Rate', threshold: 85, warn: 80, unit: '%', direction: 'above' },
  { id: 'avg_dm', name: 'Avg DondeMatch', threshold: 75, warn: 70, unit: '', direction: 'above' },
  { id: 'p0_count', name: 'P0 Issues', threshold: 0, warn: 1, unit: '', direction: 'below' },
  { id: 'p95_response', name: 'p95 Response', threshold: 5000, warn: 3000, unit: 'ms', direction: 'below' },
  { id: 'fallback_rate', name: 'Fallback Rate', threshold: 10, warn: 5, unit: '%', direction: 'below' },
];

// ═══════════════════════════════════════════════════════════════════
// Test Type Definitions
// ═══════════════════════════════════════════════════════════════════

const TEST_TYPES = {
  broad:       { name: 'Broad Scan',       count: 20, costLive: '~$5.60', costScoring: '$0.00', time: '~2 min' },
  category:    { name: 'Category Focus',   count: 15, costLive: '~$4.20', costScoring: '$0.00', time: '~1 min' },
  regression:  { name: 'Regression Guard', count: 23, costLive: '~$6.44', costScoring: '$0.00', time: '~3 min' },
  edge:        { name: 'Edge Cases',       count: 20, costLive: '~$5.60', costScoring: '$0.00', time: '~1 min' },
  blurb:       { name: 'Blurb Quality',    count: 10, costLive: '~$2.80', costScoring: '$0.00', time: '~30s' },
  coverage:    { name: 'Data Coverage',    count: 10, costLive: '~$2.80', costScoring: '$0.00', time: '~30s' },
  'blurb-live':  { name: 'Blurb Quality Check',  count: 1, costLive: '~$0.30', costScoring: '~$0.30', time: '~5s', live: true },
  'intent-live': { name: 'Intent Classification', count: 1, costLive: '~$0.05', costScoring: '~$0.05', time: '~3s', live: true },
};

/** Get display cost for a test type based on current liveAPI state */
function getTestCost(type) {
  const t = TEST_TYPES[type];
  if (!t) return '$0.00';
  if (t.live) return t.costLive; // Live tests always cost $
  return state.liveAPI ? t.costLive : t.costScoring;
}

function generateRunName(runId, mode, total, timestamp) {
  var ts = typeof timestamp === 'string' ? new Date(timestamp).getTime() : (timestamp || Date.now());
  var date = new Date(ts);
  var timeStr = date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
  var qStr = total ? total + 'q' : '';

  // CLI-imported runs
  if (runId && typeof runId === 'string') {
    if (runId.startsWith('cli-golden')) return 'CLI: Golden Dataset' + (qStr ? ' (' + qStr + ', ' + timeStr + ')' : '');
    if (runId.startsWith('cli-regression')) return 'CLI: Regression Guard' + (qStr ? ' (' + qStr + ', ' + timeStr + ')' : '');
    if (runId.startsWith('cli-')) return 'CLI: Test Run' + (qStr ? ' (' + qStr + ', ' + timeStr + ')' : '');
  }

  var RUN_NAMES = {
    broad: ['Golden Dataset Sweep', 'Quality Scan', 'Engine Health Check'],
    category: ['Category Deep Dive', 'Signal Focus Test', 'Targeted Audit'],
    regression: ['Regression Guard', 'Baseline Defense', 'Stability Check'],
    edge: ['Edge Case Probe', 'Boundary Stress Test', 'Resilience Audit'],
    blurb: ['Blurb Quality Audit', 'Voice & Tone Check'],
    coverage: ['Data Coverage Scan', 'Profile Gap Audit'],
    'blurb-live': ['Live Blurb Eval'],
    'intent-live': ['Intent Classification Check']
  };

  var type = mode || 'broad';
  var names = RUN_NAMES[type] || ['Test Run'];
  var idx = Math.floor(ts / 60000) % names.length;
  var suffix = qStr ? ' (' + qStr + ', ' + timeStr + ')' : ' (' + timeStr + ')';
  return names[idx] + suffix;
}

const QUERY_CATEGORIES = {
  Food:    { label: 'Food',    color: '#f97316', desc: 'Dish & cuisine queries' },
  Vibe:    { label: 'Vibe',    color: '#a855f7', desc: 'Atmosphere & mood' },
  Service: { label: 'Service', color: '#3b82f6', desc: 'Occasion & group' },
  Rep:     { label: 'Rep',     color: '#eab308', desc: 'Reputation & prestige' },
  Conv:    { label: 'Conv',    color: '#22c55e', desc: 'Convenience & access' },
};

// Banned cliché patterns for Blurb QA — synced with backend grading.ts
const BANNED_PATTERNS = [
  'hidden gem', 'best-kept secret', 'culinary journey', 'taste buds', 'flavor explosion',
  'mouthwatering', 'delectable', 'delightful', 'exquisite', 'impeccable', 'nestled',
  'tucked away', 'foodie', 'gastronomic', 'epicurean', 'palate', 'tantalizing',
  'sumptuous', 'delicacy', 'indulge', 'savor every', 'feast for', 'a cut above',
  'second to none', 'worth every penny', 'not to be missed', 'a must-visit',
  'you won\'t regret', 'look no further', 'stands out from', 'elevate your',
  'take your taste', 'redefine', 'reimagine', 'transcend', 'next level',
  'game changer', 'game-changer', 'blown away', 'pleasantly surprised',
  'exceeded expectations', 'won\'t disappoint', 'never disappoints', 'consistently delivers',
  'truly special', 'something special', 'one-of-a-kind', 'like no other',
  'in the heart of', 'bustling', 'vibrant scene', 'warm and inviting',
  'cozy atmosphere', 'welcoming ambiance', 'rustic charm', 'elegant setting',
  'step into', 'transport you', 'whisk you away', 'escape to',
  'perfect blend', 'harmonious', 'symphony of', 'dance of flavors',
  'artfully crafted', 'lovingly prepared', 'passion for', 'dedication to',
  'attention to detail', 'craft', 'artisan',
  '\u2014',
  // V20: Expanded anti-slop patterns
  "it's worth noting", "it's no surprise", 'pairs perfectly', 'hits different',
  'chef-driven', 'locally sourced', 'seasonal ingredients', 'warm hospitality',
  'inviting atmosphere', 'culinary prowess', 'flavor profile', 'price point',
  'farm-to-table', 'nose-to-tail', 'thoughtfully curated', 'carefully selected',
  'hand-picked', 'each dish tells', 'every plate is', 'a celebration of',
  'pays homage', 'takes you on', 'where every bite', 'where every dish', 'where every plate', 'more than just',
  'the star of the show', 'steal the show', 'take center stage',
];

// Edge case probes for Edge Case tests
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
  { id: 'EC-11', input: '   ', name: 'Whitespace only' },
  { id: 'EC-12', input: 'dinner', params: { dietary_restrictions: Array(50).fill('vegan') }, name: 'Oversized restriction array' },
  { id: 'EC-13', input: 'dinner', params: { price_level: '-1' }, name: 'Negative price level' },
  { id: 'EC-14', input: '🍕🌮🍣🥗🍔', name: 'Emoji-only input' },
  { id: 'EC-15', input: 'dinner', params: { neighborhood: '' }, name: 'Empty neighborhood' },
  { id: 'EC-16', input: 'restaurant'.repeat(100), name: 'Repeated word spam' },
  { id: 'EC-17', input: '{"special_request":"injection"}', name: 'JSON in text field' },
  { id: 'EC-18', input: 'best food', params: { exclude: Array(100).fill('00000000-0000-0000-0000-000000000000') }, name: 'Oversized exclude list' },
  { id: 'EC-19', input: 'a', name: 'Single character' },
  { id: 'EC-20', input: 'Find me a place that is not too expensive but also not cheap with good vibes and great food preferably Italian or maybe Mexican actually surprise me', name: 'Run-on multi-intent' },
];

// Golden queries with baseline scores for Regression Guard
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

// Pipeline definitions for Data tab
const PIPELINES = [
  { id: 'discovery',    name: 'Discovery',     icon: '&#128269;' },
  { id: 'enrichment',   name: 'Enrichment',    icon: '&#9878;' },
  { id: 'scores_tags',  name: 'Scores & Tags', icon: '&#9733;' },
  { id: 'audit',        name: 'Full Audit',    icon: '&#128203;' },
];

// Required fields for Data Coverage test
const REQUIRED_FIELDS = ['name', 'address', 'cuisine_type', 'google_rating', 'noise_level', 'price_level', 'phone', 'neighborhood_name', 'lighting_ambiance'];

// ═══════════════════════════════════════════════════════════════════
// Global State (simplified — no agent gamification)
// ═══════════════════════════════════════════════════════════════════

// Safe storage for query data — used by event delegation instead of inline onclick
const _queryDataCache = [];
function _storeQueryData(query) {
  const idx = _queryDataCache.length;
  _queryDataCache.push(query);
  return idx;
}

let state = {
  activeTab: 'test',
  activeTest: null,       // { type, abortController, progress, total, results[], startTime }
  livePolling: false,
  liveFeed: [],
  liveLastId: null,
  liveFilter: 'all',   // 'all' | 'today' | '7d'
  liveFilters: {},     // { scoreRange, fallback, feedback } advanced filters
  latestRun: null,
  pipelineStatuses: {},
  pipePollTimer: null,
  livePollTimer: null,
  retesting: false,   // true while retest in progress
  runHistory: [],           // last 10 gauntlet runs
  selectedRunId: null,      // currently selected run in Recent Runs
  pulseMode: 'test',        // 'test' (run-based) | 'prod' (live 7d data)
  blurbMode: 'quick',       // 'quick' (regex) | 'deep' (Claude API)
  expandedPulse: null,      // which pulse card is expanded: 'health'|'quality'|'attention'|null
  // Comparative Run View
  compareRunA: null,        // run_id for comparison base
  compareRunB: null,        // run_id for comparison target
  compareData: [],          // results from get_run_comparison RPC
  compareFilter: 'all',     // 'all'|'improved'|'regressed'|'unchanged'
  compareOpen: false,       // compare panel visible
  // Auto-refresh
  autoRefresh: false,
  autoRefreshSecs: 60,      // 30 | 60
  autoRefreshTimer: null,
  autoRefreshCountdown: 0,
  // Trend & analytics
  trendData: [],            // last 10 runs' summary for sparklines
  heatmapData: {},          // category × difficulty coverage grid
  anomalyAlert: null,       // { message, severity, runId } or null
  perfBaseline: { p50: 0, p90: 0, p99: 0 },
  // Keyboard nav
  focusedRunIdx: -1,        // j/k navigation index in run history
  // v3: Configurable tests
  testConfig: {
    broad:      { count: 20, difficulty: 'all', threshold: 60 },
    category:   { count: 15, difficulty: 'all', threshold: 60 },
    regression: { count: 23, difficulty: 'all', threshold: 60 },
  },
  configOpen: null,           // which test type has config open
  selectedCategories: [],     // multi-select for category focus
  customQueries: [],          // CEO's custom test queries [{query,cat,id}]
  pinnedQueries: [],          // pinned/favorited query strings
  terminalOpen: false,
  unreadLogs: 0,              // unread terminal log count (for FAB badge)
  lastTestType: null,         // for quick rerun
  lastTestConfig: null,       // for quick rerun
  lastDataRefresh: null,      // timestamp of last successful data load (for freshness indicator)
  // Wave 2
  calendarOpen: false,        // calendar panel visible
  cmdPaletteOpen: false,      // command palette visible
  cmdPaletteIdx: 0,           // focused command index
  lastScrollY: 0,             // for quick actions show/hide
  quickActionsVisible: true,  // quick actions bar visibility
  liveAPI: false,             // Live API toggle — default OFF (scoring only, $0)
  dashboardMode: 'test',      // 'test' | 'live' — dual-mode dashboard toggle
  liveKPIs: null,             // live production KPIs { blurbQuality, scoreFit, responseTime, cacheHitRate, avgDm, passRate, queryCount }
};

// Session persistence keys
const SESSION_KEYS = ['activeTab', 'liveFilter', 'liveFilters', 'pulseMode', 'blurbMode', 'autoRefresh', 'autoRefreshSecs', 'testConfig', 'expandedPulse', 'selectedRunId', 'liveAPI', 'dashboardMode'];

function saveSession() {
  try {
    const session = {};
    for (const k of SESSION_KEYS) session[k] = state[k];
    if (state.issueFilters) session.issueFilters = state.issueFilters;
    localStorage.setItem('cc-session', JSON.stringify(session));
  } catch (_) {}
}

function restoreSession() {
  try {
    const raw = localStorage.getItem('cc-session');
    if (!raw) return;
    const session = JSON.parse(raw);
    for (const k of SESSION_KEYS) {
      if (session[k] !== undefined) state[k] = session[k];
    }
    if (session.issueFilters) state.issueFilters = session.issueFilters;
  } catch (_) {}
}

/** Set advanced live filter and re-apply (called from HTML selects) */
function setLiveAdvFilter(key, value) {
  if (!state.liveFilters) state.liveFilters = {};
  state.liveFilters[key] = value === 'all' ? undefined : value;
  applyLiveFilter();
  saveSession();
}

// Supabase client (set by cc-analytics.js after auth)
let sbClient = null;

// v3: Custom query persistence
function loadCustomQueries() {
  try { state.customQueries = JSON.parse(localStorage.getItem('cc-custom-queries') || '[]'); } catch (_) { state.customQueries = []; }
}
function saveCustomQueries() {
  try { localStorage.setItem('cc-custom-queries', JSON.stringify(state.customQueries)); } catch (_) {}
}
function loadPinnedQueries() {
  try { state.pinnedQueries = JSON.parse(localStorage.getItem('cc-pinned-queries') || '[]'); } catch (_) { state.pinnedQueries = []; }
}
function savePinnedQueries() {
  try { localStorage.setItem('cc-pinned-queries', JSON.stringify(state.pinnedQueries)); } catch (_) {}
}

// ═══════════════════════════════════════════════════════════════════
// Helpers
// ═══════════════════════════════════════════════════════════════════

function ragClass(dm) {
  if (dm >= 80) return 'rag-green';
  if (dm >= 60) return 'rag-amber';
  return 'rag-red';
}

function ragColor(dm) {
  if (dm >= 80) return 'var(--cc-green)';
  if (dm >= 60) return 'var(--cc-amber)';
  return 'var(--cc-red)';
}

function gradeColorClass(grade) {
  if (!grade) return 'grey';
  if (grade.startsWith('A')) return 'green';
  if (grade.startsWith('B')) return 'blue';
  if (grade.startsWith('C')) return 'amber';
  return 'red';
}

function pct(n, d) { return d === 0 ? '0' : (n / d * 100).toFixed(1); }
function r1(n) { return Math.round(n * 10) / 10; }

const _escapeDiv = document.createElement('div');
function escapeHtml(s) {
  _escapeDiv.textContent = s;
  return _escapeDiv.innerHTML;
}

function determineGapType(result, dm) {
  if (!result || dm >= 60) return null;
  const sv9 = result.scoring_v9 || {};
  const relScore = sv9.relevance_score || 0;
  if (relScore < 0.5) return 'intent';
  const factors = [sv9.food || 0, sv9.vibe || 0, sv9.service || 0, sv9.reputation || 0, sv9.convenience || 0];
  const minFactor = Math.min(...factors);
  if (minFactor < 4) return 'scoring';
  if (dm >= 50) return 'relevance_ceiling';
  return 'scoring';
}

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function timeAgo(ts) {
  const diff = Date.now() - new Date(ts).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

function fmtTime(ts) {
  return new Date(ts).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
}

// ═══════════════════════════════════════════════════════════════════
// Canonical API Call
// ═══════════════════════════════════════════════════════════════════

// Canonical callAPI — cc-agents.js has a broken duplicate (missing auth headers). Do NOT load cc-agents.js.
async function callAPI(specialRequest, params = {}, signal) {
  const body = { special_request: specialRequest, ...params };
  // Auto-add skip_claude unless forcing live or liveAPI is on
  if (!params._forceLive && !state.liveAPI) body.skip_claude = true;
  // Auto-add skip_google for scoring-only mode (same condition as skip_claude)
  if (!params._forceLive && !state.liveAPI) body.skip_google = true;
  // Clean internal flag from body
  delete body._forceLive;
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

// Wave 2: Session snapshot for Daily Digest (#4)
function saveSessionSnapshot(stats) {
  try {
    const snapshot = {
      avg_dm: stats.avg_dm || 0,
      avg_fit: stats.avg_fit || 0,
      avg_blurb: stats.avg_blurb || 0,
      query_count: stats.query_count || 0,
      grade_pass_rate: stats.grade_pass_rate || 0,
      timestamp: Date.now()
    };
    localStorage.setItem('cc-session-snapshot', JSON.stringify(snapshot));
  } catch (_) {}
}

function getLastSessionSnapshot() {
  try {
    const raw = localStorage.getItem('cc-session-snapshot');
    return raw ? JSON.parse(raw) : null;
  } catch (_) { return null; }
}

// Wave 2: Command palette commands (#10)
const CMD_PALETTE_COMMANDS = [
  // Navigation
  { cat: 'Navigation', icon: '1\u20E3', name: 'Go to Test tab', key: '1', action: () => switchTab('test') },
  { cat: 'Navigation', icon: '2\u20E3', name: 'Go to Live tab', key: '2', action: () => switchTab('live') },
  { cat: 'Navigation', icon: '3\u20E3', name: 'Go to Data tab', key: '3', action: () => switchTab('data') },
  { cat: 'Navigation', icon: '4\u20E3', name: 'Go to Issues tab', key: '4', action: () => switchTab('issues') },
  // Actions
  { cat: 'Actions', icon: '\u25B6', name: 'Run Broad Scan', key: 's', action: () => startTest('broad') },
  { cat: 'Actions', icon: '\u21BB', name: 'Refresh all data', key: 'r', action: () => refreshAllData() },
  { cat: 'Actions', icon: '\uD83D\uDCBE', name: 'Export current view', key: 'e', action: () => exportCurrentView() },
  { cat: 'Actions', icon: '\uD83D\uDCC5', name: 'Toggle calendar', action: () => toggleCalendarPanel() },
  { cat: 'Actions', icon: '\uD83D\uDD14', name: 'Toggle terminal', key: 't', action: () => toggleTerminal() },
  // Tests
  { cat: 'Tests', icon: '\u25A0', name: 'Run Category Focus', action: () => startTest('category') },
  { cat: 'Tests', icon: '\u26A0', name: 'Run Regression Guard', action: () => startTest('regression') },
  { cat: 'Tests', icon: '\uD83D\uDDE1', name: 'Run Edge Cases', action: () => startTest('edge') },
];

// ═══════════════════════════════════════════════════════════════════
// Live API Toggle (moved from cc-agents.js — that file is not loaded)
// ═══════════════════════════════════════════════════════════════════

function toggleLiveAPI() {
  state.liveAPI = !state.liveAPI;
  saveSession();
  updateLiveAPIUI();
  updateTestCosts();
}

function updateLiveAPIUI() {
  const btn = document.getElementById('live-api-toggle');
  const dot = document.getElementById('live-api-dot');
  const label = document.getElementById('live-api-label');
  if (!btn || !label) return;
  btn.setAttribute('aria-pressed', state.liveAPI ? 'true' : 'false');
  if (state.liveAPI) {
    btn.classList.remove('mc-live-toggle__btn--off');
    btn.classList.add('mc-live-toggle__btn--on');
    label.textContent = 'LIVE API';
  } else {
    btn.classList.remove('mc-live-toggle__btn--on');
    btn.classList.add('mc-live-toggle__btn--off');
    label.textContent = 'Scoring Only';
  }
  // Sync mobile badge
  const mobileBadge = document.getElementById('mobile-live-badge');
  if (mobileBadge) mobileBadge.textContent = state.liveAPI ? 'On' : 'Off';
}

function updateTestCosts() {
  const cards = document.querySelectorAll('.cc-test-card[data-test]');
  cards.forEach(card => {
    const type = card.dataset.test;
    const meta = card.querySelector('.cc-test-card__meta');
    if (meta && TEST_TYPES[type]) {
      const cost = getTestCost(type);
      const time = TEST_TYPES[type].time;
      meta.textContent = `${cost} \u00B7 ${time}`;
    }
  });
}

// Toast for CC (share.js not loaded here)
function showToast(message) {
  let toast = document.getElementById('mc-toast');
  if (!toast) {
    toast = document.createElement('div');
    toast.id = 'mc-toast';
    toast.className = 'mc-toast';
    document.body.appendChild(toast);
  }
  toast.textContent = message;
  toast.classList.add('mc-toast--visible');
  clearTimeout(toast._timer);
  toast._timer = setTimeout(() => toast.classList.remove('mc-toast--visible'), 2500);
}
