import { useCallback, useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { ArrowLeft, Download, ShieldCheck, FileText } from "lucide-react";
import { sourceLabel } from "../../adapters/patientStory";
import { useAuth } from "../../context/AuthContext";
import {
  downloadReport,
  getImagingPreview,
  getImagingSlices,
  getImagingStudy,
  getPatientReports,
  verifyReport,
} from "../../api/doctor";
import ImagingStudyView from "../../components/ImagingStudyView";
import { imagingDownloadName } from "../../utils/imaging";
import IntegrityCheck from "../../components/IntegrityCheck";
import ReportThreads from "../../components/ReportThreads";
import { parseServerDate } from "../../utils/dates";

function ReportViewer() {
  const { token } = useAuth();
  const { patientId, reportId } = useParams();

  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(true);
  const [downloading, setDownloading] = useState(false);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [previewType, setPreviewType] = useState(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [error, setError] = useState("");
  // The Questions card's response; undefined until it loads. A doctor keeps reading their
  // own thread after their access to the report ends.
  const [threadInfo, setThreadInfo] = useState(undefined);

  // Stable references: ImagingStudyView reloads whenever these change.
  const fetchImagingStudy = useCallback(
    () => getImagingStudy(token, patientId, reportId),
    [token, patientId, reportId]
  );
  const fetchImagingPreview = useCallback(
    (seriesId) => getImagingPreview(token, patientId, reportId, seriesId),
    [token, patientId, reportId]
  );
  const fetchImagingSlices = useCallback(
    (seriesId, onProgress) => getImagingSlices(token, patientId, reportId, seriesId, onProgress),
    [token, patientId, reportId]
  );

  // ── Fetch report metadata ────────────────────────────
  useEffect(() => {
    getPatientReports(token, patientId)
      .then((res) => {
        const found = res.data.find((r) => r.id === reportId);
        setReport(found || null);
      })
      .catch(() => setReport(null))
      .finally(() => setLoading(false));
  }, [token, patientId, reportId]);

  // ── Load preview ─────────────────────────────────────
  useEffect(() => {
    // Imaging studies show series previews instead; downloading the whole study here would be wasteful.
    if (!report || report.report_type === "imaging") return;
    setPreviewLoading(true);
    downloadReport(token, patientId, reportId)
      .then((res) => {
        const filename = report.original_filename || "";
        let mimeType = "application/octet-stream";
        let type = "unknown";
        if (filename.endsWith(".pdf")) {
          mimeType = "application/pdf";
          type = "pdf";
        } else if (filename.endsWith(".jpg") || filename.endsWith(".jpeg")) {
          mimeType = "image/jpeg";
          type = "image";
        } else if (filename.endsWith(".png")) {
          mimeType = "image/png";
          type = "image";
        } else if (filename.endsWith(".tiff") || filename.endsWith(".tif")) {
          mimeType = "image/tiff";
          type = "image";
        }
        const blob = new Blob([res.data], { type: mimeType });
        const url = window.URL.createObjectURL(blob);
        setPreviewUrl(url);
        setPreviewType(type);
      })
      .catch(() => {
        setError("Could not load preview. You can still download the file.");
        setPreviewType("unknown");
      })
      .finally(() => setPreviewLoading(false));

    // Cleanup blob URL on unmount
    return () => {
      if (previewUrl) window.URL.revokeObjectURL(previewUrl);
    };
  }, [report]);

  // ── Download ─────────────────────────────────────────
  const handleDownload = async () => {
    setDownloading(true);
    try {
      const res = await downloadReport(token, patientId, reportId);
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const a = document.createElement("a");
      a.href = url;
      a.download =
        report?.report_type === "imaging"
          ? imagingDownloadName(report.original_filename)
          : report?.original_filename || "report";
      a.click();
      window.URL.revokeObjectURL(url);
    } catch {
      alert("Download failed. Please try again.");
    }
    setDownloading(false);
  };

  const formatDate = (dateStr) =>
    dateStr
      ? parseServerDate(dateStr).toLocaleDateString("en-PK", {
          day: "numeric",
          month: "long",
          year: "numeric",
          hour: "2-digit",
          minute: "2-digit",
        })
      : "—";

  // ── Loading ───────────────────────────────────────────
  if (loading) {
    return <p className="py-24 text-center text-muted">Loading...</p>;
  }

  // ── Not found, or access ended ────────────────────────
  if (!report) {
    const hasThread = threadInfo?.threads?.length > 0;
    return (
      <div className="mx-auto max-w-5xl space-y-5">
        {hasThread ? (
          <>
            <Link to="/doctor/patients" className="link inline-flex items-center gap-2 text-sm no-underline hover:underline">
              <ArrowLeft aria-hidden="true" size={16} />
              Back to patients
            </Link>
            <section className="card card-pad">
              <p className="eyebrow">{threadInfo.report_filename}</p>
              <h1 className="display mt-2 text-[26px] leading-tight text-ink">Report no longer available</h1>
              <p className="mt-2 text-sm leading-6 text-muted">
                You no longer have access to this patient's records, so the report is hidden. Your conversation with
                the patient about it is kept below, read-only.
              </p>
            </section>
          </>
        ) : (
          threadInfo !== undefined && (
            <div className="py-24 text-center">
              <p className="display text-xl text-ink">Report not found</p>
              <Link to={`/doctor/patients/${patientId}/reports`} className="link mt-4 inline-block text-sm">
                Back to records
              </Link>
            </div>
          )
        )}
        <ReportThreads token={token} reportId={reportId} role="doctor" onLoad={setThreadInfo} />
      </div>
    );
  }

  const typeLabel = report.report_type?.replace(/_/g, " ") || "Report";

  return (
    <div className="mx-auto max-w-5xl space-y-5">

      <Link to={`/doctor/patients/${patientId}/reports`} className="link inline-flex items-center gap-2 text-sm no-underline hover:underline">
        <ArrowLeft aria-hidden="true" size={16} />
        Back to records
      </Link>

      {/* Header */}
      <section className="card card-pad">
        <div className="flex flex-wrap items-start justify-between gap-5">
          <div className="min-w-0">
            <p className="eyebrow">{typeLabel}</p>
            <h1 className="display mt-2 break-words text-[26px] leading-tight text-ink sm:text-[30px]">
              {report.original_filename || "Medical report"}
            </h1>
            <p className="mt-2 text-sm text-muted">
              Uploaded {formatDate(report.uploaded_at || report.created_at)}
            </p>
            <p className="text-sm text-muted">{sourceLabel(report.upload_source)}</p>
          </div>
          <button type="button" onClick={handleDownload} disabled={downloading} className="btn btn-secondary btn-sm">
            <Download aria-hidden="true" size={16} />
            {downloading ? "Downloading..." : "Download report"}
          </button>
        </div>

        <div className="card-inset mt-5 p-4">
          <p className="eyebrow mb-1.5">SHA 256 fingerprint</p>
          <p className="hash !text-ink-soft">
            {report.file_hash_sha256 ? `${report.file_hash_sha256.slice(0, 20)}...` : "-"}
          </p>
        </div>
      </section>

      {/* Integrity */}
      <section className="card card-pad">
        <h2 className="display flex items-center gap-2.5 text-xl text-ink">
          <ShieldCheck aria-hidden="true" size={24} className="text-brand" />
          File integrity
        </h2>
        <p className="mt-2 text-sm leading-6 text-muted">
          Confirms the stored file matches the fingerprint recorded on Ethereum Sepolia testnet when it was uploaded.
        </p>
        <IntegrityCheck verify={() => verifyReport(token, patientId, reportId)} />
      </section>

      {report.report_type === "imaging" ? (
        <section className="card card-pad">
          <h2 className="display mb-4 text-xl text-ink">Imaging study</h2>
          <ImagingStudyView
            fetchStudy={fetchImagingStudy}
            fetchPreview={fetchImagingPreview}
            fetchSlices={fetchImagingSlices}
          />
        </section>
      ) : (
        <section className="card card-pad">
          <h2 className="display mb-4 text-xl text-ink">Report preview</h2>

          {error && <div role="alert" className="mb-4 rounded-xl bg-bad-subtle p-3.5 text-sm font-semibold text-bad-ink">{error}</div>}

          {previewLoading && (
            <div className="card-inset flex h-64 items-center justify-center text-sm text-muted">Loading preview...</div>
          )}

          {!previewLoading && previewType === "pdf" && previewUrl && (
            <div className="overflow-hidden rounded-2xl border border-line">
              <iframe src={previewUrl} title="Report preview" className="w-full" style={{ height: "700px" }} />
            </div>
          )}

          {!previewLoading && previewType === "image" && previewUrl && (
            <div className="card-inset flex items-center justify-center p-4">
              <img src={previewUrl} alt="Report" className="max-h-[700px] max-w-full rounded-xl object-contain" />
            </div>
          )}

          {!previewLoading && previewType === "unknown" && (
            <div className="card-inset flex h-64 flex-col items-center justify-center px-4 text-center">
              <FileText aria-hidden="true" size={28} className="text-muted" />
              <p className="mt-2 text-sm font-bold text-ink">Preview not available</p>
              <p className="mb-4 mt-1 text-sm text-muted">This file type cannot be previewed in the browser.</p>
              <button type="button" onClick={handleDownload} disabled={downloading} className="btn btn-primary btn-sm">
                {downloading ? "Downloading..." : "Download to view"}
              </button>
            </div>
          )}
        </section>
      )}

      <ReportThreads token={token} reportId={reportId} role="doctor" />

      <div className="panel-deep flex gap-4 p-5">
        <ShieldCheck aria-hidden="true" size={22} className="mt-0.5 flex-shrink-0 text-deep-on-muted" />
        <div>
          <p className="text-sm font-bold">Encrypted access</p>
          <p className="mt-1 text-sm leading-5 text-deep-on-soft">
            This report is stored encrypted with AES 256 and decrypted only to show it to you. Your access is logged, and the patient can take it back at any time.
          </p>
        </div>
      </div>
    </div>
  );
}

export default ReportViewer;
