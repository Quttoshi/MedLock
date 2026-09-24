import { useState } from "react";
import { Outlet } from "react-router-dom";
import Sidebar from "../components/Sidebar";
import Navbar from "../components/Navbar";
import { NotificationProvider } from "../context/NotificationContext";

function PatientLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <NotificationProvider>
      <div className="app-shell flex h-screen overflow-hidden">

        {/* Sidebar */}
        <Sidebar
          isOpen={sidebarOpen}
          onClose={() => setSidebarOpen(false)}
        />

        {/* Main content area */}
        <div className="flex-1 flex flex-col min-w-0 overflow-hidden">

          {/* Navbar */}
          <Navbar onMenuClick={() => setSidebarOpen(true)} />

          {/* Page content */}
          <main className="app-main flex-1 overflow-y-auto">
            <Outlet />
          </main>
        </div>
      </div>
    </NotificationProvider>
  );
}

export default PatientLayout;

