import { defineConfig } from 'vitest/config';

// Integration ("adversarial DB") harness — talks to a LOCAL `supabase start`
// instance. Kept separate from the fast unit suite (vite.config.ts) so these
// slow, Docker-dependent tests never block `npm test`.
//
// Run:  supabase start   &&   npm run test:db
export default defineConfig({
  test: {
    include: ['supabase/tests/**/*.{test,spec}.ts'],
    environment: 'node',
    globals: true,
    testTimeout: 30000,
    hookTimeout: 30000,
    // Shared local DB: run files serially to avoid cross-file fixture races.
    fileParallelism: false,
  },
});
