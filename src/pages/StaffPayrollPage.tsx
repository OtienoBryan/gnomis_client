import React, { useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import { Link } from 'react-router-dom';
import { Download, History, PlayCircle, Search, X } from 'lucide-react';
import { API_CONFIG } from '../config/api';
import { formatKES, getDaysInMonth, toLocalISODate } from '../utils/salesRepPayroll';

const PAYROLL_API_BASE = API_CONFIG.getUrl('/payroll');

export interface StaffPayrollRow {
  id: number;
  name: string;
  role?: string | null;
  designation?: string | null;
  department?: string | null;
  empl_no?: string | null;
  status: number;
  working_days: number;
  already_paid: boolean;
  present: number;
  leave: number;
  daysPaid: number;
  basic_salary: number;
  gross_pay: number;
  deductions: { id: number; name: string; account_id: number; amount: number }[];
  advance_recovery?: number;
  total_deductions: number;
  net_pay: number;
}

// total_deductions from the API includes the salary advance recovery; show it separately
const otherDeductions = (r: { total_deductions: number; advance_recovery?: number }) =>
  Math.round((r.total_deductions - (r.advance_recovery || 0)) * 100) / 100;

const getAuthHeaders = () => {
  const token = localStorage.getItem('token');
  return token ? { Authorization: `Bearer ${token}` } : {};
};

const input =
  'px-2.5 py-1.5 text-xs border border-gray-300 rounded bg-white focus:outline-none focus:ring-1 focus:ring-red-500';
const th = 'px-3 py-2 text-[10px] font-semibold text-gray-500 uppercase tracking-wider';

const StaffPayrollPage: React.FC = () => {
  const now = new Date();
  const [startDate, setStartDate] = useState(toLocalISODate(new Date(now.getFullYear(), now.getMonth(), 1)));
  const [endDate, setEndDate] = useState(
    toLocalISODate(new Date(now.getFullYear(), now.getMonth(), getDaysInMonth(now.getFullYear(), now.getMonth())))
  );
  const [status, setStatus] = useState('1');
  const [search, setSearch] = useState('');
  const [rows, setRows] = useState<StaffPayrollRow[]>([]);
  const [workingDays, setWorkingDays] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<StaffPayrollRow | null>(null);

  useEffect(() => {
    setLoading(true);
    setError(null);
    axios
      .get(`${PAYROLL_API_BASE}/staff-pay/summary`, {
        headers: getAuthHeaders(),
        params: { start: startDate, end: endDate, status },
      })
      .then(res => {
        setRows(res.data?.success ? res.data.data || [] : []);
        setWorkingDays(res.data?.period?.working_days || 0);
      })
      .catch((err: any) => setError(err.response?.data?.error || err.message || 'Failed to load staff payroll'))
      .finally(() => setLoading(false));
  }, [startDate, endDate, status]);

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    return q
      ? rows.filter(r => [r.name, r.role, r.department, r.empl_no].some(v => (v || '').toLowerCase().includes(q)))
      : rows;
  }, [rows, search]);

  const totals = useMemo(
    () => ({
      gross: visible.reduce((s, r) => s + r.gross_pay, 0),
      ded: visible.reduce((s, r) => s + otherDeductions(r), 0),
      adv: visible.reduce((s, r) => s + (r.advance_recovery || 0), 0),
      net: visible.reduce((s, r) => s + r.net_pay, 0),
    }),
    [visible]
  );

  const exportCSV = () => {
    const head = ['Name', 'Role', 'Department', 'Basic Salary', 'Days Paid', 'Working Days', 'Gross Pay', 'Deductions', 'Advance', 'Net Pay', 'Paid'];
    const body = visible.map(r =>
      [r.name, r.role || '', r.department || '', r.basic_salary, r.daysPaid, r.working_days, r.gross_pay, otherDeductions(r), r.advance_recovery || 0, r.net_pay, r.already_paid ? 'Yes' : 'No']
        .map(v => `"${String(v).replace(/"/g, '""')}"`)
        .join(',')
    );
    const blob = new Blob([[head.join(','), ...body].join('\n')], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `staff-payroll-${startDate}-to-${endDate}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const runLink = `/payroll-management/run?start=${startDate}&end=${endDate}&status=${status}`;

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="w-full px-4 py-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-3">
          <div>
            <h1 className="text-base font-bold text-gray-900">Staff Payroll</h1>
            <p className="text-xs text-gray-500">
              Pay for employees is prorated by attendance (days present + approved leave) over {workingDays} working days, with the active statutory deductions applied.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Link to="/payroll-management/history" className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs text-gray-700 bg-white border border-gray-300 rounded hover:bg-gray-50">
              <History className="w-3.5 h-3.5" /> Payroll History
            </Link>
            <button onClick={exportCSV} className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs text-gray-700 bg-white border border-gray-300 rounded hover:bg-gray-50">
              <Download className="w-3.5 h-3.5" /> Export CSV
            </button>
            <Link to={runLink} className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-green-600 rounded hover:bg-green-700">
              <PlayCircle className="w-3.5 h-3.5" /> Run Payroll
            </Link>
          </div>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 mb-3">
          {[
            { label: 'Staff', value: String(visible.length), tone: 'text-gray-900' },
            { label: 'Gross pay', value: formatKES(totals.gross), tone: 'text-gray-900' },
            { label: 'Deductions', value: formatKES(totals.ded), tone: 'text-red-600' },
            { label: 'Advances', value: formatKES(totals.adv), tone: 'text-amber-600' },
            { label: 'Net pay', value: formatKES(totals.net), tone: 'text-green-600' },
          ].map(c => (
            <div key={c.label} className="bg-white border border-gray-200 rounded-md px-3 py-2">
              <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider">{c.label}</p>
              <p className={`text-lg font-bold ${c.tone}`}>{loading ? '–' : c.value}</p>
            </div>
          ))}
        </div>

        <div className="bg-white border border-gray-200 rounded-md overflow-hidden">
          <div className="flex flex-col lg:flex-row lg:items-center gap-2 px-3 py-2.5 border-b border-gray-200">
            <div className="relative lg:w-64">
              <Search className="w-3 h-3 text-gray-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
              <input className={`${input} pl-7 w-full`} placeholder="Search name, role, department" value={search} onChange={e => setSearch(e.target.value)} />
            </div>
            <label className="flex items-center gap-1.5 text-[10px] text-gray-500">
              Period
              <input type="date" className={input} value={startDate} onChange={e => setStartDate(e.target.value)} />
            </label>
            <label className="flex items-center gap-1.5 text-[10px] text-gray-500">
              to
              <input type="date" className={input} value={endDate} onChange={e => setEndDate(e.target.value)} />
            </label>
            <select className={input} value={status} onChange={e => setStatus(e.target.value)}>
              <option value="1">Active staff</option>
              <option value="0">Inactive staff</option>
              <option value="">All staff</option>
            </select>
          </div>

          {error && <div className="m-3 text-xs text-red-700 bg-red-50 border border-red-200 rounded px-3 py-2">{error}</div>}

          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className={`${th} text-left`}>Staff</th>
                  <th className={`${th} text-left`}>Department</th>
                  <th className={`${th} text-right`}>Basic salary</th>
                  <th className={`${th} text-center`}>Days paid</th>
                  <th className={`${th} text-right`}>Gross pay</th>
                  <th className={`${th} text-right`}>Deductions</th>
                  <th className={`${th} text-right`}>Advance</th>
                  <th className={`${th} text-right`}>Net pay</th>
                  <th className={`${th} text-center`}>Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {loading ? (
                  <tr><td colSpan={9} className="py-12 text-center text-xs text-gray-500">Loading…</td></tr>
                ) : visible.length === 0 ? (
                  <tr><td colSpan={9} className="py-12 text-center text-xs text-gray-500">No staff found.</td></tr>
                ) : (
                  visible.map(r => (
                    <tr key={r.id} className="hover:bg-gray-50 cursor-pointer" onClick={() => setSelected(r)} title="View breakdown">
                      <td className="px-3 py-2 whitespace-nowrap">
                        <div className="text-xs font-medium text-gray-900">{r.name}</div>
                        <div className="text-[10px] text-gray-500">{r.designation || r.role || ''}</div>
                      </td>
                      <td className="px-3 py-2 text-xs text-gray-600 whitespace-nowrap">{r.department || '—'}</td>
                      <td className="px-3 py-2 text-xs text-right text-gray-900 whitespace-nowrap">{formatKES(r.basic_salary)}</td>
                      <td className="px-3 py-2 text-xs text-center text-gray-600 whitespace-nowrap">
                        {r.daysPaid}/{r.working_days}
                        {r.leave > 0 && <span className="text-[10px] text-gray-400"> ({r.leave} leave)</span>}
                      </td>
                      <td className="px-3 py-2 text-xs text-right text-gray-900 whitespace-nowrap">{formatKES(r.gross_pay)}</td>
                      <td className="px-3 py-2 text-xs text-right text-red-600 whitespace-nowrap">{formatKES(otherDeductions(r))}</td>
                      <td className="px-3 py-2 text-xs text-right text-amber-600 whitespace-nowrap">
                        {r.advance_recovery ? formatKES(r.advance_recovery) : <span className="text-gray-400">—</span>}
                      </td>
                      <td className="px-3 py-2 text-xs text-right font-semibold text-green-700 whitespace-nowrap">{formatKES(r.net_pay)}</td>
                      <td className="px-3 py-2 text-center whitespace-nowrap">
                        {r.already_paid ? (
                          <span className="px-1.5 py-0.5 rounded-full text-[10px] font-medium bg-green-50 text-green-700 ring-1 ring-inset ring-green-200">Paid</span>
                        ) : (
                          <span className="px-1.5 py-0.5 rounded-full text-[10px] font-medium bg-gray-100 text-gray-600">Not paid</span>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {selected && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => setSelected(null)}>
          <div className="bg-white rounded-lg shadow-xl w-full max-w-md" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200">
              <div>
                <h3 className="text-sm font-semibold text-gray-900">{selected.name}</h3>
                <p className="text-[11px] text-gray-500">{startDate} to {endDate}</p>
              </div>
              <button onClick={() => setSelected(null)} className="text-gray-400 hover:text-gray-600"><X className="w-4 h-4" /></button>
            </div>
            <div className="px-4 py-3 text-xs space-y-1.5">
              <div className="flex justify-between"><span className="text-gray-600">Basic salary</span><span>{formatKES(selected.basic_salary)}</span></div>
              <div className="flex justify-between"><span className="text-gray-600">Days present</span><span>{selected.present}</span></div>
              <div className="flex justify-between"><span className="text-gray-600">Approved leave days</span><span>{selected.leave}</span></div>
              <div className="flex justify-between"><span className="text-gray-600">Days paid / working days</span><span>{selected.daysPaid} / {selected.working_days}</span></div>
              <div className="flex justify-between font-medium border-t pt-1.5"><span>Gross pay</span><span>{formatKES(selected.gross_pay)}</span></div>
              {selected.deductions.length === 0 && !selected.advance_recovery ? (
                <div className="text-gray-400">No deductions</div>
              ) : (
                selected.deductions.map(d => (
                  <div key={d.id} className="flex justify-between"><span className="text-gray-600">{d.name}</span><span className="text-red-600">- {formatKES(d.amount)}</span></div>
                ))
              )}
              {!!selected.advance_recovery && (
                <div className="flex justify-between"><span className="text-gray-600">Salary advance recovery</span><span className="text-red-600">- {formatKES(selected.advance_recovery)}</span></div>
              )}
              <div className="flex justify-between font-medium border-t pt-1.5"><span>Total deductions</span><span className="text-red-600">- {formatKES(selected.total_deductions)}</span></div>
              <div className="flex justify-between text-sm font-semibold border-t pt-1.5"><span>Net pay</span><span className="text-green-700">{formatKES(selected.net_pay)}</span></div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default StaffPayrollPage;
