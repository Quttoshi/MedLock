import { useEffect, useState } from "react";
import { useAuth } from "../../context/AuthContext";
import { getAdminMedicalCenters, approveMC, rejectMC } from "../../api/admin";
import FilterChips from "../../components/ui/FilterChips";
import StatusPill from "../../components/ui/StatusPill";
import { centerTypeLabel } from "../../constants/centerTypes";

const MC_FILTERS = ["all", "pending", "approved", "rejected"].map((f) => ({ value: f, label: f }));

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
    <div className="mx-auto max-w-6xl">
      <h1 className="display text-[28px] leading-[1.15] text-ink sm:text-[32px]">
        Medical <em>centers</em>
      </h1>
      <p className="mt-3 text-sm text-muted">Approve or reject medical center registrations.</p>

      <div className="mt-8">
        <FilterChips label="Filter by status" options={MC_FILTERS} value={filter} onChange={setFilter} />
      </div>

      {loading ? (
        <p className="mt-10 text-center text-muted">Loading...</p>
      ) : mcs.length === 0 ? (
        <div className="card card-pad mt-6 text-center text-sm text-muted">No medical centers found.</div>
      ) : (
        <div className="card mt-6 overflow-x-auto">
          <table className="w-full text-sm">
            <caption className="sr-only">Medical center registrations</caption>
            <thead className="!bg-inset">
              <tr>
                {["Name", "Email", "License", "Status", "Actions"].map((h) => (
                  <th key={h} scope="col" className="px-5 py-3 text-left text-[13px] font-bold !text-muted">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {mcs.map((mc) => (
                <tr key={mc.id}>
                  <td className="px-5 py-4">
                    <p className="font-bold text-ink">{mc.name}</p>
                    <span className="pill pill-plain mt-1">{centerTypeLabel(mc.center_type)}</span>
                  </td>
                  <td className="px-5 py-4 text-ink-soft">{mc.email}</td>
                  <td className="px-5 py-4 font-mono text-[13px] text-ink-soft">{mc.license_number || "-"}</td>
                  <td className="px-5 py-4">
                    <StatusPill tone={mc.is_approved ? "ok" : mc.rejection_reason ? "bad" : "warn"}>
                      {mc.is_approved ? "Approved" : mc.rejection_reason ? "Rejected" : "Pending"}
                    </StatusPill>
                  </td>
                  <td className="px-5 py-4">
                    <div className="flex gap-2">
                      {!mc.is_approved && (
                        <button
                          type="button"
                          onClick={() => handleApprove(mc.id)}
                          disabled={actionLoading === mc.id + "_approve"}
                          className="btn btn-primary btn-sm"
                        >
                          {actionLoading === mc.id + "_approve" ? "..." : "Approve"}
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => setRejectModal({ open: true, id: mc.id })}
                        className="btn btn-secondary btn-sm"
                      >
                        Reject
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Reject dialog */}
      {rejectModal.open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div role="dialog" aria-modal="true" aria-labelledby="reject-title" className="card card-lift w-full max-w-md p-6">
            <h2 id="reject-title" className="display text-xl text-ink">Reject medical center</h2>
            <p className="mt-1 text-sm text-muted">Please provide a reason for the rejection.</p>
            <label htmlFor="reject-reason" className="field-label mt-4">Reason</label>
            <textarea
              id="reject-reason"
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              rows={3}
              className="field resize-none"
            />
            <div className="mt-5 flex gap-3">
              <button
                type="button"
                onClick={() => { setRejectModal({ open: false, id: null }); setRejectReason(""); }}
                className="btn btn-secondary flex-1"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleReject}
                disabled={!rejectReason.trim() || actionLoading}
                className="btn btn-danger flex-1"
              >
                {actionLoading ? "Rejecting..." : "Confirm reject"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default MedicalCenters;
