import { reconstructions } from "@/lib/reconstructions";

/* The four reconstructions, as the table the whole site is evidence for.

   Drawn twice, and only one of them is ever on screen. A table with four columns
   cannot fit between the gutters of a phone: it was scrolling inside itself with
   the verdict, which is the whole point of the table, off the right-hand edge.
   Below 720 pixels each row is a short block of its own instead, with the same
   four things in the same order. The one that is not showing is display: none,
   so it is not in the accessibility tree either, and nobody hears the table
   twice.

   Not one table restyled into blocks with CSS. Taking display off a table's
   rows takes the table out of the accessibility tree in some browsers, and the
   fix for that is to put the roles back by hand, which is a way of saying the
   markup is wrong. Two lists of the same four rows, from the same data, is the
   smaller lie. */
export function Ledger() {
  return (
    <>
      <div
        className="table-wrap hidden min-[720px]:block"
        tabIndex={0}
        role="region"
        aria-label="The reconstructions"
      >
        <table className="index-table">
          <thead>
            <tr>
              <th scope="col">Quantity</th>
              <th scope="col">Against</th>
              <th scope="col">Deviation</th>
              <th scope="col">Verdict</th>
            </tr>
          </thead>
          <tbody className="settle-rows">
            {reconstructions.map((row) => (
              <tr key={row.quantity}>
                <td>
                  {row.quantity}
                  <div className="t-label mt-1">{row.detail}</div>
                </td>
                <td>{row.reference}</td>
                <td className="figure">
                  {row.tone === "flag" ? (
                    <span className="flag">{row.deviation}</span>
                  ) : (
                    <span className="held">{row.deviation}</span>
                  )}
                </td>
                <td>
                  {row.tone === "flag" ? (
                    <span className="flag">{row.verdict}</span>
                  ) : (
                    <span className="held">{row.verdict}</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <ul className="flex flex-col min-[720px]:hidden">
        {reconstructions.map((row) => (
          <li key={row.quantity} className="scored-thin py-5 first:border-t-0 first:pt-0">
            <p className="index-name">{row.quantity}</p>
            <p className="t-label mt-1.5">{row.detail}</p>
            <dl className="mt-4 grid grid-cols-[6.25rem_minmax(0,1fr)] items-baseline gap-x-4 gap-y-2 text-[0.8125rem]">
              <dt className="t-label">Against</dt>
              <dd>{row.reference}</dd>
              <dt className="t-label">Deviation</dt>
              <dd className="font-bold">
                {row.tone === "flag" ? (
                  <span className="flag">{row.deviation}</span>
                ) : (
                  <span className="held">{row.deviation}</span>
                )}
              </dd>
              <dt className="t-label">Verdict</dt>
              <dd>
                {row.tone === "flag" ? (
                  <span className="flag">{row.verdict}</span>
                ) : (
                  <span className="held">{row.verdict}</span>
                )}
              </dd>
            </dl>
          </li>
        ))}
      </ul>
    </>
  );
}
