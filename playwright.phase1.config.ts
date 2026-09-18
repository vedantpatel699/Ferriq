import { defineConfig } from "@playwright/test";
import base from "./playwright.config";
export default defineConfig({...base,use:{...base.use,baseURL:"http://localhost:4182"},webServer:{command:"npm run preview -- --port 4182",url:"http://localhost:4182",reuseExistingServer:false,timeout:30000}});
