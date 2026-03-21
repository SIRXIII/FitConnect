/**
 * Push notification utilities for FitRush.
 * Supports web (FCM) and iOS (Capacitor PushNotifications).
 * Gracefully handles missing Firebase config.
 */

import { supabase } from '@/lib/supabase';

function hasFirebaseConfig(): boolean {
  return !!(
    import.meta.env.VITE_FIREBASE_API_KEY &&
    import.meta.env.VITE_FIREBASE_PROJECT_ID &&
    import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID &&
    import.meta.env.VITE_FIREBASE_APP_ID &&
    import.meta.env.VITE_FIREBASE_VAPID_KEY
  );
}

function getFirebaseConfig() {
  return {
    apiKey: import.meta.env.VITE_FIREBASE_API_KEY as string,
    authDomain: `${import.meta.env.VITE_FIREBASE_PROJECT_ID as string}.firebaseapp.com`,
    projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID as string,
    storageBucket: `${import.meta.env.VITE_FIREBASE_PROJECT_ID as string}.appspot.com`,
    messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID as string,
    appId: import.meta.env.VITE_FIREBASE_APP_ID as string,
  };
}

async function sendConfigToServiceWorker(): Promise<void> {
  if (!('serviceWorker' in navigator)) return;
  const reg = await navigator.serviceWorker.ready;
  if (reg.active) {
    reg.active.postMessage({ type: 'FIREBASE_CONFIG', config: getFirebaseConfig() });
  }
}

function isCapacitorNative(): boolean {
  return (
    typeof window !== 'undefined' &&
    'Capacitor' in window &&
    typeof (window as Record<string, unknown>).Capacitor === 'object' &&
    (window as { Capacitor: { isNativePlatform(): boolean } }).Capacitor.isNativePlatform()
  );
}

/**
 * Subscribe the current device to push notifications and persist to DB.
 * Returns true on success, false if permission denied or Firebase not configured.
 */
export async function subscribeToPush(userId: string): Promise<boolean> {
  try {
    if (isCapacitorNative()) {
      const token = await getIOSDeviceToken();
      if (!token) return false;
      await supabase.from('push_subscriptions').upsert(
        { user_id: userId, endpoint: token, platform: 'ios', device_token: token },
        { onConflict: 'user_id,endpoint' }
      );
      return true;
    }

    if (!hasFirebaseConfig()) {
      console.warn('[pushNotifications] Firebase env vars not configured — skipping.');
      return false;
    }

    if (!('Notification' in window)) return false;
    let permission = Notification.permission;
    if (permission === 'denied') return false;
    if (permission === 'default') permission = await Notification.requestPermission();
    if (permission !== 'granted') return false;

    if ('serviceWorker' in navigator) {
      await navigator.serviceWorker.register('/firebase-messaging-sw.js', { scope: '/' });
      await sendConfigToServiceWorker();
    }

    const { initializeApp, getApps } = await import('firebase/app');
    const { getMessaging, getToken } = await import('firebase/messaging');

    const app = getApps().length ? getApps()[0] : initializeApp(getFirebaseConfig());
    const token = await getToken(getMessaging(app), {
      vapidKey: import.meta.env.VITE_FIREBASE_VAPID_KEY as string,
    });
    if (!token) return false;

    await supabase.from('push_subscriptions').upsert(
      { user_id: userId, endpoint: token, platform: 'web', device_token: token },
      { onConflict: 'user_id,endpoint' }
    );
    return true;
  } catch (err) {
    console.error('[pushNotifications] subscribeToPush failed:', err);
    return false;
  }
}

/** Remove all push subscriptions for this user and unregister the FCM token. */
export async function unsubscribeFromPush(userId: string): Promise<void> {
  try {
    if (!isCapacitorNative() && hasFirebaseConfig()) {
      try {
        const { getApps } = await import('firebase/app');
        const { getMessaging, deleteToken } = await import('firebase/messaging');
        if (getApps().length) await deleteToken(getMessaging(getApps()[0]));
      } catch {
        // Best-effort
      }
    }
    await supabase.from('push_subscriptions').delete().eq('user_id', userId);
  } catch (err) {
    console.error('[pushNotifications] unsubscribeFromPush failed:', err);
  }
}

/**
 * Get the APNs-derived FCM device token on iOS (Capacitor native).
 * Returns null on web or if permission denied.
 */
export async function getIOSDeviceToken(): Promise<string | null> {
  try {
    if (!isCapacitorNative()) return null;
    // Dynamic import — package may not exist in web bundle
    const { PushNotifications } = await import('@capacitor/push-notifications');
    const result = await PushNotifications.requestPermissions();
    if (result.receive !== 'granted') return null;

    return new Promise((resolve) => {
      let settled = false;
      const done = (val: string | null) => {
        if (!settled) { settled = true; resolve(val); }
      };
      const t = setTimeout(() => done(null), 10_000);

      void PushNotifications.addListener('registration', (token) => { clearTimeout(t); done(token.value); });
      void PushNotifications.addListener('registrationError', () => { clearTimeout(t); done(null); });
      PushNotifications.register().catch(() => { clearTimeout(t); done(null); });
    });
  } catch (err) {
    console.error('[pushNotifications] getIOSDeviceToken failed:', err);
    return null;
  }
}
