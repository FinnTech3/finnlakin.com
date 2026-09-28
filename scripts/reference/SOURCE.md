# Reference figures

## `gray728-lateral-cerebrum.png`

*Lateral surface of left cerebral hemisphere, viewed from the side.* Plate 728
of Henry Gray, *Anatomy of the Human Body*, 20th edition, 1918.

- Source: <https://commons.wikimedia.org/wiki/File:Gray728.svg>, rendered to PNG
  at 1280px wide.
- **Public domain.** Published in 1918, so the work is out of copyright
  everywhere, and Wikimedia records it as public domain.

It is here so that `npm run trace:brain` can be re-run without a network
connection, and so that the provenance of `src/particles/brain-profile.ts` can
be checked rather than taken on trust. Nothing in this directory is served to a
browser: Next.js ships `public/`, not `scripts/`.
