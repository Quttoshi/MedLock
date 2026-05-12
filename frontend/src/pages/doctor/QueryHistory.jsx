import { useEffect, useState } from "react";
import { useAuth } from "../../context/AuthContext";
import { getMyPatients, queryPatientHistory } from "../../api/doctor";

function QueryHistory() {
  const { token } = useAuth();
  const [patients, setPatients] = useState([]);
  const [selectedPatient, setSelectedPatient] = useState("");
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [history, setHistory] = useState([]);

  useEffect(() => {
    getMyPatients(token)
      .then((res) => setPatients(res.data))
      .catch(() => {});
  }, [token]);

  const handleQuery = async () => {
    if (!selectedPatient || !question.trim()) {
      setError("Please select a patient and enter a question.");
      return;
    }
    setLoading(true);
    setError("");
    setAnswer("");
    try {
      const res = await queryPatientHistory(token, selectedPatient, question);
      const result = res.data?.answer || res.data?.result || JSON.stringify(res.data);
      setAnswer(result);
      setHistory((prev) => [
        { patient: patients.find((p) => p.id === selectedPatient)?.name || selectedPatient, question, answer: result },
        ...prev,
      ]);
      setQuestion("");
    } catch (e) {
      setError(e?.response?.data?.detail || "Query failed. Please try again.");
    }
    setLoading(false);
  };

  return (
    <div className="max-w-4xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-800">Query Patient History</h1>
        <p className="text-gray-500 text-sm mt-1">
          Ask AI-powered questions about a patient's medical history.
        </p>
      </div>

      {/* Query Form */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 mb-6">
        <div className="space-y-4">
          {/* Patient Select */}
          <div>
            <label className="text-xs font-medium text-gray-600 mb-1 block">Select Patient</label>
            <select
              value={selectedPatient}
              onChange={(e) => setSelectedPatient(e.target.value)}
              className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-green-300 bg-white"
            >
              <option value="">-- Select a patient --</option>
              {patients.map((p) => (
                <option key={p.id} value={p.id}>{p.name} ({p.email})</option>
              ))}
            </select>
          </div>

          {/* Question Input */}
          <div>
            <label className="text-xs font-medium text-gray-600 mb-1 block">Your Question</label>
            <textarea
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              rows={3}
              placeholder="e.g. What medications has this patient been prescribed in the last 6 months?"
              className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-green-300 resize-none"
            />
          </div>

          {error && (
            <div className="px-4 py-3 bg-red-50 border border-red-100 rounded-xl text-sm text-red-600">
              {error}
            </div>
          )}

          <button
            onClick={handleQuery}
            disabled={loading}
            className="w-full py-3 bg-green-600 text-white rounded-xl text-sm font-medium hover:bg-green-700 transition disabled:opacity-50"
          >
            {loading ? "Querying..." : "Ask Question"}
          </button>
        </div>
      </div>

      {/* Current Answer */}
      {answer && (
        <div className="bg-green-50 border border-green-100 rounded-2xl p-5 mb-6">
          <p className="text-xs font-semibold text-green-700 mb-2">AI Response</p>
          <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap">{answer}</p>
        </div>
      )}

      {/* History */}
      {history.length > 0 && (
        <div>
          <h2 className="text-lg font-semibold text-gray-700 mb-4">Query History</h2>
          <div className="space-y-3">
            {history.map((item, i) => (
              <div key={i} className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-medium text-green-600">{item.patient}</span>
                </div>
                <p className="text-sm font-medium text-gray-800 mb-2">Q: {item.question}</p>
                <p className="text-sm text-gray-600 leading-relaxed">A: {item.answer}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default QueryHistory;