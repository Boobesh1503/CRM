# Enterprise CRM & Workforce Operations Platform

<div align="center">

![React](https://img.shields.io/badge/React-19.3.1-blue?style=for-the-badge&logo=react)
![TypeScript](https://img.shields.io/badge/TypeScript-5.9-blue?style=for-the-badge&logo=typescript)
![Vite](https://img.shields.io/badge/Vite-8.3.8-646CFF?style=for-the-badge&logo=vite)
![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-v4.3-38B2AC?style=for-the-badge&logo=tailwind-css)
![Supabase](https://img.shields.io/badge/Supabase-PostgreSQL-3ECF8E?style=for-the-badge&logo=supabase)
![pnpm](https://img.shields.io/badge/pnpm-Workspace-F69220?style=for-the-badge&logo=pnpm)
![License](https://img.shields.io/badge/License-MIT-green?style=for-the-badge)

**A high-performance, full-stack enterprise CRM, telemarketing management, and workforce operations suite.**

[Live Demo](#deployment) • [Key Features](#-key-features) • [Tech Stack](#-tech-stack) • [Quick Start](#-quick-start-guide) • [Architecture](#-system-architecture) • [Database](#-database-schema)

</div>

---

## 🌟 Executive Summary

Traditional commercial CRMs are often cost-prohibitive, complex, and lack integrated workforce payroll, regional Excel ingestion, and role-based telemarketing tracking out-of-the-box.

This **Enterprise CRM Platform** unifies end-to-end sales operations, high-volume lead pipelines, team performance analytics, client invoicing, and automated workforce payroll into a single, cohesive web application. It features a dual-workspace architecture:
1. **Executive Admin Suite**: 12 comprehensive operational modules for business managers.
2. **Employee Self-Service Portal (`/portal`)**: A focused workspace for sales reps, team leaders, and interns.

---

## 🚀 Key Features

### 🏢 12 Executive Admin Modules

| # | Module | Core Functionality |
|---|---|---|
| **01** | **Dashboard** | Real-time KPI counters, today's live checked-in attendance roster, visual pipeline distribution bar charts, and live activity feed. |
| **02** | **Workforce Roster** | Tabbed segregation between **Interns** and **Team Leaders (TL)**, direct password reset modal (zero-email mode), account activation, and profile management. |
| **03** | **Teams Management** | Squad creation, assigning Team Leaders to teams, and tracking aggregate pipeline metrics per squad. |
| **04** | **Leads & Pipeline** | **Smart Excel/CSV Importer** with dynamic header detection, duplicate phone filtering, RFC UUID sanitization, 20/page pagination, and bulk representative assignment. |
| **05** | **Call Activities** | Logging Outbound/Inbound calls with duration and outcomes (`Answered`, `Busy`, `Callback`, etc.), date-range quick filters (`1D` to `1Y`), and per-rep call history modals. |
| **06** | **Follow-ups** | Real-time tracking of pending, due today, and overdue follow-ups, with rep accountability completion scoring. |
| **07** | **Finance & Invoices** | Itemized invoice generator with auto-calculated GST totals, month-by-month accounting, and print-ready PDF export. |
| **08** | **Leave Requests** | Administrative approval workflow for leave requests, with real-time status sync to employee portals and rejection reason capture. |
| **09** | **Reports & Analytics** | Visual pipeline stage visualizers, call outcome distribution donut charts, and one-click CSV report exports. |
| **10** | **Projects** | Client project lifecycle management, milestones, budget allocation, expense tracking, and interactive progress sliders. |
| **11** | **Attendance Reports** | Dedicated monthly attendance auditing showing working days, present days, half-days, leaves, and daily timestamp audit modals. |
| **12** | **Salary & Stipends** | Automated compensation calculation: fixed monthly stipends for interns and base salary + allowances - deductions for team leaders, with printable payslip generation. |

---

### 💼 Unified Employee Self-Service Portal (`/portal/*`)
- **Portal Dashboard**: Personalized daily target tracker, urgent follow-ups, and assigned lead counts.
- **My Assigned Leads**: Streamlined prospect pipeline restricted specifically to the logged-in agent.
- **Call Logger**: Quick-action form to record client conversations and schedule next callbacks.
- **Actionable Follow-ups**: Prioritized checklist of customer calls scheduled for today.
- **Daily Clock-In / Clock-Out**: Instant attendance check-in with live working hours timer and personal monthly log.
- **Leave Application**: Self-service leave request submission with live administrative review status.

---

### 🛡️ Core Highlights & Fault Tolerance
- **Dynamic Excel Ingestion**: Automatically detects headers within the first 25 rows regardless of file formatting or casing. Requires only **Name** and **Phone Number** (Company, Email, Value, and Notes are 100% optional).
- **Zero-Email Direct Password Reset**: Admins can reset employee passwords directly from the portal via an encrypted PostgreSQL stored function (`pgcrypto`), avoiding unwanted external reset emails.
- **Dual-Tier Resiliency Layer**: Queries live Supabase PostgreSQL tables and falls back to persistent local storage cache (`crm_admin_*_cache`) to guarantee zero crashes during offline demos or network drops.
- **Row Level Security (RLS)**: Enforces database-level isolation so reps can only view their own leads and logs.

---

## 🛠️ Tech Stack

### Frontend
- **Framework**: [React 19](https://react.dev/) + [Vite 8](https://vite.dev/)
- **Language**: [TypeScript 5.9](https://www.typescriptlang.org/)
- **Styling**: [Tailwind CSS v4](https://tailwindcss.com/)
- **State & Tables**: [TanStack Table v9](https://tanstack.com/table/latest) & React Context API
- **Visuals & Charts**: [Recharts](https://recharts.org/) & [Lucide React](https://lucide.dev/)
- **Spreadsheet Engine**: [SheetJS (XLSX)](https://sheetjs.com/)

### Backend & Cloud
- **Database**: [PostgreSQL 15](https://www.postgresql.org/) managed via [Supabase](https://supabase.com/)
- **Authentication**: Supabase GoTrue with secure JWT tokens and role guards
- **Security**: PostgreSQL Row Level Security (RLS) & `pgcrypto` Blowfish hashing
- **Package Manager**: [pnpm Workspaces](https://pnpm.io/workspaces) (Monorepo architecture)

---

## 📁 Project Directory Structure

```
CRM/
├── apps/
│   ├── admin-web/                      # Core Web Application (Admin + Employee Portal)
│   │   ├── dist/                       # Compiled production build output
│   │   ├── src/
│   │   │   ├── components/             # Reusable UI component library (Header, Sidebar, Guards)
│   │   │   ├── context/                # Global AuthContext & session management
│   │   │   ├── lib/                    # Supabase client, storage persistence, and utility helpers
│   │   │   ├── pages/
│   │   │   │   ├── dashboard/          # Module 1: KPI Dashboard
│   │   │   │   ├── employees/          # Module 2: Workforce Roster & Password Management
│   │   │   │   ├── teams/              # Module 3: Squad Organization
│   │   │   │   ├── leads/              # Module 4: Lead Management & Excel Import
│   │   │   │   ├── calls/              # Module 5: Call Logging & Filters
│   │   │   │   ├── followups/          # Module 6: Follow-up Scheduling
│   │   │   │   ├── finance/            # Module 7: Invoices & Billing
│   │   │   │   ├── leave-requests/     # Module 8: Leave Governance
│   │   │   │   ├── reports/            # Module 9: Analytics & Visual Charts
│   │   │   │   ├── projects/           # Module 10: Client Projects
│   │   │   │   ├── attendance-reports/ # Module 11: Attendance Auditing
│   │   │   │   ├── salary/             # Module 12: Stipend & Salary Payroll
│   │   │   │   └── portal/             # Employee Self-Service Views (Leads, Calls, Attendance...)
│   │   │   ├── types/                  # Centralized TypeScript definitions
│   │   │   ├── App.tsx                 # Master routing table
│   │   │   ├── index.css               # Tailwind CSS v4 directives
│   │   │   └── main.tsx                # React DOM entrypoint
│   │   ├── .env.example                # Template for web environment variables
│   │   ├── package.json                # Dependencies and web scripts
│   │   └── vercel.json                 # SPA rewrite rules
│   ├── employee-android/               # Native Android companion application
│   ├── employee-web/                   # Standalone employee web package
│   └── shared/                         # Shared utilities and validation schemas
├── supabase/
│   ├── migrations/
│   │   └── master_crm_setup.sql        # Single-run PostgreSQL schema migration script
│   └── config.toml                     # Supabase CLI configuration
├── .env.example                        # Root environment variables template
├── .gitignore                          # Git exclusions (node_modules, .env, dist)
├── package.json                        # Root monorepo workspace definition
├── pnpm-workspace.yaml                 # Monorepo configuration
└── README.md                           # Project documentation
```

---

## ⚡ Quick Start Guide

### Prerequisites
- **Node.js**: `v18.0.0` or higher
- **pnpm**: `v9.0.0` or higher (`npm install -g pnpm`)

### 1. Clone & Install Dependencies
```bash
# Clone the repository
git clone https://github.com/your-username/crm-enterprise.git

# Navigate to project root
cd crm-enterprise

# Install dependencies across all monorepo packages
pnpm install
```

### 2. Configure Environment Variables
Copy the example environment file in `apps/admin-web/`:
```bash
cp apps/admin-web/.env.example apps/admin-web/.env.local
```
Configure your Supabase credentials in `apps/admin-web/.env.local`:
```env
VITE_SUPABASE_URL=https://your-project-id.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-public-key
```

### 3. Initialize the Database
1. Open your [Supabase Dashboard](https://supabase.com/dashboard) and select your project.
2. Navigate to the **SQL Editor**.
3. Open `supabase/migrations/master_crm_setup.sql` from this repository.
4. Paste the SQL script and click **Run**. This provisions all tables, foreign keys, stored functions, and RLS policies in exact dependency order.

### 4. Run Development Server
```bash
pnpm web
```
The application will launch at:
- **Local**: `http://localhost:5173/`
- **Network**: Accessible across your LAN via your local IP.

---

## 🔧 Important Commands

| Command | Action |
|---|---|
| `pnpm install` | Installs dependencies across all workspaces using hard links. |
| `pnpm web` | Runs the Vite local development server on port `5173`. |
| `pnpm web:build` | Compiles TypeScript (`tsc -b`) and bundles production assets into `dist/`. |
| `pnpm typecheck` | Validates strict type checking across the entire codebase. |
| `pnpm lint` | Runs code quality and linting verification. |

---

## 🏗️ System Architecture

```
                      +---------------------------------------+
                      |             CLIENT TIER               |
                      |  React 19 + TypeScript + TailwindCSS  |
                      +-------------------+-------------------+
                                          |
                                          | Supabase JS Client (REST / WSS)
                                          v
                      +---------------------------------------+
                      |           SUPABASE BACKEND            |
                      |  - GoTrue Authentication (JWT)        |
                      |  - PostgreSQL 15 Engine               |
                      |  - Row Level Security (RLS)           |
                      |  - Stored Procedures & pgcrypto       |
                      +-------------------+-------------------+
                                          |
                      +-------------------v-------------------+
                      |         FAILOVER FALLBACK             |
                      |  Persistent Browser LocalStorage      |
                      |  `crm_admin_*_cache` for Offline Demo |
                      +---------------------------------------+
```

---

## 🗄️ Database Schema

The platform relies on normalized PostgreSQL tables with foreign key constraints:
- `employees`: Core workforce records with roles (`admin`, `team_leader`, `intern`, `sales_rep`).
- `leads`: Client pipeline records with phone, company, deal value, stage, and assigned rep.
- `teams`: Organizational sales squads with designated leaders.
- `calls`: Telemarketing call logs with outcome classifications, timestamps, and duration.
- `follow_ups`: Scheduled client follow-ups with priority and completion states.
- `attendance`: Daily clock-in/out records with working hours and status tracking.
- `leave_requests`: Employee leave applications with administrative review states.
- `invoices`: Financial records with itemized billing, GST tax calculation, and payment status.
- `salaries` & `payslips`: Monthly stipend/salary configurations and generated payslip records.

---

## 🚀 Deployment

### Deploying to Vercel
1. Push your repository to GitHub.
2. Import the project into [Vercel](https://vercel.com/).
3. In Project Settings:
   - **Framework Preset**: `Vite`
   - **Root Directory**: `apps/admin-web`
   - **Build Command**: `pnpm build`
   - **Output Directory**: `dist`
4. Add the environment variables:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
5. Click **Deploy**. SPA URL rewrites are automatically handled by `apps/admin-web/vercel.json`.

---

## 📄 License
This project is licensed under the [MIT License](LICENSE).

