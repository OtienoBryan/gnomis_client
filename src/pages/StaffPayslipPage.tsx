import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, Mail, Printer } from 'lucide-react';
import { API_CONFIG } from '../config/api';
import { formatKES } from '../utils/salesRepPayroll';

const PAYROLL_API_BASE = API_CONFIG.getUrl('/payroll');

interface Payslip {
  id: number;
  staff_name: string;
  staff_role?: string | null;
  staff_designation?: string | null;
  staff_department?: string | null;
  staff_empl_no?: string | null;
  staff_email?: string | null;
  staff_phone?: string | null;
  pay_date: string;
  period_start: string;
  period_end: string;
  basic_salary: number | string;
  working_days: number;
  days_paid: number | string;
  gross_pay: number | string;
  total_deductions: number | string;
  net_pay: number | string;
  journal_entry_id: number | null;
  notes?: string | null;
  deductions: { name: string; account: string; amount: number }[];
}

const getAuthHeaders = () => {
  const token = localStorage.getItem('token');
  return token ? { Authorization: `Bearer ${token}` } : {};
};

const fmtDate = (d: string) => {
  const date = new Date(`${String(d).slice(0, 10)}T00:00:00`);
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

const StaffPayslipPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const [slip, setSlip] = useState<Payslip | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [emailNotice, setEmailNotice] = useState<{ ok: boolean; text: string } | null>(null);

  const emailPayslip = async () => {
    if (!slip) return;
    if (!slip.staff_email) {
      setEmailNotice({ ok: false, text: 'This employee has no personal email. Add it under Edit Staff > Personal Email.' });
      return;
    }
    if (!window.confirm(`Email this payslip as a PDF to ${slip.staff_email}?`)) return;
    setSending(true);
    setEmailNotice(null);
    try {
      await axios.post(`${PAYROLL_API_BASE}/staff-pay/history/${slip.id}/email`, {}, { headers: getAuthHeaders() });
      setEmailNotice({ ok: true, text: `Payslip sent to ${slip.staff_email}.` });
    } catch (err: any) {
      setEmailNotice({ ok: false, text: err.response?.data?.error || err.message || 'Failed to send payslip' });
    } finally {
      setSending(false);
    }
  };

  useEffect(() => {
    setLoading(true);
    axios
      .get(`${PAYROLL_API_BASE}/staff-pay/history/${id}`, { headers: getAuthHeaders() })
      .then(res => {
        if (res.data?.success) setSlip(res.data.data);
        else setError(res.data?.error || 'Failed to load payslip');
      })
      .catch((err: any) => setError(err.response?.data?.error || err.message || 'Failed to load payslip'))
      .finally(() => setLoading(false));
  }, [id]);

  return (
    <div className="min-h-screen bg-gray-50 print:bg-white">
      <div className="max-w-3xl mx-auto px-4 py-6 print:p-0 print:max-w-none">
        <div className="flex items-center justify-between mb-3 print:hidden">
          <Link to="/payroll-management/history" className="inline-flex items-center text-xs text-gray-500 hover:text-gray-800">
            <ArrowLeft className="w-3.5 h-3.5 mr-1" /> Back to Payroll History
          </Link>
          {slip && (
            <div className="flex items-center gap-2">
              <button onClick={emailPayslip} disabled={sending} className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50">
                <Mail className="w-3.5 h-3.5" /> {sending ? 'Sending…' : 'Email payslip'}
              </button>
              <button onClick={() => window.print()} className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white bg-red-600 rounded-md hover:bg-red-700">
                <Printer className="w-3.5 h-3.5" /> Print
              </button>
            </div>
          )}
        </div>
        {emailNotice && (
          <div className={`mb-3 px-3 py-2 text-xs rounded-md border print:hidden ${emailNotice.ok ? 'bg-green-50 text-green-800 border-green-200' : 'bg-red-50 text-red-700 border-red-200'}`}>
            {emailNotice.text}
          </div>
        )}

        {loading ? (
          <div className="py-20 text-center text-sm text-gray-500">Loading payslip…</div>
        ) : error || !slip ? (
          <div className="px-4 py-3 text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg">{error || 'Payslip not found'}</div>
        ) : (
          <div className="bg-white border border-gray-200 rounded-xl overflow-hidden print:border-0 print:rounded-none">
            <div className="px-6 py-5 bg-red-600 text-white print:bg-white print:text-gray-900 print:border-b-2 print:border-gray-800">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h1 className="text-xl font-bold tracking-wide">PAYSLIP</h1>
                  <p className="text-xs opacity-80">Staff payroll</p>
                </div>
                <div className="text-right text-xs">
                  <div className="opacity-80">Pay date</div>
                  <div className="font-semibold text-sm">{fmtDate(slip.pay_date)}</div>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 px-6 py-5 border-b border-gray-200">
              <div>
                <div className="text-[10px] uppercase tracking-wider text-gray-400 mb-1">Employee</div>
                <div className="text-sm font-semibold text-gray-900">{slip.staff_name}</div>
                <div className="text-xs text-gray-500 capitalize">{slip.staff_designation || slip.staff_role || 'Staff'}</div>
                {slip.staff_department && <div className="text-xs text-gray-500">{slip.staff_department}</div>}
                {slip.staff_empl_no && <div className="text-xs text-gray-500">Employee # {slip.staff_empl_no}</div>}
                {slip.staff_email && <div className="text-xs text-gray-500">{slip.staff_email}</div>}
              </div>
              <div className="sm:text-right">
                <div className="text-[10px] uppercase tracking-wider text-gray-400 mb-1">Pay period</div>
                <div className="text-sm font-semibold text-gray-900">{fmtDate(slip.period_start)} – {fmtDate(slip.period_end)}</div>
                <div className="text-xs text-gray-500">{Number(slip.days_paid)} of {slip.working_days} working days paid</div>
                {slip.journal_entry_id && <div className="text-xs text-gray-400">Journal entry #{slip.journal_entry_id}</div>}
              </div>
            </div>

            <div className="px-6 py-5 space-y-6">
              <section>
                <h2 className="text-xs font-semibold uppercase tracking-wider text-gray-500 mb-1">Earnings</h2>
                <Row label="Basic salary" value={formatKES(Number(slip.basic_salary))} />
                <Row label="Gross pay" hint={`Prorated: ${Number(slip.days_paid)}/${slip.working_days} days`} value={formatKES(Number(slip.gross_pay))} bold />
              </section>

              <section>
                <h2 className="text-xs font-semibold uppercase tracking-wider text-gray-500 mb-1">Deductions</h2>
                {slip.deductions.length === 0 ? (
                  <div className="py-2 text-sm text-gray-400">No deductions for this pay period</div>
                ) : (
                  slip.deductions.map((d, i) => (
                    <Row key={i} label={d.name} hint={d.account} value={`- ${formatKES(d.amount)}`} tone="text-red-600" />
                  ))
                )}
                <Row label="Total deductions" value={`- ${formatKES(Number(slip.total_deductions))}`} tone="text-red-600" bold />
              </section>

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

export default StaffPayslipPage;
