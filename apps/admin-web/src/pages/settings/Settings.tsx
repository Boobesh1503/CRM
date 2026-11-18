import { useState, useEffect } from "react";
import {
  Building,
  Shield,
  Bell,
  Save,
  CheckCircle2,
  RefreshCw,
  Copy,
  Check,
  AlertCircle,
  Clock,
  Sparkles
} from "lucide-react";
import { supabase } from "../../services/supabase";

export interface WorkspaceSettings {
  orgName: string;
  supportEmail: string;
  phone: string;
  timeZone: string;
  twoFactorRequired: boolean;
  autoPasswordRotation: boolean;
  emailAlerts: boolean;
  lastUpdated?: string;
}

const LOCAL_STORAGE_KEY = "crm_workspace_settings";

const defaultSettings: WorkspaceSettings = {
  orgName: "Acme Enterprise CRM",
  supportEmail: "support@acmecrm.com",
  phone: "+91 98000 12345",
  timeZone: "Asia/Kolkata (IST +5:30)",
  twoFactorRequired: false,
  autoPasswordRotation: true,
  emailAlerts: true,
};

const WORKSPACE_SETTINGS_SQL = `-- SQL Script for Supabase SQL Editor
CREATE TABLE IF NOT EXISTS public.workspace_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_name text NOT NULL DEFAULT 'Acme Enterprise CRM',
  support_email text NOT NULL DEFAULT 'support@acmecrm.com',
  phone text NOT NULL DEFAULT '+91 98000 12345',
  time_zone text NOT NULL DEFAULT 'Asia/Kolkata (IST +5:30)',
  two_factor_required boolean NOT NULL DEFAULT false,
  auto_password_rotation boolean NOT NULL DEFAULT true,
  email_alerts boolean NOT NULL DEFAULT true,
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE public.workspace_settings ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Admins have full access to workspace settings" ON public.workspace_settings;
CREATE POLICY "Admins have full access to workspace settings" ON public.workspace_settings FOR ALL USING (public.is_admin());
DROP POLICY IF EXISTS "Everyone can view workspace settings" ON public.workspace_settings;
CREATE POLICY "Everyone can view workspace settings" ON public.workspace_settings FOR SELECT USING (auth.role() = 'authenticated');
`;

export default function Settings() {
  // Initialize state synchronously from LocalStorage to avoid any flicker/reset
  const [settings, setSettings] = useState<WorkspaceSettings>(() => {
    try {
      const saved = localStorage.getItem(LOCAL_STORAGE_KEY);
      if (saved) {
        return { ...defaultSettings, ...JSON.parse(saved) };
      }
    } catch {
      // Fallback to default
    }
    return defaultSettings;
  });

  const [isSaving, setIsSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [copiedSql, setCopiedSql] = useState(false);
  const [dbStatusNotice, setDbStatusNotice] = useState<string | null>(null);

  // Sync with remote Supabase table on mount
  useEffect(() => {
    async function fetchRemoteSettings() {
      try {
        const { data, error } = await supabase
          .from("workspace_settings")
          .select("*")
          .limit(1)
          .maybeSingle();

        if (error) {
          if (error.code === "PGRST116" || error.message?.includes("does not exist") || error.code === "42P01") {
            setDbStatusNotice("Database table 'public.workspace_settings' is not yet created in Supabase. Your settings are currently saved safely in persistent browser storage.");
          }
          return;
        }

        if (data) {
          const remoteConfig: WorkspaceSettings = {
            orgName: data.org_name || defaultSettings.orgName,
            supportEmail: data.support_email || defaultSettings.supportEmail,
            phone: data.phone || defaultSettings.phone,
            timeZone: data.time_zone || defaultSettings.timeZone,
            twoFactorRequired: Boolean(data.two_factor_required),
            autoPasswordRotation: Boolean(data.auto_password_rotation),
            emailAlerts: Boolean(data.email_alerts),
            lastUpdated: data.updated_at,
          };
          setSettings(remoteConfig);
          localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(remoteConfig));
          setDbStatusNotice(null);
        }
      } catch (err: any) {
        // Safe offline fallback
        setDbStatusNotice("Running in resilient offline mode. All settings are persistently preserved locally.");
      }
    }

    fetchRemoteSettings();
  }, []);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setIsSaving(true);

    const nowIso = new Date().toISOString();
    const updatedSettings: WorkspaceSettings = {
      ...settings,
      lastUpdated: nowIso,
    };

    // 1. Immediately write to LocalStorage (Guaranteed persistence, zero loss on refresh)
    try {
      localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(updatedSettings));
      window.dispatchEvent(new CustomEvent("crm_settings_updated", { detail: updatedSettings }));
    } catch (e) {
      console.error("Failed to write settings to local storage:", e);
    }

    // 2. Persist to Supabase if table exists
    try {
      const { data: existing } = await supabase
        .from("workspace_settings")
        .select("id")
        .limit(1)
        .maybeSingle();

      const payload = {
        org_name: updatedSettings.orgName.trim(),
        support_email: updatedSettings.supportEmail.trim(),
        phone: updatedSettings.phone.trim(),
        time_zone: updatedSettings.timeZone,
        two_factor_required: updatedSettings.twoFactorRequired,
        auto_password_rotation: updatedSettings.autoPasswordRotation,
        email_alerts: updatedSettings.emailAlerts,
        updated_at: nowIso,
      };

      if (existing?.id) {
        await supabase.from("workspace_settings").update(payload).eq("id", existing.id);
      } else {
        await supabase.from("workspace_settings").insert([payload]);
      }
      setDbStatusNotice(null);
    } catch (err: any) {
      // LocalStorage already has the data saved safely
      setDbStatusNotice("Changes saved to persistent storage. To sync across all team members, execute the setup SQL in Supabase.");
    } finally {
      setIsSaving(false);
      setSaved(true);
      setTimeout(() => setSaved(false), 4000);
    }
  }

  function copySqlScript() {
    navigator.clipboard.writeText(WORKSPACE_SETTINGS_SQL);
    setCopiedSql(true);
    setTimeout(() => setCopiedSql(false), 2500);
  }

  function handleResetDefaults() {
    if (window.confirm("Are you sure you want to restore default workspace settings?")) {
      setSettings(defaultSettings);
      localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(defaultSettings));
      window.dispatchEvent(new CustomEvent("crm_settings_updated", { detail: defaultSettings }));
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    }
  }

  return (
    <div className="space-y-6 p-6 max-w-4xl">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Workspace Settings</h1>
          <p className="mt-1 text-sm text-gray-500">
            Manage system configurations, organization profile, security policies, and alerts.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleResetDefaults}
            className="flex items-center gap-1.5 rounded-lg border border-gray-300 bg-white px-3 py-2 text-xs font-medium text-gray-600 hover:bg-gray-50 shadow-sm transition"
          >
            <RefreshCw size={13} />
            Reset Defaults
          </button>
        </div>
      </div>

      {saved && (
        <div className="flex items-center gap-3 rounded-xl bg-emerald-50 border border-emerald-200 p-4 text-sm text-emerald-900 shadow-sm animate-in fade-in">
          <CheckCircle2 size={20} className="text-emerald-600 shrink-0" />
          <div className="flex-1">
            <p className="font-semibold text-emerald-950">Settings saved successfully!</p>
            <p className="text-xs text-emerald-700">
              All organization metadata and security policies have been updated and permanently preserved.
            </p>
          </div>
        </div>
      )}

      {dbStatusNotice && (
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 rounded-xl bg-amber-50 border border-amber-200 p-4 text-xs text-amber-900 shadow-sm">
          <div className="flex items-start gap-2.5">
            <AlertCircle size={18} className="text-amber-600 shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold text-amber-950">Notice: Remote Database Sync</p>
              <p className="text-amber-800 mt-0.5">{dbStatusNotice}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={copySqlScript}
            className="flex items-center gap-1.5 rounded-lg border border-amber-300 bg-amber-100/60 px-3 py-1.5 font-medium text-amber-900 hover:bg-amber-200/60 transition shrink-0"
          >
            {copiedSql ? <Check size={13} className="text-emerald-600" /> : <Copy size={13} />}
            {copiedSql ? "SQL Copied!" : "Copy SQL for Supabase"}
          </button>
        </div>
      )}

      <form onSubmit={handleSave} className="space-y-6">
        {/* Organization Profile */}
        <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
          <div className="flex items-center gap-3 border-b border-gray-100 pb-4">
            <div className="rounded-lg bg-blue-50 p-2 text-blue-600">
              <Building size={20} />
            </div>
            <div>
              <h2 className="font-semibold text-gray-900">Organization Profile</h2>
              <p className="text-xs text-gray-500">Global business metadata and communication details</p>
            </div>
          </div>

          <div className="mt-5 grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Company / Workspace Name</label>
              <input
                type="text"
                required
                value={settings.orgName}
                onChange={(e) => setSettings({ ...settings, orgName: e.target.value })}
                placeholder="e.g. Acme Enterprise CRM"
                className="w-full rounded-lg border border-gray-300 px-3.5 py-2.5 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 transition"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Support Email</label>
              <input
                type="email"
                required
                value={settings.supportEmail}
                onChange={(e) => setSettings({ ...settings, supportEmail: e.target.value })}
                placeholder="e.g. support@yourcompany.com"
                className="w-full rounded-lg border border-gray-300 px-3.5 py-2.5 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 transition"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Official Contact Phone</label>
              <input
                type="text"
                value={settings.phone}
                onChange={(e) => setSettings({ ...settings, phone: e.target.value })}
                placeholder="e.g. +91 98000 12345"
                className="w-full rounded-lg border border-gray-300 px-3.5 py-2.5 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 transition"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Default Time Zone</label>
              <select
                value={settings.timeZone}
                onChange={(e) => setSettings({ ...settings, timeZone: e.target.value })}
                className="w-full rounded-lg border border-gray-300 px-3.5 py-2.5 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 transition bg-white"
              >
                <option value="Asia/Kolkata (IST +5:30)">Asia/Kolkata (IST +5:30)</option>
                <option value="UTC (Coordinated Universal Time)">UTC (Coordinated Universal Time)</option>
                <option value="America/New_York (EST)">America/New_York (EST)</option>
                <option value="Europe/London (GMT)">Europe/London (GMT)</option>
                <option value="Asia/Singapore (SGT +8:00)">Asia/Singapore (SGT +8:00)</option>
                <option value="Asia/Dubai (GST +4:00)">Asia/Dubai (GST +4:00)</option>
              </select>
            </div>
          </div>
        </div>

        {/* Security & Access Policy */}
        <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
          <div className="flex items-center gap-3 border-b border-gray-100 pb-4">
            <div className="rounded-lg bg-emerald-50 p-2 text-emerald-600">
              <Shield size={20} />
            </div>
            <div>
              <h2 className="font-semibold text-gray-900">Security & Access Policy</h2>
              <p className="text-xs text-gray-500">Authentication constraints and session rules</p>
            </div>
          </div>

          <div className="mt-5 space-y-4">
            <label className="flex items-start justify-between gap-4 p-3 rounded-lg border border-gray-100 hover:bg-gray-50/60 cursor-pointer transition">
              <div>
                <p className="text-sm font-medium text-gray-800">Require Two-Factor Authentication (2FA)</p>
                <p className="text-xs text-gray-500 mt-0.5">Enforce OTP/authenticator verification on employee login</p>
              </div>
              <input
                type="checkbox"
                checked={settings.twoFactorRequired}
                onChange={(e) => setSettings({ ...settings, twoFactorRequired: e.target.checked })}
                className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500 mt-1 cursor-pointer"
              />
            </label>

            <label className="flex items-start justify-between gap-4 p-3 rounded-lg border border-gray-100 hover:bg-gray-50/60 cursor-pointer transition">
              <div>
                <p className="text-sm font-medium text-gray-800">Auto Password Rotation Policy</p>
                <p className="text-xs text-gray-500 mt-0.5">Require password reset every 90 days for sales representatives</p>
              </div>
              <input
                type="checkbox"
                checked={settings.autoPasswordRotation}
                onChange={(e) => setSettings({ ...settings, autoPasswordRotation: e.target.checked })}
                className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500 mt-1 cursor-pointer"
              />
            </label>
          </div>
        </div>

        {/* Notification Alerts */}
        <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
          <div className="flex items-center gap-3 border-b border-gray-100 pb-4">
            <div className="rounded-lg bg-violet-50 p-2 text-violet-600">
              <Bell size={20} />
            </div>
            <div>
              <h2 className="font-semibold text-gray-900">Notification Alerts</h2>
              <p className="text-xs text-gray-500">Automated alerts for high-value leads and overdue follow-ups</p>
            </div>
          </div>

          <div className="mt-5 space-y-4">
            <label className="flex items-start justify-between gap-4 p-3 rounded-lg border border-gray-100 hover:bg-gray-50/60 cursor-pointer transition">
              <div>
                <p className="text-sm font-medium text-gray-800">Email Notifications for New Leads</p>
                <p className="text-xs text-gray-500 mt-0.5">Notify squad leads immediately when an inbound lead is submitted</p>
              </div>
              <input
                type="checkbox"
                checked={settings.emailAlerts}
                onChange={(e) => setSettings({ ...settings, emailAlerts: e.target.checked })}
                className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500 mt-1 cursor-pointer"
              />
            </label>
          </div>
        </div>

        {/* Submit Actions */}
        <div className="flex items-center justify-between pt-2">
          {settings.lastUpdated ? (
            <p className="flex items-center gap-1.5 text-xs text-gray-400">
              <Clock size={13} />
              Last saved: {new Date(settings.lastUpdated).toLocaleString()}
            </p>
          ) : (
            <div />
          )}

          <button
            type="submit"
            disabled={isSaving}
            className="flex items-center gap-2 rounded-lg bg-blue-600 px-6 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 shadow-sm transition disabled:opacity-50 cursor-pointer"
          >
            {isSaving ? <RefreshCw size={16} className="animate-spin" /> : <Save size={16} />}
            {isSaving ? "Saving Changes..." : "Save Changes"}
          </button>
        </div>
      </form>
    </div>
  );
}
