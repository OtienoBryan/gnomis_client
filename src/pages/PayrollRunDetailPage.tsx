import React, { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Download, FileText, Pencil, Trash2, X, Printer } from 'lucide-react';
import { payrollApi, kes, periodLabel, PayrollRun, RunItem, Payslip, Account } from '../services/payrollService';
import { statusBadge } from './PayrollRunsPage';

type Detail = Awaited<ReturnType<typeof payrollApi.run>>;
const input = 'w-full px-2.5 py-1.5 text-xs border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-red-500';

const PayslipView: React.FC<{ data: { run: PayrollRun; staff: any; profile: any; payslip: Payslip } }> = ({ data }) => {
  const { run, staff, profile, payslip: p } = data;
  const row = (name: string, amount: number, sign = '') => (
    <tr key={name}><td className="py-0.5">{name}</td><td className="py-0.5 text-right">{sign}{kes(amount)}</td></tr>
  );
  return (
    <div id="payslip-print" className="text-xs text-gray-900">
      <div className="text-center mb-3">
        <div className="text-sm font-bold">PAYSLIP</div>
        <div className="text-gray-600">{periodLabel(run)}</div>
      </div>
      <div className="grid grid-cols-2 gap-x-6 gap-y-0.5 mb-3 text-[11px]">
        <div><span className="text-gray-500">Employee:</span> {staff.name}</div>
        <div><span className="text-gray-500">ID No:</span> {profile.id_no || '—'}</div>
        <div><span className="text-gray-500">Role:</span> {staff.role || '—'}</div>
        <div><span className="text-gray-500">KRA PIN:</span> {profile.kra_pin || '—'}</div>
        <div><span className="text-gray-500">NSSF No:</span> {profile.nssf_no || '—'}</div>
        <div><span className="text-gray-500">SHIF No:</span> {profile.shif_no || '—'}</div>
        <div><span className="text-gray-500">Pay date:</span> {String(run.pay_date).slice(0, 10)}</div>
      </div>
      <div className="grid grid-cols-2 gap-6">
        <div>
          <div className="font-semibold border-b mb-1">Earnings</div>
          <table className="w-full"><tbody>
            {row('Basic salary', p.basic_full)}
            {p.unpaid_days > 0 && row(`Unpaid leave (${p.unpaid_days} days)`, p.basic - p.basic_full)}
            {p.allowances.map((a) => row(a.name + (a.taxable ? '' : ' (non-taxable)'), a.amount))}
            {p.extra_earnings > 0 && row('Bonus / overtime', p.extra_earnings)}
            <tr className="border-t font-semibold"><td className="py-1">Gross pay</td><td className="py-1 text-right">{kes(p.gross_pay)}</td></tr>
          </tbody></table>
        </div>
        <div>
          <div className="font-semibold border-b mb-1">Deductions</div>
          <table className="w-full"><tbody>
            {p.statutory.filter((s) => s.employee > 0).map((s) => row(s.name, s.employee))}
            {p.deductions.map((d) => row(d.name, d.amount))}
            {p.extra_deductions > 0 && row('Other deductions', p.extra_deductions)}
            {p.loans.map((l) => row(l.name, l.amount))}
            <tr className="border-t font-semibold"><td className="py-1">Total deductions</td><td className="py-1 text-right">{kes(p.total_deductions)}</td></tr>
          </tbody></table>
        </div>
      </div>
      <div className="mt-3 flex justify-between items-center border-t border-b py-2 text-sm font-bold">
        <span>NET PAY</span><span>{kes(p.net_pay)}</span>
      </div>
      <div className="mt-2 text-[10px] text-gray-500">
        Taxable income {kes(p.taxable_income)}. {profile.bank_name ? `Paid to ${profile.bank_name} ${profile.bank_account || ''}.` : ''}
      </div>
    </div>
  );
};

const PayrollRunDetailPage: React.FC = () => {
  const { id } = useParams();
  const runId = Number(id);
  const navigate = useNavigate();
  const [detail, setDetail] = useState<Detail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const [editItem, setEditItem] = useState<RunItem | null>(null);
  const [edit, setEdit] = useState({ unpaid_days: '', extra_earnings: '', extra_deductions: '' });
  const [payslip, setPayslip] = useState<{ run: PayrollRun; staff: any; profile: any; payslip: Payslip } | null>(null);
  const [payOpen, setPayOpen] = useState(false);
  const [payAccounts, setPayAccounts] = useState<Account[]>([]);
  const [payAccount, setPayAccount] = useState('');
  const [payDate, setPayDate] = useState('');

  const load = useCallback(async () => {
    try { setDetail(await payrollApi.run(runId)); } catch (e: any) { setError(e.message); }
  }, [runId]);

  useEffect(() => { load(); }, [load]);

  const act = async (fn: () => Promise<unknown>, success?: string) => {
    setBusy(true); setError(null); setNotice(null);
    try { await fn(); if (success) setNotice(success); await load(); } catch (e: any) { setError(e.message); } finally { setBusy(false); }
  };

  if (!detail) {
    return <div className="p-6 text-xs text-gray-600">{error ? <span className="text-red-600">{error}</span> : 'Loading…'}</div>;
  }
  const { run, items, statutory_totals: totals } = detail;
  const isDraft = run.status === 'draft';

  const openEdit = (it: RunItem) => {
    setEditItem(it);
    setEdit({ unpaid_days: String(Number(it.unpaid_days)), extra_earnings: String(Number(it.extra_earnings)), extra_deductions: String(Number(it.extra_deductions)) });
  };

  const saveEdit = async () => {
    if (!editItem) return;
    await act(() => payrollApi.updateRunItem(run.id, editItem.id, edit));
    setEditItem(null);
  };

  const openPay = async () => {
    setPayDate(String(run.pay_date).slice(0, 10));
    try {
      const a = await payrollApi.accounts();
      setPayAccounts(a.payment);
      setPayAccount(a.payment[0] ? String(a.payment[0].id) : '');
      setPayOpen(true);
    } catch (e: any) { setError(e.message); }
  };

  const confirmPay = async () => {
    await act(() => payrollApi.pay(run.id, { payment_account_id: Number(payAccount), pay_date: payDate }), 'Payroll paid and posted to the ledger.');
    setPayOpen(false);
  };

  const remove = async () => {
    const msg = isDraft ? 'Delete this draft payroll run?' : 'Cancel this approved payroll run?';
    if (!window.confirm(msg)) return;
    setBusy(true);
    try { await payrollApi.deleteRun(run.id); navigate('/payroll-runs'); } catch (e: any) { setError(e.message); setBusy(false); }
  };

  const openPayslip = async (staffId: number) => {
    try { setPayslip(await payrollApi.payslip(run.id, staffId)); } catch (e: any) { setError(e.message); }
  };

  const printPayslip = () => {
    const node = document.getElementById('payslip-print');
    if (!node) return;
    const w = window.open('', '_blank', 'width=800,height=900');
    if (!w) { setError('Allow pop-ups to print payslips'); return; }
    w.document.write(`<html><head><title>Payslip</title><style>
      body{font-family:Arial,sans-serif;padding:24px;font-size:12px;color:#111}
      table{width:100%;border-collapse:collapse}.text-right{text-align:right}
      .grid{display:grid}.grid-cols-2{grid-template-columns:1fr 1fr}.text-center{text-align:center}
      .font-bold,.font-semibold{font-weight:bold}.border-t{border-top:1px solid #999}.border-b{border-bottom:1px solid #999}
      .flex{display:flex}.justify-between{justify-content:space-between}.mb-1{margin-bottom:4px}.mb-3{margin-bottom:12px}.mt-2{margin-top:8px}.mt-3{margin-top:12px}
      .py-1{padding:4px 0}.py-2{padding:8px 0}.gap-6{gap:24px}.gap-x-6{column-gap:24px}.text-gray-500,.text-gray-600{color:#666}.text-sm{font-size:14px}.text-\\[10px\\]{font-size:10px}
    </style></head><body>${node.outerHTML}</body></html>`);
    w.document.close();
    w.focus();
    w.print();
  };

  const stepper = ['draft', 'approved', 'paid'];

  return (
    <div className="min-h-screen bg-gray-50 py-4 px-4">
      <div className="max-w-7xl mx-auto space-y-4">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
          <div>
            <Link to="/payroll-runs" className="inline-flex items-center text-[10px] text-gray-500 hover:text-gray-700 mb-1.5">
              <ArrowLeft className="w-3 h-3 mr-1" /> All payroll runs
            </Link>
            <h1 className="text-sm font-bold text-gray-900 flex items-center gap-2">Payroll — {periodLabel(run)} {statusBadge(run.status)}</h1>
            <p className="text-xs text-gray-600">Pay date {String(run.pay_date).slice(0, 10)} · {run.employee_count} employees{run.journal_entry_id ? ` · journal entry #${run.journal_entry_id}` : ''}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            {isDraft && <button disabled={busy} onClick={() => act(() => payrollApi.recalculate(run.id), 'Recalculated with the latest salaries, rules and loans.')} className="px-3 py-1.5 text-xs border border-gray-300 rounded bg-white hover:bg-gray-50">Recalculate</button>}
            {isDraft && <button disabled={busy} onClick={() => act(() => payrollApi.approve(run.id), 'Run approved.')} className="px-3 py-1.5 text-xs text-white bg-blue-600 hover:bg-blue-700 rounded">Approve</button>}
            {run.status === 'approved' && <button disabled={busy} onClick={() => act(() => payrollApi.reopen(run.id), 'Run re-opened for editing.')} className="px-3 py-1.5 text-xs border border-gray-300 rounded bg-white hover:bg-gray-50">Re-open</button>}
            {run.status === 'approved' && <button disabled={busy} onClick={openPay} className="px-3 py-1.5 text-xs text-white bg-green-600 hover:bg-green-700 rounded">Mark as paid…</button>}
            {(isDraft || run.status === 'approved') && <button disabled={busy} onClick={remove} className="px-3 py-1.5 text-xs text-red-700 border border-red-200 rounded bg-white hover:bg-red-50">{isDraft ? 'Delete' : 'Cancel run'}</button>}
          </div>
        </div>

        {run.status !== 'cancelled' && (
          <div className="flex items-center gap-2 text-[10px] text-gray-500">
            {stepper.map((s, i) => (
              <React.Fragment key={s}>
                <span className={`px-2 py-0.5 rounded-full border capitalize ${stepper.indexOf(run.status) >= i ? 'bg-gray-800 text-white border-gray-800' : 'bg-white'}`}>{s}</span>
                {i < stepper.length - 1 && <span>→</span>}
              </React.Fragment>
            ))}
          </div>
        )}

        {error && <div className="text-xs text-red-700 bg-red-50 border border-red-200 rounded p-2.5">{error}</div>}
        {notice && <div className="text-xs text-green-700 bg-green-50 border border-green-200 rounded p-2.5">{notice}</div>}

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[['Gross pay', run.total_gross], ['Total deductions', run.total_deductions], ['Net pay', run.total_net], ['Total employer cost', run.total_employer_cost]].map(([t, v]) => (
            <div key={String(t)} className="bg-white rounded-lg shadow-sm p-3"><div className="text-[10px] text-gray-500">{t}</div><div className="text-sm font-semibold text-gray-900">{kes(v as number)}</div></div>
          ))}
        </div>

        <div className="bg-white rounded-lg shadow-sm overflow-x-auto">
          <table className="min-w-full text-xs">
            <thead className="bg-gray-50 text-[9px] uppercase tracking-wider text-gray-500">
              <tr>
                {['Employee', 'Basic', 'Allowances', 'Extra', 'Gross', 'PAYE', 'Other statutory', 'Other ded.', 'Loans', 'Net pay', ''].map((h) => <th key={h} className="px-3 py-2 text-left font-medium whitespace-nowrap">{h}</th>)}
              </tr>
            </thead>
            <tbody className="divide-y">
              {items.map((it) => (
                <tr key={it.id} className="hover:bg-gray-50">
                  <td className="px-3 py-2 font-medium text-gray-900 whitespace-nowrap">
                    {it.staff_name}
                    {Number(it.unpaid_days) > 0 && <div className="text-[10px] text-amber-600">{Number(it.unpaid_days)} unpaid days</div>}
                    {it.warning && <div className="text-[10px] text-red-600">{it.warning}</div>}
                  </td>
                  <td className="px-3 py-2">{kes(it.basic_salary)}</td>
                  <td className="px-3 py-2">{kes(it.allowances_total)}</td>
                  <td className="px-3 py-2">{kes(Number(it.extra_earnings))}</td>
                  <td className="px-3 py-2">{kes(it.gross_pay)}</td>
                  <td className="px-3 py-2">{kes(it.paye)}</td>
                  <td className="px-3 py-2">{kes(Number(it.statutory_employee) - Number(it.paye))}</td>
                  <td className="px-3 py-2">{kes(it.other_deductions)}</td>
                  <td className="px-3 py-2">{kes(it.loan_deductions)}</td>
                  <td className="px-3 py-2 font-semibold">{kes(it.net_pay)}</td>
                  <td className="px-3 py-2 whitespace-nowrap text-right">
                    <button onClick={() => openPayslip(it.staff_id)} title="Payslip" className="text-gray-400 hover:text-red-600 mr-2"><FileText className="w-3.5 h-3.5 inline" /></button>
                    {isDraft && <button onClick={() => openEdit(it)} title="Adjust" className="text-gray-400 hover:text-red-600 mr-2"><Pencil className="w-3.5 h-3.5 inline" /></button>}
                    {isDraft && <button onClick={() => window.confirm(`Remove ${it.staff_name} from this run?`) && act(() => payrollApi.removeRunItem(run.id, it.id))} title="Remove from run" className="text-gray-400 hover:text-red-600"><Trash2 className="w-3.5 h-3.5 inline" /></button>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div className="bg-white rounded-lg shadow-sm p-4">
            <h2 className="text-xs font-semibold text-gray-900 mb-2">Statutory remittances</h2>
            <table className="w-full text-xs">
              <thead className="text-[9px] uppercase text-gray-500"><tr><th className="text-left">Deduction</th><th className="text-right">Employee</th><th className="text-right">Employer</th><th className="text-right">Total due</th><th /></tr></thead>
              <tbody>
                {totals.filter((t) => t.employee > 0 || t.employer > 0).map((t) => (
                  <tr key={t.code} className="border-t">
                    <td className="py-1">{t.name}</td>
                    <td className="py-1 text-right">{kes(t.employee)}</td>
                    <td className="py-1 text-right">{kes(t.employer)}</td>
                    <td className="py-1 text-right font-medium">{kes(t.employee + t.employer)}</td>
                    <td className="py-1 text-right"><button title={`Download ${t.code} schedule`} onClick={() => payrollApi.download(run.id, `statutory:${t.code}`).catch((e) => setError(e.message))} className="text-gray-400 hover:text-red-600"><Download className="w-3.5 h-3.5" /></button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="bg-white rounded-lg shadow-sm p-4">
            <h2 className="text-xs font-semibold text-gray-900 mb-2">Exports (CSV)</h2>
            <div className="flex flex-wrap gap-2">
              <button onClick={() => payrollApi.download(run.id, 'summary').catch((e) => setError(e.message))} className="px-3 py-1.5 text-xs border border-gray-300 rounded hover:bg-gray-50">Payroll summary</button>
              <button onClick={() => payrollApi.download(run.id, 'bank').catch((e) => setError(e.message))} className="px-3 py-1.5 text-xs border border-gray-300 rounded hover:bg-gray-50">Bank payment schedule</button>
            </div>
            <p className="text-[11px] text-gray-500 mt-2">Statutory schedules (PAYE, NSSF, SHIF, Housing Levy…) use the download icon next to each deduction and include KRA PIN / NSSF / SHIF numbers from the staff payroll setup.</p>
          </div>
        </div>
      </div>

      {editItem && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 z-50 flex items-start justify-center overflow-y-auto">
          <div className="mt-16 w-11/12 max-w-md bg-white rounded-md shadow-lg p-4 space-y-3">
            <div className="flex justify-between"><h3 className="text-xs font-semibold">Adjust — {editItem.staff_name}</h3><button onClick={() => setEditItem(null)}><X className="w-4 h-4 text-gray-400" /></button></div>
            <div><label className="block text-[10px] text-gray-700 mb-1">Unpaid days (deducted from basic)</label><input type="number" min="0" step="0.5" className={input} value={edit.unpaid_days} onChange={(e) => setEdit({ ...edit, unpaid_days: e.target.value })} /></div>
            <div><label className="block text-[10px] text-gray-700 mb-1">Bonus / overtime (taxable)</label><input type="number" min="0" step="0.01" className={input} value={edit.extra_earnings} onChange={(e) => setEdit({ ...edit, extra_earnings: e.target.value })} /></div>
            <div><label className="block text-[10px] text-gray-700 mb-1">One-off deduction</label><input type="number" min="0" step="0.01" className={input} value={edit.extra_deductions} onChange={(e) => setEdit({ ...edit, extra_deductions: e.target.value })} /></div>
            <div className="flex justify-end gap-2">
              <button onClick={() => setEditItem(null)} className="px-3 py-1.5 text-xs bg-gray-100 border border-gray-300 rounded">Cancel</button>
              <button onClick={saveEdit} disabled={busy} className="px-3 py-1.5 text-xs text-white bg-red-600 hover:bg-red-700 rounded">Save &amp; recalculate</button>
            </div>
          </div>
        </div>
      )}

      {payOpen && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 z-50 flex items-start justify-center overflow-y-auto">
          <div className="mt-16 w-11/12 max-w-md bg-white rounded-md shadow-lg p-4 space-y-3">
            <div className="flex justify-between"><h3 className="text-xs font-semibold">Pay {periodLabel(run)} payroll</h3><button onClick={() => setPayOpen(false)}><X className="w-4 h-4 text-gray-400" /></button></div>
            <p className="text-xs text-gray-600">This posts one journal entry for {kes(run.total_net)} net pay plus statutory liabilities, and reduces loan balances. It cannot be undone.</p>
            <div>
              <label className="block text-[10px] text-gray-700 mb-1">Pay from (cash / bank account)</label>
              <select className={input} value={payAccount} onChange={(e) => setPayAccount(e.target.value)}>
                {payAccounts.length === 0 && <option value="">No cash/bank accounts found</option>}
                {payAccounts.map((a) => <option key={a.id} value={a.id}>{a.account_code} - {a.account_name}</option>)}
              </select>
            </div>
            <div><label className="block text-[10px] text-gray-700 mb-1">Payment date</label><input type="date" className={input} value={payDate} onChange={(e) => setPayDate(e.target.value)} /></div>
            <div className="flex justify-end gap-2">
              <button onClick={() => setPayOpen(false)} className="px-3 py-1.5 text-xs bg-gray-100 border border-gray-300 rounded">Cancel</button>
              <button onClick={confirmPay} disabled={busy || !payAccount} className="px-3 py-1.5 text-xs text-white bg-green-600 hover:bg-green-700 rounded disabled:opacity-50">Confirm payment</button>
            </div>
          </div>
        </div>
      )}

      {payslip && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 z-50 flex items-start justify-center overflow-y-auto">
          <div className="mt-10 mb-10 w-11/12 max-w-2xl bg-white rounded-md shadow-lg p-5">
            <div className="flex justify-end gap-3 mb-2">
              <button onClick={printPayslip} className="inline-flex items-center text-xs text-gray-700 hover:text-red-600"><Printer className="w-3.5 h-3.5 mr-1" /> Print</button>
              <button onClick={() => setPayslip(null)}><X className="w-4 h-4 text-gray-400" /></button>
            </div>
            <PayslipView data={payslip} />
          </div>
        </div>
      )}
    </div>
  );
};

export default PayrollRunDetailPage;
