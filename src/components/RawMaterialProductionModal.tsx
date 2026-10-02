import React, { useState } from 'react';
import axios from 'axios';

interface Props {
  request: {
    id: number;
    request_number: string;
    store_name?: string;
    products: { id: number; product_id: number; product_name?: string; quantity: number | string }[];
    items: { id: number; raw_material_id: number; name?: string; unit?: string; quantity: number | string }[];
  };
  onClose: () => void;
  onDone: () => void;
}

const qty = (n: number) => Number(n || 0).toLocaleString(undefined, { maximumFractionDigits: 3 });
const round3 = (n: number) => Math.round(n * 1000) / 1000;

const RawMaterialProductionModal: React.FC<Props> = ({ request, onClose, onDone }) => {
  // Everything starts at the target / issued quantity, so only differences need typing
  const [produced, setProduced] = useState<Record<number, string>>(
    Object.fromEntries(request.products.map(p => [p.product_id, String(Number(p.quantity))]))
  );
  const [used, setUsed] = useState<Record<number, string>>(
    Object.fromEntries(request.items.map(i => [i.raw_material_id, String(Number(i.quantity))]))
  );
  const [note, setNote] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const usedNumber = (rawId: number) => parseFloat(used[rawId]);
  const returnedFor = (rawId: number, issued: number) => {
    const u = usedNumber(rawId);
    return Number.isFinite(u) ? round3(Math.max(0, issued - u)) : 0;
  };

  const totalReturned = request.items.filter(i => returnedFor(i.raw_material_id, Number(i.quantity)) > 0).length;

  const validate = (): string | null => {
    for (const p of request.products) {
      const v = parseFloat(produced[p.product_id]);
      if (!Number.isFinite(v) || v < 0) return `Enter the quantity produced for ${p.product_name || 'every product'} (0 or more)`;
    }
    for (const i of request.items) {
      const v = usedNumber(i.raw_material_id);
      if (!Number.isFinite(v) || v < 0) return `Enter the quantity used for ${i.name || 'every raw material'} (0 or more)`;
      if (v > Number(i.quantity)) return `${i.name}: the quantity used cannot be more than the ${qty(Number(i.quantity))} issued`;
    }
    return null;
  };

  const submit = async () => {
    const problem = validate();
    if (problem) {
      setError(problem);
      return;
    }
    setError(null);
    try {
      setSubmitting(true);
      const res = await axios.post(`/api/financial/raw-material-requests/${request.id}/complete`, {
        products: request.products.map(p => ({ product_id: p.product_id, produced_quantity: parseFloat(produced[p.product_id]) })),
        items: request.items.map(i => ({ raw_material_id: i.raw_material_id, used_quantity: parseFloat(used[i.raw_material_id]) })),
        note,
      });
      if (res.data?.success) onDone();
      else setError(res.data?.error || 'Failed to confirm production');
    } catch (err: any) {
      setError(err.response?.data?.error || err.message || 'Failed to confirm production');
    } finally {
      setSubmitting(false);
    }
  };

  const th = 'px-3 py-2 text-[10px] font-semibold text-gray-500 uppercase tracking-wider';
  const numInput =
    'w-24 border border-gray-200 rounded-lg px-2 py-1 text-xs text-right bg-white focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-red-500';

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[60] p-4" onClick={submitting ? undefined : onClose}>
      <div className="bg-white rounded-2xl shadow-lg w-full max-w-2xl max-h-[90vh] flex flex-col" onClick={e => e.stopPropagation()}>
        <div className="px-5 py-4 border-b border-gray-100">
          <h2 className="text-sm font-bold text-gray-900">Confirm production {request.request_number}</h2>
          <p className="text-xs text-gray-500 mt-0.5">
            Enter what was produced and how much of each raw material was used. The products produced are added to stock, and any raw
            material that was not used goes back into stock{request.store_name ? ` in ${request.store_name}` : ''}.
          </p>
        </div>

        <div className="px-5 py-4 overflow-y-auto space-y-5">
          <div>
            <h3 className="text-xs font-bold text-gray-900 mb-2">Quantity produced</h3>
            <div className="border border-gray-100 rounded-xl overflow-hidden">
              <table className="min-w-full divide-y divide-gray-100">
                <thead className="bg-gray-50">
                  <tr>
                    <th className={`${th} text-left`}>Product</th>
                    <th className={`${th} text-right`}>Target</th>
                    <th className={`${th} text-right`}>Produced</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {request.products.map(p => (
                    <tr key={p.id}>
                      <td className="px-3 py-2 text-xs font-semibold text-gray-900">{p.product_name || `Product ${p.product_id}`}</td>
                      <td className="px-3 py-2 text-right text-xs text-gray-600">{qty(Number(p.quantity))}</td>
                      <td className="px-3 py-2 text-right">
                        <input
                          type="number"
                          min="0"
                          step="1"
                          className={numInput}
                          value={produced[p.product_id] ?? ''}
                          onChange={e => setProduced(prev => ({ ...prev, [p.product_id]: e.target.value }))}
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div>
            <h3 className="text-xs font-bold text-gray-900 mb-2">Raw materials used</h3>
            <div className="border border-gray-100 rounded-xl overflow-hidden">
              <table className="min-w-full divide-y divide-gray-100">
                <thead className="bg-gray-50">
                  <tr>
                    <th className={`${th} text-left`}>Raw material</th>
                    <th className={`${th} text-right`}>Issued</th>
                    <th className={`${th} text-right`}>Used</th>
                    <th className={`${th} text-right`}>Return to stock</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {request.items.map(i => {
                    const issued = Number(i.quantity);
                    const over = usedNumber(i.raw_material_id) > issued;
                    const returned = returnedFor(i.raw_material_id, issued);
                    return (
                      <tr key={i.id}>
                        <td className="px-3 py-2 text-xs font-semibold text-gray-900">{i.name}</td>
                        <td className="px-3 py-2 text-right text-xs text-gray-600">
                          {qty(issued)} <span className="text-gray-400">{i.unit}</span>
                        </td>
                        <td className="px-3 py-2 text-right">
                          <input
                            type="number"
                            min="0"
                            step="0.001"
                            className={`${numInput} ${over ? 'border-red-400' : ''}`}
                            value={used[i.raw_material_id] ?? ''}
                            onChange={e => setUsed(prev => ({ ...prev, [i.raw_material_id]: e.target.value }))}
                          />
                        </td>
                        <td className="px-3 py-2 text-right">
                          {over ? (
                            <span className="text-[11px] text-red-600">More than issued</span>
                          ) : returned > 0 ? (
                            <span className="inline-flex px-2 py-0.5 rounded-full text-[11px] font-semibold bg-blue-100 text-blue-700">
                              {qty(returned)} {i.unit}
                            </span>
                          ) : (
                            <span className="text-xs text-gray-300">—</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            {totalReturned > 0 && (
              <p className="text-[11px] text-blue-700 mt-2">
                {totalReturned} raw material{totalReturned === 1 ? '' : 's'} will be returned to stock.
              </p>
            )}
          </div>

          <div>
            <label className="block text-[11px] font-semibold text-gray-500 uppercase tracking-wider mb-1">Note (optional)</label>
            <textarea
              rows={2}
              className="block w-full border border-gray-200 rounded-lg px-2.5 py-1.5 text-xs bg-white focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-red-500"
              value={note}
              onChange={e => setNote(e.target.value)}
            />
          </div>

          {error && <div className="bg-red-50 border border-red-200 rounded-lg px-3 py-2 text-xs text-red-700">{error}</div>}
        </div>

        <div className="px-5 py-3 border-t border-gray-100 flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            className="px-3 py-1.5 rounded-md text-xs font-medium bg-gray-100 text-gray-700 hover:bg-gray-200 disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={submit}
            disabled={submitting}
            className="px-3 py-1.5 rounded-md text-xs font-medium text-white bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50"
          >
            {submitting ? 'Confirming...' : 'Confirm production'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default RawMaterialProductionModal;
