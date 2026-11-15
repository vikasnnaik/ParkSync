import React, { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import {
  CalendarCheck,
  Car,
  MapPin,
  Clock,
  CreditCard,
  AlertCircle,
  CheckCircle2,
  DollarSign,
  ArrowRight
} from 'lucide-react';
import { areasApi, slotsApi, vehiclesApi, reservationsApi, paymentsApi } from '../../api/client';
import { useAuth } from '../../context/AuthContext';
import { launchRazorpayCheckout } from '../../utils/razorpay';
import { formatINR } from '../../utils/formatters';
import Loader from '../../components/common/Loader';
import Badge from '../../components/common/Badge';
import EmbeddedSqlBadge from '../../components/common/EmbeddedSqlBadge';
import { EMBEDDED_QUERIES } from '../../db/embeddedQueries';

// Embedded ACID Transaction SQL statement incorporated directly for academic DBMS evaluation:
const EMBEDDED_RESERVATION_TX_SQL = EMBEDDED_QUERIES.RESERVATION_ACID_TRANSACTION.sql;

export const MakeReservation = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [areas, setAreas] = useState([]);
  const [slots, setSlots] = useState([]);
  const [vehicles, setVehicles] = useState([]);
  const [loadingInitial, setLoadingInitial] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [payLoading, setPayLoading] = useState(false);
  const [error, setError] = useState('');
  const [successData, setSuccessData] = useState(null);
  const [paySuccessMsg, setPaySuccessMsg] = useState('');

  // Form State
  const [selectedAreaId, setSelectedAreaId] = useState(searchParams.get('area_id') || '');
  const [selectedSlotId, setSelectedSlotId] = useState(searchParams.get('slot_id') || '');
  const [selectedVehicleId, setSelectedVehicleId] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('UPI');

  // Time state defaults: Starts in 10 minutes, lasts 2 hours
  const now = new Date();
  const defaultStart = new Date(now.getTime() + 10 * 60 * 1000);
  const defaultEnd = new Date(defaultStart.getTime() + 2 * 60 * 60 * 1000);

  const formatForInput = (d) => {
    const pad = (n) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  };

  const [startTime, setStartTime] = useState(formatForInput(defaultStart));
  const [endTime, setEndTime] = useState(formatForInput(defaultEnd));

  // Load areas & user vehicles
  useEffect(() => {
    const loadBasics = async () => {
      try {
        setLoadingInitial(true);
        const [areasRes, vehRes] = await Promise.all([
          areasApi.getAll(),
          vehiclesApi.getAll(),
        ]);

        if (areasRes.success) setAreas(areasRes.areas);
        if (vehRes.success) {
          setVehicles(vehRes.vehicles);
          if (vehRes.vehicles.length > 0) {
            setSelectedVehicleId(String(vehRes.vehicles[0].vehicle_id));
          }
        }
      } catch (err) {
        setError(err.message || 'Failed to initialize booking data');
      } finally {
        setLoadingInitial(false);
      }
    };
    loadBasics();
  }, []);

  // Fetch slots whenever area changes
  useEffect(() => {
    const loadSlots = async () => {
      if (!selectedAreaId) {
        setSlots([]);
        return;
      }
      try {
        const res = await slotsApi.getAll({ area_id: selectedAreaId });
        if (res.success) {
          setSlots(res.slots);
          // If previous selectedSlotId is not in this area, reset it
          if (!res.slots.some((s) => String(s.slot_id) === String(selectedSlotId))) {
            setSelectedSlotId('');
          }
        }
      } catch (err) {
        console.error(err);
      }
    };
    loadSlots();
  }, [selectedAreaId]);

  // Calculate duration & estimate price
  const calculateEstimate = () => {
    const start = new Date(startTime);
    const end = new Date(endTime);
    if (isNaN(start) || isNaN(end) || end <= start) return { hours: 0, amount: 0 };

    const hours = Math.max(1, Math.ceil((end - start) / (1000 * 60 * 60)));
    const vehicle = vehicles.find((v) => String(v.vehicle_id) === String(selectedVehicleId));
    const rate = vehicle?.vehicle_type === 'BIKE' ? 20 : vehicle?.vehicle_type === 'EV' ? 40 : 50;
    return { hours, amount: hours * rate, rate };
  };

  const estimate = calculateEstimate();
  const selectedSlot = slots.find((s) => String(s.slot_id) === String(selectedSlotId));

  const handlePayWithRazorpay = async () => {
    if (!successData) return;
    try {
      setPayLoading(true);
      setError('');
      const orderRes = await paymentsApi.createOrder({
        reservationId: successData.reservationId,
        paymentId: successData.paymentId,
      });

      if (!orderRes.success) {
        throw new Error(orderRes.message || 'Failed to initialize payment');
      }

      await launchRazorpayCheckout({
        orderData: orderRes,
        user,
        onSuccess: async (response) => {
          try {
            const verifyRes = await paymentsApi.verifyPayment({
              razorpay_order_id: response.razorpay_order_id,
              razorpay_payment_id: response.razorpay_payment_id,
              razorpay_signature: response.razorpay_signature,
              paymentId: successData.paymentId,
              reservationId: successData.reservationId,
            });

            if (verifyRes.success) {
              setPaySuccessMsg(`Payment Confirmed! Razorpay ID: ${response.razorpay_payment_id}`);
              setSuccessData((prev) => ({
                ...prev,
                paymentStatus: 'SUCCESS',
                transactionId: response.razorpay_payment_id,
              }));
            }
          } catch (vErr) {
            setError(vErr.message || 'Payment verification failed');
          } finally {
            setPayLoading(false);
          }
        },
        onError: (err) => {
          setPayLoading(false);
          setError(`Payment rejected: ${err.description || err.message}`);
        },
        onDismiss: () => {
          setPayLoading(false);
        },
      });
    } catch (err) {
      setPayLoading(false);
      setError(err.message || 'Payment initiation failed');
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!selectedVehicleId) {
      setError('Please select or register a vehicle first.');
      return;
    }
    if (!selectedSlotId) {
      setError('Please select an available parking slot.');
      return;
    }

    try {
      setSubmitting(true);
      const res = await reservationsApi.create({
        vehicleId: selectedVehicleId,
        slotId: selectedSlotId,
        startTime,
        endTime,
        paymentMethod,
      });

      if (res.success) {
        setSuccessData(res.reservation);
      }
    } catch (err) {
      setError(err.message || 'Failed to create reservation');
    } finally {
      setSubmitting(false);
    }
  };

  if (loadingInitial) return <Loader message="Loading booking engine..." fullHeight />;

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div>
        <div className="flex items-center gap-3">
          <h2 className="text-2xl font-bold text-gray-900 tracking-tight">Reserve a Parking Slot</h2>
          <EmbeddedSqlBadge queryKey="RESERVATION_ACID_TRANSACTION" />
        </div>
        <p className="text-sm text-gray-500 mt-1">
          Select your parking hub, time window, and registered vehicle.
        </p>
      </div>

      {successData ? (
        <div className="bg-white rounded-2xl border border-emerald-100 shadow-md p-8 text-center space-y-4">
          <div className="w-16 h-16 bg-emerald-50 text-emerald-600 rounded-full flex items-center justify-center mx-auto shadow-sm">
            <CheckCircle2 className="w-10 h-10" />
          </div>
          <h3 className="text-2xl font-black text-gray-900">Reservation Confirmed!</h3>
          <p className="text-sm text-gray-600 max-w-md mx-auto">
            Your parking bay has been locked successfully. Confirmation code:{' '}
            <strong className="text-gray-900">#{successData.reservationId}</strong>.
          </p>

          <div className="bg-gray-50 rounded-xl p-4 max-w-sm mx-auto text-left text-xs space-y-2 border border-gray-100">
            <div className="flex justify-between">
              <span className="text-gray-500">Slot Assigned:</span>
              <span className="font-bold text-gray-900">Bay {successData.slotNumber}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">Vehicle:</span>
              <span className="font-bold text-teal-700">{successData.registrationNo}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">Total Amount:</span>
              <span className="font-bold text-gray-900">{formatINR(successData.amount)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">Payment Status:</span>
              <Badge status={successData.paymentStatus || 'PENDING'} />
            </div>
            {successData.transactionId && (
              <div className="flex justify-between">
                <span className="text-gray-500">Razorpay Txn ID:</span>
                <span className="font-mono text-teal-800 font-bold">{successData.transactionId}</span>
              </div>
            )}
          </div>

          {paySuccessMsg && (
            <div className="p-3 bg-emerald-50 text-emerald-800 rounded-xl text-xs font-semibold max-w-sm mx-auto border border-emerald-200">
              {paySuccessMsg}
            </div>
          )}

          {error && (
            <div className="p-3 bg-rose-50 text-rose-800 rounded-xl text-xs font-semibold max-w-sm mx-auto border border-rose-200">
              {error}
            </div>
          )}

          <div className="flex flex-col sm:flex-row justify-center gap-3 pt-4">
            {successData.paymentStatus !== 'SUCCESS' && (
              <button
                type="button"
                disabled={payLoading}
                onClick={handlePayWithRazorpay}
                className="px-6 py-2.5 bg-teal-600 hover:bg-teal-700 text-white font-bold text-sm rounded-xl transition shadow-sm inline-flex items-center justify-center gap-2 disabled:opacity-50"
              >
                <CreditCard className="w-4 h-4" />
                {payLoading ? 'Launching Gateway...' : `Pay ${formatINR(successData.amount)} via Razorpay`}
              </button>
            )}
            <button
              onClick={() => navigate('/driver/my-reservations')}
              className="px-5 py-2.5 bg-gray-900 hover:bg-gray-800 text-white font-semibold text-sm rounded-xl transition shadow-sm"
            >
              My Reservations
            </button>
            <button
              onClick={() => {
                setSuccessData(null);
                setSelectedSlotId('');
                setPaySuccessMsg('');
              }}
              className="px-5 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-700 font-semibold text-sm rounded-xl transition"
            >
              Book Another
            </button>
          </div>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-xs p-6 sm:p-8">
          {error && (
            <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-xl flex items-start gap-3 text-sm text-red-700">
              <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
              <div>
                <p className="font-bold">Reservation Error</p>
                <p className="text-xs text-red-600 mt-0.5">{error}</p>
              </div>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Step 1: Vehicle selection */}
            <div>
              <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-2">
                1. Select Vehicle
              </label>
              {vehicles.length === 0 ? (
                <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl flex items-center justify-between text-xs text-amber-800">
                  <span>You don't have any registered vehicles yet.</span>
                  <button
                    type="button"
                    onClick={() => navigate('/driver/dashboard')}
                    className="font-bold text-amber-900 underline"
                  >
                    Add Vehicle First
                  </button>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {vehicles.map((v) => (
                    <label
                      key={v.vehicle_id}
                      className={`p-3.5 border-2 rounded-xl cursor-pointer flex items-center justify-between transition ${
                        String(selectedVehicleId) === String(v.vehicle_id)
                          ? 'border-teal-500 bg-teal-50/50 shadow-xs'
                          : 'border-gray-200 hover:border-gray-300'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <input
                          type="radio"
                          name="vehicle"
                          value={v.vehicle_id}
                          checked={String(selectedVehicleId) === String(v.vehicle_id)}
                          onChange={(e) => setSelectedVehicleId(e.target.value)}
                          className="text-teal-600 focus:ring-teal-500"
                        />
                        <div>
                          <p className="text-sm font-bold text-gray-900">{v.registration_no}</p>
                          <p className="text-xs text-gray-500">
                            {v.brand || ''} {v.model || ''}
                          </p>
                        </div>
                      </div>
                      <Badge status={v.vehicle_type} />
                    </label>
                  ))}
                </div>
              )}
            </div>

            {/* Step 2: Parking Area & Slot */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1.5">
                  2. Parking Area
                </label>
                <select
                  required
                  value={selectedAreaId}
                  onChange={(e) => setSelectedAreaId(e.target.value)}
                  className="w-full border border-gray-300 rounded-xl p-2.5 text-sm focus:ring-2 focus:ring-teal-500"
                >
                  <option value="">-- Choose Parking Hub --</option>
                  {areas.map((a) => (
                    <option key={a.area_id} value={a.area_id}>
                      {a.name} ({a.location})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1.5">
                  3. Select Slot
                </label>
                <select
                  required
                  disabled={!selectedAreaId}
                  value={selectedSlotId}
                  onChange={(e) => setSelectedSlotId(e.target.value)}
                  className="w-full border border-gray-300 rounded-xl p-2.5 text-sm focus:ring-2 focus:ring-teal-500 disabled:bg-gray-100"
                >
                  <option value="">
                    {selectedAreaId ? '-- Choose Available Slot --' : 'Select an area first'}
                  </option>
                  {slots.map((s) => (
                    <option
                      key={s.slot_id}
                      value={s.slot_id}
                      disabled={s.status !== 'AVAILABLE'}
                    >
                      {s.slot_number} - {s.slot_type} ({s.status})
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Step 3: Date & Times */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1.5">
                  4. Reservation Start Time
                </label>
                <input
                  type="datetime-local"
                  required
                  value={startTime}
                  onChange={(e) => setStartTime(e.target.value)}
                  className="w-full border border-gray-300 rounded-xl p-2.5 text-sm focus:ring-2 focus:ring-teal-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1.5">
                  5. Reservation End Time
                </label>
                <input
                  type="datetime-local"
                  required
                  value={endTime}
                  onChange={(e) => setEndTime(e.target.value)}
                  className="w-full border border-gray-300 rounded-xl p-2.5 text-sm focus:ring-2 focus:ring-teal-500"
                />
              </div>
            </div>

            {/* Step 4: Payment Method */}
            <div>
              <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1.5">
                6. Payment Method
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {['UPI', 'CARD', 'WALLET', 'CASH'].map((method) => (
                  <label
                    key={method}
                    className={`p-2.5 border rounded-xl text-center cursor-pointer text-xs font-bold transition ${
                      paymentMethod === method
                        ? 'border-teal-500 bg-teal-50 text-teal-800'
                        : 'border-gray-200 text-gray-600 hover:bg-gray-50'
                    }`}
                  >
                    <input
                      type="radio"
                      name="payment_method"
                      value={method}
                      checked={paymentMethod === method}
                      onChange={(e) => setPaymentMethod(e.target.value)}
                      className="sr-only"
                    />
                    {method}
                  </label>
                ))}
              </div>
            </div>

            {/* Estimated Cost Summary Card */}
            <div className="p-4 bg-teal-50/70 border border-teal-200 rounded-xl flex items-center justify-between">
              <div>
                <span className="text-xs text-teal-800 font-medium">Estimated Booking Duration</span>
                <p className="text-sm font-bold text-teal-950">
                  {estimate.hours} Hour(s) @ {formatINR(estimate.rate || 40)}/hr
                </p>
              </div>
              <div className="text-right">
                <span className="text-xs text-teal-800 font-medium">Estimated Total</span>
                <p className="text-2xl font-black text-teal-900">{formatINR(estimate.amount)}</p>
              </div>
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={submitting || vehicles.length === 0}
              className="w-full py-3 px-4 bg-teal-600 hover:bg-teal-700 text-white font-bold text-sm rounded-xl transition shadow-md flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {submitting ? 'Locking Slot & Creating Booking...' : 'Confirm Reservation'}
              <ArrowRight className="w-4 h-4" />
            </button>
          </form>
        </div>
      )}
    </div>
  );
};

export default MakeReservation;

