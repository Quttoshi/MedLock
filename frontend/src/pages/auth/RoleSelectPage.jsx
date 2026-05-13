import { useNavigate, Link } from "react-router-dom";

const roles = [
  {
    key: "patient",
    title: "Patient",
    description: "Manage your personal medical records, control who can access them, and track your health history.",
    icon: (
      <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
          d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
      </svg>
    ),
    color: "border-blue-200 hover:border-blue-500 hover:bg-blue-50 group-hover:text-blue-600",
    iconBg: "bg-blue-100 text-blue-600",
    badge: null,
  },
  {
    key: "doctor",
    title: "Doctor",
    description: "Request access to patient records with patient consent. View history and manage your patient list.",
    icon: (
      <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
          d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
      </svg>
    ),
    color: "border-green-200 hover:border-green-500 hover:bg-green-50 group-hover:text-green-600",
    iconBg: "bg-green-100 text-green-600",
    badge: "Requires verification",
  },
  {
    key: "medical_center",
    title: "Hospital / Clinic",
    description: "Upload reports on behalf of patients, manage affiliated doctors, and maintain institutional records.",
    icon: (
      <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
          d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
      </svg>
    ),
    color: "border-purple-200 hover:border-purple-500 hover:bg-purple-50 group-hover:text-purple-600",
    iconBg: "bg-purple-100 text-purple-600",
    badge: "Requires admin approval",
  },
];

function RoleSelectPage() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center px-4 py-10">
      <div className="w-full max-w-2xl">

        {/* Header */}
        <div className="text-center mb-10">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-blue-600 rounded-2xl mb-4">
            <span className="text-white text-2xl font-bold">M</span>
          </div>
          <h1 className="text-3xl font-bold text-gray-800">Join MedLock</h1>
          <p className="text-gray-500 mt-2 text-sm">Select how you want to register</p>
        </div>

        {/* Role Cards */}
        <div className="grid grid-cols-1 gap-4">
          {roles.map((role) => (
            <button
              key={role.key}
              onClick={() => navigate(`/register/${role.key}`)}
              className={`group w-full text-left bg-white border-2 rounded-2xl p-5 transition-all duration-200 shadow-sm ${role.color}`}
            >
              <div className="flex items-center gap-4">
                <div className={`w-14 h-14 rounded-xl flex items-center justify-center flex-shrink-0 ${role.iconBg}`}>
                  {role.icon}
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <p className="font-semibold text-gray-800 text-base">{role.title}</p>
                    {role.badge && (
                      <span className="text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full">
                        {role.badge}
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-gray-500">{role.description}</p>
                </div>
                <svg className="w-5 h-5 text-gray-300 group-hover:text-gray-500 flex-shrink-0 transition" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </div>
            </button>
          ))}
        </div>

        <p className="text-center text-sm text-gray-500 mt-8">
          Already have an account?{" "}
          <Link to="/login" className="text-blue-600 hover:underline font-medium">
            Sign in here
          </Link>
        </p>
      </div>
    </div>
  );
}

export default RoleSelectPage;
