-- ==============================================================================
-- Migration 003: Row Level Security (RLS) Configuration & Policies
-- ==============================================================================

-- Helper function to extract authenticated user's role
CREATE OR REPLACE FUNCTION get_current_user_role()
RETURNS TEXT AS $$
DECLARE
    v_role TEXT;
    v_uid UUID;
BEGIN
    BEGIN
        v_uid := auth.uid();
    EXCEPTION WHEN OTHERS THEN
        v_uid := NULL;
    END;

    IF v_uid IS NULL THEN
        -- Check if set via session configuration for direct database calls
        BEGIN
            v_uid := NULLIF(current_setting('app.current_user_id', true), '')::UUID;
        EXCEPTION WHEN OTHERS THEN
            v_uid := NULL;
        END;
    END IF;

    IF v_uid IS NULL THEN
        RETURN 'ANONYMOUS';
    END IF;

    SELECT role INTO v_role FROM profiles WHERE id = v_uid;
    RETURN COALESCE(v_role, 'ACCOUNT_HOLDER');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Helper function to extract authenticated user id
CREATE OR REPLACE FUNCTION get_current_user_id()
RETURNS UUID AS $$
DECLARE
    v_uid UUID;
BEGIN
    BEGIN
        v_uid := auth.uid();
    EXCEPTION WHEN OTHERS THEN
        v_uid := NULL;
    END;

    IF v_uid IS NULL THEN
        BEGIN
            v_uid := NULLIF(current_setting('app.current_user_id', true), '')::UUID;
        EXCEPTION WHEN OTHERS THEN
            v_uid := NULL;
        END;
    END IF;
    RETURN v_uid;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Enable RLS on all sensitive tables
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE ledger_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE idempotency_keys ENABLE ROW LEVEL SECURITY;
ALTER TABLE security_alerts ENABLE ROW LEVEL SECURITY;
ALTER TABLE reversals ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

-- ------------------------------------------------------------------------------
-- 1. Profiles Policies
-- ------------------------------------------------------------------------------
DROP POLICY IF EXISTS profiles_admin_all ON profiles;
CREATE POLICY profiles_admin_all ON profiles
    FOR ALL
    USING (get_current_user_role() = 'ADMIN');

DROP POLICY IF EXISTS profiles_auditor_select ON profiles;
CREATE POLICY profiles_auditor_select ON profiles
    FOR SELECT
    USING (get_current_user_role() = 'AUDITOR');

DROP POLICY IF EXISTS profiles_holder_select_own ON profiles;
CREATE POLICY profiles_holder_select_own ON profiles
    FOR SELECT
    USING (id = get_current_user_id());

DROP POLICY IF EXISTS profiles_holder_update_own ON profiles;
CREATE POLICY profiles_holder_update_own ON profiles
    FOR UPDATE
    USING (id = get_current_user_id())
    WITH CHECK (id = get_current_user_id());

-- ------------------------------------------------------------------------------
-- 2. Accounts Policies
-- ------------------------------------------------------------------------------
DROP POLICY IF EXISTS accounts_admin_all ON accounts;
CREATE POLICY accounts_admin_all ON accounts
    FOR ALL
    USING (get_current_user_role() = 'ADMIN');

DROP POLICY IF EXISTS accounts_auditor_select ON accounts;
CREATE POLICY accounts_auditor_select ON accounts
    FOR SELECT
    USING (get_current_user_role() = 'AUDITOR');

DROP POLICY IF EXISTS accounts_holder_select_own ON accounts;
CREATE POLICY accounts_holder_select_own ON accounts
    FOR SELECT
    USING (user_id = get_current_user_id());

-- ------------------------------------------------------------------------------
-- 3. Transactions Policies
-- ------------------------------------------------------------------------------
DROP POLICY IF EXISTS transactions_admin_all ON transactions;
CREATE POLICY transactions_admin_all ON transactions
    FOR ALL
    USING (get_current_user_role() = 'ADMIN');

DROP POLICY IF EXISTS transactions_auditor_select ON transactions;
CREATE POLICY transactions_auditor_select ON transactions
    FOR SELECT
    USING (get_current_user_role() = 'AUDITOR');

DROP POLICY IF EXISTS transactions_holder_select_own ON transactions;
CREATE POLICY transactions_holder_select_own ON transactions
    FOR SELECT
    USING (
        created_by = get_current_user_id() OR
        source_account_id IN (SELECT id FROM accounts WHERE user_id = get_current_user_id()) OR
        destination_account_id IN (SELECT id FROM accounts WHERE user_id = get_current_user_id())
    );

-- ------------------------------------------------------------------------------
-- 4. Ledger Entries Policies
-- ------------------------------------------------------------------------------
DROP POLICY IF EXISTS ledger_admin_select ON ledger_entries;
CREATE POLICY ledger_admin_select ON ledger_entries
    FOR SELECT
    USING (get_current_user_role() = 'ADMIN');

DROP POLICY IF EXISTS ledger_auditor_select ON ledger_entries;
CREATE POLICY ledger_auditor_select ON ledger_entries
    FOR SELECT
    USING (get_current_user_role() = 'AUDITOR');

DROP POLICY IF EXISTS ledger_holder_select_own ON ledger_entries;
CREATE POLICY ledger_holder_select_own ON ledger_entries
    FOR SELECT
    USING (
        account_id IN (SELECT id FROM accounts WHERE user_id = get_current_user_id())
    );

-- ------------------------------------------------------------------------------
-- 5. Audit Logs Policies
-- ------------------------------------------------------------------------------
DROP POLICY IF EXISTS audit_admin_select ON audit_logs;
CREATE POLICY audit_admin_select ON audit_logs
    FOR SELECT
    USING (get_current_user_role() = 'ADMIN');

DROP POLICY IF EXISTS audit_auditor_select ON audit_logs;
CREATE POLICY audit_auditor_select ON audit_logs
    FOR SELECT
    USING (get_current_user_role() = 'AUDITOR');

DROP POLICY IF EXISTS audit_insert_all ON audit_logs;
CREATE POLICY audit_insert_all ON audit_logs
    FOR INSERT
    WITH CHECK (true);

-- ------------------------------------------------------------------------------
-- 6. Idempotency Keys Policies
-- ------------------------------------------------------------------------------
DROP POLICY IF EXISTS idempotency_admin_all ON idempotency_keys;
CREATE POLICY idempotency_admin_all ON idempotency_keys
    FOR ALL
    USING (get_current_user_role() = 'ADMIN');

DROP POLICY IF EXISTS idempotency_user_own ON idempotency_keys;
CREATE POLICY idempotency_user_own ON idempotency_keys
    FOR ALL
    USING (user_id = get_current_user_id());

-- ------------------------------------------------------------------------------
-- 7. Security Alerts Policies
-- ------------------------------------------------------------------------------
DROP POLICY IF EXISTS alerts_admin_all ON security_alerts;
CREATE POLICY alerts_admin_all ON security_alerts
    FOR ALL
    USING (get_current_user_role() = 'ADMIN');

DROP POLICY IF EXISTS alerts_auditor_select ON security_alerts;
CREATE POLICY alerts_auditor_select ON security_alerts
    FOR SELECT
    USING (get_current_user_role() = 'AUDITOR');

-- ------------------------------------------------------------------------------
-- 8. Reversals Policies
-- ------------------------------------------------------------------------------
DROP POLICY IF EXISTS reversals_admin_all ON reversals;
CREATE POLICY reversals_admin_all ON reversals
    FOR ALL
    USING (get_current_user_role() = 'ADMIN');

DROP POLICY IF EXISTS reversals_auditor_select ON reversals;
CREATE POLICY reversals_auditor_select ON reversals
    FOR SELECT
    USING (get_current_user_role() = 'AUDITOR');

-- ------------------------------------------------------------------------------
-- 9. Notifications Policies
-- ------------------------------------------------------------------------------
DROP POLICY IF EXISTS notif_admin_all ON notifications;
CREATE POLICY notif_admin_all ON notifications
    FOR ALL
    USING (get_current_user_role() = 'ADMIN');

DROP POLICY IF EXISTS notif_user_own ON notifications;
CREATE POLICY notif_user_own ON notifications
    FOR ALL
    USING (user_id = get_current_user_id());
