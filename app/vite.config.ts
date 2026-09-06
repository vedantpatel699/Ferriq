import react from '@vitejs/plugin-react'
import { defineConfig } from 'vitest/config'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  test: {
    // e2e/ holds @playwright/test specs (run via `npm run test:e2e`), not
    // vitest specs — exclude them so vitest doesn't try to execute them.
    exclude: ['node_modules/**', 'e2e/**'],
  },
})
