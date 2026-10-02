import React, { useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import { Link } from 'react-router-dom';
import { saveAs } from 'file-saver';
import {
  Wallet, Users, Filter, Download, X, Sliders, PlayCircle, History, CheckCircle2,
} from 'lucide-react';
import { salesService, SalesRep, Country } from '../services/salesService';
import { API_CONFIG } from '../config/api';
import { useAuth } from '../contexts/AuthContext';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';
const PAYROLL_API_BASE = API_CONFIG.getUrl('/payroll');

const getAuthHeaders = () => {
  const token = localStorage.getItem('token');
  return token ? { Authorization: `Bearer ${token}` } : {};
};

interface LoginHistory {
  id: number;
  userId: number;
  sessionStart: string;
  sessionEnd?: string;
}

interface Leave {
  id: number;
  userId: number;
  startDate: string;
  endDate: string;
  status: string | number;
}

interface Deduction {
  id: number;
  name: string;
  code?: string | null;
  calculation_type: 'percentage' | 'fixed';
  rate?: number | null;
  amount?: number | null;
  cap_amount?: number | null;
  account_id: number;
  account_code?: string;
  account_name?: string;
  is_active: boolean | number;
}

interface DeductionLine {
  deduction: Deduction;
  amount: number;
}

interface Account {
  id: number;
  account_code: string;
  account_name: string;
}

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
  total_deductions: number;
  net_pay: number;
  journal_entry_id: number | null;
}

interface RepPayroll {
  rep: SalesRep;
  present: number;
  leave: number;
  absent: number;
  totalWorkingDays: number;
  daysPaid: number;
  basicSalary: number;
  grossPay: number;
  deductionLines: DeductionLine[];
  totalDeductions: number;
  netPay: number;
}

const getDaysInMonth = (year: number, month: number) => new Date(year, month + 1, 0).getDate();

// Local-calendar ISO date (avoids UTC rollback near month boundaries in timezones ahead of UTC)
const toLocalISODate = (d: Date) => {
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
};

const formatKES = (amount: number) =>
  amount.toLocaleString('en-KE', { style: 'currency', currency: 'KES', minimumFractionDigits: 2, maximumFractionDigits: 2 });

const calculateDeductionAmount = (deduction: Deduction, grossPay: number): number => {
  let value = 0;
  if (deduction.calculation_type === 'percentage') {
    value = grossPay * (Number(deduction.rate || 0) / 100);
  } else {
    value = Number(deduction.amount || 0);
  }
  if (deduction.cap_amount != null && value > Number(deduction.cap_amount)) {
    value = Number(deduction.cap_amount);
  }
  return value;
};

const SalesRepPayrollPage: React.FC = () => {
  const { user } = useAuth();
  const teamLeaderUserId =
    user?.role === 'team_leader' || user?.role === 'leader' ? user?.id ?? null : null;
  const isTeamLeaderUser = teamLeaderUserId !== null;

  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth();
  const daysInMonth = getDaysInMonth(year, month);

  const [startDate, setStartDate] = useState<string>(() => toLocalISODate(new Date(year, month, 1)));
  const [endDate, setEndDate] = useState<string>(() => toLocalISODate(new Date(year, month, daysInMonth)));

  const [salesReps, setSalesReps] = useState<SalesRep[]>([]);
  const [loginHistory, setLoginHistory] = useState<LoginHistory[]>([]);
  const [leaves, setLeaves] = useState<Leave[]>([]);
  const [deductions, setDeductions] = useState<Deduction[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [allowedRepIds, setAllowedRepIds] = useState<Set<number> | null>(null);
  const [restrictingByTeamLeader, setRestrictingByTeamLeader] = useState(false);

  const [countries, setCountries] = useState<Country[]>([]);
  const [selectedCountry, setSelectedCountry] = useState<string>('');
  const [defaultCountrySet, setDefaultCountrySet] = useState(false);
  const [selectedRep, setSelectedRep] = useState<string>('');
  const [selectedStatus, setSelectedStatus] = useState<string>('1');

  const [filterModalOpen, setFilterModalOpen] = useState(false);
  const [pendingCountry, setPendingCountry] = useState('');
  const [pendingRep, setPendingRep] = useState('');
  const [pendingStatus, setPendingStatus] = useState('1');
  const [pendingStartDate, setPendingStartDate] = useState(startDate);
  const [pendingEndDate, setPendingEndDate] = useState(endDate);

  const [breakdownModal, setBreakdownModal] = useState<RepPayroll | null>(null);

  // Run Payroll state
  const [runModalOpen, setRunModalOpen] = useState(false);
  const [runSubmitting, setRunSubmitting] = useState(false);
  const [runError, setRunError] = useState<string | null>(null);
  const [runResult, setRunResult] = useState<{ count: number; skipped: number } | null>(null);
  const [payDate, setPayDate] = useState<string>(() => toLocalISODate(new Date()));
  const [paymentAccounts, setPaymentAccounts] = useState<Account[]>([]);
  const [expenseAccounts, setExpenseAccounts] = useState<Account[]>([]);
  const [selectedPaymentAccount, setSelectedPaymentAccount] = useState<string>('');
  const [selectedExpenseAccount, setSelectedExpenseAccount] = useState<string>('');
  const [runNotes, setRunNotes] = useState('');
  const [runRepIds, setRunRepIds] = useState<number[]>([]);

  // Payroll history state
  const [historyModalOpen, setHistoryModalOpen] = useState(false);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyData, setHistoryData] = useState<PayrollHistoryEntry[]>([]);

  const [currentPage, setCurrentPage] = useState(1);
  const [repsPerPage, setRepsPerPage] = useState(10);
  const recordsPerPageOptions = [10, 20, 50, 100];

  useEffect(() => {
    setLoading(true);
    setError(null);
    Promise.all([
      salesService.getAllSalesReps(),
      axios.get(`${API_BASE_URL}/login-history`, { headers: getAuthHeaders() }),
      axios.get(`${API_BASE_URL}/sales-rep-leaves/sales-rep-leaves`, { headers: getAuthHeaders() }),
      salesService.getCountries(),
      axios.get(`${PAYROLL_API_BASE}/deductions`, { headers: getAuthHeaders() }),
    ])
      .then(([repsRes, loginRes, leavesRes, countriesRes, deductionsRes]) => {
        setSalesReps(repsRes || []);
        setLoginHistory(loginRes.data || []);
        setLeaves(leavesRes.data || []);
        setCountries(countriesRes || []);
        setDeductions(deductionsRes.data?.success ? (deductionsRes.data.data || []) : []);
        setLoading(false);
      })
      .catch((err) => {
        setError(`Failed to fetch data: ${err.response?.data?.message || err.message || 'Unknown error'}`);
        setLoading(false);
      });
  }, []);

  // Fetch accounts used when running payroll: cash/bank (type 9) and expense (type 16)
  useEffect(() => {
    axios.get(`${PAYROLL_API_BASE}/payment-accounts`, { headers: getAuthHeaders() })
      .then(res => {
        if (res.data?.success) {
          setPaymentAccounts(res.data.data || []);
          if (res.data.data?.length > 0) setSelectedPaymentAccount(String(res.data.data[0].id));
        }
      })
      .catch(() => setPaymentAccounts([]));

    axios.get(API_CONFIG.getUrl('/financial/accounts/type16'), { headers: getAuthHeaders() })
      .then(res => {
        if (res.data?.success) {
          setExpenseAccounts(res.data.data || []);
          if (res.data.data?.length > 0) setSelectedExpenseAccount(String(res.data.data[0].id));
        }
      })
      .catch(() => setExpenseAccounts([]));
  }, []);

  // Default country filter to the user's own country
  useEffect(() => {
    const fetchUserCountry = async () => {
      if (!user?.id || countries.length === 0 || defaultCountrySet) return;
      try {
        const response = await axios.get(`${API_BASE_URL}/staff/${user.id}`, { headers: getAuthHeaders() });
        const staffData = response.data;
        const userCountry = staffData.country || staffData.country_id || staffData.countryId;
        if (userCountry === 1 || userCountry === '1') {
          const kenya = countries.find(c => c.id === 1 || c.name.toLowerCase() === 'kenya');
          setSelectedCountry(kenya ? kenya.name : 'Kenya');
          setPendingCountry(kenya ? kenya.name : 'Kenya');
          setDefaultCountrySet(true);
        } else if (userCountry === 2 || userCountry === '2') {
          const tz = countries.find(c => c.id === 2 || c.name.toLowerCase() === 'tanzania');
          setSelectedCountry(tz ? tz.name : 'Tanzania');
          setPendingCountry(tz ? tz.name : 'Tanzania');
          setDefaultCountrySet(true);
        }
      } catch {
        if (!defaultCountrySet) {
          setSelectedCountry('Kenya');
          setPendingCountry('Kenya');
          setDefaultCountrySet(true);
        }
      }
    };
    fetchUserCountry();
  }, [user?.id, countries, defaultCountrySet]);

  // Restrict a team leader's view to only their assigned reps
  useEffect(() => {
    let cancelled = false;
    const isTeamLeaderRep = (rep: SalesRep) => {
      const role = (rep.role || '').toLowerCase().trim();
      return role === 'team leader' || role === 'team_leader';
    };
    const run = async () => {
      if (!isTeamLeaderUser || !teamLeaderUserId) {
        setAllowedRepIds(new Set(salesReps.map(r => r.id)));
        return;
      }
      setRestrictingByTeamLeader(true);
      setAllowedRepIds(null);
      try {
        const ids = new Set<number>();
        await Promise.all(
          salesReps.map(async (rep) => {
            if (isTeamLeaderRep(rep)) return;
            try {
              const res = await axios.get(`/api/sales/sales-reps/${rep.id}/team-leader`, { headers: getAuthHeaders() });
              const leaderId = res.data?.id;
              if (leaderId !== undefined && Number(leaderId) === Number(teamLeaderUserId)) {
                ids.add(rep.id);
              }
            } catch {}
          })
        );
        if (!cancelled) setAllowedRepIds(ids);
      } finally {
        if (!cancelled) setRestrictingByTeamLeader(false);
      }
    };
    run();
    return () => { cancelled = true; };
  }, [isTeamLeaderUser, teamLeaderUserId, salesReps]);

  // Every calendar day in range (up to today) counts as a working day, matching the Working Days report
  const getWorkingDaysInRange = () => {
    const days: string[] = [];
    const start = new Date(startDate);
    const end = new Date(endDate);
    const today = new Date();
    today.setHours(23, 59, 59, 999);
    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
      if (d <= today) days.push(d.toISOString().slice(0, 10));
    }
    return days;
  };

  const numWorkingDays = getWorkingDaysInRange().length;
  const rangeStart = new Date(startDate);
  const rangeEnd = new Date(endDate);

  const filteredSalesReps = salesReps.filter(rep => {
    if (isTeamLeaderUser && allowedRepIds === null) return false;
    if (isTeamLeaderUser && allowedRepIds && !allowedRepIds.has(rep.id)) return false;
    if (selectedCountry && rep.country !== selectedCountry) return false;
    if (selectedStatus) {
      const statusValue = parseInt(selectedStatus);
      if (rep.status !== statusValue) return false;
    }
    if (selectedRep && String(rep.id) !== selectedRep) return false;
    return true;
  });

  const activeDeductions = useMemo(() => deductions.filter(d => !!d.is_active), [deductions]);

  const payrollRows: RepPayroll[] = useMemo(() => {
    return filteredSalesReps.map(rep => {
      const presentDays = new Set(
        loginHistory
          .filter(lh => lh.userId === rep.id && lh.sessionStart &&
            new Date(lh.sessionStart) >= rangeStart && new Date(lh.sessionStart) <= rangeEnd)
          .map(lh => lh.sessionStart.slice(0, 10))
      );

      const repLeaves = leaves.filter(lv => String(lv.userId) === String(rep.id) && (lv.status === 1 || lv.status === '1'));
      let leaveDays = 0;
      const today = new Date();
      today.setHours(23, 59, 59, 999);
      repLeaves.forEach(lv => {
        const leaveStart = new Date(lv.startDate) < rangeStart ? rangeStart : new Date(lv.startDate);
        const leaveEnd = new Date(lv.endDate) > rangeEnd ? rangeEnd : new Date(lv.endDate);
        for (let d = new Date(leaveStart); d <= leaveEnd; d.setDate(d.getDate() + 1)) {
          if (d >= rangeStart && d <= rangeEnd && d <= today) leaveDays++;
        }
      });

      const absentDays = numWorkingDays - presentDays.size - leaveDays;
      const daysPaid = presentDays.size + leaveDays;
      const basicSalary = rep.basic_salary != null ? Number(rep.basic_salary) : 0;
      const grossPay = numWorkingDays > 0 ? basicSalary * (daysPaid / numWorkingDays) : basicSalary;

      const deductionLines: DeductionLine[] = activeDeductions.map(d => ({
        deduction: d,
        amount: calculateDeductionAmount(d, grossPay),
      }));
      const totalDeductions = deductionLines.reduce((sum, l) => sum + l.amount, 0);
      const netPay = grossPay - totalDeductions;

      return {
        rep,
        present: presentDays.size,
        leave: leaveDays,
        absent: absentDays < 0 ? 0 : absentDays,
        totalWorkingDays: numWorkingDays,
        daysPaid,
        basicSalary,
        grossPay,
        deductionLines,
        totalDeductions,
        netPay,
      };
    });
  }, [filteredSalesReps, loginHistory, leaves, activeDeductions, numWorkingDays, rangeStart, rangeEnd]);

  const totalPages = Math.ceil(payrollRows.length / repsPerPage);
  const paginatedRows = useMemo(() => {
    const start = (currentPage - 1) * repsPerPage;
    return payrollRows.slice(start, start + repsPerPage);
  }, [payrollRows, currentPage, repsPerPage]);

  const listStart = payrollRows.length === 0 ? 0 : (currentPage - 1) * repsPerPage + 1;
  const listEnd = Math.min(currentPage * repsPerPage, payrollRows.length);

  useEffect(() => { setCurrentPage(1); }, [selectedCountry, selectedRep, selectedStatus, startDate, endDate]);
  useEffect(() => { setCurrentPage(1); }, [repsPerPage]);
  useEffect(() => { if (totalPages > 0 && currentPage > totalPages) setCurrentPage(totalPages); }, [currentPage, totalPages]);

  const totals = useMemo(() => ({
    reps: payrollRows.length,
    basicSalary: payrollRows.reduce((s, r) => s + r.basicSalary, 0),
    gross: payrollRows.reduce((s, r) => s + r.grossPay, 0),
    deductions: payrollRows.reduce((s, r) => s + r.totalDeductions, 0),
    net: payrollRows.reduce((s, r) => s + r.netPay, 0),
  }), [payrollRows]);

  const exportToCSV = () => {
    const headers = [
      'Sales Rep', 'Role', 'Basic Salary', 'Days Paid', 'Working Days', 'Gross Pay',
      ...activeDeductions.map(d => d.name), 'Total Deductions', 'Net Pay',
    ];
    const rows = payrollRows.map(r => [
      r.rep.name,
      r.rep.role || 'sales rep',
      r.basicSalary.toFixed(2),
      r.daysPaid,
      r.totalWorkingDays,
      r.grossPay.toFixed(2),
      ...activeDeductions.map(d => {
        const line = r.deductionLines.find(l => l.deduction.id === d.id);
        return line ? line.amount.toFixed(2) : '0.00';
      }),
      r.totalDeductions.toFixed(2),
      r.netPay.toFixed(2),
    ]);
    const csvContent = [
      ['Sales Rep Payroll Report'],
      [`Date Range: ${startDate} to ${endDate}`],
      [`Generated: ${new Date().toLocaleString()}`],
      [],
      headers,
      ...rows,
    ]
      .map(row => row.map(field => '"' + String(field).replace(/"/g, '""') + '"').join(','))
      .join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    saveAs(blob, 'sales_rep_payroll.csv');
  };

  const openFilterModal = () => {
    setPendingCountry(selectedCountry);
    setPendingRep(selectedRep);
    setPendingStatus(selectedStatus);
    setPendingStartDate(startDate);
    setPendingEndDate(endDate);
    setFilterModalOpen(true);
  };

  const applyFilters = () => {
    setSelectedCountry(pendingCountry);
    setSelectedRep(pendingRep);
    setSelectedStatus(pendingStatus);
    setStartDate(pendingStartDate);
    setEndDate(pendingEndDate);
    setFilterModalOpen(false);
  };

  const clearFilters = () => {
    setPendingCountry('Kenya');
    setPendingRep('');
    setPendingStatus('1');
    setPendingStartDate(toLocalISODate(new Date(year, month, 1)));
    setPendingEndDate(toLocalISODate(new Date(year, month, daysInMonth)));
  };

  const openRunModal = () => {
    setRunError(null);
    setRunResult(null);
    setRunNotes('');
    setPayDate(toLocalISODate(new Date()));
    // Default to every sales rep currently shown under the active filters
    setRunRepIds(payrollRows.map(r => r.rep.id));
    setRunModalOpen(true);
  };

  const closeRunModal = () => {
    setRunModalOpen(false);
    setRunError(null);
  };

  const toggleRunRep = (repId: number) => {
    setRunRepIds(ids => ids.includes(repId) ? ids.filter(id => id !== repId) : [...ids, repId]);
  };

  const handleRunPayroll = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPaymentAccount || !selectedExpenseAccount) {
      setRunError('Payment account and expense account are required');
      return;
    }
    if (runRepIds.length === 0) {
      setRunError('Select at least one sales rep to run payroll for');
      return;
    }
    setRunSubmitting(true);
    setRunError(null);
    setRunResult(null);
    try {
      const res = await axios.post(
        `${PAYROLL_API_BASE}/run-sales-reps`,
        {
          pay_date: payDate,
          period_start: startDate,
          period_end: endDate,
          sales_rep_ids: runRepIds,
          payment_account_id: Number(selectedPaymentAccount),
          expense_account_id: Number(selectedExpenseAccount),
          notes: runNotes || undefined,
        },
        { headers: getAuthHeaders() }
      );
      if (res.data?.success) {
        setRunResult({ count: res.data.count, skipped: res.data.skipped || 0 });
      } else {
        setRunError(res.data?.error || 'Failed to run payroll');
      }
    } catch (err: any) {
      setRunError(err.response?.data?.error || err.message || 'Failed to run payroll');
    }
    setRunSubmitting(false);
  };

  const openHistoryModal = async () => {
    setHistoryModalOpen(true);
    setHistoryLoading(true);
    try {
      const res = await axios.get(`${PAYROLL_API_BASE}/sales-reps-history`, { headers: getAuthHeaders() });
      setHistoryData(res.data?.success ? (res.data.data || []) : []);
    } catch {
      setHistoryData([]);
    }
    setHistoryLoading(false);
  };

  const formatDate = (dateString: string) =>
    new Date(dateString).toLocaleDateString('en-US', { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric' });

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="w-full mx-auto px-4 py-4">
        {/* Header */}
        <div className="bg-white border border-gray-200 rounded-md p-3 mb-3 flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-2">
            <div className="bg-red-50 text-red-600 p-1.5 rounded-md">
              <Wallet className="h-4 w-4" />
            </div>
            <div>
              <h1 className="text-sm font-bold text-gray-900">Sales Rep Payroll</h1>
              <p className="text-[10px] text-gray-500 mt-0.5">
                Basic salary prorated by attendance, less configured deductions
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Link
              to="/payroll-deductions"
              className="inline-flex items-center px-3 py-1.5 border border-gray-300 rounded-md text-xs font-medium text-gray-700 bg-white hover:bg-gray-50 transition-colors"
            >
              <Sliders className="h-3 w-3 mr-1.5" />
              Manage Deductions
            </Link>
            <button
              onClick={openHistoryModal}
              className="inline-flex items-center px-3 py-1.5 border border-gray-300 rounded-md text-xs font-medium text-gray-700 bg-white hover:bg-gray-50 transition-colors"
            >
              <History className="h-3 w-3 mr-1.5" />
              Payroll History
            </button>
            <button
              onClick={exportToCSV}
              className="inline-flex items-center px-3 py-1.5 border border-gray-300 rounded-md text-xs font-medium text-gray-700 bg-white hover:bg-gray-50 transition-colors"
            >
              <Download className="h-3 w-3 mr-1.5" />
              Export CSV
            </button>
            <button
              onClick={openFilterModal}
              className="inline-flex items-center px-3 py-1.5 border border-gray-300 rounded-md text-xs font-medium text-gray-700 bg-white hover:bg-gray-50 transition-colors"
            >
              <Filter className="h-3 w-3 mr-1.5" />
              Filter
            </button>
            <button
              onClick={openRunModal}
              className="inline-flex items-center px-3 py-1.5 rounded-md text-xs font-semibold text-white bg-green-600 hover:bg-green-700 transition-colors"
            >
              <PlayCircle className="h-3 w-3 mr-1.5" />
              Run Payroll
            </button>
          </div>
        </div>

        {loading || restrictingByTeamLeader ? (
          <div className="flex items-center justify-center py-16">
            <div className="animate-spin rounded-full h-10 w-10 border-2 border-red-600 border-t-transparent"></div>
          </div>
        ) : error ? (
          <div className="bg-white border border-gray-200 rounded-md text-center py-16">
            <h3 className="text-sm font-medium text-red-900">Error Loading Data</h3>
            <p className="mt-2 text-xs text-red-600 max-w-md mx-auto">{error}</p>
            <button
              onClick={() => window.location.reload()}
              className="mt-4 inline-flex items-center px-3 py-1.5 rounded-md text-xs font-semibold text-white bg-red-600 hover:bg-red-700"
            >
              Try Again
            </button>
          </div>
        ) : (
          <>
            {/* Date Range Info */}
            <div className="bg-white border border-gray-200 rounded-md p-3 mb-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
              <div>
                <h3 className="text-xs font-semibold text-gray-900">
                  Pay Period: {formatDate(startDate)} – {formatDate(endDate)}
                </h3>
                <p className="mt-0.5 text-[10px] text-gray-500">
                  {numWorkingDays} working days &middot; {activeDeductions.length} active deduction{activeDeductions.length === 1 ? '' : 's'}
                </p>
              </div>
            </div>

            {/* Summary Cards */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-3">
              <div className="bg-white border border-gray-200 rounded-md p-3">
                <div className="flex items-center gap-2 mb-1.5">
                  <div className="bg-red-50 text-red-600 p-1.5 rounded-md">
                    <Users className="h-3.5 w-3.5" />
                  </div>
                  <p className="text-[9px] font-semibold text-gray-500 uppercase tracking-wider">Sales Reps</p>
                </div>
                <p className="text-lg font-bold text-gray-900">{totals.reps}</p>
              </div>
              <div className="bg-white border border-gray-200 rounded-md p-3">
                <div className="flex items-center gap-2 mb-1.5">
                  <div className="bg-blue-50 text-blue-600 p-1.5 rounded-md">
                    <Wallet className="h-3.5 w-3.5" />
                  </div>
                  <p className="text-[9px] font-semibold text-gray-500 uppercase tracking-wider">Total Gross Pay</p>
                </div>
                <p className="text-lg font-bold text-gray-900">{formatKES(totals.gross)}</p>
              </div>
              <div className="bg-white border border-gray-200 rounded-md p-3">
                <div className="flex items-center gap-2 mb-1.5">
                  <div className="bg-orange-50 text-orange-600 p-1.5 rounded-md">
                    <Sliders className="h-3.5 w-3.5" />
                  </div>
                  <p className="text-[9px] font-semibold text-gray-500 uppercase tracking-wider">Total Deductions</p>
                </div>
                <p className="text-lg font-bold text-gray-900">{formatKES(totals.deductions)}</p>
              </div>
              <div className="bg-white border border-gray-200 rounded-md p-3">
                <div className="flex items-center gap-2 mb-1.5">
                  <div className="bg-green-50 text-green-600 p-1.5 rounded-md">
                    <Wallet className="h-3.5 w-3.5" />
                  </div>
                  <p className="text-[9px] font-semibold text-gray-500 uppercase tracking-wider">Total Net Pay</p>
                </div>
                <p className="text-lg font-bold text-gray-900">{formatKES(totals.net)}</p>
              </div>
            </div>

            {/* Payroll Table */}
            <div className="bg-white border border-gray-200 rounded-md overflow-hidden">
              <div className="px-3 py-2.5 border-b border-gray-200">
                <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-2">
                  <div>
                    <h3 className="text-xs font-semibold text-gray-900">Payroll Calculation</h3>
                    <p className="mt-0.5 text-[10px] text-gray-500">
                      {payrollRows.length === 0
                        ? 'No sales representatives match the filters'
                        : totalPages > 1
                          ? `Showing ${listStart}–${listEnd} of ${payrollRows.length} sales representatives`
                          : `Showing ${payrollRows.length} sales representative${payrollRows.length === 1 ? '' : 's'}`}
                    </p>
                  </div>
                  {payrollRows.length > 0 && (
                    <div className="flex items-center gap-1.5">
                      <label htmlFor="payroll-per-page" className="text-[9px] font-medium text-gray-500 whitespace-nowrap">
                        Show:
                      </label>
                      <select
                        id="payroll-per-page"
                        className="border border-gray-300 rounded px-1.5 py-1 text-[10px] focus:outline-none focus:ring-1 focus:ring-red-500 bg-white"
                        value={repsPerPage}
                        onChange={e => setRepsPerPage(Number(e.target.value))}
                      >
                        {recordsPerPageOptions.map(opt => (
                          <option key={opt} value={opt}>{opt}</option>
                        ))}
                      </select>
                    </div>
                  )}
                </div>
              </div>

              <div className="overflow-hidden">
                {payrollRows.length === 0 ? (
                  <div className="text-center py-12">
                    <h3 className="text-xs font-medium text-gray-900 mb-1">No Data Available</h3>
                    <p className="text-[10px] text-gray-500">No sales representatives found for the selected filters.</p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full divide-y divide-gray-200">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-3 py-2 text-left text-[9px] font-semibold text-gray-500 uppercase tracking-wider">Sales Representative</th>
                          <th className="px-3 py-2 text-right text-[9px] font-semibold text-gray-500 uppercase tracking-wider">Basic Salary</th>
                          <th className="px-3 py-2 text-center text-[9px] font-semibold text-gray-500 uppercase tracking-wider">Days Paid</th>
                          <th className="px-3 py-2 text-right text-[9px] font-semibold text-gray-500 uppercase tracking-wider">Gross Pay</th>
                          <th className="px-3 py-2 text-right text-[9px] font-semibold text-gray-500 uppercase tracking-wider">Deductions</th>
                          <th className="px-3 py-2 text-right text-[9px] font-semibold text-gray-500 uppercase tracking-wider">Net Pay</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {paginatedRows.map(row => (
                          <tr key={row.rep.id} className="hover:bg-gray-50">
                            <td className="px-3 py-2 whitespace-nowrap">
                              <div className="text-xs font-medium text-gray-900">{row.rep.name}</div>
                              <div className="text-[9px] text-gray-400 capitalize">{row.rep.role || 'sales rep'}</div>
                            </td>
                            <td className="px-3 py-2 whitespace-nowrap text-right text-xs text-gray-900">
                              {row.basicSalary ? formatKES(row.basicSalary) : <span className="text-gray-400">Not set</span>}
                            </td>
                            <td className="px-3 py-2 whitespace-nowrap text-center">
                              <div className="text-xs font-semibold text-gray-900">{row.daysPaid}/{row.totalWorkingDays}</div>
                              <div className="text-[9px] text-gray-400">{row.present} present, {row.leave} leave</div>
                            </td>
                            <td className="px-3 py-2 whitespace-nowrap text-right text-xs font-semibold text-gray-900">
                              {formatKES(row.grossPay)}
                            </td>
                            <td className="px-3 py-2 whitespace-nowrap text-right">
                              <button
                                onClick={() => row.deductionLines.length > 0 && setBreakdownModal(row)}
                                className={`text-xs font-semibold text-red-600 ${row.deductionLines.length > 0 ? 'hover:underline cursor-pointer' : 'cursor-default text-gray-400'}`}
                                title={row.deductionLines.length > 0 ? 'View deduction breakdown' : undefined}
                              >
                                {formatKES(row.totalDeductions)}
                              </button>
                            </td>
                            <td className="px-3 py-2 whitespace-nowrap text-right text-xs font-bold text-green-600">
                              {formatKES(row.netPay)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              {totalPages > 1 && (
                <div className="px-3 py-2 border-t border-gray-200 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                  <div className="text-[10px] text-gray-500">
                    Showing {listStart} to {listEnd} of {payrollRows.length} results
                    <span className="ml-2 text-gray-400">(Page {currentPage} of {totalPages})</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                      disabled={currentPage === 1}
                      className="px-2.5 py-1 text-[10px] font-medium text-gray-600 bg-white border border-gray-300 rounded hover:bg-gray-50 disabled:opacity-50"
                    >
                      Previous
                    </button>
                    <div className="flex gap-1">
                      {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                        let pageNum: number;
                        if (totalPages <= 5) pageNum = i + 1;
                        else if (currentPage <= 3) pageNum = i + 1;
                        else if (currentPage >= totalPages - 2) pageNum = totalPages - 4 + i;
                        else pageNum = currentPage - 2 + i;
                        return (
                          <button
                            key={pageNum}
                            type="button"
                            onClick={() => setCurrentPage(pageNum)}
                            className={`px-2.5 py-1 text-[10px] font-medium rounded transition-colors ${
                              pageNum === currentPage
                                ? 'bg-red-600 text-white'
                                : 'text-gray-600 bg-white border border-gray-300 hover:bg-gray-50'
                            }`}
                          >
                            {pageNum}
                          </button>
                        );
                      })}
                    </div>
                    <button
                      type="button"
                      onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                      disabled={currentPage === totalPages}
                      className="px-2.5 py-1 text-[10px] font-medium text-gray-600 bg-white border border-gray-300 rounded hover:bg-gray-50 disabled:opacity-50"
                    >
                      Next
                    </button>
                  </div>
                </div>
              )}
            </div>
          </>
        )}
      </div>

      {/* Deduction Breakdown Modal */}
      {breakdownModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg overflow-hidden flex flex-col" style={{ maxHeight: '85vh' }}>
            <div className="flex items-center justify-between px-6 py-4 bg-red-600 flex-shrink-0">
              <div>
                <h2 className="text-base font-bold text-white">Deduction Breakdown</h2>
                <p className="text-xs text-red-100">{breakdownModal.rep.name}</p>
              </div>
              <button onClick={() => setBreakdownModal(null)} className="text-white hover:text-red-200 transition-colors duration-150">
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="overflow-y-auto flex-1">
              <table className="min-w-full divide-y divide-gray-100">
                <thead className="bg-gray-50 sticky top-0">
                  <tr>
                    <th className="px-5 py-2.5 text-left text-[11px] font-semibold text-gray-500 uppercase tracking-wider">Deduction</th>
                    <th className="px-5 py-2.5 text-left text-[11px] font-semibold text-gray-500 uppercase tracking-wider">Account</th>
                    <th className="px-5 py-2.5 text-right text-[11px] font-semibold text-gray-500 uppercase tracking-wider">Amount</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {breakdownModal.deductionLines.map(line => (
                    <tr key={line.deduction.id}>
                      <td className="px-5 py-2.5 text-xs text-gray-900">
                        {line.deduction.name}
                        <div className="text-[10px] text-gray-400">
                          {line.deduction.calculation_type === 'percentage'
                            ? `${Number(line.deduction.rate || 0)}% of gross`
                            : 'Fixed amount'}
                        </div>
                      </td>
                      <td className="px-5 py-2.5 text-xs text-gray-600">
                        {line.deduction.account_code} - {line.deduction.account_name}
                      </td>
                      <td className="px-5 py-2.5 text-right text-xs font-semibold text-red-600">{formatKES(line.amount)}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot className="bg-gray-50">
                  <tr>
                    <td className="px-5 py-2.5 text-xs font-semibold text-gray-900" colSpan={2}>Total Deductions</td>
                    <td className="px-5 py-2.5 text-right text-xs font-bold text-red-600">{formatKES(breakdownModal.totalDeductions)}</td>
                  </tr>
                  <tr>
                    <td className="px-5 py-2.5 text-xs font-semibold text-gray-900" colSpan={2}>Gross Pay</td>
                    <td className="px-5 py-2.5 text-right text-xs font-semibold text-gray-900">{formatKES(breakdownModal.grossPay)}</td>
                  </tr>
                  <tr>
                    <td className="px-5 py-2.5 text-xs font-bold text-gray-900" colSpan={2}>Net Pay</td>
                    <td className="px-5 py-2.5 text-right text-xs font-bold text-green-600">{formatKES(breakdownModal.netPay)}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
            <div className="px-6 py-3 bg-gray-50 border-t border-gray-100 flex justify-end flex-shrink-0">
              <button
                onClick={() => setBreakdownModal(null)}
                className="px-4 py-1.5 text-xs font-medium text-white bg-red-600 hover:bg-red-700 rounded-md transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Filter Modal */}
      {filterModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 px-4">
          <div className="bg-white rounded-md shadow-lg w-full max-w-sm p-4 relative">
            <button
              onClick={() => setFilterModalOpen(false)}
              className="absolute top-2 right-2 text-gray-400 hover:text-gray-600 text-lg leading-none"
            >
              &times;
            </button>
            <h2 className="text-sm font-bold text-gray-900 mb-3">Filter Payroll</h2>

            <div className="space-y-2.5">
              <div>
                <label htmlFor="countryFilter" className="block text-[9px] font-semibold text-gray-500 uppercase tracking-wider mb-1">
                  Country
                </label>
                <select
                  id="countryFilter"
                  className="w-full px-2 py-1.5 text-xs border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-red-500"
                  value={pendingCountry}
                  onChange={e => setPendingCountry(e.target.value)}
                >
                  <option value="">All Countries</option>
                  {countries.map(c => (
                    <option key={c.id} value={c.name}>{c.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label htmlFor="statusFilter" className="block text-[9px] font-semibold text-gray-500 uppercase tracking-wider mb-1">
                  Status
                </label>
                <select
                  id="statusFilter"
                  className="w-full px-2 py-1.5 text-xs border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-red-500"
                  value={pendingStatus}
                  onChange={e => setPendingStatus(e.target.value)}
                >
                  <option value="">All Statuses</option>
                  <option value="1">Active</option>
                  <option value="0">Inactive</option>
                </select>
              </div>

              <div>
                <label htmlFor="repFilter" className="block text-[9px] font-semibold text-gray-500 uppercase tracking-wider mb-1">
                  Sales Representative
                </label>
                <select
                  id="repFilter"
                  className="w-full px-2 py-1.5 text-xs border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-red-500"
                  value={pendingRep}
                  onChange={e => setPendingRep(e.target.value)}
                >
                  <option value="">All Sales Reps</option>
                  {salesReps.map(rep => (
                    <option key={rep.id} value={String(rep.id)}>{rep.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label htmlFor="startDate" className="block text-[9px] font-semibold text-gray-500 uppercase tracking-wider mb-1">
                  Start Date
                </label>
                <input
                  id="startDate"
                  type="date"
                  className="w-full px-2 py-1.5 text-xs border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-red-500"
                  value={pendingStartDate}
                  onChange={e => setPendingStartDate(e.target.value)}
                  max={pendingEndDate}
                />
              </div>

              <div>
                <label htmlFor="endDate" className="block text-[9px] font-semibold text-gray-500 uppercase tracking-wider mb-1">
                  End Date
                </label>
                <input
                  id="endDate"
                  type="date"
                  className="w-full px-2 py-1.5 text-xs border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-red-500"
                  value={pendingEndDate}
                  onChange={e => setPendingEndDate(e.target.value)}
                  min={pendingStartDate}
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 mt-3">
              <button
                className="px-3 py-1.5 rounded bg-gray-100 text-gray-700 text-xs font-medium hover:bg-gray-200"
                onClick={clearFilters}
              >
                Clear
              </button>
              <button
                className="px-3 py-1.5 rounded bg-red-600 text-white text-xs font-semibold shadow hover:bg-red-700"
                onClick={applyFilters}
              >
                Apply Filters
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Run Payroll Modal */}
      {runModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col" style={{ maxHeight: '90vh' }}>
            <div className="flex items-center justify-between px-5 py-3.5 bg-green-600 flex-shrink-0">
              <div className="flex items-center gap-2">
                <PlayCircle className="h-4 w-4 text-white" />
                <div>
                  <h2 className="text-sm font-bold text-white">Run Sales Rep Payroll</h2>
                  <p className="text-[10px] text-green-100">
                    Period: {startDate} to {endDate}
                  </p>
                </div>
              </div>
              <button onClick={closeRunModal} className="text-white hover:text-green-200 transition-colors">
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="p-4 overflow-y-auto flex-1">
              {runResult ? (
                <div className="text-center py-8">
                  <CheckCircle2 className="h-10 w-10 text-green-600 mx-auto mb-3" />
                  <h3 className="text-sm font-semibold text-gray-900 mb-1">Payroll Posted</h3>
                  <p className="text-xs text-gray-600">
                    {runResult.count} journal {runResult.count === 1 ? 'entry' : 'entries'} recorded to journal_entries / journal_entry_lines.
                    {runResult.skipped > 0 && ` ${runResult.skipped} rep(s) skipped (already paid for this date).`}
                  </p>
                  <div className="flex justify-center gap-2 mt-4">
                    <button
                      onClick={() => { closeRunModal(); openHistoryModal(); }}
                      className="px-3 py-1.5 text-xs font-medium text-gray-700 bg-gray-100 border border-gray-300 rounded hover:bg-gray-200"
                    >
                      View History
                    </button>
                    <button
                      onClick={closeRunModal}
                      className="px-3 py-1.5 text-xs font-medium text-white bg-green-600 hover:bg-green-700 rounded"
                    >
                      Done
                    </button>
                  </div>
                </div>
              ) : (
                <form onSubmit={handleRunPayroll} className="space-y-3">
                  {runError && (
                    <div className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-md px-3 py-2">
                      {runError}
                    </div>
                  )}

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[10px] font-medium text-gray-700 mb-1">Pay Date</label>
                      <input
                        type="date"
                        value={payDate}
                        onChange={e => setPayDate(e.target.value)}
                        className="w-full px-2.5 py-1.5 text-xs border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-green-500"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-medium text-gray-700 mb-1">Payment Account (cash/bank)</label>
                      <select
                        value={selectedPaymentAccount}
                        onChange={e => setSelectedPaymentAccount(e.target.value)}
                        className="w-full px-2.5 py-1.5 text-xs border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-green-500"
                        required
                      >
                        <option value="">Select account</option>
                        {paymentAccounts.map(a => (
                          <option key={a.id} value={a.id}>{a.account_code} - {a.account_name}</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div>
                    <label className="block text-[10px] font-medium text-gray-700 mb-1">Payroll Expense Account</label>
                    <select
                      value={selectedExpenseAccount}
                      onChange={e => setSelectedExpenseAccount(e.target.value)}
                      className="w-full px-2.5 py-1.5 text-xs border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-green-500"
                      required
                    >
                      <option value="">Select account</option>
                      {expenseAccounts.map(a => (
                        <option key={a.id} value={a.id}>{a.account_code} - {a.account_name}</option>
                      ))}
                    </select>
                    <p className="mt-1 text-[10px] text-gray-500">Debited for the total gross pay of this run</p>
                  </div>

                  <div>
                    <label className="block text-[10px] font-medium text-gray-700 mb-2">
                      Sales Reps ({runRepIds.length} of {payrollRows.length} selected)
                    </label>
                    <div className="bg-gray-50 border border-gray-300 rounded-lg p-2.5 max-h-48 overflow-y-auto">
                      <label className="flex items-center gap-2 p-1 text-[11px] font-medium text-gray-700 border-b border-gray-200 mb-1 pb-1.5">
                        <input
                          type="checkbox"
                          checked={runRepIds.length === payrollRows.length && payrollRows.length > 0}
                          onChange={e => setRunRepIds(e.target.checked ? payrollRows.map(r => r.rep.id) : [])}
                          className="w-3 h-3 text-green-600 border-gray-300 rounded focus:ring-green-500"
                        />
                        Select All
                      </label>
                      {payrollRows.map(row => (
                        <label key={row.rep.id} className="flex items-center gap-2 p-1 hover:bg-white rounded cursor-pointer">
                          <input
                            type="checkbox"
                            checked={runRepIds.includes(row.rep.id)}
                            onChange={() => toggleRunRep(row.rep.id)}
                            className="w-3 h-3 text-green-600 border-gray-300 rounded focus:ring-green-500"
                          />
                          <span className="flex-1 text-[11px] text-gray-900">{row.rep.name}</span>
                          <span className="text-[10px] text-gray-500">Net {formatKES(row.netPay)}</span>
                        </label>
                      ))}
                      {payrollRows.length === 0 && (
                        <p className="text-[10px] text-gray-500 text-center py-2">No sales reps match the current filters.</p>
                      )}
                    </div>
                  </div>

                  <div>
                    <label className="block text-[10px] font-medium text-gray-700 mb-1">Notes (optional)</label>
                    <textarea
                      value={runNotes}
                      onChange={e => setRunNotes(e.target.value)}
                      rows={2}
                      className="w-full px-2.5 py-1.5 text-xs border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-green-500 resize-none"
                    />
                  </div>

                  <div className="flex justify-end gap-2 pt-2 border-t border-gray-200">
                    <button
                      type="button"
                      onClick={closeRunModal}
                      className="px-3 py-1.5 text-xs font-medium text-gray-700 bg-gray-100 border border-gray-300 rounded hover:bg-gray-200"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={runSubmitting}
                      className="px-3 py-1.5 text-xs font-medium text-white bg-green-600 hover:bg-green-700 rounded disabled:opacity-50"
                    >
                      {runSubmitting ? 'Processing...' : 'Run Payroll'}
                    </button>
                  </div>
                </form>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Payroll History Modal */}
      {historyModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-4xl overflow-hidden flex flex-col" style={{ maxHeight: '85vh' }}>
            <div className="flex items-center justify-between px-5 py-3.5 bg-red-600 flex-shrink-0">
              <div className="flex items-center gap-2">
                <History className="h-4 w-4 text-white" />
                <h2 className="text-sm font-bold text-white">Sales Rep Payroll History</h2>
              </div>
              <button onClick={() => setHistoryModalOpen(false)} className="text-white hover:text-red-200 transition-colors">
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="overflow-y-auto flex-1">
              {historyLoading ? (
                <div className="flex items-center justify-center py-12">
                  <div className="animate-spin rounded-full h-8 w-8 border-2 border-red-600 border-t-transparent"></div>
                </div>
              ) : historyData.length === 0 ? (
                <div className="text-center py-12 text-xs text-gray-500">No payroll runs recorded yet.</div>
              ) : (
                <table className="min-w-full divide-y divide-gray-100">
                  <thead className="bg-gray-50 sticky top-0">
                    <tr>
                      <th className="px-4 py-2.5 text-left text-[10px] font-semibold text-gray-500 uppercase tracking-wider">Sales Rep</th>
                      <th className="px-4 py-2.5 text-left text-[10px] font-semibold text-gray-500 uppercase tracking-wider">Pay Date</th>
                      <th className="px-4 py-2.5 text-center text-[10px] font-semibold text-gray-500 uppercase tracking-wider">Days Paid</th>
                      <th className="px-4 py-2.5 text-right text-[10px] font-semibold text-gray-500 uppercase tracking-wider">Gross Pay</th>
                      <th className="px-4 py-2.5 text-right text-[10px] font-semibold text-gray-500 uppercase tracking-wider">Deductions</th>
                      <th className="px-4 py-2.5 text-right text-[10px] font-semibold text-gray-500 uppercase tracking-wider">Net Pay</th>
                      <th className="px-4 py-2.5 text-center text-[10px] font-semibold text-gray-500 uppercase tracking-wider">Journal Entry</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {historyData.map(h => (
                      <tr key={h.id} className="hover:bg-gray-50">
                        <td className="px-4 py-2.5 text-xs font-medium text-gray-900 whitespace-nowrap">{h.sales_rep_name}</td>
                        <td className="px-4 py-2.5 text-xs text-gray-600 whitespace-nowrap">{new Date(h.pay_date).toLocaleDateString()}</td>
                        <td className="px-4 py-2.5 text-xs text-gray-600 text-center whitespace-nowrap">{h.days_paid}/{h.working_days}</td>
                        <td className="px-4 py-2.5 text-xs text-gray-900 text-right whitespace-nowrap">{formatKES(Number(h.gross_pay))}</td>
                        <td className="px-4 py-2.5 text-xs text-red-600 text-right whitespace-nowrap">{formatKES(Number(h.total_deductions))}</td>
                        <td className="px-4 py-2.5 text-xs font-bold text-green-600 text-right whitespace-nowrap">{formatKES(Number(h.net_pay))}</td>
                        <td className="px-4 py-2.5 text-xs text-gray-500 text-center whitespace-nowrap">
                          {h.journal_entry_id ? `#${h.journal_entry_id}` : '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
            <div className="px-5 py-3 bg-gray-50 border-t border-gray-100 flex justify-end flex-shrink-0">
              <button
                onClick={() => setHistoryModalOpen(false)}
                className="px-4 py-1.5 text-xs font-medium text-white bg-red-600 hover:bg-red-700 rounded-md transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SalesRepPayrollPage;
