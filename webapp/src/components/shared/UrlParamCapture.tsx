import { useEffect } from 'react';
import { useSearchParams, useLocation } from 'react-router-dom';
import { captureReferralCode } from '@/lib/referral';

const FIRST_TOUCH_KEY = 'fitrush_first_touch';

// Runs on every route (mounted next to Navbar, inside BrowserRouter) so that
// ?ref= and UTM params are captured no matter which page a visitor lands on,
// not just the homepage.
const UrlParamCapture: React.FC = () => {
  const [searchParams] = useSearchParams();
  const location = useLocation();

  useEffect(() => {
    const refCode = searchParams.get('ref');
    if (refCode) {
      captureReferralCode(refCode);
    }

    // Whole block is guarded: reading localStorage can itself throw when storage
    // is blocked (sandboxed iframe, some in-app webviews). This effect runs on
    // every route, so an uncaught throw here would white-screen the whole app.
    // Attribution is never worth a crash.
    try {
      // First-touch only: never overwrite an existing value.
      if (localStorage.getItem(FIRST_TOUCH_KEY)) return;

      const utmSource = searchParams.get('utm_source');
      const utmMedium = searchParams.get('utm_medium');
      const utmCampaign = searchParams.get('utm_campaign');
      if (!utmSource && !utmMedium && !utmCampaign) return;

      localStorage.setItem(
        FIRST_TOUCH_KEY,
        JSON.stringify({
          utm_source: utmSource,
          utm_medium: utmMedium,
          utm_campaign: utmCampaign,
          landing_path: location.pathname,
          captured_at: new Date().toISOString(),
        })
      );
    } catch {
      // Storage unavailable or quota exceeded, drop the attribution silently
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  return null;
};

export default UrlParamCapture;
