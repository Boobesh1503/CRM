import { useState, useEffect } from "react";
import { useOutletContext } from "react-router-dom";
import {
  ClipboardList,
  Calendar,
  CheckCircle2,
  Clock,
  X,
  Plus,
  RefreshCw
} from "lucide-react";
import { supabase } from "../../services/supabase";
import { notifyAdmin } from "../../services/notifications";
import type { EmployeeInfo } from "../../components/layout/EmployeeLayout";

interface ProfileContext {
  profile: EmployeeInfo | null;
  loadingProfile: boolean;
}

interface LeaveRecord {
  id: string;
  leave_type: string;
  start_date: string;
  end_date: string;
  days_count: number;
  reason: string;
  status: "Pending" | "Approved" | "Rejected";
  applied_at: string;
  rejection_reason?: string;
}

export default function EmployeeLeave() {
  const { profile } = useOutletContext<ProfileContext>();
  const [leaves, setLeaves] = useState<LeaveRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Form inputs
  const [leaveType, setLeaveType] = useState("Casual Leave");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [reason, setReason] = useState("");
  const [actionMsg, setActionMsg] = useState("");
  const [errorMsg, setErrorMsg] = useState("");

  async function loadLeaves() {
    if (!profile?.id) return;
    setLoading(true);
    setErrorMsg("");

    try {
      const { data, error } = await supabase
        .from("leave_requests")
        .select("*")
        .eq("employee_id", profile.id)
        .order("applied_at", { ascending: false });

      if (error) {
        setErrorMsg(error.message);
      } else {
        setLeaves((data ?? []) as LeaveRecord[]);
      }
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : "Error loading leave applications.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (profile?.id) {
      loadLeaves();
    }
  }, [profile?.id]);

  async function handleApplyLeave(e: React.FormEvent) {
    e.preventDefault();
    if (!profile?.id || !startDate || !endDate || !reason) return;

    setSubmitting(true);
    setErrorMsg("");
    setActionMsg("");

    try {
      const start = new Date(startDate);
      const end = new Date(endDate);
      const diffTime = Math.max(0, end.getTime() - start.getTime());
      const daysCount = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;

      const { error } = await supabase.from("leave_requests").insert({
        employee_id: profile.id,
        leave_type: leaveType,
        start_date: startDate,
        end_date: endDate,
        days_count: daysCount,
        reason: reason.trim(),
        status: "Pending",
      });

      if (error) throw new Error(error.message);

      await notifyAdmin(
        "New Leave Application",
        `${profile.full_name} (${profile.employee_code}) submitted a leave application for ${daysCount} day(s) (${leaveType}).`,
        "leave",
        "/leave-requests"
      );

      setActionMsg("Leave request submitted successfully. Awaiting administrator review.");
      setShowModal(false);
      setStartDate("");
      setEndDate("");
      setReason("");
      await loadLeaves();
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : "Failed to submit leave request.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="space-y-6 p-6">
      {/* Page Heading - Matches Admin Panel */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Leave Applications</h1>
          <p className="mt-1 text-sm text-gray-500">
            Submit time-off requests, view approval status, and manage attendance leaves.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={loadLeaves}
            disabled={loading}
            className="flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-3.5 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 shadow-sm transition disabled:opacity-50"
          >
            <RefreshCw size={15} className={loading ? "animate-spin text-blue-600" : ""} />
            Refresh
          </button>
          <button
            onClick={() => {
              setActionMsg("");
              setErrorMsg("");
              setShowModal(true);
            }}
            className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-blue-700 shadow-sm transition"
          >
            <Plus size={16} /> Apply for Leave
          </button>
        </div>
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

      {/* Leave Applications Table - Exact Admin Table Styling */}
      <div className="rounded-xl border border-gray-200 bg-white shadow-sm overflow-hidden">
        <div className="flex items-center justify-between border-b border-gray-200 p-5">
          <div>
            <h2 className="font-semibold text-gray-900">My Applications History</h2>
            <p className="mt-1 text-xs text-gray-500">Track all your submitted leave records</p>
          </div>
          <span className="text-xs text-gray-400 font-mono">{leaves.length} records</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-gray-50 text-xs uppercase text-gray-500">
              <tr>
                <th className="px-5 py-4">Leave Type</th>
                <th className="px-5 py-4">Dates</th>
                <th className="px-5 py-4">Days</th>
                <th className="px-5 py-4">Reason</th>
                <th className="px-5 py-4">Applied On</th>
                <th className="px-5 py-4">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading ? (
                <tr>
                  <td colSpan={6} className="px-5 py-12 text-center text-gray-500">
                    Loading leave requests...
                  </td>
                </tr>
              ) : leaves.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-5 py-12 text-center text-gray-500">
                    No leave requests found. Click "Apply for Leave" above to submit an application.
                  </td>
                </tr>
              ) : (
                leaves.map((item) => (
                  <tr key={item.id} className="hover:bg-gray-50 transition">
                    <td className="px-5 py-4 font-medium text-gray-900">
                      <span className="rounded bg-blue-50 px-2 py-0.5 text-xs font-medium text-blue-700">
                        {item.leave_type}
                      </span>
                    </td>
                    <td className="px-5 py-4 text-xs text-gray-600">
                      <div className="flex items-center gap-1">
                        <Calendar size={13} className="text-gray-400" />
                        {item.start_date} to {item.end_date}
                      </div>
                    </td>
                    <td className="px-5 py-4 font-semibold text-gray-800">{item.days_count} days</td>
                    <td className="px-5 py-4 text-xs text-gray-600 max-w-xs">{item.reason}</td>
                    <td className="px-5 py-4 text-xs text-gray-400">
                      {new Date(item.applied_at).toLocaleDateString()}
                    </td>
                    <td className="px-5 py-4">
                      <span
                        className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                          item.status === "Approved"
                            ? "bg-green-50 text-green-700 border border-green-200"
                            : item.status === "Pending"
                            ? "bg-amber-50 text-amber-700 border border-amber-200"
                            : "bg-red-50 text-red-700 border border-red-200"
                        }`}
                      >
                        {item.status === "Pending" ? <Clock size={12} /> : item.status === "Approved" ? <CheckCircle2 size={12} /> : <X size={12} />}
                        {item.status}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Apply Leave Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-lg rounded-2xl bg-white shadow-xl">
            <div className="flex items-center justify-between border-b border-gray-200 p-5">
              <div>
                <h3 className="text-lg font-semibold text-gray-900">Apply for Leave</h3>
                <p className="text-xs text-gray-500">Your application will be sent to the administrator</p>
              </div>
              <button
                onClick={() => setShowModal(false)}
                className="rounded-lg p-2 text-gray-400 hover:bg-gray-100"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleApplyLeave} className="space-y-4 p-5">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Leave Category
                </label>
                <select
                  value={leaveType}
                  onChange={(e) => setLeaveType(e.target.value)}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-blue-500"
                >
                  <option value="Casual Leave">Casual Leave</option>
                  <option value="Sick Leave">Sick Leave</option>
                  <option value="Paid Time Off">Paid Time Off</option>
                  <option value="Emergency">Emergency</option>
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Start Date
                  </label>
                  <input
                    type="date"
                    required
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="w-full rounded-lg border border-gray-300 p-2 text-sm outline-none focus:border-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    End Date
                  </label>
                  <input
                    type="date"
                    required
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    className="w-full rounded-lg border border-gray-300 p-2 text-sm outline-none focus:border-blue-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Reason for Leave
                </label>
                <textarea
                  rows={3}
                  required
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="Explain the reason for taking leave..."
                  className="w-full rounded-lg border border-gray-300 p-3 text-sm outline-none focus:border-blue-500"
                />
              </div>

              <div className="flex justify-end gap-3 border-t border-gray-100 pt-4">
                <button
                  type="button"
                  disabled={submitting}
                  onClick={() => setShowModal(false)}
                  className="rounded-lg border border-gray-300 px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-blue-700 transition disabled:opacity-50"
                >
                  {submitting ? "Submitting..." : "Submit Application"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
