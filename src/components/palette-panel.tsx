"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { buildPaletteItems } from "@/lib/palette";

const LIST_ID = "palette-results";
const optionId = (index: number) => `palette-option-${index}`;

/* A native <dialog> opened with showModal(), so focus trapping, Escape, the
   inert background and focus return to the trigger all come from the platform.

   There is deliberately no document-level click listener. next/link calls
   preventDefault() in its own React handler and React delegates to the
   document, so a document listener sees defaultPrevented on every internal
   link; gating on that would disable it for exactly the clicks that matter.
   Backdrop dismissal is a React handler on the dialog element instead. */
export default function PalettePanel({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const list = useRef<HTMLUListElement>(null);
  const router = useRouter();
  const pathname = usePathname();
  const [query, setQuery] = useState("");
  const [cursor, setCursor] = useState(0);

  const items = useMemo(() => buildPaletteItems(), []);

  const results = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return items;
    return items.filter(
      (item) =>
        item.label.toLowerCase().includes(needle) ||
        item.group.toLowerCase().includes(needle) ||
        (item.hint?.toLowerCase().includes(needle) ?? false),
    );
  }, [items, query]);

  /* Clamped at render rather than reset in an effect: React 19 errors on
     setState called synchronously in an effect body, and a derived value
     cannot go stale. */
  const active = results.length === 0 ? -1 : Math.min(cursor, results.length - 1);

  useEffect(() => {
    const node = dialog.current;
    if (!node) return;
    if (open && !node.open) node.showModal();
    if (!open && node.open) node.close();
  }, [open]);

  useEffect(() => {
    const node = dialog.current;
    if (!node) return;
    /* Escape and backdrop dismissal both fire the dialog's own close event,
       so state is reconciled from a subscription callback rather than guessed
       at from the handlers that might have caused it. */
    const onClose = () => {
      setQuery("");
      setCursor(0);
      onOpenChange(false);
    };
    node.addEventListener("close", onClose);
    return () => node.removeEventListener("close", onClose);
  }, [onOpenChange]);

  /* Close on an actual navigation, not on mount. The panel is mounted lazily
     and mounts already open, so an unguarded effect here closes it the instant
     it appears. */
  const mountedAt = useRef(pathname);
  useEffect(() => {
    if (mountedAt.current === pathname) return;
    mountedAt.current = pathname;
    dialog.current?.close();
  }, [pathname]);

  /* Keep the active row on screen. Without this, holding ArrowDown walks the
     selection off the bottom of the scroll container and the list appears to
     stop responding. */
  useEffect(() => {
    if (active < 0) return;
    list.current
      ?.querySelector(`#${optionId(active)}`)
      ?.scrollIntoView({ block: "nearest" });
  }, [active]);

  function onInputKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setCursor((current) => Math.min(current + 1, results.length - 1));
      return;
    }
    if (event.key === "ArrowUp") {
      event.preventDefault();
      setCursor((current) => Math.max(current - 1, 0));
      return;
    }
    if (event.key === "Home") {
      event.preventDefault();
      setCursor(0);
      return;
    }
    if (event.key === "End") {
      event.preventDefault();
      setCursor(results.length - 1);
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
          role="combobox"
          aria-expanded={results.length > 0}
          aria-controls={LIST_ID}
          aria-autocomplete="list"
          aria-activedescendant={active >= 0 ? optionId(active) : undefined}
          autoComplete="off"
          spellCheck={false}
          className="border-b border-rule bg-transparent px-5 py-4 text-[16px] outline-none placeholder:text-muted"
        />

        {/* Announces the count as the query narrows, so a screen reader user
            knows the list changed without having to arrow through it. */}
        <p aria-live="polite" className="sr-only">
          {results.length === 0
            ? "No results"
            : `${results.length} result${results.length === 1 ? "" : "s"}`}
        </p>

        {results.length === 0 ? (
          <p className="px-4 py-6 text-sm text-muted">Nothing matches {`"${query}"`}.</p>
        ) : (
          <ul
            ref={list}
            id={LIST_ID}
            role="listbox"
            aria-label="Results"
            className="max-h-[min(60vh,26rem)] overflow-y-auto py-1.5"
          >
            {results.map((item, index) => {
              const isActive = index === active;
              const className = `flex items-baseline justify-between gap-4 px-4 py-2.5 text-sm ${
                isActive ? "bg-action-soft text-ink" : "text-ink-soft"
              }`;
              const shared = {
                id: optionId(index),
                role: "option",
                "aria-selected": isActive,
                className,
                onMouseEnter: () => setCursor(index),
                onClick: () => dialog.current?.close(),
              } as const;
              const inner = (
                <>
                  <span className="truncate">{item.label}</span>
                  {/* Visual grouping only. Every label already carries the
                      project name, so announcing the group too just repeats
                      "Repository" down the whole list. */}
                  <span
                    aria-hidden="true"
                    className="t-label shrink-0"
                  >
                    {item.group}
                  </span>
                </>
              );

              return (
                <li key={`${item.group}-${item.href}`}>
                  {item.external ? (
                    <a href={item.href} target="_blank" rel="noopener noreferrer" {...shared}>
                      {inner}
                    </a>
                  ) : (
                    <Link href={item.href} {...shared}>
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
  );
}
