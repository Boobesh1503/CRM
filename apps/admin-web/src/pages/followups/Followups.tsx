import { useState, useEffect, useMemo } from "react";
import {
  CalendarDays,
  Clock,
  CheckCircle2,
  AlertTriangle,
  Search,
  RefreshCw,
  Users,
  Shield,
  GraduationCap,
  Calendar,
  X,
  Phone,
  Video,
  FileText,
  RotateCcw,
  UserCheck,
  Check,
  ArrowRight,
  Filter
} from "lucide-react";
import { supabase } from "../../services/supabase";

interface FollowUpItem {
  id: string;
  lead_id: string | null;
  employee_id: string;
  client_name: string;
  company_name: string | null;
  scheduled_date: string;
  scheduled_time: string;
  type: string;
  priority: "High" | "Medium" | "Normal";
  status: "Pending" | "Overdue" | "Completed";
  notes: string | null;
  rescheduled_from: string | null;
  created_at: string;
  employee?: {
    id: string;
    full_name: string;
    employee_code: string;
    role: string;
    department: string | null;
  } | null;
}

interface EmployeeFollowupStat {
  employeeId: string;
  fullName: string;
  code: string;
  role: string;
  department: string;
  totalFollowups: number;
  pendingCount: number;
  completedCount: number;
  overdueCount: number;
  completionRate: number;
}

export default function Followups() {
  const [followups, setFollowups] = useState<FollowUpItem[]>([]);
  const [employees, setEmployees] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  // Filters
  const [statusTab, setStatusTab] = useState<"All" | "Pending" | "Today" | "Overdue" | "Completed">("All");
  const [categoryFilter, setCategoryFilter] = useState<"All" | "intern" | "team_leader">("All");
  const [search, setSearch] = useState("");
  const [priorityFilter, setPriorityFilter] = useState("All");

  // Drilldown Modal
  const [selectedEmpDrilldown, setSelectedEmpDrilldown] = useState<EmployeeFollowupStat | null>(null);

  const todayStr = new Date().toISOString().split("T")[0];

  // 1. Fetch live followups and employees
  async function loadFollowupData() {
    setLoading(true);
    setError("");

    try {
      // Fetch employees
      const { data: empData } = await supabase
        .from("employees")
        .select("id, full_name, employee_code, role, department")
        .eq("employment_status", "active");

      const emps = empData || [];
      setEmployees(emps);
      const empMap = new Map(emps.map((e) => [e.id, e]));

      // Fetch followups
      const { data: followupsData, error: fErr } = await supabase
        .from("follow_ups")
        .select("*")
        .order("scheduled_date", { ascending: true });

      if (fErr) throw new Error(fErr.message);

      const structured: FollowUpItem[] = (followupsData || []).map((f) => {
        let currentStatus = f.status;
        // Auto-detect overdue if past date and not completed
        if (currentStatus !== "Completed" && f.scheduled_date < todayStr) {
          currentStatus = "Overdue";
        }

        return {
          ...f,
          status: currentStatus,
          employee: empMap.get(f.employee_id) || null,
        };
      });

      setFollowups(structured);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load follow-ups.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadFollowupData();

    // Real-time listener for follow-up activities
    const channel = supabase
      .channel("admin-followups-realtime")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "follow_ups" },
        () => {
          loadFollowupData();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  // 2. Summary Counts
  const counts = useMemo(() => {
    const total = followups.length;
    const pending = followups.filter((f) => f.status === "Pending").length;
    const todayCount = followups.filter(
      (f) => f.status !== "Completed" && f.scheduled_date === todayStr
    ).length;
    const overdue = followups.filter((f) => f.status === "Overdue").length;
    const completed = followups.filter((f) => f.status === "Completed").length;
    return { total, pending, todayCount, overdue, completed };
  }, [followups, todayStr]);

  // 3. Filtered Follow-ups List
  const filteredFollowups = useMemo(() => {
    return followups.filter((f) => {
      // Status Tab
      if (statusTab === "Pending" && f.status !== "Pending") return false;
      if (statusTab === "Today" && (f.status === "Completed" || f.scheduled_date !== todayStr)) return false;
      if (statusTab === "Overdue" && f.status !== "Overdue") return false;
      if (statusTab === "Completed" && f.status !== "Completed") return false;

      // Category filter (Interns vs Team Leaders)
      if (categoryFilter !== "All") {
        if (f.employee?.role !== categoryFilter) return false;
      }

      // Priority filter
      if (priorityFilter !== "All" && f.priority !== priorityFilter) return false;

      // Search Query
      const q = search.trim().toLowerCase();
      if (q) {
        const str = [
          f.client_name,
          f.company_name || "",
          f.employee?.full_name || "",
          f.notes || "",
          f.type,
        ]
          .join(" ")
          .toLowerCase();
        if (!str.includes(q)) return false;
      }

      return true;
    });
  }, [followups, statusTab, categoryFilter, priorityFilter, search, todayStr]);

  // 4. Individual Employee Performance Breakdown
  const employeeStats: EmployeeFollowupStat[] = useMemo(() => {
    return employees
      .filter((emp) => {
        if (categoryFilter === "All") return true;
        return emp.role === categoryFilter;
      })
      .map((emp) => {
        const empFollowups = followups.filter((f) => f.employee_id === emp.id);
        const total = empFollowups.length;
        const pending = empFollowups.filter((f) => f.status === "Pending").length;
        const completed = empFollowups.filter((f) => f.status === "Completed").length;
        const overdue = empFollowups.filter((f) => f.status === "Overdue").length;
        const rate = total > 0 ? Math.round((completed / total) * 100) : 0;

        return {
          employeeId: emp.id,
          fullName: emp.full_name,
          code: emp.employee_code,
          role: emp.role,
          department: emp.department || "Sales",
          totalFollowups: total,
          pendingCount: pending,
          completedCount: completed,
          overdueCount: overdue,
          completionRate: rate,
        };
      })
      .sort((a, b) => b.pendingCount - a.pendingCount || b.totalFollowups - a.totalFollowups);
  }, [employees, followups, categoryFilter]);

  // 5. Toggle Complete Action
  async function toggleComplete(item: FollowUpItem) {
    const nextStatus = item.status === "Completed" ? "Pending" : "Completed";
    setError("");
    setSuccess("");

    try {
      const { error: updateErr } = await supabase
        .from("follow_ups")
        .update({ status: nextStatus })
        .eq("id", item.id);

      if (updateErr) throw new Error(updateErr.message);

      setSuccess(`Follow-up with "${item.client_name}" marked as ${nextStatus}.`);
      await loadFollowupData();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update follow-up status.");
    }
  }

  return (
    <div className="space-y-6 p-6">
      {/* 1. Page Heading */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Follow-up Schedule & Activities</h1>
          <p className="mt-1 text-sm text-gray-500">
            Monitor client follow-ups, employee completion status, and rescheduled appointments in real-time.
          </p>
        </div>

        <button
          onClick={loadFollowupData}
          disabled={loading}
          className="flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-3.5 py-2 text-xs font-semibold text-gray-700 hover:bg-gray-50 shadow-sm transition disabled:opacity-50"
        >
          <RefreshCw size={14} className={loading ? "animate-spin text-blue-600" : ""} />
          <span>Refresh Live</span>
        </button>
      </div>

      {/* Alerts */}
      {success && (
        <div className="rounded-xl bg-green-50 p-3.5 text-xs text-green-700 border border-green-200 font-medium">
          {success}
        </div>
      )}
      {error && (
        <div className="rounded-xl bg-red-50 p-3.5 text-xs text-red-700 border border-red-200 font-medium">
          {error}
        </div>
      )}

      {/* 2. Top Summary Metric Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-5 gap-3">
        <div className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-gray-400">
              TOTAL FOLLOW-UPS
            </span>
            <CalendarDays size={16} className="text-gray-400" />
          </div>
          <p className="mt-2 text-2xl sm:text-3xl font-extrabold text-gray-900">{counts.total}</p>
        </div>

        <div className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-blue-600">
              PENDING
            </span>
            <Clock size={16} className="text-blue-500" />
          </div>
          <p className="mt-2 text-2xl sm:text-3xl font-extrabold text-blue-600">{counts.pending}</p>
        </div>

        <div className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-amber-600">
              DUE TODAY
            </span>
            <Calendar size={16} className="text-amber-500" />
          </div>
          <p className="mt-2 text-2xl sm:text-3xl font-extrabold text-amber-600">{counts.todayCount}</p>
        </div>

        <div className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-rose-600">
              OVERDUE
            </span>
            <AlertTriangle size={16} className="text-rose-500" />
          </div>
          <p className="mt-2 text-2xl sm:text-3xl font-extrabold text-rose-600">{counts.overdue}</p>
        </div>

        <div className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-600">
              COMPLETED
            </span>
            <CheckCircle2 size={16} className="text-emerald-500" />
          </div>
          <p className="mt-2 text-2xl sm:text-3xl font-extrabold text-emerald-600">{counts.completed}</p>
        </div>
      </div>

      {/* 3. Category & Status Filter Bar */}
      <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm space-y-4">
        {/* Sub-Section Switcher (Interns vs Team Leaders) */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-gray-100 pb-3">
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setCategoryFilter("All")}
              className={`flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-bold transition ${
                categoryFilter === "All"
                  ? "bg-[#0f172a] text-white shadow-sm"
                  : "text-gray-600 hover:bg-gray-100 hover:text-gray-900"
              }`}
            >
              <Users size={15} />
              <span>All Staff ({employees.length})</span>
            </button>

            <button
              type="button"
              onClick={() => setCategoryFilter("intern")}
              className={`flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-bold transition ${
                categoryFilter === "intern"
                  ? "bg-violet-700 text-white shadow-sm"
                  : "text-gray-600 hover:bg-gray-100 hover:text-gray-900"
              }`}
            >
              <GraduationCap size={15} />
              <span>Interns Track ({employees.filter((e) => e.role === "intern").length})</span>
            </button>

            <button
              type="button"
              onClick={() => setCategoryFilter("team_leader")}
              className={`flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-bold transition ${
                categoryFilter === "team_leader"
                  ? "bg-amber-600 text-white shadow-sm"
                  : "text-gray-600 hover:bg-gray-100 hover:text-gray-900"
              }`}
            >
              <Shield size={15} />
              <span>Team Leaders ({employees.filter((e) => e.role === "team_leader").length})</span>
            </button>
          </div>

          <div className="flex items-center gap-2">
            <div className="flex items-center gap-2 rounded-xl border border-gray-200 bg-gray-50/50 px-3 py-1.5 text-xs">
              <Search size={14} className="text-gray-400" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search follow-ups..."
                className="w-48 bg-transparent outline-none text-xs"
              />
            </div>
          </div>
        </div>

        {/* Status Tabs (All, Pending, Today, Overdue, Completed) */}
        <div className="flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex flex-wrap items-center gap-1.5">
            {[
              { key: "All", label: "All Activities" },
              { key: "Pending", label: `Pending (${counts.pending})` },
              { key: "Today", label: `Today's Schedule (${counts.todayCount})` },
              { key: "Overdue", label: `Overdue (${counts.overdue})` },
              { key: "Completed", label: `Completed (${counts.completed})` },
            ].map((tab) => (
              <button
                key={tab.key}
                type="button"
                onClick={() => setStatusTab(tab.key as any)}
                className={`rounded-full px-3.5 py-1.5 font-semibold transition ${
                  statusTab === tab.key
                    ? "bg-blue-600 text-white shadow-sm"
                    : "text-gray-600 hover:bg-gray-100 hover:text-gray-900"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-2">
            <span className="text-gray-500 font-medium">Priority</span>
            <select
              value={priorityFilter}
              onChange={(e) => setPriorityFilter(e.target.value)}
              className="rounded-xl border border-gray-200 bg-white px-3 py-1.5 text-xs outline-none"
            >
              <option value="All">All Priorities</option>
              <option value="High">High Priority</option>
              <option value="Medium">Medium</option>
              <option value="Normal">Normal</option>
            </select>
          </div>
        </div>
      </div>

      {/* 4. Individual Employee Follow-up Tracking Table */}
      <div className="rounded-2xl border border-gray-200 bg-white shadow-sm overflow-hidden">
        <div className="border-b border-gray-200 p-5 bg-gray-50/40 flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="text-base font-bold text-gray-900">
              Individual Employee Follow-up Tracker
            </h2>
            <p className="mt-0.5 text-xs text-gray-500">
              Detailed tracking of completed vs pending actions for each employee individually
            </p>
          </div>
          <span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-bold text-blue-700">
            {employeeStats.length} Employees Tracked
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-gray-50 text-[11px] uppercase tracking-wider text-gray-500 border-b border-gray-200">
              <tr>
                <th className="px-5 py-3.5">Employee</th>
                <th className="px-5 py-3.5">Role</th>
                <th className="px-5 py-3.5 text-center">Total Follow-ups</th>
                <th className="px-5 py-3.5 text-center">Pending Actions</th>
                <th className="px-5 py-3.5 text-center">Completed</th>
                <th className="px-5 py-3.5 text-center">Overdue</th>
                <th className="px-5 py-3.5 text-center">Completion Rate</th>
                <th className="px-5 py-3.5 text-center">Actions</th>
              </tr>
            </thead>

            <tbody className="divide-y divide-gray-100">
              {employeeStats.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-5 py-10 text-center text-xs text-gray-400">
                    No employees matching the category.
                  </td>
                </tr>
              ) : (
                employeeStats.map((stat) => (
                  <tr key={stat.employeeId} className="hover:bg-gray-50/60 transition">
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-3">
                        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-100 text-xs font-bold text-blue-700">
                          {stat.fullName.charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <p className="font-bold text-gray-900 text-sm">{stat.fullName}</p>
                          <p className="text-[10px] text-gray-400 font-mono">
                            {stat.code} • {stat.department}
                          </p>
                        </div>
                      </div>
                    </td>

                    <td className="px-5 py-3.5">
                      <span
                        className={`rounded-full px-2.5 py-0.5 text-[10px] font-bold ${
                          stat.role === "intern"
                            ? "bg-violet-50 text-violet-700"
                            : stat.role === "team_leader"
                              ? "bg-amber-50 text-amber-700"
                              : "bg-blue-50 text-blue-700"
                        }`}
                      >
                        {stat.role === "intern"
                          ? "Intern"
                          : stat.role === "team_leader"
                            ? "Team Leader"
                            : "Staff"}
                      </span>
                    </td>

                    <td className="px-5 py-3.5 text-center font-bold text-gray-800">
                      {stat.totalFollowups}
                    </td>

                    <td className="px-5 py-3.5 text-center font-bold text-blue-600">
                      {stat.pendingCount}
                    </td>

                    <td className="px-5 py-3.5 text-center font-bold text-emerald-600">
                      {stat.completedCount}
                    </td>

                    <td className="px-5 py-3.5 text-center font-bold text-rose-600">
                      {stat.overdueCount > 0 ? (
                        <span className="rounded-full bg-rose-50 px-2.5 py-0.5 text-rose-700 font-bold">
                          {stat.overdueCount}
                        </span>
                      ) : (
                        <span className="text-gray-400 font-normal">0</span>
                      )}
                    </td>

                    <td className="px-5 py-3.5 text-center">
                      <div className="inline-flex items-center gap-2">
                        <span className="font-bold text-gray-900">{stat.completionRate}%</span>
                        <div className="w-12 h-1.5 rounded-full bg-gray-100 overflow-hidden">
                          <div
                            className="h-full bg-emerald-500 rounded-full"
                            style={{ width: `${stat.completionRate}%` }}
                          />
                        </div>
                      </div>
                    </td>

                    <td className="px-5 py-3.5 text-center">
                      <button
                        type="button"
                        onClick={() => setSelectedEmpDrilldown(stat)}
                        className="rounded-xl border border-gray-200 bg-white px-3 py-1 text-xs font-semibold text-gray-700 hover:bg-gray-50 transition"
                      >
                        View Details
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* 5. Complete Follow-up Activities & Updates Roster */}
      <div className="rounded-2xl border border-gray-200 bg-white shadow-sm overflow-hidden">
        <div className="border-b border-gray-200 p-5 bg-gray-50/40 flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="text-base font-bold text-gray-900">
              All Follow-up Activities ({filteredFollowups.length})
            </h2>
            <p className="mt-0.5 text-xs text-gray-500">
              Live updates of customer appointments, remarks, and rescheduling history
            </p>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-gray-50 text-[11px] uppercase tracking-wider text-gray-500 border-b border-gray-200">
              <tr>
                <th className="px-5 py-3.5">Client & Company</th>
                <th className="px-5 py-3.5">Assigned Employee</th>
                <th className="px-5 py-3.5">Type & Priority</th>
                <th className="px-5 py-3.5">Scheduled Date & Time</th>
                <th className="px-5 py-3.5">Activity Notes / Remarks</th>
                <th className="px-5 py-3.5">Status</th>
                <th className="px-5 py-3.5 text-center">Actions</th>
              </tr>
            </thead>

            <tbody className="divide-y divide-gray-100">
              {filteredFollowups.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-5 py-12 text-center text-xs text-gray-400">
                    No follow-ups matching current filters.
                  </td>
                </tr>
              ) : (
                filteredFollowups.map((item) => (
                  <tr key={item.id} className="hover:bg-gray-50/60 transition">
                    <td className="px-5 py-3.5">
                      <p className="font-bold text-gray-900 text-sm">{item.client_name}</p>
                      <p className="text-[11px] text-gray-500">{item.company_name || "-"}</p>
                    </td>

                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-2">
                        <span
                          className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                            item.employee?.role === "intern"
                              ? "bg-violet-100 text-violet-800"
                              : item.employee?.role === "team_leader"
                                ? "bg-amber-100 text-amber-800"
                                : "bg-blue-100 text-blue-800"
                          }`}
                        >
                          {item.employee?.role === "intern"
                            ? "Intern"
                            : item.employee?.role === "team_leader"
                              ? "TL"
                              : "Staff"}
                        </span>
                        <span className="font-semibold text-gray-800">
                          {item.employee?.full_name || "Employee"}
                        </span>
                      </div>
                    </td>

                    <td className="px-5 py-3.5 space-y-1">
                      <div className="flex items-center gap-1.5 font-medium text-gray-700">
                        {item.type === "Phone Call" && <Phone size={13} className="text-blue-600" />}
                        {item.type === "Meeting" && <Users size={13} className="text-emerald-600" />}
                        {item.type === "Demo Session" && <Video size={13} className="text-purple-600" />}
                        {item.type === "Contract Review" && <FileText size={13} className="text-amber-600" />}
                        <span>{item.type}</span>
                      </div>
                      <span
                        className={`inline-block rounded-full px-2 py-0.5 text-[10px] font-bold ${
                          item.priority === "High"
                            ? "bg-rose-50 text-rose-700"
                            : item.priority === "Medium"
                              ? "bg-amber-50 text-amber-700"
                              : "bg-blue-50 text-blue-700"
                        }`}
                      >
                        {item.priority} Priority
                      </span>
                    </td>

                    <td className="px-5 py-3.5">
                      <p className="font-bold text-gray-900">{item.scheduled_date}</p>
                      <p className="font-mono text-[11px] text-gray-500">{item.scheduled_time}</p>
                    </td>

                    <td className="px-5 py-3.5 text-gray-600 max-w-xs">
                      <p className="truncate">{item.notes || "-"}</p>
                      {item.rescheduled_from && (
                        <span className="mt-1 flex items-center gap-1 text-[10px] text-amber-700 font-semibold italic">
                          <RotateCcw size={10} /> Rescheduled from {item.rescheduled_from}
                        </span>
                      )}
                    </td>

                    <td className="px-5 py-3.5">
                      <span
                        className={`rounded-full px-2.5 py-0.5 text-[11px] font-bold ${
                          item.status === "Completed"
                            ? "bg-emerald-50 text-emerald-700"
                            : item.status === "Overdue"
                              ? "bg-rose-50 text-rose-700"
                              : "bg-blue-50 text-blue-700"
                        }`}
                      >
                        {item.status}
                      </span>
                    </td>

                    <td className="px-5 py-3.5 text-center">
                      <button
                        type="button"
                        onClick={() => toggleComplete(item)}
                        className={`rounded-xl px-3 py-1.5 text-xs font-semibold transition ${
                          item.status === "Completed"
                            ? "border border-gray-200 text-gray-600 hover:bg-gray-100"
                            : "bg-emerald-600 text-white hover:bg-emerald-700 shadow-sm"
                        }`}
                      >
                        {item.status === "Completed" ? "Re-open" : "Mark Done"}
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* 6. Employee Details Drilldown Modal */}
      {selectedEmpDrilldown && (
        <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-black/40 p-4">
          <div className="my-6 w-full max-w-3xl rounded-2xl bg-white shadow-xl max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between border-b border-gray-200 p-5 shrink-0">
              <div>
                <h3 className="text-lg font-bold text-gray-900">
                  Follow-up Activity: {selectedEmpDrilldown.fullName}
                </h3>
                <p className="mt-0.5 text-xs text-gray-500">
                  {selectedEmpDrilldown.code} • {selectedEmpDrilldown.role.toUpperCase()} • {selectedEmpDrilldown.department}
                </p>
              </div>
              <button
                onClick={() => setSelectedEmpDrilldown(null)}
                className="rounded-lg p-2 text-gray-500 hover:bg-gray-100"
              >
                <X size={20} />
              </button>
            </div>

            <div className="p-6 overflow-y-auto space-y-4">
              <div className="grid grid-cols-4 gap-3 text-center">
                <div className="rounded-xl border border-gray-200 p-3 bg-gray-50">
                  <p className="text-[11px] text-gray-500">Total Follow-ups</p>
                  <p className="text-xl font-bold text-gray-900">{selectedEmpDrilldown.totalFollowups}</p>
                </div>
                <div className="rounded-xl border border-blue-200 p-3 bg-blue-50">
                  <p className="text-[11px] text-blue-700">Pending Actions</p>
                  <p className="text-xl font-bold text-blue-700">{selectedEmpDrilldown.pendingCount}</p>
                </div>
                <div className="rounded-xl border border-emerald-200 p-3 bg-emerald-50">
                  <p className="text-[11px] text-emerald-700">Completed</p>
                  <p className="text-xl font-bold text-emerald-700">{selectedEmpDrilldown.completedCount}</p>
                </div>
                <div className="rounded-xl border border-rose-200 p-3 bg-rose-50">
                  <p className="text-[11px] text-rose-700">Overdue</p>
                  <p className="text-xl font-bold text-rose-700">{selectedEmpDrilldown.overdueCount}</p>
                </div>
              </div>

              <div>
                <h4 className="text-xs font-bold text-gray-900 mb-2">Detailed Follow-up Milestones</h4>
                <div className="max-h-64 overflow-y-auto divide-y divide-gray-100 rounded-xl border border-gray-200 text-xs">
                  {followups.filter((f) => f.employee_id === selectedEmpDrilldown.employeeId).length === 0 ? (
                    <div className="p-8 text-center text-gray-400">No follow-ups recorded for this employee.</div>
                  ) : (
                    followups
                      .filter((f) => f.employee_id === selectedEmpDrilldown.employeeId)
                      .map((f) => (
                        <div key={f.id} className="p-3.5 hover:bg-gray-50 flex items-center justify-between">
                          <div>
                            <div className="flex items-center gap-2">
                              <p className="font-bold text-gray-900">{f.client_name}</p>
                              <span className="text-[10px] text-gray-400">({f.company_name || "Direct"})</span>
                            </div>
                            <p className="text-[11px] text-gray-500 mt-0.5">
                              {f.type} • Scheduled for {f.scheduled_date} at {f.scheduled_time}
                            </p>
                            {f.notes && <p className="text-gray-600 mt-1 italic">"{f.notes}"</p>}
                          </div>
                          <div className="text-right space-y-1">
                            <span
                              className={`inline-block rounded-full px-2.5 py-0.5 text-[10px] font-bold ${
                                f.status === "Completed"
                                  ? "bg-emerald-50 text-emerald-700"
                                  : f.status === "Overdue"
                                    ? "bg-rose-50 text-rose-700"
                                    : "bg-blue-50 text-blue-700"
                              }`}
                            >
                              {f.status}
                            </span>
                          </div>
                        </div>
                      ))
                  )}
                </div>
              </div>
            </div>

            <div className="p-4 border-t border-gray-100 flex justify-end shrink-0">
              <button
                onClick={() => setSelectedEmpDrilldown(null)}
                className="rounded-xl bg-gray-100 px-5 py-2 text-xs font-semibold text-gray-700 hover:bg-gray-200"
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
