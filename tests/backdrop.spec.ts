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
    /* The engine is loaded on demand now, so the listener that hears this is
       attached a moment after the attribute is set. Pressing before it arrives
       tests nothing. */
    await expect
      .poll(() => page.locator("[data-brain]").getAttribute("data-brain"), { timeout: 20_000 })
      .toBe("live");
    await page.keyboard.press("Escape");
    /* Running, then ending while the veil fades, then gone. */
    await expect.poll(() => introState(page), { timeout: 6_000 }).toBe("none");
  });
});


/* The particle engine. None of this is about what it looks like, which is a
   judgement nobody should delegate to a test. It is about the ways a
   background canvas can go wrong without anybody noticing: it can fail to
   paint, it can keep painting in a tab nobody is looking at, it can keep
   moving for a reader who asked it not to, and it can quietly swallow the
   clicks, selections and keystrokes meant for the page underneath it. */
test.describe("the particle engine", () => {
  /* Counts the pixels the engine has actually painted, by decoding a
     screenshot of its canvas.

     Not by reading the drawing buffer, which was the first attempt and which
     silently returns nothing: asking an element for a context a second time
     hands back the one it already has and ignores the attributes, so
     preserveDrawingBuffer never took effect and readPixels saw a buffer the
     compositor had already cleared. It reported zero lit pixels for a cloud
     that was plainly on screen. */
  async function painted(page: Page) {
    const canvas = page.locator("[data-brain] canvas");
    if ((await canvas.count()) === 0) return -1;
    const shot = (await canvas.screenshot()).toString("base64");
    return page.evaluate(async (data: string) => {
      const image = new Image();
      image.src = `data:image/png;base64,${data}`;
      await image.decode();
      const sheet = document.createElement("canvas");
      sheet.width = image.width;
      sheet.height = image.height;
      const ctx = sheet.getContext("2d");
      if (!ctx) return -1;
      ctx.drawImage(image, 0, 0);
      const pixels = ctx.getImageData(0, 0, sheet.width, sheet.height).data;
      let lit = 0;
      for (let i = 0; i < pixels.length; i += 16) {
        if (pixels[i]! + pixels[i + 1]! + pixels[i + 2]! > 24) lit += 1;
      }
      return lit;
    }, shot);
  }

  async function settled(page: Page) {
    await page.evaluate((key) => sessionStorage.setItem(key, "1"), INTRO_KEY);
    await page.reload();
    await page.evaluate(() => document.fonts.ready);
    await expect
      .poll(() => page.locator("[data-brain]").getAttribute("data-brain"), { timeout: 20_000 })
      .toBe("live");
    await page.waitForTimeout(2_500);
  }

  test("paints, and says which quality level it settled on", async ({ page }) => {
    await page.goto("/?brainQuality=low");
    await settled(page);
    expect(await painted(page), "the cloud painted nothing at all").toBeGreaterThan(200);
  });

  test("moves on its own, and keeps moving as the page scrolls", async ({ page }) => {
    await page.goto("/?brainQuality=low");
    await settled(page);

    /* The simulation is a spring, so a settled cloud still drifts: the pyramids
       rotate on noise and the camera parallaxes. Two frames a second apart must
       not be identical, or nothing is running. */
    const shot = async () =>
      (await page.locator("[data-brain] canvas").screenshot()).toString("base64");
    const first = await shot();
    await page.waitForTimeout(900);
    expect(await shot(), "the cloud is frozen").not.toBe(first);

    /* And the timeline actually responds to the page moving under it. */
    await page.evaluate(() => {
      const work = document.getElementById("work");
      if (work) window.scrollTo(0, work.getBoundingClientRect().top + window.scrollY);
    });
    await page.waitForTimeout(2_000);
    expect(await shot(), "scrolling changed nothing").not.toBe(first);
  });

  test("stops drawing when the tab is hidden", async ({ page }) => {
    await page.goto("/?brainQuality=low");
    await settled(page);

    const frames = () =>
      page.evaluate(
        () =>
          new Promise<number>((resolve) => {
            let count = 0;
            const start = performance.now();
            const tick = () => {
              count += 1;
              if (performance.now() - start < 400) requestAnimationFrame(tick);
              else resolve(count);
            };
            requestAnimationFrame(tick);
          }),
      );

    expect(await frames(), "no frames while visible").toBeGreaterThan(0);

    await page.evaluate(() => {
      Object.defineProperty(document, "visibilityState", { value: "hidden", configurable: true });
      Object.defineProperty(document, "hidden", { value: true, configurable: true });
      document.dispatchEvent(new Event("visibilitychange"));
    });
    await page.waitForTimeout(300);

    const before = await painted(page);
    await page.waitForTimeout(900);
    /* Nothing new drawn, so the count cannot have changed. */
    expect(await painted(page), "still drawing in a hidden tab").toBe(before);
  });

  test("holds still for a reader who asked for less motion", async ({ browser }) => {
    const context = await browser.newContext({ reducedMotion: "reduce" });
    const page = await context.newPage();
    await page.goto("/?brainQuality=low");
    await page.evaluate(() => document.fonts.ready);
    await expect
      .poll(() => page.locator("[data-brain]").getAttribute("data-brain"), { timeout: 20_000 })
      .toBe("still");

    await page.waitForTimeout(1_200);
    const shot = async () =>
      (await page.locator("[data-brain] canvas").screenshot()).toString("base64");
    const first = await shot();
    await page.waitForTimeout(1_200);
    expect(await shot(), "the cloud moved for a reader who asked it not to").toBe(first);
    await context.close();
  });

  /* The canvas covers the whole viewport and sits between the page and the
     reader. Every one of these would be invisible in a screenshot and fatal in
     use. */
  test("never takes a click, a selection or the keyboard from the page", async ({ page }) => {
    await page.goto("/?brainQuality=low");
    await settled(page);

    /* A link in the middle of the screen, which the canvas is certainly over. */
    const link = page.locator("#hero a[href='#contact']");
    await expect(link).toBeVisible();
    const box = await link.boundingBox();
    expect(box).not.toBeNull();

    const topmost = await page.evaluate(
      ({ x, y }) => {
        const element = document.elementFromPoint(x, y);
        return element ? element.tagName.toLowerCase() : "none";
      },
      { x: box!.x + box!.width / 2, y: box!.y + box!.height / 2 },
    );
    expect(topmost, "the canvas is on top of a link").not.toBe("canvas");

    /* Keyboard first, because a click moves focus and then the first Tab lands
       wherever that click left it rather than at the top of the page. */
    await page.keyboard.press("Tab");
    const focused = await page.evaluate(() => document.activeElement?.textContent ?? "");
    expect(focused, "the first tab stop is not the skip link").toContain("Skip to content");

    await link.click();
    expect(page.url()).toContain("#contact");

    /* Selection: dragging across a paragraph must select it, not the canvas. */
    const paragraph = page.locator("#about p").first();
    await paragraph.scrollIntoViewIfNeeded();
    const area = await paragraph.boundingBox();
    await page.mouse.move(area!.x + 5, area!.y + 10);
    await page.mouse.down();
    await page.mouse.move(area!.x + area!.width - 10, area!.y + 10, { steps: 8 });
    await page.mouse.up();
    const selected = await page.evaluate(() => window.getSelection()?.toString() ?? "");
    expect(selected.trim().length, "dragging across a paragraph selected nothing").toBeGreaterThan(3);
  });

  /* A browser allows only a handful of live WebGL contexts, somewhere around
     sixteen, and hands back null once they are gone. Leaving one behind on
     every unmount does not show up as slowly growing memory: it shows up as the
     cloud simply failing to appear once the reader has moved around the site a
     few times, which nothing else here would catch.

     The navigation has to be client side. A full page load tears the document
     down and the browser reclaims every context whether or not anything was
     disposed, so testing with goto would pass no matter how badly this leaked.
     Clicking the site's own links keeps one document alive across ten mounts
     and unmounts, which is what the disposal path actually has to survive. */
  test("survives ten client side mounts without running out of contexts", async ({ page }) => {
    test.slow();
    await page.goto("/?brainQuality=low");
    await page.evaluate((key) => sessionStorage.setItem(key, "1"), INTRO_KEY);
    await page.reload();

    const live = async () =>
      expect
        .poll(() => page.locator("[data-brain]").getAttribute("data-brain"), { timeout: 20_000 })
        .toBe("live");

    await live();

    for (let visit = 0; visit < 10; visit++) {
      await page.locator("header nav a[href='/writing']").click();
      await expect(page).toHaveURL(/\/writing$/);
      await expect(page.locator("[data-brain]")).toHaveCount(0);

      await page.locator("header a[href='/']").first().click();
      await expect(page).toHaveURL(/\/$/);
      await live();
    }

    expect(
      await painted(page),
      "the cloud stopped painting after ten mounts, so a context was leaked",
    ).toBeGreaterThan(200);
  });

  test("turns itself off when asked, leaving the page untouched", async ({ page }) => {
    await page.goto("/?brainQuality=off");
    await page.evaluate(() => document.fonts.ready);
    await expect(page.locator("h1")).toBeVisible();
    /* The host still renders, because the decision is the engine's, but nothing
       is ever drawn into it. */
    expect(await painted(page)).toBeLessThan(1);
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
