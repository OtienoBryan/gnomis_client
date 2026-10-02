import React, { useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import { Link } from 'react-router-dom';

interface StoreCol {
  id: number;
  store_name: string;
  store_code?: string;
}

interface MaterialRow {
  id: number;
  name: string;
  unit: string;
  alert_qty: number;
  cost: number;
  by_store: Record<string, number>;
  unassigned: number;
  total: number;
}

type StockFilter = 'all' | 'low' | 'out';
type SortKey = 'name' | 'value_desc' | 'stock_asc';

const fmt = (n: number) => Number(n || 0).toLocaleString(undefined, { maximumFractionDigits: 2 });
const money = (n: number) =>
  Number(n || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const stockValue = (m: MaterialRow) => Number(m.total) * Number(m.cost || 0);
const isOut = (m: MaterialRow) => Number(m.total) <= 0;
const isLow = (m: MaterialRow) => !isOut(m) && m.alert_qty > 0 && Number(m.total) <= m.alert_qty;

interface StatCardProps {
  label: string;
  value: string;
  hint?: string;
}

const StatCard: React.FC<StatCardProps> = ({ label, value, hint }) => (
  <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 min-w-0">
    <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">{label}</p>
    <p className="text-lg font-bold text-gray-900 truncate">{value}</p>
    {hint && <p className="text-[10px] text-gray-400">{hint}</p>}
  </div>
);

const RawMaterialInventoryPage: React.FC = () => {
  const [stores, setStores] = useState<StoreCol[]>([]);
  const [materials, setMaterials] = useState<MaterialRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<StockFilter>('all');
  const [sortKey, setSortKey] = useState<SortKey>('name');

  const fetchInventory = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await axios.get('/api/financial/raw-materials/inventory');
      if (res.data?.success) {
        setStores(res.data.data.stores || []);
        setMaterials(res.data.data.materials || []);
      } else {
        setError(res.data?.error || 'Failed to load raw material inventory');
      }
    } catch (err: any) {
      setError(err.response?.data?.error || err.message || 'Failed to load raw material inventory');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchInventory();
  }, []);

  const totalStockValue = materials.reduce((sum, m) => sum + stockValue(m), 0);
  const lowCount = materials.filter(isLow).length;
  const outCount = materials.filter(isOut).length;

  const rows = useMemo(() => {
    const q = search.trim().toLowerCase();
    const list = materials.filter(m => {
      if (q && !m.name.toLowerCase().includes(q)) return false;
      if (filter === 'low') return isLow(m);
      if (filter === 'out') return isOut(m);
      return true;
    });
    return [...list].sort((a, b) => {
      if (sortKey === 'value_desc') return stockValue(b) - stockValue(a);
      if (sortKey === 'stock_asc') return Number(a.total) - Number(b.total);
      return a.name.localeCompare(b.name);
    });
  }, [materials, search, filter, sortKey]);

  const filteredValue = rows.reduce((sum, m) => sum + stockValue(m), 0);

  // Older ledger entries have no store; only show that column when it holds stock
  const showUnassigned = materials.some(m => m.unassigned !== 0);
  const th = 'px-4 py-2.5 text-[10px] font-semibold text-gray-500 uppercase tracking-wider whitespace-nowrap';

  const chip = (value: StockFilter, label: string, count?: number) => (
    <button
      type="button"
      onClick={() => setFilter(value)}
      className={`px-3 py-1 rounded-full text-xs font-medium border transition-colors ${
        filter === value ? 'bg-red-600 text-white border-red-600' : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'
      }`}
    >
      {label}
      {count !== undefined && <span className={`ml-1.5 ${filter === value ? 'text-red-100' : 'text-gray-400'}`}>{count}</span>}
    </button>
  );

  const statusPill = (m: MaterialRow) => {
    if (isOut(m)) return <span className="inline-flex px-2 py-0.5 rounded-full text-[10px] font-semibold bg-gray-100 text-gray-600">Out of stock</span>;
    if (isLow(m)) return <span className="inline-flex px-2 py-0.5 rounded-full text-[10px] font-semibold bg-red-100 text-red-700">Low stock</span>;
    return <span className="inline-flex px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-100 text-emerald-700">In stock</span>;
  };

  return (
    <div className="min-h-screen bg-[#f3f5fd]">
      <div className="w-full py-5 px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-4 flex items-center justify-between gap-3 flex-wrap">
          <div>
            <h1 className="text-lg font-bold text-gray-900">Raw Material Inventory</h1>
            <p className="text-xs text-gray-500 mt-0.5">Current stock, cost and value of each raw material, per store.</p>
          </div>
          <div className="flex items-center gap-2">
            <Link
              to="/raw-materials"
              className="px-3 py-1.5 rounded-lg shadow-sm text-xs font-medium text-white bg-red-600 hover:bg-red-700"
            >
              Raw Materials
            </Link>
            <button
              type="button"
              onClick={fetchInventory}
              disabled={loading}
              className="px-3 py-1.5 border border-gray-200 rounded-lg shadow-sm text-xs font-medium text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50"
            >
              {loading ? 'Refreshing...' : 'Refresh'}
            </button>
          </div>
        </div>

        {error && <div className="bg-red-50 border border-red-200 rounded-xl p-3 text-red-700 text-xs mb-4">{error}</div>}

        {/* Summary */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
          <StatCard
            label="Total Stock Value"
            value={money(totalStockValue)}
            hint="All stores"
          />
          <StatCard
            label="Raw Materials"
            value={String(materials.length)}
            hint={`${stores.length} store${stores.length === 1 ? '' : 's'}`}
          />
          <StatCard
            label="Low Stock"
            value={String(lowCount)}
            hint="At or below alert qty"
          />
          <StatCard
            label="Out of Stock"
            value={String(outCount)}
            hint="No stock on hand"
          />
        </div>

        {/* Table panel */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-100 flex flex-wrap items-center gap-3 justify-between">
            <div className="flex flex-wrap items-center gap-2">
              {chip('all', 'All', materials.length)}
              {chip('low', 'Low stock', lowCount)}
              {chip('out', 'Out of stock', outCount)}
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <div>
                <input
                  className="border border-gray-200 rounded-lg px-3 py-1.5 text-xs w-56 focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-red-500"
                  placeholder="Search raw materials..."
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                />
              </div>
              <select
                value={sortKey}
                onChange={e => setSortKey(e.target.value as SortKey)}
                className="border border-gray-200 rounded-lg px-2.5 py-1.5 text-xs bg-white focus:outline-none focus:ring-2 focus:ring-red-500"
              >
                <option value="name">Sort: Name</option>
                <option value="value_desc">Sort: Highest value</option>
                <option value="stock_asc">Sort: Lowest stock</option>
              </select>
            </div>
          </div>

          {loading ? (
            <div className="p-12 text-center">
              <div className="animate-spin rounded-full h-9 w-9 border-b-2 border-red-600 mx-auto"></div>
              <p className="mt-3 text-sm text-gray-600">Loading inventory...</p>
            </div>
          ) : rows.length === 0 ? (
            <div className="p-12 text-center text-gray-400">
              <p className="text-sm font-medium">No raw materials found</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-100">
                <thead className="bg-gray-50">
                  <tr>
                    <th className={`${th} text-left`}>Raw Material</th>
                    {stores.map(st => (
                      <th key={st.id} className={`${th} text-right`}>{st.store_name}</th>
                    ))}
                    {showUnassigned && <th className={`${th} text-right`}>No Store</th>}
                    <th className={`${th} text-right`}>Total Stock</th>
                    <th className={`${th} text-right`}>Cost</th>
                    <th className={`${th} text-right`}>Stock Value</th>
                    <th className={`${th} text-right`}>Alert Qty</th>
                    <th className={`${th} text-left`}>Status</th>
                    <th className={`${th} text-right`}></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {rows.map(m => (
                    <tr key={m.id} className="hover:bg-gray-50/70">
                      <td className="px-4 py-2.5 whitespace-nowrap">
                        <div className="text-xs font-semibold text-gray-900">{m.name}</div>
                        <div className="text-[10px] text-gray-400">per {m.unit}</div>
                      </td>
                      {stores.map(st => {
                        const qty = m.by_store[st.id] || 0;
                        return (
                          <td key={st.id} className={`px-4 py-2.5 text-right text-xs ${qty ? 'text-gray-900' : 'text-gray-300'}`}>
                            {qty ? fmt(qty) : '—'}
                          </td>
                        );
                      })}
                      {showUnassigned && (
                        <td className={`px-4 py-2.5 text-right text-xs ${m.unassigned ? 'text-gray-900' : 'text-gray-300'}`}>
                          {m.unassigned ? fmt(m.unassigned) : '—'}
                        </td>
                      )}
                      <td className="px-4 py-2.5 text-right">
                        <div className="text-xs font-bold text-gray-900">
                          {fmt(m.total)} <span className="text-[10px] font-normal text-gray-400">{m.unit}</span>
                        </div>
                      </td>
                      <td className="px-4 py-2.5 text-right text-xs text-gray-700">{money(m.cost)}</td>
                      <td className="px-4 py-2.5 text-right text-xs font-semibold text-gray-900">{money(stockValue(m))}</td>
                      <td className="px-4 py-2.5 text-right text-xs text-gray-500">{fmt(m.alert_qty)}</td>
                      <td className="px-4 py-2.5 whitespace-nowrap">{statusPill(m)}</td>
                      <td className="px-4 py-2.5 text-right">
                        <Link
                          to={`/raw-materials-ledger?material=${m.id}`}
                          className="px-2.5 py-1 rounded-md text-[11px] font-medium text-white bg-blue-600 hover:bg-blue-700 shadow-sm"
                        >
                          Ledger
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot className="bg-gray-50">
                  <tr>
                    <td
                      className="px-4 py-2.5 text-[11px] font-semibold text-gray-600 text-right"
                      colSpan={1 + stores.length + (showUnassigned ? 1 : 0) + 2}
                    >
                      Total value{rows.length !== materials.length ? ' (filtered)' : ''}
                    </td>
                    <td className="px-4 py-2.5 text-right text-xs font-bold text-gray-900">{money(filteredValue)}</td>
                    <td colSpan={3}></td>
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default RawMaterialInventoryPage;
