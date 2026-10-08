import { useState, useEffect, useRef } from "react";
import { useAuth } from "../../context/AuthContext";
import { searchMedicalCenters, requestAffiliation, getMyAffiliations } from "../../api/doctor";
import DoctorVerificationCard from "../../components/DoctorVerificationCard";
import StatusPill from "../../components/ui/StatusPill";

function Affiliation() {
  const { token } = useAuth();
  const [query, setQuery] = useState("");
  const [suggestions, setSuggestions] = useState([]);
  const [selected, setSelected] = useState(null);
  const [showDropdown, setShowDropdown] = useState(false);
  const [requests, setRequests] = useState([]);
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState("");
  const [error, setError] = useState("");
  const debounceRef = useRef(null);
  const dropdownRef = useRef(null);

  useEffect(() => {
    getMyAffiliations(token)
      .then((res) => setRequests(res.data))
      .catch(() => setRequests([]));
  }, [token]);

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
      const res = await getMyAffiliations(token);
      setRequests(res.data);
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
          Hospital <em>affiliation</em>
        </h1>
        <p className="mt-3 text-sm leading-6 text-muted">
          Request affiliation with a medical center. They will review your license and specialization.
        </p>
      </div>

      <DoctorVerificationCard token={token} />

      {/* Request form */}
      <section className="card card-pad">
        <h2 className="display text-xl text-ink">New affiliation request</h2>

        <div className="mt-4">
          <label htmlFor="center-search" className="field-label">Medical center</label>
          <div className="relative" ref={dropdownRef}>
            <input
              id="center-search"
              type="text"
              value={query}
              onChange={handleQueryChange}
              onFocus={() => suggestions.length > 0 && setShowDropdown(true)}
              placeholder="Type to search medical centers"
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
                      {c.address && <span className="block text-sm text-muted">{c.address}</span>}
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
          disabled={submitting || !selected || alreadyRequested()}
          className="btn btn-primary mt-5 w-full"
        >
          {submitting ? "Sending..." : alreadyRequested() ? "Already requested" : "Send affiliation request"}
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
                    {new Date(req.requested_at).toLocaleDateString("en-PK", {
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
