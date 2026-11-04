import React, { useState, useEffect } from 'react';
import { Grid, Plus, Edit2, Trash2, Filter } from 'lucide-react';
import { slotsApi, areasApi } from '../../api/client';
import Badge from '../../components/common/Badge';
import Loader from '../../components/common/Loader';
import EmptyState from '../../components/common/EmptyState';
import ConfirmModal from '../../components/common/ConfirmModal';

export const SlotsManagement = () => {
  const [slots, setSlots] = useState([]);
  const [areas, setAreas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filterArea, setFilterArea] = useState('');
  const [filterStatus, setFilterStatus] = useState('');

  // Add / Edit Modal
  const [modalOpen, setModalOpen] = useState(false);
  const [editItem, setEditItem] = useState(null);
  const [formData, setFormData] = useState({
    area_id: '',
    slot_number: '',
    slot_type: 'CAR',
    floor_level: '1',
    status: 'AVAILABLE',
  });
  const [modalLoading, setModalLoading] = useState(false);

  // Delete Modal
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [areasRes, slotsRes] = await Promise.all([
        areasApi.getAll(),
        slotsApi.getAll({
          area_id: filterArea || undefined,
          status: filterStatus || undefined,
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
    fetchData();
  }, [filterArea, filterStatus]);

  const openAddModal = () => {
    setEditItem(null);
    setFormData({
      area_id: areas.length > 0 ? areas[0].area_id : '',
      slot_number: '',
      slot_type: 'CAR',
      floor_level: '1',
      status: 'AVAILABLE',
    });
    setModalOpen(true);
  };

  const openEditModal = (slot) => {
    setEditItem(slot);
    setFormData({
      area_id: slot.area_id,
      slot_number: slot.slot_number,
      slot_type: slot.slot_type,
      floor_level: slot.floor_level || '1',
      status: slot.status,
    });
    setModalOpen(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      setModalLoading(true);
      if (editItem) {
        await slotsApi.update(editItem.slot_id, formData);
      } else {
        await slotsApi.create(formData);
      }
      setModalOpen(false);
      fetchData();
    } catch (err) {
      alert(err.message || 'Operation failed');
    } finally {
      setModalLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      setDeleteLoading(true);
      await slotsApi.delete(deleteTarget.slot_id);
      setDeleteTarget(null);
      fetchData();
    } catch (err) {
      alert(err.message || 'Failed to delete parking slot');
    } finally {
      setDeleteLoading(false);
    }
  };

  if (loading && slots.length === 0) return <Loader message="Loading parking slots..." fullHeight />;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 tracking-tight">Manage Parking Slots</h2>
          <p className="text-sm text-gray-500 mt-1">
            Configure bays, assign designated vehicle types, floor levels, and maintenance statuses.
          </p>
        </div>
        <button
          onClick={openAddModal}
          className="px-4 py-2.5 bg-teal-600 hover:bg-teal-700 text-white font-semibold text-xs rounded-xl transition shadow-xs flex items-center gap-1.5 self-start"
        >
          <Plus className="w-4 h-4" />
          Add Parking Slot
        </button>
      </div>

      {/* Filters */}
      <div className="bg-white p-4 rounded-2xl border border-gray-100 shadow-xs flex flex-wrap gap-3">
        <select
          value={filterArea}
          onChange={(e) => setFilterArea(e.target.value)}
          className="text-xs border border-gray-200 rounded-xl p-2.5 focus:ring-2 focus:ring-teal-500"
        >
          <option value="">All Parking Areas</option>
          {areas.map((a) => (
            <option key={a.area_id} value={a.area_id}>
              {a.name}
            </option>
          ))}
        </select>

        <select
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value)}
          className="text-xs border border-gray-200 rounded-xl p-2.5 focus:ring-2 focus:ring-teal-500"
        >
          <option value="">All Statuses</option>
          <option value="AVAILABLE">AVAILABLE</option>
          <option value="RESERVED">RESERVED</option>
          <option value="OCCUPIED">OCCUPIED</option>
          <option value="MAINTENANCE">MAINTENANCE</option>
        </select>
      </div>

      {slots.length === 0 ? (
        <EmptyState
          icon={Grid}
          title="No parking slots found"
          description="Create your first slot in this area to enable driver bookings."
          actionLabel="Add Slot"
          onAction={openAddModal}
        />
      ) : (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-gray-700">
              <thead className="bg-gray-50/75 border-b border-gray-100 text-[11px] font-bold text-gray-500 uppercase tracking-wider">
                <tr>
                  <th className="px-5 py-3.5">Slot ID / Number</th>
                  <th className="px-5 py-3.5">Area</th>
                  <th className="px-5 py-3.5">Designated Type</th>
                  <th className="px-5 py-3.5">Floor Level</th>
                  <th className="px-5 py-3.5">Status</th>
                  <th className="px-5 py-3.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {slots.map((slot) => (
                  <tr key={slot.slot_id} className="hover:bg-gray-50/60 transition">
                    <td className="px-5 py-4">
                      <span className="text-xs text-gray-400 font-mono block">#{slot.slot_id}</span>
                      <span className="font-bold text-gray-900 text-sm">Bay {slot.slot_number}</span>
                    </td>
                    <td className="px-5 py-4 text-xs font-medium text-gray-900">
                      {slot.area_name}
                    </td>
                    <td className="px-5 py-4">
                      <Badge status={slot.slot_type} />
                    </td>
                    <td className="px-5 py-4 text-xs text-gray-600">
                      Floor {slot.floor_level || '1'}
                    </td>
                    <td className="px-5 py-4">
                      <Badge status={slot.status} />
                    </td>
                    <td className="px-5 py-4 text-right space-x-2 whitespace-nowrap">
                      <button
                        onClick={() => openEditModal(slot)}
                        className="p-1.5 text-gray-500 hover:text-teal-600 hover:bg-teal-50 rounded-lg transition"
                        title="Edit Slot"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => setDeleteTarget(slot)}
                        className="p-1.5 text-gray-500 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition"
                        title="Delete Slot"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Add / Edit Slot Modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl border border-gray-100">
            <h3 className="text-lg font-bold text-gray-900 mb-4">
              {editItem ? `Edit Slot ${editItem.slot_number}` : 'Add New Parking Bay'}
            </h3>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-gray-700 uppercase mb-1">
                  Parking Area
                </label>
                <select
                  required
                  disabled={!!editItem}
                  value={formData.area_id}
                  onChange={(e) => setFormData({ ...formData, area_id: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-xl text-sm focus:ring-2 focus:ring-teal-500 disabled:bg-gray-100"
                >
                  {areas.map((a) => (
                    <option key={a.area_id} value={a.area_id}>
                      {a.name} ({a.location})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 uppercase mb-1">
                  Slot Number / Identifier
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. A-101"
                  value={formData.slot_number}
                  onChange={(e) => setFormData({ ...formData, slot_number: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-xl text-sm focus:ring-2 focus:ring-teal-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-gray-700 uppercase mb-1">
                    Designated Type
                  </label>
                  <select
                    value={formData.slot_type}
                    onChange={(e) => setFormData({ ...formData, slot_type: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-xl text-sm"
                  >
                    <option value="CAR">Car</option>
                    <option value="BIKE">Bike</option>
                    <option value="EV">Electric Vehicle (EV)</option>
                    <option value="DISABLED">Accessible / Disabled</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-700 uppercase mb-1">
                    Floor Level
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. 1 / B1 / B2"
                    value={formData.floor_level}
                    onChange={(e) => setFormData({ ...formData, floor_level: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-xl text-sm"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 uppercase mb-1">
                  Operational Status
                </label>
                <select
                  value={formData.status}
                  onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-xl text-sm focus:ring-2 focus:ring-teal-500 font-semibold"
                >
                  <option value="AVAILABLE">AVAILABLE (Open for booking)</option>
                  <option value="RESERVED">RESERVED (Has pending booking)</option>
                  <option value="OCCUPIED">OCCUPIED (Vehicle parked)</option>
                  <option value="MAINTENANCE">MAINTENANCE (Blocked from bookings)</option>
                </select>
              </div>

              <div className="flex justify-end gap-3 mt-6 pt-3 border-t border-gray-100">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="px-4 py-2 text-xs font-semibold text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-xl transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={modalLoading}
                  className="px-4 py-2 text-xs font-bold text-white bg-teal-600 hover:bg-teal-700 rounded-xl transition disabled:opacity-50"
                >
                  {modalLoading ? 'Saving...' : editItem ? 'Save Changes' : 'Create Slot'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Slot Confirmation Modal */}
      <ConfirmModal
        isOpen={!!deleteTarget}
        title="Delete Parking Slot"
        message={`Are you sure you want to delete Slot ${deleteTarget?.slot_number}?`}
        confirmText="Delete Slot"
        isDanger={true}
        isLoading={deleteLoading}
        onConfirm={handleDelete}
        onClose={() => setDeleteTarget(null)}
      />
    </div>
  );
};

export default SlotsManagement;

