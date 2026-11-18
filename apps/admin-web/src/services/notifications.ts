import { supabase } from "./supabase";

export interface NotificationItem {
  id: string;
  recipient_id?: string | null;
  recipient_role: "admin" | "employee" | "all";
  title: string;
  message: string;
  type: "lead_assigned" | "status_update" | "attendance" | "leave" | "call" | "info";
  is_read: boolean;
  link?: string | null;
  created_at: string;
}

/**
 * Send notification to Admin whenever an employee performs an update
 */
export async function notifyAdmin(
  title: string,
  message: string,
  type: NotificationItem["type"] = "info",
  link?: string
) {
  try {
    await supabase.from("notifications").insert({
      recipient_role: "admin",
      title,
      message,
      type,
      link,
      is_read: false,
    });
  } catch (err) {
    console.warn("Failed to dispatch admin notification:", err);
  }
}

/**
 * Send notification to an Employee (e.g. when Admin assigns new leads or reviews leave)
 */
export async function notifyEmployee(
  authUserIdOrEmployeeId: string,
  title: string,
  message: string,
  type: NotificationItem["type"] = "lead_assigned",
  link?: string
) {
  try {
    // If it's an employee table UUID, try resolving auth_user_id
    let targetAuthUserId = authUserIdOrEmployeeId;
    const { data: emp } = await supabase
      .from("employees")
      .select("auth_user_id")
      .eq("id", authUserIdOrEmployeeId)
      .maybeSingle();

    if (emp?.auth_user_id) {
      targetAuthUserId = emp.auth_user_id;
    }

    await supabase.from("notifications").insert({
      recipient_id: targetAuthUserId,
      recipient_role: "employee",
      title,
      message,
      type,
      link,
      is_read: false,
    });
  } catch (err) {
    console.warn("Failed to dispatch employee notification:", err);
  }
}

/**
 * Fetch unread and recent notifications for Admin
 */
export async function getAdminNotifications(limit = 20): Promise<NotificationItem[]> {
  try {
    const { data, error } = await supabase
      .from("notifications")
      .select("*")
      .or("recipient_role.eq.admin,recipient_role.eq.all")
      .order("created_at", { ascending: false })
      .limit(limit);

    if (error) {
      console.warn("Could not query notifications:", error.message);
      return [];
    }
    return (data as NotificationItem[]) || [];
  } catch {
    return [];
  }
}

/**
 * Mark notification as read
 */
export async function markNotificationAsRead(id: string) {
  try {
    await supabase.from("notifications").update({ is_read: true }).eq("id", id);
  } catch (err) {
    console.warn("Could not mark notification as read:", err);
  }
}

/**
 * Mark all notifications as read
 */
export async function markAllNotificationsAsRead() {
  try {
    await supabase
      .from("notifications")
      .update({ is_read: true })
      .or("recipient_role.eq.admin,recipient_role.eq.all");
  } catch (err) {
    console.warn("Could not mark all notifications as read:", err);
  }
}

