import React, { useState, useEffect } from 'react';
import { CalendarCheck, Filter, Clock, CheckCircle2, XCircle } from 'lucide-react';
import { reservationsApi } from '../../api/client';
import Badge from '../../components/common/Badge';
import Loader from '../../components/common/Loader';
import EmptyState from '../../components/common/EmptyState';
import ConfirmModal from '../../components/common/ConfirmModal';
import { formatINR } from '../../utils/formatters';

export const ReservationsManagement = () => {
  const [reservations, setReservations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('');

  // Status Change Modal
  const [targetRes, setTargetRes] = useState(null);
  const [newStatus, setNewStatus] = useState('');
  const [updating, setUpdating] = useState(false);

  const fetchReservations = async () => {
    try {
      setLoading(true);
      const res = await reservationsApi.getAll({
        status: statusFilter || undefined,
      });
      if (res.success) setReservations(res.reservations);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReservations();
  }, [statusFilter]);

  const handleUpdateStatus = async () => {
    if (!targetRes || !newStatus) return;
    try {
      setUpdating(true);
      await reservationsApi.updateStatus(targetRes.reservation_id, newStatus);
      setTargetRes(null);
      fetchReservations();
    } catch (err) {
      alert(err.message || 'Failed to update reservation');
    } finally {
      setUpdating(false);
    }
  };

  if (loading && reservations.length === 0) return <Loader message="Loading reservations..." fullHeight />;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 tracking-tight">Reservation Management</h2>
          <p className="text-sm text-gray-500 mt-1">
            Monitor, confirm, cancel, and complete all driver reservations across areas.
          </p>
        </div>
      </div>

      {/* Filter */}
      <div className="bg-white p-4 rounded-2xl border border-gray-100 shadow-xs flex items-center gap-3">
        <span className="text-xs font-semibold text-gray-500 uppercase">Filter by Status:</span>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="text-xs border border-gray-200 rounded-xl p-2 focus:ring-2 focus:ring-teal-500"
        >
          <option value="">All Statuses</option>
          <option value="CONFIRMED">CONFIRMED</option>
          <option value="ACTIVE">ACTIVE</option>
          <option value="COMPLETED">COMPLETED</option>
          <option value="CANCELLED">CANCELLED</option>
        </select>
      </div>

      {reservations.length === 0 ? (
        <EmptyState
          icon={CalendarCheck}
          title="No reservations found"
          description="There are currently no reservations under this filter."
        />
      ) : (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-gray-700">
              <thead className="bg-gray-50/75 border-b border-gray-100 text-[11px] font-bold text-gray-500 uppercase tracking-wider">
                <tr>
                  <th className="px-5 py-3.5">ID / Driver</th>
                  <th className="px-5 py-3.5">Vehicle / Slot</th>
                  <th className="px-5 py-3.5">Area</th>
                  <th className="px-5 py-3.5">Time Period</th>
                  <th className="px-5 py-3.5">Payment</th>
                  <th className="px-5 py-3.5">Status</th>
                  <th className="px-5 py-3.5 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {reservations.map((r) => (
                  <tr key={r.reservation_id} className="hover:bg-gray-50/60 transition">
                    <td className="px-5 py-4">
                      <span className="text-xs text-gray-400 font-mono block">#{r.reservation_id}</span>
                      <span className="font-bold text-gray-900 text-xs">{r.user_name}</span>
                      <span className="text-[11px] text-gray-400 block">{r.user_email}</span>
                    </td>

                    <td className="px-5 py-4 text-xs">
                      <span className="font-bold text-teal-800">{r.registration_no}</span>
                      <span className="text-gray-500 block">Bay {r.slot_number}</span>
                    </td>

                    <td className="px-5 py-4 text-xs font-medium text-gray-800">
                      {r.area_name}
                    </td>

                    <td className="px-5 py-4 text-xs text-gray-600">
                      <p className="font-semibold text-gray-800">
                        {new Date(r.start_time).toLocaleDateString()}
                      </p>
                      <p className="text-[11px] text-gray-500">
                        {new Date(r.start_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} -{' '}
                        {new Date(r.end_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </p>
                    </td>

                    <td className="px-5 py-4 text-xs">
                      <p className="font-bold text-gray-900">{formatINR(r.amount)}</p>
                      <Badge status={r.payment_status || 'PENDING'} className="text-[10px] mt-0.5" />
                    </td>

                    <td className="px-5 py-4">
                      <Badge status={r.status} />
                    </td>

                    <td className="px-5 py-4 text-right">
                      <button
                        onClick={() => {
                          setTargetRes(r);
                          setNewStatus(r.status);
                        }}
                        className="px-2.5 py-1 text-xs font-semibold text-teal-700 bg-teal-50 hover:bg-teal-100 rounded-lg transition"
                      >
                        Update Status
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Update Status Modal */}
      {targetRes && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-sm w-full p-6 shadow-xl border border-gray-100 space-y-4">
            <h3 className="text-base font-bold text-gray-900">
              Update Reservation #{targetRes.reservation_id}
            </h3>
            <p className="text-xs text-gray-500">
              Current Status: <strong>{targetRes.status}</strong>
            </p>

            <div>
              <label className="block text-xs font-semibold text-gray-700 uppercase mb-1">
                New Status
              </label>
              <select
                value={newStatus}
                onChange={(e) => setNewStatus(e.target.value)}
                className="w-full p-2.5 border border-gray-300 rounded-xl text-sm focus:ring-2 focus:ring-teal-500"
              >
                <option value="CONFIRMED">CONFIRMED</option>
                <option value="ACTIVE">ACTIVE (Vehicle in slot)</option>
                <option value="COMPLETED">COMPLETED (Frees slot)</option>
                <option value="CANCELLED">CANCELLED (Frees slot)</option>
              </select>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setTargetRes(null)}
                className="px-3.5 py-1.5 text-xs font-medium text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-xl"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={updating}
                onClick={handleUpdateStatus}
                className="px-3.5 py-1.5 text-xs font-bold text-white bg-teal-600 hover:bg-teal-700 rounded-xl disabled:opacity-50"
              >
                {updating ? 'Updating...' : 'Save Status'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ReservationsManagement;

