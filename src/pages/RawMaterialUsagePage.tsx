import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import axios from 'axios';

interface UsageRow {
  raw_material_id: number;
  name: string;
  unit: string;
  cost: number | string;
  issued_quantity: number | string;
  used_quantity: number | string;
  returned_quantity: number | string;
  request_id: number;
  request_number: string;
  completed_at: string;
  store_name?: string;
}

interface MaterialTotal {
  raw_material_id: number;
  name: string;
  unit: string;
  cost: number;
  issued: number;
  used: number;
  returned: number;
  requests: number;
}

type Tab = 'material' | 'request';

const toIso = (d: Date) => {
  const local = new Date(d.getTime() - d.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 10);
};

const qty = (n: number | string) => Number(n || 0).toLocaleString(undefined, { maximumFractionDigits: 3 });
const money = (n: number) => n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const inputClass =
  'border border-gray-200 rounded-lg px-2.5 py-1.5 text-xs bg-white focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-red-500';

const RawMaterialUsagePage: React.FC = () => {
  const today = new Date();
  const [startDate, setStartDate] = useState(toIso(new Date(today.getFullYear(), today.getMonth(), 1)));
  const [endDate, setEndDate] = useState(toIso(today));
  const [rows, setRows] = useState<UsageRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>('material');
  const [search, setSearch] = useState('');
  const [materialFilter, setMaterialFilter] = useState('');
  const [materialOptions, setMaterialOptions] = useState<{ id: number; name: string }[]>([]);

  const fetchUsage = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await axios.get('/api/financial/raw-material-requests/usage', {
        params: { start_date: startDate || undefined, end_date: endDate || undefined },
      });
      if (res.data?.success) setRows(res.data.data || []);
      else setError(res.data?.error || 'Failed to load raw material usage');
    } catch (err: any) {
      setError(err.response?.data?.error || err.message || 'Failed to load raw material usage');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    axios
      .get('/api/financial/raw-materials')
      .then(res => {
        const list: { id: number; name: string }[] = (res.data?.data || []).map((m: any) => ({ id: m.id, name: m.name }));
        setMaterialOptions(list.sort((a, b) => a.name.localeCompare(b.name)));
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    fetchUsage();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [startDate, endDate]);

  const setPreset = (preset: 'today' | 'week' | 'month' | 'last30' | 'all') => {
    const now = new Date();
    if (preset === 'all') {
      setStartDate('');
      setEndDate('');
    } else if (preset === 'today') {
      setStartDate(toIso(now));
      setEndDate(toIso(now));
    } else if (preset === 'week') {
      const monday = new Date(now);
      monday.setDate(now.getDate() - ((now.getDay() + 6) % 7));
      setStartDate(toIso(monday));
      setEndDate(toIso(now));
    } else if (preset === 'month') {
      setStartDate(toIso(new Date(now.getFullYear(), now.getMonth(), 1)));
      setEndDate(toIso(now));
    } else {
      const from = new Date(now);
      from.setDate(now.getDate() - 29);
      setStartDate(toIso(from));
      setEndDate(toIso(now));
    }
  };

  const filteredRows = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter(r => {
      if (materialFilter && String(r.raw_material_id) !== materialFilter) return false;
      if (!q) return true;
      return [r.name, r.request_number].some(v => (v || '').toLowerCase().includes(q));
    });
  }, [rows, search, materialFilter]);

  const byMaterial: MaterialTotal[] = useMemo(() => {
    const map = new Map<number, MaterialTotal>();
    const requestsSeen = new Map<number, Set<number>>();
    filteredRows.forEach(r => {
      let t = map.get(r.raw_material_id);
      if (!t) {
        t = { raw_material_id: r.raw_material_id, name: r.name, unit: r.unit, cost: Number(r.cost) || 0, issued: 0, used: 0, returned: 0, requests: 0 };
        map.set(r.raw_material_id, t);
        requestsSeen.set(r.raw_material_id, new Set());
      }
      t.issued += Number(r.issued_quantity) || 0;
      t.used += Number(r.used_quantity) || 0;
      t.returned += Number(r.returned_quantity) || 0;
      requestsSeen.get(r.raw_material_id)!.add(r.request_id);
    });
    map.forEach((t, id) => {
      t.requests = requestsSeen.get(id)!.size;
    });
    return Array.from(map.values()).sort((a, b) => b.used * b.cost - a.used * a.cost);
  }, [filteredRows]);

  const totalValue = byMaterial.reduce((sum, t) => sum + t.used * t.cost, 0);

  // Raw materials come in different units, so the returned quantity is totalled per unit (e.g. "12.5 kg, 40 pcs")
  const returnedByUnit = new Map<string, number>();
  byMaterial.forEach(t => {
    if (t.returned > 0) returnedByUnit.set(t.unit, (returnedByUnit.get(t.unit) || 0) + t.returned);
  });
  const returnedText = returnedByUnit.size
    ? Array.from(returnedByUnit, ([unit, total]) => `${qty(total)} ${unit}`).join(', ')
    : '0';
  const returnedValue = byMaterial.reduce((sum, t) => sum + t.returned * t.cost, 0);
  const requestCount = new Set(filteredRows.map(r => r.request_id)).size;

  const th = 'px-4 py-2.5 text-[10px] font-semibold text-gray-500 uppercase tracking-wider whitespace-nowrap';

  const presetBtn = (label: string, value: Parameters<typeof setPreset>[0]) => (
    <button
      type="button"
      onClick={() => setPreset(value)}
      className="px-2.5 py-1 rounded-full text-[11px] font-medium border border-gray-200 bg-white text-gray-600 hover:bg-gray-50"
    >
      {label}
    </button>
  );

  const tabBtn = (value: Tab, label: string) => (
    <button
      type="button"
      onClick={() => setTab(value)}
      className={`px-3 py-2 text-xs font-medium border-b-2 -mb-px transition-colors ${
        tab === value ? 'border-red-600 text-red-600' : 'border-transparent text-gray-500 hover:text-gray-700'
      }`}
    >
      {label}
    </button>
  );

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
            <h1 className="text-lg font-bold text-gray-900">Raw Materials Used</h1>
            <p className="text-xs text-gray-500 mt-0.5">
              Raw materials consumed in production, from requests whose production has been confirmed.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Link
              to="/raw-material-requests"
              className="px-3 py-1.5 border border-gray-200 rounded-lg shadow-sm text-xs font-medium text-gray-700 bg-white hover:bg-gray-50"
            >
              Back to Requests
            </Link>
            <button
              type="button"
              onClick={fetchUsage}
              disabled={loading}
              className="px-3 py-1.5 border border-gray-200 rounded-lg shadow-sm text-xs font-medium text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50"
            >
              {loading ? 'Refreshing...' : 'Refresh'}
            </button>
          </div>
        </div>

        {/* Date filter */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 px-4 py-3 mb-4 flex flex-wrap items-end gap-3">
          <div>
            <label className="block text-[10px] font-medium text-gray-500 mb-0.5">From</label>
            <input type="date" className={inputClass} value={startDate} max={endDate || undefined} onChange={e => setStartDate(e.target.value)} />
          </div>
          <div>
            <label className="block text-[10px] font-medium text-gray-500 mb-0.5">To</label>
            <input type="date" className={inputClass} value={endDate} min={startDate || undefined} onChange={e => setEndDate(e.target.value)} />
          </div>
          <div className="flex flex-wrap items-center gap-1.5 pb-0.5">
            {presetBtn('Today', 'today')}
            {presetBtn('This week', 'week')}
            {presetBtn('This month', 'month')}
            {presetBtn('Last 30 days', 'last30')}
            {presetBtn('All time', 'all')}
          </div>
          <div className="ml-auto flex flex-wrap items-end gap-3">
            <div>
              <label className="block text-[10px] font-medium text-gray-500 mb-0.5">Raw material</label>
              <select className={`${inputClass} w-52`} value={materialFilter} onChange={e => setMaterialFilter(e.target.value)}>
                <option value="">All raw materials</option>
                {materialOptions.map(m => (
                  <option key={m.id} value={m.id}>{m.name}</option>
                ))}
              </select>
            </div>
            <input
              className={`${inputClass} w-56`}
              placeholder="Search raw material or request..."
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>
        </div>

        {error && <div className="bg-red-50 border border-red-200 rounded-xl p-3 text-red-700 text-xs mb-4">{error}</div>}

        {/* Summary */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
          {stat('Raw materials used', String(byMaterial.length), 'Different raw materials')}
          {stat('Production requests', String(requestCount), 'Confirmed in this period')}
          {stat('Value used', money(totalValue), 'At current raw material cost')}
          {stat('Returned qty', returnedText, `Back to stock · value ${money(returnedValue)}`)}
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="px-4 border-b border-gray-100 flex gap-1">
            {tabBtn('material', 'By raw material')}
            {tabBtn('request', 'By request')}
          </div>

          {loading ? (
            <div className="p-12 text-center">
              <div className="animate-spin rounded-full h-9 w-9 border-b-2 border-red-600 mx-auto"></div>
            </div>
          ) : filteredRows.length === 0 ? (
            <div className="p-12 text-center text-sm text-gray-400">
              No raw materials were used in this period. Usage appears here once production is confirmed on a request.
            </div>
          ) : tab === 'material' ? (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-100">
                <thead className="bg-gray-50">
                  <tr>
                    <th className={`${th} text-left`}>Raw material</th>
                    <th className={`${th} text-left`}>Unit</th>
                    <th className={`${th} text-right`}>Issued</th>
                    <th className={`${th} text-right`}>Used</th>
                    <th className={`${th} text-right`}>Returned</th>
                    <th className={`${th} text-right`}>Requests</th>
                    <th className={`${th} text-right`}>Cost</th>
                    <th className={`${th} text-right`}>Value used</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {byMaterial.map(t => (
                    <tr key={t.raw_material_id} className="hover:bg-gray-50/70">
                      <td className="px-4 py-2.5 whitespace-nowrap text-xs font-semibold text-gray-900">{t.name}</td>
                      <td className="px-4 py-2.5 whitespace-nowrap text-xs text-gray-600">{t.unit}</td>
                      <td className="px-4 py-2.5 text-right text-xs text-gray-700">{qty(t.issued)}</td>
                      <td className="px-4 py-2.5 text-right text-xs font-semibold text-gray-900">{qty(t.used)}</td>
                      <td className="px-4 py-2.5 text-right text-xs text-blue-700">{qty(t.returned)}</td>
                      <td className="px-4 py-2.5 text-right text-xs text-gray-700">{t.requests}</td>
                      <td className="px-4 py-2.5 text-right text-xs text-gray-700">{money(t.cost)}</td>
                      <td className="px-4 py-2.5 text-right text-xs font-semibold text-gray-900">{money(t.used * t.cost)}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot className="bg-gray-50">
                  <tr>
                    <td colSpan={7} className="px-4 py-2.5 text-[11px] font-semibold text-gray-600 text-right">Total value used</td>
                    <td className="px-4 py-2.5 text-right text-xs font-bold text-gray-900">{money(totalValue)}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-100">
                <thead className="bg-gray-50">
                  <tr>
                    <th className={`${th} text-left`}>Date</th>
                    <th className={`${th} text-left`}>Request</th>
                    <th className={`${th} text-left`}>Store</th>
                    <th className={`${th} text-left`}>Raw material</th>
                    <th className={`${th} text-right`}>Issued</th>
                    <th className={`${th} text-right`}>Used</th>
                    <th className={`${th} text-right`}>Returned</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {filteredRows.map((r, i) => (
                    <tr key={`${r.request_id}-${r.raw_material_id}-${i}`} className="hover:bg-gray-50/70">
                      <td className="px-4 py-2.5 whitespace-nowrap text-xs text-gray-700">{new Date(r.completed_at).toLocaleDateString()}</td>
                      <td className="px-4 py-2.5 whitespace-nowrap text-xs font-semibold text-gray-900">{r.request_number}</td>
                      <td className="px-4 py-2.5 whitespace-nowrap text-xs text-gray-700">{r.store_name || '—'}</td>
                      <td className="px-4 py-2.5 whitespace-nowrap text-xs text-gray-900">
                        {r.name} <span className="text-gray-400">({r.unit})</span>
                      </td>
                      <td className="px-4 py-2.5 text-right text-xs text-gray-700">{qty(r.issued_quantity)}</td>
                      <td className="px-4 py-2.5 text-right text-xs font-semibold text-gray-900">{qty(r.used_quantity)}</td>
                      <td className="px-4 py-2.5 text-right text-xs text-blue-700">{qty(r.returned_quantity)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default RawMaterialUsagePage;
