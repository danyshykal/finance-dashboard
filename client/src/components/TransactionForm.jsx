import { useEffect, useState } from 'react';
import { api } from '../api.js';
import { useToast } from '../context/ToastContext.jsx';
import { today } from '../format.js';

const emptyForm = () => ({ type: 'expense', category_id: '', amount: '', date: today(), note: '' });

export default function TransactionForm({ categories, editing, onSaved, onCancel }) {
  const showToast = useToast();
  const [form, setForm] = useState(emptyForm);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  // Fill the form when the user clicks "Edit" on a transaction.
  useEffect(() => {
    setError('');
    setForm(
      editing
        ? {
            type: editing.type,
            category_id: String(editing.category_id),
            amount: String(editing.amount),
            date: editing.date,
            note: editing.note || '',
          }
        : emptyForm(),
    );
  }, [editing]);

  const options = categories.filter((c) => c.type === form.type);
  const update = (e) => setForm({ ...form, [e.target.name]: e.target.value });

  const submit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError('');
    try {
      const body = {
        category_id: Number(form.category_id),
        amount: Number(form.amount),
        date: form.date,
        note: form.note,
      };
      if (editing) await api(`/transactions/${editing.id}`, { method: 'PUT', body });
      else await api('/transactions', { method: 'POST', body });
      showToast(editing ? 'Transaction updated' : 'Transaction added');
      setForm(emptyForm());
      onSaved();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <form className="tx-form" onSubmit={submit}>
      <div className={`segmented ${form.type}`} role="radiogroup" aria-label="Type">
        {['expense', 'income'].map((type) => (
          <button
            key={type}
            type="button"
            role="radio"
            aria-checked={form.type === type}
            className={form.type === type ? 'active' : ''}
            onClick={() => setForm({ ...form, type, category_id: '' })}
          >
            {type === 'expense' ? 'Expense' : 'Income'}
          </button>
        ))}
      </div>

      <label>
        Amount
        <input
          name="amount"
          type="number"
          inputMode="decimal"
          min="0.01"
          step="0.01"
          value={form.amount}
          onChange={update}
          placeholder="0.00"
          className="amount-input"
          required
        />
      </label>
      <div className="form-grid">
        <label>
          Category
          <select name="category_id" value={form.category_id} onChange={update} required>
            <option value="" disabled>Choose…</option>
            {options.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </label>
        <label>
          Date
          <input name="date" type="date" value={form.date} onChange={update} required />
        </label>
      </div>
      <label>
        Note
        <input name="note" value={form.note} onChange={update} placeholder="What was it for? (optional)" />
      </label>

      {error && <p className="error">{error}</p>}

      <div className="row">
        <button className="btn primary grow" disabled={saving}>
          {saving ? 'Saving…' : editing ? 'Save changes' : 'Add transaction'}
        </button>
        {editing && <button type="button" className="btn" onClick={onCancel}>Cancel</button>}
      </div>
    </form>
  );
}
