import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getCorsHeaders, isAllowedOrigin } from "../_shared/cors.ts";
import { createRateLimiter, getClientIp } from "../_shared/rate-limit.ts";
import { jsonResponse } from "../_shared/http.ts";

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
    return jsonResponse(405, { ok: false, error: "Method not allowed" }, corsHeaders);
  }

  try {
    const origin = req.headers.get("Origin");
    if (origin && !isAllowedOrigin(origin)) {
      return jsonResponse(403, { ok: false, error: "Origin not allowed" }, corsHeaders);
    }

    const body = await req.json().catch(() => ({} as Record<string, unknown>));
    const articleId = String(body?.articleId ?? "").trim();
    if (!articleId || articleId.length > 100) {
      return jsonResponse(400, { ok: false, error: "Invalid article id" }, corsHeaders);
    }

    if (isRateLimited(getClientIp(req), articleId)) {
      // Fail soft: the view counter is cosmetic and we don't want honest
      // clients (multiple readers behind one NAT'd IP) to see error toasts.
      // We just refuse to increment further this minute.
      return jsonResponse(200, { ok: true, rateLimited: true }, corsHeaders);
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    if (!supabaseUrl || !serviceRoleKey) {
      console.error("increment-view: missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
      return jsonResponse(500, { ok: false, error: "Server not configured" }, corsHeaders);
    }

    const adminClient = createClient(supabaseUrl, serviceRoleKey);
    const { error } = await adminClient.rpc("increment_article_view", {
      p_article_id: articleId,
    });

    if (error) {
      console.error("increment-view rpc failed", error.message);
      return jsonResponse(500, { ok: false, error: "RPC failed" }, corsHeaders);
    }

    return jsonResponse(200, { ok: true }, corsHeaders);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("increment-view error:", message);
    return jsonResponse(500, { ok: false, error: "Server error" }, corsHeaders);
  }
});
