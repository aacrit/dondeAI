/* ============================================
   DondeAI — Conversational Search Module
   Real-time intent parsing, followup suggestions,
   placeholder rotation.
   ============================================ */

import { getState, setState, subscribe } from './state.js';
import { $dom, _escHtml, haptic, HAPTICS, REDUCED_MOTION } from './globals.js';
import { announce } from './accessibility.js';

/* ═══════════════════════════════════════════════
   SECTION 1: Intent Detection Dictionaries
   ═══════════════════════════════════════════════ */

const CUISINES = [
  'Italian', 'Mexican', 'Japanese', 'Thai', 'Chinese', 'Korean', 'Indian',
  'Vietnamese', 'Ethiopian', 'Greek', 'French', 'Spanish', 'Turkish',
  'Lebanese', 'Moroccan', 'Peruvian', 'Colombian', 'Brazilian', 'Cuban',
  'Argentinian', 'Nigerian', 'Senegalese', 'Eritrean', 'Somali',
  'Filipino', 'Indonesian', 'Malaysian', 'Nepalese', 'Afghan',
  'German', 'Polish', 'Irish', 'American', 'Southern', 'Cajun',
  'Caribbean', 'Jamaican', 'Hawaiian', 'Mediterranean', 'Middle Eastern',
  'Persian', 'Israeli', 'Szechuan', 'Cantonese', 'Sicilian',
];

const NEIGHBORHOODS = [
  'Loop', 'River North', 'Gold Coast', 'Streeterville', 'South Loop',
  'Fulton Market', 'West Loop', 'Greektown', 'Old Town', 'Lincoln Park',
  'Lakeview', 'Wicker Park', 'Bucktown', 'Ukrainian Village',
  'Logan Square', 'Avondale', 'Humboldt Park', 'Irving Park',
  'Andersonville', 'Edgewater', 'Uptown', 'Rogers Park', 'Lincoln Square',
  'North Center', 'Ravenswood', 'Pilsen', 'Little Italy', 'Chinatown',
  'Bridgeport', 'Bronzeville', 'Hyde Park', 'Back of the Yards', 'Woodlawn',
];

// Landmark aliases that map to neighborhoods
const LANDMARK_ALIASES = {
  'wrigley field': 'Lakeview',
  'wrigley': 'Lakeview',
  'united center': 'West Loop',
  'millennium park': 'Loop',
  'navy pier': 'Streeterville',
  'magnificent mile': 'Gold Coast',
  'mag mile': 'Gold Coast',
  'the bean': 'Loop',
  'soldier field': 'South Loop',
  'sox park': 'Bridgeport',
  'comiskey': 'Bridgeport',
  'guaranteed rate': 'Bridgeport',
  'ohare': 'Irving Park',
  'midway': 'Back of the Yards',
  'uchicago': 'Hyde Park',
  'depaul': 'Lincoln Park',
  'northwestern': 'Streeterville',
};

const OCCASIONS = {
  'date night': 'Date Night',
  'first date': 'Date Night',
  'date': 'Date Night',
  'romantic': 'Date Night',
  'anniversary': 'Date Night',
  'special occasion': 'Special Occasion',
  'birthday': 'Special Occasion',
  'celebration': 'Special Occasion',
  'business lunch': 'Business Lunch',
  'client dinner': 'Business Lunch',
  'work dinner': 'Business Lunch',
  'business': 'Business Lunch',
  'group dinner': 'Group Hangout',
  'happy hour': 'Group Hangout',
  'group': 'Group Hangout',
  'friends': 'Group Hangout',
  'family dinner': 'Family Dinner',
  'family': 'Family Dinner',
  'kids': 'Family Dinner',
  'parents': 'Family Dinner',
  'by myself': 'Solo Dining',
  'solo': 'Solo Dining',
  'alone': 'Solo Dining',
  'treat myself': 'Treat Myself',
  'treat me': 'Treat Myself',
  'adventure': 'Adventure',
  'explore': 'Adventure',
  'brunch': 'Chill Hangout',
  'chill': 'Chill Hangout',
  'casual': 'Chill Hangout',
  'hangout': 'Chill Hangout',
};

const PRICE_SIGNALS = {
  'money is no object': '$$$$',
  'not too expensive': '$$',
  'fine dining': '$$$$',
  'no budget': '$$$$',
  'high-end': '$$$$',
  'high end': '$$$$',
  'mid-range': '$$',
  'mid range': '$$',
  'inexpensive': '$',
  'affordable': '$',
  'expensive': '$$$',
  'moderate': '$$',
  'reasonable': '$$',
  'under 20': '$',
  'splurge': '$$$$',
  'lavish': '$$$$',
  'luxury': '$$$$',
  'upscale': '$$$',
  'budget': '$',
  'cheap': '$',
  'fancy': '$$$',
  'nice': '$$$',
};

const VIBES = [
  'hole in the wall', 'cozy', 'romantic', 'lively', 'quiet', 'upscale',
  'casual', 'trendy', 'intimate', 'fun', 'energetic', 'chill', 'hip',
  'modern', 'rustic', 'elegant', 'buzzy', 'vibrant', 'relaxed',
  'sophisticated', 'funky', 'artsy', 'dark', 'moody', 'bright', 'warm',
  'minimalist', 'bohemian', 'classy', 'swanky', 'divey',
];

const CONSTRAINTS = [
  'outdoor seating', 'no reservation', 'private dining', 'private room',
  'counter seating', 'bar seating', 'tasting menu', 'dog friendly',
  'pet friendly', 'live music', 'gluten-free', 'gluten free', 'late night',
  'late-night', 'open late', 'open now', 'prix fixe', 'omakase',
  'BYOB', 'outdoor', 'patio', 'rooftop', 'vegan', 'vegetarian',
  'halal', 'kosher', 'walk-in', 'walk in', 'reservations',
  'karaoke', 'takeout', 'delivery', 'parking', 'valet',
];

/* ═══════════════════════════════════════════════
   SECTION 2: Intent Parsing Engine
   ═══════════════════════════════════════════════ */

/** Category icon and CSS class for each signal type */
const SIGNAL_META = {
  cuisine:      { icon: '\uD83C\uDF5D', cls: 'cs-chip--cuisine' },
  neighborhood: { icon: '\uD83D\uDCCD', cls: 'cs-chip--neighborhood' },
  occasion:     { icon: '\uD83C\uDF89', cls: 'cs-chip--occasion' },
  price:        { icon: '\uD83D\uDCB0', cls: 'cs-chip--price' },
  vibe:         { icon: '\u2728',        cls: 'cs-chip--vibe' },
  constraint:   { icon: '\u2699\uFE0F', cls: 'cs-chip--constraint' },
};

/**
 * Parse a natural-language query into detected signals.
 * Returns an array of { type, value, displayValue, matchedText }.
 */
export function parseIntent(query) {
  if (!query || query.length < 2) return [];
  const lower = query.toLowerCase();
  const signals = [];
  const usedRanges = [];

  function overlaps(start, end) {
    return usedRanges.some(([s, e]) => start < e && end > s);
  }
  function markRange(start, end) {
    usedRanges.push([start, end]);
  }

  // Helper: check word boundaries
  function isWordBound(idx, len) {
    const before = idx === 0 || /[\s,]/.test(lower[idx - 1]);
    const after = idx + len >= lower.length || /[\s,.]/.test(lower[idx + len]);
    return before && after;
  }

  // 1. Neighborhoods (longest first)
  const sortedHoods = [...NEIGHBORHOODS].sort((a, b) => b.length - a.length);
  for (const hood of sortedHoods) {
    const idx = lower.indexOf(hood.toLowerCase());
    if (idx !== -1 && !overlaps(idx, idx + hood.length) && isWordBound(idx, hood.length)) {
      signals.push({ type: 'neighborhood', value: hood, displayValue: hood, matchedText: query.slice(idx, idx + hood.length) });
      markRange(idx, idx + hood.length);
    }
  }

  // 1b. Landmark aliases
  for (const [landmark, hood] of Object.entries(LANDMARK_ALIASES)) {
    const idx = lower.indexOf(landmark);
    if (idx !== -1 && !overlaps(idx, idx + landmark.length) && isWordBound(idx, landmark.length)) {
      if (!signals.some(s => s.type === 'neighborhood')) {
        signals.push({ type: 'neighborhood', value: hood, displayValue: `${hood} (near ${landmark})`, matchedText: query.slice(idx, idx + landmark.length) });
        markRange(idx, idx + landmark.length);
      }
    }
  }

  // 2. Occasions (longest first)
  const sortedOccasions = Object.entries(OCCASIONS).sort((a, b) => b[0].length - a[0].length);
  for (const [keyword, occasion] of sortedOccasions) {
    const idx = lower.indexOf(keyword);
    if (idx !== -1 && !overlaps(idx, idx + keyword.length) && isWordBound(idx, keyword.length)) {
      if (!signals.some(s => s.type === 'occasion' && s.value === occasion)) {
        signals.push({ type: 'occasion', value: occasion, displayValue: occasion, matchedText: query.slice(idx, idx + keyword.length) });
        markRange(idx, idx + keyword.length);
      }
    }
  }

  // 3. Price signals (longest first)
  const sortedPrices = Object.entries(PRICE_SIGNALS).sort((a, b) => b[0].length - a[0].length);
  for (const [keyword, price] of sortedPrices) {
    const idx = lower.indexOf(keyword);
    if (idx !== -1 && !overlaps(idx, idx + keyword.length)) {
      if (!signals.some(s => s.type === 'price')) {
        signals.push({ type: 'price', value: price, displayValue: price, matchedText: query.slice(idx, idx + keyword.length) });
        markRange(idx, idx + keyword.length);
      }
    }
  }

  // 4. Cuisines (longest first)
  const sortedCuisines = [...CUISINES].sort((a, b) => b.length - a.length);
  for (const cuisine of sortedCuisines) {
    const idx = lower.indexOf(cuisine.toLowerCase());
    if (idx !== -1 && !overlaps(idx, idx + cuisine.length) && isWordBound(idx, cuisine.length)) {
      signals.push({ type: 'cuisine', value: cuisine, displayValue: cuisine, matchedText: query.slice(idx, idx + cuisine.length) });
      markRange(idx, idx + cuisine.length);
    }
  }

  // 5. Vibes (longest first)
  const sortedVibes = [...VIBES].sort((a, b) => b.length - a.length);
  for (const vibe of sortedVibes) {
    const idx = lower.indexOf(vibe.toLowerCase());
    if (idx !== -1 && !overlaps(idx, idx + vibe.length) && isWordBound(idx, vibe.length)) {
      signals.push({ type: 'vibe', value: vibe, displayValue: vibe, matchedText: query.slice(idx, idx + vibe.length) });
      markRange(idx, idx + vibe.length);
    }
  }

  // 6. Constraints (longest first)
  const sortedConstraints = [...CONSTRAINTS].sort((a, b) => b.length - a.length);
  for (const constraint of sortedConstraints) {
    const idx = lower.indexOf(constraint.toLowerCase());
    if (idx !== -1 && !overlaps(idx, idx + constraint.length) && isWordBound(idx, constraint.length)) {
      signals.push({ type: 'constraint', value: constraint, displayValue: constraint, matchedText: query.slice(idx, idx + constraint.length) });
      markRange(idx, idx + constraint.length);
    }
  }

  return signals;
}

/* ═══════════════════════════════════════════════
   SECTION 3: Signal Chips Renderer
   ═══════════════════════════════════════════════ */

let _lastSignalKey = '';
let _chipContainer = null;

/** Create or get the signal chips container below the craving input */
function getChipContainer() {
  if (_chipContainer && _chipContainer.parentNode) return _chipContainer;
  const wrap = document.querySelector('.craving-wrap');
  if (!wrap) return null;

  _chipContainer = document.createElement('div');
  _chipContainer.className = 'cs-signals';
  _chipContainer.setAttribute('aria-label', 'Detected search signals');
  _chipContainer.setAttribute('role', 'status');
  _chipContainer.setAttribute('aria-live', 'polite');
  wrap.parentNode.insertBefore(_chipContainer, wrap.nextSibling);
  return _chipContainer;
}

/** Render detected signal chips */
function renderSignalChips(signals) {
  const container = getChipContainer();
  if (!container) return;

  // Diff: only update if signals actually changed
  const sigKey = signals.map(s => `${s.type}:${s.value}`).join('|');
  if (sigKey === _lastSignalKey) return;
  _lastSignalKey = sigKey;

  if (signals.length === 0) {
    if (container.children.length > 0) {
      container.classList.add('cs-signals--exiting');
      setTimeout(() => {
        container.innerHTML = '';
        container.classList.remove('cs-signals--exiting');
      }, 200);
    }
    return;
  }

  const frag = document.createDocumentFragment();
  for (const signal of signals) {
    const meta = SIGNAL_META[signal.type];
    const chip = document.createElement('span');
    chip.className = `cs-chip ${meta.cls}`;
    chip.dataset.type = signal.type;
    chip.dataset.value = signal.value;

    const iconSpan = document.createElement('span');
    iconSpan.className = 'cs-chip__icon';
    iconSpan.textContent = meta.icon;
    iconSpan.setAttribute('aria-hidden', 'true');

    const labelSpan = document.createElement('span');
    labelSpan.className = 'cs-chip__label';
    labelSpan.textContent = signal.displayValue;

    const removeBtn = document.createElement('button');
    removeBtn.className = 'cs-chip__remove';
    removeBtn.setAttribute('aria-label', `Remove ${signal.displayValue}`);
    removeBtn.innerHTML = '<svg viewBox="0 0 16 16" width="10" height="10"><path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>';
    removeBtn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      removeSignal(signal);
    });

    chip.appendChild(iconSpan);
    chip.appendChild(labelSpan);
    chip.appendChild(removeBtn);
    frag.appendChild(chip);
  }

  container.innerHTML = '';
  container.appendChild(frag);

  // Staggered animation
  if (!REDUCED_MOTION.matches) {
    const chips = container.querySelectorAll('.cs-chip');
    chips.forEach((chip, i) => {
      chip.style.animationDelay = `${i * 60}ms`;
    });
  }
}

/** Remove a signal by editing the input text */
function removeSignal(signal) {
  const input = $dom.cravingInput;
  if (!input) return;

  haptic(HAPTICS.tick);

  let text = input.value;
  const lower = text.toLowerCase();
  const idx = lower.indexOf(signal.matchedText.toLowerCase());
  if (idx !== -1) {
    let before = text.slice(0, idx);
    let after = text.slice(idx + signal.matchedText.length);
    before = before.replace(/[,\s]+$/, '');
    after = after.replace(/^[,\s]+/, '');
    text = before + (before && after ? ' ' : '') + after;
    text = text.trim();
    input.value = text;
    setState({ craving: text });
    input.dispatchEvent(new Event('input', { bubbles: true }));
  }
}

/* ═══════════════════════════════════════════════
   SECTION 4: Auto-Filter Sync
   ═══════════════════════════════════════════════ */

function syncFiltersFromSignals(signals) {
  for (const signal of signals) {
    switch (signal.type) {
      case 'neighborhood': {
        if (getState().neighborhood === 'Anywhere') {
          const pill = document.querySelector(`.filter-pill[data-action="select-neighborhood"][data-value="${signal.value}"]`);
          if (pill) {
            const group = pill.closest('[role="radiogroup"]') || pill.closest('.hood-groups');
            if (group) group.querySelectorAll('.filter-pill').forEach(p => p.setAttribute('aria-checked', 'false'));
            pill.setAttribute('aria-checked', 'true');
            setState({ neighborhood: signal.value });

            const hoodGroup = pill.closest('.hood-group');
            if (hoodGroup) hoodGroup.setAttribute('open', '');
            const regions = document.getElementById('hood-regions');
            if (regions) regions.setAttribute('aria-hidden', 'false');
            const browse = document.querySelector('[data-action="toggle-hood-regions"]');
            if (browse) {
              browse.setAttribute('aria-expanded', 'true');
              browse.classList.add('hood-browse--active');
            }
          }
        }
        break;
      }
      case 'occasion': {
        if (getState().occasion === 'Any') {
          const tile = document.querySelector(`.occasion-tile[data-value="${signal.value}"]`);
          if (tile) {
            document.querySelectorAll('.occasion-tile').forEach(t => t.setAttribute('aria-checked', 'false'));
            tile.setAttribute('aria-checked', 'true');
            setState({ occasion: signal.value });
          }
        }
        break;
      }
      case 'price': {
        if (getState().priceLevel === 'Any') {
          const pill = document.querySelector(`.filter-pill[data-action="select-budget"][data-value="${signal.value}"]`);
          if (pill) {
            const group = pill.closest('[role="radiogroup"]') || pill.closest('.filter-pills');
            if (group) group.querySelectorAll('.filter-pill').forEach(p => p.setAttribute('aria-checked', 'false'));
            pill.setAttribute('aria-checked', 'true');
            setState({ priceLevel: signal.value });
          }
        }
        break;
      }
    }
  }
}

/* ═══════════════════════════════════════════════
   SECTION 5: Followup Suggestions
   ═══════════════════════════════════════════════ */

function generateFollowups(result) {
  if (!result?.restaurant) return [];
  const r = result.restaurant;
  const craving = getState().craving;
  const signals = parseIntent(craving);
  const followups = [];

  // "Try another in [neighborhood]"
  if (r.neighborhood_name && r.neighborhood_name !== 'Anywhere') {
    followups.push({
      label: `Another spot in ${r.neighborhood_name}`,
      query: craving,
      filter: { neighborhood: r.neighborhood_name },
    });
  }

  // Price pivot
  const priceLevel = r.price_level || '';
  if (priceLevel === '$$$' || priceLevel === '$$$$') {
    followups.push({
      label: 'Something similar, less expensive',
      query: craving.replace(/expensive|upscale|fancy|fine dining|splurge|luxury/gi, '').trim() + ' affordable',
      filter: {},
    });
  } else if (priceLevel === '$' || priceLevel === '$$') {
    followups.push({
      label: 'Upgrade to something fancier',
      query: craving.replace(/cheap|budget|affordable|inexpensive/gi, '').trim() + ' upscale',
      filter: {},
    });
  }

  // "More [cuisine] options"
  const cuisineSignal = signals.find(s => s.type === 'cuisine');
  if (cuisineSignal || r.cuisine_type) {
    const cuisineName = cuisineSignal?.value || r.cuisine_type;
    followups.push({
      label: `More ${cuisineName} options`,
      query: cuisineName.toLowerCase(),
      filter: {},
    });
  }

  // Wildcard
  followups.push({
    label: 'Surprise me with something different',
    query: 'surprise me with something completely different',
    filter: {},
  });

  return followups.slice(0, 3);
}

/** Render followup chips below the result blurb */
export function renderFollowups(result) {
  const resultCard = document.getElementById('result-card');
  if (!resultCard) return;

  const existing = resultCard.querySelector('.cs-followups');
  if (existing) existing.remove();

  const followups = generateFollowups(result);
  if (followups.length === 0) return;

  const container = document.createElement('div');
  container.className = 'cs-followups';

  const chipWrap = document.createElement('div');
  chipWrap.className = 'cs-followups__chips';

  for (const followup of followups) {
    const chip = document.createElement('button');
    chip.className = 'cs-followup-chip';
    chip.textContent = followup.label;
    chip.addEventListener('click', () => {
      haptic(HAPTICS.chipSelect);
      executeFollowup(followup);
    });
    chipWrap.appendChild(chip);
  }

  container.appendChild(chipWrap);

  // Insert at end of Tier 2 (lean-in details section) for subtle placement
  const tier2 = document.getElementById('tier-leanin');
  if (tier2) {
    tier2.appendChild(container);
  } else {
    // Fallback: before card footer
    const footer = resultCard.querySelector('.card-footer');
    if (footer) footer.parentNode.insertBefore(container, footer);
    else resultCard.appendChild(container);
  }

  if (!REDUCED_MOTION.matches) {
    container.classList.add('cs-followups--entering');
    container.addEventListener('animationend', () => {
      container.classList.remove('cs-followups--entering');
    }, { once: true });
  }
}

function executeFollowup(followup) {
  const input = $dom.cravingInput;
  if (!input) return;

  input.value = followup.query;
  setState({ craving: followup.query });

  if (followup.filter.neighborhood) {
    setState({ neighborhood: followup.filter.neighborhood });
  }

  const currentId = getState().result?.restaurant?.id;
  if (currentId) {
    const exclude = [...getState().excludeIds];
    if (!exclude.includes(currentId)) exclude.push(currentId);
    setState({ excludeIds: exclude });
  }

  const submitBtn = document.querySelector('[data-action="submit"]');
  if (submitBtn) submitBtn.click();
}


/* ═══════════════════════════════════════════════
   SECTION 7: Input Integration
   ═══════════════════════════════════════════════ */

let _parseDebounce = null;

export function initConversationalSearch() {
  const input = $dom.cravingInput;
  if (!input) return;

  // Real-time intent parsing on input
  input.addEventListener('input', () => {
    clearTimeout(_parseDebounce);
    _parseDebounce = setTimeout(() => {
      const query = input.value.trim();
      const signals = parseIntent(query);
      renderSignalChips(signals);
      syncFiltersFromSignals(signals);
    }, 200);
  });

  // Listen for voice recognition results
  document.addEventListener('voice-result', (e) => {
    const text = e.detail?.text;
    if (text) {
      const signals = parseIntent(text);
      renderSignalChips(signals);
      syncFiltersFromSignals(signals);
    }
  });

  // Render followup chips when result arrives
  subscribe((state, prev) => {
    if (state.result !== prev.result && state.result) {
      setTimeout(() => {
        renderFollowups(state.result);
      }, 100);
    }
    // Clear signals on craving reset
    if (state.craving === '' && prev.craving !== '') {
      renderSignalChips([]);
      _lastSignalKey = '';
    }
  });
}

/* ═══════════════════════════════════════════════
   SECTION 8: Voice Input Integration
   ═══════════════════════════════════════════════ */

let _lastVoiceCheck = '';

export function patchVoiceForConversational() {
  const input = $dom.cravingInput;
  if (!input) return;

  // Poll for voice input changes after mic button click
  const voiceBtn = document.querySelector('.craving-voice-btn');
  if (voiceBtn) {
    voiceBtn.addEventListener('click', () => {
      let checkCount = 0;
      const checker = setInterval(() => {
        checkCount++;
        const query = input.value.trim();
        if (query && query !== _lastVoiceCheck) {
          _lastVoiceCheck = query;
          const signals = parseIntent(query);
          renderSignalChips(signals);
          syncFiltersFromSignals(signals);
        }
        if (checkCount > 25) clearInterval(checker);
      }, 200);
    });
  }
}
