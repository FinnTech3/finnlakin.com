import { expect, test } from "@playwright/test";

import { PUBLIC_ROUTES } from "./site-routes";

test.describe("sitemap and robots", () => {
  test.skip(({ isMobile }) => Boolean(isMobile), "not viewport dependent");

  test("the sitemap lists every public route and no private one", async ({ request }) => {
    const response = await request.get("/sitemap.xml");
    expect(response.status()).toBe(200);

    const xml = await response.text();
    for (const route of PUBLIC_ROUTES) {
      expect(xml, `sitemap is missing ${route}`).toContain(
        route === "/" ? "<loc>" : `${route}</loc>`,
      );
    }
    expect(xml).not.toContain("/admin");
    expect(xml).not.toContain("/api/");

    /* grep -c would count matching lines, and this is effectively one line.
       Count the matches themselves. Derived from the route list, so publishing
       a write-up without adding it to the sitemap fails here. */
    const locs = xml.match(/<loc>/g) ?? [];
    expect(locs.length).toBe(PUBLIC_ROUTES.length);
  });

  test("robots keeps crawlers out of the admin area", async ({ request }) => {
    const response = await request.get("/robots.txt");
    expect(response.status()).toBe(200);

    const text = await response.text();
    expect(text).toContain("Disallow: /admin");
    expect(text).toContain("Disallow: /api");
    expect(text).toMatch(/Sitemap:\s*http/);
  });
});

test.describe("structured data", () => {
  test.skip(({ isMobile }) => Boolean(isMobile), "not viewport dependent");

  async function jsonLd(page: import("@playwright/test").Page) {
    return page.locator('script[type="application/ld+json"]').evaluateAll((nodes) =>
      nodes.map((node) => JSON.parse(node.textContent ?? "{}")),
    );
  }

  test("the home page describes a Person", async ({ page }) => {
    await page.goto("/");
    const blocks = await jsonLd(page);
    expect(blocks.length).toBeGreaterThan(0);

    const personBlock = blocks.find((block) => block["@type"] === "Person");
    expect(personBlock).toBeTruthy();
    expect(personBlock.name).toBe("Finn Lakin");
    expect(personBlock["@context"]).toBe("https://schema.org");
    expect(Array.isArray(personBlock.sameAs)).toBe(true);
  });

  test("a write-up describes an Article with a real date", async ({ page }) => {
    await page.goto("/writing/marked-to-model");
    const blocks = await jsonLd(page);

    const article = blocks.find((block) => block["@type"] === "Article");
    expect(article).toBeTruthy();
    expect(article.headline).toContain("Eleven thousand violations");
    expect(Number.isNaN(Date.parse(article.datePublished))).toBe(false);
    expect(article.url).toMatch(/\/writing\/marked-to-model$/);
  });
});
