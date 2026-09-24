import { useState } from "react";
import { Outlet } from "react-router-dom";
import DoctorSidebar from "../components/DoctorSidebar";
import DoctorNavbar from "../components/DoctorNavbar";
import { NotificationProvider } from "../context/NotificationContext";

function DoctorLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <NotificationProvider>
      <div className="app-shell flex h-screen overflow-hidden">
        <DoctorSidebar
          isOpen={sidebarOpen}
          onClose={() => setSidebarOpen(false)}
        />
        <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
          <DoctorNavbar onMenuClick={() => setSidebarOpen(true)} />
          <main className="app-main flex-1 overflow-y-auto">
            <Outlet />
          </main>
        </div>
      </div>
    </NotificationProvider>
  );
}

export default DoctorLayout;

