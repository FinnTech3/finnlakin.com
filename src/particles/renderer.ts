import { bindTexture, link, locations } from "./gl";
import { instanceAttributes, pyramid } from "./geometry";
import { mulberry32 } from "./pack";
import { perspective, view, type Mat4 } from "./matrix";
import { DEPTH_FRAGMENT, PARTICLE_FRAGMENT, PARTICLE_VERTEX } from "./shaders/particle";
import type { ParticleBrainConfig, ParticleTimelineState } from "./types";

/* One draw call, ten thousand pyramids.

   The geometry buffer holds twelve vertices. Everything that distinguishes one
   particle from another is either a per instance attribute uploaded once at
   startup or a texture read in the vertex stage, so the only thing that changes
   between frames is a handful of uniforms. Nothing per particle crosses the bus
   after the first frame, which is the difference between this and a system that
   updates ten thousand matrices on the processor.

   Blending is additive with the depth test off, and that is a deliberate
   departure worth stating. The alternative, depth tested transparency, needs
   the particles sorted back to front every frame, which at this count is the
   one thing the performance rules forbid outright. Additive commutes, so there
   is nothing to sort, and density becomes brightness on its own, which is what
   the look is made of.

   Additive alone would clip to white in the dense middle, which is exactly how
   this went wrong when it was tried on a flat canvas. What saves it here is
   that the particles accumulate into a half float target and the final pass
   tone maps: over bright values roll off towards white instead of being
   truncated at it. Additive without the tone map is a white blob, and the tone
   map without additive is flat. They only work as a pair. */

const CAMERA_FOV = 50;
const CAMERA_NEAR = 0.1;
const CAMERA_FAR = 30;
const CAMERA_POSITION: [number, number, number] = [0, 0, 10];

export type RenderInputs = {
  timeline: ParticleTimelineState;
  seconds: number;
  mouse: { x: number; y: number };
  pitch: number;
  yaw: number;
  instances: number;
  mobile: boolean;
};

const UNIFORMS = [
  "t_position",
  "t_scale",
  "t_colour",
  "u_projection",
  "u_view",
  "u_factor",
  "u_time",
  "u_scale",
  "u_amplitude",
  "u_colourFactor",
  "u_progress",
  "u_explode",
  "u_mobileRotation",
  "u_offset",
  "u_rotation",
  "u_camera",
  "u_mouse",
  "u_near",
  "u_far",
] as const;

export class ParticleRenderer {
  private gl: WebGL2RenderingContext;
  private vertexArray: WebGLVertexArrayObject;
  private buffers: WebGLBuffer[];
  private colourProgram: WebGLProgram;
  private depthProgram: WebGLProgram;
  private colourUniforms: Record<string, WebGLUniformLocation | null>;
  private depthUniforms: Record<string, WebGLUniformLocation | null>;
  private vertexCount: number;
  private projection: Mat4;
  private aspect = 1;

  private constructor(parts: {
    gl: WebGL2RenderingContext;
    vertexArray: WebGLVertexArrayObject;
    buffers: WebGLBuffer[];
    colourProgram: WebGLProgram;
    depthProgram: WebGLProgram;
    vertexCount: number;
  }) {
    this.gl = parts.gl;
    this.vertexArray = parts.vertexArray;
    this.buffers = parts.buffers;
    this.colourProgram = parts.colourProgram;
    this.depthProgram = parts.depthProgram;
    this.vertexCount = parts.vertexCount;
    this.colourUniforms = locations(this.gl, this.colourProgram, UNIFORMS);
    this.depthUniforms = locations(this.gl, this.depthProgram, UNIFORMS);
    this.projection = perspective(CAMERA_FOV, 1, CAMERA_NEAR, CAMERA_FAR);
  }

  static create(gl: WebGL2RenderingContext, gridSize: number): ParticleRenderer | null {
    const colourProgram = link(gl, PARTICLE_VERTEX, PARTICLE_FRAGMENT, "particle");
    /* The same vertex source as the colour pass, deliberately. If the depth
       pass transformed particles even slightly differently, the depth of field
       would blur the wrong ones, and that is the kind of fault that reads as
       the whole effect being subtly cheap without ever looking like a bug. */
    const depthProgram = link(gl, PARTICLE_VERTEX, DEPTH_FRAGMENT, "particle depth");
    if (!colourProgram || !depthProgram) {
      if (colourProgram) gl.deleteProgram(colourProgram);
      if (depthProgram) gl.deleteProgram(depthProgram);
      return null;
    }

    const geometry = pyramid();
    const instances = instanceAttributes(gridSize, mulberry32(9001));

    const vertexArray = gl.createVertexArray();
    if (!vertexArray) return null;
    gl.bindVertexArray(vertexArray);

    const buffers: WebGLBuffer[] = [];
    const attribute = (
      location: number,
      data: Float32Array,
      size: number,
      divisor: number,
    ): boolean => {
      const buffer = gl.createBuffer();
      if (!buffer) return false;
      buffers.push(buffer);
      gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
      gl.bufferData(gl.ARRAY_BUFFER, data, gl.STATIC_DRAW);
      gl.enableVertexAttribArray(location);
      gl.vertexAttribPointer(location, size, gl.FLOAT, false, 0, 0);
      gl.vertexAttribDivisor(location, divisor);
      return true;
    };

    const ok =
      attribute(0, geometry.vertices, 3, 0) &&
      attribute(1, geometry.normals, 3, 0) &&
      attribute(2, instances.ids, 2, 1) &&
      attribute(3, instances.randoms, 4, 1) &&
      attribute(4, instances.indices, 1, 1);

    gl.bindVertexArray(null);
    gl.bindBuffer(gl.ARRAY_BUFFER, null);

    if (!ok) {
      for (const buffer of buffers) gl.deleteBuffer(buffer);
      gl.deleteVertexArray(vertexArray);
      gl.deleteProgram(colourProgram);
      gl.deleteProgram(depthProgram);
      return null;
    }

    return new ParticleRenderer({
      gl,
      vertexArray,
      buffers,
      colourProgram,
      depthProgram,
      vertexCount: geometry.vertexCount,
    });
  }

  resize(width: number, height: number) {
    this.aspect = height > 0 ? width / height : 1;
    this.projection = perspective(CAMERA_FOV, this.aspect, CAMERA_NEAR, CAMERA_FAR);
  }

  private setUniforms(
    uniforms: Record<string, WebGLUniformLocation | null>,
    inputs: RenderInputs,
    config: ParticleBrainConfig,
    position: WebGLTexture,
    scale: WebGLTexture,
    colour: WebGLTexture,
  ) {
    const { gl } = this;
    const { timeline } = inputs;

    bindTexture(gl, 0, position, uniforms.t_position ?? null);
    bindTexture(gl, 1, scale, uniforms.t_scale ?? null);
    bindTexture(gl, 2, colour, uniforms.t_colour ?? null);

    gl.uniformMatrix4fv(uniforms.u_projection ?? null, false, this.projection);
    gl.uniformMatrix4fv(
      uniforms.u_view ?? null,
      false,
      view(CAMERA_POSITION, inputs.pitch, inputs.yaw),
    );

    gl.uniform1f(uniforms.u_factor ?? null, timeline.factor);
    gl.uniform1f(uniforms.u_time ?? null, inputs.seconds);
    gl.uniform1f(
      uniforms.u_scale ?? null,
      inputs.mobile ? config.particleScaleMobile : config.particleScaleDesktop,
    );
    gl.uniform1f(uniforms.u_amplitude ?? null, config.noiseAmplitude);
    gl.uniform1f(uniforms.u_colourFactor ?? null, config.colourFactor);
    gl.uniform1f(uniforms.u_progress ?? null, timeline.progress);
    gl.uniform1f(uniforms.u_explode ?? null, timeline.explode);
    gl.uniform1f(uniforms.u_mobileRotation ?? null, inputs.mobile ? 1 : 0);
    gl.uniform3f(uniforms.u_offset ?? null, timeline.offset.x, timeline.offset.y, timeline.offset.z);
    gl.uniform3f(
      uniforms.u_rotation ?? null,
      timeline.rotation.x,
      timeline.rotation.y,
      timeline.rotation.z,
    );
    gl.uniform3f(uniforms.u_camera ?? null, ...CAMERA_POSITION);
    gl.uniform2f(uniforms.u_mouse ?? null, inputs.mouse.x, inputs.mouse.y);
    gl.uniform1f(uniforms.u_near ?? null, CAMERA_NEAR);
    gl.uniform1f(uniforms.u_far ?? null, CAMERA_FAR);
  }

  /* The lit pass, accumulating into whatever target is bound. */
  drawColour(
    inputs: RenderInputs,
    config: ParticleBrainConfig,
    position: WebGLTexture,
    scale: WebGLTexture,
    colour: WebGLTexture,
  ) {
    const { gl } = this;
    gl.useProgram(this.colourProgram);
    gl.disable(gl.DEPTH_TEST);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.ONE, gl.ONE);
    this.setUniforms(this.colourUniforms, inputs, config, position, scale, colour);
    gl.bindVertexArray(this.vertexArray);
    gl.drawArraysInstanced(gl.TRIANGLES, 0, this.vertexCount, inputs.instances);
    gl.bindVertexArray(null);
    gl.disable(gl.BLEND);
  }

  /* The depth pass. Here the depth test is on and writing, because a depth map
     wants the nearest particle at each pixel rather than a sum of all of them. */
  drawDepth(
    inputs: RenderInputs,
    config: ParticleBrainConfig,
    position: WebGLTexture,
    scale: WebGLTexture,
    colour: WebGLTexture,
  ) {
    const { gl } = this;
    gl.useProgram(this.depthProgram);
    gl.disable(gl.BLEND);
    gl.enable(gl.DEPTH_TEST);
    gl.depthFunc(gl.LESS);
    gl.depthMask(true);
    this.setUniforms(this.depthUniforms, inputs, config, position, scale, colour);
    gl.bindVertexArray(this.vertexArray);
    gl.drawArraysInstanced(gl.TRIANGLES, 0, this.vertexCount, inputs.instances);
    gl.bindVertexArray(null);
    gl.disable(gl.DEPTH_TEST);
  }

  dispose() {
    const { gl } = this;
    for (const buffer of this.buffers) gl.deleteBuffer(buffer);
    gl.deleteVertexArray(this.vertexArray);
    gl.deleteProgram(this.colourProgram);
    gl.deleteProgram(this.depthProgram);
  }
}
