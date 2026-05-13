import { useEffect, useState } from "react";
import { useAuth } from "../../context/AuthContext";
import { useNavigate } from "react-router-dom";
import api from "../../api/axios";

const quickActions = [
  {
    label: "Upload Report",
    description: "Upload a new medical record",
    path: "/patient/upload",
    color: "bg-blue-600 hover:bg-blue-700",
  },
  {
    label: "View Reports",
    description: "Browse all your medical records",
    path: "/patient/reports",
    color: "bg-indigo-600 hover:bg-indigo-700",
  },
  {
    label: "Access Requests",
    description: "Manage doctor access requests",
    path: "/patient/access-requests",
    color: "bg-violet-600 hover:bg-violet-700",
  },
];

function DashboardHome() {
  const { user, token } = useAuth();
  const navigate = useNavigate();
  const [totalReports, setTotalReports] = useState("—");
  const [pendingCount, setPendingCount] = useState("—");
  const [approvedCount, setApprovedCount] = useState("—");

  useEffect(() => {
    if (!token) return;
    const headers = { Authorization: `Bearer ${token}` };
    api.get("/reports/my", { headers })
      .then((res) => setTotalReports(res.data.length))
      .catch(() => setTotalReports(0));
    api.get("/access-requests", { headers })
      .then((res) => {
        setPendingCount(res.data.filter((r) => r.status === "pending").length);
        setApprovedCount(res.data.filter((r) => r.status === "approved").length);
      })
      .catch(() => { setPendingCount(0); setApprovedCount(0); });
  }, [token]);

  const stats = [
    {
      label: "Total Reports",
      value: totalReports,
      color: "bg-blue-50 text-blue-600",
      icon: (
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
            d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        </svg>
      ),
    },
    {
      label: "Pending Requests",
      value: pendingCount,
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
      value: approvedCount,
      color: "bg-green-50 text-green-600",
      icon: (
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
            d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      ),
    },
    {
      label: "Blockchain Verified",
      value: 0,
      color: "bg-purple-50 text-purple-600",
      icon: (
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
            d="M9 3H5a2 2 0 00-2 2v4m6-6h10a2 2 0 012 2v4M9 3v18m0 0h10a2 2 0 002-2V9M9 21H5a2 2 0 01-2-2V9m0 0h18" />
        </svg>
      ),
    },
  ];

  return (
    <div className="max-w-6xl mx-auto">

      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-800">
          Good day, {user?.name?.split(" ")[0]}
        </h1>
        <p className="text-gray-500 mt-1 text-sm">
          Here is an overview of your MedLock account.
        </p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 
                      gap-4 mb-8">
        {stats.map((stat) => (
          <div key={stat.label}
            className="bg-white rounded-2xl p-5 shadow-sm border 
                       border-gray-100 flex items-center gap-4">
            <div className={`w-12 h-12 rounded-xl flex items-center 
                             justify-center ${stat.color}`}>
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
        <h2 className="text-lg font-semibold text-gray-700 mb-4">
          Quick Actions
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {quickActions.map((action) => (
            <button
              key={action.path}
              onClick={() => navigate(action.path)}
              className={`${action.color} text-white rounded-2xl p-5 
                          text-left transition shadow-sm`}
            >
              <p className="font-semibold text-base">{action.label}</p>
              <p className="text-sm opacity-80 mt-1">{action.description}</p>
            </button>
          ))}
        </div>
      </div>

      {/* Security Notice */}
      <div className="bg-blue-50 border border-blue-100 rounded-2xl p-5 
                      flex gap-4 items-start">
        <div className="w-10 h-10 rounded-xl bg-blue-100 flex items-center 
                        justify-center flex-shrink-0">
          <svg className="w-5 h-5 text-blue-600" fill="none"
            stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 
                 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
          </svg>
        </div>
        <div>
          <p className="text-sm font-semibold text-blue-800">
            Your data is protected
          </p>
          <p className="text-sm text-blue-600 mt-0.5">
            All your medical records are encrypted with AES-256 and every 
            access event is permanently recorded on the Ethereum blockchain.
            Only you can approve who sees your records.
          </p>
        </div>
      </div>
    </div>
  );
}

export default DashboardHome;