import { Router } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { pool, query } from '../db/pool.js';
import { createDefaultCategories } from '../db/defaultCategories.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();

const signToken = (userId) =>
  jwt.sign({ sub: String(userId) }, process.env.JWT_SECRET, { expiresIn: '7d' });

router.post('/register', async (req, res) => {
  const name = req.body.name?.trim();
  const email = req.body.email?.trim().toLowerCase();
  const password = req.body.password || '';

  if (!name || !email || !email.includes('@')) {
    return res.status(400).json({ error: 'Name and a valid email are required' });
  }
  if (password.length < 6) {
    return res.status(400).json({ error: 'Password must be at least 6 characters' });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const hash = await bcrypt.hash(password, 10);
    const { rows: [user] } = await client.query(
      'INSERT INTO users (name, email, password_hash) VALUES ($1, $2, $3) RETURNING id, name, email',
      [name, email, hash],
    );
    await createDefaultCategories(client, user.id);
    await client.query('COMMIT');
    res.status(201).json({ token: signToken(user.id), user });
  } catch (err) {
    await client.query('ROLLBACK');
    if (err.code === '23505') return res.status(409).json({ error: 'That email is already registered' });
    throw err;
  } finally {
    client.release();
  }
});

router.post('/login', async (req, res) => {
  const email = req.body.email?.trim().toLowerCase();
  const password = req.body.password || '';

  const { rows: [user] } = await query('SELECT * FROM users WHERE email = $1', [email]);
  if (!user || !(await bcrypt.compare(password, user.password_hash))) {
    return res.status(401).json({ error: 'Wrong email or password' });
  }
  res.json({ token: signToken(user.id), user: { id: user.id, name: user.name, email: user.email } });
});

router.get('/me', requireAuth, async (req, res) => {
  const { rows: [user] } = await query('SELECT id, name, email FROM users WHERE id = $1', [req.userId]);
  if (!user) return res.status(404).json({ error: 'User not found' });
  res.json({ user });
});

export default router;
