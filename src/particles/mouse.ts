import { clamp, easeForFrame } from "./pack";
import { CAMERA_FOV, CAMERA_POSITION } from "./renderer";
import type { MouseState, ParticleTimelineState } from "./types";

/* Where the pointer is, expressed in the space the simulation works in.

   The simulation knows nothing about screens. It moves particles around a unit
   cube, and the chain from there to a pixel is: scale by the timeline's factor,
   rotate by the timeline's rotation, translate by its offset, then project. To
   push particles away from the cursor, that whole chain has to be undone.

   A screen point is a ray rather than a point, so it has to be resolved against
   a plane. The pointer is resolved against the plane through the cloud's own
   centre, because the reader is pointing at the cloud and that is the depth
   they mean. The entrance asks for the other planes: a particle coming in from
   behind the cloud is further from the camera, so the same screen position is a
   wider world position, and scaling by exactly how much further away it is is
   what keeps it on the ray instead of drifting back into frame. */
export function pointerInCloudSpace(
  screen: { x: number; y: number },
  timeline: ParticleTimelineState,
  aspect: number,
  depthOffset = 0,
): [number, number, number] {
  const depth = Math.abs(CAMERA_POSITION[2] - timeline.offset.z);
  const halfHeight = depth * Math.tan((CAMERA_FOV * Math.PI) / 360);
  const halfWidth = halfHeight * aspect;

  /* World space, on a plane parallel to the one the cloud sits in. Clamped well
     clear of nought so that a depth at the camera itself cannot invert it. */
  const reach = Math.max(0.05, (depth - depthOffset) / depth);
  const wx = screen.x * halfWidth * reach - timeline.offset.x;
  const wy = screen.y * halfHeight * reach - timeline.offset.y;
  const wz = depthOffset;

  /* Undo the field rotation, which is applied as Z then Y then X, so it comes
     off in the opposite order with the opposite sign. */
  const { x: rx, y: ry, z: rz } = timeline.rotation;
  const cz = Math.cos(-rz);
  const sz = Math.sin(-rz);
  let px = wx * cz - wy * sz;
  let py = wx * sz + wy * cz;
  let pz = wz;

  const cy = Math.cos(-ry);
  const sy = Math.sin(-ry);
  const nx = px * cy + pz * sy;
  pz = -px * sy + pz * cy;
  px = nx;

  const cx = Math.cos(-rx);
  const sx = Math.sin(-rx);
  const ny = py * cx - pz * sx;
  pz = py * sx + pz * cx;
  py = ny;

  /* And undo the scale, back into nought to one. */
  const factor = Math.max(0.0001, timeline.factor);
  return [0.5 + px / (2 * factor), 0.5 + py / (2 * factor), 0.5 + pz / (2 * factor)];
}

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
  private mobile: boolean;
  private smoothing: number;
  /* Nought to one, eased, so the hole opens and closes rather than appearing
     and vanishing with the pointer. */
  private presence = 0;

  constructor(mobile: boolean, smoothing: number) {
    this.mobile = mobile;
    this.smoothing = smoothing;
  }

  get value(): MouseState {
    return this.state;
  }

  get active() {
    return this.presence;
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

  update(deltaSeconds: number) {
    const { state } = this;
    const smoothing = easeForFrame(this.smoothing, deltaSeconds);

    /* Two stages, at the easing and at three quarters of it. One stage gives a
       first order lag, which still arrives at the pointer in a straight line.
       Two gives it a slight overshoot and settle, which is the difference
       between following and being carried. */
    state.current.x += (state.target.x - state.current.x) * smoothing;
    state.current.y += (state.target.y - state.current.y) * smoothing;
    state.current.x += (state.target.x - state.current.x) * smoothing * 0.75;
    state.current.y += (state.target.y - state.current.y) * smoothing * 0.75;

    const limit = this.mobile ? MOBILE_DELTA_CLAMP : DESKTOP_DELTA_CLAMP;
    if (state.inside) {
      this.deltaTarget.x = clamp(50 * (state.current.x - this.previous.x), -limit, limit);
      this.deltaTarget.y = clamp(50 * (state.current.y - this.previous.y), -limit, limit);
    }
    this.previous.x = state.current.x;
    this.previous.y = state.current.y;

    state.delta.x += (this.deltaTarget.x - state.delta.x) * smoothing;
    state.delta.y += (this.deltaTarget.y - state.delta.y) * smoothing;

    /* The camera no longer turns. Finn asked for the cloud to part around the
       pointer instead, which is a force on the particles rather than a move of
       the viewpoint, and the two together read as the whole picture sliding
       rather than as something getting out of the way.

       This is how open the hole is, eased, so it closes as the pointer leaves
       rather than snapping shut. */
    const presenceTarget = state.inside ? 1 : 0;
    this.presence += (presenceTarget - this.presence) * easeForFrame(0.12, deltaSeconds);
  }

  /* A reader who asked for less motion is not shown a cloud that scatters when
     they move the mouse. */
  still() {
    this.state.delta.x = 0;
    this.state.delta.y = 0;
    this.deltaTarget.x = 0;
    this.deltaTarget.y = 0;
    this.presence = 0;
  }
}
