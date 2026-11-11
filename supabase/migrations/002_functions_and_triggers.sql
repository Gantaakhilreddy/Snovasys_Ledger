-- ==============================================================================
-- Migration 002: Immutability Triggers, Stored Procedures, and Integrity Verification
-- ==============================================================================

-- 1. Ledger Immutability Trigger
CREATE OR REPLACE FUNCTION trg_enforce_ledger_immutability()
RETURNS TRIGGER AS $$
BEGIN
    RAISE EXCEPTION 'Financial ledger entries are strictly immutable and cannot be modified or deleted. (Entry ID: %)', OLD.id;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_ledger_entries_immutability ON ledger_entries;
CREATE TRIGGER trg_ledger_entries_immutability
BEFORE UPDATE OR DELETE ON ledger_entries
FOR EACH ROW
EXECUTE FUNCTION trg_enforce_ledger_immutability();

-- 2. Audit Log Immutability Trigger
CREATE OR REPLACE FUNCTION trg_enforce_audit_immutability()
RETURNS TRIGGER AS $$
BEGIN
    RAISE EXCEPTION 'Audit logs are append-only and cannot be modified or deleted. (Log ID: %)', OLD.id;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_audit_logs_immutability ON audit_logs;
CREATE TRIGGER trg_audit_logs_immutability
BEFORE UPDATE OR DELETE ON audit_logs
FOR EACH ROW
EXECUTE FUNCTION trg_enforce_audit_immutability();

-- Helper: Get or Create System Reserve Account
CREATE OR REPLACE FUNCTION get_or_create_system_reserve_account()
RETURNS UUID AS $$
DECLARE
    v_reserve_id UUID;
    v_admin_id UUID;
BEGIN
    SELECT id INTO v_reserve_id FROM accounts WHERE account_type = 'SYSTEM_RESERVE' LIMIT 1;
    IF v_reserve_id IS NOT NULL THEN
        RETURN v_reserve_id;
    END IF;

    -- Find an admin profile or create a system profile
    SELECT id INTO v_admin_id FROM profiles WHERE role = 'ADMIN' ORDER BY created_at ASC LIMIT 1;
    IF v_admin_id IS NULL THEN
        INSERT INTO profiles (email, full_name, role, status, password_hash)
        VALUES ('system@ledgerline.internal', 'LedgerLine System Central', 'ADMIN', 'ACTIVE', '$2a$12$dummyhashedsystempasswordnotforlogin')
        RETURNING id INTO v_admin_id;
    END IF;

    INSERT INTO accounts (account_number, user_id, account_type, currency, balance_paise, status)
    VALUES ('SYS-RESERVE-001', v_admin_id, 'SYSTEM_RESERVE', 'INR', 1000000000000, 'ACTIVE')
    RETURNING id INTO v_reserve_id;

    RETURN v_reserve_id;
END;
$$ LANGUAGE plpgsql;

-- 3. Atomic Money Transfer Procedure
CREATE OR REPLACE FUNCTION transfer_funds_atomic(
    p_source_account_id UUID,
    p_dest_account_id UUID,
    p_amount_paise BIGINT,
    p_fee_paise BIGINT DEFAULT 0,
    p_description TEXT DEFAULT 'Transfer',
    p_created_by UUID DEFAULT NULL,
    p_reference_no TEXT DEFAULT NULL,
    p_metadata JSONB DEFAULT '{}'::jsonb
)
RETURNS JSONB AS $$
DECLARE
    v_ref_no VARCHAR(64);
    v_first_id UUID;
    v_second_id UUID;
    v_source_acc RECORD;
    v_dest_acc RECORD;
    v_new_source_balance BIGINT;
    v_new_dest_balance BIGINT;
    v_txn_id UUID;
    v_total_deduction BIGINT;
    v_reserve_id UUID;
BEGIN
    -- Basic validations
    IF p_source_account_id = p_dest_account_id THEN
        RAISE EXCEPTION 'Source and destination accounts must be distinct.';
    END IF;

    IF p_amount_paise <= 0 THEN
        RAISE EXCEPTION 'Transfer amount must be strictly greater than zero.';
    END IF;

    IF p_fee_paise < 0 THEN
        RAISE EXCEPTION 'Fee cannot be negative.';
    END IF;

    v_total_deduction := p_amount_paise + p_fee_paise;
    v_ref_no := COALESCE(p_reference_no, 'TXN-' || UPPER(SUBSTRING(gen_random_uuid()::text FROM 1 FOR 12)));

    -- Deadlock-free account locking (deterministic UUID ordering)
    IF p_source_account_id < p_dest_account_id THEN
        v_first_id := p_source_account_id;
        v_second_id := p_dest_account_id;
    ELSE
        v_first_id := p_dest_account_id;
        v_second_id := p_source_account_id;
    END IF;

    -- Lock both accounts
    PERFORM 1 FROM accounts WHERE id = v_first_id FOR UPDATE;
    PERFORM 1 FROM accounts WHERE id = v_second_id FOR UPDATE;

    -- Fetch account states
    SELECT * INTO v_source_acc FROM accounts WHERE id = p_source_account_id;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Source account does not exist.';
    END IF;

    SELECT * INTO v_dest_acc FROM accounts WHERE id = p_dest_account_id;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Destination account does not exist.';
    END IF;

    -- Status validations
    IF v_source_acc.status <> 'ACTIVE' THEN
        RAISE EXCEPTION 'Source account is % and cannot initiate transfers.', v_source_acc.status;
    END IF;

    IF v_dest_acc.status <> 'ACTIVE' THEN
        RAISE EXCEPTION 'Destination account is % and cannot receive transfers.', v_dest_acc.status;
    END IF;

    -- Available balance check
    IF v_source_acc.balance_paise < v_total_deduction THEN
        RAISE EXCEPTION 'Insufficient balance: Available % paise, requested deduction % paise.',
            v_source_acc.balance_paise, v_total_deduction;
    END IF;

    -- Calculate new balances
    v_new_source_balance := v_source_acc.balance_paise - v_total_deduction;
    v_new_dest_balance := v_dest_acc.balance_paise + p_amount_paise;

    -- Apply balance updates
    UPDATE accounts 
    SET balance_paise = v_new_source_balance, updated_at = NOW() 
    WHERE id = p_source_account_id;

    UPDATE accounts 
    SET balance_paise = v_new_dest_balance, updated_at = NOW() 
    WHERE id = p_dest_account_id;

    -- Create Transaction Record
    INSERT INTO transactions (
        reference_no, type, amount_paise, fee_paise, status,
        source_account_id, destination_account_id, description,
        metadata, created_by, completed_at
    ) VALUES (
        v_ref_no, 'TRANSFER', p_amount_paise, p_fee_paise, 'COMPLETED',
        p_source_account_id, p_dest_account_id, p_description,
        p_metadata, p_created_by, NOW()
    ) RETURNING id INTO v_txn_id;

    -- Insert Balanced Double-Entry Ledger Records
    -- 1. Source Account: DEBIT amount
    INSERT INTO ledger_entries (
        transaction_id, account_id, entry_type, amount_paise,
        balance_after_paise, description
    ) VALUES (
        v_txn_id, p_source_account_id, 'DEBIT', p_amount_paise,
        v_new_source_balance + p_fee_paise, 'Transfer to ' || v_dest_acc.account_number
    );

    -- 2. Destination Account: CREDIT amount
    INSERT INTO ledger_entries (
        transaction_id, account_id, entry_type, amount_paise,
        balance_after_paise, description
    ) VALUES (
        v_txn_id, p_dest_account_id, 'CREDIT', p_amount_paise,
        v_new_dest_balance, 'Transfer from ' || v_source_acc.account_number
    );

    -- 3. If fee > 0, record fee ledger entries
    IF p_fee_paise > 0 THEN
        v_reserve_id := get_or_create_system_reserve_account();
        -- Update reserve balance
        UPDATE accounts 
        SET balance_paise = balance_paise + p_fee_paise, updated_at = NOW() 
        WHERE id = v_reserve_id;

        INSERT INTO ledger_entries (
            transaction_id, account_id, entry_type, amount_paise,
            balance_after_paise, description
        ) VALUES (
            v_txn_id, p_source_account_id, 'DEBIT', p_fee_paise,
            v_new_source_balance, 'Transaction fee for ' || v_ref_no
        );

        INSERT INTO ledger_entries (
            transaction_id, account_id, entry_type, amount_paise,
            balance_after_paise, description
        ) VALUES (
            v_txn_id, v_reserve_id, 'CREDIT', p_fee_paise,
            (SELECT balance_paise FROM accounts WHERE id = v_reserve_id), 'Fee collection for ' || v_ref_no
        );
    END IF;

    -- Insert Audit Log
    INSERT INTO audit_logs (
        user_id, action, entity_type, entity_id,
        new_data, status
    ) VALUES (
        p_created_by, 'TRANSFER_COMPLETED', 'TRANSACTION', v_txn_id::text,
        jsonb_build_object(
            'reference_no', v_ref_no,
            'source_account_id', p_source_account_id,
            'dest_account_id', p_dest_account_id,
            'amount_paise', p_amount_paise,
            'fee_paise', p_fee_paise
        ),
        'SUCCESS'
    );

    -- Return full transaction summary
    RETURN jsonb_build_object(
        'transaction_id', v_txn_id,
        'reference_no', v_ref_no,
        'type', 'TRANSFER',
        'status', 'COMPLETED',
        'amount_paise', p_amount_paise,
        'fee_paise', p_fee_paise,
        'source_account_id', p_source_account_id,
        'destination_account_id', p_dest_account_id,
        'source_balance_after_paise', v_new_source_balance,
        'dest_balance_after_paise', v_new_dest_balance,
        'created_at', NOW()
    );
END;
$$ LANGUAGE plpgsql;

-- 4. Atomic Deposit Procedure
CREATE OR REPLACE FUNCTION deposit_funds_atomic(
    p_account_id UUID,
    p_amount_paise BIGINT,
    p_description TEXT DEFAULT 'Deposit',
    p_created_by UUID DEFAULT NULL,
    p_reference_no TEXT DEFAULT NULL,
    p_metadata JSONB DEFAULT '{}'::jsonb
)
RETURNS JSONB AS $$
DECLARE
    v_ref_no VARCHAR(64);
    v_reserve_id UUID;
    v_target_acc RECORD;
    v_new_balance BIGINT;
    v_reserve_balance BIGINT;
    v_txn_id UUID;
BEGIN
    IF p_amount_paise <= 0 THEN
        RAISE EXCEPTION 'Deposit amount must be strictly greater than zero.';
    END IF;

    v_reserve_id := get_or_create_system_reserve_account();
    v_ref_no := COALESCE(p_reference_no, 'DEP-' || UPPER(SUBSTRING(gen_random_uuid()::text FROM 1 FOR 12)));

    -- Lock both target account and reserve account deterministically
    IF p_account_id < v_reserve_id THEN
        PERFORM 1 FROM accounts WHERE id = p_account_id FOR UPDATE;
        PERFORM 1 FROM accounts WHERE id = v_reserve_id FOR UPDATE;
    ELSE
        PERFORM 1 FROM accounts WHERE id = v_reserve_id FOR UPDATE;
        PERFORM 1 FROM accounts WHERE id = p_account_id FOR UPDATE;
    END IF;

    SELECT * INTO v_target_acc FROM accounts WHERE id = p_account_id;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Target account does not exist.';
    END IF;

    IF v_target_acc.status <> 'ACTIVE' THEN
        RAISE EXCEPTION 'Cannot deposit to % account.', v_target_acc.status;
    END IF;

    v_new_balance := v_target_acc.balance_paise + p_amount_paise;

    -- Update target account balance
    UPDATE accounts 
    SET balance_paise = v_new_balance, updated_at = NOW() 
    WHERE id = p_account_id;

    -- Update system reserve
    UPDATE accounts 
    SET balance_paise = balance_paise + p_amount_paise, updated_at = NOW() 
    WHERE id = v_reserve_id
    RETURNING balance_paise INTO v_reserve_balance;

    -- Create Transaction Record
    INSERT INTO transactions (
        reference_no, type, amount_paise, fee_paise, status,
        source_account_id, destination_account_id, description,
        metadata, created_by, completed_at
    ) VALUES (
        v_ref_no, 'DEPOSIT', p_amount_paise, 0, 'COMPLETED',
        v_reserve_id, p_account_id, p_description,
        p_metadata, p_created_by, NOW()
    ) RETURNING id INTO v_txn_id;

    -- Balanced Double-Entry:
    -- DEBIT System Reserve Account (cash/reserve asset increases)
    INSERT INTO ledger_entries (
        transaction_id, account_id, entry_type, amount_paise,
        balance_after_paise, description
    ) VALUES (
        v_txn_id, v_reserve_id, 'DEBIT', p_amount_paise,
        v_reserve_balance, 'Deposit funding from external source for ' || v_target_acc.account_number
    );

    -- CREDIT Customer Account (bank liability increases)
    INSERT INTO ledger_entries (
        transaction_id, account_id, entry_type, amount_paise,
        balance_after_paise, description
    ) VALUES (
        v_txn_id, p_account_id, 'CREDIT', p_amount_paise,
        v_new_balance, p_description
    );

    -- Audit log
    INSERT INTO audit_logs (
        user_id, action, entity_type, entity_id,
        new_data, status
    ) VALUES (
        p_created_by, 'DEPOSIT_COMPLETED', 'TRANSACTION', v_txn_id::text,
        jsonb_build_object(
            'reference_no', v_ref_no,
            'account_id', p_account_id,
            'amount_paise', p_amount_paise
        ),
        'SUCCESS'
    );

    RETURN jsonb_build_object(
        'transaction_id', v_txn_id,
        'reference_no', v_ref_no,
        'type', 'DEPOSIT',
        'status', 'COMPLETED',
        'amount_paise', p_amount_paise,
        'account_id', p_account_id,
        'balance_after_paise', v_new_balance,
        'created_at', NOW()
    );
END;
$$ LANGUAGE plpgsql;

-- 5. Atomic Withdrawal Procedure
CREATE OR REPLACE FUNCTION withdraw_funds_atomic(
    p_account_id UUID,
    p_amount_paise BIGINT,
    p_description TEXT DEFAULT 'Withdrawal',
    p_created_by UUID DEFAULT NULL,
    p_reference_no TEXT DEFAULT NULL,
    p_metadata JSONB DEFAULT '{}'::jsonb
)
RETURNS JSONB AS $$
DECLARE
    v_ref_no VARCHAR(64);
    v_reserve_id UUID;
    v_target_acc RECORD;
    v_new_balance BIGINT;
    v_reserve_balance BIGINT;
    v_txn_id UUID;
BEGIN
    IF p_amount_paise <= 0 THEN
        RAISE EXCEPTION 'Withdrawal amount must be strictly greater than zero.';
    END IF;

    v_reserve_id := get_or_create_system_reserve_account();
    v_ref_no := COALESCE(p_reference_no, 'WTH-' || UPPER(SUBSTRING(gen_random_uuid()::text FROM 1 FOR 12)));

    -- Lock accounts deterministically
    IF p_account_id < v_reserve_id THEN
        PERFORM 1 FROM accounts WHERE id = p_account_id FOR UPDATE;
        PERFORM 1 FROM accounts WHERE id = v_reserve_id FOR UPDATE;
    ELSE
        PERFORM 1 FROM accounts WHERE id = v_reserve_id FOR UPDATE;
        PERFORM 1 FROM accounts WHERE id = p_account_id FOR UPDATE;
    END IF;

    SELECT * INTO v_target_acc FROM accounts WHERE id = p_account_id;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Account does not exist.';
    END IF;

    IF v_target_acc.status <> 'ACTIVE' THEN
        RAISE EXCEPTION 'Cannot withdraw from % account.', v_target_acc.status;
    END IF;

    IF v_target_acc.balance_paise < p_amount_paise THEN
        RAISE EXCEPTION 'Insufficient balance: Available % paise, requested withdrawal % paise.',
            v_target_acc.balance_paise, p_amount_paise;
    END IF;

    v_new_balance := v_target_acc.balance_paise - p_amount_paise;

    -- Update target account
    UPDATE accounts 
    SET balance_paise = v_new_balance, updated_at = NOW() 
    WHERE id = p_account_id;

    -- Update reserve account
    UPDATE accounts 
    SET balance_paise = balance_paise - p_amount_paise, updated_at = NOW() 
    WHERE id = v_reserve_id
    RETURNING balance_paise INTO v_reserve_balance;

    -- Create Transaction Record
    INSERT INTO transactions (
        reference_no, type, amount_paise, fee_paise, status,
        source_account_id, destination_account_id, description,
        metadata, created_by, completed_at
    ) VALUES (
        v_ref_no, 'WITHDRAWAL', p_amount_paise, 0, 'COMPLETED',
        p_account_id, v_reserve_id, p_description,
        p_metadata, p_created_by, NOW()
    ) RETURNING id INTO v_txn_id;

    -- Balanced Double-Entry:
    -- DEBIT Customer Account (bank liability decreases)
    INSERT INTO ledger_entries (
        transaction_id, account_id, entry_type, amount_paise,
        balance_after_paise, description
    ) VALUES (
        v_txn_id, p_account_id, 'DEBIT', p_amount_paise,
        v_new_balance, p_description
    );

    -- CREDIT System Reserve Account (cash/reserve asset leaves)
    INSERT INTO ledger_entries (
        transaction_id, account_id, entry_type, amount_paise,
        balance_after_paise, description
    ) VALUES (
        v_txn_id, v_reserve_id, 'CREDIT', p_amount_paise,
        v_reserve_balance, 'Withdrawal payout to external destination for ' || v_target_acc.account_number
    );

    -- Audit log
    INSERT INTO audit_logs (
        user_id, action, entity_type, entity_id,
        new_data, status
    ) VALUES (
        p_created_by, 'WITHDRAWAL_COMPLETED', 'TRANSACTION', v_txn_id::text,
        jsonb_build_object(
            'reference_no', v_ref_no,
            'account_id', p_account_id,
            'amount_paise', p_amount_paise
        ),
        'SUCCESS'
    );

    RETURN jsonb_build_object(
        'transaction_id', v_txn_id,
        'reference_no', v_ref_no,
        'type', 'WITHDRAWAL',
        'status', 'COMPLETED',
        'amount_paise', p_amount_paise,
        'account_id', p_account_id,
        'balance_after_paise', v_new_balance,
        'created_at', NOW()
    );
END;
$$ LANGUAGE plpgsql;

-- 6. Atomic Transaction Reversal Procedure
CREATE OR REPLACE FUNCTION reverse_transaction_atomic(
    p_original_txn_id UUID,
    p_reason TEXT,
    p_initiated_by UUID,
    p_reversal_ref_no TEXT DEFAULT NULL
)
RETURNS JSONB AS $$
DECLARE
    v_orig RECORD;
    v_rev_ref_no VARCHAR(64);
    v_rev_txn_id UUID;
    v_reversal_id UUID;
    v_source_acc RECORD;
    v_dest_acc RECORD;
    v_new_source_balance BIGINT;
    v_new_dest_balance BIGINT;
    v_first_id UUID;
    v_second_id UUID;
    v_reserve_id UUID;
BEGIN
    -- Check if already reversed
    IF EXISTS (SELECT 1 FROM reversals WHERE original_transaction_id = p_original_txn_id) THEN
        RAISE EXCEPTION 'Transaction % has already been reversed.', p_original_txn_id;
    END IF;

    -- Lock original transaction
    SELECT * INTO v_orig FROM transactions WHERE id = p_original_txn_id FOR UPDATE;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Original transaction % not found.', p_original_txn_id;
    END IF;

    IF v_orig.status <> 'COMPLETED' THEN
        RAISE EXCEPTION 'Only COMPLETED transactions can be reversed. Current status: %', v_orig.status;
    END IF;

    v_rev_ref_no := COALESCE(p_reversal_ref_no, 'REV-' || UPPER(SUBSTRING(gen_random_uuid()::text FROM 1 FOR 12)));

    IF v_orig.type = 'TRANSFER' THEN
        -- Original transfer: source -> dest
        -- Reversal: dest -> source
        IF v_orig.destination_account_id < v_orig.source_account_id THEN
            v_first_id := v_orig.destination_account_id;
            v_second_id := v_orig.source_account_id;
        ELSE
            v_first_id := v_orig.source_account_id;
            v_second_id := v_orig.destination_account_id;
        END IF;

        PERFORM 1 FROM accounts WHERE id = v_first_id FOR UPDATE;
        PERFORM 1 FROM accounts WHERE id = v_second_id FOR UPDATE;

        SELECT * INTO v_dest_acc FROM accounts WHERE id = v_orig.destination_account_id;
        SELECT * INTO v_source_acc FROM accounts WHERE id = v_orig.source_account_id;

        -- Ensure destination account has enough balance to reverse the received transfer
        IF v_dest_acc.balance_paise < v_orig.amount_paise THEN
            RAISE EXCEPTION 'Cannot reverse transfer: Destination account balance (% paise) is insufficient to return % paise.',
                v_dest_acc.balance_paise, v_orig.amount_paise;
        END IF;

        v_new_dest_balance := v_dest_acc.balance_paise - v_orig.amount_paise;
        v_new_source_balance := v_source_acc.balance_paise + v_orig.amount_paise;

        UPDATE accounts SET balance_paise = v_new_dest_balance, updated_at = NOW() WHERE id = v_dest_acc.id;
        UPDATE accounts SET balance_paise = v_new_source_balance, updated_at = NOW() WHERE id = v_source_acc.id;

        -- Create compensating transaction
        INSERT INTO transactions (
            reference_no, type, amount_paise, fee_paise, status,
            source_account_id, destination_account_id, description,
            metadata, created_by, completed_at
        ) VALUES (
            v_rev_ref_no, 'REVERSAL', v_orig.amount_paise, 0, 'COMPLETED',
            v_orig.destination_account_id, v_orig.source_account_id,
            'Reversal of ' || v_orig.reference_no || ': ' || p_reason,
            jsonb_build_object('original_transaction_id', v_orig.id, 'reason', p_reason),
            p_initiated_by, NOW()
        ) RETURNING id INTO v_rev_txn_id;

        -- Compensating ledger entries:
        -- DEBIT original recipient
        INSERT INTO ledger_entries (
            transaction_id, account_id, entry_type, amount_paise,
            balance_after_paise, description
        ) VALUES (
            v_rev_txn_id, v_dest_acc.id, 'DEBIT', v_orig.amount_paise,
            v_new_dest_balance, 'Reversal debit for ' || v_orig.reference_no
        );

        -- CREDIT original sender
        INSERT INTO ledger_entries (
            transaction_id, account_id, entry_type, amount_paise,
            balance_after_paise, description
        ) VALUES (
            v_rev_txn_id, v_source_acc.id, 'CREDIT', v_orig.amount_paise,
            v_new_source_balance, 'Reversal credit for ' || v_orig.reference_no
        );

    ELSIF v_orig.type = 'DEPOSIT' THEN
        -- Original deposit: reserve -> dest
        -- Reversal: dest -> reserve
        v_reserve_id := get_or_create_system_reserve_account();

        IF v_orig.destination_account_id < v_reserve_id THEN
            PERFORM 1 FROM accounts WHERE id = v_orig.destination_account_id FOR UPDATE;
            PERFORM 1 FROM accounts WHERE id = v_reserve_id FOR UPDATE;
        ELSE
            PERFORM 1 FROM accounts WHERE id = v_reserve_id FOR UPDATE;
            PERFORM 1 FROM accounts WHERE id = v_orig.destination_account_id FOR UPDATE;
        END IF;

        SELECT * INTO v_dest_acc FROM accounts WHERE id = v_orig.destination_account_id;
        IF v_dest_acc.balance_paise < v_orig.amount_paise THEN
            RAISE EXCEPTION 'Cannot reverse deposit: Account balance (% paise) is insufficient to debit % paise.',
                v_dest_acc.balance_paise, v_orig.amount_paise;
        END IF;

        v_new_dest_balance := v_dest_acc.balance_paise - v_orig.amount_paise;
        UPDATE accounts SET balance_paise = v_new_dest_balance, updated_at = NOW() WHERE id = v_dest_acc.id;
        UPDATE accounts SET balance_paise = balance_paise - v_orig.amount_paise, updated_at = NOW() WHERE id = v_reserve_id;

        INSERT INTO transactions (
            reference_no, type, amount_paise, fee_paise, status,
            source_account_id, destination_account_id, description,
            metadata, created_by, completed_at
        ) VALUES (
            v_rev_ref_no, 'REVERSAL', v_orig.amount_paise, 0, 'COMPLETED',
            v_orig.destination_account_id, v_reserve_id,
            'Deposit reversal for ' || v_orig.reference_no || ': ' || p_reason,
            jsonb_build_object('original_transaction_id', v_orig.id, 'reason', p_reason),
            p_initiated_by, NOW()
        ) RETURNING id INTO v_rev_txn_id;

        INSERT INTO ledger_entries (
            transaction_id, account_id, entry_type, amount_paise,
            balance_after_paise, description
        ) VALUES (
            v_rev_txn_id, v_dest_acc.id, 'DEBIT', v_orig.amount_paise,
            v_new_dest_balance, 'Deposit reversal debit'
        );

        INSERT INTO ledger_entries (
            transaction_id, account_id, entry_type, amount_paise,
            balance_after_paise, description
        ) VALUES (
            v_rev_txn_id, v_reserve_id, 'CREDIT', v_orig.amount_paise,
            (SELECT balance_paise FROM accounts WHERE id = v_reserve_id), 'Deposit reversal credit to reserve'
        );

    ELSIF v_orig.type = 'WITHDRAWAL' THEN
        -- Original withdrawal: source -> reserve
        -- Reversal: reserve -> source
        v_reserve_id := get_or_create_system_reserve_account();

        IF v_orig.source_account_id < v_reserve_id THEN
            PERFORM 1 FROM accounts WHERE id = v_orig.source_account_id FOR UPDATE;
            PERFORM 1 FROM accounts WHERE id = v_reserve_id FOR UPDATE;
        ELSE
            PERFORM 1 FROM accounts WHERE id = v_reserve_id FOR UPDATE;
            PERFORM 1 FROM accounts WHERE id = v_orig.source_account_id FOR UPDATE;
        END IF;

        SELECT * INTO v_source_acc FROM accounts WHERE id = v_orig.source_account_id;
        v_new_source_balance := v_source_acc.balance_paise + v_orig.amount_paise;

        UPDATE accounts SET balance_paise = v_new_source_balance, updated_at = NOW() WHERE id = v_source_acc.id;
        UPDATE accounts SET balance_paise = balance_paise + v_orig.amount_paise, updated_at = NOW() WHERE id = v_reserve_id;

        INSERT INTO transactions (
            reference_no, type, amount_paise, fee_paise, status,
            source_account_id, destination_account_id, description,
            metadata, created_by, completed_at
        ) VALUES (
            v_rev_ref_no, 'REVERSAL', v_orig.amount_paise, 0, 'COMPLETED',
            v_reserve_id, v_orig.source_account_id,
            'Withdrawal reversal for ' || v_orig.reference_no || ': ' || p_reason,
            jsonb_build_object('original_transaction_id', v_orig.id, 'reason', p_reason),
            p_initiated_by, NOW()
        ) RETURNING id INTO v_rev_txn_id;

        INSERT INTO ledger_entries (
            transaction_id, account_id, entry_type, amount_paise,
            balance_after_paise, description
        ) VALUES (
            v_rev_txn_id, v_reserve_id, 'DEBIT', v_orig.amount_paise,
            (SELECT balance_paise FROM accounts WHERE id = v_reserve_id), 'Withdrawal reversal debit from reserve'
        );

        INSERT INTO ledger_entries (
            transaction_id, account_id, entry_type, amount_paise,
            balance_after_paise, description
        ) VALUES (
            v_rev_txn_id, v_source_acc.id, 'CREDIT', v_orig.amount_paise,
            v_new_source_balance, 'Withdrawal reversal credit'
        );

    ELSE
        RAISE EXCEPTION 'Cannot reverse transaction of type %.', v_orig.type;
    END IF;

    -- Update original transaction status to REVERSED
    UPDATE transactions 
    SET status = 'REVERSED' 
    WHERE id = p_original_txn_id;

    -- Record in reversals table
    INSERT INTO reversals (
        original_transaction_id, reversal_transaction_id, reason, initiated_by, status
    ) VALUES (
        p_original_txn_id, v_rev_txn_id, p_reason, p_initiated_by, 'COMPLETED'
    ) RETURNING id INTO v_reversal_id;

    -- Audit Log
    INSERT INTO audit_logs (
        user_id, action, entity_type, entity_id,
        new_data, status
    ) VALUES (
        p_initiated_by, 'TRANSACTION_REVERSED', 'TRANSACTION', v_rev_txn_id::text,
        jsonb_build_object(
            'original_transaction_id', p_original_txn_id,
            'reversal_transaction_id', v_rev_txn_id,
            'reason', p_reason
        ),
        'SUCCESS'
    );

    RETURN jsonb_build_object(
        'reversal_id', v_reversal_id,
        'reversal_transaction_id', v_rev_txn_id,
        'reversal_reference_no', v_rev_ref_no,
        'original_transaction_id', p_original_txn_id,
        'amount_paise', v_orig.amount_paise,
        'status', 'COMPLETED',
        'created_at', NOW()
    );
END;
$$ LANGUAGE plpgsql;

-- 7. Comprehensive System Integrity Verification Function
CREATE OR REPLACE FUNCTION verify_system_integrity()
RETURNS JSONB AS $$
DECLARE
    v_total_debits BIGINT;
    v_total_credits BIGINT;
    v_is_ledger_balanced BOOLEAN;
    v_mismatched_txns JSONB;
    v_mismatched_accounts JSONB;
    v_total_txns BIGINT;
    v_total_accounts BIGINT;
    v_total_alerts BIGINT;
    v_overall_valid BOOLEAN;
BEGIN
    -- 1. Check aggregate debits vs credits across all ledger entries
    SELECT 
        COALESCE(SUM(CASE WHEN entry_type = 'DEBIT' THEN amount_paise ELSE 0 END), 0),
        COALESCE(SUM(CASE WHEN entry_type = 'CREDIT' THEN amount_paise ELSE 0 END), 0)
    INTO v_total_debits, v_total_credits
    FROM ledger_entries;

    v_is_ledger_balanced := (v_total_debits = v_total_credits);

    -- 2. Detect transactions where debit != credit
    SELECT COALESCE(jsonb_agg(sub), '[]'::jsonb)
    INTO v_mismatched_txns
    FROM (
        SELECT 
            transaction_id,
            SUM(CASE WHEN entry_type = 'DEBIT' THEN amount_paise ELSE 0 END) AS total_debit,
            SUM(CASE WHEN entry_type = 'CREDIT' THEN amount_paise ELSE 0 END) AS total_credit
        FROM ledger_entries
        GROUP BY transaction_id
        HAVING SUM(CASE WHEN entry_type = 'DEBIT' THEN amount_paise ELSE 0 END) <> 
               SUM(CASE WHEN entry_type = 'CREDIT' THEN amount_paise ELSE 0 END)
    ) sub;

    -- 3. Detect account balance discrepancies vs ledger entries
    -- (For customer accounts, balance equals sum of credits minus sum of debits)
    SELECT COALESCE(jsonb_agg(sub), '[]'::jsonb)
    INTO v_mismatched_accounts
    FROM (
        SELECT 
            a.id AS account_id,
            a.account_number,
            a.account_type,
            a.balance_paise AS stored_balance,
            COALESCE(SUM(CASE WHEN le.entry_type = 'CREDIT' THEN le.amount_paise ELSE -le.amount_paise END), 0) AS calculated_balance,
            a.balance_paise - COALESCE(SUM(CASE WHEN le.entry_type = 'CREDIT' THEN le.amount_paise ELSE -le.amount_paise END), 0) AS discrepancy_paise
        FROM accounts a
        LEFT JOIN ledger_entries le ON a.id = le.account_id
        WHERE a.account_type <> 'SYSTEM_RESERVE'
        GROUP BY a.id, a.account_number, a.account_type, a.balance_paise
        HAVING a.balance_paise <> COALESCE(SUM(CASE WHEN le.entry_type = 'CREDIT' THEN le.amount_paise ELSE -le.amount_paise END), 0)
    ) sub;

    SELECT COUNT(*) INTO v_total_txns FROM transactions;
    SELECT COUNT(*) INTO v_total_accounts FROM accounts;
    SELECT COUNT(*) INTO v_total_alerts FROM security_alerts WHERE status = 'OPEN';

    v_overall_valid := v_is_ledger_balanced AND 
                       (jsonb_array_length(v_mismatched_txns) = 0) AND 
                       (jsonb_array_length(v_mismatched_accounts) = 0);

    RETURN jsonb_build_object(
        'is_valid', v_overall_valid,
        'ledger_balanced', v_is_ledger_balanced,
        'total_debits_paise', v_total_debits,
        'total_credits_paise', v_total_credits,
        'ledger_imbalance_paise', ABS(v_total_debits - v_total_credits),
        'total_transactions_audited', v_total_txns,
        'mismatched_transactions_count', jsonb_array_length(v_mismatched_txns),
        'mismatched_transactions', v_mismatched_txns,
        'total_accounts_audited', v_total_accounts,
        'mismatched_accounts_count', jsonb_array_length(v_mismatched_accounts),
        'mismatched_accounts', v_mismatched_accounts,
        'open_security_alerts_count', v_total_alerts,
        'verified_at', NOW()
    );
END;
$$ LANGUAGE plpgsql;

