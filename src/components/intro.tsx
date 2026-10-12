"use client";

/* The opening animation is no longer a particle system. It is two entries in
   the same target texture the brain lives in, drawn by the same engine, and
   what remains here is the carbon it happens against and the decision about
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
  return (
    <>
      <div className="intro" aria-hidden="true" inert />
      {/* A way out that does not need a keyboard. An iPad has no Escape key, and
          the opening runs for about eight seconds, which is longer than moving
          content should run without a way to stop it. A sibling of the veil and
          not a child, because the veil is aria-hidden and inert and a button
          inside it would be neither reachable nor honest. Hidden by the
          stylesheet until the opening is running. */}
      <button type="button" className="intro-skip t-label" data-intro-skip="">
        Skip
      </button>
    </>
  );
}

/* Runs before the first paint, which is the whole point of it being here rather
   than in a component: by the time React hydrates the page has already been
   visible for a frame or two, and the brief was that the animation is the only
   thing on screen.

   It sets one attribute. A reader with JavaScript off never gets the attribute,
   so they never get the overlay, and the page they see is the finished one. */
export function IntroBoot() {
  /* The timeout is the failsafe. The engine that clears this attribute is
     loaded on demand, and if that request never arrives, the reader is left
     looking at an opaque rectangle with the finished page underneath it.

     It stands down once the engine has taken the animation over, which the
     engine marks with data-intro-owned. Twelve seconds used to be assumed to be
     past the engine's own ceiling, and it is only past it when the engine
     arrives within the first three: on a slow connection the engine could
     start at five seconds and have the veil pulled out from under its words at
     twelve, halfway through. From the moment the engine owns it, its own
     ceiling, ten seconds from its start, is the guarantee.

     It also answers the Skip button until the engine does. The engine is loaded
     on demand, and on a slow connection the button is on the screen for some
     seconds before anything is listening to it, which is exactly when somebody
     reaches for it. Once the engine owns the animation this stands down and the
     engine's own handler ends it, so the two never both act. */
  const source = `try{if(location.pathname==="/"&&!sessionStorage.getItem(${JSON.stringify(
    STORAGE_KEY,
  )})&&!matchMedia("(prefers-reduced-motion: reduce)").matches){var r=document.documentElement;r.dataset.intro="running";setTimeout(function(){if(r.dataset.intro==="running"&&!r.hasAttribute("data-intro-owned")){delete r.dataset.intro}},12000);document.addEventListener("click",function(e){var t=e.target;if(t&&t.closest&&t.closest("[data-intro-skip]")&&r.dataset.intro==="running"&&!r.hasAttribute("data-intro-owned")){try{sessionStorage.setItem(${JSON.stringify(
    STORAGE_KEY,
  )},"1")}catch(x){}delete r.dataset.intro}})}}catch(e){}`;
  return <script dangerouslySetInnerHTML={{ __html: source }} />;
}
