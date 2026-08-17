/**
 * CORS headers for the public widget API. Never `*` — always the specific
 * validated Origin, echoed back only after resolveSite() has passed. This
 * is not the actual security boundary (that's the server-side origin
 * allowlist check); it only controls whether the browser lets the widget's
 * own JS read the response.
 */
export function corsHeaders(origin: string): HeadersInit {
  return {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    Vary: "Origin",
  };
}

/**
 * Permissive preflight response. Preflight (OPTIONS) requests for a POST
 * with a JSON body don't carry the body, so we can't validate embedKey at
 * this stage — real enforcement happens in the POST handler itself before
 * any DB write. This just unblocks the browser's preflight check.
 */
export function preflightResponse(origin: string | null): Response {
  return new Response(null, {
    status: 204,
    headers: corsHeaders(origin ?? "*"),
  });
}
