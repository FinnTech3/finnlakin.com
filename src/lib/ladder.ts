import type { FrameScheduler } from "@/particles/frame";

/* The page's frame ladder, which the cloud puts on the window (see
   frameScheduler in particles/frame.ts). Read from there and not imported: an
   import copies the scheduler into the importing chunk as well, which is bytes
   the home page's budget does not have, and the copy would be a second ladder,
   which is the arrangement the ladder exists to end.

   Undefined where the cloud is not running: another page, a reader whose
   machine could not build it, or a reader who asked for less motion. Whatever
   asks for it then has nothing to join, and is decoration on a page with
   nothing to protect, so it runs on a frame of its own or not at all. */
export const ladder = (): FrameScheduler | undefined =>
  (window as unknown as Record<string, FrameScheduler | undefined>).__frameScheduler;
