import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, Printer } from 'lucide-react';
import { API_CONFIG } from '../config/api';
import { formatKES } from '../utils/salesRepPayroll';

const PAYROLL_API_BASE = API_CONFIG.getUrl('/payroll');

interface Payslip {
  id: number;
  sales_rep_id: number;
  sales_rep_name: string;
  sales_rep_role?: string | null;
  sales_rep_email?: string | null;
  sales_rep_phone?: string | null;
  pay_date: string;
  period_start: string;
  period_end: string;
  basic_salary: number | string;
  working_days: number;
  days_paid: number;
  gross_pay: number | string;
  total_deductions: number | string; // includes extra deductions
  net_pay: number | string;
  journal_entry_id: number | null;
  notes?: string | null;
  deductions: { name: string; account: string; amount: number }[];
  extra_deductions: { reference: string; amount: number; date: string }[];
  advance_recoveries: { reference: string; amount: number; date: string; advance_amount: number; balance: number }[];
}

const getAuthHeaders = () => {
  const token = localStorage.getItem('token');
  return token ? { Authorization: `Bearer ${token}` } : {};
};

const fmtDate = (d: string) => {
  const date = new Date(String(d).length === 10 ? `${d}T00:00:00` : d);
  return isNaN(date.getTime()) ? d : date.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
};

const Row: React.FC<{ label: React.ReactNode; hint?: string; value: string; tone?: string; bold?: boolean }> = ({
  label, hint, value, tone = 'text-gray-900', bold,
}) => (
  <div className="flex items-start justify-between gap-4 py-2 border-b border-gray-100 last:border-0">
    <div>
      <div className={`text-sm ${bold ? 'font-semibold' : ''} text-gray-800`}>{label}</div>
      {hint && <div className="text-[11px] text-gray-400">{hint}</div>}
    </div>
    <div className={`text-sm whitespace-nowrap ${bold ? 'font-semibold' : ''} ${tone}`}>{value}</div>
  </div>
);

const SalesRepPayslipPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const [slip, setSlip] = useState<Payslip | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    axios
      .get(`${PAYROLL_API_BASE}/sales-reps-history/${id}`, { headers: getAuthHeaders() })
      .then(res => {
        if (res.data?.success) setSlip(res.data.data);
        else setError(res.data?.error || 'Failed to load payslip');
      })
      .catch((err: any) => setError(err.response?.data?.error || err.message || 'Failed to load payslip'))
      .finally(() => setLoading(false));
  }, [id]);

  const extraTotal = slip ? slip.extra_deductions.reduce((s, e) => s + e.amount, 0) : 0;
  const advanceTotal = slip ? slip.advance_recoveries.reduce((s, a) => s + a.amount, 0) : 0;
  const regularTotal = slip ? Number(slip.total_deductions) - extraTotal - advanceTotal : 0;

  return (
    <div className="min-h-screen bg-gray-50 print:bg-white">
      <div className="max-w-3xl mx-auto px-4 py-6 print:p-0 print:max-w-none">
        <div className="flex items-center justify-between mb-3 print:hidden">
          <Link to="/sales-rep-payroll/history" className="inline-flex items-center text-xs text-gray-500 hover:text-gray-800">
            <ArrowLeft className="w-3.5 h-3.5 mr-1" /> Back to Payroll History
          </Link>
          {slip && (
            <button
              onClick={() => window.print()}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white bg-red-600 rounded-md hover:bg-red-700"
            >
              <Printer className="w-3.5 h-3.5" /> Print
            </button>
          )}
        </div>

        {loading ? (
          <div className="py-20 text-center text-sm text-gray-500">Loading payslip…</div>
        ) : error || !slip ? (
          <div className="px-4 py-3 text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg">{error || 'Payslip not found'}</div>
        ) : (
          <div className="bg-white border border-gray-200 rounded-xl overflow-hidden print:border-0 print:rounded-none">
            {/* Header */}
            <div className="px-6 py-5 bg-red-600 text-white print:bg-white print:text-gray-900 print:border-b-2 print:border-gray-800">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h1 className="text-xl font-bold tracking-wide">PAYSLIP</h1>
                  <p className="text-xs opacity-80">Sales representative payroll</p>
                </div>
                <div className="text-right text-xs">
                  <div className="opacity-80">Pay date</div>
                  <div className="font-semibold text-sm">{fmtDate(slip.pay_date)}</div>
                </div>
              </div>
            </div>

            {/* Employee + period */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 px-6 py-5 border-b border-gray-200">
              <div>
                <div className="text-[10px] uppercase tracking-wider text-gray-400 mb-1">Employee</div>
                <div className="text-sm font-semibold text-gray-900">{slip.sales_rep_name}</div>
                <div className="text-xs text-gray-500 capitalize">{slip.sales_rep_role || 'Sales representative'}</div>
                {slip.sales_rep_email && <div className="text-xs text-gray-500">{slip.sales_rep_email}</div>}
                {slip.sales_rep_phone && <div className="text-xs text-gray-500">{slip.sales_rep_phone}</div>}
              </div>
              <div className="sm:text-right">
                <div className="text-[10px] uppercase tracking-wider text-gray-400 mb-1">Pay period</div>
                <div className="text-sm font-semibold text-gray-900">{fmtDate(slip.period_start)} – {fmtDate(slip.period_end)}</div>
                <div className="text-xs text-gray-500">{slip.days_paid} of {slip.working_days} working days paid</div>
                {slip.journal_entry_id && <div className="text-xs text-gray-400">Journal entry #{slip.journal_entry_id}</div>}
              </div>
            </div>

            <div className="px-6 py-5 space-y-6">
              {/* Earnings */}
              <section>
                <h2 className="text-xs font-semibold uppercase tracking-wider text-gray-500 mb-1">Earnings</h2>
                <Row label="Basic salary" value={formatKES(Number(slip.basic_salary))} />
                <Row
                  label="Gross pay"
                  hint={`Prorated: ${slip.days_paid}/${slip.working_days} days`}
                  value={formatKES(Number(slip.gross_pay))}
                  bold
                />
              </section>

              {/* Deductions */}
              <section>
                <h2 className="text-xs font-semibold uppercase tracking-wider text-gray-500 mb-1">Deductions</h2>
                {slip.deductions.length === 0 && slip.extra_deductions.length === 0 && slip.advance_recoveries.length === 0 ? (
                  <div className="py-2 text-sm text-gray-400">No deductions or extra deductions for this pay period</div>
                ) : (
                  <>
                    {slip.deductions.map((d, i) => (
                      <Row key={`d-${i}`} label={d.name} hint={d.account} value={`- ${formatKES(d.amount)}`} tone="text-red-600" />
                    ))}
                    {slip.extra_deductions.map((e, i) => (
                      <Row
                        key={`e-${i}`}
                        label={`Staff deduction: ${e.reference}`}
                        hint={`Posted ${fmtDate(e.date)}`}
                        value={`- ${formatKES(e.amount)}`}
                        tone="text-red-600"
                      />
                    ))}
                    {slip.advance_recoveries.map((a, i) => (
                      <Row
                        key={`a-${i}`}
                        label={`Salary advance recovery: ${a.reference}`}
                        hint={`Advance of ${formatKES(a.advance_amount)} given ${fmtDate(a.date)}`}
                        value={`- ${formatKES(a.amount)}`}
                        tone="text-red-600"
                      />
                    ))}
                  </>
                )}
                {/* Totals */}
                <Row label="Regular deductions" value={formatKES(regularTotal)} />
                <Row
                  label="Extra deductions"
                  value={formatKES(extraTotal)}
                  tone={extraTotal > 0 ? 'text-gray-900' : 'text-gray-400'}
                />
                <Row
                  label="Salary advance recovery"
                  value={formatKES(advanceTotal)}
                  tone={advanceTotal > 0 ? 'text-gray-900' : 'text-gray-400'}
                />
                <Row label="Total deductions" value={`- ${formatKES(Number(slip.total_deductions))}`} tone="text-red-600" bold />
              </section>

              {/* Net */}
              <div className="flex items-center justify-between rounded-lg bg-green-50 border border-green-200 px-4 py-3 print:bg-white print:border-gray-800">
                <span className="text-sm font-semibold text-gray-900">Net pay</span>
                <span className="text-xl font-bold text-green-700">{formatKES(Number(slip.net_pay))}</span>
              </div>

              {slip.notes && <p className="text-xs text-gray-500">Notes: {slip.notes}</p>}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default SalesRepPayslipPage;
