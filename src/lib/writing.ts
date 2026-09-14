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
  {
    slug: "whose-inflation",
    title: "Households diverge in a shock, not in general",
    dek: "Rebuilding US CPI from its eight components recovers the published headline to 0.083 percentage points. Reweighting it for different households shows they live at much the same rate for years, then come apart exactly when the number is quoted hardest.",
    kicker: "Write-up",
    published: "2026-09-14",
    projectSlug: "whose-inflation",
  },
];

export const writingBySlug = new Map(writing.map((piece) => [piece.slug, piece]));
