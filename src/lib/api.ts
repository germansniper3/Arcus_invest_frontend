import type { ChatMessage, Enrollment, QuoteRequest, User, Product } from '../types';

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
    request<{ profile: any; enrollment: Enrollment; milestones: any[]; comments: any[] }>('/student/dashboard'),
  updateCapstone: (title: string, summary: string) =>
    request<any>('/student/capstone', { method: 'PATCH', body: JSON.stringify({ title, summary }) }),
  updateMilestone: (mid: string, body: { status?: string; feedback?: string }) =>
    request<any>(`/student/milestones/${mid}`, { method: 'PATCH', body: JSON.stringify(body) }),
  postComment: (message: string) =>
    request<any>('/student/comments', { method: 'POST', body: JSON.stringify({ message }) }),

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

  // Admin — students (hub portal)
  listStudents: () => request<User[]>('/admin/students'),
  getStudent: (id: string) => request<{ user: User; profile: any; milestones: any[]; comments: any[] }>(`/admin/students/${id}`),
  adminPostComment: (studentId: string, message: string) =>
    request<any>(`/admin/students/${studentId}/comments`, { method: 'POST', body: JSON.stringify({ message }) }),
  adminUpdateMilestone: (studentId: string, mid: string, body: { status?: string; feedback?: string }) =>
    request<any>(`/admin/students/${studentId}/milestones/${mid}`, { method: 'PATCH', body: JSON.stringify(body) }),

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
  adminUpdateProduct: (id: string, body: any) =>
    request<Product>(`/admin/products/${id}`, { method: 'PUT', body: JSON.stringify(body) }),
  adminDeleteProduct: (id: string) =>
    request<any>(`/admin/products/${id}`, { method: 'DELETE' }),

  // Admin — user management
  createUser: (body: { email: string; full_name: string; password: string; role: string }) =>
    request<User>('/admin/users', { method: 'POST', body: JSON.stringify(body) }),
};
