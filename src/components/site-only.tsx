"use client";

import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

/* Everything that belongs to the site rather than to a page: the black plate
   and its shader, the header, the footer.

   The design directions under /looks are whole surfaces of their own, each with
   its own paper, its own type and its own way of drawing the cloud, and a black
   plate behind them or the site's own header above them would be answering a
   question nobody asked. They are mockups: the point is to see one look at a
   time, entire.

   A gate rather than a second root layout. Route groups can carry a root layout
   each, which would be a cleaner document, but every existing route would have
   to move into one and navigation between the groups becomes a full page load.
   Three temporary pages do not get to reorganise the site.

   It unmounts rather than hides. The shader behind the page owns a WebGL
   context and draws thirty times a second; display:none would leave it running
   under a page that cannot see it, which is exactly the fault that was fixed on
   this branch a few commits ago. */
export function SiteOnly({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  if (pathname === "/looks" || pathname?.startsWith("/looks/")) return null;
  return <>{children}</>;
}
