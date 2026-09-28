/* The page's only animation frame loop, and the order things give way in.

   There were two. The particle engine ran one and the gradient backdrop ran
   another, each with its own idea of whether it was going too slowly, and
   neither aware the other existed. Two things follow from that, and the second
   one is the fault worth fixing.

   The cheap part: two `requestAnimationFrame` callbacks are two scheduling
   slots for one picture, and two WebGL contexts drawn from two callbacks make
   the driver flush and restore state twice a frame.

   The expensive part: the engine's own governor measured only the engine's
   frame time, so on a machine that could not hold sixty it stepped **the brain**
   down while the decorative gradient behind it carried on at full cost. The
   page was protecting the decoration and shedding the subject.

   So: one loop, one measurement, and a stated order. Clients register with a
   rank. Rank 0 runs every frame and is the last thing to be given up; higher
   ranks are decoration and are thinned, then dropped, before rank 0 is asked to
   do anything differently.

   This owns no rendering of its own and knows nothing about WebGL. It is a
   scheduler, and the things it schedules are opaque to it. */

export type FrameClient = {
  /* Lower runs earlier and survives longer. The cloud is 0. */
  rank: number;
  /* Draw one frame. `nowMs` is the raw timestamp the browser supplied, so a
     client that measures its own elapsed time against a wall clock still can. */
  draw: (nowMs: number) => void;
  /* Called when the scheduler stops asking, so the client can record that it is
     no longer moving. Not a disposal: the client keeps its context. */
  onShed?: () => void;
};

/* How long a frame may take before the scheduler starts giving things up.

   Sixteen and two thirds milliseconds is a sixty hertz frame and is the wrong
   budget to aim at, because hitting it exactly leaves nothing for the browser's
   own compositing, style and paint work on the same frame. Twelve leaves a
   third of the frame for everything this scheduler does not control. */
const BUDGET_MS = 12;

/* Averaged over a window rather than acted on per frame, so one long garbage
   collection does not cost the page its gradient. */
const WINDOW = 45;

/* The first frames include shader compilation and the first texture uploads,
   which is not what a steady state costs. */
const WARMUP = 20;

/* A frame this far past the budget is not a machine having a moment, it is a
   machine that cannot do this at all, and waiting out a 45 frame window to say
   so is most of a second of jank.

   The backdrop used to carry its own version of this and stop itself after
   twenty frames over 42ms. Replacing that with an averaged window alone lost
   the responsiveness: a weak machine ground through the full screen shader for
   a hundred and thirty frames before anything gave way. The average decides the
   ordinary case, where one long garbage collection must not cost the page its
   gradient; this decides the hopeless one. */
const HOPELESS_MS = 36;
const HOPELESS_RUN = 6;

type Registered = FrameClient & {
  /* 1 means every frame, 2 every other, 0 means shed. */
  cadence: number;
  ticks: number;
};

export type FrameScheduler = {
  add: (client: FrameClient) => () => void;
  /* The averaged frame time in milliseconds, for anything that wants to report
     it. Nought until the first window closes. */
  readonly averageMs: number;
  /* Whether anything above rank 0 is still being drawn, and could therefore
     still be given up.

     This is what makes the cloud's own quality governor the last resort rather
     than the first. It used to step the brain down the moment its own frames
     ran long, while the decorative gradient behind it carried on at full cost.
     Now it asks this first: if there is still decoration to lose, lose that. */
  readonly hasSheddable: boolean;
  stop: () => void;
};

export function createFrameScheduler(
  /* Injected so the tests can drive it without a browser, and so the shedding
     order can be asserted against a stubbed clock rather than against a machine
     that happens to be slow today. */
  now: () => number = () =>
    typeof performance === "undefined" ? Date.now() : performance.now(),
  /* Looked up on the window at each call rather than captured once as a
     default value.

     Capturing binds whatever `requestAnimationFrame` was at the moment the
     scheduler was built, so anything replacing the global afterwards is talking
     to a function this loop no longer calls. That is not hypothetical: the
     suite's own check that nothing draws in a hidden tab patches the global to
     count calls, and against a captured reference it counted nought while the
     engine was drawing sixty times a second. Any profiler hooking the same way
     would have been just as blind. */
  schedule: (callback: (nowMs: number) => void) => number = (callback) =>
    window.requestAnimationFrame(callback),
  cancel: (handle: number) => void = (handle) =>
    window.cancelAnimationFrame(handle),
): FrameScheduler {
  const clients: Registered[] = [];
  let handle: number | null = null;
  let running = false;
  let seen = 0;
  let total = 0;
  let average = 0;
  let last = 0;
  let hopeless = 0;

  /* Give up the cheapest thing still running: the highest rank that is still
     being drawn. Thin it to every other frame first, and only drop it once it
     is already thinned, so a page under mild pressure loses smoothness in the
     decoration before it loses any of it in the subject.

     Rank 0 is never shed here. The cloud has its own quality levels and they
     are the last resort, applied by its own governor, after everything above it
     has already gone. */
  function shedOne(): boolean {
    for (let i = clients.length - 1; i >= 0; i--) {
      const client = clients[i]!;
      if (client.rank === 0) continue;
      if (client.cadence === 1) {
        client.cadence = 2;
        return true;
      }
      if (client.cadence === 2) {
        client.cadence = 0;
        client.onShed?.();
        return true;
      }
    }
    return false;
  }

  function tick(nowMs: number) {
    if (!running) return;
    const started = now();

    for (const client of clients) {
      if (client.cadence === 0) continue;
      client.ticks += 1;
      if (client.ticks % client.cadence !== 0) continue;
      client.draw(nowMs);
    }

    /* Measured around the draws rather than between callbacks. The gap between
       two callbacks includes everything the browser did in between, which is
       not what this scheduler can give up. */
    const spent = now() - started;
    last = spent;

    /* The fast path, before the averaging, so a machine that is plainly not
       coping is relieved in a tenth of a second rather than most of one. */
    if (spent > HOPELESS_MS) {
      hopeless += 1;
      if (hopeless >= HOPELESS_RUN) {
        hopeless = 0;
        if (shedOne()) {
          /* Start the average again, or the window that just proved the machine
             cannot cope carries into the decision about what is left. */
          seen = WARMUP;
          total = 0;
        }
      }
    } else {
      hopeless = 0;
    }

    seen += 1;
    if (seen > WARMUP) {
      total += spent;
      if (seen >= WARMUP + WINDOW) {
        average = total / WINDOW;
        seen = WARMUP;
        total = 0;
        if (average > BUDGET_MS) shedOne();
      }
    }

    handle = schedule(tick);
  }

  function start() {
    if (running || clients.length === 0) return;
    running = true;
    handle = schedule(tick);
  }

  return {
    add(client) {
      const registered: Registered = { ...client, cadence: 1, ticks: 0 };
      clients.push(registered);
      /* Sorted by rank so the subject is drawn before the decoration inside a
         single frame, which is what makes the order above mean anything. */
      clients.sort((a, b) => a.rank - b.rank);
      start();
      return () => {
        const at = clients.indexOf(registered);
        if (at >= 0) clients.splice(at, 1);
        if (clients.length === 0) this.stop();
      };
    },
    get averageMs() {
      return average || last;
    },
    get hasSheddable() {
      return clients.some((client) => client.rank > 0 && client.cadence > 0);
    },
    stop() {
      running = false;
      if (handle !== null) cancel(handle);
      handle = null;
    },
  };
}

/* One per document. The two callers are mounted by different components that do
   not know about each other, which is the whole reason this is a module level
   value rather than something passed down. */
let shared: FrameScheduler | null = null;

export function frameScheduler(): FrameScheduler {
  if (!shared) shared = createFrameScheduler();
  return shared;
}

/* The tests need a clean one between cases, and the engine's disposal path
   needs somewhere to put the page back. */
export function resetFrameScheduler() {
  shared?.stop();
  shared = null;
}
