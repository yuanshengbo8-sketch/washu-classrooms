import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Relative base so the build works at any GitHub Pages path.
export default defineConfig({
  base: './',
  plugins: [react()],
  build: { target: 'es2022', chunkSizeWarningLimit: 900 },
  server: { port: 5183 }
})
