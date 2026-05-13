import { useEffect, useState } from "react";
import { useAuth } from "../../context/AuthContext";
import { getAdminUsers, getAdminDoctors, getAdminMedicalCenters } from "../../api/admin";
import { useNavigate } from "react-router-dom";

function AdminDashboardHome() {
  const { token } = useAuth();
  const navigate = useNavigate();
  const [stats, setStats] = useState({
    totalUsers: "—",
    totalDoctors: "—",
    pendingMCs: "—",
    totalMCs: "—",
  });

  useEffect(() => {
    if (!token) return;
    Promise.all([
      getAdminUsers(token),
      getAdminDoctors(token),
      getAdminMedicalCenters(token),
      getAdminMedicalCenters(token, false),
    ])
      .then(([users, doctors, mcs, pendingMCs]) => {
        setStats({
          totalUsers: users.data.length,
          totalDoctors: doctors.data.length,
          totalMCs: mcs.data.length,
          pendingMCs: pendingMCs.data.length,
        });
      })
      .catch(() => {});
  }, [token]);

  const statCards = [
    {
      label: "Total Users",
      value: stats.totalUsers,
      color: "bg-blue-50 text-blue-600",
      icon: (
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
            d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
        </svg>
      ),
    },
    {
      label: "Total Doctors",
      value: stats.totalDoctors,
      color: "bg-green-50 text-green-600",
      icon: (
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
            d="M5.121 17.804A13.937 13.937 0 0112 16c2.5 0 4.847.655 6.879 1.804M15 10a3 3 0 11-6 0 3 3 0 016 0z" />
        </svg>
      ),
    },
    {
      label: "Total Medical Centers",
      value: stats.totalMCs,
      color: "bg-purple-50 text-purple-600",
      icon: (
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
            d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
        </svg>
      ),
    },
    {
      label: "Pending MC Approvals",
      value: stats.pendingMCs,
      color: "bg-yellow-50 text-yellow-600",
      icon: (
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
            d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      ),
    },
  ];

  const quickActions = [
    {
      label: "Manage Medical Centers",
      description: "Approve or reject pending registrations",
      path: "/admin/medical-centers",
      color: "bg-red-600 hover:bg-red-700",
    },
    {
      label: "Manage Doctors",
      description: "Verify or unverify doctor accounts",
      path: "/admin/doctors",
      color: "bg-indigo-600 hover:bg-indigo-700",
    },
    {
      label: "View Audit Logs",
      description: "Monitor all system activity",
      path: "/admin/audit-logs",
      color: "bg-violet-600 hover:bg-violet-700",
    },
  ];

  return (
    <div className="max-w-6xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-800">Admin Dashboard</h1>
        <p className="text-gray-500 mt-1 text-sm">
          System overview and governance controls.
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

      {/* Governance Notice */}
      <div className="bg-red-50 border border-red-100 rounded-2xl p-5 flex gap-4 items-start">
        <div className="w-10 h-10 rounded-xl bg-red-100 flex items-center justify-center flex-shrink-0">
          <svg className="w-5 h-5 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
        </div>
        <div>
          <p className="text-sm font-semibold text-red-800">Governance Role Only</p>
          <p className="text-sm text-red-600 mt-0.5">
            As System Admin you have no access to patient clinical data or medical records.
            Your role is strictly limited to platform governance, Medical Center approvals,
            and audit log monitoring.
          </p>
        </div>
      </div>
    </div>
  );
}

export default AdminDashboardHome;