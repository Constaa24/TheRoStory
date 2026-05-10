import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getCorsHeaders, isAllowedOrigin } from "../_shared/cors.ts";

// In-memory rate limiter, keyed by `<ip>:<articleId>`. Same pattern as
// contact-email — survives across requests within a single edge instance,
// and a cold start resets the budget. That's acceptable here: the goal is
// to stop scripted view-count inflation, not to be a bulletproof gate.
type RateLimitStore = Map<string, number[]>;

function getRateLimitStore(): RateLimitStore {
  const globalScope = globalThis as typeof globalThis & {
    __rostoryViewRateLimit?: RateLimitStore;
  };
  if (!globalScope.__rostoryViewRateLimit) {
    globalScope.__rostoryViewRateLimit = new Map();
  }
  return globalScope.__rostoryViewRateLimit;
}

function getClientIp(req: Request): string {
  // Trust only headers populated by the Supabase Edge proxy. cf-connecting-ip
  // is client-controllable here (Supabase Edge isn't behind Cloudflare in a
  // way that strips it), so honoring it would let an attacker rotate buckets
  // by sending random values.
  const realIp = req.headers.get("x-real-ip");
  if (realIp) return realIp;
  const forwarded = req.headers.get("x-forwarded-for");
  if (forwarded) {
    // The leftmost entry is the original client (RFC 7239). Subsequent
    // entries are intermediate proxies. The Supabase ingress overwrites
    // any client-supplied prefix before this code runs.
    const parts = forwarded.split(",").map((p) => p.trim()).filter(Boolean);
    return parts[0] || "unknown";
  }
  return "unknown";
}

const RATE_LIMIT_WINDOW_MS = 60_000;
const RATE_LIMIT_MAX_PER_WINDOW = 30;

function isRateLimited(ip: string, articleId: string): boolean {
  const store = getRateLimitStore();
  const key = `${ip}:${articleId}`;
  const now = Date.now();
  const recent = (store.get(key) || []).filter((ts) => now - ts < RATE_LIMIT_WINDOW_MS);
  recent.push(now);
  store.set(key, recent);
  return recent.length > RATE_LIMIT_MAX_PER_WINDOW;
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
