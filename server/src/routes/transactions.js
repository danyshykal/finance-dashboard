import { Router } from 'express';
import { query } from '../db/pool.js';

const router = Router();

const SELECT_TRANSACTION = `
  SELECT t.id, t.amount, t.date, t.note, t.category_id,
         c.name AS category_name, c.type, c.color
  FROM transactions t
  JOIN categories c ON c.id = t.category_id`;

// Validates the request body and checks the category belongs to the user.
async function parseBody(req) {
  const amount = Number(req.body.amount);
  const categoryId = Number(req.body.category_id);
  const { date } = req.body;
  const note = req.body.note?.trim() || null;

  if (!(amount > 0)) return { error: 'Amount must be a positive number' };
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date || '')) return { error: 'Date must be YYYY-MM-DD' };

  const { rowCount } = await query('SELECT 1 FROM categories WHERE id = $1 AND user_id = $2', [
    categoryId,
    req.userId,
  ]);
  if (!rowCount) return { error: 'Unknown category' };

  return { values: [categoryId, amount, date, note] };
}

// GET /api/transactions?from=2026-01-01&to=2026-06-30&category_id=3&type=expense
router.get('/', async (req, res) => {
  const where = ['t.user_id = $1'];
  const params = [req.userId];
  const filter = (sql, value) => {
    params.push(value);
    where.push(`${sql} $${params.length}`);
  };

  if (req.query.from) filter('t.date >=', req.query.from);
  if (req.query.to) filter('t.date <=', req.query.to);
  if (req.query.category_id) filter('t.category_id =', req.query.category_id);
  if (req.query.type) filter('c.type =', req.query.type);

  const { rows } = await query(
    `${SELECT_TRANSACTION} WHERE ${where.join(' AND ')} ORDER BY t.date DESC, t.id DESC`,
    params,
  );
  res.json(rows);
});

router.post('/', async (req, res) => {
  const { error, values } = await parseBody(req);
  if (error) return res.status(400).json({ error });

  const { rows: [{ id }] } = await query(
    'INSERT INTO transactions (user_id, category_id, amount, date, note) VALUES ($1, $2, $3, $4, $5) RETURNING id',
    [req.userId, ...values],
  );
  const { rows: [transaction] } = await query(`${SELECT_TRANSACTION} WHERE t.id = $1`, [id]);
  res.status(201).json(transaction);
});

router.put('/:id', async (req, res) => {
  const { error, values } = await parseBody(req);
  if (error) return res.status(400).json({ error });

  const { rowCount } = await query(
    `UPDATE transactions SET category_id = $3, amount = $4, date = $5, note = $6
     WHERE id = $1 AND user_id = $2`,
    [req.params.id, req.userId, ...values],
  );
  if (!rowCount) return res.status(404).json({ error: 'Transaction not found' });

  const { rows: [transaction] } = await query(`${SELECT_TRANSACTION} WHERE t.id = $1`, [req.params.id]);
  res.json(transaction);
});

router.delete('/:id', async (req, res) => {
  const { rowCount } = await query('DELETE FROM transactions WHERE id = $1 AND user_id = $2', [
    req.params.id,
    req.userId,
  ]);
  if (!rowCount) return res.status(404).json({ error: 'Transaction not found' });
  res.status(204).end();
});

export default router;
