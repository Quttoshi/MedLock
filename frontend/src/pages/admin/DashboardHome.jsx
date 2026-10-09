import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ChevronRight, ShieldCheck, Building2, Stethoscope, ScrollText } from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import { getAdminUsers, getAdminDoctors, getAdminMedicalCenters, getVerificationRequests } from "../../api/admin";

const focusRing =
  "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand";

function Fact({ label, value }) {
  return (
    <div className="min-w-0 xl:border-l xl:border-line xl:pl-4 xl:first:border-l-0 xl:first:pl-0">
      <dt className="text-xs text-muted">{label}</dt>
      <dd className="mt-0.5 text-sm font-semibold text-ink">{value}</dd>
    </div>
  );
}

function SectionHead({ id, title }) {
  return (
    <div className="mb-3 border-b border-line pb-2">
      <h2 id={id} className="display text-xl text-ink">
        {title}
      </h2>
    </div>
  );
}

function AttentionRow({ title, text, to, cta }) {
  return (
    <div className="flex flex-col gap-3 rounded-lg border border-l-4 border-line border-l-warn bg-surface px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <p className="text-sm font-semibold text-ink">{title}</p>
        <p className="text-sm text-muted">{text}</p>
      </div>
      <Link to={to} className="btn btn-primary btn-sm">
        {cta}
      </Link>
    </div>
  );
}

function AdminDashboardHome() {
  const { token, user } = useAuth();
  const [stats, setStats] = useState(null);
  const [pendingDoctors, setPendingDoctors] = useState(0);

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
      .catch(() => setStats({ totalUsers: "-", totalDoctors: "-", totalMCs: "-", pendingMCs: 0 }));
    getVerificationRequests(token, "pending")
      .then((res) => setPendingDoctors(res.data.length))
      .catch(() => setPendingDoctors(0));
  }, [token]);

  const val = (v) => (stats ? v : "-");
  const pendingMCs = stats?.pendingMCs ?? 0;
  const attention = pendingMCs > 0 || pendingDoctors > 0;

  const actions = [
    { label: "Medical centers", description: "Approve or reject registrations", path: "/admin/medical-centers", Icon: Building2 },
    { label: "Doctors", description: "Review licence requests and verification", path: "/admin/doctors", Icon: Stethoscope },
    { label: "Audit logs", description: "Monitor activity across the platform", path: "/admin/audit-logs", Icon: ScrollText },
  ];

  return (
    <div className="grid grid-cols-[minmax(0,1fr)] gap-6">
      <section className="overflow-hidden rounded-lg border border-line bg-surface" aria-labelledby="admin-name">
        <div className="p-5">
          <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
            <h1 id="admin-name" className="display text-3xl text-ink">
              Platform overview
            </h1>
            <span className="text-sm text-muted">
              Signed in as {user?.name}
              {user?.email ? ` · ${user.email}` : ""}
            </span>
          </div>
          <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-3 border-t border-line pt-4 sm:grid-cols-4">
            <Fact label="Total users" value={val(stats?.totalUsers)} />
            <Fact label="Doctors" value={val(stats?.totalDoctors)} />
            <Fact label="Medical centers" value={val(stats?.totalMCs)} />
            <Fact label="Centers not yet approved" value={val(stats?.pendingMCs)} />
          </dl>
        </div>
      </section>

      <div className="grid grid-cols-[minmax(0,1fr)] gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <section aria-labelledby="sec-attention" className="content-start">
          <SectionHead id="sec-attention" title="Needs your attention" />
          {attention ? (
            <div className="grid gap-3">
              {pendingMCs > 0 && (
                <AttentionRow
                  title={pendingMCs === 1 ? "1 medical center is waiting for approval" : `${pendingMCs} medical centers are waiting for approval`}
                  text="Check the licence details, then approve or reject."
                  to="/admin/medical-centers"
                  cta="Review centers"
                />
              )}
              {pendingDoctors > 0 && (
                <AttentionRow
                  title={pendingDoctors === 1 ? "1 doctor verification request" : `${pendingDoctors} doctor verification requests`}
                  text="Check the licence certificate before the doctor can request records."
                  to="/admin/doctors"
                  cta="Review doctors"
                />
              )}
            </div>
          ) : (
            <p className="rounded-lg border border-dashed border-line-strong px-4 py-6 text-center text-sm text-muted">
              Nothing is waiting for review.
            </p>
          )}
        </section>

        <aside className="grid content-start gap-6" aria-label="Shortcuts">
          <section aria-labelledby="sec-actions">
            <SectionHead id="sec-actions" title="Shortcuts" />
            <ul className="divide-y divide-line overflow-hidden rounded-lg border border-line bg-surface">
              {actions.map((a) => {
                const ActionIcon = a.Icon;
                return (
                  <li key={a.path}>
                    <Link to={a.path} className={`flex items-center gap-3 px-4 py-3 transition-colors hover:bg-inset ${focusRing}`}>
                      <ActionIcon aria-hidden="true" size={18} className="flex-shrink-0 text-brand" />
                      <span className="min-w-0 flex-1">
                        <span className="block text-sm font-semibold text-ink">{a.label}</span>
                        <span className="block text-xs text-muted">{a.description}</span>
                      </span>
                      <ChevronRight aria-hidden="true" size={16} className="flex-shrink-0 text-muted" />
                    </Link>
                  </li>
                );
              })}
            </ul>
          </section>

          <div className="panel-deep flex gap-3 p-4">
            <ShieldCheck aria-hidden="true" size={20} className="mt-0.5 flex-shrink-0 text-deep-on-muted" />
            <div>
              <p className="text-sm font-bold">Governance role only</p>
              <p className="mt-1 text-sm text-deep-on-soft">
                As system admin you have no access to patient clinical data or medical records. Your role is limited
                to platform governance, medical center approvals, doctor verification and audit log monitoring.
              </p>
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}

export default AdminDashboardHome;
