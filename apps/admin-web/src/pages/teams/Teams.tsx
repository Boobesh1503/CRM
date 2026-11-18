import { useState, useEffect, useMemo } from "react";
import type { FormEvent } from "react";
import {
  Users,
  Shield,
  Award,
  Plus,
  Search,
  RefreshCw,
  UserPlus,
  Trash2,
  TrendingUp,
  Target,
  PhoneCall,
  CheckCircle2,
  X,
  AlertCircle,
  Building2,
  ChevronRight,
  BarChart3,
  GraduationCap,
  AlertTriangle,
  Copy,
  Check
} from "lucide-react";
import { supabase } from "../../services/supabase";

const TEAMS_SQL_SCRIPT = `-- Execute this in Supabase SQL Editor to enable persistent Teams storage:
CREATE TABLE IF NOT EXISTS public.teams (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  department text DEFAULT 'Sales',
  leader_id uuid REFERENCES public.employees(id) ON DELETE SET NULL,
  target_monthly integer DEFAULT 50,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.team_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id uuid NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  employee_id uuid NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  joined_at timestamptz DEFAULT now(),
  UNIQUE (team_id, employee_id)
);

ALTER TABLE public.teams ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.team_members ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins have full access to teams" ON public.teams FOR ALL USING (public.is_admin());
CREATE POLICY "Everyone can view teams" ON public.teams FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Admins have full access to team members" ON public.team_members FOR ALL USING (public.is_admin());
CREATE POLICY "Everyone can view team members" ON public.team_members FOR SELECT USING (auth.role() = 'authenticated');
`;

interface TeamMember {
  id: string; // team_member row id
  employee_id: string;
  joined_at: string;
  employees: {
    id: string;
    full_name: string;
    employee_code: string;
    role: string;
    department: string | null;
    email: string;
    phone: string | null;
  } | null;
}

interface TeamRecord {
  id: string;
  name: string;
  department: string;
  leader_id: string | null;
  target_monthly: number;
  created_at: string;
  leader?: {
    id: string;
    full_name: string;
    employee_code: string;
    email: string;
    role: string;
  } | null;
  members: TeamMember[];
}

interface MemberPerformance {
  employeeId: string;
  name: string;
  code: string;
  role: string;
  assignedLeadsCount: number;
  callsCount: number;
  wonLeadsCount: number;
  conversionRate: number;
  ratingBadge: "Top Performer" | "On Track" | "Needs Attention";
}

interface EmployeeOption {
  id: string;
  full_name: string;
  employee_code: string;
  role: string;
  department: string | null;
}

const roleLabels: Record<string, string> = {
  intern: "Intern",
  sales_executive: "Sales Executive",
  team_leader: "Team Leader",
  admin: "Admin",
};

export default function Teams() {
  const [teams, setTeams] = useState<TeamRecord[]>([]);
  const [allEmployees, setAllEmployees] = useState<EmployeeOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const [search, setSearch] = useState("");
  const [selectedDept, setSelectedDept] = useState("All");

  // Create Team Modal State
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [createName, setCreateName] = useState("");
  const [createDept, setCreateDept] = useState("Sales");
  const [createLeaderId, setCreateLeaderId] = useState("");
  const [createTarget, setCreateTarget] = useState(50);
  const [savingCreate, setSavingCreate] = useState(false);

  // Manage Members Modal State
  const [managingTeam, setManagingTeam] = useState<TeamRecord | null>(null);
  const [selectedAddMemberId, setSelectedAddMemberId] = useState("");
  const [savingMember, setSavingMember] = useState(false);

  // View Performance Modal State
  const [performanceTeam, setPerformanceTeam] = useState<TeamRecord | null>(null);
  const [memberPerformances, setMemberPerformances] = useState<MemberPerformance[]>([]);
  const [loadingPerformance, setLoadingPerformance] = useState(false);

  // Delete Team State
  const [deletingTeam, setDeletingTeam] = useState<TeamRecord | null>(null);
  const [deletingSaving, setDeletingSaving] = useState(false);

  // Schema state
  const [needsMigration, setNeedsMigration] = useState(false);
  const [copiedSql, setCopiedSql] = useState(false);

  async function loadTeamsData() {
    setLoading(true);
    setError("");

    try {
      // 1. Fetch all employees for selection
      const { data: empData, error: empErr } = await supabase
        .from("employees")
        .select("id, full_name, employee_code, role, department")
        .eq("employment_status", "active")
        .order("full_name", { ascending: true });

      if (empErr) throw new Error(empErr.message);
      setAllEmployees((empData as EmployeeOption[]) || []);

      // 2. Fetch teams
      const { data: teamsData, error: teamsErr } = await supabase
        .from("teams")
        .select("*")
        .order("created_at", { ascending: false });

      if (teamsErr) {
        if (
          teamsErr.message.includes("schema cache") ||
          teamsErr.message.includes("does not exist") ||
          teamsErr.message.includes("relation")
        ) {
          setNeedsMigration(true);
          const cached = localStorage.getItem("crm_local_teams");
          if (cached) {
            try {
              setTeams(JSON.parse(cached));
            } catch {}
          }
          return;
        }
        throw new Error(teamsErr.message);
      }

      setNeedsMigration(false);

      // 3. Fetch team members with employees joined
      const { data: membersData, error: membersErr } = await supabase
        .from("team_members")
        .select(`
          id,
          team_id,
          employee_id,
          joined_at,
          employees (
            id,
            full_name,
            employee_code,
            role,
            department,
            email,
            phone
          )
        `);

      if (membersErr) throw new Error(membersErr.message);

      const empMap = new Map((empData || []).map((e) => [e.id, e]));

      const structuredTeams: TeamRecord[] = (teamsData || []).map((t) => {
        const teamMems: TeamMember[] = (membersData || [])
          .filter((m: any) => m.team_id === t.id)
          .map((m: any) => ({
            id: m.id,
            employee_id: m.employee_id,
            joined_at: m.joined_at,
            employees: Array.isArray(m.employees) ? (m.employees[0] || null) : (m.employees || null),
          }));

        const leader = t.leader_id ? empMap.get(t.leader_id) : null;

        return {
          id: t.id,
          name: t.name,
          department: t.department || "Sales",
          leader_id: t.leader_id,
          target_monthly: t.target_monthly || 50,
          created_at: t.created_at,
          leader: leader
            ? {
                id: leader.id,
                full_name: leader.full_name,
                employee_code: leader.employee_code,
                email: "",
                role: leader.role,
              }
            : null,
          members: teamMems,
        };
      });

      setTeams(structuredTeams);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load teams.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadTeamsData();
  }, []);

  // Filtered teams list
  const filteredTeams = useMemo(() => {
    return teams.filter((t) => {
      const q = search.trim().toLowerCase();
      const matchesSearch =
        q === "" ||
        t.name.toLowerCase().includes(q) ||
        (t.leader?.full_name && t.leader.full_name.toLowerCase().includes(q)) ||
        t.department.toLowerCase().includes(q);

      const matchesDept =
        selectedDept === "All" ||
        t.department.toLowerCase() === selectedDept.toLowerCase();

      return matchesSearch && matchesDept;
    });
  }, [teams, search, selectedDept]);

  // Create Team
  async function handleCreateTeam(e: FormEvent) {
    e.preventDefault();
    if (!createName.trim()) return;

    setSavingCreate(true);
    setError("");
    setSuccess("");

    try {
      if (needsMigration) {
        const leader = createLeaderId
          ? allEmployees.find((e) => e.id === createLeaderId)
          : null;

        const newTeamObj: TeamRecord = {
          id: `team-${Date.now()}`,
          name: createName.trim(),
          department: createDept,
          leader_id: createLeaderId || null,
          target_monthly: Number(createTarget) || 50,
          created_at: new Date().toISOString(),
          leader: leader
            ? {
                id: leader.id,
                full_name: leader.full_name,
                employee_code: leader.employee_code,
                email: "",
                role: leader.role,
              }
            : null,
          members: leader
            ? [
                {
                  id: `mem-${Date.now()}`,
                  employee_id: leader.id,
                  joined_at: new Date().toISOString(),
                  employees: {
                    id: leader.id,
                    full_name: leader.full_name,
                    employee_code: leader.employee_code,
                    role: leader.role,
                    department: leader.department,
                    email: "",
                    phone: null,
                  },
                },
              ]
            : [],
        };

        const updated = [newTeamObj, ...teams];
        setTeams(updated);
        localStorage.setItem("crm_local_teams", JSON.stringify(updated));
        setSuccess(`Team "${createName.trim()}" created successfully.`);
        setShowCreateModal(false);
        setCreateName("");
        setCreateLeaderId("");
        setCreateTarget(50);
        return;
      }

      const { data: newTeam, error: insertErr } = await supabase
        .from("teams")
        .insert({
          name: createName.trim(),
          department: createDept,
          leader_id: createLeaderId || null,
          target_monthly: Number(createTarget) || 50,
        })
        .select()
        .single();

      if (insertErr) throw new Error(insertErr.message);

      // If a leader was selected, automatically add them to team_members
      if (createLeaderId && newTeam?.id) {
        await supabase.from("team_members").insert({
          team_id: newTeam.id,
          employee_id: createLeaderId,
        });
      }

      setSuccess(`Team "${createName.trim()}" created successfully.`);
      setShowCreateModal(false);
      setCreateName("");
      setCreateLeaderId("");
      setCreateTarget(50);
      await loadTeamsData();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create team.");
    } finally {
      setSavingCreate(false);
    }
  }

  // Add Member to Team
  async function handleAddMember(e: FormEvent) {
    e.preventDefault();
    if (!managingTeam || !selectedAddMemberId) return;

    setSavingMember(true);
    setError("");
    setSuccess("");

    try {
      if (needsMigration) {
        const empToAdd = allEmployees.find((e) => e.id === selectedAddMemberId);
        if (!empToAdd) return;
        const newMem: TeamMember = {
          id: `mem-${Date.now()}`,
          employee_id: empToAdd.id,
          joined_at: new Date().toISOString(),
          employees: {
            id: empToAdd.id,
            full_name: empToAdd.full_name,
            employee_code: empToAdd.employee_code,
            role: empToAdd.role,
            department: empToAdd.department,
            email: "",
            phone: null,
          },
        };
        const updatedMems = [...managingTeam.members, newMem];
        const updatedTeam = { ...managingTeam, members: updatedMems };
        setManagingTeam(updatedTeam);
        const updatedTeams = teams.map((t) => (t.id === managingTeam.id ? updatedTeam : t));
        setTeams(updatedTeams);
        localStorage.setItem("crm_local_teams", JSON.stringify(updatedTeams));
        setSuccess("Member added to team.");
        setSelectedAddMemberId("");
        return;
      }

      const { error: addErr } = await supabase.from("team_members").insert({
        team_id: managingTeam.id,
        employee_id: selectedAddMemberId,
      });

      if (addErr) throw new Error(addErr.message);

      setSuccess("Member added to team successfully.");
      setSelectedAddMemberId("");

      // Refresh managing team locally and reload overall
      await loadTeamsData();

      // Update active modal's team reference
      const updatedTeams = await supabase
        .from("team_members")
        .select(`
          id,
          team_id,
          employee_id,
          joined_at,
          employees (
            id,
            full_name,
            employee_code,
            role,
            department,
            email,
            phone
          )
        `)
        .eq("team_id", managingTeam.id);

      if (updatedTeams.data) {
        const normalizedMems: TeamMember[] = (updatedTeams.data as any[]).map((m: any) => ({
          id: m.id,
          employee_id: m.employee_id,
          joined_at: m.joined_at,
          employees: Array.isArray(m.employees) ? (m.employees[0] || null) : (m.employees || null),
        }));
        setManagingTeam((prev) =>
          prev
            ? {
                ...prev,
                members: normalizedMems,
              }
            : null
        );
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to add member.");
    } finally {
      setSavingMember(false);
    }
  }

  // Remove Member from Team
  async function handleRemoveMember(teamMemberId: string) {
    if (!managingTeam) return;

    setSavingMember(true);
    setError("");

    try {
      if (needsMigration) {
        const updatedMems = managingTeam.members.filter((m) => m.id !== teamMemberId);
        const updatedTeam = { ...managingTeam, members: updatedMems };
        setManagingTeam(updatedTeam);
        const updatedTeams = teams.map((t) => (t.id === managingTeam.id ? updatedTeam : t));
        setTeams(updatedTeams);
        localStorage.setItem("crm_local_teams", JSON.stringify(updatedTeams));
        setSuccess("Member removed from team.");
        return;
      }

      const { error: delErr } = await supabase
        .from("team_members")
        .delete()
        .eq("id", teamMemberId);

      if (delErr) throw new Error(delErr.message);

      setSuccess("Member removed from team.");
      setManagingTeam((prev) =>
        prev
          ? {
              ...prev,
              members: prev.members.filter((m) => m.id !== teamMemberId),
            }
          : null
      );
      await loadTeamsData();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to remove member.");
    } finally {
      setSavingMember(false);
    }
  }

  // View Performance - Individual Member Breakdown
  async function openPerformanceModal(team: TeamRecord) {
    setPerformanceTeam(team);
    setLoadingPerformance(true);
    setMemberPerformances([]);

    try {
      const memberIds = team.members.map((m) => m.employee_id);

      if (memberIds.length === 0) {
        setLoadingPerformance(false);
        return;
      }

      // 1. Fetch leads assigned to these members
      const { data: leadsData } = await supabase
        .from("leads")
        .select("id, assigned_to, stage")
        .in("assigned_to", memberIds);

      // 2. Fetch calls logged by these members
      const { data: callsData } = await supabase
        .from("calls")
        .select("id, employee_id")
        .in("employee_id", memberIds);

      const leads = leadsData || [];
      const calls = callsData || [];

      // Compute individual breakdown
      const breakdown: MemberPerformance[] = team.members.map((m) => {
        const emp = m.employees;
        const empId = m.employee_id;

        const empLeads = leads.filter((l) => l.assigned_to === empId);
        const assignedCount = empLeads.length;
        const wonCount = empLeads.filter((l) => l.stage === "Won" || l.stage === "Proposal").length;
        const empCalls = calls.filter((c) => c.employee_id === empId).length;

        const convRate = assignedCount > 0 ? Math.round((wonCount / assignedCount) * 100) : 0;

        let badge: MemberPerformance["ratingBadge"] = "On Track";
        if (convRate >= 30 || wonCount >= 5) {
          badge = "Top Performer";
        } else if (assignedCount > 5 && convRate < 10) {
          badge = "Needs Attention";
        }

        return {
          employeeId: empId,
          name: emp?.full_name || "Employee",
          code: emp?.employee_code || "EMP",
          role: emp?.role || "sales_executive",
          assignedLeadsCount: assignedCount,
          callsCount: empCalls,
          wonLeadsCount: wonCount,
          conversionRate: convRate,
          ratingBadge: badge,
        };
      });

      // Sort by won leads and conversion rate descending
      breakdown.sort((a, b) => b.wonLeadsCount - a.wonLeadsCount || b.conversionRate - a.conversionRate);
      setMemberPerformances(breakdown);
    } catch (err) {
      console.warn("Could not compute team performance:", err);
    } finally {
      setLoadingPerformance(false);
    }
  }

  // Delete Team
  async function handleDeleteTeam() {
    if (!deletingTeam) return;

    setDeletingSaving(true);
    setError("");

    try {
      if (needsMigration) {
        const updatedTeams = teams.filter((t) => t.id !== deletingTeam.id);
        setTeams(updatedTeams);
        localStorage.setItem("crm_local_teams", JSON.stringify(updatedTeams));
        setSuccess(`Team "${deletingTeam.name}" deleted.`);
        setDeletingTeam(null);
        return;
      }

      const { error: delErr } = await supabase
        .from("teams")
        .delete()
        .eq("id", deletingTeam.id);

      if (delErr) throw new Error(delErr.message);

      setSuccess(`Team "${deletingTeam.name}" deleted successfully.`);
      setDeletingTeam(null);
      await loadTeamsData();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete team.");
    } finally {
      setDeletingSaving(false);
    }
  }

  const totalMembers = teams.reduce((acc, t) => acc + t.members.length, 0);
  const assignedLeadersCount = teams.filter((t) => !!t.leader_id).length;

  return (
    <div className="space-y-6 p-6">
      {/* Page Heading */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Teams & Squads</h1>
          <p className="mt-1 text-sm text-gray-500">
            Organize sales teams, assign team leaders, and track squad and individual performance.
          </p>
        </div>
        <button
          onClick={() => {
            setError("");
            setSuccess("");
            setShowCreateModal(true);
          }}
          className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-blue-700 shadow-sm transition"
        >
          <Plus size={17} />
          Create Team
        </button>
      </div>

      {/* Summary Metrics */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium text-gray-500">Active Teams</p>
            <div className="rounded-lg bg-blue-50 p-2 text-blue-600">
              <Users size={20} />
            </div>
          </div>
          <p className="mt-3 text-3xl font-bold text-gray-900">{teams.length}</p>
          <p className="mt-1 text-xs text-gray-400">Total verified team squads</p>
        </div>

        <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium text-gray-500">Assigned Team Leaders</p>
            <div className="rounded-lg bg-emerald-50 p-2 text-emerald-600">
              <Shield size={20} />
            </div>
          </div>
          <p className="mt-3 text-3xl font-bold text-gray-900">{assignedLeadersCount}</p>
          <p className="mt-1 text-xs text-gray-400">Squads with active leaders</p>
        </div>

        <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium text-gray-500">Total Squad Members</p>
            <div className="rounded-lg bg-violet-50 p-2 text-violet-600">
              <Award size={20} />
            </div>
          </div>
          <p className="mt-3 text-3xl font-bold text-gray-900">{totalMembers}</p>
          <p className="mt-1 text-xs text-gray-400">Interns & staff across all teams</p>
        </div>
      </div>

      {/* Alerts */}
      {success && (
        <div className="rounded-lg bg-green-50 p-3 text-sm text-green-700">
          {success}
        </div>
      )}
      {error && !showCreateModal && !managingTeam && (
        <div className="rounded-lg bg-red-50 p-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* Schema Notice Banner if database table needs to be created in Supabase */}
      {needsMigration && (
        <div className="rounded-xl border border-amber-300 bg-amber-50 p-4 text-xs text-amber-900 shadow-sm space-y-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2 font-bold text-sm text-amber-900">
              <AlertTriangle size={18} className="text-amber-600" />
              <span>One-Time Supabase Database Setup Required for Teams</span>
            </div>
            <button
              type="button"
              onClick={() => {
                navigator.clipboard.writeText(TEAMS_SQL_SCRIPT);
                setCopiedSql(true);
                setTimeout(() => setCopiedSql(false), 2500);
              }}
              className="flex items-center gap-1.5 rounded-lg bg-amber-600 px-3 py-1.5 font-semibold text-white hover:bg-amber-700 transition shadow-sm"
            >
              {copiedSql ? <Check size={14} /> : <Copy size={14} />}
              <span>{copiedSql ? "Copied SQL to Clipboard!" : "Copy SQL for Supabase"}</span>
            </button>
          </div>
          <p className="text-amber-800">
            The <code>teams</code> and <code>team_members</code> tables have not been created in your Supabase project yet. Click <strong>"Copy SQL for Supabase"</strong>, open your <strong>Supabase Project → SQL Editor</strong>, paste and click <strong>Run</strong>. Teams created right now are safely saved in local storage and will sync to Supabase once created.
          </p>
        </div>
      )}

      {/* Teams Grid Container */}
      <div className="rounded-xl border border-gray-200 bg-white shadow-sm overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-gray-200 p-5 bg-gray-50/40">
          <div>
            <h2 className="font-semibold text-gray-900">
              All Existing Teams ({filteredTeams.length})
            </h2>
            <p className="mt-0.5 text-xs text-gray-500">
              Real-time squads connected to the database. No duplicate records.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-3 py-2">
              <Search size={17} className="text-gray-400" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search team or leader..."
                className="w-48 text-sm outline-none"
              />
            </div>

            <select
              value={selectedDept}
              onChange={(e) => setSelectedDept(e.target.value)}
              className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm outline-none"
            >
              <option value="All">All Departments</option>
              <option value="Sales">Sales</option>
              <option value="Marketing">Marketing</option>
              <option value="Operations">Operations</option>
              <option value="Development">Development</option>
              <option value="Support">Support</option>
            </select>

            <button
              onClick={loadTeamsData}
              title="Refresh teams"
              className="rounded-lg border border-gray-200 bg-white p-2 text-gray-600 hover:bg-gray-50 transition"
            >
              <RefreshCw size={17} className={loading ? "animate-spin text-blue-600" : ""} />
            </button>
          </div>
        </div>

        <div className="p-5">
          {loading ? (
            <div className="py-16 text-center text-sm text-gray-500">
              Loading teams and squad members from database...
            </div>
          ) : filteredTeams.length === 0 ? (
            <div className="py-16 text-center">
              <Users size={36} className="mx-auto text-gray-300" />
              <h3 className="mt-3 text-sm font-semibold text-gray-900">No teams found</h3>
              <p className="mt-1 text-xs text-gray-500">
                {search || selectedDept !== "All"
                  ? "No teams match your current filters."
                  : "Click 'Create Team' to register your first team squad."}
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
              {filteredTeams.map((team) => (
                <div
                  key={team.id}
                  className="rounded-xl border border-gray-200 bg-white p-5 hover:border-blue-400 hover:shadow-md transition flex flex-col justify-between"
                >
                  <div>
                    {/* Header */}
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <h3 className="text-base font-bold text-gray-900">{team.name}</h3>
                        <span className="mt-1 inline-block rounded-full bg-blue-50 px-2.5 py-0.5 text-xs font-semibold text-blue-700">
                          {team.department}
                        </span>
                      </div>
                      <button
                        onClick={() => setDeletingTeam(team)}
                        className="text-gray-400 hover:text-rose-600 p-1 rounded-md transition"
                        title="Delete Team"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>

                    {/* Team Leader Info */}
                    <div className="mt-4 rounded-lg border border-gray-100 bg-gray-50/70 p-3">
                      <div className="flex items-center gap-2 text-xs text-gray-500">
                        <Shield size={14} className="text-amber-600" />
                        <span className="font-semibold text-gray-700">Team Leader:</span>
                      </div>
                      {team.leader ? (
                        <p className="mt-1 text-sm font-bold text-gray-900">
                          {team.leader.full_name}{" "}
                          <span className="font-normal font-mono text-xs text-gray-500">
                            ({team.leader.employee_code})
                          </span>
                        </p>
                      ) : (
                        <p className="mt-1 text-xs italic text-amber-700">
                          No team leader assigned yet
                        </p>
                      )}
                    </div>

                    {/* Quick Stats */}
                    <div className="mt-4 grid grid-cols-2 gap-3 text-xs">
                      <div className="rounded-lg border border-gray-100 p-2 text-center bg-white">
                        <p className="text-gray-400">Total Members</p>
                        <p className="text-lg font-bold text-gray-900">{team.members.length}</p>
                      </div>
                      <div className="rounded-lg border border-gray-100 p-2 text-center bg-white">
                        <p className="text-gray-400">Monthly Target</p>
                        <p className="text-lg font-bold text-blue-600">{team.target_monthly}</p>
                      </div>
                    </div>

                    {/* Members Avatar Preview */}
                    <div className="mt-4">
                      <p className="text-[11px] font-semibold uppercase tracking-wider text-gray-400 mb-2">
                        Squad Members ({team.members.length})
                      </p>
                      {team.members.length === 0 ? (
                        <p className="text-xs text-gray-400 italic">No members assigned yet.</p>
                      ) : (
                        <div className="flex flex-wrap gap-1.5">
                          {team.members.slice(0, 5).map((m) => (
                            <span
                              key={m.id}
                              className="inline-flex items-center gap-1 rounded-full bg-gray-100 px-2.5 py-0.5 text-xs text-gray-700 font-medium"
                              title={`${m.employees?.full_name} (${roleLabels[m.employees?.role || ""] ?? m.employees?.role})`}
                            >
                              {m.employees?.full_name || "Member"}
                            </span>
                          ))}
                          {team.members.length > 5 && (
                            <span className="inline-flex items-center rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-500 font-medium">
                              +{team.members.length - 5} more
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Action Buttons */}
                  <div className="mt-6 pt-4 border-t border-gray-100 flex items-center justify-between gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setError("");
                        setSuccess("");
                        setManagingTeam(team);
                        setSelectedAddMemberId("");
                      }}
                      className="flex-1 rounded-lg border border-gray-200 bg-white py-2 text-xs font-semibold text-gray-700 hover:bg-gray-50 hover:border-gray-300 transition text-center"
                    >
                      Manage Members
                    </button>

                    <button
                      type="button"
                      onClick={() => openPerformanceModal(team)}
                      className="flex-1 flex items-center justify-center gap-1.5 rounded-lg bg-blue-600 py-2 text-xs font-semibold text-white hover:bg-blue-700 transition text-center shadow-sm"
                    >
                      <BarChart3 size={13} />
                      View Performance
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* 1. CREATE TEAM MODAL */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-black/40 p-4">
          <div className="my-6 w-full max-w-md rounded-2xl bg-white shadow-xl">
            <div className="flex items-center justify-between border-b border-gray-200 p-5">
              <div>
                <h2 className="text-lg font-semibold text-gray-900">Create New Team</h2>
                <p className="mt-0.5 text-xs text-gray-500">
                  Establish a new sales squad, appoint leader, and set monthly target.
                </p>
              </div>
              <button
                onClick={() => setShowCreateModal(false)}
                disabled={savingCreate}
                className="rounded-lg p-2 text-gray-500 hover:bg-gray-100"
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleCreateTeam} className="p-5 space-y-4">
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">
                  Team / Squad Name
                </label>
                <input
                  required
                  type="text"
                  value={createName}
                  onChange={(e) => setCreateName(e.target.value)}
                  placeholder="e.g. Enterprise Sales Alpha"
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-blue-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700">
                    Department
                  </label>
                  <select
                    value={createDept}
                    onChange={(e) => setCreateDept(e.target.value)}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-blue-500"
                  >
                    <option value="Sales">Sales</option>
                    <option value="Marketing">Marketing</option>
                    <option value="Operations">Operations</option>
                    <option value="Development">Development</option>
                    <option value="Support">Support</option>
                  </select>
                </div>

                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700">
                    Monthly Target
                  </label>
                  <input
                    required
                    type="number"
                    min={1}
                    value={createTarget}
                    onChange={(e) => setCreateTarget(Number(e.target.value))}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-blue-500"
                  />
                </div>
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">
                  Appoint Team Leader (Optional)
                </label>
                <select
                  value={createLeaderId}
                  onChange={(e) => setCreateLeaderId(e.target.value)}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-blue-500"
                >
                  <option value="">-- No Team Leader (Assign Later) --</option>
                  <optgroup label="Registered Team Leaders">
                    {allEmployees
                      .filter((e) => e.role === "team_leader")
                      .map((e) => (
                        <option key={e.id} value={e.id}>
                          {e.full_name} ({e.employee_code}) - Team Leader
                        </option>
                      ))}
                  </optgroup>
                  <optgroup label="Other Employees">
                    {allEmployees
                      .filter((e) => e.role !== "team_leader")
                      .map((e) => (
                        <option key={e.id} value={e.id}>
                          {e.full_name} ({e.employee_code}) - {roleLabels[e.role] ?? e.role}
                        </option>
                      ))}
                  </optgroup>
                </select>
              </div>

              {error && (
                <p className="rounded-lg bg-red-50 p-3 text-sm text-red-600">{error}</p>
              )}

              <div className="flex justify-end gap-3 border-t border-gray-100 pt-4">
                <button
                  type="button"
                  disabled={savingCreate}
                  onClick={() => setShowCreateModal(false)}
                  className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingCreate}
                  className="rounded-lg bg-blue-600 px-5 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
                >
                  {savingCreate ? "Creating Team..." : "Create Team"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 2. MANAGE MEMBERS MODAL */}
      {managingTeam && (
        <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-black/40 p-4">
          <div className="my-6 w-full max-w-2xl rounded-2xl bg-white shadow-xl">
            <div className="flex items-center justify-between border-b border-gray-200 p-5">
              <div>
                <h2 className="text-lg font-bold text-gray-900">
                  Manage Squad Members
                </h2>
                <p className="mt-0.5 text-xs text-gray-500">
                  {managingTeam.name} • {managingTeam.department} Department
                </p>
              </div>
              <button
                onClick={() => setManagingTeam(null)}
                className="rounded-lg p-2 text-gray-500 hover:bg-gray-100"
              >
                <X size={20} />
              </button>
            </div>

            <div className="p-5 space-y-5">
              {/* Add New Member Section */}
              <form
                onSubmit={handleAddMember}
                className="rounded-xl border border-blue-100 bg-blue-50/50 p-4"
              >
                <p className="text-xs font-bold text-blue-900 mb-2 flex items-center gap-1.5">
                  <UserPlus size={15} /> Add Employee or Intern to Squad
                </p>
                <div className="flex flex-wrap sm:flex-nowrap gap-3">
                  <select
                    required
                    value={selectedAddMemberId}
                    onChange={(e) => setSelectedAddMemberId(e.target.value)}
                    className="flex-1 rounded-lg border border-gray-300 bg-white px-3 py-2 text-xs outline-none focus:border-blue-500"
                  >
                    <option value="">-- Choose employee to add --</option>
                    <optgroup label="Available Interns">
                      {allEmployees
                        .filter(
                          (e) =>
                            e.role === "intern" &&
                            !managingTeam.members.some((m) => m.employee_id === e.id)
                        )
                        .map((e) => (
                          <option key={e.id} value={e.id}>
                            {e.full_name} ({e.employee_code}) - Intern
                          </option>
                        ))}
                    </optgroup>
                    <optgroup label="Available Sales Executives & Staff">
                      {allEmployees
                        .filter(
                          (e) =>
                            e.role !== "intern" &&
                            !managingTeam.members.some((m) => m.employee_id === e.id)
                        )
                        .map((e) => (
                          <option key={e.id} value={e.id}>
                            {e.full_name} ({e.employee_code}) - {roleLabels[e.role] ?? e.role}
                          </option>
                        ))}
                    </optgroup>
                  </select>

                  <button
                    type="submit"
                    disabled={savingMember || !selectedAddMemberId}
                    className="rounded-lg bg-blue-600 px-4 py-2 text-xs font-semibold text-white hover:bg-blue-700 disabled:opacity-50 transition shadow-sm shrink-0"
                  >
                    {savingMember ? "Adding..." : "Add to Team"}
                  </button>
                </div>
              </form>

              {/* Members List */}
              <div>
                <p className="text-xs font-bold uppercase tracking-wider text-gray-500 mb-3">
                  Current Squad Roster ({managingTeam.members.length})
                </p>

                {managingTeam.members.length === 0 ? (
                  <div className="rounded-xl border border-gray-200 p-8 text-center text-xs text-gray-500">
                    No members in this team yet. Use the dropdown above to add interns and representatives.
                  </div>
                ) : (
                  <div className="divide-y divide-gray-100 rounded-xl border border-gray-200 overflow-hidden">
                    {managingTeam.members.map((m) => (
                      <div
                        key={m.id}
                        className="flex items-center justify-between p-3.5 hover:bg-gray-50/60 transition"
                      >
                        <div className="flex items-center gap-3">
                          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-100 text-xs font-bold text-blue-700">
                            {m.employees?.full_name ? m.employees.full_name.charAt(0).toUpperCase() : "E"}
                          </div>
                          <div>
                            <p className="text-sm font-semibold text-gray-900">
                              {m.employees?.full_name || "Employee"}
                              {managingTeam.leader_id === m.employee_id && (
                                <span className="ml-2 rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-bold text-amber-700">
                                  Leader
                                </span>
                              )}
                            </p>
                            <p className="text-xs text-gray-400 font-mono">
                              {m.employees?.employee_code || "EMP"} • {m.employees?.email || ""}
                            </p>
                          </div>
                        </div>

                        <div className="flex items-center gap-3">
                          <span
                            className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                              m.employees?.role === "intern"
                                ? "bg-violet-50 text-violet-700"
                                : m.employees?.role === "team_leader"
                                  ? "bg-amber-50 text-amber-700"
                                  : "bg-blue-50 text-blue-700"
                            }`}
                          >
                            {roleLabels[m.employees?.role || ""] ?? m.employees?.role}
                          </span>

                          <button
                            type="button"
                            disabled={savingMember}
                            onClick={() => handleRemoveMember(m.id)}
                            className="rounded p-1 text-gray-400 hover:text-rose-600 transition disabled:opacity-50"
                            title="Remove from squad"
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {error && (
                <p className="rounded-lg bg-red-50 p-3 text-sm text-red-600">{error}</p>
              )}

              <div className="flex justify-end pt-2">
                <button
                  type="button"
                  onClick={() => setManagingTeam(null)}
                  className="rounded-lg border border-gray-300 px-4 py-2 text-xs font-semibold text-gray-700 hover:bg-gray-50"
                >
                  Done
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 3. VIEW PERFORMANCE MODAL (With Individual Employee Breakdown) */}
      {performanceTeam && (
        <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-black/40 p-4">
          <div className="my-6 w-full max-w-4xl rounded-2xl bg-white shadow-xl max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between border-b border-gray-200 p-5 shrink-0">
              <div className="flex items-center gap-3">
                <div className="rounded-lg bg-blue-100 p-2 text-blue-700">
                  <BarChart3 size={20} />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-gray-900">
                    Squad Performance Analytics
                  </h2>
                  <p className="mt-0.5 text-xs text-gray-500">
                    {performanceTeam.name} • Monthly Target: {performanceTeam.target_monthly} deals
                  </p>
                </div>
              </div>
              <button
                onClick={() => setPerformanceTeam(null)}
                className="rounded-lg p-2 text-gray-500 hover:bg-gray-100"
              >
                <X size={20} />
              </button>
            </div>

            <div className="p-6 overflow-y-auto space-y-6">
              {/* Overall Squad Summary */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                <div className="rounded-xl border border-gray-200 p-4 bg-gray-50/50">
                  <p className="text-xs text-gray-500">Squad Members</p>
                  <p className="mt-1 text-2xl font-bold text-gray-900">
                    {performanceTeam.members.length}
                  </p>
                </div>
                <div className="rounded-xl border border-gray-200 p-4 bg-gray-50/50">
                  <p className="text-xs text-gray-500">Total Leads Assigned</p>
                  <p className="mt-1 text-2xl font-bold text-blue-600">
                    {memberPerformances.reduce((acc, m) => acc + m.assignedLeadsCount, 0)}
                  </p>
                </div>
                <div className="rounded-xl border border-gray-200 p-4 bg-gray-50/50">
                  <p className="text-xs text-gray-500">Calls Logged</p>
                  <p className="mt-1 text-2xl font-bold text-gray-900">
                    {memberPerformances.reduce((acc, m) => acc + m.callsCount, 0)}
                  </p>
                </div>
                <div className="rounded-xl border border-gray-200 p-4 bg-gray-50/50">
                  <p className="text-xs text-gray-500">Won / Converted</p>
                  <p className="mt-1 text-2xl font-bold text-emerald-600">
                    {memberPerformances.reduce((acc, m) => acc + m.wonLeadsCount, 0)}
                  </p>
                </div>
              </div>

              {/* Individual Employee Performance Breakdown */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <h3 className="text-sm font-bold text-gray-900">
                      Individual Team Member Performance
                    </h3>
                    <p className="text-xs text-gray-500">
                      Specific conversion metrics, call activity, and progress for each member
                    </p>
                  </div>
                  <span className="rounded-full bg-blue-50 px-2.5 py-0.5 text-xs font-semibold text-blue-700">
                    {memberPerformances.length} Members Tracked
                  </span>
                </div>

                {loadingPerformance ? (
                  <div className="py-12 text-center text-xs text-gray-500">
                    Computing performance metrics across CRM leads and calls...
                  </div>
                ) : memberPerformances.length === 0 ? (
                  <div className="rounded-xl border border-gray-200 p-8 text-center text-xs text-gray-400">
                    No members currently assigned to this squad.
                  </div>
                ) : (
                  <div className="rounded-xl border border-gray-200 overflow-hidden shadow-sm">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-gray-50 text-[11px] uppercase tracking-wider text-gray-500">
                        <tr>
                          <th className="px-4 py-3">Member</th>
                          <th className="px-4 py-3">Category</th>
                          <th className="px-4 py-3 text-center">Assigned Leads</th>
                          <th className="px-4 py-3 text-center">Calls Made</th>
                          <th className="px-4 py-3 text-center">Won / Closed</th>
                          <th className="px-4 py-3 text-center">Conversion %</th>
                          <th className="px-4 py-3 text-center">Rating</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {memberPerformances.map((mp) => (
                          <tr key={mp.employeeId} className="hover:bg-gray-50/70 transition">
                            <td className="px-4 py-3">
                              <p className="font-bold text-gray-900">{mp.name}</p>
                              <p className="font-mono text-[10px] text-gray-400">{mp.code}</p>
                            </td>

                            <td className="px-4 py-3">
                              <span
                                className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                                  mp.role === "intern"
                                    ? "bg-violet-50 text-violet-700"
                                    : mp.role === "team_leader"
                                      ? "bg-amber-50 text-amber-700"
                                      : "bg-blue-50 text-blue-700"
                                }`}
                              >
                                {roleLabels[mp.role] ?? mp.role}
                              </span>
                            </td>

                            <td className="px-4 py-3 text-center font-semibold text-gray-700">
                              {mp.assignedLeadsCount}
                            </td>

                            <td className="px-4 py-3 text-center text-gray-600">
                              {mp.callsCount}
                            </td>

                            <td className="px-4 py-3 text-center font-bold text-emerald-600">
                              {mp.wonLeadsCount}
                            </td>

                            <td className="px-4 py-3 text-center">
                              <span className="font-bold text-gray-900">{mp.conversionRate}%</span>
                            </td>

                            <td className="px-4 py-3 text-center">
                              <span
                                className={`rounded-full px-2.5 py-0.5 text-[10px] font-bold ${
                                  mp.ratingBadge === "Top Performer"
                                    ? "bg-emerald-100 text-emerald-800"
                                    : mp.ratingBadge === "On Track"
                                      ? "bg-blue-100 text-blue-800"
                                      : "bg-amber-100 text-amber-800"
                                }`}
                              >
                                {mp.ratingBadge}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>

            <div className="p-4 border-t border-gray-100 flex justify-end shrink-0">
              <button
                type="button"
                onClick={() => setPerformanceTeam(null)}
                className="rounded-lg bg-gray-100 px-5 py-2 text-xs font-semibold text-gray-700 hover:bg-gray-200 transition"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 4. DELETE TEAM MODAL */}
      {deletingTeam && (
        <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-black/40 p-4">
          <div className="my-6 w-full max-w-md rounded-2xl bg-white shadow-xl p-5 space-y-4">
            <div className="flex items-center gap-3">
              <div className="rounded-full bg-rose-100 p-2 text-rose-600">
                <AlertCircle size={22} />
              </div>
              <div>
                <h3 className="text-base font-bold text-gray-900">Delete Team</h3>
                <p className="text-xs text-gray-500">Confirm deletion of squad</p>
              </div>
            </div>

            <p className="text-xs text-gray-600">
              Are you sure you want to delete team <strong>"{deletingTeam.name}"</strong>? Squad member associations will be cleared, but individual employee records and leads will remain intact.
            </p>

            <div className="flex justify-end gap-3 pt-2">
              <button
                type="button"
                disabled={deletingSaving}
                onClick={() => setDeletingTeam(null)}
                className="rounded-lg border border-gray-300 px-4 py-2 text-xs font-medium text-gray-700 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={deletingSaving}
                onClick={handleDeleteTeam}
                className="rounded-lg bg-rose-600 px-4 py-2 text-xs font-medium text-white hover:bg-rose-700 disabled:opacity-50 shadow-sm"
              >
                {deletingSaving ? "Deleting..." : "Delete Team"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
