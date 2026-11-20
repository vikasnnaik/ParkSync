'use client';

import React, { useState, useEffect } from 'react';
import { CreditCard, History } from 'lucide-react';
import { paymentsApi } from '../../api/client';
import Badge from '../../components/common/Badge';
import Loader from '../../components/common/Loader';
import EmptyState from '../../components/common/EmptyState';
import { formatINR } from '../../utils/formatters';

export const PaymentsManagement = () => {
  const [payments, setPayments] = useState([]);
  const [auditLogs, setAuditLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('PAYMENTS'); // 'PAYMENTS' | 'AUDIT'

  useEffect(() => {
    const fetchPaymentsAndAudit = async () => {
      try {
        setLoading(true);
        const [payRes, auditRes] = await Promise.all([
          paymentsApi.getAll(),
          paymentsApi.getAuditLogs().catch(() => ({ success: true, auditLogs: [] }))
        ]);

        if (payRes.success) setPayments(payRes.payments);
        if (auditRes.success) setAuditLogs(auditRes.auditLogs);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    fetchPaymentsAndAudit();
  }, []);

  if (loading) return <Loader message="Loading payments and audit history..." fullHeight />;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 tracking-tight">Payments & Audit Logs</h2>
          <p className="text-sm text-gray-500 mt-1">
            Track user transactions, payment settlements, and historical financial audit trails.
          </p>
        </div>

        {/* Tab switcher */}
        <div className="flex p-1 bg-gray-100 rounded-xl self-start">
          <button
            onClick={() => setActiveTab('PAYMENTS')}
            className={`px-3.5 py-1.5 text-xs font-bold rounded-lg transition cursor-pointer ${
              activeTab === 'PAYMENTS' ? 'bg-white text-gray-900 shadow-2xs' : 'text-gray-500 hover:text-gray-900'
            }`}
          >
            All Transactions ({payments.length})
          </button>
          <button
            onClick={() => setActiveTab('AUDIT')}
            className={`px-3.5 py-1.5 text-xs font-bold rounded-lg transition flex items-center gap-1.5 cursor-pointer ${
              activeTab === 'AUDIT' ? 'bg-white text-teal-700 shadow-2xs' : 'text-gray-500 hover:text-gray-900'
            }`}
          >
            <History className="w-3.5 h-3.5" />
            Financial Audit Trail ({auditLogs.length})
          </button>
        </div>
      </div>

      {activeTab === 'PAYMENTS' ? (
        payments.length === 0 ? (
          <EmptyState icon={CreditCard} title="No payments recorded" description="No transactions have been logged." />
        ) : (
          <div className="bg-white rounded-2xl border border-gray-100 shadow-xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm text-gray-700">
                <thead className="bg-gray-50/75 border-b border-gray-100 text-[11px] font-bold text-gray-500 uppercase tracking-wider">
                  <tr>
                    <th className="px-5 py-3.5">Payment ID</th>
                    <th className="px-5 py-3.5">Driver</th>
                    <th className="px-5 py-3.5">Reservation / Slot</th>
                    <th className="px-5 py-3.5">Amount</th>
                    <th className="px-5 py-3.5">Method</th>
                    <th className="px-5 py-3.5">Transaction ID</th>
                    <th className="px-5 py-3.5">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {payments.map((p) => (
                    <tr key={p.payment_id} className="hover:bg-gray-50/60 transition">
                      <td className="px-5 py-4 font-mono font-medium text-xs text-gray-900">
                        #{p.payment_id}
                      </td>
                      <td className="px-5 py-4">
                        <span className="font-bold text-gray-900 text-xs block">{p.user_name}</span>
                        <span className="text-[11px] text-gray-400">{p.user_email}</span>
                      </td>
                      <td className="px-5 py-4 text-xs">
                        <span className="font-semibold text-gray-800">Res #{p.reservation_id}</span>
                        <span className="text-gray-400 block text-[11px]">
                          Slot {p.slot_number} ({p.registration_no})
                        </span>
                      </td>
                      <td className="px-5 py-4 font-black text-xs text-gray-900">
                        {formatINR(p.amount)}
                      </td>
                      <td className="px-5 py-4 text-xs font-semibold text-gray-700">
                        {p.payment_method}
                      </td>
                      <td className="px-5 py-4 font-mono text-xs text-gray-500">
                        {p.transaction_id || <span className="italic text-gray-400">None</span>}
                      </td>
                      <td className="px-5 py-4">
                        <Badge status={p.payment_status} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )
      ) : (
        auditLogs.length === 0 ? (
          <EmptyState
            icon={History}
            title="No audit entries"
            description="Audit entries are logged automatically upon payment status changes."
          />
        ) : (
          <div className="bg-white rounded-2xl border border-gray-100 shadow-xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm text-gray-700">
                <thead className="bg-gray-50/75 border-b border-gray-100 text-[11px] font-bold text-gray-500 uppercase tracking-wider">
                  <tr>
                    <th className="px-5 py-3.5">Audit ID</th>
                    <th className="px-5 py-3.5">Payment ID</th>
                    <th className="px-5 py-3.5">Old Status</th>
                    <th className="px-5 py-3.5">New Status</th>
                    <th className="px-5 py-3.5">Timestamp</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {auditLogs.map((log) => (
                    <tr key={log.audit_id} className="hover:bg-gray-50/60 transition">
                      <td className="px-5 py-4 font-mono font-bold text-xs text-gray-900">
                        #{log.audit_id}
                      </td>
                      <td className="px-5 py-4 text-xs font-semibold text-gray-800">
                        Payment #{log.payment_id}
                      </td>
                      <td className="px-5 py-4">
                        <Badge status={log.old_status} />
                      </td>
                      <td className="px-5 py-4">
                        <Badge status={log.new_status} />
                      </td>
                      <td className="px-5 py-4 text-xs text-gray-500">
                        {new Date(log.changed_at).toLocaleString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )
      )}
    </div>
  );
};

export default PaymentsManagement;

