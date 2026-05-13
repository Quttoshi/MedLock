import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useNotifications } from "../context/NotificationContext";

function MCNavbar({ onMenuClick }) {
  const { user } = useAuth();
  const { notifications, unreadCount, markAllAsRead } = useNotifications();
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();

  const recent = notifications.slice(0, 5);

  return (
    <header className="h-16 bg-white border-b border-gray-100 shadow-sm flex items-center px-4 md:px-6 gap-4 sticky top-0 z-10">
      <button
        onClick={onMenuClick}
        className="lg:hidden text-gray-500 hover:text-gray-700 transition"
      >
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
        </svg>
      </button>

      <div className="flex-1">
        <h2 className="text-base font-semibold text-gray-700">
          Welcome back,{" "}
          <span className="text-purple-600">
            {user?.name?.split(" ")[0] || "Medical Center"}
          </span>
        </h2>
      </div>

      {/* Bell */}
      <div className="relative">
        <button
          onClick={() => setOpen(!open)}
          className="relative w-9 h-9 flex items-center justify-center rounded-xl hover:bg-gray-100 transition text-gray-500"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
          </svg>
          {unreadCount > 0 && (
            <span className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center">
              {unreadCount > 9 ? "9+" : unreadCount}
            </span>
          )}
        </button>

        {open && (
          <div className="absolute right-0 mt-2 w-80 bg-white rounded-2xl shadow-xl border border-gray-100 z-50 overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
              <p className="text-sm font-semibold text-gray-700">Notifications</p>
              {unreadCount > 0 && (
                <button onClick={markAllAsRead} className="text-xs text-purple-600 hover:underline">
                  Mark all read
                </button>
              )}
            </div>
            <div className="max-h-72 overflow-y-auto divide-y divide-gray-50">
              {recent.length === 0 ? (
                <p className="text-sm text-gray-400 text-center py-6">No notifications yet.</p>
              ) : recent.map((n) => (
                <div key={n.id} className={`px-4 py-3 text-sm ${n.is_read ? "text-gray-500" : "text-gray-800 font-medium bg-purple-50"}`}>
                  <p>{n.message}</p>
                  <p className="text-xs text-gray-400 mt-0.5">
                    {new Date(n.created_at).toLocaleDateString("en-PK", { day: "numeric", month: "short" })}
                  </p>
                </div>
              ))}
            </div>
            <button
              onClick={() => { setOpen(false); navigate("/mc/notifications"); }}
              className="w-full text-center text-xs text-purple-600 font-medium py-3 hover:bg-purple-50 transition border-t border-gray-100"
            >
              View all notifications →
            </button>
          </div>
        )}
      </div>

      <div className="w-9 h-9 rounded-full bg-purple-100 flex items-center justify-center">
        <span className="text-purple-600 font-semibold text-sm">
          {user?.name?.charAt(0).toUpperCase() || "M"}
        </span>
      </div>
    </header>
  );
}

export default MCNavbar;