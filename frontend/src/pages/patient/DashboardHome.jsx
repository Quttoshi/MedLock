import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Upload, ShieldCheck, Clock, FileText, ChevronRight } from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import api from "../../api/axios";
import StatusPill from "../../components/ui/StatusPill";
import {
  activeAccess,
  doctorLabel,
  groupStoryByMonth,
  initials,
  pendingRequests,
  reportTypes,
} from "../../adapters/patientStory";

function DashboardHome() {
  const { user, token } = useAuth();
  // null means "still loading"
  const [reports, setReports] = useState(null);
  const [requests, setRequests] = useState(null);
  const [typeFilter, setTypeFilter] = useState("All");

  // Same two calls as before. Nothing about the data flow changed.
  useEffect(() => {
    if (!token) return;
    const headers = { Authorization: `Bearer ${token}` };
    api.get("/reports/my", { headers })
      .then((res) => setReports(res.data))
      .catch(() => setReports([]));
    api.get("/access-requests", { headers })
      .then((res) => setRequests(res.data))
      .catch(() => setRequests([]));
  }, [token]);

  const loadingReports = reports === null;
  const allReports = reports ?? [];
  const allRequests = requests ?? [];

  const awaitingApproval = allReports.filter((r) => !r.is_approved).length;
  const inRecord = allReports.length - awaitingApproval;
  const types = reportTypes(allReports);
  const groups = groupStoryByMonth(allReports, typeFilter);
  const pending = pendingRequests(allRequests);
  const access = activeAccess(allRequests);

  const firstName = user?.name?.split(" ")[0];

  return (
    <div className="grid gap-6 xl:grid-cols-[300px_minmax(0,1fr)_300px] xl:items-start">
      {/* Left: who this is and what protects the records */}
      <aside className="space-y-4 xl:sticky xl:top-6">
        <section className="card card-pad !p-6">
          <div className="display flex h-16 w-16 items-center justify-center rounded-full bg-brand-subtle text-xl text-brand" aria-hidden="true">
            {initials(user?.name)}
          </div>
          <h2 className="display mt-4 break-words text-[28px] leading-tight text-ink">{user?.name || "Your account"}</h2>
          {user?.email && <p className="mt-1 break-all text-sm text-muted">{user.email}</p>}

          <dl className="mt-5 grid grid-cols-2 gap-3">
            <div className="card-inset p-3.5">
              <dt className="text-[13px] text-muted">In your record</dt>
              <dd className="mt-0.5 text-xl font-bold text-ink">{loadingReports ? "..." : inRecord}</dd>
            </div>
            <div className="card-inset p-3.5">
              <dt className="text-[13px] text-muted">Awaiting you</dt>
              <dd className="mt-0.5 text-xl font-bold text-ink">{loadingReports ? "..." : awaitingApproval}</dd>
            </div>
          </dl>

          <div className="panel-deep mt-4 flex gap-3 !rounded-2xl p-4">
            <ShieldCheck aria-hidden="true" size={22} className="mt-0.5 flex-shrink-0 text-deep-on-muted" />
            <div>
              <p className="text-sm font-bold">Protected by design</p>
              <p className="mt-1 text-[13px] leading-5 text-deep-on-soft">
                Files are encrypted with AES 256 before storage. Their fingerprints are recorded on Ethereum Sepolia testnet.
              </p>
            </div>
          </div>

          <Link to="/patient/upload" className="btn btn-primary mt-4 w-full">
            <Upload aria-hidden="true" size={18} />
            Upload a record
          </Link>
        </section>
      </aside>

      {/* Middle: the story */}
      <section aria-labelledby="story-heading" className="min-w-0">
        {pending.length > 0 && (
          <div className="card mb-6 flex flex-col gap-4 p-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex min-w-0 items-center gap-3">
              <span className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-full bg-warn-subtle text-sm font-bold text-warn-ink" aria-hidden="true">
                {initials(pending[0].doctor_name)}
              </span>
              <p className="min-w-0 text-sm leading-6 text-ink-soft">
                <span className="font-bold text-ink">{doctorLabel(pending[0].doctor_name)}</span> asked to see your records.
                {pending.length > 1 && ` ${pending.length - 1} more waiting.`}
                {pending[0].reason && <span className="block truncate text-muted">Reason: {pending[0].reason}</span>}
              </p>
            </div>
            <Link to="/patient/access-requests" className="btn btn-sm flex-shrink-0 bg-deep text-deep-on hover:bg-deep-2">
              Review request
            </Link>
          </div>
        )}

        <h1 id="story-heading" className="display text-[28px] leading-[1.15] text-ink sm:text-[32px]">
          {firstName ? `${firstName}'s health ` : "Your health "}
          <em>story</em>
        </h1>

        {types.length > 0 && (
          <div role="group" aria-label="Filter by record type" className="mt-5 inline-flex max-w-full gap-1 overflow-x-auto rounded-full border border-line bg-surface p-1">
            {["All", ...types].map((t) => (
              <button
                key={t}
                type="button"
                aria-pressed={typeFilter === t}
                onClick={() => setTypeFilter(t)}
                className={`whitespace-nowrap rounded-full px-4 py-2 text-sm font-semibold transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand ${
                  typeFilter === t ? "bg-deep text-deep-on" : "text-ink-soft hover:bg-inset hover:text-ink"
                }`}
              >
                {t === "All" ? "Everything" : t}
              </button>
            ))}
          </div>
        )}

        {loadingReports && <p className="mt-8 text-muted">Loading your records...</p>}

        {!loadingReports && allReports.length === 0 && (
          <div className="card card-pad mt-8 text-center">
            <FileText aria-hidden="true" size={28} className="mx-auto text-muted" />
            <p className="display mt-3 text-xl text-ink">Nothing here yet</p>
            <p className="mx-auto mt-2 max-w-sm text-sm leading-6 text-muted">
              Upload your first report and it will appear on your timeline.
            </p>
            <Link to="/patient/upload" className="btn btn-primary mt-5">
              Upload a record
            </Link>
          </div>
        )}

        {groups.map((group) => (
          <div key={group.key} className="mt-8">
            <h2 className="eyebrow mb-3">{group.label}</h2>
            <ol className="relative space-y-3 before:absolute before:bottom-6 before:left-[9px] before:top-6 before:w-0.5 before:bg-line-strong/40 before:content-['']">
              {group.items.map((item) => (
                <li key={item.id} className="relative pl-9">
                  <span className="absolute left-0 top-1/2 h-5 w-5 -translate-y-1/2 rounded-full border-[3px] border-brand bg-canvas" aria-hidden="true" />
                  <Link
                    to={item.pending ? "/patient/reports" : `/patient/reports/${item.id}`}
                    className="card flex items-center gap-4 p-4 transition-colors hover:border-line-strong focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
                  >
                    <span className="w-12 flex-shrink-0 text-center" aria-hidden="true">
                      <span className="display block text-3xl leading-none text-ink">{item.day}</span>
                      <span className="mt-1 block text-xs text-muted">{item.month}</span>
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block break-words text-base font-bold leading-snug text-ink">{item.title}</span>
                      <span className="block text-sm text-muted">{item.subtitle}</span>
                      <span className="mt-2 flex flex-wrap items-center gap-2">
                        <span className="pill pill-plain">{item.type}</span>
                        {item.pending && <StatusPill tone="warn">Awaiting your approval</StatusPill>}
                      </span>
                    </span>
                    <ChevronRight aria-hidden="true" size={18} className="flex-shrink-0 text-muted" />
                  </Link>
                </li>
              ))}
            </ol>
          </div>
        ))}
      </section>

      {/* Right: who can see what, and the quick way to add */}
      <aside className="space-y-4 xl:sticky xl:top-6">
        <section className="card p-6" aria-labelledby="access-heading">
          <h2 id="access-heading" className="display text-xl text-ink">Doctors with access</h2>
          {requests === null ? (
            <p className="mt-3 text-sm text-muted">Loading...</p>
          ) : access.length === 0 ? (
            <p className="mt-3 text-sm leading-6 text-muted">
              No doctor can see your records right now. You decide who does.
            </p>
          ) : (
            <ul className="mt-3 divide-y divide-line">
              {access.slice(0, 3).map((a) => (
                <li key={a.id} className="py-3.5 first:pt-1">
                  <p className="font-bold text-ink">{a.doctor}</p>
                  {a.endsOn && (
                    <p className="mt-0.5 flex items-center gap-1.5 text-[13px] text-muted">
                      <Clock aria-hidden="true" size={14} />
                      Ends {a.endsOn} · {a.daysLeft} {a.daysLeft === 1 ? "day" : "days"} left
                    </p>
                  )}
                </li>
              ))}
            </ul>
          )}
          <Link to="/patient/access-requests" className="link mt-3 inline-block text-sm">
            Manage sharing
          </Link>
        </section>

        <Link
          to="/patient/upload"
          className="flex flex-col items-center rounded-card border-2 border-dashed border-line-strong p-8 text-center transition-colors hover:bg-surface focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
        >
          <span className="flex h-12 w-12 items-center justify-center rounded-full bg-surface text-brand">
            <Upload aria-hidden="true" size={22} />
          </span>
          <span className="mt-3 text-base font-bold text-ink">Add to your story</span>
          <span className="mt-1 text-sm leading-5 text-muted">
            Upload a report. It is encrypted before it is stored.
          </span>
        </Link>
      </aside>
    </div>
  );
}

export default DashboardHome;
