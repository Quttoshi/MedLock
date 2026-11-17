import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Users, ChevronRight, Search } from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import { getMyPatients } from "../../api/doctor";
import { initials } from "../../adapters/patientStory";

const focusRing =
  "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand";

function MyPatients() {
  const { token } = useAuth();
  const [patients, setPatients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");

  useEffect(() => {
    getMyPatients(token)
      .then((res) => setPatients(res.data))
      .catch(() => setPatients([]))
      .finally(() => setLoading(false));
  }, [token]);

  const needle = query.trim().toLowerCase();
  const shown = needle
    ? patients.filter(
        (p) =>
          p.name?.toLowerCase().includes(needle) || p.email?.toLowerCase().includes(needle)
      )
    : patients;

  return (
    <div className="mx-auto max-w-5xl">
      <div className="flex flex-wrap items-end justify-between gap-3 border-b border-line pb-3">
        <div>
          <h1 className="display text-3xl text-ink">
            Your <em>patients</em>
          </h1>
          <p className="mt-1 text-sm text-muted">Patients who have approved your access to their records.</p>
        </div>
        <Link to="/doctor/access-requests" className="btn btn-primary btn-sm">
          Request access
        </Link>
      </div>

      {/* The search only filters the list already on screen, no extra call. */}
      {patients.length > 5 && (
        <div className="relative mt-5">
          <Search
            aria-hidden="true"
            size={16}
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted"
          />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            aria-label="Search your patients"
            placeholder="Search by name or email"
            className="field w-full pl-9"
          />
        </div>
      )}

      {loading ? (
        <p className="mt-10 text-center text-muted">Loading...</p>
      ) : patients.length === 0 ? (
        <div className="mt-5 rounded-lg border border-dashed border-line-strong px-4 py-10 text-center">
          <Users aria-hidden="true" size={24} className="mx-auto text-muted" />
          <p className="mt-2 text-base font-semibold text-ink">No patients yet</p>
          <p className="mx-auto mt-1 max-w-sm text-sm text-muted">
            Send an access request and wait for the patient to approve it.
          </p>
          <Link to="/doctor/access-requests" className="btn btn-primary btn-sm mt-4">
            Send an access request
          </Link>
        </div>
      ) : shown.length === 0 ? (
        <p className="mt-5 rounded-lg border border-dashed border-line-strong px-4 py-6 text-center text-sm text-muted">
          No patient matches that search.
        </p>
      ) : (
        <ul className="mt-5 divide-y divide-line overflow-hidden rounded-lg border border-line bg-surface">
          {shown.map((patient) => (
            <li key={patient.id}>
              <Link
                to={`/doctor/patients/${patient.id}/reports`}
                className={`flex items-center gap-3 px-4 py-3 transition-colors hover:bg-inset ${focusRing}`}
              >
                <span
                  className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded bg-brand-subtle text-xs font-bold text-brand"
                  aria-hidden="true"
                >
                  {initials(patient.name)}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-semibold text-ink">{patient.name}</span>
                  <span className="block truncate text-xs text-muted">{patient.email}</span>
                </span>
                <span className="hidden flex-shrink-0 gap-2 sm:flex">
                  {patient.blood_group && <span className="pill pill-plain">Blood group {patient.blood_group}</span>}
                  {patient.gender && <span className="pill pill-plain capitalize">{patient.gender}</span>}
                </span>
                <ChevronRight aria-hidden="true" size={16} className="flex-shrink-0 text-muted" />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export default MyPatients;
