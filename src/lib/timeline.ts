export type TimelineEntry = {
  id: string;
  kind: "education" | "work";
  title: string;
  org: string;
  location: string;
  start: string;
  end: string;
  points: string[];
  /* A fact about the setting rather than about Finn. Rendered separately from
     the points and never joined to one of them, so a fact about how large a
     competition was can never be read as a claim about how he placed in it. */
  aside?: string;
};

export const timeline: TimelineEntry[] = [
  {
    id: "jura",
    kind: "work",
    title: "Junior Analyst",
    org: "Jura Consulting",
    location: "Winchester, United Kingdom",
    start: "Sep 2021",
    end: "Present",
    points: [
      "Compile intraday market-data summaries and short research notes on global energy supply, demand and price action for the senior trading desk.",
      "Maintain equity and commodity sector watchlists, and flag catalysts ahead of earnings and macro events.",
      "Digitalised the company's records into a tagged document-management workflow, increasing operational efficiency by around 15%.",
    ],
  },
  {
    id: "dauphine",
    kind: "education",
    title: "Exchange year, International Business and Data Analysis in R",
    org: "Université Paris Dauphine",
    location: "Paris, France",
    start: "Sep 2025",
    end: "May 2026",
    points: [
      "Selected for academic exchange at one of continental Europe's most rigorous economics faculties.",
      "Taught entirely in French: Business Data Analysis in R, Statistical Inference, and International Macroeconomics.",
      "A year of sitting coursework in a second language, which did more for the French than any certificate.",
    ],
  },
  {
    id: "bloomberg",
    kind: "work",
    title: "Team Leader",
    org: "Bloomberg Global Trading Challenge",
    location: "Oxford Brookes Investment Society",
    start: "Oct 2024",
    end: "Nov 2024",
    points: [
      "Led a five-person team through Bloomberg's global trading competition, trading a simulated book on the Terminal.",
      "Set the investment thesis, sized the positions, and presented weekly research and trade-attribution reviews to the wider society.",
    ],
    aside:
      "The competition ran across 396 universities in 46 countries. That is a fact about its size, not about how the team placed.",
  },
  {
    id: "avington",
    kind: "work",
    title: "Guest Manager",
    org: "Avington Park",
    location: "Hampshire, United Kingdom",
    start: "Jun 2024",
    end: "Sep 2024",
    points: [
      "Ran event operations across a large private venue: logistics, client check-in and guest support.",
      "Redesigned the guest check-in workflow and cut average wait time by around 10%.",
      "Coordinated multi-stakeholder planning against fixed, unmovable dates.",
    ],
  },
  {
    id: "brookes",
    kind: "education",
    title: "BSc Economics, Finance & International Business",
    org: "Oxford Brookes University",
    location: "Oxford, United Kingdom",
    start: "Sep 2023",
    end: "Jun 2027",
    points: [
      "On track for First-Class Honours.",
      "Econometrics, Financial Modelling, Investment Analysis, Corporate Finance, Macroeconomic Theory, and Statistical Methods in R.",
      "Member of the Oxford Brookes Investment Society, and led its Bloomberg Trading Challenge team.",
    ],
  },
  {
    id: "nicolas-james",
    kind: "work",
    title: "Summer Intern, Business Operations",
    org: "Nicolas James Group",
    location: "Southampton, United Kingdom",
    start: "Jun 2023",
    end: "Aug 2023",
    points: [
      "Embedded across a UK property and business-services group: project planning, internal reporting and client communications.",
      "Built the weekly KPI consolidation used in senior management review.",
      "Assisted with audit-readiness documentation and compliance standardisation.",
    ],
  },
  {
    id: "charterhouse",
    kind: "education",
    title: "A-levels in Mathematics, Economics and French",
    org: "Charterhouse",
    location: "Surrey, United Kingdom",
    start: "Sep 2017",
    end: "Jul 2023",
    points: [
      "Ten IGCSEs: Mathematics, Physics, Chemistry, Biology, English Literature and Language, French, Spanish, History, Art and Geography.",
      "Gold in the BPhO Intermediate Physics Challenge, Silver in the UKMT Senior Maths Challenge, and the Edexcel Algebra Level 3 Award.",
      "DELF B2 in French.",
    ],
  },
];
