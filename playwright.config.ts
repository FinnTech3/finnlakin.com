import { defineConfig, devices } from "@playwright/test";

const PORT = 3123;
/* A second instance with no database and no analytics secret, to prove the
   site degrades rather than breaks when neither is configured. */
export const DEGRADED_PORT = 3124;

const baseURL = `http://127.0.0.1:${PORT}`;
export const degradedURL = `http://127.0.0.1:${DEGRADED_PORT}`;

export const TEST_DATABASE_URL =
  process.env.TEST_POSTGRES_URL ??
  "postgresql://postgres@127.0.0.1:55432/finnlakin_test?sslmode=disable";

export const TEST_ADMIN_PASSWORD = "correct-horse-battery";
export const TEST_ADMIN_SECRET = "test-admin-secret-0123456789";
export const TEST_ANALYTICS_SALT = "test-analytics-salt-0123456789";

/* Tests run against the production build. Static prerendering, emitted head
   tags and minified HTML only exist after next build. */
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
  webServer: [
    {
      command: `npm run start -- -p ${PORT}`,
      url: baseURL,
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
      env: {
        POSTGRES_URL: TEST_DATABASE_URL,
        ANALYTICS_SALT: TEST_ANALYTICS_SALT,
        ADMIN_PASSWORD: TEST_ADMIN_PASSWORD,
        ADMIN_SECRET: TEST_ADMIN_SECRET,
        NEXT_PUBLIC_SITE_URL: baseURL,
      },
    },
    {
      command: `npm run start -- -p ${DEGRADED_PORT}`,
      url: degradedURL,
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
      env: {
        /* Explicitly blank rather than merely absent, so the test does not
           quietly depend on what the parent shell happens to export. */
        POSTGRES_URL: "",
        ANALYTICS_SALT: "",
        ADMIN_PASSWORD: "",
        ADMIN_SECRET: "",
        NEXT_PUBLIC_SITE_URL: degradedURL,
      },
    },
  ],
});
