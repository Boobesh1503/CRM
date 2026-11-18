# CRM Enterprise Platform Architecture

## 1. System Components

The repository is structured as a pnpm monorepo containing:
* **Admin Web Panel (`apps/admin-web`)**: Administrative dashboard for business metrics, workforce management, team pod organization, financial summaries, and full lead distribution.
* **Employee Web Portal (`apps/admin-web/src/pages/portal`)**: Secure, employee-specific workstation containing:
  1. Employee Dashboard (Today's queue, calls logged, shift status, performance summary)
  2. Assigned Leads (Strictly authorized lead records, call triggers, status updates, remarks)
  3. Follow-ups (Daily agenda, upcoming appointments, reschedule workflows, audit log)
  4. Leave Requests (Time-off applications, calendar ranges, balance tracker, approval history)
  5. Attendance (Live shift check-in / check-out, working hours timer, monthly logs)
  6. My Profile (Employee ID, designation, password update, sign out)
* **Employee Android App (`apps/employee-android`)**: Native/mobile client sharing the same Supabase Auth and database schema via `@crm/shared`.
* **Shared Types & Utilities (`apps/shared`)**: Shared TypeScript interfaces, status enums, and validation logic.
* **Supabase Cloud Backend (`supabase/`)**: PostgreSQL with Row Level Security (RLS), GoTrue Auth, and Deno Edge Functions.

---

## 2. Authentication & Redirection Flow

```
+--------------------+
|  User Login Form   |
+---------+----------+
          |
          v
+--------------------+
| Supabase Auth Check|
+---------+----------+
          |
          v
+-----------------------------+
| Check public.user_roles     |
+---------+-------------------+
          |
    +-----+-----+
    |           |
    v           v
role='admin'  role in ('employee', 'team_leader')
    |           |
    v           v
Admin Panel   Employee Portal
  (/)           (/portal)
```

