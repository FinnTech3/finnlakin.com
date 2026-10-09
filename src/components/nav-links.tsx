"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { nav } from "@/lib/site";

/* Only the link list is a client component, not the whole header. It needs the
   pathname and nothing else does, so the rest of the header stays server
   rendered.

   The current page is underlined, because on a wall the only things that can
   say where you are are weight and a line. */
export function NavLinks() {
  const pathname = usePathname();

  return (
    <ul className="flex items-center gap-6">
      {nav.map((item) => {
        const current =
          item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);

        return (
          <li key={item.href}>
            <Link
              href={item.href}
              aria-current={current ? "page" : undefined}
              className={`t-label hover:bg-accent-soft hover:text-carbon ${
                current ? "text-ink underline decoration-2 underline-offset-4" : "text-muted"
              }`}
            >
              {item.label}
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
