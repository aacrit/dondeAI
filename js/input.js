/* ============================================
   DondeAI v11 — Input, Filters & History
   Handles the idle phase UI interactions.
   ============================================ */

import { getState, setState } from './state.js';
import { loadHistory } from './persistence.js';
import { getLabels } from './theme.js';
import { matchCulture } from './utils.js';
import { setThemeVisualOnly, revertAutoTheme } from './theme.js';
import { getScoreColor } from './utils.js';

/* ---- DOM Cache ---- */
const $ = (id) => document.getElementById(id);

let inputEl, filtersToggle, filtersEl, filterChips,
    historyList, voiceBtn, submitBtn, promptText;

/* ---- Neighborhoods (Chicago) ---- */
const NEIGHBORHOODS = [
  'Anywhere', 'Loop', 'River North', 'Gold Coast', 'Lincoln Park',
  'Wicker Park', 'Bucktown', 'Logan Square', 'West Loop', 'Fulton Market',
  'Pilsen', 'Chinatown', 'Hyde Park', 'Lakeview', 'Andersonville',
  'Old Town', 'Streeterville', 'South Loop', 'Uptown', 'Ravenswood',
  'Humboldt Park', 'Bridgeport', 'Little Italy', 'Ukrainian Village',
  'Albany Park', 'Avondale', 'Edgewater', 'Rogers Park', 'Lincoln Square',
  'Devon Ave', 'Evanston',
];

/* ---- Dietary Options ---- */
const DIETARY = [
  'None', 'Vegetarian', 'Vegan', 'Gluten-Free', 'Halal',
  'Kosher', 'Dairy-Free', 'Nut-Free',
];

export function initInput() {
  inputEl = $('craving-input');
  filtersToggle = $('filters-toggle');
  filtersEl = $('filters');
  historyList = $('history-list');
  voiceBtn = $('voice-btn');
  submitBtn = $('submit-btn');
  promptText = $('prompt-text');

  if (!inputEl) return;

  // Auto-focus on idle
  inputEl.focus();

  // Input change — show/hide submit, auto-theme
  inputEl.addEventListener('input', onInputChange);
  inputEl.addEventListener('keydown', onInputKeydown);

  // Filters toggle
  if (filtersToggle) {
    filtersToggle.addEventListener('click', toggleFilters);
  }

  // Filter chip delegation
  if (filtersEl) {
    filtersEl.addEventListener('click', onFilterChipClick);
  }

  // Populate sheets
  populateHoodSheet();
  populateDietarySheet();

  // Render history
  renderHistory();
}

/* ---- Input Handlers ---- */
function onInputChange() {
  const val = inputEl.value.trim();
  setState({ craving: val });

  // Show/hide submit button
  if (submitBtn) submitBtn.hidden = !val;
  if (voiceBtn) voiceBtn.hidden = !!val;

  // Auto-theme on typing
  if (val.length >= 3) {
    const culture = matchCulture(val);
    if (culture) {
      setThemeVisualOnly(culture);
    } else {
      revertAutoTheme();
    }
  } else {
    revertAutoTheme();
  }
}

function onInputKeydown(e) {
  if (e.key === 'Enter' && inputEl.value.trim()) {
    e.preventDefault();
    // Dispatch search event — app.js listens
    document.dispatchEvent(new CustomEvent('donde:search'));
  }
}

/* ---- Filters Toggle ---- */
function toggleFilters() {
  const isOpen = !filtersEl.hidden;
  filtersEl.hidden = isOpen;
  filtersToggle.classList.toggle('is-open', !isOpen);
  const text = $('filters-toggle-text');
  if (text) text.textContent = isOpen ? 'Filters' : 'Filters';
}

/* ---- Filter Chip Click ---- */
function onFilterChipClick(e) {
  const chip = e.target.closest('.filters__chip');
  if (!chip) return;

  const filter = chip.dataset.filter;
  const value = chip.dataset.value;

  if (!filter && chip.dataset.action) {
    // Open bottom sheet
    if (chip.dataset.action === 'open-hood-sheet') {
      openSheet('hood-sheet');
    } else if (chip.dataset.action === 'open-dietary-sheet') {
      openSheet('dietary-sheet');
    }
    return;
  }

  // Chip pop animation
  chip.classList.remove('chip-pop');
  void chip.offsetWidth;
  chip.classList.add('chip-pop');

  if (filter === 'occasion' || filter === 'priceLevel') {
    // Radio group: toggle off if already selected, else select this one
    const group = chip.closest('.filters__group');
    const chips = group.querySelectorAll('.filters__chip');
    const wasChecked = chip.getAttribute('aria-checked') === 'true';

    chips.forEach(c => c.setAttribute('aria-checked', 'false'));

    if (!wasChecked) {
      chip.setAttribute('aria-checked', 'true');
      setState({ filters: { [filter]: value } });
    } else {
      setState({ filters: { [filter]: filter === 'occasion' ? 'Any' : 'Any' } });
    }
  } else if (filter === 'openNow') {
    const wasPressed = chip.getAttribute('aria-pressed') === 'true';
    chip.setAttribute('aria-pressed', String(!wasPressed));
    setState({ filters: { openNow: !wasPressed } });
  }
}

/* ---- Bottom Sheets ---- */
function openSheet(id) {
  const sheet = $(id);
  if (sheet) sheet.hidden = false;
}

export function closeSheet(id) {
  const sheet = $(id);
  if (sheet) sheet.hidden = true;
}

function populateHoodSheet() {
  const body = $('hood-list');
  if (!body) return;
  const { neighborhood } = getState().filters;
  body.innerHTML = NEIGHBORHOODS.map(hood => `
    <button class="sheet__option${hood === neighborhood ? ' is-active' : ''}"
            data-action="select-hood" data-value="${hood}" type="button">
      ${hood}
    </button>
  `).join('');

  body.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-action="select-hood"]');
    if (!btn) return;
    const val = btn.dataset.value;
    setState({ filters: { neighborhood: val } });
    body.querySelectorAll('.sheet__option').forEach(b => b.classList.remove('is-active'));
    btn.classList.add('is-active');
    // Update the filter chip display
    const filterChip = $('filter-hood');
    if (filterChip) {
      filterChip.textContent = val === 'Anywhere' ? 'Neighborhood' : val;
      filterChip.classList.toggle('is-active', val !== 'Anywhere');
    }
    closeSheet('hood-sheet');
  });
}

function populateDietarySheet() {
  const body = $('dietary-list');
  if (!body) return;
  const { dietaryRestrictions } = getState().filters;
  body.innerHTML = DIETARY.map(d => `
    <button class="sheet__option${dietaryRestrictions.includes(d) ? ' is-active' : ''}"
            data-action="toggle-dietary" data-value="${d}" type="button">
      ${d}
    </button>
  `).join('');

  body.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-action="toggle-dietary"]');
    if (!btn) return;
    const val = btn.dataset.value;
    const current = [...getState().filters.dietaryRestrictions];

    if (val === 'None') {
      setState({ filters: { dietaryRestrictions: [] } });
      body.querySelectorAll('.sheet__option').forEach(b => b.classList.remove('is-active'));
      btn.classList.add('is-active');
    } else {
      // Remove "None" if selected
      body.querySelector('[data-value="None"]')?.classList.remove('is-active');
      const idx = current.indexOf(val);
      if (idx >= 0) {
        current.splice(idx, 1);
        btn.classList.remove('is-active');
      } else {
        current.push(val);
        btn.classList.add('is-active');
      }
      setState({ filters: { dietaryRestrictions: current } });
    }

    // Update the filter chip display
    const filterChip = $('filter-dietary');
    if (filterChip) {
      const active = getState().filters.dietaryRestrictions;
      filterChip.textContent = active.length ? `Dietary (${active.length})` : 'Dietary';
      filterChip.classList.toggle('is-active', active.length > 0);
    }
  });
}

/* ---- Sheet Dismissal (backdrop + close button) ---- */
export function initSheets() {
  document.addEventListener('click', (e) => {
    if (e.target.matches('[data-dismiss="sheet"]') || e.target.closest('[data-dismiss="sheet"]')) {
      const sheet = e.target.closest('.sheet');
      if (sheet) sheet.hidden = true;
    }
  });
}

/* ---- History Rendering ---- */
export function renderHistory() {
  if (!historyList) historyList = $('history-list');
  if (!historyList) return;

  const history = loadHistory();
  const historySection = $('history');

  if (!history.length) {
    if (historySection) historySection.hidden = true;
    return;
  }

  if (historySection) historySection.hidden = false;

  historyList.innerHTML = history.slice(0, 5).map(item => {
    const scoreColor = item.score ? getScoreColor(item.score) : 'var(--fg3)';
    return `
      <li class="history__item" data-action="re-search" data-craving="${escapeAttr(item.label)}"
          data-payload='${escapeAttr(JSON.stringify(item.payload || {}))}'>
        <span class="history__item-text">${escapeHtml(item.label)}</span>
        ${item.score ? `<span class="history__item-score" style="color:${scoreColor}">${item.score}</span>` : ''}
      </li>
    `;
  }).join('');
}

/* ---- Update Prompt Text (culture-aware) ---- */
export function updatePrompt(culture) {
  if (!promptText) promptText = $('prompt-text');
  if (!promptText) return;
  const labels = getLabels(culture);
  promptText.textContent = labels.prompt;
}

/* ---- Set Input Value (for re-search) ---- */
export function setInputValue(text) {
  if (!inputEl) inputEl = $('craving-input');
  if (inputEl) {
    inputEl.value = text;
    onInputChange();
  }
}

/* ---- Get Active Filter Badges HTML ---- */
export function getActiveFilterBadges() {
  const f = getState().filters;
  const badges = [];
  if (f.occasion !== 'Any') badges.push(f.occasion);
  if (f.priceLevel !== 'Any') badges.push(f.priceLevel);
  if (f.neighborhood !== 'Anywhere') badges.push(f.neighborhood);
  if (f.openNow) badges.push('Open Now');
  if (f.dietaryRestrictions.length) badges.push(`Diet (${f.dietaryRestrictions.length})`);
  return badges.map(b => `<span class="filter-badge">${escapeHtml(b)}</span>`).join('');
}

/* ---- Helpers ---- */
function escapeHtml(str) {
  const el = document.createElement('span');
  el.textContent = str;
  return el.innerHTML;
}

function escapeAttr(str) {
  return str.replace(/"/g, '&quot;').replace(/'/g, '&#39;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
