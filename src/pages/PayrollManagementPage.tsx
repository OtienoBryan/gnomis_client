import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { API_CONFIG } from '../config/api';
import { salesService } from '../services/salesService';
import {
  SearchIcon,
  UsersIcon,
  WalletIcon,
  CalendarIcon,
  SlidersIcon,
  XIcon,
  PlayIcon,
  HistoryIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
} from 'lucide-react';

interface StaffItem {
  id: number;
  name: string;
  role?: string;
  salary?: number | null;
}

const API_BASE = API_CONFIG.getUrl('/payroll');
const authHeaders = () => ({ Authorization: `Bearer ${localStorage.getItem('token')}` });

/* ---------- helpers ---------- */

const money = (n: number) =>
  `KES ${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const fmtDate = (d: string) =>
  new Date(d).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });

// Estimates only (Kenya context) - the server computes the final figures when payroll is run
function calculateDeductions(gross: number) {
  const paye = gross <= 24000 ? 0 : gross <= 32333 ? (gross - 24000) * 0.25 : 8333 * 0.25 + (gross - 32333) * 0.3;
  const nssf = Math.min(gross * 0.06, 1080);
  const nhif = gross < 6000 ? 150 : gross < 8000 ? 300 : gross < 12000 ? 400 : 500;
  const total = paye + nssf + nhif;
  return { paye, nssf, nhif, total, net: gross - total };
}

const monthRange = () => {
  const now = new Date();
  const iso = (d: Date) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  return {
    start: iso(new Date(now.getFullYear(), now.getMonth(), 1)),
    end: iso(new Date(now.getFullYear(), now.getMonth() + 1, 0)),
  };
};

/* ---------- small building blocks ---------- */

const StatCard: React.FC<{
  label: string;
  value: string;
  hint?: string;
  icon: React.ReactNode;
  tone: string;
}> = ({ label, value, hint, icon, tone }) => (
  <div className="bg-white rounded-xl border border-gray-200 p-4 flex items-start gap-3">
    <div className={`p-2.5 rounded-lg ${tone}`}>{icon}</div>
    <div className="min-w-0">
      <div className="text-xs text-gray-500">{label}</div>
      <div className="text-lg font-semibold text-gray-900 truncate">{value}</div>
      {hint && <div className="text-[11px] text-gray-400 mt-0.5">{hint}</div>}
    </div>
  </div>
);

const Spinner: React.FC<{ className?: string }> = ({ className = 'h-4 w-4' }) => (
  <svg className={`animate-spin ${className}`} xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
  </svg>
);

const EmptyState: React.FC<{ title: string; text: string }> = ({ title, text }) => (
  <div className="text-center py-14">
    <div className="w-12 h-12 mx-auto mb-3 bg-gray-100 rounded-full flex items-center justify-center">
      <WalletIcon className="h-5 w-5 text-gray-400" />
    </div>
    <h3 className="text-sm font-medium text-gray-900">{title}</h3>
    <p className="text-xs text-gray-500 mt-1">{text}</p>
  </div>
);

/** Right-hand slide-over panel */
const Drawer: React.FC<{
  title: string;
  subtitle?: string;
  onClose: () => void;
  widthClass?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
}> = ({ title, subtitle, onClose, widthClass = 'max-w-3xl', children, footer }) => {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 flex justify-end" role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-gray-900/40" onClick={onClose} />
      <div className={`relative bg-white w-full ${widthClass} h-full shadow-2xl flex flex-col`}>
        <div className="flex items-start justify-between gap-4 px-5 py-4 border-b border-gray-200">
          <div>
            <h2 className="text-base font-semibold text-gray-900">{title}</h2>
            {subtitle && <p className="text-xs text-gray-500 mt-0.5">{subtitle}</p>}
          </div>
          <button
            onClick={onClose}
            aria-label="Close"
            className="p-1.5 rounded-lg text-gray-500 hover:bg-gray-100"
          >
            <XIcon className="h-4 w-4" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto">{children}</div>
        {footer && <div className="border-t border-gray-200 px-5 py-3 bg-white">{footer}</div>}
      </div>
    </div>
  );
};

/** Payment history list with its own search + date filters */
const HistoryPanel: React.FC<{ data: any[]; loading: boolean; showStaff: boolean; emptyText: string }> = ({
  data,
  loading,
  showStaff,
  emptyText,
}) => {
  const [q, setQ] = useState('');
  const [range, setRange] = useState<{ start: string; end: string }>({ start: '', end: '' });

  const rows = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return data.filter(h => {
      if (needle && !(`${h.staff_name || ''} ${h.notes || ''}`.toLowerCase().includes(needle))) return false;
      const day = String(h.pay_date).slice(0, 10);
      if (range.start && day < range.start) return false;
      if (range.end && day > range.end) return false;
      return true;
    });
  }, [data, q, range]);

  if (loading) {
    return (
      <div className="flex items-center justify-center gap-2 py-16 text-gray-500 text-xs">
        <Spinner className="h-4 w-4 text-red-600" /> Loading payroll history...
      </div>
    );
  }
  if (data.length === 0) return <EmptyState title="No payroll history" text={emptyText} />;

  const total = rows.reduce((s, h) => s + Number(h.amount), 0);
  const staffPaid = new Set(rows.map(h => h.staff_id ?? h.staff_name)).size;
  const inputCls =
    'px-2.5 py-1.5 text-xs border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent';

  return (
    <div className="p-5 space-y-4">
      <div className={`grid gap-3 ${showStaff ? 'grid-cols-3' : 'grid-cols-2'}`}>
        <div className="rounded-xl bg-gray-50 border border-gray-200 p-3">
          <div className="text-[11px] text-gray-500">Payments</div>
          <div className="text-base font-semibold text-gray-900">{rows.length}</div>
        </div>
        <div className="rounded-xl bg-gray-50 border border-gray-200 p-3">
          <div className="text-[11px] text-gray-500">Total paid</div>
          <div className="text-base font-semibold text-gray-900">{money(total)}</div>
        </div>
        {showStaff && (
          <div className="rounded-xl bg-gray-50 border border-gray-200 p-3">
            <div className="text-[11px] text-gray-500">People paid</div>
            <div className="text-base font-semibold text-gray-900">{staffPaid}</div>
          </div>
        )}
      </div>

      <div className="flex flex-col sm:flex-row gap-2 sm:items-center">
        {showStaff && (
          <div className="relative flex-1">
            <SearchIcon className="w-3.5 h-3.5 text-gray-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
            <input
              value={q}
              onChange={e => setQ(e.target.value)}
              placeholder="Search name or notes"
              className={`${inputCls} pl-8 w-full`}
            />
          </div>
        )}
        <div className="flex items-center gap-2">
          <input type="date" value={range.start} onChange={e => setRange({ ...range, start: e.target.value })} className={inputCls} aria-label="From date" />
          <span className="text-xs text-gray-400">to</span>
          <input type="date" value={range.end} onChange={e => setRange({ ...range, end: e.target.value })} className={inputCls} aria-label="To date" />
        </div>
        <div className="flex items-center gap-1.5">
          <button onClick={() => setRange(monthRange())} className="px-2.5 py-1.5 text-xs border border-gray-300 rounded-lg hover:bg-gray-50">
            This month
          </button>
          <button
            onClick={() => { setRange({ start: '', end: '' }); setQ(''); }}
            className="px-2.5 py-1.5 text-xs text-gray-600 hover:underline"
          >
            Clear
          </button>
        </div>
      </div>

      {rows.length === 0 ? (
        <div className="text-center py-10 text-xs text-gray-500">No payments match these filters.</div>
      ) : (
        <div className="border border-gray-200 rounded-xl overflow-hidden">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-2.5 text-left text-[11px] font-medium text-gray-500 uppercase tracking-wide">Pay date</th>
                {showStaff && <th className="px-4 py-2.5 text-left text-[11px] font-medium text-gray-500 uppercase tracking-wide">Staff</th>}
                <th className="px-4 py-2.5 text-right text-[11px] font-medium text-gray-500 uppercase tracking-wide">Amount</th>
                <th className="px-4 py-2.5 text-left text-[11px] font-medium text-gray-500 uppercase tracking-wide">Notes</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {rows.map(h => (
                <tr key={h.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 text-xs text-gray-900 whitespace-nowrap">{fmtDate(h.pay_date)}</td>
                  {showStaff && (
                    <td className="px-4 py-3">
                      <span className="text-xs font-medium text-gray-900">{h.staff_name}</span>
                    </td>
                  )}
                  <td className="px-4 py-3 text-xs font-semibold text-gray-900 text-right whitespace-nowrap">{money(Number(h.amount))}</td>
                  <td className="px-4 py-3 text-xs text-gray-500 max-w-[16rem] truncate">{h.notes || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

/* ---------- page ---------- */

const PayrollManagementPage: React.FC = () => {
  const [staff, setStaff] = useState<StaffItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  // run payroll
  const [showRunPayroll, setShowRunPayroll] = useState(false);
  const [runPayrollLoading, setRunPayrollLoading] = useState(false);
  const [runPayrollResult, setRunPayrollResult] = useState<any>(null);
  const [payDate, setPayDate] = useState<string>(new Date().toISOString().slice(0, 10));
  const [selectedStaffIds, setSelectedStaffIds] = useState<number[]>([]);
  const [overrideSalaries, setOverrideSalaries] = useState<{ [id: number]: string }>({});
  const [notes, setNotes] = useState('');
  const [paymentAccounts, setPaymentAccounts] = useState<any[]>([]);
  const [selectedPaymentAccount, setSelectedPaymentAccount] = useState<string>('');

  // history
  const [showHistoryStaffId, setShowHistoryStaffId] = useState<number | null>(null);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyData, setHistoryData] = useState<any[]>([]);
  const [showAllHistory, setShowAllHistory] = useState(false);
  const [allHistoryLoading, setAllHistoryLoading] = useState(false);
  const [allHistoryData, setAllHistoryData] = useState<any[]>([]);

  useEffect(() => {
    const fetchStaff = async () => {
      setLoading(true);
      setError(null);
      try {
        // Staff come from the SalesRep table
        const reps = await salesService.getAllSalesReps();
        setStaff(
          (Array.isArray(reps) ? reps : []).map((s: any) => ({
            id: Number(s.id),
            name: s.name,
            role: s.role || 'Sales Rep',
            salary: s.basic_salary !== undefined && s.basic_salary !== null ? Number(s.basic_salary) : null,
          }))
        );
      } catch {
        setError('Failed to fetch staff');
      } finally {
        setLoading(false);
      }
    };
    fetchStaff();
  }, []);

  useEffect(() => {
    const fetchPaymentAccounts = async () => {
      try {
        const res = await fetch(`${API_BASE}/payment-accounts`, { headers: authHeaders() });
        const json = await res.json();
        if (json.success) {
          setPaymentAccounts(json.data || []);
          if (json.data && json.data.length > 0) setSelectedPaymentAccount(String(json.data[0].id));
        }
      } catch (err) {
        console.error('Failed to fetch payment accounts:', err);
      }
    };
    fetchPaymentAccounts();
  }, []);

  const fetchHistory = async (staffId: number) => {
    setHistoryLoading(true);
    setHistoryData([]);
    try {
      const res = await fetch(`${API_BASE}/history?staff_id=${staffId}`, { headers: authHeaders() });
      const json = await res.json();
      setHistoryData(json.data || []);
    } catch {
      setHistoryData([]);
    } finally {
      setHistoryLoading(false);
    }
  };

  const fetchAllHistory = async () => {
    setAllHistoryLoading(true);
    setAllHistoryData([]);
    try {
      const res = await fetch(`${API_BASE}/history`, { headers: authHeaders() });
      const json = await res.json();
      setAllHistoryData(json.data || []);
    } catch {
      setAllHistoryData([]);
    } finally {
      setAllHistoryLoading(false);
    }
  };

  const openRunPayroll = () => {
    setSelectedStaffIds(staff.map(s => s.id));
    setRunPayrollResult(null);
    setShowRunPayroll(true);
  };

  const handleRunPayroll = async (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedStaffIds.length === 0) return;
    setRunPayrollLoading(true);
    setRunPayrollResult(null);
    try {
      const body: any = { pay_date: payDate, notes, staff_ids: selectedStaffIds };
      const overrides: { [id: number]: number } = {};
      Object.entries(overrideSalaries).forEach(([id, val]) => {
        if (selectedStaffIds.includes(Number(id)) && val && !isNaN(Number(val))) overrides[Number(id)] = Number(val);
      });
      if (Object.keys(overrides).length > 0) body.overrides = overrides;
      if (selectedPaymentAccount) body.payment_account_id = Number(selectedPaymentAccount);
      const res = await fetch(`${API_BASE}/run`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders() },
        body: JSON.stringify(body),
      });
      const json = await res.json();
      setRunPayrollResult(json);
      if (json.success) {
        setShowRunPayroll(false);
        setOverrideSalaries({});
        setNotes('');
      }
    } catch {
      setRunPayrollResult({ success: false, error: 'Failed to run payroll' });
    } finally {
      setRunPayrollLoading(false);
    }
  };

  /* ----- derived data ----- */

  const roles = useMemo(
    () => Array.from(new Set(staff.map(s => s.role).filter(Boolean))) as string[],
    [staff]
  );

  const filteredStaff = useMemo(() => {
    const q = search.trim().toLowerCase();
    return staff.filter(s => {
      if (roleFilter && (s.role || '') !== roleFilter) return false;
      return !q || s.name?.toLowerCase().includes(q);
    });
  }, [staff, search, roleFilter]);

  const totalPages = Math.max(1, Math.ceil(filteredStaff.length / pageSize));
  const currentPage = Math.min(page, totalPages);
  const pageItems = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredStaff.slice(start, start + pageSize);
  }, [filteredStaff, currentPage, pageSize]);

  const totals = useMemo(() => {
    let gross = 0, ded = 0, net = 0;
    filteredStaff.forEach(s => {
      const d = calculateDeductions(s.salary ? Number(s.salary) : 0);
      gross += s.salary ? Number(s.salary) : 0;
      ded += d.total;
      net += d.net;
    });
    return { gross, ded, net };
  }, [filteredStaff]);

  const grossFor = (s: StaffItem) => {
    const o = overrideSalaries[s.id];
    return o !== undefined && o !== '' ? Number(o) : s.salary ?? 0;
  };

  const runRows = useMemo(
    () => staff.filter(s => selectedStaffIds.includes(s.id)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [staff, selectedStaffIds]
  );
  const runTotals = runRows.reduce(
    (acc, s) => {
      const gross = grossFor(s);
      const d = calculateDeductions(gross);
      return { gross: acc.gross + gross, ded: acc.ded + d.total, net: acc.net + d.net };
    },
    { gross: 0, ded: 0, net: 0 }
  );

  const historyStaff = staff.find(s => s.id === showHistoryStaffId);
  const allSelected = staff.length > 0 && selectedStaffIds.length === staff.length;
  const fieldCls =
    'w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent';

  const links = [
    { to: '/payroll-runs', label: 'Payroll runs' },
    { to: '/payroll-statutory', label: 'Statutory deductions' },
    { to: '/payroll-deductions', label: 'Other deductions', icon: <SlidersIcon className="h-3.5 w-3.5" /> },
    { to: '/payroll-staff', label: 'Staff setup' },
    { to: '/payroll-accounts', label: 'Account links' },
    { to: '/sales-rep-payroll', label: 'Sales rep payroll', icon: <UsersIcon className="h-3.5 w-3.5" /> },
    { to: '/sales-rep-deductions', label: 'Sales rep deductions', icon: <SlidersIcon className="h-3.5 w-3.5" /> },
    { to: '/sales-rep-advances', label: 'Sales rep advances', icon: <WalletIcon className="h-3.5 w-3.5" /> },
    { to: '/staff-advances', label: 'Staff advances', icon: <WalletIcon className="h-3.5 w-3.5" /> },
  ];

  return (
    <div className="w-full py-6 px-4 sm:px-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between mb-5">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Payroll Management</h1>
          <p className="text-sm text-gray-500">Review salaries, run payroll and track payments</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => { setShowAllHistory(true); fetchAllHistory(); }}
            className="inline-flex items-center gap-1.5 bg-white border border-gray-300 text-gray-700 px-3.5 py-2 text-sm rounded-lg hover:bg-gray-50"
          >
            <HistoryIcon className="h-4 w-4" /> History
          </button>
          <button
            onClick={openRunPayroll}
            disabled={loading || staff.length === 0}
            className="inline-flex items-center gap-1.5 bg-red-600 text-white px-3.5 py-2 text-sm font-medium rounded-lg hover:bg-red-700 disabled:opacity-50"
          >
            <PlayIcon className="h-4 w-4" /> Run payroll
          </button>
        </div>
      </div>

      {/* Related pages */}
      <nav className="flex flex-wrap gap-2 mb-5" aria-label="Payroll sections">
        {links.map(l => (
          <Link
            key={l.to}
            to={l.to}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs text-gray-600 bg-white border border-gray-200 rounded-full hover:border-red-300 hover:text-red-700"
          >
            {l.icon}
            {l.label}
          </Link>
        ))}
      </nav>

      {/* Run result banner */}
      {runPayrollResult && !showRunPayroll && (
        <div
          className={`mb-5 flex items-start justify-between gap-3 rounded-lg border px-4 py-3 text-sm ${
            runPayrollResult.success
              ? 'bg-green-50 border-green-200 text-green-800'
              : 'bg-red-50 border-red-200 text-red-800'
          }`}
        >
          <span>{runPayrollResult.success ? runPayrollResult.message || 'Payroll processed successfully.' : runPayrollResult.error}</span>
          <button onClick={() => setRunPayrollResult(null)} aria-label="Dismiss"><XIcon className="h-4 w-4" /></button>
        </div>
      )}

      {/* KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-5">
        <StatCard label="Employees" value={String(filteredStaff.length)} icon={<UsersIcon className="h-5 w-5" />} tone="bg-red-50 text-red-700" />
        <StatCard label="Monthly gross" value={money(totals.gross)} icon={<WalletIcon className="h-5 w-5" />} tone="bg-blue-50 text-blue-700" />
        <StatCard label="Est. deductions" value={money(totals.ded)} hint="PAYE, NSSF, NHIF" icon={<SlidersIcon className="h-5 w-5" />} tone="bg-amber-50 text-amber-700" />
        <StatCard label="Est. net pay" value={money(totals.net)} icon={<CalendarIcon className="h-5 w-5" />} tone="bg-emerald-50 text-emerald-700" />
      </div>

      {/* Staff table */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 px-4 py-3 border-b border-gray-200">
          <h2 className="text-sm font-semibold text-gray-900">Staff</h2>
          <div className="flex flex-col sm:flex-row gap-2 sm:items-center">
            <select
              value={roleFilter}
              onChange={e => { setRoleFilter(e.target.value); setPage(1); }}
              aria-label="Filter by role"
              className="px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent"
            >
              <option value="">All roles</option>
              {roles.map(r => <option key={r} value={r}>{r}</option>)}
            </select>
            <div className="relative sm:w-72">
              <SearchIcon className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                value={search}
                onChange={e => { setSearch(e.target.value); setPage(1); }}
                placeholder="Search by name"
                className="pl-9 pr-3 py-2 text-sm w-full border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent"
              />
            </div>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-2.5 text-left text-[11px] font-medium text-gray-500 uppercase tracking-wide">Name</th>
                <th className="px-4 py-2.5 text-left text-[11px] font-medium text-gray-500 uppercase tracking-wide">Role</th>
                <th className="px-4 py-2.5 text-right text-[11px] font-medium text-gray-500 uppercase tracking-wide">Gross salary</th>
                <th className="px-4 py-2.5 text-right text-[11px] font-medium text-gray-500 uppercase tracking-wide">Est. deductions</th>
                <th className="px-4 py-2.5 text-right text-[11px] font-medium text-gray-500 uppercase tracking-wide">Est. net</th>
                <th className="px-4 py-2.5" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading ? (
                <tr><td colSpan={6} className="py-12 text-center text-sm text-gray-500"><span className="inline-flex items-center gap-2"><Spinner className="h-4 w-4 text-red-600" /> Loading staff...</span></td></tr>
              ) : error ? (
                <tr><td colSpan={6} className="py-12 text-center text-sm text-red-600">{error}</td></tr>
              ) : filteredStaff.length === 0 ? (
                <tr><td colSpan={6} className="py-12 text-center text-sm text-gray-500">No staff found</td></tr>
              ) : (
                pageItems.map(s => {
                  const gross = s.salary ? Number(s.salary) : 0;
                  const d = calculateDeductions(gross);
                  return (
                    <tr key={s.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3">
                        <div className="text-sm font-medium text-gray-900">{s.name}</div>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600 whitespace-nowrap">{s.role || '—'}</td>
                      <td className="px-4 py-3 text-sm text-right text-gray-900 whitespace-nowrap">
                        {s.salary != null ? money(gross) : <span className="text-gray-400">Not set</span>}
                      </td>
                      <td className="px-4 py-3 text-sm text-right text-amber-700 whitespace-nowrap">
                        {s.salary != null ? money(d.total) : '—'}
                      </td>
                      <td className="px-4 py-3 text-sm text-right font-semibold text-emerald-700 whitespace-nowrap">
                        {s.salary != null ? money(d.net) : '—'}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <button
                          className="text-xs text-red-600 hover:underline whitespace-nowrap"
                          onClick={() => { setShowHistoryStaffId(s.id); fetchHistory(s.id); }}
                        >
                          View history
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-2 px-4 py-3 border-t border-gray-200 text-xs text-gray-600">
          <div className="flex items-center gap-2">
            <span>Rows per page</span>
            <select
              value={pageSize}
              onChange={e => { setPageSize(Number(e.target.value)); setPage(1); }}
              className="border border-gray-300 rounded-lg px-2 py-1"
            >
              {[10, 20, 50].map(n => <option key={n} value={n}>{n}</option>)}
            </select>
          </div>
          <div className="flex items-center gap-2">
            <span>Page {currentPage} of {totalPages}</span>
            <button
              className="p-1.5 border border-gray-300 rounded-lg bg-white disabled:opacity-40"
              onClick={() => setPage(Math.max(1, currentPage - 1))}
              disabled={currentPage === 1}
              aria-label="Previous page"
            >
              <ChevronLeftIcon className="h-4 w-4" />
            </button>
            <button
              className="p-1.5 border border-gray-300 rounded-lg bg-white disabled:opacity-40"
              onClick={() => setPage(Math.min(totalPages, currentPage + 1))}
              disabled={currentPage === totalPages}
              aria-label="Next page"
            >
              <ChevronRightIcon className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Run payroll drawer */}
      {showRunPayroll && (
        <Drawer
          title="Run payroll"
          subtitle="Choose who to pay, adjust amounts if needed, then confirm"
          widthClass="max-w-4xl"
          onClose={() => setShowRunPayroll(false)}
          footer={
            <div className="flex items-center justify-between gap-3">
              <div className="text-xs text-gray-600">
                {runRows.length} selected · Net <span className="font-semibold text-gray-900">{money(runTotals.net)}</span>
                {runPayrollResult && !runPayrollResult.success && (
                  <span className="ml-3 text-red-600">{runPayrollResult.error}</span>
                )}
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setShowRunPayroll(false)}
                  className="px-3.5 py-2 text-sm border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  form="run-payroll-form"
                  disabled={runPayrollLoading || runRows.length === 0}
                  className="inline-flex items-center gap-2 px-3.5 py-2 text-sm font-medium bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50"
                >
                  {runPayrollLoading ? <><Spinner className="h-4 w-4" /> Processing...</> : 'Confirm & run payroll'}
                </button>
              </div>
            </div>
          }
        >
          <form id="run-payroll-form" onSubmit={handleRunPayroll} className="p-5 space-y-5">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Pay date</label>
                <input type="date" value={payDate} onChange={e => setPayDate(e.target.value)} className={fieldCls} required />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Payment account</label>
                <select value={selectedPaymentAccount} onChange={e => setSelectedPaymentAccount(e.target.value)} className={fieldCls} required>
                  <option value="">Select payment account</option>
                  {paymentAccounts.map(pa => (
                    <option key={pa.id} value={pa.id}>{pa.account_code} - {pa.account_name}</option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-sm font-semibold text-gray-900">Staff &amp; pay preview</h3>
                <span className="text-[11px] text-gray-500">Type in the Gross column to override a salary</span>
              </div>
              <div className="border border-gray-200 rounded-xl overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-3 py-2.5 w-10">
                        <input
                          type="checkbox"
                          checked={allSelected}
                          onChange={e => setSelectedStaffIds(e.target.checked ? staff.map(s => s.id) : [])}
                          aria-label="Select all"
                          className="rounded border-gray-300 text-red-600 focus:ring-red-500"
                        />
                      </th>
                      <th className="px-3 py-2.5 text-left text-[11px] font-medium text-gray-500 uppercase tracking-wide">Staff</th>
                      <th className="px-3 py-2.5 text-right text-[11px] font-medium text-gray-500 uppercase tracking-wide">Gross (KES)</th>
                      <th className="px-3 py-2.5 text-right text-[11px] font-medium text-gray-500 uppercase tracking-wide">PAYE</th>
                      <th className="px-3 py-2.5 text-right text-[11px] font-medium text-gray-500 uppercase tracking-wide">NSSF</th>
                      <th className="px-3 py-2.5 text-right text-[11px] font-medium text-gray-500 uppercase tracking-wide">NHIF</th>
                      <th className="px-3 py-2.5 text-right text-[11px] font-medium text-gray-500 uppercase tracking-wide">Net</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {staff.map(s => {
                      const checked = selectedStaffIds.includes(s.id);
                      const gross = grossFor(s);
                      const d = calculateDeductions(gross);
                      return (
                        <tr key={s.id} className={checked ? '' : 'opacity-50'}>
                          <td className="px-3 py-2">
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={e =>
                                setSelectedStaffIds(e.target.checked ? [...selectedStaffIds, s.id] : selectedStaffIds.filter(id => id !== s.id))
                              }
                              aria-label={`Select ${s.name}`}
                              className="rounded border-gray-300 text-red-600 focus:ring-red-500"
                            />
                          </td>
                          <td className="px-3 py-2">
                            <div className="text-xs font-medium text-gray-900">{s.name}</div>
                            <div className="text-[11px] text-gray-500">{s.role}</div>
                          </td>
                          <td className="px-3 py-2 text-right">
                            <input
                              type="number"
                              min="0"
                              step="0.01"
                              disabled={!checked}
                              placeholder={s.salary != null ? String(s.salary) : '0'}
                              value={overrideSalaries[s.id] ?? ''}
                              onChange={e => setOverrideSalaries({ ...overrideSalaries, [s.id]: e.target.value })}
                              className="w-28 px-2 py-1 text-xs text-right border border-gray-300 rounded-md focus:ring-2 focus:ring-red-500 focus:border-transparent disabled:bg-gray-50"
                            />
                          </td>
                          <td className="px-3 py-2 text-xs text-right text-gray-600 whitespace-nowrap">{d.paye.toLocaleString('en-US', { maximumFractionDigits: 2 })}</td>
                          <td className="px-3 py-2 text-xs text-right text-gray-600 whitespace-nowrap">{d.nssf.toLocaleString('en-US', { maximumFractionDigits: 2 })}</td>
                          <td className="px-3 py-2 text-xs text-right text-gray-600 whitespace-nowrap">{d.nhif.toLocaleString('en-US', { maximumFractionDigits: 2 })}</td>
                          <td className="px-3 py-2 text-xs text-right font-semibold text-emerald-700 whitespace-nowrap">{d.net.toLocaleString('en-US', { maximumFractionDigits: 2 })}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                  <tfoot className="bg-gray-50">
                    <tr>
                      <td />
                      <td className="px-3 py-2.5 text-xs font-semibold text-gray-900">Totals</td>
                      <td className="px-3 py-2.5 text-xs font-semibold text-right text-gray-900 whitespace-nowrap">{runTotals.gross.toLocaleString('en-US', { maximumFractionDigits: 2 })}</td>
                      <td colSpan={3} className="px-3 py-2.5 text-xs text-right text-gray-600 whitespace-nowrap">
                        Deductions {runTotals.ded.toLocaleString('en-US', { maximumFractionDigits: 2 })}
                      </td>
                      <td className="px-3 py-2.5 text-xs font-bold text-right text-emerald-700 whitespace-nowrap">{runTotals.net.toLocaleString('en-US', { maximumFractionDigits: 2 })}</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
              <p className="text-[11px] text-gray-400 mt-1.5">Deduction figures are estimates; final amounts are calculated when payroll is processed.</p>
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Notes (optional)</label>
              <textarea
                value={notes}
                onChange={e => setNotes(e.target.value)}
                placeholder="Anything worth recording about this payroll run..."
                className={`${fieldCls} resize-none`}
                rows={3}
              />
            </div>
          </form>
        </Drawer>
      )}

      {/* Single staff history */}
      {showHistoryStaffId !== null && (
        <Drawer
          title="Payroll history"
          subtitle={historyStaff?.name}
          onClose={() => setShowHistoryStaffId(null)}
        >
          <HistoryPanel
            data={historyData}
            loading={historyLoading}
            showStaff={false}
            emptyText="This staff member hasn't received any payroll payments yet."
          />
        </Drawer>
      )}

      {/* All history */}
      {showAllHistory && (
        <Drawer
          title="All payroll history"
          subtitle="Every payment processed across the organization"
          widthClass="max-w-4xl"
          onClose={() => setShowAllHistory(false)}
        >
          <HistoryPanel
            data={allHistoryData}
            loading={allHistoryLoading}
            showStaff
            emptyText="No payroll payments have been processed yet."
          />
        </Drawer>
      )}
    </div>
  );
};

export default PayrollManagementPage;
