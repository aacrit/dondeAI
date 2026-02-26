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

export async function fetchRecommendation({ special_request, occasion, neighborhood, price_level, exclude, dietary_restrictions, user_id, feedback, open_now }) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

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

    // V5: Normalize scoring — prefer scoring_v5, fall back to v4/v3
    if (data.scoring_v5) {
      data.scoring = data.scoring_v5;
    } else if (data.scoring_v4) {
      data.scoring = data.scoring_v4;
    } else if (data.scoring_v3) {
      data.scoring = data.scoring_v3;
    }

    // V5: Parse intent_boost (default to inactive)
    if (!data.intent_boost) {
      data.intent_boost = { active: false };
    }

    // V5: Parse relaxation_applied (default to empty)
    if (!data.relaxation_applied) {
      data.relaxation_applied = null;
    }

    return data;
  } catch (err) {
    clearTimeout(timer);

    if (err.name === 'AbortError') {
      throw new Error('Request timed out. Please try again.');
    }
    if (err.message.includes('Failed to fetch') || err.message.includes('NetworkError')) {
      throw new Error("Couldn't reach the engine. Check your connection.");
    }
    throw err;
  }
}
