/* The one shape every particle is.

   A tetrahedron: four triangular faces, four vertices, and no curved surface
   anywhere on it. That is the whole point. At the size these are drawn, a
   sphere reads as a dot and a cube reads as a dot with aliasing, while a
   tetrahedron catches light differently on each face and reads as a solid
   object even when it is four pixels across.

   Flat shaded, so the vertices are expanded rather than indexed: twelve
   vertices instead of four, because two faces meeting at a vertex need two
   different normals there and an indexed mesh can only carry one. Twelve
   vertices uploaded once, for ten thousand instances, is not a size worth
   optimising against clarity. */

/* World units. Small enough that a particle is a speck at rest and large enough
   that the nearest ones resolve into a recognisable solid, which is the balance
   the specification asks for: tiny, but never so tiny that the bloom is the
   only thing left. */
const RADIUS = 0.012;

/* Longer than it is wide, so the shard has a direction and the noise driven
   rotation has something to show. A regular tetrahedron tumbling looks almost
   static, because it is nearly the same shape from most angles. */
const STRETCH = 1.7;

const CORNERS: [number, number, number][] = [
  [1, 1, 1],
  [1, -1, -1],
  [-1, 1, -1],
  [-1, -1, 1],
];

const FACES: [number, number, number][] = [
  [0, 1, 2],
  [0, 3, 1],
  [0, 2, 3],
  [1, 3, 2],
];

export type Geometry = {
  vertices: Float32Array;
  normals: Float32Array;
  vertexCount: number;
};

export function pyramid(): Geometry {
  const vertices = new Float32Array(FACES.length * 9);
  const normals = new Float32Array(FACES.length * 9);

  const scaled = CORNERS.map(([x, y, z]) => {
    const length = Math.sqrt(3);
    return [
      (x / length) * RADIUS,
      (y / length) * RADIUS,
      (z / length) * RADIUS * STRETCH,
    ] as [number, number, number];
  });

  FACES.forEach((face, faceIndex) => {
    const [a, b, c] = face.map((index) => scaled[index]!);

    /* One normal for the whole face, taken from the cross product of two of its
       edges, which is what makes the shading flat rather than smooth. */
    const edge1 = [b![0] - a![0], b![1] - a![1], b![2] - a![2]];
    const edge2 = [c![0] - a![0], c![1] - a![1], c![2] - a![2]];
    const normal = [
      edge1[1]! * edge2[2]! - edge1[2]! * edge2[1]!,
      edge1[2]! * edge2[0]! - edge1[0]! * edge2[2]!,
      edge1[0]! * edge2[1]! - edge1[1]! * edge2[0]!,
    ];
    const length = Math.hypot(normal[0]!, normal[1]!, normal[2]!) || 1;

    [a, b, c].forEach((corner, cornerIndex) => {
      const at = faceIndex * 9 + cornerIndex * 3;
      vertices[at] = corner![0];
      vertices[at + 1] = corner![1];
      vertices[at + 2] = corner![2];
      normals[at] = normal[0]! / length;
      normals[at + 1] = normal[1]! / length;
      normals[at + 2] = normal[2]! / length;
    });
  });

  return { vertices, normals, vertexCount: FACES.length * 3 };
}

/* Per instance data that never changes: which texel in the simulation grid this
   particle reads, four random numbers it can use for variation, and its index.

   The half texel offset on the identifier is the part worth being careful
   about. Sampling a texture at the boundary between two texels with nearest
   filtering is a coin toss decided by floating point rounding, so a particle
   whose coordinate lands exactly on the seam reads a neighbour's position on
   some drivers and its own on others. Adding half a texel puts every sample in
   the middle of the texel it belongs to. */
export function instanceAttributes(gridSize: number, random: () => number) {
  const count = gridSize * gridSize;
  const ids = new Float32Array(count * 2);
  const randoms = new Float32Array(count * 4);
  const indices = new Float32Array(count);

  for (let i = 0; i < count; i++) {
    const gx = i % gridSize;
    const gy = Math.floor(i / gridSize);
    ids[i * 2] = (gx + 0.5) / gridSize;
    ids[i * 2 + 1] = (gy + 0.5) / gridSize;
    randoms[i * 4] = random();
    randoms[i * 4 + 1] = random();
    randoms[i * 4 + 2] = random();
    randoms[i * 4 + 3] = random();
    indices[i] = i;
  }

  return { ids, randoms, indices, count };
}
