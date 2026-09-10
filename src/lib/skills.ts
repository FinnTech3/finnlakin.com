export type SkillGroup = {
  id: string;
  label: string;
  items: string[];
};

export type Language = {
  name: string;
  level: string;
  note?: string;
};

/* Languages and tooling are listed because a repo in the list uses them.
   Nothing here is aspirational. */
export const skillGroups: SkillGroup[] = [
  {
    id: "languages",
    label: "Programming",
    items: ["Python", "R", "Rust", "TypeScript", "SQL and DuckDB"],
  },
  {
    id: "methods",
    label: "Methods",
    items: [
      "Econometrics",
      "Affine term structure models",
      "Backtest overfitting and deflated Sharpe",
      "Market microstructure",
      "Index reconstruction",
      "Monte Carlo and scenario sweeps",
    ],
  },
  {
    id: "finance",
    label: "Finance",
    items: [
      "Equity research",
      "Options and derivatives",
      "Energy markets",
      "Portfolio construction",
      "Financial modelling",
      "Bloomberg Terminal",
    ],
  },
  {
    id: "other",
    label: "Elsewhere",
    items: [
      "Athletics, UK top 100 in hurdles, 2022",
      "Competitive slalom and giant slalom skiing",
      "Team leadership",
    ],
  },
];

export const languages: Language[] = [
  { name: "English", level: "Native" },
  { name: "French", level: "Bilingual", note: "DELF B2, plus an exchange year taught in French" },
  { name: "Spanish", level: "Professional" },
];
