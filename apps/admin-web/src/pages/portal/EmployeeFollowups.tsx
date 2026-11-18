import { useState, useEffect } from "react";
import { useOutletContext } from "react-router-dom";
import {
  CalendarDays,
  Clock,
  CheckCircle2,
  RotateCcw,
  Search,
  RefreshCw,
  X,
  Phone
} from "lucide-react";
import { supabase } from "../../services/supabase";
import { notifyAdmin } from "../../services/notifications";
import type { EmployeeInfo } from "../../components/layout/EmployeeLayout";

interface ProfileContext {
  profile: EmployeeInfo | null;
  loadingProfile: boolean;
}

interface FollowUpRecord {
  id: string;
  lead_id: string;
  client_name: string;
  company_name: string;
  scheduled_date: string;
  scheduled_time: string;
  type: string;
  priority: "High" | "Medium" | "Normal";
  status: "Pending" | "Overdue" | "Completed";
  notes: string;
  rescheduled_from?: string;
  created_at: string;
}

export default function EmployeeFollowups() {
  const { profile } = useOutletContext<ProfileContext>();
  const [followups, setFollowups] = useState<FollowUpRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<"Today" | "Upcoming" | "Completed">("Today");
  const [search, setSearch] = useState("");
  const [actionMsg, setActionMsg] = useState("");
  const [errorMsg, setErrorMsg] = useState("");

  // Reschedule Modal
  const [reschedulingItem, setReschedulingItem] = useState<FollowUpRecord | null>(null);
  const [newDate, setNewDate] = useState("");
  const [newTime, setNewTime] = useState("");
  const [rescheduleReason, setRescheduleReason] = useState("");
  const [savingReschedule, setSavingReschedule] = useState(false);

  async function loadFollowups() {
    if (!profile?.id) return;
    setLoading(true);
    setErrorMsg("");

    try {
      const { data, error } = await supabase
        .from("follow_ups")
        .select("*")
        .eq("employee_id", profile.id)
        .order("scheduled_date", { ascending: true });

      if (error) {
        setErrorMsg(error.message);
      } else {
        setFollowups((data ?? []) as FollowUpRecord[]);
      }
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : "Error loading follow-ups.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (profile?.id) {
      loadFollowups();
    }
  }, [profile?.id]);

  const todayStr = new Date().toISOString().split("T")[0];

  const filtered = followups.filter((item) => {
    let matchesTab = false;
    if (tab === "Today") {
      matchesTab = item.status !== "Completed" && item.scheduled_date <= todayStr;
    } else if (tab === "Upcoming") {
      matchesTab = item.status !== "Completed" && item.scheduled_date > todayStr;
    } else {
      matchesTab = item.status === "Completed";
    }

    const matchesSearch =
      (item.client_name || "").toLowerCase().includes(search.toLowerCase()) ||
      (item.company_name || "").toLowerCase().includes(search.toLowerCase());
    return matchesTab && matchesSearch;
  });

  async function markCompleted(id: string) {
    try {
      const { error } = await supabase
        .from("follow_ups")
        .update({ status: "Completed" })
        .eq("id", id);

      if (error) throw new Error(error.message);

      const targetFollowup = followups.find((f) => f.id === id);
      await notifyAdmin(
        "Follow-up Completed",
        `${profile?.full_name || "Employee"} marked follow-up with "${targetFollowup?.client_name || "Client"}" as completed.`,
        "call",
        "/followups"
      );

      setActionMsg("Follow-up marked as completed.");
      await loadFollowups();
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : "Could not complete follow-up.");
    }
  }

  async function handleRescheduleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!reschedulingItem || !newDate || !newTime) return;

    setSavingReschedule(true);
    try {
      const updatedNotes = reschedulingItem.notes
        ? `${reschedulingItem.notes} | Rescheduled: ${rescheduleReason}`
        : `Rescheduled: ${rescheduleReason}`;

      const { error } = await supabase
        .from("follow_ups")
        .update({
          scheduled_date: newDate,
          scheduled_time: newTime,
          notes: updatedNotes,
          rescheduled_from: `${reschedulingItem.scheduled_date} ${reschedulingItem.scheduled_time}`,
          status: "Pending",
        })
        .eq("id", reschedulingItem.id);

      if (error) throw new Error(error.message);

      await notifyAdmin(
        "Follow-up Rescheduled",
        `${profile?.full_name || "Employee"} rescheduled follow-up with "${reschedulingItem.client_name}" to ${newDate} at ${newTime}. Reason: ${rescheduleReason || "Client requested"}`,
        "call",
        "/followups"
      );

      setActionMsg(`Follow-up with ${reschedulingItem.client_name} rescheduled to ${newDate} at ${newTime}.`);
      setReschedulingItem(null);
      await loadFollowups();
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : "Failed to reschedule.");
    } finally {
      setSavingReschedule(false);
    }
  }

  const todayCount = followups.filter(
    (f) => f.status !== "Completed" && f.scheduled_date <= todayStr
  ).length;
  const upcomingCount = followups.filter(
    (f) => f.status !== "Completed" && f.scheduled_date > todayStr
  ).length;
  const completedCount = followups.filter((f) => f.status === "Completed").length;

  return (
    <div className="space-y-6 p-6">
      {/* Page Heading - Matches Admin Panel */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Follow-up Schedule</h1>
          <p className="mt-1 text-sm text-gray-500">
            Keep track of client touchpoints, callbacks, reschedule meetings, and record interaction outcomes.
          </p>
        </div>

        <button
          onClick={loadFollowups}
          disabled={loading}
          className="flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 shadow-sm transition disabled:opacity-50"
        >
          <RefreshCw size={15} className={loading ? "animate-spin text-blue-600" : ""} />
          Refresh
        </button>
      </div>

      {actionMsg && (
        <div className="flex items-center gap-2 rounded-lg bg-green-50 border border-green-200 p-3 text-sm text-green-700">
          <CheckCircle2 size={16} />
          {actionMsg}
        </div>
      )}

      {errorMsg && (
        <div className="rounded-lg bg-red-50 border border-red-200 p-3 text-sm text-red-700">
          {errorMsg}
        </div>
      )}

      {/* Tabs - Identical styling to Admin Tabs */}
      <div className="flex border-b border-gray-200">
        <button
          onClick={() => setTab("Today")}
          className={`flex items-center gap-2 border-b-2 px-5 py-3 text-sm font-semibold transition ${
            tab === "Today"
              ? "border-blue-600 text-blue-600"
              : "border-transparent text-gray-500 hover:text-gray-700"
          }`}
        >
          <Clock size={16} />
          Today's Queue ({todayCount})
        </button>
        <button
          onClick={() => setTab("Upcoming")}
          className={`flex items-center gap-2 border-b-2 px-5 py-3 text-sm font-semibold transition ${
            tab === "Upcoming"
              ? "border-blue-600 text-blue-600"
              : "border-transparent text-gray-500 hover:text-gray-700"
          }`}
        >
          <CalendarDays size={16} />
          Upcoming Follow-ups ({upcomingCount})
        </button>
        <button
          onClick={() => setTab("Completed")}
          className={`flex items-center gap-2 border-b-2 px-5 py-3 text-sm font-semibold transition ${
            tab === "Completed"
              ? "border-blue-600 text-blue-600"
              : "border-transparent text-gray-500 hover:text-gray-700"
          }`}
        >
          <CheckCircle2 size={16} />
          Completed ({completedCount})
        </button>
      </div>

      {/* Follow-ups List */}
      <div className="space-y-4">
        {loading ? (
          <div className="rounded-xl border border-gray-200 bg-white p-12 text-center text-sm text-gray-500 shadow-sm">
            Loading your follow-ups...
          </div>
        ) : filtered.length === 0 ? (
          <div className="rounded-xl border border-gray-200 bg-white p-12 text-center text-sm text-gray-500 shadow-sm">
            No follow-ups found in this section. You can schedule new follow-ups from your Assigned Leads.
          </div>
        ) : (
          filtered.map((item) => (
            <div
              key={item.id}
              className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm hover:border-gray-300 transition"
            >
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-base font-semibold text-gray-900">{item.client_name}</h3>
                    {item.company_name && (
                      <span className="text-xs text-gray-400">? {item.company_name}</span>
                    )}
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
                        item.priority === "High"
                          ? "bg-red-50 text-red-700"
                          : item.priority === "Medium"
                          ? "bg-amber-50 text-amber-700"
                          : "bg-blue-50 text-blue-700"
                      }`}
                    >
                      {item.priority}
                    </span>
                  </div>

                  <p className="mt-2 text-sm text-gray-700">{item.notes || "No notes entered"}</p>

                  <div className="mt-3 flex flex-wrap items-center gap-4 text-xs text-gray-500">
                    <span className="flex items-center gap-1 font-medium text-blue-700">
                      <Clock size={13} /> {item.scheduled_date} at {item.scheduled_time}
                    </span>
                    <span className="rounded bg-gray-100 px-2 py-0.5 text-gray-600">
                      {item.type}
                    </span>
                    {item.rescheduled_from && (
                      <span className="text-gray-400">
                        (Rescheduled from: {item.rescheduled_from})
                      </span>
                    )}
                  </div>
                </div>

                {item.status !== "Completed" && (
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => markCompleted(item.id)}
                      className="flex items-center gap-1.5 rounded-lg bg-blue-600 px-3.5 py-2 text-xs font-medium text-white hover:bg-blue-700 transition"
                    >
                      <CheckCircle2 size={14} /> Mark Completed
                    </button>
                    <button
                      onClick={() => {
                        setReschedulingItem(item);
                        setNewDate(item.scheduled_date);
                        setNewTime(item.scheduled_time);
                        setRescheduleReason("");
                      }}
                      className="flex items-center gap-1.5 rounded-lg border border-gray-300 px-3.5 py-2 text-xs font-medium text-gray-700 hover:bg-gray-50 transition"
                    >
                      <RotateCcw size={14} /> Reschedule
                    </button>
                  </div>
                )}
              </div>
            </div>
          ))
        )}
      </div>

      {/* Reschedule Modal */}
      {reschedulingItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white shadow-xl">
            <div className="flex items-center justify-between border-b border-gray-200 p-5">
              <h3 className="text-base font-semibold text-gray-900">
                Reschedule Follow-up for {reschedulingItem.client_name}
              </h3>
              <button
                onClick={() => setReschedulingItem(null)}
                className="rounded-lg p-2 text-gray-400 hover:bg-gray-100"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleRescheduleSubmit} className="space-y-4 p-5">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">New Date</label>
                  <input
                    type="date"
                    required
                    value={newDate}
                    onChange={(e) => setNewDate(e.target.value)}
                    className="w-full rounded-lg border border-gray-300 p-2 text-sm outline-none focus:border-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">New Time</label>
                  <input
                    type="time"
                    required
                    value={newTime}
                    onChange={(e) => setNewTime(e.target.value)}
                    className="w-full rounded-lg border border-gray-300 p-2 text-sm outline-none focus:border-blue-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">
                  Reason for Rescheduling
                </label>
                <textarea
                  rows={3}
                  required
                  value={rescheduleReason}
                  onChange={(e) => setRescheduleReason(e.target.value)}
                  placeholder="e.g. Client requested callback next Monday afternoon."
                  className="w-full rounded-lg border border-gray-300 p-2.5 text-sm outline-none focus:border-blue-500"
                />
              </div>

              <div className="flex justify-end gap-2 border-t border-gray-100 pt-3">
                <button
                  type="button"
                  onClick={() => setReschedulingItem(null)}
                  className="rounded-lg border border-gray-300 px-4 py-2 text-xs font-medium text-gray-700 hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingReschedule}
                  className="rounded-lg bg-blue-600 px-4 py-2 text-xs font-medium text-white hover:bg-blue-700 transition disabled:opacity-50"
                >
                  {savingReschedule ? "Rescheduling..." : "Confirm Reschedule"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
