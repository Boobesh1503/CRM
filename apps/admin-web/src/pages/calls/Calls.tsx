import { useState, useEffect, useMemo } from "react";
import {
  Phone,
  PhoneIncoming,
  PhoneOutgoing,
  Clock,
  Search,
  RefreshCw,
  Users,
  Shield,
  GraduationCap,
  Calendar,
  CheckCircle2,
  AlertCircle,
  TrendingUp,
  UserCheck,
  ChevronRight,
  X,
  Copy,
  Check,
  AlertTriangle,
  ArrowUpRight,
  Filter
} from "lucide-react";
import { supabase } from "../../services/supabase";

interface CallItem {
  id: string;
  employee_id: string;
  lead_id: string | null;
  client_name: string;
  phone: string;
  call_type: "Outbound" | "Inbound";
  duration_seconds: number;
  outcome: string;
  notes: string | null;
  follow_up_needed: boolean;
  follow_up_date: string | null;
  created_at: string;
  employee?: {
    id: string;
    full_name: string;
    employee_code: string;
    role: string;
    department: string | null;
  } | null;
  lead?: {
    id: string;
    name: string;
    company: string | null;
    stage: string;
  } | null;
}

interface EmployeeCallStat {
  employeeId: string;
  fullName: string;
  code: string;
  role: string;
  department: string;
  totalCalls: number;
  todayCalls: number;
  outboundCalls: number;
  inboundCalls: number;
  answeredCalls: number;
  avgDurationMinutes: number;
  followupsCount: number;
  calledToday: boolean;
}

const DATE_RANGES = [
  { key: "1D", label: "1 Day", days: 1 },
  { key: "1W", label: "1 Week", days: 7 },
  { key: "1M", label: "1 Month", days: 30 },
  { key: "3M", label: "3 Months", days: 90 },
  { key: "7M", label: "7 Months", days: 210 },
  { key: "1Y", label: "1 Year", days: 365 },
];

const CALLS_SQL_SCRIPT = `-- Run in Supabase SQL Editor if table is pending:
CREATE TABLE IF NOT EXISTS public.calls (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id uuid NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  lead_id uuid REFERENCES public.leads(id) ON DELETE SET NULL,
  client_name text NOT NULL,
  phone text NOT NULL,
  call_type text NOT NULL DEFAULT 'Outbound' CHECK (call_type IN ('Outbound', 'Inbound')),
  duration_seconds integer DEFAULT 0,
  outcome text NOT NULL DEFAULT 'Answered' CHECK (outcome IN ('Answered', 'Busy', 'No Answer', 'Wrong Number', 'Voicemail', 'Callback Requested')),
  notes text,
  follow_up_needed boolean DEFAULT false,
  follow_up_date date,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.calls ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins have full access to calls" ON public.calls FOR ALL USING (public.is_admin());
CREATE POLICY "Employees can view own calls" ON public.calls FOR SELECT USING (employee_id = public.current_employee_id());
CREATE POLICY "Employees can log calls" ON public.calls FOR INSERT WITH CHECK (employee_id = public.current_employee_id());
`;

export default function Calls() {
  const [calls, setCalls] = useState<CallItem[]>([]);
  const [employees, setEmployees] = useState<any[]>([]);
  const [followups, setFollowups] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Filters
  const [selectedRange, setSelectedRange] = useState("1M");
  const [categoryFilter, setCategoryFilter] = useState<"All" | "intern" | "team_leader">("All");
  const [search, setSearch] = useState("");
  const [outcomeFilter, setOutcomeFilter] = useState("All");

  // Drilldown Modal
  const [selectedEmpDrilldown, setSelectedEmpDrilldown] = useState<EmployeeCallStat | null>(null);

  // Schema notice state
  const [needsMigration, setNeedsMigration] = useState(false);
  const [copiedSql, setCopiedSql] = useState(false);

  // Fetch calls, employees, followups
  async function loadCallData() {
    setLoading(true);
    setError("");

    try {
      // 1. Fetch employees
      const { data: empData } = await supabase
        .from("employees")
        .select("id, full_name, employee_code, role, department")
        .eq("employment_status", "active");

      const emps = empData || [];
      setEmployees(emps);
      const empMap = new Map(emps.map((e) => [e.id, e]));

      // 2. Fetch follow-ups
      const { data: followupsData } = await supabase
        .from("follow_ups")
        .select("id, employee_id, client_name, scheduled_date, scheduled_time, status, type, notes, created_at");
      setFollowups(followupsData || []);

      // 3. Fetch calls
      const { data: callsData, error: callsErr } = await supabase
        .from("calls")
        .select(`
          id,
          employee_id,
          lead_id,
          client_name,
          phone,
          call_type,
          duration_seconds,
          outcome,
          notes,
          follow_up_needed,
          follow_up_date,
          created_at
        `)
        .order("created_at", { ascending: false });

      if (callsErr) {
        if (
          callsErr.message.includes("schema cache") ||
          callsErr.message.includes("does not exist") ||
          callsErr.message.includes("relation")
        ) {
          setNeedsMigration(true);
          // Synthesize call logs from follow_ups so data is visible immediately
          const syntheticCalls: CallItem[] = (followupsData || []).map((f) => ({
            id: f.id,
            employee_id: f.employee_id,
            lead_id: null,
            client_name: f.client_name,
            phone: "+91 (Client)",
            call_type: "Outbound",
            duration_seconds: 180,
            outcome: f.status === "Completed" ? "Answered" : "Callback Requested",
            notes: f.notes || "Call logged via follow-up schedule",
            follow_up_needed: true,
            follow_up_date: f.scheduled_date,
            created_at: f.created_at,
            employee: empMap.get(f.employee_id) || null,
          }));
          setCalls(syntheticCalls);
          return;
        }
        throw new Error(callsErr.message);
      }

      setNeedsMigration(false);
      const structured: CallItem[] = (callsData || []).map((c) => ({
        ...c,
        employee: empMap.get(c.employee_id) || null,
      }));
      setCalls(structured);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load call activities.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadCallData();

    // Real-time subscription to calls and follow-ups
    const callChan = supabase
      .channel("admin-calls-realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "calls" }, () => {
        loadCallData();
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "follow_ups" }, () => {
        loadCallData();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(callChan);
    };
  }, []);

  // Filter calls by date range, category, and search
  const filteredCalls = useMemo(() => {
    const rangeObj = DATE_RANGES.find((r) => r.key === selectedRange) || DATE_RANGES[2];
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - rangeObj.days);

    return calls.filter((call) => {
      // Date range check
      const callDate = new Date(call.created_at);
      if (callDate < cutoffDate) return false;

      // Category filter (Intern vs TL)
      if (categoryFilter !== "All") {
        if (call.employee?.role !== categoryFilter) return false;
      }

      // Outcome filter
      if (outcomeFilter !== "All" && call.outcome !== outcomeFilter) return false;

      // Search query
      const q = search.trim().toLowerCase();
      if (q) {
        const str = [
          call.client_name,
          call.phone,
          call.employee?.full_name || "",
          call.notes || "",
        ]
          .join(" ")
          .toLowerCase();
        if (!str.includes(q)) return false;
      }

      return true;
    });
  }, [calls, selectedRange, categoryFilter, outcomeFilter, search]);

  // Today's Date String
  const todayStr = new Date().toISOString().split("T")[0];

  // Individual Employee Statistics Breakdown
  const employeeStats: EmployeeCallStat[] = useMemo(() => {
    return employees
      .filter((emp) => {
        if (categoryFilter === "All") return true;
        return emp.role === categoryFilter;
      })
      .map((emp) => {
        const empCalls = filteredCalls.filter((c) => c.employee_id === emp.id);
        const todayCalls = empCalls.filter((c) => c.created_at.startsWith(todayStr)).length;
        const outbound = empCalls.filter((c) => c.call_type === "Outbound").length;
        const inbound = empCalls.filter((c) => c.call_type === "Inbound").length;
        const answered = empCalls.filter((c) => c.outcome === "Answered" || c.outcome === "Interested").length;
        const totalDurationSec = empCalls.reduce((acc, curr) => acc + (curr.duration_seconds || 0), 0);
        const avgMin = empCalls.length > 0 ? Number((totalDurationSec / empCalls.length / 60).toFixed(1)) : 0;
        const empFollowups = followups.filter((f) => f.employee_id === emp.id).length;

        return {
          employeeId: emp.id,
          fullName: emp.full_name,
          code: emp.employee_code,
          role: emp.role,
          department: emp.department || "Sales",
          totalCalls: empCalls.length,
          todayCalls,
          outboundCalls: outbound,
          inboundCalls: inbound,
          answeredCalls: answered,
          avgDurationMinutes: avgMin,
          followupsCount: empFollowups,
          calledToday: todayCalls > 0,
        };
      })
      .sort((a, b) => b.todayCalls - a.todayCalls || b.totalCalls - a.totalCalls);
  }, [employees, filteredCalls, followups, categoryFilter, todayStr]);

  // Summary Metrics
  const totalCallsInPeriod = filteredCalls.length;
  const callsToday = filteredCalls.filter((c) => c.created_at.startsWith(todayStr)).length;
  const activeCallersToday = employeeStats.filter((e) => e.calledToday).length;
  const answeredPercent =
    totalCallsInPeriod > 0
      ? Math.round(
          (filteredCalls.filter((c) => c.outcome === "Answered" || c.outcome === "Interested").length /
            totalCallsInPeriod) *
            100
        )
      : 0;

  return (
    <div className="space-y-6 p-6">
      {/* 1. Header & Date Range Buttons */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Call Activities & Telephony</h1>
          <p className="mt-1 text-sm text-gray-500">
            Real-time call tracking, employee outreach monitoring, and linked follow-up activity.
          </p>
        </div>

        {/* Date Range Selector (1 Day to 1 Year) */}
        <div className="flex flex-wrap items-center gap-1 rounded-2xl border border-gray-200 bg-white p-1 shadow-sm">
          {DATE_RANGES.map((rng) => (
            <button
              key={rng.key}
              type="button"
              onClick={() => setSelectedRange(rng.key)}
              className={`rounded-xl px-3 py-1.5 text-xs font-bold transition ${
                selectedRange === rng.key
                  ? "bg-[#0f172a] text-white shadow-sm"
                  : "text-gray-600 hover:text-gray-900 hover:bg-gray-100"
              }`}
            >
              {rng.label}
            </button>
          ))}
        </div>
      </div>

      {/* Schema Notice Banner if database table needs execution */}
      {needsMigration && (
        <div className="rounded-2xl border border-amber-300 bg-amber-50 p-4 text-xs text-amber-900 shadow-sm space-y-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2 font-bold text-sm text-amber-900">
              <AlertTriangle size={18} className="text-amber-600" />
              <span>One-Time Database Setup for Persistent Call Logs</span>
            </div>
            <button
              type="button"
              onClick={() => {
                navigator.clipboard.writeText(CALLS_SQL_SCRIPT);
                setCopiedSql(true);
                setTimeout(() => setCopiedSql(false), 2500);
              }}
              className="flex items-center gap-1.5 rounded-xl bg-amber-600 px-3 py-1.5 font-semibold text-white hover:bg-amber-700 transition shadow-sm"
            >
              {copiedSql ? <Check size={14} /> : <Copy size={14} />}
              <span>{copiedSql ? "Copied SQL!" : "Copy SQL for Calls Table"}</span>
            </button>
          </div>
          <p className="text-amber-800">
            The <code>calls</code> table is currently not created in your Supabase database. Call logs are currently synthesized from active employee follow-up interactions. Run the copied SQL in your Supabase SQL editor to enable native call logging.
          </p>
        </div>
      )}

      {/* 2. Top Summary Metric Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium text-gray-500">Calls Logged Today</p>
            <div className="rounded-xl bg-blue-50 p-2.5 text-blue-600">
              <Phone size={20} />
            </div>
          </div>
          <div className="mt-4 flex items-end justify-between">
            <h2 className="text-3xl font-extrabold text-gray-900">{callsToday}</h2>
            <span className="flex items-center gap-1 text-xs font-semibold text-blue-600">
              Today's Volume
            </span>
          </div>
          <p className="mt-2 text-xs text-gray-400">Total client calls conducted today</p>
        </div>

        <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium text-gray-500">Active Callers Today</p>
            <div className="rounded-xl bg-emerald-50 p-2.5 text-emerald-600">
              <UserCheck size={20} />
            </div>
          </div>
          <div className="mt-4 flex items-end justify-between">
            <h2 className="text-3xl font-extrabold text-gray-900">{activeCallersToday}</h2>
            <span className="flex items-center gap-1 text-xs font-semibold text-emerald-600">
              {employees.length > 0 ? `${Math.round((activeCallersToday / employees.length) * 100)}% active` : "0%"}
            </span>
          </div>
          <p className="mt-2 text-xs text-gray-400">Employees making calls today</p>
        </div>

        <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium text-gray-500">Period Total ({selectedRange})</p>
            <div className="rounded-xl bg-violet-50 p-2.5 text-violet-600">
              <TrendingUp size={20} />
            </div>
          </div>
          <div className="mt-4 flex items-end justify-between">
            <h2 className="text-3xl font-extrabold text-gray-900">{totalCallsInPeriod}</h2>
            <span className="flex items-center gap-1 text-xs font-semibold text-violet-600">
              {answeredPercent}% connected
            </span>
          </div>
          <p className="mt-2 text-xs text-gray-400">Total calls across selected timeframe</p>
        </div>

        <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium text-gray-500">Linked Follow-ups</p>
            <div className="rounded-xl bg-amber-50 p-2.5 text-amber-600">
              <Clock size={20} />
            </div>
          </div>
          <div className="mt-4 flex items-end justify-between">
            <h2 className="text-3xl font-extrabold text-gray-900">{followups.length}</h2>
            <span className="flex items-center gap-1 text-xs font-semibold text-amber-600">
              Scheduled
            </span>
          </div>
          <p className="mt-2 text-xs text-gray-400">Pending or completed client follow-ups</p>
        </div>
      </div>

      {/* 3. Category Sub-Section Switcher (Interns vs Team Leaders) */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-gray-200 bg-white p-3 shadow-sm">
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
            <span>Interns Call Track ({employees.filter((e) => e.role === "intern").length})</span>
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
            <span>Team Leaders Squad ({employees.filter((e) => e.role === "team_leader").length})</span>
          </button>
        </div>

        <div className="flex items-center gap-2">
          <div className="flex items-center gap-2 rounded-xl border border-gray-200 bg-gray-50/50 px-3 py-1.5 text-xs">
            <Search size={14} className="text-gray-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search call records..."
              className="w-44 bg-transparent outline-none text-xs"
            />
          </div>

          <button
            onClick={loadCallData}
            title="Refresh"
            className="rounded-xl border border-gray-200 p-2 text-gray-600 hover:bg-gray-50 transition"
          >
            <RefreshCw size={14} className={loading ? "animate-spin text-blue-600" : ""} />
          </button>
        </div>
      </div>

      {/* 4. Individual Employee Call Performance Roster */}
      <div className="rounded-2xl border border-gray-200 bg-white shadow-sm overflow-hidden">
        <div className="border-b border-gray-200 p-5 bg-gray-50/40 flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="text-base font-bold text-gray-900">
              Individual Employee Call Breakdown
            </h2>
            <p className="mt-0.5 text-xs text-gray-500">
              Track how many calls each individual employee has made, call outcomes, and linked follow-ups
            </p>
          </div>
          <span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-bold text-blue-700">
            {employeeStats.length} Employees Monitored
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-gray-50 text-[11px] uppercase tracking-wider text-gray-500 border-b border-gray-200">
              <tr>
                <th className="px-5 py-3.5">Employee</th>
                <th className="px-5 py-3.5">Category</th>
                <th className="px-5 py-3.5 text-center">Calls Today</th>
                <th className="px-5 py-3.5 text-center">Total Period Calls</th>
                <th className="px-5 py-3.5 text-center">Outbound / Inbound</th>
                <th className="px-5 py-3.5 text-center">Avg. Duration</th>
                <th className="px-5 py-3.5 text-center">Linked Follow-ups</th>
                <th className="px-5 py-3.5 text-center">Actions</th>
              </tr>
            </thead>

            <tbody className="divide-y divide-gray-100">
              {employeeStats.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-5 py-10 text-center text-xs text-gray-400">
                    No employees matching the current category.
                  </td>
                </tr>
              ) : (
                employeeStats.map((stat) => (
                  <tr key={stat.employeeId} className="hover:bg-gray-50/60 transition">
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-3">
                        <div
                          className={`flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold ${
                            stat.calledToday
                              ? "bg-emerald-100 text-emerald-800 ring-2 ring-emerald-400"
                              : "bg-gray-100 text-gray-600"
                          }`}
                        >
                          {stat.fullName.charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <p className="font-bold text-gray-900 text-sm flex items-center gap-2">
                            {stat.fullName}
                            {stat.calledToday && (
                              <span className="rounded-full bg-emerald-50 px-2 py-0.2 text-[10px] font-bold text-emerald-700">
                                Called Today
                              </span>
                            )}
                          </p>
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

                    <td className="px-5 py-3.5 text-center font-extrabold text-sm text-gray-900">
                      {stat.todayCalls > 0 ? (
                        <span className="text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-full">
                          {stat.todayCalls}
                        </span>
                      ) : (
                        <span className="text-gray-400 font-normal">0</span>
                      )}
                    </td>

                    <td className="px-5 py-3.5 text-center font-bold text-gray-800">
                      {stat.totalCalls}
                    </td>

                    <td className="px-5 py-3.5 text-center text-gray-600">
                      <span className="text-blue-600 font-semibold">{stat.outboundCalls} out</span> /{" "}
                      <span className="text-emerald-600 font-semibold">{stat.inboundCalls} in</span>
                    </td>

                    <td className="px-5 py-3.5 text-center font-medium text-gray-700">
                      {stat.avgDurationMinutes > 0 ? `${stat.avgDurationMinutes} mins` : "-"}
                    </td>

                    <td className="px-5 py-3.5 text-center font-bold text-amber-700">
                      {stat.followupsCount}
                    </td>

                    <td className="px-5 py-3.5 text-center">
                      <button
                        type="button"
                        onClick={() => setSelectedEmpDrilldown(stat)}
                        className="rounded-xl border border-gray-200 bg-white px-3 py-1 text-xs font-semibold text-gray-700 hover:bg-gray-50 hover:border-gray-300 transition"
                      >
                        View Logs
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* 5. Live Call Logs & Outreach Activity Feed */}
      <div className="rounded-2xl border border-gray-200 bg-white shadow-sm overflow-hidden">
        <div className="border-b border-gray-200 p-5 bg-gray-50/40 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-bold text-gray-900">
              Live Call Activity & Outreach Logs
            </h2>
            <p className="mt-0.5 text-xs text-gray-500">
              Complete conversation records, customer notes, and scheduled follow-ups
            </p>
          </div>

          <div className="flex items-center gap-2">
            <select
              value={outcomeFilter}
              onChange={(e) => setOutcomeFilter(e.target.value)}
              className="rounded-xl border border-gray-200 bg-white px-3 py-1.5 text-xs outline-none"
            >
              <option value="All">All Outcomes</option>
              <option value="Answered">Answered</option>
              <option value="Interested">Interested</option>
              <option value="Callback Requested">Callback Requested</option>
              <option value="Busy">Busy</option>
              <option value="No Answer">No Answer</option>
            </select>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-gray-50 text-[11px] uppercase tracking-wider text-gray-500 border-b border-gray-200">
              <tr>
                <th className="px-5 py-3.5">Client Contact</th>
                <th className="px-5 py-3.5">Calling Employee</th>
                <th className="px-5 py-3.5">Type & Outcome</th>
                <th className="px-5 py-3.5">Duration</th>
                <th className="px-5 py-3.5">Conversation Remarks</th>
                <th className="px-5 py-3.5">Linked Follow-up</th>
                <th className="px-5 py-3.5">Timestamp</th>
              </tr>
            </thead>

            <tbody className="divide-y divide-gray-100">
              {filteredCalls.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-5 py-12 text-center text-xs text-gray-400">
                    No call activities logged for the selected period.
                  </td>
                </tr>
              ) : (
                filteredCalls.slice(0, 25).map((call) => (
                  <tr key={call.id} className="hover:bg-gray-50/60 transition">
                    <td className="px-5 py-3.5">
                      <p className="font-bold text-gray-900">{call.client_name}</p>
                      <p className="font-mono text-[11px] text-gray-500">{call.phone}</p>
                    </td>

                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-2">
                        <span
                          className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                            call.employee?.role === "intern"
                              ? "bg-violet-100 text-violet-800"
                              : call.employee?.role === "team_leader"
                                ? "bg-amber-100 text-amber-800"
                                : "bg-blue-100 text-blue-800"
                          }`}
                        >
                          {call.employee?.role === "intern"
                            ? "Intern"
                            : call.employee?.role === "team_leader"
                              ? "TL"
                              : "Staff"}
                        </span>
                        <span className="font-semibold text-gray-800">
                          {call.employee?.full_name || "Employee"}
                        </span>
                      </div>
                    </td>

                    <td className="px-5 py-3.5 space-y-1">
                      <div className="flex items-center gap-1.5">
                        {call.call_type === "Inbound" ? (
                          <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-700">
                            <PhoneIncoming size={12} /> Inbound
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-[11px] font-bold text-blue-700">
                            <PhoneOutgoing size={12} /> Outbound
                          </span>
                        )}
                      </div>
                      <span
                        className={`inline-block rounded-full px-2 py-0.5 text-[10px] font-bold ${
                          call.outcome === "Answered" || call.outcome === "Interested"
                            ? "bg-emerald-50 text-emerald-700"
                            : call.outcome === "Callback Requested"
                              ? "bg-blue-50 text-blue-700"
                              : "bg-amber-50 text-amber-700"
                        }`}
                      >
                        {call.outcome}
                      </span>
                    </td>

                    <td className="px-5 py-3.5 font-mono text-gray-700">
                      {Math.floor(call.duration_seconds / 60)}m {call.duration_seconds % 60}s
                    </td>

                    <td className="px-5 py-3.5 text-gray-600 max-w-xs truncate">
                      {call.notes || "-"}
                    </td>

                    <td className="px-5 py-3.5">
                      {call.follow_up_needed ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-purple-50 px-2.5 py-0.5 text-[10px] font-bold text-purple-700">
                          <Clock size={11} /> {call.follow_up_date || "Scheduled"}
                        </span>
                      ) : (
                        <span className="text-gray-400 text-[11px]">-</span>
                      )}
                    </td>

                    <td className="px-5 py-3.5 text-gray-400 text-[11px]">
                      {new Date(call.created_at).toLocaleString([], {
                        month: "short",
                        day: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* 6. Individual Employee Drilldown Modal */}
      {selectedEmpDrilldown && (
        <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-black/40 p-4">
          <div className="my-6 w-full max-w-3xl rounded-2xl bg-white shadow-xl max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between border-b border-gray-200 p-5 shrink-0">
              <div>
                <h3 className="text-lg font-bold text-gray-900">
                  Call Logs: {selectedEmpDrilldown.fullName}
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
                  <p className="text-[11px] text-gray-500">Total Calls</p>
                  <p className="text-xl font-bold text-gray-900">{selectedEmpDrilldown.totalCalls}</p>
                </div>
                <div className="rounded-xl border border-emerald-200 p-3 bg-emerald-50">
                  <p className="text-[11px] text-emerald-700">Calls Today</p>
                  <p className="text-xl font-bold text-emerald-700">{selectedEmpDrilldown.todayCalls}</p>
                </div>
                <div className="rounded-xl border border-blue-200 p-3 bg-blue-50">
                  <p className="text-[11px] text-blue-700">Answered</p>
                  <p className="text-xl font-bold text-blue-700">{selectedEmpDrilldown.answeredCalls}</p>
                </div>
                <div className="rounded-xl border border-purple-200 p-3 bg-purple-50">
                  <p className="text-[11px] text-purple-700">Follow-ups</p>
                  <p className="text-xl font-bold text-purple-700">{selectedEmpDrilldown.followupsCount}</p>
                </div>
              </div>

              <div>
                <h4 className="text-xs font-bold text-gray-900 mb-2">Detailed Call Log Entries</h4>
                <div className="max-h-64 overflow-y-auto divide-y divide-gray-100 rounded-xl border border-gray-200 text-xs">
                  {calls.filter((c) => c.employee_id === selectedEmpDrilldown.employeeId).length === 0 ? (
                    <div className="p-8 text-center text-gray-400">No calls recorded for this employee.</div>
                  ) : (
                    calls
                      .filter((c) => c.employee_id === selectedEmpDrilldown.employeeId)
                      .map((c) => (
                        <div key={c.id} className="p-3 hover:bg-gray-50 flex items-center justify-between">
                          <div>
                            <p className="font-bold text-gray-900">{c.client_name}</p>
                            <p className="text-gray-500 font-mono text-[11px]">{c.phone}</p>
                            {c.notes && <p className="text-gray-600 mt-1 italic">"{c.notes}"</p>}
                          </div>
                          <div className="text-right space-y-1">
                            <span className="inline-block rounded-full px-2 py-0.5 text-[10px] font-bold bg-blue-50 text-blue-700">
                              {c.outcome}
                            </span>
                            <p className="text-[10px] text-gray-400">
                              {new Date(c.created_at).toLocaleString([], {
                                month: "short",
                                day: "numeric",
                                hour: "2-digit",
                                minute: "2-digit",
                              })}
                            </p>
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
