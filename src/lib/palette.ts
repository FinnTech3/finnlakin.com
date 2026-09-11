import type { PaletteItem } from "@/components/command-palette";
import { projects } from "./projects";
import { contact, nav } from "./site";
import { writing } from "./writing";

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

  const contacts: PaletteItem[] = [
    { href: `mailto:${contact.email}`, label: contact.email, group: "Contact", external: true },
    { href: contact.linkedin, label: "LinkedIn", group: "Contact", external: true },
    { href: contact.github, label: "GitHub", group: "Contact", external: true },
  ];

  return [...pages, ...pieces, ...repos, ...contacts];
}
