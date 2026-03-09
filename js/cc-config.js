/**
 * DondeAI Command Center — Configuration & Constants
 * Shared state, agent definitions, query banks
 */

// ═══════════════════════════════════════════════════════════════════
// Constants
// ═══════════════════════════════════════════════════════════════════

const SUPABASE_URL = 'https://vwbzkgsxmgwcvmvuxnbe.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZ3YnprZ3N4bWd3Y3ZtdnV4bmJlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njk5NjUzNTYsImV4cCI6MjA4NTU0MTM1Nn0.YBhmusYxc28TD5FOZv4TBpFpDVHHk1V894wUkNtJtcc';
const ADMIN_EMAIL = 'aacrit@gmail.com';
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

// ═══════════════════════════════════════════════════════════════════
// Global State
// ═══════════════════════════════════════════════════════════════════

let state = {
  systemState: 'idle',
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

// Gauntlet analytics state
let dashData = null;
let allGapsRef = [];
let historyLoaded = false;
let gapDetailsData = null;
let gapDetailsLoaded = false;

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

function pct(n, d) { return d === 0 ? '0' : (n / d * 100).toFixed(1); }
function r1(n) { return Math.round(n * 10) / 10; }

function escapeHtml(s) {
  const d = document.createElement('div');
  d.textContent = s;
  return d.innerHTML;
}

function factorColor(v) {
  if (v >= 7) return 'var(--cc-green)';
  if (v >= 5) return 'var(--cc-amber)';
  return 'var(--cc-red)';
}

function loadState() {
  try {
    const saved = localStorage.getItem('arcade-ops-state');
    if (saved) {
      const parsed = JSON.parse(saved);
      if (parsed.budgetDate !== new Date().toISOString().split('T')[0]) {
        parsed.budgetUsed = 0;
        parsed.budgetDate = new Date().toISOString().split('T')[0];
        Object.values(parsed.agents).forEach(a => { if (a.apiUsed !== undefined) a.apiUsed = 0; });
      }
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
