import 'dotenv/config';
import pg from 'pg';

// Return NUMERIC columns as JS numbers and DATE columns as 'YYYY-MM-DD' strings
// (the default would be strings and timezone-shifted Date objects).
pg.types.setTypeParser(1700, parseFloat);
pg.types.setTypeParser(1082, (value) => value);

export const ssl = process.env.DATABASE_SSL === 'true' ? { rejectUnauthorized: false } : undefined;

export const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  ssl,
});

export const query = (text, params) => pool.query(text, params);
