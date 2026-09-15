import { gzipSync } from "node:zlib";

import { expect, test } from "@playwright/test";

type Measurement = {
  lcp: number;
  cls: number;
  javascriptBytes: number;
  totalBytes: number;
};

async function measure(
  page: import("@playwright/test").Page,
  route: string,
): Promise<Measurement> {
  let javascriptBytes = 0;
  let totalBytes = 0;

  page.on("response", async (response) => {
    try {
      const body = await response.body();
      totalBytes += body.length;
      if ((response.headers()["content-type"] ?? "").includes("javascript")) {
        javascriptBytes += body.length;
      }
    } catch {
      /* redirects and cached responses have no retrievable body */
    }
  });

  await page.goto(route, { waitUntil: "load" });
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(1500);

  const vitals = await page.evaluate(
    () =>
      new Promise<{ lcp: number; cls: number }>((resolve) => {
        let lcp = 0;
        let cls = 0;
        new PerformanceObserver((list) => {
          for (const entry of list.getEntries()) lcp = entry.startTime;
        }).observe({ type: "largest-contentful-paint", buffered: true });
        new PerformanceObserver((list) => {
          for (const entry of list.getEntries()) {
            const shift = entry as PerformanceEntry & { value: number; hadRecentInput: boolean };
            if (!shift.hadRecentInput) cls += shift.value;
          }
        }).observe({ type: "layout-shift", buffered: true });
        setTimeout(() => resolve({ lcp: Math.round(lcp), cls }), 300);
      }),
  );

  return { ...vitals, javascriptBytes, totalBytes };
}

/* Budgets sit above what the site currently measures, with headroom. They
   exist to catch a regression, not to record a personal best. */
test.describe("performance budget", () => {
  test.skip(({ isMobile }) => Boolean(isMobile), "measured on one engine");

  test("the home page, which is the heaviest, stays inside budget", async ({ page }) => {
    const result = await measure(page, "/");

    expect(result.lcp, "largest contentful paint").toBeLessThan(1500);
    expect(result.cls, "cumulative layout shift").toBeLessThan(0.05);

    /* 500KB, down from 600. Inlining the command palette instead of splitting
       it measured 580KB on this same page, so this ceiling is what stops that
       122KB coming back: anything that pulls the panel into the first-load
       bundle again fails here rather than quietly shipping. */
    expect(result.javascriptBytes / 1024, "uncompressed JavaScript, KB").toBeLessThan(500);

    console.log(
      `home: LCP ${result.lcp}ms, CLS ${result.cls}, ` +
        `${(result.javascriptBytes / 1024).toFixed(0)}KB JS, ` +
        `${(result.totalBytes / 1024).toFixed(0)}KB total`,
    );
  });

  test("the document itself stays inside budget", async ({ page }) => {
    /* JavaScript was the only thing budgeted, and the home page ships 158KB of
       HTML: ten project cards plus the flight payload that repeats them. That
       is the largest single response on the site and nothing was watching it.

       Compressed size is computed here rather than read off content-length.
       `next start` serves these uncompressed, so the header would report the
       raw size and a transfer budget against it would be measuring the test
       server rather than the site. Gzipping the body gives a figure that does
       not depend on what the local server happens to do. */
    for (const route of ["/", "/writing/nanobook"]) {
      const response = await page.goto(route);
      const body = await response!.body();
      const compressed = gzipSync(body).length;

      console.log(
        `${route}: ${(body.length / 1024).toFixed(0)}KB HTML, ` +
          `${(compressed / 1024).toFixed(0)}KB gzipped`,
      );

      expect(body.length / 1024, `${route} uncompressed HTML, KB`).toBeLessThan(220);
      expect(compressed / 1024, `${route} gzipped HTML, KB`).toBeLessThan(40);
    }
  });

  test("a write-up is lighter than the home page, not heavier", async ({ page, context }) => {
    /* The budget above only covers the home page. A write-up carries charts,
       an embed and long prose, so it is the route most likely to grow without
       anybody noticing. */
    const home = await measure(page, "/");
    const second = await context.newPage();
    const piece = await measure(second, "/writing/whose-inflation");
    await second.close();

    expect(piece.javascriptBytes / 1024, "write-up JavaScript, KB").toBeLessThan(500);
    expect(piece.cls, "write-up layout shift").toBeLessThan(0.05);
    expect(piece.javascriptBytes).toBeLessThanOrEqual(home.javascriptBytes);
  });

  test("charts cost nothing on the client", async ({ page, context }) => {
    /* The write-up carries a chart and the CV does not. Server-rendered HTML
       and CSS means the two ship the same JavaScript; a chart library would
       show up here immediately. */
    const withChart = await measure(page, "/writing/marked-to-model");

    const second = await context.newPage();
    const withoutChart = await measure(second, "/cv");
    await second.close();

    expect(withChart.javascriptBytes).toBeLessThanOrEqual(withoutChart.javascriptBytes);
  });

  test("the palette is not in the first-load bundle", async ({ page }) => {
    /* The saving only exists while the panel stays out of the initial load, so
       assert the shape directly rather than trusting the byte ceiling alone:
       nothing should fetch the panel chunk until someone reaches for it. */
    const chunks: string[] = [];
    page.on("response", (response) => {
      if (response.url().includes("/_next/static/chunks/")) chunks.push(response.url());
    });

    await page.goto("/");
    await page.evaluate(() => document.fonts.ready);
    await page.waitForTimeout(1500);
    const beforeOpen = chunks.length;

    await page.getByRole("button", { name: /search/i }).click();
    await expect(page.getByRole("dialog", { name: "Search this site" })).toBeVisible();
    await page.waitForTimeout(500);

    expect(
      chunks.length,
      "opening the palette should fetch a chunk that was not loaded before",
    ).toBeGreaterThan(beforeOpen);
  });
});
