import { expect, test } from "@playwright/test";

import { writing } from "../src/lib/writing";
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

test.describe("the feed", () => {
  test.skip(({ isMobile }) => Boolean(isMobile), "not viewport dependent");

  test("is well-formed Atom and carries every piece", async ({ request }) => {
    const response = await request.get("/feed.xml");
    expect(response.status()).toBe(200);
    expect(response.headers()["content-type"]).toContain("application/atom+xml");

    const xml = await response.text();
    expect(xml.startsWith("<?xml")).toBe(true);
    expect(xml).toContain('xmlns="http://www.w3.org/2005/Atom"');

    /* Counted rather than searched: a feed that lists three of four pieces
       still contains the string for each of the three. */
    const entries = xml.match(/<entry>/g) ?? [];
    expect(entries.length, "one entry per write-up").toBe(writing.length);

    for (const piece of writing) {
      expect(xml, `feed is missing ${piece.slug}`).toContain(`/writing/${piece.slug}</id>`);
    }

    /* Unescaped copy is how a feed stops parsing in somebody's reader. */
    const withoutEntities = xml.replace(/&(amp|lt|gt|quot|apos|#\d+);/g, "");
    expect(withoutEntities.includes("&"), "an unescaped ampersand").toBe(false);
  });

  test("is advertised on every page", async ({ page }) => {
    for (const route of PUBLIC_ROUTES) {
      await page.goto(route);
      const href = await page
        .locator('link[rel="alternate"][type="application/atom+xml"]')
        .first()
        .getAttribute("href");
      expect(href, `${route} does not advertise the feed`).toContain("/feed.xml");
    }
  });
});

test.describe("routes that should not exist", () => {
  test.skip(({ isMobile }) => Boolean(isMobile), "not viewport dependent");

  test("an unknown write-up slug 404s", async ({ request }) => {
    /* dynamicParams = false is what makes this a static 404 rather than a
       lambda that renders the whole module graph before calling notFound. */
    for (const slug of ["does-not-exist", "marked-to-model-x", "123"]) {
      const response = await request.get(`/writing/${slug}`);
      expect(response.status(), `/writing/${slug} should 404`).toBe(404);
    }
  });
});
