export type Role = 'super_admin' | 'admin' | 'admissions' | 'student';

export interface User {
  id: string;
  email: string;
  full_name: string;
  role: Role;
  is_active: boolean;
  student_profile?: StudentProfile | null;
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

export interface Opportunity {
  id: string;
  created_at: string;
  updated_at: string;
  name: string;
  account_name: string;
  contact_name: string;
  contact_email: string;
  sector: string;
  stage: OpportunityStage;
  grade: OpportunityGrade;
  deal_value: number;
  probability: number;
  weighted_value: number;
  owner_id?: string | null;
  source_quote_id?: string | null;
  expected_close_at?: string | null;
  notes: string;
}

export interface PipelineStageSummary {
  stage: OpportunityStage;
  count: number;
  value: number;
  weighted_value: number;
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
