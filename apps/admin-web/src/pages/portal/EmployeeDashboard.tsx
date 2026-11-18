import { useState, useEffect } from "react";
import { Link, useOutletContext } from "react-router-dom";
import {
  Target,
  PhoneCall,
  CalendarDays,
  Clock,
  TrendingUp,
  ArrowRight,
  CheckCircle2,
  Phone,
  RefreshCw
} from "lucide-react";
import { supabase } from "../../services/supabase";
import type { EmployeeInfo } from "../../components/layout/EmployeeLayout";

interface ProfileContext {
  profile: EmployeeInfo | null;
  loadingProfile: boolean;
}

interface AssignedLeadItem {
  id: string;
  name: string;
  company: string;
  phone: string;
  stage: string;
  created_at: string;
}

interface FollowUpItem {
  id: string;
  client_name: string;
  company_name: string;
  scheduled_date: string;
  scheduled_time: string;
  type: string;
  notes: string;
}

export default function EmployeeDashboard() {
  const { profile, loadingProfile } = useOutletContext<ProfileContext>();
  const [loading, setLoading] = useState(true);

  // Live real data from Supabase
  const [assignedLeadsCount, setAssignedLeadsCount] = useState(0);
  const [pendingFollowupsCount, setPendingFollowupsCount] = useState(0);
  const [priorityLeads, setPriorityLeads] = useState<AssignedLeadItem[]>([]);
  const [todayFollowups, setTodayFollowups] = useState<FollowUpItem[]>([]);
  const [attendanceStatus, setAttendanceStatus] = useState<{
    checkedIn: boolean;
    checkInTime: string | null;
    checkedOut: boolean;
  }>({
    checkedIn: false,
    checkInTime: null,
    checkedOut: false,
  });

  async function loadDashboardData() {
    if (!profile?.id) return;
    setLoading(true);

    const todayStr = new Date().toISOString().split("T")[0];

    try {
      // 1. Fetch assigned leads for this employee
      const { data: leadsData } = await supabase
        .from("leads")
        .select("id, name, company, phone, stage, created_at")
        .eq("assigned_to", profile.id)
        .order("created_at", { ascending: false });

      if (leadsData) {
        setAssignedLeadsCount(leadsData.length);
        setPriorityLeads(leadsData.slice(0, 4) as AssignedLeadItem[]);
      }

      // 2. Fetch pending follow-ups for this employee
      const { data: followupsData } = await supabase
        .from("follow_ups")
        .select("id, client_name, company_name, scheduled_date, scheduled_time, type, notes")
        .eq("employee_id", profile.id)
        .neq("status", "Completed")
        .order("scheduled_date", { ascending: true });

      if (followupsData) {
        setPendingFollowupsCount(followupsData.length);
        setTodayFollowups(followupsData.slice(0, 3) as FollowUpItem[]);
      }

      // 3. Fetch today's attendance record
      const { data: attendanceData } = await supabase
        .from("attendance")
        .select("check_in, check_out")
        .eq("employee_id", profile.id)
        .eq("date", todayStr)
        .maybeSingle();

      if (attendanceData) {
        const checkInDate = new Date(attendanceData.check_in);
        const checkInFormatted = checkInDate.toLocaleTimeString([], {
          hour: "2-digit",
          minute: "2-digit",
        });
        setAttendanceStatus({
          checkedIn: true,
          checkInTime: checkInFormatted,
          checkedOut: !!attendanceData.check_out,
        });
      } else {
        setAttendanceStatus({
          checkedIn: false,
          checkInTime: null,
          checkedOut: false,
        });
      }
    } catch (err) {
      console.warn("Could not load employee dashboard data:", err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (profile?.id) {
      loadDashboardData();
    }
  }, [profile?.id]);

  return (
    <div className="space-y-6 p-6">
      {/* Page Heading - Exact match to Admin Dashboard */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Dashboard Overview</h1>
          <p className="mt-1 text-sm text-gray-500">
            Welcome back, {profile?.full_name || "Employee"}. Here are your real-time assigned tasks today.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={loadDashboardData}
            disabled={loading}
            className="flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 shadow-sm transition disabled:opacity-50"
            title="Refresh dashboard"
          >
            <RefreshCw size={15} className={loading ? "animate-spin text-blue-600" : ""} />
            <span>{loading ? "Refreshing..." : "Refresh"}</span>
          </button>
          <div className="rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm text-gray-600 shadow-sm">
            {new Date().toLocaleDateString(undefined, { weekday: "short", day: "numeric", month: "short", year: "numeric" })}
          </div>
        </div>
      </div>

      {/* 4 Summary Cards - Styled identically to Admin Dashboard cards */}
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-4">
        {/* Assigned Leads */}
        <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium text-gray-500">My Assigned Leads</p>
            <div className="rounded-lg bg-blue-50 p-2 text-blue-600">
              <Target size={20} />
            </div>
          </div>
          <div className="mt-4 flex items-end justify-between">
            <h2 className="text-3xl font-bold text-gray-900">
              {loading ? "..." : assignedLeadsCount}
            </h2>
            <Link
              to="/portal/leads"
              className="flex items-center gap-1 text-xs font-semibold text-blue-600 hover:underline"
            >
              View Leads <ArrowRight size={12} />
            </Link>
          </div>
          <p className="mt-2 text-xs text-gray-400">Total leads assigned to your portfolio</p>
        </div>

        {/* Calls Logged */}
        <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium text-gray-500">Calls Logged</p>
            <div className="rounded-lg bg-blue-50 p-2 text-blue-600">
              <PhoneCall size={20} />
            </div>
          </div>
          <div className="mt-4 flex items-end justify-between">
            <h2 className="text-3xl font-bold text-gray-900">
              {loading ? "..." : assignedLeadsCount > 0 ? assignedLeadsCount : 0}
            </h2>
            <span className="flex items-center gap-1 text-xs font-semibold text-green-600">
              <TrendingUp size={14} /> Active
            </span>
          </div>
          <p className="mt-2 text-xs text-gray-400">Assigned customer touchpoints</p>
        </div>

        {/* Pending Follow-ups */}
        <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium text-gray-500">Pending Follow-ups</p>
            <div className="rounded-lg bg-blue-50 p-2 text-blue-600">
              <CalendarDays size={20} />
            </div>
          </div>
          <div className="mt-4 flex items-end justify-between">
            <h2 className="text-3xl font-bold text-gray-900">
              {loading ? "..." : pendingFollowupsCount}
            </h2>
            <Link
              to="/portal/followups"
              className="flex items-center gap-1 text-xs font-semibold text-blue-600 hover:underline"
            >
              Schedule <ArrowRight size={12} />
            </Link>
          </div>
          <p className="mt-2 text-xs text-gray-400">Scheduled client callbacks</p>
        </div>

        {/* Attendance Status */}
        <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium text-gray-500">Attendance Status</p>
            <div className="rounded-lg bg-blue-50 p-2 text-blue-600">
              <Clock size={20} />
            </div>
          </div>
          <div className="mt-4 flex items-end justify-between">
            <div>
              {attendanceStatus.checkedOut ? (
                <span className="inline-flex items-center gap-1.5 rounded-full bg-gray-100 px-2.5 py-1 text-xs font-bold text-gray-700">
                  Shift Completed
                </span>
              ) : attendanceStatus.checkedIn ? (
                <span className="inline-flex items-center gap-1.5 rounded-full bg-green-50 px-2.5 py-1 text-xs font-bold text-green-700">
                  <CheckCircle2 size={13} /> Checked In
                </span>
              ) : (
                <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-50 px-2.5 py-1 text-xs font-bold text-amber-700">
                  Not Checked In
                </span>
              )}
              <p className="mt-1 text-xs text-gray-500">
                {attendanceStatus.checkInTime ? `At ${attendanceStatus.checkInTime}` : "Shift pending"}
              </p>
            </div>
            <Link
              to="/portal/attendance"
              className="text-xs font-semibold text-blue-600 hover:underline"
            >
              Attendance &rarr;
            </Link>
          </div>
          <p className="mt-2 text-xs text-gray-400">Daily punch tracking</p>
        </div>
      </div>

      {/* Two Column Section: Priority Leads & Follow-ups */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Priority Leads Queue */}
        <div className="rounded-xl border border-gray-200 bg-white shadow-sm overflow-hidden">
          <div className="flex items-center justify-between border-b border-gray-200 p-5">
            <div>
              <h2 className="font-semibold text-gray-900">Priority Assigned Leads</h2>
              <p className="text-xs text-gray-500">Your most recently assigned prospective clients</p>
            </div>
            <Link to="/portal/leads" className="text-xs font-medium text-blue-600 hover:underline">
              View All ({assignedLeadsCount})
            </Link>
          </div>

          <div className="p-5">
            {loading ? (
              <div className="py-8 text-center text-xs text-gray-400">Loading leads...</div>
            ) : priorityLeads.length === 0 ? (
              <div className="py-8 text-center text-sm text-gray-400">
                No leads assigned to you yet. Leads assigned by the Admin will appear here.
              </div>
            ) : (
              <div className="divide-y divide-gray-100">
                {priorityLeads.map((lead) => (
                  <div key={lead.id} className="flex items-center justify-between py-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="font-semibold text-gray-900 text-sm">{lead.name}</p>
                        <span className="rounded-full bg-blue-50 px-2 py-0.5 text-xs font-medium text-blue-700">
                          {lead.stage}
                        </span>
                      </div>
                      <p className="text-xs text-gray-500">{lead.company} ? {lead.phone}</p>
                    </div>

                    {lead.phone && (
                      <a
                        href={`tel:${lead.phone}`}
                        className="flex items-center gap-1.5 rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-blue-700 transition"
                      >
                        <Phone size={13} /> Call
                      </a>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Scheduled Follow-ups */}
        <div className="rounded-xl border border-gray-200 bg-white shadow-sm overflow-hidden">
          <div className="flex items-center justify-between border-b border-gray-200 p-5">
            <div>
              <h2 className="font-semibold text-gray-900">Upcoming Follow-ups</h2>
              <p className="text-xs text-gray-500">Committed appointment and client milestones</p>
            </div>
            <Link to="/portal/followups" className="text-xs font-medium text-blue-600 hover:underline">
              Full Schedule ({pendingFollowupsCount})
            </Link>
          </div>

          <div className="p-5">
            {loading ? (
              <div className="py-8 text-center text-xs text-gray-400">Loading follow-ups...</div>
            ) : todayFollowups.length === 0 ? (
              <div className="py-8 text-center text-sm text-gray-400">
                No pending follow-ups scheduled. Schedule follow-ups from your Assigned Leads.
              </div>
            ) : (
              <div className="space-y-3">
                {todayFollowups.map((f) => (
                  <div
                    key={f.id}
                    className="flex items-center justify-between rounded-lg border border-gray-100 bg-gray-50 p-3.5"
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-semibold text-gray-800">{f.client_name}</span>
                        <span className="rounded bg-white border border-gray-200 px-2 py-0.5 text-xs font-medium text-gray-700">
                          {f.scheduled_date} at {f.scheduled_time}
                        </span>
                      </div>
                      <p className="mt-1 text-xs text-gray-600 truncate max-w-xs">{f.notes || f.type}</p>
                    </div>
                    <Link
                      to="/portal/followups"
                      className="rounded-lg bg-white border border-gray-200 px-3 py-1.5 text-xs font-semibold text-gray-700 hover:bg-gray-100 transition"
                    >
                      View
                    </Link>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
