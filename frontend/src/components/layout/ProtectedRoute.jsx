'use client';

import React, { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '../../context/AuthContext';
import Loader from '../common/Loader';

export const ProtectedRoute = ({ children, requiredRole }) => {
  const { user, token, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading) {
      if (!token || !user) {
        router.replace('/login');
      } else if (requiredRole && user.role !== requiredRole) {
        router.replace(user.role === 'ADMIN' ? '/admin/dashboard' : '/driver/dashboard');
      }
    }
  }, [user, token, loading, requiredRole, router]);

  if (loading || !token || !user || (requiredRole && user.role !== requiredRole)) {
    return <Loader message="Verifying session..." fullHeight />;
  }

  return <>{children}</>;
};

export default ProtectedRoute;

