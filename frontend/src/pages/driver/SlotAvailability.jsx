import React, { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { Grid, Search, Filter, RefreshCw, CalendarCheck, CheckCircle2 } from 'lucide-react';
import { slotsApi, areasApi } from '../../api/client';
import Badge from '../../components/common/Badge';
import Loader from '../../components/common/Loader';
import EmptyState from '../../components/common/EmptyState';

export const SlotAvailability = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();

  const [slots, setSlots] = useState([]);
  const [areas, setAreas] = useState([]);
  const [loading, setLoading] = useState(true);

  const [selectedArea, setSelectedArea] = useState(searchParams.get('area_id') || '');
  const [selectedType, setSelectedType] = useState('');
  const [selectedStatus, setSelectedStatus] = useState('');
  const [searchTerm, setSearchTerm] = useState('');

  const fetchFiltersAndSlots = async () => {
    try {
      setLoading(true);
      const [areasRes, slotsRes] = await Promise.all([
        areasApi.getAll(),
        slotsApi.getAll({
          area_id: selectedArea || undefined,
          slot_type: selectedType || undefined,
          status: selectedStatus || undefined,
          search: searchTerm || undefined,
        }),
      ]);

      if (areasRes.success) setAreas(areasRes.areas);
      if (slotsRes.success) setSlots(slotsRes.slots);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchFiltersAndSlots();
  }, [selectedArea, selectedType, selectedStatus]);

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    fetchFiltersAndSlots();
  };

  const handleSlotClick = (slot) => {
    if (slot.status === 'AVAILABLE') {
      navigate(`/driver/reserve?slot_id=${slot.slot_id}&area_id=${slot.area_id}`);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 tracking-tight">Parking Slot Availability</h2>
          <p className="text-sm text-gray-500 mt-1">
            Real-time status of all bays. Click any available bay to immediately start booking.
          </p>
        </div>
        <button
          onClick={fetchFiltersAndSlots}
          className="inline-flex items-center gap-2 px-3.5 py-2 text-xs font-semibold text-gray-700 bg-white border border-gray-200 rounded-xl hover:bg-gray-50 transition shadow-2xs self-start"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          Refresh Status
        </button>
      </div>

      {/* Filters Bar */}
      <div className="bg-white p-4 rounded-2xl border border-gray-100 shadow-xs grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {/* Area dropdown */}
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">Parking Area</label>
          <select
            value={selectedArea}
            onChange={(e) => setSelectedArea(e.target.value)}
            className="w-full text-sm border border-gray-200 rounded-xl p-2.5 focus:ring-2 focus:ring-teal-500 focus:outline-none"
          >
            <option value="">All Parking Areas</option>
            {areas.map((a) => (
              <option key={a.area_id} value={a.area_id}>
                {a.name}
              </option>
            ))}
          </select>
        </div>

        {/* Slot type */}
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">Vehicle / Slot Type</label>
          <select
            value={selectedType}
            onChange={(e) => setSelectedType(e.target.value)}
            className="w-full text-sm border border-gray-200 rounded-xl p-2.5 focus:ring-2 focus:ring-teal-500 focus:outline-none"
          >
            <option value="">All Slot Types</option>
            <option value="CAR">Car</option>
            <option value="BIKE">Bike</option>
            <option value="EV">Electric Vehicle (EV)</option>
            <option value="DISABLED">Accessible / Disabled</option>
          </select>
        </div>

        {/* Status */}
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">Availability Status</label>
          <select
            value={selectedStatus}
            onChange={(e) => setSelectedStatus(e.target.value)}
            className="w-full text-sm border border-gray-200 rounded-xl p-2.5 focus:ring-2 focus:ring-teal-500 focus:outline-none"
          >
            <option value="">All Statuses</option>
            <option value="AVAILABLE">Available</option>
            <option value="RESERVED">Reserved</option>
            <option value="OCCUPIED">Occupied</option>
            <option value="MAINTENANCE">Maintenance</option>
          </select>
        </div>

        {/* Search */}
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">Search Slot Number</label>
          <form onSubmit={handleSearchSubmit} className="relative">
            <input
              type="text"
              placeholder="e.g. A-101"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full text-sm border border-gray-200 rounded-xl p-2.5 pr-8 focus:ring-2 focus:ring-teal-500 focus:outline-none"
            />
            <button
              type="submit"
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
            >
              <Search className="w-4 h-4" />
            </button>
          </form>
        </div>
      </div>

      {/* Legend */}
      <div className="flex flex-wrap items-center gap-4 text-xs font-medium text-gray-600 bg-gray-50 p-3 rounded-xl border border-gray-100">
        <span className="font-semibold text-gray-700">Legend:</span>
        <span className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded-full bg-emerald-500"></span> Available (Click to reserve)
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded-full bg-amber-500"></span> Reserved
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded-full bg-indigo-500"></span> Occupied
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded-full bg-rose-500"></span> Maintenance
        </span>
      </div>

      {/* Slot Grid */}
      {loading ? (
        <Loader message="Loading slot availability map..." fullHeight />
      ) : slots.length === 0 ? (
        <EmptyState
          icon={Grid}
          title="No slots match your criteria"
          description="Try relaxing your filters to see more parking spaces."
        />
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3 sm:gap-4">
          {slots.map((slot) => {
            const isAvailable = slot.status === 'AVAILABLE';

            const cardColor = {
              AVAILABLE: 'border-emerald-200 bg-emerald-50/50 hover:bg-emerald-100/70 hover:border-emerald-300 cursor-pointer shadow-xs',
              RESERVED: 'border-amber-200 bg-amber-50/40 text-amber-900 cursor-not-allowed',
              OCCUPIED: 'border-indigo-200 bg-indigo-50/40 text-indigo-900 cursor-not-allowed',
              MAINTENANCE: 'border-rose-200 bg-rose-50/40 text-rose-900 cursor-not-allowed opacity-60',
            }[slot.status] || 'border-gray-200 bg-white';

            return (
              <div
                key={slot.slot_id}
                onClick={() => handleSlotClick(slot)}
                className={`p-4 rounded-2xl border-2 transition-all flex flex-col justify-between ${cardColor} relative group`}
              >
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[10px] font-bold text-gray-500 uppercase">
                      Lvl {slot.floor_level || '1'}
                    </span>
                    <Badge status={slot.slot_type} className="text-[10px] px-1.5 py-0" />
                  </div>
                  <p className="text-xl font-black text-gray-900 tracking-tight">{slot.slot_number}</p>
                  <p className="text-[11px] text-gray-500 truncate mt-0.5" title={slot.area_name}>
                    {slot.area_name}
                  </p>
                </div>

                <div className="mt-3 pt-2 border-t border-gray-200/50 flex items-center justify-between">
                  <Badge status={slot.status} className="text-[10px]" />
                  {isAvailable && (
                    <span className="text-[11px] font-bold text-teal-600 group-hover:underline flex items-center gap-0.5">
                      Book →
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default SlotAvailability;

