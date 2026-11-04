import React, { useState, useEffect } from 'react';
import { Menu, Bell, Database, CheckCircle2, AlertCircle } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { systemApi, notificationsApi } from '../../api/client';

export const Navbar = ({ onToggleSidebar, isCollapsed = false }) => {
  const { user, isAdmin } = useAuth();
  const [health, setHealth] = useState({ mysql: 'connected', mongodb: 'connected' });
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    const checkSystem = async () => {
      try {
        const res = await systemApi.getHealth();
        setHealth({ mysql: res.mysql, mongodb: res.mongodb });
      } catch {
        setHealth({ mysql: 'disconnected', mongodb: 'disconnected' });
      }
    };

    const fetchNotifications = async () => {
      if (!isAdmin) {
        try {
          const res = await notificationsApi.getAll();
          if (res.success && res.notifications) {
            const unread = res.notifications.filter((n) => n.is_read !== 'Y').length;
            setUnreadCount(unread);
          }
        } catch {
          // ignore
        }
      }
    };

    checkSystem();
    fetchNotifications();

    const interval = setInterval(checkSystem, 30000);
    return () => clearInterval(interval);
  }, [isAdmin]);

  return (
    <header className="h-16 bg-white border-b border-gray-200 flex items-center justify-between px-4 lg:px-8 sticky top-0 z-30 shadow-xs">
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={onToggleSidebar}
          className="p-2 rounded-xl text-gray-600 hover:text-gray-900 hover:bg-gray-100 transition-colors focus:outline-none focus:ring-2 focus:ring-teal-500/20 cursor-pointer"
          aria-label="Toggle Navigation Sidebar"
          title={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          <Menu className="w-5 h-5" />
        </button>
        <div>
          <h1 className="text-base font-semibold text-gray-800 flex items-center gap-2">
            <span>ParkSync</span>
            <span className="font-normal text-gray-300">|</span>
            <span className="text-teal-600 font-medium text-sm sm:text-base">
              {isAdmin ? 'Admin Management' : 'Driver Console'}
            </span>
          </h1>
        </div>
      </div>

      <div className="flex items-center gap-3 lg:gap-4">
        {/* Database Status Badges for DBMS Viva */}
        <div className="hidden sm:flex items-center gap-2">
          <div
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium border ${
              health.mysql === 'connected'
                ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                : 'bg-rose-50 text-rose-700 border-rose-200'
            }`}
            title="MySQL 8.0 Relational Storage"
          >
            <Database className="w-3 h-3" />
            <span>MySQL: {health.mysql}</span>
          </div>

          <div
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium border ${
              health.mongodb === 'connected'
                ? 'bg-teal-50 text-teal-700 border-teal-200'
                : 'bg-amber-50 text-amber-700 border-amber-200'
            }`}
            title="MongoDB NoSQL Activity Logs"
          >
            <span className="w-1.5 h-1.5 rounded-full bg-teal-500"></span>
            <span>Mongo NoSQL: {health.mongodb}</span>
          </div>
        </div>

        {/* Notifications Icon (For Drivers) */}
        {!isAdmin && (
          <Link
            to="/driver/notifications"
            className="relative p-2 text-gray-500 hover:text-teal-600 rounded-lg hover:bg-gray-100 transition"
            title="Notifications"
          >
            <Bell className="w-5 h-5" />
            {unreadCount > 0 && (
              <span className="absolute top-1 right-1 w-4 h-4 bg-rose-500 text-white rounded-full text-[10px] font-bold flex items-center justify-center animate-pulse">
                {unreadCount > 9 ? '9+' : unreadCount}
              </span>
            )}
          </Link>
        )}

        {/* Role Pill */}
        <div className="flex items-center gap-2 pl-2 border-l border-gray-200">
          <span className="px-2.5 py-1 rounded-md text-xs font-semibold bg-gray-100 text-gray-700">
            {user?.role || 'DRIVER'}
          </span>
        </div>
      </div>
    </header>
  );
};

export default Navbar;

