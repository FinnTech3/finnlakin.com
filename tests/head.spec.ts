import { expect, test } from "@playwright/test";

import { PUBLIC_ROUTES as routes } from "./site-routes";

/* Metadata merges per key rather than per field, so a page declaring a partial
   openGraph silently drops the site name, the canonical url and the card image.
   Reading the config cannot catch that. These assertions read the emitted HTML.  */
test.describe("emitted head tags", () => {
  test.skip(({ isMobile }) => Boolean(isMobile), "markup is identical across viewports");

  for (const route of routes) {
    test(`${route} emits a complete and self-consistent head`, async ({ page }) => {
      await page.goto(route);

      const canonical = await page
        .locator('link[rel="canonical"]')
        .getAttribute("href");
      expect(canonical, `${route} has no canonical`).toBeTruthy();
      expect(canonical).toMatch(new RegExp(`${route === "/" ? "" : route}$`));

      const ogUrl = await page
        .locator('meta[property="og:url"]')
        .getAttribute("content");
      expect(ogUrl, `${route} og:url must match its canonical`).toBe(canonical);

      const ogImage = await page
        .locator('meta[property="og:image"]')
        .getAttribute("content");
      expect(ogImage, `${route} has no og:image`).toBeTruthy();

      const twitterCard = await page
        .locator('meta[name="twitter:card"]')
        .getAttribute("content");
      expect(twitterCard).toBe("summary_large_image");

      /* summary_large_image reserves a large image slot. A page that asks for
         one and supplies nothing renders as a blank rectangle everywhere. */
      const twitterImage = await page
        .locator('meta[name="twitter:image"]')
        .getAttribute("content");
      expect(twitterImage, `${route} asks for a large card with no image`).toBeTruthy();

      for (const selector of [
        'meta[property="og:title"]',
        'meta[property="og:description"]',
        'meta[property="og:site_name"]',
        'meta[name="description"]',
      ]) {
        const content = await page.locator(selector).getAttribute("content");
        expect(content, `${route} is missing ${selector}`).toBeTruthy();
      }

      expect(await page.title()).not.toBe("");
    });
  }

  test("the og:image route returns a real image", async ({ request }) => {
    const response = await request.get("/api/og?title=Test%20card&kicker=Write-up");
    expect(response.status()).toBe(200);
    expect(response.headers()["content-type"]).toContain("image/");
    expect((await response.body()).byteLength).toBeGreaterThan(1000);
  });
});

test.describe("private repositories are never linked", () => {
  test.skip(({ isMobile }) => Boolean(isMobile), "markup is identical across viewports");

  /* These four are private. A link to any of them 404s for every visitor. */
  const privateRepos = ["Tracker", "Blog_v.1", "penny", "moneymind"];

  for (const route of routes) {
    test(`${route} links no private repository`, async ({ page }) => {
      await page.goto(route);
      const hrefs = await page.locator("a[href]").evaluateAll((nodes) =>
        nodes.map((node) => (node as HTMLAnchorElement).getAttribute("href") ?? ""),
      );

      for (const repo of privateRepos) {
        const offending = hrefs.filter((href) =>
          href.toLowerCase().includes(`github.com/finntech3/${repo.toLowerCase()}`),
        );
        expect(offending, `${route} links the private repo ${repo}`).toEqual([]);
      }
    });
  }
});
