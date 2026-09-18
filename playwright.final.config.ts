import { defineConfig } from "@playwright/test";
import base from "./playwright.config";
export default defineConfig({
  ...base,
  reporter: [
    ["list"],
    ["json", { outputFile: "test-results/final-review.json" }],
  ],
  use: { ...base.use, baseURL: "http://localhost:4183" },
  webServer: {
    command: "npm run preview -- --port 4183",
    url: "http://localhost:4183",
    reuseExistingServer: false,
    timeout: 30000,
  },
});
