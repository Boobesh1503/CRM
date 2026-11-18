import { useState, useEffect, useMemo } from "react";
import {
  Banknote,
  IndianRupee,
  Users,
  Search,
  CheckCircle2,
  Clock,
  Printer,
  Download,
  Calendar,
  Plus,
  Edit2,
  Trash2,
  FileText,
  Eye,
  Check,
  X,
  AlertCircle,
  Copy,
  RefreshCw,
  GraduationCap,
  Shield,
  User,
  DollarSign,
  TrendingUp,
  Building2
} from "lucide-react";
import { supabase } from "../../services/supabase";

const SALARY_TABLES_SQL = `-- SQL Script for Supabase SQL Editor
CREATE TABLE IF NOT EXISTS public.salaries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id uuid NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE UNIQUE,
  payment_type text NOT NULL DEFAULT 'salary' CHECK (payment_type IN ('stipend', 'salary')),
  basic_amount numeric(12,2) NOT NULL DEFAULT 0,
  allowances numeric(12,2) DEFAULT 0,
  deductions numeric(12,2) DEFAULT 0,
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.payslips (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  payslip_number text UNIQUE NOT NULL,
  employee_id uuid NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  salary_month text NOT NULL,
  payment_type text NOT NULL DEFAULT 'salary',
  basic_amount numeric(12,2) NOT NULL,
  allowances numeric(12,2) DEFAULT 0,
  deductions numeric(12,2) DEFAULT 0,
  net_payable numeric(12,2) NOT NULL,
  payment_date date,
  payment_status text NOT NULL DEFAULT 'Pending' CHECK (payment_status IN ('Pending', 'Paid', 'Processing')),
  notes text,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.salaries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payslips ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins have full access to salaries" ON public.salaries FOR ALL USING (public.is_admin());
CREATE POLICY "Employees can view own salary" ON public.salaries FOR SELECT USING (employee_id = public.current_employee_id());
CREATE POLICY "Admins have full access to payslips" ON public.payslips FOR ALL USING (public.is_admin());
CREATE POLICY "Employees can view own payslips" ON public.payslips FOR SELECT USING (employee_id = public.current_employee_id());
`;

export interface SalaryStructure {
  id?: string;
  employee_id: string;
  payment_type: "stipend" | "salary";
  basic_amount: number;
  allowances: number;
  deductions: number;
}

export interface PayslipRecord {
  id: string;
  payslip_number: string;
  employee_id: string;
  salary_month: string;
  payment_type: "stipend" | "salary";
  basic_amount: number;
  allowances: number;
  deductions: number;
  net_payable: number;
  payment_date?: string;
  payment_status: "Paid" | "Pending" | "Processing";
  notes?: string;
  created_at?: string;
  employee?: {
    id: string;
    full_name: string;
    employee_code: string;
    role: string;
    department: string;
    email: string;
  };
}

const LOCAL_STORAGE_SALARIES = "crm_admin_salaries_cache";
const LOCAL_STORAGE_PAYSLIPS = "crm_admin_payslips_cache";

export default function SalaryManagement() {
  const [employees, setEmployees] = useState<any[]>([]);
  const [salaries, setSalaries] = useState<Record<string, SalaryStructure>>({});
  const [payslips, setPayslips] = useState<PayslipRecord[]>([]);
  const [loading, setLoading] = useState(true);

  const [activeTab, setActiveTab] = useState<"payslips" | "structures">("payslips");
  const [categoryFilter, setCategoryFilter] = useState<"all" | "intern" | "team_leader" | "staff">("all");
  const [search, setSearch] = useState("");
  const [selectedMonth, setSelectedMonth] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  });

  const [dbTableMissing, setDbTableMissing] = useState(false);
  const [copiedSql, setCopiedSql] = useState(false);
  const [successMsg, setSuccessMsg] = useState("");
  const [errorMsg, setErrorMsg] = useState("");

  // Set / Edit Salary Modal
  const [editingEmployee, setEditingEmployee] = useState<any | null>(null);
  const [modalPaymentType, setModalPaymentType] = useState<"stipend" | "salary">("salary");
  const [modalBasicAmount, setModalBasicAmount] = useState<number>(20000);
  const [modalAllowances, setModalAllowances] = useState<number>(2000);
  const [modalDeductions, setModalDeductions] = useState<number>(0);
  const [savingSalary, setSavingSalary] = useState(false);

  // Generate Payslip Modal
  const [generateModalOpen, setGenerateModalOpen] = useState(false);
  const [genTargetEmpId, setGenTargetEmpId] = useState("");
  const [genMonth, setGenMonth] = useState(selectedMonth);

  // View / Print Payslip Modal
  const [selectedPayslipForPrint, setSelectedPayslipForPrint] = useState<PayslipRecord | null>(null);

  // Load All Data
  async function loadData() {
    setLoading(true);
    setErrorMsg("");
    setDbTableMissing(false);

    try {
      // 1. Load active employees
      const { data: empsData } = await supabase
        .from("employees")
        .select("*")
        .eq("employment_status", "active")
        .order("full_name");

      const emps = empsData || [];
      setEmployees(emps);

      // 2. Load salary structures
      const { data: salData, error: salErr } = await supabase
        .from("salaries")
        .select("*");

      if (salErr) {
        if (salErr.code === "PGRST205" || salErr.message.includes("does not exist") || salErr.message.includes("schema cache")) {
          setDbTableMissing(true);
        }
        const cachedSal = localStorage.getItem(LOCAL_STORAGE_SALARIES);
        if (cachedSal) {
          try {
            setSalaries(JSON.parse(cachedSal));
          } catch {
            setSalaries({});
          }
        }
      } else {
        const salMap: Record<string, SalaryStructure> = {};
        (salData || []).forEach((s) => {
          salMap[s.employee_id] = s;
        });
        setSalaries(salMap);
        localStorage.setItem(LOCAL_STORAGE_SALARIES, JSON.stringify(salMap));
      }

      // 3. Load payslips
      const { data: payData, error: payErr } = await supabase
        .from("payslips")
        .select(`
          *,
          employee:employees (id, full_name, employee_code, role, department, email)
        `)
        .order("created_at", { ascending: false });

      if (payErr) {
        const cachedPay = localStorage.getItem(LOCAL_STORAGE_PAYSLIPS);
        if (cachedPay) {
          try {
            setPayslips(JSON.parse(cachedPay));
          } catch {
            setPayslips([]);
          }
        }
      } else {
        const list = (payData || []).map((p: any) => ({
          ...p,
          employee: Array.isArray(p.employee) ? p.employee[0] : p.employee,
        }));
        setPayslips(list);
        localStorage.setItem(LOCAL_STORAGE_PAYSLIPS, JSON.stringify(list));
      }
    } catch {
      // Caches
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
  }, []);

  // Open Edit Salary Modal
  function handleOpenSalaryModal(emp: any) {
    setEditingEmployee(emp);
    const existing = salaries[emp.id];
    const isIntern = (emp.role || "").toLowerCase().includes("intern");

    if (existing) {
      setModalPaymentType(existing.payment_type);
      setModalBasicAmount(existing.basic_amount);
      setModalAllowances(existing.allowances);
      setModalDeductions(existing.deductions);
    } else {
      setModalPaymentType(isIntern ? "stipend" : "salary");
      setModalBasicAmount(isIntern ? 10000 : 35000);
      setModalAllowances(isIntern ? 0 : 3000);
      setModalDeductions(isIntern ? 0 : 1500);
    }
  }

  // Save Salary Structure
  async function handleSaveSalary(e: React.FormEvent) {
    e.preventDefault();
    if (!editingEmployee) return;

    setSavingSalary(true);
    const newStructure: SalaryStructure = {
      employee_id: editingEmployee.id,
      payment_type: modalPaymentType,
      basic_amount: Number(modalBasicAmount) || 0,
      allowances: Number(modalAllowances) || 0,
      deductions: Number(modalDeductions) || 0,
    };

    try {
      const { error } = await supabase
        .from("salaries")
        .upsert(newStructure, { onConflict: "employee_id" });

      if (error) {
        console.warn("Using local cache for salary structure:", error.message);
      }

      const updated = { ...salaries, [editingEmployee.id]: newStructure };
      setSalaries(updated);
      localStorage.setItem(LOCAL_STORAGE_SALARIES, JSON.stringify(updated));

      setSuccessMsg(`Salary structure for ${editingEmployee.full_name} saved!`);
      setTimeout(() => setSuccessMsg(""), 4000);
      setEditingEmployee(null);
    } catch (err) {
      setErrorMsg("Failed to save salary details.");
    } finally {
      setSavingSalary(false);
    }
  }

  // Generate Payslip for Employee
  async function handleGeneratePayslip() {
    if (!genTargetEmpId) {
      setErrorMsg("Please select an employee.");
      return;
    }

    const emp = employees.find((e) => e.id === genTargetEmpId);
    if (!emp) return;

    const sal = salaries[genTargetEmpId] || {
      payment_type: (emp.role || "").toLowerCase().includes("intern") ? "stipend" : "salary",
      basic_amount: (emp.role || "").toLowerCase().includes("intern") ? 10000 : 35000,
      allowances: (emp.role || "").toLowerCase().includes("intern") ? 0 : 3000,
      deductions: (emp.role || "").toLowerCase().includes("intern") ? 0 : 1500,
    };

    const netPayable = Math.max(0, sal.basic_amount + sal.allowances - sal.deductions);
    const cleanMonth = genMonth.replace("-", "");
    const uniqueNumber = `PAY-${cleanMonth}-${String(payslips.length + 1).padStart(3, "0")}`;

    const newPayslip: Omit<PayslipRecord, "id"> = {
      payslip_number: uniqueNumber,
      employee_id: emp.id,
      salary_month: genMonth,
      payment_type: sal.payment_type,
      basic_amount: sal.basic_amount,
      allowances: sal.allowances,
      deductions: sal.deductions,
      net_payable: netPayable,
      payment_date: new Date().toISOString().split("T")[0],
      payment_status: "Paid",
      employee: {
        id: emp.id,
        full_name: emp.full_name,
        employee_code: emp.employee_code,
        role: emp.role,
        department: emp.department || "Sales",
        email: emp.email,
      },
    };

    try {
      const { data, error } = await supabase
        .from("payslips")
        .insert({
          payslip_number: newPayslip.payslip_number,
          employee_id: newPayslip.employee_id,
          salary_month: newPayslip.salary_month,
          payment_type: newPayslip.payment_type,
          basic_amount: newPayslip.basic_amount,
          allowances: newPayslip.allowances,
          deductions: newPayslip.deductions,
          net_payable: newPayslip.net_payable,
          payment_date: newPayslip.payment_date,
          payment_status: newPayslip.payment_status,
        })
        .select()
        .single();

      let saved: PayslipRecord;
      if (error) {
        console.warn("Using local cache for payslip:", error.message);
        saved = { ...newPayslip, id: `pay_${Date.now()}` };
      } else {
        saved = { ...newPayslip, id: data.id };
      }

      const updated = [saved, ...payslips];
      setPayslips(updated);
      localStorage.setItem(LOCAL_STORAGE_PAYSLIPS, JSON.stringify(updated));

      setSuccessMsg(`Payslip ${saved.payslip_number} generated for ${emp.full_name}!`);
      setTimeout(() => setSuccessMsg(""), 4000);
      setGenerateModalOpen(false);
    } catch {
      setErrorMsg("Failed to generate payslip.");
    }
  }

  // Toggle Payment Status
  async function handleToggleStatus(payslip: PayslipRecord) {
    const nextStatus: PayslipRecord["payment_status"] = payslip.payment_status === "Paid" ? "Pending" : "Paid";
    try {
      await supabase.from("payslips").update({ payment_status: nextStatus }).eq("id", payslip.id);
      const updated = payslips.map((p) => (p.id === payslip.id ? { ...p, payment_status: nextStatus } : p));
      setPayslips(updated);
      localStorage.setItem(LOCAL_STORAGE_PAYSLIPS, JSON.stringify(updated));
    } catch {
      setErrorMsg("Failed to toggle payment status.");
    }
  }

  // Delete Payslip
  async function handleDeletePayslip(id: string) {
    if (!confirm("Are you sure you want to delete this payslip record?")) return;
    try {
      await supabase.from("payslips").delete().eq("id", id);
      const updated = payslips.filter((p) => p.id !== id);
      setPayslips(updated);
      localStorage.setItem(LOCAL_STORAGE_PAYSLIPS, JSON.stringify(updated));
    } catch {
      setErrorMsg("Failed to delete payslip.");
    }
  }

  // Filtered Payslips
  const filteredPayslips = useMemo(() => {
    return payslips.filter((p) => {
      const q = search.toLowerCase();
      const empName = p.employee?.full_name?.toLowerCase() || "";
      const empCode = p.employee?.employee_code?.toLowerCase() || "";
      const num = p.payslip_number.toLowerCase();
      const matchesSearch = !q || empName.includes(q) || empCode.includes(q) || num.includes(q);

      const matchesMonth = !selectedMonth || p.salary_month === selectedMonth;

      const role = (p.employee?.role || "").toLowerCase();
      let matchesCat = true;
      if (categoryFilter === "intern") {
        matchesCat = role.includes("intern");
      } else if (categoryFilter === "team_leader") {
        matchesCat = role.includes("leader") || role.includes("tl");
      } else if (categoryFilter === "staff") {
        matchesCat = !role.includes("intern") && !role.includes("leader") && !role.includes("tl");
      }

      return matchesSearch && matchesMonth && matchesCat;
    });
  }, [payslips, search, selectedMonth, categoryFilter]);

  // Financial Metrics
  const totalPayrollMonth = filteredPayslips.reduce((sum, p) => sum + Number(p.net_payable || 0), 0);
  const paidPayrollMonth = filteredPayslips
    .filter((p) => p.payment_status === "Paid")
    .reduce((sum, p) => sum + Number(p.net_payable || 0), 0);

  const internsPaidCount = filteredPayslips.filter(
    (p) => (p.employee?.role || "").toLowerCase().includes("intern") && p.payment_status === "Paid"
  ).length;

  const tlsPaidCount = filteredPayslips.filter(
    (p) =>
      ((p.employee?.role || "").toLowerCase().includes("leader") || (p.employee?.role || "").toLowerCase().includes("tl")) &&
      p.payment_status === "Paid"
  ).length;

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Salary & Payslip Management</h1>
          <p className="mt-1 text-sm text-gray-500">
            Manage Intern stipends, Team Leader salaries, generate professional payslips, and monitor monthly payroll.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          {/* Tab Selector */}
          <div className="flex items-center rounded-xl bg-gray-100 p-1 border border-gray-200">
            <button
              onClick={() => setActiveTab("payslips")}
              className={`rounded-lg px-3.5 py-1.5 text-xs font-semibold transition ${
                activeTab === "payslips" ? "bg-white text-gray-900 shadow-sm" : "text-gray-600 hover:text-gray-900"
              }`}
            >
              Payslips & Payments
            </button>
            <button
              onClick={() => setActiveTab("structures")}
              className={`rounded-lg px-3.5 py-1.5 text-xs font-semibold transition ${
                activeTab === "structures" ? "bg-white text-gray-900 shadow-sm" : "text-gray-600 hover:text-gray-900"
              }`}
            >
              Salary Structures
            </button>
          </div>

          <button
            onClick={() => {
              setGenTargetEmpId(employees[0]?.id || "");
              setGenMonth(selectedMonth);
              setGenerateModalOpen(true);
            }}
            className="flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 shadow-sm transition"
          >
            <Plus size={16} />
            Generate Payslip
          </button>
        </div>
      </div>

      {/* SQL Missing Notice */}
      {dbTableMissing && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 shadow-sm animate-fadeIn">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-start gap-2.5">
              <AlertCircle size={20} className="text-amber-600 shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold text-amber-900 text-sm">
                  Database Notice: `salaries` & `payslips` tables not yet found in Supabase
                </p>
                <p className="mt-0.5 text-xs text-amber-700">
                  Salaries and payslips are currently operational with local storage fallback. Run the SQL script in your Supabase SQL editor to sync with remote tables.
                </p>
              </div>
            </div>
            <button
              onClick={() => {
                navigator.clipboard.writeText(SALARY_TABLES_SQL);
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

      {/* Success / Error Messages */}
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

      {/* 4 Summary Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-4">
        <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <p className="text-xs font-medium text-gray-500">Monthly Payroll Net</p>
            <div className="rounded-lg bg-blue-50 p-2 text-blue-600">
              <Banknote size={18} />
            </div>
          </div>
          <p className="mt-3 text-2xl font-bold text-gray-900">
            ₹{totalPayrollMonth.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
          </p>
          <span className="mt-1 block text-xs text-gray-400">Total payable for {selectedMonth}</span>
        </div>

        <div className="rounded-xl border border-emerald-200 bg-emerald-50/50 p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <p className="text-xs font-medium text-emerald-800">Disbursed / Paid</p>
            <div className="rounded-lg bg-emerald-100 p-2 text-emerald-700">
              <CheckCircle2 size={18} />
            </div>
          </div>
          <p className="mt-3 text-2xl font-bold text-emerald-600">
            ₹{paidPayrollMonth.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
          </p>
          <span className="mt-1 block text-xs text-emerald-700 font-medium">Cleared disbursements</span>
        </div>

        <div className="rounded-xl border border-purple-200 bg-purple-50/50 p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <p className="text-xs font-medium text-purple-900">Intern Stipends Paid</p>
            <div className="rounded-lg bg-purple-100 p-2 text-purple-700">
              <GraduationCap size={18} />
            </div>
          </div>
          <p className="mt-3 text-3xl font-bold text-purple-700">{internsPaidCount}</p>
          <span className="mt-1 block text-xs text-purple-900 font-medium">Intern stipend payouts</span>
        </div>

        <div className="rounded-xl border border-amber-200 bg-amber-50/50 p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <p className="text-xs font-medium text-amber-900">TL Salaries Paid</p>
            <div className="rounded-lg bg-amber-100 p-2 text-amber-700">
              <Shield size={18} />
            </div>
          </div>
          <p className="mt-3 text-3xl font-bold text-amber-600">{tlsPaidCount}</p>
          <span className="mt-1 block text-xs text-amber-700 font-medium">Leadership team payouts</span>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* TAB 1: PAYSLIPS & DISBURSEMENTS                                           */}
      {/* ========================================================================= */}
      {activeTab === "payslips" ? (
        <div className="rounded-xl border border-gray-200 bg-white shadow-sm overflow-hidden animate-fadeIn">
          {/* Sub-section Category Tabs (Interns vs Team Leaders vs All) */}
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
                All Workforce
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
                Intern Stipends
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
                Team Leader Salaries
              </button>
            </div>

            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-xs text-gray-700 shadow-sm">
                <Calendar size={14} className="text-gray-400" />
                <input
                  type="month"
                  value={selectedMonth}
                  onChange={(e) => setSelectedMonth(e.target.value)}
                  className="bg-transparent font-medium outline-none cursor-pointer"
                />
              </div>

              <div className="flex items-center gap-2 rounded-lg border border-gray-200 px-3 py-1.5 bg-white">
                <Search size={14} className="text-gray-400" />
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search payslip, employee..."
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
                  <th className="px-5 py-3.5">Payslip #</th>
                  <th className="px-5 py-3.5">Employee</th>
                  <th className="px-5 py-3.5">Category</th>
                  <th className="px-5 py-3.5">Salary Month</th>
                  <th className="px-5 py-3.5 text-right">Basic / Stipend</th>
                  <th className="px-5 py-3.5 text-right">Allowances</th>
                  <th className="px-5 py-3.5 text-right">Deductions</th>
                  <th className="px-5 py-3.5 text-right">Net Payable</th>
                  <th className="px-5 py-3.5">Status</th>
                  <th className="px-5 py-3.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {loading ? (
                  <tr>
                    <td colSpan={10} className="py-12 text-center text-sm text-gray-500">
                      <RefreshCw size={24} className="mx-auto mb-2 animate-spin text-blue-600" />
                      Loading payslip records...
                    </td>
                  </tr>
                ) : filteredPayslips.length === 0 ? (
                  <tr>
                    <td colSpan={10} className="py-12 text-center">
                      <Banknote size={36} className="mx-auto mb-3 text-gray-300" />
                      <p className="text-sm font-medium text-gray-700">No payslips found for {selectedMonth}</p>
                      <p className="mt-1 text-xs text-gray-400">
                        Click "Generate Payslip" to disburse a stipend or salary.
                      </p>
                    </td>
                  </tr>
                ) : (
                  filteredPayslips.map((p) => {
                    const isIntern = (p.employee?.role || "").toLowerCase().includes("intern");
                    const isTL =
                      (p.employee?.role || "").toLowerCase().includes("leader") ||
                      (p.employee?.role || "").toLowerCase().includes("tl");

                    return (
                      <tr key={p.id} className="hover:bg-gray-50/70 transition">
                        <td className="px-5 py-4">
                          <span className="font-bold text-gray-900">{p.payslip_number}</span>
                        </td>

                        <td className="px-5 py-4">
                          <div>
                            <p className="font-semibold text-gray-900">{p.employee?.full_name || "Employee"}</p>
                            <p className="text-xs text-gray-500">{p.employee?.employee_code || "EMP-XXXX"}</p>
                          </div>
                        </td>

                        <td className="px-5 py-4">
                          {isIntern ? (
                            <span className="inline-flex items-center gap-1 rounded-full bg-purple-50 px-2.5 py-0.5 text-xs font-semibold text-purple-700 border border-purple-200">
                              <GraduationCap size={12} /> Stipend
                            </span>
                          ) : isTL ? (
                            <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2.5 py-0.5 text-xs font-semibold text-amber-700 border border-amber-200">
                              <Shield size={12} /> TL Salary
                            </span>
                          ) : (
                            <span className="inline-flex items-center rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-medium text-gray-600">
                              Salary
                            </span>
                          )}
                        </td>

                        <td className="px-5 py-4 text-xs font-medium text-gray-700">
                          {p.salary_month}
                        </td>

                        <td className="px-5 py-4 text-right text-xs font-medium text-gray-700">
                          ₹{Number(p.basic_amount).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                        </td>

                        <td className="px-5 py-4 text-right text-xs font-medium text-emerald-600">
                          +₹{Number(p.allowances).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                        </td>

                        <td className="px-5 py-4 text-right text-xs font-medium text-rose-600">
                          -₹{Number(p.deductions).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                        </td>

                        <td className="px-5 py-4 text-right font-bold text-gray-900 text-sm">
                          ₹{Number(p.net_payable).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                        </td>

                        <td className="px-5 py-4">
                          <button
                            onClick={() => handleToggleStatus(p)}
                            className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold border transition ${
                              p.payment_status === "Paid"
                                ? "bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100"
                                : "bg-amber-50 text-amber-700 border-amber-200 hover:bg-amber-100"
                            }`}
                            title="Click to toggle Paid/Pending"
                          >
                            {p.payment_status === "Paid" ? <Check size={12} /> : <Clock size={12} />}
                            {p.payment_status}
                          </button>
                        </td>

                        <td className="px-5 py-4 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            {/* View / Print Payslip */}
                            <button
                              onClick={() => setSelectedPayslipForPrint(p)}
                              className="rounded-lg border border-gray-200 p-1.5 text-gray-600 hover:bg-gray-100 hover:text-gray-900 transition"
                              title="View & Print Payslip"
                            >
                              <Eye size={15} />
                            </button>

                            {/* Delete Payslip */}
                            <button
                              onClick={() => handleDeletePayslip(p.id)}
                              className="rounded-lg border border-gray-200 p-1.5 text-gray-400 hover:text-rose-600 hover:bg-rose-50 transition"
                              title="Delete Record"
                            >
                              <Trash2 size={15} />
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
      ) : (
        /* ========================================================================= */
        /* TAB 2: EMPLOYEE SALARY STRUCTURES & SETUP                                 */
        /* ========================================================================= */
        <div className="rounded-xl border border-gray-200 bg-white shadow-sm overflow-hidden animate-fadeIn">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-gray-100 bg-gray-50/60 p-4">
            <div>
              <h2 className="font-semibold text-gray-900">Workforce Stipend & Salary Structures</h2>
              <p className="text-xs text-gray-500">Configure base rates, allowances, and deductions for each employee</p>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-gray-600">
              <thead className="bg-gray-50 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                <tr>
                  <th className="px-5 py-3.5">Employee</th>
                  <th className="px-5 py-3.5">Designation</th>
                  <th className="px-5 py-3.5">Payment Type</th>
                  <th className="px-5 py-3.5 text-right">Base Amount (₹)</th>
                  <th className="px-5 py-3.5 text-right">Allowances (₹)</th>
                  <th className="px-5 py-3.5 text-right">Deductions (₹)</th>
                  <th className="px-5 py-3.5 text-right">Est. Net Payable (₹)</th>
                  <th className="px-5 py-3.5 text-right">Configure</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {employees.map((emp) => {
                  const struct = salaries[emp.id];
                  const isIntern = (emp.role || "").toLowerCase().includes("intern");
                  const isTL =
                    (emp.role || "").toLowerCase().includes("leader") ||
                    (emp.role || "").toLowerCase().includes("tl");

                  const base = struct ? struct.basic_amount : isIntern ? 10000 : 35000;
                  const allow = struct ? struct.allowances : isIntern ? 0 : 3000;
                  const deduct = struct ? struct.deductions : isIntern ? 0 : 1500;
                  const net = base + allow - deduct;

                  return (
                    <tr key={emp.id} className="hover:bg-gray-50/70 transition">
                      <td className="px-5 py-4">
                        <p className="font-semibold text-gray-900">{emp.full_name}</p>
                        <p className="text-xs text-gray-500">{emp.employee_code}</p>
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
                          <span className="text-xs font-medium text-gray-700">{emp.role}</span>
                        )}
                      </td>

                      <td className="px-5 py-4 font-semibold text-xs capitalize text-gray-800">
                        {struct?.payment_type || (isIntern ? "stipend" : "salary")}
                      </td>

                      <td className="px-5 py-4 text-right font-medium text-gray-900 text-xs">
                        ₹{base.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                      </td>

                      <td className="px-5 py-4 text-right font-medium text-emerald-600 text-xs">
                        +₹{allow.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                      </td>

                      <td className="px-5 py-4 text-right font-medium text-rose-600 text-xs">
                        -₹{deduct.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                      </td>

                      <td className="px-5 py-4 text-right font-bold text-gray-900 text-xs">
                        ₹{net.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                      </td>

                      <td className="px-5 py-4 text-right">
                        <button
                          onClick={() => handleOpenSalaryModal(emp)}
                          className="flex items-center gap-1 ml-auto rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-semibold text-blue-600 hover:bg-blue-50 transition"
                        >
                          <Edit2 size={13} />
                          {struct ? "Edit" : "Set Salary"}
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 1: CONFIGURE EMPLOYEE SALARY / STIPEND                              */}
      {/* ========================================================================= */}
      {editingEmployee && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm animate-fadeIn">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-gray-100">
              <div className="flex items-center gap-2 text-blue-600">
                <Banknote size={20} />
                <h3 className="font-semibold text-gray-900">
                  Configure Salary — {editingEmployee.full_name}
                </h3>
              </div>
              <button
                onClick={() => setEditingEmployee(null)}
                className="rounded-lg p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSaveSalary} className="space-y-3.5 text-xs">
              <div>
                <label className="block font-medium text-gray-700 mb-1">Payment Category</label>
                <select
                  value={modalPaymentType}
                  onChange={(e) => setModalPaymentType(e.target.value as "stipend" | "salary")}
                  className="w-full rounded-lg border border-gray-200 p-2.5 outline-none focus:border-blue-500 bg-white"
                >
                  <option value="stipend">Intern Stipend</option>
                  <option value="salary">Regular Salary (Team Leader / Staff)</option>
                </select>
              </div>

              <div>
                <label className="block font-medium text-gray-700 mb-1">
                  Basic Amount ({modalPaymentType === "stipend" ? "Stipend" : "Base Salary"}) ₹
                </label>
                <input
                  type="number"
                  required
                  min="0"
                  step="500"
                  value={modalBasicAmount}
                  onChange={(e) => setModalBasicAmount(parseFloat(e.target.value) || 0)}
                  className="w-full rounded-lg border border-gray-200 p-2.5 outline-none focus:border-blue-500 font-semibold text-gray-900"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-medium text-gray-700 mb-1">Allowances (₹)</label>
                  <input
                    type="number"
                    min="0"
                    step="100"
                    value={modalAllowances}
                    onChange={(e) => setModalAllowances(parseFloat(e.target.value) || 0)}
                    className="w-full rounded-lg border border-gray-200 p-2.5 outline-none focus:border-blue-500 text-emerald-600 font-medium"
                  />
                </div>

                <div>
                  <label className="block font-medium text-gray-700 mb-1">Deductions (₹)</label>
                  <input
                    type="number"
                    min="0"
                    step="100"
                    value={modalDeductions}
                    onChange={(e) => setModalDeductions(parseFloat(e.target.value) || 0)}
                    className="w-full rounded-lg border border-gray-200 p-2.5 outline-none focus:border-blue-500 text-rose-600 font-medium"
                  />
                </div>
              </div>

              {/* Net Computed Box */}
              <div className="rounded-xl border border-gray-100 bg-gray-50 p-3.5 flex items-center justify-between">
                <span className="font-semibold text-gray-600">Calculated Net Payable:</span>
                <span className="font-bold text-gray-900 text-sm">
                  ₹{Math.max(0, modalBasicAmount + modalAllowances - modalDeductions).toLocaleString("en-IN", {
                    minimumFractionDigits: 2,
                  })}
                </span>
              </div>

              <div className="mt-5 flex items-center justify-end gap-2.5 border-t border-gray-100 pt-3">
                <button
                  type="button"
                  onClick={() => setEditingEmployee(null)}
                  className="rounded-lg border border-gray-200 px-3.5 py-2 text-xs font-medium text-gray-600 hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingSalary}
                  className="flex items-center gap-1.5 rounded-lg bg-blue-600 px-4 py-2 text-xs font-semibold text-white hover:bg-blue-700 shadow-sm transition disabled:opacity-50"
                >
                  <Check size={14} />
                  Save Structure
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 2: GENERATE MONTHLY PAYSLIP                                         */}
      {/* ========================================================================= */}
      {generateModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm animate-fadeIn">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-gray-100">
              <div className="flex items-center gap-2 text-blue-600">
                <FileText size={20} />
                <h3 className="font-semibold text-gray-900">Generate Employee Payslip</h3>
              </div>
              <button
                onClick={() => setGenerateModalOpen(false)}
                className="rounded-lg p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
              >
                <X size={18} />
              </button>
            </div>

            <div className="space-y-3.5 text-xs">
              <div>
                <label className="block font-medium text-gray-700 mb-1">Select Employee</label>
                <select
                  value={genTargetEmpId}
                  onChange={(e) => setGenTargetEmpId(e.target.value)}
                  className="w-full rounded-lg border border-gray-200 p-2.5 outline-none focus:border-blue-500 bg-white font-medium"
                >
                  {employees.map((emp) => (
                    <option key={emp.id} value={emp.id}>
                      {emp.full_name} ({emp.employee_code} • {emp.role})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block font-medium text-gray-700 mb-1">Salary Month</label>
                <input
                  type="month"
                  value={genMonth}
                  onChange={(e) => setGenMonth(e.target.value)}
                  className="w-full rounded-lg border border-gray-200 p-2.5 outline-none focus:border-blue-500 font-medium"
                />
              </div>

              <div className="mt-5 flex items-center justify-end gap-2.5 border-t border-gray-100 pt-3">
                <button
                  type="button"
                  onClick={() => setGenerateModalOpen(false)}
                  className="rounded-lg border border-gray-200 px-3.5 py-2 text-xs font-medium text-gray-600 hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleGeneratePayslip}
                  className="flex items-center gap-1.5 rounded-lg bg-blue-600 px-4 py-2 text-xs font-semibold text-white hover:bg-blue-700 shadow-sm transition"
                >
                  <Check size={14} />
                  Generate & Record Payslip
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 3: VIEW & PRINT PROFESSIONAL PAYSLIP                                */}
      {/* ========================================================================= */}
      {selectedPayslipForPrint && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm animate-fadeIn overflow-y-auto">
          <div className="w-full max-w-2xl rounded-2xl bg-white p-8 shadow-2xl space-y-6 my-6">
            {/* Modal Top Actions */}
            <div className="flex items-center justify-between border-b border-gray-100 pb-3">
              <span className="font-bold text-gray-900 text-sm">
                Payslip Document — {selectedPayslipForPrint.payslip_number}
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => window.print()}
                  className="flex items-center gap-1.5 rounded-lg bg-blue-600 px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-blue-700 shadow-sm"
                >
                  <Printer size={14} />
                  Print / Download PDF
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedPayslipForPrint(null)}
                  className="rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-100"
                >
                  Close
                </button>
              </div>
            </div>

            {/* Printable Payslip Layout */}
            <div className="border border-gray-200 rounded-xl p-8 bg-white text-xs space-y-6 shadow-sm">
              {/* Company Header */}
              <div className="flex justify-between items-start border-b border-gray-200 pb-5">
                <div>
                  <div className="flex items-center gap-2 text-emerald-600 font-extrabold text-xl">
                    ▲ kodefy INFO TECH
                  </div>
                  <p className="text-gray-500 mt-1">Coding Your Vision, Marketing Your Mission</p>
                  <p className="text-gray-400 text-[11px] mt-0.5">contact@kodefy.com | +91 98765 43210</p>
                </div>
                <div className="text-right">
                  <span className="font-bold uppercase tracking-wider text-gray-400 text-[10px] block">
                    Official Salary Slip
                  </span>
                  <h2 className="text-xl font-extrabold text-gray-900 mt-0.5">{selectedPayslipForPrint.salary_month}</h2>
                  <span className="text-xs font-semibold text-blue-600 block mt-1">
                    {selectedPayslipForPrint.payslip_number}
                  </span>
                </div>
              </div>

              {/* Employee & Payment Metadata Grid */}
              <div className="grid grid-cols-2 gap-4 bg-gray-50 p-4 rounded-xl border border-gray-100">
                <div className="space-y-1.5">
                  <p className="text-gray-500">Employee Name: <span className="font-bold text-gray-900">{selectedPayslipForPrint.employee?.full_name}</span></p>
                  <p className="text-gray-500">Employee ID: <span className="font-semibold text-gray-800">{selectedPayslipForPrint.employee?.employee_code}</span></p>
                  <p className="text-gray-500">Designation / Role: <span className="font-semibold text-gray-800 capitalize">{selectedPayslipForPrint.employee?.role}</span></p>
                </div>
                <div className="space-y-1.5 text-right">
                  <p className="text-gray-500">Department: <span className="font-semibold text-gray-800">{selectedPayslipForPrint.employee?.department || "Sales"}</span></p>
                  <p className="text-gray-500">Payment Date: <span className="font-semibold text-gray-800">{selectedPayslipForPrint.payment_date || "N/A"}</span></p>
                  <p className="text-gray-500">Payment Status: <span className="font-bold text-emerald-600">{selectedPayslipForPrint.payment_status}</span></p>
                </div>
              </div>

              {/* Earnings & Deductions Breakdown Table */}
              <div className="grid grid-cols-2 gap-6">
                {/* Earnings */}
                <div className="rounded-lg border border-gray-200 overflow-hidden">
                  <div className="bg-gray-100 px-3.5 py-2 font-bold text-gray-800 text-[11px] uppercase tracking-wider">
                    Earnings
                  </div>
                  <div className="p-3.5 space-y-2">
                    <div className="flex justify-between">
                      <span className="text-gray-600">Basic {selectedPayslipForPrint.payment_type === "stipend" ? "Stipend" : "Salary"}:</span>
                      <span className="font-semibold text-gray-900">₹{Number(selectedPayslipForPrint.basic_amount).toLocaleString("en-IN", { minimumFractionDigits: 2 })}</span>
                    </div>
                    {Number(selectedPayslipForPrint.allowances) > 0 && (
                      <div className="flex justify-between">
                        <span className="text-gray-600">Standard Allowances:</span>
                        <span className="font-semibold text-emerald-600">+₹{Number(selectedPayslipForPrint.allowances).toLocaleString("en-IN", { minimumFractionDigits: 2 })}</span>
                      </div>
                    )}
                    <div className="flex justify-between font-bold border-t border-gray-100 pt-2 text-gray-900">
                      <span>Total Gross:</span>
                      <span>₹{(Number(selectedPayslipForPrint.basic_amount) + Number(selectedPayslipForPrint.allowances)).toLocaleString("en-IN", { minimumFractionDigits: 2 })}</span>
                    </div>
                  </div>
                </div>

                {/* Deductions */}
                <div className="rounded-lg border border-gray-200 overflow-hidden">
                  <div className="bg-gray-100 px-3.5 py-2 font-bold text-gray-800 text-[11px] uppercase tracking-wider">
                    Deductions
                  </div>
                  <div className="p-3.5 space-y-2">
                    <div className="flex justify-between">
                      <span className="text-gray-600">Provident Fund / Tax / Leave:</span>
                      <span className="font-semibold text-rose-600">-₹{Number(selectedPayslipForPrint.deductions).toLocaleString("en-IN", { minimumFractionDigits: 2 })}</span>
                    </div>
                    <div className="flex justify-between font-bold border-t border-gray-100 pt-2 text-gray-900">
                      <span>Total Deductions:</span>
                      <span>₹{Number(selectedPayslipForPrint.deductions).toLocaleString("en-IN", { minimumFractionDigits: 2 })}</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Net Payable Highlight */}
              <div className="rounded-xl border border-emerald-200 bg-emerald-50/70 p-4 flex items-center justify-between">
                <div>
                  <span className="text-emerald-800 font-bold text-sm block">NET PAYABLE AMOUNT</span>
                  <span className="text-xs text-emerald-600">Directly transferred / credited</span>
                </div>
                <div className="text-2xl font-black text-emerald-700">
                  ₹{Number(selectedPayslipForPrint.net_payable).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                </div>
              </div>

              {/* Signatures & Notice */}
              <div className="pt-6 border-t border-gray-100 flex justify-between items-end text-gray-400 text-[11px]">
                <div>
                  <p>Computer generated payslip. No physical signature required.</p>
                  <p>kodefy INFO TECH Private Limited</p>
                </div>
                <div className="text-right">
                  <div className="w-36 border-b border-gray-300 pb-1 mb-1"></div>
                  <p className="font-semibold text-gray-600">Authorized Signatory</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

