import { useCallback, useEffect, useState } from "react";
import { ExternalLink, AlertTriangle } from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import { getAdminMedicalCenters, approveMC, rejectMC } from "../../api/admin";
import FilterChips from "../../components/ui/FilterChips";
import StatusPill from "../../components/ui/StatusPill";
import { centerTypeLabel } from "../../constants/centerTypes";
import { regulatorLabel } from "../../constants/regulators";
import { parseServerDate } from "../../utils/dates";

const MC_FILTERS = ["all", "pending", "approved", "rejected"].map((f) => ({ value: f, label: f }));
const STATUS = {
  approved: { tone: "ok", label: "Approved" },
  rejected: { tone: "bad", label: "Rejected" },
  pending: { tone: "warn", label: "Pending" },
};

const formatDate = (value) =>
  value ? parseServerDate(value).toLocaleDateString("en-PK", { day: "numeric", month: "short", year: "numeric" }) : "-";

const errorText = (err, fallback) => {
  const detail = err?.response?.data?.detail;
  return typeof detail === "string" ? detail : fallback;
};

// What the admin checks before approving: the licence on the regulator's register, and
// that the registrant really is that establishment.
function LicenceChecklist({ mc }) {
  return (
    <ul className="mt-3 list-disc space-y-1.5 pl-5 text-sm leading-6 text-ink-soft">
      <li>
        Look up licence <span className="font-mono">{mc.license_number}</span> on the{" "}
        {mc.regulator_url ? (
          <a href={mc.regulator_url} target="_blank" rel="noopener noreferrer" className="link inline-flex items-center gap-1">
            {mc.regulator} register
            <ExternalLink aria-hidden="true" size={13} />
          </a>
        ) : (
          `${mc.regulator} register`
        )}{" "}
        and check that the name ({mc.name}) and address match and the licence is valid.
      </li>
      <li>
        Confirm the registrant represents the center:{" "}
        {mc.free_email
          ? "they used a free email address, so phone the center on the number listed by the regulator or its website."
          : `their email is on the ${mc.email_domain} domain; check it belongs to the center, or phone the center to confirm.`}
      </li>
    </ul>
  );
}

function MedicalCenters() {
  const { token } = useAuth();
  const [mcs, setMcs] = useState([]);
  const [filter, setFilter] = useState("all");
  const [loading, setLoading] = useState(true);
  const [approving, setApproving] = useState(null);
  const [expiry, setExpiry] = useState("");
  const [note, setNote] = useState("");
  const [rejecting, setRejecting] = useState(null);
  const [rejectReason, setRejectReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [dialogError, setDialogError] = useState("");

  const fetchMCs = useCallback(() => {
    const approved = filter === "approved" ? true : filter === "pending" || filter === "rejected" ? false : "";
    return getAdminMedicalCenters(token, approved)
      .then((res) => {
        const data = filter === "pending" || filter === "rejected" ? res.data.filter((mc) => mc.status === filter) : res.data;
        setMcs(data);
      })
      .catch(() => setMcs([]))
      .finally(() => setLoading(false));
  }, [token, filter]);

  useEffect(() => {
    fetchMCs();
  }, [fetchMCs]);

  const openApprove = (mc) => {
    setApproving(mc);
    setExpiry(mc.license_expires_at || "");
    setNote("");
    setDialogError("");
  };

  const handleApprove = async () => {
    setBusy(true);
    setDialogError("");
    try {
      await approveMC(token, approving.id, expiry, note.trim());
      setApproving(null);
      await fetchMCs();
    } catch (err) {
      setDialogError(errorText(err, "Could not approve this center."));
    }
    setBusy(false);
  };

  const handleReject = async () => {
    setBusy(true);
    setDialogError("");
    try {
      await rejectMC(token, rejecting.id, rejectReason.trim());
      setRejecting(null);
      setRejectReason("");
      await fetchMCs();
    } catch (err) {
      setDialogError(errorText(err, "Could not reject this center."));
    }
    setBusy(false);
  };

  return (
    <div className="mx-auto max-w-6xl">
      <h1 className="display text-[28px] leading-[1.15] text-ink sm:text-[32px]">
        Medical <em>centers</em>
      </h1>
      <p className="mt-3 max-w-2xl text-sm leading-6 text-muted">
        Approve a hospital, clinic or lab only after checking its licence on its provincial regulator's register and
        confirming the registrant represents it.
      </p>

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
                {["Center", "Licence", "Status", "Actions"].map((h) => (
                  <th key={h} scope="col" className="px-5 py-3 text-left text-[13px] font-bold !text-muted">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {mcs.map((mc) => {
                const state = STATUS[mc.status] ?? STATUS.pending;
                return (
                  <tr key={mc.id} className="align-top">
                    <td className="px-5 py-4">
                      <p className="font-bold text-ink">{mc.name}</p>
                      <span className="pill pill-plain mt-1">{centerTypeLabel(mc.center_type)}</span>
                      <p className="mt-1.5 text-ink-soft">{mc.email}</p>
                      {mc.free_email && (
                        <p className="mt-1 flex items-center gap-1.5 text-[13px] font-semibold text-warn-ink">
                          <AlertTriangle aria-hidden="true" size={14} />
                          Free email provider
                        </p>
                      )}
                      <p className="mt-1 text-[13px] text-muted">{mc.address}</p>
                    </td>
                    <td className="px-5 py-4">
                      {mc.regulator ? (
                        <>
                          <p className="font-bold text-ink">{mc.regulator}</p>
                          <p className="font-mono text-[13px] text-ink-soft">{mc.license_number}</p>
                          <p className="text-[13px] text-muted">Valid until {formatDate(mc.license_expires_at)}</p>
                          {mc.regulator_url && (
                            <a
                              href={mc.regulator_url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="link mt-1 inline-flex items-center gap-1 text-[13px]"
                            >
                              Check on register
                              <ExternalLink aria-hidden="true" size={13} />
                            </a>
                          )}
                        </>
                      ) : (
                        <>
                          <p className="font-mono text-[13px] text-ink-soft">{mc.license_number}</p>
                          <p className="text-[13px] text-muted">No regulator given</p>
                        </>
                      )}
                    </td>
                    <td className="px-5 py-4">
                      <StatusPill tone={state.tone}>{state.label}</StatusPill>
                      {mc.licence_label && <p className="mt-1.5 text-[13px] text-muted">{mc.licence_label}</p>}
                      {mc.verification_note && (
                        <p className="mt-1 text-[13px] text-muted">Checked: {mc.verification_note}</p>
                      )}
                      {mc.status === "rejected" && mc.rejection_reason && (
                        <p className="mt-1 text-[13px] text-bad-ink">{mc.rejection_reason}</p>
                      )}
                    </td>
                    <td className="px-5 py-4">
                      <div className="flex gap-2">
                        {mc.status === "pending" && mc.regulator && (
                          <button type="button" onClick={() => openApprove(mc)} className="btn btn-primary btn-sm">
                            Check &amp; approve
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => { setRejecting(mc); setRejectReason(""); setDialogError(""); }}
                          className="btn btn-secondary btn-sm"
                        >
                          Reject
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Approve dialog */}
      {approving && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div role="dialog" aria-modal="true" aria-labelledby="approve-title" className="card card-lift w-full max-w-lg p-6">
            <h2 id="approve-title" className="display text-xl text-ink">Approve {approving.name}</h2>
            <p className="mt-1 text-sm text-muted">{regulatorLabel(approving.regulator)}</p>
            <LicenceChecklist mc={approving} />
            <label htmlFor="approve-expiry" className="field-label mt-5">Licence valid until (from the register)</label>
            <input
              id="approve-expiry"
              type="date"
              value={expiry}
              onChange={(e) => setExpiry(e.target.value)}
              className="field"
            />
            <label htmlFor="approve-note" className="field-label mt-4">How you checked</label>
            <textarea
              id="approve-note"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={2}
              placeholder="e.g. PHC portal - name and address match; phoned reception"
              className="field resize-none"
            />
            {dialogError && <p role="alert" className="mt-3 text-sm font-semibold text-bad-ink">{dialogError}</p>}
            <div className="mt-5 flex gap-3">
              <button type="button" onClick={() => setApproving(null)} className="btn btn-secondary flex-1">
                Cancel
              </button>
              <button
                type="button"
                onClick={handleApprove}
                disabled={busy || !expiry || !note.trim()}
                className="btn btn-primary flex-1"
              >
                {busy ? "Approving..." : "Approve center"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Reject dialog */}
      {rejecting && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div role="dialog" aria-modal="true" aria-labelledby="reject-title" className="card card-lift w-full max-w-md p-6">
            <h2 id="reject-title" className="display text-xl text-ink">Reject {rejecting.name}</h2>
            <p className="mt-1 text-sm text-muted">
              The center sees this reason and can correct its licence details and resubmit.
            </p>
            <label htmlFor="reject-reason" className="field-label mt-4">Reason</label>
            <textarea
              id="reject-reason"
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              rows={3}
              className="field resize-none"
            />
            {dialogError && <p role="alert" className="mt-3 text-sm font-semibold text-bad-ink">{dialogError}</p>}
            <div className="mt-5 flex gap-3">
              <button type="button" onClick={() => setRejecting(null)} className="btn btn-secondary flex-1">
                Cancel
              </button>
              <button
                type="button"
                onClick={handleReject}
                disabled={!rejectReason.trim() || busy}
                className="btn btn-danger flex-1"
              >
                {busy ? "Rejecting..." : "Confirm reject"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default MedicalCenters;
