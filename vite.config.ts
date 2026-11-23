import { fileURLToPath, URL } from 'node:url';
import { loadEnv } from 'vite';
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { VitePWA } from 'vite-plugin-pwa';
import { contentPlugin } from './scripts/content/vite-plugin-content.ts';
import { precacheScope } from './scripts/pwa/precache-scope.ts';
import { notesApiDev } from './scripts/notes/vite-plugin-api.ts';

const scope = precacheScope();

export default defineConfig(({ mode }) => {
  // Expose .env.local (DATABASE_URL, NOTES_*) to the dev API middleware, as Vercel does in production.
  Object.assign(process.env, { ...loadEnv(mode, process.cwd(), ''), ...process.env });
  return {
  plugins: [
    notesApiDev(),
    react(),
    tailwindcss(),
    contentPlugin(),
    scope.plugin,
    VitePWA({
      // The app shows its own "update available" prompt (src/app/PwaStatus.tsx) and registers the worker itself.
      registerType: 'prompt',
      injectRegister: false,
      // Icons and public files are already matched by workbox.globPatterns below.
      includeManifestIcons: false,
      manifest: {
        id: '/',
        name: 'LevelUp Engineer',
        short_name: 'LevelUp',
        description: 'Knowledge base and interview prep for senior engineers and architects.',
        start_url: '/',
        scope: '/',
        display: 'standalone',
        // Default (light) theme; the page updates the theme-color meta tag to the active theme at runtime.
        theme_color: '#ffffff',
        background_color: '#ffffff',
        icons: [
          { src: '/pwa-192x192.png', sizes: '192x192', type: 'image/png' },
          { src: '/pwa-512x512.png', sizes: '512x512', type: 'image/png' },
          { src: '/maskable-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
        shortcuts: [
          { name: 'Interview mode', url: '/interview', icons: [{ src: '/pwa-192x192.png', sizes: '192x192' }] },
          { name: 'Flashcards', url: '/flashcards', icons: [{ src: '/pwa-192x192.png', sizes: '192x192' }] },
          { name: 'Topics', url: '/topics', icons: [{ src: '/pwa-192x192.png', sizes: '192x192' }] },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,webmanifest}'],
        manifestTransforms: [scope.manifestTransform],
        navigateFallback: '/index.html',
        // Attachment links open /api/... in a new tab; those must reach the network, not the app shell.
        navigateFallbackDenylist: [/^\/api\//],
        cleanupOutdatedCaches: true,
        // Mermaid and its diagram chunks: hashed and immutable, so cache-first the first time they load.
        runtimeCaching: [
          {
            urlPattern: ({ sameOrigin, url }) => sameOrigin && url.pathname.startsWith('/assets/'),
            handler: 'CacheFirst',
            options: {
              cacheName: 'lazy-assets',
              expiration: { maxEntries: 300, maxAgeSeconds: 60 * 60 * 24 * 90 },
              cacheableResponse: { statuses: [200] },
            },
          },
        ],
      },
    }),
  ],
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    include: ['src/**/*.test.{ts,tsx}', 'scripts/**/*.test.ts'],
  },
};
});
