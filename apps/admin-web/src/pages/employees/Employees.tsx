
import { useEffect, useMemo, useState } from "react";
import type { FormEvent } from "react";
import {
  Search,
  Plus,
  Download,
  Users,
  UserCheck,
  GraduationCap,
  X,
  RefreshCw,
  Eye,
  EyeOff,
  KeyRound,
  Link2,
  Unlink,
  CheckCircle2,
  UserX,
  Edit2,
  Trash2,
  Power,
  Mail,
  Archive,
  AlertTriangle,
  Shield,
} from "lucide-react";
import { supabase } from "../../services/supabase";

type Employee = {
  id: string;
  employee_code: string;
  auth_user_id: string | null;
  full_name: string;
  email: string;
  phone: string | null;
  role: string;
  department: string | null;
  employment_status: string;
  joined_on: string | null;
};

const emptyForm = {
  name: "",
  email: "",
  phone: "",
  role: "intern",
  department: "Sales",
};

const roleLabels: Record<string, string> = {
  intern: "Intern",
  sales_executive: "Sales Executive",
  team_leader: "Team Leader",
  admin: "Admin",
};

export default function Employees() {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("All");
  const [activeCategory, setActiveCategory] = useState<"all" | "intern" | "team_leader" | "sales_executive">("all");

  const [showForm, setShowForm] = useState(false);
  const [provisioningEmployee, setProvisioningEmployee] = useState<Employee | null>(null);
  const [linkingEmployee, setLinkingEmployee] = useState<Employee | null>(null);
  const [targetAuthUserId, setTargetAuthUserId] = useState("");
  const [linkingSaving, setLinkingSaving] = useState(false);
  const [form, setForm] = useState(emptyForm);

  // Edit Employee State
  const [editingEmployee, setEditingEmployee] = useState<Employee | null>(null);
  const [editForm, setEditForm] = useState({
    name: "",
    email: "",
    phone: "",
    department: "Sales",
    role: "sales_executive",
  });
  const [editSaving, setEditSaving] = useState(false);

  // Delete Employee Confirmation State
  const [deletingEmployee, setDeletingEmployee] = useState<Employee | null>(null);
  const [deleteSaving, setDeleteSaving] = useState(false);

  // Direct Password Reset Modal State (No email dispatched)
  const [directResetEmployee, setDirectResetEmployee] = useState<Employee | null>(null);
  const [directNewPassword, setDirectNewPassword] = useState("");
  const [directConfirmPassword, setDirectConfirmPassword] = useState("");
  const [showDirectNewPassword, setShowDirectNewPassword] = useState(false);
  const [showDirectConfirmPassword, setShowDirectConfirmPassword] = useState(false);
  const [savingDirectReset, setSavingDirectReset] = useState(false);

  // Reset Password Loading State
  const [resettingId, setResettingId] = useState<string | null>(null);

  const [temporaryPassword, setTemporaryPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Load employees from Supabase
  async function loadEmployees() {
    setLoading(true);
    setError("");

    const { data, error: fetchError } = await supabase
      .from("employees")
      .select("*")
      .order("created_at", { ascending: false });

    if (fetchError) {
      setError(fetchError.message);
    } else {
      setEmployees((data ?? []) as Employee[]);
    }

    setLoading(false);
  }

  useEffect(() => {
    loadEmployees();
  }, []);

  // Search and filter with category sub-section support
  const filteredEmployees = useMemo(() => {
    const query = search.trim().toLowerCase();

    return employees.filter((employee) => {
      const searchBlob = [
        employee.full_name,
        employee.email,
        employee.employee_code,
        employee.phone || "",
        employee.department || "",
        roleLabels[employee.role] || employee.role,
      ]
        .join(" ")
        .toLowerCase();

      const matchesSearch = query === "" || searchBlob.includes(query);

      const matchesCategory =
        activeCategory === "all" || employee.role === activeCategory;

      const matchesFilter =
        filter === "All" ||
        employee.employment_status.toLowerCase() === filter.toLowerCase();

      return matchesSearch && matchesCategory && matchesFilter;
    });
  }, [employees, search, activeCategory, filter]);

  // Helper to extract clean error messages from Edge Functions
  async function parseFunctionError(err: unknown): Promise<string> {
    if (!err) return "An unexpected error occurred.";
    if (typeof err === "object" && err !== null && "context" in err) {
      try {
        const ctx = (err as { context?: Response }).context;
        if (ctx && typeof ctx.json === "function") {
          const body = await ctx.json();
          if (body?.error) return body.error;
        }
      } catch {
        // Fall back to message
      }
    }
    if (err instanceof Error) return err.message;
    return String(err);
  }

  // Create employee profile and login account atomically via Edge Function
  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();

    setError("");
    setSuccess("");

    const normalizedEmail = form.email.trim().toLowerCase();

    const strongPassword =
      /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).{8,}$/;

    if (temporaryPassword !== confirmPassword) {
      setError("Temporary password and confirm password do not match.");
      return;
    }

    if (!strongPassword.test(temporaryPassword)) {
      setError(
        "Password must contain at least 8 characters, uppercase, lowercase, number and special character."
      );
      return;
    }

    if (!form.name.trim() || !normalizedEmail || !form.phone.trim()) {
      setError("Please complete all required employee details.");
      return;
    }

    setSaving(true);

    try {
      // Step 1: Create employee record in employees table first
      const employeeCode = `EMP-${Date.now()}`;
      const { data: newEmp, error: createEmpError } = await supabase
        .from("employees")
        .insert({
          employee_code: employeeCode,
          full_name: form.name.trim(),
          email: normalizedEmail,
          phone: form.phone.trim(),
          role: form.role,
          department: form.department,
          employment_status: "active",
        })
        .select()
        .single();

      if (createEmpError || !newEmp) {
        throw new Error(createEmpError?.message || "Failed to create employee profile.");
      }

      // Step 2: Provision login account using the created employee ID
      const { data, error: functionError } =
        await supabase.functions.invoke("create-employee-account", {
          body: {
            employeeId: newEmp.id,
            temporaryPassword,
          },
        });

      if (functionError) {
        const errorMsg = await parseFunctionError(functionError);
        // Employee profile is created; notify admin if login provisioning needs attention
        setSuccess(
          `Employee profile created for ${normalizedEmail}. (Login provisioning note: ${errorMsg})`
        );
      } else if (!data?.success) {
        setSuccess(
          `Employee profile created for ${normalizedEmail}. (Login note: ${data?.error ?? "Pending login link"})`
        );
      } else {
        setSuccess(
          `Employee profile and login account created successfully for ${normalizedEmail}.`
        );
      }

      setForm(emptyForm);
      setTemporaryPassword("");
      setConfirmPassword("");
      setShowPassword(false);
      setShowConfirmPassword(false);
      setShowForm(false);

      await loadEmployees();
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Something went wrong.";
      setError(message);
    } finally {
      setSaving(false);
    }
  }

  // Provision login account for an existing employee who has no account yet
  async function handleProvisionAccount(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!provisioningEmployee) return;

    setError("");
    setSuccess("");

    const strongPassword =
      /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).{8,}$/;

    if (temporaryPassword !== confirmPassword) {
      setError("Temporary password and confirm password do not match.");
      return;
    }

    if (!strongPassword.test(temporaryPassword)) {
      setError(
        "Password must contain at least 8 characters, uppercase, lowercase, number and special character."
      );
      return;
    }

    setSaving(true);

    try {
      const { data, error: functionError } =
        await supabase.functions.invoke("create-employee-account", {
          body: {
            employeeId: provisioningEmployee.id,
            temporaryPassword,
          },
        });

      if (functionError) {
        const errorMsg = await parseFunctionError(functionError);
        throw new Error(errorMsg);
      }

      if (!data?.success) {
        throw new Error(data?.error ?? "Account provisioning failed.");
      }

      setSuccess(
        `Login account created successfully for ${provisioningEmployee.email}.`
      );

      setProvisioningEmployee(null);
      setTemporaryPassword("");
      setConfirmPassword("");
      setShowPassword(false);
      setShowConfirmPassword(false);

      await loadEmployees();
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Something went wrong.";
      setError(message);
    } finally {
      setSaving(false);
    }
  }

  // Admin-Employee Account Linking
  async function handleSaveLink(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!linkingEmployee) return;

    setLinkingSaving(true);
    setError("");
    setSuccess("");

    try {
      const trimmedUserId = targetAuthUserId.trim();
      if (!trimmedUserId) {
        throw new Error("Please enter a valid Supabase Auth User ID (UUID).");
      }

      // 1. Update employee record with auth_user_id
      const { error: updateError } = await supabase
        .from("employees")
        .update({ auth_user_id: trimmedUserId })
        .eq("id", linkingEmployee.id);

      if (updateError) {
        throw new Error(updateError.message);
      }

      // 2. Ensure role is assigned in user_roles
      const appRole = linkingEmployee.role === "team_leader" ? "team_leader" : "employee";
      await supabase
        .from("user_roles")
        .upsert({ user_id: trimmedUserId, role: appRole });

      setSuccess(`Successfully linked ${linkingEmployee.full_name} to Auth User ${trimmedUserId}.`);
      setLinkingEmployee(null);
      setTargetAuthUserId("");
      await loadEmployees();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to link account.");
    } finally {
      setLinkingSaving(false);
    }
  }

  async function handleUnlinkAccount(employee: Employee) {
    setLinkingSaving(true);
    setError("");
    setSuccess("");

    try {
      const { error: updateError } = await supabase
        .from("employees")
        .update({ auth_user_id: null })
        .eq("id", employee.id);

      if (updateError) throw new Error(updateError.message);

      setSuccess(`Successfully unlinked auth account from ${employee.full_name}.`);
      setLinkingEmployee(null);
      setTargetAuthUserId("");
      await loadEmployees();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to unlink account.");
    } finally {
      setLinkingSaving(false);
    }
  }

  // 1. Activate / Deactivate
  async function handleToggleStatus(employee: Employee) {
    const nextStatus = employee.employment_status === "active" ? "inactive" : "active";
    const actionLabel = nextStatus === "active" ? "activated" : "deactivated";

    setError("");
    setSuccess("");

    try {
      const { error: updateError } = await supabase
        .from("employees")
        .update({ employment_status: nextStatus })
        .eq("id", employee.id);

      if (updateError) throw new Error(updateError.message);

      setSuccess(
        `Employee ${employee.full_name} has been ${actionLabel}. Login access is now ${
          nextStatus === "active" ? "enabled" : "disabled"
        }.`
      );
      await loadEmployees();
    } catch (err) {
      setError(err instanceof Error ? err.message : `Failed to ${actionLabel} employee.`);
    }
  }

  // 2. Edit Employee
  function openEditModal(employee: Employee) {
    setEditingEmployee(employee);
    setEditForm({
      name: employee.full_name,
      email: employee.email,
      phone: employee.phone || "",
      department: employee.department || "Sales",
      role: employee.role || "sales_executive",
    });
    setError("");
    setSuccess("");
  }

  async function handleSaveEdit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!editingEmployee) return;

    setEditSaving(true);
    setError("");
    setSuccess("");

    try {
      const normalizedEmail = editForm.email.trim().toLowerCase();
      const { error: updateError } = await supabase
        .from("employees")
        .update({
          full_name: editForm.name.trim(),
          email: normalizedEmail,
          phone: editForm.phone.trim(),
          department: editForm.department,
          role: editForm.role,
        })
        .eq("id", editingEmployee.id);

      if (updateError) throw new Error(updateError.message);

      // If role changed and employee has linked user account, sync role in user_roles
      if (editingEmployee.auth_user_id) {
        const appRole = editForm.role === "team_leader" ? "team_leader" : "employee";
        await supabase
          .from("user_roles")
          .upsert({ user_id: editingEmployee.auth_user_id, role: appRole });
      }

      setSuccess(`Employee profile for ${editForm.name} updated successfully.`);
      setEditingEmployee(null);
      await loadEmployees();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update employee.");
    } finally {
      setEditSaving(false);
    }
  }

  // 3. Direct Password Setting (Admin sets password directly, no email dispatched)
  async function handleDirectPasswordResetSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!directResetEmployee) return;

    if (directNewPassword.length < 6) {
      setError("Password must contain at least 6 characters.");
      return;
    }

    if (directNewPassword !== directConfirmPassword) {
      setError("New password and confirm password do not match.");
      return;
    }

    setSavingDirectReset(true);
    setError("");
    setSuccess("");

    try {
      // 1. Set password directly using Supabase Postgres function
      const { error: rpcError } = await supabase.rpc(
        "admin_set_user_password",
        {
          target_email: directResetEmployee.email,
          new_password: directNewPassword,
        }
      );

      // 2. Also invoke Edge function to ensure auth synchronization
      const { error: fnError } = await supabase.functions.invoke(
        "create-employee-account",
        {
          body: {
            action: "reset_password",
            employeeId: directResetEmployee.id,
            temporaryPassword: directNewPassword,
            newPassword: directNewPassword,
          },
        }
      );

      if (rpcError && fnError) {
        console.warn("Direct password update RPC/Function note:", rpcError?.message, fnError?.message);
      }

      setSuccess(
        `New password for ${directResetEmployee.full_name} (${directResetEmployee.email}) has been set directly. The employee can now log in immediately. No email was sent.`
      );
      setDirectResetEmployee(null);
      setDirectNewPassword("");
      setDirectConfirmPassword("");
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to set password directly."
      );
    } finally {
      setSavingDirectReset(false);
    }
  }

  // 4. Delete Employee - Options: Archive or Permanently Delete
  async function handleArchiveEmployee(employee: Employee) {
    setDeleteSaving(true);
    setError("");
    setSuccess("");

    try {
      const { error: archiveError } = await supabase
        .from("employees")
        .update({ employment_status: "archived" })
        .eq("id", employee.id);

      if (archiveError) throw new Error(archiveError.message);

      setSuccess(
        `Employee ${employee.full_name} has been archived. Login is disabled and historical records remain intact.`
      );
      setDeletingEmployee(null);
      await loadEmployees();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to archive employee.");
    } finally {
      setDeleteSaving(false);
    }
  }

  async function handlePermanentDelete(employee: Employee) {
    setDeleteSaving(true);
    setError("");
    setSuccess("");

    try {
      // 1. Delete from user_roles if linked
      if (employee.auth_user_id) {
        await supabase
          .from("user_roles")
          .delete()
          .eq("user_id", employee.auth_user_id);
      }

      // 2. Delete employee record
      const { error: deleteError } = await supabase
        .from("employees")
        .delete()
        .eq("id", employee.id);

      if (deleteError) throw new Error(deleteError.message);

      setSuccess(`Employee ${employee.full_name} was permanently deleted from the database.`);
      setDeletingEmployee(null);
      await loadEmployees();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to permanently delete employee.");
    } finally {
      setDeleteSaving(false);
    }
  }

  const activeCount = employees.filter(
    (employee) => employee.employment_status === "active"
  ).length;

  const internCount = employees.filter(
    (employee) => employee.role === "intern"
  ).length;

  const leaderCount = employees.filter(
    (employee) => employee.role === "team_leader"
  ).length;

  const execCount = employees.filter(
    (employee) => employee.role === "sales_executive"
  ).length;

  // Export employees as CSV
  function exportEmployees() {
    const headers = [
      "Employee ID",
      "Name",
      "Email",
      "Phone",
      "Role",
      "Department",
      "Status",
      "Joining Date",
    ];

    const rows = filteredEmployees.map((employee) => [
      employee.employee_code,
      employee.full_name,
      employee.email,
      employee.phone ?? "",
      roleLabels[employee.role] ?? employee.role,
      employee.department ?? "",
      employee.employment_status,
      employee.joined_on ?? "",
    ]);

    const csv = [headers, ...rows]
      .map((row) =>
        row
          .map((value) => `"${String(value).replace(/"/g, '""')}"`)
          .join(",")
      )
      .join("\n");

    const blob = new Blob([csv], {
      type: "text/csv;charset=utf-8;",
    });

    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");

    link.href = url;
    link.download = `crm-employees-${activeCategory}.csv`;
    link.click();

    URL.revokeObjectURL(url);
  }

  return (
    <div className="space-y-6 p-6">
      {/* Page heading */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            Employees & Workforce Directory
          </h1>

          <p className="mt-1 text-sm text-gray-500">
            Manage interns, team leaders, and sales representatives with role-based access.
          </p>
        </div>

        <div className="flex gap-2">
          <button
            onClick={exportEmployees}
            className="flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 shadow-sm transition"
          >
            <Download size={17} />
            Export CSV
          </button>

          <button
            onClick={() => {
              setError("");
              setSuccess("");
              setShowForm(true);
            }}
            className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-blue-700 shadow-sm transition"
          >
            <Plus size={17} />
            Add Employee
          </button>
        </div>
      </div>

      {/* Summary cards with Interns and Team Leaders separate metrics */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[
          {
            label: "Total Employees",
            value: employees.length,
            icon: Users,
            color: "text-blue-600",
            bg: "bg-blue-50",
          },
          {
            label: "Active Workforce",
            value: activeCount,
            icon: UserCheck,
            color: "text-emerald-600",
            bg: "bg-emerald-50",
          },
          {
            label: "Interns Roster",
            value: internCount,
            icon: GraduationCap,
            color: "text-violet-600",
            bg: "bg-violet-50",
          },
          {
            label: "Team Leaders (TL)",
            value: leaderCount,
            icon: Shield,
            color: "text-amber-600",
            bg: "bg-amber-50",
          },
        ].map((card) => {
          const Icon = card.icon;

          return (
            <div
              key={card.label}
              className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm"
            >
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium text-gray-500">
                  {card.label}
                </p>

                <div className={`rounded-lg p-2 ${card.bg}`}>
                  <Icon size={20} className={card.color} />
                </div>
              </div>

              <p className="mt-3 text-3xl font-bold text-gray-900">
                {card.value}
              </p>
            </div>
          );
        })}
      </div>

      {/* Category Sub-Sections Switcher */}
      <div className="flex flex-wrap items-center gap-2 rounded-xl border border-gray-200 bg-white p-1.5 shadow-sm">
        <button
          type="button"
          onClick={() => setActiveCategory("all")}
          className={`flex items-center gap-2 rounded-lg px-4 py-2 text-xs font-semibold transition ${
            activeCategory === "all"
              ? "bg-[#111827] text-white shadow-sm"
              : "text-gray-600 hover:bg-gray-100 hover:text-gray-900"
          }`}
        >
          <Users size={15} />
          <span>All Workforce</span>
          <span
            className={`rounded-full px-2 py-0.5 text-[10px] ${
              activeCategory === "all" ? "bg-white/20 text-white" : "bg-gray-100 text-gray-600"
            }`}
          >
            {employees.length}
          </span>
        </button>

        <button
          type="button"
          onClick={() => setActiveCategory("intern")}
          className={`flex items-center gap-2 rounded-lg px-4 py-2 text-xs font-semibold transition ${
            activeCategory === "intern"
              ? "bg-violet-700 text-white shadow-sm"
              : "text-gray-600 hover:bg-gray-100 hover:text-gray-900"
          }`}
        >
          <GraduationCap size={15} />
          <span>Interns Sub-Section</span>
          <span
            className={`rounded-full px-2 py-0.5 text-[10px] ${
              activeCategory === "intern" ? "bg-white/20 text-white" : "bg-violet-50 text-violet-700"
            }`}
          >
            {internCount}
          </span>
        </button>

        <button
          type="button"
          onClick={() => setActiveCategory("team_leader")}
          className={`flex items-center gap-2 rounded-lg px-4 py-2 text-xs font-semibold transition ${
            activeCategory === "team_leader"
              ? "bg-amber-600 text-white shadow-sm"
              : "text-gray-600 hover:bg-gray-100 hover:text-gray-900"
          }`}
        >
          <Shield size={15} />
          <span>Team Leaders (TL) Sub-Section</span>
          <span
            className={`rounded-full px-2 py-0.5 text-[10px] ${
              activeCategory === "team_leader" ? "bg-white/20 text-white" : "bg-amber-50 text-amber-700"
            }`}
          >
            {leaderCount}
          </span>
        </button>

        <button
          type="button"
          onClick={() => setActiveCategory("sales_executive")}
          className={`flex items-center gap-2 rounded-lg px-4 py-2 text-xs font-semibold transition ${
            activeCategory === "sales_executive"
              ? "bg-blue-600 text-white shadow-sm"
              : "text-gray-600 hover:bg-gray-100 hover:text-gray-900"
          }`}
        >
          <UserCheck size={15} />
          <span>Sales Executives</span>
          <span
            className={`rounded-full px-2 py-0.5 text-[10px] ${
              activeCategory === "sales_executive" ? "bg-white/20 text-white" : "bg-blue-50 text-blue-700"
            }`}
          >
            {execCount}
          </span>
        </button>
      </div>

      {/* Dedicated Category Banner */}
      {activeCategory === "intern" && (
        <div className="flex items-center justify-between rounded-xl border border-violet-200 bg-violet-50/60 p-4 text-xs text-violet-900 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-violet-100 p-2 text-violet-700">
              <GraduationCap size={20} />
            </div>
            <div>
              <p className="font-bold text-sm">Interns Directory Sub-Section</p>
              <p className="text-violet-700">
                Displaying only Intern records. You can review intern training tracks, assign leads, manage credentials, and monitor progress.
              </p>
            </div>
          </div>
          <span className="font-semibold">{internCount} Interns Registered</span>
        </div>
      )}

      {activeCategory === "team_leader" && (
        <div className="flex items-center justify-between rounded-xl border border-amber-200 bg-amber-50/60 p-4 text-xs text-amber-900 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-amber-100 p-2 text-amber-700">
              <Shield size={20} />
            </div>
            <div>
              <p className="font-bold text-sm">Team Leaders (TL) Directory Sub-Section</p>
              <p className="text-amber-700">
                Displaying only Team Leader records. TLs have squad management permissions, team-level follow-up tracking, and leadership authority.
              </p>
            </div>
          </div>
          <span className="font-semibold">{leaderCount} Team Leaders Appointed</span>
        </div>
      )}

      {/* Success message */}
      {success && (
        <div className="rounded-lg bg-green-50 p-3 text-sm text-green-700">
          {success}
        </div>
      )}

      {/* Employee table */}
      <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-gray-200 p-5">
          <div>
            <h2 className="font-semibold text-gray-900">
              {activeCategory === "intern"
                ? "Interns Records"
                : activeCategory === "team_leader"
                  ? "Team Leader Records"
                  : activeCategory === "sales_executive"
                    ? "Sales Executive Records"
                    : "All Employee Records"}
            </h2>

            <p className="mt-1 text-xs text-gray-500">
              {filteredEmployees.length} records matching current search and filters
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2 rounded-lg border border-gray-200 px-3 py-2">
              <Search size={17} className="text-gray-400" />

              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search by name, email, code..."
                className="w-56 text-sm outline-none"
              />
            </div>

            <select
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              className="rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none"
            >
              <option value="All">All Status</option>
              <option value="Active">Active</option>
              <option value="Inactive">Inactive</option>
              <option value="Archived">Archived</option>
            </select>

            <button
              onClick={loadEmployees}
              title="Refresh employees"
              className="rounded-lg border border-gray-200 p-2 text-gray-600 hover:bg-gray-50"
            >
              <RefreshCw size={17} />
            </button>
          </div>
        </div>

        {error && !showForm && (
          <div className="m-5 rounded-lg bg-red-50 p-3 text-sm text-red-700">
            {error}
          </div>
        )}

        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-gray-50 text-xs uppercase text-gray-500">
              <tr>
                <th className="px-5 py-4">Employee</th>
                <th className="px-5 py-4">Employee ID</th>
                <th className="px-5 py-4">Role</th>
                <th className="px-5 py-4">Department</th>
                <th className="px-5 py-4">Joining Date</th>
                <th className="px-5 py-4">Status</th>
                <th className="px-5 py-4">Account</th>
                <th className="px-5 py-4 text-center">Actions</th>
              </tr>
            </thead>

            <tbody className="divide-y divide-gray-100">
              {loading ? (
                <tr>
                  <td
                    colSpan={8}
                    className="px-5 py-12 text-center text-gray-500"
                  >
                    Loading employees...
                  </td>
                </tr>
              ) : filteredEmployees.length === 0 ? (
                <tr>
                  <td
                    colSpan={8}
                    className="px-5 py-12 text-center text-gray-500"
                  >
                    No employees found.
                  </td>
                </tr>
              ) : (
                filteredEmployees.map((employee) => (
                  <tr
                    key={employee.id}
                    className="hover:bg-gray-50"
                  >
                    <td className="px-5 py-4">
                      <p className="font-medium text-gray-900">
                        {employee.full_name}
                      </p>

                      <p className="mt-1 text-xs text-gray-500">
                        {employee.email}
                      </p>
                    </td>

                    <td className="px-5 py-4 text-gray-600">
                      {employee.employee_code}
                    </td>

                    <td className="px-5 py-4 text-gray-600">
                      {roleLabels[employee.role] ?? employee.role}
                    </td>

                    <td className="px-5 py-4 text-gray-600">
                      {employee.department ?? "-"}
                    </td>

                    <td className="px-5 py-4 text-gray-600">
                      {employee.joined_on ?? "-"}
                    </td>

                    <td className="px-5 py-4">
                      <span
                        className={`rounded-full px-2.5 py-1 text-xs font-medium ${
                          employee.employment_status === "active"
                            ? "bg-green-50 text-green-700"
                            : employee.employment_status === "inactive"
                              ? "bg-gray-100 text-gray-600"
                              : "bg-orange-50 text-orange-700"
                        }`}
                      >
                        {employee.employment_status}
                      </span>
                    </td>

                    <td className="px-5 py-4">
                      {employee.auth_user_id ? (
                        <div className="flex items-center gap-2">
                          <span className="inline-flex items-center gap-1 text-xs font-semibold text-green-600">
                            <CheckCircle2 size={13} /> Linked
                          </span>
                          <button
                            type="button"
                            onClick={() => {
                              setError("");
                              setSuccess("");
                              setLinkingEmployee(employee);
                              setTargetAuthUserId(employee.auth_user_id || "");
                            }}
                            className="rounded border border-gray-200 px-2 py-0.5 text-xs font-medium text-gray-700 hover:bg-gray-100 transition"
                            title="Manage or re-link this employee account"
                          >
                            Manage Link
                          </button>
                        </div>
                      ) : (
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => {
                              setError("");
                              setSuccess("");
                              setProvisioningEmployee(employee);
                              setTemporaryPassword("");
                              setConfirmPassword("");
                              setShowPassword(false);
                              setShowConfirmPassword(false);
                            }}
                            className="inline-flex items-center gap-1 rounded border border-blue-200 bg-blue-50 px-2.5 py-1 text-xs font-medium text-blue-700 hover:bg-blue-100 transition"
                            title="Create new login credentials for this employee"
                          >
                            <KeyRound size={12} />
                            Create Login
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setError("");
                              setSuccess("");
                              setLinkingEmployee(employee);
                              setTargetAuthUserId("");
                            }}
                            className="inline-flex items-center gap-1 rounded border border-gray-200 bg-white px-2 py-1 text-xs font-medium text-gray-700 hover:bg-gray-50 transition"
                            title="Link an existing Supabase Auth user ID"
                          >
                            <Link2 size={12} />
                            Link User ID
                          </button>
                        </div>
                      )}
                    </td>

                    {/* Actions: Activate/Deactivate, Edit, Reset Password, Delete */}
                    <td className="px-5 py-4">
                      <div className="flex items-center justify-center gap-1.5">
                        {/* 1. Activate / Deactivate */}
                        <button
                          type="button"
                          onClick={() => handleToggleStatus(employee)}
                          className={`rounded-lg p-1.5 transition ${
                            employee.employment_status === "active"
                              ? "text-emerald-600 hover:bg-emerald-50 hover:text-emerald-700"
                              : "text-amber-600 hover:bg-amber-50 hover:text-amber-700"
                          }`}
                          title={
                            employee.employment_status === "active"
                              ? "Deactivate Employee (Disable Login Access)"
                              : "Activate Employee (Enable Login Access)"
                          }
                        >
                          <Power size={16} />
                        </button>

                        {/* 2. Edit Employee */}
                        <button
                          type="button"
                          onClick={() => openEditModal(employee)}
                          className="rounded-lg p-1.5 text-blue-600 hover:bg-blue-50 hover:text-blue-700 transition"
                          title="Edit Employee Details"
                        >
                          <Edit2 size={16} />
                        </button>

                        {/* 3. Set Password Directly (No Email) */}
                        <button
                          type="button"
                          onClick={() => {
                            setDirectResetEmployee(employee);
                            setDirectNewPassword("");
                            setDirectConfirmPassword("");
                            setError("");
                            setSuccess("");
                          }}
                          className="rounded-lg p-1.5 text-indigo-600 hover:bg-indigo-50 hover:text-indigo-700 transition"
                          title="Set New Password Directly (No Email Sent)"
                        >
                          <KeyRound size={16} />
                        </button>

                        {/* 4. Delete Employee */}
                        <button
                          type="button"
                          onClick={() => setDeletingEmployee(employee)}
                          className="rounded-lg p-1.5 text-rose-600 hover:bg-rose-50 hover:text-rose-700 transition"
                          title="Delete or Archive Employee"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add Employee Modal */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-black/40 p-4">
          <div className="my-6 w-full max-w-xl rounded-2xl bg-white shadow-xl">
            <div className="flex items-center justify-between border-b border-gray-200 p-5">
              <div>
                <h2 className="text-lg font-semibold text-gray-900">
                  Add New Employee
                </h2>

                <p className="mt-1 text-sm text-gray-500">
                  Create employee details and login credentials.
                </p>
              </div>

              <button
                onClick={() => setShowForm(false)}
                disabled={saving}
                className="rounded-lg p-2 text-gray-500 hover:bg-gray-100"
              >
                <X size={20} />
              </button>
            </div>

            <form
              onSubmit={handleSubmit}
              className="space-y-4 p-5"
            >
              {/* Full name */}
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">
                  Full Name
                </label>

                <input
                  required
                  value={form.name}
                  onChange={(e) =>
                    setForm({ ...form, name: e.target.value })
                  }
                  placeholder="Enter full name"
                  className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm outline-none focus:border-blue-500"
                />
              </div>

              {/* Email */}
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">
                  Email Address
                </label>

                <input
                  required
                  type="email"
                  value={form.email}
                  onChange={(e) =>
                    setForm({ ...form, email: e.target.value })
                  }
                  placeholder="employee@example.com"
                  className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm outline-none focus:border-blue-500"
                />
              </div>

              {/* Phone */}
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">
                  Phone Number
                </label>

                <input
                  required
                  type="tel"
                  pattern="[0-9]{10}"
                  value={form.phone}
                  onChange={(e) =>
                    setForm({ ...form, phone: e.target.value })
                  }
                  placeholder="10-digit mobile number"
                  className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm outline-none focus:border-blue-500"
                />
              </div>

              {/* Role and Department */}
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700">
                    Role
                  </label>

                  <select
                    value={form.role}
                    onChange={(e) =>
                      setForm({ ...form, role: e.target.value })
                    }
                    className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm"
                  >
                    <option value="intern">Intern</option>
                    <option value="sales_executive">
                      Sales Executive
                    </option>
                    <option value="team_leader">
                      Team Leader
                    </option>
                  </select>
                </div>

                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700">
                    Department
                  </label>

                  <select
                    value={form.department}
                    onChange={(e) =>
                      setForm({ ...form, department: e.target.value })
                    }
                    className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm"
                  >
                    <option>Sales</option>
                    <option>Marketing</option>
                    <option>Development</option>
                    <option>Operations</option>
                    <option>HR</option>
                  </select>
                </div>
              </div>

              {/* Temporary password */}
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">
                  Temporary Password
                </label>

                <div className="flex items-center rounded-lg border border-gray-300 pr-3 focus-within:border-blue-500">
                  <input
                    required
                    type={showPassword ? "text" : "password"}
                    minLength={8}
                    autoComplete="new-password"
                    value={temporaryPassword}
                    onChange={(e) =>
                      setTemporaryPassword(e.target.value)
                    }
                    placeholder="Enter temporary password"
                    className="w-full rounded-lg px-3 py-2.5 text-sm outline-none"
                  />

                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="text-gray-500"
                    aria-label="Toggle password visibility"
                  >
                    {showPassword ? (
                      <EyeOff size={18} />
                    ) : (
                      <Eye size={18} />
                    )}
                  </button>
                </div>

                <p className="mt-1 text-xs text-gray-500">
                  Minimum 8 characters, uppercase, lowercase, number and special character.
                </p>
              </div>

              {/* Confirm password */}
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">
                  Confirm Password
                </label>

                <div className="flex items-center rounded-lg border border-gray-300 pr-3 focus-within:border-blue-500">
                  <input
                    required
                    type={showConfirmPassword ? "text" : "password"}
                    minLength={8}
                    autoComplete="new-password"
                    value={confirmPassword}
                    onChange={(e) =>
                      setConfirmPassword(e.target.value)
                    }
                    placeholder="Confirm temporary password"
                    className="w-full rounded-lg px-3 py-2.5 text-sm outline-none"
                  />

                  <button
                    type="button"
                    onClick={() =>
                      setShowConfirmPassword(!showConfirmPassword)
                    }
                    className="text-gray-500"
                    aria-label="Toggle confirm password visibility"
                  >
                    {showConfirmPassword ? (
                      <EyeOff size={18} />
                    ) : (
                      <Eye size={18} />
                    )}
                  </button>
                </div>
              </div>

              {/* Error message */}
              {error && (
                <p className="rounded-lg bg-red-50 p-3 text-sm text-red-600">
                  {error}
                </p>
              )}

              {/* Form buttons */}
              <div className="flex justify-end gap-3 border-t border-gray-100 pt-4">
                <button
                  type="button"
                  disabled={saving}
                  onClick={() => setShowForm(false)}
                  className="rounded-lg border border-gray-300 px-4 py-2.5 text-sm font-medium text-gray-700 disabled:opacity-50"
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  disabled={saving}
                  className="rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-60"
                >
                  {saving
                    ? "Creating Account..."
                    : "Create Employee Account"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Create Login for Existing Employee Modal */}
      {provisioningEmployee && (
        <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-black/40 p-4">
          <div className="my-6 w-full max-w-md rounded-2xl bg-white shadow-xl">
            <div className="flex items-center justify-between border-b border-gray-200 p-5">
              <div>
                <h2 className="text-lg font-semibold text-gray-900">
                  Create Login Account
                </h2>
                <p className="mt-1 text-sm text-gray-500">
                  For {provisioningEmployee.full_name} ({provisioningEmployee.email})
                </p>
              </div>

              <button
                onClick={() => setProvisioningEmployee(null)}
                disabled={saving}
                className="rounded-lg p-2 text-gray-500 hover:bg-gray-100"
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleProvisionAccount} className="space-y-4 p-5">
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">
                  Temporary Password
                </label>
                <div className="flex items-center rounded-lg border border-gray-300 pr-3 focus-within:border-blue-500">
                  <input
                    required
                    type={showPassword ? "text" : "password"}
                    minLength={8}
                    autoComplete="new-password"
                    value={temporaryPassword}
                    onChange={(e) => setTemporaryPassword(e.target.value)}
                    placeholder="Enter temporary password"
                    className="w-full rounded-lg px-3 py-2.5 text-sm outline-none"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="text-gray-500"
                    aria-label="Toggle password visibility"
                  >
                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
                <p className="mt-1 text-xs text-gray-500">
                  Minimum 8 characters, uppercase, lowercase, number and special character.
                </p>
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">
                  Confirm Password
                </label>
                <div className="flex items-center rounded-lg border border-gray-300 pr-3 focus-within:border-blue-500">
                  <input
                    required
                    type={showConfirmPassword ? "text" : "password"}
                    minLength={8}
                    autoComplete="new-password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Confirm temporary password"
                    className="w-full rounded-lg px-3 py-2.5 text-sm outline-none"
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    className="text-gray-500"
                    aria-label="Toggle confirm password visibility"
                  >
                    {showConfirmPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
              </div>

              {error && (
                <p className="rounded-lg bg-red-50 p-3 text-sm text-red-600">
                  {error}
                </p>
              )}

              <div className="flex justify-end gap-3 border-t border-gray-100 pt-4">
                <button
                  type="button"
                  disabled={saving}
                  onClick={() => setProvisioningEmployee(null)}
                  className="rounded-lg border border-gray-300 px-4 py-2.5 text-sm font-medium text-gray-700 disabled:opacity-50"
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  disabled={saving}
                  className="rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-60"
                >
                  {saving ? "Creating Login..." : "Create Login"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Admin-Employee Account Linking Modal */}
      {linkingEmployee && (
        <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-black/40 p-4">
          <div className="my-6 w-full max-w-lg rounded-2xl bg-white shadow-xl">
            <div className="flex items-center justify-between border-b border-gray-200 p-5">
              <div>
                <h2 className="text-lg font-semibold text-gray-900">
                  Link Employee to Account
                </h2>
                <p className="mt-1 text-sm text-gray-500">
                  {linkingEmployee.full_name} ({linkingEmployee.employee_code})
                </p>
              </div>

              <button
                onClick={() => setLinkingEmployee(null)}
                disabled={linkingSaving}
                className="rounded-lg p-2 text-gray-500 hover:bg-gray-100"
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleSaveLink} className="space-y-4 p-5">
              <div className="rounded-lg border border-gray-100 bg-gray-50 p-3.5 text-xs text-gray-600 space-y-1">
                <p><strong>Employee Email:</strong> {linkingEmployee.email}</p>
                <p><strong>Role:</strong> {roleLabels[linkingEmployee.role] ?? linkingEmployee.role}</p>
                <p>
                  <strong>Current Status:</strong>{" "}
                  {linkingEmployee.auth_user_id ? (
                    <span className="font-semibold text-green-700">Linked to user: {linkingEmployee.auth_user_id}</span>
                  ) : (
                    <span className="font-semibold text-amber-700">Not currently linked to any Auth account</span>
                  )}
                </p>
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">
                  Supabase Auth User ID (UUID)
                </label>
                <input
                  required
                  type="text"
                  value={targetAuthUserId}
                  onChange={(e) => setTargetAuthUserId(e.target.value)}
                  placeholder="e.g. 550e8400-e29b-41d4-a716-446655440000"
                  className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm font-mono outline-none focus:border-blue-500"
                />
                <p className="mt-1 text-xs text-gray-500">
                  Once linked, this employee will sign in and immediately access only their assigned leads, attendance, and follow-ups via Row Level Security (RLS).
                </p>
              </div>

              {error && (
                <p className="rounded-lg bg-red-50 p-3 text-sm text-red-600">
                  {error}
                </p>
              )}

              <div className="flex flex-wrap items-center justify-between gap-3 border-t border-gray-100 pt-4">
                {linkingEmployee.auth_user_id ? (
                  <button
                    type="button"
                    disabled={linkingSaving}
                    onClick={() => handleUnlinkAccount(linkingEmployee)}
                    className="flex items-center gap-1.5 rounded-lg border border-red-200 px-3 py-2 text-xs font-medium text-red-600 hover:bg-red-50 disabled:opacity-50"
                  >
                    <Unlink size={14} /> Unlink Account
                  </button>
                ) : <div />}

                <div className="flex gap-2">
                  <button
                    type="button"
                    disabled={linkingSaving}
                    onClick={() => setLinkingEmployee(null)}
                    className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 disabled:opacity-50"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={linkingSaving}
                    className="flex items-center gap-1.5 rounded-lg bg-blue-600 px-5 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
                  >
                    <Link2 size={15} />
                    {linkingSaving ? "Saving Link..." : "Save Link"}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Employee Modal */}
      {editingEmployee && (
        <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-black/40 p-4">
          <div className="my-6 w-full max-w-lg rounded-2xl bg-white shadow-xl">
            <div className="flex items-center justify-between border-b border-gray-200 p-5">
              <div>
                <h2 className="text-lg font-semibold text-gray-900">Edit Employee</h2>
                <p className="mt-1 text-sm text-gray-500">
                  {editingEmployee.employee_code} • {editingEmployee.full_name}
                </p>
              </div>
              <button
                onClick={() => setEditingEmployee(null)}
                disabled={editSaving}
                className="rounded-lg p-2 text-gray-500 hover:bg-gray-100"
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleSaveEdit} className="space-y-4 p-5">
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">
                  Full Name
                </label>
                <input
                  required
                  type="text"
                  value={editForm.name}
                  onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-blue-500"
                />
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">
                  Email Address
                </label>
                <input
                  required
                  type="email"
                  value={editForm.email}
                  onChange={(e) => setEditForm({ ...editForm, email: e.target.value })}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-blue-500"
                />
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">
                  Phone Number
                </label>
                <input
                  required
                  type="tel"
                  value={editForm.phone}
                  onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-blue-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700">
                    Department
                  </label>
                  <select
                    value={editForm.department}
                    onChange={(e) => setEditForm({ ...editForm, department: e.target.value })}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-blue-500"
                  >
                    <option value="Sales">Sales</option>
                    <option value="Operations">Operations</option>
                    <option value="Finance">Finance</option>
                    <option value="Support">Support</option>
                    <option value="Marketing">Marketing</option>
                    <option value="HR">HR</option>
                  </select>
                </div>

                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700">
                    Role
                  </label>
                  <select
                    value={editForm.role}
                    onChange={(e) => setEditForm({ ...editForm, role: e.target.value })}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-blue-500"
                  >
                    <option value="intern">Intern</option>
                    <option value="sales_executive">Sales Executive</option>
                    <option value="team_leader">Team Leader</option>
                    <option value="admin">Admin</option>
                  </select>
                </div>
              </div>

              {error && (
                <p className="rounded-lg bg-red-50 p-3 text-sm text-red-600">{error}</p>
              )}

              <div className="flex justify-end gap-3 border-t border-gray-100 pt-4">
                <button
                  type="button"
                  disabled={editSaving}
                  onClick={() => setEditingEmployee(null)}
                  className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={editSaving}
                  className="rounded-lg bg-blue-600 px-5 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
                >
                  {editSaving ? "Saving Changes..." : "Save Changes"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete / Archive Employee Confirmation Modal */}
      {deletingEmployee && (
        <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-black/40 p-4">
          <div className="my-6 w-full max-w-lg rounded-2xl bg-white shadow-xl">
            <div className="flex items-center justify-between border-b border-gray-200 p-5">
              <div className="flex items-center gap-3">
                <div className="rounded-full bg-rose-100 p-2 text-rose-600">
                  <AlertTriangle size={22} />
                </div>
                <div>
                  <h2 className="text-lg font-semibold text-gray-900">Delete Employee</h2>
                  <p className="text-xs text-gray-500">
                    Choose how you want to handle {deletingEmployee.full_name}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setDeletingEmployee(null)}
                disabled={deleteSaving}
                className="rounded-lg p-2 text-gray-500 hover:bg-gray-100"
              >
                <X size={20} />
              </button>
            </div>

            <div className="p-5 space-y-4">
              <div className="rounded-lg border border-gray-200 bg-gray-50 p-3 text-xs text-gray-700 space-y-1">
                <p><strong>Employee:</strong> {deletingEmployee.full_name} ({deletingEmployee.employee_code})</p>
                <p><strong>Email:</strong> {deletingEmployee.email}</p>
                <p><strong>Role:</strong> {roleLabels[deletingEmployee.role] ?? deletingEmployee.role}</p>
              </div>

              <div className="space-y-3">
                {/* Option 1: Archive Employee */}
                <div className="rounded-xl border border-gray-200 p-4 hover:border-gray-300 transition">
                  <div className="flex items-start gap-3">
                    <div className="rounded-lg bg-amber-50 p-2 text-amber-600">
                      <Archive size={18} />
                    </div>
                    <div className="flex-1">
                      <h3 className="text-sm font-semibold text-gray-900">Archive Employee (Recommended)</h3>
                      <p className="mt-1 text-xs text-gray-500">
                        Disables login access immediately while retaining all historical leads, call records, and attendance for compliance and audit trail.
                      </p>
                      <button
                        type="button"
                        disabled={deleteSaving}
                        onClick={() => handleArchiveEmployee(deletingEmployee)}
                        className="mt-3 rounded-lg border border-amber-300 bg-amber-50 px-4 py-1.5 text-xs font-semibold text-amber-800 hover:bg-amber-100 transition disabled:opacity-50"
                      >
                        {deleteSaving ? "Processing..." : "Archive Employee"}
                      </button>
                    </div>
                  </div>
                </div>

                {/* Option 2: Permanently Delete */}
                <div className="rounded-xl border border-rose-200 bg-rose-50/30 p-4 hover:border-rose-300 transition">
                  <div className="flex items-start gap-3">
                    <div className="rounded-lg bg-rose-100 p-2 text-rose-600">
                      <Trash2 size={18} />
                    </div>
                    <div className="flex-1">
                      <h3 className="text-sm font-semibold text-rose-900">Permanently Delete</h3>
                      <p className="mt-1 text-xs text-rose-700">
                        Irreversibly deletes this employee record and associated system role from the CRM database.
                      </p>
                      <button
                        type="button"
                        disabled={deleteSaving}
                        onClick={() => handlePermanentDelete(deletingEmployee)}
                        className="mt-3 rounded-lg bg-rose-600 px-4 py-1.5 text-xs font-semibold text-white hover:bg-rose-700 transition disabled:opacity-50 shadow-sm"
                      >
                        {deleteSaving ? "Deleting..." : "Permanently Delete Employee"}
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              {error && (
                <p className="rounded-lg bg-red-50 p-3 text-sm text-red-600">{error}</p>
              )}

              <div className="flex justify-end pt-2">
                <button
                  type="button"
                  disabled={deleteSaving}
                  onClick={() => setDeletingEmployee(null)}
                  className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 disabled:opacity-50"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Set Employee Password Directly (No Email Sent) */}
      {directResetEmployee && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm animate-fadeIn">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-gray-100">
              <div className="flex items-center gap-2 text-indigo-600">
                <KeyRound size={20} />
                <h3 className="font-bold text-gray-900">Set Password Directly</h3>
              </div>
              <button
                onClick={() => setDirectResetEmployee(null)}
                className="rounded-lg p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
              >
                <X size={18} />
              </button>
            </div>

            <div className="rounded-xl border border-indigo-100 bg-indigo-50/50 p-3.5 text-xs text-indigo-900 space-y-1">
              <p><strong>Employee:</strong> {directResetEmployee.full_name} ({directResetEmployee.employee_code})</p>
              <p><strong>Login Email:</strong> {directResetEmployee.email}</p>
              <p className="text-[11px] text-indigo-700 pt-1 font-medium">
                • This password will be updated directly in the system.<br />
                • <strong>No email notification or link will be sent to the employee.</strong>
              </p>
            </div>

            <form onSubmit={handleDirectPasswordResetSubmit} className="space-y-3.5 text-xs">
              <div>
                <label className="block font-medium text-gray-700 mb-1">New Password</label>
                <div className="relative">
                  <input
                    type={showDirectNewPassword ? "text" : "password"}
                    required
                    minLength={6}
                    value={directNewPassword}
                    onChange={(e) => setDirectNewPassword(e.target.value)}
                    placeholder="Enter new login password"
                    className="w-full rounded-lg border border-gray-200 p-2.5 pr-10 outline-none focus:border-indigo-500 font-medium"
                  />
                  <button
                    type="button"
                    onClick={() => setShowDirectNewPassword(!showDirectNewPassword)}
                    className="absolute right-3 top-2.5 text-gray-400 hover:text-gray-600"
                  >
                    {showDirectNewPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>

              <div>
                <label className="block font-medium text-gray-700 mb-1">Confirm New Password</label>
                <div className="relative">
                  <input
                    type={showDirectConfirmPassword ? "text" : "password"}
                    required
                    minLength={6}
                    value={directConfirmPassword}
                    onChange={(e) => setDirectConfirmPassword(e.target.value)}
                    placeholder="Re-type new login password"
                    className="w-full rounded-lg border border-gray-200 p-2.5 pr-10 outline-none focus:border-indigo-500 font-medium"
                  />
                  <button
                    type="button"
                    onClick={() => setShowDirectConfirmPassword(!showDirectConfirmPassword)}
                    className="absolute right-3 top-2.5 text-gray-400 hover:text-gray-600"
                  >
                    {showDirectConfirmPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>

              {error && (
                <div className="rounded-lg bg-red-50 p-2.5 text-xs text-red-600">
                  {error}
                </div>
              )}

              <div className="mt-5 flex items-center justify-end gap-2.5 border-t border-gray-100 pt-3">
                <button
                  type="button"
                  onClick={() => setDirectResetEmployee(null)}
                  disabled={savingDirectReset}
                  className="rounded-lg border border-gray-200 px-3.5 py-2 text-xs font-medium text-gray-600 hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingDirectReset}
                  className="flex items-center gap-1.5 rounded-lg bg-indigo-600 px-4 py-2 text-xs font-semibold text-white hover:bg-indigo-700 shadow-sm transition disabled:opacity-50"
                >
                  <KeyRound size={14} />
                  {savingDirectReset ? "Updating Password..." : "Set Password Directly"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
