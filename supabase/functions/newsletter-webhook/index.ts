import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { jsonResponse } from "../_shared/http.ts";

// Resend → Supabase contact-state sync.
//
// A subscriber who clicks the unsubscribe link in a Resend broadcast is
// suppressed on Resend's side, but our `newsletter_subscribers` row stayed
// `confirmed` forever — the table silently overcounted. Resend emits
// webhook events for contact changes; this endpoint mirrors them back:
//
//   contact.updated (unsubscribed: true)  → status 'unsubscribed'
//   contact.updated (unsubscribed: false) → back to 'confirmed', but ONLY
//       for rows currently 'unsubscribed'. Our own confirm flow PATCHes
//       the Resend contact while the row is still 'pending', so this
//       guard keeps the webhook from racing newsletter-confirm's update.
//   contact.deleted → status 'unsubscribed' (rows are kept for audit —
//       see the newsletter_subscribers migration. Account deletion removes
//       the DB row before the Resend contact, so that path no-ops here.)
//
// Anything else (email.* events, unknown types) is acknowledged with 200
// so Resend doesn't retry.
//
// Setup (one-time, Resend dashboard):
//   1. Webhooks → Add endpoint:
//        https://<project-ref>.supabase.co/functions/v1/newsletter-webhook
//      with the `contact.updated` and `contact.deleted` events.
//   2. Copy the endpoint's signing secret (whsec_…) and set it:
//        supabase secrets set RESEND_WEBHOOK_SECRET=whsec_…
//
// Auth model: no CORS/origin handling (the caller is Resend's webhook
// infrastructure, not a browser) and no Supabase JWT (config.toml sets
// verify_jwt = false). The gate is the Svix signature check below —
// requests that don't carry a valid HMAC from our signing secret are
// rejected before anything is parsed. No rate limiter on purpose:
// throttling a signed webhook would just trigger Svix retry storms.

const encoder = new TextEncoder();

const base64Decode = (value: string): Uint8Array =>
  Uint8Array.from(atob(value), (c) => c.charCodeAt(0));

const base64Encode = (bytes: Uint8Array): string => {
  let binary = "";
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary);
};

// Constant-time comparison so signature checking doesn't leak match
// position through timing. Length mismatch returns early — length is
// public information for a fixed-size HMAC.
const timingSafeEqual = (a: string, b: string): boolean => {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
};

// Resend delivers webhooks through Svix. Signed content is
// `${svix-id}.${svix-timestamp}.${rawBody}`, HMAC-SHA256 with the
// base64-decoded portion of the whsec_ secret, base64-encoded, and the
// svix-signature header may carry several space-separated `v1,<sig>`
// entries (e.g. after a secret rotation) — any one matching is valid.
const SIGNATURE_TOLERANCE_SECONDS = 5 * 60;

async function verifySvixSignature(
  headers: Headers,
  rawBody: string,
  secret: string,
): Promise<boolean> {
  const id = headers.get("svix-id");
  const timestamp = headers.get("svix-timestamp");
  const signatureHeader = headers.get("svix-signature");
  if (!id || !timestamp || !signatureHeader) return false;

  // Replay protection: reject timestamps outside the tolerance window.
  const ts = Number(timestamp);
  if (!Number.isFinite(ts)) return false;
  if (Math.abs(Date.now() / 1000 - ts) > SIGNATURE_TOLERANCE_SECONDS) return false;

  let secretBytes: Uint8Array;
  try {
    secretBytes = base64Decode(secret.startsWith("whsec_") ? secret.slice(6) : secret);
  } catch {
    return false;
  }

  const key = await crypto.subtle.importKey(
    "raw",
    secretBytes,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const mac = await crypto.subtle.sign(
    "HMAC",
    key,
    encoder.encode(`${id}.${timestamp}.${rawBody}`),
  );
  const expected = base64Encode(new Uint8Array(mac));

  return signatureHeader.split(" ").some((entry) => {
    const [version, signature] = entry.split(",");
    return version === "v1" && !!signature && timingSafeEqual(signature, expected);
  });
}

Deno.serve(async (req) => {
  if (req.method !== "POST") {
    return jsonResponse(405, { ok: false, error: "Method not allowed" }, {});
  }

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
    const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    const WEBHOOK_SECRET = Deno.env.get("RESEND_WEBHOOK_SECRET") ?? "";
    if (!SUPABASE_URL || !SERVICE_ROLE_KEY || !WEBHOOK_SECRET) {
      console.error("newsletter-webhook: missing env (URL / service key / RESEND_WEBHOOK_SECRET)");
      return jsonResponse(500, { ok: false, error: "Server not configured" }, {});
    }

    // The signature covers the raw bytes — read them before any parsing.
    const rawBody = await req.text();
    if (!(await verifySvixSignature(req.headers, rawBody, WEBHOOK_SECRET))) {
      return jsonResponse(401, { ok: false, error: "Invalid signature" }, {});
    }

    let event: { type?: string; data?: { email?: string; unsubscribed?: boolean } };
    try {
      event = JSON.parse(rawBody);
    } catch {
      return jsonResponse(400, { ok: false, error: "Invalid JSON" }, {});
    }

    const type = event?.type ?? "";
    const email = String(event?.data?.email ?? "").trim().toLowerCase();
    if (!type.startsWith("contact.") || !email) {
      // Not a contact event (or one without an email) — acknowledge so
      // Resend doesn't retry a payload we'll never act on.
      return jsonResponse(200, { ok: true, ignored: true }, {});
    }

    const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

    if (type === "contact.deleted" || (type === "contact.updated" && event.data?.unsubscribed === true)) {
      const { error } = await admin
        .from("newsletter_subscribers")
        .update({ status: "unsubscribed", unsubscribed_at: new Date().toISOString() })
        .eq("email", email)
        .neq("status", "unsubscribed");
      if (error) throw error;
      return jsonResponse(200, { ok: true }, {});
    }

    if (type === "contact.updated" && event.data?.unsubscribed === false) {
      // Re-subscribed on Resend's side. Only revive rows we previously
      // marked unsubscribed — pending rows are mid-confirm (our confirm
      // flow syncs to Resend before flipping the row) and must be left
      // for newsletter-confirm to finish.
      const { error } = await admin
        .from("newsletter_subscribers")
        .update({ status: "confirmed", unsubscribed_at: null })
        .eq("email", email)
        .eq("status", "unsubscribed");
      if (error) throw error;
      return jsonResponse(200, { ok: true }, {});
    }

    return jsonResponse(200, { ok: true, ignored: true }, {});
  } catch (error) {
    console.error("newsletter-webhook error:", error instanceof Error ? error.message : String(error));
    return jsonResponse(500, { ok: false, error: "Server error" }, {});
  }
});
