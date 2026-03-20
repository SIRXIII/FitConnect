import { useEffect } from 'react';

/**
 * OAuth popup callback page for Google Calendar authorization.
 *
 * Flow:
 * 1. Google redirects to /auth/google-callback?code=...&state=...
 * 2. This page reads code + state from the URL
 * 3. Posts them to the opener window via postMessage
 * 4. Closes itself
 *
 * This page runs in a popup — it has no auth context and must not
 * be wrapped in ProtectedRoute.
 */
const GoogleCalendarCallback: React.FC = () => {
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const code = params.get('code');
    const state = params.get('state');

    if (code && window.opener) {
      window.opener.postMessage({ code, state }, window.location.origin);
      window.close();
    }
    // If no code or no opener, we just show the fallback message below
  }, []);

  return (
    <div className="flex min-h-screen items-center justify-center bg-paper">
      <p className="text-sm text-gray-500">Closing... you may close this window.</p>
    </div>
  );
};

export default GoogleCalendarCallback;
