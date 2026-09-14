import type { ExternalLink, Provenance, Stat } from "./claims";

export type Project = {
  slug: string;
  name: string;
  repos: string[];
  stack: string;
  /* The finding, in larger type. One sentence, no hedging, no adjectives. */
  headline: string;
  /* What the thing is, lifted from the repo's own README. */
  body: string;
  stats: Stat[];
  provenance: Provenance;
  /* Never optional. Every project states what it does not show. */
  limits: string;
  links: ExternalLink[];
  /* Slug of the long-form write-up, where one exists. */
  writing?: string;
  /* Only where the finding itself is a range. Most projects have none, and a
     card without one is not missing anything. */
  band?: {
    caption: string;
    widthLabel: string;
    low: { value: string; note: string };
    high: { value: string; note: string };
    reading?: string;
  };
};

const gh = (repo: string) => `https://github.com/FinnTech3/${repo}`;

/* Order is deliberate and reverses the old site: the verifiable work leads,
   and nothing whose numbers cannot be sourced appears at all. */
export const projects: Project[] = [
  {
    slug: "marked-to-model",
    name: "marked-to-model",
    repos: ["marked-to-model"],
    stack: "Rust · Python · differential",
    headline:
      "The venue's own quotes were clean. Its mark surface, the one that decides liquidations, broke static arbitrage 11,593 times.",
    body: "Deribit publishes a mark price and a mark implied volatility for every listed option. Those numbers are not decoration: they set margin requirements and they decide liquidations. I checked whether they are consistent with themselves.",
    stats: [
      { value: "11,593", label: "static arbitrage violations in the mark surface", tone: "flag" },
      { value: "88", label: "snapshots, BTC and ETH chains" },
      { value: "235", label: "at or above one full tick, 2.0% of the total", tone: "flag" },
      { value: "0", label: "in the venue's own bid and ask, scanned the same way", tone: "pass" },
    ],
    provenance: "reproducible",
    limits:
      "Marks are not tradeable prices and the top of book is clean, so this is a statement about the margin surface rather than about arbitrage available to anyone. One venue. The lifetimes are censored, so the persistence figures are a lower bound.",
    links: [{ label: "Repository", href: gh("marked-to-model") }],
    writing: "marked-to-model",
  },
  {
    slug: "nanobook",
    name: "nanobook",
    repos: ["nanobook"],
    stack: "Rust",
    headline:
      "An update costs about 5 nanoseconds, roughly 9 times faster than the BTreeMap most people reach for first.",
    body: "A limit order book built for update latency, and checked hard enough that the latency number means something. Twenty minutes of live Coinbase data replayed against an independent Python implementation, to establish that the fast thing is also the correct thing.",
    stats: [
      { value: "~5 ns", label: "per update, 9.2× faster than BTreeMap" },
      { value: "736,997", label: "events replayed, byte-for-byte identical", tone: "pass" },
      { value: "99.4%", label: "agreement with the exchange's own snapshots" },
      { value: "1.6× slower", label: "reading the top ten levels, the cost of the design", tone: "flag" },
    ],
    provenance: "measured",
    limits:
      "This is an aggregated price-level book, not order-by-order. There is no matching engine and no order entry, and it is single-threaded. The latency figure is a benchmark on a committed sample session, not a claim about a production venue.",
    links: [{ label: "Repository", href: gh("nanobook") }],
    writing: "nanobook",
  },
  {
    slug: "term-premium",
    name: "term-premium",
    repos: ["term-premium"],
    stack: "Python · no dependencies",
    headline:
      "The fitted yield reproduces to 0.45 bp. The premium drawn out of that same curve reproduces to 14, and the start date alone moves it 81.",
    body: "Rebuilds the New York Fed's ACM term premium decomposition from the yield curve up, and then asks how much of the split the model can actually pin down. The answer is that the fit is pinned down and the decomposition is not.",
    stats: [
      { value: "0.45 bp", label: "median error on the Fed's fitted yields", tone: "pass" },
      { value: "14 bp", label: "error on the term premium from the same model", tone: "flag" },
      { value: "81 bp", label: "specification band, from the start date alone", tone: "flag" },
      { value: "0.9997", label: "correlation with the Fed's published ten-year premium" },
    ],
    provenance: "measured",
    limits:
      "This is not a claim to reproduce the Fed's published term premium level to the basis point, and it is not a trading signal. Starting the estimation in 1961 puts the recent ten-year premium near zero; starting in 2000 puts it near 0.82%. Both are the same model.",
    links: [{ label: "Repository", href: gh("term-premium") }],
    writing: "term-premium",
    band: {
      caption: "Ten-year term premium, rebuilt",
      widthLabel: "81 bp wide",
      low: { value: "0.00%", note: "estimating from 1961" },
      high: { value: "0.82%", note: "estimating from 2000" },
      reading:
        "The same model, the same data and the same estimation. Only the start date changes, and the answer moves across the whole band.",
    },
  },
  {
    slug: "deflated-sharpe",
    name: "deflated-sharpe",
    repos: ["deflated-sharpe"],
    stack: "Python · no dependencies",
    headline:
      "The winning rule's Sharpe is 0.75. The best of 796 rules with no skill at all would be expected to score 0.80.",
    body: "This charges a backtest for the search that produced it, with the two tools built for the job: the deflated Sharpe ratio and the probability of backtest overfitting. I searched 796 ordinary trading rules across four stocks over ten years and kept the best one, which is exactly how a strategy usually gets found.",
    stats: [
      { value: "796", label: "rules searched, best one kept" },
      { value: "0.75", label: "annualised Sharpe of the winner" },
      { value: "0.80", label: "expected Sharpe from luck alone at that search size", tone: "flag" },
      { value: "0.43", label: "deflated Sharpe once the search is charged for", tone: "flag" },
    ],
    provenance: "simulated",
    limits:
      "This is not a claim that these four stocks contain no signal, and it is not a trading system. It is a demonstration that a Sharpe quoted without the size of the search behind it carries almost no information. On 75% of the ways of splitting the history, the in-sample best ranks below the out-of-sample median.",
    links: [{ label: "Repository", href: gh("deflated-sharpe") }],
  },
  {
    slug: "honest-backtest",
    name: "honest-backtest",
    repos: ["honest-backtest"],
    stack: "Python · CLI",
    headline:
      "AAPL mean reversion earns 8.4% a year before costs and loses 2.0% after them.",
    body: "Tests a trading strategy against ten years of real prices, then charges it for everything a real trade would actually have cost, and watches most of the profit disappear. Commission, spread, slippage and borrow, applied per fill rather than as an annual haircut.",
    stats: [
      { value: "+8.4%", label: "a year before costs" },
      { value: "−2.0%", label: "a year after them", tone: "flag" },
      { value: "114%", label: "of starting capital paid away in charges", tone: "flag" },
      { value: "3 of 4", label: "symbols lose money once costs are applied", tone: "flag" },
    ],
    provenance: "simulated",
    limits:
      "No shorting constraints and no borrow cost. The risk-free rate is set to zero. Daily bars only, so intraday fills are assumed away. Four symbols, all of which still exist: that is survivorship bias and I have not fixed it, only labelled it.",
    links: [{ label: "Repository", href: gh("honest-backtest") }],
  },
  {
    slug: "orderbook",
    name: "orderbook-sim · orderbook-live",
    repos: ["orderbook-sim", "orderbook-live"],
    stack: "Python · TypeScript",
    headline:
      "Queue position is unknowable, so it ships as three named models rather than one number. The fill rate lands between 23.1% and 25.0%.",
    body: "Rebuilds what an exchange's order book looked like at any moment in the past, then lets you test whether an order you would have placed would actually have been filled. Where the honest answer depends on an assumption nobody can verify, the assumption is named and the spread between them is reported.",
    stats: [
      { value: "23.1–25.0%", label: "fill rate, across the three queue models" },
      { value: "200,000", label: "events replayed in about half a second" },
      { value: "115", label: "tests, including a 20,000-operation differential" },
    ],
    provenance: "simulated",
    limits:
      "No market impact: the simulated order does not move the book it is placed into. A synthetic venue, a single instrument and constant latency. The live viewer's fill estimates run from 31% to 85% depending on the model, and the honest answer there is the range rather than any single number.",
    links: [
      { label: "orderbook-sim", href: gh("orderbook-sim") },
      { label: "orderbook-live", href: gh("orderbook-live") },
      { label: "Live viewer", href: "https://finntech3.github.io/orderbook-live/" },
    ],
  },
  {
    slug: "whose-inflation",
    name: "whose-inflation · my-inflation",
    repos: ["whose-inflation", "my-inflation"],
    stack: "Python · TypeScript",
    headline:
      "The headline rate rebuilds to 0.083 pp. Inside March 2022's 8.7%, the car-dependent commuter was living 11.0% and the student 7.5%.",
    body: "Rebuilds US CPI from its eight expenditure groups, checks the reconstruction against the published series, and then reweights it for households that spend differently. One published number turns out to contain a wide spread of lived experiences, and the spread widens in a shock.",
    stats: [
      { value: "0.083 pp", label: "mean absolute error against the published headline", tone: "pass" },
      { value: "101", label: "months reconstructed" },
      { value: "11.0%", label: "the car-dependent commuter, March 2022" },
      { value: "7.5%", label: "the student, same month, same country" },
    ],
    provenance: "measured",
    limits:
      "United States only, and eight expenditure groups rather than the full basket. The calculator does not measure your spending, it lets you assert it: the output is only as good as the shares you set, and the presets are informed guesses rather than anybody's receipts.",
    links: [
      { label: "whose-inflation", href: gh("whose-inflation") },
      { label: "my-inflation", href: gh("my-inflation") },
      { label: "Calculator", href: "https://finntech3.github.io/my-inflation/" },
    ],
  },
  {
    slug: "trade-mirror",
    name: "trade-mirror",
    repos: ["trade-mirror"],
    stack: "Python · CLI",
    headline:
      "Across 39 country pairs the numbers came out arithmetically impossible. Drop the Netherlands and the implied freight wedge is 1.062, right where theory says it should sit.",
    body: "Every international trade gets counted twice, once by the exporter and once by the importer, and the two numbers never match. This compares them and asks why they disagree. The Rotterdam effect falls out of the discrepancies on its own, without being looked for.",
    stats: [
      { value: "39", label: "country pairs, 2022" },
      { value: "1.062", label: "implied freight wedge, excluding the Netherlands" },
      { value: "38", label: "tests, all offline against cached responses" },
    ],
    provenance: "reproducible",
    limits:
      "The freight adjustment is a single global constant of 1.08 applied to every route regardless of distance or cargo. That is the weakest thing in the project and it is the reason the wedge is quoted with the Netherlands excluded rather than as a headline.",
    links: [{ label: "Repository", href: gh("trade-mirror") }],
  },
  {
    slug: "rent-or-buy",
    name: "rent-or-buy",
    repos: ["rent-or-buy"],
    stack: "TypeScript · zero runtime dependencies",
    headline:
      "Break-even at 8.3 years, and buying wins in 52% of the swept scenarios. That is another way of saying it is close to a coin toss.",
    body: "A rent-versus-buy calculator that answers the question people actually have, which is not 'which is cheaper this month' but 'which choice leaves me wealthier by the time I would sell, and how much does that answer depend on things nobody can know'. UK mode carries stamp duty; the tornado chart ranks the assumptions by how much they move the result.",
    stats: [
      { value: "8.3 yr", label: "break-even, month 99, on the default assumptions" },
      { value: "52%", label: "of swept scenarios where buying wins" },
      { value: "$180,827", label: "swing from appreciation alone, 1.5% to 5.5%", tone: "flag" },
      { value: "98", label: "tests" },
    ],
    provenance: "illustrative",
    limits:
      "A fixed mortgage rate with no refinancing, and a property-tax growth assumption that does most of the work in the long run. Every figure above is the output of assumptions a user sets, so the range matters and the point estimate does not.",
    links: [
      { label: "Repository", href: gh("rent-or-buy") },
      { label: "Calculator", href: "https://finntech3.github.io/rent-or-buy/" },
    ],
  },
  {
    slug: "finance-analysis",
    name: "finance-analysis",
    repos: ["finance-analysis"],
    stack: "Python · FastAPI · DuckDB",
    headline:
      "Bank statement in, plain English out. DuckDB does the analytics and the model writes the SQL.",
    body: "Import a CSV export from any bank, Monzo, Starling, Revolut or a standard statement, into a local database, then interrogate it in plain English. Built because spreadsheets are slow to ask new questions of and dashboards only answer the questions they were built for.",
    stats: [],
    provenance: "tool",
    limits:
      "This is the one project here with no measured result to report, because there is nothing in it to measure: it is a tool rather than a finding. Your CSV is loaded into a temporary in-memory database for the session and is not persisted, but the question and the schema go to a model API, so it is a local tool with one network dependency. The hosted demo runs on a free tier that sleeps when idle, so a cold first load takes about forty-five seconds and shows a blank tab while it wakes. It is quick once awake.",
    links: [
      { label: "Repository", href: gh("finance-analysis") },
      { label: "Hosted demo", href: "https://finance-analysis-opml.onrender.com" },
    ],
  },
];

export const projectBySlug = new Map(projects.map((p) => [p.slug, p]));
