import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const PROD_ORIGINS = [
  "https://therostory.com",
  "https://www.therostory.com",
];

const DEV_ORIGINS = [
  "http://localhost:3000",
  "http://localhost:5173",
];

const IS_LOCAL = Deno.env.get("SUPABASE_URL")?.includes("localhost") || Deno.env.get("SUPABASE_URL")?.includes("127.0.0.1");
const ALLOWED_ORIGINS = IS_LOCAL ? [...PROD_ORIGINS, ...DEV_ORIGINS] : PROD_ORIGINS;

function isAllowedOrigin(origin: string): boolean {
  if (ALLOWED_ORIGINS.includes(origin)) return true;
  if (/^https:\/\/the-rostory-[a-z0-9][a-z0-9-]*\.vercel\.app$/.test(origin)) return true;
  return false;
}

function getCorsHeaders(req: Request) {
  const origin = req.headers.get("Origin") || "";
  const allowedOrigin = isAllowedOrigin(origin) ? origin : ALLOWED_ORIGINS[0];
  return {
    "Access-Control-Allow-Origin": allowedOrigin,
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
  };
}

function escapeHtml(input: string) {
  return input
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

type RateLimitStore = Map<string, number[]>;

function getRateLimitStore(): RateLimitStore {
  const globalScope = globalThis as typeof globalThis & { __rostoryContactRateLimit?: RateLimitStore };
  if (!globalScope.__rostoryContactRateLimit) {
    globalScope.__rostoryContactRateLimit = new Map();
  }
  return globalScope.__rostoryContactRateLimit;
}

function getClientIp(req: Request): string {
  const forwarded = req.headers.get("x-forwarded-for");
  if (forwarded) {
    return forwarded.split(",")[0]?.trim() || "unknown";
  }
  return req.headers.get("cf-connecting-ip") || "unknown";
}

function isRateLimited(req: Request): boolean {
  const store = getRateLimitStore();
  const key = `ip:${getClientIp(req)}`;
  const now = Date.now();
  const windowMs = 10 * 60 * 1000; // 10 minutes
  const maxRequests = 5;
  const recent = (store.get(key) || []).filter((ts) => now - ts < windowMs);
  recent.push(now);
  store.set(key, recent);
  return recent.length > maxRequests;
}

Deno.serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);

  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ ok: false, error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const origin = req.headers.get("Origin");
    if (origin && !isAllowedOrigin(origin)) {
      return new Response(JSON.stringify({ ok: false, error: "Origin not allowed" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (isRateLimited(req)) {
      return new Response(JSON.stringify({ ok: false, error: "Too many requests. Please try again later." }), {
        status: 429,
        headers: { ...corsHeaders, "Content-Type": "application/json", "Retry-After": "600" },
      });
    }

    const { name, email, message, website } = await req.json();

    // Honeypot field for basic bot filtering
    if (String(website || "").trim()) {
      return new Response(JSON.stringify({ ok: false, error: "Invalid request" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const safeName = String(name || "").trim();
    const safeEmail = String(email || "").trim();
    const safeMessage = String(message || "").trim();

    if (!safeName || !safeEmail || !safeMessage) {
      return new Response(JSON.stringify({ ok: false, error: "Missing fields" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(safeEmail)) {
      return new Response(JSON.stringify({ ok: false, error: "Invalid email format" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (safeMessage.length < 10 || safeMessage.length > 5000) {
      return new Response(JSON.stringify({ ok: false, error: "Message must be between 10 and 5000 characters" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
    const CONTACT_TO_EMAIL = Deno.env.get("CONTACT_TO_EMAIL");
    const CONTACT_FROM_EMAIL = Deno.env.get("CONTACT_FROM_EMAIL");

    if (!RESEND_API_KEY || !CONTACT_TO_EMAIL || !CONTACT_FROM_EMAIL) {
      return new Response(JSON.stringify({ ok: false, error: "Server not configured" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const subject = `New message from ${safeName}`;
    const html = `
      <div style="font-family: Arial, sans-serif; line-height: 1.5;">
        <h2>New Contact Form Message</h2>
        <p><strong>Name:</strong> ${escapeHtml(safeName)}</p>
        <p><strong>Email:</strong> ${escapeHtml(safeEmail)}</p>
        <p><strong>Message:</strong></p>
        <pre style="white-space: pre-wrap; padding: 12px; border: 1px solid #eee; border-radius: 8px;">${escapeHtml(
          safeMessage
        )}</pre>
      </div>
    `;

    const resendResp = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: CONTACT_FROM_EMAIL,
        to: [CONTACT_TO_EMAIL],
        reply_to: safeEmail,
        subject,
        html,
      }),
    });

    if (!resendResp.ok) {
      console.error("Resend API error:", resendResp.status, await resendResp.text());
      return new Response(JSON.stringify({ ok: false, error: "Failed to send message. Please try again later." }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch {
    return new Response(JSON.stringify({ ok: false, error: "Server error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
