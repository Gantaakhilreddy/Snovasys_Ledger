import pg from 'pg';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const { Pool } = pg;

console.log('Connecting to:', process.env.DATABASE_URL?.replace(/:[^:]*@/, ':****@'));

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false
  }
});

async function testConnection() {
  try {
    const client = await pool.connect();
    console.log('Successfully connected to Supabase PostgreSQL!');
    const res = await client.query('SELECT version();');
    console.log('PostgreSQL Version:', res.rows[0].version);
    const tables = await client.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public';
    `);
    console.log('Existing tables in public schema:', tables.rows.map(r => r.table_name));
    client.release();
    await pool.end();
  } catch (err) {
    console.error('Connection error:', err);
    process.exit(1);
  }
}

testConnection();

