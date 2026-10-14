import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { ArrowLeft, User, AlertCircle, CheckCircle, Plus, X } from 'lucide-react';
import { api } from '../services/api';

interface LedgerRow {
  id: number;
  date: string;
  description: string;
  reference_type: string;
  payment_method: string | null;
  reference: string | null;
  debit: number | string;
  credit: number | string;
  running_balance: number | string;
  created_by_name: string | null;
}

interface Details {
  rep: {
    id: number;
    name: string;
    email?: string;
    phone?: string;
    country?: string;
    region?: string;
    route_name_update?: string;
    status?: string;
    balance: number | string;
  };
  total_allocated: number;
  total_spent: number;
  ledger: LedgerRow[];
}

const METHOD_LABELS: Record<string, string> = {
  cash: 'Cash',
  bank_transfer: 'Bank Transfer',
  mpesa: 'M-Pesa',
  cheque: 'Cheque',
  other: 'Other',
};

const formatKES = (n: number | string | null | undefined) =>
  Number(n || 0).toLocaleString('en-US', { style: 'currency', currency: 'KES' });

const formatDate = (d: string) => (d ? new Date(d).toLocaleDateString('en-GB') : '-');

const PettyCashStaffDetailsPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const [data, setData] = useState<Details | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showAllocate, setShowAllocate] = useState(false);
  const [success, setSuccess] = useState<string | null>(null);

  // showSpinner=false refreshes in place after an allocation, without unmounting the page
  const load = (showSpinner = true) => {
    if (showSpinner) setLoading(true);
    return api
      .get(`/financial/petty-cash/sales-reps/${id}`)
      .then(res => setData(res.data.data))
      .catch(err => setError(err.response?.data?.error || err.message || 'Failed to load details'))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-red-600" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="w-full px-4 py-4">
        <Link to="/petty-cash/balances" className="flex items-center gap-1.5 text-red-600 text-xs mb-3">
          <ArrowLeft className="h-3.5 w-3.5" /> Back to staff balances
        </Link>
        <div className="p-2.5 bg-red-50 border border-red-200 rounded-md flex items-center gap-1.5 text-xs text-red-700">
          <AlertCircle className="h-4 w-4" /> {error || 'Staff not found'}
        </div>
      </div>
    );
  }

  const { rep, ledger } = data;
  const details = [
    ['Email', rep.email],
    ['Phone', rep.phone],
    ['Country', rep.country],
    ['Region', rep.region],
    ['Route', rep.route_name_update],
  ].filter(([, v]) => v);

  return (
    <div className="w-full px-4 py-4">
      <Link to="/petty-cash/balances" className="flex items-center gap-1.5 text-red-600 hover:text-red-700 text-xs font-medium mb-3">
        <ArrowLeft className="h-3.5 w-3.5" /> Back to staff balances
      </Link>

      <div className="bg-white border border-gray-200 rounded-md p-3 mb-3">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
          <div className="flex items-start gap-3">
            <div className="h-10 w-10 rounded-md bg-red-50 flex items-center justify-center">
              <User className="h-5 w-5 text-red-600" />
            </div>
            <div>
              <h1 className="text-sm font-bold text-gray-900">{rep.name}</h1>
              <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-[10px] text-gray-600 mt-0.5">
                <span
                  className={`px-2 py-0.5 rounded-full text-[9px] font-medium ${
                    rep.status === 'inactive' ? 'bg-gray-100 text-gray-600' : 'bg-green-100 text-green-700'
                  }`}
                >
                  {rep.status || 'active'}
                </span>
                {details.map(([label, value]) => (
                  <span key={label as string}>{label}: {value}</span>
                ))}
              </div>
            </div>
          </div>
          <button
            onClick={() => {
              setSuccess(null);
              setShowAllocate(true);
            }}
            className="px-3 py-1.5 rounded-md text-xs font-medium bg-red-600 text-white hover:bg-red-700 self-start lg:self-center flex items-center gap-1.5"
          >
            <Plus className="h-3.5 w-3.5" />
            Allocate Petty Cash
          </button>
        </div>
      </div>

      {success && (
        <div className="mb-3 p-2.5 bg-green-50 border border-green-200 rounded-md flex items-center gap-1.5 text-xs text-green-700">
          <CheckCircle className="h-4 w-4" /> {success}
        </div>
      )}

      <div className="mb-3 max-w-xs">
        <div className="bg-white border border-gray-200 rounded-md p-3">
          <p className="text-[10px] text-gray-500">Current Balance</p>
          <p className="text-sm font-bold text-red-600">{formatKES(rep.balance)}</p>
        </div>
      </div>

      <div className="bg-white border border-gray-200 rounded-md overflow-hidden">
        <div className="px-3 py-2 border-b border-gray-200">
          <h3 className="text-xs font-semibold text-gray-900">Ledger ({ledger.length})</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                {['Date', 'Description', 'Method', 'Reference', 'Debit', 'Credit', 'Balance'].map(h => (
                  <th
                    key={h}
                    className={`px-3 py-2 text-[9px] font-semibold text-gray-500 uppercase tracking-wider ${
                      ['Debit', 'Credit', 'Balance'].includes(h) ? 'text-right' : 'text-left'
                    }`}
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {ledger.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-3 py-3 text-center text-xs text-gray-500">No ledger entries yet</td>
                </tr>
              ) : (
                ledger.map(l => (
                  <tr key={l.id} className="hover:bg-gray-50">
                    <td className="px-3 py-2 whitespace-nowrap text-xs text-gray-700">{formatDate(l.date)}</td>
                    <td className="px-3 py-2 text-xs text-gray-900">{l.description}</td>
                    <td className="px-3 py-2 whitespace-nowrap text-xs text-gray-700">
                      {l.payment_method ? METHOD_LABELS[l.payment_method] || l.payment_method : '-'}
                    </td>
                    <td className="px-3 py-2 whitespace-nowrap text-xs text-gray-700">{l.reference || '-'}</td>
                    <td className="px-3 py-2 whitespace-nowrap text-right text-xs text-red-600">
                      {Number(l.debit) > 0 ? formatKES(l.debit) : '-'}
                    </td>
                    <td className="px-3 py-2 whitespace-nowrap text-right text-xs text-green-600">
                      {Number(l.credit) > 0 ? formatKES(l.credit) : '-'}
                    </td>
                    <td className="px-3 py-2 whitespace-nowrap text-right text-xs font-semibold text-gray-900">
                      {formatKES(l.running_balance)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {showAllocate && (
        <AllocateModal
          rep={rep}
          onClose={() => setShowAllocate(false)}
          onSuccess={message => {
            setShowAllocate(false);
            setSuccess(message);
            load(false);
          }}
        />
      )}
    </div>
  );
};

const METHOD_OPTIONS = Object.entries(METHOD_LABELS);

// Allocates petty cash straight to the staff member whose page is open
const AllocateModal: React.FC<{
  rep: Details['rep'];
  onClose: () => void;
  onSuccess: (message: string) => void;
}> = ({ rep, onClose, onSuccess }) => {
  const [amount, setAmount] = useState('');
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [method, setMethod] = useState('cash');
  const [reference, setReference] = useState('');
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const amountNum = Number(amount);
  const canSubmit = amountNum > 0 && !!date && !!method && !submitting;
  const inputCls =
    'w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:ring-1 focus:ring-red-500 focus:border-transparent';
  const labelCls = 'block text-xs font-medium text-gray-700 mb-1';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;
    setSubmitting(true);
    setError(null);
    try {
      const res = await api.post('/financial/petty-cash/allocations', {
        sales_rep_id: rep.id,
        amount: amountNum,
        allocation_date: date,
        payment_method: method,
        reference: reference.trim(),
        notes: notes.trim(),
      });
      onSuccess(`${formatKES(amountNum)} allocated to ${rep.name}. New balance: ${formatKES(res.data.data?.balance)}`);
    } catch (err: any) {
      setError(err.response?.data?.error || err.message || 'Failed to allocate petty cash');
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 backdrop-blur-sm p-4">
      <form
        onSubmit={handleSubmit}
        className="bg-white rounded-lg shadow-2xl w-full max-w-3xl max-h-[92vh] flex flex-col overflow-hidden"
      >
        <div className="bg-gradient-to-r from-red-600 to-red-700 px-6 py-4 text-white flex items-center justify-between">
          <div>
            <h2 className="text-base font-bold">Allocate Petty Cash</h2>
            <p className="text-xs text-red-100">to {rep.name}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            className="p-1.5 rounded-full hover:bg-white hover:bg-opacity-20 transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-md flex items-center gap-2 text-sm text-red-700">
              <AlertCircle className="h-4 w-4" /> {error}
            </div>
          )}
          <div className="grid grid-cols-1 md:grid-cols-5 gap-6">
            <div className="md:col-span-3 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className={labelCls}>Amount (KES) *</label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={amount}
                    onChange={e => setAmount(e.target.value)}
                    placeholder="0.00"
                    className={inputCls}
                    disabled={submitting}
                    autoFocus
                  />
                </div>
                <div>
                  <label className={labelCls}>Date *</label>
                  <input
                    type="date"
                    value={date}
                    onChange={e => setDate(e.target.value)}
                    className={inputCls}
                    disabled={submitting}
                  />
                </div>
                <div>
                  <label className={labelCls}>Method *</label>
                  <select value={method} onChange={e => setMethod(e.target.value)} className={inputCls} disabled={submitting}>
                    {METHOD_OPTIONS.map(([value, label]) => (
                      <option key={value} value={value}>{label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className={labelCls}>Reference</label>
                  <input
                    type="text"
                    value={reference}
                    onChange={e => setReference(e.target.value)}
                    placeholder="e.g. M-Pesa code / cheque no."
                    className={inputCls}
                    disabled={submitting}
                  />
                </div>
              </div>
              <div>
                <label className={labelCls}>Notes</label>
                <textarea
                  value={notes}
                  onChange={e => setNotes(e.target.value)}
                  rows={3}
                  placeholder="Optional"
                  className={inputCls}
                  disabled={submitting}
                />
              </div>
            </div>

            <div className="md:col-span-2">
              <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 h-full space-y-3">
                <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Summary</h3>
                <div>
                  <p className="text-xs text-gray-500">Staff</p>
                  <p className="text-sm font-semibold text-gray-900">{rep.name}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500">Current balance</p>
                  <p className="text-lg font-bold text-gray-900">{formatKES(rep.balance)}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500">Amount to allocate</p>
                  <p className="text-lg font-bold text-green-600">+ {formatKES(amountNum > 0 ? amountNum : 0)}</p>
                </div>
                <div className="pt-3 border-t border-gray-300">
                  <p className="text-xs text-gray-500">New balance</p>
                  <p className="text-xl font-bold text-red-600">
                    {formatKES(Number(rep.balance || 0) + (amountNum > 0 ? amountNum : 0))}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-gray-50 border-t border-gray-200 px-6 py-3 flex justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            className="px-5 py-2 rounded-md text-sm font-medium bg-gray-200 text-gray-700 hover:bg-gray-300"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={!canSubmit}
            className={`px-5 py-2 rounded-md text-sm font-medium ${
              canSubmit ? 'bg-red-600 text-white hover:bg-red-700' : 'bg-gray-300 text-gray-500 cursor-not-allowed'
            }`}
          >
            {submitting ? 'Allocating...' : 'Allocate Petty Cash'}
          </button>
        </div>
      </form>
    </div>
  );
};

export default PettyCashStaffDetailsPage;
