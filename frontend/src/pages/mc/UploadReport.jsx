import { useState } from "react";
import { useAuth } from "../../context/AuthContext";
import { uploadPatientReport } from "../../api/medicalCenter";

const REPORT_TYPES = [
  "blood_test",
  "urine_test",
  "xray",
  "mri",
  "ct_scan",
  "ecg",
  "ultrasound",
  "prescription",
  "discharge_summary",
  "other",
];

function MCUploadReport() {
  const { token } = useAuth();
  const [form, setForm] = useState({
    patient_email: "",
    report_type: "",
  });
  const [file, setFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [success, setSuccess] = useState("");
  const [error, setError] = useState("");

  const handleSubmit = async () => {
    if (!form.patient_email.trim() || !form.report_type || !file) {
      setError("All fields are required — patient email, report type, and file.");
      return;
    }

    setUploading(true);
    setError("");
    setSuccess("");

    try {
      const formData = new FormData();
      formData.append("patient_email", form.patient_email.trim());
      formData.append("report_type", form.report_type);
      formData.append("file", file);

      await uploadPatientReport(token, formData);
      setSuccess(
        "Report uploaded successfully. The patient has been notified and must approve it before it appears in their record."
      );
      setForm({ patient_email: "", report_type: "" });
      setFile(null);
      document.getElementById("file-input").value = "";
    } catch (e) {
      setError(e?.response?.data?.detail || "Upload failed. Please try again.");
    }

    setUploading(false);
  };

  return (
    <div className="max-w-2xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-800">Upload Patient Report</h1>
        <p className="text-gray-500 text-sm mt-1">
          Upload a diagnostic report directly to a patient's profile.
        </p>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
        <div className="space-y-5">

          {/* Patient Email */}
          <div>
            <label className="text-xs font-medium text-gray-600 mb-1 block">
              Patient Email
            </label>
            <input
              type="email"
              value={form.patient_email}
              onChange={(e) => setForm({ ...form, patient_email: e.target.value })}
              placeholder="Enter patient's registered email"
              className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-purple-300"
            />
          </div>

          {/* Report Type */}
          <div>
            <label className="text-xs font-medium text-gray-600 mb-1 block">
              Report Type
            </label>
            <select
              value={form.report_type}
              onChange={(e) => setForm({ ...form, report_type: e.target.value })}
              className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-purple-300 bg-white"
            >
              <option value="">-- Select report type --</option>
              {REPORT_TYPES.map((type) => (
                <option key={type} value={type}>
                  {type.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())}
                </option>
              ))}
            </select>
          </div>

          {/* File Upload */}
          <div>
            <label className="text-xs font-medium text-gray-600 mb-1 block">
              Report File (PDF, JPEG, PNG, TIFF — max 50MB)
            </label>
            <div className="border-2 border-dashed border-gray-200 rounded-xl p-6 text-center hover:border-purple-300 transition">
              <input
                id="file-input"
                type="file"
                accept=".pdf,.jpg,.jpeg,.png,.tiff,.tif"
                onChange={(e) => setFile(e.target.files[0])}
                className="hidden"
              />
              <label htmlFor="file-input" className="cursor-pointer">
                {file ? (
                  <div className="flex items-center justify-center gap-2">
                    <svg className="w-5 h-5 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                        d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                    <span className="text-sm font-medium text-purple-600">{file.name}</span>
                    <span className="text-xs text-gray-400">
                      ({(file.size / 1024 / 1024).toFixed(2)} MB)
                    </span>
                  </div>
                ) : (
                  <div>
                    <svg className="w-8 h-8 text-gray-300 mx-auto mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                        d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                    </svg>
                    <p className="text-sm text-gray-500">
                      Click to select file
                    </p>
                    <p className="text-xs text-gray-400 mt-1">PDF, JPEG, PNG, TIFF up to 50MB</p>
                  </div>
                )}
              </label>
            </div>
          </div>

          {/* Error */}
          {error && (
            <div className="px-4 py-3 bg-red-50 border border-red-100 rounded-xl text-sm text-red-600">
              {error}
            </div>
          )}

          {/* Success */}
          {success && (
            <div className="px-4 py-3 bg-green-50 border border-green-100 rounded-xl text-sm text-green-700">
              {success}
            </div>
          )}

          {/* Submit */}
          <button
            onClick={handleSubmit}
            disabled={uploading}
            className="w-full py-3 bg-purple-600 text-white rounded-xl text-sm font-medium hover:bg-purple-700 transition disabled:opacity-50"
          >
            {uploading ? "Uploading..." : "Upload Report"}
          </button>
        </div>
      </div>

      {/* Info box */}
      <div className="mt-4 bg-purple-50 border border-purple-100 rounded-2xl p-4 text-sm text-purple-600">
        <p className="font-semibold text-purple-800 mb-1">What happens after upload?</p>
        <ul className="space-y-1 text-xs list-disc list-inside">
          <li>The file is encrypted using AES-256 before storage</li>
          <li>A SHA-256 hash is recorded on the Ethereum blockchain</li>
          <li>The patient receives a notification to approve or reject the report</li>
          <li>The report is only added to their record after explicit patient approval</li>
        </ul>
      </div>
    </div>
  );
}

export default MCUploadReport;