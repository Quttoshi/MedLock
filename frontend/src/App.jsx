import { Routes, Route, Navigate } from "react-router-dom";
import LoginPage from "./pages/auth/LoginPage";
import RegisterPage from "./pages/auth/RegisterPage";
import PatientLayout from "./layouts/PatientLayout";
import DashboardHome from "./pages/patient/DashboardHome";
import MyReports from "./pages/patient/MyReports";
import ReportDetail from "./pages/patient/ReportDetail";
import UploadReport from "./pages/patient/UploadReport";
import AccessRequests from "./pages/patient/AccessRequests";
import Notifications from "./pages/patient/Notifications";
import ProtectedRoute from "./components/ProtectedRoute";
import { useAuth } from "./context/AuthContext";

function ComingSoon({ role }) {
  const { logout } = useAuth();
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50 gap-4">
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-10 text-center max-w-md">
        <div className="w-14 h-14 bg-blue-50 rounded-2xl flex items-center justify-center mx-auto mb-4">
          <svg className="w-7 h-7 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5" />
          </svg>
        </div>
        <h1 className="text-xl font-bold text-gray-800 capitalize">{role} Dashboard</h1>
        <p className="text-gray-400 text-sm mt-2">This dashboard is under development and will be available soon.</p>
        <button
          onClick={logout}
          className="mt-6 text-sm text-red-500 hover:underline"
        >
          Logout
        </button>
      </div>
    </div>
  );
}

function App() {
  return (
    <Routes>
      {/* Public */}
      <Route path="/" element={<Navigate to="/login" />} />
      <Route path="/login" element={<LoginPage />} />
      <Route path="/register" element={<RegisterPage />} />

      {/* Patient */}
      <Route
        path="/patient"
        element={
          <ProtectedRoute allowedRoles={["patient"]}>
            <PatientLayout />
          </ProtectedRoute>
        }
      >
        <Route path="dashboard" element={<DashboardHome />} />
        <Route path="reports" element={<MyReports />} />
        <Route path="reports/:id" element={<ReportDetail />} />
        <Route path="upload" element={<UploadReport />} />
        <Route path="access-requests" element={<AccessRequests />} />
        <Route path="notifications" element={<Notifications />} />
      </Route>

      {/* Placeholder dashboards for other roles */}
      <Route path="/admin/*" element={
        <ProtectedRoute allowedRoles={["admin"]}>
          <ComingSoon role="admin" />
        </ProtectedRoute>
      } />
      <Route path="/doctor/*" element={
        <ProtectedRoute allowedRoles={["doctor"]}>
          <ComingSoon role="doctor" />
        </ProtectedRoute>
      } />
      <Route path="/mc/*" element={
        <ProtectedRoute allowedRoles={["medical_center"]}>
          <ComingSoon role="medical center" />
        </ProtectedRoute>
      } />
    </Routes>
  );
}

export default App;

