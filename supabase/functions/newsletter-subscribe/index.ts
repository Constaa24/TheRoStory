import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getCorsHeaders, isAllowedOrigin } from "../_shared/cors.ts";

// In-memory per-IP rate limiter — same pattern as contact-email.
type RateLimitStore = Map<string, number[]>;

function getRateLimitStore(): RateLimitStore {
  const g = globalThis as typeof globalThis & { __rostoryNewsletterRateLimit?: RateLimitStore };
  if (!g.__rostoryNewsletterRateLimit) g.__rostoryNewsletterRateLimit = new Map();
  return g.__rostoryNewsletterRateLimit;
}

function getClientIp(req: Request): string {
  const realIp = req.headers.get("x-real-ip");
  if (realIp) return realIp;
  const forwarded = req.headers.get("x-forwarded-for");
  if (forwarded) {
    const parts = forwarded.split(",").map((p) => p.trim()).filter(Boolean);
    return parts[0] || "unknown";
  }
  return "unknown";
}

const RATE_LIMIT_WINDOW_MS = 10 * 60 * 1000; // 10 minutes
const RATE_LIMIT_MAX = 5;
const RATE_LIMIT_SWEEP_THRESHOLD = 5000;

// Minimum gap between confirmation emails to the same pending address.
// Independent of the per-IP limit: bounds confirmation-email volume per
// target inbox even across rotating IPs.
const RESEND_COOLDOWN_MS = 2 * 60 * 1000; // 2 minutes

function sweepRateLimitStore(store: RateLimitStore, now: number): void {
  if (store.size < RATE_LIMIT_SWEEP_THRESHOLD) return;
  for (const [key, timestamps] of store) {
    if (timestamps.every((ts) => now - ts >= RATE_LIMIT_WINDOW_MS)) store.delete(key);
  }
}

function isRateLimited(req: Request): boolean {
  const store = getRateLimitStore();
  const key = `ip:${getClientIp(req)}`;
  const now = Date.now();
  sweepRateLimitStore(store, now);
  const recent = (store.get(key) || []).filter((ts) => now - ts < RATE_LIMIT_WINDOW_MS);
  recent.push(now);
  store.set(key, recent);
  return recent.length > RATE_LIMIT_MAX;
}

const json = (status: number, body: unknown, corsHeaders: Record<string, string>) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

const SITE_URL = "https://therostory.com";

const confirmEmailHtml = (confirmUrl: string, lang: "en" | "ro") => {
  const copy = lang === "ro"
    ? {
        title: "Confirmă-ți abonarea",
        body: "Apasă butonul de mai jos pentru a confirma abonarea la buletinul The RoStory — o scrisoare pe lună, de pe drum.",
        button: "Confirmă abonarea",
        ignore: "Dacă nu tu ai cerut acest email, îl poți ignora liniștit — nu vei primi nimic fără confirmare.",
      }
    : {
        title: "Confirm your subscription",
        body: "Click the button below to confirm your subscription to The RoStory dispatch — one letter a month, from the road.",
        button: "Confirm subscription",
        ignore: "If you didn't request this, you can safely ignore this email — nothing is sent without confirmation.",
      };
  return `
    <div style="font-family: Georgia, serif; max-width: 520px; margin: 0 auto; padding: 32px 24px; color: #222;">
      <h1 style="font-style: italic; font-size: 26px; margin: 0 0 16px;">The RoStory</h1>
      <h2 style="font-size: 20px; margin: 0 0 12px;">${copy.title}</h2>
      <p style="line-height: 1.6; margin: 0 0 24px;">${copy.body}</p>
      <p style="margin: 0 0 28px;">
        <a href="${confirmUrl}"
           style="background: #c9a96e; color: #1a1611; text-decoration: none; padding: 12px 28px; border-radius: 999px; font-weight: bold;">
          ${copy.button}
        </a>
      </p>
      <p style="font-size: 13px; color: #777; line-height: 1.5;">${copy.ignore}</p>
    </div>`;
};

Deno.serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);

  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json(405, { ok: false, error: "Method not allowed" }, corsHeaders);

  try {
    const origin = req.headers.get("Origin");
    if (origin && !isAllowedOrigin(origin)) {
      return json(403, { ok: false, error: "Origin not allowed" }, corsHeaders);
    }
    if (isRateLimited(req)) {
      return json(429, { ok: false, error: "Too many requests. Please try again later." }, corsHeaders);
    }

    const { email, website, language } = await req.json();

    // Honeypot — real users never fill this hidden field.
    if (String(website || "").trim()) {
      return json(400, { ok: false, error: "Invalid request" }, corsHeaders);
    }

    const safeEmail = String(email || "").trim().toLowerCase();
    const lang: "en" | "ro" = language === "ro" ? "ro" : "en";
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!safeEmail || safeEmail.length > 254 || !emailRegex.test(safeEmail)) {
      return json(400, { ok: false, error: "Invalid email" }, corsHeaders);
    }

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
    const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
    const FROM = Deno.env.get("NEWSLETTER_FROM_EMAIL") || Deno.env.get("CONTACT_FROM_EMAIL");
    if (!SUPABASE_URL || !SERVICE_ROLE_KEY || !RESEND_API_KEY || !FROM) {
      return json(500, { ok: false, error: "Server not configured" }, corsHeaders);
    }

    const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

    const { data: existing, error: lookupError } = await admin
      .from("newsletter_subscribers")
      .select("id, status, confirm_sent_at")
      .eq("email", safeEmail)
      .maybeSingle();
    if (lookupError) throw lookupError;

    // Already confirmed → say nothing distinctive. A generic OK means this
    // endpoint can't be used to probe who is subscribed.
    if (existing?.status === "confirmed") {
      return json(200, { ok: true }, corsHeaders);
    }

    // Pending with a confirmation sent very recently → don't re-send. Stops
    // this endpoint from being used to bomb an arbitrary address with
    // confirmation emails (double opt-in abuse), and stops a user spamming
    // their own inbox. The earlier link stays valid; we just return a
    // generic OK without issuing a new email.
    if (
      existing?.status === "pending" &&
      existing.confirm_sent_at &&
      Date.now() - new Date(existing.confirm_sent_at).getTime() < RESEND_COOLDOWN_MS
    ) {
      return json(200, { ok: true }, corsHeaders);
    }

    // New, stale-pending, or previously unsubscribed: (re)issue a token and
    // (re)send the confirmation email. upsert on the unique `email` is atomic
    // at the DB level, so two concurrent first-time requests for the same
    // address can't collide on the unique constraint (the previous
    // lookup-then-insert raced and surfaced a 500 to the loser).
    const confirmToken = crypto.randomUUID();
    const { error: upsertError } = await admin
      .from("newsletter_subscribers")
      .upsert(
        {
          email: safeEmail,
          status: "pending",
          confirm_token: confirmToken,
          confirm_sent_at: new Date().toISOString(),
        },
        { onConflict: "email" }
      );
    if (upsertError) throw upsertError;

    const confirmUrl = `${SITE_URL}/newsletter/confirm?token=${confirmToken}`;
    const resendResp = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: FROM,
        to: [safeEmail],
        subject: lang === "ro"
          ? "Confirmă-ți abonarea — The RoStory"
          : "Confirm your subscription — The RoStory",
        html: confirmEmailHtml(confirmUrl, lang),
      }),
    });

    if (!resendResp.ok) {
      console.error("newsletter-subscribe Resend error:", resendResp.status, await resendResp.text());
      return json(500, { ok: false, error: "Failed to send confirmation. Please try again later." }, corsHeaders);
    }

    return json(200, { ok: true }, corsHeaders);
  } catch (error) {
    console.error("newsletter-subscribe error:", error instanceof Error ? error.message : String(error));
    return json(500, { ok: false, error: "Server error" }, corsHeaders);
  }
});
