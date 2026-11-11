# LedgerLine – Financial Account Management & Money-Transfer OS

[![License: ISC](https://img.shields.io/badge/License-ISC-blue.svg)](https://opensource.org/licenses/ISC)
[![Next.js](https://img.shields.io/badge/Next.js-16.4.6-black)](https://nextjs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0+-blue)](https://www.typescriptlang.org/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-17-336791)](https://www.postgresql.org/)
[![Tests](https://img.shields.io/badge/Tests-41%20Passed-brightgreen)](https://vitest.dev/)

**LedgerLine** is an enterprise-grade sovereign financial core banking platform and money-transfer operating system. Built with **Next.js (App Router)**, **TypeScript**, and **Supabase PostgreSQL**, LedgerLine enforces banking-grade mathematical integrity, double-entry bookkeeping, strict role-based access control (RBAC), and deterministic concurrency safety.

---

## 1. Project Overview & Core Philosophy

LedgerLine is engineered around five non-negotiable financial pillars:

1. **Strict Double-Entry Bookkeeping**: Every transaction generates balanced `DEBIT` and `CREDIT` records. The system invariant $\sum \text{Debits} \equiv \sum \text{Credits}$ is enforced at all times with zero mathematical drift.
2. **Cryptographic Immutability & Audit Trail**: Database-level triggers strictly forbid any `UPDATE` or `DELETE` on financial ledger entries and audit records. Historical entries can never be modified; errors can only be rectified via transparent, compensating reversal transactions.
3. **Deterministic Concurrency & Zero Overdrafts**: Transfers, deposits, withdrawals, and reversals run inside atomic PostgreSQL stored procedures with row-level locks (`SELECT ... FOR UPDATE`) ordered deterministically by UUID. This eliminates race conditions, deadlocks, and negative balances.
4. **Integer Paise Representation**: All balances, transaction amounts, and limits are stored and calculated as 64-bit integer paise (`BIGINT`, where 1 INR = 100 paise), eliminating floating-point rounding errors.
5. **Strict Role-Based Access Isolation**:
   - **Administrators (`ADMIN`)**: Full platform authority, identity provisioning, registration approvals, account freezes, and transaction reversals.
   - **Compliance Auditors (`AUDITOR`)**: Read-only forensic supervision, audit trails, security telemetry, and real-time double-entry invariant verification.
   - **Account Holders (`ACCOUNT_HOLDER`)**: Personal banking vaults, account creation, money transfers, deposit requests, and transaction history.

---

## 2. System Architecture

```mermaid
graph TD
    Client["Client UI (Next.js App Router / Stitch UI)"] --> API["Next.js Route Handlers (/api/v1/*)"]
    
    subgraph Security Layer
        API --> Auth["Authentication & Session Middleware (JWT / bcrypt)"]
        API --> RBAC["Role-Based Access Control (ADMIN / AUDITOR / HOLDER)"]
        API --> Idempotency["Idempotency Middleware (SHA-256 Key Cache)"]
    end
    
    subgraph Business Logic & Services
        Auth --> UserService["UserService (Provisioning & Lifecycle)"]
        Auth --> TxnService["TransactionService (Transfers & Deposits)"]
        Auth --> AuditService["AuditService (Immutable Event Logging)"]
        Auth --> AnomalyService["AnomalyDetector (Brute-Force & Velocity)"]
    end
    
    subgraph PostgreSQL Database (Supabase)
        TxnService --> StoredProcs["Atomic Stored Procedures (Row Locks FOR UPDATE)"]
        StoredProcs --> AccountsTable["accounts (CHECK balance_paise >= 0)"]
        StoredProcs --> TxnsTable["transactions"]
        StoredProcs --> LedgerTable["ledger_entries (DEBIT / CREDIT)"]
        StoredProcs --> Triggers["Immutability Triggers (Reject UPDATE/DELETE)"]
        AuditService --> AuditTable["audit_logs (Tamper-Resistant)"]
        UserService --> ProfilesTable["profiles"]
    end
```

---

## 3. Technology Stack

- **Frontend & Web Framework**: [Next.js 16.4.6](https://nextjs.org/) (App Router), [React 19](https://react.dev/), [Tailwind CSS v4](https://tailwindcss.com/)
- **Backend Runtime**: Node.js v20+ / TypeScript
- **Database Engine**: PostgreSQL 17 via [Supabase](https://supabase.com/)
- **Database Access & Connection Pooling**: `pg` (Node-Postgres Pool) with prepared statements
- **Security & Cryptography**: `bcryptjs` (password hashing), `jsonwebtoken` (JWT claims), `crypto` (SHA-256 idempotency hashing)
- **Data Validation**: [Zod v4](https://zod.dev/)
- **Testing Engine**: [Vitest](https://vitest.dev/) (Unit, Integration, Concurrency, and Security Suites)

---

## 4. Live Deployment & Local Endpoints

- **Local Application Server**: [http://localhost:3000](http://localhost:3000)
- **Network Interface**: `http://192.168.29.42:3000`
- **Supabase PostgreSQL Host**: `db.xyvfczrnrasbgsqjfpit.supabase.co:5432`
- **Hosted Production Deployment**: `http://localhost:3000` *(Enterprise Self-Hosted Deployment)*

---

## 5. Prerequisites & Environment Setup

### Prerequisites
- **Node.js**: v20.0.0 or higher
- **npm**: v10.0.0 or higher
- **PostgreSQL / Supabase**: Access to a PostgreSQL 15+ database instance

### Environment Variables (`.env.local`)
Create a `.env.local` file in the root directory:

```env
# Supabase PostgreSQL Database Connection
# URL-encode special characters in the password (e.g. @ becomes %40)
DATABASE_URL="postgresql://postgres:Akhil%401236%40vvit@db.xyvfczrnrasbgsqjfpit.supabase.co:5432/postgres"

# Supabase Project Credentials
NEXT_PUBLIC_SUPABASE_URL=https://xyvfczrnrasbgsqjfpit.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_KoX-2YuwJKWIIuQU7qi7fQ_K5O-K_wQ
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key

# Security & Session Configuration
JWT_SECRET=ledgerline-production-grade-jwt-secret-key-32chars
NODE_ENV=development
PORT=3000
```

---

## 6. Installation & Initialization

Follow these exact steps to set up and initialize the project:

```bash
# 1. Clone the repository
git clone <repository-url>
cd Sn_Final

# 2. Install dependencies
npm install

# 3. Apply database schema migrations, procedures, and triggers
npm run db:migrate

# 4. Seed demo users, bank accounts, and initial double-entry ledgers
npm run db:seed

# 5. Verify system mathematical balance & ledger integrity
npm run integrity:verify
```

---

## 7. Running Instructions

### Development Mode
Starts the Next.js development server with Turbopack/Webpack hot reloading:
```bash
npm run dev
```

### Production Build & Execution
Builds the optimized production bundle and starts the production server:
```bash
# Build the application
npm run build

# Start the production server on port 3000
npm start
```

### Automated Testing
Runs the comprehensive Vitest test suite against unit, integration, and security suites:
```bash
npm test
```

---

## 8. Demo Credentials & Test Users

The database seeding script (`scripts/seed.mjs`) provisions pre-configured personas across all 3 roles:

| Persona | Role | Email | Password | Initial Balance | Description |
|---|---|---|---|---|---|
| **System Administrator** | `ADMIN` | `admin@ledgerline.com` | `Admin@123456` | N/A | Full administrative authority, user provisioning, registration approvals, account freezes, deposit approvals, and transaction reversals. |
| **Senior Financial Auditor** | `AUDITOR` | `auditor@ledgerline.com` | `Auditor@123456` | N/A | Read-only compliance access, immutable audit trails, anomaly triage, and mathematical double-entry balance verification. |
| **Alice Sharma** | `ACCOUNT_HOLDER` | `alice@example.com` | `Password@123456` | ₹1,00,000.00 | Primary banking client with active savings account (`LL-SAV-10001001`). |
| **Bob Patel** | `ACCOUNT_HOLDER` | `bob@example.com` | `Password@123456` | ₹50,000.00 | Operational client with active checking account (`LL-CHK-10001002`). |
| **Carol Danvers** | `ACCOUNT_HOLDER` | `carol@example.com` | `Password@123456` | ₹25,000.00 | Operational client with active savings account (`LL-SAV-10001003`). |

---

## 9. Key Features & Workflows

### 1. Administrative Identity Provisioning
Administrators can directly add and activate new accounts from `/admin/users`:
- Create **Admins**, **Auditors**, or **Account Holders** directly.
- Provisioned users receive immediate `ACTIVE` status without waiting for approval.
- Account Holders are automatically provisioned with an initial sovereign `SAVINGS` bank account.

### 2. User Registration Approval Queue
Public registrations via `/register` default to `PENDING` status:
- New registrants cannot log in or transfer money until vetted.
- Administrators review pending applicants in the User Directory with one-click **Approve** or **Reject** actions.

### 3. Deposit Request & Dual-Control Approval
- Account holders initiate deposit requests specifying the target vault and amount.
- Deposits remain in `PENDING` status in the Administrator's liquidity queue.
- Once approved by an Admin, the funds are deposited atomically into the user's account and balanced against central reserve liabilities.

### 4. Atomic Money Transfers & Idempotency
- Transfers validate both account existence, sender ownership, and sufficient available balance.
- Deterministic locking prevents double-spending even under high-concurrency race condition attacks.
- Clients can submit an `Idempotency-Key` header; duplicated requests return the cached response without duplicate execution.

### 5. Double-Entry Integrity Scale & Continuous Audit
- Real-time attestation at `/auditor/integrity` calculates $\sum \text{Debits} - \sum \text{Credits}$.
- Any imbalance triggers an immediate critical anomaly alert.
- Database triggers strictly block `DELETE` or `UPDATE` queries on `ledger_entries`.

---

## 10. REST API Specification Summary

All endpoints return structured JSON with consistent envelopes:

```json
{
  "success": true,
  "message": "Operation description",
  "data": { ... },
  "timestamp": "2026-11-11T21:00:00.000Z"
}
```

### Core Endpoints:
- `POST /api/v1/auth/login`: Authenticate and receive 24h JWT session.
- `POST /api/v1/auth/register`: Public registration (enters `PENDING` queue).
- `GET /api/v1/users`: List system identities (`ADMIN`, `AUDITOR`).
- `POST /api/v1/users`: Direct identity provisioning (`ADMIN` only).
- `PATCH /api/v1/users/:id`: Approve, suspend, or reactivate user accounts.
- `GET /api/v1/accounts`: Retrieve authenticated user's or all accounts.
- `POST /api/v1/accounts`: Open new savings/checking account.
- `POST /api/v1/accounts/:id/freeze`: Freeze account with justification (`ADMIN` only).
- `POST /api/v1/transactions/transfer`: Atomic money transfer with idempotency key.
- `POST /api/v1/transactions/:id/reverse`: Reverse transaction with compensating entries (`ADMIN` only).
- `GET /api/v1/audit-logs`: Query immutable audit trail (`ADMIN`, `AUDITOR`).
- `POST /api/v1/integrity/verify`: Run full database invariant mathematical audit.

---

## 11. Test Evidence Summary

LedgerLine features 41 automated tests in 11 test suites:
- `tests/integration/transactions.test.ts` (6 tests)
- `tests/integration/auth.test.ts` (5 tests)
- `tests/security/rls-authorization.test.ts` (4 tests)
- `tests/integration/reversals.test.ts` (3 tests)
- `tests/integration/ledger-double-entry.test.ts` (4 tests)
- `tests/integration/accounts.test.ts` (4 tests)
- `tests/integration/concurrency.test.ts` (2 tests)
- `tests/security/idempotency.test.ts` (3 tests)
- `tests/unit/currency.test.ts` (4 tests)
- `tests/unit/validation.test.ts` (2 tests)
- `tests/unit/permissions.test.ts` (4 tests)

Run the test suite anytime:
```bash
npm test
```
