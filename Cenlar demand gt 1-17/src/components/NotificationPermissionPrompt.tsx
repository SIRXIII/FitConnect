import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Bell, X } from 'lucide-react';
import { subscribeToPush, getIOSDeviceToken } from '@/lib/pushNotifications';

interface Props {
  userId: string;
}

const PROMPT_SHOWN_KEY = 'push_prompt_shown';

/**
 * Custom push notification permission modal.
 *
 * Shows once per browser when Notification.permission === 'default' (or on native iOS).
 * Tracks shown state in localStorage so it never repeats.
 *
 * Mount unconditionally in TrainerDashboard and ClientDashboard — the component
 * manages its own visibility.
 */
const NotificationPermissionPrompt: React.FC<Props> = ({ userId }) => {
  const [visible, setVisible] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    // Don't show if already shown before
    if (localStorage.getItem(PROMPT_SHOWN_KEY)) return;

    // Check if native iOS via Capacitor
    const isNative =
      typeof window !== 'undefined' &&
      'Capacitor' in window &&
      (window as { Capacitor: { isNativePlatform(): boolean } }).Capacitor.isNativePlatform();

    if (isNative) {
      // On iOS, always offer the prompt if not already shown
      setVisible(true);
      return;
    }

    // Web: only show if Notifications API is available and permission not yet decided
    if (!('Notification' in window)) return;
    if (Notification.permission !== 'default') return;

    setVisible(true);
  }, []);

  const handleEnable = async () => {
    setLoading(true);
    try {
      const isNative =
        typeof window !== 'undefined' &&
        'Capacitor' in window &&
        (window as { Capacitor: { isNativePlatform(): boolean } }).Capacitor.isNativePlatform();

      if (isNative) {
        await getIOSDeviceToken();
      } else {
        await subscribeToPush(userId);
      }
    } finally {
      setLoading(false);
      dismiss();
    }
  };

  const dismiss = () => {
    localStorage.setItem(PROMPT_SHOWN_KEY, '1');
    setVisible(false);
  };

  return (
    <AnimatePresence>
      {visible && (
        <>
          {/* Backdrop */}
          <motion.div
            key="backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-50 bg-ink/40"
            onClick={dismiss}
          />

          {/* Modal */}
          <motion.div
            key="modal"
            initial={{ opacity: 0, y: 16, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.98 }}
            transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
            className="fixed inset-x-4 bottom-8 z-50 mx-auto max-w-md bg-white border border-ink/10 p-8 shadow-xl sm:inset-x-auto sm:left-1/2 sm:-translate-x-1/2 sm:bottom-12"
          >
            {/* Close */}
            <button
              type="button"
              onClick={dismiss}
              className="absolute top-4 right-4 text-ink/30 hover:text-ink/60 transition-colors"
              aria-label="Dismiss"
            >
              <X size={16} />
            </button>

            {/* Icon */}
            <div className="flex items-center justify-center w-12 h-12 border border-accent/30 text-accent mb-6">
              <Bell size={20} />
            </div>

            {/* Heading */}
            <h2 className="font-serif text-xl font-light italic text-ink mb-2">
              Stay in the loop
            </h2>

            {/* Body */}
            <p className="text-sm text-ink/50 font-light leading-relaxed mb-8">
              Get instant alerts when a client books a session, when bookings are confirmed, and when
              your schedule changes — right to your device.
            </p>

            {/* Actions */}
            <div className="flex flex-col sm:flex-row gap-3">
              <button
                type="button"
                onClick={handleEnable}
                disabled={loading}
                className="flex-1 bg-accent text-white px-6 py-3 text-[10px] uppercase tracking-[0.2em] font-semibold hover:bg-accent/90 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {loading ? 'Enabling…' : 'Enable Notifications'}
              </button>
              <button
                type="button"
                onClick={dismiss}
                className="flex-1 border border-ink/15 px-6 py-3 text-[10px] uppercase tracking-[0.2em] font-medium text-ink/60 hover:border-ink/30 hover:text-ink transition-colors"
              >
                Not now
              </button>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};

export default NotificationPermissionPrompt;
