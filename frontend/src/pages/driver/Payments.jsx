import React, { useState, useEffect } from 'react';
import { CreditCard, CheckCircle2, Clock, AlertCircle, ShieldCheck, X } from 'lucide-react';
import { paymentsApi } from '../../api/client';
import { useAuth } from '../../context/AuthContext';
import { launchRazorpayCheckout } from '../../utils/razorpay';
import Badge from '../../components/common/Badge';
import Loader from '../../components/common/Loader';
import EmptyState from '../../components/common/EmptyState';
import ConfirmModal from '../../components/common/ConfirmModal';
import { formatINR } from '../../utils/formatters';

export const Payments = () => {
  const { user } = useAuth();
  const [payments, setPayments] = useState([]);
  const [loading, setLoading] = useState(true);

  // Pay modal & selection
  const [payTarget, setPayTarget] = useState(null);
  const [processing, setProcessing] = useState(false);
  const [statusAlert, setStatusAlert] = useState(null);

  const fetchPayments = async () => {
    try {
      setLoading(true);
      const res = await paymentsApi.getAll();
      if (res.success) setPayments(res.payments);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPayments();
  }, []);

  /**
   * Launch Razorpay Standard Checkout
   */
  const handleRazorpayPayment = async (payment) => {
    try {
      setProcessing(true);
      setStatusAlert(null);

      // 1. Request backend to validate & create Razorpay order
      const orderRes = await paymentsApi.createOrder({
        paymentId: payment.payment_id,
        reservationId: payment.reservation_id,
      });

      if (!orderRes.success) {
        throw new Error(orderRes.message || 'Failed to initialize Razorpay order');
      }

      setPayTarget(null); // Close selection modal

      // 2. Open Razorpay Checkout Modal
      await launchRazorpayCheckout({
        orderData: orderRes,
        user,
        onSuccess: async (response) => {
          try {
            setProcessing(true);
            // 3. Verify Razorpay signature on server
            const verifyRes = await paymentsApi.verifyPayment({
              razorpay_order_id: response.razorpay_order_id,
              razorpay_payment_id: response.razorpay_payment_id,
              razorpay_signature: response.razorpay_signature,
              paymentId: payment.payment_id,
              reservationId: payment.reservation_id,
            });

            if (verifyRes.success) {
              setStatusAlert({
                type: 'success',
                message: `Payment Successful! Transaction ID: ${response.razorpay_payment_id}. Your slot booking is confirmed.`,
              });
              fetchPayments();
            } else {
              throw new Error(verifyRes.message || 'Signature verification failed.');
            }
          } catch (verifyErr) {
            setStatusAlert({
              type: 'error',
              message: verifyErr.message || 'Payment signature verification failed.',
            });
          } finally {
            setProcessing(false);
          }
        },
        onError: async (error) => {
          setProcessing(false);
          setStatusAlert({
            type: 'error',
            message: `Payment Failed: ${error.description || error.message || 'Transaction could not be completed.'}`,
          });
          await paymentsApi.reportFailure({
            paymentId: payment.payment_id,
            reservationId: payment.reservation_id,
            reason: error.description || 'Payment rejected',
            errorDetails: error,
          });
          fetchPayments();
        },
        onDismiss: async () => {
          setProcessing(false);
          setStatusAlert({
            type: 'warning',
            message: 'Payment window was closed. Your reservation remains pending so you can retry anytime.',
          });
          await paymentsApi.reportFailure({
            paymentId: payment.payment_id,
            reservationId: payment.reservation_id,
            reason: 'Checkout dismissed by user',
          });
        },
      });
    } catch (err) {
      setProcessing(false);
      setStatusAlert({
        type: 'error',
        message: err.message || 'Failed to start payment gateway.',
      });
    }
  };

  /**
   * Offline demo payment simulation fallback
   */
  const handleDemoPayment = async (payment) => {
    try {
      setProcessing(true);
      await paymentsApi.processDemoPayment(payment.payment_id, 'UPI');
      setPayTarget(null);
      setStatusAlert({
        type: 'success',
        message: `Offline Demo payment of ${formatINR(payment.amount)} completed successfully!`,
      });
      fetchPayments();
    } catch (err) {
      setStatusAlert({
        type: 'error',
        message: err.message || 'Demo payment failed',
      });
    } finally {
      setProcessing(false);
    }
  };

  if (loading) return <Loader message="Loading payment records..." fullHeight />;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 tracking-tight">Payments & Receipts</h2>
          <p className="text-sm text-gray-500 mt-1">
            Complete parking reservations using Razorpay Test Mode or review past transactions.
          </p>
        </div>
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-teal-50 border border-teal-200 text-teal-800 text-xs font-semibold self-start">
          <ShieldCheck className="w-4 h-4 text-teal-600" />
          <span>Razorpay Test Mode Active</span>
        </div>
      </div>

      {/* Status Alerts (Success, Warning, Error) */}
      {statusAlert && (
        <div
          className={`p-4 rounded-xl flex items-start justify-between gap-3 text-sm border animate-in fade-in ${
            statusAlert.type === 'success'
              ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
              : statusAlert.type === 'warning'
              ? 'bg-amber-50 text-amber-800 border-amber-200'
              : 'bg-rose-50 text-rose-800 border-rose-200'
          }`}
        >
          <div className="flex items-center gap-2">
            {statusAlert.type === 'success' && <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />}
            {statusAlert.type === 'warning' && <Clock className="w-5 h-5 text-amber-600 shrink-0" />}
            {statusAlert.type === 'error' && <AlertCircle className="w-5 h-5 text-rose-600 shrink-0" />}
            <span>{statusAlert.message}</span>
          </div>
          <button
            onClick={() => setStatusAlert(null)}
            className="text-gray-400 hover:text-gray-600 p-1"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {payments.length === 0 ? (
        <EmptyState
          icon={CreditCard}
          title="No payment records"
          description="Payments generated for parking reservations will show up here."
        />
      ) : (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-gray-700">
              <thead className="bg-gray-50/75 border-b border-gray-100 text-[11px] font-bold text-gray-500 uppercase tracking-wider">
                <tr>
                  <th className="px-5 py-3.5">Payment ID</th>
                  <th className="px-5 py-3.5">Reservation / Slot</th>
                  <th className="px-5 py-3.5">Amount</th>
                  <th className="px-5 py-3.5">Method</th>
                  <th className="px-5 py-3.5">Transaction ID</th>
                  <th className="px-5 py-3.5">Date / Time</th>
                  <th className="px-5 py-3.5">Status</th>
                  <th className="px-5 py-3.5 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {payments.map((p) => {
                  const isPending = p.payment_status === 'PENDING';

                  return (
                    <tr key={p.payment_id} className="hover:bg-gray-50/60 transition">
                      <td className="px-5 py-4 font-mono font-medium text-xs text-gray-900">
                        #{p.payment_id}
                      </td>

                      <td className="px-5 py-4 text-xs">
                        <span className="font-bold text-gray-900">Res #{p.reservation_id}</span>
                        <span className="text-gray-400 block text-[11px]">
                          Slot {p.slot_number} ({p.area_name})
                        </span>
                      </td>

                      <td className="px-5 py-4 text-xs font-black text-gray-900">
                        {formatINR(p.amount)}
                      </td>

                      <td className="px-5 py-4 text-xs font-semibold text-gray-700">
                        {p.payment_method || 'UPI'}
                      </td>

                      <td className="px-5 py-4 text-xs font-mono text-gray-600">
                        {p.transaction_id || <span className="italic text-gray-400">Pending</span>}
                      </td>

                      <td className="px-5 py-4 text-xs text-gray-500">
                        {p.payment_time ? new Date(p.payment_time).toLocaleString() : '—'}
                      </td>

                      <td className="px-5 py-4">
                        <Badge status={p.payment_status} />
                      </td>

                      <td className="px-5 py-4 text-right">
                        {isPending && (
                          <button
                            onClick={() => setPayTarget(p)}
                            disabled={processing}
                            className="px-3.5 py-1.5 text-xs font-bold text-white bg-teal-600 hover:bg-teal-700 rounded-xl transition shadow-2xs disabled:opacity-50 inline-flex items-center gap-1.5"
                          >
                            <CreditCard className="w-3.5 h-3.5" />
                            Pay Now
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

      {/* Payment Options Modal */}
      {payTarget && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl border border-gray-100 space-y-5 animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between pb-3 border-b border-gray-100">
              <div>
                <h3 className="text-lg font-bold text-gray-900">Complete Reservation Payment</h3>
                <p className="text-xs text-gray-500">
                  Reservation #{payTarget.reservation_id} • Bay {payTarget.slot_number}
                </p>
              </div>
              <button
                onClick={() => setPayTarget(null)}
                className="text-gray-400 hover:text-gray-600 p-1"
              >
                ✕
              </button>
            </div>

            <div className="bg-slate-50 rounded-xl p-4 flex items-center justify-between border border-slate-100">
              <span className="text-xs text-gray-600 font-medium">Total Payable Amount</span>
              <span className="text-2xl font-black text-gray-900">{formatINR(payTarget.amount)}</span>
            </div>

            <div className="space-y-3">
              {/* Option 1: Razorpay Checkout */}
              <button
                type="button"
                disabled={processing}
                onClick={() => handleRazorpayPayment(payTarget)}
                className="w-full p-4 rounded-xl border-2 border-teal-500 bg-teal-50/50 hover:bg-teal-100/70 transition flex items-center justify-between text-left group disabled:opacity-50"
              >
                <div>
                  <p className="text-sm font-bold text-teal-900 flex items-center gap-2">
                    <CreditCard className="w-4 h-4 text-teal-600" />
                    Razorpay Checkout (Test Mode)
                  </p>
                  <p className="text-xs text-teal-700 mt-0.5">
                    Pay securely using UPI, Credit/Debit Cards, Netbanking, or Wallets
                  </p>
                </div>
                <span className="text-xs font-bold text-teal-700 bg-teal-200/60 px-2 py-1 rounded-md shrink-0">
                  Recommended →
                </span>
              </button>

              {/* Option 2: Demo Simulation */}
              <button
                type="button"
                disabled={processing}
                onClick={() => handleDemoPayment(payTarget)}
                className="w-full p-3.5 rounded-xl border border-gray-200 hover:bg-gray-50 transition flex items-center justify-between text-left disabled:opacity-50"
              >
                <div>
                  <p className="text-xs font-semibold text-gray-800">
                    Simulate Instant Confirmation (Offline Demo)
                  </p>
                  <p className="text-[11px] text-gray-500 mt-0.5">
                    Triggers database triggers without loading external gateways
                  </p>
                </div>
                <span className="text-xs text-gray-400">Run →</span>
              </button>
            </div>

            <div className="pt-2 flex justify-end">
              <button
                type="button"
                onClick={() => setPayTarget(null)}
                className="px-4 py-2 text-xs font-semibold text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-xl transition"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Payments;
