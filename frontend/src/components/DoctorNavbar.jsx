import { useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useNotifications } from "../context/NotificationContext";

function timeAgo(dateStr) {
  const diff = Math.floor((new Date() - new Date(dateStr)) / 1000);
  if (diff < 60) return "Just now";
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

function DoctorNavbar({ onMenuClick }) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { notifications, unreadCount, markAsRead, markAllAsRead } = useNotifications();

  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

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
          <span className="text-green-600">
            {user?.name?.split(" ")[0] || "Doctor"}
          </span>
        </h2>
      </div>

      <div className="flex items-center gap-3">
        {/* Bell + Dropdown */}
        <div className="relative" ref={dropdownRef}>
          <button
            onClick={() => setDropdownOpen((prev) => !prev)}
            className="relative p-2 rounded-xl hover:bg-gray-100 text-gray-500 hover:text-gray-700 transition"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
            </svg>
            {unreadCount > 0 && (
              <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white text-xs font-bold rounded-full flex items-center justify-center">
                {unreadCount > 9 ? "9+" : unreadCount}
              </span>
            )}
          </button>

          {/* Dropdown */}
          {dropdownOpen && (
            <div className="absolute right-0 top-12 w-80 bg-white rounded-2xl shadow-xl border border-gray-100 z-50 overflow-hidden">
              <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
                <p className="text-sm font-semibold text-gray-800">
                  Notifications
                  {unreadCount > 0 && (
                    <span className="ml-2 text-xs bg-red-100 text-red-600 font-bold px-1.5 py-0.5 rounded-full">
                      {unreadCount} new
                    </span>
                  )}
                </p>
                {unreadCount > 0 && (
                  <button
                    onClick={() => { markAllAsRead(); setDropdownOpen(false); }}
                    className="text-xs text-green-600 hover:underline font-medium"
                  >
                    Mark all read
                  </button>
                )}
              </div>

              <div className="max-h-72 overflow-y-auto divide-y divide-gray-50">
                {notifications.length === 0 ? (
                  <p className="text-xs text-gray-400 text-center py-6">No notifications yet</p>
                ) : (
                  notifications.slice(0, 5).map((notif) => (
                    <div
                      key={notif.id}
                      onClick={() => {
                        if (!notif.is_read) markAsRead(notif.id);
                        setDropdownOpen(false);
                        navigate("/doctor/notifications");
                      }}
                      className={`flex items-start gap-3 px-4 py-3 cursor-pointer hover:bg-gray-50 transition ${!notif.is_read ? "bg-green-50" : ""}`}
                    >
                      <div className={`w-2 h-2 rounded-full flex-shrink-0 mt-2 ${!notif.is_read ? "bg-green-500" : "bg-gray-200"}`} />
                      <div className="flex-1 min-w-0">
                        <p className={`text-xs leading-relaxed ${!notif.is_read ? "font-semibold text-gray-800" : "text-gray-600"}`}>
                          {notif.message.length > 70 ? notif.message.slice(0, 70) + "..." : notif.message}
                        </p>
                        <p className="text-xs text-gray-400 mt-0.5">{timeAgo(notif.created_at)}</p>
                      </div>
                    </div>
                  ))
                )}
              </div>

              <div className="border-t border-gray-100 px-4 py-3">
                <button
                  onClick={() => { setDropdownOpen(false); navigate("/doctor/notifications"); }}
                  className="w-full text-center text-sm text-green-600 hover:underline font-medium"
                >
                  View all notifications →
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Avatar */}
        <div className="w-9 h-9 rounded-full bg-green-100 flex items-center justify-center">
          <span className="text-green-600 font-semibold text-sm">
            {user?.name?.charAt(0).toUpperCase() || "D"}
          </span>
        </div>
      </div>
    </header>
  );
}

export default DoctorNavbar;
