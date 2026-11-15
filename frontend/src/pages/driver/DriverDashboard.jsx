import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  Car,
  CalendarCheck,
  CreditCard,
  AlertTriangle,
  Plus,
  MapPin,
  Clock,
  Trash2,
  ArrowRight,
  ShieldAlert
} from 'lucide-react';
import { dashboardApi, vehiclesApi, reservationsApi } from '../../api/client';
import { useAuth } from '../../context/AuthContext';
import StatCard from '../../components/common/StatCard';
import Badge from '../../components/common/Badge';
import Loader from '../../components/common/Loader';
import EmptyState from '../../components/common/EmptyState';
import ConfirmModal from '../../components/common/ConfirmModal';
import { formatINR } from '../../utils/formatters';
import EmbeddedSqlBadge from '../../components/common/EmbeddedSqlBadge';
import { EMBEDDED_QUERIES } from '../../db/embeddedQueries';

// Embedded SQL Aggregates statement incorporated directly for academic DBMS evaluation:
const EMBEDDED_STATS_SQL = EMBEDDED_QUERIES.DRIVER_DASHBOARD_AGGREGATES.sql;
const EMBEDDED_VEHICLE_INSERT_SQL = EMBEDDED_QUERIES.VEHICLE_INSERT_DML.sql;

export const DriverDashboard = () => {
  const { user } = useAuth();
  const [stats, setStats] = useState(null);
  const [vehicles, setVehicles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Add vehicle modal
  const [showAddVehicle, setShowAddVehicle] = useState(false);
  const [newVehicle, setNewVehicle] = useState({
    registration_no: '',
    vehicle_type: 'CAR',
    brand: '',
    model: '',
    color: ''
  });
  const [addLoading, setAddLoading] = useState(false);

  // Cancel reservation modal
  const [cancelTarget, setCancelTarget] = useState(null);
  const [cancelLoading, setCancelLoading] = useState(false);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [statsRes, vehRes] = await Promise.all([
        dashboardApi.getDriverStats(),
        vehiclesApi.getAll()
      ]);

      if (statsRes.success) setStats(statsRes.stats);
      if (vehRes.success) setVehicles(vehRes.vehicles);
    } catch (err) {
      setError(err.message || 'Failed to load dashboard data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleAddVehicle = async (e) => {
    e.preventDefault();
    try {
      setAddLoading(true);
      await vehiclesApi.add(newVehicle);
      setShowAddVehicle(false);
      setNewVehicle({ registration_no: '', vehicle_type: 'CAR', brand: '', model: '', color: '' });
      fetchData();
    } catch (err) {
      alert(err.message || 'Failed to add vehicle');
    } finally {
      setAddLoading(false);
    }
  };

  const handleDeleteVehicle = async (vehicleId) => {
    if (!window.confirm('Are you sure you want to delete this vehicle?')) return;
    try {
      await vehiclesApi.delete(vehicleId);
      fetchData();
    } catch (err) {
      alert(err.message || 'Failed to delete vehicle');
    }
  };

  const handleCancelReservation = async () => {
    if (!cancelTarget) return;
    try {
      setCancelLoading(true);
      await reservationsApi.cancel(cancelTarget.reservation_id, 'Cancelled by driver from dashboard');
      setCancelTarget(null);
      fetchData();
    } catch (err) {
      alert(err.message || 'Failed to cancel reservation');
    } finally {
      setCancelLoading(false);
    }
  };

  if (loading) return <Loader message="Loading your dashboard..." fullHeight />;

  return (
    <div className="space-y-6">
      {/* Welcome Banner */}
      <div className="bg-gradient-to-r from-navy-900 via-navy-850 to-teal-900 rounded-2xl p-6 sm:p-8 text-white shadow-md relative overflow-hidden">
        <div className="relative z-10">
          <span className="text-xs font-semibold text-teal-300 uppercase tracking-widest">
            Driver Portal
          </span>
          <h2 className="text-2xl sm:text-3xl font-extrabold mt-1">
            Welcome back, {user?.name || 'Driver'}!
          </h2>
          <p className="text-sm text-gray-300 mt-2 max-w-xl">
            Check live slot availability, manage upcoming reservations, and track your parking activity.
          </p>
          <div className="mt-5 flex flex-wrap gap-3">
            <Link
              to="/driver/reserve"
              className="px-4 py-2.5 rounded-xl bg-teal-500 hover:bg-teal-600 text-white font-semibold text-sm transition shadow-sm flex items-center gap-2"
            >
              <CalendarCheck className="w-4 h-4" />
              Book a Parking Slot
            </Link>
            <Link
              to="/driver/slots"
              className="px-4 py-2.5 rounded-xl bg-white/10 hover:bg-white/20 text-white font-semibold text-sm transition backdrop-blur-xs flex items-center gap-2 border border-white/10"
            >
              <MapPin className="w-4 h-4" />
              View Slot Map
            </Link>
          </div>
        </div>
      </div>

      {/* Unpaid Violations Banner if any */}
      {stats?.unpaidViolations > 0 && (
        <div className="bg-rose-50 border border-rose-200 rounded-xl p-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-rose-100 rounded-lg text-rose-600">
              <ShieldAlert className="w-5 h-5" />
            </div>
            <div>
              <p className="text-sm font-bold text-rose-900">
                You have {stats.unpaidViolations} unpaid parking violation(s)!
              </p>
              <p className="text-xs text-rose-700">Total outstanding fine amount: {formatINR(stats.unpaidFines)}</p>
            </div>
          </div>
          <Link
            to="/driver/violations"
            className="px-3.5 py-1.5 text-xs font-semibold text-white bg-rose-600 hover:bg-rose-700 rounded-lg transition"
          >
            Review & Pay
          </Link>
        </div>
      )}

      {/* Summary KPI Cards */}
      <div className="flex items-center justify-between">
        <h3 className="text-base font-bold text-gray-800">Driver Activity Summary</h3>
        <EmbeddedSqlBadge queryKey="DRIVER_DASHBOARD_AGGREGATES" label="Embedded Aggregate SQL" />
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="My Registered Vehicles"
          value={stats?.vehiclesCount || 0}
          subtitle="Ready for reservations"
          icon={Car}
          color="teal"
        />
        <StatCard
          title="Active Reservations"
          value={stats?.activeReservations || 0}
          subtitle="Currently booked or in progress"
          icon={CalendarCheck}
          color="blue"
        />
        <StatCard
          title="Total Parking Paid"
          value={formatINR(stats?.totalPaid)}
          subtitle="Completed sessions & bookings"
          icon={CreditCard}
          color="emerald"
        />
        <StatCard
          title="Pending Payments"
          value={stats?.pendingPayments || 0}
          subtitle={`Amount: ${formatINR(stats?.pendingAmount)}`}
          icon={Clock}
          color={stats?.pendingPayments > 0 ? 'amber' : 'teal'}
        />
      </div>

      {/* Two Column Layout: Upcoming Reservations & Vehicles */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: Active & Upcoming Reservations (2 Cols) */}
        <div className="lg:col-span-2 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
              <CalendarCheck className="w-5 h-5 text-teal-600" />
              Active & Upcoming Bookings
            </h3>
            <Link
              to="/driver/my-reservations"
              className="text-xs font-semibold text-teal-600 hover:text-teal-700 flex items-center gap-1"
            >
              View all history <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          {stats?.upcomingReservations?.length === 0 ? (
            <EmptyState
              icon={CalendarCheck}
              title="No active reservations"
              description="You don't have any upcoming parking bookings right now."
              actionLabel="Reserve a Slot Now"
              onAction={() => (window.location.href = '/driver/reserve')}
            />
          ) : (
            <div className="space-y-3">
              {stats?.upcomingReservations?.map((res) => (
                <div
                  key={res.reservation_id}
                  className="bg-white rounded-xl p-5 border border-gray-100 shadow-xs hover:shadow-sm transition flex flex-col sm:flex-row sm:items-center justify-between gap-4"
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-gray-900 text-base">
                        Slot {res.slot_number}
                      </span>
                      <Badge status={res.status} />
                      <Badge status={res.slot_type} />
                    </div>
                    <p className="text-xs text-gray-500 flex items-center gap-1">
                      <MapPin className="w-3.5 h-3.5 text-gray-400" />
                      {res.area_name} ({res.location})
                    </p>
                    <p className="text-xs text-gray-600 flex items-center gap-1">
                      <Clock className="w-3.5 h-3.5 text-gray-400" />
                      {new Date(res.start_time).toLocaleString()} → {new Date(res.end_time).toLocaleString()}
                    </p>
                    <p className="text-xs font-medium text-gray-700">
                      Vehicle: <span className="font-semibold text-teal-700">{res.registration_no}</span>
                    </p>
                  </div>

                  <div className="flex sm:flex-col items-end justify-between sm:justify-center gap-2 pt-2 sm:pt-0 border-t sm:border-t-0 border-gray-100">
                    <div className="text-right">
                      <span className="text-xs text-gray-500">Amount</span>
                      <p className="text-sm font-bold text-gray-900">{formatINR(res.amount)}</p>
                    </div>

                    <button
                      onClick={() => setCancelTarget(res)}
                      className="px-3 py-1.5 text-xs font-medium text-rose-600 bg-rose-50 hover:bg-rose-100 rounded-lg transition"
                    >
                      Cancel Booking
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Right: My Vehicles (1 Col) */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                <Car className="w-5 h-5 text-teal-600" />
                My Vehicles
              </h3>
              <EmbeddedSqlBadge queryKey="VEHICLE_INSERT_DML" label="INSERT DML" size="xs" />
            </div>
            <button
              onClick={() => setShowAddVehicle(true)}
              className="px-3 py-1.5 text-xs font-semibold text-white bg-teal-600 hover:bg-teal-700 rounded-lg transition shadow-xs flex items-center gap-1"
            >
              <Plus className="w-3.5 h-3.5" />
              Add Vehicle
            </button>
          </div>

          {vehicles.length === 0 ? (
            <EmptyState
              icon={Car}
              title="No vehicles added"
              description="Register your car, bike, or EV to start reserving parking slots."
              actionLabel="Add Your First Vehicle"
              onAction={() => setShowAddVehicle(true)}
            />
          ) : (
            <div className="bg-white rounded-xl border border-gray-100 shadow-xs divide-y divide-gray-100 overflow-hidden">
              {vehicles.map((v) => (
                <div key={v.vehicle_id} className="p-4 flex items-center justify-between hover:bg-gray-50 transition">
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-bold text-gray-900">{v.registration_no}</p>
                      <Badge status={v.vehicle_type} />
                    </div>
                    <p className="text-xs text-gray-500 mt-0.5">
                      {v.brand || 'Vehicle'} {v.model || ''} {v.color ? `• ${v.color}` : ''}
                    </p>
                  </div>
                  <button
                    onClick={() => handleDeleteVehicle(v.vehicle_id)}
                    className="p-1.5 text-gray-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition"
                    title="Remove vehicle"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Add Vehicle Modal */}
      {showAddVehicle && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl border border-gray-100">
            <h3 className="text-lg font-bold text-gray-900 mb-4">Register New Vehicle</h3>
            <form onSubmit={handleAddVehicle} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-gray-700 uppercase mb-1">
                  License Plate / Registration No.
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. KA-01-AB-1234"
                  value={newVehicle.registration_no}
                  onChange={(e) => setNewVehicle({ ...newVehicle, registration_no: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-xl text-sm focus:ring-2 focus:ring-teal-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 uppercase mb-1">Vehicle Type</label>
                <select
                  value={newVehicle.vehicle_type}
                  onChange={(e) => setNewVehicle({ ...newVehicle, vehicle_type: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-xl text-sm focus:ring-2 focus:ring-teal-500"
                >
                  <option value="CAR">Car</option>
                  <option value="BIKE">Motorcycle / Bike</option>
                  <option value="EV">Electric Vehicle (EV)</option>
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 uppercase mb-1">Brand</label>
                  <input
                    type="text"
                    placeholder="e.g. Toyota"
                    value={newVehicle.brand}
                    onChange={(e) => setNewVehicle({ ...newVehicle, brand: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-xl text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-700 uppercase mb-1">Model</label>
                  <input
                    type="text"
                    placeholder="e.g. Corolla"
                    value={newVehicle.model}
                    onChange={(e) => setNewVehicle({ ...newVehicle, model: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-xl text-sm"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 uppercase mb-1">Color</label>
                <input
                  type="text"
                  placeholder="e.g. Silver"
                  value={newVehicle.color}
                  onChange={(e) => setNewVehicle({ ...newVehicle, color: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-xl text-sm"
                />
              </div>

              <div className="flex justify-end gap-3 mt-6 pt-3 border-t border-gray-100">
                <button
                  type="button"
                  onClick={() => setShowAddVehicle(false)}
                  className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-xl transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={addLoading}
                  className="px-4 py-2 text-sm font-semibold text-white bg-teal-600 hover:bg-teal-700 rounded-xl transition disabled:opacity-50"
                >
                  {addLoading ? 'Saving...' : 'Add Vehicle'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Cancel Reservation Confirmation Modal */}
      <ConfirmModal
        isOpen={!!cancelTarget}
        title="Cancel Parking Reservation"
        message={`Are you sure you want to cancel reservation #${cancelTarget?.reservation_id} for Slot ${cancelTarget?.slot_number}? This will free up the slot for other drivers.`}
        confirmText="Cancel Reservation"
        isDanger={true}
        isLoading={cancelLoading}
        onConfirm={handleCancelReservation}
        onClose={() => setCancelTarget(null)}
      />
    </div>
  );
};

export default DriverDashboard;

