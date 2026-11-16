import type { Clip } from "./media";

/* The software, as data. The page, the home page's teaser, the search and the
   tests all read this one list, so a product is added by adding an entry here and
   nothing else.

   Same rule as every other claim on this site: a number is here because it was
   checked. The test counts are from running each repository's suite, the other
   figures are from the repository's own README and demo, and every limit is the
   one the repository states about itself. Nothing here is a price. Prices belong
   to the marketplace listing and a figure copied from a draft would go stale the
   day somebody changed it.

   `agensi` is the address of the live listing, and it is null for every product
   until there is one. A link that has not been checked is not written down: where
   it is null the card says the listing is coming and links to the source. */
export type Product = {
  slug: string;
  name: string;
  /* A skill is sold on Agensi. An app is a download. */
  kind: "skill" | "app";
  /* One sentence, what it does. */
  promise: string;
  /* The one number the card stands on, and what it is a number of. */
  proof: { value: string; label: string };
  /* What it needs on the machine, in a line. */
  needs: string;
  /* What it will not do, in plain words. Never optional. */
  limit: string;
  /* Said beside the download, where the reader is about to act on it. */
  note?: string;
  agensi: string | null;
  github: string;
  /* Where an app is downloaded from. Releases page, not a file: a link to a file
     that is renamed is a dead link, and the page always exists. */
  download?: string;
  /* Offline tests, from running the suite. Null where the count is not one this
     site has run. */
  tests: number | null;
  media: Media;
};

type Media =
  | { kind: "clip"; clip: Clip; width: number; height: number }
  | { kind: "still"; src: string; width: number; height: number; alt: string; caption: string };

const gh = (repo: string) => `https://github.com/FinnTech3/${repo}`;

/* A clip copied out of the repository's own docs folder, with its poster a real
   frame from it. Nothing is a mock-up: each is a terminal session recorded by the
   repository's own tooling, and the caption says what was and was not edited. */
function clip(
  slug: string,
  repo: string,
  size: { width: number; height: number },
  description: string,
  caption: string,
): Media {
  return {
    kind: "clip",
    width: size.width,
    height: size.height,
    clip: {
      id: slug,
      src: `/software/${slug}.mp4`,
      poster: `/software/${slug}.webp`,
      description,
      caption,
      credit: "FinnTech3",
      href: gh(repo),
      origin: "own",
    },
  };
}

/* In the order I would most want somebody to buy them: the finance tool first,
   because it is what the rest of this site is about, then the ones that do the
   most for an agent, and the desktop app last because it is not a skill. */
export const products: Product[] = [
  {
    slug: "daily-us-stock-analysis",
    name: "Daily US Stock Analysis",
    kind: "skill",
    promise:
      "Scores any US stock or ETF from -100 to +100 on daily prices, shows the factor behind every point, and sizes a position for the bullish ones.",
    proof: {
      value: "216",
      label: "offline tests, for one 20 KB script that uses the standard library and nothing else",
    },
    needs: "Python 3.10 or newer, and a connection to Nasdaq's public quote endpoint. No key, no account.",
    limit:
      "Daily bars of US stocks and ETFs only: no news, earnings, fundamentals, options or short side. Prices come from Nasdaq's public endpoint, which is not a documented API and can change or rate-limit. It does not predict anything and it is not financial advice.",
    agensi: null,
    github: gh("Daily_StocK_Analysis"),
    tests: 216,
    media: clip(
      "daily-us-stock-analysis",
      "Daily_StocK_Analysis",
      { width: 940, height: 624 },
      "A terminal. One command ranks AAPL, MSFT, NVDA and TSLA, then shows why AAPL scores +80, factor by factor, with a reference plan sized for a $25,000 account.",
      "A real run on 15 November 2026, on the closes of 13 November. The clip cuts the long tail of each output and says so on screen.",
    ),
  },
  {
    slug: "repo-audit-planner",
    name: "Repo Audit Planner",
    kind: "skill",
    promise:
      "Makes your agent audit a codebase and write one fix plan per problem. A checker rejects any plan whose quoted evidence is not on the line it cites.",
    proof: {
      value: "127",
      label: "offline tests. The demo shows the checker rejecting an invented SQL-injection plan",
    },
    needs: "Python 3.10 or newer. Three single-file scripts, standard library only, no network.",
    limit:
      "It does not change your code: it writes plans under one folder and nothing else. It can tell you a plan is complete and its evidence is real, not that the fix is the right one.",
    agensi: null,
    github: gh("repo-audit-planner"),
    tests: 127,
    media: clip(
      "repo-audit-planner",
      "repo-audit-planner",
      { width: 1000, height: 724 },
      "A terminal. The checker passes one plan, then fails a second that cites a line the file does not have, with four errors and two warnings, then ranks the plan that survived.",
      "Real output. The repo facts are trimmed and say so. The rejected plan is a bad draft I wrote for the demo.",
    ),
  },
  {
    slug: "browser-agent-cli",
    name: "Browser Agent CLI",
    kind: "skill",
    promise:
      "A real browser your agent drives one shell command at a time. Every element gets a ref, page text is fenced as untrusted, and unsafe addresses are refused.",
    proof: {
      value: "219",
      label: "tests. The demo shows a stale ref refused instead of clicking the wrong thing",
    },
    needs: "Node.js 20 or newer and Chromium through Playwright, which the skill asks before installing.",
    limit:
      "Only tested on Linux. It does not upload or download files, drag, hover or read iframes. It labels page text as untrusted, but it cannot make a model immune to a hostile page: the agent still has to behave.",
    agensi: null,
    github: gh("browser-agent-cli"),
    tests: 219,
    media: clip(
      "browser-agent-cli",
      "browser-agent-cli",
      { width: 1052, height: 654 },
      "A terminal beside a screenshot. The tool reads a made-up sign-up page as a tree of refs, fences a planted instruction from the footer as data, fills the form, and refuses a stale ref after the page changes.",
      "A real session against a made-up page on localhost. The planted instruction in the footer is mine.",
    ),
  },
  {
    slug: "growth-stack",
    name: "Growth Stack",
    kind: "skill",
    promise:
      "Audit a web page, fix the three biggest gaps, measure, audit again. Fifteen skills and three scripts, and every point of the score has a name.",
    proof: {
      value: "23 to 72",
      label: "out of 100, the demo page's score after two rounds of audit, fix and measure",
    },
    needs: "Python 3.10 or newer, and network access to the pages you ask it to audit. Nothing to install.",
    limit:
      "The score is a diagnostic, not a promise of rankings, traffic or revenue, and it is a score for one page and not a whole site. It will not invent a testimonial, a statistic or a price: missing proof is a marked gap.",
    agensi: null,
    github: gh("growth-stack"),
    tests: 269,
    media: clip(
      "growth-stack",
      "growth-stack",
      { width: 940, height: 724 },
      "A terminal. A made-up bike shop page scores 23 out of 100, then 56 after one round of fixes, then 72 after a second, with the five categories listed each time.",
      "Real output, 18 seconds, on the fixture page in the repository. The page is made up.",
    ),
  },
  {
    slug: "sound-check",
    name: "Sound Check",
    kind: "skill",
    promise:
      "Measures WAV files, so your agent can tell how many milliseconds late a hit lands, and writes simple sound effects to measure against.",
    proof: {
      value: "80.2 ms",
      label: "late, as the sync check measured a hit started 80 ms after the cut. The tolerance was 40",
    },
    needs: "Python 3.10 or newer. Two files, standard library only. No network, no ffmpeg.",
    limit:
      "WAV files only. It measures and does not hear: no taste, quality or genre. Where a number is an estimate it says so, and where there is nothing to say it says there is not enough rhythm.",
    agensi: null,
    github: gh("sound-check"),
    tests: 170,
    media: clip(
      "sound-check",
      "sound-check",
      { width: 990, height: 504 },
      "A terminal. A sound effect made 80 milliseconds late is probed against a cut at 1.20 seconds and its onset offset is reported, alongside peak, loudness, tempo and spectrum.",
      "A real run on 15 November 2026. The sounds are synthetic, made in the same run.",
    ),
  },
  {
    slug: "desk-mesh-doctor",
    name: "Desk Mesh Doctor",
    kind: "skill",
    promise:
      "Finds out why two devices will not work as one desk. It names the broken layer, gives one fix, and tests again.",
    proof: {
      value: "373",
      label: "offline tests, plus a lab of two Linux network namespaces that reproduces a real silent firewall drop",
    },
    needs: "Python 3.10 or newer on each computer you test from. No packages, no account.",
    limit:
      "The lab proves the diagnosis on one real silent drop. It says nothing about Wi-Fi, Windows, macOS, phones or UDP. It cannot see inside your sharing tool or read your router's admin page.",
    agensi: null,
    github: gh("desk-mesh-doctor"),
    tests: 373,
    media: clip(
      "desk-mesh-doctor",
      "desk-mesh-doctor",
      { width: 900, height: 748 },
      "A terminal. The laptop's test of the desk times out, the desk's test of the laptop works, the report names the desk's firewall, one rule fixes it and the same test then passes.",
      "Real output from a lab of two Linux network namespaces joined by a virtual cable, standing in for a laptop and a desk PC.",
    ),
  },
  {
    slug: "quiet-snow",
    name: "Quiet Snow",
    kind: "app",
    promise:
      "Snow for your Mac or Windows desktop. It lands on the tops of your windows, slides off when you drag one, and stays out of your way.",
    proof: {
      value: "44 MB",
      label: "of memory on a Mac, measured on a CI virtual machine. 28 MB on Windows",
    },
    needs: "macOS 13 or later, or Windows 10 version 2004 or later. No account, and it makes no network connections.",
    limit:
      "CI builds it, runs it and renders its frames, but I have not yet watched it on a real desktop. It does not put snow on desktop icons or widgets, and it does not update itself.",
    note: "The Windows build is not code-signed, so Windows may warn on download. The repository carries the checksum and the build attestation to check it against.",
    agensi: null,
    github: gh("quiet-snow"),
    download: `${gh("quiet-snow")}/releases`,
    tests: null,
    media: {
      kind: "still",
      src: "/software/quiet-snow.webp",
      width: 960,
      height: 600,
      alt: "Two drawn windows on a dark blue desktop, a pale one behind a dark one, each with a soft pile of snow along its top edge, snow lying along the taskbar and flakes falling.",
      caption:
        "A frame from the Windows renderer, drawn over a mock desktop by CI. It is not a recording of a real desktop.",
    },
  },
];

export const productBySlug = new Map(products.map((product) => [product.slug, product]));
