import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getCorsHeaders, isAllowedOrigin } from "../_shared/cors.ts";

const json = (body: unknown, corsHeaders: Record<string, string>) =>
  // Always HTTP 200: supabase.functions.invoke() treats non-2xx as a thrown
  // error whose body is awkward to read client-side. The ok/error fields in
  // the payload carry the real outcome ("invalid" | "expired" | "server").
  new Response(JSON.stringify(body), {
    status: 200,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const TOKEN_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

Deno.serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);

  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ ok: false, error: "invalid" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const origin = req.headers.get("Origin");
    if (origin && !isAllowedOrigin(origin)) {
      return new Response(JSON.stringify({ ok: false, error: "invalid" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json().catch(() => ({} as Record<string, unknown>));
    const token = String(body?.token ?? "").trim();
    if (!UUID_RE.test(token)) return json({ ok: false, error: "invalid" }, corsHeaders);

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
    const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
    if (!SUPABASE_URL || !SERVICE_ROLE_KEY || !RESEND_API_KEY) {
      return json({ ok: false, error: "server" }, corsHeaders);
    }

    const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

    const { data: row, error: lookupError } = await admin
      .from("newsletter_subscribers")
      .select("id, email, status, confirm_sent_at")
      .eq("confirm_token", token)
      .maybeSingle();
    if (lookupError) throw lookupError;

    if (!row) return json({ ok: false, error: "invalid" }, corsHeaders);
    if (row.status === "confirmed") return json({ ok: true, already: true }, corsHeaders);
    if (Date.now() - new Date(row.confirm_sent_at).getTime() > TOKEN_TTL_MS) {
      return json({ ok: false, error: "expired" }, corsHeaders);
    }

    const { error: updateError } = await admin
      .from("newsletter_subscribers")
      .update({ status: "confirmed", confirmed_at: new Date().toISOString() })
      .eq("id", row.id);
    if (updateError) throw updateError;

    // New Resend model: Contacts are top-level (Audiences were deprecated in
    // favor of Segments, and contacts no longer live under an audience UUID).
    // Create the contact directly; if it already exists (a returning
    // subscriber), POST returns an error, so fall back to PATCH-by-email to
    // flip them back to subscribed. Failures here are logged but don't fail
    // the confirmation — the Supabase table is the source of truth and the
    // contact can be re-synced by hand from the table.
    const resendHeaders = {
      Authorization: `Bearer ${RESEND_API_KEY}`,
      "Content-Type": "application/json",
    };
    const post = await fetch("https://api.resend.com/contacts", {
      method: "POST",
      headers: resendHeaders,
      body: JSON.stringify({ email: row.email, unsubscribed: false }),
    });
    if (!post.ok) {
      const patch = await fetch(
        `https://api.resend.com/contacts/${encodeURIComponent(row.email)}`,
        {
          method: "PATCH",
          headers: resendHeaders,
          body: JSON.stringify({ unsubscribed: false }),
        }
      );
      if (!patch.ok) {
        console.error(
          "newsletter-confirm: failed to sync contact to Resend",
          post.status, await post.text().catch(() => ""),
          patch.status, await patch.text().catch(() => "")
        );
      }
    }

    return json({ ok: true }, corsHeaders);
  } catch (error) {
    console.error("newsletter-confirm error:", error instanceof Error ? error.message : String(error));
    return json({ ok: false, error: "server" }, corsHeaders);
  }
});
