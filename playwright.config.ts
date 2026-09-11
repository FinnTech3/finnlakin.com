import { defineConfig, devices } from "@playwright/test";

const PORT = 3123;
const baseURL = `http://127.0.0.1:${PORT}`;

/* Tests run against the production build, not the dev server. Several of the
   things worth checking here (static prerendering, emitted head tags, minified
   HTML) only exist after next build. */
export default defineConfig({
  testDir: "./tests",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: 0,
  reporter: process.env.CI ? "github" : [["list"]],
  use: {
    baseURL,
    trace: "retain-on-failure",
  },
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"] } },
    { name: "phone", use: { ...devices["Pixel 5"] } },
  ],
  webServer: {
    command: `npm run start -- -p ${PORT}`,
    url: baseURL,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
