import {
  buildSprites,
  offscreenPoint,
  Particle,
  readTints,
  samplePoints,
  shuffle,
  type Vec,
} from "./particles";

/* The constellation behind the hero. The design reference calls this the site's
   defining visual: thousands of outlined triangles forming a brain, animated
   rather than a static image.

   It is a module rather than a component because it does not own a frame loop.
   The backdrop already runs one for the gradient, with a slow-renderer guard, a
   hidden-tab pause and a reduced-motion still frame around it. A second loop
   would double the cost of the thing those guards exist to control: measured,
   the canvases already together drop to thirty frames a second on a software
   rasteriser. So this exposes a draw step and the backdrop calls it. */

/* Long edge of the drawing buffer. Higher than the gradient's, because a
   gradient has no detail to lose to upscaling and a field of seven pixel
   triangles does. */
const MAX_EDGE = 1400;

/* Sampling strides for the two passes, in buffer pixels. The volume is walked
   coarsely because it is an area and a fine stride there would run to tens of
   thousands of particles; the structure is walked finely because it is a set of
   lines and it is what makes the cloud read as a brain. */
const VOLUME_STRIDE = 9;
const STRUCTURE_STRIDE = 4;

/* Smaller than the opening animation's, because this cloud is dense and a seven
   pixel triangle at this spacing merges into a sheet. */
const SPRITE = 5;

/* How far the pointer reaches, and how far it pushes, in CSS pixels. Not buffer
   pixels: the buffer is scaled per device, so the same number meant a reach of
   140 CSS pixels on a laptop and 79 on a phone, and the interaction was a
   different size depending on the screen. Measured, the cloud parted a third as
   much on a phone as on a desktop for the same gesture. */
const POINTER_RADIUS = 140;
const POINTER_PUSH = 85;

/* Amplitude of the idle wander, in buffer pixels. Small on purpose: this sits
   behind a headline and a table of figures, and anything more reads as the page
   being unsteady. */
const DRIFT = 3.2;

/* The shape. Two passes over the same geometry, not one.

   The first version traced the outline and the folds as lines and sampled only
   those, which gave a sparse wireframe: a diagram of a brain rather than the
   thing the reference asks for, which is a dense cloud of thousands of
   particles with an organic shape. So the volume is filled and sampled at a
   coarse stride, and the structure is stroked and sampled at a fine one, and
   the two are concatenated. The result is dense everywhere and denser along the
   folds, which is what gives it depth instead of flatness.

   Three earlier attempts at the structure are worth recording, because the
   difference is not obvious until it is on screen. Nested smooth rings look
   like a contour map. Horizontal wavy lines look like a planet. What reads as
   folds is rings pulled inward, perturbed at high frequency and broken into
   arcs, which is what gyri actually do. */

type Lobe = { cx: number; cy: number; rx: number; ry: number; tilt: number };

function geometry(width: number, height: number) {
  return {
    cerebrum: {
      cx: 0.42 * width,
      cy: 0.42 * height,
      rx: 0.33 * width,
      ry: 0.3 * height,
      tilt: -0.12,
    } as Lobe,
    cerebellum: {
      cx: 0.685 * width,
      cy: 0.715 * height,
      rx: 0.115 * width,
      ry: 0.082 * height,
      tilt: 0.14,
    } as Lobe,
  };
}

function at(lobe: Lobe, angle: number, radius: number): Vec {
  const px = Math.cos(angle) * lobe.rx * radius;
  const py = Math.sin(angle) * lobe.ry * radius;
  return {
    x: lobe.cx + px * Math.cos(lobe.tilt) - py * Math.sin(lobe.tilt),
    y: lobe.cy + px * Math.sin(lobe.tilt) + py * Math.cos(lobe.tilt),
  };
}

/* Gentle lobing only. Stronger modulation turns the silhouette into a lump
   rather than a head-shaped mass. */
const shell = (t: number) => 1 + 0.05 * Math.sin(3 * t + 0.6) + 0.028 * Math.sin(5 * t + 2);

function ring(
  ctx: CanvasRenderingContext2D,
  lobe: Lobe,
  radius: (t: number) => number,
  steps: number,
) {
  ctx.beginPath();
  for (let i = 0; i <= steps; i++) {
    const t = (i / steps) * Math.PI * 2;
    const point = at(lobe, t, radius(t));
    if (i === 0) ctx.moveTo(point.x, point.y);
    else ctx.lineTo(point.x, point.y);
  }
  ctx.closePath();
}

/* The mass, filled. Sampled coarsely, this is the cloud the particles live in. */
function drawVolume(ctx: CanvasRenderingContext2D, width: number, height: number) {
  const { cerebrum, cerebellum } = geometry(width, height);
  ctx.fillStyle = "#ffffff";
  ring(ctx, cerebrum, shell, 240);
  ctx.fill();
  ring(ctx, cerebellum, (t) => 1 + 0.05 * Math.sin(6 * t + 1), 200);
  ctx.fill();

  /* The stem, as a filled taper rather than two lines, so it has volume too. */
  ctx.beginPath();
  ctx.moveTo(0.545 * width, 0.62 * height);
  ctx.bezierCurveTo(
    0.562 * width,
    0.75 * height,
    0.558 * width,
    0.83 * height,
    0.552 * width,
    0.9 * height,
  );
  ctx.lineTo(0.606 * width, 0.9 * height);
  ctx.bezierCurveTo(
    0.62 * width,
    0.84 * height,
    0.626 * width,
    0.76 * height,
    0.612 * width,
    0.64 * height,
  );
  ctx.closePath();
  ctx.fill();
}

/* The folds, stroked. Sampled finely, this is what makes the cloud read as a
   brain rather than as a blob. */
function drawStructure(ctx: CanvasRenderingContext2D, width: number, height: number) {
  const { cerebrum, cerebellum } = geometry(width, height);
  const stroke = Math.max(1.6, Math.min(width, height) / 300);
  ctx.strokeStyle = "#ffffff";
  ctx.lineWidth = stroke;
  ctx.lineCap = "round";

  ring(ctx, cerebrum, shell, 240);
  ctx.stroke();

  ctx.save();
  ring(ctx, cerebrum, (t) => shell(t) * 0.99, 240);
  ctx.clip();
  [0.9, 0.81, 0.72, 0.63, 0.54, 0.45, 0.36, 0.27, 0.18].forEach((base, index) => {
    const phase = index * 2.1;
    let drawing = false;
    ctx.beginPath();
    for (let i = 0; i <= 560; i++) {
      const t = (i / 560) * Math.PI * 2;
      /* The pen lifts here, which is what turns a closed ring into a run of
         folds. */
      if (Math.sin(3.5 * t + phase * 1.7) < -0.72) {
        drawing = false;
        continue;
      }
      const wiggle =
        1 + 0.045 * Math.sin(11 * t + phase) + 0.022 * Math.sin(19 * t + phase * 2.3);
      const point = at(cerebrum, t, shell(t) * base * wiggle);
      if (drawing) ctx.lineTo(point.x, point.y);
      else {
        ctx.moveTo(point.x, point.y);
        drawing = true;
      }
    }
    ctx.stroke();
  });
  ctx.restore();

  /* The cerebellum's own texture is finer and more regular than the cerebrum's,
     which is true of the real thing and is what stops it reading as a second
     small brain. */
  ring(ctx, cerebellum, (t) => 1 + 0.05 * Math.sin(6 * t + 1), 200);
  ctx.stroke();
  ctx.save();
  ctx.clip();
  ctx.lineWidth = stroke * 0.7;
  for (let n = 0; n < 11; n++) {
    ctx.beginPath();
    for (let u = -1.25; u <= 1.25; u += 0.03) {
      const px = u * cerebellum.rx;
      const py =
        (n / 10 - 0.5) * cerebellum.ry * 1.9 + cerebellum.ry * 0.07 * Math.sin(u * 9 + n);
      ctx.lineTo(
        cerebellum.cx + px * Math.cos(cerebellum.tilt) - py * Math.sin(cerebellum.tilt),
        cerebellum.cy + px * Math.sin(cerebellum.tilt) + py * Math.cos(cerebellum.tilt),
      );
    }
    ctx.stroke();
  }
  ctx.restore();
}

export type Brain = {
  /* Fits the shape to the canvas's own box, given in CSS pixels. */
  layout: (width: number, height: number) => void;
  draw: (step: number, seconds: number, pointer: Vec | null, settle: boolean) => void;
  clear: () => void;
  count: () => number;
};

export function createBrain(canvas: HTMLCanvasElement): Brain | null {
  const context = canvas.getContext("2d", { alpha: true });
  if (!context) return null;
  const ctx = context;

  const tints = readTints(
    ["--iris", "--spark", "--verdant"],
    ["#8052ff", "#ffb829", "#15846e"],
  );
  /* No bone. A white particle in the background was measured lifting the
     brightest background pixel enough to drop the quietest grey on the site to
     4.29:1, under AA, while an ordinary scan still reported a pass. */
  const sprites = buildSprites(tints, SPRITE);

  /* Full strength. The cloud used to sit behind the text under the scrim, which
     capped how bright it could be: amber has three times the relative luminance
     of the violet and the teal, so it set the contrast ceiling for the whole
     site. In its own column with no text over it there is nothing to protect,
     and the reference is explicit that these are saturated colours. */
  const alphas = [1, 0.9, 1];

  let particles: Particle[] = [];
  let scale = 1;

  function layout(cssWidth: number, cssHeight: number) {
    const longEdge = Math.max(cssWidth, cssHeight, 1);
    scale = Math.min(window.devicePixelRatio || 1, MAX_EDGE / longEdge);
    const width = Math.max(2, Math.round(cssWidth * scale));
    const height = Math.max(2, Math.round(cssHeight * scale));
    if (canvas.width !== width || canvas.height !== height) {
      canvas.width = width;
      canvas.height = height;
    }

    /* The shape is fitted inside its box with a margin, so the cloud has room
       to be pushed around by a pointer without clipping at the edges. */
    const inset = 0.08;
    const boxWidth = Math.round(width * (1 - inset * 2));
    const boxHeight = Math.round(height * (1 - inset * 2));
    const offsetX = Math.round(width * inset);
    const offsetY = Math.round(height * inset);

    const dense = longEdge >= 520;
    /* Two passes. The volume carries the cloud and the structure carries the
       folds, so the folds are sampled about three times as finely. */
    const points = shuffle([
      ...samplePoints(boxWidth, boxHeight, dense ? VOLUME_STRIDE : VOLUME_STRIDE + 3, (paint) =>
        drawVolume(paint, boxWidth, boxHeight),
      ),
      ...samplePoints(
        boxWidth,
        boxHeight,
        dense ? STRUCTURE_STRIDE : STRUCTURE_STRIDE + 2,
        (paint) => drawStructure(paint, boxWidth, boxHeight),
      ),
    ]);

    points.forEach((point, index) => {
      let particle = particles[index];
      if (!particle) {
        particle = new Particle();
        particle.pos = offscreenPoint(width, height);
        /* Slower than the opening animation's particles. This one is ambient;
           it should settle rather than arrive. */
        particle.maxSpeed = Math.random() * 5 + 7;
        particle.maxForce = particle.maxSpeed * 0.16;
        particle.closeEnough = 110;
        particle.tint = Math.floor(Math.random() * sprites.length);
        particle.seed = Math.random() * Math.PI * 2;
        particles.push(particle);
      }
      particle.home = { x: offsetX + point.x, y: offsetY + point.y };
    });

    /* A resize can sample fewer points than last time. Anything spare goes out
       of frame rather than sitting where the shape no longer is. */
    if (points.length < particles.length) {
      particles = particles.slice(0, points.length);
    }
  }

  function draw(step: number, seconds: number, pointer: Vec | null, settle: boolean) {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    if (particles.length === 0) return;

    /* A settled frame is the finished picture, not the first frame of the
       animation towards it. Drawn without this, every particle is still at the
       spawn point it was going to fly in from and one ninth of the way through
       its fade, which is a still frame of very nearly nothing. It is what a
       reader who asked for less motion was getting. */
    if (settle) {
      for (const particle of particles) {
        particle.pos = { x: particle.home.x, y: particle.home.y };
        particle.vel = { x: 0, y: 0 };
        particle.alpha = 1;
        ctx.globalAlpha = alphas[particle.tint]!;
        ctx.drawImage(
          sprites[particle.tint]!,
          particle.pos.x - SPRITE / 2,
          particle.pos.y - SPRITE / 2,
        );
      }
      ctx.globalAlpha = 1;
      return;
    }

    const px = pointer ? pointer.x * scale : 0;
    const py = pointer ? pointer.y * scale : 0;
    const reach = POINTER_RADIUS * scale;
    const push = POINTER_PUSH * scale;

    for (const particle of particles) {
      const home = particle.home;

      /* Idle wander, out of phase per particle so the field breathes rather
         than pulses. Off entirely when the caller asks for a settled frame,
         which is what a reader who wants less motion gets. */
      let targetX = home.x;
      let targetY = home.y;
      if (!settle) {
        targetX += Math.sin(seconds * 0.55 + particle.seed) * DRIFT;
        targetY += Math.cos(seconds * 0.43 + particle.seed * 1.3) * DRIFT;
      }

      /* The cloud parts around the pointer and closes behind it. Nothing
         follows the cursor: this displaces the targets the particles were
         already heading for, and they spring back on their own. */
      if (pointer) {
        const dx = home.x - px;
        const dy = home.y - py;
        const distance = Math.sqrt(dx * dx + dy * dy);
        if (distance < reach && distance > 0.001) {
          const falloff = 1 - distance / reach;
          const displacement = falloff * falloff * push;
          targetX += (dx / distance) * displacement;
          targetY += (dy / distance) * displacement;
        }
      }

      particle.target.x = targetX;
      particle.target.y = targetY;
      particle.move(step);

      ctx.globalAlpha = particle.alpha * alphas[particle.tint]!;
      ctx.drawImage(
        sprites[particle.tint]!,
        particle.pos.x - SPRITE / 2,
        particle.pos.y - SPRITE / 2,
      );
    }
    ctx.globalAlpha = 1;
  }

  return {
    layout,
    draw,
    clear: () => ctx.clearRect(0, 0, canvas.width, canvas.height),
    count: () => particles.length,
  };
}
