import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { Pencil, Trash2, Plus, Search, Warehouse, X, AlertCircle } from 'lucide-react';
import { Dialog, Transition } from '@headlessui/react';

interface Store {
  id: number;
  store_name: string;
  store_code: string;
  store_type?: string;
  assigned_staff_id?: number | null;
  location?: string;
  address?: string;
  is_active?: boolean | number;
  created_at?: string;
  updated_at?: string;
}

const STORE_TYPES = [
  { value: 'storage', label: 'Storage' },
  { value: 'sales_van', label: 'Sales Van' },
];

const typeLabel = (type?: string) => STORE_TYPES.find(t => t.value === type)?.label || 'Storage';

interface SalesStaff {
  id: number;
  name: string;
}

const emptyForm = {
  store_name: '',
  store_code: '',
  store_type: 'storage',
  assigned_staff_id: '' as string,
  location: '',
  address: '',
};

const StoreManagementPage: React.FC = () => {
  const [stores, setStores] = useState<Store[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [salesStaff, setSalesStaff] = useState<SalesStaff[]>([]);

  const [addModalOpen, setAddModalOpen] = useState(false);
  const [addForm, setAddForm] = useState(emptyForm);

  const [editingStoreId, setEditingStoreId] = useState<number | null>(null);
  const [editForm, setEditForm] = useState(emptyForm);

  const [showDeleteConfirm, setShowDeleteConfirm] = useState<number | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const authHeaders = { headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` } };

  useEffect(() => {
    // Sales staff that can be assigned to a sales van
    axios
      .get('/api/stores/sales-staff', authHeaders)
      .then(res => setSalesStaff(res.data?.data || []))
      .catch(() => {});
    fetchStores();
  }, []);

  const fetchStores = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await axios.get('/api/stores', authHeaders);
      if (res.data.success) {
        setStores(res.data.data || []);
      } else {
        setError(res.data.error || 'Failed to fetch stores');
      }
    } catch (err: any) {
      setError(err.response?.data?.error || err.message || 'Failed to fetch stores');
    }
    setLoading(false);
  };

  const handleAddStore = async () => {
    if (!addForm.store_name.trim() || !addForm.store_code.trim()) {
      setError('Store name and code are required');
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const res = await axios.post('/api/stores', {
        store_name: addForm.store_name.trim(),
        store_code: addForm.store_code.trim(),
        store_type: addForm.store_type,
        assigned_staff_id: addForm.store_type === 'sales_van' && addForm.assigned_staff_id ? Number(addForm.assigned_staff_id) : null,
        location: addForm.location.trim() || null,
        address: addForm.address.trim() || null,
      }, authHeaders);
      if (res.data.success) {
        setStores([...stores, res.data.data]);
        setAddForm(emptyForm);
        setAddModalOpen(false);
      } else {
        setError(res.data.error || 'Failed to add store');
      }
    } catch (err: any) {
      setError(err.response?.data?.error || err.message || 'Failed to add store');
    }
    setSubmitting(false);
  };

  const startEditing = (store: Store) => {
    setEditingStoreId(store.id);
    setEditForm({
      store_name: store.store_name || '',
      store_code: store.store_code || '',
      store_type: store.store_type || 'storage',
      assigned_staff_id: store.assigned_staff_id ? String(store.assigned_staff_id) : '',
      location: store.location || '',
      address: store.address || '',
    });
  };

  const cancelEditing = () => {
    setEditingStoreId(null);
    setEditForm(emptyForm);
  };

  const handleEditStore = async (id: number) => {
    if (!editForm.store_name.trim() || !editForm.store_code.trim()) {
      setError('Store name and code are required');
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const res = await axios.put(`/api/stores/${id}`, {
        store_name: editForm.store_name.trim(),
        store_code: editForm.store_code.trim(),
        store_type: editForm.store_type,
        assigned_staff_id: editForm.store_type === 'sales_van' && editForm.assigned_staff_id ? Number(editForm.assigned_staff_id) : null,
        location: editForm.location.trim() || null,
        address: editForm.address.trim() || null,
      }, authHeaders);
      if (res.data.success) {
        setStores(stores.map(s => s.id === id ? res.data.data : s));
        cancelEditing();
      } else {
        setError(res.data.error || 'Failed to update store');
      }
    } catch (err: any) {
      setError(err.response?.data?.error || err.message || 'Failed to update store');
    }
    setSubmitting(false);
  };

  const handleDeleteStore = async (id: number) => {
    setSubmitting(true);
    setError(null);
    try {
      const res = await axios.delete(`/api/stores/${id}`, authHeaders);
      if (res.data.success) {
        setStores(stores.filter(s => s.id !== id));
        setShowDeleteConfirm(null);
      } else {
        setError(res.data.error || 'Failed to delete store');
      }
    } catch (err: any) {
      setError(err.response?.data?.error || err.message || 'Failed to delete store');
    }
    setSubmitting(false);
  };

  const filteredStores = stores
    .filter(store => typeFilter === 'all' || (store.store_type || 'storage') === typeFilter)
    .filter(store =>
      store.store_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      store.store_code.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (store.location && store.location.toLowerCase().includes(searchTerm.toLowerCase()))
    );

  return (
    <div className="min-h-screen bg-gray-50 py-4 px-4">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div>
              <h1 className="text-sm font-bold text-gray-900 mb-1">Store Management</h1>
              <p className="text-xs text-gray-600">Manage stores and branches</p>
            </div>
            <button
              onClick={() => setAddModalOpen(true)}
              className="inline-flex items-center px-2.5 py-1.5 border border-transparent text-xs font-medium rounded text-white bg-red-600 hover:bg-red-700 focus:outline-none focus:ring-1 focus:ring-offset-1 focus:ring-red-500 transition-colors duration-200"
            >
              <Plus className="w-3 h-3 mr-1.5" />
              Add Store
            </button>
          </div>
        </div>

        {/* Search */}
        <div className="mb-3">
          <div className="bg-white rounded-lg shadow-sm p-3">
            <div className="flex flex-col sm:flex-row gap-3">
              <div className="flex-1">
                <div className="relative">
                  <Search className="absolute left-2 top-1/2 transform -translate-y-1/2 text-gray-400 w-3 h-3" />
                  <input
                    type="text"
                    placeholder="Search stores by name, code or location..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full pl-8 pr-3 py-1.5 text-xs border border-gray-300 rounded focus:ring-1 focus:ring-red-500 focus:border-transparent"
                  />
                </div>
              </div>
              <div className="flex items-center gap-3 text-xs text-gray-600">
                <div className="flex items-center gap-1.5">
                  <Warehouse className="w-3 h-3" />
                  <span>{filteredStores.length} stores</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Error Message */}
        {error && (
          <div className="mb-3 bg-red-50 border border-red-200 rounded-lg p-2.5">
            <div className="flex">
              <AlertCircle className="w-4 h-4 text-red-400 mr-2 mt-0.5" />
              <div>
                <h3 className="text-xs font-medium text-red-800">Error</h3>
                <div className="mt-0.5 text-xs text-red-700">{error}</div>
              </div>
            </div>
          </div>
        )}

        {/* Type filter */}
        <div className="mb-3 flex flex-wrap gap-2">
          {[{ value: 'all', label: 'All' }, ...STORE_TYPES].map(t => {
            const count = t.value === 'all' ? stores.length : stores.filter(s => (s.store_type || 'storage') === t.value).length;
            return (
              <button
                key={t.value}
                type="button"
                onClick={() => setTypeFilter(t.value)}
                className={`px-3 py-1 rounded-full text-xs font-medium border transition-colors ${
                  typeFilter === t.value ? 'bg-red-600 text-white border-red-600' : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'
                }`}
              >
                {t.label}
                <span className={`ml-1.5 ${typeFilter === t.value ? 'text-red-100' : 'text-gray-400'}`}>{count}</span>
              </button>
            );
          })}
        </div>

        {/* Stores Table */}
        <div className="bg-white rounded-lg shadow-sm overflow-hidden">
          {loading ? (
            <div className="p-4">
              <div className="animate-pulse space-y-3">
                <div className="h-3 bg-gray-200 rounded w-1/4"></div>
                <div className="space-y-2">
                  {[...Array(4)].map((_, i) => (
                    <div key={i} className="h-8 bg-gray-200 rounded"></div>
                  ))}
                </div>
              </div>
            </div>
          ) : filteredStores.length === 0 ? (
            <div className="text-center py-8">
              <div className="w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-3">
                <Warehouse className="w-6 h-6 text-gray-400" />
              </div>
              <h3 className="text-xs font-medium text-gray-900 mb-1.5">
                {searchTerm ? 'No stores found' : 'No stores yet'}
              </h3>
              <p className="text-xs text-gray-500 mb-4">
                {searchTerm
                  ? 'Try adjusting your search terms'
                  : 'Get started by adding your first store'
                }
              </p>
              {!searchTerm && (
                <button
                  onClick={() => setAddModalOpen(true)}
                  className="inline-flex items-center px-3 py-1.5 border border-transparent text-xs font-medium rounded text-white bg-red-600 hover:bg-red-700"
                >
                  <Plus className="w-3 h-3 mr-1.5" />
                  Add Your First Store
                </button>
              )}
            </div>
          ) : (
            <>
              {/* Table Header */}
              <div className="px-3 py-2 border-b border-gray-200 bg-gray-50 hidden md:block">
                <div className="grid grid-cols-12 gap-3 text-[9px] font-medium text-gray-500 uppercase tracking-wider">
                  <div className="col-span-2">Code</div>
                  <div className="col-span-2">Store Name</div>
                  <div className="col-span-2">Type</div>
                  <div className="col-span-2">Assigned Staff</div>
                  <div className="col-span-2">Location</div>
                  <div className="col-span-2 text-right">Actions</div>
                </div>
              </div>

              {/* Table Body */}
              <div className="divide-y divide-gray-200">
                {filteredStores.map(store => (
                  <div key={store.id} className="px-3 py-2 hover:bg-gray-50 transition-colors">
                    <div className="grid grid-cols-1 md:grid-cols-12 gap-2 md:gap-3 md:items-center">
                      {/* Code */}
                      <div className="md:col-span-2">
                        {editingStoreId === store.id ? (
                          <input
                            className="w-full text-xs font-medium text-gray-900 border border-gray-300 rounded px-2 py-1 focus:ring-1 focus:ring-red-500 focus:border-transparent"
                            value={editForm.store_code}
                            onChange={e => setEditForm(f => ({ ...f, store_code: e.target.value }))}
                            onKeyDown={e => {
                              if (e.key === 'Enter') handleEditStore(store.id);
                              if (e.key === 'Escape') cancelEditing();
                            }}
                          />
                        ) : (
                          <span className="text-xs font-medium text-gray-900">{store.store_code}</span>
                        )}
                      </div>

                      {/* Store Name */}
                      <div className="md:col-span-2">
                        {editingStoreId === store.id ? (
                          <input
                            className="w-full text-xs font-medium text-gray-900 border border-gray-300 rounded px-2 py-1 focus:ring-1 focus:ring-red-500 focus:border-transparent"
                            value={editForm.store_name}
                            onChange={e => setEditForm(f => ({ ...f, store_name: e.target.value }))}
                            onKeyDown={e => {
                              if (e.key === 'Enter') handleEditStore(store.id);
                              if (e.key === 'Escape') cancelEditing();
                            }}
                            autoFocus
                          />
                        ) : (
                          <div className="flex items-center">
                            <Warehouse className="w-3 h-3 text-gray-400 mr-1.5" />
                            <span className="text-xs font-medium text-gray-900">{store.store_name}</span>
                          </div>
                        )}
                      </div>

                      {/* Type */}
                      <div className="md:col-span-2">
                        {editingStoreId === store.id ? (
                          <select
                            className="w-full text-xs text-gray-900 border border-gray-300 rounded px-2 py-1 focus:ring-1 focus:ring-red-500 focus:border-transparent"
                            value={editForm.store_type}
                            onChange={e => setEditForm(f => ({ ...f, store_type: e.target.value }))}
                          >
                            {STORE_TYPES.map(t => (
                              <option key={t.value} value={t.value}>{t.label}</option>
                            ))}
                          </select>
                        ) : (
                          <span
                            className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                              store.store_type === 'sales_van' ? 'bg-amber-100 text-amber-700' : 'bg-blue-100 text-blue-700'
                            }`}
                          >
                            {typeLabel(store.store_type)}
                          </span>
                        )}
                      </div>

                      {/* Assigned staff (sales vans only) */}
                      <div className="md:col-span-2">
                        {editingStoreId === store.id ? (
                          <select
                            className="w-full text-xs text-gray-900 border border-gray-300 rounded px-2 py-1 focus:ring-1 focus:ring-red-500 focus:border-transparent disabled:bg-gray-100 disabled:text-gray-400"
                            value={editForm.assigned_staff_id}
                            disabled={editForm.store_type !== 'sales_van'}
                            onChange={e => setEditForm(f => ({ ...f, assigned_staff_id: e.target.value }))}
                          >
                            <option value="">{editForm.store_type === 'sales_van' ? 'Unassigned' : 'Sales vans only'}</option>
                            {salesStaff.map(s => {
                              const takenBy = stores.find(o => o.id !== store.id && o.assigned_staff_id === s.id);
                              return (
                                <option key={s.id} value={s.id} disabled={!!takenBy}>
                                  {s.name}{takenBy ? ` (on ${takenBy.store_name})` : ''}
                                </option>
                              );
                            })}
                          </select>
                        ) : store.store_type === 'sales_van' ? (
                          <span className="text-xs text-gray-700">
                            {salesStaff.find(s => s.id === store.assigned_staff_id)?.name ||
                              (store.assigned_staff_id ? `Staff ${store.assigned_staff_id}` : <span className="text-gray-400 italic">Unassigned</span>)}
                          </span>
                        ) : (
                          <span className="text-xs text-gray-300">—</span>
                        )}
                      </div>

                      {/* Location */}
                      <div className="md:col-span-2">
                        {editingStoreId === store.id ? (
                          <input
                            className="w-full text-xs text-gray-600 border border-gray-300 rounded px-2 py-1 focus:ring-1 focus:ring-red-500 focus:border-transparent"
                            value={editForm.location}
                            onChange={e => setEditForm(f => ({ ...f, location: e.target.value }))}
                            placeholder="Location"
                            onKeyDown={e => {
                              if (e.key === 'Enter') handleEditStore(store.id);
                              if (e.key === 'Escape') cancelEditing();
                            }}
                          />
                        ) : (
                          <span className="text-xs text-gray-600">
                            {store.location || <span className="text-gray-400 italic">No location</span>}
                          </span>
                        )}
                      </div>

                      {/* Actions */}
                      <div className="md:col-span-2">
                        <div className="flex items-center justify-end gap-1.5">
                          {editingStoreId === store.id ? (
                            <>
                              <button
                                onClick={() => handleEditStore(store.id)}
                                disabled={submitting}
                                className="p-0.5 text-green-600 hover:text-green-700 transition-colors disabled:opacity-50"
                                title="Save"
                              >
                                <X className="w-3.5 h-3.5 rotate-45" />
                              </button>
                              <button
                                onClick={cancelEditing}
                                className="p-0.5 text-gray-400 hover:text-gray-600 transition-colors"
                                title="Cancel"
                              >
                                <X className="w-3.5 h-3.5" />
                              </button>
                            </>
                          ) : (
                            <>
                              <button
                                onClick={() => startEditing(store)}
                                className="p-0.5 text-red-600 hover:text-red-700 transition-colors"
                                title="Edit"
                              >
                                <Pencil className="w-3.5 h-3.5" />
                              </button>
                              <button
                                onClick={() => setShowDeleteConfirm(store.id)}
                                className="p-0.5 text-red-600 hover:text-red-700 transition-colors"
                                title="Delete"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>

        {/* Add Store Modal */}
        <Transition show={addModalOpen} as={React.Fragment}>
          <Dialog as="div" className="relative z-50" onClose={() => setAddModalOpen(false)}>
            <Transition.Child
              as={React.Fragment}
              enter="ease-out duration-300"
              enterFrom="opacity-0"
              enterTo="opacity-100"
              leave="ease-in duration-200"
              leaveFrom="opacity-100"
              leaveTo="opacity-0"
            >
              <div className="fixed inset-0 bg-black bg-opacity-25" />
            </Transition.Child>

            <div className="fixed inset-0 overflow-y-auto">
              <div className="flex min-h-full items-center justify-center p-4">
                <Transition.Child
                  as={React.Fragment}
                  enter="ease-out duration-300"
                  enterFrom="opacity-0 scale-95"
                  enterTo="opacity-100 scale-100"
                  leave="ease-in duration-200"
                  leaveFrom="opacity-100 scale-100"
                  leaveTo="opacity-0 scale-95"
                >
                  <Dialog.Panel className="w-full max-w-md transform overflow-hidden rounded-lg bg-white p-4 shadow-xl transition-all">
                    <Dialog.Title className="text-sm font-bold text-gray-900 mb-3">
                      Add New Store
                    </Dialog.Title>
                    <div className="space-y-3">
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="block text-xs font-medium text-gray-700 mb-1">
                            Store Name <span className="text-red-500">*</span>
                          </label>
                          <input
                            type="text"
                            value={addForm.store_name}
                            onChange={(e) => setAddForm(f => ({ ...f, store_name: e.target.value }))}
                            className="w-full text-xs border border-gray-300 rounded px-2 py-1.5 focus:ring-1 focus:ring-red-500 focus:border-transparent"
                            placeholder="e.g. Downtown Store"
                            autoFocus
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-gray-700 mb-1">
                            Store Code <span className="text-red-500">*</span>
                          </label>
                          <input
                            type="text"
                            value={addForm.store_code}
                            onChange={(e) => setAddForm(f => ({ ...f, store_code: e.target.value }))}
                            className="w-full text-xs border border-gray-300 rounded px-2 py-1.5 focus:ring-1 focus:ring-red-500 focus:border-transparent"
                            placeholder="e.g. STORE5"
                          />
                        </div>
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-700 mb-1">
                          Type <span className="text-red-500">*</span>
                        </label>
                        <select
                          value={addForm.store_type}
                          onChange={(e) => setAddForm(f => ({ ...f, store_type: e.target.value }))}
                          className="w-full text-xs border border-gray-300 rounded px-2 py-1.5 focus:ring-1 focus:ring-red-500 focus:border-transparent"
                        >
                          {STORE_TYPES.map(t => (
                            <option key={t.value} value={t.value}>{t.label}</option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-700 mb-1">
                          Assigned Staff
                        </label>
                        <select
                          value={addForm.assigned_staff_id}
                          disabled={addForm.store_type !== 'sales_van'}
                          onChange={(e) => setAddForm(f => ({ ...f, assigned_staff_id: e.target.value }))}
                          className="w-full text-xs border border-gray-300 rounded px-2 py-1.5 focus:ring-1 focus:ring-red-500 focus:border-transparent disabled:bg-gray-100 disabled:text-gray-400"
                        >
                          <option value="">{addForm.store_type === 'sales_van' ? 'Unassigned' : 'Only available for Sales Van'}</option>
                          {salesStaff.map(s => {
                            const takenBy = stores.find(o => o.assigned_staff_id === s.id);
                            return (
                              <option key={s.id} value={s.id} disabled={!!takenBy}>
                                {s.name}{takenBy ? ` (on ${takenBy.store_name})` : ''}
                              </option>
                            );
                          })}
                        </select>
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-700 mb-1">
                          Location
                        </label>
                        <input
                          type="text"
                          value={addForm.location}
                          onChange={(e) => setAddForm(f => ({ ...f, location: e.target.value }))}
                          className="w-full text-xs border border-gray-300 rounded px-2 py-1.5 focus:ring-1 focus:ring-red-500 focus:border-transparent"
                          placeholder="e.g. Industrial Zone"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-700 mb-1">
                          Address
                        </label>
                        <textarea
                          value={addForm.address}
                          onChange={(e) => setAddForm(f => ({ ...f, address: e.target.value }))}
                          className="w-full text-xs border border-gray-300 rounded px-2 py-1.5 focus:ring-1 focus:ring-red-500 focus:border-transparent"
                          placeholder="Full address"
                          rows={2}
                        />
                      </div>
                    </div>
                    <div className="mt-4 flex justify-end gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          setAddModalOpen(false);
                          setAddForm(emptyForm);
                          setError(null);
                        }}
                        className="px-3 py-1.5 text-xs font-medium text-gray-700 bg-white border border-gray-300 rounded hover:bg-gray-50"
                      >
                        Cancel
                      </button>
                      <button
                        type="button"
                        onClick={handleAddStore}
                        disabled={submitting || !addForm.store_name.trim() || !addForm.store_code.trim()}
                        className="px-3 py-1.5 text-xs font-medium text-white bg-red-600 rounded hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {submitting ? 'Adding...' : 'Add Store'}
                      </button>
                    </div>
                  </Dialog.Panel>
                </Transition.Child>
              </div>
            </div>
          </Dialog>
        </Transition>

        {/* Delete Confirmation Modal */}
        <Transition show={showDeleteConfirm !== null} as={React.Fragment}>
          <Dialog as="div" className="relative z-50" onClose={() => setShowDeleteConfirm(null)}>
            <Transition.Child
              as={React.Fragment}
              enter="ease-out duration-300"
              enterFrom="opacity-0"
              enterTo="opacity-100"
              leave="ease-in duration-200"
              leaveFrom="opacity-100"
              leaveTo="opacity-0"
            >
              <div className="fixed inset-0 bg-black bg-opacity-25" />
            </Transition.Child>

            <div className="fixed inset-0 overflow-y-auto">
              <div className="flex min-h-full items-center justify-center p-4">
                <Transition.Child
                  as={React.Fragment}
                  enter="ease-out duration-300"
                  enterFrom="opacity-0 scale-95"
                  enterTo="opacity-100 scale-100"
                  leave="ease-in duration-200"
                  leaveFrom="opacity-100 scale-100"
                  leaveTo="opacity-0 scale-95"
                >
                  <Dialog.Panel className="w-full max-w-md transform overflow-hidden rounded-lg bg-white p-4 shadow-xl transition-all">
                    <Dialog.Title className="text-sm font-bold text-gray-900 mb-2">
                      Confirm Delete
                    </Dialog.Title>
                    <p className="text-xs text-gray-600 mb-4">
                      Are you sure you want to delete this store? Its inventory, transfer and receipt history will also be removed. This action cannot be undone.
                    </p>
                    <div className="flex justify-end gap-2">
                      <button
                        type="button"
                        onClick={() => setShowDeleteConfirm(null)}
                        className="px-3 py-1.5 text-xs font-medium text-gray-700 bg-white border border-gray-300 rounded hover:bg-gray-50"
                      >
                        Cancel
                      </button>
                      <button
                        type="button"
                        onClick={() => showDeleteConfirm && handleDeleteStore(showDeleteConfirm)}
                        disabled={submitting}
                        className="px-3 py-1.5 text-xs font-medium text-white bg-red-600 rounded hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {submitting ? 'Deleting...' : 'Delete'}
                      </button>
                    </div>
                  </Dialog.Panel>
                </Transition.Child>
              </div>
            </div>
          </Dialog>
        </Transition>
      </div>
    </div>
  );
};

export default StoreManagementPage;
