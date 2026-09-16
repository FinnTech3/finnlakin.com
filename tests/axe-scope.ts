import type { Result } from "axe-core";
import type { Page } from "@playwright/test";

/* @axe-core/playwright walks page.frames() itself and injects axe into every
   one, so a cross-origin frame's markup is scanned as if this site served it.
   The one frame on this site is the my-inflation tool, deployed from a
   different repository to GitHub Pages, and its stylesheet is not something a
   commit here can change. Letting it into the gate means somebody else's
   deploy turns this repository red with no commit against it, and a fix that
   is impossible from this codebase.

   So violations INSIDE a cross-origin frame are dropped and violations on the
   frame element itself are kept. axe reports the second kind with a single
   selector (["iframe"], which is how frame-title arrives) and the first kind
   with one selector per document crossed (["iframe", ".mi-total-note"]), so
   the two are distinguishable. Excluding the element instead would silence
   frame-title as well, which is this site's responsibility rather than the
   tool's. tests/platform.spec.ts asserts the embed carries one. */
export async function dropCrossOriginFrames(page: Page, violations: Result[]) {
  const pageOrigin = new URL(page.url()).origin;
  const sameOrigin = new Map<string, boolean>();

  async function frameIsSameOrigin(selector: string) {
    const cached = sameOrigin.get(selector);
    if (cached !== undefined) return cached;

    /* Bounded, because a selector that resolves to nothing would otherwise
       wait out the default timeout before the catch below sees it. axe has
       just matched these elements, so anything slow here is a bug rather
       than a slow page. */
    const src = await page
      .locator(selector)
      .first()
      .getAttribute("src", { timeout: 2_000 })
      .catch(() => null);

    /* A frame with no src cannot be cross-origin, and an unresolvable
       selector is kept rather than dropped: silence is the failure mode
       worth avoiding here. */
    let verdict = true;
    if (src) {
      try {
        verdict = new URL(src, page.url()).origin === pageOrigin;
      } catch {
        verdict = true;
      }
    }
    sameOrigin.set(selector, verdict);
    return verdict;
  }

  /* Some rules flag an element in THIS document because of something in the
     frame. landmark-unique is the one that bites: the page has one <main>, the
     framed tool has its own, axe merges the two documents and reports our
     #main as a duplicate. A frame is a separate document and a screen reader
     nests it rather than merging it, so that is an artefact of the merge, not
     a defect here, and nothing a commit in this repository could fix.

     Detected through relatedNodes rather than by naming the rule: axe records
     why a node was flagged, and here the only reason given is ["iframe",
     "main"]. If any reason is in this document, the violation stays. */
  async function blamedOnlyOnCrossOriginFrame(node: Result["nodes"][number]) {
    const related = [...(node.any ?? []), ...(node.all ?? []), ...(node.none ?? [])]
      .flatMap((check) => check.relatedNodes ?? [])
      .map((entry) => entry.target as unknown as string[]);

    if (related.length === 0) return false;
    for (const target of related) {
      /* A reason in this document, or in a frame this site serves, is a real
         one. Only another origin's document gets excused. */
      if (target.length === 1) return false;
      if (await frameIsSameOrigin(target[0])) return false;
    }
    return true;
  }

  const kept: Result[] = [];
  for (const violation of violations) {
    const nodes = [];
    for (const node of violation.nodes) {
      const target = node.target as unknown as string[];
      if (target.length > 1 && !(await frameIsSameOrigin(target[0]))) continue;
      if (target.length === 1 && (await blamedOnlyOnCrossOriginFrame(node))) continue;
      nodes.push(node);
    }
    if (nodes.length > 0) kept.push({ ...violation, nodes });
  }
  return kept;
}
