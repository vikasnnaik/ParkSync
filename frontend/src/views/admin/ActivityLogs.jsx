'use client';

import React, { useState, useEffect } from 'react';
import { Activity, Search, RefreshCw, AlertCircle } from 'lucide-react';
import { activityLogsApi } from '../../api/client';
import Loader from '../../components/common/Loader';
import EmptyState from '../../components/common/EmptyState';

export const ActivityLogs = () => {
  const [logs, setLogs] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [mongoOnline, setMongoOnline] = useState(true);
  const [loading, setLoading] = useState(true);

  // Filters
  const [entityType, setEntityType] = useState('');
  const [actionSearch, setActionSearch] = useState('');
  const [actorRole, setActorRole] = useState('');

  // Selected Log Details Modal
  const [selectedLog, setSelectedLog] = useState(null);

  const fetchLogs = async () => {
    try {
      setLoading(true);
      const res = await activityLogsApi.getAll({
        entityType: entityType || undefined,
        action: actionSearch || undefined,
        actorRole: actorRole || undefined,
        page,
        limit: 25,
      });

      if (res.success) {
        setLogs(res.logs || []);
        setTotal(res.total || 0);
        setPages(res.pages || 1);
        setMongoOnline(res.mongoOnline !== false);
      }
    } catch (err) {
      console.error(err);
      setMongoOnline(false);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();
  }, [page, entityType, actorRole]);

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    setPage(1);
    fetchLogs();
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 tracking-tight">
            System Activity Logs
          </h2>
          <p className="text-sm text-gray-500 mt-1">
            Audit trail and event history across user sessions, reservations, and vehicle operations.
          </p>
        </div>

        <button
          onClick={fetchLogs}
          className="inline-flex items-center gap-2 px-3.5 py-2 text-xs font-semibold text-gray-700 bg-white border border-gray-200 rounded-xl hover:bg-gray-50 transition shadow-2xs self-start cursor-pointer"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          Refresh Logs
        </button>
      </div>

      {!mongoOnline && (
        <div className="p-4 bg-amber-50 border border-amber-200 rounded-2xl flex items-start gap-3 text-sm text-amber-800">
          <AlertCircle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
          <div>
            <p className="font-bold">Activity Logging Notice</p>
            <p className="text-xs text-amber-700 mt-0.5">
              The audit logging service is temporarily unavailable. Main parking and operational features continue to function seamlessly.
            </p>
          </div>
        </div>
      )}

      {/* Filter Bar */}
      <div className="bg-white p-4 rounded-2xl border border-gray-100 shadow-xs grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">Entity Type</label>
          <select
            value={entityType}
            onChange={(e) => {
              setEntityType(e.target.value);
              setPage(1);
            }}
            className="w-full text-xs border border-gray-200 rounded-xl p-2.5 focus:ring-2 focus:ring-teal-500"
          >
            <option value="">All Entities</option>
            <option value="USER">USER</option>
            <option value="RESERVATION">RESERVATION</option>
            <option value="SLOT">SLOT</option>
            <option value="PAYMENT">PAYMENT</option>
            <option value="VIOLATION">VIOLATION</option>
            <option value="SESSION">SESSION</option>
            <option value="PARKING_AREA">PARKING_AREA</option>
          </select>
        </div>

        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">Actor Role</label>
          <select
            value={actorRole}
            onChange={(e) => {
              setActorRole(e.target.value);
              setPage(1);
            }}
            className="w-full text-xs border border-gray-200 rounded-xl p-2.5 focus:ring-2 focus:ring-teal-500"
          >
            <option value="">All Actor Roles</option>
            <option value="ADMIN">ADMIN</option>
            <option value="DRIVER">DRIVER</option>
            <option value="SYSTEM">SYSTEM</option>
          </select>
        </div>

        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">Search Action</label>
          <form onSubmit={handleSearchSubmit} className="relative">
            <input
              type="text"
              placeholder="e.g. login, created, cancelled"
              value={actionSearch}
              onChange={(e) => setActionSearch(e.target.value)}
              className="w-full text-xs border border-gray-200 rounded-xl p-2.5 pr-8 focus:ring-2 focus:ring-teal-500"
            />
            <button
              type="submit"
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
            >
              <Search className="w-3.5 h-3.5" />
            </button>
          </form>
        </div>
      </div>

      {/* Logs Table */}
      {loading && logs.length === 0 ? (
        <Loader message="Fetching activity records..." fullHeight />
      ) : logs.length === 0 ? (
        <EmptyState
          icon={Activity}
          title="No activity logs found"
          description="Actions performed by drivers and administrators will be recorded here automatically."
        />
      ) : (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-gray-700">
              <thead className="bg-gray-50/75 border-b border-gray-100 text-[11px] font-bold text-gray-500 uppercase tracking-wider">
                <tr>
                  <th className="px-5 py-3.5">Action</th>
                  <th className="px-5 py-3.5">Entity</th>
                  <th className="px-5 py-3.5">Actor</th>
                  <th className="px-5 py-3.5">Timestamp</th>
                  <th className="px-5 py-3.5 text-right">Details Payload</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {logs.map((log) => (
                  <tr key={log._id} className="hover:bg-gray-50/60 transition">
                    <td className="px-5 py-4">
                      <span className="font-bold text-gray-900 text-xs block">{log.action}</span>
                      <span className="text-[10px] text-gray-400 font-mono">_id: {log._id}</span>
                    </td>

                    <td className="px-5 py-4">
                      <span className="text-[11px] font-mono font-bold bg-teal-50 text-teal-800 px-2 py-0.5 rounded border border-teal-200">
                        {log.entityType}
                      </span>
                      {log.entityId && (
                        <span className="text-xs text-gray-500 ml-2 font-mono">
                          ID: #{log.entityId}
                        </span>
                      )}
                    </td>

                    <td className="px-5 py-4 text-xs">
                      <span className="font-semibold text-gray-800 block">
                        {log.actorEmail || `User #${log.actorId || 'System'}`}
                      </span>
                      <span className="text-[10px] text-gray-400 uppercase font-bold">
                        {log.actorRole}
                      </span>
                    </td>

                    <td className="px-5 py-4 text-xs text-gray-500">
                      {new Date(log.timestamp).toLocaleString()}
                    </td>

                    <td className="px-5 py-4 text-right">
                      <button
                        onClick={() => setSelectedLog(log)}
                        className="px-2.5 py-1 text-xs font-semibold text-teal-700 bg-teal-50 hover:bg-teal-100 rounded-lg transition"
                      >
                        Inspect JSON
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          <div className="px-5 py-3 bg-gray-50/50 border-t border-gray-100 flex items-center justify-between text-xs text-gray-500">
            <span>
              Showing Page <strong>{page}</strong> of <strong>{pages}</strong> ({total} total records)
            </span>
            <div className="flex gap-2">
              <button
                disabled={page <= 1}
                onClick={() => setPage(page - 1)}
                className="px-3 py-1 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 disabled:opacity-50"
              >
                Previous
              </button>
              <button
                disabled={page >= pages}
                onClick={() => setPage(page + 1)}
                className="px-3 py-1 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 disabled:opacity-50"
              >
                Next
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Inspect JSON Modal */}
      {selectedLog && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-xl border border-gray-100 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-gray-900">
                Activity Details: {selectedLog.action}
              </h3>
              <button
                onClick={() => setSelectedLog(null)}
                className="text-gray-400 hover:text-gray-600 font-bold"
              >
                ✕
              </button>
            </div>

            <pre className="bg-slate-900 text-teal-300 p-4 rounded-xl text-xs overflow-x-auto max-h-80 font-mono">
              {JSON.stringify(selectedLog, null, 2)}
            </pre>

            <div className="flex justify-end">
              <button
                onClick={() => setSelectedLog(null)}
                className="px-4 py-2 text-xs font-semibold text-white bg-teal-600 hover:bg-teal-700 rounded-xl"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ActivityLogs;

