/**
 * Minimal type stubs for firebase/app and firebase/messaging.
 * These are used for the dynamic import() calls in pushNotifications.ts.
 * When the firebase package is installed these stubs are superseded by the
 * package's own types (skipLibCheck:true handles any conflicts).
 */
declare module 'firebase/app' {
  export interface FirebaseApp {
    name: string;
  }
  export interface FirebaseOptions {
    apiKey?: string;
    authDomain?: string;
    projectId?: string;
    storageBucket?: string;
    messagingSenderId?: string;
    appId?: string;
  }
  export function initializeApp(options: FirebaseOptions, name?: string): FirebaseApp;
  export function getApps(): FirebaseApp[];
  export function getApp(name?: string): FirebaseApp;
}

declare module 'firebase/messaging' {
  import type { FirebaseApp } from 'firebase/app';

  export interface Messaging {
    app: FirebaseApp;
  }
  export interface GetTokenOptions {
    vapidKey?: string;
    serviceWorkerRegistration?: ServiceWorkerRegistration;
  }
  export function getMessaging(app?: FirebaseApp): Messaging;
  export function getToken(messaging: Messaging, options?: GetTokenOptions): Promise<string>;
  export function deleteToken(messaging: Messaging): Promise<boolean>;
  export function onMessage(
    messaging: Messaging,
    nextOrObserver: (payload: MessagePayload) => void
  ): () => void;
  export interface MessagePayload {
    notification?: { title?: string; body?: string; icon?: string };
    data?: Record<string, string>;
  }
}
