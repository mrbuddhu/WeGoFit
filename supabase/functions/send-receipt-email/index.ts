import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

const RESEND_API_KEY  = Deno.env.get("RESEND_API_KEY") ?? "";
const FROM_EMAIL      = Deno.env.get("RESEND_FROM_EMAIL") ?? "WeGoFit <receipts@wegofit.app>";

function fmt(iso: string | null | undefined): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-US", {
    weekday: "long", year: "numeric", month: "long", day: "numeric",
  });
}

function buildHtml(data: {
  email: string;
  plan: string;
  amount: number;
  currency: string;
  paid_at: string;
  next_billing_date: string;
  pesapal_tracking_id: string;
}): string {
  const planLabel   = data.plan === "annual" ? "Annual Plan" : "Monthly Plan";
  const currencyMap: Record<string, string> = { USD: "$", UGX: "UGX ", KES: "KES " };
  const symbol      = currencyMap[data.currency] ?? "";
  const amountFmt   = `${symbol}${Number(data.amount).toLocaleString()}`;

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>WeGoFit Payment Receipt</title>
</head>
<body style="margin:0;padding:0;background:#F3F4F6;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#F3F4F6;padding:40px 0;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:#FFFFFF;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08);">

          <!-- Header -->
          <tr>
            <td style="background:#111827;padding:36px 40px;text-align:center;">
              <div style="font-size:28px;font-weight:900;color:#FFFFFF;letter-spacing:-0.5px;">
                <span style="color:#EF4444;">We</span>GoFit
              </div>
              <div style="color:rgba(255,255,255,0.5);font-size:13px;margin-top:4px;letter-spacing:2px;text-transform:uppercase;">Premium Fitness Coaching</div>
            </td>
          </tr>

          <!-- Green confirmed banner -->
          <tr>
            <td style="background:#ECFDF5;padding:24px 40px;text-align:center;border-bottom:1px solid #D1FAE5;">
              <div style="display:inline-block;background:#22C55E;border-radius:50%;width:48px;height:48px;line-height:48px;font-size:24px;text-align:center;margin-bottom:12px;">&#10003;</div>
              <div style="font-size:22px;font-weight:800;color:#065F46;">Payment Confirmed</div>
              <div style="font-size:14px;color:#047857;margin-top:4px;">Your WeGoFit Premium subscription is now active</div>
            </td>
          </tr>

          <!-- Receipt details -->
          <tr>
            <td style="padding:32px 40px;">
              <div style="font-size:13px;font-weight:700;color:#6B7280;text-transform:uppercase;letter-spacing:1px;margin-bottom:16px;">Receipt Summary</div>

              <table width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #E5E7EB;border-radius:12px;overflow:hidden;">
                <tr style="background:#F9FAFB;">
                  <td style="padding:14px 20px;font-size:14px;color:#6B7280;font-weight:600;border-bottom:1px solid #E5E7EB;">Plan</td>
                  <td style="padding:14px 20px;font-size:14px;color:#111827;font-weight:700;text-align:right;border-bottom:1px solid #E5E7EB;">${planLabel}</td>
                </tr>
                <tr>
                  <td style="padding:14px 20px;font-size:14px;color:#6B7280;font-weight:600;border-bottom:1px solid #E5E7EB;">Amount Paid</td>
                  <td style="padding:14px 20px;font-size:16px;color:#EF4444;font-weight:800;text-align:right;border-bottom:1px solid #E5E7EB;">${amountFmt} <span style="font-size:12px;color:#9CA3AF;">${data.currency}</span></td>
                </tr>
                <tr style="background:#F9FAFB;">
                  <td style="padding:14px 20px;font-size:14px;color:#6B7280;font-weight:600;border-bottom:1px solid #E5E7EB;">Payment Date</td>
                  <td style="padding:14px 20px;font-size:14px;color:#111827;font-weight:600;text-align:right;border-bottom:1px solid #E5E7EB;">${fmt(data.paid_at)}</td>
                </tr>
                <tr>
                  <td style="padding:14px 20px;font-size:14px;color:#6B7280;font-weight:600;border-bottom:1px solid #E5E7EB;">Next Billing Date</td>
                  <td style="padding:14px 20px;font-size:14px;color:#111827;font-weight:600;text-align:right;border-bottom:1px solid #E5E7EB;">${fmt(data.next_billing_date)}</td>
                </tr>
                <tr style="background:#F9FAFB;">
                  <td style="padding:14px 20px;font-size:13px;color:#6B7280;font-weight:600;">Receipt Reference</td>
                  <td style="padding:14px 20px;font-size:12px;color:#4B5563;font-family:monospace;text-align:right;word-break:break-all;">${data.pesapal_tracking_id || "—"}</td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Coach message -->
          <tr>
            <td style="padding:0 40px 32px;">
              <table width="100%" cellpadding="0" cellspacing="0" style="background:linear-gradient(135deg,#111827 0%,#1E2837 100%);border-radius:12px;overflow:hidden;">
                <tr>
                  <td style="padding:24px 28px;">
                    <div style="color:rgba(255,255,255,0.5);font-size:12px;text-transform:uppercase;letter-spacing:1px;margin-bottom:10px;">A message from your coach</div>
                    <div style="color:#FFFFFF;font-size:15px;line-height:1.7;font-style:italic;">
                      "Welcome to the WeGoFit Premium family! I am so proud of you for taking this step towards a healthier, stronger you. Your journey starts now — let's make every workout count. I'll be here every step of the way, cheering you on. Let's go! 💪"
                    </div>
                    <div style="margin-top:16px;display:flex;align-items:center;">
                      <div>
                        <div style="color:#EF4444;font-weight:700;font-size:14px;">Coach TinaBarks</div>
                        <div style="color:rgba(255,255,255,0.4);font-size:12px;">Head Coach · WeGoFit</div>
                      </div>
                    </div>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Support note -->
          <tr>
            <td style="padding:0 40px 32px;text-align:center;">
              <div style="font-size:13px;color:#9CA3AF;line-height:1.6;">
                Questions about your subscription? Reply to this email or contact us at
                <a href="mailto:support@wegofit.app" style="color:#EF4444;text-decoration:none;">support@wegofit.app</a>
              </div>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background:#F9FAFB;padding:20px 40px;text-align:center;border-top:1px solid #E5E7EB;">
              <div style="font-size:12px;color:#9CA3AF;">
                &copy; ${new Date().getFullYear()} WeGoFit. All rights reserved.
              </div>
              <div style="font-size:11px;color:#D1D5DB;margin-top:4px;">
                This receipt was sent to ${data.email}
              </div>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    if (!RESEND_API_KEY) {
      console.error("RESEND_API_KEY is not configured");
      return new Response(JSON.stringify({ error: "Email service not configured" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json();
    const { email, plan, amount, currency, paid_at, next_billing_date, pesapal_tracking_id } = body;

    if (!email) {
      return new Response(JSON.stringify({ error: "Missing email address" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const html = buildHtml({ email, plan, amount, currency, paid_at, next_billing_date, pesapal_tracking_id });

    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: FROM_EMAIL,
        to: [email],
        subject: `Payment Confirmed — WeGoFit ${plan === "annual" ? "Annual" : "Monthly"} Plan`,
        html,
      }),
    });

    const result = await res.json();

    if (!res.ok) {
      console.error("Resend error:", result);
      return new Response(JSON.stringify({ error: result }), {
        status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ success: true, id: result.id }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: (err as Error).message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
