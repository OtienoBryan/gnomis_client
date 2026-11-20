import React, { useCallback, useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import { Link } from 'react-router-dom';
import { ArrowLeft, CheckCircle2, Clock, Plus, Search, Trash2, Wallet, X, Banknote } from 'lucide-react';
import { salesService, SalesRep } from '../services/salesService';
import { API_CONFIG } from '../config/api';
import { useAuth } from '../contexts/AuthContext';
import { formatKES, toLocalISODate } from '../utils/salesRepPayroll';

const ADVANCES_URL = API_CONFIG.getUrl('/payroll/sales-rep-advances');
const PAGE_SIZE = 25;

interface Advance {
  id: number;
  sales_rep_id: number;
  sales_rep_name: string | null;
  reference: string;
  amount: number | string;
  recovered_amount: number | string;
  advance_date: string;
  status: string;
}

const STATUS_STYLES: Record<string, string> = {
  pending: 'bg-amber-50 text-amber-700 ring-amber-200',
  approved: 'bg-green-50 text-green-700 ring-green-200',
  rejected: 'bg-red-50 text-red-700 ring-red-200',
};

const getAuthHeaders = () => {
  const token = localStorage.getItem('token');
  return token ? { Authorization: `Bearer ${token}` } : {};
};

const input =
  'w-full px-3 py-2 text-sm border border-gray-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent';
const label = 'block text-xs font-medium text-gray-700 mb-1';

const initials = (name: string | null) =>
  (name || '?').split(/\s+/).filter(Boolean).slice(0, 2).map(p => p[0]?.toUpperCase()).join('') || '?';

const formatDate = (iso: string) => {
  const d = new Date(`${iso}T00:00:00`);
  return isNaN(d.getTime()) ? iso : d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
};

const balanceOf = (a: Advance) => Math.max(0, Number(a.amount || 0) - Number(a.recovered_amount || 0));

const StatCard: React.FC<{ title: string; value: string; hint?: string; icon: React.ReactNode; tone: string }> = ({
  title, value, hint, icon, tone,
}) => (
  <div className="bg-white border border-gray-200 rounded-xl p-4 flex items-center gap-3">
    <div className={`p-2.5 rounded-lg ${tone}`}>{icon}</div>
    <div className="min-w-0">
      <div className="text-xs text-gray-500">{title}</div>
      <div className="text-lg font-semibold text-gray-900 truncate">{value}</div>
      {hint && <div className="text-[11px] text-gray-400">{hint}</div>}
    </div>
  </div>
);

const SalesRepAdvancesPage: React.FC = () => {
  const { user } = useAuth();
  // Same roles the API allows: sales can approve/decline, but only finance-type roles can delete
  const canManage = ['admin', 'manager', 'accountant', 'executive', 'finance'].includes(user?.role || '');
  const canReview = canManage || user?.role === 'sales';
  const [reviewingId, setReviewingId] = useState<number | null>(null);

  const [reps, setReps] = useState<SalesRep[]>([]);
  const [advances, setAdvances] = useState<Advance[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [notice, setNotice] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // filters
  const [search, setSearch] = useState('');
  const [repFilter, setRepFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [page, setPage] = useState(1);

  // modal form
  const [showModal, setShowModal] = useState(false);
  const [salesRepId, setSalesRepId] = useState('');
  const [reference, setReference] = useState('');
  const [amount, setAmount] = useState('');
  const [date, setDate] = useState(() => toLocalISODate(new Date()));
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const loadAdvances = useCallback(async () => {
    const res = await axios.get(ADVANCES_URL, { headers: getAuthHeaders() });
    setAdvances(res.data?.success ? res.data.data || [] : []);
  }, []);

  useEffect(() => {
    Promise.all([salesService.getAllSalesReps(), loadAdvances()])
      .then(([r]) => setReps((r || []).slice().sort((a, b) => (a.name || '').localeCompare(b.name || ''))))
      .catch((err: any) => setLoadError(err.response?.data?.error || err.message || 'Failed to load data'))
      .finally(() => setLoading(false));
  }, [loadAdvances]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return advances.filter(a => {
      if (repFilter && String(a.sales_rep_id) !== repFilter) return false;
      if (statusFilter && a.status !== statusFilter) return false;
      if (fromDate && a.advance_date < fromDate) return false;
      if (toDate && a.advance_date > toDate) return false;
      if (q && !`${a.sales_rep_name || ''} ${a.reference}`.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [advances, search, repFilter, statusFilter, fromDate, toDate]);

  const stats = useMemo(() => {
    const approved = filtered.filter(a => a.status === 'approved');
    const pending = filtered.filter(a => a.status === 'pending');
    return {
      advanced: approved.reduce((s, a) => s + Number(a.amount || 0), 0),
      recovered: approved.reduce((s, a) => s + Number(a.recovered_amount || 0), 0),
      outstanding: approved.reduce((s, a) => s + balanceOf(a), 0),
      pending: pending.reduce((s, a) => s + Number(a.amount || 0), 0),
      pendingCount: pending.length,
    };
  }, [filtered]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const pageRows = filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);
  const hasFilters = !!(search || repFilter || statusFilter || fromDate || toDate);

  const clearFilters = () => {
    setSearch(''); setRepFilter(''); setStatusFilter(''); setFromDate(''); setToDate(''); setPage(1);
  };

  const openModal = () => {
    setSalesRepId('');
    setReference('');
    setAmount('');
    setDate(toLocalISODate(new Date()));
    setFormError(null);
    setNotice(null);
    setShowModal(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    if (!salesRepId) return setFormError('Select a sales rep');
    if (!reference.trim()) return setFormError('Enter a reference');
    if (!(Number(amount) > 0)) return setFormError('Enter an amount greater than zero');
    if (!date) return setFormError('Select a date');

    setSubmitting(true);
    try {
      await axios.post(
        ADVANCES_URL,
        { sales_rep_id: Number(salesRepId), reference: reference.trim(), amount: Number(amount), advance_date: date },
        { headers: getAuthHeaders() }
      );
      setShowModal(false);
      setNotice({ type: 'success', text: 'Salary advance posted and is pending approval.' });
      setPage(1);
      await loadAdvances();
    } catch (err: any) {
      setFormError(err.response?.data?.error || err.message || 'Failed to post salary advance');
    } finally {
      setSubmitting(false);
    }
  };

  const handleReview = async (a: Advance, status: 'approved' | 'rejected') => {
    const verb = status === 'approved' ? 'Approve' : 'Decline';
    const extra = status === 'approved' ? ' It will be recovered from the rep\'s next payroll.' : '';
    if (!window.confirm(`${verb} salary advance "${a.reference}" of ${formatKES(Number(a.amount))} for ${a.sales_rep_name || 'this rep'}?${extra}`)) return;
    setReviewingId(a.id);
    try {
      await axios.put(`${ADVANCES_URL}/${a.id}/status`, { status }, { headers: getAuthHeaders() });
      setAdvances(list => list.map(x => (x.id === a.id ? { ...x, status } : x)));
      setNotice({ type: 'success', text: `Salary advance ${status === 'approved' ? 'approved' : 'declined'}.` });
    } catch (err: any) {
      setNotice({ type: 'error', text: err.response?.data?.error || err.message || `Failed to ${verb.toLowerCase()} salary advance` });
      loadAdvances().catch(() => {});
    } finally {
      setReviewingId(null);
    }
  };

  const handleDelete = async (a: Advance) => {
    if (!window.confirm(`Delete salary advance "${a.reference}" for ${a.sales_rep_name || 'this rep'}?`)) return;
    try {
      await axios.delete(`${ADVANCES_URL}/${a.id}`, { headers: getAuthHeaders() });
      setAdvances(list => list.filter(x => x.id !== a.id));
      setNotice({ type: 'success', text: 'Salary advance deleted.' });
    } catch (err: any) {
      setNotice({ type: 'error', text: err.response?.data?.error || err.message || 'Failed to delete salary advance' });
    }
  };

  return (
    <div className="w-full min-h-screen bg-gray-50 py-6 px-4 sm:px-6">
      <Link to="/sales-rep-payroll" className="inline-flex items-center text-xs text-gray-500 hover:text-gray-800 mb-2">
        <ArrowLeft className="w-3.5 h-3.5 mr-1" /> Back to Sales Rep Payroll
      </Link>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between mb-5">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Salary Advances</h1>
          <p className="text-sm text-gray-500">Post advances given to sales reps. Approved advances are recovered from their payroll.</p>
        </div>
        <button
          type="button"
          onClick={openModal}
          className="inline-flex items-center justify-center gap-1.5 bg-red-600 text-white px-4 py-2 text-sm font-medium rounded-lg hover:bg-red-700"
        >
          <Plus className="h-4 w-4" /> Post Advance
        </button>
      </div>

      {loadError && <div className="mb-4 px-4 py-3 text-sm bg-red-50 text-red-700 rounded-lg border border-red-200">{loadError}</div>}
      {notice && (
        <div
          className={`mb-4 flex items-start justify-between gap-3 px-4 py-3 text-sm rounded-lg border ${
            notice.type === 'success' ? 'bg-green-50 text-green-800 border-green-200' : 'bg-red-50 text-red-800 border-red-200'
          }`}
        >
          <span>{notice.text}</span>
          <button onClick={() => setNotice(null)} aria-label="Dismiss"><X className="h-4 w-4" /></button>
        </div>
      )}

      {/* Summary */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-5">
        <StatCard title="Approved advances" value={formatKES(stats.advanced)} hint={hasFilters ? 'Filtered' : 'All time'} icon={<Banknote className="h-5 w-5" />} tone="bg-red-50 text-red-700" />
        <StatCard title="Outstanding balance" value={formatKES(stats.outstanding)} hint="Still to be recovered" icon={<Wallet className="h-5 w-5" />} tone="bg-blue-50 text-blue-700" />
        <StatCard title="Recovered" value={formatKES(stats.recovered)} hint="Deducted through payroll" icon={<CheckCircle2 className="h-5 w-5" />} tone="bg-emerald-50 text-emerald-700" />
        <StatCard title="Pending approval" value={formatKES(stats.pending)} hint={`${stats.pendingCount} awaiting approval`} icon={<Clock className="h-5 w-5" />} tone="bg-amber-50 text-amber-700" />
      </div>

      {/* Table card */}
      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
        <div className="flex flex-col gap-3 px-4 py-3 border-b border-gray-200 lg:flex-row lg:items-end">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input
              className={`${input} pl-9`}
              placeholder="Search sales rep or reference"
              value={search}
              onChange={e => { setSearch(e.target.value); setPage(1); }}
            />
          </div>
          <select className={`${input} lg:w-48`} value={repFilter} onChange={e => { setRepFilter(e.target.value); setPage(1); }}>
            <option value="">All sales reps</option>
            {reps.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
          </select>
          <select className={`${input} lg:w-40`} value={statusFilter} onChange={e => { setStatusFilter(e.target.value); setPage(1); }}>
            <option value="">All statuses</option>
            <option value="pending">Pending</option>
            <option value="approved">Approved</option>
            <option value="rejected">Rejected</option>
          </select>
          <input type="date" className={`${input} lg:w-40`} value={fromDate} onChange={e => { setFromDate(e.target.value); setPage(1); }} aria-label="From date" />
          <input type="date" className={`${input} lg:w-40`} value={toDate} onChange={e => { setToDate(e.target.value); setPage(1); }} aria-label="To date" />
          {hasFilters && (
            <button onClick={clearFilters} className="px-3 py-2 text-sm text-gray-600 hover:text-gray-900 whitespace-nowrap">Clear</button>
          )}
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full">
            <thead className="bg-gray-50 text-xs uppercase tracking-wide text-gray-500">
              <tr>
                <th className="px-4 py-3 text-left font-medium">Date</th>
                <th className="px-4 py-3 text-left font-medium">Sales Rep</th>
                <th className="px-4 py-3 text-left font-medium">Reference</th>
                <th className="px-4 py-3 text-right font-medium">Amount</th>
                <th className="px-4 py-3 text-right font-medium">Recovered</th>
                <th className="px-4 py-3 text-right font-medium">Balance</th>
                <th className="px-4 py-3 text-left font-medium">Status</th>
                <th className="px-4 py-3 text-right font-medium">{canReview ? 'Actions' : ''}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading ? (
                <tr><td colSpan={8} className="px-4 py-10 text-sm text-center text-gray-500">Loading salary advances...</td></tr>
              ) : pageRows.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-12 text-center">
                    <div className="text-sm font-medium text-gray-700">{hasFilters ? 'No salary advances match your filters' : 'No salary advances posted yet'}</div>
                    <div className="text-xs text-gray-500 mt-1">{hasFilters ? 'Try clearing the filters.' : 'Use "Post Advance" to add the first one.'}</div>
                  </td>
                </tr>
              ) : (
                pageRows.map(a => {
                  const balance = balanceOf(a);
                  const counts = a.status === 'approved';
                  return (
                    <tr key={a.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 text-sm text-gray-600 whitespace-nowrap">{formatDate(a.advance_date)}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2.5">
                          <div className="h-8 w-8 rounded-full bg-red-50 text-red-700 text-xs font-semibold flex items-center justify-center shrink-0">
                            {initials(a.sales_rep_name)}
                          </div>
                          <span className="text-sm font-medium text-gray-900">{a.sales_rep_name || `#${a.sales_rep_id}`}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-700">{a.reference}</td>
                      <td className="px-4 py-3 text-sm font-medium text-right text-gray-900 whitespace-nowrap">{formatKES(Number(a.amount))}</td>
                      <td className="px-4 py-3 text-sm text-right text-gray-600 whitespace-nowrap">{counts ? formatKES(Number(a.recovered_amount)) : '—'}</td>
                      <td className={`px-4 py-3 text-sm font-medium text-right whitespace-nowrap ${counts && balance > 0 ? 'text-red-600' : 'text-gray-400'}`}>
                        {counts ? formatKES(balance) : '—'}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex px-2.5 py-0.5 rounded-full text-xs font-medium capitalize ring-1 ring-inset ${STATUS_STYLES[a.status] || 'bg-gray-50 text-gray-700 ring-gray-200'}`}>
                          {a.status}
                        </span>
                        {counts && balance === 0 && <span className="ml-1.5 text-[11px] text-gray-400">fully recovered</span>}
                      </td>
                      <td className="px-4 py-3 text-right whitespace-nowrap">
                        {canReview && (
                          <div className="inline-flex items-center gap-1">
                            {a.status === 'pending' && (
                              <>
                                <button
                                  onClick={() => handleReview(a, 'approved')}
                                  disabled={reviewingId === a.id}
                                  className="px-2.5 py-1 text-xs font-medium text-green-700 bg-green-50 rounded-md hover:bg-green-100 disabled:opacity-50"
                                >
                                  Approve
                                </button>
                                <button
                                  onClick={() => handleReview(a, 'rejected')}
                                  disabled={reviewingId === a.id}
                                  className="px-2.5 py-1 text-xs font-medium text-red-700 bg-red-50 rounded-md hover:bg-red-100 disabled:opacity-50"
                                >
                                  Decline
                                </button>
                              </>
                            )}
                            {canManage && Number(a.recovered_amount) === 0 && (
                              <button onClick={() => handleDelete(a)} className="p-1.5 rounded text-gray-400 hover:text-red-600 hover:bg-red-50" title="Delete" aria-label="Delete salary advance">
                                <Trash2 className="w-4 h-4" />
                              </button>
                            )}
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {!loading && filtered.length > PAGE_SIZE && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-gray-200 text-sm text-gray-600">
            <span>Page {currentPage} of {totalPages} • {filtered.length} entries</span>
            <div className="flex gap-2">
              <button className="px-3 py-1 border border-gray-300 rounded-lg disabled:opacity-50" onClick={() => setPage(currentPage - 1)} disabled={currentPage === 1}>Prev</button>
              <button className="px-3 py-1 border border-gray-300 rounded-lg disabled:opacity-50" onClick={() => setPage(currentPage + 1)} disabled={currentPage === totalPages}>Next</button>
            </div>
          </div>
        )}
      </div>

      {/* Post advance modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => !submitting && setShowModal(false)}>
          <form onSubmit={handleSubmit} onClick={e => e.stopPropagation()} className="bg-white rounded-xl shadow-xl w-full max-w-md">
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200">
              <div>
                <h2 className="text-base font-semibold text-gray-900">Post Salary Advance</h2>
                <p className="text-xs text-gray-500">New advances start as pending until approved.</p>
              </div>
              <button type="button" onClick={() => setShowModal(false)} disabled={submitting} className="text-gray-400 hover:text-gray-700" aria-label="Close">
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="px-5 py-4 space-y-4">
              <div>
                <label className={label}>Sales Rep</label>
                <select className={input} value={salesRepId} onChange={e => setSalesRepId(e.target.value)} disabled={loading} autoFocus>
                  <option value="">Select sales rep</option>
                  {reps.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
                </select>
              </div>
              <div>
                <label className={label}>Reference</label>
                <input className={input} type="text" value={reference} maxLength={100} onChange={e => setReference(e.target.value)} placeholder="e.g. Salary advance - school fees" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={label}>Amount (KES)</label>
                  <input className={input} type="number" min="0" step="0.01" value={amount} onChange={e => setAmount(e.target.value)} placeholder="0.00" />
                </div>
                <div>
                  <label className={label}>Date</label>
                  <input className={input} type="date" value={date} onChange={e => setDate(e.target.value)} />
                </div>
              </div>
              <p className="text-xs text-gray-500">Once approved, the advance is deducted from the rep's pay when payroll is run, up to the pay available. Any balance carries over to the next run.</p>
              {formError && <div className="text-sm text-red-600">{formError}</div>}
            </div>

            <div className="flex justify-end gap-2 px-5 py-4 border-t border-gray-200 bg-gray-50 rounded-b-xl">
              <button type="button" onClick={() => setShowModal(false)} disabled={submitting} className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50">
                Cancel
              </button>
              <button type="submit" disabled={submitting} className="px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-lg hover:bg-red-700 disabled:opacity-50">
                {submitting ? 'Posting...' : 'Post Advance'}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};

export default SalesRepAdvancesPage;
