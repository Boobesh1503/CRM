import { useState, useEffect } from "react";
import { NavLink, Outlet, useNavigate, useLocation } from "react-router-dom";
import {
  LayoutDashboard,
  Target,
  CalendarDays,
  Clock,
  ClipboardList,
  User,
  LogOut,
  Building2,
  Search,
  Bell,
  ChevronDown,
  Menu,
  X
} from "lucide-react";
import { supabase } from "../../services/supabase";

export interface EmployeeInfo {
  id: string;
  employee_code: string;
  full_name: string;
  email: string;
  phone: string | null;
  role: string;
  department: string | null;
  employment_status: string;
}

const employeeMenuItems = [
  { label: "Dashboard", icon: LayoutDashboard, path: "/portal" },
  { label: "Assigned Leads", icon: Target, path: "/portal/leads" },
  { label: "Follow-ups", icon: CalendarDays, path: "/portal/followups" },
  { label: "Attendance", icon: Clock, path: "/portal/attendance" },
  { label: "Leave Requests", icon: ClipboardList, path: "/portal/leave" },
  { label: "My Profile", icon: User, path: "/portal/profile" },
];

const pageTitles: Record<string, string> = {
  "/portal": "Employee Dashboard",
  "/portal/leads": "My Assigned Leads",
  "/portal/followups": "Follow-up Schedule",
  "/portal/attendance": "Attendance & Shift",
  "/portal/leave": "Leave Applications",
  "/portal/profile": "My Profile",
};

export default function EmployeeLayout() {
  const navigate = useNavigate();
  const location = useLocation();
  const [profile, setProfile] = useState<EmployeeInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [notifications, setNotifications] = useState<any[]>([]);
  const [showNotifications, setShowNotifications] = useState(false);

  async function loadEmployeeNotifications(userId: string) {
    try {
      const { data } = await supabase
        .from("notifications")
        .select("*")
        .or(`recipient_id.eq.${userId},recipient_role.eq.employee,recipient_role.eq.all`)
        .order("created_at", { ascending: false })
        .limit(10);
      if (data) setNotifications(data);
    } catch (e) {
      console.warn("Could not load employee notifications", e);
    }
  }

  useEffect(() => {
    async function loadEmployee() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      loadEmployeeNotifications(user.id);

      // Realtime listener for new assigned leads or notifications
      const channel = supabase
        .channel(`emp-notif-${user.id}`)
        .on(
          "postgres_changes",
          {
            event: "INSERT",
            schema: "public",
            table: "notifications",
          },
          (payload) => {
            const item = payload.new;
            if (
              item.recipient_id === user.id ||
              item.recipient_role === "employee" ||
              item.recipient_role === "all"
            ) {
              setNotifications((prev) => [item, ...prev.slice(0, 9)]);
            }
          }
        )
        .subscribe();

      const { data } = await supabase
        .from("employees")
        .select("*")
        .eq("auth_user_id", user.id)
        .maybeSingle();

      if (data) {
        if (data.employment_status !== "active") {
          await supabase.auth.signOut();
          navigate("/login", { replace: true });
          return;
        }
        setProfile(data as EmployeeInfo);
      } else {
        // Fallback for user without explicit employee row
        setProfile({
          id: user.id,
          employee_code: "EMP-PORTAL",
          full_name: user.user_metadata?.full_name || user.email?.split("@")[0] || "Employee",
          email: user.email || "",
          phone: null,
          role: "sales_executive",
          department: "Sales",
          employment_status: "active",
        });
      }
      setLoading(false);

      return () => {
        supabase.removeChannel(channel);
      };
    }

    loadEmployee();
  }, []);

  async function handleLogout() {
    await supabase.auth.signOut();
    navigate("/login", { replace: true });
  }

  const [isMobileOpen, setIsMobileOpen] = useState(false);

  const currentTitle = pageTitles[location.pathname] ?? "Employee Portal";

  return (
    <div className="flex h-screen overflow-hidden bg-gray-50">
      {/* Mobile Backdrop Overlay */}
      {isMobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/60 backdrop-blur-xs md:hidden animate-in fade-in duration-200"
          onClick={() => setIsMobileOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* Employee Sidebar - Matches Admin Panel's exact theme & colors */}
      <aside
        className={`
          fixed inset-y-0 left-0 z-50 flex h-screen w-72 max-w-[82vw] flex-col bg-[#111827] text-white shadow-2xl transition-transform duration-300 ease-in-out
          md:static md:z-auto md:w-64 md:shrink-0 md:shadow-none md:translate-x-0
          ${isMobileOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0"}
        `}
      >
        <div className="flex h-16 items-center justify-between border-b border-white/10 px-5 shrink-0">
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-blue-600 p-2">
              <Building2 size={20} />
            </div>
            <div>
              <span className="text-xl font-bold">CRM</span>
              <span className="ml-2 rounded bg-blue-600/30 px-1.5 py-0.5 text-[10px] font-semibold text-blue-400">
                PORTAL
              </span>
            </div>
          </div>
          {/* Mobile Close Button */}
          <button
            type="button"
            onClick={() => setIsMobileOpen(false)}
            className="p-1.5 rounded-lg text-gray-400 hover:text-white hover:bg-white/10 md:hidden transition cursor-pointer"
            title="Close sidebar"
          >
            <X size={20} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-4 py-4">
          <p className="mb-2 px-3 text-xs font-semibold uppercase tracking-wider text-gray-500">
            Workspace
          </p>
          <nav className="space-y-1">
            {employeeMenuItems.map((item) => {
              const Icon = item.icon;
              return (
                <NavLink
                  key={item.path}
                  to={item.path}
                  end={item.path === "/portal"}
                  onClick={() => setIsMobileOpen(false)}
                  className={({ isActive }) =>
                    `flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition ${
                      isActive
                        ? "bg-blue-600 text-white font-medium"
                        : "text-gray-400 hover:bg-white/10 hover:text-white"
                    }`
                  }
                >
                  <Icon size={18} />
                  <span>{item.label}</span>
                </NavLink>
              );
            })}
          </nav>
        </div>

        {/* Profile Card & Logout Footer - Exact match to Admin Sidebar */}
        <div className="mt-auto border-t border-white/10 p-4">
          <button
            onClick={async () => {
              setIsMobileOpen(false);
              await handleLogout();
            }}
            className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm text-rose-400 hover:bg-rose-500/10 hover:text-rose-300 transition cursor-pointer"
          >
            <LogOut size={18} /> Sign Out
          </button>
          <div className="mt-3 flex items-center gap-3 border-t border-white/5 pt-3 px-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-blue-600 font-semibold text-white shrink-0">
              {profile?.full_name ? profile.full_name.charAt(0).toUpperCase() : "E"}
            </div>
            <div className="min-w-0 flex-1 overflow-hidden">
              <p className="truncate text-sm font-medium text-white">
                {profile?.full_name || "Employee"}
              </p>
              <p className="truncate text-xs text-gray-400 font-mono">
                {profile?.employee_code || "EMP-..."}
              </p>
            </div>
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        {/* Topbar - Exact match to Admin Topbar */}
        <header className="flex h-16 items-center justify-between border-b border-gray-200 bg-white px-4 sm:px-6 shrink-0">
          <div className="flex items-center gap-3 sm:gap-4 min-w-0">
            <button
              type="button"
              onClick={() => setIsMobileOpen((prev) => !prev)}
              className="p-1.5 -ml-1 text-gray-600 hover:text-gray-900 rounded-lg hover:bg-gray-100 transition md:hidden shrink-0 cursor-pointer"
              title="Open navigation menu"
            >
              <Menu size={22} />
            </button>
            <div className="min-w-0">
              <h2 className="text-base sm:text-lg font-semibold text-gray-800 truncate">{currentTitle}</h2>
              <p className="text-xs text-gray-500 hidden sm:block truncate">
                Welcome back, {profile?.full_name || "Employee"}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-5">
            <div className="flex items-center gap-2 rounded-lg border border-gray-200 bg-gray-50 px-3 py-2">
              <Search size={17} className="text-gray-400" />
              <input
                type="text"
                placeholder="Search anything..."
                className="w-44 bg-transparent text-sm outline-none"
              />
              <span className="text-xs text-gray-400">⌘ K</span>
            </div>

            <div className="relative">
              <button
                type="button"
                onClick={() => setShowNotifications(!showNotifications)}
                className="relative rounded-lg p-2 text-gray-500 hover:bg-gray-100 hover:text-gray-900 transition"
                title="Notifications"
              >
                <Bell size={20} />
                {notifications.filter((n) => !n.is_read).length > 0 && (
                  <span className="absolute right-1 top-1 flex h-4 w-4 items-center justify-center rounded-full bg-blue-600 text-[10px] font-bold text-white">
                    {notifications.filter((n) => !n.is_read).length}
                  </span>
                )}
              </button>

              {showNotifications && (
                <div className="absolute right-0 mt-2 w-80 rounded-2xl border border-gray-200 bg-white shadow-xl z-50 overflow-hidden">
                  <div className="border-b border-gray-100 px-4 py-3 bg-gray-50/50 flex items-center justify-between">
                    <span className="font-semibold text-sm text-gray-900">Assigned Updates & Alerts</span>
                    <span className="text-xs text-gray-500 font-medium">Realtime</span>
                  </div>
                  <div className="max-h-72 overflow-y-auto divide-y divide-gray-100 text-xs">
                    {notifications.length === 0 ? (
                      <div className="py-6 text-center text-gray-400">
                        No notifications yet. When leads are assigned, alerts appear here.
                      </div>
                    ) : (
                      notifications.map((item) => (
                        <div
                          key={item.id}
                          className="p-3 hover:bg-gray-50 transition cursor-pointer"
                          onClick={() => {
                            setShowNotifications(false);
                            if (item.link) navigate(item.link);
                          }}
                        >
                          <p className="font-semibold text-gray-900">{item.title}</p>
                          <p className="mt-0.5 text-gray-600 line-clamp-2">{item.message}</p>
                          <span className="mt-1 block text-[10px] text-gray-400">
                            {new Date(item.created_at).toLocaleTimeString([], {
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                          </span>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>

            <div className="flex cursor-pointer items-center gap-2">
              <div className="flex h-9 w-9 items-center justify-center rounded-full bg-blue-100 font-semibold text-blue-700">
                {profile?.full_name ? profile.full_name.charAt(0).toUpperCase() : "E"}
              </div>
              <div className="hidden sm:block">
                <p className="text-sm font-semibold text-gray-800">
                  {profile?.full_name || "Employee"}
                </p>
                <p className="text-xs text-gray-500 font-mono">
                  {profile?.employee_code || "EMP-PORTAL"}
                </p>
              </div>
              <ChevronDown size={16} className="text-gray-500" />
            </div>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto">
          <Outlet context={{ profile, loadingProfile: loading }} />
        </main>
      </div>
    </div>
  );
}
