import { useCallback, useEffect, useRef, useState } from "react";
import { useLocation } from "react-router-dom";
import { MessageCircleQuestion, ChevronDown, Lock, CheckCircle2, RotateCcw, Send, AlertTriangle } from "lucide-react";
import {
  getReportThreads,
  startReportThread,
  getThreadMessages,
  sendThreadMessage,
  resolveThread,
  reopenThread,
} from "../api/threads";
import StatusPill from "./ui/StatusPill";
import { initials } from "../adapters/patientStory";
import { useAuth } from "../context/AuthContext";
import { parseServerDate } from "../utils/dates";

const MAX_LENGTH = 2000;
// The thread list refreshes like the notification bell; an open conversation is checked
// more often so replies show up quickly. No live connection is needed.
const LIST_POLL_MS = 30000;
const OPEN_THREAD_POLL_MS = 10000;

const formatTime = (value) =>
  parseServerDate(value).toLocaleString("en-PK", {
    day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit",
  });

const errorText = (err, fallback) => {
  const detail = err?.response?.data?.detail;
  if (err?.response?.status === 429) return "You are sending messages too quickly. Wait a minute and try again.";
  return typeof detail === "string" ? detail : fallback;
};

function Composer({ id, label, value, onChange, onSubmit, busy, submitLabel }) {
  const tooLong = value.length > MAX_LENGTH;
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit();
      }}
      className="space-y-2"
    >
      <label htmlFor={id} className="sr-only">{label}</label>
      <textarea
        id={id}
        rows={3}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={label}
        aria-describedby={`${id}-count`}
        className="field resize-y"
      />
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span id={`${id}-count`} className={`text-sm ${tooLong ? "font-semibold text-bad-ink" : "text-muted"}`}>
          {value.length} / {MAX_LENGTH}
        </span>
        <button type="submit" disabled={busy || !value.trim() || tooLong} className="btn btn-primary btn-sm">
          <Send aria-hidden="true" size={16} />
          {busy ? "Sending..." : submitLabel}
        </button>
      </div>
    </form>
  );
}

function MessageList({ messages }) {
  if (!messages) return <p className="py-3 text-sm text-muted">Loading messages...</p>;
  return (
    <ol className="space-y-4">
      {messages.map((m) => (
        <li key={m.id} className={`flex gap-3 ${m.pending ? "opacity-60" : ""}`}>
          <span
            aria-hidden="true"
            className={`flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full text-[13px] font-bold ${
              m.sender_role === "doctor" ? "bg-brand-subtle text-brand" : "bg-inset text-ink-soft"
            }`}
          >
            {initials(m.sender_name)}
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-sm">
              <span className="font-bold text-ink">
                {m.sender_role === "doctor" ? `Dr. ${m.sender_name}` : m.sender_name}
                {m.is_mine && " (you)"}
              </span>
              <span className="text-muted">
                {" "}· {m.sender_role === "doctor" ? "Doctor" : "Patient"} · {m.pending ? "Sending..." : formatTime(m.sent_at)}
              </span>
            </p>
            <p className="mt-1 whitespace-pre-wrap break-words text-sm leading-6 text-ink-soft">{m.body}</p>
          </div>
        </li>
      ))}
    </ol>
  );
}

/**
 * The "Questions" card on a report: private threads between the patient and each doctor
 * who has access. Patients see one thread per doctor and can ask any doctor with access;
 * a doctor sees only their own thread. A thread turns read-only when the doctor's access
 * ends, and comes back when it is granted again.
 *
 * `onLoad` receives the threads response (or null when there is nothing to show), so the
 * page can react, e.g. the doctor's viewer explains that their access has ended.
 */
function ReportThreads({ token, reportId, role, onLoad }) {
  const location = useLocation();
  const { user } = useAuth();
  const sectionRef = useRef(null);
  const scrolled = useRef(false);
  // Numbers messages shown before the server confirms them
  const sendCount = useRef(0);

  // undefined while loading; null when there is nothing this viewer may see
  const [data, setData] = useState(undefined);
  const [details, setDetails] = useState({});
  const [expandedId, setExpandedId] = useState(null);
  const [drafts, setDrafts] = useState({});
  const [newDoctorId, setNewDoctorId] = useState("");
  const [newBody, setNewBody] = useState("");
  const [busy, setBusy] = useState(null);
  const [error, setError] = useState("");

  const isPatient = role === "patient";

  // State is only set once the request settles, so these are safe to call from effects.
  const load = useCallback(
    () =>
      getReportThreads(token, reportId)
        .then((res) => {
          setData(res.data);
          onLoad?.(res.data);
        })
        .catch(() => {
          setData(null);
          onLoad?.(null);
        }),
    [token, reportId, onLoad]
  );

  const loadMessages = useCallback(
    (threadId) =>
      getThreadMessages(token, threadId)
        .then((res) => {
          setDetails((d) => {
            // Keep messages sent from this page that this response predates.
            const known = new Set(res.data.messages.map((m) => m.id));
            const local = (d[threadId]?.messages ?? []).filter((m) => (m.pending || m.local) && !known.has(m.id));
            return { ...d, [threadId]: { ...res.data, messages: [...res.data.messages, ...local] } };
          });
          // Opening a thread marks it read.
          setData((current) =>
            current
              ? { ...current, threads: current.threads.map((t) => (t.id === threadId ? { ...t, unread: false } : t)) }
              : current
          );
        })
        .catch((err) => setError(errorText(err, "Could not load this conversation."))),
    [token]
  );

  const threads = data?.threads ?? [];
  // A doctor has a single thread, and a patient with one thread sees it open; otherwise
  // the first unread thread opens (e.g. when arriving from a notification).
  const defaultOpenId =
    threads.length === 1 ? threads[0].id : (threads.find((t) => t.unread) ?? null)?.id ?? null;
  const openId = expandedId ?? defaultOpenId;

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (openId) loadMessages(openId);
  }, [openId, loadMessages]);

  // Refresh while the page is open and visible.
  useEffect(() => {
    const timer = setInterval(() => {
      if (document.visibilityState === "visible") load();
    }, LIST_POLL_MS);
    return () => clearInterval(timer);
  }, [load]);

  useEffect(() => {
    if (!openId) return undefined;
    const timer = setInterval(() => {
      if (document.visibilityState === "visible") loadMessages(openId);
    }, OPEN_THREAD_POLL_MS);
    return () => clearInterval(timer);
  }, [loadMessages, openId]);

  // Replace a thread's summary with the one the server returned.
  const applySummary = (summary) =>
    setData((current) =>
      current
        ? {
            ...current,
            threads: [
              { ...summary, unread: false },
              ...current.threads.filter((t) => t.id !== summary.id),
            ],
          }
        : current
    );

  // Notifications link to #questions: bring the card into view once it has loaded.
  useEffect(() => {
    if (data && location.hash === "#questions" && !scrolled.current) {
      scrolled.current = true;
      sectionRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }, [data, location.hash]);

  // The message appears straight away and is confirmed when the server replies.
  const send = async (thread) => {
    const body = drafts[thread.id] || "";
    const temp = {
      id: `sending-${(sendCount.current += 1)}`,
      sender_role: role,
      sender_name: user?.name,
      is_mine: true,
      body: body.trim(),
      sent_at: null, // shown as "Sending..." until the server confirms it
      pending: true,
    };
    const withoutTemp = (messages) => (messages ?? []).filter((m) => m.id !== temp.id);
    setBusy(thread.id);
    setError("");
    setDrafts((d) => ({ ...d, [thread.id]: "" }));
    setDetails((d) => ({ ...d, [thread.id]: { ...d[thread.id], messages: [...(d[thread.id]?.messages ?? []), temp] } }));
    try {
      const res = await sendThreadMessage(token, thread.id, body);
      const { message, ...summary } = res.data;
      setDetails((d) => ({
        ...d,
        [thread.id]: { ...d[thread.id], messages: [...withoutTemp(d[thread.id]?.messages), { ...message, local: true }] },
      }));
      applySummary(summary);
    } catch (err) {
      // Put the text back so nothing is lost.
      setDetails((d) => ({ ...d, [thread.id]: { ...d[thread.id], messages: withoutTemp(d[thread.id]?.messages) } }));
      setDrafts((d) => ({ ...d, [thread.id]: body }));
      setError(errorText(err, "Could not send your message."));
    }
    setBusy(null);
  };

  const toggleResolved = async (thread) => {
    setBusy(`resolve-${thread.id}`);
    setError("");
    try {
      const res =
        thread.status === "resolved" ? await reopenThread(token, thread.id) : await resolveThread(token, thread.id);
      applySummary(res.data);
    } catch (err) {
      setError(errorText(err, "Could not update this conversation."));
    }
    setBusy(null);
  };

  const startNew = async () => {
    setBusy("new");
    setError("");
    try {
      const res = await startReportThread(token, reportId, newBody, isPatient ? newDoctorId : null);
      const { message, ...summary } = res.data;
      setNewBody("");
      setNewDoctorId("");
      setExpandedId(summary.id);
      // A new thread has just this message; an existing one is reloaded when it opens.
      setDetails((d) =>
        d[summary.id] ? { ...d, [summary.id]: { ...d[summary.id], messages: [...d[summary.id].messages, message] } }
          : { ...d, [summary.id]: { ...summary, messages: [message] } }
      );
      applySummary(summary);
      // Refresh in the background (e.g. the doctor list's "continues your conversation").
      load();
    } catch (err) {
      setError(errorText(err, "Could not send your question."));
    }
    setBusy(null);
  };

  if (data === null) return null;
  if (data && !isPatient && threads.length === 0 && !data.can_start) return null;

  const askable = data?.askable_doctors ?? [];

  return (
    <section id="questions" ref={sectionRef} className="card card-pad scroll-mt-24" aria-labelledby="questions-heading">
      <h2 id="questions-heading" className="display flex items-center gap-2.5 text-xl text-ink">
        <MessageCircleQuestion aria-hidden="true" size={24} className="text-brand" />
        Questions
      </h2>
      <p className="mt-2 text-sm leading-6 text-muted">
        {isPatient
          ? "Ask a doctor who has access to your records about this report. Each conversation is private between you and that doctor."
          : "A private conversation with the patient about this report. Other doctors cannot see it."}
      </p>

      {data === undefined ? (
        <p className="mt-4 text-sm text-muted">Loading...</p>
      ) : (
        <>
          {threads.length > 0 && (
            <ul className="mt-5 space-y-3">
              {threads.map((thread) => {
                const open = openId === thread.id;
                const detail = details[thread.id];
                const who = isPatient ? `Dr. ${thread.doctor.name}` : thread.patient_name;
                return (
                  <li key={thread.id} className="card-inset">
                    <h3>
                      <button
                        type="button"
                        onClick={() => setExpandedId(open ? "" : thread.id)}
                        aria-expanded={open}
                        aria-controls={`thread-${thread.id}`}
                        className="flex w-full flex-wrap items-center justify-between gap-2 px-4 py-3.5 text-left"
                      >
                        <span className="min-w-0">
                          <span className="block text-sm font-bold text-ink">{who}</span>
                          {isPatient && thread.doctor.specialization && (
                            <span className="block text-sm capitalize text-muted">{thread.doctor.specialization}</span>
                          )}
                        </span>
                        <span className="flex flex-wrap items-center gap-2">
                          {thread.unread && <span className="pill pill-brand">New</span>}
                          {!thread.can_post && (
                            <StatusPill tone="plain" icon={Lock}>Read-only</StatusPill>
                          )}
                          <StatusPill tone={thread.status === "resolved" ? "ok" : "warn"} icon={thread.status === "resolved" ? CheckCircle2 : undefined}>
                            {thread.status === "resolved" ? "Resolved" : "Open"}
                          </StatusPill>
                          <ChevronDown
                            aria-hidden="true"
                            size={18}
                            className={`text-muted transition-transform ${open ? "rotate-180" : ""}`}
                          />
                        </span>
                      </button>
                    </h3>

                    {open && (
                      <div id={`thread-${thread.id}`} className="space-y-4 border-t border-line px-4 py-4">
                        <MessageList messages={detail?.messages} />

                        {thread.can_post ? (
                          <>
                            <Composer
                              id={`reply-${thread.id}`}
                              label={isPatient ? `Reply to Dr. ${thread.doctor.name}` : "Reply to the patient"}
                              value={drafts[thread.id] || ""}
                              onChange={(v) => setDrafts((d) => ({ ...d, [thread.id]: v }))}
                              onSubmit={() => send(thread)}
                              busy={busy === thread.id}
                              submitLabel="Send reply"
                            />
                            <button
                              type="button"
                              onClick={() => toggleResolved(thread)}
                              disabled={busy === `resolve-${thread.id}`}
                              className="btn btn-ghost btn-sm"
                            >
                              {thread.status === "resolved" ? (
                                <><RotateCcw aria-hidden="true" size={16} /> Reopen</>
                              ) : (
                                <><CheckCircle2 aria-hidden="true" size={16} /> Mark resolved</>
                              )}
                            </button>
                          </>
                        ) : (
                          <p className="flex gap-2 rounded-xl bg-inset p-3 text-sm leading-6 text-ink-soft">
                            <Lock aria-hidden="true" size={16} className="mt-1 flex-shrink-0" />
                            {isPatient
                              ? `Dr. ${thread.doctor.name} no longer has access to your records, so this conversation is read-only. Approving a new access request from them reopens it.`
                              : "You no longer have access to this patient's report, so this conversation is read-only."}
                          </p>
                        )}
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          )}

          {/* Start a new conversation */}
          {isPatient ? (
            askable.length > 0 ? (
              <div className="mt-5 space-y-3">
                <h3 className="text-sm font-bold text-ink">Ask a doctor</h3>
                <div>
                  <label htmlFor="ask-doctor" className="field-label">Doctor</label>
                  <select
                    id="ask-doctor"
                    value={newDoctorId}
                    onChange={(e) => setNewDoctorId(e.target.value)}
                    className="field"
                  >
                    <option value="">Choose a doctor with access to your records</option>
                    {askable.map((d) => (
                      <option key={d.id} value={d.id}>
                        Dr. {d.name}
                        {d.specialization ? ` (${d.specialization})` : ""}
                        {d.has_thread ? " · continues your conversation" : ""}
                      </option>
                    ))}
                  </select>
                </div>
                {newDoctorId && (
                  <Composer
                    id="new-question"
                    label="Your question about this report"
                    value={newBody}
                    onChange={setNewBody}
                    onSubmit={startNew}
                    busy={busy === "new"}
                    submitLabel="Send question"
                  />
                )}
              </div>
            ) : (
              threads.length === 0 && (
                <p className="mt-4 rounded-xl bg-inset p-3 text-sm leading-6 text-ink-soft">
                  No doctor has access to your records right now. Once you approve a doctor's access request, you can
                  ask them about this report here.
                </p>
              )
            )
          ) : (
            threads.length === 0 &&
            data.can_start && (
              <div className="mt-5">
                <Composer
                  id="new-question"
                  label="Ask the patient about this report"
                  value={newBody}
                  onChange={setNewBody}
                  onSubmit={startNew}
                  busy={busy === "new"}
                  submitLabel="Ask the patient"
                />
              </div>
            )
          )}
        </>
      )}

      {error && (
        <p role="alert" className="mt-4 rounded-xl bg-bad-subtle p-3.5 text-sm font-semibold text-bad-ink">{error}</p>
      )}

      <p className="mt-5 flex gap-2 text-sm leading-6 text-muted">
        <AlertTriangle aria-hidden="true" size={16} className="mt-1 flex-shrink-0 text-warn-ink" />
        Not for emergencies. Replies can take a while. For urgent help, call 1122 or go to the nearest emergency
        department.
      </p>
    </section>
  );
}

export default ReportThreads;
