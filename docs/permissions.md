# Row Level Security (RLS) & Access Control Policy

## 1. Principles of Data Isolation

The CRM operates with two distinct privilege tiers:
1. **Administrators (`admin`)**: Global visibility and write authority across all enterprise records (employee management, team pod creation, unassigned & cross-employee lead assignment, financial transactions, leave approvals).
2. **Employees & Team Leaders (`employee`, `team_leader`)**: Strict, personal data isolation enforced at both the UI layer and the PostgreSQL database level through Supabase Row Level Security (RLS).

---

## 2. Row Level Security Policies

### Leads Policy
```sql
-- Employees can view only their directly assigned leads
create policy "Employees can view only their assigned leads"
  on public.leads for select
  using (assigned_to = public.current_employee_id());

-- Employees can update progress / remarks on their assigned leads
create policy "Employees can update their assigned leads"
  on public.leads for update
  using (assigned_to = public.current_employee_id())
  with check (assigned_to = public.current_employee_id());
```

### Attendance Policy
```sql
-- Employees can view own attendance
create policy "Employees can view own attendance records"
  on public.attendance for select
  using (employee_id = public.current_employee_id());

-- Employees can punch in for today
create policy "Employees can punch in"
  on public.attendance for insert
  with check (employee_id = public.current_employee_id() and date = current_date);

-- Employees can punch out for today
create policy "Employees can punch out for current day"
  on public.attendance for update
  using (employee_id = public.current_employee_id() and date = current_date)
  with check (employee_id = public.current_employee_id() and date = current_date);
```

### Leave Applications Policy
```sql
-- Employees can view their own leave requests
create policy "Employees can view own leave applications"
  on public.leave_requests for select
  using (employee_id = public.current_employee_id());

-- Employees can submit a new leave request (status must be Pending)
create policy "Employees can submit leave requests"
  on public.leave_requests for insert
  with check (employee_id = public.current_employee_id() and status = 'Pending');
```

---

## 3. UI Boundary Restrictions

The **Employee Web Portal** and **Employee Mobile App** do NOT contain:
* Admin Overview / Global Dashboard
* Employee User Creation & Deletion
* Lead Assignment Engine
* Billing & Financial Accounts
* Global Workspace Settings

Access to these routes is blocked by `AdminProtectedLayout` in `App.tsx` and redirected to `/portal`.

