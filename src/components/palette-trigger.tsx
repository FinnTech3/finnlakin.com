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
        /* min-h-11 keeps this at a real touch target. The shortcut hint is
           hidden on small screens, where a meta key does not exist, but the
           button itself is how a phone reaches the palette at all. */
        className="flex min-h-11 items-center gap-2 border border-rule px-3 font-mono text-[11px] text-muted hover:border-accent hover:text-accent sm:min-h-0 sm:py-1.5"
      >
        Search
        <kbd aria-hidden="true" className="hidden font-mono text-[10px] tracking-wider sm:inline">
          ⌘K
        </kbd>
      </button>

      {mounted ? <PalettePanel open={open} onOpenChange={setOpen} /> : null}
    </>
  );
}
