import { expect, test } from "@playwright/test";

/* The print stylesheet had no test at all, and it has already been wrong once:
   a bare `header` rule hid the CV's own name-and-contact block, so the page
   somebody actually puts on paper printed without a name on it. Nothing caught
   that except looking at it. These assertions are what looking at it would
   have told us. */
test.describe("print output", () => {
  test.skip(({ isMobile }) => Boolean(isMobile), "print layout is not viewport dependent");

  test("drops the site chrome but keeps the CV's own heading", async ({ page }) => {
    await page.goto("/cv");
    await page.emulateMedia({ media: "print" });
    await page.evaluate(() => document.fonts.ready);

    await expect(page.locator("body > header")).toBeHidden();
    await expect(page.locator("body > footer")).toBeHidden();

    /* The part that regressed. A CV with no name is not a CV. */
    const name = page.locator("main h1");
    await expect(name).toBeVisible();
    await expect(name).toHaveText("Finn Lakin");
    await expect(page.locator('main a[href^="mailto:"]')).toBeVisible();

    /* Useless on paper: nobody can click it. */
    await expect(page.locator(".print-hidden").first()).toBeHidden();
  });

  test("keeps pass and flag distinguishable without colour", async ({ page }) => {
    /* A result that did not hold is a swatch of acid on the screen, and a result
       that did is plain. On paper a swatch of acid is a pale grey behind the
       words, which says nothing, and a coloured verdict prints as a mid grey
       fainter than the text around it. So both turn black, deliberately, and
       the distinction is carried by weight and a box round the flag. Weight and
       the box are what this checks: comparing the colours would pass while
       saying nothing. */
    await page.goto("/writing/nanobook");
    await page.emulateMedia({ media: "print" });
    await page.evaluate(() => document.fonts.ready);

    const flag = page.locator(".flag").first();
    const pass = page.locator(".held").first();
    await expect(flag).toBeVisible();
    await expect(pass).toBeVisible();

    const weightOf = (locator: typeof flag) =>
      locator.evaluate((node) => Number(getComputedStyle(node).fontWeight));

    const [flagWeight, passWeight] = [await weightOf(flag), await weightOf(pass)];
    expect(
      flagWeight,
      "a flagged figure must stand out from a passing one on paper",
    ).toBeGreaterThan(passWeight);

    /* The box is the other half of it, and it has to be there: weight alone is a
       difference between 500 and 700, which a laser printer does not always
       show. */
    const outline = await flag.evaluate((node) => getComputedStyle(node).outlineStyle);
    expect(outline, "a flagged figure has no box round it on paper").toBe("solid");

    /* And both must still be black, with no swatch behind the words, or the
       paper rules have quietly been undone by something restoring hue. */
    for (const locator of [flag, pass]) {
      const colour = await locator.evaluate((node) => getComputedStyle(node).color);
      expect(colour).toBe("rgb(0, 0, 0)");
    }
    const swatch = await flag.evaluate((node) => getComputedStyle(node).backgroundColor);
    expect(swatch, "the acid swatch survived into print").toBe("rgba(0, 0, 0, 0)");
  });

  test("prints the address of a link nobody can click", async ({ page }) => {
    await page.goto("/writing/nanobook");
    await page.emulateMedia({ media: "print" });

    const printed = await page
      .locator('.longform a[href^="http"]')
      .first()
      .evaluate((node) => getComputedStyle(node, "::after").content);

    expect(printed, "an external link should print its URL").toContain("http");
  });
});
