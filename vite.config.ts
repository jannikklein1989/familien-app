import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { defineConfig } from 'vite'
import { VitePWA } from 'vite-plugin-pwa'

const preview = process.env.VITE_PREVIEW === '1'

export default defineConfig({
  base: './',
  plugins: [
    react(),
    tailwindcss(),
    !preview && VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icons/icon.svg'],
      manifest: {
        name: 'KK Home',
        short_name: 'KK Home',
        description: 'Unser Alltag an einem Ort: To-dos, Einkauf, Essen, Verträge.',
        lang: 'de',
        start_url: './',
        scope: './',
        display: 'standalone',
        background_color: '#F3F6EF',
        theme_color: '#0F5D4C',
        icons: [
          { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
    }),
  ],
})
