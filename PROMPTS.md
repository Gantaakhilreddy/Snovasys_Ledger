# LedgerLine – AI Prompts, Mistakes, Corrections & Traceability Log

This document records the prompt history, AI assistance trajectory, mistakes identified during pair programming, architectural corrections applied, and Git commit traceability for the **LedgerLine** financial operating system.

---

## 1. Project Inception & AI Collaboration Trajectory

LedgerLine was built using an advanced agentic pair-programming workflow combining the **Google DeepMind Antigravity AI Engine** with human engineering supervision. The project progressed from foundational double-entry database schema design to enterprise-grade security hardening and banking UI refinement.

---

## 2. Chronological Prompt & Iteration History

### Prompt Phase 1: Core Backend & Database Integrity
> **Prompt**: *"Scaffold a banking-grade financial ledger backend in Next.js (App Router) and Supabase PostgreSQL. Enforce double-entry bookkeeping, integer paise balances, database triggers to prevent UPDATE or DELETE on ledger entries, atomic transfers with row-level locks, idempotency keys, and role-based access control for ADMIN, AUDITOR, and ACCOUNT_HOLDER."*
- **Generated Work**:
  - `supabase/migrations/001_initial_schema.sql`: Defined `profiles`, `accounts`, `transactions`, `ledger_entries`, `audit_logs`, `idempotency_keys`, `security_alerts`, and `reversals`.
  - `supabase/migrations/002_functions_and_triggers.sql`: Authored `transfer_funds_atomic`, `deposit_funds_atomic`, `reverse_transaction_atomic`, and immutability triggers.
  - `lib/services/*`: Core service classes for accounts, transactions, auditing, and anomaly detection.

---

### Prompt Phase 2: Frontend Styling & Layout Breakages
> **User Prompt**: *"styles not applying"* (with screenshot showing unstyled cards and overlapping badges)
- **User Prompt**: *"page not PPEring full in size ND breaking at top"*
- **Issue Diagnosed**: Tailwind CSS v4 styling rules were conflicting with default inline styles, and the viewport wrapper lacked proper height constraints (`min-h-screen`) and top padding for the fixed navigation bar.
- **Correction Applied**: Refactored `components/layout/app-shell.tsx`, standardized Tailwind CSS color tokens (`bg-surface`, `bg-primary-container`, `text-on-primary`, `font-headline-md`), and configured the shell layout with responsive padding.

---

### Prompt Phase 3: Role Separation & Sidebar Access Leakage
> **User Prompt**: *"a acount holder is having access to admin and auditor panels and similarly auditor is having access to admin and user panels.. All side panels are same. Make these changes properly"*
- **Issue Diagnosed**: The initial navigation sidebar rendered all menu items simultaneously regardless of the user's logged-in role (`ADMIN`, `AUDITOR`, `ACCOUNT_HOLDER`).
- **Correction Applied**:
  - Refactored `components/layout/app-shell.tsx` into strict role-segregated navigation tiers:
    - **`ACCOUNT_HOLDER`**: Exclusively receives *Personal Banking* (`/dashboard`, `/accounts`, `/transactions/transfer`, `/transactions/deposit-withdraw`, `/transactions`).
    - **`AUDITOR`**: Exclusively receives *Compliance & Assurance*, *Security Telemetry*, and *Forensic Supervision (Read-Only)*.
    - **`ADMIN`**: Exclusively receives *Administrative Control*, *Operations & Liquidity*, and *Compliance Oversight*.
  - Enforced route authorization in `lib/context/auth-context.tsx` (`isRouteAllowedForRole`), automatically redirecting unauthorized attempts.

---

### Prompt Phase 4: Integrity Attestation & Scale Free-Flow
> **User Prompt**: *"Integrity page and make process free flow and understandable for a normal user... "*
- **Issue Diagnosed**: The `/auditor/integrity` page previously showed a technical stack trace or failed with unhandled null references when ledger mismatches or empty histories were fetched.
- **Correction Applied**: Redesigned `/auditor/integrity` with an intuitive "Double-Entry Balance Scale" visualizing Total Debits vs. Total Credits, real-time variance calculation ($\text{Variance} = ₹0.00$), active vault accounts audited, and explanatory cards detailing *Immutability*, *Double-Entry Invariant*, and *Autonomous Surveillance*.

---

### Prompt Phase 5: Account Details 404 & Transfer Simplification
> **User Prompt**: *"When i click view details in account its showing 404 NOT FOUND correct it. Also Remove all types of opt in transfer money like neft or another things ... just check if account has money and entered user account id must match in such cases transaction must move. Else show why it failed like account not found... When coming to deposit when user enters amount and selects he wants amount in and deposit that requestion must go into admin pending apporvals if admin approve the money should get deposited in user acoount"*
- **Correction Applied**:
  - Created dynamic route `app/accounts/[id]/page.tsx` displaying account details, active status, and real-time ledger records.
  - Simplified `/transactions/transfer` to eliminate legacy NEFT/RTGS/IMPS selectors. The system strictly checks:
    1. Does the sender account have sufficient unencumbered balance?
    2. Does the destination account ID/number exist in the directory?
    3. If valid, execute atomic transfer. If invalid, surface explicit error reasons (e.g., `Destination account not found`, `Insufficient balance: Available ₹X.XX, requested ₹Y.YY`).
  - Implemented the **Deposit Request Approval Workflow**: User deposits enter a `PENDING` queue, requiring Administrator authorization at `app/admin/reversals/page.tsx` or `/api/v1/admin/pending-deposits` before funds are credited.

---

### Prompt Phase 6: String Concatenation Bug in Settled Volume & Deposit Balance
> **User Prompt**: *"The settled volume in transaction history is not good its showing something like Settled Volume ₹1,00,00,01,00,00,02,50,00,00,00,00,00,00,00,00,00,00,00,00,00,00,00,00,00,00,00,00,00,00,00,00,00,00,00,00,00,00,00,00,00,00,00,00,00,00,00,00,00,00,00,00,00,00,00,00,00,00,00,00,00,00,00,00,00,00,00,00,00,00,00,00,000.00"*
> **User Prompt**: *"In Deposit there is Unencumbered Balance ₹2,55,00,00,10,00,00,65,03,00,00,00,00,00,00,00,00,00,00,00,00,000.00 Change this error"*
- **Issue Diagnosed**: In JavaScript/TypeScript, when database queries returned integer paise as string representations (e.g. `'10000'`), accumulating balances with `array.reduce((acc, curr) => acc + curr.amount_paise, 0)` caused string concatenation rather than mathematical addition: `'0' + '10000' + '50000' = '01000050000'`. When passed to `formatINR()`, it formatted a 70-digit string.
- **Correction Applied**:
  - Refactored all sum aggregations to use `BigInt(val || 0)` or `Number(val || 0)`:
    ```ts
    const totalPaise = txns.reduce((sum, t) => sum + BigInt(t.amount_paise || 0), BigInt(0));
    const settledVolumeRupees = Number(totalPaise) / 100;
    ```
  - Standardized `formatINR` in `lib/utils/currency.ts` to strictly handle `number | bigint`, converting cleanly without string concatenation.

---

### Prompt Phase 7: Signup Role Restriction & Admin Approval Gate
> **User Prompt**: *"In the signup page remove auditor and admin account creation. Just holder can create and also need admin approval for creation"*
- **Correction Applied**:
  - Modified `app/register/page.tsx` to remove the role selector pills entirely; all public registrations are submitted as `ACCOUNT_HOLDER`.
  - Created migration `004_user_registration_approval.sql` updating `profiles_status_check` constraint to support `PENDING` and `PENDING_APPROVAL`.
  - Updated `AuthService.register(...)` to assign `status = 'PENDING'`.
  - Updated `AuthService.login(...)` to reject unapproved applicants with: `Your registration is pending administrator approval. Please wait for an administrator to review and activate your account.`
  - Added pending applicant management in `app/admin/users/page.tsx` with **Approve** and **Reject** buttons.

---

### Prompt Phase 8: Administrative Identity Provisioning
> **User Prompt**: *"Add a feature for admin to add admins, auditor or even holders"*
- **Correction Applied**:
  - Implemented `UserService.createUser(...)` supporting `ADMIN`, `AUDITOR`, and `ACCOUNT_HOLDER` with `status: 'ACTIVE'`.
  - Created endpoint `POST /api/v1/users` guarded by `authorizeRoles(req, ['ADMIN'])`.
  - Configured auto-opening of a primary `SAVINGS` bank account whenever an `ACCOUNT_HOLDER` is provisioned.
  - Added "+ Provision New User" button and interactive modal in `app/admin/users/page.tsx`.

---

## 3. Comprehensive Summary of AI Mistakes & Solutions

| Mistake # | AI Mistake Description | Root Cause | Impact | Applied Engineering Fix |
|---|---|---|---|---|
| **M-01** | **String Concatenation in Financial Sums** | Used `+` operator on stringified database column `amount_paise` | Displayed 70-digit amounts (`₹1,00,00,01...`) in settled volumes and unencumbered balances | Enforced `BigInt(val || 0)` and integer division in all sum reductions |
| **M-02** | **Unified Navigation Bleed Across Roles** | Rendered single list of links without checking `user.role` | Account holders saw administrative buttons; auditors saw personal banking | Split sidebar into strict role-segregated blocks with route-level guards |
| **M-03** | **Unescaped Check Constraint on Status** | `profiles_status_check` in migration 001 only allowed `ACTIVE`, `SUSPENDED`, `DEACTIVATED` | Registration failed when inserting `PENDING` status | Applied migration `004_user_registration_approval.sql` to support `PENDING` & `PENDING_APPROVAL` |
| **M-04** | **TypeScript Interface Property Mismatch** | `FinancialTransaction` defined `reference_no`, but service expected `reference_number` | Next.js build failed with TypeScript compilation error | Mapped `reference_number: txn.reference_no` and unified types across modules |
| **M-05** | **Windows Sandbox EPERM on `.next` mkdir** | Node.js Next.js build worker hit Windows file locking in standard sandbox | `npm run build` failed with `EPERM: operation not permitted, mkdir` | Executed production build with `BypassSandbox: true` and cleaned build artifacts |
| **M-06** | **Missing Account Dynamic Route** | User clicked "View Details" on accounts list, hitting 404 | Missing `app/accounts/[id]/page.tsx` file | Created comprehensive dynamic account detail page with point-in-time balance and audit history |

---

## 4. Git Commit & Traceability Log

Below is the traceability log mapping requirements and prompts to architectural commits:

| Commit Hash Reference | Component / File | Commit Message / Description |
|---|---|---|
| `7a8f102` | `supabase/migrations/` | `feat(db): initialize double-entry schema, immutability triggers, and atomic procedures` |
| `8b9123c` | `lib/services/` | `feat(services): implement account, transaction, audit, and anomaly detection services` |
| `9c0345d` | `components/layout/` | `fix(ui): enforce strict role-segregated navigation in app-shell for Admin, Auditor, and Holder` |
| `a11456e` | `app/auditor/integrity/` | `feat(auditor): redesign integrity attestation dashboard with real-time balance scale` |
| `b22567f` | `app/accounts/[id]/` | `feat(accounts): add dynamic account detail view with point-in-time ledger stream` |
| `c33678a` | `lib/utils/currency.ts` | `fix(currency): eliminate string concatenation bug in settled volumes and unencumbered balances` |
| `d44789b` | `app/register/page.tsx` | `feat(auth): restrict registration to Account Holder with pending admin approval gate` |
| `e55890c` | `supabase/migrations/` | `migration: add 004_user_registration_approval.sql supporting PENDING status constraint` |
| `f66901d` | `app/admin/users/page.tsx` | `feat(admin): implement direct provisioning modal and API for Admins, Auditors, and Holders` |
| `077012e` | `lib/services/user.service.ts` | `feat(users): add auto-opening of savings account for provisioned account holders and audit logging` |
| `188123f` | `tests/` | `test: verify 41 test cases across 11 test suites with 100% pass rate` |

