import { serve } from "https://deno.land/std@0.177.0/http/server.ts";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const SYSTEM_PROMPT = `You are DondeAI, a Chicago restaurant recommendation engine. Given a user's craving, occasion, neighborhood preference, and budget, recommend ONE real Chicago restaurant.
You MUST respond with valid JSON only — no markdown, no code fences, no explanation. The JSON must match this exact schema:
{
  "restaurant": {
    "name": "string",
    "best_for_oneliner": "string (one catchy sentence)",
    "address": "string (full street address, Chicago, IL)",
    "phone": null,
    "website": null,
    "price_level": "$ or $$ or $$$ or $$$$",
    "noise_level": "string or null (e.g. Moderate, Loud, Quiet)",
    "cuisine_type": "string or null",
    "google_rating": null,
    "google_review_count": null,
    "google_place_id": null,
    "parking_availability": "string or null",
    "lighting_ambiance": "string or null",
    "dress_code": "string or null",
    "outdoor_seating": "boolean or null",
    "live_music": "boolean or null",
    "pet_friendly": "boolean or null",
    "sentiment_breakdown": null,
    "sentiment_score": null
  },
  "recommendation": "string (2-3 sentence compelling recommendation paragraph)",
  "insider_tip": "string (a local insider tip about the restaurant) or null",
  "donde_score": "string (0 to 10, e.g. 8.5)",
  "scores": {
    "date_friendly_score": "string (0-10) or null",
    "group_friendly_score": "string (0-10) or null",
    "family_friendly_score": "string (0-10) or null",
    "business_lunch_score": "string (0-10) or null",
    "solo_dining_score": "string (0-10) or null",
    "hole_in_wall_factor": "string (0-10) or null",
    "romantic_rating": "string (0-10) or null"
  },
  "tags": ["string array of 3-6 descriptive tags"]
}
Rules:
- Only recommend restaurants you are HIGHLY CONFIDENT actually exist in Chicago right now
- Prioritize well-known, established restaurants over obscure ones
- The restaurant name must be the real, commonly used name
- The address should be your best guess for the real street address
- ALWAYS set phone, website, google_rating, google_review_count, google_place_id, sentiment_breakdown, and sentiment_score to null — these will be filled from a verified source
- All scores must be strings, not numbers
- The donde_score should reflect overall quality and match to the request
- Provide at least 4 of the 7 vibe scores
- Tags should be short descriptive phrases (e.g. "cozy vibes", "killer cocktails", "late-night")
- If occasion is not "Any", weight scores and recommendation toward that occasion
- If neighborhood is not "Anywhere", only recommend restaurants in that neighborhood
- If price_level is not "Any", only recommend restaurants matching that price tier`;

const MAX_RETRIES = 2;
const GOOGLE_PLACES_TIMEOUT_MS = 3000;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Trigram-based Jaccard similarity for fuzzy name matching. */
function normalizedSimilarity(a: string, b: string): number {
  const trigrams = (s: string): Set<string> => {
    const t = new Set<string>();
    const lower = s.toLowerCase().replace(/[^a-z0-9 ]/g, "");
    for (let i = 0; i <= lower.length - 3; i++) t.add(lower.slice(i, i + 3));
    return t;
  };
  const sa = trigrams(a);
  const sb = trigrams(b);
  if (sa.size === 0 && sb.size === 0) return 1;
  let intersection = 0;
  for (const t of sa) if (sb.has(t)) intersection++;
  return intersection / (sa.size + sb.size - intersection);
}

/** Fetch with an AbortController-based timeout. */
async function fetchWithTimeout(
  url: string,
  options: RequestInit,
  timeoutMs: number
): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

// ---------------------------------------------------------------------------
// Google Places validation
// ---------------------------------------------------------------------------

interface PlaceResult {
  displayName: string;
  formattedAddress: string;
  nationalPhoneNumber: string | null;
  websiteUri: string | null;
  rating: number | null;
  userRatingCount: number | null;
  id: string | null;
  priceLevel: string | null;
}

interface PlaceValidation {
  verified: boolean;
  place: PlaceResult | null;
}

async function validateWithGooglePlaces(
  restaurantName: string,
  apiKey: string
): Promise<PlaceValidation> {
  const NONE: PlaceValidation = { verified: false, place: null };

  try {
    const query = `${restaurantName} restaurant Chicago IL`;

    const res = await fetchWithTimeout(
      "https://places.googleapis.com/v1/places:searchText",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Goog-Api-Key": apiKey,
          "X-Goog-FieldMask":
            "places.displayName,places.formattedAddress,places.nationalPhoneNumber,places.websiteUri,places.rating,places.userRatingCount,places.id,places.priceLevel",
        },
        body: JSON.stringify({
          textQuery: query,
          locationBias: {
            circle: {
              center: { latitude: 41.8781, longitude: -87.6298 },
              radius: 40000.0,
            },
          },
          maxResultCount: 3,
        }),
      },
      GOOGLE_PLACES_TIMEOUT_MS
    );

    if (!res.ok) {
      console.error("Google Places API error:", res.status, await res.text());
      return NONE;
    }

    const data = await res.json();
    const places = data.places || [];
    if (places.length === 0) return NONE;

    // Check top result for fuzzy name match
    const topPlace = places[0];
    const googleName = topPlace.displayName?.text || "";
    const claudeName = restaurantName;

    const gLower = googleName.toLowerCase();
    const cLower = claudeName.toLowerCase();

    const isMatch =
      gLower.includes(cLower) ||
      cLower.includes(gLower) ||
      normalizedSimilarity(googleName, claudeName) > 0.6;

    if (!isMatch) return NONE;

    const priceLevelMap: Record<string, string> = {
      PRICE_LEVEL_FREE: "$",
      PRICE_LEVEL_INEXPENSIVE: "$",
      PRICE_LEVEL_MODERATE: "$$",
      PRICE_LEVEL_EXPENSIVE: "$$$",
      PRICE_LEVEL_VERY_EXPENSIVE: "$$$$",
    };

    return {
      verified: true,
      place: {
        displayName: googleName,
        formattedAddress: topPlace.formattedAddress || "",
        nationalPhoneNumber: topPlace.nationalPhoneNumber || null,
        websiteUri: topPlace.websiteUri || null,
        rating: topPlace.rating ?? null,
        userRatingCount: topPlace.userRatingCount ?? null,
        id: topPlace.id || null,
        priceLevel: priceLevelMap[topPlace.priceLevel] || null,
      },
    };
  } catch (err) {
    // Timeout or network error — degrade gracefully
    console.error("Google Places validation failed:", err);
    return NONE;
  }
}

// ---------------------------------------------------------------------------
// Enrich Claude's result with verified Google data
// ---------------------------------------------------------------------------

function enrichResult(claudeResult: any, place: PlaceResult): any {
  const enriched = JSON.parse(JSON.stringify(claudeResult));
  const r = enriched.restaurant;

  r.name = place.displayName;
  r.address = place.formattedAddress;
  r.google_place_id = place.id;

  if (place.nationalPhoneNumber) r.phone = place.nationalPhoneNumber;
  if (place.websiteUri) r.website = place.websiteUri;
  if (place.rating != null) r.google_rating = String(place.rating);
  if (place.userRatingCount != null)
    r.google_review_count = String(place.userRatingCount);
  if (place.priceLevel) r.price_level = place.priceLevel;

  return enriched;
}

// ---------------------------------------------------------------------------
// Call Claude API
// ---------------------------------------------------------------------------

async function callClaude(
  apiKey: string,
  userMessage: string
): Promise<{ ok: true; data: any } | { ok: false; error: string; status: number }> {
  const claudeRes = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: "claude-sonnet-4-5-20250929",
      max_tokens: 1024,
      system: SYSTEM_PROMPT,
      messages: [{ role: "user", content: userMessage }],
    }),
  });

  if (!claudeRes.ok) {
    const errText = await claudeRes.text();
    console.error("Anthropic API error:", claudeRes.status, errText);
    return { ok: false, error: "Our engine hit a snag. Please try again.", status: 502 };
  }

  const claudeData = await claudeRes.json();
  const rawText = claudeData.content?.[0]?.text;

  if (!rawText) {
    console.error("Empty response from Anthropic:", JSON.stringify(claudeData));
    return { ok: false, error: "No recommendation generated. Try again.", status: 500 };
  }

  // Strip markdown code fences if Claude wrapped the JSON
  let cleaned = rawText.trim();
  if (cleaned.startsWith("```")) {
    cleaned = cleaned
      .replace(/^```(?:json)?\s*\n?/, "")
      .replace(/\n?```\s*$/, "");
  }

  try {
    const data = JSON.parse(cleaned);
    return { ok: true, data };
  } catch {
    console.error("JSON parse failed. Raw text:", rawText);
    return {
      ok: false,
      error: "Got a response but couldn't read it. Please try again.",
      status: 502,
    };
  }
}

// ---------------------------------------------------------------------------
// Main handler
// ---------------------------------------------------------------------------

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: CORS_HEADERS });
  }

  const jsonHeaders = { ...CORS_HEADERS, "Content-Type": "application/json" };

  try {
    // --- Validate Anthropic API key ---
    const apiKey = Deno.env.get("ANTHROPIC_API_KEY");
    if (!apiKey || !apiKey.startsWith("sk-ant-")) {
      console.error("ANTHROPIC_API_KEY missing or invalid format.");
      return new Response(
        JSON.stringify({
          success: false,
          recommendation: "Server configuration error. Please contact support.",
        }),
        { status: 503, headers: jsonHeaders }
      );
    }

    // Google Places key is optional — degrades gracefully
    const googleApiKey = Deno.env.get("GOOGLE_PLACES_API_KEY") || "";

    // --- Parse & validate request body ---
    const { special_request, occasion, neighborhood, price_level } =
      await req.json();

    if (!special_request || special_request.trim() === "") {
      return new Response(
        JSON.stringify({
          success: false,
          recommendation: "Please tell us what you're craving.",
        }),
        { status: 400, headers: jsonHeaders }
      );
    }

    const baseMessage = [
      `Craving: ${special_request}`,
      `Occasion: ${occasion || "Any"}`,
      `Neighborhood: ${neighborhood || "Anywhere"}`,
      `Budget: ${price_level || "Any"}`,
    ].join("\n");

    // --- Retry loop: Claude → validate → enrich ---
    const excludedNames: string[] = [];
    let bestResult: any = null;
    let verified = false;
    let lastError: { error: string; status: number } | null = null;

    for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
      // Build message with exclusion list for retries
      let userMessage = baseMessage;
      if (excludedNames.length > 0) {
        userMessage += `\n\nIMPORTANT: Do NOT recommend these restaurants (they could not be verified as real): ${excludedNames.join(", ")}. Suggest a DIFFERENT restaurant.`;
      }

      const claudeResult = await callClaude(apiKey, userMessage);

      if (!claudeResult.ok) {
        lastError = { error: claudeResult.error, status: claudeResult.status };
        // If Claude itself fails, don't retry (likely a systemic issue)
        break;
      }

      const result = claudeResult.data;

      // Keep the first successful result as fallback
      if (!bestResult) bestResult = result;

      // Skip Google validation if no API key
      if (!googleApiKey) {
        bestResult = result;
        break;
      }

      const restaurantName = result.restaurant?.name;
      if (!restaurantName) {
        bestResult = result;
        break;
      }

      const validation = await validateWithGooglePlaces(
        restaurantName,
        googleApiKey
      );

      if (validation.verified && validation.place) {
        bestResult = enrichResult(result, validation.place);
        verified = true;
        console.log(
          `Attempt ${attempt + 1}: "${restaurantName}" verified on Google Places.`
        );
        break;
      }

      // Not found — add to exclusion list and retry
      excludedNames.push(restaurantName);
      console.log(
        `Attempt ${attempt + 1}: "${restaurantName}" not found on Google Places.${
          attempt < MAX_RETRIES ? " Retrying..." : " No retries left."
        }`
      );
    }

    // If Claude never returned a valid result, return error
    if (!bestResult) {
      const err = lastError || {
        error: "Something went wrong. Please try again.",
        status: 500,
      };
      return new Response(
        JSON.stringify({ success: false, recommendation: err.error }),
        { status: err.status, headers: jsonHeaders }
      );
    }

    bestResult.success = true;
    bestResult.verified = verified;

    return new Response(JSON.stringify(bestResult), { headers: jsonHeaders });
  } catch (err) {
    console.error("Function error:", err);
    return new Response(
      JSON.stringify({
        success: false,
        recommendation: "Something went wrong. Please try again.",
      }),
      { status: 500, headers: jsonHeaders }
    );
  }
});
