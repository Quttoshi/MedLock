import { useRef, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { Bell } from "lucide-react";
import { useNotifications } from "../../context/NotificationContext";
import { useOpenNotification } from "../../context/useOpenNotification";
import { useDismiss } from "./useDismiss";
import { notificationIcon, timeAgo } from "./notificationMeta";

// Same data and handlers as the old Navbar bell, in the Template A style.
export default function NotificationBell({ notificationsPath }) {
  const navigate = useNavigate();
  const openNotification = useOpenNotification(notificationsPath);
  const { notifications, unreadCount, markAllAsRead } = useNotifications();
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  const close = useCallback(() => setOpen(false), []);
  useDismiss(ref, open, close);

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="true"
        aria-expanded={open}
        aria-label={unreadCount > 0 ? `Notifications, ${unreadCount} unread` : "Notifications"}
        className="relative flex h-11 w-11 items-center justify-center rounded-full border border-line bg-surface text-ink transition-colors hover:bg-inset focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
      >
        <Bell aria-hidden="true" size={20} strokeWidth={2} />
        {unreadCount > 0 && (
          <span className="absolute -right-0.5 -top-0.5 flex h-5 min-w-[20px] items-center justify-center rounded-full bg-brand px-1 text-[11px] font-bold leading-none text-brand-on">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-14 z-50 w-[min(22rem,calc(100vw-2rem))] overflow-hidden rounded-card border border-line bg-surface shadow-card">
          <div className="flex items-center justify-between border-b border-line px-5 py-4">
            <p className="display text-xl text-ink">Notifications</p>
            {unreadCount > 0 && (
              <button
                type="button"
                onClick={() => {
                  markAllAsRead();
                  setOpen(false);
                }}
                className="link text-sm"
              >
                Mark all read
              </button>
            )}
          </div>

          <div className="max-h-80 divide-y divide-line overflow-y-auto">
            {notifications.length === 0 && (
              <p className="px-5 py-8 text-center text-sm text-muted">Nothing new right now.</p>
            )}
            {notifications.slice(0, 5).map((n) => {
              const { Icon, tone } = notificationIcon(n.type);
              return (
                <button
                  key={n.id}
                  type="button"
                  onClick={() => {
                    setOpen(false);
                    openNotification(n);
                  }}
                  className={`flex w-full items-start gap-3 px-5 py-3.5 text-left transition-colors hover:bg-inset ${
                    n.is_read ? "" : "bg-brand-subtle/60"
                  }`}
                >
                  <span className={`mt-0.5 flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full ${tone}`}>
                    <Icon aria-hidden="true" size={16} strokeWidth={2} />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className={`block text-sm leading-5 ${n.is_read ? "text-ink-soft" : "font-semibold text-ink"}`}>
                      {n.message.length > 80 ? `${n.message.slice(0, 80)}...` : n.message}
                    </span>
                    <span className="mt-0.5 block text-xs text-muted">{timeAgo(n.created_at)}</span>
                  </span>
                  {!n.is_read && (
                    <span className="mt-2 h-2 w-2 flex-shrink-0 rounded-full bg-brand" aria-label="Unread" />
                  )}
                </button>
              );
            })}
          </div>

          <div className="border-t border-line px-5 py-3.5">
            <button
              type="button"
              onClick={() => {
                setOpen(false);
                navigate(notificationsPath);
              }}
              className="link text-sm"
            >
              View all notifications
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
