import { numberWord } from "@/lib/numbers";

/* The other half of the work, held open and saying so.

   Finn has art and clothes that belong on this site and none of it is on it
   yet, so these are bays cut into the wall with nothing in them. A placeholder
   that was somebody else's picture would be the one thing this site argues
   against. When a bay is filled, this is the component to replace: the heading
   below counts the bays and says none are filled, and it would be wrong the
   day one is. */
const bays = [
  "Painting, drawing",
  "Photography, film",
  "3D, code",
  "Graphic design",
  "Archive, fashion",
];

export function Bays() {
  return (
    <div className="scored mt-16 pt-6">
      <div className="mb-5 flex flex-wrap items-baseline justify-between gap-4">
        <h3 className="t-hsm">Bays</h3>
        <span className="t-label">{numberWord(bays.length, { capital: true })} cut, none filled</span>
      </div>
      <p className="measure t-body-lg mb-8 text-ink-soft">
        Space held for the other half of the work: the pictures, the prints, the clothes. Empty
        until there is something of mine to put in it, because a wall hung with stock images is an
        advertisement for stock images.
      </p>
      <div className="grid grid-cols-2 gap-4 @xl:grid-cols-3 @3xl:grid-cols-5">
        {bays.map((bay, index) => (
          <div key={bay} className="bay">
            <span className="bay-no">{String(index + 1).padStart(2, "0")}</span>
            <span className="t-label">{bay}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
