import {
  LayoutDashboard, Users, UserRound, Target, Phone, CalendarDays,
  Wallet, ClipboardList, BarChart3, FolderKanban, Settings,
  ChevronDown, Building2, LogOut, CalendarCheck, Banknote
} from "lucide-react";
import { NavLink } from "react-router-dom";
import { supabase } from "../../services/supabase";

const menuItems = [
  { label: "Dashboard", icon: LayoutDashboard, path: "/" },
  { label: "Employees", icon: Users, path: "/employees" },
  { label: "Teams", icon: UserRound, path: "/teams" },
  { label: "Leads", icon: Target, path: "/leads" },
  { label: "Call Activities", icon: Phone, path: "/calls" },
  { label: "Follow-ups", icon: CalendarDays, path: "/followups" },
  { label: "Finance", icon: Wallet, path: "/finance" },
  { label: "Leave Requests", icon: ClipboardList, path: "/leave-requests" },
  { label: "Reports", icon: BarChart3, path: "/reports" },
  { label: "Projects", icon: FolderKanban, path: "/projects" },
  { label: "Attendance Reports", icon: CalendarCheck, path: "/attendance-reports" },
  { label: "Salary Management", icon: Banknote, path: "/salary" },
];

export default function Sidebar() {
  return (
    <aside className="flex h-screen w-64 shrink-0 flex-col bg-[#111827] text-white">
      <div className="flex h-16 items-center gap-3 border-b border-white/10 px-6 shrink-0">
        <div className="rounded-lg bg-blue-600 p-2"><Building2 size={20} /></div>
        <span className="text-xl font-bold">CRM</span>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-4">
        <p className="mb-2 px-3 text-xs font-semibold uppercase tracking-wider text-gray-500">
          Workspace
        </p>
        <nav className="space-y-1">
          {menuItems.map((item) => {
            const Icon = item.icon;
            return (
              <NavLink
                key={item.path}
                to={item.path}
                className={({ isActive }) =>
                  `flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition ${
                    isActive
                      ? "bg-blue-600 text-white"
                      : "text-gray-400 hover:bg-white/10 hover:text-white"
                  }`
                }
              >
                <Icon size={18} />
                <span>{item.label}</span>
                {item.label === "Employees" && <ChevronDown className="ml-auto" size={15} />}
              </NavLink>
            );
          })}
        </nav>
      </div>

      <div className="mt-auto border-t border-white/10 p-4">
        <NavLink
          to="/settings"
          className={({ isActive }) =>
            `flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition ${
              isActive
                ? "bg-blue-600 text-white"
                : "text-gray-400 hover:bg-white/10 hover:text-white"
            }`
          }
        >
          <Settings size={18} /> Settings
        </NavLink>
        <button
          onClick={async () => {
            await supabase.auth.signOut();
          }}
          className="mt-1 flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm text-rose-400 hover:bg-rose-500/10 hover:text-rose-300 transition"
        >
          <LogOut size={18} /> Sign Out
        </button>
        <div className="mt-3 flex items-center gap-3 border-t border-white/5 pt-3 px-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-blue-600 font-semibold">A</div>
          <div>
            <p className="text-sm font-medium">Administrator</p>
            <p className="text-xs text-gray-400">Admin Account</p>
          </div>
        </div>
      </div>
    </aside>
  );
}
