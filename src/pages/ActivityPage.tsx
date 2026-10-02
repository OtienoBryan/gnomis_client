import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';

interface ActivityRow {
  id: number;
  date: string;
  time?: string;
  userId: number;
  clientId: number;
  status: number;
  checkInTime?: string | null;
  checkoutTime?: string | null;
  user_name?: string | null;
  client_name?: string | null;
  route_name?: string | null;
  region_name?: string | null;
  user_role?: string | null;
  sales_rep_country?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  imageUrl?: string | null;
}

const ActivityPage: React.FC = () => {
  const navigate = useNavigate();
  const today = new Date().toISOString().slice(0, 10);

  const [rows, setRows] = useState<ActivityRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [startDate, setStartDate] = useState(today);
  const [endDate, setEndDate] = useState(today);
  const [status, setStatus] = useState('1'); // In Progress by default
  const [region, setRegion] = useState('');
  const [routeFilter, setRouteFilter] = useState('');
  const [roleFilter, setRoleFilter] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');

  const fetchData = async () => {
    setLoading(true);
    setError(null);
    try {
      const params: any = {};
      if (startDate) params.startDate = startDate;
      if (endDate) params.endDate = endDate;
      if (status) params.status = status;
      if (region) params.region = region;
      // keep payload reasonable; UI can filter client-side
      params.limit = 1000;

      const res = await axios.get('/api/journey-plans', { params });
      const data = Array.isArray(res.data) ? res.data : (res.data?.data || []);
      setRows(Array.isArray(data) ? data : []);
    } catch (err: any) {
      setError(err.response?.data?.message || err.message || 'Failed to fetch activity');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [startDate, endDate, status, region]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const regionTrimmed = region.trim().toLowerCase();
    const routeTrimmed = routeFilter.trim().toLowerCase();
    const role = roleFilter;

    let base = rows;
    if (regionTrimmed) {
      base = base.filter(r => (r.region_name || '').toLowerCase().includes(regionTrimmed));
    }
    if (routeTrimmed) {
      base = base.filter(r => (r.route_name || '').toLowerCase().includes(routeTrimmed));
    }
    if (role === 'leader') {
      base = base.filter(r => (r.user_role || '').toLowerCase() === 'team leader');
    } else if (role === 'fmr') {
      base = base.filter(r => (r.user_role || '').toLowerCase() === 'sales rep');
    }

    if (!q) return base;
    return base.filter(r => {
      const user = (r.user_name || '').toLowerCase();
      const client = (r.client_name || '').toLowerCase();
      const route = (r.route_name || '').toLowerCase();
      return user.includes(q) || client.includes(q) || route.includes(q) || String(r.id).includes(q);
    });
  }, [rows, search, region, routeFilter, roleFilter]);

  const statusLabel = (s: number) => {
    if (s === 2) return 'Completed';
    if (s === 1) return 'In Progress';
    if (s === 0) return 'Planned';
    return `Status ${s}`;
  };

  const statusBadgeClass = (s: number) => {
    if (s === 2) return 'bg-green-100 text-green-800';
    if (s === 1) return 'bg-yellow-100 text-yellow-800';
    if (s === 0) return 'bg-gray-100 text-gray-700';
    return 'bg-gray-100 text-gray-700';
  };

  const summary = useMemo(() => {
    return {
      total: filtered.length,
      planned: filtered.filter(r => Number(r.status) === 0).length,
      inProgress: filtered.filter(r => Number(r.status) === 1).length,
      completed: filtered.filter(r => Number(r.status) === 2).length,
    };
  }, [filtered]);

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="w-full mx-auto px-4 py-4">
        {/* Header */}
        <div className="bg-white border border-gray-200 rounded-md p-3 mb-3 flex items-center justify-between flex-wrap gap-2">
          <div>
            <h1 className="text-sm font-bold text-gray-900">Activity</h1>
            <p className="text-[10px] text-gray-500 mt-0.5">JourneyPlan activity — check-ins, visits, and status</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={fetchData}
              className="px-3 py-1.5 border border-gray-300 rounded-md text-xs font-medium text-gray-700 bg-white hover:bg-gray-50"
            >
              Refresh
            </button>
            <button
              type="button"
              onClick={() => {
                const params = new URLSearchParams();
                if (startDate) params.set('startDate', startDate);
                if (endDate) params.set('endDate', endDate);
                if (status) params.set('status', status);
                if (region) params.set('region', region);
                if (routeFilter) params.set('route', routeFilter);
                if (roleFilter) params.set('role', roleFilter);
                if (search) params.set('search', search);
                navigate(`/activity/map?${params.toString()}`);
              }}
              className="px-3 py-1.5 rounded-md text-xs font-semibold text-white bg-red-600 hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed"
              disabled={filtered.filter(r => r.latitude && r.longitude).length === 0}
            >
              Map
            </button>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-3">
          <div className="bg-white border border-gray-200 rounded-md p-3">
            <p className="text-[9px] font-semibold text-gray-500 uppercase tracking-wider">Total Records</p>
            <p className="text-lg font-bold text-gray-900 mt-0.5">{summary.total}</p>
          </div>
          <div className="bg-white border border-gray-200 rounded-md p-3">
            <p className="text-[9px] font-semibold text-gray-500 uppercase tracking-wider">Planned</p>
            <p className="text-lg font-bold text-gray-900 mt-0.5">{summary.planned}</p>
          </div>
          <div className="bg-white border border-gray-200 rounded-md p-3">
            <p className="text-[9px] font-semibold text-gray-500 uppercase tracking-wider">In Progress</p>
            <p className="text-lg font-bold text-yellow-600 mt-0.5">{summary.inProgress}</p>
          </div>
          <div className="bg-white border border-gray-200 rounded-md p-3">
            <p className="text-[9px] font-semibold text-gray-500 uppercase tracking-wider">Completed</p>
            <p className="text-lg font-bold text-green-600 mt-0.5">{summary.completed}</p>
          </div>
        </div>

        {/* Filters */}
        <div className="bg-white border border-gray-200 rounded-md p-3 mb-3">
          <div className="flex flex-col lg:flex-row gap-3 lg:items-end">
            <div>
              <label className="block text-[9px] font-semibold text-gray-500 uppercase tracking-wider mb-1">Start Date</label>
              <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="border border-gray-300 rounded px-2 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-red-500" />
            </div>
            <div>
              <label className="block text-[9px] font-semibold text-gray-500 uppercase tracking-wider mb-1">End Date</label>
              <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className="border border-gray-300 rounded px-2 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-red-500" />
            </div>
            <div>
              <label className="block text-[9px] font-semibold text-gray-500 uppercase tracking-wider mb-1">Status</label>
              <select
                value={status}
                onChange={e => setStatus(e.target.value)}
                className="border border-gray-300 rounded px-2 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-red-500"
              >
                <option value="">All</option>
                <option value="0">Planned</option>
                <option value="1">In Progress</option>
                <option value="2">Completed</option>
              </select>
            </div>
            <div>
              <label className="block text-[9px] font-semibold text-gray-500 uppercase tracking-wider mb-1">Role</label>
              <select
                value={roleFilter}
                onChange={e => setRoleFilter(e.target.value)}
                className="border border-gray-300 rounded px-2 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-red-500"
              >
                <option value="">All</option>
                <option value="fmr">FMR</option>
                <option value="leader">Team Leader</option>
              </select>
            </div>
            <div>
              <label className="block text-[9px] font-semibold text-gray-500 uppercase tracking-wider mb-1">Region</label>
              <input
                type="text"
                value={region}
                onChange={e => setRegion(e.target.value)}
                className="border border-gray-300 rounded px-2 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-red-500"
                placeholder="Filter by region..."
              />
            </div>
            <div>
              <label className="block text-[9px] font-semibold text-gray-500 uppercase tracking-wider mb-1">Route</label>
              <input
                type="text"
                value={routeFilter}
                onChange={e => setRouteFilter(e.target.value)}
                className="border border-gray-300 rounded px-2 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-red-500"
                placeholder="Filter by route..."
              />
            </div>
            <form
              className="flex-1"
              onSubmit={(e) => {
                e.preventDefault();
                setSearch(searchInput);
              }}
            >
              <label className="block text-[9px] font-semibold text-gray-500 uppercase tracking-wider mb-1">Search</label>
              <div className="flex gap-2">
                <input value={searchInput} onChange={e => setSearchInput(e.target.value)} className="flex-1 border border-gray-300 rounded px-2 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-red-500" placeholder="User, client, route, or ID..." />
                <button type="submit" className="px-3 py-1.5 text-xs font-semibold rounded bg-red-600 text-white hover:bg-red-700">Search</button>
                {search && (
                  <button type="button" className="px-3 py-1.5 text-xs font-medium rounded bg-gray-100 text-gray-700 hover:bg-gray-200" onClick={() => { setSearch(''); setSearchInput(''); }}>
                    Clear
                  </button>
                )}
              </div>
            </form>
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-16">
            <div className="animate-spin rounded-full h-10 w-10 border-2 border-red-600 border-t-transparent"></div>
          </div>
        ) : error ? (
          <div className="bg-red-50 border border-red-200 rounded-md p-4 text-center">
            <p className="text-xs text-red-600">{error}</p>
          </div>
        ) : (
          <div className="bg-white border border-gray-200 rounded-md overflow-hidden">
            <div className="px-3 py-2 text-[10px] text-gray-500 border-b border-gray-200">
              Showing {filtered.length} records
            </div>
            <div className="overflow-x-auto">
              <table className="w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-3 py-2 text-left text-[9px] font-semibold text-gray-500 uppercase tracking-wider">Date</th>
                    <th className="px-3 py-2 text-left text-[9px] font-semibold text-gray-500 uppercase tracking-wider">FMR</th>
                    <th className="px-3 py-2 text-left text-[9px] font-semibold text-gray-500 uppercase tracking-wider">Region</th>
                    <th className="px-3 py-2 text-left text-[9px] font-semibold text-gray-500 uppercase tracking-wider">Client</th>
                    <th className="px-3 py-2 text-left text-[9px] font-semibold text-gray-500 uppercase tracking-wider">Route</th>
                    <th className="px-3 py-2 text-left text-[9px] font-semibold text-gray-500 uppercase tracking-wider">Status</th>
                    <th className="px-3 py-2 text-left text-[9px] font-semibold text-gray-500 uppercase tracking-wider">Check-In Image</th>
                    <th className="px-3 py-2 text-left text-[9px] font-semibold text-gray-500 uppercase tracking-wider">Check-In</th>
                    <th className="px-3 py-2 text-left text-[9px] font-semibold text-gray-500 uppercase tracking-wider">Check-Out</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {filtered.map(r => (
                    <tr key={r.id} className="hover:bg-gray-50">
                      <td className="px-3 py-2 text-xs text-gray-700 whitespace-nowrap">{String(r.date).slice(0, 10)}</td>
                      <td className="px-3 py-2 text-xs font-medium text-gray-900">{r.user_name || `User ${r.userId}`}</td>
                      <td className="px-3 py-2 text-xs text-gray-700">{r.region_name || '-'}</td>
                      <td className="px-3 py-2 text-xs text-gray-700">{r.client_name || (r.clientId ? `Client ${r.clientId}` : '-')}</td>
                      <td className="px-3 py-2 text-xs text-gray-700">{r.route_name || '-'}</td>
                      <td className="px-3 py-2 whitespace-nowrap">
                        <span className={`inline-flex px-1.5 py-0.5 text-[9px] font-semibold rounded-full ${statusBadgeClass(Number(r.status))}`}>
                          {statusLabel(Number(r.status))}
                        </span>
                      </td>
                      <td className="px-3 py-2 text-xs text-gray-700">
                        {r.imageUrl ? (
                          <a href={r.imageUrl} target="_blank" rel="noopener noreferrer" className="inline-block">
                            <img
                              src={r.imageUrl}
                              alt="Check-in"
                              className="h-9 w-9 rounded object-cover border border-gray-200"
                              loading="lazy"
                            />
                          </a>
                        ) : (
                          '-'
                        )}
                      </td>
                      <td className="px-3 py-2 text-xs text-gray-700 whitespace-nowrap">{r.checkInTime ? String(r.checkInTime).replace('T', ' ').slice(0, 16) : '-'}</td>
                      <td className="px-3 py-2 text-xs text-gray-700 whitespace-nowrap">{r.checkoutTime ? String(r.checkoutTime).replace('T', ' ').slice(0, 16) : '-'}</td>
                    </tr>
                  ))}
                  {filtered.length === 0 && (
                    <tr>
                      <td colSpan={9} className="px-3 py-10 text-center text-xs text-gray-500">No activity found.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

    </div>
  );
};

export default ActivityPage;

