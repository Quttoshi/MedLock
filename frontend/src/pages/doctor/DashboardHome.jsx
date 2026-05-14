import { useEffect, useState } from "react";
import { useAuth } from "../../context/AuthContext";
import { getMyPatients, getMyAccessRequests } from "../../api/doctor";
import { useNavigate } from "react-router-dom";

function DoctorDashboardHome() {
  const { token, user } = useAuth();
  const navigate = useNavigate();
  const [stats, setStats] = useState({
    totalPatients: "—",
    pendingRequests: "—",
    approvedRequests: "—",
    deniedRequests: "—",
  });

  useEffect(() => {
    if (!token) return;
    Promise.all([
      getMyPatients(token),
      getMyAccessRequests(token),
    ])
      .then(([patients, requests]) => {
        const reqs = requests.data;
        setStats({
          totalPatients: patients.data.length,
          pendingRequests: reqs.filter((r) => r.status === "pending").length,
          approvedRequests: reqs.filter((r) => r.status === "approved").length,
          deniedRequests: reqs.filter((r) => r.status === "denied").length,
        });
      })
      .catch(() => {});
  }, [token]);

  const statCards = [
    {
      label: "Approved Patients",
      value: stats.totalPatients,
      color: "bg-green-50 text-green-600",
      icon: (
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
            d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
        </svg>
      ),
    },
    {
      label: "Pending Requests",
      value: stats.pendingRequests,
      color: "bg-yellow-50 text-yellow-600",
      icon: (
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
            d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      ),
    },
    {
      label: "Approved Requests",
      value: stats.approvedRequests,
      color: "bg-blue-50 text-blue-600",
      icon: (
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
            d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      ),
    },
    {
      label: "Denied Requests",
      value: stats.deniedRequests,
      color: "bg-red-50 text-red-600",
      icon: (
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
            d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      ),
    },
  ];

  const quickActions = [
    {
      label: "My Patients",
      description: "View patients who approved your access",
      path: "/doctor/patients",
      color: "bg-green-600 hover:bg-green-700",
    },
    {
      label: "Access Requests",
      description: "Submit or track access requests",
      path: "/doctor/access-requests",
      color: "bg-indigo-600 hover:bg-indigo-700",
    },
  ];

  const comingSoon = [
    {
      label: "Patient History",
      description: "Visual analytics of a patient's medical history using extracted report evidence, timelines, and model-ready clinical context.",
      note: "Coming in Iteration 7",
    },
  ];

  return (
    <div className="max-w-6xl mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-800">
          Good day, Dr. {user?.name?.split(" ")[0]}
        </h1>
        <p className="text-gray-500 mt-1 text-sm">
          Here is an overview of your MedLock doctor account.
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 mb-8">
        {statCards.map((stat) => (
          <div key={stat.label}
            className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100 flex items-center gap-4">
            <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${stat.color}`}>
              {stat.icon}
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-800">{stat.value}</p>
              <p className="text-sm text-gray-500">{stat.label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Quick Actions */}
      <div className="mb-8">
        <h2 className="text-lg font-semibold text-gray-700 mb-4">Quick Actions</h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {quickActions.map((action) => (
            <button
              key={action.path}
              onClick={() => navigate(action.path)}
              className={`${action.color} text-white rounded-2xl p-5 text-left transition shadow-sm`}
            >
              <p className="font-semibold text-base">{action.label}</p>
              <p className="text-sm opacity-80 mt-1">{action.description}</p>
            </button>
          ))}
        </div>
      </div>

      {/* Coming Soon */}
      <div className="mb-8">
        <h2 className="text-lg font-semibold text-gray-700 mb-4">Coming Soon</h2>
        <div className="grid grid-cols-1 gap-4">
          {comingSoon.map((item) => (
            <div
              key={item.label}
              className="bg-gray-50 border border-dashed border-gray-300 rounded-2xl p-5 flex items-start gap-4"
            >
              <div className="w-10 h-10 rounded-xl bg-gray-200 flex items-center justify-center flex-shrink-0">
                <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                </svg>
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <p className="text-sm font-semibold text-gray-600">{item.label}</p>
                  <span className="text-xs bg-gray-200 text-gray-500 px-2 py-0.5 rounded-full font-medium">
                    {item.note}
                  </span>
                </div>
                <p className="text-sm text-gray-400 mt-0.5">{item.description}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Info Notice */}
      <div className="bg-green-50 border border-green-100 rounded-2xl p-5 flex gap-4 items-start">
        <div className="w-10 h-10 rounded-xl bg-green-100 flex items-center justify-center flex-shrink-0">
          <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </div>
        <div>
          <p className="text-sm font-semibold text-green-800">Patient consent required</p>
          <p className="text-sm text-green-600 mt-0.5">
            You can only access patient records after submitting an access request
            and receiving explicit approval from the patient. All access events are
            permanently recorded on the Ethereum blockchain.
          </p>
        </div>
      </div>
    </div>
  );
}

export default DoctorDashboardHome;
