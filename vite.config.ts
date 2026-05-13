import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react-swc';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    host: '0.0.0.0',
    port: 8080,
  },
  build: {
    // Raise the warning limit — gzipped bundle is well under 500 KB
    chunkSizeWarningLimit: 1000,
    rollupOptions: {
      output: {
        // Vendor splitting: isolate large stable deps into cacheable chunks
        manualChunks(id) {
          if (id.includes('node_modules')) {
            // React runtime — tiny, hot, always needed
            if (id.includes('react') || id.includes('react-dom') || id.includes('react-router')) {
              return 'vendor-react';
            }
            // Leaflet map library — large, only used on Maps screen
            if (id.includes('leaflet')) {
              return 'vendor-leaflet';
            }
            // Supabase client — moderately sized, used across many screens
            if (id.includes('@supabase')) {
              return 'vendor-supabase';
            }
            // Everything else in node_modules
            return 'vendor';
          }
          // Safety engine — pure logic, no UI deps, can be its own chunk
          if (id.includes('lib/travelSafetyEngine') || id.includes('lib/safetyEngine')) {
            return 'safety-engine';
          }
          // Secondary screens — loaded on navigation, not on initial paint
          if (
            id.includes('screens/MapsScreen') ||
            id.includes('screens/WalletScreen') ||
            id.includes('screens/PerksScreen') ||
            id.includes('screens/ATMScreen') ||
            id.includes('screens/FuelScreen') ||
            id.includes('screens/BusinessScreen') ||
            id.includes('screens/GroupsScreen')
          ) {
            return 'screens-secondary';
          }
        },
      },
    },
  },
});
