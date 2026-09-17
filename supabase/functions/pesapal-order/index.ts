import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

const PESAPAL_BASE_URL = "https://pay.pesapal.com/v3";
const IPN_URL = `${Deno.env.get("SUPABASE_URL")}/functions/v1/pesapal-ipn`;

async function getPesapalToken(consumerKey: string, consumerSecret: string): Promise<string> {
  const res = await fetch(`${PESAPAL_BASE_URL}/api/Auth/RequestToken`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "Accept": "application/json" },
    body: JSON.stringify({ consumer_key: consumerKey, consumer_secret: consumerSecret }),
  });
  if (!res.ok) {
    const txt = await res.text();
    throw new Error(`Pesapal auth failed (${res.status}): ${txt}`);
  }
  const data = await res.json();
  if (!data.token) throw new Error(`No token in Pesapal response: ${JSON.stringify(data)}`);
  return data.token as string;
}

async function registerIPN(token: string): Promise<string> {
  const res = await fetch(`${PESAPAL_BASE_URL}/api/URLSetup/RegisterIPN`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Accept": "application/json",
      "Authorization": `Bearer ${token}`,
    },
    body: JSON.stringify({ url: IPN_URL, ipn_notification_type: "GET" }),
  });
  const data = await res.json();
  // ipn_id may already exist — either way return it
  return (data.ipn_id ?? data.notification_id ?? "") as string;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const consumerKey    = Deno.env.get("PESAPAL_CONSUMER_KEY");
    const consumerSecret = Deno.env.get("PESAPAL_CONSUMER_SECRET");

    if (!consumerKey || !consumerSecret) {
      throw new Error("Pesapal credentials not configured");
    }

    const {
      merchant_reference,
      currency,
      amount,
      description,
      email,
      first_name,
      last_name,
    } = await req.json();

    if (!merchant_reference || !currency || !amount || !email) {
      throw new Error("Missing required fields: merchant_reference, currency, amount, email");
    }

    // Step 1 — get auth token
    const token = await getPesapalToken(consumerKey, consumerSecret);

    // Step 2 — register IPN (idempotent)
    const ipnId = await registerIPN(token);

    // Step 3 — submit order
    const orderBody = {
      id:               merchant_reference,
      currency:         currency,
      amount:           Number(amount),
      description:      description ?? "WeGoFit Subscription",
      callback_url:     IPN_URL,
      notification_id:  ipnId,
      billing_address: {
        email_address: email,
        first_name:    first_name ?? "",
        last_name:     last_name  ?? "",
        phone_number:  "",
        line_1:        "",
        line_2:        "",
        city:          "",
        state:         "",
        postal_code:   "",
        zip_code:      "",
        country_code:  currency === "KES" ? "KE" : currency === "UGX" ? "UG" : "US",
      },
    };

    const orderRes = await fetch(`${PESAPAL_BASE_URL}/api/Transactions/SubmitOrderRequest`, {
      method: "POST",
      headers: {
        "Content-Type":  "application/json",
        "Accept":        "application/json",
        "Authorization": `Bearer ${token}`,
      },
      body: JSON.stringify(orderBody),
    });

    if (!orderRes.ok) {
      const txt = await orderRes.text();
      throw new Error(`Pesapal order submission failed (${orderRes.status}): ${txt}`);
    }

    const orderData = await orderRes.json();

    if (!orderData.redirect_url) {
      throw new Error(`No redirect_url from Pesapal: ${JSON.stringify(orderData)}`);
    }

    return new Response(
      JSON.stringify({
        redirect_url:     orderData.redirect_url,
        order_tracking_id: orderData.order_tracking_id ?? "",
        merchant_reference,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    console.error("pesapal-order error:", (err as Error).message);
    return new Response(
      JSON.stringify({ error: (err as Error).message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
