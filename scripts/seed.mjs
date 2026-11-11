import pg from 'pg';
import bcrypt from 'bcryptjs';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const { Pool } = pg;

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false
  }
});

async function seed() {
  const client = await pool.connect();
  try {
    console.log('Seeding database with demo users, accounts, and initial double-entry ledger...');
    await client.query('BEGIN');

    // Clean existing seed data if needed
    // Note: Due to immutability triggers on ledger_entries and audit_logs, we only insert if not already present
    const existingAdmin = await client.query("SELECT id FROM profiles WHERE email = 'admin@ledgerline.com'");
    if (existingAdmin.rows.length > 0) {
      console.log('Seed data already present. Skipping seed.');
      await client.query('ROLLBACK');
      return;
    }

    const salt = await bcrypt.genSalt(10);
    const adminPass = await bcrypt.hash('Admin@123456', salt);
    const auditorPass = await bcrypt.hash('Auditor@123456', salt);
    const userPass = await bcrypt.hash('Password@123456', salt);

    // 1. Insert Profiles
    const adminRes = await client.query(`
      INSERT INTO profiles (email, full_name, phone, role, status, password_hash)
      VALUES ('admin@ledgerline.com', 'System Administrator', '+91-9876543210', 'ADMIN', 'ACTIVE', $1)
      RETURNING id;
    `, [adminPass]);
    const adminId = adminRes.rows[0].id;

    const auditorRes = await client.query(`
      INSERT INTO profiles (email, full_name, phone, role, status, password_hash)
      VALUES ('auditor@ledgerline.com', 'Senior Financial Auditor', '+91-9876543211', 'AUDITOR', 'ACTIVE', $1)
      RETURNING id;
    `, [auditorPass]);
    const auditorId = auditorRes.rows[0].id;

    const aliceRes = await client.query(`
      INSERT INTO profiles (email, full_name, phone, role, status, password_hash)
      VALUES ('alice@example.com', 'Alice Sharma', '+91-9876543212', 'ACCOUNT_HOLDER', 'ACTIVE', $1)
      RETURNING id;
    `, [userPass]);
    const aliceId = aliceRes.rows[0].id;

    const bobRes = await client.query(`
      INSERT INTO profiles (email, full_name, phone, role, status, password_hash)
      VALUES ('bob@example.com', 'Bob Patel', '+91-9876543213', 'ACCOUNT_HOLDER', 'ACTIVE', $1)
      RETURNING id;
    `, [userPass]);
    const bobId = bobRes.rows[0].id;

    const carolRes = await client.query(`
      INSERT INTO profiles (email, full_name, phone, role, status, password_hash)
      VALUES ('carol@example.com', 'Carol Verma', '+91-9876543214', 'ACCOUNT_HOLDER', 'ACTIVE', $1)
      RETURNING id;
    `, [userPass]);
    const carolId = carolRes.rows[0].id;

    // 2. System Reserve Account (Assets pool)
    const reserveRes = await client.query(`
      INSERT INTO accounts (account_number, user_id, account_type, currency, balance_paise, status)
      VALUES ('SYS-RESERVE-001', $1, 'SYSTEM_RESERVE', 'INR', 10000000000, 'ACTIVE')
      RETURNING id;
    `, [adminId]);
    const reserveAccountId = reserveRes.rows[0].id;

    // 3. User Accounts
    const aliceAccRes = await client.query(`
      INSERT INTO accounts (account_number, user_id, account_type, currency, balance_paise, status)
      VALUES ('LL-SAV-10001001', $1, 'SAVINGS', 'INR', 10000000, 'ACTIVE')
      RETURNING id;
    `, [aliceId]);
    const aliceAccountId = aliceAccRes.rows[0].id;

    const bobAccRes = await client.query(`
      INSERT INTO accounts (account_number, user_id, account_type, currency, balance_paise, status)
      VALUES ('LL-SAV-10001002', $1, 'SAVINGS', 'INR', 5000000, 'ACTIVE')
      RETURNING id;
    `, [bobId]);
    const bobAccountId = bobAccRes.rows[0].id;

    const carolAccRes = await client.query(`
      INSERT INTO accounts (account_number, user_id, account_type, currency, balance_paise, status)
      VALUES ('LL-CHK-10001003', $1, 'CHECKING', 'INR', 2500000, 'ACTIVE')
      RETURNING id;
    `, [carolId]);
    const carolAccountId = carolAccRes.rows[0].id;

    // 4. Initial Balanced Transactions & Double-Entry Ledger Entries
    // Initial Deposit for Alice (10,000,000 paise = 100,000 INR)
    const txnAliceRes = await client.query(`
      INSERT INTO transactions (
        reference_no, type, amount_paise, fee_paise, status,
        source_account_id, destination_account_id, description,
        created_by, completed_at
      ) VALUES (
        'TXN-INIT-ALICE01', 'DEPOSIT', 10000000, 0, 'COMPLETED',
        $1, $2, 'Initial account opening deposit',
        $3, NOW()
      ) RETURNING id;
    `, [reserveAccountId, aliceAccountId, adminId]);
    const txnAliceId = txnAliceRes.rows[0].id;

    await client.query(`
      INSERT INTO ledger_entries (transaction_id, account_id, entry_type, amount_paise, balance_after_paise, description)
      VALUES 
        ($1, $2, 'DEBIT', 10000000, 10010000000, 'System reserve debit for Alice deposit'),
        ($1, $3, 'CREDIT', 10000000, 10000000, 'Initial deposit credit');
    `, [txnAliceId, reserveAccountId, aliceAccountId]);

    // Initial Deposit for Bob (5,000,000 paise = 50,000 INR)
    const txnBobRes = await client.query(`
      INSERT INTO transactions (
        reference_no, type, amount_paise, fee_paise, status,
        source_account_id, destination_account_id, description,
        created_by, completed_at
      ) VALUES (
        'TXN-INIT-BOB0001', 'DEPOSIT', 5000000, 0, 'COMPLETED',
        $1, $2, 'Initial account opening deposit',
        $3, NOW()
      ) RETURNING id;
    `, [reserveAccountId, bobAccountId, adminId]);
    const txnBobId = txnBobRes.rows[0].id;

    await client.query(`
      INSERT INTO ledger_entries (transaction_id, account_id, entry_type, amount_paise, balance_after_paise, description)
      VALUES 
        ($1, $2, 'DEBIT', 5000000, 10015000000, 'System reserve debit for Bob deposit'),
        ($1, $3, 'CREDIT', 5000000, 5000000, 'Initial deposit credit');
    `, [txnBobId, reserveAccountId, bobAccountId]);

    // Initial Deposit for Carol (2,500,000 paise = 25,000 INR)
    const txnCarolRes = await client.query(`
      INSERT INTO transactions (
        reference_no, type, amount_paise, fee_paise, status,
        source_account_id, destination_account_id, description,
        created_by, completed_at
      ) VALUES (
        'TXN-INIT-CAROL01', 'DEPOSIT', 2500000, 0, 'COMPLETED',
        $1, $2, 'Initial account opening deposit',
        $3, NOW()
      ) RETURNING id;
    `, [reserveAccountId, carolAccountId, adminId]);
    const txnCarolId = txnCarolRes.rows[0].id;

    await client.query(`
      INSERT INTO ledger_entries (transaction_id, account_id, entry_type, amount_paise, balance_after_paise, description)
      VALUES 
        ($1, $2, 'DEBIT', 2500000, 10017500000, 'System reserve debit for Carol deposit'),
        ($1, $3, 'CREDIT', 2500000, 2500000, 'Initial deposit credit');
    `, [txnCarolId, reserveAccountId, carolAccountId]);

    // 5. Initial Audit Logs
    await client.query(`
      INSERT INTO audit_logs (user_id, action, entity_type, entity_id, status, old_data, new_data)
      VALUES 
        ($1, 'SYSTEM_INITIALIZED', 'SYSTEM', 'SYSTEM', 'SUCCESS', NULL, '{"version":"1.0.0"}'),
        ($1, 'ACCOUNT_CREATED', 'ACCOUNT', $2, 'SUCCESS', NULL, '{"account_number":"LL-SAV-10001001","owner":"Alice Sharma"}'),
        ($1, 'ACCOUNT_CREATED', 'ACCOUNT', $3, 'SUCCESS', NULL, '{"account_number":"LL-SAV-10001002","owner":"Bob Patel"}'),
        ($1, 'ACCOUNT_CREATED', 'ACCOUNT', $4, 'SUCCESS', NULL, '{"account_number":"LL-CHK-10001003","owner":"Carol Verma"}');
    `, [adminId, aliceAccountId, bobAccountId, carolAccountId]);

    // 6. Initial Welcome Notifications
    await client.query(`
      INSERT INTO notifications (user_id, title, message, type)
      VALUES 
        ($1, 'Welcome to LedgerLine', 'Your savings account LL-SAV-10001001 is active with initial balance ₹100,000.', 'SYSTEM'),
        ($2, 'Welcome to LedgerLine', 'Your savings account LL-SAV-10001002 is active with initial balance ₹50,000.', 'SYSTEM'),
        ($3, 'Welcome to LedgerLine', 'Your checking account LL-CHK-10001003 is active with initial balance ₹25,000.', 'SYSTEM');
    `, [aliceId, bobId, carolId]);

    await client.query('COMMIT');
    console.log('Seeding completed successfully!');
    console.log('Test Accounts created:');
    console.log('  Admin:   admin@ledgerline.com   / Admin@123456');
    console.log('  Auditor: auditor@ledgerline.com / Auditor@123456');
    console.log('  Alice:   alice@example.com      / Password@123456 (Balance: ₹1,00,000)');
    console.log('  Bob:     bob@example.com        / Password@123456 (Balance: ₹50,000)');
    console.log('  Carol:   carol@example.com      / Password@123456 (Balance: ₹25,000)');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Seeding failed:', err);
    throw err;
  } finally {
    client.release();
    await pool.end();
  }
}

seed().catch(() => process.exit(1));

