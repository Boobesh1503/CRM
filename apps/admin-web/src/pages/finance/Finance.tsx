import { useState, useEffect, useMemo } from "react";
import {
  Wallet,
  IndianRupee,
  TrendingUp,
  ArrowDownRight,
  ArrowUpRight,
  Download,
  Search,
  CheckCircle2,
  Clock,
  Plus,
  Trash2,
  Printer,
  Calendar,
  FileText,
  Eye,
  Check,
  AlertCircle,
  Copy,
  ChevronDown,
  RefreshCw,
  Filter,
  DollarSign,
  Send,
  Building2
} from "lucide-react";
import { supabase } from "../../services/supabase";

const INVOICE_TABLE_SQL = `-- SQL Script for Supabase SQL Editor
CREATE TABLE IF NOT EXISTS public.invoices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_number text UNIQUE NOT NULL,
  from_name text NOT NULL DEFAULT 'kodefy INFO TECH',
  from_details text DEFAULT 'Coding Your Vision, Marketing Your Mission',
  bill_to text NOT NULL,
  ship_to text,
  date date NOT NULL DEFAULT current_date,
  payment_terms text DEFAULT 'Due on Receipt',
  due_date date,
  po_number text,
  notes text,
  terms text,
  subtotal numeric(12,2) NOT NULL DEFAULT 0,
  tax_rate numeric(5,2) DEFAULT 0,
  tax_amount numeric(12,2) DEFAULT 0,
  discount_amount numeric(12,2) DEFAULT 0,
  shipping_amount numeric(12,2) DEFAULT 0,
  total_amount numeric(12,2) NOT NULL DEFAULT 0,
  amount_paid numeric(12,2) DEFAULT 0,
  balance_due numeric(12,2) NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'Pending' CHECK (status IN ('Paid', 'Pending', 'Overdue', 'Cancelled')),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.invoice_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id uuid NOT NULL REFERENCES public.invoices(id) ON DELETE CASCADE,
  description text NOT NULL,
  quantity numeric(10,2) NOT NULL DEFAULT 1,
  rate numeric(12,2) NOT NULL DEFAULT 0,
  amount numeric(12,2) NOT NULL DEFAULT 0
);

ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invoice_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins have full access to invoices" ON public.invoices FOR ALL USING (public.is_admin());
CREATE POLICY "Everyone can view invoices" ON public.invoices FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Admins have full access to invoice items" ON public.invoice_items FOR ALL USING (public.is_admin());
CREATE POLICY "Everyone can view invoice items" ON public.invoice_items FOR SELECT USING (auth.role() = 'authenticated');
`;

export interface InvoiceItem {
  id?: string;
  description: string;
  quantity: number;
  rate: number;
  amount: number;
}

export interface InvoiceRecord {
  id: string;
  invoice_number: string;
  from_name: string;
  from_details: string;
  bill_to: string;
  ship_to?: string;
  date: string;
  payment_terms: string;
  due_date: string;
  po_number?: string;
  notes?: string;
  terms?: string;
  subtotal: number;
  tax_rate: number;
  tax_amount: number;
  discount_amount: number;
  shipping_amount: number;
  total_amount: number;
  amount_paid: number;
  balance_due: number;
  status: "Paid" | "Pending" | "Overdue" | "Cancelled";
  items?: InvoiceItem[];
  created_at?: string;
}

const LOCAL_STORAGE_KEY = "crm_admin_invoices_cache";

export default function Finance() {
  const [invoices, setInvoices] = useState<InvoiceRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"records" | "generator">("records");
  const [dbTableMissing, setDbTableMissing] = useState(false);
  const [copiedSql, setCopiedSql] = useState(false);
  const [successMsg, setSuccessMsg] = useState("");
  const [errorMsg, setErrorMsg] = useState("");

  // Filters
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("All");
  const [selectedMonth, setSelectedMonth] = useState("all");

  // Invoice Generator Form State (matches Invoice-Generator.com layout)
  const [generatorInvoiceNumber, setGeneratorInvoiceNumber] = useState("8");
  const [fromName, setFromName] = useState("kodefy INFO TECH");
  const [fromDetails, setFromDetails] = useState("Coding Your Vision, Marketing Your Mission\ncontact@kodefy.com | +91 98765 43210");
  const [billTo, setBillTo] = useState("");
  const [shipTo, setShipTo] = useState("");
  const [invoiceDate, setInvoiceDate] = useState(() => new Date().toISOString().split("T")[0]);
  const [paymentTerms, setPaymentTerms] = useState("Due on Receipt");
  const [dueDate, setDueDate] = useState("");
  const [poNumber, setPoNumber] = useState("");

  const [items, setItems] = useState<InvoiceItem[]>([
    { description: "Website Design & Development", quantity: 1, rate: 25000, amount: 25000 },
  ]);

  const [taxRate, setTaxRate] = useState<number>(0);
  const [discountAmount, setDiscountAmount] = useState<number>(0);
  const [shippingAmount, setShippingAmount] = useState<number>(0);
  const [amountPaid, setAmountPaid] = useState<number>(0);
  const [notes, setNotes] = useState("Thank you for your business. Please reach out if you have any questions regarding this invoice.");
  const [terms, setTerms] = useState("Terms and conditions - Payment due upon receipt. Late fees apply after 15 days.");
  const [showDiscountInput, setShowDiscountInput] = useState(false);
  const [showShippingInput, setShowShippingInput] = useState(false);

  // View / Print Modal
  const [selectedInvoiceForView, setSelectedInvoiceForView] = useState<InvoiceRecord | null>(null);

  // Load Invoices from Supabase (with resilient local storage fallback)
  async function loadInvoices() {
    setLoading(true);
    setErrorMsg("");
    setDbTableMissing(false);

    try {
      const { data, error } = await supabase
        .from("invoices")
        .select(`
          *,
          items:invoice_items (*)
        `)
        .order("created_at", { ascending: false });

      if (error) {
        if (error.code === "PGRST205" || error.message.includes("does not exist") || error.message.includes("schema cache")) {
          setDbTableMissing(true);
        }
        // Load fallback from localStorage
        const cached = localStorage.getItem(LOCAL_STORAGE_KEY);
        if (cached) {
          try {
            setInvoices(JSON.parse(cached));
          } catch {
            setInvoices([]);
          }
        } else {
          setInvoices([]);
        }
      } else {
        const fetched = (data || []).map((inv: any) => ({
          ...inv,
          items: inv.items || [],
        }));
        setInvoices(fetched);
        localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(fetched));
        // Auto-increment generator invoice number
        if (fetched.length > 0) {
          const maxNum = fetched.reduce((max: number, i: InvoiceRecord) => {
            const num = parseInt(i.invoice_number.replace(/\D/g, ""), 10);
            return isNaN(num) ? max : Math.max(max, num);
          }, 0);
          setGeneratorInvoiceNumber(String(maxNum + 1));
        }
      }
    } catch {
      const cached = localStorage.getItem(LOCAL_STORAGE_KEY);
      if (cached) {
        try {
          setInvoices(JSON.parse(cached));
        } catch {
          setInvoices([]);
        }
      }
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadInvoices();
  }, []);

  // Compute Invoice Generator Totals
  const subtotal = useMemo(() => {
    return items.reduce((sum, item) => sum + (Number(item.quantity) * Number(item.rate) || 0), 0);
  }, [items]);

  const taxAmount = useMemo(() => {
    return (subtotal * (Number(taxRate) || 0)) / 100;
  }, [subtotal, taxRate]);

  const totalAmount = useMemo(() => {
    return Math.max(0, subtotal + taxAmount + (Number(shippingAmount) || 0) - (Number(discountAmount) || 0));
  }, [subtotal, taxAmount, shippingAmount, discountAmount]);

  const balanceDue = useMemo(() => {
    return Math.max(0, totalAmount - (Number(amountPaid) || 0));
  }, [totalAmount, amountPaid]);

  // Handle Line Items
  function handleItemChange(index: number, field: keyof InvoiceItem, value: any) {
    setItems((prev) => {
      const updated = [...prev];
      const item = { ...updated[index], [field]: value };
      if (field === "quantity" || field === "rate") {
        item.amount = Number(item.quantity || 0) * Number(item.rate || 0);
      }
      updated[index] = item;
      return updated;
    });
  }

  function handleAddItem() {
    setItems((prev) => [...prev, { description: "", quantity: 1, rate: 0, amount: 0 }]);
  }

  function handleRemoveItem(index: number) {
    if (items.length <= 1) return;
    setItems((prev) => prev.filter((_, i) => i !== index));
  }

  // Save Invoice
  async function handleSaveInvoice() {
    if (!billTo.trim()) {
      setErrorMsg("Please enter the client / 'Bill To' details.");
      return;
    }
    if (items.length === 0 || !items[0].description.trim()) {
      setErrorMsg("Please add at least one line item with a description.");
      return;
    }

    setErrorMsg("");
    const newInvoiceStatus: InvoiceRecord["status"] =
      balanceDue <= 0 ? "Paid" : dueDate && new Date(dueDate) < new Date() ? "Overdue" : "Pending";

    const invoiceData: Omit<InvoiceRecord, "id"> = {
      invoice_number: generatorInvoiceNumber.trim().startsWith("#")
        ? generatorInvoiceNumber.trim()
        : `#${generatorInvoiceNumber.trim()}`,
      from_name: fromName.trim() || "kodefy INFO TECH",
      from_details: fromDetails.trim(),
      bill_to: billTo.trim(),
      ship_to: shipTo.trim() || undefined,
      date: invoiceDate || new Date().toISOString().split("T")[0],
      payment_terms: paymentTerms,
      due_date: dueDate || invoiceDate,
      po_number: poNumber.trim() || undefined,
      notes: notes.trim(),
      terms: terms.trim(),
      subtotal,
      tax_rate: Number(taxRate) || 0,
      tax_amount: taxAmount,
      discount_amount: Number(discountAmount) || 0,
      shipping_amount: Number(shippingAmount) || 0,
      total_amount: totalAmount,
      amount_paid: Number(amountPaid) || 0,
      balance_due: balanceDue,
      status: newInvoiceStatus,
    };

    try {
      // 1. Try saving to Supabase
      const { data: inserted, error: invError } = await supabase
        .from("invoices")
        .insert(invoiceData)
        .select()
        .single();

      let savedInvoice: InvoiceRecord;

      if (invError) {
        console.warn("Saving to local cache due to Supabase error:", invError.message);
        // Fallback to local record
        const fallbackId = `inv_${Date.now()}`;
        savedInvoice = {
          ...invoiceData,
          id: fallbackId,
          created_at: new Date().toISOString(),
          items: items.map((it, idx) => ({ ...it, id: `item_${idx}` })),
        };
      } else {
        // Save items
        const invoiceId = inserted.id;
        const itemsToInsert = items.map((it) => ({
          invoice_id: invoiceId,
          description: it.description,
          quantity: it.quantity,
          rate: it.rate,
          amount: it.amount,
        }));
        await supabase.from("invoice_items").insert(itemsToInsert);

        savedInvoice = {
          ...inserted,
          items: itemsToInsert,
        };
      }

      // Update state and localStorage
      const updatedList = [savedInvoice, ...invoices];
      setInvoices(updatedList);
      localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(updatedList));

      setSuccessMsg(`Invoice ${savedInvoice.invoice_number} generated and saved successfully!`);
      setTimeout(() => setSuccessMsg(""), 5000);

      // Increment invoice number for next invoice
      const nextNum = (parseInt(generatorInvoiceNumber.replace(/\D/g, ""), 10) || 8) + 1;
      setGeneratorInvoiceNumber(String(nextNum));
      setBillTo("");
      setShipTo("");
      setAmountPaid(0);
      setActiveTab("records");
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : "Failed to save invoice.");
    }
  }

  // One-click Mark as Paid
  async function handleMarkAsPaid(inv: InvoiceRecord) {
    try {
      const updated = {
        amount_paid: inv.total_amount,
        balance_due: 0,
        status: "Paid" as const,
      };

      await supabase.from("invoices").update(updated).eq("id", inv.id);

      const updatedList = invoices.map((i) =>
        i.id === inv.id ? { ...i, ...updated } : i
      );
      setInvoices(updatedList);
      localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(updatedList));

      setSuccessMsg(`Invoice ${inv.invoice_number} marked as Paid!`);
      setTimeout(() => setSuccessMsg(""), 4000);
    } catch {
      setErrorMsg("Failed to update invoice status.");
    }
  }

  // Delete Invoice
  async function handleDeleteInvoice(id: string) {
    if (!confirm("Are you sure you want to delete this invoice record?")) return;
    try {
      await supabase.from("invoices").delete().eq("id", id);
      const updated = invoices.filter((i) => i.id !== id);
      setInvoices(updated);
      localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(updated));
    } catch {
      setErrorMsg("Failed to delete invoice.");
    }
  }

  // Month-by-month options
  const availableMonths = useMemo(() => {
    const set = new Set<string>();
    invoices.forEach((inv) => {
      if (inv.date) {
        const d = new Date(inv.date);
        if (!isNaN(d.getTime())) {
          const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
          set.add(key);
        }
      }
    });
    return Array.from(set).sort().reverse();
  }, [invoices]);

  // Filtered Invoices
  const filteredInvoices = invoices.filter((inv) => {
    const q = search.toLowerCase();
    const matchesSearch =
      !q ||
      inv.invoice_number.toLowerCase().includes(q) ||
      inv.bill_to.toLowerCase().includes(q) ||
      (inv.po_number && inv.po_number.toLowerCase().includes(q));

    const matchesStatus = statusFilter === "All" || inv.status === statusFilter;

    let matchesMonth = true;
    if (selectedMonth !== "all" && inv.date) {
      matchesMonth = inv.date.startsWith(selectedMonth);
    }

    return matchesSearch && matchesStatus && matchesMonth;
  });

  // Financial Metrics (Calculated automatically from real database invoice entries)
  const totalRevenue = useMemo(() => {
    return filteredInvoices.reduce((sum, inv) => sum + Number(inv.amount_paid || 0), 0);
  }, [filteredInvoices]);

  const totalInvoiced = useMemo(() => {
    return filteredInvoices.reduce((sum, inv) => sum + Number(inv.total_amount || 0), 0);
  }, [filteredInvoices]);

  const pendingReceivables = useMemo(() => {
    return filteredInvoices.reduce((sum, inv) => sum + Number(inv.balance_due || 0), 0);
  }, [filteredInvoices]);

  const paidCount = filteredInvoices.filter((i) => i.status === "Paid").length;
  const pendingCount = filteredInvoices.filter((i) => i.status === "Pending" || i.status === "Overdue").length;

  return (
    <div className="space-y-6 p-6">
      {/* Top Banner & Title */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Finance & Invoices</h1>
          <p className="mt-1 text-sm text-gray-500">
            Create professional client invoices, monitor accounts receivable, track monthly revenue, and manage financial records.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={() => setActiveTab(activeTab === "generator" ? "records" : "generator")}
            className={`flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold shadow-sm transition ${
              activeTab === "generator"
                ? "bg-gray-900 text-white hover:bg-gray-800"
                : "bg-blue-600 text-white hover:bg-blue-700"
            }`}
          >
            {activeTab === "generator" ? (
              <>
                <FileText size={16} />
                View Invoices & Billing
              </>
            ) : (
              <>
                <Plus size={16} />
                Create New Invoice
              </>
            )}
          </button>
        </div>
      </div>

      {/* SQL Missing Notice / Quick Setup */}
      {dbTableMissing && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 shadow-sm animate-fadeIn">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-start gap-2.5">
              <AlertCircle size={20} className="text-amber-600 shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold text-amber-900 text-sm">
                  Database Table Notice: `public.invoices` table not yet found in Supabase
                </p>
                <p className="mt-0.5 text-xs text-amber-700">
                  You can generate and manage invoices right now using persistent local storage. To sync with your remote Supabase backend, run the SQL script in your Supabase SQL editor.
                </p>
              </div>
            </div>
            <button
              onClick={() => {
                navigator.clipboard.writeText(INVOICE_TABLE_SQL);
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

      {/* Feedback Messages */}
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

      {/* ========================================================================= */}
      {/* VIEW 1: INVOICE GENERATOR (Matches Invoice-Generator.com layout)          */}
      {/* ========================================================================= */}
      {activeTab === "generator" ? (
        <div className="rounded-2xl border border-gray-200 bg-white p-6 md:p-10 shadow-lg space-y-8 animate-fadeIn">
          {/* Top Actions Bar inside Generator */}
          <div className="flex flex-wrap items-center justify-between gap-4 border-b border-gray-100 pb-5">
            <div className="flex items-center gap-2">
              <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-50 text-blue-600">
                <FileText size={20} />
              </span>
              <div>
                <h2 className="text-lg font-bold text-gray-900">Invoice Creator</h2>
                <p className="text-xs text-gray-500">Design, calculate, and generate unique client invoices</p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2.5">
              <button
                type="button"
                onClick={() => window.print()}
                className="flex items-center gap-1.5 rounded-xl border border-gray-200 bg-white px-4 py-2 text-xs font-semibold text-gray-700 shadow-sm hover:bg-gray-50 transition"
              >
                <Download size={15} />
                Download / Print
              </button>

              <button
                type="button"
                onClick={handleSaveInvoice}
                className="flex items-center gap-1.5 rounded-xl bg-emerald-600 px-5 py-2 text-xs font-semibold text-white shadow-sm hover:bg-emerald-700 transition"
              >
                <Send size={15} />
                Save & Record Invoice
              </button>
            </div>
          </div>

          {/* Invoice Document Body */}
          <div className="border border-gray-200 rounded-xl p-6 md:p-8 bg-white shadow-sm space-y-6">
            {/* Header: Company Info vs Large INVOICE Title */}
            <div className="flex flex-col md:flex-row justify-between items-start gap-6">
              {/* Left Header */}
              <div className="space-y-3 w-full md:w-1/2">
                <div className="flex items-center gap-2 text-emerald-600">
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-50 border border-emerald-200 font-bold text-lg">
                    ▲
                  </div>
                  <div>
                    <input
                      type="text"
                      value={fromName}
                      onChange={(e) => setFromName(e.target.value)}
                      placeholder="Company Name"
                      className="font-bold text-xl text-gray-900 outline-none border-b border-transparent hover:border-gray-300 focus:border-blue-500 w-full"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-1">
                    Who is this from?
                  </label>
                  <textarea
                    rows={2}
                    value={fromDetails}
                    onChange={(e) => setFromDetails(e.target.value)}
                    placeholder="Company address, GSTIN, email, phone number..."
                    className="w-full text-xs text-gray-700 border border-gray-200 rounded-lg p-2.5 outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                  />
                </div>
              </div>

              {/* Right Header: INVOICE & # Number */}
              <div className="w-full md:w-auto flex flex-col items-start md:items-end space-y-3">
                <div className="flex items-center gap-3">
                  <h1 className="text-3xl md:text-4xl font-extrabold tracking-tight text-gray-900">INVOICE</h1>
                  <div className="flex items-center gap-1 border border-gray-200 rounded-lg px-2.5 py-1 bg-gray-50">
                    <span className="text-sm font-semibold text-gray-400">#</span>
                    <input
                      type="text"
                      value={generatorInvoiceNumber}
                      onChange={(e) => setGeneratorInvoiceNumber(e.target.value)}
                      placeholder="8"
                      className="w-20 text-sm font-bold text-gray-900 bg-transparent outline-none text-right"
                    />
                  </div>
                </div>

                {/* Right Meta Fields */}
                <div className="w-full sm:w-72 space-y-2 text-xs">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-gray-500 font-medium">Date</span>
                    <input
                      type="date"
                      value={invoiceDate}
                      onChange={(e) => setInvoiceDate(e.target.value)}
                      className="rounded-lg border border-gray-200 px-2.5 py-1 text-xs text-gray-800 outline-none focus:border-blue-500 w-40"
                    />
                  </div>

                  <div className="flex items-center justify-between gap-2">
                    <span className="text-gray-500 font-medium">Payment Terms</span>
                    <select
                      value={paymentTerms}
                      onChange={(e) => setPaymentTerms(e.target.value)}
                      className="rounded-lg border border-gray-200 px-2.5 py-1 text-xs text-gray-800 outline-none focus:border-blue-500 w-40 bg-white"
                    >
                      <option value="Due on Receipt">Due on Receipt</option>
                      <option value="Net 15">Net 15</option>
                      <option value="Net 30">Net 30</option>
                      <option value="Net 60">Net 60</option>
                    </select>
                  </div>

                  <div className="flex items-center justify-between gap-2">
                    <span className="text-gray-500 font-medium">Due Date</span>
                    <input
                      type="date"
                      value={dueDate}
                      onChange={(e) => setDueDate(e.target.value)}
                      className="rounded-lg border border-gray-200 px-2.5 py-1 text-xs text-gray-800 outline-none focus:border-blue-500 w-40"
                    />
                  </div>

                  <div className="flex items-center justify-between gap-2">
                    <span className="text-gray-500 font-medium">PO Number</span>
                    <input
                      type="text"
                      value={poNumber}
                      onChange={(e) => setPoNumber(e.target.value)}
                      placeholder="e.g. PO-9821"
                      className="rounded-lg border border-gray-200 px-2.5 py-1 text-xs text-gray-800 outline-none focus:border-blue-500 w-40"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Bill To & Ship To Fields */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
              <div>
                <label className="block text-[11px] font-semibold text-gray-500 uppercase tracking-wider mb-1">
                  Bill To <span className="text-rose-500">*</span>
                </label>
                <textarea
                  rows={3}
                  value={billTo}
                  onChange={(e) => setBillTo(e.target.value)}
                  placeholder="Who is this to? (Client Name, Company, Address, Contact)"
                  className="w-full text-xs text-gray-800 border border-gray-200 rounded-lg p-2.5 outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-1">
                  Ship To <span className="font-normal lowercase text-gray-400">(optional)</span>
                </label>
                <textarea
                  rows={3}
                  value={shipTo}
                  onChange={(e) => setShipTo(e.target.value)}
                  placeholder="Shipping address, branch location, receiver..."
                  className="w-full text-xs text-gray-800 border border-gray-200 rounded-lg p-2.5 outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                />
              </div>
            </div>

            {/* Line Items Table (Black Navy Header matching reference screenshot) */}
            <div className="rounded-xl border border-gray-200 overflow-hidden shadow-sm">
              <table className="w-full text-left text-xs">
                <thead className="bg-[#111827] text-white font-semibold">
                  <tr>
                    <th className="px-4 py-3 w-1/2">Item</th>
                    <th className="px-4 py-3 text-center w-24">Quantity</th>
                    <th className="px-4 py-3 text-right w-32">Rate (₹)</th>
                    <th className="px-4 py-3 text-right w-36">Amount</th>
                    <th className="px-2 py-3 w-10"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 bg-white">
                  {items.map((item, index) => (
                    <tr key={index} className="hover:bg-gray-50/50">
                      <td className="px-4 py-2.5">
                        <input
                          type="text"
                          value={item.description}
                          onChange={(e) => handleItemChange(index, "description", e.target.value)}
                          placeholder="Description of item/service..."
                          className="w-full text-xs text-gray-800 outline-none border border-transparent hover:border-gray-200 focus:border-blue-500 rounded p-1.5"
                        />
                      </td>
                      <td className="px-4 py-2.5 text-center">
                        <input
                          type="number"
                          min="1"
                          value={item.quantity}
                          onChange={(e) => handleItemChange(index, "quantity", Math.max(1, parseFloat(e.target.value) || 1))}
                          className="w-20 text-center text-xs text-gray-800 border border-gray-200 rounded p-1.5 outline-none focus:border-blue-500"
                        />
                      </td>
                      <td className="px-4 py-2.5 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <span className="text-gray-400 font-medium">₹</span>
                          <input
                            type="number"
                            min="0"
                            step="0.01"
                            value={item.rate}
                            onChange={(e) => handleItemChange(index, "rate", parseFloat(e.target.value) || 0)}
                            className="w-28 text-right text-xs text-gray-800 border border-gray-200 rounded p-1.5 outline-none focus:border-blue-500"
                          />
                        </div>
                      </td>
                      <td className="px-4 py-2.5 text-right font-semibold text-gray-900">
                        ₹{item.amount.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                      </td>
                      <td className="px-2 py-2.5 text-center">
                        {items.length > 1 && (
                          <button
                            type="button"
                            onClick={() => handleRemoveItem(index)}
                            className="text-gray-400 hover:text-rose-600 transition p-1"
                            title="Remove Line Item"
                          >
                            <Trash2 size={14} />
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {/* + Line Item Button */}
              <div className="bg-gray-50/80 p-2 border-t border-gray-200">
                <button
                  type="button"
                  onClick={handleAddItem}
                  className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold text-blue-600 hover:bg-blue-50 transition"
                >
                  <Plus size={14} />
                  + Line Item
                </button>
              </div>
            </div>

            {/* Bottom Calculations & Notes Section */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 pt-4">
              {/* Left Column: Notes & Terms */}
              <div className="space-y-4">
                <div>
                  <label className="block text-[11px] font-semibold text-gray-500 uppercase tracking-wider mb-1">
                    Notes
                  </label>
                  <textarea
                    rows={3}
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="Notes - any relevant information not already covered"
                    className="w-full text-xs text-gray-700 border border-gray-200 rounded-lg p-2.5 outline-none focus:border-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-gray-500 uppercase tracking-wider mb-1">
                    Terms
                  </label>
                  <textarea
                    rows={3}
                    value={terms}
                    onChange={(e) => setTerms(e.target.value)}
                    placeholder="Terms and conditions - late fees, payment methods, delivery schedule"
                    className="w-full text-xs text-gray-700 border border-gray-200 rounded-lg p-2.5 outline-none focus:border-blue-500"
                  />
                </div>
              </div>

              {/* Right Column: Subtotal, Tax, Discounts, Balance Due */}
              <div className="space-y-2.5 text-xs">
                <div className="flex items-center justify-between py-1.5 border-b border-gray-100">
                  <span className="text-gray-500 font-medium">Subtotal</span>
                  <span className="font-semibold text-gray-900">
                    ₹{subtotal.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                  </span>
                </div>

                <div className="flex items-center justify-between py-1.5 border-b border-gray-100">
                  <div className="flex items-center gap-2">
                    <span className="text-gray-500 font-medium">Tax Rate (%)</span>
                    <input
                      type="number"
                      min="0"
                      max="100"
                      value={taxRate}
                      onChange={(e) => setTaxRate(parseFloat(e.target.value) || 0)}
                      className="w-16 rounded border border-gray-200 p-1 text-center text-xs outline-none focus:border-blue-500"
                    />
                  </div>
                  <span className="font-semibold text-gray-900">
                    ₹{taxAmount.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                  </span>
                </div>

                {/* Optional Discount Toggle */}
                {showDiscountInput ? (
                  <div className="flex items-center justify-between py-1.5 border-b border-gray-100">
                    <div className="flex items-center gap-1.5">
                      <span className="text-gray-500 font-medium">Discount (₹)</span>
                      <button
                        type="button"
                        onClick={() => {
                          setShowDiscountInput(false);
                          setDiscountAmount(0);
                        }}
                        className="text-gray-400 hover:text-rose-500 text-[10px]"
                      >
                        (remove)
                      </button>
                    </div>
                    <input
                      type="number"
                      min="0"
                      value={discountAmount}
                      onChange={(e) => setDiscountAmount(parseFloat(e.target.value) || 0)}
                      className="w-24 text-right rounded border border-gray-200 p-1 text-xs outline-none focus:border-blue-500"
                    />
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => setShowDiscountInput(true)}
                    className="text-[11px] font-semibold text-emerald-600 hover:underline block"
                  >
                    + Discount
                  </button>
                )}

                {/* Optional Shipping Toggle */}
                {showShippingInput ? (
                  <div className="flex items-center justify-between py-1.5 border-b border-gray-100">
                    <div className="flex items-center gap-1.5">
                      <span className="text-gray-500 font-medium">Shipping (₹)</span>
                      <button
                        type="button"
                        onClick={() => {
                          setShowShippingInput(false);
                          setShippingAmount(0);
                        }}
                        className="text-gray-400 hover:text-rose-500 text-[10px]"
                      >
                        (remove)
                      </button>
                    </div>
                    <input
                      type="number"
                      min="0"
                      value={shippingAmount}
                      onChange={(e) => setShippingAmount(parseFloat(e.target.value) || 0)}
                      className="w-24 text-right rounded border border-gray-200 p-1 text-xs outline-none focus:border-blue-500"
                    />
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => setShowShippingInput(true)}
                    className="text-[11px] font-semibold text-emerald-600 hover:underline block"
                  >
                    + Shipping
                  </button>
                )}

                <div className="flex items-center justify-between py-2 border-b border-gray-200 text-sm font-bold text-gray-900">
                  <span>Total</span>
                  <span>₹{totalAmount.toLocaleString("en-IN", { minimumFractionDigits: 2 })}</span>
                </div>

                <div className="flex items-center justify-between py-1.5 border-b border-gray-100">
                  <span className="text-gray-500 font-medium">Amount Paid (₹)</span>
                  <input
                    type="number"
                    min="0"
                    max={totalAmount}
                    value={amountPaid}
                    onChange={(e) => setAmountPaid(parseFloat(e.target.value) || 0)}
                    className="w-28 text-right rounded border border-gray-200 p-1 text-xs outline-none focus:border-blue-500 font-medium"
                  />
                </div>

                <div className="flex items-center justify-between pt-3 text-base font-extrabold text-gray-900">
                  <span>Balance Due</span>
                  <span className={balanceDue > 0 ? "text-rose-600" : "text-emerald-600"}>
                    ₹{balanceDue.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Bottom Generator Actions */}
          <div className="flex items-center justify-end gap-3 pt-3">
            <button
              type="button"
              onClick={() => setActiveTab("records")}
              className="rounded-xl border border-gray-200 px-4 py-2 text-xs font-semibold text-gray-600 hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSaveInvoice}
              className="flex items-center gap-1.5 rounded-xl bg-blue-600 px-6 py-2.5 text-xs font-semibold text-white shadow-sm hover:bg-blue-700 transition"
            >
              <Check size={15} />
              Save & Record Invoice
            </button>
          </div>
        </div>
      ) : (
        /* ========================================================================= */
        /* VIEW 2: FINANCIAL OVERVIEW, MONTH-BY-MONTH & INVOICES MANAGEMENT          */
        /* ========================================================================= */
        <div className="space-y-6 animate-fadeIn">
          {/* 4 Financial Metric Cards (Directly derived from database records) */}
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-4">
            <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium text-gray-500">Total Collected Revenue</p>
                <div className="rounded-lg bg-emerald-50 p-2 text-emerald-600">
                  <IndianRupee size={20} />
                </div>
              </div>
              <h2 className="mt-3 text-2xl font-bold text-gray-900">
                ₹{totalRevenue.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
              </h2>
              <span className="mt-1 flex items-center gap-1 text-xs font-semibold text-emerald-600">
                <TrendingUp size={13} /> {paidCount} invoice(s) fully paid
              </span>
            </div>

            <div className="rounded-xl border border-amber-200 bg-amber-50/40 p-5 shadow-sm">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium text-amber-800">Pending Receivables</p>
                <div className="rounded-lg bg-amber-100 p-2 text-amber-700">
                  <Clock size={20} />
                </div>
              </div>
              <h2 className="mt-3 text-2xl font-bold text-amber-600">
                ₹{pendingReceivables.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
              </h2>
              <span className="mt-1 block text-xs text-amber-700">
                {pendingCount} invoice(s) awaiting clearance
              </span>
            </div>

            <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium text-gray-500">Total Invoiced Amount</p>
                <div className="rounded-lg bg-blue-50 p-2 text-blue-600">
                  <FileText size={20} />
                </div>
              </div>
              <h2 className="mt-3 text-2xl font-bold text-gray-900">
                ₹{totalInvoiced.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
              </h2>
              <span className="mt-1 block text-xs text-gray-400">
                Total across {filteredInvoices.length} billing records
              </span>
            </div>

            <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium text-gray-500">Payment Clearance Rate</p>
                <div className="rounded-lg bg-purple-50 p-2 text-purple-600">
                  <ArrowUpRight size={20} />
                </div>
              </div>
              <h2 className="mt-3 text-2xl font-bold text-purple-700">
                {totalInvoiced > 0 ? `${Math.round((totalRevenue / totalInvoiced) * 100)}%` : "100%"}
              </h2>
              <span className="mt-1 block text-xs text-gray-400">
                Healthy financial collection index
              </span>
            </div>
          </div>

          {/* Invoices Management Section */}
          <div className="rounded-xl border border-gray-200 bg-white shadow-sm overflow-hidden">
            {/* Filter Bar with Month Selector and Status Pills */}
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-gray-200 p-5">
              <div className="flex flex-wrap items-center gap-3">
                <h2 className="font-semibold text-gray-900">
                  Invoices & Financial Records ({filteredInvoices.length})
                </h2>

                {/* Month-by-Month Filter */}
                <div className="flex items-center gap-1.5 rounded-lg border border-gray-200 bg-gray-50 px-3 py-1.5 text-xs text-gray-700">
                  <Calendar size={14} className="text-gray-500" />
                  <select
                    value={selectedMonth}
                    onChange={(e) => setSelectedMonth(e.target.value)}
                    className="bg-transparent font-medium outline-none cursor-pointer"
                  >
                    <option value="all">All Months</option>
                    {availableMonths.map((m) => {
                      const [year, month] = m.split("-");
                      const dateObj = new Date(parseInt(year, 10), parseInt(month, 10) - 1, 1);
                      const monthName = dateObj.toLocaleString("en-US", { month: "long", year: "numeric" });
                      return (
                        <option key={m} value={m}>
                          {monthName}
                        </option>
                      );
                    })}
                  </select>
                </div>
              </div>

              {/* Search & Actions */}
              <div className="flex flex-wrap items-center gap-2.5">
                <div className="flex items-center gap-2 rounded-lg border border-gray-200 px-3 py-1.5">
                  <Search size={15} className="text-gray-400" />
                  <input
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Search invoice #, client..."
                    className="w-48 text-xs outline-none"
                  />
                </div>

                <div className="flex items-center gap-1">
                  {(["All", "Paid", "Pending", "Overdue"] as const).map((status) => (
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

                <button
                  onClick={loadInvoices}
                  disabled={loading}
                  className="rounded-lg border border-gray-200 p-2 text-gray-600 hover:bg-gray-50 transition"
                  title="Reload Records"
                >
                  <RefreshCw size={15} className={loading ? "animate-spin text-blue-600" : ""} />
                </button>
              </div>
            </div>

            {/* Invoices Table */}
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm text-gray-600">
                <thead className="bg-gray-50 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                  <tr>
                    <th className="px-5 py-3.5">Invoice #</th>
                    <th className="px-5 py-3.5">Client / Bill To</th>
                    <th className="px-5 py-3.5">Date</th>
                    <th className="px-5 py-3.5">Due Date</th>
                    <th className="px-5 py-3.5 text-right">Total Amount</th>
                    <th className="px-5 py-3.5 text-right">Amount Paid</th>
                    <th className="px-5 py-3.5 text-right">Balance Due</th>
                    <th className="px-5 py-3.5">Status</th>
                    <th className="px-5 py-3.5 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {loading ? (
                    <tr>
                      <td colSpan={9} className="py-12 text-center text-sm text-gray-500">
                        <RefreshCw size={24} className="mx-auto mb-2 animate-spin text-blue-600" />
                        Loading financial records...
                      </td>
                    </tr>
                  ) : filteredInvoices.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="py-12 text-center">
                        <FileText size={36} className="mx-auto mb-3 text-gray-300" />
                        <p className="text-sm font-medium text-gray-700">No invoices or billing records found</p>
                        <p className="mt-1 text-xs text-gray-400">
                          Click "Create New Invoice" above to generate your first client invoice.
                        </p>
                      </td>
                    </tr>
                  ) : (
                    filteredInvoices.map((inv) => (
                      <tr key={inv.id} className="hover:bg-gray-50/70 transition">
                        <td className="px-5 py-4">
                          <span className="font-bold text-gray-900">{inv.invoice_number}</span>
                          {inv.po_number && (
                            <span className="block text-[11px] text-gray-400">PO: {inv.po_number}</span>
                          )}
                        </td>

                        <td className="px-5 py-4 max-w-xs">
                          <p className="font-semibold text-gray-900 truncate" title={inv.bill_to}>
                            {inv.bill_to.split("\n")[0]}
                          </p>
                          <span className="text-xs text-gray-400 truncate block">
                            {inv.bill_to.split("\n")[1] || "Direct Client"}
                          </span>
                        </td>

                        <td className="px-5 py-4 text-xs font-medium text-gray-700">
                          {inv.date || "N/A"}
                        </td>

                        <td className="px-5 py-4 text-xs font-medium text-gray-700">
                          {inv.due_date || "Upon Receipt"}
                        </td>

                        <td className="px-5 py-4 text-right font-bold text-gray-900">
                          ₹{Number(inv.total_amount).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                        </td>

                        <td className="px-5 py-4 text-right font-semibold text-emerald-600 text-xs">
                          ₹{Number(inv.amount_paid).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                        </td>

                        <td className="px-5 py-4 text-right font-semibold text-xs">
                          <span className={Number(inv.balance_due) > 0 ? "text-rose-600" : "text-gray-400"}>
                            ₹{Number(inv.balance_due).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                          </span>
                        </td>

                        <td className="px-5 py-4">
                          <span
                            className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                              inv.status === "Paid"
                                ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                                : inv.status === "Overdue"
                                ? "bg-rose-50 text-rose-700 border border-rose-200"
                                : "bg-amber-50 text-amber-700 border border-amber-200"
                            }`}
                          >
                            {inv.status === "Paid" && <Check size={12} />}
                            {inv.status === "Pending" && <Clock size={12} />}
                            {inv.status}
                          </span>
                        </td>

                        <td className="px-5 py-4 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            {/* View / Print Invoice */}
                            <button
                              onClick={() => setSelectedInvoiceForView(inv)}
                              className="rounded-lg border border-gray-200 p-1.5 text-gray-600 hover:bg-gray-100 hover:text-gray-900 transition"
                              title="View & Print Invoice"
                            >
                              <Eye size={15} />
                            </button>

                            {/* Mark as Paid */}
                            {inv.status !== "Paid" && (
                              <button
                                onClick={() => handleMarkAsPaid(inv)}
                                className="flex items-center gap-1 rounded-lg bg-emerald-600 px-2 py-1.5 text-xs font-medium text-white hover:bg-emerald-700 shadow-sm transition"
                                title="Mark as Fully Paid"
                              >
                                <Check size={13} />
                                Paid
                              </button>
                            )}

                            {/* Delete */}
                            <button
                              onClick={() => handleDeleteInvoice(inv.id)}
                              className="rounded-lg border border-gray-200 p-1.5 text-gray-400 hover:text-rose-600 hover:bg-rose-50 transition"
                              title="Delete Record"
                            >
                              <Trash2 size={15} />
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
        </div>
      )}

      {/* ========================================================================= */}
      {/* VIEW / PRINT INVOICE MODAL (Styled to match the reference document)       */}
      {/* ========================================================================= */}
      {selectedInvoiceForView && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm animate-fadeIn overflow-y-auto">
          <div className="w-full max-w-3xl rounded-2xl bg-white p-8 shadow-2xl space-y-6 my-6">
            {/* Modal Actions */}
            <div className="flex items-center justify-between border-b border-gray-100 pb-4">
              <span className="font-bold text-gray-900 text-sm">
                Invoice Preview — {selectedInvoiceForView.invoice_number}
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => window.print()}
                  className="flex items-center gap-1.5 rounded-lg bg-blue-600 px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-blue-700 shadow-sm"
                >
                  <Printer size={14} />
                  Print / PDF
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedInvoiceForView(null)}
                  className="rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-100"
                >
                  Close
                </button>
              </div>
            </div>

            {/* Printable Invoice Container */}
            <div className="p-6 border border-gray-200 rounded-xl space-y-6 bg-white text-xs">
              {/* Header */}
              <div className="flex justify-between items-start">
                <div>
                  <div className="flex items-center gap-2 text-emerald-600 font-bold text-lg mb-1">
                    ▲ {selectedInvoiceForView.from_name}
                  </div>
                  <p className="text-gray-500 whitespace-pre-line">{selectedInvoiceForView.from_details}</p>
                </div>

                <div className="text-right">
                  <h1 className="text-3xl font-extrabold text-gray-900">INVOICE</h1>
                  <span className="text-sm font-bold text-blue-600 block mt-1">
                    {selectedInvoiceForView.invoice_number}
                  </span>
                  <div className="mt-2 text-gray-500 space-y-0.5">
                    <p>Date: <span className="text-gray-900 font-medium">{selectedInvoiceForView.date}</span></p>
                    <p>Due: <span className="text-gray-900 font-medium">{selectedInvoiceForView.due_date}</span></p>
                    {selectedInvoiceForView.po_number && (
                      <p>PO: <span className="text-gray-900 font-medium">{selectedInvoiceForView.po_number}</span></p>
                    )}
                  </div>
                </div>
              </div>

              {/* Bill To */}
              <div className="border-t border-gray-100 pt-4 grid grid-cols-2 gap-4">
                <div>
                  <span className="font-semibold text-gray-400 uppercase text-[10px] block mb-1">Bill To</span>
                  <p className="text-gray-900 font-semibold whitespace-pre-line">{selectedInvoiceForView.bill_to}</p>
                </div>
                {selectedInvoiceForView.ship_to && (
                  <div>
                    <span className="font-semibold text-gray-400 uppercase text-[10px] block mb-1">Ship To</span>
                    <p className="text-gray-800 whitespace-pre-line">{selectedInvoiceForView.ship_to}</p>
                  </div>
                )}
              </div>

              {/* Items Table */}
              <table className="w-full text-left border-collapse">
                <thead className="bg-[#111827] text-white">
                  <tr>
                    <th className="p-2.5">Item Description</th>
                    <th className="p-2.5 text-center">Qty</th>
                    <th className="p-2.5 text-right">Rate</th>
                    <th className="p-2.5 text-right">Amount</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {selectedInvoiceForView.items && selectedInvoiceForView.items.length > 0 ? (
                    selectedInvoiceForView.items.map((it, idx) => (
                      <tr key={idx}>
                        <td className="p-2.5 font-medium text-gray-800">{it.description}</td>
                        <td className="p-2.5 text-center text-gray-600">{it.quantity}</td>
                        <td className="p-2.5 text-right text-gray-600">₹{Number(it.rate).toLocaleString("en-IN")}</td>
                        <td className="p-2.5 text-right font-semibold text-gray-900">₹{Number(it.amount).toLocaleString("en-IN")}</td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td className="p-2.5 font-medium text-gray-800">Professional Services / Products</td>
                      <td className="p-2.5 text-center text-gray-600">1</td>
                      <td className="p-2.5 text-right text-gray-600">₹{Number(selectedInvoiceForView.subtotal).toLocaleString("en-IN")}</td>
                      <td className="p-2.5 text-right font-semibold text-gray-900">₹{Number(selectedInvoiceForView.subtotal).toLocaleString("en-IN")}</td>
                    </tr>
                  )}
                </tbody>
              </table>

              {/* Calculations Summary */}
              <div className="flex justify-end pt-2">
                <div className="w-64 space-y-1.5 border-t border-gray-100 pt-3">
                  <div className="flex justify-between text-gray-500">
                    <span>Subtotal:</span>
                    <span className="font-semibold text-gray-900">₹{Number(selectedInvoiceForView.subtotal).toLocaleString("en-IN")}</span>
                  </div>
                  {Number(selectedInvoiceForView.tax_amount) > 0 && (
                    <div className="flex justify-between text-gray-500">
                      <span>Tax ({selectedInvoiceForView.tax_rate}%):</span>
                      <span className="font-semibold text-gray-900">₹{Number(selectedInvoiceForView.tax_amount).toLocaleString("en-IN")}</span>
                    </div>
                  )}
                  {Number(selectedInvoiceForView.discount_amount) > 0 && (
                    <div className="flex justify-between text-emerald-600">
                      <span>Discount:</span>
                      <span>-₹{Number(selectedInvoiceForView.discount_amount).toLocaleString("en-IN")}</span>
                    </div>
                  )}
                  {Number(selectedInvoiceForView.shipping_amount) > 0 && (
                    <div className="flex justify-between text-gray-500">
                      <span>Shipping:</span>
                      <span>+₹{Number(selectedInvoiceForView.shipping_amount).toLocaleString("en-IN")}</span>
                    </div>
                  )}
                  <div className="flex justify-between font-bold text-gray-900 border-t border-gray-200 pt-1 text-sm">
                    <span>Total:</span>
                    <span>₹{Number(selectedInvoiceForView.total_amount).toLocaleString("en-IN")}</span>
                  </div>
                  <div className="flex justify-between text-emerald-600 font-semibold">
                    <span>Amount Paid:</span>
                    <span>₹{Number(selectedInvoiceForView.amount_paid).toLocaleString("en-IN")}</span>
                  </div>
                  <div className="flex justify-between text-base font-extrabold pt-1 border-t border-gray-200">
                    <span>Balance Due:</span>
                    <span className={Number(selectedInvoiceForView.balance_due) > 0 ? "text-rose-600" : "text-emerald-600"}>
                      ₹{Number(selectedInvoiceForView.balance_due).toLocaleString("en-IN")}
                    </span>
                  </div>
                </div>
              </div>

              {/* Notes & Terms */}
              {(selectedInvoiceForView.notes || selectedInvoiceForView.terms) && (
                <div className="border-t border-gray-100 pt-4 space-y-2 text-[11px] text-gray-500">
                  {selectedInvoiceForView.notes && (
                    <p><span className="font-semibold text-gray-700">Notes:</span> {selectedInvoiceForView.notes}</p>
                  )}
                  {selectedInvoiceForView.terms && (
                    <p><span className="font-semibold text-gray-700">Terms:</span> {selectedInvoiceForView.terms}</p>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
