-- =========================================================================
-- COMPLETE CRM MASTER DATABASE SETUP SCRIPT
-- Execute this ONCE in Supabase SQL Editor (https://supabase.com/dashboard)
-- This creates all tables, functions, and RLS policies in correct order.
-- =========================================================================

-- 1. EXTENSIONS
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 2. CORE HELPER FUNCTIONS
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
SECURITY DEFINER
SET search_path = public
LANGUAGE sql AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid() AND role = 'admin'
  );
$$;

CREATE OR REPLACE FUNCTION public.current_employee_id()
RETURNS uuid
SECURITY DEFINER
SET search_path = public
LANGUAGE sql AS $$
  SELECT id FROM public.employees
  WHERE auth_user_id = auth.uid()
  LIMIT 1;
$$;

-- Function: Direct Password Reset by Admin (No Email Dispatched)
CREATE OR REPLACE FUNCTION public.admin_set_user_password(target_email text, new_password text)
RETURNS boolean
SECURITY DEFINER
SET search_path = public, auth
LANGUAGE plpgsql
AS $$
BEGIN
  -- Verify calling user is admin
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Administrator privileges required to set employee passwords.';
  END IF;

  UPDATE auth.users
  SET encrypted_password = crypt(new_password, gen_salt('bf')),
      updated_at = now()
  WHERE lower(email) = lower(target_email);

  RETURN FOUND;
END;
$$;

-- 3. USER ROLES TABLE
CREATE TABLE IF NOT EXISTS public.user_roles (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  role text NOT NULL CHECK (role IN ('admin', 'team_leader', 'employee')),
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can view own role" ON public.user_roles;
CREATE POLICY "Users can view own role" ON public.user_roles FOR SELECT USING (auth.uid() = user_id OR public.is_admin());
DROP POLICY IF EXISTS "Only admin can manage roles" ON public.user_roles;
CREATE POLICY "Only admin can manage roles" ON public.user_roles FOR ALL USING (public.is_admin());

-- 4. EMPLOYEES DIRECTORY
CREATE TABLE IF NOT EXISTS public.employees (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_code text UNIQUE NOT NULL,
  auth_user_id uuid UNIQUE REFERENCES auth.users(id) ON DELETE SET NULL,
  full_name text NOT NULL,
  email text UNIQUE NOT NULL,
  phone text,
  role text NOT NULL DEFAULT 'intern' CHECK (role IN ('intern', 'sales_executive', 'team_leader', 'admin')),
  department text DEFAULT 'Sales',
  employment_status text NOT NULL DEFAULT 'active' CHECK (employment_status IN ('active', 'inactive', 'archived')),
  joined_on date DEFAULT current_date,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE public.employees ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Admins have full access to employees" ON public.employees;
CREATE POLICY "Admins have full access to employees" ON public.employees FOR ALL USING (public.is_admin());
DROP POLICY IF EXISTS "Employees can view own employee profile" ON public.employees;
CREATE POLICY "Employees can view own employee profile" ON public.employees FOR SELECT USING (auth.uid() = auth_user_id);
DROP POLICY IF EXISTS "Employees can update own personal contact info" ON public.employees;
CREATE POLICY "Employees can update own personal contact info" ON public.employees FOR UPDATE USING (auth.uid() = auth_user_id) WITH CHECK (auth.uid() = auth_user_id);

-- 5. LEADS TABLE
CREATE TABLE IF NOT EXISTS public.leads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  company text,
  email text,
  phone text,
  value text DEFAULT '₹0',
  stage text NOT NULL DEFAULT 'New' CHECK (stage IN ('New', 'Contacted', 'Qualified', 'Proposal', 'Won', 'Lost')),
  assigned_to uuid REFERENCES public.employees(id) ON DELETE SET NULL,
  source text DEFAULT 'Imported Spreadsheet',
  remarks text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE public.leads ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Admins have full access to leads" ON public.leads;
CREATE POLICY "Admins have full access to leads" ON public.leads FOR ALL USING (public.is_admin());
DROP POLICY IF EXISTS "Employees can view only their assigned leads" ON public.leads;
CREATE POLICY "Employees can view only their assigned leads" ON public.leads FOR SELECT USING (assigned_to = public.current_employee_id());
DROP POLICY IF EXISTS "Employees can update their assigned leads" ON public.leads;
CREATE POLICY "Employees can update their assigned leads" ON public.leads FOR UPDATE USING (assigned_to = public.current_employee_id()) WITH CHECK (assigned_to = public.current_employee_id());

-- 6. FOLLOW-UPS TABLE
CREATE TABLE IF NOT EXISTS public.follow_ups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id uuid REFERENCES public.leads(id) ON DELETE CASCADE,
  employee_id uuid NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  client_name text NOT NULL,
  company_name text,
  scheduled_date date NOT NULL,
  scheduled_time time NOT NULL,
  type text DEFAULT 'Phone Call',
  priority text DEFAULT 'Normal' CHECK (priority IN ('High', 'Medium', 'Normal')),
  status text DEFAULT 'Pending' CHECK (status IN ('Pending', 'Overdue', 'Completed')),
  notes text,
  rescheduled_from text,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.follow_ups ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Admins have full access to follow-ups" ON public.follow_ups;
CREATE POLICY "Admins have full access to follow-ups" ON public.follow_ups FOR ALL USING (public.is_admin());
DROP POLICY IF EXISTS "Employees can view own follow-ups" ON public.follow_ups;
CREATE POLICY "Employees can view own follow-ups" ON public.follow_ups FOR SELECT USING (employee_id = public.current_employee_id());
DROP POLICY IF EXISTS "Employees can create follow-ups for themselves" ON public.follow_ups;
CREATE POLICY "Employees can create follow-ups for themselves" ON public.follow_ups FOR INSERT WITH CHECK (employee_id = public.current_employee_id());
DROP POLICY IF EXISTS "Employees can update own follow-ups" ON public.follow_ups;
CREATE POLICY "Employees can update own follow-ups" ON public.follow_ups FOR UPDATE USING (employee_id = public.current_employee_id()) WITH CHECK (employee_id = public.current_employee_id());

-- 7. ATTENDANCE TABLE
CREATE TABLE IF NOT EXISTS public.attendance (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id uuid NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  date date NOT NULL DEFAULT current_date,
  check_in timestamptz NOT NULL DEFAULT now(),
  check_out timestamptz,
  working_hours numeric(5,2),
  status text NOT NULL DEFAULT 'present' CHECK (status IN ('present', 'half_day', 'late', 'absent')),
  notes text,
  created_at timestamptz DEFAULT now(),
  UNIQUE (employee_id, date)
);

ALTER TABLE public.attendance ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Admins have full access to attendance" ON public.attendance;
CREATE POLICY "Admins have full access to attendance" ON public.attendance FOR ALL USING (public.is_admin());
DROP POLICY IF EXISTS "Employees can view own attendance records" ON public.attendance;
CREATE POLICY "Employees can view own attendance records" ON public.attendance FOR SELECT USING (employee_id = public.current_employee_id());
DROP POLICY IF EXISTS "Employees can punch in" ON public.attendance;
CREATE POLICY "Employees can punch in" ON public.attendance FOR INSERT WITH CHECK (employee_id = public.current_employee_id() AND date = current_date);
DROP POLICY IF EXISTS "Employees can punch out for current day" ON public.attendance;
CREATE POLICY "Employees can punch out for current day" ON public.attendance FOR UPDATE USING (employee_id = public.current_employee_id() AND date = current_date) WITH CHECK (employee_id = public.current_employee_id() AND date = current_date);

-- 8. LEAVE REQUESTS TABLE
CREATE TABLE IF NOT EXISTS public.leave_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id uuid NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  leave_type text NOT NULL CHECK (leave_type IN ('Casual Leave', 'Sick Leave', 'Paid Time Off', 'Emergency')),
  start_date date NOT NULL,
  end_date date NOT NULL,
  days_count integer NOT NULL DEFAULT 1,
  reason text NOT NULL,
  status text NOT NULL DEFAULT 'Pending' CHECK (status IN ('Pending', 'Approved', 'Rejected')),
  applied_at timestamptz DEFAULT now(),
  reviewed_by uuid REFERENCES auth.users(id),
  reviewed_at timestamptz,
  rejection_reason text
);

ALTER TABLE public.leave_requests ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Admins have full access to leave requests" ON public.leave_requests;
CREATE POLICY "Admins have full access to leave requests" ON public.leave_requests FOR ALL USING (public.is_admin());
DROP POLICY IF EXISTS "Employees can view own leave applications" ON public.leave_requests;
CREATE POLICY "Employees can view own leave applications" ON public.leave_requests FOR SELECT USING (employee_id = public.current_employee_id());
DROP POLICY IF EXISTS "Employees can submit leave requests" ON public.leave_requests;
CREATE POLICY "Employees can submit leave requests" ON public.leave_requests FOR INSERT WITH CHECK (employee_id = public.current_employee_id() AND status = 'Pending');

-- 9. NOTIFICATIONS TABLE
CREATE TABLE IF NOT EXISTS public.notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  recipient_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  recipient_role text CHECK (recipient_role IN ('admin', 'employee', 'all')),
  title text NOT NULL,
  message text NOT NULL,
  type text DEFAULT 'info',
  is_read boolean DEFAULT false,
  link text,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Admins can view and manage all notifications" ON public.notifications;
CREATE POLICY "Admins can view and manage all notifications" ON public.notifications FOR ALL USING (public.is_admin());
DROP POLICY IF EXISTS "Users can view own notifications" ON public.notifications;
CREATE POLICY "Users can view own notifications" ON public.notifications FOR SELECT USING (auth.uid() = recipient_id OR recipient_role = 'employee' OR recipient_role = 'all');
DROP POLICY IF EXISTS "Users can mark own notifications as read" ON public.notifications;
CREATE POLICY "Users can mark own notifications as read" ON public.notifications FOR UPDATE USING (auth.uid() = recipient_id OR public.is_admin());
DROP POLICY IF EXISTS "Authenticated users can create notifications" ON public.notifications;
CREATE POLICY "Authenticated users can create notifications" ON public.notifications FOR INSERT WITH CHECK (auth.role() = 'authenticated');

-- 10. CALLS TABLE
CREATE TABLE IF NOT EXISTS public.calls (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id uuid NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  lead_id uuid REFERENCES public.leads(id) ON DELETE SET NULL,
  client_name text NOT NULL,
  phone text NOT NULL,
  call_type text NOT NULL DEFAULT 'Outbound' CHECK (call_type IN ('Outbound', 'Inbound')),
  duration_seconds integer DEFAULT 0,
  outcome text NOT NULL DEFAULT 'Answered' CHECK (outcome IN ('Answered', 'Busy', 'No Answer', 'Wrong Number', 'Voicemail', 'Callback Requested')),
  notes text,
  follow_up_needed boolean DEFAULT false,
  follow_up_date date,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.calls ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Admins have full access to calls" ON public.calls;
CREATE POLICY "Admins have full access to calls" ON public.calls FOR ALL USING (public.is_admin());
DROP POLICY IF EXISTS "Employees can view own calls" ON public.calls;
CREATE POLICY "Employees can view own calls" ON public.calls FOR SELECT USING (employee_id = public.current_employee_id());
DROP POLICY IF EXISTS "Employees can log calls" ON public.calls;
CREATE POLICY "Employees can log calls" ON public.calls FOR INSERT WITH CHECK (employee_id = public.current_employee_id());

-- 11. TEAMS & MEMBERS
CREATE TABLE IF NOT EXISTS public.teams (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  department text DEFAULT 'Sales',
  leader_id uuid REFERENCES public.employees(id) ON DELETE SET NULL,
  target_monthly integer DEFAULT 50,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.team_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id uuid NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  employee_id uuid NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  joined_at timestamptz DEFAULT now(),
  UNIQUE (team_id, employee_id)
);

ALTER TABLE public.teams ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.team_members ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Admins have full access to teams" ON public.teams;
CREATE POLICY "Admins have full access to teams" ON public.teams FOR ALL USING (public.is_admin());
DROP POLICY IF EXISTS "Everyone can view teams" ON public.teams;
CREATE POLICY "Everyone can view teams" ON public.teams FOR SELECT USING (auth.role() = 'authenticated');
DROP POLICY IF EXISTS "Admins have full access to team members" ON public.team_members;
CREATE POLICY "Admins have full access to team members" ON public.team_members FOR ALL USING (public.is_admin());
DROP POLICY IF EXISTS "Everyone can view team members" ON public.team_members;
CREATE POLICY "Everyone can view team members" ON public.team_members FOR SELECT USING (auth.role() = 'authenticated');

-- 12. INVOICES & INVOICE ITEMS
CREATE TABLE IF NOT EXISTS public.invoices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_number text UNIQUE NOT NULL,
  from_name text NOT NULL DEFAULT 'kodefy INFO TECH',
  from_details text DEFAULT 'Coding Your Vision, Marketing Your Mission',
  bill_to text NOT NULL,
  ship_to text,
  date date NOT NULL DEFAULT current_date,
  payment_terms text DEFAULT 'Due on Receipt',
  due_date date,
  po_number text,
  notes text,
  terms text,
  subtotal numeric(12,2) NOT NULL DEFAULT 0,
  tax_rate numeric(5,2) DEFAULT 0,
  tax_amount numeric(12,2) DEFAULT 0,
  discount_amount numeric(12,2) DEFAULT 0,
  shipping_amount numeric(12,2) DEFAULT 0,
  total_amount numeric(12,2) NOT NULL DEFAULT 0,
  amount_paid numeric(12,2) DEFAULT 0,
  balance_due numeric(12,2) NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'Pending' CHECK (status IN ('Paid', 'Pending', 'Overdue', 'Cancelled')),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.invoice_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id uuid NOT NULL REFERENCES public.invoices(id) ON DELETE CASCADE,
  description text NOT NULL,
  quantity numeric(10,2) NOT NULL DEFAULT 1,
  rate numeric(12,2) NOT NULL DEFAULT 0,
  amount numeric(12,2) NOT NULL DEFAULT 0
);

ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invoice_items ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Admins have full access to invoices" ON public.invoices;
CREATE POLICY "Admins have full access to invoices" ON public.invoices FOR ALL USING (public.is_admin());
DROP POLICY IF EXISTS "Everyone can view invoices" ON public.invoices;
CREATE POLICY "Everyone can view invoices" ON public.invoices FOR SELECT USING (auth.role() = 'authenticated');
DROP POLICY IF EXISTS "Admins have full access to invoice items" ON public.invoice_items;
CREATE POLICY "Admins have full access to invoice items" ON public.invoice_items FOR ALL USING (public.is_admin());
DROP POLICY IF EXISTS "Everyone can view invoice items" ON public.invoice_items;
CREATE POLICY "Everyone can view invoice items" ON public.invoice_items FOR SELECT USING (auth.role() = 'authenticated');

-- 13. SALARIES & PAYSLIPS
CREATE TABLE IF NOT EXISTS public.salaries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id uuid NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE UNIQUE,
  payment_type text NOT NULL DEFAULT 'salary' CHECK (payment_type IN ('stipend', 'salary')),
  basic_amount numeric(12,2) NOT NULL DEFAULT 0,
  allowances numeric(12,2) DEFAULT 0,
  deductions numeric(12,2) DEFAULT 0,
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.payslips (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  payslip_number text UNIQUE NOT NULL,
  employee_id uuid NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  salary_month text NOT NULL,
  payment_type text NOT NULL DEFAULT 'salary',
  basic_amount numeric(12,2) NOT NULL,
  allowances numeric(12,2) DEFAULT 0,
  deductions numeric(12,2) DEFAULT 0,
  net_payable numeric(12,2) NOT NULL,
  payment_date date,
  payment_status text NOT NULL DEFAULT 'Pending' CHECK (payment_status IN ('Pending', 'Paid', 'Processing')),
  notes text,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.salaries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payslips ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Admins have full access to salaries" ON public.salaries;
CREATE POLICY "Admins have full access to salaries" ON public.salaries FOR ALL USING (public.is_admin());
DROP POLICY IF EXISTS "Employees can view own salary" ON public.salaries;
CREATE POLICY "Employees can view own salary" ON public.salaries FOR SELECT USING (employee_id = public.current_employee_id());
DROP POLICY IF EXISTS "Admins have full access to payslips" ON public.payslips;
CREATE POLICY "Admins have full access to payslips" ON public.payslips FOR ALL USING (public.is_admin());
DROP POLICY IF EXISTS "Employees can view own payslips" ON public.payslips;
CREATE POLICY "Employees can view own payslips" ON public.payslips FOR SELECT USING (employee_id = public.current_employee_id());

-- 14. PROJECTS
CREATE TABLE IF NOT EXISTS public.projects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  client text NOT NULL,
  status text NOT NULL DEFAULT 'Planning' CHECK (status IN ('Planning', 'In Progress', 'Review', 'Completed', 'On Hold')),
  budget numeric(12,2) DEFAULT 0,
  deadline date,
  progress integer DEFAULT 0 CHECK (progress BETWEEN 0 AND 100),
  description text,
  assigned_leader text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Admins have full access to projects" ON public.projects;
CREATE POLICY "Admins have full access to projects" ON public.projects FOR ALL USING (public.is_admin());
DROP POLICY IF EXISTS "Everyone can view projects" ON public.projects;
CREATE POLICY "Everyone can view projects" ON public.projects FOR SELECT USING (auth.role() = 'authenticated');



-- 15. WORKSPACE SETTINGS
CREATE TABLE IF NOT EXISTS public.workspace_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_name text NOT NULL DEFAULT 'Acme Enterprise CRM',
  support_email text NOT NULL DEFAULT 'support@acmecrm.com',
  phone text NOT NULL DEFAULT '+91 98000 12345',
  time_zone text NOT NULL DEFAULT 'Asia/Kolkata (IST +5:30)',
  two_factor_required boolean NOT NULL DEFAULT false,
  auto_password_rotation boolean NOT NULL DEFAULT true,
  email_alerts boolean NOT NULL DEFAULT true,
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE public.workspace_settings ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Admins have full access to workspace settings" ON public.workspace_settings;
CREATE POLICY "Admins have full access to workspace settings" ON public.workspace_settings FOR ALL USING (public.is_admin());
DROP POLICY IF EXISTS "Everyone can view workspace settings" ON public.workspace_settings;
CREATE POLICY "Everyone can view workspace settings" ON public.workspace_settings FOR SELECT USING (auth.role() = 'authenticated');
