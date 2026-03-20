import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuthStore } from '@/stores/auth';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';

// OAuth providers enabled in Supabase Dashboard.
// Empty = email-only mode (Google/Facebook/Apple not yet configured).
const ENABLED_PROVIDERS: string[] = [];

const Login: React.FC = () => {
  const { user, profile, loading, signInWithProvider, signInWithEmail, signUpWithEmail } = useAuthStore();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const [isSignUp, setIsSignUp] = useState(() => searchParams.get('mode') === 'signup');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [resetEmail, setResetEmail] = useState('');
  const [resetSubmitting, setResetSubmitting] = useState(false);

  // Read redirect param for post-auth navigation
  const redirectTo = searchParams.get('redirect');

  // Helper: navigate after successful auth
  const navigateAfterAuth = (freshProfile: typeof profile) => {
    if (redirectTo) {
      navigate(redirectTo, { replace: true });
    } else if (freshProfile?.role === 'trainer') {
      navigate('/trainer/dashboard', { replace: true });
    } else if (freshProfile?.role) {
      navigate('/trainers', { replace: true });
    } else {
      navigate('/onboarding/role', { replace: true });
    }
  };

  // Redirect already-authenticated users (e.g. revisiting /login while logged in)
  // Only redirect when initialized + not submitting (avoid race with signInWithEmail)
  useEffect(() => {
    if (!loading && user && !submitting) {
      navigateAfterAuth(profile);
    }
  }, [user, profile, loading, submitting, navigate]);

  // Sync isSignUp with URL param changes
  useEffect(() => {
    if (searchParams.get('mode') === 'signup') {
      setIsSignUp(true);
    }
  }, [searchParams]);

  const handleEmailSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) return;
    setSubmitting(true);
    try {
      if (isSignUp) {
        await signUpWithEmail(email, password);
        toast.success('Account created -- check your email to confirm, or log in directly.');
      } else {
        await signInWithEmail(email, password);
        // signInWithEmail awaits fetchProfile, so profile is ready now
        const { profile: freshProfile } = useAuthStore.getState();
        navigateAfterAuth(freshProfile);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Authentication failed';
      toast.error(msg);
    } finally {
      setSubmitting(false);
    }
  };

  const handleOAuthSignIn = async (provider: 'google' | 'facebook' | 'apple') => {
    try {
      await signInWithProvider(provider);
    } catch {
      toast.error(`Sign in with ${provider} is currently unavailable. Please use email.`);
    }
  };

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resetEmail) return;
    setResetSubmitting(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(resetEmail, {
        redirectTo: window.location.origin + '/login',
      });
      if (error) throw error;
      toast.success('Check your email for a password reset link');
      setShowForgotPassword(false);
      setResetEmail('');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to send reset link';
      toast.error(msg);
    } finally {
      setResetSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-paper">
        <div className="w-5 h-5 border border-accent border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-paper px-6">
      <div className="w-full max-w-sm sm:max-w-md space-y-8 sm:space-y-12 text-center">

        {/* Brand */}
        <div className="space-y-4">
          <h1 className="text-3xl sm:text-4xl serif font-light tracking-[0.1em] sm:tracking-[0.15em] uppercase">
            {isSignUp ? 'Create Your Account' : 'Welcome Back'}
          </h1>
          {isSignUp ? (
            <p className="text-xs text-ink/40 leading-relaxed">
              Join as a client to find trainers, or as a trainer to fill your idle hours
            </p>
          ) : (
            <p className="text-xs tracking-wide text-ink/40">
              Sign in to book discounted sessions with certified trainers
            </p>
          )}
        </div>

        {/* Forgot password modal */}
        {showForgotPassword ? (
          <form onSubmit={handleForgotPassword} className="space-y-4 text-left">
            <p className="text-sm text-ink/60 text-center">
              Enter your email and we'll send you a reset link.
            </p>
            <div className="space-y-1">
              <label className="text-[10px] uppercase tracking-[0.2em] text-ink/40">Email</label>
              <input
                type="email"
                value={resetEmail}
                onChange={(e) => setResetEmail(e.target.value)}
                required
                autoComplete="email"
                className="w-full border border-ink/15 bg-transparent px-4 py-3 text-sm outline-none focus:border-ink/40 transition-colors"
                placeholder="you@example.com"
              />
            </div>
            <button
              type="submit"
              disabled={resetSubmitting}
              className="w-full bg-ink text-white px-8 py-4 text-[11px] uppercase tracking-[0.2em] font-medium hover:bg-accent transition-all duration-300 disabled:opacity-50"
            >
              {resetSubmitting ? 'Sending...' : 'Send Reset Link'}
            </button>
            <button
              type="button"
              onClick={() => setShowForgotPassword(false)}
              className="w-full text-[10px] uppercase tracking-[0.15em] text-ink/40 hover:text-ink transition-colors pt-2"
            >
              Back to sign in
            </button>
          </form>
        ) : (
          <>
            {/* OAuth buttons -- only shown when providers are enabled in Supabase */}
            {/* Uncomment when providers are enabled in Supabase Dashboard:
                Add provider names to ENABLED_PROVIDERS array at top of file */}
            {ENABLED_PROVIDERS.length > 0 && (
              <div className="space-y-4">
                {ENABLED_PROVIDERS.includes('google') && (
                  <button
                    onClick={() => handleOAuthSignIn('google')}
                    className="w-full flex items-center justify-center gap-4 border border-ink/15 px-8 py-4 text-[11px] uppercase tracking-[0.2em] font-medium hover:bg-ink hover:text-white transition-all duration-300"
                  >
                    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" />
                      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                    </svg>
                    Continue with Google
                  </button>
                )}

                {ENABLED_PROVIDERS.includes('facebook') && (
                  <button
                    onClick={() => handleOAuthSignIn('facebook')}
                    className="w-full flex items-center justify-center gap-4 border border-ink/15 px-8 py-4 text-[11px] uppercase tracking-[0.2em] font-medium hover:bg-ink hover:text-white transition-all duration-300"
                  >
                    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
                    </svg>
                    Continue with Facebook
                  </button>
                )}

                {ENABLED_PROVIDERS.includes('apple') && (
                  <button
                    onClick={() => handleOAuthSignIn('apple')}
                    className="w-full flex items-center justify-center gap-4 border border-ink/15 px-8 py-4 text-[11px] uppercase tracking-[0.2em] font-medium hover:bg-ink hover:text-white transition-all duration-300"
                  >
                    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M17.05 20.28c-.98.95-2.05.88-3.08.4-1.09-.5-2.08-.48-3.24 0-1.44.62-2.2.44-3.06-.4C2.79 15.25 3.51 7.59 9.05 7.31c1.35.07 2.29.74 3.08.8 1.18-.24 2.31-.93 3.57-.84 1.51.12 2.65.72 3.4 1.8-3.12 1.87-2.38 5.98.48 7.13-.57 1.5-1.31 2.99-2.54 4.09zM12.03 7.25c-.15-2.23 1.66-4.07 3.74-4.25.29 2.58-2.34 4.5-3.74 4.25z" />
                    </svg>
                    Continue with Apple
                  </button>
                )}

                {/* Divider */}
                <div className="flex items-center gap-4 py-2">
                  <div className="flex-1 h-px bg-ink/10" />
                  <span className="text-[10px] uppercase tracking-[0.2em] text-ink/30">or</span>
                  <div className="flex-1 h-px bg-ink/10" />
                </div>
              </div>
            )}

            {/* Email / Password form */}
            <form onSubmit={handleEmailSubmit} className="space-y-4 text-left">
              <div className="space-y-1">
                <label className="text-[10px] uppercase tracking-[0.2em] text-ink/40">Email</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  autoComplete="email"
                  className="w-full border border-ink/15 bg-transparent px-4 py-3 text-sm outline-none focus:border-ink/40 transition-colors"
                  placeholder="you@example.com"
                />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] uppercase tracking-[0.2em] text-ink/40">Password</label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  autoComplete={isSignUp ? 'new-password' : 'current-password'}
                  minLength={6}
                  className="w-full border border-ink/15 bg-transparent px-4 py-3 text-sm outline-none focus:border-ink/40 transition-colors"
                  placeholder="••••••••"
                />
              </div>

              {/* Forgot password link (sign-in mode only) */}
              {!isSignUp && (
                <div className="text-right">
                  <button
                    type="button"
                    onClick={() => {
                      setResetEmail(email);
                      setShowForgotPassword(true);
                    }}
                    className="text-[10px] uppercase tracking-[0.15em] text-ink/40 hover:text-ink transition-colors"
                  >
                    Forgot password?
                  </button>
                </div>
              )}

              <button
                type="submit"
                disabled={submitting}
                className="w-full bg-ink text-white px-8 py-4 text-[11px] uppercase tracking-[0.2em] font-medium hover:bg-accent transition-all duration-300 disabled:opacity-50"
              >
                {submitting ? (
                  <span className="flex items-center justify-center gap-2">
                    <span className="w-3 h-3 border border-white border-t-transparent rounded-full animate-spin" />
                    {isSignUp ? 'Creating account...' : 'Signing in...'}
                  </span>
                ) : (
                  isSignUp ? 'Create Account' : 'Sign In'
                )}
              </button>

              <div className="text-center pt-2">
                <button
                  type="button"
                  onClick={() => setIsSignUp(!isSignUp)}
                  className="text-[10px] uppercase tracking-[0.15em] text-ink/40 hover:text-ink transition-colors"
                >
                  {isSignUp ? 'Already have an account? Sign in' : "Don't have an account? Sign up"}
                </button>
              </div>
            </form>
          </>
        )}

        <p className="text-[10px] text-ink/30 leading-relaxed">
          By continuing, you agree to FitRush's Terms of Service and Privacy Policy.
        </p>
      </div>
    </div>
  );
};

export default Login;
