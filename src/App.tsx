import { Navigate, Route, Routes } from 'react-router-dom';
import { ProtectedRoute } from './components/ProtectedRoute';
import { PublicSite } from './pages/PublicSite';
import { EnrollmentPage } from './pages/EnrollmentPage';
import { LoginPage } from './pages/LoginPage';
import { AdminPage } from './pages/AdminPage';
import { StudentPage } from './pages/StudentPage';
import { GreenEngineeringPage } from './pages/GreenEngineeringPage';
import { ClaimInvitationPage } from './pages/ClaimInvitationPage';

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<PublicSite />} />
      <Route path="/green-engineering-2026" element={<GreenEngineeringPage />} />
      <Route path="/arcus-innovation-hub-enrollment-manager" element={<EnrollmentPage />} />
      <Route path="/claim-invitation" element={<ClaimInvitationPage />} />
      <Route path="/login" element={<LoginPage />} />
      <Route path="/admin" element={<ProtectedRoute surface="admin"><AdminPage /></ProtectedRoute>} />
      <Route path="/student" element={<ProtectedRoute surface="student"><StudentPage /></ProtectedRoute>} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
