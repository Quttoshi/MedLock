import { Bell, Clock, ShieldCheck, ShieldAlert, Upload, Lock, MessageCircleQuestion, MessageSquareReply, Siren, Flag } from "lucide-react";
import { parseServerDate } from "../../utils/dates";

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
  report_question: { Icon: MessageCircleQuestion, tone: "bg-brand-subtle text-brand" },
  report_reply: { Icon: MessageSquareReply, tone: "bg-brand-subtle text-brand" },
  records_shared: { Icon: ShieldCheck, tone: "bg-ok-subtle text-ok-ink" },
  emergency_access_started: { Icon: Siren, tone: "bg-bad-subtle text-bad-ink" },
  emergency_access_ended: { Icon: Siren, tone: "bg-plain-subtle text-plain-ink" },
  emergency_access_flagged: { Icon: Flag, tone: "bg-warn-subtle text-warn-ink" },
};

export function notificationIcon(type) {
  return TYPE_ICON[type] ?? { Icon: Bell, tone: "bg-plain-subtle text-plain-ink" };
}

export function timeAgo(dateStr) {
  const diff = Math.floor((new Date() - parseServerDate(dateStr)) / 1000);
  if (diff < 60) return "Just now";
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  if (diff < 604800) return `${Math.floor(diff / 86400)}d ago`;
  return parseServerDate(dateStr).toLocaleDateString("en-PK", { day: "numeric", month: "short", year: "numeric" });
}
