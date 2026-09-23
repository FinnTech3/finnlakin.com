"use client";

import dynamic from "next/dynamic";
import { useEffect, useRef, useState } from "react";

/* ssr:false because a dialog that nobody has opened has nothing to render on
   the server, and this is the whole point of the split: the panel, its item
   list and its filtering stay out of the first-load bundle of every page. */
const PalettePanel = dynamic(() => import("./palette-panel"), { ssr: false });

/* The beacon is a plain script rather than a module, so this is how a component
   reaches it. Module scope because it closes over nothing: keeping it inside
   the component only made it a value the keydown listener captured before it
   was declared. Optional throughout, since Do Not Track, a blocked script or an
   ad blocker all leave the global undefined, and none of those should stop the
   palette opening. */
function track() {
  (
    window as unknown as {
      __analytics?: { track: (event: string, meta: Record<string, unknown>) => void };
    }
  ).__analytics?.track("palette_open", { path: location.pathname });
}

export function PaletteTrigger() {
  /* Two pieces of state rather than one. `mounted` latches on first open so
     the chunk is fetched once and reopening is instant; `open` is what the
     dialog actually follows. */
  const [mounted, setMounted] = useState(false);
  const [open, setOpen] = useState(false);

  /* The keydown listener is registered once, so `open` inside it would be the
     value from first render forever. This mirrors it, which is also what lets
     the shortcut tell opening from closing without putting a side effect in a
     state updater. */
  const isOpen = useRef(false);
  useEffect(() => {
    isOpen.current = open;
  }, [open]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        const opening = !isOpen.current;
        setMounted(true);
        setOpen(opening);
        if (opening) track();
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, []);

  /* Warm the chunk on intent rather than on idle. Fetching it during idle time
     was measurably worse than not splitting at all: everyone paid for the
     chunk plus the split overhead, including the large majority who never open
     it. Pointer or focus on the trigger is a reliable signal that someone is
     about to, and it arrives far enough ahead of the click that the panel is
     already there. Anyone who goes straight for the shortcut pays one small
     fetch, which is imperceptible.

     The import shares webpack's chunk cache with next/dynamic, so this warms
     the same module rather than fetching a second copy. */
  function warm() {
    void import("./palette-panel");
  }

  function openPalette() {
    setMounted(true);
    setOpen(true);
    track();
  }

  return (
    <>
      <button
        type="button"
        onClick={openPalette}
        onPointerEnter={warm}
        onFocus={warm}
        aria-haspopup="dialog"
        aria-expanded={open}
        /* min-h-11 keeps this at a real touch target.

           No shortcut hint. It read as a badge bolted to a button rather than
           as something to type into, and a meta key glyph is meaningless on the
           half of the traffic that has no meta key. The shortcut itself still
           works, because it costs nothing and nobody who does not know about it
           is worse off; what has gone is the label.

           No fill either, and that is not a style preference. The header is laid
           over both surfaces this site has: it sits on the dark stage at the top
           of the home page and on paper everywhere else, and the rule that
           lightens its text for the stage does not lighten every token it uses.
           A bg-card here resolved to the paper mist, so the control rendered as
           a near white pill with the stage's near white text on it, at 2.3:1.
           The border is enough to read as a field, and it is a token the header
           does override. */
        className="t-label flex min-h-11 w-full min-w-[9rem] items-center gap-2.5 rounded-full border border-rule px-4 text-left text-muted hover:border-rule-strong hover:text-ink sm:min-h-0 sm:w-auto sm:py-2.5"
      >
        {/* A magnifier, so the control reads as a field to search in rather
            than as a button that says Search. Inline rather than an icon
            dependency: it is nine numbers. */}
        <svg
          aria-hidden="true"
          viewBox="0 0 16 16"
          className="size-4 shrink-0"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
        >
          <circle cx="7" cy="7" r="4.5" />
          <path d="M10.5 10.5 14 14" strokeLinecap="round" />
        </svg>
        Search
      </button>

      {mounted ? <PalettePanel open={open} onOpenChange={setOpen} /> : null}
    </>
  );
}
