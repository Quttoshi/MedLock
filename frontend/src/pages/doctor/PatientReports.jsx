import { useEffect, useState } from "react";
import { useAuth } from "../../context/AuthContext";
import { getPatientReports } from "../../api/doctor";
import { useParams, Link, useSearchParams } from "react-router-dom";
import { ArrowLeft, MessageCircleQuestion, Siren, Phone } from "lucide-react";
import { getActiveEmergencies } from "../../api/emergency";
import { useUnreadThreads } from "../../context/useUnreadThreads";
import { parseServerDate } from "../../utils/dates";
import DoctorOverview from "../../components/results/DoctorOverview";
import CumulativeTable from "../../components/results/CumulativeTable";
import DoctorTrends from "../../components/results/DoctorTrends";
import { formatDay } from "../../utils/results";

const TABS = [
  { value: "overview", label: "Overview" },
  { value: "table", label: "Results table" },
  { value: "trends", label: "Trends" },
  { value: "reports", label: "Reports" },
];

function PatientReports() {
  const { token } = useAuth();
  const { patientId } = useParams();
  const unreadThreads = useUnreadThreads(token);
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(true);
  // Set when this patient's records are open through emergency access
  const [emergency, setEmergency] = useState(null);

  useEffect(() => {
    getPatientReports(token, patientId)
      .then((res) => setReports(res.data))
      .catch(() => setReports([]))
      .finally(() => setLoading(false));
    getActiveEmergencies(token)
      .then((res) => setEmergency(res.data.find((a) => a.patient.id === patientId) || null))
      .catch(() => setEmergency(null));
  }, [token, patientId]);

  // The open tab (and the test opened from the overview) live in the URL, so the back
  // button and shared links keep them.
  const [params, setParams] = useSearchParams();
  const tab = TABS.some((t) => t.value === params.get("tab")) ? params.get("tab") : "overview";
  const focusTest = params.get("test");
  const openTab = (value) => setParams(value === "overview" ? {} : { tab: value }, { replace: true });
  const openTest = (code) => setParams({ tab: "trends", test: code });

  return (
    <div className="mx-auto max-w-5xl">
      <Link to="/doctor/patients" className="link inline-flex items-center gap-2 text-sm no-underline hover:underline">
        <ArrowLeft aria-hidden="true" size={16} />
        Back to patients
      </Link>
      <h1 className="display mt-4 text-[28px] leading-[1.15] text-ink sm:text-[32px]">
        Patient <em>record</em>
      </h1>
      <p className="mt-3 text-sm text-muted">
        Lab values are read automatically from the patient's reports; values marked "not yet checked" may contain
        reading errors, so confirm them against the report before acting on them.
      </p>

      {emergency && (
        <div className="mt-5 rounded-2xl bg-bad-subtle p-4 text-sm text-bad-ink">
          <p className="flex items-center gap-2 font-bold">
            <Siren aria-hidden="true" size={18} />
            Emergency access for {emergency.patient.name} until{" "}
            {parseServerDate(emergency.expires_at).toLocaleString("en-PK", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
          </p>
          <p className="mt-1">
            Every report you open is recorded and the patient can see it. Viewing lab results counts as opening the
            reports they came from.
          </p>
          {emergency.patient.emergency_contact_phone && (
            <p className="mt-1.5 flex items-center gap-1.5 text-ink">
              <Phone aria-hidden="true" size={15} />
              Emergency contact: {emergency.patient.emergency_contact_name || "Not named"}{" "}
              <a href={`tel:${emergency.patient.emergency_contact_phone}`} className="link font-mono">
                {emergency.patient.emergency_contact_phone}
              </a>
            </p>
          )}
        </div>
      )}

      <div role="tablist" aria-label="Patient record" className="mt-6 inline-flex max-w-full gap-1 overflow-x-auto rounded-full border border-line bg-surface p-1">
        {TABS.map((t) => (
          <button
            key={t.value}
            type="button"
            role="tab"
            aria-selected={tab === t.value}
            onClick={() => openTab(t.value)}
            className={`whitespace-nowrap rounded-full px-4 py-2 text-sm font-semibold transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand ${
              tab === t.value ? "bg-deep text-deep-on" : "text-ink-soft hover:bg-inset hover:text-ink"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === "overview" && <DoctorOverview token={token} patientId={patientId} onOpenTest={openTest} />}
      {tab === "table" && <CumulativeTable token={token} patientId={patientId} />}
      {tab === "trends" && <DoctorTrends key={focusTest || "default"} token={token} patientId={patientId} focus={focusTest} />}

      {tab !== "reports" ? null : loading ? (
        <p className="mt-10 text-center text-muted">Loading...</p>
      ) : reports.length === 0 ? (
        <div className="card card-pad mt-6 text-center text-sm text-muted">
          No reports available for this patient.
        </div>
      ) : (
        <div className="card mt-6 overflow-x-auto">
          <table className="w-full text-sm">
            <caption className="sr-only">Approved reports for this patient</caption>
            <thead className="!bg-inset">
              <tr>
                {["Report", "Type", "Uploaded", "Source", "Actions"].map((h) => (
                  <th key={h} scope="col" className="px-5 py-3 text-left text-[13px] font-bold !text-muted">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {reports.map((report) => (
                <tr key={report.id}>
                  <td className="px-5 py-4">
                    <p className="font-bold text-ink">{report.original_filename || "Report"}</p>
                    {report.document_kind === "lab_report" && (
                      <p className="text-xs text-muted">
                        Lab report{report.collected_on ? ` · collected ${formatDay(report.collected_on)}` : ""}
                        {report.lab_name ? ` · ${report.lab_name}` : ""}
                      </p>
                    )}
                    {unreadThreads[report.id] > 0 && (
                      <span className="pill pill-brand mt-1">
                        <MessageCircleQuestion aria-hidden="true" size={14} />
                        New message
                      </span>
                    )}
                  </td>
                  <td className="px-5 py-4 capitalize text-ink-soft">{report.report_type?.replace(/_/g, " ") || "-"}</td>
                  <td className="px-5 py-4 text-ink-soft">
                    {report.uploaded_at || report.created_at
                      ? parseServerDate(report.uploaded_at || report.created_at).toLocaleDateString()
                      : "-"}
                  </td>
                  <td className="px-5 py-4">
                    <span className="pill pill-plain">{report.upload_source === "patient" ? "Patient" : "Medical center"}</span>
                  </td>
                  <td className="px-5 py-4">
                    <Link to={`/doctor/patients/${patientId}/reports/${report.id}/view`} className="btn btn-primary btn-sm">
                      View
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

export default PatientReports;
