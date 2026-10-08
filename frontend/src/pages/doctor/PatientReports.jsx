import { useEffect, useState } from "react";
import { useAuth } from "../../context/AuthContext";
import { getPatientReports, downloadReport } from "../../api/doctor";
import { useParams, Link } from "react-router-dom";
import { ArrowLeft, MessageCircleQuestion, Siren, Phone } from "lucide-react";
import { getActiveEmergencies } from "../../api/emergency";
import { useUnreadThreads } from "../../context/useUnreadThreads";
import { parseServerDate } from "../../utils/dates";

function PatientReports() {
  const { token } = useAuth();
  const { patientId } = useParams();
  const unreadThreads = useUnreadThreads(token);
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(true);
  const [downloading, setDownloading] = useState(null);
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

  const handleDownload = async (reportId, filename) => {
    setDownloading(reportId);
    try {
      const res = await downloadReport(token, patientId, reportId);
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const a = document.createElement("a");
      a.href = url;
      a.download = filename || "report";
      a.click();
      window.URL.revokeObjectURL(url);
    } catch {
      alert("Failed to download report.");
    }
    setDownloading(null);
  };

  return (
    <div className="mx-auto max-w-5xl">
      <Link to="/doctor/patients" className="link inline-flex items-center gap-2 text-sm no-underline hover:underline">
        <ArrowLeft aria-hidden="true" size={16} />
        Back to patients
      </Link>
      <h1 className="display mt-4 text-[28px] leading-[1.15] text-ink sm:text-[32px]">
        Patient <em>records</em>
      </h1>
      <p className="mt-3 text-sm text-muted">Approved medical records for this patient. Read only.</p>

      {emergency && (
        <div className="mt-5 rounded-2xl bg-bad-subtle p-4 text-sm text-bad-ink">
          <p className="flex items-center gap-2 font-bold">
            <Siren aria-hidden="true" size={18} />
            Emergency access for {emergency.patient.name} until{" "}
            {parseServerDate(emergency.expires_at).toLocaleString("en-PK", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
          </p>
          <p className="mt-1">Every report you open is recorded and the patient can see it.</p>
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

      {loading ? (
        <p className="mt-10 text-center text-muted">Loading...</p>
      ) : reports.length === 0 ? (
        <div className="card card-pad mt-8 text-center text-sm text-muted">
          No reports available for this patient.
        </div>
      ) : (
        <div className="card mt-8 overflow-x-auto">
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
