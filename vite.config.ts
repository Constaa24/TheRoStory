import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
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
          if (id.includes('react-helmet-async')) return 'helmet';
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
