import React, { useEffect, useMemo, useState } from 'react';
import axios from 'axios';

interface Expense {
  id: number;
  user_id: number;
  staff_name?: string;
  amount: number | string;
  reference: string;
  payment_method: string;
  description: string;
  status: string;
  created_at: string;
}

const STATUSES = ['Pending', 'Approved', 'Rejected'];

const STATUS_CLASS: Record<string, string> = {
  Pending: 'bg-amber-100 text-amber-700 border-amber-200',
  Approved: 'bg-emerald-100 text-emerald-700 border-emerald-200',
  Rejected: 'bg-red-100 text-red-700 border-red-200',
};

const toIso = (d: Date) => new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
const money = (n: number) => n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const inputClass =
  'border border-gray-200 rounded-lg px-2.5 py-1.5 text-xs bg-white focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-red-500';

const StaffExpensesPage: React.FC = () => {
  const today = new Date();
  const [startDate, setStartDate] = useState(toIso(new Date(today.getFullYear(), today.getMonth(), 1)));
  const [endDate, setEndDate] = useState(toIso(today));
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const [statusFilter, setStatusFilter] = useState('all');
  const [staffFilter, setStaffFilter] = useState('');
  const [search, setSearch] = useState('');
  const [savingId, setSavingId] = useState<number | null>(null);

  const fetchExpenses = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await axios.get('/api/financial/staff-expenses', {
        params: { start_date: startDate || undefined, end_date: endDate || undefined },
      });
      if (res.data?.success) setExpenses(res.data.data || []);
      else setError(res.data?.error || 'Failed to load staff expenses');
    } catch (err: any) {
      setError(err.response?.data?.error || err.message || 'Failed to load staff expenses');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchExpenses();
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
    const previous = expenses.find(e => e.id === id)?.status;
    setSavingId(id);
    setError(null);
    setMessage(null);
    setExpenses(prev => prev.map(e => (e.id === id ? { ...e, status } : e)));
    try {
      const res = await axios.patch(`/api/financial/staff-expenses/${id}/status`, { status });
      if (res.data?.success) setMessage(`Expense ${expenses.find(e => e.id === id)?.reference || `#${id}`} marked as ${status}.`);
      else throw new Error(res.data?.error || 'Failed to update status');
    } catch (err: any) {
      setExpenses(prev => prev.map(e => (e.id === id ? { ...e, status: previous || e.status } : e)));
      setError(err.response?.data?.error || err.message || 'Failed to update status');
    } finally {
      setSavingId(null);
    }
  };

  const staffOptions = useMemo(() => {
    const map = new Map<number, string>();
    expenses.forEach(e => map.set(e.user_id, e.staff_name || `User ${e.user_id}`));
    return Array.from(map, ([id, name]) => ({ id, name })).sort((a, b) => a.name.localeCompare(b.name));
  }, [expenses]);

  const rows = useMemo(() => {
    const q = search.trim().toLowerCase();
    return expenses.filter(e => {
      if (statusFilter !== 'all' && e.status !== statusFilter) return false;
      if (staffFilter && String(e.user_id) !== staffFilter) return false;
      if (!q) return true;
      return [e.staff_name, e.reference, e.description, e.payment_method].some(v => (v || '').toLowerCase().includes(q));
    });
  }, [expenses, statusFilter, staffFilter, search]);

  const sum = (list: Expense[]) => list.reduce((t, e) => t + (Number(e.amount) || 0), 0);
  const count = (s: string) => expenses.filter(e => e.status === s).length;
  const statusOptions = useMemo(() => {
    const extra = expenses.map(e => e.status).filter(s => !STATUSES.includes(s));
    return [...STATUSES, ...Array.from(new Set(extra))];
  }, [expenses]);

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
            <h1 className="text-lg font-bold text-gray-900">Staff Expenses</h1>
            <p className="text-xs text-gray-500 mt-0.5">Expenses submitted by staff. Change the status of an expense from the table.</p>
          </div>
          <button
            type="button"
            onClick={fetchExpenses}
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
          {stat('Total expenses', money(sum(expenses)), `${expenses.length} expense${expenses.length === 1 ? '' : 's'}`)}
          {stat('Pending', money(sum(expenses.filter(e => e.status === 'Pending'))), `${count('Pending')} awaiting review`, 'text-amber-600')}
          {stat('Approved', money(sum(expenses.filter(e => e.status === 'Approved'))), `${count('Approved')} approved`, 'text-emerald-600')}
          {stat('Rejected', money(sum(expenses.filter(e => e.status === 'Rejected'))), `${count('Rejected')} rejected`, 'text-red-600')}
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-100 flex flex-wrap items-center gap-3 justify-between">
            <div className="flex flex-wrap items-center gap-2">
              {chip('all', 'All', expenses.length)}
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
                placeholder="Search staff, reference or description..."
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
              {expenses.length === 0 ? 'No staff expenses in this period.' : 'No expenses match your filters.'}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-100">
                <thead className="bg-gray-50">
                  <tr>
                    <th className={`${th} text-left`}>Date</th>
                    <th className={`${th} text-left`}>Staff</th>
                    <th className={`${th} text-left`}>Reference</th>
                    <th className={`${th} text-left`}>Description</th>
                    <th className={`${th} text-left`}>Method</th>
                    <th className={`${th} text-right`}>Amount</th>
                    <th className={`${th} text-left`}>Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {rows.map(e => (
                    <tr key={e.id} className="hover:bg-gray-50/70">
                      <td className="px-4 py-2.5 whitespace-nowrap text-xs text-gray-700">{new Date(e.created_at).toLocaleString()}</td>
                      <td className="px-4 py-2.5 whitespace-nowrap text-xs font-semibold text-gray-900">{e.staff_name || `User ${e.user_id}`}</td>
                      <td className="px-4 py-2.5 whitespace-nowrap text-xs text-gray-700">{e.reference}</td>
                      <td className="px-4 py-2.5 text-xs text-gray-600 max-w-[280px] truncate" title={e.description}>{e.description}</td>
                      <td className="px-4 py-2.5 whitespace-nowrap text-xs text-gray-700">{e.payment_method}</td>
                      <td className="px-4 py-2.5 text-right text-xs font-semibold text-gray-900">{money(Number(e.amount) || 0)}</td>
                      <td className="px-4 py-2.5 whitespace-nowrap">
                        <select
                          value={e.status}
                          disabled={savingId === e.id}
                          onChange={ev => updateStatus(e.id, ev.target.value)}
                          className={`text-[11px] font-semibold rounded-full border px-2.5 py-1 focus:outline-none focus:ring-2 focus:ring-red-500 disabled:opacity-60 ${
                            STATUS_CLASS[e.status] || 'bg-gray-100 text-gray-700 border-gray-200'
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
                    <td colSpan={5} className="px-4 py-2.5 text-[11px] font-semibold text-gray-600 text-right">
                      Total{rows.length !== expenses.length ? ' (filtered)' : ''}
                    </td>
                    <td className="px-4 py-2.5 text-right text-xs font-bold text-gray-900">{money(sum(rows))}</td>
                    <td></td>
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default StaffExpensesPage;
