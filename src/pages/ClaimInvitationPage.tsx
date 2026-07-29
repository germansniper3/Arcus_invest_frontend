import { useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { ShieldCheck, FileText, ArrowRight, Loader } from 'lucide-react';
import { toast } from 'sonner';
import { api, errorMessage } from '../lib/api';
import { arcusImages } from '../lib/assets';

export function ClaimInvitationPage() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token') || '';
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [inviteData, setInviteData] = useState<{ email: string; full_name: string; tier: string } | null>(null);

  const [form, setForm] = useState({ password: '', confirmPassword: '', title: '', summary: '' });
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!token) {
      toast.error('Invalid or missing invitation token.');
      navigate('/');
      return;
    }

    async function checkToken() {
      try {
        const preview = await api.previewInvitation(token);
        setInviteData(preview);
      } catch (err) {
        toast.error(errorMessage(err, 'Invitation is invalid, expired, or already claimed.'));
        navigate('/');
      } finally {
        setLoading(false);
      }
    }

    checkToken();
  }, [token, navigate]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (form.password.length < 10) {
      toast.error('Password must be at least 10 characters long.');
      return;
    }
    if (form.password !== form.confirmPassword) {
      toast.error('Passwords do not match.');
      return;
    }

    setSubmitting(true);
    try {
      await api.claimInvitation({
        token,
        password: form.password,
        capstone_title: form.title,
        capstone_summary: form.summary,
      });
      toast.success('Your student account has been created! Please log in to access your portal.');
      navigate('/login');
    } catch (err) {
      toast.error(errorMessage(err, 'Failed to claim invitation.'));
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <div className="loading-shell" style={{ background: 'var(--ink)', color: '#fff' }}>
        <Loader className="animate-spin" size={32} style={{ color: 'var(--accent)' }} />
        <p style={{ marginTop: '16px' }}>Validating onboarding invitation...</p>
      </div>
    );
  }

  // Greet by first name only — a full name overflows the heading on a phone.
  const firstName = (inviteData?.full_name ?? '').trim().split(/\s+/)[0];

  return (
    <main className="auth-screen">
      <section className="auth-visual">
        <img className="auth-visual-img" src={arcusImages.electronicsWorkshop} alt="" />
        <div className="auth-visual-shade" />
        <Link to="/" className="auth-brand">
          <img src={arcusImages.logo} alt="" />
          <span>Arcus Investments</span>
        </Link>
        <div className="auth-visual-copy">
          <p className="eyebrow">Innovation Hub onboarding</p>
          <h1>{firstName ? `Welcome to the Hub, ${firstName}.` : 'Welcome to the Hub.'}</h1>
          <p>
            Your enrollment for the <strong style={{ color: 'var(--accent)' }}>{inviteData?.tier}</strong> tier has been
            accepted. Choose a password and outline your capstone to activate your student portal.
          </p>
          <ul className="auth-points">
            <li><ShieldCheck size={18} /> Guided onboarding checklists for your tier</li>
            <li><FileText size={18} /> Milestone tracker &amp; mentor reviews</li>
          </ul>
        </div>
      </section>

      <section className="auth-panel">
        <form className="auth-card" onSubmit={handleSubmit}>
          <div>
            <h2>Set up your account</h2>
            <p className="sub">Fill in your credentials to claim your student profile.</p>
          </div>

          <div className="auth-labelled">
            <label htmlFor="claim-email">Email address (verified)</label>
            <input
              id="claim-email"
              disabled
              value={inviteData?.email || ''}
              style={{ background: 'rgba(255,255,255,0.02)', color: 'rgba(255,255,255,0.45)' }}
            />
          </div>

          <div className="auth-labelled">
            <label htmlFor="claim-password">Choose password (min 10 characters)</label>
            <input
              id="claim-password"
              required
              type="password"
              autoComplete="new-password"
              placeholder="••••••••••••"
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
            />
          </div>

          <div className="auth-labelled">
            <label htmlFor="claim-confirm">Confirm password</label>
            <input
              id="claim-confirm"
              required
              type="password"
              autoComplete="new-password"
              placeholder="••••••••••••"
              value={form.confirmPassword}
              onChange={(e) => setForm({ ...form, confirmPassword: e.target.value })}
            />
          </div>

          <div className="auth-divider">
            <h3>Capstone details</h3>
            <p>You can update these anytime inside your student dashboard.</p>
          </div>

          <div className="auth-labelled">
            <label htmlFor="claim-title">Capstone project title</label>
            <input
              id="claim-title"
              required
              placeholder="e.g. Solar irrigation controller"
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
            />
          </div>

          <div className="auth-labelled">
            <label htmlFor="claim-summary">Project scope</label>
            <textarea
              id="claim-summary"
              required
              placeholder="What is your capstone scope, technical stack, or build target?"
              value={form.summary}
              onChange={(e) => setForm({ ...form, summary: e.target.value })}
              style={{ minHeight: '96px' }}
            />
          </div>

          <button type="submit" disabled={submitting} className="primary">
            {submitting ? 'Creating account…' : 'Complete registration'} <ArrowRight size={18} />
          </button>
        </form>
      </section>
    </main>
  );
}
