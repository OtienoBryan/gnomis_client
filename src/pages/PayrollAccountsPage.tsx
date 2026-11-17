import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, CheckCircle2, AlertCircle } from 'lucide-react';
import { payrollApi, AccountGroups, Account, StatutoryRule, PayrollSettings } from '../services/payrollService';

const select = 'w-full px-2.5 py-1.5 text-xs border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-red-500';

type RuleLinks = Record<number, { account_id: string; employer_account_id: string }>;

const AccountSelect: React.FC<{ value: string; onChange: (v: string) => void; list: Account[]; missing?: boolean }> = ({ value, onChange, list, missing }) => (
  <select value={value} onChange={(e) => onChange(e.target.value)} className={`${select} ${missing ? 'border-red-300 bg-red-50' : ''}`}>
    <option value="">— not linked —</option>
    {list.map((a) => <option key={a.id} value={a.id}>{a.account_code} - {a.account_name}</option>)}
  </select>
);

const Status: React.FC<{ ok: boolean; optional?: boolean }> = ({ ok, optional }) =>
  ok ? <CheckCircle2 className="w-4 h-4 text-green-600" />
    : optional ? <span className="text-[10px] text-gray-400">optional</span>
    : <AlertCircle className="w-4 h-4 text-red-500" />;

const PayrollAccountsPage: React.FC = () => {
  const [accounts, setAccounts] = useState<AccountGroups | null>(null);
  const [rules, setRules] = useState<StatutoryRule[]>([]);
  const [settings, setSettings] = useState<PayrollSettings>({});
  const [links, setLinks] = useState<RuleLinks>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [a, r, s] = await Promise.all([payrollApi.accounts(), payrollApi.rules(), payrollApi.settings()]);
      setAccounts(a); setRules(r); setSettings(s);
      setLinks(Object.fromEntries(r.map((x) => [x.id, {
        account_id: x.account_id ? String(x.account_id) : '',
        employer_account_id: x.employer_account_id ? String(x.employer_account_id) : '',
      }])));
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const activeRules = useMemo(() => rules.filter((r) => r.is_active), [rules]);

  const missing = useMemo(() => {
    const list: string[] = [];
    if (!settings.salary_expense_account_id) list.push('Salaries expense account');
    activeRules.forEach((r) => { if (!links[r.id]?.account_id) list.push(`${r.code} liability account`); });
    return list;
  }, [settings, activeRules, links]);

  const setSetting = (key: keyof PayrollSettings, v: string) => setSettings({ ...settings, [key]: v || null });
  const setLink = (id: number, patch: Partial<RuleLinks[number]>) => setLinks({ ...links, [id]: { ...links[id], ...patch } });

  const save = async () => {
    setSaving(true); setError(null); setNotice(null);
    try {
      await payrollApi.saveAccountLinks({
        settings,
        rules: rules.map((r) => ({
          id: r.id,
          account_id: links[r.id]?.account_id ? Number(links[r.id].account_id) : null,
          employer_account_id: links[r.id]?.employer_account_id ? Number(links[r.id].employer_account_id) : null,
        })),
      });
      setNotice('Account links saved.');
      await load();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  };

  const noAccounts = accounts && accounts.payment.length + accounts.liability.length + accounts.expense.length === 0;

  return (
    <div className="min-h-screen bg-gray-50 py-4 px-4">
      <div className="max-w-4xl mx-auto space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
          <div>
            <Link to="/payroll-management" className="inline-flex items-center text-[10px] text-gray-500 hover:text-gray-700 mb-1.5">
              <ArrowLeft className="w-3 h-3 mr-1" /> Back to Payroll
            </Link>
            <h1 className="text-sm font-bold text-gray-900">Payroll Account Links</h1>
            <p className="text-xs text-gray-600">Choose the ledger accounts payroll posts to when a run is marked as paid.</p>
          </div>
          <button onClick={save} disabled={saving || loading} className="px-3 py-1.5 text-xs font-medium text-white bg-red-600 hover:bg-red-700 rounded disabled:opacity-50">
            {saving ? 'Saving…' : 'Save all links'}
          </button>
        </div>

        {error && <div className="text-xs text-red-700 bg-red-50 border border-red-200 rounded p-2.5">{error}</div>}
        {notice && <div className="text-xs text-green-700 bg-green-50 border border-green-200 rounded p-2.5">{notice}</div>}

        {!loading && (missing.length === 0
          ? <div className="text-xs text-green-800 bg-green-50 border border-green-200 rounded p-2.5">All required accounts are linked. Payroll runs can be paid.</div>
          : <div className="text-xs text-amber-900 bg-amber-50 border border-amber-200 rounded p-2.5">
              Still to link before a run can be paid: {missing.join(', ')}. (Unsaved selections count once you press Save.)
            </div>)}

        {noAccounts && (
          <div className="text-xs text-red-700 bg-red-50 border border-red-200 rounded p-2.5">
            No usable accounts were found in the chart of accounts. Create expense (type 16/5) and current liability (type 10) accounts in
            {' '}<Link to="/dashboard/reports/chart-of-accounts" className="underline">Chart of Accounts</Link> first.
          </div>
        )}

        {loading ? <div className="text-xs text-gray-500">Loading…</div> : accounts && (
          <>
            <section className="bg-white rounded-lg shadow-sm p-4 space-y-3">
              <h2 className="text-xs font-semibold text-gray-900">Expense &amp; other accounts</h2>
              {([
                ['salary_expense_account_id', 'Salaries expense', 'Debited with total gross pay.', accounts.expense, false],
                ['employer_cost_expense_account_id', 'Employer contributions expense', 'Debited with employer NSSF / Housing Levy / NITA. Falls back to the salaries expense account.', accounts.expense, true],
                ['other_deductions_account_id', 'Other deductions payable', 'Credited with recurring and one-off deductions that are not statutory (e.g. SACCO). Needed only if you use them.', accounts.liability, true],
                ['staff_loans_account_id', 'Staff loans receivable', 'Credited when loan or advance instalments are recovered. Needed only if you use loans.', accounts.all, true],
              ] as [keyof PayrollSettings, string, string, Account[], boolean][]).map(([key, title, hint, list, optional]) => (
                <div key={key} className="grid grid-cols-12 gap-3 items-start">
                  <div className="col-span-12 md:col-span-5">
                    <div className="text-xs font-medium text-gray-900">{title}</div>
                    <div className="text-[10px] text-gray-500">{hint}</div>
                  </div>
                  <div className="col-span-10 md:col-span-6">
                    <AccountSelect value={settings[key] ? String(settings[key]) : ''} onChange={(v) => setSetting(key, v)} list={list} missing={!optional && !settings[key]} />
                  </div>
                  <div className="col-span-2 md:col-span-1 flex justify-end pt-1.5"><Status ok={!!settings[key]} optional={optional} /></div>
                </div>
              ))}
            </section>

            <section className="bg-white rounded-lg shadow-sm p-4 space-y-3">
              <div>
                <h2 className="text-xs font-semibold text-gray-900">Statutory deduction liability accounts</h2>
                <p className="text-[10px] text-gray-500">Amounts withheld from staff, and employer contributions, are credited here until remitted. Leave the employer account empty to use the same account for both.</p>
              </div>
              {activeRules.length === 0 && <div className="text-xs text-gray-500">No active statutory deductions. Add them under <Link to="/payroll-statutory" className="underline">Statutory Deductions</Link>.</div>}
              {activeRules.map((r) => (
                <div key={r.id} className="grid grid-cols-12 gap-3 items-start">
                  <div className="col-span-12 md:col-span-3">
                    <div className="text-xs font-medium text-gray-900">{r.name}</div>
                    <div className="text-[10px] text-gray-500">{r.code}</div>
                  </div>
                  <div className="col-span-12 md:col-span-4">
                    <div className="text-[10px] text-gray-500 mb-0.5">Employee share</div>
                    <AccountSelect value={links[r.id]?.account_id || ''} onChange={(v) => setLink(r.id, { account_id: v })} list={accounts.liability} missing={!links[r.id]?.account_id} />
                  </div>
                  <div className="col-span-10 md:col-span-4">
                    <div className="text-[10px] text-gray-500 mb-0.5">Employer share (optional)</div>
                    <AccountSelect value={links[r.id]?.employer_account_id || ''} onChange={(v) => setLink(r.id, { employer_account_id: v })} list={accounts.liability} />
                  </div>
                  <div className="col-span-2 md:col-span-1 flex justify-end pt-4"><Status ok={!!links[r.id]?.account_id} /></div>
                </div>
              ))}
            </section>

            <section className="bg-white rounded-lg shadow-sm p-4">
              <h2 className="text-xs font-semibold text-gray-900 mb-1">Chosen when paying</h2>
              <p className="text-[11px] text-gray-600">
                The cash/bank account net pay is paid from is picked on each run when you press “Mark as paid” ({accounts.payment.length} cash/bank
                account{accounts.payment.length === 1 ? '' : 's'} available).
              </p>
            </section>
          </>
        )}
      </div>
    </div>
  );
};

export default PayrollAccountsPage;
