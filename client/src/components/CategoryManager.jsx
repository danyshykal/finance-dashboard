import { useState } from 'react';
import { api } from '../api.js';
import { useToast } from '../context/ToastContext.jsx';
import { PALETTE, seriesColor, useDarkMode } from '../theme.js';
import Icon from './Icon.jsx';

const COLOR_NAMES = ['Blue', 'Orange', 'Aqua', 'Yellow', 'Magenta', 'Green', 'Violet', 'Red'];

export default function CategoryManager({ categories, onChange }) {
  const dark = useDarkMode();
  const showToast = useToast();
  const [form, setForm] = useState({ name: '', type: 'expense', color: PALETTE[0] });
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const add = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError('');
    try {
      await api('/categories', { method: 'POST', body: form });
      showToast(`Category "${form.name.trim()}" added`);
      setForm({ ...form, name: '' });
      onChange();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const remove = async (category) => {
    if (!confirm(`Delete the "${category.name}" category?`)) return;
    setError('');
    try {
      await api(`/categories/${category.id}`, { method: 'DELETE' });
      showToast(`Category "${category.name}" deleted`);
      onChange();
    } catch (err) {
      showToast(err.message, 'error');
    }
  };

  return (
    <div className="categories">
      {['income', 'expense'].map((type) => (
        <div key={type}>
          <h3 className="group-title">{type === 'income' ? 'Income' : 'Expenses'}</h3>
          <ul className="chips">
            {categories
              .filter((c) => c.type === type)
              .map((c) => {
                const color = seriesColor(c.color, dark);
                return (
                  <li key={c.id} className="pill" style={{ '--pill': color }}>
                    <span className="dot" style={{ background: color }} />
                    {c.name}
                    <button className="chip-x" onClick={() => remove(c)} aria-label={`Delete ${c.name}`} title="Delete">
                      <Icon name="close" size={12} />
                    </button>
                  </li>
                );
              })}
          </ul>
        </div>
      ))}

      <form className="tx-form new-category" onSubmit={add}>
        <h3 className="group-title">New category</h3>
        <div className="segmented" role="radiogroup" aria-label="Category type">
          {['expense', 'income'].map((type) => (
            <button
              key={type}
              type="button"
              role="radio"
              aria-checked={form.type === type}
              className={form.type === type ? 'active' : ''}
              onClick={() => setForm({ ...form, type })}
            >
              {type === 'expense' ? 'Expense' : 'Income'}
            </button>
          ))}
        </div>
        <input
          value={form.name}
          onChange={(e) => setForm({ ...form, name: e.target.value })}
          placeholder="Name, e.g. Health"
          aria-label="Category name"
          maxLength={40}
          required
        />
        <div className="swatches" role="radiogroup" aria-label="Color">
          {PALETTE.map((hex, i) => (
            <button
              key={hex}
              type="button"
              role="radio"
              aria-checked={form.color === hex}
              aria-label={COLOR_NAMES[i]}
              title={COLOR_NAMES[i]}
              className={`swatch${form.color === hex ? ' selected' : ''}`}
              style={{ background: seriesColor(hex, dark) }}
              onClick={() => setForm({ ...form, color: hex })}
            />
          ))}
        </div>

        {error && <p className="error">{error}</p>}

        <button className="btn" disabled={saving}>
          <Icon name="plus" size={16} /> Add category
        </button>
      </form>
    </div>
  );
}
