import { ChipField } from "@/components/chip-field";
import { languages, skillGroups } from "@/lib/skills";

/* The tools, as groups of chips.

   Each group is a panel of its own with its label, and what is in it is a cloud
   of small pills and not a list, because a list of six tools is six lines of
   nothing and a pill is a thing you can read at a glance. They are real list
   items, so a screen reader still hears a list. The chips move away from the
   pointer (see chip-field.tsx), which is the cloud's own trick at a smaller
   scale. */
export function Skills() {
  return (
    <div className="flex flex-col gap-10">
      <div className="grid gap-5 @3xl:grid-cols-2" data-chip-field="">
        {skillGroups.map((group, index) => (
          <div
            key={group.id}
            data-reveal=""
            style={{ "--i": index } as React.CSSProperties}
            className="glass flex flex-col gap-4 p-6"
          >
            <h3 className="t-label text-tone">{group.label}</h3>
            <ul className="flex flex-wrap gap-2.5">
              {group.items.map((item) => (
                <li key={item} data-chip="" className="chip">
                  {item}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>

      <div data-reveal="" className="scored flex flex-col gap-5 pt-5">
        <h3 className="t-label text-tone">Languages</h3>
        <dl className="flex flex-wrap gap-x-14 gap-y-6">
          {languages.map((language) => (
            <div key={language.name} className="flex flex-col gap-1">
              <dt className="font-display text-[1.375rem] font-semibold tracking-[-0.02em] text-ink">
                {language.name}
              </dt>
              <dd className="t-caption text-muted">
                {language.level}
                {language.note ? (
                  <span className="mt-1 block text-[0.8125rem]">{language.note}</span>
                ) : null}
              </dd>
            </div>
          ))}
        </dl>
      </div>

      <ChipField />
    </div>
  );
}
