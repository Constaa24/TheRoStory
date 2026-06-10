import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import path from 'path';

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      // autoUpdate: when a new SW ships, the old one is replaced on next load
      // without a user prompt. Acceptable here because the SW only caches
      // static shell + a small Supabase storage allowlist; no offline data.
      registerType: 'autoUpdate',
      // The site already ships /site.webmanifest at the root and links to it
      // from index.html. Don't generate another one.
      manifest: false,
      workbox: {
        // Pre-cache hashed app shell assets only. Images/videos are pulled
        // at runtime — see runtimeCaching below.
        globPatterns: ['**/*.{js,css,html,ico,svg,woff2}'],
        // The auth callback exchanges PKCE codes against Supabase and must
        // hit the network — never serve a cached HTML shell here. Same for
        // anything under /admin/ where a stale shell could mismatch the
        // current role.
        navigateFallbackDenylist: [/^\/auth\/callback/, /^\/admin/],
        // Don't fetch a navigation fallback for cross-origin requests.
        navigateFallback: '/index.html',
        runtimeCaching: [
          {
            // Videos in Supabase storage MUST bypass the SW cache entirely.
            // Workbox's StaleWhileRevalidate fetches the full body and serves
            // 200 OK from cache, but <video> elements issue Range requests
            // and expect 206 Partial Content. Caching breaks playback.
            // NetworkOnly lets the request flow straight through to the
            // network so the browser can negotiate ranges normally.
            urlPattern: ({ url }) =>
              /supabase\.co\/storage\/v1\/object\/public\//.test(url.href) &&
              /\.(mp4|webm|mov|m4v|ogv)(\?|$)/i.test(url.pathname),
            handler: 'NetworkOnly',
          },
          {
            // Public Supabase storage assets (article images, posters, avatars).
            // Stale-while-revalidate gives instant repeat loads without
            // serving forever-stale media. Videos are excluded above.
            // Shorter TTL than before so admin previews of draft media
            // don't linger client-side for a week on shared devices.
            urlPattern: /^https:\/\/.*\.supabase\.co\/storage\/v1\/object\/public\/.*/,
            handler: 'StaleWhileRevalidate',
            options: {
              cacheName: 'supabase-storage',
              // 1 hour: balance between repeat-visit speed and not pinning
              // unpublished draft media in the cache for days.
              expiration: { maxEntries: 200, maxAgeSeconds: 60 * 60 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
          {
            // Google fonts CSS — small and rarely changing.
            urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/,
            handler: 'StaleWhileRevalidate',
            options: {
              cacheName: 'google-fonts-css',
              // Don't cache 5xx responses — match the gstatic rule for consistency.
              cacheableResponse: { statuses: [0, 200] },
            },
          },
          {
            // Google fonts files — long-lived, immutable.
            urlPattern: /^https:\/\/fonts\.gstatic\.com\/.*/,
            handler: 'CacheFirst',
            options: {
              cacheName: 'google-fonts-files',
              expiration: { maxEntries: 30, maxAgeSeconds: 60 * 60 * 24 * 365 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
        ],
      },
      // Disable the SW in dev so we don't fight Vite's HMR.
      devOptions: { enabled: false },
    }),
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  build: {
    // Drop public source maps. The previous 'hidden' setting still wrote .map
    // files to /assets which Vercel deploys publicly — anyone could grab them
    // by guessing /assets/*.map. Set to true and upload to Sentry instead if
    // you need them for monitoring.
    sourcemap: false,
    target: 'es2020',
    rollupOptions: {
      output: {
        manualChunks(id: string) {
          if (!id.includes('node_modules')) return undefined;

          // Heavy or feature-scoped libraries get their own chunks so the
          // landing page doesn't pay for them up-front.
          if (id.includes('d3-') || id.includes('topojson-client')) return 'map';
          if (id.includes('framer-motion')) return 'motion';
          if (id.includes('lucide-react')) return 'icons';
          if (id.includes('@radix-ui')) return 'radix';

          if (id.includes('@supabase')) return 'supabase';
          if (
            id.includes('react-router-dom') ||
            id.includes('react-dom') ||
            // Match the bare 'react' package, but not other packages that
            // happen to start with the letters 'react' (react-dom etc.).
            /[\\/]react[\\/]/.test(id)
          ) {
            return 'react-vendor';
          }

          return undefined;
        },
      },
    },
  },
  server: {
    port: 3000,
    strictPort: true,
    host: true,
    allowedHosts: true,
  }
});
