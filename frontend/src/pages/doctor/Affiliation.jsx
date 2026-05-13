import { useState, useEffect, useRef } from "react";
import { useAuth } from "../../context/AuthContext";
import { searchMedicalCenters, requestAffiliation, getMyAffiliations } from "../../api/doctor";

const statusColors = {
  pending: "bg-yellow-100 text-yellow-700",
  approved: "bg-green-100 text-green-700",
  rejected: "bg-red-100 text-red-700",
};

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

  return (
    <div className="max-w-3xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-800">Hospital Affiliation</h1>
        <p className="text-gray-500 text-sm mt-1">
          Request affiliation with a medical center. They will review your license and specialization.
        </p>
      </div>

      {/* Request Form */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 mb-5">
        <h2 className="text-base font-semibold text-gray-700 mb-4">New Affiliation Request</h2>

        <div className="mb-4">
          <label className="text-xs font-medium text-gray-500 mb-1 block">Medical Center</label>
          <div className="relative" ref={dropdownRef}>
            <input
              type="text"
              value={query}
              onChange={handleQueryChange}
              onFocus={() => suggestions.length > 0 && setShowDropdown(true)}
              placeholder="Type to search medical centers..."
              className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-300"
            />
            {showDropdown && suggestions.length > 0 && (
              <div className="absolute z-10 mt-1 w-full bg-white border border-gray-100 rounded-xl shadow-lg overflow-hidden">
                {suggestions.map((c) => (
                  <button
                    key={c.id}
                    onMouseDown={() => handleSelect(c)}
                    className="w-full text-left px-4 py-2.5 hover:bg-green-50 transition"
                  >
                    <p className="text-sm font-medium text-gray-800">{c.name}</p>
                    {c.address && <p className="text-xs text-gray-400">{c.address}</p>}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {error && (
          <p className="mb-3 text-sm text-red-600 bg-red-50 border border-red-100 rounded-xl px-4 py-2">{error}</p>
        )}
        {success && (
          <p className="mb-3 text-sm text-green-700 bg-green-50 border border-green-100 rounded-xl px-4 py-2">{success}</p>
        )}

        <button
          onClick={handleSubmit}
          disabled={submitting || !selected || alreadyRequested()}
          className="w-full py-2.5 bg-green-600 text-white text-sm font-medium rounded-xl hover:bg-green-700 transition disabled:opacity-50"
        >
          {submitting ? "Sending..." : alreadyRequested() ? "Already Requested" : "Send Affiliation Request"}
        </button>
      </div>

      {/* My Requests */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
        <h2 className="text-base font-semibold text-gray-700 mb-4">My Affiliation Requests</h2>
        {requests.length === 0 ? (
          <p className="text-sm text-gray-400 text-center py-6">No affiliation requests yet.</p>
        ) : (
          <div className="space-y-3">
            {requests.map((req) => (
              <div key={req.id} className="flex items-center justify-between bg-gray-50 rounded-xl px-4 py-3">
                <div>
                  <p className="text-sm font-semibold text-gray-800">{req.medical_center}</p>
                  {req.rejection_reason && (
                    <p className="text-xs text-red-500 mt-0.5">Rejected: {req.rejection_reason}</p>
                  )}
                  <p className="text-xs text-gray-400 mt-0.5">
                    {new Date(req.requested_at).toLocaleDateString("en-PK", {
                      day: "numeric", month: "short", year: "numeric",
                    })}
                  </p>
                </div>
                <span className={`text-xs font-semibold px-2.5 py-1 rounded-full capitalize ${statusColors[req.status] || "bg-gray-100 text-gray-600"}`}>
                  {req.status}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default Affiliation;
