/* Small WebGL2 helpers, shared by the simulation, the renderer and the post
   chain. Nothing here knows what a particle is.

   These exist because the same eight lines of framebuffer setup were about to
   appear in five files, and because a framebuffer that is silently incomplete
   is the single most expensive bug in this kind of code: it does not throw, it
   does not warn, it just renders black and leaves you reading shader maths that
   was never wrong. Every allocation here is checked at the point it is made. */

export type Target = {
  framebuffer: WebGLFramebuffer;
  texture: WebGLTexture;
  width: number;
  height: number;
};

/* A shader that fails to compile prints its whole log, with the name of the
   shader and which stage it was, because a GLSL error four hundred lines into
   a generated string is unreadable without it.

   It prints in development only. Every route on this site is asserted console
   clean, and a decorative background is the last thing that should be able to
   fail that assertion in front of a reader. In production the failure returns
   null instead, which the engine turns into the static fallback. */
const speak = process.env.NODE_ENV !== "production";

function report(label: string, detail: string) {
  if (speak) console.error(`[particles] ${label}\n${detail}`);
}

function compile(
  gl: WebGL2RenderingContext,
  type: number,
  source: string,
  label: string,
): WebGLShader | null {
  const shader = gl.createShader(type);
  if (!shader) return null;
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    const stage = type === gl.VERTEX_SHADER ? "vertex" : "fragment";
    report(`${label} (${stage}) did not compile`, gl.getShaderInfoLog(shader) ?? "no log");
    gl.deleteShader(shader);
    return null;
  }
  return shader;
}

export function link(
  gl: WebGL2RenderingContext,
  vertexSource: string,
  fragmentSource: string,
  label: string,
): WebGLProgram | null {
  const vertex = compile(gl, gl.VERTEX_SHADER, vertexSource, label);
  const fragment = compile(gl, gl.FRAGMENT_SHADER, fragmentSource, label);
  if (!vertex || !fragment) {
    if (vertex) gl.deleteShader(vertex);
    if (fragment) gl.deleteShader(fragment);
    return null;
  }

  const program = gl.createProgram();
  if (!program) return null;
  gl.attachShader(program, vertex);
  gl.attachShader(program, fragment);
  gl.linkProgram(program);

  /* Detached and deleted either way. They are compiled objects the program has
     already absorbed, and leaving them attached keeps their source alive in
     driver memory for the lifetime of the program. */
  gl.detachShader(program, vertex);
  gl.detachShader(program, fragment);
  gl.deleteShader(vertex);
  gl.deleteShader(fragment);

  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    report(`${label} did not link`, gl.getProgramInfoLog(program) ?? "no log");
    gl.deleteProgram(program);
    return null;
  }
  return program;
}

export function locations<K extends string>(
  gl: WebGL2RenderingContext,
  program: WebGLProgram,
  names: readonly K[],
): Record<K, WebGLUniformLocation | null> {
  const found = {} as Record<K, WebGLUniformLocation | null>;
  for (const name of names) found[name] = gl.getUniformLocation(program, name);
  return found;
}

/* Nearest by default. A simulation texture holds one particle per texel and
   nothing in it is a colour: interpolating between two particles produces a
   position that belongs to neither, which shows up as a faint permanent drift
   rather than as an obvious fault. Only the post chain asks for linear. */
export function createTexture(
  gl: WebGL2RenderingContext,
  options: {
    width: number;
    height: number;
    internalFormat: number;
    format: number;
    type: number;
    data?: ArrayBufferView | null;
    linear?: boolean;
  },
): WebGLTexture | null {
  const texture = gl.createTexture();
  if (!texture) return null;
  const filter = options.linear ? gl.LINEAR : gl.NEAREST;

  gl.bindTexture(gl.TEXTURE_2D, texture);
  gl.texImage2D(
    gl.TEXTURE_2D,
    0,
    options.internalFormat,
    options.width,
    options.height,
    0,
    options.format,
    options.type,
    options.data ?? null,
  );
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, filter);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, filter);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  gl.bindTexture(gl.TEXTURE_2D, null);
  return texture;
}

/* A framebuffer with one texture attached, checked for completeness before it
   is handed back. An incomplete framebuffer renders black in total silence. */
export function createTarget(
  gl: WebGL2RenderingContext,
  options: {
    width: number;
    height: number;
    internalFormat: number;
    format: number;
    type: number;
    linear?: boolean;
    label: string;
  },
): Target | null {
  const texture = createTexture(gl, options);
  if (!texture) return null;

  const framebuffer = gl.createFramebuffer();
  if (!framebuffer) {
    gl.deleteTexture(texture);
    return null;
  }

  gl.bindFramebuffer(gl.FRAMEBUFFER, framebuffer);
  gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, texture, 0);
  const status = gl.checkFramebufferStatus(gl.FRAMEBUFFER);
  gl.bindFramebuffer(gl.FRAMEBUFFER, null);

  if (status !== gl.FRAMEBUFFER_COMPLETE) {
    report(`${options.label} framebuffer incomplete`, `status 0x${status.toString(16)}`);
    gl.deleteFramebuffer(framebuffer);
    gl.deleteTexture(texture);
    return null;
  }

  return { framebuffer, texture, width: options.width, height: options.height };
}

export function disposeTarget(gl: WebGL2RenderingContext, target: Target | null) {
  if (!target) return;
  gl.deleteFramebuffer(target.framebuffer);
  gl.deleteTexture(target.texture);
}

/* One triangle, not two. A quad made of two triangles has a seam down the
   diagonal where the two halves meet, and every full screen pass in this file
   runs through it: the seam costs an extra row of quads along the diagonal and,
   with derivatives, can produce a visible line. A single oversized triangle
   clipped to the viewport covers it in one primitive with no interior edge. */
export function createFullscreen(gl: WebGL2RenderingContext) {
  const vertexArray = gl.createVertexArray();
  const buffer = gl.createBuffer();
  if (!vertexArray || !buffer) return null;

  gl.bindVertexArray(vertexArray);
  gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
  gl.enableVertexAttribArray(0);
  gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
  gl.bindVertexArray(null);
  gl.bindBuffer(gl.ARRAY_BUFFER, null);

  return {
    draw() {
      gl.bindVertexArray(vertexArray);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
      gl.bindVertexArray(null);
    },
    dispose() {
      gl.deleteVertexArray(vertexArray);
      gl.deleteBuffer(buffer);
    },
  };
}

/* The vertex stage every full screen pass shares. Position comes in as clip
   space already, so there is no matrix and no varying to interpolate beyond the
   texture coordinate. */
export const FULLSCREEN_VERTEX = `#version 300 es
layout(location = 0) in vec2 a_clip;
out vec2 v_uv;
void main() {
  v_uv = a_clip * 0.5 + 0.5;
  gl_Position = vec4(a_clip, 0.0, 1.0);
}
`;

export function bindTexture(
  gl: WebGL2RenderingContext,
  unit: number,
  texture: WebGLTexture | null,
  location: WebGLUniformLocation | null,
) {
  gl.activeTexture(gl.TEXTURE0 + unit);
  gl.bindTexture(gl.TEXTURE_2D, texture);
  if (location) gl.uniform1i(location, unit);
}
