"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { nav } from "@/lib/site";

/* Only the link list is a client component, not the whole header. It needs the
   pathname and nothing else does, so the rest of the header stays server
   rendered.

   One pill holds them all and the current page is filled in cream, so where you
   are is carried by a shape and a weight and not by a colour alone. */
export function NavLinks() {
  const pathname = usePathname();

  return (
    <ul className="glass flex items-center gap-1 rounded-full p-1">
      {nav.map((item) => {
        const current =
          item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);

        return (
          <li key={item.href}>
            <Link
              href={item.href}
              aria-current={current ? "page" : undefined}
              className={`block rounded-full px-4 py-2 text-[0.8125rem] font-semibold tracking-[0.01em] ${
                current
                  ? "bg-cream text-carbon"
                  : "text-muted hover:bg-accent-soft hover:text-carbon"
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
