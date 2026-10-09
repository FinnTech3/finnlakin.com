import { expect, test } from "@playwright/test";

/* The frame-rate readout, for the device nobody here has.

   Behind ?brainStats=1 and nowhere else. It has to appear and say something
   that is a measurement and not a placeholder, and the page without the flag
   must not carry it at all. */

test.describe("the stats readout", () => {
  test.describe.configure({ timeout: 90_000 });

  test("appears with the flag and reports what the engine is doing", async ({ page }) => {
    await page.addInitScript(() => sessionStorage.setItem("fl-intro-played", "1"));
    await page.goto("/?brainStats=1&brainQuality=medium");
    const panel = page.locator("[data-brain-stats]");
    await expect(panel).toBeAttached({ timeout: 30_000 });
    await expect
      .poll(async () => (await panel.textContent()) ?? "", { timeout: 60_000 })
      .toMatch(/frames\s+\d+ per second/);
    const text = (await panel.textContent()) ?? "";
    expect(text).toContain("quality   medium");
    expect(text).toMatch(/\d+ particles/);
    expect(text).toMatch(/layout\s+(lane|slot)/);
    expect(text).toMatch(/screen\s+\d+ by \d+ at/);
  });

  test("is not on the page without the flag", async ({ page }) => {
    await page.addInitScript(() => sessionStorage.setItem("fl-intro-played", "1"));
    await page.goto("/?brainQuality=medium");
    await expect
      .poll(() => page.locator("[data-brain]").getAttribute("data-brain"), { timeout: 30_000 })
      .toBe("live");
    await page.waitForTimeout(1500);
    await expect(page.locator("[data-brain-stats]")).toHaveCount(0);
  });
});
