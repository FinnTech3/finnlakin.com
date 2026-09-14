import { expect, test } from "@playwright/test";

import { PUBLIC_ROUTES as routes } from "./site-routes";

test.describe("security headers", () => {
  test.skip(({ isMobile }) => Boolean(isMobile), "not viewport dependent");

  test("every response carries the policy set", async ({ request }) => {
    const response = await request.get("/");
    const headers = response.headers();

    expect(headers["content-security-policy"]).toContain("frame-ancestors 'none'");
    expect(headers["content-security-policy"]).toContain("object-src 'none'");
    expect(headers["content-security-policy"]).toContain("base-uri 'self'");
    expect(headers["content-security-policy"]).toContain("form-action 'self'");
    expect(headers["strict-transport-security"]).toContain("max-age=63072000");
    expect(headers["x-content-type-options"]).toBe("nosniff");
    expect(headers["x-frame-options"]).toBe("DENY");
    expect(headers["referrer-policy"]).toBe("strict-origin-when-cross-origin");
    expect(headers["permissions-policy"]).toContain("geolocation=()");

    /* Advertising the framework and its version helps nobody but a scanner. */
    expect(headers["x-powered-by"]).toBeUndefined();
  });

  for (const route of routes) {
    test(`${route} triggers no CSP violation`, async ({ page }) => {
      /* The rule is never to enforce a policy that has not been observed
         passing. This is that observation: the browser reports every blocked
         resource or inline block through securitypolicyviolation, so a policy
         that breaks the page fails here rather than in production. */
      const violations: string[] = [];
      await page.addInitScript(() => {
        (window as unknown as { __csp: string[] }).__csp = [];
        document.addEventListener("securitypolicyviolation", (event) => {
          (window as unknown as { __csp: string[] }).__csp.push(
            `${event.violatedDirective} blocked ${event.blockedURI}`,
          );
        });
      });

      await page.goto(route);
      await page.evaluate(() => document.fonts.ready);
      await page.waitForTimeout(600);

      violations.push(
        ...(await page.evaluate(() => (window as unknown as { __csp: string[] }).__csp)),
      );
      expect(violations, `${route} violated its own policy`).toEqual([]);
    });
  }
});

test.describe("navigation affordances", () => {
  test("the skip link is the first thing a keyboard reaches, and it works", async ({ page }) => {
    await page.goto("/");
    await page.keyboard.press("Tab");

    const focused = page.locator(":focus");
    await expect(focused).toHaveText("Skip to content");
    await expect(focused).toBeVisible();

    await page.keyboard.press("Enter");
    await expect(page).toHaveURL(/#main$/);
    await expect(page.locator("main#main")).toBeVisible();
  });

  for (const route of ["/", "/writing", "/cv"]) {
    test(`${route} marks exactly one nav item as current`, async ({ page }) => {
      await page.goto(route);
      const current = page.locator('nav[aria-label="Main"] a[aria-current="page"]');
      await expect(current).toHaveCount(1);
    });
  }

  test("section anchors keep clear of the viewport edge", async ({ page }) => {
    await page.goto("/");
    const margin = await page
      .locator("section#work")
      .evaluate((node) => getComputedStyle(node).scrollMarginTop);
    expect(Number.parseFloat(margin)).toBeGreaterThan(0);
  });
});

test.describe("the embedded tool", () => {
  test.skip(({ isMobile }) => Boolean(isMobile), "not viewport dependent");

  /* The a11y scan excuses what is inside this frame because it is another
     repository's deploy. What is on this side of the boundary is still this
     site's, and it is asserted here rather than left to axe. */
  test("carries a name, defers its load, and works if the frame never arrives", async ({
    page,
  }) => {
    await page.goto("/writing/whose-inflation");

    const frame = page.locator('iframe[src^="https://finntech3.github.io"]');
    await expect(frame).toHaveCount(1);
    await expect(frame).toHaveAttribute("loading", "lazy");

    const title = await frame.getAttribute("title");
    expect(title?.trim().length ?? 0).toBeGreaterThan(3);

    /* A frame can be blocked by an extension, a policy or a dead host, so the
       piece has to carry the reader out to the tool without it. */
    const linkOut = page.locator('figure a[href^="https://finntech3.github.io/my-inflation"]');
    await expect(linkOut).toHaveCount(1);
    await expect(linkOut).toBeVisible();
  });
});

test.describe("icons and manifest", () => {
  test.skip(({ isMobile }) => Boolean(isMobile), "not viewport dependent");

  test("the manifest is served and points at real icons", async ({ request }) => {
    const response = await request.get("/manifest.webmanifest");
    expect(response.status()).toBe(200);

    const manifest = await response.json();
    expect(manifest.name).toBe("Finn Lakin");
    expect(manifest.icons.length).toBeGreaterThan(0);

    for (const icon of manifest.icons) {
      const file = await request.get(icon.src);
      expect(file.status(), `${icon.src} is missing`).toBe(200);
      expect(file.headers()["content-type"]).toContain("image/png");
    }
  });

  test("the favicon is a real ICO holding RGBA PNGs", async ({ request }) => {
    /* A palette-quantised ico fails the Next build outright, so this asserts
       what is actually inside the container rather than that a file exists. */
    const response = await request.get("/favicon.ico");
    expect(response.status()).toBe(200);

    const body = await response.body();
    expect(body.readUInt16LE(0)).toBe(0);
    expect(body.readUInt16LE(2), "should be an icon, not a cursor").toBe(1);

    const count = body.readUInt16LE(4);
    expect(count).toBeGreaterThanOrEqual(3);

    for (let index = 0; index < count; index += 1) {
      const entry = 6 + index * 16;
      expect(body.readUInt16LE(entry + 6), "expected 32 bits per pixel").toBe(32);
      const offset = body.readUInt32LE(entry + 12);
      expect(
        body.subarray(offset + 1, offset + 4).toString("latin1"),
        "each image should be a PNG",
      ).toBe("PNG");
    }
  });

  test("the theme colour resolves for both colour schemes", async ({ page }) => {
    await page.goto("/");
    const light = page.locator('meta[name="theme-color"][media*="light"]');
    const dark = page.locator('meta[name="theme-color"][media*="dark"]');
    await expect(light).toHaveAttribute("content", "#f7f7f4");
    await expect(dark).toHaveAttribute("content", "#101215");
  });
});
