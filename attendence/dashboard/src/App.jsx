import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import ProtectedRoute from './components/ProtectedRoute';
import LandingPage from './pages/LandingPage';
import Dashboard from './pages/Dashboard';
import Enrollment from './pages/Enrollment';
import AuditLog from './pages/AuditLog';
import LiveFeed from './pages/LiveFeed';
import Reports from './pages/Reports';
import Analytics from './pages/Analytics';
import Schedule from './pages/Schedule';
import StudentPortal from './pages/StudentPortal';
import Login from './pages/Login';

export default function App() {
  return (
    <AuthProvider>
      <Agentation
        endpoint="http://localhost:4747"
        onSessionCreated={(sessionId) => {
          console.log("Session started:", sessionId);
        }}
      />
      <BrowserRouter>
        <div className="app-container">
          <Routes>
            {/* Public routes */}
            <Route path="/" element={<LandingPage />} />
            <Route path="/login" element={<Login />} />
            <Route path="/student-portal" element={<StudentPortal />} />
            
            {/* Protected routes */}
            <Route element={<ProtectedRoute />}>
              <Route path="/dashboard" element={<Dashboard />} />
              <Route path="/enrollment" element={<Enrollment />} />
              <Route path="/audit" element={<AuditLog />} />
              <Route path="/live" element={<LiveFeed />} />
              <Route path="/reports" element={<Reports />} />
              <Route path="/analytics" element={<Analytics />} />
              <Route path="/schedule" element={<Schedule />} />
            </Route>
          </Routes>
        </div>
      </BrowserRouter>
    </AuthProvider>
  );
}
