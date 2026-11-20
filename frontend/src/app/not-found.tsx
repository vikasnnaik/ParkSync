import React from 'react';
import Link from 'next/link';
import { Car, ArrowLeft } from 'lucide-react';

export default function NotFound() {
  return (
    <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center p-4 text-center">
      <div className="w-16 h-16 rounded-2xl bg-teal-500/20 text-teal-400 flex items-center justify-center mb-4">
        <Car className="w-8 h-8" />
      </div>
      <h1 className="text-4xl font-black text-white">404 - Page Not Found</h1>
      <p className="text-gray-400 mt-2 text-sm max-w-sm">
        The parking page you're searching for does not exist or has been moved.
      </p>
      <Link
        href="/login"
        className="mt-6 inline-flex items-center gap-2 px-5 py-2.5 bg-teal-600 hover:bg-teal-700 text-white font-semibold text-sm rounded-xl transition"
      >
        <ArrowLeft className="w-4 h-4" />
        Return to Safety
      </Link>
    </div>
  );
}

