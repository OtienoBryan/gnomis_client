import { API_CONFIG } from '../config/api';
import { fetchWithAuth } from '../utils/fetchWithAuth';

const BASE = API_CONFIG.getUrl('/payroll');

export interface Account { id: number; account_code: string; account_name: string; account_type: number }
export interface AccountGroups { payment: Account[]; liability: Account[]; expense: Account[]; all: Account[] }

export interface TaxBand { upto: number | string | null; rate: number | string }

export interface StatutoryRule {
  id: number;
  code: string;
  name: string;
  description?: string | null;
  method: 'percentage' | 'flat' | 'bands';
  base: 'gross' | 'basic' | 'taxable';
  employee_rate?: number | string | null;
  employer_rate?: number | string | null;
  employee_amount?: number | string | null;
  employer_amount?: number | string | null;
  min_amount?: number | string | null;
  max_amount?: number | string | null;
  earnings_ceiling?: number | string | null;
  bands: TaxBand[];
  relief_amount?: number | string | null;
  tax_deductible: number | boolean;
  account_id?: number | null;
  employer_account_id?: number | null;
  account_code?: string | null;
  account_name?: string | null;
  sort_order: number;
  is_active: number | boolean;
}

export interface PayrollSettings {
  salary_expense_account_id?: string | null;
  employer_cost_expense_account_id?: string | null;
  other_deductions_account_id?: string | null;
  staff_loans_account_id?: string | null;
}

export interface StaffPayrollRow {
  id: number; name: string; role?: string | null; id_no?: string | null;
  salary: number | string | null;
  kra_pin?: string | null; nssf_no?: string | null; shif_no?: string | null;
  bank_name?: string | null; bank_account?: string | null; exempt_codes?: string | null;
  is_payroll_active: number;
  allowances: number | string; deductions: number | string; loan_balance: number | string;
}

export interface StaffItem { id: number; staff_id: number; item_type: 'allowance' | 'deduction'; name: string; amount: number | string; is_taxable: number; is_active: number }
export interface Loan { id: number; staff_id: number; staff_name?: string; loan_type: string; principal: number | string; monthly_installment: number | string; balance: number | string; start_date: string; status: 'active' | 'closed' | 'cancelled'; notes?: string | null }

export interface PayrollRun {
  id: number; period_year: number; period_month: number; pay_date: string;
  status: 'draft' | 'approved' | 'paid' | 'cancelled';
  payment_account_id?: number | null; journal_entry_id?: number | null;
  total_gross: number | string; total_deductions: number | string; total_net: number | string; total_employer_cost: number | string;
  employee_count: number; notes?: string | null;
}

export interface StatutoryLine { rule_id: number; code: string; name: string; employee: number; employer: number }

export interface RunItem {
  id: number; run_id: number; staff_id: number; staff_name: string;
  basic_salary: number | string; unpaid_days: number | string; extra_earnings: number | string; extra_deductions: number | string;
  allowances_total: number | string; gross_pay: number | string; taxable_income: number | string; paye: number | string;
  statutory_employee: number | string; statutory_employer: number | string; other_deductions: number | string;
  loan_deductions: number | string; total_deductions: number | string; net_pay: number | string;
  statutory: StatutoryLine[]; warning?: string | null;
}

export interface Payslip {
  basic: number; basic_full: number; unpaid_days: number;
  allowances: { name: string; amount: number; taxable: boolean }[]; allowances_total: number; extra_earnings: number;
  gross_pay: number; taxable_gross: number; taxable_income: number;
  statutory: StatutoryLine[]; statutory_employee: number; statutory_employer: number;
  deductions: { name: string; amount: number }[]; extra_deductions: number; other_deductions: number;
  loans: { id: number; name: string; amount: number }[]; loan_deductions: number;
  total_deductions: number; net_pay: number; employer_cost: number;
}

async function request<T = any>(path: string, init: RequestInit = {}): Promise<T> {
  const res = await fetchWithAuth(`${BASE}${path}`, init);
  let json: any = null;
  try { json = await res.json(); } catch { /* non-JSON response */ }
  if (!res.ok || !json || json.success === false) {
    throw new Error(json?.error || json?.message || `Request failed (${res.status})`);
  }
  return json.data as T;
}

const send = (method: string, body?: unknown): RequestInit => ({ method, body: body === undefined ? undefined : JSON.stringify(body) });

export const payrollApi = {
  accounts: () => request<AccountGroups>('/accounts'),
  settings: () => request<PayrollSettings>('/settings'),
  saveSettings: (s: PayrollSettings) => request<PayrollSettings>('/settings', send('PUT', s)),

  saveAccountLinks: (body: { settings: PayrollSettings; rules: { id: number; account_id: number | null; employer_account_id: number | null }[] }) =>
    request('/account-links', send('PUT', body)),

  rules: () => request<StatutoryRule[]>('/statutory-rules'),
  createRule: (r: Partial<StatutoryRule>) => request('/statutory-rules', send('POST', r)),
  updateRule: (id: number, r: Partial<StatutoryRule>) => request(`/statutory-rules/${id}`, send('PUT', r)),
  deleteRule: (id: number) => request(`/statutory-rules/${id}`, send('DELETE')),
  calculate: (body: { basic: number; allowances?: { name: string; amount: number; taxable: boolean }[]; extra_earnings?: number; unpaid_days?: number }) =>
    request<Payslip>('/calculate', send('POST', body)),

  staff: () => request<StaffPayrollRow[]>('/staff-payroll'),
  staffDetail: (id: number) => request<{ staff: any; profile: any; items: StaffItem[]; loans: Loan[] }>(`/staff-payroll/${id}`),
  saveProfile: (id: number, body: any) => request(`/staff-payroll/${id}/profile`, send('PUT', body)),
  addItem: (body: Partial<StaffItem>) => request('/staff-items', send('POST', body)),
  updateItem: (id: number, body: Partial<StaffItem>) => request(`/staff-items/${id}`, send('PUT', body)),
  deleteItem: (id: number) => request(`/staff-items/${id}`, send('DELETE')),

  loans: () => request<Loan[]>('/loans'),
  addLoan: (body: any) => request('/loans', send('POST', body)),
  updateLoan: (id: number, body: any) => request(`/loans/${id}`, send('PUT', body)),

  runs: () => request<PayrollRun[]>('/runs'),
  createRun: (body: { year: number; month: number; pay_date: string; notes?: string }) => request<{ id: number }>('/runs', send('POST', body)),
  run: (id: number) => request<{ run: PayrollRun; items: RunItem[]; statutory_totals: { code: string; name: string; employee: number; employer: number }[] }>(`/runs/${id}`),
  updateRunItem: (id: number, itemId: number, body: any) => request(`/runs/${id}/items/${itemId}`, send('PUT', body)),
  removeRunItem: (id: number, itemId: number) => request(`/runs/${id}/items/${itemId}`, send('DELETE')),
  recalculate: (id: number) => request(`/runs/${id}/recalculate`, send('POST')),
  approve: (id: number) => request(`/runs/${id}/approve`, send('POST')),
  reopen: (id: number) => request(`/runs/${id}/reopen`, send('POST')),
  pay: (id: number, body: { payment_account_id: number; pay_date?: string }) => request(`/runs/${id}/pay`, send('POST', body)),
  deleteRun: (id: number) => request(`/runs/${id}`, send('DELETE')),
  payslip: (id: number, staffId: number) =>
    request<{ run: PayrollRun; staff: any; profile: any; payslip: Payslip }>(`/runs/${id}/payslips/${staffId}`),

  /** Downloads a CSV export (needs the auth header, so a plain link will not work). */
  download: async (id: number, type: string) => {
    const res = await fetchWithAuth(`${BASE}/runs/${id}/export?type=${encodeURIComponent(type)}`);
    if (!res.ok) throw new Error('Export failed');
    const blob = await res.blob();
    const match = /filename="([^"]+)"/.exec(res.headers.get('Content-Disposition') || '');
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = match ? match[1] : `payroll-${type}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  },
};

export const kes = (v: number | string | null | undefined) =>
  Number(v || 0).toLocaleString('en-KE', { style: 'currency', currency: 'KES', minimumFractionDigits: 2 });

export const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
export const periodLabel = (run: { period_year: number; period_month: number }) => `${MONTHS[run.period_month - 1]} ${run.period_year}`;
