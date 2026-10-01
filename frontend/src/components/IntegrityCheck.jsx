import { useState } from "react";

const STATUS_STYLES = {
  verified: {
    box: "bg-green-50 border-green-200",
    title: "text-green-800",
    label: "Verified — this report has not been altered",
  },
  tampered: {
    box: "bg-red-50 border-red-200",
    title: "text-red-800",
    label: "Tampering detected — this report does not match its record",
  },
  unverifiable: {
    box: "bg-gray-50 border-gray-200",
    title: "text-gray-700",
    label: "Cannot verify yet",
  },
};

// Runs the server-side integrity check: stored file vs. recorded hash vs. blockchain record.
// `verify` is a function returning the axios request for the role-specific verify endpoint.
function IntegrityCheck({ verify }) {
  const [result, setResult] = useState(null);
  const [checking, setChecking] = useState(false);
  const [error, setError] = useState("");

  const runCheck = async () => {
    setChecking(true);
    setError("");
    try {
      const res = await verify();
      setResult(res.data);
    } catch (err) {
      setResult(null);
      setError(err.response?.data?.detail || "Could not run the integrity check. Please try again.");
    }
    setChecking(false);
  };

  const style = result ? STATUS_STYLES[result.status] || STATUS_STYLES.unverifiable : null;

  return (
    <div className="mt-4">
      <button
        onClick={runCheck}
        disabled={checking}
        className="px-4 py-2 bg-blue-700 text-white text-sm font-medium rounded-xl hover:bg-blue-800 transition disabled:opacity-50"
      >
        {checking ? "Checking..." : result ? "Verify again" : "Verify integrity"}
      </button>

      {error && <p className="mt-3 text-sm text-red-600">{error}</p>}

      {result && (
        <div className={`mt-3 border rounded-xl p-4 ${style.box}`}>
          <p className={`text-sm font-semibold ${style.title}`}>{style.label}</p>
          {result.reason && <p className="text-xs text-gray-600 mt-1">{result.reason}</p>}

          <ul className="mt-3 space-y-1.5">
            {result.checks.map((check) => (
              <li key={check.check} className="text-xs">
                <span className={check.passed ? "text-green-700" : "text-red-700"}>
                  {check.passed ? "✓" : "✗"} {check.label}
                </span>
                {check.detail && <p className="text-gray-500 ml-4 break-all">{check.detail}</p>}
              </li>
            ))}
          </ul>

          {result.explorer_url && (
            <a
              href={result.explorer_url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-block mt-3 text-xs text-blue-600 hover:underline"
            >
              View blockchain record (block {result.block_number}) →
            </a>
          )}
        </div>
      )}
    </div>
  );
}

export default IntegrityCheck;
