import React, { useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import { Link, useSearchParams } from 'react-router-dom';
import { ArrowLeft, PlayCircle, CheckCircle2, Search } from 'lucide-react';
import { salesService, SalesRep } from '../services/salesService';
import { API_CONFIG } from '../config/api';
import {
  LoginHistory, Leave, Deduction, Account, RepPayroll, getDaysInMonth, toLocalISODate, formatKES,
  countWorkingDays, computeRepPayroll, sumApprovedExtraByRep, sumAdvanceBalanceByRep,
} from '../utils/salesRepPayroll';

const API_BASE_URL = import.meta.env.VITE_API_URL || (import.meta.env.PROD ? '/api' : 'http://localhost:5000/api');
const PAYROLL_API_BASE = API_CONFIG.getUrl('/payroll');

const getAuthHeaders = () => {
  const token = localStorage.getItem('token');
  return token ? { Authorization: `Bearer ${token}` } : {};
};

const field =
  'w-full px-2.5 py-1.5 text-xs border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-green-500';
const label = 'block text-[10px] font-medium text-gray-700 mb-1';

const RunSalesRepPayrollPage: React.FC = () => {
  const [searchParams] = useSearchParams();
  const now = new Date();
  const defaultStart = toLocalISODate(new Date(now.getFullYear(), now.getMonth(), 1));
  const defaultEnd = toLocalISODate(new Date(now.getFullYear(), now.getMonth(), getDaysInMonth(now.getFullYear(), now.getMonth())));

  // The overview page hands over its current period and filters
  const [startDate, setStartDate] = useState(searchParams.get('start') || defaultStart);
  const [endDate, setEndDate] = useState(searchParams.get('end') || defaultEnd);
  const countryFilter = searchParams.get('country') || '';
  const statusFilter = searchParams.has('status') ? searchParams.get('status') || '' : '1';
  const repFilter = searchParams.get('rep') || '';

  const [salesReps, setSalesReps] = useState<SalesRep[]>([]);
  const [loginHistory, setLoginHistory] = useState<LoginHistory[]>([]);
  const [leaves, setLeaves] = useState<Leave[]>([]);
  const [deductions, setDeductions] = useState<Deduction[]>([]);
  const [extraDeductions, setExtraDeductions] = useState<{ sales_rep_id: number; amount: number | string; status: string }[]>([]);
  const [paymentAccounts, setPaymentAccounts] = useState<Account[]>([]);
  const [expenseAccounts, setExpenseAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [payDate, setPayDate] = useState(() => toLocalISODate(new Date()));
  const [paymentAccount, setPaymentAccount] = useState('');
  const [expenseAccount, setExpenseAccount] = useState('');
  const [notes, setNotes] = useState('');
  const [search, setSearch] = useState('');
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [selectionTouched, setSelectionTouched] = useState(false);

  const [submitting, setSubmitting] = useState(false);
  const [runError, setRunError] = useState<string | null>(null);
  const [runResult, setRunResult] = useState<{ count: number; skipped: number } | null>(null);

  useEffect(() => {
    setLoading(true);
    Promise.all([
      salesService.getAllSalesReps(),
      axios.get(`${API_BASE_URL}/login-history`, { headers: getAuthHeaders() }),
      axios.get(`${API_BASE_URL}/sales-rep-leaves/sales-rep-leaves`, { headers: getAuthHeaders() }),
      axios.get(`${PAYROLL_API_BASE}/deductions`, { headers: getAuthHeaders() }),
      axios.get(`${PAYROLL_API_BASE}/payment-accounts`, { headers: getAuthHeaders() }).catch(() => null),
      axios.get(API_CONFIG.getUrl('/financial/accounts/type16'), { headers: getAuthHeaders() }).catch(() => null),
    ])
      .then(([reps, login, lv, ded, pay, exp]) => {
        setSalesReps(reps || []);
        setLoginHistory(login.data || []);
        setLeaves(lv.data || []);
        setDeductions(ded.data?.success ? ded.data.data || [] : []);
        if (pay?.data?.success) {
          setPaymentAccounts(pay.data.data || []);
          if (pay.data.data?.length) setPaymentAccount(String(pay.data.data[0].id));
        }
        if (exp?.data?.success) {
          setExpenseAccounts(exp.data.data || []);
          if (exp.data.data?.length) setExpenseAccount(String(exp.data.data[0].id));
        }
      })
      .catch((err: any) => setLoadError(err.response?.data?.message || err.message || 'Failed to load payroll data'))
      .finally(() => setLoading(false));
  }, []);

  // Approved deductions from the Sales Rep Deductions page that fall inside the period
  useEffect(() => {
    let cancelled = false;
    axios
      .get(`${PAYROLL_API_BASE}/sales-rep-deductions`, {
        headers: getAuthHeaders(),
        params: { start_date: startDate, end_date: endDate },
      })
      .then(res => { if (!cancelled) setExtraDeductions(res.data?.success ? res.data.data || [] : []); })
      .catch(() => { if (!cancelled) setExtraDeductions([]); });
    return () => { cancelled = true; };
  }, [startDate, endDate]);

  const extraByRep = useMemo(() => sumApprovedExtraByRep(extraDeductions), [extraDeductions]);

  // Approved salary advances that still have a balance to recover (dated up to the period end)
  const [advances, setAdvances] = useState<{ sales_rep_id: number; amount: number | string; recovered_amount: number | string; status: string }[]>([]);
  useEffect(() => {
    let cancelled = false;
    axios
      .get(`${PAYROLL_API_BASE}/sales-rep-advances`, {
        headers: getAuthHeaders(),
        params: { outstanding: 1, end_date: endDate },
      })
      .then(res => { if (!cancelled) setAdvances(res.data?.success ? res.data.data || [] : []); })
      .catch(() => { if (!cancelled) setAdvances([]); });
    return () => { cancelled = true; };
  }, [endDate, runResult]);
  const advanceByRep = useMemo(() => sumAdvanceBalanceByRep(advances), [advances]);

  // Reps who already have a payroll run overlapping this period can't be paid again
  const [paidRuns, setPaidRuns] = useState<{ sales_rep_id: number; period_start: string; period_end: string }[]>([]);
  useEffect(() => {
    axios
      .get(`${PAYROLL_API_BASE}/sales-reps-history`, { headers: getAuthHeaders() })
      .then(res => setPaidRuns(res.data?.success ? res.data.data || [] : []))
      .catch(() => setPaidRuns([]));
  }, [runResult]);

  const paidIds = useMemo(() => {
    const set = new Set<number>();
    paidRuns.forEach(h => {
      const s = String(h.period_start).slice(0, 10);
      const e = String(h.period_end).slice(0, 10);
      if (s <= endDate && e >= startDate) set.add(h.sales_rep_id);
    });
    return set;
  }, [paidRuns, startDate, endDate]);

  const activeDeductions = useMemo(() => deductions.filter(d => !!d.is_active), [deductions]);
  const numWorkingDays = countWorkingDays(startDate, endDate);

  const rows: RepPayroll[] = useMemo(() => {
    const rangeStart = new Date(startDate);
    const rangeEnd = new Date(endDate);
    return salesReps
      .filter(rep => {
        if (countryFilter && rep.country !== countryFilter) return false;
        if (statusFilter && rep.status !== parseInt(statusFilter)) return false;
        if (repFilter && String(rep.id) !== repFilter) return false;
        return true;
      })
      .map(rep => computeRepPayroll(rep, { loginHistory, leaves, activeDeductions, numWorkingDays, rangeStart, rangeEnd, extraDeduction: extraByRep.get(rep.id) || 0, advanceBalance: advanceByRep.get(rep.id) || 0 }));
  }, [salesReps, loginHistory, leaves, activeDeductions, numWorkingDays, startDate, endDate, countryFilter, statusFilter, repFilter, extraByRep, advanceByRep]);

  // Everyone is selected until the user changes the selection
  useEffect(() => {
    if (!selectionTouched) setSelectedIds(rows.filter(r => !paidIds.has(r.rep.id)).map(r => r.rep.id));
  }, [rows, selectionTouched, paidIds]);

  const visibleRows = useMemo(() => {
    const q = search.trim().toLowerCase();
    return q ? rows.filter(r => r.rep.name?.toLowerCase().includes(q)) : rows;
  }, [rows, search]);

  const selectedRows = rows.filter(r => selectedIds.includes(r.rep.id) && !paidIds.has(r.rep.id));
  const totals = selectedRows.reduce(
    (t, r) => ({ gross: t.gross + r.grossPay, ded: t.ded + r.totalDeductions, extra: t.extra + r.extraDeduction, advance: t.advance + r.advanceRecovery, net: t.net + r.netPay }),
    { gross: 0, ded: 0, extra: 0, advance: 0, net: 0 }
  );
  const selectableRows = visibleRows.filter(r => !paidIds.has(r.rep.id));
  const allVisibleSelected = selectableRows.length > 0 && selectableRows.every(r => selectedIds.includes(r.rep.id));

  const toggle = (id: number) => {
    if (paidIds.has(id)) return;
    setSelectionTouched(true);
    setSelectedIds(ids => (ids.includes(id) ? ids.filter(x => x !== id) : [...ids, id]));
  };

  const toggleAllVisible = (checked: boolean) => {
    setSelectionTouched(true);
    const visible = selectableRows.map(r => r.rep.id);
    setSelectedIds(ids => (checked ? Array.from(new Set([...ids, ...visible])) : ids.filter(id => !visible.includes(id))));
  };

  const handleRun = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!paymentAccount || !expenseAccount) { setRunError('Payment account and expense account are required'); return; }
    const idsToPay = selectedRows.map(r => r.rep.id);
    if (idsToPay.length === 0) { setRunError('Select at least one sales rep who has not already been paid for this period'); return; }
    setSubmitting(true);
    setRunError(null);
    try {
      const res = await axios.post(
        `${PAYROLL_API_BASE}/run-sales-reps`,
        {
          pay_date: payDate,
          period_start: startDate,
          period_end: endDate,
          sales_rep_ids: idsToPay,
          payment_account_id: Number(paymentAccount),
          expense_account_id: Number(expenseAccount),
          notes: notes || undefined,
        },
        { headers: getAuthHeaders() }
      );
      if (res.data?.success) setRunResult({ count: res.data.count, skipped: res.data.skipped || 0 });
      else setRunError(res.data?.error || 'Failed to run payroll');
    } catch (err: any) {
      setRunError(err.response?.data?.error || err.message || 'Failed to run payroll');
    }
    setSubmitting(false);
  };

  const header = (
    <div className="mb-4">
      <Link to="/sales-rep-payroll" className="inline-flex items-center text-[10px] text-gray-500 hover:text-gray-700 mb-1.5">
        <ArrowLeft className="w-3 h-3 mr-1" /> Back to Sales Rep Payroll
      </Link>
      <div className="flex items-center gap-2">
        <div className="bg-green-50 text-green-600 p-1.5 rounded-md"><PlayCircle className="h-4 w-4" /></div>
        <div>
          <h1 className="text-sm font-bold text-gray-900">Run Sales Rep Payroll</h1>
          <p className="text-[10px] text-gray-500">Review each rep's pay for the period, then post it to the ledger</p>
        </div>
      </div>
    </div>
  );

  if (runResult) {
    return (
      <div className="min-h-screen bg-gray-50 px-4 py-4">
        {header}
        <div className="bg-white border border-gray-200 rounded-md p-10 text-center max-w-xl mx-auto">
          <CheckCircle2 className="h-10 w-10 text-green-600 mx-auto mb-3" />
          <h2 className="text-sm font-semibold text-gray-900 mb-1">Payroll posted</h2>
          <p className="text-xs text-gray-600">
            {runResult.count} journal {runResult.count === 1 ? 'entry' : 'entries'} recorded for {startDate} to {endDate}.
            {runResult.skipped > 0 && ` ${runResult.skipped} rep(s) skipped (already paid for this date).`}
          </p>
          <div className="flex justify-center gap-2 mt-5">
            <Link to="/sales-rep-payroll/history" className="px-3 py-1.5 text-xs font-medium text-gray-700 bg-gray-100 border border-gray-300 rounded hover:bg-gray-200">View history</Link>
            <Link to="/sales-rep-payroll" className="px-3 py-1.5 text-xs font-medium text-white bg-green-600 hover:bg-green-700 rounded">Done</Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 px-4 py-4">
      {header}

      {loadError && <div className="mb-3 text-xs text-red-700 bg-red-50 border border-red-200 rounded p-2.5">{loadError}</div>}

      <form onSubmit={handleRun} className="grid grid-cols-1 xl:grid-cols-3 gap-4 items-start">
        {/* Sales reps */}
        <div className="xl:col-span-2 bg-white border border-gray-200 rounded-md overflow-hidden">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 px-3 py-2.5 border-b border-gray-200">
            <h2 className="text-xs font-semibold text-gray-900">
              Sales reps <span className="font-normal text-gray-500">({selectedRows.length} of {rows.length} selected{paidIds.size > 0 ? ` · ${rows.filter(r => paidIds.has(r.rep.id)).length} already paid for this period` : ''})</span>
            </h2>
            <div className="relative sm:w-64">
              <Search className="w-3 h-3 text-gray-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
              <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search by name" className={`${field} pl-7`} />
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr className="text-[10px] uppercase tracking-wider text-gray-500">
                  <th className="px-3 py-2 w-8">
                    <input type="checkbox" checked={allVisibleSelected} onChange={e => toggleAllVisible(e.target.checked)} aria-label="Select all" className="rounded border-gray-300 text-green-600 focus:ring-green-500" />
                  </th>
                  <th className="px-3 py-2 text-left font-medium">Sales rep</th>
                  <th className="px-3 py-2 text-right font-medium">Days paid</th>
                  <th className="px-3 py-2 text-right font-medium">Gross</th>
                  <th className="px-3 py-2 text-right font-medium">Deductions</th>
                  <th className="px-3 py-2 text-right font-medium">Extra deductions</th>
                  <th className="px-3 py-2 text-right font-medium">Advance recovery</th>
                  <th className="px-3 py-2 text-right font-medium">Net</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {loading ? (
                  <tr><td colSpan={8} className="py-10 text-center text-xs text-gray-500">Loading…</td></tr>
                ) : visibleRows.length === 0 ? (
                  <tr><td colSpan={8} className="py-10 text-center text-xs text-gray-500">No sales reps match the current filters.</td></tr>
                ) : (
                  visibleRows.map(r => {
                    const alreadyPaid = paidIds.has(r.rep.id);
                    const checked = !alreadyPaid && selectedIds.includes(r.rep.id);
                    return (
                      <tr key={r.rep.id} className={`hover:bg-gray-50 ${checked ? '' : 'opacity-50'}`}>
                        <td className="px-3 py-2">
                          <input type="checkbox" checked={checked} disabled={alreadyPaid} onChange={() => toggle(r.rep.id)} aria-label={`Select ${r.rep.name}`} className="rounded border-gray-300 text-green-600 focus:ring-green-500 disabled:cursor-not-allowed" />
                        </td>
                        <td className="px-3 py-2 text-xs font-medium text-gray-900">
                          {r.rep.name}
                          {alreadyPaid && (
                            <span className="ml-2 px-1.5 py-0.5 rounded-full text-[9px] font-medium bg-green-50 text-green-700 ring-1 ring-inset ring-green-200" title="Payroll already run for this period">
                              Paid
                            </span>
                          )}
                        </td>
                        <td className="px-3 py-2 text-xs text-right text-gray-600 whitespace-nowrap">{r.daysPaid}/{r.totalWorkingDays}</td>
                        <td className="px-3 py-2 text-xs text-right whitespace-nowrap">{formatKES(r.grossPay)}</td>
                        <td className="px-3 py-2 text-xs text-right text-red-600 whitespace-nowrap">{formatKES(r.totalDeductions)}</td>
                        <td className={`px-3 py-2 text-xs text-right whitespace-nowrap ${r.extraDeduction > 0 ? 'text-red-600' : 'text-gray-400'}`}>{formatKES(r.extraDeduction)}</td>
                        <td className={`px-3 py-2 text-xs text-right whitespace-nowrap ${r.advanceRecovery > 0 ? 'text-red-600' : 'text-gray-400'}`}>{formatKES(r.advanceRecovery)}
                          {r.advanceBalance - r.advanceRecovery > 0.005 && (
                            <div className="text-[9px] text-amber-600">{formatKES(r.advanceBalance - r.advanceRecovery)} carried forward</div>
                          )}
                        </td>
                        <td className="px-3 py-2 text-xs text-right font-semibold text-green-700 whitespace-nowrap">{formatKES(r.netPay)}</td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Settings + summary */}
        <div className="space-y-4">
          <div className="bg-white border border-gray-200 rounded-md p-4 space-y-3">
            <h2 className="text-xs font-semibold text-gray-900">Payroll settings</h2>
            <div className="grid grid-cols-2 gap-3">
              <div><label className={label}>Period start</label><input type="date" className={field} value={startDate} onChange={e => { setStartDate(e.target.value); }} required /></div>
              <div><label className={label}>Period end</label><input type="date" className={field} value={endDate} onChange={e => { setEndDate(e.target.value); }} required /></div>
            </div>
            <p className="text-[10px] text-gray-500 -mt-1">{numWorkingDays} working days (Sundays excluded)</p>
            <div><label className={label}>Pay date</label><input type="date" className={field} value={payDate} onChange={e => setPayDate(e.target.value)} required /></div>
            <div>
              <label className={label}>Payment account (cash/bank)</label>
              <select className={field} value={paymentAccount} onChange={e => setPaymentAccount(e.target.value)} required>
                <option value="">Select account</option>
                {paymentAccounts.map(a => <option key={a.id} value={a.id}>{a.account_code} - {a.account_name}</option>)}
              </select>
            </div>
            <div>
              <label className={label}>Payroll expense account</label>
              <select className={field} value={expenseAccount} onChange={e => setExpenseAccount(e.target.value)} required>
                <option value="">Select account</option>
                {expenseAccounts.map(a => <option key={a.id} value={a.id}>{a.account_code} - {a.account_name}</option>)}
              </select>
              <p className="mt-1 text-[10px] text-gray-500">Debited for the total gross pay of this run. Approved extra deductions are credited to the 'Other deductions payable' account, and salary advance recoveries to the 'Staff loans receivable' account, both set on Payroll Account Links.</p>
            </div>
            <div>
              <label className={label}>Notes (optional)</label>
              <textarea rows={2} className={`${field} resize-none`} value={notes} onChange={e => setNotes(e.target.value)} />
            </div>
          </div>

          <div className="bg-white border border-gray-200 rounded-md p-4 space-y-2">
            <h2 className="text-xs font-semibold text-gray-900">Summary</h2>
            <div className="flex justify-between text-xs"><span className="text-gray-600">Sales reps</span><span>{selectedRows.length}</span></div>
            <div className="flex justify-between text-xs"><span className="text-gray-600">Gross pay</span><span>{formatKES(totals.gross)}</span></div>
            <div className="flex justify-between text-xs"><span className="text-gray-600">Deductions</span><span className="text-red-600">- {formatKES(totals.ded)}</span></div>
            <div className="flex justify-between text-xs"><span className="text-gray-600">Extra deductions</span><span className="text-red-600">- {formatKES(totals.extra)}</span></div>
            <div className="flex justify-between text-xs"><span className="text-gray-600">Salary advance recovery</span><span className="text-red-600">- {formatKES(totals.advance)}</span></div>
            <div className="flex justify-between text-sm font-semibold border-t pt-2"><span>Net pay</span><span className="text-green-700">{formatKES(totals.net)}</span></div>

            {runError && <div className="text-xs text-red-600 bg-red-50 border border-red-200 rounded px-3 py-2">{runError}</div>}

            <button
              type="submit"
              disabled={submitting || selectedRows.length === 0}
              className="w-full mt-2 inline-flex items-center justify-center px-3 py-2 text-xs font-semibold text-white bg-green-600 hover:bg-green-700 rounded disabled:opacity-50"
            >
              <PlayCircle className="h-3.5 w-3.5 mr-1.5" />
              {submitting ? 'Processing…' : 'Run payroll'}
            </button>
            <Link to="/sales-rep-payroll" className="block text-center text-xs text-gray-500 hover:text-gray-700 pt-1">Cancel</Link>
          </div>
        </div>
      </form>
    </div>
  );
};

export default RunSalesRepPayrollPage;
