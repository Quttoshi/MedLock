import { useCallback, useEffect, useState } from "react";
import SliceViewer from "./SliceViewer";

const POLL_MS = 5000;

const formatDate = (value) =>
  value ? new Date(value).toLocaleDateString("en-PK", { day: "numeric", month: "long", year: "numeric" }) : "—";

const formatNumber = (value, unit) => (value === null || value === undefined ? null : `${+value.toFixed(2)} ${unit}`);

function SeriesPreview({ series, fetchPreview }) {
  const [url, setUrl] = useState(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (!series.has_preview) return undefined;
    let objectUrl = null;
    let cancelled = false;
    fetchPreview(series.id)
      .then((res) => {
        if (cancelled) return;
        objectUrl = window.URL.createObjectURL(res.data);
        setUrl(objectUrl);
      })
      .catch(() => !cancelled && setFailed(true));
    return () => {
      cancelled = true;
      if (objectUrl) window.URL.revokeObjectURL(objectUrl);
    };
  }, [series.id, series.has_preview, fetchPreview]);

  if (!series.has_preview || failed) {
    return (
      <div className="aspect-square bg-inset rounded-xl flex items-center justify-center text-xs text-muted">
        No preview
      </div>
    );
  }
  if (!url) return <div className="aspect-square bg-inset rounded-xl animate-pulse" />;
  return (
    <img
      src={url}
      alt={series.description || "Series preview"}
      className="aspect-square w-full object-contain bg-black rounded-xl"
    />
  );
}

// Shows a DICOM study's details and series previews, polling while it is still processing.
// `fetchStudy()`, `fetchPreview(seriesId)` and `fetchSlices(seriesId, onProgress)` return axios
// requests (preview as a "blob", slices as an "arraybuffer" zip). Callers must pass stable functions.
function ImagingStudyView({ fetchStudy, fetchPreview, fetchSlices }) {
  const [study, setStudy] = useState(null);
  const [error, setError] = useState("");
  const [viewing, setViewing] = useState(null); // series open in the slice viewer
  const loadSlices = useCallback(
    (onProgress) => fetchSlices(viewing.id, onProgress),
    [fetchSlices, viewing]
  );

  useEffect(() => {
    let timer = null;
    let cancelled = false;
    const load = () =>
      fetchStudy()
        .then((res) => {
          if (cancelled) return;
          setStudy(res.data);
          if (["pending", "processing"].includes(res.data.processing_status)) {
            timer = setTimeout(load, POLL_MS);
          }
        })
        .catch((err) => !cancelled && setError(err.response?.data?.detail || "Could not load the imaging study."));
    load();
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [fetchStudy]);

  if (error) return <p className="text-sm text-bad-ink">{error}</p>;
  if (!study) return <p className="text-sm text-muted">Loading imaging study...</p>;

  const processing = ["pending", "processing"].includes(study.processing_status);
  const details = [
    ["Modality", study.modality],
    ["Body part", study.body_part],
    ["Study date", formatDate(study.study_date)],
    ["Description", study.study_description],
    ["Institution", study.institution],
    ["Scanner", study.manufacturer],
    ["Series", study.series_count],
    ["Images", study.instance_count],
  ];

  return (
    <div>
      {processing && (
        <div className="mb-4 p-3 bg-warn-subtle rounded-xl text-sm text-warn-ink">
          This study is being encrypted and processed. Previews appear here automatically when it's ready.
        </div>
      )}
      {study.processing_status === "failed" && (
        <div className="mb-4 p-3 bg-bad-subtle rounded-xl text-sm text-bad-ink">
          This study could not be processed. Please upload it again.
        </div>
      )}

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
        {details.map(([label, value]) => (
          <div key={label} className="bg-inset rounded-xl p-3">
            <p className="text-xs font-semibold text-muted uppercase tracking-wide">{label}</p>
            <p className="text-sm text-ink mt-0.5 break-words">{value ?? "—"}</p>
          </div>
        ))}
      </div>

      {study.series.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
          {study.series.map((series) => {
            const facts = [
              series.instance_count && `${series.instance_count} image${series.instance_count === 1 ? "" : "s"}`,
              series.rows && series.columns && `${series.columns}×${series.rows}`,
              formatNumber(series.slice_thickness_mm, "mm slices"),
              series.sequence_name && `Sequence ${series.sequence_name}`,
              formatNumber(series.magnetic_field_strength_t, "T"),
              series.contrast_agent && `Contrast: ${series.contrast_agent}`,
            ].filter(Boolean);
            return (
              <div key={series.id}>
                <SeriesPreview series={series} fetchPreview={fetchPreview} />
                <p className="text-sm font-medium text-ink mt-2">
                  {series.description || `Series ${series.series_number ?? ""}`}
                  {series.modality && <span className="text-muted font-normal"> · {series.modality}</span>}
                </p>
                <p className="text-xs text-muted">{facts.join(" · ")}</p>
                {series.slice_count > 0 && (
                  <button
                    onClick={() => setViewing(series)}
                    className="mt-2 px-3 py-1.5 text-xs font-medium rounded-lg bg-brand text-brand-on hover:bg-brand-strong transition"
                  >
                    Open viewer ({series.slice_count} slice{series.slice_count === 1 ? "" : "s"})
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}

      {viewing && (
        <SliceViewer
          title={`${viewing.description || `Series ${viewing.series_number ?? ""}`}${viewing.modality ? ` · ${viewing.modality}` : ""}`}
          loadSlices={loadSlices}
          onClose={() => setViewing(null)}
        />
      )}
    </div>
  );
}

export default ImagingStudyView;
