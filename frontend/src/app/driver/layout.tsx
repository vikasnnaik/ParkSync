'use client';

import React from 'react';
import ProtectedRoute from '../../components/layout/ProtectedRoute';
import MainLayout from '../../components/layout/MainLayout';

export default function DriverLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <ProtectedRoute requiredRole="DRIVER">
      <MainLayout>{children}</MainLayout>
    </ProtectedRoute>
  );
}

