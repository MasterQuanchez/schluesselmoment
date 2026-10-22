/// <reference types="vitest/config" />
import { readFileSync } from 'node:fs';
import { fileURLToPath, URL } from 'node:url';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

/** nur für lokale Prüfung von AC12 — liest den Block „/*“ aus public/_headers. */
function previewHeaders(): Record<string, string> {
  const text = readFileSync(fileURLToPath(new URL('./public/_headers', import.meta.url)), 'utf8');
  const block = text.slice(text.indexOf('/*') + 2).split(/^\/\S/m)[0] ?? '';
  const headers: Record<string, string> = {};
  for (const line of block.split(/\r?\n/)) {
    const match = /^\s+([^:]+):\s*(.+)$/.exec(line);
    if (match?.[1] && match[2]) headers[match[1]] = match[2];
  }
  return headers;
}

export default defineConfig({
  define: { __APP_VERSION__: JSON.stringify(process.env.npm_package_version ?? 'dev') },
  resolve: { alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) } },
  plugins: [
    react(),
    VitePWA({
      registerType: 'prompt',
      // Zugangsschutz (Cloudflare Access) arbeitet mit Cookie → Manifest mit Cookie laden, sonst ist die PWA nicht installierbar
      useCredentials: true,
      injectRegister: false, // registriert in src/pwa.ts (Update-Hinweis statt stillem Reload)
      includeAssets: ['icon.svg'],
      manifest: {
        name: 'Schlüsselmoment – Übergabeprotokoll',
        short_name: 'Schlüsselmoment',
        description: 'Wohnungsübergabe und -abnahme auf dem Handy erfassen, unterschreiben, als PDF teilen.',
        lang: 'de',
        start_url: '/',
        scope: '/',
        display: 'standalone',
        orientation: 'portrait',
        background_color: '#FFFFFF',
        theme_color: '#0B1F3A',
        icons: [
          { src: 'icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' },
          { src: 'icon-maskable.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'maskable' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,woff2}'],
        navigateFallback: '/index.html',
        cleanupOutdatedCaches: true,
      },
    }),
  ],
  preview: { headers: previewHeaders() },
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    setupFiles: ['fake-indexeddb/auto'],
  },
});
