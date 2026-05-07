/**
 * vite.config.ts
 *
 * E1 fix: added build.rollupOptions.output.manualChunks to prevent
 * the default behaviour of bundling all vendor code into one giant chunk.
 *
 * Before: one `vendor` chunk ~800KB (React + router + recharts + stripe + dnd-kit)
 * After:  split into purpose-built chunks so browsers cache them independently:
 *   - react-vendor:  React + ReactDOM + react-router-dom (rarely change)
 *   - chart-vendor:  recharts + d3 (only needed on Analytics page)
 *   - ui-vendor:     @dnd-kit + framer-motion + react-hot-toast
 *   - stripe-vendor: @stripe/react-stripe-js + @stripe/stripe-js (Billing page)
 *
 * Each lazy-loaded page route gets its own chunk automatically via
 * dynamic import() already in App.tsx — no change needed there.
 */
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import path from 'node:path';

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icons/icon-192.png', 'icons/icon-512.png', 'robots.txt'],
      manifest: {
        name: 'CareerOps',
        short_name: 'CareerOps',
        description: 'AI-powered career intelligence platform',
        display: 'standalone',
        start_url: '/dashboard',
        scope: '/',
        theme_color: '#6366F1',
        background_color: '#F8F9FC',
        icons: [
          { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any maskable' },
          { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any maskable' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
        runtimeCaching: [
          {
            urlPattern: /^\/api\/skills\/.*/i,
            handler: 'StaleWhileRevalidate',
            options: {
              cacheName: 'skills-cache',
              expiration: { maxEntries: 100, maxAgeSeconds: 60 * 60 * 24 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
          {
            urlPattern: /^\/api\/.*/i,
            handler: 'NetworkFirst',
            options: {
              cacheName: 'api-cache',
              networkTimeoutSeconds: 10,
              expiration: { maxEntries: 50, maxAgeSeconds: 60 * 60 * 6 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
          {
            urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'google-fonts-cache',
              expiration: { maxEntries: 10, maxAgeSeconds: 60 * 60 * 24 * 365 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
        ],
        navigateFallback: '/index.html',
        navigateFallbackDenylist: [/^\/api\//],
      },
      devOptions: { enabled: false },
    }),
  ],

  resolve: { alias: { '@': path.resolve(__dirname, 'src') } },
  server: {
    port: 5173,
    host: true,
    proxy: {
      '/api': {
        target: 'http://localhost:4000',
        changeOrigin: true,
      },
    },
  },

  // E1 fix: manual chunk splitting
  build: {
    sourcemap: 'hidden',
    rollupOptions: {
      output: {
        manualChunks(id) {
          // React core — almost never changes; longest cache life
          if (id.includes('node_modules/react/') ||
              id.includes('node_modules/react-dom/') ||
              id.includes('node_modules/react-router-dom/') ||
              id.includes('node_modules/scheduler/')) {
            return 'react-vendor';
          }
          // Charting stack — only needed on Analytics page
          if (id.includes('node_modules/recharts') ||
              id.includes('node_modules/d3') ||
              id.includes('node_modules/victory')) {
            return 'chart-vendor';
          }
          // Stripe — only needed on Billing page
          if (id.includes('node_modules/@stripe')) {
            return 'stripe-vendor';
          }
          // UI animation / interaction libs
          if (id.includes('node_modules/@dnd-kit') ||
              id.includes('node_modules/framer-motion') ||
              id.includes('node_modules/react-hot-toast') ||
              id.includes('node_modules/@radix-ui')) {
            return 'ui-vendor';
          }
        },
      },
    },
    // Warn when any individual chunk exceeds 400KB
    chunkSizeWarningLimit: 400,
  },
});
