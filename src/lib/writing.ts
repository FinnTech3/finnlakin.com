export type WritingPiece = {
  slug: string;
  title: string;
  dek: string;
  kicker: string;
  /* ISO date. Used for the article metadata and the sitemap. */
  published: string;
  projectSlug: string;
};

/* Only pieces that exist are listed. There is no "coming soon" section:
   a roadmap of unwritten essays is a claim about the future, and this site
   does not make those. */
export const writing: WritingPiece[] = [
  {
    slug: "marked-to-model",
    title: "Eleven thousand violations, one wrong input",
    dek: "Deribit's mark surface breaks static arbitrage 11,593 times across 88 snapshots. Its own quotes, scanned the same way, break it never. Most of the gap turns out to be a single stale number.",
    kicker: "Write-up",
    published: "2026-09-11",
    projectSlug: "marked-to-model",
  },
];

export const writingBySlug = new Map(writing.map((piece) => [piece.slug, piece]));
