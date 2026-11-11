import fs from 'fs';
import path from 'path';
import pg from 'pg';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const { Pool } = pg;

if (!process.env.DATABASE_URL) {
  console.error('ERROR: DATABASE_URL is not set in environment or .env.local');
  process.exit(1);
}

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false
  }
});

async function runMigrations() {
  const client = await pool.connect();
  try {
    console.log('Connecting to database for migrations...');
    
    // Create migrations tracker table if not exists
    await client.query(`
      CREATE TABLE IF NOT EXISTS _schema_migrations (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) UNIQUE NOT NULL,
        applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);

    const migrationsDir = path.resolve('supabase/migrations');
    const files = fs.readdirSync(migrationsDir).sort();

    for (const file of files) {
      if (!file.endsWith('.sql')) continue;

      const check = await client.query('SELECT 1 FROM _schema_migrations WHERE name = $1', [file]);
      if (check.rows.length > 0) {
        console.log(`[SKIP] Migration already applied: ${file}`);
        continue;
      }

      console.log(`[APPLYING] Migration: ${file}...`);
      const sql = fs.readFileSync(path.join(migrationsDir, file), 'utf8');
      
      await client.query('BEGIN');
      try {
        await client.query(sql);
        await client.query('INSERT INTO _schema_migrations (name) VALUES ($1)', [file]);
        await client.query('COMMIT');
        console.log(`[SUCCESS] Migration applied: ${file}`);
      } catch (err) {
        await client.query('ROLLBACK');
        console.error(`[FAILED] Migration ${file} failed:`, err);
        throw err;
      }
    }

    console.log('All migrations applied successfully!');
  } finally {
    client.release();
    await pool.end();
  }
}

runMigrations().catch((err) => {
  console.error('Migration failed:', err);
  process.exit(1);
});

