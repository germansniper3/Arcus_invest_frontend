import { Fragment, useEffect, useState } from 'react';
import {
  LogOut, RefreshCcw, UserPlus, FileText, Calendar,
  Send, CheckSquare, Plus, Edit2, Trash2,
  Mail, X, Clock, Settings, GraduationCap, CalendarClock, ThumbsUp, ThumbsDown,
  UploadCloud, Download, Target, Lock, CheckCircle2, Building2, ScrollText, History, Sparkles, Users, Image as ImageIcon
} from 'lucide-react';
import { toast } from 'sonner';
import { api, formatFileSize, MAX_PRODUCT_IMAGE_SIZE, MAX_SUBMISSION_FILE_SIZE } from '../lib/api';
import { useAuth } from '../lib/auth';
import type { Enrollment, QuoteRequest, User, Event, Reservation, Product, ProgressReport, ExtensionRequest, Submission, Opportunity, OpportunityActivity, ActivityType, OpportunityStage, OpportunityGrade, OpportunitySegment, OpportunityContact, OpportunityLineItem, Payment, PaymentMethod, PipelineForecast, AccountsIndex, AccountRecommendations, Contract, ContractStatus, AuditLog, EmailStatus, PermissionResource, CustomRole, CustomRolePermission, GalleryItem, GalleryCategory, DocumentVersion, DocumentAccessLog } from '../types';
import DocumentView, { type DocumentKind } from '../components/DocumentView';
import { NumberField } from '../components/NumberField';
import { Modal } from '../components/Modal';

type Tab = 'overview' | 'enrollments' | 'students' | 'events' | 'products' | 'pipeline' | 'accounts' | 'contracts' | 'audit' | 'users' | 'gallery';

const ROLE_STYLES: Record<string, { bg: string; fg: string; label: string }> = {
  super_admin: { bg: '#e7dff2', fg: '#5b3a8a', label: 'Super Admin' },
  admin: { bg: '#e2ecf8', fg: '#2a5788', label: 'Admin' },
  admissions: { bg: '#dcefe0', fg: '#2f6b3d', label: 'Admissions' },
  student: { bg: '#f7edc8', fg: '#8a6d1a', label: 'Student' },
};

// Human-readable colour coding for audit-trail action verbs.
const AUDIT_ACTION_STYLE: Record<string, { bg: string; fg: string }> = {
  create: { bg: '#e8f2dc', fg: '#35520f' },
  update: { bg: '#e2ecf8', fg: '#2a5788' },
  delete: { bg: '#ffe2e2', fg: '#a00' },
  convert: { bg: '#e7dff2', fg: '#5b3a8a' },
  upload: { bg: '#f7edc8', fg: '#8a6d1a' },
  approve: { bg: '#dcefe0', fg: '#2f6b3d' },
  log: { bg: '#eceee7', fg: '#5a625d' },
  invite: { bg: '#e2ecf8', fg: '#2a5788' },
  broadcast: { bg: '#f0e0d0', fg: '#8a5a2b' },
  other: { bg: '#eceee7', fg: '#5a625d' },
};
const auditActionStyle = (a: string) => AUDIT_ACTION_STYLE[a] ?? AUDIT_ACTION_STYLE.other;

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

// ABM account segments + buying-committee roles.
const SEGMENT_STYLES: Record<string, { bg: string; fg: string; label: string }> = {
  strategic: { bg: '#e7dff2', fg: '#5b3a8a', label: 'Strategic' },
  growth: { bg: '#dcefe0', fg: '#2f6b3d', label: 'Growth' },
  standard: { bg: '#eceee7', fg: '#5a625d', label: 'Standard' },
};
const CONTACT_ROLES: { value: string; label: string }[] = [
  { value: 'decision_maker', label: 'Decision Maker' },
  { value: 'champion', label: 'Champion' },
  { value: 'influencer', label: 'Influencer' },
  { value: 'technical', label: 'Technical' },
  { value: 'procurement', label: 'Procurement' },
  { value: 'other', label: 'Other' },
];

// Engagement-log entry types (deal activity timeline).
const ACTIVITY_TYPES: { value: ActivityType; label: string; color: string }[] = [
  { value: 'call', label: 'Call', color: '#2a5788' },
  { value: 'meeting', label: 'Meeting', color: '#5b3a8a' },
  { value: 'email', label: 'Email', color: '#2f6b3d' },
  { value: 'note', label: 'Note', color: '#5a625d' },
  { value: 'task', label: 'Task', color: '#8a6d1a' },
  { value: 'other', label: 'Other', color: '#8a908a' },
];
const ACTIVITY_STYLE = (t: ActivityType) => ACTIVITY_TYPES.find((a) => a.value === t) ?? ACTIVITY_TYPES[3];

// Payment methods for recording receipts.
const PAYMENT_METHODS: { value: PaymentMethod; label: string }[] = [
  { value: 'bank_transfer', label: 'Bank Transfer' },
  { value: 'cash', label: 'Cash' },
  { value: 'mobile_money', label: 'Mobile Money' },
  { value: 'cheque', label: 'Cheque' },
  { value: 'card', label: 'Card' },
  { value: 'other', label: 'Other' },
];
const PAYMENT_METHOD_LABEL = (m: string) => PAYMENT_METHODS.find((x) => x.value === m)?.label ?? m;

const CONTRACT_STATUSES: ContractStatus[] = ['draft', 'sent', 'signed', 'active', 'expired'];
const CONTRACT_STATUS_STYLES: Record<ContractStatus, { bg: string; fg: string }> = {
  draft: { bg: '#eceee7', fg: '#5a625d' },
  sent: { bg: '#e2ecf8', fg: '#2a5788' },
  signed: { bg: '#e7dff2', fg: '#5b3a8a' },
  active: { bg: '#e8f2dc', fg: '#35520f' },
  expired: { bg: '#ffe2e2', fg: '#a00' },
};
// Days until renewal that count as "due soon".
const RENEWAL_SOON_DAYS = 30;
function renewalState(iso?: string | null): 'none' | 'overdue' | 'soon' | 'ok' {
  if (!iso) return 'none';
  const days = Math.ceil((new Date(iso).getTime() - Date.now()) / 86400000);
  if (days < 0) return 'overdue';
  if (days <= RENEWAL_SOON_DAYS) return 'soon';
  return 'ok';
}

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
  const emptyOpportunity = { id: '', name: '', account_name: '', contact_name: '', contact_email: '', sector: '', segment: 'standard' as OpportunitySegment, stage: 'prospecting' as OpportunityStage, grade: 'bronze' as OpportunityGrade, deal_value: 0, probability: 10, owner_id: '', expected_close_at: '', notes: '', contacts: [] as OpportunityContact[], line_items: [] as OpportunityLineItem[] };
  const [opportunityForm, setOpportunityForm] = useState(emptyOpportunity);
  // Engagement log for the opportunity currently open in the modal.
  const [activities, setActivities] = useState<OpportunityActivity[]>([]);
  const [activitiesLoading, setActivitiesLoading] = useState(false);
  const [activityForm, setActivityForm] = useState<{ type: ActivityType; body: string }>({ type: 'note', body: '' });
  const [loggingActivity, setLoggingActivity] = useState(false);
  // Payments recorded against the opportunity currently open in the modal.
  const [payments, setPayments] = useState<Payment[]>([]);
  const emptyPayment = { amount: 0, method: 'bank_transfer' as PaymentMethod, reference: '', note: '' };
  const [paymentForm, setPaymentForm] = useState(emptyPayment);
  const [recordingPayment, setRecordingPayment] = useState(false);
  // Document generator overlay (quotation / invoice / receipt).
  const [docState, setDocState] = useState<{ kind: DocumentKind; opportunity: Opportunity; receiptPayment?: Payment } | null>(null);
  const [applyVat, setApplyVat] = useState(true);

  // Accounts & VSI State
  const [accountsIndex, setAccountsIndex] = useState<AccountsIndex | null>(null);

  // Cross-sell / upsell recommendations for the account row expanded below.
  const [recsAccount, setRecsAccount] = useState<string | null>(null);
  const [recs, setRecs] = useState<AccountRecommendations | null>(null);
  const [recsLoading, setRecsLoading] = useState(false);

  // Effective permissions from /auth/me. Absent (older token/response) falls back
  // to the previous role check so the portal never renders empty.
  const perms = user?.permissions;
  const can = (res: PermissionResource, act: 'read' | 'create' | 'update' | 'delete' = 'read') => {
    if (!perms) return user?.role === 'super_admin' || user?.role === 'admin';
    return perms[res]?.[act] === true;
  };

  // Gallery State
  const [gallery, setGallery] = useState<GalleryItem[]>([]);
  const [showGalleryModal, setShowGalleryModal] = useState(false);
  const emptyGalleryItem = { id: '', title: '', caption: '', category: 'Electronics' as GalleryCategory, image_url: '', position: 0, is_published: true };
  const [galleryForm, setGalleryForm] = useState(emptyGalleryItem);
  const [savingGallery, setSavingGallery] = useState(false);
  const [uploadingGalleryImage, setUploadingGalleryImage] = useState(false);

  // Audit trail State
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const canViewAudit = can('audit');

  // Roles State
  const ALL_RESOURCES: PermissionResource[] = [
    'opportunities', 'accounts', 'contracts', 'payments', 'quotes',
    'enrollments', 'students', 'events', 'products', 'users',
    'audit', 'email', 'metrics', 'roles'
  ];
  const [roles, setRoles] = useState<CustomRole[]>([]);
  const [showRoleModal, setShowRoleModal] = useState(false);
  const [editingRole, setEditingRole] = useState<CustomRole | null>(null);
  const [roleForm, setRoleForm] = useState<{ id: string; name: string; label: string; description: string; permissions: CustomRolePermission[] }>({ id: '', name: '', label: '', description: '', permissions: [] });
  const [savingRole, setSavingRole] = useState(false);

  // Users + email diagnostics State (same privilege as the audit trail)
  const [users, setUsers] = useState<User[]>([]);
  const [emailStatus, setEmailStatus] = useState<EmailStatus | null>(null);
  const [sendingTestEmail, setSendingTestEmail] = useState(false);
  const [showUserModal, setShowUserModal] = useState(false);
  const emptyUser = { email: '', full_name: '', password: '', role: 'admissions' };
  const [userForm, setUserForm] = useState(emptyUser);
  const [savingUser, setSavingUser] = useState(false);

  // New-enrollment modal (admin-initiated onboarding)
  const [showEnrollmentModal, setShowEnrollmentModal] = useState(false);
  const emptyEnrollmentForm = { full_name: '', email: '', phone: '', location: '', tier: 'Builder', about: '', notes: '' };
  const [enrollmentForm, setEnrollmentForm] = useState(emptyEnrollmentForm);
  const [savingEnrollment, setSavingEnrollment] = useState(false);

  // Contracts State
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [showContractModal, setShowContractModal] = useState(false);
  const emptyContract = { id: '', account_name: '', opportunity_id: '', title: '', status: 'draft' as ContractStatus, value: 0, start_date: '', renewal_date: '', notes: '' };
  const [contractForm, setContractForm] = useState(emptyContract);
  const [contractFile, setContractFile] = useState<File | null>(null);
  const [contractVersions, setContractVersions] = useState<DocumentVersion[]>([]);
  const [contractAccessLog, setContractAccessLog] = useState<DocumentAccessLog[]>([]);
  const [contractHistoryLoading, setContractHistoryLoading] = useState(false);
  const [savingContract, setSavingContract] = useState(false);
  const [downloadingContractId, setDownloadingContractId] = useState<string | null>(null);
  const NIL_UUID = '00000000-0000-0000-0000-000000000000';
  const staffName = (id?: string | null) => (id ? staff.find((s) => s.id === id)?.full_name ?? 'Unknown' : '');

  async function loadData() {
    try {
      const nextMetrics = await api.adminMetrics();
      setMetrics(nextMetrics);

      // Each branch is permission-guarded so a restricted role never fires a
      // request the server will refuse.
      if (activeTab === 'overview') {
        if (can('quotes')) {
          const nextQuotes = await api.quotes();
          setQuotes(nextQuotes);
        } else {
          setQuotes([]);
        }
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
      } else if (activeTab === 'accounts') {
        setAccountsIndex(await api.adminAccountsIndex());
      } else if (activeTab === 'gallery') {
        setGallery(await api.adminListGallery());
      } else if (activeTab === 'audit') {
        setAuditLogs(await api.adminAuditLogs());
      } else if (activeTab === 'users') {
        const fetchTasks: [Promise<User[]>, Promise<EmailStatus>, Promise<CustomRole[]>?] = [
          api.adminListUsers(),
          api.adminEmailStatus(),
        ];
        if (can('roles')) {
          fetchTasks.push(api.adminListRoles());
        }
        const [nextUsers, nextEmail, nextRoles] = await Promise.all(fetchTasks);
        setUsers(nextUsers);
        setEmailStatus(nextEmail);
        if (nextRoles) setRoles(nextRoles);
      } else if (activeTab === 'contracts') {
        const [nextContracts, nextOpportunities] = await Promise.all([
          api.adminListContracts(),
          api.adminListOpportunities(),
        ]);
        setContracts(nextContracts);
        setOpportunities(nextOpportunities);
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

  // If the signed-in user has no access to the active tab (e.g. their role changed
  // mid-session), fall back to Overview rather than repeatedly hitting a 403.
  const TAB_RESOURCE: Partial<Record<Tab, PermissionResource>> = {
    pipeline: 'opportunities', accounts: 'accounts', contracts: 'contracts',
    enrollments: 'enrollments', students: 'students', events: 'events',
    products: 'products', users: 'users', audit: 'audit', gallery: 'gallery',
  };
  useEffect(() => {
    const needed = TAB_RESOURCE[activeTab];
    if (needed && !can(needed)) {
      setActiveTab('overview');
      return;
    }
    loadData();
  }, [activeTab, user]);

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
      if (res.emailed) {
        toast.success(`Invitation emailed to ${item.email}`);
      } else {
        // Delivery is best-effort — the link still works, so say what to do next.
        toast.warning(`Invitation created, but email was not sent (${res.email_error || 'unknown reason'}). Copy the link below and send it manually.`);
      }
    } catch (err: any) {
      toast.error(err.message || 'Failed to generate invitation');
    }
  }

  async function saveEnrollment(e: React.FormEvent) {
    e.preventDefault();
    setSavingEnrollment(true);
    try {
      await api.adminCreateEnrollment(enrollmentForm);
      toast.success('Enrollment created — you can now send the onboarding invite.');
      setShowEnrollmentModal(false);
      loadData();
    } catch (err: any) {
      toast.error(err.message || 'Failed to create enrollment');
    } finally {
      setSavingEnrollment(false);
    }
  }

  // --- Users & email handlers ---
  async function saveUser(e: React.FormEvent) {
    e.preventDefault();
    if (userForm.password.length < 10) {
      toast.error('Password must be at least 10 characters');
      return;
    }
    setSavingUser(true);
    try {
      await api.createUser(userForm);
      toast.success('User created');
      setShowUserModal(false);
      loadData();
    } catch (err: any) {
      toast.error(err.message || 'Failed to create user');
    } finally {
      setSavingUser(false);
    }
  }

  async function toggleUserActive(u: User) {
    try {
      await api.adminUpdateUser(u.id, { is_active: !u.is_active });
      toast.success(u.is_active ? 'User deactivated' : 'User activated');
      loadData();
    } catch (err: any) {
      toast.error(err.message || 'Failed to update user');
    }
  }

  async function deleteUser(u: User) {
    const extra = u.role === 'student'
      ? ' Their capstone data will be removed and the enrollment reopened for re-invitation.'
      : '';
    if (!confirm(`Permanently delete ${u.full_name} (${u.email})?${extra} This cannot be undone.`)) return;
    try {
      await api.adminDeleteUser(u.id);
      toast.success('User deleted');
      loadData();
    } catch (err: any) {
      toast.error(err.message || 'Failed to delete user');
    }
  }

  // --- Role Handlers ---
  function openCreateRoleModal() {
    setEditingRole(null);
    const initialPerms: CustomRolePermission[] = ALL_RESOURCES.map((r) => ({
      resource: r,
      can_read: false,
      can_create: false,
      can_update: false,
      can_delete: false,
      scope: 'none',
    }));
    setRoleForm({ id: '', name: '', label: '', description: '', permissions: initialPerms });
    setShowRoleModal(true);
  }

  function openEditRoleModal(role: CustomRole) {
    setEditingRole(role);
    const permMap = new Map((role.permissions ?? []).map((p) => [p.resource, p]));
    const fullPerms: CustomRolePermission[] = ALL_RESOURCES.map((r) => {
      const existing = permMap.get(r);
      if (existing) return { ...existing };
      return {
        resource: r,
        can_read: false,
        can_create: false,
        can_update: false,
        can_delete: false,
        scope: 'none',
      };
    });
    setRoleForm({
      id: role.id,
      name: role.name,
      label: role.label,
      description: role.description || '',
      permissions: fullPerms,
    });
    setShowRoleModal(true);
  }

  function handlePermChange(
    res: PermissionResource,
    field: 'can_read' | 'can_create' | 'can_update' | 'can_delete' | 'scope',
    value: any
  ) {
    setRoleForm((prev) => {
      const updatedPerms = prev.permissions.map((p) => {
        if (p.resource !== res) return p;
        const updated = { ...p, [field]: value };
        if (field === 'scope') {
          if (value === 'none') {
            updated.can_read = false;
            updated.can_create = false;
            updated.can_update = false;
            updated.can_delete = false;
          } else if (p.scope === 'none' && value !== 'none') {
            updated.can_read = true;
          }
        } else {
          const hasAny = updated.can_read || updated.can_create || updated.can_update || updated.can_delete;
          if (hasAny && updated.scope === 'none') {
            updated.scope = 'all';
          } else if (!hasAny) {
            updated.scope = 'none';
          }
        }
        return updated;
      });
      return { ...prev, permissions: updatedPerms };
    });
  }

  async function saveRole(e: React.FormEvent) {
    e.preventDefault();
    setSavingRole(true);
    try {
      if (roleForm.id) {
        // Built-in grants are fixed server-side; sending them would be rejected.
        // Only label/description are editable for those roles.
        await api.adminUpdateRole(roleForm.id, {
          label: roleForm.label,
          description: roleForm.description,
          ...(editingRole?.is_built_in ? {} : { permissions: roleForm.permissions }),
        });
        toast.success('Role updated successfully');
      } else {
        await api.adminCreateRole({
          name: roleForm.name,
          label: roleForm.label,
          description: roleForm.description,
          permissions: roleForm.permissions,
        });
        toast.success('Role created successfully');
      }
      setShowRoleModal(false);
      loadData();
    } catch (err: any) {
      toast.error(err.message || 'Failed to save role');
    } finally {
      setSavingRole(false);
    }
  }

  async function deleteRole(role: CustomRole) {
    if (role.is_built_in) {
      toast.error('Built-in roles cannot be deleted');
      return;
    }
    if ((role.user_count || 0) > 0) {
      toast.error(`Cannot delete role assigned to ${role.user_count} user(s)`);
      return;
    }
    if (!confirm(`Delete custom role "${role.label}"? This cannot be undone.`)) return;
    try {
      await api.adminDeleteRole(role.id);
      toast.success('Role deleted successfully');
      loadData();
    } catch (err: any) {
      toast.error(err.message || 'Failed to delete role');
    }
  }

  // --- Gallery handlers ---
  function openEditGalleryModal(item: GalleryItem) {
    setGalleryForm({
      id: item.id, title: item.title, caption: item.caption,
      category: item.category, image_url: item.image_url,
      position: item.position, is_published: item.is_published,
    });
    setShowGalleryModal(true);
  }

  async function uploadGalleryImage(file: File) {
    if (file.size > MAX_PRODUCT_IMAGE_SIZE) {
      toast.error('Image too large — the maximum size is 5 MB');
      return;
    }
    setUploadingGalleryImage(true);
    try {
      const url = await api.uploadGalleryImage(file);
      setGalleryForm((prev) => ({ ...prev, image_url: url }));
      toast.success('Image uploaded');
    } catch (err: any) {
      toast.error(err.message || 'Failed to upload image');
    } finally {
      setUploadingGalleryImage(false);
    }
  }

  async function saveGalleryItem(e: React.FormEvent) {
    e.preventDefault();
    if (!galleryForm.image_url) {
      toast.error('Upload an image first');
      return;
    }
    setSavingGallery(true);
    try {
      const payload = {
        title: galleryForm.title, caption: galleryForm.caption,
        category: galleryForm.category, image_url: galleryForm.image_url,
        position: Number(galleryForm.position) || 0, is_published: galleryForm.is_published,
      };
      if (galleryForm.id) {
        await api.adminUpdateGalleryItem(galleryForm.id, payload);
        toast.success('Gallery item updated');
      } else {
        await api.adminCreateGalleryItem(payload);
        toast.success('Gallery item added');
      }
      setShowGalleryModal(false);
      loadData();
    } catch (err: any) {
      toast.error(err.message || 'Failed to save gallery item');
    } finally {
      setSavingGallery(false);
    }
  }

  async function deleteGalleryItem(item: GalleryItem) {
    if (!confirm(`Remove "${item.title}" from the gallery?`)) return;
    try {
      await api.adminDeleteGalleryItem(item.id);
      toast.success('Gallery item removed');
      loadData();
    } catch (err: any) {
      toast.error(err.message || 'Failed to remove gallery item');
    }
  }

  async function sendTestEmail() {
    setSendingTestEmail(true);
    try {
      const res = await api.adminSendTestEmail();
      toast.success(res.message || 'Test email sent');
    } catch (err: any) {
      toast.error(err.message || 'Test email failed');
    } finally {
      setSendingTestEmail(false);
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
    setActivities([]);
    setActivityForm({ type: 'note', body: '' });
    setPayments([]);
    setPaymentForm(emptyPayment);
    setShowOpportunityModal(true);
  }

  function openEditOpportunityModal(o: Opportunity) {
    setOpportunityForm({
      id: o.id, name: o.name, account_name: o.account_name, contact_name: o.contact_name,
      contact_email: o.contact_email, sector: o.sector, segment: o.segment ?? 'standard', stage: o.stage, grade: o.grade,
      deal_value: o.deal_value, probability: o.probability, owner_id: o.owner_id ?? '',
      expected_close_at: o.expected_close_at ? o.expected_close_at.slice(0, 10) : '', notes: o.notes,
      contacts: (o.contacts ?? []).map((c) => ({ ...c })),
      line_items: (o.line_items ?? []).map((li) => ({ ...li })),
    });
    setActivityForm({ type: 'note', body: '' });
    setPaymentForm(emptyPayment);
    setShowOpportunityModal(true);
    loadActivities(o.id);
    loadPayments(o.id);
  }

  function addLineItem() {
    setOpportunityForm((prev) => ({ ...prev, line_items: [...prev.line_items, { description: '', quantity: 1, unit_price: 0 }] }));
  }
  function updateLineItem(i: number, patch: Partial<OpportunityLineItem>) {
    setOpportunityForm((prev) => ({ ...prev, line_items: prev.line_items.map((li, idx) => (idx === i ? { ...li, ...patch } : li)) }));
  }
  function removeLineItem(i: number) {
    setOpportunityForm((prev) => ({ ...prev, line_items: prev.line_items.filter((_, idx) => idx !== i) }));
  }

  async function loadActivities(opportunityId: string) {
    setActivitiesLoading(true);
    try {
      setActivities(await api.adminListActivities(opportunityId));
    } catch {
      setActivities([]);
    } finally {
      setActivitiesLoading(false);
    }
  }

  async function logActivity(e: React.FormEvent) {
    e.preventDefault();
    if (!opportunityForm.id || !activityForm.body.trim()) return;
    setLoggingActivity(true);
    try {
      await api.adminCreateActivity(opportunityForm.id, { type: activityForm.type, body: activityForm.body.trim() });
      setActivityForm({ type: 'note', body: '' });
      await loadActivities(opportunityForm.id);
    } catch (err: any) {
      toast.error(err.message || 'Failed to log activity');
    } finally {
      setLoggingActivity(false);
    }
  }

  // Expand an account row to show cross-sell/upsell suggestions (collapses on
  // a second click). Results are fetched per account, on demand.
  async function toggleRecommendations(account: string) {
    if (recsAccount === account) {
      setRecsAccount(null);
      setRecs(null);
      return;
    }
    setRecsAccount(account);
    setRecs(null);
    setRecsLoading(true);
    try {
      setRecs(await api.adminAccountRecommendations(account));
    } catch (err: any) {
      toast.error(err.message || 'Failed to load recommendations');
      setRecsAccount(null);
    } finally {
      setRecsLoading(false);
    }
  }

  async function loadPayments(opportunityId: string) {
    try {
      setPayments(await api.adminListPayments(opportunityId));
    } catch {
      setPayments([]);
    }
  }

  async function recordPayment(e: React.FormEvent) {
    e.preventDefault();
    if (!opportunityForm.id || Number(paymentForm.amount) <= 0) return;
    setRecordingPayment(true);
    try {
      await api.adminCreatePayment(opportunityForm.id, {
        amount: Number(paymentForm.amount),
        method: paymentForm.method,
        reference: paymentForm.reference.trim(),
        note: paymentForm.note.trim(),
      });
      setPaymentForm(emptyPayment);
      await loadPayments(opportunityForm.id);
      toast.success('Payment recorded');
    } catch (err: any) {
      toast.error(err.message || 'Failed to record payment');
    } finally {
      setRecordingPayment(false);
    }
  }

  async function deletePayment(id: string) {
    if (!confirm('Remove this payment record?')) return;
    try {
      await api.adminDeletePayment(id);
      if (opportunityForm.id) await loadPayments(opportunityForm.id);
    } catch (err: any) {
      toast.error(err.message || 'Failed to remove payment');
    }
  }

  // Assemble the current modal's form back into an Opportunity for the document
  // generator (line items + contacts as edited, without needing a re-fetch).
  function openDocument(kind: DocumentKind, receiptPayment?: Payment) {
    const opp: Opportunity = {
      id: opportunityForm.id,
      created_at: '', updated_at: '',
      name: opportunityForm.name,
      account_name: opportunityForm.account_name,
      contact_name: opportunityForm.contact_name,
      contact_email: opportunityForm.contact_email,
      sector: opportunityForm.sector,
      segment: opportunityForm.segment,
      stage: opportunityForm.stage,
      grade: opportunityForm.grade,
      deal_value: Number(opportunityForm.deal_value) || 0,
      probability: Number(opportunityForm.probability),
      weighted_value: 0,
      owner_id: opportunityForm.owner_id || null,
      expected_close_at: opportunityForm.expected_close_at ? new Date(opportunityForm.expected_close_at).toISOString() : null,
      notes: opportunityForm.notes,
      contacts: opportunityForm.contacts,
      line_items: opportunityForm.line_items.map((li) => ({ ...li, quantity: Number(li.quantity) || 1, unit_price: Number(li.unit_price) || 0 })),
      line_items_total: opportunityForm.line_items.reduce((s, li) => s + (Number(li.quantity) || 1) * (Number(li.unit_price) || 0), 0),
    };
    setDocState({ kind, opportunity: opp, receiptPayment });
  }

  function addContact() {
    setOpportunityForm((prev) => ({ ...prev, contacts: [...prev.contacts, { name: '', role: 'decision_maker', email: '', is_primary: prev.contacts.length === 0 }] }));
  }
  function updateContact(i: number, patch: Partial<OpportunityContact>) {
    setOpportunityForm((prev) => ({ ...prev, contacts: prev.contacts.map((c, idx) => (idx === i ? { ...c, ...patch } : c)) }));
  }
  function removeContact(i: number) {
    setOpportunityForm((prev) => ({ ...prev, contacts: prev.contacts.filter((_, idx) => idx !== i) }));
  }

  async function saveOpportunity(e: React.FormEvent) {
    e.preventDefault();
    const payload: Partial<Opportunity> = {
      name: opportunityForm.name,
      account_name: opportunityForm.account_name,
      contact_name: opportunityForm.contact_name,
      contact_email: opportunityForm.contact_email,
      sector: opportunityForm.sector,
      segment: opportunityForm.segment,
      stage: opportunityForm.stage,
      grade: opportunityForm.grade,
      deal_value: Number(opportunityForm.deal_value) || 0,
      probability: Number(opportunityForm.probability),
      owner_id: opportunityForm.owner_id || NIL_UUID, // nil UUID = unassign server-side
      expected_close_at: opportunityForm.expected_close_at ? new Date(opportunityForm.expected_close_at).toISOString() : null,
      notes: opportunityForm.notes,
      contacts: opportunityForm.contacts.filter((c) => c.name.trim()),
      line_items: opportunityForm.line_items.filter((li) => li.description.trim()).map((li) => ({ description: li.description, quantity: Number(li.quantity) || 1, unit_price: Number(li.unit_price) || 0 })),
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

  // --- Contract Handlers ---
  // Loads the revision history and read log for a saved contract. Both are
  // best-effort: a contract stays fully editable if either lookup fails.
  async function loadContractHistory(id: string) {
    setContractHistoryLoading(true);
    try {
      const [versions, access] = await Promise.all([
        api.adminContractVersions(id),
        api.adminContractAccessLog(id),
      ]);
      setContractVersions(versions);
      setContractAccessLog(access);
    } catch {
      setContractVersions([]);
      setContractAccessLog([]);
    } finally {
      setContractHistoryLoading(false);
    }
  }
  function openCreateContractModal() {
    setContractForm(emptyContract);
    setContractFile(null);
    setContractVersions([]);
    setContractAccessLog([]);
    setShowContractModal(true);
  }
  function openEditContractModal(ct: Contract) {
    setContractForm({
      id: ct.id, account_name: ct.account_name, opportunity_id: ct.opportunity_id ?? '', title: ct.title,
      status: ct.status, value: ct.value,
      start_date: ct.start_date ? ct.start_date.slice(0, 10) : '',
      renewal_date: ct.renewal_date ? ct.renewal_date.slice(0, 10) : '',
      notes: ct.notes,
    });
    setContractFile(null);
    setContractVersions([]);
    setContractAccessLog([]);
    void loadContractHistory(ct.id);
    setShowContractModal(true);
  }
  async function saveContract(e: React.FormEvent) {
    e.preventDefault();
    if (contractFile && contractFile.size > MAX_SUBMISSION_FILE_SIZE) {
      toast.error('File is too large. Maximum size is 15 MB.');
      return;
    }
    setSavingContract(true);
    const payload = {
      account_name: contractForm.account_name,
      opportunity_id: contractForm.opportunity_id || NIL_UUID,
      title: contractForm.title,
      status: contractForm.status,
      value: Number(contractForm.value) || 0,
      start_date: contractForm.start_date ? new Date(contractForm.start_date).toISOString() : null,
      renewal_date: contractForm.renewal_date ? new Date(contractForm.renewal_date).toISOString() : null,
      clear_renewal: !contractForm.renewal_date,
      notes: contractForm.notes,
    };
    try {
      let id = contractForm.id;
      if (id) {
        await api.adminUpdateContract(id, payload);
      } else {
        const created = await api.adminCreateContract(payload);
        id = created.id;
      }
      if (contractFile) {
        await api.uploadContractFile(id, contractFile);
      }
      toast.success(contractForm.id ? 'Contract updated' : 'Contract created');
      setShowContractModal(false);
      setContracts(await api.adminListContracts());
    } catch (err: any) {
      toast.error(err.message || 'Failed to save contract');
    } finally {
      setSavingContract(false);
    }
  }
  async function deleteContract(id: string) {
    if (!confirm('Delete this contract? This cannot be undone.')) return;
    try {
      await api.adminDeleteContract(id);
      toast.success('Contract deleted');
      setShowContractModal(false);
      setContracts(await api.adminListContracts());
    } catch (err: any) {
      toast.error(err.message || 'Failed to delete contract');
    }
  }
  async function downloadContract(ct: Contract) {
    setDownloadingContractId(ct.id);
    try {
      await api.downloadContract(ct.id, ct.file_name || 'contract');
    } catch (err: any) {
      toast.error(err.message || 'Failed to download contract');
    } finally {
      setDownloadingContractId(null);
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
          {(([
            ['overview', 'Overview', Settings, true],
            ['pipeline', 'Sales Pipeline', Target, can('opportunities')],
            ['accounts', 'Accounts & VSI', Building2, can('accounts')],
            ['contracts', 'Contracts', ScrollText, can('contracts')],
            ['enrollments', 'Enrollments', UserPlus, can('enrollments')],
            ['students', 'Students Portal', GraduationCap, can('students')],
            ['events', 'Events Manager', Calendar, can('events')],
            ['products', 'Products', CheckSquare, can('products')],
            ['gallery', 'Gallery', ImageIcon, can('gallery')],
            ['users', 'Users & Email', Users, can('users')],
            ['audit', 'Audit Log', History, canViewAudit],
          ] as [Tab, string, typeof Settings, boolean][])
            .filter(([, , , allowed]) => allowed))
            .map(([tab, label, Icon]) => (
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
              {activeTab === 'accounts' && 'Accounts & Vertical Sales Index'}
              {activeTab === 'contracts' && 'Contract Repository'}
              {activeTab === 'enrollments' && 'Innovation Hub Intake'}
              {activeTab === 'students' && 'Student Capstone Milestones'}
              {activeTab === 'events' && 'Public Programs & Events'}
              {activeTab === 'products' && 'Product Inventory Manager'}
              {activeTab === 'audit' && 'Audit Trail'}
              {activeTab === 'users' && 'Users & Email Delivery'}
              {activeTab === 'gallery' && 'Work Gallery'}
            </h1>
          </div>
          {activeTab === 'pipeline' && can('opportunities', 'create') && (
            <button onClick={openCreateOpportunityModal} className="primary" style={{ minHeight: '40px' }}>
              <Plus size={16} /> New Opportunity
            </button>
          )}
          {activeTab === 'enrollments' && can('enrollments', 'create') && (
            <button onClick={() => { setEnrollmentForm(emptyEnrollmentForm); setShowEnrollmentModal(true); }} className="primary" style={{ minHeight: '40px' }}>
              <Plus size={16} /> New Enrollment
            </button>
          )}
          {activeTab === 'gallery' && can('gallery', 'create') && (
            <button onClick={() => { setGalleryForm(emptyGalleryItem); setShowGalleryModal(true); }} className="primary" style={{ minHeight: '40px' }}>
              <Plus size={16} /> New Gallery Item
            </button>
          )}
          {activeTab === 'users' && can('users', 'create') && (
            <button onClick={() => { setUserForm(emptyUser); setShowUserModal(true); }} className="primary" style={{ minHeight: '40px' }}>
              <Plus size={16} /> New Staff User
            </button>
          )}
          {activeTab === 'contracts' && can('contracts', 'create') && (
            <button onClick={openCreateContractModal} className="primary" style={{ minHeight: '40px' }}>
              <Plus size={16} /> New Contract
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
        ) : activeTab === 'accounts' || activeTab === 'contracts' || activeTab === 'audit' || activeTab === 'users' || activeTab === 'gallery' ? null : (
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
                          disabled={!can('quotes', 'update')}
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
                          disabled={!can('quotes', 'update')}
                          className="primary"
                          style={{ minHeight: '36px', fontSize: '12px', padding: '0 16px' }}
                        >
                          Save CRM Notes
                        </button>
                        <button
                          onClick={() => convertQuote(selectedQuote)}
                          disabled={selectedQuote.status === 'converted' || !can('quotes', 'create')}
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
                          disabled={!can('enrollments', 'update')}
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
                          disabled={!can('enrollments', 'update')}
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
                        {can('enrollments', 'create') && (
                          <button
                            onClick={() => generateInviteLink(item)}
                            className="primary"
                            style={{ minHeight: '34px', fontSize: '12px', padding: '0 12px', background: 'var(--accent)', color: '#11170e' }}
                          >
                            <UserPlus size={14} /> Invite Link
                          </button>
                        )}
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
                                <button onClick={() => saveMilestoneUpdate(m.id)} disabled={!can('students', 'update')} className="primary" style={{ minHeight: '32px', fontSize: '12px', padding: '0 12px', borderRadius: '4px', border: 0 }}>Save</button>
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
                      <button type="submit" disabled={!can('students', 'create')} className="primary" style={{ width: '44px', minHeight: '44px', padding: 0 }}>
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
                                  <button onClick={() => markReportReviewed(r.id)} disabled={!can('students', 'update')} className="primary" style={{ minHeight: '32px', fontSize: '12px', padding: '0 12px', borderRadius: '4px', border: 0 }}>Mark reviewed</button>
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
                                  <button onClick={() => decideExtension(ext.id, 'denied')} disabled={!can('students', 'update')} style={{ background: '#ffe2e2', color: '#a00', minHeight: '32px', fontSize: '12px', padding: '0 12px', borderRadius: '4px', border: 0, display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                                    <ThumbsDown size={12} /> Deny
                                  </button>
                                  <button onClick={() => decideExtension(ext.id, 'approved')} disabled={!can('students', 'update')} className="primary" style={{ minHeight: '32px', fontSize: '12px', padding: '0 12px', borderRadius: '4px', border: 0, display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
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
                                      <button onClick={() => reviewSubmission(latest.id, 'revise')} disabled={!can('students', 'update')} style={{ background: '#ffe2e2', color: '#a00', minHeight: '32px', fontSize: '12px', padding: '0 12px', borderRadius: '4px', border: 0, display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                                        <ThumbsDown size={12} /> Request Revision
                                      </button>
                                      <button onClick={() => reviewSubmission(latest.id, 'accepted')} disabled={!can('students', 'update')} className="primary" style={{ minHeight: '32px', fontSize: '12px', padding: '0 12px', borderRadius: '4px', border: 0, display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
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
                {can('events', 'create') && (
                  <button onClick={openCreateEventModal} className="primary" style={{ minHeight: '36px', fontSize: '12px', padding: '0 12px' }}>
                    <Plus size={14} /> New Event
                  </button>
                )}
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
                        {can('events', 'update') && (
                          <button onClick={() => openEditEventModal(selectedEvent)} style={{ background: '#eef0ea', border: 0, padding: 6, borderRadius: '4px', cursor: 'pointer' }}><Edit2 size={14} /></button>
                        )}
                        {can('events', 'delete') && (
                          <button onClick={() => deleteEvent(selectedEvent.id)} style={{ background: '#ffe2e2', color: '#a00', border: 0, padding: 6, borderRadius: '4px', cursor: 'pointer' }}><Trash2 size={14} /></button>
                        )}
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
                      {can('events', 'create') && (
                        <button onClick={() => setShowBroadcastModal(true)} className="primary" style={{ minHeight: '32px', fontSize: '12px', padding: '0 12px' }}>
                          <Mail size={14} /> Send Broadcast
                        </button>
                      )}
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
                              {res.status === 'pending' && can('events', 'update') && (
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
                {can('products', 'create') && (
                  <button onClick={openCreateProductModal} className="primary" style={{ minHeight: '36px', fontSize: '12px', padding: '0 12px' }}>
                    <Plus size={14} /> New Product
                  </button>
                )}
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
                      {can('products', 'update') && (
                        <button onClick={() => openEditProductModal(selectedProduct)} style={{ background: '#eef0ea', border: 0, padding: 6, borderRadius: '4px', cursor: 'pointer' }}><Edit2 size={14} /></button>
                      )}
                      {can('products', 'delete') && (
                        <button onClick={() => deleteProduct(selectedProduct.id)} style={{ background: '#ffe2e2', color: '#a00', border: 0, padding: 6, borderRadius: '4px', cursor: 'pointer' }}><Trash2 size={14} /></button>
                      )}
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
                              <div style={{ display: 'flex', gap: '4px', flexShrink: 0, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                                {o.segment && o.segment !== 'standard' && (
                                  <span style={{ fontSize: '10px', fontWeight: 800, textTransform: 'uppercase', padding: '2px 7px', borderRadius: '10px', background: SEGMENT_STYLES[o.segment].bg, color: SEGMENT_STYLES[o.segment].fg }}>{SEGMENT_STYLES[o.segment].label}</span>
                                )}
                                <span style={{ fontSize: '10px', fontWeight: 800, textTransform: 'uppercase', padding: '2px 7px', borderRadius: '10px', background: grade.bg, color: grade.fg }}>{grade.label}</span>
                              </div>
                            </div>
                            {o.account_name && <div style={{ fontSize: '12px', color: '#5a625d' }}>{o.account_name}{o.sector ? ` · ${o.sector}` : ''}</div>}
                            {o.contacts && o.contacts.length > 0 && (
                              <div style={{ fontSize: '11px', color: '#8a908a' }}>{o.contacts.length} stakeholder{o.contacts.length === 1 ? '' : 's'}</div>
                            )}
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
                              disabled={!can('opportunities', 'update')}
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

        {/* Accounts & VSI Tab */}
        {activeTab === 'accounts' && (() => {
          const sectors = accountsIndex?.sectors ?? [];
          const accountsList = accountsIndex?.accounts ?? [];
          const maxSector = sectors[0]?.total_value || 1;
          return (
            <div style={{ display: 'grid', gap: '28px' }}>
              {/* Vertical Sales Index — sectors ranked */}
              <section className="data-section" style={{ marginTop: 0 }}>
                <h2>Vertical Sales Index</h2>
                <p style={{ marginBottom: '16px' }}>Revenue ranked by sector — closed-won plus live pipeline, derived from the opportunity pipeline.</p>
                {sectors.length === 0 ? (
                  <p className="empty">No sector data yet — set a sector on opportunities in the pipeline and they'll rank here.</p>
                ) : (
                  <div style={{ display: 'grid', gap: '10px' }}>
                    {sectors.map((s, i) => (
                      <article key={s.sector} className="panel" style={{ padding: '14px 16px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: '10px', marginBottom: '8px' }}>
                          <strong style={{ color: '#111512', fontSize: '15px' }}><span style={{ color: '#8a908a' }}>#{i + 1}</span> {s.sector}</strong>
                          <strong style={{ color: '#111512', fontSize: '15px' }}>{ZMW(s.total_value)}</strong>
                        </div>
                        <div style={{ height: '8px', background: '#e7eae2', borderRadius: '999px', overflow: 'hidden', marginBottom: '10px' }}>
                          <div style={{ width: `${Math.max(2, (s.total_value / maxSector) * 100)}%`, height: '100%', background: 'var(--accent)' }} />
                        </div>
                        <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap', fontSize: '12px', color: '#5a625d' }}>
                          <span>{s.account_count} account{s.account_count === 1 ? '' : 's'}</span>
                          <span>{s.deal_count} deal{s.deal_count === 1 ? '' : 's'}</span>
                          <span>Won <strong style={{ color: '#35520f' }}>{ZMW(s.won_value)}</strong></span>
                          <span>Open {ZMW(s.open_value)}</span>
                          <span>Weighted {ZMW(s.weighted_value)}</span>
                        </div>
                      </article>
                    ))}
                  </div>
                )}
              </section>

              {/* Top accounts ranked */}
              <section className="data-section" style={{ marginTop: 0 }}>
                <h2>Top Accounts</h2>
                <p style={{ marginBottom: '16px' }}>Accounts ranked by total value (open pipeline + closed-won). Click an account for cross-sell &amp; upsell suggestions.</p>
                {accountsList.length === 0 ? (
                  <p className="empty">No accounts yet — set an account name on opportunities in the pipeline.</p>
                ) : (
                  <div style={{ overflowX: 'auto', border: '1px solid #d6d8d0', borderRadius: '8px', background: '#fff' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: '760px', fontSize: '13px', color: '#111512' }}>
                      <thead>
                        <tr style={{ textAlign: 'left', color: '#5a625d', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.03em' }}>
                          <th style={{ padding: '12px 14px' }}>Account</th>
                          <th style={{ padding: '12px 14px' }}>Sector</th>
                          <th style={{ padding: '12px 14px' }}>Segment</th>
                          <th style={{ padding: '12px 14px' }}>Grade</th>
                          <th style={{ padding: '12px 14px', textAlign: 'right' }}>Open deals</th>
                          <th style={{ padding: '12px 14px', textAlign: 'right' }}>Weighted</th>
                          <th style={{ padding: '12px 14px', textAlign: 'right' }}>Won</th>
                          <th style={{ padding: '12px 14px', textAlign: 'right' }}>Total</th>
                        </tr>
                      </thead>
                      <tbody>
                        {accountsList.map((a) => {
                          const grade = a.top_grade ? GRADE_STYLES[a.top_grade] : null;
                          const expanded = recsAccount === a.account;
                          return (
                            <Fragment key={a.account}>
                            <tr onClick={() => toggleRecommendations(a.account)} style={{ borderTop: '1px solid #eceee7', cursor: 'pointer', background: expanded ? '#f7f8f3' : undefined }}>
                              <td style={{ padding: '12px 14px', fontWeight: 700 }}>
                                <span style={{ color: '#8a908a', marginRight: '6px' }}>{expanded ? '▾' : '▸'}</span>{a.account}
                              </td>
                              <td style={{ padding: '12px 14px', color: '#5a625d' }}>{a.sector}</td>
                              <td style={{ padding: '12px 14px' }}>
                                {a.segment && SEGMENT_STYLES[a.segment] ? <span style={{ fontSize: '10px', fontWeight: 800, textTransform: 'uppercase', padding: '2px 7px', borderRadius: '10px', background: SEGMENT_STYLES[a.segment].bg, color: SEGMENT_STYLES[a.segment].fg }}>{SEGMENT_STYLES[a.segment].label}</span> : '—'}
                              </td>
                              <td style={{ padding: '12px 14px' }}>
                                {grade ? <span style={{ fontSize: '10px', fontWeight: 800, textTransform: 'uppercase', padding: '2px 7px', borderRadius: '10px', background: grade.bg, color: grade.fg }}>{grade.label}</span> : '—'}
                              </td>
                              <td style={{ padding: '12px 14px', textAlign: 'right' }}>{a.open_count}</td>
                              <td style={{ padding: '12px 14px', textAlign: 'right', color: '#5f7c29' }}>{ZMW(a.weighted_value)}</td>
                              <td style={{ padding: '12px 14px', textAlign: 'right' }}>{ZMW(a.won_value)}</td>
                              <td style={{ padding: '12px 14px', textAlign: 'right', fontWeight: 800 }}>{ZMW(a.total_value)}</td>
                            </tr>
                            {expanded && (
                              <tr style={{ background: '#f7f8f3' }}>
                                <td colSpan={8} style={{ padding: '0 14px 16px' }}>
                                  {recsLoading ? (
                                    <p style={{ fontSize: '13px', color: '#8a908a', margin: '10px 0' }}>Analysing account…</p>
                                  ) : !recs || recs.recommendations.length === 0 ? (
                                    <p style={{ fontSize: '13px', color: '#8a908a', margin: '10px 0' }}>No suggestions — the catalogue has nothing new to offer this account yet.</p>
                                  ) : (
                                    <div>
                                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', margin: '6px 0 10px' }}>
                                        <Sparkles size={14} color="#5f7c29" />
                                        <strong style={{ fontSize: '13px', color: '#111512' }}>Cross-sell &amp; upsell suggestions</strong>
                                        <span style={{ fontSize: '11px', color: '#8a908a' }}>
                                          {recs.source.startsWith('anthropic') ? 'AI-assisted rationale' : 'heuristic ranking'}
                                        </span>
                                      </div>
                                      <div style={{ display: 'grid', gap: '8px' }}>
                                        {recs.recommendations.map((r) => (
                                          <div key={r.slug} style={{ background: '#fff', border: '1px solid #dfe1da', borderRadius: '6px', padding: '10px 12px', display: 'flex', gap: '12px', alignItems: 'flex-start' }}>
                                            <div style={{ flexShrink: 0, minWidth: '46px', textAlign: 'center' }}>
                                              <div style={{ fontSize: '17px', fontWeight: 900, color: r.probability >= 65 ? '#35520f' : r.probability >= 45 ? '#8a6d1a' : '#8a908a' }}>{r.probability}%</div>
                                              <div style={{ fontSize: '9px', color: '#8a908a', textTransform: 'uppercase' }}>fit</div>
                                            </div>
                                            <div style={{ flex: 1, minWidth: 0 }}>
                                              <div style={{ display: 'flex', gap: '8px', alignItems: 'baseline', flexWrap: 'wrap' }}>
                                                <strong style={{ fontSize: '13px', color: '#111512' }}>{r.name}</strong>
                                                <span style={{ fontSize: '10px', fontWeight: 800, textTransform: 'uppercase', padding: '2px 7px', borderRadius: '10px', background: r.kind === 'upsell' ? '#e7dff2' : '#e2ecf8', color: r.kind === 'upsell' ? '#5b3a8a' : '#2a5788' }}>
                                                  {r.kind === 'upsell' ? 'Upsell' : 'Cross-sell'}
                                                </span>
                                                {r.price > 0 && <span style={{ fontSize: '12px', color: '#5a625d' }}>{ZMW(r.price)}</span>}
                                              </div>
                                              {r.rationale && <p style={{ margin: '3px 0 0', fontSize: '12px', color: '#3a403b' }}>{r.rationale}</p>}
                                            </div>
                                          </div>
                                        ))}
                                      </div>
                                    </div>
                                  )}
                                </td>
                              </tr>
                            )}
                            </Fragment>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </section>
            </div>
          );
        })()}

        {/* Contracts Tab */}
        {activeTab === 'contracts' && (
          <section className="data-section" style={{ marginTop: 0 }}>
            <p style={{ marginBottom: '16px' }}>Store agreements, track renewals, and download signed documents. Renewals due within {RENEWAL_SOON_DAYS} days are flagged.</p>
            {contracts.length === 0 ? (
              <p className="empty">No contracts yet — click “New Contract” to add one.</p>
            ) : (
              <div style={{ display: 'grid', gap: '12px' }}>
                {contracts.map((ct) => {
                  const rs = renewalState(ct.renewal_date);
                  const st = CONTRACT_STATUS_STYLES[ct.status];
                  return (
                    <article key={ct.id} onClick={() => openEditContractModal(ct)} style={{ padding: '16px', background: '#fff', border: '1px solid #dfe1da', borderLeft: `4px solid ${rs === 'overdue' ? '#a00' : rs === 'soon' ? '#c98745' : '#d6d8d0'}`, borderRadius: '8px', cursor: 'pointer', display: 'grid', gap: '8px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', gap: '10px', alignItems: 'flex-start' }}>
                        <div>
                          <strong style={{ fontSize: '15px', color: '#111512' }}>{ct.title}</strong>
                          {ct.account_name && <div style={{ fontSize: '12px', color: '#5a625d', marginTop: '2px' }}>{ct.account_name}</div>}
                        </div>
                        <span style={{ flexShrink: 0, fontSize: '10px', fontWeight: 800, textTransform: 'uppercase', padding: '3px 8px', borderRadius: '10px', background: st.bg, color: st.fg }}>{ct.status}</span>
                      </div>
                      <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap', fontSize: '12px', color: '#5a625d', alignItems: 'center' }}>
                        {ct.value > 0 && <span><strong style={{ color: '#111512' }}>{ZMW(ct.value)}</strong></span>}
                        {ct.renewal_date && (
                          <span style={{ color: rs === 'overdue' ? '#a00' : rs === 'soon' ? '#c98745' : '#5a625d', fontWeight: rs === 'ok' || rs === 'none' ? 400 : 700, display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                            <Clock size={12} /> Renews {new Date(ct.renewal_date).toLocaleDateString()}{rs === 'overdue' ? ' · overdue' : rs === 'soon' ? ' · due soon' : ''}
                          </span>
                        )}
                        {ct.has_file ? (
                          <button
                            onClick={(e) => { e.stopPropagation(); downloadContract(ct); }}
                            disabled={downloadingContractId === ct.id}
                            style={{ background: '#eef0ea', color: '#111512', minHeight: '28px', fontSize: '11px', padding: '0 10px', borderRadius: '4px', border: 0, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                          >
                            <Download size={11} /> {downloadingContractId === ct.id ? 'Downloading...' : ct.file_name || 'Download'}
                          </button>
                        ) : (
                          <span style={{ color: '#b0b4ab' }}>No file attached</span>
                        )}
                      </div>
                    </article>
                  );
                })}
              </div>
            )}
          </section>
        )}

        {/* Audit Log Tab */}
        {activeTab === 'audit' && (
          <section className="data-section" style={{ marginTop: 0 }}>
            <p style={{ marginBottom: '16px' }}>Immutable trail of admin changes — who did what, and when. Showing the {auditLogs.length} most recent {auditLogs.length === 1 ? 'entry' : 'entries'}.</p>
            {auditLogs.length === 0 ? (
              <p className="empty">No audit entries yet — changes made in the portal will appear here.</p>
            ) : (
              <div style={{ display: 'grid', gap: '8px' }}>
                {auditLogs.map((a) => {
                  const st = auditActionStyle(a.action);
                  return (
                    <article key={a.id} style={{ padding: '12px 14px', background: '#fff', border: '1px solid #dfe1da', borderRadius: '8px', display: 'flex', gap: '12px', alignItems: 'center', flexWrap: 'wrap' }}>
                      <span style={{ flexShrink: 0, minWidth: '74px', textAlign: 'center', fontSize: '10px', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.03em', padding: '4px 8px', borderRadius: '10px', background: st.bg, color: st.fg }}>{a.action}</span>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: '13px', color: '#111512' }}>
                          <strong>{a.actor_name || 'Unknown'}</strong>
                          {a.actor_role && <span style={{ color: '#8a908a' }}> ({a.actor_role})</span>}
                          <span style={{ color: '#5a625d' }}> · {a.entity}{a.entity_id ? ` · ${a.entity_id.slice(0, 8)}` : ''}</span>
                        </div>
                        <div style={{ fontSize: '11px', color: '#8a908a', marginTop: '2px', fontFamily: 'monospace' }}>{a.method} {a.path} → {a.status}</div>
                      </div>
                      <span style={{ flexShrink: 0, fontSize: '11px', color: '#8a908a' }}>{new Date(a.created_at).toLocaleString()}</span>
                    </article>
                  );
                })}
              </div>
            )}
          </section>
        )}

        {/* Gallery Tab */}
        {activeTab === 'gallery' && (
          <section className="data-section" style={{ marginTop: 0 }}>
            <p style={{ marginBottom: '16px' }}>
              Photos of Arcus's work, shown in the Gallery section of the public site. Lower position numbers appear first. Unpublished items stay hidden from visitors.
            </p>
            {gallery.length === 0 ? (
              <p className="empty">No gallery items yet — add one and it replaces the built-in placeholder photos on the public site.</p>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: '16px' }}>
                {gallery.map((item) => (
                  <article key={item.id} style={{ background: '#fff', border: '1px solid #dfe1da', borderRadius: '8px', overflow: 'hidden', display: 'grid', gap: 0, opacity: item.is_published ? 1 : 0.55, minWidth: 0 }}>
                    <img src={item.image_url} alt={item.title} style={{ width: '100%', height: '150px', objectFit: 'cover', display: 'block', background: '#eceee7' }} />
                    <div style={{ padding: '12px', display: 'grid', gap: '6px', minWidth: 0 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', gap: '8px', alignItems: 'flex-start' }}>
                        <strong style={{ fontSize: '14px', color: '#111512', minWidth: 0 }}>{item.title}</strong>
                        <span style={{ flexShrink: 0, fontSize: '10px', fontWeight: 800, textTransform: 'uppercase', padding: '2px 7px', borderRadius: '10px', background: item.is_published ? '#e8f2dc' : '#eceee7', color: item.is_published ? '#35520f' : '#5a625d' }}>
                          {item.is_published ? 'Live' : 'Draft'}
                        </span>
                      </div>
                      <div style={{ fontSize: '12px', color: '#5a625d' }}>{item.category} · position {item.position}</div>
                      {item.caption && <p style={{ margin: 0, fontSize: '12px', color: '#5a625d' }}>{item.caption}</p>}
                      <div style={{ display: 'flex', gap: '6px', marginTop: '2px' }}>
                        {can('gallery', 'update') && (
                          <button onClick={() => openEditGalleryModal(item)} style={{ background: '#eef0ea', border: '1px solid #dfe1da', borderRadius: '4px', padding: '6px 10px', fontSize: '11px', color: '#111512', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                            <Edit2 size={12} /> Edit
                          </button>
                        )}
                        {can('gallery', 'delete') && (
                          <button onClick={() => deleteGalleryItem(item)} title="Remove" style={{ background: '#fff', border: '1px solid #e2b4b4', borderRadius: '4px', padding: '6px', color: '#a00', cursor: 'pointer', display: 'inline-flex' }}>
                            <Trash2 size={12} />
                          </button>
                        )}
                      </div>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </section>
        )}

        {/* Users & Email Tab */}
        {activeTab === 'users' && (
          <div style={{ display: 'grid', gap: '28px' }}>
            {/* Roles & Custom RBAC */}
            {can('roles') && (
              <section className="data-section" style={{ marginTop: 0 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px', flexWrap: 'wrap', gap: '12px' }}>
                  <div>
                    <h2 style={{ margin: 0 }}>Roles & Access Control</h2>
                    <p style={{ margin: '4px 0 0', fontSize: '13px', color: '#5a625d' }}>
                      Define role permissions across system resources. Built-in roles map to system defaults; custom roles can tailor row-level scope and CRUD actions.
                    </p>
                  </div>
                  {can('roles', 'create') && (
                    <button onClick={openCreateRoleModal} className="primary" style={{ minHeight: '38px', fontSize: '13px' }}>
                      <Plus size={14} /> New Custom Role
                    </button>
                  )}
                </div>

                {roles.length === 0 ? (
                  <p className="empty">No roles loaded.</p>
                ) : (
                  <div style={{ overflowX: 'auto', border: '1px solid #d6d8d0', borderRadius: '8px', background: '#fff' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: '720px', fontSize: '13px', color: '#111512' }}>
                      <thead>
                        <tr style={{ textAlign: 'left', color: '#5a625d', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.03em' }}>
                          <th style={{ padding: '12px 14px' }}>Role</th>
                          <th style={{ padding: '12px 14px' }}>Slug</th>
                          <th style={{ padding: '12px 14px' }}>Type</th>
                          <th style={{ padding: '12px 14px' }}>Assigned Users</th>
                          <th style={{ padding: '12px 14px' }}>Description</th>
                          <th style={{ padding: '12px 14px', textAlign: 'right' }}>Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {roles.map((r) => {
                          const isSuperAdmin = r.name === 'super_admin';
                          const rs = ROLE_STYLES[r.name] ?? { bg: '#e2ecf8', fg: '#2a5788', label: r.label };
                          return (
                            <tr key={r.id} style={{ borderTop: '1px solid #eceee7' }}>
                              <td style={{ padding: '12px 14px', fontWeight: 700 }}>
                                <span style={{ fontSize: '11px', fontWeight: 800, textTransform: 'uppercase', padding: '3px 8px', borderRadius: '10px', background: rs.bg, color: rs.fg }}>
                                  {r.label}
                                </span>
                              </td>
                              <td style={{ padding: '12px 14px', color: '#5a625d', fontFamily: 'monospace', fontSize: '12px' }}>{r.name}</td>
                              <td style={{ padding: '12px 14px' }}>
                                <span style={{ fontSize: '10px', fontWeight: 700, padding: '2px 6px', borderRadius: '4px', background: r.is_built_in ? '#eceee7' : '#e8f2dc', color: r.is_built_in ? '#5a625d' : '#35520f' }}>
                                  {r.is_built_in ? 'Built-in' : 'Custom'}
                                </span>
                              </td>
                              <td style={{ padding: '12px 14px', color: '#5a625d' }}>
                                {r.user_count ?? 0} user(s)
                              </td>
                              <td style={{ padding: '12px 14px', color: '#5a625d', fontSize: '12px', maxWidth: '280px' }}>
                                {r.description || '—'}
                              </td>
                              <td style={{ padding: '12px 14px', textAlign: 'right' }}>
                                <div style={{ display: 'inline-flex', gap: '6px', alignItems: 'center' }}>
                                  {isSuperAdmin ? (
                                    <span style={{ fontSize: '11px', color: '#8a908a', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                                      <Lock size={12} /> Locked
                                    </span>
                                  ) : (
                                    <>
                                      {can('roles', 'update') && (
                                        <button onClick={() => openEditRoleModal(r)} style={{ background: '#fff', border: '1px solid #dfe1da', borderRadius: '4px', padding: '6px 10px', fontSize: '11px', color: '#111512', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                                          <Edit2 size={12} /> Edit Grants
                                        </button>
                                      )}
                                      {!r.is_built_in && can('roles', 'delete') && (
                                        <button
                                          onClick={() => deleteRole(r)}
                                          disabled={(r.user_count || 0) > 0}
                                          title={(r.user_count || 0) > 0 ? `Cannot delete role assigned to ${r.user_count} user(s)` : 'Delete role'}
                                          style={{ background: '#fff', border: '1px solid #e2b4b4', borderRadius: '4px', padding: '6px', color: (r.user_count || 0) > 0 ? '#ccc' : '#a00', cursor: (r.user_count || 0) > 0 ? 'not-allowed' : 'pointer', display: 'inline-flex' }}
                                        >
                                          <Trash2 size={13} />
                                        </button>
                                      )}
                                    </>
                                  )}
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </section>
            )}

            {/* Email delivery status */}
            <section className="data-section" style={{ marginTop: 0 }}>
              <h2>Email Delivery</h2>
              <p style={{ marginBottom: '16px' }}>Onboarding invitations and event broadcasts are sent over the Resend API or SMTP, whichever is configured. Send a test to your own address to prove delivery without emailing students.</p>
              {!emailStatus ? (
                <p style={{ fontSize: '13px', color: '#8a908a' }}>Checking…</p>
              ) : (
                <article className="panel" style={{ padding: '16px', display: 'grid', gap: '12px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                    <span style={{ fontSize: '11px', fontWeight: 800, textTransform: 'uppercase', padding: '4px 10px', borderRadius: '10px', background: emailStatus.looks_healthy ? '#e8f2dc' : '#ffe2e2', color: emailStatus.looks_healthy ? '#35520f' : '#a00' }}>
                      {emailStatus.configured ? (emailStatus.looks_healthy ? 'Configured' : 'Needs attention') : 'Not configured'}
                    </span>
                    {emailStatus.configured && (
                      <span style={{ fontSize: '11px', fontWeight: 800, textTransform: 'uppercase', padding: '4px 10px', borderRadius: '10px', background: '#eef0ea', color: '#5a625d' }}>
                        via {emailStatus.transport === 'resend' ? 'Resend API' : 'SMTP'}
                      </span>
                    )}
                    <button onClick={sendTestEmail} disabled={sendingTestEmail || !emailStatus.configured} style={{ background: '#eef0ea', border: '1px solid #dfe1da', borderRadius: '6px', padding: '8px 14px', fontSize: '13px', color: '#111512', cursor: emailStatus.configured ? 'pointer' : 'not-allowed', opacity: emailStatus.configured ? 1 : 0.5, display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                      <Mail size={14} /> {sendingTestEmail ? 'Sending…' : 'Send test email to myself'}
                    </button>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '10px', fontSize: '12px', color: '#5a625d' }}>
                    {/* SMTP host/port/credentials are inert when the API transport is
                        in use, so showing them would only invite false diagnoses. */}
                    {emailStatus.transport === 'resend' ? (
                      <>
                        <span>Transport: <strong style={{ color: '#111512' }}>Resend HTTPS API</strong></span>
                        <span>API key: <strong style={{ color: '#111512' }}>{emailStatus.has_api_key ? 'set' : 'not set'}</strong></span>
                      </>
                    ) : (
                      <>
                        <span>Host: <strong style={{ color: '#111512' }}>{emailStatus.host || '— not set —'}</strong></span>
                        <span>Port: <strong style={{ color: '#111512' }}>{emailStatus.port || '— not set —'}</strong></span>
                        <span>Username: <strong style={{ color: '#111512' }}>{emailStatus.has_username ? 'set' : 'not set'}</strong></span>
                        <span>Password: <strong style={{ color: '#111512' }}>{emailStatus.has_password ? 'set' : 'not set'}</strong></span>
                      </>
                    )}
                    <span>From: <strong style={{ color: '#111512' }}>{emailStatus.from || '— not set —'}</strong></span>
                    <span>Claim-link base: <strong style={{ color: '#111512' }}>{emailStatus.frontend_url || '— not set —'}</strong></span>
                  </div>
                  {(emailStatus.issues ?? []).length > 0 && (
                    <ul style={{ margin: 0, paddingLeft: '18px', display: 'grid', gap: '4px' }}>
                      {(emailStatus.issues ?? []).map((issue) => (
                        <li key={issue} style={{ fontSize: '12px', color: '#a00' }}>{issue}</li>
                      ))}
                    </ul>
                  )}
                </article>
              )}
            </section>

            {/* All user accounts */}
            <section className="data-section" style={{ marginTop: 0 }}>
              <h2>User Accounts</h2>
              <p style={{ marginBottom: '16px' }}>Every account in the system. Students are created by claiming an onboarding invite; staff are created here. Deleting a student clears their capstone data and reopens the enrollment for re-invitation.</p>
              {users.length === 0 ? (
                <p className="empty">No users found.</p>
              ) : (
                <div style={{ overflowX: 'auto', border: '1px solid #d6d8d0', borderRadius: '8px', background: '#fff' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: '760px', fontSize: '13px', color: '#111512' }}>
                    <thead>
                      <tr style={{ textAlign: 'left', color: '#5a625d', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.03em' }}>
                        <th style={{ padding: '12px 14px' }}>Name</th>
                        <th style={{ padding: '12px 14px' }}>Email</th>
                        <th style={{ padding: '12px 14px' }}>Role</th>
                        <th style={{ padding: '12px 14px' }}>Status</th>
                        <th style={{ padding: '12px 14px' }}>Created</th>
                        <th style={{ padding: '12px 14px', textAlign: 'right' }}>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {users.map((u) => {
                        const rs = ROLE_STYLES[u.role] ?? { bg: '#eceee7', fg: '#5a625d', label: u.role };
                        const isSelf = u.id === user?.id;
                        return (
                          <tr key={u.id} style={{ borderTop: '1px solid #eceee7', opacity: u.is_active ? 1 : 0.55 }}>
                            <td style={{ padding: '12px 14px', fontWeight: 700 }}>
                              {u.full_name}{isSelf && <span style={{ fontSize: '11px', color: '#8a908a', fontWeight: 400 }}> (you)</span>}
                            </td>
                            <td style={{ padding: '12px 14px', color: '#5a625d' }}>{u.email}</td>
                            <td style={{ padding: '12px 14px' }}>
                              <span style={{ fontSize: '10px', fontWeight: 800, textTransform: 'uppercase', padding: '2px 7px', borderRadius: '10px', background: rs.bg, color: rs.fg }}>{rs.label}</span>
                            </td>
                            <td style={{ padding: '12px 14px', color: u.is_active ? '#35520f' : '#a00' }}>{u.is_active ? 'Active' : 'Inactive'}</td>
                            <td style={{ padding: '12px 14px', color: '#8a908a', fontSize: '12px' }}>{u.created_at ? new Date(u.created_at).toLocaleDateString() : '—'}</td>
                            <td style={{ padding: '12px 14px', textAlign: 'right' }}>
                              {isSelf ? (
                                <span style={{ fontSize: '11px', color: '#b0b4ab' }}>—</span>
                              ) : (
                                <div style={{ display: 'inline-flex', gap: '6px' }}>
                                  {can('users', 'update') && (
                                    <button onClick={() => toggleUserActive(u)} style={{ background: '#fff', border: '1px solid #dfe1da', borderRadius: '4px', padding: '6px 10px', fontSize: '11px', color: '#111512', cursor: 'pointer' }}>
                                      {u.is_active ? 'Deactivate' : 'Activate'}
                                    </button>
                                  )}
                                  {can('users', 'delete') && (
                                    <button onClick={() => deleteUser(u)} title="Delete permanently" style={{ background: '#fff', border: '1px solid #e2b4b4', borderRadius: '4px', padding: '6px', color: '#a00', cursor: 'pointer', display: 'inline-flex' }}>
                                      <Trash2 size={13} />
                                    </button>
                                  )}
                                </div>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </section>
          </div>
        )}
      </section>

      {/* Create / Edit Event Modal */}
      <Modal
          open={showEventModal}
          onClose={() => setShowEventModal(false)}
          title={eventForm.id ? 'Edit Event' : 'Create Event'}
          footer={<button type="submit" form="event-form" className="primary" style={{ minHeight: '44px', padding: '0 20px' }}>{eventForm.id ? 'Update Event' : 'Create Event'}</button>}
        >
            <form id="event-form" onSubmit={saveEvent} style={{ display: 'grid', gap: '12px' }}>
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
                <NumberField required value={eventForm.capacity} onChange={(capacity) => setEventForm({ ...eventForm, capacity })} />
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
            </form>
        </Modal>

      {/* Broadcast Modal */}
      <Modal
          open={showBroadcastModal && !!selectedEvent}
          onClose={() => setShowBroadcastModal(false)}
          title={`Broadcast to ${selectedEvent?.title ?? ''} attendees`}
          description={`This will dispatch an announcement/update email to all ${eventReservations.filter((r) => r.status === 'confirmed').length} confirmed seat reservation(s).`}
          footer={<button type="submit" form="broadcast-form" className="primary" style={{ minHeight: '44px', padding: '0 20px' }}>Send Broadcast <Send size={14} /></button>}
        >
            <form id="broadcast-form" onSubmit={sendBroadcast} style={{ display: 'grid', gap: '12px' }}>
              <div>
                <label style={{ fontSize: '12px', color: '#5a625d' }}>Subject</label>
                <input required placeholder="Important update regarding..." value={broadcastForm.subject} onChange={(e) => setBroadcastForm({ ...broadcastForm, subject: e.target.value })} style={{ color: '#111512', background: '#f7f8f3' }} />
              </div>
              <div>
                <label style={{ fontSize: '12px', color: '#5a625d' }}>Message Body</label>
                <textarea required placeholder="Write your announcement details here..." value={broadcastForm.message} onChange={(e) => setBroadcastForm({ ...broadcastForm, message: e.target.value })} style={{ color: '#111512', background: '#f7f8f3', minHeight: '120px' }} />
              </div>
            </form>
        </Modal>

      {/* Gallery Item Modal */}
      <Modal
          open={showGalleryModal}
          onClose={() => setShowGalleryModal(false)}
          title={galleryForm.id ? 'Edit Gallery Item' : 'New Gallery Item'}
          footer={<button type="submit" form="gallery-form" disabled={savingGallery || uploadingGalleryImage} className="primary" style={{ minHeight: '44px', padding: '0 20px' }}>{savingGallery ? 'Saving…' : galleryForm.id ? 'Save Changes' : 'Add to Gallery'}</button>}
        >
            <form id="gallery-form" onSubmit={saveGalleryItem} style={{ display: 'grid', gap: '12px' }}>
              <div>
                <label style={{ fontSize: '12px', color: '#5a625d' }}>Photo</label>
                {galleryForm.image_url && (
                  <img src={galleryForm.image_url} alt="" style={{ width: '100%', height: '160px', objectFit: 'cover', borderRadius: '6px', border: '1px solid #dfe1da', marginBottom: '8px', background: '#eceee7' }} />
                )}
                <input
                  type="file"
                  accept="image/png,image/jpeg,image/webp,image/gif"
                  onChange={(e) => { const f = e.target.files?.[0]; if (f) uploadGalleryImage(f); }}
                  style={{ color: '#111512', background: '#f7f8f3' }}
                />
                <p style={{ margin: '4px 0 0', fontSize: '11px', color: '#8a908a' }}>
                  {uploadingGalleryImage ? 'Uploading…' : 'PNG, JPG, WEBP or GIF · max 5 MB'}
                </p>
              </div>
              <div>
                <label style={{ fontSize: '12px', color: '#5a625d' }}>Title</label>
                <input required placeholder="e.g. Reflow oven — PCB assembly" value={galleryForm.title} onChange={(e) => setGalleryForm({ ...galleryForm, title: e.target.value })} style={{ color: '#111512', background: '#f7f8f3' }} />
              </div>
              <div>
                <label style={{ fontSize: '12px', color: '#5a625d' }}>Caption (optional)</label>
                <textarea placeholder="Short description of the work shown" value={galleryForm.caption} onChange={(e) => setGalleryForm({ ...galleryForm, caption: e.target.value })} style={{ color: '#111512', background: '#f7f8f3', minHeight: '60px' }} />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <label style={{ fontSize: '12px', color: '#5a625d' }}>Category</label>
                  <select value={galleryForm.category} onChange={(e) => setGalleryForm({ ...galleryForm, category: e.target.value as GalleryCategory })} style={{ color: '#111512', background: '#f7f8f3' }}>
                    {(['Electronics', 'Fabrication', 'Software', 'Prototyping', 'Installations', 'Other'] as GalleryCategory[]).map((c) => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
                <div>
                  <label style={{ fontSize: '12px', color: '#5a625d' }}>Position (lower shows first)</label>
                  <NumberField min="0" value={galleryForm.position} onChange={(position) => setGalleryForm({ ...galleryForm, position })} />
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <input type="checkbox" checked={galleryForm.is_published} onChange={(e) => setGalleryForm({ ...galleryForm, is_published: e.target.checked })} style={{ width: 'auto' }} />
                <label style={{ fontSize: '13px', color: '#5a625d' }}>Show on the public site</label>
              </div>
            </form>
        </Modal>

      {/* New Enrollment Modal (admin-initiated onboarding) */}
      <Modal
          open={showEnrollmentModal}
          onClose={() => setShowEnrollmentModal(false)}
          title="New Enrollment"
          description="Create an enrollment record directly, then send the onboarding invite from the list."
          footer={<button type="submit" form="enrollment-form" disabled={savingEnrollment} className="primary" style={{ minHeight: '44px', padding: '0 20px' }}>{savingEnrollment ? 'Creating…' : 'Create Enrollment'}</button>}
        >
            <form id="enrollment-form" onSubmit={saveEnrollment} style={{ display: 'grid', gap: '12px' }}>
              <div>
                <label style={{ fontSize: '12px', color: '#5a625d' }}>Full Name</label>
                <input required value={enrollmentForm.full_name} onChange={(e) => setEnrollmentForm({ ...enrollmentForm, full_name: e.target.value })} style={{ color: '#111512', background: '#f7f8f3' }} />
              </div>
              <div>
                <label style={{ fontSize: '12px', color: '#5a625d' }}>Email</label>
                <input required type="email" value={enrollmentForm.email} onChange={(e) => setEnrollmentForm({ ...enrollmentForm, email: e.target.value })} style={{ color: '#111512', background: '#f7f8f3' }} />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <label style={{ fontSize: '12px', color: '#5a625d' }}>Phone</label>
                  <input value={enrollmentForm.phone} onChange={(e) => setEnrollmentForm({ ...enrollmentForm, phone: e.target.value })} style={{ color: '#111512', background: '#f7f8f3' }} />
                </div>
                <div>
                  <label style={{ fontSize: '12px', color: '#5a625d' }}>Tier</label>
                  <select value={enrollmentForm.tier} onChange={(e) => setEnrollmentForm({ ...enrollmentForm, tier: e.target.value })} style={{ color: '#111512', background: '#f7f8f3' }}>
                    {['Explorer', 'Builder', 'Professional'].map((t) => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>
              </div>
              <div>
                <label style={{ fontSize: '12px', color: '#5a625d' }}>Location</label>
                <input value={enrollmentForm.location} onChange={(e) => setEnrollmentForm({ ...enrollmentForm, location: e.target.value })} style={{ color: '#111512', background: '#f7f8f3' }} />
              </div>
              <div>
                <label style={{ fontSize: '12px', color: '#5a625d' }}>Notes (internal)</label>
                <textarea value={enrollmentForm.notes} onChange={(e) => setEnrollmentForm({ ...enrollmentForm, notes: e.target.value })} style={{ color: '#111512', background: '#f7f8f3', minHeight: '70px' }} />
              </div>
            </form>
        </Modal>

      {/* New Staff User Modal */}
      <Modal
          open={showUserModal}
          onClose={() => setShowUserModal(false)}
          title="New Staff User"
          description="Staff accounts only. Students are created by claiming an onboarding invitation."
          footer={<button type="submit" form="user-form" disabled={savingUser} className="primary" style={{ minHeight: '44px', padding: '0 20px' }}>{savingUser ? 'Creating…' : 'Create User'}</button>}
        >
            <form id="user-form" onSubmit={saveUser} style={{ display: 'grid', gap: '12px' }}>
              <div>
                <label style={{ fontSize: '12px', color: '#5a625d' }}>Full Name</label>
                <input required value={userForm.full_name} onChange={(e) => setUserForm({ ...userForm, full_name: e.target.value })} style={{ color: '#111512', background: '#f7f8f3' }} />
              </div>
              <div>
                <label style={{ fontSize: '12px', color: '#5a625d' }}>Email</label>
                <input required type="email" value={userForm.email} onChange={(e) => setUserForm({ ...userForm, email: e.target.value })} style={{ color: '#111512', background: '#f7f8f3' }} />
              </div>
              <div>
                <label style={{ fontSize: '12px', color: '#5a625d' }}>Temporary Password (min 10 characters)</label>
                <input required type="password" minLength={10} value={userForm.password} onChange={(e) => setUserForm({ ...userForm, password: e.target.value })} style={{ color: '#111512', background: '#f7f8f3' }} />
              </div>
              <div>
                <label style={{ fontSize: '12px', color: '#5a625d' }}>Role</label>
                <select value={userForm.role} onChange={(e) => setUserForm({ ...userForm, role: e.target.value })} style={{ color: '#111512', background: '#f7f8f3' }}>
                  {roles.length > 0 ? (
                    roles.filter((r) => r.name !== 'student').map((r) => (
                      <option key={r.name} value={r.name}>{r.label}</option>
                    ))
                  ) : (
                    <>
                      <option value="admissions">Admissions</option>
                      <option value="admin">Admin</option>
                      {user?.role === 'super_admin' && <option value="super_admin">Super Admin</option>}
                    </>
                  )}
                </select>
              </div>
            </form>
        </Modal>

      {/* Role Editor / Creator Modal */}
      <Modal
          open={showRoleModal}
          onClose={() => setShowRoleModal(false)}
          title={roleForm.id ? `Edit Role: ${roleForm.label}` : 'Create Custom Role'}
          width="min(720px, 100%)"
          footer={<button type="submit" form="role-form" disabled={savingRole} className="primary" style={{ minHeight: '44px', padding: '0 20px' }}>{savingRole ? 'Saving…' : (roleForm.id ? 'Update Role' : 'Create Role')}</button>}
        >
            <form id="role-form" onSubmit={saveRole} style={{ display: 'grid', gap: '14px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <label style={{ fontSize: '12px', color: '#5a625d' }}>Role Label (display name)</label>
                  <input required placeholder="e.g. Sales Representative" value={roleForm.label} onChange={(e) => setRoleForm({ ...roleForm, label: e.target.value })} style={{ color: '#111512', background: '#f7f8f3' }} />
                </div>
                <div>
                  <label style={{ fontSize: '12px', color: '#5a625d' }}>Slug Name {roleForm.id ? '(readonly)' : '(lowercase_slug)'}</label>
                  <input required disabled={!!roleForm.id} placeholder="e.g. sales_rep" value={roleForm.name} onChange={(e) => setRoleForm({ ...roleForm, name: e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, '') })} style={{ color: '#111512', background: roleForm.id ? '#eceee7' : '#f7f8f3' }} />
                </div>
              </div>
              <div>
                <label style={{ fontSize: '12px', color: '#5a625d' }}>Description</label>
                <input placeholder="Short summary of permissions..." value={roleForm.description} onChange={(e) => setRoleForm({ ...roleForm, description: e.target.value })} style={{ color: '#111512', background: '#f7f8f3' }} />
              </div>

              <div>
                <label style={{ fontSize: '12px', color: '#5a625d', fontWeight: 700 }}>Resource Grants &amp; Scope</label>
                {editingRole?.is_built_in && (
                  <p style={{ margin: '4px 0 0', fontSize: '12px', color: '#8a6d1a', background: '#f7edc8', border: '1px solid #e8dca4', borderRadius: '6px', padding: '8px 10px' }}>
                    <Lock size={12} style={{ verticalAlign: '-2px' }} /> Built-in role — grants are fixed and reset on every deploy. Label and description are editable; to vary permissions, create a custom role.
                  </p>
                )}
                <div style={{ overflowX: 'auto', border: '1px solid #d8dbd1', borderRadius: '6px', marginTop: '6px' }}>
                  <table className="perm-matrix">
                    <thead>
                      <tr>
                        <th>Resource</th>
                        <th>Read</th>
                        <th>Create</th>
                        <th>Update</th>
                        <th>Delete</th>
                        <th>Read Scope</th>
                      </tr>
                    </thead>
                    <tbody>
                      {roleForm.permissions.map((p) => {
                        // All built-in role grants are immutable, not just
                        // super_admin's: the server reseeds them from its
                        // specification on every boot, so an edit would revert.
                        const isBuiltInEdit = editingRole?.is_built_in === true;
                        return (
                          <tr key={p.resource}>
                            <td>{p.resource}</td>
                            <td>
                              <input
                                type="checkbox"
                                disabled={isBuiltInEdit}
                                checked={p.can_read}
                                onChange={(e) => handlePermChange(p.resource, 'can_read', e.target.checked)}
                              />
                            </td>
                            <td>
                              <input
                                type="checkbox"
                                disabled={isBuiltInEdit}
                                checked={p.can_create}
                                onChange={(e) => handlePermChange(p.resource, 'can_create', e.target.checked)}
                              />
                            </td>
                            <td>
                              <input
                                type="checkbox"
                                disabled={isBuiltInEdit}
                                checked={p.can_update}
                                onChange={(e) => handlePermChange(p.resource, 'can_update', e.target.checked)}
                              />
                            </td>
                            <td>
                              <input
                                type="checkbox"
                                disabled={isBuiltInEdit}
                                checked={p.can_delete}
                                onChange={(e) => handlePermChange(p.resource, 'can_delete', e.target.checked)}
                              />
                            </td>
                            <td>
                              <select
                                disabled={isBuiltInEdit}
                                value={p.scope}
                                onChange={(e) => handlePermChange(p.resource, 'scope', e.target.value as any)}
                              >
                                <option value="none">None</option>
                                <option value="own">Own</option>
                                <option value="all">All</option>
                              </select>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>

            </form>
        </Modal>

      {/* Create / Edit Product Modal */}
      <Modal
          open={showProductModal}
          onClose={() => setShowProductModal(false)}
          title={productForm.id ? 'Edit Product' : 'New Product'}
          footer={<button type="submit" form="product-form" className="primary" style={{ minHeight: '44px', padding: '0 20px' }}>{productForm.id ? 'Save Changes' : 'Create Product'}</button>}
        >
            <form id="product-form" onSubmit={saveProduct} style={{ display: 'grid', gap: '12px' }}>
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
                  <NumberField required value={productForm.price} onChange={(price) => setProductForm({ ...productForm, price })} />
                </div>
                <div>
                  <label style={{ fontSize: '12px', color: '#5a625d' }}>Stock Quantity</label>
                  <NumberField required value={productForm.stock} onChange={(stock) => setProductForm({ ...productForm, stock })} />
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
            </form>
        </Modal>

      {/* Create / Edit Opportunity Modal */}
      <Modal
          open={showOpportunityModal}
          onClose={() => setShowOpportunityModal(false)}
          title={opportunityForm.id ? 'Edit Opportunity' : 'New Opportunity'}
          footer={
            <>
              {opportunityForm.id && can('opportunities', 'delete') && (
                <button type="button" onClick={() => deleteOpportunity(opportunityForm.id)} style={{ background: '#fff', border: '1px solid #e2b4b4', color: '#a00', borderRadius: '8px', padding: '0 16px', minHeight: '44px', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                  <Trash2 size={15} /> Delete
                </button>
              )}
              {can('opportunities', opportunityForm.id ? 'update' : 'create') && (
                <button type="submit" form="opportunity-form" className="primary" style={{ minHeight: '44px', padding: '0 20px' }}>
                  {opportunityForm.id ? 'Save Changes' : 'Create Opportunity'}
                </button>
              )}
            </>
          }
        >
            <form id="opportunity-form" onSubmit={saveOpportunity} style={{ display: 'grid', gap: '12px' }}>
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
                  <NumberField min="0" value={opportunityForm.deal_value} onChange={(deal_value) => setOpportunityForm({ ...opportunityForm, deal_value })} />
                </div>
                <div>
                  <label style={{ fontSize: '12px', color: '#5a625d' }}>Probability (%)</label>
                  <NumberField min="0" max="100" value={opportunityForm.probability} onChange={(probability) => setOpportunityForm({ ...opportunityForm, probability })} />
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px' }}>
                <div>
                  <label style={{ fontSize: '12px', color: '#5a625d' }}>Segment</label>
                  <select value={opportunityForm.segment} onChange={(e) => setOpportunityForm({ ...opportunityForm, segment: e.target.value as OpportunitySegment })} style={{ color: '#111512', background: '#f7f8f3' }}>
                    {(['strategic', 'growth', 'standard'] as OpportunitySegment[]).map((s) => <option key={s} value={s}>{SEGMENT_STYLES[s].label}</option>)}
                  </select>
                </div>
                <div>
                  <label style={{ fontSize: '12px', color: '#5a625d' }}>Owner</label>
                  <select value={opportunityForm.owner_id} onChange={(e) => setOpportunityForm({ ...opportunityForm, owner_id: e.target.value })} style={{ color: '#111512', background: '#f7f8f3' }}>
                    <option value="">Unassigned</option>
                    {staff.map((s) => <option key={s.id} value={s.id}>{s.full_name}</option>)}
                  </select>
                </div>
                <div>
                  <label style={{ fontSize: '12px', color: '#5a625d' }}>Expected Close</label>
                  <input type="date" value={opportunityForm.expected_close_at} onChange={(e) => setOpportunityForm({ ...opportunityForm, expected_close_at: e.target.value })} style={{ color: '#111512', background: '#f7f8f3' }} />
                </div>
              </div>

              {/* Buying committee */}
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                  <label style={{ fontSize: '12px', color: '#5a625d' }}>Buying Committee</label>
                  <button type="button" onClick={addContact} style={{ background: '#eef0ea', border: 0, borderRadius: '4px', padding: '4px 10px', fontSize: '12px', color: '#111512', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                    <Plus size={12} /> Add contact
                  </button>
                </div>
                {opportunityForm.contacts.length === 0 ? (
                  <p style={{ fontSize: '12px', color: '#8a908a', margin: 0 }}>No stakeholders yet — add the decision makers and champions on this deal.</p>
                ) : (
                  <div style={{ display: 'grid', gap: '8px' }}>
                    {opportunityForm.contacts.map((ct, i) => (
                      <div key={i} style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr 1.3fr auto', gap: '6px', alignItems: 'center' }}>
                        <input placeholder="Name" value={ct.name} onChange={(e) => updateContact(i, { name: e.target.value })} style={{ color: '#111512', background: '#f7f8f3', fontSize: '13px', padding: '8px 10px' }} />
                        <select value={ct.role} onChange={(e) => updateContact(i, { role: e.target.value })} style={{ color: '#111512', background: '#f7f8f3', fontSize: '13px', padding: '8px 10px' }}>
                          {CONTACT_ROLES.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
                        </select>
                        <input placeholder="Email" value={ct.email} onChange={(e) => updateContact(i, { email: e.target.value })} style={{ color: '#111512', background: '#f7f8f3', fontSize: '13px', padding: '8px 10px' }} />
                        <button type="button" onClick={() => removeContact(i)} title="Remove" style={{ background: '#f7f8f3', border: '1px solid #e2e4dd', borderRadius: '4px', padding: '8px', cursor: 'pointer', color: '#a00', display: 'inline-flex' }}>
                          <X size={13} />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Line items — priced goods/services for quotations & invoices */}
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                  <label style={{ fontSize: '12px', color: '#5a625d' }}>Line Items <span style={{ color: '#8a908a' }}>(for quotes &amp; invoices)</span></label>
                  <button type="button" onClick={addLineItem} style={{ background: '#eef0ea', border: 0, borderRadius: '4px', padding: '4px 10px', fontSize: '12px', color: '#111512', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                    <Plus size={12} /> Add line
                  </button>
                </div>
                {opportunityForm.line_items.length === 0 ? (
                  <p style={{ fontSize: '12px', color: '#8a908a', margin: 0 }}>No line items — documents fall back to a single line at the deal value.</p>
                ) : (
                  <div style={{ display: 'grid', gap: '8px' }}>
                    {opportunityForm.line_items.map((li, i) => (
                      <div key={i} style={{ display: 'grid', gridTemplateColumns: '1fr 66px 108px auto', gap: '6px', alignItems: 'center' }}>
                        <input placeholder="Description" value={li.description} onChange={(e) => updateLineItem(i, { description: e.target.value })} style={{ color: '#111512', background: '#f7f8f3', fontSize: '13px', padding: '8px 10px' }} />
                        <NumberField min="0" step="1" title="Quantity" value={li.quantity} onChange={(quantity) => updateLineItem(i, { quantity })} style={{ fontSize: '13px', padding: '8px 10px' }} />
                        <NumberField min="0" title="Unit price (ZMW)" value={li.unit_price} onChange={(unit_price) => updateLineItem(i, { unit_price })} style={{ fontSize: '13px', padding: '8px 10px' }} />
                        <button type="button" onClick={() => removeLineItem(i)} title="Remove" style={{ background: '#f7f8f3', border: '1px solid #e2e4dd', borderRadius: '4px', padding: '8px', cursor: 'pointer', color: '#a00', display: 'inline-flex' }}>
                          <X size={13} />
                        </button>
                      </div>
                    ))}
                    <div style={{ display: 'flex', justifyContent: 'flex-end', fontSize: '12px', color: '#5a625d' }}>
                      Items total:&nbsp;<strong style={{ color: '#111512' }}>{ZMW(opportunityForm.line_items.reduce((s, li) => s + (Number(li.quantity) || 1) * (Number(li.unit_price) || 0), 0))}</strong>
                    </div>
                  </div>
                )}
              </div>

              <div>
                <label style={{ fontSize: '12px', color: '#5a625d' }}>Notes</label>
                <textarea value={opportunityForm.notes} onChange={(e) => setOpportunityForm({ ...opportunityForm, notes: e.target.value })} style={{ color: '#111512', background: '#f7f8f3', minHeight: '70px' }} />
              </div>
              <div style={{ fontSize: '12px', color: '#5a625d', background: '#eef0ea', borderRadius: '6px', padding: '10px 12px' }}>
                Weighted value: <strong style={{ color: '#5f7c29' }}>{ZMW((Number(opportunityForm.deal_value) || 0) * Number(opportunityForm.probability) / 100)}</strong>
              </div>
            </form>

            {/* Engagement log — only for a saved deal */}
            {opportunityForm.id && (
              <div style={{ marginTop: '18px', borderTop: '1px solid #e2e4dd', paddingTop: '14px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px' }}>
                  <Clock size={16} color="#5f7c29" />
                  <h3 style={{ margin: 0, fontSize: '15px' }}>Engagement Log</h3>
                  <span style={{ fontSize: '12px', color: '#8a908a' }}>{activities.length} {activities.length === 1 ? 'entry' : 'entries'}</span>
                </div>

                {can('opportunities', 'create') && (
                <form onSubmit={logActivity} style={{ display: 'grid', gap: '8px', marginBottom: '14px' }}>
                  <div style={{ display: 'grid', gridTemplateColumns: '130px 1fr', gap: '8px', alignItems: 'start' }}>
                    <select value={activityForm.type} onChange={(e) => setActivityForm({ ...activityForm, type: e.target.value as ActivityType })} style={{ color: '#111512', background: '#f7f8f3', fontSize: '13px', padding: '10px' }}>
                      {ACTIVITY_TYPES.map((a) => <option key={a.value} value={a.value}>{a.label}</option>)}
                    </select>
                    <textarea placeholder="Log a call, meeting, email or note on this deal…" value={activityForm.body} onChange={(e) => setActivityForm({ ...activityForm, body: e.target.value })} style={{ color: '#111512', background: '#f7f8f3', minHeight: '44px', fontSize: '13px' }} />
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                    <button type="submit" className="primary" disabled={loggingActivity || !activityForm.body.trim()} style={{ minHeight: '38px', padding: '0 16px', opacity: loggingActivity || !activityForm.body.trim() ? 0.6 : 1 }}>
                      {loggingActivity ? 'Logging…' : 'Log activity'}
                    </button>
                  </div>
                </form>
                )}

                {activitiesLoading ? (
                  <p style={{ fontSize: '13px', color: '#8a908a', margin: 0 }}>Loading activity…</p>
                ) : activities.length === 0 ? (
                  <p style={{ fontSize: '13px', color: '#8a908a', margin: 0 }}>No engagement logged yet — record the first touchpoint above.</p>
                ) : (
                  <div style={{ display: 'grid', gap: '10px' }}>
                    {activities.map((a) => {
                      const s = ACTIVITY_STYLE(a.type);
                      return (
                        <div key={a.id} style={{ display: 'grid', gridTemplateColumns: 'auto 1fr', gap: '10px' }}>
                          <span title={s.label} style={{ marginTop: '5px', width: '9px', height: '9px', borderRadius: '50%', background: s.color, flexShrink: 0 }} />
                          <div>
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', alignItems: 'baseline' }}>
                              <span style={{ fontSize: '11px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.03em', color: s.color }}>{s.label}</span>
                              <span style={{ fontSize: '12px', color: '#111512', fontWeight: 500 }}>{a.actor_name || 'System'}</span>
                              <span style={{ fontSize: '11px', color: '#8a908a' }}>{new Date(a.occurred_at).toLocaleString()}</span>
                            </div>
                            <p style={{ margin: '2px 0 0', fontSize: '13px', color: '#3a403b', whiteSpace: 'pre-wrap' }}>{a.body}</p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {/* Documents & payments — only for a saved deal */}
            {opportunityForm.id && (
              <div style={{ marginTop: '18px', borderTop: '1px solid #e2e4dd', paddingTop: '14px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px' }}>
                  <FileText size={16} color="#5f7c29" />
                  <h3 style={{ margin: 0, fontSize: '15px' }}>Documents &amp; Payments</h3>
                </div>

                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '14px' }}>
                  <button type="button" onClick={() => openDocument('quotation')} style={{ background: '#eef0ea', border: '1px solid #dfe1da', borderRadius: '6px', padding: '8px 14px', fontSize: '13px', color: '#111512', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                    <FileText size={14} /> Quotation
                  </button>
                  <button type="button" onClick={() => openDocument('invoice')} style={{ background: '#eef0ea', border: '1px solid #dfe1da', borderRadius: '6px', padding: '8px 14px', fontSize: '13px', color: '#111512', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                    <FileText size={14} /> Invoice
                  </button>
                </div>

                {can('payments', 'create') && (
                <form onSubmit={recordPayment} style={{ display: 'grid', gridTemplateColumns: '120px 150px 1fr auto', gap: '8px', alignItems: 'center', marginBottom: '12px' }}>
                  <NumberField min="0" placeholder="Amount" value={paymentForm.amount} onChange={(amount) => setPaymentForm({ ...paymentForm, amount })} style={{ fontSize: '13px', padding: '9px 10px' }} />
                  <select value={paymentForm.method} onChange={(e) => setPaymentForm({ ...paymentForm, method: e.target.value as PaymentMethod })} style={{ color: '#111512', background: '#f7f8f3', fontSize: '13px', padding: '9px 10px' }}>
                    {PAYMENT_METHODS.map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}
                  </select>
                  <input placeholder="Reference (optional)" value={paymentForm.reference} onChange={(e) => setPaymentForm({ ...paymentForm, reference: e.target.value })} style={{ color: '#111512', background: '#f7f8f3', fontSize: '13px', padding: '9px 10px' }} />
                  <button type="submit" className="primary" disabled={recordingPayment || Number(paymentForm.amount) <= 0} style={{ minHeight: '38px', padding: '0 14px', opacity: recordingPayment || Number(paymentForm.amount) <= 0 ? 0.6 : 1 }}>
                    {recordingPayment ? 'Saving…' : 'Record'}
                  </button>
                </form>
                )}

                {payments.length === 0 ? (
                  <p style={{ fontSize: '13px', color: '#8a908a', margin: 0 }}>No payments recorded — a receipt becomes available once a payment is logged.</p>
                ) : (
                  <div style={{ display: 'grid', gap: '8px' }}>
                    {payments.map((p) => (
                      <div key={p.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px', background: '#f7f8f3', border: '1px solid #e2e4dd', borderRadius: '6px', padding: '8px 10px' }}>
                        <div style={{ fontSize: '13px', minWidth: 0 }}>
                          <strong style={{ color: '#111512' }}>{ZMW(p.amount)}</strong>
                          <span style={{ color: '#5a625d' }}> · {PAYMENT_METHOD_LABEL(p.method)} · {new Date(p.paid_at).toLocaleDateString()}</span>
                          {p.reference && <span style={{ color: '#8a908a' }}> · {p.reference}</span>}
                        </div>
                        <div style={{ display: 'flex', gap: '6px', flexShrink: 0 }}>
                          <button type="button" onClick={() => openDocument('receipt', p)} style={{ background: '#fff', border: '1px solid #dfe1da', borderRadius: '4px', padding: '6px 10px', fontSize: '12px', color: '#111512', cursor: 'pointer' }}>Receipt</button>
                          {can('payments', 'delete') && (
                            <button type="button" onClick={() => deletePayment(p.id)} title="Remove" style={{ background: '#fff', border: '1px solid #e2e4dd', borderRadius: '4px', padding: '6px', cursor: 'pointer', color: '#a00', display: 'inline-flex' }}>
                              <X size={13} />
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                    <div style={{ display: 'flex', justifyContent: 'flex-end', fontSize: '12px', color: '#5a625d' }}>
                      Total received:&nbsp;<strong style={{ color: '#111512' }}>{ZMW(payments.reduce((s, p) => s + p.amount, 0))}</strong>
                    </div>
                  </div>
                )}
              </div>
            )}
        </Modal>

      {/* Document generator overlay (quotation / invoice / receipt) */}
      {docState && (
        <DocumentView
          kind={docState.kind}
          opportunity={docState.opportunity}
          payments={payments}
          ownerName={staffName(docState.opportunity.owner_id)}
          applyVat={applyVat}
          onToggleVat={() => setApplyVat((v) => !v)}
          receiptPayment={docState.receiptPayment}
          onClose={() => setDocState(null)}
        />
      )}

      {/* Create / Edit Contract Modal */}
      <Modal
          open={showContractModal}
          onClose={() => setShowContractModal(false)}
          title={contractForm.id ? 'Edit Contract' : 'New Contract'}
          footer={
            <>
              {contractForm.id && can('contracts', 'delete') && (
                <button type="button" onClick={() => deleteContract(contractForm.id)} style={{ background: '#fff', border: '1px solid #e2b4b4', color: '#a00', borderRadius: '8px', padding: '0 16px', minHeight: '44px', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                  <Trash2 size={15} /> Delete
                </button>
              )}
              {can('contracts', contractForm.id ? 'update' : 'create') && (
                <button type="submit" form="contract-form" disabled={savingContract} className="primary" style={{ minHeight: '44px', padding: '0 20px' }}>
                  {savingContract ? 'Saving…' : contractForm.id ? 'Save Changes' : 'Create Contract'}
                </button>
              )}
            </>
          }
        >
            <form id="contract-form" onSubmit={saveContract} style={{ display: 'grid', gap: '12px' }}>
              <div>
                <label style={{ fontSize: '12px', color: '#5a625d' }}>Contract Title</label>
                <input required placeholder="e.g. Managed Services Agreement 2026" value={contractForm.title} onChange={(e) => setContractForm({ ...contractForm, title: e.target.value })} style={{ color: '#111512', background: '#f7f8f3' }} />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <label style={{ fontSize: '12px', color: '#5a625d' }}>Account / Company</label>
                  <input value={contractForm.account_name} onChange={(e) => setContractForm({ ...contractForm, account_name: e.target.value })} style={{ color: '#111512', background: '#f7f8f3' }} />
                </div>
                <div>
                  <label style={{ fontSize: '12px', color: '#5a625d' }}>Status</label>
                  <select value={contractForm.status} onChange={(e) => setContractForm({ ...contractForm, status: e.target.value as ContractStatus })} style={{ color: '#111512', background: '#f7f8f3', textTransform: 'capitalize' }}>
                    {CONTRACT_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
              </div>
              <div>
                <label style={{ fontSize: '12px', color: '#5a625d' }}>Linked Deal (optional)</label>
                <select value={contractForm.opportunity_id} onChange={(e) => setContractForm({ ...contractForm, opportunity_id: e.target.value })} style={{ color: '#111512', background: '#f7f8f3' }}>
                  <option value="">— none —</option>
                  {opportunities.map((o) => <option key={o.id} value={o.id}>{o.name}{o.account_name ? ` — ${o.account_name}` : ''}</option>)}
                </select>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px' }}>
                <div>
                  <label style={{ fontSize: '12px', color: '#5a625d' }}>Value (ZMW)</label>
                  <NumberField min="0" value={contractForm.value} onChange={(value) => setContractForm({ ...contractForm, value })} />
                </div>
                <div>
                  <label style={{ fontSize: '12px', color: '#5a625d' }}>Start Date</label>
                  <input type="date" value={contractForm.start_date} onChange={(e) => setContractForm({ ...contractForm, start_date: e.target.value })} style={{ color: '#111512', background: '#f7f8f3' }} />
                </div>
                <div>
                  <label style={{ fontSize: '12px', color: '#5a625d' }}>Renewal Date</label>
                  <input type="date" value={contractForm.renewal_date} onChange={(e) => setContractForm({ ...contractForm, renewal_date: e.target.value })} style={{ color: '#111512', background: '#f7f8f3' }} />
                </div>
              </div>
              <div>
                <label style={{ fontSize: '12px', color: '#5a625d' }}>Document (PDF / DOC / DOCX, max 15 MB)</label>
                <input
                  type="file"
                  accept=".pdf,.doc,.docx"
                  onChange={(e) => setContractFile(e.target.files?.[0] ?? null)}
                  style={{ color: '#111512', background: '#f7f8f3', border: '1px solid #d8dbd1', padding: '8px' }}
                />
                {contractForm.id && !contractFile && (
                  <p style={{ fontSize: '11px', color: '#8a908a', margin: '4px 0 0' }}>Leave empty to keep the current file. Choosing a file adds a new version — the current one stays downloadable below.</p>
                )}
              </div>
              <div>
                <label style={{ fontSize: '12px', color: '#5a625d' }}>Notes</label>
                <textarea value={contractForm.notes} onChange={(e) => setContractForm({ ...contractForm, notes: e.target.value })} style={{ color: '#111512', background: '#f7f8f3', minHeight: '60px' }} />
              </div>
            </form>

            {/* Version history & read log — only meaningful for a saved contract */}
            {contractForm.id && (
              <div style={{ marginTop: '18px', borderTop: '1px solid #e2e4dd', paddingTop: '14px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px' }}>
                  <History size={16} color="#5f7c29" />
                  <h3 style={{ margin: 0, fontSize: '15px' }}>Document History</h3>
                  <span style={{ fontSize: '12px', color: '#8a908a' }}>
                    {contractVersions.length} {contractVersions.length === 1 ? 'version' : 'versions'}
                  </span>
                </div>

                {contractHistoryLoading ? (
                  <p style={{ fontSize: '13px', color: '#8a908a', margin: 0 }}>Loading history…</p>
                ) : contractVersions.length === 0 ? (
                  <p style={{ fontSize: '13px', color: '#8a908a', margin: 0 }}>No document uploaded yet. Every upload is kept as a version — replacing a file never destroys the one before it.</p>
                ) : (
                  <div style={{ display: 'grid', gap: '8px' }}>
                    {contractVersions.map((v) => (
                      <div key={v.id} style={{ background: '#f7f8f3', border: '1px solid #e2e4dd', borderRadius: '6px', padding: '9px 11px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px' }}>
                          <div style={{ fontSize: '13px', minWidth: 0 }}>
                            <strong style={{ color: '#111512' }}>v{v.version}</strong>
                            <span style={{ color: '#5a625d' }}> · {v.file_name || 'document'} · {formatFileSize(v.size)}</span>
                            {/* Versions come back newest-first, so the head is the live one. */}
                            {v.id === contractVersions[0]?.id && (
                              <span style={{ marginLeft: '6px', fontSize: '10px', fontWeight: 800, textTransform: 'uppercase', padding: '2px 6px', borderRadius: '8px', background: '#e8f2dc', color: '#35520f' }}>Current</span>
                            )}
                          </div>
                          <button type="button" onClick={() => api.downloadContractVersion(contractForm.id, v.id, v.file_name || 'contract').catch((err) => toast.error(err.message || 'Download failed'))} style={{ background: '#fff', border: '1px solid #dfe1da', borderRadius: '4px', padding: '6px 10px', fontSize: '12px', color: '#111512', cursor: 'pointer', flexShrink: 0 }}>
                            Download
                          </button>
                        </div>
                        <div style={{ fontSize: '11px', color: '#8a908a', marginTop: '4px' }}>
                          {new Date(v.created_at).toLocaleString()}{v.uploaded_by ? ` · ${v.uploaded_by}` : ''}
                        </div>
                        {/* The hash is what proves this file was not swapped, so show it
                            in full rather than truncating it to look tidy. */}
                        {v.file_hash && (
                          <div style={{ fontSize: '10px', color: '#8a908a', marginTop: '3px', wordBreak: 'break-all', fontFamily: 'ui-monospace, monospace' }}>
                            SHA256 {v.file_hash}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}

                {contractAccessLog.length > 0 && (
                  <div style={{ marginTop: '14px' }}>
                    <div style={{ fontSize: '12px', color: '#5a625d', fontWeight: 700, marginBottom: '6px' }}>Who has downloaded this</div>
                    <div style={{ display: 'grid', gap: '4px' }}>
                      {contractAccessLog.slice(0, 10).map((a) => (
                        <div key={a.id} style={{ fontSize: '11px', color: '#5a625d' }}>
                          {new Date(a.created_at).toLocaleString()} · <strong style={{ color: '#111512' }}>{a.actor_name || 'unknown'}</strong>
                          {a.ip ? ` · ${a.ip}` : ''}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
        </Modal>
    </main>
  );
}
