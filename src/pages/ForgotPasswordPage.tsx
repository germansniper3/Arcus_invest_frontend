import { FormEvent, useState } from 'react';
import { Link } from 'react-router-dom';
import { Mail, ArrowLeft, MailCheck } from 'lucide-react';
import { toast } from 'sonner';
import { arcusImages } from '../lib/assets';
import { api } from '../lib/api';

export function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [sent, setSent] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setSubmitting(true);
    try {
      await api.forgotPassword(email);
      // Shown whether or not the address has an account, matching the server.
      // Confirming which addresses are registered here would undo the work the
      // endpoint does to avoid answering that question.
      setSent(true);
    } catch (error) {
      // Only a transport failure can land here; the endpoint itself always
      // succeeds. Saying so avoids implying the address was rejected.
      toast.error(error instanceof Error ? error.message : 'Could not reach the server');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="auth-screen">
      <section className="auth-visual">
        <img className="auth-visual-img" src={arcusImages.pcbWorkbench} alt="" />
      </section>

      <section className="auth-panel">
        {sent ? (
          <div className="auth-card">
            <div className="auth-card-brand">
              <img src={arcusImages.logo} alt="" />
              <span>Arcus Investments</span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', alignItems: 'flex-start' }}>
              <MailCheck size={26} color="#5f7c29" />
              <h2>Check your email</h2>
              <p className="sub">
                If <strong>{email}</strong> has an account, a reset link is on its way. It can be
                used once and expires in an hour.
              </p>
              <p className="sub">
                Nothing arrived? Check spam. The address may also not be registered.
              </p>
            </div>
            <div className="auth-meta">
              <Link to="/login" className="auth-back"><ArrowLeft size={14} /> Back to sign in</Link>
            </div>
          </div>
        ) : (
          <form className="auth-card" onSubmit={submit}>
            <div className="auth-card-brand">
              <img src={arcusImages.logo} alt="" />
              <span>Arcus Investments</span>
            </div>
            <div>
              <h2>Reset your password</h2>
              <p className="sub">
                Enter the address you sign in with and we will email you a link to set a new
                password.
              </p>
            </div>
            <div className="auth-field">
              <Mail size={18} />
              <input
                required
                type="email"
                placeholder="Email address"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
            <button className="primary" disabled={submitting}>
              {submitting ? 'Sending…' : 'Send reset link'}
            </button>
            <div className="auth-meta">
              <Link to="/login" className="auth-back"><ArrowLeft size={14} /> Back to sign in</Link>
            </div>
          </form>
        )}
      </section>
    </main>
  );
}
