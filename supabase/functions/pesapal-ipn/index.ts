import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

const SUPABASE_URL            = Deno.env.get("SUPABASE_URL");
const SUPABASE_SERVICE_ROLE   = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
const PESAPAL_CONSUMER_KEY    = Deno.env.get("PESAPAL_CONSUMER_KEY");
const PESAPAL_CONSUMER_SECRET = Deno.env.get("PESAPAL_CONSUMER_SECRET");
const PESAPAL_BASE_URL        = "https://pay.pesapal.com/v3";

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE || !PESAPAL_CONSUMER_KEY || !PESAPAL_CONSUMER_SECRET) {
  throw new Error("Missing required environment variables for pesapal-ipn.");
}

async function getPesapalToken(): Promise<string> {
  const res = await fetch(`${PESAPAL_BASE_URL}/api/Auth/RequestToken`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({ consumer_key: PESAPAL_CONSUMER_KEY, consumer_secret: PESAPAL_CONSUMER_SECRET }),
  });
  const data = await res.json();
  return data.token as string;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const url    = new URL(req.url);
    const trackingId  = url.searchParams.get("OrderTrackingId") ?? url.searchParams.get("orderTrackingId") ?? "";
    const merchantRef = url.searchParams.get("OrderMerchantReference") ?? url.searchParams.get("orderMerchantReference") ?? "";

    if (!trackingId || !merchantRef) {
      return new Response(JSON.stringify({ error: "Missing parameters" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Verify transaction with Pesapal
    const token = await getPesapalToken();
    const statusRes = await fetch(
      `${PESAPAL_BASE_URL}/api/Transactions/GetTransactionStatus?orderTrackingId=${trackingId}`,
      { headers: { Accept: "application/json", Authorization: `Bearer ${token}` } }
    );
    const statusData = await statusRes.json();

    // payment_status_description: "Completed" means paid
    const paid = statusData.payment_status_description === "Completed";
    const newStatus = paid ? "active" : (statusData.payment_status_description === "Failed" ? "failed" : "pending");

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE);
    await supabase
      .from("subscriptions")
      .update({ status: newStatus, pesapal_tracking_id: trackingId, updated_at: new Date().toISOString() })
      .eq("pesapal_order_id", merchantRef);

    return new Response(JSON.stringify({ status: newStatus, tracking_id: trackingId }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: (err as Error).message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
