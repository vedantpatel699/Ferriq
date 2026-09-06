import react from '@vitejs/plugin-react'
import { defineConfig } from 'vitest/config'

// https://vite.dev/config/
export default defineConfig({
  // Production is served from https://vedantpatel699.github.io/Ferriq/ (a
  // GitHub Pages project site, not a custom domain), so the deploy build
  // needs asset URLs rooted under /Ferriq/ instead of /. The GitHub
  // Actions workflow sets DEPLOY_BASE_PATH=/Ferriq/ for that build only;
  // local dev/preview/build (including what the Playwright e2e suite runs
  // against) stay at root "/" so routes and baseURL don't need
  // special-casing. App.tsx reads the same resolved value back via
  // import.meta.env.BASE_URL as the router's basename, so the two never
  // drift out of sync.
  base: process.env.DEPLOY_BASE_PATH || '/',
  plugins: [react()],
  test: {
    // e2e/ holds @playwright/test specs (run via `npm run test:e2e`), not
    // vitest specs — exclude them so vitest doesn't try to execute them.
    exclude: ['node_modules/**', 'e2e/**'],
  },
})
