import { Fragment, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { getPatientTable } from "../../api/results";
import { formatDay, formatValue } from "../../utils/results";

const CELL_TONE = {
  normal: "text-ink",
  low: "font-bold text-warn-ink",
  high: "font-bold text-warn-ink",
  critical_low: "font-bold text-bad-ink bg-bad-subtle",
  critical_high: "font-bold text-bad-ink bg-bad-subtle",
};
const CELL_MARK = { low: "L", high: "H", critical_low: "LL", critical_high: "HH" };

/**
 * The cumulative report doctors know from lab systems: tests down the side grouped by
 * body system, collection dates across the top (newest first). Out-of-range values are
 * marked H/L (not only by colour), unchecked values are in italics with a "?", and each
 * value links to the report it came from.
 */
export default function CumulativeTable({ token, patientId }) {
  const [data, setData] = useState(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    getPatientTable(token, patientId)
      .then((res) => setData(res.data))
      .catch(() => setFailed(true));
  }, [token, patientId]);

  if (failed) return <p role="alert" className="mt-6 text-bad-ink">Could not load the results table.</p>;
  if (!data) return <p className="mt-6 text-muted">Loading results...</p>;
  if (!data.rows.length) return <p className="card card-pad mt-6 text-sm text-muted">No lab results to show.</p>;

  return (
    <div className="mt-6">
      <p className="mb-3 text-xs leading-5 text-muted">
        H/L: above or below the range printed on the report (HH/LL: critical). <em>Italic?</em>: read automatically and
        not yet checked. Showing the latest {data.dates.length} collection dates.
      </p>
      <div className="card overflow-x-auto">
        <table className="w-full border-collapse text-sm">
          <caption className="sr-only">Lab results by collection date, newest first</caption>
          <thead>
            <tr className="border-b border-line">
              <th scope="col" className="sticky left-0 z-10 bg-surface px-4 py-3 text-left text-[13px] font-bold text-muted">
                Test
              </th>
              {data.dates.map((d) => (
                <th key={d} scope="col" className="whitespace-nowrap px-3 py-3 text-right text-[13px] font-bold text-muted">
                  {formatDay(d)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.rows.map((row, index) => {
              const header = index === 0 || data.rows[index - 1].panel !== row.panel;
              return (
                <Fragment key={row.code}>
                  {header && (
                    <tr className="bg-inset">
                      <th colSpan={data.dates.length + 1} scope="colgroup" className="sticky left-0 px-4 py-2 text-left text-xs font-bold uppercase tracking-[0.08em] text-muted">
                        {row.panel_name}
                      </th>
                    </tr>
                  )}
                  <tr className="border-b border-line">
                    <th scope="row" className="sticky left-0 z-10 whitespace-nowrap bg-surface px-4 py-2 text-left font-semibold text-ink">
                      {row.name}
                      <span className="ml-1.5 text-xs font-normal text-muted">{row.unit}</span>
                      {row.derived && <span className="ml-1.5 text-xs font-normal text-muted">(calc.)</span>}
                    </th>
                    {row.cells.map((cell, i) =>
                      cell ? (
                        <td key={i} className={`whitespace-nowrap px-3 py-2 text-right ${CELL_TONE[cell.flag] ?? ""}`}>
                          <Link
                            to={`/doctor/patients/${patientId}/reports/${cell.report_id}/view`}
                            title={cell.trusted ? "Open the report" : "Not yet checked. Open the report"}
                            className={`hover:underline ${cell.trusted ? "" : "italic"}`}
                          >
                            {formatValue(cell.value, row.decimals ?? 1)}
                            {CELL_MARK[cell.flag] && <span className="ml-1 text-[11px]">{CELL_MARK[cell.flag]}</span>}
                            {!cell.trusted && <span className="ml-0.5 text-[11px] text-muted">?</span>}
                          </Link>
                        </td>
                      ) : (
                        <td key={i} className="px-3 py-2 text-right text-line-strong">
                          <span aria-label="No result">–</span>
                        </td>
                      )
                    )}
                  </tr>
                </Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
