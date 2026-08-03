// Cloudflare Pages Function: relay Stripe Connect return → custom URL scheme
// Phase 18 (FitRush v1.1) — bridges Stripe's https return_url to fitrush://connect-complete
//
// Stripe KYC return_url and refresh_url point to this Pages Function.
// It reads the ?next= query param (expected: fitrush://connect-complete or fitrush://connect-refresh)
// and performs a browser redirect to the custom URL scheme.
//
// Why HTML meta-refresh instead of pure HTTP 302:
// iOS Safari does NOT reliably follow 302 redirects to custom schemes from Safari navigation.
// The HTML meta-refresh + JS assignment approach is more reliable for iOS Safari.
// Cache-Control: no-store is mandatory (prevents stale cached redirect).
//
// Security: only fitrush:// scheme redirects are allowed.
// Any other scheme returns HTTP 400.

export const onRequest: PagesFunction = async (context) => {
  const url = new URL(context.request.url);
  const next = url.searchParams.get('next');

  // Security gate: only allow fitrush:// scheme to prevent open-redirect abuse
  if (!next || !next.startsWith('fitrush://')) {
    return new Response('Bad request: only fitrush:// scheme redirects are allowed', {
      status: 400,
    });
  }

  // iOS Safari requires HTML meta-refresh + JS redirect for custom-scheme reliability;
  // pure 302 from a fetch context to a non-https scheme is not always followed.
  const html = `<!DOCTYPE html>
<html><head>
  <meta charset="utf-8">
  <meta http-equiv="refresh" content="0; url=${next}">
  <title>Returning to FitRush…</title>
</head><body>
  <p>Returning to FitRush…</p>
  <script>window.location.href=${JSON.stringify(next)};</script>
</body></html>`;

  return new Response(html, {
    status: 200,
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'no-store, no-cache, must-revalidate',
    },
  });
};
