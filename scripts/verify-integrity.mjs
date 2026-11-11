import pg from 'pg';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const { Pool } = pg;

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false
  }
});

async function checkIntegrity() {
  const client = await pool.connect();
  try {
    console.log('Executing verify_system_integrity()...');
    const res = await client.query('SELECT verify_system_integrity() AS report;');
    console.log('Integrity Verification Report:');
    console.log(JSON.stringify(res.rows[0].report, null, 2));
  } finally {
    client.release();
    await pool.end();
  }
}

checkIntegrity().catch((err) => {
  console.error('Integrity check failed:', err);
  process.exit(1);
});

