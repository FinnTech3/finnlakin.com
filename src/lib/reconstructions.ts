import { numberWord } from "./numbers";

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

/* The two numbers every heading about this table quotes, counted from the table
   so that nobody can edit a row and leave a heading claiming something else. A
   heading that says three held beside a table that shows two is the exact
   failure this site exists to argue against. */
export const held = reconstructions.filter((row) => row.tone === "pass").length;

/* How many rows there are, as a word at the head of a sentence. */
export const rebuiltWord = numberWord(reconstructions.length, { capital: true });
