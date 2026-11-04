import React from 'react';

export const StatCard = ({ title, value, subtitle, icon: Icon, color = 'teal', trend }) => {
  const colorMap = {
    teal: {
      bg: 'bg-teal-50',
      iconBg: 'bg-teal-500 text-white',
      border: 'border-teal-100',
    },
    blue: {
      bg: 'bg-blue-50',
      iconBg: 'bg-blue-600 text-white',
      border: 'border-blue-100',
    },
    emerald: {
      bg: 'bg-emerald-50',
      iconBg: 'bg-emerald-600 text-white',
      border: 'border-emerald-100',
    },
    amber: {
      bg: 'bg-amber-50',
      iconBg: 'bg-amber-500 text-white',
      border: 'border-amber-100',
    },
    rose: {
      bg: 'bg-rose-50',
      iconBg: 'bg-rose-500 text-white',
      border: 'border-rose-100',
    },
    purple: {
      bg: 'bg-purple-50',
      iconBg: 'bg-purple-600 text-white',
      border: 'border-purple-100',
    },
  };

  const scheme = colorMap[color] || colorMap.teal;

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5 transition hover:shadow-md">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">{title}</p>
          <p className="text-2xl font-bold text-gray-900 mt-1">{value}</p>
          {subtitle && <p className="text-xs text-gray-500 mt-1">{subtitle}</p>}
        </div>
        {Icon && (
          <div className={`p-3 rounded-xl ${scheme.iconBg} shadow-sm`}>
            <Icon className="w-6 h-6" />
          </div>
        )}
      </div>
      {trend && (
        <div className="mt-3 pt-3 border-t border-gray-50 flex items-center text-xs text-gray-600">
          {trend}
        </div>
      )}
    </div>
  );
};

export default StatCard;

