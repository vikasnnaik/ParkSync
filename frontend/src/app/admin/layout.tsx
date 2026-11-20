'use client';

import React from 'react';
import ProtectedRoute from '../../components/layout/ProtectedRoute';
import MainLayout from '../../components/layout/MainLayout';

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <ProtectedRoute requiredRole="ADMIN">
      <MainLayout>{children}</MainLayout>
    </ProtectedRoute>
  );
}

