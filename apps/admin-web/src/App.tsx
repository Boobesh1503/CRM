import { useEffect, useState } from "react";
import {
  BrowserRouter,
  Routes,
  Route,
  Navigate,
} from "react-router-dom";
import type { Session } from "@supabase/supabase-js";

import { supabase } from "./services/supabase";

// Admin Layout & Pages
import Sidebar from "./components/layout/Sidebar";
import Topbar from "./components/layout/Topbar";
import Dashboard from "./pages/dashboard/Dashboard";
import Employees from "./pages/employees/Employees";
import Teams from "./pages/teams/Teams";
import Leads from "./pages/leads/Leads";
import Calls from "./pages/calls/Calls";
import Followups from "./pages/followups/Followups";
import Finance from "./pages/finance/Finance";
import LeaveRequests from "./pages/leave-requests/LeaveRequests";
import Reports from "./pages/reports/Reports";
import Projects from "./pages/projects/Projects";
import AttendanceReports from "./pages/attendance-reports/AttendanceReports";
import SalaryManagement from "./pages/salary/SalaryManagement";
import Settings from "./pages/settings/Settings";

// Employee Portal Layout & Pages
import EmployeeLayout from "./components/layout/EmployeeLayout";
import EmployeeDashboard from "./pages/portal/EmployeeDashboard";
import AssignedLeads from "./pages/portal/AssignedLeads";
import EmployeeFollowups from "./pages/portal/EmployeeFollowups";
import EmployeeAttendance from "./pages/portal/EmployeeAttendance";
import EmployeeLeave from "./pages/portal/EmployeeLeave";
import EmployeeProfile from "./pages/portal/EmployeeProfile";

import Login from "./pages/auth/Login";

type RoleType = "admin" | "team_leader" | "employee" | null;

function useAuth() {
  const [session, setSession] = useState<Session | null>(null);
  const [role, setRole] = useState<RoleType>(null);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    let mounted = true;

    async function checkAuth() {
      const { data } = await supabase.auth.getSession();
      const currentSession = data.session;

      if (!currentSession) {
        if (mounted) {
          setSession(null);
          setRole(null);
          setChecking(false);
        }
        return;
      }

      const { data: roleData, error } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", currentSession.user.id)
        .maybeSingle();

      if (mounted) {
        setSession(currentSession);
        setRole((!error && roleData?.role as RoleType) || "employee");
        setChecking(false);
      }
    }

    checkAuth();

    const { data: listener } = supabase.auth.onAuthStateChange(() => {
      checkAuth();
    });

    return () => {
      mounted = false;
      listener.subscription.unsubscribe();
    };
  }, []);

  return { session, role, checking };
}

// Protected Admin Panel Layout
function AdminProtectedLayout() {
  const { session, role, checking } = useAuth();

  if (checking) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50 text-sm text-gray-500">
        Verifying administrator credentials...
      </div>
    );
  }

  if (!session) {
    return <Navigate to="/login" replace />;
  }

  // Restrict access: Employees & Team Leaders are locked out of Admin Panel
  if (role !== "admin") {
    return <Navigate to="/portal" replace />;
  }

  return (
    <div className="flex h-screen overflow-hidden bg-gray-50">
      <Sidebar />

      <div className="flex min-w-0 flex-1 flex-col">
        <Topbar />

        <main className="flex-1 overflow-y-auto">
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/employees" element={<Employees />} />
            <Route path="/teams" element={<Teams />} />
            <Route path="/leads" element={<Leads />} />
            <Route path="/calls" element={<Calls />} />
            <Route path="/followups" element={<Followups />} />
            <Route path="/finance" element={<Finance />} />
            <Route path="/leave-requests" element={<LeaveRequests />} />
            <Route path="/reports" element={<Reports />} />
            <Route path="/projects" element={<Projects />} />
            <Route path="/attendance-reports" element={<AttendanceReports />} />
            <Route path="/salary" element={<SalaryManagement />} />
            <Route path="/settings" element={<Settings />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </main>
      </div>
    </div>
  );
}

// Dedicated Employee Web Portal Layout
function EmployeePortalRoute() {
  const { session, role, checking } = useAuth();

  if (checking) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 text-sm text-slate-500">
        Loading Employee Portal...
      </div>
    );
  }

  if (!session) {
    return <Navigate to="/login" replace />;
  }

  return (
    <Routes>
      <Route element={<EmployeeLayout />}>
        <Route path="/" element={<EmployeeDashboard />} />
        <Route path="/leads" element={<AssignedLeads />} />
        <Route path="/followups" element={<EmployeeFollowups />} />
        <Route path="/attendance" element={<EmployeeAttendance />} />
        <Route path="/leave" element={<EmployeeLeave />} />
        <Route path="/profile" element={<EmployeeProfile />} />
        <Route path="*" element={<Navigate to="/portal" replace />} />
      </Route>
    </Routes>
  );
}

// Login route with intelligent role redirection
function LoginRoute() {
  const { session, role, checking } = useAuth();

  if (checking) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-100 text-sm text-gray-500">
        Checking session...
      </div>
    );
  }

  if (session) {
    if (role === "admin") {
      return <Navigate to="/" replace />;
    }
    return <Navigate to="/portal" replace />;
  }

  return <Login />;
}

function AppRoutes() {
  return (
    <Routes>
      <Route path="/login" element={<LoginRoute />} />
      <Route path="/portal/*" element={<EmployeePortalRoute />} />
      <Route path="/*" element={<AdminProtectedLayout />} />
    </Routes>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AppRoutes />
    </BrowserRouter>
  );
}
