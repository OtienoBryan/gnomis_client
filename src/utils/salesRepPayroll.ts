import { SalesRep } from '../services/salesService';

/** Shared sales-rep payroll calculation, used by the payroll overview and the Run Payroll page. */

export interface LoginHistory {
  id: number;
  userId: number;
  sessionStart: string;
  sessionEnd?: string;
}

export interface Leave {
  id: number;
  userId: number;
  startDate: string;
  endDate: string;
  status: string | number;
}

export interface Deduction {
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

export interface DeductionLine {
  deduction: Deduction;
  amount: number;
}

export interface Account {
  id: number;
  account_code: string;
  account_name: string;
}

export interface RepPayroll {
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
  /** Approved deductions posted on the Sales Rep Deductions page for the period (not part of totalDeductions) */
  extraDeduction: number;
  /** Salary advance recovered from this period's pay (approved advances with a balance, up to the pay left) */
  advanceRecovery: number;
  /** Total outstanding approved advance balance, recovered or not this period */
  advanceBalance: number;
  netPay: number;
}

export const getDaysInMonth = (year: number, month: number) => new Date(year, month + 1, 0).getDate();

// Local-calendar ISO date (avoids UTC rollback near month boundaries in timezones ahead of UTC)
export const toLocalISODate = (d: Date) => {
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
};

export const formatKES = (amount: number) =>
  amount.toLocaleString('en-KE', { style: 'currency', currency: 'KES', minimumFractionDigits: 2, maximumFractionDigits: 2 });

export const calculateDeductionAmount = (deduction: Deduction, grossPay: number): number => {
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

/** Every calendar day in the range (up to today) except Sundays counts as a working day. */
export const countWorkingDays = (startDate: string, endDate: string): number => {
  const start = new Date(startDate);
  const end = new Date(endDate);
  const today = new Date();
  today.setHours(23, 59, 59, 999);
  let count = 0;
  for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
    if (d <= today && d.getDay() !== 0) count++;
  }
  return count;
};

export const computeRepPayroll = (
  rep: SalesRep,
  ctx: {
    loginHistory: LoginHistory[];
    leaves: Leave[];
    activeDeductions: Deduction[];
    numWorkingDays: number;
    rangeStart: Date;
    rangeEnd: Date;
    extraDeduction?: number;
    /** Outstanding balance of the rep's approved salary advances */
    advanceBalance?: number;
  }
): RepPayroll => {
  const { loginHistory, leaves, activeDeductions, numWorkingDays, rangeStart, rangeEnd } = ctx;
  const extraDeduction = ctx.extraDeduction || 0;
  const advanceBalance = ctx.advanceBalance || 0;

  const presentDays = new Set(
    loginHistory
      .filter(lh => lh.userId === rep.id && lh.sessionStart &&
        new Date(lh.sessionStart) >= rangeStart && new Date(lh.sessionStart) <= rangeEnd)
      .map(lh => lh.sessionStart.slice(0, 10))
      .filter(day => new Date(`${day}T00:00:00Z`).getUTCDay() !== 0) // Sunday is not a working day
  );

  const repLeaves = leaves.filter(lv => String(lv.userId) === String(rep.id) && (lv.status === 1 || lv.status === '1'));
  let leaveDays = 0;
  const today = new Date();
  today.setHours(23, 59, 59, 999);
  repLeaves.forEach(lv => {
    const leaveStart = new Date(lv.startDate) < rangeStart ? rangeStart : new Date(lv.startDate);
    const leaveEnd = new Date(lv.endDate) > rangeEnd ? rangeEnd : new Date(lv.endDate);
    for (let d = new Date(leaveStart); d <= leaveEnd; d.setDate(d.getDate() + 1)) {
      if (d >= rangeStart && d <= rangeEnd && d <= today && d.getDay() !== 0) leaveDays++;
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
  // Advances are recovered only from the pay that is left after the other deductions
  const payLeft = Math.max(0, grossPay - totalDeductions - extraDeduction);
  const advanceRecovery = Math.floor(Math.min(advanceBalance, payLeft) * 100) / 100;

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
    extraDeduction,
    advanceRecovery,
    advanceBalance,
    netPay: grossPay - totalDeductions - extraDeduction - advanceRecovery,
  };
};

/** Sum approved extra deductions per sales rep (pending and rejected are ignored). */
export const sumApprovedExtraByRep = (rows: { sales_rep_id: number; amount: number | string; status: string }[]) => {
  const map = new Map<number, number>();
  rows.forEach(d => {
    if (d.status !== 'approved') return;
    map.set(d.sales_rep_id, (map.get(d.sales_rep_id) || 0) + Number(d.amount || 0));
  });
  return map;
};

/** Outstanding (approved, not yet fully recovered) salary advance balance per sales rep. */
export const sumAdvanceBalanceByRep = (
  rows: { sales_rep_id: number; amount: number | string; recovered_amount: number | string; status: string }[]
) => {
  const map = new Map<number, number>();
  rows.forEach(a => {
    if (a.status !== 'approved') return;
    const balance = Number(a.amount || 0) - Number(a.recovered_amount || 0);
    if (balance > 0) map.set(a.sales_rep_id, (map.get(a.sales_rep_id) || 0) + balance);
  });
  return map;
};
