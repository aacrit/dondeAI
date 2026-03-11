/**
 * DondeAI Command Center — Generated Queries Browser
 * Loads persona-driven test queries from data/generated-queries.json
 * Provides filtering by category, demographic, time of day, occasion
 */

// ═══════════════════════════════════════════════════════════════════
// State
// ═══════════════════════════════════════════════════════════════════

let generatedQueries = [];
let generatedMeta = null;
let genQueryFilters = { category: 'all', time: 'all', culture: 'all', age: 'all', occasion: 'all' };
let genQueriesLoaded = false;

// ═══════════════════════════════════════════════════════════════════
// Load
// ═══════════════════════════════════════════════════════════════════

async function loadGeneratedQueries() {
  try {
    const res = await fetch('data/generated-queries.json?t=' + Date.now());
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    generatedMeta = data.metadata || null;
    generatedQueries = data.queries || [];
    genQueriesLoaded = true;
    renderGenQueriesBadge();
    renderGenQueriesPanel();
  } catch (err) {
    console.warn('Could not load generated queries:', err.message);
    generatedQueries = [];
    generatedMeta = null;
    genQueriesLoaded = true;
    renderGenQueriesBadge();
    renderGenQueriesPanel();
  }
}

// ═══════════════════════════════════════════════════════════════════
// Filter
// ═══════════════════════════════════════════════════════════════════

function getFilteredGenQueries() {
  return generatedQueries.filter(q => {
    if (genQueryFilters.category !== 'all' && q.category !== genQueryFilters.category) return false;
    if (genQueryFilters.time !== 'all' && q.time_of_day !== genQueryFilters.time) return false;
    if (genQueryFilters.culture !== 'all' && q.cultural_background !== genQueryFilters.culture) return false;
    if (genQueryFilters.age !== 'all' && q.age_group !== genQueryFilters.age) return false;
    if (genQueryFilters.occasion !== 'all' && q.occasion !== genQueryFilters.occasion) return false;
    return true;
  });
}

function setGenFilter(key, value) {
  genQueryFilters[key] = value;
  renderGenQueriesPanel();
}

// ═══════════════════════════════════════════════════════════════════
// Unique filter values
// ═══════════════════════════════════════════════════════════════════

function getGenFilterOptions(field) {
  const vals = new Set();
  generatedQueries.forEach(q => { if (q[field]) vals.add(q[field]); });
  return [...vals].sort();
}

// ═══════════════════════════════════════════════════════════════════
// Render
// ═══════════════════════════════════════════════════════════════════

function renderGenQueriesBadge() {
  const badge = document.getElementById('gen-queries-count');
  if (badge) {
    badge.textContent = generatedQueries.length > 0 ? `(${generatedQueries.length})` : '(0)';
  }
}

function renderGenQueriesPanel() {
  const panel = document.getElementById('gen-queries-body');
  if (!panel) return;

  const filtered = getFilteredGenQueries();

  // Build metadata summary
  let metaHtml = '';
  if (generatedMeta) {
    const dist = generatedMeta.distribution || {};
    metaHtml = `<div class="cc-gen-meta">
      <span class="cc-gen-meta__item">${generatedMeta.total_queries} total</span>
      ${generatedMeta.last_generated ? `<span class="cc-gen-meta__item">Updated: ${timeAgo(generatedMeta.last_generated)}</span>` : ''}
    </div>`;
  }

  // Build filter bar with dynamic options
  const categories = getGenFilterOptions('category');
  const times = getGenFilterOptions('time_of_day');
  const cultures = getGenFilterOptions('cultural_background');
  const ages = getGenFilterOptions('age_group');
  const occasions = getGenFilterOptions('occasion');

  const filterHtml = `<div class="cc-gen-filters">
    ${buildGenSelect('category', 'Category', categories)}
    ${buildGenSelect('time', 'Time', times)}
    ${buildGenSelect('culture', 'Culture', cultures)}
    ${buildGenSelect('age', 'Age', ages)}
    ${buildGenSelect('occasion', 'Occasion', occasions)}
    <span class="cc-gen-filters__count">${filtered.length} shown</span>
  </div>`;

  // Build query list (max 50 visible, scrollable)
  let listHtml = '';
  if (filtered.length === 0) {
    listHtml = `<div class="cc-gen-empty">${generatedQueries.length === 0 ? 'No generated queries yet. Run /gen-test-queries to populate.' : 'No queries match current filters.'}</div>`;
  } else {
    const display = filtered.slice(0, 100);
    listHtml = `<div class="cc-gen-list">
      ${display.map((q, i) => renderGenQueryRow(q, i)).join('')}
      ${filtered.length > 100 ? `<div class="cc-gen-more">+ ${filtered.length - 100} more queries</div>` : ''}
    </div>`;
  }

  // Actions bar
  const actionsHtml = filtered.length > 0 ? `<div class="cc-gen-actions">
    <button class="cc-btn cc-btn--xs" onclick="addGenQueriesToPool('filtered')" title="Add filtered queries to test pool">Use in Tests (${Math.min(filtered.length, 50)})</button>
    <button class="cc-btn cc-btn--xs" onclick="addGenQueriesToPool('all')" title="Add all generated queries to test pool">Use All (${generatedQueries.length})</button>
    <button class="cc-btn cc-btn--xs" onclick="loadGeneratedQueries()" title="Reload from file">Refresh</button>
  </div>` : `<div class="cc-gen-actions">
    <button class="cc-btn cc-btn--xs" onclick="loadGeneratedQueries()" title="Reload from file">Refresh</button>
  </div>`;

  panel.innerHTML = metaHtml + filterHtml + actionsHtml + listHtml;
}

function buildGenSelect(key, label, options) {
  if (options.length === 0) return '';
  const current = genQueryFilters[key];
  return `<select class="cc-gen-filters__select" onchange="setGenFilter('${key}', this.value)" title="${label}">
    <option value="all"${current === 'all' ? ' selected' : ''}>All ${label}</option>
    ${options.map(o => `<option value="${escapeHtml(o)}"${current === o ? ' selected' : ''}>${escapeHtml(o)}</option>`).join('')}
  </select>`;
}

function renderGenQueryRow(q, idx) {
  const catColor = QUERY_CATEGORIES[q.category]?.color || '#888';
  const persona = [q.cultural_background, q.age_group, q.gender].filter(Boolean).join(' / ');
  const context = [q.time_of_day, q.occasion].filter(Boolean).join(' / ');

  return `<div class="cc-gen-row">
    <span class="cc-gen-row__cat" style="color:${catColor}">${escapeHtml(q.category || '?')}</span>
    <span class="cc-gen-row__query">${escapeHtml(q.query || q.special_request || '')}</span>
    ${persona ? `<span class="cc-gen-row__persona">${escapeHtml(persona)}</span>` : ''}
    ${context ? `<span class="cc-gen-row__context">${escapeHtml(context)}</span>` : ''}
    <button class="cc-gen-row__use" onclick="addSingleGenQuery(${idx})" title="Add to custom queries">+</button>
  </div>`;
}

// ═══════════════════════════════════════════════════════════════════
// Actions
// ═══════════════════════════════════════════════════════════════════

/** Add a single generated query to custom queries */
function addSingleGenQuery(idx) {
  const filtered = getFilteredGenQueries();
  const q = filtered[idx];
  if (!q) return;

  const queryText = q.query || q.special_request || '';
  if (!queryText) return;

  // Check for duplicate
  if (state.customQueries.some(cq => cq.query.toLowerCase() === queryText.toLowerCase())) {
    showToast('Already in your queries');
    return;
  }

  state.customQueries.push({
    query: queryText,
    cat: q.category || 'Food',
    id: 'gen-' + Date.now().toString(36)
  });
  saveCustomQueries();
  renderCustomQueryList();
  showToast('Added to your queries');
}

/** Add batch of generated queries to the pool for testing */
function addGenQueriesToPool(scope) {
  const queries = scope === 'all' ? generatedQueries : getFilteredGenQueries();
  const limit = Math.min(queries.length, 50);
  let added = 0;

  for (let i = 0; i < limit; i++) {
    const q = queries[i];
    const queryText = q.query || q.special_request || '';
    if (!queryText) continue;
    if (state.customQueries.some(cq => cq.query.toLowerCase() === queryText.toLowerCase())) continue;

    state.customQueries.push({
      query: queryText,
      cat: q.category || 'Food',
      id: 'gen-' + Date.now().toString(36) + '-' + i
    });
    added++;
  }

  saveCustomQueries();
  renderCustomQueryList();
  showToast(`Added ${added} queries to test pool`);
}

// ═══════════════════════════════════════════════════════════════════
// Init — load on dashboard ready
// ═══════════════════════════════════════════════════════════════════

// Called from cc-analytics.js after auth, or on DOMContentLoaded
document.addEventListener('DOMContentLoaded', () => {
  // Delay slightly so other modules init first
  setTimeout(loadGeneratedQueries, 500);
});
