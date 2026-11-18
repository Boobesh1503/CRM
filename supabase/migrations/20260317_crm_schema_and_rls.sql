-- =========================================================================
-- CRM Enterprise Database Schema & Row Level Security (RLS) Policies
-- Ensures strict isolation between Admin access and Employee personal data
-- =========================================================================

-- 1. EXTENSIONS & FUNCTIONS
create extension if not exists "pgcrypto";

-- Helper: Check if current authenticated user is an administrator
create or replace function public.is_admin()
returns boolean
security definer
set search_path = public
language sql as $$
  select exists (
    select 1 from public.user_roles
    where user_id = auth.uid() and role = 'admin'
  );
$$;

-- Helper: Get current employee record ID linked to authenticated user
create or replace function public.current_employee_id()
returns uuid
security definer
set search_path = public
language sql as $$
  select id from public.employees
  where auth_user_id = auth.uid()
  limit 1;
$$;

-- 2. USER ROLES
create table if not exists public.user_roles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  role text not null check (role in ('admin', 'team_leader', 'employee')),
  created_at timestamptz default now()
);

alter table public.user_roles enable row level security;

create policy "Users can view own role"
  on public.user_roles for select
  using (auth.uid() = user_id or public.is_admin());

create policy "Only admin can manage roles"
  on public.user_roles for all
  using (public.is_admin());

-- 3. EMPLOYEES DIRECTORY
create table if not exists public.employees (
  id uuid primary key default gen_random_uuid(),
  employee_code text unique not null,
  auth_user_id uuid unique references auth.users(id) on delete set null,
  full_name text not null,
  email text unique not null,
  phone text,
  role text not null default 'intern' check (role in ('intern', 'sales_executive', 'team_leader', 'admin')),
  department text default 'Sales',
  employment_status text not null default 'active' check (employment_status in ('active', 'inactive', 'archived')),
  joined_on date default current_date,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table public.employees enable row level security;

create policy "Admins have full access to employees"
  on public.employees for all
  using (public.is_admin());

create policy "Employees can view own employee profile"
  on public.employees for select
  using (auth.uid() = auth_user_id);

create policy "Employees can update own personal contact info"
  on public.employees for update
  using (auth.uid() = auth_user_id)
  with check (auth.uid() = auth_user_id);

-- 4. LEADS & ASSIGNMENT
create table if not exists public.leads (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  company text,
  email text,
  phone text,
  value text,
  stage text not null default 'New' check (stage in ('New', 'Contacted', 'Qualified', 'Proposal', 'Won', 'Lost')),
  assigned_to uuid references public.employees(id) on delete set null,
  source text default 'Website',
  remarks text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table public.leads enable row level security;

-- Admin can view, create, update, and assign all leads
create policy "Admins have full access to leads"
  on public.leads for all
  using (public.is_admin());

-- Employees can ONLY select leads assigned directly to them
create policy "Employees can view only their assigned leads"
  on public.leads for select
  using (assigned_to = public.current_employee_id());

-- Employees can update progress / remarks on their assigned leads
create policy "Employees can update their assigned leads"
  on public.leads for update
  using (assigned_to = public.current_employee_id())
  with check (assigned_to = public.current_employee_id());

-- 5. FOLLOW-UPS
create table if not exists public.follow_ups (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid references public.leads(id) on delete cascade,
  employee_id uuid not null references public.employees(id) on delete cascade,
  client_name text not null,
  company_name text,
  scheduled_date date not null,
  scheduled_time time not null,
  type text default 'Phone Call',
  priority text default 'Normal' check (priority in ('High', 'Medium', 'Normal')),
  status text default 'Pending' check (status in ('Pending', 'Overdue', 'Completed')),
  notes text,
  rescheduled_from text,
  created_at timestamptz default now()
);

alter table public.follow_ups enable row level security;

create policy "Admins have full access to follow-ups"
  on public.follow_ups for all
  using (public.is_admin());

create policy "Employees can view own follow-ups"
  on public.follow_ups for select
  using (employee_id = public.current_employee_id());

create policy "Employees can create follow-ups for themselves"
  on public.follow_ups for insert
  with check (employee_id = public.current_employee_id());

create policy "Employees can update own follow-ups"
  on public.follow_ups for update
  using (employee_id = public.current_employee_id())
  with check (employee_id = public.current_employee_id());

-- 6. ATTENDANCE & PUNCH-IN/PUNCH-OUT
create table if not exists public.attendance (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid not null references public.employees(id) on delete cascade,
  date date not null default current_date,
  check_in timestamptz not null default now(),
  check_out timestamptz,
  working_hours numeric(5,2),
  status text not null default 'present' check (status in ('present', 'half_day', 'late', 'absent')),
  notes text,
  created_at timestamptz default now(),
  unique (employee_id, date)
);

alter table public.attendance enable row level security;

create policy "Admins have full access to attendance"
  on public.attendance for all
  using (public.is_admin());

create policy "Employees can view own attendance records"
  on public.attendance for select
  using (employee_id = public.current_employee_id());

create policy "Employees can punch in"
  on public.attendance for insert
  with check (employee_id = public.current_employee_id() and date = current_date);

create policy "Employees can punch out for current day"
  on public.attendance for update
  using (employee_id = public.current_employee_id() and date = current_date)
  with check (employee_id = public.current_employee_id() and date = current_date);

-- 7. LEAVE REQUESTS
create table if not exists public.leave_requests (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid not null references public.employees(id) on delete cascade,
  leave_type text not null check (leave_type in ('Casual Leave', 'Sick Leave', 'Paid Time Off', 'Emergency')),
  start_date date not null,
  end_date date not null,
  days_count integer not null default 1,
  reason text not null,
  status text not null default 'Pending' check (status in ('Pending', 'Approved', 'Rejected')),
  applied_at timestamptz default now(),
  reviewed_by uuid references auth.users(id),
  reviewed_at timestamptz,
  rejection_reason text
);

alter table public.leave_requests enable row level security;

create policy "Admins have full access to leave requests"
  on public.leave_requests for all
  using (public.is_admin());

create policy "Employees can view own leave applications"
  on public.leave_requests for select
  using (employee_id = public.current_employee_id());

create policy "Employees can submit leave requests"
  on public.leave_requests for insert
  with check (employee_id = public.current_employee_id() and status = 'Pending');

