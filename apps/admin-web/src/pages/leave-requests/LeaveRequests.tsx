import { useState, useEffect } from "react";
import {
  ClipboardList,
  Check,
  X,
  Clock,
  Search,
  Calendar,
  User,
  Filter,
  CheckCircle2,
  XCircle,
  AlertCircle,
  RefreshCw,
  Eye,
  GraduationCap,
  Shield,
  Send
} from "lucide-react";
import { supabase } from "../../services/supabase";
import { notifyEmployee } from "../../services/notifications";

export interface LeaveRequestRecord {
  id: string;
  employee_id: string;
  leave_type: string;
  start_date: string;
  end_date: string;
  days_count: number;
  reason: string;
  status: "Pending" | "Approved" | "Rejected";
  applied_at: string;
  rejection_reason?: string | null;
  reviewed_at?: string | null;
  employee?: {
    id: string;
    full_name: string;
    employee_code: string;
    department: string | null;
    role: string;
    email: string;
  } | null;
}

export default function LeaveRequests() {
  const [leaves, setLeaves] = useState<LeaveRequestRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState("");
  const [successMsg, setSuccessMsg] = useState("");

  // Filters
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"All" | "Pending" | "Approved" | "Rejected">("All");
  const [categoryFilter, setCategoryFilter] = useState<"all" | "intern" | "team_leader">("all");
  const [dateFilter, setDateFilter] = useState("");

  // Action states
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [rejectModalLeave, setRejectModalLeave] = useState<LeaveRequestRecord | null>(null);
  const [rejectReason, setRejectReason] = useState("");
  const [viewModalLeave, setViewModalLeave] = useState<LeaveRequestRecord | null>(null);

  async function loadLeaves() {
    setLoading(true);
    setErrorMsg("");
    try {
      // Query real leave requests from Supabase joined with employees
      const { data, error } = await supabase
        .from("leave_requests")
        .select(`
          id,
          employee_id,
          leave_type,
          start_date,
          end_date,
          days_count,
          reason,
          status,
          applied_at,
          rejection_reason,
          reviewed_at,
          employee:employees (
            id,
            full_name,
            employee_code,
            department,
            role,
            email
          )
        `)
        .order("applied_at", { ascending: false });

      if (error) {
        console.warn("Could not fetch leave requests:", error.message);
        setErrorMsg(error.message);
        setLeaves([]);
      } else {
        const formatted: LeaveRequestRecord[] = (data || []).map((row: any) => ({
          ...row,
          employee: Array.isArray(row.employee) ? row.employee[0] : row.employee,
        }));
        setLeaves(formatted);
      }
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : "Error loading leave applications.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadLeaves();
  }, []);

  // Handle Approve
  async function handleApprove(leave: LeaveRequestRecord) {
    if (processingId) return;
    setProcessingId(leave.id);
    setErrorMsg("");
    setSuccessMsg("");

    try {
      const now = new Date().toISOString();
      const { error } = await supabase
        .from("leave_requests")
        .update({
          status: "Approved",
          reviewed_at: now,
          rejection_reason: null,
        })
        .eq("id", leave.id);

      if (error) throw new Error(error.message);

      // Dispatch real-time notification to employee portal/account
      await notifyEmployee(
        leave.employee_id,
        "Leave Request Approved",
        `Your application for ${leave.days_count} day(s) (${leave.leave_type}) from ${leave.start_date} to ${leave.end_date} has been approved by the Admin.`,
        "leave",
        "/portal/leave-requests"
      );

      // Update local state
      setLeaves((prev) =>
        prev.map((item) =>
          item.id === leave.id
            ? { ...item, status: "Approved", reviewed_at: now, rejection_reason: null }
            : item
        )
      );

      setSuccessMsg(`Leave request for ${leave.employee?.full_name || "Employee"} approved successfully.`);
      setTimeout(() => setSuccessMsg(""), 4000);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : "Failed to approve leave request.");
    } finally {
      setProcessingId(null);
    }
  }

  // Handle Reject
  async function handleRejectSubmit() {
    if (!rejectModalLeave || processingId) return;
    setProcessingId(rejectModalLeave.id);
    setErrorMsg("");
    setSuccessMsg("");

    try {
      const now = new Date().toISOString();
      const finalReason = rejectReason.trim() || "Declined by administrator.";

      const { error } = await supabase
        .from("leave_requests")
        .update({
          status: "Rejected",
          reviewed_at: now,
          rejection_reason: finalReason,
        })
        .eq("id", rejectModalLeave.id);

      if (error) throw new Error(error.message);

      // Dispatch notification to employee
      await notifyEmployee(
        rejectModalLeave.employee_id,
        "Leave Request Declined",
        `Your application for ${rejectModalLeave.days_count} day(s) (${rejectModalLeave.leave_type}) has been declined: ${finalReason}`,
        "leave",
        "/portal/leave-requests"
      );

      // Update local state
      setLeaves((prev) =>
        prev.map((item) =>
          item.id === rejectModalLeave.id
            ? { ...item, status: "Rejected", reviewed_at: now, rejection_reason: finalReason }
            : item
        )
      );

      setSuccessMsg(`Leave request for ${rejectModalLeave.employee?.full_name || "Employee"} declined.`);
      setTimeout(() => setSuccessMsg(""), 4000);
      setRejectModalLeave(null);
      setRejectReason("");
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : "Failed to reject leave request.");
    } finally {
      setProcessingId(null);
    }
  }

  // Filter leaves
  const filtered = leaves.filter((leave) => {
    // Search
    const empName = leave.employee?.full_name?.toLowerCase() || "";
    const empCode = leave.employee?.employee_code?.toLowerCase() || "";
    const dept = leave.employee?.department?.toLowerCase() || "";
    const reason = leave.reason?.toLowerCase() || "";
    const q = search.toLowerCase();
    const matchesSearch = !q || empName.includes(q) || empCode.includes(q) || dept.includes(q) || reason.includes(q);

    // Status
    const matchesStatus = statusFilter === "All" || leave.status === statusFilter;

    // Category (Interns vs Team Leaders)
    const empRole = (leave.employee?.role || "").toLowerCase();
    let matchesCategory = true;
    if (categoryFilter === "intern") {
      matchesCategory = empRole.includes("intern");
    } else if (categoryFilter === "team_leader") {
      matchesCategory = empRole.includes("leader") || empRole.includes("tl");
    }

    // Date
    const matchesDate = !dateFilter || leave.start_date.includes(dateFilter) || leave.applied_at.includes(dateFilter);

    return matchesSearch && matchesStatus && matchesCategory && matchesDate;
  });

  const pendingCount = leaves.filter((l) => l.status === "Pending").length;
  const approvedCount = leaves.filter((l) => l.status === "Approved").length;
  const rejectedCount = leaves.filter((l) => l.status === "Rejected").length;

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Leave Applications & Approval</h1>
          <p className="mt-1 text-sm text-gray-500">
            Review live employee leave applications, approve or decline requests, and sync status with employee accounts.
          </p>
        </div>

        <button
          onClick={loadLeaves}
          disabled={loading}
          className="flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-3.5 py-2 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50 transition"
        >
          <RefreshCw size={16} className={loading ? "animate-spin text-blue-600" : "text-gray-500"} />
          Refresh Records
        </button>
      </div>

      {/* Alert Messages */}
      {successMsg && (
        <div className="flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-800 animate-fadeIn">
          <CheckCircle2 size={18} className="text-emerald-600 shrink-0" />
          <span>{successMsg}</span>
        </div>
      )}

      {errorMsg && (
        <div className="flex items-center gap-2 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-medium text-rose-800">
          <AlertCircle size={18} className="text-rose-600 shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* Metric Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-4">
        <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium text-gray-500">Total Applications</p>
            <div className="rounded-lg bg-blue-50 p-2 text-blue-600">
              <ClipboardList size={18} />
            </div>
          </div>
          <p className="mt-3 text-3xl font-bold text-gray-900">{leaves.length}</p>
          <span className="mt-1 block text-xs text-gray-400">Database verified requests</span>
        </div>

        <div className="rounded-xl border border-amber-200 bg-amber-50/50 p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium text-amber-800">Pending Review</p>
            <div className="rounded-lg bg-amber-100 p-2 text-amber-700">
              <Clock size={18} />
            </div>
          </div>
          <p className="mt-3 text-3xl font-bold text-amber-600">{pendingCount}</p>
          <span className="mt-1 block text-xs text-amber-700">Awaiting your approval</span>
        </div>

        <div className="rounded-xl border border-emerald-200 bg-emerald-50/50 p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium text-emerald-800">Approved Leaves</p>
            <div className="rounded-lg bg-emerald-100 p-2 text-emerald-700">
              <Check size={18} />
            </div>
          </div>
          <p className="mt-3 text-3xl font-bold text-emerald-600">{approvedCount}</p>
          <span className="mt-1 block text-xs text-emerald-700">Reflected in employee portals</span>
        </div>

        <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium text-gray-500">Declined Requests</p>
            <div className="rounded-lg bg-rose-50 p-2 text-rose-600">
              <X size={18} />
            </div>
          </div>
          <p className="mt-3 text-3xl font-bold text-gray-700">{rejectedCount}</p>
          <span className="mt-1 block text-xs text-gray-400">Rejected with remarks</span>
        </div>
      </div>

      {/* Main Container */}
      <div className="rounded-xl border border-gray-200 bg-white shadow-sm overflow-hidden">
        {/* Sub-section Category Tabs (Interns vs Team Leaders) */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-gray-100 bg-gray-50/60 p-4">
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => setCategoryFilter("all")}
              className={`flex items-center gap-2 rounded-lg px-3.5 py-1.5 text-xs font-semibold transition ${
                categoryFilter === "all"
                  ? "bg-gray-900 text-white shadow-sm"
                  : "bg-white text-gray-600 border border-gray-200 hover:bg-gray-100"
              }`}
            >
              <User size={14} />
              All Workforce ({leaves.length})
            </button>
            <button
              onClick={() => setCategoryFilter("intern")}
              className={`flex items-center gap-2 rounded-lg px-3.5 py-1.5 text-xs font-semibold transition ${
                categoryFilter === "intern"
                  ? "bg-purple-600 text-white shadow-sm"
                  : "bg-white text-gray-600 border border-gray-200 hover:bg-gray-100"
              }`}
            >
              <GraduationCap size={14} />
              Interns ({leaves.filter((l) => (l.employee?.role || "").toLowerCase().includes("intern")).length})
            </button>
            <button
              onClick={() => setCategoryFilter("team_leader")}
              className={`flex items-center gap-2 rounded-lg px-3.5 py-1.5 text-xs font-semibold transition ${
                categoryFilter === "team_leader"
                  ? "bg-amber-600 text-white shadow-sm"
                  : "bg-white text-gray-600 border border-gray-200 hover:bg-gray-100"
              }`}
            >
              <Shield size={14} />
              Team Leaders (TL) ({leaves.filter((l) => (l.employee?.role || "").toLowerCase().includes("leader") || (l.employee?.role || "").toLowerCase().includes("tl")).length})
            </button>
          </div>

          <div className="text-xs text-gray-500">
            Showing <span className="font-semibold text-gray-900">{filtered.length}</span> records
          </div>
        </div>

        {/* Status Filter Tabs & Search Bar */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-gray-200 p-4">
          <div className="flex flex-wrap items-center gap-2">
            {(["All", "Pending", "Approved", "Rejected"] as const).map((status) => (
              <button
                key={status}
                onClick={() => setStatusFilter(status)}
                className={`rounded-lg px-3 py-1.5 text-xs font-medium transition ${
                  statusFilter === status
                    ? "bg-blue-600 text-white shadow-sm"
                    : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                }`}
              >
                {status === "All" ? "All Status" : status}
                {status === "Pending" && pendingCount > 0 && (
                  <span className="ml-1.5 rounded-full bg-amber-400 px-1.5 py-0.5 text-[10px] font-bold text-gray-900">
                    {pendingCount}
                  </span>
                )}
              </button>
            ))}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-2 rounded-lg border border-gray-200 px-3 py-1.5">
              <Search size={15} className="text-gray-400" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search employee, reason..."
                className="w-44 text-xs outline-none"
              />
            </div>

            <div className="flex items-center gap-1.5 rounded-lg border border-gray-200 px-2.5 py-1.5 text-xs text-gray-600">
              <Calendar size={14} className="text-gray-400" />
              <input
                type="date"
                value={dateFilter}
                onChange={(e) => setDateFilter(e.target.value)}
                className="bg-transparent text-xs outline-none cursor-pointer"
              />
              {dateFilter && (
                <button
                  onClick={() => setDateFilter("")}
                  className="ml-1 text-gray-400 hover:text-gray-600"
                  title="Clear date"
                >
                  <X size={12} />
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Leave Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-gray-600">
            <thead className="bg-gray-50 text-xs font-semibold text-gray-500 uppercase tracking-wider">
              <tr>
                <th className="px-5 py-3.5">Employee</th>
                <th className="px-5 py-3.5">Category</th>
                <th className="px-5 py-3.5">Leave Type</th>
                <th className="px-5 py-3.5">Duration</th>
                <th className="px-5 py-3.5">Days</th>
                <th className="px-5 py-3.5">Reason</th>
                <th className="px-5 py-3.5">Status</th>
                <th className="px-5 py-3.5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-sm text-gray-500">
                    <RefreshCw size={24} className="mx-auto mb-2 animate-spin text-blue-600" />
                    Loading leave requests from database...
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center">
                    <ClipboardList size={36} className="mx-auto mb-3 text-gray-300" />
                    <p className="text-sm font-medium text-gray-700">No leave requests found</p>
                    <p className="mt-1 text-xs text-gray-400">
                      {search || statusFilter !== "All" || categoryFilter !== "all"
                        ? "Try adjusting your filters or search criteria."
                        : "No employee leave applications have been submitted yet."}
                    </p>
                  </td>
                </tr>
              ) : (
                filtered.map((leave) => {
                  const emp = leave.employee;
                  const isIntern = (emp?.role || "").toLowerCase().includes("intern");
                  const isTL = (emp?.role || "").toLowerCase().includes("leader") || (emp?.role || "").toLowerCase().includes("tl");

                  return (
                    <tr key={leave.id} className="hover:bg-gray-50/70 transition">
                      <td className="px-5 py-4">
                        <div>
                          <p className="font-semibold text-gray-900">{emp?.full_name || "Unassigned"}</p>
                          <p className="text-xs text-gray-500">{emp?.employee_code || "ID-Pending"}</p>
                        </div>
                      </td>

                      <td className="px-5 py-4">
                        {isIntern ? (
                          <span className="inline-flex items-center gap-1 rounded-full bg-purple-50 px-2.5 py-1 text-xs font-semibold text-purple-700 border border-purple-200">
                            <GraduationCap size={12} /> Intern
                          </span>
                        ) : isTL ? (
                          <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-700 border border-amber-200">
                            <Shield size={12} /> Team Leader
                          </span>
                        ) : (
                          <span className="inline-flex items-center rounded-full bg-gray-100 px-2.5 py-1 text-xs font-medium text-gray-600">
                            {emp?.role || "Staff"}
                          </span>
                        )}
                      </td>

                      <td className="px-5 py-4">
                        <span className="inline-flex items-center rounded-lg bg-blue-50 px-2.5 py-1 text-xs font-medium text-blue-700">
                          {leave.leave_type}
                        </span>
                      </td>

                      <td className="px-5 py-4 text-xs">
                        <div className="font-medium text-gray-900">
                          {leave.start_date} <span className="text-gray-400">to</span> {leave.end_date}
                        </div>
                        <div className="text-[11px] text-gray-400">
                          Applied: {new Date(leave.applied_at).toLocaleDateString()}
                        </div>
                      </td>

                      <td className="px-5 py-4">
                        <span className="font-semibold text-gray-900">{leave.days_count}</span>
                        <span className="text-xs text-gray-500"> day(s)</span>
                      </td>

                      <td className="px-5 py-4 max-w-xs">
                        <p className="truncate text-xs text-gray-700 font-medium" title={leave.reason}>
                          {leave.reason}
                        </p>
                        {leave.rejection_reason && (
                          <p className="mt-1 truncate text-[11px] text-rose-600" title={leave.rejection_reason}>
                            Reason: {leave.rejection_reason}
                          </p>
                        )}
                      </td>

                      <td className="px-5 py-4">
                        <span
                          className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                            leave.status === "Approved"
                              ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                              : leave.status === "Rejected"
                              ? "bg-rose-50 text-rose-700 border border-rose-200"
                              : "bg-amber-50 text-amber-700 border border-amber-200"
                          }`}
                        >
                          {leave.status === "Approved" && <Check size={12} />}
                          {leave.status === "Rejected" && <X size={12} />}
                          {leave.status === "Pending" && <Clock size={12} />}
                          {leave.status}
                        </span>
                      </td>

                      <td className="px-5 py-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          {/* View details button */}
                          <button
                            onClick={() => setViewModalLeave(leave)}
                            className="rounded-lg border border-gray-200 p-1.5 text-gray-600 hover:bg-gray-100 hover:text-gray-900 transition"
                            title="View Details"
                          >
                            <Eye size={15} />
                          </button>

                          {leave.status === "Pending" ? (
                            <>
                              <button
                                onClick={() => handleApprove(leave)}
                                disabled={processingId === leave.id}
                                className="flex items-center gap-1 rounded-lg bg-emerald-600 px-2.5 py-1.5 text-xs font-medium text-white hover:bg-emerald-700 shadow-sm transition disabled:opacity-50"
                                title="Approve Leave"
                              >
                                <Check size={14} />
                                Approve
                              </button>
                              <button
                                onClick={() => {
                                  setRejectModalLeave(leave);
                                  setRejectReason("");
                                }}
                                disabled={processingId === leave.id}
                                className="flex items-center gap-1 rounded-lg bg-rose-600 px-2.5 py-1.5 text-xs font-medium text-white hover:bg-rose-700 shadow-sm transition disabled:opacity-50"
                                title="Decline Leave"
                              >
                                <X size={14} />
                                Reject
                              </button>
                            </>
                          ) : (
                            <span className="text-xs text-gray-400 font-medium px-2 py-1">
                              Processed
                            </span>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Reject Modal */}
      {rejectModalLeave && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm animate-fadeIn">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
            <div className="flex items-center justify-between pb-3 border-b border-gray-100">
              <div className="flex items-center gap-2 text-rose-600">
                <XCircle size={20} />
                <h3 className="font-semibold text-gray-900">Decline Leave Request</h3>
              </div>
              <button
                onClick={() => setRejectModalLeave(null)}
                className="rounded-lg p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
              >
                <X size={18} />
              </button>
            </div>

            <div className="mt-4 space-y-3">
              <p className="text-xs text-gray-600">
                Are you sure you want to decline the leave request for{" "}
                <span className="font-semibold text-gray-900">{rejectModalLeave.employee?.full_name}</span>?
                This status will immediately update in their employee account.
              </p>

              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">
                  Reason for Rejection (Visible to Employee)
                </label>
                <textarea
                  rows={3}
                  value={rejectReason}
                  onChange={(e) => setRejectReason(e.target.value)}
                  placeholder="e.g. Critical project deadline, insufficient squad coverage, etc."
                  className="w-full rounded-lg border border-gray-200 p-2.5 text-xs outline-none focus:border-rose-500 focus:ring-1 focus:ring-rose-500"
                />
              </div>
            </div>

            <div className="mt-5 flex items-center justify-end gap-2.5 border-t border-gray-100 pt-3">
              <button
                type="button"
                onClick={() => setRejectModalLeave(null)}
                className="rounded-lg border border-gray-200 px-3.5 py-2 text-xs font-medium text-gray-600 hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleRejectSubmit}
                disabled={processingId === rejectModalLeave.id}
                className="flex items-center gap-1.5 rounded-lg bg-rose-600 px-4 py-2 text-xs font-semibold text-white hover:bg-rose-700 shadow-sm transition disabled:opacity-50"
              >
                <X size={14} />
                Confirm Rejection
              </button>
            </div>
          </div>
        </div>
      )}

      {/* View Details Modal */}
      {viewModalLeave && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm animate-fadeIn">
          <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-xl">
            <div className="flex items-center justify-between pb-3 border-b border-gray-100">
              <div className="flex items-center gap-2 text-blue-600">
                <ClipboardList size={20} />
                <h3 className="font-semibold text-gray-900">Leave Application Details</h3>
              </div>
              <button
                onClick={() => setViewModalLeave(null)}
                className="rounded-lg p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
              >
                <X size={18} />
              </button>
            </div>

            <div className="mt-4 space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-3 bg-gray-50 p-3.5 rounded-xl border border-gray-100">
                <div>
                  <span className="text-gray-400 block">Applicant Name</span>
                  <span className="font-semibold text-gray-900 text-sm">{viewModalLeave.employee?.full_name || "Unknown"}</span>
                  <span className="text-gray-500 block">{viewModalLeave.employee?.employee_code}</span>
                </div>
                <div>
                  <span className="text-gray-400 block">Role & Department</span>
                  <span className="font-semibold text-gray-900 capitalize">{viewModalLeave.employee?.role || "Staff"}</span>
                  <span className="text-gray-500 block">{viewModalLeave.employee?.department || "General"}</span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-lg border border-gray-100 p-3">
                  <span className="text-gray-400 block mb-0.5">Leave Type</span>
                  <span className="font-semibold text-blue-700">{viewModalLeave.leave_type}</span>
                </div>
                <div className="rounded-lg border border-gray-100 p-3">
                  <span className="text-gray-400 block mb-0.5">Total Days</span>
                  <span className="font-semibold text-gray-900">{viewModalLeave.days_count} Day(s)</span>
                </div>
              </div>

              <div className="rounded-lg border border-gray-100 p-3">
                <span className="text-gray-400 block mb-0.5">Leave Schedule</span>
                <span className="font-semibold text-gray-900">
                  {viewModalLeave.start_date} to {viewModalLeave.end_date}
                </span>
                <span className="text-gray-400 block mt-0.5">
                  Applied on: {new Date(viewModalLeave.applied_at).toLocaleString()}
                </span>
              </div>

              <div className="rounded-lg border border-gray-100 p-3">
                <span className="text-gray-400 block mb-1">Reason Provided by Employee</span>
                <p className="text-gray-800 leading-relaxed bg-white p-2.5 rounded border border-gray-100">
                  {viewModalLeave.reason}
                </p>
              </div>

              {viewModalLeave.rejection_reason && (
                <div className="rounded-lg border border-rose-100 bg-rose-50/50 p-3">
                  <span className="text-rose-700 font-semibold block mb-1">Rejection Remark</span>
                  <p className="text-rose-900">{viewModalLeave.rejection_reason}</p>
                </div>
              )}

              <div className="flex items-center justify-between pt-2">
                <span className="text-gray-500">Current Status:</span>
                <span
                  className={`inline-flex items-center gap-1 rounded-full px-3 py-1 font-semibold ${
                    viewModalLeave.status === "Approved"
                      ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                      : viewModalLeave.status === "Rejected"
                      ? "bg-rose-50 text-rose-700 border border-rose-200"
                      : "bg-amber-50 text-amber-700 border border-amber-200"
                  }`}
                >
                  {viewModalLeave.status}
                </span>
              </div>
            </div>

            <div className="mt-5 flex items-center justify-end gap-2 border-t border-gray-100 pt-3">
              <button
                type="button"
                onClick={() => setViewModalLeave(null)}
                className="rounded-lg bg-gray-900 px-4 py-2 text-xs font-semibold text-white hover:bg-gray-800"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
