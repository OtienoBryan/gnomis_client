import React, { useEffect, useMemo, useState } from 'react';
import api from '../services/api';

interface LeaveType {
  id: number;
  name: string;
  default_days: number;
  is_unpaid: boolean;
}

interface Balance {
  year: number;
  leave_type: string;
  unpaid_type: boolean;
  entitlement: number;
  carried_over: number;
  taken: number;
  pending: number;
  available: number;
  request: { days: number; paid_days: number; unpaid_days: number } | null;
}

interface Props {
  open: boolean;
  onClose: () => void;
  onPosted: (message: string) => void;
}

const field =
  'block w-full px-2.5 py-1.5 text-xs border border-gray-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-red-500 focus:border-red-500';
const label = 'block text-[10px] font-medium text-gray-700 mb-1';

const today = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

const PostLeaveModal: React.FC<Props> = ({ open, onClose, onPosted }) => {
  const [staff, setStaff] = useState<{ id: number; name: string }[]>([]);
  const [types, setTypes] = useState<LeaveType[]>([]);
  const [staffSearch, setStaffSearch] = useState('');
  const [staffOpen, setStaffOpen] = useState(false);

  const [employeeId, setEmployeeId] = useState('');
  const [typeId, setTypeId] = useState('');
  const [startDate, setStartDate] = useState(today());
  const [endDate, setEndDate] = useState(today());
  const [reason, setReason] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [approve, setApprove] = useState(true);

  const [balance, setBalance] = useState<Balance | null>(null);
  const [balanceLoading, setBalanceLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setEmployeeId(''); setTypeId(''); setStartDate(today()); setEndDate(today());
    setReason(''); setFile(null); setApprove(true); setBalance(null); setError(null); setStaffSearch(''); setStaffOpen(false);
    api.get('/staff?activeOnly=true')
      .then(res => setStaff((Array.isArray(res.data) ? res.data : []).map((s: any) => ({ id: s.id, name: s.name }))))
      .catch(() => setStaff([]));
    api.get('/leave-requests/leave-types')
      .then(res => setTypes(Array.isArray(res.data) ? res.data : []))
      .catch(() => setTypes([]));
  }, [open]);

  const datesValid = !!startDate && !!endDate && endDate >= startDate;

  // Live balance for the selected staff member and leave type
  useEffect(() => {
    if (!open || !employeeId || !typeId) { setBalance(null); return; }
    let cancelled = false;
    setBalanceLoading(true);
    api.get('/leave-requests/balance', {
      params: { employee_id: employeeId, leave_type_id: typeId, ...(datesValid ? { start_date: startDate, end_date: endDate } : {}) },
    })
      .then(res => { if (!cancelled) setBalance(res.data); })
      .catch(() => { if (!cancelled) setBalance(null); })
      .finally(() => { if (!cancelled) setBalanceLoading(false); });
    return () => { cancelled = true; };
  }, [open, employeeId, typeId, startDate, endDate, datesValid]);

  const visibleStaff = useMemo(() => {
    const q = staffSearch.trim().toLowerCase();
    return q ? staff.filter(s => s.name.toLowerCase().includes(q)) : staff;
  }, [staff, staffSearch]);

  const req = balance?.request;
  const staffName = staff.find(s => String(s.id) === employeeId)?.name || 'this employee';

  // Only one staff member can be selected; picking another replaces the current one
  const pickStaff = (id: number) => {
    setEmployeeId(String(id));
    setStaffSearch('');
    setStaffOpen(false);
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!employeeId) return setError('Select a staff member');
    if (!typeId) return setError('Select a leave type');
    if (!datesValid) return setError('End date cannot be before the start date');
    if (req && req.unpaid_days > 0 && !balance?.unpaid_type &&
      !window.confirm(`${staffName} only has ${Math.max(0, Math.floor(balance!.available))} day(s) of ${balance!.leave_type} left. ` +
        `${req.unpaid_days} of the ${req.days} day(s) will be posted as UNPAID leave and not paid in payroll. Continue?`)) return;

    const form = new FormData();
    form.append('employee_id', employeeId);
    form.append('leave_type_id', typeId);
    form.append('start_date', startDate);
    form.append('end_date', endDate);
    if (reason.trim()) form.append('reason', reason.trim());
    form.append('approve', String(approve));
    if (file) form.append('attachment', file);

    setSaving(true);
    try {
      const res = await api.post('/leave-requests', form, { headers: { 'Content-Type': 'multipart/form-data' } });
      const d = res.data || {};
      const parts = [
        d.paid_days ? `${d.paid_days} paid` : '',
        d.unpaid_days ? `${d.unpaid_days} unpaid` : '',
      ].filter(Boolean).join(', ');
      onPosted(`Leave posted for ${staffName}: ${d.days} day(s)${parts ? ` (${parts})` : ''}${approve ? ', approved' : ', pending approval'}.`);
      onClose();
    } catch (err: any) {
      setError(err.response?.data?.message || err.message || 'Failed to post leave');
    } finally {
      setSaving(false);
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => !saving && onClose()}>
      <form onSubmit={submit} onClick={e => e.stopPropagation()} className="bg-white rounded-xl shadow-xl w-full max-w-lg max-h-[92vh] overflow-y-auto">
        <div className="flex items-center justify-between px-5 py-3 border-b border-gray-200">
          <div>
            <h2 className="text-sm font-semibold text-gray-900">Post Employee Leave</h2>
            <p className="text-[10px] text-gray-500">The leave balance is checked before posting.</p>
          </div>
          <button type="button" onClick={onClose} disabled={saving} className="text-gray-400 hover:text-gray-700 text-lg leading-none" aria-label="Close">×</button>
        </div>

        <div className="px-5 py-4 space-y-3">
          <div className="relative">
            <label className={label}>Staff member *</label>
            {employeeId && !staffOpen ? (
              <div className={`${field} flex items-center justify-between bg-white`}>
                <span className="font-medium text-gray-900 truncate">{staffName}</span>
                <button type="button" onClick={() => { setStaffOpen(true); setStaffSearch(''); }} className="ml-2 text-[10px] text-red-600 hover:text-red-800 shrink-0">
                  Change
                </button>
              </div>
            ) : (
              <input
                className={field}
                placeholder="Search and select one staff member…"
                value={staffSearch}
                autoFocus={staffOpen}
                onFocus={() => setStaffOpen(true)}
                onBlur={() => setTimeout(() => setStaffOpen(false), 150)}
                onChange={e => { setStaffSearch(e.target.value); setStaffOpen(true); }}
                onKeyDown={e => {
                  if (e.key === 'Enter') { e.preventDefault(); if (visibleStaff[0]) pickStaff(visibleStaff[0].id); }
                  if (e.key === 'Escape') setStaffOpen(false);
                }}
              />
            )}
            {staffOpen && (
              <ul className="absolute z-10 mt-1 w-full max-h-52 overflow-y-auto bg-white border border-gray-200 rounded-lg shadow-lg py-1 text-xs">
                {visibleStaff.length === 0 ? (
                  <li className="px-3 py-2 text-gray-400">No staff match “{staffSearch}”</li>
                ) : (
                  visibleStaff.map(s => (
                    <li key={s.id}>
                      <button
                        type="button"
                        onMouseDown={e => e.preventDefault()}
                        onClick={() => pickStaff(s.id)}
                        className={`w-full text-left px-3 py-1.5 hover:bg-red-50 ${String(s.id) === employeeId ? 'font-medium text-red-700' : 'text-gray-800'}`}
                      >
                        {s.name}
                      </button>
                    </li>
                  ))
                )}
              </ul>
            )}
          </div>

          <div>
            <label className={label}>Leave type *</label>
            <select className={field} value={typeId} onChange={e => setTypeId(e.target.value)}>
              <option value="">Select leave type</option>
              {types.map(t => (
                <option key={t.id} value={t.id}>{t.name}{t.is_unpaid ? ' (unpaid)' : ` (${t.default_days} days/year)`}</option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={label}>Start date *</label>
              <input type="date" className={field} value={startDate} onChange={e => { setStartDate(e.target.value); if (endDate < e.target.value) setEndDate(e.target.value); }} />
            </div>
            <div>
              <label className={label}>End date *</label>
              <input type="date" className={field} value={endDate} min={startDate} onChange={e => setEndDate(e.target.value)} />
            </div>
          </div>

          {/* Leave balance */}
          {employeeId && typeId && (
            <div className="rounded-lg border border-gray-200 bg-gray-50 p-3 text-xs">
              {balanceLoading && !balance ? (
                <div className="text-gray-500">Checking leave balance…</div>
              ) : !balance ? (
                <div className="text-red-600">Could not load the leave balance.</div>
              ) : balance.unpaid_type ? (
                <div className="text-amber-800">
                  <span className="inline-flex px-1.5 py-0.5 mr-1.5 rounded bg-amber-100 font-semibold text-[10px]">UNPAID</span>
                  {balance.leave_type} is unpaid. {req ? `All ${req.days} day(s)` : 'These days'} will not be paid in payroll.
                </div>
              ) : (
                <>
                  <div className="flex items-center justify-between font-semibold text-gray-900 mb-1.5">
                    <span>{balance.leave_type} balance {balance.year}</span>
                    <span className={balance.available > 0 ? 'text-green-700' : 'text-red-600'}>{balance.available} day(s) available</span>
                  </div>
                  <div className="grid grid-cols-4 gap-2 text-[10px] text-gray-600">
                    <div><div className="text-gray-400">Entitlement</div>{balance.entitlement}</div>
                    <div><div className="text-gray-400">Carried over</div>{balance.carried_over}</div>
                    <div><div className="text-gray-400">Taken</div>{balance.taken}</div>
                    <div><div className="text-gray-400">Pending</div>{balance.pending}</div>
                  </div>
                  {req && (
                    req.unpaid_days > 0 ? (
                      <div className="mt-2 px-2.5 py-2 rounded bg-amber-50 border border-amber-200 text-amber-900">
                        <span className="inline-flex px-1.5 py-0.5 mr-1.5 rounded bg-amber-100 font-semibold text-[10px]">PARTLY UNPAID</span>
                        Requesting {req.days} day(s): <strong>{req.paid_days} paid</strong>, <strong>{req.unpaid_days} unpaid</strong>.
                        The unpaid days are posted as a separate unpaid leave and are not paid in payroll.
                      </div>
                    ) : (
                      <div className="mt-2 text-green-700">Requesting {req.days} day(s), all within the balance (paid).</div>
                    )
                  )}
                </>
              )}
            </div>
          )}

          <div>
            <label className={label}>Reason</label>
            <textarea rows={2} className={`${field} resize-none`} value={reason} onChange={e => setReason(e.target.value)} placeholder="Optional" />
          </div>

          <div>
            <label className={label}>Attachment (if available)</label>
            <input
              type="file"
              accept=".pdf,.jpg,.jpeg,.png,.doc,.docx"
              onChange={e => setFile(e.target.files?.[0] || null)}
              className="block w-full text-[10px] text-gray-600 file:mr-2 file:px-2.5 file:py-1 file:rounded file:border-0 file:text-[10px] file:font-medium file:bg-gray-100 file:text-gray-700 hover:file:bg-gray-200"
            />
            <p className="mt-1 text-[10px] text-gray-400">e.g. a sick note. PDF, image or Word, up to 10 MB.</p>
          </div>

          <label className="flex items-center gap-2 text-xs text-gray-700">
            <input type="checkbox" checked={approve} onChange={e => setApprove(e.target.checked)} className="rounded border-gray-300 text-red-600 focus:ring-red-500" />
            Approve immediately
          </label>

          {error && <div className="text-xs text-red-600 bg-red-50 border border-red-200 rounded px-2.5 py-2">{error}</div>}
        </div>

        <div className="flex justify-end gap-2 px-5 py-3 border-t border-gray-200 bg-gray-50 rounded-b-xl">
          <button type="button" onClick={onClose} disabled={saving} className="px-3 py-1.5 text-xs font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50">
            Cancel
          </button>
          <button type="submit" disabled={saving} className="px-3 py-1.5 text-xs font-medium text-white bg-red-600 rounded-lg hover:bg-red-700 disabled:opacity-50">
            {saving ? 'Posting…' : 'Post Leave'}
          </button>
        </div>
      </form>
    </div>
  );
};

export default PostLeaveModal;
