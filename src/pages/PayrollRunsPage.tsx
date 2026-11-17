import React, { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowLeft, Plus } from 'lucide-react';
import { payrollApi, kes, periodLabel, MONTHS, PayrollRun } from '../services/payrollService';

export const statusBadge = (status: PayrollRun['status']) => {
  const styles: Record<string, string> = {
    draft: 'bg-amber-100 text-amber-800 border-amber-200',
    approved: 'bg-blue-100 text-blue-800 border-blue-200',
    paid: 'bg-green-100 text-green-800 border-green-200',
    cancelled: 'bg-gray-100 text-gray-600 border-gray-200',
  };
  return <span className={`inline-flex px-1.5 py-0.5 text-[10px] font-medium rounded-full border capitalize ${styles[status]}`}>{status}</span>;
};

const PayrollRunsPage: React.FC = () => {
  const navigate = useNavigate();
  const now = new Date();
  const [runs, setRuns] = useState<PayrollRun[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year, setYear] = useState(now.getFullYear());
  const [payDate, setPayDate] = useState(new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().slice(0, 10));
  const [notes, setNotes] = useState('');
  const [creating, setCreating] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try { setRuns(await payrollApi.runs()); } catch (e: any) { setError(e.message); } finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const create = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreating(true); setError(null);
    try {
      const { id } = await payrollApi.createRun({ year, month, pay_date: payDate, notes });
      navigate(`/payroll-runs/${id}`);
    } catch (err: any) { setError(err.message); } finally { setCreating(false); }
  };

  const input = 'px-2.5 py-1.5 text-xs border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-red-500';

  return (
    <div className="min-h-screen bg-gray-50 py-4 px-4">
      <div className="max-w-6xl mx-auto space-y-4">
        <div>
          <Link to="/payroll-management" className="inline-flex items-center text-[10px] text-gray-500 hover:text-gray-700 mb-1.5">
            <ArrowLeft className="w-3 h-3 mr-1" /> Back to Payroll
          </Link>
          <h1 className="text-sm font-bold text-gray-900">Payroll Runs</h1>
          <p className="text-xs text-gray-600">Create a monthly payroll, review and adjust it, approve it, then pay it to post to the ledger.</p>
        </div>

        {error && <div className="text-xs text-red-700 bg-red-50 border border-red-200 rounded p-2.5">{error}</div>}

        <form onSubmit={create} className="bg-white rounded-lg shadow-sm p-4 flex flex-wrap items-end gap-3">
          <div>
            <div className="text-[10px] font-medium text-gray-700 mb-1">Month</div>
            <select className={input} value={month} onChange={(e) => setMonth(Number(e.target.value))}>
              {MONTHS.map((m, i) => <option key={m} value={i + 1}>{m}</option>)}
            </select>
          </div>
          <div>
            <div className="text-[10px] font-medium text-gray-700 mb-1">Year</div>
            <input type="number" className={`${input} w-24`} value={year} onChange={(e) => setYear(Number(e.target.value))} />
          </div>
          <div>
            <div className="text-[10px] font-medium text-gray-700 mb-1">Pay date</div>
            <input type="date" className={input} value={payDate} onChange={(e) => setPayDate(e.target.value)} required />
          </div>
          <div className="flex-1 min-w-[160px]">
            <div className="text-[10px] font-medium text-gray-700 mb-1">Notes</div>
            <input className={`${input} w-full`} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="optional" />
          </div>
          <button type="submit" disabled={creating} className="inline-flex items-center px-3 py-1.5 text-xs font-medium text-white bg-red-600 hover:bg-red-700 rounded disabled:opacity-50">
            <Plus className="w-3 h-3 mr-1" /> {creating ? 'Creating…' : 'Create payroll run'}
          </button>
        </form>

        <div className="bg-white rounded-lg shadow-sm overflow-x-auto">
          <table className="min-w-full text-xs">
            <thead className="bg-gray-50 text-[9px] uppercase tracking-wider text-gray-500">
              <tr>{['Period', 'Pay date', 'Staff', 'Gross', 'Deductions', 'Net pay', 'Employer cost', 'Status'].map((h) => <th key={h} className="px-3 py-2 text-left font-medium">{h}</th>)}</tr>
            </thead>
            <tbody className="divide-y">
              {loading ? <tr><td colSpan={8} className="p-4 text-gray-500">Loading…</td></tr>
                : runs.length === 0 ? <tr><td colSpan={8} className="p-4 text-gray-500">No payroll runs yet. Create the first one above.</td></tr>
                : runs.map((r) => (
                  <tr key={r.id} className="hover:bg-gray-50 cursor-pointer" onClick={() => navigate(`/payroll-runs/${r.id}`)}>
                    <td className="px-3 py-2 font-medium text-gray-900">{periodLabel(r)}</td>
                    <td className="px-3 py-2">{String(r.pay_date).slice(0, 10)}</td>
                    <td className="px-3 py-2">{r.employee_count}</td>
                    <td className="px-3 py-2">{kes(r.total_gross)}</td>
                    <td className="px-3 py-2">{kes(r.total_deductions)}</td>
                    <td className="px-3 py-2 font-medium">{kes(r.total_net)}</td>
                    <td className="px-3 py-2">{kes(r.total_employer_cost)}</td>
                    <td className="px-3 py-2">{statusBadge(r.status)}</td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default PayrollRunsPage;
