# CRM Database Schema & Supabase Architecture

This document describes the unified PostgreSQL schema for the CRM platform serving both the **Admin Web Panel**, the **Employee Web Portal**, and the **Android Mobile Application**.

---

## 1. Tables Overview

### 1.1 `public.user_roles`
Tracks authorization role per Supabase Auth account.
* `user_id` (`uuid`, Primary Key, references `auth.users(id)`)
* `role` (`text`, check `role in ('admin', 'team_leader', 'employee')`)
* `created_at` (`timestamptz`)

### 1.2 `public.employees`
Directory profiles for internal staff and sales representatives.
* `id` (`uuid`, Primary Key)
* `employee_code` (`text`, unique, e.g. `EMP-1042`)
* `auth_user_id` (`uuid`, unique, references `auth.users(id)`)
* `full_name` (`text`, not null)
* `email` (`text`, unique, not null)
* `phone` (`text`)
* `role` (`text`, check `role in ('intern', 'sales_executive', 'team_leader', 'admin')`)
* `department` (`text`, default `'Sales'`)
* `employment_status` (`text`, check `employment_status in ('active', 'inactive', 'archived')`)
* `joined_on` (`date`)
* `created_at` (`timestamptz`)
* `updated_at` (`timestamptz`)

### 1.3 `public.leads`
Sales pipeline deals and prospective accounts.
* `id` (`uuid`, Primary Key)
* `name` (`text`, not null)
* `company` (`text`)
* `email` (`text`)
* `phone` (`text`)
* `value` (`text`)
* `stage` (`text`, check `stage in ('New', 'Contacted', 'Qualified', 'Proposal', 'Won', 'Lost')`)
* `assigned_to` (`uuid`, references `public.employees(id)`)
* `source` (`text`)
* `remarks` (`text`)
* `created_at` (`timestamptz`)
* `updated_at` (`timestamptz`)

### 1.4 `public.follow_ups`
Client touchpoints, scheduled calls, demo sessions, and callbacks.
* `id` (`uuid`, Primary Key)
* `lead_id` (`uuid`, references `public.leads(id)`)
* `employee_id` (`uuid`, references `public.employees(id)`)
* `client_name` (`text`, not null)
* `company_name` (`text`)
* `scheduled_date` (`date`, not null)
* `scheduled_time` (`time`, not null)
* `type` (`text`, default `'Phone Call'`)
* `priority` (`text`, check `priority in ('High', 'Medium', 'Normal')`)
* `status` (`text`, check `status in ('Pending', 'Overdue', 'Completed')`)
* `notes` (`text`)
* `rescheduled_from` (`text`)
* `created_at` (`timestamptz`)

### 1.5 `public.attendance`
Daily employee punch-in, punch-out, and shift tracking.
* `id` (`uuid`, Primary Key)
* `employee_id` (`uuid`, references `public.employees(id)`)
* `date` (`date`, not null, default `current_date`)
* `check_in` (`timestamptz`, not null)
* `check_out` (`timestamptz`)
* `working_hours` (`numeric(5,2)`)
* `status` (`text`, check `status in ('present', 'half_day', 'late', 'absent')`)
* `notes` (`text`)
* `created_at` (`timestamptz`)
* Constraint: Unique `(employee_id, date)`

### 1.6 `public.leave_requests`
Employee leave and time-off applications.
* `id` (`uuid`, Primary Key)
* `employee_id` (`uuid`, references `public.employees(id)`)
* `leave_type` (`text`, check `leave_type in ('Casual Leave', 'Sick Leave', 'Paid Time Off', 'Emergency')`)
* `start_date` (`date`, not null)
* `end_date` (`date`, not null)
* `days_count` (`integer`, not null)
* `reason` (`text`, not null)
* `status` (`text`, check `status in ('Pending', 'Approved', 'Rejected')`)
* `applied_at` (`timestamptz`)
* `reviewed_by` (`uuid`, references `auth.users(id)`)
* `reviewed_at` (`timestamptz`)
* `rejection_reason` (`text`)

