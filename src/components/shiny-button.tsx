import type { ReactNode } from "react";

/* The animated call to action Finn supplied, adapted to this codebase.

   The component he sent takes `onClick` and renders a `<button>`. The two
   controls it replaces are links: one to the contact section and one to the
   work section. A `<button>` that navigates is not a button, and the difference
   is not pedantry, it is what decides whether the control can be opened in a
   new tab, whether it appears in a screen reader's list of links, and whether
   middle click does the ordinary thing. So this renders an `<a>` when it is
   given an `href` and a `<button>` when it is given an `onClick`, and the
   union type below means it cannot be given neither.

   The styling lives in globals.css under `.shiny-cta`, with the four changes
   from the original written down there.

   No "use client". Nothing here is stateful: the whole effect is CSS, including
   the hover, so this stays a server component and ships no JavaScript at all. */

type Shared = {
  children: ReactNode;
  className?: string;
};

type AsLink = Shared & { href: string; onClick?: never };
type AsButton = Shared & { onClick: () => void; href?: never };

export function ShinyButton({ children, className = "", ...rest }: AsLink | AsButton) {
  /* The span is not decoration. Two of the layers are drawn on it rather than
     on the control, and it is what lifts the label above them. */
  const label = <span>{children}</span>;

  if ("href" in rest && rest.href !== undefined) {
    return (
      <a href={rest.href} className={`shiny-cta ${className}`}>
        {label}
      </a>
    );
  }

  return (
    <button type="button" onClick={rest.onClick} className={`shiny-cta ${className}`}>
      {label}
    </button>
  );
}
