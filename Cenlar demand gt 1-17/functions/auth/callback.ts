// Cloudflare Pages Function: Supabase email confirmation relay → Universal Link
// Phase 22 (FitRush REQ-215) — PKCE auth callback
//
// Supabase email confirmation links redirect to this URL with:
//   ?code=<pkce_authorization_code>&type=signup (or type=recovery)
//
// When FitRush is installed: iOS intercepts this URL as a Universal Link
// and the app receives the `code` param via app_links for PKCE exchange.
//
// When FitRush is NOT installed: this function serves a fallback HTML page
// with a download link or a "check your email" message.

export const onRequest: PagesFunction = async (context) => {
  const url = new URL(context.request.url);
  const code = url.searchParams.get('code');
  const type = url.searchParams.get('type') ?? 'signup';

  if (!code) {
    return new Response(
      '<!DOCTYPE html><html><body><p>Invalid confirmation link.</p></body></html>',
      { status: 400, headers: { 'Content-Type': 'text/html; charset=utf-8' } },
    );
  }

  const schemeUrl = `fitrush://auth-callback?code=${encodeURIComponent(code)}&type=${encodeURIComponent(type)}`;

  const html = `<!DOCTYPE html>
<html lang="en"><head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>FitRush — Confirming your email…</title>
  <style>
    body { font-family: -apple-system, sans-serif; text-align: center; padding: 40px 20px; }
    h1 { font-size: 1.5rem; }
    p { color: #555; }
    a.btn { display: inline-block; margin-top: 20px; padding: 12px 24px;
            background: #FF5A1F; color: #fff; border-radius: 8px; text-decoration: none; }
  </style>
</head><body>
  <h1>Confirming your email…</h1>
  <p>If FitRush didn't open automatically, tap the button below.</p>
  <a class="btn" href="${schemeUrl}">Open FitRush</a>
  <p style="margin-top:32px;font-size:0.85rem;">
    Don't have FitRush yet?
    <a href="https://apps.apple.com/app/id6766015234">Download on the App Store</a>
  </p>
  <script>
    setTimeout(() => { window.location.href = ${JSON.stringify(schemeUrl)}; }, 500);
  </script>
</body></html>`;

  return new Response(html, {
    status: 200,
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'no-store, no-cache, must-revalidate',
    },
  });
};
