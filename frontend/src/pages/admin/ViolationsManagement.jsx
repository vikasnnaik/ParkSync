import React, { useState, useEffect, useRef } from 'react';
import { 
  AlertOctagon, 
  Plus, 
  CheckCircle2, 
  ShieldAlert, 
  Search, 
  Car, 
  X, 
  User, 
  MapPin, 
  AlertTriangle, 
  Info, 
  Sliders, 
  RefreshCw, 
  Compass, 
  Check 
} from 'lucide-react';
import { violationsApi, slotsApi, vehiclesApi } from '../../api/client';
import Badge from '../../components/common/Badge';
import Loader from '../../components/common/Loader';
import EmptyState from '../../components/common/EmptyState';
import { formatINR } from '../../utils/formatters';

export const ViolationsManagement = () => {
  const [violations, setViolations] = useState([]);
  const [slots, setSlots] = useState([]);
  const [vehicles, setVehicles] = useState([]);
  const [loading, setLoading] = useState(true);

  // Issue Violation Modal
  const [modalOpen, setModalOpen] = useState(false);
  const [newViolation, setNewViolation] = useState({
    vehicle_id: '',
    slot_id: '',
    violation_type: 'Unauthorized Parking / Overtime',
    fine_amount: 50.00,
  });
  const [vehicleSearch, setVehicleSearch] = useState('');
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [modalLoading, setModalLoading] = useState(false);

  // Vehicle location state
  const [locationData, setLocationData] = useState(null);
  const [locationLoading, setLocationLoading] = useState(false);
  const [locationError, setLocationError] = useState(null);
  const [manualSlotOverride, setManualSlotOverride] = useState(false);

  const dropdownRef = useRef(null);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [vioRes, slotsRes, vehRes] = await Promise.all([
        violationsApi.getAll(),
        slotsApi.getAll(),
        vehiclesApi.getAll({ all: true })
      ]);

      if (vioRes.success) setViolations(vioRes.violations);
      if (slotsRes.success) setSlots(slotsRes.slots);
      if (vehRes.success && Array.isArray(vehRes.vehicles)) {
        setVehicles(vehRes.vehicles);
      }
    } catch (err) {
      console.error('Failed to fetch admin violations data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // Close vehicle dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Fetch current parking location for selected vehicle (session priority, fallback to reservation)
  const fetchVehicleLocation = async (vehicleIdentifier) => {
    if (!vehicleIdentifier) {
      setLocationData(null);
      setLocationError(null);
      return;
    }

    try {
      setLocationLoading(true);
      setLocationError(null);
      const res = await violationsApi.getVehicleLocation(vehicleIdentifier);

      if (res.success) {
        setLocationData(res);
        // If exact vehicle match returned, ensure vehicle_id is synchronized
        if (res.vehicle) {
          setNewViolation((prev) => ({
            ...prev,
            vehicle_id: res.vehicle.vehicle_id,
          }));
          // If search box didn't have formatted text, format it
          setVehicleSearch(`${res.vehicle.registration_no} — ${res.vehicle.owner_name || 'Driver'}`);
        }

        // If active location found without conflicts, auto-fill slot
        if (res.location && !res.hasConflict) {
          setNewViolation((prev) => ({
            ...prev,
            slot_id: res.location.slot_id,
          }));
          setManualSlotOverride(false);
        } else {
          // If conflict or no active location found, do NOT autofill a random slot
          setNewViolation((prev) => ({
            ...prev,
            slot_id: '',
          }));
          setManualSlotOverride(true);
        }
      }
    } catch (err) {
      console.error('Failed to fetch vehicle location:', err);
      setLocationError(err.message || 'Could not fetch vehicle location');
      setLocationData(null);
      setNewViolation((prev) => ({ ...prev, slot_id: '' }));
      setManualSlotOverride(true);
    } finally {
      setLocationLoading(false);
    }
  };

  const handleSelectVehicle = (v) => {
    setNewViolation((prev) => ({ ...prev, vehicle_id: v.vehicle_id }));
    setVehicleSearch(`${v.registration_no} — ${v.owner_name || 'Driver'}`);
    setDropdownOpen(false);
    fetchVehicleLocation(v.vehicle_id);
  };

  const handleSearchKeySubmit = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleTriggerLookup();
    }
  };

  const handleTriggerLookup = () => {
    const term = vehicleSearch.trim();
    if (!term) return;

    // First check if an exact plate match exists in local vehicles list
    const exactMatch = vehicles.find(
      (v) => (v.registration_no || '').toUpperCase() === term.toUpperCase()
    );
    if (exactMatch) {
      handleSelectVehicle(exactMatch);
    } else {
      // Query backend directly using plate or ID
      setDropdownOpen(false);
      fetchVehicleLocation(term);
    }
  };

  const handleOpenModal = () => {
    setModalOpen(true);
    setVehicleSearch('');
    setDropdownOpen(false);
    setLocationData(null);
    setLocationError(null);
    setManualSlotOverride(false);
    setNewViolation({
      vehicle_id: '',
      slot_id: '',
      violation_type: 'Unauthorized Parking / Overtime',
      fine_amount: 50.00,
    });
  };

  const handleCreateViolation = async (e) => {
    e.preventDefault();

    if (!newViolation.vehicle_id) {
      alert('Please select or look up a target vehicle number plate before submitting.');
      return;
    }

    if (!newViolation.slot_id) {
      alert('Please select the parking slot where the infraction occurred.');
      return;
    }

    try {
      setModalLoading(true);
      await violationsApi.create(newViolation);
      setModalOpen(false);
      setNewViolation({
        vehicle_id: '',
        slot_id: '',
        violation_type: 'Unauthorized Parking / Overtime',
        fine_amount: 50.00,
      });
      setVehicleSearch('');
      setLocationData(null);
      setDropdownOpen(false);
      await fetchData();
    } catch (err) {
      alert(err.message || 'Failed to issue violation');
    } finally {
      setModalLoading(false);
    }
  };

  const handleToggleStatus = async (v) => {
    const nextStatus = v.payment_status === 'PAID' ? 'UNPAID' : 'PAID';
    try {
      await violationsApi.updateStatus(v.violation_id, nextStatus);
      fetchData();
    } catch (err) {
      alert(err.message || 'Failed to update violation status');
    }
  };

  const selectedVehicle = locationData?.vehicle || vehicles.find((v) => String(v.vehicle_id) === String(newViolation.vehicle_id));

  // Filtered vehicles based on search text
  const filteredVehicles = vehicles.filter((v) => {
    const term = vehicleSearch.toLowerCase().trim();
    if (!term) return true;
    const reg = (v.registration_no || '').toLowerCase();
    const owner = (v.owner_name || '').toLowerCase();
    const model = `${v.brand || ''} ${v.model || ''}`.toLowerCase();
    return reg.includes(term) || owner.includes(term) || model.includes(term);
  });

  if (loading && violations.length === 0) return <Loader message="Loading violations..." fullHeight />;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 tracking-tight">Violations & Fine Control</h2>
          <p className="text-sm text-gray-500 mt-1">
            Issue parking tickets, track unpaid penalties, and update fine settlement statuses.
          </p>
        </div>
        <button
          onClick={handleOpenModal}
          className="px-4 py-2.5 bg-rose-600 hover:bg-rose-700 text-white font-semibold text-xs rounded-xl transition shadow-xs flex items-center gap-1.5 self-start cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          Issue Violation Ticket
        </button>
      </div>

      {violations.length === 0 ? (
        <EmptyState
          icon={CheckCircle2}
          title="No violations issued"
          description="There are currently zero parking infractions recorded in the system."
        />
      ) : (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-gray-700">
              <thead className="bg-gray-50/75 border-b border-gray-100 text-[11px] font-bold text-gray-500 uppercase tracking-wider">
                <tr>
                  <th className="px-5 py-3.5">ID</th>
                  <th className="px-5 py-3.5">Vehicle</th>
                  <th className="px-5 py-3.5">Owner / Driver</th>
                  <th className="px-5 py-3.5">Slot / Area</th>
                  <th className="px-5 py-3.5">Infraction Type</th>
                  <th className="px-5 py-3.5">Fine</th>
                  <th className="px-5 py-3.5">Status</th>
                  <th className="px-5 py-3.5 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {violations.map((v) => (
                  <tr key={v.violation_id} className="hover:bg-gray-50/60 transition">
                    <td className="px-5 py-4 font-mono font-medium text-xs text-gray-900">
                      #{v.violation_id}
                    </td>

                    <td className="px-5 py-4 text-xs font-bold text-gray-900">
                      <div className="flex items-center gap-1.5">
                        <span className="font-mono bg-gray-100 border border-gray-200 px-2 py-0.5 rounded text-gray-900">
                          {v.registration_no}
                        </span>
                        <span className="text-[10px] text-gray-400 font-medium uppercase">
                          {v.vehicle_type}
                        </span>
                      </div>
                    </td>

                    <td className="px-5 py-4 text-xs">
                      <span className="font-semibold text-gray-800">{v.user_name}</span>
                      <span className="text-gray-400 block text-[11px]">{v.user_email}</span>
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

                    <td className="px-5 py-4">
                      <Badge status={v.payment_status} />
                    </td>

                    <td className="px-5 py-4 text-right">
                      <button
                        onClick={() => handleToggleStatus(v)}
                        className={`px-3 py-1 text-xs font-semibold rounded-lg transition cursor-pointer ${
                          v.payment_status === 'UNPAID'
                            ? 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
                            : 'bg-rose-50 text-rose-700 hover:bg-rose-100'
                        }`}
                      >
                        {v.payment_status === 'UNPAID' ? 'Mark Paid' : 'Revert Unpaid'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Issue Violation Modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-xl border border-gray-100 animate-in fade-in zoom-in-95 max-h-[92vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-gray-100">
              <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                <ShieldAlert className="w-5 h-5 text-rose-600" />
                Issue Violation Ticket
              </h3>
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                className="text-gray-400 hover:text-gray-600 p-1 rounded-lg cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateViolation} className="space-y-4 pt-4">
              {/* Searchable Vehicle Number Plate Dropdown */}
              <div ref={dropdownRef} className="relative">
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-xs font-bold text-gray-700 uppercase">
                    Vehicle Number Plate <span className="text-rose-500">*</span>
                  </label>
                  {locationLoading && (
                    <span className="text-[11px] text-indigo-600 font-medium flex items-center gap-1 animate-pulse">
                      <RefreshCw className="w-3 h-3 animate-spin" />
                      Locating in database...
                    </span>
                  )}
                </div>

                {/* Search / Select Input */}
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-400">
                    <Search className="w-4 h-4" />
                  </div>
                  <input
                    type="text"
                    required={!newViolation.vehicle_id}
                    value={vehicleSearch}
                    placeholder="Enter or search plate (e.g. KA03EF9012...)"
                    onFocus={() => setDropdownOpen(true)}
                    onKeyDown={handleSearchKeySubmit}
                    onChange={(e) => {
                      setVehicleSearch(e.target.value);
                      setDropdownOpen(true);
                      // Clear vehicle_id if user types something new
                      if (selectedVehicle && `${selectedVehicle.registration_no} — ${selectedVehicle.owner_name}` !== e.target.value) {
                        setNewViolation((prev) => ({ ...prev, vehicle_id: '', slot_id: '' }));
                        setLocationData(null);
                      }
                    }}
                    className="w-full pl-9 pr-24 py-2.5 bg-gray-50/70 border border-gray-300 rounded-xl text-sm placeholder-gray-400 focus:bg-white focus:outline-none focus:border-rose-500 focus:ring-2 focus:ring-rose-500/20 transition"
                  />
                  <div className="absolute inset-y-0 right-1 flex items-center gap-1">
                    {vehicleSearch && (
                      <button
                        type="button"
                        onClick={() => {
                          setVehicleSearch('');
                          setNewViolation((prev) => ({ ...prev, vehicle_id: '', slot_id: '' }));
                          setLocationData(null);
                          setLocationError(null);
                          setDropdownOpen(true);
                        }}
                        className="p-1 text-gray-400 hover:text-gray-600 cursor-pointer"
                        title="Clear input"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={handleTriggerLookup}
                      className="px-2.5 py-1 bg-rose-50 hover:bg-rose-100 text-rose-700 text-xs font-bold rounded-lg transition border border-rose-200 cursor-pointer"
                      title="Search vehicle location"
                    >
                      Locate
                    </button>
                  </div>
                </div>

                {/* Floating Results Menu */}
                {dropdownOpen && (
                  <div className="absolute z-50 left-0 right-0 mt-1 max-h-56 overflow-y-auto bg-white border border-gray-200 rounded-xl shadow-2xl divide-y divide-gray-100">
                    {filteredVehicles.length === 0 ? (
                      <div className="p-3.5 text-xs text-gray-500 text-center italic">
                        No registered vehicles matching "{vehicleSearch}". Click "Locate" to query database directly.
                      </div>
                    ) : (
                      filteredVehicles.map((v) => {
                        const isSelected = String(newViolation.vehicle_id) === String(v.vehicle_id);
                        return (
                          <button
                            key={v.vehicle_id}
                            type="button"
                            onClick={() => handleSelectVehicle(v)}
                            className={`w-full p-3 text-left flex items-center justify-between text-xs hover:bg-rose-50/70 transition cursor-pointer ${
                              isSelected ? 'bg-rose-50 text-rose-900 font-bold' : 'text-gray-800'
                            }`}
                          >
                            <div className="flex items-center gap-2">
                              <span className="font-mono font-bold text-gray-900 text-xs px-2 py-0.5 bg-gray-100 border border-gray-200 rounded">
                                {v.registration_no}
                              </span>
                              <span className="text-gray-400">—</span>
                              <span className="text-gray-800 font-semibold">{v.owner_name || 'Driver'}</span>
                            </div>
                            <span className="text-[10px] text-gray-500 font-medium uppercase px-2 py-0.5 bg-gray-100 rounded">
                              {v.vehicle_type} {v.brand ? `• ${v.brand}` : ''}
                            </span>
                          </button>
                        );
                      })
                    )}
                  </div>
                )}

                {/* Quick Native Dropdown Select */}
                <div className="mt-2">
                  <select
                    value={newViolation.vehicle_id}
                    onChange={(e) => {
                      const vid = e.target.value;
                      if (!vid) {
                        setNewViolation((prev) => ({ ...prev, vehicle_id: '', slot_id: '' }));
                        setVehicleSearch('');
                        setLocationData(null);
                        return;
                      }
                      const found = vehicles.find((v) => String(v.vehicle_id) === String(vid));
                      if (found) {
                        handleSelectVehicle(found);
                      } else {
                        fetchVehicleLocation(vid);
                      }
                      setDropdownOpen(false);
                    }}
                    className="w-full px-3 py-2 bg-white border border-gray-200 rounded-xl text-xs text-gray-700 focus:outline-none focus:ring-2 focus:ring-rose-500 cursor-pointer"
                  >
                    <option value="">-- Or choose directly from vehicle list ({vehicles.length}) --</option>
                    {vehicles.map((v) => (
                      <option key={v.vehicle_id} value={v.vehicle_id}>
                        {v.registration_no} — {v.owner_name || 'Driver'} ({v.vehicle_type} {v.brand ? `• ${v.brand} ${v.model || ''}` : ''})
                      </option>
                    ))}
                  </select>
                </div>

                {/* Error Banner if Plate Lookup Failed */}
                {locationError && (
                  <div className="mt-2 p-2.5 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-800 flex items-center gap-2">
                    <AlertOctagon className="w-4 h-4 text-rose-600 shrink-0" />
                    <span>{locationError}</span>
                  </div>
                )}

                {/* Selected Vehicle Confirmation Card */}
                {selectedVehicle && (
                  <div className="mt-2.5 p-3 bg-gray-50 border border-gray-200 rounded-xl space-y-1.5">
                    <div className="flex items-center justify-between text-xs">
                      <div className="flex items-center gap-2">
                        <Car className="w-4 h-4 text-gray-700 shrink-0" />
                        <span className="font-mono font-bold text-gray-900 text-sm tracking-wide">
                          {selectedVehicle.registration_no}
                        </span>
                        <span className="text-[10px] font-bold uppercase px-2 py-0.5 bg-white text-gray-700 border border-gray-200 rounded">
                          {selectedVehicle.vehicle_type}
                        </span>
                      </div>
                      <span className="text-xs text-gray-600 font-medium">
                        {selectedVehicle.brand ? `${selectedVehicle.brand} ${selectedVehicle.model || ''}` : 'Vehicle Registered'}
                      </span>
                    </div>

                    <div className="text-xs text-gray-600 flex items-center gap-1.5 pt-0.5">
                      <User className="w-3.5 h-3.5 text-gray-400" />
                      <span>Owner: <strong className="text-gray-900">{selectedVehicle.owner_name || 'Registered Driver'}</strong></span>
                      {selectedVehicle.owner_email && (
                        <span className="text-gray-400 text-[11px]">({selectedVehicle.owner_email})</span>
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* Automatic Location Fetch Results / Warnings */}
              {newViolation.vehicle_id && (
                <div className="space-y-2">
                  {/* Conflicting Active Records Warning */}
                  {locationData?.hasConflict && (
                    <div className="p-3.5 bg-amber-50 border border-amber-200 rounded-xl space-y-2">
                      <div className="flex items-start gap-2.5">
                        <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                        <div>
                          <h4 className="text-xs font-bold text-amber-900">Conflicting Active Records Detected</h4>
                          <p className="text-xs text-amber-800 mt-0.5">{locationData.conflictMessage}</p>
                        </div>
                      </div>

                      {locationData.candidateLocations?.length > 0 && (
                        <div className="mt-2 text-xs text-amber-900 bg-white/90 p-2.5 rounded-lg border border-amber-200/60 space-y-1.5">
                          <span className="font-bold block text-[11px] uppercase tracking-wider text-amber-800">
                            Candidate Active Records:
                          </span>
                          <ul className="space-y-1.5">
                            {locationData.candidateLocations.map((cand, idx) => (
                              <li key={idx} className="flex items-center justify-between text-xs py-1 px-1.5 rounded hover:bg-amber-50">
                                <div>
                                  <span className="font-semibold text-gray-900">{cand.location_text}</span>
                                  <span className="text-[10px] text-amber-700 block">
                                    {cand.source === 'ACTIVE_SESSION' ? '🟢 Active Check-in Session' : '🔵 Confirmed Reservation'}
                                  </span>
                                </div>
                                <button
                                  type="button"
                                  onClick={() => {
                                    setNewViolation((prev) => ({ ...prev, slot_id: cand.slot_id }));
                                    setManualSlotOverride(true);
                                  }}
                                  className={`px-2 py-1 text-[11px] font-bold rounded cursor-pointer transition ${
                                    String(newViolation.slot_id) === String(cand.slot_id)
                                      ? 'bg-amber-600 text-white'
                                      : 'bg-amber-100 hover:bg-amber-200 text-amber-900'
                                  }`}
                                >
                                  {String(newViolation.slot_id) === String(cand.slot_id) ? 'Selected' : 'Select Slot'}
                                </button>
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                      <p className="text-[11px] text-amber-700 font-medium">
                        Please manually confirm and select the actual slot where the vehicle is parked.
                      </p>
                    </div>
                  )}

                  {/* Active Location Found (No Conflict) */}
                  {!locationData?.hasConflict && locationData?.location && (
                    <div className="p-3.5 bg-emerald-50/70 border border-emerald-200 rounded-xl space-y-2">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-start gap-2.5">
                          <MapPin className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="text-[10px] font-black uppercase tracking-wider px-2 py-0.5 bg-emerald-100 text-emerald-800 rounded">
                                {locationData.locationSource === 'ACTIVE_SESSION' ? 'Active Parking Session' : 'Active Reservation'}
                              </span>
                              <span className="text-[11px] text-emerald-700 font-semibold">Auto-detected Location</span>
                            </div>
                            <div className="mt-1 text-sm font-black text-emerald-950">
                              {locationData.location.location_text}
                            </div>
                            <div className="text-[11px] text-emerald-800 mt-0.5">
                              Slot {locationData.location.slot_number} • Floor {locationData.location.floor_level || '1'} • {locationData.location.slot_type} Bay
                            </div>
                          </div>
                        </div>

                        <button
                          type="button"
                          onClick={() => setManualSlotOverride(!manualSlotOverride)}
                          className="text-[11px] font-bold text-emerald-800 hover:text-emerald-950 flex items-center gap-1 px-2.5 py-1.5 bg-white border border-emerald-300 rounded-lg shadow-2xs transition cursor-pointer shrink-0"
                        >
                          <Sliders className="w-3.5 h-3.5" />
                          {manualSlotOverride ? 'Using Manual Slot' : 'Change Slot'}
                        </button>
                      </div>

                      {!manualSlotOverride && (
                        <div className="text-[11px] text-emerald-800 flex items-center gap-1.5 font-medium bg-emerald-100/50 px-2.5 py-1 rounded-lg">
                          <Check className="w-3.5 h-3.5 text-emerald-700 shrink-0" />
                          <span>Autofilled slot: <strong>{locationData.location.location_text}</strong></span>
                        </div>
                      )}
                    </div>
                  )}

                  {/* No Active Parking Record Found */}
                  {!locationData?.hasConflict && locationData && !locationData.location && (
                    <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl flex items-start gap-2.5">
                      <Info className="w-4 h-4 text-slate-500 shrink-0 mt-0.5" />
                      <div className="text-xs">
                        <span className="font-bold text-slate-800 block">No active parking record found for this vehicle.</span>
                        <span className="text-slate-600 block mt-0.5">
                          This vehicle does not currently have an ongoing check-in session or confirmed active reservation. Please manually select the physical parking slot below.
                        </span>
                      </div>
                    </div>
                  )}

                  {/* Non-GPS Disclaimer */}
                  <p className="text-[10px] text-gray-400 italic flex items-center gap-1.5 px-1">
                    <Compass className="w-3 h-3 text-gray-400 shrink-0" />
                    <span>Location is derived from active database records (parking sessions / confirmed reservations). Live physical GPS tracking is not used.</span>
                  </p>
                </div>
              )}

              {/* Parking Slot Selection (Visible if manual override, conflict, or no active record detected) */}
              {(!locationData?.location || manualSlotOverride || locationData?.hasConflict) && (
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-xs font-bold text-gray-700 uppercase">
                      Parking Slot <span className="text-rose-500">*</span>
                    </label>
                    {manualSlotOverride && locationData?.location && (
                      <span className="text-[10px] font-bold text-amber-800 bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
                        Manual Slot Override Active
                      </span>
                    )}
                  </div>
                  <select
                    required
                    value={newViolation.slot_id}
                    onChange={(e) => setNewViolation({ ...newViolation, slot_id: e.target.value })}
                    className="w-full px-3 py-2.5 bg-gray-50/50 border border-gray-300 rounded-xl text-sm focus:bg-white focus:outline-none focus:ring-2 focus:ring-rose-500 cursor-pointer"
                  >
                    <option value="">-- Select parking slot where vehicle is physically parked --</option>
                    {slots.map((s) => (
                      <option key={s.slot_id} value={s.slot_id}>
                        Slot {s.slot_number} ({s.area_name}) - {s.slot_type} [{s.status}]
                      </option>
                    ))}
                  </select>

                  {manualSlotOverride && locationData?.location && (
                    <p className="text-[11px] text-amber-700 mt-1 font-medium">
                      Vehicle physically parked elsewhere: Citation will be recorded for this manually selected slot instead of auto-detected {locationData.location.location_text}.
                    </p>
                  )}
                </div>
              )}

              {/* Violation Reason / Infraction Type */}
              <div>
                <label className="block text-xs font-bold text-gray-700 uppercase mb-1">
                  Violation Reason / Infraction Type <span className="text-rose-500">*</span>
                </label>
                <select
                  value={newViolation.violation_type}
                  onChange={(e) => setNewViolation({ ...newViolation, violation_type: e.target.value })}
                  className="w-full px-3 py-2.5 bg-gray-50/50 border border-gray-300 rounded-xl text-sm focus:bg-white focus:outline-none focus:ring-2 focus:ring-rose-500 cursor-pointer"
                >
                  <option value="Unauthorized Parking / Overtime">Unauthorized Parking / Overtime</option>
                  <option value="Double Parking / Blocking Bay">Double Parking / Blocking Bay</option>
                  <option value="EV Slot Misuse by Non-EV">EV Slot Misuse by Non-EV</option>
                  <option value="Disabled Bay Misuse">Disabled Bay Misuse</option>
                  <option value="Improper Vehicle Alignment">Improper Vehicle Alignment</option>
                </select>
              </div>

              {/* Fine Penalty Amount in INR */}
              <div>
                <label className="block text-xs font-bold text-gray-700 uppercase mb-1">
                  Fine Penalty Amount (₹) <span className="text-rose-500">*</span>
                </label>
                <input
                  type="number"
                  step="1"
                  min="0"
                  required
                  value={newViolation.fine_amount}
                  onChange={(e) => setNewViolation({ ...newViolation, fine_amount: parseFloat(e.target.value) || 0 })}
                  className="w-full px-3 py-2.5 bg-gray-50/50 border border-gray-300 rounded-xl text-sm focus:bg-white focus:outline-none focus:ring-2 focus:ring-rose-500"
                />
              </div>

              {/* Actions */}
              <div className="flex justify-end gap-3 mt-6 pt-3 border-t border-gray-100">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="px-4 py-2.5 text-xs font-semibold text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-xl transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={modalLoading || !newViolation.vehicle_id || !newViolation.slot_id}
                  className="px-5 py-2.5 text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 rounded-xl transition shadow-sm disabled:opacity-50 cursor-pointer"
                >
                  {modalLoading ? 'Recording Citation...' : 'Issue Citation Ticket'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default ViolationsManagement;
