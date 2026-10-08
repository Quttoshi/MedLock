import { useEffect, useState } from "react";
import { Link, useOutletContext } from "react-router-dom";
import { Users, BadgeCheck, FileText, Clock, ChevronRight, ShieldCheck } from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import { getMCDoctors, getMCReports } from "../../api/medicalCenter";

function MCDashboardHome() {
  const { token, user } = useAuth();
  const { isLab, profile } = useOutletContext() ?? {};
  const [stats, setStats] = useState({
    totalDoctors: "-",
    verifiedDoctors: "-",
    totalReports: "-",
    pendingReports: "-",
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

  // Labs take no doctors, so their overview leaves out the doctor figures and page.
  const doctorStats = [
    { label: "Doctors", value: stats.totalDoctors, Icon: Users, tone: "bg-brand-subtle text-brand" },
    { label: "Verified doctors", value: stats.verifiedDoctors, Icon: BadgeCheck, tone: "bg-ok-subtle text-ok-ink" },
  ];
  const statCards = [
    ...(isLab ? [] : doctorStats),
    { label: "Reports uploaded", value: stats.totalReports, Icon: FileText, tone: "bg-brand-subtle text-brand" },
    { label: "Awaiting patient approval", value: stats.pendingReports, Icon: Clock, tone: "bg-warn-subtle text-warn-ink" },
  ];

  const quickActions = [
    { label: "Upload report", description: "Upload a diagnostic report for a patient", path: "/mc/upload" },
    { label: "My reports", description: "View all reports uploaded by your center", path: "/mc/reports" },
    ...(isLab ? [] : [{ label: "My doctors", description: "Doctors affiliated with your center", path: "/mc/doctors" }]),
  ];

  return (
    <div className="mx-auto max-w-5xl">
      <h1 className="display text-[28px] leading-[1.15] text-ink sm:text-[32px]">
        Welcome, <em>{user?.name}</em>
      </h1>
      <p className="mt-3 text-sm text-muted">An overview of your medical center account.</p>
      {profile?.licence_label && (
        <span className="pill pill-ok mt-3">
          <ShieldCheck aria-hidden="true" size={14} />
          {profile.licence_label}
        </span>
      )}

      <dl className={`mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2 ${isLab ? "" : "xl:grid-cols-4"}`}>
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
      <ul className={`grid grid-cols-1 gap-4 ${isLab ? "sm:grid-cols-2" : "sm:grid-cols-3"}`}>
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
          <p className="text-base font-bold">Patient consent required</p>
          <p className="mt-1 text-sm leading-6 text-deep-on-soft">
            Reports uploaded by your center only join the patient's record after the patient approves them. Every
            file is encrypted with AES 256 before storage, and its fingerprint is recorded on the Ethereum Sepolia testnet.
          </p>
        </div>
      </div>
    </div>
  );
}

export default MCDashboardHome;
