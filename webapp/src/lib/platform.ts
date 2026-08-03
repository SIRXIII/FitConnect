import { Capacitor } from '@capacitor/core';

export const isNativeiOS = (): boolean => {
  return Capacitor.isNativePlatform() && Capacitor.getPlatform() === 'ios';
};
