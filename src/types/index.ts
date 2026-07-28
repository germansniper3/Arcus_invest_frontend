export type Role = 'super_admin' | 'admin' | 'admissions' | 'student' | string;

export type PermissionResource =
  | 'opportunities' | 'accounts' | 'contracts' | 'payments' | 'quotes'
  | 'enrollments' | 'students' | 'events' | 'products' | 'users'
  | 'audit' | 'email' | 'metrics' | 'roles' | 'gallery' | 'notifications'
  | 'approvals' | 'expenses' | 'counter_sales';

export interface ResourcePermission {
  read: boolean;
  create: boolean;
  update: boolean;
  delete: boolean;
  scope: 'none' | 'own' | 'all';
}

export interface CustomRolePermission {
  id?: string;
  resource: PermissionResource;
  can_read: boolean;
  can_create: boolean;
  can_update: boolean;
  can_delete: boolean;
  scope: 'none' | 'own' | 'all';
}

export interface CustomRole {
  id: string;
  name: string;
  label: string;
  is_built_in: boolean;
  description: string;
  permissions: CustomRolePermission[];
  user_count?: number;
}

// Effective permissions for the signed-in user, returned by /auth/me. The
// backend is authoritative — this only drives what the UI offers.
export type Permissions = Partial<Record<PermissionResource, ResourcePermission>>;

export interface User {
  id: string;
  email: string;
  full_name: string;
  role: Role;
  is_active: boolean;
  student_profile?: StudentProfile | null;
  permissions?: Permissions;
  // Present on the admin users listing only.
  created_at?: string;
  last_login_at?: string | null;
}

export interface StudentProfile {
  id: string;
  user_id: string;
  enrollment_id?: string | null;
  tier: string;
  progress_pct: number;
  capstone_title: string;
  capstone_summary: string;
}

export interface Enrollment {
  id: string;
  created_at: string;
  full_name: string;
  email: string;
  phone: string;
  tier: string;
  interests: string;
  project_idea: string;
  status: string;
  notes: string;
  orientation_at?: string;
  student_user_id?: string | null;
}

export interface QuoteRequest {
  id: string;
  created_at: string;
  name: string;
  email: string;
  phone: string;
  company: string;
  service: string;
  budget_range: string;
  message: string;
  status: string;
  admin_notes?: string;
}

export interface ChatMessage {
  id: string;
  session_id: string;
  question: string;
  answer: string;
  source: string;
}

export interface Event {
  id: string;
  created_at: string;
  title: string;
  slug: string;
  description: string;
  date: string;
  location: string;
  capacity: number;
  is_published: boolean;
  image_url?: string;
}

export interface Reservation {
  id: string;
  created_at: string;
  event_id: string;
  user_id?: string | null;
  full_name: string;
  email: string;
  phone: string;
  notes: string;
  status: string;
}

export interface OnboardingInvitation {
  id: string;
  created_at: string;
  enrollment_id: string;
  email: string;
  token: string;
  expires_at: string;
  status: string;
}

export interface CapstoneMilestone {
  id: string;
  created_at: string;
  student_profile_id: string;
  title: string;
  description: string;
  status: 'pending' | 'in_progress' | 'pending_review' | 'completed';
  feedback: string;
  completed_at?: string | null;
}

export interface CapstoneComment {
  id: string;
  created_at: string;
  student_profile_id: string;
  author_name: string;
  author_role: string;
  message: string;
}

export interface ProgressReport {
  id: string;
  created_at: string;
  student_profile_id: string;
  period_start: string;
  period_end: string;
  accomplishments: string;
  challenges: string;
  status: 'submitted' | 'reviewed';
  supervisor_feedback: string;
  reviewed_at?: string | null;
}

export interface ExtensionRequest {
  id: string;
  created_at: string;
  student_profile_id: string;
  extension_type: string;
  requested_deadline: string;
  reason: string;
  status: 'pending' | 'approved' | 'denied';
  decision_note: string;
  decided_at?: string | null;
}

export interface Submission {
  id: string;
  created_at: string;
  student_profile_id: string;
  title: string;
  kind: string;
  file_name: string;
  content_type: string;
  size: number;
  status: 'submitted' | 'accepted' | 'revise';
  review_note: string;
  reviewed_at?: string | null;
}

export type GalleryCategory = 'Electronics' | 'Fabrication' | 'Software' | 'Prototyping' | 'Installations' | 'Other';

export interface GalleryItem {
  id: string;
  created_at?: string;
  title: string;
  caption: string;
  category: GalleryCategory;
  image_url: string;
  position: number;
  is_published: boolean;
}

export interface Product {
  id: string;
  created_at: string;
  name: string;
  slug: string;
  description: string;
  price: number;
  stock: number;
  image_url: string;
  specs: string;
  is_published: boolean;
}

export type OpportunityStage =
  | 'prospecting' | 'qualified' | 'proposal' | 'negotiation' | 'won' | 'lost';

export type OpportunityGrade = 'bronze' | 'silver' | 'gold' | 'platinum';

export type OpportunitySegment = 'strategic' | 'growth' | 'standard';

export interface OpportunityContact {
  id?: string;
  name: string;
  role: string;
  email: string;
  phone?: string;
  is_primary: boolean;
}

export interface OpportunityLineItem {
  id?: string;
  description: string;
  quantity: number;
  unit_price: number;
  line_total?: number;
  position?: number;
}

export type PaymentMethod = 'cash' | 'bank_transfer' | 'mobile_money' | 'cheque' | 'card' | 'other';

export interface Payment {
  id: string;
  created_at: string;
  opportunity_id: string;
  amount: number;
  method: PaymentMethod;
  reference: string;
  paid_at: string;
  note: string;
  recorded_by_id?: string | null;
  recorded_by: string;
}

export interface Opportunity {
  id: string;
  created_at: string;
  updated_at: string;
  name: string;
  account_name: string;
  contact_name: string;
  contact_email: string;
  sector: string;
  segment: OpportunitySegment;
  stage: OpportunityStage;
  grade: OpportunityGrade;
  deal_value: number;
  probability: number;
  weighted_value: number;
  owner_id?: string | null;
  source_quote_id?: string | null;
  expected_close_at?: string | null;
  notes: string;
  contacts: OpportunityContact[];
  line_items: OpportunityLineItem[];
  line_items_total: number;
  /** What the client was billed, VAT included where it applies. Computed server-side. */
  invoiced_total: number;
  /** Whether the issued invoice carried VAT — part of the deal, not a view toggle. */
  apply_vat: boolean;
  /** When the client was billed. Null means this is not a receivable yet. */
  invoiced_at?: string | null;
}

export interface EmailStatus {
  configured: boolean;
  /** Which transport will carry outbound mail. 'resend' uses the HTTPS API. */
  transport: 'resend' | 'smtp' | 'none';
  host: string;
  port: string;
  from: string;
  has_username: boolean;
  has_password: boolean;
  has_api_key: boolean;
  frontend_url: string;
  issues: string[];
  looks_healthy: boolean;
}

export interface AuditLog {
  id: string;
  created_at: string;
  actor_id?: string | null;
  actor_name: string;
  actor_role: Role | '';
  action: string;
  entity: string;
  entity_id: string;
  method: string;
  path: string;
  status: number;
}

export type ActivityType = 'call' | 'meeting' | 'email' | 'note' | 'task' | 'other';

export interface OpportunityActivity {
  id: string;
  created_at: string;
  opportunity_id: string;
  actor_id?: string | null;
  actor_name: string;
  actor_role: Role | '';
  type: ActivityType;
  body: string;
  occurred_at: string;
}

export interface PipelineStageSummary {
  stage: OpportunityStage;
  count: number;
  value: number;
  weighted_value: number;
}

export interface AccountRollup {
  account: string;
  sector: string;
  segment: string;
  deal_count: number;
  open_count: number;
  open_value: number;
  weighted_value: number;
  won_value: number;
  total_value: number;
  top_grade: OpportunityGrade | '';
}

export interface SectorRollup {
  sector: string;
  account_count: number;
  deal_count: number;
  open_value: number;
  weighted_value: number;
  won_value: number;
  total_value: number;
}

export interface AccountsIndex {
  accounts: AccountRollup[];
  sectors: SectorRollup[];
}

export interface ProductRecommendation {
  slug: string;
  name: string;
  price: number;
  image_url: string;
  kind: 'cross_sell' | 'upsell';
  probability: number;
  rationale: string;
  reasons: string[];
}

export interface AccountRecommendations {
  account: string;
  sector: string;
  segment: string;
  top_grade: OpportunityGrade | '';
  won_count: number;
  won_value: number;
  open_value: number;
  source: string;
  recommendations: ProductRecommendation[];
}

export type ContractStatus = 'draft' | 'sent' | 'signed' | 'active' | 'expired';

export interface Contract {
  id: string;
  created_at: string;
  opportunity_id?: string | null;
  account_name: string;
  title: string;
  status: ContractStatus;
  value: number;
  start_date?: string | null;
  renewal_date?: string | null;
  notes: string;
  file_name: string;
  content_type: string;
  size: number;
  has_file: boolean;
  /** SHA256 of the current file, lowercase hex. Empty for pre-versioning uploads. */
  file_hash: string;
  current_version: number;
}

/** One stored revision of a document. Uploads append rather than overwrite. */
export interface DocumentVersion {
  id: string;
  created_at: string;
  version: number;
  file_name: string;
  content_type: string;
  size: number;
  file_hash: string;
  note: string;
  uploaded_by_id?: string | null;
  uploaded_by: string;
}

/**
 * The evidence record for one signing event. Records who signed and from
 * where; it makes no claim about the legal status of that signature.
 */
export interface ContractSignature {
  id: string;
  contract_id: string;
  signer_id?: string | null;
  signer_name: string;
  signer_email: string;
  signer_role: string;
  page: number;
  position_x: number;
  position_y: number;
  width_frac: number;
  signed_at: string;
  ip: string;
  user_agent: string;
  original_version_id?: string | null;
  signed_version_id?: string | null;
  original_hash: string;
  signed_hash: string;
}

/** One invoiced deal with money still outstanding. */
export interface Receivable {
  opportunity_id: string;
  name: string;
  account_name: string;
  invoiced_at?: string | null;
  invoiced: number;
  paid: number;
  outstanding: number;
  bucket: 'current' | '30' | '60' | '90+';
  days_overdue: number;
  apply_vat: boolean;
}

export interface ReceivablesReport {
  rows: Receivable[];
  buckets: Record<'current' | '30' | '60' | '90+', number>;
  total_outstanding: number;
}

/** A payment seen from the account level, so it names the deal it belongs to. */
export interface AccountPayment {
  id: string;
  opportunity_id: string;
  opportunity_name: string;
  amount: number;
  method: string;
  reference: string;
  paid_at: string;
  note: string;
  recorded_by: string;
}

/** How much outbound mail a user gets from notifications. */
export type EmailMode = 'per_event' | 'digest' | 'none';

/** One item in a staff member's inbox — something that needs a person. */
export interface Notification {
  id: string;
  created_at: string;
  kind: 'contract_renewal' | 'submission_review' | 'extension_pending' | 'deal_stalled'
    | 'approval_pending' | 'approval_decided';
  title: string;
  body: string;
  entity_type: string;
  entity_id?: string | null;
  read_at?: string | null;
}

/** The action codes the approval engine can gate. */
export type ApprovalAction =
  | 'deal.close_won' | 'deal.delete' | 'contract.sign'
  | 'contract.delete' | 'payment.record';

export type ApprovalStatus =
  | 'pending' | 'approved' | 'rejected' | 'consumed' | 'cancelled';

/** One approver's vote, and the carrier of a rejection reason. */
export interface ApprovalDecision {
  id: string;
  created_at: string;
  approver_id: string;
  approver_name: string;
  approver_role: string;
  decision: 'approved' | 'rejected';
  reason: string;
}

/**
 * A high-consequence action blocked pending sign-off. Approving does not perform
 * the action — the requester retries it and the gate lets it through.
 */
export interface ApprovalRequest {
  id: string;
  created_at: string;
  action: ApprovalAction;
  entity_type: string;
  entity_id: string;
  amount: number;
  summary: string;
  status: ApprovalStatus;
  requester_id?: string | null;
  requester_name: string;
  required_count: number;
  approver_role: string;
  approved_count: number;
  supersedes_id?: string | null;
  decided_at?: string | null;
  consumed_at?: string | null;
  decisions: ApprovalDecision[];
}

/** A configured threshold: at or above min_amount, action needs sign-off. */
export interface ApprovalRule {
  id: string;
  created_at: string;
  action: ApprovalAction;
  min_amount: number;
  required_count: number;
  approver_role: string;
  is_active: boolean;
  note: string;
}

/** A recorded read of a stored file — who downloaded it, when, from where. */
export interface DocumentAccessLog {
  id: string;
  created_at: string;
  version_id?: string | null;
  actor_id?: string | null;
  actor_name: string;
  actor_role: string;
  action: string;
  ip: string;
  user_agent: string;
}

export interface PipelineForecast {
  open_value: number;
  weighted_forecast: number;
  won_value: number;
  won_count: number;
  lost_count: number;
  win_rate: number;
  total_count: number;
  stages: PipelineStageSummary[];
}
