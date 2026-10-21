import { useCallback, useEffect, useRef, useState } from 'react';
import { api, toQuery } from '../api.js';
import { useAuth } from '../context/AuthContext.jsx';
import { useToast } from '../context/ToastContext.jsx';
import { downloadCsv } from '../csv.js';
import { formatDate, isoDate, today } from '../format.js';
import { toggleTheme, useDarkMode } from '../theme.js';
import Icon, { Logo } from '../components/Icon.jsx';
import SummaryCards from '../components/SummaryCards.jsx';
import { BalanceLineChart, CategoryDoughnut, MonthlyBarChart } from '../components/Charts.jsx';
import CategoryManager from '../components/CategoryManager.jsx';
import TransactionForm from '../components/TransactionForm.jsx';
import TransactionList from '../components/TransactionList.jsx';

// First day of the month, `back` months ago.
const monthStart = (back) => {
  const now = new Date();
  return isoDate(new Date(now.getFullYear(), now.getMonth() - back, 1));
};

const PRESETS = [
  { label: 'This month', from: () => monthStart(0) },
  { label: '3 months', from: () => monthStart(2) },
  { label: '6 months', from: () => monthStart(5) },
  { label: 'This year', from: () => `${new Date().getFullYear()}-01-01` },
  { label: 'All time', from: () => '' },
];

const NAV = [
  { id: 'overview', label: 'Overview', icon: 'overview' },
  { id: 'transactions', label: 'Transactions', icon: 'list' },
  { id: 'categories', label: 'Categories', icon: 'tag' },
];

const greeting = () => {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 18) return 'Good afternoon';
  return 'Good evening';
};

const initials = (name) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0].toUpperCase())
    .join('');

export default function Dashboard() {
  const { user, logout } = useAuth();
  const showToast = useToast();
  const dark = useDarkMode();
  const formRef = useRef(null);
  const [range, setRange] = useState({ from: monthStart(5), to: today() });
  const [categoryId, setCategoryId] = useState('');
  const [search, setSearch] = useState('');
  const [categories, setCategories] = useState([]);
  const [summary, setSummary] = useState(null);
  const [transactions, setTransactions] = useState([]);
  const [editing, setEditing] = useState(null);
  const [error, setError] = useState('');

  const loadCategories = useCallback(async () => {
    try {
      const list = await api('/categories');
      setCategories(list);
      // Clear the list filter if its category was deleted.
      setCategoryId((id) => (list.some((c) => String(c.id) === id) ? id : ''));
    } catch (err) {
      setError(err.message);
    }
  }, []);

  useEffect(() => {
    loadCategories();
  }, [loadCategories]);

  const load = useCallback(async () => {
    try {
      const [s, t] = await Promise.all([
        api(`/summary${toQuery(range)}`),
        api(`/transactions${toQuery({ ...range, category_id: categoryId })}`),
      ]);
      setSummary(s);
      setTransactions(t);
      setError('');
    } catch (err) {
      if (err.status === 401) logout();
      setError(err.message);
    }
  }, [range, categoryId, logout]);

  useEffect(() => {
    load();
  }, [load]);

  // Brings the form into view and puts the cursor in it.
  const focusForm = () => {
    formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    formRef.current?.querySelector('input[name="amount"]')?.focus({ preventScroll: true });
  };

  const startEdit = (tx) => {
    setEditing(tx);
    focusForm();
  };

  const remove = async (tx) => {
    if (!confirm(`Delete this transaction?`)) return;
    try {
      await api(`/transactions/${tx.id}`, { method: 'DELETE' });
      if (editing?.id === tx.id) setEditing(null);
      showToast('Transaction deleted');
      load();
    } catch (err) {
      showToast(err.message, 'error');
    }
  };

  const term = search.trim().toLowerCase();
  const shown = term
    ? transactions.filter((tx) => `${tx.note || ''} ${tx.category_name}`.toLowerCase().includes(term))
    : transactions;

  const exportCsv = () => {
    const rows = [
      ['Date', 'Type', 'Category', 'Note', 'Amount'],
      ...shown.map((tx) => [tx.date, tx.type, tx.category_name, tx.note, tx.amount]),
    ];
    downloadCsv(`transactions_${range.from || 'start'}_${range.to || today()}.csv`, rows);
    showToast(`Exported ${shown.length} transactions`);
  };

  const rangeText = range.from
    ? `${formatDate(range.from)} – ${range.to ? formatDate(range.to) : 'today'}`
    : 'All time';

  return (
    <div className="app">
      <aside className="sidebar">
        <div className="brand">
          <Logo /> <span>Finance</span>
        </div>
        <nav className="nav" aria-label="Sections">
          {NAV.map((item) => (
            <a key={item.id} href={`#${item.id}`}>
              <Icon name={item.icon} /> <span>{item.label}</span>
            </a>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <button className="nav-btn" onClick={toggleTheme} aria-label={dark ? 'Switch to light mode' : 'Switch to dark mode'}>
            <Icon name={dark ? 'sun' : 'moon'} /> <span>{dark ? 'Light mode' : 'Dark mode'}</span>
          </button>
          <div className="user-card">
            <span className="avatar" aria-hidden="true">{initials(user.name)}</span>
            <div className="user-text">
              <strong>{user.name}</strong>
              <span>{user.email}</span>
            </div>
            <button className="icon-btn" onClick={logout} aria-label="Log out" title="Log out">
              <Icon name="logout" />
            </button>
          </div>
        </div>
      </aside>

      <main className="main">
        <header className="page-head" id="overview">
          <div>
            <p className="eyebrow">{greeting()}</p>
            <h1>Hi, {user.name.split(' ')[0]} 👋</h1>
            <p className="muted">Here's how your money is doing.</p>
          </div>
          <button className="btn primary" onClick={focusForm}>
            <Icon name="plus" size={16} /> Add transaction
          </button>
        </header>

        <section className="toolbar card">
          <div className="presets" role="group" aria-label="Date range presets">
            {PRESETS.map((p) => {
              const from = p.from();
              const active = range.from === from && range.to === today();
              return (
                <button
                  key={p.label}
                  className={`chip${active ? ' active' : ''}`}
                  aria-pressed={active}
                  onClick={() => setRange({ from, to: today() })}
                >
                  {p.label}
                </button>
              );
            })}
          </div>
          <div className="dates">
            <Icon name="calendar" className="muted" />
            <input type="date" value={range.from} max={range.to} aria-label="From date"
              onChange={(e) => setRange({ ...range, from: e.target.value })} />
            <span className="muted">to</span>
            <input type="date" value={range.to} min={range.from} aria-label="To date"
              onChange={(e) => setRange({ ...range, to: e.target.value })} />
          </div>
        </section>

        {error && <p className="error">{error}</p>}

        {summary ? (
          <>
            <SummaryCards totals={summary.totals} />
            <section className="charts">
              <div className="card chart-card wide">
                <div className="card-head">
                  <h2>Income vs. expenses</h2>
                  <span className="muted small">{rangeText}</span>
                </div>
                <MonthlyBarChart monthly={summary.monthly} />
              </div>
              <div className="card chart-card">
                <div className="card-head">
                  <h2>Spending by category</h2>
                </div>
                <CategoryDoughnut byCategory={summary.byCategory} />
              </div>
              <div className="card chart-card full">
                <div className="card-head">
                  <h2>Running balance</h2>
                  <span className="muted small">Total saved over time</span>
                </div>
                <BalanceLineChart monthly={summary.monthly} />
              </div>
            </section>
          </>
        ) : (
          !error && <div className="loading" aria-label="Loading"><span className="spinner" /></div>
        )}

        <section className="bottom">
          <div className="stack">
            <div className={`card${editing ? ' editing' : ''}`} ref={formRef}>
              <div className="card-head">
                <h2>{editing ? 'Edit transaction' : 'Add transaction'}</h2>
              </div>
              <TransactionForm
                categories={categories}
                editing={editing}
                onSaved={() => {
                  setEditing(null);
                  load();
                }}
                onCancel={() => setEditing(null)}
              />
            </div>
            <div className="card" id="categories">
              <div className="card-head">
                <h2>Categories</h2>
              </div>
              <CategoryManager
                categories={categories}
                onChange={() => {
                  loadCategories();
                  load();
                }}
              />
            </div>
          </div>

          <div className="card" id="transactions">
            <div className="card-head wrap">
              <h2>
                Transactions <span className="count">{shown.length}</span>
              </h2>
              <div className="row">
                <div className="search">
                  <Icon name="search" size={16} />
                  <input
                    type="search"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Search"
                    aria-label="Search transactions"
                  />
                </div>
                <select value={categoryId} onChange={(e) => setCategoryId(e.target.value)} aria-label="Filter by category">
                  <option value="">All categories</option>
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>{c.name} ({c.type})</option>
                  ))}
                </select>
                <button className="btn" onClick={exportCsv} disabled={!shown.length}>
                  <Icon name="download" size={16} /> Export CSV
                </button>
              </div>
            </div>
            <TransactionList transactions={shown} searching={!!term} onEdit={startEdit} onDelete={remove} />
          </div>
        </section>
      </main>
    </div>
  );
}
