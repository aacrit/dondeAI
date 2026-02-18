/* ============================================
   DondeAI — Backend Integration
   POST to webhook, handle all error states.
   ============================================ */

const ENDPOINT = 'https://vwbzkgsxmgwcvmvuxnbe.supabase.co/functions/v1/recommend';
const TIMEOUT_MS = 15000;

export async function fetchRecommendation({ special_request, occasion, neighborhood, price_level, exclude }) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

  const body = { special_request, occasion, neighborhood, price_level };
  if (exclude?.length) body.exclude = exclude;

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
