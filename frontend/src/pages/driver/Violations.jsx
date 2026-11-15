import React, { useState, useEffect } from 'react';
import { AlertOctagon, CheckCircle2, ShieldAlert } from 'lucide-react';
import { violationsApi } from '../../api/client';
import Badge from '../../components/common/Badge';
import Loader from '../../components/common/Loader';
import EmptyState from '../../components/common/EmptyState';
import ConfirmModal from '../../components/common/ConfirmModal';
import { formatINR } from '../../utils/formatters';
import EmbeddedSqlBadge from '../../components/common/EmbeddedSqlBadge';
import { EMBEDDED_QUERIES } from '../../db/embeddedQueries';

// Embedded SQL Lookup statement incorporated directly for academic DBMS evaluation:
const EMBEDDED_VIOLATIONS_SQL = EMBEDDED_QUERIES.VIOLATION_VEHICLE_LOCATION_LOOKUP.sql;

export const Violations = () => {
  const [violations, setViolations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [payTarget, setPayTarget] = useState(null);
  const [processing, setProcessing] = useState(false);

  const fetchViolations = async () => {
    try {
      setLoading(true);
      const res = await violationsApi.getAll();
      if (res.success) setViolations(res.violations);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchViolations();
  }, []);

  const handlePayViolation = async () => {
    if (!payTarget) return;
    try {
      setProcessing(true);
      await violationsApi.payDemo(payTarget.violation_id);
      setPayTarget(null);
      fetchViolations();
    } catch (err) {
      alert(err.message || 'Payment failed');
    } finally {
      setProcessing(false);
    }
  };

  if (loading) return <Loader message="Checking violation records..." fullHeight />;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h2 className="text-2xl font-bold text-gray-900 tracking-tight">Violations & Fines</h2>
            <EmbeddedSqlBadge queryKey="VIOLATION_VEHICLE_LOCATION_LOOKUP" />
          </div>
          <p className="text-sm text-gray-500 mt-1">
            Review any parking infractions issued to your registered vehicles.
          </p>
        </div>
      </div>

      {violations.length === 0 ? (
        <EmptyState
          icon={CheckCircle2}
          title="No violations on record!"
          description="Great job! Your registered vehicles have zero active parking violations."
        />
      ) : (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-gray-700">
              <thead className="bg-gray-50/75 border-b border-gray-100 text-[11px] font-bold text-gray-500 uppercase tracking-wider">
                <tr>
                  <th className="px-5 py-3.5">Violation ID</th>
                  <th className="px-5 py-3.5">Vehicle</th>
                  <th className="px-5 py-3.5">Slot / Area</th>
                  <th className="px-5 py-3.5">Violation Type</th>
                  <th className="px-5 py-3.5">Fine Amount</th>
                  <th className="px-5 py-3.5">Issue Time</th>
                  <th className="px-5 py-3.5">Status</th>
                  <th className="px-5 py-3.5 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {violations.map((v) => {
                  const isUnpaid = v.payment_status === 'UNPAID';

                  return (
                    <tr key={v.violation_id} className="hover:bg-gray-50/60 transition">
                      <td className="px-5 py-4 font-mono font-medium text-xs text-gray-900">
                        #{v.violation_id}
                      </td>

                      <td className="px-5 py-4 text-xs font-bold text-gray-900">
                        {v.registration_no}
                      </td>

                      <td className="px-5 py-4 text-xs">
                        <span className="font-semibold text-gray-800">Slot {v.slot_number}</span>
                        <span className="text-gray-400 block text-[11px]">{v.area_name}</span>
                      </td>

                      <td className="px-5 py-4 text-xs text-rose-700 font-medium">
                        {v.violation_type}
                      </td>

                      <td className="px-5 py-4 text-xs font-black text-gray-900">
                        {formatINR(v.fine_amount)}
                      </td>

                      <td className="px-5 py-4 text-xs text-gray-500">
                        {v.violation_time ? new Date(v.violation_time).toLocaleString() : '—'}
                      </td>

                      <td className="px-5 py-4">
                        <Badge status={v.payment_status} />
                      </td>

                      <td className="px-5 py-4 text-right">
                        {isUnpaid && (
                          <button
                            onClick={() => setPayTarget(v)}
                            className="px-3 py-1.5 text-xs font-semibold text-white bg-rose-600 hover:bg-rose-700 rounded-lg transition shadow-2xs"
                          >
                            Pay Fine
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

      {/* Pay Fine Modal */}
      <ConfirmModal
        isOpen={!!payTarget}
        title="Pay Parking Fine (Demo)"
        message={`Simulating fine settlement of ${formatINR(payTarget?.fine_amount)} for ${payTarget?.violation_type} on vehicle ${payTarget?.registration_no}.`}
        confirmText="Pay Fine Now"
        cancelText="Cancel"
        isDanger={false}
        isLoading={processing}
        onConfirm={handlePayViolation}
        onClose={() => setPayTarget(null)}
      />
    </div>
  );
};

export default Violations;

