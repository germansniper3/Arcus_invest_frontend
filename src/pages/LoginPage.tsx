import { FormEvent, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Mail, Lock, ArrowLeft, ShieldCheck, GraduationCap, LineChart } from 'lucide-react';
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
          <ul className="auth-points">
            <li><LineChart size={18} /> Sales pipeline &amp; weighted forecasting</li>
            <li><ShieldCheck size={18} /> Role-based, audited access</li>
            <li><GraduationCap size={18} /> Innovation Hub &amp; capstone tracking</li>
          </ul>
        </div>
      </section>

      <section className="auth-panel">
        <form className="auth-card" onSubmit={submit}>
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
            <span>Need access? Contact an admin.</span>
          </div>
        </form>
      </section>
    </main>
  );
}
