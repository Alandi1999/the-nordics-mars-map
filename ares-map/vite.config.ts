/// <reference types="vitest/config" />
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

const tileCache = (name: string, pattern: RegExp) => ({
  urlPattern: pattern,
  handler: 'CacheFirst' as const,
  options: {
    cacheName: name,
    expiration: { maxEntries: 1500, maxAgeSeconds: 60 * 60 * 24 * 60 },
    cacheableResponse: { statuses: [0, 200] },
  },
});

// https://vite.dev/config/
export default defineConfig({
  // The terrain/shielding tests simulate a 512x512 grid per site and can take several seconds.
  test: { testTimeout: 30_000 },
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icon.svg'],
      manifest: {
        name: 'ARES MAP · conceptual prototype',
        short_name: 'ARES MAP',
        description: 'Mars exploration map for a surface walk (conceptual prototype, NASA Space Apps).',
        lang: 'en',
        display: 'standalone',
        background_color: '#0b0d10',
        theme_color: '#0b0d10',
        icons: [{ src: 'icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' }],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,json}'],
        // Map imagery is cached at runtime; "Preparar modo offline" fills the same cache ahead of time.
        runtimeCaching: [
          tileCache('ares-tiles', /^https:\/\/trek\.nasa\.gov\/tiles\//),
          tileCache('ares-tiles', /^https:\/\/planetarymaps\.usgs\.gov\/cgi-bin\/mapserv/),
        ],
      },
    }),
  ],
});
