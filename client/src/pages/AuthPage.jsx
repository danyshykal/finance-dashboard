import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import Icon, { Logo } from '../components/Icon.jsx';

const FEATURES = [
  { icon: 'chart', text: 'See where your money goes with clear charts' },
  { icon: 'tag', text: 'Organise spending with your own categories' },
  { icon: 'download', text: 'Export your transactions to Excel any time' },
  { icon: 'shield', text: 'Your data stays private to your account' },
];

// Decorative mini bar chart for the welcome panel.
const BARS = [38, 62, 48, 80, 56, 92, 70];

export default function AuthPage({ mode }) {
  const isRegister = mode === 'register';
  const { login, register } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ name: '', email: '', password: '' });
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const update = (e) => setForm({ ...form, [e.target.name]: e.target.value });

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      if (isRegister) await register(form);
      else await login(form.email, form.password);
      navigate('/');
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const fillDemo = () => setForm({ ...form, email: 'demo@example.com', password: 'demo1234' });

  return (
    <main className="auth">
      <section className="auth-panel" aria-hidden="true">
        <div className="brand light">
          <Logo /> <span>Finance Dashboard</span>
        </div>
        <div>
          <h2>Take control of your money.</h2>
          <p>Track income and spending in one place, and see how you're doing at a glance.</p>
        </div>
        <div className="mini-chart">
          {BARS.map((h, i) => (
            <span key={i} style={{ height: `${h}%`, animationDelay: `${i * 70}ms` }} />
          ))}
        </div>
        <ul className="features">
          {FEATURES.map((f) => (
            <li key={f.text}>
              <span className="feature-icon"><Icon name={f.icon} size={16} /></span>
              {f.text}
            </li>
          ))}
        </ul>
      </section>

      <section className="auth-form-wrap">
        <form className="auth-card" onSubmit={submit}>
          <div className="brand mobile-only">
            <Logo /> <span>Finance Dashboard</span>
          </div>
          <div>
            <h1>{isRegister ? 'Create your account' : 'Welcome back'}</h1>
            <p className="muted">
              {isRegister ? 'It takes less than a minute.' : 'Log in to see your dashboard.'}
            </p>
          </div>

          {isRegister && (
            <label>
              Name
              <input name="name" value={form.name} onChange={update} required autoComplete="name" placeholder="Your name" />
            </label>
          )}
          <label>
            Email
            <input
              name="email"
              type="email"
              value={form.email}
              onChange={update}
              required
              autoComplete="email"
              placeholder="you@example.com"
            />
          </label>
          <label>
            Password
            <input
              name="password"
              type="password"
              value={form.password}
              onChange={update}
              required
              minLength={6}
              autoComplete={isRegister ? 'new-password' : 'current-password'}
              placeholder={isRegister ? 'At least 6 characters' : 'Your password'}
            />
          </label>

          {error && <p className="error">{error}</p>}

          <button className="btn primary big" disabled={submitting}>
            {submitting ? 'Please wait…' : isRegister ? 'Create account' : 'Log in'}
          </button>

          {!isRegister && (
            <button type="button" className="btn big" onClick={fillDemo}>
              Fill in the demo account
            </button>
          )}

          <p className="muted small center">
            {isRegister ? (
              <>Already have an account? <Link to="/login">Log in</Link></>
            ) : (
              <>New here? <Link to="/register">Create an account</Link></>
            )}
          </p>
        </form>
      </section>
    </main>
  );
}
