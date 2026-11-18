import { useState, useEffect } from "react";
import { useOutletContext } from "react-router-dom";
import {
  Clock,
  CheckCircle2,
  Play,
  Square,
  AlertCircle,
  RefreshCw,
  Calendar,
  Lock
} from "lucide-react";
import { supabase } from "../../services/supabase";
import { notifyAdmin } from "../../services/notifications";
import type { EmployeeInfo } from "../../components/layout/EmployeeLayout";

interface ProfileContext {
  profile: EmployeeInfo | null;
  loadingProfile: boolean;
}

interface AttendanceRow {
  id: string;
  date: string;
  check_in: string;
  check_out: string | null;
  working_hours: number | null;
  status: "present" | "late" | "half_day" | "absent";
  notes?: string;
}

export default function EmployeeAttendance() {
  const { profile } = useOutletContext<ProfileContext>();
  const [history, setHistory] = useState<AttendanceRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [punchLoading, setPunchLoading] = useState(false);
  const [todayRecord, setTodayRecord] = useState<AttendanceRow | null>(null);
  const [actionMsg, setActionMsg] = useState("");
  const [errorMsg, setErrorMsg] = useState("");

  // Current clock time state
  const [currentTime, setCurrentTime] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  // Time window calculations in minutes:
  // 9:00 AM = 540 min
  // 10:30 AM = 630 min
  // 1:30 PM = 810 min
  const currentMinutes = currentTime.getHours() * 60 + currentTime.getMinutes();
  const isMorningWindow = currentMinutes >= 540 && currentMinutes <= 630;
  const isAfternoonWindow = currentMinutes >= 810;
  const isCheckInAllowed = isMorningWindow || isAfternoonWindow;

  let sessionStatusInfo = "";
  if (isMorningWindow) {
    sessionStatusInfo = "Morning Check-in Active (Window open: 09:00 AM – 10:30 AM)";
  } else if (currentMinutes < 540) {
    sessionStatusInfo = "Morning check-in opens at 09:00 AM.";
  } else if (currentMinutes > 630 && currentMinutes < 810) {
    sessionStatusInfo = "Morning check-in closed at 10:30 AM. Afternoon session opens at 01:30 PM.";
  } else {
    sessionStatusInfo = "Afternoon Check-in Active (Window open from 01:30 PM).";
  }

  const todayStr = new Date().toISOString().split("T")[0];

  async function loadAttendanceData() {
    if (!profile?.id) return;
    setLoading(true);
    setErrorMsg("");

    try {
      const { data, error } = await supabase
        .from("attendance")
        .select("*")
        .eq("employee_id", profile.id)
        .order("date", { ascending: false });

      if (error) {
        setErrorMsg(error.message);
      } else if (data) {
        setHistory(data as AttendanceRow[]);
        const today = data.find((r) => r.date === todayStr);
        setTodayRecord((today as AttendanceRow) || null);
      }
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : "Error loading attendance.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (profile?.id) {
      loadAttendanceData();
    }
  }, [profile?.id]);

  async function handleCheckIn() {
    if (!profile?.id) return;
    if (!isCheckInAllowed) {
      setErrorMsg("Check-in is currently outside the authorized timing windows.");
      return;
    }

    setPunchLoading(true);
    setErrorMsg("");
    setActionMsg("");

    try {
      const now = new Date();
      const statusType = isMorningWindow ? "present" : "late";

      const { data, error } = await supabase
        .from("attendance")
        .insert({
          employee_id: profile.id,
          date: todayStr,
          check_in: now.toISOString(),
          status: statusType,
          notes: isMorningWindow ? "Morning shift check-in" : "Afternoon shift check-in",
        })
        .select()
        .single();

      if (error) throw new Error(error.message);

      await notifyAdmin(
        "Employee Check-In",
        `${profile.full_name} (${profile.employee_code}) punched in for ${
          isMorningWindow ? "Morning shift" : "Afternoon shift"
        } at ${now.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}.`,
        "attendance",
        "/"
      );

      setActionMsg(
        `Checked in successfully at ${now.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}.`
      );
      await loadAttendanceData();
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : "Failed to record check-in.");
    } finally {
      setPunchLoading(false);
    }
  }

  async function handleCheckOut() {
    if (!todayRecord?.id) return;

    setPunchLoading(true);
    setErrorMsg("");
    setActionMsg("");

    try {
      const now = new Date();
      const checkInDate = new Date(todayRecord.check_in);
      const diffMs = now.getTime() - checkInDate.getTime();
      const hoursWorked = Math.max(0.1, Number((diffMs / (1000 * 60 * 60)).toFixed(2)));

      const { error } = await supabase
        .from("attendance")
        .update({
          check_out: now.toISOString(),
          working_hours: hoursWorked,
        })
        .eq("id", todayRecord.id);

      if (error) throw new Error(error.message);

      await notifyAdmin(
        "Employee Shift Completed",
        `${profile?.full_name || "Employee"} (${profile?.employee_code || "EMP"}) checked out after ${hoursWorked} working hours.`,
        "attendance",
        "/"
      );

      setActionMsg(
        `Checked out successfully at ${now.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}. Total logged: ${hoursWorked} hours.`
      );
      await loadAttendanceData();
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : "Failed to record check-out.");
    } finally {
      setPunchLoading(false);
    }
  }

  // Active shift time display
  let activeShiftElapsed = "0h 0m";
  if (todayRecord && !todayRecord.check_out) {
    const start = new Date(todayRecord.check_in);
    const diffMs = Math.max(0, currentTime.getTime() - start.getTime());
    const hours = Math.floor(diffMs / (1000 * 60 * 60));
    const mins = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
    activeShiftElapsed = `${hours}h ${mins}m`;
  }

  return (
    <div className="space-y-6 p-6">
      {/* Page Heading - Matches Admin Panel */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Attendance & Shifts</h1>
          <p className="mt-1 text-sm text-gray-500">
            Log your daily shift check-in and check-out according to company authorized timings.
          </p>
        </div>

        <button
          onClick={loadAttendanceData}
          disabled={loading}
          className="flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 shadow-sm transition disabled:opacity-50"
        >
          <RefreshCw size={15} className={loading ? "animate-spin text-blue-600" : ""} />
          Refresh
        </button>
      </div>

      {actionMsg && (
        <div className="flex items-center gap-2 rounded-lg bg-green-50 border border-green-200 p-3 text-sm text-green-700">
          <CheckCircle2 size={16} />
          {actionMsg}
        </div>
      )}

      {errorMsg && (
        <div className="rounded-lg bg-red-50 border border-red-200 p-3 text-sm text-red-700">
          {errorMsg}
        </div>
      )}

      {/* Main Punch Clock Card - Admin Theme styling */}
      <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-6">
          <div className="flex items-center gap-5">
            <div className="flex h-16 w-16 items-center justify-center rounded-xl bg-blue-50 text-blue-600">
              <Clock size={32} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium text-gray-500">Current Time</span>
                <span className="rounded-md bg-gray-100 px-2 py-0.5 text-xs font-mono font-semibold text-gray-800">
                  {currentTime.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
                </span>
              </div>

              <h2 className="mt-1 text-2xl font-bold text-gray-900">
                {todayRecord && !todayRecord.check_out
                  ? `Active Shift: ${activeShiftElapsed}`
                  : todayRecord?.check_out
                  ? `Shift Completed: ${todayRecord.working_hours ?? 0} hrs`
                  : "Not Checked In Today"}
              </h2>

              <p className="mt-1 text-xs text-gray-500">{sessionStatusInfo}</p>
            </div>
          </div>

          <div>
            {todayRecord && !todayRecord.check_out ? (
              <button
                onClick={handleCheckOut}
                disabled={punchLoading}
                className="flex items-center gap-2 rounded-lg bg-rose-600 px-6 py-3 text-sm font-semibold text-white hover:bg-rose-700 shadow-sm transition disabled:opacity-50"
              >
                <Square size={16} />
                {punchLoading ? "Processing..." : "Check Out (End Shift)"}
              </button>
            ) : todayRecord?.check_out ? (
              <div className="rounded-lg border border-gray-200 bg-gray-50 px-5 py-3 text-sm font-medium text-gray-600">
                <CheckCircle2 size={16} className="inline mr-2 text-green-600" />
                Shift Logged for Today
              </div>
            ) : isCheckInAllowed ? (
              <button
                onClick={handleCheckIn}
                disabled={punchLoading}
                className="flex items-center gap-2 rounded-lg bg-blue-600 px-6 py-3 text-sm font-semibold text-white hover:bg-blue-700 shadow-sm transition disabled:opacity-50"
              >
                <Play size={16} />
                {punchLoading ? "Checking In..." : isMorningWindow ? "Morning Check In" : "Afternoon Check In"}
              </button>
            ) : (
              <div className="flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-xs font-semibold text-amber-800">
                <Lock size={15} />
                <span>Check-in Locked (Outside Window)</span>
              </div>
            )}
          </div>
        </div>

        {/* Timing Policy Reminder Box */}
        <div className="mt-6 border-t border-gray-100 pt-4 text-xs text-gray-500 grid grid-cols-1 md:grid-cols-2 gap-3">
          <div className="flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-blue-600" />
            <span><strong>Morning Session:</strong> 09:00 AM to 10:30 AM</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-blue-600" />
            <span><strong>Afternoon Session:</strong> Opens after 01:30 PM (if morning missed)</span>
          </div>
        </div>
      </div>

      {/* Attendance History Table - Identical to Admin Table */}
      <div className="rounded-xl border border-gray-200 bg-white shadow-sm overflow-hidden">
        <div className="flex items-center justify-between border-b border-gray-200 p-5">
          <div>
            <h2 className="font-semibold text-gray-900">Attendance Log History</h2>
            <p className="mt-1 text-xs text-gray-500">Your verified check-in and check-out records</p>
          </div>
          <span className="text-xs text-gray-400 font-mono">{history.length} records</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-gray-50 text-xs uppercase text-gray-500">
              <tr>
                <th className="px-5 py-4">Date</th>
                <th className="px-5 py-4">Check-in</th>
                <th className="px-5 py-4">Check-out</th>
                <th className="px-5 py-4">Working Hours</th>
                <th className="px-5 py-4">Status</th>
                <th className="px-5 py-4">Notes</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading ? (
                <tr>
                  <td colSpan={6} className="px-5 py-12 text-center text-gray-500">
                    Loading attendance history...
                  </td>
                </tr>
              ) : history.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-5 py-12 text-center text-gray-500">
                    No attendance records logged yet. Check in above during the open timing windows to begin.
                  </td>
                </tr>
              ) : (
                history.map((row) => (
                  <tr key={row.id} className="hover:bg-gray-50 transition">
                    <td className="px-5 py-4 font-medium text-gray-900">{row.date}</td>
                    <td className="px-5 py-4 text-gray-600">
                      {new Date(row.check_in).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                    </td>
                    <td className="px-5 py-4 text-gray-600">
                      {row.check_out
                        ? new Date(row.check_out).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
                        : "In Progress"}
                    </td>
                    <td className="px-5 py-4 font-semibold text-gray-800">
                      {row.working_hours ? `${row.working_hours} hrs` : "-"}
                    </td>
                    <td className="px-5 py-4">
                      <span
                        className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                          row.status === "present"
                            ? "bg-green-50 text-green-700 border border-green-200"
                            : row.status === "late"
                            ? "bg-amber-50 text-amber-700 border border-amber-200"
                            : row.status === "half_day"
                            ? "bg-blue-50 text-blue-700 border border-blue-200"
                            : "bg-red-50 text-red-700 border border-red-200"
                        }`}
                      >
                        {row.status.replace("_", " ").toUpperCase()}
                      </span>
                    </td>
                    <td className="px-5 py-4 text-xs text-gray-500">{row.notes || "-"}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
