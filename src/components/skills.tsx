import { languages, skillGroups } from "@/lib/skills";

export function Skills() {
  return (
    <div className="flex flex-col gap-14">
      <div className="grid gap-x-12 gap-y-12 sm:grid-cols-2 lg:grid-cols-4">
        {skillGroups.map((group) => (
          <div key={group.id} className="flex flex-col gap-4 border-t border-rule pt-5">
            <h3 className="t-label text-spark">{group.label}</h3>
            <ul className="flex flex-col gap-2">
              {group.items.map((item) => (
                <li key={item} className="text-[16px] font-extralight text-ink-soft">
                  {item}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>

      <div className="flex flex-col gap-4 border-t border-rule pt-5">
        <h3 className="t-label text-spark">Languages</h3>
        <dl className="flex flex-wrap gap-x-14 gap-y-6">
          {languages.map((language) => (
            <div key={language.name} className="flex flex-col gap-1">
              <dt className="text-[17px] text-ink">{language.name}</dt>
              <dd className="text-[15px] font-extralight text-muted">
                {language.level}
                {language.note ? (
                  <span className="mt-1 block text-[14px]">{language.note}</span>
                ) : null}
              </dd>
            </div>
          ))}
        </dl>
      </div>
    </div>
  );
}
