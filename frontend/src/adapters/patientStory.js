import { parseServerDate } from "../utils/dates";

// Adapter for the patient dashboard.
//
// It turns what the backend already returns (/reports/my and /access-requests)
// into the shapes the Template A screens need. There is no sample data in this
// file: every value comes from those two responses. Anything the template
// showed that the backend cannot supply yet (allergies, an integrity score,
// lab value charts) is left out of the UI on purpose.

const DAY_MS = 24 * 60 * 60 * 1000;

const SOURCE_LABEL = {
  patient: "Uploaded by you",
  medical_center: "Uploaded by a medical center",
};

export function sourceLabel(source) {
  return SOURCE_LABEL[source] ?? "Uploaded";
}

// "Dr. Sana Malik" stays as is, "Sana Malik" becomes "Dr. Sana Malik".
export function doctorLabel(name) {
  if (!name) return "A doctor";
  return /^dr\.?\s/i.test(name.trim()) ? name.trim() : `Dr. ${name.trim()}`;
}

export function initials(name) {
  if (!name) return "U";
  const parts = name.replace(/^dr\.?\s+/i, "").trim().split(/\s+/);
  const letters = (parts[0]?.[0] ?? "") + (parts.length > 1 ? parts[parts.length - 1][0] : "");
  return letters.toUpperCase() || "U";
}

// Report types are free text on the backend, so the filter tabs are built from
// whatever types this patient actually has.
export function reportTypes(reports) {
  return [...new Set(reports.map((r) => r.report_type).filter(Boolean))];
}

// Newest first, grouped by calendar month, for the timeline.
export function groupStoryByMonth(reports, type = "All") {
  const rows = reports
    .filter((r) => type === "All" || r.report_type === type)
    .slice()
    .sort((a, b) => parseServerDate(b.uploaded_at) - parseServerDate(a.uploaded_at));

  const groups = [];
  for (const r of rows) {
    const d = parseServerDate(r.uploaded_at);
    const key = `${d.getFullYear()}-${d.getMonth()}`;
    let group = groups[groups.length - 1];
    if (!group || group.key !== key) {
      group = {
        key,
        label: d.toLocaleDateString("en-US", { month: "long", year: "numeric" }),
        items: [],
      };
      groups.push(group);
    }
    group.items.push({
      id: r.id,
      day: String(d.getDate()).padStart(2, "0"),
      month: d.toLocaleDateString("en-US", { month: "short" }),
      title: r.original_filename,
      subtitle: sourceLabel(r.upload_source),
      type: r.report_type,
      pending: !r.is_approved,
    });
  }
  return groups;
}

// Approved doctors whose access has not run out, soonest to end first.
export function activeAccess(requests, now = Date.now()) {
  return requests
    .filter((r) => r.status === "approved")
    .map((r) => {
      const end = r.expires_at ? parseServerDate(r.expires_at) : null;
      return {
        id: r.id,
        doctor: doctorLabel(r.doctor_name),
        specialization: r.doctor_specialization,
        endsOn: end ? end.toLocaleDateString("en-GB", { day: "numeric", month: "short" }) : null,
        daysLeft: end ? Math.max(0, Math.ceil((end.getTime() - now) / DAY_MS)) : null,
        endTime: end ? end.getTime() : Infinity,
      };
    })
    .filter((r) => r.endTime > now)
    .sort((a, b) => a.endTime - b.endTime);
}

export function pendingRequests(requests) {
  return requests
    .filter((r) => r.status === "pending")
    .sort((a, b) => parseServerDate(b.requested_at) - parseServerDate(a.requested_at));
}
