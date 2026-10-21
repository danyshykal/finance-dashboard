// Creates the database (if it doesn't exist yet) and its tables.
// Run with: npm run db:init
import 'dotenv/config';
import fs from 'node:fs/promises';
import pg from 'pg';
import { ssl } from './pool.js';

if (!process.env.DATABASE_URL) {
  console.error('DATABASE_URL is missing. Copy .env.example to .env and fill it in.');
  process.exit(1);
}

const url = new URL(process.env.DATABASE_URL);
const dbName = decodeURIComponent(url.pathname.slice(1));

// 1. Create the database itself. Cloud providers usually create it for you
//    and may not allow this, so a failure here is not fatal.
try {
  const adminUrl = new URL(url);
  adminUrl.pathname = '/postgres';
  const admin = new pg.Client({ connectionString: adminUrl.toString(), ssl });
  await admin.connect();
  const { rowCount } = await admin.query('SELECT 1 FROM pg_database WHERE datname = $1', [dbName]);
  if (rowCount === 0) {
    await admin.query(`CREATE DATABASE "${dbName.replace(/"/g, '""')}"`);
    console.log(`Created database "${dbName}"`);
  }
  await admin.end();
} catch (err) {
  console.warn(`Could not check/create database "${dbName}" (${err.message}). Continuing...`);
}

// 2. Create the tables.
const client = new pg.Client({ connectionString: url.toString(), ssl });
try {
  await client.connect();
  const schema = await fs.readFile(new URL('./schema.sql', import.meta.url), 'utf8');
  await client.query(schema);
  console.log('Tables are ready.');
} catch (err) {
  console.error('Failed to set up tables:', err.message);
  process.exitCode = 1;
} finally {
  await client.end();
}
