import { expect, test, type Page } from "@playwright/test";

/* The letter weight effect and the highlighted testimonials.

   The effect is allowed to do one thing: draw heavier letters over the real
   ones near the pointer. Everything else about the page has to be what it was,
   so that is most of what is asserted here. */

const drawn = (page: Page) =>
  page.evaluate(
    () =>
      [...document.querySelectorAll<HTMLElement>(".proximity-layer > span")].filter(
        (span) => span.style.display !== "none",
      ).length,
  );

test.describe("the letter weight effect", () => {
  test("draws near the pointer, leaves the page's own text alone, and empties at rest", async ({
    page,
    isMobile,
  }) => {
    test.skip(Boolean(isMobile), "a finger has no pointer to follow");
    await page.addInitScript(() => sessionStorage.setItem("fl-intro-played", "1"));
    await page.goto("/");
    await page.evaluate(() => document.fonts.ready);
    await expect(page.locator(".proximity-layer")).toHaveCount(1);
    const before = await page.evaluate(() => document.querySelector("main")!.innerHTML);

    const standfirst = (await page.locator(".t-sub").first().boundingBox())!;
    await page.mouse.move(standfirst.x + 60, standfirst.y + 20);
    await expect.poll(() => drawn(page), { timeout: 5_000 }).toBeGreaterThan(0);

    /* The layer is decoration: nothing in it can be heard or clicked. */
    const layer = page.locator(".proximity-layer");
    await expect(layer).toHaveAttribute("aria-hidden", "true");
    expect(await layer.evaluate((node) => getComputedStyle(node).pointerEvents)).toBe("none");

    /* The pointer leaving the window, which a test cannot move it to. Any
       point inside the window can be near a word, so this is the only rest. */
    await page.evaluate(() => document.dispatchEvent(new MouseEvent("mouseout", { relatedTarget: null })));
    await expect.poll(() => drawn(page), { timeout: 5_000 }).toBe(0);
    expect(
      await page.evaluate(() => document.querySelector("main")!.innerHTML),
      "the page's own text was rewritten",
    ).toBe(before);
  });

  test("is never loaded for a reader who asked for less motion", async ({ browser }) => {
    const context = await browser.newContext({ reducedMotion: "reduce" });
    const page = await context.newPage();
    await page.goto("/");
    await page.evaluate(() => document.fonts.ready);
    const standfirst = (await page.locator(".t-sub").first().boundingBox())!;
    await page.mouse.move(standfirst.x + 60, standfirst.y + 20);
    await page.waitForTimeout(400);
    expect(await drawn(page)).toBe(0);
    await context.close();
  });

  test("is not loaded on a touch screen", async ({ page, isMobile }) => {
    test.skip(!isMobile, "the phone project is the touch screen");
    await page.goto("/");
    await page.waitForLoadState("networkidle");
    await expect(page.locator(".proximity-layer")).toHaveCount(0);
  });
});

test.describe("the testimonials", () => {
  test("are highlighted in the selection's own colours", async ({ page }) => {
    await page.goto("/");
    const quote = page.locator("blockquote .highlight").first();
    await expect(quote).toBeVisible();
    const colours = await quote.evaluate((node) => {
      const probe = document.createElement("p");
      document.body.append(probe);
      const selection = getComputedStyle(probe, "::selection");
      const result = {
        background: getComputedStyle(node).backgroundColor,
        text: getComputedStyle(node).color,
        selectionBackground: selection.backgroundColor,
        selectionText: selection.color,
      };
      probe.remove();
      return result;
    });
    expect(colours.background).toBe(colours.selectionBackground);
    expect(colours.text).toBe(colours.selectionText);
  });
});
