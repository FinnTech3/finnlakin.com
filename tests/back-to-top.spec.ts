import { expect, test, type Page } from "@playwright/test";

/* The way back to the top, at the foot of every page.

   What is asserted is what a reader does with it: it is on every route, it is a
   button with the name they were promised, it takes them to the top of the page,
   it takes a reader who asked for less motion there at once, it takes a
   keyboard user's focus with it, and it does not print. The home page is the
   long one and the one it is for, so the behaviour is read there; the routes
   are only asked whether it is present. */

const INTRO_KEY = "fl-intro-played";

/* Every route with a footer. Written out rather than read from the sitemap,
   because the sitemap is a list of what to index and this is a list of what has
   a bottom. */
const ROUTES = ["/", "/path", "/cv", "/reel", "/writing", "/privacy"];

async function atTheBottom(page: Page) {
  await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
  await expect
    .poll(() => page.evaluate(() => window.scrollY), { timeout: 10_000 })
    .toBeGreaterThan(100);
}

test.describe("Back To Top", () => {
  for (const route of ROUTES) {
    test(`is in the footer of ${route}`, async ({ page }) => {
      await page.addInitScript((key) => sessionStorage.setItem(key, "1"), INTRO_KEY);
      await page.goto(`${route}${route === "/" ? "?brainQuality=off" : ""}`);

      const button = page.getByRole("button", { name: "Back To Top" });
      await expect(button, "one button, with the name it was asked to have").toHaveCount(1);
      await expect(button).toBeVisible();

      /* In the footer, and at the bottom of the document: not a floating
         control and not somewhere in the middle. */
      await expect(page.locator("footer").getByRole("button", { name: "Back To Top" })).toHaveCount(
        1,
      );
      const box = await button.boundingBox();
      const height = await page.evaluate(() => document.documentElement.scrollHeight);
      expect(box, "the button has a box").not.toBeNull();
      const bottom = box!.y + (await page.evaluate(() => window.scrollY)) + box!.height;
      expect(
        height - bottom,
        "the button is within the last few hundred pixels of the page",
      ).toBeLessThan(400);
    });
  }

  test("takes a reader from the bottom of the home page to the top", async ({ page }) => {
    await page.addInitScript((key) => sessionStorage.setItem(key, "1"), INTRO_KEY);
    await page.goto("/?brainQuality=off");
    await atTheBottom(page);

    await page.getByRole("button", { name: "Back To Top" }).click();

    /* Smoothly, so it takes a moment, and then it has arrived: not most of the
       way and not at a section boundary. */
    await expect.poll(() => page.evaluate(() => window.scrollY), { timeout: 10_000 }).toBe(0);
  });

  test("takes a reader who asked for less motion there at once", async ({ browser }) => {
    const context = await browser.newContext({ reducedMotion: "reduce" });
    const page = await context.newPage();
    await page.addInitScript((key) => sessionStorage.setItem(key, "1"), INTRO_KEY);
    await page.goto("/?brainQuality=off");
    await atTheBottom(page);

    /* In the same task as the click, not after a wait: a smooth scroll that
       has only started would still be well above zero here. */
    const scrollYAfterClick = await page.evaluate(() => {
      const button = [...document.querySelectorAll("button")].find(
        (candidate) => candidate.textContent?.trim() === "Back To Top",
      );
      button?.click();
      return window.scrollY;
    });
    expect(scrollYAfterClick, "the page was still scrolling").toBe(0);
    await context.close();
  });

  test("moves a keyboard user's focus to the top with the page", async ({ page }) => {
    await page.addInitScript((key) => sessionStorage.setItem(key, "1"), INTRO_KEY);
    await page.goto("/?brainQuality=off");
    await atTheBottom(page);

    const button = page.getByRole("button", { name: "Back To Top" });
    await button.focus();
    await page.keyboard.press("Enter");

    await expect.poll(() => page.evaluate(() => window.scrollY), { timeout: 10_000 }).toBe(0);
    /* Not left at the foot of the page it has just left. */
    const insideHeader = await page.evaluate(
      () => document.activeElement?.closest("header") !== null,
    );
    expect(insideHeader, "focus stayed in the footer").toBe(true);
  });

  test("is not printed", async ({ page }) => {
    await page.addInitScript((key) => sessionStorage.setItem(key, "1"), INTRO_KEY);
    await page.goto("/cv");
    await page.emulateMedia({ media: "print" });
    await expect(page.getByRole("button", { name: "Back To Top" })).toBeHidden();
  });
});
