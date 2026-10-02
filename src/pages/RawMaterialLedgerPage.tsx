import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { useSearchParams } from 'react-router-dom';
import { BookOpen } from 'lucide-react';

interface LedgerEntry {
  id: number;
  raw_material_id: number;
  name?: string;
  unit?: string;
  transaction_date: string;
  type: 'in' | 'out';
  quantity: number;
  reference?: string | null;
  notes?: string | null;
  balance: number;
}

interface SummaryRow {
  id: number;
  name: string;
  unit: string;
  alert_qty: number;
  is_active: number;
  balance: number;
}

const inputClass =
  'w-full border border-gray-300 rounded px-3 py-2 text-xs focus:ring-2 focus:ring-red-500 focus:border-red-500 bg-white';


const RawMaterialLedgerPage: React.FC = () => {
  const [entries, setEntries] = useState<LedgerEntry[]>([]);
  const [summary, setSummary] = useState<SummaryRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [searchParams] = useSearchParams();
  const initialMaterial = searchParams.get('material') || '';
  const [materialFilter, setMaterialFilter] = useState(initialMaterial);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');


  const errMsg = (err: any, fallback: string) => err.response?.data?.error || err.message || fallback;

  const fetchLedger = async () => {
    setLoading(true);
    setError(null);
    try {
      const params: Record<string, string> = {};
      if (materialFilter) params.raw_material_id = materialFilter;
      if (startDate) params.start_date = startDate;
      if (endDate) params.end_date = endDate;
      const res = await axios.get('/api/financial/raw-materials/ledger', { params });
      if (res.data?.success) {
        setEntries(res.data.data.entries || []);
        setSummary(res.data.data.summary || []);
      } else {
        setError(res.data?.error || 'Failed to load ledger');
      }
    } catch (err: any) {
      setError(errMsg(err, 'Failed to load ledger'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLedger();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [materialFilter, startDate, endDate]);

  const fmt = (n: number) => Number(n).toLocaleString(undefined, { maximumFractionDigits: 2 });

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="w-full py-6 px-4 sm:px-6 lg:px-8">
        <div className="mb-6 flex items-center justify-between gap-3 flex-wrap">
          <div>
            <h1 className="text-xl font-bold text-gray-900">Raw Materials Ledger</h1>
            <p className="text-xs text-gray-600 mt-1">Stock in and out, with the running balance of each raw material.</p>
          </div>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-red-700 text-xs mb-4">{error}</div>
        )}

        {/* Filters */}
        <div className="flex flex-wrap gap-3 mb-3 items-end">
          <div>
            <label className="block text-[10px] font-medium text-gray-700 mb-1">Raw Material</label>
            <select className={inputClass} value={materialFilter} onChange={e => setMaterialFilter(e.target.value)}>
              <option value="">All</option>
              {summary.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-[10px] font-medium text-gray-700 mb-1">From</label>
            <input className={inputClass} type="date" value={startDate} onChange={e => setStartDate(e.target.value)} />
          </div>
          <div>
            <label className="block text-[10px] font-medium text-gray-700 mb-1">To</label>
            <input className={inputClass} type="date" value={endDate} onChange={e => setEndDate(e.target.value)} />
          </div>
        </div>

        {/* Ledger */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
          {loading ? (
            <div className="p-10 text-center">
              <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-red-600 mx-auto"></div>
              <p className="mt-3 text-sm text-gray-600">Loading ledger...</p>
            </div>
          ) : entries.length === 0 ? (
            <div className="p-10 text-center text-gray-500">
              <BookOpen className="h-10 w-10 mx-auto mb-2 opacity-40" />
              <p className="text-sm font-medium">No ledger entries found</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    {['Date', 'Raw Material', 'Reference', 'In', 'Out', 'Balance', 'Notes'].map((h, i) => (
                      <th key={i} className={`px-4 py-2 text-[10px] font-medium text-gray-500 uppercase tracking-wider ${i >= 3 && i <= 5 ? 'text-right' : 'text-left'}`}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {entries.map(en => (
                    <tr key={en.id} className="hover:bg-gray-50">
                      <td className="px-4 py-2 whitespace-nowrap text-xs text-gray-700">{en.transaction_date}</td>
                      <td className="px-4 py-2 whitespace-nowrap text-xs font-medium text-gray-900">
                        {en.name} <span className="text-gray-500 font-normal">({en.unit})</span>
                      </td>
                      <td className="px-4 py-2 whitespace-nowrap text-xs text-gray-700">{en.reference || '-'}</td>
                      <td className="px-4 py-2 text-right text-xs font-semibold text-green-700">{en.type === 'in' ? fmt(en.quantity) : ''}</td>
                      <td className="px-4 py-2 text-right text-xs font-semibold text-red-700">{en.type === 'out' ? fmt(en.quantity) : ''}</td>
                      <td className="px-4 py-2 text-right text-xs font-semibold text-gray-900">{fmt(en.balance)}</td>
                      <td className="px-4 py-2 text-xs text-gray-600">{en.notes || ''}</td>
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

export default RawMaterialLedgerPage;
