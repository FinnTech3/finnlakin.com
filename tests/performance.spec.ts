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
    expect(result.javascriptBytes / 1024, "uncompressed JavaScript, KB").toBeLessThan(600);

    console.log(
      `home: LCP ${result.lcp}ms, CLS ${result.cls}, ` +
        `${(result.javascriptBytes / 1024).toFixed(0)}KB JS, ` +
        `${(result.totalBytes / 1024).toFixed(0)}KB total`,
    );
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
});
