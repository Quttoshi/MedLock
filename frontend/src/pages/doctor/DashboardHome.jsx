import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ChevronRight, ShieldCheck, Users, UserCheck, Building2 } from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import { getMyPatients, getMyAccessRequests, getMyVerification } from "../../api/doctor";
import { initials } from "../../adapters/patientStory";
import { parseServerDate } from "../../utils/dates";

const focusRing =
  "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand";

function Fact({ label, value }) {
  return (
    <div className="min-w-0 xl:border-l xl:border-line xl:pl-4 xl:first:border-l-0 xl:first:pl-0">
      <dt className="text-xs text-muted">{label}</dt>
      <dd className="mt-0.5 text-sm font-semibold text-ink">{value}</dd>
    </div>
  );
}

function SectionHead({ id, title, action }) {
  return (
    <div className="mb-3 flex items-center justify-between gap-3 border-b border-line pb-2">
      <h2 id={id} className="display text-xl text-ink">
        {title}
      </h2>
      {action}
    </div>
  );
}

function AttentionRow({ title, text, to, cta }) {
  return (
    <div className="flex flex-col gap-3 rounded-lg border border-l-4 border-line border-l-warn bg-surface px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0">
        <p className="text-sm font-semibold text-ink">{title}</p>
        <p className="text-sm text-muted">{text}</p>
      </div>
      <Link to={to} className="btn btn-primary btn-sm flex-shrink-0">
        {cta}
      </Link>
    </div>
  );
}

function shortDate(value) {
  if (!value) return null;
  return parseServerDate(value).toLocaleDateString(undefined, { day: "2-digit", month: "short" });
}

function DoctorDashboardHome() {
  const { token, user } = useAuth();
  const [patients, setPatients] = useState(null);
  const [requests, setRequests] = useState(null);
  // null means we do not know yet, so nothing is claimed about the licence.
  const [verified, setVerified] = useState(null);

  useEffect(() => {
    if (!token) return;
    Promise.all([getMyPatients(token), getMyAccessRequests(token)])
      .then(([p, r]) => {
        setPatients(p.data);
        setRequests(r.data);
      })
      .catch(() => {
        setPatients([]);
        setRequests([]);
      });
    getMyVerification(token)
      .then((res) => setVerified(Boolean(res.data.is_verified)))
      .catch(() => setVerified(null));
  }, [token]);

  const allRequests = requests ?? [];
  const byStatus = (s) => allRequests.filter((r) => r.status === s);
  const pending = byStatus("pending");
  const dash = (v) => (requests === null ? "-" : v);

  // Patients who approved most recently sit at the top of the shortlist.
  const recentPatients = (patients ?? []).slice(0, 5);

  const actions = [
    { label: "Your patients", description: "Patients who approved your access", path: "/doctor/patients", Icon: Users },
    { label: "Access requests", description: "Send a request or track the ones you sent", path: "/doctor/access-requests", Icon: UserCheck },
    { label: "Affiliation", description: "Your medical center and licence verification", path: "/doctor/affiliation", Icon: Building2 },
  ];

  const firstName = user?.name?.replace(/^dr\.?\s+/i, "").split(" ")[0];

  return (
    <div className="grid grid-cols-[minmax(0,1fr)] gap-6">
      <section className="overflow-hidden rounded-lg border border-line bg-surface" aria-labelledby="doctor-name">
        <div className="p-5">
          <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
            <h1 id="doctor-name" className="display text-3xl text-ink">
              {firstName ? `Dr. ${firstName}` : "Your account"}
            </h1>
            <span className="text-sm text-muted">{user?.email}</span>
          </div>
          {verified === true && (
            <span className="pill pill-ok mt-3">
              <ShieldCheck aria-hidden="true" size={14} />
              Licence verified
            </span>
          )}
          <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-3 border-t border-line pt-4 sm:grid-cols-4">
            <Fact label="Patients with access" value={patients === null ? "-" : patients.length} />
            <Fact label="Waiting on the patient" value={dash(pending.length)} />
            <Fact label="Approved" value={dash(byStatus("approved").length)} />
            <Fact label="Denied" value={dash(byStatus("denied").length)} />
          </dl>
        </div>
      </section>

      <div className="grid grid-cols-[minmax(0,1fr)] gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <div className="grid grid-cols-[minmax(0,1fr)] content-start gap-6">
          <section aria-labelledby="sec-attention">
            <SectionHead id="sec-attention" title="Needs your attention" />
            <div className="grid gap-3">
              {verified === false && (
                <AttentionRow
                  title="Your licence is not verified yet"
                  text="A hospital or clinic you work at can verify it, or you can send it to a MedLock admin."
                  to="/doctor/affiliation"
                  cta="Get verified"
                />
              )}
              {pending.length > 0 && (
                <AttentionRow
                  title={pending.length === 1 ? "1 request is waiting on the patient" : `${pending.length} requests are waiting on patients`}
                  text="You can open their records once they approve."
                  to="/doctor/access-requests"
                  cta="See requests"
                />
              )}
              {verified !== false && pending.length === 0 && requests !== null && (
                <p className="rounded-lg border border-dashed border-line-strong px-4 py-6 text-center text-sm text-muted">
                  Nothing is waiting for you.
                </p>
              )}
            </div>
          </section>

          <section aria-labelledby="sec-patients">
            <SectionHead
              id="sec-patients"
              title="Your patients"
              action={
                <Link to="/doctor/access-requests" className="btn btn-primary btn-sm">
                  <UserCheck aria-hidden="true" size={15} />
                  Request access
                </Link>
              }
            />
            {patients !== null && recentPatients.length === 0 ? (
              <p className="rounded-lg border border-dashed border-line-strong px-4 py-6 text-center text-sm text-muted">
                No patient has approved your access yet. Send a request to get started.
              </p>
            ) : (
              <ul className="divide-y divide-line overflow-hidden rounded-lg border border-line bg-surface">
                {recentPatients.map((p) => (
                  <li key={p.id}>
                    <Link
                      to={`/doctor/patients/${p.id}/reports`}
                      className={`flex items-center gap-3 px-4 py-3 transition-colors hover:bg-inset ${focusRing}`}
                    >
                      <span
                        className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded bg-brand-subtle text-xs font-bold text-brand"
                        aria-hidden="true"
                      >
                        {initials(p.name)}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-semibold text-ink">{p.name}</span>
                        <span className="block truncate text-xs text-muted">{p.email}</span>
                      </span>
                      {p.blood_group && (
                        <span className="pill pill-plain hidden flex-shrink-0 sm:inline-flex">{p.blood_group}</span>
                      )}
                      <ChevronRight aria-hidden="true" size={16} className="flex-shrink-0 text-muted" />
                    </Link>
                  </li>
                ))}
              </ul>
            )}
            {patients && patients.length > recentPatients.length && (
              <p className="mt-2 text-right text-sm">
                <Link to="/doctor/patients" className="link">
                  All {patients.length} patients
                </Link>
              </p>
            )}
          </section>

          {pending.length > 0 && (
            <section aria-labelledby="sec-pending">
              <SectionHead id="sec-pending" title="Waiting on the patient" />
              <ul className="divide-y divide-line overflow-hidden rounded-lg border border-line bg-surface">
                {pending.slice(0, 5).map((r) => (
                  <li key={r.id} className="flex items-center gap-3 px-4 py-3">
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-semibold text-ink">
                        {r.patient_name || r.patient_email || "Patient"}
                      </span>
                      {r.reason && <span className="block truncate text-xs text-muted">{r.reason}</span>}
                    </span>
                    {shortDate(r.requested_at || r.created_at) && (
                      <span className="flex-shrink-0 text-xs text-muted">
                        Sent {shortDate(r.requested_at || r.created_at)}
                      </span>
                    )}
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>

        <aside className="grid content-start gap-6" aria-label="Shortcuts">
          <section aria-labelledby="sec-actions">
            <SectionHead id="sec-actions" title="Shortcuts" />
            <ul className="divide-y divide-line overflow-hidden rounded-lg border border-line bg-surface">
              {actions.map((a) => {
                const ActionIcon = a.Icon;
                return (
                  <li key={a.path}>
                    <Link to={a.path} className={`flex items-center gap-3 px-4 py-3 transition-colors hover:bg-inset ${focusRing}`}>
                      <ActionIcon aria-hidden="true" size={18} className="flex-shrink-0 text-brand" />
                      <span className="min-w-0 flex-1">
                        <span className="block text-sm font-semibold text-ink">{a.label}</span>
                        <span className="block text-xs text-muted">{a.description}</span>
                      </span>
                      <ChevronRight aria-hidden="true" size={16} className="flex-shrink-0 text-muted" />
                    </Link>
                  </li>
                );
              })}
            </ul>
          </section>

          <div className="panel-deep flex gap-3 p-4">
            <ShieldCheck aria-hidden="true" size={20} className="mt-0.5 flex-shrink-0 text-deep-on-muted" />
            <div>
              <p className="text-sm font-bold">Patient consent required</p>
              <p className="mt-1 text-sm text-deep-on-soft">
                You can open a patient's records only after you send an access request and the patient approves it.
                Approved access lasts 30 days, and the patient can take it back at any time.
              </p>
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}

export default DoctorDashboardHome;
