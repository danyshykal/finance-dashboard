-- =====================================================================
-- Finance Dashboard: SQL analytics layer (PostgreSQL 14+)
--
-- Adds reusable analytics on top of the app's tables (users, categories,
-- transactions) without changing them. Run it once against the app database:
--   psql -d finance_dashboard -f sql/analytics.sql
-- or open it in pgAdmin's Query Tool and press F5. Safe to re-run.
--
-- Every view keeps user_id, so the API can filter WHERE user_id = $1 and
-- each user still only ever sees their own data.
-- =====================================================================


-- Start clean so the file can always be re-run, even after a view changes
-- its columns (CREATE OR REPLACE VIEW can't do that on its own).
DROP MATERIALIZED VIEW IF EXISTS mv_monthly_summary;
DROP VIEW IF EXISTS v_category_trend, v_category_monthly, v_monthly_summary;
DROP FUNCTION IF EXISTS spending_report(INTEGER, DATE, DATE);


-- ---------------------------------------------------------------------
-- 1. Monthly summary per user
--    generate_series fills months with no transactions as 0, so month-over-
--    month change and moving averages compare real calendar months.
-- ---------------------------------------------------------------------
CREATE OR REPLACE VIEW v_monthly_summary AS
WITH bounds AS (
    SELECT user_id,
           date_trunc('month', MIN(date))::date AS first_month,
           date_trunc('month', MAX(date))::date AS last_month
    FROM transactions
    GROUP BY user_id
),
months AS (
    SELECT b.user_id, gs::date AS month
    FROM bounds b
    CROSS JOIN LATERAL generate_series(b.first_month, b.last_month, interval '1 month') AS gs
),
totals AS (
    SELECT t.user_id,
           date_trunc('month', t.date)::date                   AS month,
           SUM(t.amount) FILTER (WHERE c.type = 'income')      AS income,
           SUM(t.amount) FILTER (WHERE c.type = 'expense')     AS expense
    FROM transactions t
    JOIN categories c ON c.id = t.category_id
    GROUP BY 1, 2
),
filled AS (
    SELECT m.user_id,
           m.month,
           COALESCE(t.income, 0)                               AS income,
           COALESCE(t.expense, 0)                              AS expense
    FROM months m
    LEFT JOIN totals t USING (user_id, month)
)
SELECT
    user_id,
    month,
    month = date_trunc('month', CURRENT_DATE)::date          AS is_current_month,
    income,
    expense,
    income - expense                                         AS net,
    ROUND(100 * (income - expense) / NULLIF(income, 0), 1)   AS savings_rate_pct,
    SUM(income - expense) OVER w                             AS running_balance,
    expense - LAG(expense) OVER w                            AS expense_change,
    ROUND(100 * (expense - LAG(expense) OVER w)
              / NULLIF(LAG(expense) OVER w, 0), 1)           AS expense_change_pct,
    ROUND(AVG(expense) OVER (PARTITION BY user_id ORDER BY month
                             ROWS BETWEEN 2 PRECEDING AND CURRENT ROW), 2) AS expense_3m_avg
FROM filled
WINDOW w AS (PARTITION BY user_id ORDER BY month);


-- ---------------------------------------------------------------------
-- 2. Spending per expense category per month
--    Every month x every expense category (0 where nothing was spent), with
--    its share of that month's spending, its rank, and change vs last month.
-- ---------------------------------------------------------------------
CREATE OR REPLACE VIEW v_category_monthly AS
WITH grid AS (
    SELECT DISTINCT ms.user_id, ms.month, c.id AS category_id, c.name AS category
    FROM v_monthly_summary ms
    JOIN categories c ON c.user_id = ms.user_id AND c.type = 'expense'
),
spend AS (
    SELECT t.user_id, date_trunc('month', t.date)::date AS month, t.category_id,
           SUM(t.amount) AS amount, COUNT(*) AS transactions
    FROM transactions t
    GROUP BY 1, 2, 3
),
filled AS (
    SELECT g.user_id, g.month, g.category_id, g.category,
           COALESCE(s.amount, 0)       AS amount,
           COALESCE(s.transactions, 0) AS transactions
    FROM grid g
    LEFT JOIN spend s USING (user_id, month, category_id)
)
SELECT
    user_id,
    month,
    category_id,
    category,
    amount,
    transactions,
    ROUND(100 * amount / NULLIF(SUM(amount) OVER (PARTITION BY user_id, month), 0), 1) AS share_of_month_pct,
    RANK() OVER (PARTITION BY user_id, month ORDER BY amount DESC)                     AS rank_in_month,
    amount - LAG(amount) OVER (PARTITION BY user_id, category_id ORDER BY month)       AS change_vs_last_month
FROM filled;


-- ---------------------------------------------------------------------
-- 3. Category trend: last 3 full months vs the 3 before
--    The current (unfinished) month is left out, so it can't fake a drop.
--    Averages use only months the user has data for (a user who joined
--    2 months ago isn't divided by 3), and months_* shows how many.
-- ---------------------------------------------------------------------
CREATE OR REPLACE VIEW v_category_trend AS
WITH periods AS (
    SELECT user_id, category,
           CASE
             WHEN month >= date_trunc('month', CURRENT_DATE) - interval '3 months' THEN 'recent'
             WHEN month >= date_trunc('month', CURRENT_DATE) - interval '6 months' THEN 'previous'
           END AS period,
           amount
    FROM v_category_monthly
    WHERE month <  date_trunc('month', CURRENT_DATE)
      AND month >= date_trunc('month', CURRENT_DATE) - interval '6 months'
)
SELECT
    user_id,
    category,
    COUNT(*) FILTER (WHERE period = 'previous')                   AS months_previous,
    COUNT(*) FILTER (WHERE period = 'recent')                     AS months_recent,
    ROUND(AVG(amount) FILTER (WHERE period = 'previous'), 2)      AS avg_monthly_previous,
    ROUND(AVG(amount) FILTER (WHERE period = 'recent'), 2)        AS avg_monthly_recent,
    ROUND(100 * (AVG(amount) FILTER (WHERE period = 'recent')
               - AVG(amount) FILTER (WHERE period = 'previous'))
              / NULLIF(AVG(amount) FILTER (WHERE period = 'previous'), 0), 1) AS change_pct
FROM periods
GROUP BY user_id, category;


-- ---------------------------------------------------------------------
-- 4. Function: spending report for any user and date range
--    SELECT * FROM spending_report(1, '2026-06-01', '2026-11-30');
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION spending_report(p_user_id INTEGER, p_from DATE, p_to DATE)
RETURNS TABLE (
    category        TEXT,
    type            TEXT,
    total           NUMERIC,
    share_pct       NUMERIC,
    transactions    INTEGER,
    avg_transaction NUMERIC,
    largest         NUMERIC
)
LANGUAGE sql
STABLE
AS $$
    SELECT
        c.name,
        c.type,
        SUM(t.amount),
        ROUND(100 * SUM(t.amount) / SUM(SUM(t.amount)) OVER (PARTITION BY c.type), 1),
        COUNT(*)::int,
        ROUND(AVG(t.amount), 2),
        MAX(t.amount)
    FROM transactions t
    JOIN categories c ON c.id = t.category_id
    WHERE t.user_id = p_user_id
      AND t.date BETWEEN p_from AND p_to
    GROUP BY c.name, c.type
    ORDER BY c.type DESC, SUM(t.amount) DESC;
$$;


-- ---------------------------------------------------------------------
-- 5. Materialized view: a cached copy of the monthly summary
--    Fast to read for dashboards; refresh it after new data arrives:
--      REFRESH MATERIALIZED VIEW CONCURRENTLY mv_monthly_summary;
--    (CONCURRENTLY keeps it readable during the refresh; it needs the
--     unique index below.)
-- ---------------------------------------------------------------------
CREATE MATERIALIZED VIEW mv_monthly_summary AS
SELECT * FROM v_monthly_summary;

CREATE UNIQUE INDEX mv_monthly_summary_pk ON mv_monthly_summary (user_id, month);
