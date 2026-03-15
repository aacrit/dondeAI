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
}

/**
 * Process raw text from the COO terminal input.
 * Matches against command patterns (first match wins) or falls back to query test.
 */
function processCOOInput(raw) {
  const input = raw.trim();
  if (!input) return;

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
 * Render the 5-division agent status panel with health dots and metrics.
 */
function renderAgentStatus() {
  const el = document.getElementById('mc-agents');
  if (!el) return;

  const run = state.latestRun;
  const issues = (state.issues || []).filter(
    (i) => !i.status || i.status === 'open'
  );
  const p0 = issues.filter((i) => i.gap_severity === 'P0').length;

  const divisions = [
    {
      name: 'Quality',
      health:
        p0 > 0 ? 'red' : run && Number(run.avg_dm) >= 75 ? 'green' : 'amber',
      metric: run ? `DM ${Math.round(run.avg_dm)}` : '--',
    },
    { name: 'Infra', health: 'green', metric: 'OK' },
    { name: 'Frontend', health: 'green', metric: 'OK' },
    { name: 'Product', health: 'green', metric: 'Idle' },
    { name: 'Security', health: 'green', metric: 'OK' },
  ];

  el.innerHTML = divisions
    .map(
      (d) => `
    <div class="mc-div-row">
      <span class="mc-div-dot mc-div-dot--${d.health}"></span>
      <span class="mc-div-name">${d.name}</span>
      <span class="mc-div-metric">${d.metric}</span>
    </div>`
    )
    .join('');
}

// ═══════════════════════════════════════════════════════════════════
// Command Handlers — Test Runners
// ═══════════════════════════════════════════════════════════════════

function cmdScan() {
  cooLog('action', 'Starting broad quality scan...');
  if (typeof startTest === 'function') {
    startTest('broad');
  } else {
    cooLog('error', 'Test runner not available. Is cc-tests.js loaded?');
  }
}

function cmdRegression() {
  cooLog('action', 'Starting regression guard (golden dataset)...');
  if (typeof startTest === 'function') {
    startTest('regression');
  } else {
    cooLog('error', 'Test runner not available. Is cc-tests.js loaded?');
  }
}

function cmdCategory(input, match) {
  const cat = (match[1] || '').toLowerCase();
  const validCats = ['food', 'vibe', 'service', 'rep', 'conv'];
  if (!validCats.includes(cat)) {
    cooLog('warn', `Invalid category "${cat}". Valid: ${validCats.join(', ')}`);
    return;
  }
  cooLog('action', `Starting category test: ${cat}...`);
  if (typeof state !== 'undefined') {
    state.selectedCategories = [cat];
  }
  if (typeof startTest === 'function') {
    startTest('category');
    // After opening the picker, trigger the multi-category runner
    if (typeof runMultiCategoryTest === 'function') {
      runMultiCategoryTest();
    }
  } else {
    cooLog('error', 'Test runner not available. Is cc-tests.js loaded?');
  }
}

function cmdEdge() {
  cooLog('action', 'Starting edge case probes...');
  if (typeof startTest === 'function') {
    startTest('edge');
  } else {
    cooLog('error', 'Test runner not available. Is cc-tests.js loaded?');
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
  cooLog('info', 'fix           Generate bug-fixer CLI command');
  cooLog('info', 'security      Generate security audit CLI command');
  cooLog('info', 'coo briefing  Generate COO briefing CLI command');
  cooLog('info', 'cache         Show cache health metrics');
  cooLog('info', 'warm cache    Trigger cache warmer pipeline');
  cooLog('info', 'db health     Show database overview');
  cooLog('info', 'compare       Compare last 2 test runs');
  cooLog('info', 'edge          Run edge case probes');
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
