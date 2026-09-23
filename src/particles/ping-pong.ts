import { createTarget, disposeTarget, type Target } from "./gl";
import type { Capability } from "./quality";

/* A pair of identical float targets, one being read while the other is written,
   swapped at the end of every step.

   This exists once because the alternative is the same four fields and one
   swap written out in both the position simulation and the velocity
   simulation, and the failure mode when those two drift apart is not a crash.
   Reading and writing the same texture in one draw call is undefined: on most
   drivers it returns the value from before the frame and looks almost right,
   which is worse than looking wrong. */
export class PingPong {
  private a: Target;
  private b: Target;
  private flipped = false;

  private constructor(a: Target, b: Target) {
    this.a = a;
    this.b = b;
  }

  static create(
    gl: WebGL2RenderingContext,
    size: number,
    capability: Capability,
    label: string,
  ): PingPong | null {
    const options = {
      width: size,
      height: size,
      internalFormat: capability.simInternal,
      format: capability.simFormat,
      type: capability.simType,
      label,
    };
    const a = createTarget(gl, options);
    const b = a ? createTarget(gl, options) : null;
    if (!a || !b) {
      disposeTarget(gl, a);
      disposeTarget(gl, b);
      return null;
    }
    return new PingPong(a, b);
  }

  get read(): Target {
    return this.flipped ? this.b : this.a;
  }

  get write(): Target {
    return this.flipped ? this.a : this.b;
  }

  swap() {
    this.flipped = !this.flipped;
  }

  /* Both halves, because the first frame reads one of them before anything has
     written to it, and an unwritten float target holds whatever the driver left
     there. Seeding it with data rather than clearing to zero is how the
     simulation starts from its targets instead of from the origin.

     The type has to be the one the texture was allocated with. Handing a
     Float32Array to a half float texture is not a conversion, it is an
     INVALID_OPERATION, and it is silent unless you are checking getError. */
  seed(gl: WebGL2RenderingContext, capability: Capability, data: ArrayBufferView) {
    for (const target of [this.a, this.b]) {
      gl.bindTexture(gl.TEXTURE_2D, target.texture);
      gl.texSubImage2D(
        gl.TEXTURE_2D,
        0,
        0,
        0,
        target.width,
        target.height,
        capability.simFormat,
        capability.simType,
        data,
      );
    }
    gl.bindTexture(gl.TEXTURE_2D, null);
  }

  clear(gl: WebGL2RenderingContext) {
    for (const target of [this.a, this.b]) {
      gl.bindFramebuffer(gl.FRAMEBUFFER, target.framebuffer);
      gl.viewport(0, 0, target.width, target.height);
      gl.clearColor(0, 0, 0, 1);
      gl.clear(gl.COLOR_BUFFER_BIT);
    }
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  }

  dispose(gl: WebGL2RenderingContext) {
    disposeTarget(gl, this.a);
    disposeTarget(gl, this.b);
  }
}
