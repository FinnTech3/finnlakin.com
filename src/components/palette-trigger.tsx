"use client";

import dynamic from "next/dynamic";
import { useEffect, useState } from "react";

/* ssr:false because a dialog that nobody has opened has nothing to render on
   the server, and this is the whole point of the split: the panel, its item
   list and its filtering stay out of the first-load bundle of every page. */
const PalettePanel = dynamic(() => import("./palette-panel"), { ssr: false });

export function PaletteTrigger() {
  /* Two pieces of state rather than one. `mounted` latches on first open so
     the chunk is fetched once and reopening is instant; `open` is what the
     dialog actually follows. */
  const [mounted, setMounted] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setMounted(true);
        setOpen((current) => !current);
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, []);

  /* Warm the chunk once the browser is otherwise idle. Keeping the panel out
     of the first-load bundle is the point of the split, but a cold fetch on
     the first keypress is a visible stall on a slow connection. Fetching it
     during idle time costs nothing on the critical path and makes the first
     open instant. The import shares webpack's chunk cache with next/dynamic,
     so this genuinely warms the same module. */
  useEffect(() => {
    const preload = () => {
      void import("./palette-panel");
    };
    if (typeof window.requestIdleCallback === "function") {
      const handle = window.requestIdleCallback(preload, { timeout: 3000 });
      return () => window.cancelIdleCallback?.(handle);
    }
    const handle = window.setTimeout(preload, 2000);
    return () => window.clearTimeout(handle);
  }, []);

  function openPalette() {
    setMounted(true);
    setOpen(true);
  }

  return (
    <>
      <button
        type="button"
        onClick={openPalette}
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
