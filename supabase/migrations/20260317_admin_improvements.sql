-- =========================================================================
-- CRM Enterprise - Additional Modules Schema & RLS Policies
-- Adds Notifications, Invoices, Payslips, Salaries, Calls, Teams, Projects
-- =========================================================================

-- 1. NOTIFICATIONS TABLE
create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  recipient_id uuid references auth.users(id) on delete cascade,
  recipient_role text check (recipient_role in ('admin', 'employee', 'all')),
  title text not null,
  message text not null,
  type text default 'info',
  is_read boolean default false,
  link text,
  metadata jsonb default '{}'::jsonb,
  created_at timestamptz default now()
);

alter table public.notifications enable row level security;

create policy "Admins can view and manage all notifications"
  on public.notifications for all
  using (public.is_admin());

create policy "Users can view own notifications"
  on public.notifications for select
  using (auth.uid() = recipient_id or recipient_role = 'employee' or recipient_role = 'all');

create policy "Users can mark own notifications as read"
  on public.notifications for update
  using (auth.uid() = recipient_id or public.is_admin());

create policy "Authenticated users can create notifications"
  on public.notifications for insert
  with check (auth.role() = 'authenticated');

-- 2. CALLS / CALL LOGS TABLE
create table if not exists public.calls (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid not null references public.employees(id) on delete cascade,
  lead_id uuid references public.leads(id) on delete set null,
  client_name text not null,
  phone text not null,
  call_type text not null default 'Outbound' check (call_type in ('Outbound', 'Inbound')),
  duration_seconds integer default 0,
  outcome text not null default 'Answered' check (outcome in ('Answered', 'Busy', 'No Answer', 'Wrong Number', 'Voicemail', 'Callback Requested')),
  notes text,
  follow_up_needed boolean default false,
  follow_up_date date,
  created_at timestamptz default now()
);

alter table public.calls enable row level security;

create policy "Admins have full access to calls"
  on public.calls for all
  using (public.is_admin());

create policy "Employees can view own calls"
  on public.calls for select
  using (employee_id = public.current_employee_id());

create policy "Employees can log calls"
  on public.calls for insert
  with check (employee_id = public.current_employee_id());

-- 3. TEAMS & TEAM MEMBERS TABLE
create table if not exists public.teams (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  department text default 'Sales',
  leader_id uuid references public.employees(id) on delete set null,
  target_monthly integer default 50,
  created_at timestamptz default now()
);

create table if not exists public.team_members (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references public.teams(id) on delete cascade,
  employee_id uuid not null references public.employees(id) on delete cascade,
  joined_at timestamptz default now(),
  unique (team_id, employee_id)
);

alter table public.teams enable row level security;
alter table public.team_members enable row level security;

create policy "Admins have full access to teams"
  on public.teams for all
  using (public.is_admin());

create policy "Everyone can view teams"
  on public.teams for select
  using (auth.role() = 'authenticated');

create policy "Admins have full access to team members"
  on public.team_members for all
  using (public.is_admin());

create policy "Everyone can view team members"
  on public.team_members for select
  using (auth.role() = 'authenticated');

-- 4. INVOICES & INVOICE ITEMS TABLE
create table if not exists public.invoices (
  id uuid primary key default gen_random_uuid(),
  invoice_number text unique not null,
  from_name text not null,
  from_details text,
  bill_to text not null,
  ship_to text,
  date date not null default current_date,
  payment_terms text default 'Net 30',
  due_date date,
  po_number text,
  notes text,
  terms text,
  subtotal numeric(12,2) not null default 0,
  tax_rate numeric(5,2) default 0,
  tax_amount numeric(12,2) default 0,
  discount_amount numeric(12,2) default 0,
  shipping_amount numeric(12,2) default 0,
  total_amount numeric(12,2) not null default 0,
  amount_paid numeric(12,2) default 0,
  balance_due numeric(12,2) not null default 0,
  status text not null default 'draft' check (status in ('draft', 'sent', 'paid', 'overdue', 'cancelled')),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists public.invoice_items (
  id uuid primary key default gen_random_uuid(),
  invoice_id uuid not null references public.invoices(id) on delete cascade,
  description text not null,
  quantity numeric(10,2) not null default 1,
  rate numeric(12,2) not null default 0,
  amount numeric(12,2) not null default 0
);

alter table public.invoices enable row level security;
alter table public.invoice_items enable row level security;

create policy "Admins have full access to invoices"
  on public.invoices for all
  using (public.is_admin());

create policy "Admins have full access to invoice items"
  on public.invoice_items for all
  using (public.is_admin());

-- 5. SALARIES & PAYSLIPS TABLE
create table if not exists public.salaries (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid not null references public.employees(id) on delete cascade unique,
  payment_type text not null default 'salary' check (payment_type in ('stipend', 'salary')),
  basic_amount numeric(12,2) not null default 0,
  allowances numeric(12,2) default 0,
  deductions numeric(12,2) default 0,
  updated_at timestamptz default now()
);

create table if not exists public.payslips (
  id uuid primary key default gen_random_uuid(),
  payslip_number text unique not null,
  employee_id uuid not null references public.employees(id) on delete cascade,
  salary_month text not null,
  basic_amount numeric(12,2) not null,
  allowances numeric(12,2) default 0,
  deductions numeric(12,2) default 0,
  net_payable numeric(12,2) not null,
  payment_date date,
  payment_status text not null default 'Pending' check (payment_status in ('Pending', 'Paid', 'Processing')),
  created_at timestamptz default now()
);

alter table public.salaries enable row level security;
alter table public.payslips enable row level security;

create policy "Admins have full access to salaries"
  on public.salaries for all
  using (public.is_admin());

create policy "Employees can view own salary"
  on public.salaries for select
  using (employee_id = public.current_employee_id());

create policy "Admins have full access to payslips"
  on public.payslips for all
  using (public.is_admin());

create policy "Employees can view own payslips"
  on public.payslips for select
  using (employee_id = public.current_employee_id());

-- 6. PROJECTS TABLE
create table if not exists public.projects (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  client text not null,
  lead_id uuid references public.leads(id) on delete set null,
  status text not null default 'Planning' check (status in ('Planning', 'In Progress', 'Review', 'Completed', 'On Hold')),
  budget numeric(12,2) default 0,
  deadline date,
  progress integer default 0 check (progress between 0 and 100),
  description text,
  assigned_team_id uuid references public.teams(id) on delete set null,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table public.projects enable row level security;

create policy "Admins have full access to projects"
  on public.projects for all
  using (public.is_admin());

create policy "Everyone can view projects"
  on public.projects for select
  using (auth.role() = 'authenticated');

