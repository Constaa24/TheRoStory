import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'path';

/**
 * Kept separate from vite.config.ts on purpose.
 *
 * The build config carries the PWA plugin, which generates a service worker
 * and a precache manifest — none of which a unit test needs, and all of which
 * would run on every watch-mode re-run. This file mirrors only the two things
 * the source actually depends on to compile: the React plugin and the `@`
 * alias.
 */
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: { '@': path.resolve(__dirname, './src') },
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test/setup.ts'],
    include: ['src/**/*.test.{ts,tsx}'],
    // Dummy credentials, deliberately not the real ones.
    //
    // src/lib/supabase.ts calls createClient() at module scope, so merely
    // importing anything from it needs these to be set. Hard-coding fakes
    // here does two things: the suite runs identically on a machine with no
    // .env file, and no test can ever reach the production project by
    // accident — the URL points at nothing.
    env: {
      VITE_SUPABASE_URL: 'http://127.0.0.1:54321',
      VITE_SUPABASE_ANON_KEY: 'test-anon-key-not-a-real-credential',
    },
  },
});
