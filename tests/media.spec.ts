import { existsSync, statSync } from "node:fs";
import { join } from "node:path";
import { expect, test } from "@playwright/test";
import { clipById, clips, projectClips, reelClips } from "../src/lib/media";

/* The media manifest against the disk.

   Two clips pointed at files that had been deleted, and nothing noticed,
   because nothing asked for them: both sit on /reel, which plays the 4K file,
   and the missing ones were the card renditions. A manifest is a claim about
   what is on disk, and this site's rule for claims is that they are checked.
   None of this needs a browser, so none of it waits for one. */

const PUBLIC = join(__dirname, "..", "public");

test.describe("the media manifest", () => {
  test("names only files that exist", () => {
    for (const clip of clips) {
      for (const path of [clip.src, clip.srcFull, clip.poster]) {
        if (path === undefined) continue;
        const file = join(PUBLIC, path);
        expect(existsSync(file), `${clip.id} names ${path}, which is not there`).toBe(true);
        expect(statSync(file).size, `${clip.id} names ${path}, which is empty`).toBeGreaterThan(0);
      }
    }
  });

  test("gives every project a clip with a card rendition", () => {
    /* Beside a project a clip renders about seven hundred pixels wide. A clip
       there with only its 4K file would still play, and would download thirty
       megabytes nobody can see. */
    for (const [slug, id] of Object.entries(projectClips)) {
      const clip = clipById.get(id);
      expect(clip, `${slug} is paired with ${id}, which is not in the manifest`).toBeDefined();
      expect(clip!.src, `${slug} is paired with ${id}, which has no card rendition`).toBeDefined();
    }
  });

  test("gives the reel clips something to play at full width", () => {
    for (const id of reelClips) {
      const clip = clipById.get(id);
      expect(clip, `the reel lists ${id}, which is not in the manifest`).toBeDefined();
      expect(
        clip!.srcFull ?? clip!.src,
        `the reel lists ${id}, which has no file at all`,
      ).toBeDefined();
    }
  });
});
