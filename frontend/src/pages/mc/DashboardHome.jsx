import { useEffect, useState } from "react";
import { Link, useOutletContext } from "react-router-dom";
import { ChevronRight, ShieldCheck, Upload, FileText, Users } from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import { getMCDoctors, getMCReports, getAffiliationRequests } from "../../api/medicalCenter";
import StatusPill from "../../components/ui/StatusPill";
import { parseServerDate } from "../../utils/dates";

const TYPE_LABELS = { hospital: "Hospital", clinic: "Clinic", lab: "Diagnostic lab" };
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

function shortDate(value) {
  if (!value) return "-";
  return parseServerDate(value).toLocaleDateString(undefined, { day: "2-digit", month: "short" });
}

function MCDashboardHome() {
  const { token, user } = useAuth();
  const { isLab, profile } = useOutletContext() ?? {};
  const [doctors, setDoctors] = useState(null);
  const [reports, setReports] = useState(null);
  const [affiliations, setAffiliations] = useState([]);

  useEffect(() => {
    if (!token) return;
    // Labs take no doctors, so their overview skips the doctor calls.
    Promise.all([isLab ? Promise.resolve({ data: [] }) : getMCDoctors(token), getMCReports(token)])
      .then(([d, r]) => {
        setDoctors(d.data);
        setReports(r.data);
      })
      .catch(() => {
        setDoctors([]);
        setReports([]);
      });
    if (!isLab) {
      getAffiliationRequests(token, "pending")
        .then((res) => setAffiliations(res.data))
        .catch(() => setAffiliations([]));
    }
  }, [token, isLab]);

  const dash = (v) => (v === null ? "-" : v);
  const pendingReports = reports ? reports.filter((r) => !r.is_approved).length : 0;
  const recent = reports
    ? [...reports].sort((a, b) => parseServerDate(b.uploaded_at) - parseServerDate(a.uploaded_at)).slice(0, 5)
    : [];

  const actions = [
    { label: "Upload a report", description: "Add a report or imaging study for a patient", path: "/mc/upload", Icon: Upload },
    { label: "Uploaded reports", description: "Everything your center has uploaded", path: "/mc/reports", Icon: FileText },
    ...(isLab ? [] : [{ label: "Your doctors", description: "Doctors affiliated with your center", path: "/mc/doctors", Icon: Users }]),
  ];

  return (
    <div className="grid grid-cols-[minmax(0,1fr)] gap-6">
      <section className="overflow-hidden rounded-lg border border-line bg-surface" aria-labelledby="center-name">
        <div className="p-5">
          <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
            <h1 id="center-name" className="display text-3xl text-ink">
              {user?.name}
            </h1>
            <span className="text-sm text-muted">
              {TYPE_LABELS[profile?.center_type] ?? "Medical center"}
              {user?.email ? ` · ${user.email}` : ""}
            </span>
          </div>
          {profile?.licence_label && (
            <span className="pill pill-ok mt-3">
              <ShieldCheck aria-hidden="true" size={14} />
              {profile.licence_label}
            </span>
          )}
          <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-3 border-t border-line pt-4 sm:grid-cols-4">
            {!isLab && <Fact label="Affiliated doctors" value={dash(doctors && doctors.length)} />}
            {!isLab && (
              <Fact label="Verified doctors" value={dash(doctors && doctors.filter((d) => d.is_verified).length)} />
            )}
            <Fact label="Reports uploaded" value={dash(reports && reports.length)} />
            <Fact label="Awaiting patient approval" value={dash(reports && pendingReports)} />
          </dl>
        </div>
      </section>

      <div className="grid grid-cols-[minmax(0,1fr)] gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <div className="grid grid-cols-[minmax(0,1fr)] content-start gap-6">
          {affiliations.length > 0 && (
            <section aria-labelledby="sec-attention">
              <SectionHead id="sec-attention" title="Needs your attention" />
              <div className="flex flex-col gap-3 rounded-lg border border-l-4 border-line border-l-warn bg-surface px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-sm font-semibold text-ink">
                    {affiliations.length === 1
                      ? "1 doctor asked to join your center"
                      : `${affiliations.length} doctors asked to join your center`}
                  </p>
                  <p className="text-sm text-muted">Check the licence number, then approve or decline.</p>
                </div>
                <Link to="/mc/doctors" className="btn btn-primary btn-sm">
                  Review requests
                </Link>
              </div>
            </section>
          )}

          <section aria-labelledby="sec-recent">
            <SectionHead
              id="sec-recent"
              title="Recent uploads"
              action={
                <Link to="/mc/upload" className="btn btn-primary btn-sm">
                  <Upload aria-hidden="true" size={15} />
                  Upload a report
                </Link>
              }
            />
            {reports && recent.length === 0 ? (
              <p className="rounded-lg border border-dashed border-line-strong px-4 py-6 text-center text-sm text-muted">
                Reports you upload for patients will appear here.
              </p>
            ) : (
              <div className="overflow-x-auto rounded-lg border border-line bg-surface">
                <table className="w-full text-sm">
                  <caption className="sr-only">Latest reports uploaded by your medical center</caption>
                  <thead className="bg-inset">
                    <tr>
                      {["Uploaded", "File", "Patient", "Status"].map((h) => (
                        <th
                          key={h}
                          scope="col"
                          className={`px-4 py-2 text-left text-xs font-bold uppercase tracking-wider text-muted ${
                            h === "Patient" ? "hidden sm:table-cell" : ""
                          }`}
                        >
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-line">
                    {recent.map((r) => (
                      <tr key={r.id}>
                        <td className="whitespace-nowrap px-4 py-3 text-muted">{shortDate(r.uploaded_at)}</td>
                        <td className="px-4 py-3">
                          <span className="block font-semibold text-ink">{r.original_filename || "Report"}</span>
                          <span className="block text-xs text-muted sm:hidden">{r.patient_name || r.patient_email || "-"}</span>
                        </td>
                        <td className="hidden px-4 py-3 text-ink-soft sm:table-cell">{r.patient_name || r.patient_email || "-"}</td>
                        <td className="px-4 py-3">
                          <StatusPill tone={r.is_approved ? "ok" : "warn"}>
                            {r.is_approved ? "Approved" : "Pending approval"}
                          </StatusPill>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            {reports && reports.length > recent.length && (
              <p className="mt-2 text-right text-sm">
                <Link to="/mc/reports" className="link">
                  All {reports.length} reports
                </Link>
              </p>
            )}
          </section>
        </div>

        <aside className="grid content-start gap-6" aria-label="Shortcuts">
          <section aria-labelledby="sec-actions">
            <SectionHead id="sec-actions" title="Shortcuts" />
            <ul className="divide-y divide-line overflow-hidden rounded-lg border border-line bg-surface">
              {actions.map((a) => {
                const ActionIcon = a.Icon;
                return (
                  <li key={a.path}>
                    <Link
                      to={a.path}
                      className={`flex items-center gap-3 px-4 py-3 transition-colors hover:bg-inset ${focusRing}`}
                    >
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
                Reports only join the patient's record after the patient approves them. Every file is encrypted with
                AES 256 before storage, and its fingerprint is recorded on the Ethereum Sepolia testnet.
              </p>
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}

export default MCDashboardHome;
