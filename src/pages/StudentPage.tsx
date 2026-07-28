import { FormEvent, useEffect, useState } from 'react';
import { LogOut, Rocket, CheckSquare, Square, MessageSquare, Send, Clock, FileText, CalendarClock, Plus, X, UploadCloud, Download, Lock, CheckCircle2 } from 'lucide-react';
import { toast } from 'sonner';
import { api, formatFileSize, MAX_SUBMISSION_FILE_SIZE } from '../lib/api';
import { useAuth } from '../lib/auth';
import type { Enrollment, StudentProfile, CapstoneMilestone, CapstoneComment, ProgressReport, ExtensionRequest, Submission } from '../types';

type Section = 'overview' | 'milestones' | 'discussion' | 'reports' | 'extensions' | 'submissions';

// Gated submission pipeline: steps unlock in order, each after the previous is
// mentor-approved. Keys must match the backend's submissionStageOrder.
const SUBMISSION_STEPS: { key: string; label: string; desc: string }[] = [
  { key: 'proposal', label: 'Proposal', desc: 'Submit your capstone project brief for mentor review.' },
  { key: 'report', label: 'Report', desc: 'Submit your progress / design report.' },
  { key: 'final', label: 'Final', desc: 'Submit your final deliverable.' },
];

const SECTION_TITLES: Record<Section, string> = {
  overview: 'Capstone Overview',
  milestones: 'Milestone Checklist',
  discussion: 'Discussion & Updates',
  reports: 'Progress Reports',
  extensions: 'Extension Requests',
  submissions: 'Submissions',
};

export function StudentPage() {
  const { user, logout } = useAuth();
  const [activeSection, setActiveSection] = useState<Section>('overview');
  const [profile, setProfile] = useState<StudentProfile | null>(null);
  const [enrollment, setEnrollment] = useState<Enrollment | null>(null);
  const [milestones, setMilestones] = useState<CapstoneMilestone[]>([]);
  const [comments, setComments] = useState<CapstoneComment[]>([]);
  const [progressReports, setProgressReports] = useState<ProgressReport[]>([]);
  const [extensions, setExtensions] = useState<ExtensionRequest[]>([]);
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [form, setForm] = useState({ title: '', summary: '' });
  const [newComment, setNewComment] = useState('');
  const [savingBrief, setSavingBrief] = useState(false);
  const [postingComment, setPostingComment] = useState(false);

  // Progress report form state
  const [prForm, setPrForm] = useState({ period_start: '', period_end: '', accomplishments: [''], challenges: '' });
  const [submittingReport, setSubmittingReport] = useState(false);

  // Extension request form state
  const [extForm, setExtForm] = useState({ extension_type: 'milestone', requested_deadline: '', reason: '' });
  const [submittingExtension, setSubmittingExtension] = useState(false);

  // Submission upload form state
  const [subForm, setSubForm] = useState<{ title: string; file: File | null }>({ title: '', file: null });
  const [submittingFile, setSubmittingFile] = useState(false);
  const [uploadingKind, setUploadingKind] = useState('');
  const [fileKey, setFileKey] = useState(0); // remounts the file input to clear it after upload
  const [downloadingId, setDownloadingId] = useState<string | null>(null);

  async function loadDashboard() {
    try {
      const data = await api.studentDashboard();
      setProfile(data.profile);
      setEnrollment(data.enrollment);
      setMilestones(data.milestones || []);
      setComments(data.comments || []);
      setProgressReports(data.progress_reports || []);
      setExtensions(data.extensions || []);
      setSubmissions(data.submissions || []);
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
    // Completion is a mentor sign-off: students submit work for review and
    // mentors mark it completed. A completed milestone is locked.
    if (milestone.status === 'completed') {
      toast.info('This milestone is signed off by a mentor and locked.');
      return;
    }
    const nextStatus = milestone.status === 'pending_review' ? 'in_progress' : 'pending_review';
    try {
      const updated = await api.updateMilestone(milestone.id, { status: nextStatus });
      setMilestones((prev) => prev.map((m) => m.id === milestone.id ? updated : m));
      toast.success(nextStatus === 'pending_review' ? 'Submitted for mentor review' : 'Review request withdrawn');
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

  function updateAccomplishmentLine(index: number, value: string) {
    setPrForm((prev) => ({
      ...prev,
      accomplishments: prev.accomplishments.map((line, i) => (i === index ? value : line))
    }));
  }

  function addAccomplishmentLine() {
    setPrForm((prev) => ({ ...prev, accomplishments: [...prev.accomplishments, ''] }));
  }

  function removeAccomplishmentLine(index: number) {
    setPrForm((prev) => ({
      ...prev,
      accomplishments: prev.accomplishments.length > 1 ? prev.accomplishments.filter((_, i) => i !== index) : prev.accomplishments
    }));
  }

  async function submitProgressReport(e: FormEvent) {
    e.preventDefault();
    const accomplishments = prForm.accomplishments.map((line) => line.trim()).filter(Boolean).join('\n');
    if (!prForm.period_start || !prForm.period_end || !accomplishments) {
      toast.error('Please fill in the reporting period and at least one accomplishment');
      return;
    }
    setSubmittingReport(true);
    try {
      await api.submitProgressReport({
        period_start: prForm.period_start,
        period_end: prForm.period_end,
        accomplishments,
        challenges: prForm.challenges
      });
      toast.success('Progress report submitted');
      setPrForm({ period_start: '', period_end: '', accomplishments: [''], challenges: '' });
      const data = await api.studentDashboard();
      setProgressReports(data.progress_reports || []);
    } catch (err: any) {
      toast.error(err.message || 'Failed to submit progress report');
    } finally {
      setSubmittingReport(false);
    }
  }

  async function submitExtensionRequest(e: FormEvent) {
    e.preventDefault();
    if (!extForm.requested_deadline || !extForm.reason.trim()) {
      toast.error('Please provide a requested deadline and a reason');
      return;
    }
    setSubmittingExtension(true);
    try {
      await api.submitExtension({
        extension_type: extForm.extension_type,
        requested_deadline: extForm.requested_deadline,
        reason: extForm.reason
      });
      toast.success('Extension request submitted');
      setExtForm({ extension_type: 'milestone', requested_deadline: '', reason: '' });
      const data = await api.studentDashboard();
      setExtensions(data.extensions || []);
    } catch (err: any) {
      toast.error(err.message || 'Failed to submit extension request');
    } finally {
      setSubmittingExtension(false);
    }
  }

  async function submitStep(e: FormEvent, kind: string, label: string) {
    e.preventDefault();
    if (!subForm.file) {
      toast.error('Please choose a file to upload');
      return;
    }
    if (subForm.file.size > MAX_SUBMISSION_FILE_SIZE) {
      toast.error('File is too large. Maximum size is 15 MB.');
      return;
    }
    setSubmittingFile(true);
    setUploadingKind(kind);
    try {
      await api.submitSubmission({ title: subForm.title.trim() || label, kind, file: subForm.file });
      toast.success(`${label} submitted for mentor review`);
      setSubForm({ title: '', file: null });
      setFileKey((k) => k + 1);
      const data = await api.studentDashboard();
      setSubmissions(data.submissions || []);
    } catch (err: any) {
      toast.error(err.message || 'Failed to upload submission');
    } finally {
      setSubmittingFile(false);
      setUploadingKind('');
    }
  }

  async function handleDownloadSubmission(s: Submission) {
    setDownloadingId(s.id);
    try {
      await api.downloadSubmission(s.id, 'student', s.file_name);
    } catch (err: any) {
      toast.error(err.message || 'Failed to download file');
    } finally {
      setDownloadingId(null);
    }
  }

  return (
    <main className="workspace student-workspace">
      <aside className="rail">
        <div className="rail-head">
          <strong className="rail-title">Arcus Student</strong>
          <span className="rail-user">{user?.full_name}</span>
        </div>

        <nav className="rail-nav">
          {([
            ['overview', 'Overview', Rocket],
            ['milestones', 'Milestones', CheckSquare],
            ['discussion', 'Discussion', MessageSquare],
            ['reports', 'Progress Reports', FileText],
            ['extensions', 'Extensions', CalendarClock],
            ['submissions', 'Submissions', UploadCloud],
          ] as [Section, string, typeof Rocket][]).map(([section, label, Icon]) => (
            <button
              key={section}
              onClick={() => setActiveSection(section)}
              className={activeSection === section ? 'active' : ''}
            >
              <Icon size={16} /> {label}
            </button>
          ))}
        </nav>

        <div className="rail-program">
          <div className="rail-program-label">Program Info</div>
          <div className="rail-program-card">
            <div>Tier: <strong>{enrollment?.tier || profile?.tier}</strong></div>
            <div style={{ marginTop: '6px' }}>Status: <span style={{ color: 'var(--accent)' }}>{enrollment?.status?.replace('_', ' ')}</span></div>
          </div>
        </div>

        <div className="rail-actions">
          <button onClick={logout}><LogOut size={17} /> Logout</button>
        </div>
      </aside>
      
      <section className="work-main">
        <div className="workspace-head">
          <div>
            <p className="eyebrow">Student Portal Dashboard</p>
            <h1>{SECTION_TITLES[activeSection]}</h1>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            <span style={{ fontSize: '14px', color: '#5a625d', fontWeight: '800' }}>Overall Progress</span>
            <div className="progress-ring">{profile?.progress_pct ?? 0}%</div>
          </div>
        </div>

        {activeSection === 'milestones' && (
          <div className="student-sections">
            {/* Milestones Checklist Panel */}
            <div className="panel" style={{ padding: '24px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px' }}>
                <CheckSquare size={22} style={{ color: 'var(--accent)' }} />
                <h2 style={{ margin: 0, fontSize: '22px' }}>Your Milestone Checklist</h2>
              </div>
              <p style={{ fontSize: '13px', marginBottom: '20px' }}>Tick a milestone to submit it for mentor review (tick again to withdraw). A mentor signs it off as completed. Signed-off items are locked. Feedback appears under each item.</p>
              
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
                        {m.status === 'completed' ? <CheckSquare size={22} style={{ color: '#5f7c29' }} /> : m.status === 'pending_review' ? <CheckSquare size={22} style={{ color: '#2a5788' }} /> : <Square size={22} />}
                      </button>
                      <div style={{ flex: 1 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', gap: '10px', alignItems: 'baseline' }}>
                          <strong style={{ color: '#111512', fontSize: '15px' }}>{m.title}</strong>
                          <span style={{
                            fontSize: '11px',
                            padding: '2px 8px',
                            borderRadius: '10px',
                            background: m.status === 'completed' ? '#e8f2dc' : m.status === 'pending_review' ? '#e2ecf8' : m.status === 'in_progress' ? '#fff2e2' : '#f0f0f0',
                            color: m.status === 'completed' ? '#35520f' : m.status === 'pending_review' ? '#2a5788' : m.status === 'in_progress' ? '#c98745' : '#555',
                            fontWeight: 'bold',
                            textTransform: 'uppercase'
                          }}>{m.status.replace(/_/g, ' ')}</span>
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
          </div>
        )}

        {activeSection === 'discussion' && (
          <div className="student-sections">
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
        )}

        {activeSection === 'overview' && (
          <div className="student-sections">
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
        )}

        {activeSection === 'reports' && (
          <div className="student-sections">
          {/* Progress Reports Panel */}
          <div className="panel" style={{ padding: '24px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px' }}>
              <FileText size={22} style={{ color: 'var(--accent)' }} />
              <h2 style={{ margin: 0, fontSize: '22px' }}>Progress Reports</h2>
            </div>
            <p style={{ fontSize: '13px', marginBottom: '20px' }}>Submit periodic progress reports covering what you accomplished and any challenges. Your mentor will review and leave feedback.</p>

            <form onSubmit={submitProgressReport} style={{ display: 'grid', gap: '12px', marginBottom: '20px', paddingBottom: '20px', borderBottom: '1px solid var(--line)' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <label style={{ fontSize: '12px', color: '#5a625d', display: 'block', marginBottom: '4px' }}>Period Start</label>
                  <input
                    required
                    type="date"
                    value={prForm.period_start}
                    onChange={(e) => setPrForm({ ...prForm, period_start: e.target.value })}
                    style={{ color: '#111512', background: '#f7f8f3', border: '1px solid #d8dbd1' }}
                  />
                </div>
                <div>
                  <label style={{ fontSize: '12px', color: '#5a625d', display: 'block', marginBottom: '4px' }}>Period End</label>
                  <input
                    required
                    type="date"
                    value={prForm.period_end}
                    onChange={(e) => setPrForm({ ...prForm, period_end: e.target.value })}
                    style={{ color: '#111512', background: '#f7f8f3', border: '1px solid #d8dbd1' }}
                  />
                </div>
              </div>

              <div>
                <label style={{ fontSize: '12px', color: '#5a625d', display: 'block', marginBottom: '4px' }}>Accomplishments</label>
                <div style={{ display: 'grid', gap: '8px' }}>
                  {prForm.accomplishments.map((line, i) => (
                    <div key={i} style={{ display: 'flex', gap: '6px' }}>
                      <input
                        placeholder={`Accomplishment ${i + 1}`}
                        value={line}
                        onChange={(e) => updateAccomplishmentLine(i, e.target.value)}
                        style={{ flex: 1, color: '#111512', background: '#f7f8f3', border: '1px solid #d8dbd1' }}
                      />
                      {prForm.accomplishments.length > 1 && (
                        <button
                          type="button"
                          onClick={() => removeAccomplishmentLine(i)}
                          style={{ background: '#eef0ea', border: 0, borderRadius: '4px', padding: '0 10px', cursor: 'pointer', color: '#5a625d' }}
                        >
                          <X size={14} />
                        </button>
                      )}
                    </div>
                  ))}
                  <button
                    type="button"
                    onClick={addAccomplishmentLine}
                    style={{ background: 'transparent', border: '1px dashed #d8dbd1', borderRadius: '4px', padding: '6px 10px', fontSize: '12px', color: '#5a625d', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '4px', width: 'fit-content' }}
                  >
                    <Plus size={12} /> Add another
                  </button>
                </div>
              </div>

              <div>
                <label style={{ fontSize: '12px', color: '#5a625d', display: 'block', marginBottom: '4px' }}>Challenges (optional)</label>
                <textarea
                  placeholder="Any blockers, risks, or challenges you're facing..."
                  value={prForm.challenges}
                  onChange={(e) => setPrForm({ ...prForm, challenges: e.target.value })}
                  style={{ minHeight: '70px', color: '#111512', background: '#f7f8f3', border: '1px solid #d8dbd1' }}
                />
              </div>

              <button type="submit" disabled={submittingReport} className="primary" style={{ width: '100%', minHeight: '40px' }}>
                {submittingReport ? 'Submitting...' : 'Submit Progress Report'}
              </button>
            </form>

            <div style={{ display: 'grid', gap: '12px', maxHeight: '360px', overflowY: 'auto', paddingRight: '4px' }}>
              {progressReports.length === 0 ? (
                <p style={{ color: '#5a625d', fontSize: '14px', padding: '12px', background: '#f7f8f3', borderRadius: '6px', textAlign: 'center' }}>No progress reports submitted yet.</p>
              ) : (
                progressReports.map((r) => (
                  <div key={r.id} style={{ padding: '14px 16px', background: '#f7f8f3', border: '1px solid #d8dbd1', borderRadius: '8px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: '10px', alignItems: 'baseline', marginBottom: '8px' }}>
                      <strong style={{ color: '#111512', fontSize: '13px' }}>
                        {new Date(r.period_start).toLocaleDateString()} &ndash; {new Date(r.period_end).toLocaleDateString()}
                      </strong>
                      <span style={{
                        fontSize: '11px',
                        padding: '2px 8px',
                        borderRadius: '10px',
                        background: r.status === 'reviewed' ? '#e8f2dc' : '#fff2e2',
                        color: r.status === 'reviewed' ? '#35520f' : '#c98745',
                        fontWeight: 'bold',
                        textTransform: 'uppercase'
                      }}>{r.status}</span>
                    </div>
                    <ul style={{ margin: '0 0 8px', paddingLeft: '18px', fontSize: '13px', color: '#2d3330' }}>
                      {r.accomplishments.split('\n').filter(Boolean).map((line, i) => (
                        <li key={i}>{line}</li>
                      ))}
                    </ul>
                    {r.challenges && (
                      <p style={{ fontSize: '12px', color: '#5a625d', margin: '0 0 8px', whiteSpace: 'pre-line' }}><strong>Challenges:</strong> {r.challenges}</p>
                    )}
                    {r.supervisor_feedback && (
                      <div style={{ background: '#fff', borderLeft: '3px solid var(--copper)', padding: '8px 12px', borderRadius: '0 4px 4px 0', fontSize: '12px', color: '#c98745' }}>
                        <strong>Mentor Feedback:</strong> {r.supervisor_feedback}
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>
          </div>
        )}

        {activeSection === 'extensions' && (
          <div className="student-sections">
          {/* Extension Requests Panel */}
          <div className="panel" style={{ padding: '24px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px' }}>
              <CalendarClock size={22} style={{ color: 'var(--accent)' }} />
              <h2 style={{ margin: 0, fontSize: '22px' }}>Extension Requests</h2>
            </div>
            <p style={{ fontSize: '13px', marginBottom: '20px' }}>Request a deadline extension for a milestone, your final submission, or an assessment.</p>

            <form onSubmit={submitExtensionRequest} style={{ display: 'grid', gap: '12px', marginBottom: '20px', paddingBottom: '20px', borderBottom: '1px solid var(--line)' }}>
              <div>
                <label style={{ fontSize: '12px', color: '#5a625d', display: 'block', marginBottom: '4px' }}>Extension For</label>
                <select
                  value={extForm.extension_type}
                  onChange={(e) => setExtForm({ ...extForm, extension_type: e.target.value })}
                  style={{ color: '#111512', background: '#f7f8f3', border: '1px solid #d8dbd1' }}
                >
                  <option value="milestone">Milestone</option>
                  <option value="final_submission">Final Submission</option>
                  <option value="assessment">Assessment</option>
                </select>
              </div>
              <div>
                <label style={{ fontSize: '12px', color: '#5a625d', display: 'block', marginBottom: '4px' }}>Requested New Deadline</label>
                <input
                  required
                  type="date"
                  value={extForm.requested_deadline}
                  onChange={(e) => setExtForm({ ...extForm, requested_deadline: e.target.value })}
                  style={{ color: '#111512', background: '#f7f8f3', border: '1px solid #d8dbd1' }}
                />
              </div>
              <div>
                <label style={{ fontSize: '12px', color: '#5a625d', display: 'block', marginBottom: '4px' }}>Reason</label>
                <textarea
                  required
                  placeholder="Explain why you need more time..."
                  value={extForm.reason}
                  onChange={(e) => setExtForm({ ...extForm, reason: e.target.value })}
                  style={{ minHeight: '70px', color: '#111512', background: '#f7f8f3', border: '1px solid #d8dbd1' }}
                />
              </div>
              <button type="submit" disabled={submittingExtension} className="primary" style={{ width: '100%', minHeight: '40px' }}>
                {submittingExtension ? 'Submitting...' : 'Submit Extension Request'}
              </button>
            </form>

            <div style={{ display: 'grid', gap: '12px', maxHeight: '360px', overflowY: 'auto', paddingRight: '4px' }}>
              {extensions.length === 0 ? (
                <p style={{ color: '#5a625d', fontSize: '14px', padding: '12px', background: '#f7f8f3', borderRadius: '6px', textAlign: 'center' }}>No extension requests submitted yet.</p>
              ) : (
                extensions.map((ext) => (
                  <div key={ext.id} style={{ padding: '14px 16px', background: '#f7f8f3', border: '1px solid #d8dbd1', borderRadius: '8px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: '10px', alignItems: 'baseline', marginBottom: '8px' }}>
                      <strong style={{ color: '#111512', fontSize: '13px', textTransform: 'capitalize' }}>{ext.extension_type.replace(/_/g, ' ')}</strong>
                      <span style={{
                        fontSize: '11px',
                        padding: '2px 8px',
                        borderRadius: '10px',
                        background: ext.status === 'approved' ? '#e8f2dc' : ext.status === 'denied' ? '#ffe2e2' : '#fff2e2',
                        color: ext.status === 'approved' ? '#35520f' : ext.status === 'denied' ? '#a00' : '#c98745',
                        fontWeight: 'bold',
                        textTransform: 'uppercase'
                      }}>{ext.status}</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '12px', color: '#5a625d', marginBottom: '6px' }}>
                      <Clock size={12} /> Requested new deadline: {new Date(ext.requested_deadline).toLocaleDateString()}
                    </div>
                    <p style={{ fontSize: '13px', margin: '0 0 8px', color: '#2d3330', whiteSpace: 'pre-line' }}>{ext.reason}</p>
                    {ext.decision_note && (
                      <div style={{ background: '#fff', borderLeft: '3px solid var(--copper)', padding: '8px 12px', borderRadius: '0 4px 4px 0', fontSize: '12px', color: '#c98745' }}>
                        <strong>Decision Note:</strong> {ext.decision_note}
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>
          </div>
        )}

        {activeSection === 'submissions' && (
          <div className="student-sections">
            <div className="panel" style={{ padding: '24px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px' }}>
                <UploadCloud size={22} style={{ color: 'var(--accent)' }} />
                <h2 style={{ margin: 0, fontSize: '22px' }}>Submission Pipeline</h2>
              </div>
              <p style={{ fontSize: '13px', marginBottom: '20px' }}>Work through the steps in order. Each step unlocks only after a mentor approves the previous one. Max file size 15 MB.</p>

              <div style={{ display: 'grid', gap: '14px' }}>
                {(SUBMISSION_STEPS).map((step, i) => {
                  const mine = submissions
                    .filter((s) => s.kind === step.key)
                    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
                  const latest = mine[0];
                  const accepted = mine.some((s) => s.status === 'accepted');
                  const prevAccepted = i === 0 || submissions.some((s) => s.kind === SUBMISSION_STEPS[i - 1].key && s.status === 'accepted');
                  const unlocked = i === 0 || prevAccepted;
                  // `state` below carries the same three cases, so the separate
                  // `active` boolean it replaced was dead.
                  const state: 'done' | 'active' | 'locked' = accepted ? 'done' : unlocked ? 'active' : 'locked';
                  const accent = state === 'done' ? '#5f7c29' : state === 'active' ? '#2a5788' : '#b0b4ab';

                  return (
                    <div key={step.key} style={{ border: `1px solid ${state === 'locked' ? '#e2e4dd' : '#d8dbd1'}`, borderLeft: `4px solid ${accent}`, borderRadius: '8px', padding: '16px 18px', background: state === 'locked' ? '#f3f4f0' : '#fff', opacity: state === 'locked' ? 0.75 : 1 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '6px' }}>
                        <div style={{ width: '28px', height: '28px', borderRadius: '50%', display: 'grid', placeItems: 'center', background: state === 'done' ? '#e8f2dc' : state === 'active' ? '#e2ecf8' : '#e7e9e3', color: accent, flexShrink: 0 }}>
                          {state === 'done' ? <CheckCircle2 size={17} /> : state === 'locked' ? <Lock size={15} /> : i + 1}
                        </div>
                        <strong style={{ color: '#111512', fontSize: '16px' }}>Step {i + 1}: {step.label}</strong>
                        {latest && (
                          <span style={{
                            marginLeft: 'auto', fontSize: '11px', padding: '2px 8px', borderRadius: '10px', fontWeight: 'bold', textTransform: 'uppercase',
                            background: latest.status === 'accepted' ? '#e8f2dc' : latest.status === 'revise' ? '#fff2e2' : '#e2ecf8',
                            color: latest.status === 'accepted' ? '#35520f' : latest.status === 'revise' ? '#c98745' : '#2a5788',
                          }}>{latest.status === 'submitted' ? 'awaiting review' : latest.status}</span>
                        )}
                      </div>
                      <p style={{ fontSize: '13px', color: '#5a625d', margin: '0 0 12px', paddingLeft: '38px' }}>{step.desc}</p>

                      <div style={{ paddingLeft: '38px' }}>
                        {state === 'locked' && (
                          <p style={{ fontSize: '12px', color: '#8a908a', margin: 0, display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <Lock size={12} /> Unlocks after Step {i} ({SUBMISSION_STEPS[i - 1].label}) is approved.
                          </p>
                        )}

                        {latest && (
                          <div style={{ background: '#f7f8f3', border: '1px solid #e2e4dd', borderRadius: '6px', padding: '10px 12px', marginBottom: state === 'active' ? '12px' : 0 }}>
                            <div style={{ fontSize: '12px', color: '#5a625d', display: 'flex', gap: '10px', flexWrap: 'wrap', marginBottom: '8px' }}>
                              <span>{latest.file_name}</span>
                              <span>{formatFileSize(latest.size)}</span>
                            </div>
                            {latest.review_note && (
                              <div style={{ background: '#fff', borderLeft: '3px solid var(--copper)', padding: '8px 12px', borderRadius: '0 4px 4px 0', fontSize: '12px', color: '#c98745', marginBottom: '8px' }}>
                                <strong>Mentor Note:</strong> {latest.review_note}
                              </div>
                            )}
                            <button
                              onClick={() => handleDownloadSubmission(latest)}
                              disabled={downloadingId === latest.id}
                              style={{ background: '#eef0ea', color: '#111512', minHeight: '30px', fontSize: '12px', padding: '0 12px', borderRadius: '4px', border: 0, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '6px' }}
                            >
                              <Download size={13} /> {downloadingId === latest.id ? 'Downloading...' : 'Download'}
                            </button>
                          </div>
                        )}

                        {state === 'active' && (
                          <form onSubmit={(e) => submitStep(e, step.key, step.label)} style={{ display: 'grid', gap: '10px', marginTop: latest ? '4px' : 0 }}>
                            {latest && latest.status === 'revise' && (
                              <p style={{ fontSize: '12px', color: '#c98745', margin: 0 }}>Revision requested. Upload an updated file below.</p>
                            )}
                            <input
                              placeholder={`Title (optional, defaults to "${step.label}")`}
                              value={subForm.title}
                              onChange={(e) => setSubForm({ ...subForm, title: e.target.value })}
                              style={{ color: '#111512', background: '#f7f8f3', border: '1px solid #d8dbd1' }}
                            />
                            <input
                              key={fileKey}
                              required
                              type="file"
                              onChange={(e) => setSubForm({ ...subForm, file: e.target.files?.[0] ?? null })}
                              style={{ color: '#111512', background: '#f7f8f3', border: '1px solid #d8dbd1', padding: '8px' }}
                            />
                            <button type="submit" disabled={submittingFile} className="primary" style={{ width: '100%', minHeight: '40px' }}>
                              {submittingFile && uploadingKind === step.key ? 'Uploading...' : latest ? `Re-upload ${step.label}` : `Submit ${step.label}`}
                            </button>
                          </form>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}
      </section>
    </main>
  );
}
