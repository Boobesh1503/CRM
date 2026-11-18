import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { LockKeyhole, Mail, Eye, EyeOff, Building2 } from "lucide-react";
import { supabase } from "../../services/supabase";

export default function Login() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleLogin(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError("");

    const { data, error: loginError } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password
    });

    if (loginError || !data.user) {
      setError(loginError?.message || "Login failed.");
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
    <div className="flex min-h-screen items-center justify-center bg-slate-100 p-4">
      <div className="w-full max-w-md rounded-2xl border border-gray-200 bg-white p-8 shadow-xl">
        <div className="mb-7 text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-xl bg-blue-600 text-white">
            <Building2 size={28} />
          </div>
          <h1 className="text-2xl font-bold text-gray-900">CRM Enterprise</h1>
          <p className="mt-2 text-sm text-gray-500">Sign in to Admin Panel or Employee Portal</p>
        </div>

        <form onSubmit={handleLogin} className="space-y-5">
          <div>
            <label className="mb-2 block text-sm font-medium text-gray-700">Email Address</label>
            <div className="flex items-center gap-3 rounded-lg border border-gray-300 px-3 focus-within:border-blue-500">
              <Mail size={18} className="text-gray-400" />
              <input
                required
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="admin@example.com"
                className="w-full py-3 text-sm outline-none"
              />
            </div>
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium text-gray-700">Password</label>
            <div className="flex items-center gap-3 rounded-lg border border-gray-300 px-3 focus-within:border-blue-500">
              <LockKeyhole size={18} className="text-gray-400" />
              <input
                required
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter your password"
                className="w-full py-3 text-sm outline-none"
              />
              <button type="button" onClick={() => setShowPassword(!showPassword)}>
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </div>

          {error && <p className="rounded-lg bg-red-50 p-3 text-sm text-red-600">{error}</p>}

          <button
            disabled={loading}
            type="submit"
            className="w-full rounded-lg bg-blue-600 py-3 font-semibold text-white hover:bg-blue-700 disabled:opacity-60"
          >
            {loading ? "Signing in..." : "Sign In"}
          </button>
        </form>

        <p className="mt-6 text-center text-xs text-gray-400">
          Secure CRM Administrator Access
        </p>
      </div>
    </div>
  );
}
