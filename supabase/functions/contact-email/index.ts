import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { getCorsHeaders, isAllowedOrigin } from "../_shared/cors.ts";
import { createRateLimiter, getClientIp } from "../_shared/rate-limit.ts";

function escapeHtml(input: string) {
  return input
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

// Replace control chars (notably CR/LF) in name/subject so a crafted value
// can't smuggle extra lines into the email Subject header. Resend builds
// headers server-side from JSON so this isn't exploitable today, but it's
// cheap defense-in-depth. Not applied to the message body, which legitimately
// contains newlines.
function stripControlChars(input: string): string {
  let out = "";
  for (const ch of input) {
    const code = ch.codePointAt(0) ?? 0;
    // C0 control chars (incl. CR/LF/Tab) and DEL -> space, so words don't run
    // together. Done by codepoint to keep this source free of control bytes.
    out += code < 0x20 || code === 0x7f ? " " : ch;
  }
  return out.trim();
}

// Per-IP rate limiter (shared implementation in _shared/rate-limit.ts).
const rateLimiter = createRateLimiter({
  globalKey: "__rostoryContactRateLimit",
  windowMs: 10 * 60 * 1000, // 10 minutes
  max: 5,
});
const isRateLimited = (req: Request): boolean =>
  rateLimiter.isRateLimited(`ip:${getClientIp(req)}`);

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

    const { name, email, message, website, subject } = await req.json();

    // Honeypot field for basic bot filtering
    if (String(website || "").trim()) {
      return new Response(JSON.stringify({ ok: false, error: "Invalid request" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const safeName = stripControlChars(String(name || ""));
    const safeEmail = String(email || "").trim();
    const safeSubject = stripControlChars(String(subject || "")).slice(0, 200);
    const safeMessage = String(message || "").trim();

    if (!safeName || !safeEmail || !safeMessage) {
      return new Response(JSON.stringify({ ok: false, error: "Missing fields" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (safeName.length > 200) {
      return new Response(JSON.stringify({ ok: false, error: "Name is too long" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // RFC 5321 caps email at 254 chars.
    if (safeEmail.length > 254) {
      return new Response(JSON.stringify({ ok: false, error: "Email is too long" }), {
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

    const emailSubject = safeSubject
      ? `[${safeSubject}] New message from ${safeName}`
      : `New message from ${safeName}`;
    const html = `
      <div style="font-family: Arial, sans-serif; line-height: 1.5;">
        <h2>New Contact Form Message</h2>
        <p><strong>Name:</strong> ${escapeHtml(safeName)}</p>
        <p><strong>Email:</strong> ${escapeHtml(safeEmail)}</p>
        ${safeSubject ? `<p><strong>Subject:</strong> ${escapeHtml(safeSubject)}</p>` : ''}
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
        subject: emailSubject,
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
  } catch (error) {
    const messageText = error instanceof Error ? error.message : String(error);
    console.error("contact-email error:", messageText);
    return new Response(JSON.stringify({ ok: false, error: "Server error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
