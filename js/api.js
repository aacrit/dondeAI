/* ============================================
   DondeAI — Backend Integration
   POST to webhook, handle all error states.
   ============================================ */

const ENDPOINT = 'https://donde.app.n8n.cloud/webhook-test/donde-recommend';
const TIMEOUT_MS = 15000;

export async function fetchRecommendation({ special_request, occasion, neighborhood, price_level }) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const res = await fetch(ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ special_request, occasion, neighborhood, price_level }),
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
