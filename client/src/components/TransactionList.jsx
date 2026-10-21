import { formatDate, formatMoney } from '../format.js';
import { seriesColor, useDarkMode } from '../theme.js';
import Icon from './Icon.jsx';

export default function TransactionList({ transactions, searching, onEdit, onDelete }) {
  const dark = useDarkMode();
  if (!transactions.length) {
    return (
      <div className="empty">
        <Icon name={searching ? 'search' : 'inbox'} size={28} />
        <p>{searching ? 'No transactions match your search.' : 'No transactions in this period.'}</p>
      </div>
    );
  }

  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            <th>Date</th>
            <th>Category</th>
            <th>Note</th>
            <th className="num">Amount</th>
            <th aria-label="Actions" />
          </tr>
        </thead>
        <tbody>
          {transactions.map((tx) => {
            const color = seriesColor(tx.color, dark);
            return (
              <tr key={tx.id}>
                <td className="date nowrap muted">{formatDate(tx.date)}</td>
                <td className="cat">
                  <span className="pill" style={{ '--pill': color }}>
                    <span className="dot" style={{ background: color }} />
                    {tx.category_name}
                  </span>
                </td>
                <td className="muted note">{tx.note}</td>
                <td className={`num amount ${tx.type}`}>
                  {tx.type === 'income' ? '+' : '−'}
                  {formatMoney(tx.amount)}
                </td>
                <td className="actions">
                  <button className="icon-btn" onClick={() => onEdit(tx)} aria-label="Edit transaction" title="Edit">
                    <Icon name="edit" size={16} />
                  </button>
                  <button
                    className="icon-btn danger"
                    onClick={() => onDelete(tx)}
                    aria-label="Delete transaction"
                    title="Delete"
                  >
                    <Icon name="trash" size={16} />
                  </button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
