import { expect, test } from "@playwright/test";

import { PUBLIC_ROUTES as pages } from "./site-routes";

/* The outbound check next door only collects a[href^='http'], so until this
   existed nothing on the site verified an internal link at all. The one that
   matters most is the CV: /cv links /finn-lakin-cv.pdf as its primary call to
   action, and that file is gitignored and written by the prebuild script, so
   it exists only if that script ran. A failed generator, or a host that stops
   firing prebuild, meant a recruiter clicked Download and got a 404 while
   every suite stayed green.

   Offline, unlike external-links.spec.ts: everything here is served by the
   site under test, so it belongs in the ordinary run rather than behind a
   network check. */
test.describe("internal links resolve", () => {
  test.skip(({ isMobile }) => Boolean(isMobile), "the markup is identical across viewports");

  test("every same-origin link on the site is served", async ({ page, request }) => {
    const found = new Set<string>();

    for (const route of pages) {
      await page.goto(route);
      const hrefs = await page
        .locator("a[href]")
        .evaluateAll((nodes) => nodes.map((node) => (node as HTMLAnchorElement).href));

      const origin = new URL(page.url()).origin;
      for (const href of hrefs) {
        const url = new URL(href);
        if (url.origin !== origin) continue;
        /* A bare fragment is a jump within the page the browser resolves
           itself; there is nothing to fetch. */
        if (url.pathname === new URL(page.url()).pathname && url.hash) continue;
        found.add(url.pathname + url.search);
      }
    }

    /* Without this the test passes by collecting nothing, which is exactly the
       failure it exists to prevent. */
    expect(found.size, "expected the site to carry internal links").toBeGreaterThan(5);
    expect(
      [...found],
      "the CV download is the link most worth checking and it was not collected",
    ).toContain("/finn-lakin-cv.pdf");

    const failures: string[] = [];
    for (const path of found) {
      const response = await request.get(path, { maxRedirects: 5 });
      if (response.status() >= 400) failures.push(`${response.status()} ${path}`);
    }

    expect(failures, "these internal links did not resolve").toEqual([]);
  });

  test("the generated CV is a real PDF, not an error page", async ({ request }) => {
    /* A 200 is not enough on its own: a misconfigured host can answer a
       missing file with an HTML error page at status 200. */
    const response = await request.get("/finn-lakin-cv.pdf");
    expect(response.status()).toBe(200);
    expect(response.headers()["content-type"]).toContain("pdf");

    const body = await response.body();
    expect(body.byteLength, "the PDF is implausibly small").toBeGreaterThan(2000);
    expect(body.subarray(0, 5).toString("latin1"), "not a PDF header").toBe("%PDF-");
  });
});
