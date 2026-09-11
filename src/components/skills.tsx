import { languages, skillGroups } from "@/lib/skills";

export function Skills() {
  return (
    <div className="flex flex-col gap-10">
      <div className="grid gap-x-8 gap-y-8 sm:grid-cols-2">
        {skillGroups.map((group) => (
          <div key={group.id} className="flex flex-col gap-3 border-t border-rule pt-4">
            <h3 className="font-mono text-[11px] uppercase tracking-[0.13em] text-muted">
              {group.label}
            </h3>
            <ul className="flex flex-wrap gap-x-4 gap-y-1.5">
              {group.items.map((item) => (
                <li key={item} className="text-sm text-ink-soft">
                  {item}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>

      <div className="flex flex-col gap-3 border-t border-rule pt-4">
        <h3 className="font-mono text-[11px] uppercase tracking-[0.13em] text-muted">
          Languages
        </h3>
        <dl className="flex flex-wrap gap-x-10 gap-y-4">
          {languages.map((language) => (
            <div key={language.name} className="flex flex-col gap-0.5">
              <dt className="text-sm font-medium">{language.name}</dt>
              <dd className="text-sm text-muted">
                {language.level}
                {language.note ? (
                  <span className="mt-0.5 block text-xs">{language.note}</span>
                ) : null}
              </dd>
            </div>
          ))}
        </dl>
      </div>
    </div>
  );
}
