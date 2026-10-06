import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

import {
  collectContent,
  markedBehind,
  markedShare,
  MARK_CEILING,
  photographBehind,
} from "./cloud-overlap";

/* The three design directions, while one of them is being chosen.

   They are deliberately outside PUBLIC_ROUTES: they carry noindex, they are not
   in the sitemap or the navigation, and robots disallows them, so not one of
   the per-route suites reaches them. That is the right call for a mockup and it
   leaves them with no coverage at all, which is not, because the whole reason
   they exist is to be looked at and two of them will be deleted on the strength
   of what somebody sees here.

   So this covers the part a screenshot cannot: that the page is sound, and that
   the rule the whole site is built to still holds in a medium it has never been
   tested in. On a dark page the cloud is light and the measurement is
   brightness. Here it is ink on paper, chalk on a wall, or two inks at once,
   and the measurement is distance from the sheet. */

const LOOKS = [
  { path: "/looks/archive", name: "Archive", heading: "Finn" },
  { path: "/looks/print", name: "Print room", heading: "Finn Lakin" },
  { path: "/looks/concrete", name: "Concrete", heading: "Finn" },
];

const INTRO_KEY = "fl-intro-played";

async function open(page: Page, path: string) {
  await page.addInitScript((key) => sessionStorage.setItem(key, "1"), INTRO_KEY);
  await page.goto(`${path}?brainQuality=low&brainDebug=1`);
  await page.evaluate(() => document.fonts.ready);
}

test.describe("the design directions", () => {
  /* Each one photographs a page with a thirty two thousand particle cloud on
     it, on a machine with no GPU. */
  test.describe.configure({ timeout: 180_000 });

  for (const look of LOOKS) {
    test(`${look.name} is a sound page`, async ({ page }) => {
      const errors: string[] = [];
      page.on("console", (message) => {
        if (message.type() === "error") errors.push(message.text());
      });
      page.on("pageerror", (error) => errors.push(String(error)));

      const response = await page.goto(look.path);
      expect(response?.status(), `${look.path} did not answer`).toBe(200);
      await page.evaluate(() => document.fonts.ready);

      const headings = page.locator("h1");
      await expect(headings, `${look.name} does not have exactly one h1`).toHaveCount(1);
      await expect(headings.first()).toContainText(look.heading);

      /* The site's own furniture is unmounted on these routes, and the point of
         that is that a direction is looked at whole rather than through the
         current design's frame. */
      await expect(
        page.locator(".site-header, .site-footer, .stage-decoration"),
        `${look.name} still has the site's own chrome around it`,
      ).toHaveCount(0);

      /* Every direction sets an enormous headline, and one of them deliberately
         runs it off the edge. Off the edge is not the same as widening the
         document, which would leave a phone scrolling sideways on every
         section. */
      await page.setViewportSize({ width: 400, height: 900 });
      await page.waitForTimeout(500);
      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
      );
      expect(overflow, `${look.name} scrolls sideways at 400px`).toBeLessThanOrEqual(1);

      expect(errors, `${look.name} logged errors`).toEqual([]);
    });

    test(`${look.name} prints the cloud, and over nothing`, async ({
      page,
      browser,
      isMobile,
    }) => {
      await open(page, look.path);

      /* The engine has to be running at all. Without its final pass there is no
         ink: the surfaces are a conversion in that pass, and the engine hides
         the canvas rather than showing raw additive light on paper. */
      await expect
        .poll(() => page.locator("[data-brain]").getAttribute("data-brain"), { timeout: 60_000 })
        .toBe("live");

      /* Below the breakpoint the cloud is drawn in the slot under the hero's
         controls and nowhere else, and on a tall hero that slot starts below
         the fold. Photographing the top of the page there is photographing the
         one part of it the cloud is deliberately not in. */
      if (isMobile) {
        await page.locator("[data-brain-slot]").scrollIntoViewIfNeeded();
      }
      await page.waitForTimeout(3_000);

      const decoder = await browser.newPage();
      const content = await collectContent(page);
      /* A low bar, and it has to be. This photographs one screen, and on a
         phone that screen is the cloud's own slot, which is the emptiest part
         of the page on purpose: the plainest direction has four things on it
         there. The number exists to catch a selector that quietly matches
         nothing, not to describe the page. */
      expect(content.length, `${look.name} has nothing on it to measure`).toBeGreaterThan(2);

      const shot = await photographBehind(page);

      /* The sheet, with the page hidden, carries the cloud and nothing else. */
      expect(
        await markedShare(decoder, shot),
        `${look.name} printed no cloud at all`,
      ).toBeGreaterThan(0.002);

      const behind = await markedBehind(decoder, shot, content);
      content.forEach((box, index) => {
        expect(
          behind[index] ?? 1,
          `${look.name} has the cloud behind "${box.label}"`,
        ).toBeLessThanOrEqual(MARK_CEILING);
      });

      await decoder.close();
    });
  }

  /* The same gate the site's own routes pass, at the same severities, run on
     each direction and the index. Two of these are about to be thrown away, so
     it is the one left standing that this is for: a direction chosen on how it
     looks should not turn out to have its small labels at 3.9:1 once somebody
     measures them.

     Without the cloud. Contrast is a question about the words against the
     sheet, and the cloud is kept out of every word by construction and
     measured as such above, so leaving it out makes this faster and exactly as
     strict. Colour is resolved against the paper on the root element, which is
     what makes this scan possible at all: on the dark site the same scan has to
     be nudged around a sticky panel. */
  for (const look of [...LOOKS, { path: "/looks", name: "The index", heading: "" }]) {
    test(`${look.name} has no blocking accessibility violations`, async ({ page }) => {
      await page.addInitScript((key) => sessionStorage.setItem(key, "1"), INTRO_KEY);
      await page.goto(`${look.path}?brainQuality=off`);
      await page.evaluate(() => document.fonts.ready);
      await page.waitForTimeout(400);

      const results = await new AxeBuilder({ page })
        .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "best-practice"])
        .analyze();
      const blocking = new Set(["critical", "serious", "moderate"]);
      const found = results.violations
        .filter((violation) => blocking.has(violation.impact ?? ""))
        .map((violation) => ({
          id: violation.id,
          impact: violation.impact,
          nodes: violation.nodes.slice(0, 6).map((node) => ({
            target: node.target.join(" "),
            why: node.any[0]?.message ?? node.failureSummary,
          })),
        }));
      expect(found, `${look.name} has accessibility violations`).toEqual([]);
    });
  }

  test("the index lists all three", async ({ page }) => {
    const response = await page.goto("/looks");
    expect(response?.status()).toBe(200);
    for (const look of LOOKS) {
      await expect(page.locator(`a[href="${look.path}"]`).first()).toBeVisible();
    }
  });

  /* None of them is the site, and nothing should treat them as if they were. */
  test("none of them is offered to a crawler", async ({ page, request }) => {
    const robots = await (await request.get("/robots.txt")).text();
    expect(robots, "robots does not disallow the directions").toContain("Disallow: /looks");

    const sitemap = await (await request.get("/sitemap.xml")).text();
    expect(sitemap, "a direction reached the sitemap").not.toContain("/looks");

    for (const look of LOOKS) {
      await page.goto(look.path);
      await expect(
        page.locator('head meta[name="robots"]'),
        `${look.name} does not say noindex`,
      ).toHaveAttribute("content", /noindex/);
    }
  });
});
