import { clamp } from "./pack";
import type { MouseState } from "./types";

/* The pointer, smoothed twice and never used raw.

   The brief on this was explicit: it has to feel inertial and restrained, not
   like a cursor following toy. That is almost entirely a question of what the
   shader is given rather than what the shader does with it. Handed the raw
   pointer, any amount of displacement reads as the cloud being dragged about.
   Handed a value that is chasing the pointer and a velocity that decays back to
   nothing when the pointer stops, the same displacement reads as the cloud
   having been disturbed by something passing through it. */

const DESKTOP_DELTA_CLAMP = 2;
const MOBILE_DELTA_CLAMP = 0.1;

export class MouseController {
  private state: MouseState = {
    current: { x: 0, y: 0 },
    target: { x: 0, y: 0 },
    delta: { x: 0, y: 0 },
    inside: false,
  };

  private previous = { x: 0, y: 0 };
  private deltaTarget = { x: 0, y: 0 };
  private cameraPitch = 0;
  private cameraYaw = 0;
  private mobile: boolean;
  private smoothing: number;

  constructor(mobile: boolean, smoothing: number) {
    this.mobile = mobile;
    this.smoothing = smoothing;
  }

  get value(): MouseState {
    return this.state;
  }

  get pitch() {
    return this.cameraPitch;
  }

  get yaw() {
    return this.cameraYaw;
  }

  /* Stored, never acted on. The frame loop reads it once a frame, so a pointer
     that fires two hundred events a second still costs one update. */
  move(clientX: number, clientY: number, width: number, height: number) {
    this.state.target.x = 2 * (clientX / width - 0.5);
    this.state.target.y = -2 * (clientY / height - 0.5);
    this.state.inside = true;
  }

  leave() {
    this.state.inside = false;
    this.deltaTarget.x = 0;
    this.deltaTarget.y = 0;
  }

  update() {
    const { state } = this;

    /* Two stages, at the easing and at three quarters of it. One stage gives a
       first order lag, which still arrives at the pointer in a straight line.
       Two gives it a slight overshoot and settle, which is the difference
       between following and being carried. */
    state.current.x += (state.target.x - state.current.x) * this.smoothing;
    state.current.y += (state.target.y - state.current.y) * this.smoothing;
    state.current.x += (state.target.x - state.current.x) * this.smoothing * 0.75;
    state.current.y += (state.target.y - state.current.y) * this.smoothing * 0.75;

    const limit = this.mobile ? MOBILE_DELTA_CLAMP : DESKTOP_DELTA_CLAMP;
    if (state.inside) {
      this.deltaTarget.x = clamp(50 * (state.current.x - this.previous.x), -limit, limit);
      this.deltaTarget.y = clamp(50 * (state.current.y - this.previous.y), -limit, limit);
    }
    this.previous.x = state.current.x;
    this.previous.y = state.current.y;

    state.delta.x += (this.deltaTarget.x - state.delta.x) * this.smoothing;
    state.delta.y += (this.deltaTarget.y - state.delta.y) * this.smoothing;

    /* The camera turns by a fraction of a degree. Small enough that nobody
       would name it if asked what moved, large enough that the cloud reads as
       occupying space rather than as a picture of one. */
    const yawTarget = -0.075 * state.current.x;
    const pitchTarget = 0.05 * state.current.y;
    this.cameraYaw += (yawTarget - this.cameraYaw) * 0.1;
    this.cameraPitch += (pitchTarget - this.cameraPitch) * 0.1;
  }

  /* Reduced motion keeps the parallax but drops the disturbance: the cloud
     still sits in space, it just is not pushed around. */
  still() {
    this.state.delta.x = 0;
    this.state.delta.y = 0;
    this.deltaTarget.x = 0;
    this.deltaTarget.y = 0;
  }
}
