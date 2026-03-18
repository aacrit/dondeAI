/**
 * DondeAI Mission Control — COO Terminal
 * Natural language command router for the CEO Command Center.
 * Routes commands to test runners, Supabase queries, pipeline triggers,
 * and generates CLI commands for agent operations.
 */

// ═══════════════════════════════════════════════════════════════════
// Command Definitions
// ═══════════════════════════════════════════════════════════════════

const COO_COMMANDS = [
  {
    id: 'clear',
    patterns: [/^clear$/i, /^cls$/i],
    action: cmdClear,
    description: 'Clear terminal output',
    chip: null,
  },
  {
    id: 'help',
    patterns: [/help/i, /\?$/, /commands/i, /what.*can/i],
    action: cmdHelp,
    description: 'Show available commands',
    chip: null,
  },
  {
    id: 'scan',
    patterns: [/scan/i, /broad/i, /quality.*scan/i, /run.*test/i],
    action: cmdScan,
    description: 'Run broad quality scan (20 queries, $0)',
    chip: 'Scan',
  },
  {
    id: 'regression',
    patterns: [/regression/i, /guard/i, /golden/i, /baseline/i],
    action: cmdRegression,
    description: 'Run regression guard against golden dataset',
    chip: 'Regression',
  },
  {
    id: 'category',
    patterns: [/category\s+(\w+)/i, /test\s+(food|vibe|service|rep|conv)/i],
    action: cmdCategory,
    description: 'Run category-focused test',
    chip: null,
  },
  {
    id: 'edge',
    patterns: [/edge/i, /probe/i, /inject/i],
    action: cmdEdge,
    description: 'Run edge case probes',
    chip: null,
  },
  {
    id: 'status',
    patterns: [/status/i, /health/i, /how.*doing/i, /overview/i, /kpi/i],
    action: cmdStatus,
    description: 'Show current engine health and KPIs',
    chip: null,
  },
  {
    id: 'issues',
    patterns: [/issue/i, /broken/i, /wrong/i, /problem/i, /gap/i, /needs?\s*(attention|fix)/i],
    action: cmdIssues,
    description: 'List open quality issues',
    chip: null,
  },
  {
    id: 'fix',
    patterns: [/fix/i, /bug/i, /repair/i],
    action: cmdFix,
    description: 'Generate bug-fixer agent CLI command',
    chip: 'Fix Bugs',
  },
  {
    id: 'security',
    patterns: [/security/i, /audit/i, /ciso/i, /vuln/i],
    action: cmdSecurity,
    description: 'Generate security audit CLI command',
    chip: 'Security',
  },
  {
    id: 'coo',
    patterns: [/coo/i, /brief/i],
    action: cmdCOO,
    description: 'Generate COO briefing CLI command',
    chip: null,
  },
  {
    id: 'cache',
    patterns: [/cache/i, /warm/i],
    action: cmdCache,
    description: 'Show cache health or trigger cache warmer',
    chip: 'Cache',
  },
  {
    id: 'db',
    patterns: [/db.*health/i, /data.*(health|quality|coverage)/i, /database/i, /enrichment/i, /pipeline/i],
    action: cmdDb,
    description: 'Show database health overview',
    chip: 'DB Health',
  },
  {
    id: 'discovery',
    patterns: [/discover/i, /find.*new/i, /new.*restaurant/i],
    action: cmdDiscovery,
    description: 'Trigger restaurant discovery pipeline',
    chip: null,
  },
  {
    id: 'compare',
    patterns: [/compare/i, /diff/i, /vs/i],
    action: cmdCompare,
    description: 'Compare last 2 test runs',
    chip: null,
  },
  {
    id: 'test_query',
    patterns: [/^test\s+"([^"]+)"/i, /^test\s+(.+)/i, /^try\s+"([^"]+)"/i, /^try\s+(.+)/i],
    action: cmdTestQuery,
    description: 'Test a specific query against the API',
    chip: null,
  },
  {
    id: 'export',
    patterns: [/export/i, /download/i, /share/i],
    action: cmdExport,
    description: 'Export comprehensive engine report to clipboard',
    chip: null,
  },
  {
    id: 'cost',
    patterns: [/cost/i, /spend/i, /budget/i, /billing/i],
    action: cmdCost,
    description: 'Show API cost summary',
    chip: null,
  },
  {
    id: 'report',
    patterns: [/report/i, /weekly/i, /summary/i, /digest/i],
    action: cmdReport,
    description: 'Generate weekly CEO report',
    chip: null,
  },
  {
    id: 'deploy',
    patterns: [/deploy/i, /ship/i, /push/i],
    action: cmdDeploy,
    description: 'Show deploy CLI command',
    chip: null,
  },
  {
    id: 'live',
    patterns: [/live\s*(feed|queries|production)/i, /recent.*queries/i],
    action: cmdLive,
    description: 'Show last 10 live production queries',
    chip: null,
  },
];

// ═══════════════════════════════════════════════════════════════════
// Terminal I/O
// ═══════════════════════════════════════════════════════════════════

/**
 * Write a line to the COO terminal output area.
 * @param {'system'|'info'|'success'|'warn'|'error'|'action'|'cli'} type
 * @param {string} msg
 */
function cooLog(type, msg) {
  const $out = document.getElementById('coo-output');
  if (!$out) return;

  if (type === 'cli') {
    const div = document.createElement('div');
    div.className = 'mc-cli-block';
    div.innerHTML =
      `<code>${escapeHtml(msg)}</code>` +
      `<button class="mc-cli-copy" onclick="cooCopyToClipboard(this.previousElementSibling.textContent)">Copy</button>`;
    $out.appendChild(div);
  } else {
    const prefixes = {
      system: '>',
      info: '',
      success: '\u2713',
      warn: '\u26A0',
      error: '\u2717',
      action: '\u25B6',
    };
    const div = document.createElement('div');
    div.className = `mc-coo-line mc-coo-line--${type}`;
    div.textContent = `${prefixes[type] || ''} ${msg}`;
    $out.appendChild(div);
  }

  $out.scrollTop = $out.scrollHeight;

  // Increment badge if drawer is closed
  const drawer = document.getElementById('mc-drawer');
  if (drawer && !drawer.classList.contains('mc-drawer--open')) {
    const badge = document.getElementById('mc-drawer-badge');
    if (badge) {
      const count = (parseInt(badge.textContent) || 0) + 1;
      badge.textContent = count;
      badge.style.display = '';
    }
  }
}

/**
 * Process raw text from the COO terminal input.
 * Matches against command patterns (first match wins) or falls back to query test.
 */
function processCOOInput(raw) {
  const input = raw.trim();
  if (!input) return;

  // Auto-open terminal so output is visible
  if (typeof openDrawerForTest === 'function') openDrawerForTest();

  // Maintain command history
  if (!state.cooHistory) state.cooHistory = [];
  state.cooHistory.push(input);
  state.cooHistoryIdx = state.cooHistory.length;

  // Echo the command
  cooLog('system', input);

  // Match against command patterns (first match wins)
  for (const cmd of COO_COMMANDS) {
    for (const pattern of cmd.patterns) {
      const match = input.match(pattern);
      if (match) {
        cmd.action(input, match);
        return;
      }
    }
  }

  // Fallback: if > 5 chars, treat as test query
  if (input.length > 5) {
    cooLog('info', 'No command matched. Testing as a query...');
    cmdTestQuery(input, [null, input]);
  } else {
    cooLog('warn', 'Unknown command. Type "help" for available commands.');
  }
}

// ═══════════════════════════════════════════════════════════════════
// Terminal Init
// ═══════════════════════════════════════════════════════════════════

/**
 * Wire up the COO terminal: input handling, keyboard shortcuts, quick chips.
 */
function initCOOTerminal() {
  const $input = document.getElementById('coo-input');
  if (!$input) return;

  $input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      const $sug = document.getElementById('coo-suggestions');
      if ($sug) $sug.style.display = 'none';
      processCOOInput($input.value);
      $input.value = '';
    }

    if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (!state.cooHistory || !state.cooHistory.length) return;
      if (state.cooHistoryIdx > 0) state.cooHistoryIdx--;
      $input.value = state.cooHistory[state.cooHistoryIdx] || '';
    }

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (!state.cooHistory || !state.cooHistory.length) return;
      if (state.cooHistoryIdx < state.cooHistory.length - 1) {
        state.cooHistoryIdx++;
        $input.value = state.cooHistory[state.cooHistoryIdx] || '';
      } else {
        state.cooHistoryIdx = state.cooHistory.length;
        $input.value = '';
      }
    }
  });

  $input.addEventListener('input', () => {
    showCOOSuggestions($input.value);
  });

  $input.addEventListener('blur', () => {
    // Delay hiding so click events on suggestions can fire
    setTimeout(() => {
      const $sug = document.getElementById('coo-suggestions');
      if ($sug) $sug.style.display = 'none';
    }, 150);
  });

  // Quick-action chips
  document.querySelectorAll('[data-coo-cmd]').forEach((chip) => {
    chip.addEventListener('click', () => processCOOInput(chip.dataset.cooCmd));
  });

  // Keyboard shortcuts: / to focus, Escape to blur
  document.addEventListener('keydown', (e) => {
    if (e.key === '/' && document.activeElement !== $input) {
      e.preventDefault();
      $input.focus();
    }
    if (e.key === 'Escape' && document.activeElement === $input) {
      $input.value = '';
      $input.blur();
    }
  });
}

// ═══════════════════════════════════════════════════════════════════
// Auto-Briefing
// ═══════════════════════════════════════════════════════════════════

/**
 * Compute a letter grade from a gauntlet run's composite metrics.
 * Weighted: 40% DondeMatch, 30% Score Fit, 30% Blurb Quality.
 */
function computeEngineGrade(run) {
  if (!run) return '--';
  const avgDm = Number(run.avg_dm) || 0;
  const avgFit = Number(run.avg_score_fit) || 0;
  const avgBlurb = Number(run.avg_blurb_quality) || 0;
  const score = avgDm * 0.4 + avgFit * 0.3 + avgBlurb * 0.3;
  if (score >= 97) return 'A+';
  if (score >= 93) return 'A';
  if (score >= 90) return 'A-';
  if (score >= 87) return 'B+';
  if (score >= 83) return 'B';
  if (score >= 80) return 'B-';
  if (score >= 77) return 'C+';
  if (score >= 73) return 'C';
  if (score >= 70) return 'C-';
  if (score >= 60) return 'D';
  return 'F';
}

/**
 * Print an auto-briefing to the COO terminal on dashboard load.
 * Shows engine grade, pass rate, open issues, and last run age.
 */
function cooBriefing() {
  const run = state.latestRun;
  const hour = new Date().getHours();
  const greeting =
    hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';

  if (!run) {
    cooLog(
      'info',
      `${greeting}. No test data yet. Type "scan" to run your first quality check.`
    );
    return;
  }

  const avgDm = Math.round(Number(run.avg_dm) || 0);
  const passCount = run.grade_pass_count || run.passed_60 || 0;
  const total = run.total || 1;
  const passRate = Math.round((passCount / total) * 100);
  const gapCount = run.gap_count || 0;
  const grade = computeEngineGrade(run);

  cooLog('info', `${greeting}. Engine at ${grade} (DM ${avgDm}, ${passRate}% pass).`);

  if (gapCount > 0) {
    cooLog('warn', `${gapCount} issue${gapCount > 1 ? 's' : ''} need attention.`);
    cooLog('info', 'Type "issues" to see details, or "fix" to generate a fix command.');
  } else {
    cooLog('success', 'All systems green. No open issues.');
  }

  cooLog('info', `Last run: ${timeAgo(run.created_at)}. Type "scan" to run fresh.`);
}

// ═══════════════════════════════════════════════════════════════════
// Agent Status Panel
// ═══════════════════════════════════════════════════════════════════

/**
 * Render the full agent team organized by division with visual hierarchy.
 * Each agent card is clickable and opens a detail panel with skills, prompt, and CLI command.
 */
function renderAgentStatus() {
  var el = document.getElementById('mc-drawer-agents') || document.getElementById('mc-agents');
  if (!el) return;

  // SVG icon factory — 14x14 inline SVGs for crisp rendering
  function agentSvg(type) {
    var s = '<svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">';
    var icons = {
      coo:     s+'<circle cx="8" cy="5" r="3"/><path d="M2 15c0-3.3 2.7-6 6-6s6 2.7 6 6"/><path d="M8 2V0M5 3L3.5 1.5M11 3l1.5-1.5" stroke-width="1.2"/></svg>',
      chart:   s+'<path d="M2 14V8M6 14V4M10 14V9M14 14V2"/></svg>',
      bug:     s+'<ellipse cx="8" cy="9" rx="4" ry="5"/><path d="M8 4V2M4 7H1M12 7h3M3 12l-2 2M13 12l2 2M5 5L3 3M11 5l2-2"/></svg>',
      dice:    s+'<rect x="2" y="2" width="12" height="12" rx="2"/><circle cx="5" cy="5" r="1" fill="currentColor"/><circle cx="11" cy="11" r="1" fill="currentColor"/><circle cx="8" cy="8" r="1" fill="currentColor"/></svg>',
      check:   s+'<path d="M2 8.5l4 4 8-8"/></svg>',
      bolt:    s+'<path d="M9 1L4 9h4l-1 6 5-8H8l1-6"/></svg>',
      db:      s+'<ellipse cx="8" cy="4" rx="6" ry="3"/><path d="M2 4v4c0 1.7 2.7 3 6 3s6-1.3 6-3V4"/><path d="M2 8v4c0 1.7 2.7 3 6 3s6-1.3 6-3V8"/></svg>',
      doc:     s+'<path d="M4 2h5l4 4v8a1 1 0 01-1 1H4a1 1 0 01-1-1V3a1 1 0 011-1z"/><path d="M9 2v4h4M6 9h4M6 12h2"/></svg>',
      radar:   s+'<circle cx="8" cy="8" r="6"/><circle cx="8" cy="8" r="2"/><path d="M8 2v4M14 8h-4"/></svg>',
      crown:   s+'<path d="M2 12l2-7 3 4 1-7 1 7 3-4 2 7z"/><path d="M2 12h12"/></svg>',
      gem:     s+'<path d="M3 6l5-4 5 4-5 9z"/><path d="M3 6h10"/><path d="M8 2l-2 4 2 9 2-9-2-4"/></svg>',
      shield:  s+'<path d="M8 1L2 4v4c0 4 3 7 6 8 3-1 6-4 6-8V4z"/></svg>',
      search:  s+'<circle cx="7" cy="7" r="5"/><path d="M11 11l3 3"/></svg>',
      build:   s+'<path d="M4 14V8h8v6"/><path d="M2 8l6-6 6 6"/></svg>',
      wrench:  s+'<path d="M5.5 2A4.5 4.5 0 009 8l5 5-2 2-5-5a4.5 4.5 0 01-1.5-8z"/></svg>',
      palette: s+'<circle cx="8" cy="8" r="6"/><circle cx="6" cy="6" r="1" fill="currentColor"/><circle cx="10" cy="6" r="1" fill="currentColor"/><circle cx="6" cy="10" r="1" fill="currentColor"/></svg>',
      cal:     s+'<rect x="2" y="3" width="12" height="11" rx="1"/><path d="M5 1v3M11 1v3M2 7h12"/></svg>',
      card:    s+'<rect x="1" y="4" width="14" height="9" rx="1"/><path d="M1 7h14"/></svg>',
      map:     s+'<path d="M1 3l5 2v10l-5-2z"/><path d="M6 5l5-2v10l-5 2z"/><path d="M11 3l4-1v10l-4 1z"/></svg>',
      phone:   s+'<rect x="4" y="1" width="8" height="14" rx="1.5"/><path d="M7 12h2"/></svg>',
      spring:  s+'<path d="M4 2c4 0 4 3 0 3s-4 3 0 3 4 3 0 3 4 3 0 3"/><path d="M12 2v12"/></svg>',
      globe:   s+'<circle cx="8" cy="8" r="6"/><path d="M2 8h12"/><path d="M8 2c2.5 2 2.5 10 0 12M8 2c-2.5 2-2.5 10 0 12"/></svg>',
      group:   s+'<circle cx="5" cy="5" r="2.5"/><circle cx="11" cy="5" r="2.5"/><path d="M1 14c0-2.5 2-4.5 4-4.5s4 2 4 4.5"/><path d="M8 14c0-2.5 2-4.5 4-4.5s4 2 4 4.5"/></svg>',
      brain:   s+'<path d="M8 14V8"/><path d="M5 8c-2 0-3-1.5-3-3s1.5-3 3-3c0-1 1-2 3-2s3 1 3 2c1.5 0 3 1.5 3 3s-1 3-3 3"/><path d="M5 8c-1.5 1-2 3-2 4h10c0-1-.5-3-2-4"/></svg>',
      trophy:  s+'<path d="M5 2h6v5c0 2-1.5 3-3 3s-3-1-3-3z"/><path d="M5 3H3c0 2 1 3 2 3"/><path d="M11 3h2c0 2-1 3-2 3"/><path d="M8 10v2M5 12h6"/></svg>',
      sparkle: s+'<path d="M8 1l1.5 4.5L14 7l-4.5 1.5L8 13l-1.5-4.5L2 7l4.5-1.5z"/></svg>',
      a11y:    s+'<circle cx="8" cy="3" r="2"/><path d="M8 6v4"/><path d="M4 7h8"/><path d="M6 14l2-4 2 4"/></svg>',
      story:   s+'<path d="M2 2h5v12H2z"/><path d="M7 2h5v12H7z"/><path d="M12 4h2v8h-2"/><path d="M4 5h1M4 7h1M4 9h1"/></svg>',
      mic:     s+'<rect x="5" y="1" width="6" height="8" rx="3"/><path d="M3 8c0 3 2.5 5 5 5s5-2 5-5"/><path d="M8 13v2"/></svg>',
      star:    s+'<path d="M8 1l2 5h5l-4 3.5 1.5 5L8 11.5 3.5 14.5 5 9.5 1 6h5z"/></svg>',
    };
    return icons[type] || icons.check;
  }

  var AGENT_TEAM = {
    'COO': {
      agents: [{
        id: 'donde-coo', name: 'COO', iconType: 'coo',
        role: 'Chief Operating Officer',
        skills: ['Multi-agent orchestration', 'Quality cycles', 'Cross-division coordination', 'CEO briefings'],
        trigger: 'Auto on significant changes',
        defaultPrompt: 'Run a full quality cycle across all divisions and report findings to CEO'
      }],
      color: 'var(--cc-accent)'
    },
    'Quality': {
      agents: [
        { id: 'analytics-expert', name: 'Analytics', iconType: 'chart', role: 'Chief Analytics Officer', skills: ['Engine benchmarking', 'Quick-win implementation', 'Scoring optimization', 'Golden dataset analysis'], trigger: 'Manual or auto on scoring changes', defaultPrompt: 'Benchmark the scoring engine, run golden tests, and implement any quick-wins found' },
        { id: 'bug-fixer', name: 'Bug Fixer', iconType: 'bug', role: 'Post-test bug fixer', skills: ['Root cause analysis', 'Scoring/blurb/grading fixes', 'Grouped issue resolution', 'Regression prevention'], trigger: 'Auto after test failures', defaultPrompt: 'Analyze the latest test results, root-cause every FAIL/WARN, and implement targeted fixes' },
        { id: 'gen-test-queries', name: 'Test Gen', iconType: 'dice', role: 'Test query generator', skills: ['Persona-driven queries', 'Demographic diversity', 'Edge case generation', 'Cultural coverage'], trigger: 'Manual', defaultPrompt: 'Generate 10 diverse persona-driven test queries covering different demographics and occasions' },
        { id: 'continuous-tester', name: 'Tester', iconType: 'check', role: 'Automated test runner', skills: ['Golden dataset testing', 'Regression guard', 'Result persistence', 'Auto bug-fixer spawn'], trigger: 'After deploys', defaultPrompt: 'Run the golden dataset test and regression guard, then report results' },
        { id: 'subjective-engine-tester', name: 'Subjective', iconType: 'search', role: 'Subjective quality auditor', skills: ['Ground-truth testing', 'Expert consensus comparison', 'Multi-round testing', 'Root cause analysis'], trigger: 'Manual', defaultPrompt: 'Run 25 diverse ground-truth queries, compare against expert consensus, identify failures, and implement fixes' }
      ],
      color: 'var(--cc-green)'
    },
    'Infrastructure': {
      agents: [
        { id: 'perf-optimizer', name: 'Perf', iconType: 'bolt', role: 'Response time optimizer', skills: ['Latency profiling', 'Timeout prevention', 'Bottleneck identification', 'Safe optimizations'], trigger: 'Manual or auto on latency', defaultPrompt: 'Profile the recommendation engine latency, identify bottlenecks, and implement safe optimizations' },
        { id: 'db-reviewer', name: 'DB Review', iconType: 'db', role: 'Database quality auditor', skills: ['Data accuracy audit', 'Freshness checks', 'Cross-field consistency', 'Enrichment planning'], trigger: 'Manual or auto after enrichment', defaultPrompt: 'Audit all restaurants for data accuracy, freshness, and completeness. Deliver prioritized enrichment plan' },
        { id: 'update-docs', name: 'Docs', iconType: 'doc', role: 'Documentation updater', skills: ['Codebase scanning', 'CLAUDE.md updates', 'Architecture docs', 'API documentation'], trigger: 'Auto on significant changes', defaultPrompt: 'Scan the codebase for changes and update all documentation files to reflect current state' },
        { id: 'prod-sentinel', name: 'Sentinel', iconType: 'radar', role: 'Production monitor', skills: ['Error rate monitoring', 'Cache health checks', 'Response time tracking', 'Anomaly detection'], trigger: 'Scheduled or manual', defaultPrompt: 'Check production error rates, cache hit ratios, and response times. Flag any anomalies' }
      ],
      color: 'var(--cc-blue)'
    },
    'Product': {
      agents: [
        { id: 'ceo-advisor', name: 'CEO Advisor', iconType: 'crown', role: 'Strategic product advisor', skills: ['Board-level strategy', 'Prioritized recommendations', 'Competitive analysis', 'Growth opportunities'], trigger: 'Manual', defaultPrompt: 'Provide top 10 prioritized strategic recommendations for DondeAI product growth' },
        { id: 'donde-premium-advisor', name: 'Premium', iconType: 'gem', role: 'Premium app advisor', skills: ['$50B caliber assessment', 'UI/UX polish audit', 'Marketing psychology', 'Premium feature design'], trigger: 'Manual', defaultPrompt: 'Audit DondeAI as a premium product. Deliver concrete recommendations across UI/UX, backend, and marketing' }
      ],
      color: 'var(--cc-amber)'
    },
    'Security': {
      agents: [
        { id: 'donde-ciso', name: 'CISO', iconType: 'shield', role: 'Chief Information Security Officer', skills: ['Vulnerability scanning', 'API exposure audit', 'Auth gap detection', 'Supply chain review'], trigger: 'Manual or auto on security changes', defaultPrompt: 'Run a full security audit across all repositories. Deliver severity-ranked findings with remediation plan' }
      ],
      color: 'var(--cc-red)'
    },
    'Frontend': {
      agents: [
        { id: 'uat-tester', name: 'UAT', iconType: 'search', role: 'UAT browser tester', skills: ['Playwright automation', 'Bug detection', 'UX audit', 'Accessibility testing'], trigger: 'Manual', defaultPrompt: 'Run a comprehensive UAT of donde.lat covering core journey, edge cases, accessibility, and mobile responsiveness' },
        { id: 'frontend-builder', name: 'Builder', iconType: 'build', role: 'Component engineer', skills: ['Component architecture', 'Design system compliance', 'Performance optimization', 'Animation engineering'], trigger: 'Manual', defaultPrompt: 'Build the requested frontend component following the DondeAI design system and coding standards' },
        { id: 'frontend-fixer', name: 'Fixer', iconType: 'wrench', role: 'UI bug remediation', skills: ['CSS debugging', 'Layout fixes', 'Cross-browser issues', 'Responsive design'], trigger: 'Manual', defaultPrompt: 'Fix the reported UI bugs in the frontend application' },
        { id: 'css-theme-specialist', name: 'Themes', iconType: 'palette', role: 'Theme variant designer', skills: ['10 theme variants', 'Color system design', 'Dark/light modes', 'Seasonal themes'], trigger: 'Manual', defaultPrompt: 'Design and implement a new theme variant for the DondeAI app' }
      ],
      color: '#a855f7'
    },
    'Integrations': {
      agents: [
        { id: 'reservation-integration-specialist', name: 'Reservations', iconType: 'cal', role: 'Reservation API specialist', skills: ['Resy/OpenTable/Tock APIs', 'Deep link generation', 'Affiliate integration', '$0 implementation'], trigger: 'Manual', defaultPrompt: 'Design the reservation integration strategy using Resy, OpenTable, and Tock APIs with $0 deep links' },
        { id: 'payments-ordering-specialist', name: 'Payments', iconType: 'card', role: 'Ordering/payment specialist', skills: ['Toast/DoorDash APIs', 'UberEats integration', 'Square payments', 'Order flow design'], trigger: 'Manual', defaultPrompt: 'Design the ordering and payment integration with Toast, DoorDash, and UberEats APIs' },
        { id: 'maps-location-specialist', name: 'Maps', iconType: 'map', role: 'Mapping/location specialist', skills: ['Google Maps optimization', 'Mapbox integration', 'Cost analysis', 'Location features'], trigger: 'Manual', defaultPrompt: 'Optimize mapping integration costs and design enhanced location features' },
        { id: 'social-reviews-specialist', name: 'Social', iconType: 'phone', role: 'Social/review specialist', skills: ['Yelp Fusion API', 'Instagram integration', 'Trending detection', 'Social proof features'], trigger: 'Manual', defaultPrompt: 'Design social proof and trending detection features using Yelp, Instagram, and TikTok APIs' }
      ],
      color: 'var(--cc-live)'
    },
    'R&I': {
      agents: [
        { id: 'motion-physics-designer', name: 'Motion', iconType: 'spring', role: 'Motion & Physics Design', skills: ['Spring physics', 'Gesture interactions', 'Haptic feedback', 'Choreographed motion'], trigger: 'Manual', defaultPrompt: 'Design spring physics animations and gesture interactions for DondeAI mobile experience' },
        { id: 'spatial-map-innovator', name: 'Spatial', iconType: 'globe', role: 'Spatial & Map Innovation', skills: ['AR wayfinding', 'Neighborhood exploration', 'Spatial discovery', 'Map interactions'], trigger: 'Manual', defaultPrompt: 'Design revolutionary map interactions and spatial restaurant discovery features' },
        { id: 'social-community-designer', name: 'Social', iconType: 'group', role: 'Social & Community Design', skills: ['Food circles', 'Shared lists', 'Dining streaks', 'Community discovery'], trigger: 'Manual', defaultPrompt: 'Design social dining features including food circles, shared lists, and dining streaks' },
        { id: 'personalization-ai-architect', name: 'AI Personalize', iconType: 'brain', role: 'Personalization & AI', skills: ['Taste fingerprints', 'Mood discovery', 'Learning loops', 'Hyper-personalization'], trigger: 'Manual', defaultPrompt: 'Design taste fingerprint engine and mood-based restaurant discovery for personalization' },
        { id: 'gamification-engagement-designer', name: 'Gamification', iconType: 'trophy', role: 'Gamification & Engagement', skills: ['Dining challenges', 'Explorer badges', 'Streak mechanics', 'Progression systems'], trigger: 'Manual', defaultPrompt: 'Design gamification mechanics including dining challenges, badges, and progression systems' },
        { id: 'micro-interaction-designer', name: 'Micro UX', iconType: 'sparkle', role: 'Micro-Interactions & Delight', skills: ['Easter eggs', 'Celebrations', 'Tactile feedback', 'Surprise moments'], trigger: 'Manual', defaultPrompt: 'Design micro-interactions, easter eggs, and celebratory animations that delight users' },
        { id: 'accessibility-inclusivity-lead', name: 'A11y', iconType: 'a11y', role: 'Accessibility & Inclusivity', skills: ['WCAG 2.2 compliance', 'Cultural sensitivity', 'Language inclusivity', 'Screen reader optimization'], trigger: 'Manual', defaultPrompt: 'Audit DondeAI for accessibility compliance and cultural inclusivity across all user segments' },
        { id: 'data-storytelling-designer', name: 'Data Story', iconType: 'story', role: 'Data Visualization & Storytelling', skills: ['Dining Wrapped', 'Taste maps', 'Year-in-review', 'Data narratives'], trigger: 'Manual', defaultPrompt: 'Design data storytelling features like Dining Wrapped, personal taste maps, and year-in-review' },
        { id: 'voice-conversational-designer', name: 'Voice', iconType: 'mic', role: 'Voice & Conversational UX', skills: ['Voice search', 'Conversational UI', 'Natural language refinement', 'Audio interactions'], trigger: 'Manual', defaultPrompt: 'Design voice-first dining discovery and conversational recommendation flows' },
        { id: 'premium-experience-architect', name: 'Premium XP', iconType: 'star', role: 'Premium & Luxury Experience', skills: ['VIP tiers', 'Concierge features', 'Exclusive access', 'White-glove quality'], trigger: 'Manual', defaultPrompt: 'Design premium VIP experience with concierge-level features and exclusive restaurant access' }
      ],
      color: '#f472b6'
    }
  };

  var html = '';

  // COO at the top (special treatment)
  var coo = AGENT_TEAM['COO'].agents[0];
  html += '<div class="mc-agent-coo mc-clickable" onclick="showAgentDetail(\'' + coo.id + '\')" title="' + coo.role + '">' +
    '<span class="mc-agent-coo__icon">' + agentSvg(coo.iconType) + '</span>' +
    '<span class="mc-agent-coo__name">' + coo.name + '</span>' +
    '<span class="mc-agent-coo__role">' + coo.role + '</span>' +
  '</div>';

  // Division groups
  var divOrder = ['Quality', 'Infrastructure', 'Frontend', 'Product', 'Security', 'Integrations', 'R&I'];
  divOrder.forEach(function(divName) {
    var div = AGENT_TEAM[divName];
    if (!div) return;
    html += '<div class="mc-agent-div">';
    html += '<div class="mc-agent-div__header" style="border-left-color:' + div.color + '">' + divName + '</div>';
    html += '<div class="mc-agent-div__grid">';
    div.agents.forEach(function(a) {
      html += '<div class="mc-agent-card mc-clickable" onclick="showAgentDetail(\'' + a.id + '\')" title="' + a.role + '">' +
        '<span class="mc-agent-card__icon">' + agentSvg(a.iconType) + '</span>' +
        '<span class="mc-agent-card__name">' + a.name + '</span>' +
      '</div>';
    });
    html += '</div></div>';
  });

  el.innerHTML = html;

  // Store team data globally for detail panel
  window._agentTeam = AGENT_TEAM;
}

// ═══════════════════════════════════════════════════════════════════
// Command Handlers — Test Runners
// ═══════════════════════════════════════════════════════════════════

function cmdScan() {
  if (typeof showTestConfirm === 'function') {
    showTestConfirm('broad');
  } else {
    startTest('broad');
  }
}

function cmdRegression() {
  if (typeof showTestConfirm === 'function') {
    showTestConfirm('regression');
  } else {
    startTest('regression');
  }
}

function cmdCategory(input, match) {
  const cat = (match[1] || '').toLowerCase();
  const validCats = ['food', 'vibe', 'service', 'rep', 'conv'];
  if (!validCats.includes(cat)) {
    cooLog('warn', `Invalid category "${cat}". Valid: ${validCats.join(', ')}`);
    return;
  }
  if (typeof showTestConfirm === 'function') {
    showTestConfirm('category', cat);
  } else {
    state.selectedCategories = [cat];
    startTest('category');
  }
}

function cmdEdge() {
  if (typeof showTestConfirm === 'function') {
    showTestConfirm('edge');
  } else {
    startTest('edge');
  }
}

// ═══════════════════════════════════════════════════════════════════
// Command Handlers — Status & Issues
// ═══════════════════════════════════════════════════════════════════

function cmdStatus() {
  const run = state.latestRun;
  if (!run) {
    cooLog('warn', 'No test data available. Run "scan" first.');
    return;
  }

  const avgDm = Math.round(Number(run.avg_dm) || 0);
  const avgFit = Math.round(Number(run.avg_score_fit) || 0);
  const avgBlurb = Math.round(Number(run.avg_blurb_quality) || 0);
  const passCount = run.grade_pass_count || run.passed_60 || 0;
  const total = run.total || 1;
  const passRate = Math.round((passCount / total) * 100);
  const grade = computeEngineGrade(run);

  const issues = (state.issues || []).filter(
    (i) => !i.status || i.status === 'open'
  );
  const critCount = issues.filter((i) => i.gap_severity === 'P0').length;

  cooLog('info', `Engine: ${grade} (${Math.round(avgDm * 0.4 + avgFit * 0.3 + avgBlurb * 0.3)})`);
  cooLog('info', `DondeMatch: ${avgDm} | Score Fit: ${avgFit} | Blurb: ${avgBlurb}`);
  cooLog('info', `Pass Rate: ${passRate}% (${passCount}/${total})`);
  cooLog(
    issues.length > 0 ? 'warn' : 'success',
    `Open Issues: ${issues.length}${critCount > 0 ? ` (${critCount} critical)` : ''}`
  );
  cooLog('info', `Last run: ${timeAgo(run.created_at)}`);
}

function cmdIssues() {
  const issues = (state.issues || []).filter(
    (i) => !i.status || i.status === 'open'
  );

  if (!issues.length) {
    cooLog('success', 'No open issues. Engine is clean.');
    return;
  }

  cooLog('info', `── Open Issues (${issues.length}) ──`);

  // Sort by severity: P0 first, then P1, P2, etc.
  const sorted = [...issues].sort((a, b) => {
    const sevA = (a.gap_severity || 'P9').replace('P', '');
    const sevB = (b.gap_severity || 'P9').replace('P', '');
    return Number(sevA) - Number(sevB);
  });

  const top = sorted.slice(0, 10);
  top.forEach((issue) => {
    const sev = issue.gap_severity || '??';
    const query = issue.query || issue.special_request || 'unknown';
    const dm = issue.donde_match || 0;
    const gap = issue.gap_type || '';
    const type = sev === 'P0' ? 'error' : sev === 'P1' ? 'warn' : 'info';
    cooLog(type, `${sev}: "${query}" \u2014 DM ${dm}${gap ? ', gap: ' + gap : ''}`);
  });

  if (sorted.length > 10) {
    cooLog('info', `... and ${sorted.length - 10} more. Fix the top issues first.`);
  }
}

// ═══════════════════════════════════════════════════════════════════
// Command Handlers — Agent CLI Generators
// ═══════════════════════════════════════════════════════════════════

function cmdFix() {
  const issues = (state.issues || []).filter(
    (i) => !i.status || i.status === 'open'
  );
  const count = issues.length;

  if (count === 0) {
    cooLog('success', 'No issues to fix. Engine is clean.');
    return;
  }

  cooLog('info', `${count} open issue${count > 1 ? 's' : ''}. Generating fix command...`);
  const cliCmd =
    'claude --agent bug-fixer --prompt "Fix scoring gaps from latest test run"';
  cooLog('cli', cliCmd);
  cooLog('info', 'Copy and paste this into your terminal to start the bug-fixer agent.');
}

function cmdSecurity() {
  cooLog('info', 'Generating security audit command...');
  const cliCmd =
    'claude --agent donde-ciso --prompt "Run full security audit"';
  cooLog('cli', cliCmd);
  cooLog('info', 'Copy and paste this into your terminal to start the CISO agent.');
}

function cmdCOO() {
  cooLog('info', 'Generating COO briefing command...');
  const cliCmd =
    'claude --agent donde-coo --prompt "Run quality cycle and generate CEO briefing"';
  cooLog('cli', cliCmd);
  cooLog('info', 'Copy and paste this into your terminal to start the COO agent.');
}

function cmdDeploy() {
  cooLog('info', 'Generating deploy command...');
  cooLog('cli', 'supabase functions deploy recommend');
  cooLog('info', 'This deploys the recommend Edge Function to production.');
  cooLog('warn', 'Make sure you have run a regression guard first: type "regression".');
}

// ═══════════════════════════════════════════════════════════════════
// Command Handlers — Cache
// ═══════════════════════════════════════════════════════════════════

async function cmdCache(input) {
  if (input.match(/warm/i)) {
    cooLog('action', 'Dispatching cache warmer...');
    await triggerPipeline('cache_warm');
    return;
  }

  // Show cache dashboard via RPC
  if (!sbClient) {
    cooLog('warn', 'No Supabase connection. Authenticate first.');
    return;
  }

  try {
    cooLog('action', 'Fetching cache dashboard...');
    const { data, error } = await sbClient.rpc('get_cache_dashboard');
    if (error) throw error;

    if (data) {
      cooLog('info', '── Cache Dashboard ──');
      cooLog('info', `Cache entries: ${data.cache_size || 0}`);
      cooLog(
        'info',
        `24h hit rate: ${Math.round((data.hit_rate_24h || 0) * 100)}%`
      );
      cooLog('info', `Savings: $${(data.savings_24h_dollars || 0).toFixed(2)}`);
      if (data.oldest_entry) {
        cooLog('info', `Oldest entry: ${timeAgo(data.oldest_entry)}`);
      }
      if (data.avg_ttl_hours) {
        cooLog('info', `Avg TTL remaining: ${Math.round(data.avg_ttl_hours)}h`);
      }
    } else {
      cooLog('info', 'Cache dashboard returned no data.');
    }
  } catch (e) {
    cooLog('error', `Cache fetch failed: ${e.message}`);
  }
}

// ═══════════════════════════════════════════════════════════════════
// Command Handlers — Database Health
// ═══════════════════════════════════════════════════════════════════

async function cmdDb() {
  if (!sbClient) {
    cooLog('warn', 'No Supabase connection. Authenticate first.');
    return;
  }

  try {
    cooLog('action', 'Querying database health...');
    const [activeRes, enrichedRes, riRes] = await Promise.all([
      sbClient
        .from('restaurants')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'active'),
      sbClient
        .from('restaurant_deep_profiles')
        .select('*', { count: 'exact', head: true }),
      sbClient
        .from('review_intelligence')
        .select('*', { count: 'exact', head: true }),
    ]);

    const active = activeRes.count || 0;
    const enriched = enrichedRes.count || 0;
    const ri = riRes.count || 0;

    cooLog('info', '── Database Health ──');
    cooLog('info', `Active restaurants: ${active}`);
    cooLog('info', `Deep profiles: ${enriched}`);
    cooLog('info', `Review intelligence: ${ri}`);
    cooLog(
      'info',
      `Profile coverage: ${active > 0 ? Math.round((enriched / active) * 100) : 0}%`
    );
    cooLog(
      'info',
      `RI coverage: ${active > 0 ? Math.round((ri / active) * 100) : 0}%`
    );

    if (enriched < active) {
      const gap = active - enriched;
      cooLog('warn', `${gap} restaurant${gap > 1 ? 's' : ''} missing deep profiles.`);
    } else {
      cooLog('success', 'All restaurants have deep profiles.');
    }
  } catch (e) {
    cooLog('error', `DB query failed: ${e.message}`);
  }
}

// ═══════════════════════════════════════════════════════════════════
// Command Handlers — Discovery
// ═══════════════════════════════════════════════════════════════════

async function cmdDiscovery() {
  cooLog('action', 'Queuing restaurant discovery pipeline...');
  await triggerPipeline('discovery');
}

// ═══════════════════════════════════════════════════════════════════
// Command Handlers — Compare Runs
// ═══════════════════════════════════════════════════════════════════

async function cmdCompare() {
  if (!state.runHistory || state.runHistory.length < 2) {
    cooLog('warn', 'Need at least 2 runs to compare. Run more tests first.');
    return;
  }

  const [a, b] = [state.runHistory[0], state.runHistory[1]];
  const aDm = Math.round(Number(a.avg_dm) || 0);
  const bDm = Math.round(Number(b.avg_dm) || 0);
  const aFit = Math.round(Number(a.avg_score_fit) || 0);
  const bFit = Math.round(Number(b.avg_score_fit) || 0);
  const aBlurb = Math.round(Number(a.avg_blurb_quality) || 0);
  const bBlurb = Math.round(Number(b.avg_blurb_quality) || 0);
  const dDm = aDm - bDm;
  const dFit = aFit - bFit;
  const dBlurb = aBlurb - bBlurb;

  const fmtDelta = (d) => (d >= 0 ? '+' + d : String(d));

  cooLog('info', '── Run Comparison ──');
  cooLog('info', `Comparing: ${timeAgo(a.created_at)} vs ${timeAgo(b.created_at)}`);
  cooLog('info', `DM: ${aDm} \u2192 ${bDm} (${fmtDelta(dDm)})`);
  cooLog('info', `Score Fit: ${aFit} \u2192 ${bFit} (${fmtDelta(dFit)})`);
  cooLog('info', `Blurb: ${aBlurb} \u2192 ${bBlurb} (${fmtDelta(dBlurb)})`);

  // Overall verdict
  const totalDelta = dDm + dFit + dBlurb;
  if (totalDelta > 0) {
    cooLog('success', 'Latest run improved overall.');
  } else if (totalDelta < 0) {
    cooLog('warn', 'Latest run regressed. Consider investigating.');
  } else {
    cooLog('info', 'Runs are equivalent.');
  }

  // Load per-query results for both runs and show detailed diff
  cooLog('action', 'Loading per-query results for diff view...');
  try {
    const [aResults, bResults] = await Promise.all([
      loadRunResults(a.run_id),
      loadRunResults(b.run_id),
    ]);

    if (!aResults.length && !bResults.length) {
      cooLog('warn', 'No per-query results available for detailed diff.');
      return;
    }

    // Build lookup maps by query text
    const aMap = {};
    aResults.forEach(function(r) { aMap[r.query] = r; });
    const bMap = {};
    bResults.forEach(function(r) { bMap[r.query] = r; });
    const allQueries = new Set([...Object.keys(aMap), ...Object.keys(bMap)]);

    const improved = [];
    const regressed = [];
    const unchanged = [];
    const newInLatest = [];
    const removedFromLatest = [];

    allQueries.forEach(function(q) {
      const inA = aMap[q];
      const inB = bMap[q];
      if (inA && inB) {
        const delta = (inA.donde_match || 0) - (inB.donde_match || 0);
        if (delta > 0) {
          improved.push({ query: q, delta: delta, now: inA.donde_match || 0, was: inB.donde_match || 0, restaurant: inA.restaurant_name });
        } else if (delta < 0) {
          regressed.push({ query: q, delta: delta, now: inA.donde_match || 0, was: inB.donde_match || 0, restaurant: inA.restaurant_name });
        } else {
          unchanged.push({ query: q, dm: inA.donde_match || 0 });
        }
      } else if (inA && !inB) {
        newInLatest.push({ query: q, dm: inA.donde_match || 0, restaurant: inA.restaurant_name });
      } else {
        removedFromLatest.push({ query: q, dm: inB.donde_match || 0 });
      }
    });

    improved.sort(function(x, y) { return y.delta - x.delta; });
    regressed.sort(function(x, y) { return x.delta - y.delta; });

    // Terminal summary
    cooLog('info', `${improved.length} improved, ${regressed.length} regressed, ${unchanged.length} unchanged`);
    if (newInLatest.length > 0) cooLog('info', `${newInLatest.length} new queries in latest run`);
    if (removedFromLatest.length > 0) cooLog('info', `${removedFromLatest.length} queries removed from latest run`);

    // Build detail panel HTML
    let html = '<div class="mc-diff">';
    html += '<div class="mc-diff__summary" style="display:flex;gap:12px;margin-bottom:12px;font-size:13px">' +
      '<span style="color:var(--cc-green)">' + improved.length + ' improved</span> ' +
      '<span style="color:var(--cc-red)">' + regressed.length + ' regressed</span> ' +
      '<span style="color:var(--cc-text2)">' + unchanged.length + ' unchanged</span>' +
      '</div>';

    if (improved.length > 0) {
      html += '<h4 style="color:var(--cc-green);margin:12px 0 6px;font-size:12px;text-transform:uppercase;letter-spacing:0.5px">Improved (' + improved.length + ')</h4>';
      improved.forEach(function(item) {
        html += '<div class="mc-diff__item mc-diff__item--improved" style="display:flex;justify-content:space-between;align-items:center;padding:4px 8px;margin:2px 0;border-radius:4px;background:rgba(34,197,94,0.08);font-size:12px">' +
          '<span style="flex:1;color:var(--cc-text1)">"' + escapeHtml(item.query) + '"</span>' +
          '<span style="color:var(--cc-text2);margin:0 8px;font-size:11px">' + escapeHtml(item.restaurant || '') + '</span>' +
          '<span style="white-space:nowrap;font-size:11px;color:var(--cc-text2)">' + item.was + ' -> ' + item.now + '</span>' +
          '<span style="color:var(--cc-green);font-weight:600;min-width:36px;text-align:right">+' + item.delta + '</span>' +
          '</div>';
      });
    }

    if (regressed.length > 0) {
      html += '<h4 style="color:var(--cc-red);margin:12px 0 6px;font-size:12px;text-transform:uppercase;letter-spacing:0.5px">Regressed (' + regressed.length + ')</h4>';
      regressed.forEach(function(item) {
        html += '<div class="mc-diff__item mc-diff__item--regressed" style="display:flex;justify-content:space-between;align-items:center;padding:4px 8px;margin:2px 0;border-radius:4px;background:rgba(239,68,68,0.08);font-size:12px">' +
          '<span style="flex:1;color:var(--cc-text1)">"' + escapeHtml(item.query) + '"</span>' +
          '<span style="color:var(--cc-text2);margin:0 8px;font-size:11px">' + escapeHtml(item.restaurant || '') + '</span>' +
          '<span style="white-space:nowrap;font-size:11px;color:var(--cc-text2)">' + item.was + ' -> ' + item.now + '</span>' +
          '<span style="color:var(--cc-red);font-weight:600;min-width:36px;text-align:right">' + item.delta + '</span>' +
          '</div>';
      });
    }

    if (newInLatest.length > 0) {
      html += '<h4 style="color:var(--cc-blue);margin:12px 0 6px;font-size:12px;text-transform:uppercase;letter-spacing:0.5px">New in Latest (' + newInLatest.length + ')</h4>';
      newInLatest.forEach(function(item) {
        html += '<div class="mc-diff__item" style="display:flex;justify-content:space-between;align-items:center;padding:4px 8px;margin:2px 0;border-radius:4px;background:rgba(59,130,246,0.08);font-size:12px">' +
          '<span style="flex:1;color:var(--cc-text1)">"' + escapeHtml(item.query) + '"</span>' +
          '<span style="color:var(--cc-text2);margin:0 8px;font-size:11px">' + escapeHtml(item.restaurant || '') + '</span>' +
          '<span style="color:var(--cc-blue);font-weight:600;min-width:36px;text-align:right">DM ' + item.dm + '</span>' +
          '</div>';
      });
    }

    html += '</div>';

    if (typeof openDetail === 'function') {
      openDetail('Run Comparison: ' + timeAgo(b.created_at) + ' -> ' + timeAgo(a.created_at), html);
    }
  } catch (e) {
    cooLog('error', 'Failed to load per-query diff: ' + e.message);
  }
}

// ═══════════════════════════════════════════════════════════════════
// Command Handlers — Test Query
// ═══════════════════════════════════════════════════════════════════

async function cmdTestQuery(input, match) {
  // Extract query from match groups or raw input
  const query =
    (match && (match[1] || match[2])) ||
    input
      .replace(/^(test|try)\s+/i, '')
      .replace(/^["']|["']$/g, '')
      .trim();

  if (!query) {
    cooLog('warn', 'Usage: test "romantic Italian dinner"');
    return;
  }

  cooLog('action', `Testing: "${query}"...`);

  if (typeof callAPI !== 'function') {
    cooLog('error', 'API client not available. Is cc-config.js loaded?');
    return;
  }

  try {
    const resp = await callAPI(query);
    if (!resp.success) {
      cooLog('error', `API error: ${resp.recommendation || 'unknown'}`);
      return;
    }

    const dm = resp.donde_match || 0;
    const sv9 = resp.scoring_v9 || {};
    const name = resp.restaurant && resp.restaurant.name ? resp.restaurant.name : '?';

    // Compute grades if grading functions are available
    const fit =
      typeof computeScoreFitGrade === 'function'
        ? computeScoreFitGrade(query, resp)
        : null;
    const blurb =
      typeof computeBlurbQualityGrade === 'function'
        ? computeBlurbQualityGrade(query, resp)
        : null;

    const dmType = dm >= 70 ? 'success' : 'warn';
    let summary = `${name} \u2014 DM ${dm}`;
    if (fit) summary += ` | Fit: ${fit.grade}`;
    if (blurb) summary += ` | Blurb: ${blurb.grade}`;
    cooLog(dmType, summary);

    cooLog(
      'info',
      `Type: ${sv9.relevance_type || '-'} | ` +
        `F:${r1(sv9.food || 0)} V:${r1(sv9.vibe || 0)} ` +
        `S:${r1(sv9.service || 0)} R:${r1(sv9.reputation || 0)} ` +
        `C:${r1(sv9.convenience || 0)}`
    );

    // Show match narrative if available
    if (resp.match_narrative && resp.match_narrative.summary) {
      cooLog('info', resp.match_narrative.summary);
    }
  } catch (e) {
    cooLog('error', e.message);
  }
}

// ═══════════════════════════════════════════════════════════════════
// Command Handlers — Live Feed
// ═══════════════════════════════════════════════════════════════════

async function cmdLive() {
  if (!sbClient) {
    cooLog('warn', 'No Supabase connection. Authenticate first.');
    return;
  }

  try {
    cooLog('action', 'Fetching recent production queries...');
    const { data, error } = await sbClient
      .from('user_queries')
      .select('special_request,donde_match,created_at')
      .order('created_at', { ascending: false })
      .limit(10);

    if (error) throw error;

    if (!data || !data.length) {
      cooLog('info', 'No recent production queries.');
      return;
    }

    cooLog('info', '── Recent Production Queries ──');
    data.forEach((q) => {
      const dm = q.donde_match || 0;
      const type = dm >= 70 ? 'success' : 'warn';
      cooLog(type, `"${q.special_request}" \u2192 DM ${dm} (${timeAgo(q.created_at)})`);
    });
  } catch (e) {
    cooLog('error', `Live feed error: ${e.message}`);
  }
}

// ═══════════════════════════════════════════════════════════════════
// Command Handlers — Help & Clear
// ═══════════════════════════════════════════════════════════════════

function cmdHelp() {
  cooLog('info', '── Available Commands ──');
  cooLog('info', 'scan          Run broad quality scan (20 queries, $0)');
  cooLog('info', 'regression    Run regression guard (23 golden queries)');
  cooLog('info', 'test "query"  Test a specific query against the API');
  cooLog('info', 'test food     Run category-focused test');
  cooLog('info', 'status        Show current engine health & KPIs');
  cooLog('info', 'issues        List open quality issues');
  cooLog('info', 'compare       Compare last 2 test runs (with diff view)');
  cooLog('info', 'edge          Run edge case probes');
  cooLog('info', 'export        Export engine report to clipboard + print');
  cooLog('info', 'cost          Show API cost & budget summary');
  cooLog('info', 'report        Generate weekly CEO report (new window)');
  cooLog('info', 'fix           Generate bug-fixer CLI command');
  cooLog('info', 'security      Generate security audit CLI command');
  cooLog('info', 'coo briefing  Generate COO briefing CLI command');
  cooLog('info', 'cache         Show cache health metrics');
  cooLog('info', 'warm cache    Trigger cache warmer pipeline');
  cooLog('info', 'db health     Show database overview');
  cooLog('info', 'deploy        Show deploy command');
  cooLog('info', 'live feed     Show recent production queries');
  cooLog('info', 'clear         Clear terminal');
  cooLog('info', 'help          Show this message');
  cooLog('info', '');
  cooLog('info', 'Tip: / to focus terminal, \u2191\u2193 for history');
}

function cmdClear() {
  const $out = document.getElementById('coo-output');
  if ($out) $out.innerHTML = '';
}

// ═══════════════════════════════════════════════════════════════════
// Pipeline Trigger Helper
// ═══════════════════════════════════════════════════════════════════

/**
 * Insert a maintenance request into Supabase to trigger a pipeline.
 * The maintenance worker picks these up within ~5 minutes.
 */
async function triggerPipeline(operation) {
  if (!sbClient) {
    cooLog('error', 'No Supabase connection. Authenticate first.');
    return;
  }

  try {
    const { error } = await sbClient.from('maintenance_requests').insert({
      operation: operation,
      status: 'pending',
      config: {},
    });
    if (error) throw error;
    cooLog('success', `Pipeline "${operation}" queued. Worker picks up in ~5 min.`);
  } catch (e) {
    cooLog('error', `Pipeline trigger failed: ${e.message}`);
  }
}

// ═══════════════════════════════════════════════════════════════════
// Command Handlers — Export
// ═══════════════════════════════════════════════════════════════════

async function cmdExport() {
  const run = state.latestRun;
  if (!run) { cooLog('warn', 'No run data to export.'); return; }

  cooLog('action', 'Generating comprehensive report...');

  // Core metrics
  const avgDm = Math.round(Number(run.avg_dm) || 0);
  const avgFit = Math.round(Number(run.avg_score_fit) || 0);
  const avgBlurb = Math.round(Number(run.avg_blurb_quality) || 0);
  const passCount = run.grade_pass_count || run.passed_60 || 0;
  const total = run.total || 1;
  const passRate = Math.round(passCount / total * 100);
  const grade = computeEngineGrade(run);
  const composite = Math.round(avgDm * 0.4 + avgFit * 0.3 + avgBlurb * 0.3);
  const now = new Date();
  const dateStr = now.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
  const timeStr = now.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });

  // Delta from previous run
  let deltaSection = '';
  if (state.trendData && state.trendData.length >= 2) {
    const prev = state.trendData[1];
    const prevDm = Math.round(Number(prev.avg_dm) || 0);
    const prevFit = Math.round(Number(prev.avg_score_fit) || 0);
    const prevBlurb = Math.round(Number(prev.avg_blurb_quality) || 0);
    const fmtD = (d) => (d >= 0 ? '+' + d : String(d));
    deltaSection = [
      '',
      '## Delta from Previous Run',
      `- DondeMatch: ${fmtD(avgDm - prevDm)} (${prevDm} -> ${avgDm})`,
      `- Score Fit: ${fmtD(avgFit - prevFit)} (${prevFit} -> ${avgFit})`,
      `- Blurb Quality: ${fmtD(avgBlurb - prevBlurb)} (${prevBlurb} -> ${avgBlurb})`,
    ].join('\n');
  }

  // Top 3 improvements from trend comparison
  let improvementsSection = '';
  if (state.trendData && state.trendData.length >= 2) {
    const curr = state.trendData[0];
    const prev = state.trendData[1];
    try {
      const [currResults, prevResults] = await Promise.all([
        loadRunResults(curr.run_id),
        loadRunResults(prev.run_id),
      ]);
      const prevMap = {};
      prevResults.forEach(function(r) { prevMap[r.query] = r.donde_match || 0; });
      const improvements = currResults
        .filter(function(r) { return prevMap[r.query] !== undefined && (r.donde_match || 0) > prevMap[r.query]; })
        .map(function(r) { return { query: r.query, delta: (r.donde_match || 0) - prevMap[r.query], now: r.donde_match || 0 }; })
        .sort(function(a, b) { return b.delta - a.delta; })
        .slice(0, 3);
      if (improvements.length > 0) {
        improvementsSection = '\n## Top Improvements\n' +
          improvements.map(function(i, idx) { return (idx + 1) + '. "' + i.query + '" +' + i.delta + ' (now DM ' + i.now + ')'; }).join('\n');
      }
    } catch (_) {}
  }

  // Top 3 remaining issues
  let issuesSection = '';
  const openIssues = (state.issues || [])
    .filter(function(i) { return !i.status || i.status === 'open'; })
    .sort(function(a, b) {
      const sa = (a.gap_severity || 'P9').replace('P', '');
      const sb = (b.gap_severity || 'P9').replace('P', '');
      return Number(sa) - Number(sb);
    })
    .slice(0, 3);
  if (openIssues.length > 0) {
    issuesSection = '\n## Remaining Issues\n' +
      openIssues.map(function(i, idx) {
        return (idx + 1) + '. [' + (i.gap_severity || '??') + '] "' + (i.query || i.special_request || 'unknown') + '" - DM ' + (i.donde_match || 0);
      }).join('\n');
  }

  // Cost summary
  let costSection = '';
  const costData = state._costData;
  if (costData) {
    costSection = [
      '',
      '## Cost Summary',
      '- Total queries this month: ' + costData.totalQueries,
      '- Google spend: $' + costData.googleSpend.toFixed(2),
      '- Claude spend: $' + costData.claudeSpend.toFixed(2),
      '- Cache savings: $' + costData.cacheSavings.toFixed(2),
      '- Projected monthly: $' + costData.projectedMonthly.toFixed(2),
      '- Google budget used: ' + costData.budgetUsed + '% of $200',
    ].join('\n');
  }

  // Cache health
  let cacheSection = '';
  const cacheStats = state._cacheStats;
  if (cacheStats) {
    const hitRate = Number(cacheStats.hit_rate_24h) || 0;
    const displayRate = hitRate > 1 ? Math.round(hitRate) : Math.round(hitRate * 100);
    cacheSection = [
      '',
      '## Cache Health',
      '- Hit rate (24h): ' + displayRate + '%',
      '- Cache entries: ' + (cacheStats.cache_size || 0),
      '- Savings (24h): $' + ((cacheStats.savings_24h_dollars || 0).toFixed(2)),
    ].join('\n');
  }

  // Assemble full report
  const report = [
    '# DondeAI Engine Report',
    '',
    '**' + dateStr + ' at ' + timeStr + '**',
    'Run: `' + (run.run_id || 'N/A') + '`',
    '',
    '## Engine Health',
    '- Grade: **' + grade + '** (Composite: ' + composite + ')',
    '- Avg DondeMatch: ' + avgDm,
    '- Avg Score Fit: ' + avgFit,
    '- Avg Blurb Quality: ' + avgBlurb,
    '- Pass Rate: ' + passRate + '% (' + passCount + '/' + total + ')',
    '- Open Gaps: ' + (run.gap_count || 0),
    deltaSection,
    improvementsSection,
    issuesSection,
    costSection,
    cacheSection,
    '',
    '---',
    'Generated by DondeAI Mission Control',
  ].filter(Boolean).join('\n');

  // Copy to clipboard
  try {
    await navigator.clipboard.writeText(report);
    if (typeof showToast === 'function') showToast('Report copied to clipboard');
    cooLog('success', 'Report copied to clipboard.');
  } catch (e) {
    cooLog('warn', 'Clipboard write failed. Opening in new window instead.');
  }

  // Offer to open as printable window
  cooLog('info', 'Opening report in new window for printing/PDF...');
  const printWindow = window.open('', '_blank', 'width=800,height=900');
  if (printWindow) {
    printWindow.document.write(
      '<!DOCTYPE html><html><head><meta charset="utf-8"><title>DondeAI Engine Report</title>' +
      '<style>body{font-family:-apple-system,BlinkMacSystemFont,sans-serif;max-width:720px;margin:40px auto;padding:0 20px;color:#1a1a2e;line-height:1.6}' +
      'h1{color:#e94560;border-bottom:2px solid #e94560;padding-bottom:8px}h2{color:#0f3460;margin-top:24px}' +
      'code{background:#f0f0f0;padding:2px 6px;border-radius:3px;font-size:0.9em}' +
      'hr{border:none;border-top:1px solid #ddd;margin:24px 0}strong{color:#e94560}' +
      'ul,ol{padding-left:24px}li{margin-bottom:4px}' +
      '@media print{body{color:#000}h1{color:#c0392b}h2{color:#2c3e50}}</style></head><body>' +
      report
        .replace(/^# (.+)$/gm, '<h1>$1</h1>')
        .replace(/^## (.+)$/gm, '<h2>$1</h2>')
        .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
        .replace(/`(.+?)`/g, '<code>$1</code>')
        .replace(/^- (.+)$/gm, '<li>$1</li>')
        .replace(/^(\d+)\. (.+)$/gm, '<li>$2</li>')
        .replace(/(<li>.*<\/li>\n?)+/g, function(m) { return '<ul>' + m + '</ul>'; })
        .replace(/^---$/gm, '<hr>')
        .replace(/\n\n/g, '<br>') +
      '</body></html>'
    );
    printWindow.document.close();
  }
}

// ═══════════════════════════════════════════════════════════════════
// Command Handlers — Cost
// ═══════════════════════════════════════════════════════════════════

async function cmdCost() {
  cooLog('action', 'Calculating API cost summary...');

  // Today's queries from live feed
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const todayQueries = (state.liveFeed || []).filter(function(q) {
    return new Date(q.created_at) >= todayStart;
  });
  const todayCount = todayQueries.length;

  // Count cache hits vs misses for today
  const cacheHitsToday = todayQueries.filter(function(q) { return q.cache_hit === true; }).length;
  const cacheMissesToday = todayCount - cacheHitsToday;

  // Estimate costs: queries without skip_google * $0.04 per query
  // Live queries (not from command center, not cache hits) incur API costs
  const liveQueries = todayQueries.filter(function(q) {
    return q.source !== 'command-center' && !q.cache_hit;
  });
  const googleCostToday = liveQueries.length * 0.04;
  const claudeCostToday = liveQueries.length * 0.003;
  const totalCostToday = googleCostToday + claudeCostToday;

  // Cache savings: each cache hit saves a full API call cost
  const cacheSavingsToday = cacheHitsToday * 0.04;

  cooLog('info', '── API Cost Summary ──');
  cooLog('info', `Queries today: ${todayCount}`);
  cooLog('info', `  Cache hits: ${cacheHitsToday} | Misses: ${cacheMissesToday}`);
  cooLog('info', `  Live API calls: ${liveQueries.length}`);
  cooLog('info', '');
  cooLog('info', `Google cost: $${googleCostToday.toFixed(2)} (${liveQueries.length} queries x $0.04)`);
  cooLog('info', `Claude cost: $${claudeCostToday.toFixed(2)} (${liveQueries.length} queries x $0.003)`);
  cooLog('info', `Total today: $${totalCostToday.toFixed(2)}`);
  cooLog('success', `Cache savings: $${cacheSavingsToday.toFixed(2)} (${cacheHitsToday} hits x $0.04)`);

  // Monthly data if available from loadCostData
  const costData = state._costData;
  if (costData) {
    cooLog('info', '');
    cooLog('info', '── Monthly Projection ──');
    cooLog('info', `Month-to-date: $${(costData.googleSpend + costData.claudeSpend).toFixed(2)} (Google $${costData.googleSpend.toFixed(2)} + Claude $${costData.claudeSpend.toFixed(2)})`);
    cooLog('info', `Projected monthly: $${costData.projectedMonthly.toFixed(2)}`);
    cooLog('info', `Total cache savings: $${costData.cacheSavings.toFixed(2)}`);

    // Google $200 monthly credit usage bar
    const budgetPct = costData.budgetUsed;
    const barLen = 20;
    const filled = Math.round(barLen * budgetPct / 100);
    const bar = '\u2588'.repeat(filled) + '\u2591'.repeat(barLen - filled);
    const barType = budgetPct > 80 ? 'warn' : budgetPct > 50 ? 'info' : 'success';
    cooLog(barType, `Google credit: [${bar}] ${budgetPct}% of $200`);
  } else {
    cooLog('info', '');
    cooLog('info', 'Monthly data not loaded. Switch to Live mode for full cost tracking.');
  }
}

// ═══════════════════════════════════════════════════════════════════
// Command Handlers — Report
// ═══════════════════════════════════════════════════════════════════

async function cmdReport() {
  cooLog('action', 'Generating weekly CEO report...');

  const run = state.latestRun;
  const now = new Date();
  const dateStr = now.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
  const timeStr = now.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });

  // Engine health
  const avgDm = run ? Math.round(Number(run.avg_dm) || 0) : 0;
  const avgFit = run ? Math.round(Number(run.avg_score_fit) || 0) : 0;
  const avgBlurb = run ? Math.round(Number(run.avg_blurb_quality) || 0) : 0;
  const passCount = run ? (run.grade_pass_count || run.passed_60 || 0) : 0;
  const total = run ? (run.total || 1) : 1;
  const passRate = Math.round(passCount / total * 100);
  const grade = run ? computeEngineGrade(run) : '--';
  const composite = Math.round(avgDm * 0.4 + avgFit * 0.3 + avgBlurb * 0.3);

  // Quality trend text
  let trendText = 'No trend data available.';
  if (state.trendData && state.trendData.length >= 2) {
    const pts = state.trendData.slice(0, 5).map(function(r) {
      return Math.round(Number(r.avg_dm) || 0);
    });
    trendText = 'DM trend (recent first): ' + pts.join(' -> ');
  }

  // Cost summary
  const costData = state._costData;
  let costHtml = '<p>No cost data loaded.</p>';
  let costMd = 'No cost data loaded.';
  if (costData) {
    const totalSpend = (costData.googleSpend + costData.claudeSpend).toFixed(2);
    costHtml = '<ul>' +
      '<li>Month-to-date: $' + totalSpend + '</li>' +
      '<li>Projected monthly: $' + costData.projectedMonthly.toFixed(2) + '</li>' +
      '<li>Cache savings: $' + costData.cacheSavings.toFixed(2) + '</li>' +
      '<li>Google budget: ' + costData.budgetUsed + '% of $200</li>' +
      '</ul>';
    costMd = '- Month-to-date: $' + totalSpend + '\n' +
      '- Projected monthly: $' + costData.projectedMonthly.toFixed(2) + '\n' +
      '- Cache savings: $' + costData.cacheSavings.toFixed(2) + '\n' +
      '- Google budget: ' + costData.budgetUsed + '% of $200';
  }

  // Cache metrics
  const cacheStats = state._cacheStats;
  let cacheHtml = '<p>No cache data.</p>';
  let cacheMd = 'No cache data.';
  if (cacheStats) {
    const hitRate = Number(cacheStats.hit_rate_24h) || 0;
    const displayRate = hitRate > 1 ? Math.round(hitRate) : Math.round(hitRate * 100);
    cacheHtml = '<ul>' +
      '<li>Hit rate (24h): ' + displayRate + '%</li>' +
      '<li>Entries: ' + (cacheStats.cache_size || 0) + '</li>' +
      '<li>Savings: $' + ((cacheStats.savings_24h_dollars || 0).toFixed(2)) + '</li>' +
      '</ul>';
    cacheMd = '- Hit rate (24h): ' + displayRate + '%\n' +
      '- Entries: ' + (cacheStats.cache_size || 0) + '\n' +
      '- Savings: $' + ((cacheStats.savings_24h_dollars || 0).toFixed(2));
  }

  // Issues
  const openIssues = (state.issues || [])
    .filter(function(i) { return !i.status || i.status === 'open'; })
    .sort(function(a, b) {
      return Number((a.gap_severity || 'P9').replace('P', '')) - Number((b.gap_severity || 'P9').replace('P', ''));
    })
    .slice(0, 5);
  let issuesHtml = '<p>No open issues.</p>';
  let issuesMd = 'No open issues.';
  if (openIssues.length > 0) {
    issuesHtml = '<ol>' + openIssues.map(function(i) {
      return '<li>[' + (i.gap_severity || '??') + '] "' + escapeHtml(i.query || i.special_request || 'unknown') + '" - DM ' + (i.donde_match || 0) + '</li>';
    }).join('') + '</ol>';
    issuesMd = openIssues.map(function(i, idx) {
      return (idx + 1) + '. [' + (i.gap_severity || '??') + '] "' + (i.query || i.special_request || 'unknown') + '" - DM ' + (i.donde_match || 0);
    }).join('\n');
  }

  // Recent improvements (from trend data)
  let improvementsHtml = '';
  let improvementsMd = '';
  if (state.trendData && state.trendData.length >= 2) {
    const curr = state.trendData[0];
    const prev = state.trendData[1];
    const prevGrade = computeEngineGrade(prev);
    const currGrade = computeEngineGrade(curr);
    const dmDelta = Math.round(Number(curr.avg_dm) || 0) - Math.round(Number(prev.avg_dm) || 0);
    improvementsHtml = '<ul>' +
      '<li>Grade: ' + prevGrade + ' -> ' + currGrade + '</li>' +
      '<li>DM delta: ' + (dmDelta >= 0 ? '+' : '') + dmDelta + '</li>' +
      '<li>Last run: ' + timeAgo(curr.created_at) + '</li>' +
      '</ul>';
    improvementsMd = '- Grade: ' + prevGrade + ' -> ' + currGrade + '\n' +
      '- DM delta: ' + (dmDelta >= 0 ? '+' : '') + dmDelta + '\n' +
      '- Last run: ' + timeAgo(curr.created_at);
  }

  // Build styled HTML document
  const htmlDoc = '<!DOCTYPE html><html><head><meta charset="utf-8"><title>DondeAI CEO Report - ' + dateStr + '</title>' +
    '<style>' +
    ':root{--bg:#0a0a1a;--surface:#12122a;--border:#1e1e3a;--text1:#e8e8f0;--text2:#8888aa;--accent:#e94560;--green:#22c55e;--blue:#3b82f6;--amber:#eab308;--red:#ef4444}' +
    'body{background:var(--bg);color:var(--text1);font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;max-width:760px;margin:0 auto;padding:40px 24px;line-height:1.7}' +
    'h1{color:var(--accent);font-size:24px;margin-bottom:4px;border-bottom:2px solid var(--accent);padding-bottom:8px}' +
    'h2{color:var(--blue);font-size:16px;margin-top:28px;margin-bottom:8px;text-transform:uppercase;letter-spacing:1px}' +
    '.subtitle{color:var(--text2);font-size:13px;margin-bottom:24px}' +
    '.grade-badge{display:inline-block;background:var(--accent);color:#fff;padding:4px 16px;border-radius:20px;font-size:20px;font-weight:700;margin-right:12px}' +
    '.metric-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin:16px 0}' +
    '.metric{background:var(--surface);border:1px solid var(--border);border-radius:8px;padding:12px;text-align:center}' +
    '.metric-value{font-size:22px;font-weight:700;color:var(--text1)}' +
    '.metric-label{font-size:11px;color:var(--text2);text-transform:uppercase;letter-spacing:0.5px;margin-top:4px}' +
    'ul,ol{padding-left:20px;color:var(--text2)}li{margin-bottom:4px}' +
    'p{color:var(--text2);font-size:14px}' +
    '.section{background:var(--surface);border:1px solid var(--border);border-radius:8px;padding:16px;margin:12px 0}' +
    '.footer{margin-top:32px;padding-top:16px;border-top:1px solid var(--border);color:var(--text2);font-size:12px;text-align:center}' +
    '@media print{body{background:#fff;color:#222}h1{color:#c0392b}h2{color:#2c3e50}.grade-badge{background:#c0392b}.metric{border-color:#ddd}.section{border-color:#ddd;background:#f9f9f9}ul,ol,p,.subtitle,.footer{color:#555}.metric-value{color:#222}}' +
    '</style></head><body>' +
    '<h1>DondeAI Engine Report</h1>' +
    '<div class="subtitle">' + dateStr + ' at ' + timeStr + '</div>' +
    '<h2>Engine Health</h2>' +
    '<div><span class="grade-badge">' + grade + '</span><span style="color:var(--text2)">Composite: ' + composite + '</span></div>' +
    '<div class="metric-grid">' +
    '<div class="metric"><div class="metric-value">' + avgDm + '</div><div class="metric-label">Avg DM</div></div>' +
    '<div class="metric"><div class="metric-value">' + avgFit + '</div><div class="metric-label">Score Fit</div></div>' +
    '<div class="metric"><div class="metric-value">' + avgBlurb + '</div><div class="metric-label">Blurb Quality</div></div>' +
    '<div class="metric"><div class="metric-value">' + passRate + '%</div><div class="metric-label">Pass Rate</div></div>' +
    '</div>' +
    '<h2>Quality Trend</h2><div class="section"><p>' + trendText + '</p>' + improvementsHtml + '</div>' +
    '<h2>Cost Summary</h2><div class="section">' + costHtml + '</div>' +
    '<h2>Cache Metrics</h2><div class="section">' + cacheHtml + '</div>' +
    '<h2>Top Issues</h2><div class="section">' + issuesHtml + '</div>' +
    '<div class="footer">Generated by DondeAI Mission Control</div>' +
    '</body></html>';

  // Open in new window
  const reportWindow = window.open('', '_blank', 'width=850,height=1000');
  if (reportWindow) {
    reportWindow.document.write(htmlDoc);
    reportWindow.document.close();
    cooLog('success', 'Report opened in new window.');
  } else {
    cooLog('warn', 'Popup blocked. Check your browser settings.');
  }

  // Also copy markdown version to clipboard
  const mdReport = [
    '# DondeAI CEO Report',
    dateStr + ' at ' + timeStr,
    '',
    '## Engine Health',
    '- Grade: ' + grade + ' (Composite: ' + composite + ')',
    '- Avg DM: ' + avgDm + ' | Score Fit: ' + avgFit + ' | Blurb: ' + avgBlurb,
    '- Pass Rate: ' + passRate + '% (' + passCount + '/' + total + ')',
    '',
    '## Quality Trend',
    trendText,
    improvementsMd,
    '',
    '## Cost Summary',
    costMd,
    '',
    '## Cache Metrics',
    cacheMd,
    '',
    '## Top Issues',
    issuesMd,
    '',
    '---',
    'Generated by DondeAI Mission Control',
  ].filter(function(l) { return l !== undefined; }).join('\n');

  try {
    await navigator.clipboard.writeText(mdReport);
    if (typeof showToast === 'function') showToast('Markdown report copied to clipboard');
    cooLog('success', 'Markdown version copied to clipboard.');
  } catch (e) {
    cooLog('info', '(Clipboard write failed. Report is in the new window.)');
  }
}

// ═══════════════════════════════════════════════════════════════════
// COO Terminal Autocomplete
// ═══════════════════════════════════════════════════════════════════

function showCOOSuggestions(val) {
  let $sug = document.getElementById('coo-suggestions');
  if (!$sug) {
    $sug = document.createElement('div');
    $sug.id = 'coo-suggestions';
    Object.assign($sug.style, {
      position: 'absolute', bottom: '100%', left: '0', right: '0',
      background: 'var(--cc-surface2)', border: '1px solid var(--cc-border)',
      borderRadius: '4px', maxHeight: '180px', overflowY: 'auto',
      display: 'none', zIndex: '10',
    });
    const inputRow = document.querySelector('.mc-terminal__input-row');
    if (inputRow) { inputRow.style.position = 'relative'; inputRow.appendChild($sug); }
  }

  const trimmed = val.trim().toLowerCase();
  if (!trimmed || trimmed.length < 2) { $sug.style.display = 'none'; return; }

  const matches = COO_COMMANDS.filter(cmd => {
    if (cmd.id.startsWith(trimmed)) return true;
    if (cmd.description.toLowerCase().includes(trimmed)) return true;
    return cmd.patterns.some(p => {
      const src = p.source.replace(/[\\^$.*+?()[\]{}|]/g, '').toLowerCase();
      return src.includes(trimmed);
    });
  }).slice(0, 5);

  if (matches.length === 0) { $sug.style.display = 'none'; return; }

  $sug.innerHTML = matches.map(cmd =>
    `<div style="padding:4px 12px;cursor:pointer;font-size:12px;font-family:var(--font-mono);color:var(--cc-text2);border-bottom:1px solid var(--cc-border)"
         onmouseover="this.style.background='var(--cc-accent-soft)'"
         onmouseout="this.style.background=''"
         onclick="document.getElementById('coo-input').value='${cmd.id}';processCOOInput('${cmd.id}');this.parentElement.style.display='none'">
      <span style="color:var(--cc-accent)">${cmd.id}</span> — ${cmd.description}
    </div>`
  ).join('');
  $sug.style.display = 'block';
}

// ═══════════════════════════════════════════════════════════════════
// Utility
// ═══════════════════════════════════════════════════════════════════

/**
 * Copy text to clipboard with fallback for older browsers.
 * Shows a toast on success.
 */
function cooCopyToClipboard(text) {
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard
      .writeText(text)
      .then(() => {
        if (typeof showToast === 'function') showToast('Copied!');
      })
      .catch(() => {
        cooCopyFallback(text);
      });
  } else {
    cooCopyFallback(text);
  }
}

/**
 * Fallback clipboard copy using a temporary textarea.
 */
function cooCopyFallback(text) {
  const ta = document.createElement('textarea');
  ta.value = text;
  ta.style.position = 'fixed';
  ta.style.left = '-9999px';
  ta.style.top = '-9999px';
  document.body.appendChild(ta);
  ta.select();
  try {
    document.execCommand('copy');
    if (typeof showToast === 'function') showToast('Copied!');
  } catch (_) {
    if (typeof showToast === 'function') showToast('Copy failed. Select manually.');
  }
  document.body.removeChild(ta);
}
