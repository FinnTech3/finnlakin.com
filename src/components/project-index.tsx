import { provenanceShort } from "@/lib/claims";
import { projects } from "@/lib/projects";

/* The work as a listing: a number, a piece, the one figure that carries it, what
   it is built with and how far the evidence goes, the way a terminal prints
   positions. It is more confident than a page of cards, and it is the way into
   the entries below it: every piece links to its own.

   A region that can scroll has to be reachable without a pointer, or a keyboard
   user at phone width cannot read its right-hand columns. So it is focusable
   and named, and the page itself is never wider than the screen: the table
   scrolls inside itself.

   That is for a phone. From 720 pixels up the table fits the column it is in,
   at every width, and tests/tables.spec.ts holds it to that: a table that
   scrolls inside itself does not make the page wider, which is why a column cut
   off mid-word went unseen for as long as it did. */
export function ProjectIndex() {
  return (
    <div className="table-wrap" tabIndex={0} role="region" aria-label="Index of work">
      <table className="index-table index-work">
        <thead>
          <tr>
            <th scope="col">No</th>
            {/* The widest column asks for its width. Left to the table's own
                arithmetic it was squeezed to a fifth of the row by the columns
                that cannot wrap, and a headline set one word to a line is not
                a headline. The floor is what the lane leaves: the column is 605
                pixels wide at 1100, and with the floor at 14rem the table asked
                for 664, so on an iPad mini on its side the last column was cut
                off mid-word. */}
            <th scope="col" className="w-[40%] min-w-[11rem]">
              Piece
            </th>
            <th scope="col">Figure</th>
            <th scope="col">Built with</th>
            <th scope="col">Evidence</th>
          </tr>
        </thead>
        <tbody>
          {projects.map((project, index) => {
            const stat = project.stats[0];
            return (
              <tr key={project.slug}>
                <td className="num">{String(index + 1).padStart(2, "0")}</td>
                <td>
                  <a href={`#${project.slug}`} className="link-arrow index-name">
                    {project.name}
                  </a>
                  <div className="t-caption mt-1.5 max-w-[46ch]">{project.headline}</div>
                </td>
                <td className="figure">
                  {stat?.tone === "flag" ? (
                    <span className="flag">{stat.value}</span>
                  ) : (
                    (stat?.value ?? "")
                  )}
                </td>
                <td>{project.stack}</td>
                <td>{provenanceShort[project.provenance]}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
