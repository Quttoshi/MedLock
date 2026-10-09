import { lazy, Suspense } from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import LandingPage from "./pages/landing/LandingPage";
import LoginPage from "./pages/auth/LoginPage";
import RegisterPage from "./pages/auth/RegisterPage";
import VerifyEmailPage from "./pages/auth/VerifyEmailPage";
import RoleSelectPage from "./pages/auth/RoleSelectPage";

// Patient
import PatientLayout from "./layouts/PatientLayout";
import DashboardHome from "./pages/patient/DashboardHome";
import MyReports from "./pages/patient/MyReports";
import ReportDetail from "./pages/patient/ReportDetail";
import UploadReport from "./pages/patient/UploadReport";
import AccessRequests from "./pages/patient/AccessRequests";
import Notifications from "./pages/patient/Notifications";
import HealthTrends from "./pages/patient/HealthTrends";
import TestDetail from "./pages/patient/TestDetail";

// Admin
import AdminLayout from "./layouts/AdminLayout";
import AdminDashboardHome from "./pages/admin/DashboardHome";
import AdminUsers from "./pages/admin/Users";
import AdminDoctors from "./pages/admin/Doctors";
import AdminMedicalCenters from "./pages/admin/MedicalCenters";
import AdminAuditLogs from "./pages/admin/AuditLogs";
import AdminEmergencyAccess from "./pages/admin/EmergencyAccess";
import AdminNotifications from "./pages/admin/Notifications";

// Doctor
import DoctorLayout from "./layouts/DoctorLayout";
import DoctorDashboardHome from "./pages/doctor/DashboardHome";
import DoctorAccessRequests from "./pages/doctor/AccessRequests";
import DoctorNotifications from "./pages/doctor/Notifications";
import DoctorAffiliation from "./pages/doctor/Affiliation";
import MyPatients from "./pages/doctor/MyPatients";
import PatientReports from "./pages/doctor/PatientReports";
import DoctorEmergency from "./pages/doctor/Emergency";
import ReportViewer from "./pages/doctor/ReportViewer";

// Medical Center
import MCLayout from "./layouts/MCLayout";
import MCDashboardHome from "./pages/mc/DashboardHome";
import MCUploadReport from "./pages/mc/UploadReport";
import MCMyReports from "./pages/mc/MyReports";
import MCMyDoctors from "./pages/mc/MyDoctors";
import MCNotifications from "./pages/mc/Notifications";
import ProtectedRoute from "./components/ProtectedRoute";
import { useAuth } from "./context/AuthContext";

// Dev only: component gallery. import.meta.env.DEV is false in a production
// build, so this page and its code are left out of what ships.
const ComponentGallery = import.meta.env.DEV
  ? lazy(() => import("./dev/ComponentGallery"))
  : null;

function ComingSoon({ role }) {
  const { logout } = useAuth();
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50 gap-4">
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-10 text-center max-w-md">
        <div className="w-14 h-14 bg-green-50 rounded-2xl flex items-center justify-center mx-auto mb-4">
          <svg className="w-7 h-7 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
      <Route path="/" element={<LandingPage />} />
      <Route path="/login" element={<LoginPage />} />
      <Route path="/register" element={<RoleSelectPage />} />
      <Route path="/register/:role" element={<RegisterPage />} />
      <Route path="/verify-email" element={<VerifyEmailPage />} />

      {/* Dev only: component gallery, not present in a production build */}
      {ComponentGallery && (
        <Route
          path="/dev/components"
          element={
            <Suspense fallback={null}>
              <ComponentGallery />
            </Suspense>
          }
        />
      )}

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
        <Route path="health" element={<HealthTrends />} />
        <Route path="health/:code" element={<TestDetail />} />
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
        <Route path="emergency" element={<AdminEmergencyAccess />} />
        <Route path="notifications" element={<AdminNotifications />} />
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
        <Route path="patients/:patientId/reports/:reportId/view" element={<ReportViewer />} />
        <Route path="access-requests" element={<DoctorAccessRequests />} />
        <Route path="affiliation" element={<DoctorAffiliation />} />
        <Route path="emergency" element={<DoctorEmergency />} />
        <Route path="notifications" element={<DoctorNotifications />} />
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
        <Route path="notifications" element={<MCNotifications />} />
      </Route>
    </Routes>
  );
}

export default App;


