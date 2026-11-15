import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  CalendarCheck,
  Clock,
  MapPin,
  CreditCard,
  Ban,
  CheckCircle2,
  AlertCircle,
  X
} from 'lucide-react';
import { reservationsApi, paymentsApi } from '../../api/client';
import { useAuth } from '../../context/AuthContext';
import { launchRazorpayCheckout } from '../../utils/razorpay';
import Badge from '../../components/common/Badge';
import Loader from '../../components/common/Loader';
import EmptyState from '../../components/common/EmptyState';
import ConfirmModal from '../../components/common/ConfirmModal';
import { formatINR } from '../../utils/formatters';
import EmbeddedSqlBadge from '../../components/common/EmbeddedSqlBadge';
import { EMBEDDED_QUERIES } from '../../db/embeddedQueries';

// Embedded SQL View statement incorporated directly for academic DBMS evaluation:
const EMBEDDED_RESERVATION_VIEW_SQL = EMBEDDED_QUERIES.RESERVATION_DETAILS_VIEW.sql;

export const MyReservations = () => {
  const { user } = useAuth();
  const [reservations, setReservations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('ALL');

  // Cancel reservation modal
  const [cancelTarget, setCancelTarget] = useState(null);
  const [cancelLoading, setCancelLoading] = useState(false);

  // Pay options modal
  const [payingTarget, setPayingTarget] = useState(null);
  const [payLoading, setPayLoading] = useState(false);
  const [statusAlert, setStatusAlert] = useState(null);

  const fetchReservations = async () => {
    try {
      setLoading(true);
      const res = await reservationsApi.getMy();
      if (res.success) setReservations(res.reservations);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReservations();
  }, []);

  const handleCancel = async () => {
    if (!cancelTarget) return;
    try {
      setCancelLoading(true);
      await reservationsApi.cancel(cancelTarget.reservation_id, 'Driver requested cancellation');
      setCancelTarget(null);
      setStatusAlert({
        type: 'warning',
        message: `Reservation #${cancelTarget.reservation_id} cancelled. Parking bay released.`,
      });
      fetchReservations();
    } catch (err) {
      setStatusAlert({
        type: 'error',
        message: err.message || 'Failed to cancel reservation',
      });
    } finally {
      setCancelLoading(false);
    }
  };

  /**
   * Launch Razorpay Standard Checkout
   */
  const handleRazorpayPayment = async (reservation) => {
    try {
      setPayLoading(true);
      setStatusAlert(null);

      const orderRes = await paymentsApi.createOrder({
        reservationId: reservation.reservation_id,
        paymentId: reservation.payment_id,
      });

      if (!orderRes.success) {
        throw new Error(orderRes.message || 'Failed to initialize Razorpay order');
      }

      setPayingTarget(null);

      await launchRazorpayCheckout({
        orderData: orderRes,
        user,
        onSuccess: async (response) => {
          try {
            setPayLoading(true);
            const verifyRes = await paymentsApi.verifyPayment({
              razorpay_order_id: response.razorpay_order_id,
              razorpay_payment_id: response.razorpay_payment_id,
              razorpay_signature: response.razorpay_signature,
              paymentId: reservation.payment_id,
              reservationId: reservation.reservation_id,
            });

            if (verifyRes.success) {
              setStatusAlert({
                type: 'success',
                message: `Payment Successful! Transaction ID: ${response.razorpay_payment_id}. Reservation confirmed.`,
              });
              fetchReservations();
            } else {
              throw new Error(verifyRes.message || 'Verification failed.');
            }
          } catch (verifyErr) {
            setStatusAlert({
              type: 'error',
              message: verifyErr.message || 'Payment signature verification failed.',
            });
          } finally {
            setPayLoading(false);
          }
        },
        onError: async (error) => {
          setPayLoading(false);
          setStatusAlert({
            type: 'error',
            message: `Payment Failed: ${error.description || error.message || 'Transaction could not be completed.'}`,
          });
          await paymentsApi.reportFailure({
            reservationId: reservation.reservation_id,
            paymentId: reservation.payment_id,
            reason: error.description || 'Payment rejected',
          });
        },
        onDismiss: async () => {
          setPayLoading(false);
          setStatusAlert({
            type: 'warning',
            message: 'Checkout window closed. Your reservation remains pending so you can retry anytime.',
          });
        },
      });
    } catch (err) {
      setPayLoading(false);
      setStatusAlert({
        type: 'error',
        message: err.message || 'Could not launch payment gateway.',
      });
    }
  };

  /**
   * Offline demo payment simulation fallback
   */
  const handleDemoPayment = async (reservation) => {
    try {
      setPayLoading(true);
      await paymentsApi.processDemoPayment(reservation.payment_id, 'UPI');
      setPayingTarget(null);
      setStatusAlert({
        type: 'success',
        message: `Offline Demo payment of ${formatINR(reservation.amount)} completed!`,
      });
      fetchReservations();
    } catch (err) {
      setStatusAlert({
        type: 'error',
        message: err.message || 'Payment simulation failed',
      });
    } finally {
      setPayLoading(false);
    }
  };

  const filtered = reservations.filter((r) => {
    if (statusFilter === 'ALL') return true;
    return r.status === statusFilter || r.reservation_status === statusFilter;
  });

  if (loading) return <Loader message="Fetching your reservations..." fullHeight />;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h2 className="text-2xl font-bold text-gray-900 tracking-tight">My Reservations</h2>
            <EmbeddedSqlBadge queryKey="RESERVATION_DETAILS_VIEW" />
          </div>
          <p className="text-sm text-gray-500 mt-1">
            Track and manage your upcoming bookings, history, and payment statuses.
          </p>
        </div>
        <Link
          to="/driver/reserve"
          className="px-4 py-2 bg-teal-600 hover:bg-teal-700 text-white font-semibold text-xs rounded-xl transition shadow-xs self-start"
        >
          + New Reservation
        </Link>
      </div>

      {/* Alert Banner */}
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
          <button onClick={() => setStatusAlert(null)} className="text-gray-400 hover:text-gray-600 p-1">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Filter Tabs */}
      <div className="flex flex-wrap gap-2 border-b border-gray-200 pb-3">
        {['ALL', 'CONFIRMED', 'ACTIVE', 'COMPLETED', 'CANCELLED'].map((tab) => (
          <button
            key={tab}
            onClick={() => setStatusFilter(tab)}
            className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition ${
              statusFilter === tab
                ? 'bg-teal-600 text-white shadow-xs'
                : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50'
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <EmptyState
          icon={CalendarCheck}
          title="No reservations found"
          description="You don't have any reservations under the selected status."
          actionLabel="Book a Slot"
          onAction={() => (window.location.href = '/driver/reserve')}
        />
      ) : (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-gray-700">
              <thead className="bg-gray-50/75 border-b border-gray-100 text-[11px] font-bold text-gray-500 uppercase tracking-wider">
                <tr>
                  <th className="px-5 py-3.5">ID / Slot</th>
                  <th className="px-5 py-3.5">Parking Area</th>
                  <th className="px-5 py-3.5">Vehicle</th>
                  <th className="px-5 py-3.5">Time Window</th>
                  <th className="px-5 py-3.5">Status</th>
                  <th className="px-5 py-3.5">Payment</th>
                  <th className="px-5 py-3.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filtered.map((r) => {
                  const resStatus = r.status || r.reservation_status;
                  const canCancel = resStatus === 'CONFIRMED' || resStatus === 'ACTIVE';
                  const needsPay = r.payment_status === 'PENDING' && canCancel;

                  return (
                    <tr key={r.reservation_id} className="hover:bg-gray-50/60 transition">
                      <td className="px-5 py-4">
                        <span className="text-xs text-gray-400 block font-mono">#{r.reservation_id}</span>
                        <span className="font-bold text-gray-900 text-sm">Slot {r.slot_number}</span>
                      </td>

                      <td className="px-5 py-4">
                        <p className="font-medium text-gray-900 text-xs">{r.area_name}</p>
                        <p className="text-[11px] text-gray-500 truncate max-w-[150px]">{r.area_location}</p>
                      </td>

                      <td className="px-5 py-4">
                        <span className="font-bold text-teal-800 text-xs block">{r.registration_no}</span>
                        <Badge status={r.vehicle_type} className="text-[10px] mt-0.5" />
                      </td>

                      <td className="px-5 py-4 text-xs space-y-0.5 text-gray-600">
                        <p className="font-medium text-gray-800">
                          {new Date(r.start_time).toLocaleDateString()}
                        </p>
                        <p className="text-[11px] text-gray-500">
                          {new Date(r.start_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} -{' '}
                          {new Date(r.end_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </p>
                      </td>

                      <td className="px-5 py-4">
                        <Badge status={resStatus} />
                      </td>

                      <td className="px-5 py-4">
                        <p className="font-bold text-xs text-gray-900">{formatINR(r.amount)}</p>
                        <Badge status={r.payment_status || 'PENDING'} className="text-[10px] mt-0.5" />
                      </td>

                      <td className="px-5 py-4 text-right space-x-2 whitespace-nowrap">
                        {needsPay && (
                          <button
                            onClick={() => setPayingTarget(r)}
                            disabled={payLoading}
                            className="px-3 py-1 text-xs font-bold text-white bg-teal-600 hover:bg-teal-700 rounded-lg transition shadow-2xs inline-flex items-center gap-1"
                          >
                            <CreditCard className="w-3 h-3" />
                            Pay Now
                          </button>
                        )}
                        {canCancel && (
                          <button
                            onClick={() => setCancelTarget(r)}
                            className="px-2.5 py-1 text-xs font-semibold text-rose-600 bg-rose-50 hover:bg-rose-100 rounded-lg transition"
                          >
                            Cancel
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

      {/* Cancel Confirmation Modal */}
      <ConfirmModal
        isOpen={!!cancelTarget}
        title="Cancel Reservation"
        message={`Are you sure you want to cancel reservation #${cancelTarget?.reservation_id}? The parking bay will be released.`}
        confirmText="Confirm Cancellation"
        isDanger={true}
        isLoading={cancelLoading}
        onConfirm={handleCancel}
        onClose={() => setCancelTarget(null)}
      />

      {/* Pay Options Modal */}
      {payingTarget && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl border border-gray-100 space-y-5 animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between pb-3 border-b border-gray-100">
              <div>
                <h3 className="text-lg font-bold text-gray-900">Pay for Reservation #{payingTarget.reservation_id}</h3>
                <p className="text-xs text-gray-500">
                  Bay {payingTarget.slot_number} • {payingTarget.area_name}
                </p>
              </div>
              <button onClick={() => setPayingTarget(null)} className="text-gray-400 hover:text-gray-600 p-1">
                ✕
              </button>
            </div>

            <div className="bg-slate-50 rounded-xl p-4 flex items-center justify-between border border-slate-100">
              <span className="text-xs text-gray-600 font-medium">Payable Amount</span>
              <span className="text-2xl font-black text-gray-900">{formatINR(payingTarget.amount)}</span>
            </div>

            <div className="space-y-3">
              {/* Option 1: Razorpay Checkout */}
              <button
                type="button"
                disabled={payLoading}
                onClick={() => handleRazorpayPayment(payingTarget)}
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
                  Pay →
                </span>
              </button>

              {/* Option 2: Offline Demo */}
              <button
                type="button"
                disabled={payLoading}
                onClick={() => handleDemoPayment(payingTarget)}
                className="w-full p-3.5 rounded-xl border border-gray-200 hover:bg-gray-50 transition flex items-center justify-between text-left disabled:opacity-50"
              >
                <div>
                  <p className="text-xs font-semibold text-gray-800">Simulate Offline Payment (Viva Demo)</p>
                  <p className="text-[11px] text-gray-500 mt-0.5">Immediate confirmation without loading gateway</p>
                </div>
                <span className="text-xs text-gray-400">Run →</span>
              </button>
            </div>

            <div className="pt-2 flex justify-end">
              <button
                type="button"
                onClick={() => setPayingTarget(null)}
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

export default MyReservations;
