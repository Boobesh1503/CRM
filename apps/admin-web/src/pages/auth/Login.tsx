import { useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  LockKeyhole,
  Mail,
  Eye,
  EyeOff,
  Building2,
  ShieldCheck,
  UserCheck,
  Sparkles,
  Copy,
  Check
} from "lucide-react";
import { supabase } from "../../services/supabase";

const DEMO_ACCOUNTS = {
  admin: {
    role: "Admin Account",
    email: "admin@akodefy.com",
    password: "Admin@1234",
    desc: "Full access to all 12 modules, finances & settings",
  },
  employee: {
    role: "Employee Account",
    email: "dinesh@gmail.com",
    password: "Dinesh@123",
    desc: "Access to employee portal, assigned leads & calls",
  },
};

export default function Login() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [activeFilled, setActiveFilled] = useState<"admin" | "employee" | null>(null);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  function handleAutoFill(type: "admin" | "employee") {
    const creds = DEMO_ACCOUNTS[type];
    setEmail(creds.email);
    setPassword(creds.password);
    setError("");
    setActiveFilled(type);
    setTimeout(() => setActiveFilled(null), 2500);
  }

  function handleCopy(text: string, key: string) {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
  }

  async function handleLogin(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError("");

    const { data, error: loginError } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password
    });

    if (loginError || !data.user) {
      setError(loginError?.message || "Login failed. Please verify credentials.");
      setLoading(false);
      return;
    }

    const { data: roleData, error: roleError } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", data.user.id)
      .maybeSingle();

    if (roleError || !roleData) {
      await supabase.auth.signOut();
      setError("Account access role not found. Please contact an administrator.");
      setLoading(false);
      return;
    }

    if (roleData.role === "admin") {
      navigate("/", { replace: true });
    } else {
      // Check if employee account is active
      const { data: employeeData } = await supabase
        .from("employees")
        .select("employment_status")
        .eq("auth_user_id", data.user.id)
        .maybeSingle();

      if (employeeData && employeeData.employment_status !== "active") {
        await supabase.auth.signOut();
        setError(
          `Your employee account is ${employeeData.employment_status}. Login access has been disabled by your administrator.`
        );
        setLoading(false);
        return;
      }

      navigate("/portal", { replace: true });
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-100 p-4 py-8">
      <div className="w-full max-w-lg rounded-2xl border border-gray-200 bg-white p-7 sm:p-9 shadow-xl">
        {/* Brand Header */}
        <div className="mb-6 text-center">
          <div className="mx-auto mb-3.5 flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-tr from-blue-700 to-blue-500 text-white shadow-md shadow-blue-500/20">
            <Building2 size={28} />
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-gray-900">CRM Enterprise</h1>
          <p className="mt-1 text-sm text-gray-500">Sign in to Admin Panel or Employee Portal</p>
        </div>

        {/* Quick Demo Credentials Box for HR / Recruiters */}
        <div className="mb-6 rounded-xl border border-blue-100 bg-gradient-to-b from-blue-50/70 to-blue-50/30 p-4">
          <div className="flex items-center gap-2 mb-3">
            <Sparkles size={16} className="text-blue-600 shrink-0" />
            <h2 className="text-xs font-bold uppercase tracking-wider text-blue-900">
              Demo Credentials for HR / Reviewers
            </h2>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            {/* Admin Demo Card */}
            <div className="flex flex-col justify-between rounded-lg border border-blue-200/80 bg-white p-3 shadow-xs">
              <div>
                <div className="flex items-center justify-between mb-1">
                  <span className="inline-flex items-center gap-1 text-xs font-semibold text-blue-700">
                    <ShieldCheck size={13} /> Admin Role
                  </span>
                  <button
                    type="button"
                    onClick={() => handleCopy("admin@akodefy.com\nAdmin@1234", "admin")}
                    className="text-[11px] text-gray-400 hover:text-gray-700"
                    title="Copy Credentials"
                  >
                    {copiedKey === "admin" ? <Check size={12} className="text-emerald-600" /> : <Copy size={12} />}
                  </button>
                </div>
                <p className="font-mono text-xs text-gray-800 font-medium">admin@akodefy.com</p>
                <p className="font-mono text-[11px] text-gray-500">PW: Admin@1234</p>
              </div>

              <button
                type="button"
                onClick={() => handleAutoFill("admin")}
                className={`mt-2.5 flex items-center justify-center gap-1.5 w-full rounded-md py-1.5 px-2 text-xs font-semibold transition cursor-pointer ${
                  activeFilled === "admin"
                    ? "bg-emerald-600 text-white"
                    : "bg-blue-600 hover:bg-blue-700 text-white"
                }`}
              >
                {activeFilled === "admin" ? <Check size={13} /> : <Sparkles size={13} />}
                {activeFilled === "admin" ? "Admin Filled!" : "Auto-Fill Admin"}
              </button>
            </div>

            {/* Employee Demo Card */}
            <div className="flex flex-col justify-between rounded-lg border border-indigo-200/80 bg-white p-3 shadow-xs">
              <div>
                <div className="flex items-center justify-between mb-1">
                  <span className="inline-flex items-center gap-1 text-xs font-semibold text-indigo-700">
                    <UserCheck size={13} /> Employee Role
                  </span>
                  <button
                    type="button"
                    onClick={() => handleCopy("dinesh@gmail.com\nDinesh@123", "employee")}
                    className="text-[11px] text-gray-400 hover:text-gray-700"
                    title="Copy Credentials"
                  >
                    {copiedKey === "employee" ? <Check size={12} className="text-emerald-600" /> : <Copy size={12} />}
                  </button>
                </div>
                <p className="font-mono text-xs text-gray-800 font-medium">dinesh@gmail.com</p>
                <p className="font-mono text-[11px] text-gray-500">PW: Dinesh@123</p>
              </div>

              <button
                type="button"
                onClick={() => handleAutoFill("employee")}
                className={`mt-2.5 flex items-center justify-center gap-1.5 w-full rounded-md py-1.5 px-2 text-xs font-semibold transition cursor-pointer ${
                  activeFilled === "employee"
                    ? "bg-emerald-600 text-white"
                    : "bg-indigo-600 hover:bg-indigo-700 text-white"
                }`}
              >
                {activeFilled === "employee" ? <Check size={13} /> : <Sparkles size={13} />}
                {activeFilled === "employee" ? "Employee Filled!" : "Auto-Fill Employee"}
              </button>
            </div>
          </div>
        </div>

        {/* Login Form */}
        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-gray-700">
              Email Address
            </label>
            <div className="flex items-center gap-3 rounded-lg border border-gray-300 px-3.5 focus-within:border-blue-500 focus-within:ring-2 focus-within:ring-blue-100 transition bg-white">
              <Mail size={18} className="text-gray-400 shrink-0" />
              <input
                required
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="e.g. admin@akodefy.com"
                className="w-full py-2.5 text-sm outline-none bg-transparent"
              />
            </div>
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-gray-700">
              Password
            </label>
            <div className="flex items-center gap-3 rounded-lg border border-gray-300 px-3.5 focus-within:border-blue-500 focus-within:ring-2 focus-within:ring-blue-100 transition bg-white">
              <LockKeyhole size={18} className="text-gray-400 shrink-0" />
              <input
                required
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter password"
                className="w-full py-2.5 text-sm outline-none bg-transparent"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="text-gray-400 hover:text-gray-600 cursor-pointer"
              >
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </div>

          {error && (
            <div className="rounded-lg bg-rose-50 border border-rose-200 p-3 text-xs text-rose-700">
              {error}
            </div>
          )}

          <button
            disabled={loading}
            type="submit"
            className="w-full rounded-lg bg-blue-600 py-3 font-semibold text-white hover:bg-blue-700 active:scale-[0.99] transition shadow-md shadow-blue-500/10 disabled:opacity-60 cursor-pointer mt-1"
          >
            {loading ? "Signing in..." : "Sign In to Workspace"}
          </button>
        </form>

        <p className="mt-5 text-center text-xs text-gray-400">
          Enterprise Security • Role-Based Access Control
        </p>
      </div>
    </div>
  );
}
