import { Bell, Clock, ShieldCheck, ShieldAlert, Upload, Lock } from "lucide-react";

// One place for how each notification type looks, shared by the bell and the
// Notifications page. Unknown types fall back to a plain bell.
const TYPE_ICON = {
  access_request: { Icon: Clock, tone: "bg-warn-subtle text-warn-ink" },
  access_approved: { Icon: ShieldCheck, tone: "bg-ok-subtle text-ok-ink" },
  access_denied: { Icon: ShieldAlert, tone: "bg-bad-subtle text-bad-ink" },
  access_revoked: { Icon: Lock, tone: "bg-plain-subtle text-plain-ink" },
  upload_confirmed: { Icon: Upload, tone: "bg-brand-subtle text-brand" },
  report_uploaded: { Icon: Upload, tone: "bg-brand-subtle text-brand" },
  mc_upload: { Icon: Upload, tone: "bg-brand-subtle text-brand" },
};

export function notificationIcon(type) {
  return TYPE_ICON[type] ?? { Icon: Bell, tone: "bg-plain-subtle text-plain-ink" };
}

export function timeAgo(dateStr) {
  const diff = Math.floor((new Date() - new Date(dateStr)) / 1000);
  if (diff < 60) return "Just now";
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  if (diff < 604800) return `${Math.floor(diff / 86400)}d ago`;
  return new Date(dateStr).toLocaleDateString("en-PK", { day: "numeric", month: "short", year: "numeric" });
}
