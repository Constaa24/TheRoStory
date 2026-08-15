// Shared origin allowlist + CORS helpers for all edge functions.
//
// Production-only origins. DEV origins are added when SUPABASE_URL points
// at localhost so `supabase functions serve` works without manual config.
// Vercel preview deploys are intentionally excluded — anyone could deploy
// a project under a similar name. Use a staging Supabase project for
// preview deploys instead.

// Apex only. www.therostory.com used to be listed here, but it now 308s to
// the apex in vercel.json before any request reaches an edge function, so a
// browser never sends it as an Origin.
const PROD_ORIGINS = [
  "https://therostory.com",
];

const DEV_ORIGINS = [
  "http://localhost:3000",
  "http://localhost:5173",
];

const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
const IS_LOCAL = supabaseUrl.includes("localhost") || supabaseUrl.includes("127.0.0.1");

export const ALLOWED_ORIGINS = IS_LOCAL ? [...PROD_ORIGINS, ...DEV_ORIGINS] : PROD_ORIGINS;

export function isAllowedOrigin(origin: string): boolean {
  return ALLOWED_ORIGINS.includes(origin);
}

export function getCorsHeaders(req: Request): Record<string, string> {
  const origin = req.headers.get("Origin") || "";
  const allowedOrigin = isAllowedOrigin(origin) ? origin : ALLOWED_ORIGINS[0];
  return {
    "Access-Control-Allow-Origin": allowedOrigin,
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    // The allowed origin is computed per request, so any cache between us
    // and the client must key on the Origin header.
    "Vary": "Origin",
  };
}
