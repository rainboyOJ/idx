import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { defineConfig } from "@playwright/test";

const projectRoot = dirname(fileURLToPath(import.meta.url));

export const PAGE_URL = pathToFileURL(join(projectRoot, "index.html")).href;

export default defineConfig({
  testDir: "./tests",
  snapshotPathTemplate: "{testDir}/baseline/{arg}{ext}",
  timeout: 30000,
  expect: { timeout: 5000 },
  fullyParallel: true,
  forbidOnly: true,
  retries: 0,
  workers: 1,
  reporter: [["list"]],
  outputDir: "./test-results",
  use: {
    colorScheme: "light",
  },
  projects: [
    { name: "desktop-light", use: { viewport: { width: 1440, height: 1000 }, colorScheme: "light" } },
    { name: "desktop-dark", use: { viewport: { width: 1440, height: 1000 }, colorScheme: "dark" } },
    { name: "mobile-light", use: { viewport: { width: 390, height: 844 }, colorScheme: "light" } },
    { name: "mobile-dark", use: { viewport: { width: 390, height: 844 }, colorScheme: "dark" } },
    { name: "firefox-desktop", use: { browserName: "firefox", viewport: { width: 1440, height: 1000 }, colorScheme: "light" } },
  ],
});
