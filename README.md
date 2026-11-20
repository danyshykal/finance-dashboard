# Finance Dashboard

A personal finance dashboard for tracking income and expenses, with charts.

**Stack:** React (Vite) · Node.js + Express · PostgreSQL · Chart.js

🔗 **Live demo:** <https://finance-dashboard-three-smoky.vercel.app/> (log in with the demo account: **demo@example.com** / **demo1234**. The API is on a free tier, so the first load can take about 30 seconds.)

![Dashboard](docs/screenshots/dashboard-light.png)

| Login | Dark mode | Mobile |
| --- | --- | --- |
| ![Login page](docs/screenshots/login.png) | ![Dashboard in dark mode](docs/screenshots/dashboard-dark.png) | ![Transactions on a phone](docs/screenshots/mobile.png) |

## Features

- Sign up / log in (passwords hashed with bcrypt, JWT login tokens), with a one-click demo account
- Add, edit and delete income and expense transactions
- Balance card with savings rate, plus income, expense and transaction totals
- Charts: income vs. expenses per month (bar), spending by category (doughnut with total), running balance (area line)
- Date range filter with quick presets (This month, 3 months, 6 months, This year, All time)
- Search transactions and filter them by category
- Manage your own categories with colors
- Export the shown transactions to CSV (opens in Excel)
- Light / dark mode switch (defaults to your system setting)
- Pop-up confirmations for every change, responsive layout for phones
- Each user only ever sees their own data

## SQL analytics layer

![SQL analytics output](docs/screenshots/sql-analytics.png)

[`sql/analytics.sql`](sql/analytics.sql) adds reusable PostgreSQL analytics on top of the app's tables, without changing them:

| Object | What it answers | PostgreSQL features |
| --- | --- | --- |
| `v_monthly_summary` | Income, spending, net and savings rate per month, with running balance, month-over-month change and a 3-month moving average | `generate_series` to fill empty months, window functions (`LAG`, running `SUM`, `AVG ... ROWS BETWEEN 2 PRECEDING`), named `WINDOW` |
| `v_category_monthly` | Each category's spending per month, share of the month, rank, and change vs last month | `CROSS JOIN` grid so missing months count as 0, `RANK() OVER (PARTITION BY ...)` |
| `v_category_trend` | Which categories grew or shrank: last 3 full months vs the 3 before | `FILTER` aggregates, excludes the unfinished current month |
| `spending_report(user, from, to)` | A category breakdown for any date range | SQL function returning a table |
| `mv_monthly_summary` | A cached copy of the monthly summary for fast dashboards | Materialized view, unique index, `REFRESH ... CONCURRENTLY` |

Every view keeps `user_id`, so the API can filter by the logged-in user and data stays private.

**Example** (demo account; the seed data is random, so your numbers will differ):

```sql
SELECT month, income, expense, savings_rate_pct, expense_change_pct, expense_3m_avg
FROM v_monthly_summary
WHERE user_id = (SELECT id FROM users WHERE email = 'demo@example.com')
ORDER BY month;
```

| month | income | expense | savings_rate_pct | expense_change_pct | expense_3m_avg |
| --- | --- | --- | --- | --- | --- |
| 2026-06-01 | 5597.21 | 2794.77 | 50.1 | | 2794.77 |
| 2026-07-01 | 4500.00 | 2549.91 | 43.3 | -8.8 | 2672.34 |
| 2026-08-01 | 5227.21 | 2448.03 | 53.2 | -4.0 | 2597.57 |
| 2026-09-01 | 4500.00 | 2515.97 | 44.1 | 2.8 | 2504.64 |
| 2026-10-01 | 4500.00 | 2791.32 | 38.0 | 10.9 | 2585.11 |

**Design decisions**
- **Empty months count as 0.** Without `generate_series`, a month with no transactions would simply be missing, and "change vs last month" would silently compare against two months ago.
- **The current month is flagged** (`is_current_month`) and left out of trends, because a half-finished month always looks like a drop in spending.
- **Trend averages use only months with data**, so a user who joined two months ago isn't divided by three.
- Tested against the seeded demo account plus a second user with a month of no transactions; view totals reconcile exactly with the raw `transactions` table.

**Run it** (after `npm run db:init` and `npm run db:seed`):
```bash
psql -U postgres -d finance_dashboard -f sql/analytics.sql
```
Or open the file in pgAdmin's Query Tool and press F5. It's safe to re-run.

## Requirements

- [Node.js](https://nodejs.org) 20 or newer
- [PostgreSQL](https://www.postgresql.org/download/windows/) 14 or newer

## Setup

### 1. Install PostgreSQL (Windows)

1. Download the installer from <https://www.postgresql.org/download/windows/> and run it.
2. Keep the default components and the default port **5432**.
3. Choose a password for the `postgres` user and **remember it**. You need it in step 2.

### 2. Configure the server

```bash
cd server
copy .env.example .env      # macOS/Linux: cp .env.example .env
```

Open `server/.env` and replace `YOUR_PASSWORD` in `DATABASE_URL` with your PostgreSQL password. Set `JWT_SECRET` to any long random string.

### 3. Install dependencies

```bash
cd server
npm install
cd ../client
npm install
```

### 4. Create the database and demo data

```bash
cd server
npm run db:init    # creates the finance_dashboard database and its tables
npm run db:seed    # optional: demo account with 6 months of sample data
```

Demo login: **demo@example.com** / **demo1234**

### 5. Run it

Open two terminals:

```bash
# Terminal 1
cd server
npm run dev        # API on http://localhost:5000
```

```bash
# Terminal 2
cd client
npm run dev        # app on http://localhost:5173
```

Open <http://localhost:5173>.

## Deploying (free)

The app is split across three free services: **Neon** (PostgreSQL), **Render** (the API) and **Vercel** (the React app). Push the project to GitHub first.

### 1. Database: Neon

1. Sign up at <https://neon.tech> and create a project.
2. Copy the connection string. It looks like `postgres://user:password@ep-....neon.tech/neondb?sslmode=require`.
3. Create the tables from your computer: put that string in `server/.env` as `DATABASE_URL`, set `DATABASE_SSL=true`, then run `npm run db:init` (and `npm run db:seed` for the demo account). Switch `.env` back to your local database afterwards.

### 2. API: Render

1. Sign up at <https://render.com>, click **New → Blueprint** and pick your GitHub repository. Render reads `render.yaml`.
2. When asked, set `DATABASE_URL` to the Neon connection string. Leave `CLIENT_URL` for now; it's filled in after step 3.
3. When it's live, open `https://<your-api>.onrender.com/api/health`. It should show `{"ok":true}`.

Free Render services sleep when unused, so the first request after a break takes about 30 seconds.

### 3. React app: Vercel

1. Sign up at <https://vercel.com>, click **Add New → Project** and import the repository.
2. Set **Root Directory** to `client`. Vercel detects Vite automatically.
3. Add the environment variable `VITE_API_URL` = `https://<your-api>.onrender.com` (without `/api`), then deploy.
4. Go back to Render and set `CLIENT_URL` to your Vercel address, e.g. `https://finance-dashboard.vercel.app`. Separate several addresses with commas.

## API

All endpoints except `/api/health`, `/api/auth/register` and `/api/auth/login` need an `Authorization: Bearer <token>` header.

| Method | Endpoint | Description |
| --- | --- | --- |
| GET | `/api/health` | Health check |
| POST | `/api/auth/register` | Create an account `{ name, email, password }` |
| POST | `/api/auth/login` | Log in `{ email, password }` |
| GET | `/api/auth/me` | Current user |
| GET | `/api/categories` | List categories |
| POST | `/api/categories` | Create a category `{ name, type, color }` |
| DELETE | `/api/categories/:id` | Delete a category (only if it has no transactions) |
| GET | `/api/transactions` | List transactions (`?from=&to=&category_id=&type=`) |
| POST | `/api/transactions` | Create a transaction `{ category_id, amount, date, note }` |
| PUT | `/api/transactions/:id` | Update a transaction |
| DELETE | `/api/transactions/:id` | Delete a transaction |
| GET | `/api/summary` | Totals, spending by category and monthly figures (`?from=&to=`) |

## Project structure

```
finance-dashboard/
├── client/                 React app (Vite)
│   └── src/
│       ├── components/     Charts, summary cards, forms, lists, icons
│       ├── context/        Login state and pop-up messages
│       ├── pages/          Login/register and dashboard pages
│       ├── api.js          fetch wrapper that adds the login token
│       ├── csv.js          CSV export
│       ├── format.js       Money and date formatting (change the currency here)
│       ├── theme.js        Chart colors and light/dark mode
│       └── index.css       Styles
├── docs/screenshots/       Images used in this README
├── render.yaml             Render deployment settings for the API
├── sql/analytics.sql       Analytics views, function and materialized view
└── server/                 Express API
    └── src/
        ├── db/             Schema, connection pool, init and seed scripts
        ├── middleware/     JWT auth check
        ├── routes/         auth, categories, transactions, summary
        └── index.js        App entry point
```

## Changing the currency

Edit the two lines at the top of `client/src/format.js`, for example `'MYR'` and `'en-MY'`.

## Troubleshooting

- **`password authentication failed`**: the password in `DATABASE_URL` doesn't match your PostgreSQL password.
- **`ECONNREFUSED 127.0.0.1:5432`**: PostgreSQL isn't running. Start the `postgresql-x64-…` service from Windows *Services*.
- **npm fails with `Class extends value undefined is not a constructor or null`**: your Node.js install is damaged. Reinstall the current LTS version from <https://nodejs.org> (the installer's *Repair* option also works).
