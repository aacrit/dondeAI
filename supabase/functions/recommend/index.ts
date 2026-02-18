import { serve } from "https://deno.land/std@0.177.0/http/server.ts";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const SYSTEM_PROMPT = `You are DondeAI, a Chicago restaurant recommendation engine. Given a user's craving, occasion, neighborhood preference, and budget, recommend ONE real Chicago restaurant.
You MUST respond with valid JSON only — no markdown, no code fences, no explanation. The JSON must match this exact schema:
{
  "success": true,
  "restaurant": {
    "name": "string",
    "best_for_oneliner": "string (one catchy sentence)",
    "address": "string (full street address, Chicago, IL)",
    "phone": "string or null",
    "website": "string (URL) or null",
    "price_level": "$ or $$ or $$$ or $$$$",
    "noise_level": "string or null (e.g. Moderate, Loud, Quiet)",
    "cuisine_type": "string or null",
    "google_rating": "string (e.g. 4.5) or null",
    "google_review_count": "string (e.g. 1200) or null",
    "google_place_id": "string or null",
    "parking_availability": "string or null",
    "lighting_ambiance": "string or null",
    "dress_code": "string or null",
    "outdoor_seating": "boolean or null",
    "live_music": "boolean or null",
    "pet_friendly": "boolean or null",
    "sentiment_breakdown": "string or null (e.g. 80% positive, 15% neutral, 5% negative)",
    "sentiment_score": "string (0 to 1, e.g. 0.85) or null"
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
- Only recommend REAL restaurants that exist in Chicago
- All scores must be strings, not numbers
- The donde_score should reflect overall quality and match to the request
- Provide at least 4 of the 7 vibe scores
- Tags should be short descriptive phrases (e.g. "cozy vibes", "killer cocktails", "late-night")
- If occasion is not "Any", weight scores and recommendation toward that occasion
- If neighborhood is not "Anywhere", only recommend restaurants in that neighborhood
- If price_level is not "Any", only recommend restaurants matching that price tier`;

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: CORS_HEADERS });
  }

  try {
    // --- Validate API key at request time ---
    const apiKey = Deno.env.get("ANTHROPIC_API_KEY");
    if (!apiKey) {
      console.error(
        "ANTHROPIC_API_KEY is not set. Run: supabase secrets set ANTHROPIC_API_KEY=sk-ant-..."
      );
      return new Response(
        JSON.stringify({
          success: false,
          recommendation: "Server configuration error. Please contact support.",
        }),
        {
          status: 503,
          headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
        }
      );
    }

    if (!apiKey.startsWith("sk-ant-")) {
      console.error(
        `ANTHROPIC_API_KEY has unexpected format (starts with "${apiKey.substring(0, 6)}..."). Expected "sk-ant-..."`
      );
      return new Response(
        JSON.stringify({
          success: false,
          recommendation: "Server configuration error. Please contact support.",
        }),
        {
          status: 503,
          headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
        }
      );
    }

    // --- Parse & validate request body ---
    const { special_request, occasion, neighborhood, price_level } =
      await req.json();

    if (!special_request || special_request.trim() === "") {
      return new Response(
        JSON.stringify({
          success: false,
          recommendation: "Please tell us what you're craving.",
        }),
        {
          status: 400,
          headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
        }
      );
    }

    const userMessage = [
      `Craving: ${special_request}`,
      `Occasion: ${occasion || "Any"}`,
      `Neighborhood: ${neighborhood || "Anywhere"}`,
      `Budget: ${price_level || "Any"}`,
    ].join("\n");

    // --- Call Anthropic API ---
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
      return new Response(
        JSON.stringify({
          success: false,
          recommendation: "Our engine hit a snag. Please try again.",
        }),
        {
          status: 502,
          headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
        }
      );
    }

    const claudeData = await claudeRes.json();
    const rawText = claudeData.content?.[0]?.text;

    if (!rawText) {
      console.error("Empty response from Anthropic:", JSON.stringify(claudeData));
      return new Response(
        JSON.stringify({
          success: false,
          recommendation: "No recommendation generated. Try again.",
        }),
        {
          status: 500,
          headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
        }
      );
    }

    const result = JSON.parse(rawText);
    result.success = true;

    return new Response(JSON.stringify(result), {
      headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("Function error:", err);
    return new Response(
      JSON.stringify({
        success: false,
        recommendation: "Something went wrong. Please try again.",
      }),
      {
        status: 500,
        headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
      }
    );
  }
});
