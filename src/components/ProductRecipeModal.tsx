import React, { useEffect, useMemo, useState } from 'react';
import axios from 'axios';

interface RawMaterial {
  id: number;
  name: string;
  unit: string;
  cost: number | string;
  is_active: number;
}

interface RecipeLine {
  raw_material_id: number | '';
  quantity: string;
}

interface Props {
  product: { id: number; product_name: string } | null;
  onClose: () => void;
  onSaved?: (productId: number, costPrice: number | null) => void;
}

const inputClass =
  'w-full border border-gray-200 rounded-lg px-2.5 py-1.5 text-xs bg-white focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-red-500';

const money = (n: number) => n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const ProductRecipeModal: React.FC<Props> = ({ product, onClose, onSaved }) => {
  const [materials, setMaterials] = useState<RawMaterial[]>([]);
  const [lines, setLines] = useState<RecipeLine[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const productId = product?.id;

  useEffect(() => {
    if (!productId) return;
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const [matRes, recipeRes] = await Promise.all([
          axios.get('/api/financial/raw-materials'),
          axios.get(`/api/financial/products/${productId}/recipe`),
        ]);
        if (cancelled) return;
        setMaterials((matRes.data?.data || []).filter((m: RawMaterial) => m.is_active));
        const saved = (recipeRes.data?.data || []).map((r: any) => ({
          raw_material_id: r.raw_material_id,
          quantity: String(Number(r.quantity)),
        }));
        setLines(saved);
      } catch (err: any) {
        if (!cancelled) setError(err.response?.data?.error || err.message || 'Failed to load recipe');
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    load();
    return () => {
      cancelled = true;
    };
  }, [productId]);

  const materialById = useMemo(() => new Map(materials.map(m => [m.id, m])), [materials]);

  if (!product) return null;

  const updateLine = (index: number, patch: Partial<RecipeLine>) =>
    setLines(prev => prev.map((l, i) => (i === index ? { ...l, ...patch } : l)));

  const removeLine = (index: number) => setLines(prev => prev.filter((_, i) => i !== index));

  const addLine = () => setLines(prev => [...prev, { raw_material_id: '', quantity: '' }]);

  // A raw material can only be used once per recipe
  const usedElsewhere = (index: number, id: number) => lines.some((l, i) => i !== index && l.raw_material_id === id);

  const estimatedCost = lines.reduce((sum, l) => {
    const m = l.raw_material_id ? materialById.get(l.raw_material_id) : undefined;
    return sum + (m ? Number(m.cost) * (parseFloat(l.quantity) || 0) : 0);
  }, 0);

  const handleSave = async () => {
    setError(null);
    for (const [i, l] of lines.entries()) {
      if (!l.raw_material_id) return setError(`Select a raw material for line ${i + 1}`);
      if (!(parseFloat(l.quantity) > 0)) return setError(`Enter a quantity greater than 0 for line ${i + 1}`);
    }
    try {
      setSaving(true);
      const res = await axios.put(`/api/financial/products/${product.id}/recipe`, {
        items: lines.map(l => ({ raw_material_id: l.raw_material_id, quantity: parseFloat(l.quantity) })),
      });
      if (res.data?.success) {
        onSaved?.(product.id, res.data.cost_price ?? null);
        onClose();
      }
      else setError(res.data?.error || 'Failed to save recipe');
    } catch (err: any) {
      setError(err.response?.data?.error || err.message || 'Failed to save recipe');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div
        className="bg-white rounded-2xl shadow-lg w-full max-w-xl max-h-[90vh] flex flex-col"
        onClick={e => e.stopPropagation()}
      >
        <div className="px-5 py-4 border-b border-gray-100">
          <h2 className="text-sm font-bold text-gray-900">Recipe</h2>
          <p className="text-xs text-gray-500 mt-0.5">Raw materials used to make one {product.product_name}</p>
        </div>

        <div className="px-5 py-4 overflow-y-auto flex-1">
          {loading ? (
            <div className="py-10 text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-red-600 mx-auto"></div>
            </div>
          ) : (
            <>
              {lines.length === 0 ? (
                <p className="text-xs text-gray-400 text-center py-6">No raw materials assigned yet.</p>
              ) : (
                <div className="space-y-2">
                  <div className="grid grid-cols-[1fr_110px_70px_28px] gap-2 text-[10px] font-semibold text-gray-500 uppercase tracking-wider px-0.5">
                    <span>Raw Material</span>
                    <span>Quantity</span>
                    <span>Unit</span>
                    <span></span>
                  </div>
                  {lines.map((l, i) => {
                    const m = l.raw_material_id ? materialById.get(l.raw_material_id) : undefined;
                    return (
                      <div key={i} className="grid grid-cols-[1fr_110px_70px_28px] gap-2 items-center">
                        <select
                          className={inputClass}
                          value={l.raw_material_id}
                          onChange={e => updateLine(i, { raw_material_id: e.target.value ? Number(e.target.value) : '' })}
                        >
                          <option value="">Select raw material</option>
                          {materials.map(mat => (
                            <option key={mat.id} value={mat.id} disabled={usedElsewhere(i, mat.id)}>
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
                          onChange={e => updateLine(i, { quantity: e.target.value })}
                        />
                        <span className="text-xs text-gray-600">{m?.unit || '—'}</span>
                        <button
                          type="button"
                          onClick={() => removeLine(i)}
                          className="text-gray-400 hover:text-red-600 text-base leading-none"
                          title="Remove"
                        >
                          ×
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}

              <button
                type="button"
                onClick={addLine}
                disabled={materials.length === 0}
                className="mt-3 px-3 py-1.5 rounded-md text-xs font-medium text-white bg-blue-600 hover:bg-blue-700 shadow-sm disabled:opacity-50"
              >
                Add raw material
              </button>
              {materials.length === 0 && (
                <p className="text-[11px] text-gray-400 mt-2">No active raw materials found. Add some on the Raw Materials page first.</p>
              )}

              {lines.length > 0 && (
                <div className="mt-4 flex justify-between items-baseline rounded-xl bg-gray-50 border border-gray-100 px-3 py-2">
                  <span className="text-xs text-gray-600">Product cost (total of recipe)</span>
                  <span className="text-sm font-bold text-gray-900">{money(estimatedCost)}</span>
                </div>
              )}
            </>
          )}

          {error && <div className="mt-3 bg-red-50 border border-red-200 rounded-lg px-3 py-2 text-xs text-red-700">{error}</div>}
        </div>

        <div className="px-5 py-3 border-t border-gray-100 flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="px-3 py-1.5 rounded-md text-xs font-medium bg-gray-100 text-gray-700 hover:bg-gray-200"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={saving || loading}
            className="px-3 py-1.5 rounded-md text-xs font-medium text-white bg-red-600 hover:bg-red-700 disabled:opacity-50"
          >
            {saving ? 'Saving...' : 'Save Recipe'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ProductRecipeModal;
