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
  /* Buffered, then filtered by origin once the page has actually navigated.
     The origin cannot be read before goto, because the page is still on
     about:blank and guessing a port would compare against the wrong origin.

     Same origin only, because the whose-inflation piece frames a tool deployed
     from another repository. Counting what that tool loads budgets somebody
     else's bundle as this site's: 640KB against a page that ships 466KB. It
     also made the figure depend on whether the runner could reach GitHub
     Pages, so a local run and a CI run measured different things and only CI
     noticed. What this site serves is what this site answers for. */
  const seen: { url: string; javascript: boolean; length: number }[] = [];

  page.on("response", async (response) => {
    try {
      const body = await response.body();
      seen.push({
        url: response.url(),
        javascript: (response.headers()["content-type"] ?? "").includes("javascript"),
        length: body.length,
      });
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

  const origin = new URL(page.url()).origin;
  let javascriptBytes = 0;
  let totalBytes = 0;
  for (const response of seen) {
    let sameOrigin = false;
    try {
      sameOrigin = new URL(response.url).origin === origin;
    } catch {
      sameOrigin = false;
    }
    if (!sameOrigin) continue;
    totalBytes += response.length;
    if (response.javascript) javascriptBytes += response.length;
  }

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

    /* 560KB, up from 500, and the increase is the particle engine: the
       simulation, the shaders and the geometry. It is loaded only here,
       dynamically, and largest contentful paint is unchanged because the hero
       is server rendered text that does not wait for it. Every other route
       still holds the old 500KB, asserted below, so the engine cannot quietly
       leak back into a page that has no use for it.

       The number before that was 500KB, down from 600. Inlining the command
       palette instead of splitting it measured 580KB on this same page, so the
       ceiling is what stops that 122KB coming back: anything that pulls the
       panel into the first-load
       bundle again fails here rather than quietly shipping. */
    expect(result.javascriptBytes / 1024, "uncompressed JavaScript, KB").toBeLessThan(560);

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
       anybody noticing.

       The embed is stubbed with a deliberately enormous script. That does two
       things: it makes the measurement identical here and on a runner that can
       actually reach GitHub Pages, and it proves the same-origin filter is
       doing something rather than being asserted in a comment. Without the
       filter this page measured 640KB, because the framed tool's bundle was
       being counted as this site's. */
    const PADDING = 400_000;
    await context.route("https://finntech3.github.io/**", (route) =>
      route.request().url().endsWith(".js")
        ? route.fulfill({
            status: 200,
            contentType: "application/javascript",
            body: `/*${"x".repeat(PADDING)}*/`,
          })
        : route.fulfill({
            status: 200,
            contentType: "text/html",
            body: `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>stub</title>
              <script src="https://finntech3.github.io/stub-bundle.js"></script></head>
              <body><main><p>stub</p></main></body></html>`,
          }),
    );

    const home = await measure(page, "/");
    const second = await context.newPage();
    const piece = await measure(second, "/writing/whose-inflation");

    const frameLoaded = second.frames().length > 1;
    await second.close();

    /* Still 500. A write-up has no particle engine and must never download
       one: before this was split per route it was shipping the whole thing to
       render an essay. */
    expect(piece.javascriptBytes / 1024, "write-up JavaScript, KB").toBeLessThan(500);
    expect(piece.cls, "write-up layout shift").toBeLessThan(0.05);
    expect(piece.javascriptBytes).toBeLessThanOrEqual(home.javascriptBytes);

    /* If the frame never loaded, the assertions above passed without the
       filter ever being exercised, which is the failure mode this whole test
       exists to avoid. */
    expect(frameLoaded, "the embed never loaded, so nothing was filtered").toBe(true);
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

/* What the page does when its fonts land late, which the budget above cannot
   say.

   Every test above loads the fonts instantly, because the server is on the same
   machine, so each measures a page whose fonts were there at first paint: a
   layout shift of nought whatever stands in for them. A reader on a slow
   connection sees the page painted in the stand-ins and then swapped, and a swap
   that changes how any text wraps moves everything under it. On a 393 by 727
   phone with the files two and a half seconds late that was 0.195, which is
   nearly four times the budget, from the two labels at the top of the hero (one
   line in the stand-in, two in the real face), a standfirst that lost a line,
   and measures in ch that are a different width in two faces.

   Run on both projects, because the phone is where it was worst. */
test.describe("late fonts", () => {
  const DELAY_MS = 2_500;

  /* Not the 0.05 the budget allows. With the stand-ins in place a swap is
     measured in ten thousandths here, so this leaves twenty times that for noise
     and still fails on any line that wraps differently. The case a looser bar
     would miss is a stand-in that is wrong on a machine with Arial, which
     measured 0.024 on the phone: inside the budget, and a visible jump. */
  const CEILING = 0.01;

  type Shift = PerformanceEntry & { value: number; hadRecentInput: boolean };

  test("the page does not move when its fonts land after it has painted", async ({ page }) => {
    await page.addInitScript(() => {
      sessionStorage.setItem("fl-intro-played", "1");
      const store = window as unknown as { __shift: number };
      store.__shift = 0;
      new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          const shift = entry as Shift;
          if (!shift.hadRecentInput) store.__shift += shift.value;
        }
      }).observe({ type: "layout-shift", buffered: true });
    });

    let held = 0;
    await page.route(/\/_next\/static\/media\/.*\.woff2/, async (route) => {
      held += 1;
      await new Promise((resolve) => setTimeout(resolve, DELAY_MS));
      await route.continue();
    });

    /* Waits for the load event, which waits for the preloaded fonts: the swap has
       happened by the time this returns. */
    await page.goto("/?brainQuality=off", { waitUntil: "load" });
    await page.evaluate(() => document.fonts.ready);
    await page.waitForTimeout(1_000);

    const result = await page.evaluate(() => ({
      shift: (window as unknown as { __shift: number }).__shift,
      firstPaint: performance.getEntriesByName("first-contentful-paint")[0]?.startTime ?? -1,
    }));

    /* The two things that make the number mean something. A font that was never
       held back, or a page that did not paint until the fonts had landed, would
       report nought for a reason that has nothing to do with the stand-ins. */
    expect(held, "no font file was held back, so nothing was late").toBeGreaterThan(0);
    expect(
      result.firstPaint,
      "the page had not painted before the fonts landed, so no swap was measured",
    ).toBeGreaterThan(0);
    expect(result.firstPaint, "the page waited for its fonts before it painted").toBeLessThan(
      DELAY_MS,
    );

    console.log(`late fonts: layout shift ${result.shift.toFixed(4)}, first paint ${Math.round(result.firstPaint)}ms`);
    expect(result.shift, "layout shift when the fonts arrive").toBeLessThan(CEILING);
  });

  /* next/font generates a stand-in of its own for the reading face, and the
     option that turns it off is not honoured by this bundler. The stand-in this
     site means is the one written in globals.css under the same name, and it
     replaces the generated one only by coming after it with the same
     descriptors. That depends on a name and an order, so it is asserted: if
     either changes, the generated one wins quietly, and on any machine with
     Arial the labels are a quarter too wide until the real face lands. This
     cannot be seen as a layout shift on a machine without Arial, which is why it
     is asserted directly. */
  test("the stand-in for the reading face is the one this site wrote", async ({ page }) => {
    await page.goto("/");

    const { rules, family } = await page.evaluate(() => {
      const found: string[] = [];
      for (const sheet of Array.from(document.styleSheets)) {
        for (const rule of Array.from(sheet.cssRules)) {
          if (rule instanceof CSSFontFaceRule && rule.cssText.includes("Martian Mono Fallback")) {
            found.push(rule.cssText);
          }
        }
      }
      return {
        rules: found,
        family: getComputedStyle(document.documentElement).getPropertyValue("--font-martian"),
      };
    });

    /* The name the generated stand-in actually has, read from the variable that
       puts it in the font stack. If a bundler change renames it, the hand made
       one would still be declared and would replace nothing. */
    expect(
      family,
      "the generated stand-in is no longer called Martian Mono Fallback; rename the one in globals.css",
    ).toContain("Martian Mono Fallback");
    expect(rules.length, "no stand-in for the reading face is declared at all").toBeGreaterThan(0);
    expect(
      rules.at(-1),
      "the last stand-in declared under the generated name is not the hand made one",
    ).toMatch(/size-adjust:\s*119%/);
  });
});
