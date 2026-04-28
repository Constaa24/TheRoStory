import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const PROD_ORIGINS = [
  "https://therostory.com",
  "https://www.therostory.com",
];

const DEV_ORIGINS = [
  "http://localhost:3000",
  "http://localhost:5173",
];

const IS_LOCAL =
  Deno.env.get("SUPABASE_URL")?.includes("localhost") ||
  Deno.env.get("SUPABASE_URL")?.includes("127.0.0.1");
const ALLOWED_ORIGINS = IS_LOCAL ? [...PROD_ORIGINS, ...DEV_ORIGINS] : PROD_ORIGINS;

function isAllowedOrigin(origin: string): boolean {
  // Production-only CORS — see admin-api for rationale.
  return ALLOWED_ORIGINS.includes(origin);
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
  // Prefer cf-connecting-ip — Cloudflare sets this and clients can't forge it.
  const cfIp = req.headers.get("cf-connecting-ip");
  if (cfIp) return cfIp;
  const forwarded = req.headers.get("x-forwarded-for");
  if (forwarded) {
    // Take the LAST entry — closest to our server, less likely to be spoofed
    // by a malicious client prepending values.
    const parts = forwarded.split(",").map((p) => p.trim()).filter(Boolean);
    return parts[parts.length - 1] || "unknown";
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
