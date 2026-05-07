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
            // Public Supabase storage assets (article media, posters, avatars).
            // Stale-while-revalidate gives instant repeat loads without
            // serving forever-stale media.
            urlPattern: /^https:\/\/.*\.supabase\.co\/storage\/v1\/object\/public\/.*/,
            handler: 'StaleWhileRevalidate',
            options: {
              cacheName: 'supabase-storage',
              expiration: { maxEntries: 200, maxAgeSeconds: 60 * 60 * 24 * 7 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
          {
            // Google fonts CSS — small and rarely changing.
            urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/,
            handler: 'StaleWhileRevalidate',
            options: { cacheName: 'google-fonts-css' },
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
          if (id.includes('recharts') || id.includes('d3-')) return 'charts';
          if (id.includes('topojson-client')) return 'map';
          if (id.includes('embla-carousel')) return 'carousel';
          if (id.includes('framer-motion')) return 'motion';
          if (id.includes('@dnd-kit')) return 'dnd';
          if (id.includes('react-resizable-panels')) return 'panels';
          if (id.includes('react-day-picker') || id.includes('date-fns')) return 'datepicker';
          if (id.includes('cmdk')) return 'cmdk';
          if (id.includes('vaul')) return 'vaul';
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
