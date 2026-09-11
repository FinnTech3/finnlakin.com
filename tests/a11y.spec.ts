import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

const routes = ["/", "/writing", "/writing/marked-to-model", "/cv", "/privacy"];

for (const route of routes) {
  test(`${route} has no serious or critical accessibility violations`, async ({ page }) => {
    await page.goto(route);

    /* axe will catch an element mid-animation and report a contrast failure
       that disappears once the transition finishes, so let everything settle
       before scanning. */
    await page.evaluate(() => document.fonts.ready);
    await page.evaluate(async () => {
      const animations = document.getAnimations();
      await Promise.all(animations.map((animation) => animation.finished.catch(() => {})));
    });
    await page.waitForTimeout(300);

    const results = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
      .analyze();

    const blocking = results.violations.filter(
      (violation) => violation.impact === "serious" || violation.impact === "critical",
    );

    expect(
      blocking.map((violation) => ({
        id: violation.id,
        impact: violation.impact,
        nodes: violation.nodes.map((node) => node.target.join(" ")),
      })),
    ).toEqual([]);
  });
}
