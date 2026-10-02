import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { API_CONFIG } from '../config/api';

interface CheckedInRep {
  id: number;
  name: string;
  email?: string;
  route_name?: string;
  region_name?: string;
  checkInTime?: string;
  checkoutTime?: string;
}

const authFetch = async (endpoint: string, params?: Record<string, string>) => {
  const url = new URL(API_CONFIG.getUrl(endpoint), window.location.origin);
  if (params) Object.entries(params).forEach(([k, v]) => url.searchParams.append(k, v));
  const res = await fetch(url.toString(), {
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${localStorage.getItem('token')}` },
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
};

const timeOf = (iso?: string) =>
  iso ? new Date(iso).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true }) : '—';

// Time between check-in and check-out, or since check-in when the rep has not checked out yet
const timeSpent = (rep: CheckedInRep) => {
  if (!rep.checkInTime) return '—';
  const start = new Date(rep.checkInTime).getTime();
  const end = rep.checkoutTime ? new Date(rep.checkoutTime).getTime() : Date.now();
  const diff = Math.max(0, end - start);
  const hours = Math.floor(diff / 3600000);
  const minutes = Math.floor((diff % 3600000) / 60000);
  return hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`;
};

const toIso = (d: Date) => new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10);

const CheckedInSalesRepsPage: React.FC = () => {
  const todayIso = toIso(new Date());
  const [date, setDate] = useState(todayIso);
  const [reps, setReps] = useState<CheckedInRep[]>([]);
  const [totalActive, setTotalActive] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [repsRes, dashRes] = await Promise.all([
        authFetch('/dashboard/checked-in-sales-reps', { role: 'fmr', date }),
        authFetch('/dashboard/sales-dashboard-data').catch(() => null),
      ]);
      const list: CheckedInRep[] = repsRes.success && Array.isArray(repsRes.data) ? repsRes.data : [];
      setReps([...list].sort((a, b) => new Date(a.checkInTime || 0).getTime() - new Date(b.checkInTime || 0).getTime()));
      setTotalActive(Number(dashRes?.data?.stats?.totalActiveReps) || 0);
    } catch (e: any) {
      setError(e.message || 'Failed to load checked-in sales reps');
    } finally {
      setLoading(false);
    }
  }, [date]);

  useEffect(() => {
    load();
  }, [load]);

  const rows = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return reps;
    return reps.filter(r => [r.name, r.route_name, r.region_name].some(v => (v || '').toLowerCase().includes(q)));
  }, [reps, search]);

  const attendance = totalActive > 0 ? ((reps.length / totalActive) * 100).toFixed(1) : null;
  const checkedOut = reps.filter(r => r.checkoutTime).length;
  const th = 'px-4 py-2.5 text-[10px] font-semibold text-gray-500 uppercase tracking-wider whitespace-nowrap text-left';

  const stat = (label: string, value: string, hint: string) => (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 min-w-0">
      <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">{label}</p>
      <p className="text-lg font-bold text-gray-900 truncate">{value}</p>
      <p className="text-[10px] text-gray-400">{hint}</p>
    </div>
  );

  return (
    <div className="min-h-screen bg-[#f3f5fd]">
      <div className="w-full py-5 px-4 sm:px-6 lg:px-8">
        <div className="mb-4 flex items-center justify-between gap-3 flex-wrap">
          <div>
            <h1 className="text-lg font-bold text-gray-900">Checked-In Sales Reps</h1>
            <p className="text-xs text-gray-500 mt-0.5">
              {new Date(`${date}T00:00:00`).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Link
              to="/sales-dashboard"
              className="px-3 py-1.5 border border-gray-200 rounded-lg shadow-sm text-xs font-medium text-gray-700 bg-white hover:bg-gray-50"
            >
              Back to Dashboard
            </Link>
            <button
              type="button"
              onClick={load}
              disabled={loading}
              className="px-3 py-1.5 border border-gray-200 rounded-lg shadow-sm text-xs font-medium text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50"
            >
              {loading ? 'Refreshing...' : 'Refresh'}
            </button>
          </div>
        </div>

        {error && <div className="bg-red-50 border border-red-200 rounded-xl p-3 text-red-700 text-xs mb-4">{error}</div>}

        {/* Date filter */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 px-4 py-3 mb-4 flex flex-wrap items-end gap-3">
          <div>
            <label className="block text-[10px] font-medium text-gray-500 mb-0.5">Date</label>
            <input
              type="date"
              className="border border-gray-200 rounded-lg px-2.5 py-1.5 text-xs bg-white focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-red-500"
              value={date}
              max={todayIso}
              onChange={e => e.target.value && setDate(e.target.value)}
            />
          </div>
          <div className="flex items-center gap-1.5 pb-0.5">
            <button
              type="button"
              onClick={() => setDate(todayIso)}
              className="px-2.5 py-1 rounded-full text-[11px] font-medium border border-gray-200 bg-white text-gray-600 hover:bg-gray-50"
            >
              Today
            </button>
            <button
              type="button"
              onClick={() => {
                const y = new Date();
                y.setDate(y.getDate() - 1);
                setDate(toIso(y));
              }}
              className="px-2.5 py-1 rounded-full text-[11px] font-medium border border-gray-200 bg-white text-gray-600 hover:bg-gray-50"
            >
              Yesterday
            </button>
          </div>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-3 gap-3 mb-4">
          {stat(date === todayIso ? 'Checked in today' : 'Checked in', String(reps.length), totalActive > 0 ? `of ${totalActive} active sales reps` : 'Sales reps')}
          {stat('Attendance', attendance ? `${attendance}%` : '—', 'Of active sales reps')}
          {stat('Checked out', `${checkedOut} / ${reps.length}`, 'Finished for the day')}
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between gap-3 flex-wrap">
            <span className="text-xs text-gray-500">
              {rows.length} sales rep{rows.length === 1 ? '' : 's'}
            </span>
            <input
              className="border border-gray-200 rounded-lg px-3 py-1.5 text-xs w-56 focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-red-500"
              placeholder="Search name, route or region..."
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>

          {loading ? (
            <div className="p-12 text-center">
              <div className="animate-spin rounded-full h-9 w-9 border-b-2 border-red-600 mx-auto"></div>
            </div>
          ) : rows.length === 0 ? (
            <div className="p-12 text-center text-sm text-gray-400">
              {reps.length === 0 ? `No sales reps checked in ${date === todayIso ? 'today' : 'on this date'}.` : 'No sales reps match your search.'}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-100">
                <thead className="bg-gray-50">
                  <tr>
                    {['#', 'Name', 'Check-In', 'Check-Out', 'Time Spent', 'Route', 'Region'].map(h => (
                      <th key={h} className={th}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {rows.map((rep, idx) => {
                    const early = rep.checkInTime ? new Date(rep.checkInTime).getHours() < 8 : false;
                    return (
                      <tr key={rep.id} className="hover:bg-gray-50/70">
                        <td className="px-4 py-2.5 text-xs text-gray-400">{idx + 1}</td>
                        <td className="px-4 py-2.5 whitespace-nowrap text-xs font-semibold text-gray-900">{rep.name}</td>
                        <td className={`px-4 py-2.5 whitespace-nowrap text-xs font-semibold ${early ? 'text-emerald-600' : 'text-orange-500'}`}>
                          {timeOf(rep.checkInTime)}
                        </td>
                        <td className="px-4 py-2.5 whitespace-nowrap text-xs font-semibold text-gray-600">{timeOf(rep.checkoutTime)}</td>
                        <td className="px-4 py-2.5 whitespace-nowrap text-xs font-medium text-red-600">{timeSpent(rep)}</td>
                        <td className="px-4 py-2.5 whitespace-nowrap text-xs text-gray-600">{rep.route_name || '—'}</td>
                        <td className="px-4 py-2.5 whitespace-nowrap text-xs text-gray-600">{rep.region_name || '—'}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default CheckedInSalesRepsPage;
