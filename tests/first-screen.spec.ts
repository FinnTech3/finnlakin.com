import { expect, test } from "@playwright/test";

/* The first screen carries the name and both controls, at the sizes a laptop
   or a phone actually has.

   Not at the size the page was tuned on. The controls sat under the standfirst
   and fitted at 1440 by 900, which is where it was looked at, and measured at
   the others they were below the bottom of the window: at 1280 by 720, at 1366
   by 768 and 657, at 1536 by 730, at 1100 by 700 and at 1024 by 700. The name
   takes most of the first screen on purpose, so whatever is stacked under the
   standfirst goes past the fold of a window with a browser's chrome in it. A
   first screen that has to be scrolled to reach its controls is not carrying
   them, and the sizes here are the ones that proved it.

   The paragraph under them is not asserted. It is allowed to run past the fold,
   and at the shortest of these it starts on it.

   Each size runs on the project that has its kind of screen: the desktop ones
   on the desktop project and the phone on the phone project, so that nothing
   here is a mobile browser pretending to have a monitor. */
const SIZES = [
  { width: 1280, height: 720, phone: false },
  { width: 1366, height: 657, phone: false },
  { width: 1440, height: 900, phone: false },
  { width: 1920, height: 950, phone: false },
  { width: 393, height: 727, phone: true },
];

for (const { width, height, phone } of SIZES) {
  test(`the first screen at ${width} by ${height} carries the name and both controls`, async ({
    page,
    isMobile,
  }) => {
    test.skip(Boolean(isMobile) !== phone, "each size runs on the project that has its kind of screen");

    await page.addInitScript(() => sessionStorage.setItem("fl-intro-played", "1"));
    await page.setViewportSize({ width, height });
    /* The engine off: the layout is the same and a software rasteriser is not
       asked to draw thirty thousand pyramids to answer a question about boxes. */
    await page.goto("/?brainQuality=off");
    await page.evaluate(() => document.fonts.ready);

    const name = await page.locator("h1").boundingBox();
    expect(name, "the name is not on the page").not.toBeNull();
    expect(name!.y + name!.height, "the name runs past the bottom of the first screen").toBeLessThanOrEqual(
      height,
    );

    const controls = await page.locator("#hero a.shiny-cta").evaluateAll((links) =>
      links.map((link) => {
        const box = link.getBoundingClientRect();
        return { label: (link.textContent ?? "").trim(), top: box.top, bottom: box.bottom };
      }),
    );
    expect(controls.length, "the hero should carry exactly two controls").toBe(2);

    for (const control of controls) {
      expect(control.top, `"${control.label}" starts above the first screen`).toBeGreaterThanOrEqual(0);
      expect(
        control.bottom,
        `"${control.label}" ends ${Math.round(control.bottom - height)}px below the first screen`,
      ).toBeLessThanOrEqual(height);
    }
  });
}
