import { endorsements } from "@/lib/endorsements";

export function Endorsements() {
  return (
    <div className="grid gap-x-16 gap-y-14 sm:grid-cols-2">
      {endorsements.map((endorsement) => (
        <figure key={endorsement.id} className="flex flex-col gap-6">
          <blockquote className="t-sub max-w-[22ch] text-pretty text-ink">
            {endorsement.quote}
          </blockquote>
          <figcaption className="mt-auto flex flex-col gap-1 border-t border-rule pt-5">
            <span className="text-[16px] text-ink">{endorsement.name}</span>
            <span className="text-[14px] text-muted">{endorsement.role}</span>
          </figcaption>
          {endorsement.trimmed ? (
            <p className="text-[13px] leading-relaxed text-muted">
              <span className="t-label">Cut. </span>
              {endorsement.trimNote}
            </p>
          ) : null}
        </figure>
      ))}
    </div>
  );
}
