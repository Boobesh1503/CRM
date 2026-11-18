import { useState, useEffect, useMemo } from "react";
import {
  FolderKanban,
  Plus,
  Search,
  Calendar,
  Users,
  CheckCircle2,
  Clock,
  IndianRupee,
  Edit2,
  Trash2,
  X,
  Check,
  AlertCircle,
  Copy,
  RefreshCw,
  TrendingUp,
  FileText,
  User,
  Shield,
  GraduationCap
} from "lucide-react";
import { supabase } from "../../services/supabase";

const PROJECTS_TABLE_SQL = `-- SQL Script for Supabase SQL Editor
CREATE TABLE IF NOT EXISTS public.projects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  client text NOT NULL,
  status text NOT NULL DEFAULT 'Planning' CHECK (status IN ('Planning', 'In Progress', 'Review', 'Completed', 'On Hold')),
  budget numeric(12,2) DEFAULT 0,
  deadline date,
  progress integer DEFAULT 0 CHECK (progress BETWEEN 0 AND 100),
  description text,
  assigned_leader text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins have full access to projects" ON public.projects FOR ALL USING (public.is_admin());
CREATE POLICY "Everyone can view projects" ON public.projects FOR SELECT USING (auth.role() = 'authenticated');
`;

export interface ProjectRecord {
  id: string;
  name: string;
  client: string;
  status: "Planning" | "In Progress" | "Review" | "Completed" | "On Hold";
  budget: number;
  deadline?: string;
  progress: number;
  description?: string;
  assigned_leader?: string;
  created_at?: string;
}

const LOCAL_STORAGE_KEY = "crm_admin_projects_cache";

const statusStyles: Record<ProjectRecord["status"], { bg: string; text: string; border: string }> = {
  "Planning": { bg: "bg-purple-50", text: "text-purple-700", border: "border-purple-200" },
  "In Progress": { bg: "bg-blue-50", text: "text-blue-700", border: "border-blue-200" },
  "Review": { bg: "bg-amber-50", text: "text-amber-700", border: "border-amber-200" },
  "Completed": { bg: "bg-emerald-50", text: "text-emerald-700", border: "border-emerald-200" },
  "On Hold": { bg: "bg-gray-100", text: "text-gray-700", border: "border-gray-200" },
};

export default function Projects() {
  const [projects, setProjects] = useState<ProjectRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [dbTableMissing, setDbTableMissing] = useState(false);
  const [copiedSql, setCopiedSql] = useState(false);
  const [successMsg, setSuccessMsg] = useState("");
  const [errorMsg, setErrorMsg] = useState("");

  // Filters
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("All");

  // Create / Edit Modal State
  const [modalMode, setModalMode] = useState<"create" | "edit" | null>(null);
  const [activeProjectId, setActiveProjectId] = useState<string | null>(null);
  const [formName, setFormName] = useState("");
  const [formClient, setFormClient] = useState("");
  const [formStatus, setFormStatus] = useState<ProjectRecord["status"]>("In Progress");
  const [formBudget, setFormBudget] = useState<number>(0);
  const [formDeadline, setFormDeadline] = useState("");
  const [formProgress, setFormProgress] = useState<number>(0);
  const [formDescription, setFormDescription] = useState("");
  const [formLeader, setFormLeader] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // Available Staff for assignment
  const [staffOptions, setStaffOptions] = useState<{ id: string; name: string; role: string }[]>([]);

  // Load Projects
  async function loadProjects() {
    setLoading(true);
    setErrorMsg("");
    setDbTableMissing(false);

    try {
      // 1. Fetch staff for assignment dropdown
      const { data: staffData } = await supabase
        .from("employees")
        .select("id, full_name, role")
        .eq("employment_status", "active")
        .order("full_name");

      if (staffData) {
        setStaffOptions(staffData.map((s) => ({ id: s.id, name: s.full_name, role: s.role })));
      }

      // 2. Fetch projects from Supabase
      const { data, error } = await supabase
        .from("projects")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) {
        if (error.code === "PGRST205" || error.message.includes("does not exist") || error.message.includes("schema cache")) {
          setDbTableMissing(true);
        }
        // Fallback to local storage
        const cached = localStorage.getItem(LOCAL_STORAGE_KEY);
        if (cached) {
          try {
            setProjects(JSON.parse(cached));
          } catch {
            setProjects([]);
          }
        } else {
          setProjects([]);
        }
      } else {
        const list = (data || []) as ProjectRecord[];
        setProjects(list);
        localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(list));
      }
    } catch {
      const cached = localStorage.getItem(LOCAL_STORAGE_KEY);
      if (cached) {
        try {
          setProjects(JSON.parse(cached));
        } catch {
          setProjects([]);
        }
      }
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadProjects();
  }, []);

  // Open Create Modal
  function handleOpenCreate() {
    setModalMode("create");
    setActiveProjectId(null);
    setFormName("");
    setFormClient("");
    setFormStatus("In Progress");
    setFormBudget(50000);
    setFormDeadline(new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split("T")[0]);
    setFormProgress(10);
    setFormDescription("");
    setFormLeader(staffOptions[0]?.name || "");
  }

  // Open Edit Modal
  function handleOpenEdit(prj: ProjectRecord) {
    setModalMode("edit");
    setActiveProjectId(prj.id);
    setFormName(prj.name);
    setFormClient(prj.client);
    setFormStatus(prj.status);
    setFormBudget(Number(prj.budget) || 0);
    setFormDeadline(prj.deadline || "");
    setFormProgress(Number(prj.progress) || 0);
    setFormDescription(prj.description || "");
    setFormLeader(prj.assigned_leader || "");
  }

  // Submit Modal (Create or Update)
  async function handleSubmitProject(e: React.FormEvent) {
    e.preventDefault();
    if (!formName.trim() || !formClient.trim()) {
      setErrorMsg("Project name and client name are required.");
      return;
    }

    setSubmitting(true);
    setErrorMsg("");

    const projectPayload = {
      name: formName.trim(),
      client: formClient.trim(),
      status: formStatus,
      budget: Number(formBudget) || 0,
      deadline: formDeadline || null,
      progress: Math.min(100, Math.max(0, Number(formProgress) || 0)),
      description: formDescription.trim() || null,
      assigned_leader: formLeader.trim() || null,
      updated_at: new Date().toISOString(),
    };

    try {
      if (modalMode === "create") {
        const { data, error } = await supabase
          .from("projects")
          .insert(projectPayload)
          .select()
          .single();

        let newPrj: ProjectRecord;
        if (error) {
          console.warn("Using local cache for project creation:", error.message);
          newPrj = {
            ...projectPayload,
            id: `prj_${Date.now()}`,
            deadline: projectPayload.deadline || undefined,
            description: projectPayload.description || undefined,
            assigned_leader: projectPayload.assigned_leader || undefined,
            created_at: new Date().toISOString(),
          };
        } else {
          newPrj = data as ProjectRecord;
        }

        const updated = [newPrj, ...projects];
        setProjects(updated);
        localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(updated));
        setSuccessMsg(`Project "${newPrj.name}" created successfully!`);
      } else if (modalMode === "edit" && activeProjectId) {
        const { error } = await supabase
          .from("projects")
          .update(projectPayload)
          .eq("id", activeProjectId);

        if (error) {
          console.warn("Using local cache for project edit:", error.message);
        }

        const updated = projects.map((p) =>
          p.id === activeProjectId
            ? {
                ...p,
                ...projectPayload,
                deadline: projectPayload.deadline || undefined,
                description: projectPayload.description || undefined,
                assigned_leader: projectPayload.assigned_leader || undefined,
              }
            : p
        );
        setProjects(updated);
        localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(updated));
        setSuccessMsg(`Project updated successfully.`);
      }

      setModalMode(null);
      setTimeout(() => setSuccessMsg(""), 4000);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : "Failed to save project.");
    } finally {
      setSubmitting(false);
    }
  }

  // Delete Project
  async function handleDelete(id: string, name: string) {
    if (!confirm(`Are you sure you want to delete project "${name}"?`)) return;

    try {
      await supabase.from("projects").delete().eq("id", id);
      const updated = projects.filter((p) => p.id !== id);
      setProjects(updated);
      localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(updated));
      setSuccessMsg(`Project "${name}" removed.`);
      setTimeout(() => setSuccessMsg(""), 3000);
    } catch {
      setErrorMsg("Failed to delete project.");
    }
  }

  // Filtered
  const filtered = projects.filter((p) => {
    const q = search.toLowerCase();
    const matchesSearch =
      !q ||
      p.name.toLowerCase().includes(q) ||
      p.client.toLowerCase().includes(q) ||
      (p.assigned_leader && p.assigned_leader.toLowerCase().includes(q));

    const matchesStatus = statusFilter === "All" || p.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  // Totals
  const inProgressCount = projects.filter((p) => p.status === "In Progress").length;
  const completedCount = projects.filter((p) => p.status === "Completed").length;
  const totalBudget = projects.reduce((sum, p) => sum + Number(p.budget || 0), 0);

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Client Projects & Deliverables</h1>
          <p className="mt-1 text-sm text-gray-500">
            Track implementation scopes, milestones, deadlines, and project budgets for client deliveries.
          </p>
        </div>

        <button
          onClick={handleOpenCreate}
          className="flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 shadow-sm transition"
        >
          <Plus size={16} />
          Create New Project
        </button>
      </div>

      {/* SQL Setup Notice */}
      {dbTableMissing && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 shadow-sm animate-fadeIn">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-start gap-2.5">
              <AlertCircle size={20} className="text-amber-600 shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold text-amber-900 text-sm">
                  Database Table Notice: `public.projects` table not yet found in Supabase
                </p>
                <p className="mt-0.5 text-xs text-amber-700">
                  Projects are functioning in real-time with local persistence. To sync with your Supabase backend, execute the SQL in Supabase SQL Editor.
                </p>
              </div>
            </div>
            <button
              onClick={() => {
                navigator.clipboard.writeText(PROJECTS_TABLE_SQL);
                setCopiedSql(true);
                setTimeout(() => setCopiedSql(false), 3000);
              }}
              className="flex items-center gap-1.5 rounded-lg border border-amber-300 bg-white px-3 py-1.5 text-xs font-semibold text-amber-900 shadow-sm hover:bg-amber-100/50 shrink-0"
            >
              <Copy size={13} />
              {copiedSql ? "Copied SQL!" : "Copy SQL for Supabase"}
            </button>
          </div>
        </div>
      )}

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
            <p className="text-xs font-medium text-gray-500">Total Projects</p>
            <div className="rounded-lg bg-gray-100 p-2 text-gray-700">
              <FolderKanban size={18} />
            </div>
          </div>
          <p className="mt-3 text-3xl font-bold text-gray-900">{projects.length}</p>
          <span className="mt-1 block text-xs text-gray-400">All registered deliverables</span>
        </div>

        <div className="rounded-xl border border-blue-200 bg-blue-50/50 p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <p className="text-xs font-medium text-blue-800">Active Delivery</p>
            <div className="rounded-lg bg-blue-100 p-2 text-blue-700">
              <Clock size={18} />
            </div>
          </div>
          <p className="mt-3 text-3xl font-bold text-blue-600">{inProgressCount}</p>
          <span className="mt-1 block text-xs text-blue-700">In active execution</span>
        </div>

        <div className="rounded-xl border border-emerald-200 bg-emerald-50/50 p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <p className="text-xs font-medium text-emerald-800">Completed & Handed Over</p>
            <div className="rounded-lg bg-emerald-100 p-2 text-emerald-700">
              <CheckCircle2 size={18} />
            </div>
          </div>
          <p className="mt-3 text-3xl font-bold text-emerald-600">{completedCount}</p>
          <span className="mt-1 block text-xs text-emerald-700">Deliverables accomplished</span>
        </div>

        <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <p className="text-xs font-medium text-gray-500">Total Project Value</p>
            <div className="rounded-lg bg-purple-50 p-2 text-purple-600">
              <IndianRupee size={18} />
            </div>
          </div>
          <p className="mt-3 text-2xl font-bold text-gray-900">
            ₹{totalBudget.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
          </p>
          <span className="mt-1 block text-xs text-gray-400">Combined client pipeline</span>
        </div>
      </div>

      {/* Projects Directory Container */}
      <div className="rounded-xl border border-gray-200 bg-white shadow-sm overflow-hidden">
        {/* Controls */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-gray-200 p-4">
          <div className="flex flex-wrap items-center gap-1.5">
            {(["All", "In Progress", "Planning", "Review", "Completed", "On Hold"] as const).map((status) => (
              <button
                key={status}
                onClick={() => setStatusFilter(status)}
                className={`rounded-lg px-3 py-1.5 text-xs font-medium transition ${
                  statusFilter === status
                    ? "bg-blue-600 text-white shadow-sm"
                    : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                }`}
              >
                {status}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-2">
            <div className="flex items-center gap-2 rounded-lg border border-gray-200 px-3 py-1.5">
              <Search size={15} className="text-gray-400" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search project, client, leader..."
                className="w-48 text-xs outline-none"
              />
            </div>

            <button
              onClick={loadProjects}
              disabled={loading}
              className="rounded-lg border border-gray-200 p-1.5 text-gray-600 hover:bg-gray-50 transition"
              title="Refresh"
            >
              <RefreshCw size={15} className={loading ? "animate-spin text-blue-600" : ""} />
            </button>
          </div>
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-gray-600">
            <thead className="bg-gray-50 text-xs font-semibold text-gray-500 uppercase tracking-wider">
              <tr>
                <th className="px-5 py-3.5">Project & Client</th>
                <th className="px-5 py-3.5">Lead / Staff</th>
                <th className="px-5 py-3.5">Budget</th>
                <th className="px-5 py-3.5 w-44">Progress</th>
                <th className="px-5 py-3.5">Deadline</th>
                <th className="px-5 py-3.5">Status</th>
                <th className="px-5 py-3.5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-sm text-gray-500">
                    <RefreshCw size={24} className="mx-auto mb-2 animate-spin text-blue-600" />
                    Loading client projects...
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center">
                    <FolderKanban size={36} className="mx-auto mb-3 text-gray-300" />
                    <p className="text-sm font-medium text-gray-700">No project records found</p>
                    <p className="mt-1 text-xs text-gray-400">
                      Click "Create New Project" to register your first client project.
                    </p>
                  </td>
                </tr>
              ) : (
                filtered.map((prj) => {
                  const style = statusStyles[prj.status] || statusStyles["Planning"];
                  return (
                    <tr key={prj.id} className="hover:bg-gray-50/70 transition">
                      <td className="px-5 py-4">
                        <div>
                          <p className="font-semibold text-gray-900">{prj.name}</p>
                          <p className="text-xs text-gray-500">{prj.client}</p>
                        </div>
                      </td>

                      <td className="px-5 py-4">
                        <span className="inline-flex items-center gap-1 text-xs font-medium text-gray-700">
                          <User size={13} className="text-gray-400" />
                          {prj.assigned_leader || "Unassigned"}
                        </span>
                      </td>

                      <td className="px-5 py-4 font-semibold text-gray-900 text-xs">
                        ₹{Number(prj.budget).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                      </td>

                      <td className="px-5 py-4">
                        <div className="w-full">
                          <div className="flex items-center justify-between text-xs mb-1">
                            <span className="text-gray-500 font-medium">{prj.progress}%</span>
                          </div>
                          <div className="h-2 w-full rounded-full bg-gray-100 overflow-hidden">
                            <div
                              className={`h-full rounded-full transition-all ${
                                prj.progress === 100
                                  ? "bg-emerald-500"
                                  : prj.progress > 50
                                  ? "bg-blue-600"
                                  : "bg-amber-500"
                              }`}
                              style={{ width: `${prj.progress}%` }}
                            />
                          </div>
                        </div>
                      </td>

                      <td className="px-5 py-4 text-xs font-medium text-gray-700">
                        {prj.deadline || "No deadline"}
                      </td>

                      <td className="px-5 py-4">
                        <span
                          className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold border ${style.bg} ${style.text} ${style.border}`}
                        >
                          {prj.status}
                        </span>
                      </td>

                      <td className="px-5 py-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => handleOpenEdit(prj)}
                            className="rounded-lg border border-gray-200 p-1.5 text-gray-600 hover:bg-gray-100 hover:text-gray-900 transition"
                            title="Edit Project"
                          >
                            <Edit2 size={14} />
                          </button>
                          <button
                            onClick={() => handleDelete(prj.id, prj.name)}
                            className="rounded-lg border border-gray-200 p-1.5 text-gray-400 hover:text-rose-600 hover:bg-rose-50 transition"
                            title="Delete Project"
                          >
                            <Trash2 size={14} />
                          </button>
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

      {/* Create / Edit Project Modal */}
      {modalMode && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm animate-fadeIn">
          <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-gray-100">
              <div className="flex items-center gap-2 text-blue-600">
                <FolderKanban size={20} />
                <h3 className="font-semibold text-gray-900">
                  {modalMode === "create" ? "Create New Client Project" : "Edit Project Details"}
                </h3>
              </div>
              <button
                onClick={() => setModalMode(null)}
                className="rounded-lg p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSubmitProject} className="space-y-3.5 text-xs">
              <div>
                <label className="block font-medium text-gray-700 mb-1">
                  Project Title <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  placeholder="e.g. Enterprise CRM Integration"
                  className="w-full rounded-lg border border-gray-200 p-2.5 outline-none focus:border-blue-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-medium text-gray-700 mb-1">
                    Client Name / Company <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={formClient}
                    onChange={(e) => setFormClient(e.target.value)}
                    placeholder="e.g. Apex Infotech Ltd"
                    className="w-full rounded-lg border border-gray-200 p-2.5 outline-none focus:border-blue-500"
                  />
                </div>

                <div>
                  <label className="block font-medium text-gray-700 mb-1">Status</label>
                  <select
                    value={formStatus}
                    onChange={(e) => setFormStatus(e.target.value as ProjectRecord["status"])}
                    className="w-full rounded-lg border border-gray-200 p-2.5 outline-none focus:border-blue-500 bg-white"
                  >
                    <option value="Planning">Planning</option>
                    <option value="In Progress">In Progress</option>
                    <option value="Review">Review</option>
                    <option value="Completed">Completed</option>
                    <option value="On Hold">On Hold</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-medium text-gray-700 mb-1">Budget (₹)</label>
                  <input
                    type="number"
                    min="0"
                    step="1000"
                    value={formBudget}
                    onChange={(e) => setFormBudget(parseFloat(e.target.value) || 0)}
                    placeholder="e.g. 250000"
                    className="w-full rounded-lg border border-gray-200 p-2.5 outline-none focus:border-blue-500"
                  />
                </div>

                <div>
                  <label className="block font-medium text-gray-700 mb-1">Target Deadline</label>
                  <input
                    type="date"
                    value={formDeadline}
                    onChange={(e) => setFormDeadline(e.target.value)}
                    className="w-full rounded-lg border border-gray-200 p-2.5 outline-none focus:border-blue-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-medium text-gray-700 mb-1">
                    Progress Percentage: <span className="font-bold text-blue-600">{formProgress}%</span>
                  </label>
                  <input
                    type="range"
                    min="0"
                    max="100"
                    value={formProgress}
                    onChange={(e) => setFormProgress(parseInt(e.target.value, 10))}
                    className="w-full accent-blue-600 mt-2"
                  />
                </div>

                <div>
                  <label className="block font-medium text-gray-700 mb-1">Lead / Staff In-Charge</label>
                  <input
                    type="text"
                    value={formLeader}
                    onChange={(e) => setFormLeader(e.target.value)}
                    placeholder="Enter employee or TL name"
                    className="w-full rounded-lg border border-gray-200 p-2.5 outline-none focus:border-blue-500"
                  />
                </div>
              </div>

              <div>
                <label className="block font-medium text-gray-700 mb-1">Description / Project Scope</label>
                <textarea
                  rows={3}
                  value={formDescription}
                  onChange={(e) => setFormDescription(e.target.value)}
                  placeholder="Key milestones, tech stack, deliverables..."
                  className="w-full rounded-lg border border-gray-200 p-2.5 outline-none focus:border-blue-500"
                />
              </div>

              <div className="mt-5 flex items-center justify-end gap-2.5 border-t border-gray-100 pt-3">
                <button
                  type="button"
                  onClick={() => setModalMode(null)}
                  className="rounded-lg border border-gray-200 px-3.5 py-2 text-xs font-medium text-gray-600 hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="flex items-center gap-1.5 rounded-lg bg-blue-600 px-4 py-2 text-xs font-semibold text-white hover:bg-blue-700 shadow-sm transition disabled:opacity-50"
                >
                  <Check size={14} />
                  {modalMode === "create" ? "Create Project" : "Save Changes"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
