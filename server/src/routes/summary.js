import { Router } from 'express';
import { query } from '../db/pool.js';

const router = Router();

// GET /api/summary?from=2026-01-01&to=2026-06-30
// Everything the dashboard charts need, in one request.
router.get('/', async (req, res) => {
  const where = ['t.user_id = $1'];
  const params = [req.userId];
  if (req.query.from) {
    params.push(req.query.from);
    where.push(`t.date >= $${params.length}`);
  }
  if (req.query.to) {
    params.push(req.query.to);
    where.push(`t.date <= $${params.length}`);
  }
  const from = `FROM transactions t JOIN categories c ON c.id = t.category_id WHERE ${where.join(' AND ')}`;

  const [totals, byCategory, monthly] = await Promise.all([
    query(
      `SELECT COALESCE(SUM(t.amount) FILTER (WHERE c.type = 'income'), 0)  AS income,
              COALESCE(SUM(t.amount) FILTER (WHERE c.type = 'expense'), 0) AS expense,
              COUNT(*)::int AS count
       ${from}`,
      params,
    ),
    query(
      `SELECT c.id, c.name, c.color, SUM(t.amount) AS total
       ${from} AND c.type = 'expense'
       GROUP BY c.id ORDER BY total DESC`,
      params,
    ),
    query(
      `SELECT to_char(date_trunc('month', t.date), 'YYYY-MM') AS month,
              COALESCE(SUM(t.amount) FILTER (WHERE c.type = 'income'), 0)  AS income,
              COALESCE(SUM(t.amount) FILTER (WHERE c.type = 'expense'), 0) AS expense
       ${from}
       GROUP BY 1 ORDER BY 1`,
      params,
    ),
  ]);

  const { income, expense, count } = totals.rows[0];
  res.json({
    totals: { income, expense, balance: income - expense, count },
    byCategory: byCategory.rows,
    monthly: monthly.rows,
  });
});

export default router;
