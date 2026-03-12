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

// ═══════════════════════════════════════════════════════════════════
// Test Type Definitions
// ═══════════════════════════════════════════════════════════════════

const TEST_TYPES = {
  broad:      { name: 'Broad Scan',       count: 20, cost: '~$0.20', time: '~2 min' },
  category:   { name: 'Category Focus',   count: 15, cost: '~$0.15', time: '~1 min' },
  regression: { name: 'Regression Guard',  count: 23, cost: '~$0.25', time: '~3 min' },
  edge:       { name: 'Edge Cases',        count: 20, cost: '~$0.20', time: '~1 min' },
  blurb:      { name: 'Blurb Quality',     count: 10, cost: '~$0.05', time: '~30s' },
  coverage:   { name: 'Data Coverage',     count: 10, cost: '~$0.05', time: '~30s' },
};

const QUERY_CATEGORIES = {
  Food:    { label: 'Food',    color: '#f97316', desc: 'Dish & cuisine queries' },
  Vibe:    { label: 'Vibe',    color: '#a855f7', desc: 'Atmosphere & mood' },
  Service: { label: 'Service', color: '#3b82f6', desc: 'Occasion & group' },
  Rep:     { label: 'Rep',     color: '#eab308', desc: 'Reputation & prestige' },
  Conv:    { label: 'Conv',    color: '#22c55e', desc: 'Convenience & access' },
};

// Banned cliché patterns for Blurb QA
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
};

// Session persistence keys
const SESSION_KEYS = ['activeTab', 'liveFilter', 'liveFilters', 'pulseMode', 'blurbMode', 'autoRefresh', 'autoRefreshSecs', 'testConfig'];

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

function escapeHtml(s) {
  const d = document.createElement('div');
  d.textContent = s;
  return d.innerHTML;
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

// Toast for CC (share.js not loaded here)
function showToast(message) {
  let toast = document.getElementById('cc-toast');
  if (!toast) {
    toast = document.createElement('div');
    toast.id = 'cc-toast';
    toast.className = 'cc-toast';
    document.body.appendChild(toast);
  }
  toast.textContent = message;
  toast.classList.add('cc-toast--visible');
  clearTimeout(toast._timer);
  toast._timer = setTimeout(() => toast.classList.remove('cc-toast--visible'), 2500);
}
