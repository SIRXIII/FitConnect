/**
 * Minimal type stubs for @capacitor/push-notifications.
 * Used for the dynamic import() in pushNotifications.ts.
 * When the package is installed these stubs are superseded by the package's types.
 */
declare module '@capacitor/push-notifications' {
  export interface PermissionStatus {
    receive: 'prompt' | 'prompt-with-rationale' | 'granted' | 'denied';
  }
  export interface Token {
    value: string;
  }
  export interface RegistrationError {
    error: string;
  }
  export type PushNotificationSchema = Record<string, unknown>;

  export type PluginListenerHandle = {
    remove(): Promise<void>;
  };

  export interface PushNotificationsPlugin {
    register(): Promise<void>;
    unregister(): Promise<void>;
    requestPermissions(): Promise<PermissionStatus>;
    checkPermissions(): Promise<PermissionStatus>;
    addListener(
      eventName: 'registration',
      listenerFunc: (token: Token) => void
    ): Promise<PluginListenerHandle>;
    addListener(
      eventName: 'registrationError',
      listenerFunc: (error: RegistrationError) => void
    ): Promise<PluginListenerHandle>;
    addListener(
      eventName: 'pushNotificationReceived',
      listenerFunc: (notification: PushNotificationSchema) => void
    ): Promise<PluginListenerHandle>;
    addListener(
      eventName: 'pushNotificationActionPerformed',
      listenerFunc: (notification: PushNotificationSchema) => void
    ): Promise<PluginListenerHandle>;
    removeAllListeners(): Promise<void>;
  }

  export declare const PushNotifications: PushNotificationsPlugin;
}
