/**
 * @crm/shared
 * Core domain types, role definitions, and data models shared across
 * Admin Web Panel, Employee Web Portal, and Android Mobile Application.
 */

// 1. Roles & Permissions
export type UserRole = "admin" | "team_leader" | "employee";

export type EmploymentStatus = "active" | "inactive" | "archived";

export interface EmployeeProfile {
  id: string;
  employee_code: string;
  auth_user_id: string | null;
  full_name: string;
  email: string;
  phone: string | null;
  role: "intern" | "sales_executive" | "team_leader" | "admin";
  department: string | null;
  employment_status: EmploymentStatus;
  joined_on: string | null;
  created_at: string;
}

// 2. Leads & Assignment
export type LeadStage =
  | "New"
  | "Contacted"
  | "Qualified"
  | "Proposal"
  | "Won"
  | "Lost";

export interface Lead {
  id: string;
  name: string;
  company: string;
  email: string;
  phone: string;
  value: string;
  stage: LeadStage;
  assigned_to: string; // Employee ID or auth_user_id
  source: string;
  remarks?: string;
  created_at: string;
  updated_at: string;
}

// 3. Follow-ups
export type FollowUpPriority = "High" | "Medium" | "Normal";
export type FollowUpStatus = "Pending" | "Overdue" | "Completed";
export type FollowUpType = "Meeting" | "Phone Call" | "Demo Session" | "Contract Review";

export interface FollowUp {
  id: string;
  lead_id: string;
  employee_id: string;
  client_name: string;
  company_name: string;
  scheduled_date: string;
  scheduled_time: string;
  type: FollowUpType;
  priority: FollowUpPriority;
  status: FollowUpStatus;
  notes: string;
  rescheduled_from?: string;
  created_at: string;
}

// 4. Attendance
export type AttendanceStatus = "present" | "half_day" | "late" | "absent";

export interface AttendanceRecord {
  id: string;
  employee_id: string;
  date: string; // YYYY-MM-DD
  check_in: string; // ISO timestamp
  check_out?: string | null;
  working_hours?: number | null; // Total minutes or hours
  status: AttendanceStatus;
  notes?: string;
}

// 5. Leave Requests
export type LeaveType = "Casual Leave" | "Sick Leave" | "Paid Time Off" | "Emergency";
export type LeaveStatus = "Pending" | "Approved" | "Rejected";

export interface LeaveRequest {
  id: string;
  employee_id: string;
  leave_type: LeaveType;
  start_date: string;
  end_date: string;
  days_count: number;
  reason: string;
  status: LeaveStatus;
  applied_at: string;
  reviewed_by?: string;
  reviewed_at?: string;
  rejection_reason?: string;
}

// 6. Telephony & Call Logs
export type CallOutcome =
  | "Interested"
  | "Call Back"
  | "Busy"
  | "Not Answered"
  | "Closed";

export interface CallLog {
  id: string;
  lead_id: string;
  employee_id: string;
  contact_name: string;
  phone: string;
  call_type: "inbound" | "outbound";
  duration_seconds: number;
  outcome: CallOutcome;
  remarks: string;
  called_at: string;
}

