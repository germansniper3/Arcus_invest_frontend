import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { KeyRound, ShieldCheck, FileText, ArrowRight, Loader } from 'lucide-react';
import { toast } from 'sonner';
import { api } from '../lib/api';
import { Nav } from '../components/Nav';
import { ChatWidget } from '../components/ChatWidget';

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
      } catch (err: any) {
        toast.error(err.message || 'Invitation is invalid, expired, or already claimed.');
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
    } catch (err: any) {
      toast.error(err.message || 'Failed to claim invitation.');
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <div className="loading-shell" style={{ background: '#0b0d0c', color: '#fff' }}>
        <Loader className="animate-spin" size={32} style={{ color: 'var(--accent)' }} />
        <p style={{ marginTop: '16px' }}>Validating onboarding invitation...</p>
      </div>
    );
  }

  return (
    <>
      <Nav />
      <main className="auth-screen" style={{ gridTemplateColumns: '1.1fr 0.9fr', alignItems: 'center', background: '#0b0d0c' }}>
        <div style={{ paddingRight: '20px' }}>
          <p className="eyebrow">Arcus Innovation Hub Onboarding</p>
          <h1 style={{ fontSize: '48px', marginBottom: '24px' }}>Welcome to the Hub, {inviteData?.full_name}.</h1>
          <p style={{ fontSize: '18px', lineHeight: '1.7', marginBottom: '32px' }}>
            Your enrollment for the <strong style={{ color: 'var(--accent)' }}>{inviteData?.tier}</strong> tier has been accepted. 
            To activate your student account and prepare your workspace portal, please choose a strong password and outline your capstone project goals.
          </p>
          <div style={{ display: 'grid', gap: '16px' }}>
            <div style={{ display: 'flex', gap: '12px', alignItems: 'flex-start' }}>
              <ShieldCheck size={20} style={{ color: 'var(--accent)', marginTop: '4px' }} />
              <div>
                <strong style={{ color: '#fff', display: 'block' }}>Complete Onboarding Checklists</strong>
                <span style={{ fontSize: '14px', color: '#b8b7ad' }}>Get guided checklist tasks aligned with your program tier.</span>
              </div>
            </div>
            <div style={{ display: 'flex', gap: '12px', alignItems: 'flex-start' }}>
              <FileText size={20} style={{ color: 'var(--accent)', marginTop: '4px' }} />
              <div>
                <strong style={{ color: '#fff', display: 'block' }}>Milestone Tracker & Mentorship Reviews</strong>
                <span style={{ fontSize: '14px', color: '#b8b7ad' }}>Track status transitions like Orientation Pending and orientation completion directly.</span>
              </div>
            </div>
          </div>
        </div>

        <div className="login-card" style={{ background: '#121714', border: '1px solid var(--line)', padding: '32px', borderRadius: '8px' }}>
          <h2 style={{ fontSize: '24px', fontWeight: '800', color: '#fff', marginBottom: '6px' }}>Setup Account</h2>
          <p style={{ fontSize: '13px', color: '#b8b7ad', marginBottom: '24px' }}>Fill in the credentials to claim your student profile access.</p>

          <form onSubmit={handleSubmit} style={{ display: 'grid', gap: '14px' }}>
            <div>
              <label style={{ fontSize: '12px', color: '#b8b7ad', display: 'block', marginBottom: '6px' }}>Email Address (Verified)</label>
              <input 
                disabled 
                value={inviteData?.email || ''} 
                style={{ background: 'rgba(255,255,255,0.02)', color: 'rgba(255,255,255,0.4)', borderColor: 'rgba(245, 243, 236, 0.08)' }} 
              />
            </div>
            <div>
              <label style={{ fontSize: '12px', color: '#b8b7ad', display: 'block', marginBottom: '6px' }}>Choose Password (Min 10 characters)</label>
              <input 
                required 
                type="password" 
                placeholder="••••••••••••" 
                value={form.password} 
                onChange={(e) => setForm({ ...form, password: e.target.value })} 
                style={{ background: 'rgba(255,255,255,0.04)' }}
              />
            </div>
            <div>
              <label style={{ fontSize: '12px', color: '#b8b7ad', display: 'block', marginBottom: '6px' }}>Confirm Password</label>
              <input 
                required 
                type="password" 
                placeholder="••••••••••••" 
                value={form.confirmPassword} 
                onChange={(e) => setForm({ ...form, confirmPassword: e.target.value })} 
                style={{ background: 'rgba(255,255,255,0.04)' }}
              />
            </div>

            <div style={{ marginBlock: '8px', borderTop: '1px solid var(--line)', paddingTop: '16px' }}>
              <h3 style={{ fontSize: '15px', fontWeight: '800', color: '#fff', marginBottom: '4px' }}>Capstone Details</h3>
              <p style={{ fontSize: '12px', color: '#b8b7ad', marginBottom: '12px' }}>You can update these details anytime inside your student dashboard.</p>
            </div>

            <div>
              <input 
                required 
                placeholder="Capstone Project Title" 
                value={form.title} 
                onChange={(e) => setForm({ ...form, title: e.target.value })} 
                style={{ background: 'rgba(255,255,255,0.04)' }}
              />
            </div>
            <div>
              <textarea 
                required 
                placeholder="What is your capstone project scope, technical stack, or build target?" 
                value={form.summary} 
                onChange={(e) => setForm({ ...form, summary: e.target.value })} 
                style={{ background: 'rgba(255,255,255,0.04)', minHeight: '80px' }}
              />
            </div>

            <button 
              type="submit" 
              disabled={submitting} 
              className="primary" 
              style={{ width: '100%', minHeight: '44px', marginTop: '10px' }}
            >
              {submitting ? 'Creating Account...' : 'Complete Registration'} <ArrowRight size={18} />
            </button>
          </form>
        </div>
      </main>
      <ChatWidget />
    </>
  );
}
