import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

const apiTarget = process.env.HIVE_API_URL ?? 'http://localhost:8080'

export default defineConfig({
  plugins: [react()],
  build: {
    outDir: '../dist/dashboard',
    emptyOutDir: true
  },
  server: {
    proxy: {
      '/api': {
        target: apiTarget,
        changeOrigin: true
      },
      '/minion': {
        target: apiTarget,
        changeOrigin: true
      },
      '/ws': {
        target: apiTarget,
        changeOrigin: true,
        ws: true
      }
    }
  }
})
