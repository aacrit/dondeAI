/* ============================================
   DondeAI — Backend Integration
   POST to webhook, handle all error states.
   SSO: Uses user JWT when authenticated, falls
   back to anon key for anonymous users.
   ============================================ */

import { getAccessToken } from './auth.js';

const ENDPOINT = 'https://vwbzkgsxmgwcvmvuxnbe.supabase.co/functions/v1/recommend';
const SUPABASE_URL = 'https://vwbzkgsxmgwcvmvuxnbe.supabase.co';
const ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZ3YnprZ3N4bWd3Y3ZtdnV4bmJlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njk5NjUzNTYsImV4cCI6MjA4NTU0MTM1Nn0.YBhmusYxc28TD5FOZv4TBpFpDVHHk1V894wUkNtJtcc';
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
  // Use Supabase REST API to update user_queries directly
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
  } catch { /* fire-and-forget — localStorage is the fallback */ }
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
      body: JSON.stringify({
        user_id: userId,
        category,
        message,
      }),
    });
  } catch { /* fire-and-forget */ }
}

export async function fetchRecommendation({ special_request, occasion, neighborhood, price_level, exclude, dietary_restrictions, user_id, feedback, open_now }) {
  const body = { special_request, occasion, neighborhood, price_level };
  if (exclude?.length) body.exclude = exclude;
  if (dietary_restrictions?.length) body.dietary_restrictions = dietary_restrictions;
  if (user_id) body.user_id = user_id;
  if (feedback) body.feedback = feedback;
  if (open_now === true) body.open_now = true;
  body.time_of_day = getBackendTimeOfDay(); // I3/B2: Send client time context

  // SSO: Use user JWT when authenticated, anon key otherwise
  let authToken = null;
  try { authToken = await getAccessToken(); } catch { /* auth module not loaded yet */ }
  const bearerToken = authToken || ANON_KEY;

  // Single retry for transient network failures
  const MAX_ATTEMPTS = 2;
  const RETRY_DELAY = 1500;

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

    try {
      const res = await fetch(ENDPOINT, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${bearerToken}`,
          'apikey': ANON_KEY,
        },
        body: JSON.stringify(body),
        signal: controller.signal,
      });

      clearTimeout(timer);

      if (!res.ok) {
        throw new Error(`Server returned ${res.status}. Please try again.`);
      }

      const data = await res.json();

      if (!data.success) {
        throw new Error(data.recommendation || 'Something went wrong. Please try again.');
      }

      // V7: Normalize scoring — prefer scoring_v7, fall back to v5/v4/v3
      if (data.scoring_v7) {
        data.scoring = data.scoring_v7;
      } else if (data.scoring_v5) {
        data.scoring = data.scoring_v5;
      } else if (data.scoring_v4) {
        data.scoring = data.scoring_v4;
      } else if (data.scoring_v3) {
        data.scoring = data.scoring_v3;
      }

      // V7: Parse intent_boost (default to inactive)
      if (!data.intent_boost) {
        data.intent_boost = { active: false };
      }

      // V7: Parse relaxation_applied (default to empty)
      if (!data.relaxation_applied) {
        data.relaxation_applied = null;
      }

      // V7: Extract ranked queue for instant "Try Again"
      if (data.ranked_queue && Array.isArray(data.ranked_queue)) {
        // Normalize scoring for each queue item
        for (const item of data.ranked_queue) {
          if (item.scoring_v7) item.scoring = item.scoring_v7;
          else if (item.scoring_v5) item.scoring = item.scoring_v5;
        }
      }

      return data;
    } catch (err) {
      clearTimeout(timer);

      if (err.name === 'AbortError') {
        throw new Error('Request timed out. Please try again.');
      }

      const isNetworkError = err.message.includes('Failed to fetch') || err.message.includes('NetworkError');
      if (isNetworkError && attempt < MAX_ATTEMPTS) {
        await new Promise(r => setTimeout(r, RETRY_DELAY));
        continue;
      }
      if (isNetworkError) {
        throw new Error("Couldn't reach the engine. Check your connection.");
      }
      throw err;
    }
  }
}

/**
 * V8.8: Fetch a fresh Claude blurb for a Try Again queue item.
 * Lazy API call — fires on Try Again click, ~500ms response time.
 */
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

    if (!res.ok) {
      throw new Error(`Blurb API returned ${res.status}`);
    }

    const data = await res.json();
    if (!data.success) {
      throw new Error(data.error || 'Blurb generation failed');
    }

    return data;
  } catch (err) {
    clearTimeout(timer);
    throw err;
  }
}
