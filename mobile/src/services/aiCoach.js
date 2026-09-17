import { supabase, SUPABASE_URL, SUPABASE_ANON_KEY } from "../lib/supabase";

function detectMessageCategory(message) {
  const msg = message.toLowerCase();
  if (msg.match(/food|eat|meal|calori|protein|carb|fat|diet|nutrition|breakfast|lunch|dinner|snack|ugali|matoke|chapati|sukuma|kachumbari/)) return "nutrition";
  if (msg.match(/workout|exercise|run|cycl|walk|hiit|train|gym|session|cardio|strength/)) return "workout";
  if (msg.match(/sleep|rest|tired|recovery|insomnia|wake/)) return "sleep";
  if (msg.match(/weight|fat|slim|lose|gain|bmi|belly|scale/)) return "weight";
  if (msg.match(/water|hydrat|drink/)) return "hydration";
  if (msg.match(/motivat|give up|hard|struggle|quit|discourag/)) return "motivation";
  if (msg.match(/supplement|protein powder|creatine|vitamin/)) return "supplement";
  if (msg.match(/pain|hurt|injur|sore|ache/)) return "recovery";
  return "general";
}

function getFallbackReply(category, profile) {
  const name = profile?.name || "there";
  const replies = {
    nutrition: [
      `Great question ${name}! Focus on hitting your protein target first — everything else follows. Include sukuma wiki or spinach daily for iron and vitamins. Coach TinaBarks will personally follow up soon! 🌸`,
      `For your goal, aim to fill half your plate with vegetables like kachumbari or sukuma wiki at lunch. Keep dinner light — protein + greens only. Coach TinaBarks will follow up soon! 🌸`,
    ],
    workout: [
      `Consistency beats perfection every time ${name}! Even a 20-min walk counts as movement. Log it in WeGoFit and watch your streak build! Coach TinaBarks will personally follow up soon! 🌸`,
      `For best results, mix cardio with strength training across the week. Your WeGoFit Train tab has everything you need! Coach TinaBarks will follow up with a personalised plan soon! 🌸`,
    ],
    sleep: [
      `Sleep is your secret weapon ${name}! 7-9 hours = better recovery, less cravings and more fat burn. Try sleeping before 10PM tonight. Coach TinaBarks will follow up soon! 🌸`,
    ],
    weight: [
      `You are closer than you think ${name}! Trust the process — your body is changing even when the scale doesn't move. Focus on how you FEEL. Coach TinaBarks will personally follow up soon! 🌸`,
      `Small consistent steps beat drastic measures every time. Stick to your calorie target and keep logging! Coach TinaBarks will check your progress soon! 🌸`,
    ],
    hydration: [
      `Water is your best fat-loss tool ${name}! Aim for 2L daily. Try warm lemon water first thing in the morning — it boosts metabolism! Coach TinaBarks will follow up soon! 🌸`,
    ],
    motivation: [
      `You showed up today ${name} and that is everything! Progress is not always visible but it IS happening. Trust the journey. Coach TinaBarks believes in you completely! 🌸`,
      `Every champion was once a beginner who refused to give up. You have already taken the hardest step — starting. Keep going ${name}! Coach TinaBarks is in your corner always! 🌸`,
    ],
    supplement: [
      `For your goals, focus on whole foods first ${name}. Whey protein post-workout is a great addition if needed. Creatine is safe and effective for strength. Coach TinaBarks will give you a specific recommendation soon! 🌸`,
    ],
    recovery: [
      `Please listen to your body ${name}. Rest days are as important as workout days. If pain persists please see a doctor. Light stretching and hydration help recovery. Coach TinaBarks will follow up soon! 🌸`,
    ],
    general: [
      `Thank you for reaching out ${name}! Your dedication to your health journey is inspiring. Keep logging, keep moving and keep believing. Coach TinaBarks will personally reply to you very soon! 🌸`,
      `Hey ${name}! Great to hear from you. Your WeGoFit journey is looking amazing — keep up the consistency! Coach TinaBarks will personally follow up with you soon! 🌸`,
    ],
  };
  const options = replies[category] || replies.general;
  return options[Math.floor(Math.random() * options.length)];
}

async function getAICoachReply(userMessage, clientProfile) {
  const category = detectMessageCategory(userMessage);
  const systemPrompt = `You are TinaBarks' AI Assistant for WeGoFit, a premium East African fitness app. You are warm, encouraging, professional and knowledgeable about fitness and nutrition.

Client: ${clientProfile?.name || "there"}, Goal: ${clientProfile?.goal || "improve fitness"}, Weight: ${clientProfile?.weight_kg || "unknown"}kg, Calorie target: ${clientProfile?.dailyCalorieTarget || 1800} kcal, Activity: ${clientProfile?.activity_level || "moderate"}, Location: East Africa. Category: ${category}.

CRITICAL RULE: Keep every response under 60 words maximum. Never write long paragraphs. Use short punchy sentences. Maximum 3-4 sentences per response. This is a mobile chat — be concise.
RULES: Never start with a prefix like "TinaBarks' Assistant:" or "Assistant:" — reply directly. Reference East African foods/context where relevant. Use 1-2 emojis max. Never give medical advice. Always be positive. If about injury/pain → recommend seeing a doctor.`;
  try {
    const { data: { session } } = await supabase.auth.getSession();
    const accessToken = session?.access_token || SUPABASE_ANON_KEY;
    const res = await fetch(SUPABASE_URL + "/functions/v1/ai-coach", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Authorization": `Bearer ${accessToken}`, "Apikey": SUPABASE_ANON_KEY },
      body: JSON.stringify({
        mode: "coach",
        messages: [{ role: "user", content: userMessage }],
        userContext: {
          name: clientProfile?.name,
          goal: clientProfile?.goal,
          weight_kg: clientProfile?.weight_kg,
          dailyCalorieTarget: clientProfile?.dailyCalorieTarget,
          activity_level: clientProfile?.activity_level,
        },
      }),
    });
    if (!res.ok) throw new Error("API error");
    const data = await res.json();
    return data.reply;
  } catch (_e) {
    return getFallbackReply(category, clientProfile);
  }
}

function generateWelcomeMessage(profile) {
  const name     = profile?.name || "Champion";
  const goal     = profile?.goal;
  const hour     = new Date().getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";
  const goalText = { lose: "lose weight and feel amazing", gain: "build muscle and get stronger",
    maintain: "maintain your healthy lifestyle", fitness: "improve your fitness and energy" }[goal] || "reach your fitness goals";
  const quickStart = ({
    lose:     ["Log all 4 meals today", "Hit your 2L water goal", "Take a 20-minute walk", "Check your personalised meal plan"],
    gain:     ["Log your protein intake today", "Complete your first workout", "Hit your calorie target", "Check your meal plan for muscle gain"],
    maintain: ["Log today's meals", "Stay hydrated — 2L today", "Move for at least 30 minutes", "Check in on your progress"],
    fitness:  ["Start with a 20-minute workout", "Log all your meals today", "Hit your water goal", "Explore the workout videos"],
  })[goal] || ["Log today's meals", "Drink 2L of water", "Complete a workout", "Check your meal plan"];
  return { id: "welcome_" + Date.now(), sender: "coach", role: "coach", isWelcome: true,
    timestamp: new Date().toISOString(), ts: new Date().toISOString(),
    name, greeting, goalText, quickStart, text: `${greeting} ${name}! Welcome to WeGoFit! 🎉` };
}

export { detectMessageCategory, getFallbackReply, getAICoachReply, generateWelcomeMessage };
