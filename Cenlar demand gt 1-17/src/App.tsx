import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { useEffect } from 'react';
import { useAuthStore } from '@/stores/auth';
import Navbar from '@/components/layout/Navbar';
import Footer from '@/components/layout/Footer';
import ProtectedRoute from '@/components/shared/ProtectedRoute';
import Landing from '@/pages/Landing';
import Login from '@/pages/Login';
import AuthCallback from '@/pages/AuthCallback';
import RoleSelect from '@/pages/RoleSelect';
import TrainerDashboard from '@/pages/TrainerDashboard';
import ClientDashboard from '@/pages/ClientDashboard';
import TrainerProfile from '@/pages/TrainerProfile';
import BookSession from '@/pages/BookSession';
import MyBookings from '@/pages/MyBookings';

const App: React.FC = () => {
  const initialize = useAuthStore((s) => s.initialize);

  useEffect(() => {
    initialize();
  }, [initialize]);

  return (
    <BrowserRouter>
      <div className="min-h-screen bg-paper selection:bg-accent selection:text-white">
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
  );
};

export default App;
