/* Variable Proximity, after the component of that name in 000h by Cojeev
   (MIT licence, https://cojeev.com/ui/docs/variable-proximity/). The weight
   curve, the radius, the frame per pointer move and the rule that a finger is
   ignored are the original's.

   What is not the original's is where it is drawn. The component splits one
   headline into a span per letter inside a panel of its own, with its own
   fonts, its own tokens and a reset for everything under [data-slot]. Applied
   to every word on this site that would have replaced the two faces (its token
   sheet defines --font-display, which is this site's headline face), loaded
   fonts from a host the content security policy refuses, and rewritten the
   text of every page into letters, which React owns and a screen reader reads.

   So the page is never touched. A layer over everything, which nothing can
   click, hear or select, draws the heavier letter on top of the real one, in
   the real one's face, size, colour and place, and only while the pointer is
   near it. At rest the layer is empty and the page is exactly what it was. The
   weight runs from the text's own weight to the top of its face's axis, so a
   letter only ever gets heavier, and the faces are the two already loaded:
   Martian Mono is monospaced, so a heavier letter takes no more room, and the
   heavier Big Shoulders is drawn centred over the lighter one, which it
   covers. */

const bounded = (value: number, min: number, max: number) =>
  Math.max(min, Math.min(max, value));

/* The original's curve: a smoothstep from the far edge of the radius in. */
function proximityWeight(distance: number, radius: number, from: number, to: number) {
  const p = 1 - bounded(distance / radius, 0, 1);
  return from + (to - from) * p * p * (3 - 2 * p);
}

/* Text that is not prose, or not drawn as a line of letters in the page. */
const SKIP = "script,style,noscript,template,svg,canvas,textarea,input,select,[contenteditable],[data-proximity-layer]";

/* The furthest any letter is reached from the pointer. */
const REACH = 360;

/* The tops of the two faces' weight axes. */
const ceilingFor = (family: string) => (family.includes("Martian") ? 800 : 900);

type Look = { opacity: number } | null;

export function startVariableProximity(): () => void {
  const reduced = matchMedia("(prefers-reduced-motion: reduce)");
  const layer = document.createElement("div");
  layer.className = "proximity-layer";
  layer.setAttribute("aria-hidden", "true");
  layer.dataset.proximityLayer = "";
  document.body.append(layer);

  const pool: HTMLSpanElement[] = [];
  const texts = new Map<Element, Text[]>();
  let dirty = true;
  let ready = false;
  let point: { x: number; y: number } | null = null;
  let frame = 0;
  let drawn = 0;

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
    for (let at: Element | null = element; at && at !== document.documentElement; at = at.parentElement) {
      const style = getComputedStyle(at);
      opacity *= Number(style.opacity);
      if (opacity < 0.02 || style.visibility === "hidden") return null;
      const transform = style.transform;
      if (transform !== "none") {
        const m = transform.match(/^matrix\(([^)]+)\)$/);
        const v = m ? m[1].split(",").map(Number) : null;
        if (!v || v[0] !== 1 || v[1] !== 0 || v[2] !== 0 || v[3] !== 1) return null;
      }
    }
    return { opacity };
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
      const to = ceilingFor(style.fontFamily);
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
          });
        }
      }
    }
    return glyphs;
  }

  function draw(glyphs: Glyph[]) {
    glyphs.forEach((glyph, index) => {
      let span = pool[index];
      if (!span) {
        span = document.createElement("span");
        pool.push(span);
        layer.append(span);
      }
      const s = span.style;
      span.textContent = glyph.char;
      s.display = "block";
      s.left = `${glyph.x}px`;
      s.top = `${glyph.top}px`;
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
    });
    for (let index = glyphs.length; index < drawn; index++) pool[index].style.display = "none";
    drawn = glyphs.length;
  }

  function paint() {
    frame = 0;
    const running = ready && point && !reduced.matches && !document.documentElement.dataset.intro;
    if (running && dirty) rebuild();
    draw(running ? collect() : []);
  }

  const schedule = () => {
    if (!frame) frame = requestAnimationFrame(paint);
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

  /* The page's own text changing, on a navigation or a panel opening. The
     layer's own letters are not the page's and do not count. */
  const watcher = new MutationObserver((records) => {
    if (records.some((record) => !layer.contains(record.target))) dirty = true;
  });
  watcher.observe(document.body, { childList: true, subtree: true, characterData: true });

  document.addEventListener("pointermove", onMove, { passive: true });
  document.addEventListener("mouseout", onLeave);
  window.addEventListener("blur", onBlur);
  window.addEventListener("scroll", onScroll, { passive: true, capture: true });
  window.addEventListener("resize", schedule);
  reduced.addEventListener("change", schedule);

  /* The letters are measured in the real faces, so nothing is drawn until they
     have arrived. */
  void document.fonts.ready.then(() => {
    ready = true;
    schedule();
  });

  return () => {
    cancelAnimationFrame(frame);
    watcher.disconnect();
    document.removeEventListener("pointermove", onMove);
    document.removeEventListener("mouseout", onLeave);
    window.removeEventListener("blur", onBlur);
    window.removeEventListener("scroll", onScroll, { capture: true });
    window.removeEventListener("resize", schedule);
    reduced.removeEventListener("change", schedule);
    layer.remove();
  };
}
