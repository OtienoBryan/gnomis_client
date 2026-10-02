import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Pencil, Trash2, Plus, Search, X, AlertCircle, ArrowLeft, Percent, DollarSign } from 'lucide-react';
import { API_CONFIG } from '../config/api';

interface Account {
  id: number;
  account_code: string;
  account_name: string;
}

interface Deduction {
  id: number;
  name: string;
  code?: string | null;
  calculation_type: 'percentage' | 'fixed';
  rate?: number | null;
  amount?: number | null;
  cap_amount?: number | null;
  account_id: number;
  account_code?: string;
  account_name?: string;
  description?: string | null;
  is_active: boolean | number;
}

const API_BASE = API_CONFIG.getUrl('/payroll');

const emptyForm = {
  name: '',
  code: '',
  calculation_type: 'fixed' as 'percentage' | 'fixed',
  rate: '',
  amount: '',
  cap_amount: '',
  account_id: '',
  description: '',
  is_active: true,
};

const authHeaders = () => ({
  'Content-Type': 'application/json',
  Authorization: `Bearer ${localStorage.getItem('token')}`,
});

const PayrollDeductionsPage: React.FC = () => {
  const [deductions, setDeductions] = useState<Deduction[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');

  const [modalOpen, setModalOpen] = useState(false);
  const [editingDeduction, setEditingDeduction] = useState<Deduction | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const [showDeleteConfirm, setShowDeleteConfirm] = useState<number | null>(null);

  const fetchDeductions = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API_BASE}/deductions`, { headers: authHeaders() });
      const json = await res.json();
      if (json.success) {
        setDeductions(json.data || []);
      } else {
        setError(json.error || 'Failed to fetch deductions');
      }
    } catch (err: any) {
      setError(err.message || 'Failed to fetch deductions');
    }
    setLoading(false);
  };

  const fetchAccounts = async () => {
    try {
      const res = await fetch(`${API_BASE}/deductions/accounts`, { headers: authHeaders() });
      const json = await res.json();
      if (json.success) setAccounts(json.data || []);
    } catch {
      setAccounts([]);
    }
  };

  useEffect(() => {
    fetchDeductions();
    fetchAccounts();
  }, []);

  const openAddModal = () => {
    setEditingDeduction(null);
    setForm(emptyForm);
    setFormError(null);
    setModalOpen(true);
  };

  const openEditModal = (deduction: Deduction) => {
    setEditingDeduction(deduction);
    setForm({
      name: deduction.name,
      code: deduction.code || '',
      calculation_type: deduction.calculation_type,
      rate: deduction.rate != null ? String(deduction.rate) : '',
      amount: deduction.amount != null ? String(deduction.amount) : '',
      cap_amount: deduction.cap_amount != null ? String(deduction.cap_amount) : '',
      account_id: String(deduction.account_id),
      description: deduction.description || '',
      is_active: !!deduction.is_active,
    });
    setFormError(null);
    setModalOpen(true);
  };

  const closeModal = () => {
    setModalOpen(false);
    setEditingDeduction(null);
    setForm(emptyForm);
    setFormError(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim() || !form.account_id) {
      setFormError('Name and linked account are required');
      return;
    }
    setSubmitting(true);
    setFormError(null);
    try {
      const payload: any = {
        name: form.name.trim(),
        code: form.code.trim() || undefined,
        calculation_type: form.calculation_type,
        rate: form.calculation_type === 'percentage' ? Number(form.rate || 0) : undefined,
        amount: form.calculation_type === 'fixed' ? Number(form.amount || 0) : undefined,
        cap_amount: form.cap_amount ? Number(form.cap_amount) : undefined,
        account_id: Number(form.account_id),
        description: form.description.trim() || undefined,
        is_active: form.is_active,
      };

      const url = editingDeduction ? `${API_BASE}/deductions/${editingDeduction.id}` : `${API_BASE}/deductions`;
      const method = editingDeduction ? 'PUT' : 'POST';
      const res = await fetch(url, { method, headers: authHeaders(), body: JSON.stringify(payload) });
      const json = await res.json();
      if (!json.success) {
        setFormError(json.error || 'Failed to save deduction');
        setSubmitting(false);
        return;
      }
      closeModal();
      await fetchDeductions();
    } catch (err: any) {
      setFormError(err.message || 'Failed to save deduction');
    }
    setSubmitting(false);
  };

  const handleDelete = async (id: number) => {
    try {
      const res = await fetch(`${API_BASE}/deductions/${id}`, { method: 'DELETE', headers: authHeaders() });
      const json = await res.json();
      if (json.success) {
        setDeductions(deductions.filter(d => d.id !== id));
      } else {
        setError(json.error || 'Failed to delete deduction');
      }
    } catch (err: any) {
      setError(err.message || 'Failed to delete deduction');
    }
    setShowDeleteConfirm(null);
  };

  const filteredDeductions = deductions.filter(d =>
    d.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (d.code || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
    (d.account_name || '').toLowerCase().includes(searchTerm.toLowerCase())
  );

  const formatValue = (d: Deduction) => {
    if (d.calculation_type === 'percentage') {
      const base = `${Number(d.rate ?? 0).toLocaleString()}%`;
      return d.cap_amount ? `${base} (cap KES ${Number(d.cap_amount).toLocaleString()})` : base;
    }
    return `KES ${Number(d.amount ?? 0).toLocaleString()}`;
  };

  return (
    <div className="min-h-screen bg-gray-50 py-4 px-4">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="mb-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div>
              <Link to="/payroll-management" className="inline-flex items-center text-[10px] text-gray-500 hover:text-gray-700 mb-1.5">
                <ArrowLeft className="w-3 h-3 mr-1" />
                Back to Payroll Management
              </Link>
              <h1 className="text-sm font-bold text-gray-900 mb-1">Payroll Deductions</h1>
              <p className="text-xs text-gray-600">Manage statutory and other deductions (e.g. PAYE, NSSF, NHIF) and the liability account each one posts to</p>
            </div>
            <button
              onClick={openAddModal}
              className="inline-flex items-center px-2.5 py-1.5 border border-transparent text-xs font-medium rounded text-white bg-red-600 hover:bg-red-700 focus:outline-none focus:ring-1 focus:ring-offset-1 focus:ring-red-500 transition-colors duration-200"
            >
              <Plus className="w-3 h-3 mr-1.5" />
              Add Deduction
            </button>
          </div>
        </div>

        {/* Search */}
        <div className="mb-3">
          <div className="bg-white rounded-lg shadow-sm p-3">
            <div className="relative">
              <Search className="absolute left-2 top-1/2 transform -translate-y-1/2 text-gray-400 w-3 h-3" />
              <input
                type="text"
                placeholder="Search deductions..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-8 pr-3 py-1.5 text-xs border border-gray-300 rounded focus:ring-1 focus:ring-red-500 focus:border-transparent"
              />
            </div>
          </div>
        </div>

        {error && (
          <div className="mb-3 bg-red-50 border border-red-200 rounded-lg p-2.5">
            <div className="flex">
              <AlertCircle className="w-4 h-4 text-red-400 mr-2 mt-0.5" />
              <div>
                <h3 className="text-xs font-medium text-red-800">Error</h3>
                <div className="mt-0.5 text-xs text-red-700">{error}</div>
              </div>
            </div>
          </div>
        )}

        {/* Table */}
        <div className="bg-white rounded-lg shadow-sm overflow-hidden">
          {loading ? (
            <div className="p-4">
              <div className="animate-pulse space-y-3">
                <div className="h-3 bg-gray-200 rounded w-1/4"></div>
                <div className="space-y-2">
                  {[...Array(4)].map((_, i) => (
                    <div key={i} className="h-8 bg-gray-200 rounded"></div>
                  ))}
                </div>
              </div>
            </div>
          ) : filteredDeductions.length === 0 ? (
            <div className="text-center py-8">
              <div className="w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-3">
                <DollarSign className="w-6 h-6 text-gray-400" />
              </div>
              <h3 className="text-xs font-medium text-gray-900 mb-1.5">
                {searchTerm ? 'No deductions found' : 'No deductions yet'}
              </h3>
              <p className="text-xs text-gray-500 mb-4">
                {searchTerm ? 'Try adjusting your search terms' : 'Get started by adding your first payroll deduction'}
              </p>
              {!searchTerm && (
                <button
                  onClick={openAddModal}
                  className="inline-flex items-center px-3 py-1.5 border border-transparent text-xs font-medium rounded text-white bg-red-600 hover:bg-red-700"
                >
                  <Plus className="w-3 h-3 mr-1.5" />
                  Add Deduction
                </button>
              )}
            </div>
          ) : (
            <>
              <div className="px-3 py-2 border-b border-gray-200 bg-gray-50">
                <div className="grid grid-cols-12 gap-3 text-[9px] font-medium text-gray-500 uppercase tracking-wider">
                  <div className="col-span-3">Name</div>
                  <div className="col-span-2">Type</div>
                  <div className="col-span-2">Value</div>
                  <div className="col-span-3">Linked Account</div>
                  <div className="col-span-1">Status</div>
                  <div className="col-span-1 text-right">Actions</div>
                </div>
              </div>
              <div className="divide-y divide-gray-200">
                {filteredDeductions.map(d => (
                  <div key={d.id} className="px-3 py-2 hover:bg-gray-50 transition-colors">
                    <div className="grid grid-cols-12 gap-3 items-center">
                      <div className="col-span-3">
                        <div className="text-xs font-medium text-gray-900">{d.name}</div>
                        {d.code && <div className="text-[10px] text-gray-500">{d.code}</div>}
                      </div>
                      <div className="col-span-2">
                        <span className="inline-flex items-center gap-1 text-xs text-gray-600">
                          {d.calculation_type === 'percentage' ? <Percent className="w-3 h-3" /> : <DollarSign className="w-3 h-3" />}
                          {d.calculation_type === 'percentage' ? 'Percentage' : 'Fixed'}
                        </span>
                      </div>
                      <div className="col-span-2">
                        <span className="text-xs text-gray-900">{formatValue(d)}</span>
                      </div>
                      <div className="col-span-3">
                        <span className="text-xs text-gray-700">
                          {d.account_code} - {d.account_name}
                        </span>
                      </div>
                      <div className="col-span-1">
                        {d.is_active ? (
                          <span className="inline-flex px-1.5 py-0.5 text-[10px] font-medium rounded-full bg-green-100 text-green-800 border border-green-200">Active</span>
                        ) : (
                          <span className="inline-flex px-1.5 py-0.5 text-[10px] font-medium rounded-full bg-gray-100 text-gray-600 border border-gray-200">Inactive</span>
                        )}
                      </div>
                      <div className="col-span-1">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => openEditModal(d)}
                            className="p-0.5 text-gray-400 hover:text-red-600 transition-colors"
                            title="Edit deduction"
                          >
                            <Pencil className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => setShowDeleteConfirm(d.id)}
                            className="p-0.5 text-gray-400 hover:text-red-600 transition-colors"
                            title="Delete deduction"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>

        {/* Add/Edit Modal */}
        {modalOpen && (
          <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
            <div className="relative top-10 mx-auto p-3 border w-11/12 max-w-lg shadow-lg rounded-md bg-white max-h-[85vh] overflow-y-auto">
              <div className="mt-1">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-xs font-medium text-gray-900">
                    {editingDeduction ? 'Edit Deduction' : 'Add New Deduction'}
                  </h3>
                  <button onClick={closeModal} className="text-gray-400 hover:text-gray-600">
                    <X className="h-4 w-4" />
                  </button>
                </div>

                <form onSubmit={handleSubmit} className="space-y-3">
                  {formError && (
                    <div className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-md px-3 py-2">
                      {formError}
                    </div>
                  )}

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[10px] font-medium text-gray-700 mb-1">Name *</label>
                      <input
                        type="text"
                        value={form.name}
                        onChange={e => setForm({ ...form, name: e.target.value })}
                        placeholder="e.g. PAYE"
                        className="w-full px-2.5 py-1.5 text-xs border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-red-500 focus:border-transparent"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-medium text-gray-700 mb-1">Code</label>
                      <input
                        type="text"
                        value={form.code}
                        onChange={e => setForm({ ...form, code: e.target.value })}
                        placeholder="e.g. PAYE"
                        className="w-full px-2.5 py-1.5 text-xs border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-red-500 focus:border-transparent"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[10px] font-medium text-gray-700 mb-1">Calculation Type *</label>
                      <select
                        value={form.calculation_type}
                        onChange={e => setForm({ ...form, calculation_type: e.target.value as 'percentage' | 'fixed' })}
                        className="w-full px-2.5 py-1.5 text-xs border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-red-500 focus:border-transparent"
                      >
                        <option value="fixed">Fixed Amount</option>
                        <option value="percentage">Percentage of Gross</option>
                      </select>
                    </div>
                    {form.calculation_type === 'percentage' ? (
                      <div>
                        <label className="block text-[10px] font-medium text-gray-700 mb-1">Rate (%) *</label>
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          value={form.rate}
                          onChange={e => setForm({ ...form, rate: e.target.value })}
                          className="w-full px-2.5 py-1.5 text-xs border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-red-500 focus:border-transparent"
                          required
                        />
                      </div>
                    ) : (
                      <div>
                        <label className="block text-[10px] font-medium text-gray-700 mb-1">Amount (KES) *</label>
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          value={form.amount}
                          onChange={e => setForm({ ...form, amount: e.target.value })}
                          className="w-full px-2.5 py-1.5 text-xs border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-red-500 focus:border-transparent"
                          required
                        />
                      </div>
                    )}
                  </div>

                  {form.calculation_type === 'percentage' && (
                    <div>
                      <label className="block text-[10px] font-medium text-gray-700 mb-1">Cap Amount (KES, optional)</label>
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={form.cap_amount}
                        onChange={e => setForm({ ...form, cap_amount: e.target.value })}
                        placeholder="e.g. 1080 (max deduction)"
                        className="w-full px-2.5 py-1.5 text-xs border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-red-500 focus:border-transparent"
                      />
                    </div>
                  )}

                  <div>
                    <label className="block text-[10px] font-medium text-gray-700 mb-1">Linked Liability Account *</label>
                    <select
                      value={form.account_id}
                      onChange={e => setForm({ ...form, account_id: e.target.value })}
                      className="w-full px-2.5 py-1.5 text-xs border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-red-500 focus:border-transparent"
                      required
                    >
                      <option value="">Select account</option>
                      {accounts.map(a => (
                        <option key={a.id} value={a.id}>{a.account_code} - {a.account_name}</option>
                      ))}
                    </select>
                    <p className="mt-1 text-[10px] text-gray-500">Only Current Liability accounts (account_type = 10) are shown</p>
                  </div>

                  <div>
                    <label className="block text-[10px] font-medium text-gray-700 mb-1">Description</label>
                    <textarea
                      value={form.description}
                      onChange={e => setForm({ ...form, description: e.target.value })}
                      rows={2}
                      className="w-full px-2.5 py-1.5 text-xs border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-red-500 focus:border-transparent resize-none"
                    />
                  </div>

                  <div className="flex items-center">
                    <input
                      type="checkbox"
                      id="deduction-active"
                      checked={form.is_active}
                      onChange={e => setForm({ ...form, is_active: e.target.checked })}
                      className="h-3 w-3 text-red-600 border-gray-300 rounded focus:ring-red-500"
                    />
                    <label htmlFor="deduction-active" className="ml-2 text-[10px] text-gray-700">Active</label>
                  </div>

                  <div className="flex justify-end gap-2 pt-2">
                    <button
                      type="button"
                      onClick={closeModal}
                      className="px-3 py-1.5 text-xs font-medium text-gray-700 bg-gray-100 border border-gray-300 rounded hover:bg-gray-200"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={submitting}
                      className="px-3 py-1.5 text-xs font-medium text-white bg-red-600 hover:bg-red-700 rounded disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {submitting ? 'Saving...' : editingDeduction ? 'Save Changes' : 'Add Deduction'}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          </div>
        )}

        {/* Delete Confirmation Modal */}
        {showDeleteConfirm !== null && (
          <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
            <div className="relative top-10 mx-auto p-3 border w-11/12 max-w-md shadow-lg rounded-md bg-white">
              <div className="mt-1">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-xs font-medium text-gray-900">Delete Deduction</h3>
                  <button onClick={() => setShowDeleteConfirm(null)} className="text-gray-400 hover:text-gray-600">
                    <X className="h-4 w-4" />
                  </button>
                </div>
                <div className="mb-3">
                  <div className="flex items-center mb-1.5">
                    <AlertCircle className="h-4 w-4 text-red-500 mr-1.5" />
                    <p className="text-xs text-gray-700">
                      Are you sure you want to delete this deduction? This action cannot be undone.
                    </p>
                  </div>
                </div>
                <div className="flex justify-end gap-2">
                  <button
                    className="px-3 py-1.5 text-xs font-medium text-gray-700 bg-gray-100 border border-gray-300 rounded hover:bg-gray-200"
                    onClick={() => setShowDeleteConfirm(null)}
                  >
                    Cancel
                  </button>
                  <button
                    className="px-3 py-1.5 text-xs font-medium text-white bg-red-600 hover:bg-red-700 rounded"
                    onClick={() => handleDelete(showDeleteConfirm)}
                  >
                    Delete Deduction
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default PayrollDeductionsPage;
