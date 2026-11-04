import React from 'react';

const badgeStyles = {
  // Slot & Reservation statuses
  AVAILABLE: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  CONFIRMED: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  ACTIVE: 'bg-blue-50 text-blue-700 border-blue-200',
  RESERVED: 'bg-amber-50 text-amber-700 border-amber-200',
  OCCUPIED: 'bg-indigo-50 text-indigo-700 border-indigo-200',
  MAINTENANCE: 'bg-rose-50 text-rose-700 border-rose-200',
  CANCELLED: 'bg-gray-100 text-gray-600 border-gray-300',
  COMPLETED: 'bg-slate-100 text-slate-700 border-slate-300',
  EXPIRED: 'bg-orange-50 text-orange-700 border-orange-200',

  // Payment & Violation statuses
  SUCCESS: 'bg-teal-50 text-teal-700 border-teal-200',
  PAID: 'bg-teal-50 text-teal-700 border-teal-200',
  PENDING: 'bg-yellow-50 text-yellow-800 border-yellow-300',
  UNPAID: 'bg-red-50 text-red-700 border-red-200',
  FAILED: 'bg-rose-50 text-rose-700 border-rose-200',

  // Roles & Types
  ADMIN: 'bg-purple-50 text-purple-700 border-purple-200',
  DRIVER: 'bg-sky-50 text-sky-700 border-sky-200',
  CAR: 'bg-blue-50 text-blue-700 border-blue-200',
  BIKE: 'bg-amber-50 text-amber-700 border-amber-200',
  EV: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  DISABLED: 'bg-violet-50 text-violet-700 border-violet-200',
};

export const Badge = ({ status, className = '' }) => {
  const normalized = (status || '').toUpperCase();
  const style = badgeStyles[normalized] || 'bg-gray-100 text-gray-700 border-gray-200';

  return (
    <span
      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${style} ${className}`}
    >
      <span className="w-1.5 h-1.5 mr-1.5 rounded-full bg-current opacity-70"></span>
      {status}
    </span>
  );
};

export default Badge;

