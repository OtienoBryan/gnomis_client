import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { storeService } from '../services/storeService';
import { Store } from '../types/financial';

interface ReceiptRow {
  id: number;
  reference: string;
  store_id: number;
  store_name?: string;
  received_by_name?: string;
  notes?: string | null;
  total_quantity: number | string;
  total_cost: number | string;
  item_count: number;
  created_at: string;
}

interface ReceiptItem {
  id: number;
  product_id: number;
  product_name?: string;
  product_code?: string;
  quantity: number | string;
  unit_cost: number | string;
  total_cost: number | string;
}

interface ReceiptDetails extends Omit<ReceiptRow, 'item_count'> {
  store_code?: string;
  items: ReceiptItem[];
}

const money = (n: number | string) =>
  Number(n || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const qty = (n: number | string) => Number(n || 0).toLocaleString(undefined, { maximumFractionDigits: 2 });
const dateTime = (d: string) => new Date(d).toLocaleString();

const inputClass =
  'border border-gray-200 rounded-lg px-2.5 py-1.5 text-xs bg-white focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-red-500';

const ReceivingHistoryPage: React.FC = () => {
  const [receipts, setReceipts] = useState<ReceiptRow[]>([]);
  const [stores, setStores] = useState<Store[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [search, setSearch] = useState('');
  const [storeFilter, setStoreFilter] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  const [selected, setSelected] = useState<ReceiptDetails | null>(null);
  const [detailsLoading, setDetailsLoading] = useState(false);
  const [detailsError, setDetailsError] = useState<string | null>(null);

  const fetchReceipts = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await storeService.getStockReceipts({
        store_id: storeFilter ? Number(storeFilter) : undefined,
        start_date: startDate || undefined,
        end_date: endDate || undefined,
      });
      if (res.success) setReceipts(res.data || []);
      else setError(res.error || 'Failed to load receiving history');
    } catch (err: any) {
      setError(err.response?.data?.error || err.message || 'Failed to load receiving history');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    storeService.getAllStores().then(res => res.success && setStores(res.data || [])).catch(() => {});
  }, []);

  useEffect(() => {
    fetchReceipts();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storeFilter, startDate, endDate]);

  const rows = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return receipts;
    return receipts.filter(r =>
      [r.reference, r.store_name, r.received_by_name].some(v => (v || '').toLowerCase().includes(q))
    );
  }, [receipts, search]);

  const totals = rows.reduce(
    (acc, r) => ({ qty: acc.qty + Number(r.total_quantity), cost: acc.cost + Number(r.total_cost) }),
    { qty: 0, cost: 0 }
  );

  const openReceipt = async (id: number) => {
    setSelected(null);
    setDetailsError(null);
    setDetailsLoading(true);
    try {
      const res = await storeService.getStockReceipt(id);
      if (res.success) setSelected(res.data);
      else setDetailsError(res.error || 'Failed to load receipt');
    } catch (err: any) {
      setDetailsError(err.response?.data?.error || err.message || 'Failed to load receipt');
    } finally {
      setDetailsLoading(false);
    }
  };

  const closeDetails = () => {
    setSelected(null);
    setDetailsError(null);
    setDetailsLoading(false);
  };

  const detailsOpen = detailsLoading || !!selected || !!detailsError;
  const th = 'px-4 py-2.5 text-[10px] font-semibold text-gray-500 uppercase tracking-wider whitespace-nowrap';

  return (
    <div className="min-h-screen bg-[#f3f5fd]">
      <div className="w-full py-5 px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-4 flex items-center justify-between gap-3 flex-wrap">
          <div>
            <h1 className="text-lg font-bold text-gray-900">Receiving History</h1>
            <p className="text-xs text-gray-500 mt-0.5">Products received into stores. Click a receipt to see its items.</p>
          </div>
          <div className="flex items-center gap-2">
            <Link to="/receive-products" className="px-3 py-1.5 rounded-lg shadow-sm text-xs font-medium text-white bg-red-600 hover:bg-red-700">
              Receive Products
            </Link>
            <button
              type="button"
              onClick={fetchReceipts}
              disabled={loading}
              className="px-3 py-1.5 border border-gray-200 rounded-lg shadow-sm text-xs font-medium text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50"
            >
              {loading ? 'Refreshing...' : 'Refresh'}
            </button>
          </div>
        </div>

        {error && <div className="bg-red-50 border border-red-200 rounded-xl p-3 text-red-700 text-xs mb-4">{error}</div>}

        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          {/* Filters */}
          <div className="px-4 py-3 border-b border-gray-100 flex flex-wrap items-end gap-3">
            <input
              className={`${inputClass} w-56`}
              placeholder="Search reference, store or user..."
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
            <select className={inputClass} value={storeFilter} onChange={e => setStoreFilter(e.target.value)}>
              <option value="">All stores</option>
              {stores.map(s => (
                <option key={s.id} value={s.id}>{s.store_name}</option>
              ))}
            </select>
            <div>
              <label className="block text-[10px] font-medium text-gray-500 mb-0.5">From</label>
              <input type="date" className={inputClass} value={startDate} onChange={e => setStartDate(e.target.value)} />
            </div>
            <div>
              <label className="block text-[10px] font-medium text-gray-500 mb-0.5">To</label>
              <input type="date" className={inputClass} value={endDate} onChange={e => setEndDate(e.target.value)} />
            </div>
          </div>

          {loading ? (
            <div className="p-12 text-center">
              <div className="animate-spin rounded-full h-9 w-9 border-b-2 border-red-600 mx-auto"></div>
              <p className="mt-3 text-sm text-gray-600">Loading receiving history...</p>
            </div>
          ) : rows.length === 0 ? (
            <div className="p-12 text-center text-sm text-gray-400">
              {receipts.length === 0 ? 'No receipts yet. Receipts appear here after products are received.' : 'No receipts match your filters.'}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-100">
                <thead className="bg-gray-50">
                  <tr>
                    <th className={`${th} text-left`}>Date</th>
                    <th className={`${th} text-left`}>Reference</th>
                    <th className={`${th} text-left`}>Store</th>
                    <th className={`${th} text-left`}>Received By</th>
                    <th className={`${th} text-right`}>Products</th>
                    <th className={`${th} text-right`}>Total Qty</th>
                    <th className={`${th} text-right`}>Total Cost</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {rows.map(r => (
                    <tr key={r.id} onClick={() => openReceipt(r.id)} className="cursor-pointer hover:bg-gray-50/70">
                      <td className="px-4 py-2.5 whitespace-nowrap text-xs text-gray-700">{dateTime(r.created_at)}</td>
                      <td className="px-4 py-2.5 whitespace-nowrap text-xs font-semibold text-gray-900">{r.reference}</td>
                      <td className="px-4 py-2.5 whitespace-nowrap text-xs text-gray-700">{r.store_name || '—'}</td>
                      <td className="px-4 py-2.5 whitespace-nowrap text-xs text-gray-700">{r.received_by_name || '—'}</td>
                      <td className="px-4 py-2.5 text-right text-xs text-gray-700">{r.item_count}</td>
                      <td className="px-4 py-2.5 text-right text-xs text-gray-900">{qty(r.total_quantity)}</td>
                      <td className="px-4 py-2.5 text-right text-xs font-semibold text-gray-900">{money(r.total_cost)}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot className="bg-gray-50">
                  <tr>
                    <td colSpan={5} className="px-4 py-2.5 text-[11px] font-semibold text-gray-600 text-right">
                      Totals ({rows.length} receipt{rows.length === 1 ? '' : 's'})
                    </td>
                    <td className="px-4 py-2.5 text-right text-xs font-bold text-gray-900">{qty(totals.qty)}</td>
                    <td className="px-4 py-2.5 text-right text-xs font-bold text-gray-900">{money(totals.cost)}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Receipt details */}
      {detailsOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center z-50 p-4" onClick={closeDetails}>
          <div
            className="bg-white rounded-2xl shadow-lg w-full max-w-2xl max-h-[90vh] flex flex-col"
            onClick={e => e.stopPropagation()}
          >
            <div className="px-5 py-4 border-b border-gray-100 flex items-start justify-between gap-3">
              <div>
                <h2 className="text-sm font-bold text-gray-900">Receipt {selected ? selected.reference : ''}</h2>
                {selected && <p className="text-xs text-gray-500 mt-0.5">{dateTime(selected.created_at)}</p>}
              </div>
              <button type="button" onClick={closeDetails} className="text-gray-400 hover:text-gray-600 text-xl leading-none" aria-label="Close">
                ×
              </button>
            </div>

            <div className="px-5 py-4 overflow-y-auto">
              {detailsLoading && (
                <div className="py-10 text-center">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-red-600 mx-auto"></div>
                </div>
              )}
              {detailsError && <div className="bg-red-50 border border-red-200 rounded-lg px-3 py-2 text-xs text-red-700">{detailsError}</div>}

              {selected && (
                <>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
                    {[
                      ['Store', selected.store_name || '—'],
                      ['Received by', selected.received_by_name || '—'],
                      ['Total qty', qty(selected.total_quantity)],
                      ['Total cost', money(selected.total_cost)],
                    ].map(([label, value]) => (
                      <div key={label}>
                        <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">{label}</p>
                        <p className="text-xs font-semibold text-gray-900">{value}</p>
                      </div>
                    ))}
                  </div>

                  {selected.notes && (
                    <p className="text-xs text-gray-600 bg-gray-50 border border-gray-100 rounded-lg px-3 py-2 mb-4">{selected.notes}</p>
                  )}

                  <div className="overflow-x-auto border border-gray-100 rounded-xl">
                    <table className="min-w-full divide-y divide-gray-100">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className={`${th} text-left`}>Product</th>
                          <th className={`${th} text-right`}>Qty</th>
                          <th className={`${th} text-right`}>Unit Cost</th>
                          <th className={`${th} text-right`}>Total</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {selected.items.map(i => (
                          <tr key={i.id}>
                            <td className="px-4 py-2 text-xs font-semibold text-gray-900">{i.product_name || `Product ${i.product_id}`}</td>
                            <td className="px-4 py-2 text-right text-xs text-gray-900">{qty(i.quantity)}</td>
                            <td className="px-4 py-2 text-right text-xs text-gray-700">{money(i.unit_cost)}</td>
                            <td className="px-4 py-2 text-right text-xs font-semibold text-gray-900">{money(i.total_cost)}</td>
                          </tr>
                        ))}
                      </tbody>
                      <tfoot className="bg-gray-50">
                        <tr>
                          <td className="px-4 py-2 text-[11px] font-semibold text-gray-600 text-right">Total</td>
                          <td className="px-4 py-2 text-right text-xs font-bold text-gray-900">{qty(selected.total_quantity)}</td>
                          <td></td>
                          <td className="px-4 py-2 text-right text-xs font-bold text-gray-900">{money(selected.total_cost)}</td>
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

export default ReceivingHistoryPage;
