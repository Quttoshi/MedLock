import { useState, useEffect, useCallback } from "react";
import { useParams, Link } from "react-router-dom";
import { ArrowLeft, Download, ShieldCheck, ExternalLink } from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import api from "../../api/axios";
import IntegrityCheck from "../../components/IntegrityCheck";
import ImagingStudyView from "../../components/ImagingStudyView";
import ReportThreads from "../../components/ReportThreads";
import ReportResults from "../../components/results/ReportResults";
import { getMyReportResults } from "../../api/results";
import { imagingDownloadName } from "../../utils/imaging";
import StatusPill from "../../components/ui/StatusPill";
import { sourceLabel } from "../../adapters/patientStory";
import { parseServerDate } from "../../utils/dates";

function BlockchainBadge({ logs }) {
  if (!logs || logs.length === 0) return null;

  const confirmed = logs.some((l) => l.status === "confirmed");
  const pending = logs.some((l) => l.status === "pending");

  if (confirmed) return <StatusPill tone="ok">Recorded on Sepolia testnet</StatusPill>;
  if (pending) return <StatusPill tone="warn">Recording on blockchain</StatusPill>;
  return <StatusPill tone="plain">Not on chain yet</StatusPill>;
}

function ReportDetail() {
  const { id } = useParams();
  const { token } = useAuth();

  const [report, setReport] = useState(null);
  const [blockchainLogs, setBlockchainLogs] = useState([]);
  const [loading, setLoading] = useState(true);

  // Stable references: ImagingStudyView reloads whenever these change.
  const fetchImagingStudy = useCallback(
    () => api.get(`/reports/${id}/imaging`, { headers: { Authorization: `Bearer ${token}` } }),
    [id, token]
  );
  const fetchImagingSlices = useCallback(
    (seriesId, onProgress) =>
      api.get(`/reports/${id}/imaging/series/${seriesId}/slices`, {
        headers: { Authorization: `Bearer ${token}` },
        responseType: "arraybuffer",
        onDownloadProgress: onProgress,
      }),
    [id, token]
  );
  const fetchImagingPreview = useCallback(
    (seriesId) =>
      api.get(`/reports/${id}/imaging/series/${seriesId}/preview`, {
        headers: { Authorization: `Bearer ${token}` },
        responseType: "blob",
      }),
    [id, token]
  );

  const fetchResults = useCallback(() => getMyReportResults(token, id), [id, token]);

  // ── Fetch Report + Blockchain ────────────────────────
  useEffect(() => {
    const headers = { Authorization: `Bearer ${token}` };
    const fetchAll = async () => {
      try {
        const res = await api.get(`/reports/${id}`, { headers });
        setReport(res.data);
        try {
          const chainRes = await api.get(`/reports/${id}/blockchain`, { headers });
          let logs = chainRes.data;
          // Auto-confirm any pending transactions
          if (logs.some((l) => l.status === "pending")) {
            try {
              await api.post(`/reports/${id}/blockchain/confirm`, {}, { headers });
              const refreshed = await api.get(`/reports/${id}/blockchain`, { headers });
              logs = refreshed.data;
            } catch {
              // Still pending; it shows as such until the next visit.
            }
          }
          setBlockchainLogs(logs);
        } catch {
          setBlockchainLogs([]);
        }
      } catch {
        setReport(null);
      } finally {
        setLoading(false);
      }
    };
    fetchAll();
  }, [id, token]);

  // ── Download Report ──────────────────────────────────
  const handleDownload = async () => {
    try {
      const res = await api.get(`/reports/${id}/download`, {
        headers: { Authorization: `Bearer ${token}` },
        responseType: "blob",
      });
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const link = document.createElement("a");
      link.href = url;
      link.setAttribute(
        "download",
        report.report_type === "imaging"
          ? imagingDownloadName(report.original_filename)
          : report.original_filename || "report"
      );
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch {
      alert("Download failed. Please try again.");
    }
  };

  const formatDate = (dateStr) =>
    parseServerDate(dateStr).toLocaleDateString("en-PK", {
      day: "numeric", month: "long", year: "numeric",
      hour: "2-digit", minute: "2-digit",
    });

  // ── Not found ────────────────────────────────────────
  if (!loading && !report) {
    return (
      <div className="mx-auto max-w-4xl py-24 text-center">
        <p className="display text-xl text-ink">Report not found</p>
        <Link to="/patient/reports" className="link mt-4 inline-block text-sm">
          Back to your records
        </Link>
      </div>
    );
  }

  // ── Loading ───────────────────────────────────────────
  if (loading) {
    return <p className="py-24 text-center text-muted">Loading your record...</p>;
  }

  return (
    <div className="mx-auto max-w-4xl space-y-5">

      <Link to="/patient/reports" className="link inline-flex items-center gap-2 text-sm no-underline hover:underline">
        <ArrowLeft aria-hidden="true" size={16} />
        Back to your records
      </Link>

      {/* Header */}
      <section className="card card-pad">
        <div className="flex flex-wrap items-start justify-between gap-5">
          <div className="min-w-0">
            <p className="eyebrow">{report.report_type}</p>
            <h1 className="display mt-2 break-words text-[26px] leading-tight text-ink sm:text-[30px]">
              {report.original_filename || report.name}
            </h1>
            <p className="mt-2 text-sm text-muted">
              Uploaded {formatDate(report.uploaded_at || report.upload_date)}
            </p>
            <p className="text-sm text-muted">{sourceLabel(report.upload_source)}</p>
          </div>
          <div className="flex flex-col items-start gap-3 sm:items-end">
            <BlockchainBadge logs={blockchainLogs} />
            <button type="button" onClick={handleDownload} className="btn btn-secondary btn-sm">
              <Download aria-hidden="true" size={16} />
              Download original
            </button>
          </div>
        </div>
      </section>

      {/* Imaging Study */}
      {report.report_type === "imaging" && (
        <section className="card card-pad">
          <h2 className="display mb-4 text-xl text-ink">Imaging study</h2>
          <ImagingStudyView
            fetchStudy={fetchImagingStudy}
            fetchPreview={fetchImagingPreview}
            fetchSlices={fetchImagingSlices}
          />
        </section>
      )}

      {/* Values read from a lab report, with range bars; the patient can check them. */}
      {report.report_type !== "imaging" && <ReportResults token={token} load={fetchResults} canConfirm />}

      {/* Questions: private threads with the doctors who have access. Medical-center
          uploads can be discussed once the patient approves them. */}
      {report.is_approved !== false && <ReportThreads token={token} reportId={id} role="patient" />}

      {/* Integrity */}
      <section className="card card-pad">
        <h2 className="display flex items-center gap-2.5 text-xl text-ink">
          <ShieldCheck aria-hidden="true" size={24} className="text-brand" />
          File integrity
        </h2>
        <p className="mt-2 text-sm leading-6 text-muted">
          Your file is encrypted with AES 256 before storage. Its SHA 256 fingerprint is recorded on Ethereum Sepolia testnet, so any change to the file can be detected.
        </p>
        <div className="card-inset mt-4 p-4">
          <p className="eyebrow mb-1.5">SHA 256 fingerprint</p>
          <p className="hash !text-ink-soft">{report.file_hash_sha256}</p>
        </div>
        {blockchainLogs.length > 0 && (
          <ul className="mt-3 space-y-2">
            {blockchainLogs.map((log) => (
              <li key={log.id} className="card-inset flex flex-wrap items-center justify-between gap-x-4 gap-y-1 px-4 py-3 text-sm">
                <span className="font-semibold capitalize text-ink">{log.event_type?.replace("_", " ")}</span>
                <span className={`font-semibold capitalize ${log.status === "confirmed" ? "text-ok-ink" : "text-warn-ink"}`}>
                  {log.status}
                </span>
                {log.explorer_url && (
                  <a href={log.explorer_url} target="_blank" rel="noopener noreferrer" className="link inline-flex items-center gap-1">
                    View on Etherscan
                    <ExternalLink aria-hidden="true" size={14} />
                  </a>
                )}
              </li>
            ))}
          </ul>
        )}
        <IntegrityCheck
          verify={() =>
            api.get(`/reports/${id}/verify`, { headers: { Authorization: `Bearer ${token}` } })
          }
        />
      </section>
    </div>
  );
}

export default ReportDetail;
