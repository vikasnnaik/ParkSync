import React, { useState, useEffect } from 'react';
import { MapPin, Plus, Edit2, Trash2, Search } from 'lucide-react';
import { areasApi } from '../../api/client';
import Loader from '../../components/common/Loader';
import EmptyState from '../../components/common/EmptyState';
import ConfirmModal from '../../components/common/ConfirmModal';
import EmbeddedSqlBadge from '../../components/common/EmbeddedSqlBadge';
import { EMBEDDED_QUERIES } from '../../db/embeddedQueries';

// Embedded SQL GROUP BY & HAVING statement incorporated directly for academic DBMS evaluation:
const EMBEDDED_AREA_GROUP_BY_SQL = EMBEDDED_QUERIES.AREA_CAPACITY_GROUP_BY_HAVING.sql;

export const AreasManagement = () => {
  const [areas, setAreas] = useState([]);
  const [loading, setLoading] = useState(true);

  // Add / Edit Modal
  const [modalOpen, setModalOpen] = useState(false);
  const [editItem, setEditItem] = useState(null);
  const [formData, setFormData] = useState({
    name: '',
    location: '',
    area_type: 'Commercial',
    total_capacity: 50,
  });
  const [modalLoading, setModalLoading] = useState(false);

  // Delete Modal
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  const fetchAreas = async () => {
    try {
      setLoading(true);
      const res = await areasApi.getAll();
      if (res.success) setAreas(res.areas);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAreas();
  }, []);

  const openAddModal = () => {
    setEditItem(null);
    setFormData({ name: '', location: '', area_type: 'Commercial', total_capacity: 50 });
    setModalOpen(true);
  };

  const openEditModal = (area) => {
    setEditItem(area);
    setFormData({
      name: area.name,
      location: area.location,
      area_type: area.area_type || 'Commercial',
      total_capacity: area.total_capacity || 50,
    });
    setModalOpen(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      setModalLoading(true);
      if (editItem) {
        await areasApi.update(editItem.area_id, formData);
      } else {
        await areasApi.create(formData);
      }
      setModalOpen(false);
      fetchAreas();
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
      await areasApi.delete(deleteTarget.area_id);
      setDeleteTarget(null);
      fetchAreas();
    } catch (err) {
      alert(err.message || 'Failed to delete parking area');
    } finally {
      setDeleteLoading(false);
    }
  };

  if (loading) return <Loader message="Loading parking areas..." fullHeight />;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h2 className="text-2xl font-bold text-gray-900 tracking-tight">Manage Parking Areas</h2>
            <EmbeddedSqlBadge queryKey="AREA_CAPACITY_GROUP_BY_HAVING" label="GROUP BY & HAVING SQL" />
          </div>
          <p className="text-sm text-gray-500 mt-1">
            Configure parking buildings, locations, designated zones, and total capacities.
          </p>
        </div>
        <button
          onClick={openAddModal}
          className="px-4 py-2.5 bg-teal-600 hover:bg-teal-700 text-white font-semibold text-xs rounded-xl transition shadow-xs flex items-center gap-1.5 self-start"
        >
          <Plus className="w-4 h-4" />
          Add Parking Area
        </button>
      </div>

      {areas.length === 0 ? (
        <EmptyState
          icon={MapPin}
          title="No parking areas found"
          description="Create your first parking area to start setting up bays."
          actionLabel="Create Area"
          onAction={openAddModal}
        />
      ) : (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-gray-700">
              <thead className="bg-gray-50/75 border-b border-gray-100 text-[11px] font-bold text-gray-500 uppercase tracking-wider">
                <tr>
                  <th className="px-5 py-3.5">Area ID</th>
                  <th className="px-5 py-3.5">Name</th>
                  <th className="px-5 py-3.5">Location</th>
                  <th className="px-5 py-3.5">Type</th>
                  <th className="px-5 py-3.5">Slots / Capacity</th>
                  <th className="px-5 py-3.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {areas.map((area) => (
                  <tr key={area.area_id} className="hover:bg-gray-50/60 transition">
                    <td className="px-5 py-4 font-mono font-bold text-xs text-gray-900">
                      #{area.area_id}
                    </td>
                    <td className="px-5 py-4 font-bold text-gray-900 text-sm">
                      {area.name}
                    </td>
                    <td className="px-5 py-4 text-xs text-gray-600">
                      {area.location}
                    </td>
                    <td className="px-5 py-4">
                      <span className="text-xs bg-gray-100 text-gray-700 px-2 py-0.5 rounded-md font-medium">
                        {area.area_type || 'General'}
                      </span>
                    </td>
                    <td className="px-5 py-4 text-xs font-semibold text-gray-800">
                      {area.total_slots || 0} active / {area.total_capacity || 50} max
                    </td>
                    <td className="px-5 py-4 text-right space-x-2 whitespace-nowrap">
                      <button
                        onClick={() => openEditModal(area)}
                        className="p-1.5 text-gray-500 hover:text-teal-600 hover:bg-teal-50 rounded-lg transition"
                        title="Edit Area"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => setDeleteTarget(area)}
                        className="p-1.5 text-gray-500 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition"
                        title="Delete Area"
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

      {/* Add / Edit Area Modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl border border-gray-100">
            <h3 className="text-lg font-bold text-gray-900 mb-4">
              {editItem ? 'Edit Parking Area' : 'Create New Parking Area'}
            </h3>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-gray-700 uppercase mb-1">
                  Area Name
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. North Terminal Hub"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-xl text-sm focus:ring-2 focus:ring-teal-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 uppercase mb-1">
                  Location / Address
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Building B, Level 1, Ring Road"
                  value={formData.location}
                  onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-xl text-sm focus:ring-2 focus:ring-teal-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-gray-700 uppercase mb-1">
                    Area Type
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Mall / Campus"
                    value={formData.area_type}
                    onChange={(e) => setFormData({ ...formData, area_type: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-xl text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-700 uppercase mb-1">
                    Total Capacity
                  </label>
                  <input
                    type="number"
                    min="1"
                    required
                    value={formData.total_capacity}
                    onChange={(e) => setFormData({ ...formData, total_capacity: parseInt(e.target.value, 10) })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-xl text-sm"
                  />
                </div>
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
                  {modalLoading ? 'Saving...' : editItem ? 'Save Changes' : 'Create Area'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Area Confirmation Modal */}
      <ConfirmModal
        isOpen={!!deleteTarget}
        title="Delete Parking Area"
        message={`Are you sure you want to delete ${deleteTarget?.name}? Note: Foreign key constraints prevent deleting areas with active slots.`}
        confirmText="Delete Area"
        isDanger={true}
        isLoading={deleteLoading}
        onConfirm={handleDelete}
        onClose={() => setDeleteTarget(null)}
      />
    </div>
  );
};

export default AreasManagement;

