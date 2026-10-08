import { useEffect, useState } from "react";
import { useAuth } from "../../context/AuthContext";
import { getMyPatients } from "../../api/doctor";
import { Link } from "react-router-dom";
import { Users, ChevronRight } from "lucide-react";
import { initials } from "../../adapters/patientStory";

function MyPatients() {
  const { token } = useAuth();
  const [patients, setPatients] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getMyPatients(token)
      .then((res) => setPatients(res.data))
      .catch(() => setPatients([]))
      .finally(() => setLoading(false));
  }, [token]);

  return (
    <div className="mx-auto max-w-5xl">
      <h1 className="display text-[28px] leading-[1.15] text-ink sm:text-[32px]">
        Your <em>patients</em>
      </h1>
      <p className="mt-3 text-sm text-muted">Patients who have approved your access to their records.</p>

      {loading ? (
        <p className="mt-10 text-center text-muted">Loading...</p>
      ) : patients.length === 0 ? (
        <div className="card card-pad mt-8 text-center">
          <Users aria-hidden="true" size={28} className="mx-auto text-muted" />
          <p className="display mt-3 text-xl text-ink">No patients yet</p>
          <p className="mx-auto mt-2 max-w-sm text-sm leading-6 text-muted">
            Send an access request and wait for the patient to approve it.
          </p>
          <Link to="/doctor/access-requests" className="btn btn-primary mt-5">
            Send an access request
          </Link>
        </div>
      ) : (
        <ul className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {patients.map((patient) => (
            <li key={patient.id}>
              <Link
                to={`/doctor/patients/${patient.id}/reports`}
                className="card block h-full p-5 transition-colors hover:border-line-strong focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
              >
                <span className="flex items-center gap-3">
                  <span className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-full bg-brand-subtle text-sm font-bold text-brand" aria-hidden="true">
                    {initials(patient.name)}
                  </span>
                  <span className="min-w-0">
                    <span className="block truncate text-base font-bold text-ink">{patient.name}</span>
                    <span className="block truncate text-sm text-muted">{patient.email}</span>
                  </span>
                </span>
                <span className="mt-4 flex flex-wrap gap-2">
                  {patient.blood_group && <span className="pill pill-plain">Blood group {patient.blood_group}</span>}
                  {patient.gender && <span className="pill pill-plain capitalize">{patient.gender}</span>}
                </span>
                <span className="mt-4 flex items-center gap-1 text-sm font-bold text-brand">
                  View records
                  <ChevronRight aria-hidden="true" size={16} />
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export default MyPatients;
