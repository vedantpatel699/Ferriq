import { defineConfig, devices } from "@playwright/test";

// Uses the environment's pre-installed Chromium rather than downloading a
// browser (see chromium-1194 under PLAYWRIGHT_BROWSERS_PATH).
export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  reporter: [["list"]],
  use: {
    baseURL: "http://localhost:4173",
    ...(process.env.PLAYWRIGHT_EXECUTABLE_PATH?{launchOptions:{executablePath:process.env.PLAYWRIGHT_EXECUTABLE_PATH}}:process.platform==='win32'?{channel:'chrome'}:{}),
  },
  webServer: {
    command: "npm run preview -- --port 4173",
    url: "http://localhost:4173",
    reuseExistingServer: true,
    timeout: 30000,
  },
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"], viewport: { width: 1440, height: 900 } } },
    { name: "tablet", use: { ...devices["Desktop Chrome"], viewport: { width: 834, height: 1112 } } },
  ],
});
