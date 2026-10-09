import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { FlaskConical, Info, Upload } from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import { getMyTrends } from "../../api/results";
import FilterChips from "../../components/ui/FilterChips";
import TestCard from "../../components/results/TestCard";
import { DISCLAIMER } from "../../utils/results";

// Health trends: every test read from the patient's lab reports, grouped by body
// system, with where each value sits and how it has moved.
function HealthTrends() {
  const { token } = useAuth();
  const [data, setData] = useState(null);
  const [failed, setFailed] = useState(false);
  const [params, setParams] = useSearchParams();
  const panel = params.get("panel") || "all";

  useEffect(() => {
    if (!token) return;
    getMyTrends(token)
      .then((res) => setData(res.data))
      .catch(() => setFailed(true));
  }, [token]);

  const panels = data?.panels ?? [];
  const shown = panel === "all" ? panels : panels.filter((p) => p.code === panel);
  const choosePanel = (value) => setParams(value === "all" ? {} : { panel: value }, { replace: true });

  return (
    <div className="mx-auto max-w-6xl">
      <h1 className="display text-[28px] leading-[1.15] text-ink sm:text-[32px]">Health trends</h1>
      <p className="mt-2 max-w-2xl text-sm leading-6 text-muted">{DISCLAIMER}</p>

      {failed && <p role="alert" className="mt-8 text-bad-ink">Could not load your results. Please try again.</p>}
      {!data && !failed && <p className="mt-8 text-muted">Loading your results...</p>}

      {data && panels.length === 0 && (
        <div className="card card-pad mt-8 text-center">
          <FlaskConical aria-hidden="true" size={28} className="mx-auto text-muted" />
          <p className="display mt-3 text-xl text-ink">No lab results yet</p>
          <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-muted">
            Upload a lab report, such as a blood count, sugar, kidney, liver or cholesterol test. MedLock reads the
            values and shows how they change over time.
          </p>
          <Link to="/patient/upload" className="btn btn-primary mt-5">
            <Upload aria-hidden="true" size={18} />
            Upload a report
          </Link>
        </div>
      )}

      {panels.length > 0 && (
        <>
          {data.anaemia_pattern && (
            <div className="card mt-6 flex gap-3 p-4">
              <Info aria-hidden="true" size={20} className="mt-0.5 flex-shrink-0 text-brand" />
              <p className="text-sm leading-6 text-ink-soft">
                <strong className="text-ink">{data.anaemia_pattern.label}.</strong> Your doctor can tell you what
                this means for you and whether more tests are needed.
              </p>
            </div>
          )}

          <div className="mt-6">
            <FilterChips
              label="Body system"
              value={panel}
              onChange={choosePanel}
              options={[
                { label: "Everything", value: "all" },
                ...panels.map((p) => ({ label: p.name, value: p.code })),
              ]}
            />
          </div>

          {shown.map((p) => (
            <section key={p.code} aria-labelledby={`panel-${p.code}`} className="mt-8">
              <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                <h2 id={`panel-${p.code}`} className="display text-xl text-ink">{p.name}</h2>
                <p className="text-sm text-muted">
                  {p.in_range} in range{p.outside ? `, ${p.outside} outside` : ""}
                </p>
              </div>
              <div className="mt-3 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                {p.tests.map((t) => (
                  <TestCard key={t.code} test={t} to={`/patient/health/${t.code}`} />
                ))}
              </div>
            </section>
          ))}
        </>
      )}
    </div>
  );
}

export default HealthTrends;
