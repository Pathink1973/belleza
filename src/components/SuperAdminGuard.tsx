import { ReactNode, useEffect, useState } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { USER_ROLES } from '../types/roles';
import { useAuthStore } from '../store/authStore';

interface SuperAdminGuardProps {
  children: ReactNode;
}

export function SuperAdminGuard({ children }: SuperAdminGuardProps) {
  const { user, loading, initialized } = useAuthStore();
  const location = useLocation();
  const [isVerifying, setIsVerifying] = useState(true);
  const [shouldRedirect, setShouldRedirect] = useState(false);

  useEffect(() => {
    if (!initialized || loading) {
      return;
    }

    if (!user || user.role !== USER_ROLES.SUPER_ADMIN) {
      setShouldRedirect(true);
    }

    setIsVerifying(false);
  }, [initialized, loading, user]);

  if (loading || !initialized || isVerifying) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-red-600"></div>
      </div>
    );
  }

  if (shouldRedirect || !user || user.role !== USER_ROLES.SUPER_ADMIN) {
    return <Navigate to="/auth/admin-login" state={{ from: location }} replace />;
  }

  return <>{children}</>;
}
