import React, { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Pencil, Plus, Trash2, X, Calculator } from 'lucide-react';
import {
  payrollApi, kes, AccountGroups, StatutoryRule, PayrollSettings, Payslip,
} from '../services/payrollService';

const input = 'w-full px-2.5 py-1.5 text-xs border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-red-500';
const label = 'block text-[10px] font-medium text-gray-700 mb-1';

type RuleForm = {
  code: string; name: string; description: string; method: 'percentage' | 'flat' | 'bands'; base: 'gross' | 'basic' | 'taxable';
  employee_rate: string; employer_rate: string; employee_amount: string; employer_amount: string;
  min_amount: string; max_amount: string; earnings_ceiling: string; relief_amount: string;
  tax_deductible: boolean; account_id: string; employer_account_id: string; sort_order: string; is_active: boolean;
  bands: { upto: string; rate: string }[];
};

const emptyForm: RuleForm = {
  code: '', name: '', description: '', method: 'percentage', base: 'gross',
  employee_rate: '', employer_rate: '', employee_amount: '', employer_amount: '',
  min_amount: '', max_amount: '', earnings_ceiling: '', relief_amount: '',
  tax_deductible: false, account_id: '', employer_account_id: '', sort_order: '50', is_active: true,
  bands: [{ upto: '', rate: '' }],
};

const str = (v: unknown) => (v === null || v === undefined ? '' : String(v));

const toForm = (r: StatutoryRule): RuleForm => ({
  code: r.code, name: r.name, description: str(r.description), method: r.method, base: r.base,
  employee_rate: str(r.employee_rate), employer_rate: str(r.employer_rate),
  employee_amount: str(r.employee_amount), employer_amount: str(r.employer_amount),
  min_amount: str(r.min_amount), max_amount: str(r.max_amount), earnings_ceiling: str(r.earnings_ceiling),
  relief_amount: str(r.relief_amount), tax_deductible: !!r.tax_deductible,
  account_id: str(r.account_id), employer_account_id: str(r.employer_account_id),
  sort_order: str(r.sort_order), is_active: !!r.is_active,
  bands: r.bands && r.bands.length ? r.bands.map((b) => ({ upto: str(b.upto), rate: str(b.rate) })) : [{ upto: '', rate: '' }],
});

const describe = (r: StatutoryRule) => {
  if (r.method === 'bands') return `${r.bands.length} tax bands, relief ${kes(r.relief_amount)}`;
  if (r.method === 'flat') return `Flat: employee ${kes(r.employee_amount)} / employer ${kes(r.employer_amount)}`;
  const parts = [`Employee ${Number(r.employee_rate || 0)}%`, `Employer ${Number(r.employer_rate || 0)}%`, `of ${r.base}`];
  if (r.earnings_ceiling) parts.push(`up to ${kes(r.earnings_ceiling)}`);
  if (r.min_amount) parts.push(`min ${kes(r.min_amount)}`);
  if (r.max_amount) parts.push(`max ${kes(r.max_amount)}`);
  return parts.join(' · ');
};

const PayrollStatutoryPage: React.FC = () => {
  const [rules, setRules] = useState<StatutoryRule[]>([]);
  const [accounts, setAccounts] = useState<AccountGroups | null>(null);
  const [settings, setSettings] = useState<PayrollSettings>({});
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const [editing, setEditing] = useState<StatutoryRule | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState<RuleForm>(emptyForm);
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const [calcBasic, setCalcBasic] = useState('50000');
  const [calcAllowance, setCalcAllowance] = useState('0');
  const [calcResult, setCalcResult] = useState<Payslip | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [r, a, s] = await Promise.all([payrollApi.rules(), payrollApi.accounts(), payrollApi.settings()]);
      setRules(r); setAccounts(a); setSettings(s);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const openModal = (rule: StatutoryRule | null) => {
    setEditing(rule);
    setForm(rule ? toForm(rule) : emptyForm);
    setFormError(null);
    setModalOpen(true);
  };

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setFormError(null);
    try {
      const body: any = {
        code: form.code, name: form.name, description: form.description, method: form.method, base: form.base,
        employee_rate: form.employee_rate, employer_rate: form.employer_rate,
        employee_amount: form.employee_amount, employer_amount: form.employer_amount,
        min_amount: form.min_amount, max_amount: form.max_amount, earnings_ceiling: form.earnings_ceiling,
        relief_amount: form.relief_amount, tax_deductible: form.tax_deductible,
        account_id: form.account_id || null, employer_account_id: form.employer_account_id || null,
        sort_order: form.sort_order, is_active: form.is_active,
        bands: form.bands.map((b) => ({ upto: b.upto === '' ? null : Number(b.upto), rate: Number(b.rate) })),
      };
      if (editing) await payrollApi.updateRule(editing.id, body);
      else await payrollApi.createRule(body);
      setModalOpen(false);
      await load();
    } catch (err: any) {
      setFormError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const remove = async (rule: StatutoryRule) => {
    if (!window.confirm(`Delete ${rule.name}? Past payroll runs are not affected, but new runs will no longer apply it.`)) return;
    try { await payrollApi.deleteRule(rule.id); await load(); } catch (e: any) { setError(e.message); }
  };

  const toggleActive = async (rule: StatutoryRule) => {
    try { await payrollApi.updateRule(rule.id, { is_active: !rule.is_active }); await load(); } catch (e: any) { setError(e.message); }
  };

  const saveSettings = async () => {
    setError(null); setNotice(null);
    try { await payrollApi.saveSettings(settings); setNotice('Account settings saved.'); } catch (e: any) { setError(e.message); }
  };

  const runCalc = async () => {
    setError(null);
    try {
      const allowance = Number(calcAllowance || 0);
      setCalcResult(await payrollApi.calculate({
        basic: Number(calcBasic || 0),
        allowances: allowance > 0 ? [{ name: 'Allowances', amount: allowance, taxable: true }] : [],
      }));
    } catch (e: any) { setError(e.message); }
  };

  const setBand = (i: number, patch: Partial<{ upto: string; rate: string }>) =>
    setForm({ ...form, bands: form.bands.map((b, idx) => (idx === i ? { ...b, ...patch } : b)) });

  const accountSelect = (value: string, onChange: (v: string) => void, list: { id: number; account_code: string; account_name: string }[] = []) => (
    <select value={value} onChange={(e) => onChange(e.target.value)} className={input}>
      <option value="">— not linked —</option>
      {list.map((a) => <option key={a.id} value={a.id}>{a.account_code} - {a.account_name}</option>)}
    </select>
  );

  const settingField = (key: keyof PayrollSettings, title: string, list: AccountGroups['all'], hint: string) => (
    <div>
      <label className={label}>{title}</label>
      {accountSelect(settings[key] ? String(settings[key]) : '', (v) => setSettings({ ...settings, [key]: v || null }), list)}
      <p className="text-[10px] text-gray-500 mt-0.5">{hint}</p>
    </div>
  );

  return (
    <div className="min-h-screen bg-gray-50 py-4 px-4 lg:px-6">
      <div className="w-full space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <Link to="/payroll-management" className="inline-flex items-center text-[10px] text-gray-500 hover:text-gray-700 mb-1.5">
              <ArrowLeft className="w-3 h-3 mr-1" /> Back to Payroll
            </Link>
            <h1 className="text-sm font-bold text-gray-900">Statutory Deductions</h1>
            <p className="text-xs text-gray-600">Set PAYE bands, NSSF, SHIF, Housing Levy, NITA and any other statutory deduction. Rates are applied to every new payroll run.</p>
          </div>
          <button onClick={() => openModal(null)} className="inline-flex items-center px-2.5 py-1.5 text-xs font-medium rounded text-white bg-red-600 hover:bg-red-700">
            <Plus className="w-3 h-3 mr-1.5" /> Add Deduction
          </button>
        </div>

        {error && <div className="text-xs text-red-700 bg-red-50 border border-red-200 rounded p-2.5">{error}</div>}
        {notice && <div className="text-xs text-green-700 bg-green-50 border border-green-200 rounded p-2.5">{notice}</div>}

        <div className="bg-amber-50 border border-amber-200 rounded-lg p-2.5 text-[11px] text-amber-900">
          Default rates are pre-loaded as a starting point. Please confirm them against the current KRA, NSSF, SHIF and Housing Levy
          schedules (these change, e.g. the NSSF earnings limit) and adjust here whenever they do.
        </div>

        <div className="bg-white rounded-lg shadow-sm overflow-hidden">
          <div className="px-3 py-2 border-b bg-gray-50 grid grid-cols-12 gap-3 text-[9px] font-medium text-gray-500 uppercase tracking-wider">
            <div className="col-span-3">Deduction</div><div className="col-span-4">Calculation</div>
            <div className="col-span-3">Liability account</div><div className="col-span-1">Status</div><div className="col-span-1 text-right">Actions</div>
          </div>
          {loading ? <div className="p-4 text-xs text-gray-500">Loading…</div> : rules.map((r) => (
            <div key={r.id} className="px-3 py-2 border-b last:border-0 grid grid-cols-12 gap-3 items-center hover:bg-gray-50">
              <div className="col-span-3">
                <div className="text-xs font-medium text-gray-900">{r.name}</div>
                <div className="text-[10px] text-gray-500">{r.code}{r.tax_deductible ? ' · reduces taxable pay' : ''}</div>
              </div>
              <div className="col-span-4 text-xs text-gray-700">{describe(r)}</div>
              <div className="col-span-3 text-xs">{r.account_code ? `${r.account_code} - ${r.account_name}` : <span className="text-red-600">Not linked</span>}</div>
              <div className="col-span-1">
                <button onClick={() => toggleActive(r)} className={`px-1.5 py-0.5 text-[10px] rounded-full border ${r.is_active ? 'bg-green-100 text-green-800 border-green-200' : 'bg-gray-100 text-gray-600 border-gray-200'}`}>
                  {r.is_active ? 'Active' : 'Off'}
                </button>
              </div>
              <div className="col-span-1 flex justify-end gap-1.5">
                <button onClick={() => openModal(r)} title="Edit" className="text-gray-400 hover:text-red-600"><Pencil className="w-3.5 h-3.5" /></button>
                <button onClick={() => remove(r)} title="Delete" className="text-gray-400 hover:text-red-600"><Trash2 className="w-3.5 h-3.5" /></button>
              </div>
            </div>
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div className="bg-white rounded-lg shadow-sm p-4 space-y-3">
            <h2 className="text-xs font-semibold text-gray-900">Ledger accounts for posting payroll</h2>
            <p className="text-[11px] text-gray-500">Used when a payroll run is marked as paid. Each statutory deduction posts to its own liability account (set above).</p>
            {settingField('salary_expense_account_id', 'Salaries expense account *', accounts?.expense || [], 'Debited with total gross pay')}
            {settingField('employer_cost_expense_account_id', 'Employer contributions expense', accounts?.expense || [], 'Debited with employer NSSF / Housing Levy / NITA (defaults to the salaries account)')}
            {settingField('other_deductions_account_id', 'Other deductions payable', accounts?.liability || [], 'Credited with recurring/one-off non-statutory deductions (e.g. SACCO)')}
            {settingField('staff_loans_account_id', 'Staff loans receivable', accounts?.all || [], 'Credited when loan/advance instalments are recovered')}
            <button onClick={saveSettings} className="px-3 py-1.5 text-xs font-medium text-white bg-red-600 hover:bg-red-700 rounded">Save accounts</button>
          </div>

          <div className="bg-white rounded-lg shadow-sm p-4 space-y-3">
            <h2 className="text-xs font-semibold text-gray-900 flex items-center gap-1.5"><Calculator className="w-3.5 h-3.5" /> Try the calculator</h2>
            <div className="grid grid-cols-2 gap-3">
              <div><label className={label}>Basic salary</label><input type="number" min="0" className={input} value={calcBasic} onChange={(e) => setCalcBasic(e.target.value)} /></div>
              <div><label className={label}>Taxable allowances</label><input type="number" min="0" className={input} value={calcAllowance} onChange={(e) => setCalcAllowance(e.target.value)} /></div>
            </div>
            <button onClick={runCalc} className="px-3 py-1.5 text-xs font-medium text-gray-700 bg-gray-100 border border-gray-300 rounded hover:bg-gray-200">Calculate</button>
            {calcResult && (
              <table className="w-full text-xs">
                <tbody>
                  <tr><td className="py-0.5 text-gray-600">Gross pay</td><td className="text-right">{kes(calcResult.gross_pay)}</td></tr>
                  {calcResult.statutory.filter((s) => s.employee > 0).map((s) => (
                    <tr key={s.code}><td className="py-0.5 text-gray-600">{s.name}</td><td className="text-right text-red-600">- {kes(s.employee)}</td></tr>
                  ))}
                  <tr className="border-t font-semibold"><td className="py-1">Net pay</td><td className="text-right text-green-700">{kes(calcResult.net_pay)}</td></tr>
                  <tr><td className="py-0.5 text-gray-500">Employer contributions</td><td className="text-right text-gray-500">{kes(calcResult.statutory_employer)}</td></tr>
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>

      {modalOpen && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto z-50">
          <div className="relative top-8 mx-auto p-4 w-11/12 max-w-2xl bg-white rounded-md shadow-lg mb-8">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-xs font-medium text-gray-900">{editing ? `Edit ${editing.name}` : 'Add statutory deduction'}</h3>
              <button onClick={() => setModalOpen(false)} className="text-gray-400 hover:text-gray-600"><X className="h-4 w-4" /></button>
            </div>
            <form onSubmit={save} className="space-y-3">
              {formError && <div className="text-xs text-red-600 bg-red-50 border border-red-200 rounded px-3 py-2">{formError}</div>}
              <div className="grid grid-cols-3 gap-3">
                <div><label className={label}>Code *</label><input className={input} value={form.code} disabled={!!editing} onChange={(e) => setForm({ ...form, code: e.target.value })} placeholder="e.g. PAYE" required /></div>
                <div className="col-span-2"><label className={label}>Name *</label><input className={input} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required /></div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={label}>Calculation method</label>
                  <select className={input} value={form.method} onChange={(e) => setForm({ ...form, method: e.target.value as RuleForm['method'] })}>
                    <option value="percentage">Percentage of pay</option>
                    <option value="flat">Flat amount per employee</option>
                    <option value="bands">Progressive tax bands (PAYE)</option>
                  </select>
                </div>
                {form.method === 'percentage' && (
                  <div>
                    <label className={label}>Calculated on</label>
                    <select className={input} value={form.base} onChange={(e) => setForm({ ...form, base: e.target.value as RuleForm['base'] })}>
                      <option value="gross">Gross pay</option><option value="basic">Basic salary</option><option value="taxable">Taxable pay</option>
                    </select>
                  </div>
                )}
              </div>

              {form.method === 'percentage' && (
                <>
                  <div className="grid grid-cols-2 gap-3">
                    <div><label className={label}>Employee rate (%)</label><input type="number" step="0.0001" min="0" className={input} value={form.employee_rate} onChange={(e) => setForm({ ...form, employee_rate: e.target.value })} /></div>
                    <div><label className={label}>Employer rate (%)</label><input type="number" step="0.0001" min="0" className={input} value={form.employer_rate} onChange={(e) => setForm({ ...form, employer_rate: e.target.value })} /></div>
                  </div>
                  <div className="grid grid-cols-3 gap-3">
                    <div><label className={label}>Pay ceiling (KES)</label><input type="number" min="0" className={input} value={form.earnings_ceiling} onChange={(e) => setForm({ ...form, earnings_ceiling: e.target.value })} placeholder="optional" /></div>
                    <div><label className={label}>Minimum deduction</label><input type="number" min="0" className={input} value={form.min_amount} onChange={(e) => setForm({ ...form, min_amount: e.target.value })} placeholder="optional" /></div>
                    <div><label className={label}>Maximum deduction</label><input type="number" min="0" className={input} value={form.max_amount} onChange={(e) => setForm({ ...form, max_amount: e.target.value })} placeholder="optional" /></div>
                  </div>
                </>
              )}

              {form.method === 'flat' && (
                <div className="grid grid-cols-2 gap-3">
                  <div><label className={label}>Employee amount (KES)</label><input type="number" min="0" step="0.01" className={input} value={form.employee_amount} onChange={(e) => setForm({ ...form, employee_amount: e.target.value })} /></div>
                  <div><label className={label}>Employer amount (KES)</label><input type="number" min="0" step="0.01" className={input} value={form.employer_amount} onChange={(e) => setForm({ ...form, employer_amount: e.target.value })} /></div>
                </div>
              )}

              {form.method === 'bands' && (
                <div className="space-y-2">
                  <label className={label}>Monthly tax bands (leave “up to” empty for the top band)</label>
                  {form.bands.map((b, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <span className="text-[10px] text-gray-500 w-12">Up to</span>
                      <input type="number" min="0" className={input} value={b.upto} onChange={(e) => setBand(i, { upto: e.target.value })} placeholder="no limit" />
                      <span className="text-[10px] text-gray-500 w-8">Rate</span>
                      <input type="number" min="0" step="0.01" className={input} value={b.rate} onChange={(e) => setBand(i, { rate: e.target.value })} placeholder="%" required />
                      <button type="button" onClick={() => setForm({ ...form, bands: form.bands.filter((_, idx) => idx !== i) })} className="text-gray-400 hover:text-red-600" disabled={form.bands.length === 1}><Trash2 className="w-3.5 h-3.5" /></button>
                    </div>
                  ))}
                  <button type="button" onClick={() => setForm({ ...form, bands: [...form.bands, { upto: '', rate: '' }] })} className="text-xs text-red-600 hover:underline">+ Add band</button>
                  <div className="w-1/2"><label className={label}>Personal relief (KES per month)</label><input type="number" min="0" step="0.01" className={input} value={form.relief_amount} onChange={(e) => setForm({ ...form, relief_amount: e.target.value })} /></div>
                </div>
              )}

              {form.method !== 'bands' && (
                <label className="flex items-center gap-2 text-xs text-gray-700">
                  <input type="checkbox" checked={form.tax_deductible} onChange={(e) => setForm({ ...form, tax_deductible: e.target.checked })} />
                  Employee contribution is deducted before PAYE is calculated (reduces taxable pay)
                </label>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div><label className={label}>Liability account (employee share)</label>{accountSelect(form.account_id, (v) => setForm({ ...form, account_id: v }), accounts?.liability)}</div>
                <div><label className={label}>Liability account (employer share, optional)</label>{accountSelect(form.employer_account_id, (v) => setForm({ ...form, employer_account_id: v }), accounts?.liability)}</div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div><label className={label}>Description</label><input className={input} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></div>
                <div><label className={label}>Order</label><input type="number" className={input} value={form.sort_order} onChange={(e) => setForm({ ...form, sort_order: e.target.value })} /></div>
              </div>
              <label className="flex items-center gap-2 text-xs text-gray-700"><input type="checkbox" checked={form.is_active} onChange={(e) => setForm({ ...form, is_active: e.target.checked })} /> Active</label>
              <div className="flex justify-end gap-2 pt-2">
                <button type="button" onClick={() => setModalOpen(false)} className="px-3 py-1.5 text-xs text-gray-700 bg-gray-100 border border-gray-300 rounded hover:bg-gray-200">Cancel</button>
                <button type="submit" disabled={saving} className="px-3 py-1.5 text-xs text-white bg-red-600 hover:bg-red-700 rounded disabled:opacity-50">{saving ? 'Saving…' : 'Save'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default PayrollStatutoryPage;
