import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import api from "../../api/axios";

function LoginPage() {
  const navigate = useNavigate();
  const { login } = useAuth();

  const [formData, setFormData] = useState({
    email: "",
    password: "",
  });

  const [errors, setErrors] = useState({});
  const [serverError, setServerError] = useState("");
  const [loading, setLoading] = useState(false);

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
    try {
      const response = await api.post("/auth/login", formData);
      const { token, user } = response.data;
      login(user, token);

      // Redirect based on role
      if (user.role === "patient") navigate("/patient/dashboard");
      else if (user.role === "doctor") navigate("/doctor/dashboard");
      else if (user.role === "medical_center") navigate("/mc/dashboard");
      else if (user.role === "admin") navigate("/admin/dashboard");
      else navigate("/");
    } catch (err) {
      if (err.response?.status === 401) {
        setServerError("Invalid email or password. Please try again.");
      } else if (err.response?.status === 423) {
        setServerError(
          "Account locked due to too many failed attempts. Try again in 15 minutes."
        );
      } else {
        setServerError("Something went wrong. Please try again later.");
      }
    } finally {
      setLoading(false);
    }
  };

  // ── Render ───────────────────────────────────────────
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 
                    flex items-center justify-center px-4">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-lg p-8">

        {/* Logo + Title */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 
                          bg-blue-600 rounded-2xl mb-4">
            <span className="text-white text-2xl font-bold">M</span>
          </div>
          <h1 className="text-3xl font-bold text-gray-800">MedLock</h1>
          <p className="text-gray-500 mt-1 text-sm">
            Sign in to your account
          </p>
        </div>

        {/* Server Error Banner */}
        {serverError && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 
                          rounded-lg text-red-600 text-sm">
            {serverError}
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} noValidate>

          {/* Email */}
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Email Address
            </label>
            <input
              type="email"
              name="email"
              value={formData.email}
              onChange={handleChange}
              placeholder="you@example.com"
              className={`w-full px-4 py-2.5 border rounded-lg text-sm 
                          focus:outline-none focus:ring-2 focus:ring-blue-500 
                          transition
                          ${errors.email
                            ? "border-red-400 bg-red-50"
                            : "border-gray-300 bg-white"
                          }`}
            />
            {errors.email && (
              <p className="text-red-500 text-xs mt-1">{errors.email}</p>
            )}
          </div>

          {/* Password */}
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Password
            </label>
            <input
              type="password"
              name="password"
              value={formData.password}
              onChange={handleChange}
              placeholder="••••••••"
              className={`w-full px-4 py-2.5 border rounded-lg text-sm 
                          focus:outline-none focus:ring-2 focus:ring-blue-500 
                          transition
                          ${errors.password
                            ? "border-red-400 bg-red-50"
                            : "border-gray-300 bg-white"
                          }`}
            />
            {errors.password && (
              <p className="text-red-500 text-xs mt-1">{errors.password}</p>
            )}
          </div>

          {/* Submit Button */}
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white 
                       font-semibold py-2.5 rounded-lg transition 
                       disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {loading ? (
              <span className="flex items-center justify-center gap-2">
                <svg className="animate-spin h-4 w-4 text-white"
                  xmlns="http://www.w3.org/2000/svg" fill="none"
                  viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10"
                    stroke="currentColor" strokeWidth="4"/>
                  <path className="opacity-75" fill="currentColor"
                    d="M4 12a8 8 0 018-8v8z"/>
                </svg>
                Signing in...
              </span>
            ) : "Sign In"}
          </button>
        </form>

        {/* Register Link */}
        <p className="text-center text-sm text-gray-500 mt-6">
          Don't have an account?{" "}
          <Link to="/register"
            className="text-blue-600 hover:underline font-medium">
            Register here
          </Link>
        </p>
      </div>
      {/* Dev Test Button */}
{import.meta.env.DEV && (
  <button
    onClick={() => {
      login(
        { name: "Shehbaz Karim", role: "patient",
          email: "shehbaz@example.com" },
        "test-token"
      );
      navigate("/patient/dashboard");
    }}
    className="w-full mt-3 border-2 border-dashed border-gray-300 
               text-gray-400 hover:border-blue-400 hover:text-blue-500 
               font-medium py-2.5 rounded-lg transition text-sm"
  >
    🧪 Dev: Skip Login → Patient Dashboard
  </button>
)}
    </div>
  );
}

export default LoginPage;