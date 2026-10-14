import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { PiggyBank, AlertCircle, CheckCircle, Plus, X } from 'lucide-react';
import { api } from '../services/api';

interface SalesRepOption {
  id: number;
  name: string;
  status?: string;
  balance: number | string;
}

interface Allocation {
  id: number;
  sales_rep_id: number;
  sales_rep_name: string;
  amount: number | string;
  allocation_date: string;
  payment_method: string;
  reference: string | null;
  notes: string | null;
  running_balance: number | string | null;
  created_by: number | null;
  created_by_name: string | null;
}

const METHODS = [
  { value: 'cash', label: 'Cash' },
  { value: 'bank_transfer', label: 'Bank Transfer' },
  { value: 'mpesa', label: 'M-Pesa' },
  { value: 'cheque', label: 'Cheque' },
  { value: 'other', label: 'Other' },
];

const formatKES = (n: number | string | null | undefined) =>
  Number(n || 0).toLocaleString('en-US', { style: 'currency', currency: 'KES' });

const formatDate = (d: string) => (d ? new Date(d).toLocaleDateString('en-GB') : '-');

const todayStr = () => new Date().toISOString().slice(0, 10);

const PettyCashAllocationPage: React.FC = () => {
  const [reps, setReps] = useState<SalesRepOption[]>([]);
  const [allocations, setAllocations] = useState<Allocation[]>([]);
  const [salesRepId, setSalesRepId] = useState('');
  const [amount, setAmount] = useState('');
  const [date, setDate] = useState(todayStr());
  const [method, setMethod] = useState('cash');
  const [reference, setReference] = useState('');
  const [notes, setNotes] = useState('');
  const [repSearch, setRepSearch] = useState('');
  const [repOpen, setRepOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [modalError, setModalError] = useState<string | null>(null);

  const load = async () => {
    try {
      const [repsRes, allocRes] = await Promise.all([
        api.get('/financial/petty-cash/sales-reps'),
        api.get('/financial/petty-cash/allocations'),
      ]);
      setReps(repsRes.data.data || []);
      setAllocations(allocRes.data.data || []);
    } catch (err: any) {
      setError(err.response?.data?.error || err.message || 'Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const selectedRep = useMemo(() => reps.find(r => String(r.id) === salesRepId), [reps, salesRepId]);
  const visibleReps = useMemo(
    () => reps.filter(r => r.name?.toLowerCase().includes(repSearch.toLowerCase())),
    [reps, repSearch]
  );
  const amountNum = Number(amount);
  const canSubmit = !!salesRepId && amountNum > 0 && !!date && !!method && !submitting;

  const openModal = () => {
    setSalesRepId('');
    setRepSearch('');
    setRepOpen(false);
    setAmount('');
    setDate(todayStr());
    setMethod('cash');
    setReference('');
    setNotes('');
    setModalError(null);
    setSuccess(null);
    setShowModal(true);
  };

  const closeModal = () => {
    if (!submitting) setShowModal(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;
    setSubmitting(true);
    setModalError(null);
    setSuccess(null);
    try {
      const res = await api.post('/financial/petty-cash/allocations', {
        sales_rep_id: Number(salesRepId),
        amount: amountNum,
        allocation_date: date,
        payment_method: method,
        reference: reference.trim(),
        notes: notes.trim(),
      });
      setSuccess(
        `${formatKES(amountNum)} allocated to ${selectedRep?.name}. New balance: ${formatKES(res.data.data?.balance)}`
      );
      setShowModal(false);
      await load();
    } catch (err: any) {
      setModalError(err.response?.data?.error || err.message || 'Failed to allocate petty cash');
    } finally {
      setSubmitting(false);
    }
  };

  const inputCls =
    'w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:ring-1 focus:ring-red-500 focus:border-transparent';
  const labelCls = 'block text-xs font-medium text-gray-700 mb-1';

  return (
    <div className="w-full px-4 py-4">
      <div className="bg-white border border-gray-200 rounded-md p-3 mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="h-8 w-8 rounded-md bg-red-50 flex items-center justify-center">
            <PiggyBank className="h-4 w-4 text-red-600" />
          </div>
          <div>
            <h1 className="text-sm font-bold text-gray-900">Petty Cash Allocation</h1>
            <p className="text-[10px] text-gray-500">Allocate petty cash to sales reps</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Link
            to="/petty-cash/balances"
            className="px-3 py-1.5 rounded-md text-xs font-medium bg-white text-gray-700 border border-gray-300 hover:bg-gray-50"
          >
            Staff Balances
          </Link>
          <button
            onClick={openModal}
            className="px-3 py-1.5 rounded-md text-xs font-medium bg-red-600 text-white hover:bg-red-700 flex items-center gap-1.5"
          >
            <Plus className="h-3.5 w-3.5" />
            Add Allocation
          </button>
        </div>
      </div>

      {error && (
        <div className="mb-3 p-2.5 bg-red-50 border border-red-200 rounded-md flex items-center gap-1.5 text-xs text-red-700">
          <AlertCircle className="h-4 w-4" /> {error}
        </div>
      )}
      {success && (
        <div className="mb-3 p-2.5 bg-green-50 border border-green-200 rounded-md flex items-center gap-1.5 text-xs text-green-700">
          <CheckCircle className="h-4 w-4" /> {success}
        </div>
      )}

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 backdrop-blur-sm p-4">
          <form
            onSubmit={handleSubmit}
            className="bg-white rounded-lg shadow-2xl w-full max-w-4xl max-h-[92vh] flex flex-col overflow-hidden"
          >
            {/* Header */}
            <div className="bg-gradient-to-r from-red-600 to-red-700 px-6 py-4 text-white flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-lg bg-white bg-opacity-20 flex items-center justify-center">
                  <PiggyBank className="h-5 w-5" />
                </div>
                <div>
                  <h2 className="text-base font-bold">Add Petty Cash Allocation</h2>
                  <p className="text-xs text-red-100">Allocate petty cash to a staff member</p>
                </div>
              </div>
              <button
                type="button"
                onClick={closeModal}
                disabled={submitting}
                className="p-1.5 rounded-full hover:bg-white hover:bg-opacity-20 transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Body */}
            <div className="flex-1 overflow-y-auto p-6">
              {modalError && (
                <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-md flex items-center gap-2 text-sm text-red-700">
                  <AlertCircle className="h-4 w-4" /> {modalError}
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-5 gap-6">
                {/* Form fields */}
                <div className="md:col-span-3 space-y-4">
                  <div className="relative">
                    <label className={labelCls}>Staff (Sales Rep) *</label>
                    <input
                      type="text"
                      value={repOpen ? repSearch : selectedRep?.name || ''}
                      onChange={e => {
                        setRepSearch(e.target.value);
                        setRepOpen(true);
                      }}
                      onFocus={() => {
                        setRepSearch('');
                        setRepOpen(true);
                      }}
                      onBlur={() => setRepOpen(false)}
                      onKeyDown={e => {
                        if (e.key === 'Escape') setRepOpen(false);
                        if (e.key === 'Enter' && repOpen) {
                          e.preventDefault();
                          if (visibleReps[0]) {
                            setSalesRepId(String(visibleReps[0].id));
                            setRepOpen(false);
                          }
                        }
                      }}
                      placeholder={loading ? 'Loading staff...' : 'Search and select staff'}
                      className={inputCls}
                      disabled={loading || submitting}
                      autoComplete="off"
                    />
                    {repOpen && (
                      <ul className="absolute z-10 mt-1 w-full max-h-56 overflow-y-auto bg-white border border-gray-300 rounded-md shadow-lg">
                        {visibleReps.length === 0 ? (
                          <li className="px-3 py-2 text-sm text-gray-500">No staff found</li>
                        ) : (
                          visibleReps.map(r => (
                            <li
                              key={r.id}
                              // mousedown fires before the input's blur, so the selection isn't lost
                              onMouseDown={e => {
                                e.preventDefault();
                                setSalesRepId(String(r.id));
                                setRepOpen(false);
                              }}
                              className={`px-3 py-2 text-sm cursor-pointer flex items-center justify-between hover:bg-red-50 ${
                                String(r.id) === salesRepId ? 'bg-red-50 font-medium' : ''
                              }`}
                            >
                              <span className="text-gray-900">
                                {r.name}
                                {r.status === 'inactive' && <span className="ml-1.5 text-xs text-gray-400">(inactive)</span>}
                              </span>
                              <span className="text-xs text-gray-500">{formatKES(r.balance)}</span>
                            </li>
                          ))
                        )}
                      </ul>
                    )}
                  </div>

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
                      <select
                        value={method}
                        onChange={e => setMethod(e.target.value)}
                        className={inputCls}
                        disabled={submitting}
                      >
                        {METHODS.map(m => (
                          <option key={m.value} value={m.value}>{m.label}</option>
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

                {/* Summary panel */}
                <div className="md:col-span-2">
                  <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 h-full">
                    <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">Summary</h3>
                    {selectedRep ? (
                      <div className="space-y-3">
                        <div>
                          <p className="text-xs text-gray-500">Staff</p>
                          <p className="text-sm font-semibold text-gray-900">{selectedRep.name}</p>
                        </div>
                        <div>
                          <p className="text-xs text-gray-500">Current balance</p>
                          <p className="text-lg font-bold text-gray-900">{formatKES(selectedRep.balance)}</p>
                        </div>
                        <div>
                          <p className="text-xs text-gray-500">Amount to allocate</p>
                          <p className="text-lg font-bold text-green-600">+ {formatKES(amountNum > 0 ? amountNum : 0)}</p>
                        </div>
                        <div className="pt-3 border-t border-gray-300">
                          <p className="text-xs text-gray-500">New balance</p>
                          <p className="text-xl font-bold text-red-600">
                            {formatKES(Number(selectedRep.balance || 0) + (amountNum > 0 ? amountNum : 0))}
                          </p>
                        </div>
                      </div>
                    ) : (
                      <p className="text-sm text-gray-500">Select a staff member to see their balance.</p>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="bg-gray-50 border-t border-gray-200 px-6 py-3 flex justify-end gap-3">
              <button
                type="button"
                onClick={closeModal}
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
      )}

      <div className="bg-white border border-gray-200 rounded-md overflow-hidden">
        <div className="px-3 py-2 border-b border-gray-200">
          <h3 className="text-xs font-semibold text-gray-900">Recent Allocations ({allocations.length})</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                {['Date', 'Sales Rep', 'Method', 'Reference', 'Notes', 'Posted By', 'Amount', 'Balance After'].map(h => (
                  <th
                    key={h}
                    className={`px-3 py-2 text-[9px] font-semibold text-gray-500 uppercase tracking-wider ${
                      h === 'Amount' || h === 'Balance After' ? 'text-right' : 'text-left'
                    }`}
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {allocations.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-3 py-3 text-center text-xs text-gray-500">
                    {loading ? 'Loading...' : 'No allocations yet'}
                  </td>
                </tr>
              ) : (
                allocations.map(a => (
                  <tr key={a.id} className="hover:bg-gray-50">
                    <td className="px-3 py-2 whitespace-nowrap text-xs text-gray-700">{formatDate(a.allocation_date)}</td>
                    <td className="px-3 py-2 whitespace-nowrap text-xs font-medium text-gray-900">{a.sales_rep_name || `Rep ${a.sales_rep_id}`}</td>
                    <td className="px-3 py-2 whitespace-nowrap text-xs text-gray-700">
                      {METHODS.find(m => m.value === a.payment_method)?.label || a.payment_method}
                    </td>
                    <td className="px-3 py-2 whitespace-nowrap text-xs text-gray-700">{a.reference || '-'}</td>
                    <td className="px-3 py-2 text-xs text-gray-700 max-w-[200px] truncate">{a.notes || '-'}</td>
                    <td className="px-3 py-2 whitespace-nowrap text-xs text-gray-700">
                      {a.created_by_name || (a.created_by ? `User #${a.created_by}` : '-')}
                    </td>
                    <td className="px-3 py-2 whitespace-nowrap text-right text-xs font-bold text-green-600">{formatKES(a.amount)}</td>
                    <td className="px-3 py-2 whitespace-nowrap text-right text-xs text-gray-900">
                      {a.running_balance != null ? formatKES(a.running_balance) : '-'}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default PettyCashAllocationPage;
