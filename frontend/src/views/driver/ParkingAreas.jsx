'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { MapPin, Navigation, Grid, ArrowRight } from 'lucide-react';
import { areasApi } from '../../api/client';
import Loader from '../../components/common/Loader';
import EmptyState from '../../components/common/EmptyState';

export const ParkingAreas = () => {
  const [areas, setAreas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const fetchAreas = async () => {
      try {
        setLoading(true);
        const res = await areasApi.getAll();
        if (res.success) setAreas(res.areas);
      } catch (err) {
        setError(err.message || 'Failed to fetch parking areas');
      } finally {
        setLoading(false);
      }
    };
    fetchAreas();
  }, []);

  if (loading) return <Loader message="Fetching parking areas..." fullHeight />;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 tracking-tight">Parking Areas & Facilities</h2>
          <p className="text-sm text-gray-500 mt-1">
            Browse available parking hubs across campus and commercial centers.
          </p>
        </div>
      </div>

      {areas.length === 0 ? (
        <EmptyState
          icon={MapPin}
          title="No parking areas found"
          description="There are currently no active parking areas configured."
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {areas.map((area) => {
            const available = area.available_slots || 0;
            const total = area.total_slots || area.total_capacity || 0;
            const percentage = total > 0 ? Math.round((available / total) * 100) : 0;

            return (
              <div
                key={area.area_id}
                className="bg-white rounded-2xl border border-gray-100 shadow-xs hover:shadow-md transition p-6 flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-start justify-between">
                    <div>
                      <span className="text-[11px] font-bold text-teal-600 uppercase tracking-wider bg-teal-50 px-2 py-0.5 rounded-md">
                        {area.area_type || 'General'}
                      </span>
                      <h3 className="text-lg font-bold text-gray-900 mt-2">{area.name}</h3>
                      <p className="text-xs text-gray-500 flex items-center gap-1.5 mt-1">
                        <MapPin className="w-3.5 h-3.5 text-gray-400 shrink-0" />
                        {area.location}
                      </p>
                    </div>
                    <div className="p-3 bg-gray-50 text-gray-600 rounded-xl">
                      <Navigation className="w-5 h-5" />
                    </div>
                  </div>

                  {/* Slot availability progress bar */}
                  <div className="mt-5 space-y-2">
                    <div className="flex items-center justify-between text-xs font-medium">
                      <span className="text-gray-600">Available Slots</span>
                      <span className="text-teal-700 font-bold">
                        {available} / {total} ({percentage}%)
                      </span>
                    </div>
                    <div className="w-full bg-gray-100 rounded-full h-2 overflow-hidden">
                      <div
                        className="bg-teal-500 h-2 rounded-full transition-all duration-500"
                        style={{ width: `${Math.min(100, percentage)}%` }}
                      ></div>
                    </div>
                  </div>
                </div>

                <div className="mt-6 pt-4 border-t border-gray-100 flex items-center justify-between">
                  <span className="text-xs text-gray-500">
                    Total Capacity: <strong className="text-gray-800">{area.total_capacity || total}</strong>
                  </span>
                  <Link
                    href={`/driver/slots?area_id=${area.area_id}`}
                    className="inline-flex items-center gap-1.5 text-xs font-semibold text-teal-600 hover:text-teal-700 bg-teal-50 hover:bg-teal-100 px-3 py-1.5 rounded-lg transition"
                  >
                    <Grid className="w-3.5 h-3.5" />
                    View Slots <ArrowRight className="w-3 h-3" />
                  </Link>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default ParkingAreas;

