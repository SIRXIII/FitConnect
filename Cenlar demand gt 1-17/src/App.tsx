import { BrowserRouter, Routes, Route } from 'react-router-dom';
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
import TrainerDashboard from '@/pages/TrainerDashboard';
import TrainerBookings from '@/pages/TrainerBookings';
import ClientDashboard from '@/pages/ClientDashboard';
import TrainerProfile from '@/pages/TrainerProfile';
import BookSession from '@/pages/BookSession';
import MyBookings from '@/pages/MyBookings';
import AdminDashboard from '@/pages/AdminDashboard';

const App: React.FC = () => {
  const initialize = useAuthStore((s) => s.initialize);

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
        <Routes>
          {/* Public */}
          <Route path="/" element={<Landing />} />
          <Route path="/login" element={<Login />} />
          <Route path="/auth/callback" element={<AuthCallback />} />

          {/* Onboarding */}
          <Route path="/onboarding/role" element={<RoleSelect />} />

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

          {/* Booking (requires auth) */}
          <Route
            path="/book/:slotId"
            element={
              <ProtectedRoute requiredRole="client">
                <BookSession />
              </ProtectedRoute>
            }
          />
        </Routes>
        <Footer />
      </div>
    </BrowserRouter>
    </ErrorBoundary>
  );
};

export default App;
