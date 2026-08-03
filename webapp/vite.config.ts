/// <reference types="vitest" />
import path from 'path';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig(() => {
  return {
    server: {
      port: 3000,
      host: '0.0.0.0',
    },
    plugins: [
      tailwindcss(),
      react(),
    ],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, './src'),
      },
    },
    build: {
      rollupOptions: {
        // firebase and @capacitor/push-notifications are optional dependencies
        // that may not be installed yet (requires npm install after disk space freed).
        // Mark as external so builds pass; they will be bundled once installed.
        external: (id) =>
          id.startsWith('firebase/') || id === '@capacitor/push-notifications',
      },
    },
    test: {
      globals: true,
      environment: 'jsdom',
      include: ['src/**/*.{test,spec}.{ts,tsx}'],
    },
  };
});
