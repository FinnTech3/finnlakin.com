import type { EntryField } from "./entrance";
import { bindTexture, createTexture, FULLSCREEN_VERTEX, link, locations } from "./gl";
import { PingPong } from "./ping-pong";
import type { Capability } from "./quality";
import { POSITION_FRAGMENT, VELOCITY_FRAGMENT } from "./shaders/simulation";
import type { TargetSet } from "./targets";
import { toHalfArray } from "./pack";
import type { ParticleBrainConfig } from "./types";

/* The simulation: two full screen passes a frame, and everything a particle
   knows about itself living in the textures between them.

   The order these run in is not a detail. Velocity is written first, reading
   the previous position and the previous velocity. It is swapped, so that the
   position pass reads the velocity that was just written rather than the one
   before it. Getting that backwards gives you a system that lags its own forces
   by a frame, which does not look broken, it just feels heavy, and it is nearly
   impossible to find by reading the shaders. */

type Fullscreen = { draw: () => void; dispose: () => void };

export type SimulationInputs = {
  progress: number;
  explode: number;
  show: number;
  /* Where the pointer is, in the simulation's own space, and how open the hole
     around it should be. */
  pointer: [number, number, number];
  pointerActive: number;
  /* How fast the pointer is moving, nought to one. */
  pointerSpeed: number;
};

export class ParticleSimulation {
  private gl: WebGL2RenderingContext;
  private capability: Capability;
  private fullscreen: Fullscreen;
  private gridSize: number;
  private simSize: number;

  private velocityProgram: WebGLProgram;
  private positionProgram: WebGLProgram;
  private velocityUniforms: Record<string, WebGLUniformLocation | null>;
  private positionUniforms: Record<string, WebGLUniformLocation | null>;

  private positions: PingPong;
  private velocities: PingPong;

  private targetTexture: WebGLTexture;
  private scaleTexture: WebGLTexture;
  private colourTexture: WebGLTexture;
  private param1: WebGLTexture;
  private param2: WebGLTexture;
  private param3: WebGLTexture;

  private constructor(parts: {
    gl: WebGL2RenderingContext;
    capability: Capability;
    fullscreen: Fullscreen;
    gridSize: number;
    velocityProgram: WebGLProgram;
    positionProgram: WebGLProgram;
    positions: PingPong;
    velocities: PingPong;
    targetTexture: WebGLTexture;
    scaleTexture: WebGLTexture;
    colourTexture: WebGLTexture;
    param1: WebGLTexture;
    param2: WebGLTexture;
    param3: WebGLTexture;
  }) {
    this.gl = parts.gl;
    this.capability = parts.capability;
    this.fullscreen = parts.fullscreen;
    this.gridSize = parts.gridSize;
    this.simSize = parts.gridSize * 2;
    this.velocityProgram = parts.velocityProgram;
    this.positionProgram = parts.positionProgram;
    this.positions = parts.positions;
    this.velocities = parts.velocities;
    this.targetTexture = parts.targetTexture;
    this.scaleTexture = parts.scaleTexture;
    this.colourTexture = parts.colourTexture;
    this.param1 = parts.param1;
    this.param2 = parts.param2;
    this.param3 = parts.param3;

    this.velocityUniforms = locations(this.gl, this.velocityProgram, [
      "t_targets",
      "t_position",
      "t_velocity",
      "t_param1",
      "t_param2",
      "t_param3",
      "u_progress",
      "u_morphDelay",
      "u_secondaryDelay",
      "u_explosionDelay",
      "u_length",
      "u_spring",
      "u_friction",
      "u_explode",
      "u_show",
      "u_entryWindow",
      "u_pointer",
      "u_pointerReach",
      "u_pointerPush",
      "u_pointerSwirl",
      "u_pointerActive",
      "u_pointerSpeed",
    ]);
    this.positionUniforms = locations(this.gl, this.positionProgram, [
      "t_position",
      "t_velocity",
    ]);
  }

  static create(
    gl: WebGL2RenderingContext,
    capability: Capability,
    fullscreen: Fullscreen,
    set: TargetSet,
    /* Where each particle starts. Null seeds every particle already at its
       target, which is what a reader who asked for less motion gets: no
       entrance, because an entrance is the motion they asked not to have. */
    entry: EntryField | null,
  ): ParticleSimulation | null {
    const velocityProgram = link(gl, FULLSCREEN_VERTEX, VELOCITY_FRAGMENT, "velocity simulation");
    const positionProgram = link(gl, FULLSCREEN_VERTEX, POSITION_FRAGMENT, "position simulation");
    if (!velocityProgram || !positionProgram) return null;

    const simSize = set.gridSize * 2;
    const positions = PingPong.create(gl, simSize, capability, "position");
    const velocities = PingPong.create(gl, simSize, capability, "velocity");
    if (!positions || !velocities) {
      positions?.dispose(gl);
      velocities?.dispose(gl);
      return null;
    }

    const data = (source: Float32Array) =>
      capability.simType === gl.FLOAT ? source : toHalfArray(source);

    const full = (source: Float32Array) =>
      createTexture(gl, {
        width: simSize,
        height: simSize,
        internalFormat: capability.simInternal,
        format: capability.simFormat,
        type: capability.simType,
        data: data(source),
      });
    const grid = (source: Float32Array) =>
      createTexture(gl, {
        width: set.gridSize,
        height: set.gridSize,
        internalFormat: capability.simInternal,
        format: capability.simFormat,
        type: capability.simType,
        data: data(source),
      });

    const targetTexture = full(set.positions);
    const scaleTexture = full(set.scales);
    const colourTexture = full(set.colours);
    const param1 = grid(set.param1);
    const param2 = grid(set.param2);
    const param3 = grid(set.param3);

    if (!targetTexture || !scaleTexture || !colourTexture || !param1 || !param2 || !param3) {
      positions.dispose(gl);
      velocities.dispose(gl);
      for (const texture of [targetTexture, scaleTexture, colourTexture, param1, param2, param3]) {
        if (texture) gl.deleteTexture(texture);
      }
      return null;
    }

    const simulation = new ParticleSimulation({
      gl,
      capability,
      fullscreen,
      gridSize: set.gridSize,
      velocityProgram,
      positionProgram,
      positions,
      velocities,
      targetTexture,
      scaleTexture,
      colourTexture,
      param1,
      param2,
      param3,
    });

    simulation.seed(set, entry);
    return simulation;
  }

  /* The first position every particle holds.

     Off the edge of the screen, all the way round it, and the velocity texture
     left at zero: nothing moves until the reveal releases its spring. The
     alternative, seeding them settled and letting the reveal push them out
     first, is what this used to do in a milder form, and it has the flaw that
     the first thing the reader sees is the finished picture coming apart. */
  private seed(set: TargetSet, entry: EntryField | null) {
    const { gl } = this;
    const width = this.simSize;
    const seeded = new Float32Array(width * width * 4);

    for (let i = 0; i < set.count; i++) {
      const gx = i % this.gridSize;
      const gy = Math.floor(i / this.gridSize);
      const texel = (gy * width + gx) * 4;
      if (entry) {
        entry(seeded, texel);
      } else {
        for (let axis = 0; axis < 3; axis++) seeded[texel + axis] = set.positions[texel + axis]!;
      }
      seeded[texel + 3] = 1;
    }

    const payload = this.capability.simType === gl.FLOAT ? seeded : toHalfArray(seeded);
    this.positions.seed(gl, this.capability, payload);
    this.velocities.clear(gl);
  }

  /* Swap in a different set of four shapes without disturbing the simulation.

     The opening animation and the scrolling page use different target
     textures: the first holds two words and the brain, the second holds the
     brain and the three shapes it morphs through. Uploading over the existing
     textures rather than allocating new ones keeps every particle's position
     and velocity exactly as it was, which is what makes the handover between
     them invisible: the cloud does not restart, it simply finds that its
     destination has changed. */
  setTargets(set: TargetSet) {
    const { gl } = this;
    const data = (source: Float32Array) =>
      this.capability.simType === gl.FLOAT ? source : toHalfArray(source);

    const upload = (texture: WebGLTexture, source: Float32Array, size: number) => {
      gl.bindTexture(gl.TEXTURE_2D, texture);
      gl.texSubImage2D(
        gl.TEXTURE_2D,
        0,
        0,
        0,
        size,
        size,
        this.capability.simFormat,
        this.capability.simType,
        data(source),
      );
    };

    upload(this.targetTexture, set.positions, this.simSize);
    upload(this.scaleTexture, set.scales, this.simSize);
    upload(this.colourTexture, set.colours, this.simSize);
    upload(this.param1, set.param1, this.gridSize);
    upload(this.param2, set.param2, this.gridSize);
    upload(this.param3, set.param3, this.gridSize);
    gl.bindTexture(gl.TEXTURE_2D, null);
  }

  get positionTexture() {
    return this.positions.read.texture;
  }

  get scale() {
    return this.scaleTexture;
  }

  get colour() {
    return this.colourTexture;
  }

  /* One step. Both passes render into the lower left quarter of a target that
     is twice the grid on each side.

     The target is that size because it has to hold four shapes; the state only
     ever needs one quarter of it. Setting the viewport to the grid rather than
     to the whole texture means three quarters of the pixels are never shaded,
     which costs nothing to do and would cost four times the fill rate not to. */
  step(inputs: SimulationInputs, config: ParticleBrainConfig, mobile: boolean) {
    const { gl } = this;
    const morphDelay = mobile ? config.morphDelayMobile : config.morphDelayDesktop;

    gl.disable(gl.BLEND);
    gl.disable(gl.DEPTH_TEST);
    gl.viewport(0, 0, this.gridSize, this.gridSize);

    gl.useProgram(this.velocityProgram);
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.velocities.write.framebuffer);
    bindTexture(gl, 0, this.targetTexture, this.velocityUniforms.t_targets ?? null);
    bindTexture(gl, 1, this.positions.read.texture, this.velocityUniforms.t_position ?? null);
    bindTexture(gl, 2, this.velocities.read.texture, this.velocityUniforms.t_velocity ?? null);
    bindTexture(gl, 3, this.param1, this.velocityUniforms.t_param1 ?? null);
    bindTexture(gl, 4, this.param2, this.velocityUniforms.t_param2 ?? null);
    bindTexture(gl, 5, this.param3, this.velocityUniforms.t_param3 ?? null);
    gl.uniform1f(this.velocityUniforms.u_progress ?? null, inputs.progress);
    gl.uniform1f(this.velocityUniforms.u_morphDelay ?? null, morphDelay);
    gl.uniform1f(this.velocityUniforms.u_secondaryDelay ?? null, config.secondaryMorphDelay);
    gl.uniform1f(this.velocityUniforms.u_explosionDelay ?? null, config.explosionDelay);
    gl.uniform1f(this.velocityUniforms.u_length ?? null, this.gridSize * this.gridSize);
    gl.uniform1f(this.velocityUniforms.u_spring ?? null, config.spring);
    gl.uniform1f(this.velocityUniforms.u_friction ?? null, config.friction);
    gl.uniform1f(this.velocityUniforms.u_explode ?? null, inputs.explode);
    gl.uniform1f(this.velocityUniforms.u_show ?? null, inputs.show);
    gl.uniform1f(this.velocityUniforms.u_entryWindow ?? null, config.entryWindow);
    gl.uniform3f(
      this.velocityUniforms.u_pointer ?? null,
      inputs.pointer[0],
      inputs.pointer[1],
      inputs.pointer[2],
    );
    gl.uniform1f(this.velocityUniforms.u_pointerReach ?? null, config.pointerReach);
    gl.uniform1f(this.velocityUniforms.u_pointerPush ?? null, config.pointerPush);
    gl.uniform1f(this.velocityUniforms.u_pointerSwirl ?? null, config.pointerSwirl);
    gl.uniform1f(this.velocityUniforms.u_pointerActive ?? null, inputs.pointerActive);
    gl.uniform1f(this.velocityUniforms.u_pointerSpeed ?? null, inputs.pointerSpeed);
    this.fullscreen.draw();
    this.velocities.swap();

    gl.useProgram(this.positionProgram);
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.positions.write.framebuffer);
    bindTexture(gl, 0, this.positions.read.texture, this.positionUniforms.t_position ?? null);
    bindTexture(gl, 1, this.velocities.read.texture, this.positionUniforms.t_velocity ?? null);
    this.fullscreen.draw();
    this.positions.swap();

    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  }

  dispose() {
    const { gl } = this;
    this.positions.dispose(gl);
    this.velocities.dispose(gl);
    gl.deleteTexture(this.targetTexture);
    gl.deleteTexture(this.scaleTexture);
    gl.deleteTexture(this.colourTexture);
    gl.deleteTexture(this.param1);
    gl.deleteTexture(this.param2);
    gl.deleteTexture(this.param3);
    gl.deleteProgram(this.velocityProgram);
    gl.deleteProgram(this.positionProgram);
  }
}
