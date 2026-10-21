import { formatMoney } from '../format.js';
import Icon from './Icon.jsx';

function Stat({ icon, tone, label, value }) {
  return (
    <div className={`card stat ${tone}`}>
      <span className="stat-icon">
        <Icon name={icon} size={20} />
      </span>
      <div>
        <span className="stat-label">{label}</span>
        <strong className="stat-value">{value}</strong>
      </div>
    </div>
  );
}

export default function SummaryCards({ totals }) {
  const { income, expense, balance, count } = totals;
  const savedPct = income > 0 ? Math.round((balance / income) * 100) : null;

  let message = 'No transactions in this period yet.';
  if (count) {
    message =
      balance >= 0
        ? 'You spent less than you earned in this period. Nice work!'
        : 'You spent more than you earned in this period.';
  }

  return (
    <section className="summary">
      <div className="hero">
        <div className="hero-top">
          <span className="hero-label">
            <Icon name="wallet" /> Net balance
          </span>
          {savedPct !== null && (
            <span className="hero-badge">{savedPct >= 0 ? `${savedPct}% saved` : 'Overspent'}</span>
          )}
        </div>
        <strong className="hero-value">{formatMoney(balance)}</strong>
        <p className="hero-sub">{message}</p>
      </div>
      <Stat icon="up" tone="income" label="Income" value={formatMoney(income)} />
      <Stat icon="down" tone="expense" label="Expenses" value={formatMoney(expense)} />
      <Stat icon="list" tone="neutral" label="Transactions" value={count} />
    </section>
  );
}
