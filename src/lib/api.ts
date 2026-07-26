import type { ChatMessage, Enrollment, QuoteRequest, User, Product, ProgressReport, ExtensionRequest, Submission, Opportunity, OpportunityActivity, PipelineForecast, AccountsIndex, AccountRecommendations, Contract, AuditLog, Payment } from '../types';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:8032/api/v1';
const TOKEN_KEY = 'arcus_token';

export function getToken() {
  return localStorage.getItem(TOKEN_KEY);
}

export function setToken(token: string) {
  localStorage.setItem(TOKEN_KEY, token);
}

export function clearToken() {
  localStorage.removeItem(TOKEN_KEY);
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = getToken();
  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers
    }
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(payload.error ?? 'Request failed');
  }
  return payload as T;
}

// Upload helper: sends a FormData body. Do NOT set Content-Type — the browser
// must set it (including the multipart boundary). Auth header is still required.
async function requestUpload<T>(path: string, formData: FormData): Promise<T> {
  const token = getToken();
  const response = await fetch(`${API_BASE_URL}${path}`, {
    method: 'POST',
    body: formData,
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {})
    }
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(payload.error ?? 'Request failed');
  }
  return payload as T;
}

// Blob-download helper: the JWT lives in localStorage and must be sent as an
// Authorization header, which a plain <a href> cannot do. Fetch the file as a
// Blob with the header attached, then trigger a save via a temporary <a download>.
async function downloadBlob(path: string, fileName: string): Promise<void> {
  const token = getToken();
  const response = await fetch(`${API_BASE_URL}${path}`, {
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {})
    }
  });
  if (!response.ok) {
    const payload = await response.json().catch(() => ({}));
    throw new Error(payload.error ?? 'Download failed');
  }
  const blob = await response.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export const api = {
  // Auth
  login: (email: string, password: string) =>
    request<{ token: string; user: User }>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password })
    }),
  me: () => request<User>('/auth/me'),

  // Public
  createEnrollment: (body: Partial<Enrollment>) =>
    request<Enrollment>('/enrollments', { method: 'POST', body: JSON.stringify(body) }),
  createQuote: (body: Partial<QuoteRequest>) =>
    request<QuoteRequest>('/quotes', { method: 'POST', body: JSON.stringify(body) }),
  chat: (question: string, sessionID: string) =>
    request<ChatMessage>('/chat', { method: 'POST', body: JSON.stringify({ question, session_id: sessionID }) }),

  // Public events
  listPublicEvents: () => request<any[]>('/events'),
  getPublicEvent: (slug: string) => request<{ event: any; reservations_count: number }>(`/events/${slug}`),
  reserveEvent: (id: string, body: { full_name: string; email: string; phone?: string; notes?: string }) =>
    request<any>(`/events/${id}/reserve`, { method: 'POST', body: JSON.stringify(body) }),

  // Invitation (public, unauthenticated)
  previewInvitation: (token: string) => request<any>(`/invitations/${token}`),
  claimInvitation: (body: { token: string; password: string; capstone_title?: string; capstone_summary?: string }) =>
    request<User>('/invitations/claim', { method: 'POST', body: JSON.stringify(body) }),

  // Student hub
  studentDashboard: () =>
    request<{ profile: any; enrollment: Enrollment; milestones: any[]; comments: any[]; progress_reports: ProgressReport[]; extensions: ExtensionRequest[]; submissions: Submission[] }>('/student/dashboard'),
  updateCapstone: (title: string, summary: string) =>
    request<any>('/student/capstone', { method: 'PATCH', body: JSON.stringify({ title, summary }) }),
  updateMilestone: (mid: string, body: { status?: string; feedback?: string }) =>
    request<any>(`/student/milestones/${mid}`, { method: 'PATCH', body: JSON.stringify(body) }),
  postComment: (message: string) =>
    request<any>('/student/comments', { method: 'POST', body: JSON.stringify({ message }) }),
  submitProgressReport: (body: { period_start: string; period_end: string; accomplishments: string; challenges: string }) =>
    request<ProgressReport>('/student/progress-reports', { method: 'POST', body: JSON.stringify(body) }),
  submitExtension: (body: { extension_type: string; requested_deadline: string; reason: string }) =>
    request<ExtensionRequest>('/student/extensions', { method: 'POST', body: JSON.stringify(body) }),
  submitSubmission: (body: { title: string; kind: string; file: File }) => {
    const formData = new FormData();
    formData.append('title', body.title);
    formData.append('kind', body.kind);
    formData.append('file', body.file);
    return requestUpload<Submission>('/student/submissions', formData);
  },
  downloadSubmission: (id: string, scope: 'student' | 'admin', fileName: string) =>
    downloadBlob(`/${scope}/submissions/${id}/file`, fileName),

  // Admin — overview
  adminMetrics: () =>
    request<{ enrollments: number; open_quotes: number; students: number; active_events: number }>('/admin/metrics'),

  // Admin — enrollments
  enrollments: (params?: { status?: string; tier?: string }) => {
    const q = new URLSearchParams(params as any).toString();
    return request<Enrollment[]>(`/admin/enrollments${q ? `?${q}` : ''}`);
  },
  updateEnrollment: (id: string, body: Partial<Enrollment>) =>
    request<Enrollment>(`/admin/enrollments/${id}`, { method: 'PATCH', body: JSON.stringify(body) }),
  generateInvite: (enrollmentId: string) =>
    request<{ invitation: any; claim_url: string }>(`/admin/enrollments/${enrollmentId}/invite`, { method: 'POST' }),

  // Admin — quotes
  quotes: () => request<QuoteRequest[]>('/admin/quotes'),
  updateQuote: (id: string, body: { status?: string; admin_notes?: string }) =>
    request<QuoteRequest>(`/admin/quotes/${id}`, { method: 'PATCH', body: JSON.stringify(body) }),
  convertQuoteToOpportunity: (id: string) =>
    request<Opportunity>(`/admin/quotes/${id}/convert`, { method: 'POST' }),

  // Admin — staff directory (pipeline owner picker)
  adminListStaff: () => request<User[]>('/admin/staff'),

  // Admin — students (hub portal)
  listStudents: () => request<User[]>('/admin/students'),
  getStudent: (id: string) => request<{ user: User; profile: any; milestones: any[]; comments: any[]; progress_reports: ProgressReport[]; extensions: ExtensionRequest[]; submissions: Submission[] }>(`/admin/students/${id}`),
  adminPostComment: (studentId: string, message: string) =>
    request<any>(`/admin/students/${studentId}/comments`, { method: 'POST', body: JSON.stringify({ message }) }),
  adminUpdateMilestone: (studentId: string, mid: string, body: { status?: string; feedback?: string }) =>
    request<any>(`/admin/students/${studentId}/milestones/${mid}`, { method: 'PATCH', body: JSON.stringify(body) }),
  adminRespondProgressReport: (id: string, body: { supervisor_feedback: string; status: string }) =>
    request<ProgressReport>(`/admin/progress-reports/${id}`, { method: 'PATCH', body: JSON.stringify(body) }),
  adminRespondExtension: (id: string, body: { status: string; decision_note: string }) =>
    request<ExtensionRequest>(`/admin/extensions/${id}`, { method: 'PATCH', body: JSON.stringify(body) }),
  adminReviewSubmission: (id: string, body: { status: 'accepted' | 'revise'; review_note: string }) =>
    request<Submission>(`/admin/submissions/${id}`, { method: 'PATCH', body: JSON.stringify(body) }),

  // Admin — events
  adminListEvents: () => request<any[]>('/admin/events'),
  adminCreateEvent: (body: any) =>
    request<any>('/admin/events', { method: 'POST', body: JSON.stringify(body) }),
  adminUpdateEvent: (id: string, body: any) =>
    request<any>(`/admin/events/${id}`, { method: 'PUT', body: JSON.stringify(body) }),
  adminDeleteEvent: (id: string) =>
    request<any>(`/admin/events/${id}`, { method: 'DELETE' }),
  adminListReservations: (eventId: string) =>
    request<any[]>(`/admin/events/${eventId}/reservations`),
  adminBroadcast: (eventId: string, subject: string, message: string) =>
    request<any>(`/admin/events/${eventId}/broadcast`, { method: 'POST', body: JSON.stringify({ subject, message }) }),
  approveReservation: (rid: string) =>
    request<any>(`/admin/reservations/${rid}/approve`, { method: 'PATCH' }),

  // Products
  listPublicProducts: () =>
    request<Product[]>('/products'),
  adminListProducts: () =>
    request<Product[]>('/admin/products'),
  adminCreateProduct: (body: any) =>
    request<Product>('/admin/products', { method: 'POST', body: JSON.stringify(body) }),
  // Uploads a product image and returns an absolute URL to store as image_url.
  // The backend returns a path relative to the API base; we resolve it against
  // API_BASE_URL so the stored URL works from any origin (public site + admin).
  uploadProductImage: async (file: File): Promise<string> => {
    const formData = new FormData();
    formData.append('file', file);
    const { url } = await requestUpload<{ url: string }>('/admin/products/image', formData);
    return `${API_BASE_URL}${url}`;
  },
  adminUpdateProduct: (id: string, body: any) =>
    request<Product>(`/admin/products/${id}`, { method: 'PUT', body: JSON.stringify(body) }),
  adminDeleteProduct: (id: string) =>
    request<any>(`/admin/products/${id}`, { method: 'DELETE' }),

  // Opportunities (B2B sales pipeline)
  adminListOpportunities: (stage?: string) =>
    request<Opportunity[]>(`/admin/opportunities${stage ? `?stage=${stage}` : ''}`),
  adminPipelineForecast: () =>
    request<PipelineForecast>('/admin/opportunities/forecast'),
  adminAccountsIndex: () =>
    request<AccountsIndex>('/admin/accounts'),
  // Cross-sell / upsell suggestions for one account (name must be encoded).
  adminAccountRecommendations: (account: string) =>
    request<AccountRecommendations>(`/admin/accounts/${encodeURIComponent(account)}/recommendations`),

  // Contracts
  adminListContracts: () => request<Contract[]>('/admin/contracts'),
  adminCreateContract: (body: Partial<Contract>) =>
    request<Contract>('/admin/contracts', { method: 'POST', body: JSON.stringify(body) }),
  adminUpdateContract: (id: string, body: Partial<Contract> & { clear_renewal?: boolean }) =>
    request<Contract>(`/admin/contracts/${id}`, { method: 'PUT', body: JSON.stringify(body) }),
  adminDeleteContract: (id: string) =>
    request<any>(`/admin/contracts/${id}`, { method: 'DELETE' }),
  uploadContractFile: (id: string, file: File) => {
    const formData = new FormData();
    formData.append('file', file);
    return requestUpload<Contract>(`/admin/contracts/${id}/file`, formData);
  },
  downloadContract: (id: string, fileName: string) =>
    downloadBlob(`/admin/contracts/${id}/file`, fileName),
  adminCreateOpportunity: (body: Partial<Opportunity>) =>
    request<Opportunity>('/admin/opportunities', { method: 'POST', body: JSON.stringify(body) }),
  adminUpdateOpportunity: (id: string, body: Partial<Opportunity>) =>
    request<Opportunity>(`/admin/opportunities/${id}`, { method: 'PUT', body: JSON.stringify(body) }),
  adminDeleteOpportunity: (id: string) =>
    request<any>(`/admin/opportunities/${id}`, { method: 'DELETE' }),

  // Engagement log (deal activity timeline)
  adminListActivities: (opportunityId: string) =>
    request<OpportunityActivity[]>(`/admin/opportunities/${opportunityId}/activities`),
  adminCreateActivity: (opportunityId: string, body: { type: string; body: string; occurred_at?: string }) =>
    request<OpportunityActivity>(`/admin/opportunities/${opportunityId}/activities`, { method: 'POST', body: JSON.stringify(body) }),

  // Payments (basis for receipts and invoice balances)
  adminListPayments: (opportunityId: string) =>
    request<Payment[]>(`/admin/opportunities/${opportunityId}/payments`),
  adminCreatePayment: (opportunityId: string, body: { amount: number; method: string; reference?: string; paid_at?: string; note?: string }) =>
    request<Payment>(`/admin/opportunities/${opportunityId}/payments`, { method: 'POST', body: JSON.stringify(body) }),
  adminDeletePayment: (paymentId: string) =>
    request<any>(`/admin/payments/${paymentId}`, { method: 'DELETE' }),

  // Audit trail
  adminAuditLogs: (params?: { entity?: string; action?: string }) => {
    const q = new URLSearchParams(Object.entries(params ?? {}).filter(([, v]) => v) as [string, string][]).toString();
    return request<AuditLog[]>(`/admin/audit-logs${q ? `?${q}` : ''}`);
  },

  // Admin — user management
  createUser: (body: { email: string; full_name: string; password: string; role: string }) =>
    request<User>('/admin/users', { method: 'POST', body: JSON.stringify(body) }),
};

// Client-side guard mirroring the backend's 15 MB limit on submission uploads.
export const MAX_SUBMISSION_FILE_SIZE = 15 * 1024 * 1024;

// Client-side guard mirroring the backend's 5 MB limit on product images.
export const MAX_PRODUCT_IMAGE_SIZE = 5 * 1024 * 1024;

export function formatFileSize(bytes: number): string {
  if (!bytes || bytes <= 0) return '0 KB';
  const kb = bytes / 1024;
  if (kb < 1024) return `${kb.toFixed(kb < 10 ? 1 : 0)} KB`;
  const mb = kb / 1024;
  return `${mb.toFixed(mb < 10 ? 1 : 0)} MB`;
}
