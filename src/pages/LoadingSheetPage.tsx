import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { loadingSheetService, LoadingSheetApprovedOrder } from '../services/financialService';
import { API_CONFIG } from '../config/api';

interface VehicleOption {
  id: number;
  registration_number: string;
  model: string;
}

const LoadingSheetPage: React.FC = () => {
  const navigate = useNavigate();
  const [orders, setOrders] = useState<LoadingSheetApprovedOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());

  const [drivers, setDrivers] = useState<{ id: number; name: string; contact?: string }[]>([]);
  const [vehicles, setVehicles] = useState<VehicleOption[]>([]);
  const [selectedDriver, setSelectedDriver] = useState<number | ''>('');
  const [selectedVehicle, setSelectedVehicle] = useState<number | ''>('');
  const [notes, setNotes] = useState('');

  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const fetchOrders = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await loadingSheetService.getApprovedOrders();
      if (res.success) {
        setOrders(res.data || []);
      } else {
        setError(res.error || 'Failed to fetch approved orders');
      }
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to fetch approved orders');
    } finally {
      setLoading(false);
    }
  };

  const fetchDriversAndVehicles = async () => {
    try {
      const res = await fetch(API_CONFIG.getUrl('/riders'), {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
      });
      const data = await res.json();
      if (res.ok && data.data) setDrivers(data.data || []);
    } catch (err) {
      console.error('Error fetching drivers:', err);
    }
    try {
      const res = await fetch(API_CONFIG.getUrl('/vehicles'), {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
      });
      const data = await res.json();
      if (res.ok && data.success) setVehicles(data.data || []);
    } catch (err) {
      console.error('Error fetching vehicles:', err);
    }
  };

  useEffect(() => {
    fetchOrders();
    fetchDriversAndVehicles();
  }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return q
      ? orders.filter((o) =>
          [o.so_number, o.customer_name].filter(Boolean).some((v) => v.toLowerCase().includes(q))
        )
      : orders;
  }, [orders, search]);

  const toggleOrder = (id: number) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const toggleAll = () => {
    if (selectedIds.size === filtered.length && filtered.length > 0) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filtered.map((o) => o.id)));
    }
  };

  const formatCurrency = (amount: number) =>
    new Intl.NumberFormat('en-KE', { style: 'currency', currency: 'KES', minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(amount || 0);

  const formatDate = (d: string) => (d ? new Date(d).toLocaleDateString() : 'N/A');

  const handleCreateLoadingSheet = async () => {
    if (selectedIds.size === 0) {
      setSubmitError('Select at least one order');
      return;
    }
    if (!selectedDriver) {
      setSubmitError('Select a driver');
      return;
    }
    if (!selectedVehicle) {
      setSubmitError('Select a vehicle');
      return;
    }
    try {
      setSubmitting(true);
      setSubmitError(null);
      setSuccessMsg(null);
      const res = await loadingSheetService.create({
        order_ids: Array.from(selectedIds),
        driver_id: Number(selectedDriver),
        vehicle_id: Number(selectedVehicle),
        notes: notes || undefined
      });
      if (res.success) {
        setSuccessMsg(`Loading sheet ${res.data.sheet_number} created successfully`);
        setSelectedIds(new Set());
        setSelectedDriver('');
        setSelectedVehicle('');
        setNotes('');
        await fetchOrders();
        setTimeout(() => {
          if (res.data?.id) navigate(`/loading-sheet/${res.data.id}`);
        }, 1200);
      } else {
        setSubmitError(res.error || 'Failed to create loading sheet');
      }
    } catch (err: any) {
      setSubmitError(err.response?.data?.error || 'Failed to create loading sheet');
    } finally {
      setSubmitting(false);
    }
  };

  const selectedTotal = useMemo(() => {
    return orders.filter((o) => selectedIds.has(o.id)).reduce((sum, o) => sum + Number(o.total_amount || 0), 0);
  }, [orders, selectedIds]);

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="w-full mx-auto px-4 py-4">
        {/* Header */}
        <div className="bg-white border border-gray-200 rounded-md p-3 mb-3 flex items-center justify-between flex-wrap gap-2">
          <div>
            <h1 className="text-sm font-bold text-gray-900">Loading Sheet</h1>
            <p className="text-[10px] text-gray-500 mt-0.5">Select approved orders and assign them to a driver and vehicle for dispatch</p>
          </div>
          <div className="flex items-center gap-2">
            <div className="relative">
              <input
                type="text"
                placeholder="Search orders..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-7 pr-3 py-1.5 border border-gray-300 rounded-md text-xs focus:outline-none focus:ring-1 focus:ring-red-500 w-56"
              />
              <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400 text-xs">🔎</span>
            </div>
            <button
              onClick={() => navigate('/loading-sheet/history')}
              className="px-3 py-1.5 bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200 text-xs font-semibold"
            >
              View History
            </button>
          </div>
        </div>

        {successMsg && (
          <div className="mb-3 p-2.5 bg-green-50 border border-green-200 text-green-700 text-xs rounded-md">{successMsg}</div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-3">
          {/* Orders table */}
          <div className="lg:col-span-3 bg-white border border-gray-200 rounded-md overflow-hidden">
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
                      <th className="px-3 py-2 text-left w-8">
                        <input
                          type="checkbox"
                          checked={filtered.length > 0 && selectedIds.size === filtered.length}
                          onChange={toggleAll}
                        />
                      </th>
                      <th className="px-3 py-2 text-left text-[9px] font-semibold text-gray-500 uppercase tracking-wider">Order #</th>
                      <th className="px-3 py-2 text-left text-[9px] font-semibold text-gray-500 uppercase tracking-wider">Client</th>
                      <th className="px-3 py-2 text-left text-[9px] font-semibold text-gray-500 uppercase tracking-wider">Date</th>
                      <th className="px-3 py-2 text-right text-[9px] font-semibold text-gray-500 uppercase tracking-wider">Amount</th>
                      <th className="px-3 py-2 text-left text-[9px] font-semibold text-gray-500 uppercase tracking-wider">Current Assignment</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {filtered.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="px-3 py-8 text-center text-xs text-gray-500">No approved orders found</td>
                      </tr>
                    ) : (
                      filtered.map((order) => (
                        <tr
                          key={order.id}
                          className={`hover:bg-gray-50 cursor-pointer ${selectedIds.has(order.id) ? 'bg-red-50' : ''}`}
                          onClick={() => toggleOrder(order.id)}
                        >
                          <td className="px-3 py-2" onClick={(e) => e.stopPropagation()}>
                            <input type="checkbox" checked={selectedIds.has(order.id)} onChange={() => toggleOrder(order.id)} />
                          </td>
                          <td className="px-3 py-2 whitespace-nowrap text-xs font-medium text-gray-900">{order.so_number}</td>
                          <td className="px-3 py-2 whitespace-nowrap text-xs text-gray-700">{order.customer_name || 'N/A'}</td>
                          <td className="px-3 py-2 whitespace-nowrap text-xs text-gray-700">{formatDate(order.order_date)}</td>
                          <td className="px-3 py-2 whitespace-nowrap text-xs text-gray-700 text-right">{formatCurrency(order.total_amount)}</td>
                          <td className="px-3 py-2 whitespace-nowrap text-[10px] text-gray-500">
                            {order.driver_name ? `${order.driver_name}${order.vehicle_registration_number ? ` — ${order.vehicle_registration_number}` : ''}` : 'Unassigned'}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Assignment panel */}
          <div className="bg-white border border-gray-200 rounded-md p-3 h-fit">
            <h2 className="text-xs font-bold text-gray-900 mb-3">Assign Selected Orders</h2>
            <div className="text-[10px] text-gray-500 mb-3">
              {selectedIds.size} order{selectedIds.size !== 1 ? 's' : ''} selected — {formatCurrency(selectedTotal)}
            </div>

            <div className="mb-3">
              <label className="block text-[9px] font-semibold text-gray-500 uppercase tracking-wider mb-1">Driver</label>
              <select
                value={selectedDriver}
                onChange={(e) => setSelectedDriver(e.target.value ? Number(e.target.value) : '')}
                className="w-full border border-gray-300 rounded px-2 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-red-500"
                disabled={drivers.length === 0}
              >
                <option value="">Choose a driver...</option>
                {drivers.map((d) => (
                  <option key={d.id} value={d.id}>{d.name}{d.contact ? ` - ${d.contact}` : ''}</option>
                ))}
              </select>
              {drivers.length === 0 && (
                <div className="text-[9px] text-red-500 mt-1">No drivers available. Add a driver first.</div>
              )}
            </div>

            <div className="mb-3">
              <label className="block text-[9px] font-semibold text-gray-500 uppercase tracking-wider mb-1">Vehicle</label>
              <select
                value={selectedVehicle}
                onChange={(e) => setSelectedVehicle(e.target.value ? Number(e.target.value) : '')}
                className="w-full border border-gray-300 rounded px-2 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-red-500"
                disabled={vehicles.length === 0}
              >
                <option value="">Choose a vehicle...</option>
                {vehicles.map((v) => (
                  <option key={v.id} value={v.id}>{v.registration_number} - {v.model}</option>
                ))}
              </select>
              {vehicles.length === 0 && (
                <div className="text-[9px] text-red-500 mt-1">No vehicles available. Add a vehicle first.</div>
              )}
            </div>

            <div className="mb-3">
              <label className="block text-[9px] font-semibold text-gray-500 uppercase tracking-wider mb-1">Notes (optional)</label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={3}
                className="w-full border border-gray-300 rounded px-2 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-red-500"
                placeholder="Route notes, delivery instructions..."
              />
            </div>

            {submitError && (
              <div className="mb-3 p-2 bg-red-50 border border-red-200 text-red-700 text-[10px] rounded">{submitError}</div>
            )}

            <button
              onClick={handleCreateLoadingSheet}
              disabled={submitting || selectedIds.size === 0}
              className="w-full px-3 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 text-xs font-semibold shadow-sm disabled:opacity-50"
            >
              {submitting ? 'Creating...' : 'Create Loading Sheet'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default LoadingSheetPage;
