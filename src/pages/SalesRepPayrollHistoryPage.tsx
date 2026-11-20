import React, { useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowLeft, History, Search } from 'lucide-react';
import { API_CONFIG } from '../config/api';
import { formatKES } from '../utils/salesRepPayroll';

const PAYROLL_API_BASE = API_CONFIG.getUrl('/payroll');
const PAGE_SIZE = 25;

interface PayrollHistoryEntry {
  id: number;
  sales_rep_id: number;
  sales_rep_name: string;
  pay_date: string;
  period_start: string;
  period_end: string;
  basic_salary: number;
  working_days: number;
  days_paid: number;
  gross_pay: number;
  total_deductions: number; // includes extra_deductions
  extra_deductions: number;
  advance_recovery: number;
  net_pay: number;
  journal_entry_id: number | null;
}

const getAuthHeaders = () => {
  const token = localStorage.getItem('token');
  return token ? { Authorization: `Bearer ${token}` } : {};
};

const input =
  'px-2.5 py-1.5 text-xs border border-gray-300 rounded bg-white focus:outline-none focus:ring-1 focus:ring-red-500';
const th = 'px-3 py-2 text-[9px] font-semibold text-gray-500 uppercase tracking-wider';

// total_deductions also contains the extra deductions and advance recovery, so split them out to avoid double counting
const regularDeductions = (h: PayrollHistoryEntry) =>
  Number(h.total_deductions || 0) - Number(h.extra_deductions || 0) - Number(h.advance_recovery || 0);

const fmtDate = (d: string) => {
  const date = new Date(d);
  return isNaN(date.getTime()) ? d : date.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
};

const SalesRepPayrollHistoryPage: React.FC = () => {
  const navigate = useNavigate();
  const [rows, setRows] = useState<PayrollHistoryEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [search, setSearch] = useState('');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [page, setPage] = useState(1);

  useEffect(() => {
    axios
      .get(`${PAYROLL_API_BASE}/sales-reps-history`, { headers: getAuthHeaders() })
      .then(res => setRows(res.data?.success ? res.data.data || [] : []))
      .catch((err: any) => setError(err.response?.data?.error || err.message || 'Failed to load payroll history'))
      .finally(() => setLoading(false));
  }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter(h => {
      const pay = String(h.pay_date).slice(0, 10);
      if (fromDate && pay < fromDate) return false;
      if (toDate && pay > toDate) return false;
      if (q && !(h.sales_rep_name || '').toLowerCase().includes(q)) return false;
      return true;
    });
  }, [rows, search, fromDate, toDate]);

  const totals = useMemo(
    () => ({
      gross: filtered.reduce((s, h) => s + Number(h.gross_pay || 0), 0),
      ded: filtered.reduce((s, h) => s + regularDeductions(h), 0),
      extra: filtered.reduce((s, h) => s + Number(h.extra_deductions || 0), 0),
      advance: filtered.reduce((s, h) => s + Number(h.advance_recovery || 0), 0),
      net: filtered.reduce((s, h) => s + Number(h.net_pay || 0), 0),
    }),
    [filtered]
  );

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const pageRows = filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);
  const hasFilters = !!(search || fromDate || toDate);

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="w-full mx-auto px-4 py-4">
        <Link to="/sales-rep-payroll" className="inline-flex items-center text-[10px] text-gray-500 hover:text-gray-700 mb-1.5">
          <ArrowLeft className="w-3 h-3 mr-1" /> Back to Sales Rep Payroll
        </Link>

        <div className="bg-white border border-gray-200 rounded-md p-3 mb-3 flex items-center gap-2">
          <div className="bg-red-50 text-red-600 p-1.5 rounded-md"><History className="h-4 w-4" /></div>
          <div>
            <h1 className="text-sm font-bold text-gray-900">Sales Rep Payroll History</h1>
            <p className="text-[10px] text-gray-500 mt-0.5">Every payroll run posted for sales representatives. Click a record to view the payslip.</p>
          </div>
        </div>

        {error && <div className="mb-3 text-xs text-red-700 bg-red-50 border border-red-200 rounded px-3 py-2">{error}</div>}

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 mb-3">
          {[
            { label: 'Total Gross Pay', value: totals.gross, tone: 'text-gray-900' },
            { label: 'Total Deductions', value: totals.ded, tone: 'text-red-600' },
            { label: 'Total Extra Deductions', value: totals.extra, tone: 'text-red-600' },
            { label: 'Total Advance Recovery', value: totals.advance, tone: 'text-red-600' },
            { label: 'Total Net Pay', value: totals.net, tone: 'text-green-600' },
          ].map(c => (
            <div key={c.label} className="bg-white border border-gray-200 rounded-md p-3">
              <p className="text-[9px] font-semibold text-gray-500 uppercase tracking-wider mb-1">{c.label}</p>
              <p className={`text-lg font-bold ${c.tone}`}>{formatKES(c.value)}</p>
            </div>
          ))}
        </div>

        <div className="bg-white border border-gray-200 rounded-md overflow-hidden">
          <div className="flex flex-col md:flex-row md:items-center gap-2 px-3 py-2.5 border-b border-gray-200">
            <div className="relative md:w-64">
              <Search className="w-3 h-3 text-gray-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
              <input
                className={`${input} pl-7 w-full`}
                placeholder="Search by sales rep"
                value={search}
                onChange={e => { setSearch(e.target.value); setPage(1); }}
              />
            </div>
            <label className="flex items-center gap-1.5 text-[10px] text-gray-500">
              Pay date from
              <input type="date" className={input} value={fromDate} onChange={e => { setFromDate(e.target.value); setPage(1); }} />
            </label>
            <label className="flex items-center gap-1.5 text-[10px] text-gray-500">
              to
              <input type="date" className={input} value={toDate} onChange={e => { setToDate(e.target.value); setPage(1); }} />
            </label>
            {hasFilters && (
              <button
                onClick={() => { setSearch(''); setFromDate(''); setToDate(''); setPage(1); }}
                className="text-xs text-gray-600 hover:text-gray-900 md:ml-1"
              >
                Clear
              </button>
            )}
            <span className="text-[10px] text-gray-500 md:ml-auto">{filtered.length} record{filtered.length === 1 ? '' : 's'}</span>
          </div>

          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className={`${th} text-left`}>Sales Rep</th>
                  <th className={`${th} text-left`}>Pay Date</th>
                  <th className={`${th} text-left`}>Period</th>
                  <th className={`${th} text-center`}>Days Paid</th>
                  <th className={`${th} text-right`}>Gross Pay</th>
                  <th className={`${th} text-right`}>Deductions</th>
                  <th className={`${th} text-right`}>Extra Deductions</th>
                  <th className={`${th} text-right`}>Advance Recovery</th>
                  <th className={`${th} text-right`}>Net Pay</th>
                  <th className={`${th} text-center`}>Journal Entry</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {loading ? (
                  <tr><td colSpan={10} className="py-12 text-center text-xs text-gray-500">Loading…</td></tr>
                ) : pageRows.length === 0 ? (
                  <tr>
                    <td colSpan={10} className="py-12 text-center text-xs text-gray-500">
                      {hasFilters ? 'No payroll runs match your filters.' : 'No payroll runs recorded yet.'}
                    </td>
                  </tr>
                ) : (
                  pageRows.map(h => (
                    <tr
                      key={h.id}
                      className="hover:bg-red-50 cursor-pointer"
                      onClick={() => navigate(`/sales-rep-payroll/payslip/${h.id}`)}
                      title="View payslip"
                    >
                      <td className="px-3 py-2 text-xs font-medium text-gray-900 whitespace-nowrap">{h.sales_rep_name}</td>
                      <td className="px-3 py-2 text-xs text-gray-600 whitespace-nowrap">{fmtDate(h.pay_date)}</td>
                      <td className="px-3 py-2 text-xs text-gray-600 whitespace-nowrap">
                        {h.period_start && h.period_end ? `${fmtDate(h.period_start)} – ${fmtDate(h.period_end)}` : '—'}
                      </td>
                      <td className="px-3 py-2 text-xs text-gray-600 text-center whitespace-nowrap">{h.days_paid}/{h.working_days}</td>
                      <td className="px-3 py-2 text-xs text-gray-900 text-right whitespace-nowrap">{formatKES(Number(h.gross_pay))}</td>
                      <td className="px-3 py-2 text-xs text-red-600 text-right whitespace-nowrap">{formatKES(regularDeductions(h))}</td>
                      <td className={`px-3 py-2 text-xs text-right whitespace-nowrap ${Number(h.extra_deductions) > 0 ? 'text-red-600' : 'text-gray-400'}`}>{formatKES(Number(h.extra_deductions || 0))}</td>
                      <td className={`px-3 py-2 text-xs text-right whitespace-nowrap ${Number(h.advance_recovery) > 0 ? 'text-red-600' : 'text-gray-400'}`}>{formatKES(Number(h.advance_recovery || 0))}</td>
                      <td className="px-3 py-2 text-xs font-bold text-green-600 text-right whitespace-nowrap">{formatKES(Number(h.net_pay))}</td>
                      <td className="px-3 py-2 text-xs text-gray-500 text-center whitespace-nowrap">
                        {h.journal_entry_id ? `#${h.journal_entry_id}` : '—'}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {!loading && filtered.length > PAGE_SIZE && (
            <div className="px-3 py-2 border-t border-gray-200 flex items-center justify-between text-[10px] text-gray-500">
              <span>Page {currentPage} of {totalPages}</span>
              <div className="flex gap-1.5">
                <button className="px-2.5 py-1 border border-gray-300 rounded disabled:opacity-50" onClick={() => setPage(currentPage - 1)} disabled={currentPage === 1}>Prev</button>
                <button className="px-2.5 py-1 border border-gray-300 rounded disabled:opacity-50" onClick={() => setPage(currentPage + 1)} disabled={currentPage === totalPages}>Next</button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default SalesRepPayrollHistoryPage;
