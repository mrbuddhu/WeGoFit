import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

const PESAPAL_CONSUMER_KEY    = Deno.env.get("PESAPAL_CONSUMER_KEY");
const PESAPAL_CONSUMER_SECRET = Deno.env.get("PESAPAL_CONSUMER_SECRET");
if (!PESAPAL_CONSUMER_KEY || !PESAPAL_CONSUMER_SECRET) {
  throw new Error("Pesapal credentials not configured");
}
const PESAPAL_BASE_URL = "https://pay.pesapal.com/v3";

async function getPesapalToken(): Promise<string> {
  const res = await fetch("https://pay.pesapal.com/v3/api/Auth/RequestToken", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Accept": "application/json",
    },
    body: JSON.stringify({
      consumer_key: PESAPAL_CONSUMER_KEY,
      consumer_secret: PESAPAL_CONSUMER_SECRET,
    }),
  });
  if (!res.ok) {
    const txt = await res.text();
    throw new Error(`Pesapal auth failed: ${res.status} ${txt}`);
  }
  const data = await res.json();
  if (!data.token) throw new Error("No token in Pesapal auth response");
  return data.token as string;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const { action, payload } = await req.json();

    if (action === "get_token") {
      const token = await getPesapalToken();
      return new Response(JSON.stringify({ token }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "submit_order") {
      const token = await getPesapalToken();

      // Register IPN if not already registered — safe to call every time
      const ipnUrl = `${Deno.env.get("SUPABASE_URL")}/functions/v1/pesapal-ipn`;
      const ipnRes = await fetch(`${PESAPAL_BASE_URL}/api/URLSetup/RegisterIPN`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ url: ipnUrl, ipn_notification_type: "GET" }),
      });
      const ipnData = await ipnRes.json();
      const ipnId: string = ipnData.ipn_id ?? "";

      const orderRes = await fetch(`${PESAPAL_BASE_URL}/api/Transactions/SubmitOrderRequest`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          id:                payload.merchant_reference,
          currency:          payload.currency,
          amount:            payload.amount,
          description:       payload.description,
          callback_url:      ipnUrl,
          notification_id:   ipnId,
          billing_address: {
            email_address: payload.email,
            first_name:    payload.first_name || "",
            last_name:     payload.last_name  || "",
          },
        }),
      });

      if (!orderRes.ok) {
        const txt = await orderRes.text();
        throw new Error(`Submit order failed: ${orderRes.status} ${txt}`);
      }
      const orderData = await orderRes.json();
      return new Response(JSON.stringify(orderData), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "get_transaction_status") {
      const token = await getPesapalToken();
      const statusRes = await fetch(
        `${PESAPAL_BASE_URL}/api/Transactions/GetTransactionStatus?orderTrackingId=${payload.tracking_id}`,
        {
          headers: {
            Accept: "application/json",
            Authorization: `Bearer ${token}`,
          },
        }
      );
      if (!statusRes.ok) {
        const txt = await statusRes.text();
        throw new Error(`Status check failed: ${statusRes.status} ${txt}`);
      }
      const statusData = await statusRes.json();
      return new Response(JSON.stringify(statusData), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: "Unknown action" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: (err as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
