/**
 * DondeAI Command Center — Query Pool (Lazy-loaded)
 * Queries moved to data/cc-queries.json for code splitting (~67KB savings).
 * This file provides the same CHICAGO_QUERIES and DIFFICULTY_LEVELS globals
 * but loads them from a JSON file on first access.
 */

// Globals expected by cc-ui.js, cc-tests.js, cc-agents.js
let CHICAGO_QUERIES = [];
let DIFFICULTY_LEVELS = {
  easy:      { label: 'Easy',      color: '#22c55e', tolerance: 55, desc: 'Common queries — should ace these' },
  medium:    { label: 'Medium',    color: '#3b82f6', tolerance: 45, desc: 'Multi-concept — solid coverage expected' },
  hard:      { label: 'Hard',      color: '#f59e0b', tolerance: 35, desc: 'Complex constraints — stretch goals' },
  very_hard: { label: 'Very Hard', color: '#ef4444', tolerance: 25, desc: 'Adversarial — aspirational targets' },
};

let _queriesLoaded = false;
let _queriesLoadPromise = null;

/**
 * Load queries from JSON file. Called automatically on script load,
 * but consumers can await this if they need queries immediately.
 * @returns {Promise<void>}
 */
function loadCCQueries() {
  if (_queriesLoadPromise) return _queriesLoadPromise;
  _queriesLoadPromise = fetch('data/cc-queries.json')
    .then(r => {
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      return r.json();
    })
    .then(data => {
      if (data.queries && Array.isArray(data.queries)) {
        CHICAGO_QUERIES = data.queries;
      }
      if (data.difficulty_levels) {
        // Restore em-dash from JSON (JSON used --)
        Object.assign(DIFFICULTY_LEVELS, data.difficulty_levels);
      }
      _queriesLoaded = true;
      console.log(`[CC] Loaded ${CHICAGO_QUERIES.length} queries from cc-queries.json`);
    })
    .catch(err => {
      console.warn('[CC] Failed to load cc-queries.json, queries unavailable:', err.message);
    });
  return _queriesLoadPromise;
}

// Auto-load on script execution
loadCCQueries();
