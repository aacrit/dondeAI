/* ============================================
   DondeAI — Backend Integration
   POST to webhook, handle all error states.
   SSO: Uses user JWT when authenticated, falls
   back to anon key for anonymous users.
   ============================================ */

import { getAccessToken } from './auth.js';
import { SUPABASE_URL, ANON_KEY } from './config.js';

const ENDPOINT = SUPABASE_URL + '/functions/v1/recommend';
const TIMEOUT_MS = 15000;

// I3: Map frontend time periods to backend time_of_day values
function getBackendTimeOfDay() {
  const h = new Date().getHours();
  if (h >= 6 && h < 11) return 'breakfast';
  if (h >= 11 && h < 15) return 'lunch';
  if (h >= 15 && h < 21) return 'dinner';
  return 'late_night';
}

/**
 * Send feedback immediately to the backend (fire-and-forget).
 * Updates the most recent user_queries row for this restaurant + user.
 */
export async function sendFeedback(restaurantId, feedback, userId) {
  if (!restaurantId || !feedback || !userId) return;
  let authToken = null;
  try { authToken = await getAccessToken(); } catch { /* ok */ }
  const bearerToken = authToken || ANON_KEY;
  try {
    await fetch(
      `${SUPABASE_URL}/rest/v1/user_queries?recommended_restaurant_id=eq.${restaurantId}&user_id=eq.${userId}&order=created_at.desc&limit=1`,
      {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${bearerToken}`,
          'apikey': ANON_KEY,
          'Prefer': 'return=minimal',
        },
        body: JSON.stringify({ feedback }),
      }
    );
  } catch { /* fire-and-forget */ }
}

/**
 * Send "I'm Going Here!" visit signal (fire-and-forget).
 * Inserts into user_visits table via PostgREST.
 */
export async function sendVisit(restaurant, userId) {
  if (!restaurant?.id || !userId) return;
  let authToken = null;
  try { authToken = await getAccessToken(); } catch { /* ok */ }
  const bearerToken = authToken || ANON_KEY;
  try {
    await fetch(`${SUPABASE_URL}/rest/v1/user_visits`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${bearerToken}`,
        'apikey': ANON_KEY,
        'Prefer': 'return=minimal,resolution=ignore-duplicates',
      },
      body: JSON.stringify({
        user_id: userId,
        restaurant_id: restaurant.id,
        restaurant_name: restaurant.name || null,
        cuisine_type: restaurant.cuisine_type || null,
        neighborhood_name: restaurant.neighborhood_name || null,
      }),
    });
  } catch { /* fire-and-forget */ }
}

/**
 * Send app feedback form submission (fire-and-forget).
 * Inserts into user_app_feedback table via PostgREST.
 */
export async function sendAppFeedback(category, message, userId) {
  if (!category || !message) return;
  let authToken = null;
  try { authToken = await getAccessToken(); } catch { /* ok */ }
  const bearerToken = authToken || ANON_KEY;
  try {
    await fetch(`${SUPABASE_URL}/rest/v1/user_app_feedback`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${bearerToken}`,
        'apikey': ANON_KEY,
        'Prefer': 'return=minimal',
      },
      body: JSON.stringify({ user_id: userId, category, message }),
    });
  } catch { /* fire-and-forget */ }
}

export async function fetchRecommendation({ special_request, occasion, neighborhood, price_level, exclude, dietary_restrictions, user_id, feedback, open_now }, signal) {
  const body = { special_request, occasion, neighborhood, price_level, skip_claude: true };
  if (exclude?.length) body.exclude = exclude;
  if (dietary_restrictions?.length) body.dietary_restrictions = dietary_restrictions;
  if (user_id) body.user_id = user_id;
  if (feedback) body.feedback = feedback;
  if (open_now === true) body.open_now = true;
  body.time_of_day = getBackendTimeOfDay();

  let authToken = null;
  try { authToken = await getAccessToken(); } catch { /* auth module not loaded yet */ }
  const bearerToken = authToken || ANON_KEY;

  const MAX_ATTEMPTS = 2;
  const RETRY_DELAY = 1500;

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    // Use caller-provided signal if available, otherwise create a local AbortController
    const controller = signal ? null : new AbortController();
    const effectiveSignal = signal || controller.signal;
    const timer = signal ? null : setTimeout(() => controller.abort(), TIMEOUT_MS);

    try {
      const res = await fetch(ENDPOINT, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${bearerToken}`,
          'apikey': ANON_KEY,
        },
        body: JSON.stringify(body),
        signal: effectiveSignal,
      });
      if (timer) clearTimeout(timer);

      if (res.status === 503 && attempt < MAX_ATTEMPTS) {
        await new Promise(r => setTimeout(r, RETRY_DELAY));
        continue;
      }
      if (!res.ok) throw new Error(`Server returned ${res.status}. Please try again.`);

      const data = await res.json();
      if (!data.success) throw new Error(data.recommendation || 'Something went wrong. Please try again.');

      if (data.scoring_v9) data.scoring = data.scoring_v9;
      if (!data.intent_boost) data.intent_boost = { active: false };
      if (data.ranked_queue && Array.isArray(data.ranked_queue)) {
        for (const item of data.ranked_queue) {
          if (item.scoring_v9) item.scoring = item.scoring_v9;
        }
      }
      return data;
    } catch (err) {
      if (timer) clearTimeout(timer);
      // Re-throw AbortError directly so callers can distinguish user-abort from timeout
      if (err.name === 'AbortError') throw err;
      const isNetworkError = err.message.includes('Failed to fetch') || err.message.includes('NetworkError');
      if (isNetworkError && attempt < MAX_ATTEMPTS) { await new Promise(r => setTimeout(r, RETRY_DELAY)); continue; }
      if (isNetworkError) throw new Error("Couldn't reach the engine. Check your connection.");
      throw err;
    }
  }
}

const BLURB_ENDPOINT = ENDPOINT + '/blurb';
const BLURB_TIMEOUT_MS = 8000;

export async function fetchBlurb({ restaurant_data, context }) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), BLURB_TIMEOUT_MS);

  let authToken = null;
  try { authToken = await getAccessToken(); } catch { /* auth module not loaded yet */ }
  const bearerToken = authToken || ANON_KEY;

  try {
    const res = await fetch(BLURB_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${bearerToken}`,
        'apikey': ANON_KEY,
      },
      body: JSON.stringify({ restaurant_data, context }),
      signal: controller.signal,
    });
    clearTimeout(timer);
    if (!res.ok) throw new Error(`Blurb API returned ${res.status}`);
    const data = await res.json();
    if (!data.success) throw new Error(data.error || 'Blurb generation failed');
    return data;
  } catch (err) {
    clearTimeout(timer);
    throw err;
  }
}
