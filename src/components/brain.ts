import {
  buildSprites,
  offscreenPoint,
  Particle,
  readTints,
  samplePoints,
  shuffle,
  TRIANGLE,
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

/* Sampling stride through the drawn shape. Six left five hundred particles,
   which is a sketch rather than the cloud the reference describes. Four lands
   around seventeen hundred at desktop width. */
const STRIDE = 4;
const PHONE_STRIDE = 6;

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

export type Rect = { x: number; y: number; width: number; height: number };

/* Where the constellation sits in the viewport, in CSS pixels. Exported because
   two things need to agree on it: the backdrop, which lays the shape out, and
   the opening animation, which scatters its particles towards it on the way out
   rather than away from everything. That was the brief, that the two share
   their shapes, and a number duplicated in two files would not stay shared.

   Nearly the full width, and centred. The first attempt sized it at 62% and put
   it right of centre, which is where the reference's two column hero puts its
   visual, and on this page that is exactly where the reconstruction table sits:
   the two fought, and the constellation read as a picture squeezed behind a
   table rather than as the field the content floats on. */
export function brainBox(width: number, height: number): Rect {
  const size = Math.min(width * 0.96, height * 1.9);
  return {
    x: width * 0.52 - size / 2,
    y: height * 0.46 - (size * 0.62) / 2,
    width: size,
    height: size * 0.62,
  };
}

/* The shape, drawn once to an offscreen canvas and sampled. Strokes rather than
   a fill: a filled silhouette sampled at this stride is a solid blob, and the
   reference's brain reads as a structure being traced.

   Three earlier attempts are worth recording, because the difference is not
   obvious until it is on screen. Nested smooth rings look like a contour map.
   Horizontal wavy lines look like a planet. What reads as a brain is rings
   pulled inward, perturbed at high frequency and broken into arcs, which is
   what gyri actually do. */
function drawBrain(ctx: CanvasRenderingContext2D, width: number, height: number) {
  const stroke = Math.max(2, Math.min(width, height) / 260);
  ctx.strokeStyle = "#ffffff";
  ctx.lineWidth = stroke;
  ctx.lineCap = "round";

  const cerebrum = {
    cx: 0.42 * width,
    cy: 0.42 * height,
    rx: 0.33 * width,
    ry: 0.3 * height,
    tilt: -0.12,
  };
  const cerebellum = {
    cx: 0.685 * width,
    cy: 0.715 * height,
    rx: 0.115 * width,
    ry: 0.082 * height,
    tilt: 0.14,
  };

  type Lobe = typeof cerebrum;
  const at = (lobe: Lobe, angle: number, radius: number): Vec => {
    const px = Math.cos(angle) * lobe.rx * radius;
    const py = Math.sin(angle) * lobe.ry * radius;
    return {
      x: lobe.cx + px * Math.cos(lobe.tilt) - py * Math.sin(lobe.tilt),
      y: lobe.cy + px * Math.sin(lobe.tilt) + py * Math.cos(lobe.tilt),
    };
  };

  /* Gentle lobing only. Stronger modulation turns the silhouette into a lump
     rather than a head-shaped mass. */
  const shell = (t: number) => 1 + 0.05 * Math.sin(3 * t + 0.6) + 0.028 * Math.sin(5 * t + 2);

  const ring = (lobe: Lobe, radius: (t: number) => number, steps: number) => {
    ctx.beginPath();
    for (let i = 0; i <= steps; i++) {
      const t = (i / steps) * Math.PI * 2;
      const point = at(lobe, t, radius(t));
      if (i === 0) ctx.moveTo(point.x, point.y);
      else ctx.lineTo(point.x, point.y);
    }
    ctx.closePath();
  };

  ring(cerebrum, shell, 240);
  ctx.stroke();

  ctx.save();
  ring(cerebrum, (t) => shell(t) * 0.99, 240);
  ctx.clip();
  [0.88, 0.77, 0.66, 0.55, 0.44, 0.33, 0.22].forEach((base, index) => {
    const phase = index * 2.1;
    let drawing = false;
    ctx.beginPath();
    for (let i = 0; i <= 520; i++) {
      const t = (i / 520) * Math.PI * 2;
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
  ring(cerebellum, (t) => 1 + 0.05 * Math.sin(6 * t + 1), 200);
  ctx.stroke();
  ctx.save();
  ctx.clip();
  ctx.lineWidth = stroke * 0.68;
  for (let n = 0; n < 9; n++) {
    ctx.beginPath();
    for (let u = -1.25; u <= 1.25; u += 0.03) {
      const px = u * cerebellum.rx;
      const py =
        (n / 8 - 0.5) * cerebellum.ry * 1.9 + cerebellum.ry * 0.07 * Math.sin(u * 9 + n);
      ctx.lineTo(
        cerebellum.cx + px * Math.cos(cerebellum.tilt) - py * Math.sin(cerebellum.tilt),
        cerebellum.cy + px * Math.sin(cerebellum.tilt) + py * Math.cos(cerebellum.tilt),
      );
    }
    ctx.stroke();
  }
  ctx.restore();
  ctx.lineWidth = stroke;

  ctx.beginPath();
  ctx.moveTo(0.545 * width, 0.645 * height);
  ctx.bezierCurveTo(
    0.562 * width,
    0.75 * height,
    0.558 * width,
    0.83 * height,
    0.552 * width,
    0.9 * height,
  );
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(0.606 * width, 0.665 * height);
  ctx.bezierCurveTo(
    0.62 * width,
    0.76 * height,
    0.614 * width,
    0.84 * height,
    0.606 * width,
    0.9 * height,
  );
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(0.552 * width, 0.9 * height);
  ctx.quadraticCurveTo(0.579 * width, 0.925 * height, 0.606 * width, 0.9 * height);
  ctx.stroke();
}

export type Brain = {
  /* Lays the shape into a box given in CSS pixels relative to the viewport. */
  layout: (box: Rect, viewport: Rect) => void;
  draw: (step: number, seconds: number, pointer: Vec | null, settle: boolean) => void;
  clear: () => void;
  count: () => number;
  /* Where the cloud sits, in CSS pixels, so the opening animation can scatter
     towards it instead of away from everything. */
  centre: () => Vec | null;
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
  const sprites = buildSprites(tints);

  /* One opacity per colour, not one for the field. Amber has three times the
     relative luminance of the violet and the teal, so a single opacity means
     the amber sets the contrast ceiling for the whole site and the other two
     are held far below what they could be. Holding amber back lets the other
     two run at full strength: measured, that reads denser on screen while the
     brightest pixel the backdrop paints goes down rather than up. */
  const alphas = [1, 0.42, 1];

  let particles: Particle[] = [];
  let scale = 1;
  let centre: Vec | null = null;

  function layout(box: Rect, viewport: Rect) {
    const longEdge = Math.max(viewport.width, viewport.height, 1);
    scale = Math.min(window.devicePixelRatio || 1, MAX_EDGE / longEdge);
    const bufferWidth = Math.max(2, Math.round(viewport.width * scale));
    const bufferHeight = Math.max(2, Math.round(viewport.height * scale));
    if (canvas.width !== bufferWidth || canvas.height !== bufferHeight) {
      canvas.width = bufferWidth;
      canvas.height = bufferHeight;
    }

    const shapeWidth = Math.max(2, Math.round(box.width * scale));
    const shapeHeight = Math.max(2, Math.round(box.height * scale));
    const stride = viewport.width < 760 ? PHONE_STRIDE : STRIDE;

    const points = shuffle(
      samplePoints(shapeWidth, shapeHeight, stride, (paint) =>
        drawBrain(paint, shapeWidth, shapeHeight),
      ),
    );

    const offsetX = box.x * scale;
    const offsetY = box.y * scale;
    centre = { x: box.x + box.width * 0.45, y: box.y + box.height * 0.45 };

    points.forEach((point, index) => {
      let particle = particles[index];
      if (!particle) {
        particle = new Particle();
        particle.pos = offscreenPoint(bufferWidth, bufferHeight);
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
          particle.pos.x - TRIANGLE / 2,
          particle.pos.y - TRIANGLE / 2,
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
        particle.pos.x - TRIANGLE / 2,
        particle.pos.y - TRIANGLE / 2,
      );
    }
    ctx.globalAlpha = 1;
  }

  return {
    layout,
    draw,
    clear: () => ctx.clearRect(0, 0, canvas.width, canvas.height),
    count: () => particles.length,
    centre: () => centre,
  };
}
