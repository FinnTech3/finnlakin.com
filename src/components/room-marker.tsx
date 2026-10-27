import type { RoomName } from "@/lib/rooms";

/* Says which room a page is in, for the pages that are not the home page.

   The home page changes room as the cloud changes shape and has the room
   watcher for that. Every other page is one room from top to bottom, and it
   says which in its own markup. The stylesheet reads it with :has() on the root,
   so the wall is the right colour in the first paint and not after the scripts
   have run, and the room watcher reads it back once they have, so the root's
   room attribute and the browser's theme colour agree with what is painted.

   Nothing is drawn: it is hidden, and it is only here to be found. */
export function RoomMarker({ room }: { room: RoomName }) {
  return <span hidden data-page-room={room} />;
}
