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
    </Routes>
  );
}

export default App;

