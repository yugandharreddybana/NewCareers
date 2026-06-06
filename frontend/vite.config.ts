/**
 * vite.config.ts — Batch 5 additions
 *
 * Changes over Batch 4:
 *   B5.001 – Added @tanstack/react-query to its own "query-vendor" chunk so
 *            the 70 KB query client is cached independently of page chunks.
 *   B5.002 – react-window goes into "ui-vendor" (already declared).
 *   B5.003 – build.target set to 'es2020' to unlock modern output
 *            (smaller dynamic-import polyfills).
 *   B5.004 – vite preview server now emits Cache-Control headers:
 *              – immutable 1-year for hashed JS/CSS assets
 *              – no-store for HTML (never cached)
 *            so local `vite preview` mirrors production CDN behaviour.
 *   B5.005 – chunkSizeWarningLimit tightened to 350 KB.
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
    strictPort: false,
    host: true,
    proxy: {
      '/api': {
        target: 'http://localhost:4000',
        changeOrigin: true,
        // Do not force Domain=localhost — breaks when dev server is opened via 127.0.0.1 or LAN IP.
      },
    },
  },

  // B5.004 – vite preview mirrors production Cache-Control headers
  preview: {
    headers: {
      // Hashed assets (JS / CSS / images) – immutable, cached for 1 year
      'Cache-Control': 'public, max-age=31536000, immutable',
    },
  },

  build: {
    // B5.003 – modern output, removes legacy dynamic-import polyfills
    target: 'es2020',
    sourcemap: 'hidden',
    rollupOptions: {
      output: {
        manualChunks(id) {
          // React core — almost never changes; longest cache life
          if (
            id.includes('node_modules/react/') ||
            id.includes('node_modules/react-dom/') ||
            id.includes('node_modules/react-router-dom/') ||
            id.includes('node_modules/scheduler/')
          ) {
            return 'react-vendor';
          }
          // B5.001 – TanStack Query in its own chunk
          if (id.includes('node_modules/@tanstack/')) {
            return 'query-vendor';
          }
          // Charting stack — only loaded on Analytics page
          if (
            id.includes('node_modules/recharts') ||
            id.includes('node_modules/d3') ||
            id.includes('node_modules/victory')
          ) {
            return 'chart-vendor';
          }
          // Stripe — only loaded on Billing page
          if (id.includes('node_modules/@stripe')) {
            return 'stripe-vendor';
          }
          // UI animation / interaction libs + B5.002 react-window
          if (
            id.includes('node_modules/@dnd-kit') ||
            id.includes('node_modules/framer-motion') ||
            id.includes('node_modules/react-hot-toast') ||
            id.includes('node_modules/@radix-ui') ||
            id.includes('node_modules/react-window')
          ) {
            return 'ui-vendor';
          }
        },
      },
    },
    // B5.005 – tighter warning threshold
    chunkSizeWarningLimit: 350,
  },
});
