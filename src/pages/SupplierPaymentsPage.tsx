import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Receipt, Search, Filter } from 'lucide-react';
import { API_CONFIG } from '../config/api';

interface SupplierPayment {
  id: number;
  payment_number: string;
  supplier_id: number;
  company_name: string;
  payment_date: string;
  payment_method: string;
  amount: number;
  reference: string;
  status: string;
}

const formatCurrency = (amount: number) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'KES' }).format(Number(amount) || 0);

const formatDate = (dateString: string) => {
  if (!dateString) return '-';
  return new Date(dateString).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
};

const formatMethod = (method: string) =>
  (method || '').replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());

const SupplierPaymentsPage: React.FC = () => {
  const navigate = useNavigate();
  const [payments, setPayments] = useState<SupplierPayment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');

  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [showFilterModal, setShowFilterModal] = useState(false);
  const [tempStartDate, setTempStartDate] = useState('');
  const [tempEndDate, setTempEndDate] = useState('');

  useEffect(() => {
    fetchPayments();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [startDate, endDate]);

  const fetchPayments = async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (startDate) params.append('startDate', startDate);
      if (endDate) params.append('endDate', endDate);

      const url = API_CONFIG.getUrl(`/financial/payments?${params}`);
      const response = await fetch(url, {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: Failed to fetch payments`);
      }

      const data = await response.json();
      if (data.success) {
        setPayments(data.data || []);
      } else {
        throw new Error(data.error || 'Failed to fetch payments');
      }
    } catch (err: any) {
      console.error('Error fetching supplier payments:', err);
      setError(err.message || 'Failed to fetch payments');
    } finally {
      setLoading(false);
    }
  };

  const openFilterModal = () => {
    setTempStartDate(startDate);
    setTempEndDate(endDate);
    setShowFilterModal(true);
  };

  const applyFilterChanges = () => {
    setStartDate(tempStartDate);
    setEndDate(tempEndDate);
    setShowFilterModal(false);
  };

  const clearFilter = () => {
    setTempStartDate('');
    setTempEndDate('');
    setStartDate('');
    setEndDate('');
    setShowFilterModal(false);
  };

  const filteredPayments = payments.filter(p =>
    p.payment_number.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (p.company_name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
    (p.reference || '').toLowerCase().includes(searchTerm.toLowerCase())
  );

  const totalAmount = filteredPayments.reduce((sum, p) => sum + Number(p.amount), 0);
  const activeFilterCount = [startDate, endDate].filter(Boolean).length;

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-red-600 mx-auto"></div>
          <p className="mt-3 text-xs text-gray-600">Loading supplier payments...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <p className="text-xs font-semibold text-red-600">Error</p>
          <p className="text-xs text-red-600 mt-1">{error}</p>
          <button
            onClick={fetchPayments}
            className="mt-3 px-3 py-1.5 text-xs bg-red-600 text-white rounded-md hover:bg-red-700"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="w-full px-4 py-4">
        {/* Header */}
        <div className="bg-white border border-gray-200 rounded-md p-3 mb-3">
          <div className="flex items-center gap-2.5">
            <div className="h-8 w-8 rounded-md bg-red-50 flex items-center justify-center">
              <Receipt className="h-4 w-4 text-red-600" />
            </div>
            <div>
              <h1 className="text-sm font-bold text-gray-900">Supplier Payments</h1>
              <p className="text-[10px] text-gray-500">All payments made to suppliers</p>
            </div>
          </div>
        </div>

        {/* Summary Cards */}
        {filteredPayments.length > 0 && (
          <div className="grid grid-cols-2 lg:grid-cols-3 gap-2.5 mb-3">
            <div className="bg-white border border-gray-200 rounded-md p-2.5">
              <p className="text-[9px] font-medium text-gray-500 uppercase tracking-wide">Payments</p>
              <p className="text-sm font-bold text-gray-900 mt-0.5">{filteredPayments.length}</p>
            </div>
            <div className="bg-white border border-gray-200 rounded-md p-2.5">
              <p className="text-[9px] font-medium text-gray-500 uppercase tracking-wide">Total Paid</p>
              <p className="text-sm font-bold text-orange-600 mt-0.5">{formatCurrency(totalAmount)}</p>
            </div>
          </div>
        )}

        {/* Search and Filter */}
        <div className="bg-white border border-gray-200 rounded-md p-3 mb-3">
          <div className="flex flex-col sm:flex-row gap-2">
            <div className="flex-1 relative">
              <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3 w-3 text-gray-400" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-7 pr-2.5 py-1.5 text-xs border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-red-500 focus:border-red-500"
                placeholder="Search payment #, supplier, or reference..."
              />
            </div>
            <button
              type="button"
              onClick={openFilterModal}
              className="inline-flex items-center justify-center gap-1.5 px-3 py-1.5 text-xs border border-gray-300 rounded-md bg-white text-gray-700 hover:bg-gray-50"
            >
              <Filter className="h-3 w-3" />
              Date Filter
              {activeFilterCount > 0 && (
                <span className="inline-flex items-center justify-center h-4 w-4 rounded-full bg-red-600 text-white text-[9px] font-bold">
                  {activeFilterCount}
                </span>
              )}
            </button>
          </div>
        </div>

        {/* Payments Table */}
        <div className="bg-white border border-gray-200 rounded-md overflow-hidden">
          <div className="px-3 py-2 border-b border-gray-200">
            <h3 className="text-xs font-semibold text-gray-900">Payments ({filteredPayments.length})</h3>
          </div>
          {filteredPayments.length === 0 ? (
            <div className="text-center py-10">
              <p className="text-xs font-medium text-gray-700">No payments found</p>
              <p className="text-[10px] text-gray-500 mt-1">
                {searchTerm || activeFilterCount > 0 ? 'Try adjusting your search or filters.' : 'No supplier payments have been recorded yet.'}
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-3 py-2 text-left text-[9px] font-semibold text-gray-500 uppercase tracking-wider">Payment #</th>
                    <th className="px-3 py-2 text-left text-[9px] font-semibold text-gray-500 uppercase tracking-wider">Supplier</th>
                    <th className="px-3 py-2 text-left text-[9px] font-semibold text-gray-500 uppercase tracking-wider">Date</th>
                    <th className="px-3 py-2 text-left text-[9px] font-semibold text-gray-500 uppercase tracking-wider">Method</th>
                    <th className="px-3 py-2 text-left text-[9px] font-semibold text-gray-500 uppercase tracking-wider">Status</th>
                    <th className="px-3 py-2 text-right text-[9px] font-semibold text-gray-500 uppercase tracking-wider">Amount</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 bg-white">
                  {filteredPayments.map((payment) => (
                    <tr
                      key={payment.id}
                      onClick={() => navigate(`/supplier-payment-receipt/${payment.id}`)}
                      className="cursor-pointer hover:bg-red-50"
                    >
                      <td className="px-3 py-2 whitespace-nowrap text-xs font-medium text-gray-900">
                        {payment.payment_number}
                      </td>
                      <td className="px-3 py-2 whitespace-nowrap text-xs text-gray-700">
                        {payment.company_name || `Supplier ${payment.supplier_id}`}
                      </td>
                      <td className="px-3 py-2 whitespace-nowrap text-xs text-gray-700">
                        {formatDate(payment.payment_date)}
                      </td>
                      <td className="px-3 py-2 whitespace-nowrap text-xs text-gray-700">
                        {formatMethod(payment.payment_method)}
                      </td>
                      <td className="px-3 py-2 whitespace-nowrap">
                        <span className={`inline-flex items-center px-1.5 py-0.5 rounded-full text-[9px] font-medium capitalize ${
                          payment.status === 'confirmed' ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'
                        }`}>
                          {payment.status}
                        </span>
                      </td>
                      <td className="px-3 py-2 whitespace-nowrap text-right text-xs font-bold text-gray-900">
                        {formatCurrency(payment.amount)}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot className="bg-gray-50 border-t-2 border-gray-200">
                  <tr>
                    <td colSpan={5} className="px-3 py-2 text-[10px] font-semibold text-gray-700">Total</td>
                    <td className="px-3 py-2 text-right text-xs font-bold text-orange-600">{formatCurrency(totalAmount)}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Filter Modal */}
      {showFilterModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
          <div className="bg-white rounded-md shadow-xl p-4 w-full max-w-sm mx-4">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-xs font-semibold text-gray-900">Filter by Date</h2>
              <button
                onClick={() => setShowFilterModal(false)}
                className="text-gray-400 hover:text-gray-700"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="space-y-2.5">
              <div>
                <label className="block text-[10px] font-medium text-gray-700 mb-1">Start Date</label>
                <input
                  type="date"
                  value={tempStartDate}
                  onChange={e => setTempStartDate(e.target.value)}
                  className="w-full px-2 py-1.5 text-xs border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-red-500 focus:border-red-500"
                />
              </div>
              <div>
                <label className="block text-[10px] font-medium text-gray-700 mb-1">End Date</label>
                <input
                  type="date"
                  value={tempEndDate}
                  onChange={e => setTempEndDate(e.target.value)}
                  className="w-full px-2 py-1.5 text-xs border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-red-500 focus:border-red-500"
                />
              </div>
            </div>

            <div className="mt-4 flex justify-end gap-2">
              <button
                onClick={clearFilter}
                className="px-3 py-1.5 text-xs font-medium text-gray-700 bg-gray-100 border border-gray-300 rounded-md hover:bg-gray-200"
              >
                Clear
              </button>
              <button
                onClick={() => setShowFilterModal(false)}
                className="px-3 py-1.5 text-xs font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={applyFilterChanges}
                className="px-3 py-1.5 text-xs font-medium text-white bg-red-600 rounded-md hover:bg-red-700"
              >
                Apply
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SupplierPaymentsPage;
