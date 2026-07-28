import { FormEvent, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { Lock, ArrowLeft } from 'lucide-react';
import { toast } from 'sonner';
import { arcusImages } from '../lib/assets';
import { api } from '../lib/api';

/** Mirrors services.MinPasswordLength. The server is authoritative; this only
 *  avoids a round trip to learn something we already know. */
const MIN_PASSWORD_LENGTH = 10;

export function ResetPasswordPage() {
  const [params] = useSearchParams();
  const token = params.get('token') ?? '';
  const navigate = useNavigate();
  const [form, setForm] = useState({ password: '', confirm: '' });
  const [submitting, setSubmitting] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (form.password.length < MIN_PASSWORD_LENGTH) {
      toast.error(`Password must be at least ${MIN_PASSWORD_LENGTH} characters`);
      return;
    }
    if (form.password !== form.confirm) {
      toast.error('The two passwords do not match');
      return;
    }
    setSubmitting(true);
    try {
      await api.resetPassword(token, form.password);
      toast.success('Password updated. Sign in with your new password.');
      navigate('/login');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not reset the password');
    } finally {
      setSubmitting(false);
    }
  }

  // The link is validated server-side on submit rather than on load. Checking it
  // up front would need an endpoint that confirms a token exists, which is the
  // same oracle forgot-password is careful not to be.
  if (!token) {
    return (
      <main className="auth-screen">
        <section className="auth-visual">
          <img className="auth-visual-img" src={arcusImages.pcbWorkbench} alt="" />
        </section>
        <section className="auth-panel">
          <div className="auth-card">
            <div className="auth-card-brand">
              <img src={arcusImages.logo} alt="" />
              <span>Arcus Investments</span>
            </div>
            <h2>This link is incomplete</h2>
            <p className="sub">
              Open the link from your email exactly as it was sent, or request a new one.
            </p>
            <div className="auth-meta">
              <Link to="/forgot-password" className="auth-back">Request a new link</Link>
              <Link to="/login" className="auth-back">Back to sign in</Link>
            </div>
          </div>
        </section>
      </main>
    );
  }

  return (
    <main className="auth-screen">
      <section className="auth-visual">
        <img className="auth-visual-img" src={arcusImages.pcbWorkbench} alt="" />
      </section>

      <section className="auth-panel">
        <form className="auth-card" onSubmit={submit}>
          <div className="auth-card-brand">
            <img src={arcusImages.logo} alt="" />
            <span>Arcus Investments</span>
          </div>
          <div>
            <h2>Choose a new password</h2>
            <p className="sub">
              At least {MIN_PASSWORD_LENGTH} characters. Setting it signs you out everywhere else.
            </p>
          </div>
          <div className="auth-field">
            <Lock size={18} />
            <input
              required
              type="password"
              placeholder="New password"
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
            />
          </div>
          <div className="auth-field">
            <Lock size={18} />
            <input
              required
              type="password"
              placeholder="Confirm new password"
              value={form.confirm}
              onChange={(e) => setForm({ ...form, confirm: e.target.value })}
            />
          </div>
          <button className="primary" disabled={submitting}>
            {submitting ? 'Updating…' : 'Set new password'}
          </button>
          <div className="auth-meta">
            <Link to="/login" className="auth-back"><ArrowLeft size={14} /> Back to sign in</Link>
          </div>
        </form>
      </section>
    </main>
  );
}
