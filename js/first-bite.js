/* ============================================
   DondeAI — First Bite: Ambient Onboarding
   "Right now in Chicago" experience shown before
   any user input. Shows value before asking for it.
   ============================================ */

import { getState, setState, subscribe } from './state.js';
import { $dom, REDUCED_MOTION, haptic, HAPTICS } from './globals.js';

/* ---- Pre-curated Chicago restaurant highlights ---- */
const FEATURED_RESTAURANTS = [
  { name: "Girl & The Goat", oneliner: "Bold, globally-inspired dishes in a vibrant West Loop setting", score: 92, neighborhood: "West Loop", theme: "american", query: "bold creative dining West Loop" },
  { name: "Momotaro", oneliner: "Refined Japanese cuisine with an izakaya-inspired atmosphere", score: 90, neighborhood: "West Loop", theme: "japanese", query: "upscale Japanese dinner" },
  { name: "Mi Tocaya Antojeria", oneliner: "Creative Mexican small plates with bold mole and mezcal", score: 89, neighborhood: "Logan Square", theme: "mexican", query: "creative Mexican food Logan Square" },
  { name: "Virtue", oneliner: "Southern comfort elevated with seasonal ingredients in Hyde Park", score: 88, neighborhood: "Hyde Park", theme: "southern", query: "Southern comfort food Hyde Park" },
  { name: "Galit", oneliner: "Wood-fired Middle Eastern dishes with Israeli soul in Lincoln Park", score: 91, neighborhood: "Lincoln Park", theme: "middleeastern", query: "Middle Eastern dinner Lincoln Park" },
  { name: "Kasama", oneliner: "Filipino-inspired tasting menu meets all-day bakery brilliance", score: 93, neighborhood: "Ukrainian Village", theme: "filipino", query: "Filipino tasting menu" },
  { name: "Oriole", oneliner: "Two Michelin stars of progressive American in a hidden courtyard", score: 94, neighborhood: "West Loop", theme: "american", query: "fine dining tasting menu" },
  { name: "S.K.Y.", oneliner: "Asian-inspired plates with stunning Pilsen rooftop views", score: 87, neighborhood: "Pilsen", theme: "asian", query: "rooftop dinner Pilsen" },
  { name: "Portillo's", oneliner: "The iconic Chicago hot dog and Italian beef destination", score: 85, neighborhood: "River North", theme: "american", query: "Chicago hot dogs" },
  { name: "Alinea", oneliner: "Three Michelin stars of boundary-pushing culinary artistry", score: 95, neighborhood: "Lincoln Park", theme: "american", query: "best restaurant in Chicago" },
];

/* ---- Theme accent hue map for card color accents ---- */
const THEME_HUES = {
  american:     18,
  japanese:     210,
  mexican:      30,
  southern:     38,
  middleeastern: 48,
  filipino:     340,
  asian:        190,
};

/* ---- Time context helpers ---- */
function getTimeContext() {
  const now = new Date();
  const hour = now.getHours();
  const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const day = dayNames[now.getDay()];

  let period;
  if (hour >= 5 && hour < 12) period = 'morning';
  else if (hour >= 12 && hour < 17) period = 'afternoon';
  else if (hour >= 17 && hour < 21) period = 'evening';
  else period = 'night';

  return { day, period, hour };
}

function getTimeLabel() {
  const { day, period } = getTimeContext();
  return `${day} ${period} in Chicago`;
}

/* ---- Select restaurants appropriate for current time ---- */
function selectFeatured(count = 4) {
  // Shuffle and pick `count` restaurants for variety each session
  const shuffled = [...FEATURED_RESTAURANTS].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, count);
}

/* ---- Suggested query chips based on time ---- */
function getTimeSuggestions() {
  const { hour } = getTimeContext();
  const base = [];

  if (hour >= 5 && hour < 11) {
    base.push(
      { label: "Best brunch spot", query: "best brunch spot" },
      { label: "Coffee and pastries", query: "great coffee and pastries" },
      { label: "Breakfast near me", query: "best breakfast" },
    );
  } else if (hour >= 11 && hour < 15) {
    base.push(
      { label: "Quick lunch", query: "quick lunch spot" },
      { label: "Business lunch", query: "business lunch" },
      { label: "Best tacos nearby", query: "best tacos" },
    );
  } else if (hour >= 15 && hour < 17) {
    base.push(
      { label: "Happy hour", query: "happy hour spot" },
      { label: "Afternoon coffee", query: "best coffee shop" },
      { label: "Light bites", query: "light bites and snacks" },
    );
  } else if (hour >= 17 && hour < 21) {
    base.push(
      { label: "Best dinner tonight", query: "best dinner tonight" },
      { label: "Date night spot", query: "romantic date night dinner" },
      { label: "Group dinner", query: "great spot for group dinner" },
    );
  } else {
    base.push(
      { label: "Late night eats", query: "late night food" },
      { label: "Best cocktail bar", query: "best cocktail bar" },
      { label: "Open late", query: "restaurants open late" },
    );
  }

  // Always-available suggestions
  base.push(
    { label: "Hidden gem", query: "hidden gem restaurant" },
    { label: "Surprise me", query: "surprise me with something great" },
  );

  return base;
}

/* ---- Module state ---- */
let _container = null;
let _visible = false;
let _dismissed = false;

/* ---- Check if First Bite should show ---- */
function shouldShow() {
  if (_dismissed) return false;
  if (sessionStorage.getItem('donde_first_bite_dismissed')) return false;
  const state = getState();
  if (state.step !== 0) return false;
  if (state.loading) return false;
  if (state.result) return false;
  if (state.craving && state.craving.trim()) return false;
  return true;
}

/* ---- Build a featured restaurant card ---- */
function buildCard(restaurant, index) {
  const card = document.createElement('button');
  card.className = 'fb-card';
  card.setAttribute('aria-label', `${restaurant.name} in ${restaurant.neighborhood}. ${restaurant.oneliner}. Tap to search.`);
  card.style.setProperty('--fb-delay', `${index * 100}ms`);

  const hue = THEME_HUES[restaurant.theme] || 18;
  card.style.setProperty('--fb-hue', hue);

  card.innerHTML = `
    <div class="fb-card__glow" aria-hidden="true"></div>
    <div class="fb-card__content">
      <div class="fb-card__top">
        <span class="fb-card__neighborhood type-data--sm">${restaurant.neighborhood}</span>
        <span class="fb-card__score type-data--sm">${restaurant.score}</span>
      </div>
      <h3 class="fb-card__name type-emotional">${restaurant.name}</h3>
      <p class="fb-card__oneliner type-structural">${restaurant.oneliner}</p>
    </div>
  `;

  card.addEventListener('click', () => {
    haptic(HAPTICS.chipSelect);
    triggerSearch(restaurant.query);
  });

  return card;
}

/* ---- Build a suggestion chip ---- */
function buildChip(suggestion) {
  const chip = document.createElement('button');
  chip.className = 'fb-chip type-structural';
  chip.textContent = suggestion.label;

  chip.addEventListener('click', () => {
    haptic(HAPTICS.chipSelect);
    triggerSearch(suggestion.query);
  });

  return chip;
}

/* ---- Trigger a search from card/chip tap ---- */
function triggerSearch(query) {
  dismiss();
  const input = $dom.cravingInput;
  if (input) {
    input.value = query;
    input.dispatchEvent(new Event('input', { bubbles: true }));
    input.focus();
  }
  setState({ craving: query });

  // Trigger submit after a brief moment for the UI to settle
  setTimeout(() => {
    const submitBtn = document.querySelector('[data-action="submit"]');
    if (submitBtn && !submitBtn.disabled) submitBtn.click();
  }, 150);
}

/* ---- Render the First Bite experience ---- */
function render() {
  if (_container) return;
  if (!shouldShow()) return;

  const canvasLayout = document.querySelector('[data-step="0"] .canvas-layout');
  if (!canvasLayout) return;

  _container = document.createElement('div');
  _container.className = 'fb-container';
  _container.id = 'first-bite';
  _container.setAttribute('aria-label', 'Right now in Chicago — featured restaurants');

  // Header
  const header = document.createElement('div');
  header.className = 'fb-header';
  header.innerHTML = `
    <h2 class="fb-header__title type-emotional">${getTimeLabel()}</h2>
    <p class="fb-header__subtitle type-structural">Tap a spot to get started</p>
  `;

  // Cards scroll track
  const track = document.createElement('div');
  track.className = 'fb-track';
  track.setAttribute('role', 'list');
  track.setAttribute('aria-label', 'Featured restaurants');

  const featured = selectFeatured(4);
  featured.forEach((r, i) => {
    const card = buildCard(r, i);
    card.setAttribute('role', 'listitem');
    track.appendChild(card);
  });

  // Suggestion chips
  const chipsWrap = document.createElement('div');
  chipsWrap.className = 'fb-chips';
  chipsWrap.setAttribute('aria-label', 'Suggested searches');

  const suggestions = getTimeSuggestions();
  suggestions.forEach(s => {
    chipsWrap.appendChild(buildChip(s));
  });

  _container.appendChild(header);
  _container.appendChild(track);
  _container.appendChild(chipsWrap);

  // Insert after the greeting title, before the craving-wrap
  const cravingWrap = canvasLayout.querySelector('.craving-wrap');
  if (cravingWrap) {
    canvasLayout.insertBefore(_container, cravingWrap);
  } else {
    canvasLayout.appendChild(_container);
  }

  // Animate entrance
  if (!REDUCED_MOTION.matches) {
    requestAnimationFrame(() => {
      _container.classList.add('fb-container--visible');
    });
  } else {
    _container.classList.add('fb-container--visible');
  }

  _visible = true;
}

/* ---- Dismiss / fade out the First Bite ---- */
function dismiss() {
  if (!_visible || !_container) return;

  _dismissed = true;
  sessionStorage.setItem('donde_first_bite_dismissed', '1');

  _container.classList.remove('fb-container--visible');
  _container.classList.add('fb-container--exiting');

  setTimeout(() => {
    if (_container && _container.parentNode) {
      _container.remove();
    }
    _container = null;
    _visible = false;
  }, 400);
}

/* ---- Public API ---- */

/**
 * Initialize the First Bite onboarding experience.
 * Called from app.js init(). Shows ambient content on first load.
 */
export function initFirstBite() {
  // Check if already searched this session
  if (sessionStorage.getItem('donde_first_bite_dismissed')) return;

  // Render after a short delay to let the canvas settle
  setTimeout(() => render(), 600);

  // Listen for user typing — fade out First Bite
  const input = $dom.cravingInput;
  if (input) {
    input.addEventListener('input', () => {
      if (input.value.trim()) dismiss();
    });
    input.addEventListener('focus', () => {
      // Only dismiss on focus if user actually starts typing
      // (don't dismiss on programmatic focus from card tap)
    });
  }

  // Subscribe to state changes for dismissal
  subscribe((state, prev) => {
    // Dismiss when user starts searching or gets a result
    if (state.loading && !prev.loading) dismiss();
    if (state.result && !prev.result) dismiss();
    if (state.craving && state.craving.trim() && !prev.craving?.trim()) dismiss();

    // Re-show if user comes back to empty canvas (within same session before first search)
    if (!_dismissed && state.step === 0 && !state.loading && !state.result
        && !(state.craving && state.craving.trim())
        && !_visible && !_container) {
      render();
    }
  });
}

/**
 * Sync First Bite visibility based on current state.
 * Called from state subscriber in app.js.
 */
export function syncFirstBiteVisibility() {
  if (_dismissed) return;

  const state = getState();
  const show = state.step === 0
    && !state.loading
    && !state.result
    && !(state.craving && state.craving.trim());

  if (show && !_visible && !_container) {
    render();
  } else if (!show && _visible) {
    dismiss();
  }
}
