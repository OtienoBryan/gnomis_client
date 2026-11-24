import React, { useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import { Link, useSearchParams } from 'react-router-dom';
import { ArrowLeft, CheckCircle2, Mail, PlayCircle, Search } from 'lucide-react';
import { API_CONFIG } from '../config/api';
import { Account, formatKES, getDaysInMonth, toLocalISODate } from '../utils/salesRepPayroll';
import type { StaffPayrollRow } from './StaffPayrollPage';

const PAYROLL_API_BASE = API_CONFIG.getUrl('/payroll');

const getAuthHeaders = () => {
  const token = localStorage.getItem('token');
  return token ? { Authorization: `Bearer ${token}` } : {};
};

const field =
  'w-full px-2.5 py-1.5 text-xs border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-green-500';
const label = 'block text-[10px] font-medium text-gray-700 mb-1';

interface EmailPerson { staff_id: number; name: string; payslip_id: number; email?: string; error?: string }
interface EmailSummary { sent: EmailPerson[]; failed: EmailPerson[]; no_email: EmailPerson[] }

const RunStaffPayrollPage: React.FC = () => {
  const [searchParams] = useSearchParams();
  const now = new Date();
  const [startDate, setStartDate] = useState(
    searchParams.get('start') || toLocalISODate(new Date(now.getFullYear(), now.getMonth(), 1))
  );
  const [endDate, setEndDate] = useState(
    searchParams.get('end') ||
      toLocalISODate(new Date(now.getFullYear(), now.getMonth(), getDaysInMonth(now.getFullYear(), now.getMonth())))
  );
  const statusFilter = searchParams.has('status') ? searchParams.get('status') || '' : '1';

  const [rows, setRows] = useState<StaffPayrollRow[]>([]);
  const [workingDays, setWorkingDays] = useState(0);
  const [paymentAccounts, setPaymentAccounts] = useState<Account[]>([]);
  const [expenseAccounts, setExpenseAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [payDate, setPayDate] = useState(() => toLocalISODate(new Date()));
  const [paymentAccount, setPaymentAccount] = useState('');
  const [expenseAccount, setExpenseAccount] = useState('');
  const [notes, setNotes] = useState('');
  const [sendPayslips, setSendPayslips] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [selectionTouched, setSelectionTouched] = useState(false);

  const [submitting, setSubmitting] = useState(false);
  const [runError, setRunError] = useState<string | null>(null);
  const [runResult, setRunResult] = useState<{ count: number; skipped: number; emails: EmailSummary | null } | null>(null);

  // Accounts
  useEffect(() => {
    Promise.all([
      axios.get(`${PAYROLL_API_BASE}/payment-accounts`, { headers: getAuthHeaders() }).catch(() => null),
      axios.get(API_CONFIG.getUrl('/financial/accounts/type16'), { headers: getAuthHeaders() }).catch(() => null),
    ]).then(([pay, exp]) => {
      if (pay?.data?.success) {
        setPaymentAccounts(pay.data.data || []);
        if (pay.data.data?.length) setPaymentAccount(String(pay.data.data[0].id));
      }
      if (exp?.data?.success) {
        setExpenseAccounts(exp.data.data || []);
        if (exp.data.data?.length) setExpenseAccount(String(exp.data.data[0].id));
      }
    });
  }, []);

  // Staff pay for the period (also tells which staff were already paid for it)
  useEffect(() => {
    setLoading(true);
    axios
      .get(`${PAYROLL_API_BASE}/staff-pay/summary`, {
        headers: getAuthHeaders(),
        params: { start: startDate, end: endDate, status: statusFilter },
      })
      .then(res => {
        setRows(res.data?.success ? res.data.data || [] : []);
        setWorkingDays(res.data?.period?.working_days || 0);
      })
      .catch((err: any) => setLoadError(err.response?.data?.error || err.message || 'Failed to load payroll data'))
      .finally(() => setLoading(false));
  }, [startDate, endDate, statusFilter, runResult]);

  // Everyone who can be paid is selected until the user changes the selection
  useEffect(() => {
    if (!selectionTouched) setSelectedIds(rows.filter(r => !r.already_paid && r.gross_pay > 0).map(r => r.id));
  }, [rows, selectionTouched]);

  const visibleRows = useMemo(() => {
    const q = search.trim().toLowerCase();
    return q ? rows.filter(r => r.name?.toLowerCase().includes(q)) : rows;
  }, [rows, search]);

  const selectedRows = rows.filter(r => selectedIds.includes(r.id) && !r.already_paid);
  const totals = selectedRows.reduce(
    (t, r) => ({ gross: t.gross + r.gross_pay, ded: t.ded + r.total_deductions, net: t.net + r.net_pay }),
    { gross: 0, ded: 0, net: 0 }
  );
  const selectable = visibleRows.filter(r => !r.already_paid);
  const allSelected = selectable.length > 0 && selectable.every(r => selectedIds.includes(r.id));

  const toggle = (id: number) => {
    setSelectionTouched(true);
    setSelectedIds(ids => (ids.includes(id) ? ids.filter(x => x !== id) : [...ids, id]));
  };
  const toggleAll = (checked: boolean) => {
    setSelectionTouched(true);
    const ids = selectable.map(r => r.id);
    setSelectedIds(cur => (checked ? Array.from(new Set([...cur, ...ids])) : cur.filter(id => !ids.includes(id))));
  };

  const handleRun = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!paymentAccount || !expenseAccount) { setRunError('Payment account and expense account are required'); return; }
    if (selectedRows.length === 0) { setRunError('Select at least one staff member who has not already been paid for this period'); return; }
    setSubmitting(true);
    setRunError(null);
    try {
      const res = await axios.post(
        `${PAYROLL_API_BASE}/staff-pay/run`,
        {
          pay_date: payDate,
          period_start: startDate,
          period_end: endDate,
          staff_ids: selectedRows.map(r => r.id),
          payment_account_id: Number(paymentAccount),
          expense_account_id: Number(expenseAccount),
          notes: notes || undefined,
          send_payslips: sendPayslips,
        },
        { headers: getAuthHeaders() }
      );
      if (res.data?.success) setRunResult({ count: res.data.count, skipped: res.data.skipped || 0, emails: res.data.emails || null });
      else setRunError(res.data?.error || 'Failed to run payroll');
    } catch (err: any) {
      setRunError(err.response?.data?.error || err.message || 'Failed to run payroll');
    }
    setSubmitting(false);
  };

  const header = (
    <div className="mb-4">
      <Link to="/payroll-management" className="inline-flex items-center text-[10px] text-gray-500 hover:text-gray-700 mb-1.5">
        <ArrowLeft className="w-3 h-3 mr-1" /> Back to Staff Payroll
      </Link>
      <div className="flex items-center gap-2">
        <div className="bg-green-50 text-green-600 p-1.5 rounded-md"><PlayCircle className="h-4 w-4" /></div>
        <div>
          <h1 className="text-sm font-bold text-gray-900">Run Staff Payroll</h1>
          <p className="text-[10px] text-gray-500">Review each employee's pay for the period, then post it to the ledger</p>
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
            {runResult.skipped > 0 && ` ${runResult.skipped} staff skipped (already paid for this period).`}
          </p>
          {runResult.emails && (
            <div className="mt-4 text-left text-xs border border-gray-200 rounded-md p-3 space-y-1.5">
              <div className="flex items-center gap-1.5 font-semibold text-gray-900">
                <Mail className="h-3.5 w-3.5" /> Payslip emails
              </div>
              <p className="text-green-700">{runResult.emails.sent.length} sent to personal email</p>
              {runResult.emails.no_email.length > 0 && (
                <div className="text-amber-700">
                  {runResult.emails.no_email.length} not sent (no personal email on staff record):{' '}
                  {runResult.emails.no_email.map((p, i) => (
                    <span key={p.payslip_id}>
                      {i > 0 && ', '}
                      <Link to={`/payroll-management/payslip/${p.payslip_id}`} className="underline">{p.name}</Link>
                    </span>
                  ))}
                </div>
              )}
              {runResult.emails.failed.length > 0 && (
                <div className="text-red-700">
                  {runResult.emails.failed.length} failed:
                  <ul className="list-disc ml-4">
                    {runResult.emails.failed.map(p => (
                      <li key={p.payslip_id}>
                        <Link to={`/payroll-management/payslip/${p.payslip_id}`} className="underline">{p.name}</Link> ({p.email}): {p.error}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              {(runResult.emails.no_email.length > 0 || runResult.emails.failed.length > 0) && (
                <p className="text-gray-500">Add missing emails under Edit Staff &gt; Personal Email, then open the payslip and use "Email payslip" to send it.</p>
              )}
            </div>
          )}
          <div className="flex justify-center gap-2 mt-5">
            <Link to="/payroll-management/history" className="px-3 py-1.5 text-xs font-medium text-gray-700 bg-gray-100 border border-gray-300 rounded hover:bg-gray-200">View history</Link>
            <Link to="/payroll-management" className="px-3 py-1.5 text-xs font-medium text-white bg-green-600 hover:bg-green-700 rounded">Done</Link>
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
        <div className="xl:col-span-2 bg-white border border-gray-200 rounded-md overflow-hidden">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 px-3 py-2.5 border-b border-gray-200">
            <h2 className="text-xs font-semibold text-gray-900">
              Staff <span className="font-normal text-gray-500">({selectedRows.length} of {rows.length} selected{rows.some(r => r.already_paid) ? ` · ${rows.filter(r => r.already_paid).length} already paid for this period` : ''})</span>
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
                    <input type="checkbox" checked={allSelected} onChange={e => toggleAll(e.target.checked)} aria-label="Select all" className="rounded border-gray-300 text-green-600 focus:ring-green-500" />
                  </th>
                  <th className="px-3 py-2 text-left font-medium">Staff</th>
                  <th className="px-3 py-2 text-right font-medium">Days paid</th>
                  <th className="px-3 py-2 text-right font-medium">Gross</th>
                  <th className="px-3 py-2 text-right font-medium">Deductions</th>
                  <th className="px-3 py-2 text-right font-medium">Net</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {loading ? (
                  <tr><td colSpan={6} className="py-10 text-center text-xs text-gray-500">Loading…</td></tr>
                ) : visibleRows.length === 0 ? (
                  <tr><td colSpan={6} className="py-10 text-center text-xs text-gray-500">No staff found.</td></tr>
                ) : (
                  visibleRows.map(r => {
                    const checked = !r.already_paid && selectedIds.includes(r.id);
                    return (
                      <tr key={r.id} className={`hover:bg-gray-50 ${checked ? '' : 'opacity-50'}`}>
                        <td className="px-3 py-2">
                          <input type="checkbox" checked={checked} disabled={r.already_paid} onChange={() => toggle(r.id)} aria-label={`Select ${r.name}`} className="rounded border-gray-300 text-green-600 focus:ring-green-500 disabled:cursor-not-allowed" />
                        </td>
                        <td className="px-3 py-2 text-xs font-medium text-gray-900">
                          {r.name}
                          {r.already_paid && (
                            <span className="ml-2 px-1.5 py-0.5 rounded-full text-[9px] font-medium bg-green-50 text-green-700 ring-1 ring-inset ring-green-200" title="Payroll already run for this period">Paid</span>
                          )}
                        </td>
                        <td className="px-3 py-2 text-xs text-right text-gray-600 whitespace-nowrap">{r.daysPaid}/{r.working_days}</td>
                        <td className="px-3 py-2 text-xs text-right whitespace-nowrap">{formatKES(r.gross_pay)}</td>
                        <td className="px-3 py-2 text-xs text-right text-red-600 whitespace-nowrap">{formatKES(r.total_deductions)}</td>
                        <td className="px-3 py-2 text-xs text-right font-semibold text-green-700 whitespace-nowrap">{formatKES(r.net_pay)}</td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="space-y-4">
          <div className="bg-white border border-gray-200 rounded-md p-4 space-y-3">
            <h2 className="text-xs font-semibold text-gray-900">Payroll settings</h2>
            <div className="grid grid-cols-2 gap-3">
              <div><label className={label}>Period start</label><input type="date" className={field} value={startDate} onChange={e => setStartDate(e.target.value)} required /></div>
              <div><label className={label}>Period end</label><input type="date" className={field} value={endDate} onChange={e => setEndDate(e.target.value)} required /></div>
            </div>
            <p className="text-[10px] text-gray-500 -mt-1">{workingDays} working days (Sundays excluded)</p>
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
              <p className="mt-1 text-[10px] text-gray-500">Debited for the total gross pay of this run. Each statutory deduction is credited to its linked liability account.</p>
            </div>
            <div>
              <label className={label}>Notes (optional)</label>
              <textarea rows={2} className={`${field} resize-none`} value={notes} onChange={e => setNotes(e.target.value)} />
            </div>
            <label className="flex items-start gap-2 text-xs text-gray-700 cursor-pointer">
              <input type="checkbox" checked={sendPayslips} onChange={e => setSendPayslips(e.target.checked)} className="mt-0.5 rounded border-gray-300 text-green-600 focus:ring-green-500" />
              <span>
                Email payslips to staff
                <span className="block text-[10px] text-gray-500">Each employee gets their payslip as a PDF at their personal email once payroll is posted.</span>
              </span>
            </label>
          </div>

          <div className="bg-white border border-gray-200 rounded-md p-4 space-y-2">
            <h2 className="text-xs font-semibold text-gray-900">Summary</h2>
            <div className="flex justify-between text-xs"><span className="text-gray-600">Staff</span><span>{selectedRows.length}</span></div>
            <div className="flex justify-between text-xs"><span className="text-gray-600">Gross pay</span><span>{formatKES(totals.gross)}</span></div>
            <div className="flex justify-between text-xs"><span className="text-gray-600">Deductions</span><span className="text-red-600">- {formatKES(totals.ded)}</span></div>
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
            <Link to="/payroll-management" className="block text-center text-xs text-gray-500 hover:text-gray-700 pt-1">Cancel</Link>
          </div>
        </div>
      </form>
    </div>
  );
};

export default RunStaffPayrollPage;
