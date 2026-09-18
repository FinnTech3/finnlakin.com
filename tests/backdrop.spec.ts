import { expect, test } from "@playwright/test";
import { DEFAULTS } from "../src/particles/types";

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

  /* The debug handle the engine hangs on the window when it is asked for one.
     Only ever read here and by the overlay. */
  type Inspection = {
    timeline: { progress: number };
    pointerActive: number;
    scroll: number;
    since: number;
    frameMs: number;
  };
  type Handle = { particleBrain?: { inspect: () => Inspection } };

  /* Waits until the engine exists and has drawn at least one frame.

     The frame matters as much as the handle. The handle is hung on the window
     when the engine is constructed and its clock does not start until its first
     frame, so a test that starts measuring between the two is measuring an
     engine that has not begun. The time a frame took is nought until one has
     been drawn and never nought afterwards, which makes it the signal. */
  async function handleReady(page: Page) {
    await expect
      .poll(() => page.evaluate(() => Boolean((window as unknown as Handle).particleBrain)), {
        timeout: 30_000,
      })
      .toBe(true);
    await expect
      .poll(() => inspection(page).then((state) => state?.frameMs ?? 0), { timeout: 30_000 })
      .toBeGreaterThan(0);
    /* And a moment more, for a machine that takes half a second to draw one. */
    await page.waitForTimeout(1_000);
  }

  /* The whole inspection comes back in one round trip, rather than a callback
     being shipped into the page: every response on this site carries a content
     security policy without unsafe-eval, so a stringified function would work
     here and break the moment it ran against the real headers. */
  async function inspection(page: Page): Promise<Inspection | null> {
    return page.evaluate(() => {
      const handle = (window as unknown as Handle).particleBrain;
      return handle ? handle.inspect() : null;
    });
  }

  async function scrollReading(page: Page) {
    return (await inspection(page))?.scroll ?? -1;
  }

  async function progressReading(page: Page) {
    return (await inspection(page))?.timeline.progress ?? -1;
  }

  /* Lit pixels in a centred box, given as a share of the image rather than in
     pixels, so the same numbers mean the same thing on a phone at two and three
     quarter device pixels to the css pixel as on a monitor at one. */
  /* How densely lit each of several centred boxes is, given as shares of the
     image rather than in pixels, so the same numbers mean the same thing on a
     phone at two and three quarter device pixels to the css pixel as on a
     monitor at one. All of them off one screenshot, because a screenshot is the
     expensive part and two of them are two different moments. */
  async function paintedShares(page: Page, shares: number[], threshold = 120) {
    const canvas = page.locator("[data-brain] canvas");
    const shot = (await canvas.screenshot()).toString("base64");
    return page.evaluate(
      async ({
        data,
        shares,
        threshold,
      }: {
        data: string;
        shares: number[];
        threshold: number;
      }) => {
        const image = new Image();
        image.src = `data:image/png;base64,${data}`;
        await image.decode();
        const sheet = document.createElement("canvas");
        sheet.width = image.width;
        sheet.height = image.height;
        const ctx = sheet.getContext("2d");
        if (!ctx) return shares.map(() => -1);
        ctx.drawImage(image, 0, 0);
        const pixels = ctx.getImageData(0, 0, sheet.width, sheet.height).data;
        return shares.map((share) => {
          const x0 = Math.round((sheet.width * (1 - share)) / 2);
          const x1 = sheet.width - x0;
          const y0 = Math.round((sheet.height * (1 - share)) / 2);
          const y1 = sheet.height - y0;
          let lit = 0;
          let sampled = 0;
          for (let y = y0; y < y1; y += 2) {
            for (let x = x0; x < x1; x += 2) {
              const i = (y * sheet.width + x) << 2;
              sampled += 1;
              if (pixels[i]! + pixels[i + 1]! + pixels[i + 2]! > threshold) lit += 1;
            }
          }
          return sampled > 0 ? lit / sampled : -1;
        });
      },
      { data: shot, shares, threshold },
    );
  }

  /* Lit pixels inside a disc, in canvas coordinates. Used to measure the hole
     the pointer opens, which a count over the whole cloud would miss: particles
     pushed out of the middle land at the edge of the reach and the total barely
     moves. */
  async function paintedWithin(page: Page, cx: number, cy: number, radius: number) {
    const canvas = page.locator("[data-brain] canvas");
    const shot = (await canvas.screenshot()).toString("base64");
    return page.evaluate(
      async ({ data, cx, cy, radius }: { data: string; cx: number; cy: number; radius: number }) => {
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
        for (let y = Math.max(0, cy - radius); y < Math.min(sheet.height, cy + radius); y++) {
          for (let x = Math.max(0, cx - radius); x < Math.min(sheet.width, cx + radius); x++) {
            if ((x - cx) ** 2 + (y - cy) ** 2 > radius * radius) continue;
            const i = (y * sheet.width + x) << 2;
            if (pixels[i]! + pixels[i + 1]! + pixels[i + 2]! > 150) lit += 1;
          }
        }
        return lit;
      },
      { data: shot, cx, cy, radius },
    );
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

  /* The cloud's on-screen radius, as the distance inside which nine tenths of
     what is lit sits. Not the furthest lit pixel: the cloud has a faint halo of
     strays and a bloom around it, and a maximum takes the radius of the halo. */
  async function cloudRadius(page: Page, centre: { x: number; y: number }) {
    const shot = (await page.locator("[data-brain] canvas").screenshot()).toString("base64");
    return page.evaluate(
      async ({ data, at }: { data: string; at: { x: number; y: number } }) => {
        const image = new Image();
        image.src = `data:image/png;base64,${data}`;
        await image.decode();
        const sheet = document.createElement("canvas");
        sheet.width = image.width;
        sheet.height = image.height;
        const ctx = sheet.getContext("2d");
        if (!ctx) return 0;
        ctx.drawImage(image, 0, 0);
        const pixels = ctx.getImageData(0, 0, sheet.width, sheet.height).data;
        const distances: number[] = [];
        for (let y = 0; y < sheet.height; y += 2) {
          for (let x = 0; x < sheet.width; x += 2) {
            const i = (y * sheet.width + x) << 2;
            if (pixels[i]! + pixels[i + 1]! + pixels[i + 2]! > 200) {
              distances.push(Math.hypot(x - at.x, y - at.y));
            }
          }
        }
        if (distances.length === 0) return 0;
        distances.sort((a, b) => a - b);
        return Math.round(distances[Math.floor(distances.length * 0.9)] ?? 0);
      },
      { data: shot, at: centre },
    );
  }

  /* The cursor parts the cloud, and the cloud closes again.

     Worth the machinery, because this is exactly the kind of effect that can be
     wired correctly end to end and still do nothing. It was: smoothstep is
     undefined in GLSL when its first edge is not less than its second, and
     written the wrong way round it returned zero for every particle, so the
     force was multiplied by nothing at the last step. Every uniform arrived,
     every value was right, and the picture never moved. */
  test("opens a hole around the pointer, and closes it again", async ({ page, isMobile }) => {
    /* A touch screen has no cursor to part the cloud around, and the engine
       does not listen for one there. */
    test.skip(Boolean(isMobile), "no hover pointer on a touch device");
    /* Generous, because the poll below waits for a force that is applied per
       simulation step on a machine whose step rate depends on what else the
       suite is drawing at the time. */
    test.setTimeout(240_000);
    /* The debug flag puts a handle on the engine, so this can assert that the
       pointer was heard as well as that the picture changed. Without it, a
       listener that never fired and a force that does nothing look identical. */
    await page.goto("/?brainQuality=low&brainDebug=1");
    await settled(page);

    /* The content has to go first.

       An element screenshot clips to the element's box but still renders the
       whole page stack over it, so a shot of the canvas includes the headline
       painted on top of it. With the text left in, the centroid below landed on
       "Finn Lakin" rather than on the cloud, and the measurement came back
       identical to the digit three times running: a disc full of static text
       does not change when particles move. */
    await page.addStyleTag({
      content: "body > header, body > main, body > footer { visibility: hidden !important }",
    });
    await page.waitForTimeout(400);

    /* Found rather than assumed. The cloud's resting place is a function of the
       timeline, the viewport aspect and the camera, and a number copied out of
       any of those into a test is a number that goes stale silently. The
       centroid of what is lit is the cloud, wherever it is. */
    const centre = await (async () => {
      const shot = (await page.locator("[data-brain] canvas").screenshot()).toString("base64");
      return page.evaluate(async (data: string) => {
        const image = new Image();
        image.src = `data:image/png;base64,${data}`;
        await image.decode();
        const sheet = document.createElement("canvas");
        sheet.width = image.width;
        sheet.height = image.height;
        const ctx = sheet.getContext("2d");
        if (!ctx) return { x: 0, y: 0 };
        ctx.drawImage(image, 0, 0);
        const pixels = ctx.getImageData(0, 0, sheet.width, sheet.height).data;
        let sumX = 0;
        let sumY = 0;
        let lit = 0;
        for (let y = 0; y < sheet.height; y += 2) {
          for (let x = 0; x < sheet.width; x += 2) {
            const i = (y * sheet.width + x) << 2;
            if (pixels[i]! + pixels[i + 1]! + pixels[i + 2]! > 200) {
              sumX += x;
              sumY += y;
              lit += 1;
            }
          }
        }
        return lit > 0 ? { x: Math.round(sumX / lit), y: Math.round(sumY / lit) } : { x: 0, y: 0 };
      }, shot);
    })();

    const viewport = page.viewportSize();
    expect(viewport).not.toBeNull();
    expect(centre.x, "could not find the cloud on screen").toBeGreaterThan(0);

    /* The disc is measured against the parting, not against the viewport.

       It was eight percent of the viewport height, which was about the size of
       the hole while the pointer reached 0.18 of a shape space where the cloud's
       furthest particle sits at 0.34: over half the cloud's radius. The reach is
       a sixth of that now, on the complaint that the cursor moved too much of
       the brain, and a hole a fifth of the width of the disc it is measured in
       cannot move the count by the ten percent this asserts. The test would have
       failed for the effect being correctly made smaller.

       So the disc follows the reach. The cloud's own on-screen radius is
       measured rather than assumed, because it depends on the timeline, the
       aspect and the camera, and the reach is scaled into pixels by the ratio
       it has to the extent every shape is normalised to. */
    const spread = await cloudRadius(page, centre);
    expect(spread, "could not measure the cloud on screen").toBeGreaterThan(20);
    const radius = Math.max(24, Math.round((spread * DEFAULTS.pointerReach) / 0.34));

    const before = await paintedWithin(page, centre.x, centre.y, radius);
    expect(before, "nothing painted where the cloud should be").toBeGreaterThan(50);

    /* Jiggled rather than parked, because a single move is one event and the
       pointer is read once a frame. And polled rather than timed.

       The parting is a force applied per simulation step, so how long it takes
       to open the hole is counted in steps, and this environment runs the
       simulation at a fraction of real time when several pages are competing
       for one software rasteriser. A fixed two seconds of jiggling opened
       thirteen percent on an unloaded run and nine on a loaded one, against a
       bar of ten, and four seconds moved the coin without settling it. Waiting
       for the hole asserts the same thing and leaves the number of steps it
       takes to the machine. */
    let during = before;
    await expect
      .poll(
        async () => {
          for (let step = 0; step < 8; step++) {
            await page.mouse.move(centre.x + (step % 3), centre.y + (step % 2));
            await page.waitForTimeout(100);
          }
          during = await paintedWithin(page, centre.x, centre.y, radius);
          return during;
        },
        { timeout: 120_000, message: "the pointer did not part the cloud" },
      )
      /* The drift between two measurements with the pointer away is about one
         percent. A ten percent drop is ten times that, and the parting measured
         seventeen when aimed at the middle of the cloud by hand. */
      .toBeLessThan(before * 0.9);

    const heard = await page.evaluate(
      () =>
        (window as unknown as { particleBrain?: { inspect: () => { pointerActive: number } } })
          .particleBrain?.inspect().pointerActive ?? -1,
    );
    expect(heard, "the engine never heard the pointer").toBeGreaterThan(0.5);

    /* Closing has never been marginal: the spring that does it is the same one
       that holds the shape, and it has the whole cloud behind it. */
    await page.mouse.move(10, 10);
    await page.waitForTimeout(4_000);
    const after = await paintedWithin(page, centre.x, centre.y, radius);

    console.log(`pointer hole: ${before} lit, ${during} with the pointer on it, ${after} after`);

    expect(after, "the cloud did not close again").toBeGreaterThan(during * 1.05);
  });

  test("flies the opening in from outside the frame", async ({ page }) => {
    /* Generous, because everything here is counted in frames and this
       environment draws about two a second with one page open and fewer with
       several. */
    test.setTimeout(240_000);
    /* The entrance is over in about two seconds and one canvas screenshot on
       the software rasteriser this runs on costs more real time than that, so
       the moment being measured has to be held rather than caught.

       Every time the engine knows about is the timestamp requestAnimationFrame
       hands it. Handing it a clock of this test's own making freezes the whole
       engine at a moment of its own choosing: once the clock stops the frame
       delta is nought, so the simulation takes no further steps and the reveal
       stops advancing, and the picture stays there for as long as the
       measurement needs. An earlier version of this test timed the moment from
       the wall instead and measured whatever the animation had got to by the
       time a loaded machine got round to taking the screenshot, which was a
       different moment every run and sometimes a second late.

       The clock is advanced in steps of no more than a quarter of a second,
       rather than jumped straight to the moment, because the engine caps how
       many simulation steps one frame may catch up on. Jumped, the reveal
       arrives at its moment with only part of the spring that belongs to it,
       and the frozen picture is of a state the animation never actually passes
       through. */
    const FROZEN_AT = 300;
    /* As large as the moment itself, so one frame after the clock starts is
       enough to reach it. It has to stay under the twenty steps the engine will
       catch up on in a single frame, which is a third of a second; three tenths
       is eighteen. Smaller, and this environment needs two frames, and two
       frames at the top of a loaded suite can be most of a minute. */
    const MOST_PER_FRAME = 300;
    await page.addInitScript(
      ({ frozenAt, mostPerFrame }: { frozenAt: number; mostPerFrame: number }) => {
        const raf = window.requestAnimationFrame.bind(window);
        let base: number | null = null;
        let last: number | null = null;
        let clock = 0;
        /* Advanced once per real animation frame rather than once per callback.
           Two things on this page ask for frames, the gradient and the engine,
           and every callback scheduled for the same frame is handed the same
           timestamp by the browser: comparing against the last one seen is what
           makes this a clock rather than a counter of subscribers. Advanced per
           callback, the engine would see twice the step it was given, past the
           point where it caps how much catching up one frame may do. */
        /* Held at nought until the test starts it.

           The engine mounts several frames into the page's life and starts its
           own clock at whatever it is handed then, so a clock that began
           climbing at the first frame of all would leave the engine's reveal
           short of the moment by however long the engine took to arrive. Held
           at nought, every frame before the engine exists has a delta of
           nought: it neither advances the reveal nor moves a particle, and the
           moment the test starts the clock is the moment the engine calls
           nought. */
        let armed = false;
        (window as unknown as { __startFrozenClock: () => void }).__startFrozenClock = () => {
          armed = true;
        };
        window.requestAnimationFrame = (callback: FrameRequestCallback) =>
          raf((stamp) => {
            if (base === null || last === null) {
              base = stamp;
              last = stamp;
            } else if (stamp !== last) {
              if (armed) {
                clock = Math.min(frozenAt, clock + Math.min(stamp - last, mostPerFrame));
              }
              last = stamp;
            }
            callback(base + clock);
          });

        /* The one clock that cannot be frozen with the rest: the failsafe that
           lifts the veil after nine seconds if the engine never arrives is a
           timeout on the real clock, and it would fire in the middle of the
           measurement and let the page show through the canvas. Only long
           timeouts are stretched, so nothing else the page does is affected:
           the failsafe is the only one on this page measured in seconds. */
        const timer = window.setTimeout.bind(window);
        window.setTimeout = ((handler: TimerHandler, delay?: number, ...rest: unknown[]) =>
          timer(handler, (delay ?? 0) >= 5_000 ? 600_000 : delay, ...rest)) as typeof setTimeout;
      },
      { frozenAt: FROZEN_AT, mostPerFrame: MOST_PER_FRAME },
    );

    /* Nothing is clicked, scrolled or typed in this test on purpose: any of
       those ends the opening animation, which is the thing being measured. */
    await page.goto("/?brainQuality=low&brainDebug=1");
    await handleReady(page);

    await page.evaluate(() =>
      (window as unknown as { __startFrozenClock?: () => void }).__startFrozenClock?.(),
    );

    /* Waited for rather than timed. How long the clock above takes to climb to
       its moment depends on how many frames the machine manages, and a fixed
       wait measured the animation half way there on a loaded run. */
    await expect
      .poll(() => inspection(page).then((state) => state?.since ?? -1), { timeout: 150_000 })
      /* A millisecond of slack, because the engine's clock is the difference of
         two of these timestamps and the last run of this suite reported
         299.99999999999994 for a clock that had arrived. */
      .toBeGreaterThan(FROZEN_AT - 1);
    /* And one more frame, so the moment the clock has reached is the moment
       that has been drawn. */
    await page.waitForTimeout(1_200);

    /* How densely lit the middle third of the frame is against the whole of it,
       at a threshold high enough to ignore the bloom. The bloom is a five level
       pyramid whose coarsest level spreads light across most of the frame, so at
       the threshold the plain frame count uses, the middle of an empty screen
       still reads as one percent lit from particles only just inside the edges. */
    const [middle, whole] = await paintedShares(page, [0.3, 1]);

    console.log(
      `entrance at ${FROZEN_AT}ms: middle ${(middle * 100).toFixed(3)}% lit, ` +
        `whole frame ${(whole * 100).toFixed(3)}%`,
    );

    /* If the veil ever did come off before the measurement, the page would be
       showing through the canvas and the numbers above would be of something
       else entirely. */
    expect(await introState(page), "the animation ended before it was measured").toBe("running");
    /* And an engine that drew nothing at all would pass the comparison below. */
    expect(whole, "the engine drew nothing to measure").toBeGreaterThan(0.0015);

    /* Three tenths of a second in, the particles are pouring in across all four
       edges of the frame and the middle measures at exactly nought on both a
       monitor and a phone: nothing has got there yet, against about half a
       percent lit across the frame as a whole. The first light is at about a
       hundred and fifty milliseconds and the word is forming by four hundred, so
       this is a narrow moment, which is why it is held rather than caught. The
       opening this replaced started every particle at one and a half times its
       own radius about the centre, which put the middle at its busiest in the
       very first frame. */
    expect(middle, "the opening did not start outside the frame").toBeLessThan(whole / 3);
  });

  test("maps the scroll onto the whole document, section by section", async ({ page }) => {
    test.slow();
    /* The contract in scroll.ts has been through two versions and is back at
       the first, which is worth saying rather than quietly reverting.

       It was section boundaries: section n's top reaching the top of the
       viewport is progress n. Then the cloud could not be drawn on paper, being
       additive, so the whole timeline was compressed into the dark stage at the
       top and the contract became a proportion of the stage's own travel. The
       final pass reads the same accumulation as ink on the paper half now, so
       the cloud travels the document again and the section measurement is
       simply the right one. The stage is section zero.

       One thing did change. Progress is normalised by the number of gaps rather
       than being the section index itself, so moving a section to its own page
       does not take the last state off the end of the timeline. Six is the end
       of the page whatever the page is made of.

       The measurement is only exact if the boundaries were read after the page
       stopped moving. Fonts change the height of every block of text, and the
       boundaries used to be read once, before the web fonts arrived. */
    await page.addInitScript((key: string) => sessionStorage.setItem(key, "1"), INTRO_KEY);
    await page.goto("/?brainQuality=low&brainDebug=1");
    await handleReady(page);

    const ids = await page.evaluate(() =>
      ["hero", "work", "about", "path", "skills", "endorsements", "contact"].filter((id) =>
        document.getElementById(id),
      ),
    );
    expect(ids.length, "the home page lost a section the timeline is mapped to").toBe(7);

    /* The top of section n, and a point halfway between two of them, which is
       what catches a mapping that is right at the boundaries and wrong in
       between. */
    for (const [index, fraction] of [
      [2, 0],
      [4, 0],
      [1, 0.5],
    ] as const) {
      const moved = await page.evaluate(
        ([id, next, share]: [string, string, number]) => {
          const from = document.getElementById(id);
          const to = document.getElementById(next);
          if (!from) return false;
          const top = from.getBoundingClientRect().top + window.scrollY;
          const span = to ? to.getBoundingClientRect().top + window.scrollY - top : 0;
          window.scrollTo(0, Math.round(top + span * share));
          return true;
        },
        [ids[index]!, ids[index + 1] ?? ids[index]!, fraction] as [string, string, number],
      );
      expect(moved, "the section the timeline is mapped to is missing").toBe(true);

      const expected = ((index + fraction) / (ids.length - 1)) * 6;
      await expect
        .poll(() => scrollReading(page), { timeout: 20_000 })
        .toBeCloseTo(expected, 1);
    }
  });

  test("follows the call to action through to the contact composition", async ({ page }) => {
    test.slow();
    /* The call to action is an anchor to the last section, so following it
       moves the scroll from the top of the page to the bottom in one go. How
       fast the timeline is then allowed to travel is asserted in
       scripts/check-motion.ts, where it can be measured exactly; what is
       asserted here is that the jump is followed at all, which is the part that
       depends on the boundaries, the anchor and the engine agreeing. */
    await page.addInitScript((key: string) => sessionStorage.setItem(key, "1"), INTRO_KEY);
    await page.goto("/?brainQuality=low&brainDebug=1");
    await handleReady(page);

    expect(await progressReading(page), "the page did not start at the top").toBeLessThan(0.2);

    await page.click('a[href="#contact"]');
    await expect.poll(() => scrollReading(page), { timeout: 20_000 }).toBeGreaterThan(5.5);
    await expect.poll(() => progressReading(page), { timeout: 20_000 }).toBeGreaterThan(2.4);
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
/* Where down the document to stand and look. Fractions of the whole scroll
   rather than section indices: the timeline is no longer mapped to sections,
   and what this test needs to cover is every position a reader can stop at,
   which is the document. The first four land inside the stage, where the cloud
   is behind the words; the rest land on the paper below it, where it is not. */
const SAMPLE_POINTS = [0, 0.04, 0.09, 0.15, 0.24, 0.4, 0.6, 0.85];

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
    let found = 0;

    for (const point of SAMPLE_POINTS) {
      await page.evaluate((target) => {
        const travel = Math.max(1, document.documentElement.scrollHeight - window.innerHeight);
        window.scrollTo(0, Math.round(travel * target));
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

          /* Text on a surface of its own is not this test's business.

             The measurement below hides the page and screenshots what is left,
             which is the only honest way to ask what a reader sees behind a
             word when there is nothing between the word and the moving cloud.
             It assumes there is nothing between them, and on the site this was
             written for there never was: that design had no cards, no panels
             and no filled controls, so every glyph sat directly on the
             backdrop.

             This one has all three. A label on a filled pill or inside a card
             sits on an opaque surface, the cloud behind it reaches the reader
             not at all, and measuring it against the cloud reports a white
             button's dark text against black and calls it 1.1:1. Those
             elements are not unmeasured: axe resolves an element's own
             background and checks exactly this case, on every route, in
             a11y.spec.ts. What is left here is what only this test can do. */
          let opaque = false;
          for (
            let node: HTMLElement | null = element;
            node && node !== document.body;
            node = node.parentElement
          ) {
            const fill = getComputedStyle(node).backgroundColor;
            const parts = fill.match(/-?\d+(\.\d+)?/g);
            if (!parts) continue;
            const alpha = parts.length > 3 ? Number(parts[3]) : 1;
            if (alpha >= 0.95) {
              opaque = true;
              break;
            }
          }
          if (opaque) continue;

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

      /* Not every stop has text over the backdrop, and that is a correct
         answer rather than a broken selector. Deep into the stage the copy has
         faded out and the only words left on screen are inside the artifact
         cards, which sit on their own opaque surface and are excluded above; on
         the paper below, everything is on a surface. What has to hold is that
         the selector finds text somewhere, which is asserted once at the end
         over the whole walk. */
      found += boxes.length;

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

    /* Five, not a round twenty: the number is small by design and the bar has
       to be set from what the page actually has rather than from what feels
       like a lot. Almost every word on this site now sits on a card, a pill or
       a band, and text on its own surface is excluded above because the cloud
       behind it reaches the reader not at all. What is left is the stage's own
       copy, which is eleven runs at the top of a desktop and fifteen across the
       whole walk on a phone. The assertion is here to catch the selector
       silently matching nothing, and five does that. */
    expect(
      found,
      "no text was measured anywhere on the page, so this proves nothing",
    ).toBeGreaterThan(5);

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
