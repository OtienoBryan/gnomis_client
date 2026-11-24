import React from 'react';

interface Props {
  staff: { id: number; name: string; absent_dates: string[]; absent_holiday_dates?: string[] } | null;
  month: string; // YYYY-MM
  onClose: () => void;
  onViewAttendance?: (staffId: number) => void;
}

// Lists the working days (Mon-Sat, up to today) with no check-in and no approved leave
const AbsentDaysModal: React.FC<Props> = ({ staff, month, onClose, onViewAttendance }) => {
  if (!staff) return null;
  const holidays = new Set(staff.absent_holiday_dates || []);
  const dates = staff.absent_dates || [];
  const monthLabel = new Date(`${month}-01T00:00:00`).toLocaleDateString('en-GB', { month: 'long', year: 'numeric' });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md max-h-[90vh] flex flex-col" onClick={e => e.stopPropagation()}>
        <div className="flex items-start justify-between px-5 py-3 border-b border-gray-200">
          <div>
            <h2 className="text-sm font-semibold text-gray-900">Absent Days — {staff.name}</h2>
            <p className="text-xs text-gray-500">{dates.length} day(s) in {monthLabel} with no check-in and no approved leave</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-700 text-xl leading-none" aria-label="Close">×</button>
        </div>

        <div className="overflow-auto">
          {dates.length === 0 ? (
            <div className="py-12 text-center text-sm text-gray-500">No absent days this month.</div>
          ) : (
            <table className="min-w-full divide-y divide-gray-200 text-sm">
              <thead className="bg-gray-50 text-xs uppercase tracking-wider text-gray-500">
                <tr>
                  <th className="px-4 py-2 text-left font-medium">#</th>
                  <th className="px-4 py-2 text-left font-medium">Date</th>
                  <th className="px-4 py-2 text-left font-medium">Day</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {dates.map((d, i) => {
                  const dt = new Date(`${d}T00:00:00`);
                  return (
                    <tr key={d}>
                      <td className="px-4 py-2 text-gray-400">{i + 1}</td>
                      <td className="px-4 py-2 whitespace-nowrap text-gray-900">
                        {dt.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
                        {holidays.has(d) && (
                          <span className="ml-2 inline-flex px-1.5 py-0.5 rounded text-[10px] font-medium bg-purple-100 text-purple-800">Public holiday</span>
                        )}
                      </td>
                      <td className="px-4 py-2 whitespace-nowrap text-gray-600">{dt.toLocaleDateString('en-GB', { weekday: 'long' })}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>

        {onViewAttendance && (
          <div className="px-5 py-2.5 border-t border-gray-200 text-right">
            <button onClick={() => onViewAttendance(staff.id)} className="text-xs text-red-600 hover:underline">
              Open attendance history →
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default AbsentDaysModal;
