"use client";

import { usePathname } from "next/navigation";
import { useEffect } from "react";
import { homeRoom, ROOM_EVENT, roomOfShape, rooms, type Room, type RoomName } from "@/lib/rooms";
import type { ShapeName } from "@/particles/structures";

/* The weather. Moves the page from room to room as the cloud changes shape.

   A band is the unit the cloud changes its mind at, and each band says what
   shape it wants in its markup. The room is whichever band is across the middle
   of the window, so the wall turns over at the moment the cloud is halfway
   through its own change and the two read as one event: a different shape, in a
   different light.

   What it does is set one attribute on the root element, which the stylesheet
   reads, and tell the cloud, which tints itself to match. It renders nothing.
   The wall's own change is a CSS transition, so a reader who asked for less
   motion gets the new room at once without this file knowing about it.

   Only the home page has bands. Every other page is one room from top to
   bottom and says which in a marker in its own markup, which is read here so
   that the attribute and the browser's theme colour agree with what the
   stylesheet has already painted. A page with no marker is in the first room. */

export function RoomWatcher() {
  const pathname = usePathname();

  useEffect(() => {
    const root = document.documentElement;
    const theme = document.querySelector('meta[name="theme-color"]');

    const enter = (room: Room) => {
      if (root.dataset.room === room.name) return;
      root.dataset.room = room.name;
      theme?.setAttribute("content", room.wall);
      window.dispatchEvent(new CustomEvent<Room>(ROOM_EVENT, { detail: room }));
    };

    if (pathname !== "/") {
      const named = document.querySelector<HTMLElement>("[data-page-room]")?.dataset.pageRoom;
      enter(named && named in rooms ? rooms[named as RoomName] : homeRoom);
      return;
    }

    const bands = Array.from(document.querySelectorAll<HTMLElement>("[data-band][data-shape]"));
    if (bands.length === 0 || typeof IntersectionObserver === "undefined") return;

    /* A line across the middle of the window, which is what a margin of half the
       window off the top and half off the bottom makes of it. A band is current
       while it crosses it. */
    const watcher = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          const shape = (entry.target as HTMLElement).dataset.shape as ShapeName | undefined;
          const name: RoomName | undefined = shape ? roomOfShape[shape] : undefined;
          if (name) enter(rooms[name]);
        }
      },
      { rootMargin: "-50% 0px -50% 0px" },
    );
    bands.forEach((band) => watcher.observe(band));

    return () => {
      watcher.disconnect();
      enter(homeRoom);
    };
  }, [pathname]);

  return null;
}
