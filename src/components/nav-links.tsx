"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { nav } from "@/lib/site";

/* Only the link list is a client component, not the whole header. It needs the
   pathname and nothing else does, so the rest of the header stays server
   rendered.

   One pill holds them all and the current page is filled in cream, so where you
   are is carried by a shape and a weight and not by a colour alone.

   Six items now, and on a phone the pill has its own row and the width of the
   screen less its gutters. The padding and the size step down with the width so
   the six fit at 360 pixels and up: at the desktop padding they were 451 pixels
   across on a 390 screen, which made every page scroll sideways. */
export function NavLinks() {
  const pathname = usePathname();

  return (
    <ul className="glass flex items-center rounded-full p-1 min-[440px]:gap-0.5 sm:gap-1">
      {nav.map((item) => {
        const current =
          item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);

        return (
          <li key={item.href}>
            <Link
              href={item.href}
              aria-current={current ? "page" : undefined}
              className={`block rounded-full px-2 py-2 text-[0.75rem] font-semibold tracking-[0.01em] min-[440px]:px-3 min-[440px]:text-[0.8125rem] sm:px-4 ${
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
