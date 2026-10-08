import { useEffect, useState } from "react";
import { useOutletContext } from "react-router-dom";
import { Users, UserMinus } from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import { getMCDoctors, getAffiliationRequests, approveAffiliation, rejectAffiliation, removeDoctor } from "../../api/medicalCenter";
import StatusPill from "../../components/ui/StatusPill";
import { initials } from "../../adapters/patientStory";
import { parseServerDate } from "../../utils/dates";

function MCMyDoctors() {
  const { token } = useAuth();
  const { isLab } = useOutletContext() ?? {};
  const [doctors, setDoctors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("all");
  const [affiliations, setAffiliations] = useState([]);
  const [actionLoading, setActionLoading] = useState(null);
  const [rejectReason, setRejectReason] = useState({});
  const [licenseInput, setLicenseInput] = useState({});
  const [actionError, setActionError] = useState({});
  // Doctor whose removal is being confirmed, and the optional reason shared with them
  const [removing, setRemoving] = useState(null);
  const [removeReason, setRemoveReason] = useState("");

  const fetchAffiliations = () =>
    getAffiliationRequests(token, "pending")
      .then((res) => setAffiliations(res.data))
      .catch(() => setAffiliations([]));

  const fetchDoctors = () =>
    getMCDoctors(token)
      .then((res) => setDoctors(res.data))
      .catch(() => setDoctors([]));

  const handleApprove = async (id) => {
    setActionLoading(id);
    setActionError({ ...actionError, [id]: null });
    try {
      await approveAffiliation(token, id, licenseInput[id] || "");
      await Promise.all([fetchAffiliations(), fetchDoctors()]);
    } catch (err) {
      setActionError({
        ...actionError,
        [id]: err.response?.data?.detail || "Could not approve this request.",
      });
    }
    setActionLoading(null);
  };

  const handleReject = async (id) => {
    setActionLoading(id);
    setActionError({ ...actionError, [id]: null });
    try {
      await rejectAffiliation(token, id, rejectReason[id] || "");
      await fetchAffiliations();
    } catch (err) {
      setActionError({
        ...actionError,
        [id]: err.response?.data?.detail || "Could not reject this request.",
      });
    }
    setActionLoading(null);
  };

  const handleRemove = async (doctor) => {
    setActionLoading(doctor.id);
    setActionError({ ...actionError, [doctor.id]: null });
    try {
      await removeDoctor(token, doctor.id, removeReason.trim());
      setRemoving(null);
      setRemoveReason("");
      await fetchDoctors();
    } catch (err) {
      setActionError({
        ...actionError,
        [doctor.id]: err.response?.data?.detail || "Could not remove this doctor.",
      });
    }
    setActionLoading(null);
  };

  useEffect(() => {
    fetchDoctors().finally(() => setLoading(false));
    fetchAffiliations();
  }, [token]);

  const filtered = filter === "all"
    ? doctors
    : filter === "verified"
    ? doctors.filter((d) => d.is_verified)
    : doctors.filter((d) => !d.is_verified);

  if (isLab) {
    return (
      <div className="mx-auto max-w-2xl">
        <h1 className="display text-[28px] leading-[1.15] text-ink sm:text-[32px]">
          Your <em>doctors</em>
        </h1>
        <div className="card card-pad mt-8 text-center">
          <Users aria-hidden="true" size={28} className="mx-auto text-muted" />
          <p className="mx-auto mt-3 max-w-sm text-sm leading-6 text-muted">
            Diagnostic labs upload reports for patients but do not take affiliated doctors.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl">
      <h1 className="display text-[28px] leading-[1.15] text-ink sm:text-[32px]">
        Your <em>doctors</em>
      </h1>
      <p className="mt-3 text-sm text-muted">Doctors affiliated with your medical center.</p>

      {/* Pending affiliation requests */}
      {affiliations.length > 0 && (
        <section className="card card-pad mt-8" aria-labelledby="pending-heading">
          <h2 id="pending-heading" className="display flex items-center gap-2 text-xl text-ink">
            Pending affiliation requests
            <span className="pill pill-warn">{affiliations.length}</span>
          </h2>
          <ul className="mt-4 space-y-4">
            {affiliations.map((req) => (
              <li key={req.id} className="card-inset p-4">
                <div className="flex flex-wrap items-start justify-between gap-5">
                  <div className="min-w-0">
                    <p className="text-base font-bold text-ink">{req.doctor_name}</p>
                    <p className="text-sm text-muted">{req.doctor_email}</p>
                    {req.specialization && (
                      <span className="pill pill-brand mt-2 capitalize">{req.specialization}</span>
                    )}
                  </div>
                  <div className="flex w-full flex-col gap-2.5 sm:w-80">
                    <div>
                      <label htmlFor={`lic-${req.id}`} className="field-label">License number</label>
                      <input
                        id={`lic-${req.id}`}
                        type="text"
                        placeholder="From their credential"
                        value={licenseInput[req.id] || ""}
                        onChange={(e) => setLicenseInput({ ...licenseInput, [req.id]: e.target.value })}
                        className="field font-mono"
                      />
                    </div>
                    <div>
                      <label htmlFor={`rej-${req.id}`} className="field-label">Rejection reason (optional)</label>
                      <input
                        id={`rej-${req.id}`}
                        type="text"
                        value={rejectReason[req.id] || ""}
                        onChange={(e) => setRejectReason({ ...rejectReason, [req.id]: e.target.value })}
                        className="field"
                      />
                    </div>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => handleApprove(req.id)}
                        disabled={actionLoading === req.id || !(licenseInput[req.id] || "").trim()}
                        title="Enter the license number to verify and approve"
                        className="btn btn-primary btn-sm flex-1 whitespace-nowrap"
                      >
                        Verify &amp; approve
                      </button>
                      <button
                        type="button"
                        onClick={() => handleReject(req.id)}
                        disabled={actionLoading === req.id}
                        className="btn btn-danger btn-sm flex-1"
                      >
                        Reject
                      </button>
                    </div>
                    {actionError[req.id] && (
                      <p role="alert" className="text-sm font-semibold text-bad-ink">{actionError[req.id]}</p>
                    )}
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* Filter */}
      <div role="group" aria-label="Filter doctors" className="mt-8 inline-flex gap-1 rounded-full bg-inset p-1">
        {["all", "verified", "unverified"].map((f) => (
          <button
            key={f}
            type="button"
            onClick={() => setFilter(f)}
            aria-pressed={filter === f}
            className={`rounded-full px-4 py-2 text-sm font-bold capitalize transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand ${
              filter === f ? "bg-deep text-deep-on" : "text-muted hover:text-ink"
            }`}
          >
            {f}
          </button>
        ))}
      </div>

      {loading ? (
        <p className="mt-10 text-center text-muted">Loading...</p>
      ) : filtered.length === 0 ? (
        <div className="card card-pad mt-6 text-center">
          <Users aria-hidden="true" size={28} className="mx-auto text-muted" />
          <p className="display mt-3 text-xl text-ink">No doctors found</p>
          <p className="mx-auto mt-2 max-w-sm text-sm leading-6 text-muted">
            Doctors appear here after you approve their affiliation request.
          </p>
        </div>
      ) : (
        <ul className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((doctor) => (
            <li key={doctor.id} className="card p-5">
              <div className="flex items-center gap-3">
                <span className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-full bg-brand-subtle text-sm font-bold text-brand" aria-hidden="true">
                  {initials(doctor.name)}
                </span>
                <div className="min-w-0">
                  <p className="truncate text-base font-bold text-ink">{doctor.name}</p>
                  <p className="truncate text-sm text-muted">{doctor.email}</p>
                </div>
              </div>

              {(doctor.specialization || doctor.license_number) && (
                <dl className="mt-4 space-y-1.5 text-sm">
                  {doctor.specialization && (
                    <div className="flex gap-2">
                      <dt className="text-muted">Specialization</dt>
                      <dd className="font-bold capitalize text-ink-soft">{doctor.specialization}</dd>
                    </div>
                  )}
                  {doctor.license_number && (
                    <div className="flex gap-2">
                      <dt className="text-muted">License</dt>
                      <dd className="font-mono text-ink-soft">{doctor.license_number}</dd>
                    </div>
                  )}
                </dl>
              )}

              <div className="mt-4 flex flex-wrap items-center justify-between gap-2">
                <StatusPill tone={doctor.is_verified ? "ok" : "warn"}>
                  {doctor.is_verified ? "Verified" : "Pending verification"}
                </StatusPill>
                {removing !== doctor.id && (
                  <button
                    type="button"
                    onClick={() => { setRemoving(doctor.id); setRemoveReason(""); }}
                    className="btn btn-ghost btn-sm"
                  >
                    <UserMinus aria-hidden="true" size={16} />
                    Remove
                  </button>
                )}
              </div>
              {doctor.joined_at && (
                <p className="mt-2 text-sm text-muted">
                  Joined{" "}
                  {parseServerDate(doctor.joined_at).toLocaleDateString("en-PK", { day: "numeric", month: "short", year: "numeric" })}
                </p>
              )}

              {removing === doctor.id && (
                <div className="card-inset mt-4 space-y-2.5 p-3.5">
                  <p className="text-sm font-bold text-ink">Remove {doctor.name} from your center?</p>
                  <p className="text-sm leading-5 text-muted">
                    They are notified. If your center verified them and they belong to no other center, their
                    verification ends.
                  </p>
                  <div>
                    <label htmlFor={`remove-${doctor.id}`} className="field-label">Reason (optional, shared with the doctor)</label>
                    <input
                      id={`remove-${doctor.id}`}
                      type="text"
                      value={removeReason}
                      onChange={(e) => setRemoveReason(e.target.value)}
                      className="field"
                    />
                  </div>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => handleRemove(doctor)}
                      disabled={actionLoading === doctor.id}
                      className="btn btn-danger btn-sm flex-1"
                    >
                      {actionLoading === doctor.id ? "Removing..." : "Remove doctor"}
                    </button>
                    <button type="button" onClick={() => setRemoving(null)} className="btn btn-ghost btn-sm flex-1">
                      Cancel
                    </button>
                  </div>
                </div>
              )}
              {actionError[doctor.id] && (
                <p role="alert" className="mt-2 text-sm font-semibold text-bad-ink">{actionError[doctor.id]}</p>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export default MCMyDoctors;
