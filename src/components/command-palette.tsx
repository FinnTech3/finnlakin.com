"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";

export type PaletteItem = {
  href: string;
  label: string;
  group: string;
  hint?: string;
  external?: boolean;
};

/* A native <dialog> opened with showModal(), so focus trapping, Escape, inert
   background and focus return to the trigger all come from the platform.

   Note there is no document-level click listener anywhere here. next/link
   calls preventDefault() in its own React handler and React delegates to the
   document, so a document listener sees defaultPrevented === true for every
   internal link; gating on that would silently disable the listener for
   exactly the clicks that matter. Backdrop dismissal is a React handler on the
   dialog element instead, which never sees another element's prevented event. */
export function CommandPalette({ items }: { items: PaletteItem[] }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const router = useRouter();
  const pathname = usePathname();
  const [query, setQuery] = useState("");
  const [cursor, setCursor] = useState(0);

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return items;
    return items.filter(
      (item) =>
        item.label.toLowerCase().includes(q) ||
        item.group.toLowerCase().includes(q) ||
        (item.hint?.toLowerCase().includes(q) ?? false),
    );
  }, [items, query]);

  /* Clamped at render rather than reset in an effect: React 19 errors on
     setState called synchronously in an effect body, and a derived value
     cannot go stale. */
  const active = results.length === 0 ? -1 : Math.min(cursor, results.length - 1);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        const node = dialog.current;
        if (!node) return;
        if (node.open) node.close();
        else node.showModal();
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, []);

  /* Reset happens in the dialog's own close event, a subscription callback,
     not in an effect body. */
  useEffect(() => {
    const node = dialog.current;
    if (!node) return;
    const onClose = () => {
      setQuery("");
      setCursor(0);
    };
    node.addEventListener("close", onClose);
    return () => node.removeEventListener("close", onClose);
  }, []);

  useEffect(() => {
    dialog.current?.close();
  }, [pathname]);

  function onInputKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setCursor((c) => Math.min(c + 1, results.length - 1));
      return;
    }
    if (event.key === "ArrowUp") {
      event.preventDefault();
      setCursor((c) => Math.max(c - 1, 0));
      return;
    }
    if (event.key === "Enter" && active >= 0) {
      event.preventDefault();
      const item = results[active];
      dialog.current?.close();
      if (item.external) window.open(item.href, "_blank", "noopener,noreferrer");
      else router.push(item.href);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => dialog.current?.showModal()}
        className="flex items-center gap-2 border border-rule px-2.5 py-1.5 font-mono text-[11px] text-muted hover:border-accent hover:text-accent"
      >
        Search
        <kbd className="font-mono text-[10px] tracking-wider">⌘K</kbd>
      </button>

      <dialog
        ref={dialog}
        aria-label="Search this site"
        className="palette"
        onClick={(event) => {
          if (event.target === dialog.current) dialog.current?.close();
        }}
      >
        <div className="flex flex-col">
          <input
            id="palette-query"
            autoFocus
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            onKeyDown={onInputKeyDown}
            placeholder="Jump to a project, a write-up, a page"
            aria-label="Search this site"
            className="border-b border-rule bg-transparent px-4 py-3.5 text-[15px] outline-none placeholder:text-muted"
          />

          {results.length === 0 ? (
            <p className="px-4 py-6 text-sm text-muted">
              Nothing matches {`"${query}"`}.
            </p>
          ) : (
            <ul className="max-h-[min(60vh,26rem)] overflow-y-auto py-1.5">
              {results.map((item, index) => {
                const isActive = index === active;
                const className = `flex items-baseline justify-between gap-4 px-4 py-2.5 text-sm ${
                  isActive ? "bg-accent-soft text-accent" : "text-ink-soft"
                }`;
                const inner = (
                  <>
                    <span className="truncate">{item.label}</span>
                    {/* Visual grouping only. Every label already carries the
                        project name, so announcing the group too just repeats
                        "Repository" down the whole list. */}
                    <span
                      aria-hidden="true"
                      className="shrink-0 font-mono text-[10.5px] uppercase tracking-[0.1em] text-muted"
                    >
                      {item.group}
                    </span>
                  </>
                );

                return (
                  <li key={`${item.group}-${item.href}`} onMouseEnter={() => setCursor(index)}>
                    {item.external ? (
                      <a
                        href={item.href}
                        target="_blank"
                        rel="noopener noreferrer"
                        className={className}
                        onClick={() => dialog.current?.close()}
                      >
                        {inner}
                      </a>
                    ) : (
                      <Link
                        href={item.href}
                        className={className}
                        onClick={() => dialog.current?.close()}
                      >
                        {inner}
                      </Link>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </dialog>
    </>
  );
}
