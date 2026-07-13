import { defineConfig } from '@playwright/test';
import { loadEnv } from 'vite';

// Vite does not populate process.env when loadEnv is called directly. Preserve
// explicitly exported values and fill only the FitRush E2E namespace from the
// ignored .env.e2e file.
const localE2EEnv = loadEnv('e2e', process.cwd(), 'FITRUSH_E2E_');
for (const [name, value] of Object.entries(localE2EEnv)) {
  if (process.env[name] === undefined) process.env[name] = value;
}

export default defineConfig({
  testDir: './e2e',
  testMatch: '**/*.{spec,test,setup}.ts',
  timeout: 30000,
  retries: 1,
  use: {
    baseURL: 'http://localhost:3000',
    screenshot: 'only-on-failure',
    trace: 'on-first-retry',
  },
  projects: [
    { name: 'chromium', use: { browserName: 'chromium' } },
  ],
  webServer: {
    command: 'npm run dev -- --port 3000',
    port: 3000,
    reuseExistingServer: true,
    timeout: 15000,
  },
});
