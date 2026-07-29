import { useEffect, useState } from 'react';
import {
  FileText, Send, Edit2, CalendarClock, ThumbsUp, ThumbsDown,
  UploadCloud, Download, Lock, CheckCircle2, GraduationCap,
} from 'lucide-react';
import { toast } from 'sonner';
import { api, formatFileSize, errorMessage } from '../../lib/api';
import { useCan } from '../../lib/permissions';
import type {
  User, StudentProfile, CapstoneMilestone, CapstoneComment,
  ProgressReport, ExtensionRequest, Submission,
} from '../../types';
import { Loadable } from '../../components/Loadable';
import { Badge, type Tone } from '../../components/Badge';
import { useRefreshSignal } from '../../lib/refresh';

/** Gated submission pipeline (mirrors the student side + backend stage order). */
const SUBMISSION_STEPS: { key: string; label: string }[] = [
  { key: 'proposal', label: 'Proposal' },
  { key: 'report', label: 'Report' },
  { key: 'final', label: 'Final' },
];

/**
 * The student workspace as the admin sees it. `profile` is non-null whenever
 * the request succeeds — the server 404s a student without one — but it is
 * typed nullable because the JSX reads it before the fetch resolves.
 */
interface StudentDetails {
  profile: StudentProfile | null;
  milestones: CapstoneMilestone[];
  comments: CapstoneComment[];
  progress_reports: ProgressReport[];
  extensions: ExtensionRequest[];
  submissions: Submission[];
}

const MILESTONE_TONES: Record<CapstoneMilestone['status'], Tone> = {
  pending: 'neutral',
  in_progress: 'info',
  pending_review: 'notice',
  completed: 'positive',
};

const REPORT_TONES: Record<ProgressReport['status'], Tone> = {
  submitted: 'notice',
  reviewed: 'positive',
};

const EXTENSION_TONES: Record<ExtensionRequest['status'], Tone> = {
  pending: 'notice',
  approved: 'positive',
  denied: 'danger',
};

const SUBMISSION_TONES: Record<Submission['status'], Tone> = {
  submitted: 'info',
  accepted: 'positive',
  revise: 'notice',
};

interface Props {
  /**
   * Whether students is the section on screen. The component stays mounted
   * either way, matching the other features — nothing here opens a dialog, but
   * a section that unmounts also throws away the selected student, and coming
   * back to a cleared panel is not what a tab switch should mean.
   */
  active: boolean;
}

export function StudentsSection({ active }: Props) {
  const can = useCan();

  const [students, setStudents] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedStudent, setSelectedStudent] = useState<User | null>(null);
  const [details, setDetails] = useState<StudentDetails | null>(null);

  const [newComment, setNewComment] = useState('');
  const [editingMilestoneId, setEditingMilestoneId] = useState<string | null>(null);
  const [milestoneFeedback, setMilestoneFeedback] = useState('');
  const [milestoneStatus, setMilestoneStatus] = useState<CapstoneMilestone['status']>('pending');

  const [editingReportId, setEditingReportId] = useState<string | null>(null);
  const [reportFeedbackDraft, setReportFeedbackDraft] = useState('');

  const [editingExtensionId, setEditingExtensionId] = useState<string | null>(null);
  const [extensionNoteDraft, setExtensionNoteDraft] = useState('');

  const [editingSubmissionId, setEditingSubmissionId] = useState<string | null>(null);
  const [submissionNoteDraft, setSubmissionNoteDraft] = useState('');
  const [downloadingSubmissionId, setDownloadingSubmissionId] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    try {
      setStudents(await api.listStudents());
    } catch (err) {
      toast.error(errorMessage(err, 'Could not load students'));
    } finally {
      setLoading(false);
    }
  }

  const refresh = useRefreshSignal();

  useEffect(() => {
    if (active) load();
    // `refresh` is the rail's Refresh Data signal — see lib/refresh. The
    // `active` guard means a bump refetches only the visible section.
  }, [active, refresh]);

  async function viewStudentDetails(student: User) {
    setSelectedStudent(student);
    setDetails(null);
    try {
      const next = await api.getStudent(student.id);
      setDetails({
        profile: next.profile,
        milestones: next.milestones || [],
        comments: next.comments || [],
        progress_reports: next.progress_reports || [],
        extensions: next.extensions || [],
        submissions: next.submissions || [],
      });
    } catch (err) {
      toast.error(errorMessage(err, 'Failed to load student workspace details'));
    }
  }

  async function postComment(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedStudent || !newComment.trim()) return;
    try {
      const created = await api.adminPostComment(selectedStudent.id, newComment);
      setDetails((prev) => (prev ? { ...prev, comments: [...prev.comments, created] } : null));
      setNewComment('');
      toast.success('Comment posted successfully');
    } catch (err) {
      toast.error(errorMessage(err, 'Failed to post comment'));
    }
  }

  function triggerMilestoneEdit(m: CapstoneMilestone) {
    setEditingMilestoneId(m.id);
    setMilestoneStatus(m.status);
    setMilestoneFeedback(m.feedback || '');
  }

  async function saveMilestoneUpdate(mId: string) {
    if (!selectedStudent) return;
    try {
      const updated = await api.adminUpdateMilestone(selectedStudent.id, mId, {
        status: milestoneStatus,
        feedback: milestoneFeedback,
      });
      setDetails((prev) =>
        prev ? { ...prev, milestones: prev.milestones.map((m) => (m.id === mId ? updated : m)) } : null,
      );
      setEditingMilestoneId(null);
      toast.success('Milestone updated successfully');
      // The directory shows a progress percentage the sign-off just moved.
      setStudents(await api.listStudents());
    } catch (err) {
      toast.error(errorMessage(err, 'Failed to save milestone update'));
    }
  }

  function triggerReportFeedbackEdit(r: ProgressReport) {
    setEditingReportId(r.id);
    setReportFeedbackDraft(r.supervisor_feedback || '');
  }

  async function markReportReviewed(reportId: string) {
    try {
      const updated = await api.adminRespondProgressReport(reportId, {
        supervisor_feedback: reportFeedbackDraft,
        status: 'reviewed',
      });
      setDetails((prev) =>
        prev
          ? { ...prev, progress_reports: prev.progress_reports.map((r) => (r.id === reportId ? updated : r)) }
          : null,
      );
      setEditingReportId(null);
      toast.success('Progress report marked reviewed');
    } catch (err) {
      toast.error(errorMessage(err, 'Failed to update progress report'));
    }
  }

  function triggerExtensionDecision(ext: ExtensionRequest) {
    setEditingExtensionId(ext.id);
    setExtensionNoteDraft(ext.decision_note || '');
  }

  async function decideExtension(extensionId: string, status: 'approved' | 'denied') {
    try {
      const updated = await api.adminRespondExtension(extensionId, {
        status,
        decision_note: extensionNoteDraft,
      });
      setDetails((prev) =>
        prev ? { ...prev, extensions: prev.extensions.map((e) => (e.id === extensionId ? updated : e)) } : null,
      );
      setEditingExtensionId(null);
      toast.success(`Extension request ${status}`);
    } catch (err) {
      toast.error(errorMessage(err, 'Failed to update extension request'));
    }
  }

  function triggerSubmissionReview(s: Submission) {
    setEditingSubmissionId(s.id);
    setSubmissionNoteDraft(s.review_note || '');
  }

  async function reviewSubmission(submissionId: string, status: 'accepted' | 'revise') {
    try {
      const updated = await api.adminReviewSubmission(submissionId, {
        status,
        review_note: submissionNoteDraft,
      });
      setDetails((prev) =>
        prev ? { ...prev, submissions: prev.submissions.map((s) => (s.id === submissionId ? updated : s)) } : null,
      );
      setEditingSubmissionId(null);
      toast.success(`Submission ${status === 'accepted' ? 'accepted' : 'sent back for revision'}`);
    } catch (err) {
      toast.error(errorMessage(err, 'Failed to update submission'));
    }
  }

  async function downloadSubmission(s: Submission) {
    setDownloadingSubmissionId(s.id);
    try {
      await api.downloadSubmission(s.id, 'admin', s.file_name);
    } catch (err) {
      toast.error(errorMessage(err, 'Failed to download file'));
    } finally {
      setDownloadingSubmissionId(null);
    }
  }

  const panel = { padding: 'var(--space-3)' };
  const heading = { margin: 0, fontSize: 'var(--fs-500)' };
  const well = {
    padding: 'var(--space-3)',
    background: 'var(--ws-sunken)',
    border: '1px solid var(--ws-border-strong)',
    borderRadius: '6px',
  };
  const field = {
    color: 'var(--ws-fg)',
    background: 'var(--ws-panel)',
    border: '1px solid var(--ws-border-strong)',
    fontSize: 'var(--fs-200)',
    padding: 'var(--space-2)',
  };
  const smallBtn = {
    background: 'var(--ws-canvas)',
    color: 'var(--ws-fg)',
    minHeight: '32px',
    fontSize: 'var(--fs-200)',
    padding: '0 12px',
    borderRadius: '4px',
    border: 0,
    cursor: 'pointer',
  };
  const linkBtn = {
    background: 'var(--ws-canvas)',
    color: 'var(--ws-fg)',
    minHeight: '28px',
    fontSize: 'var(--fs-100)',
    padding: '0 10px',
    borderRadius: '4px',
    border: 0,
    cursor: 'pointer',
  };
  const dangerBtn = {
    ...smallBtn,
    background: 'var(--tone-danger-bg)',
    color: 'var(--tone-danger-fg)',
    display: 'inline-flex',
    alignItems: 'center',
    gap: 'var(--space-1)',
  };
  const primarySmall = {
    minHeight: '32px',
    fontSize: 'var(--fs-200)',
    padding: '0 12px',
    borderRadius: '4px',
    border: 0,
    display: 'inline-flex',
    alignItems: 'center',
    gap: 'var(--space-1)',
  };
  /** The quoted-back note that appears under a milestone, report or review. */
  const quote = {
    fontSize: 'var(--fs-100)',
    color: 'var(--copper)',
    background: 'var(--ws-panel)',
    borderLeft: '2px solid var(--copper)',
    padding: 'var(--space-1) var(--space-2)',
    borderRadius: '0 4px 4px 0',
  };

  if (!active) return null;

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '0.8fr 1.2fr', gap: 'var(--space-4)', alignItems: 'start' }}>
      <section className="data-section" style={{ marginTop: 0 }}>
        <h2>Enrolled Students</h2>
        <div className="table">
          <Loadable
            loading={loading}
            empty={students.length === 0}
            emptyMessage="No student records found."
            emptyIcon={<GraduationCap size={26} strokeWidth={1.5} />}
          >
            {students.map((student) => {
              const isSelected = selectedStudent?.id === student.id;
              return (
                <article
                  key={student.id}
                  className={`row ${isSelected ? 'active' : ''}`}
                  onClick={() => viewStudentDetails(student)}
                  style={{
                    gridTemplateColumns: '1fr auto',
                    cursor: 'pointer',
                    borderLeft: isSelected ? '4px solid var(--accent)' : '1px solid var(--ws-border)',
                    background: isSelected ? 'var(--ws-sunken)' : 'var(--ws-panel)',
                  }}
                >
                  <div>
                    <strong>{student.full_name}</strong>
                    <div style={{ fontSize: 'var(--fs-200)', color: 'var(--ws-fg-muted)' }}>{student.email}</div>
                    <div style={{ fontSize: 'var(--fs-100)', color: 'var(--copper)', marginTop: 'var(--space-1)' }}>
                      Tier: {student.student_profile?.tier || 'Explorer'}
                    </div>
                  </div>
                  <span className="status">{student.student_profile?.progress_pct ?? 0}%</span>
                </article>
              );
            })}
          </Loadable>
        </div>
      </section>

      <section className="data-section" style={{ marginTop: 0 }}>
        <h2>Capstone Tracking details</h2>
        {!selectedStudent ? (
          <div className="empty">
            <GraduationCap size={26} strokeWidth={1.5} />
            <span>
              Select a student from the directory to review and manage their Capstone brief, milestones, and
              leave mentorship feedback.
            </span>
          </div>
        ) : !details ? (
          <p style={{ color: 'var(--ws-fg-muted)', textAlign: 'center', padding: 'var(--space-5)' }}>
            Loading tracking data…
          </p>
        ) : (
          <div style={{ display: 'grid', gap: 'var(--space-4)' }}>
            {/* Capstone brief */}
            <article className="panel" style={panel}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 'var(--space-2)', alignItems: 'baseline' }}>
                <h3 style={heading}>Capstone Scope</h3>
                <span className="status">{details.profile?.tier}</span>
              </div>
              <strong style={{ display: 'block', marginBlock: 'var(--space-3) var(--space-1)', color: 'var(--ws-fg)' }}>
                {details.profile?.capstone_title || 'Unnamed Capstone'}
              </strong>
              <p style={{ fontSize: 'var(--fs-300)', lineHeight: 'var(--lh-body)', margin: 0, whiteSpace: 'pre-line' }}>
                {details.profile?.capstone_summary || 'No project summary specified by student yet.'}
              </p>
            </article>

            {/* Milestones checklist */}
            <article className="panel" style={panel}>
              <h3 style={{ ...heading, marginBottom: 'var(--space-3)' }}>Milestone Checklist</h3>
              <div style={{ display: 'grid', gap: 'var(--space-3)' }}>
                {details.milestones.map((m) => (
                  <div key={m.id} style={well}>
                    {editingMilestoneId === m.id ? (
                      <div style={{ display: 'grid', gap: 'var(--space-2)' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <strong>{m.title}</strong>
                          <select
                            value={milestoneStatus}
                            onChange={(e) => setMilestoneStatus(e.target.value as CapstoneMilestone['status'])}
                            style={{ ...field, width: 'auto', padding: 'var(--space-1) var(--space-2)' }}
                          >
                            <option value="pending">Pending</option>
                            <option value="in_progress">In Progress</option>
                            <option value="pending_review">Pending Review</option>
                            <option value="completed">Completed (sign-off)</option>
                          </select>
                        </div>
                        <input
                          placeholder="Add review feedback…"
                          value={milestoneFeedback}
                          onChange={(e) => setMilestoneFeedback(e.target.value)}
                          style={field}
                        />
                        <div style={{ display: 'flex', gap: 'var(--space-2)', justifyContent: 'flex-end' }}>
                          <button onClick={() => setEditingMilestoneId(null)} style={smallBtn}>Cancel</button>
                          <button
                            onClick={() => saveMilestoneUpdate(m.id)}
                            disabled={!can('students', 'update')}
                            className="primary"
                            style={primarySmall}
                          >
                            Save
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                          <strong style={{ color: 'var(--ws-fg)' }}>{m.title}</strong>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                            <Badge tone={MILESTONE_TONES[m.status]} upper>{m.status.replace(/_/g, ' ')}</Badge>
                            <button
                              onClick={() => triggerMilestoneEdit(m)}
                              title="Edit milestone"
                              style={{ background: 'transparent', border: 0, padding: 2, cursor: 'pointer', color: 'var(--ws-fg-muted)' }}
                            >
                              <Edit2 size={12} />
                            </button>
                          </div>
                        </div>
                        <p style={{ fontSize: 'var(--fs-200)', color: 'var(--ws-fg-muted)', margin: 'var(--space-1) 0 0' }}>
                          {m.description}
                        </p>
                        {m.feedback && (
                          <div style={{ ...quote, marginTop: 'var(--space-2)' }}>
                            <strong>Feedback:</strong> {m.feedback}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </article>

            {/* Discussion thread */}
            <article className="panel" style={panel}>
              <h3 style={{ ...heading, marginBottom: 'var(--space-3)' }}>Discussion thread</h3>
              <div style={{ display: 'grid', gap: 'var(--space-2)', maxHeight: '200px', overflowY: 'auto', marginBottom: 'var(--space-3)' }}>
                {details.comments.map((c) => (
                  <div key={c.id} style={{ ...well, padding: 'var(--space-2) 10px', fontSize: 'var(--fs-200)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 'var(--space-2)', color: 'var(--ws-fg-muted)', marginBottom: 'var(--space-1)' }}>
                      <span><strong>{c.author_name}</strong> ({c.author_role})</span>
                      <span>{new Date(c.created_at).toLocaleDateString()}</span>
                    </div>
                    <p style={{ margin: 0, color: 'var(--ws-fg)', whiteSpace: 'pre-line' }}>{c.message}</p>
                  </div>
                ))}
              </div>

              <form onSubmit={postComment} style={{ display: 'flex', gap: 'var(--space-2)' }}>
                <input
                  required
                  placeholder="Leave feedback or ask for updates…"
                  value={newComment}
                  onChange={(e) => setNewComment(e.target.value)}
                  style={{ color: 'var(--ws-fg)', background: 'var(--ws-sunken)', border: '1px solid var(--ws-border-strong)' }}
                />
                <button type="submit" disabled={!can('students', 'create')} className="primary" style={{ width: '44px', minHeight: '44px', padding: 0 }}>
                  <Send size={16} />
                </button>
              </form>
            </article>

            {/* Progress reports */}
            <article className="panel" style={panel}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', marginBottom: 'var(--space-3)' }}>
                <FileText size={18} style={{ color: 'var(--ws-accent)' }} />
                <h3 style={heading}>Progress Reports</h3>
              </div>
              <div style={{ display: 'grid', gap: 'var(--space-3)' }}>
                {details.progress_reports.length === 0 ? (
                  <p style={{ fontSize: 'var(--fs-200)', color: 'var(--ws-fg-muted)', textAlign: 'center', padding: 'var(--space-3)' }}>
                    No progress reports submitted yet.
                  </p>
                ) : (
                  details.progress_reports.map((r) => (
                    <div key={r.id} style={well}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 'var(--space-1)' }}>
                        <strong style={{ color: 'var(--ws-fg)', fontSize: 'var(--fs-300)' }}>
                          {new Date(r.period_start).toLocaleDateString()} &ndash; {new Date(r.period_end).toLocaleDateString()}
                        </strong>
                        <Badge tone={REPORT_TONES[r.status]} upper>{r.status}</Badge>
                      </div>
                      <ul style={{ margin: '0 0 var(--space-2)', paddingLeft: 'var(--space-3)', fontSize: 'var(--fs-200)', color: 'var(--ws-fg)' }}>
                        {r.accomplishments.split('\n').filter(Boolean).map((line, i) => (
                          <li key={i}>{line}</li>
                        ))}
                      </ul>
                      {r.challenges && (
                        <p style={{ fontSize: 'var(--fs-100)', color: 'var(--ws-fg-muted)', margin: '0 0 var(--space-2)', whiteSpace: 'pre-line' }}>
                          <strong>Challenges:</strong> {r.challenges}
                        </p>
                      )}
                      {editingReportId === r.id ? (
                        <div style={{ display: 'grid', gap: 'var(--space-2)' }}>
                          <textarea
                            placeholder="Add feedback for the student…"
                            value={reportFeedbackDraft}
                            onChange={(e) => setReportFeedbackDraft(e.target.value)}
                            style={{ ...field, minHeight: '60px' }}
                          />
                          <div style={{ display: 'flex', gap: 'var(--space-2)', justifyContent: 'flex-end' }}>
                            <button onClick={() => setEditingReportId(null)} style={smallBtn}>Cancel</button>
                            <button
                              onClick={() => markReportReviewed(r.id)}
                              disabled={!can('students', 'update')}
                              className="primary"
                              style={primarySmall}
                            >
                              Mark reviewed
                            </button>
                          </div>
                        </div>
                      ) : (
                        <>
                          {r.supervisor_feedback && (
                            <div style={{ ...quote, marginBottom: 'var(--space-2)' }}>
                              <strong>Feedback:</strong> {r.supervisor_feedback}
                            </div>
                          )}
                          <button onClick={() => triggerReportFeedbackEdit(r)} style={linkBtn}>
                            <Edit2 size={11} /> {r.status === 'reviewed' ? 'Edit feedback' : 'Respond'}
                          </button>
                        </>
                      )}
                    </div>
                  ))
                )}
              </div>
            </article>

            {/* Extension requests */}
            <article className="panel" style={panel}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', marginBottom: 'var(--space-3)' }}>
                <CalendarClock size={18} style={{ color: 'var(--ws-accent)' }} />
                <h3 style={heading}>Extension Requests</h3>
              </div>
              <div style={{ display: 'grid', gap: 'var(--space-3)' }}>
                {details.extensions.length === 0 ? (
                  <p style={{ fontSize: 'var(--fs-200)', color: 'var(--ws-fg-muted)', textAlign: 'center', padding: 'var(--space-3)' }}>
                    No extension requests submitted yet.
                  </p>
                ) : (
                  details.extensions.map((ext) => (
                    <div key={ext.id} style={well}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 'var(--space-1)' }}>
                        <strong style={{ color: 'var(--ws-fg)', fontSize: 'var(--fs-300)', textTransform: 'capitalize' }}>
                          {ext.extension_type.replace(/_/g, ' ')}
                        </strong>
                        <Badge tone={EXTENSION_TONES[ext.status]} upper>{ext.status}</Badge>
                      </div>
                      <div style={{ fontSize: 'var(--fs-100)', color: 'var(--ws-fg-muted)', marginBottom: 'var(--space-1)' }}>
                        Requested new deadline: <strong>{new Date(ext.requested_deadline).toLocaleDateString()}</strong>
                      </div>
                      <p style={{ fontSize: 'var(--fs-200)', color: 'var(--ws-fg)', margin: '0 0 var(--space-2)', whiteSpace: 'pre-line' }}>
                        {ext.reason}
                      </p>
                      {editingExtensionId === ext.id ? (
                        <div style={{ display: 'grid', gap: 'var(--space-2)' }}>
                          <input
                            placeholder="Decision note (optional)…"
                            value={extensionNoteDraft}
                            onChange={(e) => setExtensionNoteDraft(e.target.value)}
                            style={field}
                          />
                          <div style={{ display: 'flex', gap: 'var(--space-2)', justifyContent: 'flex-end' }}>
                            <button onClick={() => setEditingExtensionId(null)} style={smallBtn}>Cancel</button>
                            <button
                              onClick={() => decideExtension(ext.id, 'denied')}
                              disabled={!can('students', 'update')}
                              style={dangerBtn}
                            >
                              <ThumbsDown size={12} /> Deny
                            </button>
                            <button
                              onClick={() => decideExtension(ext.id, 'approved')}
                              disabled={!can('students', 'update')}
                              className="primary"
                              style={primarySmall}
                            >
                              <ThumbsUp size={12} /> Approve
                            </button>
                          </div>
                        </div>
                      ) : (
                        <>
                          {ext.decision_note && (
                            <div style={{ ...quote, marginBottom: 'var(--space-2)' }}>
                              <strong>Decision Note:</strong> {ext.decision_note}
                            </div>
                          )}
                          <button onClick={() => triggerExtensionDecision(ext)} style={linkBtn}>
                            <Edit2 size={11} /> {ext.status === 'pending' ? 'Decide' : 'Change decision'}
                          </button>
                        </>
                      )}
                    </div>
                  ))
                )}
              </div>
            </article>

            {/* Submissions review */}
            <article className="panel" style={panel}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', marginBottom: 'var(--space-3)' }}>
                <UploadCloud size={18} style={{ color: 'var(--ws-accent)' }} />
                <h3 style={heading}>Submissions</h3>
              </div>
              <div style={{ display: 'grid', gap: 'var(--space-3)' }}>
                {SUBMISSION_STEPS.map((step, i) => {
                  const mine = details.submissions
                    .filter((s) => s.kind === step.key)
                    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
                  const latest = mine[0];
                  const accepted = mine.some((s) => s.status === 'accepted');
                  const prevAccepted =
                    i === 0 ||
                    details.submissions.some((s) => s.kind === SUBMISSION_STEPS[i - 1].key && s.status === 'accepted');
                  const unlocked = i === 0 || prevAccepted;
                  const state: 'done' | 'active' | 'locked' = accepted ? 'done' : unlocked ? 'active' : 'locked';
                  // The left edge and the step bubble carry the gate state, so
                  // the ladder reads at a glance without any label being read.
                  const accent =
                    state === 'done' ? 'var(--ws-accent)'
                      : state === 'active' ? 'var(--tone-info-fg)'
                      : 'var(--ws-fg-faint)';
                  const bubble =
                    state === 'done' ? 'var(--tone-positive-bg)'
                      : state === 'active' ? 'var(--tone-info-bg)'
                      : 'var(--tone-neutral-bg)';
                  return (
                    <div
                      key={step.key}
                      style={{
                        ...well,
                        background: state === 'locked' ? 'var(--ws-canvas)' : 'var(--ws-sunken)',
                        borderLeft: `4px solid ${accent}`,
                        opacity: state === 'locked' ? 0.75 : 1,
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', marginBottom: latest ? 'var(--space-2)' : 0 }}>
                        <div style={{ width: '22px', height: '22px', borderRadius: '50%', display: 'grid', placeItems: 'center', fontSize: 'var(--fs-100)', fontWeight: 'var(--fw-strong)', background: bubble, color: accent, flexShrink: 0 }}>
                          {state === 'done' ? <CheckCircle2 size={14} /> : state === 'locked' ? <Lock size={12} /> : i + 1}
                        </div>
                        <strong style={{ color: 'var(--ws-fg)', fontSize: 'var(--fs-300)' }}>
                          Step {i + 1}: {step.label}
                        </strong>
                        {latest && (
                          <Badge tone={SUBMISSION_TONES[latest.status]} upper style={{ marginLeft: 'auto' }}>
                            {latest.status === 'submitted' ? 'awaiting review' : latest.status}
                          </Badge>
                        )}
                      </div>

                      {!latest && (
                        <p style={{ fontSize: 'var(--fs-100)', color: 'var(--ws-fg-subtle)', margin: 0, paddingLeft: '30px' }}>
                          {state === 'locked' ? `Unlocks once Step ${i} is approved.` : 'Awaiting student upload.'}
                        </p>
                      )}

                      {latest && (
                        <div style={{ paddingLeft: '30px' }}>
                          <div style={{ fontSize: 'var(--fs-100)', color: 'var(--ws-fg-muted)', marginBottom: 'var(--space-2)', display: 'flex', gap: 'var(--space-2)', flexWrap: 'wrap' }}>
                            <span>{latest.file_name}</span>
                            <span>{formatFileSize(latest.size)}</span>
                            {mine.length > 1 && <span>· {mine.length} versions</span>}
                          </div>
                          <button
                            onClick={() => downloadSubmission(latest)}
                            disabled={downloadingSubmissionId === latest.id}
                            style={{ ...linkBtn, display: 'inline-flex', alignItems: 'center', gap: 'var(--space-1)', marginBottom: 'var(--space-2)' }}
                          >
                            <Download size={11} /> {downloadingSubmissionId === latest.id ? 'Downloading…' : 'Download'}
                          </button>
                          {editingSubmissionId === latest.id ? (
                            <div style={{ display: 'grid', gap: 'var(--space-2)' }}>
                              <input
                                placeholder="Review note (optional)…"
                                value={submissionNoteDraft}
                                onChange={(e) => setSubmissionNoteDraft(e.target.value)}
                                style={field}
                              />
                              <div style={{ display: 'flex', gap: 'var(--space-2)', justifyContent: 'flex-end' }}>
                                <button onClick={() => setEditingSubmissionId(null)} style={smallBtn}>Cancel</button>
                                <button
                                  onClick={() => reviewSubmission(latest.id, 'revise')}
                                  disabled={!can('students', 'update')}
                                  style={dangerBtn}
                                >
                                  <ThumbsDown size={12} /> Request Revision
                                </button>
                                <button
                                  onClick={() => reviewSubmission(latest.id, 'accepted')}
                                  disabled={!can('students', 'update')}
                                  className="primary"
                                  style={primarySmall}
                                >
                                  <ThumbsUp size={12} /> Accept &amp; unlock next
                                </button>
                              </div>
                            </div>
                          ) : (
                            <>
                              {latest.review_note && (
                                <div style={{ ...quote, marginBottom: 'var(--space-2)' }}>
                                  <strong>Review Note:</strong> {latest.review_note}
                                </div>
                              )}
                              <button onClick={() => triggerSubmissionReview(latest)} style={linkBtn}>
                                <Edit2 size={11} /> {latest.status === 'submitted' ? 'Review' : 'Change decision'}
                              </button>
                            </>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Anything the student filed outside the three gated steps. */}
              {(() => {
                const extras = details.submissions.filter((s) => !SUBMISSION_STEPS.some((st) => st.key === s.kind));
                if (extras.length === 0) return null;
                return (
                  <div style={{ marginTop: 'var(--space-3)', paddingTop: 'var(--space-3)', borderTop: '1px solid var(--ws-border)' }}>
                    <span style={{ fontSize: 'var(--fs-100)', color: 'var(--ws-fg-muted)', fontWeight: 'var(--fw-strong)', display: 'block', marginBottom: 'var(--space-2)' }}>
                      OTHER FILES
                    </span>
                    <div style={{ display: 'grid', gap: 'var(--space-2)' }}>
                      {extras.map((s) => (
                        <div key={s.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 'var(--space-2)', fontSize: 'var(--fs-100)', color: 'var(--ws-fg-muted)', background: 'var(--ws-sunken)', border: '1px solid var(--ws-border)', borderRadius: '6px', padding: 'var(--space-2) 10px' }}>
                          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {s.title} · {s.file_name}
                          </span>
                          <button
                            onClick={() => downloadSubmission(s)}
                            disabled={downloadingSubmissionId === s.id}
                            style={{ ...linkBtn, minHeight: '26px', padding: '0 var(--space-2)', display: 'inline-flex', alignItems: 'center', gap: 'var(--space-1)', flexShrink: 0 }}
                          >
                            <Download size={11} /> {downloadingSubmissionId === s.id ? '…' : 'Download'}
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })()}
            </article>
          </div>
        )}
      </section>
    </div>
  );
}
