import { projects } from "./projects";
import { contact, nav } from "./site";
import { products } from "./software";
import { writing } from "./writing";

export type PaletteItem = {
  href: string;
  label: string;
  group: string;
  hint?: string;
  external?: boolean;
};

/* Called from inside the lazily loaded panel, never from a server component.
   Building these on the server would serialise every item, including the hint
   text, into the RSC payload of every page on the site, for a feature most
   visitors never open. */
export function buildPaletteItems(): PaletteItem[] {
  const pages: PaletteItem[] = [
    ...nav.map((item) => ({ href: item.href, label: item.label, group: "Page" })),
    { href: "/privacy", label: "Privacy", group: "Page" },
  ];

  const pieces: PaletteItem[] = writing.map((piece) => ({
    href: `/writing/${piece.slug}`,
    label: piece.title,
    group: "Write-up",
    hint: piece.dek,
  }));

  const repos: PaletteItem[] = projects.flatMap((project) =>
    project.links.map((link) => ({
      href: link.href,
      label: `${project.name} · ${link.label}`,
      group: link.href.startsWith("https://github.com/") ? "Repository" : "Demo",
      hint: project.headline,
      external: true,
    })),
  );

  /* Where each product can be had: the live listing where there is one and the
     source where there is not, so a result is never a link that was not checked. */
  const software: PaletteItem[] = products.map((product) => ({
    href: product.agensi ?? product.download ?? product.github,
    label: `${product.name} · ${product.agensi ? "Agensi" : product.download ? "Download" : "Source on GitHub"}`,
    group: "Software",
    hint: product.promise,
    external: true,
  }));

  const contacts: PaletteItem[] = [
    { href: `mailto:${contact.email}`, label: contact.email, group: "Contact", external: true },
    { href: contact.linkedin, label: "LinkedIn", group: "Contact", external: true },
    { href: contact.github, label: "GitHub", group: "Contact", external: true },
  ];

  return [...pages, ...pieces, ...software, ...repos, ...contacts];
}
