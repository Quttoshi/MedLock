import { useState } from "react";
import { useNavigate, Link, useLocation } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import api from "../../api/axios";
import PasswordInput from "../../components/PasswordInput";
import AuthShell from "../../components/shell/AuthShell";
import { CheckCircle2, AlertCircle } from "lucide-react";

function LoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { login } = useAuth();

  const [formData, setFormData] = useState({
    email: "",
    password: "",
  });

  const [errors, setErrors] = useState({});
  const [serverError, setServerError] = useState("");
  const [loading, setLoading] = useState(false);
  // Set when login is refused because the email address is not confirmed yet
  const [needsVerification, setNeedsVerification] = useState(false);
  const [resendMessage, setResendMessage] = useState("");
  const [resending, setResending] = useState(false);

  const registered = location.state?.registered;
  const verifyEmail = location.state?.verifyEmail;
  const registeredEmail = location.state?.email;

  // ── Validation ──────────────────────────────────────
  const validate = () => {
    const newErrors = {};
    if (!formData.email.trim()) {
      newErrors.email = "Email is required.";
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      newErrors.email = "Enter a valid email address.";
    }
    if (!formData.password) {
      newErrors.password = "Password is required.";
    }
    return newErrors;
  };

  // ── Handle Input Change ──────────────────────────────
  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
    setErrors({ ...errors, [e.target.name]: "" });
    setServerError("");
  };

  // ── Handle Submit ────────────────────────────────────
  const handleSubmit = async (e) => {
    e.preventDefault();
    const validationErrors = validate();
    if (Object.keys(validationErrors).length > 0) {
      setErrors(validationErrors);
      return;
    }

    setLoading(true);
    setNeedsVerification(false);
    setResendMessage("");
    try {
      const response = await api.post("/auth/login", formData);
      const { access_token, user } = response.data;
      login(user, access_token);

      // Redirect based on role
      if (user.role === "patient") navigate("/patient/dashboard");
      else if (user.role === "doctor") navigate("/doctor/dashboard");
      else if (user.role === "medical_center") navigate("/mc/dashboard");
      else if (user.role === "admin") navigate("/admin/dashboard");
      else navigate("/");
    } catch (err) {
      const detail = err.response?.data?.detail;
      if (err.response?.status === 401) {
        setServerError("Invalid email or password. Please try again.");
      } else if (err.response?.status === 403 && detail?.code === "email_not_verified") {
        setNeedsVerification(true);
        setServerError(detail.message);
      } else if (err.response?.status === 429) {
        setServerError(
          typeof detail === "string"
            ? detail
            : "Account locked due to too many failed attempts. Try again in 15 minutes."
        );
      } else {
        setServerError("Something went wrong. Please try again later.");
      }
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    setResending(true);
    setResendMessage("");
    try {
      const res = await api.post("/auth/resend-verification", {
        email: formData.email || registeredEmail,
      });
      setResendMessage(res.data.message);
    } catch (err) {
      setResendMessage(err.response?.data?.detail || "Could not send the email. Please try again later.");
    } finally {
      setResending(false);
    }
  };

  // ── Render ───────────────────────────────────────────
  return (
    <AuthShell>
      <h1 className="display text-[40px] leading-tight text-ink">Welcome back</h1>
      <p className="mt-2 text-sm text-muted">Sign in to your MedLock account.</p>

      {registered && (
        <div role="status" className="mt-6 flex items-start gap-2.5 rounded-xl bg-ok-subtle p-3.5 text-sm font-semibold text-ok-ink">
          <CheckCircle2 aria-hidden="true" size={18} className="mt-0.5 flex-shrink-0" />
          <span>
            {verifyEmail
              ? `Account created. We sent a confirmation link to ${registeredEmail || "your email"}. Click it, then sign in.`
              : "Account created successfully. Please sign in."}
          </span>
        </div>
      )}

      {serverError && (
        <div role="alert" className="mt-6 flex items-start gap-2.5 rounded-xl bg-bad-subtle p-3.5 text-sm font-semibold text-bad-ink">
          <AlertCircle aria-hidden="true" size={18} className="mt-0.5 flex-shrink-0" />
          <div>
            {serverError}
            {needsVerification && (
              <div className="mt-2">
                <button
                  type="button"
                  onClick={handleResend}
                  disabled={resending}
                  className="link disabled:opacity-50"
                >
                  {resending ? "Sending..." : "Resend confirmation email"}
                </button>
                {resendMessage && <p className="mt-1 font-normal text-ink-soft">{resendMessage}</p>}
              </div>
            )}
          </div>
        </div>
      )}

      <form onSubmit={handleSubmit} noValidate className="mt-6 space-y-5">
        <div>
          <label htmlFor="email" className="field-label">Email</label>
          <input
            id="email"
            type="email"
            name="email"
            autoComplete="email"
            value={formData.email}
            onChange={handleChange}
            placeholder="you@example.com"
            aria-invalid={errors.email ? "true" : undefined}
            aria-describedby={errors.email ? "email-error" : undefined}
            className="field"
          />
          {errors.email && <p id="email-error" className="field-error">{errors.email}</p>}
        </div>

        <div>
          <label htmlFor="password" className="field-label">Password</label>
          <PasswordInput
            id="password"
            name="password"
            autoComplete="current-password"
            value={formData.password}
            onChange={handleChange}
            aria-invalid={errors.password ? "true" : undefined}
            aria-describedby={errors.password ? "password-error" : undefined}
            className="field"
          />
          {errors.password && <p id="password-error" className="field-error">{errors.password}</p>}
        </div>

        <button type="submit" disabled={loading} className="btn btn-primary btn-lg w-full">
          {loading ? "Signing in..." : "Sign in"}
        </button>
      </form>

      <p className="mt-6 text-center text-sm text-muted">
        New to MedLock?{" "}
        <Link to="/register" className="link">Create an account</Link>
      </p>
    </AuthShell>
  );
}

export default LoginPage;
