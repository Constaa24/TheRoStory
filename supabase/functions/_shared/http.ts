// Shared JSON response builder for all edge functions. Every endpoint
// returns `application/json` bodies with the per-request CORS headers;
// centralizing the boilerplate keeps the five functions consistent.

export const jsonResponse = (
  status: number,
  body: unknown,
  corsHeaders: Record<string, string>,
  extraHeaders?: Record<string, string>,
): Response =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json", ...extraHeaders },
  });
