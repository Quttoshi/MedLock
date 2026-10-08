import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Users, Clock, CheckCircle2, XCircle, ChevronRight, ShieldCheck } from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import { getMyPatients, getMyAccessRequests } from "../../api/doctor";

function DoctorDashboardHome() {
  const { token, user } = useAuth();
  const [stats, setStats] = useState({
    totalPatients: "-",
    pendingRequests: "-",
    approvedRequests: "-",
    deniedRequests: "-",
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
    { label: "Patients with access", value: stats.totalPatients, Icon: Users, tone: "bg-brand-subtle text-brand" },
    { label: "Pending requests", value: stats.pendingRequests, Icon: Clock, tone: "bg-warn-subtle text-warn-ink" },
    { label: "Approved requests", value: stats.approvedRequests, Icon: CheckCircle2, tone: "bg-ok-subtle text-ok-ink" },
    { label: "Denied requests", value: stats.deniedRequests, Icon: XCircle, tone: "bg-bad-subtle text-bad-ink" },
  ];

  const quickActions = [
    { label: "My patients", description: "Patients who approved your access", path: "/doctor/patients" },
    { label: "Access requests", description: "Send or track requests for patient records", path: "/doctor/access-requests" },
    { label: "Affiliation", description: "Manage your medical center affiliation", path: "/doctor/affiliation" },
  ];

  const firstName = user?.name?.replace(/^dr\.?\s+/i, "").split(" ")[0];

  return (
    <div className="mx-auto max-w-5xl">
      <h1 className="display text-[28px] leading-[1.15] text-ink sm:text-[32px]">
        Good day, <em>Dr. {firstName}</em>
      </h1>
      <p className="mt-3 text-sm text-muted">An overview of your MedLock doctor account.</p>

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
          <p className="text-base font-bold">Patient consent required</p>
          <p className="mt-1 text-sm leading-6 text-deep-on-soft">
            You can only open a patient's records after you send an access request and the patient approves it. Approved access lasts 30 days, and the patient can take it back at any time.
          </p>
        </div>
      </div>
    </div>
  );
}

export default DoctorDashboardHome;
