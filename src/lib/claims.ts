/* Every figure printed on this site declares where it came from. The four
   kinds are ordered by how much a reader should trust them, and the site
   labels each one rather than letting a backtest sit next to a measurement
   as though they were the same sort of claim. */
export type Provenance =
  | "reproducible"
  | "measured"
  | "simulated"
  | "illustrative";

export const provenanceLabel: Record<Provenance, string> = {
  reproducible: "Reproduces offline from a committed capture",
  measured: "Measured against real data",
  simulated: "Simulated over real historical prices",
  illustrative: "Model output from assumptions you set",
};

export const provenanceShort: Record<Provenance, string> = {
  reproducible: "Reproducible",
  measured: "Measured",
  simulated: "Simulated",
  illustrative: "Illustrative",
};

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
