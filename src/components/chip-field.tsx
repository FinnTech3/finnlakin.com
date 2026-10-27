"use client";

import { useEffect } from "react";
import { ladder } from "@/lib/ladder";

/* The tools part like the cloud does.

   Every chip inside a [data-chip-field] drifts away from the pointer, the way
   the particles do, and settles back when it leaves. It is the same idea at a
   different scale, and it is the one place on the page where something that is
   not the cloud answers the cursor in the cloud's own manner.

   A decoration, so it joins the page's frame ladder at a rank above everything
   else and is given up before the cloud loses a particle; see particles/frame.ts
   and the note in components/ui/variable-proximity.ts for why that matters.
   Where there is no ladder (the cloud is not running) it runs on a frame of its
   own, and only while the pointer is over the field.

   Only for a pointer that hovers, and not for a reader who asked for less
   motion.

   Where a chip rests is read from where it is, a frame at a time, less the
   distance this has moved it, and is not remembered. It was remembered, from
   when the page loaded, and the tools arrive: a block of them sits a little low
   until it has come into view, so every chip was measured about thirty pixels
   below where it ended up and pushed away from a place it was not. Reading all
   of them before writing any of them keeps it to one layout for the lot. Renders
   nothing. */
const REACH = 130;
const PUSH = 26;

type Chip = { element: HTMLElement; x: number; y: number };

export function ChipField() {
  useEffect(() => {
    if (!matchMedia("(hover: hover) and (pointer: fine)").matches) return;
    if (matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const fields = Array.from(document.querySelectorAll<HTMLElement>("[data-chip-field]"));
    if (fields.length === 0) return;

    const chips: Chip[] = fields.flatMap((field) =>
      Array.from(field.querySelectorAll<HTMLElement>("[data-chip]")).map((element) => ({
        element,
        x: 0,
        y: 0,
      })),
    );
    let point: { x: number; y: number } | null = null;
    let frame = 0;
    let leave: (() => void) | null = null;
    let moving = false;

    const step = () => {
      frame = 0;
      moving = false;

      /* Every read, and then every write. */
      const rests = chips.map((chip) => {
        const box = chip.element.getBoundingClientRect();
        return { x: box.left + box.width / 2 - chip.x, y: box.top + box.height / 2 - chip.y };
      });

      let wrote = false;
      chips.forEach((chip, index) => {
        let tx = 0;
        let ty = 0;
        if (point) {
          const dx = rests[index]!.x - point.x;
          const dy = rests[index]!.y - point.y;
          const d = Math.hypot(dx, dy);
          if (d < REACH && d > 0.001) {
            const k = (1 - d / REACH) ** 2 * PUSH;
            tx = (dx / d) * k;
            ty = (dy / d) * k;
          }
        }
        chip.x += (tx - chip.x) * 0.2;
        chip.y += (ty - chip.y) * 0.2;
        if (Math.abs(chip.x) < 0.05 && Math.abs(chip.y) < 0.05 && tx === 0 && ty === 0) {
          chip.x = 0;
          chip.y = 0;
          if (chip.element.style.transform) {
            chip.element.style.transform = "";
            wrote = true;
          }
        } else {
          chip.element.style.transform = `translate(${chip.x.toFixed(2)}px, ${chip.y.toFixed(2)}px)`;
          moving = true;
          wrote = true;
        }
      });

      /* The words in the chips have moved, so the letter weight effect, which
         measures them where they are, is told to measure again. */
      if (wrote) window.dispatchEvent(new Event("fl-moved"));
      if (moving || point) request();
    };

    const request = () => {
      const page = ladder();
      if (page) {
        leave ??= page.add({
          rank: 1100,
          draw: () => {
            step();
            if (!moving && !point) {
              leave?.();
              leave = null;
            }
          },
          onShed: () => {
            point = null;
            for (const chip of chips) chip.element.style.transform = "";
            leave?.();
            leave = null;
          },
        });
      } else if (!frame) {
        frame = requestAnimationFrame(step);
      }
    };

    const onMove = (event: PointerEvent) => {
      if (event.pointerType === "touch") return;
      point = { x: event.clientX, y: event.clientY };
      request();
    };
    const onLeave = () => {
      point = null;
      request();
    };

    fields.forEach((element) => {
      element.addEventListener("pointermove", onMove, { passive: true });
      element.addEventListener("pointerleave", onLeave);
    });

    return () => {
      cancelAnimationFrame(frame);
      leave?.();
      fields.forEach((element) => {
        element.removeEventListener("pointermove", onMove);
        element.removeEventListener("pointerleave", onLeave);
      });
      for (const chip of chips) chip.element.style.transform = "";
    };
  }, []);

  return null;
}
