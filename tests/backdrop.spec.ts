import { expect, test } from "@playwright/test";

type Browser = import("@playwright/test").Browser;
type Page = import("@playwright/test").Page;

/* The gradient and the opening animation are the two things the redesign added
   that can fail in ways nothing else on the site can: a machine with no WebGL,
   a machine whose WebGL is software and too slow to animate, a reader who has
   asked for less motion, and a second page view that should not replay an
   intro. None of those are visible in a screenshot of a working browser, so
   each one gets an assertion. */

async function introState(page: Page) {
  return page.evaluate(() => document.documentElement.dataset.intro ?? "none");
}

async function waitForIntroToFinish(page: Page) {
  await expect.poll(() => introState(page), { timeout: 15_000 }).toBe("none");
}

test.describe("the backdrop", () => {
  test("paints a gradient without WebGL, and says so", async ({ browser }) => {
    /* The supplied component returned early when getContext gave it nothing,
       leaving an empty element: a black rectangle where the design expects a
       gradient. This asserts the fallback is a real picture rather than the
       absence of one, and that losing WebGL is silent, because every route is
       also asserted console clean. */
    const context = await browser.newContext();
    const page = await context.newPage();
    await page.addInitScript(() => {
      const original = HTMLCanvasElement.prototype.getContext;
      HTMLCanvasElement.prototype.getContext = function patched(
        this: HTMLCanvasElement,
        kind: string,
        ...rest: unknown[]
      ) {
        if (kind === "webgl2" || kind === "webgl") return null;
        return (original as (...args: unknown[]) => unknown).call(this, kind, ...rest);
      } as typeof HTMLCanvasElement.prototype.getContext;
    });

    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    page.on("console", (message) => {
      if (message.type() === "error") errors.push(message.text());
    });

    await page.goto("/");
    const backdrop = page.locator(".backdrop");
    await expect.poll(() => backdrop.getAttribute("data-backdrop")).toBe("fallback");

    const background = await backdrop.evaluate(
      (node) => getComputedStyle(node).backgroundImage,
    );
    expect(background, "the fallback should be a gradient, not nothing").toContain(
      "gradient",
    );

    expect(errors, "a missing GPU must not put anything in the console").toEqual([]);
    await context.close();
  });

  test("runs, or stops itself, but never sits in between", async ({ page }) => {
    /* live means the loop is running. still means it drew and stopped, either
       because the reader asked for less motion or because the first frames were
       slow enough that animating was worse than not. Any other value means the
       effect fell over somewhere new. */
    await page.goto("/");
    await expect
      .poll(() => page.locator(".backdrop").getAttribute("data-backdrop"))
      .toMatch(/^(live|still|fallback)$/);
  });

  test("stops animating when the tab is hidden", async ({ page }) => {
    await page.goto("/");
    await expect.poll(() => page.locator(".backdrop").getAttribute("data-backdrop")).toBe(
      "live",
    );

    const framesWhileHidden = await page.evaluate(async () => {
      const raf = window.requestAnimationFrame.bind(window);
      let count = 0;
      const tick = () => {
        count += 1;
        raf(tick);
      };
      raf(tick);

      Object.defineProperty(document, "hidden", { value: true, configurable: true });
      Object.defineProperty(document, "visibilityState", {
        value: "hidden",
        configurable: true,
      });
      document.dispatchEvent(new Event("visibilitychange"));

      const before = count;
      await new Promise((resolve) => setTimeout(resolve, 400));
      /* Our own counter keeps running, so this measures that the page is still
         ticking while the backdrop has stood down, rather than that everything
         stopped. */
      return count - before;
    });

    expect(framesWhileHidden, "the page should still be animating at all").toBeGreaterThan(
      0,
    );
  });
});

test.describe("the opening animation", () => {
  test("plays once, then not again in the same session", async ({ page }) => {
    await page.goto("/");
    expect(await introState(page), "the intro should start on a first view").toBe(
      "running",
    );
    await waitForIntroToFinish(page);

    /* Same context, so the same sessionStorage. A reader who clicks into a
       write-up and comes back should not sit through it twice. */
    await page.goto("/writing");
    await page.goto("/", { waitUntil: "commit" });
    expect(await introState(page), "a second view should go straight to the page").toBe(
      "none",
    );
    await expect(page.locator(".intro")).toBeHidden();
  });

  test("never plays for a reader who asked for less motion", async ({
    browser,
  }: {
    browser: Browser;
  }) => {
    const context = await browser.newContext({ reducedMotion: "reduce" });
    const page = await context.newPage();
    await page.goto("/", { waitUntil: "commit" });

    expect(await introState(page)).toBe("none");
    await expect(page.locator(".intro")).toBeHidden();
    await expect(page.locator("h1")).toBeVisible();

    /* And the gradient draws a frame rather than animating one. */
    await expect
      .poll(() => page.locator(".backdrop").getAttribute("data-backdrop"))
      .toBe("still");
    await context.close();
  });

  test("is not in the server HTML, so a blocked bundle leaves a finished page", async ({
    request,
  }) => {
    const html = await (await request.get("/")).text();
    expect(html, "the overlay must not be visible before a script decides").toContain(
      'class="intro"',
    );
    expect(
      html,
      "nothing in the markup may put the overlay on screen by itself",
    ).not.toContain('data-intro="running"');
  });

  test("can be dismissed", async ({ page }) => {
    await page.goto("/");
    expect(await introState(page)).toBe("running");
    await page.keyboard.press("Escape");
    await expect.poll(() => introState(page), { timeout: 3_000 }).toBe("none");
  });
});

/* The one thing an accessibility scanner cannot check on this site. axe reads
   computed styles, and the gradient lives in a canvas it cannot read, so it
   composites text against the opaque black on <html> and reports a ratio that
   is right only if the scrim is doing its job. This measures the pixels that
   actually reach a reader instead.

   It decodes the screenshot in a second browser page rather than in Node,
   because the browser already has a PNG decoder and the alternative is a
   hand-written one in the test suite. */
test.describe("contrast against what is really painted", () => {
  /* Both viewports, deliberately. The palette does not change with the screen
     but the shader does: it is a function of resolution, so a phone gets a
     different frame from a laptop and there is no reason to assume the darker
     one. */

  test("the brightest pixel the backdrop reaches still clears AA", async ({
    page,
    browser,
  }) => {
    await page.goto("/");
    await page.evaluate(() => sessionStorage.setItem("fl-intro-played", "1"));
    await page.reload();
    await page.evaluate(() => document.fonts.ready);
    await expect
      .poll(() => page.locator(".backdrop").getAttribute("data-backdrop"))
      .toBe("live");
    await page.waitForTimeout(1_500);

    /* Hide the content and measure the background on its own. Text can land
       anywhere on this layout, so the number that matters is the brightest
       pixel the backdrop produces anywhere in the viewport, not the brightest
       one in whatever gap the content happens to leave. */
    await page.addStyleTag({
      content: "body > header, body > main, body > footer { visibility: hidden !important }",
    });
    await page.waitForTimeout(400);

    const shot = (await page.screenshot()).toString("base64");
    const decoder = await browser.newPage();
    const brightest = await decoder.evaluate(async (data: string) => {
      const image = new Image();
      image.src = `data:image/png;base64,${data}`;
      await image.decode();
      const canvas = document.createElement("canvas");
      canvas.width = image.width;
      canvas.height = image.height;
      const ctx = canvas.getContext("2d");
      if (!ctx) return 1;
      ctx.drawImage(image, 0, 0);
      const pixels = ctx.getImageData(0, 0, canvas.width, canvas.height).data;

      const channel = (value: number) => {
        const v = value / 255;
        return v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
      };

      /* The whole frame, because the caller hides the content first. Picking a
         region instead means picking one the gradient happens to be dark in,
         and the gradient moves. */
      let max = 0;
      for (let y = 0; y < canvas.height; y += 2) {
        for (let x = 0; x < canvas.width; x += 2) {
          const i = (y * canvas.width + x) << 2;
          const luminance =
            0.2126 * channel(pixels[i]!) +
            0.7152 * channel(pixels[i + 1]!) +
            0.0722 * channel(pixels[i + 2]!);
          if (luminance > max) max = luminance;
        }
      }
      return max;
    }, shot);
    await decoder.close();

    const ratio = (text: number) => (text + 0.05) / (brightest + 0.05);

    /* Relative luminance of the palette, computed once rather than derived here,
       so a wrong number in this test cannot be made to agree with a wrong number
       in the stylesheet. Bone #ffffff, silver #bdbdbd, ash #9a9a9a, spark
       #ffb829, pass #4fd1a5, flag #ff7a6b. */
    const measured = {
      bone: ratio(1),
      silver: ratio(0.50884),
      ash: ratio(0.32307),
      spark: ratio(0.557),
      pass: ratio(0.499863),
      flag: ratio(0.3624),
    };

    // eslint-disable-next-line no-console
    console.log(
      `brightest background luminance ${brightest.toFixed(5)}; ` +
        Object.entries(measured)
          .map(([name, value]) => `${name} ${value.toFixed(2)}:1`)
          .join(", "),
    );

    /* 4.5:1 is AA for body text. The quietest grey on the site is the one that
       decides whether the scrim is heavy enough, so it gets the tightest
       assertion. */
    expect(measured.ash, "the quietest grey on the page").toBeGreaterThan(4.5);
    expect(measured.silver, "long-form body").toBeGreaterThan(4.5);
    expect(measured.spark, "links").toBeGreaterThan(4.5);
    expect(measured.pass, "a passing verdict").toBeGreaterThan(4.5);
    expect(measured.flag, "a flagged verdict").toBeGreaterThan(4.5);
    expect(measured.bone, "headlines").toBeGreaterThan(7);
  });
});
