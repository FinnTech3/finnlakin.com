/* Read on the server (metadata, sitemap, JSON-LD, share cards). Only
   NEXT_PUBLIC_SITE_URL survives into client bundles, so anything rendering an
   absolute URL in the browser must be passed one rather than calling this. */
function resolveSiteUrl(): string {
  const explicit = process.env.NEXT_PUBLIC_SITE_URL;
  if (explicit) return explicit.replace(/\/$/, "");

  const vercel = process.env.VERCEL_PROJECT_PRODUCTION_URL;
  if (vercel) return `https://${vercel}`;

  return "http://localhost:3000";
}

export const siteUrl = resolveSiteUrl();

export const person = {
  name: "Finn Lakin",
  course: "Economics, Finance & International Business",
  university: "Oxford Brookes University",
  exchange: "Université Paris Dauphine",
  graduation: 2027,
  location: "Oxford, United Kingdom",
  seeking:
    "Summer 2026 internships in equity research, quantitative methods and financial technology",
} as const;

/* Phone number is deliberately absent. Finn asked for it off the site: once a
   number is indexed and archived it cannot be taken back. */
export const contact = {
  email: "lakin.finn@gmail.com",
  linkedin: "https://www.linkedin.com/in/finnlakin/",
  github: "https://github.com/FinnTech3",
} as const;

export const nav = [
  { href: "/", label: "Work" },
  { href: "/path", label: "Path" },
  { href: "/writing", label: "Writing" },
  { href: "/cv", label: "CV" },
] as const;

export const siteTitle = `${person.name}`;

export const siteDescription =
  "I rebuild published numbers from primitives and report the gap. Economics, finance and international business at Oxford Brookes, with the working code behind every figure.";
