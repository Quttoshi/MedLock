import { useEffect, useState } from "react";
import { useAuth } from "../../context/AuthContext";
import { getAdminDoctors, verifyDoctor, unverifyDoctor } from "../../api/admin";

function Doctors() {
  const { token } = useAuth();
  const [doctors, setDoctors] = useState([]);
  const [filter, setFilter] = useState("all");
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(null);

  const fetchDoctors = () => {
    setLoading(true);
    const verified = filter === "verified" ? true : filter === "unverified" ? false : "";
    getAdminDoctors(token, verified)
      .then((res) => setDoctors(res.data))
      .catch(() => setDoctors([]))
      .finally(() => setLoading(false));
  };

  useEffect(() => { fetchDoctors(); }, [token, filter]);

  const handleVerify = async (id) => {
    setActionLoading(id + "_verify");
    try { await verifyDoctor(token, id); fetchDoctors(); } catch {}
    setActionLoading(null);
  };

  const handleUnverify = async (id) => {
    setActionLoading(id + "_unverify");
    try { await unverifyDoctor(token, id); fetchDoctors(); } catch {}
    setActionLoading(null);
  };

  return (
    <div className="max-w-6xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-800">Doctors</h1>
        <p className="text-gray-500 text-sm mt-1">Verify or unverify doctor accounts.</p>
      </div>

      {/* Filter */}
      <div className="flex gap-2 mb-6">
        {["all", "verified", "unverified"].map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-4 py-2 rounded-xl text-sm font-medium transition
              ${filter === f
                ? "bg-red-600 text-white shadow-sm"
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
        ) : doctors.length === 0 ? (
          <div className="p-10 text-center text-gray-400 text-sm">No doctors found.</div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-100">
              <tr>
                <th className="text-left px-5 py-3 text-gray-500 font-medium">Name</th>
                <th className="text-left px-5 py-3 text-gray-500 font-medium">Email</th>
                <th className="text-left px-5 py-3 text-gray-500 font-medium">Specialization</th>
                <th className="text-left px-5 py-3 text-gray-500 font-medium">License</th>
                <th className="text-left px-5 py-3 text-gray-500 font-medium">Status</th>
                <th className="text-left px-5 py-3 text-gray-500 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {doctors.map((doc) => (
                <tr key={doc.id} className="hover:bg-gray-50 transition">
                  <td className="px-5 py-4 font-medium text-gray-800">{doc.name}</td>
                  <td className="px-5 py-4 text-gray-500">{doc.email}</td>
                  <td className="px-5 py-4 text-gray-500">{doc.specialization || "—"}</td>
                  <td className="px-5 py-4 text-gray-500">{doc.license_number || "—"}</td>
                  <td className="px-5 py-4">
                    <span className={`px-2.5 py-1 rounded-full text-xs font-semibold
                      ${doc.is_verified
                        ? "bg-green-100 text-green-700"
                        : "bg-yellow-100 text-yellow-700"
                      }`}>
                      {doc.is_verified ? "Verified" : "Unverified"}
                    </span>
                  </td>
                  <td className="px-5 py-4">
                    {doc.is_verified ? (
                      <button
                        onClick={() => handleUnverify(doc.id)}
                        disabled={actionLoading === doc.id + "_unverify"}
                        className="px-3 py-1.5 bg-yellow-100 text-yellow-700 text-xs rounded-lg hover:bg-yellow-200 transition disabled:opacity-50"
                      >
                        {actionLoading === doc.id + "_unverify" ? "..." : "Unverify"}
                      </button>
                    ) : (
                      <button
                        onClick={() => handleVerify(doc.id)}
                        disabled={actionLoading === doc.id + "_verify"}
                        className="px-3 py-1.5 bg-green-600 text-white text-xs rounded-lg hover:bg-green-700 transition disabled:opacity-50"
                      >
                        {actionLoading === doc.id + "_verify" ? "..." : "Verify"}
                      </button>
                    )}
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

export default Doctors;