import React, { useEffect, useMemo, useState } from 'react';
import axios from 'axios';

interface Collection {
  id: number;
  client_id: number;
  client_name?: string;
  user_id: number;
  staff_name?: string;
  amount: number | string;
  payment_method: string;
  comment?: string | null;
  receipt_image_url?: string | null;
  status: string;
  recorded_at: string;
}

const STATUSES = ['Pending', 'Confirmed', 'Rejected'];

const STATUS_CLASS: Record<string, string> = {
  Pending: 'bg-amber-100 text-amber-700 border-amber-200',
  Confirmed: 'bg-emerald-100 text-emerald-700 border-emerald-200',
  Rejected: 'bg-red-100 text-red-700 border-red-200',
};

const toIso = (d: Date) => new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
const money = (n: number) => n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const inputClass =
  'border border-gray-200 rounded-lg px-2.5 py-1.5 text-xs bg-white focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-red-500';

const PaymentCollectionsPage: React.FC = () => {
  const today = new Date();
  const [startDate, setStartDate] = useState(toIso(new Date(today.getFullYear(), today.getMonth(), 1)));
  const [endDate, setEndDate] = useState(toIso(today));
  const [collections, setCollections] = useState<Collection[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const [statusFilter, setStatusFilter] = useState('all');
  const [staffFilter, setStaffFilter] = useState('');
  const [search, setSearch] = useState('');
  const [savingId, setSavingId] = useState<number | null>(null);
  const [receiptUrl, setReceiptUrl] = useState<string | null>(null);

  const fetchCollections = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await axios.get('/api/financial/payment-collections', {
        params: { start_date: startDate || undefined, end_date: endDate || undefined },
      });
      if (res.data?.success) setCollections(res.data.data || []);
      else setError(res.data?.error || 'Failed to load payment collections');
    } catch (err: any) {
      setError(err.response?.data?.error || err.message || 'Failed to load payment collections');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCollections();
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

  const updateStatus = async (id: number, status: string) => {
    const previous = collections.find(c => c.id === id)?.status;
    setSavingId(id);
    setError(null);
    setMessage(null);
    setCollections(prev => prev.map(c => (c.id === id ? { ...c, status } : c)));
    try {
      const res = await axios.patch(`/api/financial/payment-collections/${id}/status`, { status });
      if (res.data?.success) setMessage(`Collection #${id} marked as ${status}.`);
      else throw new Error(res.data?.error || 'Failed to update status');
    } catch (err: any) {
      // put the old status back
      setCollections(prev => prev.map(c => (c.id === id ? { ...c, status: previous || c.status } : c)));
      setError(err.response?.data?.error || err.message || 'Failed to update status');
    } finally {
      setSavingId(null);
    }
  };

  const staffOptions = useMemo(() => {
    const map = new Map<number, string>();
    collections.forEach(c => map.set(c.user_id, c.staff_name || `User ${c.user_id}`));
    return Array.from(map, ([id, name]) => ({ id, name })).sort((a, b) => a.name.localeCompare(b.name));
  }, [collections]);

  const rows = useMemo(() => {
    const q = search.trim().toLowerCase();
    return collections.filter(c => {
      if (statusFilter !== 'all' && c.status !== statusFilter) return false;
      if (staffFilter && String(c.user_id) !== staffFilter) return false;
      if (!q) return true;
      return [c.staff_name, c.client_name, c.comment, c.payment_method].some(v => (v || '').toLowerCase().includes(q));
    });
  }, [collections, statusFilter, staffFilter, search]);

  const sum = (list: Collection[]) => list.reduce((t, c) => t + (Number(c.amount) || 0), 0);
  const count = (s: string) => collections.filter(c => c.status === s).length;
  const statusOptions = useMemo(() => {
    const extra = collections.map(c => c.status).filter(s => !STATUSES.includes(s));
    return [...STATUSES, ...Array.from(new Set(extra))];
  }, [collections]);

  const th = 'px-4 py-2.5 text-[10px] font-semibold text-gray-500 uppercase tracking-wider whitespace-nowrap';

  const chip = (value: string, label: string, n: number) => (
    <button
      key={value}
      type="button"
      onClick={() => setStatusFilter(value)}
      className={`px-3 py-1 rounded-full text-xs font-medium border transition-colors ${
        statusFilter === value ? 'bg-red-600 text-white border-red-600' : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'
      }`}
    >
      {label}
      <span className={`ml-1.5 ${statusFilter === value ? 'text-red-100' : 'text-gray-400'}`}>{n}</span>
    </button>
  );

  const stat = (label: string, value: string, hint: string, valueClass = 'text-gray-900') => (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 min-w-0">
      <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">{label}</p>
      <p className={`text-lg font-bold truncate ${valueClass}`}>{value}</p>
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
            <h1 className="text-lg font-bold text-gray-900">Payment Collections</h1>
            <p className="text-xs text-gray-500 mt-0.5">Payments collected from clients by staff. Change the status of a collection from the table.</p>
          </div>
          <button
            type="button"
            onClick={fetchCollections}
            disabled={loading}
            className="px-3 py-1.5 border border-gray-200 rounded-lg shadow-sm text-xs font-medium text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50"
          >
            {loading ? 'Refreshing...' : 'Refresh'}
          </button>
        </div>

        {message && <div className="mb-4 bg-green-50 border border-green-200 rounded-xl px-3 py-2 text-xs text-green-700">{message}</div>}
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
          {stat('Total collected', money(sum(collections)), `${collections.length} collection${collections.length === 1 ? '' : 's'}`)}
          {stat('Pending', money(sum(collections.filter(c => c.status === 'Pending'))), `${count('Pending')} awaiting review`, 'text-amber-600')}
          {stat('Confirmed', money(sum(collections.filter(c => c.status === 'Confirmed'))), `${count('Confirmed')} confirmed`, 'text-emerald-600')}
          {stat('Rejected', money(sum(collections.filter(c => c.status === 'Rejected'))), `${count('Rejected')} rejected`, 'text-red-600')}
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-100 flex flex-wrap items-center gap-3 justify-between">
            <div className="flex flex-wrap items-center gap-2">
              {chip('all', 'All', collections.length)}
              {statusOptions.map(s => chip(s, s, count(s)))}
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <select className={`${inputClass} w-48`} value={staffFilter} onChange={e => setStaffFilter(e.target.value)}>
                <option value="">All staff</option>
                {staffOptions.map(s => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
              <input
                className={`${inputClass} w-56`}
                placeholder="Search staff, client or comment..."
                value={search}
                onChange={e => setSearch(e.target.value)}
              />
            </div>
          </div>

          {loading ? (
            <div className="p-12 text-center">
              <div className="animate-spin rounded-full h-9 w-9 border-b-2 border-red-600 mx-auto"></div>
            </div>
          ) : rows.length === 0 ? (
            <div className="p-12 text-center text-sm text-gray-400">
              {collections.length === 0 ? 'No payment collections in this period.' : 'No collections match your filters.'}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-100">
                <thead className="bg-gray-50">
                  <tr>
                    <th className={`${th} text-left`}>Date</th>
                    <th className={`${th} text-left`}>Staff</th>
                    <th className={`${th} text-left`}>Client</th>
                    <th className={`${th} text-right`}>Amount</th>
                    <th className={`${th} text-left`}>Method</th>
                    <th className={`${th} text-left`}>Comment</th>
                    <th className={`${th} text-left`}>Receipt</th>
                    <th className={`${th} text-left`}>Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {rows.map(c => (
                    <tr key={c.id} className="hover:bg-gray-50/70">
                      <td className="px-4 py-2.5 whitespace-nowrap text-xs text-gray-700">{new Date(c.recorded_at).toLocaleString()}</td>
                      <td className="px-4 py-2.5 whitespace-nowrap text-xs font-semibold text-gray-900">{c.staff_name || `User ${c.user_id}`}</td>
                      <td className="px-4 py-2.5 whitespace-nowrap text-xs text-gray-700">{c.client_name || `Client ${c.client_id}`}</td>
                      <td className="px-4 py-2.5 text-right text-xs font-semibold text-gray-900">{money(Number(c.amount) || 0)}</td>
                      <td className="px-4 py-2.5 whitespace-nowrap text-xs text-gray-700">{c.payment_method}</td>
                      <td className="px-4 py-2.5 text-xs text-gray-600 max-w-[220px] truncate" title={c.comment || ''}>{c.comment || '—'}</td>
                      <td className="px-4 py-2.5 whitespace-nowrap">
                        {c.receipt_image_url ? (
                          <button
                            type="button"
                            onClick={() => setReceiptUrl(c.receipt_image_url!)}
                            className="px-2.5 py-1 rounded-md text-[11px] font-medium text-white bg-blue-600 hover:bg-blue-700 shadow-sm"
                          >
                            View
                          </button>
                        ) : (
                          <span className="text-xs text-gray-300">—</span>
                        )}
                      </td>
                      <td className="px-4 py-2.5 whitespace-nowrap">
                        <select
                          value={c.status}
                          disabled={savingId === c.id}
                          onChange={e => updateStatus(c.id, e.target.value)}
                          className={`text-[11px] font-semibold rounded-full border px-2.5 py-1 focus:outline-none focus:ring-2 focus:ring-red-500 disabled:opacity-60 ${
                            STATUS_CLASS[c.status] || 'bg-gray-100 text-gray-700 border-gray-200'
                          }`}
                        >
                          {statusOptions.map(s => (
                            <option key={s} value={s} disabled={!STATUSES.includes(s)}>{s}</option>
                          ))}
                        </select>
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot className="bg-gray-50">
                  <tr>
                    <td colSpan={3} className="px-4 py-2.5 text-[11px] font-semibold text-gray-600 text-right">
                      Total{rows.length !== collections.length ? ' (filtered)' : ''}
                    </td>
                    <td className="px-4 py-2.5 text-right text-xs font-bold text-gray-900">{money(sum(rows))}</td>
                    <td colSpan={4}></td>
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </div>
      </div>

      {receiptUrl && (
        <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50 p-4" onClick={() => setReceiptUrl(null)}>
          <div className="bg-white rounded-2xl shadow-lg max-w-2xl w-full max-h-[90vh] flex flex-col" onClick={e => e.stopPropagation()}>
            <div className="px-5 py-3 border-b border-gray-100 flex items-center justify-between">
              <h2 className="text-sm font-bold text-gray-900">Receipt</h2>
              <button type="button" onClick={() => setReceiptUrl(null)} className="text-gray-400 hover:text-gray-600 text-xl leading-none" aria-label="Close">
                ×
              </button>
            </div>
            <div className="p-4 overflow-auto flex justify-center">
              <img src={receiptUrl} alt="Receipt" className="max-w-full max-h-[70vh] object-contain rounded-lg" />
            </div>
            <div className="px-5 py-3 border-t border-gray-100 flex justify-end gap-2">
              <a
                href={receiptUrl}
                target="_blank"
                rel="noreferrer"
                className="px-3 py-1.5 rounded-md text-xs font-medium bg-gray-100 text-gray-700 hover:bg-gray-200"
              >
                Open in new tab
              </a>
              <button
                type="button"
                onClick={() => setReceiptUrl(null)}
                className="px-3 py-1.5 rounded-md text-xs font-medium text-white bg-red-600 hover:bg-red-700"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default PaymentCollectionsPage;
