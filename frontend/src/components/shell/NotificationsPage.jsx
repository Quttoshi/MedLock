import { useState } from "react";
import { Bell, Check } from "lucide-react";
import { useNotifications } from "../../context/NotificationContext";
import { useOpenNotification } from "../../context/useOpenNotification";
import { notificationIcon, timeAgo } from "./notificationMeta";

// The Notifications page, shared by every role. Only the fallback page
// (where a notification without its own link opens) differs.
export default function NotificationsPage({ fallbackPath }) {
  const { notifications, markAllAsRead } = useNotifications();
  const openNotification = useOpenNotification(fallbackPath);
  const [filter, setFilter] = useState("all");

  const filtered = notifications.filter((n) => {
    if (filter === "unread") return !n.is_read;
    if (filter === "read") return n.is_read;
    return true;
  });

  const unreadCount = notifications.filter((n) => !n.is_read).length;

  return (
    <div className="mx-auto max-w-2xl">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="display text-[28px] leading-[1.15] text-ink sm:text-[32px]">
            <em>Notifications</em>
          </h1>
          <p className="mt-2 text-sm text-muted">
            {unreadCount > 0 ? `${unreadCount} unread notification${unreadCount > 1 ? "s" : ""}` : "You are all caught up."}
          </p>
        </div>
        {unreadCount > 0 && (
          <button type="button" onClick={() => markAllAsRead()} className="btn btn-secondary btn-sm">
            Mark all as read
          </button>
        )}
      </div>

      <div role="group" aria-label="Filter notifications" className="mt-6 inline-flex gap-1 rounded-full border border-line bg-surface p-1">
        {["all", "unread", "read"].map((f) => (
          <button
            key={f}
            type="button"
            aria-pressed={filter === f}
            onClick={() => setFilter(f)}
            className={`flex items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold capitalize transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand ${
              filter === f ? "bg-deep text-deep-on" : "text-ink-soft hover:bg-inset hover:text-ink"
            }`}
          >
            {f}
            {f === "unread" && unreadCount > 0 && (
              <span className={`rounded-full px-1.5 text-xs font-bold ${filter === f ? "bg-deep-2 text-deep-on" : "bg-brand text-brand-on"}`}>
                {unreadCount}
              </span>
            )}
          </button>
        ))}
      </div>

      {filtered.length === 0 && (
        <div className="card card-pad mt-6 text-center">
          <Bell aria-hidden="true" size={28} className="mx-auto text-muted" />
          <p className="display mt-3 text-xl text-ink">No notifications</p>
          <p className="mt-2 text-sm text-muted">
            {filter === "unread" ? "You have no unread notifications." : "Nothing here yet."}
          </p>
        </div>
      )}

      <ul className="mt-6 space-y-3">
        {filtered.map((notif) => {
          const { Icon, tone } = notificationIcon(notif.type);
          return (
            <li key={notif.id}>
              <button
                type="button"
                onClick={() => openNotification(notif)}
                className={`card flex w-full items-start gap-4 p-4 text-left transition-colors hover:border-line-strong focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand ${
                  notif.is_read ? "" : "border-brand/40 bg-brand-subtle/50"
                }`}
              >
                <span className={`flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-full ${tone}`}>
                  <Icon aria-hidden="true" size={20} />
                </span>
                <span className="min-w-0 flex-1">
                  <span className={`block text-sm leading-6 ${notif.is_read ? "text-ink-soft" : "font-bold text-ink"}`}>
                    {notif.message}
                  </span>
                  <span className="mt-0.5 block text-sm text-muted">{timeAgo(notif.created_at)}</span>
                </span>
                {notif.is_read ? (
                  <Check aria-label="Read" size={18} className="mt-1 flex-shrink-0 text-muted" />
                ) : (
                  <span className="mt-2 h-2.5 w-2.5 flex-shrink-0 rounded-full bg-brand" aria-label="Unread" />
                )}
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
