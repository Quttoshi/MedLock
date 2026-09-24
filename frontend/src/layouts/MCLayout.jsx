import { useState } from "react";
import { Outlet } from "react-router-dom";
import MCSidebar from "../components/MCSidebar";
import MCNavbar from "../components/MCNavbar";
import { NotificationProvider } from "../context/NotificationContext";

function MCLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <NotificationProvider>
      <div className="app-shell flex h-screen overflow-hidden">
        <MCSidebar
          isOpen={sidebarOpen}
          onClose={() => setSidebarOpen(false)}
        />
        <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
          <MCNavbar onMenuClick={() => setSidebarOpen(true)} />
          <main className="app-main flex-1 overflow-y-auto">
            <Outlet />
          </main>
        </div>
      </div>
    </NotificationProvider>
  );
}

export default MCLayout;

