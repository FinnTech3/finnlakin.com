import { expect, test } from "@playwright/test";

import { PUBLIC_ROUTES as pages } from "./site-routes";

/* This one talks to the real internet, which is why it is its own file: a
   recruiter clicking a dead demo is the failure this prevents, and it cannot
   be caught offline. Run it before launching and whenever a link changes. */
test.describe("external links resolve", () => {
  test.skip(({ isMobile }) => Boolean(isMobile), "network check, once is enough");
  test.describe.configure({ timeout: 240_000 });

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

    /* Render's free tier spins the demo down when idle and takes roughly
       forty-five seconds to wake, which the project card already tells the
       reader. A 25s ceiling therefore failed a link that works, so this host
       gets long enough to actually wake up. The timeout is raised rather than
       the check excused: if it cannot answer inside seventy seconds, the
       recruiter clicking it has a dead link, and this should say so. */
    const slowToWake = [/^https:\/\/[a-z0-9-]+\.onrender\.com\//];
    const timeoutFor = (href: string) =>
      slowToWake.some((pattern) => pattern.test(href)) ? 70_000 : 25_000;

    const failures: string[] = [];
    const unverified: string[] = [];

    for (const href of found) {
      try {
        const response = await request.get(href, {
          timeout: timeoutFor(href),
          maxRedirects: 5,
        });
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
