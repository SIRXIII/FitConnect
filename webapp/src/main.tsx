import React from 'react';
import ReactDOM from 'react-dom/client';
import { Capacitor } from '@capacitor/core';
import { StatusBar, Style } from '@capacitor/status-bar';
import { Keyboard } from '@capacitor/keyboard';
import App from './App';
import './index.css';

// Initialize native plugins when running on iOS/Android
if (Capacitor.isNativePlatform()) {
  StatusBar.setStyle({ style: Style.Light }).catch(() => {});
  StatusBar.setBackgroundColor({ color: '#FDFBF7' }).catch(() => {});

  // Smooth keyboard handling
  Keyboard.setAccessoryBarVisible({ isVisible: true }).catch(() => {});
  Keyboard.setScroll({ isDisabled: false }).catch(() => {});
}

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error('Could not find root element to mount to');
}

// Stamps the served build onto <html data-build>. Production here has twice
// been verified wrong by trusting a green build, so make "what is actually
// live" readable straight from the page.
document.documentElement.dataset.build = import.meta.env.VITE_BUILD_ID ?? 'dev';

const root = ReactDOM.createRoot(rootElement);
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
