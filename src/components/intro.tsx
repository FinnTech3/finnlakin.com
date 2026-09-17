"use client";

/* The opening animation is no longer a particle system. It is two entries in
   the same target texture the brain lives in, drawn by the same engine, and
   what remains here is the black it happens against and the decision about
   whether it happens at all.

   That is most of the file gone, and the reason is worth keeping: the previous
   version was a second two dimensional canvas with its own loop, its own
   sprites and its own compositing, and it could not be made to look right.
   Additive blending on a flat canvas saturates to a white blob the moment
   particles overlap, and normal blending over a motion trail wash leaves the
   word barely legible. There is no value between those that is good. Drawn by
   the engine the words accumulate into a half float target and are tone mapped,
   which is the thing that makes overlapping light read as brightness rather
   than as clipping. */

export const STORAGE_KEY = "fl-intro-played";

/* The veil. aria-hidden and inert together, because it is decoration over a
   page that is already complete underneath it: it must not be announced and
   must not take focus. */
export function Intro() {
  return <div className="intro" aria-hidden="true" inert />;
}

/* Runs before the first paint, which is the whole point of it being here rather
   than in a component: by the time React hydrates the page has already been
   visible for a frame or two, and the brief was that the animation is the only
   thing on screen.

   It sets one attribute. A reader with JavaScript off never gets the attribute,
   so they never get the overlay, and the page they see is the finished one. */
export function IntroBoot() {
  const source = `try{if(location.pathname==="/"&&!sessionStorage.getItem(${JSON.stringify(
    STORAGE_KEY,
  )})&&!matchMedia("(prefers-reduced-motion: reduce)").matches){document.documentElement.dataset.intro="running"}}catch(e){}`;
  return <script dangerouslySetInnerHTML={{ __html: source }} />;
}
