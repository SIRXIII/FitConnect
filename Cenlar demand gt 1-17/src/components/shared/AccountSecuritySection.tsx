import { useId, useState } from 'react';
import { Eye, EyeOff, Mail } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import {
  getPasswordValidationError,
  PASSWORD_MIN_LENGTH,
  PASSWORD_REQUIREMENTS,
  type PasswordValidationField,
} from '@/lib/passwordPolicy';
import { useAuthStore } from '@/stores/auth';

interface AccountSecuritySectionProps {
  className?: string;
}

interface Feedback {
  type: 'success' | 'error';
  message: string;
  field?: PasswordValidationField;
}

interface AuthErrorLike {
  code?: string;
  message?: string;
}

const RECENT_SESSION_ERROR_CODES = new Set([
  'bad_jwt',
  'jwt_expired',
  'refresh_token_not_found',
  'reauthentication_needed',
  'session_not_found',
]);

export function getPasswordUpdateErrorMessage(error: unknown): string {
  const authError = error && typeof error === 'object' ? error as AuthErrorLike : null;
  const code = authError?.code?.toLowerCase() ?? '';
  const message = authError?.message?.trim() ?? (error instanceof Error ? error.message.trim() : '');
  const staleSession = RECENT_SESSION_ERROR_CODES.has(code)
    || /reauth|session (?:has )?(?:expired|missing|not found|invalid)|jwt (?:has )?expired|refresh token/i.test(message);

  if (staleSession) {
    return 'Your session needs to be refreshed. Sign out, sign back in, and try changing your password again.';
  }

  return message
    ? `We could not update your password: ${message}`
    : 'We could not update your password. Please try again.';
}

const AccountSecuritySection: React.FC<AccountSecuritySectionProps> = ({ className = '' }) => {
  const user = useAuthStore((state) => state.user);
  const id = useId();
  const headingId = `${id}-heading`;
  const formId = `${id}-form`;
  const instructionsId = `${id}-instructions`;
  const feedbackId = `${id}-feedback`;
  const newPasswordId = `${id}-new-password`;
  const confirmationId = `${id}-confirm-password`;

  const [expanded, setExpanded] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmation, setShowConfirmation] = useState(false);
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState<Feedback | null>(null);

  const clearForm = () => {
    setNewPassword('');
    setConfirmation('');
    setShowNewPassword(false);
    setShowConfirmation(false);
  };

  const handleToggle = () => {
    if (expanded) {
      clearForm();
      setFeedback(null);
      setExpanded(false);
      return;
    }

    setFeedback(null);
    setExpanded(true);
  };

  const clearValidationFeedback = () => {
    if (feedback?.type === 'error') setFeedback(null);
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const validationError = getPasswordValidationError(newPassword, confirmation);

    if (validationError) {
      setFeedback({ type: 'error', ...validationError });
      return;
    }

    setSaving(true);
    setFeedback(null);

    try {
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) throw error;

      clearForm();
      setExpanded(false);
      setFeedback({ type: 'success', message: 'Password updated successfully.' });
    } catch (error) {
      setFeedback({ type: 'error', message: getPasswordUpdateErrorMessage(error) });
    } finally {
      setSaving(false);
    }
  };

  const feedbackDescription = feedback?.type === 'error' ? ` ${feedbackId}` : '';

  return (
    <section
      aria-labelledby={headingId}
      className={`border border-ink/10 p-8 space-y-6 ${className}`.trim()}
    >
      <div className="space-y-1">
        <h2 id={headingId} className="text-xs uppercase tracking-[0.2em] text-ink/40 font-medium">
          Account Security
        </h2>
        <p className="text-sm text-ink/50 font-light">
          Review your sign-in email and keep your password secure.
        </p>
      </div>

      <div className="space-y-2">
        <p className="text-[10px] uppercase tracking-[0.2em] text-ink/40">Email Address</p>
        <div className="flex items-center gap-3 pb-2 border-b border-ink/10">
          <Mail size={16} className="text-ink/30 shrink-0" aria-hidden="true" />
          <span className="text-base font-light text-ink/70">{user?.email ?? 'Unavailable'}</span>
        </div>
        <p className="text-[10px] text-ink/30">Email changes require contacting support.</p>
      </div>

      <div className="space-y-4">
        <button
          type="button"
          onClick={handleToggle}
          disabled={saving}
          aria-expanded={expanded}
          aria-controls={formId}
          className="min-h-11 border border-ink/20 px-8 py-3 text-[11px] uppercase tracking-[0.2em] font-medium hover:bg-ink hover:text-white transition-all duration-300 disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {expanded ? 'Cancel' : 'Change Password'}
        </button>

        {expanded && (
          <form id={formId} onSubmit={handleSubmit} noValidate className="space-y-5 pt-2" aria-busy={saving}>
            <p id={instructionsId} className="text-xs text-ink/50 font-light leading-relaxed">
              {PASSWORD_REQUIREMENTS}
            </p>

            <div className="space-y-2">
              <label htmlFor={newPasswordId} className="text-[10px] uppercase tracking-[0.2em] text-ink/40">
                New Password
              </label>
              <div className="flex items-center gap-2 border-b border-ink/20 focus-within:border-ink/60 transition-colors">
                <input
                  id={newPasswordId}
                  type={showNewPassword ? 'text' : 'password'}
                  value={newPassword}
                  onChange={(event) => {
                    setNewPassword(event.target.value);
                    clearValidationFeedback();
                  }}
                  required
                  minLength={PASSWORD_MIN_LENGTH}
                  autoComplete="new-password"
                  disabled={saving}
                  aria-invalid={feedback?.field === 'password'}
                  aria-describedby={`${instructionsId}${feedback?.field === 'password' ? feedbackDescription : ''}`}
                  className="min-h-11 flex-1 bg-transparent text-base font-light outline-none placeholder:text-ink/20"
                  placeholder={`At least ${PASSWORD_MIN_LENGTH} characters`}
                />
                <button
                  type="button"
                  onClick={() => setShowNewPassword((visible) => !visible)}
                  disabled={saving}
                  className="min-h-11 min-w-11 inline-flex items-center justify-center text-ink/40 hover:text-ink transition-colors disabled:opacity-40"
                  aria-label={showNewPassword ? 'Hide new password' : 'Show new password'}
                  aria-pressed={showNewPassword}
                >
                  {showNewPassword ? <EyeOff size={17} aria-hidden="true" /> : <Eye size={17} aria-hidden="true" />}
                </button>
              </div>
            </div>

            <div className="space-y-2">
              <label htmlFor={confirmationId} className="text-[10px] uppercase tracking-[0.2em] text-ink/40">
                Confirm New Password
              </label>
              <div className="flex items-center gap-2 border-b border-ink/20 focus-within:border-ink/60 transition-colors">
                <input
                  id={confirmationId}
                  type={showConfirmation ? 'text' : 'password'}
                  value={confirmation}
                  onChange={(event) => {
                    setConfirmation(event.target.value);
                    clearValidationFeedback();
                  }}
                  required
                  minLength={PASSWORD_MIN_LENGTH}
                  autoComplete="new-password"
                  disabled={saving}
                  aria-invalid={feedback?.field === 'confirmation'}
                  aria-describedby={`${instructionsId}${feedback?.field === 'confirmation' ? feedbackDescription : ''}`}
                  className="min-h-11 flex-1 bg-transparent text-base font-light outline-none placeholder:text-ink/20"
                  placeholder="Repeat new password"
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmation((visible) => !visible)}
                  disabled={saving}
                  className="min-h-11 min-w-11 inline-flex items-center justify-center text-ink/40 hover:text-ink transition-colors disabled:opacity-40"
                  aria-label={showConfirmation ? 'Hide password confirmation' : 'Show password confirmation'}
                  aria-pressed={showConfirmation}
                >
                  {showConfirmation ? <EyeOff size={17} aria-hidden="true" /> : <Eye size={17} aria-hidden="true" />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={saving || !newPassword || !confirmation}
              className="min-h-11 border border-ink/20 px-8 py-3 text-[11px] uppercase tracking-[0.2em] font-medium hover:bg-ink hover:text-white transition-all duration-300 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {saving ? (
                <span className="flex items-center gap-2">
                  <span className="w-3 h-3 border border-current border-t-transparent rounded-full animate-spin" aria-hidden="true" />
                  Updating...
                </span>
              ) : 'Update Password'}
            </button>
          </form>
        )}
      </div>

      {feedback && (
        <p
          id={feedbackId}
          role={feedback.type === 'error' ? 'alert' : 'status'}
          aria-live={feedback.type === 'error' ? 'assertive' : 'polite'}
          className={`text-sm font-light ${feedback.type === 'error' ? 'text-red-600' : 'text-green-700'}`}
        >
          {feedback.message}
        </p>
      )}
    </section>
  );
};

export default AccountSecuritySection;
