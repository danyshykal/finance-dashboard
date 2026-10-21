import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { requireAuth } from './middleware/auth.js';
import authRoutes from './routes/auth.js';
import categoryRoutes from './routes/categories.js';
import transactionRoutes from './routes/transactions.js';
import summaryRoutes from './routes/summary.js';

for (const name of ['DATABASE_URL', 'JWT_SECRET']) {
  if (!process.env[name]) {
    console.error(`${name} is missing. Copy .env.example to .env and fill it in.`);
    process.exit(1);
  }
}

const app = express();
// CLIENT_URL may list several sites, separated by commas.
const allowedOrigins = (process.env.CLIENT_URL || 'http://localhost:5173').split(',').map((url) => url.trim());
app.use(cors({ origin: allowedOrigins }));
app.use(express.json());

app.get('/api/health', (req, res) => res.json({ ok: true }));
app.use('/api/auth', authRoutes);
app.use('/api/categories', requireAuth, categoryRoutes);
app.use('/api/transactions', requireAuth, transactionRoutes);
app.use('/api/summary', requireAuth, summaryRoutes);

app.use((req, res) => res.status(404).json({ error: 'Not found' }));

// Express 5 sends errors thrown in async routes here automatically.
app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: 'Something went wrong on the server' });
});

const port = process.env.PORT || 5000;
app.listen(port, () => console.log(`API running on http://localhost:${port}`));
