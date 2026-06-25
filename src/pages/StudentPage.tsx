import { FormEvent, useEffect, useState } from 'react';
import { LogOut, Rocket, CheckSquare, Square, MessageSquare, Send, Calendar, User, Clock } from 'lucide-react';
import { toast } from 'sonner';
import { api } from '../lib/api';
import { useAuth } from '../lib/auth';
import type { Enrollment, StudentProfile, CapstoneMilestone, CapstoneComment } from '../types';

export function StudentPage() {
  const { user, logout } = useAuth();
  const [profile, setProfile] = useState<StudentProfile | null>(null);
  const [enrollment, setEnrollment] = useState<Enrollment | null>(null);
  const [milestones, setMilestones] = useState<CapstoneMilestone[]>([]);
  const [comments, setComments] = useState<CapstoneComment[]>([]);
  const [form, setForm] = useState({ title: '', summary: '' });
  const [newComment, setNewComment] = useState('');
  const [savingBrief, setSavingBrief] = useState(false);
  const [postingComment, setPostingComment] = useState(false);

  async function loadDashboard() {
    try {
      const data = await api.studentDashboard();
      setProfile(data.profile);
      setEnrollment(data.enrollment);
      setMilestones(data.milestones || []);
      setComments(data.comments || []);
      setForm({
        title: data.profile?.capstone_title ?? '',
        summary: data.profile?.capstone_summary ?? ''
      });
    } catch (error: any) {
      toast.error(error.message || 'Failed to load dashboard');
    }
  }

  useEffect(() => {
    loadDashboard();
  }, []);

  async function submitBrief(event: FormEvent) {
    event.preventDefault();
    setSavingBrief(true);
    try {
      const updated = await api.updateCapstone(form.title, form.summary);
      setProfile(updated);
      toast.success('Capstone brief updated successfully');
    } catch (err: any) {
      toast.error(err.message || 'Failed to update capstone brief');
    } finally {
      setSavingBrief(false);
    }
  }

  async function toggleMilestone(milestone: CapstoneMilestone) {
    const nextStatus = milestone.status === 'completed' ? 'in_progress' : 'completed';
    try {
      const updated = await api.updateMilestone(milestone.id, { status: nextStatus });
      setMilestones((prev) => prev.map((m) => m.id === milestone.id ? updated : m));
      toast.success(`Milestone marked as ${nextStatus}`);
      // Reload dashboard to update progress percentage
      const data = await api.studentDashboard();
      setProfile(data.profile);
    } catch (err: any) {
      toast.error(err.message || 'Failed to update milestone');
    }
  }

  async function submitComment(e: FormEvent) {
    e.preventDefault();
    if (!newComment.trim()) return;
    setPostingComment(true);
    try {
      const created = await api.postComment(newComment);
      setComments((prev) => [...prev, created]);
      setNewComment('');
      toast.success('Comment posted');
    } catch (err: any) {
      toast.error(err.message || 'Failed to post comment');
    } finally {
      setPostingComment(false);
    }
  }

  return (
    <main className="workspace student-workspace">
      <aside className="rail">
        <strong style={{ fontSize: '18px', display: 'block', marginBottom: '8px' }}>Arcus Student</strong>
        <span style={{ fontSize: '14px', marginBottom: '24px' }}>{user?.full_name}</span>
        
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <div style={{ fontSize: '11px', textTransform: 'uppercase', color: 'var(--muted)', letterSpacing: '0.05em' }}>Program Info</div>
          <div style={{ background: 'rgba(255,255,255,0.04)', padding: '12px', borderRadius: '6px', fontSize: '13px', border: '1px solid var(--line)' }}>
            <div>Tier: <strong>{enrollment?.tier || profile?.tier}</strong></div>
            <div style={{ marginTop: '6px' }}>Status: <span style={{ color: 'var(--accent)' }}>{enrollment?.status?.replace('_', ' ')}</span></div>
          </div>
        </div>

        <button onClick={logout} style={{ marginTop: 'auto' }}><LogOut size={17} /> Logout</button>
      </aside>
      
      <section className="work-main" style={{ overflowY: 'auto', height: '100vh' }}>
        <div className="workspace-head">
          <div>
            <p className="eyebrow">Student Portal Dashboard</p>
            <h1>Capstone Progress & Checklists</h1>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            <span style={{ fontSize: '14px', color: '#5a625d', fontWeight: '800' }}>Overall Progress</span>
            <div className="progress-ring">{profile?.progress_pct ?? 0}%</div>
          </div>
        </div>

        <div className="student-grid" style={{ gridTemplateColumns: '1.1fr 0.9fr', gap: '24px', alignItems: 'start' }}>
          <div style={{ display: 'grid', gap: '24px' }}>
            {/* Milestones Checklist Panel */}
            <div className="panel" style={{ padding: '24px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px' }}>
                <CheckSquare size={22} style={{ color: 'var(--accent)' }} />
                <h2 style={{ margin: 0, fontSize: '22px' }}>Your Milestone Checklist</h2>
              </div>
              <p style={{ fontSize: '13px', marginBottom: '20px' }}>Mark off checklist items as you complete them. Admins will review your updates and leave comments/feedback below.</p>
              
              <div style={{ display: 'grid', gap: '12px' }}>
                {milestones.length === 0 ? (
                  <p style={{ color: '#5a625d', fontSize: '14px', padding: '12px', background: '#f7f8f3', borderRadius: '6px', textAlign: 'center' }}>No milestones generated yet.</p>
                ) : (
                  milestones.map((m) => (
                    <div key={m.id} style={{ display: 'flex', gap: '12px', alignItems: 'flex-start', padding: '16px', background: '#f7f8f3', border: '1px solid #d8dbd1', borderRadius: '8px' }}>
                      <button 
                        onClick={() => toggleMilestone(m)} 
                        style={{ background: 'transparent', border: 0, padding: 0, display: 'inline-flex', color: m.status === 'completed' ? 'var(--accent)' : '#5a625d' }}
                      >
                        {m.status === 'completed' ? <CheckSquare size={22} style={{ color: '#5f7c29' }} /> : <Square size={22} />}
                      </button>
                      <div style={{ flex: 1 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', gap: '10px', alignItems: 'baseline' }}>
                          <strong style={{ color: '#111512', fontSize: '15px' }}>{m.title}</strong>
                          <span style={{
                            fontSize: '11px', 
                            padding: '2px 8px', 
                            borderRadius: '10px', 
                            background: m.status === 'completed' ? '#e8f2dc' : m.status === 'in_progress' ? '#fff2e2' : '#f0f0f0',
                            color: m.status === 'completed' ? '#35520f' : m.status === 'in_progress' ? '#c98745' : '#555',
                            fontWeight: 'bold',
                            textTransform: 'uppercase'
                          }}>{m.status.replace('_', ' ')}</span>
                        </div>
                        <p style={{ fontSize: '13px', margin: '4px 0 8px', color: '#5a625d' }}>{m.description}</p>
                        
                        {m.feedback && (
                          <div style={{ background: '#fff', borderLeft: '3px solid var(--copper)', padding: '8px 12px', borderRadius: '0 4px 4px 0', fontSize: '12px', color: '#c98745', marginTop: '6px' }}>
                            <strong>Admissions Review Feedback:</strong> {m.feedback}
                          </div>
                        )}
                        
                        {m.completed_at && (
                          <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '11px', color: '#5a625d', marginTop: '6px' }}>
                            <Clock size={12} /> Completed on {new Date(m.completed_at).toLocaleDateString()}
                          </div>
                        )}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Capstone Comments / Discussion Feed Panel */}
            <div className="panel" style={{ padding: '24px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px' }}>
                <MessageSquare size={22} style={{ color: 'var(--accent)' }} />
                <h2 style={{ margin: 0, fontSize: '22px' }}>Discussion & Updates</h2>
              </div>
              <p style={{ fontSize: '13px', marginBottom: '20px' }}>Post updates, ask questions or address feedback. Admissions and coordinators will reply here.</p>

              <div style={{ display: 'grid', gap: '12px', maxHeight: '300px', overflowY: 'auto', marginBottom: '20px', paddingRight: '4px' }}>
                {comments.length === 0 ? (
                  <p style={{ color: '#5a625d', fontSize: '13px', textAlign: 'center', padding: '12px' }}>No messages posted yet. Start the conversation!</p>
                ) : (
                  comments.map((c) => (
                    <div key={c.id} style={{ padding: '12px 14px', background: '#f7f8f3', borderRadius: '8px', border: '1px solid #d8dbd1' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', gap: '12px', marginBottom: '6px', fontSize: '12px' }}>
                        <div>
                          <strong style={{ color: '#111512' }}>{c.author_name}</strong>
                          <span style={{ color: '#5a625d', marginLeft: '6px', fontSize: '11px', background: '#eef0ea', padding: '2px 6px', borderRadius: '4px' }}>{c.author_role.replace('_', ' ')}</span>
                        </div>
                        <span style={{ color: '#8a908a' }}>{new Date(c.created_at).toLocaleString(undefined, { dateStyle: 'short', timeStyle: 'short' })}</span>
                      </div>
                      <p style={{ margin: 0, fontSize: '13px', color: '#2d3330', whiteSpace: 'pre-line', lineHeight: '1.5' }}>{c.message}</p>
                    </div>
                  ))
                )}
              </div>

              <form onSubmit={submitComment} style={{ display: 'flex', gap: '8px' }}>
                <input 
                  required 
                  placeholder="Post a progress update or question..." 
                  value={newComment} 
                  onChange={(e) => setNewComment(e.target.value)} 
                  style={{ flex: 1, minHeight: '44px', color: '#111512', background: '#f7f8f3', border: '1px solid #d8dbd1' }}
                />
                <button type="submit" disabled={postingComment} className="primary" style={{ width: '44px', minHeight: '44px', padding: 0 }}>
                  <Send size={16} />
                </button>
              </form>
            </div>
          </div>

          <div style={{ display: 'grid', gap: '24px' }}>
            {/* Capstone Brief Info Panel */}
            <article className="panel" style={{ padding: '24px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px' }}>
                <Rocket size={22} style={{ color: 'var(--accent)' }} />
                <h2 style={{ margin: 0, fontSize: '22px' }}>Capstone Brief</h2>
              </div>
              <h3 style={{ fontSize: '18px', fontWeight: '800', marginBottom: '10px', color: '#111512' }}>
                {profile?.capstone_title || 'Capstone not named yet'}
              </h3>
              <p style={{ fontSize: '14px', lineHeight: '1.6', color: '#5a625d', whiteSpace: 'pre-line' }}>
                {profile?.capstone_summary || enrollment?.project_idea || 'No project summary set. Use the editor below to describe what you are building.'}
              </p>
            </article>

            {/* Capstone Brief Form Panel */}
            <form className="panel capstone-form" onSubmit={submitBrief} style={{ padding: '24px' }}>
              <h2 style={{ fontSize: '20px', marginBottom: '4px' }}>Edit Project Details</h2>
              <p style={{ fontSize: '12px', color: '#5a625d', marginBottom: '16px' }}>Refine your capstone title and build scope at any time.</p>
              
              <div style={{ display: 'grid', gap: '12px' }}>
                <input 
                  required
                  placeholder="Capstone Project Title" 
                  value={form.title} 
                  onChange={(e) => setForm({ ...form, title: e.target.value })} 
                />
                <textarea 
                  required
                  placeholder="Describe your design prototype, technology stack, mechanical fabrication goals, or software targets." 
                  value={form.summary} 
                  onChange={(e) => setForm({ ...form, summary: e.target.value })} 
                  style={{ minHeight: '120px' }}
                />
                <button type="submit" disabled={savingBrief} className="primary" style={{ width: '100%', minHeight: '44px' }}>
                  {savingBrief ? 'Saving...' : 'Save capstone brief'}
                </button>
              </div>
            </form>
          </div>
        </div>
      </section>
    </main>
  );
}
