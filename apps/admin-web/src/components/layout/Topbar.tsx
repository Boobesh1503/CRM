import { useState, useEffect, useRef } from "react";
import {
  Search,
  Bell,
  ChevronDown,
  Menu,
  MoreVertical,
  UserPlus,
  PlusCircle,
  Settings,
  LogOut,
  CheckCircle2,
  PhoneCall,
  Clock,
  Calendar,
  AlertCircle,
  ExternalLink
} from "lucide-react";
import { useLocation, useNavigate, Link } from "react-router-dom";
import { supabase } from "../../services/supabase";
import {
  getAdminNotifications,
  markNotificationAsRead,
  markAllNotificationsAsRead,
  type NotificationItem
} from "../../services/notifications";

const pageTitles: Record<string, string> = {
  "/": "Dashboard",
  "/employees": "Employees",
  "/teams": "Teams & Pods",
  "/leads": "Leads & Pipeline",
  "/calls": "Call Activities",
  "/followups": "Follow-up Schedule",
  "/finance": "Finance & Billing",
  "/leave-requests": "Leave Requests",
  "/reports": "Analytics & Reports",
  "/projects": "Client Projects",
  "/settings": "Workspace Settings",
  "/attendance-reports": "Attendance Reports",
  "/salaries": "Salary Management",
};

export default function Topbar() {
  const location = useLocation();
  const navigate = useNavigate();
  const title = pageTitles[location.pathname] ?? "Dashboard";

  // Three-dot menu state
  const [showThreeDotMenu, setShowThreeDotMenu] = useState(false);
  const threeDotRef = useRef<HTMLDivElement>(null);

  // Notification state
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [showNotifications, setShowNotifications] = useState(false);
  const notifRef = useRef<HTMLDivElement>(null);

  // Profile menu state
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const profileRef = useRef<HTMLDivElement>(null);

  async function loadNotifications() {
    const list = await getAdminNotifications(15);
    setNotifications(list);
  }

  useEffect(() => {
    loadNotifications();

    // Real-time notifications listener
    const channel = supabase
      .channel("admin-notifications-realtime")
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "notifications",
        },
        (payload) => {
          const newNotif = payload.new as NotificationItem;
          if (newNotif.recipient_role === "admin" || newNotif.recipient_role === "all") {
            setNotifications((prev) => [newNotif, ...prev.slice(0, 19)]);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  // Close dropdowns on outside click
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (threeDotRef.current && !threeDotRef.current.contains(event.target as Node)) {
        setShowThreeDotMenu(false);
      }
      if (notifRef.current && !notifRef.current.contains(event.target as Node)) {
        setShowNotifications(false);
      }
      if (profileRef.current && !profileRef.current.contains(event.target as Node)) {
        setShowProfileMenu(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  async function handleLogout() {
    await supabase.auth.signOut();
    navigate("/login", { replace: true });
  }

  const unreadCount = notifications.filter((n) => !n.is_read).length;

  return (
    <header className="relative flex h-16 items-center justify-between border-b border-gray-200 bg-white px-6">
      <div className="flex items-center gap-4">
        <button className="text-gray-500 hover:text-gray-900" title="Menu toggle">
          <Menu size={21} />
        </button>
        <div>
          <h2 className="text-lg font-semibold text-gray-800">{title}</h2>
          <div className="flex items-center gap-2">
            <p className="text-xs text-gray-500">Welcome back, Administrator</p>
            
            {/* Functional Three-Dot Menu next to Welcome Back */}
            <div className="relative" ref={threeDotRef}>
              <button
                type="button"
                onClick={() => setShowThreeDotMenu(!showThreeDotMenu)}
                className="flex h-5 w-5 items-center justify-center rounded-md text-gray-400 hover:bg-gray-100 hover:text-gray-700 transition"
                title="Quick workspace actions"
              >
                <MoreVertical size={14} />
              </button>

              {showThreeDotMenu && (
                <div className="absolute left-0 mt-2 w-56 rounded-xl border border-gray-200 bg-white p-1.5 shadow-lg z-50 animate-in fade-in slide-in-from-top-1">
                  <div className="px-3 py-2 border-b border-gray-100">
                    <p className="text-xs font-semibold text-gray-700">Quick Actions</p>
                  </div>

                  <button
                    onClick={() => {
                      setShowThreeDotMenu(false);
                      navigate("/leads");
                    }}
                    className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-xs font-medium text-gray-700 hover:bg-gray-50 hover:text-blue-600 transition"
                  >
                    <PlusCircle size={15} className="text-blue-600" />
                    <span>Add New Lead</span>
                  </button>

                  <button
                    onClick={() => {
                      setShowThreeDotMenu(false);
                      navigate("/employees");
                    }}
                    className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-xs font-medium text-gray-700 hover:bg-gray-50 hover:text-blue-600 transition"
                  >
                    <UserPlus size={15} className="text-emerald-600" />
                    <span>Add Employee / Intern</span>
                  </button>

                  <button
                    onClick={() => {
                      setShowThreeDotMenu(false);
                      navigate("/settings");
                    }}
                    className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-xs font-medium text-gray-700 hover:bg-gray-50 hover:text-blue-600 transition"
                  >
                    <Settings size={15} className="text-gray-500" />
                    <span>Workspace Settings</span>
                  </button>

                  <div className="my-1 border-t border-gray-100" />

                  <button
                    onClick={() => {
                      setShowThreeDotMenu(false);
                      handleLogout();
                    }}
                    className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-xs font-medium text-rose-600 hover:bg-rose-50 transition"
                  >
                    <LogOut size={15} />
                    <span>Sign Out</span>
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="flex items-center gap-4">
        <div className="hidden sm:flex items-center gap-2 rounded-lg border border-gray-200 bg-gray-50 px-3 py-2">
          <Search size={17} className="text-gray-400" />
          <input
            type="text"
            placeholder="Search CRM..."
            className="w-40 bg-transparent text-sm outline-none"
          />
        </div>

        {/* Functional Notification Bell with dropdown */}
        <div className="relative" ref={notifRef}>
          <button
            type="button"
            onClick={() => setShowNotifications(!showNotifications)}
            className="relative rounded-lg p-2 text-gray-500 hover:bg-gray-100 hover:text-gray-900 transition"
            title="Notifications"
          >
            <Bell size={20} />
            {unreadCount > 0 && (
              <span className="absolute right-1 top-1 flex h-4 w-4 items-center justify-center rounded-full bg-rose-500 text-[10px] font-bold text-white">
                {unreadCount > 9 ? "9+" : unreadCount}
              </span>
            )}
          </button>

          {showNotifications && (
            <div className="absolute right-0 mt-2 w-80 sm:w-96 rounded-2xl border border-gray-200 bg-white shadow-xl z-50 overflow-hidden">
              <div className="flex items-center justify-between border-b border-gray-100 px-4 py-3 bg-gray-50/50">
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-sm text-gray-900">Notifications</span>
                  {unreadCount > 0 && (
                    <span className="rounded-full bg-blue-100 px-2 py-0.5 text-xs font-semibold text-blue-700">
                      {unreadCount} new
                    </span>
                  )}
                </div>
                {unreadCount > 0 && (
                  <button
                    onClick={async () => {
                      await markAllNotificationsAsRead();
                      setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
                    }}
                    className="text-xs font-medium text-blue-600 hover:text-blue-800"
                  >
                    Mark all read
                  </button>
                )}
              </div>

              <div className="max-h-80 overflow-y-auto divide-y divide-gray-100">
                {notifications.length === 0 ? (
                  <div className="py-8 text-center text-xs text-gray-400">
                    No notifications yet. You will receive real-time alerts when employees update leads, log calls, or punch in.
                  </div>
                ) : (
                  notifications.map((item) => (
                    <div
                      key={item.id}
                      onClick={async () => {
                        if (!item.is_read) {
                          await markNotificationAsRead(item.id);
                          setNotifications((prev) =>
                            prev.map((n) => (n.id === item.id ? { ...n, is_read: true } : n))
                          );
                        }
                        if (item.link) {
                          setShowNotifications(false);
                          navigate(item.link);
                        }
                      }}
                      className={`flex items-start gap-3 p-3.5 text-left text-xs transition cursor-pointer hover:bg-gray-50 ${
                        !item.is_read ? "bg-blue-50/40" : ""
                      }`}
                    >
                      <div className="mt-0.5 shrink-0 rounded-lg p-1.5 bg-blue-100 text-blue-600">
                        {item.type === "lead_assigned" && <CheckCircle2 size={14} />}
                        {item.type === "call" && <PhoneCall size={14} />}
                        {item.type === "attendance" && <Clock size={14} />}
                        {item.type === "leave" && <Calendar size={14} />}
                        {item.type === "status_update" && <AlertCircle size={14} />}
                        {item.type === "info" && <Bell size={14} />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-gray-900 truncate">{item.title}</p>
                        <p className="mt-0.5 text-gray-600 line-clamp-2">{item.message}</p>
                        <span className="mt-1 block text-[10px] text-gray-400">
                          {new Date(item.created_at).toLocaleTimeString([], {
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </span>
                      </div>
                      {!item.is_read && (
                        <span className="h-2 w-2 rounded-full bg-blue-600 shrink-0 mt-1" />
                      )}
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </div>

        {/* Profile Menu */}
        <div className="relative" ref={profileRef}>
          <div
            onClick={() => setShowProfileMenu(!showProfileMenu)}
            className="flex cursor-pointer items-center gap-2 rounded-lg p-1.5 hover:bg-gray-100 transition"
          >
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-blue-600 font-semibold text-white">
              A
            </div>
            <div className="hidden sm:block text-left">
              <p className="text-sm font-semibold text-gray-800 leading-tight">Admin</p>
              <p className="text-[11px] text-gray-500">Administrator</p>
            </div>
            <ChevronDown size={15} className="text-gray-400" />
          </div>

          {showProfileMenu && (
            <div className="absolute right-0 mt-2 w-48 rounded-xl border border-gray-200 bg-white p-1.5 shadow-lg z-50">
              <Link
                to="/settings"
                onClick={() => setShowProfileMenu(false)}
                className="flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-medium text-gray-700 hover:bg-gray-50 transition"
              >
                <Settings size={14} /> Workspace Settings
              </Link>
              <button
                onClick={() => {
                  setShowProfileMenu(false);
                  handleLogout();
                }}
                className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-xs font-medium text-rose-600 hover:bg-rose-50 transition"
              >
                <LogOut size={14} /> Sign Out
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
