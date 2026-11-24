import React, { useEffect, useMemo, useState } from 'react';
import api from '../services/api';

interface Props {
  month: string | null; // YYYY-MM; null = closed
  onClose: () => void;
}

interface Holiday {
  id: number | string;
  name: string;
  date: string;
  country?: string;
  is_projected?: boolean;
}

interface Row {
  date: string;
  weekday: string;
  labels: { text: string; kind: 'holiday' | 'weekend' }[];
}

const pad = (n: number) => String(n).padStart(2, '0');

// Lists the month's Sundays and public holidays (the days counted in "Holidays & Weekends").
// A public holiday on a Sunday is one day, shown with both labels.
const HolidaysWeekendsModal: React.FC<Props> = ({ month, onClose }) => {
  const [holidays, setHolidays] = useState<Holiday[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!month) return;
    setLoading(true);
    setError(null);
    api.get('/public-holidays/month', { params: { month } })
      .then(res => {
        const list: Holiday[] = Array.isArray(res.data) ? res.data : [];
        setHolidays(list.filter(h => !h.country || h.country === 'Kenya'));
      })
      .catch((err: any) => setError(err.message || 'Failed to load public holidays'))
      .finally(() => setLoading(false));
  }, [month]);

  const rows = useMemo<Row[]>(() => {
    if (!month) return [];
    const [y, m] = month.split('-').map(Number);
    const days = new Date(y, m, 0).getDate();
    const byDate = new Map<string, Row>();
    const rowFor = (date: string) => {
      if (!byDate.has(date)) {
        const weekday = new Date(`${date}T00:00:00`).toLocaleDateString('en-GB', { weekday: 'long' });
        byDate.set(date, { date, weekday, labels: [] });
      }
      return byDate.get(date)!;
    };
    for (let d = 1; d <= days; d++) {
      if (new Date(y, m - 1, d).getDay() === 0) rowFor(`${y}-${pad(m)}-${pad(d)}`).labels.push({ text: 'Weekend (Sunday)', kind: 'weekend' });
    }
    holidays.forEach(h => rowFor(String(h.date).slice(0, 10)).labels.unshift({ text: h.name, kind: 'holiday' }));
    return Array.from(byDate.values()).sort((a, b) => a.date.localeCompare(b.date));
  }, [month, holidays]);

  if (!month) return null;

  const holidayCount = rows.filter(r => r.labels.some(l => l.kind === 'holiday')).length;
  const sundayCount = rows.filter(r => r.labels.some(l => l.kind === 'weekend')).length;
  const monthLabel = new Date(`${month}-01T00:00:00`).toLocaleDateString('en-GB', { month: 'long', year: 'numeric' });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div className="bg-white rounded-xl shadow-xl w-full max-w-lg max-h-[90vh] flex flex-col" onClick={e => e.stopPropagation()}>
        <div className="flex items-start justify-between px-5 py-3 border-b border-gray-200">
          <div>
            <h2 className="text-sm font-semibold text-gray-900">Holidays &amp; Weekends — {monthLabel}</h2>
            <p className="text-xs text-gray-500">
              {rows.length} day(s): {sundayCount} Sunday(s), {holidayCount} public holiday(s)
            </p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-700 text-xl leading-none" aria-label="Close">×</button>
        </div>

        <div className="overflow-auto">
          {loading ? (
            <div className="py-12 text-center text-sm text-gray-500">Loading…</div>
          ) : (
            <>
              {error && <div className="m-4 px-3 py-2 text-xs text-red-700 bg-red-50 border border-red-200 rounded">{error} Showing Sundays only.</div>}
              <table className="min-w-full divide-y divide-gray-200 text-sm">
                <thead className="bg-gray-50 text-xs uppercase tracking-wider text-gray-500">
                  <tr>
                    <th className="px-4 py-2 text-left font-medium">Date</th>
                    <th className="px-4 py-2 text-left font-medium">Day</th>
                    <th className="px-4 py-2 text-left font-medium">Holiday / Weekend</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {rows.map(r => (
                    <tr key={r.date}>
                      <td className="px-4 py-2 whitespace-nowrap text-gray-900">
                        {new Date(`${r.date}T00:00:00`).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
                      </td>
                      <td className="px-4 py-2 whitespace-nowrap text-gray-600">{r.weekday}</td>
                      <td className="px-4 py-2">
                        <div className="flex flex-wrap gap-1">
                          {r.labels.map((l, i) => (
                            <span
                              key={i}
                              className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${
                                l.kind === 'holiday' ? 'bg-purple-100 text-purple-800' : 'bg-gray-100 text-gray-700'
                              }`}
                            >
                              {l.text}
                            </span>
                          ))}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default HolidaysWeekendsModal;
