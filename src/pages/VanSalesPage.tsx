import React, { useEffect, useMemo, useState } from 'react';
import axios from 'axios';

interface VanSale {
  id: number;
  store_id: number;
  store_name?: string;
  staff_id: number;
  staff_name?: string;
  payment_method: string;
  payment_reference?: string | null;
  comment?: string | null;
  total_amount: number | string;
  created_at: string;
  item_count: number;
  total_quantity: number | string;
}

interface VanSaleItem {
  id: number;
  product_id: number;
  product_name?: string;
  quantity: number | string;
  unit_price: number | string;
  total_price: number | string;
}

interface VanSaleDetails extends Omit<VanSale, 'item_count' | 'total_quantity'> {
  store_code?: string;
  items: VanSaleItem[];
}

const toIso = (d: Date) => new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
const money = (n: number | string) =>
  Number(n || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const qty = (n: number | string) => Number(n || 0).toLocaleString(undefined, { maximumFractionDigits: 2 });

const inputClass =
  'border border-gray-200 rounded-lg px-2.5 py-1.5 text-xs bg-white focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-red-500';

const VanSalesPage: React.FC = () => {
  const today = new Date();
  const [startDate, setStartDate] = useState(toIso(new Date(today.getFullYear(), today.getMonth(), 1)));
  const [endDate, setEndDate] = useState(toIso(today));
  const [sales, setSales] = useState<VanSale[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [vanFilter, setVanFilter] = useState('');
  const [staffFilter, setStaffFilter] = useState('');
  const [methodFilter, setMethodFilter] = useState('');
  const [search, setSearch] = useState('');

  const [selected, setSelected] = useState<VanSaleDetails | null>(null);
  const [detailsLoading, setDetailsLoading] = useState(false);
  const [detailsError, setDetailsError] = useState<string | null>(null);

  const fetchSales = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await axios.get('/api/financial/van-sales', {
        params: { start_date: startDate || undefined, end_date: endDate || undefined },
      });
      if (res.data?.success) setSales(res.data.data || []);
      else setError(res.data?.error || 'Failed to load van sales');
    } catch (err: any) {
      setError(err.response?.data?.error || err.message || 'Failed to load van sales');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSales();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [startDate, endDate]);

  const setPreset = (preset: 'today' | 'week' | 'month' | 'last30' | 'all') => {
    const now = new Date();
    if (preset === 'all') {
      setStartDate('');
      setEndDate('');
    } else if (preset === 'today') {
      setStartDate(toIso(now));
      setEndDate(toIso(now));
    } else if (preset === 'week') {
      const monday = new Date(now);
      monday.setDate(now.getDate() - ((now.getDay() + 6) % 7));
      setStartDate(toIso(monday));
      setEndDate(toIso(now));
    } else if (preset === 'month') {
      setStartDate(toIso(new Date(now.getFullYear(), now.getMonth(), 1)));
      setEndDate(toIso(now));
    } else {
      const from = new Date(now);
      from.setDate(now.getDate() - 29);
      setStartDate(toIso(from));
      setEndDate(toIso(now));
    }
  };

  const openSale = async (id: number) => {
    setSelected(null);
    setDetailsError(null);
    setDetailsLoading(true);
    try {
      const res = await axios.get(`/api/financial/van-sales/${id}`);
      if (res.data?.success) setSelected(res.data.data);
      else setDetailsError(res.data?.error || 'Failed to load sale');
    } catch (err: any) {
      setDetailsError(err.response?.data?.error || err.message || 'Failed to load sale');
    } finally {
      setDetailsLoading(false);
    }
  };

  const closeDetails = () => {
    setSelected(null);
    setDetailsError(null);
    setDetailsLoading(false);
  };

  const vanOptions = useMemo(() => {
    const map = new Map<number, string>();
    sales.forEach(s => map.set(s.store_id, s.store_name || `Store ${s.store_id}`));
    return Array.from(map, ([id, name]) => ({ id, name })).sort((a, b) => a.name.localeCompare(b.name));
  }, [sales]);

  const staffOptions = useMemo(() => {
    const map = new Map<number, string>();
    sales.forEach(s => map.set(s.staff_id, s.staff_name || `User ${s.staff_id}`));
    return Array.from(map, ([id, name]) => ({ id, name })).sort((a, b) => a.name.localeCompare(b.name));
  }, [sales]);

  const methodOptions = useMemo(() => Array.from(new Set(sales.map(s => s.payment_method))).sort(), [sales]);

  const rows = useMemo(() => {
    const q = search.trim().toLowerCase();
    return sales.filter(s => {
      if (vanFilter && String(s.store_id) !== vanFilter) return false;
      if (staffFilter && String(s.staff_id) !== staffFilter) return false;
      if (methodFilter && s.payment_method !== methodFilter) return false;
      if (!q) return true;
      return [s.store_name, s.staff_name, s.payment_reference, s.comment, `#${s.id}`].some(v => (v || '').toLowerCase().includes(q));
    });
  }, [sales, vanFilter, staffFilter, methodFilter, search]);

  const totalAmount = rows.reduce((t, s) => t + (Number(s.total_amount) || 0), 0);
  const totalQuantity = rows.reduce((t, s) => t + (Number(s.total_quantity) || 0), 0);

  const byMethod = useMemo(() => {
    const map = new Map<string, number>();
    rows.forEach(s => map.set(s.payment_method, (map.get(s.payment_method) || 0) + (Number(s.total_amount) || 0)));
    return Array.from(map, ([method, total]) => ({ method, total })).sort((a, b) => b.total - a.total);
  }, [rows]);

  const th = 'px-4 py-2.5 text-[10px] font-semibold text-gray-500 uppercase tracking-wider whitespace-nowrap';
  const detailsOpen = detailsLoading || !!selected || !!detailsError;

  const stat = (label: string, value: string, hint: string) => (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 min-w-0">
      <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">{label}</p>
      <p className="text-lg font-bold text-gray-900 truncate">{value}</p>
      <p className="text-[10px] text-gray-400">{hint}</p>
    </div>
  );

  const presetBtn = (label: string, value: Parameters<typeof setPreset>[0]) => (
    <button
      type="button"
      onClick={() => setPreset(value)}
      className="px-2.5 py-1 rounded-full text-[11px] font-medium border border-gray-200 bg-white text-gray-600 hover:bg-gray-50"
    >
      {label}
    </button>
  );

  return (
    <div className="min-h-screen bg-[#f3f5fd]">
      <div className="w-full py-5 px-4 sm:px-6 lg:px-8">
        <div className="mb-4 flex items-center justify-between gap-3 flex-wrap">
          <div>
            <h1 className="text-lg font-bold text-gray-900">Van Sales</h1>
            <p className="text-xs text-gray-500 mt-0.5">Sales made from the sales vans. Click a sale to see what was sold.</p>
          </div>
          <button
            type="button"
            onClick={fetchSales}
            disabled={loading}
            className="px-3 py-1.5 border border-gray-200 rounded-lg shadow-sm text-xs font-medium text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50"
          >
            {loading ? 'Refreshing...' : 'Refresh'}
          </button>
        </div>

        {error && <div className="mb-4 bg-red-50 border border-red-200 rounded-xl p-3 text-red-700 text-xs">{error}</div>}

        {/* Date filter */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 px-4 py-3 mb-4 flex flex-wrap items-end gap-3">
          <div>
            <label className="block text-[10px] font-medium text-gray-500 mb-0.5">From</label>
            <input type="date" className={inputClass} value={startDate} max={endDate || undefined} onChange={e => setStartDate(e.target.value)} />
          </div>
          <div>
            <label className="block text-[10px] font-medium text-gray-500 mb-0.5">To</label>
            <input type="date" className={inputClass} value={endDate} min={startDate || undefined} onChange={e => setEndDate(e.target.value)} />
          </div>
          <div className="flex flex-wrap items-center gap-1.5 pb-0.5">
            {presetBtn('Today', 'today')}
            {presetBtn('This week', 'week')}
            {presetBtn('This month', 'month')}
            {presetBtn('Last 30 days', 'last30')}
            {presetBtn('All time', 'all')}
          </div>
        </div>

        {/* Summary */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
          {stat('Total sales', money(totalAmount), 'Amount sold')}
          {stat('Number of sales', String(rows.length), 'Van sales recorded')}
          {stat('Items sold', qty(totalQuantity), 'Units across all sales')}
          {stat(
            'Top payment method',
            byMethod[0]?.method || '—',
            byMethod.length ? byMethod.map(m => `${m.method} ${money(m.total)}`).join(' · ') : 'No sales'
          )}
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-100 flex flex-wrap items-center gap-2 justify-end">
            <select className={`${inputClass} w-44`} value={vanFilter} onChange={e => setVanFilter(e.target.value)}>
              <option value="">All vans</option>
              {vanOptions.map(v => (
                <option key={v.id} value={v.id}>{v.name}</option>
              ))}
            </select>
            <select className={`${inputClass} w-44`} value={staffFilter} onChange={e => setStaffFilter(e.target.value)}>
              <option value="">All staff</option>
              {staffOptions.map(s => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
            <select className={`${inputClass} w-40`} value={methodFilter} onChange={e => setMethodFilter(e.target.value)}>
              <option value="">All payment methods</option>
              {methodOptions.map(m => (
                <option key={m} value={m}>{m}</option>
              ))}
            </select>
            <input
              className={`${inputClass} w-56`}
              placeholder="Search van, staff, reference..."
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>

          {loading ? (
            <div className="p-12 text-center">
              <div className="animate-spin rounded-full h-9 w-9 border-b-2 border-red-600 mx-auto"></div>
            </div>
          ) : rows.length === 0 ? (
            <div className="p-12 text-center text-sm text-gray-400">
              {sales.length === 0 ? 'No van sales in this period.' : 'No van sales match your filters.'}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-100">
                <thead className="bg-gray-50">
                  <tr>
                    <th className={`${th} text-left`}>Sale</th>
                    <th className={`${th} text-left`}>Date</th>
                    <th className={`${th} text-left`}>Van</th>
                    <th className={`${th} text-left`}>Staff</th>
                    <th className={`${th} text-left`}>Payment</th>
                    <th className={`${th} text-left`}>Reference</th>
                    <th className={`${th} text-right`}>Items</th>
                    <th className={`${th} text-right`}>Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {rows.map(s => (
                    <tr key={s.id} onClick={() => openSale(s.id)} className="cursor-pointer hover:bg-gray-50/70">
                      <td className="px-4 py-2.5 whitespace-nowrap text-xs font-semibold text-gray-900">#{s.id}</td>
                      <td className="px-4 py-2.5 whitespace-nowrap text-xs text-gray-700">{new Date(s.created_at).toLocaleString()}</td>
                      <td className="px-4 py-2.5 whitespace-nowrap text-xs text-gray-700">{s.store_name || `Store ${s.store_id}`}</td>
                      <td className="px-4 py-2.5 whitespace-nowrap text-xs text-gray-700">{s.staff_name || `User ${s.staff_id}`}</td>
                      <td className="px-4 py-2.5 whitespace-nowrap text-xs text-gray-700">{s.payment_method}</td>
                      <td className="px-4 py-2.5 whitespace-nowrap text-xs text-gray-600">{s.payment_reference || '—'}</td>
                      <td className="px-4 py-2.5 text-right text-xs text-gray-700">{qty(s.total_quantity)}</td>
                      <td className="px-4 py-2.5 text-right text-xs font-semibold text-gray-900">{money(s.total_amount)}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot className="bg-gray-50">
                  <tr>
                    <td colSpan={6} className="px-4 py-2.5 text-[11px] font-semibold text-gray-600 text-right">
                      Total{rows.length !== sales.length ? ' (filtered)' : ''}
                    </td>
                    <td className="px-4 py-2.5 text-right text-xs font-bold text-gray-900">{qty(totalQuantity)}</td>
                    <td className="px-4 py-2.5 text-right text-xs font-bold text-gray-900">{money(totalAmount)}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </div>
      </div>

      {detailsOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center z-50 p-4" onClick={closeDetails}>
          <div className="bg-white rounded-2xl shadow-lg w-full max-w-2xl max-h-[90vh] flex flex-col" onClick={e => e.stopPropagation()}>
            <div className="px-5 py-4 border-b border-gray-100 flex items-start justify-between gap-3">
              <div>
                <h2 className="text-sm font-bold text-gray-900">Van sale {selected ? `#${selected.id}` : ''}</h2>
                {selected && <p className="text-xs text-gray-500 mt-0.5">{new Date(selected.created_at).toLocaleString()}</p>}
              </div>
              <button type="button" onClick={closeDetails} className="text-gray-400 hover:text-gray-600 text-xl leading-none" aria-label="Close">
                ×
              </button>
            </div>

            <div className="px-5 py-4 overflow-y-auto space-y-4">
              {detailsLoading && (
                <div className="py-10 text-center">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-red-600 mx-auto"></div>
                </div>
              )}
              {detailsError && <div className="bg-red-50 border border-red-200 rounded-lg px-3 py-2 text-xs text-red-700">{detailsError}</div>}

              {selected && (
                <>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    {[
                      ['Van', selected.store_name || '—'],
                      ['Staff', selected.staff_name || '—'],
                      ['Payment', selected.payment_method],
                      ['Reference', selected.payment_reference || '—'],
                    ].map(([label, value]) => (
                      <div key={label} className="min-w-0">
                        <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">{label}</p>
                        <p className="text-xs font-semibold text-gray-900 truncate">{value}</p>
                      </div>
                    ))}
                  </div>

                  {selected.comment && (
                    <p className="text-xs text-gray-600 bg-gray-50 border border-gray-100 rounded-lg px-3 py-2">{selected.comment}</p>
                  )}

                  <div className="border border-gray-100 rounded-xl overflow-hidden">
                    <table className="min-w-full divide-y divide-gray-100">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className={`${th} text-left`}>Product</th>
                          <th className={`${th} text-right`}>Qty</th>
                          <th className={`${th} text-right`}>Unit price</th>
                          <th className={`${th} text-right`}>Total</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {selected.items.map(i => (
                          <tr key={i.id}>
                            <td className="px-4 py-2 text-xs font-semibold text-gray-900">{i.product_name || `Product ${i.product_id}`}</td>
                            <td className="px-4 py-2 text-right text-xs text-gray-900">{qty(i.quantity)}</td>
                            <td className="px-4 py-2 text-right text-xs text-gray-700">{money(i.unit_price)}</td>
                            <td className="px-4 py-2 text-right text-xs font-semibold text-gray-900">{money(i.total_price)}</td>
                          </tr>
                        ))}
                      </tbody>
                      <tfoot className="bg-gray-50">
                        <tr>
                          <td colSpan={3} className="px-4 py-2 text-[11px] font-semibold text-gray-600 text-right">Total</td>
                          <td className="px-4 py-2 text-right text-xs font-bold text-gray-900">{money(selected.total_amount)}</td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                </>
              )}
            </div>

            <div className="px-5 py-3 border-t border-gray-100 flex justify-end">
              <button type="button" onClick={closeDetails} className="px-3 py-1.5 rounded-md text-xs font-medium bg-gray-100 text-gray-700 hover:bg-gray-200">
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default VanSalesPage;
