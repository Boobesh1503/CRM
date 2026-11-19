import { useEffect, useState, useMemo } from "react";
import { Link } from "react-router-dom";
import {
  Users,
  UserCheck,
  GraduationCap,
  Shield,
  TrendingUp,
  RefreshCw,
  Building2,
  IndianRupee,
  Clock,
  Sparkles,
  CheckCircle2,
  PhoneCall,
  Calendar,
  AlertCircle,
  Bell,
  Search,
  ExternalLink,
  ArrowRight,
  Filter
} from "lucide-react";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  BarChart,
  Bar
} from "recharts";
import { supabase } from "../../services/supabase";
import {
  getAdminNotifications,
  type NotificationItem
} from "../../services/notifications";

interface CheckedInEmployee {
  attendanceId: string;
  employeeId: string;
  fullName: string;
  employeeCode: string;
  role: string;
  department: string;
  checkInTime: string;
  checkOutTime: string | null;
  status: string;
  isOnShift: boolean;
  session: "Morning (9:00 - 10:30)" | "Afternoon (1:30+)";
}

interface LiveStats {
  totalEmployees: number;
  activeEmployees: number;
  internsCount: number;
  leadersCount: number;
  departmentCounts: Array<{ department: string; count: number }>;
  totalCheckedInToday: number;
  internsCheckedIn: number;
  leadersCheckedIn: number;
}

const roleLabels: Record<string, string> = {
  intern: "Intern",
  sales_executive: "Sales Executive",
  team_leader: "Team Leader",
  admin: "Administrator",
};

function formatRelativeTime(dateStr: string) {
  try {
    const date = new Date(dateStr);
    const now = new Date();
    const diffSec = Math.floor((now.getTime() - date.getTime()) / 1000);
    if (diffSec < 60) return "Just now";
    const diffMin = Math.floor(diffSec / 60);
    if (diffMin < 60) return `${diffMin}m ago`;
    const diffHour = Math.floor(diffMin / 60);
    if (diffHour < 24) return `${diffHour}h ago`;
    const diffDays = Math.floor(diffHour / 24);
    if (diffDays < 30) return `${diffDays}d ago`;
    return date.toLocaleDateString();
  } catch {
    return dateStr;
  }
}

export default function Dashboard() {
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<LiveStats>({
    totalEmployees: 0,
    activeEmployees: 0,
    internsCount: 0,
    leadersCount: 0,
    departmentCounts: [],
    totalCheckedInToday: 0,
    internsCheckedIn: 0,
    leadersCheckedIn: 0,
  });

  const [checkedInList, setCheckedInList] = useState<CheckedInEmployee[]>([]);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [attendanceSearch, setAttendanceSearch] = useState("");
  const [attendanceFilter, setAttendanceFilter] = useState<"All" | "intern" | "team_leader">("All");
  const [revenueSummary, setRevenueSummary] = useState({
    totalInvoiced: 0,
    totalPaid: 0,
    pendingDue: 0,
  });

  async function loadDashboardData() {
    setLoading(true);
    const todayStr = new Date().toISOString().split("T")[0];

    try {
      // 1. Fetch Employees
      const { data: employeesData } = await supabase
        .from("employees")
        .select("id, full_name, employee_code, role, department, employment_status, created_at")
        .order("created_at", { ascending: false });

      const employees = employeesData || [];
      const total = employees.length;
      const active = employees.filter((e) => e.employment_status === "active").length;
      const interns = employees.filter((e) => e.role === "intern").length;
      const leaders = employees.filter((e) => e.role === "team_leader").length;

      const deptMap: Record<string, number> = {
        Sales: 0,
        Marketing: 0,
        Operations: 0,
        Support: 0,
        HR: 0,
      };

      employees.forEach((e) => {
        const dept = e.department || "Sales";
        deptMap[dept] = (deptMap[dept] || 0) + 1;
      });

      const deptArray = Object.entries(deptMap).map(([department, count]) => ({
        department,
        count,
      }));

      // 2. Fetch Today's Attendance Records
      const { data: attendanceData } = await supabase
        .from("attendance")
        .select(`
          id,
          employee_id,
          date,
          check_in,
          check_out,
          status,
          working_hours
        `)
        .eq("date", todayStr);

      const empMap = new Map(employees.map((e) => [e.id, e]));

      let checkedInCount = 0;
      let internsPresent = 0;
      let leadersPresent = 0;

      const roster: CheckedInEmployee[] = [];

      if (attendanceData) {
        attendanceData.forEach((att) => {
          const emp = empMap.get(att.employee_id);
          if (!emp) return;

          checkedInCount++;
          if (emp.role === "intern") internsPresent++;
          if (emp.role === "team_leader") leadersPresent++;

          const checkInDate = new Date(att.check_in);
          const checkInHours = checkInDate.getHours();
          const checkInMinutes = checkInDate.getMinutes();

          const timeStr = checkInDate.toLocaleTimeString([], {
            hour: "2-digit",
            minute: "2-digit",
          });

          const isMorning =
            checkInHours < 12 || (checkInHours === 10 && checkInMinutes <= 30);

          roster.push({
            attendanceId: att.id,
            employeeId: emp.id,
            fullName: emp.full_name,
            employeeCode: emp.employee_code,
            role: emp.role,
            department: emp.department || "General",
            checkInTime: timeStr,
            checkOutTime: att.check_out
              ? new Date(att.check_out).toLocaleTimeString([], {
                  hour: "2-digit",
                  minute: "2-digit",
                })
              : null,
            status: att.status,
            isOnShift: !att.check_out,
            session: isMorning ? "Morning (9:00 - 10:30)" : "Afternoon (1:30+)",
          });
        });
      }

      setCheckedInList(roster);

      setStats({
        totalEmployees: total,
        activeEmployees: active,
        internsCount: interns,
        leadersCount: leaders,
        departmentCounts: deptArray,
        totalCheckedInToday: checkedInCount,
        internsCheckedIn: internsPresent,
        leadersCheckedIn: leadersPresent,
      });

      // 3. Fetch Notifications for Admin Feed
      const notifs = await getAdminNotifications(8);
      setNotifications(notifs);

      // 4. Fetch Invoices Summary
      const { data: invoicesData } = await supabase
        .from("invoices")
        .select("total_amount, amount_paid, balance_due, status");

      if (invoicesData && invoicesData.length > 0) {
        const invoiced = invoicesData.reduce((acc, curr) => acc + (Number(curr.total_amount) || 0), 0);
        const paid = invoicesData.reduce((acc, curr) => acc + (Number(curr.amount_paid) || 0), 0);
        const due = invoicesData.reduce((acc, curr) => acc + (Number(curr.balance_due) || 0), 0);
        setRevenueSummary({ totalInvoiced: invoiced, totalPaid: paid, pendingDue: due });
      }
    } catch (err) {
      console.warn("Error loading dashboard data:", err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadDashboardData();

    // Subscribe to live attendance updates
    const attChannel = supabase
      .channel("dashboard-attendance-channel")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "attendance" },
        () => {
          loadDashboardData();
        }
      )
      .subscribe();

    // Subscribe to live notifications
    const notifChannel = supabase
      .channel("dashboard-notif-channel")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "notifications" },
        (payload) => {
          const item = payload.new as NotificationItem;
          if (item.recipient_role === "admin" || item.recipient_role === "all") {
            setNotifications((prev) => [item, ...prev.slice(0, 7)]);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(attChannel);
      supabase.removeChannel(notifChannel);
    };
  }, []);

  // Filtered attendance roster
  const filteredAttendance = useMemo(() => {
    return checkedInList.filter((emp) => {
      const matchesSearch =
        emp.fullName.toLowerCase().includes(attendanceSearch.toLowerCase()) ||
        emp.employeeCode.toLowerCase().includes(attendanceSearch.toLowerCase()) ||
        emp.department.toLowerCase().includes(attendanceSearch.toLowerCase());

      const matchesFilter =
        attendanceFilter === "All" || emp.role === attendanceFilter;

      return matchesSearch && matchesFilter;
    });
  }, [checkedInList, attendanceSearch, attendanceFilter]);

  return (
    <div className="space-y-6 p-4 sm:p-6 max-w-full">
      {/* Top Banner & Refresh */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Dashboard Overview</h1>
          <p className="mt-1 text-sm text-gray-500">
            Real-time business intelligence, live employee check-in monitoring, and notification alerts.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={loadDashboardData}
            disabled={loading}
            className="flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 shadow-sm transition disabled:opacity-50"
            title="Refresh live metrics"
          >
            <RefreshCw size={15} className={loading ? "animate-spin text-blue-600" : ""} />
            <span>{loading ? "Refreshing..." : "Refresh Live"}</span>
          </button>
          <div className="rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm text-gray-600 shadow-sm">
            FY 2026
          </div>
        </div>
      </div>

      {/* Workforce Metric Cards */}
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium text-gray-500">Total Employees</p>
            <div className="rounded-lg bg-blue-50 p-2 text-blue-600">
              <Users size={20} />
            </div>
          </div>
          <div className="mt-4 flex items-end justify-between">
            <h2 className="text-3xl font-bold text-gray-900">
              {loading ? "..." : stats.totalEmployees}
            </h2>
            <span className="flex items-center gap-1 text-xs font-semibold text-emerald-600">
              <TrendingUp size={14} /> Live
            </span>
          </div>
          <p className="mt-2 text-xs text-gray-400">Total registered employee profiles</p>
        </div>

        <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium text-gray-500">Today's Attendance</p>
            <div className="rounded-lg bg-emerald-50 p-2 text-emerald-600">
              <UserCheck size={20} />
            </div>
          </div>
          <div className="mt-4 flex items-end justify-between">
            <h2 className="text-3xl font-bold text-gray-900">
              {loading ? "..." : stats.totalCheckedInToday}
            </h2>
            <span className="flex items-center gap-1 text-xs font-semibold text-emerald-600">
              {stats.totalEmployees > 0
                ? `${Math.round((stats.totalCheckedInToday / stats.totalEmployees) * 100)}% present`
                : "0% present"}
            </span>
          </div>
          <p className="mt-2 text-xs text-gray-400">Employees checked in today</p>
        </div>

        <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium text-gray-500">Interns Present</p>
            <div className="rounded-lg bg-violet-50 p-2 text-violet-600">
              <GraduationCap size={20} />
            </div>
          </div>
          <div className="mt-4 flex items-end justify-between">
            <h2 className="text-3xl font-bold text-gray-900">
              {loading ? "..." : `${stats.internsCheckedIn} / ${stats.internsCount}`}
            </h2>
            <span className="flex items-center gap-1 text-xs font-semibold text-violet-600">
              Intern Roster
            </span>
          </div>
          <p className="mt-2 text-xs text-gray-400">Checked-in interns vs total</p>
        </div>

        <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium text-gray-500">Team Leaders Present</p>
            <div className="rounded-lg bg-amber-50 p-2 text-amber-600">
              <Shield size={20} />
            </div>
          </div>
          <div className="mt-4 flex items-end justify-between">
            <h2 className="text-3xl font-bold text-gray-900">
              {loading ? "..." : `${stats.leadersCheckedIn} / ${stats.leadersCount}`}
            </h2>
            <span className="flex items-center gap-1 text-xs font-semibold text-amber-600">
              TL Roster
            </span>
          </div>
          <p className="mt-2 text-xs text-gray-400">Checked-in TLs vs total</p>
        </div>
      </div>

      {/* Real-time Employee Check-in & Attendance Tracker */}
      <div className="rounded-xl border border-gray-200 bg-white shadow-sm overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-gray-200 p-5 bg-gray-50/40">
          <div>
            <div className="flex items-center gap-2">
              <span className="flex h-3 w-3 relative">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500"></span>
              </span>
              <h2 className="text-base font-bold text-gray-900">
                Today's Checked-in Employees
              </h2>
            </div>
            <p className="mt-0.5 text-xs text-gray-500">
              Live tracking of employees who have punched in for today's morning and afternoon sessions
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-xs">
              <Search size={14} className="text-gray-400" />
              <input
                type="text"
                value={attendanceSearch}
                onChange={(e) => setAttendanceSearch(e.target.value)}
                placeholder="Search checked-in..."
                className="w-36 outline-none text-xs"
              />
            </div>

            <div className="flex items-center rounded-lg border border-gray-200 bg-white p-0.5 text-xs">
              <button
                type="button"
                onClick={() => setAttendanceFilter("All")}
                className={`rounded-md px-2.5 py-1 font-medium transition ${
                  attendanceFilter === "All"
                    ? "bg-blue-600 text-white"
                    : "text-gray-600 hover:text-gray-900"
                }`}
              >
                All ({checkedInList.length})
              </button>
              <button
                type="button"
                onClick={() => setAttendanceFilter("intern")}
                className={`rounded-md px-2.5 py-1 font-medium transition ${
                  attendanceFilter === "intern"
                    ? "bg-blue-600 text-white"
                    : "text-gray-600 hover:text-gray-900"
                }`}
              >
                Interns ({stats.internsCheckedIn})
              </button>
              <button
                type="button"
                onClick={() => setAttendanceFilter("team_leader")}
                className={`rounded-md px-2.5 py-1 font-medium transition ${
                  attendanceFilter === "team_leader"
                    ? "bg-blue-600 text-white"
                    : "text-gray-600 hover:text-gray-900"
                }`}
              >
                Team Leaders ({stats.leadersCheckedIn})
              </button>
            </div>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-gray-50 text-xs uppercase text-gray-500">
              <tr>
                <th className="px-5 py-3.5">Employee</th>
                <th className="px-5 py-3.5">Code</th>
                <th className="px-5 py-3.5">Category</th>
                <th className="px-5 py-3.5">Department</th>
                <th className="px-5 py-3.5">Check-in Time</th>
                <th className="px-5 py-3.5">Session Window</th>
                <th className="px-5 py-3.5">Shift Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filteredAttendance.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-5 py-10 text-center text-xs text-gray-500">
                    {attendanceSearch || attendanceFilter !== "All"
                      ? "No checked-in employees match the current filter."
                      : "No employees have checked in yet today. As employees punch in, their records will appear here live."}
                  </td>
                </tr>
              ) : (
                filteredAttendance.map((emp) => (
                  <tr key={emp.attendanceId} className="hover:bg-gray-50/60 transition">
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-3">
                        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-100 text-xs font-bold text-blue-700">
                          {emp.fullName.charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <p className="font-medium text-gray-900 text-sm">{emp.fullName}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-5 py-3.5 text-xs text-gray-600 font-mono">
                      {emp.employeeCode}
                    </td>
                    <td className="px-5 py-3.5">
                      <span
                        className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                          emp.role === "intern"
                            ? "bg-violet-50 text-violet-700"
                            : emp.role === "team_leader"
                              ? "bg-amber-50 text-amber-700"
                              : "bg-blue-50 text-blue-700"
                        }`}
                      >
                        {roleLabels[emp.role] ?? emp.role}
                      </span>
                    </td>
                    <td className="px-5 py-3.5 text-xs text-gray-600">
                      {emp.department}
                    </td>
                    <td className="px-5 py-3.5 text-xs font-medium text-gray-800">
                      {emp.checkInTime}
                    </td>
                    <td className="px-5 py-3.5 text-xs text-gray-600">
                      {emp.session}
                    </td>
                    <td className="px-5 py-3.5">
                      {emp.isOnShift ? (
                        <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-semibold text-emerald-700">
                          <span className="h-1.5 w-1.5 rounded-full bg-emerald-600 animate-pulse" />
                          Currently On Shift
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-medium text-gray-600">
                          Checked Out ({emp.checkOutTime || "-"})
                        </span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Middle Row: Live Feed & Department Breakdown */}
      <div className="grid grid-cols-1 gap-5 xl:grid-cols-3">
        {/* Real-time Notifications & Employee Activity Feed */}
        <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm xl:col-span-2">
          <div className="mb-4 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="rounded-lg bg-blue-50 p-2 text-blue-600">
                <Bell size={18} />
              </div>
              <div>
                <h3 className="font-semibold text-gray-900">Admin Notification Center</h3>
                <p className="text-xs text-gray-500">Live stream of employee lead progress, calls, and attendance</p>
              </div>
            </div>
            <span className="flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700">
              <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
              Live WebSocket
            </span>
          </div>

          <div className="space-y-3 max-h-80 overflow-y-auto">
            {notifications.length === 0 ? (
              <div className="py-12 text-center text-xs text-gray-400">
                No recent activity logged yet. When employees update leads, submit leave requests, or log attendance, alerts appear here automatically.
              </div>
            ) : (
              notifications.map((item) => (
                <div
                  key={item.id}
                  className="flex items-start gap-3 p-3 rounded-lg border border-gray-100 bg-gray-50/50 hover:bg-gray-100/60 transition"
                >
                  <div className="mt-0.5 shrink-0 rounded-lg p-2 bg-blue-100 text-blue-600">
                    {item.type === "lead_assigned" && <CheckCircle2 size={15} />}
                    {item.type === "call" && <PhoneCall size={15} />}
                    {item.type === "attendance" && <Clock size={15} />}
                    {item.type === "leave" && <Calendar size={15} />}
                    {item.type === "status_update" && <AlertCircle size={15} />}
                    {item.type === "info" && <Sparkles size={15} />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold text-gray-900">{item.title}</p>
                    <p className="mt-0.5 text-xs text-gray-600">{item.message}</p>
                    <span className="mt-1 block text-[10px] text-gray-400">
                      {formatRelativeTime(item.created_at)}
                    </span>
                  </div>
                  {item.link && (
                    <Link
                      to={item.link}
                      className="shrink-0 text-xs font-medium text-blue-600 hover:text-blue-800 flex items-center gap-1"
                    >
                      View <ArrowRight size={12} />
                    </Link>
                  )}
                </div>
              ))
            )}
          </div>
        </div>

        {/* Department Workforce */}
        <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-semibold text-gray-900">Department Workforce</h3>
              <p className="mt-1 text-xs text-gray-500">Employee headcount by department</p>
            </div>
            <Building2 className="text-blue-600" size={18} />
          </div>
          <div className="mt-5 h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={stats.departmentCounts} layout="vertical" barSize={16}>
                <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                <XAxis type="number" allowDecimals={false} />
                <YAxis type="category" dataKey="department" width={80} tick={{ fontSize: 11 }} />
                <Tooltip />
                <Bar dataKey="count" fill="#2563eb" radius={[0, 4, 4, 0]} name="Employees" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  );
}
