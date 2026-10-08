import { Link } from "react-router-dom";
import { User, Stethoscope, Building2, ChevronRight } from "lucide-react";
import AuthShell from "../../components/shell/AuthShell";

const roles = [
  {
    key: "patient",
    title: "Patient",
    description: "Keep your medical records in one place and control who can see them.",
    Icon: User,
    badge: null,
  },
  {
    key: "doctor",
    title: "Doctor",
    description: "Request access to patient records with their consent and manage your patient list.",
    Icon: Stethoscope,
    badge: "Requires verification",
  },
  {
    key: "medical_center",
    title: "Hospital, clinic or lab",
    description: "Upload reports on behalf of patients. Hospitals and clinics also verify the doctors who work there.",
    Icon: Building2,
    badge: "Requires admin approval",
  },
];

function RoleSelectPage() {
  return (
    <AuthShell>
      <h1 className="display text-[40px] leading-tight text-ink">Join MedLock</h1>
      <p className="mt-2 text-sm text-muted">Choose how you will use it.</p>

      <ul className="mt-6 space-y-3">
        {roles.map((role) => {
          const { key, title, description, badge } = role;
          const RoleIcon = role.Icon;
          return (
          <li key={key}>
            <Link
              to={`/register/${key}`}
              className="card flex items-center gap-4 p-5 transition-colors hover:border-line-strong focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
            >
              <span className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-xl bg-brand-subtle text-brand">
                <RoleIcon aria-hidden="true" size={24} />
              </span>
              <span className="min-w-0 flex-1">
                <span className="flex flex-wrap items-center gap-2">
                  <span className="text-base font-bold text-ink">{title}</span>
                  {badge && <span className="pill pill-plain !py-0.5 !text-xs">{badge}</span>}
                </span>
                <span className="mt-1 block text-sm leading-5 text-muted">{description}</span>
              </span>
              <ChevronRight aria-hidden="true" size={18} className="flex-shrink-0 text-muted" />
            </Link>
          </li>
          );
        })}
      </ul>

      <p className="mt-6 text-center text-sm text-muted">
        Already have an account?{" "}
        <Link to="/login" className="link">Sign in</Link>
      </p>
    </AuthShell>
  );
}

export default RoleSelectPage;
