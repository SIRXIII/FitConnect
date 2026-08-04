import { Navigate, useLocation } from 'react-router-dom';
import { useAuthStore, type UserRole } from '@/stores/auth';

interface ProtectedRouteProps {
  children: React.ReactNode;
  requiredRole?: UserRole;
  skipRoleCheck?: boolean;
}

const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ children, requiredRole, skipRoleCheck }) => {
  const { user, profile, loading } = useAuthStore();
  const location = useLocation();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-paper">
        <div className="w-5 h-5 border border-accent border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!user) {
    const destination = location.pathname + location.search;
    const loginUrl = `/login?redirect=${encodeURIComponent(destination)}`;
    return <Navigate to={loginUrl} replace />;
  }

  // For onboarding routes, skip role/redirect checks — user just needs to be authenticated
  if (skipRoleCheck) {
    return <>{children}</>;
  }

  if (!profile?.role) {
    return <Navigate to="/onboarding/role" replace />;
  }

  if (requiredRole && profile.role !== requiredRole) {
    const redirect =
      profile.role === 'trainer' ? '/trainer/dashboard' :
      profile.role === 'admin' ? '/admin' :
      '/trainers';
    return <Navigate to={redirect} replace />;
  }

  return <>{children}</>;
};

export default ProtectedRoute;
