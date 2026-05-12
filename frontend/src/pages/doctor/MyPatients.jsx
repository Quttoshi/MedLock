import { useEffect, useState } from "react";
import { useAuth } from "../../context/AuthContext";
import { getMyPatients } from "../../api/doctor";
import { useNavigate } from "react-router-dom";

function MyPatients() {
  const { token } = useAuth();
  const [patients, setPatients] = useState([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    getMyPatients(token)
      .then((res) => setPatients(res.data))
      .catch(() => setPatients([]))
      .finally(() => setLoading(false));
  }, [token]);

  return (
    <div className="max-w-6xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-800">My Patients</h1>
        <p className="text-gray-500 text-sm mt-1">
          Patients who have approved your access to their records.
        </p>
      </div>

      {loading ? (
        <div className="p-10 text-center text-gray-400 text-sm">Loading...</div>
      ) : patients.length === 0 ? (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-10 text-center">
          <div className="w-14 h-14 bg-gray-100 rounded-2xl flex items-center justify-center mx-auto mb-3">
            <svg className="w-7 h-7 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
          </div>
          <p className="text-gray-500 text-sm font-medium">No patients yet</p>
          <p className="text-gray-400 text-xs mt-1">
            Submit an access request and wait for patient approval.
          </p>
          <button
            onClick={() => navigate("/doctor/access-requests")}
            className="mt-4 px-4 py-2 bg-green-600 text-white text-sm rounded-xl hover:bg-green-700 transition"
          >
            Submit Access Request
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {patients.map((patient) => (
            <div
              key={patient.id}
              onClick={() => navigate(`/doctor/patients/${patient.id}/reports`)}
              className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 cursor-pointer hover:shadow-md hover:border-green-200 transition"
            >
              <div className="flex items-center gap-3 mb-4">
                <div className="w-11 h-11 rounded-full bg-green-100 flex items-center justify-center">
                  <span className="text-green-600 font-semibold">
                    {patient.name?.charAt(0).toUpperCase() || "P"}
                  </span>
                </div>
                <div>
                  <p className="text-sm font-semibold text-gray-800">{patient.name}</p>
                  <p className="text-xs text-gray-400">{patient.email}</p>
                </div>
              </div>
              <div className="flex gap-3 text-xs text-gray-500">
                {patient.blood_group && (
                  <span className="px-2 py-1 bg-red-50 text-red-600 rounded-lg font-medium">
                    {patient.blood_group}
                  </span>
                )}
                {patient.gender && (
                  <span className="px-2 py-1 bg-gray-100 text-gray-600 rounded-lg capitalize">
                    {patient.gender}
                  </span>
                )}
              </div>
              <p className="text-xs text-green-600 font-medium mt-3">
                View Records →
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default MyPatients;