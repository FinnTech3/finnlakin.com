/* Every figure printed on this site declares where it came from. The four
   kinds are ordered by how much a reader should trust them, and the site
   labels each one rather than letting a backtest sit next to a measurement
   as though they were the same sort of claim. */
export type Provenance =
  | "reproducible"
  | "measured"
  | "simulated"
  | "illustrative"
  | "tool";

export const provenanceLabel: Record<Provenance, string> = {
  reproducible:
    "A fresh clone reproduces every figure offline, from a capture committed to the repo.",
  measured:
    "Measured or benchmarked against real data, which the repo fetches rather than ships.",
  simulated:
    "A simulation over real historical prices. Not a record of trading, and no money was at risk.",
  illustrative:
    "Model output from assumptions the reader sets. The range is the result; the point estimate is not.",
  tool: "A tool rather than a finding, so there is no result here to reproduce.",
};

export const provenanceShort: Record<Provenance, string> = {
  reproducible: "Reproducible",
  measured: "Measured",
  simulated: "Simulated",
  illustrative: "Illustrative",
  tool: "Tool",
};

export const provenanceOrder: Provenance[] = [
  "reproducible",
  "measured",
  "simulated",
  "illustrative",
  "tool",
];

export type Stat = {
  value: string;
  label: string;
  /* Set where a figure is a cost or a failure rather than a win. The design
     uses it to stop every number reading as a boast. */
  tone?: "pass" | "flag";
};

export type ExternalLink = {
  label: string;
  href: string;
};
