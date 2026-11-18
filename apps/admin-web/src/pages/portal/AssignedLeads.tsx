import { useState, useEffect } from "react";
import { useOutletContext } from "react-router-dom";
import {
  Target,
  Search,
  Filter,
  Phone,
  Mail,
  Building,
  Edit3,
  CheckCircle2,
  X,
  RefreshCw,
  CalendarDays
} from "lucide-react";
import { supabase } from "../../services/supabase";
import { notifyAdmin } from "../../services/notifications";
import type { EmployeeInfo } from "../../components/layout/EmployeeLayout";

interface ProfileContext {
  profile: EmployeeInfo | null;
  loadingProfile: boolean;
}

interface AssignedLead {
  id: string;
  name: string;
  company: string;
  email: string;
  phone: string;
  value: string;
  stage: "New" | "Contacted" | "Qualified" | "Proposal" | "Won" | "Lost";
  source: string;
  remarks: string;
  created_at: string;
  updated_at: string;
}

const stageColors = {
  New: "bg-blue-50 text-blue-700 border-blue-200",
  Contacted: "bg-purple-50 text-purple-700 border-purple-200",
  Qualified: "bg-amber-50 text-amber-700 border-amber-200",
  Proposal: "bg-indigo-50 text-indigo-700 border-indigo-200",
  Won: "bg-emerald-50 text-emerald-700 border-emerald-200",
  Lost: "bg-rose-50 text-rose-700 border-rose-200",
};

export default function AssignedLeads() {
  const { profile } = useOutletContext<ProfileContext>();
  const [leads, setLeads] = useState<AssignedLead[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [stageFilter, setStageFilter] = useState("All");

  // Lead update modal state
  const [editingLead, setEditingLead] = useState<AssignedLead | null>(null);
  const [newStage, setNewStage] = useState<AssignedLead["stage"]>("New");
  const [newRemarks, setNewRemarks] = useState("");
  const [saving, setSaving] = useState(false);
  const [successMsg, setSuccessMsg] = useState("");
  const [errorMsg, setErrorMsg] = useState("");

  // Schedule follow-up modal state
  const [schedulingLead, setSchedulingLead] = useState<AssignedLead | null>(null);
  const [followupDate, setFollowupDate] = useState("");
  const [followupTime, setFollowupTime] = useState("");
  const [followupNotes, setFollowupNotes] = useState("");
  const [savingFollowup, setSavingFollowup] = useState(false);

  async function loadAssignedLeads() {
    if (!profile?.id) return;
    setLoading(true);
    setErrorMsg("");

    try {
      const { data, error } = await supabase
        .from("leads")
        .select("*")
        .eq("assigned_to", profile.id)
        .order("created_at", { ascending: false });

      if (error) {
        setErrorMsg(error.message);
      } else {
        setLeads((data ?? []) as AssignedLead[]);
      }
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : "Error loading assigned leads.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (profile?.id) {
      loadAssignedLeads();
    }
  }, [profile?.id]);

  const filtered = leads.filter((lead) => {
    const matchesSearch =
      (lead.name || "").toLowerCase().includes(search.toLowerCase()) ||
      (lead.company || "").toLowerCase().includes(search.toLowerCase()) ||
      (lead.phone || "").includes(search);
    const matchesStage = stageFilter === "All" || lead.stage === stageFilter;
    return matchesSearch && matchesStage;
  });

  function openUpdateModal(lead: AssignedLead) {
    setEditingLead(lead);
    setNewStage(lead.stage || "New");
    setNewRemarks(lead.remarks || "");
    setSuccessMsg("");
    setErrorMsg("");
  }

  async function handleSaveUpdate(e: React.FormEvent) {
    e.preventDefault();
    if (!editingLead) return;

    setSaving(true);
    setErrorMsg("");

    try {
      const { error } = await supabase
        .from("leads")
        .update({
          stage: newStage,
          remarks: newRemarks,
          updated_at: new Date().toISOString(),
        })
        .eq("id", editingLead.id);

      if (error) {
        throw new Error(error.message);
      }

      await notifyAdmin(
        "Lead Progress Updated",
        `${profile?.full_name || "Employee"} updated lead "${editingLead.name}" to status "${newStage}". Remarks: ${newRemarks || "None"}`,
        "status_update",
        "/leads"
      );

      setSuccessMsg(`Updated status for "${editingLead.name}" to "${newStage}" successfully.`);
      setEditingLead(null);
      await loadAssignedLeads();
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : "Could not update lead.");
    } finally {
      setSaving(false);
    }
  }

  async function handleScheduleFollowup(e: React.FormEvent) {
    e.preventDefault();
    if (!schedulingLead || !profile?.id) return;

    setSavingFollowup(true);
    setErrorMsg("");

    try {
      const { error } = await supabase.from("follow_ups").insert({
        lead_id: schedulingLead.id,
        employee_id: profile.id,
        client_name: schedulingLead.name,
        company_name: schedulingLead.company,
        scheduled_date: followupDate,
        scheduled_time: followupTime,
        type: "Phone Call",
        priority: "Normal",
        status: "Pending",
        notes: followupNotes,
      });

      if (error) {
        throw new Error(error.message);
      }

      await notifyAdmin(
        "Follow-up Scheduled",
        `${profile?.full_name || "Employee"} scheduled a follow-up with "${schedulingLead.name}" on ${followupDate} at ${followupTime}.`,
        "call",
        "/followups"
      );

      setSuccessMsg(`Follow-up scheduled with ${schedulingLead.name} on ${followupDate} at ${followupTime}.`);
      setSchedulingLead(null);
      setFollowupDate("");
      setFollowupTime("");
      setFollowupNotes("");
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : "Failed to schedule follow-up.");
    } finally {
      setSavingFollowup(false);
    }
  }

  return (
    <div className="space-y-6 p-6">
      {/* Page Heading - Matches Admin Panel */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">My Assigned Leads</h1>
          <p className="mt-1 text-sm text-gray-500">
            View your personal portfolio, log call feedback, and update prospective client stages.
          </p>
        </div>

        <button
          onClick={loadAssignedLeads}
          disabled={loading}
          className="flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 shadow-sm transition disabled:opacity-50"
        >
          <RefreshCw size={15} className={loading ? "animate-spin text-blue-600" : ""} />
          Refresh Leads
        </button>
      </div>

      {successMsg && (
        <div className="flex items-center gap-2 rounded-lg bg-green-50 border border-green-200 p-3 text-sm text-green-700">
          <CheckCircle2 size={16} />
          {successMsg}
        </div>
      )}

      {errorMsg && (
        <div className="rounded-lg bg-red-50 border border-red-200 p-3 text-sm text-red-700">
          {errorMsg}
        </div>
      )}

      {/* Leads Table Container - Identical style to Admin table */}
      <div className="rounded-xl border border-gray-200 bg-white shadow-sm overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-gray-200 p-5">
          <div>
            <h2 className="font-semibold text-gray-900">Assigned Records</h2>
            <p className="mt-1 text-xs text-gray-500">{filtered.length} leads displayed</p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2 rounded-lg border border-gray-200 px-3 py-2">
              <Search size={16} className="text-gray-400" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search leads, phone..."
                className="w-48 text-sm outline-none"
              />
            </div>
            <select
              value={stageFilter}
              onChange={(e) => setStageFilter(e.target.value)}
              className="rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none"
            >
              <option value="All">All Stages</option>
              <option value="New">New</option>
              <option value="Contacted">Contacted</option>
              <option value="Qualified">Qualified</option>
              <option value="Proposal">Proposal</option>
              <option value="Won">Won</option>
              <option value="Lost">Lost</option>
            </select>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-gray-50 text-xs uppercase text-gray-500">
              <tr>
                <th className="px-5 py-4">Client Name</th>
                <th className="px-5 py-4">Company</th>
                <th className="px-5 py-4">Deal Value</th>
                <th className="px-5 py-4">Stage</th>
                <th className="px-5 py-4">Remarks</th>
                <th className="px-5 py-4 text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading ? (
                <tr>
                  <td colSpan={6} className="px-5 py-12 text-center text-gray-500">
                    Loading assigned leads...
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-5 py-12 text-center text-gray-500">
                    No assigned leads found. Leads assigned by the Admin will appear here.
                  </td>
                </tr>
              ) : (
                filtered.map((lead) => (
                  <tr key={lead.id} className="hover:bg-gray-50 transition">
                    <td className="px-5 py-4">
                      <p className="font-medium text-gray-900">{lead.name}</p>
                      <div className="mt-1 flex items-center gap-3 text-xs text-gray-500">
                        {lead.phone && (
                          <span className="flex items-center gap-1">
                            <Phone size={12} /> {lead.phone}
                          </span>
                        )}
                        {lead.email && (
                          <span className="flex items-center gap-1">
                            <Mail size={12} /> {lead.email}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-5 py-4 text-gray-700">
                      <div className="flex items-center gap-1.5 font-medium">
                        <Building size={14} className="text-gray-400" />
                        {lead.company || "-"}
                      </div>
                    </td>
                    <td className="px-5 py-4 font-semibold text-gray-900">{lead.value || "-"}</td>
                    <td className="px-5 py-4">
                      <span
                        className={`inline-block rounded-full border px-2.5 py-0.5 text-xs font-semibold ${
                          stageColors[lead.stage] ?? "bg-gray-100 text-gray-700"
                        }`}
                      >
                        {lead.stage}
                      </span>
                    </td>
                    <td className="px-5 py-4 text-xs text-gray-600 max-w-xs truncate">
                      {lead.remarks || <span className="text-gray-300">No remarks logged</span>}
                    </td>
                    <td className="px-5 py-4 text-center">
                      <div className="flex items-center justify-center gap-2">
                        {lead.phone && (
                          <a
                            href={`tel:${lead.phone}`}
                            className="rounded-lg bg-blue-50 p-2 text-blue-700 hover:bg-blue-100 transition"
                            title="Call Prospect"
                          >
                            <Phone size={15} />
                          </a>
                        )}
                        <button
                          onClick={() => openUpdateModal(lead)}
                          className="rounded-lg bg-blue-50 p-2 text-blue-700 hover:bg-blue-100 transition"
                          title="Update Progress & Remarks"
                        >
                          <Edit3 size={15} />
                        </button>
                        <button
                          onClick={() => {
                            setSchedulingLead(lead);
                            setFollowupDate("");
                            setFollowupTime("");
                            setFollowupNotes("");
                          }}
                          className="rounded-lg border border-gray-200 p-2 text-gray-600 hover:bg-gray-100 transition"
                          title="Schedule Follow-up"
                        >
                          <CalendarDays size={15} />
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

      {/* Update Progress & Remarks Modal */}
      {editingLead && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-lg rounded-2xl bg-white shadow-xl">
            <div className="flex items-center justify-between border-b border-gray-200 p-5">
              <div>
                <h3 className="text-lg font-semibold text-gray-900">
                  Update Lead: {editingLead.name}
                </h3>
                <p className="text-xs text-gray-500">
                  {editingLead.company} ? {editingLead.phone}
                </p>
              </div>
              <button
                onClick={() => setEditingLead(null)}
                className="rounded-lg p-2 text-gray-400 hover:bg-gray-100"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSaveUpdate} className="space-y-4 p-5">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Lead Progress Stage
                </label>
                <select
                  value={newStage}
                  onChange={(e) => setNewStage(e.target.value as AssignedLead["stage"])}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-blue-500"
                >
                  <option value="New">New</option>
                  <option value="Contacted">Contacted</option>
                  <option value="Qualified">Qualified</option>
                  <option value="Proposal">Proposal</option>
                  <option value="Won">Won</option>
                  <option value="Lost">Lost</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Call Remarks & Progress Notes
                </label>
                <textarea
                  rows={4}
                  required
                  value={newRemarks}
                  onChange={(e) => setNewRemarks(e.target.value)}
                  placeholder="Enter details from the conversation, client requirements, or next steps..."
                  className="w-full rounded-lg border border-gray-300 p-3 text-sm outline-none focus:border-blue-500"
                />
              </div>

              <div className="flex justify-end gap-3 border-t border-gray-100 pt-4">
                <button
                  type="button"
                  disabled={saving}
                  onClick={() => setEditingLead(null)}
                  className="rounded-lg border border-gray-300 px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-blue-700 transition disabled:opacity-50"
                >
                  {saving ? "Saving..." : "Save Progress"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Schedule Follow-up Modal */}
      {schedulingLead && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white shadow-xl">
            <div className="flex items-center justify-between border-b border-gray-200 p-5">
              <div>
                <h3 className="text-base font-semibold text-gray-900">
                  Schedule Follow-up
                </h3>
                <p className="text-xs text-gray-500">For {schedulingLead.name}</p>
              </div>
              <button
                onClick={() => setSchedulingLead(null)}
                className="rounded-lg p-2 text-gray-400 hover:bg-gray-100"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleScheduleFollowup} className="space-y-4 p-5">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Date</label>
                  <input
                    type="date"
                    required
                    value={followupDate}
                    onChange={(e) => setFollowupDate(e.target.value)}
                    className="w-full rounded-lg border border-gray-300 p-2 text-sm outline-none focus:border-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Time</label>
                  <input
                    type="time"
                    required
                    value={followupTime}
                    onChange={(e) => setFollowupTime(e.target.value)}
                    className="w-full rounded-lg border border-gray-300 p-2 text-sm outline-none focus:border-blue-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Follow-up Notes</label>
                <textarea
                  rows={3}
                  required
                  value={followupNotes}
                  onChange={(e) => setFollowupNotes(e.target.value)}
                  placeholder="e.g. Discuss revised proposal pricing and contract terms."
                  className="w-full rounded-lg border border-gray-300 p-2.5 text-sm outline-none focus:border-blue-500"
                />
              </div>

              <div className="flex justify-end gap-2 border-t border-gray-100 pt-3">
                <button
                  type="button"
                  onClick={() => setSchedulingLead(null)}
                  className="rounded-lg border border-gray-300 px-4 py-2 text-xs font-medium text-gray-700 hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingFollowup}
                  className="rounded-lg bg-blue-600 px-4 py-2 text-xs font-medium text-white hover:bg-blue-700 transition disabled:opacity-50"
                >
                  {savingFollowup ? "Scheduling..." : "Save Follow-up"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
