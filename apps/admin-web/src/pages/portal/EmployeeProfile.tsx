import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  User,
  KeyRound,
  Mail,
  Phone,
  Building,
  Calendar,
  LogOut,
  CheckCircle2,
  Eye,
  EyeOff
} from "lucide-react";
import { supabase } from "../../services/supabase";

interface EmployeeProfileData {
  id: string;
  employee_code: string;
  full_name: string;
  email: string;
  phone: string | null;
  role: string;
  department: string | null;
  employment_status: string;
  joined_on: string | null;
}

const roleLabels: Record<string, string> = {
  intern: "Intern",
  sales_executive: "Sales Executive",
  team_leader: "Team Leader",
  admin: "Administrator",
};

export default function EmployeeProfile() {
  const navigate = useNavigate();
  const [profile, setProfile] = useState<EmployeeProfileData | null>(null);
  const [loading, setLoading] = useState(true);

  // Password Change State
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [passLoading, setPassLoading] = useState(false);
  const [passError, setPassError] = useState("");
  const [passSuccess, setPassSuccess] = useState("");

  useEffect(() => {
    async function fetchProfile() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data } = await supabase
        .from("employees")
        .select("*")
        .eq("auth_user_id", user.id)
        .maybeSingle();

      if (data) {
        setProfile(data as EmployeeProfileData);
      } else {
        setProfile({
          id: user.id,
          employee_code: "EMP-PORTAL",
          full_name: user.user_metadata?.full_name || user.email?.split("@")[0] || "Employee",
          email: user.email || "",
          phone: null,
          role: "sales_executive",
          department: "Sales",
          employment_status: "active",
          joined_on: null,
        });
      }
      setLoading(false);
    }

    fetchProfile();
  }, []);

  async function handlePasswordChange(e: React.FormEvent) {
    e.preventDefault();
    setPassError("");
    setPassSuccess("");

    if (newPassword !== confirmPassword) {
      setPassError("New password and confirm password do not match.");
      return;
    }

    const strongPassword =
      /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).{8,}$/;
    if (!strongPassword.test(newPassword)) {
      setPassError(
        "Password must contain at least 8 characters, uppercase, lowercase, number, and special character."
      );
      return;
    }

    setPassLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({
        password: newPassword,
      });

      if (error) {
        throw new Error(error.message);
      }

      setPassSuccess("Password updated successfully. Please use this password on your next login.");
      setNewPassword("");
      setConfirmPassword("");
    } catch (err) {
      setPassError(err instanceof Error ? err.message : "Failed to update password.");
    } finally {
      setPassLoading(false);
    }
  }

  async function handleSignOut() {
    await supabase.auth.signOut();
    navigate("/login", { replace: true });
  }

  if (loading) {
    return <div className="p-8 text-center text-sm text-gray-500">Loading profile details...</div>;
  }

  return (
    <div className="space-y-6 p-6 max-w-4xl">
      {/* Page Heading - Matches Admin Panel */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">My Profile</h1>
        <p className="mt-1 text-sm text-gray-500">
          Personal identification, assigned designation, and credential management.
        </p>
      </div>

      {/* Main Profile Header Card - Admin Styling */}
      <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-6">
          <div className="flex items-center gap-5">
            <div className="flex h-16 w-16 items-center justify-center rounded-xl bg-blue-600 font-bold text-2xl text-white shadow-sm">
              {profile?.full_name ? profile.full_name.charAt(0).toUpperCase() : "E"}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-xl font-bold text-gray-900">{profile?.full_name}</h2>
                <span className="rounded-full bg-green-50 border border-green-200 px-2.5 py-0.5 text-xs font-semibold text-green-700">
                  {profile?.employment_status}
                </span>
              </div>
              <p className="text-sm font-medium text-blue-600 mt-0.5">
                {roleLabels[profile?.role || "sales_executive"] || profile?.role}
              </p>
              <p className="text-xs text-gray-400 mt-1 font-mono">
                Employee Code: <span className="font-semibold text-gray-700">{profile?.employee_code}</span>
              </p>
            </div>
          </div>

          <button
            onClick={handleSignOut}
            className="flex items-center gap-2 rounded-lg border border-gray-300 px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 shadow-sm transition"
          >
            <LogOut size={16} /> Sign Out
          </button>
        </div>
      </div>

      {/* Profile Details Grid */}
      <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
        <h3 className="font-semibold text-gray-900 border-b border-gray-100 pb-3">
          Personal & Professional Information
        </h3>

        <div className="mt-5 grid grid-cols-1 md:grid-cols-2 gap-6 text-sm">
          <div>
            <span className="text-xs text-gray-400 flex items-center gap-1.5 mb-1">
              <Mail size={14} /> Official Email
            </span>
            <p className="font-semibold text-gray-800">{profile?.email || "-"}</p>
          </div>

          <div>
            <span className="text-xs text-gray-400 flex items-center gap-1.5 mb-1">
              <Phone size={14} /> Phone Number
            </span>
            <p className="font-semibold text-gray-800">{profile?.phone || "Not set"}</p>
          </div>

          <div>
            <span className="text-xs text-gray-400 flex items-center gap-1.5 mb-1">
              <Building size={14} /> Department
            </span>
            <p className="font-semibold text-gray-800">{profile?.department || "Sales"}</p>
          </div>

          <div>
            <span className="text-xs text-gray-400 flex items-center gap-1.5 mb-1">
              <Calendar size={14} /> Joining Date
            </span>
            <p className="font-semibold text-gray-800">{profile?.joined_on || "Recorded on profile"}</p>
          </div>
        </div>
      </div>

      {/* Password Change Card */}
      <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
        <div className="flex items-center gap-3 border-b border-gray-100 pb-4">
          <KeyRound size={20} className="text-blue-600" />
          <div>
            <h3 className="font-semibold text-gray-900">Change Password</h3>
            <p className="text-xs text-gray-500">Update your login password securely</p>
          </div>
        </div>

        {passSuccess && (
          <div className="mt-4 flex items-center gap-2 rounded-lg bg-green-50 border border-green-200 p-3 text-sm text-green-700">
            <CheckCircle2 size={16} />
            {passSuccess}
          </div>
        )}

        {passError && (
          <div className="mt-4 rounded-lg bg-red-50 border border-red-200 p-3 text-sm text-red-700">
            {passError}
          </div>
        )}

        <form onSubmit={handlePasswordChange} className="mt-5 space-y-4 max-w-md">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">New Password</label>
            <div className="flex items-center rounded-lg border border-gray-300 pr-3 focus-within:border-blue-500">
              <input
                required
                type={showPassword ? "text" : "password"}
                minLength={8}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Enter new password"
                className="w-full rounded-lg px-3 py-2 text-sm outline-none"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="text-gray-400 hover:text-gray-600"
              >
                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
            <p className="mt-1 text-xs text-gray-400">
              Minimum 8 characters, uppercase, lowercase, number, and special character.
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Confirm New Password</label>
            <input
              required
              type={showPassword ? "text" : "password"}
              minLength={8}
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Confirm new password"
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-blue-500"
            />
          </div>

          <button
            type="submit"
            disabled={passLoading}
            className="rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-blue-700 shadow-sm transition disabled:opacity-50"
          >
            {passLoading ? "Updating Password..." : "Update Password"}
          </button>
        </form>
      </div>
    </div>
  );
}
