import React, { useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import { storeService } from '../services/storeService';

interface RequestItem {
  id: number;
  raw_material_id: number;
  name?: string;
  unit?: string;
  quantity: number | string;
}

interface Props {
  mode: 'approve' | 'decline';
  request: { id: number; request_number: string; items: RequestItem[] };
  onClose: () => void;
  onDone: () => void;
}

interface Shortage {
  name: string;
  unit?: string;
  requested: number;
  available: number;
}

const qty = (n: number | string) => Number(n || 0).toLocaleString(undefined, { maximumFractionDigits: 3 });

const RawMaterialRequestReviewModal: React.FC<Props> = ({ mode, request, onClose, onDone }) => {
  const [stores, setStores] = useState<{ id: number; store_name: string; store_code?: string }[]>([]);
  const [stockByMaterial, setStockByMaterial] = useState<Record<number, Record<string, number>>>({});
  const [storeId, setStoreId] = useState('');
  const [note, setNote] = useState('');
  const [loading, setLoading] = useState(mode === 'approve');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [shortages, setShortages] = useState<Shortage[]>([]);

  useEffect(() => {
    if (mode !== 'approve') return;
    const load = async () => {
      try {
        const [storesRes, invRes] = await Promise.all([
          storeService.getAllStores(),
          axios.get('/api/financial/raw-materials/inventory'),
        ]);
        if (storesRes.success) setStores(storesRes.data || []);
        const map: Record<number, Record<string, number>> = {};
        (invRes.data?.data?.materials || []).forEach((m: any) => {
          map[m.id] = m.by_store || {};
        });
        setStockByMaterial(map);
      } catch (err: any) {
        setError(err.response?.data?.error || err.message || 'Failed to load stock');
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [mode]);

  // Stock check for the chosen store
  const checks = useMemo(
    () =>
      request.items.map(i => {
        const available = storeId ? Number(stockByMaterial[i.raw_material_id]?.[storeId] || 0) : 0;
        const requested = Number(i.quantity);
        return { item: i, available, requested, enough: available >= requested };
      }),
    [request.items, stockByMaterial, storeId]
  );
  const allEnough = checks.length > 0 && checks.every(c => c.enough);

  const submit = async () => {
    setError(null);
    setShortages([]);
    if (mode === 'approve' && !storeId) {
      setError('Choose the store to issue the raw materials from');
      return;
    }
    try {
      setSubmitting(true);
      const url = `/api/financial/raw-material-requests/${request.id}/${mode}`;
      const res = await axios.post(url, mode === 'approve' ? { store_id: Number(storeId), note } : { note });
      if (res.data?.success) onDone();
      else setError(res.data?.error || `Failed to ${mode} request`);
    } catch (err: any) {
      setError(err.response?.data?.error || err.message || `Failed to ${mode} request`);
      setShortages(err.response?.data?.shortages || []);
    } finally {
      setSubmitting(false);
    }
  };

  const th = 'px-3 py-2 text-[10px] font-semibold text-gray-500 uppercase tracking-wider';
  const fieldClass =
    'block w-full border border-gray-200 rounded-lg px-2.5 py-1.5 text-xs bg-white focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-red-500';

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[60] p-4" onClick={submitting ? undefined : onClose}>
      <div className="bg-white rounded-2xl shadow-lg w-full max-w-xl max-h-[90vh] flex flex-col" onClick={e => e.stopPropagation()}>
        <div className="px-5 py-4 border-b border-gray-100">
          <h2 className="text-sm font-bold text-gray-900">
            {mode === 'approve' ? 'Approve request' : 'Decline request'} {request.request_number}
          </h2>
          <p className="text-xs text-gray-500 mt-0.5">
            {mode === 'approve'
              ? 'The raw materials are checked against the stock of the store you choose. If there is enough of everything, they are deducted from that store.'
              : 'The request will be marked as declined. No stock is changed.'}
          </p>
        </div>

        <div className="px-5 py-4 overflow-y-auto space-y-4">
          {mode === 'approve' && (
            <>
              <div>
                <label className="block text-[11px] font-semibold text-gray-500 uppercase tracking-wider mb-1">
                  Issue from store <span className="text-red-500">*</span>
                </label>
                <select className={fieldClass} value={storeId} onChange={e => setStoreId(e.target.value)} disabled={loading}>
                  <option value="">Select store...</option>
                  {stores.map(s => (
                    <option key={s.id} value={s.id}>
                      {s.store_name}
                      {s.store_code ? ` (${s.store_code})` : ''}
                    </option>
                  ))}
                </select>
              </div>

              {loading ? (
                <div className="py-6 text-center">
                  <div className="animate-spin rounded-full h-7 w-7 border-b-2 border-red-600 mx-auto"></div>
                </div>
              ) : (
                <div className="border border-gray-100 rounded-xl overflow-hidden">
                  <table className="min-w-full divide-y divide-gray-100">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className={`${th} text-left`}>Raw material</th>
                        <th className={`${th} text-right`}>Requested</th>
                        <th className={`${th} text-right`}>In stock</th>
                        <th className={`${th} text-left`}>Check</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {checks.map(c => (
                        <tr key={c.item.id}>
                          <td className="px-3 py-2 text-xs font-semibold text-gray-900">{c.item.name}</td>
                          <td className="px-3 py-2 text-right text-xs text-gray-900">
                            {qty(c.requested)} <span className="text-gray-400">{c.item.unit}</span>
                          </td>
                          <td className="px-3 py-2 text-right text-xs text-gray-700">{storeId ? qty(c.available) : '—'}</td>
                          <td className="px-3 py-2">
                            {!storeId ? (
                              <span className="text-[11px] text-gray-400">Choose a store</span>
                            ) : c.enough ? (
                              <span className="inline-flex px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-100 text-emerald-700">Enough</span>
                            ) : (
                              <span className="inline-flex px-2 py-0.5 rounded-full text-[10px] font-semibold bg-red-100 text-red-700">
                                Short by {qty(c.requested - c.available)}
                              </span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {storeId && !loading && !allEnough && (
                <div className="bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 text-xs text-amber-800">
                  There is not enough stock in this store for every raw material, so the request cannot be approved from it. Choose another
                  store, or receive more stock first.
                </div>
              )}
            </>
          )}

          <div>
            <label className="block text-[11px] font-semibold text-gray-500 uppercase tracking-wider mb-1">
              {mode === 'approve' ? 'Note (optional)' : 'Reason (optional)'}
            </label>
            <textarea rows={2} className={fieldClass} value={note} onChange={e => setNote(e.target.value)} />
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg px-3 py-2 text-xs text-red-700">
              {error}
              {shortages.length > 0 && (
                <ul className="mt-1 list-disc pl-4">
                  {shortages.map((s, i) => (
                    <li key={i}>
                      {s.name}: requested {qty(s.requested)}, available {qty(s.available)} {s.unit}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
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
          {mode === 'approve' ? (
            <button
              type="button"
              onClick={submit}
              disabled={submitting || loading || !storeId || !allEnough}
              className="px-3 py-1.5 rounded-md text-xs font-medium text-white bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50"
            >
              {submitting ? 'Approving...' : 'Approve and deduct stock'}
            </button>
          ) : (
            <button
              type="button"
              onClick={submit}
              disabled={submitting}
              className="px-3 py-1.5 rounded-md text-xs font-medium text-white bg-red-600 hover:bg-red-700 disabled:opacity-50"
            >
              {submitting ? 'Declining...' : 'Decline request'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default RawMaterialRequestReviewModal;
