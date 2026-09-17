import { Dimensions } from "react-native";

const { width: SW, height: SH } = Dimensions.get("window");

const C = {
  bg:          "#070B14",
  bgSecondary: "#111827",
  card:        "#111827",
  cardLight:   "#1E2837",
  green:       "#FF6B35",
  greenDim:    "#FF8C5A",
  white:       "#FFFFFF",
  grey:        "rgba(255,255,255,0.45)",
  greyDim:     "rgba(255,255,255,0.3)",
  red:         "#EF4444",
  amber:       "#F59E0B",
  blue:        "#60A5FA",
  rose:        "#FF6B35",
  navy:        "#070B14",
  text:        "#FFFFFF",
  textSub:     "rgba(255,255,255,0.55)",
  border:      "rgba(255,255,255,0.06)",
  primary:     "#FF6B35",
};

const ROSE     = "#FF6B35";
const ROSE_DIM = "#FF8C5A";
const LOGO_URI = { uri: "/Enhanced_Logo.PNG" };

const VIP_ACCOUNTS = [
  "arintina77@gmail.com",
  "gofit.fitnessapp@gmail.com",
];

function isVIPAccount(email) {
  return VIP_ACCOUNTS.includes(email?.toLowerCase().trim());
}

const COACH_CREDENTIALS = {
  id:       "coach_tinabarks",
  type:     "coach",
  name:     "TinaBarks",
  email:    "gofit.fitnessapp@gmail.com",
  password: btoa("WeGoFit@Coach2026!"),
  role:     "admin",
};

const PLAN_PRICE = { monthly: 20, annual: 16, free: 0 };

function planMRR(clients) {
  return clients.reduce((sum, c) => {
    if (c.subscription === "annual")  return sum + PLAN_PRICE.annual;
    if (c.subscription === "monthly") return sum + PLAN_PRICE.monthly;
    return sum;
  }, 0);
}

const PESAPAL_ORDER_URL =
  (process.env.EXPO_PUBLIC_SUPABASE_URL || "https://dthlhxochcwcjduuugbv.supabase.co") +
  "/functions/v1/pesapal-order";
const SUPABASE_ANON_KEY_FOR_EDGE =
  process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ||
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImR0aGxoeG9jaGN3Y2pkdXV1Z2J2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzgzMzk5OTksImV4cCI6MjA5MzkxNTk5OX0.j8J6HHuI7u_3L8TxrZoGGyV4n5amfT766uuya18iVHk";

const PLAN_PRICES = {
  monthly: { USD: 9.99, UGX: 38000 },
  annual:  { USD: 79.99, UGX: 300000 },
};

const PLAN_DISPLAY = {
  monthly: "Monthly",
  annual:  "Annual",
  free:    "Free",
};

const CURRENCY_SYMBOLS = { USD: "$", UGX: "UGX " };

function formatPrice(plan, currency) {
  const price = PLAN_PRICES[plan]?.[currency] ?? 0;
  const symbol = CURRENCY_SYMBOLS[currency] ?? "";
  return `${symbol}${price.toLocaleString()}`;
}

export {
  SW, SH, C, ROSE, ROSE_DIM, LOGO_URI,
  VIP_ACCOUNTS, isVIPAccount,
  COACH_CREDENTIALS, PLAN_PRICE, planMRR,
  PESAPAL_ORDER_URL, SUPABASE_ANON_KEY_FOR_EDGE,
  PLAN_PRICES, PLAN_DISPLAY, CURRENCY_SYMBOLS, formatPrice,
};
