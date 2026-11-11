# LedgerLine – Threat Model, Attack Vectors & Security Mitigations

This document outlines the security architecture, threat model, potential attack vectors, mitigations, test verification evidence, and accepted residual risks for the **LedgerLine** financial operating system.

---

## 1. Threat Modeling Methodology: STRIDE Matrix

LedgerLine operates in an adversarial environment where financial assets, regulatory audit trails, and user identities are high-value targets. We employ Microsoft's **STRIDE** methodology to systematically evaluate risks:

| STRIDE Category | Financial System Risk | Primary Defense Layer |
|---|---|---|
| **Spoofing** | Attacker impersonates an Account Holder, Auditor, or Administrator to perform illicit transfers or modify permissions. | Bcrypt (salt rounds 10), JWT with 24h expiration, cryptographic signatures, account lockout after 5 failed attempts. |
| **Tampering** | Rogue actor or compromised DB administrator modifies historical ledger rows, updates account balances directly, or deletes audit logs. | PostgreSQL database-level immutability triggers (`BEFORE UPDATE OR DELETE`), row-level `CHECK (balance_paise >= 0)`. |
| **Repudiation** | User claims they did not authorize a transfer, or an administrator denies freezing an account or reversing a transfer. | Append-only `audit_logs` capturing user ID, IP address, user agent, timestamps, old/new state snapshots, and idempotency keys. |
| **Information Disclosure** | Cross-tenant data leakage: Account Holder Alice reads Bob's account balance, ledger history, or bank statements (BOLA / IDOR). | Role-Based Access Control (RBAC) middleware, user ownership verification, and PostgreSQL Row Level Security (RLS). |
| **Denial of Service** | High-velocity transaction flooding, concurrent race condition deadlock attacks, or database connection exhaustion. | Deterministic row-locking order (UUID sorting), in-memory rate limiting, connection pooling (`pg.Pool`), and integer-only arithmetic. |
| **Elevation of Privilege** | An account holder registers as `ADMIN` or an auditor elevates their own permissions to authorize fund deposits. | Hardcoded registration roles, dual-control approval queues, and `authorizeRoles(req, ['ADMIN'])` server-side guards. |

---

## 2. In-Depth Attack Vectors, Mitigations & Test Evidence

### Threat 1: Concurrency Race Condition / Double-Spending Attack
- **Attack Scenario**: An attacker possesses an account with a balance of ₹10,000 (10,00,000 paise). The attacker sends 5 simultaneous transfer requests of ₹10,000 each in parallel threads within a 5-millisecond window, aiming to exploit the read-modify-write gap and overdraw ₹40,000 before the balance update commits.
- **Impact**: Critical financial loss, unbacked liquidity creation, negative account balance, ledger imbalance.
- **Implemented Mitigation**:
  1. All fund transfers execute inside the atomic PostgreSQL stored procedure `transfer_funds_atomic(...)`.
  2. The procedure locks both the source and destination account rows using `SELECT ... FOR UPDATE`.
  3. **Deterministic Deadlock Prevention**: The locks are acquired in strictly sorted alphabetical order of their UUIDs (`IF p_source_account_id < p_dest_account_id ...`).
  4. The available balance is validated *after* the exclusive row lock is acquired.
  5. The `accounts` table enforces a database-level constraint: `CONSTRAINT accounts_balance_check CHECK (balance_paise >= 0)`.
- **Test Evidence**:
  - `tests/integration/concurrency.test.ts`: Simulates concurrent transfers using `Promise.all` across multiple parallel clients.
  - Result: Only the first transfer succeeds; all concurrent attempts are safely rejected with `Insufficient balance: Available 10000 paise, requested deduction 30000 paise`. Zero negative balance or race condition occurs.

---

### Threat 2: Network Replay Attack & Duplicate Payment Submission
- **Attack Scenario**: A user initiates a ₹50,000 transfer. Due to a mobile network timeout, the client's HTTP client or an attacker replays the exact same `POST /api/v1/transactions/transfer` HTTP request 10 seconds later.
- **Impact**: User gets billed twice; recipient receives duplicate funds.
- **Implemented Mitigation**:
  1. Financial mutation endpoints require or accept a client-generated `Idempotency-Key` HTTP header (UUID v4).
  2. The server computes a SHA-256 hash of the request method, URL path, and JSON payload.
  3. If the key exists with `status = 'COMPLETED'`, the middleware immediately short-circuits and returns the cached HTTP response payload.
  4. If the key is currently `PROCESSING`, subsequent requests receive `409 Conflict`.
- **Test Evidence**:
  - `tests/security/idempotency.test.ts`: Tests replay of identical requests with the same idempotency key.
  - Result: The first request processes the transfer; the replayed request returns the identical transaction reference and cached response without creating a second ledger entry.

---

### Threat 3: Direct Database Tampering & Ledger History Erasure
- **Attack Scenario**: A malicious actor gains direct SQL access (e.g. via compromised credentials or SQL injection) and executes `UPDATE ledger_entries SET amount_paise = 0 WHERE ...` or `DELETE FROM audit_logs WHERE ...` to cover up illicit activity.
- **Impact**: Breakdown of regulatory compliance (SOX / SOC-2), irreversible loss of auditability, inability to reconcile sovereign reserves.
- **Implemented Mitigation**:
  1. PostgreSQL triggers `trg_enforce_ledger_immutability` and `trg_enforce_audit_immutability` are attached to `ledger_entries` and `audit_logs` respectively:
     ```sql
     CREATE OR REPLACE FUNCTION trg_enforce_ledger_immutability()
     RETURNS TRIGGER AS $$
     BEGIN
       RAISE EXCEPTION 'Financial ledger entries are strictly immutable and cannot be modified or deleted. (Entry ID: %)', OLD.id;
     END;
     $$ LANGUAGE plpgsql;
     ```
  2. Any `UPDATE` or `DELETE` statement triggers an immediate exception and aborts the surrounding transaction.
- **Test Evidence**:
  - `tests/integration/ledger-double-entry.test.ts`: Executes explicit `UPDATE` and `DELETE` queries on `ledger_entries`.
  - Result: Both queries are rejected with `PL/pgSQL function trg_enforce_ledger_immutability() line 3 at RAISE: Financial ledger entries are strictly immutable and cannot be modified or deleted`.

---

### Threat 4: Broken Object Level Authorization (BOLA / IDOR)
- **Attack Scenario**: Alice Sharma (`ACCOUNT_HOLDER`) logs in, observes account ID `b948520e-...` belonging to Bob Patel, and attempts to initiate a transfer using Bob's account ID as the source (`POST /api/v1/transactions/transfer` with `sourceAccountId: bobAccId`).
- **Impact**: Unauthorized asset theft across distinct client accounts.
- **Implemented Mitigation**:
  1. Application-level authorization verifies that the authenticated user (`req.user.id`) is the verified owner of the source account before invoking transfer logic:
     ```ts
     if (userRole === 'ACCOUNT_HOLDER' && sourceAccount.user_id !== userId) {
       throw new Error('Forbidden: You do not own the source account.');
     }
     ```
  2. Supabase Row Level Security (RLS) policies restrict `SELECT` and `UPDATE` on `accounts` to the account owner (`auth.uid() = user_id`) unless the actor has role `ADMIN` or `AUDITOR`.
- **Test Evidence**:
  - `tests/security/rls-authorization.test.ts`: Tests Alice attempting to query Bob's account balance and transfer funds out of Bob's account.
  - Result: Both requests fail with `403 Forbidden: You do not have permission to access this account`.

---

### Threat 5: Privilege Escalation via Public Registration
- **Attack Scenario**: An attacker submits a `POST /api/v1/auth/register` payload with `"role": "ADMIN"` or `"role": "AUDITOR"` to self-grant administrator rights.
- **Impact**: Complete platform compromise, arbitrary account freezes, unauthorized balance manipulation.
- **Implemented Mitigation**:
  1. The public registration schema hardcodes `role = 'ACCOUNT_HOLDER'` and `status = 'PENDING'`. Any input role is ignored.
  2. New registrants cannot log in until an existing Administrator reviews and approves their identity in the Admin User Directory.
  3. Elevated role assignment (`ADMIN` or `AUDITOR`) can only be performed by an existing Administrator via `POST /api/v1/users` or `PATCH /api/v1/users/:id/role`.
- **Test Evidence**:
  - `tests/integration/auth.test.ts`: Verifies public registration creates users in `PENDING` status.
  - Integration verification script: Verifies that Auditors attempting `POST /api/v1/users` receive `403 Forbidden`.

---

### Threat 6: Unauthorized Deposit Injection / Phantom Money Creation
- **Attack Scenario**: An account holder calls `POST /api/v1/transactions/deposit` claiming they deposited ₹10,00,000, attempting to inflate their balance without transferring fiat.
- **Impact**: Unbacked currency creation, central reserve deficit.
- **Implemented Mitigation**:
  1. Account holders cannot execute deposits directly. User deposit submissions are routed to the **Deposit Request Approval Queue** (`admin_pending_deposits`).
  2. Only verified `ADMIN` users can approve deposits after verifying bank settlement receipts.
  3. Every deposit creates equal and opposite double-entry ledger entries: `CREDIT` to the user's account and `DEBIT` to the platform's Central Reserve liability vault (`LL-RES-RESERVE-001`).
- **Test Evidence**:
  - `tests/integration/transactions.test.ts`: Confirms deposits require Administrator credentials and generate balanced double-entry ledger rows.

---

### Threat 7: Asymmetric Reversals & Double-Reversals
- **Attack Scenario**: An administrator reverses a transfer, and an attacker attempts to replay the reversal request to credit the sender a second time while deducting from the recipient again.
- **Impact**: Asset duplication and ledger imbalance.
- **Implemented Mitigation**:
  1. The stored procedure `reverse_transaction_atomic` checks `SELECT status FROM transactions WHERE id = p_original_transaction_id FOR UPDATE`.
  2. If `status != 'COMPLETED'`, the reversal is rejected immediately with `Transaction ... has already been reversed`.
  3. The reversal creates a permanent link in the `reversals` table, sets the original transaction status to `REVERSED`, and creates a new compensating transaction of type `REVERSAL`.
- **Test Evidence**:
  - `tests/integration/reversals.test.ts`: Attempts to reverse an already reversed transfer.
  - Result: Rejected with SQL error: `Transaction ... has already been reversed`.

---

### Threat 8: Credential Stuffing & Password Brute-Force Attacks
- **Attack Scenario**: Automated bots attempt dictionary attacks against administrator accounts (`admin@ledgerline.com`).
- **Impact**: Account takeover of privileged identities.
- **Implemented Mitigation**:
  1. Every failed login attempt increments `failed_login_attempts` in `profiles`.
  2. When failed attempts reach 5, the account is locked: `locked_until = NOW() + INTERVAL '30 minutes'`.
  3. Subsequent login attempts are rejected with `Account is temporarily locked. Try again in 30 minutes.`
  4. The anomaly detector triggers a security alert: `BRUTE_FORCE_LOGIN` recorded in `security_alerts`.
- **Test Evidence**:
  - `tests/integration/auth.test.ts`: Performs 5 consecutive failed logins and verifies that the 6th attempt is locked out and logs an anomaly.

---

### Threat 9: Floating-Point Rounding & Fractional Penny Theft
- **Attack Scenario**: Repeated transfers with fractional currency amounts (e.g. ₹10.3333) lead to rounding discrepancies, allowing attackers to skim fractional paise.
- **Impact**: Gradual leakage of capital; non-zero variance between total debits and credits.
- **Implemented Mitigation**:
  1. All balances and monetary values are strictly represented as 64-bit integer paise (`BIGINT`).
  2. Zero floating-point arithmetic is permitted in database stored procedures or backend calculations.
  3. Conversion functions (`rupeesToPaise` and `paiseToRupees`) use `Math.round` and integer division.
- **Test Evidence**:
  - `tests/unit/currency.test.ts`: Verifies edge cases (e.g., ₹0.01 = 1 paise, ₹1,00,000.00 = 1,00,00,000 paise).

---

### Threat 10: Invariant Drift & Asymmetric Ledger Entries
- **Attack Scenario**: An incomplete database write creates a DEBIT entry without a corresponding CREDIT entry, silently corrupting the ledger.
- **Impact**: Failure of double-entry accounting fundamental theorem ($\sum D \ne \sum C$).
- **Implemented Mitigation**:
  1. All financial entries are created inside atomic database transactions (`BEGIN ... COMMIT`).
  2. The stored procedure enforces that for every debit, an equal and opposite credit is inserted in the same atomic block.
  3. Continuous audit endpoint (`/api/v1/integrity/verify`) runs automated attestation queries:
     $$\text{Variance} = \left|\sum \text{Debits} - \sum \text{Credits}\right| \equiv 0$$
- **Test Evidence**:
  - `tests/integration/ledger-double-entry.test.ts`: Computes total debits and credits across the entire ledger.
  - Result: Variance is verified at exactly ₹0.00 across all transactions.

---

## 3. Threat Mitigation Summary Matrix

| Threat # | Threat Description | Attack Vector | Security Mitigation | Verification Test Suite |
|---|---|---|---|---|
| **T-01** | Race Condition / Double Spending | Parallel concurrent transfers | Row locks (`FOR UPDATE`), sorted UUIDs, `CHECK (balance >= 0)` | `concurrency.test.ts` |
| **T-02** | Replay Attacks | Duplicate HTTP transfer submissions | `Idempotency-Key` header, SHA-256 payload hash cache | `idempotency.test.ts` |
| **T-03** | Database Record Tampering | Direct `UPDATE`/`DELETE` on ledger or audit | Database triggers raising PL/pgSQL exceptions | `ledger-double-entry.test.ts` |
| **T-04** | Broken Object Authorization (BOLA) | Account Holder transferring from peer vault | Ownership validation, RLS policies | `rls-authorization.test.ts` |
| **T-05** | Unauthorized Privilege Escalation | Public registration with `"role": "ADMIN"` | Role hardcoding, admin approval gate, RBAC middleware | `auth.test.ts` |
| **T-06** | Phantom Deposit Injection | Direct user deposit creation | Admin deposit approval queue, reserve account offsetting | `transactions.test.ts` |
| **T-07** | Double Reversal Attack | Multiple reversal requests on same txn | State check `status = 'COMPLETED'`, atomic reversal table | `reversals.test.ts` |
| **T-08** | Credential Brute-Force | Automated password dictionary attack | Failed attempt counter, 30m lockout, anomaly alerts | `auth.test.ts` |
| **T-09** | Floating-Point Rounding | Fractional decimal leakage | `BIGINT` integer paise representation | `currency.test.ts` |
| **T-10** | Double-Entry Invariant Drift | Asymmetric ledger creation | Atomic stored procs, real-time invariant attestation | `ledger-double-entry.test.ts` |

---

## 4. Accepted Residual Risks & Limitations

While LedgerLine enforces strict defense-in-depth, the following risks are acknowledged and documented for operational governance:

1. **Single Database Node SPOF**:
   - *Risk*: In standard development setups, Supabase operates on a single primary node.
   - *Mitigation Plan*: In production banking deployments, multi-region replication with automatic failover (e.g. AWS Aurora PostgreSQL or Supabase Enterprise multi-AZ) is required.
2. **In-Memory Rate Limiting**:
   - *Risk*: The current rate limiter runs in Node.js process memory. In a multi-instance containerized environment, rate limits are not shared across server nodes.
   - *Mitigation Plan*: Deploy a distributed Redis cluster for distributed token-bucket rate limiting.
3. **KMS Hardware Security Module (HSM)**:
   - *Risk*: The database connection string and JWT secrets are stored in environment variables (`.env.local`).
   - *Mitigation Plan*: Upgrade to AWS KMS or HashiCorp Vault with envelope encryption and automated secret rotation.
4. **Cold Storage Archival**:
   - *Risk*: As transactions scale into hundreds of millions, `ledger_entries` and `audit_logs` will grow continuously due to immutability.
   - *Mitigation Plan*: Implement PostgreSQL table partitioning by month/quarter and archive historical partitions to WORM (Write Once, Read Many) S3 Object Lock storage.

