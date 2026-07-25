import { useEffect, useState } from 'react';
import {
  LogOut, RefreshCcw, UserPlus, FileText, Calendar,
  Send, CheckSquare, Plus, Edit2, Trash2,
  Mail, X, Clock, Settings, GraduationCap, CalendarClock, ThumbsUp, ThumbsDown,
  UploadCloud, Download, Target, Lock, CheckCircle2
} from 'lucide-react';
import { toast } from 'sonner';
import { api, formatFileSize, MAX_PRODUCT_IMAGE_SIZE } from '../lib/api';
import { useAuth } from '../lib/auth';
import type { Enrollment, QuoteRequest, User, Event, Reservation, Product, ProgressReport, ExtensionRequest, Submission, Opportunity, OpportunityStage, OpportunityGrade, PipelineForecast } from '../types';

type Tab = 'overview' | 'enrollments' | 'students' | 'events' | 'products' | 'pipeline';

// Pipeline stage + grade display metadata (labels, order, colours).
const STAGE_ORDER: OpportunityStage[] = ['prospecting', 'qualified', 'proposal', 'negotiation', 'won', 'lost'];
const STAGE_LABELS: Record<OpportunityStage, string> = {
  prospecting: 'Prospecting', qualified: 'Qualified', proposal: 'Proposal',
  negotiation: 'Negotiation', won: 'Won', lost: 'Lost',
};
const GRADE_STYLES: Record<OpportunityGrade, { bg: string; fg: string; label: string }> = {
  bronze: { bg: '#f0e0d0', fg: '#8a5a2b', label: 'Bronze' },
  silver: { bg: '#e6e8ea', fg: '#5a6572', label: 'Silver' },
  gold: { bg: '#f7edc8', fg: '#8a6d1a', label: 'Gold' },
  platinum: { bg: '#e2ecf2', fg: '#37607a', label: 'Platinum' },
};
const ZMW = (n: number) => `${Math.round(n).toLocaleString()} ZMW`;

// Gated submission pipeline (mirrors the student side + backend stage order).
const SUBMISSION_STEPS: { key: string; label: string }[] = [
  { key: 'proposal', label: 'Proposal' },
  { key: 'report', label: 'Report' },
  { key: 'final', label: 'Final' },
];

export function AdminPage() {
  const { user, logout } = useAuth();
  const [activeTab, setActiveTab] = useState<Tab>('overview');
  
  // Overview / Quotes State
  const [metrics, setMetrics] = useState({ enrollments: 0, open_quotes: 0, students: 0, active_events: 0 });
  const [quotes, setQuotes] = useState<QuoteRequest[]>([]);
  const [selectedQuote, setSelectedQuote] = useState<QuoteRequest | null>(null);
  const [quoteNotes, setQuoteNotes] = useState('');

  // Enrollments State
  const [enrollments, setEnrollments] = useState<Enrollment[]>([]);
  const [selectedEnrollment, setSelectedEnrollment] = useState<Enrollment | null>(null);
  const [inviteUrl, setInviteUrl] = useState<string>('');

  // Students Hub State
  const [students, setStudents] = useState<User[]>([]);
  const [selectedStudent, setSelectedStudent] = useState<User | null>(null);
  const [studentDetails, setStudentDetails] = useState<{ profile: any; milestones: any[]; comments: any[]; progress_reports: ProgressReport[]; extensions: ExtensionRequest[]; submissions: Submission[] } | null>(null);
  const [newFeedbackComment, setNewFeedbackComment] = useState('');
  const [editingMilestoneId, setEditingMilestoneId] = useState<string | null>(null);
  const [milestoneFeedback, setMilestoneFeedback] = useState('');
  const [milestoneStatus, setMilestoneStatus] = useState('');

  // Progress report response state
  const [editingReportId, setEditingReportId] = useState<string | null>(null);
  const [reportFeedbackDraft, setReportFeedbackDraft] = useState('');

  // Extension response state
  const [editingExtensionId, setEditingExtensionId] = useState<string | null>(null);
  const [extensionNoteDraft, setExtensionNoteDraft] = useState('');

  // Submission review state
  const [editingSubmissionId, setEditingSubmissionId] = useState<string | null>(null);
  const [submissionNoteDraft, setSubmissionNoteDraft] = useState('');
  const [downloadingSubmissionId, setDownloadingSubmissionId] = useState<string | null>(null);

  // Events State
  const [events, setEvents] = useState<Event[]>([]);
  const [selectedEvent, setSelectedEvent] = useState<Event | null>(null);
  const [eventReservations, setEventReservations] = useState<Reservation[]>([]);
  const [eventForm, setEventForm] = useState({ id: '', title: '', description: '', date: '', location: '', capacity: 100, is_published: true, image_url: '' });
  const [showEventModal, setShowEventModal] = useState(false);
  const [broadcastForm, setBroadcastForm] = useState({ subject: '', message: '' });
  const [showBroadcastModal, setShowBroadcastModal] = useState(false);

  // Products State
  const [products, setProducts] = useState<Product[]>([]);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [productForm, setProductForm] = useState({ id: '', name: '', description: '', price: 0, stock: 0, image_url: '', specs: '', is_published: true });
  const [showProductModal, setShowProductModal] = useState(false);
  const [uploadingProductImage, setUploadingProductImage] = useState(false);

  // Pipeline (Opportunities) State
  const [opportunities, setOpportunities] = useState<Opportunity[]>([]);
  const [forecast, setForecast] = useState<PipelineForecast | null>(null);
  const [staff, setStaff] = useState<User[]>([]);
  const [showOpportunityModal, setShowOpportunityModal] = useState(false);
  const emptyOpportunity = { id: '', name: '', account_name: '', contact_name: '', contact_email: '', sector: '', stage: 'prospecting' as OpportunityStage, grade: 'bronze' as OpportunityGrade, deal_value: 0, probability: 10, owner_id: '', expected_close_at: '', notes: '' };
  const [opportunityForm, setOpportunityForm] = useState(emptyOpportunity);
  const NIL_UUID = '00000000-0000-0000-0000-000000000000';
  const staffName = (id?: string | null) => (id ? staff.find((s) => s.id === id)?.full_name ?? 'Unknown' : '');

  async function loadData() {
    try {
      const nextMetrics = await api.adminMetrics();
      setMetrics(nextMetrics);
      
      if (activeTab === 'overview') {
        const nextQuotes = await api.quotes();
        setQuotes(nextQuotes);
      } else if (activeTab === 'enrollments') {
        const nextEnrollments = await api.enrollments();
        setEnrollments(nextEnrollments);
      } else if (activeTab === 'students') {
        const nextStudents = await api.listStudents();
        setStudents(nextStudents);
      } else if (activeTab === 'events') {
        const nextEvents = await api.adminListEvents();
        setEvents(nextEvents);
      } else if (activeTab === 'products') {
        const nextProducts = await api.adminListProducts();
        setProducts(nextProducts);
      } else if (activeTab === 'pipeline') {
        const [nextOpportunities, nextForecast, nextStaff] = await Promise.all([
          api.adminListOpportunities(),
          api.adminPipelineForecast(),
          api.adminListStaff(),
        ]);
        setOpportunities(nextOpportunities);
        setForecast(nextForecast);
        setStaff(nextStaff);
      }
    } catch (err: any) {
      toast.error(err.message || 'Failed to load admin data');
    }
  }

  async function reloadPipeline() {
    try {
      const [nextOpportunities, nextForecast] = await Promise.all([
        api.adminListOpportunities(),
        api.adminPipelineForecast(),
      ]);
      setOpportunities(nextOpportunities);
      setForecast(nextForecast);
    } catch (err: any) {
      toast.error(err.message || 'Failed to refresh pipeline');
    }
  }

  useEffect(() => {
    loadData();
  }, [activeTab]);

  // --- Quote Handlers ---
  async function selectQuoteRequest(item: QuoteRequest) {
    setSelectedQuote(item);
    setQuoteNotes(item.admin_notes || '');
  }

  async function updateQuoteStatus(item: QuoteRequest, status: string) {
    try {
      const updated = await api.updateQuote(item.id, { status });
      setQuotes((rows) => rows.map((row) => row.id === item.id ? updated : row));
      if (selectedQuote?.id === item.id) {
        setSelectedQuote(updated);
      }
      toast.success(`Quote status updated to ${status}`);
    } catch (err: any) {
      toast.error(err.message || 'Failed to update quote status');
    }
  }

  async function saveQuoteNotes(item: QuoteRequest) {
    try {
      const updated = await api.updateQuote(item.id, { admin_notes: quoteNotes });
      setQuotes((rows) => rows.map((row) => row.id === item.id ? updated : row));
      setSelectedQuote(updated);
      toast.success('Notes saved successfully');
    } catch (err: any) {
      toast.error(err.message || 'Failed to save notes');
    }
  }

  async function convertQuote(item: QuoteRequest) {
    if (item.status === 'converted') {
      toast.info('This lead has already been converted.');
      return;
    }
    if (!confirm(`Convert "${item.name}" into a pipeline opportunity?`)) return;
    try {
      await api.convertQuoteToOpportunity(item.id);
      toast.success('Lead converted — opening the pipeline');
      setSelectedQuote(null);
      setActiveTab('pipeline');
    } catch (err: any) {
      toast.error(err.message || 'Failed to convert lead');
    }
  }

  // --- Enrollment Handlers ---
  async function updateEnrollmentStatus(item: Enrollment, status: string) {
    try {
      const updated = await api.updateEnrollment(item.id, { status });
      setEnrollments((rows) => rows.map((row) => row.id === item.id ? updated : row));
      toast.success(`Enrollment status updated to ${status}`);
    } catch (err: any) {
      toast.error(err.message || 'Failed to update status');
    }
  }

  async function updateEnrollmentTier(item: Enrollment, tier: string) {
    try {
      const updated = await api.updateEnrollment(item.id, { tier });
      setEnrollments((rows) => rows.map((row) => row.id === item.id ? updated : row));
      toast.success(`Enrollment tier updated to ${tier}`);
    } catch (err: any) {
      toast.error(err.message || 'Failed to update tier');
    }
  }

  async function generateInviteLink(item: Enrollment) {
    try {
      const res = await api.generateInvite(item.id);
      setInviteUrl(res.claim_url);
      setSelectedEnrollment(item);
      toast.success('Secure onboarding invitation generated!');
    } catch (err: any) {
      toast.error(err.message || 'Failed to generate invitation');
    }
  }

  // --- Student Detail Handlers ---
  async function viewStudentDetails(student: User) {
    setSelectedStudent(student);
    setStudentDetails(null);
    try {
      const details = await api.getStudent(student.id);
      setStudentDetails({
        ...details,
        progress_reports: details.progress_reports || [],
        extensions: details.extensions || [],
        submissions: details.submissions || []
      });
    } catch (err: any) {
      toast.error(err.message || 'Failed to load student workspace details');
    }
  }

  async function postStudentComment(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedStudent || !newFeedbackComment.trim()) return;
    try {
      const newComment = await api.adminPostComment(selectedStudent.id, newFeedbackComment);
      setStudentDetails((prev: any) => prev ? {
        ...prev,
        comments: [...prev.comments, newComment]
      } : null);
      setNewFeedbackComment('');
      toast.success('Comment posted successfully');
    } catch (err: any) {
      toast.error(err.message || 'Failed to post comment');
    }
  }

  async function triggerMilestoneEdit(m: any) {
    setEditingMilestoneId(m.id);
    setMilestoneStatus(m.status);
    setMilestoneFeedback(m.feedback || '');
  }

  async function saveMilestoneUpdate(mId: string) {
    if (!selectedStudent) return;
    try {
      const updated = await api.adminUpdateMilestone(selectedStudent.id, mId, {
        status: milestoneStatus,
        feedback: milestoneFeedback
      });
      setStudentDetails((prev: any) => {
        if (!prev) return null;
        return {
          ...prev,
          milestones: prev.milestones.map((m: any) => m.id === mId ? updated : m)
        };
      });
      setEditingMilestoneId(null);
      toast.success('Milestone updated successfully');
      // Refresh user progress on main list
      const nextStudents = await api.listStudents();
      setStudents(nextStudents);
    } catch (err: any) {
      toast.error(err.message || 'Failed to save milestone update');
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
        status: 'reviewed'
      });
      setStudentDetails((prev) => prev ? {
        ...prev,
        progress_reports: prev.progress_reports.map((r) => r.id === reportId ? updated : r)
      } : null);
      setEditingReportId(null);
      toast.success('Progress report marked reviewed');
    } catch (err: any) {
      toast.error(err.message || 'Failed to update progress report');
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
        decision_note: extensionNoteDraft
      });
      setStudentDetails((prev) => prev ? {
        ...prev,
        extensions: prev.extensions.map((e) => e.id === extensionId ? updated : e)
      } : null);
      setEditingExtensionId(null);
      toast.success(`Extension request ${status}`);
    } catch (err: any) {
      toast.error(err.message || 'Failed to update extension request');
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
        review_note: submissionNoteDraft
      });
      setStudentDetails((prev) => prev ? {
        ...prev,
        submissions: prev.submissions.map((s) => s.id === submissionId ? updated : s)
      } : null);
      setEditingSubmissionId(null);
      toast.success(`Submission ${status === 'accepted' ? 'accepted' : 'sent back for revision'}`);
    } catch (err: any) {
      toast.error(err.message || 'Failed to update submission');
    }
  }

  async function downloadAdminSubmission(s: Submission) {
    setDownloadingSubmissionId(s.id);
    try {
      await api.downloadSubmission(s.id, 'admin', s.file_name);
    } catch (err: any) {
      toast.error(err.message || 'Failed to download file');
    } finally {
      setDownloadingSubmissionId(null);
    }
  }

  // --- Event Handlers ---
  async function handleEventSelect(event: Event) {
    setSelectedEvent(event);
    setEventReservations([]);
    try {
      const res = await api.adminListReservations(event.id);
      setEventReservations(res);
    } catch (err: any) {
      console.error(err);
    }
  }

  function openCreateEventModal() {
    setEventForm({ id: '', title: '', description: '', date: '', location: '', capacity: 100, is_published: true, image_url: '' });
    setShowEventModal(true);
  }

  function openEditEventModal(event: Event) {
    setEventForm({
      id: event.id,
      title: event.title,
      description: event.description,
      date: event.date ? event.date.substring(0, 16) : '',
      location: event.location,
      capacity: event.capacity,
      is_published: event.is_published,
      image_url: event.image_url || ''
    });
    setShowEventModal(true);
  }

  async function saveEvent(e: React.FormEvent) {
    e.preventDefault();
    try {
      if (eventForm.id) {
        await api.adminUpdateEvent(eventForm.id, eventForm);
        toast.success('Event updated successfully');
      } else {
        await api.adminCreateEvent(eventForm);
        toast.success('Event created successfully');
      }
      setShowEventModal(false);
      setSelectedEvent(null);
      loadData();
    } catch (err: any) {
      toast.error(err.message || 'Failed to save event');
    }
  }

  async function approveReservation(rid: string) {
    try {
      const updated = await api.approveReservation(rid);
      setEventReservations((prev) => prev.map((r) => r.id === rid ? updated : r));
      toast.success('Seat confirmed for attendee!');
    } catch (err: any) {
      toast.error(err.message || 'Failed to approve reservation');
    }
  }

  async function deleteEvent(id: string) {
    if (!confirm('Are you sure you want to delete this event? All reservation records will be lost.')) return;
    try {
      await api.adminDeleteEvent(id);
      toast.success('Event deleted');
      setSelectedEvent(null);
      loadData();
    } catch (err: any) {
      toast.error(err.message || 'Failed to delete event');
    }
  }

  async function sendBroadcast(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedEvent) return;
    try {
      const res = await api.adminBroadcast(selectedEvent.id, broadcastForm.subject, broadcastForm.message);
      if (res.status === 'sent') {
        toast.success(`Broadcast emailed to ${res.recipients} confirmed attendee(s).`);
      } else {
        toast.warning(res.message || 'Broadcast stored, but no email was sent.');
      }
      setShowBroadcastModal(false);
      setBroadcastForm({ subject: '', message: '' });
    } catch (err: any) {
      toast.error(err.message || 'Failed to send broadcast');
    }
  }

  // --- Product Handlers ---
  function openCreateProductModal() {
    setProductForm({ id: '', name: '', description: '', price: 0, stock: 0, image_url: '', specs: '', is_published: true });
    setShowProductModal(true);
  }

  function openEditProductModal(p: Product) {
    setProductForm({ id: p.id, name: p.name, description: p.description, price: p.price, stock: p.stock, image_url: p.image_url || '', specs: p.specs || '', is_published: p.is_published });
    setShowProductModal(true);
  }

  async function handleProductImageUpload(file: File | undefined) {
    if (!file) return;
    if (file.size > MAX_PRODUCT_IMAGE_SIZE) {
      toast.error('Image is too large. Maximum size is 5 MB.');
      return;
    }
    setUploadingProductImage(true);
    try {
      const url = await api.uploadProductImage(file);
      setProductForm((prev) => ({ ...prev, image_url: url }));
      toast.success('Image uploaded');
    } catch (err: any) {
      toast.error(err.message || 'Failed to upload image');
    } finally {
      setUploadingProductImage(false);
    }
  }

  async function saveProduct(e: React.FormEvent) {
    e.preventDefault();
    try {
      if (productForm.id) {
        await api.adminUpdateProduct(productForm.id, productForm);
        toast.success('Product updated');
      } else {
        await api.adminCreateProduct(productForm);
        toast.success('Product created');
      }
      setShowProductModal(false);
      setSelectedProduct(null);
      loadData();
    } catch (err: any) {
      toast.error(err.message || 'Failed to save product');
    }
  }

  async function deleteProduct(id: string) {
    if (!confirm('Delete this product? This cannot be undone.')) return;
    try {
      await api.adminDeleteProduct(id);
      toast.success('Product deleted');
      setSelectedProduct(null);
      loadData();
    } catch (err: any) {
      toast.error(err.message || 'Failed to delete product');
    }
  }

  // --- Opportunity (Pipeline) Handlers ---
  function openCreateOpportunityModal() {
    setOpportunityForm(emptyOpportunity);
    setShowOpportunityModal(true);
  }

  function openEditOpportunityModal(o: Opportunity) {
    setOpportunityForm({
      id: o.id, name: o.name, account_name: o.account_name, contact_name: o.contact_name,
      contact_email: o.contact_email, sector: o.sector, stage: o.stage, grade: o.grade,
      deal_value: o.deal_value, probability: o.probability, owner_id: o.owner_id ?? '',
      expected_close_at: o.expected_close_at ? o.expected_close_at.slice(0, 10) : '', notes: o.notes,
    });
    setShowOpportunityModal(true);
  }

  async function saveOpportunity(e: React.FormEvent) {
    e.preventDefault();
    const payload: Partial<Opportunity> = {
      name: opportunityForm.name,
      account_name: opportunityForm.account_name,
      contact_name: opportunityForm.contact_name,
      contact_email: opportunityForm.contact_email,
      sector: opportunityForm.sector,
      stage: opportunityForm.stage,
      grade: opportunityForm.grade,
      deal_value: Number(opportunityForm.deal_value) || 0,
      probability: Number(opportunityForm.probability),
      owner_id: opportunityForm.owner_id || NIL_UUID, // nil UUID = unassign server-side
      expected_close_at: opportunityForm.expected_close_at ? new Date(opportunityForm.expected_close_at).toISOString() : null,
      notes: opportunityForm.notes,
    };
    try {
      if (opportunityForm.id) {
        await api.adminUpdateOpportunity(opportunityForm.id, payload);
        toast.success('Opportunity updated');
      } else {
        await api.adminCreateOpportunity(payload);
        toast.success('Opportunity created');
      }
      setShowOpportunityModal(false);
      reloadPipeline();
    } catch (err: any) {
      toast.error(err.message || 'Failed to save opportunity');
    }
  }

  // Fast pipeline movement: change stage inline (probability re-seeds server-side).
  async function moveOpportunityStage(o: Opportunity, stage: OpportunityStage) {
    if (o.stage === stage) return;
    try {
      await api.adminUpdateOpportunity(o.id, { stage });
      reloadPipeline();
    } catch (err: any) {
      toast.error(err.message || 'Failed to move opportunity');
    }
  }

  async function deleteOpportunity(id: string) {
    if (!confirm('Delete this opportunity? This cannot be undone.')) return;
    try {
      await api.adminDeleteOpportunity(id);
      toast.success('Opportunity deleted');
      setShowOpportunityModal(false);
      reloadPipeline();
    } catch (err: any) {
      toast.error(err.message || 'Failed to delete opportunity');
    }
  }

  return (
    <main className="workspace">
      <aside className="rail">
        <div className="rail-head">
          <strong className="rail-title">Arcus Admin Portal</strong>
          <span className="rail-user">{user?.full_name}</span>
        </div>

        <nav className="rail-nav">
          {([
            ['overview', 'Overview', Settings],
            ['pipeline', 'Sales Pipeline', Target],
            ['enrollments', 'Enrollments', UserPlus],
            ['students', 'Students Portal', GraduationCap],
            ['events', 'Events Manager', Calendar],
            ['products', 'Products', CheckSquare],
          ] as [Tab, string, typeof Settings][]).map(([tab, label, Icon]) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={activeTab === tab ? 'active' : ''}
            >
              <Icon size={16} /> {label}
            </button>
          ))}
        </nav>

        <div className="rail-actions">
          <button onClick={() => loadData()}><RefreshCcw size={17} /> Refresh Data</button>
          <button onClick={logout}><LogOut size={17} /> Logout</button>
        </div>
      </aside>

      <section className="work-main">
        <div className="workspace-head">
          <div>
            <p className="eyebrow" style={{ textTransform: 'uppercase' }}>Management Area</p>
            <h1>
              {activeTab === 'overview' && 'Arcus Investments Dashboard'}
              {activeTab === 'pipeline' && 'Sales Pipeline & Forecast'}
              {activeTab === 'enrollments' && 'Innovation Hub Intake'}
              {activeTab === 'students' && 'Student Capstone Milestones'}
              {activeTab === 'events' && 'Public Programs & Events'}
              {activeTab === 'products' && 'Product Inventory Manager'}
            </h1>
          </div>
          {activeTab === 'pipeline' && (
            <button onClick={openCreateOpportunityModal} className="primary" style={{ minHeight: '40px' }}>
              <Plus size={16} /> New Opportunity
            </button>
          )}
        </div>

        {/* Metrics Row — pipeline shows forecast KPIs, everything else the hub metrics */}
        {activeTab === 'pipeline' ? (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: '12px', marginBottom: '26px' }}>
            <article className="panel"><span style={{ display: 'block', fontSize: '26px', fontWeight: 900 }}>{ZMW(forecast?.open_value ?? 0)}</span><p style={{ margin: '4px 0 0' }}>Open Pipeline</p></article>
            <article className="panel"><span style={{ display: 'block', fontSize: '26px', fontWeight: 900, color: '#5f7c29' }}>{ZMW(forecast?.weighted_forecast ?? 0)}</span><p style={{ margin: '4px 0 0' }}>Weighted Forecast</p></article>
            <article className="panel"><span style={{ display: 'block', fontSize: '26px', fontWeight: 900 }}>{ZMW(forecast?.won_value ?? 0)}</span><p style={{ margin: '4px 0 0' }}>Won Value</p></article>
            <article className="panel"><span style={{ display: 'block', fontSize: '26px', fontWeight: 900 }}>{Math.round(forecast?.win_rate ?? 0)}%</span><p style={{ margin: '4px 0 0' }}>Win Rate ({forecast?.won_count ?? 0}W / {forecast?.lost_count ?? 0}L)</p></article>
          </div>
        ) : (
          <div className="metric-row">
            <article><span>{metrics.enrollments}</span><p>Total Enrollments</p></article>
            <article><span>{metrics.students}</span><p>Active Students</p></article>
            <article><span>{metrics.active_events}</span><p>Published Events</p></article>
          </div>
        )}

        {/* Overview Tab */}
        {activeTab === 'overview' && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px', alignItems: 'start' }}>
            <section className="data-section" style={{ marginTop: 0 }}>
              <h2>Quote & Contact Requests</h2>
              <div className="table" style={{ display: 'grid', gap: '12px' }}>
                {quotes.length === 0 ? (
                  <p className="empty">No contact queries yet.</p>
                ) : (
                  quotes.map((item) => (
                    <article 
                      key={item.id} 
                      onClick={() => selectQuoteRequest(item)}
                      style={{ 
                        padding: '16px', 
                        background: selectedQuote?.id === item.id ? '#f7f8f3' : '#fff', 
                        border: '1px solid #dfe1da', 
                        borderRadius: '8px', 
                        cursor: 'pointer',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '8px'
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                        <div>
                          <strong style={{ fontSize: '15px' }}>{item.name}</strong>
                          <div style={{ fontSize: '12px', color: '#5a625d', marginTop: '2px' }}>{item.company || 'Private Inquiry'}</div>
                        </div>
                        <span style={{ 
                          fontSize: '10px', 
                          padding: '3px 8px', 
                          borderRadius: '10px', 
                          fontWeight: 'bold',
                          background: 
                            item.status === 'new' ? '#fff3e0' : 
                            item.status === 'contacted' ? '#eef0ea' : 
                            item.status === 'proposal' ? '#e3f2fd' : 
                            item.status === 'closed_won' ? '#e8f2dc' : '#ffe2e2',
                          color: 
                            item.status === 'new' ? '#c98745' : 
                            item.status === 'contacted' ? '#5a625d' : 
                            item.status === 'proposal' ? '#1e88e5' : 
                            item.status === 'closed_won' ? '#35520f' : '#a00'
                        }}>
                          {item.status.toUpperCase()}
                        </span>
                      </div>
                      <div style={{ fontSize: '12px', color: '#5a625d' }}>
                        Service: <strong style={{ color: '#111512' }}>{item.service}</strong>
                      </div>
                      <p style={{ 
                        margin: 0, 
                        fontSize: '12px', 
                        color: '#5a625d',
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis'
                      }}>
                        {item.message}
                      </p>
                    </article>
                  ))
                )}
              </div>
            </section>

            <section className="data-section" style={{ marginTop: 0 }}>
              <h2>Lead Details & CRM Tracking</h2>
              {!selectedQuote ? (
                <div style={{ background: '#fff', border: '1px solid #d6d8d0', borderRadius: '8px', padding: '40px', textAlign: 'center', color: '#5a625d' }}>
                  Select a contact request to view details, update customer status, and log contact notes.
                </div>
              ) : (
                <div style={{ display: 'grid', gap: '20px' }}>
                  <article className="panel" style={{ padding: '24px', background: '#fff', borderRadius: '8px', border: '1px solid #dfe1da' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', borderBottom: '1px solid #dfe1da', paddingBottom: '16px', marginBottom: '16px' }}>
                      <div>
                        <h3 style={{ margin: 0, fontSize: '20px' }}>{selectedQuote.name}</h3>
                        <p style={{ margin: '4px 0 0', color: '#5a625d', fontSize: '13px' }}>
                          Company: <strong>{selectedQuote.company || 'None'}</strong>
                        </p>
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', alignItems: 'flex-end' }}>
                        <label style={{ fontSize: '11px', color: '#5a625d', fontWeight: 'bold' }}>LEAD STATUS</label>
                        <select 
                          value={selectedQuote.status} 
                          onChange={(e) => updateQuoteStatus(selectedQuote, e.target.value)}
                          style={{ color: '#111512', background: '#f7f8f3', border: '1px solid #d8dbd1', padding: '4px 8px', fontSize: '12px', borderRadius: '4px' }}
                        >
                          <option value="new">New / Untouched</option>
                          <option value="contacted">Contacted</option>
                          <option value="proposal">Proposal Sent</option>
                          <option value="closed_won">Closed / Won</option>
                          <option value="closed_lost">Closed / Lost</option>
                        </select>
                      </div>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>
                      <div>
                        <span style={{ fontSize: '11px', color: '#5a625d', display: 'block', fontWeight: 'bold' }}>EMAIL ADDRESS</span>
                        <a href={`mailto:${selectedQuote.email}`} style={{ color: 'var(--copper)', fontSize: '13px', textDecoration: 'underline' }}>{selectedQuote.email}</a>
                      </div>
                      <div>
                        <span style={{ fontSize: '11px', color: '#5a625d', display: 'block', fontWeight: 'bold' }}>PHONE NUMBER</span>
                        <span style={{ fontSize: '13px', color: '#111512' }}>{selectedQuote.phone || 'Not provided'}</span>
                      </div>
                      <div>
                        <span style={{ fontSize: '11px', color: '#5a625d', display: 'block', fontWeight: 'bold' }}>REQUESTED SERVICE</span>
                        <span style={{ fontSize: '13px', color: '#111512', fontWeight: '600' }}>{selectedQuote.service}</span>
                      </div>
                      <div>
                        <span style={{ fontSize: '11px', color: '#5a625d', display: 'block', fontWeight: 'bold' }}>ESTIMATED BUDGET</span>
                        <span style={{ fontSize: '13px', color: '#111512', fontWeight: '600' }}>{selectedQuote.budget_range || 'N/A'}</span>
                      </div>
                    </div>

                    <div style={{ background: '#f7f8f3', border: '1px solid #d8dbd1', padding: '16px', borderRadius: '6px', marginBottom: '20px' }}>
                      <span style={{ fontSize: '11px', color: '#5a625d', display: 'block', fontWeight: 'bold', marginBottom: '6px' }}>CUSTOMER MESSAGE</span>
                      <p style={{ margin: 0, fontSize: '13px', color: '#111512', whiteSpace: 'pre-line', lineHeight: '1.5' }}>{selectedQuote.message}</p>
                    </div>

                    <div style={{ borderTop: '1px solid #dfe1da', paddingTop: '16px' }}>
                      <span style={{ fontSize: '11px', color: '#5a625d', display: 'block', fontWeight: 'bold', marginBottom: '8px' }}>ADMIN CRM NOTES & NEXT ACTIONS</span>
                      <textarea 
                        value={quoteNotes} 
                        onChange={(e) => setQuoteNotes(e.target.value)} 
                        placeholder="Log contact attempts, meeting summaries, pricing proposals, or instructions on how to reach back..." 
                        style={{ color: '#111512', background: '#f7f8f3', border: '1px solid #d8dbd1', minHeight: '100px', fontSize: '13px', width: '100%', padding: '10px', borderRadius: '4px', marginBottom: '12px' }}
                      />
                      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                        <button
                          onClick={() => saveQuoteNotes(selectedQuote)}
                          className="primary"
                          style={{ minHeight: '36px', fontSize: '12px', padding: '0 16px' }}
                        >
                          Save CRM Notes
                        </button>
                        <button
                          onClick={() => convertQuote(selectedQuote)}
                          disabled={selectedQuote.status === 'converted'}
                          style={{ minHeight: '36px', fontSize: '12px', padding: '0 16px', background: selectedQuote.status === 'converted' ? '#eef0ea' : '#111512', color: selectedQuote.status === 'converted' ? '#8a908a' : '#fff', border: 0, borderRadius: '8px', cursor: selectedQuote.status === 'converted' ? 'default' : 'pointer', display: 'inline-flex', alignItems: 'center', gap: '6px' }}
                        >
                          <Target size={14} /> {selectedQuote.status === 'converted' ? 'Converted' : 'Convert to opportunity'}
                        </button>
                      </div>
                    </div>
                  </article>
                </div>
              )}
            </section>
          </div>
        )}

        {/* Enrollments Tab */}
        {activeTab === 'enrollments' && (
          <div style={{ display: 'grid', gap: '24px' }}>
            <section className="data-section">
              <h2>Recent Enrollment Applications</h2>
              <div className="table">
                {enrollments.length === 0 ? (
                  <p className="empty">No applications filed yet.</p>
                ) : (
                  enrollments.map((item) => (
                    <article key={item.id} className="row" style={{ gridTemplateColumns: '1.2fr auto auto auto auto', gap: '16px' }}>
                      <div>
                        <strong style={{ fontSize: '16px' }}>{item.full_name}</strong>
                        <span style={{ fontSize: '13px', color: '#5a625d', marginLeft: '8px' }}>{item.email} · {item.phone}</span>
                        <p style={{ fontSize: '13px', marginBlock: '8px', color: '#5a625d' }}><strong>Project Direction:</strong> {item.project_idea || item.interests}</p>
                        {item.orientation_at && (
                          <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '11px', color: '#c98745' }}>
                            <Clock size={12} /> Orientation set for: {new Date(item.orientation_at).toLocaleString()}
                          </div>
                        )}
                      </div>

                      {/* Tier dropdown selection */}
                      <div>
                        <select 
                          value={item.tier} 
                          onChange={(e) => updateEnrollmentTier(item, e.target.value)}
                          style={{ color: '#111512', background: '#fff', border: '1px solid #d8dbd1', padding: '6px 10px', fontSize: '12px' }}
                        >
                          <option value="Explorer">Explorer</option>
                          <option value="Builder">Builder</option>
                          <option value="Professional">Professional</option>
                        </select>
                      </div>

                      {/* Status select dropdown */}
                      <div>
                        <select 
                          value={item.status} 
                          onChange={(e) => updateEnrollmentStatus(item, e.target.value)}
                          style={{ color: '#111512', background: '#fff', border: '1px solid #d8dbd1', padding: '6px 10px', fontSize: '12px' }}
                        >
                          <option value="submitted">Submitted</option>
                          <option value="pending_orientation">Pending Orientation</option>
                          <option value="orientation_complete">Orientation Complete</option>
                          <option value="accepted">Accepted</option>
                          <option value="rejected">Rejected</option>
                        </select>
                      </div>

                      <div>
                        <button 
                          onClick={() => generateInviteLink(item)} 
                          className="primary" 
                          style={{ minHeight: '34px', fontSize: '12px', padding: '0 12px', background: 'var(--accent)', color: '#11170e' }}
                        >
                          <UserPlus size={14} /> Invite Link
                        </button>
                      </div>
                    </article>
                  ))
                )}
              </div>
            </section>

            {/* Generated Invite Modal / Link overlay */}
            {selectedEnrollment && inviteUrl && (
              <div style={{ background: '#f7f8f3', border: '1px solid var(--copper)', borderRadius: '8px', padding: '20px', marginTop: '16px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <strong style={{ color: 'var(--copper)' }}>Onboarding Registration Link for {selectedEnrollment.full_name}</strong>
                  <button onClick={() => setSelectedEnrollment(null)} style={{ background: 'transparent', border: 0, padding: 4, cursor: 'pointer' }}><X size={18} /></button>
                </div>
                <p style={{ fontSize: '13px', margin: '8px 0 12px' }}>Copy this secure URL and share it with the applicant. They will be prompted to choose a password and write down their capstone brief to claim workspace access.</p>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <input readOnly value={inviteUrl} style={{ color: '#111512', background: '#fff', border: '1px solid #d8dbd1' }} />
                  <button 
                    onClick={() => {
                      navigator.clipboard.writeText(inviteUrl);
                      toast.success('Onboarding invite URL copied to clipboard');
                    }}
                    className="primary"
                    style={{ minHeight: '44px', whiteSpace: 'nowrap' }}
                  >
                    Copy Link
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Students Tab */}
        {activeTab === 'students' && (
          <div style={{ display: 'grid', gridTemplateColumns: '0.8fr 1.2fr', gap: '24px', alignItems: 'start' }}>
            <section className="data-section" style={{ marginTop: 0 }}>
              <h2>Enrolled Students</h2>
              <div className="table">
                {students.length === 0 ? (
                  <p className="empty">No student records found.</p>
                ) : (
                  students.map((student) => (
                    <article 
                      key={student.id} 
                      className={`row ${selectedStudent?.id === student.id ? 'active' : ''}`}
                      onClick={() => viewStudentDetails(student)}
                      style={{ 
                        gridTemplateColumns: '1fr auto', 
                        cursor: 'pointer', 
                        borderLeft: selectedStudent?.id === student.id ? '4px solid var(--accent)' : '1px solid #dfe1da',
                        background: selectedStudent?.id === student.id ? '#f7f8f3' : '#fff'
                      }}
                    >
                      <div>
                        <strong>{student.full_name}</strong>
                        <div style={{ fontSize: '12px', color: '#5a625d' }}>{student.email}</div>
                        <div style={{ fontSize: '11px', color: '#c98745', marginTop: '4px' }}>Tier: {student.student_profile?.tier || 'Explorer'}</div>
                      </div>
                      <span className="status">{student.student_profile?.progress_pct ?? 0}%</span>
                    </article>
                  ))
                )}
              </div>
            </section>

            <section className="data-section" style={{ marginTop: 0 }}>
              <h2>Capstone Tracking details</h2>
              {!selectedStudent ? (
                <div style={{ background: '#fff', border: '1px solid #d6d8d0', borderRadius: '8px', padding: '40px', textAlign: 'center', color: '#5a625d' }}>
                  Select a student from the directory to review and manage their Capstone brief, Milestones, and leave mentorship feedback.
                </div>
              ) : !studentDetails ? (
                <div style={{ color: '#5a625d', textAlign: 'center', padding: '40px' }}>Loading tracking data...</div>
              ) : (
                <div style={{ display: 'grid', gap: '24px' }}>
                  {/* Brief Brief */}
                  <article className="panel" style={{ padding: '20px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: '10px', alignItems: 'baseline' }}>
                      <h3 style={{ margin: 0, fontSize: '18px' }}>Capstone Scope</h3>
                      <span className="status">{studentDetails.profile?.tier}</span>
                    </div>
                    <strong style={{ display: 'block', marginBlock: '12px 6px', color: '#111512' }}>{studentDetails.profile?.capstone_title || 'Unnamed Capstone'}</strong>
                    <p style={{ fontSize: '13px', lineHeight: '1.6', margin: 0, whiteSpace: 'pre-line' }}>{studentDetails.profile?.capstone_summary || 'No project summary specified by student yet.'}</p>
                  </article>

                  {/* Milestones checklist */}
                  <article className="panel" style={{ padding: '20px' }}>
                    <h3 style={{ margin: 0, marginBottom: '14px', fontSize: '18px' }}>Milestone Checklist</h3>
                    
                    <div style={{ display: 'grid', gap: '12px' }}>
                      {studentDetails.milestones.map((m: any) => (
                        <div key={m.id} style={{ padding: '12px', background: '#f7f8f3', border: '1px solid #d8dbd1', borderRadius: '6px' }}>
                          {editingMilestoneId === m.id ? (
                            <div style={{ display: 'grid', gap: '10px' }}>
                              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <strong>{m.title}</strong>
                                <select 
                                  value={milestoneStatus} 
                                  onChange={(e) => setMilestoneStatus(e.target.value)}
                                  style={{ width: 'auto', background: '#fff', color: '#111512', padding: '4px 8px', fontSize: '12px' }}
                                >
                                  <option value="pending">Pending</option>
                                  <option value="in_progress">In Progress</option>
                                  <option value="pending_review">Pending Review</option>
                                  <option value="completed">Completed (sign-off)</option>
                                </select>
                              </div>
                              <input 
                                placeholder="Add review feedback..." 
                                value={milestoneFeedback} 
                                onChange={(e) => setMilestoneFeedback(e.target.value)} 
                                style={{ color: '#111512', background: '#fff', border: '1px solid #d8dbd1', padding: '8px' }}
                              />
                              <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                                <button onClick={() => setEditingMilestoneId(null)} style={{ background: '#eef0ea', color: '#111512', minHeight: '32px', fontSize: '12px', padding: '0 12px', borderRadius: '4px', border: 0 }}>Cancel</button>
                                <button onClick={() => saveMilestoneUpdate(m.id)} className="primary" style={{ minHeight: '32px', fontSize: '12px', padding: '0 12px', borderRadius: '4px', border: 0 }}>Save</button>
                              </div>
                            </div>
                          ) : (
                            <div>
                              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                                <strong style={{ color: '#111512' }}>{m.title}</strong>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                  <span style={{
                                    fontSize: '10px', 
                                    padding: '2px 6px', 
                                    borderRadius: '4px', 
                                    background: m.status === 'completed' ? '#e8f2dc' : '#f0f0f0',
                                    color: m.status === 'completed' ? '#35520f' : '#555',
                                    fontWeight: 'bold'
                                  }}>{m.status.toUpperCase()}</span>
                                  <button onClick={() => triggerMilestoneEdit(m)} style={{ background: 'transparent', border: 0, padding: 2, cursor: 'pointer', color: '#5a625d' }}><Edit2 size={12} /></button>
                                </div>
                              </div>
                              <p style={{ fontSize: '12px', color: '#5a625d', margin: '4px 0 0' }}>{m.description}</p>
                              {m.feedback && (
                                <div style={{ fontSize: '11px', color: '#c98745', background: '#fff', borderLeft: '2px solid var(--copper)', padding: '4px 8px', marginTop: '6px', borderRadius: '0 4px 4px 0' }}>
                                  <strong>Feedback:</strong> {m.feedback}
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </article>

                  {/* Portal Comment thread */}
                  <article className="panel" style={{ padding: '20px' }}>
                    <h3 style={{ margin: 0, marginBottom: '14px', fontSize: '18px' }}>Discussion thread</h3>
                    
                    <div style={{ display: 'grid', gap: '8px', maxHeight: '200px', overflowY: 'auto', marginBottom: '14px' }}>
                      {studentDetails.comments.map((c: any) => (
                        <div key={c.id} style={{ padding: '8px 10px', background: '#f7f8f3', borderRadius: '6px', fontSize: '12px', border: '1px solid #d8dbd1' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', gap: '8px', color: '#5a625d', marginBottom: '4px' }}>
                            <span><strong>{c.author_name}</strong> ({c.author_role})</span>
                            <span>{new Date(c.created_at).toLocaleDateString()}</span>
                          </div>
                          <p style={{ margin: 0, color: '#111512', whiteSpace: 'pre-line' }}>{c.message}</p>
                        </div>
                      ))}
                    </div>

                    <form onSubmit={postStudentComment} style={{ display: 'flex', gap: '8px' }}>
                      <input 
                        required 
                        placeholder="Leave feedback or ask for updates..." 
                        value={newFeedbackComment} 
                        onChange={(e) => setNewFeedbackComment(e.target.value)} 
                        style={{ color: '#111512', background: '#f7f8f3', border: '1px solid #d8dbd1' }}
                      />
                      <button type="submit" className="primary" style={{ width: '44px', minHeight: '44px', padding: 0 }}>
                        <Send size={16} />
                      </button>
                    </form>
                  </article>

                  {/* Progress Reports */}
                  <article className="panel" style={{ padding: '20px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '14px' }}>
                      <FileText size={18} style={{ color: 'var(--accent)' }} />
                      <h3 style={{ margin: 0, fontSize: '18px' }}>Progress Reports</h3>
                    </div>
                    <div style={{ display: 'grid', gap: '12px' }}>
                      {studentDetails.progress_reports.length === 0 ? (
                        <p style={{ fontSize: '12px', color: '#5a625d', textAlign: 'center', padding: '12px' }}>No progress reports submitted yet.</p>
                      ) : (
                        studentDetails.progress_reports.map((r) => (
                          <div key={r.id} style={{ padding: '12px', background: '#f7f8f3', border: '1px solid #d8dbd1', borderRadius: '6px' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '6px' }}>
                              <strong style={{ color: '#111512', fontSize: '13px' }}>
                                {new Date(r.period_start).toLocaleDateString()} &ndash; {new Date(r.period_end).toLocaleDateString()}
                              </strong>
                              <span style={{
                                fontSize: '10px', padding: '2px 6px', borderRadius: '4px', fontWeight: 'bold',
                                background: r.status === 'reviewed' ? '#e8f2dc' : '#fff3e0',
                                color: r.status === 'reviewed' ? '#35520f' : '#c98745'
                              }}>{r.status.toUpperCase()}</span>
                            </div>
                            <ul style={{ margin: '0 0 8px', paddingLeft: '16px', fontSize: '12px', color: '#2d3330' }}>
                              {r.accomplishments.split('\n').filter(Boolean).map((line, i) => (
                                <li key={i}>{line}</li>
                              ))}
                            </ul>
                            {r.challenges && (
                              <p style={{ fontSize: '11px', color: '#5a625d', margin: '0 0 8px', whiteSpace: 'pre-line' }}><strong>Challenges:</strong> {r.challenges}</p>
                            )}
                            {editingReportId === r.id ? (
                              <div style={{ display: 'grid', gap: '8px' }}>
                                <textarea
                                  placeholder="Add feedback for the student..."
                                  value={reportFeedbackDraft}
                                  onChange={(e) => setReportFeedbackDraft(e.target.value)}
                                  style={{ color: '#111512', background: '#fff', border: '1px solid #d8dbd1', minHeight: '60px', fontSize: '12px' }}
                                />
                                <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                                  <button onClick={() => setEditingReportId(null)} style={{ background: '#eef0ea', color: '#111512', minHeight: '32px', fontSize: '12px', padding: '0 12px', borderRadius: '4px', border: 0 }}>Cancel</button>
                                  <button onClick={() => markReportReviewed(r.id)} className="primary" style={{ minHeight: '32px', fontSize: '12px', padding: '0 12px', borderRadius: '4px', border: 0 }}>Mark reviewed</button>
                                </div>
                              </div>
                            ) : (
                              <>
                                {r.supervisor_feedback && (
                                  <div style={{ fontSize: '11px', color: '#c98745', background: '#fff', borderLeft: '2px solid var(--copper)', padding: '4px 8px', marginBottom: '8px', borderRadius: '0 4px 4px 0' }}>
                                    <strong>Feedback:</strong> {r.supervisor_feedback}
                                  </div>
                                )}
                                <button onClick={() => triggerReportFeedbackEdit(r)} style={{ background: '#eef0ea', color: '#111512', minHeight: '28px', fontSize: '11px', padding: '0 10px', borderRadius: '4px', border: 0, cursor: 'pointer' }}>
                                  <Edit2 size={11} /> {r.status === 'reviewed' ? 'Edit feedback' : 'Respond'}
                                </button>
                              </>
                            )}
                          </div>
                        ))
                      )}
                    </div>
                  </article>

                  {/* Extension Requests */}
                  <article className="panel" style={{ padding: '20px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '14px' }}>
                      <CalendarClock size={18} style={{ color: 'var(--accent)' }} />
                      <h3 style={{ margin: 0, fontSize: '18px' }}>Extension Requests</h3>
                    </div>
                    <div style={{ display: 'grid', gap: '12px' }}>
                      {studentDetails.extensions.length === 0 ? (
                        <p style={{ fontSize: '12px', color: '#5a625d', textAlign: 'center', padding: '12px' }}>No extension requests submitted yet.</p>
                      ) : (
                        studentDetails.extensions.map((ext) => (
                          <div key={ext.id} style={{ padding: '12px', background: '#f7f8f3', border: '1px solid #d8dbd1', borderRadius: '6px' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '6px' }}>
                              <strong style={{ color: '#111512', fontSize: '13px', textTransform: 'capitalize' }}>{ext.extension_type.replace(/_/g, ' ')}</strong>
                              <span style={{
                                fontSize: '10px', padding: '2px 6px', borderRadius: '4px', fontWeight: 'bold',
                                background: ext.status === 'approved' ? '#e8f2dc' : ext.status === 'denied' ? '#ffe2e2' : '#fff3e0',
                                color: ext.status === 'approved' ? '#35520f' : ext.status === 'denied' ? '#a00' : '#c98745'
                              }}>{ext.status.toUpperCase()}</span>
                            </div>
                            <div style={{ fontSize: '11px', color: '#5a625d', marginBottom: '6px' }}>
                              Requested new deadline: <strong>{new Date(ext.requested_deadline).toLocaleDateString()}</strong>
                            </div>
                            <p style={{ fontSize: '12px', color: '#2d3330', margin: '0 0 8px', whiteSpace: 'pre-line' }}>{ext.reason}</p>
                            {editingExtensionId === ext.id ? (
                              <div style={{ display: 'grid', gap: '8px' }}>
                                <input
                                  placeholder="Decision note (optional)..."
                                  value={extensionNoteDraft}
                                  onChange={(e) => setExtensionNoteDraft(e.target.value)}
                                  style={{ color: '#111512', background: '#fff', border: '1px solid #d8dbd1', fontSize: '12px', padding: '8px' }}
                                />
                                <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                                  <button onClick={() => setEditingExtensionId(null)} style={{ background: '#eef0ea', color: '#111512', minHeight: '32px', fontSize: '12px', padding: '0 12px', borderRadius: '4px', border: 0 }}>Cancel</button>
                                  <button onClick={() => decideExtension(ext.id, 'denied')} style={{ background: '#ffe2e2', color: '#a00', minHeight: '32px', fontSize: '12px', padding: '0 12px', borderRadius: '4px', border: 0, display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                                    <ThumbsDown size={12} /> Deny
                                  </button>
                                  <button onClick={() => decideExtension(ext.id, 'approved')} className="primary" style={{ minHeight: '32px', fontSize: '12px', padding: '0 12px', borderRadius: '4px', border: 0, display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                                    <ThumbsUp size={12} /> Approve
                                  </button>
                                </div>
                              </div>
                            ) : (
                              <>
                                {ext.decision_note && (
                                  <div style={{ fontSize: '11px', color: '#c98745', background: '#fff', borderLeft: '2px solid var(--copper)', padding: '4px 8px', marginBottom: '8px', borderRadius: '0 4px 4px 0' }}>
                                    <strong>Decision Note:</strong> {ext.decision_note}
                                  </div>
                                )}
                                <button onClick={() => triggerExtensionDecision(ext)} style={{ background: '#eef0ea', color: '#111512', minHeight: '28px', fontSize: '11px', padding: '0 10px', borderRadius: '4px', border: 0, cursor: 'pointer' }}>
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
                  <article className="panel" style={{ padding: '20px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '14px' }}>
                      <UploadCloud size={18} style={{ color: 'var(--accent)' }} />
                      <h3 style={{ margin: 0, fontSize: '18px' }}>Submissions</h3>
                    </div>
                    <div style={{ display: 'grid', gap: '12px' }}>
                      {SUBMISSION_STEPS.map((step, i) => {
                        const mine = studentDetails.submissions
                          .filter((s) => s.kind === step.key)
                          .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
                        const latest = mine[0];
                        const accepted = mine.some((s) => s.status === 'accepted');
                        const prevAccepted = i === 0 || studentDetails.submissions.some((s) => s.kind === SUBMISSION_STEPS[i - 1].key && s.status === 'accepted');
                        const unlocked = i === 0 || prevAccepted;
                        const state: 'done' | 'active' | 'locked' = accepted ? 'done' : unlocked ? 'active' : 'locked';
                        const accent = state === 'done' ? '#5f7c29' : state === 'active' ? '#2a5788' : '#b0b4ab';
                        return (
                          <div key={step.key} style={{ padding: '12px', background: state === 'locked' ? '#f3f4f0' : '#f7f8f3', border: '1px solid #d8dbd1', borderLeft: `4px solid ${accent}`, borderRadius: '6px', opacity: state === 'locked' ? 0.75 : 1 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: latest ? '8px' : 0 }}>
                              <div style={{ width: '22px', height: '22px', borderRadius: '50%', display: 'grid', placeItems: 'center', fontSize: '11px', fontWeight: 'bold', background: state === 'done' ? '#e8f2dc' : state === 'active' ? '#e2ecf8' : '#e7e9e3', color: accent, flexShrink: 0 }}>
                                {state === 'done' ? <CheckCircle2 size={14} /> : state === 'locked' ? <Lock size={12} /> : i + 1}
                              </div>
                              <strong style={{ color: '#111512', fontSize: '13px' }}>Step {i + 1}: {step.label}</strong>
                              {latest && (
                                <span style={{
                                  marginLeft: 'auto', fontSize: '10px', padding: '2px 6px', borderRadius: '4px', fontWeight: 'bold', textTransform: 'uppercase',
                                  background: latest.status === 'accepted' ? '#e8f2dc' : latest.status === 'revise' ? '#fff3e0' : '#e2ecf8',
                                  color: latest.status === 'accepted' ? '#35520f' : latest.status === 'revise' ? '#c98745' : '#2a5788'
                                }}>{latest.status === 'submitted' ? 'awaiting review' : latest.status}</span>
                              )}
                            </div>

                            {!latest && (
                              <p style={{ fontSize: '11px', color: '#8a908a', margin: 0, paddingLeft: '30px' }}>
                                {state === 'locked' ? `Locked — unlocks after Step ${i} is approved.` : 'Awaiting student upload.'}
                              </p>
                            )}

                            {latest && (
                              <div style={{ paddingLeft: '30px' }}>
                                <div style={{ fontSize: '11px', color: '#5a625d', marginBottom: '8px', display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                                  <span>{latest.file_name}</span>
                                  <span>{formatFileSize(latest.size)}</span>
                                  {mine.length > 1 && <span>· {mine.length} versions</span>}
                                </div>
                                <button
                                  onClick={() => downloadAdminSubmission(latest)}
                                  disabled={downloadingSubmissionId === latest.id}
                                  style={{ background: '#eef0ea', color: '#111512', minHeight: '28px', fontSize: '11px', padding: '0 10px', borderRadius: '4px', border: 0, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '4px', marginBottom: '8px' }}
                                >
                                  <Download size={11} /> {downloadingSubmissionId === latest.id ? 'Downloading...' : 'Download'}
                                </button>
                                {editingSubmissionId === latest.id ? (
                                  <div style={{ display: 'grid', gap: '8px' }}>
                                    <input
                                      placeholder="Review note (optional)..."
                                      value={submissionNoteDraft}
                                      onChange={(e) => setSubmissionNoteDraft(e.target.value)}
                                      style={{ color: '#111512', background: '#fff', border: '1px solid #d8dbd1', fontSize: '12px', padding: '8px' }}
                                    />
                                    <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                                      <button onClick={() => setEditingSubmissionId(null)} style={{ background: '#eef0ea', color: '#111512', minHeight: '32px', fontSize: '12px', padding: '0 12px', borderRadius: '4px', border: 0 }}>Cancel</button>
                                      <button onClick={() => reviewSubmission(latest.id, 'revise')} style={{ background: '#ffe2e2', color: '#a00', minHeight: '32px', fontSize: '12px', padding: '0 12px', borderRadius: '4px', border: 0, display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                                        <ThumbsDown size={12} /> Request Revision
                                      </button>
                                      <button onClick={() => reviewSubmission(latest.id, 'accepted')} className="primary" style={{ minHeight: '32px', fontSize: '12px', padding: '0 12px', borderRadius: '4px', border: 0, display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                                        <ThumbsUp size={12} /> Accept &amp; unlock next
                                      </button>
                                    </div>
                                  </div>
                                ) : (
                                  <>
                                    {latest.review_note && (
                                      <div style={{ fontSize: '11px', color: '#c98745', background: '#fff', borderLeft: '2px solid var(--copper)', padding: '4px 8px', marginBottom: '8px', borderRadius: '0 4px 4px 0' }}>
                                        <strong>Review Note:</strong> {latest.review_note}
                                      </div>
                                    )}
                                    <button onClick={() => triggerSubmissionReview(latest)} style={{ background: '#eef0ea', color: '#111512', minHeight: '28px', fontSize: '11px', padding: '0 10px', borderRadius: '4px', border: 0, cursor: 'pointer' }}>
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
                    {(() => {
                      const extras = studentDetails.submissions.filter((s) => !SUBMISSION_STEPS.some((st) => st.key === s.kind));
                      if (extras.length === 0) return null;
                      return (
                        <div style={{ marginTop: '12px', paddingTop: '12px', borderTop: '1px solid #e2e4dd' }}>
                          <span style={{ fontSize: '11px', color: '#5a625d', fontWeight: 'bold', display: 'block', marginBottom: '8px' }}>OTHER FILES</span>
                          <div style={{ display: 'grid', gap: '8px' }}>
                            {extras.map((s) => (
                              <div key={s.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px', fontSize: '11px', color: '#5a625d', background: '#f7f8f3', border: '1px solid #e2e4dd', borderRadius: '6px', padding: '8px 10px' }}>
                                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.title} · {s.file_name}</span>
                                <button
                                  onClick={() => downloadAdminSubmission(s)}
                                  disabled={downloadingSubmissionId === s.id}
                                  style={{ background: '#eef0ea', color: '#111512', minHeight: '26px', fontSize: '11px', padding: '0 8px', borderRadius: '4px', border: 0, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '4px', flexShrink: 0 }}
                                >
                                  <Download size={11} /> {downloadingSubmissionId === s.id ? '...' : 'Download'}
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
        )}

        {/* Events Tab */}
        {activeTab === 'events' && (
          <div style={{ display: 'grid', gridTemplateColumns: '0.9fr 1.1fr', gap: '24px', alignItems: 'start' }}>
            <section className="data-section" style={{ marginTop: 0 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                <h2>Public Events</h2>
                <button onClick={openCreateEventModal} className="primary" style={{ minHeight: '36px', fontSize: '12px', padding: '0 12px' }}>
                  <Plus size={14} /> New Event
                </button>
              </div>
              <div className="table">
                {events.map((event) => (
                  <article 
                    key={event.id} 
                    onClick={() => handleEventSelect(event)}
                    style={{ 
                      padding: '16px', 
                      background: selectedEvent?.id === event.id ? '#f7f8f3' : '#fff', 
                      border: '1px solid #dfe1da', 
                      borderRadius: '8px', 
                      cursor: 'pointer' 
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                      <strong style={{ fontSize: '15px' }}>{event.title}</strong>
                      <span className="status" style={{ background: event.is_published ? '#e8f2dc' : '#f0f0f0', color: event.is_published ? '#35520f !important' : '#555 !important' }}>
                        {event.is_published ? 'Published' : 'Draft'}
                      </span>
                    </div>
                    <div style={{ display: 'flex', gap: '12px', fontSize: '12px', color: '#5a625d', marginTop: '6px' }}>
                      <span>{new Date(event.date).toLocaleDateString()}</span>
                      <span>{event.location}</span>
                    </div>
                  </article>
                ))}
              </div>
            </section>

            <section className="data-section" style={{ marginTop: 0 }}>
              <h2>Event Administration</h2>
              {!selectedEvent ? (
                <div style={{ background: '#fff', border: '1px solid #d6d8d0', borderRadius: '8px', padding: '40px', textAlign: 'center', color: '#5a625d' }}>
                  Select an event to manage details, view attendee registrations, or send broadcast communications.
                </div>
              ) : (
                <div style={{ display: 'grid', gap: '24px' }}>
                  {/* Event details block */}
                  <article className="panel" style={{ padding: '20px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <h3 style={{ margin: 0, fontSize: '18px' }}>{selectedEvent.title}</h3>
                      <div style={{ display: 'flex', gap: '6px' }}>
                        <button onClick={() => openEditEventModal(selectedEvent)} style={{ background: '#eef0ea', border: 0, padding: 6, borderRadius: '4px', cursor: 'pointer' }}><Edit2 size={14} /></button>
                        <button onClick={() => deleteEvent(selectedEvent.id)} style={{ background: '#ffe2e2', color: '#a00', border: 0, padding: 6, borderRadius: '4px', cursor: 'pointer' }}><Trash2 size={14} /></button>
                      </div>
                    </div>
                    <p style={{ fontSize: '12px', marginBlock: '8px', color: '#5a625d' }}>{selectedEvent.description}</p>
                    <div style={{ display: 'flex', gap: '16px', fontSize: '12px', color: '#c98745', borderTop: '1px solid #eef0ea', paddingTop: '10px' }}>
                      <span>Date: {new Date(selectedEvent.date).toLocaleString()}</span>
                      <span>Location: {selectedEvent.location}</span>
                    </div>
                  </article>

                  {/* Attendee reservations */}
                  <article className="panel" style={{ padding: '20px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                      <h3 style={{ margin: 0, fontSize: '16px' }}>Attendee Registrations ({eventReservations.length})</h3>
                      <button onClick={() => setShowBroadcastModal(true)} className="primary" style={{ minHeight: '32px', fontSize: '12px', padding: '0 12px' }}>
                        <Mail size={14} /> Send Broadcast
                      </button>
                    </div>
                    <div style={{ display: 'grid', gap: '8px', maxHeight: '260px', overflowY: 'auto' }}>
                      {eventReservations.length === 0 ? (
                        <p style={{ fontSize: '12px', color: '#5a625d', textAlign: 'center', padding: '12px' }}>No registrations yet.</p>
                      ) : (
                        eventReservations.map((res) => (
                          <div key={res.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#f7f8f3', padding: '10px 12px', borderRadius: '6px', border: `1px solid ${res.status === 'confirmed' ? '#c5dfa6' : '#d8dbd1'}`, fontSize: '12px', gap: '8px' }}>
                            <div style={{ flex: 1 }}>
                              <strong style={{ fontSize: '13px' }}>{res.full_name}</strong>
                              <div style={{ color: '#5a625d', marginTop: '2px' }}>{res.email} · {res.phone || 'No phone'}</div>
                              {res.notes && <div style={{ fontSize: '11px', color: '#c98745', marginTop: '4px' }}>Note: "{res.notes}"</div>}
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
                              <span style={{
                                fontSize: '10px', padding: '3px 8px', borderRadius: '10px', fontWeight: 'bold',
                                background: res.status === 'confirmed' ? '#e8f2dc' : '#fff3e0',
                                color: res.status === 'confirmed' ? '#35520f' : '#c98745'
                              }}>
                                {res.status === 'confirmed' ? '✓ Confirmed' : '⏳ Pending'}
                              </span>
                              {res.status === 'pending' && (
                                <button
                                  onClick={() => approveReservation(res.id)}
                                  style={{ background: 'var(--accent)', color: '#11170e', border: 0, padding: '4px 10px', borderRadius: '4px', fontSize: '11px', fontWeight: '800', cursor: 'pointer', whiteSpace: 'nowrap' }}
                                >
                                  Approve Seat
                                </button>
                              )}
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </article>
                </div>
              )}
            </section>
          </div>
        )}

        {/* Products Tab */}
        {activeTab === 'products' && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px', alignItems: 'start' }}>
            <section className="data-section" style={{ marginTop: 0 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                <h2>Product Catalog</h2>
                <button onClick={openCreateProductModal} className="primary" style={{ minHeight: '36px', fontSize: '12px', padding: '0 12px' }}>
                  <Plus size={14} /> New Product
                </button>
              </div>
              <div className="table" style={{ display: 'grid', gap: '10px' }}>
                {products.length === 0 ? (
                  <p className="empty">No products added yet. Create your first product listing.</p>
                ) : (
                  products.map((p) => (
                    <article
                      key={p.id}
                      onClick={() => setSelectedProduct(p)}
                      style={{
                        padding: '14px 16px',
                        background: selectedProduct?.id === p.id ? '#f7f8f3' : '#fff',
                        border: '1px solid #dfe1da',
                        borderRadius: '8px',
                        cursor: 'pointer',
                        display: 'flex',
                        gap: '14px',
                        alignItems: 'center'
                      }}
                    >
                      {p.image_url ? (
                        <img src={p.image_url} alt="" style={{ width: '56px', height: '56px', objectFit: 'cover', borderRadius: '6px', border: '1px solid #dfe1da', flexShrink: 0 }} />
                      ) : (
                        <div style={{ width: '56px', height: '56px', borderRadius: '6px', border: '1px solid #dfe1da', background: '#eef0ea', flexShrink: 0 }} role="img" aria-label={p.name} />
                      )}
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                          <strong style={{ fontSize: '14px' }}>{p.name}</strong>
                          <span style={{
                            fontSize: '10px', padding: '3px 8px', borderRadius: '10px', fontWeight: 'bold', flexShrink: 0,
                            background: p.stock > 0 ? '#e8f2dc' : '#ffe2e2',
                            color: p.stock > 0 ? '#35520f' : '#a00'
                          }}>
                            {p.stock > 0 ? `${p.stock} in stock` : 'Out of stock'}
                          </span>
                        </div>
                        <div style={{ fontSize: '12px', color: '#5a625d', marginTop: '4px' }}>
                          {p.price > 0 ? `${p.price.toLocaleString()} ZMW` : 'Quote only'} · {p.is_published ? 'Published' : 'Draft'}
                        </div>
                      </div>
                    </article>
                  ))
                )}
              </div>
            </section>

            <section className="data-section" style={{ marginTop: 0 }}>
              <h2>Product Details</h2>
              {!selectedProduct ? (
                <div style={{ background: '#fff', border: '1px solid #d6d8d0', borderRadius: '8px', padding: '40px', textAlign: 'center', color: '#5a625d' }}>
                  Select a product to view details, edit stock levels, or manage listing visibility.
                </div>
              ) : (
                <article className="panel" style={{ padding: '24px', background: '#fff', borderRadius: '8px', border: '1px solid #dfe1da' }}>
                  {selectedProduct.image_url && (
                    <img src={selectedProduct.image_url} alt={selectedProduct.name} style={{ width: '100%', height: '180px', objectFit: 'cover', borderRadius: '8px', marginBottom: '16px' }} />
                  )}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px' }}>
                    <div>
                      <h3 style={{ margin: 0, fontSize: '20px' }}>{selectedProduct.name}</h3>
                      <p style={{ margin: '4px 0 0', fontSize: '12px', color: '#5a625d' }}>{selectedProduct.is_published ? '✓ Published on site' : '⏸ Draft — not public'}</p>
                    </div>
                    <div style={{ display: 'flex', gap: '6px' }}>
                      <button onClick={() => openEditProductModal(selectedProduct)} style={{ background: '#eef0ea', border: 0, padding: 6, borderRadius: '4px', cursor: 'pointer' }}><Edit2 size={14} /></button>
                      <button onClick={() => deleteProduct(selectedProduct.id)} style={{ background: '#ffe2e2', color: '#a00', border: 0, padding: 6, borderRadius: '4px', cursor: 'pointer' }}><Trash2 size={14} /></button>
                    </div>
                  </div>

                  <p style={{ fontSize: '13px', color: '#111512', lineHeight: '1.6', marginBottom: '16px' }}>{selectedProduct.description}</p>

                  {selectedProduct.specs && (
                    <div style={{ fontSize: '12px', color: '#c98745', background: '#faf8f2', padding: '10px 14px', borderRadius: '6px', border: '1px solid #eee5d4', marginBottom: '16px', fontFamily: 'monospace' }}>
                      {selectedProduct.specs}
                    </div>
                  )}

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', borderTop: '1px solid #dfe1da', paddingTop: '16px' }}>
                    <div>
                      <span style={{ fontSize: '11px', color: '#5a625d', display: 'block', fontWeight: 'bold' }}>PRICE</span>
                      <strong style={{ fontSize: '18px', color: '#111512' }}>{selectedProduct.price > 0 ? `${selectedProduct.price.toLocaleString()} ZMW` : 'Quote Only'}</strong>
                    </div>
                    <div>
                      <span style={{ fontSize: '11px', color: '#5a625d', display: 'block', fontWeight: 'bold' }}>STOCK</span>
                      <strong style={{ fontSize: '18px', color: selectedProduct.stock > 0 ? '#35520f' : '#a00' }}>
                        {selectedProduct.stock > 0 ? `${selectedProduct.stock} units available` : 'Out of stock'}
                      </strong>
                    </div>
                  </div>
                </article>
              )}
            </section>
          </div>
        )}

        {/* Pipeline Tab — stage board */}
        {activeTab === 'pipeline' && (
          <div style={{ display: 'flex', gap: '14px', overflowX: 'auto', paddingBottom: '8px', alignItems: 'flex-start' }}>
            {STAGE_ORDER.map((stage) => {
              const col = opportunities.filter((o) => o.stage === stage);
              const colValue = col.reduce((sum, o) => sum + o.deal_value, 0);
              const isTerminal = stage === 'won' || stage === 'lost';
              return (
                <div key={stage} style={{ flex: '0 0 260px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', padding: '2px 4px' }}>
                    <strong style={{ fontSize: '13px', textTransform: 'uppercase', letterSpacing: '0.03em', color: stage === 'won' ? '#35520f' : stage === 'lost' ? '#a00' : '#111512' }}>
                      {STAGE_LABELS[stage]} <span style={{ color: '#8a908a' }}>· {col.length}</span>
                    </strong>
                    <span style={{ fontSize: '11px', color: '#5a625d' }}>{ZMW(colValue)}</span>
                  </div>
                  <div style={{ display: 'grid', gap: '10px', background: '#e7eae2', borderRadius: '8px', padding: '10px', minHeight: '80px' }}>
                    {col.length === 0 ? (
                      <p style={{ fontSize: '12px', color: '#8a908a', textAlign: 'center', margin: '10px 0' }}>—</p>
                    ) : (
                      col.map((o) => {
                        const grade = GRADE_STYLES[o.grade];
                        return (
                          <div key={o.id} onClick={() => openEditOpportunityModal(o)} style={{ background: '#fff', border: '1px solid #d6d8d0', borderRadius: '8px', padding: '12px', cursor: 'pointer', display: 'grid', gap: '8px' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', gap: '8px', alignItems: 'flex-start' }}>
                              <strong style={{ fontSize: '14px', color: '#111512', lineHeight: 1.25 }}>{o.name}</strong>
                              <span style={{ flexShrink: 0, fontSize: '10px', fontWeight: 800, textTransform: 'uppercase', padding: '2px 7px', borderRadius: '10px', background: grade.bg, color: grade.fg }}>{grade.label}</span>
                            </div>
                            {o.account_name && <div style={{ fontSize: '12px', color: '#5a625d' }}>{o.account_name}{o.sector ? ` · ${o.sector}` : ''}</div>}
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px' }}>
                              <strong style={{ fontSize: '14px', color: '#111512' }}>{ZMW(o.deal_value)}</strong>
                              <span style={{ fontSize: '11px', color: '#5f7c29', fontWeight: 700 }}>{o.probability}%</span>
                            </div>
                            {!isTerminal && (
                              <div style={{ fontSize: '11px', color: '#8a908a' }}>Weighted {ZMW(o.weighted_value)}</div>
                            )}
                            <div style={{ fontSize: '11px', color: o.owner_id ? '#37607a' : '#b0b4ab' }}>
                              {o.owner_id ? staffName(o.owner_id) : 'Unassigned'}
                            </div>
                            <select
                              value={o.stage}
                              onClick={(e) => e.stopPropagation()}
                              onChange={(e) => moveOpportunityStage(o, e.target.value as OpportunityStage)}
                              style={{ fontSize: '12px', color: '#111512', background: '#f7f8f3', border: '1px solid #d8dbd1', padding: '6px 8px', minHeight: 0 }}
                            >
                              {STAGE_ORDER.map((s) => <option key={s} value={s}>{STAGE_LABELS[s]}</option>)}
                            </select>
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* Create / Edit Event Modal */}
      {showEventModal && (
        <div className="modal-overlay">
          <div className="modal-card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h2 style={{ margin: 0, fontSize: '22px' }}>{eventForm.id ? 'Edit Event' : 'Create Event'}</h2>
              <button onClick={() => setShowEventModal(false)} style={{ background: 'transparent', border: 0, padding: 4, cursor: 'pointer' }}><X size={18} /></button>
            </div>
            <form onSubmit={saveEvent} style={{ display: 'grid', gap: '12px' }}>
              <div>
                <label style={{ fontSize: '12px', color: '#5a625d' }}>Event Title</label>
                <input required value={eventForm.title} onChange={(e) => setEventForm({ ...eventForm, title: e.target.value })} style={{ color: '#111512', background: '#f7f8f3' }} />
              </div>
              <div>
                <label style={{ fontSize: '12px', color: '#5a625d' }}>Description</label>
                <textarea required value={eventForm.description} onChange={(e) => setEventForm({ ...eventForm, description: e.target.value })} style={{ color: '#111512', background: '#f7f8f3', minHeight: '80px' }} />
              </div>
              <div>
                <label style={{ fontSize: '12px', color: '#5a625d' }}>Date & Time</label>
                <input required type="datetime-local" value={eventForm.date} onChange={(e) => setEventForm({ ...eventForm, date: e.target.value })} style={{ color: '#111512', background: '#f7f8f3' }} />
              </div>
              <div>
                <label style={{ fontSize: '12px', color: '#5a625d' }}>Location</label>
                <input required value={eventForm.location} onChange={(e) => setEventForm({ ...eventForm, location: e.target.value })} style={{ color: '#111512', background: '#f7f8f3' }} />
              </div>
              <div>
                <label style={{ fontSize: '12px', color: '#5a625d' }}>Seating Capacity</label>
                <input type="number" required value={eventForm.capacity} onChange={(e) => setEventForm({ ...eventForm, capacity: Number(e.target.value) })} style={{ color: '#111512', background: '#f7f8f3' }} />
              </div>
              <div>
                <label style={{ fontSize: '12px', color: '#5a625d' }}>Event Image URL (optional — paste a direct image link)</label>
                <input placeholder="https://example.com/event-banner.jpg" value={eventForm.image_url} onChange={(e) => setEventForm({ ...eventForm, image_url: e.target.value })} style={{ color: '#111512', background: '#f7f8f3' }} />
                {eventForm.image_url && (
                  <div style={{ marginTop: '8px', borderRadius: '6px', overflow: 'hidden', maxHeight: '100px' }}>
                    <img src={eventForm.image_url} alt="Preview" style={{ width: '100%', objectFit: 'cover', maxHeight: '100px' }} onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                  </div>
                )}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <input type="checkbox" checked={eventForm.is_published} onChange={(e) => setEventForm({ ...eventForm, is_published: e.target.checked })} style={{ width: 'auto' }} />
                <label style={{ fontSize: '13px', color: '#5a625d' }}>Publish Event immediately</label>
              </div>
              <button type="submit" className="primary" style={{ width: '100%', minHeight: '44px', marginTop: '12px' }}>
                {eventForm.id ? 'Update Event' : 'Create Event'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Broadcast Modal */}
      {showBroadcastModal && selectedEvent && (
        <div className="modal-overlay">
          <div className="modal-card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h2 style={{ margin: 0, fontSize: '20px' }}>Broadcast to {selectedEvent.title} attendees</h2>
              <button onClick={() => setShowBroadcastModal(false)} style={{ background: 'transparent', border: 0, padding: 4, cursor: 'pointer' }}><X size={18} /></button>
            </div>
            <p style={{ fontSize: '12px', color: '#5a625d', margin: 0 }}>This will dispatch an announcement/update email to all {eventReservations.filter((r) => r.status === 'confirmed').length} confirmed seat reservation(s).</p>
            <form onSubmit={sendBroadcast} style={{ display: 'grid', gap: '12px' }}>
              <div>
                <label style={{ fontSize: '12px', color: '#5a625d' }}>Subject</label>
                <input required placeholder="Important update regarding..." value={broadcastForm.subject} onChange={(e) => setBroadcastForm({ ...broadcastForm, subject: e.target.value })} style={{ color: '#111512', background: '#f7f8f3' }} />
              </div>
              <div>
                <label style={{ fontSize: '12px', color: '#5a625d' }}>Message Body</label>
                <textarea required placeholder="Write your announcement details here..." value={broadcastForm.message} onChange={(e) => setBroadcastForm({ ...broadcastForm, message: e.target.value })} style={{ color: '#111512', background: '#f7f8f3', minHeight: '120px' }} />
              </div>
              <button type="submit" className="primary" style={{ width: '100%', minHeight: '44px', marginTop: '12px' }}>
                Send Broadcast <Send size={14} />
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Create / Edit Product Modal */}
      {showProductModal && (
        <div className="modal-overlay">
          <div className="modal-card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h2 style={{ margin: 0, fontSize: '22px' }}>{productForm.id ? 'Edit Product' : 'New Product'}</h2>
              <button onClick={() => setShowProductModal(false)} style={{ background: 'transparent', border: 0, padding: 4, cursor: 'pointer' }}><X size={18} /></button>
            </div>
            <form onSubmit={saveProduct} style={{ display: 'grid', gap: '12px' }}>
              <div>
                <label style={{ fontSize: '12px', color: '#5a625d' }}>Product Name</label>
                <input required value={productForm.name} onChange={(e) => setProductForm({ ...productForm, name: e.target.value })} style={{ color: '#111512', background: '#f7f8f3' }} />
              </div>
              <div>
                <label style={{ fontSize: '12px', color: '#5a625d' }}>Description</label>
                <textarea required value={productForm.description} onChange={(e) => setProductForm({ ...productForm, description: e.target.value })} style={{ color: '#111512', background: '#f7f8f3', minHeight: '80px' }} />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <label style={{ fontSize: '12px', color: '#5a625d' }}>Price (ZMW)</label>
                  <input type="number" required value={productForm.price} onChange={(e) => setProductForm({ ...productForm, price: Number(e.target.value) })} style={{ color: '#111512', background: '#f7f8f3' }} />
                </div>
                <div>
                  <label style={{ fontSize: '12px', color: '#5a625d' }}>Stock Quantity</label>
                  <input type="number" required value={productForm.stock} onChange={(e) => setProductForm({ ...productForm, stock: Number(e.target.value) })} style={{ color: '#111512', background: '#f7f8f3' }} />
                </div>
              </div>
              <div>
                <label style={{ fontSize: '12px', color: '#5a625d' }}>Product Image</label>
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center', marginTop: '4px' }}>
                  <label
                    style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', background: '#eef0ea', color: '#111512', border: '1px solid #d8dbd1', borderRadius: '6px', padding: '0 14px', minHeight: '40px', fontSize: '13px', fontWeight: 700, cursor: uploadingProductImage ? 'default' : 'pointer', opacity: uploadingProductImage ? 0.6 : 1, whiteSpace: 'nowrap' }}
                  >
                    <UploadCloud size={15} /> {uploadingProductImage ? 'Uploading…' : 'Upload image'}
                    <input
                      type="file"
                      accept="image/png,image/jpeg,image/webp,image/gif"
                      disabled={uploadingProductImage}
                      onChange={(e) => { handleProductImageUpload(e.target.files?.[0]); e.target.value = ''; }}
                      style={{ display: 'none' }}
                    />
                  </label>
                  {productForm.image_url && (
                    <button type="button" onClick={() => setProductForm({ ...productForm, image_url: '' })} style={{ background: 'transparent', border: '1px solid #d8dbd1', color: '#5a625d', borderRadius: '6px', padding: '0 12px', minHeight: '40px', fontSize: '13px', cursor: 'pointer' }}>
                      Remove
                    </button>
                  )}
                </div>
                <p style={{ fontSize: '11px', color: '#8a908a', margin: '6px 0 4px' }}>PNG, JPG, WEBP or GIF up to 5 MB — or paste an image link below.</p>
                <input placeholder="https://example.com/product-photo.jpg" value={productForm.image_url} onChange={(e) => setProductForm({ ...productForm, image_url: e.target.value })} style={{ color: '#111512', background: '#f7f8f3' }} />
                {productForm.image_url && (
                  <div style={{ marginTop: '8px', borderRadius: '6px', overflow: 'hidden', maxHeight: '120px' }}>
                    <img src={productForm.image_url} alt="Preview" style={{ width: '100%', objectFit: 'cover', maxHeight: '120px' }} onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                  </div>
                )}
              </div>
              <div>
                <label style={{ fontSize: '12px', color: '#5a625d' }}>Specs (pipe-separated, e.g. Range: 60km | Motor: 350W)</label>
                <input value={productForm.specs} onChange={(e) => setProductForm({ ...productForm, specs: e.target.value })} style={{ color: '#111512', background: '#f7f8f3' }} />
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <input type="checkbox" checked={productForm.is_published} onChange={(e) => setProductForm({ ...productForm, is_published: e.target.checked })} style={{ width: 'auto' }} />
                <label style={{ fontSize: '13px', color: '#5a625d' }}>Publish on website</label>
              </div>
              <button type="submit" className="primary" style={{ width: '100%', minHeight: '44px', marginTop: '12px' }}>
                {productForm.id ? 'Save Changes' : 'Create Product'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Create / Edit Opportunity Modal */}
      {showOpportunityModal && (
        <div className="modal-overlay">
          <div className="modal-card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h2 style={{ margin: 0, fontSize: '22px' }}>{opportunityForm.id ? 'Edit Opportunity' : 'New Opportunity'}</h2>
              <button onClick={() => setShowOpportunityModal(false)} style={{ background: 'transparent', border: 0, padding: 4, cursor: 'pointer' }}><X size={18} /></button>
            </div>
            <form onSubmit={saveOpportunity} style={{ display: 'grid', gap: '12px' }}>
              <div>
                <label style={{ fontSize: '12px', color: '#5a625d' }}>Opportunity Name</label>
                <input required placeholder="e.g. Data Centre migration — Phase 1" value={opportunityForm.name} onChange={(e) => setOpportunityForm({ ...opportunityForm, name: e.target.value })} style={{ color: '#111512', background: '#f7f8f3' }} />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <label style={{ fontSize: '12px', color: '#5a625d' }}>Account / Company</label>
                  <input value={opportunityForm.account_name} onChange={(e) => setOpportunityForm({ ...opportunityForm, account_name: e.target.value })} style={{ color: '#111512', background: '#f7f8f3' }} />
                </div>
                <div>
                  <label style={{ fontSize: '12px', color: '#5a625d' }}>Sector</label>
                  <input placeholder="e.g. Mining, Telecom" value={opportunityForm.sector} onChange={(e) => setOpportunityForm({ ...opportunityForm, sector: e.target.value })} style={{ color: '#111512', background: '#f7f8f3' }} />
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <label style={{ fontSize: '12px', color: '#5a625d' }}>Contact Name</label>
                  <input value={opportunityForm.contact_name} onChange={(e) => setOpportunityForm({ ...opportunityForm, contact_name: e.target.value })} style={{ color: '#111512', background: '#f7f8f3' }} />
                </div>
                <div>
                  <label style={{ fontSize: '12px', color: '#5a625d' }}>Contact Email</label>
                  <input type="email" value={opportunityForm.contact_email} onChange={(e) => setOpportunityForm({ ...opportunityForm, contact_email: e.target.value })} style={{ color: '#111512', background: '#f7f8f3' }} />
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <label style={{ fontSize: '12px', color: '#5a625d' }}>Stage</label>
                  <select
                    value={opportunityForm.stage}
                    onChange={(e) => {
                      const stage = e.target.value as OpportunityStage;
                      const defaults: Record<OpportunityStage, number> = { prospecting: 10, qualified: 30, proposal: 50, negotiation: 70, won: 100, lost: 0 };
                      setOpportunityForm({ ...opportunityForm, stage, probability: defaults[stage] });
                    }}
                    style={{ color: '#111512', background: '#f7f8f3' }}
                  >
                    {STAGE_ORDER.map((s) => <option key={s} value={s}>{STAGE_LABELS[s]}</option>)}
                  </select>
                </div>
                <div>
                  <label style={{ fontSize: '12px', color: '#5a625d' }}>Maturity Grade</label>
                  <select value={opportunityForm.grade} onChange={(e) => setOpportunityForm({ ...opportunityForm, grade: e.target.value as OpportunityGrade })} style={{ color: '#111512', background: '#f7f8f3' }}>
                    {(['bronze', 'silver', 'gold', 'platinum'] as OpportunityGrade[]).map((g) => <option key={g} value={g}>{GRADE_STYLES[g].label}</option>)}
                  </select>
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <label style={{ fontSize: '12px', color: '#5a625d' }}>Deal Value (ZMW)</label>
                  <input type="number" min="0" value={opportunityForm.deal_value} onChange={(e) => setOpportunityForm({ ...opportunityForm, deal_value: Number(e.target.value) })} style={{ color: '#111512', background: '#f7f8f3' }} />
                </div>
                <div>
                  <label style={{ fontSize: '12px', color: '#5a625d' }}>Probability (%)</label>
                  <input type="number" min="0" max="100" value={opportunityForm.probability} onChange={(e) => setOpportunityForm({ ...opportunityForm, probability: Number(e.target.value) })} style={{ color: '#111512', background: '#f7f8f3' }} />
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <label style={{ fontSize: '12px', color: '#5a625d' }}>Owner</label>
                  <select value={opportunityForm.owner_id} onChange={(e) => setOpportunityForm({ ...opportunityForm, owner_id: e.target.value })} style={{ color: '#111512', background: '#f7f8f3' }}>
                    <option value="">Unassigned</option>
                    {staff.map((s) => <option key={s.id} value={s.id}>{s.full_name}</option>)}
                  </select>
                </div>
                <div>
                  <label style={{ fontSize: '12px', color: '#5a625d' }}>Expected Close Date</label>
                  <input type="date" value={opportunityForm.expected_close_at} onChange={(e) => setOpportunityForm({ ...opportunityForm, expected_close_at: e.target.value })} style={{ color: '#111512', background: '#f7f8f3' }} />
                </div>
              </div>
              <div>
                <label style={{ fontSize: '12px', color: '#5a625d' }}>Notes</label>
                <textarea value={opportunityForm.notes} onChange={(e) => setOpportunityForm({ ...opportunityForm, notes: e.target.value })} style={{ color: '#111512', background: '#f7f8f3', minHeight: '70px' }} />
              </div>
              <div style={{ fontSize: '12px', color: '#5a625d', background: '#eef0ea', borderRadius: '6px', padding: '10px 12px' }}>
                Weighted value: <strong style={{ color: '#5f7c29' }}>{ZMW((Number(opportunityForm.deal_value) || 0) * Number(opportunityForm.probability) / 100)}</strong>
              </div>
              <div style={{ display: 'flex', gap: '10px', marginTop: '4px' }}>
                <button type="submit" className="primary" style={{ flex: 1, minHeight: '44px' }}>
                  {opportunityForm.id ? 'Save Changes' : 'Create Opportunity'}
                </button>
                {opportunityForm.id && (
                  <button type="button" onClick={() => deleteOpportunity(opportunityForm.id)} style={{ background: '#fff', border: '1px solid #e2b4b4', color: '#a00', borderRadius: '8px', padding: '0 16px', minHeight: '44px', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                    <Trash2 size={15} /> Delete
                  </button>
                )}
              </div>
            </form>
          </div>
        </div>
      )}
    </main>
  );
}
