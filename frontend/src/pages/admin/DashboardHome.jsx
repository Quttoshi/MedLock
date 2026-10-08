import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Users, Stethoscope, Building2, Clock, ChevronRight, ShieldCheck } from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import { getAdminUsers, getAdminDoctors, getAdminMedicalCenters } from "../../api/admin";

function AdminDashboardHome() {
  const { token } = useAuth();
  const [stats, setStats] = useState({
    totalUsers: "-",
    totalDoctors: "-",
    pendingMCs: "-",
    totalMCs: "-",
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
    { label: "Total users", value: stats.totalUsers, Icon: Users, tone: "bg-brand-subtle text-brand" },
    { label: "Doctors", value: stats.totalDoctors, Icon: Stethoscope, tone: "bg-brand-subtle text-brand" },
    { label: "Medical centers", value: stats.totalMCs, Icon: Building2, tone: "bg-brand-subtle text-brand" },
    { label: "Not yet approved", value: stats.pendingMCs, Icon: Clock, tone: "bg-warn-subtle text-warn-ink" },
  ];

  const quickActions = [
    { label: "Medical centers", description: "Approve or reject registrations", path: "/admin/medical-centers" },
    { label: "Doctors", description: "Review license requests and verification", path: "/admin/doctors" },
    { label: "Audit logs", description: "Monitor activity across the platform", path: "/admin/audit-logs" },
  ];

  return (
    <div className="mx-auto max-w-5xl">
      <h1 className="display text-[28px] leading-[1.15] text-ink sm:text-[32px]">
        Platform <em>overview</em>
      </h1>
      <p className="mt-3 text-sm text-muted">System overview and governance controls.</p>

      <dl className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {statCards.map((stat) => {
          const StatIcon = stat.Icon;
          return (
            <div key={stat.label} className="card flex items-center gap-4 p-5">
              <span className={`flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-xl ${stat.tone}`}>
                <StatIcon aria-hidden="true" size={22} />
              </span>
              <div>
                <dd className="display text-[28px] leading-none text-ink">{stat.value}</dd>
                <dt className="mt-1 text-sm text-muted">{stat.label}</dt>
              </div>
            </div>
          );
        })}
      </dl>

      <h2 className="eyebrow mb-3 mt-10">Quick actions</h2>
      <ul className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        {quickActions.map((a) => (
          <li key={a.path}>
            <Link
              to={a.path}
              className="card flex h-full items-start justify-between gap-3 p-5 transition-colors hover:border-line-strong focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
            >
              <span>
                <span className="block text-base font-bold text-ink">{a.label}</span>
                <span className="mt-1 block text-sm leading-5 text-muted">{a.description}</span>
              </span>
              <ChevronRight aria-hidden="true" size={18} className="mt-1 flex-shrink-0 text-muted" />
            </Link>
          </li>
        ))}
      </ul>

      <div className="panel-deep mt-10 flex gap-4 p-6">
        <ShieldCheck aria-hidden="true" size={24} className="mt-0.5 flex-shrink-0 text-deep-on-muted" />
        <div>
          <p className="text-base font-bold">Governance role only</p>
          <p className="mt-1 text-sm leading-6 text-deep-on-soft">
            As system admin you have no access to patient clinical data or medical records. Your role is limited to
            platform governance, medical center approvals, doctor verification and audit log monitoring.
          </p>
        </div>
      </div>
    </div>
  );
}

export default AdminDashboardHome;
