/* Just enough four by four matrix maths for one camera.

   Written out rather than pulled in: the whole of what this engine needs from a
   maths library is a projection and a view, and the alternative was a
   dependency larger than the engine itself.

   Column major, which is what WebGL expects, so the element at row r and column
   c lives at index c * 4 + r. The view is built by multiplying named rotations
   and a translation rather than by writing out a transposed rotation by hand.
   The hand written version was here first and it was two sign errors that would
   have shown up as a camera pointing somewhere plausible but wrong. */

export type Mat4 = Float32Array;

export function identity(): Mat4 {
  const out = new Float32Array(16);
  out[0] = 1;
  out[5] = 1;
  out[10] = 1;
  out[15] = 1;
  return out;
}

export function multiply(a: Mat4, b: Mat4): Mat4 {
  const out = new Float32Array(16);
  for (let column = 0; column < 4; column++) {
    for (let row = 0; row < 4; row++) {
      let sum = 0;
      for (let k = 0; k < 4; k++) sum += a[k * 4 + row]! * b[column * 4 + k]!;
      out[column * 4 + row] = sum;
    }
  }
  return out;
}

export function translation(x: number, y: number, z: number): Mat4 {
  const out = identity();
  out[12] = x;
  out[13] = y;
  out[14] = z;
  return out;
}

export function rotationX(angle: number): Mat4 {
  const out = identity();
  const c = Math.cos(angle);
  const s = Math.sin(angle);
  out[5] = c;
  out[6] = s;
  out[9] = -s;
  out[10] = c;
  return out;
}

export function rotationY(angle: number): Mat4 {
  const out = identity();
  const c = Math.cos(angle);
  const s = Math.sin(angle);
  out[0] = c;
  out[2] = -s;
  out[8] = s;
  out[10] = c;
  return out;
}

export function perspective(fovYDegrees: number, aspect: number, near: number, far: number): Mat4 {
  const f = 1 / Math.tan((fovYDegrees * Math.PI) / 360);
  const range = 1 / (near - far);
  const out = new Float32Array(16);
  out[0] = f / aspect;
  out[5] = f;
  out[10] = (near + far) * range;
  out[11] = -1;
  out[14] = near * far * range * 2;
  return out;
}

/* The camera never orbits. It sits back along z and turns by a fraction of a
   radian in response to the pointer, which is the parallax and nothing more.

   The view is the inverse of where the camera is, so it undoes the rotation and
   then undoes the translation, in that order. A point at the origin with the
   camera ten units back lands at minus ten on the view z, which is what the
   depth pass expects to find. */
export function view(position: [number, number, number], pitch: number, yaw: number): Mat4 {
  const undoRotation = multiply(rotationX(-pitch), rotationY(-yaw));
  const undoPosition = translation(-position[0], -position[1], -position[2]);
  return multiply(undoRotation, undoPosition);
}
