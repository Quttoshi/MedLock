import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { Upload, ShieldCheck, ChevronRight } from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import api from "../../api/axios";
import { getMyIdentity } from "../../api/patient";
import StatusPill from "../../components/ui/StatusPill";
import IdentityCard from "../../components/IdentityCard";
import EmergencyAlerts from "../../components/EmergencyAlerts";
import HealthGlance from "../../components/results/HealthGlance";
import { parseServerDate } from "../../utils/dates";
import {
  activeAccess,
  doctorLabel,
  groupStoryByMonth,
  pendingRequests,
  reportTypes,
} from "../../adapters/patientStory";

// Patient overview. Same two data calls as before (/reports/my and
// /access-requests) plus the identity call the CNIC card already made. The
// header and the tabs only rearrange what those calls return. Nothing the
// backend cannot supply is shown (no allergies, vitals, insurance or visits).

const TABS = [
  { id: "summary", label: "Summary" },
  { id: "timeline", label: "Timeline" },
  { id: "sharing", label: "Sharing" },
  { id: "details", label: "Details" },
];

const focusRing =
  "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand";

const fmtDate = (value) =>
  parseServerDate(value).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });

function ageFrom(dob) {
  const born = parseServerDate(dob);
  const now = new Date();
  let years = now.getFullYear() - born.getFullYear();
  const beforeBirthday =
    now.getMonth() < born.getMonth() || (now.getMonth() === born.getMonth() && now.getDate() < born.getDate());
  if (beforeBirthday) years -= 1;
  return years >= 0 ? years : null;
}

// Outline on the left. Each step is a plain row with a bar marking the one
// you are on. On small screens it becomes a scrolling row.
function StepList({ label, items, activeId, onPick }) {
  return (
    <nav aria-label={label} className="lg:sticky lg:top-4">
      <ul className="flex gap-1 overflow-x-auto rounded-lg border border-line bg-surface p-1.5 lg:flex-col lg:overflow-visible">
        {items.map((item) => {
          const active = item.id === activeId;
          return (
            <li key={item.id} className="flex-shrink-0">
              <button
                type="button"
                aria-current={active ? "step" : undefined}
                onClick={() => onPick(item.id)}
                className={`flex w-full items-center gap-2 whitespace-nowrap rounded-md border-l-[3px] px-3 py-2 text-left text-sm transition-colors ${focusRing} ${
                  active
                    ? "border-brand bg-inset font-semibold text-ink"
                    : "border-transparent text-ink-soft hover:bg-inset hover:text-ink"
                }`}
              >
                <span className="flex-1">{item.label}</span>
                {item.count !== undefined && <span className="text-xs tabular-nums text-muted">{item.count}</span>}
              </button>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

function Fact({ label, children }) {
  return (
    <div className="min-w-0 xl:border-l xl:border-line xl:pl-4 xl:first:border-l-0 xl:first:pl-0">
      <dt className="text-xs text-muted">{label}</dt>
      <dd className="mt-0.5 text-sm font-semibold text-ink">{children}</dd>
    </div>
  );
}

function SideFact({ label, children }) {
  return (
    <div className="rounded-md bg-inset px-3 py-2">
      <p className="text-xs text-muted">{label}</p>
      <p className="mt-0.5 text-sm font-semibold leading-5 text-ink">{children}</p>
    </div>
  );
}

function SectionTitle({ id, children, action }) {
  return (
    <div className="mb-3 flex items-center justify-between gap-3 border-b border-line pb-2">
      <h2 id={id} className="display text-lg text-ink">
        {children}
      </h2>
      {action}
    </div>
  );
}

// A flagged item: amber bar on the left, text, one action on the right.
function AttentionRow({ title, text, children }) {
  return (
    <div className="flex flex-col gap-3 rounded-lg border border-l-4 border-line border-l-warn bg-surface px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
      <p className="min-w-0 text-sm leading-5 text-ink-soft">
        <span className="block break-words font-semibold text-ink">{title}</span>
        {text}
      </p>
      {children}
    </div>
  );
}

function AccessTable({ access, limit }) {
  const rows = limit ? access.slice(0, limit) : access;
  return (
    <ul className="divide-y divide-line">
      {rows.map((a) => (
        <li key={a.id} className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-0.5 px-4 py-3">
          <p className="min-w-0 text-sm">
            <span className="font-semibold text-ink">{a.doctor}</span>
            {a.specialization && <span className="ml-2 capitalize text-muted">{a.specialization}</span>}
          </p>
          {a.endsOn && (
            <p className="text-sm tabular-nums text-muted">
              Ends {a.endsOn} · {a.daysLeft} {a.daysLeft === 1 ? "day" : "days"} left
            </p>
          )}
        </li>
      ))}
    </ul>
  );
}

function RecordRow({ item }) {
  return (
    <Link
      to={item.pending ? "/patient/reports" : `/patient/reports/${item.id}`}
      className={`grid grid-cols-[3.5rem_minmax(0,1fr)_auto] items-center gap-3 px-4 py-3 transition-colors hover:bg-inset ${focusRing}`}
    >
      <span className="text-sm tabular-nums text-muted">
        {item.day} {item.month}
      </span>
      <span className="min-w-0">
        <span className="block break-words text-sm font-semibold text-ink">{item.title}</span>
        <span className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[13px] text-muted">
          {item.subtitle}
          <span className="pill pill-plain">{item.type}</span>
          {item.pending && <StatusPill tone="warn">Awaiting your approval</StatusPill>}
        </span>
      </span>
      <ChevronRight aria-hidden="true" size={16} className="text-muted" />
    </Link>
  );
}

function Panel({ children, className = "" }) {
  return <div className={`overflow-hidden rounded-lg border border-line bg-surface ${className}`}>{children}</div>;
}

function Empty({ children }) {
  return <p className="rounded-lg border border-dashed border-line-strong px-4 py-6 text-center text-sm text-muted">{children}</p>;
}

function DashboardHome() {
  const { user, token } = useAuth();
  // null means "still loading"
  const [reports, setReports] = useState(null);
  const [requests, setRequests] = useState(null);
  const [identity, setIdentity] = useState(null);
  const [tab, setTab] = useState("summary");
  const [section, setSection] = useState("attention");
  const [typeFilter, setTypeFilter] = useState("All");
  const tabRefs = useRef([]);

  useEffect(() => {
    if (!token) return;
    const headers = { Authorization: `Bearer ${token}` };
    api.get("/reports/my", { headers })
      .then((res) => setReports(res.data))
      .catch(() => setReports([]));
    api.get("/access-requests", { headers })
      .then((res) => setRequests(res.data))
      .catch(() => setRequests([]));
    getMyIdentity(token)
      .then((res) => setIdentity(res.data))
      .catch(() => setIdentity(null));
  }, [token]);

  const loadingReports = reports === null;
  const allReports = reports ?? [];
  const allRequests = requests ?? [];

  const awaiting = allReports.filter((r) => !r.is_approved);
  const inRecord = allReports.length - awaiting.length;
  const types = reportTypes(allReports);
  const groups = groupStoryByMonth(allReports, typeFilter);
  const recent = groupStoryByMonth(allReports, "All").flatMap((g) => g.items).slice(0, 5);
  const pending = pendingRequests(allRequests);
  const access = activeAccess(allRequests);
  const latest = allReports
    .slice()
    .sort((a, b) => parseServerDate(b.uploaded_at) - parseServerDate(a.uploaded_at))[0];
  const age = identity?.date_of_birth ? ageFrom(identity.date_of_birth) : null;
  const needsCnic = identity && identity.has_cnic === false;
  const caughtUp = pending.length === 0 && awaiting.length === 0 && !needsCnic;

  const onTabKey = (e, index) => {
    let next = null;
    if (e.key === "ArrowRight") next = (index + 1) % TABS.length;
    else if (e.key === "ArrowLeft") next = (index - 1 + TABS.length) % TABS.length;
    else if (e.key === "Home") next = 0;
    else if (e.key === "End") next = TABS.length - 1;
    if (next === null) return;
    e.preventDefault();
    setTab(TABS[next].id);
    tabRefs.current[next]?.focus();
  };

  const pickSection = (id) => {
    setSection(id);
    document.getElementById(`sec-${id}`)?.scrollIntoView({ block: "start" });
  };

  const summarySteps = [
    { id: "attention", label: "Needs attention" },
    { id: "recent", label: "Recent records" },
    { id: "access", label: "Doctors with access" },
  ];
  const timelineSteps = [
    { id: "All", label: "Everything", count: allReports.length },
    ...types.map((t) => ({ id: t, label: t, count: allReports.filter((r) => r.report_type === t).length })),
  ];
  const hasSteps = tab === "summary" || (tab === "timeline" && types.length > 0);

  return (
    <div className="space-y-4">
      {/* Patient header */}
      <section className="overflow-hidden rounded-lg border border-line bg-surface" aria-labelledby="patient-name">
        <div className="grid lg:grid-cols-[minmax(0,1fr)_300px]">
          <div className="min-w-0 p-5">
            <div className="flex flex-wrap items-baseline gap-x-3 gap-y-0.5">
              <h1 id="patient-name" className="display break-words text-[28px] leading-tight text-ink">
                {user?.name || "Your account"}
              </h1>
              {user?.email && <p className="break-all text-sm text-muted">{user.email}</p>}
            </div>
            <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-3 border-t border-line pt-4 sm:grid-cols-3 xl:grid-cols-5">
              <Fact label="Born">
                {identity?.date_of_birth
                  ? `${fmtDate(identity.date_of_birth)}${age !== null ? ` (${age})` : ""}`
                  : "Not added"}
              </Fact>
              <Fact label="CNIC">
                {identity?.has_cnic && identity.cnic_masked ? (
                  <span className="font-mono">{identity.cnic_masked}</span>
                ) : (
                  "Not added"
                )}
              </Fact>
              <Fact label="In your record">{loadingReports ? "..." : inRecord}</Fact>
              <Fact label="Awaiting you">{loadingReports ? "..." : awaiting.length}</Fact>
              <Fact label="Doctors with access">{requests === null ? "..." : access.length}</Fact>
            </dl>
          </div>
          <div className="grid gap-2 border-t border-line p-5 sm:grid-cols-2 lg:grid-cols-1 lg:border-l lg:border-t-0">
            <SideFact label="Latest record">
              {loadingReports
                ? "..."
                : latest
                  ? `${fmtDate(latest.uploaded_at)}${latest.report_type ? ` · ${latest.report_type}` : ""}`
                  : "No records yet"}
            </SideFact>
            <SideFact label="Next access ending">
              {requests === null
                ? "..."
                : access[0]
                  ? `${access[0].doctor}${access[0].endsOn ? ` · ${access[0].endsOn}` : ""}`
                  : "No doctor has access"}
            </SideFact>
          </div>
        </div>

        <div role="tablist" aria-label="Patient overview" className="flex gap-1 overflow-x-auto border-t border-line px-3">
          {TABS.map((t, i) => {
            const active = tab === t.id;
            return (
              <button
                key={t.id}
                ref={(el) => (tabRefs.current[i] = el)}
                type="button"
                role="tab"
                id={`ptab-${t.id}`}
                aria-selected={active}
                aria-controls="ptab-panel"
                tabIndex={active ? 0 : -1}
                onClick={() => setTab(t.id)}
                onKeyDown={(e) => onTabKey(e, i)}
                className={`relative whitespace-nowrap px-3 py-3 text-sm font-semibold transition-colors ${focusRing} ${
                  active ? "text-ink" : "text-muted hover:text-ink"
                }`}
              >
                {t.label}
                {active && <span aria-hidden="true" className="absolute inset-x-2 bottom-0 h-0.5 bg-brand" />}
              </button>
            );
          })}
        </div>
      </section>

      {/* Step list and content */}
      <div className={`grid grid-cols-[minmax(0,1fr)] gap-4 ${hasSteps ? "lg:grid-cols-[210px_minmax(0,1fr)] lg:items-start" : ""}`}>
        {tab === "summary" && (
          <StepList label="Summary sections" items={summarySteps} activeId={section} onPick={pickSection} />
        )}
        {tab === "timeline" && types.length > 0 && (
          <StepList label="Filter by record type" items={timelineSteps} activeId={typeFilter} onPick={setTypeFilter} />
        )}

        <div id="ptab-panel" role="tabpanel" aria-labelledby={`ptab-${tab}`} className="min-w-0 space-y-6">
          {tab === "summary" && (
            <>
              <section id="sec-attention" aria-labelledby="attention-title" className="scroll-mt-4">
                <SectionTitle id="attention-title">Needs your attention</SectionTitle>
                <EmergencyAlerts token={token} />
                <div className="space-y-2">
                  {pending.map((p) => (
                    <AttentionRow
                      key={p.id}
                      title={`${doctorLabel(p.doctor_name)} asked to see your records`}
                      text={p.reason ? `Reason: ${p.reason}` : null}
                    >
                      <Link to="/patient/access-requests" className="btn btn-sm flex-shrink-0 bg-deep text-deep-on hover:bg-deep-2">
                        Review request
                      </Link>
                    </AttentionRow>
                  ))}
                  {awaiting.map((r) => (
                    <AttentionRow
                      key={r.id}
                      title={r.original_filename}
                      text="Review this report before it is added to your medical record."
                    >
                      <Link to="/patient/reports" className="btn btn-sm flex-shrink-0 bg-deep text-deep-on hover:bg-deep-2">
                        Review report
                      </Link>
                    </AttentionRow>
                  ))}
                  {needsCnic && (
                    <AttentionRow
                      title="Add your CNIC"
                      text="Hospitals and labs use it to send you reports."
                    >
                      <button
                        type="button"
                        onClick={() => setTab("details")}
                        className="btn btn-sm flex-shrink-0 bg-deep text-deep-on hover:bg-deep-2"
                      >
                        Add CNIC
                      </button>
                    </AttentionRow>
                  )}
                  {caughtUp && !loadingReports && requests !== null && <Empty>Nothing is waiting for you.</Empty>}
                </div>
              </section>

              {/* Lab results card from the health trends work. It renders nothing
                  until the patient has results, so no empty space appears. */}
              <div id="sec-labs" className="scroll-mt-4">
                <HealthGlance token={token} />
              </div>

              <section id="sec-recent" aria-labelledby="recent-title" className="scroll-mt-4">
                <SectionTitle
                  id="recent-title"
                  action={
                    <Link to="/patient/upload" className="btn btn-primary btn-sm">
                      <Upload aria-hidden="true" size={15} />
                      Upload a record
                    </Link>
                  }
                >
                  Recent records
                </SectionTitle>
                {loadingReports && <p className="text-sm text-muted">Loading your records...</p>}
                {!loadingReports && recent.length === 0 && <Empty>No records yet. Upload your first report and it will appear here.</Empty>}
                {recent.length > 0 && (
                  <Panel className="divide-y divide-line">
                    {recent.map((item) => (
                      <RecordRow key={item.id} item={item} />
                    ))}
                  </Panel>
                )}
                {allReports.length > recent.length && (
                  <button type="button" onClick={() => setTab("timeline")} className="link mt-3 inline-block text-sm">
                    See the full timeline
                  </button>
                )}
              </section>

              <section id="sec-access" aria-labelledby="access-title" className="scroll-mt-4">
                <SectionTitle
                  id="access-title"
                  action={
                    <Link to="/patient/access-requests" className="link text-sm">
                      Manage sharing
                    </Link>
                  }
                >
                  Doctors with access
                </SectionTitle>
                {requests === null ? (
                  <p className="text-sm text-muted">Loading...</p>
                ) : access.length === 0 ? (
                  <Empty>No doctor can see your records right now. You decide who does.</Empty>
                ) : (
                  <Panel>
                    <AccessTable access={access} limit={3} />
                  </Panel>
                )}
              </section>
            </>
          )}

          {tab === "timeline" && (
            <section aria-labelledby="story-heading">
              <SectionTitle id="story-heading">
                {user?.name ? `${user.name.split(" ")[0]}'s health ` : "Your health "}
                <em>story</em>
              </SectionTitle>
              {loadingReports && <p className="text-sm text-muted">Loading your records...</p>}
              {!loadingReports && allReports.length === 0 && (
                <Empty>
                  Nothing here yet.{" "}
                  <Link to="/patient/upload" className="link">
                    Upload a record
                  </Link>{" "}
                  and it will appear on your timeline.
                </Empty>
              )}
              {groups.length > 0 && (
                <Panel>
                  {groups.map((group) => (
                    <div key={group.key}>
                      <h3 className="border-b border-t border-line bg-inset px-4 py-1.5 text-xs font-bold uppercase tracking-wider text-muted first:border-t-0">
                        {group.label}
                      </h3>
                      <ul className="divide-y divide-line">
                        {group.items.map((item) => (
                          <li key={item.id}>
                            <RecordRow item={item} />
                          </li>
                        ))}
                      </ul>
                    </div>
                  ))}
                </Panel>
              )}
            </section>
          )}

          {tab === "sharing" && (
            <section aria-labelledby="sharing-title" className="space-y-4">
              <SectionTitle
                id="sharing-title"
                action={
                  <Link to="/patient/access-requests" className="btn btn-primary btn-sm">
                    Manage sharing
                  </Link>
                }
              >
                Who can see your records
              </SectionTitle>
              {pending.length > 0 && (
                <div className="space-y-2">
                  {pending.map((p) => (
                    <AttentionRow
                      key={p.id}
                      title={`${doctorLabel(p.doctor_name)} is waiting for your decision`}
                      text={p.reason ? `Reason: ${p.reason}` : null}
                    >
                      <Link to="/patient/access-requests" className="btn btn-sm flex-shrink-0 bg-deep text-deep-on hover:bg-deep-2">
                        Review request
                      </Link>
                    </AttentionRow>
                  ))}
                </div>
              )}
              {requests === null ? (
                <p className="text-sm text-muted">Loading...</p>
              ) : access.length === 0 ? (
                <Empty>No doctor can see your records right now. You decide who does.</Empty>
              ) : (
                <Panel>
                  <AccessTable access={access} />
                </Panel>
              )}
              <p className="text-sm leading-5 text-muted">
                Approving a request gives access for 30 days. You can take it back at any time, and every decision is logged.
              </p>
            </section>
          )}

          {tab === "details" && (
            <section aria-labelledby="details-title" className="space-y-4">
              <SectionTitle id="details-title">Your details</SectionTitle>
              <div className="max-w-xl">
                <IdentityCard token={token} />
              </div>
              <div className="panel-deep flex max-w-xl gap-3 p-4">
                <ShieldCheck aria-hidden="true" size={20} className="mt-0.5 flex-shrink-0 text-deep-on-muted" />
                <div>
                  <p className="text-sm font-semibold">Protected by design</p>
                  <p className="mt-1 text-[13px] leading-5 text-deep-on-soft">
                    Files are encrypted with AES 256 before storage. Their fingerprints are recorded on Ethereum Sepolia
                    testnet.
                  </p>
                </div>
              </div>
            </section>
          )}
        </div>
      </div>
    </div>
  );
}

export default DashboardHome;
