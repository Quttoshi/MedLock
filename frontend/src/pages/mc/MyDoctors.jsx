import { useEffect, useState } from "react";
import { useAuth } from "../../context/AuthContext";
import { getMCDoctors } from "../../api/medicalCenter";

function MCMyDoctors() {
  const { token } = useAuth();
  const [doctors, setDoctors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("all");

  useEffect(() => {
    getMCDoctors(token)
      .then((res) => setDoctors(res.data))
      .catch(() => setDoctors([]))
      .finally(() => setLoading(false));
  }, [token]);

  const filtered = filter === "all"
    ? doctors
    : filter === "verified"
    ? doctors.filter((d) => d.is_verified)
    : doctors.filter((d) => !d.is_verified);

  return (
    <div className="max-w-6xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-800">My Doctors</h1>
        <p className="text-gray-500 text-sm mt-1">
          Doctors registered and verified under your medical center.
        </p>
      </div>

      {/* Filter */}
      <div className="flex gap-2 mb-6">
        {["all", "verified", "unverified"].map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-4 py-2 rounded-xl text-sm font-medium transition
              ${filter === f
                ? "bg-purple-600 text-white shadow-sm"
                : "bg-white text-gray-600 border border-gray-200 hover:bg-gray-50"
              }`}
          >
            {f.charAt(0).toUpperCase() + f.slice(1)}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="p-10 text-center text-gray-400 text-sm">Loading...</div>
      ) : filtered.length === 0 ? (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-10 text-center">
          <div className="w-14 h-14 bg-gray-100 rounded-2xl flex items-center justify-center mx-auto mb-3">
            <svg className="w-7 h-7 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M5.121 17.804A13.937 13.937 0 0112 16c2.5 0 4.847.655 6.879 1.804M15 10a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
          </div>
          <p className="text-gray-500 text-sm font-medium">No doctors found</p>
          <p className="text-gray-400 text-xs mt-1">
            Doctors register under your center using your Medical Center ID.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((doctor) => (
            <div
              key={doctor.id}
              className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5"
            >
              <div className="flex items-center gap-3 mb-4">
                <div className="w-11 h-11 rounded-full bg-purple-100 flex items-center justify-center">
                  <span className="text-purple-600 font-semibold">
                    {doctor.name?.charAt(0).toUpperCase() || "D"}
                  </span>
                </div>
                <div>
                  <p className="text-sm font-semibold text-gray-800">{doctor.name}</p>
                  <p className="text-xs text-gray-400">{doctor.email}</p>
                </div>
              </div>

              <div className="space-y-2 text-xs text-gray-500">
                {doctor.specialization && (
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-gray-600">Specialization:</span>
                    <span className="capitalize">{doctor.specialization}</span>
                  </div>
                )}
                {doctor.license_number && (
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-gray-600">License:</span>
                    <span>{doctor.license_number}</span>
                  </div>
                )}
              </div>

              <div className="mt-4">
                <span className={`px-2.5 py-1 rounded-full text-xs font-semibold
                  ${doctor.is_verified
                    ? "bg-green-100 text-green-700"
                    : "bg-yellow-100 text-yellow-700"
                  }`}>
                  {doctor.is_verified ? "✓ Verified" : "Pending Verification"}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default MCMyDoctors;