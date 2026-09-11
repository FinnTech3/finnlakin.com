"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { nav } from "@/lib/site";

/* Only the link list is a client component, not the whole header. It needs the
   pathname and nothing else does, so the rest of the header stays server
   rendered. */
export function NavLinks() {
  const pathname = usePathname();

  return (
    <ul className="flex items-center gap-5">
      {nav.map((item) => {
        const current =
          item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);

        return (
          <li key={item.href}>
            <Link
              href={item.href}
              aria-current={current ? "page" : undefined}
              className={`font-mono text-[12px] uppercase tracking-[0.08em] hover:text-accent ${
                current ? "text-ink" : "text-muted"
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
