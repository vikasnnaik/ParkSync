'use client';

import React, { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Grid, Search, Filter, RefreshCw, CalendarCheck, CheckCircle2 } from 'lucide-react';
import { slotsApi, areasApi } from '../../api/client';
import Badge from '../../components/common/Badge';
import Loader from '../../components/common/Loader';
import EmptyState from '../../components/common/EmptyState';
import { EMBEDDED_QUERIES } from '../../db/embeddedQueries';

// Embedded SQL definition incorporated directly for academic DBMS evaluation:
const EMBEDDED_SLOT_QUERY = EMBEDDED_QUERIES.SLOT_AVAILABLE_SUBQUERY.sql;

function SlotAvailabilityContent() {
  const searchParams = useSearchParams();
  const router = useRouter();

  const [slots, setSlots] = useState([]);
  const [areas, setAreas] = useState([]);
  const [loading, setLoading] = useState(true);

  const [selectedArea, setSelectedArea] = useState(searchParams?.get('area_id') || '');
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
      router.push(`/driver/reserve?slot_id=${slot.slot_id}&area_id=${slot.area_id}`);
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
            <option value="">All Bay Types</option>
            <option value="CAR">Car</option>
            <option value="BIKE">Bike</option>
            <option value="EV">Electric Vehicle (EV)</option>
            <option value="DISABLED">Accessible / Disabled</option>
          </select>
        </div>

        {/* Status */}
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">Live Bay Status</label>
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
          <label className="block text-xs font-medium text-gray-500 mb-1">Bay Number Search</label>
          <form onSubmit={handleSearchSubmit} className="flex gap-2">
            <input
              type="text"
              placeholder="e.g. A-12, B-04"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full text-sm border border-gray-200 rounded-xl p-2.5 focus:ring-2 focus:ring-teal-500 focus:outline-none"
            />
            <button
              type="submit"
              className="p-2.5 bg-teal-600 hover:bg-teal-700 text-white rounded-xl transition"
            >
              <Search className="w-4 h-4" />
            </button>
          </form>
        </div>
      </div>

      {/* Grid of Slots */}
      {loading ? (
        <Loader message="Querying bay statuses..." />
      ) : slots.length === 0 ? (
        <EmptyState
          icon={Grid}
          title="No parking slots found"
          description="Try adjusting your filters or area selection to view available slots."
        />
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
          {slots.map((slot) => {
            const isAvail = slot.status === 'AVAILABLE';
            const isOcc = slot.status === 'OCCUPIED';
            const isRes = slot.status === 'RESERVED';
            const isMaint = slot.status === 'MAINTENANCE';

            return (
              <div
                key={slot.slot_id}
                onClick={() => handleSlotClick(slot)}
                className={`p-4 rounded-2xl border transition-all text-center flex flex-col justify-between relative overflow-hidden ${
                  isAvail
                    ? 'border-emerald-200 bg-emerald-50/50 hover:bg-emerald-100/60 hover:shadow-md cursor-pointer group'
                    : isOcc
                    ? 'border-rose-100 bg-rose-50/40 text-gray-400 cursor-not-allowed'
                    : isRes
                    ? 'border-amber-100 bg-amber-50/40 text-gray-400 cursor-not-allowed'
                    : 'border-gray-200 bg-gray-100 text-gray-400 cursor-not-allowed'
                }`}
              >
                {/* Type badge */}
                <div className="flex justify-between items-center w-full mb-2">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-gray-500">
                    Floor {slot.floor_level || '1'}
                  </span>
                  <span className="text-[10px] font-semibold text-teal-700 bg-white/80 px-2 py-0.5 rounded-full border border-gray-100">
                    {slot.slot_type}
                  </span>
                </div>

                {/* Slot ID / Number */}
                <div className="py-2">
                  <span className="text-xl font-black text-gray-900 group-hover:scale-105 transition-transform block">
                    {slot.slot_number}
                  </span>
                  <p className="text-[11px] text-gray-500 truncate mt-0.5">{slot.area_name}</p>
                </div>

                {/* Status indicator */}
                <div className="mt-2 pt-2 border-t border-gray-100/80 flex items-center justify-center">
                  <Badge status={slot.status} size="sm" />
                </div>

                {/* Hover CTA for available slots */}
                {isAvail && (
                  <div className="absolute inset-x-0 bottom-0 py-1 bg-emerald-600 text-white text-[10px] font-bold uppercase tracking-wider opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-1">
                    <CalendarCheck className="w-3 h-3" />
                    Book Bay
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export const SlotAvailability = () => {
  return (
    <Suspense fallback={<Loader message="Loading slot availability..." fullHeight />}>
      <SlotAvailabilityContent />
    </Suspense>
  );
};

export default SlotAvailability;
