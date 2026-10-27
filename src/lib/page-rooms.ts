import type { Viewport } from "next";
import { bandPlan, PROJECTS_PER_BAND } from "@/lib/bands";
import { projects } from "@/lib/projects";
import { homeRoom, roomOfShape, rooms, type RoomName } from "@/lib/rooms";

/* The rooms of the pages that are not the home page, and what the head says
   about them.

   Kept apart from lib/rooms.ts because that table is read by the cloud, which
   is in the browser's bundle, and the projects and the band plan are not
   something the browser needs in order to tint a particle.

   The theme colour is the browser's own chrome on a phone, and it is the wall
   of the room: a page that is one colour with a bar of another across the top
   of the screen is a page with a seam in it. Every page that is not midnight
   says so here, so the head is right before a script has run. */
export function roomViewport(room: RoomName): Viewport {
  return { themeColor: rooms[room].wall, colorScheme: "dark" };
}

/* An essay is in the room of the project it is about, which is the room that
   project's entry is in on the home page: the same two colours, the same
   shape of cloud, arrived at from the other direction. The work is cut into
   bands of two and the shape of each band is in lib/bands.ts, so this reads
   the plan and not a second list that could drift from it. */
export function roomOfProject(slug: string): RoomName {
  const index = projects.findIndex((project) => project.slug === slug);
  if (index < 0) return homeRoom.name;

  const band = bandPlan(projects.length)[1 + Math.floor(index / PROJECTS_PER_BAND)];
  return band ? roomOfShape[band.shape] : homeRoom.name;
}

/* The pages with a room of their own. The rest are midnight, which is the
   colour the root starts in. */
export const pageRoom = {
  path: "lagoon",
  writing: "ember",
  reel: "indigo",
  notFound: "wine",
} as const satisfies Record<string, RoomName>;
