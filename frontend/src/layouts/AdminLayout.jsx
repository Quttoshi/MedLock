import { useState } from "react";
import { Outlet } from "react-router-dom";
import AdminSidebar from "../components/AdminSidebar";
import AdminNavbar from "../components/AdminNavbar";
import { NotificationProvider } from "../context/NotificationContext";

function AdminLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <NotificationProvider>
    <div className="app-shell flex h-screen overflow-hidden">
      <AdminSidebar
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
      />
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <AdminNavbar onMenuClick={() => setSidebarOpen(true)} />
        <main className="app-main flex-1 overflow-y-auto">
          <Outlet />
        </main>
      </div>
    </div>
    </NotificationProvider>
  );
}

export default AdminLayout;

