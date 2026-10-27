/* Variable Proximity, after the component of that name in 000h by Cojeev
   (MIT licence, https://cojeev.com/ui/docs/variable-proximity/). The weight
   curve, the radius, the frame per pointer move and the rule that a finger is
   ignored are the original's.

   What is not the original's is where it is drawn. The component splits one
   headline into a span per letter inside a panel of its own, with its own
   fonts, its own tokens and a reset for everything under [data-slot]. Applied
   to every word on this site that would have replaced the site's faces (its
   token sheet defines --font-display, which is this site's headline face),
   loaded fonts from a host the content security policy refuses, and rewritten
   the text of every page into letters, which React owns and a screen reader
   reads.

   So the page is never touched. A layer over everything, which nothing can
   click, hear or select, draws the heavier letter on top of the real one, in
   the real one's face, size, colour and place, and only while the pointer is
   near it. At rest the layer is empty and the page is exactly what it was. The
   weight runs from the text's own weight to the top of its face's axis, so a
   letter only ever gets heavier. All three faces on the site are variable and
   all three stop at 800, and the heavier letter is drawn centred over the
   lighter one, which it covers. */

const bounded = (value: number, min: number, max: number) =>
  Math.max(min, Math.min(max, value));

/* The original's curve: a smoothstep from the far edge of the radius in. */
function proximityWeight(distance: number, radius: number, from: number, to: number) {
  const p = 1 - bounded(distance / radius, 0, 1);
  return from + (to - from) * p * p * (3 - 2 * p);
}

import type { FrameScheduler } from "@/particles/frame";

/* The page's frame ladder, which the cloud puts on the window under this name
   (see frameScheduler in particles/frame.ts). Read from there and not
   imported: an import copies the scheduler into this chunk as well, which is
   bytes the home page's budget does not have, and the one that matters is the
   one the cloud is already on. tests/frame-budget.spec.ts fails if the two
   names drift apart, because the effect then runs a loop of its own. */
const ladder = () =>
  (window as unknown as Record<string, FrameScheduler | undefined>).__frameScheduler;

/* Text that is not prose, or not drawn as a line of letters in the page. */
const SKIP = "script,style,noscript,template,svg,canvas,textarea,input,select,[contenteditable],[data-proximity-layer]";

/* The furthest any letter is reached from the pointer. */
const REACH = 360;

/* The top of the weight axis, which is the same in all three faces. */
const CEILING = 800;

type Look = { opacity: number; pinned: boolean } | null;

export function startVariableProximity(): () => void {
  const reduced = matchMedia("(prefers-reduced-motion: reduce)");
  /* Two layers. A letter is drawn on the page, in the page's own coordinates,
     so a scroll carries it with the word it sits on in the same frame: drawn
     on the screen instead, it stayed where it was until the next frame caught
     up, and on a scroll that read as the letters being dragged along with the
     pointer. The second is pinned to the screen for the little text that is
     pinned there too, which a scroll does not move. */
  const makeLayer = (pinned: boolean) => {
    const element = document.createElement("div");
    element.className = pinned ? "proximity-layer proximity-layer-pinned" : "proximity-layer";
    element.setAttribute("aria-hidden", "true");
    element.dataset.proximityLayer = "";
    document.body.append(element);
    return { element, pool: [] as HTMLSpanElement[], drawn: 0 };
  };
  const onPage = makeLayer(false);
  const onScreen = makeLayer(true);
  const texts = new Map<Element, Text[]>();
  let dirty = true;
  let ready = false;
  let point: { x: number; y: number } | null = null;
  let frame = 0;
  let pending = false;
  /* Given up by the page's frame ladder, for the rest of the visit. */
  let shed = false;
  let leaveLadder: (() => void) | null = null;

  function rebuild() {
    dirty = false;
    texts.clear();
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, {
      acceptNode(node) {
        const parent = node.parentElement;
        if (!parent || !/\S/.test(node.nodeValue ?? "") || parent.closest(SKIP)) {
          return NodeFilter.FILTER_REJECT;
        }
        return NodeFilter.FILTER_ACCEPT;
      },
    });
    for (let node = walker.nextNode(); node; node = walker.nextNode()) {
      const parent = node.parentElement!;
      const list = texts.get(parent);
      if (list) list.push(node as Text);
      else texts.set(parent, [node as Text]);
    }
  }

  /* Whether a letter of this element can be drawn over, and how faint it is.
     Faded text is drawn as faded, and text under a scale or a rotation is left
     alone, because the box the browser reports for it is not the size of the
     letter. */
  function appearance(element: Element): Look {
    let opacity = 1;
    let pinned = false;
    for (let at: Element | null = element; at && at !== document.documentElement; at = at.parentElement) {
      const style = getComputedStyle(at);
      opacity *= Number(style.opacity);
      if (style.position === "fixed" || style.position === "sticky") pinned = true;
      if (opacity < 0.02 || style.visibility === "hidden") return null;
      const transform = style.transform;
      if (transform !== "none") {
        const m = transform.match(/^matrix\(([^)]+)\)$/);
        const v = m ? m[1].split(",").map(Number) : null;
        if (!v || v[0] !== 1 || v[1] !== 0 || v[2] !== 0 || v[3] !== 1) return null;
      }
    }
    return { opacity, pinned };
  }

  const range = document.createRange();
  function letterBox(text: Text, index: number) {
    range.setStart(text, index);
    range.setEnd(text, index + 1);
    return range.getBoundingClientRect();
  }

  /* The first letter whose line reaches down to y. Letters run in lines from
     the top, so their lines are in order; a collapsed space has no box and is
     stepped over. */
  function firstAtOrBelow(text: Text, y: number) {
    let lo = 0;
    let hi = text.length;
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      let probe = mid;
      let box = letterBox(text, probe);
      while (box.height === 0 && probe + 1 < hi) box = letterBox(text, ++probe);
      if (box.height === 0 || box.bottom >= y) hi = mid;
      else lo = probe + 1;
    }
    return lo;
  }

  type Glyph = {
    char: string;
    x: number;
    top: number;
    height: number;
    weight: number;
    style: CSSStyleDeclaration;
    opacity: number;
    pinned: boolean;
  };

  function collect(): Glyph[] {
    const glyphs: Glyph[] = [];
    if (!point) return glyphs;
    const { x, y } = point;
    const selection = getSelection();
    const selecting = selection && !selection.isCollapsed;

    for (const [element, nodes] of texts) {
      const box = element.getBoundingClientRect();
      if (box.right < x - REACH || box.left > x + REACH || box.bottom < y - REACH || box.top > y + REACH) {
        continue;
      }
      const style = getComputedStyle(element);
      const size = parseFloat(style.fontSize);
      /* The original's 150 pixels is for a headline of about fifty. Small
         text gets a reach of a few letters, and the name on the home page,
         whose letters are two hundred pixels tall, gets more than one. */
      const radius = Math.min(REACH, Math.max(bounded(size * 4, 60, 150), size * 1.5));
      if (box.right < x - radius || box.left > x + radius || box.bottom < y - radius || box.top > y + radius) {
        continue;
      }
      const from = parseFloat(style.fontWeight);
      const to = CEILING;
      if (!(to - from >= 4)) continue;
      const look = appearance(element);
      if (!look) continue;
      const spacing = parseFloat(style.letterSpacing) || 0;
      const transform = style.textTransform;

      for (const text of nodes) {
        if (!text.isConnected) {
          dirty = true;
          continue;
        }
        if (selecting && selection.containsNode(text, true)) continue;
        const data = text.data;
        for (let i = firstAtOrBelow(text, y - radius); i < data.length; i++) {
          const code = data.charCodeAt(i);
          const pair = code >= 0xd800 && code <= 0xdbff;
          const char = data.slice(i, pair ? i + 2 : i + 1);
          if (pair) i++;
          if (/\s/.test(char)) continue;
          const letter = letterBox(text, pair ? i - 1 : i);
          if (letter.height === 0) continue;
          if (letter.top > y + radius) break;
          const cx = letter.left + (letter.width - spacing) / 2;
          const cy = letter.top + letter.height / 2;
          const distance = Math.hypot(x - cx, y - cy);
          if (distance >= radius) continue;
          const weight = proximityWeight(distance, radius, from, to);
          if (weight - from < 4) continue;
          /* Drawn only where the letter is the thing on top: not under the
             header, an open panel, or an edge that clips it. */
          if (document.elementFromPoint(cx, cy) !== element) continue;
          glyphs.push({
            char:
              transform === "uppercase"
                ? char.toLocaleUpperCase("en-GB")
                : transform === "lowercase"
                  ? char.toLocaleLowerCase("en-GB")
                  : char,
            x: cx,
            top: letter.top,
            height: letter.height,
            weight,
            style,
            opacity: look.opacity,
            pinned: look.pinned,
          });
        }
      }
    }
    return glyphs;
  }

  function draw(glyphs: Glyph[]) {
    const counts = new Map([[onPage, 0], [onScreen, 0]]);
    /* Read once, before any letter is written, so the writes cannot make the
       browser lay the page out again to answer. */
    const sx = window.scrollX;
    const sy = window.scrollY;
    for (const glyph of glyphs) {
      const target = glyph.pinned ? onScreen : onPage;
      const index = counts.get(target)!;
      counts.set(target, index + 1);
      let span = target.pool[index];
      if (!span) {
        span = document.createElement("span");
        target.pool.push(span);
        target.element.append(span);
      }
      const s = span.style;
      span.textContent = glyph.char;
      s.display = "block";
      s.left = `${glyph.x + (glyph.pinned ? 0 : sx)}px`;
      s.top = `${glyph.top + (glyph.pinned ? 0 : sy)}px`;
      s.height = `${glyph.height}px`;
      s.lineHeight = `${glyph.height}px`;
      s.fontFamily = glyph.style.fontFamily;
      s.fontSize = glyph.style.fontSize;
      s.fontStyle = glyph.style.fontStyle;
      s.fontStretch = glyph.style.fontStretch;
      s.fontVariationSettings = glyph.style.fontVariationSettings;
      s.fontWeight = String(Math.round(glyph.weight));
      s.setProperty("color", glyph.style.getPropertyValue("color"));
      s.opacity = String(glyph.opacity);
    }
    for (const [target, count] of counts) {
      for (let index = count; index < target.drawn; index++) target.pool[index].style.display = "none";
      target.drawn = count;
    }
  }

  function paint() {
    frame = 0;
    pending = false;
    const running =
      !shed && ready && point && !reduced.matches && !document.documentElement.dataset.intro;
    if (running && dirty) rebuild();
    draw(running ? collect() : []);
  }

  /* On the page with the brain, this is decoration on the page's one frame
     ladder (particles/frame.ts), at a rank above everything else, so when
     frames run long it is thinned and then given up before the cloud loses a
     single particle. It used to ask for frames of its own, which the ladder
     could not see: its cost was charged to the cloud, the cloud was stepped
     down from its full count to under half of it, and a cloud that has stepped
     down is never offered its particles back. Elsewhere there is no ladder and
     nothing to protect, and it asks for a frame of its own when it needs one. */
  const brainLive = () => document.querySelector('[data-brain="live"]') !== null;

  const schedule = () => {
    if (shed) return;
    pending = true;
    /* Not while the opening runs, when nothing is drawn anyway: a struggling
       opening would give up the letters before it relieved the cloud, and the
       first move after it brings them in. */
    if (document.documentElement.dataset.intro) return;
    const page = ladder();
    if (page && brainLive()) {
      leaveLadder ??= page.add({
        rank: 1000,
        draw() {
          /* The cloud has gone, on a navigation: off the ladder, so a page
             without it is not left running a loop for nothing. */
          if (!brainLive()) {
            leaveLadder?.();
            leaveLadder = null;
          }
          if (pending) paint();
        },
        onShed() {
          shed = true;
          draw([]);
        },
      });
    } else if (!frame) frame = requestAnimationFrame(paint);
  };

  const onMove = (event: PointerEvent) => {
    if (event.pointerType === "touch") return;
    point = { x: event.clientX, y: event.clientY };
    schedule();
  };
  const onLeave = (event: MouseEvent) => {
    if (event.relatedTarget) return;
    point = null;
    schedule();
  };
  const onBlur = () => {
    point = null;
    schedule();
  };
  const onScroll = () => {
    if (point) schedule();
  };
  /* Something has moved under the pointer: a tool chip stepping away from it, or
     a block arriving at the end of its transition. The letters are drawn where
     the words were when they were measured, so a word that moves afterwards
     would leave the heavier letter behind where it was, and with the pointer
     still nothing would measure it again. Painted once more after it moves. */
  const onMoved = () => {
    if (point) schedule();
  };

  /* The page's own text changing, on a navigation or a panel opening. The
     layer's own letters are not the page's and do not count. */
  const watcher = new MutationObserver((records) => {
    if (
      records.some(
        (record) => !onPage.element.contains(record.target) && !onScreen.element.contains(record.target),
      )
    ) {
      dirty = true;
    }
  });
  watcher.observe(document.body, { childList: true, subtree: true, characterData: true });

  document.addEventListener("pointermove", onMove, { passive: true });
  document.addEventListener("mouseout", onLeave);
  window.addEventListener("blur", onBlur);
  window.addEventListener("scroll", onScroll, { passive: true, capture: true });
  window.addEventListener("resize", schedule);
  window.addEventListener("fl-moved", onMoved);
  document.addEventListener("transitionend", onMoved, { passive: true });
  reduced.addEventListener("change", schedule);

  /* The letters are measured in the real faces, so nothing is drawn until they
     have arrived. */
  void document.fonts.ready.then(() => {
    ready = true;
    schedule();
  });

  return () => {
    cancelAnimationFrame(frame);
    leaveLadder?.();
    watcher.disconnect();
    document.removeEventListener("pointermove", onMove);
    document.removeEventListener("mouseout", onLeave);
    window.removeEventListener("blur", onBlur);
    window.removeEventListener("scroll", onScroll, { capture: true });
    window.removeEventListener("resize", schedule);
    window.removeEventListener("fl-moved", onMoved);
    document.removeEventListener("transitionend", onMoved);
    reduced.removeEventListener("change", schedule);
    onPage.element.remove();
    onScreen.element.remove();
  };
}
