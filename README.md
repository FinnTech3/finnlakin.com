# finnlakin.com

Personal site. Economics, finance and international business, with the working
code behind the claims.

The argument the site makes is that a number nobody can check is a claim, so
every figure on it declares where it came from: whether it reproduces offline
from a capture committed to its repository, was measured against real data, was
simulated over historical prices, is the output of assumptions the reader sets,
or belongs to a tool with no result to reproduce. Anything that could not be
sourced is not on the site.

## Running it

```bash
npm install
npm run dev
```

`npm run build` runs `scripts/build-cv-pdf.ts` first, which generates
`public/finn-lakin-cv.pdf` from the same typed content the site renders, so the
CV and the site cannot drift apart. The PDF is gitignored precisely because it
is generated rather than authored.

## Layout

| Path | What is in it |
|---|---|
| `src/lib/` | All content, as typed TypeScript. No CMS, no content in the database |
| `src/content/writing/` | Long-form pieces, one component each |
| `src/components/` | Presentation, including the two chart forms |
| `src/app/` | Routes, the share-card generator, and the analytics endpoints |
| `scripts/` | The CV generator |
| `tests/` | Playwright, run against the production build |

Content lives in typed modules rather than markdown so that a figure without a
declared provenance fails the type check rather than reaching the page.

## Tests

```bash
npm run build && npm test
```

The suite runs against `next start` rather than the dev server, because static
prerendering, the emitted head tags and minified HTML only exist after a build.
Analytics is tested against a real PostgreSQL rather than mocks, alongside a
second server started with no database and no secret, to prove the site degrades
instead of breaking.

## Deployment

Vercel. Environment variables:

| Variable | Effect if unset |
|---|---|
| `NEXT_PUBLIC_SITE_URL` | Canonical URLs fall back to the Vercel production URL |
| `POSTGRES_URL` | Analytics records nothing; the site is unaffected |
| `ANALYTICS_SALT` | Analytics records nothing, rather than hashing under a guessable key |
| `ADMIN_PASSWORD` | The dashboard returns 404 |
| `ADMIN_SECRET` | The dashboard returns 404 |

The site degrades cleanly without every one of them.

## Analytics

Cookieless, and nothing is stored on the visitor's device, so there is nothing
to consent to. The visitor identifier is `HMAC(key, ip + user-agent +
accept-language)` where the key is itself `HMAC(secret, today's date)`. Because
the key changes at midnight UTC, yesterday's identifiers cannot be recomputed or
matched against today's: cross-day tracking is impossible by construction rather
than forbidden by policy. Only a hash of the address is stored, never the
address.

Event names and metadata fields are closed lists checked on the server, not
patterns, because a pattern would accept `email` and `password` from anyone who
posted them and the endpoint is open to the internet.
