import { useEffect, useMemo, useRef, useState } from "react";
import { Building2, Search, ShieldCheck, X } from "lucide-react";
import { getShareCenters, searchDoctorsToShare, shareRecords } from "../api/accessRequests";
import { doctorLabel, initials } from "../adapters/patientStory";
import { centerTypeLabel } from "../constants/centerTypes";

const MIN_QUERY = 3;
const MAX_NOTE = 300;

const ACCESS_NOTE = {
  approved: "Already has access",
  pending: "Has asked for access",
};

// "cardiology", "Cardiology " and "CARDIOLOGY" are the same specialty.
const specialtyKey = (value) => (value || "").trim().toLowerCase();
const specialtyLabel = (value) => (value || "").trim().replace(/\b\w/g, (c) => c.toUpperCase());

function DoctorResults({ doctors, onPick, emptyText }) {
  if (doctors.length === 0) return <p className="mt-3 text-sm text-muted">{emptyText}</p>;
  return (
    <ul className="mt-3 max-h-72 space-y-2 overflow-y-auto">
      {doctors.map((d) => {
        const blocked = d.access_status === "approved";
        return (
          <li key={d.id}>
            <button
              type="button"
              onClick={() => onPick(d)}
              disabled={blocked}
              className="card-inset flex w-full items-start gap-3 px-4 py-3 text-left transition-colors hover:bg-inset disabled:cursor-not-allowed disabled:opacity-60"
            >
              <span aria-hidden="true" className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-brand-subtle text-sm font-bold text-brand">
                {initials(d.name)}
              </span>
              <span className="min-w-0">
                <span className="block text-sm font-bold text-ink">{doctorLabel(d.name)}</span>
                <span className="block text-sm text-muted">{specialtyLabel(d.specialization)}</span>
                {d.medical_centers.length > 0 && (
                  <span className="block text-[13px] text-muted">{d.medical_centers.join(", ")}</span>
                )}
                <span className="mt-0.5 flex items-center gap-1 text-[13px] font-semibold text-ok-ink">
                  <ShieldCheck aria-hidden="true" size={13} />
                  {d.verification_label}
                </span>
                {ACCESS_NOTE[d.access_status] && (
                  <span className="mt-0.5 block text-[13px] font-semibold text-warn-ink">{ACCESS_NOTE[d.access_status]}</span>
                )}
              </span>
            </button>
          </li>
        );
      })}
    </ul>
  );
}

// Pick the hospital or clinic, then narrow its doctors by specialty and name.
function FindByHospital({ token, onPick }) {
  const [centers, setCenters] = useState([]);
  const [centerQuery, setCenterQuery] = useState("");
  const [center, setCenter] = useState(null);
  const [doctors, setDoctors] = useState(null);
  const [specialty, setSpecialty] = useState("");
  const [name, setName] = useState("");

  useEffect(() => {
    getShareCenters(token)
      .then((res) => setCenters(res.data))
      .catch(() => setCenters([]));
  }, [token]);

  useEffect(() => {
    if (!center) return;
    searchDoctorsToShare(token, "", center.id)
      .then((res) => setDoctors(res.data))
      .catch(() => setDoctors([]));
  }, [token, center]);

  const pickCenter = (c) => {
    setCenter(c);
    setDoctors(null);
    setSpecialty("");
    setName("");
  };

  const specialties = useMemo(() => {
    const seen = new Map();
    for (const d of doctors ?? []) {
      const key = specialtyKey(d.specialization);
      if (key && !seen.has(key)) seen.set(key, specialtyLabel(d.specialization));
    }
    return [...seen.entries()].sort((a, b) => a[1].localeCompare(b[1]));
  }, [doctors]);

  if (!center) {
    const term = centerQuery.trim().toLowerCase();
    const matches = centers.filter(
      (c) => !term || c.name.toLowerCase().includes(term) || (c.address || "").toLowerCase().includes(term)
    );
    return (
      <>
        <label htmlFor="share-center" className="field-label mt-4">Hospital or clinic your doctor works at</label>
        <div className="relative">
          <Search aria-hidden="true" size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
          <input
            id="share-center"
            type="search"
            value={centerQuery}
            onChange={(e) => setCenterQuery(e.target.value)}
            placeholder="e.g. Shifa International"
            autoComplete="off"
            className="field pl-9"
          />
        </div>
        {matches.length === 0 ? (
          <p className="mt-3 text-sm text-muted">No hospital or clinic on MedLock matches that name.</p>
        ) : (
          <ul className="mt-3 max-h-64 space-y-1.5 overflow-y-auto">
            {matches.map((c) => (
              <li key={c.id}>
                <button
                  type="button"
                  onClick={() => pickCenter(c)}
                  className="card-inset flex w-full items-center gap-3 px-4 py-2.5 text-left transition-colors hover:bg-inset"
                >
                  <Building2 aria-hidden="true" size={18} className="flex-shrink-0 text-brand" />
                  <span className="min-w-0">
                    <span className="block text-sm font-bold text-ink">{c.name}</span>
                    <span className="block truncate text-[13px] text-muted">
                      {centerTypeLabel(c.center_type)}{c.address ? ` · ${c.address}` : ""}
                    </span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </>
    );
  }

  const term = name.trim().toLowerCase();
  const shown = (doctors ?? []).filter(
    (d) => (!specialty || specialtyKey(d.specialization) === specialty) && (!term || (d.name || "").toLowerCase().includes(term))
  );

  return (
    <>
      <div className="card-inset mt-4 flex items-center gap-3 px-4 py-2.5">
        <Building2 aria-hidden="true" size={18} className="flex-shrink-0 text-brand" />
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-bold text-ink">{center.name}</span>
          <span className="block text-[13px] text-muted">{centerTypeLabel(center.center_type)}</span>
        </span>
        <button type="button" onClick={() => setCenter(null)} className="btn btn-ghost btn-sm">Change</button>
      </div>

      {doctors === null ? (
        <p className="mt-3 text-sm text-muted">Loading doctors...</p>
      ) : doctors.length === 0 ? (
        <p className="mt-3 text-sm text-muted">No verified doctors at {center.name} are on MedLock yet.</p>
      ) : (
        <>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <div>
              <label htmlFor="share-specialty" className="field-label">Specialty</label>
              <select id="share-specialty" value={specialty} onChange={(e) => setSpecialty(e.target.value)} className="field">
                <option value="">All specialties</option>
                {specialties.map(([key, label]) => (
                  <option key={key} value={key}>{label}</option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="share-name" className="field-label">Doctor's name</label>
              <input
                id="share-name"
                type="search"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Optional"
                autoComplete="off"
                className="field"
              />
            </div>
          </div>
          <DoctorResults doctors={shown} onPick={onPick} emptyText="No doctor here matches that specialty and name." />
        </>
      )}
    </>
  );
}

// Search all verified doctors by name (a PMDC number also works, if the patient has one).
function FindByName({ token, onPick }) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const debounce = useRef(null);

  useEffect(() => {
    clearTimeout(debounce.current);
    if (query.trim().length < MIN_QUERY) return undefined;
    debounce.current = setTimeout(() => {
      setSearching(true);
      searchDoctorsToShare(token, query.trim())
        .then((res) => setResults(res.data))
        .catch(() => setResults([]))
        .finally(() => setSearching(false));
    }, 300);
    return () => clearTimeout(debounce.current);
  }, [query, token]);

  const ready = query.trim().length >= MIN_QUERY;
  return (
    <>
      <label htmlFor="share-search" className="field-label mt-4">Doctor's name</label>
      <div className="relative">
        <Search aria-hidden="true" size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
        <input
          id="share-search"
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="At least 3 characters"
          autoComplete="off"
          className="field pl-9"
        />
      </div>
      <p className="field-hint">Check the specialty and hospital, as many doctors share a name.</p>
      <div aria-live="polite">
        {searching && <p className="mt-3 text-sm text-muted">Searching...</p>}
      </div>
      {ready && !searching && (
        <DoctorResults doctors={results} onPick={onPick} emptyText="No verified doctor matches that name." />
      )}
    </>
  );
}

/**
 * Lets a patient give a verified doctor access to their records directly, e.g. before a
 * visit, instead of waiting for the doctor's request. Patients usually know their doctor
 * by hospital and specialty, so that is the default way to find them.
 */
function ShareRecordsDialog({ token, onClose, onShared }) {
  const [mode, setMode] = useState("hospital");
  const [selected, setSelected] = useState(null);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const pick = (doctor) => {
    setSelected(doctor);
    setError("");
  };

  const share = async () => {
    setBusy(true);
    setError("");
    try {
      const res = await shareRecords(token, selected.id, note.trim());
      onShared(res.data, selected);
    } catch (err) {
      const detail = err?.response?.data?.detail;
      setError(typeof detail === "string" ? detail : "Could not share your records. Please try again.");
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div role="dialog" aria-modal="true" aria-labelledby="share-title" className="card card-lift w-full max-w-lg p-6">
        <div className="flex items-start justify-between gap-3">
          <h2 id="share-title" className="display text-xl text-ink">Share your records with a doctor</h2>
          <button type="button" onClick={onClose} aria-label="Close" className="btn btn-ghost btn-sm">
            <X aria-hidden="true" size={18} />
          </button>
        </div>

        {!selected ? (
          <>
            <p className="mt-2 text-sm leading-6 text-muted">
              Find a verified doctor, for example before a visit. They get access to your approved reports for 30 days.
            </p>
            <div role="group" aria-label="How to find the doctor" className="mt-4 inline-flex gap-1 rounded-full bg-inset p-1">
              {[
                { key: "hospital", label: "Find by hospital" },
                { key: "name", label: "Search by name" },
              ].map((option) => (
                <button
                  key={option.key}
                  type="button"
                  aria-pressed={mode === option.key}
                  onClick={() => setMode(option.key)}
                  className={`rounded-full px-4 py-1.5 text-sm font-bold transition-colors ${
                    mode === option.key ? "bg-deep text-deep-on" : "text-muted hover:text-ink"
                  }`}
                >
                  {option.label}
                </button>
              ))}
            </div>
            {mode === "hospital" ? (
              <FindByHospital token={token} onPick={pick} />
            ) : (
              <FindByName token={token} onPick={pick} />
            )}
          </>
        ) : (
          <>
            <div className="card-inset mt-4 flex items-center gap-3 px-4 py-3">
              <span aria-hidden="true" className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-brand-subtle text-sm font-bold text-brand">
                {initials(selected.name)}
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-bold text-ink">{doctorLabel(selected.name)}</p>
                <p className="text-sm text-muted">
                  {specialtyLabel(selected.specialization)}
                  {selected.medical_centers.length > 0 && ` · ${selected.medical_centers.join(", ")}`}
                </p>
              </div>
              <button type="button" onClick={() => setSelected(null)} className="btn btn-ghost btn-sm">Change</button>
            </div>

            <p className="mt-4 text-sm leading-6 text-ink-soft">
              {doctorLabel(selected.name)} will be able to see all your approved reports for <strong>30 days</strong>.
              You can revoke access at any time, and every access is logged.
              {selected.access_status === "pending" && " This also answers the request they sent you."}
            </p>

            <label htmlFor="share-note" className="field-label mt-4">
              Note to the doctor <span className="ml-1.5 font-normal text-muted">(optional)</span>
            </label>
            <textarea
              id="share-note"
              rows={2}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              maxLength={MAX_NOTE}
              placeholder="e.g. For my appointment on Monday about chest pain"
              className="field resize-none"
            />

            {error && <p role="alert" className="mt-3 text-sm font-semibold text-bad-ink">{error}</p>}

            <div className="mt-5 flex gap-3">
              <button type="button" onClick={onClose} className="btn btn-secondary flex-1">Cancel</button>
              <button type="button" onClick={share} disabled={busy} className="btn btn-primary flex-1">
                {busy ? "Sharing..." : "Share my records"}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

export default ShareRecordsDialog;
