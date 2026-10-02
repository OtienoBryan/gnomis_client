import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { API_CONFIG } from '../config/api';
import { Rider } from '../services/riderService';

const RiderEditModal: React.FC<{
  open: boolean;
  rider: Rider | null;
  onClose: () => void;
  onSave: () => void;
}> = ({ open, rider, onClose, onSave }) => {
  const [form, setForm] = useState<Partial<Rider>>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open && rider) {
      setForm({ ...rider });
      setError(null);
    }
  }, [open, rider]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setForm((f) => ({ ...f, [e.target.name]: e.target.value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!rider?.id) return;

    setLoading(true);
    setError(null);
    try {
      const res = await fetch(API_CONFIG.getUrl(`/riders/${rider.id}`), {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({
          name: form.name,
          contact: form.contact,
          id_number: form.id_number,
          company_id: form.company_id
        })
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.error || `HTTP ${res.status}`);
      }
      setLoading(false);
      onSave();
      onClose();
    } catch (err: any) {
      setLoading(false);
      setError(err.message || 'Failed to update driver');
    }
  };

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 px-4">
      <div className="bg-white rounded-md shadow-lg w-full max-w-sm p-4 relative">
        <button className="absolute top-2 right-2 text-gray-400 hover:text-gray-600 text-lg leading-none" onClick={onClose}>&times;</button>
        <h2 className="text-sm font-bold text-gray-900 mb-3">Edit Driver</h2>
        <form onSubmit={handleSubmit} className="space-y-2.5">
          <div>
            <label className="block text-[9px] font-semibold text-gray-500 uppercase tracking-wider mb-1">Name</label>
            <input
              name="name"
              value={form.name || ''}
              onChange={handleChange}
              className="border border-gray-300 rounded px-2 py-1.5 w-full text-xs focus:outline-none focus:ring-1 focus:ring-red-500"
              required
              disabled={loading}
            />
          </div>
          <div>
            <label className="block text-[9px] font-semibold text-gray-500 uppercase tracking-wider mb-1">Contact</label>
            <input
              name="contact"
              value={form.contact || ''}
              onChange={handleChange}
              className="border border-gray-300 rounded px-2 py-1.5 w-full text-xs focus:outline-none focus:ring-1 focus:ring-red-500"
              required
              disabled={loading}
            />
          </div>
          <div>
            <label className="block text-[9px] font-semibold text-gray-500 uppercase tracking-wider mb-1">ID Number</label>
            <input
              name="id_number"
              value={form.id_number || ''}
              onChange={handleChange}
              className="border border-gray-300 rounded px-2 py-1.5 w-full text-xs focus:outline-none focus:ring-1 focus:ring-red-500"
              required
              disabled={loading}
            />
          </div>
          {error && <div className="text-red-600 text-[10px] mt-1">{error}</div>}
          <div className="flex justify-end gap-2 mt-3">
            <button type="button" className="px-3 py-1.5 rounded bg-gray-100 text-gray-700 text-xs font-medium hover:bg-gray-200 disabled:opacity-50" onClick={onClose} disabled={loading}>Cancel</button>
            <button type="submit" className="px-3 py-1.5 rounded bg-red-600 text-white text-xs font-semibold shadow hover:bg-red-700 disabled:opacity-50" disabled={loading}>{loading ? 'Saving...' : 'Save'}</button>
          </div>
        </form>
      </div>
    </div>
  );
};

const RiderAddModal: React.FC<{
  open: boolean;
  onClose: () => void;
  onSave: () => void;
}> = ({ open, onClose, onSave }) => {
  const [form, setForm] = useState<Partial<Rider>>({
    name: '',
    contact: '',
    id_number: ''
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setForm({ name: '', contact: '', id_number: '' });
      setError(null);
    }
  }, [open]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setForm((f) => ({ ...f, [e.target.name]: e.target.value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(API_CONFIG.getUrl('/riders'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({
          name: form.name,
          contact: form.contact,
          id_number: form.id_number
        })
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.error || `HTTP ${res.status}`);
      }
      setLoading(false);
      onSave();
      onClose();
      setForm({ name: '', contact: '', id_number: '' });
    } catch (err: any) {
      setLoading(false);
      setError(err.message || 'Failed to add driver');
    }
  };

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 px-4">
      <div className="bg-white rounded-md shadow-lg w-full max-w-sm p-4 relative">
        <button className="absolute top-2 right-2 text-gray-400 hover:text-gray-600 text-lg leading-none" onClick={onClose}>&times;</button>
        <h2 className="text-sm font-bold text-gray-900 mb-3">Add Driver</h2>
        <form onSubmit={handleSubmit} className="space-y-2.5">
          <div>
            <label className="block text-[9px] font-semibold text-gray-500 uppercase tracking-wider mb-1">Name</label>
            <input
              name="name"
              value={form.name}
              onChange={handleChange}
              className="border border-gray-300 rounded px-2 py-1.5 w-full text-xs focus:outline-none focus:ring-1 focus:ring-red-500"
              required
              disabled={loading}
            />
          </div>
          <div>
            <label className="block text-[9px] font-semibold text-gray-500 uppercase tracking-wider mb-1">Contact</label>
            <input
              name="contact"
              value={form.contact}
              onChange={handleChange}
              className="border border-gray-300 rounded px-2 py-1.5 w-full text-xs focus:outline-none focus:ring-1 focus:ring-red-500"
              required
              disabled={loading}
            />
          </div>
          <div>
            <label className="block text-[9px] font-semibold text-gray-500 uppercase tracking-wider mb-1">ID Number</label>
            <input
              name="id_number"
              value={form.id_number}
              onChange={handleChange}
              className="border border-gray-300 rounded px-2 py-1.5 w-full text-xs focus:outline-none focus:ring-1 focus:ring-red-500"
              required
              disabled={loading}
            />
          </div>
          {error && <div className="text-red-600 text-[10px] mt-1">{error}</div>}
          <div className="flex justify-end gap-2 mt-3">
            <button type="button" className="px-3 py-1.5 rounded bg-gray-100 text-gray-700 text-xs font-medium hover:bg-gray-200 disabled:opacity-50" onClick={onClose} disabled={loading}>Cancel</button>
            <button type="submit" className="px-3 py-1.5 rounded bg-red-600 text-white text-xs font-semibold shadow hover:bg-red-700 disabled:opacity-50" disabled={loading}>{loading ? 'Saving...' : 'Save'}</button>
          </div>
        </form>
      </div>
    </div>
  );
};

const RidersPage: React.FC = () => {
  const [riders, setRiders] = useState<Rider[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editRider, setEditRider] = useState<Rider | null>(null);
  const [editOpen, setEditOpen] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const pageSize = 10;
  const navigate = useNavigate();

  const fetchRiders = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(API_CONFIG.getUrl('/riders'), {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      if (data.data) {
        setRiders(data.data || []);
      } else {
        setError('Failed to fetch drivers');
      }
    } catch (err: any) {
      setError(err.message || 'Failed to fetch drivers');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRiders();
  }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const base = q
      ? riders.filter((r) =>
          [r.name, r.contact, r.id_number]
            .filter((v): v is string => Boolean(v))
            .some((v) => v.toLowerCase().includes(q))
        )
      : riders;
    return base;
  }, [riders, search]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const currentPage = Math.min(page, totalPages);
  const paged = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filtered.slice(start, start + pageSize);
  }, [filtered, currentPage]);

  const handleEdit = (rider: Rider) => {
    setEditRider(rider);
    setEditOpen(true);
  };

  const handleDelete = async (riderId: number) => {
    if (!confirm('Are you sure you want to delete this driver?')) return;

    try {
      const res = await fetch(API_CONFIG.getUrl(`/riders/${riderId}`), {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      fetchRiders();
    } catch (err: any) {
      alert('Failed to delete driver: ' + err.message);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="w-full mx-auto px-4 py-4">
        {/* Header */}
        <div className="bg-white border border-gray-200 rounded-md p-3 mb-3 flex items-center justify-between flex-wrap gap-2">
          <div>
            <h1 className="text-sm font-bold text-gray-900">Drivers</h1>
            <p className="text-[10px] text-gray-500 mt-0.5">Manage delivery drivers and their information</p>
          </div>
          <div className="flex items-center gap-2">
            <div className="relative">
              <input
                type="text"
                placeholder="Search drivers..."
                value={search}
                onChange={(e) => { setPage(1); setSearch(e.target.value); }}
                className="pl-7 pr-3 py-1.5 border border-gray-300 rounded-md text-xs focus:outline-none focus:ring-1 focus:ring-red-500 w-56"
              />
              <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400 text-xs">🔎</span>
            </div>
            <button
              className="px-3 py-1.5 bg-red-600 text-white rounded-md hover:bg-red-700 text-xs font-semibold shadow-sm"
              onClick={() => setAddOpen(true)}
            >
              + Add Driver
            </button>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mb-3">
          <div className="bg-white border border-gray-200 rounded-md p-3">
            <p className="text-[9px] font-semibold text-gray-500 uppercase tracking-wider">Total Drivers</p>
            <p className="text-lg font-bold text-gray-900 mt-0.5">{riders.length}</p>
          </div>
          <div className="bg-white border border-gray-200 rounded-md p-3">
            <p className="text-[9px] font-semibold text-gray-500 uppercase tracking-wider">Filtered</p>
            <p className="text-lg font-bold text-gray-900 mt-0.5">{filtered.length}</p>
          </div>
          <div className="bg-white border border-green-200 rounded-md p-3 col-span-2 md:col-span-1">
            <p className="text-[9px] font-semibold text-gray-500 uppercase tracking-wider">Active</p>
            <p className="text-lg font-bold text-green-600 mt-0.5">{riders.length}</p>
          </div>
        </div>

        {/* Table */}
        <div className="bg-white border border-gray-200 rounded-md overflow-hidden">
          {loading ? (
            <div className="flex items-center justify-center py-16">
              <div className="animate-spin rounded-full h-8 w-8 border-2 border-red-600 border-t-transparent"></div>
            </div>
          ) : error ? (
            <div className="p-6 text-center text-xs text-red-600">{error}</div>
          ) : (
            <div className="overflow-x-auto w-full">
              <table className="w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-3 py-2 text-left text-[9px] font-semibold text-gray-500 uppercase tracking-wider">Name</th>
                    <th className="px-3 py-2 text-left text-[9px] font-semibold text-gray-500 uppercase tracking-wider">Contact</th>
                    <th className="px-3 py-2 text-left text-[9px] font-semibold text-gray-500 uppercase tracking-wider">ID Number</th>
                    <th className="px-3 py-2 text-center text-[9px] font-semibold text-gray-500 uppercase tracking-wider">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {paged.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="px-3 py-8 text-center text-xs text-gray-500">No drivers found</td>
                    </tr>
                  ) : (
                    paged.map((rider) => (
                      <tr key={rider.id} className="hover:bg-gray-50">
                        <td className="px-3 py-2 whitespace-nowrap text-xs font-medium text-gray-900">{rider.name}</td>
                        <td className="px-3 py-2 whitespace-nowrap text-xs text-gray-700">{rider.contact}</td>
                        <td className="px-3 py-2 whitespace-nowrap text-xs text-gray-700">{rider.id_number}</td>
                        <td className="px-3 py-2 whitespace-nowrap text-xs text-right">
                          <div className="inline-flex items-center gap-1.5">
                            <button
                              className="px-2 py-1 bg-red-500 text-white rounded hover:bg-red-600 text-[9px] font-semibold"
                              onClick={() => navigate(`/financial/customer-orders?rider_id=${rider.id}&status=2,3,4`)}
                            >
                              Orders
                            </button>
                            <button
                              className="px-2 py-1 bg-amber-500 text-white rounded hover:bg-amber-600 text-[9px] font-semibold"
                              onClick={() => handleEdit(rider)}
                            >
                              Edit
                            </button>
                            <button
                              className="px-2 py-1 bg-gray-600 text-white rounded hover:bg-gray-700 text-[9px] font-semibold"
                              onClick={() => handleDelete(rider.id)}
                            >
                              Delete
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          )}
          {/* Pagination */}
          {!loading && filtered.length > 0 && (
            <div className="flex items-center justify-between px-3 py-2 border-t border-gray-200">
              <div className="text-[10px] text-gray-500">
                Showing {(currentPage - 1) * pageSize + 1}–{Math.min(currentPage * pageSize, filtered.length)} of {filtered.length}
              </div>
              <div className="flex items-center gap-1.5">
                <button
                  className="px-2.5 py-1 border border-gray-300 rounded text-[10px] font-medium text-gray-600 hover:bg-gray-50 disabled:opacity-50"
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                >
                  Prev
                </button>
                <span className="text-[10px] text-gray-600">Page {currentPage} / {totalPages}</span>
                <button
                  className="px-2.5 py-1 border border-gray-300 rounded text-[10px] font-medium text-gray-600 hover:bg-gray-50 disabled:opacity-50"
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={currentPage === totalPages}
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </div>

        <RiderEditModal
          open={editOpen}
          rider={editRider}
          onClose={() => setEditOpen(false)}
          onSave={() => {
            setEditOpen(false);
            setEditRider(null);
            fetchRiders();
          }}
        />
        <RiderAddModal
          open={addOpen}
          onClose={() => setAddOpen(false)}
          onSave={() => {
            setAddOpen(false);
            fetchRiders();
          }}
        />
      </div>
    </div>
  );
};

export default RidersPage;
