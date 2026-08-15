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
        // ...but not the whole application. The pattern above matches every
        // emitted chunk, so a first visit quietly downloaded all 41 of them
        // (~1.3 MB) in the background — including the editorial back office
        // and all three story editors, which only an admin or writer can
        // open, and the map bundle for readers who never leave the homepage.
        // That undoes the route-level code splitting in App.tsx: the chunks
        // were correctly kept out of the initial parse, then shipped anyway.
        //
        // These routes are excluded from the precache and served by the
        // runtime rule below instead: still cached once visited, no longer
        // paid for by everyone. Roughly 220 KB of admin-only code and 170 KB
        // of map leave the first-visit path.
        //
        // Names are the manualChunks / lazy-import chunk names from the
        // rollupOptions block below — keep the two in sync.
        globIgnores: [
          '**/AdminDashboard-*.js',
          '**/TextStoryCreate-*.js',
          '**/VideoStoryCreate-*.js',
          '**/CarouselStoryCreate-*.js',
          '**/Map-*.js',
          '**/map-*.js',
          '**/motion-*.js',
        ],
        // The auth callback exchanges PKCE codes against Supabase and must
        // hit the network — never serve a cached HTML shell here. Same for
        // anything under /admin/ where a stale shell could mismatch the
        // current role. /sitemap.xml is served by api/sitemap.ts: crawlers
        // never run a service worker so they always got the real XML, but
        // without this a human opening the URL in an SW-controlled tab is
        // handed the SPA shell instead.
        navigateFallbackDenylist: [/^\/auth\/callback/, /^\/admin/, /^\/sitemap\.xml$/],
        // Don't fetch a navigation fallback for cross-origin requests.
        navigateFallback: '/index.html',
        runtimeCaching: [
          {
            // The route chunks held back from the precache by globIgnores.
            // They still get cached — just on first use rather than for
            // everyone up front. CacheFirst is safe because the filenames are
            // content-hashed: a new build produces a new URL, so a cached
            // entry can never be stale, only orphaned (and the expiration
            // below reaps those).
            urlPattern: ({ url, sameOrigin }) =>
              !!sameOrigin && /^\/assets\/.*\.js$/.test(url.pathname),
            handler: 'CacheFirst',
            options: {
              cacheName: 'route-chunks',
              expiration: { maxEntries: 40, maxAgeSeconds: 60 * 60 * 24 * 30 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
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
    // Bind all interfaces so LAN devices can reach the dev server by IP.
    // Vite's default allowedHosts (localhost + literal IPs) stays active,
    // which keeps the DNS-rebinding host check: a hostile site can't reach
    // the dev server through an attacker-controlled hostname.
    host: true,
  }
});
