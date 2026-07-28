import { FormEvent, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Mail, Lock, ArrowLeft, ShieldCheck, GraduationCap, LineChart, ScrollText } from 'lucide-react';
import { toast } from 'sonner';
import { arcusImages } from '../lib/assets';
import { useAuth } from '../lib/auth';

export function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ email: '', password: '' });
  const [submitting, setSubmitting] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setSubmitting(true);
    try {
      const user = await login(form.email, form.password);
      navigate(user.role === 'student' ? '/student' : '/admin');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Login failed');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="auth-screen">
      <section className="auth-visual">
        <img className="auth-visual-img" src={arcusImages.pcbWorkbench} alt="" />
        <div className="auth-visual-shade" />
        <Link to="/" className="auth-brand">
          <img src={arcusImages.logo} alt="" />
          <span>Arcus Investments</span>
        </Link>
        <div className="auth-visual-copy">
          <p className="eyebrow">Secure workspace</p>
          <h1>Your commercial operations, in one place.</h1>
          <p>Sign in to manage sales pipeline, accounts, enrollment intake and capstone progress.</p>
          <div className="auth-cards">
            <article>
              <LineChart size={17} />
              <strong>Pipeline</strong>
              <span>Deals, forecasting and account rollups</span>
            </article>
            <article>
              <ScrollText size={17} />
              <strong>Contracts</strong>
              <span>Renewals, quotes, invoices and receipts</span>
            </article>
            <article>
              <GraduationCap size={17} />
              <strong>Innovation Hub</strong>
              <span>Enrollment intake and capstone milestones</span>
            </article>
            <article>
              <ShieldCheck size={17} />
              <strong>Audited access</strong>
              <span>Per-role permissions on every action</span>
            </article>
          </div>
        </div>
      </section>

      <section className="auth-panel">
        <form className="auth-card" onSubmit={submit}>
          <div className="auth-card-brand">
            <img src={arcusImages.logo} alt="" />
            <span>Arcus Investments</span>
          </div>
          <div>
            <h2>Welcome back</h2>
            <p className="sub">Staff and students only. Enter your credentials to continue.</p>
          </div>
          <div className="auth-field">
            <Mail size={18} />
            <input required type="email" placeholder="Email address" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
          </div>
          <div className="auth-field">
            <Lock size={18} />
            <input required type="password" placeholder="Password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
          </div>
          <button className="primary" disabled={submitting}>{submitting ? 'Signing in…' : 'Sign in'}</button>
          <div className="auth-meta">
            <Link to="/" className="auth-back"><ArrowLeft size={14} /> Back to site</Link>
            <Link to="/forgot-password" className="auth-back">Forgot password?</Link>
          </div>
        </form>
      </section>
    </main>
  );
}
