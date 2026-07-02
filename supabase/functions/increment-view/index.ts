import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getCorsHeaders, isAllowedOrigin } from "../_shared/cors.ts";
import { createRateLimiter, getClientIp } from "../_shared/rate-limit.ts";

// Rate limiter keyed by `<ip>:<articleId>` (shared implementation in
// _shared/rate-limit.ts). The goal is to stop scripted view-count
// inflation, not to be a bulletproof gate.
const rateLimiter = createRateLimiter({
  globalKey: "__rostoryViewRateLimit",
  windowMs: 60_000,
  max: 30,
});
const isRateLimited = (ip: string, articleId: string): boolean =>
  rateLimiter.isRateLimited(`${ip}:${articleId}`);

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

    const body = await req.json().catch(() => ({} as Record<string, unknown>));
    const articleId = String(body?.articleId ?? "").trim();
    if (!articleId || articleId.length > 100) {
      return new Response(JSON.stringify({ ok: false, error: "Invalid article id" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (isRateLimited(getClientIp(req), articleId)) {
      // Fail soft: the view counter is cosmetic and we don't want honest
      // clients (multiple readers behind one NAT'd IP) to see error toasts.
      // We just refuse to increment further this minute.
      return new Response(JSON.stringify({ ok: true, rateLimited: true }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    if (!supabaseUrl || !serviceRoleKey) {
      console.error("increment-view: missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
      return new Response(JSON.stringify({ ok: false, error: "Server not configured" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const adminClient = createClient(supabaseUrl, serviceRoleKey);
    const { error } = await adminClient.rpc("increment_article_view", {
      p_article_id: articleId,
    });

    if (error) {
      console.error("increment-view rpc failed", error.message);
      return new Response(JSON.stringify({ ok: false, error: "RPC failed" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("increment-view error:", message);
    return new Response(JSON.stringify({ ok: false, error: "Server error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
