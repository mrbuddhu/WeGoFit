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
const LOGO_URI = null;

const VIP_ACCOUNTS = [];

function isVIPAccount(email) {
  if (!email) return false;
  return VIP_ACCOUNTS.includes(email.toLowerCase().trim());
}

const COACH_CREDENTIALS = {
  id:       "coach_tinabarks",
  type:     "coach",
  name:     "TinaBarks",
  email:    "gofit.fitnessapp@gmail.com",
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
  (process.env.EXPO_PUBLIC_SUPABASE_URL || "") +
  "/functions/v1/pesapal-order";
const SUPABASE_ANON_KEY_FOR_EDGE =
  process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || "";

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
