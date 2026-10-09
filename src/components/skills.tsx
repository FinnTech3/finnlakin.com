import { languages, skillGroups } from "@/lib/skills";

export function Skills() {
  return (
    <div className="flex flex-col gap-14">
      <div className="grid gap-x-12 gap-y-12 @xl:grid-cols-2 @5xl:grid-cols-4">
        {skillGroups.map((group) => (
          <div key={group.id} className="scored flex flex-col gap-4 pt-4">
            <h3 className="t-label">{group.label}</h3>
            <ul className="flex flex-col gap-2">
              {group.items.map((item) => (
                <li key={item} className="text-[0.8125rem] text-ink-soft">
                  {item}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>

      <div className="scored flex flex-col gap-4 pt-4">
        <h3 className="t-label">Languages</h3>
        <dl className="flex flex-wrap gap-x-14 gap-y-6">
          {languages.map((language) => (
            <div key={language.name} className="flex flex-col gap-1">
              <dt className="text-[0.9375rem] text-ink">{language.name}</dt>
              <dd className="t-caption text-muted">
                {language.level}
                {language.note ? (
                  <span className="mt-1 block text-[0.75rem]">{language.note}</span>
                ) : null}
              </dd>
            </div>
          ))}
        </dl>
      </div>
    </div>
  );
}
