import { defineConfig } from 'astro/config';
import preact from '@astrojs/preact';
import tailwindcss from '@tailwindcss/vite';
import { AstroPWAIntegration as AstroPWA } from '@vite-pwa/astro';

export default defineConfig({
  output: 'static',
  integrations: [
    preact(),
    AstroPWA({
      // 'prompt': a new service worker waits until the scorer taps "Update available — reload" on Setup.
      registerType: 'prompt',
      injectRegister: false,
      includeManifestIcons: false,
      generateSW: {
        globPatterns: ['**/*.{js,css,html,svg,png,ico,webmanifest}'],
        globIgnores: ['manifest.webmanifest'], // the plugin precaches the manifest itself
      },
      manifest: {
        name: 'Bench Book',
        short_name: 'Bench Book',
        display: 'standalone',
        start_url: '/',
        scope: '/',
        background_color: '#0f172a',
        theme_color: '#0f172a',
        icons: [
          { src: 'icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
    }),
  ],
  vite: { plugins: [tailwindcss()] },
});
