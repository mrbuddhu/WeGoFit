import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

interface RequestBody {
  messages?: ChatMessage[];
  userContext?: {
    name?: string;
    goal?: string;
    weight_kg?: number | string;
    dailyCalorieTarget?: number | string;
    activity_level?: string;
  };
  mode?: "coach" | "nutrition";
  foodQuery?: string;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const body: RequestBody = await req.json();
    const apiKey = Deno.env.get("OPENAI_API_KEY");

    if (!apiKey) {
      return new Response(
        JSON.stringify({ error: "OpenAI API key not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const mode = body.mode ?? "coach";

    if (mode === "nutrition") {
      return await handleNutrition(body, apiKey);
    }
    if (mode === "meal-plan") {
      return await handleMealPlan(body, apiKey);
    }
    return await handleCoach(body, apiKey);
  } catch (err) {
    return new Response(
      JSON.stringify({ error: err.message ?? "Internal error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});

async function handleCoach(body: RequestBody, apiKey: string): Promise<Response> {
  const ctx = body.userContext ?? {};
  const systemPrompt = `You are TinaBarks' AI Assistant for WeGoFit, a premium East African fitness app. You are warm, encouraging, professional and knowledgeable about fitness and nutrition.

Client: ${ctx.name || "there"}, Goal: ${ctx.goal || "improve fitness"}, Weight: ${ctx.weight_kg || "unknown"}kg, Calorie target: ${ctx.dailyCalorieTarget || 1800} kcal, Activity: ${ctx.activity_level || "moderate"}, Location: East Africa.

CRITICAL RULE: Keep every response under 60 words maximum. Never write long paragraphs. Use short punchy sentences. Maximum 3-4 sentences per response. This is a mobile chat — be concise.
RULES: Never start with a prefix like "TinaBarks' Assistant:" or "Assistant:" — reply directly. Reference East African foods/context where relevant. Use 1-2 emojis max. Never give medical advice. Always be positive. If about injury/pain → recommend seeing a doctor.`;

  const userMessages: ChatMessage[] = body.messages && body.messages.length > 0
    ? body.messages
    : [];

  const messages: ChatMessage[] = [
    { role: "system", content: systemPrompt },
    ...userMessages,
  ];

  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: "gpt-4o-mini",
      max_tokens: 100,
      temperature: 0.8,
      messages,
    }),
  });

  if (!res.ok) {
    const errBody = await res.json().catch(() => ({}));
    return new Response(
      JSON.stringify({ error: errBody?.error?.message ?? "OpenAI API error" }),
      { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }

  const data = await res.json();
  let reply: string = data.choices[0].message.content.trim();
  reply = reply.replace(/^(Coach\s+)?TinaBarks['']?s?\s+Assistant\s*:\s*/i, "");
  reply = reply.replace(/^Assistant\s*:\s*/i, "");

  return new Response(
    JSON.stringify({ reply }),
    { headers: { ...corsHeaders, "Content-Type": "application/json" } },
  );
}

async function handleNutrition(body: RequestBody, apiKey: string): Promise<Response> {
  const foodQuery = body.foodQuery ?? "";
  if (!foodQuery) {
    return new Response(
      JSON.stringify({ error: "foodQuery is required for nutrition mode" }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }

  const prompt = `
You are a certified nutritionist. The user ate: "${foodQuery}"
Respond ONLY with a valid JSON object. No explanation. No markdown.
No backticks. Just raw JSON exactly like this:

{
  "foodName": "2 scrambled eggs",
  "calories": 182,
  "protein": 12,
  "carbs": 2,
  "fat": 14,
  "fiber": 0,
  "sugar": 1,
  "sodium": 342,
  "servingDescription": "2 large eggs, scrambled"
}

Rules:
- All values must be realistic numbers (never 0 for real foods)
- calories, protein, carbs, fat are required
- If the food is completely unrecognizable, return:
  { "error": "Food not recognized" }
- Base values on standard USDA nutrition data
`;

  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: "gpt-4o-mini",
      max_tokens: 200,
      temperature: 0,
      messages: [{ role: "user", content: prompt }],
    }),
  });

  if (!res.ok) {
    const errBody = await res.json().catch(() => ({}));
    const code = errBody?.error?.code;
    if (code === "insufficient_quota") {
      return new Response(
        JSON.stringify({ error: "QUOTA_EXCEEDED" }),
        { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }
    return new Response(
      JSON.stringify({ error: "API_ERROR" }),
      { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }

  const data = await res.json();
  const text: string = data.choices[0].message.content.trim();

  let parsed: Record<string, unknown>;
  try {
    parsed = JSON.parse(text);
  } catch {
    return new Response(
      JSON.stringify({ error: "PARSE_ERROR" }),
      { status: 422, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }

  if (parsed.error) {
    return new Response(
      JSON.stringify({ error: "FOOD_NOT_FOUND" }),
      { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }

  const result = {
    query: foodQuery,
    foodName: parsed.foodName,
    servingDescription: parsed.servingDescription,
    calories: Math.round(Number(parsed.calories)),
    protein: Math.round(Number(parsed.protein)),
    carbs: Math.round(Number(parsed.carbs)),
    fat: Math.round(Number(parsed.fat)),
    fiber: Math.round(Number(parsed.fiber ?? 0)),
    sugar: Math.round(Number(parsed.sugar ?? 0)),
    sodium: Math.round(Number(parsed.sodium ?? 0)),
  };

  return new Response(
    JSON.stringify(result),
    { headers: { ...corsHeaders, "Content-Type": "application/json" } },
  );
}

async function handleMealPlan(body: RequestBody, apiKey: string): Promise<Response> {
  const userMessages: ChatMessage[] = body.messages && body.messages.length > 0
    ? body.messages
    : [];

  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: "gpt-4o-mini",
      max_tokens: 4000,
      temperature: 0.7,
      messages: userMessages,
    }),
  });

  if (!res.ok) {
    const errBody = await res.json().catch(() => ({}));
    const code = errBody?.error?.code;
    if (code === "insufficient_quota") {
      return new Response(
        JSON.stringify({ error: "QUOTA_EXCEEDED" }),
        { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }
    return new Response(
      JSON.stringify({ error: "API_ERROR" }),
      { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }

  const data = await res.json();
  const text: string = data.choices[0].message.content.trim();

  let parsed: Record<string, unknown>;
  try {
    const clean = text.replace(/```json/g, "").replace(/```/g, "").trim();
    const start = clean.indexOf("{");
    const end = clean.lastIndexOf("}");
    if (start === -1 || end === -1) throw new Error("no JSON");
    parsed = JSON.parse(clean.substring(start, end + 1));
  } catch {
    return new Response(
      JSON.stringify({ error: "PARSE_ERROR" }),
      { status: 422, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }

  return new Response(
    JSON.stringify(parsed),
    { headers: { ...corsHeaders, "Content-Type": "application/json" } },
  );
}
