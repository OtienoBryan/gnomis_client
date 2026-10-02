import React, { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { productsService } from '../services/financialService';
import { Product } from '../types/financial';

interface RawMaterial {
  id: number;
  name: string;
  unit: string;
  total: number; // current stock across all stores
}

interface ProductLine {
  product_id: number | '';
  quantity: string;
}

interface MaterialLine {
  raw_material_id: number | '';
  quantity: string;
}

const inputClass =
  'w-full border border-gray-200 rounded-lg px-2.5 py-1.5 text-xs bg-white focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-red-500';

const fmt = (n: number) => Number(n || 0).toLocaleString(undefined, { maximumFractionDigits: 3 });

const NewRawMaterialRequestPage: React.FC = () => {
  const navigate = useNavigate();
  const [products, setProducts] = useState<Product[]>([]);
  const [materials, setMaterials] = useState<RawMaterial[]>([]);
  const [productLines, setProductLines] = useState<ProductLine[]>([{ product_id: '', quantity: '' }]);
  const [materialLines, setMaterialLines] = useState<MaterialLine[]>([{ raw_material_id: '', quantity: '' }]);
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(true);
  const [filling, setFilling] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      try {
        const [productsRes, materialsRes] = await Promise.all([
          productsService.getAll(),
          axios.get('/api/financial/raw-materials/inventory'),
        ]);
        if (productsRes.success) setProducts(productsRes.data || []);
        if (materialsRes.data?.success) setMaterials(materialsRes.data.data.materials || []);
      } catch (err: any) {
        setError(err.response?.data?.error || err.message || 'Failed to load products and raw materials');
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const materialById = useMemo(() => new Map(materials.map(m => [m.id, m])), [materials]);

  /* ── product lines ── */
  const updateProductLine = (i: number, patch: Partial<ProductLine>) =>
    setProductLines(prev => prev.map((l, idx) => (idx === i ? { ...l, ...patch } : l)));
  const removeProductLine = (i: number) =>
    setProductLines(prev => (prev.length === 1 ? [{ product_id: '', quantity: '' }] : prev.filter((_, idx) => idx !== i)));
  const productUsedElsewhere = (i: number, id: number) => productLines.some((l, idx) => idx !== i && l.product_id === id);

  /* ── raw material lines ── */
  const updateMaterialLine = (i: number, patch: Partial<MaterialLine>) =>
    setMaterialLines(prev => prev.map((l, idx) => (idx === i ? { ...l, ...patch } : l)));
  const removeMaterialLine = (i: number) =>
    setMaterialLines(prev => (prev.length === 1 ? [{ raw_material_id: '', quantity: '' }] : prev.filter((_, idx) => idx !== i)));
  const materialUsedElsewhere = (i: number, id: number) => materialLines.some((l, idx) => idx !== i && l.raw_material_id === id);

  // Work out the raw materials needed from each product's recipe x the quantity to produce
  const fillFromRecipes = async () => {
    setError(null);
    setInfo(null);
    const wanted = productLines.filter(l => l.product_id && parseFloat(l.quantity) > 0);
    if (wanted.length === 0) {
      setError('Choose the products and quantities first');
      return;
    }
    setFilling(true);
    try {
      const totals = new Map<number, number>();
      const noRecipe: string[] = [];
      for (const l of wanted) {
        const res = await axios.get(`/api/financial/products/${l.product_id}/recipe`);
        const recipe: { raw_material_id: number; quantity: number }[] = res.data?.data || [];
        if (recipe.length === 0) {
          noRecipe.push(products.find(p => p.id === l.product_id)?.product_name || `Product ${l.product_id}`);
          continue;
        }
        recipe.forEach(r => {
          totals.set(r.raw_material_id, (totals.get(r.raw_material_id) || 0) + Number(r.quantity) * parseFloat(l.quantity));
        });
      }
      if (totals.size > 0) {
        setMaterialLines(
          Array.from(totals, ([raw_material_id, quantity]) => ({
            raw_material_id,
            quantity: String(Math.round(quantity * 1000) / 1000),
          }))
        );
      }
      setInfo(
        noRecipe.length
          ? `No recipe set for: ${noRecipe.join(', ')}. Add those raw materials by hand.`
          : 'Raw materials filled in from the recipes. You can adjust the quantities.'
      );
    } catch (err: any) {
      setError(err.response?.data?.error || err.message || 'Failed to load recipes');
    } finally {
      setFilling(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const products = productLines.filter(l => l.product_id || l.quantity);
    const items = materialLines.filter(l => l.raw_material_id || l.quantity);
    if (products.length === 0) return setError('Add at least one product to produce');
    for (const [i, l] of products.entries()) {
      if (!l.product_id) return setError(`Choose a product for product line ${i + 1}`);
      if (!(parseFloat(l.quantity) > 0)) return setError(`Enter a target quantity greater than 0 for product line ${i + 1}`);
    }
    if (items.length === 0) return setError('Add at least one raw material to request');
    for (const [i, l] of items.entries()) {
      if (!l.raw_material_id) return setError(`Choose a raw material for line ${i + 1}`);
      if (!(parseFloat(l.quantity) > 0)) return setError(`Enter a quantity greater than 0 for raw material line ${i + 1}`);
    }

    try {
      setSaving(true);
      const res = await axios.post('/api/financial/raw-material-requests', {
        notes,
        products: products.map(l => ({ product_id: l.product_id, quantity: parseFloat(l.quantity) })),
        items: items.map(l => ({ raw_material_id: l.raw_material_id, quantity: parseFloat(l.quantity) })),
      });
      if (res.data?.success) {
        navigate('/raw-material-requests', { state: { created: res.data.data.request_number } });
      } else {
        setError(res.data?.error || 'Failed to create request');
      }
    } catch (err: any) {
      setError(err.response?.data?.error || err.message || 'Failed to create request');
    } finally {
      setSaving(false);
    }
  };

  const th = 'text-[10px] font-semibold text-gray-500 uppercase tracking-wider';

  return (
    <div className="min-h-screen bg-[#f3f5fd]">
      <form onSubmit={handleSubmit} className="w-full px-4 sm:px-6 lg:px-8 py-5">
        <div className="mb-4 flex items-center justify-between gap-3 flex-wrap">
          <div>
            <h1 className="text-lg font-bold text-gray-900">New Raw Material Request</h1>
            <p className="text-xs text-gray-500 mt-0.5">Choose what to produce, then the raw materials needed. The request starts as pending.</p>
          </div>
          <Link
            to="/raw-material-requests"
            className="px-3 py-1.5 border border-gray-200 rounded-lg shadow-sm text-xs font-medium text-gray-700 bg-white hover:bg-gray-50"
          >
            Back to Requests
          </Link>
        </div>

        {loading ? (
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-12 text-center">
            <div className="animate-spin rounded-full h-9 w-9 border-b-2 border-red-600 mx-auto"></div>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 items-start">
            {/* Step 1: products */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4">
              <h2 className="text-sm font-bold text-gray-900">1. Products to produce</h2>
              <p className="text-xs text-gray-500 mb-3">Choose each product and the quantity you are targeting.</p>

              <div className={`grid grid-cols-[1fr_110px_24px] gap-2 mb-1.5 px-0.5 ${th}`}>
                <span>Product</span>
                <span>Target qty</span>
                <span></span>
              </div>
              <div className="space-y-2">
                {productLines.map((l, i) => (
                  <div key={i} className="grid grid-cols-[1fr_110px_24px] gap-2 items-center">
                    <select
                      className={inputClass}
                      value={l.product_id}
                      onChange={e => updateProductLine(i, { product_id: e.target.value ? Number(e.target.value) : '' })}
                    >
                      <option value="">Select product</option>
                      {products.map(p => (
                        <option key={p.id} value={p.id} disabled={productUsedElsewhere(i, p.id)}>
                          {p.product_name}
                        </option>
                      ))}
                    </select>
                    <input
                      className={inputClass}
                      type="number"
                      min="0"
                      step="1"
                      placeholder="Qty"
                      value={l.quantity}
                      onChange={e => updateProductLine(i, { quantity: e.target.value })}
                    />
                    <button type="button" onClick={() => removeProductLine(i)} className="text-gray-400 hover:text-red-600 text-base leading-none" title="Remove">
                      ×
                    </button>
                  </div>
                ))}
              </div>
              <button
                type="button"
                onClick={() => setProductLines(prev => [...prev, { product_id: '', quantity: '' }])}
                className="mt-3 px-3 py-1.5 rounded-md text-xs font-medium text-white bg-blue-600 hover:bg-blue-700 shadow-sm"
              >
                Add product
              </button>
            </div>

            {/* Step 2: raw materials */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h2 className="text-sm font-bold text-gray-900">2. Raw materials to request</h2>
                  <p className="text-xs text-gray-500 mb-3">Choose the raw materials and the quantity of each.</p>
                </div>
                <button
                  type="button"
                  onClick={fillFromRecipes}
                  disabled={filling}
                  className="px-3 py-1.5 rounded-md text-xs font-medium text-white bg-emerald-600 hover:bg-emerald-700 shadow-sm disabled:opacity-50 whitespace-nowrap"
                >
                  {filling ? 'Calculating...' : 'Fill from recipes'}
                </button>
              </div>

              {info && <div className="mb-3 bg-blue-50 border border-blue-100 rounded-lg px-3 py-2 text-xs text-blue-700">{info}</div>}

              <div className={`grid grid-cols-[1fr_110px_90px_24px] gap-2 mb-1.5 px-0.5 ${th}`}>
                <span>Raw material</span>
                <span>Quantity</span>
                <span>Unit / in stock</span>
                <span></span>
              </div>
              <div className="space-y-2">
                {materialLines.map((l, i) => {
                  const m = l.raw_material_id ? materialById.get(l.raw_material_id) : undefined;
                  const over = m && parseFloat(l.quantity) > Number(m.total);
                  return (
                    <div key={i} className="grid grid-cols-[1fr_110px_90px_24px] gap-2 items-center">
                      <select
                        className={inputClass}
                        value={l.raw_material_id}
                        onChange={e => updateMaterialLine(i, { raw_material_id: e.target.value ? Number(e.target.value) : '' })}
                      >
                        <option value="">Select raw material</option>
                        {materials.map(mat => (
                          <option key={mat.id} value={mat.id} disabled={materialUsedElsewhere(i, mat.id)}>
                            {mat.name}
                          </option>
                        ))}
                      </select>
                      <input
                        className={inputClass}
                        type="number"
                        min="0"
                        step="0.001"
                        placeholder="Qty"
                        value={l.quantity}
                        onChange={e => updateMaterialLine(i, { quantity: e.target.value })}
                      />
                      <span className={`text-[11px] leading-tight ${over ? 'text-red-600 font-medium' : 'text-gray-500'}`}>
                        {m ? `${m.unit} · ${fmt(m.total)}` : '—'}
                        {over && <span className="block">Above stock</span>}
                      </span>
                      <button type="button" onClick={() => removeMaterialLine(i)} className="text-gray-400 hover:text-red-600 text-base leading-none" title="Remove">
                        ×
                      </button>
                    </div>
                  );
                })}
              </div>
              <button
                type="button"
                onClick={() => setMaterialLines(prev => [...prev, { raw_material_id: '', quantity: '' }])}
                disabled={materials.length === 0}
                className="mt-3 px-3 py-1.5 rounded-md text-xs font-medium text-white bg-blue-600 hover:bg-blue-700 shadow-sm disabled:opacity-50"
              >
                Add raw material
              </button>
              {materials.length === 0 && <p className="text-[11px] text-gray-400 mt-2">No active raw materials found.</p>}
            </div>
          </div>
        )}

        {!loading && (
          <div className="mt-4 bg-white rounded-2xl shadow-sm border border-gray-100 p-4">
            <label className="block text-[11px] font-semibold text-gray-500 uppercase tracking-wider mb-1">Notes (optional)</label>
            <textarea
              rows={2}
              className={inputClass}
              placeholder="Anything the store should know about this request"
              value={notes}
              onChange={e => setNotes(e.target.value)}
            />

            {error && <div className="mt-3 bg-red-50 border border-red-200 rounded-lg px-3 py-2 text-xs text-red-700">{error}</div>}

            <div className="mt-4 flex items-center justify-between gap-3 flex-wrap">
              <span className="inline-flex px-2.5 py-1 rounded-full text-[11px] font-semibold bg-amber-100 text-amber-700">
                Status: Pending
              </span>
              <div className="flex gap-2">
                <Link
                  to="/raw-material-requests"
                  className="px-4 py-2 rounded-lg text-xs font-medium bg-gray-100 text-gray-700 hover:bg-gray-200"
                >
                  Cancel
                </Link>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-4 py-2 rounded-lg text-xs font-medium text-white bg-red-600 hover:bg-red-700 disabled:opacity-50"
                >
                  {saving ? 'Submitting...' : 'Submit Request'}
                </button>
              </div>
            </div>
          </div>
        )}
      </form>
    </div>
  );
};

export default NewRawMaterialRequestPage;
