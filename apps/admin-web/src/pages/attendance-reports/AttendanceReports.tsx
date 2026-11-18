import { useState, useEffect, useMemo } from "react";
import {
  CalendarCheck,
  Calendar,
  Clock,
  User,
  Users,
  Search,
  CheckCircle2,
  XCircle,
  AlertCircle,
  RefreshCw,
  Eye,
  GraduationCap,
  Shield,
  Download,
  Filter,
  Check,
  X
} from "lucide-react";
import { supabase } from "../../services/supabase";

export interface AttendanceRecord {
  id: string;
  employee_id: string;
  date: string;
  check_in: string;
  check_out?: string | null;
  working_hours?: number | null;
  status: "present" | "half_day" | "late" | "absent";
  notes?: string | null;
}

export interface EmployeeAttendanceSummary {
  employeeId: string;
  name: string;
  code: string;
  role: string;
  department: string;
  totalWorkingDays: number;
  daysPresent: number;
  halfDays: number;
  leaveDays: number;
  attendanceRate: number;
  todayStatus: "Checked In" | "Checked Out" | "Absent" | "On Leave";
  todayCheckInTime?: string;
  history: AttendanceRecord[];
}

export default function AttendanceReports() {
  const [employees, setEmployees] = useState<any[]>([]);
  const [attendanceLogs, setAttendanceLogs] = useState<AttendanceRecord[]>([]);
  const [leaveLogs, setLeaveLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [categoryFilter, setCategoryFilter] = useState<"all" | "intern" | "team_leader">("all");
  const [search, setSearch] = useState("");
  const [selectedMonth, setSelectedMonth] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  });

  // Selected Employee History Modal
  const [selectedEmployeeForModal, setSelectedEmployeeForModal] = useState<EmployeeAttendanceSummary | null>(null);

  async function loadAttendanceData() {
    setLoading(true);
    try {
      const [empsRes, attRes, leavesRes] = await Promise.all([
        supabase.from("employees").select("*").eq("employment_status", "active").order("full_name"),
        supabase.from("attendance").select("*").order("date", { ascending: false }),
        supabase.from("leave_requests").select("*").eq("status", "Approved"),
      ]);

      setEmployees(empsRes.data || []);
      setAttendanceLogs((attRes.data || []) as AttendanceRecord[]);
      setLeaveLogs(leavesRes.data || []);
    } catch (err) {
      console.warn("Failed to load attendance reports:", err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadAttendanceData();
  }, []);

  const todayStr = useMemo(() => new Date().toISOString().split("T")[0], []);

  // Compute month's working days (Mon-Fri or working days in month up to today or end of month)
  const totalMonthWorkingDays = useMemo(() => {
    const [year, month] = selectedMonth.split("-").map((n) => parseInt(n, 10));
    const now = new Date();
    const isCurrentMonth = now.getFullYear() === year && now.getMonth() + 1 === month;
    const maxDay = isCurrentMonth ? now.getDate() : new Date(year, month, 0).getDate();

    let count = 0;
    for (let day = 1; day <= maxDay; day++) {
      const dayOfWeek = new Date(year, month - 1, day).getDay();
      if (dayOfWeek !== 0 && dayOfWeek !== 6) {
        // Exclude Saturday and Sunday
        count++;
      }
    }
    return Math.max(1, count);
  }, [selectedMonth]);

  // Aggregate Attendance Summary for each Employee
  const employeeSummaries: EmployeeAttendanceSummary[] = useMemo(() => {
    return employees.map((emp) => {
      // Filter logs for selected month
      const empLogs = attendanceLogs.filter(
        (a) => a.employee_id === emp.id && a.date.startsWith(selectedMonth)
      );

      const presentLogs = empLogs.filter((a) => a.status === "present" || a.status === "late");
      const halfDayLogs = empLogs.filter((a) => a.status === "half_day");

      // Filter approved leaves for selected month
      const empLeaves = leaveLogs.filter(
        (l) => l.employee_id === emp.id && (l.start_date.startsWith(selectedMonth) || l.end_date.startsWith(selectedMonth))
      );
      const leaveDaysCount = empLeaves.reduce((sum, l) => sum + (Number(l.days_count) || 1), 0);

      const daysPresent = presentLogs.length;
      const halfDays = halfDayLogs.length;

      // Attendance rate formula: (daysPresent + 0.5 * halfDays) / totalMonthWorkingDays
      const effectiveDays = daysPresent + halfDays * 0.5;
      const attendanceRate = Math.min(100, Math.round((effectiveDays / totalMonthWorkingDays) * 100));

      // Today's Status
      const todayRecord = attendanceLogs.find(
        (a) => a.employee_id === emp.id && a.date === todayStr
      );

      const isOnLeaveToday = leaveLogs.some(
        (l) => l.employee_id === emp.id && l.start_date <= todayStr && l.end_date >= todayStr
      );

      let todayStatus: EmployeeAttendanceSummary["todayStatus"] = "Absent";
      let todayCheckInTime: string | undefined;

      if (isOnLeaveToday) {
        todayStatus = "On Leave";
      } else if (todayRecord) {
        if (todayRecord.check_out) {
          todayStatus = "Checked Out";
        } else {
          todayStatus = "Checked In";
        }
        todayCheckInTime = new Date(todayRecord.check_in).toLocaleTimeString([], {
          hour: "2-digit",
          minute: "2-digit",
        });
      }

      return {
        employeeId: emp.id,
        name: emp.full_name,
        code: emp.employee_code,
        role: emp.role,
        department: emp.department || "Sales",
        totalWorkingDays: totalMonthWorkingDays,
        daysPresent,
        halfDays,
        leaveDays: leaveDaysCount,
        attendanceRate,
        todayStatus,
        todayCheckInTime,
        history: empLogs,
      };
    });
  }, [employees, attendanceLogs, leaveLogs, selectedMonth, totalMonthWorkingDays, todayStr]);

  // Filter based on Category and Search
  const filteredSummaries = useMemo(() => {
    return employeeSummaries.filter((s) => {
      const q = search.toLowerCase();
      const matchesSearch =
        !q ||
        s.name.toLowerCase().includes(q) ||
        s.code.toLowerCase().includes(q) ||
        s.department.toLowerCase().includes(q);

      const role = s.role.toLowerCase();
      let matchesCat = true;
      if (categoryFilter === "intern") {
        matchesCat = role.includes("intern");
      } else if (categoryFilter === "team_leader") {
        matchesCat = role.includes("leader") || role.includes("tl");
      }

      return matchesSearch && matchesCat;
    });
  }, [employeeSummaries, search, categoryFilter]);

  // Overall Attendance KPI
  const internSummaries = employeeSummaries.filter((s) => s.role.toLowerCase().includes("intern"));
  const tlSummaries = employeeSummaries.filter((s) => s.role.toLowerCase().includes("leader") || s.role.toLowerCase().includes("tl"));

  const avgAttendanceRate =
    filteredSummaries.length > 0
      ? Math.round(filteredSummaries.reduce((acc, s) => acc + s.attendanceRate, 0) / filteredSummaries.length)
      : 0;

  const internsPresentToday = internSummaries.filter(
    (s) => s.todayStatus === "Checked In" || s.todayStatus === "Checked Out"
  ).length;

  const tlsPresentToday = tlSummaries.filter(
    (s) => s.todayStatus === "Checked In" || s.todayStatus === "Checked Out"
  ).length;

  // Export CSV
  function handleExportCSV() {
    const rows = [
      ["Employee Name", "Employee ID", "Role", "Department", "Month", "Working Days", "Days Present", "Half Days", "Leave Days", "Attendance Rate %", "Today Status"],
      ...filteredSummaries.map((s) => [
        `"${s.name}"`,
        s.code,
        s.role,
        s.department,
        selectedMonth,
        s.totalWorkingDays,
        s.daysPresent,
        s.halfDays,
        s.leaveDays,
        `${s.attendanceRate}%`,
        s.todayStatus,
      ]),
    ];

    const csvContent = "data:text/csv;charset=utf-8," + rows.map((e) => e.join(",")).join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `Attendance_Report_${selectedMonth}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Attendance Reports & Workforce Logs</h1>
          <p className="mt-1 text-sm text-gray-500">
            Monitor working days, present shifts, half-days, leave records, and individual attendance history for Interns and Team Leaders.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          {/* Month Selector */}
          <div className="flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3 py-2 text-xs text-gray-700 shadow-sm">
            <Calendar size={14} className="text-gray-400" />
            <input
              type="month"
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value)}
              className="bg-transparent font-medium outline-none cursor-pointer"
            />
          </div>

          <button
            onClick={loadAttendanceData}
            disabled={loading}
            className="flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3.5 py-2 text-xs font-semibold text-gray-700 hover:bg-gray-50 shadow-sm transition"
          >
            <RefreshCw size={14} className={loading ? "animate-spin text-blue-600" : ""} />
            Refresh
          </button>

          <button
            onClick={handleExportCSV}
            className="flex items-center gap-1.5 rounded-lg bg-blue-600 px-4 py-2 text-xs font-semibold text-white hover:bg-blue-700 shadow-sm transition"
          >
            <Download size={14} />
            Export CSV
          </button>
        </div>
      </div>

      {/* 4 Attendance Summary KPI Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-4">
        <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <p className="text-xs font-medium text-gray-500">Monthly Working Days</p>
            <div className="rounded-lg bg-blue-50 p-2 text-blue-600">
              <CalendarCheck size={18} />
            </div>
          </div>
          <p className="mt-3 text-3xl font-bold text-gray-900">{totalMonthWorkingDays}</p>
          <span className="mt-1 block text-xs text-gray-400">Total operational days in {selectedMonth}</span>
        </div>

        <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <p className="text-xs font-medium text-gray-500">Average Attendance Rate</p>
            <div className="rounded-lg bg-emerald-50 p-2 text-emerald-600">
              <CheckCircle2 size={18} />
            </div>
          </div>
          <p className="mt-3 text-3xl font-bold text-emerald-600">{avgAttendanceRate}%</p>
          <span className="mt-1 block text-xs text-emerald-700 font-medium">Across active personnel</span>
        </div>

        <div className="rounded-xl border border-purple-200 bg-purple-50/50 p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <p className="text-xs font-medium text-purple-900">Interns Present Today</p>
            <div className="rounded-lg bg-purple-100 p-2 text-purple-700">
              <GraduationCap size={18} />
            </div>
          </div>
          <p className="mt-3 text-3xl font-bold text-purple-700">
            {internsPresentToday} <span className="text-sm font-normal text-purple-900">/ {internSummaries.length}</span>
          </p>
          <span className="mt-1 block text-xs text-purple-900 font-medium">Intern attendance status</span>
        </div>

        <div className="rounded-xl border border-amber-200 bg-amber-50/50 p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <p className="text-xs font-medium text-amber-900">Team Leaders On Shift</p>
            <div className="rounded-lg bg-amber-100 p-2 text-amber-700">
              <Shield size={18} />
            </div>
          </div>
          <p className="mt-3 text-3xl font-bold text-amber-600">
            {tlsPresentToday} <span className="text-sm font-normal text-amber-800">/ {tlSummaries.length}</span>
          </p>
          <span className="mt-1 block text-xs text-amber-700 font-medium">Supervisory squad active</span>
        </div>
      </div>

      {/* Attendance Roster Table Container */}
      <div className="rounded-xl border border-gray-200 bg-white shadow-sm overflow-hidden">
        {/* Category Sub-sections: Interns vs Team Leaders */}
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
              All Staff ({employeeSummaries.length})
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
              Interns Sub-Section ({internSummaries.length})
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
              Team Leaders (TL) Sub-Section ({tlSummaries.length})
            </button>
          </div>

          <div className="flex items-center gap-2">
            <div className="flex items-center gap-2 rounded-lg border border-gray-200 px-3 py-1.5 bg-white">
              <Search size={14} className="text-gray-400" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search employee..."
                className="w-40 text-xs outline-none"
              />
            </div>
          </div>
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-gray-600">
            <thead className="bg-gray-50 text-xs font-semibold text-gray-500 uppercase tracking-wider">
              <tr>
                <th className="px-5 py-3.5">Employee</th>
                <th className="px-5 py-3.5">Category</th>
                <th className="px-5 py-3.5 text-center">Working Days</th>
                <th className="px-5 py-3.5 text-center">Days Present</th>
                <th className="px-5 py-3.5 text-center">Half-Days</th>
                <th className="px-5 py-3.5 text-center">Leave Days</th>
                <th className="px-5 py-3.5 text-center">Attendance %</th>
                <th className="px-5 py-3.5">Today Status</th>
                <th className="px-5 py-3.5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading ? (
                <tr>
                  <td colSpan={9} className="py-12 text-center text-sm text-gray-500">
                    <RefreshCw size={24} className="mx-auto mb-2 animate-spin text-blue-600" />
                    Calculating attendance statistics...
                  </td>
                </tr>
              ) : filteredSummaries.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-12 text-center text-xs text-gray-400">
                    No workforce members match your search and filter criteria.
                  </td>
                </tr>
              ) : (
                filteredSummaries.map((s) => {
                  const isIntern = s.role.toLowerCase().includes("intern");
                  const isTL = s.role.toLowerCase().includes("leader") || s.role.toLowerCase().includes("tl");

                  return (
                    <tr key={s.employeeId} className="hover:bg-gray-50/70 transition">
                      <td className="px-5 py-4">
                        <div>
                          <p className="font-semibold text-gray-900">{s.name}</p>
                          <p className="text-xs text-gray-500">{s.code} • {s.department}</p>
                        </div>
                      </td>

                      <td className="px-5 py-4">
                        {isIntern ? (
                          <span className="inline-flex items-center gap-1 rounded-full bg-purple-50 px-2.5 py-0.5 text-xs font-semibold text-purple-700 border border-purple-200">
                            <GraduationCap size={12} /> Intern
                          </span>
                        ) : isTL ? (
                          <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2.5 py-0.5 text-xs font-semibold text-amber-700 border border-amber-200">
                            <Shield size={12} /> Team Leader
                          </span>
                        ) : (
                          <span className="inline-flex items-center rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-medium text-gray-600">
                            {s.role}
                          </span>
                        )}
                      </td>

                      <td className="px-5 py-4 text-center font-medium text-gray-800">
                        {s.totalWorkingDays}
                      </td>

                      <td className="px-5 py-4 text-center font-bold text-emerald-600">
                        {s.daysPresent}
                      </td>

                      <td className="px-5 py-4 text-center font-semibold text-amber-600">
                        {s.halfDays}
                      </td>

                      <td className="px-5 py-4 text-center font-semibold text-rose-600">
                        {s.leaveDays}
                      </td>

                      <td className="px-5 py-4 text-center">
                        <div className="flex items-center justify-center gap-1.5">
                          <span className="font-bold text-xs text-gray-900">{s.attendanceRate}%</span>
                          <div className="h-1.5 w-12 rounded-full bg-gray-100 overflow-hidden">
                            <div
                              className={`h-full rounded-full ${
                                s.attendanceRate >= 80
                                  ? "bg-emerald-500"
                                  : s.attendanceRate >= 60
                                  ? "bg-blue-500"
                                  : "bg-rose-500"
                              }`}
                              style={{ width: `${s.attendanceRate}%` }}
                            />
                          </div>
                        </div>
                      </td>

                      <td className="px-5 py-4">
                        <span
                          className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                            s.todayStatus === "Checked In"
                              ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                              : s.todayStatus === "Checked Out"
                              ? "bg-blue-50 text-blue-700 border border-blue-200"
                              : s.todayStatus === "On Leave"
                              ? "bg-purple-50 text-purple-700 border border-purple-200"
                              : "bg-gray-100 text-gray-500 border border-gray-200"
                          }`}
                        >
                          {s.todayStatus === "Checked In" && <Clock size={12} />}
                          {s.todayStatus}
                          {s.todayCheckInTime && ` (${s.todayCheckInTime})`}
                        </span>
                      </td>

                      <td className="px-5 py-4 text-right">
                        <button
                          onClick={() => setSelectedEmployeeForModal(s)}
                          className="flex items-center gap-1 ml-auto rounded-lg border border-gray-200 px-2.5 py-1.5 text-xs font-semibold text-gray-700 hover:bg-gray-100 hover:text-gray-900 transition"
                          title="View Attendance History"
                        >
                          <Eye size={13} />
                          History
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Individual Employee Attendance History Modal */}
      {selectedEmployeeForModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm animate-fadeIn">
          <div className="w-full max-w-2xl rounded-2xl bg-white p-6 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-gray-100">
              <div className="flex items-center gap-2">
                <CalendarCheck size={20} className="text-blue-600" />
                <div>
                  <h3 className="font-bold text-gray-900">
                    Attendance History — {selectedEmployeeForModal.name}
                  </h3>
                  <p className="text-xs text-gray-500">
                    {selectedEmployeeForModal.code} • {selectedEmployeeForModal.role} • {selectedMonth}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setSelectedEmployeeForModal(null)}
                className="rounded-lg p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
              >
                <X size={18} />
              </button>
            </div>

            {/* Quick Metrics */}
            <div className="grid grid-cols-4 gap-3 bg-gray-50 p-3.5 rounded-xl text-center text-xs border border-gray-100">
              <div>
                <span className="text-gray-400 block">Working Days</span>
                <span className="font-bold text-gray-900 text-base">{selectedEmployeeForModal.totalWorkingDays}</span>
              </div>
              <div>
                <span className="text-gray-400 block">Days Present</span>
                <span className="font-bold text-emerald-600 text-base">{selectedEmployeeForModal.daysPresent}</span>
              </div>
              <div>
                <span className="text-gray-400 block">Half-Days</span>
                <span className="font-bold text-amber-600 text-base">{selectedEmployeeForModal.halfDays}</span>
              </div>
              <div>
                <span className="text-gray-400 block">Leaves Taken</span>
                <span className="font-bold text-rose-600 text-base">{selectedEmployeeForModal.leaveDays}</span>
              </div>
            </div>

            {/* Daily History Table */}
            <div className="rounded-xl border border-gray-200 overflow-hidden text-xs">
              <table className="w-full text-left">
                <thead className="bg-gray-50 text-gray-500 uppercase tracking-wider font-semibold">
                  <tr>
                    <th className="p-3">Date</th>
                    <th className="p-3">Check-In</th>
                    <th className="p-3">Check-Out</th>
                    <th className="p-3">Hours</th>
                    <th className="p-3 text-right">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {selectedEmployeeForModal.history.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="py-8 text-center text-gray-400">
                        No recorded punch-in timestamps for this employee in {selectedMonth}.
                      </td>
                    </tr>
                  ) : (
                    selectedEmployeeForModal.history.map((rec) => (
                      <tr key={rec.id} className="hover:bg-gray-50/50">
                        <td className="p-3 font-medium text-gray-800">{rec.date}</td>
                        <td className="p-3 text-gray-600">
                          {new Date(rec.check_in).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                        </td>
                        <td className="p-3 text-gray-600">
                          {rec.check_out
                            ? new Date(rec.check_out).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
                            : "—"}
                        </td>
                        <td className="p-3 font-semibold text-gray-700">
                          {rec.working_hours ? `${rec.working_hours} hrs` : "—"}
                        </td>
                        <td className="p-3 text-right">
                          <span
                            className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${
                              rec.status === "present"
                                ? "bg-emerald-50 text-emerald-700"
                                : rec.status === "half_day"
                                ? "bg-amber-50 text-amber-700"
                                : "bg-rose-50 text-rose-700"
                            }`}
                          >
                            {rec.status}
                          </span>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            <div className="flex justify-end pt-2">
              <button
                type="button"
                onClick={() => setSelectedEmployeeForModal(null)}
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

