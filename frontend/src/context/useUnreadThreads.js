import { useEffect, useState } from "react";
import { getUnreadThreads } from "../api/threads";

// Unread report-question threads per report id ({ [reportId]: count }), for the
// "New question" badges on report lists. Failures just mean no badges.
export function useUnreadThreads(token) {
  const [unread, setUnread] = useState({});
  useEffect(() => {
    if (!token) return;
    getUnreadThreads(token)
      .then((res) => setUnread(res.data || {}))
      .catch(() => setUnread({}));
  }, [token]);
  return unread;
}
