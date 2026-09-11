/* The hero table. Four published quantities, rebuilt independently, with the
   deviation reported. The fourth row is the point of the table: the same model
   that nails the yield curve cannot pin down the premium it draws from it. */
export type Reconstruction = {
  quantity: string;
  detail: string;
  reference: string;
  deviation: string;
  verdict: string;
  tone: "pass" | "flag";
  projectSlug: string;
};

export const reconstructions: Reconstruction[] = [
  {
    quantity: "Order book state",
    detail: "736,997 events replayed",
    reference: "Coinbase",
    deviation: "byte-identical",
    verdict: "holds",
    tone: "pass",
    projectSlug: "nanobook",
  },
  {
    quantity: "US CPI, headline rate",
    detail: "rebuilt from eight expenditure groups, 101 months",
    reference: "BLS",
    deviation: "0.083 pp",
    verdict: "holds",
    tone: "pass",
    projectSlug: "whose-inflation",
  },
  {
    quantity: "Fitted yield curve",
    detail: "affine term structure, re-estimated",
    reference: "NY Fed ACM",
    deviation: "0.45 bp",
    verdict: "holds",
    tone: "pass",
    projectSlug: "term-premium",
  },
  {
    quantity: "Term premium",
    detail: "same model, same data, same estimation",
    reference: "NY Fed ACM",
    deviation: "14 bp",
    verdict: "31× the fitted error",
    tone: "flag",
    projectSlug: "term-premium",
  },
];
