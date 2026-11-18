import { useState, useEffect, useMemo } from "react";
import {
  BarChart3,
  Download,
  TrendingUp,
  Award,
  Calendar,
  Users,
  Target,
  PhoneCall,
  IndianRupee,
  CheckCircle2,
  Clock,
  RefreshCw,
  FileText,
  Filter,
  User,
  GraduationCap,
  Shield,
  ArrowUpRight
} from "lucide-react";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend
} from "recharts";
import { supabase } from "../../services/supabase";

interface LeadStats {
  stage: string;
  count: number;
}

interface CallOutcomeStats {
  outcome: string;
  count: number;
}

interface LeaderboardEntry {
  id: string;
  name: string;
  code: string;
  role: string;
  department: string;
  leadsAssigned: number;
  leadsWon: number;
  callsMade: number;
  conversionRate: number;
  ratingBadge: "Top Performer" | "On Track" | "Needs Attention";
}

export default function Reports() {
  const [timeRange, setTimeRange] = useState("All Time");
  const [categoryFilter, setCategoryFilter] = useState<"all" | "intern" | "team_leader">("all");
  const [loading, setLoading] = useState(true);

  // Raw Database Data
  const [leadsData, setLeadsData] = useState<any[]>([]);
  const [callsData, setCallsData] = useState<any[]>([]);
  const [employeesData, setEmployeesData] = useState<any[]>([]);
  const [invoicesData, setInvoicesData] = useState<any[]>([]);

  // Load Real Data
  async function loadReportData() {
    setLoading(true);
    try {
      const [leadsRes, callsRes, empsRes, invsRes] = await Promise.all([
        supabase.from("leads").select("id, name, stage, assigned_to, created_at"),
        supabase.from("calls").select("id, employee_id, call_type, duration_seconds, outcome, created_at"),
        supabase.from("employees").select("id, full_name, employee_code, role, department, employment_status"),
        supabase.from("invoices").select("id, total_amount, amount_paid, balance_due, status, date"),
      ]);

      setLeadsData(leadsRes.data || []);
      setCallsData(callsRes.data || []);
      setEmployeesData(empsRes.data || []);

      // If invoices table returned data, use it; otherwise check local storage cache
      if (invsRes.data && invsRes.data.length > 0) {
        setInvoicesData(invsRes.data);
      } else {
        const cached = localStorage.getItem("crm_admin_invoices_cache");
        if (cached) {
          try {
            setInvoicesData(JSON.parse(cached));
          } catch {
            setInvoicesData([]);
          }
        } else {
          setInvoicesData([]);
        }
      }
    } catch (err) {
      console.warn("Error fetching reporting data:", err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadReportData();
  }, []);

  // Filter Employees based on Category (Interns vs Team Leaders)
  const filteredEmployees = useMemo(() => {
    return employeesData.filter((emp) => {
      const role = (emp.role || "").toLowerCase();
      if (categoryFilter === "intern") return role.includes("intern");
      if (categoryFilter === "team_leader") return role.includes("leader") || role.includes("tl");
      return true;
    });
  }, [employeesData, categoryFilter]);

  // Lead Pipeline Stats (Chart Data)
  const pipelineChartData = useMemo(() => {
    const stages = ["New", "Contacted", "Qualified", "Proposal", "Won", "Lost"];
    const counts: Record<string, number> = {
      New: 0,
      Contacted: 0,
      Qualified: 0,
      Proposal: 0,
      Won: 0,
      Lost: 0,
    };

    leadsData.forEach((lead) => {
      if (counts[lead.stage] !== undefined) {
        counts[lead.stage]++;
      } else {
        counts["New"]++;
      }
    });

    return stages.map((st) => ({
      stage: st,
      leads: counts[st] || 0,
    }));
  }, [leadsData]);

  // Call Outcomes Stats (Chart Data)
  const callOutcomeChartData = useMemo(() => {
    const outcomes = ["Answered", "Busy", "No Answer", "Callback Requested", "Wrong Number"];
    const counts: Record<string, number> = {};
    outcomes.forEach((o) => (counts[o] = 0));

    callsData.forEach((call) => {
      const oc = call.outcome || "Answered";
      if (counts[oc] !== undefined) {
        counts[oc]++;
      } else {
        counts["Answered"]++;
      }
    });

    return outcomes.map((o) => ({
      outcome: o,
      calls: counts[o] || 0,
    }));
  }, [callsData]);

  // Executive KPI Summary
  const totalLeads = leadsData.length;
  const wonLeads = leadsData.filter((l) => l.stage === "Won").length;
  const conversionRate = totalLeads > 0 ? ((wonLeads / totalLeads) * 100).toFixed(1) : "0.0";
  const totalCalls = callsData.length;
  const totalRevenue = invoicesData.reduce((sum, inv) => sum + Number(inv.amount_paid || 0), 0);
  const pendingReceivables = invoicesData.reduce((sum, inv) => sum + Number(inv.balance_due || 0), 0);

  // Workforce Leaderboard (Live database aggregation)
  const leaderboard: LeaderboardEntry[] = useMemo(() => {
    return filteredEmployees.map((emp) => {
      const assigned = leadsData.filter((l) => l.assigned_to === emp.id).length;
      const won = leadsData.filter((l) => l.assigned_to === emp.id && l.stage === "Won").length;
      const calls = callsData.filter((c) => c.employee_id === emp.id).length;
      const rate = assigned > 0 ? Math.round((won / assigned) * 100) : 0;

      let ratingBadge: "Top Performer" | "On Track" | "Needs Attention" = "On Track";
      if (won >= 2 || calls >= 15 || rate >= 25) {
        ratingBadge = "Top Performer";
      } else if (assigned > 0 && calls === 0) {
        ratingBadge = "Needs Attention";
      }

      return {
        id: emp.id,
        name: emp.full_name,
        code: emp.employee_code,
        role: emp.role,
        department: emp.department || "Sales",
        leadsAssigned: assigned,
        leadsWon: won,
        callsMade: calls,
        conversionRate: rate,
        ratingBadge,
      };
    }).sort((a, b) => b.leadsWon - a.leadsWon || b.callsMade - a.callsMade || b.leadsAssigned - a.leadsAssigned);
  }, [filteredEmployees, leadsData, callsData]);

  // Export Report to CSV
  function handleExportReport() {
    const rows = [
      ["Employee Name", "Employee ID", "Role", "Department", "Assigned Leads", "Won Deals", "Calls Made", "Conversion %", "Rating"],
      ...leaderboard.map((l) => [
        `"${l.name}"`,
        l.code,
        l.role,
        l.department,
        l.leadsAssigned,
        l.leadsWon,
        l.callsMade,
        `${l.conversionRate}%`,
        l.ratingBadge,
      ]),
    ];

    const csvContent = "data:text/csv;charset=utf-8," + rows.map((e) => e.join(",")).join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `CRM_Performance_Report_${new Date().toISOString().split("T")[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Analytics & Performance Reports</h1>
          <p className="mt-1 text-sm text-gray-500">
            Real-time business intelligence, lead conversion velocity, outreach stats, and employee leaderboards.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <select
            value={timeRange}
            onChange={(e) => setTimeRange(e.target.value)}
            className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-xs font-medium outline-none cursor-pointer"
          >
            <option value="All Time">All Time</option>
            <option value="This Month">This Month</option>
            <option value="This Quarter">This Quarter</option>
            <option value="Current FY 2026">Current FY 2026</option>
          </select>

          <button
            onClick={loadReportData}
            disabled={loading}
            className="flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3 py-2 text-xs font-medium text-gray-700 hover:bg-gray-50 transition"
          >
            <RefreshCw size={14} className={loading ? "animate-spin text-blue-600" : ""} />
            Sync
          </button>

          <button
            onClick={handleExportReport}
            className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-xs font-semibold text-white hover:bg-blue-700 shadow-sm transition"
          >
            <Download size={15} />
            Export CSV Report
          </button>
        </div>
      </div>

      {/* 4 Executive KPI Metric Cards (Database backed) */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-4">
        <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <p className="text-xs font-medium text-gray-500">Total Booked Revenue</p>
            <div className="rounded-lg bg-emerald-50 p-2 text-emerald-600">
              <IndianRupee size={18} />
            </div>
          </div>
          <p className="mt-3 text-2xl font-bold text-gray-900">
            ₹{totalRevenue.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
          </p>
          <span className="mt-1 block text-xs text-emerald-600 font-semibold flex items-center gap-1">
            <TrendingUp size={12} /> Live billing collection
          </span>
        </div>

        <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <p className="text-xs font-medium text-gray-500">Deals Won / Closed</p>
            <div className="rounded-lg bg-blue-50 p-2 text-blue-600">
              <Award size={18} />
            </div>
          </div>
          <p className="mt-3 text-2xl font-bold text-blue-600">{wonLeads}</p>
          <span className="mt-1 block text-xs text-gray-400">Out of {totalLeads} total prospects</span>
        </div>

        <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <p className="text-xs font-medium text-gray-500">Lead Conversion Ratio</p>
            <div className="rounded-lg bg-purple-50 p-2 text-purple-600">
              <Target size={18} />
            </div>
          </div>
          <p className="mt-3 text-2xl font-bold text-purple-700">{conversionRate}%</p>
          <span className="mt-1 block text-xs text-gray-400">Prospect-to-win index</span>
        </div>

        <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <p className="text-xs font-medium text-gray-500">Outreach Calls Logged</p>
            <div className="rounded-lg bg-amber-50 p-2 text-amber-600">
              <PhoneCall size={18} />
            </div>
          </div>
          <p className="mt-3 text-2xl font-bold text-amber-600">{totalCalls}</p>
          <span className="mt-1 block text-xs text-gray-400">Across {employeesData.length} team members</span>
        </div>
      </div>

      {/* Analytics Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Pipeline Distribution Chart */}
        <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h2 className="text-base font-bold text-gray-900">Lead Conversion Pipeline</h2>
              <p className="text-xs text-gray-500">Active distribution of leads across sales stages</p>
            </div>
            <Target size={18} className="text-blue-600" />
          </div>

          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={pipelineChartData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="stage" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
                <Tooltip
                  contentStyle={{ backgroundColor: "#1e293b", color: "#fff", borderRadius: "8px", fontSize: "12px" }}
                />
                <Bar dataKey="leads" fill="#2563eb" radius={[4, 4, 0, 0]} name="Leads Count" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Telephony Outcomes Chart */}
        <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h2 className="text-base font-bold text-gray-900">Outreach Call Outcomes</h2>
              <p className="text-xs text-gray-500">Call status and customer engagement outcomes</p>
            </div>
            <PhoneCall size={18} className="text-emerald-600" />
          </div>

          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={callOutcomeChartData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="outcome" tick={{ fontSize: 10 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
                <Tooltip
                  contentStyle={{ backgroundColor: "#1e293b", color: "#fff", borderRadius: "8px", fontSize: "12px" }}
                />
                <Bar dataKey="calls" fill="#10b981" radius={[4, 4, 0, 0]} name="Calls Made" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Workforce Performance Leaderboard */}
      <div className="rounded-xl border border-gray-200 bg-white shadow-sm overflow-hidden">
        {/* Sub-section Filter Bar */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-gray-100 bg-gray-50/70 p-4">
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => setCategoryFilter("all")}
              className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                categoryFilter === "all"
                  ? "bg-gray-900 text-white shadow-sm"
                  : "bg-white text-gray-600 border border-gray-200 hover:bg-gray-100"
              }`}
            >
              <User size={13} />
              All Workforce ({employeesData.length})
            </button>
            <button
              onClick={() => setCategoryFilter("intern")}
              className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                categoryFilter === "intern"
                  ? "bg-purple-600 text-white shadow-sm"
                  : "bg-white text-gray-600 border border-gray-200 hover:bg-gray-100"
              }`}
            >
              <GraduationCap size={13} />
              Interns ({employeesData.filter((e) => (e.role || "").toLowerCase().includes("intern")).length})
            </button>
            <button
              onClick={() => setCategoryFilter("team_leader")}
              className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                categoryFilter === "team_leader"
                  ? "bg-amber-600 text-white shadow-sm"
                  : "bg-white text-gray-600 border border-gray-200 hover:bg-gray-100"
              }`}
            >
              <Shield size={13} />
              Team Leaders (TL) ({employeesData.filter((e) => (e.role || "").toLowerCase().includes("leader") || (e.role || "").toLowerCase().includes("tl")).length})
            </button>
          </div>

          <div className="text-xs text-gray-500">
            Ranked by <span className="font-semibold text-gray-900">Deals Closed & Calls Logged</span>
          </div>
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-gray-600">
            <thead className="bg-gray-50 text-xs font-semibold text-gray-500 uppercase tracking-wider">
              <tr>
                <th className="px-5 py-3.5">Rank & Employee</th>
                <th className="px-5 py-3.5">Category</th>
                <th className="px-5 py-3.5 text-center">Assigned Leads</th>
                <th className="px-5 py-3.5 text-center">Calls Made</th>
                <th className="px-5 py-3.5 text-center">Deals Closed</th>
                <th className="px-5 py-3.5 text-center">Win Rate</th>
                <th className="px-5 py-3.5 text-right">Rating</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-sm text-gray-500">
                    <RefreshCw size={24} className="mx-auto mb-2 animate-spin text-blue-600" />
                    Calculating live leaderboard rankings...
                  </td>
                </tr>
              ) : leaderboard.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-xs text-gray-400">
                    No workforce records found for this category filter.
                  </td>
                </tr>
              ) : (
                leaderboard.map((entry, index) => {
                  const isIntern = entry.role.toLowerCase().includes("intern");
                  const isTL = entry.role.toLowerCase().includes("leader") || entry.role.toLowerCase().includes("tl");

                  return (
                    <tr key={entry.id} className="hover:bg-gray-50/70 transition">
                      <td className="px-5 py-4 flex items-center gap-3">
                        <span
                          className={`flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold ${
                            index === 0
                              ? "bg-amber-100 text-amber-800"
                              : index === 1
                              ? "bg-slate-200 text-slate-700"
                              : index === 2
                              ? "bg-amber-50 text-amber-700"
                              : "bg-gray-100 text-gray-500"
                          }`}
                        >
                          {index + 1}
                        </span>
                        <div>
                          <p className="font-semibold text-gray-900">{entry.name}</p>
                          <p className="text-xs text-gray-400">{entry.code}</p>
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
                            {entry.role}
                          </span>
                        )}
                      </td>

                      <td className="px-5 py-4 text-center font-medium text-gray-900">
                        {entry.leadsAssigned}
                      </td>

                      <td className="px-5 py-4 text-center font-medium text-blue-600">
                        {entry.callsMade}
                      </td>

                      <td className="px-5 py-4 text-center font-bold text-emerald-600">
                        {entry.leadsWon}
                      </td>

                      <td className="px-5 py-4 text-center font-semibold text-xs text-gray-800">
                        {entry.conversionRate}%
                      </td>

                      <td className="px-5 py-4 text-right">
                        <span
                          className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold border ${
                            entry.ratingBadge === "Top Performer"
                              ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                              : entry.ratingBadge === "On Track"
                              ? "bg-blue-50 text-blue-700 border-blue-200"
                              : "bg-amber-50 text-amber-700 border-amber-200"
                          }`}
                        >
                          {entry.ratingBadge}
                        </span>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
