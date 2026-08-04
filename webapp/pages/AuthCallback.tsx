import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '@/stores/auth';
import { toast } from 'sonner';

const AuthCallback: React.FC = () => {
  const { user, profile, loading, initialized, initialize } = useAuthStore();
  const navigate = useNavigate();

  useEffect(() => {
    if (!initialized) {
      initialize();
    }
  }, [initialized, initialize]);

  // Check for errors or password recovery type in URL hash/query params
  useEffect(() => {
    const hash = window.location.hash;
    const params = new URLSearchParams(window.location.search);

    // Supabase returns errors in hash fragment: #error=...&error_description=...
    const hashParams = new URLSearchParams(hash.replace('#', ''));
    const error = hashParams.get('error') || params.get('error');
    const errorDescription = hashParams.get('error_description') || params.get('error_description');
    const type = hashParams.get('type') || params.get('type');

    if (error) {
      const message = errorDescription
        ? decodeURIComponent(errorDescription.replace(/\+/g, ' '))
        : 'Authentication failed. Please try again.';
      toast.error(message);
      navigate('/login', { replace: true });
      return;
    }

    // Password recovery flow: redirect to the reset password page
    if (type === 'recovery') {
      navigate('/auth/reset-password', { replace: true });
    }
  }, [navigate]);

  useEffect(() => {
    if (loading || !initialized) return;

    if (!user) {
      navigate('/login', { replace: true });
      return;
    }

    // Give Supabase a moment to create the profile via trigger
    const timer = setTimeout(() => {
      if (!profile?.role) {
        navigate('/onboarding/role', { replace: true });
      } else if (!profile.onboarding_complete) {
        // Role set but onboarding not finished -- resume it
        navigate(
          profile.role === 'trainer' ? '/onboarding/trainer' : '/onboarding/client',
          { replace: true },
        );
      } else if (profile.role === 'trainer') {
        navigate('/trainer/dashboard', { replace: true });
      } else {
        navigate('/trainers', { replace: true });
      }
    }, 500);

    return () => clearTimeout(timer);
  }, [user, profile, loading, initialized, navigate]);

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-paper gap-6">
      <div className="w-6 h-6 border border-accent border-t-transparent rounded-full animate-spin" />
      <p className="text-xs uppercase tracking-[0.3em] text-ink/40">
        Authenticating
      </p>
    </div>
  );
};

export default AuthCallback;
