import { Suspense, lazy } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { ProtectedRoute } from './components/ProtectedRoute';
import { PublicSite } from './pages/PublicSite';

/**
 * Every route below the marketing site is loaded on demand.
 *
 * These were static imports, which put the entire admin back office — by far
 * the largest thing in the codebase — into the same bundle as the public
 * homepage. A visitor reading about PCB assembly was downloading the pipeline
 * board, the roles matrix and the document generator before anything rendered,
 * over connections where that is measured in seconds rather than milliseconds.
 *
 * PublicSite stays eager on purpose: it is the front door, and making the most
 * common entry wait for a second round trip to fetch its own chunk would move
 * the cost rather than remove it.
 */
const EnrollmentPage = lazy(() => import('./pages/EnrollmentPage').then((m) => ({ default: m.EnrollmentPage })));
const LoginPage = lazy(() => import('./pages/LoginPage').then((m) => ({ default: m.LoginPage })));
const AdminPage = lazy(() => import('./pages/AdminPage').then((m) => ({ default: m.AdminPage })));
const StudentPage = lazy(() => import('./pages/StudentPage').then((m) => ({ default: m.StudentPage })));
const GreenEngineeringPage = lazy(() => import('./pages/GreenEngineeringPage').then((m) => ({ default: m.GreenEngineeringPage })));
const ClaimInvitationPage = lazy(() => import('./pages/ClaimInvitationPage').then((m) => ({ default: m.ClaimInvitationPage })));
const ForgotPasswordPage = lazy(() => import('./pages/ForgotPasswordPage').then((m) => ({ default: m.ForgotPasswordPage })));
const ResetPasswordPage = lazy(() => import('./pages/ResetPasswordPage').then((m) => ({ default: m.ResetPasswordPage })));

export default function App() {
  return (
    // One boundary for all of them. A per-route boundary would give the same
    // result with more moving parts, since only one route renders at a time.
    <Suspense fallback={<div className="loading-shell">Loading…</div>}>
      <Routes>
        <Route path="/" element={<PublicSite />} />
        <Route path="/green-engineering-2026" element={<GreenEngineeringPage />} />
        <Route path="/arcus-innovation-hub-enrollment-manager" element={<EnrollmentPage />} />
        <Route path="/claim-invitation" element={<ClaimInvitationPage />} />
        <Route path="/login" element={<LoginPage />} />
        {/* Both must sit above the catch-all below, or a reset link silently
            redirects to the marketing site and the user never sees the form. */}
        <Route path="/forgot-password" element={<ForgotPasswordPage />} />
        <Route path="/reset-password" element={<ResetPasswordPage />} />
        <Route path="/admin" element={<ProtectedRoute surface="admin"><AdminPage /></ProtectedRoute>} />
        <Route path="/student" element={<ProtectedRoute surface="student"><StudentPage /></ProtectedRoute>} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Suspense>
  );
}
