"use client";

import type { MouseEvent } from "react";

/* The way back up, at the foot of every page.

   The home page is long and its footer is where a reader ends up, having come
   past ten projects, so a way back to the name and the navigation without a
   long scroll is a kindness and not a feature. It is a button and not an anchor
   to the top of the page: it does something to the page rather than going
   somewhere in it, and a link to the top would add a history entry and put a
   fragment in the address bar.

   It scrolls smoothly, and not for a reader who asked for less motion, who is
   taken there at once. That is asked of the scroll itself rather than left to
   the stylesheet, because the stylesheet's rule for reduced motion only
   governs scrolls the stylesheet makes and not one a script asks for.

   A keyboard user is moved with the page. The button they pressed is at the
   foot of it, and left focused it would put their next Tab at the foot as well,
   with the whole page they asked to go back to above them. A mouse or a finger
   has no use for focus and is left alone, because moving it would put a ring
   round the name for no reason. A click that came from the keyboard is the one
   with no pointer detail. */
export function BackToTop() {
  function goUp(event: MouseEvent<HTMLButtonElement>) {
    const calm = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    window.scrollTo({ top: 0, behavior: calm ? "auto" : "smooth" });
    if (event.detail === 0) {
      document.querySelector<HTMLElement>("header a")?.focus({ preventScroll: true });
    }
  }

  return (
    <button type="button" onClick={goUp} className="pill pill-ghost cursor-pointer print:hidden">
      <svg
        aria-hidden="true"
        viewBox="0 0 16 16"
        className="size-3.5 shrink-0"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.25"
        strokeLinecap="square"
      >
        <path d="M8 14V2M2.5 7.5 8 2l5.5 5.5" />
      </svg>
      Back To Top
    </button>
  );
}
