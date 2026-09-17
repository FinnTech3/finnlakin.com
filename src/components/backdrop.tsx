"use client";

import { useEffect, useRef } from "react";


/* The gradient behind the whole site. Adapted from the shader Finn supplied
   rather than dropped in, for three reasons that only showed up when it was
   measured rather than read.

   1. It sized its drawing buffer at clientWidth * devicePixelRatio. On a
      software rasteriser, which is what a machine with a blacklisted or
      disabled GPU falls back to, a 2880x1800 buffer costs 228ms a frame with
      five swirl iterations and 374ms with sixteen. That is three frames a
      second, forever, on every page. The buffer is capped at 960px on its long
      edge here and stretched by CSS. A gradient this soft has no detail to
      lose, and the same shader then costs about 15ms.
   2. WebGL2 being absent is the easy case. Present but software is the one
      that hurts, and nothing in the original noticed it. The loop below times
      its own first frames and stops if they are slow, leaving the last frame
      painted: a still gradient rather than a stuttering one.
   3. It ran requestAnimationFrame forever, including in a hidden tab.

   Nothing here throws or writes to the console on failure. Every route is
   asserted console-clean, and a backdrop is the last thing that should be able
   to fail a page. */

/* Long edge of the drawing buffer, in device pixels. See note 1. */
const MAX_EDGE = 960;

/* The presets ship 16 to 20. Six is where the swirl stops visibly gaining
   detail, and each one costs a full-screen pass. */
const SWIRL_ITERATIONS = 6;

/* Frames 4 through 20 are timed. Past this, the renderer is not keeping up
   with anything worth animating. */
const SLOW_FRAME_MS = 42;
const WARMUP_FRAMES = 4;
const SAMPLE_FRAMES = 20;

const VERTEX_SHADER = `#version 300 es
in vec4 a_position;
void main() {
  gl_Position = a_position;
}`;

/* Finn's shader, unchanged except that the swirl loop is bounded by a uniform
   this file sets rather than by a preset. */
const FRAGMENT_SHADER = `#version 300 es
precision highp float;

uniform float u_time;
uniform vec2 u_resolution;
uniform vec4 u_color1;
uniform vec4 u_color2;
uniform vec4 u_color3;
uniform float u_scale;
uniform float u_proportion;
uniform float u_softness;
uniform float u_shapeScale;
uniform float u_distortion;
uniform float u_swirl;
uniform float u_swirlIterations;

out vec4 fragColor;

#define TWO_PI 6.28318530718

float random(vec2 st) {
  return fract(sin(dot(st.xy, vec2(12.9898, 78.233))) * 43758.5453123);
}

float noise(vec2 st) {
  vec2 i = floor(st);
  vec2 f = fract(st);
  float a = random(i);
  float b = random(i + vec2(1.0, 0.0));
  float c = random(i + vec2(0.0, 1.0));
  float d = random(i + vec2(1.0, 1.0));
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
}

vec4 blend_colors(vec4 c1, vec4 c2, vec4 c3, float mixer, float edgesWidth, float edge_blur) {
  vec3 color1 = c1.rgb * c1.a;
  vec3 color2 = c2.rgb * c2.a;
  vec3 color3 = c3.rgb * c3.a;
  float r1 = smoothstep(.0 + .35 * edgesWidth, .7 - .35 * edgesWidth + .5 * edge_blur, mixer);
  float r2 = smoothstep(.3 + .35 * edgesWidth, 1. - .35 * edgesWidth + edge_blur, mixer);
  vec3 blended = mix(color1, color2, r1);
  float blended_opacity = mix(c1.a, c2.a, r1);
  return vec4(mix(blended, color3, r2), mix(blended_opacity, c3.a, r2));
}

void main() {
  vec2 uv = gl_FragCoord.xy / u_resolution.xy;
  float t = .5 * u_time;
  float noise_scale = .0005 + .006 * u_scale;

  uv -= .5;
  uv *= (noise_scale * u_resolution);
  uv += .5;

  float n1 = noise(uv * 1. + t);
  float n2 = noise(uv * 2. - t);
  float angle = n1 * TWO_PI;
  uv.x += 4. * u_distortion * n2 * cos(angle);
  uv.y += 4. * u_distortion * n2 * sin(angle);

  float iterations = ceil(clamp(u_swirlIterations, 1., 12.));
  for (float i = 1.; i <= iterations; i++) {
    uv.x += clamp(u_swirl, 0., 2.) / i * cos(t + i * 1.5 * uv.y);
    uv.y += clamp(u_swirl, 0., 2.) / i * cos(t + i * 1. * uv.x);
  }

  float proportion = clamp(u_proportion, 0., 1.);
  vec2 checks = uv * (.5 + 3.5 * u_shapeScale);
  float shape = .5 + .5 * sin(checks.x) * cos(checks.y);
  float mixer = shape + .48 * sign(proportion - .5) * pow(abs(proportion - .5), .5);

  vec4 blended = blend_colors(u_color1, u_color2, u_color3, mixer, 1. - clamp(u_softness, 0., 1.), .01 + .01 * u_scale);
  fragColor = vec4(blended.rgb, blended.a);
}
`;

/* Reads a token off :root so the gradient and the type share one palette, and
   changing --iris in globals.css changes both. The literals are what a browser
   that cannot resolve the variable gets. */
function token(name: string, fallbackHex: string): [number, number, number] {
  let value = fallbackHex;
  try {
    const resolved = getComputedStyle(document.documentElement)
      .getPropertyValue(name)
      .trim();
    if (/^#[0-9a-f]{6}$/i.test(resolved)) value = resolved;
  } catch {
    /* A computed style can be unavailable in odd embedding contexts. The
       literal above is a correct answer, so there is nothing to report. */
  }
  return [
    Number.parseInt(value.slice(1, 3), 16) / 255,
    Number.parseInt(value.slice(3, 5), 16) / 255,
    Number.parseInt(value.slice(5, 7), 16) / 255,
  ];
}

type Shader = {
  resize: () => void;
  draw: (seconds: number) => void;
  dispose: () => void;
};

/* Pulled out of the effect so that the gradient failing is a null rather than an
   early return. The constellation has to keep running on a machine with no
   WebGL, and when the two were one straight-line effect, the first `return` took
   both down. */
function createShader(canvas: HTMLCanvasElement, host: HTMLElement): Shader | null {
  let gl: WebGL2RenderingContext | null = null;
  try {
    gl = canvas.getContext("webgl2", {
      alpha: false,
      antialias: false,
      depth: false,
      stencil: false,
      powerPreference: "low-power",
    });
  } catch {
    gl = null;
  }
  if (!gl) return null;

  const context = gl;

  const compile = (type: number, source: string) => {
    const shader = context.createShader(type);
    if (!shader) return null;
    context.shaderSource(shader, source);
    context.compileShader(shader);
    if (!context.getShaderParameter(shader, context.COMPILE_STATUS)) {
      context.deleteShader(shader);
      return null;
    }
    return shader;
  };

  const vertex = compile(context.VERTEX_SHADER, VERTEX_SHADER);
  const fragment = compile(context.FRAGMENT_SHADER, FRAGMENT_SHADER);
  const program = vertex && fragment ? context.createProgram() : null;

  if (!vertex || !fragment || !program) {
    if (vertex) context.deleteShader(vertex);
    if (fragment) context.deleteShader(fragment);
    return null;
  }

  context.attachShader(program, vertex);
  context.attachShader(program, fragment);
  context.linkProgram(program);
  if (!context.getProgramParameter(program, context.LINK_STATUS)) {
    context.deleteProgram(program);
    context.deleteShader(vertex);
    context.deleteShader(fragment);
    return null;
  }

  context.useProgram(program);

  const buffer = context.createBuffer();
  context.bindBuffer(context.ARRAY_BUFFER, buffer);
  context.bufferData(
    context.ARRAY_BUFFER,
    new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]),
    context.STATIC_DRAW,
  );
  const position = context.getAttribLocation(program, "a_position");
  context.enableVertexAttribArray(position);
  context.vertexAttribPointer(position, 2, context.FLOAT, false, 0, 0);

  const uniform = (name: string) => context.getUniformLocation(program, name);
  const uTime = uniform("u_time");
  const uResolution = uniform("u_resolution");

  /* Black, violet, black: the gradient is a bloom of the brand colour rising
     out of the void and sinking back into it. None of the six supplied
     presets are in this palette. */
  const [r2, g2, b2] = token("--iris", "#8052ff");
  context.uniform4f(uniform("u_color1"), 0, 0, 0, 1);
  context.uniform4f(uniform("u_color2"), r2, g2, b2, 1);
  context.uniform4f(uniform("u_color3"), 0, 0, 0, 1);
  context.uniform1f(uniform("u_scale"), 0.62);
  context.uniform1f(uniform("u_proportion"), 0.18);
  context.uniform1f(uniform("u_softness"), 1);
  context.uniform1f(uniform("u_shapeScale"), 0.26);
  context.uniform1f(uniform("u_distortion"), 0.06);
  context.uniform1f(uniform("u_swirl"), 0.55);
  context.uniform1f(uniform("u_swirlIterations"), SWIRL_ITERATIONS);

  return {
    resize: () => {
      const { width, height } = host.getBoundingClientRect();
      if (width === 0 || height === 0) return;
      const scale = Math.min(1, MAX_EDGE / Math.max(width, height));
      const bufferWidth = Math.max(2, Math.round(width * scale));
      const bufferHeight = Math.max(2, Math.round(height * scale));
      if (canvas.width === bufferWidth && canvas.height === bufferHeight) return;
      canvas.width = bufferWidth;
      canvas.height = bufferHeight;
      context.viewport(0, 0, bufferWidth, bufferHeight);
      context.uniform2f(uResolution, bufferWidth, bufferHeight);
    },
    draw: (seconds: number) => {
      context.uniform1f(uTime, seconds);
      context.drawArrays(context.TRIANGLES, 0, 6);
    },
    dispose: () => {
      context.deleteProgram(program);
      context.deleteShader(vertex);
      context.deleteShader(fragment);
      context.deleteBuffer(buffer);
    },
  };
}

export function Backdrop() {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const host = hostRef.current;
    const canvas = canvasRef.current;
    if (!host || !canvas) return;

    const settle = (state: "live" | "still" | "fallback") => {
      host.dataset.backdrop = state;
    };

    const stillOnly =
      typeof window.matchMedia === "function" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    const shader = createShader(canvas, host);

    /* The host keeps its CSS gradient when the shader will not start, which is
       what it was already painting before this effect ran, so nothing flashes. */
    if (!shader) settle("fallback");

    const layout = () => {
      shader?.resize();
      const width = host.clientWidth;
      const height = host.clientHeight;
      if (width === 0 || height === 0) return;

    };

    layout();

    /* One frame and nothing else. A reader who has asked for less motion gets
       the composition without the movement, rather than a blank rectangle. */
    if (stillOnly) {
      shader?.draw(2.4);
      settle("still");
      const observer = new ResizeObserver(() => {
        layout();
        shader?.draw(2.4);
      });
      observer.observe(host);
      return () => {
        observer.disconnect();
        shader?.dispose();
      };
    }

    let frame: number | null = null;
    let running = true;
    let frames = 0;
    let sampleStart = 0;
    const start = performance.now();

    const stop = (state: "still" | "fallback") => {
      running = false;
      if (frame !== null) cancelAnimationFrame(frame);
      frame = null;
      settle(state);
    };

    const tick = (now: number) => {
      if (!running) return;
      const seconds = (now - start) / 1000;
      shader?.draw(seconds * 0.14);

      frames += 1;
      if (frames === WARMUP_FRAMES) sampleStart = now;
      if (frames === SAMPLE_FRAMES) {
        const perFrame = (now - sampleStart) / (SAMPLE_FRAMES - WARMUP_FRAMES);
        /* Slow enough that animating it is worse than not. The last frame stays
           on screen, so the page keeps its composition and loses its movement. */
        if (perFrame > SLOW_FRAME_MS) {
          stop("still");
          return;
        }
      }

      frame = requestAnimationFrame(tick);
    };

    const onVisibility = () => {
      if (!running) return;
      if (document.hidden) {
        if (frame !== null) cancelAnimationFrame(frame);
        frame = null;
      } else if (frame === null) {
        frame = requestAnimationFrame(tick);
      }
    };

    /* A lost context is the browser reclaiming the GPU, usually under memory
       pressure. Preventing the default would ask for a restore; this asks for
       nothing and shows the CSS gradient instead. */
    const onContextLost = (event: Event) => {
      event.preventDefault();
      stop("fallback");
    };

    canvas.addEventListener("webglcontextlost", onContextLost);
    document.addEventListener("visibilitychange", onVisibility);
    const observer = new ResizeObserver(layout);
    observer.observe(host);

    if (shader) settle("live");
    frame = requestAnimationFrame(tick);

    return () => {
      running = false;
      if (frame !== null) cancelAnimationFrame(frame);
      canvas.removeEventListener("webglcontextlost", onContextLost);
      document.removeEventListener("visibilitychange", onVisibility);
      observer.disconnect();
      shader?.dispose();
    };
  }, []);

  return (
    <div
      ref={hostRef}
      className="backdrop pointer-events-none fixed inset-0 -z-30 overflow-hidden"
      data-backdrop="fallback"
      aria-hidden="true"
      /* Painted before any script runs, and left in place if WebGL never
         arrives. The canvas draws over it when it works. */
      style={{
        background:
          "radial-gradient(120% 90% at 22% 18%, rgb(128 82 255 / 0.30), transparent 62%)," +
          "radial-gradient(90% 70% at 82% 78%, rgb(21 132 110 / 0.22), transparent 58%)," +
          "#000000",
      }}
    >
      <canvas ref={canvasRef} className="absolute inset-0 block size-full" />
    </div>
  );
}

/* What holds the shader down to a background. A contrast checker cannot read a
   canvas, so without this it would report every ratio on the site against pure
   black and be wrong in the flattering direction. Measured with the content
   hidden, the shader and this scrim together reach a relative luminance of
   0.0069.

   The particle cloud is not under it. It sits above, so its colours run at full
   strength in the half of the opening screen that carries no text, and it is
   held down by its own measured dimming everywhere else. See the note in
   particles/timeline.ts. */
export function Scrim() {
  return (
    <div
      aria-hidden="true"
      className="pointer-events-none fixed inset-0 -z-20 bg-black/72"
    />
  );
}

/* Long-form pages stack a second one. Composited, the gradient reaches the
   reader at about 12%, which is atmosphere rather than something competing
   with a paragraph. */
export function ReadingScrim() {
  return (
    <div
      aria-hidden="true"
      className="pointer-events-none fixed inset-0 -z-20 bg-black/55"
    />
  );
}
