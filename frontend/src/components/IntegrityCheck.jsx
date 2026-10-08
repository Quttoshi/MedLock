import { useState } from "react";

const STATUS_STYLES = {
  verified: {
    box: "bg-ok-subtle",
    title: "text-ok-ink",
    label: "Verified. This report has not been altered.",
  },
  tampered: {
    box: "bg-bad-subtle",
    title: "text-bad-ink",
    label: "Tampering detected. This report does not match its record.",
  },
  unverifiable: {
    box: "bg-inset",
    title: "text-ink-soft",
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
        className="btn btn-primary btn-sm"
      >
        {checking ? "Checking..." : result ? "Verify again" : "Verify integrity"}
      </button>

      {error && <p className="mt-3 text-sm font-semibold text-bad-ink">{error}</p>}

      {result && (
        <div className={`mt-3 rounded-2xl p-4 ${style.box}`}>
          <p className={`text-sm font-bold ${style.title}`}>{style.label}</p>
          {result.reason && <p className="mt-1 text-sm text-ink-soft">{result.reason}</p>}

          <ul className="mt-3 space-y-1.5">
            {result.checks.map((check) => (
              <li key={check.check} className="text-sm">
                <span className={check.passed ? "text-ok-ink" : "text-bad-ink"}>
                  {check.passed ? "Passed" : "Failed"}: {check.label}
                </span>
                {check.detail && <p className="ml-4 break-all text-muted">{check.detail}</p>}
              </li>
            ))}
          </ul>

          {result.explorer_url && (
            <a
              href={result.explorer_url}
              target="_blank"
              rel="noopener noreferrer"
              className="link mt-3 inline-block text-sm"
            >
              View blockchain record (block {result.block_number})
            </a>
          )}
        </div>
      )}
    </div>
  );
}

export default IntegrityCheck;
