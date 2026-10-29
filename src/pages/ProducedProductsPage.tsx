import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import axios from 'axios';

interface ProducedRow {
  product_id: number;
  product_name: string;
  product_code?: string | null;
  category?: string | null;
  target_quantity: number | string;
  produced_quantity: number | string;
  request_id: number;
  request_number: string;
  completed_at: string;
  store_name?: string;
}

interface UsageRow {
  raw_material_id: number;
  name: string;
  unit: string;
  issued_quantity: number | string;
  used_quantity: number | string;
  returned_quantity: number | string;
  request_id: number;
}

interface RecipeRow {
  product_id: number;
  raw_material_id: number;
  quantity: number | string;
  name: string;
  unit: string;
}

interface ProductTotal {
  product_id: number;
  product_name: string;
  produced: number;
}

interface RequestGroup {
  request_id: number;
  request_number: string;
  completed_at: string;
  products: ProducedRow[];
  materials: UsageRow[];
}

type View = 'product' | 'request';

const toIso = (d: Date) => {
  const local = new Date(d.getTime() - d.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 10);
};

const qty = (n: number | string) => Number(n || 0).toLocaleString(undefined, { maximumFractionDigits: 3 });

const inputClass =
  'border border-gray-200 rounded-lg px-2.5 py-1.5 text-xs bg-white focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-red-500';

const th = 'px-4 py-2.5 text-[10px] font-semibold text-gray-500 uppercase tracking-wider whitespace-nowrap bg-gray-50';
const td = 'px-4 py-2 text-xs text-gray-700 border-t border-gray-100';

const ProducedProductsPage: React.FC = () => {
  const today = new Date();
  const [startDate, setStartDate] = useState(toIso(new Date(today.getFullYear(), today.getMonth(), 1)));
  const [endDate, setEndDate] = useState(toIso(today));
  const [rows, setRows] = useState<ProducedRow[]>([]);
  const [usage, setUsage] = useState<UsageRow[]>([]);
  const [recipes, setRecipes] = useState<RecipeRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [view, setView] = useState<View>('product');
  const [search, setSearch] = useState('');

  const fetchProduced = async () => {
    setLoading(true);
    setError(null);
    try {
      const params = { start_date: startDate || undefined, end_date: endDate || undefined };
      const [res, usageRes] = await Promise.all([
        axios.get('/api/financial/raw-material-requests/produced', { params }),
        axios.get('/api/financial/raw-material-requests/usage', { params }).catch(() => null),
      ]);
      if (res.data?.success) {
        setRows(res.data.data || []);
        setRecipes(res.data.recipes || []);
      } else {
        setError(res.data?.error || 'Failed to load produced products');
      }
      setUsage(usageRes?.data?.success ? usageRes.data.data || [] : []);
    } catch (err: any) {
      setError(err.response?.data?.error || err.message || 'Failed to load produced products');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProduced();
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
    if (!q) return rows;
    return rows.filter(r => [r.product_name, r.product_code, r.category, r.request_number].some(v => (v || '').toLowerCase().includes(q)));
  }, [rows, search]);

  const byProduct: ProductTotal[] = useMemo(() => {
    const map = new Map<number, ProductTotal>();
    filteredRows.forEach(r => {
      let t = map.get(r.product_id);
      if (!t) {
        t = { product_id: r.product_id, product_name: r.product_name, produced: 0 };
        map.set(r.product_id, t);
      }
      t.produced += Number(r.produced_quantity) || 0;
    });
    return Array.from(map.values()).sort((a, b) => a.product_name.localeCompare(b.product_name));
  }, [filteredRows]);

  const byRequest: RequestGroup[] = useMemo(() => {
    const map = new Map<number, RequestGroup>();
    filteredRows.forEach(r => {
      let g = map.get(r.request_id);
      if (!g) {
        g = { request_id: r.request_id, request_number: r.request_number, completed_at: r.completed_at, products: [], materials: [] };
        map.set(r.request_id, g);
      }
      g.products.push(r);
    });
    usage.forEach(u => map.get(u.request_id)?.materials.push(u));
    return Array.from(map.values());
  }, [filteredRows, usage]);

  // Raw materials used per product, taken from the requests that produced it.
  // A request's usage is recorded per request, so when it produced several
  // products each material is shared out by recipe requirement (recipe qty x
  // units produced), or by units produced when the product has no recipe line.
  const materialsByProduct = useMemo(() => {
    const result = new Map<number, Map<number, { name: string; unit: string; used: number; returned: number }>>();
    const recipeQty = new Map<string, number>();
    recipes.forEach(r => recipeQty.set(`${r.product_id}-${r.raw_material_id}`, Number(r.quantity) || 0));

    byRequest.forEach(g => {
      g.materials.forEach(m => {
        const weights = g.products.map(p => (recipeQty.get(`${p.product_id}-${m.raw_material_id}`) || 0) * (Number(p.produced_quantity) || 0));
        let total = weights.reduce((a, b) => a + b, 0);
        const w = total > 0 ? weights : g.products.map(p => Number(p.produced_quantity) || 0);
        total = w.reduce((a, b) => a + b, 0);
        g.products.forEach((p, i) => {
          const share = total > 0 ? w[i] / total : 1 / g.products.length;
          let perProduct = result.get(p.product_id);
          if (!perProduct) {
            perProduct = new Map();
            result.set(p.product_id, perProduct);
          }
          let entry = perProduct.get(m.raw_material_id);
          if (!entry) {
            entry = { name: m.name, unit: m.unit, used: 0, returned: 0 };
            perProduct.set(m.raw_material_id, entry);
          }
          entry.used += (Number(m.used_quantity) || 0) * share;
          entry.returned += (Number(m.returned_quantity) || 0) * share;
        });
      });
    });
    return result;
  }, [byRequest, recipes]);

  const totalProduced = byProduct.reduce((sum, t) => sum + t.produced, 0);

  const presetBtn = (label: string, value: Parameters<typeof setPreset>[0]) => (
    <button
      type="button"
      onClick={() => setPreset(value)}
      className="px-2.5 py-1 rounded-full text-[11px] font-medium border border-gray-200 bg-white text-gray-600 hover:bg-gray-50"
    >
      {label}
    </button>
  );

  const viewBtn = (value: View, label: string) => (
    <button
      type="button"
      onClick={() => setView(value)}
      className={`px-3 py-2 text-xs font-medium border-b-2 -mb-px transition-colors ${
        view === value ? 'border-red-600 text-red-600' : 'border-transparent text-gray-500 hover:text-gray-700'
      }`}
    >
      {label}
    </button>
  );

  return (
    <div className="min-h-screen bg-[#f3f5fd]">
      <div className="w-full py-5 px-4 sm:px-6 lg:px-8">
        <div className="mb-4 flex items-center justify-between gap-3 flex-wrap">
          <div>
            <h1 className="text-lg font-bold text-gray-900">Produced Products</h1>
            <p className="text-xs text-gray-500 mt-0.5">Products produced and the raw materials used, from confirmed production requests.</p>
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
              onClick={fetchProduced}
              disabled={loading}
              className="px-3 py-1.5 border border-gray-200 rounded-lg shadow-sm text-xs font-medium text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50"
            >
              {loading ? 'Refreshing...' : 'Refresh'}
            </button>
          </div>
        </div>

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
          <div className="ml-auto">
            <input className={`${inputClass} w-64`} placeholder="Search product or request..." value={search} onChange={e => setSearch(e.target.value)} />
          </div>
        </div>

        {error && <div className="bg-red-50 border border-red-200 rounded-xl p-3 text-red-700 text-xs mb-4">{error}</div>}

        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="px-4 border-b border-gray-100 flex gap-1">
            {viewBtn('product', 'By product')}
            {viewBtn('request', 'By request')}
          </div>

          {loading ? (
            <div className="p-12 text-center">
              <div className="animate-spin rounded-full h-9 w-9 border-b-2 border-red-600 mx-auto"></div>
            </div>
          ) : filteredRows.length === 0 ? (
            <div className="p-12 text-center text-sm text-gray-400">
              No products were produced in this period. They appear here once production is confirmed on a request.
            </div>
          ) : view === 'product' ? (
            <div className="overflow-x-auto">
              <table className="min-w-full">
                <thead>
                  <tr>
                    <th className={`${th} text-left`}>Product</th>
                    <th className={`${th} text-right`}>Produced</th>
                    <th className={`${th} text-left`}>Raw material used</th>
                    <th className={`${th} text-right`}>Used</th>
                    <th className={`${th} text-right`}>Returned</th>
                  </tr>
                </thead>
                <tbody>
                  {byProduct.map(t => {
                    const materials = Array.from(materialsByProduct.get(t.product_id)?.entries() || []).map(([id, m]) => ({ raw_material_id: id, ...m }));
                    const span = Math.max(materials.length, 1);
                    return (
                      <React.Fragment key={t.product_id}>
                        {(materials.length ? materials : [null]).map((m, i) => (
                          <tr key={m ? m.raw_material_id : 'none'}>
                            {i === 0 && (
                              <>
                                <td rowSpan={span} className={`${td} font-semibold text-gray-900 align-top`}>{t.product_name}</td>
                                <td rowSpan={span} className={`${td} text-right font-semibold text-gray-900 align-top`}>{qty(t.produced)}</td>
                              </>
                            )}
                            {m ? (
                              <>
                                <td className={td}>{m.name} <span className="text-gray-400">({m.unit})</span></td>
                                <td className={`${td} text-right font-semibold text-gray-900`}>{qty(m.used)}</td>
                                <td className={`${td} text-right text-blue-700`}>{qty(m.returned)}</td>
                              </>
                            ) : (
                              <td colSpan={3} className={`${td} text-gray-400`}>No usage recorded</td>
                            )}
                          </tr>
                        ))}
                      </React.Fragment>
                    );
                  })}
                </tbody>
                <tfoot>
                  <tr>
                    <td className={`${td} font-bold text-gray-900 bg-gray-50`}>Total</td>
                    <td className={`${td} text-right font-bold text-gray-900 bg-gray-50`}>{qty(totalProduced)}</td>
                    <td colSpan={3} className={`${td} bg-gray-50`}></td>
                  </tr>
                </tfoot>
              </table>
              <p className="px-4 py-2 text-[10px] text-gray-400 border-t border-gray-100">Raw materials are taken from the requests that produced each product. Where a request produced several products, its usage is shared between them by recipe requirement.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full">
                <thead>
                  <tr>
                    <th className={`${th} text-left`}>Request</th>
                    <th className={`${th} text-left`}>Date</th>
                    <th className={`${th} text-left`}>Products produced</th>
                    <th className={`${th} text-left`}>Raw material used</th>
                    <th className={`${th} text-right`}>Issued</th>
                    <th className={`${th} text-right`}>Used</th>
                    <th className={`${th} text-right`}>Returned</th>
                  </tr>
                </thead>
                <tbody>
                  {byRequest.map(g => {
                    const span = Math.max(g.materials.length, 1);
                    return (
                      <React.Fragment key={g.request_id}>
                        {(g.materials.length ? g.materials : [null]).map((m, i) => (
                          <tr key={m ? m.raw_material_id : 'none'}>
                            {i === 0 && (
                              <>
                                <td rowSpan={span} className={`${td} font-semibold text-gray-900 align-top whitespace-nowrap`}>{g.request_number}</td>
                                <td rowSpan={span} className={`${td} align-top whitespace-nowrap`}>{new Date(g.completed_at).toLocaleDateString()}</td>
                                <td rowSpan={span} className={`${td} align-top`}>
                                  {g.products.map(p => (
                                    <div key={p.product_id} className="whitespace-nowrap">
                                      {p.product_name} <span className="font-semibold text-gray-900">× {qty(p.produced_quantity)}</span>
                                    </div>
                                  ))}
                                </td>
                              </>
                            )}
                            {m ? (
                              <>
                                <td className={td}>{m.name} <span className="text-gray-400">({m.unit})</span></td>
                                <td className={`${td} text-right`}>{qty(m.issued_quantity)}</td>
                                <td className={`${td} text-right font-semibold text-gray-900`}>{qty(m.used_quantity)}</td>
                                <td className={`${td} text-right text-blue-700`}>{qty(m.returned_quantity)}</td>
                              </>
                            ) : (
                              <td colSpan={4} className={`${td} text-gray-400`}>No usage recorded</td>
                            )}
                          </tr>
                        ))}
                      </React.Fragment>
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

export default ProducedProductsPage;
