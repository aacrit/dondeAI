/* ============================================
   DondeAI — Backend Integration
   POST to webhook, handle all error states.
   ============================================ */

const ENDPOINT = 'https://vwbzkgsxmgwcvmvuxnbe.supabase.co/functions/v1/recommend';
const TIMEOUT_MS = 15000;

// I3: Map frontend time periods to backend time_of_day values
function getBackendTimeOfDay() {
  const h = new Date().getHours();
  if (h >= 6 && h < 11) return 'breakfast';
  if (h >= 11 && h < 15) return 'lunch';
  if (h >= 15 && h < 21) return 'dinner';
  return 'late_night';
}

export async function fetchRecommendation({ special_request, occasion, neighborhood, price_level, exclude, dietary_restrictions, user_id, feedback }) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

  const body = { special_request, occasion, neighborhood, price_level };
  if (exclude?.length) body.exclude = exclude;
  if (dietary_restrictions?.length) body.dietary_restrictions = dietary_restrictions;
  if (user_id) body.user_id = user_id;
  if (feedback) body.feedback = feedback;
  body.time_of_day = getBackendTimeOfDay(); // I3/B2: Send client time context

  try {
    const res = await fetch(ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZ3YnprZ3N4bWd3Y3ZtdnV4bmJlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njk5NjUzNTYsImV4cCI6MjA4NTU0MTM1Nn0.YBhmusYxc28TD5FOZv4TBpFpDVHHk1V894wUkNtJtcc',
        'apikey': 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZ3YnprZ3N4bWd3Y3ZtdnV4bmJlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njk5NjUzNTYsImV4cCI6MjA4NTU0MTM1Nn0.YBhmusYxc28TD5FOZv4TBpFpDVHHk1V894wUkNtJtcc',
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
