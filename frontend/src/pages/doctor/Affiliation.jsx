import { useState, useEffect, useRef, useCallback } from "react";
import { Building2, LogOut } from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import {
  searchMedicalCenters, requestAffiliation, getMyAffiliations, getMyMemberships, leaveAffiliation,
} from "../../api/doctor";
import DoctorVerificationCard from "../../components/DoctorVerificationCard";
import StatusPill from "../../components/ui/StatusPill";
import { centerTypeLabel } from "../../constants/centerTypes";
import { parseServerDate } from "../../utils/dates";

const formatDate = (value) =>
  parseServerDate(value).toLocaleDateString("en-PK", { day: "numeric", month: "short", year: "numeric" });

function Affiliation() {
  const { token } = useAuth();
  const [query, setQuery] = useState("");
  const [suggestions, setSuggestions] = useState([]);
  const [selected, setSelected] = useState(null);
  const [showDropdown, setShowDropdown] = useState(false);
  const [requests, setRequests] = useState([]);
  const [memberships, setMemberships] = useState([]);
  // Center whose leaving is being confirmed
  const [leaving, setLeaving] = useState(null);
  const [leaveBusy, setLeaveBusy] = useState(false);
  const [leaveError, setLeaveError] = useState("");
  // Bumped after leaving so the verification card reloads
  const [verificationKey, setVerificationKey] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState("");
  const [error, setError] = useState("");
  const debounceRef = useRef(null);
  const dropdownRef = useRef(null);

  const loadAffiliations = useCallback(() => {
    getMyAffiliations(token)
      .then((res) => setRequests(res.data))
      .catch(() => setRequests([]));
    getMyMemberships(token)
      .then((res) => setMemberships(res.data))
      .catch(() => setMemberships([]));
  }, [token]);

  useEffect(() => {
    loadAffiliations();
  }, [loadAffiliations]);

  useEffect(() => {
    const handler = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target))
        setShowDropdown(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const handleQueryChange = (e) => {
    const val = e.target.value;
    setQuery(val);
    setSelected(null);
    setError("");
    setSuccess("");
    clearTimeout(debounceRef.current);
    if (!val.trim()) { setSuggestions([]); setShowDropdown(false); return; }
    debounceRef.current = setTimeout(async () => {
      try {
        const res = await searchMedicalCenters(token, val.trim());
        setSuggestions(res.data);
        setShowDropdown(true);
      } catch {
        setSuggestions([]);
      }
    }, 300);
  };

  const handleSelect = (center) => {
    setSelected(center);
    setQuery(center.name);
    setShowDropdown(false);
    setSuggestions([]);
  };

  const alreadyRequested = () =>
    requests.some((r) => r.medical_center === selected?.name && r.status === "pending");

  const alreadyMember = () => memberships.some((m) => m.id === selected?.id);

  const handleLeave = async (center) => {
    setLeaveBusy(true);
    setLeaveError("");
    try {
      const res = await leaveAffiliation(token, center.id);
      setLeaving(null);
      setSuccess(
        res.data.is_verified
          ? `You left ${center.name}.`
          : `You left ${center.name}. You no longer belong to a medical center, so your verification has ended.`
      );
      loadAffiliations();
      setVerificationKey((k) => k + 1);
    } catch (e) {
      setLeaveError(e?.response?.data?.detail || "Could not leave this medical center.");
    }
    setLeaveBusy(false);
  };

  const handleSubmit = async () => {
    if (!selected) { setError("Please select a medical center."); return; }
    setSubmitting(true);
    setError("");
    setSuccess("");
    try {
      await requestAffiliation(token, { medical_center_id: selected.id });
      setSuccess(`Affiliation request sent to ${selected.name}.`);
      setSelected(null);
      setQuery("");
      loadAffiliations();
    } catch (e) {
      setError(e?.response?.data?.detail || "Request failed. Please try again.");
    }
    setSubmitting(false);
  };

  const TONE = { pending: "warn", approved: "ok", rejected: "bad" };

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <div>
        <h1 className="display text-[28px] leading-[1.15] text-ink sm:text-[32px]">
          Your <em>medical centers</em>
        </h1>
        <p className="mt-3 text-sm leading-6 text-muted">
          Join the hospitals and clinics you work at. You can belong to more than one, for example a hospital and
          your own clinic. Each center checks your license before approving you.
        </p>
      </div>

      <DoctorVerificationCard key={verificationKey} token={token} />

      {/* Current memberships */}
      <section className="card card-pad" aria-labelledby="memberships-heading">
        <h2 id="memberships-heading" className="display text-xl text-ink">My medical centers</h2>
        {memberships.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted">You do not belong to a medical center yet.</p>
        ) : (
          <ul className="mt-4 space-y-3">
            {memberships.map((m) => (
              <li key={m.id} className="card-inset px-4 py-3.5">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex min-w-0 items-center gap-3">
                    <span className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-brand-subtle text-brand">
                      <Building2 aria-hidden="true" size={18} />
                    </span>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-bold text-ink">{m.name}</p>
                      <p className="text-sm text-muted">
                        {centerTypeLabel(m.center_type)} · Joined {formatDate(m.joined_at)}
                      </p>
                    </div>
                  </div>
                  {leaving !== m.id && (
                    <button
                      type="button"
                      onClick={() => { setLeaving(m.id); setLeaveError(""); }}
                      className="btn btn-ghost btn-sm"
                    >
                      <LogOut aria-hidden="true" size={16} />
                      Leave
                    </button>
                  )}
                </div>
                {leaving === m.id && (
                  <div className="mt-3 space-y-2.5 border-t border-line pt-3">
                    <p className="text-sm leading-5 text-ink-soft">
                      Leave {m.name}? The center is notified. If it verified your license and you belong to no other
                      center, your verification ends.
                    </p>
                    {leaveError && <p role="alert" className="text-sm font-semibold text-bad-ink">{leaveError}</p>}
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => handleLeave(m)}
                        disabled={leaveBusy}
                        className="btn btn-danger btn-sm"
                      >
                        {leaveBusy ? "Leaving..." : "Leave center"}
                      </button>
                      <button type="button" onClick={() => setLeaving(null)} className="btn btn-ghost btn-sm">
                        Cancel
                      </button>
                    </div>
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Request form */}
      <section className="card card-pad">
        <h2 className="display text-xl text-ink">Join a hospital or clinic</h2>

        <div className="mt-4">
          <label htmlFor="center-search" className="field-label">Medical center</label>
          <div className="relative" ref={dropdownRef}>
            <input
              id="center-search"
              type="text"
              value={query}
              onChange={handleQueryChange}
              onFocus={() => suggestions.length > 0 && setShowDropdown(true)}
              placeholder="Type to search hospitals and clinics"
              autoComplete="off"
              className="field"
            />
            {showDropdown && suggestions.length > 0 && (
              <ul className="card card-lift absolute z-10 mt-1 w-full overflow-hidden">
                {suggestions.map((c) => (
                  <li key={c.id}>
                    <button
                      type="button"
                      onMouseDown={() => handleSelect(c)}
                      className="w-full px-4 py-3 text-left transition-colors hover:bg-inset"
                    >
                      <span className="block text-sm font-bold text-ink">{c.name}</span>
                      <span className="block text-sm text-muted">
                        {centerTypeLabel(c.center_type)}{c.address ? ` · ${c.address}` : ""}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        {error && <p role="alert" className="mt-4 rounded-xl bg-bad-subtle p-3.5 text-sm font-semibold text-bad-ink">{error}</p>}
        {success && <p role="status" className="mt-4 rounded-xl bg-ok-subtle p-3.5 text-sm font-semibold text-ok-ink">{success}</p>}

        <button
          type="button"
          onClick={handleSubmit}
          disabled={submitting || !selected || alreadyRequested() || alreadyMember()}
          className="btn btn-primary mt-5 w-full"
        >
          {submitting
            ? "Sending..."
            : alreadyMember()
            ? "Already a member"
            : alreadyRequested()
            ? "Already requested"
            : "Send affiliation request"}
        </button>
      </section>

      {/* My requests */}
      <section className="card card-pad">
        <h2 className="display text-xl text-ink">My affiliation requests</h2>
        {requests.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted">No affiliation requests yet.</p>
        ) : (
          <ul className="mt-4 space-y-3">
            {requests.map((req) => (
              <li key={req.id} className="card-inset flex flex-wrap items-center justify-between gap-3 px-4 py-3.5">
                <div>
                  <p className="text-sm font-bold text-ink">{req.medical_center}</p>
                  {req.rejection_reason && (
                    <p className="mt-0.5 text-sm font-semibold text-bad-ink">Rejected: {req.rejection_reason}</p>
                  )}
                  <p className="mt-0.5 text-sm text-muted">
                    {parseServerDate(req.requested_at).toLocaleDateString("en-PK", {
                      day: "numeric", month: "short", year: "numeric",
                    })}
                  </p>
                </div>
                <StatusPill tone={TONE[req.status] ?? "plain"}>
                  <span className="capitalize">{req.status}</span>
                </StatusPill>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

export default Affiliation;
