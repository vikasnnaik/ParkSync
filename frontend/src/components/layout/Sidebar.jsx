import React from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard,
  MapPin,
  Grid,
  CalendarCheck,
  History,
  CreditCard,
  AlertOctagon,
  Bell,
  Layers,
  Activity,
  LogOut,
  Car,
  Database
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

export const Sidebar = ({
  isOpen = false,
  onClose = () => {},
  isMobileOpen = isOpen,
  onMobileClose = onClose,
  isCollapsed = false
}) => {
  const { user, logout, isAdmin } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const handleLinkClick = () => {
    if (onMobileClose) onMobileClose();
    if (onClose) onClose();
  };

  const driverLinks = [
    { to: '/driver/dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { to: '/driver/areas', label: 'Parking Areas', icon: MapPin },
    { to: '/driver/slots', label: 'Slot Availability', icon: Grid },
    { to: '/driver/reserve', label: 'Make Reservation', icon: CalendarCheck },
    { to: '/driver/my-reservations', label: 'My Reservations', icon: Layers },
    { to: '/driver/sessions', label: 'Session History', icon: History },
    { to: '/driver/payments', label: 'Payments', icon: CreditCard },
    { to: '/driver/violations', label: 'Violations & Fines', icon: AlertOctagon },
    { to: '/driver/notifications', label: 'Notifications', icon: Bell },
    { to: '/driver/sql-showcase', label: 'Embedded SQL (Viva)', icon: Database },
  ];

  const adminLinks = [
    { to: '/admin/dashboard', label: 'Admin Overview', icon: LayoutDashboard },
    { to: '/admin/areas', label: 'Manage Areas', icon: MapPin },
    { to: '/admin/slots', label: 'Manage Slots', icon: Grid },
    { to: '/admin/reservations', label: 'All Reservations', icon: CalendarCheck },
    { to: '/admin/sessions', label: 'Parking Sessions', icon: History },
    { to: '/admin/payments', label: 'Payment Records', icon: CreditCard },
    { to: '/admin/violations', label: 'Violations & Fines', icon: AlertOctagon },
    { to: '/admin/activity-logs', label: 'Activity Logs (NoSQL)', icon: Activity },
    { to: '/admin/sql-showcase', label: 'Embedded SQL (Viva)', icon: Database },
  ];

  const links = isAdmin ? adminLinks : driverLinks;

  return (
    <>
      {/* Mobile backdrop with blur */}
      {isMobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/60 backdrop-blur-xs lg:hidden transition-opacity"
          onClick={handleLinkClick}
        />
      )}

      <aside
        className={`fixed top-0 bottom-0 left-0 z-50 bg-navy-900 text-gray-300 flex flex-col transition-all duration-300 ease-in-out border-r border-navy-800 shadow-xl ${
          // Mobile state: slide in / out
          isMobileOpen ? 'translate-x-0 w-64' : '-translate-x-full'
        } ${
          // Desktop state: always visible, width toggled between w-64 and w-20
          isCollapsed ? 'lg:translate-x-0 lg:w-20' : 'lg:translate-x-0 lg:w-64'
        }`}
      >
        {/* Brand Logo Header */}
        <div
          className={`h-16 flex items-center border-b border-navy-800 bg-navy-950/40 transition-all duration-300 ${
            isCollapsed ? 'px-4 lg:px-0 lg:justify-center' : 'px-6'
          }`}
        >
          <div className="flex items-center gap-3">
            <div
              className="w-10 h-10 rounded-xl bg-gradient-to-br from-teal-400 to-teal-600 flex items-center justify-center text-white shadow-md shadow-teal-500/20 shrink-0"
              title="ParkSync"
            >
              <Car className="w-5 h-5 font-bold" />
            </div>
            <div className={`overflow-hidden transition-all duration-300 ${isCollapsed ? 'lg:hidden' : ''}`}>
              <span className="text-lg font-bold text-white tracking-tight flex items-center gap-1">
                Park<span className="text-teal-400">Sync</span>
              </span>
              <span className="text-[10px] text-teal-300/80 block uppercase tracking-wider font-medium truncate">
                {isAdmin ? 'Admin Console' : 'Driver Portal'}
              </span>
            </div>
          </div>
        </div>

        {/* Navigation list */}
        <div
          className={`flex-1 overflow-y-auto py-4 space-y-1 transition-all duration-300 ${
            isCollapsed ? 'px-3 lg:px-2' : 'px-3'
          }`}
        >
          <div
            className={`px-3 pb-2 text-[11px] font-semibold text-gray-400 uppercase tracking-wider truncate ${
              isCollapsed ? 'lg:hidden' : ''
            }`}
          >
            {isAdmin ? 'System Administration' : 'Parking Navigation'}
          </div>

          {isCollapsed && (
            <div className="hidden lg:block my-2 border-t border-navy-800/80 mx-2" />
          )}

          {links.map((item) => {
            const Icon = item.icon;
            return (
              <NavLink
                key={item.to}
                to={item.to}
                onClick={handleLinkClick}
                className={({ isActive }) =>
                  `flex items-center rounded-xl text-sm font-medium transition-all duration-150 group relative ${
                    isCollapsed
                      ? 'gap-3 px-3.5 py-2.5 lg:gap-0 lg:justify-center lg:p-3'
                      : 'gap-3 px-3.5 py-2.5'
                  } ${
                    isActive
                      ? 'bg-teal-500/15 text-teal-400 border border-teal-500/30 shadow-sm'
                      : 'text-gray-400 hover:text-white hover:bg-white/5 border border-transparent'
                  }`
                }
              >
                <Icon className="w-5 h-5 shrink-0" />
                <span className={`truncate whitespace-nowrap ${isCollapsed ? 'lg:hidden' : ''}`}>
                  {item.label}
                </span>

                {/* Floating tooltip on desktop for collapsed rail */}
                {isCollapsed && (
                  <span className="absolute left-full ml-3 px-2.5 py-1.5 bg-navy-950 text-white text-xs font-semibold rounded-lg shadow-xl opacity-0 group-hover:opacity-100 pointer-events-none whitespace-nowrap z-50 transition-opacity border border-navy-700 hidden lg:block">
                    {item.label}
                  </span>
                )}
              </NavLink>
            );
          })}
        </div>

        {/* User Card & Logout Footer */}
        <div
          className={`p-4 border-t border-navy-800 bg-navy-950/60 transition-all duration-300 ${
            isCollapsed ? 'lg:p-2.5 lg:flex lg:flex-col lg:items-center' : ''
          }`}
        >
          <div
            className={`flex items-center gap-3 mb-3 px-1 ${
              isCollapsed ? 'lg:mb-2 lg:px-0 lg:justify-center' : ''
            }`}
          >
            <div
              className="w-9 h-9 rounded-full bg-teal-900/60 border border-teal-500/30 flex items-center justify-center text-teal-300 font-bold text-sm shrink-0 cursor-default"
              title={`${user?.name || 'User'} (${user?.email || ''})`}
            >
              {user?.name ? user.name[0].toUpperCase() : 'U'}
            </div>
            <div className={`flex-1 min-w-0 ${isCollapsed ? 'lg:hidden' : ''}`}>
              <p className="text-sm font-semibold text-white truncate">{user?.name || 'User'}</p>
              <p className="text-xs text-gray-400 truncate">{user?.email || 'email@example.com'}</p>
            </div>
          </div>

          <button
            onClick={handleLogout}
            title={isCollapsed ? 'Sign Out' : undefined}
            className={`flex items-center justify-center text-xs font-medium text-rose-300 bg-rose-500/10 hover:bg-rose-500/20 rounded-xl transition border border-rose-500/20 cursor-pointer ${
              isCollapsed
                ? 'w-full px-3 py-2 gap-2 lg:w-10 lg:h-10 lg:p-0'
                : 'w-full px-3 py-2 gap-2'
            }`}
          >
            <LogOut className="w-4 h-4 shrink-0" />
            <span className={isCollapsed ? 'lg:hidden' : ''}>Sign Out</span>
          </button>
        </div>
      </aside>
    </>
  );
};

export default Sidebar;
