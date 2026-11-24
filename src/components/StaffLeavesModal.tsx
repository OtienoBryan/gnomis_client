import React, { useEffect, useMemo, useState } from 'react';
import api from '../services/api';

interface Leave {
  id: number;
  employee_id: number;
  leave_type: string | null;
  start_date: string;
  end_date: string;
  status: number | string;
  reason: string | null;
  attachment_url?: string | null;
  is_half_day?: number | boolean;
  is_unpaid?: number | boolean;
}

interface Props {
  staff: { id: number; name: string } | null;
  month: string; // YYYY-MM, rows in this month are highlighted
  onClose: () => void;
}

const d10 = (s: string) => String(s || '').slice(0, 10);
const fmt = (s: string) => {
  const d = new Date(`${d10(s)}T00:00:00`);
  return isNaN(d.getTime()) ? s : d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
};
const daysOf = (l: Leave) =>
  l.is_half_day ? 0.5 : Math.round((new Date(`${d10(l.end_date)}T00:00:00`).getTime() - new Date(`${d10(l.start_date)}T00:00:00`).getTime()) / 86400000) + 1;

const STATUS: Record<string, [string, string]> = {
  '0': ['Pending', 'bg-yellow-100 text-yellow-800'],
  '1': ['Approved', 'bg-green-100 text-green-800'],
  '2': ['Declined', 'bg-red-100 text-red-800'],
};

const StaffLeavesModal: React.FC<Props> = ({ staff, month, onClose }) => {
  const [leaves, setLeaves] = useState<Leave[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!staff) return;
    setLoading(true);
    setError(null);
    api.get('/leave-requests/employee-leaves')
      .then(res => {
        const all: Leave[] = Array.isArray(res.data) ? res.data : [];
        setLeaves(all.filter(l => Number(l.employee_id) === staff.id));
      })
      .catch((err: any) => setError(err.message || 'Failed to load leaves'))
      .finally(() => setLoading(false));
  }, [staff]);

  const monthStart = `${month}-01`;
  const monthEnd = `${month}-31`;
  const inMonth = (l: Leave) => d10(l.start_date) <= monthEnd && d10(l.end_date) >= monthStart;

  const totals = useMemo(() => {
    const approved = leaves.filter(l => String(l.status) === '1');
    return {
      count: leaves.length,
      approvedDays: approved.reduce((s, l) => s + daysOf(l), 0),
      unpaidDays: approved.filter(l => Number(l.is_unpaid) === 1).reduce((s, l) => s + daysOf(l), 0),
      pending: leaves.filter(l => !l.status || String(l.status) === '0').length,
    };
  }, [leaves]);

  if (!staff) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div className="bg-white rounded-xl shadow-xl w-full max-w-4xl max-h-[90vh] flex flex-col" onClick={e => e.stopPropagation()}>
        <div className="flex items-start justify-between px-5 py-3 border-b border-gray-200">
          <div>
            <h2 className="text-sm font-semibold text-gray-900">Leaves — {staff.name}</h2>
            <p className="text-xs text-gray-500">
              {totals.count} leave record{totals.count === 1 ? '' : 's'} · {totals.approvedDays} approved day(s)
              {totals.unpaidDays > 0 && ` (${totals.unpaidDays} unpaid)`}
              {totals.pending > 0 && ` · ${totals.pending} pending`}
            </p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-700 text-xl leading-none" aria-label="Close">×</button>
        </div>

        <div className="overflow-auto">
          {loading ? (
            <div className="py-12 text-center text-sm text-gray-500">Loading leaves…</div>
          ) : error ? (
            <div className="m-4 px-3 py-2 text-sm text-red-700 bg-red-50 border border-red-200 rounded">{error}</div>
          ) : leaves.length === 0 ? (
            <div className="py-12 text-center text-sm text-gray-500">No leaves recorded for {staff.name}.</div>
          ) : (
            <table className="min-w-full divide-y divide-gray-200 text-sm">
              <thead className="bg-gray-50 text-xs uppercase tracking-wider text-gray-500">
                <tr>
                  <th className="px-4 py-2 text-left font-medium">Leave type</th>
                  <th className="px-4 py-2 text-left font-medium">From</th>
                  <th className="px-4 py-2 text-left font-medium">To</th>
                  <th className="px-4 py-2 text-right font-medium">Days</th>
                  <th className="px-4 py-2 text-left font-medium">Status</th>
                  <th className="px-4 py-2 text-left font-medium">Reason</th>
                  <th className="px-4 py-2 text-left font-medium">Attachment</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {leaves.map(l => {
                  const [label, tone] = STATUS[String(l.status ?? '0')] || STATUS['0'];
                  return (
                    <tr key={l.id} className={inMonth(l) ? 'bg-red-50/60' : ''}>
                      <td className="px-4 py-2 whitespace-nowrap">
                        {l.leave_type || '—'}
                        {Number(l.is_unpaid) === 1 && (
                          <span className="ml-1.5 inline-flex px-1.5 py-0.5 rounded text-[10px] font-semibold bg-amber-100 text-amber-800">Unpaid</span>
                        )}
                      </td>
                      <td className="px-4 py-2 whitespace-nowrap text-gray-700">{fmt(l.start_date)}</td>
                      <td className="px-4 py-2 whitespace-nowrap text-gray-700">{fmt(l.end_date)}</td>
                      <td className="px-4 py-2 whitespace-nowrap text-right">{daysOf(l)}</td>
                      <td className="px-4 py-2 whitespace-nowrap">
                        <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${tone}`}>{label}</span>
                      </td>
                      <td className="px-4 py-2 text-gray-600 max-w-xs truncate" title={l.reason || ''}>{l.reason || '—'}</td>
                      <td className="px-4 py-2 whitespace-nowrap">
                        {l.attachment_url ? (
                          <a href={l.attachment_url} target="_blank" rel="noopener noreferrer" className="text-red-600 hover:underline text-xs">View</a>
                        ) : (
                          <span className="text-gray-400 text-xs">None</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>

        <div className="px-5 py-2.5 border-t border-gray-200 text-[11px] text-gray-500 flex items-center gap-2">
          <span className="inline-block w-3 h-3 rounded bg-red-50 border border-red-100" /> Highlighted rows fall in the selected month.
        </div>
      </div>
    </div>
  );
};

export default StaffLeavesModal;
