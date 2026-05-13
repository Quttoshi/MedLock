import { useState } from "react";
import { useNotifications } from "../../context/NotificationContext";

function NotificationIcon({ type }) {
  const config = {
    access_approved: {
      bg: "bg-green-100", color: "text-green-600",
      icon: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>,
    },
    access_denied: {
      bg: "bg-red-100", color: "text-red-600",
      icon: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>,
    },
    access_revoked: {
      bg: "bg-gray-100", color: "text-gray-600",
      icon: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" /></svg>,
    },
  };
  const c = config[type] || {
    bg: "bg-green-100", color: "text-green-600",
    icon: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" /></svg>,
  };
  return (
    <div className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 ${c.bg} ${c.color}`}>
      {c.icon}
    </div>
  );
}

function timeAgo(dateStr) {
  const diff = Math.floor((new Date() - new Date(dateStr)) / 1000);
  if (diff < 60) return "Just now";
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  if (diff < 604800) return `${Math.floor(diff / 86400)}d ago`;
  return new Date(dateStr).toLocaleDateString("en-PK", { day: "numeric", month: "short", year: "numeric" });
}

function Notifications() {
  const { notifications, markAsRead, markAllAsRead } = useNotifications();
  const [filter, setFilter] = useState("all");

  const filtered = notifications.filter((n) => {
    if (filter === "unread") return !n.is_read;
    if (filter === "read") return n.is_read;
    return true;
  });

  const unreadCount = notifications.filter((n) => !n.is_read).length;

  return (
    <div className="max-w-2xl mx-auto">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Notifications</h1>
          <p className="text-gray-500 text-sm mt-1">
            {unreadCount > 0 ? `${unreadCount} unread notification${unreadCount > 1 ? "s" : ""}` : "All caught up!"}
          </p>
        </div>
        {unreadCount > 0 && (
          <button onClick={markAllAsRead} className="text-sm text-green-600 hover:underline font-medium">
            Mark all as read
          </button>
        )}
      </div>

      <div className="flex gap-1 bg-gray-100 p-1 rounded-xl mb-6 w-fit">
        {["all", "unread", "read"].map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition capitalize ${filter === f ? "bg-white text-green-600 shadow-sm" : "text-gray-500 hover:text-gray-700"}`}
          >
            {f}
            {f === "unread" && unreadCount > 0 && (
              <span className="ml-1.5 text-xs bg-red-500 text-white px-1.5 py-0.5 rounded-full">{unreadCount}</span>
            )}
          </button>
        ))}
      </div>

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

      <div className="space-y-2">
        {filtered.map((notif) => (
          <div
            key={notif.id}
            onClick={() => !notif.is_read && markAsRead(notif.id)}
            className={`flex items-start gap-4 p-4 rounded-2xl border transition-all cursor-pointer ${notif.is_read ? "bg-white border-gray-100 opacity-70" : "bg-green-50 border-green-100 hover:border-green-200"}`}
          >
            <NotificationIcon type={notif.type} />
            <div className="flex-1 min-w-0">
              <p className={`text-sm leading-relaxed ${notif.is_read ? "text-gray-600" : "text-gray-800 font-medium"}`}>
                {notif.message}
              </p>
              <p className="text-xs text-gray-400 mt-1">{timeAgo(notif.created_at)}</p>
            </div>
            {!notif.is_read ? (
              <div className="w-2.5 h-2.5 rounded-full bg-green-500 flex-shrink-0 mt-1" />
            ) : (
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
