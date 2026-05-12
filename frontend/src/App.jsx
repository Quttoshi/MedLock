import { Routes, Route, Navigate } from "react-router-dom";
import LoginPage from "./pages/auth/LoginPage";
import RegisterPage from "./pages/auth/RegisterPage";

// Patient
import PatientLayout from "./layouts/PatientLayout";
import DashboardHome from "./pages/patient/DashboardHome";
import MyReports from "./pages/patient/MyReports";
import ReportDetail from "./pages/patient/ReportDetail";
import UploadReport from "./pages/patient/UploadReport";
import AccessRequests from "./pages/patient/AccessRequests";
import Notifications from "./pages/patient/Notifications";

// Admin
import AdminLayout from "./layouts/AdminLayout";
import AdminDashboardHome from "./pages/admin/DashboardHome";
import AdminUsers from "./pages/admin/Users";
import AdminDoctors from "./pages/admin/Doctors";
import AdminMedicalCenters from "./pages/admin/MedicalCenters";
import AdminAuditLogs from "./pages/admin/AuditLogs";

// Doctor
import DoctorLayout from "./layouts/DoctorLayout";
import DoctorDashboardHome from "./pages/doctor/DashboardHome";
import DoctorAccessRequests from "./pages/doctor/AccessRequests";
import MyPatients from "./pages/doctor/MyPatients";
import PatientReports from "./pages/doctor/PatientReports";
import QueryHistory from "./pages/doctor/QueryHistory";
import ReportViewer from "./pages/doctor/ReportViewer";

// Medical Center
import MCLayout from "./layouts/MCLayout";
import MCDashboardHome from "./pages/mc/DashboardHome";
import MCUploadReport from "./pages/mc/UploadReport";
import MCMyReports from "./pages/mc/MyReports";
import MCMyDoctors from "./pages/mc/MyDoctors";

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

      {/* Admin */}
      <Route
        path="/admin"
        element={
          <ProtectedRoute allowedRoles={["admin"]}>
            <AdminLayout />
          </ProtectedRoute>
        }
      >
        <Route path="dashboard" element={<AdminDashboardHome />} />
        <Route path="users" element={<AdminUsers />} />
        <Route path="doctors" element={<AdminDoctors />} />
        <Route path="medical-centers" element={<AdminMedicalCenters />} />
        <Route path="audit-logs" element={<AdminAuditLogs />} />
      </Route>

{/* Doctor */}
<Route
  path="/doctor"
  element={
    <ProtectedRoute allowedRoles={["doctor"]}>
      <DoctorLayout />
    </ProtectedRoute>
  }
>
  <Route path="dashboard" element={<DoctorDashboardHome />} />
  <Route path="patients" element={<MyPatients />} />
  <Route path="patients/:patientId/reports" element={<PatientReports />} />
  <Route path="patients/:patientId/reports/:reportId/view" element={<ReportViewer />} /> {/* ADD THIS */}
  <Route path="access-requests" element={<DoctorAccessRequests />} />
  <Route path="query" element={<QueryHistory />} />
</Route>

      {/* Medical Center */}
      <Route
        path="/mc"
        element={
          <ProtectedRoute allowedRoles={["medical_center"]}>
            <MCLayout />
          </ProtectedRoute>
        }
      >
        <Route path="dashboard" element={<MCDashboardHome />} />
        <Route path="upload" element={<MCUploadReport />} />
        <Route path="reports" element={<MCMyReports />} />
        <Route path="doctors" element={<MCMyDoctors />} />
      </Route>
    </Routes>
  );
}

export default App;