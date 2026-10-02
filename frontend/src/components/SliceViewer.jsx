import { useCallback, useEffect, useRef, useState } from "react";
import { unzipSync } from "fflate";

const MIN_ZOOM = 1;
const MAX_ZOOM = 8;
const clamp = (value, low, high) => Math.min(high, Math.max(low, value));

// Full-screen slice viewer for one imaging series.
// `loadSlices(onProgress)` returns an axios request for the series' zip of JPEG slices
// (responseType "arraybuffer"); slices are decoded in the browser and never stored.
//
// Controls: mouse wheel / arrow keys = change slice, Ctrl + wheel or +/- = zoom,
// drag = pan when zoomed, 0 = reset view, Esc = close.
function SliceViewer({ title, loadSlices, onClose }) {
  const [slices, setSlices] = useState([]);
  const [index, setIndex] = useState(0);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState("");
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [brightness, setBrightness] = useState(100);
  const [contrast, setContrast] = useState(100);
  const stageRef = useRef(null);
  const dragRef = useRef(null);

  // ── Load and unpack the slices ──────────────────────
  useEffect(() => {
    let urls = [];
    let cancelled = false;
    loadSlices((event) => event.total && setProgress(Math.round((event.loaded * 100) / event.total)))
      .then((res) => {
        if (cancelled) return;
        const files = unzipSync(new Uint8Array(res.data));
        urls = Object.keys(files)
          .sort()
          .map((name) => window.URL.createObjectURL(new Blob([files[name]], { type: "image/jpeg" })));
        setSlices(urls);
        setIndex(Math.floor(urls.length / 2));
      })
      .catch((err) => !cancelled && setError(err.response?.status === 404
        ? "Slices for this series are not available yet. Please try again shortly."
        : "Could not load the slices for this series."));
    return () => {
      cancelled = true;
      urls.forEach((url) => window.URL.revokeObjectURL(url));
    };
  }, [loadSlices]);

  const step = useCallback(
    (delta) => setIndex((i) => clamp(i + delta, 0, Math.max(slices.length - 1, 0))),
    [slices.length]
  );
  const zoomBy = useCallback((factor) => {
    setZoom((z) => {
      const next = clamp(z * factor, MIN_ZOOM, MAX_ZOOM);
      if (next === MIN_ZOOM) setPan({ x: 0, y: 0 });
      return next;
    });
  }, []);
  const resetView = () => {
    setZoom(1);
    setPan({ x: 0, y: 0 });
    setBrightness(100);
    setContrast(100);
  };

  // ── Mouse wheel: slices, or zoom with Ctrl ──────────
  // Registered manually because React's onWheel is passive and can't block page zoom/scroll.
  useEffect(() => {
    const stage = stageRef.current;
    if (!stage) return undefined;
    const onWheel = (event) => {
      event.preventDefault();
      if (event.ctrlKey) zoomBy(event.deltaY < 0 ? 1.2 : 1 / 1.2);
      else step(event.deltaY > 0 ? 1 : -1);
    };
    stage.addEventListener("wheel", onWheel, { passive: false });
    return () => stage.removeEventListener("wheel", onWheel);
  }, [step, zoomBy, slices.length]);

  // ── Keyboard ────────────────────────────────────────
  useEffect(() => {
    const onKey = (event) => {
      if (event.key === "Escape") onClose();
      else if (event.key === "ArrowUp" || event.key === "ArrowLeft") step(-1);
      else if (event.key === "ArrowDown" || event.key === "ArrowRight") step(1);
      else if (event.key === "+" || event.key === "=") zoomBy(1.2);
      else if (event.key === "-") zoomBy(1 / 1.2);
      else if (event.key === "0") {
        setZoom(1);
        setPan({ x: 0, y: 0 });
      } else return;
      event.preventDefault();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose, step, zoomBy]);

  // ── Drag to pan while zoomed ────────────────────────
  const onPointerDown = (event) => {
    if (zoom === 1) return;
    dragRef.current = { x: event.clientX - pan.x, y: event.clientY - pan.y };
    event.currentTarget.setPointerCapture(event.pointerId);
  };
  const onPointerMove = (event) => {
    if (!dragRef.current) return;
    setPan({ x: event.clientX - dragRef.current.x, y: event.clientY - dragRef.current.y });
  };
  const onPointerUp = () => {
    dragRef.current = null;
  };

  const loading = !error && slices.length === 0;

  return (
    <div className="fixed inset-0 z-50 bg-black/95 flex flex-col text-white" role="dialog" aria-modal="true">
      {/* Top bar */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-white/10">
        <div>
          <p className="text-sm font-semibold">{title}</p>
          {slices.length > 0 && (
            <p className="text-xs text-gray-400">
              Slice {index + 1} / {slices.length} · Zoom {zoom.toFixed(1)}×
            </p>
          )}
        </div>
        <button
          onClick={onClose}
          className="px-3 py-1.5 text-sm rounded-lg bg-white/10 hover:bg-white/20 transition"
        >
          Close (Esc)
        </button>
      </div>

      {/* Image */}
      <div
        ref={stageRef}
        className={`flex-1 overflow-hidden flex items-center justify-center select-none ${
          zoom > 1 ? "cursor-grab active:cursor-grabbing" : ""
        }`}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
      >
        {loading && (
          <div className="w-64 text-center">
            <p className="text-sm text-gray-300 mb-2">Loading slices... {progress}%</p>
            <div className="h-1.5 bg-white/10 rounded-full overflow-hidden">
              <div className="h-full bg-blue-500 transition-all" style={{ width: `${progress}%` }} />
            </div>
          </div>
        )}
        {error && <p className="text-sm text-red-300">{error}</p>}
        {slices.length > 0 && (
          <img
            src={slices[index]}
            alt={`Slice ${index + 1}`}
            draggable={false}
            className="max-h-full max-w-full object-contain"
            style={{
              transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
              filter: `brightness(${brightness}%) contrast(${contrast}%)`,
            }}
          />
        )}
      </div>

      {/* Controls */}
      {slices.length > 0 && (
        <div className="px-4 py-3 border-t border-white/10 space-y-3">
          <input
            type="range"
            min={0}
            max={slices.length - 1}
            value={index}
            onChange={(e) => setIndex(Number(e.target.value))}
            className="w-full"
            aria-label="Slice"
          />
          <div className="flex flex-wrap items-center gap-4 text-xs text-gray-300">
            <div className="flex items-center gap-1">
              <button onClick={() => zoomBy(1 / 1.2)} className="w-8 h-8 rounded-lg bg-white/10 hover:bg-white/20" aria-label="Zoom out">−</button>
              <button onClick={() => zoomBy(1.2)} className="w-8 h-8 rounded-lg bg-white/10 hover:bg-white/20" aria-label="Zoom in">+</button>
            </div>
            <label className="flex items-center gap-2">
              Brightness
              <input type="range" min={50} max={200} value={brightness} onChange={(e) => setBrightness(Number(e.target.value))} />
            </label>
            <label className="flex items-center gap-2">
              Contrast
              <input type="range" min={50} max={200} value={contrast} onChange={(e) => setContrast(Number(e.target.value))} />
            </label>
            <button onClick={resetView} className="px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/20">Reset</button>
            <span className="text-gray-500">Wheel: slices · Ctrl+wheel: zoom · Drag: pan</span>
          </div>
        </div>
      )}
    </div>
  );
}

export default SliceViewer;
