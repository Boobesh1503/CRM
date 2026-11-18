import { useState, useEffect, useMemo, useRef, type ChangeEvent } from "react";
import {
  Users,
  UserCheck,
  Clock,
  CheckCircle2,
  TrendingUp,
  FileSpreadsheet,
  UploadCloud,
  Plus,
  Search,
  Calendar,
  X,
  RefreshCw,
  Trash2,
  UserPlus,
  Shield,
  GraduationCap,
  AlertTriangle,
  ChevronLeft,
  ChevronRight,
  Download,
  Filter,
  Check,
  Phone,
  Mail,
  Building
} from "lucide-react";
import * as XLSX from "xlsx";
import { supabase } from "../../services/supabase";
import { notifyEmployee } from "../../services/notifications";

interface LeadItem {
  id: string;
  name: string;
  company: string | null;
  email: string | null;
  phone: string | null;
  value: string | null;
  stage: string;
  assigned_to: string | null;
  source: string | null;
  remarks: string | null;
  created_at: string;
  assignedEmployee?: {
    id: string;
    full_name: string;
    employee_code: string;
    role: string;
  } | null;
}

interface EmployeeOption {
  id: string;
  full_name: string;
  employee_code: string;
  role: string;
  department: string | null;
  activeLeadCount?: number;
}

const STAGE_OPTIONS = [
  "New",
  "Contacted",
  "Qualified",
  "Proposal",
  "Won",
  "Lost",
];

const PILL_FILTERS = [
  { key: "All", label: "All Leads" },
  { key: "Unassigned", label: "Unassigned" },
  { key: "Assigned", label: "Assigned" },
  { key: "Contacted", label: "Contacted" },
  { key: "Interested", label: "Interested" },
  { key: "Converted", label: "Converted" },
  { key: "Lost", label: "Lost" },
];

const isUUID = (str: string) =>
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(str);

export default function Leads() {
  const [leads, setLeads] = useState<LeadItem[]>([]);
  const [employees, setEmployees] = useState<EmployeeOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  // Filters & Search
  const [activeTab, setActiveTab] = useState("All");
  const [search, setSearch] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [selectedRep, setSelectedRep] = useState("All");

  // Pagination (20 per page)
  const [currentPage, setCurrentPage] = useState(1);
  const LEADS_PER_PAGE = 20;

  // Bulk Selection
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  // Modals
  const [showAddModal, setShowAddModal] = useState(false);
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [assignCategory, setAssignCategory] = useState<"intern" | "team_leader">("intern");
  const [selectedAssignee, setSelectedAssignee] = useState<EmployeeOption | null>(null);
  const [assignSaving, setAssignSaving] = useState(false);

  // Manual Add Form
  const [addForm, setAddForm] = useState({
    name: "",
    company: "",
    email: "",
    phone: "",
    value: "",
    stage: "New",
    source: "Spreadsheet / Outreach",
    assigned_to: "",
    remarks: "",
  });
  const [savingAdd, setSavingAdd] = useState(false);

  // File Import State
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [importFileName, setImportFileName] = useState("");
  const [importValidRows, setImportValidRows] = useState<any[]>([]);
  const [importSkippedRows, setImportSkippedRows] = useState<Array<{ row: any; reason: string }>>([]);
  const [importing, setImporting] = useState(false);

  // 1. Fetch live leads and employees
  async function loadLeadsData() {
    setLoading(true);
    setError("");

    try {
      // Fetch employees
      const { data: empData } = await supabase
        .from("employees")
        .select("id, full_name, employee_code, role, department")
        .eq("employment_status", "active")
        .order("full_name", { ascending: true });

      // Fetch leads
      const { data: leadsData, error: leadsErr } = await supabase
        .from("leads")
        .select("*")
        .order("created_at", { ascending: false });

      let rawLeads: any[] = [];
      if (leadsErr) {
        console.warn("Could not fetch leads from remote database, checking local cache:", leadsErr.message);
        const cached = localStorage.getItem("crm_admin_leads_cache");
        if (cached) {
          try {
            rawLeads = JSON.parse(cached);
          } catch {
            rawLeads = [];
          }
        }
      } else {
        rawLeads = leadsData || [];
      }

      // Auto-sanitize any lead IDs that are not valid UUIDs (e.g. from previous imports)
      let needsCacheUpdate = false;
      const sanitizedLeads = rawLeads.map((l: any) => {
        if (!isUUID(l.id)) {
          needsCacheUpdate = true;
          return { ...l, id: crypto.randomUUID() };
        }
        return l;
      });

      if (needsCacheUpdate || !leadsErr) {
        localStorage.setItem("crm_admin_leads_cache", JSON.stringify(sanitizedLeads));
      }

      const empMap = new Map((empData || []).map((e) => [e.id, e]));

      // Count assigned leads per employee for balanced assignment view
      const counts: Record<string, number> = {};
      sanitizedLeads.forEach((l) => {
        if (l.assigned_to) {
          counts[l.assigned_to] = (counts[l.assigned_to] || 0) + 1;
        }
      });

      const structuredEmployees: EmployeeOption[] = (empData || []).map((e) => ({
        ...e,
        activeLeadCount: counts[e.id] || 0,
      }));

      const structuredLeads: LeadItem[] = sanitizedLeads.map((l) => ({
        ...l,
        assignedEmployee: l.assigned_to ? empMap.get(l.assigned_to) || null : null,
      }));

      setEmployees(structuredEmployees);
      setLeads(structuredLeads);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load leads from database.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadLeadsData();
  }, []);

  // 2. Metrics calculation
  const metrics = useMemo(() => {
    const total = leads.length;
    const unassigned = leads.filter((l) => !l.assigned_to).length;
    const assigned = leads.filter((l) => !!l.assigned_to).length;
    const contacted = leads.filter((l) => l.stage === "Contacted").length;
    const interested = leads.filter((l) => l.stage === "Qualified" || l.stage === "Proposal").length;
    const converted = leads.filter((l) => l.stage === "Won").length;
    return { total, unassigned, assigned, contacted, interested, converted };
  }, [leads]);

  // 3. Filtered Leads
  const filteredLeads = useMemo(() => {
    return leads.filter((lead) => {
      // Tab pill filter
      if (activeTab === "Unassigned" && lead.assigned_to) return false;
      if (activeTab === "Assigned" && !lead.assigned_to) return false;
      if (activeTab === "Contacted" && lead.stage !== "Contacted") return false;
      if (activeTab === "Interested" && lead.stage !== "Qualified" && lead.stage !== "Proposal") return false;
      if (activeTab === "Converted" && lead.stage !== "Won") return false;
      if (activeTab === "Lost" && lead.stage !== "Lost") return false;

      // Representative filter
      if (selectedRep !== "All") {
        if (selectedRep === "unassigned" && lead.assigned_to) return false;
        if (selectedRep === "interns" && lead.assignedEmployee?.role !== "intern") return false;
        if (selectedRep === "team_leaders" && lead.assignedEmployee?.role !== "team_leader") return false;
        if (selectedRep !== "unassigned" && selectedRep !== "interns" && selectedRep !== "team_leaders") {
          if (lead.assigned_to !== selectedRep) return false;
        }
      }

      // Search Query
      const q = search.trim().toLowerCase();
      if (q) {
        const target = [
          lead.name,
          lead.company || "",
          lead.phone || "",
          lead.email || "",
          lead.assignedEmployee?.full_name || "",
          lead.source || "",
        ]
          .join(" ")
          .toLowerCase();
        if (!target.includes(q)) return false;
      }

      // Date Range filter
      if (dateFrom) {
        const leadDate = lead.created_at.split("T")[0];
        if (leadDate < dateFrom) return false;
      }
      if (dateTo) {
        const leadDate = lead.created_at.split("T")[0];
        if (leadDate > dateTo) return false;
      }

      return true;
    });
  }, [leads, activeTab, selectedRep, search, dateFrom, dateTo]);

  // Reset page when filter changes
  useEffect(() => {
    setCurrentPage(1);
    setSelectedIds([]);
  }, [activeTab, selectedRep, search, dateFrom, dateTo]);

  // 4. Paginated Slice (20 per page)
  const totalPages = Math.max(1, Math.ceil(filteredLeads.length / LEADS_PER_PAGE));
  const paginatedLeads = useMemo(() => {
    const start = (currentPage - 1) * LEADS_PER_PAGE;
    return filteredLeads.slice(start, start + LEADS_PER_PAGE);
  }, [filteredLeads, currentPage]);

  // Checkbox selection logic
  const isAllCurrentPageSelected =
    paginatedLeads.length > 0 &&
    paginatedLeads.every((l) => selectedIds.includes(l.id));

  function toggleSelectAllPage() {
    if (isAllCurrentPageSelected) {
      setSelectedIds((prev) => prev.filter((id) => !paginatedLeads.some((l) => l.id === id)));
    } else {
      const pageIds = paginatedLeads.map((l) => l.id);
      setSelectedIds((prev) => Array.from(new Set([...prev, ...pageIds])));
    }
  }

  function toggleSelectOne(id: string) {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  }

  // 5. Bulk Assignment Handler (to Intern or Team Leader)
  async function handleConfirmAssignment() {
    if (!selectedAssignee || selectedIds.length === 0) return;

    setAssignSaving(true);
    setError("");
    setSuccess("");

    try {
      // 1. Send update to Supabase for valid UUIDs
      const validUuids = selectedIds.filter(isUUID);
      if (validUuids.length > 0) {
        const { error: updateErr } = await supabase
          .from("leads")
          .update({
            assigned_to: selectedAssignee.id,
            updated_at: new Date().toISOString(),
          })
          .in("id", validUuids);

        if (updateErr) {
          console.warn("Supabase database assign notice:", updateErr.message);
        }
      }

      // 2. Update local state and localStorage cache immediately
      const updated = leads.map((l) =>
        selectedIds.includes(l.id)
          ? { ...l, assigned_to: selectedAssignee.id, assignedEmployee: selectedAssignee }
          : l
      );
      setLeads(updated);
      localStorage.setItem("crm_admin_leads_cache", JSON.stringify(updated));

      // 3. Send real-time notification to the assigned employee
      await notifyEmployee(
        selectedAssignee.id,
        "New Leads Assigned",
        `Administrator assigned you ${selectedIds.length} customer lead(s). Check your assigned pipeline.`,
        "lead_assigned",
        "/portal/leads"
      );

      setSuccess(
        `Successfully assigned ${selectedIds.length} lead(s) to ${selectedAssignee.full_name} (${selectedAssignee.role}).`
      );
      setShowAssignModal(false);
      setSelectedIds([]);
      setSelectedAssignee(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to assign leads.");
    } finally {
      setAssignSaving(false);
    }
  }

  // 6. Delete Selected Leads
  async function handleDeleteSelected() {
    if (selectedIds.length === 0) return;
    if (!window.confirm(`Are you sure you want to delete ${selectedIds.length} selected lead(s)?`)) return;

    setLoading(true);
    try {
      const validUuids = selectedIds.filter(isUUID);
      if (validUuids.length > 0) {
        await supabase.from("leads").delete().in("id", validUuids);
      }

      const updated = leads.filter((l) => !selectedIds.includes(l.id));
      setLeads(updated);
      localStorage.setItem("crm_admin_leads_cache", JSON.stringify(updated));

      setSuccess(`Deleted ${selectedIds.length} lead(s) successfully.`);
      setSelectedIds([]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete leads.");
    } finally {
      setLoading(false);
    }
  }

  // 7. Manual Add Lead
  async function handleAddLeadSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!addForm.name.trim() || !addForm.phone.trim()) {
      setError("Lead name and phone number are required.");
      return;
    }

    setSavingAdd(true);
    setError("");
    setSuccess("");

    try {
      const { data: newLead, error: insertErr } = await supabase
        .from("leads")
        .insert({
          name: addForm.name.trim(),
          company: addForm.company.trim() || null,
          email: addForm.email.trim() || null,
          phone: addForm.phone.trim(),
          value: addForm.value.trim() || "₹0",
          stage: addForm.stage,
          source: addForm.source.trim() || "Manual Entry",
          assigned_to: addForm.assigned_to || null,
          remarks: addForm.remarks.trim() || null,
        })
        .select()
        .single();

      if (insertErr) throw new Error(insertErr.message);

      if (addForm.assigned_to) {
        await notifyEmployee(
          addForm.assigned_to,
          "New Lead Assigned",
          `Administrator assigned new lead "${addForm.name.trim()}" to you.`,
          "lead_assigned",
          "/portal/leads"
        );
      }

      setSuccess(`Lead "${addForm.name}" created successfully.`);
      setShowAddModal(false);
      setAddForm({
        name: "",
        company: "",
        email: "",
        phone: "",
        value: "",
        stage: "New",
        source: "Spreadsheet / Outreach",
        assigned_to: "",
        remarks: "",
      });
      await loadLeadsData();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to add lead.");
    } finally {
      setSavingAdd(false);
    }
  }

  // 8. Excel & CSV File Import with Smart Validation (Name & Phone only required, No rejected rows for optional fields)
  function handleFileSelect(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setImportFileName(file.name);
    setError("");
    setSuccess("");

    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const bstr = evt.target?.result;
        const workbook = XLSX.read(bstr, { type: "binary" });
        const firstSheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[firstSheetName];
        
        // Read sheet as raw 2D array of rows
        const rawRows: any[][] = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: "" });

        if (rawRows.length === 0) {
          setError("The selected spreadsheet has no data rows.");
          return;
        }

        // Auto-detect header row index (checks first 10 rows for keywords)
        const headerKeywords = [
          "name", "client", "customer", "contact", "lead", "phone", "mobile", "cell", "tel", "email", "company", "number"
        ];

        let headerRowIdx = 0;
        let maxKeywordMatches = 0;

        for (let r = 0; r < Math.min(10, rawRows.length); r++) {
          const rowStr = rawRows[r].map((c) => String(c || "").trim().toLowerCase());
          let matches = 0;
          rowStr.forEach((cell) => {
            if (headerKeywords.some((kw) => cell.includes(kw))) {
              matches++;
            }
          });
          if (matches > maxKeywordMatches) {
            maxKeywordMatches = matches;
            headerRowIdx = r;
          }
        }

        // Map column indices from detected header row
        const headerRow = (rawRows[headerRowIdx] || []).map((c: any) =>
          String(c || "").trim().toLowerCase().replace(/[\s_-]/g, "")
        );

        const findColIndex = (keywords: string[]) => {
          return headerRow.findIndex((h: string) =>
            keywords.some((kw) => h.includes(kw.replace(/[\s_-]/g, "")))
          );
        };

        let nameColIdx = findColIndex([
          "name", "fullname", "clientname", "customer", "contactperson", "leadname", "person", "partyname", "owner", "candidate", "student", "shopname", "client", "lead"
        ]);

        let phoneColIdx = findColIndex([
          "phone", "phonenumber", "mobile", "mobilenumber", "mobileno", "contact", "contactnumber", "contactno", "cell", "cellno", "whatsapp", "tel", "telephone", "ph", "mob", "number"
        ]);

        const companyColIdx = findColIndex(["company", "organization", "business", "companyname", "firm", "shop"]);
        const emailColIdx = findColIndex(["email", "emailaddress", "mail"]);
        const valueColIdx = findColIndex(["value", "dealvalue", "amount", "budget", "price"]);
        const remarksColIdx = findColIndex(["remarks", "notes", "description", "address", "city", "location"]);

        // Fallback detection: if nameCol or phoneCol not found in headers, detect by cell data
        if (phoneColIdx === -1) {
          for (let c = 0; c < 15; c++) {
            let phoneLikeCount = 0;
            for (let r = headerRowIdx + 1; r < Math.min(headerRowIdx + 10, rawRows.length); r++) {
              const digits = String(rawRows[r]?.[c] || "").replace(/\D/g, "");
              if (digits.length >= 7 && digits.length <= 15) phoneLikeCount++;
            }
            if (phoneLikeCount >= 2) {
              phoneColIdx = c;
              break;
            }
          }
        }

        if (nameColIdx === -1) {
          for (let c = 0; c < 15; c++) {
            if (c === phoneColIdx) continue;
            let textLikeCount = 0;
            for (let r = headerRowIdx + 1; r < Math.min(headerRowIdx + 10, rawRows.length); r++) {
              const val = String(rawRows[r]?.[c] || "").trim();
              if (val.length >= 2 && !val.includes("@") && val.replace(/\D/g, "").length < 5) {
                textLikeCount++;
              }
            }
            if (textLikeCount >= 2) {
              nameColIdx = c;
              break;
            }
          }
        }

        // Sets for duplication check
        const existingPhones = new Set(
          leads.map((l) => (l.phone || "").replace(/\D/g, "")).filter(Boolean)
        );
        const fileSeenPhones = new Set<string>();

        const valid: any[] = [];
        const skipped: Array<{ row: any; reason: string }> = [];

        // Process data rows
        for (let r = headerRowIdx + 1; r < rawRows.length; r++) {
          const rowData = rawRows[r];
          if (!rowData || rowData.length === 0) continue;

          // Check if row is completely empty
          const isRowEmpty = rowData.every((cell: any) => String(cell || "").trim() === "");
          if (isRowEmpty) continue;

          // Extract Raw Name
          let rawName = nameColIdx !== -1 ? String(rowData[nameColIdx] || "").trim() : "";

          // Extract Raw Phone
          let rawPhone = phoneColIdx !== -1 ? String(rowData[phoneColIdx] || "").trim() : "";

          // If phone is missing from designated column, scan other cells for a phone number
          if (!rawPhone || rawPhone.replace(/\D/g, "").length < 7) {
            for (let c = 0; c < rowData.length; c++) {
              if (c === nameColIdx) continue;
              const cellStr = String(rowData[c] || "").trim();
              const cellDigits = cellStr.replace(/\D/g, "");
              if (cellDigits.length >= 7 && cellDigits.length <= 15) {
                rawPhone = cellStr;
                break;
              }
            }
          }

          // Extract Optional Columns (Company, Email, Value, Remarks)
          const company = companyColIdx !== -1 ? String(rowData[companyColIdx] || "").trim() : "";
          const email = emailColIdx !== -1 ? String(rowData[emailColIdx] || "").trim().toLowerCase() : "";
          const value = valueColIdx !== -1 ? String(rowData[valueColIdx] || "").trim() : "";
          const remarks = remarksColIdx !== -1 ? String(rowData[remarksColIdx] || "").trim() : "";

          const cleanPhone = rawPhone.replace(/\D/g, "");

          // Validation Rule: Phone number is required with at least 7 digits
          if (!cleanPhone || cleanPhone.length < 7) {
            skipped.push({
              row: { rowNumber: r + 1, name: rawName || "Unnamed", phone: rawPhone || "Missing" },
              reason: "Missing or invalid phone number (< 7 digits)",
            });
            continue;
          }

          // If Name is missing, auto-assign from phone number so it NEVER drops valid leads
          if (!rawName) {
            rawName = `Lead ${cleanPhone.slice(-4)}`;
          }

          // Duplicate Check: Check phone against existing CRM leads and within this file
          if (existingPhones.has(cleanPhone) || fileSeenPhones.has(cleanPhone)) {
            skipped.push({
              row: { rowNumber: r + 1, name: rawName, phone: rawPhone },
              reason: `Duplicate phone number: "${rawPhone}" already registered`,
            });
            continue;
          }

          fileSeenPhones.add(cleanPhone);

          // Row is valid! Company, email, and value are completely optional
          valid.push({
            name: rawName,
            company: company || null,
            email: email || null,
            phone: rawPhone,
            value: value ? (value.startsWith("₹") ? value : `₹${value}`) : "₹0",
            stage: "New",
            source: `Imported (${file.name})`,
            remarks: remarks || null,
          });
        }

        setImportValidRows(valid);
        setImportSkippedRows(skipped);
        setShowImportModal(true);
      } catch (fileErr) {
        setError("Failed to read file. Please ensure it is a valid CSV or Excel spreadsheet.");
      }
    };

    reader.readAsBinaryString(file);
    e.target.value = "";
  }

  // 9. Execute Valid Import Rows (With Supabase + localStorage persistence)
  async function handleExecuteImport() {
    if (importValidRows.length === 0) return;

    setImporting(true);
    setError("");

    try {
      // Assign valid UUID to every lead
      const leadsWithUuid = importValidRows.map((v) => ({
        ...v,
        id: crypto.randomUUID(),
      }));

      // Chunk inserts in batches of 50
      const chunkSize = 50;
      let dbInsertSuccessful = true;

      for (let i = 0; i < leadsWithUuid.length; i += chunkSize) {
        const batch = leadsWithUuid.slice(i, i + chunkSize);
        const { error: batchErr } = await supabase.from("leads").insert(batch);
        if (batchErr) {
          console.warn("Supabase batch insert error, saving to local CRM cache:", batchErr.message);
          dbInsertSuccessful = false;
          break;
        }
      }

      // Add to local state & localStorage cache with guaranteed valid UUIDs
      const cachedLeads: LeadItem[] = leadsWithUuid.map((v) => ({
        id: v.id,
        name: v.name,
        company: v.company,
        email: v.email,
        phone: v.phone,
        value: v.value,
        stage: "New",
        assigned_to: null,
        source: v.source,
        remarks: v.remarks,
        created_at: new Date().toISOString(),
        assignedEmployee: null,
      }));

      const merged = [...cachedLeads, ...leads];
      setLeads(merged);
      localStorage.setItem("crm_admin_leads_cache", JSON.stringify(merged));

      setSuccess(
        `Import completed successfully! Imported ${importValidRows.length} valid leads. Skipped ${importSkippedRows.length} duplicate/incomplete rows.${
          !dbInsertSuccessful ? " (Saved to CRM cache — execute master_crm_setup.sql in Supabase to sync remote database)." : ""
        }`
      );
      setShowImportModal(false);
      setImportValidRows([]);
      setImportSkippedRows([]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to import leads batch.");
    } finally {
      setImporting(false);
    }
  }

  // Download Sample Template
  function handleDownloadTemplate() {
    const templateData = [
      {
        "Full Name": "Amit Kumar",
        Company: "Apex Tech Solutions",
        Email: "amit.kumar@example.com",
        Phone: "+91 98765 43210",
        "Deal Value": "250000",
        Source: "Website Inbound",
        Remarks: "Interested in CRM enterprise licensing",
      },
      {
        "Full Name": "Sneha Gupta",
        Company: "Vertex Global",
        Email: "sneha@vertex.in",
        Phone: "+91 98111 22334",
        "Deal Value": "180000",
        Source: "Cold Calling",
        Remarks: "Callback scheduled for product demo",
      },
    ];

    const ws = XLSX.utils.json_to_sheet(templateData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Leads Template");
    XLSX.writeFile(wb, "crm_leads_import_template.xlsx");
  }

  return (
    <div className="space-y-6 p-6">
      {/* 1. Header with exact design from reference image */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-[#0f172a] tracking-tight">
            Customer Leads & Assignments
          </h1>
          <p className="mt-1 text-sm text-gray-500">
            Import spreadsheets, assign leads to sales representatives, and monitor outreach conversion.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          {/* Template Button */}
          <button
            type="button"
            onClick={handleDownloadTemplate}
            className="flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-3.5 py-2 text-xs font-semibold text-gray-700 hover:bg-gray-50 shadow-sm transition"
            title="Download CSV/Excel Import Template"
          >
            <FileSpreadsheet size={16} className="text-emerald-600" />
            <span>Template</span>
          </button>

          {/* Hidden File Input */}
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv, application/vnd.openxmlformats-officedocument.spreadsheetml.sheet, application/vnd.ms-excel"
            onChange={handleFileSelect}
            className="hidden"
          />

          {/* Import Excel / CSV Button */}
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="flex items-center gap-2 rounded-xl bg-purple-600 px-4 py-2 text-xs font-semibold text-white hover:bg-purple-700 shadow-sm transition"
          >
            <UploadCloud size={16} />
            <span>Import Excel / CSV</span>
          </button>

          {/* Add Lead Button */}
          <button
            type="button"
            onClick={() => {
              setError("");
              setSuccess("");
              setShowAddModal(true);
            }}
            className="flex items-center gap-2 rounded-xl bg-[#0f172a] px-4 py-2 text-xs font-semibold text-white hover:bg-black shadow-sm transition"
          >
            <Plus size={16} />
            <span>Add Lead</span>
          </button>
        </div>
      </div>

      {/* 2. Top Metric Stat Cards - 6 horizontal cards matching reference image */}
      <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-6 gap-3">
        {/* Total Leads */}
        <div className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-gray-400">
              TOTAL LEADS
            </span>
            <Users size={16} className="text-gray-400" />
          </div>
          <p className="mt-2 text-2xl sm:text-3xl font-extrabold text-gray-900">
            {metrics.total}
          </p>
        </div>

        {/* Unassigned */}
        <div className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-gray-400">
              UNASSIGNED
            </span>
            <span className="h-2 w-2 rounded-full bg-slate-400" />
          </div>
          <p className="mt-2 text-2xl sm:text-3xl font-extrabold text-slate-800">
            {metrics.unassigned}
          </p>
        </div>

        {/* Assigned */}
        <div className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-blue-600">
              ASSIGNED
            </span>
            <UserCheck size={16} className="text-blue-500" />
          </div>
          <p className="mt-2 text-2xl sm:text-3xl font-extrabold text-blue-600">
            {metrics.assigned}
          </p>
        </div>

        {/* Contacted */}
        <div className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-amber-600">
              CONTACTED
            </span>
            <Clock size={16} className="text-amber-500" />
          </div>
          <p className="mt-2 text-2xl sm:text-3xl font-extrabold text-amber-600">
            {metrics.contacted}
          </p>
        </div>

        {/* Interested */}
        <div className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-600">
              INTERESTED
            </span>
            <CheckCircle2 size={16} className="text-emerald-500" />
          </div>
          <p className="mt-2 text-2xl sm:text-3xl font-extrabold text-emerald-600">
            {metrics.interested}
          </p>
        </div>

        {/* Converted */}
        <div className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-700">
              CONVERTED
            </span>
            <TrendingUp size={16} className="text-emerald-600" />
          </div>
          <p className="mt-2 text-2xl sm:text-3xl font-extrabold text-emerald-700">
            {metrics.converted}
          </p>
        </div>
      </div>

      {/* Alerts */}
      {success && (
        <div className="rounded-xl bg-green-50 p-3.5 text-xs text-green-700 border border-green-200 font-medium">
          {success}
        </div>
      )}
      {error && !showAddModal && !showImportModal && (
        <div className="rounded-xl bg-red-50 p-3.5 text-xs text-red-700 border border-red-200 font-medium">
          {error}
        </div>
      )}

      {/* 3. Filter Bar & Controls matching reference image */}
      <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm space-y-4">
        {/* Pill Tabs & Search Box */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-1.5">
            {PILL_FILTERS.map((pill) => (
              <button
                key={pill.key}
                type="button"
                onClick={() => setActiveTab(pill.key)}
                className={`rounded-full px-4 py-1.5 text-xs font-semibold transition ${
                  activeTab === pill.key
                    ? "bg-[#0f172a] text-white shadow-sm"
                    : "text-gray-600 hover:text-gray-900 hover:bg-gray-100"
                }`}
              >
                {pill.label}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-2 rounded-xl border border-gray-200 px-3 py-1.5 text-xs bg-gray-50/50">
            <Search size={15} className="text-gray-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by name, phone, company..."
              className="w-56 bg-transparent outline-none text-xs"
            />
            {search && (
              <button onClick={() => setSearch("")} className="text-gray-400 hover:text-gray-600">
                <X size={13} />
              </button>
            )}
          </div>
        </div>

        {/* Date Range & Representative Dropdowns */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-gray-100 text-xs">
          <div className="flex flex-wrap items-center gap-2 text-gray-600">
            <Calendar size={14} className="text-gray-400" />
            <span className="font-medium text-gray-700">Date Range</span>
            <span className="text-gray-400">From</span>
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              className="rounded-lg border border-gray-200 px-2 py-1 text-xs outline-none bg-white"
            />
            <span className="text-gray-400">To</span>
            <input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              className="rounded-lg border border-gray-200 px-2 py-1 text-xs outline-none bg-white"
            />
            {(dateFrom || dateTo) && (
              <button
                onClick={() => {
                  setDateFrom("");
                  setDateTo("");
                }}
                className="text-[11px] text-blue-600 hover:underline"
              >
                Clear Dates
              </button>
            )}
            {!dateFrom && !dateTo && (
              <span className="italic text-gray-400 text-[11px]">
                Showing all dates — pick a range to filter
              </span>
            )}
          </div>

          <div className="flex items-center gap-2">
            <span className="font-medium text-gray-700">Representative</span>
            <select
              value={selectedRep}
              onChange={(e) => setSelectedRep(e.target.value)}
              className="rounded-xl border border-gray-200 bg-white px-3 py-1.5 text-xs outline-none"
            >
              <option value="All">All Representatives</option>
              <option value="unassigned">Unassigned Only</option>
              <optgroup label="Interns Roster">
                {employees
                  .filter((e) => e.role === "intern")
                  .map((e) => (
                    <option key={e.id} value={e.id}>
                      {e.full_name} ({e.employee_code}) - Intern
                    </option>
                  ))}
              </optgroup>
              <optgroup label="Team Leaders Squad">
                {employees
                  .filter((e) => e.role === "team_leader")
                  .map((e) => (
                    <option key={e.id} value={e.id}>
                      {e.full_name} ({e.employee_code}) - TL
                    </option>
                  ))}
              </optgroup>
            </select>

            <button
              onClick={loadLeadsData}
              title="Refresh leads"
              className="rounded-xl border border-gray-200 p-2 text-gray-600 hover:bg-gray-50 transition"
            >
              <RefreshCw size={14} className={loading ? "animate-spin text-blue-600" : ""} />
            </button>
          </div>
        </div>
      </div>

      {/* Floating Bulk Action Bar */}
      {selectedIds.length > 0 && (
        <div className="sticky top-2 z-30 flex items-center justify-between rounded-2xl bg-[#0f172a] px-5 py-3 text-white shadow-xl animate-in fade-in slide-in-from-top-2">
          <div className="flex items-center gap-3">
            <span className="flex h-6 w-6 items-center justify-center rounded-full bg-blue-600 text-xs font-bold">
              {selectedIds.length}
            </span>
            <span className="text-xs font-medium">leads selected for action</span>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                setShowAssignModal(true);
                setSelectedAssignee(null);
              }}
              className="flex items-center gap-1.5 rounded-xl bg-blue-600 px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-blue-700 transition shadow-sm"
            >
              <UserPlus size={14} /> Assign to Intern / TL
            </button>

            <button
              onClick={handleDeleteSelected}
              className="flex items-center gap-1.5 rounded-xl bg-rose-600/20 text-rose-300 px-3 py-1.5 text-xs font-semibold hover:bg-rose-600 hover:text-white transition"
            >
              <Trash2 size={14} /> Delete
            </button>

            <button
              onClick={() => setSelectedIds([])}
              className="rounded-lg px-2.5 py-1.5 text-xs text-gray-400 hover:text-white"
            >
              Clear
            </button>
          </div>
        </div>
      )}

      {/* 4. Leads Table Container */}
      <div className="rounded-2xl border border-gray-200 bg-white shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-gray-50/70 uppercase text-[11px] tracking-wider text-gray-500 border-b border-gray-200">
              <tr>
                <th className="px-4 py-3.5 w-10">
                  <input
                    type="checkbox"
                    checked={isAllCurrentPageSelected}
                    onChange={toggleSelectAllPage}
                    className="rounded border-gray-300 text-blue-600 focus:ring-blue-500 h-4 w-4"
                  />
                </th>
                <th className="px-4 py-3.5">Lead Contact</th>
                <th className="px-4 py-3.5">Company</th>
                <th className="px-4 py-3.5">Phone & Email</th>
                <th className="px-4 py-3.5">Deal Value</th>
                <th className="px-4 py-3.5">Stage</th>
                <th className="px-4 py-3.5">Assigned Representative</th>
                <th className="px-4 py-3.5">Created Date</th>
              </tr>
            </thead>

            <tbody className="divide-y divide-gray-100">
              {loading ? (
                <tr>
                  <td colSpan={8} className="px-5 py-12 text-center text-xs text-gray-500">
                    Loading customer leads from Supabase database...
                  </td>
                </tr>
              ) : paginatedLeads.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-5 py-12 text-center text-xs text-gray-500">
                    No leads found matching current search and filters.
                  </td>
                </tr>
              ) : (
                paginatedLeads.map((lead) => {
                  const isChecked = selectedIds.includes(lead.id);

                  return (
                    <tr
                      key={lead.id}
                      className={`hover:bg-gray-50/70 transition ${
                        isChecked ? "bg-blue-50/30" : ""
                      }`}
                    >
                      <td className="px-4 py-3.5">
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => toggleSelectOne(lead.id)}
                          className="rounded border-gray-300 text-blue-600 focus:ring-blue-500 h-4 w-4"
                        />
                      </td>

                      <td className="px-4 py-3.5">
                        <p className="font-bold text-gray-900 text-sm">{lead.name}</p>
                        <span className="text-[10px] text-gray-400 font-medium">
                          Source: {lead.source || "Direct"}
                        </span>
                      </td>

                      <td className="px-4 py-3.5 text-gray-700 font-medium">
                        {lead.company || "-"}
                      </td>

                      <td className="px-4 py-3.5 text-gray-600 space-y-0.5">
                        {lead.phone && (
                          <p className="flex items-center gap-1 font-mono">
                            <Phone size={11} className="text-gray-400" />
                            {lead.phone}
                          </p>
                        )}
                        {lead.email && (
                          <p className="flex items-center gap-1 text-[11px] text-gray-500">
                            <Mail size={11} className="text-gray-400" />
                            {lead.email}
                          </p>
                        )}
                      </td>

                      <td className="px-4 py-3.5 font-bold text-gray-900">
                        {lead.value || "₹0"}
                      </td>

                      <td className="px-4 py-3.5">
                        <span
                          className={`rounded-full px-2.5 py-0.5 text-[11px] font-bold ${
                            lead.stage === "Won"
                              ? "bg-emerald-50 text-emerald-700"
                              : lead.stage === "Lost"
                                ? "bg-rose-50 text-rose-700"
                                : lead.stage === "Contacted"
                                  ? "bg-amber-50 text-amber-700"
                                  : lead.stage === "Qualified" || lead.stage === "Proposal"
                                    ? "bg-purple-50 text-purple-700"
                                    : "bg-blue-50 text-blue-700"
                          }`}
                        >
                          {lead.stage}
                        </span>
                      </td>

                      <td className="px-4 py-3.5">
                        {lead.assignedEmployee ? (
                          <div className="flex items-center gap-2">
                            <span
                              className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                                lead.assignedEmployee.role === "intern"
                                  ? "bg-violet-100 text-violet-800"
                                  : lead.assignedEmployee.role === "team_leader"
                                    ? "bg-amber-100 text-amber-800"
                                    : "bg-blue-100 text-blue-800"
                              }`}
                            >
                              {lead.assignedEmployee.role === "intern"
                                ? "Intern"
                                : lead.assignedEmployee.role === "team_leader"
                                  ? "TL"
                                  : "Staff"}
                            </span>
                            <span className="font-semibold text-gray-900">
                              {lead.assignedEmployee.full_name}
                            </span>
                          </div>
                        ) : (
                          <span className="italic text-gray-400 text-xs">Unassigned</span>
                        )}
                      </td>

                      <td className="px-4 py-3.5 text-gray-500">
                        {new Date(lead.created_at).toLocaleDateString()}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* 5. Pagination Bar (20 per page) */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-gray-100 px-5 py-3.5 text-xs text-gray-500 bg-gray-50/30">
          <div>
            Showing{" "}
            <span className="font-semibold text-gray-800">
              {filteredLeads.length === 0 ? 0 : (currentPage - 1) * LEADS_PER_PAGE + 1}
            </span>{" "}
            to{" "}
            <span className="font-semibold text-gray-800">
              {Math.min(currentPage * LEADS_PER_PAGE, filteredLeads.length)}
            </span>{" "}
            of <span className="font-semibold text-gray-800">{filteredLeads.length}</span> leads
          </div>

          <div className="flex items-center gap-1.5">
            <button
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              disabled={currentPage === 1}
              className="flex items-center gap-1 rounded-lg border border-gray-200 bg-white px-3 py-1.5 font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-40 transition"
            >
              <ChevronLeft size={14} /> Previous
            </button>

            <div className="px-3 py-1 text-xs font-semibold text-gray-700">
              Page {currentPage} of {totalPages}
            </div>

            <button
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages}
              className="flex items-center gap-1 rounded-lg border border-gray-200 bg-white px-3 py-1.5 font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-40 transition"
            >
              Next <ChevronRight size={14} />
            </button>
          </div>
        </div>
      </div>

      {/* 6. ASSIGNMENT MODAL (Interns vs Team Leaders Selection) */}
      {showAssignModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-black/40 p-4">
          <div className="my-6 w-full max-w-lg rounded-2xl bg-white shadow-xl">
            <div className="flex items-center justify-between border-b border-gray-200 p-5">
              <div>
                <h2 className="text-lg font-bold text-gray-900">Assign Selected Leads</h2>
                <p className="mt-0.5 text-xs text-gray-500">
                  Assign {selectedIds.length} lead(s) to an Intern or Team Leader
                </p>
              </div>
              <button
                onClick={() => setShowAssignModal(false)}
                className="rounded-lg p-2 text-gray-500 hover:bg-gray-100"
              >
                <X size={20} />
              </button>
            </div>

            <div className="p-5 space-y-4">
              {/* Category Switcher Tabs */}
              <div className="grid grid-cols-2 gap-2 rounded-xl bg-gray-100 p-1 text-xs">
                <button
                  type="button"
                  onClick={() => {
                    setAssignCategory("intern");
                    setSelectedAssignee(null);
                  }}
                  className={`flex items-center justify-center gap-2 rounded-lg py-2 font-bold transition ${
                    assignCategory === "intern"
                      ? "bg-white text-violet-700 shadow-sm"
                      : "text-gray-600 hover:text-gray-900"
                  }`}
                >
                  <GraduationCap size={16} />
                  <span>Interns ({employees.filter((e) => e.role === "intern").length})</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setAssignCategory("team_leader");
                    setSelectedAssignee(null);
                  }}
                  className={`flex items-center justify-center gap-2 rounded-lg py-2 font-bold transition ${
                    assignCategory === "team_leader"
                      ? "bg-white text-amber-700 shadow-sm"
                      : "text-gray-600 hover:text-gray-900"
                  }`}
                >
                  <Shield size={16} />
                  <span>Team Leaders ({employees.filter((e) => e.role === "team_leader").length})</span>
                </button>
              </div>

              {/* Employee Selection List */}
              <div className="max-h-64 overflow-y-auto divide-y divide-gray-100 rounded-xl border border-gray-200">
                {employees.filter((e) => e.role === assignCategory).length === 0 ? (
                  <div className="py-8 text-center text-xs text-gray-400">
                    No active {assignCategory === "intern" ? "interns" : "team leaders"} found. Add them in the Employees section first.
                  </div>
                ) : (
                  employees
                    .filter((e) => e.role === assignCategory)
                    .map((emp) => {
                      const isSelected = selectedAssignee?.id === emp.id;

                      return (
                        <div
                          key={emp.id}
                          onClick={() => setSelectedAssignee(emp)}
                          className={`flex items-center justify-between p-3.5 cursor-pointer transition ${
                            isSelected ? "bg-blue-50/70 border-l-4 border-blue-600" : "hover:bg-gray-50"
                          }`}
                        >
                          <div className="flex items-center gap-3">
                            <div
                              className={`flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold ${
                                assignCategory === "intern"
                                  ? "bg-violet-100 text-violet-700"
                                  : "bg-amber-100 text-amber-700"
                              }`}
                            >
                              {emp.full_name.charAt(0).toUpperCase()}
                            </div>
                            <div>
                              <p className="font-bold text-gray-900 text-xs">{emp.full_name}</p>
                              <p className="text-[10px] text-gray-400 font-mono">
                                {emp.employee_code} • {emp.department || "Sales"}
                              </p>
                            </div>
                          </div>

                          <div className="flex items-center gap-3">
                            <span className="text-[11px] text-gray-500 font-medium">
                              {emp.activeLeadCount} active leads
                            </span>
                            {isSelected && <Check size={16} className="text-blue-600 font-bold" />}
                          </div>
                        </div>
                      );
                    })
                )}
              </div>

              <div className="flex justify-end gap-2.5 pt-3 border-t border-gray-100">
                <button
                  type="button"
                  onClick={() => setShowAssignModal(false)}
                  className="rounded-xl border border-gray-200 px-4 py-2 text-xs font-semibold text-gray-700 hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={!selectedAssignee || assignSaving}
                  onClick={handleConfirmAssignment}
                  className="rounded-xl bg-blue-600 px-5 py-2 text-xs font-semibold text-white hover:bg-blue-700 disabled:opacity-50 transition shadow-sm"
                >
                  {assignSaving ? "Assigning..." : `Confirm Assignment to ${selectedAssignee?.full_name || ""}`}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 7. SMART FILE IMPORT PREVIEW MODAL */}
      {showImportModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-black/40 p-4">
          <div className="my-6 w-full max-w-3xl rounded-2xl bg-white shadow-xl max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between border-b border-gray-200 p-5 shrink-0">
              <div>
                <h2 className="text-lg font-bold text-gray-900">
                  Import Validation: {importFileName}
                </h2>
                <p className="mt-0.5 text-xs text-gray-500">
                  Smart validation has filtered duplicate records and incomplete rows.
                </p>
              </div>
              <button
                onClick={() => setShowImportModal(false)}
                className="rounded-lg p-2 text-gray-500 hover:bg-gray-100"
              >
                <X size={20} />
              </button>
            </div>

            <div className="p-6 overflow-y-auto space-y-5">
              {/* Validation Summary Stat Cards */}
              <div className="grid grid-cols-3 gap-3">
                <div className="rounded-xl border border-gray-200 p-3 bg-gray-50 text-center">
                  <p className="text-[11px] font-semibold text-gray-500">Total in File</p>
                  <p className="text-2xl font-bold text-gray-900">
                    {importValidRows.length + importSkippedRows.length}
                  </p>
                </div>

                <div className="rounded-xl border border-emerald-200 p-3 bg-emerald-50 text-center">
                  <p className="text-[11px] font-semibold text-emerald-700">Valid to Import</p>
                  <p className="text-2xl font-bold text-emerald-700">
                    {importValidRows.length}
                  </p>
                </div>

                <div className="rounded-xl border border-amber-200 p-3 bg-amber-50 text-center">
                  <p className="text-[11px] font-semibold text-amber-700">Skipped / Duplicates</p>
                  <p className="text-2xl font-bold text-amber-700">
                    {importSkippedRows.length}
                  </p>
                </div>
              </div>

              {/* Skipped Rows Reasons Table */}
              {importSkippedRows.length > 0 && (
                <div>
                  <h4 className="text-xs font-bold text-amber-800 mb-2 flex items-center gap-1.5">
                    <AlertTriangle size={14} className="text-amber-600" />
                    Skipped Incomplete / Duplicate Entries ({importSkippedRows.length})
                  </h4>
                  <div className="max-h-40 overflow-y-auto divide-y divide-gray-100 rounded-xl border border-amber-200 bg-amber-50/40 text-xs">
                    {importSkippedRows.slice(0, 15).map((item, i) => (
                      <div key={i} className="p-2.5 flex items-center justify-between">
                        <div>
                          <span className="font-semibold text-gray-800">
                            Row #{item.row.rowNumber || i + 2}: {item.row.name || "Unnamed"}
                          </span>
                        </div>
                        <span className="text-[11px] text-amber-700 italic">{item.reason}</span>
                      </div>
                    ))}
                    {importSkippedRows.length > 15 && (
                      <p className="p-2 text-center text-[10px] text-gray-400">
                        ...and {importSkippedRows.length - 15} more skipped rows.
                      </p>
                    )}
                  </div>
                </div>
              )}

              {/* Valid Rows Preview Table */}
              <div>
                <h4 className="text-xs font-bold text-gray-900 mb-2">
                  Sample Valid Records Preview ({importValidRows.length})
                </h4>
                <div className="max-h-52 overflow-y-auto rounded-xl border border-gray-200 text-xs">
                  <table className="w-full text-left">
                    <thead className="bg-gray-50 text-[10px] uppercase text-gray-500">
                      <tr>
                        <th className="p-2.5">Name</th>
                        <th className="p-2.5">Company</th>
                        <th className="p-2.5">Phone</th>
                        <th className="p-2.5">Email</th>
                        <th className="p-2.5">Value</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {importValidRows.slice(0, 8).map((r, i) => (
                        <tr key={i}>
                          <td className="p-2.5 font-bold text-gray-900">{r.name}</td>
                          <td className="p-2.5 text-gray-600">{r.company || "-"}</td>
                          <td className="p-2.5 font-mono text-gray-700">{r.phone || "-"}</td>
                          <td className="p-2.5 text-gray-600">{r.email || "-"}</td>
                          <td className="p-2.5 font-semibold text-gray-900">{r.value}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

            <div className="p-5 border-t border-gray-100 flex items-center justify-between shrink-0">
              <span className="text-xs text-gray-500">
                Only valid, non-duplicate entries will be saved to Supabase.
              </span>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setShowImportModal(false)}
                  className="rounded-xl border border-gray-200 px-4 py-2 text-xs font-semibold text-gray-700 hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={importValidRows.length === 0 || importing}
                  onClick={handleExecuteImport}
                  className="rounded-xl bg-purple-600 px-5 py-2 text-xs font-semibold text-white hover:bg-purple-700 disabled:opacity-50 transition shadow-sm"
                >
                  {importing ? "Importing..." : `Import ${importValidRows.length} Valid Leads`}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 8. ADD LEAD MODAL */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-black/40 p-4">
          <div className="my-6 w-full max-w-lg rounded-2xl bg-white shadow-xl">
            <div className="flex items-center justify-between border-b border-gray-200 p-5">
              <div>
                <h2 className="text-lg font-bold text-gray-900">Add New Lead</h2>
                <p className="mt-0.5 text-xs text-gray-500">
                  Enter prospect contact info and optionally assign to an employee.
                </p>
              </div>
              <button
                onClick={() => setShowAddModal(false)}
                className="rounded-lg p-2 text-gray-500 hover:bg-gray-100"
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleAddLeadSubmit} className="p-5 space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1 block text-xs font-medium text-gray-700">
                    Lead Name *
                  </label>
                  <input
                    required
                    type="text"
                    value={addForm.name}
                    onChange={(e) => setAddForm({ ...addForm, name: e.target.value })}
                    placeholder="e.g. Ramesh Patel"
                    className="w-full rounded-xl border border-gray-300 px-3 py-2 text-xs outline-none focus:border-blue-500"
                  />
                </div>

                <div>
                  <label className="mb-1 block text-xs font-medium text-gray-700">
                    Company Name
                  </label>
                  <input
                    type="text"
                    value={addForm.company}
                    onChange={(e) => setAddForm({ ...addForm, company: e.target.value })}
                    placeholder="e.g. Apex Infotech"
                    className="w-full rounded-xl border border-gray-300 px-3 py-2 text-xs outline-none focus:border-blue-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1 block text-xs font-medium text-gray-700">
                    Phone Number *
                  </label>
                  <input
                    required
                    type="tel"
                    value={addForm.phone}
                    onChange={(e) => setAddForm({ ...addForm, phone: e.target.value })}
                    placeholder="e.g. +91 98765 43210"
                    className="w-full rounded-xl border border-gray-300 px-3 py-2 text-xs outline-none focus:border-blue-500 font-mono"
                  />
                </div>

                <div>
                  <label className="mb-1 block text-xs font-medium text-gray-700">
                    Email Address
                  </label>
                  <input
                    type="email"
                    value={addForm.email}
                    onChange={(e) => setAddForm({ ...addForm, email: e.target.value })}
                    placeholder="ramesh@example.com"
                    className="w-full rounded-xl border border-gray-300 px-3 py-2 text-xs outline-none focus:border-blue-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1 block text-xs font-medium text-gray-700">
                    Estimated Deal Value
                  </label>
                  <input
                    type="text"
                    value={addForm.value}
                    onChange={(e) => setAddForm({ ...addForm, value: e.target.value })}
                    placeholder="e.g. ₹2,50,000"
                    className="w-full rounded-xl border border-gray-300 px-3 py-2 text-xs outline-none focus:border-blue-500"
                  />
                </div>

                <div>
                  <label className="mb-1 block text-xs font-medium text-gray-700">
                    Pipeline Stage
                  </label>
                  <select
                    value={addForm.stage}
                    onChange={(e) => setAddForm({ ...addForm, stage: e.target.value })}
                    className="w-full rounded-xl border border-gray-300 px-3 py-2 text-xs outline-none focus:border-blue-500"
                  >
                    {STAGE_OPTIONS.map((stg) => (
                      <option key={stg} value={stg}>
                        {stg}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="mb-1 block text-xs font-medium text-gray-700">
                  Initial Assignee (Optional)
                </label>
                <select
                  value={addForm.assigned_to}
                  onChange={(e) => setAddForm({ ...addForm, assigned_to: e.target.value })}
                  className="w-full rounded-xl border border-gray-300 px-3 py-2 text-xs outline-none focus:border-blue-500"
                >
                  <option value="">-- Leave Unassigned --</option>
                  <optgroup label="Interns">
                    {employees
                      .filter((e) => e.role === "intern")
                      .map((e) => (
                        <option key={e.id} value={e.id}>
                          {e.full_name} ({e.employee_code}) - Intern
                        </option>
                      ))}
                  </optgroup>
                  <optgroup label="Team Leaders">
                    {employees
                      .filter((e) => e.role === "team_leader")
                      .map((e) => (
                        <option key={e.id} value={e.id}>
                          {e.full_name} ({e.employee_code}) - Team Leader
                        </option>
                      ))}
                  </optgroup>
                </select>
              </div>

              <div>
                <label className="mb-1 block text-xs font-medium text-gray-700">
                  Remarks / Requirements
                </label>
                <textarea
                  rows={2}
                  value={addForm.remarks}
                  onChange={(e) => setAddForm({ ...addForm, remarks: e.target.value })}
                  placeholder="Key discussion points, product interest..."
                  className="w-full rounded-xl border border-gray-300 p-2.5 text-xs outline-none focus:border-blue-500"
                />
              </div>

              <div className="flex justify-end gap-2.5 pt-3 border-t border-gray-100">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="rounded-xl border border-gray-200 px-4 py-2 text-xs font-semibold text-gray-700 hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingAdd}
                  className="rounded-xl bg-[#0f172a] px-5 py-2 text-xs font-semibold text-white hover:bg-black disabled:opacity-50 transition shadow-sm"
                >
                  {savingAdd ? "Saving..." : "Create Lead"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
