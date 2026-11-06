/// <reference types="vitest/config" />
import path from 'node:path'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// API_PROXY_TARGET: http://127.0.0.1:4010 for the Prism mock, http://127.0.0.1:7341 for the real backend.
const apiProxyTarget = process.env.API_PROXY_TARGET ?? 'http://127.0.0.1:7341'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': path.resolve(import.meta.dirname, './src'),
    },
  },
  server: {
    port: 5391,
    host: '127.0.0.1',
    proxy: {
      '/api': apiProxyTarget,
    },
  },
  preview: {
    port: 5391,
    host: '127.0.0.1',
  },
  test: {
    environment: 'jsdom',
    env: { TZ: 'Asia/Vladivostok' },
    setupFiles: ['./src/test/setup.ts'],
  },
})
