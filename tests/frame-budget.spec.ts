import { expect, test } from "@playwright/test";
import { createFrameScheduler } from "../src/particles/frame";

/* What this file is for.

   The complaint was that the site is not smooth, and the cause was structural:
   the particle cloud and the gradient backdrop each owned a requestAnimationFrame
   loop and each decided on its own whether it was going too slowly. Two
   callbacks a frame for one picture, two WebGL contexts drawn from separate
   callbacks, and, worse, a cloud that stepped its own quality down while the
   decoration behind it carried on at full cost.

   None of that can be proven here by measuring frames. This container has no
   GPU, so every frame is software rasterised and any number taken from it says
   more about the rasteriser than about the page. Finn confirms the feel on real
   hardware.

   What can be proven is the structure, and the structure is the fix: how many
   callbacks a frame there are, in what order the two things draw, and what the
   page gives up first when it runs out of time. Those are counts, and a count
   does not care how fast the machine is. */

test.describe("the frame scheduler", () => {
  /* Driven by a stand-in display: each step advances the clock by one frame
     interval and runs the frame the scheduler asked for. The interval is the
     whole input, because it is the whole measurement. What a real machine
     spends inside the callback does not matter here, and that is the point of
     the first test below. */
  function display() {
    let now = 0;
    const queue: ((nowMs: number) => void)[] = [];
    const scheduler = createFrameScheduler(
      (callback) => {
        queue.push(callback);
        return queue.length;
      },
      () => {},
    );
    return {
      scheduler,
      /* One frame, arriving `intervalMs` after the last. */
      step(intervalMs: number) {
        now += intervalMs;
        const next = queue.shift();
        if (!next) return false;
        next(now);
        return true;
      },
      /* Frames at a steady interval for a stretch of simulated time. */
      run(seconds: number, intervalMs: number) {
        const until = now + seconds * 1000;
        while (now + intervalMs <= until + 1e-6) this.step(intervalMs);
      },
      get now() {
        return now;
      },
      get pendingCount() {
        return queue.length;
      },
    };
  }

  /* The page as it is registered in production: a subject with quality levels
     it can give up, and a gradient capped at thirty frames a second. Every
     giving up is written down with the time it happened, so the order and the
     timing can both be asserted. */
  function page(screen: ReturnType<typeof display>, levels = 2) {
    const events: { what: string; at: number }[] = [];
    let left = levels;
    let brain = 0;
    let backdrop = 0;
    let upgrades = 0;
    screen.scheduler.add({
      rank: 0,
      draw: () => (brain += 1),
      degrade: () => {
        if (left === 0) return false;
        left -= 1;
        events.push({ what: "degrade", at: screen.now });
        return true;
      },
      upgrade: () => {
        upgrades += 1;
        return true;
      },
    });
    screen.scheduler.add({
      rank: 1,
      fps: 30,
      draw: () => (backdrop += 1),
      onShed: () => events.push({ what: "shed", at: screen.now }),
    });
    return {
      events,
      get brain() {
        return brain;
      },
      get backdrop() {
        return backdrop;
      },
      get upgrades() {
        return upgrades;
      },
    };
  }

  test("runs one callback a frame, not one per client", () => {
    const screen = display();
    const drawn: string[] = [];
    screen.scheduler.add({ rank: 0, draw: () => drawn.push("brain") });
    screen.scheduler.add({ rank: 1, draw: () => drawn.push("backdrop") });

    expect(screen.pendingCount, "more than one frame queued at a time").toBe(1);
    screen.step(16.7);
    expect(screen.pendingCount, "more than one frame queued after a tick").toBe(1);
    expect(drawn, "both clients did not draw on the one callback").toEqual([
      "brain",
      "backdrop",
    ]);
  });

  test("draws the subject before the decoration, whatever order they register in", () => {
    const screen = display();
    const drawn: string[] = [];
    /* Registered the wrong way round on purpose. */
    screen.scheduler.add({ rank: 1, draw: () => drawn.push("backdrop") });
    screen.scheduler.add({ rank: 0, draw: () => drawn.push("brain") });

    screen.step(16.7);
    expect(drawn[0], "the decoration drew before the cloud").toBe("brain");
    expect(drawn[1]).toBe("backdrop");
  });

  /* The regression this file was rewritten for.

     A machine whose graphics card cannot keep up looks like this from inside
     the page: every callback returns almost at once, because WebGL only queues
     the work, and the frames arrive thirty times a second instead of sixty
     because the card is behind. The first version of the scheduler timed the
     callback, saw nothing wrong, and gave up nothing for as long as the page
     was open, while the brain's own governor waited for it. Driven through
     the same twenty seconds, it drew the backdrop six hundred times out of six
     hundred and reported there was still decoration left to give up. */
  test("gives way when frames arrive slowly, even though drawing them costs nothing", () => {
    const screen = display();
    const site = page(screen);
    screen.run(20, 1000 / 30);

    expect(
      site.events.map((event) => event.what),
      "the page never gave anything up on a machine running at half rate",
    ).toEqual(["shed", "degrade", "degrade"]);
  });

  test("gives up the decoration completely before the subject loses anything", () => {
    const screen = display();
    const site = page(screen);

    /* Forty frames a second: over budget, and under the thirty six
       milliseconds that counts as hopeless, so this is the averaged path. At
       this rate the thirty frame cap draws the gradient on every other frame,
       twenty times a second. */
    screen.run(1, 25);
    const drawnAtFullRate = site.backdrop;

    /* Past the warmup and one window, the gradient has been thinned and
       nothing else has happened. */
    screen.run(2, 25);
    expect(site.events, "something went before the gradient was thinned").toEqual([]);
    const drawnBefore = site.backdrop;
    screen.run(0.7, 25);
    expect(
      site.backdrop - drawnBefore,
      "the gradient was not thinned to fifteen frames a second",
    ).toBeLessThanOrEqual(11);
    expect(drawnAtFullRate).toBeGreaterThanOrEqual(19);

    /* Then dropped, and only then the subject, one level at a time, until it
       has nothing left to give. */
    screen.run(20, 25);
    expect(site.events.map((event) => event.what)).toEqual(["shed", "degrade", "degrade"]);
    const [shed, first, second] = site.events;
    expect(first!.at, "the subject stepped down before the gradient was gone").toBeGreaterThan(
      shed!.at,
    );
    expect(second!.at).toBeGreaterThan(first!.at);
  });

  test("relieves a hopeless machine in seconds, not windows", () => {
    const screen = display();
    const site = page(screen);

    /* Five frames a second. The averaged window alone would take nine seconds
       a rung at this rate; the fast path is six frames. */
    screen.run(0.9, 200);
    expect(site.events, "decided something inside the first second").toEqual([]);
    screen.run(8, 200);
    expect(site.events.map((event) => event.what)).toEqual(["shed", "degrade", "degrade"]);
    expect(
      site.events[2]!.at,
      "took too long to reach the floor on a machine that plainly cannot cope",
    ).toBeLessThan(8_000);
  });

  test("does not count one long frame against the page", () => {
    const screen = display();
    const site = page(screen);

    /* A garbage collection, a font arriving or a route change every three
       seconds: four hundred milliseconds of nothing, in thirty seconds of an
       otherwise perfect sixty. */
    for (let second = 0; second < 30; second += 3) {
      screen.run(3, 1000 / 60);
      screen.step(400);
    }
    expect(site.events, "a hitch cost the page something").toEqual([]);
  });

  test("does not give way to a stutter", () => {
    const screen = display();
    const site = page(screen);

    /* Five slow frames in a row, every two seconds, in an otherwise perfect
       sixty: a quarter of a second of visible stutter, and not a machine that
       cannot keep up. Clamped at fifty milliseconds a frame, the average used
       to go over budget on a single one of these. */
    for (let second = 0; second < 20; second += 2) {
      screen.run(2, 1000 / 60);
      for (let i = 0; i < 5; i++) screen.step(60);
    }
    expect(site.events, "a stutter cost the page something").toEqual([]);
  });

  test("counts a run of slow frames even when it straddles a window", () => {
    const screen = display();
    let newcomer = 0;
    screen.scheduler.add({ rank: 0, draw: () => {} });
    screen.scheduler.add({ rank: 1, draw: () => (newcomer += 1) });

    /* Past the warmup, then to three frames short of a window closing, then
       six slow frames that run across the close. Closing a window used to
       reset the run as well, so a run like this one was never seen and the
       machine waited for the average instead. */
    screen.run(1, 1000 / 60);
    for (let i = 0; i < 42; i++) screen.step(1000 / 60);
    for (let i = 0; i < 6; i++) screen.step(60);
    const before = newcomer;
    screen.run(1, 1000 / 60);
    expect(
      newcomer - before,
      "six slow frames in a row went unanswered because a window closed among them",
    ).toBeLessThanOrEqual(31);
  });

  test("gives the page time after a client says it has resized", () => {
    const screen = display();
    const site = page(screen);
    screen.run(3, 1000 / 60);
    /* A reader dragging a window edge: every render target reallocated, and a
       run of slow frames that is the resize rather than the machine. */
    screen.scheduler.settle();
    for (let i = 0; i < 8; i++) screen.step(55);
    const before = site.backdrop;
    screen.run(1, 1000 / 60);
    expect(
      site.backdrop - before,
      "a resize was read as a machine that cannot keep up, and the gradient was thinned",
    ).toBeGreaterThanOrEqual(29);
    expect(site.events).toEqual([]);
  });

  test("does not read a pause as a frame", () => {
    const screen = display();
    const site = page(screen);

    /* A hidden tab or a closed lid: the browser stops asking for frames, and
       the first one after is seconds late through no fault of the machine. */
    screen.run(2, 1000 / 60);
    screen.step(5_000);
    screen.run(4, 1000 / 60);
    expect(site.events, "a pause cost the page something").toEqual([]);
  });

  test("gives a client that joins a running page time to warm up", () => {
    const screen = display();
    const site = page(screen);
    /* A page with room to spare, and then something new arriving: the
       gradient joining when the opening animation's veil lifts, or the cloud
       coming back on screen on a phone. Its first frames are its own warm-up,
       compiling and uploading, so a run of slow ones is not held against the
       page. Held against it, six of them trip the fast path and the newcomer
       is thinned before it has drawn a steady frame. */
    screen.run(3, 1000 / 60);
    let newcomer = 0;
    screen.scheduler.add({ rank: 2, draw: () => (newcomer += 1) });
    for (let i = 0; i < 6; i++) screen.step(60);
    const before = newcomer;
    screen.run(1, 1000 / 60);
    expect(
      newcomer - before,
      "a newcomer was thinned for its own warm-up frames",
    ).toBeGreaterThanOrEqual(59);
    expect(site.events).toEqual([]);
  });

  test("caps the decoration at thirty frames a second on any display", () => {
    for (const hertz of [60, 120, 144]) {
      const screen = display();
      const site = page(screen);
      screen.run(2, 1000 / hertz);
      expect(site.brain, `the subject skipped frames at ${hertz}Hz`).toBe(hertz * 2);
      /* Within a frame or two of sixty in two seconds, whatever the refresh
         rate. Every frame on a hundred and twenty hertz screen would be two
         hundred and forty. */
      expect(site.backdrop, `the gradient drew at the wrong rate at ${hertz}Hz`).toBeGreaterThan(
        55,
      );
      expect(site.backdrop).toBeLessThanOrEqual(61);
    }
  });

  test("keeps drawing the subject every frame while everything else gives way", () => {
    const screen = display();
    const site = page(screen);
    for (let i = 0; i < 400; i++) screen.step(45);
    expect(site.brain, "the cloud missed frames while the page shed").toBe(400);
  });

  test("offers the subject one step up on a machine with room, and only once", () => {
    const screen = display();
    const site = page(screen);
    screen.run(20, 1000 / 60);
    expect(site.upgrades, "a machine with room was never offered more").toBe(1);
    expect(site.events).toEqual([]);
  });

  test("never offers a step up once anything has been given up", () => {
    const screen = display();
    const site = page(screen);
    screen.run(4, 40);
    expect(site.events.length, "nothing was given up on a slow start").toBeGreaterThan(0);
    screen.run(20, 1000 / 60);
    expect(site.upgrades, "stepped up after proving it could not hold the level").toBe(0);
  });
});

test.describe("the page's frame loop", () => {
  test.describe.configure({ timeout: 60_000 });

  /* The count that the whole change is about. Two loops became one, and this is
     the assertion that would fail if anything mounted a third. */
  test("the home page schedules one animation frame at a time", async ({
    page,
  }) => {
    await page.goto("/?brainQuality=low");
    await page.evaluate(() => document.fonts.ready);
    await expect
      .poll(() => page.locator("[data-brain]").getAttribute("data-brain"), {
        timeout: 20_000,
      })
      .toBe("live");
    await page.waitForTimeout(1_500);

    /* Counted as callbacks outstanding at one instant rather than as calls over
       a window: two loops each re-arm themselves, so over any window both look
       like "about sixty". What tells them apart is how many are in flight when
       the frame runs, which is one for a single loop and two for a pair. */
    const outstanding = await page.evaluate(
      () =>
        new Promise<number>((resolve) => {
          const real = window.requestAnimationFrame.bind(window);
          let inFlight = 0;
          let peak = 0;
          window.requestAnimationFrame = (callback: FrameRequestCallback) => {
            inFlight += 1;
            peak = Math.max(peak, inFlight);
            return real((time) => {
              inFlight -= 1;
              callback(time);
            });
          };
          setTimeout(() => {
            window.requestAnimationFrame = real;
            resolve(peak);
          }, 700);
        }),
    );

    expect(
      outstanding,
      "more than one animation frame loop is running on the home page",
    ).toBeLessThanOrEqual(1);
  });

  test("only the most visible clip is decoding", async ({ page }) => {
    await page.goto("/?brainQuality=low");
    await page.evaluate(() => document.fonts.ready);
    /* Into the work section, where the ten project clips are. */
    await page.evaluate(() =>
      window.scrollTo(0, document.body.scrollHeight * 0.3),
    );
    await page.waitForTimeout(2_000);

    const playing = await page.evaluate(
      () =>
        [...document.querySelectorAll("video")].filter((v) => !v.paused).length,
    );
    expect(playing, "more than one video decoding at once").toBeLessThanOrEqual(
      1,
    );
  });
});
