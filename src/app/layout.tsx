import type { Metadata, Viewport } from "next";
import { Inter, Source_Serif_4 } from "next/font/google";
import { Backdrop, Scrim } from "@/components/backdrop";
import { SiteFooter, SiteHeader } from "@/components/chrome";
import { Intro, IntroBoot } from "@/components/intro";
import { ParticleBrainMount } from "@/components/particle-brain-mount";
import { ogImageUrl } from "@/lib/metadata";
import { siteDescription, siteTitle, siteUrl } from "@/lib/site";
import "./globals.css";

/* Two families, and DESIGN.md names both substitutes itself: Source Serif 4
   for Signifier, Inter for Sohne.

   No weight array on either, which gets the variable font: one file covering
   the whole axis rather than a static face per weight. That matters more here
   than it usually does, because the brief's body hierarchy is built out of
   half steps (430, 450, 480) that simply do not exist as static faces.

   The serif is loaded with its italic, which is the one place this costs a
   second file. The brief's hero sets a phrase of the headline in italic, and
   Source Serif's italic is drawn rather than slanted: a synthesised oblique of
   a serif at ninety pixels looks like a mistake. */
const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  display: "swap",
});

const sourceSerif = Source_Serif_4({
  variable: "--font-source-serif",
  subsets: ["latin"],
  style: ["normal", "italic"],
  display: "swap",
});

/* Metadata merges per key, not per field: a page that declares openGraph
   replaces this whole object and loses the site-wide values, and declaring it
   at all suppresses any file-convention opengraph-image. Every page therefore
   builds its tags through buildMetadata() in @/lib/metadata, which always
   emits a complete openGraph including an explicit image. */
export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: siteTitle,
    template: `%s · ${siteTitle}`,
  },
  description: siteDescription,
  alternates: {
    canonical: "/",
    types: { "application/atom+xml": `${siteUrl}/feed.xml` },
  },
  openGraph: {
    type: "website",
    siteName: siteTitle,
    title: siteTitle,
    description: siteDescription,
    url: siteUrl,
    images: [
      { url: ogImageUrl("/"), width: 1200, height: 630, alt: siteTitle },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: siteTitle,
    description: siteDescription,
    images: [ogImageUrl("/")],
  },
};

/* Black, because the top of every page is the dark stage and the browser
   chrome should meet it rather than flash paper above it. The page below the
   stage is white, but a reader only sees the chrome against what is at the
   top of the document. */
export const viewport: Viewport = {
  themeColor: "#000000",
  colorScheme: "light",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en-GB"
      className={`${inter.variable} ${sourceSerif.variable} h-full antialiased`}
    >
      <body className="stage-host flex min-h-full flex-col">
        {/* First thing in the document, so the decision about the opening
            animation is made before anything paints. It sets one attribute.
            See the note in components/intro.tsx. */}
        <IntroBoot />

        {/* Behind everything, in this order: the black plate, the shader, and
            the scrim that holds it down. All three are decoration and none can
            be reached by a pointer or a screen reader. Grouped in one fixed
            layer so that they stack behind the particle cloud as a unit. */}
        <div className="stage-decoration">
          {/* The surface the other two are composited onto. See the note in
              globals.css: the stage cannot carry its own background, because
              the gradient and the cloud are both behind it. */}
          <div aria-hidden="true" className="stage-plate" />
          <Backdrop />
          <Scrim />
        </div>

        {/* Outside that wrapper, and it has to be.

            The wrapper is a stacking context, which traps every z-index inside
            it. The opening animation depends on exactly one thing escaping:
            the cloud is lifted above the black veil so that the words are the
            only thing on the screen, and inside the wrapper that lift was
            relative to the wrapper and did nothing. The veil covered the cloud
            instead, and the entrance measured zero lit pixels in the whole
            frame.

            Above the scrim, so its colours run at full strength, and below
            everything that carries words. It is kept off the words by the
            final pass cutting it to the space the layout leaves for it, not by
            being dimmed. It mounts itself only on the home page. */}
        <ParticleBrainMount />

        {/* First focusable element on the page. Visually hidden until it takes
            focus, so a keyboard user can reach the content without tabbing
            through the whole header on every navigation. */}
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:absolute focus:top-3 focus:left-3 focus:z-70 focus:border focus:border-action focus:bg-black focus:px-4 focus:py-2.5 focus:t-label focus:text-ink"
        >
          Skip to content
        </a>
        <SiteHeader />
        <main id="main" tabIndex={-1} className="flex-1 outline-none">
          {children}
        </main>
        <SiteFooter />
        <Intro />
        {/* Static and deferred rather than a React component, so a page view
            is recorded as soon as the document is parsed instead of waiting
            for hydration. See the note at the top of the file. */}
        <script defer src="/analytics.js" />
      </body>
    </html>
  );
}
