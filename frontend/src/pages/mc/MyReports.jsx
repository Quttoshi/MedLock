import { useEffect, useState } from "react";
import { useAuth } from "../../context/AuthContext";
import { getMCReports } from "../../api/medicalCenter";

function MCMyReports() {
  const { token } = useAuth();
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("all");

  useEffect(() => {
    getMCReports(token)
      .then((res) => setReports(res.data))
      .catch(() => setReports([]))
      .finally(() => setLoading(false));
  }, [token]);

  const filtered = filter === "all"
    ? reports
    : filter === "approved"
    ? reports.filter((r) => r.is_approved)
    : reports.filter((r) => !r.is_approved);

  return (
    <div className="max-w-6xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-800">My Reports</h1>
        <p className="text-gray-500 text-sm mt-1">
          All diagnostic reports uploaded by your medical center.
        </p>
      </div>

      {/* Filter */}
      <div className="flex gap-2 mb-6">
        {["all", "approved", "pending"].map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-4 py-2 rounded-xl text-sm font-medium transition
              ${filter === f
                ? "bg-purple-600 text-white shadow-sm"
                : "bg-white text-gray-600 border border-gray-200 hover:bg-gray-50"
              }`}
          >
            {f.charAt(0).toUpperCase() + f.slice(1)}
          </button>
        ))}
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        {loading ? (
          <div className="p-10 text-center text-gray-400 text-sm">Loading...</div>
        ) : filtered.length === 0 ? (
          <div className="p-10 text-center text-gray-400 text-sm">No reports found.</div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-100">
              <tr>
                <th className="text-left px-5 py-3 text-gray-500 font-medium">File Name</th>
                <th className="text-left px-5 py-3 text-gray-500 font-medium">Report Type</th>
                <th className="text-left px-5 py-3 text-gray-500 font-medium">Patient</th>
                <th className="text-left px-5 py-3 text-gray-500 font-medium">Uploaded</th>
                <th className="text-left px-5 py-3 text-gray-500 font-medium">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {filtered.map((report) => (
                <tr key={report.id} className="hover:bg-gray-50 transition">
                  <td className="px-5 py-4 font-medium text-gray-800">
                    {report.original_filename || "Report"}
                  </td>
                  <td className="px-5 py-4 text-gray-500 capitalize">
                    {report.report_type?.replace(/_/g, " ") || "—"}
                  </td>
                  <td className="px-5 py-4 text-gray-500">
                    {report.patient_name || report.patient_email || "—"}
                  </td>
                  <td className="px-5 py-4 text-gray-500">
                    {report.created_at
                      ? new Date(report.created_at).toLocaleDateString()
                      : "—"}
                  </td>
                  <td className="px-5 py-4">
                    <span className={`px-2.5 py-1 rounded-full text-xs font-semibold
                      ${report.is_approved
                        ? "bg-green-100 text-green-700"
                        : "bg-yellow-100 text-yellow-700"
                      }`}>
                      {report.is_approved ? "Approved" : "Pending Approval"}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

export default MCMyReports;