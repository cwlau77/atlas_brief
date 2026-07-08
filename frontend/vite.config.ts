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
    // The project lives at a path with a space ("Atlas Brief"); the default
    // forks pool fails to spawn workers on such paths, threads is fine.
    pool: 'threads',
  },
})
