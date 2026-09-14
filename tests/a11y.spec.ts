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
  const results = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
    .analyze();

  return results.violations.filter(
    (violation) => violation.impact === "serious" || violation.impact === "critical",
  );
}

function summarise(violations: Awaited<ReturnType<typeof scan>>) {
  return violations.map((violation) => ({
    id: violation.id,
    impact: violation.impact,
    nodes: violation.nodes.map((node) => node.target.join(" ")),
  }));
}

for (const route of routes) {
  test(`${route} has no serious or critical accessibility violations`, async ({ page }) => {
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

  expect(summarise(await dropCrossOriginFrames(page, raw))).toEqual([]);
});
