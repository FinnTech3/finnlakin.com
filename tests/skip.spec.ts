import { expect, test } from "@playwright/test";

/* A way out of the opening that does not need a keyboard.

   An iPad has no Escape key, and the opening runs for about eight seconds, which
   is longer than moving content should run without a way to stop it. The button
   is there only while the opening is, so before and after it is neither on the
   screen nor reachable, and pressing it leaves the page exactly as Escape does. */

const state = (page: import("@playwright/test").Page) =>
  page.evaluate(() => document.documentElement.dataset.intro ?? "none");

test.describe("the opening's Skip button", () => {
  test.describe.configure({ timeout: 60_000 });
  test("is there while the opening runs, ends it, and is gone after", async ({ page }) => {
    await page.goto("/");
    expect(await state(page)).toBe("running");
    const skip = page.getByRole("button", { name: "Skip" });
    await expect(skip, "Skip is not offered while the opening runs").toBeVisible();
    const box = await skip.boundingBox();
    expect(box!.width, "a finger needs 44 pixels").toBeGreaterThanOrEqual(44);
    expect(box!.height, "a finger needs 44 pixels").toBeGreaterThanOrEqual(44);

    /* Pressed the moment the engine owns the opening, which is when the listener
       is attached and not before: pressing earlier tests nothing, and waiting
       longer risks the opening having ended by itself on a slow machine. */
    await page.waitForFunction(
      () => document.documentElement.hasAttribute("data-intro-owned"),
      null,
      { timeout: 20_000, polling: "raf" },
    );
    await skip.click();
    await expect.poll(() => state(page), { timeout: 6_000 }).toBe("none");
    await expect(skip, "Skip is still offered after the opening").toBeHidden();
    expect(
      await page.evaluate(() => sessionStorage.getItem("fl-intro-played")),
      "skipping must count as having played it",
    ).toBe("1");
  });

  test("is not offered when there is no opening", async ({ browser }) => {
    const context = await browser.newContext({ reducedMotion: "reduce" });
    const page = await context.newPage();
    await page.goto("/");
    await expect(page.getByRole("button", { name: "Skip" })).toBeHidden();
    await context.close();
  });
});

test.describe("the Skip button before the engine arrives", () => {
  test("works from the first paint, with no engine to hear it", async ({ page }) => {
    /* The engine is held back by turning it off, which is the state a slow
       connection is in for its first seconds: the button is on the screen and
       nothing has been told to listen. */
    await page.goto("/?brainQuality=off");
    expect(await state(page)).toBe("running");
    await page.getByRole("button", { name: "Skip" }).click();
    expect(await state(page), "the boot script must end it").toBe("none");
    await expect(page.locator(".intro")).toBeHidden();
    expect(await page.evaluate(() => sessionStorage.getItem("fl-intro-played"))).toBe("1");
  });
});
