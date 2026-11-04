import React, { useState, useEffect } from 'react';
import { History, Plus, CheckCircle2, Clock } from 'lucide-react';
import { sessionsApi, slotsApi, vehiclesApi } from '../../api/client';
import Badge from '../../components/common/Badge';
import Loader from '../../components/common/Loader';
import EmptyState from '../../components/common/EmptyState';
import ConfirmModal from '../../components/common/ConfirmModal';
import { formatINR } from '../../utils/formatters';

export const SessionsManagement = () => {
  const [sessions, setSessions] = useState([]);
  const [slots, setSlots] = useState([]);
  const [loading, setLoading] = useState(true);

  // Manual Check-in modal
  const [modalOpen, setModalOpen] = useState(false);
  const [checkInData, setCheckInData] = useState({ vehicleId: '', slotId: '' });
  const [modalLoading, setModalLoading] = useState(false);

  // End Session modal
  const [endTarget, setEndTarget] = useState(null);
  const [endLoading, setEndLoading] = useState(false);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [sesRes, slotsRes] = await Promise.all([
        sessionsApi.getAll(),
        slotsApi.getAll({ status: 'AVAILABLE' })
      ]);

      if (sesRes.success) setSessions(sesRes.sessions);
      if (slotsRes.success) {
        setSlots(slotsRes.slots);
        if (slotsRes.slots.length > 0) {
          setCheckInData((prev) => ({ ...prev, slotId: slotsRes.slots[0].slot_id }));
        }
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleStartSession = async (e) => {
    e.preventDefault();
    try {
      setModalLoading(true);
      await sessionsApi.start(checkInData);
      setModalOpen(false);
      fetchData();
    } catch (err) {
      alert(err.message || 'Check-in failed');
    } finally {
      setModalLoading(false);
    }
  };

  const handleEndSession = async () => {
    if (!endTarget) return;
    try {
      setEndLoading(true);
      await sessionsApi.end(endTarget.session_id);
      setEndTarget(null);
      fetchData();
    } catch (err) {
      alert(err.message || 'Check-out failed');
    } finally {
      setEndLoading(false);
    }
  };

  if (loading && sessions.length === 0) return <Loader message="Loading parking sessions..." fullHeight />;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 tracking-tight">Active Parking Sessions</h2>
          <p className="text-sm text-gray-500 mt-1">
            Real-time physical barrier entry and exit monitoring across bays.
          </p>
        </div>
        <button
          onClick={() => setModalOpen(true)}
          className="px-4 py-2.5 bg-teal-600 hover:bg-teal-700 text-white font-semibold text-xs rounded-xl transition shadow-xs flex items-center gap-1.5 self-start"
        >
          <Plus className="w-4 h-4" />
          Simulate Vehicle Entry
        </button>
      </div>

      {sessions.length === 0 ? (
        <EmptyState
          icon={History}
          title="No parking sessions"
          description="Vehicle entries will be recorded here in real-time."
          actionLabel="Record Entry"
          onAction={() => setModalOpen(true)}
        />
      ) : (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-gray-700">
              <thead className="bg-gray-50/75 border-b border-gray-100 text-[11px] font-bold text-gray-500 uppercase tracking-wider">
                <tr>
                  <th className="px-5 py-3.5">Session ID</th>
                  <th className="px-5 py-3.5">Vehicle</th>
                  <th className="px-5 py-3.5">Owner / Driver</th>
                  <th className="px-5 py-3.5">Slot / Area</th>
                  <th className="px-5 py-3.5">Entry Time</th>
                  <th className="px-5 py-3.5">Exit Time</th>
                  <th className="px-5 py-3.5">Fee</th>
                  <th className="px-5 py-3.5">Status</th>
                  <th className="px-5 py-3.5 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {sessions.map((s) => {
                  const isOngoing = s.status === 'ONGOING';

                  return (
                    <tr key={s.session_id} className="hover:bg-gray-50/60 transition">
                      <td className="px-5 py-4 font-mono font-medium text-xs text-gray-900">
                        #{s.session_id}
                      </td>

                      <td className="px-5 py-4">
                        <span className="font-bold text-gray-900 text-xs block">{s.registration_no}</span>
                        <Badge status={s.vehicle_type} className="text-[10px] mt-0.5" />
                      </td>

                      <td className="px-5 py-4 text-xs">
                        <span className="font-semibold text-gray-800">{s.user_name}</span>
                        <span className="text-[11px] text-gray-400 block">{s.user_email}</span>
                      </td>

                      <td className="px-5 py-4 text-xs">
                        <span className="font-semibold text-gray-800">Slot {s.slot_number}</span>
                        <span className="text-gray-400 block text-[11px]">{s.area_name}</span>
                      </td>

                      <td className="px-5 py-4 text-xs text-gray-600">
                        {new Date(s.entry_time).toLocaleString()}
                      </td>

                      <td className="px-5 py-4 text-xs text-gray-600">
                        {s.exit_time ? new Date(s.exit_time).toLocaleString() : (
                          <span className="text-emerald-600 font-semibold italic">Ongoing</span>
                        )}
                      </td>

                      <td className="px-5 py-4 text-xs font-bold text-gray-900">
                        {formatINR(s.fee || s.parking_fee)}
                      </td>

                      <td className="px-5 py-4">
                        <Badge status={s.status} />
                      </td>

                      <td className="px-5 py-4 text-right">
                        {isOngoing && (
                          <button
                            onClick={() => setEndTarget(s)}
                            className="px-3 py-1.5 text-xs font-semibold text-rose-600 bg-rose-50 hover:bg-rose-100 rounded-lg transition"
                          >
                            Check Out
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Check In Modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl border border-gray-100">
            <h3 className="text-lg font-bold text-gray-900 mb-4">Simulate Vehicle Entry</h3>
            <form onSubmit={handleStartSession} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-gray-700 uppercase mb-1">
                  Vehicle ID
                </label>
                <input
                  type="number"
                  required
                  placeholder="Enter registered vehicle ID (e.g. 1)"
                  value={checkInData.vehicleId}
                  onChange={(e) => setCheckInData({ ...checkInData, vehicleId: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-xl text-sm focus:ring-2 focus:ring-teal-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 uppercase mb-1">
                  Available Slot
                </label>
                <select
                  required
                  value={checkInData.slotId}
                  onChange={(e) => setCheckInData({ ...checkInData, slotId: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-xl text-sm focus:ring-2 focus:ring-teal-500"
                >
                  {slots.map((s) => (
                    <option key={s.slot_id} value={s.slot_id}>
                      Slot {s.slot_number} ({s.area_name}) - {s.slot_type}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex justify-end gap-3 mt-6 pt-3 border-t border-gray-100">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="px-4 py-2 text-xs font-semibold text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-xl transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={modalLoading}
                  className="px-4 py-2 text-xs font-bold text-white bg-teal-600 hover:bg-teal-700 rounded-xl transition disabled:opacity-50"
                >
                  {modalLoading ? 'Processing...' : 'Confirm Entry'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* End Session Confirmation */}
      <ConfirmModal
        isOpen={!!endTarget}
        title="Check Out Vehicle"
        message={`Confirm vehicle exit for Session #${endTarget?.session_id} at Slot ${endTarget?.slot_number}? This will calculate parking fee and free the bay.`}
        confirmText="Confirm Exit"
        isDanger={false}
        isLoading={endLoading}
        onConfirm={handleEndSession}
        onClose={() => setEndTarget(null)}
      />
    </div>
  );
};

export default SessionsManagement;

