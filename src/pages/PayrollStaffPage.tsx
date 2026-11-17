import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Search, Pencil, X, Trash2 } from 'lucide-react';
import { payrollApi, kes, StaffPayrollRow, StaffItem, Loan, StatutoryRule } from '../services/payrollService';

const input = 'w-full px-2.5 py-1.5 text-xs border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-red-500';
const label = 'block text-[10px] font-medium text-gray-700 mb-1';

const PayrollStaffPage: React.FC = () => {
  const [rows, setRows] = useState<StaffPayrollRow[]>([]);
  const [rules, setRules] = useState<StatutoryRule[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [selected, setSelected] = useState<StaffPayrollRow | null>(null);
  const [profile, setProfile] = useState({
    basic_salary: '', id_no: '', kra_pin: '', nssf_no: '', shif_no: '', bank_name: '', bank_account: '',
    exempt_codes: [] as string[], is_payroll_active: true,
  });
  const [items, setItems] = useState<StaffItem[]>([]);
  const [loans, setLoans] = useState<Loan[]>([]);
  const [modalError, setModalError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const [newItem, setNewItem] = useState({ item_type: 'allowance' as 'allowance' | 'deduction', name: '', amount: '', is_taxable: true });
  const [newLoan, setNewLoan] = useState({ loan_type: 'Salary advance', principal: '', monthly_installment: '', start_date: new Date().toISOString().slice(0, 10) });

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [s, r] = await Promise.all([payrollApi.staff(), payrollApi.rules()]);
      setRows(s); setRules(r);
    } catch (e: any) { setError(e.message); } finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return q ? rows.filter((r) => `${r.name} ${r.role || ''} ${r.id_no || ''} ${r.kra_pin || ''}`.toLowerCase().includes(q)) : rows;
  }, [rows, search]);

  const loadDetail = async (id: number) => {
    const d = await payrollApi.staffDetail(id);
    setItems(d.items);
    setLoans(d.loans);
  };

  const open = async (row: StaffPayrollRow) => {
    setSelected(row);
    setModalError(null);
    setProfile({
      basic_salary: row.salary != null ? String(row.salary) : '',
      id_no: row.id_no || '', kra_pin: row.kra_pin || '', nssf_no: row.nssf_no || '', shif_no: row.shif_no || '',
      bank_name: row.bank_name || '', bank_account: row.bank_account || '',
      exempt_codes: row.exempt_codes ? row.exempt_codes.split(',').filter(Boolean) : [],
      is_payroll_active: !!row.is_payroll_active,
    });
    setItems([]); setLoans([]);
    try { await loadDetail(row.id); } catch (e: any) { setModalError(e.message); }
  };

  const saveProfile = async () => {
    if (!selected) return;
    setSaving(true); setModalError(null);
    try {
      await payrollApi.saveProfile(selected.id, profile);
      await load();
      setSelected(null);
    } catch (e: any) { setModalError(e.message); } finally { setSaving(false); }
  };

  const addItem = async () => {
    if (!selected) return;
    setModalError(null);
    try {
      await payrollApi.addItem({ staff_id: selected.id, ...newItem, amount: newItem.amount, is_taxable: newItem.item_type === 'allowance' ? (newItem.is_taxable ? 1 : 0) : 1 });
      setNewItem({ ...newItem, name: '', amount: '' });
      await loadDetail(selected.id);
    } catch (e: any) { setModalError(e.message); }
  };

  const removeItem = async (id: number) => {
    if (!selected) return;
    try { await payrollApi.deleteItem(id); await loadDetail(selected.id); } catch (e: any) { setModalError(e.message); }
  };

  const addLoan = async () => {
    if (!selected) return;
    setModalError(null);
    try {
      await payrollApi.addLoan({ staff_id: selected.id, ...newLoan });
      setNewLoan({ ...newLoan, principal: '', monthly_installment: '' });
      await loadDetail(selected.id);
    } catch (e: any) { setModalError(e.message); }
  };

  const setLoanStatus = async (loan: Loan, status: 'active' | 'closed' | 'cancelled') => {
    if (!selected) return;
    try { await payrollApi.updateLoan(loan.id, { status }); await loadDetail(selected.id); } catch (e: any) { setModalError(e.message); }
  };

  const toggleExempt = (code: string) =>
    setProfile((p) => ({ ...p, exempt_codes: p.exempt_codes.includes(code) ? p.exempt_codes.filter((c) => c !== code) : [...p.exempt_codes, code] }));

  return (
    <div className="min-h-screen bg-gray-50 py-4 px-4">
      <div className="max-w-6xl mx-auto space-y-3">
        <div>
          <Link to="/payroll-management" className="inline-flex items-center text-[10px] text-gray-500 hover:text-gray-700 mb-1.5">
            <ArrowLeft className="w-3 h-3 mr-1" /> Back to Payroll
          </Link>
          <h1 className="text-sm font-bold text-gray-900">Staff Payroll Setup</h1>
          <p className="text-xs text-gray-600">Salaries, statutory numbers, bank details, recurring allowances/deductions, exemptions and staff loans.</p>
        </div>

        {error && <div className="text-xs text-red-700 bg-red-50 border border-red-200 rounded p-2.5">{error}</div>}

        <div className="bg-white rounded-lg shadow-sm p-3">
          <div className="relative">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-400 w-3 h-3" />
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search staff…" className="w-full pl-7 pr-3 py-1.5 text-xs border border-gray-300 rounded" />
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm overflow-x-auto">
          <table className="min-w-full text-xs">
            <thead className="bg-gray-50 text-[9px] uppercase tracking-wider text-gray-500">
              <tr>
                {['Name', 'Role', 'Basic salary', 'Allowances', 'Deductions', 'Loan balance', 'KRA PIN', 'Bank', 'Payroll', ''].map((h) => <th key={h} className="px-3 py-2 text-left font-medium">{h}</th>)}
              </tr>
            </thead>
            <tbody className="divide-y">
              {loading ? <tr><td colSpan={10} className="p-4 text-gray-500">Loading…</td></tr>
                : filtered.length === 0 ? <tr><td colSpan={10} className="p-4 text-gray-500">No staff found</td></tr>
                : filtered.map((r) => (
                  <tr key={r.id} className="hover:bg-gray-50">
                    <td className="px-3 py-2 font-medium text-gray-900">{r.name}</td>
                    <td className="px-3 py-2">{r.role}</td>
                    <td className="px-3 py-2">{Number(r.salary) > 0 ? kes(r.salary) : <span className="text-red-600">Not set</span>}</td>
                    <td className="px-3 py-2">{Number(r.allowances) ? kes(r.allowances) : '—'}</td>
                    <td className="px-3 py-2">{Number(r.deductions) ? kes(r.deductions) : '—'}</td>
                    <td className="px-3 py-2">{Number(r.loan_balance) ? kes(r.loan_balance) : '—'}</td>
                    <td className="px-3 py-2">{r.kra_pin || <span className="text-amber-600">Missing</span>}</td>
                    <td className="px-3 py-2">{r.bank_name ? `${r.bank_name} ${r.bank_account || ''}` : <span className="text-gray-400">—</span>}</td>
                    <td className="px-3 py-2">{r.is_payroll_active ? 'Included' : <span className="text-gray-500">Excluded</span>}</td>
                    <td className="px-3 py-2 text-right"><button onClick={() => open(r)} className="text-gray-400 hover:text-red-600" title="Edit"><Pencil className="w-3.5 h-3.5" /></button></td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      </div>

      {selected && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto z-50">
          <div className="relative top-6 mx-auto p-4 w-11/12 max-w-3xl bg-white rounded-md shadow-lg mb-8 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-semibold text-gray-900">{selected.name} — payroll setup</h3>
              <button onClick={() => setSelected(null)} className="text-gray-400 hover:text-gray-600"><X className="h-4 w-4" /></button>
            </div>
            {modalError && <div className="text-xs text-red-600 bg-red-50 border border-red-200 rounded px-3 py-2">{modalError}</div>}

            <section className="grid grid-cols-2 md:grid-cols-3 gap-3">
              <div><label className={label}>Basic salary (KES / month)</label><input type="number" min="0" step="0.01" className={input} value={profile.basic_salary} onChange={(e) => setProfile({ ...profile, basic_salary: e.target.value })} /></div>
              <div><label className={label}>National ID No</label><input className={input} value={profile.id_no} onChange={(e) => setProfile({ ...profile, id_no: e.target.value })} /></div>
              <div><label className={label}>KRA PIN</label><input className={input} value={profile.kra_pin} onChange={(e) => setProfile({ ...profile, kra_pin: e.target.value.toUpperCase() })} /></div>
              <div><label className={label}>NSSF No</label><input className={input} value={profile.nssf_no} onChange={(e) => setProfile({ ...profile, nssf_no: e.target.value })} /></div>
              <div><label className={label}>SHIF No</label><input className={input} value={profile.shif_no} onChange={(e) => setProfile({ ...profile, shif_no: e.target.value })} /></div>
              <div><label className={label}>Bank</label><input className={input} value={profile.bank_name} onChange={(e) => setProfile({ ...profile, bank_name: e.target.value })} /></div>
              <div><label className={label}>Account number</label><input className={input} value={profile.bank_account} onChange={(e) => setProfile({ ...profile, bank_account: e.target.value })} /></div>
            </section>

            <section>
              <div className="text-[10px] font-medium text-gray-700 mb-1">Exempt from (tick to skip for this employee)</div>
              <div className="flex flex-wrap gap-3">
                {rules.map((r) => (
                  <label key={r.id} className="flex items-center gap-1.5 text-xs text-gray-700">
                    <input type="checkbox" checked={profile.exempt_codes.includes(r.code)} onChange={() => toggleExempt(r.code)} /> {r.code}
                  </label>
                ))}
              </div>
              <label className="flex items-center gap-1.5 text-xs text-gray-700 mt-2">
                <input type="checkbox" checked={profile.is_payroll_active} onChange={(e) => setProfile({ ...profile, is_payroll_active: e.target.checked })} /> Include in payroll runs
              </label>
            </section>

            <section className="border-t pt-3">
              <h4 className="text-xs font-semibold text-gray-900 mb-2">Recurring allowances &amp; deductions</h4>
              {items.length === 0 ? <p className="text-xs text-gray-500 mb-2">None yet.</p> : (
                <table className="w-full text-xs mb-2">
                  <tbody>
                    {items.map((i) => (
                      <tr key={i.id} className="border-b last:border-0">
                        <td className="py-1">{i.name}</td>
                        <td className="py-1 text-gray-500">{i.item_type}{i.item_type === 'allowance' ? (i.is_taxable ? ' · taxable' : ' · non-taxable') : ''}</td>
                        <td className="py-1 text-right">{kes(i.amount)}</td>
                        <td className="py-1 text-right w-8"><button onClick={() => removeItem(i.id)} className="text-gray-400 hover:text-red-600"><Trash2 className="w-3.5 h-3.5" /></button></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
              <div className="grid grid-cols-2 md:grid-cols-5 gap-2 items-end">
                <select className={input} value={newItem.item_type} onChange={(e) => setNewItem({ ...newItem, item_type: e.target.value as 'allowance' | 'deduction' })}>
                  <option value="allowance">Allowance</option><option value="deduction">Deduction</option>
                </select>
                <input className={input} placeholder="Name (e.g. House allowance)" value={newItem.name} onChange={(e) => setNewItem({ ...newItem, name: e.target.value })} />
                <input className={input} type="number" min="0" step="0.01" placeholder="Amount" value={newItem.amount} onChange={(e) => setNewItem({ ...newItem, amount: e.target.value })} />
                {newItem.item_type === 'allowance'
                  ? <label className="flex items-center gap-1.5 text-xs"><input type="checkbox" checked={newItem.is_taxable} onChange={(e) => setNewItem({ ...newItem, is_taxable: e.target.checked })} /> Taxable</label>
                  : <span />}
                <button onClick={addItem} className="px-2.5 py-1.5 text-xs bg-gray-100 border border-gray-300 rounded hover:bg-gray-200">Add</button>
              </div>
            </section>

            <section className="border-t pt-3">
              <h4 className="text-xs font-semibold text-gray-900 mb-2">Loans &amp; salary advances</h4>
              {loans.length > 0 && (
                <table className="w-full text-xs mb-2">
                  <thead className="text-[9px] uppercase text-gray-500"><tr><th className="text-left">Type</th><th className="text-right">Principal</th><th className="text-right">Instalment</th><th className="text-right">Balance</th><th className="text-right">Status</th></tr></thead>
                  <tbody>
                    {loans.map((l) => (
                      <tr key={l.id} className="border-b last:border-0">
                        <td className="py-1">{l.loan_type}<div className="text-[10px] text-gray-500">from {String(l.start_date).slice(0, 10)}</div></td>
                        <td className="py-1 text-right">{kes(l.principal)}</td>
                        <td className="py-1 text-right">{kes(l.monthly_installment)}</td>
                        <td className="py-1 text-right">{kes(l.balance)}</td>
                        <td className="py-1 text-right">
                          {l.status === 'active'
                            ? <button onClick={() => setLoanStatus(l, 'cancelled')} className="text-[10px] text-red-600 hover:underline">Stop deducting</button>
                            : <span className="text-gray-500">{l.status}</span>}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
              <div className="grid grid-cols-2 md:grid-cols-5 gap-2 items-end">
                <input className={input} placeholder="Type" value={newLoan.loan_type} onChange={(e) => setNewLoan({ ...newLoan, loan_type: e.target.value })} />
                <input className={input} type="number" min="0" placeholder="Principal" value={newLoan.principal} onChange={(e) => setNewLoan({ ...newLoan, principal: e.target.value })} />
                <input className={input} type="number" min="0" placeholder="Monthly instalment" value={newLoan.monthly_installment} onChange={(e) => setNewLoan({ ...newLoan, monthly_installment: e.target.value })} />
                <input className={input} type="date" value={newLoan.start_date} onChange={(e) => setNewLoan({ ...newLoan, start_date: e.target.value })} />
                <button onClick={addLoan} className="px-2.5 py-1.5 text-xs bg-gray-100 border border-gray-300 rounded hover:bg-gray-200">Add loan</button>
              </div>
              <p className="text-[10px] text-gray-500 mt-1">Instalments are deducted automatically each run until the balance is cleared. Disbursing the loan itself is recorded separately in your books.</p>
            </section>

            <div className="flex justify-end gap-2 pt-2 border-t">
              <button onClick={() => setSelected(null)} className="px-3 py-1.5 text-xs text-gray-700 bg-gray-100 border border-gray-300 rounded hover:bg-gray-200">Close</button>
              <button onClick={saveProfile} disabled={saving} className="px-3 py-1.5 text-xs text-white bg-red-600 hover:bg-red-700 rounded disabled:opacity-50">{saving ? 'Saving…' : 'Save profile'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default PayrollStaffPage;
