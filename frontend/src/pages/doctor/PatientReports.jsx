import { useEffect, useState } from "react";
import { useAuth } from "../../context/AuthContext";
import { getPatientReports, downloadReport } from "../../api/doctor";
import { useParams, useNavigate } from "react-router-dom";

function PatientReports() {
  const { token } = useAuth();
  const { patientId } = useParams();
  const navigate = useNavigate();
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(true);
  const [downloading, setDownloading] = useState(null);

  useEffect(() => {
    getPatientReports(token, patientId)
      .then((res) => setReports(res.data))
      .catch(() => setReports([]))
      .finally(() => setLoading(false));
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
    <div className="max-w-6xl mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <button
          onClick={() => navigate("/doctor/patients")}
          className="p-2 rounded-xl hover:bg-gray-100 text-gray-500 transition"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Patient Reports</h1>
          <p className="text-gray-500 text-sm mt-0.5">Approved medical records for this patient.</p>
        </div>
      </div>

      {loading ? (
        <div className="p-10 text-center text-gray-400 text-sm">Loading...</div>
      ) : reports.length === 0 ? (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-10 text-center">
          <p className="text-gray-500 text-sm">No reports available for this patient.</p>
        </div>
      ) : (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-100">
              <tr>
                <th className="text-left px-5 py-3 text-gray-500 font-medium">Report Name</th>
                <th className="text-left px-5 py-3 text-gray-500 font-medium">Type</th>
                <th className="text-left px-5 py-3 text-gray-500 font-medium">Uploaded</th>
                <th className="text-left px-5 py-3 text-gray-500 font-medium">Source</th>
                <th className="text-left px-5 py-3 text-gray-500 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {reports.map((report) => (
                <tr key={report.id} className="hover:bg-gray-50 transition">
                  <td className="px-5 py-4 font-medium text-gray-800">
                    {report.original_filename || "Report"}
                  </td>
                  <td className="px-5 py-4 text-gray-500 capitalize">
                    {report.report_type || "—"}
                  </td>
                  <td className="px-5 py-4 text-gray-500">
                    {report.created_at
                      ? new Date(report.created_at).toLocaleDateString()
                      : "—"}
                  </td>
                  <td className="px-5 py-4">
                    <span className={`px-2.5 py-1 rounded-full text-xs font-semibold
                      ${report.upload_source === "patient"
                        ? "bg-blue-100 text-blue-700"
                        : "bg-purple-100 text-purple-700"
                      }`}>
                      {report.upload_source === "patient" ? "Patient" : "Medical Center"}
                    </span>
                  </td>
                  <td className="px-5 py-4">
                    <button
  onClick={() => navigate(`/doctor/patients/${patientId}/reports/${report.id}/view`)}
  className="px-3 py-1.5 bg-green-600 text-white text-xs rounded-lg hover:bg-green-700 transition"
>
  View
</button>
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