/**
 * DondeAI Command Center — Analytics
 * Gauntlet data loading, quality rendering, gap analysis, trends, fix prompts
 */

// ═══════════════════════════════════════════════════════════════════
// Auth
// ═══════════════════════════════════════════════════════════════════

async function checkAuth() {
  try {
    const { createClient } = await import('https://esm.sh/@supabase/supabase-js@2');
    const sb = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    const { data: { session } } = await sb.auth.getSession();
    if (session?.user?.email === ADMIN_EMAIL) {
      loadGauntletData();
      if (typeof loadStatusStrip === 'function') loadStatusStrip();
    } else {
      showAccessDenied(sb, session);
    }
  } catch (e) {
    // If Supabase fails, still show agent section
    console.warn('Auth check failed, showing agents only:', e);
  }
}

function showAccessDenied(sb, session) {
  const gate = document.getElementById('auth-gate');
  const msg = document.getElementById('auth-message');
  const btn = document.getElementById('auth-sign-in');
  gate.style.display = 'block';
  msg.textContent = session
    ? `Signed in as ${session.user.email} — admin access required.`
    : 'Sign in with your Google account to view analytics.';
  btn.textContent = session ? 'Sign in with a different account' : 'Sign in with Google';
  btn.addEventListener('click', async () => {
    if (session) await sb.auth.signOut();
    await sb.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: window.location.href } });
  });
}

// ═══════════════════════════════════════════════════════════════════
// Data Loading
// ═══════════════════════════════════════════════════════════════════

async function loadGauntletData() {
  try {
    const loaded = await loadRunSelector();
    if (loaded) return;
  } catch (_) {}
  // Fallback to local JSON
  const DATA_URLS = ['data/dashboard-data.json', '../dondeBackend/tests/gauntlet-results/dashboard-data.json'];
  let data = null;
  for (const url of DATA_URLS) {
    try { const r = await fetch(url); if (r.ok) { data = await r.json(); break; } } catch (_) {}
  }
  if (data) {
    dashData = data;
    renderQualitySection(data);
    renderIssuesSection(data);
    updateHeroKPIsFromGauntlet(data);
  }
}

async function loadRunSelector() {
  const { createClient } = await import('https://esm.sh/@supabase/supabase-js@2');
  const sb = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  const { data: runs } = await sb
    .from('gauntlet_runs')
    .select('run_id, total, gap_count, avg_dm, created_at, mode, dataset_size')
    .order('created_at', { ascending: false })
    .limit(20);
  if (!runs || runs.length === 0) return false;

  const sel = document.getElementById('run-selector');
  sel.innerHTML = '';
  for (let i = 0; i < runs.length; i++) {
    const r = runs[i];
    const date = new Date(r.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
    const latest = i === 0 ? ' (latest)' : '';
    sel.innerHTML += `<option value="${r.run_id}">${r.total}q | DM ${r.avg_dm} | ${r.gap_count} gaps — ${date}${latest}</option>`;
  }

  sel.addEventListener('change', () => { if (sel.value) loadRunFromSupabase(sel.value); });
  sel.value = runs[0].run_id;
  await loadRunFromSupabase(runs[0].run_id);
  return true;
}

async function loadRunFromSupabase(runId) {
  const resultsEl = document.getElementById('results-content');
  if (!resultsEl) return;
  resultsEl.innerHTML = '<div class="cc-loading"><div class="cc-spinner"></div><p>Loading run data...</p></div>';

  try {
    const { createClient } = await import('https://esm.sh/@supabase/supabase-js@2');
    const sb = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

    const { data: runData } = await sb.from('gauntlet_runs').select('*').eq('run_id', runId).single();
    if (!runData) throw new Error('Run not found');

    const { data: results } = await sb.from('gauntlet_results').select('*').eq('run_id', runId).order('donde_match', { ascending: true });
    if (!results) throw new Error('No results');

    const data = transformRunData(runData, results);
    dashData = data;
    historyLoaded = false;
    allGapsRef = data.all_gaps || [];

    renderQualitySection(data);
    renderIssuesSection(data);
    updateHeroKPIsFromGauntlet(data);
  } catch (e) {
    resultsEl.innerHTML = `<p style="color:var(--cc-red)">Failed to load run: ${e.message}</p>`;
  }
}

function transformRunData(runData, results) {
  const total = runData.total;
  const passed60 = runData.passed_60;
  const passed80 = runData.passed_80;
  const passed90 = runData.passed_90 || 0;
  const avgDM = Number(runData.avg_dm);

  // Category stats
  const catStats = runData.category_stats || {};
  const categories = {};
  for (const [cat, s] of Object.entries(catStats)) {
    categories[cat] = {
      total: s.total, avg_dm: s.avg_dm, pass_rate_60: s.pass_rate, gap_count: s.gaps,
      excellence_rate: 0, weak_rate: 0, stddev: 0, p25: 0, p50: 0, p75: 0,
      factor_averages: { food: 0, vibe: 0, service: 0, reputation: 0, convenience: 0 },
      gap_type_breakdown: {},
    };
  }

  // Per-category factor averages
  const catAcc = {};
  for (const r of results) {
    const cat = r.category || 'unknown';
    if (!catAcc[cat]) catAcc[cat] = { sumF: 0, sumV: 0, sumS: 0, sumR: 0, sumC: 0, n: 0, gaps: {} };
    catAcc[cat].sumF += Number(r.food || 0);
    catAcc[cat].sumV += Number(r.vibe || 0);
    catAcc[cat].sumS += Number(r.service || 0);
    catAcc[cat].sumR += Number(r.reputation || 0);
    catAcc[cat].sumC += Number(r.convenience || 0);
    catAcc[cat].n++;
    if (r.gap_type) catAcc[cat].gaps[r.gap_type] = (catAcc[cat].gaps[r.gap_type] || 0) + 1;
  }
  for (const [cat, acc] of Object.entries(catAcc)) {
    if (categories[cat]) {
      categories[cat].factor_averages = {
        food: Math.round(acc.sumF / acc.n * 10) / 10,
        vibe: Math.round(acc.sumV / acc.n * 10) / 10,
        service: Math.round(acc.sumS / acc.n * 10) / 10,
        reputation: Math.round(acc.sumR / acc.n * 10) / 10,
        convenience: Math.round(acc.sumC / acc.n * 10) / 10,
      };
      categories[cat].gap_type_breakdown = acc.gaps;
    }
  }

  // Relevance types, gap types, gap impact
  const relevanceTypes = {};
  const gapTypeCounts = {};
  const gapTypeImpact = {};
  for (const r of results) {
    const rt = r.relevance_type || 'unknown';
    relevanceTypes[rt] = (relevanceTypes[rt] || 0) + 1;
    if (!r.gap_type) continue;
    gapTypeCounts[r.gap_type] = (gapTypeCounts[r.gap_type] || 0) + 1;
    if (!gapTypeImpact[r.gap_type]) gapTypeImpact[r.gap_type] = { count: 0, sumDM: 0 };
    gapTypeImpact[r.gap_type].count++;
    gapTypeImpact[r.gap_type].sumDM += r.donde_match;
  }

  const gapImpact = {};
  const fixabilityMap = { intent: 'auto', scoring: 'tuning', relevance_ceiling: 'architectural', db_coverage: 'auto' };
  for (const [gt, info] of Object.entries(gapTypeImpact)) {
    const avgGapDM = info.sumDM / info.count;
    gapImpact[gt] = {
      count: info.count, avg_dm: Math.round(avgGapDM * 10) / 10,
      fixability: fixabilityMap[gt] || 'tuning',
      projected_dm_gain: Math.round((60 - avgGapDM) * info.count / total * 10) / 10,
      projected_pass_rate_gain: Math.round(info.count / total * 100 * 10) / 10,
    };
  }

  // All gaps
  const allGaps = results.filter(r => r.gap_type).map(r => ({
    query: r.query, dm: r.donde_match, gap_type: r.gap_type,
    gap_severity: r.gap_severity || 'P2', category: r.category,
    restaurant: r.restaurant_name, impact_score: 0,
    fix_action: r.gap_type === 'intent' ? 'Add keyword to intent-classifier-v5.ts dictionaries'
      : r.gap_type === 'scoring' ? 'Review weight profiles'
      : 'Analyze relevance multiplier',
    food: Number(r.food), vibe: Number(r.vibe), service: Number(r.service),
    reputation: Number(r.reputation), convenience: Number(r.convenience),
  }));

  // Tiers
  const tierNames = { 1: 'Must-Visit', 2: 'Neighborhood Gem', 3: 'Solid Option' };
  const tierAcc = {};
  for (const r of results) {
    const t = r.tier || 0;
    if (!tierAcc[t]) tierAcc[t] = { total: 0, sumDM: 0, pass60: 0, pass80: 0, gaps: 0 };
    tierAcc[t].total++;
    tierAcc[t].sumDM += r.donde_match;
    if (r.donde_match >= 60) tierAcc[t].pass60++;
    if (r.donde_match >= 80) tierAcc[t].pass80++;
    if (r.gap_type) tierAcc[t].gaps++;
  }
  const tiers = {};
  for (const [t, acc] of Object.entries(tierAcc)) {
    tiers[t] = {
      name: tierNames[t] || `Tier ${t}`, total: acc.total,
      avg_dm: Math.round(acc.sumDM / acc.total * 10) / 10,
      pass_rate_60: Math.round(acc.pass60 / acc.total * 100),
      excellence_rate: Math.round(acc.pass80 / acc.total * 100),
      gap_count: acc.gaps,
    };
  }

  // Score distribution
  const buckets = [
    { label: '90-100', min: 90, max: 100 }, { label: '80-89', min: 80, max: 89 },
    { label: '70-79', min: 70, max: 79 }, { label: '60-69', min: 60, max: 69 },
    { label: '50-59', min: 50, max: 59 }, { label: '40-49', min: 40, max: 49 },
    { label: '30-39', min: 30, max: 39 }, { label: '0-29', min: 0, max: 29 },
  ];
  const scoreDist = buckets.map(b => ({
    label: b.label,
    count: results.filter(r => r.donde_match >= b.min && r.donde_match <= b.max).length,
  }));

  // Statistics
  const dmVals = results.map(r => r.donde_match).sort((a, b) => a - b);
  const percentile = (arr, p) => arr[Math.floor(arr.length * p)] || 0;
  const mean = dmVals.reduce((a, b) => a + b, 0) / dmVals.length;
  const variance = dmVals.reduce((s, v) => s + (v - mean) ** 2, 0) / dmVals.length;

  return {
    generated: runData.created_at, source: `Supabase: ${runData.run_id}`,
    summary: { total, successful: total, passed60, passed80, passed90, avg_dm: avgDM, gap_count: runData.gap_count, mode: runData.mode },
    statistics: {
      min: dmVals[0] || 0, max: dmVals[dmVals.length - 1] || 0,
      p25: percentile(dmVals, 0.25), p50: percentile(dmVals, 0.5), p75: percentile(dmVals, 0.75), p95: percentile(dmVals, 0.95),
      stddev: Math.round(Math.sqrt(variance) * 10) / 10,
    },
    factor_averages: runData.factor_averages || {},
    tiers, categories, gap_types: gapTypeCounts, gap_impact: gapImpact,
    relevance_types: relevanceTypes, all_gaps: allGaps, score_distribution: scoreDist,
  };
}

// ═══════════════════════════════════════════════════════════════════
// Quality Section Rendering
// ═══════════════════════════════════════════════════════════════════

function renderQualitySection(data) {
  const el = document.getElementById('results-content');
  if (!el) return;
  const s = data.summary;
  const stats = data.statistics || {};
  const gapImpact = data.gap_impact || {};

  // Update unified section summary
  const summaryEl = document.getElementById('results-summary');
  if (summaryEl) summaryEl.textContent =
    `${s.total}q | DM ${s.avg_dm} | ${pct(s.passed60, s.total)}% pass | ${s.gap_count} gaps`;

  let html = '';

  // Summary cards
  html += '<div class="cc-cards">';
  html += mkCard(s.total, 'Queries', '');
  html += mkCard(s.avg_dm, 'Avg DM', ragClass(s.avg_dm));
  html += mkCard(pct(s.passed60, s.total) + '%', 'Pass ≥60', s.passed60/s.total >= 0.8 ? 'rag-green' : 'rag-amber');
  html += mkCard(pct(s.passed80, s.total) + '%', 'Excel ≥80', '');
  html += mkCard(s.gap_count, 'Gaps', s.gap_count > 50 ? 'rag-red' : s.gap_count > 20 ? 'rag-amber' : '');
  if (stats.p50 !== undefined) html += mkCard(stats.p50, 'Median', ragClass(stats.p50));
  if (stats.stddev !== undefined) html += mkCard(stats.stddev, 'Std Dev', '');
  html += mkCard(s.mode === 'lightweight' ? 'LW' : 'Full', 'Mode', '');
  html += '</div>';

  // Grid: Score Distribution + Gap Impact
  html += '<div class="cc-grid-2">';

  // Score Distribution
  html += '<div class="cc-subsection"><div class="cc-subsection__title">Score Distribution</div>';
  const maxCount = Math.max(...data.score_distribution.map(b => b.count));
  const distColors = ['var(--cc-green)', 'var(--cc-green)', 'var(--cc-green)', 'var(--cc-amber)', 'var(--cc-amber)', 'var(--cc-red)', 'var(--cc-red)', 'var(--cc-red)'];
  for (const [i, bucket] of data.score_distribution.entries()) {
    const w = maxCount > 0 ? (bucket.count / maxCount * 100) : 0;
    html += `<div class="cc-dist-row">
      <span class="cc-dist-label">${bucket.label}</span>
      <div class="cc-dist-track"><div class="cc-dist-bar" style="width:${Math.max(w, 1)}%;background:${distColors[i]}">${bucket.count > 0 ? bucket.count : ''}</div></div>
      <span class="cc-dist-count">${bucket.count}</span>
      <span class="cc-dist-pct">${pct(bucket.count, s.total)}%</span>
    </div>`;
  }
  if (stats.p25 !== undefined) {
    html += `<div class="cc-percentiles">
      <span>P25: <strong>${stats.p25}</strong></span>
      <span>P50: <strong>${stats.p50}</strong></span>
      <span>P75: <strong>${stats.p75}</strong></span>
      <span>P95: <strong>${stats.p95}</strong></span>
    </div>`;
  }
  html += '</div>';

  // Gap Impact
  html += '<div class="cc-subsection"><div class="cc-subsection__title">Gap Impact & ROI</div>';
  if (Object.keys(gapImpact).length > 0) {
    const sortedImpact = Object.entries(gapImpact).sort((a,b) => b[1].projected_pass_rate_gain - a[1].projected_pass_rate_gain);
    const maxGain = Math.max(...sortedImpact.map(([,v]) => v.projected_pass_rate_gain), 1);
    for (const [type, imp] of sortedImpact) {
      const w = (imp.projected_pass_rate_gain / maxGain * 100);
      const badgeClass = imp.fixability === 'auto' ? 'cc-badge--auto' : imp.fixability === 'tuning' ? 'cc-badge--tuning' : 'cc-badge--architectural';
      html += `<div class="cc-impact-row">
        <span class="cc-impact-type">${type}</span>
        <div class="cc-impact-track"><div class="cc-impact-bar" style="width:${Math.max(w, 2)}%;background:${ragColor(imp.avg_dm)}"></div></div>
        <span style="font-size:0.68rem;font-family:var(--cc-mono)">+${imp.projected_pass_rate_gain}% pass</span>
        <span class="cc-badge ${badgeClass}">${imp.fixability}</span>
      </div>`;
    }
  } else {
    html += '<p class="cc-muted">No gap impact data</p>';
  }
  html += '</div>';
  html += '</div>'; // grid-2

  // Category breakdown (collapsible)
  const sortedCats = Object.entries(data.categories).sort((a,b) => a[1].avg_dm - b[1].avg_dm);
  for (const [cat, c] of sortedCats) {
    html += `<div class="cc-collapsible">
      <div class="cc-collapsible__header" onclick="this.parentElement.classList.toggle('open')">
        <span><strong>${cat}</strong> — ${c.total}q, avg ${c.avg_dm} DM, ${c.gap_count} gaps</span>
        <span class="cc-collapsible__chevron">&#9654;</span>
      </div>
      <div class="cc-collapsible__body">`;
    if (c.factor_averages) {
      html += '<div class="cc-subsection__title">Factor Performance</div><div class="cc-factor-bars">';
      for (const [f, v] of Object.entries(c.factor_averages)) {
        html += `<div class="cc-factor-row">
          <span class="cc-factor-label">${f}</span>
          <div class="cc-factor-track"><div class="cc-factor-fill" style="width:${v/10*100}%;background:${factorColor(v)}"></div></div>
          <span class="cc-factor-value">${v}</span>
        </div>`;
      }
      html += '</div>';
    }
    if (c.gap_type_breakdown && Object.keys(c.gap_type_breakdown).length > 0) {
      html += '<div style="margin-top:8px;display:flex;gap:10px;flex-wrap:wrap">';
      for (const [gt, count] of Object.entries(c.gap_type_breakdown).sort((a,b) => b[1] - a[1])) {
        const fix = gapImpact[gt]?.fixability || 'manual';
        const cls = fix === 'auto' ? 'cc-badge--auto' : fix === 'tuning' ? 'cc-badge--tuning' : 'cc-badge--architectural';
        html += `<span style="font-size:0.7rem;color:var(--cc-text-2)"><strong style="color:var(--cc-text)">${count}</strong> ${gt} <span class="cc-badge ${cls}">${fix}</span></span>`;
      }
      html += '</div>';
    }
    html += '</div></div>';
  }

  // Factor Performance
  if (data.factor_averages && Object.keys(data.factor_averages).length > 0) {
    html += '<div class="cc-subsection" style="margin-top:12px"><div class="cc-subsection__title">Global Factor Performance</div>';
    html += '<div class="cc-factor-bars">';
    const factors = Object.entries(data.factor_averages).sort((a,b) => a[1] - b[1]);
    for (const [f, v] of factors) {
      html += `<div class="cc-factor-row">
        <span class="cc-factor-label">${f}</span>
        <div class="cc-factor-track"><div class="cc-factor-fill" style="width:${v/10*100}%;background:${factorColor(v)}"></div></div>
        <span class="cc-factor-value">${v}/10</span>
      </div>`;
    }
    html += '</div></div>';
  }

  el.innerHTML = html;
}

// ═══════════════════════════════════════════════════════════════════
// Issues Section
// ═══════════════════════════════════════════════════════════════════

function renderIssuesSection(data) {
  const el = document.getElementById('results-content');
  if (!el) return;
  const allGaps = data.all_gaps || [];
  allGapsRef = allGaps;
  const gapImpact = data.gap_impact || {};

  // Count by severity
  const p0Count = allGaps.filter(g => g.gap_severity === 'P0').length;

  // Update unified summary with gap info (append to quality summary)
  const summaryEl = document.getElementById('results-summary');
  if (summaryEl && p0Count > 0) {
    summaryEl.innerHTML += ` · <span class="cc-attention-pill cc-attention-pill--p0">${p0Count} Critical</span>`;
  }

  if (allGaps.length === 0) {
    el.insertAdjacentHTML('beforeend', '<div class="cc-subsection" style="margin-top:16px"><div class="cc-subsection__title">Issues</div><div class="cc-empty-state"><div class="cc-empty-state__icon">&#10003;</div><div class="cc-empty-state__text">No gaps found — all queries passing</div></div></div>');
    return;
  }

  let html = '<div class="cc-subsection__title" style="margin-top:16px">Issues</div>';

  // ── Grouped view: group by gap_type, sorted by severity ──
  const groups = {};
  for (const [i, g] of allGaps.entries()) {
    const key = g.gap_type || 'unknown';
    if (!groups[key]) groups[key] = [];
    groups[key].push({ ...g, idx: i });
  }

  // Sort groups: most P0s first, then most gaps
  const sortedGroups = Object.entries(groups).sort((a, b) => {
    const aP0 = a[1].filter(g => g.gap_severity === 'P0').length;
    const bP0 = b[1].filter(g => g.gap_severity === 'P0').length;
    if (bP0 !== aP0) return bP0 - aP0;
    return b[1].length - a[1].length;
  });

  // Quick action bar for high-priority fixes
  const autoFixable = allGaps.filter(g => (gapImpact[g.gap_type]?.fixability === 'auto'));
  const criticalGaps = allGaps.filter(g => g.gap_severity === 'P0');

  if (criticalGaps.length > 0 || autoFixable.length > 0) {
    html += '<div style="display:flex;gap:8px;margin-bottom:12px;flex-wrap:wrap">';
    if (criticalGaps.length > 0) {
      html += `<button class="cc-attention-pill cc-attention-pill--p0" onclick="window._generateSeverityFix('P0')">Fix ${criticalGaps.length} Critical Gaps</button>`;
    }
    if (autoFixable.length > 0) {
      html += `<button class="cc-attention-pill cc-attention-pill--auto" onclick="window._generateAutoFix()">Auto-fix ${autoFixable.length} Intent Gaps</button>`;
    }
    if (allGaps.length > 3) {
      html += `<button class="cc-attention-pill cc-attention-pill--p1" onclick="window._generateBulkFixAll()">Fix All ${allGaps.length} Gaps</button>`;
    }
    html += '</div>';
  }

  // Render grouped issue cards
  for (const [type, gaps] of sortedGroups) {
    const typeP0 = gaps.filter(g => g.gap_severity === 'P0').length;
    const typeP1 = gaps.filter(g => g.gap_severity === 'P1').length;
    const avgDm = Math.round(gaps.reduce((s, g) => s + g.dm, 0) / gaps.length);
    const fix = gapImpact[type]?.fixability || 'manual';
    const fixClass = fix === 'auto' ? 'cc-badge--auto' : fix === 'tuning' ? 'cc-badge--tuning' : 'cc-badge--architectural';
    const projGain = gapImpact[type]?.projected_pass_rate_gain || 0;

    html += `<div class="cc-issue-group" data-type="${type}">`;
    html += `<div class="cc-issue-group__header" onclick="this.parentElement.classList.toggle('open')">`;
    html += `<span class="cc-badge ${fixClass}">${fix}</span>`;
    html += `<span class="cc-issue-group__title">${type} <span style="color:var(--cc-text-3);font-weight:400">— avg DM ${avgDm}</span></span>`;
    if (typeP0 > 0) html += `<span class="cc-attention-pill cc-attention-pill--p0">${typeP0} P0</span>`;
    if (typeP1 > 0) html += `<span class="cc-attention-pill cc-attention-pill--p1">${typeP1} P1</span>`;
    if (projGain > 0) html += `<span style="font-size:0.65rem;color:var(--cc-green);font-family:var(--cc-mono)">+${projGain}%</span>`;
    html += `<span class="cc-issue-group__count">${gaps.length}</span>`;
    html += `<span class="cc-issue-group__chevron">&#9654;</span>`;
    html += `</div>`;

    // Group body: table of gaps in this group
    html += `<div class="cc-issue-group__body">`;
    html += '<table class="cc-table"><thead><tr><th>Query</th><th>DM</th><th>Sev</th><th>Category</th><th>Restaurant</th><th>Weak Factor</th></tr></thead><tbody>';
    for (const g of gaps) {
      const weak = identifyWeakFactor(g);
      html += `<tr class="expandable" onclick="window._toggleGapDetail(${g.idx})">
        <td title="${escapeHtml(g.query)}">${escapeHtml(g.query.substring(0, 45))}</td>
        <td><span class="dm-badge ${ragClass(g.dm)}">${g.dm}</span></td>
        <td><span class="severity-dot ${(g.gap_severity || 'p2').toLowerCase()}"></span>${g.gap_severity || '—'}</td>
        <td>${g.category}</td>
        <td>${escapeHtml((g.restaurant || '—').substring(0, 18))}</td>
        <td style="font-family:var(--cc-mono);font-size:0.68rem;color:${factorColor(weak.score)}">${weak.name} ${weak.score}</td>
      </tr>`;
      html += `<tr class="gap-detail-row" style="display:none" id="gap-detail-${g.idx}">
        <td colspan="6"><div class="gap-detail-content">`;
      if (g.fix_action) html += `<strong>Fix:</strong> ${escapeHtml(g.fix_action)}<br>`;
      html += `<div class="gap-detail-factors">
        <span>Food: <strong>${g.food}</strong></span>
        <span>Vibe: <strong>${g.vibe}</strong></span>
        <span>Service: <strong>${g.service}</strong></span>
        <span>Rep: <strong>${g.reputation}</strong></span>
        <span>Conv: <strong>${g.convenience}</strong></span>
      </div>`;
      html += `<div class="gap-sparkline" data-query="${escapeHtml(g.query)}" id="sparkline-${g.idx}"></div>`;
      html += `<button class="fix-btn" data-idx="${g.idx}" onclick="event.stopPropagation(); window._generateFixSession(${g.idx})">Generate Fix Prompt</button>`;
      html += '</div></td></tr>';
    }
    html += '</tbody></table>';
    html += '</div>';

    // Group action footer
    html += `<div class="cc-issue-group__actions">`;
    html += `<button class="fix-btn" onclick="window._generateGroupFix('${type}')">Fix All ${gaps.length} ${type} Gaps</button>`;
    html += '</div>';
    html += '</div>';
  }

  // Also keep the flat filter/table view in a collapsible
  html += `<div class="cc-collapsible" style="margin-top:12px">`;
  html += `<div class="cc-collapsible__header" onclick="this.parentElement.classList.toggle('open')">`;
  html += `<span>Flat Table View (${allGaps.length} gaps)</span>`;
  html += `<span class="cc-collapsible__chevron">&#9654;</span>`;
  html += `</div><div class="cc-collapsible__body">`;

  // Filter bar
  const gapTypes = [...new Set(allGaps.map(g => g.gap_type))].filter(Boolean).sort();
  const gapCats = [...new Set(allGaps.map(g => g.category))].filter(Boolean).sort();
  const gapSevs = [...new Set(allGaps.map(g => g.gap_severity))].filter(Boolean).sort();

  html += '<div class="cc-filter-bar">';
  html += '<label>Type:</label><select class="cc-filter-select" id="f-type"><option value="">All</option>';
  for (const t of gapTypes) html += `<option>${t}</option>`;
  html += '</select>';
  html += '<label>Category:</label><select class="cc-filter-select" id="f-cat"><option value="">All</option>';
  for (const c of gapCats) html += `<option>${c}</option>`;
  html += '</select>';
  html += '<label>Severity:</label><select class="cc-filter-select" id="f-sev"><option value="">All</option>';
  for (const sv of gapSevs) html += `<option>${sv}</option>`;
  html += '</select>';
  html += '<input class="cc-filter-input" id="f-search" placeholder="Search queries...">';
  html += '<span class="cc-filter-count" id="gap-count"></span>';
  html += '</div>';

  // Bulk action bar
  html += '<div class="cc-bulk-bar" id="bulk-bar" style="display:none">';
  html += '<span id="bulk-count">0 selected</span>';
  html += '<button class="fix-btn" onclick="window._generateBulkFixSession()">Generate Combined Fix</button>';
  html += '<button class="cc-btn" onclick="window._clearSelection()">Clear</button>';
  html += '</div>';

  // Gap table
  html += '<div class="cc-table-wrap"><table class="cc-table" id="gaps-table"><thead><tr>';
  html += '<th style="width:28px"><input type="checkbox" id="gap-select-all"></th>';
  html += '<th class="sortable" data-col="1" data-type="num">#</th>';
  html += '<th class="sortable" data-col="2" data-type="str">Query</th>';
  html += '<th class="sortable" data-col="3" data-type="num">DM</th>';
  html += '<th class="sortable" data-col="4" data-type="str">Type</th>';
  html += '<th class="sortable" data-col="5" data-type="str">Sev</th>';
  html += '<th class="sortable" data-col="6" data-type="str">Category</th>';
  html += '<th>Restaurant</th>';
  html += '<th>Fix</th>';
  html += '</tr></thead><tbody>';

  for (const [i, g] of allGaps.entries()) {
    const sevClass = g.gap_severity === 'P0' ? 'cc-badge--p0' : g.gap_severity === 'P1' ? 'cc-badge--p1' : 'cc-badge--p2';
    const fix = gapImpact[g.gap_type]?.fixability || '';
    const fixBadge = fix === 'auto' ? 'cc-badge--auto' : fix === 'tuning' ? 'cc-badge--tuning' : 'cc-badge--architectural';
    html += `<tr class="gap-row expandable" data-type="${g.gap_type}" data-cat="${g.category}" data-sev="${g.gap_severity || ''}" data-query="${escapeHtml(g.query.toLowerCase())}">
      <td><input type="checkbox" class="gap-check" data-idx="${i}" onclick="event.stopPropagation()"></td>
      <td>${i + 1}</td>
      <td title="${escapeHtml(g.query)}">${escapeHtml(g.query.substring(0, 40))}</td>
      <td><span class="dm-badge ${ragClass(g.dm)}">${g.dm}</span></td>
      <td><span class="cc-badge ${sevClass}">${g.gap_type}</span></td>
      <td><span class="severity-dot ${(g.gap_severity || 'p2').toLowerCase()}"></span>${g.gap_severity || '—'}</td>
      <td>${g.category}</td>
      <td>${escapeHtml((g.restaurant || '—').substring(0, 20))}</td>
      <td>${fix ? `<span class="cc-badge ${fixBadge}">${fix}</span>` : '—'}</td>
    </tr>`;
  }
  html += '</tbody></table></div>';
  html += '</div></div>'; // close collapsible

  // Append issues after quality content (don't overwrite)
  el.insertAdjacentHTML('beforeend', html);
  initGapInteractivity();
}

function initGapInteractivity() {
  // Filters
  const fType = document.getElementById('f-type');
  const fCat = document.getElementById('f-cat');
  const fSev = document.getElementById('f-sev');
  const fSearch = document.getElementById('f-search');
  const countEl = document.getElementById('gap-count');
  if (!fType) return;

  function applyFilters() {
    const type = fType.value, cat = fCat.value, sev = fSev.value, search = fSearch.value.toLowerCase();
    let visible = 0;
    document.querySelectorAll('tr.gap-row').forEach(row => {
      const show = (!type || row.dataset.type === type)
        && (!cat || row.dataset.cat === cat)
        && (!sev || row.dataset.sev === sev)
        && (!search || row.dataset.query.includes(search));
      row.style.display = show ? '' : 'none';
      const idx = row.querySelectorAll('td')[1]?.textContent;
      const detail = document.querySelector(`tr.gap-detail-row[data-parent="${parseInt(idx) - 1}"]`);
      if (detail) detail.style.display = 'none';
      if (!show) {
        const cb = row.querySelector('.gap-check');
        if (cb) { cb.checked = false; row.classList.remove('gap-selected'); }
      }
      if (show) visible++;
    });
    countEl.textContent = `${visible} gaps`;
    updateBulkBar();
  }

  [fType, fCat, fSev].forEach(el => el.addEventListener('change', applyFilters));
  fSearch.addEventListener('input', applyFilters);
  applyFilters();

  // Expandable rows
  document.querySelectorAll('tr.expandable').forEach(row => {
    row.addEventListener('click', () => {
      const idx = row.querySelectorAll('td')[1]?.textContent;
      const parentIdx = parseInt(idx) - 1;
      const detail = document.querySelector(`tr.gap-detail-row[data-parent="${parentIdx}"]`);
      if (detail) {
        const isOpening = detail.style.display === 'none';
        detail.style.display = isOpening ? '' : 'none';
        if (isOpening) {
          const sparkEl = document.getElementById(`sparkline-${parentIdx}`);
          if (sparkEl && !sparkEl.dataset.loaded) {
            sparkEl.dataset.loaded = '1';
            loadQuerySparkline(sparkEl, sparkEl.dataset.query);
          }
        }
      }
    });
  });

  // Sortable
  document.querySelectorAll('#gaps-table th.sortable').forEach(th => {
    th.addEventListener('click', () => {
      const table = th.closest('table');
      const tbody = table.querySelector('tbody');
      const col = parseInt(th.dataset.col);
      const isNum = th.dataset.type === 'num';
      const isAsc = th.classList.contains('asc');
      table.querySelectorAll('th.sortable').forEach(h => h.classList.remove('asc', 'desc'));
      th.classList.add(isAsc ? 'desc' : 'asc');
      const rows = Array.from(tbody.querySelectorAll('tr:not(.gap-detail-row)'));
      rows.sort((a, b) => {
        let va = a.cells[col]?.textContent.trim().replace('%', '') || '';
        let vb = b.cells[col]?.textContent.trim().replace('%', '') || '';
        if (isNum) { va = parseFloat(va) || 0; vb = parseFloat(vb) || 0; return isAsc ? vb - va : va - vb; }
        return isAsc ? vb.localeCompare(va) : va.localeCompare(vb);
      });
      for (const row of rows) {
        tbody.appendChild(row);
        const cells = row.querySelectorAll('td');
        const parent = (cells[1] || cells[0])?.textContent;
        const detailRow = tbody.querySelector(`tr.gap-detail-row[data-parent="${parseInt(parent) - 1}"]`);
        if (detailRow) tbody.appendChild(detailRow);
      }
    });
  });

  // Checkboxes
  const selectAll = document.getElementById('gap-select-all');
  if (selectAll) {
    selectAll.addEventListener('change', () => {
      document.querySelectorAll('tr.gap-row').forEach(row => {
        if (row.style.display === 'none') return;
        const cb = row.querySelector('.gap-check');
        if (cb) { cb.checked = selectAll.checked; row.classList.toggle('gap-selected', selectAll.checked); }
      });
      updateBulkBar();
    });
  }
  document.querySelectorAll('.gap-check[data-idx]').forEach(cb => {
    cb.addEventListener('change', () => {
      cb.closest('tr')?.classList.toggle('gap-selected', cb.checked);
      updateBulkBar();
    });
  });
}

function updateBulkBar() {
  const count = document.querySelectorAll('.gap-check[data-idx]:checked').length;
  const bar = document.getElementById('bulk-bar');
  if (!bar) return;
  bar.style.display = count > 0 ? 'flex' : 'none';
  const countEl = document.getElementById('bulk-count');
  if (countEl) countEl.textContent = `${count} selected`;
}

async function loadQuerySparkline(el, query) {
  if (!query) return;
  try {
    const { createClient } = await import('https://esm.sh/@supabase/supabase-js@2');
    const sb = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    const { data } = await sb.from('gauntlet_results').select('donde_match, run_id').eq('query', query).order('run_id', { ascending: true }).limit(30);
    if (!data || data.length < 2) { el.innerHTML = '<div class="sparkline-label">No history</div>'; return; }

    const W = 160, H = 28, n = data.length;
    let points = '', dots = '';
    for (let i = 0; i < n; i++) {
      const x = 2 + (i / Math.max(n - 1, 1)) * (W - 4);
      const y = 2 + (H - 4) - ((data[i].donde_match || 0) / 100) * (H - 4);
      points += `${x},${y} `;
      const c = data[i].donde_match >= 80 ? 'var(--cc-green)' : data[i].donde_match >= 60 ? 'var(--cc-amber)' : 'var(--cc-red)';
      dots += `<circle cx="${x}" cy="${y}" r="2" fill="${c}"><title>DM ${data[i].donde_match}</title></circle>`;
    }
    const delta = data[n-1].donde_match - data[0].donde_match;
    const deltaStr = delta > 0 ? `+${delta}` : `${delta}`;
    el.innerHTML = `<div class="sparkline-label">History (${n} runs) <span style="color:${delta > 0 ? 'var(--cc-green)' : 'var(--cc-red)'}; font-weight:600">${deltaStr}</span></div>
      <svg viewBox="0 0 ${W} ${H}" width="${W}" height="${H}">
        <polyline points="${points}" fill="none" stroke="var(--cc-accent)" stroke-width="1" stroke-linejoin="round"/>${dots}
      </svg>`;
  } catch (e) { el.innerHTML = ''; }
}

// ═══════════════════════════════════════════════════════════════════
// Fix Prompt Generation
// ═══════════════════════════════════════════════════════════════════

function identifyWeakFactor(g) {
  const factors = { food: g.food, vibe: g.vibe, service: g.service, reputation: g.reputation, convenience: g.convenience };
  let weakest = 'food', min = Infinity;
  for (const [k, v] of Object.entries(factors)) { if (v < min) { min = v; weakest = k; } }
  return { name: weakest, score: min };
}

function buildFixPrompt(g) {
  const factors = `Food: ${g.food}/10 | Vibe: ${g.vibe}/10 | Service: ${g.service}/10 | Reputation: ${g.reputation}/10 | Convenience: ${g.convenience}/10`;
  if (g.gap_type === 'intent') {
    return `Fix intent gap: "${g.query}" scored DM ${g.dm}. Restaurant: "${g.restaurant}" (${g.category}).\nFactors: ${factors}\nFile: /home/user/dondeBackend/supabase/functions/recommend/_shared/intent-classifier-v5.ts\nAdd keywords to FLAVOR_WORDS, VIBE_WORDS, CONSTRAINT_PATTERNS, EMOTIONAL_INTENT_PATTERNS, or CONTEXT_PATTERNS.`;
  }
  if (g.gap_type === 'scoring') {
    const weak = identifyWeakFactor(g);
    return `Fix scoring gap: "${g.query}" scored DM ${g.dm}. Restaurant: "${g.restaurant}" (${g.category}).\nFactors: ${factors}\nWeakest: ${weak.name} (${weak.score}/10)\nFile: /home/user/dondeBackend/supabase/functions/recommend/_shared/scoring-v9.ts (QUALITY_WEIGHTS, line ~483)`;
  }
  return `Fix relevance ceiling: "${g.query}" scored DM ${g.dm}. Restaurant: "${g.restaurant}" (${g.category}).\nFactors: ${factors}\nFile: /home/user/dondeBackend/supabase/functions/recommend/_shared/scoring-v9.ts (relevance multiplier)`;
}

function buildBulkFixPrompt(gaps) {
  let prompt = `Fix ${gaps.length} gaps in the DondeAI scoring engine.\n`;
  const intent = gaps.filter(g => g.gap_type === 'intent');
  const scoring = gaps.filter(g => g.gap_type === 'scoring');
  const ceiling = gaps.filter(g => g.gap_type === 'relevance_ceiling');
  if (intent.length) {
    prompt += `\n## Intent Gaps (${intent.length})\n`;
    for (const g of intent) prompt += `- "${g.query}" DM ${g.dm} (${g.category})\n`;
    prompt += `File: intent-classifier-v5.ts — add keywords to dictionaries.\n`;
  }
  if (scoring.length) {
    prompt += `\n## Scoring Gaps (${scoring.length})\n`;
    for (const g of scoring) { const w = identifyWeakFactor(g); prompt += `- "${g.query}" DM ${g.dm} (weak: ${w.name} ${w.score})\n`; }
    prompt += `File: scoring-v9.ts — review QUALITY_WEIGHTS.\n`;
  }
  if (ceiling.length) {
    prompt += `\n## Relevance Ceiling Gaps (${ceiling.length})\n`;
    for (const g of ceiling) prompt += `- "${g.query}" DM ${g.dm} (${g.category})\n`;
    prompt += `File: scoring-v9.ts — investigate relevance multiplier.\n`;
  }
  return prompt;
}

function openFixSession(prompt, btn, label) {
  try { navigator.clipboard.writeText(prompt); } catch(e) {
    try { const ta = document.createElement('textarea'); ta.value = prompt; ta.style.cssText = 'position:fixed;opacity:0;'; document.body.appendChild(ta); ta.select(); document.execCommand('copy'); ta.remove(); } catch(e2) {}
  }
  if (btn) {
    btn.classList.add('copied');
    btn.innerHTML = 'Copied! <a href="https://claude.ai/code" target="_blank" rel="noopener" class="fix-session-link">Open Claude Code →</a>';
    setTimeout(() => { btn.classList.remove('copied'); btn.textContent = label; }, 6000);
  }
}

window._generateFixSession = function(idx) {
  const prompt = buildFixPrompt(allGapsRef[idx]);
  const btn = document.querySelector(`.fix-btn[data-idx="${idx}"]`);
  openFixSession(prompt, btn, 'Generate Fix Session');
};

window._generateBulkFixSession = function() {
  const checks = document.querySelectorAll('.gap-check[data-idx]:checked');
  const gaps = [...checks].map(c => allGapsRef[parseInt(c.dataset.idx)]).filter(Boolean);
  if (!gaps.length) return;
  openFixSession(buildBulkFixPrompt(gaps), document.querySelector('#bulk-bar .fix-btn'), 'Generate Combined Fix Session');
};

window._toggleGapDetail = function(idx) {
  const detail = document.getElementById(`gap-detail-${idx}`);
  if (!detail) return;
  const isOpening = detail.style.display === 'none';
  detail.style.display = isOpening ? '' : 'none';
  if (isOpening) {
    const sparkEl = document.getElementById(`sparkline-${idx}`);
    if (sparkEl && !sparkEl.dataset.loaded) {
      sparkEl.dataset.loaded = '1';
      loadQuerySparkline(sparkEl, sparkEl.dataset.query);
    }
  }
};

window._generateGroupFix = function(gapType) {
  const gaps = allGapsRef.filter(g => g.gap_type === gapType);
  if (!gaps.length) return;
  const prompt = buildBulkFixPrompt(gaps);
  openFixSession(prompt, null, '');
  // Show feedback
  const el = document.querySelector(`.cc-issue-group[data-type="${gapType}"] .fix-btn`);
  if (el) { el.classList.add('copied'); el.textContent = 'Copied!'; setTimeout(() => { el.classList.remove('copied'); el.textContent = `Fix All ${gaps.length} ${gapType} Gaps`; }, 3000); }
};

window._generateSeverityFix = function(severity) {
  const gaps = allGapsRef.filter(g => g.gap_severity === severity);
  if (!gaps.length) return;
  let prompt = `Fix ${gaps.length} ${severity} critical gaps in DondeAI scoring engine.\n\n`;
  prompt += buildBulkFixPrompt(gaps);
  openFixSession(prompt, null, '');
};

window._generateAutoFix = function() {
  const gaps = allGapsRef.filter(g => g.gap_type === 'intent');
  if (!gaps.length) return;
  let prompt = `Auto-fix ${gaps.length} intent gaps.\n\n`;
  prompt += `File: /home/user/dondeBackend/supabase/functions/recommend/_shared/intent-classifier-v5.ts\n\n`;
  prompt += `Add the following keywords to the appropriate dictionaries (FLAVOR_WORDS, VIBE_WORDS, CONSTRAINT_PATTERNS, EMOTIONAL_INTENT_PATTERNS, CONTEXT_PATTERNS):\n\n`;
  for (const g of gaps) prompt += `- "${g.query}" → DM ${g.dm} (${g.category})\n`;
  openFixSession(prompt, null, '');
};

window._generateBulkFixAll = function() {
  openFixSession(buildBulkFixPrompt(allGapsRef), null, '');
};

window._clearSelection = function() {
  document.querySelectorAll('.gap-check[data-idx]').forEach(c => c.checked = false);
  const sa = document.getElementById('gap-select-all');
  if (sa) sa.checked = false;
  document.querySelectorAll('tr.gap-selected').forEach(r => r.classList.remove('gap-selected'));
  updateBulkBar();
};

// ═══════════════════════════════════════════════════════════════════
// Trends Section
// ═══════════════════════════════════════════════════════════════════

async function loadTrendsSection() {
  if (historyLoaded) return;
  historyLoaded = true;
  const el = document.getElementById('trends-content');
  if (!el) return;
  try {
    const { createClient } = await import('https://esm.sh/@supabase/supabase-js@2');
    const sb = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    const { data: timeline, error } = await sb
      .from('gauntlet_runs')
      .select('run_id, created_at, avg_dm, passed_60, passed_80, gap_count, dataset_hash, dataset_size, mode, delta_avg_dm, delta_passed_60, delta_gap_count, total')
      .order('created_at', { ascending: false })
      .limit(50);

    if (error) throw error;
    if (!timeline || timeline.length === 0) { el.innerHTML = '<p class="cc-muted">No run history found.</p>'; return; }

    let h = '';
    const latest = timeline[0];

    // Delta summary
    const prev = timeline.find(r => r.dataset_hash === latest.dataset_hash && r.run_id !== latest.run_id);
    if (prev) {
      const dAvg = Number(latest.delta_avg_dm) || Math.round((Number(latest.avg_dm) - Number(prev.avg_dm)) * 10) / 10;
      const dPass = latest.delta_passed_60 ?? (latest.passed_60 - prev.passed_60);
      const dGap = latest.delta_gap_count ?? (latest.gap_count - prev.gap_count);
      h += '<div class="cc-cards" style="margin-bottom:16px">';
      h += `<div class="cc-card"><div class="cc-card__value ${dAvg > 0 ? 'rag-green' : dAvg < 0 ? 'rag-red' : ''}">${dAvg > 0 ? '+' : ''}${dAvg}</div><div class="cc-card__label">Avg DM Δ</div></div>`;
      h += `<div class="cc-card"><div class="cc-card__value ${dPass > 0 ? 'rag-green' : dPass < 0 ? 'rag-red' : ''}">${dPass > 0 ? '+' : ''}${dPass}</div><div class="cc-card__label">Pass Rate Δ</div></div>`;
      h += `<div class="cc-card"><div class="cc-card__value ${dGap < 0 ? 'rag-green' : dGap > 0 ? 'rag-red' : ''}">${dGap > 0 ? '+' : ''}${dGap}</div><div class="cc-card__label">Gap Count Δ</div></div>`;
      h += '</div>';

      const trendsSummaryEl = document.getElementById('trends-summary');
      if (trendsSummaryEl) trendsSummaryEl.textContent = `ΔDM ${dAvg > 0 ? '+' : ''}${dAvg} | ΔPass ${dPass > 0 ? '+' : ''}${dPass} | ΔGaps ${dGap > 0 ? '+' : ''}${dGap}`;
    }

    // Trend charts
    if (timeline.length >= 2) {
      const chrono = timeline.slice().reverse();
      h += '<div class="cc-trend-charts">';
      h += renderTrendChart(chrono, 'avg_dm', 'Avg DM', 100);
      h += renderTrendChart(chrono, 'passed_60', 'Passed (60+)', Math.max(...timeline.map(r => r.dataset_size || r.total || 200)));
      h += renderTrendChart(chrono, 'gap_count', 'Gap Count', Math.max(...timeline.map(r => r.gap_count + 10)));
      h += '</div>';
    }

    // Run timeline table
    h += '<div class="cc-subsection"><div class="cc-subsection__title">Run History</div>';
    h += '<div class="cc-table-wrap"><table class="cc-table"><thead><tr>';
    h += '<th>Date</th><th>Queries</th><th>Mode</th><th>Avg DM</th><th>Δ</th><th>Pass 60+</th><th>Δ</th><th>Gaps</th><th>Δ</th>';
    h += '</tr></thead><tbody>';
    for (const r of timeline) {
      const date = r.created_at ? new Date(r.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—';
      const isCurrent = r.run_id === latest.run_id;
      h += `<tr${isCurrent ? ' style="font-weight:600"' : ''}>`;
      h += `<td>${date}</td>`;
      h += `<td>${r.dataset_size || r.total || '—'}</td>`;
      h += `<td><span class="cc-badge">${r.mode || '—'}</span></td>`;
      h += `<td class="dm-cell ${ragClass(Number(r.avg_dm))}">${r.avg_dm}</td>`;
      h += deltaCell(r.delta_avg_dm ? Number(r.delta_avg_dm) : null);
      h += `<td>${r.passed_60}</td>`;
      h += deltaCell(r.delta_passed_60);
      h += `<td>${r.gap_count}</td>`;
      h += deltaCell(r.delta_gap_count, true);
      h += '</tr>';
    }
    h += '</tbody></table></div></div>';

    el.innerHTML = h;
  } catch (e) {
    el.innerHTML = `<p style="color:var(--cc-red)">Failed to load trends: ${e.message}</p>`;
    historyLoaded = false;
  }
}

function deltaCell(val, invert) {
  if (val === null || val === undefined) return '<td style="color:var(--cc-text-3)">—</td>';
  const positive = invert ? val < 0 : val > 0;
  const negative = invert ? val > 0 : val < 0;
  const color = positive ? 'var(--cc-green)' : negative ? 'var(--cc-red)' : 'var(--cc-text-3)';
  const prefix = val > 0 ? '+' : '';
  return `<td style="color:${color};font-weight:500;font-family:var(--cc-mono)">${prefix}${val}</td>`;
}

function renderTrendChart(data, key, label, maxVal) {
  if (!data || data.length < 2) return '';
  const W = 260, H = 90, PAD = 22;
  const plotW = W - PAD * 2, plotH = H - PAD * 2;
  const n = data.length;
  const max = maxVal || Math.max(...data.map(d => d[key] || 0)) * 1.1;

  let points = '', dots = '';
  for (let i = 0; i < n; i++) {
    const x = PAD + (i / Math.max(n - 1, 1)) * plotW;
    const y = PAD + plotH - ((data[i][key] || 0) / max) * plotH;
    points += `${x},${y} `;
    const color = key === 'gap_count' ? 'var(--cc-amber)' : ragClass(data[i][key]) === 'rag-green' ? 'var(--cc-green)' : ragClass(data[i][key]) === 'rag-amber' ? 'var(--cc-amber)' : 'var(--cc-red)';
    dots += `<circle cx="${x}" cy="${y}" r="2.5" fill="${color}"><title>${data[i][key]}</title></circle>`;
  }

  return `<div class="cc-trend-chart">
    <div class="cc-trend-label">${label}</div>
    <svg viewBox="0 0 ${W} ${H}" width="${W}" height="${H}">
      <line x1="${PAD}" y1="${PAD + plotH}" x2="${PAD + plotW}" y2="${PAD + plotH}" stroke="var(--cc-border)" stroke-width="1"/>
      <polyline points="${points}" fill="none" stroke="var(--cc-accent)" stroke-width="1.5" stroke-linejoin="round"/>
      ${dots}
    </svg>
  </div>`;
}

function mkCard(value, label, colorClass) {
  return `<div class="cc-card"><div class="cc-card__value ${colorClass}">${value}</div><div class="cc-card__label">${label}</div></div>`;
}

// ═══════════════════════════════════════════════════════════════════
// Session Persistence to Supabase
// ═══════════════════════════════════════════════════════════════════

async function persistSessionToSupabase(results, startTime) {
  if (!results || results.length === 0) return;

  const { createClient } = await import('https://esm.sh/@supabase/supabase-js@2');
  // Use service role key to bypass RLS for admin writes
  const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

  const runId = 'cc-' + crypto.randomUUID().substring(0, 28);
  const total = results.length;
  const passed60 = results.filter(r => r.donde_match >= 60).length;
  const passed80 = results.filter(r => r.donde_match >= 80).length;
  const passed90 = results.filter(r => r.donde_match >= 90).length;
  const gapCount = results.filter(r => r.gap_type).length;
  const avgDm = Math.round(results.reduce((s, r) => s + r.donde_match, 0) / total * 10) / 10;

  // Category stats
  const catMap = {};
  for (const r of results) {
    const cat = r.category || 'unknown';
    if (!catMap[cat]) catMap[cat] = { total: 0, sum: 0, gaps: 0, pass: 0 };
    catMap[cat].total++;
    catMap[cat].sum += r.donde_match;
    if (r.gap_type) catMap[cat].gaps++;
    if (r.donde_match >= 60) catMap[cat].pass++;
  }
  const categoryStats = {};
  for (const [cat, s] of Object.entries(catMap)) {
    categoryStats[cat] = {
      total: s.total, avg_dm: Math.round(s.sum / s.total * 10) / 10,
      pass_rate: Math.round(s.pass / s.total * 100), gaps: s.gaps,
    };
  }

  // Factor averages
  const factors = ['food', 'vibe', 'service', 'reputation', 'convenience'];
  const factorAverages = {};
  for (const f of factors) {
    factorAverages[f] = Math.round(results.reduce((s, r) => s + (r[f] || 0), 0) / total * 10) / 10;
  }

  // Gap type stats
  const gapTypeStats = {};
  for (const r of results) {
    if (r.gap_type) gapTypeStats[r.gap_type] = (gapTypeStats[r.gap_type] || 0) + 1;
  }

  // Insert run
  const successful = results.filter(r => r.donde_match !== undefined && r.donde_match !== null).length;
  const { error: runError } = await sb.from('gauntlet_runs').insert({
    run_id: runId,
    total,
    successful,
    gap_count: gapCount,
    avg_dm: avgDm,
    passed_60: passed60,
    passed_80: passed80,
    passed_90: passed90,
    mode: 'command-center',
    dataset_hash: 'cc-live-' + new Date().toISOString().slice(0, 10),
    dataset_size: total,
    category_stats: categoryStats,
    factor_averages: factorAverages,
    gap_type_stats: gapTypeStats,
  });
  if (runError) throw runError;

  // Insert results
  const rows = results.map((r, i) => ({
    run_id: runId,
    query_id: `cc-q${i}`,
    query: r.query,
    category: r.category,
    donde_match: r.donde_match,
    gap_type: r.gap_type,
    gap_severity: r.gap_severity,
    restaurant_name: r.restaurant_name,
    tier: r.tier,
    relevance_type: r.relevance_type,
    food: r.food,
    vibe: r.vibe,
    service: r.service,
    reputation: r.reputation,
    convenience: r.convenience,
  }));

  const { error: resError } = await sb.from('gauntlet_results').insert(rows);
  if (resError) throw resError;

  return runId;
}

// ═══════════════════════════════════════════════════════════════════
// Data Maintenance Section
// ═══════════════════════════════════════════════════════════════════

async function loadMaintenanceSection() {
  if (maintenanceLoaded) return;
  maintenanceLoaded = true;
  const el = document.getElementById('maintenance-content');
  el.innerHTML = '<div class="cc-loading"><div class="cc-spinner"></div><p>Loading data health...</p></div>';

  try {
    const { createClient } = await import('https://esm.sh/@supabase/supabase-js@2');
    const sb = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

    // Fetch DB health stats in parallel
    const [
      totalRes, enrichedRes, scoresRes, tagsRes, deepRes,
      missingCuisineRes, missingTipRes, latestEnrichedRes,
      recentOpsRes,
    ] = await Promise.all([
      sb.from('restaurants').select('*', { count: 'exact', head: true }),
      sb.from('restaurants').select('*', { count: 'exact', head: true }).not('noise_level', 'is', null),
      sb.from('occasion_scores').select('*', { count: 'exact', head: true }),
      sb.from('restaurants').select('*', { count: 'exact', head: true }).not('semantic_tags', 'is', null),
      sb.from('restaurant_deep_profiles').select('*', { count: 'exact', head: true }),
      sb.from('restaurants').select('*', { count: 'exact', head: true }).is('cuisine_type', null),
      sb.from('restaurants').select('*', { count: 'exact', head: true }).is('insider_tip', null),
      sb.from('restaurants').select('enriched_at').not('enriched_at', 'is', null).order('enriched_at', { ascending: false }).limit(1),
      sb.from('maintenance_requests').select('*').order('requested_at', { ascending: false }).limit(10).then(r => r).catch(() => ({ data: [] })),
    ]);

    const totalCount = totalRes.count || 0;
    const enrichedCount = enrichedRes.count || 0;
    const scoresCount = scoresRes.count || 0;
    const tagsCount = tagsRes.count || 0;
    const deepCount = deepRes.count || 0;
    const missingCuisine = missingCuisineRes.count || 0;
    const missingTip = missingTipRes.count || 0;
    const latestEnriched = latestEnrichedRes.data?.[0]?.enriched_at;
    const recentOps = recentOpsRes.data || [];

    renderMaintenanceSection(el, {
      totalCount, enrichedCount, scoresCount, tagsCount, deepCount,
      missingCuisine, missingTip, latestEnriched, recentOps,
    });

    // Start polling if any running operations
    if (recentOps.some(op => op.status === 'running')) {
      startMaintenancePolling();
    }
  } catch (e) {
    el.innerHTML = `<p style="color:var(--cc-red)">Failed to load data health: ${e.message}</p>`;
    maintenanceLoaded = false;
  }
}

function renderMaintenanceSection(el, stats) {
  const { totalCount, enrichedCount, scoresCount, tagsCount, deepCount,
    missingCuisine, missingTip, latestEnriched, recentOps } = stats;

  const enrichedPct = totalCount > 0 ? Math.round(enrichedCount / totalCount * 100) : 0;
  const scoresPct = totalCount > 0 ? Math.round(scoresCount / totalCount * 100) : 0;
  const tagsPct = totalCount > 0 ? Math.round(tagsCount / totalCount * 100) : 0;
  const deepPct = totalCount > 0 ? Math.round(deepCount / totalCount * 100) : 0;

  const healthClass = (pct) => pct >= 90 ? 'rag-green' : pct >= 70 ? 'rag-amber' : 'rag-red';

  let h = '';

  // Update section summary
  const summaryEl = document.getElementById('maintenance-summary');
  if (summaryEl) summaryEl.textContent = `${totalCount} restaurants | ${enrichedPct}% enriched`;

  // Health Stats
  h += '<div class="cc-subsection"><div class="cc-subsection__title">Database Health</div>';
  h += '<div class="cc-cards">';
  h += mkCard(totalCount, 'Restaurants', '');
  h += mkCard(enrichedPct + '%', 'Enriched', healthClass(enrichedPct));
  h += mkCard(scoresPct + '%', 'Has Scores', healthClass(scoresPct));
  h += mkCard(tagsPct + '%', 'Has Tags', healthClass(tagsPct));
  h += mkCard(deepPct + '%', 'Deep Profiles', healthClass(deepPct));
  h += mkCard(missingCuisine, 'No Cuisine', missingCuisine > 10 ? 'rag-red' : missingCuisine > 0 ? 'rag-amber' : 'rag-green');
  h += mkCard(missingTip, 'No Insider Tip', missingTip > 50 ? 'rag-red' : missingTip > 10 ? 'rag-amber' : 'rag-green');
  h += mkCard(latestEnriched ? new Date(latestEnriched).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : '--', 'Last Enriched', '');
  h += '</div></div>';

  // Pipeline Cards
  h += '<div class="cc-subsection"><div class="cc-subsection__title">Pipelines</div>';
  h += '<div class="cc-pipeline-grid">';

  for (const pipeline of PIPELINES) {
    const lastOp = recentOps.find(op => op.operation === pipeline.id);
    const stages = lastOp?.stages || pipeline.stages.map(s => ({ name: s, status: 'pending' }));
    const isRunning = lastOp?.status === 'running';

    h += `<div class="cc-pipeline" data-pipeline="${pipeline.id}">`;
    h += `<div class="cc-pipeline__header">`;
    h += `<div class="cc-pipeline__icon">${pipeline.icon}</div>`;
    h += `<div class="cc-pipeline__info">`;
    h += `<div class="cc-pipeline__name">${pipeline.name}</div>`;
    h += `<div class="cc-pipeline__desc">${pipeline.desc}</div>`;
    h += `</div></div>`;

    // Visual stage flow
    h += '<div class="cc-pipeline__stages">';
    const stageList = Array.isArray(stages) && stages[0]?.name ? stages : pipeline.stages.map(s => ({ name: s, status: 'pending' }));
    for (let i = 0; i < stageList.length; i++) {
      const stage = stageList[i];
      const statusClass = stage.status === 'complete' ? 'cc-pipeline__dot--complete'
        : stage.status === 'running' ? 'cc-pipeline__dot--running'
        : stage.status === 'failed' ? 'cc-pipeline__dot--failed'
        : 'cc-pipeline__dot--pending';
      const connectorClass = stage.status === 'complete' ? 'cc-pipeline__connector--complete' : '';

      if (i > 0) h += `<div class="cc-pipeline__connector ${connectorClass}"></div>`;
      h += `<div class="cc-pipeline__stage">`;
      h += `<div class="cc-pipeline__dot ${statusClass}"></div>`;
      h += `<div class="cc-pipeline__stage-label">${typeof stage === 'string' ? stage : stage.name}</div>`;
      h += `</div>`;
    }
    h += '</div>';

    // Footer: last run + cost + button
    h += '<div class="cc-pipeline__footer">';
    if (lastOp) {
      const date = new Date(lastOp.requested_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
      const statusBadge = lastOp.status === 'complete' ? 'cc-badge--auto' : lastOp.status === 'running' ? 'cc-badge--tuning' : lastOp.status === 'failed' ? 'cc-badge--p0' : '';
      h += `<span class="cc-pipeline__last-run">${date} <span class="cc-badge ${statusBadge}">${lastOp.status}</span></span>`;
    } else {
      h += '<span class="cc-pipeline__last-run cc-muted">Never run</span>';
    }
    h += `<span class="cc-pipeline__cost">${pipeline.cost}</span>`;
    h += `<button class="cc-btn cc-btn--primary cc-pipeline__run-btn" data-op="${pipeline.id}" onclick="requestPipelineRun('${pipeline.id}')" ${isRunning ? 'disabled' : ''}>`;
    h += isRunning ? 'Running...' : 'Request Run';
    h += '</button>';
    h += '</div></div>';
  }
  h += '</div></div>';

  // Recent Operations
  if (recentOps.length > 0) {
    h += '<div class="cc-subsection"><div class="cc-subsection__title">Recent Operations</div>';
    h += '<div class="cc-table-wrap"><table class="cc-table"><thead><tr>';
    h += '<th>Date</th><th>Operation</th><th>Status</th><th>Duration</th><th>Result</th>';
    h += '</tr></thead><tbody>';
    for (const op of recentOps) {
      const date = new Date(op.requested_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
      const statusBadge = op.status === 'complete' ? 'cc-badge--auto'
        : op.status === 'running' ? 'cc-badge--tuning'
        : op.status === 'failed' ? 'cc-badge--p0' : '';
      const duration = op.completed_at && op.started_at
        ? Math.round((new Date(op.completed_at) - new Date(op.started_at)) / 1000) + 's'
        : op.started_at ? 'In progress' : '--';
      const resultText = op.result ? `${op.result.rows_affected || 0} rows` : '--';
      h += `<tr>
        <td>${date}</td>
        <td><strong>${op.operation}</strong></td>
        <td><span class="cc-badge ${statusBadge}">${op.status}</span></td>
        <td style="font-family:var(--cc-mono);font-size:0.68rem">${duration}</td>
        <td style="font-size:0.68rem;color:var(--cc-text-2)">${resultText}</td>
      </tr>`;
    }
    h += '</tbody></table></div></div>';
  }

  el.innerHTML = h;
}

async function requestPipelineRun(operationId) {
  const btn = document.querySelector(`.cc-pipeline__run-btn[data-op="${operationId}"]`);
  if (btn) { btn.disabled = true; btn.textContent = 'Requesting...'; }

  try {
    const { createClient } = await import('https://esm.sh/@supabase/supabase-js@2');
    const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

    const pipeline = PIPELINES.find(p => p.id === operationId);
    const stages = pipeline ? pipeline.stages.map(s => ({ name: s, status: 'pending' })) : [];

    const { error } = await sb.from('maintenance_requests').insert({
      operation: operationId,
      status: 'pending',
      requested_by: 'ceo',
      stages,
    });

    if (error) throw error;
    if (btn) { btn.textContent = 'Requested'; btn.classList.remove('cc-btn--primary'); }
    addLog('SYSTEM', `Pipeline "${operationId}" requested. Awaiting backend execution.`, 'star');
    addNotification('pipeline', `Pipeline "${operationId}" has been queued.`, 'system');

    // Reload to show new entry
    maintenanceLoaded = false;
    setTimeout(() => loadMaintenanceSection(), 1000);
  } catch (e) {
    if (btn) { btn.disabled = false; btn.textContent = 'Request Run'; }
    addLog('SYSTEM', `Failed to request pipeline: ${e.message}`, 'fail');
  }
}

function startMaintenancePolling() {
  if (maintenancePollTimer) return;
  maintenancePollTimer = setInterval(async () => {
    try {
      const { createClient } = await import('https://esm.sh/@supabase/supabase-js@2');
      const sb = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
      const { data: running } = await sb.from('maintenance_requests')
        .select('*').eq('status', 'running').limit(5);

      if (!running || running.length === 0) {
        clearInterval(maintenancePollTimer);
        maintenancePollTimer = null;
        // Reload section to show final state
        maintenanceLoaded = false;
        loadMaintenanceSection();
        return;
      }

      // Update pipeline stage dots
      for (const op of running) {
        const pipelineEl = document.querySelector(`.cc-pipeline[data-pipeline="${op.operation}"]`);
        if (!pipelineEl || !op.stages) continue;
        const dots = pipelineEl.querySelectorAll('.cc-pipeline__dot');
        const connectors = pipelineEl.querySelectorAll('.cc-pipeline__connector');
        op.stages.forEach((stage, i) => {
          if (dots[i]) {
            dots[i].className = 'cc-pipeline__dot';
            if (stage.status === 'complete') dots[i].classList.add('cc-pipeline__dot--complete');
            else if (stage.status === 'running') dots[i].classList.add('cc-pipeline__dot--running');
            else if (stage.status === 'failed') dots[i].classList.add('cc-pipeline__dot--failed');
            else dots[i].classList.add('cc-pipeline__dot--pending');
          }
          if (connectors[i - 1] && stage.status === 'complete') {
            connectors[i - 1].classList.add('cc-pipeline__connector--complete');
          }
        });
      }
    } catch (e) { /* ignore polling errors */ }
  }, 10000);
}

// ═══════════════════════════════════════════════════════════════════
// Rerun & Compare
// ═══════════════════════════════════════════════════════════════════

let rerunAbort = null;

async function openRerunPicker() {
  const overlay = document.getElementById('rerun-overlay');
  const list = document.getElementById('rerun-list');
  if (!overlay) return;
  overlay.style.display = '';
  list.innerHTML = '<div class="cc-loading"><div class="cc-spinner"></div><p>Loading runs...</p></div>';

  try {
    const { createClient } = await import('https://esm.sh/@supabase/supabase-js@2');
    const sb = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    const { data: runs } = await sb
      .from('gauntlet_runs')
      .select('run_id, total, gap_count, avg_dm, created_at, mode, dataset_size')
      .order('created_at', { ascending: false })
      .limit(15);

    if (!runs || runs.length === 0) {
      list.innerHTML = '<p class="cc-muted" style="padding:20px;text-align:center">No previous runs found.</p>';
      return;
    }

    let html = '';
    for (const r of runs) {
      const date = new Date(r.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
      const passRate = r.total > 0 ? Math.round(((r.total - r.gap_count) / r.total) * 100) : 0;
      html += `<div class="cc-rerun-item" onclick="startRerun('${r.run_id}')">
        <div class="cc-rerun-item__date">${date}</div>
        <div class="cc-rerun-item__stats">DM ${r.avg_dm} &middot; ${r.gap_count} gaps &middot; ${passRate}% pass</div>
        <div class="cc-rerun-item__queries">${r.total}q ${r.mode || ''}</div>
        <div class="cc-rerun-item__go">Rerun &#8594;</div>
      </div>`;
    }
    list.innerHTML = html;
  } catch (e) {
    list.innerHTML = `<p style="color:var(--cc-red);padding:20px">Failed: ${e.message}</p>`;
  }
}

function closeRerunPicker(e) {
  if (e && e.target !== e.currentTarget) return;
  const overlay = document.getElementById('rerun-overlay');
  if (overlay) overlay.style.display = 'none';
  if (rerunAbort) { rerunAbort.abort(); rerunAbort = null; }
}

async function startRerun(runId) {
  const list = document.getElementById('rerun-list');

  // Fetch old queries for this run
  list.innerHTML = '<div class="cc-loading"><div class="cc-spinner"></div><p>Fetching original queries...</p></div>';

  try {
    const { createClient } = await import('https://esm.sh/@supabase/supabase-js@2');
    const sb = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

    const { data: oldResults } = await sb
      .from('gauntlet_results')
      .select('query, category, donde_match, gap_type, gap_severity, restaurant_name, food, vibe, service, reputation, convenience')
      .eq('run_id', runId)
      .order('donde_match', { ascending: true });

    if (!oldResults || oldResults.length === 0) {
      list.innerHTML = '<p style="color:var(--cc-red);padding:20px">No queries found for this run.</p>';
      return;
    }

    // Show progress and start re-executing
    rerunAbort = new AbortController();
    const total = oldResults.length;
    list.innerHTML = `<div class="cc-rerun-progress">
      <div style="font-size:0.85rem;font-weight:600;margin-bottom:4px">Re-running ${total} queries...</div>
      <div class="cc-rerun-progress__bar"><div class="cc-rerun-progress__fill" id="rerun-fill" style="width:0%"></div></div>
      <div class="cc-rerun-progress__text" id="rerun-status">0 / ${total}</div>
      <div class="cc-rerun-progress__query" id="rerun-query">Starting...</div>
    </div>`;

    const newResults = [];
    const fillEl = document.getElementById('rerun-fill');
    const statusEl = document.getElementById('rerun-status');
    const queryEl = document.getElementById('rerun-query');

    for (let i = 0; i < total; i++) {
      if (rerunAbort.signal.aborted) return;

      const q = oldResults[i].query;
      if (queryEl) queryEl.textContent = q;
      if (statusEl) statusEl.textContent = `${i + 1} / ${total}`;
      if (fillEl) fillEl.style.width = `${Math.round(((i + 1) / total) * 100)}%`;

      try {
        const result = await callAPI(q);
        if (result.success) {
          newResults.push({
            query: q,
            donde_match: result.donde_match || 0,
            restaurant_name: result.restaurant?.name || '',
            category: oldResults[i].category,
            food: result.scoring_v9?.food || 0,
            vibe: result.scoring_v9?.vibe || 0,
            service: result.scoring_v9?.service || 0,
            reputation: result.scoring_v9?.reputation || 0,
            convenience: result.scoring_v9?.convenience || 0,
            gap_type: (result.donde_match || 0) < 60 ? 'rerun' : null,
          });
        } else {
          newResults.push({
            query: q, donde_match: 0, restaurant_name: 'API Error',
            category: oldResults[i].category,
            food: 0, vibe: 0, service: 0, reputation: 0, convenience: 0,
            gap_type: 'error',
          });
        }
      } catch (e) {
        newResults.push({
          query: q, donde_match: 0, restaurant_name: 'Error',
          category: oldResults[i].category,
          food: 0, vibe: 0, service: 0, reputation: 0, convenience: 0,
          gap_type: 'error',
        });
      }
    }

    // Close modal and show comparison
    closeRerunPicker();
    renderComparison(oldResults, newResults);

  } catch (e) {
    list.innerHTML = `<p style="color:var(--cc-red);padding:20px">Failed: ${e.message}</p>`;
  }
}

function renderComparison(oldResults, newResults) {
  // Open the Test Results section
  const section = document.getElementById('section-results');
  if (section && !section.classList.contains('cc-section--open')) {
    section.classList.add('cc-section--open');
    const body = section.querySelector('.cc-section__body');
    const chevron = section.querySelector('.cc-section__chevron');
    if (body) body.style.display = '';
    if (chevron) chevron.innerHTML = '&#9662;';
  }

  const resultsEl = document.getElementById('results-content');
  if (!resultsEl) return;

  // Calculate aggregate deltas
  const oldAvg = oldResults.reduce((s, r) => s + r.donde_match, 0) / oldResults.length;
  const newAvg = newResults.reduce((s, r) => s + r.donde_match, 0) / newResults.length;
  const deltaAvg = Math.round((newAvg - oldAvg) * 10) / 10;

  const oldPass = oldResults.filter(r => r.donde_match >= 60).length;
  const newPass = newResults.filter(r => r.donde_match >= 60).length;
  const deltaPass = newPass - oldPass;

  const oldGaps = oldResults.filter(r => r.gap_type).length;
  const newGaps = newResults.filter(r => r.donde_match < 60).length;
  const deltaGaps = newGaps - oldGaps;

  const oldExcel = oldResults.filter(r => r.donde_match >= 80).length;
  const newExcel = newResults.filter(r => r.donde_match >= 80).length;
  const deltaExcel = newExcel - oldExcel;

  const total = oldResults.length;
  const improved = newResults.filter((r, i) => r.donde_match > oldResults[i].donde_match).length;
  const regressed = newResults.filter((r, i) => r.donde_match < oldResults[i].donde_match).length;
  const unchanged = total - improved - regressed;

  let html = '';

  // Comparison banner
  html += `<div class="cc-compare-banner">
    <span class="cc-compare-banner__icon">&#8635;</span>
    <span class="cc-compare-banner__text"><strong>Rerun Comparison</strong> — ${total} queries replayed against current engine</span>
    <button class="cc-compare-banner__dismiss" onclick="this.closest('.cc-compare-banner').remove()" title="Dismiss">&times;</button>
  </div>`;

  // Delta cards
  const deltaClass = (v, invert) => {
    const pos = invert ? v < 0 : v > 0;
    const neg = invert ? v > 0 : v < 0;
    return pos ? 'positive' : neg ? 'negative' : 'neutral';
  };
  const fmtDelta = (v) => v > 0 ? `+${v}` : `${v}`;

  html += '<div class="cc-compare-deltas">';
  html += `<div class="cc-compare-delta"><div class="cc-compare-delta__val ${deltaClass(deltaAvg)}">${fmtDelta(deltaAvg)}</div><div class="cc-compare-delta__label">Avg DM Δ</div><div class="cc-compare-delta__sub">${Math.round(oldAvg*10)/10} → ${Math.round(newAvg*10)/10}</div></div>`;
  html += `<div class="cc-compare-delta"><div class="cc-compare-delta__val ${deltaClass(deltaPass)}">${fmtDelta(deltaPass)}</div><div class="cc-compare-delta__label">Pass Rate Δ</div><div class="cc-compare-delta__sub">${oldPass} → ${newPass} of ${total}</div></div>`;
  html += `<div class="cc-compare-delta"><div class="cc-compare-delta__val ${deltaClass(deltaGaps, true)}">${fmtDelta(deltaGaps)}</div><div class="cc-compare-delta__label">Gaps Δ</div><div class="cc-compare-delta__sub">${oldGaps} → ${newGaps}</div></div>`;
  html += `<div class="cc-compare-delta"><div class="cc-compare-delta__val ${deltaClass(deltaExcel)}">${fmtDelta(deltaExcel)}</div><div class="cc-compare-delta__label">Excel ≥80 Δ</div><div class="cc-compare-delta__sub">${oldExcel} → ${newExcel}</div></div>`;
  html += `<div class="cc-compare-delta"><div class="cc-compare-delta__val positive">${improved}</div><div class="cc-compare-delta__label">Improved</div></div>`;
  html += `<div class="cc-compare-delta"><div class="cc-compare-delta__val negative">${regressed}</div><div class="cc-compare-delta__label">Regressed</div></div>`;
  html += '</div>';

  // Per-query comparison table
  html += '<div class="cc-table-wrap"><table class="cc-compare-table"><thead><tr>';
  html += '<th>#</th><th>Query</th><th>Old DM</th><th>New DM</th><th>Δ</th><th>Old Restaurant</th><th>New Restaurant</th>';
  html += '</tr></thead><tbody>';

  // Sort by biggest regression first (most negative delta)
  const paired = oldResults.map((old, i) => ({ old, new_: newResults[i], idx: i }));
  paired.sort((a, b) => (a.new_.donde_match - a.old.donde_match) - (b.new_.donde_match - b.old.donde_match));

  for (const { old, new_, idx } of paired) {
    const delta = new_.donde_match - old.donde_match;
    const deltaStr = delta > 0 ? `+${delta}` : `${delta}`;
    const deltaCls = delta > 0 ? 'cc-delta-up' : delta < 0 ? 'cc-delta-down' : 'cc-delta-same';
    html += `<tr>
      <td>${idx + 1}</td>
      <td title="${escapeHtml(old.query)}">${escapeHtml(old.query.substring(0, 40))}</td>
      <td><span class="dm-badge ${ragClass(old.donde_match)}">${old.donde_match}</span></td>
      <td><span class="dm-badge ${ragClass(new_.donde_match)}">${new_.donde_match}</span></td>
      <td class="${deltaCls}">${deltaStr}</td>
      <td style="font-size:0.65rem">${escapeHtml((old.restaurant_name || '—').substring(0, 22))}</td>
      <td style="font-size:0.65rem">${escapeHtml((new_.restaurant_name || '—').substring(0, 22))}</td>
    </tr>`;
  }
  html += '</tbody></table></div>';

  // Update Pulse cards with comparison data
  updateHeroKPIsFromGauntlet({
    summary: {
      total, avg_dm: Math.round(newAvg * 10) / 10,
      passed60: newPass, passed80: newExcel, gap_count: newGaps,
    },
  });

  // Update summary
  const summaryEl = document.getElementById('results-summary');
  if (summaryEl) {
    summaryEl.innerHTML = `<span style="color:var(--cc-amber)">&#8635; Rerun</span> &middot; ΔDM <span class="${deltaClass(deltaAvg)}">${fmtDelta(deltaAvg)}</span> &middot; ${improved}↑ ${regressed}↓`;
  }

  resultsEl.innerHTML = html;
}
