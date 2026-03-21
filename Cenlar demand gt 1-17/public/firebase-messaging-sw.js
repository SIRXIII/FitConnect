/* eslint-disable no-undef */
// Firebase Cloud Messaging Service Worker
// Must be at the root path (/firebase-messaging-sw.js) per FCM spec.
//
// Firebase public config is passed from the main app via postMessage after registration.
// Until the message arrives, the SW queues any background messages.

importScripts('https://www.gstatic.com/firebasejs/10.7.1/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.7.1/firebase-messaging-compat.js');

let messaging = null;

// Receive Firebase config from the main app thread
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'FIREBASE_CONFIG') {
    const config = event.data.config;
    if (config && config.apiKey && !firebase.apps.length) {
      firebase.initializeApp(config);
      messaging = firebase.messaging();

      messaging.onBackgroundMessage((payload) => {
        const title = payload.notification?.title ?? 'FitRush';
        const body = payload.notification?.body ?? '';
        const icon = payload.notification?.icon ?? '/icon-192.png';

        self.registration.showNotification(title, {
          body,
          icon,
          badge: '/icon-192.png',
          data: payload.data ?? {},
          // Vibrate pattern for mobile devices
          vibrate: [200, 100, 200],
        });
      });
    }
  }
});

// Handle notification click — focus or open the app
self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  const urlToOpen = event.notification.data?.url ?? '/';

  event.waitUntil(
    clients
      .matchAll({ type: 'window', includeUncontrolled: true })
      .then((windowClients) => {
        // Focus existing tab if open
        for (const client of windowClients) {
          if (client.url.includes(self.location.origin) && 'focus' in client) {
            return client.focus();
          }
        }
        // Otherwise open a new tab
        if (clients.openWindow) {
          return clients.openWindow(urlToOpen);
        }
      })
  );
});
