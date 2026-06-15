import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    strictPort: false,
    open: true,
  },
  test: {
    // Core logic is framework-free, so the fast Node environment is enough.
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
})
