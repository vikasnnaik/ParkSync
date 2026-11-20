'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '../context/AuthContext';
import Loader from '../components/common/Loader';

export default function HomePage() {
  const { user, token, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading) {
      if (!token || !user) {
        router.replace('/login');
      } else if ((user as any)?.role === 'ADMIN') {
        router.replace('/admin/dashboard');
      } else {
        router.replace('/driver/dashboard');
      }
    }
  }, [user, token, loading, router]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-900 text-white">
      <Loader message="Redirecting to your ParkSync console..." />
    </div>
  );
}
