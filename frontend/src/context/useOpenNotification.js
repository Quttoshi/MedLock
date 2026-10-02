import { useNavigate } from "react-router-dom";
import { useNotifications } from "./NotificationContext";

// Returns a click handler that marks a notification read and opens the page it refers to
// (its `link`, set by the backend), or `fallback` for notifications without one.
export function useOpenNotification(fallback) {
  const { markAsRead } = useNotifications();
  const navigate = useNavigate();
  return (notif) => {
    if (!notif.is_read) markAsRead(notif.id);
    navigate(notif.link || fallback);
  };
}
