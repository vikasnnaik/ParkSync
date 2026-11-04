import React, { useState, useEffect } from 'react';
import { Bell, CheckCheck, Clock } from 'lucide-react';
import { notificationsApi } from '../../api/client';
import Loader from '../../components/common/Loader';
import EmptyState from '../../components/common/EmptyState';

export const Notifications = () => {
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchNotifications = async () => {
    try {
      setLoading(true);
      const res = await notificationsApi.getAll();
      if (res.success) setNotifications(res.notifications);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchNotifications();
  }, []);

  const handleMarkAsRead = async (id) => {
    try {
      await notificationsApi.markAsRead(id);
      setNotifications((prev) =>
        prev.map((n) => (n.notification_id === id ? { ...n, is_read: 'Y' } : n))
      );
    } catch (err) {
      console.error(err);
    }
  };

  if (loading) return <Loader message="Fetching notifications..." fullHeight />;

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-900 tracking-tight">System Notifications</h2>
        <p className="text-sm text-gray-500 mt-1">
          Stay updated with your reservation confirmations, reminders, and payment receipts.
        </p>
      </div>

      {notifications.length === 0 ? (
        <EmptyState
          icon={Bell}
          title="No notifications yet"
          description="You will receive alerts here when you book or cancel reservations."
        />
      ) : (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-xs divide-y divide-gray-100 overflow-hidden">
          {notifications.map((n) => {
            const isRead = n.is_read === 'Y';

            return (
              <div
                key={n.notification_id}
                className={`p-5 flex items-start justify-between gap-4 transition ${
                  isRead ? 'bg-white' : 'bg-teal-50/30'
                }`}
              >
                <div className="flex items-start gap-3">
                  <div
                    className={`p-2 rounded-xl mt-0.5 ${
                      isRead ? 'bg-gray-100 text-gray-400' : 'bg-teal-100 text-teal-600'
                    }`}
                  >
                    <Bell className="w-4 h-4" />
                  </div>
                  <div>
                    {n.title && (
                      <h4 className={`text-sm font-bold ${isRead ? 'text-gray-800' : 'text-teal-900'}`}>
                        {n.title}
                      </h4>
                    )}
                    <p className={`text-xs mt-0.5 ${isRead ? 'text-gray-600' : 'font-medium text-gray-800'}`}>
                      {n.message}
                    </p>
                    <p className="text-[11px] text-gray-400 flex items-center gap-1 mt-1.5">
                      <Clock className="w-3 h-3" />
                      {new Date(n.created_at).toLocaleString()}
                    </p>
                  </div>
                </div>

                {!isRead && (
                  <button
                    onClick={() => handleMarkAsRead(n.notification_id)}
                    className="p-1.5 text-teal-600 hover:text-teal-700 hover:bg-teal-50 rounded-lg transition"
                    title="Mark as read"
                  >
                    <CheckCheck className="w-4 h-4" />
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default Notifications;

