/// <reference types="vitest/config" />
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// The SPA always calls the backend at /api/*. In production, vercel.json
// rewrites /api/* to the Render backend; in dev, this proxy does the same job.
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/api': {
        target: process.env.VITE_API_TARGET ?? 'http://127.0.0.1:8000',
        changeOrigin: true,
        rewrite: (p) => p.replace(/^\/api/, ''),
      },
    },
  },
  test: {
    environment: 'jsdom',
    // threads pool: kept from when the repo lived at a path with a space,
    // where the default forks pool could not spawn workers.
    pool: 'threads',
    // CSS is stubbed to '' by default; palette.test.ts reads stylesheets as raw text.
    css: true,
  },
})
