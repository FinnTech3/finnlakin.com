import { bindTexture, createTarget, disposeTarget, FULLSCREEN_VERTEX, link, locations, type Target } from "./gl";
import type { Capability } from "./quality";
import {
  BLOOM_FRAGMENT,
  BLUR_FRAGMENT,
  BOKEH_FRAGMENT,
  BRIGHT_FRAGMENT,
  FINAL_FRAGMENT,
} from "./shaders/post";
import type { CloudMask, ParticleBrainConfig, PostLevel } from "./types";

/* The chain of framebuffers the particles are drawn into and finished in.

   It is built once per size and reused, which is the rule that matters: every
   target, every program and every uniform location here is allocated at startup
   or on a resize and never in a frame. Rebuilding a post chain per frame is a
   thing that looks fine on a fast machine and destroys a slow one. */

const BLOOM_LEVELS = 5;

/* Where the focal plane is, in the depth pass's own encoding: nought at the
   near clip plane, one at the far one, linear in between.

   This was 0.125, taken from the specification, and it was wrong in a way that
   is invisible in the number and total in the image. The depth pass writes
   (distance - 0.1) / 29.9, and the camera sits ten world units back, so 0.125
   is a plane 3.84 units from the camera, three and a half units in front of the
   nearest particle. Measured against the cloud the generator actually produces,
   at the opening composition, the particles run from 0.241 to 0.425, so every
   one of them was outside the focal plane by at least 0.116.

   The aperture multiplies that gap, and the result is clamped to one, so the
   entire cloud sat at maximum defocus: forty texels of ring blur on the near
   surface and forty on the far one, identically. Not a depth of field, a
   uniform smear, and on a cloud of separate specks a twenty five tap ring at
   that radius is not even a smear: it is twenty four dim copies of every
   particle scattered up to forty pixels away, which is what made the cortex
   read as scattered rather than folded.

   Both apertures this file has carried saturate: the original 0.00001 and the
   0.0085 that replaced it earlier on this branch both put every particle at
   the clamp, so raising it changed nothing. The fault was never the aperture.
   Put the focal plane on the near surface and the aperture matters again. */
export const BOKEH_FOCAL_DEPTH = 0.267;

/* Scaled by 900000 where it is uploaded, which is the specification's unit.
   Chosen so the far surface lands at about nine texels of defocus while the
   near surface stays at nought and nothing reaches the clamp: the back of the
   cortex goes soft, the front keeps its grooves, and the far surface stops
   filling in the near one's sulci. Measured, not guessed: scripts/check-dof.ts
   runs the same arithmetic over the same cloud and fails if the separation
   goes away again. */
export const BOKEH_APERTURE = 0.000002;
export const BOKEH_RINGS = 4;
export const BOKEH_SAMPLES = 6;
const EXPOSURE = 1;

export class PostChain {
  private gl: WebGL2RenderingContext;
  private capability: Capability;
  private fullscreen: { draw: () => void };

  private scene: Target | null = null;
  private depthColour: Target | null = null;
  private depthBuffer: WebGLRenderbuffer | null = null;
  private bloomA: Target[] = [];
  private bloomB: Target[] = [];
  private composed: Target | null = null;
  private defocused: Target | null = null;

  private brightProgram: WebGLProgram;
  private blurProgram: WebGLProgram;
  private bloomProgram: WebGLProgram;
  private bokehProgram: WebGLProgram;
  private finalProgram: WebGLProgram;

  private brightUniforms: Record<string, WebGLUniformLocation | null>;
  private blurUniforms: Record<string, WebGLUniformLocation | null>;
  private bloomUniforms: Record<string, WebGLUniformLocation | null>;
  private bokehUniforms: Record<string, WebGLUniformLocation | null>;
  private finalUniforms: Record<string, WebGLUniformLocation | null>;

  private width = 1;
  private height = 1;

  private constructor(
    gl: WebGL2RenderingContext,
    capability: Capability,
    fullscreen: { draw: () => void },
    programs: {
      bright: WebGLProgram;
      blur: WebGLProgram;
      bloom: WebGLProgram;
      bokeh: WebGLProgram;
      final: WebGLProgram;
    },
  ) {
    this.gl = gl;
    this.capability = capability;
    this.fullscreen = fullscreen;
    this.brightProgram = programs.bright;
    this.blurProgram = programs.blur;
    this.bloomProgram = programs.bloom;
    this.bokehProgram = programs.bokeh;
    this.finalProgram = programs.final;

    this.brightUniforms = locations(gl, programs.bright, ["t_source", "u_threshold"]);
    this.blurUniforms = locations(gl, programs.blur, ["t_source", "u_direction", "u_radius"]);
    this.bloomUniforms = locations(gl, programs.bloom, [
      "t_scene",
      "t_level0",
      "t_level1",
      "t_level2",
      "t_level3",
      "t_level4",
      "u_strength",
    ]);
    this.bokehUniforms = locations(gl, programs.bokeh, [
      "t_source",
      "t_depth",
      "u_texel",
      "u_focalDepth",
      "u_aperture",
      "u_rings",
      "u_samples",
    ]);
    this.finalUniforms = locations(gl, programs.final, [
      "t_source",
      "u_time",
      "u_vignetteOffset",
      "u_vignetteDarkness",
      "u_grain",
      "u_exposure",
      "u_maskEdge",
      "u_maskSide",
      "u_maskFeather",
      "u_gapCentre",
      "u_gapHalf",
      "u_maskOff",
    ]);
  }

  static create(
    gl: WebGL2RenderingContext,
    capability: Capability,
    fullscreen: { draw: () => void },
  ): PostChain | null {
    const bright = link(gl, FULLSCREEN_VERTEX, BRIGHT_FRAGMENT, "bright pass");
    const blur = link(gl, FULLSCREEN_VERTEX, BLUR_FRAGMENT, "blur");
    const bloom = link(gl, FULLSCREEN_VERTEX, BLOOM_FRAGMENT, "bloom composite");
    const bokeh = link(gl, FULLSCREEN_VERTEX, BOKEH_FRAGMENT, "bokeh");
    const final = link(gl, FULLSCREEN_VERTEX, FINAL_FRAGMENT, "final");
    if (!bright || !blur || !bloom || !bokeh || !final) {
      for (const program of [bright, blur, bloom, bokeh, final]) {
        if (program) gl.deleteProgram(program);
      }
      return null;
    }
    return new PostChain(gl, capability, fullscreen, { bright, blur, bloom, bokeh, final });
  }

  private hdr(width: number, height: number, label: string, linear = true) {
    return createTarget(this.gl, {
      width: Math.max(1, width),
      height: Math.max(1, height),
      internalFormat: this.capability.hdrInternal,
      format: this.gl.RGBA,
      type: this.capability.hdrType,
      linear,
      label,
    });
  }

  resize(width: number, height: number): boolean {
    if (this.width === width && this.height === height && this.scene) return true;
    this.release();
    this.width = width;
    this.height = height;

    this.scene = this.hdr(width, height, "scene");
    this.composed = this.hdr(width, height, "composed");
    this.defocused = this.hdr(width, height, "defocused");
    this.depthColour = this.hdr(width, height, "depth", false);

    /* The colour pass does not use the depth buffer, but the depth pass does,
       and both render into targets of this size. One renderbuffer shared by
       both is cheaper than two and is never read as a texture. */
    const gl = this.gl;
    this.depthBuffer = gl.createRenderbuffer();
    if (this.depthBuffer) {
      gl.bindRenderbuffer(gl.RENDERBUFFER, this.depthBuffer);
      gl.renderbufferStorage(gl.RENDERBUFFER, gl.DEPTH_COMPONENT16, width, height);
      gl.bindRenderbuffer(gl.RENDERBUFFER, null);
    }
    if (this.depthColour && this.depthBuffer) {
      gl.bindFramebuffer(gl.FRAMEBUFFER, this.depthColour.framebuffer);
      gl.framebufferRenderbuffer(
        gl.FRAMEBUFFER,
        gl.DEPTH_ATTACHMENT,
        gl.RENDERBUFFER,
        this.depthBuffer,
      );
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    }

    this.bloomA = [];
    this.bloomB = [];
    for (let i = 0; i < BLOOM_LEVELS; i++) {
      const divisor = 2 << i;
      const a = this.hdr(Math.ceil(width / divisor), Math.ceil(height / divisor), `bloom ${i} a`);
      const b = this.hdr(Math.ceil(width / divisor), Math.ceil(height / divisor), `bloom ${i} b`);
      if (!a || !b) return false;
      this.bloomA.push(a);
      this.bloomB.push(b);
    }

    return Boolean(this.scene && this.composed && this.defocused && this.depthColour);
  }

  get sceneTarget() {
    return this.scene;
  }

  get depthTarget() {
    return this.depthColour;
  }

  private pass(target: Target | null, draw: () => void) {
    const gl = this.gl;
    if (target) {
      gl.bindFramebuffer(gl.FRAMEBUFFER, target.framebuffer);
      gl.viewport(0, 0, target.width, target.height);
    } else {
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
      gl.viewport(0, 0, this.width, this.height);
    }
    gl.disable(gl.BLEND);
    gl.disable(gl.DEPTH_TEST);
    draw();
    this.fullscreen.draw();
  }

  /* Everything after the particles have been drawn into the scene target. */
  /* Everything after the particles have been drawn into the scene target. */
  render(
    level: PostLevel,
    config: ParticleBrainConfig,
    seconds: number,
    mask: CloudMask,
  ) {
    const gl = this.gl;
    if (!this.scene || !this.composed || !this.defocused) return;

    let source: Target = this.scene;

    if (level !== "minimal" && this.bloomA.length === BLOOM_LEVELS) {
      this.pass(this.bloomA[0]!, () => {
        gl.useProgram(this.brightProgram);
        bindTexture(gl, 0, this.scene!.texture, this.brightUniforms.t_source ?? null);
        gl.uniform1f(this.brightUniforms.u_threshold ?? null, config.bloomThreshold);
      });

      /* Each level is the one above it, blurred horizontally into a target of
         half the size, then blurred vertically back. The downsample and the
         horizontal half of the Gaussian are the same pass, which is why the
         widest blur is also the cheapest. */
      for (let i = 0; i < BLOOM_LEVELS; i++) {
        const source = i === 0 ? this.bloomA[0]! : this.bloomA[i - 1]!;
        const scratch = this.bloomB[i]!;
        const destination = this.bloomA[i]!;

        this.pass(scratch, () => {
          gl.useProgram(this.blurProgram);
          bindTexture(gl, 0, source.texture, this.blurUniforms.t_source ?? null);
          gl.uniform2f(this.blurUniforms.u_direction ?? null, 1 / source.width, 0);
          gl.uniform1f(this.blurUniforms.u_radius ?? null, config.bloomRadius);
        });
        this.pass(destination, () => {
          gl.useProgram(this.blurProgram);
          bindTexture(gl, 0, scratch.texture, this.blurUniforms.t_source ?? null);
          gl.uniform2f(this.blurUniforms.u_direction ?? null, 0, 1 / scratch.height);
          gl.uniform1f(this.blurUniforms.u_radius ?? null, config.bloomRadius);
        });
      }

      this.pass(this.composed, () => {
        gl.useProgram(this.bloomProgram);
        bindTexture(gl, 0, this.scene!.texture, this.bloomUniforms.t_scene ?? null);
        for (let i = 0; i < BLOOM_LEVELS; i++) {
          bindTexture(gl, 1 + i, this.bloomA[i]!.texture, this.bloomUniforms[`t_level${i}`] ?? null);
        }
        gl.uniform1f(this.bloomUniforms.u_strength ?? null, config.bloomStrength);
      });
      source = this.composed;
    }

    if (level === "full" && this.depthColour) {
      const from = source;
      this.pass(this.defocused, () => {
        gl.useProgram(this.bokehProgram);
        bindTexture(gl, 0, from.texture, this.bokehUniforms.t_source ?? null);
        bindTexture(gl, 1, this.depthColour!.texture, this.bokehUniforms.t_depth ?? null);
        gl.uniform2f(this.bokehUniforms.u_texel ?? null, 1 / this.width, 1 / this.height);
        gl.uniform1f(this.bokehUniforms.u_focalDepth ?? null, BOKEH_FOCAL_DEPTH);
        /* The reference aperture is expressed against a different depth range.
           Scaled here so the visible amount of defocus matches rather than the
           number, which is what the specification asks for: start from the
           value, then tune by looking. */
        gl.uniform1f(this.bokehUniforms.u_aperture ?? null, BOKEH_APERTURE * 900000);
        gl.uniform1f(this.bokehUniforms.u_rings ?? null, BOKEH_RINGS);
        gl.uniform1f(this.bokehUniforms.u_samples ?? null, BOKEH_SAMPLES);
      });
      source = this.defocused;
    }

    const last = source;
    this.pass(null, () => {
      gl.useProgram(this.finalProgram);
      bindTexture(gl, 0, last.texture, this.finalUniforms.t_source ?? null);
      gl.uniform1f(this.finalUniforms.u_time ?? null, seconds);
      gl.uniform1f(this.finalUniforms.u_vignetteOffset ?? null, config.vignetteOffset);
      gl.uniform1f(this.finalUniforms.u_vignetteDarkness ?? null, config.vignetteDarkness);
      gl.uniform1f(
        this.finalUniforms.u_grain ?? null,
        level === "full" ? config.grainStrength : config.grainStrength * 0.6,
      );
      gl.uniform1f(this.finalUniforms.u_exposure ?? null, EXPOSURE);
      gl.uniform1f(this.finalUniforms.u_maskEdge ?? null, mask.edge);
      gl.uniform1f(this.finalUniforms.u_maskSide ?? null, mask.side);
      gl.uniform1f(this.finalUniforms.u_maskFeather ?? null, mask.feather);
      gl.uniform1f(this.finalUniforms.u_gapCentre ?? null, mask.gapCentre);
      gl.uniform1f(this.finalUniforms.u_gapHalf ?? null, mask.gapHalf);
      gl.uniform1f(this.finalUniforms.u_maskOff ?? null, mask.off ? 1 : 0);
    });
  }

  private release() {
    const gl = this.gl;
    for (const target of [this.scene, this.composed, this.defocused, this.depthColour]) {
      disposeTarget(gl, target);
    }
    for (const target of [...this.bloomA, ...this.bloomB]) disposeTarget(gl, target);
    if (this.depthBuffer) gl.deleteRenderbuffer(this.depthBuffer);
    this.scene = null;
    this.composed = null;
    this.defocused = null;
    this.depthColour = null;
    this.depthBuffer = null;
    this.bloomA = [];
    this.bloomB = [];
  }

  dispose() {
    this.release();
    const gl = this.gl;
    for (const program of [
      this.brightProgram,
      this.blurProgram,
      this.bloomProgram,
      this.bokehProgram,
      this.finalProgram,
    ]) {
      gl.deleteProgram(program);
    }
  }
}
