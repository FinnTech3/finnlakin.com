import { expect, test } from "@playwright/test";
import { bandPlan } from "../src/lib/bands";
import { projects } from "../src/lib/projects";
import { OPENING } from "../src/particles/opening";
import { chainOf, shapeSlot } from "../src/particles/structures";
import { DEFAULTS } from "../src/particles/types";
import {
  collectContent,
  countMarks,
  luminanceRangeIn,
  MARK_CEILING,
  markedBehind,
  markedShare,
  marksCentroid,
  marksRadius,
  photographBehind,
} from "./cloud-overlap";

type Browser = import("@playwright/test").Browser;
type Page = import("@playwright/test").Page;

/* The key the opening animation writes so it plays once a session. Tests that
   are not about the intro set it to get straight to the page. */
const INTRO_KEY = "fl-intro-played";

/* The opening animation and the cloud are the two things on this site that can
   fail in ways nothing else can: a machine with no WebGL, a machine whose WebGL
   is software and too slow to animate, a reader who has asked for less motion,
   and a second page view that should not replay an intro. None of those are
   visible in a screenshot of a working browser, so each one gets an assertion.

   There used to be a third, a gradient shader behind the whole site, with five
   tests of its own. It went with the black stage it was a background for, and
   its tests went with it: they asserted things about an element that no longer
   exists, and none of them is a property the cloud has. What they were for
   survives in the frame scheduler's own tests in frame-budget.spec.ts, which
   keep a stand-in for the next decoration that joins the ladder. */

async function introState(page: Page) {
  return page.evaluate(() => document.documentElement.dataset.intro ?? "none");
}

async function waitForIntroToFinish(page: Page) {
  await expect.poll(() => introState(page), { timeout: 15_000 }).toBe("none");
}

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

    /* And the cloud draws a frame rather than animating one. Given twenty
       seconds rather than the default five: the page was loaded with waitUntil
       commit, so this wait includes the whole bundle arriving and hydrating,
       which on a loaded run of this suite took more than five. */
    await expect
      .poll(() => page.locator("[data-brain]").getAttribute("data-brain"), { timeout: 20_000 })
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

  test("hands over with nothing left to move", async ({ page }) => {
    test.slow();
    /* The composition the page opens with, read every frame straight off the
       engine: where the cloud is, how large, how it is turned, and how much of
       it the keep-out is letting through. Sampled after each frame the page
       draws, whatever its rate, so the frame the animation hands over in is
       always in the record. */
    await page.addInitScript(() => {
      type Sample = {
        intro: string;
        since: number;
        x: number;
        y: number;
        factor: number;
        yaw: number;
        off: number;
      };
      const samples: Sample[] = [];
      (window as unknown as { handover: Sample[] }).handover = samples;
      const real = window.requestAnimationFrame.bind(window);
      window.requestAnimationFrame = (callback: FrameRequestCallback) =>
        real((time) => {
          callback(time);
          const brain = (
            window as unknown as {
              particleBrain?: {
                inspect: () => {
                  since: number;
                  timeline: {
                    offset: { x: number; y: number };
                    factor: number;
                    rotation: { y: number };
                    mask: { off: number };
                  };
                };
              };
            }
          ).particleBrain;
          if (!brain) return;
          const reading = brain.inspect();
          const state = reading.timeline;
          samples.push({
            intro: document.documentElement.dataset.intro ?? "none",
            since: reading.since,
            x: state.offset.x,
            y: state.offset.y,
            factor: state.factor,
            yaw: state.rotation.y,
            off: state.mask.off,
          });
        });
    });

    await page.goto("/?brainQuality=low&brainDebug=1");
    expect(await introState(page), "the intro should start on a first view").toBe("running");
    await waitForIntroToFinish(page);
    /* Long enough for the page's own easing to have arrived wherever it is
       going, which is the composition the opening should already have been in. */
    await page.waitForTimeout(3_000);

    const samples = await page.evaluate(
      () =>
        (
          window as unknown as {
            handover: {
              intro: string;
              since: number;
              x: number;
              y: number;
              factor: number;
              yaw: number;
              off: number;
            }[];
          }
        ).handover,
    );
    const handedOver = samples.findIndex((sample) => sample.intro !== "running");
    expect(handedOver, "never saw the animation hand over").toBeGreaterThan(0);
    const atHandOver = samples[handedOver]!;
    const settled = samples[samples.length - 1]!;

    /* The second line, ECONOMICS, FINANCE, SOFTWARE DEV, was held a second
       longer on Finn's word, which moved the hand-over from 6.9 seconds to 7.9.
       So the animation was still running after the old hand-over time, and it
       handed over no sooner than the new one: read off the engine's own clock,
       which is the only one that means anything on a machine drawing a few
       frames a second. */
    expect(
      samples.some((sample) => sample.intro === "running" && sample.since >= 7_000),
      "the opening ended before the second line's extra second was up",
    ).toBe(true);
    expect(atHandOver.since, "the opening handed over early").toBeGreaterThanOrEqual(
      OPENING.handoverAt,
    );

    /* The frame the animation hands over in against where the page settles.
       They were the middle of the screen at the words' size against the right
       hand column at the page's: the release moved the whole brain across a
       third of the screen and shrank it by a factor of 1.6, with the keep-out
       coming on over it partway. */
    expect(Math.abs(atHandOver.x - settled.x), "the brain moved sideways after the hand-over").toBeLessThan(
      0.05,
    );
    expect(Math.abs(atHandOver.y - settled.y), "the brain moved up or down after the hand-over").toBeLessThan(
      0.05,
    );
    expect(
      Math.abs(atHandOver.factor / settled.factor - 1),
      "the brain changed size after the hand-over",
    ).toBeLessThan(0.02);
    expect(Math.abs(atHandOver.yaw - settled.yaw), "the brain turned after the hand-over").toBeLessThan(
      0.02,
    );
    /* And the keep-out came on over a quarter of a second rather than in the
       frame after the hand-over, which is where a cut would show. How much of
       it is left in that frame depends on how long the frame took, so the
       expectation is worked out from the frame rather than fixed: on a machine
       slow enough to take a quarter of a second over one frame, it is allowed
       to be gone. */
    const next = samples[handedOver + 1];
    expect(next, "no frame was drawn after the hand-over").toBeDefined();
    const elapsed = (next!.since - atHandOver.since) / 1000;
    expect(
      Number(next!.off),
      `the keep-out came on in one frame of ${Math.round(elapsed * 1000)}ms`,
    ).toBeGreaterThanOrEqual(Math.min(1, 1 - elapsed / 0.25) - 0.01);
  });
});


/* The particle engine. None of this is about what it looks like, which is a
   judgement nobody should delegate to a test. It is about the ways a
   background canvas can go wrong without anybody noticing: it can fail to
   paint, it can keep painting in a tab nobody is looking at, it can keep
   moving for a reader who asked it not to, and it can quietly swallow the
   clicks, selections and keystrokes meant for the page underneath it. */
test.describe("the particle engine", () => {
  /* Twice the default budget for this group, and it is the machine rather than
     the tests.

     There is no GPU here or on a CI runner, so every frame of a thirty two
     thousand particle cloud is rasterised in software, and the desktop project
     draws far more of it than the phone one does. Measured in one run: the
     click and selection test took 30.1 seconds on desktop against 17.4 on
     phone, and the movement test 31.4 against 19.6. Both assert several things
     in sequence after `settled()`, which reloads, waits on the fonts and can
     poll for twenty seconds before its own fixed wait.

     They were passing on a margin of a few seconds, which is not a margin: they
     went over as soon as the run shared the machine with other workers, and
     they did it in a different place each time, which is how a suite teaches
     people to ignore it. Nothing here is skipped and no assertion is relaxed.
     The only thing that changes is how long a slow machine is allowed to take
     to finish arriving at the same answer. */
  test.describe.configure({ timeout: 60_000 });

  /* A page to read photographs in, which is never the page under test.

     Decoding a screenshot in the page that is drawing the cloud puts image work
     on the thread the cloud is drawn from, and the measuring helpers build a
     function from a string, which the site's content policy (script-src
     without unsafe-eval) refuses in a page of its own. A blank page in the same
     browser has neither problem. */
  async function decoderFor(page: Page) {
    return page.context().newPage();
  }

  /* How many pixels of the cloud's canvas are a mark, which is how many the
     engine has actually painted.

     Not by reading the drawing buffer, which was the first attempt and which
     silently returns nothing: asking an element for a context a second time
     hands back the one it already has and ignores the attributes, so
     preserveDrawingBuffer never took effect and readPixels saw a buffer the
     compositor had already cleared. It reported zero lit pixels for a cloud
     that was plainly on screen.

     Nor by counting bright pixels, which was the second. The page is a mid grey
     wall and every pixel of it is brighter than any threshold that would find
     a faint cloud over black, so a count that way is the area of the frame, and
     "the engine drew nothing" read as the whole of it. A mark is a pixel that is
     not the wall, and the page is hidden for the photograph so that the words
     and the controls are not counted as marks too. */
  async function painted(page: Page) {
    if ((await page.locator("[data-brain] canvas").count()) === 0) return -1;
    const decoder = await decoderFor(page);
    try {
      return await countMarks(decoder, await photographBehind(page));
    } finally {
      await decoder.close();
    }
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

  /* Marks inside a disc, in canvas coordinates. Used to measure the hole the
     pointer opens, which a count over the whole cloud would miss: particles
     pushed out of the middle land at the edge of the reach and the total barely
     moves. The page has to be hidden already, which the one test that calls it
     does for its whole length, or the words are counted along with the cloud. */
  async function paintedWithin(
    page: Page,
    decoder: Page,
    cx: number,
    cy: number,
    radius: number,
  ) {
    const shot = (await page.locator("[data-brain] canvas").screenshot()).toString("base64");
    return countMarks(decoder, shot, { within: { x: cx, y: cy, radius } });
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

  test("agrees with the layout about where the lane is, either side of the breakpoint", async ({
    page,
    isMobile,
  }) => {
    test.skip(Boolean(isMobile), "a width test, run on the desktop project");
    /* Two things decide whether the page has a column for the cloud: the bands'
       lane padding and the engine's keep-out. There were three once, with a
       pinned stage as the third, and they were three breakpoints: the stage at
       1024 pixels, the bands at 1100 and the engine at an aspect of 1.22.
       Between 1024 and 1099 pixels wide the engine cut the cloud to a lane the
       bands had already collapsed, so the cloud sat on a full width column of
       text, and above 1100 at a squarer aspect it drew the cloud over
       everything while the bands still kept a lane. */
    await page.addInitScript((key) => sessionStorage.setItem(key, "1"), INTRO_KEY);
    for (const [width, height] of [
      [1099, 800],
      [1100, 800],
      [1100, 1000],
      [1440, 900],
      [1024, 768],
    ] as const) {
      await page.setViewportSize({ width, height });
      await page.goto("/?brainQuality=low&brainDebug=1");
      await handleReady(page);
      const reading = await page.evaluate(() => {
        const inner = document.querySelector<HTMLElement>(".band-lane-right > .band-inner")!;
        const lane = Number.parseFloat(getComputedStyle(inner).paddingRight) > window.innerWidth * 0.3;
        const handle = (
          window as unknown as {
            particleBrain: { inspect: () => { timeline: { mask: { side: number } } } };
          }
        ).particleBrain;
        const column = handle.inspect().timeline.mask.side !== 0;
        return { lane, column };
      });
      expect(
        reading,
        `at ${width}x${height} the bands and the engine disagree about the lane`,
      ).toEqual({ lane: width >= 1100, column: width >= 1100 });
    }
  });

  test("stops drawing once its space has scrolled off a phone's screen", async ({
    page,
    isMobile,
  }) => {
    test.skip(!isMobile, "the canvas only scrolls away below the breakpoint");
    /* Below the breakpoint the cloud lives in the hero's first screen and the
       canvas scrolls away with it. A brain nobody can see should cost nothing,
       so every draw call on its canvas is counted, at the context. */
    await page.addInitScript((key) => {
      sessionStorage.setItem(key, "1");
      const counts = { draws: 0 };
      (window as unknown as { brainDraws: typeof counts }).brainDraws = counts;
      const proto = WebGL2RenderingContext.prototype as unknown as Record<
        string,
        (...args: unknown[]) => unknown
      >;
      for (const name of ["drawArrays", "drawArraysInstanced", "drawElements", "drawElementsInstanced"]) {
        const original = proto[name]!;
        proto[name] = function patched(this: WebGL2RenderingContext, ...args: unknown[]) {
          if ((this.canvas as HTMLCanvasElement).closest?.("[data-brain]")) counts.draws += 1;
          return original.apply(this, args);
        };
      }
    }, INTRO_KEY);

    const drawsOver = async (ms: number) => {
      const read = () =>
        page.evaluate(
          () => (window as unknown as { brainDraws: { draws: number } }).brainDraws.draws,
        );
      const before = await read();
      await page.waitForTimeout(ms);
      return (await read()) - before;
    };

    await page.goto("/?brainQuality=low&brainDebug=1");
    await handleReady(page);
    expect(await drawsOver(1_500), "the brain was not drawing at the top of the page").toBeGreaterThan(0);

    await page.evaluate(() => window.scrollTo(0, window.innerHeight * 2.5));
    await page.waitForTimeout(800);
    expect(await drawsOver(2_000), "still drawing a brain that has scrolled off the screen").toBe(0);

    await page.evaluate(() => window.scrollTo(0, 0));
    await page.waitForTimeout(800);
    expect(await drawsOver(1_500), "did not start drawing again on the way back").toBeGreaterThan(0);
  });

  test("paints, and says which quality level it settled on", async ({ page }) => {
    await page.goto("/?brainQuality=low");
    await settled(page);
    expect(await painted(page), "the cloud painted nothing at all").toBeGreaterThan(200);
  });

  test("moves on its own, and keeps moving as the page scrolls", async ({ page }) => {
    await page.goto("/?brainQuality=low");
    await settled(page);

    /* The page goes first, because it moves too. An element screenshot renders
       the whole stack over the element, and the first screen has a control whose
       ring of light turns round all the time, so two shots of the canvas with
       the page in them differ even when the cloud is frozen solid and the test
       passes for a reason that has nothing to do with the cloud. With the page
       hidden the only thing left to change is the thing being asked about. */
    await page.addStyleTag({
      content: "body > header, body > main, body > footer { visibility: hidden !important }",
    });
    await page.waitForTimeout(400);

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

    /* How many animation frames anything on the page asks for in a window.

       Reading the canvas cannot answer the question this test is asking. The
       context is created without preserveDrawingBuffer, which is the right
       choice for a page and means the browser may clear the buffer once it has
       composited it: two screenshots of a canvas nobody redrew are not required
       to match, and they do not.

       That was always true here. The measurement counted pixels over a
       threshold, and a nearly black frame counted the same whether it had been
       cleared or not, so this passed for a reason unconnected to what it was
       checking. It only began failing when the cloud came up to full brightness
       and about 170,000 pixels landed near that threshold, at which point 46 of
       them crossed it between two reads of a canvas that had not been redrawn.

       Frames asked for is the honest question. It is stricter than comparing
       pixels, and it covers anything else on the page that draws as well as the
       cloud. */
    const framesRequested = (ms: number) =>
      page.evaluate(
        (windowMs: number) =>
          new Promise<number>((resolve) => {
            let asked = 0;
            const real = window.requestAnimationFrame.bind(window);
            window.requestAnimationFrame = (callback: FrameRequestCallback) => {
              asked += 1;
              return real(callback);
            };
            setTimeout(() => {
              window.requestAnimationFrame = real;
              resolve(asked);
            }, windowMs);
          }),
        ms,
      );

    /* Measured before as well as after, so that a counter which never fires at
       all cannot pass the assertion below by doing nothing. */
    expect(await framesRequested(400), "not drawing while visible").toBeGreaterThan(0);

    await page.evaluate(() => {
      Object.defineProperty(document, "visibilityState", { value: "hidden", configurable: true });
      Object.defineProperty(document, "hidden", { value: true, configurable: true });
      document.dispatchEvent(new Event("visibilitychange"));
    });
    await page.waitForTimeout(300);

    expect(await framesRequested(900), "still drawing in a hidden tab").toBe(0);
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
    /* The window, clipped to the canvas, rather than a screenshot of the canvas
       element. An element screenshot scrolls its element into view first, and
       below the breakpoint the canvas runs past the fold, so each shot scrolled
       the page, and a scroll is exactly what redraws a settled frame. The test
       would have been moving the page and then reporting that it moved. */
    const shot = async () => {
      const box = await page.locator("[data-brain] canvas").boundingBox();
      const view = page.viewportSize() ?? { width: 1280, height: 720 };
      const top = Math.max(0, box?.y ?? 0);
      const bottom = Math.min(view.height, (box?.y ?? 0) + (box?.height ?? view.height));
      return (
        await page.screenshot({
          clip: { x: 0, y: top, width: view.width, height: Math.max(1, bottom - top) },
        })
      ).toString("base64");
    };
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

    const decoder = await decoderFor(page);
    const photograph = async () =>
      (await page.locator("[data-brain] canvas").screenshot()).toString("base64");

    /* Found rather than assumed. The cloud's resting place is a function of the
       timeline, the viewport aspect and the camera, and a number copied out of
       any of those into a test is a number that goes stale silently. The
       centroid of the marks is the cloud, wherever it is. */
    const found = await marksCentroid(decoder, await photograph());
    const centre = { x: found.x, y: found.y };

    const viewport = page.viewportSize();
    expect(viewport).not.toBeNull();
    expect(found.count, "could not find the cloud on screen").toBeGreaterThan(200);

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
    const spread = await marksRadius(decoder, await photograph(), centre);
    expect(spread, "could not measure the cloud on screen").toBeGreaterThan(20);
    const radius = Math.max(24, Math.round((spread * DEFAULTS.pointerReach) / 0.34));

    const before = await paintedWithin(page, decoder, centre.x, centre.y, radius);
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
          during = await paintedWithin(page, decoder, centre.x, centre.y, radius);
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
    const after = await paintedWithin(page, decoder, centre.x, centre.y, radius);

    console.log(
      `pointer hole: ${before} marked, ${during} with the pointer on it, ${after} after ` +
        `(disc radius ${radius}px, cloud radius ${spread}px)`,
    );

    expect(after, "the cloud did not close again").toBeGreaterThan(during * 1.05);
    await decoder.close();
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
           More than one thing on a page can ask for frames (there used to be a
           gradient beside the engine, and a decoration can come back), and every
           callback scheduled for the same frame is handed the same timestamp by
           the browser: comparing against the last one seen is what makes this a
           clock rather than a counter of subscribers. Advanced per callback, the
           engine would see twice the step it was given, past the point where it
           caps how much catching up one frame may do. */
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

  test("maps the scroll onto the whole document, band by band", async ({ page, isMobile }) => {
    /* Where the page keeps a lane, which is where the cloud travels the whole
       document. Below the breakpoint it lives in the hero and stops drawing
       once that has scrolled away, so the engine is not there to follow a
       phone to the fourth band; that contract is asserted on its own, in
       "stops drawing once its space has scrolled off a phone's screen". The
       mapping read here is the same code on both. */
    test.skip(Boolean(isMobile), "the cloud only travels the document where there is a lane");
    test.slow();
    /* The contract in scroll.ts: band n's top reaching the top of the viewport
       is progress n, and between two bands it is the fraction of the way
       between them. A band is anything on the page that carries data-band: the
       hero, each section, and each pair of projects in the work, which is why
       there are eleven of them and not seven.

       It was the page's sections, normalised by the number of gaps so that
       the end of the page was six whatever the page was made of. That put the
       one change of shape after the first two thirds of the page. The bands are
       the unit the cloud changes its mind at, so they are the unit it is
       counted in.

       The measurement is only exact if the boundaries were read after the page
       stopped moving. Fonts change the height of every block of text, and the
       boundaries used to be read once, before the web fonts arrived. */
    await page.addInitScript((key: string) => sessionStorage.setItem(key, "1"), INTRO_KEY);
    await page.goto("/?brainQuality=low&brainDebug=1");
    await handleReady(page);

    const ids = await page.evaluate(() =>
      Array.from(document.querySelectorAll("[data-band]")).map((band) => band.id),
    );
    expect(
      ids,
      "the home page has lost or gained a band the timeline is mapped to",
    ).toEqual(bandPlan(projects.length).map((band) => band.id));

    /* The top of band n, and a point halfway between two of them, which is what
       catches a mapping that is right at the boundaries and wrong in between.
       The last band is left out: its top is further down than the page can
       scroll, which is what the contract's clamp is for and is asserted by the
       test after this one. */
    for (const [index, fraction] of [
      [2, 0],
      [4, 0],
      [1, 0.5],
      [7, 0],
      [8, 0.5],
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
      expect(moved, "the band the timeline is mapped to is missing").toBe(true);

      await expect
        .poll(() => scrollReading(page), { timeout: 20_000 })
        .toBeCloseTo(index + fraction, 1);
    }
  });

  test("follows the call to action through to the contact composition", async ({
    page,
    isMobile,
  }) => {
    /* The same reason as the test above: on a phone the cloud stays in the
       hero, and the contact section is past it. */
    test.skip(Boolean(isMobile), "the cloud only travels the document where there is a lane");
    test.slow();
    /* The call to action is an anchor to the last section, so following it
       moves the scroll from the top of the page to the bottom in one go. How
       fast the timeline is then allowed to travel is asserted in
       scripts/check-motion.ts, where it can be measured exactly; what is
       asserted here is that the jump is followed at all, which is the part that
       depends on the boundaries, the anchor and the engine agreeing: the
       timeline arrives at the last band, and the cloud arrives at the last
       shape in the chain of them, which is ten changes of shape from where it
       started. */
    await page.addInitScript((key: string) => sessionStorage.setItem(key, "1"), INTRO_KEY);
    await page.goto("/?brainQuality=low&brainDebug=1");
    await handleReady(page);

    const plan = bandPlan(projects.length);
    const { chain } = chainOf(plan.map((band) => shapeSlot(band.shape)));

    expect(await progressReading(page), "the page did not start at the top").toBeLessThan(0.2);

    await page.click('a[href="#contact"]');
    await expect
      .poll(() => scrollReading(page), { timeout: 30_000 })
      .toBeGreaterThan(plan.length - 1.5);
    await expect
      .poll(() => progressReading(page), { timeout: 30_000 })
      .toBeGreaterThan(chain.length - 1.5);
  });

  test("turns itself off when asked, leaving the page untouched", async ({ page }) => {
    await page.goto("/?brainQuality=off");
    await page.evaluate(() => document.fonts.ready);
    /* With the engine off nothing ends the opening, so its veil and its Skip
       button stay up until the boot script's failsafe, and a photograph taken
       now measures them. The button is the way a reader gets past it, which is
       what is wanted here: pressed, the page is what is left. */
    await page.getByRole("button", { name: "Skip" }).click();
    await expect(page.locator("h1")).toBeVisible();
    /* The host still renders, because the decision is the engine's, but nothing
       is ever drawn into it. */
    expect(await painted(page)).toBeLessThan(1);
  });
});

/* The one thing an accessibility scanner cannot check on this site.

   axe reads computed styles. The particle cloud lives in a canvas it cannot
   read, so it composites text against the wall painted on <html> and reports a
   ratio that is only right if nothing decorative is painted between them. This
   measures the pixels that actually reach a reader.

   It asks two questions of every piece of content on screen, at eight places
   down the page, with the page hidden and only the wall and the cloud left to
   photograph. The first is the rule the page is built to: is anything but bare
   wall behind it. Nothing goes over the brain and the brain goes over nothing,
   and a faint enough cloud behind a word is still legible, so contrast alone
   could not tell. The second is the contrast itself, against the pixels rather
   than the styles: of every run of text in plain ink, the ratio to whatever is
   nearest its own luminance behind it.

   On a flat wall the second is close to redundant, and it stays for that
   reason. It reads pixels, so it is the one that would notice something
   unexpected painted behind a word: a mark the first question was told to
   allow, a block that grew a background, a clip that moved under a caption. */

type TextBox = {
  x: number;
  y: number;
  width: number;
  height: number;
  colour: [number, number, number];
  large: boolean;
  label: string;
};

/* Where down the document to stand and look. Fractions of the whole scroll
   rather than section indices: what this test needs to cover is every position
   a reader can stop at, which is the document. The cloud moves, disperses,
   reforms and changes composition as the page scrolls, so one position proves
   nothing about the others. */
const SAMPLE_POINTS = [0, 0.04, 0.09, 0.15, 0.24, 0.4, 0.6, 0.85];

function relativeLuminance(rgb: [number, number, number]) {
  const channel = (value: number) => {
    const v = value / 255;
    return v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * channel(rgb[0]) + 0.7152 * channel(rgb[1]) + 0.0722 * channel(rgb[2]);
}

test.describe("contrast where the words actually are", () => {
  /* Three minutes, and it is the machine rather than the test.

     This is the heaviest thing in the suite by a distance: it drives the home
     page to eight scroll positions, and at each one it hides the page, takes a
     full page screenshot, restores it, and then walks every run of text on the
     page measuring the composited pixels behind it. On a box with no GPU, where
     a thirty two thousand particle cloud is rasterised in software, that
     measured 72 seconds run on its own, and it went over ninety as soon as the
     run shared the machine with other workers.

     Nothing is skipped and no assertion is relaxed. A slow machine is allowed
     longer to arrive at the same answer. */
  test.describe.configure({ timeout: 180_000 });

  test("every run of text clears AA, and nothing is drawn over the cloud", async ({
    page,
    browser,
  }) => {
    await page.goto("/");
    await page.evaluate((key) => sessionStorage.setItem(key, "1"), INTRO_KEY);
    await page.reload();
    await page.evaluate(() => document.fonts.ready);
    /* Drawing, and not merely mounted: a walk over a cloud that never started
       would pass for the wrong reason. */
    await expect
      .poll(() => page.locator("[data-brain]").getAttribute("data-brain"), { timeout: 30_000 })
      .toBe("live");

    const decoder = await browser.newPage();
    const worst: { ratio: number; label: string; at: number }[] = [];
    let found = 0;
    let cloudSeen = 0;

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

             The measurement below hides the page and photographs what is left,
             which is the only honest way to ask what a reader sees behind a
             word when there is nothing between the word and the cloud. It
             assumes there is nothing between them. A word inside the block of
             carbon, or on a filled control, sits on an opaque surface, the
             cloud behind it reaches the reader not at all, and measuring it
             against the wall would report chalk type against grey and call it
             a failure. Those elements are not unmeasured: axe resolves an
             element's own background and checks exactly this case, on every
             route, in a11y.spec.ts. What is left here is what only this test
             can do. */
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
          /* Nor past either side. The index scrolls inside itself on a phone, so
             its right-hand columns are in the document and not on the screen,
             and a cell that is scrolled out of sight is not something a reader
             is looking at. It would clamp to an empty region of the photograph,
             and an empty region reads as the worst case, so it failed as text on
             a background that does not exist. */
          if (box.right <= 0 || box.left >= view.width) continue;

          const match = style.color.match(/-?\d+(\.\d+)?/g);
          if (!match || match.length < 3) continue;
          const colour: [number, number, number] = [
            Number(match[0]),
            Number(match[1]),
            Number(match[2]),
          ];
          /* Type that is not fully opaque is the quiet steps of the ink, which
             are carbon at an alpha. Their ratio depends on the wall they are
             blended with, so it is axe's to measure from the styles, and it
             does, on every route. */
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

      found += boxes.length;

      /* Every piece of content on screen, whatever it sits on, for the stricter
         question: whether the cloud is behind anything at all. The measurement
         is shared with the crossing test, in cloud-overlap.ts. */
      const content = await collectContent(page);
      const shot = await photographBehind(page);
      const marked = await markedBehind(decoder, shot, content);
      const range = await luminanceRangeIn(decoder, shot, boxes);
      cloudSeen = Math.max(cloudSeen, await markedShare(decoder, shot));

      content.forEach((box, index) => {
        const behind = marked[index] ?? 1;
        expect(
          behind,
          `"${box.label}" at section progress ${point} has the cloud behind it, ` +
            `${behind.toFixed(4)} from bare wall`,
        ).toBeLessThanOrEqual(MARK_CEILING);
      });

      boxes.forEach((box, index) => {
        const text = relativeLuminance(box.colour);
        const { min, max } = range[index] ?? { min: 0, max: 1 };
        /* Against whichever pixel behind the box is nearest the text's own
           luminance. Dark type is worst off against the darkest thing behind
           it, light type against the lightest, and type between the two is at
           one to one with something. */
        const against = text < min ? min : text > max ? max : text;
        const ratio = (Math.max(text, against) + 0.05) / (Math.min(text, against) + 0.05);
        const floor = box.large ? 3 : 4.5;

        if (ratio < floor + 1.5) {
          worst.push({ ratio, label: box.label, at: point });
        }

        expect(
          ratio,
          `"${box.label}" at section progress ${point} sits on pixels from ` +
            `luminance ${min.toFixed(4)} to ${max.toFixed(4)}`,
        ).toBeGreaterThanOrEqual(floor);
      });
    }

    /* Five, not a round twenty: the number is small by design and the bar has
       to be set from what the page actually has rather than from what feels
       like a lot. Type on its own surface is excluded above, and so is type at
       an alpha, which leaves the headlines and the plain ink. The assertion is
       here to catch the selector silently matching nothing, and five does
       that. */
    expect(found, "no text was measured anywhere on the page, so this proves nothing").toBeGreaterThan(
      5,
    );

    /* And the cloud was on screen somewhere in the walk. A page that failed to
       draw it would go over nothing, and the first question would pass for the
       wrong reason. */
    expect(
      cloudSeen,
      "the cloud was never on screen in the walk, so nothing was proven about it",
    ).toBeGreaterThan(0.001);

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
