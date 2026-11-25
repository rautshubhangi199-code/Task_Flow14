import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { defineConfig, loadEnv } from 'vite'
import { apiCurlProxy } from './vite.api-proxy.ts'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const apiTarget = env.VITE_API_PROXY_TARGET || 'http://192.168.1.9:8000'
  return {
    plugins: [react(), tailwindcss(), apiCurlProxy(apiTarget)],
    server: {
      port: 5173,
    },
    build: { chunkSizeWarningLimit: 1500 },
  }
})
