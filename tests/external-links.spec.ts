import { expect, test } from "@playwright/test";

import { PUBLIC_ROUTES as pages } from "./site-routes";

/* This one talks to the real internet, which is why it is its own file: a
   recruiter clicking a dead demo is the failure this prevents, and it cannot
   be caught offline. Run it before launching and whenever a link changes. */
test.describe("external links resolve", () => {
  test.skip(({ isMobile }) => Boolean(isMobile), "network check, once is enough");
  test.describe.configure({ timeout: 120_000 });

  test("every outbound link on the site returns a usable status", async ({ page, request }) => {
    const found = new Set<string>();

    for (const route of pages) {
      await page.goto(route);
      const hrefs = await page
        .locator("a[href^='http']")
        .evaluateAll((nodes) =>
          nodes.map((node) => (node as HTMLAnchorElement).href),
        );
      for (const href of hrefs) {
        if (!href.includes("127.0.0.1") && !href.includes("localhost")) found.add(href);
      }
    }

    expect(found.size, "expected the site to carry outbound links").toBeGreaterThan(5);

    /* LinkedIn answers automated requests with 999, its anti-scraping status.
       The link works in a browser, so a 999 here is the guard talking rather
       than a dead link. These hosts are still required to resolve and complete
       a TLS handshake; only the status assertion is relaxed, and they are
       reported as unverified rather than counted as passing. */
    const botGuarded = [/^https:\/\/(www\.)?linkedin\.com\//];
    const isGuarded = (href: string) => botGuarded.some((pattern) => pattern.test(href));

    const failures: string[] = [];
    const unverified: string[] = [];

    for (const href of found) {
      try {
        const response = await request.get(href, { timeout: 25_000, maxRedirects: 5 });
        const status = response.status();
        if (status < 400) continue;
        if (isGuarded(href)) unverified.push(`${status} ${href}`);
        else failures.push(`${status} ${href}`);
      } catch (error) {
        failures.push(`threw ${(error as Error).message.slice(0, 80)} ${href}`);
      }
    }

    expect(failures, "these outbound links did not resolve").toEqual([]);

    if (unverified.length > 0) {
      console.log(`Reachable but bot-guarded, so not verified: ${unverified.join(", ")}`);
    }
  });

  test("the three GitHub Pages demos are live", async ({ request }) => {
    /* Named explicitly because these are the links most likely to be clicked
       and the most embarrassing to find broken. */
    const demos = [
      "https://finntech3.github.io/orderbook-live/",
      "https://finntech3.github.io/my-inflation/",
      "https://finntech3.github.io/rent-or-buy/",
    ];

    for (const demo of demos) {
      const response = await request.get(demo, { timeout: 25_000 });
      expect(response.status(), `${demo} is not live`).toBe(200);
    }
  });
});
