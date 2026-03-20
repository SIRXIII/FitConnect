import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useEffect } from 'react';
import { Toaster } from 'sonner';
import { useAuthStore } from '@/stores/auth';
import Navbar from '@/components/layout/Navbar';
import Footer from '@/components/layout/Footer';
import ProtectedRoute from '@/components/shared/ProtectedRoute';
import ErrorBoundary from '@/components/shared/ErrorBoundary';
import Landing from '@/pages/Landing';
import Login from '@/pages/Login';
import AuthCallback from '@/pages/AuthCallback';
import RoleSelect from '@/pages/RoleSelect';
import ClientOnboarding from '@/pages/ClientOnboarding';
import TrainerOnboarding from '@/pages/TrainerOnboarding';
import TrainerDashboard from '@/pages/TrainerDashboard';
import TrainerBookings from '@/pages/TrainerBookings';
import ClientDashboard from '@/pages/ClientDashboard';
import TrainerProfile from '@/pages/TrainerProfile';
import BookSession from '@/pages/BookSession';
import MyBookings from '@/pages/MyBookings';
import AdminDashboard from '@/pages/AdminDashboard';
import Messages from '@/pages/Messages';
import Pricing from '@/pages/Pricing';
import ClientPassport from '@/pages/ClientPassport';
import NotFound from '@/pages/NotFound';
import TrialBanner from '@/components/subscription/TrialBanner';
import GoogleCalendarCallback from '@/pages/GoogleCalendarCallback';

const App: React.FC = () => {
  const initialize = useAuthStore((s) => s.initialize);
  const profile = useAuthStore((s) => s.profile);

  useEffect(() => {
    initialize();
  }, [initialize]);

  return (
    <ErrorBoundary>
    <BrowserRouter>
      <div className="min-h-screen bg-paper selection:bg-accent selection:text-white">
        <Toaster
          position="top-right"
          duration={4000}
          toastOptions={{
            style: {
              background: '#1a1a1a',
              color: '#fff',
              fontSize: '13px',
              fontFamily: 'Inter, sans-serif',
              letterSpacing: '0.02em',
              borderRadius: '0',
              padding: '14px 20px',
              border: 'none',
            },
          }}
        />
        <Navbar />
        {profile?.role === 'trainer' && <TrialBanner />}
        <Routes>
          {/* Public */}
          <Route path="/" element={<Landing />} />
          <Route path="/login" element={<Login />} />
          <Route path="/auth/callback" element={<AuthCallback />} />
          <Route path="/auth/google-callback" element={<GoogleCalendarCallback />} />
          <Route path="/pricing" element={<Pricing />} />

          {/* Onboarding (requires auth) */}
          <Route path="/onboarding/role" element={<ProtectedRoute skipRoleCheck><RoleSelect /></ProtectedRoute>} />
          <Route path="/onboarding/client" element={<ProtectedRoute skipRoleCheck><ClientOnboarding /></ProtectedRoute>} />
          <Route path="/onboarding/trainer" element={<ProtectedRoute skipRoleCheck><TrainerOnboarding /></ProtectedRoute>} />

          {/* Redirect legacy routes */}
          <Route path="/signup" element={<Navigate to="/login" replace />} />
          <Route path="/dashboard" element={<Navigate to="/login" replace />} />
          <Route path="/role-select" element={<Navigate to="/login" replace />} />
          <Route path="/onboarding" element={<Navigate to="/login" replace />} />

          {/* Trainer routes */}
          <Route
            path="/trainer/dashboard"
            element={
              <ProtectedRoute requiredRole="trainer">
                <TrainerDashboard />
              </ProtectedRoute>
            }
          />
          <Route
            path="/trainer/bookings"
            element={
              <ProtectedRoute requiredRole="trainer">
                <TrainerBookings />
              </ProtectedRoute>
            }
          />

          {/* Client routes */}
          <Route
            path="/client/dashboard"
            element={
              <ProtectedRoute requiredRole="client">
                <ClientDashboard />
              </ProtectedRoute>
            }
          />
          <Route
            path="/client/bookings"
            element={
              <ProtectedRoute requiredRole="client">
                <MyBookings />
              </ProtectedRoute>
            }
          />
          <Route
            path="/client/passport"
            element={
              <ProtectedRoute requiredRole="client">
                <ClientPassport />
              </ProtectedRoute>
            }
          />

          {/* Public trainer pages */}
          <Route path="/trainers" element={<Landing />} />
          <Route path="/trainers/:id" element={<TrainerProfile />} />

          {/* Admin routes */}
          <Route
            path="/admin"
            element={
              <ProtectedRoute requiredRole="admin">
                <AdminDashboard />
              </ProtectedRoute>
            }
          />

          {/* Messages (requires auth) */}
          <Route
            path="/messages"
            element={
              <ProtectedRoute>
                <Messages />
              </ProtectedRoute>
            }
          />

          {/* Booking (requires auth) */}
          <Route
            path="/book/:slotId"
            element={
              <ProtectedRoute requiredRole="client">
                <BookSession />
              </ProtectedRoute>
            }
          />
          {/* 404 catch-all */}
          <Route path="*" element={<NotFound />} />
        </Routes>
        <Footer />
      </div>
    </BrowserRouter>
    </ErrorBoundary>
  );
};

export default App;
