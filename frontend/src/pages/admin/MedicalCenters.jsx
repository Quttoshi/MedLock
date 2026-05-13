import { useEffect, useState } from "react";
import { useAuth } from "../../context/AuthContext";
import { getAdminMedicalCenters, approveMC, rejectMC } from "../../api/admin";

function MedicalCenters() {
  const { token } = useAuth();
  const [mcs, setMcs] = useState([]);
  const [filter, setFilter] = useState("all");
  const [loading, setLoading] = useState(true);
  const [rejectModal, setRejectModal] = useState({ open: false, id: null });
  const [rejectReason, setRejectReason] = useState("");
  const [actionLoading, setActionLoading] = useState(null);

  const fetchMCs = () => {
    setLoading(true);
    const approved = filter === "approved" ? true : filter === "pending" || filter === "rejected" ? false : "";
    getAdminMedicalCenters(token, approved)
      .then((res) => {
        let data = res.data;
        if (filter === "pending") data = data.filter((mc) => !mc.rejection_reason);
        if (filter === "rejected") data = data.filter((mc) => mc.rejection_reason);
        setMcs(data);
      })
      .catch(() => setMcs([]))
      .finally(() => setLoading(false));
  };

  useEffect(() => { fetchMCs(); }, [token, filter]);

  const handleApprove = async (id) => {
    setActionLoading(id + "_approve");
    try {
      await approveMC(token, id);
      fetchMCs();
    } catch {}
    setActionLoading(null);
  };

  const handleReject = async () => {
    if (!rejectReason.trim()) return;
    setActionLoading(rejectModal.id + "_reject");
    try {
      await rejectMC(token, rejectModal.id, rejectReason);
      setRejectModal({ open: false, id: null });
      setRejectReason("");
      fetchMCs();
    } catch {}
    setActionLoading(null);
  };

  return (
    <div className="max-w-6xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-800">Medical Centers</h1>
        <p className="text-gray-500 text-sm mt-1">Approve or reject Medical Center registrations.</p>
      </div>

      {/* Filter */}
      <div className="flex gap-2 mb-6">
        {["all", "pending", "approved", "rejected"].map((f) => (
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

      {/* Table */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        {loading ? (
          <div className="p-10 text-center text-gray-400 text-sm">Loading...</div>
        ) : mcs.length === 0 ? (
          <div className="p-10 text-center text-gray-400 text-sm">No medical centers found.</div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-100">
              <tr>
                <th className="text-left px-5 py-3 text-gray-500 font-medium">Name</th>
                <th className="text-left px-5 py-3 text-gray-500 font-medium">Email</th>
                <th className="text-left px-5 py-3 text-gray-500 font-medium">License</th>
                <th className="text-left px-5 py-3 text-gray-500 font-medium">Status</th>
                <th className="text-left px-5 py-3 text-gray-500 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {mcs.map((mc) => (
                <tr key={mc.id} className="hover:bg-gray-50 transition">
                  <td className="px-5 py-4 font-medium text-gray-800">{mc.name}</td>
                  <td className="px-5 py-4 text-gray-500">{mc.email}</td>
                  <td className="px-5 py-4 text-gray-500">{mc.license_number || "—"}</td>
                  <td className="px-5 py-4">
                    <span className={`px-2.5 py-1 rounded-full text-xs font-semibold
                      ${mc.is_approved
                        ? "bg-green-100 text-green-700"
                        : mc.rejection_reason
                        ? "bg-red-100 text-red-700"
                        : "bg-yellow-100 text-yellow-700"
                      }`}>
                      {mc.is_approved ? "Approved" : mc.rejection_reason ? "Rejected" : "Pending"}
                    </span>
                  </td>
                  <td className="px-5 py-4">
                    <div className="flex gap-2">
                      {!mc.is_approved && (
                        <button
                          onClick={() => handleApprove(mc.id)}
                          disabled={actionLoading === mc.id + "_approve"}
                          className="px-3 py-1.5 bg-green-600 text-white text-xs rounded-lg hover:bg-green-700 transition disabled:opacity-50"
                        >
                          {actionLoading === mc.id + "_approve" ? "..." : "Approve"}
                        </button>
                      )}
                      <button
                        onClick={() => setRejectModal({ open: true, id: mc.id })}
                        className="px-3 py-1.5 bg-red-100 text-red-600 text-xs rounded-lg hover:bg-red-200 transition"
                      >
                        Reject
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Reject Modal */}
      {rejectModal.open && (
        <div className="fixed inset-0 bg-black bg-opacity-40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl p-6 w-full max-w-md">
            <h3 className="text-lg font-bold text-gray-800 mb-2">Reject Medical Center</h3>
            <p className="text-sm text-gray-500 mb-4">Please provide a reason for rejection.</p>
            <textarea
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              rows={3}
              placeholder="Enter rejection reason..."
              className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-red-300 resize-none"
            />
            <div className="flex gap-3 mt-4">
              <button
                onClick={() => { setRejectModal({ open: false, id: null }); setRejectReason(""); }}
                className="flex-1 px-4 py-2.5 border border-gray-200 rounded-xl text-sm text-gray-600 hover:bg-gray-50 transition"
              >
                Cancel
              </button>
              <button
                onClick={handleReject}
                disabled={!rejectReason.trim() || actionLoading}
                className="flex-1 px-4 py-2.5 bg-red-600 text-white rounded-xl text-sm font-medium hover:bg-red-700 transition disabled:opacity-50"
              >
                {actionLoading ? "Rejecting..." : "Confirm Reject"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default MedicalCenters;