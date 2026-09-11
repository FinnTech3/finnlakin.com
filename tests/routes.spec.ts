import { expect, test } from "@playwright/test";

const routes = ["/", "/writing", "/writing/marked-to-model", "/cv", "/privacy"];

test.describe("every route renders cleanly", () => {
  for (const route of routes) {
    test(`${route} renders with no console errors or failed requests`, async ({ page }) => {
      const consoleErrors: string[] = [];
      const failed: string[] = [];
      page.on("console", (message) => {
        if (message.type() === "error") consoleErrors.push(message.text());
      });
      page.on("pageerror", (error) => consoleErrors.push(`pageerror: ${error.message}`));
      page.on("response", (response) => {
        if (response.status() >= 400) failed.push(`${response.status()} ${response.url()}`);
      });

      const response = await page.goto(route);
      expect(response?.status(), `${route} should return 200`).toBe(200);
      await expect(page.locator("h1")).toBeVisible();
      await page.evaluate(() => document.fonts.ready);

      expect(failed, `${route} made failing requests`).toEqual([]);
      expect(consoleErrors, `${route} logged console errors`).toEqual([]);
    });
  }
});

test("the page paints its headline with JavaScript disabled", async ({ browser }) => {
  /* Motion's initial="hidden" pattern bakes the hidden transform into the
     server HTML, which ships a hero that never paints if the bundle is blocked.
     This asserts the opposite. */
  const context = await browser.newContext({ javaScriptEnabled: false });
  const page = await context.newPage();
  await page.goto("/");

  const heading = page.locator("h1");
  await expect(heading).toBeVisible();
  await expect(heading).toHaveText("Finn Lakin");

  const box = await heading.boundingBox();
  expect(box?.width ?? 0).toBeGreaterThan(50);
  expect(box?.height ?? 0).toBeGreaterThan(10);

  const opacity = await heading.evaluate((node) => getComputedStyle(node).opacity);
  expect(Number(opacity)).toBeGreaterThan(0.9);

  await context.close();
});

test.describe("reduced motion", () => {
  async function rowAnimationSeconds(
    browser: import("@playwright/test").Browser,
    reducedMotion: "reduce" | "no-preference",
  ) {
    const context = await browser.newContext({ reducedMotion });
    const page = await context.newPage();
    await page.goto("/");
    const row = page.locator(".settle-rows > tr").first();
    await expect(row).toBeVisible();
    const duration = await row.evaluate((node) => getComputedStyle(node).animationDuration);
    await context.close();
    return Number.parseFloat(duration);
  }

  test("the entrance animation is suppressed when asked", async ({ browser }) => {
    expect(await rowAnimationSeconds(browser, "reduce")).toBeLessThan(0.01);
  });

  test("and is real when not, so the check above means something", async ({ browser }) => {
    /* Without this, a renamed class would make the assertion above pass by
       matching nothing at all. */
    expect(await rowAnimationSeconds(browser, "no-preference")).toBeGreaterThan(0.1);
  });
});

test("the page never scrolls sideways at phone width", async ({ page }) => {
  await page.setViewportSize({ width: 400, height: 900 });
  for (const route of routes) {
    await page.goto(route);
    await page.evaluate(() => document.fonts.ready);
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(overflow, `${route} overflows horizontally at 400px`).toBeLessThanOrEqual(0);
  }
});
