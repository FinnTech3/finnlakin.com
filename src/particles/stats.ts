import type { ParticleBrain as Engine } from "./types";

/* A readout of what the engine thinks it is doing, behind ?brainStats=1 and
   nowhere else, for the one person who has the device this was never run on.

   The site was built where there is no graphics card and no Safari, so what it
   does on an iPad can only be reported by the iPad. This puts the numbers on
   the screen to be read out or photographed: the quality the engine settled
   on, how many particles that is, how the device was classified, the layout,
   and the frame rate a reader sees, measured here from the intervals between
   the frames the browser hands over and not taken from the engine, so that it
   cannot be wrong in the same way the engine could.

   Loaded on demand, so the page pays for none of it unless it is asked for. */
export function mountStats(engine: Engine): () => void {
  const panel = document.createElement("pre");
  panel.setAttribute("aria-hidden", "true");
  panel.dataset.brainStats = "";
  Object.assign(panel.style, {
    position: "fixed",
    left: "8px",
    bottom: "8px",
    zIndex: "100",
    margin: "0",
    padding: "8px 10px",
    font: "11px/1.4 ui-monospace, monospace",
    color: "#f4f2ee",
    background: "rgb(18 18 18 / 0.88)",
    border: "1px solid rgb(244 242 238 / 0.4)",
    pointerEvents: "none",
    whiteSpace: "pre",
  });
  document.body.appendChild(panel);

  const window_: number[] = [];
  let last = 0;
  let frame = 0;
  let worst = 0;
  let stopped = false;
  let shown = 0;

  const tick = (now: number) => {
    if (stopped) return;
    if (last > 0) {
      const interval = now - last;
      window_.push(interval);
      if (window_.length > 90) window_.shift();
      worst = Math.max(worst, interval);
    }
    last = now;
    /* Four times a second: the readout must not cost the frames it reports. */
    if (now - shown > 250 && window_.length > 5) {
      shown = now;
      const mean = window_.reduce((a, b) => a + b, 0) / window_.length;
      const slowest = Math.max(...window_);
      const state = engine.inspect();
      const device = state.device;
      panel.textContent = [
        "brain stats",
        `frames    ${(1000 / mean).toFixed(0)} per second, slowest ${slowest.toFixed(0)} ms`,
        `worst     ${worst.toFixed(0)} ms since load`,
        `quality   ${state.quality}, ${state.instances} particles, pixel ratio ${state.pixelRatio.toFixed(2)}`,
        `device    ${device.compact ? "compact" : "full size"}, ${device.touch ? "touch only" : "has a pointer"}`,
        `screen    ${window.innerWidth} by ${window.innerHeight} at ${window.devicePixelRatio}x`,
        `layout    ${state.layout.wide ? "lane" : "slot"}`,
        `position  band ${state.timeline.progress.toFixed(2)}`,
      ].join("\n");
    }
    frame = requestAnimationFrame(tick);
  };
  frame = requestAnimationFrame(tick);

  return () => {
    stopped = true;
    cancelAnimationFrame(frame);
    panel.remove();
  };
}
