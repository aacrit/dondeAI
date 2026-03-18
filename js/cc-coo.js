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
    patterns: [/coo/i, /brief/i, /report/i],
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
    description: 'Export latest run results as CSV',
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
    };
    return icons[type] || icons.check;
  }

  var AGENT_TEAM = {
    'COO': {
      agents: [{
        id: 'donde-coo', name: 'COO', iconType: 'coo',
        role: 'System Health Assessor',
        skills: ['System-wide health checks', 'CEO briefings', 'RAG status per division', 'Cross-division reporting'],
        trigger: 'System health check or CEO briefing request',
        defaultPrompt: 'Assess system health across all 7 divisions and deliver a structured CEO briefing with RAG status. Do NOT delegate — report what needs attention so I can invoke the right agents directly.'
      }],
      color: 'var(--cc-accent)'
    },
    'Quality': {
      agents: [
        { id: 'analytics-expert', name: 'Analytics', iconType: 'chart', role: 'Scoring engine analyst', skills: ['Engine benchmarking', 'DondeMatch calibration', 'Golden dataset analysis', 'Ranking quality audits'], trigger: 'Scoring changes or manual', defaultPrompt: 'Benchmark the scoring engine against the golden dataset. Identify the bottom 5 queries, implement safe quick-wins, and deliver a CEO report with before/after metrics.' },
        { id: 'bug-fixer', name: 'Bug Fixer', iconType: 'bug', role: 'Post-test bug fixer', skills: ['Root cause grouping', 'Scoring/blurb/grading fixes', 'Surgical code changes', 'Regression prevention'], trigger: 'After test failures', defaultPrompt: 'Read the latest golden dataset results. Root-cause every FAIL/WARN, group by shared cause, implement targeted fixes in scoring/blurb/grading code, and spot-check 3-5 queries to verify.' },
        { id: 'gen-test-queries', name: 'Test Gen', iconType: 'dice', role: 'Test query generator', skills: ['Persona-driven queries', 'Demographic diversity', 'Edge case generation', 'Cultural coverage'], trigger: 'Manual', defaultPrompt: 'Generate 10 diverse persona-driven test queries covering underrepresented demographics, occasions, and cuisine types. Append to tests/generated-queries.json.' },
        { id: 'continuous-tester', name: 'Tester', iconType: 'check', role: 'Automated test runner', skills: ['Golden dataset testing', 'Regression guard', 'Result persistence', 'Delta comparison'], trigger: 'After deploys', defaultPrompt: 'Run ./tests/golden-dataset-test.sh and ./tests/regression-guard.sh. Compare against previous baseline. Report PASS/FAIL/WARN counts, avg DM, and any new failures.' },
        { id: 'subjective-engine-tester', name: 'Subjective', iconType: 'search', role: 'Subjective quality auditor', skills: ['Ground-truth comparison', 'Expert consensus via web', 'Multi-round fix cycles', 'ML training data'], trigger: 'Manual', defaultPrompt: 'Run 1 round of subjective testing: 25 diverse queries, compare engine results against expert consensus (Michelin, Eater, Infatuation), fix failures, retest, and update boost table.' }
      ],
      color: 'var(--cc-green)'
    },
    'Infrastructure': {
      agents: [
        { id: 'perf-optimizer', name: 'Perf', iconType: 'bolt', role: 'Performance engineer', skills: ['Latency profiling', 'Timeout prevention', 'Bottleneck identification', 'Safe optimizations'], trigger: 'Latency issues or manual', defaultPrompt: 'Profile the recommendation pipeline latency. Map every await in index.ts, identify the top 3 bottlenecks, and implement safe optimizations. Report P50/P95/P99 before and after.' },
        { id: 'db-reviewer', name: 'DB Review', iconType: 'db', role: 'Data quality auditor', skills: ['NULL coverage audit', 'Freshness checks', 'Cross-field consistency', 'Enrichment planning'], trigger: 'After enrichment or manual', defaultPrompt: 'Audit all 2,719 restaurants for data accuracy, freshness, and completeness. Run NULL counts, outlier checks, and cross-field consistency. Deliver a prioritized enrichment plan.' },
        { id: 'update-docs', name: 'Docs', iconType: 'doc', role: 'Documentation updater', skills: ['Codebase scanning', 'CLAUDE.md updates', 'Drift detection', 'Date stamping'], trigger: 'After significant code changes', defaultPrompt: 'Scan the codebase for changes since the last update. Compare against CLAUDE.md and docs/*.md. Update any drifted documentation to reflect current state.' },
        { id: 'prod-sentinel', name: 'Sentinel', iconType: 'radar', role: 'Production monitor', skills: ['API error rates', 'DondeCache hit ratios', 'Response time P95', 'Anomaly detection'], trigger: 'Scheduled or manual', defaultPrompt: 'Query user_queries for error rates (last 24h), check DondeCache hit ratios, monitor response time trends from gauntlet_runs, and flag any anomalies with RAG thresholds.' }
      ],
      color: 'var(--cc-blue)'
    },
    'Product': {
      agents: [
        { id: 'ceo-advisor', name: 'CEO Advisor', iconType: 'crown', role: 'Strategic product advisor', skills: ['Prioritized recommendations', 'Competitive positioning', 'Roadmap decisions', 'Growth strategy'], trigger: 'Manual', defaultPrompt: 'Read both repos (backend CLAUDE.md + frontend CLAUDE.md). Assess the current product state. Deliver exactly 10 recommendations ranked by impact x feasibility. End with "The One Thing."' },
        { id: 'donde-premium-advisor', name: 'Premium', iconType: 'gem', role: 'Premium quality assessor', skills: ['$50B caliber assessment', 'UI/UX polish audit', 'Backend optimization', 'Behavioral psychology'], trigger: 'Manual', defaultPrompt: 'Audit both repos for premium app quality. Score across animation polish, design system, mobile UX, backend quality, onboarding, retention, and performance. End with "If you do ONE thing today."' }
      ],
      color: 'var(--cc-amber)'
    },
    'Security': {
      agents: [
        { id: 'donde-ciso', name: 'CISO', iconType: 'shield', role: 'Security auditor', skills: ['Secrets scanning', 'RLS policy review', 'Input validation', 'OWASP assessment'], trigger: 'Manual or security changes', defaultPrompt: 'Run a full 10-domain security audit across both repos. Check secrets, API security, injection vulnerabilities, auth, frontend security, supply chain, AI security, and compliance. Deliver severity-ranked findings.' }
      ],
      color: 'var(--cc-red)'
    },
    'Frontend': {
      agents: [
        { id: 'uat-tester', name: 'UAT', iconType: 'search', role: 'Browser UAT tester', skills: ['Playwright automation', 'Click-through QA', 'Accessibility audit', 'Responsive testing'], trigger: 'Manual', defaultPrompt: 'Run a 7-phase UAT of donde.lat via Playwright: page load audit, core journey testing, theme/mode testing (10 variants), responsive testing (5 breakpoints), accessibility audit, edge cases, and command center testing. Deliver severity-ranked findings.' },
        { id: 'frontend-builder', name: 'Builder', iconType: 'build', role: 'UI component engineer', skills: ['Ink & Momentum design system', 'Vanilla HTML+CSS+JS', 'Theme compliance', 'WCAG 2.1 AA'], trigger: 'Manual', defaultPrompt: 'Read CLAUDE.md, docs/DESIGN-SYSTEM.md, and the frontenddesign skill. Build the requested component following Ink & Momentum rules. Verify across 3 theme variants and run the 10-point smoke test.' },
        { id: 'frontend-fixer', name: 'Fixer', iconType: 'wrench', role: 'UI bug fixer', skills: ['Root cause grouping', 'Theme break fixes', 'Ink Rule compliance', 'Responsive debugging'], trigger: 'After UAT failures', defaultPrompt: 'Read the latest UAT results. Group bugs by root cause (theme_break, ink_violation, animation_jank, accessibility_gap, responsive_break). Implement fixes in priority order and verify across 3 theme variants.' },
        { id: 'css-theme-specialist', name: 'Themes', iconType: 'palette', role: 'Theme coverage auditor', skills: ['10 theme variants', 'Token file updates', 'Wash transition verify', 'Contrast compliance'], trigger: 'After new components or theme bugs', defaultPrompt: 'Audit theme coverage for all components across 10 variants (5 cultures x 2 modes). Check token overrides, contrast ratios (>=4.5:1), radial clip-path wash transition, and hardcoded values. Deliver coverage matrix.' }
      ],
      color: '#a855f7'
    },
    'Integrations': {
      agents: [
        { id: 'reservation-integration-specialist', name: 'Reservations', iconType: 'cal', role: 'Reservation platform specialist', skills: ['Resy/OpenTable/Tock deep links', 'Affiliate programs', '$0 URL construction', 'Chicago coverage mapping'], trigger: 'Manual', defaultPrompt: 'Assess reservation platform coverage for DondeAI restaurants. Design $0 deep link integrations for Resy, OpenTable, and Tock. Deliver coverage matrix, URL templates, and implementation plan.' },
        { id: 'payments-ordering-specialist', name: 'Payments', iconType: 'card', role: 'Ordering/delivery specialist', skills: ['Toast/DoorDash/UberEats deep links', 'Square integration', '$0 ordering paths', 'Affiliate revenue'], trigger: 'Manual', defaultPrompt: 'Map ordering platform coverage for Chicago restaurants. Design $0 deep link integrations for DoorDash, UberEats, Grubhub, and Toast. Prioritize direct ordering over marketplace.' },
        { id: 'maps-location-specialist', name: 'Maps', iconType: 'map', role: 'Maps/location specialist', skills: ['Google Maps cost optimization', 'Mapbox/Apple MapKit', 'Directions deep links', 'Travel time calculation'], trigger: 'Manual', defaultPrompt: 'Audit current Google Maps API usage. Recommend optimal provider per use case (maps display, directions, geocoding, travel time). Design $0 deep link integrations and cost projections at 1K/10K/100K users.' },
        { id: 'social-reviews-specialist', name: 'Social', iconType: 'phone', role: 'Social/review specialist', skills: ['Yelp Fusion API', 'Review aggregation', 'Trending detection', 'Social proof deep links'], trigger: 'Manual', defaultPrompt: 'Audit current review data freshness. Design $0 social proof integrations: Google review links, Yelp links, Instagram/TikTok/Reddit search links. Assess trending detection feasibility.' }
      ],
      color: 'var(--cc-live)'
    },
    'R&I': {
      agents: [
        { id: 'motion-physics-designer', name: 'Motion', iconType: 'bolt', role: 'Motion & physics designer', skills: ['Spring physics', 'Gesture interactions', 'Haptic feedback', 'Choreographed motion'], trigger: 'Manual', defaultPrompt: 'Review the current animation system in the frontend repo. Propose 3 high-impact motion improvements: score reveal animation, card choreography, and pull-to-discover physics. Specify spring constants and CSS implementation.' },
        { id: 'spatial-map-innovator', name: 'Spatial', iconType: 'map', role: 'Map innovation designer', skills: ['Walk-time rings', 'L-line discovery', 'Cuisine heatmaps', 'Neighborhood intelligence'], trigger: 'Manual', defaultPrompt: 'Design 3 spatial features for DondeAI: walk-time rings around user location, Chicago L-line restaurant discovery mode, and cuisine density heatmap. Specify data requirements and frontend implementation approach.' },
        { id: 'personalization-ai-architect', name: 'Personal', iconType: 'chart', role: 'Personalization architect', skills: ['Taste fingerprints', 'Mood-based discovery', 'Cold-start calibration', 'Learning loops'], trigger: 'Manual', defaultPrompt: 'Design the next phase of the learning flywheel: implicit signal harvesting (dwell time, scroll velocity, direction taps), taste fingerprint computation, and cold-start taste calibration (5-card swipe). Specify signal quality hierarchy.' },
        { id: 'gamification-engagement-designer', name: 'Gamify', iconType: 'crown', role: 'Gamification designer', skills: ['Cuisine passport', 'Neighborhood badges', 'Dining streaks', 'Anti-addictive design'], trigger: 'Manual', defaultPrompt: 'Design the Chicago Cuisine Passport (30 cuisines, stamp mechanics, Bronze/Silver/Gold levels) and Neighborhood Explorer Badges (33 neighborhoods). Specify database schema and frontend components.' },
        { id: 'accessibility-inclusivity-lead', name: 'A11y', iconType: 'check', role: 'Accessibility lead', skills: ['WCAG 2.2 AA+', 'VoiceOver optimization', 'Cultural sensitivity', 'Chicago inclusivity'], trigger: 'Manual', defaultPrompt: 'Run a WCAG 2.2 accessibility audit of the frontend. Check color contrast across all 10 themes, keyboard navigation, screen reader compatibility, dynamic type support, and sensory-friendly restaurant data. Deliver severity-ranked findings.' }
      ],
      color: '#06b6d4'
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
    'claude --agent bug-fixer --prompt "Read the latest golden dataset results. Root-cause every FAIL/WARN, group by shared cause, implement targeted fixes in scoring/blurb/grading code, and spot-check 3-5 queries to verify."';
  cooLog('cli', cliCmd);
  cooLog('info', 'Invoke bug-fixer directly — it will fix issues and report back. Then run continuous-tester to verify.');
}

function cmdSecurity() {
  cooLog('info', 'Generating security audit command...');
  const cliCmd =
    'claude --agent donde-ciso --prompt "Run a full 10-domain security audit across both repos. Check secrets, API security, injection vulnerabilities, auth, frontend security, supply chain, AI security, and compliance. Deliver severity-ranked findings with The One Fix."';
  cooLog('cli', cliCmd);
  cooLog('info', 'Invoke CISO directly — it will audit and report back with severity-ranked findings.');
}

function cmdCOO() {
  cooLog('info', 'Generating COO health assessment command...');
  cooLog('info', 'Note: COO is a read-only assessor. It reports health status but does NOT delegate to other agents. Invoke specialists directly based on its findings.');
  const cliCmd =
    'claude --agent donde-coo --prompt "Assess system health across all 7 divisions. Read both repos, check latest test results, and deliver a structured CEO briefing with RAG status per division. End with recommended next actions listing which agents I should invoke."';
  cooLog('cli', cliCmd);
  cooLog('info', 'Copy and paste this into your terminal to start the COO health assessment.');
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

function cmdCompare() {
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
  cooLog('info', 'fix           Generate bug-fixer CLI command (invoke directly)');
  cooLog('info', 'security      Generate security audit CLI command (invoke directly)');
  cooLog('info', 'coo briefing  Generate COO health assessment (read-only, no delegation)');
  cooLog('info', 'cache         Show cache health metrics');
  cooLog('info', 'warm cache    Trigger cache warmer pipeline');
  cooLog('info', 'db health     Show database overview');
  cooLog('info', 'compare       Compare last 2 test runs');
  cooLog('info', 'edge          Run edge case probes');
  cooLog('info', 'export        Export latest run report to clipboard');
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

  cooLog('action', 'Generating export...');

  // Build summary text
  const avgDm = Math.round(Number(run.avg_dm) || 0);
  const avgFit = Math.round(Number(run.avg_score_fit) || 0);
  const avgBlurb = Math.round(Number(run.avg_blurb_quality) || 0);
  const passCount = run.grade_pass_count || run.passed_60 || 0;
  const total = run.total || 1;
  const passRate = Math.round(passCount / total * 100);
  const grade = computeEngineGrade(run);
  const date = new Date(run.created_at).toISOString().split('T')[0];

  const summary = [
    `DondeAI Mission Control — Report`,
    `Date: ${date}`,
    `Run: ${run.run_id}`,
    ``,
    `Engine Grade: ${grade}`,
    `Avg DondeMatch: ${avgDm}`,
    `Avg Score Fit: ${avgFit}`,
    `Avg Blurb Quality: ${avgBlurb}`,
    `Pass Rate: ${passRate}% (${passCount}/${total})`,
    `Gaps: ${run.gap_count || 0}`,
    `Mode: ${run.mode || 'test'}`,
  ].join('\n');

  // Copy to clipboard
  try {
    await navigator.clipboard.writeText(summary);
    cooLog('success', 'Report copied to clipboard.');
  } catch (e) {
    cooLog('info', summary);
    cooLog('info', '(Select and copy the above text)');
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
