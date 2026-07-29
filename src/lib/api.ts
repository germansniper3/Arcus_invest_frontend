import type { ChatMessage, Enrollment, Event, Reservation, OnboardingInvitation, QuoteRequest, User, Product, ProgressReport, ExtensionRequest, Submission, StudentProfile, CapstoneMilestone, CapstoneComment, Opportunity, OpportunityActivity, PipelineForecast, AccountsIndex, AccountRecommendations, Contract, DocumentVersion, DocumentAccessLog, ContractSignature, Notification, EmailMode, ReceivablesReport, AccountPayment, AuditLog, Payment, EmailStatus, CustomRole, CustomRolePermission, GalleryItem, ApprovalRequest, ApprovalStatus, ApprovalRule, ApprovalAction, Expense, ExpenseCategory, VatTreatment, PayablesReport, CashPosition, StockMovement, StockMovementKind, TillSession, TillSummary, CounterSale, CounterMethod, PurchaseOrder, PurchaseOrderInput, GoodsReceipt, GoodsReceiptInput, LandedCostComponentInput, DealCosting } from '../types';

/**
 * An endpoint that answers with nothing but a sentence.
 *
 * All nine delete handlers end in
 * `c.JSON(http.StatusOK, map[string]string{"message": "… deleted"})`, and the
 * two notification read-markers do the same with "marked read" — checked
 * against the Go source rather than assumed, which is the only reason this is
 * written down as a type instead of left as `any`.
 *
 * No call site reads the message. They are typed so that a handler changing to
 * return the affected record, or to 204, becomes a compile error here rather
 * than a surprise at a call site later.
 */
interface MessageResponse {
  message: string;
}

/**
 * Request bodies for the event and product writes.
 *
 * These mirror the anonymous bind structs in AdminCreateEvent/AdminUpdateEvent
 * and AdminCreateProduct/AdminUpdateProduct — read off the Go source, not
 * guessed from the call sites, so a field the server ignores cannot quietly
 * look supported here. `slug` is optional because the admin form never sends
 * it; the handler derives one from the title.
 *
 * The call sites pass their whole form object, which also carries `id`. That is
 * accepted rather than rejected because excess-property checking applies to
 * object literals, not to variables — and the id belongs in the URL, which is
 * where it already goes.
 */
export interface EventBody {
  title: string;
  description: string;
  date: string;
  location: string;
  capacity: number;
  is_published: boolean;
  image_url: string;
  slug?: string;
}

export interface ProductBody {
  name: string;
  description: string;
  price: number;
  stock: number;
  image_url: string;
  specs: string;
  is_published: boolean;
}

/** What AdminBroadcast answers with. `status` is the stored broadcast's own
 *  status, which is why a 200 can still mean nothing was emailed. */
export interface BroadcastResult {
  message: string;
  recipients: number;
  status: string;
  subject: string;
}

/** What GET /invitations/:token answers with, before the account exists. */
export interface InvitationPreview {
  email: string;
  full_name: string;
  tier: string;
  expires_at: string;
}

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

// ApiError carries the HTTP status and the full response body alongside the
// message. Throwing a plain Error discarded both, which is fine for a toast but
// not for a 409 from the approval gate — that response identifies the request
// awaiting a decision, and the caller has to be able to read it.
//
// `message` is unchanged, so every existing `toast.error(err.message)` call site
// keeps working without modification.
export class ApiError extends Error {
  readonly status: number;
  readonly payload: Record<string, unknown>;

  constructor(status: number, payload: Record<string, unknown>) {
    super((payload.error as string) ?? 'Request failed');
    this.name = 'ApiError';
    this.status = status;
    this.payload = payload;
  }
}

/** True when the server blocked this action pending an approval decision. */
export function isApprovalBlocked(err: unknown): err is ApiError {
  return err instanceof ApiError && err.status === 409 && 'approval_request_id' in err.payload;
}

/**
 * The message to show the user for a thrown value.
 *
 * Replaces `catch (err: any) { toast.error(err.message || '…') }`, which was
 * the shape of ninety of the project's `no-explicit-any` warnings. `any` was
 * not silencing a typing inconvenience there — it was disabling the check that
 * matters: a `throw` can carry anything, and `err.message` on a thrown string
 * is `undefined`, so the fallback fired by accident rather than by design. On a
 * thrown `null` it threw a second time, inside the error handler.
 *
 * Everything this codebase throws is an `Error` — `ApiError` above extends it,
 * and the only other thrower is `fetch`'s `AbortError` (a `DOMException`) — so
 * the narrowing keeps the real message in every case that actually occurs, and
 * is honest about the ones that do not.
 *
 * `&& err.message` rather than a bare `instanceof` because the call sites it
 * replaces used `||`, which also falls back on an `Error` with an empty
 * message. That is worth keeping: a blank toast is not a report.
 */
export function errorMessage(err: unknown, fallback: string): string {
  return err instanceof Error && err.message ? err.message : fallback;
}

// Backoff for a sleeping container. The Railway instance sleeps when idle, so
// the first request after a quiet spell is refused outright while it wakes.
// Roughly 7.5s of patience in total, which covers a cold start without leaving
// a genuinely broken request hanging.
const RETRY_DELAYS_MS = [500, 1000, 2000, 4000];

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// Subscribers for the "waking up" indicator, so the UI can explain a slow first
// load rather than just appearing frozen.
type WakeListener = (waking: boolean) => void;
const wakeListeners = new Set<WakeListener>();
let wakingUp = false;

/** Subscribe to backend-waking state. Returns an unsubscribe function. */
export function onWakeStateChange(fn: WakeListener): () => void {
  wakeListeners.add(fn);
  return () => wakeListeners.delete(fn);
}

export function isWakingUp() {
  return wakingUp;
}

function setWaking(next: boolean) {
  if (wakingUp === next) return;
  wakingUp = next;
  wakeListeners.forEach((fn) => fn(next));
}

/**
 * Whether a failed request may be sent again automatically.
 *
 * Only when the request never reached the server. `fetch` rejects solely on a
 * network-level failure — any HTTP status resolves — so a 4xx can never land
 * here, and a 500 is an answer we must not silently repeat.
 *
 * Restricted to safe methods by default because a connection that drops mid
 * flight is indistinguishable, from the browser, from one that was refused
 * outright: the server may already have processed the request. Replaying a POST
 * on that guess could record a payment twice. Callers whose POST is genuinely
 * idempotent (login, token refresh) opt in explicitly.
 */
function mayRetry(method: string | undefined, optIn: boolean | undefined): boolean {
  if (optIn !== undefined) return optIn;
  const m = (method ?? 'GET').toUpperCase();
  return m === 'GET' || m === 'HEAD';
}

async function fetchWithRetry(url: string, init: RequestInit, retryable: boolean): Promise<Response> {
  let lastError: unknown;
  for (let attempt = 0; ; attempt++) {
    try {
      const response = await fetch(url, init);
      setWaking(false);
      return response;
    } catch (err) {
      // A caller-initiated abort is a decision, not a failure to reach.
      if (err instanceof DOMException && err.name === 'AbortError') throw err;
      lastError = err;
      if (!retryable || attempt >= RETRY_DELAYS_MS.length) break;
      setWaking(true);
      await sleep(RETRY_DELAYS_MS[attempt]);
    }
  }
  setWaking(false);
  throw lastError;
}

// Subscribers notified when a session cannot be renewed and the user has to
// re-authenticate.
type SessionListener = () => void;
const sessionLostListeners = new Set<SessionListener>();

export function onSessionLost(fn: SessionListener): () => void {
  sessionLostListeners.add(fn);
  return () => sessionLostListeners.delete(fn);
}

function notifySessionLost() {
  sessionLostListeners.forEach((fn) => fn());
}

/**
 * A single in-flight refresh shared by every caller.
 *
 * Without this, a screen that fires six requests in parallel would see six 401s
 * and start six refreshes. Rotation makes that actively harmful: the first
 * consumes the cookie, and the rest present a token the server has already
 * spent — which is indistinguishable from a stolen-token replay, so the whole
 * family gets revoked and the user is signed out for loading a page.
 */
let refreshInFlight: Promise<string | null> | null = null;

function refreshAccessToken(): Promise<string | null> {
  if (!refreshInFlight) {
    refreshInFlight = (async () => {
      try {
        const res = await fetch(`${API_BASE_URL}/auth/refresh`, {
          method: 'POST',
          credentials: 'include'
        });
        if (!res.ok) return null;
        const body = await res.json().catch(() => ({}));
        if (typeof body.token === 'string') {
          setToken(body.token);
          return body.token as string;
        }
        return null;
      } catch {
        // A network failure here is not a dead session — say nothing and let
        // the caller surface the original error.
        return null;
      }
    })().finally(() => {
      refreshInFlight = null;
    });
  }
  return refreshInFlight;
}

// Endpoints that must never trigger a refresh: refreshing in response to their
// 401 would either recurse or make no sense.
const NO_REFRESH_PATHS = ['/auth/refresh', '/auth/login', '/auth/logout', '/auth/forgot-password', '/auth/reset-password'];

interface RequestOptions {
  /** Force retry-on-network-failure on or off, overriding the method default. */
  retry?: boolean;
  /** Internal: set on the single replay after a successful token refresh. */
  replayed?: boolean;
}

async function request<T>(path: string, options: RequestInit = {}, opts: RequestOptions = {}): Promise<T> {
  const token = getToken();
  const response = await fetchWithRetry(`${API_BASE_URL}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers
    }
  }, mayRetry(options.method, opts.retry));

  // An expired access token is the expected steady state now that they last 30
  // minutes. Renew and replay once, so the caller never sees it.
  if (
    response.status === 401 &&
    !opts.replayed &&
    token &&
    !NO_REFRESH_PATHS.some((p) => path.startsWith(p))
  ) {
    const renewed = await refreshAccessToken();
    if (renewed) {
      return request<T>(path, options, { ...opts, replayed: true });
    }
    // The refresh token is gone too. Everything that can be done automatically
    // has been; the user has to prove who they are.
    notifySessionLost();
  }

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new ApiError(response.status, payload);
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
    // ApiError, not Error: an upload that fails on an expired token has to be
    // recognisable as a 401 by the refresh handling, and a plain Error discards
    // the status.
    throw new ApiError(response.status, payload);
  }
  return payload as T;
}

// Blob-download helper: the JWT lives in localStorage and must be sent as an
// Authorization header, which a plain <a href> cannot do. Fetch the file as a
// Blob with the header attached, then trigger a save via a temporary <a download>.
async function downloadBlob(path: string, fileName: string): Promise<void> {
  const token = getToken();
  // A download is a GET, so it is safe to replay after a cold start.
  const response = await fetchWithRetry(`${API_BASE_URL}${path}`, {
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {})
    }
  }, true);
  if (!response.ok) {
    const payload = await response.json().catch(() => ({}));
    throw new ApiError(response.status, payload);
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
  // Signing in is idempotent, so it opts into retry despite being a POST —
  // otherwise the very first action after the container sleeps is the one that
  // fails, which is exactly when a user concludes the app is down.
  //
  // credentials: 'include' is what lets the refresh cookie cross from the API
  // origin to this one. Without it the Set-Cookie is silently dropped and every
  // session ends when its 30-minute access token does.
  login: (email: string, password: string) =>
    request<{ token: string; user: User }>('/auth/login', {
      method: 'POST',
      credentials: 'include',
      body: JSON.stringify({ email, password })
    }, { retry: true }),
  me: () => request<User>('/auth/me'),

  /** Exchanges the refresh cookie for a new access token, rotating the cookie. */
  refresh: () =>
    request<{ token: string; user: User }>('/auth/refresh', {
      method: 'POST',
      credentials: 'include'
    }),
  logout: () =>
    request<{ message: string }>('/auth/logout', {
      method: 'POST',
      credentials: 'include'
    }),
  logoutEverywhere: () =>
    request<{ message: string }>('/auth/logout-everywhere', {
      method: 'POST',
      credentials: 'include'
    }),
  forgotPassword: (email: string) =>
    request<{ message: string }>('/auth/forgot-password', {
      method: 'POST',
      body: JSON.stringify({ email })
    }, { retry: true }),
  resetPassword: (token: string, password: string) =>
    request<{ message: string }>('/auth/reset-password', {
      method: 'POST',
      credentials: 'include',
      body: JSON.stringify({ token, password })
    }),

  // Public
  createEnrollment: (body: Partial<Enrollment>) =>
    request<Enrollment>('/enrollments', { method: 'POST', body: JSON.stringify(body) }),
  createQuote: (body: Partial<QuoteRequest>) =>
    request<QuoteRequest>('/quotes', { method: 'POST', body: JSON.stringify(body) }),
  chat: (question: string, sessionID: string) =>
    request<ChatMessage>('/chat', { method: 'POST', body: JSON.stringify({ question, session_id: sessionID }) }),

  // Public events
  listPublicEvents: () => request<Event[]>('/events'),
  getPublicEvent: (slug: string) => request<{ event: Event; reservations_count: number }>(`/events/${slug}`),
  reserveEvent: (id: string, body: { full_name: string; email: string; phone?: string; notes?: string }) =>
    request<Reservation>(`/events/${id}/reserve`, { method: 'POST', body: JSON.stringify(body) }),

  // Invitation (public, unauthenticated)
  previewInvitation: (token: string) => request<InvitationPreview>(`/invitations/${token}`),
  claimInvitation: (body: { token: string; password: string; capstone_title?: string; capstone_summary?: string }) =>
    request<User>('/invitations/claim', { method: 'POST', body: JSON.stringify(body) }),

  // Student hub
  studentDashboard: () =>
    request<{ profile: StudentProfile; enrollment: Enrollment; milestones: CapstoneMilestone[]; comments: CapstoneComment[]; progress_reports: ProgressReport[]; extensions: ExtensionRequest[]; submissions: Submission[] }>('/student/dashboard'),
  updateCapstone: (title: string, summary: string) =>
    request<StudentProfile>('/student/capstone', { method: 'PATCH', body: JSON.stringify({ title, summary }) }),
  updateMilestone: (mid: string, body: { status?: string; feedback?: string }) =>
    request<CapstoneMilestone>(`/student/milestones/${mid}`, { method: 'PATCH', body: JSON.stringify(body) }),
  postComment: (message: string) =>
    request<CapstoneComment>('/student/comments', { method: 'POST', body: JSON.stringify({ message }) }),
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
    const q = new URLSearchParams(params as Record<string, string>).toString();
    return request<Enrollment[]>(`/admin/enrollments${q ? `?${q}` : ''}`);
  },
  adminCreateEnrollment: (body: { full_name: string; email: string; phone?: string; location?: string; tier?: string; about?: string; notes?: string }) =>
    request<Enrollment>('/admin/enrollments', { method: 'POST', body: JSON.stringify(body) }),
  updateEnrollment: (id: string, body: Partial<Enrollment>) =>
    request<Enrollment>(`/admin/enrollments/${id}`, { method: 'PATCH', body: JSON.stringify(body) }),
  generateInvite: (enrollmentId: string) =>
    request<{ invitation: OnboardingInvitation; claim_url: string; emailed: boolean; email_error: string }>(`/admin/enrollments/${enrollmentId}/invite`, { method: 'POST' }),

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
  getStudent: (id: string) => request<{ user: User; profile: StudentProfile; milestones: CapstoneMilestone[]; comments: CapstoneComment[]; progress_reports: ProgressReport[]; extensions: ExtensionRequest[]; submissions: Submission[] }>(`/admin/students/${id}`),
  adminPostComment: (studentId: string, message: string) =>
    request<CapstoneComment>(`/admin/students/${studentId}/comments`, { method: 'POST', body: JSON.stringify({ message }) }),
  adminUpdateMilestone: (studentId: string, mid: string, body: { status?: CapstoneMilestone['status']; feedback?: string }) =>
    request<CapstoneMilestone>(`/admin/students/${studentId}/milestones/${mid}`, { method: 'PATCH', body: JSON.stringify(body) }),
  adminRespondProgressReport: (id: string, body: { supervisor_feedback: string; status: string }) =>
    request<ProgressReport>(`/admin/progress-reports/${id}`, { method: 'PATCH', body: JSON.stringify(body) }),
  adminRespondExtension: (id: string, body: { status: string; decision_note: string }) =>
    request<ExtensionRequest>(`/admin/extensions/${id}`, { method: 'PATCH', body: JSON.stringify(body) }),
  adminReviewSubmission: (id: string, body: { status: 'accepted' | 'revise'; review_note: string }) =>
    request<Submission>(`/admin/submissions/${id}`, { method: 'PATCH', body: JSON.stringify(body) }),

  // Admin — events
  adminListEvents: () => request<Event[]>('/admin/events'),
  adminCreateEvent: (body: EventBody) =>
    request<Event>('/admin/events', { method: 'POST', body: JSON.stringify(body) }),
  adminUpdateEvent: (id: string, body: EventBody) =>
    request<Event>(`/admin/events/${id}`, { method: 'PUT', body: JSON.stringify(body) }),
  adminDeleteEvent: (id: string) =>
    request<MessageResponse>(`/admin/events/${id}`, { method: 'DELETE' }),
  adminListReservations: (eventId: string) =>
    request<Reservation[]>(`/admin/events/${eventId}/reservations`),
  adminBroadcast: (eventId: string, subject: string, message: string) =>
    request<BroadcastResult>(`/admin/events/${eventId}/broadcast`, { method: 'POST', body: JSON.stringify({ subject, message }) }),
  approveReservation: (rid: string) =>
    request<Reservation>(`/admin/reservations/${rid}/approve`, { method: 'PATCH' }),

  // Gallery
  listPublicGallery: () => request<GalleryItem[]>('/gallery'),
  adminListGallery: () => request<GalleryItem[]>('/admin/gallery'),
  adminCreateGalleryItem: (body: Partial<GalleryItem>) =>
    request<GalleryItem>('/admin/gallery', { method: 'POST', body: JSON.stringify(body) }),
  adminUpdateGalleryItem: (id: string, body: Partial<GalleryItem>) =>
    request<GalleryItem>(`/admin/gallery/${id}`, { method: 'PUT', body: JSON.stringify(body) }),
  adminDeleteGalleryItem: (id: string) =>
    request<MessageResponse>(`/admin/gallery/${id}`, { method: 'DELETE' }),
  uploadGalleryImage: async (file: File): Promise<string> => {
    const formData = new FormData();
    formData.append('file', file);
    const { url } = await requestUpload<{ url: string }>('/admin/gallery/image', formData);
    return `${API_BASE_URL}${url}`;
  },

  // Products
  listPublicProducts: () =>
    request<Product[]>('/products'),
  adminListProducts: () =>
    request<Product[]>('/admin/products'),
  adminCreateProduct: (body: ProductBody) =>
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
  adminUpdateProduct: (id: string, body: ProductBody) =>
    request<Product>(`/admin/products/${id}`, { method: 'PUT', body: JSON.stringify(body) }),
  adminDeleteProduct: (id: string) =>
    request<MessageResponse>(`/admin/products/${id}`, { method: 'DELETE' }),

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

  // Receivables — balances are computed server-side and never stored, so these
  // are always read fresh rather than cached alongside the deal.
  adminReceivables: () => request<ReceivablesReport>('/admin/receivables'),
  adminAccountPayments: (account: string) =>
    request<{ payments: AccountPayment[]; total: number }>(`/admin/accounts/${encodeURIComponent(account)}/payments`),
  adminMarkInvoiced: (id: string, body: { invoiced_at?: string; clear?: boolean; apply_vat?: boolean }) =>
    request<Opportunity>(`/admin/opportunities/${id}/invoiced`, { method: 'PATCH', body: JSON.stringify(body) }),
  exportReceivablesCSV: () => downloadBlob('/admin/receivables/export', 'receivables.csv'),
  exportPipelineCSV: () => downloadBlob('/admin/opportunities/export', 'pipeline.csv'),
  exportPaymentsCSV: () => downloadBlob('/admin/payments/export', 'payments.csv'),

  // Notifications (the caller's own inbox; the server scopes every query)
  adminNotifications: (unreadOnly = false) =>
    request<{ items: Notification[]; unread: number }>(`/admin/notifications${unreadOnly ? '?unread=true' : ''}`),
  // PATCH, not POST: marking read is an update, and nobody creates inbox items.
  adminMarkNotificationRead: (id: string) =>
    request<MessageResponse>(`/admin/notifications/${id}/read`, { method: 'PATCH' }),
  adminMarkAllNotificationsRead: () =>
    request<MessageResponse>('/admin/notifications/read-all', { method: 'PATCH' }),
  adminNotificationPreference: () =>
    request<{ email_mode: EmailMode }>('/admin/notifications/preferences'),
  adminSetNotificationPreference: (email_mode: EmailMode) =>
    request<{ email_mode: EmailMode }>('/admin/notifications/preferences', { method: 'PUT', body: JSON.stringify({ email_mode }) }),

  // Contracts
  adminListContracts: () => request<Contract[]>('/admin/contracts'),
  adminCreateContract: (body: Partial<Contract>) =>
    request<Contract>('/admin/contracts', { method: 'POST', body: JSON.stringify(body) }),
  adminUpdateContract: (id: string, body: Partial<Contract> & { clear_renewal?: boolean }) =>
    request<Contract>(`/admin/contracts/${id}`, { method: 'PUT', body: JSON.stringify(body) }),
  adminDeleteContract: (id: string) =>
    request<MessageResponse>(`/admin/contracts/${id}`, { method: 'DELETE' }),
  uploadContractFile: (id: string, file: File) => {
    const formData = new FormData();
    formData.append('file', file);
    return requestUpload<Contract>(`/admin/contracts/${id}/file`, formData);
  },
  downloadContract: (id: string, fileName: string) =>
    downloadBlob(`/admin/contracts/${id}/file`, fileName),
  adminContractVersions: (id: string) =>
    request<DocumentVersion[]>(`/admin/contracts/${id}/versions`),
  downloadContractVersion: (id: string, versionId: string, fileName: string) =>
    downloadBlob(`/admin/contracts/${id}/versions/${versionId}/file`, fileName),
  adminContractAccessLog: (id: string) =>
    request<DocumentAccessLog[]>(`/admin/contracts/${id}/access-log`),
  adminSignContract: (id: string, body: { image: string; page: number; x: number; y: number; width_frac: number; save_signature: boolean }) =>
    request<{ contract: Contract; signature: ContractSignature }>(`/admin/contracts/${id}/sign`, { method: 'POST', body: JSON.stringify(body) }),
  adminContractSignatures: (id: string) =>
    request<ContractSignature[]>(`/admin/contracts/${id}/signatures`),
  adminMySignature: () => request<{ image: string }>('/admin/contracts/my-signature'),
  adminDeleteMySignature: () => request<MessageResponse>('/admin/contracts/my-signature', { method: 'DELETE' }),
  adminCreateOpportunity: (body: Partial<Opportunity>) =>
    request<Opportunity>('/admin/opportunities', { method: 'POST', body: JSON.stringify(body) }),
  adminUpdateOpportunity: (id: string, body: Partial<Opportunity>) =>
    request<Opportunity>(`/admin/opportunities/${id}`, { method: 'PUT', body: JSON.stringify(body) }),
  adminDeleteOpportunity: (id: string) =>
    request<MessageResponse>(`/admin/opportunities/${id}`, { method: 'DELETE' }),

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
    request<MessageResponse>(`/admin/payments/${paymentId}`, { method: 'DELETE' }),

  // Audit trail
  adminAuditLogs: (params?: { entity?: string; action?: string }) => {
    const q = new URLSearchParams(Object.entries(params ?? {}).filter(([, v]) => v) as [string, string][]).toString();
    return request<AuditLog[]>(`/admin/audit-logs${q ? `?${q}` : ''}`);
  },

  // Admin — user management
  adminListUsers: () => request<User[]>('/admin/users'),
  createUser: (body: { email: string; full_name: string; password: string; role: string }) =>
    request<User>('/admin/users', { method: 'POST', body: JSON.stringify(body) }),
  adminUpdateUser: (id: string, body: { is_active?: boolean; role?: string }) =>
    request<User>(`/admin/users/${id}`, { method: 'PATCH', body: JSON.stringify(body) }),
  adminDeleteUser: (id: string) =>
    request<MessageResponse>(`/admin/users/${id}`, { method: 'DELETE' }),

  // Admin — outbound email diagnostics
  adminEmailStatus: () => request<EmailStatus>('/admin/email/status'),
  adminSendTestEmail: () => request<{ message: string }>('/admin/email/test', { method: 'POST' }),

  // Admin — role management
  adminListRoles: () => request<CustomRole[]>('/admin/roles'),
  adminCreateRole: (body: { name: string; label: string; description?: string; permissions: Omit<CustomRolePermission, 'id'>[] }) =>
    request<CustomRole>('/admin/roles', { method: 'POST', body: JSON.stringify(body) }),
  adminUpdateRole: (id: string, body: { label?: string; description?: string; permissions?: Omit<CustomRolePermission, 'id'>[] }) =>
    request<CustomRole>(`/admin/roles/${id}`, { method: 'PATCH', body: JSON.stringify(body) }),
  adminDeleteRole: (id: string) =>
    request<MessageResponse>(`/admin/roles/${id}`, { method: 'DELETE' }),

  // Approvals
  // `awaiting` asks the server which requests this caller may actually decide,
  // rather than filtering client-side — the list must never offer a button the
  // server would refuse.
  adminApprovals: (filter?: { status?: ApprovalStatus; mine?: boolean; awaiting?: boolean }) => {
    const q = new URLSearchParams();
    if (filter?.status) q.set('status', filter.status);
    if (filter?.mine) q.set('mine', 'true');
    if (filter?.awaiting) q.set('awaiting', 'true');
    const qs = q.toString();
    return request<{ items: ApprovalRequest[] }>(`/admin/approvals${qs ? `?${qs}` : ''}`);
  },
  adminApproveRequest: (id: string, reason?: string) =>
    request<ApprovalRequest>(`/admin/approvals/${id}/approve`, {
      method: 'PATCH', body: JSON.stringify({ reason: reason ?? '' })
    }),
  adminRejectRequest: (id: string, reason: string) =>
    request<ApprovalRequest>(`/admin/approvals/${id}/reject`, {
      method: 'PATCH', body: JSON.stringify({ reason })
    }),
  adminResubmitRequest: (id: string, summary?: string) =>
    request<ApprovalRequest>(`/admin/approvals/${id}/resubmit`, {
      method: 'POST', body: JSON.stringify({ summary: summary ?? '' })
    }),

  adminApprovalRules: () => request<{ items: ApprovalRule[] }>('/admin/approval-rules'),
  adminCreateApprovalRule: (body: { action: ApprovalAction; min_amount: number; required_count: number; approver_role: string; note?: string }) =>
    request<ApprovalRule>('/admin/approval-rules', { method: 'POST', body: JSON.stringify(body) }),
  adminUpdateApprovalRule: (id: string, body: Partial<{ min_amount: number; required_count: number; approver_role: string; is_active: boolean; note: string }>) =>
    request<ApprovalRule>(`/admin/approval-rules/${id}`, { method: 'PATCH', body: JSON.stringify(body) }),

  // Payables. Like receivables, every balance here is computed server-side and
  // read fresh — an outstanding figure cached next to the invoice goes stale
  // the moment a settlement lands.
  adminListExpenses: (params?: { category?: string; opportunity_id?: string }) => {
    const qs = new URLSearchParams(params as Record<string, string>).toString();
    return request<{ items: Expense[] }>(`/admin/expenses${qs ? `?${qs}` : ''}`);
  },
  adminCreateExpense: (body: ExpenseInput) =>
    request<Expense>('/admin/expenses', { method: 'POST', body: JSON.stringify(body) }),
  adminUpdateExpense: (id: string, body: ExpenseInput) =>
    request<Expense>(`/admin/expenses/${id}`, { method: 'PUT', body: JSON.stringify(body) }),
  adminDeleteExpense: (id: string) =>
    request<void>(`/admin/expenses/${id}`, { method: 'DELETE' }),
  adminSettleExpense: (id: string, body: { amount: number; method: string; reference?: string; paid_at?: string; note?: string }) =>
    request<Expense>(`/admin/expenses/${id}/settlements`, { method: 'POST', body: JSON.stringify(body) }),
  adminPayables: () => request<PayablesReport>('/admin/payables'),
  adminPosition: () => request<CashPosition>('/admin/position'),
  exportPayablesCSV: () => downloadBlob('/admin/payables/export', 'payables.csv'),

  // The buy side. Ordering, taking delivery and being invoiced are three
  // separate calls because they are three separate events — see the note on
  // models.PurchaseOrder. Receiving goods never creates a payable.
  adminListPurchaseOrders: (params?: { status?: string; supplier?: string; opportunity_id?: string }) => {
    const qs = new URLSearchParams(params as Record<string, string>).toString();
    return request<{ items: PurchaseOrder[] }>(`/admin/purchase-orders${qs ? `?${qs}` : ''}`);
  },
  adminGetPurchaseOrder: (id: string) =>
    request<PurchaseOrder>(`/admin/purchase-orders/${id}`),
  adminCreatePurchaseOrder: (body: PurchaseOrderInput) =>
    request<PurchaseOrder>('/admin/purchase-orders', { method: 'POST', body: JSON.stringify(body) }),
  adminUpdatePurchaseOrder: (id: string, body: PurchaseOrderInput) =>
    request<PurchaseOrder>(`/admin/purchase-orders/${id}`, { method: 'PUT', body: JSON.stringify(body) }),
  /** Gated through the approvals engine — a 409 here is the gate, not a failure. */
  adminIssuePurchaseOrder: (id: string) =>
    request<PurchaseOrder>(`/admin/purchase-orders/${id}/issue`, { method: 'POST', body: '{}' }),
  adminCancelPurchaseOrder: (id: string) =>
    request<PurchaseOrder>(`/admin/purchase-orders/${id}/cancel`, { method: 'POST', body: '{}' }),
  /** Returns the updated order, so the caller sees the new outstanding quantities. */
  adminReceiveGoods: (id: string, body: GoodsReceiptInput) =>
    request<PurchaseOrder>(`/admin/purchase-orders/${id}/receipts`, { method: 'POST', body: JSON.stringify(body) }),
  adminListGoodsReceipts: (id: string) =>
    request<{ items: GoodsReceipt[] }>(`/admin/purchase-orders/${id}/receipts`),
  /** A late clearing invoice: recalculates the unit cost already in the ledger. */
  adminAddLandedCost: (receiptId: string, body: LandedCostComponentInput) =>
    request<{ ok: boolean }>(`/admin/goods-receipts/${receiptId}/components`, { method: 'POST', body: JSON.stringify(body) }),

  /** Margin on a deal. Every figure is derived server-side; none is stored. */
  adminDealCosting: (opportunityId: string) =>
    request<DealCosting>(`/admin/opportunities/${opportunityId}/costing`),

  // Stock ledger. Quantity on hand is the sum of these rows, so `on_hand`
  // comes back with the list rather than being totalled in the browser.
  adminStockMovements: (productId: string) =>
    request<{ items: StockMovement[]; on_hand: number }>(`/admin/products/${productId}/stock-movements`),
  adminCreateStockMovement: (productId: string, body: { kind: StockMovementKind; quantity: number; reason?: string; unit_cost?: number; occurred_at?: string }) =>
    request<{ movement: StockMovement; on_hand: number }>(`/admin/products/${productId}/stock-movements`, { method: 'POST', body: JSON.stringify(body) }),

  // Counter sales and the shift that contains them.
  adminListTillSessions: () => request<{ items: TillSession[] }>('/admin/till-sessions'),
  adminOpenTill: (body: { opening_float: number; note?: string }) =>
    request<TillSession>('/admin/till-sessions', { method: 'POST', body: JSON.stringify(body) }),
  adminTillSummary: (id: string) => request<TillSummary>(`/admin/till-sessions/${id}`),
  adminCloseTill: (id: string, body: { counted_cash: number; note?: string }) =>
    request<TillSummary>(`/admin/till-sessions/${id}/close`, { method: 'PATCH', body: JSON.stringify(body) }),
  adminListCounterSales: (tillSessionId?: string) =>
    request<{ items: CounterSale[] }>(`/admin/counter-sales${tillSessionId ? `?till_session_id=${tillSessionId}` : ''}`),
  adminCreateCounterSale: (body: CounterSaleInput) =>
    request<CounterSale>('/admin/counter-sales', { method: 'POST', body: JSON.stringify(body) }),
};

/** The writable shape of an expense — the computed figures are read-only. */
export interface ExpenseInput {
  supplier: string;
  supplier_tpin?: string;
  category: ExpenseCategory;
  reference?: string;
  smart_invoice_ref?: string;
  /** Import VAT evidence. See the field comment on the Expense type. */
  customs_assessment_ref?: string;
  purchase_order_id?: string | null;
  net_amount: number;
  vat_amount: number;
  vat_treatment: VatTreatment;
  incurred_at?: string;
  due_date?: string | null;
  opportunity_id?: string | null;
  notes?: string;
}

export interface CounterSaleInput {
  till_session_id?: string;
  customer_name?: string;
  customer_tpin?: string;
  apply_vat: boolean;
  payment_method: CounterMethod;
  amount_tendered: number;
  reference?: string;
  smart_invoice_ref?: string;
  note?: string;
  lines: { product_id: string | null; description: string; quantity: number; unit_price: number }[];
}

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
