/* ============================================
   DondeAI — Neighborhood Pulse
   Ambient city intelligence card: "Right now in [neighborhood]..."
   Shown on Canvas empty state, hidden on search.
   ============================================ */

import { getState, setState } from './state.js';
import { $dom, REDUCED_MOTION } from './globals.js';

const SUPABASE_URL = 'https://vwbzkgsxmgwcvmvuxnbe.supabase.co';
const ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZ3YnprZ3N4bWd3Y3ZtdnV4bmJlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njk5NjUzNTYsImV4cCI6MjA4NTU0MTM1Nn0.YBhmusYxc28TD5FOZv4TBpFpDVHHk1V894wUkNtJtcc';

/** Module state */
let _pulseData = null;
let _hasFetched = false;
let _container = null;

/**
 * Contextual copy templates keyed by time_of_day.
 * Each returns a human-readable ambient sentence.
 */
const PULSE_COPY = {
  breakfast(data) {
    const dish = data.signature_dish
      ? ` ${data.restaurant_name} is plating ${data.signature_dish}.`
      : ` ${data.restaurant_name} is pouring fresh coffee.`;
    return `Morning light hits ${data.neighborhood}.${dish}`;
  },
  lunch(data) {
    const style = data.service_style
      ? ` ${data.restaurant_name} has ${data.service_style} ready.`
      : ` ${data.restaurant_name} has seats at the counter.`;
    return `The lunch rush in ${data.neighborhood}.${style}`;
  },
  dinner(data) {
    const wow = data.wow_factor
      ? ` ${data.restaurant_name} — ${data.wow_factor.toLowerCase()}.`
      : ` ${data.restaurant_name} is setting tables.`;
    return `The energy's rising in ${data.neighborhood}.${wow}`;
  },
  late_night(data) {
    const vibe = data.noise_level
      ? ` ${data.restaurant_name} keeps it ${data.noise_level}.`
      : ` ${data.restaurant_name} is still serving.`;
    return `${data.neighborhood} after hours.${vibe}`;
  },
};

/**
 * Fetch pulse data from the backend RPC.
 * Called once per app open — no continuous polling.
 */
async function fetchPulseData() {
  try {
    const now = new Date();
    const hour = now.getHours();
    let timeOfDay;
    if (hour >= 6 && hour < 11) timeOfDay = 'breakfast';
    else if (hour >= 11 && hour < 15) timeOfDay = 'lunch';
    else if (hour >= 15 && hour < 21) timeOfDay = 'dinner';
    else timeOfDay = 'late_night';

    const res = await fetch(
      `${SUPABASE_URL}/rest/v1/rpc/get_neighborhood_pulse`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${ANON_KEY}`,
          'apikey': ANON_KEY,
        },
        body: JSON.stringify({
          p_time_of_day: timeOfDay,
          p_day_of_week: now.getDay(),
        }),
      }
    );

    if (!res.ok) return null;
    const data = await res.json();
    return data;
  } catch {
    return null;
  }
}

/**
 * Build the pulse card DOM element.
 */
function buildPulseCard(data) {
  const card = document.createElement('div');
  card.className = 'pulse-card';
  card.setAttribute('role', 'button');
  card.setAttribute('tabindex', '0');
  card.setAttribute('aria-label',
    `Right now in ${data.neighborhood}. ${data.restaurant_name}. Tap to search this neighborhood.`);

  // Time-based contextual copy
  const copyFn = PULSE_COPY[data.time_of_day] || PULSE_COPY.dinner;
  const contextText = copyFn(data);

  // Season icon
  const seasonIcon = {
    spring: '<path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/>',
    summer: '<circle cx="12" cy="12" r="5"/><path d="m12 1v2m0 18v2m-9-11h2m18 0h2m-4.22-6.78 1.42-1.42m-15.56 15.56 1.42-1.42m0-12.72L3.22 3.22m15.56 15.56-1.42-1.42"/>',
    fall: '<path d="M17 8C8 10 5.9 16.17 3.82 21.34l1.89.66.95-2.3c.48.17.98.3 1.34.3C19 20 22 3 22 3c-1 2-8 2.25-13 3.25S2 11.5 2 13.5s1.75 3.75 1.75 3.75"/>',
    winter: '<path d="M12 2v20m-5-3 5-5 5 5M7 5l5 5 5-5M2 12h20M5 7l2 2m10-2-2 2M5 17l2-2m10 2-2-2"/>',
  };

  // Price indicator
  const priceDisplay = data.price_level || '';

  // Cuisine tag
  const cuisineTag = data.cuisine_type || '';

  card.innerHTML = `
    <div class="pulse-card__glow"></div>
    <div class="pulse-card__content">
      <div class="pulse-card__header">
        <span class="pulse-card__badge type-data--sm">${data.time_of_day.replace('_', ' ')}</span>
        ${data.google_rating ? `<span class="pulse-card__rating type-data--sm">${data.google_rating}</span>` : ''}
      </div>
      <h2 class="pulse-card__neighborhood type-emotional">Right now in ${data.neighborhood}</h2>
      <p class="pulse-card__context type-structural">${contextText}</p>
      <div class="pulse-card__meta">
        ${cuisineTag ? `<span class="pulse-card__tag type-data--sm">${cuisineTag}</span>` : ''}
        ${priceDisplay ? `<span class="pulse-card__tag type-data--sm">${priceDisplay}</span>` : ''}
      </div>
    </div>
    <div class="pulse-card__arrow" aria-hidden="true">
      <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="m9 18 6-6-6-6"/>
      </svg>
    </div>
  `;

  // Tap handler: pre-fill neighborhood in search
  const handleTap = () => {
    const input = $dom.cravingInput;
    if (input) {
      input.value = `restaurants in ${data.neighborhood}`;
      input.dispatchEvent(new Event('input', { bubbles: true }));
      input.focus();
    }
    setState({ neighborhood: data.neighborhood, craving: `restaurants in ${data.neighborhood}` });
  };

  card.addEventListener('click', handleTap);
  card.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      handleTap();
    }
  });

  return card;
}

/**
 * Render (or re-render) the pulse card into the canvas.
 * Inserts after the craving input, before smart chips.
 */
export function renderPulse() {
  // Remove existing pulse if any
  hidePulse();

  if (!_pulseData) return;

  const state = getState();
  // Only show when canvas is in empty/default state (step 0, no search active)
  if (state.step !== 0 || state.loading || state.result) return;
  // Don't show if user has typed something
  if (state.craving && state.craving.trim()) return;

  _container = document.createElement('div');
  _container.className = 'pulse-container';
  _container.id = 'neighborhood-pulse';

  const card = buildPulseCard(_pulseData);
  _container.appendChild(card);

  // Insert after your-spots or after empty-state in the canvas layout
  const canvasLayout = document.querySelector('[data-step="0"] .canvas-layout');
  if (!canvasLayout) return;

  // Insert before "Your Spots" if it exists, otherwise append to canvas
  const yourSpots = document.getElementById('your-spots');
  if (yourSpots) {
    canvasLayout.insertBefore(_container, yourSpots);
  } else {
    canvasLayout.appendChild(_container);
  }

  // Animate entrance (unless reduced motion)
  if (!REDUCED_MOTION.matches) {
    requestAnimationFrame(() => {
      _container.classList.add('pulse-container--visible');
    });
  } else {
    _container.classList.add('pulse-container--visible');
  }
}

/**
 * Hide and remove the pulse card.
 */
export function hidePulse() {
  const existing = document.getElementById('neighborhood-pulse');
  if (existing) {
    existing.classList.remove('pulse-container--visible');
    existing.classList.add('pulse-container--exiting');
    // Remove after animation
    setTimeout(() => existing.remove(), 400);
  }
  _container = null;
}

/**
 * Initialize the Neighborhood Pulse module.
 * Fetches data once and renders the card.
 * Called from app.js init().
 */
export async function initNeighborhoodPulse() {
  if (_hasFetched) return;
  _hasFetched = true;

  _pulseData = await fetchPulseData();
  if (!_pulseData) return;

  renderPulse();
}

/**
 * Check if pulse should be shown/hidden based on current state.
 * Called from state subscriber.
 */
export function syncPulseVisibility() {
  const state = getState();
  const shouldShow = state.step === 0
    && !state.loading
    && !state.result
    && !(state.craving && state.craving.trim());

  const exists = document.getElementById('neighborhood-pulse');

  if (shouldShow && !exists && _pulseData) {
    renderPulse();
  } else if (!shouldShow && exists) {
    hidePulse();
  }
}
