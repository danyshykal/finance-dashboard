// Creates a demo account with 6 months of realistic sample data.
// Run with: npm run db:seed   (login: demo@example.com / demo1234)
import bcrypt from 'bcryptjs';
import { pool } from './pool.js';
import { createDefaultCategories } from './defaultCategories.js';

const DEMO_EMAIL = 'demo@example.com';
const DEMO_PASSWORD = 'demo1234';

const rand = (min, max) => Math.round((min + Math.random() * (max - min)) * 100) / 100;
const pad = (n) => String(n).padStart(2, '0');

const client = await pool.connect();
try {
  await client.query('BEGIN');
  await client.query('DELETE FROM users WHERE email = $1', [DEMO_EMAIL]);

  const hash = await bcrypt.hash(DEMO_PASSWORD, 10);
  const { rows: [user] } = await client.query(
    'INSERT INTO users (name, email, password_hash) VALUES ($1, $2, $3) RETURNING id',
    ['Demo User', DEMO_EMAIL, hash],
  );
  await createDefaultCategories(client, user.id);

  const { rows: cats } = await client.query('SELECT id, name FROM categories WHERE user_id = $1', [user.id]);
  const cat = Object.fromEntries(cats.map((c) => [c.name, c.id]));

  const txs = [];
  const add = (category, amount, date, note) => txs.push([cat[category], amount, date, note]);

  const today = new Date();
  for (let back = 5; back >= 0; back--) {
    const month = new Date(today.getFullYear(), today.getMonth() - back, 1);
    const y = month.getFullYear();
    const m = month.getMonth() + 1;
    const lastDay = back === 0 ? today.getDate() : new Date(y, m, 0).getDate();
    const day = (d) => `${y}-${pad(m)}-${pad(Math.min(d, lastDay))}`;
    const randomDay = () => day(1 + Math.floor(Math.random() * lastDay));

    add('Salary', 4500, day(1), 'Monthly salary');
    add('Rent', 1400, day(1), 'Apartment rent');
    add('Bills', rand(90, 140), day(5), 'Electricity & water');
    add('Bills', 45, day(10), 'Internet');
    if (Math.random() < 0.6) add('Freelance', rand(300, 1200), randomDay(), 'Freelance project');
    for (let i = 0; i < 14; i++) add('Food', rand(8, 55), randomDay(), i % 4 === 0 ? 'Groceries' : 'Eating out');
    for (let i = 0; i < 8; i++) add('Transport', rand(5, 30), randomDay(), 'Ride / fuel');
    for (let i = 0; i < 3; i++) add('Shopping', rand(25, 180), randomDay(), 'Shopping');
    for (let i = 0; i < 3; i++) add('Entertainment', rand(10, 60), randomDay(), 'Movies / games');
  }

  for (const [categoryId, amount, date, note] of txs) {
    await client.query(
      'INSERT INTO transactions (user_id, category_id, amount, date, note) VALUES ($1, $2, $3, $4, $5)',
      [user.id, categoryId, amount, date, note],
    );
  }

  await client.query('COMMIT');
  console.log(`Seeded ${txs.length} transactions. Log in with ${DEMO_EMAIL} / ${DEMO_PASSWORD}`);
} catch (err) {
  await client.query('ROLLBACK');
  console.error('Seeding failed:', err.message);
  process.exitCode = 1;
} finally {
  client.release();
  await pool.end();
}
