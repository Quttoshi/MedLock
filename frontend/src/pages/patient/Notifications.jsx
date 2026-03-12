import { useState, useEffect } from "react";
import { useNotifications } from "../../context/NotificationContext";

// ── Mock Data ────────────────────────────────────────
const MOCK_NOTIFICATIONS = [
  {
    id: "1",
    type: "access_request",
    message: "Dr. Ahmed Raza has requested access to your Blood Test report.",
    is_read: false,
    created_at: "2026-03-10T09:30:00Z",
  },
  {
    id: "2",
    type: "access_request",
    message: "Dr. Sara Khan has requested access to your MRI Scan report.",
    is_read: false,
    created_at: "2026-03-08T14:15:00Z",
  },
  {
    id: "3",
    type: "upload_confirmed",
    message: "Your Blood Test report was successfully encrypted and recorded on the blockchain.",
    is_read: false,
    created_at: "2026-03-01T10:35:00Z",
  },
  {
    id: "4",
    type: "access_approved",
    message: "You approved Dr. Usman Ali's request to access your X-Ray report.",
    is_read: true,
    created_at: "2026-02-20T15:30:00Z",
  },
  {
    id: "5",
    type: "access_denied",
    message: "You denied Dr. Fatima Malik's request to access your Blood Test report.",
    is_read: true,
    created_at: "2026-02-11T09:00:00Z",
  },
  {
    id: "6",
    type: "mc_upload",
    message: "City Hospital uploaded a new Chest X-Ray report for you. Please review and approve.",
    is_read: true,
    created_at: "2026-02-15T14:20:00Z",
  },
  {
    id: "7",
    type: "access_revoked",
    message: "You revoked Dr. Bilal Hassan's access to your MRI Scan report.",
    is_read: true,
    created_at: "2026-01-16T10:00:00Z",
  },
];

// ── Notification Icon ────────────────────────────────
function NotificationIcon({ type }) {
  const config = {
    access_request: {
      bg: "bg-yellow-100",
      color: "text-yellow-600",
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
        </svg>
      ),
    },
    access_approved: {
      bg: "bg-green-100",
      color: "text-green-600",
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      ),
    },
    access_denied: {
      bg: "bg-red-100",
      color: "text-red-600",
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      ),
    },
    access_revoked: {
      bg: "bg-gray-100",
      color: "text-gray-600",
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
        </svg>
      ),
    },
    upload_confirmed: {
      bg: "bg-blue-100",
      color: "text-blue-600",
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
        </svg>
      ),
    },
    mc_upload: {
      bg: "bg-purple-100",
      color: "text-purple-600",
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
        </svg>
      ),
    },
  };

  const c = config[type] || config["upload_confirmed"];
  return (
    <div className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 ${c.bg} ${c.color}`}>
      {c.icon}
    </div>
  );
}

// ── Time Ago ─────────────────────────────────────────
function timeAgo(dateStr) {
  const now = new Date();
  const date = new Date(dateStr);
  const diff = Math.floor((now - date) / 1000);

  if (diff < 60) return "Just now";
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  if (diff < 604800) return `${Math.floor(diff / 86400)}d ago`;
  return date.toLocaleDateString("en-PK", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

// ── Main Component ───────────────────────────────────
function Notifications() {
  const { notifications, markAsRead, markAllAsRead, fetchNotifications } =
    useNotifications();

  const [localNotifs, setLocalNotifs] = useState([]);
  const [filter, setFilter] = useState("all");

  // Use real notifications if available, else use mock data
  useEffect(() => {
    if (notifications.length > 0) {
      setLocalNotifs(notifications);
    } else {
      setLocalNotifs(MOCK_NOTIFICATIONS);
    }
  }, [notifications]);

  // ── Mark single as read ──────────────────────────────
  const handleMarkAsRead = (id) => {
    setLocalNotifs((prev) =>
      prev.map((n) => (n.id === id ? { ...n, is_read: true } : n))
    );
    markAsRead(id);
  };

  // ── Mark all as read ─────────────────────────────────
  const handleMarkAllAsRead = () => {
    setLocalNotifs((prev) => prev.map((n) => ({ ...n, is_read: true })));
    markAllAsRead();
  };

  // ── Filter ───────────────────────────────────────────
  const filtered = localNotifs.filter((n) => {
    if (filter === "unread") return !n.is_read;
    if (filter === "read") return n.is_read;
    return true;
  });

  const unreadCount = localNotifs.filter((n) => !n.is_read).length;

  return (
    <div className="max-w-2xl mx-auto">

      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Notifications</h1>
          <p className="text-gray-500 text-sm mt-1">
            {unreadCount > 0
              ? `${unreadCount} unread notification${unreadCount > 1 ? "s" : ""}`
              : "All caught up!"}
          </p>
        </div>
        {unreadCount > 0 && (
          <button
            onClick={handleMarkAllAsRead}
            className="text-sm text-blue-600 hover:underline font-medium"
          >
            Mark all as read
          </button>
        )}
      </div>

      {/* Filter Tabs */}
      <div className="flex gap-1 bg-gray-100 p-1 rounded-xl mb-6 w-fit">
        {["all", "unread", "read"].map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition capitalize ${filter === f ? "bg-white text-blue-600 shadow-sm" : "text-gray-500 hover:text-gray-700"}`}
          >
            {f}
            {f === "unread" && unreadCount > 0 && (
              <span className="ml-1.5 text-xs bg-red-500 text-white px-1.5 py-0.5 rounded-full">
                {unreadCount}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Empty State */}
      {filtered.length === 0 && (
        <div className="text-center py-16 bg-white rounded-2xl border border-gray-100">
          <svg className="w-12 h-12 text-gray-200 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
          </svg>
          <p className="text-gray-400 font-medium">No notifications</p>
          <p className="text-gray-300 text-sm mt-1">
            {filter === "unread" ? "You have no unread notifications." : "Nothing here yet."}
          </p>
        </div>
      )}

      {/* Notifications List */}
      <div className="space-y-2">
        {filtered.map((notif) => (
          <div
            key={notif.id}
            onClick={() => !notif.is_read && handleMarkAsRead(notif.id)}
            className={`flex items-start gap-4 p-4 rounded-2xl border transition-all cursor-pointer ${notif.is_read ? "bg-white border-gray-100 opacity-70" : "bg-blue-50 border-blue-100 hover:border-blue-200"}`}
          >
            <NotificationIcon type={notif.type} />

            <div className="flex-1 min-w-0">
              <p className={`text-sm leading-relaxed ${notif.is_read ? "text-gray-600" : "text-gray-800 font-medium"}`}>
                {notif.message}
              </p>
              <p className="text-xs text-gray-400 mt-1">
                {timeAgo(notif.created_at)}
              </p>
            </div>

            {/* Unread dot */}
            {!notif.is_read && (
              <div className="w-2.5 h-2.5 rounded-full bg-blue-500 flex-shrink-0 mt-1" />
            )}

            {/* Read checkmark */}
            {notif.is_read && (
              <svg className="w-4 h-4 text-gray-300 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

export default Notifications;