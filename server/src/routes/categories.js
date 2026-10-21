import { Router } from 'express';
import { query } from '../db/pool.js';

const router = Router();

router.get('/', async (req, res) => {
  const { rows } = await query(
    'SELECT id, name, type, color FROM categories WHERE user_id = $1 ORDER BY type, name',
    [req.userId],
  );
  res.json(rows);
});

router.post('/', async (req, res) => {
  const name = req.body.name?.trim();
  const { type, color = '#6366f1' } = req.body;
  if (!name || !['income', 'expense'].includes(type)) {
    return res.status(400).json({ error: 'Name and type (income or expense) are required' });
  }
  try {
    const { rows: [category] } = await query(
      'INSERT INTO categories (user_id, name, type, color) VALUES ($1, $2, $3, $4) RETURNING id, name, type, color',
      [req.userId, name, type, color],
    );
    res.status(201).json(category);
  } catch (err) {
    if (err.code === '23505') return res.status(409).json({ error: 'That category already exists' });
    throw err;
  }
});

router.delete('/:id', async (req, res) => {
  try {
    const { rowCount } = await query('DELETE FROM categories WHERE id = $1 AND user_id = $2', [
      req.params.id,
      req.userId,
    ]);
    if (!rowCount) return res.status(404).json({ error: 'Category not found' });
    res.status(204).end();
  } catch (err) {
    if (err.code === '23503') {
      return res.status(409).json({ error: 'This category still has transactions. Delete or move them first.' });
    }
    throw err;
  }
});

export default router;
