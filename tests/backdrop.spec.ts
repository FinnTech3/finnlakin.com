import { expect, test } from "@playwright/test";

type Browser = import("@playwright/test").Browser;
type Page = import("@playwright/test").Page;

/* The key the opening animation writes so it plays once a session. Tests that
   are not about the intro set it to get straight to the page. */
const INTRO_KEY = "fl-intro-played";

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

/* The constellation. It is decoration, so none of this is about what it looks
   like: it is about the three ways a background canvas can go wrong without
   anybody noticing. It can fail to paint at all, it can keep painting forever
   after it has scrolled out of sight, and it can keep moving for a reader who
   asked it not to. */
test.describe("the constellation", () => {
  /* Counts the pixels the constellation has actually painted, optionally only
     those within a radius of a point. Reading the canvas directly rather than
     diffing screenshots, because the field drifts: any two frames differ, so a
     pixel diff would pass whatever happened. */
  async function painted(page: Page, near?: { x: number; y: number; radius: number }) {
    return page.evaluate((spot) => {
      const canvas = document.querySelector<HTMLCanvasElement>("[data-brain]");
      const ctx = canvas?.getContext("2d");
      if (!canvas || !ctx || canvas.width === 0) return -1;
      const scale = canvas.width / Math.max(1, canvas.clientWidth);
      const pixels = ctx.getImageData(0, 0, canvas.width, canvas.height).data;

      /* The spot arrives in page coordinates. The canvas is an element in the
         layout now rather than a fixed sheet over the viewport, so it has to be
         moved into the canvas's own box before it means anything. */
      const box = canvas.getBoundingClientRect();
      let count = 0;
      const cx = spot ? (spot.x - box.left) * scale : 0;
      const cy = spot ? (spot.y - box.top) * scale : 0;
      const r2 = spot ? (spot.radius * scale) ** 2 : 0;
      for (let y = 0; y < canvas.height; y += 2) {
        for (let x = 0; x < canvas.width; x += 2) {
          if (pixels[((y * canvas.width + x) << 2) + 3]! < 8) continue;
          if (spot && (x - cx) ** 2 + (y - cy) ** 2 > r2) continue;
          count += 1;
        }
      }
      return count;
    }, near);
  }

  test("paints behind the opening screen", async ({ page }) => {
    await page.goto("/");
    await page.evaluate((key) => sessionStorage.setItem(key, "1"), INTRO_KEY);
    await page.reload();
    await page.evaluate(() => document.fonts.ready);
    await page.waitForTimeout(2_500);

    expect(
      await painted(page),
      "the constellation should have particles on screen",
    ).toBeGreaterThan(2_000);
  });

  test("stops animating once it has scrolled out of view", async ({ page }) => {
    await page.goto("/");
    await page.evaluate((key) => sessionStorage.setItem(key, "1"), INTRO_KEY);
    await page.reload();
    await page.waitForTimeout(2_000);
    expect(await painted(page)).toBeGreaterThan(2_000);

    /* The cloud lives in the hero's second column now, so it scrolls away with
       the page rather than being faded out by hand. What has to be true is that
       it stops costing anything once it is gone: the frame loop is parked by an
       IntersectionObserver, so two reads a second apart are identical. */
    await page.evaluate(() => window.scrollTo(0, 2_400));
    await page.waitForTimeout(700);
    const first = await painted(page);
    await page.waitForTimeout(1_000);
    expect(
      await painted(page),
      "the loop should be parked while the cloud is off screen",
    ).toBe(first);

    /* And picks up again on the way back, unless the machine was too slow to
       animate in the first place: the guard stops the loop for good, which is
       the designed behaviour. Both branches assert something. */
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.waitForTimeout(1_200);
    const resumed = await painted(page);
    await page.waitForTimeout(700);
    const again = await painted(page);

    const state = await page
      .locator("[data-constellation]")
      .getAttribute("data-constellation");
    if (state === "live") {
      expect(again, "and should start again once it is back in view").not.toBe(resumed);
    } else {
      expect(again, "a stopped loop should hold its finished picture").toBe(resumed);
      expect(again, "and that picture should not be blank").toBeGreaterThan(2_000);
    }
  });

  test("turns towards the pointer, and settles back", async ({ page }) => {
    await page.goto("/");
    await page.evaluate((key) => sessionStorage.setItem(key, "1"), INTRO_KEY);
    await page.reload();
    await page.evaluate(() => document.fonts.ready);
    await page.waitForTimeout(2_500);

    await page.locator("[data-constellation]").scrollIntoViewIfNeeded();
    await page.waitForTimeout(600);
    const box = await page.locator("[data-constellation]").boundingBox();
    if (!box) throw new Error("the constellation is not on the page");

    /* Where the mass sits, left to right, as a fraction between nought and one.
       The cloud is a solid turning in three dimensions rather than a field being
       pushed about, so the thing to measure is which way it is facing, not
       whether a hole opened where the cursor is. */
    const balance = () =>
      page.evaluate(() => {
        const canvas = document.querySelector<HTMLCanvasElement>("[data-brain]");
        const ctx = canvas?.getContext("2d");
        if (!canvas || !ctx || canvas.width === 0) return -1;
        const pixels = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
        let weighted = 0;
        let total = 0;
        for (let y = 0; y < canvas.height; y += 2) {
          for (let x = 0; x < canvas.width; x += 2) {
            if (pixels[((y * canvas.width + x) << 2) + 3]! < 10) continue;
            weighted += x;
            total += 1;
          }
        }
        return total === 0 ? -1 : weighted / total / canvas.width;
      });

    const state = await page
      .locator("[data-constellation]")
      .getAttribute("data-constellation");

    const middleY = Math.round(box.y + box.height / 2);
    await page.mouse.move(Math.round(box.x + box.width * 0.06), middleY);
    await page.waitForTimeout(900);
    const left = await balance();

    await page.mouse.move(Math.round(box.x + box.width * 0.94), middleY);
    await page.waitForTimeout(900);
    const right = await balance();

    expect(left, "the cloud should be on screen to measure").toBeGreaterThan(0);
    expect(right, "the cloud should be on screen to measure").toBeGreaterThan(0);

    /* A machine too slow to animate stops the loop and keeps a still, which is
       the designed behaviour: there is nothing left to turn. Both branches
       assert something, so neither can go quietly green. */
    if (state !== "live") {
      expect(right, "a stopped loop should hold its picture still").toBeCloseTo(left, 3);
      return;
    }

    expect(
      Math.abs(right - left),
      "the cloud should visibly turn between one side and the other",
    ).toBeGreaterThan(0.004);
  });

  test("holds still for a reader who asked for less motion", async ({ browser }) => {
    const context = await browser.newContext({ reducedMotion: "reduce" });
    const page = await context.newPage();
    await page.goto("/");
    await page.waitForTimeout(1_200);

    const first = await painted(page);
    expect(first, "a still frame is still a frame").toBeGreaterThan(1_000);

    /* Same count twice, a second apart. A drifting field would not hold. */
    await page.waitForTimeout(1_000);
    expect(await painted(page)).toBe(first);
    await context.close();
  });
});
/* The one thing an accessibility scanner cannot check on this site.

   axe reads computed styles. The gradient and the particle cloud both live in
   canvases it cannot read, so it composites text against the opaque black on
   <html> and reports a ratio that is only right if nothing decorative is
   painted between them. This measures the pixels that actually reach a reader.

   It used to take the brightest pixel anywhere in the viewport with the content
   hidden, which was the right test when everything decorative sat under a
   scrim. It is the wrong test now. The particle cloud is painted above the
   scrim so that its colours run at full strength, and in the opening screen it
   occupies the half of the page that has no text in it: a measurement over the
   whole viewport would fail on pixels no word will ever sit on, and the only
   way to pass it would be to dim the cloud everywhere.

   So this measures contrast where the text actually is. Every element carrying
   text is located, the content is hidden, and the brightest background pixel
   inside each element's own box is compared against that element's own colour.
   It is a stricter test in the place that matters and it says nothing about the
   places that do not. */

type TextBox = {
  x: number;
  y: number;
  width: number;
  height: number;
  colour: [number, number, number];
  large: boolean;
  label: string;
};

/* Eight samples across the six section timeline. The cloud moves, disperses,
   reforms and changes brightness as the page scrolls, so one position proves
   nothing about the others. */
const SAMPLE_POINTS = [0, 0.5, 1, 2, 3, 4, 5, 6];

function relativeLuminance(rgb: [number, number, number]) {
  const channel = (value: number) => {
    const v = value / 255;
    return v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * channel(rgb[0]) + 0.7152 * channel(rgb[1]) + 0.0722 * channel(rgb[2]);
}

test.describe("contrast where the words actually are", () => {
  test("every run of text clears AA against the pixels behind it", async ({
    page,
    browser,
  }) => {
    test.slow();

    await page.goto("/");
    await page.evaluate((key) => sessionStorage.setItem(key, "1"), INTRO_KEY);
    await page.reload();
    await page.evaluate(() => document.fonts.ready);
    await expect
      .poll(() => page.locator(".backdrop").getAttribute("data-backdrop"))
      .toBe("live");

    const decoder = await browser.newPage();
    const worst: { ratio: number; label: string; at: number }[] = [];

    for (const point of SAMPLE_POINTS) {
      await page.evaluate((target) => {
        const ids = ["hero", "work", "about", "timeline", "skills", "endorsements", "contact"];
        const tops = ids.map((id) => {
          const element = document.getElementById(id);
          return element ? element.getBoundingClientRect().top + window.scrollY : 0;
        });
        const index = Math.min(tops.length - 2, Math.floor(target));
        const fraction = target - index;
        window.scrollTo(0, tops[index]! + (tops[index + 1]! - tops[index]!) * fraction);
      }, point);

      /* Long enough for the eased timeline to arrive and for the spring to
         settle, because the transient between two states is brighter than
         either of them. */
      await page.waitForTimeout(2_500);

      const boxes: TextBox[] = await page.evaluate(() => {
        const found: TextBox[] = [];
        const view = { width: window.innerWidth, height: window.innerHeight };

        for (const element of Array.from(document.body.querySelectorAll<HTMLElement>("*"))) {
          /* Only elements that carry their own words. A wrapper's box covers
             its children's whitespace, which would measure background that no
             glyph sits on. */
          const own = Array.from(element.childNodes).some(
            (node) => node.nodeType === Node.TEXT_NODE && (node.textContent ?? "").trim().length > 1,
          );
          if (!own) continue;

          const style = getComputedStyle(element);
          if (style.visibility === "hidden" || style.display === "none") continue;
          if (Number.parseFloat(style.opacity) < 0.95) continue;

          const box = element.getBoundingClientRect();
          if (box.width < 4 || box.height < 4) continue;
          if (box.bottom <= 0 || box.top >= view.height) continue;

          const match = style.color.match(/-?\d+(\.\d+)?/g);
          if (!match || match.length < 3) continue;
          const colour: [number, number, number] = [
            Number(match[0]),
            Number(match[1]),
            Number(match[2]),
          ];
          if (match.length > 3 && Number(match[3]) < 0.95) continue;

          const size = Number.parseFloat(style.fontSize);
          const weight = Number.parseInt(style.fontWeight, 10) || 400;
          /* The WCAG definition of large text, which is allowed 3:1. */
          const large = size >= 24 || (size >= 18.66 && weight >= 700);

          found.push({
            x: Math.max(0, box.left),
            y: Math.max(0, box.top),
            width: Math.min(view.width, box.right) - Math.max(0, box.left),
            height: Math.min(view.height, box.bottom) - Math.max(0, box.top),
            colour,
            large,
            label: (element.textContent ?? "").trim().slice(0, 40),
          });
        }
        return found;
      });

      expect(boxes.length, `no text found at section progress ${point}`).toBeGreaterThan(0);

      await page.addStyleTag({
        content: "body > header, body > main, body > footer { visibility: hidden !important }",
      });
      const shot = (await page.screenshot()).toString("base64");
      /* Put it back, or the next sample measures a page with no text on it. */
      await page.evaluate(() => {
        const sheets = Array.from(document.head.querySelectorAll("style"));
        const last = sheets[sheets.length - 1];
        if (last && last.textContent?.includes("visibility: hidden")) last.remove();
      });

      const brightest: number[] = await decoder.evaluate(
        async ({ data, regions }: { data: string; regions: TextBox[] }) => {
          const image = new Image();
          image.src = `data:image/png;base64,${data}`;
          await image.decode();
          const canvas = document.createElement("canvas");
          canvas.width = image.width;
          canvas.height = image.height;
          const ctx = canvas.getContext("2d");
          if (!ctx) return regions.map(() => 1);
          ctx.drawImage(image, 0, 0);
          const pixels = ctx.getImageData(0, 0, canvas.width, canvas.height).data;

          const channel = (value: number) => {
            const v = value / 255;
            return v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
          };

          return regions.map((region) => {
            const x0 = Math.max(0, Math.floor(region.x));
            const y0 = Math.max(0, Math.floor(region.y));
            const x1 = Math.min(canvas.width, Math.ceil(region.x + region.width));
            const y1 = Math.min(canvas.height, Math.ceil(region.y + region.height));
            let max = 0;
            for (let y = y0; y < y1; y++) {
              for (let x = x0; x < x1; x++) {
                const i = (y * canvas.width + x) << 2;
                const luminance =
                  0.2126 * channel(pixels[i]!) +
                  0.7152 * channel(pixels[i + 1]!) +
                  0.0722 * channel(pixels[i + 2]!);
                if (luminance > max) max = luminance;
              }
            }
            return max;
          });
        },
        { data: shot, regions: boxes },
      );

      boxes.forEach((box, index) => {
        const background = brightest[index] ?? 1;
        const text = relativeLuminance(box.colour);
        const lighter = Math.max(text, background);
        const darker = Math.min(text, background);
        const ratio = (lighter + 0.05) / (darker + 0.05);
        const floor = box.large ? 3 : 4.5;

        if (ratio < floor + 1.5) {
          worst.push({ ratio, label: box.label, at: point });
        }

        expect(
          ratio,
          `"${box.label}" at section progress ${point} sits on background ` +
            `luminance ${background.toFixed(4)}`,
        ).toBeGreaterThanOrEqual(floor);
      });
    }

    await decoder.close();

    worst.sort((a, b) => a.ratio - b.ratio);
    console.log(
      "tightest contrast ratios: " +
        (worst.length === 0
          ? "none within 1.5 of the floor"
          : worst
              .slice(0, 6)
              .map((entry) => `${entry.ratio.toFixed(2)}:1 at ${entry.at} ("${entry.label}")`)
              .join("; ")),
    );
  });
});
