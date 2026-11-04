import React, { useState, useEffect } from 'react';
import { History, Clock, MapPin, Car } from 'lucide-react';
import { sessionsApi } from '../../api/client';
import Badge from '../../components/common/Badge';
import Loader from '../../components/common/Loader';
import EmptyState from '../../components/common/EmptyState';
import { formatINR } from '../../utils/formatters';

export const ParkingSessions = () => {
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchSessions = async () => {
      try {
        setLoading(true);
        const res = await sessionsApi.getAll();
        if (res.success) setSessions(res.sessions);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    fetchSessions();
  }, []);

  if (loading) return <Loader message="Fetching parking session records..." fullHeight />;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-900 tracking-tight">Parking Session History</h2>
        <p className="text-sm text-gray-500 mt-1">
          Detailed check-in, check-out, and active parking duration records.
        </p>
      </div>

      {sessions.length === 0 ? (
        <EmptyState
          icon={History}
          title="No parking sessions found"
          description="You do not have any vehicle check-in or session history yet."
        />
      ) : (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-gray-700">
              <thead className="bg-gray-50/75 border-b border-gray-100 text-[11px] font-bold text-gray-500 uppercase tracking-wider">
                <tr>
                  <th className="px-5 py-3.5">Session ID</th>
                  <th className="px-5 py-3.5">Vehicle</th>
                  <th className="px-5 py-3.5">Slot / Area</th>
                  <th className="px-5 py-3.5">Entry Time</th>
                  <th className="px-5 py-3.5">Exit Time</th>
                  <th className="px-5 py-3.5">Fee</th>
                  <th className="px-5 py-3.5">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {sessions.map((s) => (
                  <tr key={s.session_id} className="hover:bg-gray-50/60 transition">
                    <td className="px-5 py-4 font-mono font-medium text-xs text-gray-900">
                      #{s.session_id}
                    </td>

                    <td className="px-5 py-4">
                      <span className="font-bold text-gray-900 text-xs">{s.registration_no}</span>
                      <Badge status={s.vehicle_type} className="text-[10px] ml-2" />
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
                        <span className="text-emerald-600 font-semibold italic">Currently Parked</span>
                      )}
                    </td>

                    <td className="px-5 py-4 text-xs font-bold text-gray-900">
                      {formatINR(s.fee || s.parking_fee)}
                    </td>

                    <td className="px-5 py-4">
                      <Badge status={s.status} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};

export default ParkingSessions;

