import { useEffect, useState } from "react";
import { useAuth } from "../../context/AuthContext";
import { getMCDoctors, getMCReports } from "../../api/medicalCenter";
import { useNavigate } from "react-router-dom";

function MCDashboardHome() {
  const { token, user } = useAuth();
  const navigate = useNavigate();
  const [stats, setStats] = useState({
    totalDoctors: "—",
    verifiedDoctors: "—",
    totalReports: "—",
    pendingReports: "—",
  });

  useEffect(() => {
    if (!token) return;
    Promise.all([getMCDoctors(token), getMCReports(token)])
      .then(([doctors, reports]) => {
        const docs = doctors.data;
        const reps = reports.data;
        setStats({
          totalDoctors: docs.length,
          verifiedDoctors: docs.filter((d) => d.is_verified).length,
          totalReports: reps.length,
          pendingReports: reps.filter((r) => !r.is_approved).length,
        });
      })
      .catch(() => {});
  }, [token]);

  const statCards = [
    {
      label: "Total Doctors",
      value: stats.totalDoctors,
      color: "bg-purple-50 text-purple-600",
      icon: (
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
            d="M5.121 17.804A13.937 13.937 0 0112 16c2.5 0 4.847.655 6.879 1.804M15 10a3 3 0 11-6 0 3 3 0 016 0z" />
        </svg>
      ),
    },
    {
      label: "Verified Doctors",
      value: stats.verifiedDoctors,
      color: "bg-green-50 text-green-600",
      icon: (
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
            d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      ),
    },
    {
      label: "Reports Uploaded",
      value: stats.totalReports,
      color: "bg-blue-50 text-blue-600",
      icon: (
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
            d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        </svg>
      ),
    },
    {
      label: "Awaiting Patient Approval",
      value: stats.pendingReports,
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
      label: "Upload Report",
      description: "Upload a diagnostic report for a patient",
      path: "/mc/upload",
      color: "bg-purple-600 hover:bg-purple-700",
    },
    {
      label: "My Reports",
      description: "View all reports uploaded by your center",
      path: "/mc/reports",
      color: "bg-indigo-600 hover:bg-indigo-700",
    },
    {
      label: "My Doctors",
      description: "View doctors registered under your center",
      path: "/mc/doctors",
      color: "bg-violet-600 hover:bg-violet-700",
    },
  ];

  return (
    <div className="max-w-6xl mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-800">
          Good day, {user?.name?.split(" ")[0]} 👋
        </h1>
        <p className="text-gray-500 mt-1 text-sm">
          Here is an overview of your Medical Center account.
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 mb-8">
        {statCards.map((stat) => (
          <div
            key={stat.label}
            className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100 flex items-center gap-4"
          >
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

      {/* Notice */}
      <div className="bg-purple-50 border border-purple-100 rounded-2xl p-5 flex gap-4 items-start">
        <div className="w-10 h-10 rounded-xl bg-purple-100 flex items-center justify-center flex-shrink-0">
          <svg className="w-5 h-5 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </div>
        <div>
          <p className="text-sm font-semibold text-purple-800">Patient consent required</p>
          <p className="text-sm text-purple-600 mt-0.5">
            All reports uploaded by your center require explicit patient approval
            before they are added to the patient's medical record. Every upload
            is encrypted with AES-256 and logged on the Ethereum blockchain.
          </p>
        </div>
      </div>
    </div>
  );
}

export default MCDashboardHome;