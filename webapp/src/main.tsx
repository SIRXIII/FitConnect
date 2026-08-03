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

const root = ReactDOM.createRoot(rootElement);
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
