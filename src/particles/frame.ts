/* The page's only animation frame loop, and the order things give way in.

   There were two. The particle engine ran one and the gradient backdrop ran
   another, each with its own idea of whether it was going too slowly, and
   neither aware the other existed. Two callbacks a frame for one picture, and
   a page that on a slow machine stepped the brain down while the decorative
   gradient behind it carried on at full cost.

   So: one loop, one measurement, one ladder. Clients register with a rank.
   Rank 0 is the subject and runs every frame; higher ranks are decoration.
   When frames run long the page gives things up in a stated order:

     1. the decoration is thinned, to half its rate
     2. the decoration is dropped, and holds its last frame
     3. the subject steps its own quality down, one level at a time

   and only once the first two are gone does the brain lose a single particle.

   What is measured is the time between frames, and that is the whole point.
   The first version of this file timed the JavaScript inside each callback
   instead, on the reasoning that the gap between callbacks includes work this
   scheduler cannot give up. That was wrong in the one way that mattered. WebGL
   calls return as soon as they are queued, and the card does the drawing
   afterwards, so on a machine with a real GPU that cannot keep up the callback
   takes a millisecond or two while frames are being dropped. It saw nothing,
   shed nothing, and because the brain's own quality governor was told to wait
   until the decoration had been shed, nothing adapted at all. The container
   this was written in never showed it: a software rasteriser backs up into
   the command queue and makes the callback itself slow, so the wrong number
   happened to move. The gap between frames is the frame rate the reader
   actually sees, whatever made it long.

   This owns no rendering and knows nothing about WebGL. It is a scheduler, and
   the things it schedules are opaque to it. */

export type FrameClient = {
  /* Lower runs earlier and is given up later. The cloud is 0. */
  rank: number;
  /* Draw one frame. `nowMs` is the timestamp the browser supplied. */
  draw: (nowMs: number) => void;
  /* The most frames a second this client needs. Absent means every frame.
     Ignored at rank 0: the subject is never rationed. */
  fps?: number;
  /* Called once when the scheduler stops drawing this client, so it can record
     that it is no longer moving. Not a disposal: it keeps its context. */
  onShed?: () => void;
  /* The subject's own quality levels, the last rung of the ladder. Step down
     one and return true, or return false at the floor. */
  degrade?: () => boolean;
  /* Step up one and return true, or return false at the top. Asked at most
     once, and never after anything has been given up. */
  upgrade?: () => boolean;
};

/* The average time between frames above which the page gives something up.

   Twenty milliseconds is fifty frames a second. On a sixty hertz display it is
   what an average of one frame in four being missed looks like, which is the
   point at which a moving picture visibly stutters; above a hundred and twenty
   hertz a page holding a steady sixty sits well under it, and is left alone,
   because a steady sixty is smooth. */
const BUDGET_MS = 20;

/* Under this average the machine has room to spare, and the subject may be
   offered one step up. Fifty six frames a second, as the engine's governor
   always used. */
const HEADROOM_MS = 1000 / 56;

/* How many frames are averaged before a decision. */
const WINDOW = 45;

/* Each interval enters the average at no more than this. One long frame, from
   a garbage collection or a font arriving or a route changing, is a hitch and
   not a verdict; clamped, a four hundred millisecond hitch moves a 45 frame
   average by under a millisecond instead of by eight. A machine that is slow
   on every frame still reads as slow, because every frame is. */
const CLAMP_MS = 50;

/* Longer than this is not a frame at all. A hidden tab, an occluded window and
   a laptop lid all stop the browser asking for frames, and the first one after
   is a pause measured in seconds that says nothing about the machine. */
const PAUSE_MS = 1000;

/* Nothing is decided in the first second, whatever the frames look like. The
   opening frames are shader compilation, first texture uploads, hydration and
   fonts, which is what starting costs rather than what running costs. */
const WARMUP_MS = 1000;

/* And nothing for half a second after any change: a quality step reallocates
   the render targets, and the frame that does it is slow for that reason. */
const SETTLE_MS = 500;

/* Six frames in a row this far apart is not a machine having a moment, it is
   a machine that cannot do this at all, and waiting out a 45 frame window to
   say so is seconds of jank. The average decides the ordinary case; this
   decides the hopeless one. */
const HOPELESS_MS = 36;
const HOPELESS_RUN = 6;

/* Decoration is thinned to this before anything else, and dropped once it
   would be thinned below the floor. */
const THIN_FPS = 30;
const MIN_FPS = 15;

/* Frame timestamps land on the display's vsync, so a thirty frames a second
   cap on a sixty hertz display wants every other frame, and the second one
   arrives 33.3ms after the first give or take a fraction. Without some slack
   the cap misses it by that fraction and waits a third frame. Four
   milliseconds is under half a frame even at a hundred and twenty hertz. */
const FPS_SLACK_MS = 4;

type Registered = FrameClient & {
  /* Frames a second this client is drawn at: Infinity is every frame, 0 is
     shed. */
  cap: number;
  last: number;
};

export type FrameScheduler = {
  add: (client: FrameClient) => () => void;
  /* The last completed window's average time between frames, in
     milliseconds, for anything that wants to report it. Nought until one
     window has closed. */
  readonly averageMs: number;
  stop: () => void;
};

export function createFrameScheduler(
  /* Looked up on the window at each call rather than captured once as a
     default value.

     Capturing binds whatever `requestAnimationFrame` was at the moment the
     scheduler was built, so anything replacing the global afterwards is
     talking to a function this loop no longer calls. That is not
     hypothetical: the suite's own check that nothing draws in a hidden tab
     patches the global to count calls, and against a captured reference it
     counted nought while the engine was drawing sixty times a second. Any
     profiler hooking the same way would have been just as blind. */
  schedule: (callback: (nowMs: number) => void) => number = (callback) =>
    window.requestAnimationFrame(callback),
  cancel: (handle: number) => void = (handle) =>
    window.cancelAnimationFrame(handle),
): FrameScheduler {
  const clients: Registered[] = [];
  let handle: number | null = null;
  let running = false;

  let previous: number | null = null;
  let quietUntil = 0;
  let count = 0;
  let total = 0;
  let hopeless = 0;
  let average = 0;
  let gaveUp = false;
  let offered = false;

  function restartWindow() {
    count = 0;
    total = 0;
    hopeless = 0;
  }

  /* The cheapest thing still running, given up. Decoration first, from the
     highest rank down, thinned before it is dropped; then the subject's own
     levels. Returns false when there is nothing left to give. */
  function giveUpOne(): boolean {
    for (let i = clients.length - 1; i >= 0; i--) {
      const client = clients[i]!;
      if (client.rank === 0 || client.cap === 0) continue;
      const thinner = client.cap === Infinity ? THIN_FPS : client.cap / 2;
      if (thinner >= MIN_FPS) {
        client.cap = thinner;
      } else {
        client.cap = 0;
        client.onShed?.();
      }
      return true;
    }
    for (const client of clients) {
      if (client.rank === 0 && client.degrade?.()) return true;
    }
    return false;
  }

  function giveWay(nowMs: number) {
    restartWindow();
    if (!giveUpOne()) return;
    gaveUp = true;
    quietUntil = nowMs + SETTLE_MS;
  }

  /* One step up for the subject, once, and only on a machine that has never
     had to give anything up. A machine that has proved it cannot hold a level
     is not asked again, or the page changes quality every few seconds for
     ever. */
  function offerHeadroom(nowMs: number) {
    if (gaveUp || offered) return;
    for (const client of clients) {
      if (client.rank !== 0 || !client.upgrade) continue;
      offered = true;
      if (client.upgrade()) quietUntil = nowMs + SETTLE_MS;
      return;
    }
  }

  function measure(nowMs: number) {
    if (previous === null) {
      previous = nowMs;
      quietUntil = nowMs + WARMUP_MS;
      return;
    }
    const interval = nowMs - previous;
    previous = nowMs;

    if (interval > PAUSE_MS) {
      restartWindow();
      quietUntil = Math.max(quietUntil, nowMs + SETTLE_MS);
      return;
    }
    if (nowMs < quietUntil) return;

    if (interval > HOPELESS_MS) {
      hopeless += 1;
      if (hopeless >= HOPELESS_RUN) {
        giveWay(nowMs);
        return;
      }
    } else {
      hopeless = 0;
    }

    count += 1;
    total += Math.min(interval, CLAMP_MS);
    if (count < WINDOW) return;

    average = total / count;
    restartWindow();
    if (average > BUDGET_MS) giveWay(nowMs);
    else if (average < HEADROOM_MS) offerHeadroom(nowMs);
  }

  function tick(nowMs: number) {
    if (!running) return;

    for (const client of clients) {
      if (client.cap === 0) continue;
      if (
        client.rank > 0 &&
        client.cap !== Infinity &&
        nowMs - client.last < 1000 / client.cap - FPS_SLACK_MS
      ) {
        continue;
      }
      client.last = nowMs;
      client.draw(nowMs);
    }

    measure(nowMs);
    handle = schedule(tick);
  }

  function start() {
    if (running || clients.length === 0) return;
    running = true;
    /* A fresh start measures from its own first frame, so the time the loop
       spent stopped is never read as one enormous frame. */
    previous = null;
    restartWindow();
    handle = schedule(tick);
  }

  const scheduler: FrameScheduler = {
    add(client) {
      const registered: Registered = {
        ...client,
        cap:
          client.rank > 0 && client.fps !== undefined && client.fps > 0
            ? client.fps
            : Infinity,
        last: -Infinity,
      };
      clients.push(registered);
      /* Sorted by rank so the subject is drawn before the decoration inside a
         single frame. */
      clients.sort((a, b) => a.rank - b.rank);
      start();
      return () => {
        const at = clients.indexOf(registered);
        if (at >= 0) clients.splice(at, 1);
        if (clients.length === 0) scheduler.stop();
      };
    },
    get averageMs() {
      return average;
    },
    stop() {
      running = false;
      if (handle !== null) cancel(handle);
      handle = null;
    },
  };
  return scheduler;
}

/* One per document. The two callers are mounted by different components that
   do not know about each other, which is the whole reason this is a module
   level value rather than something passed down. */
let shared: FrameScheduler | null = null;

export function frameScheduler(): FrameScheduler {
  if (!shared) shared = createFrameScheduler();
  return shared;
}
