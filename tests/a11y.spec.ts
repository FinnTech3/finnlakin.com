import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

import { dropCrossOriginFrames } from "./axe-scope";
import { PUBLIC_ROUTES as routes } from "./site-routes";

type Page = import("@playwright/test").Page;

async function settle(page: Page) {
  /* axe will catch an element mid-animation and report a contrast failure
     that disappears once the transition finishes, so let everything settle
     before scanning. */
  await page.evaluate(() => document.fonts.ready);
  await page.evaluate(async () => {
    const animations = document.getAnimations();
    await Promise.all(animations.map((animation) => animation.finished.catch(() => {})));
  });
  await page.waitForTimeout(300);
}

async function scan(page: Page) {
  /* best-practice is included deliberately. A sweep at every severity over
     every route found exactly one thing under it, nested complementary
     landmarks in the write-up asides, and nothing at all under the WCAG tags,
     so turning it on costs nothing and the gate gets stricter. The risk worth
     naming: these rules change between axe releases, so an upgrade can surface
     something new. That arrives as a test to look at rather than a regression
     already shipped, which is the right way round. */
  const results = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "best-practice"])
    .analyze();

  /* Moderate counts now, not only serious and critical. Widening the tag list
     alone would have been cosmetic: the landmark rule that prompted this is
     moderate impact, so the old filter would have dropped it whatever tags
     were scanned. The sweep found nothing at any severity once the asides were
     fixed, so this passes today and catches the next structural mistake, which
     is the level heading-order and landmark rules live at.

     Minor stays out. Those are the most subjective rules and the most likely
     to churn on an axe upgrade, and nothing there would change what a reader
     can do. */
  const blocking = new Set(["critical", "serious", "moderate"]);
  return results.violations.filter((violation) => blocking.has(violation.impact ?? ""));
}

function summarise(violations: Awaited<ReturnType<typeof scan>>) {
  return violations.map((violation) => ({
    id: violation.id,
    impact: violation.impact,
    nodes: violation.nodes.map((node) => node.target.join(" ")),
  }));
}

for (const route of routes) {
  test(`${route} has no blocking accessibility violations`, async ({ page }) => {
    await page.goto(route);
    await settle(page);
    expect(summarise(await dropCrossOriginFrames(page, await scan(page)))).toEqual([]);
  });
}

/* The scan above excuses what is inside a cross-origin frame, which is a hole
   unless the hole is measured. Stub the embedded tool with markup that fails
   on purpose and assert both halves: the raw scan sees it, so frames really
   are traversed and the filter is doing something, and the filtered scan does
   not, so it is the frame's origin being excused rather than the rule.

   This also covers the frame locally. Without the stub the embed is a live
   request to GitHub Pages, which succeeds on a CI runner and fails behind a
   sandbox, so a local run and a CI run were scanning different documents and
   only one of them found the tool's contrast failures. */
test("the a11y gate excuses a cross-origin frame, and nothing else", async ({ page }) => {
  await page.route("https://finntech3.github.io/**", (route) =>
    route.fulfill({
      status: 200,
      contentType: "text/html",
      body: `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>stub</title></head>
        <body style="background:#ffffff"><main>
        <p style="color:#d6d6d6;background:#ffffff;font-size:14px">Deliberately unreadable.</p>
        </main></body></html>`,
    }),
  );

  await page.goto("/writing/whose-inflation");
  await page.locator('iframe[src^="https://finntech3.github.io"]').scrollIntoViewIfNeeded();
  await expect.poll(() => page.frames().length, { timeout: 15_000 }).toBeGreaterThan(1);
  await settle(page);

  const raw = await scan(page);
  const insideFrame = raw.flatMap((violation) =>
    violation.nodes.filter((node) => node.target.length > 1).map(() => violation.id),
  );
  expect(insideFrame, "axe never entered the frame, so the filter proves nothing").toContain(
    "color-contrast",
  );

  /* The stub carries a <main> on purpose. axe merges the two documents and
     reports this page's own #main as a duplicate landmark, which is the second
     thing the filter has to handle: a node in our document flagged only
     because of something in the frame. Asserting it appears raw is what stops
     that branch from being dead code. */
  expect(
    raw.map((violation) => violation.id),
    "the stub no longer provokes a cross-document landmark clash",
  ).toContain("landmark-unique");

  expect(summarise(await dropCrossOriginFrames(page, raw))).toEqual([]);
});

/* heading-order is a moderate-impact rule, and the gate above only fails on
   serious and critical, so /writing shipped with an h1 followed straight by
   four h3s and every suite stayed green. Structure is how a screen reader user
   skims a page, so it gets its own assertion at its own severity rather than
   a lowered threshold everywhere. */
test.describe("heading structure", () => {
  test.skip(({ isMobile }) => Boolean(isMobile), "markup is identical across viewports");

  for (const route of routes) {
    test(`${route} never skips a heading level`, async ({ page }) => {
      await page.goto(route);

      const levels = await page
        .locator("h1, h2, h3, h4, h5, h6")
        .evaluateAll((nodes) => nodes.map((node) => Number(node.tagName.slice(1))));

      expect(levels.length, `${route} has no headings at all`).toBeGreaterThan(0);
      expect(levels[0], `${route} does not start at h1`).toBe(1);
      expect(
        levels.filter((level) => level === 1).length,
        `${route} has more than one h1`,
      ).toBe(1);

      const skips: string[] = [];
      levels.forEach((level, index) => {
        if (index > 0 && level > levels[index - 1]! + 1) {
          skips.push(`h${levels[index - 1]} -> h${level}`);
        }
      });
      expect(skips, `${route} skips heading levels`).toEqual([]);
    });
  }
});
