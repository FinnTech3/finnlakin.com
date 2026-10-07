import { brain, dataField, helix } from "./brain-shape";
import { mulberry32 } from "./pack";
import type { Shape } from "./shapes";

/* The structures the cloud becomes down the page, and the names the page calls
   them by.

   The brain is the cloud's own shape and the others are what it turns into: a
   band of the page says which one it wants with a data-shape attribute, and the
   engine reads it off the markup the way it reads the lane. The order here is
   the order of the slots in the target texture, so a name's place in this list
   is where its positions are, and it is the one list that both the texture and
   the page agree on.

   Seven, and the choice of them is not neutral. The brain is the opening and
   the close. The surface, the bars and the field are what the work is made of:
   a surface plotted over strike and maturity, the two sides of a limit order
   book, and data laid down in strata. The helix is a strand, which is time and
   what compounds over it, and the network is the people and the trade between
   them. The drape is the other half of the person the site is for, which is
   clothes, and it sits beside the empty bays that are waiting for them.

   Every shape other than the brain is made from nothing but a seed, with no
   reference to where a particle was in the brain. That is a decision. A shape
   derived from the brain's own coordinates, which is how the field and the helix
   are made, keeps every particle near where it was, which is gentle and is also
   why the field reads as a tilted disc: a morph from one blob to another blob
   barely moves. These start every particle somewhere else in the room, so a
   morph is a swarm re-forming, and the wave that sweeps across it is the
   ordering of the shape it is arriving at. */

export const SHAPE_NAMES = [
  "brain",
  "field",
  "helix",
  "surface",
  "skyline",
  "drape",
  "network",
] as const;

export type ShapeName = (typeof SHAPE_NAMES)[number];

/* Where a name's positions are in the target texture. An unknown name is the
   brain, which is what a band that does not say gets. */
export function shapeSlot(name: string | null | undefined): number {
  const slot = SHAPE_NAMES.indexOf(name as ShapeName);
  return slot < 0 ? 0 : slot;
}

/* The chain of shapes a column of bands asks for, and every band's place in it.

   A run of bands that want the same shape is one link, because nothing changes
   between them, and a band's place is how many changes of shape came before it.
   The engine reads the shapes off the page and the validators and tests build
   them from the plan, and both come through here so that the two cannot disagree
   about what counts as a change. */
export function chainOf(slots: readonly number[]): { chain: number[]; index: number[] } {
  const chain: number[] = [];
  const index: number[] = [];
  slots.forEach((slot, band) => {
    if (band === 0 || slot !== slots[band - 1]) chain.push(slot);
    index.push(chain.length - 1);
  });
  return { chain, index };
}

/* The radius every shape is scaled to, from the centre of its own bounding box.
   The same figure as the brain's and the field's, so a morph changes the shape
   and not the size of the cloud. */
const EXTENT = 0.34;

/* Centred on the middle of the box it fills and scaled until its furthest
   particle sits at the standard extent. Centred rather than left where it was
   made, because the composition places the cloud by its centre and a skyline
   standing on a baseline has its mass well below it. */
function settle(raw: Float32Array, count: number): Shape {
  const low = [Infinity, Infinity, Infinity];
  const high = [-Infinity, -Infinity, -Infinity];
  for (let i = 0; i < count; i++) {
    for (let axis = 0; axis < 3; axis++) {
      const value = raw[i * 3 + axis]!;
      if (value < low[axis]!) low[axis] = value;
      if (value > high[axis]!) high[axis] = value;
    }
  }
  const middle = low.map((value, axis) => (value + high[axis]!) / 2);
  let radius = 0;
  for (let i = 0; i < count; i++) {
    radius = Math.max(
      radius,
      Math.hypot(
        raw[i * 3]! - middle[0]!,
        raw[i * 3 + 1]! - middle[1]!,
        raw[i * 3 + 2]! - middle[2]!,
      ),
    );
  }
  const scale = radius > 0 ? EXTENT / radius : 1;
  const out = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) {
    for (let axis = 0; axis < 3; axis++) {
      out[i * 3 + axis] = 0.5 + (raw[i * 3 + axis]! - middle[axis]!) * scale;
    }
  }
  return out;
}

/* Close to a normal distribution and a good deal cheaper than one: the sum of
   three uniforms, centred and scaled to a standard deviation of about one. */
function gauss(random: () => number): number {
  return (random() + random() + random() - 1.5) * 2;
}

/* A surface plotted over two axes, which is what the work is about: the mark
   surface that broke static arbitrage and the yield curve a term premium is
   drawn from are both one of these.

   A mesh and not a sheet. Half the particles sit on lines of constant strike
   and half on lines of constant maturity, so what is drawn is the wire frame of
   a plot, the thing the eye knows at once, and not a smooth blanket that looks
   like a sheet of paper. The height is a smile across the strike, which is the
   one thing everybody who has seen an implied volatility surface remembers,
   flattening out with maturity, with a ripple along it so it is not a bowl. */
export function surface(count: number, seed: number): Shape {
  const random = mulberry32(seed);
  const raw = new Float32Array(count * 3);
  const ACROSS = 15;
  const ALONG = 11;

  for (let i = 0; i < count; i++) {
    let u = random() * 2 - 1;
    let v = random() * 2 - 1;
    if (i % 2 === 0) u = (Math.round(((u + 1) / 2) * ACROSS) / ACROSS) * 2 - 1;
    else v = (Math.round(((v + 1) / 2) * ALONG) / ALONG) * 2 - 1;

    const maturity = (v + 1) / 2;
    const smile = 0.7 * u * u * (0.55 + 0.45 * (1 - maturity));
    const ripple = 0.2 * Math.sin(2.4 * v + 0.6) * (1 - 0.4 * u * u);
    raw[i * 3] = u * 1.05 + (random() - 0.5) * 0.024;
    raw[i * 3 + 1] = smile + ripple - 0.35 + (random() - 0.5) * 0.024;
    raw[i * 3 + 2] = v * 0.8 + (random() - 0.5) * 0.024;
  }
  return settle(raw, count);
}

/* The two sides of a limit order book as bars: bids stepping up to the left of
   the spread and asks to the right, each column as deep as the resting size at
   that price. The depth chart every market maker has on a screen, and the shape
   of the matching engine that is one of the projects.

   A column is chosen in proportion to its height, so a short bar is not a dense
   one: with an equal share of the particles each, the shortest bars would be
   solid and the tallest a haze.

   Thin front to back, because the page looks at the cloud from a long way to one
   side of it. The columns are a few pixels apart, and a slab a third as deep as
   it is wide is drawn with its far end shifted sideways by more than that, so
   from the side the bars close up into a solid wedge. Thin, they are still
   columns. */
export function skyline(count: number, seed: number): Shape {
  const random = mulberry32(seed);
  const COLUMNS = 26;
  const middle = (COLUMNS - 1) / 2;

  const heights: number[] = [];
  for (let c = 0; c < COLUMNS; c++) {
    const away = Math.abs(c - middle) / middle;
    /* The spread: the two columns either side of the middle hold almost
       nothing, which is the gap in the book. */
    heights.push(
      away < 0.06 ? 0.07 : 0.12 + 0.88 * Math.pow(away, 1.25) * (0.88 + random() * 0.24),
    );
  }
  const cumulative: number[] = [];
  let total = 0;
  for (const height of heights) {
    total += height;
    cumulative.push(total);
  }

  const raw = new Float32Array(count * 3);
  const WIDTH = (2 / COLUMNS) * 0.62;
  for (let i = 0; i < count; i++) {
    const pick = random() * total;
    let column = cumulative.findIndex((edge) => pick <= edge);
    if (column < 0) column = COLUMNS - 1;
    const centre = ((column + 0.5) / COLUMNS) * 2 - 1;
    raw[i * 3] = centre + (random() - 0.5) * WIDTH;
    raw[i * 3 + 1] = -0.5 + random() * heights[column]! * 1.25;
    raw[i * 3 + 2] = (random() - 0.5) * 0.12;
  }
  return settle(raw, count);
}

/* Cloth with knife pleats, narrow at the top and flaring to the hem, which is
   the shape of a skirt and is the other half of the person this site is for.

   It is also the brain's own trick in another medium: a cortex is a surface that
   has been folded to fit a smaller space, and a pleat is the same fold made by a
   hand. The depth of the pleat grows towards the hem so that the cloth hangs
   rather than stands, and the whole of it sways a little to one side, because
   cloth that hangs straight reads as a stack of lines. */
export function drape(count: number, seed: number): Shape {
  const random = mulberry32(seed);
  const raw = new Float32Array(count * 3);
  const PLEATS = 13;

  for (let i = 0; i < count; i++) {
    const u = random() * 2 - 1;
    /* How far down the cloth, nought at the waist and one at the hem. Squared
       towards the top so that there is more of it where it is narrow: the same
       number of particles in a smaller width would otherwise leave the waist
       solid and the hem a haze. */
    const down = Math.pow(random(), 0.85);
    const width = 0.3 + 0.78 * Math.pow(down, 0.9);
    const phase = ((u * PLEATS) / 2) % 1;
    const wave = 4 * Math.abs((phase < 0 ? phase + 1 : phase) - 0.5) - 1;
    const depth = (0.05 + 0.3 * Math.pow(down, 1.2)) * wave;
    const sway = 0.06 * Math.sin(2.4 * down + 0.5) * down;

    raw[i * 3] = u * width + sway + (random() - 0.5) * 0.02;
    raw[i * 3 + 1] = 0.7 - 1.45 * down + 0.04 * Math.sin(u * PLEATS * Math.PI) * down * down;
    raw[i * 3 + 2] = depth + (random() - 0.5) * 0.02;
  }
  return settle(raw, count);
}

/* Nodes and the lines between them: a graph, which is what software is made of
   and what a set of people who have worked alongside somebody is.

   Forty six nodes spaced apart from one another, each joined to its three
   nearest and a few to somewhere far off, so there are hubs and there are long
   edges and it is not a lattice. About a third of the particles are the nodes,
   in clusters that are larger for the nodes with more edges, and the rest are
   spread along the edges. */
export function network(count: number, seed: number): Shape {
  const random = mulberry32(seed);
  type Point = [number, number, number];

  const NODES = 46;
  const nodes: Point[] = [];
  for (let guard = 0; nodes.length < NODES && guard < 20000; guard++) {
    const point: Point = [(random() * 2 - 1) * 1.0, (random() * 2 - 1) * 0.72, (random() * 2 - 1) * 0.82];
    if ((point[0] / 1.0) ** 2 + (point[1] / 0.72) ** 2 + (point[2] / 0.82) ** 2 > 1) continue;
    if (nodes.some((other) => Math.hypot(other[0] - point[0], other[1] - point[1], other[2] - point[2]) < 0.3)) {
      continue;
    }
    nodes.push(point);
  }

  const edges: [number, number][] = [];
  const seen = new Set<string>();
  const join = (a: number, b: number) => {
    if (a === b) return;
    const key = a < b ? `${a}-${b}` : `${b}-${a}`;
    if (seen.has(key)) return;
    seen.add(key);
    edges.push([a, b]);
  };
  nodes.forEach((point, a) => {
    const nearest = nodes
      .map((other, b) => ({ b, d: Math.hypot(other[0] - point[0], other[1] - point[1], other[2] - point[2]) }))
      .sort((x, y) => x.d - y.d);
    for (let k = 1; k <= 3; k++) join(a, nearest[k]!.b);
  });
  for (let k = 0; k < 8; k++) {
    join(Math.floor(random() * nodes.length), Math.floor(random() * nodes.length));
  }

  const degree = new Array<number>(nodes.length).fill(0);
  for (const [a, b] of edges) {
    degree[a] = degree[a]! + 1;
    degree[b] = degree[b]! + 1;
  }
  const cumulative: number[] = [];
  let total = 0;
  for (const links of degree) {
    total += Math.pow(links, 1.2);
    cumulative.push(total);
  }

  const raw = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) {
    if (random() < 0.34) {
      const pick = random() * total;
      let node = cumulative.findIndex((edge) => pick <= edge);
      if (node < 0) node = nodes.length - 1;
      const spread = 0.035 + 0.011 * degree[node]!;
      const at = nodes[node]!;
      raw[i * 3] = at[0] + gauss(random) * spread * 0.5;
      raw[i * 3 + 1] = at[1] + gauss(random) * spread * 0.5;
      raw[i * 3 + 2] = at[2] + gauss(random) * spread * 0.5;
    } else {
      const [a, b] = edges[Math.floor(random() * edges.length)]!;
      const t = random();
      const from = nodes[a]!;
      const to = nodes[b]!;
      raw[i * 3] = from[0] + (to[0] - from[0]) * t + gauss(random) * 0.008;
      raw[i * 3 + 1] = from[1] + (to[1] - from[1]) * t + gauss(random) * 0.008;
      raw[i * 3 + 2] = from[2] + (to[2] - from[2]) * t + gauss(random) * 0.008;
    }
  }
  return settle(raw, count);
}

/* Every shape the page can ask for, in the order of SHAPE_NAMES, and the
   structure the brain's own particles carry (how deep in a fold, how high on a
   crown) that gives every one of them its size and its tone. The tone belongs
   to the particle and not to the shape: a particle keeps its identity as it
   becomes something else, and a cloud recoloured at each transition would
   read as a different cloud. */
export function pageShapes(
  count: number,
  seed: number,
): { shapes: Shape[]; tone: Float32Array; relief: Float32Array } {
  const built = brain(count, seed);
  return {
    shapes: [
      built.shape,
      dataField(built.shape, count, seed + 11),
      helix(built.shape, count, seed + 23),
      surface(count, seed + 51),
      skyline(count, seed + 67),
      drape(count, seed + 83),
      network(count, seed + 97),
    ],
    tone: built.tone,
    relief: built.relief,
  };
}
