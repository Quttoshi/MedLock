import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import api from "../../api/axios";
import AuthShell from "../../components/shell/AuthShell";
import { CheckCircle2, AlertCircle } from "lucide-react";

// Landing page for the link in the confirmation email: /verify-email?token=...
function VerifyEmailPage() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get("token");
  const [state, setState] = useState(token ? "checking" : "error");
  const [message, setMessage] = useState(token ? "" : "This confirmation link is missing its token.");

  useEffect(() => {
    if (!token) return;
    api
      .post("/auth/verify-email", { token })
      .then((res) => {
        setState("success");
        setMessage(res.data.message);
      })
      .catch((err) => {
        setState("error");
        setMessage(
          err.response?.data?.detail ||
            "We couldn't confirm your email. The link may have expired; request a new one from the login page."
        );
      });
  }, [token]);

  return (
    <AuthShell>
      <h1 className="display text-[40px] leading-tight text-ink">Email confirmation</h1>

      {state === "checking" && <p className="mt-4 text-sm text-muted">Confirming your email address...</p>}

      {state === "success" && (
        <div role="status" className="mt-6 flex items-start gap-2.5 rounded-xl bg-ok-subtle p-3.5 text-sm font-semibold text-ok-ink">
          <CheckCircle2 aria-hidden="true" size={18} className="mt-0.5 flex-shrink-0" />
          {message}
        </div>
      )}

      {state === "error" && (
        <div role="alert" className="mt-6 flex items-start gap-2.5 rounded-xl bg-bad-subtle p-3.5 text-sm font-semibold text-bad-ink">
          <AlertCircle aria-hidden="true" size={18} className="mt-0.5 flex-shrink-0" />
          {message}
        </div>
      )}

      {state !== "checking" && (
        <Link to="/login" className="btn btn-primary mt-6">
          Go to sign in
        </Link>
      )}
    </AuthShell>
  );
}

export default VerifyEmailPage;
