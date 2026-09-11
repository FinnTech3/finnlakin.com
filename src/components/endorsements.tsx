import { endorsements } from "@/lib/endorsements";

export function Endorsements() {
  return (
    <div className="grid gap-6 sm:grid-cols-2">
      {endorsements.map((endorsement) => (
        <figure
          key={endorsement.id}
          className="flex flex-col gap-4 border border-rule bg-panel p-6"
        >
          <blockquote className="font-serif text-[1.05rem] leading-[1.55] text-ink-soft">
            {endorsement.quote}
          </blockquote>
          <figcaption className="mt-auto flex flex-col gap-0.5 border-t border-rule pt-4">
            <span className="text-sm font-medium">{endorsement.name}</span>
            <span className="text-xs text-muted">{endorsement.role}</span>
          </figcaption>
          {endorsement.trimmed ? (
            <p className="text-xs leading-relaxed text-muted">
              <span className="font-mono uppercase tracking-[0.1em]">Cut. </span>
              {endorsement.trimNote}
            </p>
          ) : null}
        </figure>
      ))}
    </div>
  );
}
