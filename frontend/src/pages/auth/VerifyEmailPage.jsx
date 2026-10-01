import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import api from "../../api/axios";

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
    <div className="auth-shell min-h-screen flex items-center justify-center px-4">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-lg p-8 border border-white/70 text-center">
        <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-br from-blue-600 to-teal-500 rounded-2xl mb-4 shadow-lg shadow-blue-100">
          <span className="text-white text-2xl font-bold">M</span>
        </div>
        <h1 className="text-2xl font-bold text-slate-900 mb-4">Email confirmation</h1>

        {state === "checking" && <p className="text-gray-500 text-sm">Confirming your email address...</p>}

        {state === "success" && (
          <div className="p-3 bg-green-50 border border-green-200 rounded-lg text-green-700 text-sm">
            {message}
          </div>
        )}

        {state === "error" && (
          <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-600 text-sm">{message}</div>
        )}

        {state !== "checking" && (
          <Link
            to="/login"
            className="inline-block mt-6 px-5 py-2.5 bg-blue-700 text-white text-sm font-medium rounded-xl hover:bg-blue-800 transition"
          >
            Go to login
          </Link>
        )}
      </div>
    </div>
  );
}

export default VerifyEmailPage;
