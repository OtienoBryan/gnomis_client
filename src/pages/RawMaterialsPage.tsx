import React, { useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import { Link } from 'react-router-dom';
import { Plus, Package } from 'lucide-react';

interface RawMaterial {
  id: number;
  name: string;
  unit: string;
  cost: number | string;
  alert_qty: number | string;
  is_active: number;
}

const inputClass =
  'w-full border border-gray-300 rounded px-3 py-2 text-xs focus:ring-2 focus:ring-red-500 focus:border-red-500';

const UNITS = ['kg', 'g', 'litre', 'ml', 'pcs', 'box', 'bag', 'carton', 'roll', 'metre', 'tonne'];

const RawMaterialsPage: React.FC = () => {
  const [items, setItems] = useState<RawMaterial[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');

  const [addOpen, setAddOpen] = useState(false);
  const [form, setForm] = useState({ name: '', unit: '', cost: '', alert_qty: '' });
  const [editing, setEditing] = useState<RawMaterial | null>(null);
  const [editForm, setEditForm] = useState({ name: '', unit: '', cost: '', alert_qty: '' });

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return items;
    return items.filter(i => i.name.toLowerCase().includes(q));
  }, [items, search]);

  // Keep a legacy unit selectable if it isn't in the standard list
  const unitOptions = (current: string) => (current && !UNITS.includes(current) ? [current, ...UNITS] : UNITS);

  const errMsg = (err: any, fallback: string) => err.response?.data?.error || err.message || fallback;

  const fetchItems = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await axios.get('/api/financial/raw-materials');
      if (res.data?.success) setItems(Array.isArray(res.data.data) ? res.data.data : []);
      else setError(res.data?.error || 'Failed to load raw materials');
    } catch (err: any) {
      setError(errMsg(err, 'Failed to load raw materials'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchItems();
  }, []);

  const addItem = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const res = await axios.post('/api/financial/raw-materials', {
        name: form.name,
        unit: form.unit,
        cost: form.cost === '' ? 0 : Number(form.cost),
        alert_qty: form.alert_qty === '' ? 0 : Number(form.alert_qty),
      });
      if (res.data?.success && res.data.data) {
        setItems(prev => [...prev, res.data.data as RawMaterial].sort((a, b) => a.name.localeCompare(b.name)));
        setForm({ name: '', unit: '', cost: '', alert_qty: '' });
        setAddOpen(false);
      } else {
        setError(res.data?.error || 'Failed to add raw material');
      }
    } catch (err: any) {
      setError(errMsg(err, 'Failed to add raw material'));
    } finally {
      setSaving(false);
    }
  };

  const patchItem = async (id: number, patch: Record<string, unknown>): Promise<boolean> => {
    setSaving(true);
    setError(null);
    try {
      const res = await axios.put(`/api/financial/raw-materials/${id}`, patch);
      if (res.data?.success && res.data.data) {
        setItems(prev => prev.map(i => (i.id === id ? { ...i, ...res.data.data } : i)));
        return true;
      }
      setError(res.data?.error || 'Failed to update raw material');
    } catch (err: any) {
      setError(errMsg(err, 'Failed to update raw material'));
    } finally {
      setSaving(false);
    }
    return false;
  };

  const deleteItem = async (item: RawMaterial) => {
    if (!confirm(`Delete raw material "${item.name}"?`)) return;
    setSaving(true);
    setError(null);
    try {
      const res = await axios.delete(`/api/financial/raw-materials/${item.id}`);
      if (res.data?.success) setItems(prev => prev.filter(i => i.id !== item.id));
      else setError(res.data?.error || 'Failed to delete raw material');
    } catch (err: any) {
      setError(errMsg(err, 'Failed to delete raw material'));
    } finally {
      setSaving(false);
    }
  };

  const openEdit = (item: RawMaterial) => {
    setEditing(item);
    setEditForm({ name: item.name, unit: item.unit, cost: String(Number(item.cost)), alert_qty: String(Number(item.alert_qty)) });
  };

  const saveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editing) return;
    const ok = await patchItem(editing.id, {
      name: editForm.name,
      unit: editForm.unit,
      cost: editForm.cost === '' ? 0 : Number(editForm.cost),
      alert_qty: editForm.alert_qty === '' ? 0 : Number(editForm.alert_qty),
    });
    if (ok) setEditing(null);
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="w-full py-6 px-4 sm:px-6 lg:px-8">
        <div className="mb-6 flex items-center justify-between gap-3 flex-wrap">
          <div>
            <h1 className="text-xl font-bold text-gray-900">Raw Materials</h1>
            <p className="text-xs text-gray-600 mt-1">Manage raw materials, their units and alert quantities.</p>
          </div>
          <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => { setError(null); setAddOpen(true); }}
            className="inline-flex items-center px-3 py-1.5 rounded-md shadow-sm text-xs font-medium text-white bg-red-600 hover:bg-red-700"
          >
            <Plus className="w-3.5 h-3.5 mr-1.5" />
            Add Raw Material
          </button>
          <button
            type="button"
            onClick={fetchItems}
            disabled={loading}
            className="px-3 py-1.5 border border-gray-300 rounded-md shadow-sm text-xs font-medium text-gray-700 bg-white hover:bg-gray-50"
          >
            Refresh
          </button>
          </div>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-red-700 text-xs mb-4">{error}</div>
        )}

        <div className="mb-3">
          <input className={`${inputClass} max-w-xs bg-white`} placeholder="Search raw materials..." value={search} onChange={e => setSearch(e.target.value)} />
        </div>

        <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
          {loading ? (
            <div className="p-10 text-center">
              <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-red-600 mx-auto"></div>
              <p className="mt-3 text-sm text-gray-600">Loading raw materials...</p>
            </div>
          ) : filtered.length === 0 ? (
            <div className="p-10 text-center text-gray-500">
              <Package className="h-10 w-10 mx-auto mb-2 opacity-40" />
              <p className="text-sm font-medium">No raw materials found</p>
              <p className="text-xs mt-1">Add one using the form above.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-2 text-left text-[10px] font-medium text-gray-500 uppercase tracking-wider">Name</th>
                    <th className="px-4 py-2 text-left text-[10px] font-medium text-gray-500 uppercase tracking-wider">Unit</th>
                    <th className="px-4 py-2 text-right text-[10px] font-medium text-gray-500 uppercase tracking-wider">Cost</th>
                    <th className="px-4 py-2 text-right text-[10px] font-medium text-gray-500 uppercase tracking-wider">Alert Qty</th>
                    <th className="px-4 py-2 text-left text-[10px] font-medium text-gray-500 uppercase tracking-wider">Status</th>
                    <th className="px-4 py-2 text-right text-[10px] font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {filtered.map(row => (
                    <tr key={row.id} className="hover:bg-gray-50">
                      <td className="px-4 py-2 text-xs font-medium text-gray-900">{row.name}</td>
                      <td className="px-4 py-2 text-xs text-gray-700">{row.unit}</td>
                      <td className="px-4 py-2 text-right text-xs text-gray-900">{Number(row.cost).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                      <td className="px-4 py-2 text-right text-xs text-gray-900">{Number(row.alert_qty).toLocaleString()}</td>
                      <td className="px-4 py-2">
                        <button
                          type="button"
                          disabled={saving}
                          onClick={() => patchItem(row.id, { is_active: row.is_active ? 0 : 1 })}
                          className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-semibold border ${
                            row.is_active ? 'bg-green-100 text-green-800 border-green-200' : 'bg-gray-100 text-gray-700 border-gray-200'
                          }`}
                        >
                          {row.is_active ? 'Active' : 'Inactive'}
                        </button>
                      </td>
                      <td className="px-4 py-2 text-right">
                        <div className="inline-flex items-center gap-1.5">
                          <Link
                            to={`/raw-materials-ledger?material=${row.id}`}
                            className="px-2.5 py-1 rounded-md text-[11px] font-medium text-white bg-blue-600 hover:bg-blue-700 shadow-sm"
                          >
                            Ledger
                          </Link>
                          <button
                            type="button"
                            onClick={() => openEdit(row)}
                            disabled={saving}
                            className="px-2.5 py-1 rounded-md text-[11px] font-medium text-white bg-red-600 hover:bg-red-700 shadow-sm"
                          >
                            Edit
                          </button>
                          <button
                            type="button"
                            onClick={() => deleteItem(row)}
                            disabled={saving}
                            className="px-2.5 py-1 rounded-md text-[11px] font-medium text-white bg-gray-600 hover:bg-gray-700 shadow-sm"
                          >
                            Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {addOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center z-50" onClick={() => setAddOpen(false)}>
          <form onSubmit={addItem} onClick={e => e.stopPropagation()} className="bg-white rounded-lg shadow-lg p-5 w-full max-w-sm">
            <h2 className="text-sm font-bold mb-3">Add Raw Material</h2>
            {error && <div className="mb-2.5 text-xs text-red-600">{error}</div>}
            <div className="mb-2.5">
              <label className="block text-xs font-medium mb-1">Name</label>
              <input className={inputClass} value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} required autoFocus />
            </div>
            <div className="mb-2.5">
              <label className="block text-xs font-medium mb-1">Unit</label>
              <select className={inputClass} value={form.unit} onChange={e => setForm(f => ({ ...f, unit: e.target.value }))} required>
                <option value="">Select unit</option>
                {unitOptions(form.unit).map(u => <option key={u} value={u}>{u}</option>)}
              </select>
            </div>
            <div className="mb-2.5">
              <label className="block text-xs font-medium mb-1">Cost (per unit)</label>
              <input className={inputClass} type="number" min="0" step="0.01" value={form.cost} onChange={e => setForm(f => ({ ...f, cost: e.target.value }))} required />
            </div>
            <div className="mb-4">
              <label className="block text-xs font-medium mb-1">Alert Qty</label>
              <input className={inputClass} type="number" min="0" step="0.01" value={form.alert_qty} onChange={e => setForm(f => ({ ...f, alert_qty: e.target.value }))} />
            </div>
            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => setAddOpen(false)} className="px-3 py-1.5 rounded-md text-xs font-medium bg-gray-200 hover:bg-gray-300">Cancel</button>
              <button type="submit" disabled={saving} className="px-3 py-1.5 rounded-md text-xs font-medium text-white bg-red-600 hover:bg-red-700 disabled:opacity-50">
                {saving ? 'Saving...' : 'Add'}
              </button>
            </div>
          </form>
        </div>
      )}

      {editing && (
        <div className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center z-50" onClick={() => setEditing(null)}>
          <form onSubmit={saveEdit} onClick={e => e.stopPropagation()} className="bg-white rounded-lg shadow-lg p-5 w-full max-w-sm">
            <h2 className="text-sm font-bold mb-3">Edit Raw Material</h2>
            <div className="mb-2.5">
              <label className="block text-xs font-medium mb-1">Name</label>
              <input className={inputClass} value={editForm.name} onChange={e => setEditForm(f => ({ ...f, name: e.target.value }))} required />
            </div>
            <div className="mb-2.5">
              <label className="block text-xs font-medium mb-1">Unit</label>
              <select className={inputClass} value={editForm.unit} onChange={e => setEditForm(f => ({ ...f, unit: e.target.value }))} required>
                <option value="">Select unit</option>
                {unitOptions(editForm.unit).map(u => <option key={u} value={u}>{u}</option>)}
              </select>
            </div>
            <div className="mb-2.5">
              <label className="block text-xs font-medium mb-1">Cost (per unit)</label>
              <input className={inputClass} type="number" min="0" step="0.01" value={editForm.cost} onChange={e => setEditForm(f => ({ ...f, cost: e.target.value }))} required />
            </div>
            <div className="mb-4">
              <label className="block text-xs font-medium mb-1">Alert Qty</label>
              <input className={inputClass} type="number" min="0" step="0.01" value={editForm.alert_qty} onChange={e => setEditForm(f => ({ ...f, alert_qty: e.target.value }))} />
            </div>
            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => setEditing(null)} className="px-3 py-1.5 rounded-md text-xs font-medium bg-gray-200 hover:bg-gray-300">Cancel</button>
              <button type="submit" disabled={saving} className="px-3 py-1.5 rounded-md text-xs font-medium text-white bg-red-600 hover:bg-red-700 disabled:opacity-50">
                {saving ? 'Saving...' : 'Save'}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};

export default RawMaterialsPage;
