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
  /* Driven with an injected clock and an injected scheduler, so the shedding
     order is asserted rather than waited for. Making a real machine slow enough
     to shed on demand is not a test, it is a coincidence. */
  function harness() {
    let now = 0;
    let cost = 0;
    let reads = 0;
    const queue: ((nowMs: number) => void)[] = [];

    /* The scheduler reads the clock exactly twice a frame, once before the
       draws and once after, and the difference is what it charges the frame.
       So the cost is applied on the second read. Driving it this way means the
       shedding order is asserted against a stated frame cost rather than
       against a machine that happens to be slow today. */
    const clock = () => {
      reads += 1;
      if (reads % 2 === 0) now += cost;
      return now;
    };

    const scheduler = createFrameScheduler(
      clock,
      (callback) => {
        queue.push(callback);
        return queue.length;
      },
      () => {},
    );

    return {
      scheduler,
      /* Run one frame and charge `costMs` to it. */
      step(costMs: number) {
        cost = costMs;
        const next = queue.shift();
        if (!next) return false;
        next(now);
        return true;
      },
      get pendingCount() {
        return queue.length;
      },
    };
  }

  test("runs one callback a frame, not one per client", () => {
    const rig = harness();
    const drawn: string[] = [];
    rig.scheduler.add({ rank: 0, draw: () => drawn.push("brain") });
    rig.scheduler.add({ rank: 1, draw: () => drawn.push("backdrop") });

    expect(rig.pendingCount, "more than one frame queued at a time").toBe(1);
    rig.step(1);
    expect(rig.pendingCount, "more than one frame queued after a tick").toBe(1);
    expect(drawn, "both clients did not draw on the one callback").toEqual([
      "brain",
      "backdrop",
    ]);
  });

  test("draws the subject before the decoration, whatever order they register in", () => {
    const rig = harness();
    const drawn: string[] = [];
    /* Registered the wrong way round on purpose. */
    rig.scheduler.add({ rank: 1, draw: () => drawn.push("backdrop") });
    rig.scheduler.add({ rank: 0, draw: () => drawn.push("brain") });

    rig.step(1);
    expect(drawn[0], "the decoration drew before the cloud").toBe("brain");
    expect(drawn[1]).toBe("backdrop");
  });

  test("gives up the decoration before the subject, on the averaged window", () => {
    const rig = harness();
    let brain = 0;
    let backdrop = 0;
    let shed = 0;
    rig.scheduler.add({ rank: 0, draw: () => (brain += 1) });
    rig.scheduler.add({
      rank: 1,
      draw: () => (backdrop += 1),
      onShed: () => (shed += 1),
    });

    /* Over the 12ms budget and well under the 36ms that counts as hopeless, so
       this exercises the averaged decision rather than the fast one. */
    const run = (frames: number) => {
      for (let i = 0; i < frames; i++) rig.step(16);
    };

    /* One window past the warmup thins the decoration. It is not dropped yet
       and the cloud has not been touched. */
    run(70);
    expect(shed, "the backdrop was dropped before it was thinned").toBe(0);
    expect(
      rig.scheduler.hasSheddable,
      "nothing left to shed while the backdrop is only thinned",
    ).toBe(true);

    const brainAfterThin = brain;
    const backdropAfterThin = backdrop;
    run(40);
    expect(
      backdrop - backdropAfterThin,
      "the backdrop did not slow down after being thinned",
    ).toBeLessThan(brain - brainAfterThin);

    /* A second window drops it, and only then is there nothing left above the
       cloud to give up. */
    run(80);
    expect(shed, "the backdrop never dropped").toBeGreaterThan(0);
    expect(
      rig.scheduler.hasSheddable,
      "still claims something is sheddable after the backdrop went",
    ).toBe(false);
  });

  test("relieves a hopeless machine without waiting out a window", () => {
    const rig = harness();
    let backdrop = 0;
    let shed = 0;
    rig.scheduler.add({ rank: 0, draw: () => {} });
    rig.scheduler.add({
      rank: 1,
      draw: () => (backdrop += 1),
      onShed: () => (shed += 1),
    });

    /* Frames far past the budget. The averaged window is 45 frames behind a 20
       frame warmup, so nothing here should need anywhere near that many.

       This is the behaviour the backdrop used to carry itself, stopping after
       twenty frames over 42ms. Replacing it with an average alone made a weak
       machine grind through the full screen shader for about a hundred and
       thirty frames before anything gave way, which is most of a second of jank
       that the old code did not have. */
    for (let i = 0; i < 14; i++) rig.step(50);

    const drawnByThen = backdrop;
    for (let i = 0; i < 10; i++) rig.step(50);
    expect(
      backdrop - drawnByThen,
      "the backdrop was still drawing every frame on a machine that cannot cope",
    ).toBeLessThan(10);

    for (let i = 0; i < 20; i++) rig.step(50);
    expect(
      shed,
      "a hopeless machine never had the decoration taken off it",
    ).toBeGreaterThan(0);
  });

  test("keeps drawing the subject every frame while it sheds", () => {
    const rig = harness();
    let brain = 0;
    rig.scheduler.add({ rank: 0, draw: () => (brain += 1) });
    rig.scheduler.add({ rank: 1, draw: () => {} });

    for (let i = 0; i < 200; i++) rig.step(40);
    expect(brain, "the cloud missed frames while shedding").toBe(200);
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
